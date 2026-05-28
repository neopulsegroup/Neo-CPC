import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDocument, getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { CVUploadButton } from '@/features/cv/CVUploadButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatJobQualificationSummary } from '@/features/jobs/jobOfferQualifications';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  MapPin,
  Building,
  Clock,
  Briefcase,
  CheckCircle,
  Send,
  FileText,
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
  company_id?: string | null;
  company: {
    company_name: string;
    description: string | null;
    location: string | null;
  } | null;
}

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [attachedCvUrl, setAttachedCvUrl] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) fetchJob();
  }, [jobId, user]);

  async function fetchJob() {
    try {
      if (!jobId) return;
      const jobData = await getDocument<Omit<JobOffer, 'company'>>('job_offers', jobId);

      if (jobData) {
        const company = jobData.company_id
          ? await getDocument<JobOffer['company']>('companies', String(jobData.company_id))
          : null;
        setJob({ ...(jobData as JobOffer), company: (company as JobOffer['company']) || null });
      }

      if (user) {
        const apps = await queryDocuments<{ id: string; migrant_attached_cv_url?: string | null }>(
          'job_applications',
          [
            { field: 'job_id', operator: '==', value: jobId },
            { field: 'applicant_id', operator: '==', value: user.uid },
          ],
          undefined,
          1
        );
        setHasApplied(apps.length > 0);
        setApplicationId(apps[0]?.id ?? null);
        setAttachedCvUrl(
          typeof apps[0]?.migrant_attached_cv_url === 'string' && apps[0].migrant_attached_cv_url.trim()
            ? apps[0].migrant_attached_cv_url.trim()
            : null
        );
      }
    } catch (error) {
      console.error('Error fetching job:', error);
    } finally {
      setLoading(false);
    }
  }

  async function submitApplication() {
    if (!user || !jobId) return;
    if (availableForWork === false) {
      toast({
        title: 'Candidatura indisponível',
        description: 'Ative "Disponível para Trabalho" no seu perfil para se candidatar.',
        variant: 'destructive',
      });
      return;
    }

    setApplying(true);

    try {
      const newId = await addDocument('job_applications', {
        job_id: jobId,
        applicant_id: user.uid,
        cover_letter: coverLetter || null,
        status: 'submitted',
        created_at: new Date().toISOString(),
      });

      setApplicationId(newId);
      setHasApplied(true);
      setShowApplicationForm(false);
      toast({
        title: 'Candidatura enviada!',
        description: 'A sua candidatura foi enviada com sucesso.',
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a candidatura. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  }

  const getContractLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      'full_time': 'Tempo Inteiro',
      'part_time': 'Part-time',
      'temporary': 'Temporário',
      'internship': 'Estágio',
    };
    return type ? labels[type] || type : null;
  };

  const normalizeWorkMode = (wm: string | null | undefined): 'on_site' | 'hybrid' | 'remote' => {
    if (wm === 'hybrid' || wm === 'remote' || wm === 'on_site') return wm;
    return 'on_site';
  };

  const getWorkModeLabel = (wm: string | null | undefined) => {
    const labels: Record<string, string> = {
      on_site: 'Presencial',
      hybrid: 'Híbrido',
      remote: 'Remoto',
    };
    return labels[normalizeWorkMode(wm)];
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Publicado hoje';
    if (diffDays === 1) return 'Publicado ontem';
    if (diffDays < 7) return `Publicado há ${diffDays} dias`;
    return `Publicado há ${Math.floor(diffDays / 7)} semanas`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const qualificationLabel = job
    ? formatJobQualificationSummary(t, job.minimum_qualification, job.study_area, job.study_area_other)
    : null;

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Oferta não encontrada</p>
        <Link to="/dashboard/migrante/emprego" className="text-primary hover:underline mt-2 inline-block">
          Voltar às ofertas
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Back link */}
      <Link
        to="/dashboard/migrante/emprego"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar às ofertas
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Header */}
          <div className="cpc-card p-6 md:p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                  {job.company && (
                    <span className="flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      {job.company.company_name}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
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

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {getTimeAgo(job.created_at)}
              </span>
              {job.sector && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {job.sector}
                </span>
              )}
            </div>

            {job.salary_range && (
              <p className="text-lg font-semibold text-primary mt-4">
                {job.salary_range}
              </p>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">Descrição</h2>
              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap">{job.description}</p>
              </div>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">Requisitos</h2>
              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap">{job.requirements}</p>
              </div>
            </div>
          )}

          {/* Skills */}
          {Array.isArray(job.required_skills) && job.required_skills.length > 0 && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">Competências</h2>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill) => (
                  <span key={skill} className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Apply Card */}
          <div className="cpc-card p-6 sticky top-24">
            {hasApplied ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">Candidatura Enviada</h3>
                <p className="text-sm text-muted-foreground">
                  Já se candidatou a esta oferta. A empresa irá contactá-lo se houver interesse.
                </p>
                {applicationId ? (
                  <div className="mt-4 pt-4 border-t text-left">
                    <p className="text-sm font-medium mb-1">{t.get('jobApply.optionalCv.label')}</p>
                    <p className="text-xs text-muted-foreground mb-2">{t.get('jobApply.optionalCv.hint')}</p>
                    <CVUploadButton
                      contextId={applicationId}
                      contextType="application"
                      uploaderUid={user?.uid ?? ''}
                      currentUrl={attachedCvUrl ?? undefined}
                      onUploadComplete={async (url, fileName) => {
                        setAttachedCvUrl(url);
                        await updateDocument('job_applications', applicationId, {
                          migrant_attached_cv_url: url,
                          migrant_attached_cv_name: fileName,
                          migrant_attached_cv_uploaded_at: new Date().toISOString(),
                        });
                      }}
                      onRemove={async () => {
                        setAttachedCvUrl(null);
                        await updateDocument('job_applications', applicationId, {
                          migrant_attached_cv_url: null,
                          migrant_attached_cv_name: null,
                          migrant_attached_cv_uploaded_at: null,
                        });
                      }}
                      disabled={!user?.uid}
                    />
                  </div>
                ) : null}
              </div>
            ) : showApplicationForm ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Candidatar-se</h3>
                {availableForWork === false ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Para se candidatar, ative a opção <strong>Disponível para Trabalho</strong> no seu perfil.
                  </div>
                ) : null}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Carta de Apresentação (opcional)
                  </label>
                  <Textarea
                    placeholder="Apresente-se e explique porque é o candidato ideal para esta posição..."
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowApplicationForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={submitApplication}
                    disabled={applying || availableForWork === false}
                  >
                    {applying ? (
                      'A enviar...'
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowApplicationForm(true)}
                  disabled={availableForWork === false}
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Candidatar-se
                </Button>
                {availableForWork === false ? (
                  <p className="text-xs text-amber-700 text-center">
                    Ative "Disponível para Trabalho" no perfil para candidatar-se.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground text-center">
                  A sua candidatura será enviada para a empresa
                </p>
              </div>
            )}
          </div>

          {/* Company Info */}
          {job.company && (
            <div className="cpc-card p-6">
              <h3 className="font-semibold mb-4">Sobre a Empresa</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {job.company.company_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{job.company.company_name}</p>
                    {job.company.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.company.location}
                      </p>
                    )}
                  </div>
                </div>
                {job.company.description && (
                  <p className="text-sm text-muted-foreground">
                    {job.company.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
