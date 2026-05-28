import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, XCircle, PlusCircle, Scale, Heart, Users, Video, ArrowRight, List } from 'lucide-react';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { isSameDay } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getCalendarDateIsoInTimeZone, todayIsoAppCalendar } from '@/lib/appCalendar';
import BookingSessionWizardDialog, {
  BOOKING_SERVICES,
  BOOKING_SPECIALISTS,
  type BookingServiceId,
  type BookingWizardStep,
  type BookingWizardPreset,
} from './BookingSessionWizardDialog';

export {
  BookingConfirmationStep,
  BookingDateTimeStep,
  BookingServiceStep,
  BookingSpecialistStep,
} from './BookingSessionWizardDialog';
export type { BookingServiceOption, BookingSpecialistOption } from './BookingSessionWizardDialog';

type SessionItem = {
  id: string;
  session_type: 'mediador' | 'jurista' | 'psicologa' | 'coletiva';
  scheduled_date: string;
  scheduled_time: string;
  status: string | null;
  service_id?: string;
  service_label?: string;
  specialist_id?: string;
  specialist_name?: string;
  meeting_url?: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0)).join('').toUpperCase();
}

function formatPtDate(date: Date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function sessionStatusUi(status: SessionItem['status']) {
  const raw = (status ?? '').toString().trim();
  const normalized = raw.toLowerCase();

  if (!normalized) {
    return { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }

  if (normalized.includes('cancel') || normalized === 'canceled' || normalized === 'cancelled') {
    return { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  if (normalized.includes('concl') || normalized.includes('completed') || normalized.includes('done')) {
    return { label: 'Concluída', className: 'bg-blue-50 text-blue-700 border-blue-100' };
  }

  if (normalized.includes('pend') || normalized.includes('approval') || normalized.includes('aprov')) {
    return { label: 'Em aprovação', className: 'bg-orange-50 text-orange-700 border-orange-100' };
  }

  return { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}

function serviceIcon(serviceId: BookingServiceId | null) {
  if (serviceId === 'legal') return <Scale className="h-7 w-7 text-blue-600" />;
  if (serviceId === 'psychology') return <Heart className="h-7 w-7 text-violet-600" />;
  return <Users className="h-7 w-7 text-cyan-600" />;
}

function resolveServiceIdFromSession(session: SessionItem): BookingServiceId | null {
  if (session.service_id === 'legal' || session.service_id === 'psychology' || session.service_id === 'mediation') return session.service_id;
  if (session.session_type === 'jurista') return 'legal';
  if (session.session_type === 'psicologa') return 'psychology';
  if (session.session_type === 'mediador') return 'mediation';
  return null;
}

function serviceDescription(serviceId: BookingServiceId | null) {
  if (!serviceId) return '';
  return BOOKING_SERVICES.find((s) => s.id === serviceId)?.description ?? '';
}

export default function SessionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<SessionItem>>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookingPreset, setBookingPreset] = useState<BookingWizardPreset>({});
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      setLoading(true);
      try {
        const typed = await queryDocuments<SessionItem>(
          'sessions',
          [{ field: 'migrant_id', operator: '==', value: user.uid }],
          { field: 'scheduled_date', direction: 'asc' }
        );
        setSessions(typed);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [user]);

  const filtered = sessions;

  const daysWithSessions = useMemo(() => {
    const set = new Map<string, Date>();
    filtered.forEach((s) => {
      try {
        const key = /^\d{4}-\d{2}-\d{2}$/.test(s.scheduled_date)
          ? s.scheduled_date
          : getCalendarDateIsoInTimeZone(new Date(s.scheduled_date));
        if (!set.has(key)) {
          const [y, m, d] = key.split('-').map(Number);
          set.set(key, new Date(y, m - 1, d));
        }
      } catch {
        /* ignore */
      }
    });
    return Array.from(set.values());
  }, [filtered]);

  const selectedDaySessions = useMemo(() => {
    return filtered.filter((s) => isSameDay(new Date(s.scheduled_date), selectedDate));
  }, [filtered, selectedDate]);

  const upcomingSessions = useMemo(() => {
    const today = todayIsoAppCalendar();
    return filtered.filter(s => s.scheduled_date >= today);
  }, [filtered]);

  const pastSessions = useMemo(() => {
    const today = todayIsoAppCalendar();
    return filtered.filter(s => s.scheduled_date < today).reverse();
  }, [filtered]);


  async function updateStatus(id: string, status: 'Concluída' | 'Cancelada') {
    await updateDocument('sessions', id, { status });
    const next = sessions.map(s => (s.id === id ? { ...s, status } : s));
    setSessions(next);
  }

  function openBookingWizard(opts?: { serviceId?: BookingServiceId; specialistId?: string; step?: BookingWizardStep; rescheduleFromId?: string | null }) {
    setBookingPreset({
      step: opts?.step ?? 1,
      serviceId: opts?.serviceId ?? null,
      specialistId: opts?.specialistId ?? null,
      rescheduleFromSessionId: opts?.rescheduleFromId ?? null,
    });
    setBookOpen(true);
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Minhas Sessões</h1>
          <p className="mt-2 text-sm text-slate-600">Gerencie suas próximas marcações e histórico.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex w-full items-center rounded-xl border bg-white p-1 shadow-sm sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none',
                viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none',
                viewMode === 'calendar' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              Calendário
            </button>
          </div>

          <Button onClick={() => openBookingWizard({ step: 1 })} className="h-11 rounded-xl px-5 text-sm font-semibold">
            <PlusCircle className="mr-2 h-4 w-4" />
            Marcar sessão
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Minhas próximas sessões</h2>
              <button
                type="button"
                onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Ver histórico <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map((s) => {
                  const svcId = resolveServiceIdFromSession(s);
                  const statusUi = sessionStatusUi(s.status);
                  const canJoin = !!s.meeting_url && (s.status ?? 'Agendada') === 'Agendada';
                  const canReschedule = (s.status ?? 'Agendada') === 'Agendada';
                  const canCancel = (s.status ?? 'Agendada') === 'Agendada';
                  const title = s.service_label ?? (svcId ? (BOOKING_SERVICES.find((x) => x.id === svcId)?.title ?? s.session_type) : s.session_type);

                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl', svcId === 'legal' ? 'bg-blue-50' : svcId === 'psychology' ? 'bg-violet-50' : 'bg-cyan-50')}>
                            {serviceIcon(svcId)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-slate-900">{title}</p>
                              <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusUi.className)}>
                                {statusUi.label}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{serviceDescription(svcId)}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                              <span className="inline-flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-slate-400" />
                                {new Date(s.scheduled_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit' })}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" />
                                {s.scheduled_time}
                              </span>
                              {s.specialist_name ? (
                                <span className="inline-flex items-center gap-2">
                                  <Users className="h-4 w-4 text-slate-400" />
                                  {s.specialist_name}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          {canReschedule ? (
                            <Button
                              variant="outline"
                              className="h-10 rounded-xl px-5 text-sm font-semibold"
                              onClick={() => openBookingWizard({ step: 3, serviceId: svcId ?? undefined, specialistId: s.specialist_id, rescheduleFromId: s.id })}
                            >
                              Reagendar
                            </Button>
                          ) : null}

                          {canJoin ? (
                            <Button
                              className="h-10 rounded-xl px-5 text-sm font-semibold"
                              onClick={() => window.open(s.meeting_url as string, '_blank', 'noopener,noreferrer')}
                            >
                              <Video className="mr-2 h-4 w-4" />
                              Entrar em vídeo
                            </Button>
                          ) : canCancel ? (
                            <Button
                              variant="outline"
                              className="h-10 rounded-xl px-5 text-sm font-semibold"
                              onClick={() => updateStatus(s.id, 'Cancelada')}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancelar
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sem sessões futuras.</div>
              )}
            </div>
          </section>

          <section className="space-y-4" ref={historyRef}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Histórico</h2>
            </div>

            <div className="grid gap-3">
              {pastSessions.length > 0 ? (
                pastSessions.map((s) => {
                  const svcId = resolveServiceIdFromSession(s);
                  const statusUi = sessionStatusUi(s.status);
                  const title = s.service_label ?? (svcId ? (BOOKING_SERVICES.find((x) => x.id === svcId)?.title ?? s.session_type) : s.session_type);
                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusUi.className)}>
                            {statusUi.label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-slate-400" />
                            {new Date(s.scheduled_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit' })}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            {s.scheduled_time}
                          </span>
                          {s.specialist_name ? (
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              {s.specialist_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sem histórico.</div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Especialistas disponíveis</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BOOKING_SERVICES.map((svc) => {
                const topBg =
                  svc.id === 'mediation' ? 'bg-gradient-to-r from-blue-400 to-cyan-300' :
                  svc.id === 'legal' ? 'bg-gradient-to-r from-slate-700 to-slate-500' :
                  'bg-gradient-to-r from-violet-400 to-pink-300';

                const roleLabel = svc.id === 'mediation' ? 'Mediador social' : svc.id === 'legal' ? 'Consultor jurídico' : 'Psicólogo';
                const categoryLabel = svc.id === 'mediation' ? 'Apoio à integração' : svc.id === 'legal' ? 'Apoio legal' : 'Saúde mental';

                return (
                  <div key={svc.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className={cn('h-24', topBg)} />
                    <div className="px-5 pb-5">
                      <div className="-mt-9 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white shadow-sm">
                        {serviceIcon(svc.id)}
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-slate-900">{roleLabel}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{categoryLabel}</p>
                      <p className="mt-4 text-sm leading-relaxed text-slate-600">{svc.description}</p>
                      <Button
                        className="mt-6 h-11 w-full rounded-xl text-sm font-semibold"
                        onClick={() => openBookingWizard({ serviceId: svc.id, step: 2 })}
                      >
                        Marcar sessão
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Calendário</h2>
            <p className="mt-1 text-sm text-slate-600">Selecione um dia para ver as sessões.</p>
            <div className="mt-4 rounded-xl border">
              <UICalendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => setSelectedDate(d || selectedDate)}
                modifiers={{ hasSession: daysWithSessions }}
                modifiersClassNames={{ hasSession: 'ring-1 ring-primary' }}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Sessões do dia</h2>
              <span className="text-xs font-semibold text-slate-500">{selectedDaySessions.length} sessões</span>
            </div>
            <div className="mt-4 grid gap-3">
              {selectedDaySessions.length > 0 ? (
                selectedDaySessions.map((s) => {
                  const svcId = resolveServiceIdFromSession(s);
                  const statusUi = sessionStatusUi(s.status);
                  const title = s.service_label ?? (svcId ? (BOOKING_SERVICES.find((x) => x.id === svcId)?.title ?? s.session_type) : s.session_type);
                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{title}</p>
                            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusUi.className)}>
                              {statusUi.label}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              {s.scheduled_time}
                            </span>
                            {s.specialist_name ? (
                              <span className="inline-flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-400" />
                                {s.specialist_name}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', svcId === 'legal' ? 'bg-blue-50' : svcId === 'psychology' ? 'bg-violet-50' : 'bg-cyan-50')}>
                          {serviceIcon(svcId)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sem sessões neste dia.</div>
              )}
            </div>
          </div>
        </section>
      )}

      <BookingSessionWizardDialog
        open={bookOpen}
        onOpenChange={(next) => {
          setBookOpen(next);
          if (!next) setBookingPreset({});
        }}
        userId={user?.uid ?? null}
        preset={bookingPreset}
        onBooked={async () => {
          if (!user) return;
          const typed = await queryDocuments<SessionItem>(
            'sessions',
            [{ field: 'migrant_id', operator: '==', value: user.uid }],
            { field: 'scheduled_date', direction: 'asc' }
          );
          setSessions(typed);
        }}
      />
    </div>
  );
}
