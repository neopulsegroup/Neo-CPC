import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteDocument, getDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatJobQualificationSummary } from '@/features/jobs/jobOfferQualifications';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Ban,
  Briefcase,
  Building,
  CheckCircle,
  Clock,
  MapPin,
  Trash2,
} from 'lucide-react';

interface JobOffer {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  sector: string | null;
  contract_type: string | null;
  work_mode?: string | null;
  minimum_qualification?: string | null;
  study_area?: string | null;
  study_area_other?: string | null;
  salary_range: string | null;
  requirements: string | null;
  required_skills?: string[] | null;
  created_at: string;
  status: string;
  company_id?: string | null;
  company: {
    company_name: string;
    description: string | null;
    location: string | null;
  } | null;
}

function parseCreatedAt(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = (value as { seconds: number }).seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString();
  }
  return '';
}

export default function CpcJobOfferDetailPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';
  const { toast } = useToast();
  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (jobId) void fetchJob();
  }, [jobId]);

  async function fetchJob() {
    if (!jobId) return;
    setLoading(true);
    try {
      const jobData = await getDocument<Record<string, unknown> & { id: string }>('job_offers', jobId);
      if (!jobData) {
        setJob(null);
        return;
      }

      const company = jobData.company_id
        ? await getDocument<{ company_name?: string; description?: string | null; location?: string | null }>(
            'companies',
            String(jobData.company_id)
          )
        : null;

      setJob({
        id: jobData.id,
        title: typeof jobData.title === 'string' ? jobData.title : '—',
        description: typeof jobData.description === 'string' ? jobData.description : null,
        location: typeof jobData.location === 'string' ? jobData.location : null,
        sector: typeof jobData.sector === 'string' ? jobData.sector : null,
        contract_type: typeof jobData.contract_type === 'string' ? jobData.contract_type : null,
        work_mode: typeof jobData.work_mode === 'string' ? jobData.work_mode : null,
        minimum_qualification:
          typeof jobData.minimum_qualification === 'string' ? jobData.minimum_qualification : null,
        study_area: typeof jobData.study_area === 'string' ? jobData.study_area : null,
        study_area_other: typeof jobData.study_area_other === 'string' ? jobData.study_area_other : null,
        salary_range: typeof jobData.salary_range === 'string' ? jobData.salary_range : null,
        requirements: typeof jobData.requirements === 'string' ? jobData.requirements : null,
        required_skills: Array.isArray(jobData.required_skills)
          ? jobData.required_skills.filter((s): s is string => typeof s === 'string')
          : null,
        created_at: parseCreatedAt(jobData.created_at),
        status: typeof jobData.status === 'string' ? jobData.status : 'pending_review',
        company_id: typeof jobData.company_id === 'string' ? jobData.company_id : null,
        company: company
          ? {
              company_name: typeof company.company_name === 'string' ? company.company_name : '—',
              description: typeof company.description === 'string' ? company.description : null,
              location: typeof company.location === 'string' ? company.location : null,
            }
          : null,
      });
    } catch (error) {
      console.error('Error fetching CPC job offer:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.offers.detail.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetStatus(nextStatus: 'active' | 'rejected') {
    if (!job) return;
    setProcessing(true);
    try {
      await updateDocument('job_offers', job.id, {
        status: nextStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.uid || null,
      });
      setJob((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      toast({
        title:
          nextStatus === 'active'
            ? t.get('cpc.pages.offers.detail.approvedToast')
            : t.get('cpc.pages.offers.detail.rejectedToast'),
      });
    } catch (error) {
      console.error('Error moderating offer status:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.offers.detail.moderationError'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!job) return;
    const ok = window.confirm(t.get('cpc.pages.offers.confirm_delete', { title: job.title }));
    if (!ok) return;
    setProcessing(true);
    try {
      await deleteDocument('job_offers', job.id);
      toast({ title: t.get('cpc.pages.offers.detail.deletedToast') });
      navigate('/dashboard/cpc/ofertas');
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.offers.detail.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }

  const getContractLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      full_time: t.get('cpc.pages.offers.detail.contractTypes.full_time'),
      part_time: t.get('cpc.pages.offers.detail.contractTypes.part_time'),
      temporary: t.get('cpc.pages.offers.detail.contractTypes.temporary'),
      internship: t.get('cpc.pages.offers.detail.contractTypes.internship'),
    };
    return type ? labels[type] || type : null;
  };

  const normalizeWorkMode = (wm: string | null | undefined): 'on_site' | 'hybrid' | 'remote' => {
    if (wm === 'hybrid' || wm === 'remote' || wm === 'on_site') return wm;
    return 'on_site';
  };

  const getWorkModeLabel = (wm: string | null | undefined) => {
    const mode = normalizeWorkMode(wm);
    return t.get(`cpc.pages.offers.detail.workModes.${mode}`);
  };

  function statusBadge(status: string) {
    if (status === 'active') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
          {t.get('cpc.pages.offers.status_active')}
        </span>
      );
    }
    if (status === 'rejected' || status === 'closed') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">
          {t.get('cpc.pages.offers.status_rejected')}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
        {t.get('cpc.pages.offers.status_pending')}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t.get('cpc.pages.offers.detail.notFound')}</p>
        <Link to="/dashboard/cpc/ofertas" className="text-primary hover:underline mt-2 inline-block">
          {t.get('cpc.pages.offers.detail.back')}
        </Link>
      </div>
    );
  }

  const qualificationLabel = formatJobQualificationSummary(
    t,
    job.minimum_qualification,
    job.study_area,
    job.study_area_other
  );

  return (
    <div>
      <Link
        to="/dashboard/cpc/ofertas"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.get('cpc.pages.offers.detail.back')}
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="cpc-card p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                  {job.company && (
                    <span className="flex items-center gap-1">
                      <Building className="h-4 w-4 shrink-0" />
                      {job.company.company_name}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {job.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {statusBadge(job.status)}
                {job.contract_type && (
                  <span className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {getContractLabel(job.contract_type)}
                  </span>
                )}
                <span className="text-sm px-3 py-1 rounded-full border border-border text-foreground">
                  {getWorkModeLabel(job.work_mode)}
                </span>
                {qualificationLabel ? (
                  <span className="text-sm px-3 py-1 rounded-full border border-border text-foreground text-right max-w-[220px]">
                    {qualificationLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {job.created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(job.created_at).toLocaleDateString(locale)}
                </span>
              )}
              {job.sector && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {job.sector}
                </span>
              )}
            </div>

            {job.salary_range && <p className="text-lg font-semibold text-primary mt-4">{job.salary_range}</p>}
          </div>

          {job.description && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">{t.get('cpc.pages.offers.detail.description')}</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">{job.description}</p>
            </div>
          )}

          {job.requirements && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">{t.get('cpc.pages.offers.detail.requirements')}</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">{job.requirements}</p>
            </div>
          )}

          {Array.isArray(job.required_skills) && job.required_skills.length > 0 && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">{t.get('cpc.pages.offers.detail.skills')}</h2>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill) => (
                  <span key={skill} className="text-sm px-3 py-1 rounded-full bg-muted">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.company?.description && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">{t.get('cpc.pages.offers.detail.company')}</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">{job.company.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="cpc-card p-6 space-y-4 sticky top-4">
            <h2 className="font-semibold text-lg">{t.get('cpc.pages.offers.detail.moderation')}</h2>
            <p className="text-sm text-muted-foreground">{t.get('cpc.pages.offers.detail.moderationHint')}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleSetStatus('active')}
                disabled={processing || job.status === 'active'}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t.get('cpc.pages.offers.actions.approve')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSetStatus('rejected')}
                disabled={processing || job.status === 'rejected'}
              >
                <Ban className="h-4 w-4 mr-2" />
                {t.get('cpc.pages.offers.actions.reject')}
              </Button>
              <Button variant="destructive" onClick={() => handleDelete()} disabled={processing}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t.get('cpc.pages.offers.actions.delete')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
