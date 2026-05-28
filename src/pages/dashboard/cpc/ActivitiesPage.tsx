import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, Download, FileText, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { ActivityDoc, ActivityStatus, ActivityType } from '@/features/activities/model';
import { normalizeText } from '@/features/activities/model';
import { formatDuration, toActivityFormatLabel, toActivityStatusLabel, toActivityTypeLabel } from '@/features/activities/model';
import type { ActivitiesUiFilters } from '@/features/activities/controller';
import { loadActivitiesForExport, loadActivitiesPage, loadActivitiesSummary, removeActivity } from '@/features/activities/controller';
import { listConsultants } from '@/features/activities/repository';
import { defaultBranding, fetchDocumentBranding } from '@/lib/documentBranding';
import {
  buildPrintBrandingFooterWrappedRowHtml,
  buildPrintBrandingHeaderWrappedRowHtml,
  escapeHtmlForPrint,
  printBrandingStylesCss,
} from '@/lib/printDocumentBrandingHtml';

type ConsultantOption = { id: string; name: string };

/** Temáticas sugeridas no UI (além das que aparecem nos resultados atuais). */
const ACTIVITY_TOPIC_PRESETS = ['Emprego', 'Saúde', 'Cultura', 'Educação', 'Habitação', 'Jurídico', 'Língua', 'Saúde mental'];

function getInitials(name: string): string {
  const parts = name.split(/\s+/g).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = parts[0]?.[0] ?? 'U';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
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

function buildCsv(rows: ActivityDoc[]): string {
  const header = ['Nome', 'Tipo', 'Formato', 'Estado', 'Data', 'Início', 'Fim', 'Duração', 'Consultores', 'Temáticas', 'Local/Link'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push(
      [
        csvEscape(r.title),
        csvEscape(toActivityTypeLabel(r.activityType)),
        csvEscape(toActivityFormatLabel(r.format)),
        csvEscape(toActivityStatusLabel(r.status)),
        csvEscape(r.date),
        csvEscape(r.startTime),
        csvEscape(r.endTime),
        csvEscape(formatDuration(r.durationMinutes)),
        csvEscape((r.consultantNames || []).join(' | ')),
        csvEscape((r.topics || []).join(' | ')),
        csvEscape(r.location || '—'),
      ].join(',')
    );
  });
  return lines.join('\n');
}

async function openPrintableTable(rows: ActivityDoc[], documentTitle: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  const branding = await fetchDocumentBranding().catch(() => defaultBranding());
  const headers = [
    'Nome',
    'Tipo',
    'Formato',
    'Estado',
    'Data',
    'Início',
    'Fim',
    'Duração',
    'Consultores',
    'Temáticas',
    'Local/Link',
  ] as const;
  const colCount = headers.length;
  const html = `
    <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtmlForPrint(documentTitle)}</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial; padding: 24px; }
          h1 { font-size: 18px; margin: 0 0 14px; }
          table.data-export { width: 100%; border-collapse: collapse; font-size: 12px; }
          table.data-export th, table.data-export td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
          table.data-export th { background: #f8fafc; }
          ${printBrandingStylesCss()}
          @media print {
            @page { margin: 16mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtmlForPrint(documentTitle)}</h1>
        <table class="doc-branding-print-header doc-branding-print-footer data-export">
          <thead>
            ${buildPrintBrandingHeaderWrappedRowHtml(branding, colCount)}
            <tr>
              ${headers.map((h) => `<th>${escapeHtmlForPrint(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
                  <tr>
                    <td>${escapeHtmlForPrint(r.title)}</td>
                    <td>${escapeHtmlForPrint(toActivityTypeLabel(r.activityType))}</td>
                    <td>${escapeHtmlForPrint(toActivityFormatLabel(r.format))}</td>
                    <td>${escapeHtmlForPrint(toActivityStatusLabel(r.status))}</td>
                    <td>${escapeHtmlForPrint(r.date)}</td>
                    <td>${escapeHtmlForPrint(r.startTime)}</td>
                    <td>${escapeHtmlForPrint(r.endTime)}</td>
                    <td>${escapeHtmlForPrint(formatDuration(r.durationMinutes))}</td>
                    <td>${escapeHtmlForPrint((r.consultantNames || []).join(', '))}</td>
                    <td>${escapeHtmlForPrint((r.topics || []).join(', '))}</td>
                    <td>${escapeHtmlForPrint(r.location || '—')}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
          <tfoot>
            ${buildPrintBrandingFooterWrappedRowHtml(branding, documentTitle, colCount)}
          </tfoot>
        </table>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function statusBadgeVariant(status: ActivityStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'agendada') return 'default';
  if (status === 'concluida') return 'outline';
  if (status === 'cancelada') return 'destructive';
  return 'secondary';
}

export default function ActivitiesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ActivityDoc | null>(null);

  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);

  const [filters, setFilters] = useState<ActivitiesUiFilters>({
    search: '',
    type: 'all',
    status: 'all',
    format: 'all',
    consultantId: 'all',
    topic: 'all',
    datePreset: 'all',
  });

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ActivityDoc[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const cursorsRef = useRef<Record<number, string | null>>({ 1: null });
  const pagesCount = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);

  const visiblePageNumbers = useMemo(() => {
    const totalPages = pagesCount;
    if (totalPages <= 0) return [];
    const windowSize = Math.min(3, totalPages);
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    return Array.from({ length: windowSize }, (_, idx) => start + idx);
  }, [page, pagesCount]);

  /** Reinicia página/cursores quando mudam filtros ou a pesquisa (evita cursores de outro conjunto filtrado). */
  const filtersPaginationResetKey = useMemo(
    () =>
      JSON.stringify({
        type: filters.type,
        status: filters.status,
        format: filters.format,
        consultantId: filters.consultantId,
        topic: filters.topic,
        datePreset: filters.datePreset,
        searchNorm: normalizeText(filters.search).trim(),
      }),
    [filters.type, filters.status, filters.format, filters.consultantId, filters.topic, filters.datePreset, filters.search]
  );

  useEffect(() => {
    async function loadOptions() {
      try {
        const data = await listConsultants();
        setConsultants(data.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        setConsultants([]);
      }
    }
    loadOptions();
  }, []);

  useLayoutEffect(() => {
    cursorsRef.current = { 1: null };
    setPage(1);
  }, [filtersPaginationResetKey, reloadKey]);

  async function ensureCursorForPage(targetPage: number): Promise<string | null> {
    if (targetPage <= 1) return null;
    if (cursorsRef.current[targetPage] !== undefined) return cursorsRef.current[targetPage] ?? null;
    let current = Object.keys(cursorsRef.current)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .pop();
    if (!current || current < 1) current = 1;
    while (current < targetPage) {
      const cursor = cursorsRef.current[current] ?? null;
      const { rows: pageRows, nextCursor } = await loadActivitiesPage({
        uiFilters: filters,
        limit: 20,
        cursorStartAfterStartAt: cursor,
      });
      cursorsRef.current[current + 1] = nextCursor;
      current += 1;
      if (pageRows.length < 20) break;
    }
    return cursorsRef.current[targetPage] ?? null;
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ total: totalCount }, cursor] = await Promise.all([
          loadActivitiesSummary({ uiFilters: filters }),
          ensureCursorForPage(page),
        ]);
        setTotal(totalCount);
        const { rows: pageRows, nextCursor } = await loadActivitiesPage({
          uiFilters: filters,
          limit: 20,
          cursorStartAfterStartAt: cursor,
        });
        setRows(pageRows);
        if (nextCursor != null) cursorsRef.current[page + 1] = nextCursor;
        else delete cursorsRef.current[page + 1];
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('common.error');
        toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filters, page, reloadKey, t]);

  const showingLabel = useMemo(() => {
    if (total === 0) return t.get('cpc.activities.list.showing_none');
    const start = (page - 1) * 20 + 1;
    const end = Math.min(total, start + rows.length - 1);
    return t.get('cpc.activities.list.showing_range', { start, end, total });
  }, [page, rows.length, t, total]);

  const topicsOptions = useMemo(() => {
    const set = new Set<string>();
    ACTIVITY_TOPIC_PRESETS.forEach((topic) => set.add(topic));
    rows.forEach((r) => (r.topics || []).forEach((topic) => set.add(topic)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  async function handleExport(format: 'csv' | 'pdf') {
    setExporting(format);
    try {
      const exportRows = await loadActivitiesForExport({ uiFilters: filters, maxRows: format === 'pdf' ? 2000 : 5000 });
      if (format === 'csv') {
        const csv = buildCsv(exportRows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `atividades_${new Date().toISOString().slice(0, 10)}.csv`);
        return;
      }
      await openPrintableTable(exportRows, t.get('cpc.activities.title'));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('common.error');
      toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  function openDelete(row: ActivityDoc) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const actorId = user?.uid;
    if (!actorId) {
      toast({ title: t.get('common.error'), description: t.get('cpc.activities.errors.no_auth'), variant: 'destructive' });
      return;
    }
    setDeletingId(deleteTarget.id);
    try {
      await removeActivity({ activityId: deleteTarget.id, actorId });
      toast({ title: t.get('cpc.activities.delete.success.title'), description: t.get('cpc.activities.delete.success.desc', { title: deleteTarget.title }) });
      setDeleteOpen(false);
      setDeleteTarget(null);
      cursorsRef.current = { 1: null };
      setPage(1);
      setReloadKey((k) => k + 1);
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = rawMessage.includes('Missing or insufficient permissions')
        ? t.get('cpc.activities.errors.permission_denied')
        : rawMessage || t.get('cpc.activities.errors.delete_failed');
      toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" /> {t.get('cpc.activities.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.activities.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={exporting !== null}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t.get('cpc.activities.export.button')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('csv')}>
                <FileText className="h-4 w-4 mr-2" />
                {t.get('cpc.activities.export.csv')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                {t.get('cpc.activities.export.pdf')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to="/dashboard/cpc/atividades/nova">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t.get('cpc.activities.actions.new')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="cpc-card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="xl:col-span-2">
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.search.label')}</div>
            <div className="mt-1 relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                placeholder={t.get('cpc.activities.filters.search.placeholder')}
                className="pl-9"
                aria-label={t.get('cpc.activities.filters.search.label')}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t.get('cpc.activities.filters.search.hint')}</p>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.type')}</div>
            <Select value={filters.type} onValueChange={(v) => setFilters((p) => ({ ...p, type: v as ActivityType | 'all' }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.activities.filters.all_types')}</SelectItem>
                <SelectItem value="focus_group">Focus Groups</SelectItem>
                <SelectItem value="workshop">Workshops</SelectItem>
                <SelectItem value="networking">Networking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.status')}</div>
            <Select value={filters.status} onValueChange={(v) => setFilters((p) => ({ ...p, status: v as ActivityStatus | 'all' }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.activities.filters.any_status')}</SelectItem>
                <SelectItem value="rascunho">{t.get('cpc.activities.status.draft')}</SelectItem>
                <SelectItem value="agendada">{t.get('cpc.activities.status.scheduled')}</SelectItem>
                <SelectItem value="concluida">{t.get('cpc.activities.status.completed')}</SelectItem>
                <SelectItem value="cancelada">{t.get('cpc.activities.status.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.format')}</div>
            <Select value={filters.format} onValueChange={(v) => setFilters((p) => ({ ...p, format: v as typeof filters.format }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.activities.filters.all_formats')}</SelectItem>
                <SelectItem value="presencial">{t.get('cpc.activities.format.presencial')}</SelectItem>
                <SelectItem value="online">{t.get('cpc.activities.format.online')}</SelectItem>
                <SelectItem value="hibrido">{t.get('cpc.activities.format.hibrido')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.date')}</div>
            <Select value={filters.datePreset} onValueChange={(v) => setFilters((p) => ({ ...p, datePreset: v as typeof filters.datePreset }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">{t.get('cpc.activities.filters.date_this_month')}</SelectItem>
                <SelectItem value="next_30_days">{t.get('cpc.activities.filters.date_next_30')}</SelectItem>
                <SelectItem value="all">{t.get('cpc.activities.filters.date_all')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.consultant.label')}</div>
            <Select
              value={filters.consultantId}
              onValueChange={(v) => setFilters((p) => ({ ...p, consultantId: v as string | 'all' }))}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.activities.filters.any_consultant')}</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.topic.label')}</div>
            <Select
              value={filters.topic}
              onValueChange={(v) => setFilters((p) => ({ ...p, topic: v as string | 'all' }))}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.activities.filters.any_topic')}</SelectItem>
                {topicsOptions.map((topic) => (
                  <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.filters.hints_title')}</p>
            <p className="text-sm mt-1 text-muted-foreground">{t.get('cpc.activities.filters.hints_body')}</p>
          </div>
        </div>
      </div>

      <div className="cpc-card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{showingLabel}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t.get('cpc.activities.pagination.prev')}
            </Button>
            <div className="flex items-center gap-1">
              {visiblePageNumbers.map((pageNumber) => {
                const active = pageNumber === page;
                return (
                  <Button
                    key={pageNumber}
                    variant={active ? 'default' : 'outline'}
                    className="h-9 w-9 p-0"
                    disabled={loading}
                    onClick={() => setPage(pageNumber)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>
            <Button variant="outline" disabled={page >= pagesCount || loading} onClick={() => setPage((p) => Math.min(pagesCount, p + 1))}>
              {t.get('cpc.activities.pagination.next')}
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.get('cpc.activities.table.activity')}</TableHead>
              <TableHead>{t.get('cpc.activities.table.type')}</TableHead>
              <TableHead>{t.get('cpc.activities.table.date_time')}</TableHead>
              <TableHead>{t.get('cpc.activities.table.consultants')}</TableHead>
              <TableHead>{t.get('cpc.activities.table.location')}</TableHead>
              <TableHead className="text-right">{t.get('cpc.activities.table.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="py-12 text-center text-sm text-muted-foreground">{t.get('cpc.activities.list.empty')}</div>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                          {getInitials(row.title)}
                        </div>
                        <div className="min-w-0">
                          <Link to={`/dashboard/cpc/atividades/${row.id}`} className="font-semibold hover:underline block truncate">
                            {row.title}
                          </Link>
                          <p className="text-sm text-muted-foreground truncate">{(row.topics || []).slice(0, 2).join(' • ') || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge variant="secondary">{toActivityTypeLabel(row.activityType).toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">{toActivityFormatLabel(row.format)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{row.date}</p>
                        <p className="text-muted-foreground">
                          {row.startTime} - {row.endTime}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDuration(row.durationMinutes)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center -space-x-2">
                        {(row.consultantNames || []).slice(0, 3).map((name) => (
                          <div
                            key={name}
                            className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center text-xs font-semibold"
                            title={name}
                          >
                            {getInitials(name)}
                          </div>
                        ))}
                        {(row.consultantNames || []).length > 3 ? (
                          <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center text-xs font-semibold">
                            +{(row.consultantNames || []).length - 3}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[240px]">{row.location || '—'}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant={statusBadgeVariant(row.status)}>{toActivityStatusLabel(row.status).toUpperCase()}</Badge>
                        <Link to={`/dashboard/cpc/atividades/${row.id}/editar`}>
                          <Button variant="ghost" size="icon" aria-label={t.get('cpc.activities.actions.edit')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t.get('cpc.activities.actions.delete')}
                          onClick={() => openDelete(row)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.get('cpc.activities.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.get('cpc.activities.delete.description', { title: deleteTarget?.title ?? '—' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>{t.get('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={deletingId !== null} onClick={() => void confirmDelete()}>
              {t.get('cpc.activities.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
