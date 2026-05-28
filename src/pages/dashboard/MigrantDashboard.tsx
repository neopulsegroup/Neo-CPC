import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getDocument, subscribeDocument, subscribeQuery } from '@/integrations/firebase/firestore';
import { loadActiveJobOfferRows } from '@/features/jobs/loadActiveJobOffers';
import { formatActivityDurationShort, formatActivityStatusListLabel } from '@/features/activities/model';
import { loadParticipantActivitiesForUser, MAX_PARTICIPANT_ACTIVITIES_QUERY_LIMIT } from '@/features/activities/participantActivityList';
import { APP_TIME_ZONE } from '@/lib/appCalendar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  Calendar,
  BookOpen,
  Briefcase,
  Building2,
  User,
  TrendingUp,
  ChevronRight,
  Clock,
  ArrowRight,
  ArrowLeft,
  Bell,
  AlertTriangle,
  AlertCircle,
  FileText,
  Settings,
  ClipboardList,
  ShieldCheck,
  CheckCircle,
  Search,
  ListChecks,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { todayIsoAppCalendar } from '@/lib/appCalendar';
import { computeMigrantProfileCompletenessPercent } from '@/lib/migrantProfileCompleteness';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

// Sub-pages
import TrailsPage from './migrant/TrailsPage';
import TrailDetailPage from './migrant/TrailDetailPage';
import ModuleViewerPage from './migrant/ModuleViewerPage';
import JobsPage from './migrant/JobsPage';
import JobDetailPage from './migrant/JobDetailPage';
import MyApplicationsPage from './migrant/MyApplicationsPage';
import ProfilePage from './migrant/ProfilePage';
import CurriculumPage from './migrant/CurriculumPage';
import CurriculumViewPage from './migrant/CurriculumViewPage';
import SessionsPage from './migrant/SessionsPage';
import MigrantActivitiesListPage from './migrant/MigrantActivitiesListPage';
import MigrantActivityDetailPage from './migrant/MigrantActivityDetailPage';
import MigrantMessagesPage from './migrant/MessagesPage';
import BookingSessionWizardDialog from './migrant/BookingSessionWizardDialog';

type MigrantDashboardProfileDoc = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  registeredAt?: unknown | null;
  arrivalDate?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  cep?: string | null;
  identificationNumber?: string | null;
  region?: string | null;
  regionOther?: string | null;
  resumeUrl?: string | null;
  professionalTitle?: string | null;
  professionalExperience?: string | null;
  skills?: string | null;
  languagesList?: string | null;
  mainNeeds?: string | null;
  contactPreference?: string | null;
};

type DashboardNotificationDoc = {
  id: string;
  recipient_id?: string | null;
  title?: string | null;
  body?: string | null;
  href?: string | null;
  type?: string | null;
  created_at?: unknown;
};

function normalizeDashboardRole(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function MigrantHome() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; session_type: string; scheduled_date: string; scheduled_time: string; status: string | null }>>([]);
  const [progress, setProgress] = useState<Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>>([]);
  const [trails, setTrails] = useState<Record<string, { id: string; title: string; modules_count: number | null }>>({});
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; date: string; type?: string; href?: string }>>([]);
  const [dbNotifications, setDbNotifications] = useState<Array<{ id: string; title: string; body: string; date: string; type?: string; href?: string }>>([]);
  const [triage, setTriage] = useState<{ completed?: boolean; legal_status?: string | null; work_status?: string | null; language_level?: string | null; interests?: string[] | null; urgencies?: string[] | null } | null>(null);
  const [profileDoc, setProfileDoc] = useState<MigrantDashboardProfileDoc | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [urgentType, setUrgentType] = useState<'juridico' | 'psicologico' | 'habitacional' | 'necessidades'>('juridico');
  const [urgentDesc, setUrgentDesc] = useState('');
  const [extras, setExtras] = useState<{ nationality?: string; originCountry?: string; arrivalDate?: string; skills?: string; languagesList?: string; mainNeeds?: string; professionalTitle?: string; professionalExperience?: string; contactPreference?: 'email' | 'phone' } | null>(null);
  const [accessibility, setAccessibility] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('cpc-accessibility');
      return raw === 'true';
    } catch { return false; }
  });
  const [migrantActivitiesLoading, setMigrantActivitiesLoading] = useState(false);
  const [migrantActivities, setMigrantActivities] = useState<
    Array<{
      id: string;
      title: string;
      date: string;
      status?: string | null;
      durationMinutes?: number | null;
      startTime?: string;
      endTime?: string;
    }>
  >([]);
  const [employmentPreviewLoading, setEmploymentPreviewLoading] = useState(false);
  const [employmentPreview, setEmploymentPreview] = useState<
    Array<{ id: string; title: string; subtitle: string }>
  >([]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    setEmploymentPreviewLoading(true);
    (async () => {
      try {
        const rows = await loadActiveJobOfferRows<{
          id: string;
          title: string;
          location: string | null;
          company_id?: string | null;
        }>();
        const top = rows.slice(0, 6);
        const companyIds = Array.from(new Set(top.map((j) => j.company_id).filter(Boolean))) as string[];
        const companyDocs = await Promise.all(
          companyIds.map((id) => getDocument<{ company_name: string }>('companies', id))
        );
        const companyNameById = new Map<string, string>();
        companyIds.forEach((id, idx) => {
          const doc = companyDocs[idx];
          if (doc?.company_name) companyNameById.set(id, doc.company_name);
        });
        const preview = top.map((j) => {
          const companyName = j.company_id ? companyNameById.get(j.company_id) : undefined;
          const subtitle = [companyName, j.location].filter(Boolean).join(' • ');
          return { id: j.id, title: j.title, subtitle };
        });
        if (!cancelled) setEmploymentPreview(preview);
      } catch {
        if (!cancelled) setEmploymentPreview([]);
      } finally {
        if (!cancelled) setEmploymentPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    let cancelled = false;
    const ready = { triage: false, profile: false, sessions: false, progress: false };
    const markReady = () => {
      if (cancelled) return;
      if (ready.triage && ready.profile && ready.sessions && ready.progress) setLoading(false);
    };

    const unsubTriage = subscribeDocument<{ completed?: boolean; interests?: string[] | null; urgencies?: string[] | null; legal_status?: string | null; work_status?: string | null; language_level?: string | null }>({
      collectionName: 'triage',
      documentId: user.uid,
      onNext: (doc) => {
        ready.triage = true;
        setTriage(doc || null);
        markReady();
      },
      onError: () => {
        ready.triage = true;
        setLoadError('Não foi possível carregar o Perfil de necessidades.');
        markReady();
      },
    });

    const unsubProfile = subscribeDocument<MigrantDashboardProfileDoc>({
      collectionName: 'profiles',
      documentId: user.uid,
      onNext: (doc) => {
        ready.profile = true;
        setProfileDoc(doc || null);
        markReady();
      },
      onError: () => {
        ready.profile = true;
        setLoadError((prev) => prev || 'Não foi possível carregar os dados do perfil.');
        markReady();
      },
    });

    const unsubSessions = subscribeQuery<{ id: string; session_type: string; scheduled_date: string; scheduled_time: string; status: string | null }>({
      collectionName: 'sessions',
      filters: [{ field: 'migrant_id', operator: '==', value: user.uid }],
      orderByField: { field: 'scheduled_date', direction: 'desc' },
      onNext: (docs) => {
        ready.sessions = true;
        setSessionsError(null);
        setSessions(docs || []);
        markReady();
      },
      onError: () => {
        ready.sessions = true;
        setSessionsError('Não foi possível carregar as sessões.');
        markReady();
      },
    });

    const unsubProgress = subscribeQuery<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>({
      collectionName: 'user_trail_progress',
      filters: [{ field: 'user_id', operator: '==', value: user.uid }],
      onNext: async (docs) => {
        ready.progress = true;
        const prog = (docs || []) as Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>;
        setProgress(prog);
        try {
          const trailIds = Array.from(new Set(prog.map((p) => p.trail_id).filter(Boolean)));
          if (trailIds.length === 0) {
            setTrails({});
            markReady();
            return;
          }
          const map: Record<string, { id: string; title: string; modules_count: number | null }> = {};
          const docs = await Promise.all(trailIds.map((id) => getDocument<{ id: string; title: string; modules_count: number | null }>('trails', id)));
          docs.forEach((t) => {
            if (t?.id) map[t.id] = t;
          });
          setTrails(map);
        } catch {
          setTrails({});
        } finally {
          markReady();
        }
      },
      onError: () => {
        ready.progress = true;
        markReady();
      },
    });

    try {
      const rawNotif = localStorage.getItem(`notifications:${user.uid}`);
      setNotifications(rawNotif ? JSON.parse(rawNotif) : []);
    } catch {
      setNotifications([]);
    }
    try {
      const rawExtras = localStorage.getItem(`profileExtras:${user.uid}`);
      setExtras(rawExtras ? JSON.parse(rawExtras) : null);
    } catch {
      setExtras(null);
    }

    return () => {
      cancelled = true;
      unsubTriage();
      unsubProfile();
      unsubSessions();
      unsubProgress();
    };
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeQuery<DashboardNotificationDoc>({
      collectionName: 'notifications',
      filters: [{ field: 'recipient_id', operator: '==', value: user.uid }],
      orderByField: { field: 'created_at', direction: 'desc' },
      limitCount: 20,
      onNext: (docs) => {
        const mapped = docs.map((d) => {
          const created = d.created_at as { toDate?: () => Date; seconds?: number } | string | null | undefined;
          const date =
            created && typeof created === 'object' && typeof created.toDate === 'function'
              ? created.toDate().toISOString()
              : created && typeof created === 'object' && typeof created.seconds === 'number'
                ? new Date(created.seconds * 1000).toISOString()
                : typeof created === 'string'
                  ? created
                  : new Date().toISOString();
          return {
            id: d.id,
            title: (d.title || 'Notificação').trim(),
            body: (d.body || '').trim(),
            date,
            type: d.type || undefined,
            href: d.href || undefined,
          };
        });
        setDbNotifications(mapped);
      },
      onError: () => setDbNotifications([]),
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const upcomingSessions = useMemo(() => {
    const now = todayIsoAppCalendar();
    return sessions.filter(s => s.scheduled_date >= now).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }, [sessions]);

  const trailsProgressAvg = useMemo(() => {
    const values = progress.map(p => p.progress_percent || 0);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [progress]);

  const sessionsProgress = useMemo(() => {
    const total = sessions.length;
    if (total === 0) return 0;
    const done = sessions.filter((s) => (s.status || '').toLowerCase() === 'completed' || (s.status || '').toLowerCase() === 'concluida' || (s.status || '').toLowerCase() === 'concluída').length;
    return Math.min(100, Math.round((done / total) * 100));
  }, [sessions]);

  const profileCompleteness = useMemo(
    () =>
      computeMigrantProfileCompletenessPercent(profileDoc || undefined, {
        authName: profile?.name,
        authPhone: (profile as { phone?: string | null } | null)?.phone,
      }),
    [profile, profileDoc]
  );

  const triageProgress = useMemo(() => {
    if (!triage) return 0;
    return triage.completed ? 100 : 0;
  }, [triage]);

  const triageUrgenciesLabel = useMemo(() => {
    const values = triage?.urgencies || [];
    if (!values.length) return '—';
    const isPostArrival = Boolean(triage?.work_status || triage?.legal_status || (triage as { housing_status?: string | null } | null)?.housing_status);
    const keyBase = isPostArrival ? 'triage.options.identified_needs' : 'triage.options.desired_support';
    return values
      .map((v) => {
        const label = t.get(`${keyBase}.${v}`);
        return label === `${keyBase}.${v}` ? v : label;
      })
      .join(', ') || '—';
  }, [triage, t]);

  const triageInterestsLabel = useMemo(() => {
    const values = triage?.interests || [];
    if (!values.length) return '—';
    const keyBase = 'triage.options.professional_interests';
    return values
      .map((v) => {
        const label = t.get(`${keyBase}.${v}`);
        return label === `${keyBase}.${v}` ? v : label;
      })
      .join(', ') || '—';
  }, [triage, t]);

  const overallProgress = useMemo(() => {
    const parts = [trailsProgressAvg, sessionsProgress, profileCompleteness, triageProgress];
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  }, [trailsProgressAvg, sessionsProgress, profileCompleteness, triageProgress]);

  const suggestedActions = useMemo(() => {
    const actions: Array<{ label: string; href: string }> = [];
    if (!(profileDoc?.professionalExperience || extras?.professionalExperience) || !(profileDoc?.professionalTitle || extras?.professionalTitle)) {
      actions.push({ label: t.dashboard.complete_cv_action, href: '/dashboard/migrante/curriculo' });
    }
    if (progress.length === 0) actions.push({ label: t.dashboard.start_trail_action, href: '/dashboard/migrante/trilhas' });
    if (upcomingSessions.length === 0) actions.push({ label: t.dashboard.book_session_action, href: '#' });
    return actions;
  }, [extras, profileDoc, progress, upcomingSessions.length]);

  const profileRequiredAlert = useMemo(() => {
    const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    const normalize = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const digits = (v: string) => v.replace(/\D/g, '');
    const validateBirthDate = (raw: string) => {
      if (!raw) return false;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      if (!m) return false;
      const d = new Date(raw);
      return Number.isFinite(d.getTime());
    };
    const validateCepComplete = (raw: string) => {
      const v = raw.trim();
      if (!v || !/^[\d-]+$/.test(v)) return false;
      const d = v.replace(/\D/g, '');
      return d.length >= 4 && d.length <= 9;
    };
    const validateRegion = (raw: string) => ['Lisboa', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Outra'].includes(raw);

    const p = profileDoc || {};

    const missingPersonal: string[] = [];
    const missingProfessional: string[] = [];

    const name = normalize(p.name) || normalize(profile?.name);
    if (!name) missingPersonal.push('Nome');

    const phoneRaw = normalize(p.phone) || normalize((profile as { phone?: string | null } | null)?.phone);
    if (!phoneRaw || digits(phoneRaw).length < 9) missingPersonal.push('Telefone');

    const birthRaw = normalize(p.birthDate);
    if (!birthRaw || !validateBirthDate(birthRaw)) missingPersonal.push('Data de nascimento');

    const nationality = normalize(p.nationality);
    if (!nationality) missingPersonal.push('Nacionalidade');

    const address = normalize(p.address);
    if (!address || address.length < 10) missingPersonal.push('Morada');

    const addressNumber = normalize(p.addressNumber);
    if (!addressNumber) missingPersonal.push('Número');

    const cepRaw = normalize(p.cep) || normalize(p.identificationNumber);
    if (!validateCepComplete(cepRaw)) missingPersonal.push('CEP');

    const region = normalize(p.region);
    if (!region || !validateRegion(region)) missingPersonal.push('Região');
    if (region === 'Outra') {
      const other = normalize(p.regionOther);
      if (!other || other.length < 2) missingPersonal.push('Região (Outra)');
    }

    const professionalTitle = normalize(p.professionalTitle);
    if (!professionalTitle || professionalTitle.length < 2) missingProfessional.push('Título profissional');

    const professionalExperience = normalize(p.professionalExperience);
    if (!professionalExperience || professionalExperience.length < 10) missingProfessional.push('Experiência profissional');

    const skills = normalize(p.skills);
    const skillTokens = skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (skillTokens.length === 0) missingProfessional.push('Competências');

    const languagesList = normalize(p.languagesList);
    if (!languagesList) missingProfessional.push('Idiomas');

    if (missingPersonal.length === 0 && missingProfessional.length === 0) return null;

    const summarize = (items: string[]) => {
      const head = items.slice(0, 4).join(', ');
      if (items.length <= 4) return head;
      return `${head} e mais ${items.length - 4}`;
    };

    const parts: string[] = [];
    if (missingPersonal.length) parts.push(`Informação Pessoal: ${summarize(missingPersonal)}.`);
    if (missingProfessional.length) parts.push(`Perfil Profissional: ${summarize(missingProfessional)}.`);

    return {
      id: 'profile-required-alert',
      title: 'Complete o seu cadastro',
      body: `${parts.join(' ')} Aceda ao seu Perfil para concluir.`,
      date: new Date().toISOString(),
      type: 'warning',
      href: '/dashboard/migrante/perfil',
    };
  }, [profile?.name, profile, profileDoc]);

  const visibleNotifications = useMemo(() => {
    const list = [
      ...(profileRequiredAlert ? [profileRequiredAlert] : []),
      ...dbNotifications,
      ...notifications,
    ];
    return list.slice(0, 4);
  }, [dbNotifications, notifications, profileRequiredAlert]);

  function addUrgentRequest() {
    if (!user || !urgentDesc) return;
    const req: { id: string; type: typeof urgentType; description: string; status: string; date: string } = { id: String(Date.now()), type: urgentType, description: urgentDesc, status: 'submetido', date: new Date().toISOString() };
    try {
      const raw = localStorage.getItem(`urgentRequests:${user.uid}`);
      const list = raw ? (JSON.parse(raw) as Array<{ id: string; type: typeof urgentType; description: string; status: string; date: string }>) : [];
      const next = [req, ...list];
      localStorage.setItem(`urgentRequests:${user.uid}`, JSON.stringify(next));
    } catch { void 0; }
    setUrgentOpen(false);
    setUrgentDesc('');
  }

  useEffect(() => {
    if (accessibility) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    try { localStorage.setItem('cpc-accessibility', accessibility ? 'true' : 'false'); } catch { void 0; }
  }, [accessibility]);

  useEffect(() => {
    let cancelled = false;
    async function loadActs() {
      if (!user?.uid) {
        setMigrantActivities([]);
        setMigrantActivitiesLoading(false);
        return;
      }
      setMigrantActivitiesLoading(true);
      try {
        const sorted = await loadParticipantActivitiesForUser(user.uid, {
          firestoreLimit: MAX_PARTICIPANT_ACTIVITIES_QUERY_LIMIT,
          participantEmail: user.email ?? null,
        });
        if (cancelled) return;
        setMigrantActivities(
          sorted.map((r) => ({
            id: r.id,
            title: r.title || 'Atividade',
            date: r.date || '',
            status: r.status ?? null,
            durationMinutes: r.durationMinutes ?? null,
            startTime: r.startTime,
            endTime: r.endTime,
          }))
        );
      } catch {
        if (!cancelled) setMigrantActivities([]);
      } finally {
        if (!cancelled) setMigrantActivitiesLoading(false);
      }
    }
    void loadActs();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email]);

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="grid xl:grid-cols-3 gap-6 mb-8">
        {/* Left Column (Main Content) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Overview Card */}
          <div className="cpc-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />{t.dashboard.overview}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t.dashboard.needs_profile}</p>
                
                <div className="mt-2 text-sm">
                  <span className="font-medium">{t.dashboard.urgencies}:</span> {triageUrgenciesLabel}
                </div>
                <div className="mt-1 text-sm">
                  <span className="font-medium">{t.dashboard.interests}:</span> {triageInterestsLabel}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.dashboard.overall_progress}</p>
                <div className="mt-4 grid grid-cols-2 justify-items-center gap-x-6 gap-y-4 sm:grid-cols-4">
                  <CircularProgress value={trailsProgressAvg} label={t.dashboard.trails} />
                  <CircularProgress value={sessionsProgress} label={t.dashboard.sessions} />
                  <CircularProgress value={profileCompleteness} label={t.dashboard.profile} />
                  <CircularProgress value={triageProgress} label={t.get('dashboard.triage')} />
                </div>
              </div>
            </div>
            
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Sessions Card */}
            <Card className="p-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {t.dashboard.upcomingSessions}</h3>
                <Link to="/dashboard/migrante/sessoes" className="text-sm text-primary hover:underline">{t.dashboard.view_all}</Link>
              </CardHeader>
              <CardContent>
                {sessionsError ? (
                  <p className="mb-2 text-xs text-destructive">{sessionsError}</p>
                ) : null}
                {upcomingSessions.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingSessions.slice(0, 4).map(s => (
                      <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{s.session_type}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{s.status || t.dashboard.status_scheduled}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mb-4">{t.dashboard.no_sessions}</div>
                )}
                <Button variant="default" size="sm" className="w-full" onClick={() => setBookOpen(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  {t.dashboard.book_session_action}
                </Button>
              </CardContent>
            </Card>

            {/* Trails Card */}
            <Card className="p-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> {t.dashboard.training_trails}</h3>
                <Link to="/dashboard/migrante/trilhas" className="text-sm text-primary hover:underline">{t.dashboard.view_all}</Link>
              </CardHeader>
              <CardContent>
                {progress.length > 0 ? (
                  <div className="space-y-3">
                    {progress.slice(0, 4).map(p => (
                      <div key={p.trail_id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">{trails[p.trail_id]?.title || p.trail_id}</p>
                          <span className="text-xs text-muted-foreground">{p.modules_completed || 0}/{trails[p.trail_id]?.modules_count || 0}</span>
                        </div>
                        <Progress value={p.progress_percent || 0} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mb-4">{t.dashboard.no_trails}</div>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/dashboard/migrante/trilhas">
                    <ListChecks className="h-4 w-4 mr-2" />
                    {t.dashboard.start_trail_action}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="cpc-card p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> {t.dashboard.activities}
              </h2>
              <Link to="/dashboard/migrante/atividades" className="text-sm text-primary hover:underline shrink-0">
                {t.dashboard.view_all}
              </Link>
            </div>
            <div className="rounded-xl border bg-muted/30 p-6 min-h-[160px]">
              {migrantActivitiesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : migrantActivities.length ? (
                <div className="space-y-3 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                  {migrantActivities.map((a) => (
                    <Link
                      key={a.id}
                      to={`/dashboard/migrante/atividades/${a.id}`}
                      className="flex items-center justify-between rounded-lg bg-background/70 border px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(() => {
                            const datePart =
                              a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
                                ? new Intl.DateTimeFormat('pt-PT', {
                                    timeZone: APP_TIME_ZONE,
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  }).format(new Date(`${a.date}T12:00:00Z`))
                                : null;
                            const dur = formatActivityDurationShort(a);
                            if (datePart && dur) return `${datePart} • ${dur}`;
                            if (datePart) return datePart;
                            if (dur) return dur;
                            return '—';
                          })()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          {formatActivityStatusListLabel(a.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center flex flex-col items-center justify-center min-h-[120px]">
                  <div className="mx-auto h-12 w-12 rounded-full bg-background border flex items-center justify-center text-muted-foreground">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{t.get('dashboard.activities_empty')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Employment Card */}
          <div className="cpc-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> {t.dashboard.employment_area}</h2>
              <Link to="/dashboard/migrante/emprego" className="text-sm text-primary hover:underline">{t.dashboard.view_all}</Link>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/migrante/curriculo">
                  <FileText className="h-4 w-4 mr-2" />
                  {t.dashboard.completeCv}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/migrante/emprego">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {t.dashboard.view_vacancies}
                </Link>
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {employmentPreviewLoading ? (
                <div className="md:col-span-2 flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : employmentPreview.length === 0 ? (
                <p className="md:col-span-2 text-sm text-muted-foreground">{t.get('dashboard.migrant_jobs.preview_empty')}</p>
              ) : (
                employmentPreview.map((job) => (
                  <Link
                    key={job.id}
                    to={`/dashboard/migrante/emprego/${job.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{job.title}</p>
                      {job.subtitle ? (
                        <p className="text-xs text-muted-foreground truncate">{job.subtitle}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          {/* Notifications */}
          <Card className="p-0">
            <CardHeader className="pb-2">
              <h3 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4" />{t.dashboard.notifications}</h3>
            </CardHeader>
            <CardContent>
              {visibleNotifications.length > 0 ? (
                <div className="space-y-3">
                  {visibleNotifications.map((n) => {
                    const isWarn = n.type === 'warning';
                    const baseClass = `p-3 rounded-lg flex flex-col gap-1 ${isWarn ? 'border border-amber-200 bg-amber-50/60' : 'bg-muted/50'}`;
                    const content = (
                      <>
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-3">{n.body}</p>
                        <span className="text-[10px] text-muted-foreground mt-1">{new Date(n.date).toLocaleString()}</span>
                      </>
                    );
                    return n.href ? (
                      <Link key={n.id} to={n.href} className={`${baseClass} hover:bg-amber-50`}>
                        {content}
                      </Link>
                    ) : (
                      <div key={n.id} className={baseClass}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t.dashboard.no_notifications}</p>
              )}
            </CardContent>
          </Card>

          {/* Urgent Request */}
          <Card className="border-primary/20 bg-primary/5 p-0">
            <CardHeader className="pb-2">
              <h3 className="font-semibold flex items-center gap-2">{t.dashboard.support_request}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t.dashboard.support_desc}
              </p>
              <Button className="w-full flex items-center justify-center gap-2" variant="outline" onClick={() => setUrgentOpen(true)}>
                <AlertCircle className="h-4 w-4 text-primary" />
                {t.dashboard.new_support_request}
              </Button>
            </CardContent>
          </Card>

          {/* Statistics/History Card */}
          <div className="cpc-card p-6">
            <h2 className="font-semibold mb-4">{t.dashboard.history_reports}</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-muted-foreground mb-1">{t.dashboard.sessions_done}</p>
                <p className="font-semibold text-sm">{sessions.filter(s => s.status === 'completed' || s.status === t.dashboard.status_concluded).length}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-muted-foreground mb-1">{t.dashboard.modules_done}</p>
                <p className="font-semibold text-sm">{progress.reduce((a, b) => a + (b.modules_completed || 0), 0)}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-muted-foreground mb-1">{t.dashboard.applications}</p>
                <p className="font-semibold text-sm">—</p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-muted-foreground mb-1">{t.dashboard.progress_report}</p>
                <p className="font-semibold text-sm">{overallProgress}%</p>
              </div>
            </div>
          </div>

          {/* Settings Card */}
          <div className="cpc-card p-6">
            <h2 className="font-semibold mb-4">{t.dashboard.settings}</h2>
            <div className="space-y-4 text-sm">
              <div>
                <Label className="text-xs">{t.dashboard.language}</Label>
                <Select value={localStorage.getItem('cpc-language') || 'pt'} onValueChange={(v) => { localStorage.setItem('cpc-language', v); location.reload(); }}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">{t.get('common.languages.pt')}</SelectItem>
                    <SelectItem value="en">{t.get('common.languages.en')}</SelectItem>
                    <SelectItem value="es">{t.get('common.languages.es')}</SelectItem>
                    <SelectItem value="fr">{t.get('common.languages.fr')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="accessibility" checked={accessibility} onCheckedChange={(c) => setAccessibility(!!c)} />
                <Label htmlFor="accessibility" className="text-xs cursor-pointer">{t.dashboard.accessibility_mode}</Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BookingSessionWizardDialog open={bookOpen} onOpenChange={setBookOpen} userId={user?.uid ?? null} />

      <Dialog open={urgentOpen} onOpenChange={setUrgentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.dashboard.new_support_request}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>{t.dashboard.type}</Label>
              <Select value={urgentType} onValueChange={(v) => setUrgentType(v as typeof urgentType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridico">{t.dashboard.support_types.juridico}</SelectItem>
                  <SelectItem value="psicologico">{t.dashboard.support_types.psicologico}</SelectItem>
                  <SelectItem value="habitacional">{t.dashboard.support_types.habitacional}</SelectItem>
                  <SelectItem value="necessidades">{t.dashboard.support_types.necessidades}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>{t.dashboard.description}</Label>
              <Textarea value={urgentDesc} onChange={(e) => setUrgentDesc(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter><Button onClick={addUrgentRequest}>{t.dashboard.submit}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MigrantDashboard() {
  const location = useLocation();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isHome = location.pathname === '/dashboard/migrante' || location.pathname === '/dashboard/migrante/';
  const sidebarItemsMain = [
    { to: '/dashboard/migrante', label: t.get('dashboard.overview'), icon: TrendingUp },
    { to: '/dashboard/migrante/sessoes', label: t.get('dashboard.sessions'), icon: Calendar },
    { to: '/dashboard/migrante/atividades', label: t.get('dashboard.activities'), icon: ClipboardList },
    { to: '/dashboard/migrante/emprego', label: t.get('dashboard.employment'), icon: Briefcase },
    // TASK-02: nova entrada "Minhas Candidaturas" logo após Emprego (fluxo natural).
    { to: '/dashboard/migrante/candidaturas', label: t.get('dashboard.applications'), icon: ListChecks },
    { to: '/dashboard/migrante/trilhas', label: t.get('dashboard.trails'), icon: BookOpen },
  ];
  const role = normalizeDashboardRole(profile?.role);
  const isMigrant = role === 'migrant' || role === 'migrante' || role.length === 0;
  const sidebarItemsProfile = [
    { to: '/dashboard/migrante/perfil', label: t.get('dashboard.profile'), icon: Building2 },
    { to: '/dashboard/migrante/curriculo', label: t.get('dashboard.curriculum'), icon: FileText },
  ];

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          {/* Layout refactor: alinhar estrutura/estilos com o dashboard CPC (sidebar + conteúdo) */}
          <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
            <aside className="cpc-card p-4 h-fit lg:sticky lg:top-24">
              <div className="mb-4 px-2">
                <p className="text-sm text-muted-foreground">{t.get('migrant.menu.title')}</p>
                <p className="font-semibold">{profile?.name || t.get('cpc.menu.user_fallback')}</p>
              </div>

              {/* Documentação:
                - Estrutura e estilos do menu replicam o padrão visual/funcional dos dashboards /empresa e /cpc.
                - Os itens principais ficam no topo; "Definições" (Perfil + Currículo) no final com separador (border-t).
                - Visibilidade: secção de definições apenas para utilizadores com perfil migrante.
              */}
              <nav className="space-y-1">
                {sidebarItemsMain.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard/migrante'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}

                {isMigrant ? (
                  <>
                    <div className="pt-4 mt-4 border-t">
                      <p className="px-2 text-xs font-semibold tracking-widest text-muted-foreground">{t.get('sidebar.sections.settings')}</p>
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
                  </>
                ) : null}
              </nav>
            </aside>

            <div>
              {isHome ? (
                <div className="mb-8">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {t.get('dashboard.welcome')},{' '}
                    <span className="text-primary">{profile?.name || t.get('auth.roles.migrant')}</span>
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.get('dashboard.overview_desc')}.
                  </p>
                </div>
              ) : null}

              <Routes>
                <Route index element={<MigrantHome />} />
                <Route path="sessoes" element={<SessionsPage />} />
                <Route path="trilhas" element={<TrailsPage />} />
                <Route path="trilhas/:trailId" element={<TrailDetailPage />} />
                <Route path="trilhas/:trailId/modulo/:moduleId" element={<ModuleViewerPage />} />
                <Route path="emprego" element={<JobsPage />} />
                <Route path="emprego/:jobId" element={<JobDetailPage />} />
                {/* TASK-02 — Minhas Candidaturas */}
                <Route path="candidaturas" element={<MyApplicationsPage />} />
                <Route path="atividades" element={<MigrantActivitiesListPage />} />
                <Route path="atividades/:activityId" element={<MigrantActivityDetailPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="curriculo" element={<CurriculumPage />} />
                <Route path="curriculo/ver/:migrantId" element={<CurriculumViewPage />} />
                <Route path="mensagens" element={<MigrantMessagesPage />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
