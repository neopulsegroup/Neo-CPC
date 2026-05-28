import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { queryDocuments } from '@/integrations/firebase/firestore';
import { createdAtToIso } from '@/lib/firestoreTimestamps';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollText, Search } from 'lucide-react';
import {
  filterEventLogRows,
  getEventLogScope,
  getEventLogActionDescription,
  loadActorMetaById,
  resolveActorDisplayName,
  type EventLogScope,
} from '@/pages/dashboard/cpc/eventLogDisplay';

type AuditLogRow = {
  id: string;
  action?: string | null;
  actor_id?: string | null;
  context?: string | null;
  target_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  createdAt?: unknown;
};

type EventLogEntry = {
  id: string;
  action: string;
  actorId: string;
  context: string;
  targetId: string;
  createdAtIso: string;
  createdAtMs: number;
};

type DisplayEventLogEntry = EventLogEntry & {
  actionLabel: string;
  actorLabel: string;
  actorRole: string;
  scope: EventLogScope;
};

const LOG_FETCH_LIMIT = 400;

function isCpcAdminRole(role?: string | null): boolean {
  return String(role ?? '').toLowerCase() === 'admin';
}

export default function EventLogPage() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const isAdmin = isCpcAdminRole(profile?.role);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<EventLogEntry[]>([]);
  const [actorMeta, setActorMeta] = useState<Record<string, { displayName: string; role: string }>>({});
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<EventLogScope>('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      const mapped: EventLogEntry[] = docs.map((doc) => {
        const createdAtIso = createdAtToIso(doc.createdAt) || '';
        const createdAtMs = createdAtIso ? new Date(createdAtIso).getTime() : 0;
        return {
          id: doc.id,
          action: typeof doc.action === 'string' ? doc.action : '—',
          actorId: typeof doc.actor_id === 'string' ? doc.actor_id : '—',
          context: typeof doc.context === 'string' ? doc.context : '—',
          targetId:
            (typeof doc.target_id === 'string' && doc.target_id) ||
            (typeof doc.entity_id === 'string' && doc.entity_id) ||
            '—',
          createdAtIso,
          createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
        };
      });
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
      rows.map((row) => ({
        ...row,
        actionLabel: getEventLogActionDescription(row.action, t),
        actorLabel: resolveActorDisplayName(row.actorId, actorMeta, t),
        actorRole: actorMeta[row.actorId]?.role ?? '',
        scope: getEventLogScope(actorMeta[row.actorId]?.role ?? '', row.context),
      })),
    [rows, actorMeta, t]
  );

  const listFilters = useMemo(
    () => ({ search, actorId: actorFilter, dateFrom, dateTo, scope: scopeFilter }),
    [search, actorFilter, dateFrom, dateTo, scopeFilter]
  );

  const filteredRows = useMemo(() => filterEventLogRows(displayRows, listFilters), [displayRows, listFilters]);

  const actorOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of displayRows) {
      if (row.actorId && row.actorId !== '—' && !byId.has(row.actorId)) {
        byId.set(row.actorId, row.actorLabel);
      }
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
  }, [displayRows]);

  const scopeCounts = useMemo(() => {
    const base = filterEventLogRows(displayRows, { ...listFilters, scope: 'all' });
    return {
      all: base.length,
      migrant: base.filter((row) => row.scope === 'migrant').length,
      company: base.filter((row) => row.scope === 'company').length,
      cpc: base.filter((row) => row.scope === 'cpc').length,
    };
  }, [displayRows, listFilters]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [language]
  );

  if (!user || !profile) {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary shrink-0" aria-hidden />
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
            <ScrollText className="h-7 w-7 text-primary shrink-0" aria-hidden />
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
            <ScrollText className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.eventLog.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.eventLog.subtitle')}</p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>
      ) : null}

      <div className="cpc-card p-4">
        <Tabs value={scopeFilter} onValueChange={(value) => setScopeFilter(value as EventLogScope)}>
          <TabsList className="mb-3 grid h-auto grid-cols-2 gap-1 md:grid-cols-4">
            <TabsTrigger value="all">{`${t.get('cpc.pages.eventLog.scopeFilter.options.all')} (${scopeCounts.all})`}</TabsTrigger>
            <TabsTrigger value="migrant">{`${t.get('cpc.pages.eventLog.scopeFilter.options.migrant')} (${scopeCounts.migrant})`}</TabsTrigger>
            <TabsTrigger value="company">{`${t.get('cpc.pages.eventLog.scopeFilter.options.company')} (${scopeCounts.company})`}</TabsTrigger>
            <TabsTrigger value="cpc">{`${t.get('cpc.pages.eventLog.scopeFilter.options.cpc')} (${scopeCounts.cpc})`}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="event-log-search" className="text-xs text-muted-foreground">
              {t.get('cpc.pages.eventLog.searchFilter.label')}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="event-log-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.get('cpc.pages.eventLog.searchPlaceholder')}
                className="h-10 pl-10"
                aria-label={t.get('cpc.pages.eventLog.searchPlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-log-actor-filter" className="text-xs text-muted-foreground">
              {t.get('cpc.pages.eventLog.userFilter.label')}
            </Label>
            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger id="event-log-actor-filter" className="h-10" aria-label={t.get('cpc.pages.eventLog.userFilter.label')}>
                <SelectValue placeholder={t.get('cpc.pages.eventLog.userFilter.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.pages.eventLog.userFilter.all')}</SelectItem>
                {actorOptions.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-log-date-from" className="text-xs text-muted-foreground">
              {t.get('cpc.pages.eventLog.dateFilter.from')}
            </Label>
            <Input
              id="event-log-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10"
              aria-label={t.get('cpc.pages.eventLog.dateFilter.from')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-log-date-to" className="text-xs text-muted-foreground">
              {t.get('cpc.pages.eventLog.dateFilter.to')}
            </Label>
            <Input
              id="event-log-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10"
              aria-label={t.get('cpc.pages.eventLog.dateFilter.to')}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {t.get('cpc.pages.eventLog.count', { count: filteredRows.length })}
        </p>
      </div>

      <div className="cpc-card p-0 overflow-hidden">
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
                <TableHead>{t.get('cpc.pages.eventLog.columns.date')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.action')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.actor')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.context')}</TableHead>
                <TableHead>{t.get('cpc.pages.eventLog.columns.target')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.createdAtIso ? dateFormatter.format(new Date(row.createdAtIso)) : '—'}
                  </TableCell>
                  <TableCell className="text-sm" title={row.action}>
                    {row.actionLabel}
                  </TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate" title={row.actorId !== '—' ? row.actorId : undefined}>
                    {row.actorLabel}
                  </TableCell>
                  <TableCell className="text-sm">{row.context}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[180px] truncate" title={row.targetId}>
                    {row.targetId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
