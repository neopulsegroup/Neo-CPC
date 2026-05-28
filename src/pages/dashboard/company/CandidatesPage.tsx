import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDocument, countDocuments, deleteDocument, getDocument, queryDocuments, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Eye,
  FileText,
  ChevronDown,
} from 'lucide-react';
import {
  CandidateFormValues,
  CandidateStage,
  ExperienceLevel,
  csvEscape,
  formatCPF,
  formatPhone,
  normalizeText,
  stripUnsafeChars,
  validateCandidate,
  toCandidatePayload,
} from './candidatesUtils';

interface CompanyCandidate {
  id: string;
  company_id: string;
  name: string;
  firstName: string;
  lastName: string;
  cpf: string;
  email: string;
  phone: string;
  desired_role: string;
  experience: ExperienceLevel;
  skills: string[] | null;
  languages: string[] | null;
  job_offer_id: string | null;
  match_percent: number | null;
  stage: CandidateStage;
  created_at: string;
  locationDisplay: string;
  professionalSummary: string;
  resumeUrl: string | null;
}

interface JobOfferLite {
  id: string;
  title: string;
}

type MigrantProfileAvailability = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  professionalTitle?: string | null;
  professionalExperience?: string | null;
  skills?: string | null;
  languagesList?: string | null;
  registeredAt?: unknown | null;
  availableForWork?: boolean | null;
  currentLocation?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  cep?: string | null;
  region?: string | null;
  regionOther?: string | null;
  cvSummary?: string | null;
  resumeUrl?: string | null;
};

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '—', lastName: '—' };
  const parts = trimmed.split(/\s+/);
  const first = parts[0] ?? '—';
  const last = parts.slice(1).join(' ').trim();
  return { firstName: first, lastName: last || '—' };
}

function formatProfileLocation(p: {
  currentLocation?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  cep?: string | null;
  region?: string | null;
  regionOther?: string | null;
}): string {
  const loc = p.currentLocation?.trim();
  if (loc) return loc;
  const line = [p.address?.trim(), p.addressNumber?.trim()].filter(Boolean).join(', ');
  const regionLabel =
    p.region === 'Outra' ? (p.regionOther?.trim() || 'Outra') : p.region?.trim();
  const parts = [line, regionLabel, p.cep?.trim()].filter(Boolean);
  return parts.join(' · ') || '—';
}

const PAGE_SIZE = 4;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getExportTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function startOfMonthIso(): string {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return start.toISOString();
}

function stageLabel(stage: CandidateStage, t: { get: (k: string) => string }): string {
  if (stage === 'interview') return t.get('company.candidates.stage.interview');
  if (stage === 'triage') return t.get('company.candidates.stage.triage');
  if (stage === 'rejected') return t.get('company.candidates.stage.rejected');
  return t.get('company.candidates.stage.hired');
}

function stagePill(stage: CandidateStage): string {
  if (stage === 'interview') return 'bg-blue-100 text-blue-700';
  if (stage === 'triage') return 'bg-amber-100 text-amber-700';
  if (stage === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-emerald-100 text-emerald-700';
}

function presenceDot(stage: CandidateStage): string {
  if (stage === 'triage') return 'bg-slate-300';
  if (stage === 'rejected') return 'bg-red-500';
  return 'bg-emerald-500';
}

function experienceLabel(exp: ExperienceLevel, t: { get: (k: string) => string }): string {
  if (exp === 'junior') return t.get('company.candidates.experience.junior');
  if (exp === 'mid') return t.get('company.candidates.experience.mid');
  return t.get('company.candidates.experience.senior');
}

function clampMatch(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function MatchRing({ value }: { value: number }) {
  const pct = clampMatch(value);
  const radius = 18;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <div className="relative h-12 w-12">
      <svg viewBox="0 0 48 48" className="h-12 w-12">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">{pct}%</span>
    </div>
  );
}

export default function CandidatesPage() {
  const { user, profile, profileData } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const numberFormatter = useMemo(() => {
    const locale = language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale);
  }, [language]);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyResolveError, setCompanyResolveError] = useState<string | null>(null);
  const [offers, setOffers] = useState<JobOfferLite[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);

  const [candidates, setCandidates] = useState<CompanyCandidate[]>([]);
  const [stats, setStats] = useState({ total: 0, newMonth: 0, ideal: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState<string>('all');
  const [minMatch, setMinMatch] = useState(70);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [detailsTarget, setDetailsTarget] = useState<CompanyCandidate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CandidateFormValues, string>>>({});
  const [formValues, setFormValues] = useState<CandidateFormValues>({
    name: '',
    cpf: '',
    email: '',
    phone: '',
    desired_role: '',
    experience: 'mid',
    skills: '',
    job_offer_id: '',
    match_percent: '',
    stage: 'triage',
  });
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyCandidate | null>(null);

  const exportingRef = useRef<'csv' | 'xlsx' | null>(null);
  const xlsxModuleRef = useRef<typeof import('xlsx') | null>(null);
  const xlsxLoaderRef = useRef<Promise<typeof import('xlsx')> | null>(null);

  useEffect(() => {
    void bootstrap();
  }, [user, profile?.role, profileData?.name]);

  useEffect(() => {
    if (!companyId) return;
    setPageIndex(0);
    setPageCursors([null]);
    void fetchOffers(companyId);
    void fetchStats(companyId);
    void fetchPage({ companyId, cursor: null, nextPageIndex: 0 });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setPageIndex(0);
    setPageCursors([null]);
    void fetchStats(companyId);
    void fetchPage({ companyId, cursor: null, nextPageIndex: 0 });
  }, [jobFilter, experienceFilter, minMatch]);

  async function bootstrap() {
    if (!user) return;
    setLoadingInitial(true);
    setCompanyResolveError(null);
    try {
      const company = await queryDocuments<{ id: string }>(
        'companies',
        [{ field: 'user_id', operator: '==', value: user.uid }],
        undefined,
        1
      );

      if (company[0]?.id) {
        setCompanyId(company[0].id);
        return;
      }

      const directCompany = await getDocument<{ id: string; user_id?: string; company_name?: string; verified?: boolean }>(
        'companies',
        user.uid
      );
      if (directCompany) {
        const patch: Record<string, unknown> = {};
        if (directCompany.user_id !== user.uid) patch.user_id = user.uid;
        if (typeof directCompany.company_name !== 'string' || !directCompany.company_name.trim()) {
          patch.company_name =
            (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
            (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
            (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
            user.email ??
            'Empresa';
        }
        if (typeof directCompany.verified !== 'boolean') patch.verified = false;
        if (Object.keys(patch).length > 0) {
          await setDocument('companies', user.uid, patch, true);
        }
        setCompanyId(directCompany.id);
        return;
      }

      if (profile?.role === 'company') {
        const baseName =
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';

        await setDocument(
          'companies',
          user.uid,
          {
            user_id: user.uid,
            company_name: baseName,
            verified: false,
            createdAt: new Date().toISOString(),
          },
          true
        );
        setCompanyId(user.uid);
        return;
      }

      setCompanyId(null);
    } catch (error) {
      console.error('Error loading company:', error);
      setCompanyId(null);
      const code = error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? String((error as { code?: unknown }).code)
        : null;
      const message = error instanceof Error ? error.message : t.get('company.candidates.companyNotFound');
      setCompanyResolveError(code ? `${message} (${code})` : message);
    } finally {
      setLoadingInitial(false);
    }
  }

  async function ensureCompanyProfile() {
    if (!user) return;
    setLoadingInitial(true);
    setCompanyResolveError(null);
    try {
      const baseName =
        (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
        (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
        (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
        user.email ??
        'Empresa';

      await setDocument(
        'companies',
        user.uid,
        {
          user_id: user.uid,
          company_name: baseName,
          verified: false,
          createdAt: new Date().toISOString(),
        },
        true
      );
      setCompanyId(user.uid);
      toast({ title: 'Perfil de empresa criado' });
    } catch (error) {
      console.error('Error creating company profile:', error);
      const code = error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? String((error as { code?: unknown }).code)
        : null;
      const message = error instanceof Error ? error.message : 'Erro ao criar perfil de empresa';
      const desc = code ? `${message} (${code})` : message;
      setCompanyResolveError(desc);
      toast({
        title: 'Não foi possível criar o perfil de empresa',
        description: desc,
        variant: 'destructive',
      });
    } finally {
      setLoadingInitial(false);
    }
  }

  async function fetchOffers(companyIdValue: string) {
    try {
      const data = await queryDocuments<JobOfferLite>(
        'job_offers',
        [{ field: 'company_id', operator: '==', value: companyIdValue }],
        { field: 'created_at', direction: 'desc' },
        100
      );
      setOffers(data);
    } catch (error) {
      console.error('Error fetching offers:', error);
      setOffers([]);
    }
  }

  async function fetchStats(companyIdValue: string) {
    const monthStart = startOfMonthIso();
    const filtersBase: { field: string; operator: '==' | '>='; value: unknown }[] = [
      { field: 'availableForWork', operator: '==', value: true },
    ];
    let total = 0;
    let newMonth = 0;
    try {
      total = await countDocuments('profiles', filtersBase);
    } catch (error) {
      console.error('Error counting profiles (total):', error);
    }
    try {
      newMonth = await countDocuments('profiles', [
        ...filtersBase,
        { field: 'registeredAt', operator: '>=', value: monthStart },
      ]);
    } catch (error) {
      console.error('Error counting profiles (newMonth):', error);
    }
    setStats({ total, newMonth, ideal: total });
  }

  async function fetchPage(args: { companyId: string; cursor: string | null; nextPageIndex: number }) {
    setLoadingList(true);
    try {
      // Sem orderBy no servidor: evita índice composto (availableForWork + name). Ordenação em memória.
      const profiles = await queryDocuments<MigrantProfileAvailability>(
        'profiles',
        [{ field: 'availableForWork', operator: '==', value: true }],
        undefined,
        1000
      );
      const sorted = [...profiles].sort((a, b) => {
        const na = (a.name || '').trim().toLocaleLowerCase();
        const nb = (b.name || '').trim().toLocaleLowerCase();
        return na.localeCompare(nb, undefined, { sensitivity: 'base' });
      });
      const mapped = sorted.map<CompanyCandidate>((p) => {
        const skills = (p.skills || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const languages = (p.languagesList || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const expText = (p.professionalExperience || '').toLowerCase();
        const experience: ExperienceLevel =
          expText.includes('senior') || expText.includes('sénior')
            ? 'senior'
            : expText.includes('junior')
              ? 'junior'
              : 'mid';
        const registeredAtIso =
          typeof p.registeredAt === 'string'
            ? p.registeredAt
            : p.registeredAt && typeof p.registeredAt === 'object' && 'toDate' in (p.registeredAt as Record<string, unknown>)
              ? ((p.registeredAt as { toDate: () => Date }).toDate().toISOString())
              : new Date().toISOString();
        const rawName = p.name?.trim() || '';
        const displayName = rawName || 'Sem nome';
        const { firstName, lastName } = splitDisplayName(rawName);
        const summaryText = (p.cvSummary || '').trim() || (p.professionalExperience || '').trim();
        const resumeUrl =
          typeof p.resumeUrl === 'string' && p.resumeUrl.trim() ? p.resumeUrl.trim() : null;
        return {
          id: p.id,
          company_id: args.companyId,
          name: displayName,
          firstName,
          lastName,
          cpf: '',
          email: p.email?.trim() || '—',
          phone: p.phone?.trim() || '—',
          desired_role: p.professionalTitle?.trim() || '—',
          experience,
          skills: skills.length ? skills : null,
          languages: languages.length ? languages : null,
          job_offer_id: null,
          match_percent: 100,
          stage: 'triage',
          created_at: registeredAtIso,
          locationDisplay: formatProfileLocation(p),
          professionalSummary: summaryText,
          resumeUrl,
        };
      });
      setCandidates(mapped);
      setHasNextPage(false);
      setPageCursors([null]);
      if (args.nextPageIndex !== 0) setPageIndex(0);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setCandidates([]);
      setHasNextPage(false);
    } finally {
      setLoadingList(false);
    }
  }


  const filteredCandidates = useMemo(() => {
    const q = normalizeText(searchQuery);
    const skillsQ = normalizeText(skillsFilter);
    const skillTokens = skillsQ ? skillsQ.split(/\s+/g).filter(Boolean) : [];
    if (!q && skillTokens.length === 0) return candidates;
    return candidates.filter((c) => {
      const name = normalizeText(c.name);
      const role = normalizeText(c.desired_role);
      const skills = (c.skills || []).map((s) => normalizeText(s));
      const matchMain = !q || name.includes(q) || role.includes(q);
      const matchSkills =
        skillTokens.length === 0 ||
        skillTokens.every((tok) => skills.some((s) => s.includes(tok)));
      return matchMain && matchSkills;
    });
  }, [candidates, searchQuery, skillsFilter]);

  const shownFrom = pageIndex * PAGE_SIZE + (filteredCandidates.length ? 1 : 0);
  const shownTo = pageIndex * PAGE_SIZE + filteredCandidates.length;

  function openCreate() {
    setFormMode('create');
    setEditTargetId(null);
    setFormErrors({});
    setFormValues({
      name: '',
      cpf: '',
      email: '',
      phone: '',
      desired_role: '',
      experience: 'mid',
      skills: '',
      job_offer_id: '',
      match_percent: '',
      stage: 'triage',
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!companyId) return;
    const errs = validateCandidate(formValues, t);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload = toCandidatePayload(companyId, formValues);
      if (formMode === 'create') {
        await addDocument('company_candidates', { ...payload, created_at: new Date().toISOString() });
        toast({ title: t.get('company.candidates.toast.created.title'), description: t.get('company.candidates.toast.created.description') });
      } else if (editTargetId) {
        await updateDocument('company_candidates', editTargetId, payload);
        toast({ title: t.get('company.candidates.toast.updated.title'), description: t.get('company.candidates.toast.updated.description') });
      }
      setFormOpen(false);
      setEditTargetId(null);
      setFormMode('create');
      setFormErrors({});
      setPageIndex(0);
      setPageCursors([null]);
      await fetchStats(companyId);
      await fetchPage({ companyId, cursor: null, nextPageIndex: 0 });
    } catch (error) {
      console.error('Error saving candidate:', error);
      toast({ title: t.get('company.candidates.toast.error.title'), description: t.get('company.candidates.toast.error.description'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!companyId || !deleteTarget) return;
    try {
      await deleteDocument('company_candidates', deleteTarget.id);
      toast({ title: t.get('company.candidates.toast.deleted.title'), description: t.get('company.candidates.toast.deleted.description') });
      setDeleteTarget(null);
      setPageIndex(0);
      setPageCursors([null]);
      await fetchStats(companyId);
      await fetchPage({ companyId, cursor: null, nextPageIndex: 0 });
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast({
        title: t.get('company.candidates.toast.error.title'),
        description: t.get('company.candidates.toast.error.delete_failed'),
        variant: 'destructive',
      });
    }
  }

  async function handleExport(format: 'csv' | 'xlsx') {
    if (exportingRef.current) return;
    if (filteredCandidates.length === 0) {
      toast({ title: t.get('company.candidates.export.no_results.title'), description: t.get('company.candidates.export.no_results.description') });
      return;
    }
    if (filteredCandidates.length > 10000) {
      toast({ title: t.get('company.candidates.export.limit.title'), description: t.get('company.candidates.export.limit.description'), variant: 'destructive' });
      return;
    }

    if (format === 'xlsx' && !xlsxModuleRef.current) {
      exportingRef.current = 'xlsx';
      try {
        if (!xlsxLoaderRef.current) xlsxLoaderRef.current = import('xlsx');
        const mod = await xlsxLoaderRef.current;
        xlsxModuleRef.current = mod;
      } catch {
        toast({ title: t.get('company.candidates.export.error.title'), description: t.get('company.candidates.export.error.xlsx_prepare'), variant: 'destructive' });
      } finally {
        exportingRef.current = null;
      }
      toast({ title: t.get('company.candidates.export.xlsx_ready.title'), description: t.get('company.candidates.export.xlsx_ready.description') });
      return;
    }

    exportingRef.current = format;
    try {
      const header = [
        t.get('company.candidates.export.columns.name'),
        t.get('company.candidates.export.columns.cpf'),
        t.get('company.candidates.export.columns.email'),
        t.get('company.candidates.export.columns.phone'),
        t.get('company.candidates.export.columns.desired_role'),
        t.get('company.candidates.export.columns.experience'),
        t.get('company.candidates.export.columns.skills'),
      ];
      const rows: string[][] = new Array(filteredCandidates.length + 1);
      rows[0] = header;
      for (let i = 0; i < filteredCandidates.length; i += 1) {
        const c = filteredCandidates[i];
        rows[i + 1] = [
          c.name,
          formatCPF(c.cpf),
          c.email,
          formatPhone(c.phone),
          c.desired_role,
          experienceLabel(c.experience, t),
          (c.skills || []).join(' | '),
        ];
      }

      const baseName = `candidatos_export_${getExportTimestamp()}`;
      if (format === 'csv') {
        const lines: string[] = new Array(rows.length);
        for (let i = 0; i < rows.length; i += 1) {
          const row = rows[i];
          const cols: string[] = new Array(row.length);
          for (let j = 0; j < row.length; j += 1) cols[j] = csvEscape(row[j] ?? '');
          lines[i] = cols.join(',');
        }
        const csv = `\uFEFF${lines.join('\r\n')}`;
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
      } else {
        const XLSX = xlsxModuleRef.current;
        if (!XLSX) throw new Error(t.get('company.candidates.export.error.xlsx_missing'));
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, t.get('company.candidates.title'));
        const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${baseName}.xlsx`);
      }

      toast({
        title: t.get('company.candidates.export.done.title'),
        description: t.get('company.candidates.export.done.description', { count: filteredCandidates.length }),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('company.candidates.export.error.generic');
      toast({ title: t.get('company.candidates.export.error.title'), description: message, variant: 'destructive' });
    } finally {
      exportingRef.current = null;
    }
  }

  const offerTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of offers) map.set(o.id, o.title);
    return map;
  }, [offers]);

  if (loadingInitial) {
    return (
      <div className="cpc-card p-10 text-center text-sm text-muted-foreground">
        {t.get('company.candidates.loading')}
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="cpc-card p-10 text-center text-sm text-muted-foreground space-y-4">
        <div>{t.get('company.candidates.companyNotFound')}</div>
        {companyResolveError ? <div className="text-xs text-destructive">{companyResolveError}</div> : null}
        <div className="flex justify-center">
          <Button onClick={ensureCompanyProfile} disabled={!user || loadingInitial}>
            Criar perfil de empresa
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {t.get('company.candidates.breadcrumbs.root')} /{' '}
            <span className="text-foreground">{t.get('company.candidates.breadcrumbs.current')}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{t.get('company.candidates.title')}</h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="cpc-card px-5 py-4">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.kpis.total')}</p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="text-3xl font-bold">{numberFormatter.format(stats.total)}</p>
              <span className="text-sm font-semibold text-emerald-600">
                +{Math.min(99, Math.max(0, Math.round((stats.newMonth / Math.max(1, stats.total)) * 100)))}%
              </span>
            </div>
          </div>
          <div className="cpc-card px-5 py-4">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.kpis.newMonth')}</p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="text-3xl font-bold">{numberFormatter.format(stats.newMonth)}</p>
              <span className="text-sm font-semibold text-primary">Fase 1</span>
            </div>
          </div>
          <div className="cpc-card px-5 py-4">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.kpis.ideal')}</p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="text-3xl font-bold">{numberFormatter.format(stats.ideal)}</p>
              <span className="text-sm font-semibold text-primary">★ Top Tier</span>
            </div>
          </div>
        </div>
      </div>

      <div className="cpc-card overflow-hidden">
        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="candidate-filter-job" className="text-xs font-semibold tracking-widest text-muted-foreground">
                {t.get('company.candidates.filters.job')}
              </label>
              <div className="relative">
                <select
                  id="candidate-filter-job"
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-input bg-muted/30 px-3 pr-10"
                >
                  <option value="all">{t.get('company.candidates.filters.job_all')}</option>
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="candidate-filter-skills" className="text-xs font-semibold tracking-widest text-muted-foreground">
                {t.get('company.candidates.filters.skills')}
              </label>
              <div className="relative">
                <Input
                  id="candidate-filter-skills"
                  value={skillsFilter}
                  onChange={(e) => setSkillsFilter(e.target.value)}
                  placeholder={t.get('company.candidates.filters.skills_placeholder')}
                  className="h-11 rounded-xl bg-muted/30 pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  #
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="candidate-filter-exp" className="text-xs font-semibold tracking-widest text-muted-foreground">
                {t.get('company.candidates.filters.experience')}
              </label>
              <div className="relative">
                <select
                  id="candidate-filter-exp"
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-input bg-muted/30 px-3 pr-10"
                >
                  <option value="all">{t.get('company.candidates.filters.experience_all')}</option>
                  <option value="junior">{t.get('company.candidates.experience.junior')}</option>
                  <option value="mid">{t.get('company.candidates.experience.mid')}</option>
                  <option value="senior">{t.get('company.candidates.experience.senior')}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="candidate-filter-match" className="text-xs font-semibold tracking-widest text-muted-foreground">
                {t.get('company.candidates.filters.minMatch')}
              </label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[minMatch]}
                  max={100}
                  step={1}
                  onValueChange={(v) => setMinMatch(v[0] ?? 0)}
                />
                <span className="w-10 text-right text-sm font-semibold text-primary">{minMatch}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t">
          {loadingList ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t.get('company.candidates.loading')}</div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t.get('company.candidates.empty')}</div>
          ) : (
            <div className="divide-y">
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_140px_minmax(0,2fr)_180px_80px] gap-4 px-8 py-4 text-xs font-semibold tracking-widest text-muted-foreground bg-muted/20">
                <span>{t.get('company.candidates.table.headers.candidate')}</span>
                <span className="text-center">{t.get('company.candidates.table.headers.match')}</span>
                <span>{t.get('company.candidates.table.headers.skills')}</span>
                <span>{t.get('company.candidates.table.headers.stage')}</span>
                <span className="text-center">{t.get('company.candidates.table.headers.actions')}</span>
              </div>
              {filteredCandidates.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_140px_minmax(0,2fr)_180px_80px] gap-4 px-4 md:px-8 py-5 items-center"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-sm font-semibold text-muted-foreground">
                        {stripUnsafeChars(c.name).slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                      <span className={`absolute bottom-0 left-0 h-3 w-3 rounded-full border-2 border-background ${presenceDot(c.stage)}`} />
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{c.desired_role}</p>
                    </div>
                  </div>

                  <div className="flex justify-start md:justify-center">
                    <MatchRing value={c.match_percent ?? 0} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(c.skills || []).slice(0, 3).map((s) => (
                      <span key={s} className="text-xs px-2 py-1 rounded-md bg-muted/60 border border-muted-foreground/15">
                        {s}
                      </span>
                    ))}
                    {(c.skills || []).length > 3 ? (
                      <span className="text-xs px-2 py-1 rounded-md bg-muted/60 border border-muted-foreground/15">+{(c.skills || []).length - 3}</span>
                    ) : null}
                  </div>

                  <div className="flex items-center">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${stagePill(c.stage)}`}>
                      <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                      {stageLabel(c.stage, t)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                      aria-label={t.get('company.candidates.actions.view')}
                      onClick={() => setDetailsTarget(c)}
                    >
                      <Eye className="h-5 w-5 text-primary" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            {t.get('company.candidates.pagination.summary', {
              from: numberFormatter.format(shownFrom),
              to: numberFormatter.format(shownTo),
              total: numberFormatter.format(stats.total),
            })}
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pageIndex === 0 || loadingList}
              onClick={async () => {
                if (!companyId || pageIndex === 0) return;
                const nextIndex = Math.max(0, pageIndex - 1);
                const cursor = pageCursors[nextIndex] ?? null;
                setPageIndex(nextIndex);
                await fetchPage({ companyId, cursor, nextPageIndex: nextIndex });
              }}
            >
              {t.get('company.candidates.pagination.prev')}
            </Button>

            <button type="button" className="h-10 w-10 rounded-md bg-primary text-primary-foreground font-semibold">
              {pageIndex + 1}
            </button>
            {hasNextPage ? (
              <>
                <button
                  type="button"
                  className="h-10 w-10 rounded-md border bg-background hover:bg-muted font-semibold disabled:opacity-50"
                  disabled={loadingList}
                  onClick={async () => {
                    if (!companyId || !hasNextPage) return;
                    const nextIndex = pageIndex + 1;
                    const cursor = pageCursors[nextIndex] ?? candidates[candidates.length - 1]?.created_at ?? null;
                    setPageIndex(nextIndex);
                    await fetchPage({ companyId, cursor, nextPageIndex: nextIndex });
                  }}
                >
                  {pageIndex + 2}
                </button>
                <button type="button" className="h-10 w-10 rounded-md border bg-background font-semibold opacity-60" disabled>
                  {pageIndex + 3}
                </button>
                <span className="px-2 text-muted-foreground">…</span>
              </>
            ) : null}

            <Button
              type="button"
              variant="outline"
              disabled={!hasNextPage || loadingList}
              onClick={async () => {
                if (!companyId || !hasNextPage) return;
                const nextIndex = pageIndex + 1;
                const cursor = pageCursors[nextIndex] ?? candidates[candidates.length - 1]?.created_at ?? null;
                setPageIndex(nextIndex);
                await fetchPage({ companyId, cursor, nextPageIndex: nextIndex });
              }}
            >
              {t.get('company.candidates.pagination.next')}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!detailsTarget} onOpenChange={(open) => { if (!open) setDetailsTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailsTarget?.name || t.get('company.candidates.details.title')}</DialogTitle>
            <DialogDescription>{t.get('company.candidates.details.description')}</DialogDescription>
          </DialogHeader>
          {detailsTarget ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.firstName')}</p>
                <p className="mt-1 font-medium">{detailsTarget.firstName}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.lastName')}</p>
                <p className="mt-1 font-medium">{detailsTarget.lastName}</p>
              </div>
              <div className="rounded-xl border p-4 md:col-span-2">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.professionalTitle')}</p>
                <p className="mt-1 font-medium">{detailsTarget.desired_role}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.email')}</p>
                <p className="mt-1 font-medium break-words">{detailsTarget.email}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.phone')}</p>
                <p className="mt-1 font-medium">
                  {detailsTarget.phone && detailsTarget.phone !== '—' ? formatPhone(detailsTarget.phone) : detailsTarget.phone}
                </p>
              </div>
              <div className="rounded-xl border p-4 md:col-span-2">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.location')}</p>
                <p className="mt-1 font-medium whitespace-pre-wrap">{detailsTarget.locationDisplay}</p>
              </div>
              <div className="rounded-xl border p-4 md:col-span-2">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.summary')}</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {detailsTarget.professionalSummary.trim()
                    ? detailsTarget.professionalSummary
                    : t.get('company.candidates.details.emptySummary')}
                </p>
              </div>
              <div className="rounded-xl border p-4 md:col-span-2">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.skills')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detailsTarget.skills || []).length ? (
                    (detailsTarget.skills || []).map((s) => (
                      <span key={s} className="text-xs px-2 py-1 rounded-md bg-muted border">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{t.get('company.candidates.details.noSkills')}</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border p-4 md:col-span-2">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.details.languages')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detailsTarget.languages || []).length ? (
                    (detailsTarget.languages || []).map((lang) => (
                      <span key={lang} className="text-xs px-2 py-1 rounded-md bg-muted border">
                        {lang}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{t.get('company.candidates.details.noLanguages')}</span>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {detailsTarget.resumeUrl ? (
                  <Button asChild variant="default" className="w-full sm:w-auto">
                    <a href={detailsTarget.resumeUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="mr-2 h-4 w-4" />
                      {t.get('company.candidates.details.viewCurriculum')}
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant="default" className="w-full sm:w-auto">
                    <Link to={`/dashboard/empresa/candidatos/${detailsTarget.id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t.get('company.candidates.details.viewCurriculum')}
                    </Link>
                  </Button>
                )}
              </div>
              {detailsTarget.job_offer_id ? (
                <div className="rounded-xl border p-4 md:col-span-2">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.candidates.filters.job')}</p>
                  <p className="mt-1 font-medium">
                    {offerTitleById.get(detailsTarget.job_offer_id) || t.get('company.candidates.table.jobFallback')}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsTarget(null)}>
              {t.get('company.candidates.details.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setFormOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? t.get('company.candidates.form.title_create') : t.get('company.candidates.form.title_edit')}
            </DialogTitle>
            <DialogDescription>{t.get('company.candidates.form.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cand-name" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.name')}
              </label>
              <Input
                id="cand-name"
                value={formValues.name}
                onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-cpf" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.cpf')}
              </label>
              <Input
                id="cand-cpf"
                value={formValues.cpf}
                onChange={(e) => setFormValues((p) => ({ ...p, cpf: e.target.value }))}
                aria-invalid={!!formErrors.cpf}
              />
              {formErrors.cpf ? <p className="text-xs text-destructive">{formErrors.cpf}</p> : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="cand-email" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.email')}
              </label>
              <Input
                id="cand-email"
                value={formValues.email}
                onChange={(e) => setFormValues((p) => ({ ...p, email: e.target.value }))}
                aria-invalid={!!formErrors.email}
              />
              {formErrors.email ? <p className="text-xs text-destructive">{formErrors.email}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-phone" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.phone')}
              </label>
              <Input
                id="cand-phone"
                value={formValues.phone}
                onChange={(e) => setFormValues((p) => ({ ...p, phone: e.target.value }))}
                aria-invalid={!!formErrors.phone}
              />
              {formErrors.phone ? <p className="text-xs text-destructive">{formErrors.phone}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-role" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.desired_role')}
              </label>
              <Input
                id="cand-role"
                value={formValues.desired_role}
                onChange={(e) => setFormValues((p) => ({ ...p, desired_role: e.target.value }))}
                aria-invalid={!!formErrors.desired_role}
              />
              {formErrors.desired_role ? <p className="text-xs text-destructive">{formErrors.desired_role}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-exp" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.experience')}
              </label>
              <select
                id="cand-exp"
                value={formValues.experience}
                onChange={(e) => setFormValues((p) => ({ ...p, experience: e.target.value as ExperienceLevel }))}
                className="h-11 w-full px-3 rounded-xl border border-input bg-background"
                aria-invalid={!!formErrors.experience}
              >
                <option value="junior">{t.get('company.candidates.experience.junior')}</option>
                <option value="mid">{t.get('company.candidates.experience.mid')}</option>
                <option value="senior">{t.get('company.candidates.experience.senior')}</option>
              </select>
              {formErrors.experience ? <p className="text-xs text-destructive">{formErrors.experience}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-stage" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.stage')}
              </label>
              <select
                id="cand-stage"
                value={formValues.stage}
                onChange={(e) => setFormValues((p) => ({ ...p, stage: e.target.value as CandidateStage }))}
                className="h-11 w-full px-3 rounded-xl border border-input bg-background"
                aria-invalid={!!formErrors.stage}
              >
                <option value="triage">{t.get('company.candidates.stage.triage')}</option>
                <option value="interview">{t.get('company.candidates.stage.interview')}</option>
                <option value="rejected">{t.get('company.candidates.stage.rejected')}</option>
                <option value="hired">{t.get('company.candidates.stage.hired')}</option>
              </select>
              {formErrors.stage ? <p className="text-xs text-destructive">{formErrors.stage}</p> : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="cand-skills" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.skills')}
              </label>
              <Input
                id="cand-skills"
                value={formValues.skills}
                onChange={(e) => setFormValues((p) => ({ ...p, skills: e.target.value }))}
                placeholder={t.get('company.candidates.form.placeholders.skills')}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-job" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.job_offer')}
              </label>
              <select
                id="cand-job"
                value={formValues.job_offer_id}
                onChange={(e) => setFormValues((p) => ({ ...p, job_offer_id: e.target.value }))}
                className="h-11 w-full px-3 rounded-xl border border-input bg-background"
              >
                <option value="">{t.get('company.candidates.form.placeholders.job_offer')}</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="cand-match" className="text-sm font-medium">
                {t.get('company.candidates.form.labels.match')}
              </label>
              <Input
                id="cand-match"
                value={formValues.match_percent}
                onChange={(e) => setFormValues((p) => ({ ...p, match_percent: e.target.value }))}
                placeholder="0-100"
                aria-invalid={!!formErrors.match_percent}
              />
              {formErrors.match_percent ? <p className="text-xs text-destructive">{formErrors.match_percent}</p> : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t.get('company.candidates.form.buttons.cancel')}
            </Button>
            <Button onClick={() => void submitForm()} disabled={saving}>
              {t.get('company.candidates.form.buttons.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.get('company.candidates.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.get('company.candidates.delete.description', { name: deleteTarget?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t.get('company.candidates.delete.buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={saving}>
              {t.get('company.candidates.delete.buttons.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
