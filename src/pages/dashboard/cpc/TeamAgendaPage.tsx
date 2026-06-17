import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { parseUnknownDate } from '@/lib/companyVerification';
import {
  canApproveSessionRequests,
  isSessionPendingApproval,
  SESSION_STATUS_REJECTED,
  SESSION_STATUS_SCHEDULED,
  shouldShowSessionOnAgenda,
} from '@/lib/sessionApproval';
import {
  addCalendarDaysIso,
  APP_TIME_ZONE,
  getCalendarDateIsoInTimeZone,
  getJsWeekdaySun0ForCalendarDateIso,
  todayIsoAppCalendar,
  weekStartEndIsoMondayInAppCalendar,
} from '@/lib/appCalendar';
import {
  AlignLeft,
  Bold,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Italic,
  List,
  ListOrdered,
  Loader2,
  MapPin,
  Plus,
  Save,
  User,
  X,
} from 'lucide-react';
import CpcCreateSessionDialog from './CpcCreateSessionDialog';
import type { AgendaCategory as CreateAgendaCategory } from '@/lib/cpcSpecialists';

type AgendaCategory = 'legal' | 'psychology' | 'mediation' | 'collective';
type SessionColor = 'blue' | 'green' | 'purple';

type SessionDoc = {
  id: string;
  migrant_id?: string | null;
  session_type?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status?: string | null;
  service_id?: string | null;
  service_label?: string | null;
  specialist_id?: string | null;
  specialist_name?: string | null;
  meeting_url?: string | null;
  created_at?: string | null;
};

type AgendaSession = {
  id: string;
  migrantId: string;
  personName: string;
  category: AgendaCategory;
  color: SessionColor;
  serviceLabel: string | null;
  specialistName: string | null;
  status: string | null;
  meetingUrl: string | null;
  dateIso: string;
  timeLabel: string;
  startHour: number;
  startMinute: number;
  durationHours: number;
};

type PendingRequest = {
  id: string;
  category: AgendaCategory;
  title: string;
  person: string;
  specialistName: string | null;
  when: string;
  timeAgo: string;
  createdAtMs: number;
};

const START_HOUR = 8;
const END_HOUR = 19;
const ROW_HEIGHT = 74;
const HEADER_HEIGHT = 72;
const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const CATEGORY_COLOR: Record<AgendaCategory, SessionColor> = {
  legal: 'blue',
  psychology: 'purple',
  mediation: 'green',
  collective: 'blue',
};

function resolveCategory(sessionType?: string | null, serviceId?: string | null): AgendaCategory {
  const type = (sessionType ?? '').toLowerCase();
  const service = (serviceId ?? '').toLowerCase();
  if (service === 'legal' || type === 'jurista' || type === 'lawyer') return 'legal';
  if (service === 'psychology' || type === 'psicologa' || type === 'psychologist') return 'psychology';
  if (service === 'mediation' || type === 'mediador' || type === 'mediator') return 'mediation';
  return 'collective';
}

function categoryBadgeClass(category: AgendaCategory): string {
  if (category === 'legal') return 'bg-blue-50 text-blue-600';
  if (category === 'psychology') return 'bg-violet-50 text-violet-600';
  if (category === 'mediation') return 'bg-emerald-50 text-emerald-600';
  return 'bg-cyan-50 text-cyan-600';
}

function categoryDotClass(category: AgendaCategory): string {
  if (category === 'legal') return 'bg-blue-500';
  if (category === 'psychology') return 'bg-violet-500';
  if (category === 'mediation') return 'bg-emerald-500';
  return 'bg-cyan-500';
}

function normalizeIso(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return getCalendarDateIsoInTimeZone(parsed);
}

function parseTime(value?: string | null): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim());
  if (!match) return { hour: 9, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]))),
    minute: Math.min(59, Math.max(0, Number(match[2]))),
  };
}

function addCalendarMonthsIso(isoDate: string, deltaMonths: number): string {
  const [y, m] = isoDate.split('-').map(Number);
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

function buildMonthMatrix(anchorIso: string): string[] {
  const [y, m] = anchorIso.split('-').map(Number);
  const firstIso = `${y}-${String(m).padStart(2, '0')}-01`;
  const firstWeekdaySun0 = getJsWeekdaySun0ForCalendarDateIso(firstIso);
  const mondayOffset = firstWeekdaySun0 === 0 ? 6 : firstWeekdaySun0 - 1;
  const gridStart = addCalendarDaysIso(firstIso, -mondayOffset);
  return Array.from({ length: 42 }, (_, i) => addCalendarDaysIso(gridStart, i));
}

function appTimeHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour: hour === 24 ? 0 : hour, minute };
}

function buildAgendaSession(doc: SessionDoc, nameMap: Map<string, string>): AgendaSession {
  const category = resolveCategory(doc.session_type, doc.service_id);
  const { hour, minute } = parseTime(doc.scheduled_time);
  const migrantId = doc.migrant_id ?? '';
  const personName = (nameMap.get(migrantId) || '').trim();
  return {
    id: doc.id,
    migrantId,
    personName,
    category,
    color: CATEGORY_COLOR[category],
    serviceLabel: doc.service_label ?? null,
    specialistName: doc.specialist_name ?? null,
    status: doc.status ?? null,
    meetingUrl: doc.meeting_url ?? null,
    dateIso: normalizeIso(doc.scheduled_date),
    timeLabel: (doc.scheduled_time ?? '').trim() || `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    startHour: hour,
    startMinute: minute,
    durationHours: 1,
  };
}

function eventClass(color: SessionColor, selected: boolean): string {
  if (color === 'blue') return selected ? 'border-l-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-l-blue-500 bg-blue-50';
  if (color === 'green') return selected ? 'border-l-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-l-emerald-500 bg-emerald-50';
  return selected ? 'border-l-violet-500 bg-violet-50 ring-2 ring-violet-300' : 'border-l-violet-500 bg-violet-50';
}

function formatRelativeTimeLabel(from: Date, to: Date, t: { get: (key: string, params?: Record<string, string | number>) => string }): string {
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return t.get('cpc.relative.minutes', { count: Math.max(1, mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.get('cpc.relative.hours', { count: hours });
  const days = Math.floor(hours / 24);
  return t.get('cpc.relative.days', { count: days });
}

function formatPendingWhen(dateIso: string, timeLabel: string, locale: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, d, 12))
  );
  return `${dateLabel} • ${timeLabel}`;
}

function buildPendingRequest(
  doc: SessionDoc,
  nameMap: Map<string, string>,
  locale: string,
  t: { get: (key: string, params?: Record<string, string | number>) => string },
  now: Date
): PendingRequest {
  const category = resolveCategory(doc.session_type, doc.service_id);
  const migrantId = doc.migrant_id ?? '';
  const personName = (nameMap.get(migrantId) || '').trim() || t.get('cpc.agenda.event.unknownPerson');
  const createdAt = parseUnknownDate(doc.created_at) ?? now;
  return {
    id: doc.id,
    category,
    title: doc.service_label?.trim() || t.get(`cpc.agenda.sessionTypes.${category}`),
    person: personName,
    specialistName: doc.specialist_name?.trim() || null,
    when: formatPendingWhen(normalizeIso(doc.scheduled_date), (doc.scheduled_time ?? '').trim() || '—', locale),
    timeAgo: formatRelativeTimeLabel(createdAt, now, t),
    createdAtMs: createdAt.getTime(),
  };
}

export default function TeamAgendaPage() {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchorIso, setAnchorIso] = useState<string>(() => todayIsoAppCalendar());
  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgendaCategory>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [eventInfoOpen, setEventInfoOpen] = useState(false);
  const [sessionRecordOpen, setSessionRecordOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionUrgent, setSessionUrgent] = useState(false);
  const [recommendedTrack, setRecommendedTrack] = useState<string>('');
  const [immediateNextStep, setImmediateNextStep] = useState<string>('');
  const [lastAutosavedAt, setLastAutosavedAt] = useState<number | null>(Date.now() - 2 * 60 * 1000);

  const todayIso = useMemo(() => todayIsoAppCalendar(), []);
  const canModerateRequests = useMemo(() => canApproveSessionRequests(profile?.role), [profile?.role]);

  const locale = useMemo(() => {
    if (language === 'en') return 'en-GB';
    if (language === 'es') return 'es-ES';
    if (language === 'fr') return 'fr-FR';
    return 'pt-PT';
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      try {
        const raw = await queryDocuments<SessionDoc>('sessions', [], { field: 'scheduled_date', direction: 'asc' });
        const rows = raw ?? [];
        const ids = Array.from(new Set(rows.map((r) => r.migrant_id).filter((id): id is string => Boolean(id))));
        const [profiles, users] = await Promise.all([
          Promise.all(ids.map((id) => getDocument<{ name?: string | null }>('profiles', id).catch(() => null))),
          Promise.all(ids.map((id) => getDocument<{ name?: string | null }>('users', id).catch(() => null))),
        ]);
        const nameMap = new Map<string, string>();
        ids.forEach((id, index) => {
          const name = (profiles[index]?.name?.trim() || users[index]?.name?.trim() || '').toString();
          nameMap.set(id, name);
        });
        const now = new Date();
        const pending = rows
          .filter((r) => isSessionPendingApproval(r.status))
          .map((r) => buildPendingRequest(r, nameMap, locale, t, now))
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        const mapped = rows
          .filter((r) => shouldShowSessionOnAgenda(r.status))
          .map((r) => buildAgendaSession(r, nameMap));
        if (!cancelled) {
          setPendingRequests(pending);
          setSessions(mapped);
        }
      } catch (error) {
        console.error('Erro ao carregar sessões da agenda', error);
        if (!cancelled) {
          setSessions([]);
          setPendingRequests([]);
        }
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const week = useMemo(() => weekStartEndIsoMondayInAppCalendar(anchorIso), [anchorIso]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = addCalendarDaysIso(week.weekStart, i);
        return {
          iso,
          key: WEEKDAY_KEYS[i],
          short: t.get(`cpc.agenda.weekdays.${WEEKDAY_KEYS[i]}`),
          dayNum: Number(iso.slice(8, 10)),
          isToday: iso === todayIso,
        };
      }),
    [week.weekStart, t, todayIso]
  );

  const visibleSessions = useMemo(() => {
    if (categoryFilter === 'all') return sessions;
    return sessions.filter((session) => session.category === categoryFilter);
  }, [sessions, categoryFilter]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, AgendaSession[]>();
    for (const session of visibleSessions) {
      const list = map.get(session.dateIso) ?? [];
      list.push(session);
      map.set(session.dateIso, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute));
    }
    return map;
  }, [visibleSessions]);

  const monthCells = useMemo(() => buildMonthMatrix(anchorIso), [anchorIso]);
  const anchorMonth = useMemo(() => Number(anchorIso.slice(5, 7)), [anchorIso]);

  const periodTitle = useMemo(() => {
    const [y, m] = anchorIso.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1, 12)));
  }, [anchorIso, locale]);

  const showNowLine = todayIso >= week.weekStart && todayIso <= week.weekEnd;
  const nowLineTop = useMemo(() => {
    const { hour, minute } = appTimeHourMinute(new Date(nowTick));
    return HEADER_HEIGHT + (hour + minute / 60 - START_HOUR) * ROW_HEIGHT;
  }, [nowTick]);
  const nowLineVisible = showNowLine && (() => {
    const { hour } = appTimeHourMinute(new Date(nowTick));
    return hour >= START_HOUR && hour <= END_HOUR;
  })();

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const selectedSessionTitle = useMemo(() => {
    if (!selectedSession) return '';
    return selectedSession.serviceLabel?.trim() || t.get(`cpc.agenda.sessionTypes.${selectedSession.category}`);
  }, [selectedSession, t]);

  const selectedSessionDateTime = useMemo(() => {
    if (!selectedSession) return '';
    const [y, m, d] = selectedSession.dateIso.split('-').map(Number);
    const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }).format(
      new Date(Date.UTC(y, m - 1, d, 12))
    );
    const endHour = Math.min(23, selectedSession.startHour + Math.floor(selectedSession.durationHours));
    const endLabel = `${String(endHour).padStart(2, '0')}:${String(selectedSession.startMinute).padStart(2, '0')}`;
    return `${dateLabel} • ${selectedSession.timeLabel} - ${endLabel}`;
  }, [selectedSession, locale]);

  function sessionStatusLabel(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (isSessionPendingApproval(status)) return t.get('cpc.agenda.pending.statusLabel');
    if (normalized.indexOf('cancel') !== -1) return t.get('cpc.sessions.status.cancelled');
    if (normalized.indexOf('compl') !== -1 || normalized.indexOf('concl') !== -1 || normalized.indexOf('done') !== -1)
      return t.get('cpc.sessions.status.completed');
    if (normalized.indexOf('progress') !== -1 || normalized.indexOf('curso') !== -1) return t.get('cpc.sessions.status.in_progress');
    return t.get('cpc.sessions.status.scheduled');
  }

  function openSession(id: string) {
    setSelectedSessionId(id);
    setEventInfoOpen(true);
  }

  function goToDay(iso: string) {
    setAnchorIso(iso);
    setView('week');
  }

  function shiftPeriod(direction: -1 | 1) {
    setAnchorIso((prev) => (view === 'week' ? addCalendarDaysIso(prev, direction * 7) : addCalendarMonthsIso(prev, direction)));
  }

  function handleSessionCreated(payload: {
    id: string;
    migrantId: string;
    personName: string;
    category: CreateAgendaCategory;
    serviceLabel: string;
    specialistId: string | null;
    specialistName: string | null;
    dateIso: string;
    timeLabel: string;
  }) {
    const { hour, minute } = parseTime(payload.timeLabel);
    const color = CATEGORY_COLOR[payload.category];
    setSessions((prev) => [
      ...prev,
      {
        id: payload.id,
        migrantId: payload.migrantId,
        personName: payload.personName,
        category: payload.category,
        color,
        serviceLabel: payload.serviceLabel,
        specialistName: payload.specialistName,
        status: 'Agendada',
        meetingUrl: null,
        dateIso: payload.dateIso,
        timeLabel: payload.timeLabel,
        startHour: hour,
        startMinute: minute,
        durationHours: 1,
      },
    ]);
    setAnchorIso(payload.dateIso);
    setView('week');
  }

  async function handleApprovePending(requestId: string) {
    if (!canModerateRequests || processingRequestId) return;
    const pending = pendingRequests.find((request) => request.id === requestId);
    if (!pending) return;
    setProcessingRequestId(requestId);
    try {
      await updateDocument('sessions', requestId, {
        status: SESSION_STATUS_SCHEDULED,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.uid ?? null,
      });
      const approvedDoc = await getDocument<SessionDoc>('sessions', requestId);
      if (approvedDoc) {
        const nameMap = new Map<string, string>();
        if (approvedDoc.migrant_id) nameMap.set(approvedDoc.migrant_id, pending.person);
        setSessions((prev) => [...prev, buildAgendaSession({ ...approvedDoc, status: SESSION_STATUS_SCHEDULED }, nameMap)]);
      }
      setPendingRequests((prev) => prev.filter((request) => request.id !== requestId));
      toast({ title: t.get('cpc.agenda.pending.approveSuccess') });
    } catch (error) {
      console.error('Erro ao aprovar pedido', error);
      toast({ title: t.get('cpc.agenda.pending.approveError'), variant: 'destructive' });
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleDeclinePending(requestId: string) {
    if (!canModerateRequests || processingRequestId) return;
    setProcessingRequestId(requestId);
    try {
      await updateDocument('sessions', requestId, {
        status: SESSION_STATUS_REJECTED,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.uid ?? null,
      });
      setPendingRequests((prev) => prev.filter((request) => request.id !== requestId));
      toast({ title: t.get('cpc.agenda.pending.declineSuccess') });
    } catch (error) {
      console.error('Erro ao recusar pedido', error);
      toast({ title: t.get('cpc.agenda.pending.declineError'), variant: 'destructive' });
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleCancelSession() {
    if (!selectedSession || cancelling) return;
    setCancelling(true);
    try {
      await updateDocument('sessions', selectedSession.id, { status: 'cancelled' });
      setSessions((prev) => prev.filter((session) => session.id !== selectedSession.id));
      setEventInfoOpen(false);
      toast({ title: t.get('cpc.agenda.event.cancelSuccess') });
    } catch (error) {
      console.error('Erro ao cancelar sessão', error);
      toast({ title: t.get('cpc.agenda.event.cancelError'), variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (!sessionRecordOpen) return;
    const handle = window.setTimeout(() => {
      setLastAutosavedAt(Date.now());
    }, 900);
    return () => {
      window.clearTimeout(handle);
    };
  }, [sessionNotes, sessionRecordOpen]);

  const lastAutosavedLabel = useMemo(() => {
    if (!lastAutosavedAt) return t.get('cpc.agenda.sessionRecord.notes.lastAutosaved', { relative: t.get('cpc.agenda.sessionRecord.notes.justNow') });
    const diffMs = Math.max(0, Date.now() - lastAutosavedAt);
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1) return t.get('cpc.agenda.sessionRecord.notes.lastAutosaved', { relative: t.get('cpc.relative.days', { count: days }) });
    if (hours >= 1) return t.get('cpc.agenda.sessionRecord.notes.lastAutosaved', { relative: t.get('cpc.relative.hours', { count: hours }) });
    if (minutes >= 1) return t.get('cpc.agenda.sessionRecord.notes.lastAutosaved', { relative: t.get('cpc.relative.minutes', { count: minutes }) });
    return t.get('cpc.agenda.sessionRecord.notes.lastAutosaved', { relative: t.get('cpc.agenda.sessionRecord.notes.justNow') });
  }, [lastAutosavedAt, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.agenda.page.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.agenda.page.subtitle')}</p>
        </div>
      </div>

      <Dialog open={eventInfoOpen} onOpenChange={setEventInfoOpen}>
        <DialogContent
          hideClose
          className="z-[9999] w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-2xl border bg-white p-0 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <Badge className={cn('h-6 rounded-md px-2 text-[11px] font-semibold', categoryBadgeClass(selectedSession?.category ?? 'collective'))}>
                {t.get(`cpc.agenda.sessionTypes.${selectedSession?.category ?? 'collective'}`)}
              </Badge>
              <h2 className="mt-2 text-lg font-semibold leading-tight text-slate-900">{selectedSessionTitle}</h2>
            </div>
            <DialogClose
              aria-label={t.get('cpc.agenda.eventModal.close')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </DialogClose>
          </div>

          <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[15px] font-semibold text-slate-600">
                {(selectedSession?.personName || t.get('cpc.agenda.event.unknownPerson'))
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w.charAt(0))
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{selectedSession?.personName || t.get('cpc.agenda.event.unknownPerson')}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-emerald-600">{sessionStatusLabel(selectedSession?.status ?? null)}</span>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-400" /> {selectedSessionDateTime}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />{' '}
                {selectedSession?.specialistName?.trim() || t.get('cpc.agenda.event.noSpecialist')}
              </p>
              {selectedSession?.meetingUrl ? (
                <a
                  href={selectedSession.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-semibold text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> {t.get('cpc.agenda.event.join')}
                </a>
              ) : null}
            </div>
          </div>

          <div className="border-t px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-9 flex-1 rounded-lg border-slate-200 text-sm font-semibold text-slate-700"
                onClick={() => {
                  setEventInfoOpen(false);
                  setSessionRecordOpen(true);
                }}
              >
                {t.get('cpc.agenda.sessionRecord.open')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-9 flex-1 rounded-lg border-red-100 bg-red-50 text-sm font-semibold text-red-500 hover:bg-red-100"
                disabled={cancelling}
                onClick={handleCancelSession}
              >
                {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t.get('cpc.agenda.actions.cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sessionRecordOpen}
        onOpenChange={(open) => {
          setSessionRecordOpen(open);
          if (!open) {
            setSessionNotes('');
            setSessionUrgent(false);
            setRecommendedTrack('');
            setImmediateNextStep('');
            setLastAutosavedAt(Date.now() - 2 * 60 * 1000);
          }
        }}
      >
        <DialogContent hideClose className="h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-hidden border-0 bg-slate-50 p-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b bg-white px-4 py-4 sm:px-6">
              <div className="text-xs font-medium text-slate-500">
                <span>{t.get('cpc.agenda.sessionRecord.breadcrumbs.home')}</span>
                <span className="mx-2 text-slate-300">/</span>
                <span>{t.get('cpc.agenda.sessionRecord.breadcrumbs.migrants')}</span>
                <span className="mx-2 text-slate-300">/</span>
                <span className="font-semibold text-slate-700">{t.get('cpc.agenda.sessionRecord.profile.name')}</span>
                <span className="mx-2 text-slate-300">/</span>
                <span>{t.get('cpc.agenda.sessionRecord.breadcrumbs.record')}</span>
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-[28px]">{t.get('cpc.agenda.sessionRecord.header.title')}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {t.get('cpc.agenda.sessionRecord.header.dateTime')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-400" />
                      {t.get('cpc.agenda.sessionRecord.header.tech')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="h-9 shrink-0 rounded-lg border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  onClick={() => setLastAutosavedAt(Date.now())}
                >
                  {t.get('cpc.agenda.sessionRecord.header.saveDraft')}
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-6">
                  <section className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-slate-100 text-sm font-semibold text-slate-600">
                            {t.get('cpc.agenda.sessionRecord.profile.initials')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-slate-900">{t.get('cpc.agenda.sessionRecord.profile.name')}</h2>
                          <Badge variant="secondary" className="h-5 rounded-full bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700">
                            {t.get('cpc.agenda.sessionRecord.profile.statusActive')}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t.get('cpc.agenda.sessionRecord.profile.idLabel')} <span className="font-semibold text-slate-600">{t.get('cpc.agenda.sessionRecord.profile.idValue')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.get('cpc.agenda.sessionRecord.needs.title')}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          {t.get('cpc.agenda.sessionRecord.needs.languageSupport')}
                        </Badge>
                        <Badge variant="secondary" className="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                          {t.get('cpc.agenda.sessionRecord.needs.cvWorkshop')}
                        </Badge>
                        <Badge variant="secondary" className="rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
                          {t.get('cpc.agenda.sessionRecord.needs.housing')}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.get('cpc.agenda.sessionRecord.screening.title')}</h3>
                      <div className="mt-3 rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                        <p>{t.get('cpc.agenda.sessionRecord.screening.p1')}</p>
                        <p className="mt-3">
                          <span className="font-semibold text-slate-700">{t.get('cpc.agenda.sessionRecord.screening.primaryChallengeLabel')}</span> {t.get('cpc.agenda.sessionRecord.screening.primaryChallengeText')}
                        </p>
                        <p className="mt-3">{t.get('cpc.agenda.sessionRecord.screening.p2')}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">{t.get('cpc.agenda.sessionRecord.activity.title')}</h3>
                    <div className="mt-4 space-y-4">
                      <div className="flex gap-3">
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">{t.get('cpc.agenda.sessionRecord.activity.item1.date')}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{t.get('cpc.agenda.sessionRecord.activity.item1.title')}</p>
                          <p className="mt-1 text-xs font-semibold text-emerald-600">{t.get('cpc.agenda.sessionRecord.activity.item1.status')}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">{t.get('cpc.agenda.sessionRecord.activity.item2.date')}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{t.get('cpc.agenda.sessionRecord.activity.item2.title')}</p>
                          <p className="mt-1 text-xs text-slate-500">{t.get('cpc.agenda.sessionRecord.activity.item2.meta')}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                          <AlignLeft className="h-4 w-4" />
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900">{t.get('cpc.agenda.sessionRecord.notes.title')}</h3>
                      </div>
                      <div className="inline-flex items-center rounded-lg border bg-white p-1">
                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50" aria-label={t.get('cpc.agenda.sessionRecord.notes.toolbar.bold')}>
                          <Bold className="h-4 w-4" />
                        </button>
                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50" aria-label={t.get('cpc.agenda.sessionRecord.notes.toolbar.italic')}>
                          <Italic className="h-4 w-4" />
                        </button>
                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50" aria-label={t.get('cpc.agenda.sessionRecord.notes.toolbar.bullets')}>
                          <List className="h-4 w-4" />
                        </button>
                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50" aria-label={t.get('cpc.agenda.sessionRecord.notes.toolbar.ordered')}>
                          <ListOrdered className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="px-5 py-4">
                      <textarea
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder={t.get('cpc.agenda.sessionRecord.notes.placeholder')}
                        className="min-h-[260px] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-400">{lastAutosavedLabel}</p>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Checkbox checked={sessionUrgent} onCheckedChange={(v) => setSessionUrgent(Boolean(v))} />
                        {t.get('cpc.agenda.sessionRecord.notes.urgent')}
                      </label>
                    </div>
                  </section>

                  <section className="rounded-xl border bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">{t.get('cpc.agenda.sessionRecord.outcomes.title')}</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">{t.get('cpc.agenda.sessionRecord.outcomes.recommendTrack')}</p>
                        <Select value={recommendedTrack} onValueChange={setRecommendedTrack}>
                          <SelectTrigger className="mt-2 h-10 border-slate-200">
                            <SelectValue placeholder={t.get('cpc.agenda.sessionRecord.outcomes.selectTrackPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="language">{t.get('cpc.agenda.sessionRecord.outcomes.track.language')}</SelectItem>
                            <SelectItem value="career">{t.get('cpc.agenda.sessionRecord.outcomes.track.career')}</SelectItem>
                            <SelectItem value="legal">{t.get('cpc.agenda.sessionRecord.outcomes.track.legal')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">{t.get('cpc.agenda.sessionRecord.outcomes.immediateNextStep')}</p>
                        <Select value={immediateNextStep} onValueChange={setImmediateNextStep}>
                          <SelectTrigger className="mt-2 h-10 border-slate-200">
                            <SelectValue placeholder={t.get('cpc.agenda.sessionRecord.outcomes.selectNextPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="schedule">{t.get('cpc.agenda.sessionRecord.outcomes.next.schedule')}</SelectItem>
                            <SelectItem value="docs">{t.get('cpc.agenda.sessionRecord.outcomes.next.docs')}</SelectItem>
                            <SelectItem value="referral">{t.get('cpc.agenda.sessionRecord.outcomes.next.referral')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <Button
                        className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold hover:bg-blue-700"
                        onClick={() => setSessionRecordOpen(false)}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {t.get('cpc.agenda.sessionRecord.outcomes.finalize')}
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex w-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm [overflow-wrap:anywhere]">
      <section className="w-full shrink-0 border-b bg-white" data-testid="cpc-agenda-pending-section">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 md:px-5 md:py-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold leading-none text-slate-900 md:text-xl">{t.get('cpc.agenda.pending.title')}</h2>
            {pendingRequests.length > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 px-1.5 text-xs font-semibold text-orange-700">
                {pendingRequests.length}
              </span>
            ) : null}
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 md:px-5">{t.get('cpc.agenda.pending.empty')}</div>
        ) : (
        <div className="grid w-full grid-cols-1 gap-4 p-4 md:p-5 lg:grid-cols-3">
          {pendingRequests.map((request) => (
              <article key={request.id} className="rounded-xl border p-3 shadow-sm transition-all hover:shadow-md break-words">
                <div className="flex items-center justify-between">
                  <Badge className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', categoryBadgeClass(request.category))}>
                    {t.get(`cpc.agenda.sessionTypes.${request.category}`)}
                  </Badge>
                  <span className="text-xs text-slate-400">{request.timeAgo}</span>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug text-slate-900 md:text-base">{request.title}</h3>
                <p className="mt-1 text-xs text-slate-500 md:text-sm">
                  {request.person}{' '}
                  <span className="text-slate-400">
                    ({request.specialistName || t.get('cpc.agenda.pending.requestSource')})
                  </span>
                </p>
                <p className="mt-3 text-xs text-slate-500 md:text-sm">{request.when}</p>
                {canModerateRequests ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      className="h-8 flex-1 rounded-md text-xs font-semibold md:h-9 md:text-sm"
                      disabled={processingRequestId === request.id}
                      onClick={() => void handleDeclinePending(request.id)}
                    >
                      <X className="mr-1 h-4 w-4" />
                      {t.get('cpc.agenda.actions.decline')}
                    </Button>
                    <Button
                      className="h-8 flex-1 rounded-md bg-blue-600 text-xs font-semibold hover:bg-blue-700 md:h-9 md:text-sm"
                      disabled={processingRequestId === request.id}
                      onClick={() => void handleApprovePending(request.id)}
                    >
                      {processingRequestId === request.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                      {t.get('cpc.agenda.actions.approve')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-medium text-slate-500">{t.get('cpc.agenda.pending.noPermission')}</p>
                )}
              </article>
          ))}
        </div>
        )}
      </section>

      <div className="w-full min-w-0" data-testid="cpc-agenda-calendar-section">
          {/* Ajuste: topo sem scroll vertical e com layout estável por breakpoint (390/768/1366) */}
          <div className="overflow-hidden border-b px-3 py-3 sm:px-4 lg:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:flex-nowrap">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                aria-label={t.get('cpc.agenda.header.previous')}
                onClick={() => shiftPeriod(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                aria-label={t.get('cpc.agenda.header.next')}
                onClick={() => shiftPeriod(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
                <h2 className="truncate text-lg font-semibold capitalize leading-none tracking-tight text-slate-900 sm:text-xl md:text-2xl">{periodTitle}</h2>
                <Button
                  variant="outline"
                  className="h-8 rounded-lg border-slate-200 px-3.5 text-xs font-semibold md:h-9 md:text-sm"
                  onClick={() => setAnchorIso(todayIso)}
                >
                  {t.get('cpc.agenda.header.today')}
                </Button>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-nowrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 rounded-lg border-slate-200 px-3.5 text-xs font-semibold text-slate-700 md:h-9 md:text-sm">
                      <Filter className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                      {categoryFilter === 'all'
                        ? t.get('cpc.agenda.header.filterBy')
                        : t.get(`cpc.agenda.sessionTypes.${categoryFilter}`)}
                      <ChevronDown className="ml-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>{t.get('cpc.agenda.filter.title')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as 'all' | AgendaCategory)}>
                      <DropdownMenuRadioItem value="all">{t.get('cpc.agenda.filter.all')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="legal">{t.get('cpc.agenda.sessionTypes.legal')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="psychology">{t.get('cpc.agenda.sessionTypes.psychology')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="mediation">{t.get('cpc.agenda.sessionTypes.mediation')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="collective">{t.get('cpc.agenda.sessionTypes.collective')}</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="inline-flex rounded-lg bg-slate-100 p-1">
                  <button
                    onClick={() => setView('week')}
                    className={cn(
                      'h-7 rounded-md px-3 text-xs font-semibold transition-all md:h-8 md:px-4 md:text-sm',
                      view === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    )}
                  >
                    {t.get('cpc.agenda.header.week')}
                  </button>
                  <button
                    onClick={() => setView('month')}
                    className={cn(
                      'h-7 rounded-md px-3 text-xs font-semibold transition-all md:h-8 md:px-4 md:text-sm',
                      view === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    )}
                  >
                    {t.get('cpc.agenda.header.month')}
                  </button>
                </div>
                <Button
                  className="h-8 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold hover:bg-blue-700 md:h-9 md:px-5 md:text-sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4" />
                  {t.get('cpc.agenda.header.newSession')}
                </Button>
              </div>
            </div>
          </div>

          {loadingSessions ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t.get('cpc.agenda.calendar.loading')}
            </div>
          ) : view === 'week' ? (
            <div className="relative overflow-x-auto overflow-y-hidden">
              <div className="min-w-[980px]">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: '64px repeat(7, minmax(130px, 1fr))',
                  }}
                >
                  <div className="h-[72px] border-b border-r" />
                  {weekDays.map((day) => (
                    <div key={day.iso} className="flex h-[72px] flex-col items-center justify-center border-b border-r">
                      <span className="text-[11px] font-semibold tracking-wide text-slate-400">{day.short}</span>
                      <span
                        className={cn(
                          'mt-1 text-xl font-semibold leading-none text-slate-900 md:text-2xl',
                          day.isToday && 'rounded-full bg-blue-600 px-2.5 py-1 text-white'
                        )}
                      >
                        {day.dayNum}
                      </span>
                    </div>
                  ))}

                  {hours.map((hour) => (
                    <div key={hour} className="contents">
                      <div className="h-[74px] border-b border-r px-2 py-3 text-right text-xs font-semibold text-slate-400">{hour}</div>
                      {weekDays.map((day) => {
                        const hourNumber = Number(hour.slice(0, 2));
                        const matches = (sessionsByDay.get(day.iso) ?? []).filter((session) => session.startHour === hourNumber);
                        return (
                          <div key={`${hour}-${day.iso}`} className="relative h-[74px] border-b border-r overflow-hidden">
                            {matches.map((session, matchIndex) => {
                              const stackCount = matches.length;
                              let eventTop = 2;
                              let eventHeight = ROW_HEIGHT - 4;
                              if (stackCount === 1) {
                                eventTop = 2 + (session.startMinute / 60) * ROW_HEIGHT;
                                eventHeight = Math.max(14, ROW_HEIGHT - 4 - (session.startMinute / 60) * ROW_HEIGHT);
                              } else {
                                const slotHeight = (ROW_HEIGHT - 4) / stackCount;
                                eventTop = 2 + matchIndex * slotHeight;
                                eventHeight = Math.max(14, slotHeight - 2);
                              }
                              return (
                              <button
                                key={session.id}
                                onClick={() => openSession(session.id)}
                                className={cn(
                                  'absolute inset-x-0.5 z-20 overflow-hidden rounded border-l-[3px] px-1 py-0.5 text-left transition-all hover:z-30 hover:shadow-sm',
                                  eventClass(session.color, selectedSessionId === session.id)
                                )}
                                style={{ top: eventTop, height: `${eventHeight}px` }}
                              >
                                <p className="text-[10px] font-semibold leading-tight text-slate-800 line-clamp-1">
                                  {session.serviceLabel?.trim() || t.get(`cpc.agenda.sessionTypes.${session.category}`)}
                                </p>
                                <p className="mt-0.5 truncate text-[9px] leading-tight text-slate-600">
                                  {session.personName || session.timeLabel}
                                </p>
                              </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {nowLineVisible ? (
                  <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{ top: nowLineTop }}>
                    <span className="absolute -left-1 -top-[5px] inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
                {WEEKDAY_KEYS.map((key) => (
                  <div key={key} className="rounded-lg border bg-slate-50 py-2">{t.get(`cpc.agenda.weekdays.${key}`)}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {monthCells.map((iso) => {
                  const inMonth = Number(iso.slice(5, 7)) === anchorMonth;
                  const isToday = iso === todayIso;
                  const daySessions = sessionsByDay.get(iso) ?? [];
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => goToDay(iso)}
                      className={cn(
                        'flex h-24 flex-col rounded-lg border p-2 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40',
                        inMonth ? 'bg-white text-slate-700' : 'bg-slate-50 text-slate-400'
                      )}
                    >
                      <span
                        className={cn(
                          'ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold',
                          isToday ? 'bg-blue-600 text-white' : ''
                        )}
                      >
                        {Number(iso.slice(8, 10))}
                      </span>
                      <div className="mt-1 flex flex-col gap-1 overflow-hidden">
                        {daySessions.slice(0, 2).map((session) => (
                          <span key={session.id} className="flex items-center gap-1 truncate text-[10px] text-slate-600">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', categoryDotClass(session.category))} />
                            <span className="truncate">
                              <span className="font-medium">{session.timeLabel}</span>{' '}
                              {session.personName || t.get(`cpc.agenda.sessionTypes.${session.category}`)}
                            </span>
                          </span>
                        ))}
                        {daySessions.length > 2 ? (
                          <span className="text-[11px] font-semibold text-slate-400">
                            {t.get('cpc.agenda.calendar.more', { count: daySessions.length - 2 })}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
      </div>

      <CpcCreateSessionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultDateIso={anchorIso}
        onCreated={handleSessionCreated}
      />
    </div>
    </div>
  );
}
