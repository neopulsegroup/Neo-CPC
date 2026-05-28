import { Link, NavLink, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import ContentEditorPage from '@/pages/dashboard/cpc/ContentEditorPage';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDocument, countDocuments, deleteDocument, getDocument, queryDocuments, serverTimestamp, updateDocument } from '@/integrations/firebase/firestore';
import { registerUser } from '@/integrations/firebase/auth';
import {
  Building2,
  Users,
  Calendar,
  BookOpen,
  Briefcase,
  TrendingUp,
  Clock,
  CalendarX,
  FileText,
  Filter,
  CheckCircle,
  Ban,
  Mail,
  MoreVertical,
  UserCog,
  Plus,
  Pencil,
  UserPlus,
  CalendarPlus,
  UserX,
  RotateCcw,
  Wrench,
  Settings,
  Languages,
  ClipboardList,
  Trash2,
  Search,
} from 'lucide-react';
import {
  APP_TIME_ZONE,
  addCalendarDaysIso,
  getCalendarDateIsoInAppTimeZone,
  monthStartEndIsoInAppTimeZone,
  previousMonthStartEndFromTodayIso,
  weekStartEndIsoMondayInAppCalendar,
} from '@/lib/appCalendar';
import {
  computeMigrantProfileCompletenessPercent,
  type MigrantProfileFieldsForCompleteness,
} from '@/lib/migrantProfileCompleteness';

type RecentMigrantProfileDoc = MigrantProfileFieldsForCompleteness & {
  email?: string | null;
  professionalTitle?: string | null;
};

type FirebaseUserDoc = {
  id: string;
  role?: string | null;
  createdAt?: unknown;
};

type CpcTeamRole = 'admin' | 'manager' | 'coordinator' | 'mediator' | 'lawyer' | 'psychologist' | 'trainer';
type CpcTeamUserDoc = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
};

const CPC_TEAM_ROLES: CpcTeamRole[] = ['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer'];

function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function deriveNameFromEmail(email?: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/g).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ');
}

function resolveRecentMigrantDisplayName(args: {
  profile: { name?: string | null; email?: string | null } | null | undefined;
  userDoc: { name?: string | null; email?: string | null } | null | undefined;
  t: { get: (path: string) => string };
}): string {
  const fromProfile = typeof args.profile?.name === 'string' ? args.profile.name.trim() : '';
  if (fromProfile) return fromProfile;
  const fromUser = typeof args.userDoc?.name === 'string' ? args.userDoc.name.trim() : '';
  if (fromUser) return fromUser;
  const email =
    (typeof args.profile?.email === 'string' ? args.profile.email.trim() : '') ||
    (typeof args.userDoc?.email === 'string' ? args.userDoc.email.trim() : '');
  const derived = deriveNameFromEmail(email);
  if (derived) return derived;
  return args.t.get('cpc.migrantsAdmin.fallback_migrant');
}

function parseUnknownDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object') {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
      const parsed = new Date(((value as { seconds: number }).seconds) * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

function countDatesBetween(dates: Date[], startISO: string, endISO: string): number {
  return dates.filter((d) => {
    const iso = getCalendarDateIsoInAppTimeZone(d);
    return iso >= startISO && iso <= endISO;
  }).length;
}

function isCancelledSessionStatus(status?: string | null): boolean {
  return ['cancelled', 'cancelada'].includes(normalizeText(status));
}

function isCompletedSessionStatus(status?: string | null): boolean {
  return ['completed', 'concluida'].includes(normalizeText(status));
}

function isInProgressSessionStatus(status?: string | null): boolean {
  return ['in_progress', 'em curso'].includes(normalizeText(status));
}

export default function CPCDashboard() {
  const { profile, profileData, user } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();

  const cpcDisplayName = useMemo(() => {
    const profileDocName = typeof profileData?.name === 'string' ? profileData.name.trim() : '';
    const userDocName = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const authName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
    const rawName = profileDocName || userDocName || authName;
    const rawEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
    const authEmail = typeof user?.email === 'string' ? user.email.trim() : '';
    const email = rawEmail || authEmail;
    const derivedFromEmail = deriveNameFromEmail(email);
    const normalizedName = normalizeText(rawName);
    const normalizedRole = normalizeText(profile?.role ?? null);
    const isGeneric =
      normalizedName.length === 0 ||
      normalizedName === 'cpc' ||
      normalizedName === normalizedRole ||
      ['admin', 'administrador', 'equipa', 'staff', 'team'].includes(normalizedName);
    return isGeneric ? (derivedFromEmail || t.get('cpc.menu.user_fallback')) : rawName;
  }, [profile?.email, profile?.name, profile?.role, profileData?.name, t, user?.displayName, user?.email]);

  const [loading, setLoading] = useState(true);
  const [period] = useState<'today' | 'week' | 'month'>('week');
  const [migrantsTotal, setMigrantsTotal] = useState(0);
  const [migrantsNew7, setMigrantsNew7] = useState(0);
  const [migrantsNew30, setMigrantsNew30] = useState(0);
  const [migrantsPeriodNew, setMigrantsPeriodNew] = useState(0);
  const [migrantsPrevNew, setMigrantsPrevNew] = useState(0);
  const [sessionsTodayCount, setSessionsTodayCount] = useState(0);
  const [sessionsWeekCount, setSessionsWeekCount] = useState(0);
  const [sessionsCompletedCount, setSessionsCompletedCount] = useState(0);
  const [sessionsPeriodCount, setSessionsPeriodCount] = useState(0);
  const [sessionsPrevCount, setSessionsPrevCount] = useState(0);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [jobOffersActive, setJobOffersActive] = useState(0);
  const [jobOffersPendingApproval, setJobOffersPendingApproval] = useState(0);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [applicationsPeriodCount, setApplicationsPeriodCount] = useState(0);
  const [applicationsPrevCount, setApplicationsPrevCount] = useState(0);
  const [avgProgress, setAvgProgress] = useState(0);
  const [urgencies, setUrgencies] = useState<{ juridico: number; psicologico: number; habitacional: number }>(() => ({ juridico: 0, psicologico: 0, habitacional: 0 }));
  const [recentMigrants, setRecentMigrants] = useState<
    Array<{ id: string; name: string; subtitle: string; statusLabel: string; statusClassName: string; dateLabel: string }>
  >([]);
  const [todaySessions, setTodaySessions] = useState<
    Array<{ id: string; migrant: string; type: string; time: string; status: string; statusRaw?: string | null }>
  >([]);
  const [messagesPending, setMessagesPending] = useState(0);

  const locale = useMemo(() => {
    if (language === 'en') return 'en-GB';
    if (language === 'es') return 'es-ES';
    if (language === 'fr') return 'fr-FR';
    return 'pt-PT';
  }, [language]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: APP_TIME_ZONE }),
    [locale]
  );
  const longDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE }),
    [locale]
  );

  function formatSessionStatusLabel(status?: string | null): string {
    if (isCompletedSessionStatus(status)) return t.get('cpc.sessions.status.completed');
    if (isCancelledSessionStatus(status)) return t.get('cpc.sessions.status.cancelled');
    if (isInProgressSessionStatus(status)) return t.get('cpc.sessions.status.in_progress');
    return t.get('cpc.sessions.status.scheduled');
  }

  function formatKpiChange(current: number, prev: number): { label: string; className: string } {
    if (!Number.isFinite(current) || !Number.isFinite(prev)) return { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' };
    if (prev <= 0) return current > 0 ? { label: t.get('cpc.kpi.change.new'), className: 'text-emerald-700' } : { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' };
    const delta = current - prev;
    if (delta === 0) return { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' };
    const percent = Math.round((Math.abs(delta) / prev) * 100);
    return delta > 0 ? { label: `+${percent}%`, className: 'text-emerald-700' } : { label: `-${percent}%`, className: 'text-rose-700' };
  }

  function formatRelativeTime(from: Date, to: Date): string {
    const diffMs = Math.max(0, to.getTime() - from.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return t.get('cpc.relative.minutes', { count: Math.max(1, mins) });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t.get('cpc.relative.hours', { count: hours });
    const days = Math.floor(hours / 24);
    return t.get('cpc.relative.days', { count: days });
  }

  function EquipaPage() {
    const [loadingList, setLoadingList] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<Array<{ id: string; name: string; email: string; role: CpcTeamRole; active: boolean }>>([]);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | CpcTeamRole>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'role' | 'status'>('name');
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<CpcTeamRole>('mediator');
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<{ id: string; name: string; role: CpcTeamRole } | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<CpcTeamRole>('mediator');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [formError, setFormError] = useState('');
    const isAdmin = profile?.role === 'admin';
    const hasLoggedUnauthorizedAccess = useRef(false);

    async function logUnauthorizedAttempt(context: string, targetId?: string) {
      const actorId = user?.uid;
      if (!actorId) return;
      try {
        await addDocument('audit_logs', {
          action: 'unauthorized_attempt',
          actor_id: actorId,
          target_id: targetId ?? null,
          context,
          createdAt: serverTimestamp(),
        });
      } catch {
        return;
      }
    }

    function getRoleLabel(roleValue: CpcTeamRole): string {
      return t.get(`cpc.team.roles.${roleValue}` as never);
    }

    async function loadTeam() {
      setLoadingList(true);
      setFormError('');
      try {
        const users = await queryDocuments<CpcTeamUserDoc>('users', []);
        const filtered = users
          .filter((u): u is CpcTeamUserDoc & { role: CpcTeamRole } => CPC_TEAM_ROLES.includes(normalizeText(u.role) as CpcTeamRole))
          .map((u) => ({
            id: u.id,
            name: u.name || u.email || t.get('cpc.team.user_fallback'),
            email: u.email || '—',
            role: normalizeText(u.role) as CpcTeamRole,
            active: u.active !== false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setRows(filtered);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.load_failed');
        setFormError(message);
        setRows([]);
      } finally {
        setLoadingList(false);
      }
    }

    useEffect(() => {
      loadTeam();
    }, []);

    useEffect(() => {
      if (isAdmin) return;
      if (!user?.uid) return;
      if (hasLoggedUnauthorizedAccess.current) return;
      hasLoggedUnauthorizedAccess.current = true;
      logUnauthorizedAttempt('cpc.team.page_access');
    }, [isAdmin, user?.uid]);

    async function handleCreateUser() {
      if (!isAdmin) {
        await logUnauthorizedAttempt('cpc.team.create');
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      if (!name.trim() || !email.trim() || !password.trim()) {
        setFormError(t.get('cpc.team.errors.required_fields'));
        return;
      }
      setSaving(true);
      setFormError('');
      try {
        await registerUser(email.trim(), password, name.trim(), role);
        setOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setRole('mediator');
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.create_failed');
        setFormError(message);
      } finally {
        setSaving(false);
      }
    }

    function openEdit(user: { id: string; name: string; role: CpcTeamRole }) {
      if (!isAdmin) {
        logUnauthorizedAttempt('cpc.team.edit.open', user.id);
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      setEditTarget(user);
      setEditName(user.name);
      setEditRole(user.role);
      setEditOpen(true);
    }

    async function handleSaveEdit() {
      if (!editTarget) return;
      if (!isAdmin) {
        await logUnauthorizedAttempt('cpc.team.edit.save', editTarget.id);
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      if (!editName.trim()) {
        setFormError(t.get('cpc.team.errors.name_required'));
        return;
      }
      setSaving(true);
      setFormError('');
      try {
        await updateDocument('users', editTarget.id, {
          name: editName.trim(),
          role: editRole,
        });
        await updateDocument('profiles', editTarget.id, { name: editName.trim() });
        setEditOpen(false);
        setEditTarget(null);
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.update_failed');
        setFormError(message);
      } finally {
        setSaving(false);
      }
    }

    async function toggleActive(teamUser: { id: string; active: boolean }) {
      if (!isAdmin) {
        await logUnauthorizedAttempt('cpc.team.toggle_active', teamUser.id);
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      setActionLoadingId(teamUser.id);
      setFormError('');
      try {
        await updateDocument('users', teamUser.id, {
          active: !teamUser.active,
          disabledAt: teamUser.active ? new Date().toISOString() : null,
        });
        const actorId = user?.uid;
        if (actorId) {
          await addDocument('audit_logs', {
            action: teamUser.active ? 'user.deactivated' : 'user.reactivated',
            actor_id: actorId,
            target_id: teamUser.id,
            createdAt: serverTimestamp(),
          });
        }
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.update_state_failed');
        setFormError(message);
      } finally {
        setActionLoadingId(null);
      }
    }

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      const list = rows.filter((r) => {
        const matchQuery = q.length === 0 || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
        const matchRole = roleFilter === 'all' || r.role === roleFilter;
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? r.active : !r.active);
        return matchQuery && matchRole && matchStatus;
      });

      const sorted = [...list];
      sorted.sort((a, b) => {
        if (sortBy === 'role') return getRoleLabel(a.role).localeCompare(getRoleLabel(b.role));
        if (sortBy === 'status') return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      return sorted;
    }, [query, roleFilter, rows, sortBy, statusFilter, language]);

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <UserCog className="h-7 w-7 text-primary" /> {t.get('cpc.team.title')}
            </h1>
              <p className="text-muted-foreground mt-1">{t.get('cpc.team.subtitle')}</p>
              {!isAdmin ? (
                <p className="text-sm mt-2 text-amber-700">{t.get('cpc.team.errors.no_permission')}</p>
              ) : null}
          </div>
          {isAdmin ? (
            <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t.get('cpc.team.actions.add')}
            </Button>
          ) : null}
        </div>

        <div className="cpc-card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
                <Label>{t.get('cpc.team.search.label')}</Label>
              <div className="flex items-center gap-2 mt-1">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.get('cpc.team.search.placeholder')} />
                <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" /> {t.get('cpc.team.actions.filter')}
                </Button>
              </div>
            </div>
            <div>
                <Label>{t.get('cpc.team.role.label')}</Label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t.get('cpc.team.role.all')}</SelectItem>
                  {CPC_TEAM_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                        {getRoleLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label>{t.get('cpc.team.status.label')}</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t.get('cpc.team.status.all')}</SelectItem>
                    <SelectItem value="active">{t.get('cpc.team.status.active')}</SelectItem>
                    <SelectItem value="inactive">{t.get('cpc.team.status.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label>{t.get('cpc.team.sort.label')}</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="name">{t.get('cpc.team.sort.name')}</SelectItem>
                    <SelectItem value="role">{t.get('cpc.team.sort.role')}</SelectItem>
                    <SelectItem value="status">{t.get('cpc.team.sort.status')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label>{t.get('cpc.team.summary.label')}</Label>
              <div className="mt-1 h-10 rounded-md border bg-muted/40 flex items-center px-3 text-sm text-muted-foreground">
                  {t.get('cpc.team.summary.users', { count: filtered.length })}
              </div>
            </div>
          </div>

          {formError ? <p className="text-sm text-red-600 mt-4">{formError}</p> : null}
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cpc-card p-12 text-center">
            <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t.get('cpc.team.empty.title')}</h3>
            <p className="text-muted-foreground">{t.get('cpc.team.empty.subtitle')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => (
              <div key={r.id} className="cpc-card p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold truncate">{r.name}</h3>
                      {!r.active ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{t.get('cpc.team.status.inactive_label')}</span>
                      ) : null}
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {getRoleLabel(r.role)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{r.email}</p>

                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCog className="h-4 w-4" /> {getRoleLabel(r.role)}
                      </span>
                      <span className="flex items-center gap-1">
                        {r.active ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{' '}
                        {r.active ? t.get('cpc.team.status.active_label') : t.get('cpc.team.status.inactive_label')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" /> {r.email || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 w-full lg:w-56">
                    {isAdmin ? (
                      <>
                        <Button
                          variant="outline"
                          className="inline-flex items-center justify-center gap-2 w-full"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" /> {t.get('cpc.team.actions.edit')}
                        </Button>
                        <Button
                          variant="outline"
                          className="inline-flex items-center justify-center gap-2 w-full"
                          onClick={() => toggleActive(r)}
                          disabled={actionLoadingId === r.id}
                        >
                          {r.active ? <UserX className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          {r.active ? t.get('cpc.team.actions.deactivate') : t.get('cpc.team.actions.reactivate')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (next && !isAdmin) {
              logUnauthorizedAttempt('cpc.team.create.open');
              setFormError(t.get('cpc.team.errors.no_permission'));
              return;
            }
            setOpen(next);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.get('cpc.team.dialogs.add_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.name')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.get('cpc.team.fields.name_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.email')}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t.get('cpc.team.fields.email_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.password')}</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={t.get('cpc.team.fields.password_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.profile')}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as CpcTeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10050]" position="popper">
                    {CPC_TEAM_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {getRoleLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button className="w-full" onClick={handleCreateUser} disabled={saving}>
                {saving ? t.get('cpc.team.actions.saving') : t.get('cpc.team.actions.create_user')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            if (next && !isAdmin) {
              logUnauthorizedAttempt('cpc.team.edit.open');
              setFormError(t.get('cpc.team.errors.no_permission'));
              return;
            }
            setEditOpen(next);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.get('cpc.team.dialogs.edit_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.name')}</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t.get('cpc.team.fields.name_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.profile')}</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as CpcTeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10050]" position="popper">
                    {CPC_TEAM_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {getRoleLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button className="w-full" onClick={handleSaveEdit} disabled={saving}>
                {saving ? t.get('cpc.team.actions.saving') : t.get('cpc.team.actions.save_changes')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function CandidaturasDetalhadas() {
    const [loadingList, setLoadingList] = useState(true);
    const [rows, setRows] = useState<Array<{ id: string; applicant: string; email: string; job: string; status: string; created_at: string }>>([]);
    useEffect(() => {
      async function fetchAll() {
        setLoadingList(true);
        try {
          const apps = await queryDocuments<{ id: string; applicant_id: string; job_id: string; status: string; created_at: string }>(
            'job_applications',
            [],
            { field: 'created_at', direction: 'desc' },
            200
          );
          const applicantIds = Array.from(new Set(apps.map(a => a.applicant_id).filter(Boolean)));
          const jobIds = Array.from(new Set(apps.map(a => a.job_id).filter(Boolean)));

          const profileDocs = await Promise.all(applicantIds.map(id => getDocument<{ name?: string | null; email?: string | null }>('profiles', id)));
          const pmap = new Map<string, { name: string; email: string }>();
          applicantIds.forEach((id, idx) => {
            const p = profileDocs[idx];
            if (p) pmap.set(id, { name: p.name || id, email: p.email || '' });
          });

          const jobDocs = await Promise.all(jobIds.map(id => getDocument<{ title?: string | null }>('job_offers', id)));
          const jmap = new Map<string, { title: string }>();
          jobIds.forEach((id, idx) => {
            const j = jobDocs[idx];
            if (j) jmap.set(id, { title: j.title || id });
          });

          const out = apps.map(a => ({
            id: a.id,
            applicant: pmap.get(a.applicant_id)?.name || a.applicant_id,
            email: pmap.get(a.applicant_id)?.email || '',
            job: jmap.get(a.job_id)?.title || a.job_id,
            status: a.status,
            created_at: a.created_at,
          }));
          setRows(out);
        } finally {
          setLoadingList(false);
        }
      }
      fetchAll();
    }, []);

    return (
      <div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary shrink-0" aria-hidden />
              {t.get('cpc.pages.applications.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t.get('cpc.pages.applications.subtitle')}</p>
          </div>
          <Link
            to="/dashboard/cpc"
            className="text-sm text-primary hover:underline shrink-0 self-start md:self-auto"
          >
            {t.get('cpc.actions.back')}
          </Link>
        </div>
        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="cpc-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.applicant}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.email} • {r.job}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{new Date(r.created_at).toLocaleString(locale)}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{r.status}</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="cpc-card p-12 text-center text-muted-foreground">{t.get('cpc.pages.applications.empty')}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  function OfertasAguardandoAprovacao() {
    type OfferRow = {
      id: string;
      title: string;
      location: string | null;
      created_at: string;
      status: string;
      company_id: string | null;
      company_name: string;
    };

    const [loadingList, setLoadingList] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'active' | 'rejected'>('pending_review');
    const [searchQuery, setSearchQuery] = useState('');
    const [rows, setRows] = useState<OfferRow[]>([]);

    async function fetchAll() {
      setLoadingList(true);
      try {
        const data = await queryDocuments<Record<string, unknown> & { id: string }>(
          'job_offers',
          [],
          undefined,
          400
        );

        const companyIds = Array.from(
          new Set(
            (data || [])
              .map((row) => (typeof row.company_id === 'string' ? row.company_id : null))
              .filter((id): id is string => Boolean(id))
          )
        );
        const companyDocs = await Promise.all(
          companyIds.map((id) => getDocument<{ company_name?: string | null }>('companies', id))
        );
        const companyNameMap = new Map<string, string>();
        companyIds.forEach((id, idx) => {
          const n = companyDocs[idx]?.company_name;
          companyNameMap.set(id, typeof n === 'string' && n.trim() ? n.trim() : id);
        });

        const mapped: OfferRow[] = (data || []).map((row) => {
          const companyId = typeof row.company_id === 'string' ? row.company_id : null;
          const created = parseUnknownDate(row.created_at);
          return {
            id: row.id,
            title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : '—',
            location: typeof row.location === 'string' ? row.location : null,
            created_at: created ? created.toISOString() : '',
            status: typeof row.status === 'string' ? row.status : 'pending_review',
            company_id: companyId,
            company_name: companyId ? (companyNameMap.get(companyId) || companyId) : '—',
          };
        });

        mapped.sort((a, b) => {
          const ad = parseUnknownDate(a.created_at)?.getTime() || 0;
          const bd = parseUnknownDate(b.created_at)?.getTime() || 0;
          return bd - ad;
        });

        setRows(mapped);
      } catch (error) {
        console.error('Error fetching CPC offers moderation list:', error);
      } finally {
        setLoadingList(false);
      }
    }

    useEffect(() => {
      void fetchAll();
    }, []);

    async function handleSetStatus(row: OfferRow, nextStatus: 'active' | 'rejected') {
      setProcessingId(row.id);
      try {
        await updateDocument('job_offers', row.id, {
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.uid || null,
        });
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
      } catch (error) {
        console.error('Error moderating offer status:', error);
      } finally {
        setProcessingId(null);
      }
    }

    async function handleDelete(row: OfferRow) {
      const ok = window.confirm(t.get('cpc.pages.offers.confirm_delete', { title: row.title }));
      if (!ok) return;
      setProcessingId(row.id);
      try {
        await deleteDocument('job_offers', row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (error) {
        console.error('Error deleting offer:', error);
      } finally {
        setProcessingId(null);
      }
    }

    const filteredRows = useMemo(() => {
      let out = [...rows];
      if (statusFilter !== 'all') {
        out = out.filter((r) => r.status === statusFilter);
      }
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        out = out.filter((r) => {
          const title = r.title.toLowerCase();
          const location = (r.location || '').toLowerCase();
          const company = (r.company_name || '').toLowerCase();
          return title.includes(q) || location.includes(q) || company.includes(q);
        });
      }
      return out;
    }, [rows, searchQuery, statusFilter]);

    function statusBadge(status: string) {
      if (status === 'active') {
        return <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{t.get('cpc.pages.offers.status_active')}</span>;
      }
      if (status === 'rejected' || status === 'closed') {
        return <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">{t.get('cpc.pages.offers.status_rejected')}</span>;
      }
      return <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">{t.get('cpc.pages.offers.status_pending')}</span>;
    }

    return (
      <div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Briefcase className="h-7 w-7 text-primary" /> {t.get('cpc.pages.offers.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t.get('cpc.pages.offers.subtitle')}</p>
          </div>
          <Link
            to="/dashboard/cpc"
            className="text-sm text-primary hover:underline shrink-0 self-start md:self-auto"
          >
            {t.get('cpc.actions.back')}
          </Link>
        </div>

        <div className="cpc-card p-6 mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'pending_review', label: t.get('cpc.pages.offers.filters.pending') },
              { key: 'active', label: t.get('cpc.pages.offers.filters.active') },
              { key: 'rejected', label: t.get('cpc.pages.offers.filters.rejected') },
              { key: 'all', label: t.get('cpc.pages.offers.filters.all') },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key as 'all' | 'pending_review' | 'active' | 'rejected')}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.get('cpc.pages.offers.search_placeholder')}
              className="pl-9"
              aria-label={t.get('cpc.pages.offers.search_placeholder')}
            />
          </div>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((r) => {
                const rowBusy = processingId === r.id;
                return (
                  <div key={r.id} className="cpc-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {r.company_name} {r.location ? `• ${r.location}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString(locale) : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {statusBadge(r.status)}
                      <Button
                        size="sm"
                        onClick={() => handleSetStatus(r, 'active')}
                        disabled={rowBusy || r.status === 'active'}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t.get('cpc.pages.offers.actions.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetStatus(r, 'rejected')}
                        disabled={rowBusy || r.status === 'rejected'}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {t.get('cpc.pages.offers.actions.reject')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(r)}
                        disabled={rowBusy}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t.get('cpc.pages.offers.actions.delete')}
                      </Button>
                    </div>
                  </div>
                );
            })}
            {filteredRows.length === 0 && (
              <div className="cpc-card p-12 text-center text-muted-foreground">{t.get('cpc.pages.offers.empty')}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      try {
        const now = new Date();
        const todayISO = getCalendarDateIsoInAppTimeZone(now);
        const { weekStart: weekStartIso, weekEnd: weekEndIso } = weekStartEndIsoMondayInAppCalendar(todayISO);

        const { monthStart: monthStartIso, monthEnd: monthEndIso } = monthStartEndIsoInAppTimeZone(now);

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const prevDayIso = addCalendarDaysIso(todayISO, -1);
        const prevWeekStartIso = addCalendarDaysIso(weekStartIso, -7);
        const prevWeekEndIso = addCalendarDaysIso(weekEndIso, -7);
        const { monthStart: prevMonthStartIso, monthEnd: prevMonthEndIso } = previousMonthStartEndFromTodayIso(todayISO);

        const periodStartISO = period === 'today' ? todayISO : period === 'week' ? weekStartIso : monthStartIso;
        const periodEndISO = period === 'today' ? todayISO : period === 'week' ? weekEndIso : monthEndIso;
        const prevStartISO = period === 'today' ? prevDayIso : period === 'week' ? prevWeekStartIso : prevMonthStartIso;
        const prevEndISO = period === 'today' ? prevDayIso : period === 'week' ? prevWeekEndIso : prevMonthEndIso;

        const [firebaseMigrants, allSessionsRaw, companiesTotalCount, offersActiveCount, offersPendingCount, applicationsTotalCount, progressRaw, triageRaw, applicationsPeriodCountRaw, applicationsPrevCountRaw] = await Promise.all([
          queryDocuments<FirebaseUserDoc>('users', [{ field: 'role', operator: 'in', value: ['migrant', 'Migrant', 'MIGRANT'] }]),
          queryDocuments<{ id: string; scheduled_date: string; status: string | null; session_type: string; scheduled_time: string; migrant_id: string }>(
            'sessions',
            [],
            { field: 'scheduled_date', direction: 'asc' }
          ),
          countDocuments('companies', []),
          countDocuments('job_offers', [{ field: 'status', operator: '==', value: 'active' }]),
          countDocuments('job_offers', [{ field: 'status', operator: '==', value: 'pending_review' }]),
          countDocuments('job_applications', []),
          queryDocuments<{ progress_percent: number | null }>('user_trail_progress', []),
          queryDocuments<{ id: string; urgencies: string[] | null }>('triage', []),
          countDocuments('job_applications', [
            { field: 'created_at', operator: '>=', value: periodStartISO },
            { field: 'created_at', operator: '<=', value: periodEndISO },
          ]),
          countDocuments('job_applications', [
            { field: 'created_at', operator: '>=', value: prevStartISO },
            { field: 'created_at', operator: '<=', value: prevEndISO },
          ]),
        ]);

        const migrantDates = firebaseMigrants
          .map((u) => parseUnknownDate(u.createdAt))
          .filter((d): d is Date => d !== null);
        setMigrantsTotal(firebaseMigrants.length);
        setMigrantsNew7(migrantDates.filter((d) => d >= sevenDaysAgo).length);
        setMigrantsNew30(migrantDates.filter((d) => d >= thirtyDaysAgo).length);
        setMigrantsPeriodNew(countDatesBetween(migrantDates, periodStartISO, periodEndISO));
        setMigrantsPrevNew(countDatesBetween(migrantDates, prevStartISO, prevEndISO));

        const allSessions = (allSessionsRaw || []).filter((s) => !isCancelledSessionStatus(s.status));
        setSessionsTodayCount(allSessions.filter((s) => s.scheduled_date === todayISO).length);
        setSessionsWeekCount(allSessions.filter((s) => s.scheduled_date >= weekStartIso && s.scheduled_date <= weekEndIso).length);
        setSessionsCompletedCount(allSessions.filter((s) => isCompletedSessionStatus(s.status)).length);
        setSessionsPeriodCount(allSessions.filter((s) => s.scheduled_date >= periodStartISO && s.scheduled_date <= periodEndISO).length);
        setSessionsPrevCount(allSessions.filter((s) => s.scheduled_date >= prevStartISO && s.scheduled_date <= prevEndISO).length);

        setCompaniesTotal(companiesTotalCount || 0);
        setJobOffersActive(offersActiveCount || 0);
        setJobOffersPendingApproval(offersPendingCount || 0);
        setApplicationsTotal(applicationsTotalCount || 0);
        setApplicationsPeriodCount(applicationsPeriodCountRaw || 0);
        setApplicationsPrevCount(applicationsPrevCountRaw || 0);

        const progressValues = (progressRaw || []).map(p => p.progress_percent || 0);
        const avg = progressValues.length ? Math.round(progressValues.reduce((a,b)=>a+b,0) / progressValues.length) : 0;
        setAvgProgress(avg);

        const agg = { juridico: 0, psicologico: 0, habitacional: 0 };
        triageRaw.forEach(t => {
          (t.urgencies || []).forEach(u => {
            if (u === 'juridico') agg.juridico += 1;
            if (u === 'psicologico') agg.psicologico += 1;
            if (u === 'habitacional') agg.habitacional += 1;
          });
        });
        setUrgencies(agg);

        const recentRaw = [...firebaseMigrants]
          .map((m) => ({ id: m.id, createdAt: parseUnknownDate(m.createdAt) }))
          .filter((m): m is { id: string; createdAt: Date } => m.createdAt !== null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 4);
        const recentIds = recentRaw.map((m) => m.id);
        const [recentProfiles, recentTriage, recentUsers] = await Promise.all([
          Promise.all(recentIds.map((id) => getDocument<RecentMigrantProfileDoc>('profiles', id))),
          Promise.all(
            recentIds.map((id) => getDocument<{ completed?: boolean | null; urgencies?: string[] | null }>('triage', id))
          ),
          Promise.all(recentIds.map((id) => getDocument<{ name?: string | null; email?: string | null }>('users', id))),
        ]);

        const recentList = recentRaw.map((m, idx) => {
          const profileDoc = recentProfiles[idx];
          const userDoc = recentUsers[idx];
          const triageDoc = recentTriage[idx];
          const triageComplete = triageDoc?.completed === true;
          const profilePct = computeMigrantProfileCompletenessPercent(profileDoc ?? undefined, {
            authName: userDoc?.name,
          });

          const statusLabel = !triageComplete
            ? t.get('cpc.recentMigrants.status.triage_incomplete')
            : profilePct < 100
              ? t.get('cpc.recentMigrants.status.registration_incomplete')
              : t.get('cpc.recentMigrants.status.registration_complete');
          const statusClassName = !triageComplete
            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
            : profilePct < 100
              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';

          const createdAt = m.createdAt;
          const relative = formatRelativeTime(createdAt, now);
          const title = profileDoc?.professionalTitle ? ` • ${profileDoc.professionalTitle}` : '';

          return {
            id: m.id,
            name: resolveRecentMigrantDisplayName({ profile: profileDoc, userDoc, t }),
            subtitle: `${relative}${title}`,
            statusLabel,
            statusClassName,
            dateLabel: shortDateFormatter.format(createdAt),
          };
        });
        setRecentMigrants(recentList);

        const todaySessTyped = allSessions
          .filter((s) => s.scheduled_date === todayISO)
          .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
        const migrantIds = Array.from(new Set(todaySessTyped.map(s => s.migrant_id).filter(Boolean)));
        const migrantMap: Record<string, string> = {};
        if (migrantIds.length) {
          const migrantProfiles = await Promise.all(migrantIds.map((id) => getDocument<{ name?: string | null }>('profiles', id)));
          migrantIds.forEach((id, idx) => {
            migrantMap[id] = migrantProfiles[idx]?.name || id;
          });
        }
        const todayList = todaySessTyped.map((s) => ({
          id: s.id,
          migrant: migrantMap[s.migrant_id] || s.migrant_id,
          type: s.session_type,
          time: s.scheduled_time,
          status: formatSessionStatusLabel(s.status),
          statusRaw: s.status,
        }));
        setTodaySessions(todayList);

        try {
          let pendingChats = 0;
          let pendingUrgencies = 0;
          firebaseMigrants.forEach((migrant) => {
            const chatRaw = localStorage.getItem(`chat:${migrant.id}`);
            if (chatRaw) {
              const chatList = JSON.parse(chatRaw) as Array<{ from?: string }>;
              if (chatList.length > 0 && normalizeText(chatList[0]?.from) === 'migrante') {
                pendingChats += 1;
              }
            }
            const urgentRaw = localStorage.getItem(`urgentRequests:${migrant.id}`);
            if (urgentRaw) {
              const urgentList = JSON.parse(urgentRaw) as Array<{ status?: string }>;
              pendingUrgencies += urgentList.filter((item) => ['submetido', 'pending', 'pendente'].includes(normalizeText(item.status))).length;
            }
          });
          setMessagesPending(pendingChats + pendingUrgencies);
        } catch { setMessagesPending(0); }
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, [period]);

  const migrantsDelta = migrantsPeriodNew - migrantsPrevNew;
  const sessionsDelta = sessionsPeriodCount - sessionsPrevCount;
  const applicationsDelta = applicationsPeriodCount - applicationsPrevCount;

  type KpiItem = {
    key: string;
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    change: { label: string; className: string };
  };

  const kpis: KpiItem[] = useMemo(() => {
    return [
      {
        key: 'migrants_active',
        label: t.get('cpc.kpi.migrants'),
        value: migrantsTotal,
        icon: Users,
        change: formatKpiChange(migrantsPeriodNew, migrantsPrevNew),
      },
      {
        key: 'sessions',
        label: t.get('cpc.kpi.sessions'),
        value: period === 'today' ? sessionsTodayCount : sessionsPeriodCount,
        icon: Calendar,
        change: formatKpiChange(sessionsPeriodCount, sessionsPrevCount),
      },
      {
        key: 'applications',
        label: t.get('cpc.kpi.applications'),
        value: applicationsTotal,
        icon: FileText,
        change: formatKpiChange(applicationsPeriodCount, applicationsPrevCount),
      },
      {
        key: 'offers_active',
        label: t.get('cpc.kpi.offers_active'),
        value: jobOffersActive,
        icon: Briefcase,
        change: { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' },
      },
      {
        key: 'offers_pending',
        label: t.get('cpc.kpi.offers_pending'),
        value: jobOffersPendingApproval,
        icon: Clock,
        change: { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' },
      },
      {
        key: 'pending',
        label: t.get('cpc.kpi.pending'),
        value: messagesPending,
        icon: Mail,
        change: { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' },
      },
    ];
  }, [
    applicationsPeriodCount,
    applicationsPrevCount,
    applicationsTotal,
    jobOffersActive,
    jobOffersPendingApproval,
    messagesPending,
    migrantsPeriodNew,
    migrantsPrevNew,
    migrantsTotal,
    period,
    sessionsPeriodCount,
    sessionsPrevCount,
    sessionsTodayCount,
    language,
    t,
  ]);

  const getStatusColor = (status?: string | null) => {
    if (isCompletedSessionStatus(status)) return 'bg-green-100 text-green-700';
    if (isInProgressSessionStatus(status)) return 'bg-blue-100 text-blue-700';
    if (isCancelledSessionStatus(status)) return 'bg-rose-100 text-rose-700';
    return 'bg-muted text-muted-foreground';
  };

  const sidebarItemsMain = [
    { to: '/dashboard/cpc', label: t.get('cpc.menu.overview'), icon: TrendingUp },
    { to: '/dashboard/cpc/migrantes', label: t.get('cpc.menu.migrants'), icon: Users },
    { to: '/dashboard/cpc/atividades', label: t.get('cpc.menu.activities'), icon: ClipboardList },
    { to: '/dashboard/cpc/agenda', label: t.get('cpc.menu.agenda'), icon: Calendar },
    { to: '/dashboard/cpc/candidaturas', label: t.get('cpc.menu.applications'), icon: FileText },
    { to: '/dashboard/cpc/ofertas', label: t.get('cpc.menu.offers'), icon: Briefcase },
    { to: '/dashboard/cpc/trilhas', label: t.get('cpc.menu.trails'), icon: BookOpen },
    { to: '/dashboard/cpc/equipa', label: t.get('cpc.menu.team'), icon: UserCog },
    { to: '/dashboard/cpc/estatisticas', label: t.get('cpc.menu.statistics'), icon: TrendingUp },
    ...(profile?.role === 'admin'
      ? [{ to: '/dashboard/cpc/conteudo', label: 'Editor de Conteúdo', icon: FileText }]
      : []),
    { to: '/dashboard/cpc/traducoes', label: t.get('cpcTranslations.title'), icon: Languages },
  ];

  const sidebarItemsProfile = [
    { to: '/dashboard/cpc/perfil', label: t.get('cpc.menu.profile'), icon: Building2 },
    { to: '/dashboard/cpc/configuracoes', label: t.get('cpc.menu.settings'), icon: Settings },
  ];
  const isHome = location.pathname === '/dashboard/cpc' || location.pathname === '/dashboard/cpc/';

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
            <aside className="cpc-card p-4 h-fit lg:sticky lg:top-24">
              <div className="mb-4 px-2">
                <p className="text-sm text-muted-foreground">{t.get('cpc.menu.title')}</p>
                <p className="font-semibold">{cpcDisplayName}</p>
              </div>
              <nav className="space-y-1">
                {sidebarItemsMain.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard/cpc'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}

                <div className="pt-4 mt-4 border-t">
                  <p className="px-2 text-xs font-semibold tracking-widest text-muted-foreground">Definições</p>
                  <div className="mt-2 space-y-1">
                    {sidebarItemsProfile.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </nav>
            </aside>

            <div>
              {isHome ? (
                <>
                  <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      {t.get('cpc.dashboard.welcome')}, <span className="text-primary">{cpcDisplayName}</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.get('cpc.dashboard.today_summary', { date: longDateFormatter.format(new Date()) })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                    {kpis.map((kpi) => (
                      <div key={kpi.key} className="cpc-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <kpi.icon className="h-4 w-4" />
                          </div>
                          <span className={`text-xs font-semibold ${kpi.change.className}`}>{kpi.change.label}</span>
                        </div>
                        <div className="mt-4">
                          <p className="text-xs tracking-widest text-muted-foreground font-semibold">{kpi.label}</p>
                          <p className="text-2xl font-bold leading-tight mt-1">{numberFormatter.format(kpi.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
                    <div className="space-y-6">
                      <div className="cpc-card p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold">{t.get('cpc.recentMigrants.title')}</h2>
                          <Link to="/dashboard/cpc/migrantes" className="text-sm text-primary hover:underline">
                            {t.get('cpc.actions.view_all')}
                          </Link>
                        </div>

                        <div className="divide-y divide-border">
                          {recentMigrants.map((migrant) => (
                            <div key={migrant.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                              <Link
                                to={`/dashboard/cpc/migrantes/${migrant.id}/perfil`}
                                className="flex items-center gap-3 min-w-0 flex-1"
                              >
                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                                  {(migrant.name || 'U').slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{migrant.name}</p>
                                  <p className="text-sm text-muted-foreground truncate">{migrant.subtitle}</p>
                                </div>
                              </Link>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${migrant.statusClassName}`}>
                                  {migrant.statusLabel}
                                </span>
                                <button
                                  type="button"
                                  className="h-9 w-9 rounded-lg hover:bg-muted inline-flex items-center justify-center"
                                  aria-label={t.get('cpc.actions.actions')}
                                >
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {recentMigrants.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">{t.get('cpc.recentMigrants.empty')}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="cpc-card p-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold">{t.get('cpc.sessions.title')}</h2>
                          <Link to="/dashboard/cpc/agenda" className="text-sm text-primary hover:underline">
                            {t.get('cpc.sessions.view_agenda')}
                          </Link>
                        </div>

                        {todaySessions.length === 0 ? (
                          <div className="mt-6 rounded-2xl bg-muted/40 p-8 flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <CalendarX className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold">{t.get('cpc.sessions.empty')}</p>
                                <p className="text-sm text-muted-foreground truncate">{t.get('cpc.sessions.empty_subtitle')}</p>
                              </div>
                            </div>
                            <Link to="/dashboard/cpc/agenda">
                              <Button className="rounded-xl">{t.get('cpc.sessions.new_session')}</Button>
                            </Link>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {todaySessions.map((session) => (
                              <div key={session.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-muted/40">
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{session.migrant}</p>
                                  <p className="text-sm text-muted-foreground truncate">{session.type}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-semibold">{session.time}</p>
                                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(session.statusRaw)}`}>{session.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="cpc-card p-6">
                        <h2 className="text-lg font-semibold">{t.get('cpc.quickActions.title')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.subtitle')}</p>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                          <Link to="/dashboard/cpc/migrantes" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <UserPlus className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.new_migrant')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.new_migrant_subtitle')}</p>
                          </Link>
                          <Link to="/dashboard/cpc/agenda" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <CalendarPlus className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.agenda')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.agenda_subtitle')}</p>
                          </Link>
                          <Link to="/dashboard/cpc/trilhas" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.manage_trails')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.manage_trails_subtitle')}</p>
                          </Link>
                          <Link to="/dashboard/cpc/ofertas" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <Briefcase className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.create_offer')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.create_offer_subtitle')}</p>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <Routes>
                <Route path="candidatos/:candidateId" element={<CandidateProfilePage />} />
                <Route path="migrantes/:migrantId/perfil" element={<MigrantProfilePage />} />
                <Route path="migrantes" element={<MigrantsAdminPage />} />
                <Route path="atividades" element={<ActivitiesPage />} />
                <Route path="atividades/nova" element={<ActivityEditorPage />} />
                <Route path="atividades/:activityId" element={<ActivityDetailsPage />} />
                <Route path="atividades/:activityId/editar" element={<ActivityEditorPage />} />
                <Route path="agenda" element={<TeamAgendaPage />} />
                <Route path="candidaturas" element={<CandidaturasDetalhadas />} />
                <Route path="ofertas" element={<OfertasAguardandoAprovacao />} />
                <Route path="trilhas" element={<TrailsAdminPage />} />
                <Route path="trilhas/:trailId" element={<TrailEditorPage />} />
                <Route path="equipa" element={<EquipaPage />} />
                <Route path="estatisticas" element={<StatisticsPage />} />
                <Route path="perfil" element={<CPCProfilePage />} />
                <Route path="configuracoes" element={<CPCSettingsPage />} />
                <Route path="mensagens" element={<CPCMessagesPage />} />
                <Route path="traducoes" element={<TranslationsAdminPage />} />
                <Route path="conteudo" element={<ContentEditorPage />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
import CandidateProfilePage from './company/CandidateProfilePage';
import MigrantsAdminPage from './cpc/MigrantsAdminPage';
import TeamAgendaPage from './cpc/TeamAgendaPage';
import MigrantProfilePage from './migrant/ProfilePage';
import TrailsAdminPage from './cpc/TrailsAdminPage';
import TrailEditorPage from './cpc/TrailEditorPage';
import TranslationsAdminPage from './cpc/TranslationsAdminPage';
import CPCProfilePage from './cpc/ProfilePage';
import CPCMessagesPage from './cpc/MessagesPage';
import ActivitiesPage from './cpc/ActivitiesPage';
import ActivityEditorPage from './cpc/ActivityEditorPage';
import ActivityDetailsPage from './cpc/ActivityDetailsPage';
import StatisticsPage from './cpc/StatisticsPage';
import CPCSettingsPage from './cpc/SettingsPage';
