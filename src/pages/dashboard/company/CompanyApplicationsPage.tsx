import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDocument, queryDocuments, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { resolveJobOfferCompanyIds } from '@/pages/dashboard/company/companyDashboardHomeData';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Briefcase, CheckCircle, Eye, FileText, Mail, Search, User } from 'lucide-react';

type ApplicationStatus = 'submitted' | 'reviewing' | 'interview' | 'accepted' | 'rejected';
type StatusFilter = 'all' | ApplicationStatus;

interface JobOfferDoc {
  id: string;
  title?: string;
  location?: string | null;
  company_id?: string | null;
}

interface ApplicationDoc {
  id: string;
  applicant_id?: string | null;
  job_id?: string | null;
  cover_letter?: string | null;
  status?: string | null;
  created_at?: unknown;
}

interface CompanyRow {
  id: string;
  company_name?: string;
  verified?: boolean;
}

interface ApplicationRow {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  jobId: string;
  jobTitle: string;
  jobLocation: string | null;
  coverLetter: string | null;
  status: ApplicationStatus;
  createdAt: string;
}

const CATALOG_LIMIT = 500;
const APPLICATIONS_PER_JOB_LIMIT = 300;

function createdAtToIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

function normalizeStatus(value: string | null | undefined): ApplicationStatus {
  if (value === 'reviewing') return 'reviewing';
  if (value === 'interview') return 'interview';
  if (value === 'accepted') return 'accepted';
  if (value === 'rejected') return 'rejected';
  return 'submitted';
}

export default function CompanyApplicationsPage() {
  const { user, profile, profileData } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobOfferCompanyIds, setJobOfferCompanyIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [jobOptions, setJobOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    void fetchCompanyAndBootstrap();
  }, [user]);

  useEffect(() => {
    if (!companyId || jobOfferCompanyIds.length === 0) {
      setRows([]);
      return;
    }
    void fetchApplications(jobOfferCompanyIds);
  }, [companyId, jobOfferCompanyIds]);

  async function fetchCompanyAndBootstrap() {
    if (!user) return;
    setLoadingInitial(true);
    const uid = user.uid;

    try {
      const direct = await getDocument<CompanyRow>('companies', uid);
      if (direct) {
        const patch: Record<string, unknown> = {};
        if (!direct.company_name || !direct.company_name.trim()) {
          patch.company_name =
            (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
            (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
            (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
            user.email ??
            'Empresa';
        }
        if (typeof direct.verified !== 'boolean') patch.verified = false;
        if (Object.keys(patch).length > 0) await setDocument('companies', uid, patch, true);
        setCompanyId(uid);
        setJobOfferCompanyIds(await resolveJobOfferCompanyIds(uid));
        return;
      }

      const legacyRows = await queryDocuments<CompanyRow>(
        'companies',
        [{ field: 'user_id', operator: '==', value: uid }],
        undefined,
        1
      );
      const legacy = legacyRows[0];
      if (legacy) {
        const baseName =
          (typeof legacy.company_name === 'string' && legacy.company_name.trim() ? legacy.company_name.trim() : null) ??
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';
        await setDocument(
          'companies',
          uid,
          {
            user_id: uid,
            company_name: baseName,
            verified: typeof legacy.verified === 'boolean' ? legacy.verified : false,
            createdAt: new Date().toISOString(),
          },
          true
        );
        setCompanyId(uid);
        setJobOfferCompanyIds(await resolveJobOfferCompanyIds(uid));
        return;
      }

      if (profile?.role === 'company') {
        await setDocument(
          'companies',
          uid,
          {
            user_id: uid,
            company_name:
              (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
              (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
              (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
              user.email ??
              'Empresa',
            verified: false,
            createdAt: new Date().toISOString(),
          },
          true
        );
        setCompanyId(uid);
        setJobOfferCompanyIds(await resolveJobOfferCompanyIds(uid));
        return;
      }

      setCompanyId(null);
      setJobOfferCompanyIds([]);
    } catch (error) {
      console.error('Error fetching company:', error);
      setCompanyId(null);
      setJobOfferCompanyIds([]);
    } finally {
      setLoadingInitial(false);
    }
  }

  async function fetchApplications(companyIds: string[]) {
    const ids = Array.from(new Set(companyIds.filter(Boolean)));
    if (ids.length === 0) {
      setRows([]);
      setJobOptions([]);
      return;
    }
    setLoadingList(true);
    try {
      const offersById = new Map<string, { title: string; location: string | null }>();
      await Promise.all(
        ids.map(async (cid) => {
          const offers = await queryDocuments<JobOfferDoc>(
            'job_offers',
            [{ field: 'company_id', operator: '==', value: cid }],
            undefined,
            CATALOG_LIMIT
          );
          for (const offer of offers) {
            offersById.set(offer.id, {
              title: offer.title?.trim() || '—',
              location: offer.location ?? null,
            });
          }
        })
      );

      const offerIds = Array.from(offersById.keys());
      setJobOptions(
        Array.from(offersById, ([id, value]) => ({ id, title: value.title })).sort((a, b) =>
          a.title.localeCompare(b.title, 'pt', { sensitivity: 'base' })
        )
      );
      if (offerIds.length === 0) {
        setRows([]);
        return;
      }

      const appsNested = await Promise.all(
        offerIds.map((jobId) =>
          queryDocuments<ApplicationDoc>(
            'job_applications',
            [{ field: 'job_id', operator: '==', value: jobId }],
            undefined,
            APPLICATIONS_PER_JOB_LIMIT
          )
        )
      );
      const flatApps = appsNested.flat().sort((a, b) => {
        const ta = new Date(createdAtToIso(a.created_at)).getTime();
        const tb = new Date(createdAtToIso(b.created_at)).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });

      const applicantIds = Array.from(new Set(flatApps.map((a) => a.applicant_id).filter((id): id is string => Boolean(id))));
      const profileDocs = await Promise.all(
        applicantIds.map((id) => getDocument<{ name?: string | null; email?: string | null }>('profiles', id))
      );
      const profileById = new Map<string, { name: string; email: string }>();
      applicantIds.forEach((id, idx) => {
        const p = profileDocs[idx];
        profileById.set(id, {
          name: p?.name?.trim() || t.get('company.applications.unknownApplicant'),
          email: p?.email?.trim() || '',
        });
      });

      const mapped = flatApps
        .map((app) => {
          const jobId = app.job_id || '';
          if (!jobId || !offersById.has(jobId)) return null;
          const profileRow = profileById.get(app.applicant_id || '') ?? {
            name: t.get('company.applications.unknownApplicant'),
            email: '',
          };
          return {
            id: app.id,
            applicantId: app.applicant_id || '',
            applicantName: profileRow.name,
            applicantEmail: profileRow.email,
            jobId,
            jobTitle: offersById.get(jobId)?.title || '—',
            jobLocation: offersById.get(jobId)?.location ?? null,
            coverLetter: app.cover_letter ?? null,
            status: normalizeStatus(app.status),
            createdAt: createdAtToIso(app.created_at),
          } as ApplicationRow;
        })
        .filter((row): row is ApplicationRow => row !== null);

      mapped.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        const da = Number.isNaN(ta) ? 0 : ta;
        const db = Number.isNaN(tb) ? 0 : tb;
        return db - da;
      });

      setRows(mapped);
    } catch (error) {
      console.error('Error fetching company applications:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('company.applicationsHub.toast.loadError'),
        variant: 'destructive',
      });
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }

  const stats = useMemo(() => {
    let submitted = 0;
    let reviewing = 0;
    let accepted = 0;
    let rejected = 0;
    for (const row of rows) {
      if (row.status === 'submitted') submitted += 1;
      else if (row.status === 'reviewing' || row.status === 'interview') reviewing += 1;
      else if (row.status === 'accepted') accepted += 1;
      else if (row.status === 'rejected') rejected += 1;
    }
    return { total: rows.length, submitted, reviewing, accepted, rejected };
  }, [rows]);

  const filteredRows = useMemo(() => {
    let out = [...rows];
    if (statusFilter !== 'all') out = out.filter((r) => r.status === statusFilter);
    if (jobFilter !== 'all') out = out.filter((r) => r.jobId === jobFilter);

    if (dateFrom) {
      const [y, m, d] = dateFrom.split('-').map((v) => Number(v));
      const from = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).toISOString();
      out = out.filter((r) => (r.createdAt || '') >= from);
    }
    if (dateTo) {
      const [y, m, d] = dateTo.split('-').map((v) => Number(v));
      const to = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).toISOString();
      out = out.filter((r) => (r.createdAt || '') <= to);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        return (
          r.applicantName.toLowerCase().includes(q) ||
          r.applicantEmail.toLowerCase().includes(q) ||
          r.jobTitle.toLowerCase().includes(q) ||
          (r.jobLocation || '').toLowerCase().includes(q)
        );
      });
    }

    out.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      const da = Number.isNaN(ta) ? 0 : ta;
      const db = Number.isNaN(tb) ? 0 : tb;
      return sortDir === 'desc' ? db - da : da - db;
    });
    return out;
  }, [rows, statusFilter, jobFilter, searchQuery, dateFrom, dateTo, sortDir]);

  async function setApplicationStatus(row: ApplicationRow, status: ApplicationStatus) {
    if (row.status === status) return;
    setSavingId(row.id);
    try {
      await updateDocument('job_applications', row.id, { status });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
      toast({ title: t.get('company.applicationsHub.toast.updatedTitle'), description: t.get('company.applicationsHub.toast.updatedDesc') });
    } catch (error) {
      console.error('Error updating application status:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('company.applicationsHub.toast.updateError'),
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  }

  function statusBadge(status: ApplicationStatus) {
    const labelKey = `company.applications.status.${status}`;
    if (status === 'accepted') return <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{t.get(labelKey)}</span>;
    if (status === 'rejected') return <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">{t.get(labelKey)}</span>;
    if (status === 'interview') return <span className="text-xs px-2 py-1 rounded-full bg-violet-100 text-violet-700">{t.get(labelKey)}</span>;
    if (status === 'reviewing') return <span className="text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-700">{t.get(labelKey)}</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">{t.get(labelKey)}</span>;
  }

  function formatDate(value: string) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale);
  }

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasOffers = rows.length > 0;

  return (
    <div>
      <Link to="/dashboard/empresa" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.get('company.applicationsHub.backToDashboard')}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" /> {t.get('company.applicationsHub.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('company.applicationsHub.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="cpc-card p-5 border-l-4 border-l-slate-400">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.applicationsHub.kpis.total')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.total)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.applicationsHub.kpis.submitted')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.submitted)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-sky-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.applicationsHub.kpis.reviewing')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.reviewing)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.applicationsHub.kpis.accepted')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.accepted)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-rose-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.applicationsHub.kpis.rejected')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.rejected)}</p>
        </div>
      </div>

      <div className="cpc-card p-6 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {([
            'all',
            'submitted',
            'reviewing',
            'interview',
            'accepted',
            'rejected',
          ] as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                statusFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
              aria-pressed={statusFilter === key}
            >
              {t.get(`company.applicationsHub.filters.${key}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.get('company.applicationsHub.searchPlaceholder')}
              className="pl-9"
              aria-label={t.get('company.applicationsHub.searchAria')}
            />
          </div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
            className="h-10 px-3 rounded-lg border border-input bg-background"
            aria-label={t.get('company.applicationsHub.sort.aria')}
          >
            <option value="desc">{t.get('company.applicationsHub.sort.newest')}</option>
            <option value="asc">{t.get('company.applicationsHub.sort.oldest')}</option>
          </select>
        </div>

        <div>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="h-10 w-full lg:w-auto px-3 rounded-lg border border-input bg-background"
            aria-label={t.get('company.applicationsHub.jobFilter.aria')}
          >
            <option value="all">{t.get('company.applicationsHub.jobFilter.all')}</option>
            {jobOptions.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingList ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !hasOffers ? (
        <div className="cpc-card p-12 text-center">
          <p className="font-semibold">{t.get('company.applicationsHub.empty.noApplicationsTitle')}</p>
          <p className="text-sm text-muted-foreground mt-2">{t.get('company.applicationsHub.empty.noApplicationsSubtitle')}</p>
          <Link to="/dashboard/empresa/ofertas" className="inline-block mt-6">
            <Button variant="outline">{t.get('company.applicationsHub.actions.openOffers')}</Button>
          </Link>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="cpc-card p-12 text-center text-muted-foreground">{t.get('company.applicationsHub.empty.filtered')}</div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((row) => {
            const busy = savingId === row.id;
            return (
              <div key={row.id} className="cpc-card p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate">{row.applicantName}</h3>
                      {statusBadge(row.status)}
                    </div>
                    <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {row.applicantEmail || '—'}
                      </span>
                      <span>{formatDate(row.createdAt)}</span>
                    </p>
                    <p className="text-sm mt-2 inline-flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{row.jobTitle}</span>
                      {row.jobLocation ? <span className="text-muted-foreground">• {row.jobLocation}</span> : null}
                    </p>
                    {row.coverLetter ? (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{row.coverLetter}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Link to={`/dashboard/empresa/ofertas/${row.jobId}/candidaturas`}>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Eye className="h-4 w-4" />
                        {t.get('company.applicationsHub.actions.viewOffer')}
                      </Button>
                    </Link>
                    {row.applicantId ? (
                      <Link to={`/dashboard/empresa/candidatos/${row.applicantId}`}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <User className="h-4 w-4" />
                          {t.get('company.applicationsHub.actions.viewCandidate')}
                        </Button>
                      </Link>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void setApplicationStatus(row, 'reviewing')}
                      disabled={busy || row.status === 'reviewing'}
                    >
                      {t.get('company.applications.actions.reviewing')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void setApplicationStatus(row, 'interview')}
                      disabled={busy || row.status === 'interview'}
                    >
                      {t.get('company.applications.actions.interview')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => void setApplicationStatus(row, 'accepted')}
                      disabled={busy || row.status === 'accepted'}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t.get('company.applications.actions.accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void setApplicationStatus(row, 'rejected')}
                      disabled={busy || row.status === 'rejected'}
                    >
                      {t.get('company.applications.actions.reject')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
