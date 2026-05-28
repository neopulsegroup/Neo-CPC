import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Briefcase,
  Building,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  ListChecks,
  Search,
  XCircle,
} from 'lucide-react';

/**
 * TASK-02 — Página "Minhas Candidaturas" do migrante.
 *
 * Schema canónico de `job_applications` (confirmado por auditoria em JobDetailPage,
 * JobApplicationsPage, CompanyApplicationsPage):
 *   - job_id, applicant_id, cover_letter, status, created_at (ISO string)
 *
 * Status em uso pelo backend: submitted | reviewing | interview | accepted | rejected.
 * (Plano original mencionava 'pending'/'under_review'/'withdrawn' — usados nomes diferentes
 *  do schema real; este componente segue os 5 valores efetivamente persistidos.)
 */

type JobApplicationDoc = {
  id: string;
  job_id?: string | null;
  applicant_id?: string | null;
  cover_letter?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type JobOfferDoc = {
  id: string;
  title?: string | null;
  location?: string | null;
  company_id?: string | null;
};

type CompanyDoc = {
  id: string;
  company_name?: string | null;
};

type EnrichedApplication = JobApplicationDoc & {
  job_id: string;
  created_at_iso: string;
  /** Raw title from job_offers (null if offer ausente). Fallback aplicado no render. */
  offer_title_raw: string | null;
  offer_location: string | null;
  /** Raw company name (null se empresa ausente). Fallback aplicado no render. */
  company_name_raw: string | null;
};

const KNOWN_STATUSES = ['submitted', 'reviewing', 'interview', 'accepted', 'rejected'] as const;
type KnownStatus = typeof KNOWN_STATUSES[number];
type StatusFilter = 'all' | KnownStatus;

function isKnownStatus(value: unknown): value is KnownStatus {
  return typeof value === 'string' && (KNOWN_STATUSES as readonly string[]).includes(value);
}

/** Mapeamento status → classes Tailwind para o badge colorido. */
const STATUS_BADGE_CLASSES: Record<KnownStatus, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-yellow-100 text-yellow-700',
  interview: 'bg-purple-100 text-purple-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const STATUS_BADGE_ICON: Record<KnownStatus, React.ComponentType<{ className?: string }>> = {
  submitted: Clock,
  reviewing: Eye,
  interview: Calendar,
  accepted: CheckCircle,
  rejected: XCircle,
};

export default function MyApplicationsPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<EnrichedApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid) return;
      setLoading(true);
      setError(null);
      try {
        // 1. Candidaturas do migrante (ordenadas client-side; sem índice composto na DB).
        const apps = await queryDocuments<JobApplicationDoc>(
          'job_applications',
          [{ field: 'applicant_id', operator: '==', value: user.uid }]
        );
        if (cancelled) return;

        // 2. Enriquecer com `job_offers` (batch) — Promise.all com Set para evitar duplicados.
        const offerIds = Array.from(
          new Set(apps.map((a) => (typeof a.job_id === 'string' ? a.job_id : null)).filter((v): v is string => !!v))
        );
        const offerDocs = await Promise.all(
          offerIds.map((id) => getDocument<JobOfferDoc>('job_offers', id).catch(() => null))
        );
        if (cancelled) return;
        const offersById = new Map<string, JobOfferDoc | null>();
        offerIds.forEach((id, idx) => offersById.set(id, offerDocs[idx]));

        // 3. Enriquecer com `companies` (batch).
        const companyIds = Array.from(
          new Set(
            offerDocs
              .map((o) => (o && typeof o.company_id === 'string' ? o.company_id : null))
              .filter((v): v is string => !!v)
          )
        );
        const companyDocs = await Promise.all(
          companyIds.map((id) => getDocument<CompanyDoc>('companies', id).catch(() => null))
        );
        if (cancelled) return;
        const companiesById = new Map<string, CompanyDoc | null>();
        companyIds.forEach((id, idx) => companiesById.set(id, companyDocs[idx]));

        // Armazena valores raw; fallback i18n aplicado no render (evita pôr `t` nas deps do useEffect).
        const enriched: EnrichedApplication[] = apps
          .filter((a) => typeof a.job_id === 'string' && a.job_id.length > 0)
          .map((a) => {
            const offer = offersById.get(a.job_id as string) ?? null;
            const company = offer?.company_id ? companiesById.get(offer.company_id) ?? null : null;
            return {
              ...a,
              job_id: a.job_id as string,
              created_at_iso: typeof a.created_at === 'string' ? a.created_at : '',
              offer_title_raw:
                typeof offer?.title === 'string' && offer.title.trim() ? offer.title.trim() : null,
              offer_location:
                typeof offer?.location === 'string' && offer.location.trim() ? offer.location.trim() : null,
              company_name_raw:
                typeof company?.company_name === 'string' && company.company_name.trim()
                  ? company.company_name.trim()
                  : null,
            };
          });

        enriched.sort((x, y) => {
          // Ordenação por created_at desc; tolerante a strings inválidas.
          const tx = Date.parse(x.created_at_iso);
          const ty = Date.parse(y.created_at_iso);
          const safeX = Number.isNaN(tx) ? 0 : tx;
          const safeY = Number.isNaN(ty) ? 0 : ty;
          return safeY - safeX;
        });

        if (!cancelled) setApplications(enriched);
      } catch (err) {
        console.error('MyApplicationsPage: falha ao carregar candidaturas', err);
        // Mensagem de erro genérica; tradução acontece no render para evitar pôr `t` nas deps.
        if (!cancelled) setError('LOAD_FAILED');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  const locale = useMemo(() => {
    if (language === 'en') return 'en-GB';
    if (language === 'es') return 'es-ES';
    if (language === 'fr') return 'fr-FR';
    return 'pt-PT';
  }, [language]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale]
  );

  function formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
  }

  function renderStatusBadge(status: string | null | undefined) {
    if (!isKnownStatus(status)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
          {status || '—'}
        </span>
      );
    }
    const Icon = STATUS_BADGE_ICON[status];
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${STATUS_BADGE_CLASSES[status]}`}>
        <Icon className="h-3 w-3" />
        {t.get(`migrant.applications.status.${status}`)}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <ListChecks className="h-8 w-8 text-primary" />
          {t.get('migrant.applications.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t.get('migrant.applications.subtitle')}</p>
      </div>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 mb-6">
          <p className="text-sm">{t.get('migrant.applications.errors.loadGeneric')}</p>
        </div>
      ) : null}

      {/* Empty state: sem candidaturas (depois de carregar). */}
      {applications.length === 0 && !error ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{t.get('migrant.applications.empty.title')}</h3>
          <p className="text-muted-foreground mb-6">{t.get('migrant.applications.empty.description')}</p>
          <Link
            to="/dashboard/migrante/emprego"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Search className="h-4 w-4" />
            {t.get('migrant.applications.empty.cta')}
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="min-w-[14rem]">
                <label className="block text-sm font-medium mb-1" htmlFor="applications-status-filter">
                  {t.get('migrant.applications.filter.label')}
                </label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger id="applications-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.get('migrant.applications.filter.all')}</SelectItem>
                    {KNOWN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t.get(`migrant.applications.filter.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {t.get('migrant.applications.count', { count: filtered.length })}
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-card rounded-xl border p-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">{t.get('migrant.applications.emptyFiltered.title')}</h3>
              <p className="text-muted-foreground">{t.get('migrant.applications.emptyFiltered.description')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((app) => (
                <article key={app.id} className="bg-card rounded-xl border p-5 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="font-semibold text-base md:text-lg">
                          {app.offer_title_raw || t.get('migrant.applications.fallback.offer')}
                        </h3>
                        {renderStatusBadge(app.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {app.company_name_raw || t.get('migrant.applications.fallback.company')}
                        </span>
                        {app.offer_location ? (
                          <span className="flex items-center gap-1">{app.offer_location}</span>
                        ) : null}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(app.created_at_iso)}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/dashboard/migrante/emprego/${app.job_id}`}
                      aria-label={t.get('migrant.applications.viewOffer')}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted transition-colors text-sm self-start"
                    >
                      <Eye className="h-4 w-4" />
                      {t.get('migrant.applications.viewOffer')}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Aviso de paginação: ~200 candidaturas é o threshold recomendado.
          TODO: introduzir paginação cursor-based quando passar de 50–100. */}
      {applications.length > 100 ? (
        <p className="text-xs text-muted-foreground mt-6 text-center">
          {t.get('migrant.applications.paginationHint', { count: applications.length })}
        </p>
      ) : null}
    </>
  );
}
