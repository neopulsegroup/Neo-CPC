import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDocument, queryDocuments, updateDocument, deleteDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { formatAppDate } from '@/lib/appDateTime';
import type { AgendaCategory } from '@/lib/cpcSpecialists';
import { CPC_TEAM_ROLES, canDeleteCpcSessions, normalizeCpcTeamRole } from '@/lib/cpcRoles';
import {
  CPC_SESSION_TABLE_STATUSES,
  dedupeSessionsByAppointment,
  filterCpcSessions,
  isSupportRequestOnlySessionRow,
  isSupportUrgentSession,
  mergeApprovedSupportRequestsIntoSessions,
  mergeCancelledSupportRequestsIntoSessions,
  resolveCpcSessionTableStatus,
  resolveSessionCategory,
  sortCpcSessionsNewestFirst,
  type CpcSessionDoc,
  type CpcSessionTableStatus,
  type CpcSessionsFilters,
} from '@/lib/cpcSessions';
import {
  ensureSessionForApprovedSupportRequest,
  queryApprovedSupportRequests,
  queryCancelledSupportRequests,
} from '@/lib/supportRequests';
import {
  isSessionPendingApproval,
} from '@/lib/sessionApproval';
import { Calendar, Clock, Loader2, Pencil, Search, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type CpcUserOption = { id: string; name: string; role: string };

const SESSION_CATEGORIES: AgendaCategory[] = ['legal', 'psychology', 'mediation', 'collective'];

const DEFAULT_FILTERS: CpcSessionsFilters = {
  migrantName: '',
  sessionType: 'all',
  date: '',
  period: 'all',
  cpcUserId: 'all',
  urgency: 'all',
  status: 'all',
};

function sessionStatusBadgeClass(status: CpcSessionTableStatus): string {
  if (status === 'Concluída') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'Não compareceu') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (status === 'Cancelada') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function CpcSessionsPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CpcSessionDoc[]>([]);
  const [migrantNames, setMigrantNames] = useState<Map<string, string>>(new Map());
  const [cpcUsers, setCpcUsers] = useState<CpcUserOption[]>([]);
  const [filters, setFilters] = useState<CpcSessionsFilters>(DEFAULT_FILTERS);
  const [draftMigrantName, setDraftMigrantName] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CpcSessionDoc | null>(null);
  const [editTarget, setEditTarget] = useState<CpcSessionDoc | null>(null);
  const [editStatus, setEditStatus] = useState<CpcSessionTableStatus>('Agendada');
  const [now, setNow] = useState(() => new Date());

  const canDeleteSessions = canDeleteCpcSessions(profile?.role);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sessionRows, userRows, approvedSupportRequests, cancelledSupportRequests] = await Promise.all([
          queryDocuments<CpcSessionDoc>('sessions', [], { field: 'scheduled_date', direction: 'desc' }),
          queryDocuments<{ id: string; name?: string | null; email?: string | null; role?: string | null; active?: boolean | null }>('users', []),
          queryApprovedSupportRequests(),
          queryCancelledSupportRequests(),
        ]);

        const backfilledSessionIds: string[] = [];
        for (const request of approvedSupportRequests) {
          if (request.session_id?.trim()) continue;
          try {
            const sessionId = await ensureSessionForApprovedSupportRequest(request);
            if (sessionId) backfilledSessionIds.push(sessionId);
          } catch (backfillError) {
            console.error('Erro ao criar sessão em falta para pedido urgente', request.id, backfillError);
          }
        }

        let rows = sessionRows ?? [];
        if (backfilledSessionIds.length > 0) {
          const reloaded = await queryDocuments<CpcSessionDoc>('sessions', [], { field: 'scheduled_date', direction: 'desc' });
          rows = reloaded ?? rows;
        }

        rows = dedupeSessionsByAppointment(
          mergeCancelledSupportRequestsIntoSessions(
            mergeApprovedSupportRequestsIntoSessions(rows, approvedSupportRequests),
            cancelledSupportRequests
          )
        );

        const migrantIds = Array.from(
          new Set([
            ...rows.map((row) => row.migrant_id).filter((id): id is string => Boolean(id)),
            ...approvedSupportRequests.map((request) => request.migrant_id).filter(Boolean),
            ...cancelledSupportRequests.map((request) => request.migrant_id).filter(Boolean),
          ])
        );
        const [profiles, users] = await Promise.all([
          Promise.all(migrantIds.map((id) => getDocument<{ name?: string | null }>('profiles', id).catch(() => null))),
          Promise.all(migrantIds.map((id) => getDocument<{ name?: string | null }>('users', id).catch(() => null))),
        ]);

        const nameMap = new Map<string, string>();
        migrantIds.forEach((id, index) => {
          const name = (profiles[index]?.name?.trim() || users[index]?.name?.trim() || '').toString();
          if (name) nameMap.set(id, name);
        });
        for (const request of [...approvedSupportRequests, ...cancelledSupportRequests]) {
          const migrantId = request.migrant_id;
          const migrantName = request.migrant_name?.trim();
          if (migrantId && migrantName && !nameMap.has(migrantId)) {
            nameMap.set(migrantId, migrantName);
          }
        }

        const teamUsers = (userRows ?? [])
          .filter((user) => user.active !== false)
          .map((user) => {
            const role = normalizeCpcTeamRole(user.role);
            if (!role || !(CPC_TEAM_ROLES as readonly string[]).includes(role)) return null;
            const name = (user.name?.trim() || user.email?.trim() || '').toString();
            if (!name) return null;
            return { id: user.id, name, role };
          })
          .filter((row): row is CpcUserOption => row !== null)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

        if (!cancelled) {
          setSessions(rows);
          setMigrantNames(nameMap);
          setCpcUsers(teamUsers);
        }
      } catch (error) {
        console.error('Erro ao carregar sessões CPC', error);
        if (!cancelled) {
          setSessions([]);
          setMigrantNames(new Map());
          setCpcUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSessions = useMemo(
    () =>
      sortCpcSessionsNewestFirst(
        filterCpcSessions({
          sessions,
          migrantNames,
          filters,
          now,
        })
      ),
    [sessions, migrantNames, filters, now]
  );

  async function handleStatusChange(session: CpcSessionDoc, nextStatus: CpcSessionTableStatus) {
    if (isSupportRequestOnlySessionRow(session)) return;
    setUpdatingId(session.id);
    try {
      await updateDocument('sessions', session.id, { status: nextStatus });
      setSessions((prev) => prev.map((row) => (row.id === session.id ? { ...row, status: nextStatus } : row)));
      toast({
        title: t.get('cpc.sessionsPage.closure.updated'),
        description: t.get('cpc.sessionsPage.closure.updatedDescription'),
      });
      setEditTarget(null);
    } catch (error) {
      console.error('Erro ao atualizar estado da sessão', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.sessionsPage.closure.updateError'),
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  function openEditSession(session: CpcSessionDoc) {
    setEditTarget(session);
    setEditStatus(resolveCpcSessionTableStatus(session.status));
  }

  async function confirmDeleteSession() {
    if (!deleteTarget) return;
    await handleDeleteSession(deleteTarget);
    setDeleteTarget(null);
  }

  async function handleDeleteSession(session: CpcSessionDoc) {
    if (!canDeleteSessions || deletingId) return;

    setDeletingId(session.id);
    try {
      const supportRequestId = session.support_request_id?.trim() || '';
      const isRequestOnlyRow = isSupportRequestOnlySessionRow(session);

      if (isRequestOnlyRow && supportRequestId) {
        await deleteDocument('support_requests', supportRequestId);
      } else {
        await deleteDocument('sessions', session.id);
        if (supportRequestId) {
          try {
            await deleteDocument('support_requests', supportRequestId);
          } catch (supportError) {
            console.error('Erro ao eliminar pedido de apoio associado', supportError);
          }
        }
      }
      setSessions((prev) => prev.filter((row) => row.id !== session.id));
      toast({ title: t.get('cpc.sessionsPage.delete.success') });
    } catch (error) {
      console.error('Erro ao eliminar sessão', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.sessionsPage.delete.error'),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  }

  function sessionStatusLabel(status: CpcSessionTableStatus): string {
    if (status === 'Concluída') return t.get('cpc.sessionsPage.closure.completed');
    if (status === 'Não compareceu') return t.get('cpc.sessionsPage.closure.no_show');
    if (status === 'Cancelada') return t.get('cpc.sessions.status.cancelled');
    return t.get('cpc.sessions.status.scheduled');
  }

  function sessionTypeLabel(session: CpcSessionDoc): string {
    const category = resolveSessionCategory(session.session_type, session.service_id);
    if (session.service_label?.trim()) return session.service_label.trim();
    return t.get(`cpc.agenda.sessionTypes.${category}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t.get('cpc.sessionsPage.title')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t.get('cpc.sessionsPage.subtitle')}</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/dashboard/cpc/agenda">{t.get('cpc.sessions.view_agenda')}</Link>
        </Button>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="cpc-sessions-migrant">{t.get('cpc.sessionsPage.filters.migrant')}</Label>
            <div className="flex gap-2">
              <Input
                id="cpc-sessions-migrant"
                value={draftMigrantName}
                onChange={(event) => setDraftMigrantName(event.target.value)}
                placeholder={t.get('cpc.sessionsPage.filters.migrantPlaceholder')}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFilters((prev) => ({ ...prev, migrantName: draftMigrantName.trim() }))}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.get('cpc.sessionsPage.filters.sessionType')}</Label>
            <Select
              value={filters.sessionType}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, sessionType: value as CpcSessionsFilters['sessionType'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.sessionsPage.filters.allTypes')}</SelectItem>
                {SESSION_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {t.get(`cpc.agenda.sessionTypes.${category}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpc-sessions-date">{t.get('cpc.sessionsPage.filters.date')}</Label>
            <Input
              id="cpc-sessions-date"
              type="date"
              value={filters.date}
              onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>{t.get('cpc.sessionsPage.filters.period')}</Label>
            <Select
              value={filters.period}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, period: value as CpcSessionsFilters['period'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.sessionsPage.filters.periodAll')}</SelectItem>
                <SelectItem value="upcoming">{t.get('cpc.sessionsPage.filters.periodUpcoming')}</SelectItem>
                <SelectItem value="past">{t.get('cpc.sessionsPage.filters.periodPast')}</SelectItem>
                <SelectItem value="today">{t.get('cpc.sessionsPage.filters.periodToday')}</SelectItem>
                <SelectItem value="week">{t.get('cpc.sessionsPage.filters.periodWeek')}</SelectItem>
                <SelectItem value="month">{t.get('cpc.sessionsPage.filters.periodMonth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.get('cpc.sessionsPage.filters.cpcUser')}</Label>
            <Select
              value={filters.cpcUserId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, cpcUserId: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.sessionsPage.filters.allCpcUsers')}</SelectItem>
                {cpcUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.get('cpc.sessionsPage.filters.urgency')}</Label>
            <Select
              value={filters.urgency}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, urgency: value as CpcSessionsFilters['urgency'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.sessionsPage.filters.urgencyAll')}</SelectItem>
                <SelectItem value="pending">{t.get('cpc.sessionsPage.filters.urgencyPending')}</SelectItem>
                <SelectItem value="support_urgent">{t.get('cpc.sessionsPage.filters.urgencySupportUrgent')}</SelectItem>
                <SelectItem value="normal">{t.get('cpc.sessionsPage.filters.urgencyNormal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.get('cpc.sessionsPage.filters.status')}</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value as CpcSessionsFilters['status'] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.sessionsPage.filters.statusAll')}</SelectItem>
                {CPC_SESSION_TABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {sessionStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraftMigrantName('');
              setFilters(DEFAULT_FILTERS);
            }}
          >
            {t.get('cpc.sessionsPage.filters.clear')}
          </Button>
          <span className="self-center text-sm text-muted-foreground">
            {t.get('cpc.sessionsPage.results', { count: String(filteredSessions.length) })}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t.get('cpc.agenda.calendar.loading')}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{t.get('cpc.sessionsPage.empty')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.get('cpc.sessionsPage.table.migrant')}</TableHead>
                <TableHead>{t.get('cpc.sessionsPage.table.type')}</TableHead>
                <TableHead>{t.get('cpc.sessionsPage.table.datetime')}</TableHead>
                <TableHead>{t.get('cpc.sessionsPage.table.cpcUser')}</TableHead>
                <TableHead>{t.get('cpc.sessionsPage.table.urgency')}</TableHead>
                <TableHead>{t.get('cpc.sessionsPage.table.status')}</TableHead>
                {canDeleteSessions ? <TableHead className="w-[108px]">{t.get('cpc.sessionsPage.table.actions')}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session) => {
                const migrantId = session.migrant_id ?? '';
                const migrantName = migrantNames.get(migrantId) || t.get('cpc.agenda.event.unknownPerson');
                const scheduledDate = session.scheduled_date ?? '';
                const scheduledTime = session.scheduled_time ?? '';
                const tableStatus = resolveCpcSessionTableStatus(session.status);
                const canEditStatus = canDeleteSessions && !isSupportRequestOnlySessionRow(session);

                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{migrantName}</p>
                          {migrantId ? (
                            <Link
                              to={`/dashboard/cpc/migrantes/${migrantId}/perfil`}
                              className="text-xs text-primary hover:underline"
                            >
                              {t.get('cpc.sessionsPage.viewProfile')}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{sessionTypeLabel(session)}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="inline-flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {scheduledDate ? formatAppDate(scheduledDate) : '—'}
                        </p>
                        <p className="inline-flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {scheduledTime || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{session.specialist_name?.trim() || '—'}</TableCell>
                    <TableCell>
                      {isSupportUrgentSession(session) ? (
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                          {t.get('cpc.agenda.pending.supportUrgentBadge')}
                        </Badge>
                      ) : isSessionPendingApproval(session.status) ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          {t.get('cpc.sessionsPage.filters.urgencyPending')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                          {t.get('cpc.sessionsPage.filters.urgencyNormal')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                          sessionStatusBadgeClass(tableStatus)
                        )}
                      >
                        {sessionStatusLabel(tableStatus)}
                      </span>
                    </TableCell>
                    {canDeleteSessions ? (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canEditStatus ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              aria-label={t.get('cpc.sessionsPage.edit.action')}
                              disabled={updatingId === session.id}
                              onClick={() => openEditSession(session)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            aria-label={t.get('cpc.sessionsPage.delete.action')}
                            disabled={deletingId === session.id}
                            onClick={() => setDeleteTarget(session)}
                          >
                            {deletingId === session.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.get('cpc.sessionsPage.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t.get('cpc.sessionsPage.delete.confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.get('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => void confirmDeleteSession()}
            >
              {t.get('cpc.sessionsPage.delete.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.get('cpc.sessionsPage.edit.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cpc-session-status">{t.get('cpc.sessionsPage.table.status')}</Label>
            <Select value={editStatus} onValueChange={(value) => setEditStatus(value as CpcSessionTableStatus)}>
              <SelectTrigger id="cpc-session-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10050]" position="popper">
                {CPC_SESSION_TABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {sessionStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              {t.get('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!editTarget || updatingId === editTarget.id}
              onClick={() => editTarget && void handleStatusChange(editTarget, editStatus)}
            >
              {updatingId === editTarget?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.get('cpc.sessionsPage.edit.saving')}
                </>
              ) : (
                t.get('common.save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
