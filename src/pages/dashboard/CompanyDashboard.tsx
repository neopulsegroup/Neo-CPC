import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput, companyPhoneForPayload, formatPhoneValueForDisplay } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getDocument, queryDocuments, setDocument, subscribeDocument, updateDocument } from '@/integrations/firebase/firestore';
import { Building2, Briefcase, Check, MapPin, Users, FileText, Plus, ChevronRight, Eye, CheckCircle, TrendingUp, User } from 'lucide-react';

// Sub-pages
import CreateJobPage from './company/CreateJobPage';
import MyJobsPage from './company/MyJobsPage';
import JobApplicationsPage from './company/JobApplicationsPage';
import CandidateProfilePage from './company/CandidateProfilePage';
import CandidatesPage from './company/CandidatesPage';
import CompanyApplicationsPage from './company/CompanyApplicationsPage';
import CompanyMessagesPage from './company/MessagesPage';
import { bootstrapCompanyJobOfferScope, fetchCompanyHomeSnapshot, type CompanyHomeSnapshot } from './company/companyDashboardHomeData';

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

function normalizeTaxIdDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9);
}

function formatNifPtDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) {
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function CompanyProfilePage() {
  const { user, profile, profileData } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyDocExists, setCompanyDocExists] = useState(false);
  const [form, setForm] = useState({
    legalName: '',
    taxId: '',
    activityArea: '',
    fiscalAddress: '',
    phone: '',
    email: '',
    notes: '',
    userFullName: '',
    showUserName: false,
  });
  const [initialForm, setInitialForm] = useState(form);

  useEffect(() => {
    let cancelled = false;
    async function loadCompanyProfile() {
      const uid = user?.uid;
      if (!uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const direct = await getDocument<Record<string, unknown>>('companies', uid);
        const legacy =
          direct ||
          (
            await queryDocuments<Record<string, unknown> & { id: string }>(
              'companies',
              [{ field: 'user_id', operator: '==', value: uid }],
              undefined,
              1
            )
          )[0] ||
          null;

        const legalName =
          (typeof legacy?.company_name === 'string' && legacy.company_name.trim()) ||
          (typeof legacy?.legal_name === 'string' && legacy.legal_name.trim()) ||
          (profileData?.name && profileData.name.trim()) ||
          (profile?.name && profile.name.trim()) ||
          deriveNameFromEmail(user.email) ||
          '';
        const userFullName =
          (typeof legacy?.user_display_name === 'string' && legacy.user_display_name.trim()) ||
          (profileData?.name && profileData.name.trim()) ||
          (profile?.name && profile.name.trim()) ||
          deriveNameFromEmail(user.email) ||
          '';
        const taxIdRaw =
          (typeof legacy?.nif === 'string' && legacy.nif.trim()) ||
          (typeof legacy?.tax_id === 'string' && legacy.tax_id.trim()) ||
          (typeof profileData?.nif === 'string' && profileData.nif.trim()) ||
          '';
        const taxId = normalizeTaxIdDigits(taxIdRaw);
        const email =
          (typeof user.email === 'string' && user.email.trim()) ||
          (typeof profile?.email === 'string' && profile.email.trim()) ||
          '';
        const next = {
          legalName,
          taxId,
          activityArea:
            (typeof legacy?.activity_area === 'string' && legacy.activity_area.trim()) ||
            (typeof legacy?.business_area === 'string' && legacy.business_area.trim()) ||
            '',
          fiscalAddress:
            (typeof legacy?.fiscal_address === 'string' && legacy.fiscal_address.trim()) ||
            (typeof legacy?.address === 'string' && legacy.address.trim()) ||
            '',
          phone: (() => {
            const raw = (typeof legacy?.phone === 'string' && legacy.phone.trim()) || '';
            return raw ? formatPhoneValueForDisplay(raw) : '';
          })(),
          email,
          notes: (typeof legacy?.notes === 'string' && legacy.notes.trim()) || '',
          userFullName,
          showUserName: legacy?.show_user_name === true,
        };
        if (!cancelled) {
          setCompanyDocExists(!!direct);
          setForm(next);
          setInitialForm(next);
        }
      } catch (error) {
        console.error('Error loading company profile:', error);
        if (!cancelled) {
          toast({
            title: t.get('company.profile.toast.errorTitle'),
            description: t.get('company.profile.toast.errorDescription'),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCompanyProfile();
    return () => {
      cancelled = true;
    };
  }, [profile?.email, profile?.name, profileData?.name, profileData?.nif, t, toast, user?.email, user?.uid]);

  async function handleSave() {
    const uid = user?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: uid,
        company_name: form.legalName.trim() || null,
        legal_name: form.legalName.trim() || null,
        activity_area: form.activityArea.trim() || null,
        fiscal_address: form.fiscalAddress.trim() || null,
        phone: companyPhoneForPayload(form.phone),
        notes: form.notes.trim() || null,
        user_display_name: form.userFullName.trim() || null,
        show_user_name: form.showUserName,
      };

      if (companyDocExists) {
        await updateDocument('companies', uid, payload);
      } else {
        await setDocument(
          'companies',
          uid,
          {
            ...payload,
            verified: false,
            createdAt: new Date().toISOString(),
          },
          true
        );
        setCompanyDocExists(true);
      }

      setInitialForm(form);
      toast({
        title: t.get('company.profile.toast.savedTitle'),
        description: t.get('company.profile.toast.savedDescription'),
      });
    } catch (error) {
      console.error('Error saving company profile:', error);
      toast({
        title: t.get('company.profile.toast.errorTitle'),
        description: t.get('company.profile.toast.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm(initialForm);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground">
          <span>{t.get('company.profile.breadcrumbs.settings')}</span>
          <span className="text-muted-foreground/60">›</span>
          <span className="text-primary">{t.get('company.profile.breadcrumbs.companyProfile')}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-4">{t.get('company.profile.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t.get('company.profile.description')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="cpc-card p-6">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground text-center">{t.get('company.profile.logoSection')}</p>
            <div className="mt-6">
              <div className="mx-auto h-40 w-40 rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 flex items-center justify-center">
                <div className="h-24 w-24 rounded-xl bg-background shadow-sm border" />
              </div>
              <p className="text-sm text-muted-foreground mt-6 text-center">
                {t.get('company.profile.logoRecommendation')}
              </p>
              <button type="button" className="mt-4 w-full text-sm font-medium text-primary hover:underline">
                {t.get('company.profile.changeLogo')}
              </button>
            </div>
          </div>

          <div className="cpc-card p-6 bg-primary/5 border-primary/10">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{t.get('company.profile.accountVerification.title')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.get('company.profile.accountVerification.description')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="cpc-card p-8">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t.get('company.profile.loading')}</div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-lg">{t.get('company.profile.legalInfoTitle')}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.legalName')}</label>
              <Input
                value={form.legalName}
                onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))}
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.taxId')}</label>
              <Input value={formatNifPtDisplay(form.taxId) || '—'} disabled />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.activityArea')}</label>
              <Input
                value={form.activityArea}
                onChange={(e) => setForm((prev) => ({ ...prev, activityArea: e.target.value }))}
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">{t.get('company.profile.userDataTitle')}</p>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.userFullName')}</label>
              <Input
                value={form.userFullName}
                onChange={(e) => setForm((prev) => ({ ...prev, userFullName: e.target.value }))}
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.showUserName')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.get('company.profile.labels.showUserNameHelp')}</p>
                </div>
                <Switch
                  checked={form.showUserName}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, showUserName: checked }))}
                  disabled={loading || saving}
                />
              </div>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">{t.get('company.profile.contactLocationTitle')}</p>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.fiscalAddress')}</label>
              <Input
                value={form.fiscalAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, fiscalAddress: e.target.value }))}
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.phone')}</label>
              <PhoneInput
                id="company-profile-phone"
                value={form.phone}
                onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
                disabled={loading || saving}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.email')}</label>
              <Input value={form.email || '—'} disabled />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold tracking-widest text-muted-foreground">{t.get('company.profile.labels.notes')}</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t.get('company.profile.placeholders.notes')}
                className="min-h-28"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="mt-10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={saving || loading}>
              {t.get('company.profile.actions.cancel')}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || loading}>
              <Check className="h-4 w-4 mr-2" />
              {t.get('company.profile.actions.saveChanges')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function companyHomeJobStatusClasses(status: string): string {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'pending_review') return 'bg-sky-100 text-sky-700';
  if (status === 'paused') return 'bg-amber-100 text-amber-700';
  if (status === 'closed' || status === 'rejected') return 'bg-slate-100 text-slate-700';
  return 'bg-muted text-muted-foreground';
}

function companyHomeJobStatusLabel(
  status: string,
  t: { get: (key: string, params?: Record<string, string | number>) => string }
): string {
  if (status === 'active') return t.get('company.offers.status.active');
  if (status === 'pending_review') return t.get('company.offers.status.pending_review');
  if (status === 'paused') return t.get('company.offers.status.paused');
  if (status === 'closed' || status === 'rejected') return t.get('company.offers.status.closed');
  return t.get('company.offers.status.other');
}

function companyHomeApplicationStatusClasses(status: string): string {
  switch (status) {
    case 'submitted':
      return 'bg-blue-100 text-blue-700';
    case 'reviewing':
      return 'bg-yellow-100 text-yellow-700';
    case 'interview':
      return 'bg-purple-100 text-purple-700';
    case 'accepted':
      return 'bg-green-100 text-green-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

const EMPTY_HOME_SNAPSHOT: CompanyHomeSnapshot = {
  stats: { activeOffers: 0, receivedApplications: 0, viewedCandidates: 0, hires: 0 },
  activeJobs: [],
  recentApplications: [],
};

function CompanyHome() {
  const { user, profile, profileData } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<CompanyHomeSnapshot>(EMPTY_HOME_SNAPSHOT);

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';
  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
      }),
    [locale]
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setSnapshot(EMPTY_HOME_SNAPSHOT);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const scope = await bootstrapCompanyJobOfferScope(user, profile, profileData);
        if (cancelled) return;
        if (!scope.companyId || scope.jobOfferCompanyIds.length === 0) {
          setSnapshot(EMPTY_HOME_SNAPSHOT);
          return;
        }
        const data = await fetchCompanyHomeSnapshot(scope.jobOfferCompanyIds, t.get('company.applications.unknownApplicant'));
        if (!cancelled) setSnapshot(data);
      } catch (error) {
        console.error('Error loading company home dashboard:', error);
        if (!cancelled) {
          toast({
            title: t.get('company.createJob.errors.loadFailedTitle'),
            description: t.get('company.createJob.errors.loadFailedDesc'),
            variant: 'destructive',
          });
          setSnapshot(EMPTY_HOME_SNAPSHOT);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, profile, profileData, location.key, t, toast]);

  const stats = [
    { label: t.get('company.home.stats.activeOffers'), value: snapshot.stats.activeOffers, icon: Briefcase },
    { label: t.get('company.home.stats.receivedApplications'), value: snapshot.stats.receivedApplications, icon: FileText },
    { label: t.get('company.home.stats.viewedCandidates'), value: snapshot.stats.viewedCandidates, icon: Eye },
    { label: t.get('company.home.stats.hires'), value: snapshot.stats.hires, icon: CheckCircle },
  ];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="cpc-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs tracking-widest text-muted-foreground font-semibold">{stat.label}</p>
              <p className="text-2xl font-bold leading-tight mt-1">
                {loading ? '—' : numberFormatter.format(stat.value)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        {/* Active Jobs */}
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {t.get('company.home.activeJobsTitle')}
            </h2>
            <Link to="/dashboard/empresa/ofertas" className="text-sm text-primary hover:underline">
              {t.get('company.common.viewAll')}
            </Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t.get('company.offers.loading')}</div>
          ) : snapshot.activeJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">{t.get('company.offers.empty.subtitle')}</p>
          ) : (
            <div className="space-y-3">
              {snapshot.activeJobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/dashboard/empresa/ofertas/${job.id}/candidaturas`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.location} • {t.get('company.home.applicationsCount', { count: job.applications })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${companyHomeJobStatusClasses(job.status)}`}>
                      {companyHomeJobStatusLabel(job.status, t)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent applications */}
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t.get('company.home.recentApplicationsTitle')}
            </h2>
            <Link to="/dashboard/empresa/candidaturas" className="text-sm text-primary hover:underline">
              {t.get('company.common.viewAll')}
            </Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t.get('company.offers.loading')}</div>
          ) : snapshot.recentApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">{t.get('company.applicationsHub.empty.noApplicationsSubtitle')}</p>
          ) : (
            <div className="space-y-3">
              {snapshot.recentApplications.map((row) => (
                <Link
                  key={row.id}
                  to={`/dashboard/empresa/ofertas/${row.jobId}/candidaturas`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium shrink-0">
                      {row.applicantName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.applicantName}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {row.jobTitle} •{' '}
                        {(() => {
                          const d = new Date(row.createdAt || '');
                          return Number.isNaN(d.getTime()) ? '—' : shortDateFormatter.format(d);
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${companyHomeApplicationStatusClasses(row.status)}`}>
                      {t.get(`company.applications.status.${row.status}`)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="cpc-card p-6 xl:col-span-2 cpc-gradient-bg text-primary-foreground">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{t.get('company.home.promo.title')}</h3>
              <p className="opacity-90 text-sm">
                {t.get('company.home.promo.description')}
              </p>
            </div>
            <Link to="/dashboard/empresa/nova-oferta">
              <Button variant="hero-outline" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                {t.get('company.home.promo.cta')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CompanyDashboard() {
  const location = useLocation();
  const { profile, profileData, user } = useAuth();
  const { language, t } = useLanguage();
  const isHome = location.pathname === '/dashboard/empresa' || location.pathname === '/dashboard/empresa/';
  const [namePreference, setNamePreference] = useState<{
    legalName: string;
    userName: string;
    showUserName: boolean;
  } | null>(null);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const applyPreference = (doc: Record<string, unknown> | null) => {
      const legalName =
        (typeof doc?.company_name === 'string' && doc.company_name.trim()) ||
        (typeof doc?.legal_name === 'string' && doc.legal_name.trim()) ||
        '';
      const userName =
        (typeof doc?.user_display_name === 'string' && doc.user_display_name.trim()) ||
        '';
      const showUserName = doc?.show_user_name === true;
      setNamePreference({ legalName, userName, showUserName });
    };

    const unsubscribe = subscribeDocument<Record<string, unknown>>({
      collectionName: 'companies',
      documentId: uid,
      onNext: (doc) => {
        if (doc) {
          applyPreference(doc);
        } else {
          void (async () => {
            try {
              const legacy = await queryDocuments<Record<string, unknown> & { id: string }>(
                'companies',
                [{ field: 'user_id', operator: '==', value: uid }],
                undefined,
                1
              );
              applyPreference(legacy[0] || null);
            } catch (error) {
              console.error('Error loading legacy company name preference:', error);
            }
          })();
        }
      },
      onError: (error) => {
        console.error('Error subscribing company name preference:', error);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  const displayName = (() => {
    const preferredUserName = namePreference?.userName?.trim() || '';
    const preferredLegalName = namePreference?.legalName?.trim() || '';
    if (namePreference?.showUserName && preferredUserName) return preferredUserName;
    if (!namePreference?.showUserName && preferredLegalName) return preferredLegalName;

    const rawName =
      (typeof profileData?.name === 'string' && profileData.name.trim()) ||
      (typeof profile?.name === 'string' ? profile.name.trim() : '');
    const rawEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
    const authEmail = typeof user?.email === 'string' ? user.email.trim() : '';
    const email = rawEmail || authEmail;
    const derivedFromEmail = deriveNameFromEmail(email);
    const normalizedName = normalizeText(rawName);
    const normalizedRole = normalizeText(profile?.role ?? null);
    const isGeneric =
      normalizedName.length === 0 ||
      normalizedName === normalizedRole ||
      ['empresa', 'company', 'utilizador', 'user', 'admin'].includes(normalizedName);
    return isGeneric ? (derivedFromEmail || t.get('company.menu.user_fallback')) : rawName;
  })();

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';
  const longDateFormatter = new Intl.DateTimeFormat(locale);

  const sidebarItemsMain = [
    { to: '/dashboard/empresa', label: t.get('company.menu.overview'), icon: TrendingUp },
    { to: '/dashboard/empresa/ofertas', label: t.get('company.menu.offers'), icon: Briefcase },
    { to: '/dashboard/empresa/candidaturas', label: t.get('company.menu.applications'), icon: FileText },
    { to: '/dashboard/empresa/nova-oferta', label: t.get('company.menu.new_offer'), icon: Plus },
    { to: '/dashboard/empresa/candidatos', label: t.get('company.menu.candidates'), icon: Users },
  ];

  const sidebarItemsProfile = [{ to: '/dashboard/empresa/perfil', label: t.get('company.menu.profile'), icon: Building2 }];

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
            <aside className="cpc-card p-4 h-fit lg:sticky lg:top-24">
              <div className="mb-4 px-2">
                <p className="text-sm text-muted-foreground">{t.get('company.menu.title')}</p>
                <p className="font-semibold">{displayName}</p>
              </div>

              <nav className="space-y-1">
                {sidebarItemsMain.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard/empresa'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}

                <div className="pt-4 mt-4 border-t">
                  <p className="px-2 text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.menu.sections.settings')}</p>
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
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      {t.get('company.dashboard.welcome')}{' '}
                      <span className="text-primary">{displayName}</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.get('company.dashboard.summary', { date: longDateFormatter.format(new Date()) })}
                    </p>
                  </div>
                  <Link to="/dashboard/empresa/nova-oferta" className="shrink-0">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t.get('company.menu.new_offer')}
                    </Button>
                  </Link>
                </div>
              ) : null}

              <Routes>
                <Route index element={<CompanyHome />} />
                <Route path="nova-oferta" element={<CreateJobPage />} />
                <Route path="ofertas" element={<MyJobsPage />} />
                <Route path="candidaturas" element={<CompanyApplicationsPage />} />
                <Route path="perfil" element={<CompanyProfilePage />} />
                <Route path="mensagens" element={<CompanyMessagesPage />} />
                <Route path="ofertas/:jobId/candidaturas" element={<JobApplicationsPage />} />
                <Route
                  path="candidatos"
                  element={<CandidatesPage />}
                />
                <Route path="candidatos/:candidateId" element={<CandidateProfilePage />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
