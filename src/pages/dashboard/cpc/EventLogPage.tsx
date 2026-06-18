import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { queryDocuments } from '@/integrations/firebase/firestore';
import { createdAtToIso } from '@/lib/firestoreTimestamps';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildAuditLogMetadata,
  filterEventLogRows,
  getAuditLogActionKind,
  getAuditLogRequestLabel,
  getAuditLogResource,
  getEventLogActionDescription,
  getEventLogScope,
  getUniqueActionCodes,
  inferAuditLogCriticality,
  inferAuditLogHttpStatus,
  inferAuditLogOrigin,
  inferAuditLogResult,
  loadActorMetaById,
  paginateRows,
  resolveActorDisplayName,
  resolveActorEmail,
  type AuditLogCriticality,
  type AuditLogOrigin,
  type AuditLogRawDoc,
  type AuditLogResult,
  type EventLogScope,
} from '@/pages/dashboard/cpc/eventLogDisplay';
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search } from 'lucide-react';

type AuditLogRow = AuditLogRawDoc & {
  id: string;
  action?: string | null;
  actor_id?: string | null;
  createdAt?: unknown;
};

type EventLogEntry = {
  id: string;
  action: string;
  actorId: string;
  context: string;
  targetId: string;
  entityType: string;
  entityId: string;
  createdAtIso: string;
  createdAtMs: number;
  durationMs: number | null;
  ipAddress: string;
  userAgent: string;
  httpMethod: string;
  httpPath: string;
  httpStatus: number | null;
  requestId: string;
  companyId: string;
  metadata: Record<string, unknown> | null;
  criticality: AuditLogCriticality;
  result: AuditLogResult;
  origin: AuditLogOrigin;
};

type DisplayEventLogEntry = EventLogEntry & {
  actionLabel: string;
  actionKind: string;
  actorLabel: string;
  actorEmail: string;
  actorRole: string;
  scope: EventLogScope;
  requestLabel: string;
  httpStatusDisplay: number;
  resource: string;
};

const LOG_FETCH_LIMIT = 400;
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function isCpcAdminRole(role?: string | null): boolean {
  return String(role ?? '').toLowerCase() === 'admin';
}

function readString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '—';
}

function readOptionalString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function mapAuditDoc(doc: AuditLogRow): EventLogEntry {
  const createdAtIso = createdAtToIso(doc.createdAt) || '';
  const createdAtMs = createdAtIso ? new Date(createdAtIso).getTime() : 0;
  const action = readString(doc.action);
  const context = readString(doc.context);
  const entityType = readString(doc.entity_type);
  const entityId = readString(doc.entity_id);
  const targetId =
    readOptionalString(doc.target_id) || readOptionalString(doc.entity_id) || '—';
  const httpStatus = readNumber(doc.http_status);
  const criticality = inferAuditLogCriticality(action, doc.criticality);
  const result = inferAuditLogResult(action, httpStatus, doc.result);
  const origin = inferAuditLogOrigin(context, doc.origin);
  const companyId = readOptionalString(doc.company_id) || '—';

  return {
    id: doc.id,
    action,
    actorId: readString(doc.actor_id),
    context,
    targetId,
    entityType,
    entityId,
    createdAtIso,
    createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
    durationMs: readNumber(doc.duration_ms),
    ipAddress: readOptionalString(doc.ip_address) || '—',
    userAgent: readOptionalString(doc.user_agent) || '—',
    httpMethod: readOptionalString(doc.http_method),
    httpPath: readOptionalString(doc.http_path),
    httpStatus,
    requestId: readOptionalString(doc.request_id) || '—',
    companyId,
    metadata: buildAuditLogMetadata(doc),
    criticality,
    result,
    origin,
  };
}

function criticalityBadgeClass(criticality: AuditLogCriticality): string {
  if (criticality === 'high') return 'border-transparent bg-red-100 text-red-800';
  if (criticality === 'medium') return 'border-transparent bg-amber-100 text-amber-900';
  return 'border-transparent bg-slate-100 text-slate-700';
}

function resultBadgeClass(result: AuditLogResult): string {
  if (result === 'error') return 'border-transparent bg-red-100 text-red-800';
  if (result === 'warning') return 'border-transparent bg-amber-100 text-amber-900';
  return 'border-transparent bg-emerald-100 text-emerald-800';
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

export default function EventLogPage() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const isAdmin = isCpcAdminRole(profile?.role);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<EventLogEntry[]>([]);
  const [actorMeta, setActorMeta] = useState<Record<string, { displayName: string; email: string; role: string }>>({});
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<EventLogScope>('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [selectedRow, setSelectedRow] = useState<DisplayEventLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) {
      setRows([]);
      setActorMeta({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const docs = await queryDocuments<AuditLogRow>('audit_logs', [], undefined, LOG_FETCH_LIMIT);
      const mapped = docs.map(mapAuditDoc);
      mapped.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setRows(mapped);

      const actorIds = mapped.map((row) => row.actorId);
      const actorInfo = await loadActorMetaById(actorIds);
      setActorMeta(actorInfo);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setRows([]);
      setActorMeta({});
      setLoadError(t.get('cpc.pages.eventLog.loadError'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const displayRows = useMemo<DisplayEventLogEntry[]>(
    () =>
      rows.map((row) => {
        const result = row.result;
        const httpStatusDisplay = inferAuditLogHttpStatus(row.action, result, row.httpStatus);
        return {
          ...row,
          actionLabel: getEventLogActionDescription(row.action, t),
          actionKind: getAuditLogActionKind(row.action, t),
          actorLabel: resolveActorDisplayName(row.actorId, actorMeta, t),
          actorEmail: resolveActorEmail(row.actorId, actorMeta),
          actorRole: actorMeta[row.actorId]?.role ?? '—',
          scope: getEventLogScope(actorMeta[row.actorId]?.role ?? '', row.context),
          requestLabel: getAuditLogRequestLabel(row.context, row.action, row.httpMethod, row.httpPath),
          httpStatusDisplay,
          resource: getAuditLogResource(row.entityType, row.context),
        };
      }),
    [rows, actorMeta, t]
  );

  const listFilters = useMemo(
    () => ({
      search,
      actorId: 'all',
      dateFrom,
      dateTo,
      scope: scopeFilter,
      action: actionFilter,
      criticality: criticalityFilter,
      result: resultFilter,
      origin: originFilter,
    }),
    [search, dateFrom, dateTo, scopeFilter, actionFilter, criticalityFilter, resultFilter, originFilter]
  );

  const filteredRows = useMemo(() => filterEventLogRows(displayRows, listFilters), [displayRows, listFilters]);
  const actionOptions = useMemo(() => getUniqueActionCodes(displayRows), [displayRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedRows = useMemo(
    () => paginateRows(filteredRows, safePageIndex, pageSize),
    [filteredRows, safePageIndex, pageSize]
  );

  const showingFrom = filteredRows.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const showingTo = Math.min(filteredRows.length, (safePageIndex + 1) * pageSize);

  const scopeCounts = useMemo(() => {
    const base = filterEventLogRows(displayRows, { ...listFilters, scope: 'all' });
    return {
      all: base.length,
      migrant: base.filter((row) => row.scope === 'migrant').length,
      company: base.filter((row) => row.scope === 'company').length,
      cpc: base.filter((row) => row.scope === 'cpc').length,
    };
  }, [displayRows, listFilters]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, scopeFilter, actionFilter, criticalityFilter, resultFilter, originFilter, dateFrom, dateTo, pageSize]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [language]
  );

  const criticalityLabel = (value: AuditLogCriticality) => t.get(`cpc.pages.eventLog.criticality.${value}`);
  const resultLabel = (value: AuditLogResult) => t.get(`cpc.pages.eventLog.results.${value}`);
  const originLabel = (value: AuditLogOrigin) => t.get(`cpc.pages.eventLog.origins.${value}`);

  if (!user || !profile) {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.eventLog.loginRequired')}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-destructive mt-1">{t.get('cpc.pages.eventLog.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.eventLog.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={() => void fetchLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t.get('cpc.pages.eventLog.refresh')}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>
      ) : null}

      <div className="cpc-card p-4 space-y-4">
        <Tabs value={scopeFilter} onValueChange={(value) => setScopeFilter(value as EventLogScope)}>
          <TabsList className="grid h-auto grid-cols-2 gap-1 md:grid-cols-4">
            <TabsTrigger value="all">{`${t.get('cpc.pages.eventLog.scopeFilter.options.all')} (${scopeCounts.all})`}</TabsTrigger>
            <TabsTrigger value="migrant">{`${t.get('cpc.pages.eventLog.scopeFilter.options.migrant')} (${scopeCounts.migrant})`}</TabsTrigger>
            <TabsTrigger value="company">{`${t.get('cpc.pages.eventLog.scopeFilter.options.company')} (${scopeCounts.company})`}</TabsTrigger>
            <TabsTrigger value="cpc">{`${t.get('cpc.pages.eventLog.scopeFilter.options.cpc')} (${scopeCounts.cpc})`}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.get('cpc.pages.eventLog.searchPlaceholder')}
              className="h-10 pl-10"
              aria-label={t.get('cpc.pages.eventLog.searchPlaceholder')}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-10" aria-label={t.get('cpc.pages.eventLog.filters.action')}>
              <SelectValue placeholder={t.get('cpc.pages.eventLog.filters.allActions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.get('cpc.pages.eventLog.filters.allActions')}</SelectItem>
              {actionOptions.map((action) => (
                <SelectItem key={action} value={action}>
                  {getEventLogActionDescription(action, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
            <SelectTrigger className="h-10" aria-label={t.get('cpc.pages.eventLog.filters.criticality')}>
              <SelectValue placeholder={t.get('cpc.pages.eventLog.filters.allCriticality')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.get('cpc.pages.eventLog.filters.allCriticality')}</SelectItem>
              <SelectItem value="low">{criticalityLabel('low')}</SelectItem>
              <SelectItem value="medium">{criticalityLabel('medium')}</SelectItem>
              <SelectItem value="high">{criticalityLabel('high')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger className="h-10" aria-label={t.get('cpc.pages.eventLog.filters.result')}>
              <SelectValue placeholder={t.get('cpc.pages.eventLog.filters.allResults')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.get('cpc.pages.eventLog.filters.allResults')}</SelectItem>
              <SelectItem value="success">{resultLabel('success')}</SelectItem>
              <SelectItem value="warning">{resultLabel('warning')}</SelectItem>
              <SelectItem value="error">{resultLabel('error')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="h-10" aria-label={t.get('cpc.pages.eventLog.filters.origin')}>
              <SelectValue placeholder={t.get('cpc.pages.eventLog.filters.allOrigins')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.get('cpc.pages.eventLog.filters.allOrigins')}</SelectItem>
              <SelectItem value="app">{originLabel('app')}</SelectItem>
              <SelectItem value="http">{originLabel('http')}</SelectItem>
              <SelectItem value="function">{originLabel('function')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="audit-log-date-from" className="text-xs text-muted-foreground">
              {t.get('cpc.pages.eventLog.dateFilter.from')}
            </Label>
            <Input
              id="audit-log-date-from"
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-log-date-to" className="text-xs text-muted-foreground">
              {t.get('cpc.pages.eventLog.dateFilter.to')}
            </Label>
            <Input
              id="audit-log-date-to"
              type="datetime-local"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </div>

      <div className="cpc-card p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.get('cpc.pages.eventLog.total')}</p>
            <p className="text-2xl font-bold tabular-nums">{filteredRows.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])}>
              <SelectTrigger className="h-9 w-[7.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {t.get('cpc.pages.eventLog.pageSize', { count: size })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t.get('cpc.pages.eventLog.showing', { from: showingFrom, to: showingTo, total: filteredRows.length })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePageIndex <= 0}
                onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
                aria-label={t.get('cpc.pages.eventLog.prevPage')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePageIndex >= totalPages - 1}
                onClick={() => setPageIndex((page) => Math.min(totalPages - 1, page + 1))}
                aria-label={t.get('cpc.pages.eventLog.nextPage')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{t.get('cpc.pages.eventLog.empty')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.get('cpc.pages.eventLog.columns.when')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.author')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.action')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.criticality')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.result')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.request')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedRow(row)}
                >
                  <TableCell className="align-top">
                    <div className="text-sm whitespace-nowrap">
                      {row.createdAtIso ? dateFormatter.format(new Date(row.createdAtIso)) : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.durationMs !== null ? `${row.durationMs} ms` : '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top max-w-[220px]">
                    <div className="text-sm truncate" title={row.actorLabel}>
                      {row.actorLabel}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={row.actorRole}>
                      {row.actorRole || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top max-w-[220px]">
                    <div className="text-sm font-medium">{row.actionKind}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate" title={row.action}>
                      {row.action}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge className={criticalityBadgeClass(row.criticality)}>{criticalityLabel(row.criticality)}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2">
                      <Badge className={resultBadgeClass(row.result)}>{resultLabel(row.result)}</Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">{row.httpStatusDisplay}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top max-w-[280px]">
                    <div className="text-sm font-mono truncate" title={row.requestLabel}>
                      {row.requestLabel}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={row.ipAddress}>
                      {row.ipAddress}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedRow ? (
            <>
              <DialogHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <DialogTitle>
                    {t.get('cpc.pages.eventLog.detail.title', { id: selectedRow.id.slice(-6).toUpperCase() })}
                  </DialogTitle>
                  <Badge className={criticalityBadgeClass(selectedRow.criticality)}>
                    {criticalityLabel(selectedRow.criticality)}
                  </Badge>
                  <Badge className={resultBadgeClass(selectedRow.result)}>{resultLabel(selectedRow.result)}</Badge>
                </div>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label={t.get('cpc.pages.eventLog.detail.action')} value={`${selectedRow.actionKind} / ${selectedRow.action}`} />
                <DetailField label={t.get('cpc.pages.eventLog.detail.resource')} value={selectedRow.resource} />
                <DetailField label={t.get('cpc.pages.eventLog.detail.origin')} value={originLabel(selectedRow.origin)} />
                <DetailField
                  label={t.get('cpc.pages.eventLog.detail.createdAt')}
                  value={selectedRow.createdAtIso ? dateFormatter.format(new Date(selectedRow.createdAtIso)) : '—'}
                />
                <DetailField label={t.get('cpc.pages.eventLog.detail.authorEmail')} value={selectedRow.actorEmail} />
                <DetailField label={t.get('cpc.pages.eventLog.detail.authorRole')} value={selectedRow.actorRole || '—'} />
                <DetailField label={t.get('cpc.pages.eventLog.detail.userId')} value={selectedRow.actorId} mono />
                <DetailField label={t.get('cpc.pages.eventLog.detail.companyId')} value={selectedRow.companyId} mono />
                <DetailField label={t.get('cpc.pages.eventLog.detail.http')} value={selectedRow.requestLabel} mono />
                <DetailField label={t.get('cpc.pages.eventLog.detail.httpStatus')} value={String(selectedRow.httpStatusDisplay)} />
                <DetailField label={t.get('cpc.pages.eventLog.detail.ipAddress')} value={selectedRow.ipAddress} mono />
                <DetailField label={t.get('cpc.pages.eventLog.detail.requestId')} value={selectedRow.requestId} mono />
                <DetailField
                  label={t.get('cpc.pages.eventLog.detail.durationMs')}
                  value={selectedRow.durationMs !== null ? String(selectedRow.durationMs) : '—'}
                />
              </div>

              <DetailField label={t.get('cpc.pages.eventLog.detail.userAgent')} value={selectedRow.userAgent} mono />

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.get('cpc.pages.eventLog.detail.metadata')}
                </p>
                <pre className="rounded-lg border bg-muted/40 p-3 text-xs overflow-x-auto font-mono">
                  {selectedRow.metadata ? JSON.stringify(selectedRow.metadata, null, 2) : '—'}
                </pre>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
