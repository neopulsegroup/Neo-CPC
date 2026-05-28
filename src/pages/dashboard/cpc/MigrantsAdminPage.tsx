import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDocument, deleteDocument, getDocument, queryDocuments, serverTimestamp, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
  Users,
  Eye,
  Ban,
  CheckCircle,
  AlertTriangle,
  Clock,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { todayIsoAppCalendar } from '@/lib/appCalendar';
import { defaultBranding, fetchDocumentBranding } from '@/lib/documentBranding';
import {
  buildPrintBrandingFooterWrappedRowHtml,
  buildPrintBrandingHeaderWrappedRowHtml,
  escapeHtmlForPrint,
  printBrandingStylesCss,
} from '@/lib/printDocumentBrandingHtml';
import {
  mapProfileToRegion,
  MIGRANT_REGION_FILTER_OPTIONS,
  type MigrantRegion,
  type MigrantRegionFilter,
} from '@/lib/migrantRegion';
import { isSortOption, SORT_STORAGE_KEY, sortMigrants, type SortOption } from './sortMigrants';

type TriageAnswers = Record<string, unknown>;

type MigrantRow = {
  user_id: string;
  name: string;
  email: string;
  nif?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  arrival_date?: string | null;
  legal_status?: string | null;
  work_status?: string | null;
  language_level?: string | null;
  urgencies?: string[] | null;
  triage_answers?: TriageAnswers | null;
  /** `true` quando o documento `triage` tem `completed === true` (triagem inicial submetida). */
  triage_completed: boolean;
  upcoming_sessions?: number;
  trails_progress_avg?: number;
  blocked?: boolean;
  region: MigrantRegion;
  /** Ano em que o migrante entrou no programa CIBEA. `null` se não definido. */
  registration_year: number | null;
  /** Timestamp de criação do registo (Firestore Timestamp, ISO string, ou null). */
  created_at: unknown;
};

type UserDoc = { id: string; name?: string | null; email?: string | null; role?: string | null; nif?: string | null; blocked?: boolean | null; active?: boolean | null; createdAt?: unknown };
type ProfileDoc = {
  name?: string | null;
  email?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  arrivalDate?: string | null;
  region?: 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra' | null;
  regionOther?: string | null;
  currentLocation?: string | null;
  registrationYear?: number | null;
};

/**
 * Opções do filtro de Ano de Registo: 6 anos a contar do ano atual.
 * TODO(D8): confirmar com CIBEA o ano mínimo a aceitar.
 */
function buildRegistrationYearFilterOptions(now = new Date()): number[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let i = 0; i < 6; i += 1) years.push(current - i);
  return years;
}
type TriageDoc = {
  legal_status?: string | null;
  work_status?: string | null;
  language_level?: string | null;
  urgencies?: string[] | null;
  answers?: TriageAnswers | null;
  completed?: boolean | null;
};
type SessionDoc = { migrant_id?: string | null; scheduled_date?: string | null; status?: string | null };
type ProgressDoc = { user_id?: string | null; progress_percent?: number | null };

function normalizeLegalStatus(value?: string | null): 'regular' | 'irregular' | 'pendente' | '' {
  if (!value) return '';
  const v = value.toLowerCase();
  if (['regular', 'regularized', 'refugee'].includes(v)) return 'regular';
  if (['irregular', 'not_regularized'].includes(v)) return 'irregular';
  if (['pendente', 'pending'].includes(v)) return 'pendente';
  return '';
}

function normalizeWorkStatus(value?: string | null): 'empregado' | 'desempregado' | 'informal' | '' {
  if (!value) return '';
  const v = value.toLowerCase();
  if (['empregado', 'employed'].includes(v)) return 'empregado';
  if (['desempregado', 'unemployed', 'unemployed_seeking'].includes(v)) return 'desempregado';
  if (['informal', 'student', 'other'].includes(v)) return 'informal';
  return '';
}

function normalizeLanguageLevel(value?: string | null): 'iniciante' | 'intermediario' | 'avancado' | '' {
  if (!value) return '';
  const v = value.toLowerCase();
  if (['iniciante', 'basic', 'none'].includes(v)) return 'iniciante';
  if (['intermediario', 'intermediate'].includes(v)) return 'intermediario';
  if (['avancado', 'advanced', 'native', 'fluent'].includes(v)) return 'avancado';
  return '';
}

function normalizeUrgencyToken(value?: string | null): 'juridico' | 'psicologico' | 'habitacional' | '' {
  if (!value) return '';
  const v = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (v.includes('jurid')) return 'juridico';
  if (v.includes('psicolog')) return 'psicologico';
  if (v.includes('habitac')) return 'habitacional';
  return '';
}

function normalizeUrgencies(values?: string[] | null): Array<'juridico' | 'psicologico' | 'habitacional'> {
  if (!values || values.length === 0) return [];
  const set = new Set<'juridico' | 'psicologico' | 'habitacional'>();
  values.forEach((value) => {
    const normalized = normalizeUrgencyToken(value);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
}

export default function MigrantsAdminPage() {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<MigrantRow>>([]);
  const [query, setQuery] = useState('');
  const [legalFilter, setLegalFilter] = useState<'all' | 'regular' | 'irregular' | 'pendente'>('all');
  const [workFilter, setWorkFilter] = useState<'all' | 'empregado' | 'desempregado' | 'informal'>('all');
  const [regionFilter, setRegionFilter] = useState<MigrantRegionFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'juridico' | 'psicologico' | 'habitacional'>('all');
  const [triageFilter, setTriageFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [registrationYearFilter, setRegistrationYearFilter] = useState<'all' | number>('all');
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SORT_STORAGE_KEY) : null;
      if (isSortOption(stored)) return stored;
    } catch {
      void 0;
    }
    return 'created_at_desc';
  });
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedTriage, setSelectedTriage] = useState<MigrantRow | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | 'pdf' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MigrantRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const xlsxModuleRef = useRef<typeof import('xlsx') | null>(null);
  const xlsxLoaderRef = useRef<Promise<typeof import('xlsx')> | null>(null);

  function isoDateToPt(value: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }

  function answerLabel(key: string): string {
    const path = `triage.questions.${key}`;
    const translated = t.get(path);
    if (translated !== path) return translated;
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function optionLabel(questionId: string, option: string): string {
    const path = `triage.options.${questionId}.${option}`;
    const translated = t.get(path);
    if (translated !== path) return translated;
    if (option === 'yes') return t.get('common.yes');
    if (option === 'no') return t.get('common.no');
    return option;
  }

  function answerValue(questionId: string, value: unknown): string {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? optionLabel(questionId, item) : String(item)))
        .join(', ');
    }
    if (typeof value === 'boolean') return value ? t.get('common.yes') : t.get('common.no');
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') {
      const datePt = isoDateToPt(value);
      if (datePt) return datePt;
      return optionLabel(questionId, value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function getExportTimestamp(now = new Date()): string {
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvEscape(value: string): string {
    const shouldQuote = /[",\r\n]/.test(value);
    if (!shouldQuote) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  function getStringFromCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') {
      const datePt = isoDateToPt(value);
      if (datePt) return datePt;
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }

  function normalizeEmail(value: unknown): { value: string; valid: boolean } {
    if (typeof value !== 'string') return { value: '—', valid: false };
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—') return { value: '—', valid: false };
    const normalized = trimmed.toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    return { value: valid ? normalized : '—', valid };
  }

  function legalLabel(value?: string | null): string {
    const normalized = normalizeLegalStatus(value);
    if (normalized === 'regular') return t.get('cpc.migrantsAdmin.legal.regular');
    if (normalized === 'irregular') return t.get('cpc.migrantsAdmin.legal.irregular');
    if (normalized === 'pendente') return t.get('cpc.migrantsAdmin.legal.pending');
    return '—';
  }

  function workLabel(value?: string | null): string {
    const normalized = normalizeWorkStatus(value);
    if (normalized === 'empregado') return t.get('cpc.migrantsAdmin.work.employed');
    if (normalized === 'desempregado') return t.get('cpc.migrantsAdmin.work.unemployed');
    if (normalized === 'informal') return t.get('cpc.migrantsAdmin.work.informal');
    return '—';
  }

  function languageLabel(value?: string | null): string {
    const normalized = normalizeLanguageLevel(value);
    if (normalized === 'iniciante') return t.get('cpc.migrantsAdmin.language.beginner');
    if (normalized === 'intermediario') return t.get('cpc.migrantsAdmin.language.intermediate');
    if (normalized === 'avancado') return t.get('cpc.migrantsAdmin.language.advanced');
    return '—';
  }

  function regionLabel(value: MigrantRegion): string {
    const keys: Record<MigrantRegion, string> = {
      Lisboa: 'cpc.migrantsAdmin.region.lisboa',
      Norte: 'cpc.migrantsAdmin.region.norte',
      Centro: 'cpc.migrantsAdmin.region.centro',
      Alentejo: 'cpc.migrantsAdmin.region.alentejo',
      Algarve: 'cpc.migrantsAdmin.region.algarve',
      Desconhecida: 'cpc.migrantsAdmin.region.unknown',
    };
    return t.get(keys[value]);
  }

  function exportRowValue(row: MigrantRow, key: 'birth_date' | 'nationality' | 'arrival_date'): string {
    const fromAnswers = row.triage_answers?.[key] ?? row.triage_answers?.[key === 'arrival_date' ? 'arrival_date_pt' : key];
    if (typeof fromAnswers === 'string') return getStringFromCell(fromAnswers);
    if (key === 'birth_date') return getStringFromCell(row.birth_date);
    if (key === 'nationality') return getStringFromCell(row.nationality);
    return getStringFromCell(row.arrival_date);
  }

  async function handleExport(format: 'csv' | 'xlsx' | 'pdf') {
    if (!profile || !['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer'].includes(profile.role)) {
      toast({
        title: t.get('cpc.migrantsAdmin.export.no_permission.title'),
        description: t.get('cpc.migrantsAdmin.export.no_permission.description'),
        variant: 'destructive',
      });
      return;
    }

    if (format === 'pdf') {
      if (filtered.length === 0) {
        toast({ title: t.get('cpc.migrantsAdmin.export.no_results.title'), description: t.get('cpc.migrantsAdmin.export.no_results.description') });
        return;
      }
      setExporting('pdf');
      try {
        const branding = await fetchDocumentBranding().catch(() => defaultBranding());
        const docTitle = `${t.get('cpc.migrantsAdmin.title')} — ${t.get('cpc.migrantsAdmin.export.button')}`;
        const header = [
          t.get('cpc.migrantsAdmin.export.columns.name'),
          t.get('cpc.migrantsAdmin.export.columns.email'),
          t.get('cpc.migrantsAdmin.export.columns.birth_date'),
          t.get('cpc.migrantsAdmin.export.columns.nationality'),
          t.get('cpc.migrantsAdmin.export.columns.legal_status'),
          t.get('cpc.migrantsAdmin.export.columns.arrival_date'),
          t.get('cpc.migrantsAdmin.export.columns.registration_year'),
        ];
        const colCount = header.length;
        const rowsHtml = filtered.map(r => {
          const email = normalizeEmail(r.email).value;
          return `
            <tr>
              <td>${escapeHtmlForPrint(getStringFromCell(r.name))}</td>
              <td>${escapeHtmlForPrint(email)}</td>
              <td>${escapeHtmlForPrint(exportRowValue(r, 'birth_date'))}</td>
              <td>${escapeHtmlForPrint(exportRowValue(r, 'nationality'))}</td>
              <td>${escapeHtmlForPrint(legalLabel(r.legal_status))}</td>
              <td>${escapeHtmlForPrint(exportRowValue(r, 'arrival_date'))}</td>
              <td>${escapeHtmlForPrint(r.registration_year != null ? String(r.registration_year) : '—')}</td>
            </tr>`;
        }).join('');
        const docHtml = `
          <!doctype html>
          <html lang="pt">
            <head>
              <meta charset="utf-8" />
              <title>${escapeHtmlForPrint(t.get('cpc.migrantsAdmin.title'))} — PDF</title>
              <style>
                body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0a0a0a; }
                h1 { font-size: 20px; margin: 0 0 12px; }
                p { margin: 0 0 12px; color: #444; }
                table.data-export { border-collapse: collapse; width: 100%; font-size: 12px; }
                table.data-export th, table.data-export td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
                table.data-export th { background: #f5f5f5; text-align: left; }
                table.data-export tfoot .export-meta td { border: none; padding-top: 8px; font-size: 11px; color: #666; }
                ${printBrandingStylesCss()}
                @media print {
                  @page { margin: 16mm; }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              <h1>${escapeHtmlForPrint(docTitle)}</h1>
              <p>${escapeHtmlForPrint(t.get('cpc.migrantsAdmin.subtitle'))}</p>
              <table class="doc-branding-print-header doc-branding-print-footer data-export">
                <thead>
                  ${buildPrintBrandingHeaderWrappedRowHtml(branding, colCount)}
                  <tr>${header.map(h => `<th>${escapeHtmlForPrint(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                  ${buildPrintBrandingFooterWrappedRowHtml(branding, docTitle, colCount)}
                  <tr class="export-meta"><td colspan="${colCount}">${escapeHtmlForPrint(String(filtered.length))} ${escapeHtmlForPrint(t.get('cpc.migrantsAdmin.title').toLowerCase())}</td></tr>
                </tfoot>
              </table>
              <script>
                window.onload = function() {
                  setTimeout(function(){ window.print(); }, 300);
                };
              </script>
            </body>
          </html>
        `;
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(docHtml);
          win.document.close();
          try { win.focus(); } catch { /* no-op */ }
        } else {
          const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
          const ts = getExportTimestamp();
          downloadBlob(blob, `migrantes_export_${ts}.html`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.migrantsAdmin.export.generic_error');
        toast({ title: t.get('cpc.migrantsAdmin.export.error_title'), description: message, variant: 'destructive' });
      } finally {
        setExporting(null);
      }
      return;
    }

    if (format === 'xlsx' && !xlsxModuleRef.current) {
      setExporting('xlsx');
      try {
        if (!xlsxLoaderRef.current) {
          xlsxLoaderRef.current = import('xlsx');
        }
        const module = await xlsxLoaderRef.current;
        xlsxModuleRef.current = module;
      } catch {
        toast({
          title: t.get('cpc.migrantsAdmin.export.error_title'),
          description: t.get('cpc.migrantsAdmin.export.xlsx_prepare_error'),
          variant: 'destructive',
        });
      } finally {
        setExporting(null);
      }
      toast({
        title: t.get('cpc.migrantsAdmin.export.xlsx_ready.title'),
        description: t.get('cpc.migrantsAdmin.export.xlsx_ready.description'),
      });
      return;
    }

    if (filtered.length === 0) {
      toast({ title: t.get('cpc.migrantsAdmin.export.no_results.title'), description: t.get('cpc.migrantsAdmin.export.no_results.description') });
      return;
    }

    if (filtered.length > 10000) {
      toast({
        title: t.get('cpc.migrantsAdmin.export.limit_exceeded.title'),
        description: t.get('cpc.migrantsAdmin.export.limit_exceeded.description'),
        variant: 'destructive',
      });
      return;
    }

    setExporting(format);
    try {
      const header = [
        t.get('cpc.migrantsAdmin.export.columns.name'),
        t.get('cpc.migrantsAdmin.export.columns.email'),
        t.get('cpc.migrantsAdmin.export.columns.birth_date'),
        t.get('cpc.migrantsAdmin.export.columns.nationality'),
        t.get('cpc.migrantsAdmin.export.columns.legal_status'),
        t.get('cpc.migrantsAdmin.export.columns.arrival_date'),
      ];
      const data: string[][] = new Array(filtered.length + 1);
      data[0] = header;
      let invalidEmailCount = 0;

      for (let i = 0; i < filtered.length; i += 1) {
        const r = filtered[i];
        const email = normalizeEmail(r.email);
        if (!email.valid) invalidEmailCount += 1;
        data[i + 1] = [
          getStringFromCell(r.name),
          email.value,
          exportRowValue(r, 'birth_date'),
          exportRowValue(r, 'nationality'),
          legalLabel(r.legal_status),
          exportRowValue(r, 'arrival_date'),
          r.registration_year != null ? String(r.registration_year) : '—',
        ];
      }

      const timestamp = getExportTimestamp();
      const baseName = `migrantes_export_${timestamp}`;

      if (format === 'csv') {
        const lines: string[] = new Array(data.length);
        for (let i = 0; i < data.length; i += 1) {
          const row = data[i];
          const cols: string[] = new Array(row.length);
          for (let j = 0; j < row.length; j += 1) {
            cols[j] = csvEscape(row[j] ?? '');
          }
          lines[i] = cols.join(',');
        }
        const csv = `\uFEFF${lines.join('\r\n')}`;
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
      } else {
        const XLSX = xlsxModuleRef.current;
        if (!XLSX) {
          throw new Error(t.get('cpc.migrantsAdmin.export.xlsx_missing_module'));
        }
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, t.get('cpc.migrantsAdmin.title'));
        const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        downloadBlob(
          new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `${baseName}.xlsx`,
        );
      }
      toast({
        title: t.get('cpc.migrantsAdmin.export.done.title'),
        description: t.get('cpc.migrantsAdmin.export.done.description', { count: filtered.length }),
      });
      if (invalidEmailCount > 0) {
        toast({
          title: t.get('cpc.migrantsAdmin.export.warning.title'),
          description: t.get('cpc.migrantsAdmin.export.warning.description', { count: invalidEmailCount }),
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('cpc.migrantsAdmin.export.generic_error');
      toast({ title: t.get('cpc.migrantsAdmin.export.error_title'), description: message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    if (!xlsxLoaderRef.current) {
      xlsxLoaderRef.current = import('xlsx');
      xlsxLoaderRef.current
        .then((module) => {
          xlsxModuleRef.current = module;
        })
        .catch(() => {});
    }

    async function fetchAll() {
      setLoading(true);
      try {
        const migrants = await queryDocuments<UserDoc>('users', [{ field: 'role', operator: 'in', value: ['migrant', 'Migrant', 'MIGRANT'] }]);
        const profileList = migrants.map((u) => ({
          user_id: u.id,
          name: u.name || '',
          email: u.email || '',
          nif: u.nif || null,
          blocked: u.blocked === true,
          created_at: u.createdAt ?? null,
        }));
        const userIds = profileList.map((p) => p.user_id);

        const [profileDocs, triageDocs, sessionDocs, progressDocs] = await Promise.all([
          Promise.all(
            userIds.map(async (uid) => {
              try {
                const profile = await getDocument<ProfileDoc>('profiles', uid);
                return { uid, profile };
              } catch (error) {
                console.error(`Error loading profile for ${uid}:`, error);
                return { uid, profile: null };
              }
            })
          ),
          Promise.all(
            userIds.map(async (uid) => {
              try {
                const triage = await getDocument<TriageDoc>('triage', uid);
                return { uid, triage };
              } catch (error) {
                console.error(`Error loading triage for ${uid}:`, error);
                return { uid, triage: null };
              }
            })
          ),
          queryDocuments<SessionDoc>('sessions', [{ field: 'status', operator: '==', value: 'Agendada' }]),
          queryDocuments<ProgressDoc>('user_trail_progress', []),
        ]);

        const profileMap: Record<string, ProfileDoc> = {};
        profileDocs.forEach((p) => {
          if (p.profile) profileMap[p.uid] = p.profile;
        });

        const triageMap: Record<string, TriageDoc> = {};
        triageDocs.forEach((t) => {
          if (t.triage) triageMap[t.uid] = t.triage;
        });

        const sessionsMap: Record<string, number> = {};
        const todayISO = todayIsoAppCalendar();
        sessionDocs.forEach((s) => {
          if (!s.migrant_id) return;
          if (!userIds.includes(s.migrant_id)) return;
          if (!s.scheduled_date || s.scheduled_date < todayISO) return;
          sessionsMap[s.migrant_id] = (sessionsMap[s.migrant_id] || 0) + 1;
        });

        const progressMap: Record<string, number> = {};
        const agg: Record<string, { sum: number; count: number }> = {};
        progressDocs.forEach((p) => {
          if (!p.user_id || !userIds.includes(p.user_id)) return;
          const val = p.progress_percent || 0;
          const prev = agg[p.user_id] || { sum: 0, count: 0 };
          agg[p.user_id] = { sum: prev.sum + val, count: prev.count + 1 };
        });
        Object.keys(agg).forEach((uid) => {
          const a = agg[uid];
          progressMap[uid] = Math.round(a.count ? a.sum / a.count : 0);
        });

        const result: Array<MigrantRow> = profileList.map((p) => {
          const triage = triageMap[p.user_id];
          const triage_completed = triage?.completed === true;
          return {
            user_id: p.user_id,
            name: profileMap[p.user_id]?.name || p.name || p.email || t.get('cpc.migrantsAdmin.fallback_migrant'),
            email: profileMap[p.user_id]?.email || p.email || '—',
            nif: p.nif || null,
            birth_date: profileMap[p.user_id]?.birthDate || null,
            nationality: profileMap[p.user_id]?.nationality || null,
            arrival_date: profileMap[p.user_id]?.arrivalDate || null,
            legal_status: triage?.legal_status || null,
            work_status: triage?.work_status || null,
            language_level: triage?.language_level || null,
            urgencies: normalizeUrgencies(triage?.urgencies),
            triage_answers: triage?.answers || null,
            triage_completed,
            upcoming_sessions: sessionsMap[p.user_id] || 0,
            trails_progress_avg: progressMap[p.user_id] || 0,
            blocked: p.blocked,
            region: mapProfileToRegion(profileMap[p.user_id]),
            registration_year:
              typeof profileMap[p.user_id]?.registrationYear === 'number' &&
              Number.isFinite(profileMap[p.user_id]?.registrationYear as number)
                ? (profileMap[p.user_id]?.registrationYear as number)
                : null,
            created_at: p.created_at,
          };
        });

        setRows(result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.migrantsAdmin.load.generic_error');
        toast({
          title: t.get('cpc.migrantsAdmin.load.error_title'),
          description: message,
          variant: 'destructive',
        });
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  async function toggleBlock(uid: string) {
    if (!profile || profile.role !== 'admin') {
      toast({
        title: t.get('cpc.migrantsAdmin.delete.no_permission.title'),
        description: t.get('cpc.migrantsAdmin.delete.no_permission.description'),
        variant: 'destructive',
      });
      return;
    }
    const current = rows.find((r) => r.user_id === uid)?.blocked === true;
    const next = !current;
    setBlockingUserId(uid);
    try {
      await updateDocument('users', uid, {
        blocked: next,
        blockedAt: next ? serverTimestamp() : null,
        blockedBy: next ? (user?.uid ?? null) : null,
      });
      if (user?.uid) {
        await addDocument('audit_logs', {
          action: next ? 'user.blocked' : 'user.unblocked',
          actor_id: user.uid,
          target_id: uid,
          createdAt: serverTimestamp(),
        });
      }
      setRows((prev) => prev.map((r) => (r.user_id === uid ? { ...r, blocked: next } : r)));
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = rawMessage.includes('Missing or insufficient permissions')
        ? t.get('cpc.migrantsAdmin.delete.error.permission_denied')
        : rawMessage || t.get('cpc.migrantsAdmin.load.generic_error');
      toast({
        title: t.get('cpc.migrantsAdmin.delete.error.title'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setBlockingUserId(null);
    }
  }

  async function confirmDeleteMigrant() {
    if (!deleteTarget) return;
    const uid = deleteTarget.user_id;
    const name = deleteTarget.name || t.get('cpc.migrantsAdmin.fallback_migrant');
    const allowedRoles: Array<string> = ['admin', 'manager', 'coordinator'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      toast({
        title: t.get('cpc.migrantsAdmin.delete.no_permission.title'),
        description: t.get('cpc.migrantsAdmin.delete.no_permission.description'),
        variant: 'destructive',
      });
      return;
    }

    setDeletingUserId(uid);
    try {
      const [sessions, progress, applications] = await Promise.all([
        queryDocuments<{ id: string }>('sessions', [{ field: 'migrant_id', operator: '==', value: uid }]),
        queryDocuments<{ id: string }>('user_trail_progress', [{ field: 'user_id', operator: '==', value: uid }]),
        queryDocuments<{ id: string }>('job_applications', [{ field: 'applicant_id', operator: '==', value: uid }]),
      ]);

      await Promise.all([
        ...sessions.map((s) => deleteDocument('sessions', s.id)),
        ...progress.map((p) => deleteDocument('user_trail_progress', p.id)),
        ...applications.map((a) => deleteDocument('job_applications', a.id)),
      ]);

      await Promise.all([
        deleteDocument('triage', uid),
        deleteDocument('profiles', uid),
        deleteDocument('users', uid),
      ]);

      const stillExists = await getDocument<{ id: string }>('users', uid);
      if (stillExists) {
        throw new Error(t.get('cpc.migrantsAdmin.delete.error.not_persisted'));
      }

      setRows((prev) => prev.filter((r) => r.user_id !== uid));
      setSelectedTriage((prev) => (prev?.user_id === uid ? null : prev));

      toast({
        title: t.get('cpc.migrantsAdmin.delete.success.title'),
        description: t.get('cpc.migrantsAdmin.delete.success.description', { name }),
      });
      setDeleteTarget(null);
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = rawMessage.includes('Missing or insufficient permissions')
        ? t.get('cpc.migrantsAdmin.delete.error.permission_denied')
        : rawMessage || t.get('cpc.migrantsAdmin.delete.error.generic');
      toast({
        title: t.get('cpc.migrantsAdmin.delete.error.title'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchQuery = query.trim().length === 0 || r.name.toLowerCase().includes(query.toLowerCase());
      const matchLegal = legalFilter === 'all' || normalizeLegalStatus(r.legal_status) === legalFilter;
      const matchWork = workFilter === 'all' || normalizeWorkStatus(r.work_status) === workFilter;
      const matchRegion = regionFilter === 'all' || r.region === regionFilter;
      const matchUrg = urgencyFilter === 'all' || normalizeUrgencies(r.urgencies).includes(urgencyFilter);
      const matchTriage =
        triageFilter === 'all' ||
        (triageFilter === 'complete' && r.triage_completed) ||
        (triageFilter === 'incomplete' && !r.triage_completed);
      const matchYear =
        registrationYearFilter === 'all' || r.registration_year === registrationYearFilter;
      return matchQuery && matchLegal && matchWork && matchRegion && matchUrg && matchTriage && matchYear;
    });
  }, [rows, query, legalFilter, workFilter, regionFilter, urgencyFilter, triageFilter, registrationYearFilter]);

  const filteredSorted = useMemo(() => sortMigrants(filtered, sortBy), [filtered, sortBy]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortBy);
    } catch {
      void 0;
    }
  }, [sortBy]);

  useEffect(() => {
    setPageIndex(0);
  }, [query, legalFilter, workFilter, regionFilter, urgencyFilter, triageFilter, registrationYearFilter, pageSize]);

  useEffect(() => {
    setPageIndex((p) => {
      const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
      return Math.min(p, totalPages - 1);
    });
  }, [filteredSorted.length, pageSize]);

  const totalFiltered = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedRows = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, safePageIndex, pageSize]);
  const showingFrom = totalFiltered === 0 ? 0 : safePageIndex * pageSize + 1;
  const showingTo = Math.min(totalFiltered, safePageIndex * pageSize + pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> {t.get('cpc.migrantsAdmin.title')}</h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.migrantsAdmin.subtitle')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2" disabled={exporting !== null}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t.get('cpc.migrantsAdmin.export.button')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            {t.get('cpc.migrantsAdmin.export.formats.pdf')}
          </DropdownMenuItem>
            <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('csv')}>
              <FileText className="h-4 w-4 mr-2" />
              {t.get('cpc.migrantsAdmin.export.formats.csv')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('xlsx')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t.get('cpc.migrantsAdmin.export.formats.xlsx')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="cpc-card p-6 mb-6 overflow-x-auto">
        <div className="grid w-full min-w-[60rem] grid-cols-7 gap-4">
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.search.label')}</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.get('cpc.migrantsAdmin.filters.search.placeholder')}
              className="mt-1 h-11 w-full min-w-0 text-base"
            />
          </div>
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.legal.label')}</Label>
            <Select value={legalFilter} onValueChange={(v) => setLegalFilter(v as typeof legalFilter)}>
              <SelectTrigger className="mt-1 h-11 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.legal.all')}</SelectItem>
                <SelectItem value="regular">{t.get('cpc.migrantsAdmin.legal.regular')}</SelectItem>
                <SelectItem value="irregular">{t.get('cpc.migrantsAdmin.legal.irregular')}</SelectItem>
                <SelectItem value="pendente">{t.get('cpc.migrantsAdmin.legal.pending')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.work.label')}</Label>
            <Select value={workFilter} onValueChange={(v) => setWorkFilter(v as typeof workFilter)}>
              <SelectTrigger className="mt-1 h-11 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.work.all')}</SelectItem>
                <SelectItem value="empregado">{t.get('cpc.migrantsAdmin.work.employed')}</SelectItem>
                <SelectItem value="desempregado">{t.get('cpc.migrantsAdmin.work.unemployed')}</SelectItem>
                <SelectItem value="informal">{t.get('cpc.migrantsAdmin.work.informal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.region.label')}</Label>
            <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v as MigrantRegionFilter)}>
              <SelectTrigger className="mt-1 h-11 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.region.all')}</SelectItem>
                {MIGRANT_REGION_FILTER_OPTIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {regionLabel(region)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.urgencies.label')}</Label>
            <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as typeof urgencyFilter)}>
              <SelectTrigger className="mt-1 h-11 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.urgencies.all')}</SelectItem>
                <SelectItem value="juridico">{t.get('cpc.migrantsAdmin.urgencies.legal')}</SelectItem>
                <SelectItem value="psicologico">{t.get('cpc.migrantsAdmin.urgencies.psychological')}</SelectItem>
                <SelectItem value="habitacional">{t.get('cpc.migrantsAdmin.urgencies.housing')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.triage.label')}</Label>
            <Select value={triageFilter} onValueChange={(v) => setTriageFilter(v as typeof triageFilter)}>
              <SelectTrigger className="mt-1 h-11 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.triage.all')}</SelectItem>
                <SelectItem value="complete">{t.get('cpc.migrantsAdmin.filters.triage.complete')}</SelectItem>
                <SelectItem value="incomplete">{t.get('cpc.migrantsAdmin.filters.triage.incomplete')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="line-clamp-2">{t.get('cpc.migrantsAdmin.filters.registrationYear.label')}</Label>
            <Select
              value={registrationYearFilter === 'all' ? 'all' : String(registrationYearFilter)}
              onValueChange={(v) => setRegistrationYearFilter(v === 'all' ? 'all' : Number(v))}
            >
              <SelectTrigger className="mt-1 h-11 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.registrationYear.all')}</SelectItem>
                {buildRegistrationYearFilterOptions().map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-4">
            <div className="min-w-[10rem]">
              <Label className="text-muted-foreground">{t.get('cpc.migrantsAdmin.list.sortLabel')}</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="mt-1.5 h-11 w-full sm:w-[18rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">{t.get('cpc.migrantsAdmin.list.sortDateDesc')}</SelectItem>
                  <SelectItem value="created_at_asc">{t.get('cpc.migrantsAdmin.list.sortDateAsc')}</SelectItem>
                  <SelectItem value="name_asc">{t.get('cpc.migrantsAdmin.list.sortAsc')}</SelectItem>
                  <SelectItem value="name_desc">{t.get('cpc.migrantsAdmin.list.sortDesc')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[10rem]">
              <Label className="text-muted-foreground">{t.get('cpc.migrantsAdmin.list.pageSizeLabel')}</Label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as 10 | 20 | 50)}>
                <SelectTrigger className="mt-1.5 h-11 w-full sm:w-[8rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">{t.get('cpc.migrantsAdmin.list.pageSize10')}</SelectItem>
                  <SelectItem value="20">{t.get('cpc.migrantsAdmin.list.pageSize20')}</SelectItem>
                  <SelectItem value="50">{t.get('cpc.migrantsAdmin.list.pageSize50')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalFiltered > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {t.get('cpc.migrantsAdmin.list.showing', { from: showingFrom, to: showingTo, total: totalFiltered })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={safePageIndex <= 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  aria-label={t.get('cpc.migrantsAdmin.list.prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums text-center min-w-[8rem]">
                  {t.get('cpc.migrantsAdmin.list.pageOf', { page: safePageIndex + 1, pages: totalPages })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={safePageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  aria-label={t.get('cpc.migrantsAdmin.list.next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {totalFiltered === 0 ? (
        <div className="cpc-card p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{t.get('cpc.migrantsAdmin.empty.title')}</h3>
          <p className="text-muted-foreground">{t.get('cpc.migrantsAdmin.empty.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedRows.map((r) => (
            <div key={r.user_id} className="cpc-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.blocked ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{t.get('cpc.migrantsAdmin.badges.blocked')}</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.email}</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {legalLabel(r.legal_status)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {workLabel(r.work_status)}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {languageLabel(r.language_level)}</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.stats.urgencies', { count: (r.urgencies || []).length })}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.stats.upcoming_sessions', { count: r.upcoming_sessions || 0 })}</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.stats.avg_progress', { count: r.trails_progress_avg || 0 })}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {t.get('cpc.migrantsAdmin.stats.registration_year', {
                        year: r.registration_year ?? t.get('cpc.migrantsAdmin.stats.registration_year_unset'),
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  <Link to={`/dashboard/cpc/migrantes/${r.user_id}/perfil`} className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><Eye className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.actions.view_profile')}</Link>
                  <Button variant="outline" className="inline-flex items-center justify-center gap-2 w-full" onClick={() => setSelectedTriage(r)}>
                    <ClipboardList className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.actions.triage')}
                  </Button>
                  <Button
                    variant="outline"
                    className="inline-flex items-center justify-center gap-2 w-full"
                    onClick={() => void toggleBlock(r.user_id)}
                    disabled={blockingUserId !== null}
                  >
                    {blockingUserId === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    {r.blocked ? t.get('cpc.migrantsAdmin.actions.activate') : t.get('cpc.migrantsAdmin.actions.block')}
                  </Button>
                  <Button
                    variant="destructive"
                    className="inline-flex items-center justify-center gap-2 w-full"
                    onClick={() => setDeleteTarget(r)}
                    disabled={deletingUserId !== null}
                  >
                    {deletingUserId === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {t.get('cpc.migrantsAdmin.actions.delete')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedTriage} onOpenChange={(open) => { if (!open) setSelectedTriage(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.get('cpc.migrantsAdmin.triageDialog.title', { name: selectedTriage?.name || t.get('cpc.migrantsAdmin.fallback_migrant') })}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {(selectedTriage?.triage_answers && Object.keys(selectedTriage.triage_answers).length > 0) ? (
              <div className="space-y-3">
                {Object.entries(selectedTriage.triage_answers).map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{answerLabel(key)}</p>
                    <p className="text-sm font-medium break-words">{answerValue(key, value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center">
                {t.get('cpc.migrantsAdmin.triageDialog.empty')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.get('cpc.migrantsAdmin.delete.confirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.get('cpc.migrantsAdmin.delete.confirm.description', { name: deleteTarget?.name || t.get('cpc.migrantsAdmin.fallback_migrant') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUserId !== null}>
              {t.get('cpc.migrantsAdmin.delete.buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteMigrant()} disabled={deletingUserId !== null}>
              {t.get('cpc.migrantsAdmin.delete.buttons.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
