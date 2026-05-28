import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertTriangle,
  AlignLeft,
  Bold,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Italic,
  List,
  ListOrdered,
  MapPin,
  Plus,
  Save,
  User,
  X,
} from 'lucide-react';

type CalendarEvent = {
  id: string;
  title: string;
  subtitle: string;
  person: string;
  specialist: string;
  tag: string;
  dayIndex: number;
  startHour: number;
  durationHours: number;
  color: 'blue' | 'green' | 'purple';
};

type PendingRequest = {
  id: string;
  category: string;
  categoryClassName: string;
  title: string;
  person: string;
  team: string;
  when: string;
  timeAgo: string;
  action: 'approve' | 'assign';
  urgent?: string;
};

const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

const events: CalendarEvent[] = [
  {
    id: 'legal-consult',
    title: 'Legal Consultation',
    subtitle: 'M. Al-Fayed (ID ...',
    person: 'M. Al-Fayed',
    specialist: 'Specialist J. Perez',
    tag: 'LEGAL',
    dayIndex: 0,
    startHour: 9,
    durationHours: 1.5,
    color: 'blue',
  },
  {
    id: 'initial-assessment',
    title: 'Initial Assessment',
    subtitle: 'S. Kovacs (ID ...',
    person: 'S. Kovacs',
    specialist: 'Dr. M. Garcia',
    tag: 'PSYCHOLOGY',
    dayIndex: 1,
    startHour: 11,
    durationHours: 1.25,
    color: 'purple',
  },
  {
    id: 'family-mediation',
    title: 'Family Mediation',
    subtitle: 'Family H. (Case...',
    person: 'Family H.',
    specialist: 'Med. Team A',
    tag: 'MEDIATION',
    dayIndex: 2,
    startHour: 9,
    durationHours: 2,
    color: 'green',
  },
  {
    id: 'workplace-conflict',
    title: 'Workplace conflict',
    subtitle: 'Case #9912',
    person: 'Case #9912',
    specialist: 'Med. Team B',
    tag: 'MEDIATION',
    dayIndex: 4,
    startHour: 9,
    durationHours: 2,
    color: 'green',
  },
  {
    id: 'follow-up',
    title: 'Follow-up',
    subtitle: 'L. Dubois (ID: 4...',
    person: 'Lucas Dubois',
    specialist: 'Dr. A. Rossi',
    tag: 'PSYCHOLOGY',
    dayIndex: 2,
    startHour: 13,
    durationHours: 1,
    color: 'purple',
  },
];

const pendingRequests: PendingRequest[] = [
  {
    id: 'r1',
    category: 'LEGAL',
    categoryClassName: 'bg-blue-50 text-blue-600',
    title: 'Residency Appeal Consult',
    person: 'Ahmed K.',
    team: 'Req. Front Desk',
    when: 'Mon, Oct 30 • 10:00 AM',
    timeAgo: '2h ago',
    action: 'approve',
  },
  {
    id: 'r2',
    category: 'PSYCHOLOGY',
    categoryClassName: 'bg-violet-50 text-violet-600',
    title: 'Emergency Counseling',
    person: 'Nia J.',
    team: 'Req. Social Worker',
    when: '',
    timeAgo: '5h ago',
    action: 'assign',
    urgent: 'Urgent: ASAP',
  },
  {
    id: 'r3',
    category: 'MEDIATION',
    categoryClassName: 'bg-emerald-50 text-emerald-600',
    title: 'Conflict Resolution',
    person: 'Marcus T.',
    team: 'Req. Housing',
    when: 'Wed, Nov 1 • 14:00 PM',
    timeAgo: '1d ago',
    action: 'approve',
  },
];

function eventClass(color: CalendarEvent['color'], selected: boolean): string {
  if (color === 'blue') return selected ? 'border-l-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-l-blue-500 bg-blue-50';
  if (color === 'green') return selected ? 'border-l-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-l-emerald-500 bg-emerald-50';
  return selected ? 'border-l-violet-500 bg-violet-50 ring-2 ring-violet-300' : 'border-l-violet-500 bg-violet-50';
}

export default function TeamAgendaPage() {
  const { t, language } = useLanguage();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [selectedEventId, setSelectedEventId] = useState<string>('follow-up');
  const [requestStatus, setRequestStatus] = useState<Record<string, 'pending' | 'approved' | 'declined' | 'assigned'>>({});
  const [eventInfoOpen, setEventInfoOpen] = useState(false);
  const [sessionRecordOpen, setSessionRecordOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionUrgent, setSessionUrgent] = useState(false);
  const [recommendedTrack, setRecommendedTrack] = useState<string>('');
  const [immediateNextStep, setImmediateNextStep] = useState<string>('');
  const [lastAutosavedAt, setLastAutosavedAt] = useState<number | null>(Date.now() - 2 * 60 * 1000);

  const locale = useMemo(() => {
    if (language === 'en') return 'en-GB';
    if (language === 'es') return 'es-ES';
    if (language === 'fr') return 'fr-FR';
    return 'pt-PT';
  }, [language]);

  const monthTitle = useMemo(() => {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(2023, 9, 1));
  }, [locale]);

  const weekdays = useMemo(
    () => [
      { short: t.get('cpc.agenda.weekdays.mon'), date: '23' },
      { short: t.get('cpc.agenda.weekdays.tue'), date: '24' },
      { short: t.get('cpc.agenda.weekdays.wed'), date: '25', isToday: true },
      { short: t.get('cpc.agenda.weekdays.thu'), date: '26' },
      { short: t.get('cpc.agenda.weekdays.fri'), date: '27' },
      { short: t.get('cpc.agenda.weekdays.sat'), date: '28' },
      { short: t.get('cpc.agenda.weekdays.sun'), date: '29' },
    ],
    [t]
  );

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) ?? null, [selectedEventId]);

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

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm [overflow-wrap:anywhere]">
      <Dialog open={eventInfoOpen} onOpenChange={setEventInfoOpen}>
        <DialogContent
          hideClose
          className="z-[9999] w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-2xl border bg-white p-0 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <Badge className="h-6 rounded-md bg-violet-50 px-2 text-[11px] font-semibold text-violet-600">{selectedEvent?.tag ?? ''}</Badge>
              <h2 className="mt-2 text-lg font-semibold leading-tight text-slate-900">{t.get('cpc.agenda.popover.title')}</h2>
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
                {t.get('cpc.agenda.popover.person')
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w.charAt(0))
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.get('cpc.agenda.popover.person')}</p>
                <p className="text-xs text-slate-500">
                  {t.get('cpc.agenda.popover.personMetaPrefix')} • <span className="font-semibold text-emerald-600">{t.get('cpc.agenda.popover.personMetaStatus')}</span>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-400" /> {t.get('cpc.agenda.popover.dateTime')}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" /> {t.get('cpc.agenda.popover.specialist')}
              </p>
              <p className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" /> {t.get('cpc.agenda.popover.notes')}
              </p>
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
              <Button variant="outline" className="h-9 flex-1 rounded-lg border-slate-200 text-sm font-semibold text-slate-700">
                {t.get('cpc.agenda.actions.reschedule')}
              </Button>
              <Button variant="outline" className="h-9 flex-1 rounded-lg border-red-100 bg-red-50 text-sm font-semibold text-red-500 hover:bg-red-100">
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 border-r">
          {/* Ajuste: topo sem scroll vertical e com layout estável por breakpoint (390/768/1366) */}
          <div className="overflow-hidden border-b px-3 py-3 sm:px-4 lg:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:flex-nowrap">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </button>
                <h2 className="truncate text-lg font-semibold capitalize leading-none tracking-tight text-slate-900 sm:text-xl md:text-2xl">{monthTitle}</h2>
                <Button variant="outline" className="h-8 rounded-lg border-slate-200 px-3.5 text-xs font-semibold md:h-9 md:text-sm">
                  {t.get('cpc.agenda.header.today')}
                </Button>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-nowrap">
                <Button variant="outline" className="h-8 rounded-lg border-slate-200 px-3.5 text-xs font-semibold text-slate-700 md:h-9 md:text-sm">
                  <Filter className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  {t.get('cpc.agenda.header.filterBy')}
                  <ChevronDown className="ml-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
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
                <Button className="h-8 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold hover:bg-blue-700 md:h-9 md:px-5 md:text-sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4" />
                  {t.get('cpc.agenda.header.newSession')}
                </Button>
              </div>
            </div>
          </div>

          {view === 'week' ? (
            <div className="relative overflow-x-auto overflow-y-hidden">
              <div className="min-w-[980px]">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: '64px repeat(7, minmax(130px, 1fr))',
                  }}
                >
                  <div className="h-[72px] border-b border-r" />
                  {weekdays.map((day) => (
                    <div key={day.date} className="flex h-[72px] flex-col items-center justify-center border-b border-r">
                      <span className="text-[11px] font-semibold tracking-wide text-slate-400">{day.short}</span>
                      <span
                        className={cn(
                          'mt-1 text-xl font-semibold leading-none text-slate-900 md:text-2xl',
                          day.isToday && 'rounded-full bg-blue-600 px-2.5 py-1 text-white'
                        )}
                      >
                        {day.date}
                      </span>
                    </div>
                  ))}

                  {hours.map((hour) => (
                    <div key={hour} className="contents">
                      <div className="h-[74px] border-b border-r px-2 py-3 text-right text-xs font-semibold text-slate-400">{hour}</div>
                      {weekdays.map((day, dayIndex) => {
                        const matches = events.filter((event) => event.dayIndex === dayIndex && event.startHour === Number(hour.slice(0, 2)));
                        return (
                          <div key={`${hour}-${day.date}`} className="relative h-[74px] border-b border-r overflow-visible">
                            {matches.map((event) => (
                              <button
                                key={event.id}
                                onClick={() => {
                                  setSelectedEventId(event.id);
                                  setEventInfoOpen(true);
                                }}
                                className={cn(
                                  'absolute left-1 right-1 z-20 rounded-md border-l-4 px-2 py-1.5 text-left text-xs transition-all hover:shadow-md break-words md:py-2',
                                  eventClass(event.color, selectedEventId === event.id)
                                )}
                                style={{ top: 2, height: `${event.durationHours * 74 - 6}px` }}
                              >
                                <p className="text-[13px] font-semibold leading-snug text-slate-800 md:text-sm">{t.get(`cpc.agenda.events.${event.id}.title`)}</p>
                                <p className="mt-0.5 truncate text-[11px] text-slate-600 md:mt-1 md:text-xs">{t.get(`cpc.agenda.events.${event.id}.subtitle`)}</p>
                                <p className="mt-0.5 truncate text-[11px] text-slate-500 md:mt-1 md:text-xs">{event.specialist}</p>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{ top: 72 + ((13 - 8) * 74) + 16 }}>
                  <span className="absolute -left-1 -top-[5px] inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
                {[
                  t.get('cpc.agenda.weekdays.mon'),
                  t.get('cpc.agenda.weekdays.tue'),
                  t.get('cpc.agenda.weekdays.wed'),
                  t.get('cpc.agenda.weekdays.thu'),
                  t.get('cpc.agenda.weekdays.fri'),
                  t.get('cpc.agenda.weekdays.sat'),
                  t.get('cpc.agenda.weekdays.sun'),
                ].map((d) => (
                  <div key={d} className="rounded-lg border bg-slate-50 py-2">{d}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex h-24 items-start justify-end rounded-lg border p-2 text-sm text-slate-600',
                      index >= 22 && index <= 28 ? 'bg-white' : 'bg-slate-50'
                    )}
                  >
                    {index >= 22 && index <= 28 ? index + 1 : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-h-full flex-col bg-white break-words">
          <div className="border-b px-4 py-4 md:px-5 md:py-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold leading-none text-slate-900 md:text-xl">{t.get('cpc.agenda.pending.title')}</h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 px-1.5 text-xs font-semibold text-orange-700">3</span>
            </div>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            {pendingRequests.map((request) => {
              const status = requestStatus[request.id] ?? 'pending';
              return (
                <article key={request.id} className="rounded-xl border p-3 shadow-sm transition-all hover:shadow-md break-words">
                  <div className="flex items-center justify-between">
                    <Badge className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', request.categoryClassName)}>{t.get(`cpc.agenda.requests.${request.id}.category`)}</Badge>
                    <span className="text-xs text-slate-400">{t.get(`cpc.agenda.requests.${request.id}.timeAgo`)}</span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold leading-snug text-slate-900 md:text-base">{t.get(`cpc.agenda.requests.${request.id}.title`)}</h3>
                  <p className="mt-1 text-xs text-slate-500 md:text-sm">
                    {t.get(`cpc.agenda.requests.${request.id}.person`)} <span className="text-slate-400">({t.get(`cpc.agenda.requests.${request.id}.team`)})</span>
                  </p>
                  {request.urgent ? (
                    <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-sm font-semibold text-red-600">
                      <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {t.get(`cpc.agenda.requests.${request.id}.urgent`)}</span>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 md:text-sm">{t.get(`cpc.agenda.requests.${request.id}.when`)}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      className="h-8 flex-1 rounded-md text-xs font-semibold md:h-9 md:text-sm"
                      onClick={() => setRequestStatus((prev) => ({ ...prev, [request.id]: 'declined' }))}
                    >
                      <X className="mr-1 h-4 w-4" />
                      {t.get('cpc.agenda.actions.decline')}
                    </Button>
                    <Button
                      className="h-8 flex-1 rounded-md bg-blue-600 text-xs font-semibold hover:bg-blue-700 md:h-9 md:text-sm"
                      onClick={() => setRequestStatus((prev) => ({ ...prev, [request.id]: request.action === 'assign' ? 'assigned' : 'approved' }))}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {request.action === 'assign' ? t.get('cpc.agenda.actions.assignSlot') : t.get('cpc.agenda.actions.approve')}
                    </Button>
                  </div>
                  {status !== 'pending' ? (
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {status === 'approved' && t.get('cpc.agenda.status.approved')}
                      {status === 'declined' && t.get('cpc.agenda.status.declined')}
                      {status === 'assigned' && t.get('cpc.agenda.status.assigned')}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="mt-auto border-t px-5 py-4">
            <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700">
              {t.get('cpc.agenda.pending.viewAll')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
    </div>
  );
}
