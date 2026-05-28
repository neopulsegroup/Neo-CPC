import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { CVUploadButton } from '@/features/cv/CVUploadButton';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
} from 'lucide-react';

interface Application {
  id: string;
  cover_letter: string | null;
  status: string;
  created_at: string;
  applicantId: string;
  applicantResumeUrl: string | null;
  migrantAttachedCvUrl: string | null;
  companyAttachedCvUrl: string | null;
  applicant: {
    name: string;
    email: string;
  };
}

interface JobOffer {
  id: string;
  title: string;
  location: string | null;
}

export default function JobApplicationsPage() {
  const { jobId } = useParams();
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  useEffect(() => {
    fetchJobAndApplications();
  }, [jobId]);

  async function fetchJobAndApplications() {
    if (!jobId) return;

    try {
      // Fetch job details
      const jobData = await getDocument<JobOffer>('job_offers', jobId);
      if (jobData) setJob(jobData);

      // Fetch applications with applicant profiles
      const appsDataRaw = await queryDocuments<{ id: string; cover_letter: string | null; status: string; created_at: string; applicant_id: string; company_attached_cv_url?: string | null; migrant_attached_cv_url?: string | null }>(
        'job_applications',
        [{ field: 'job_id', operator: '==', value: jobId }],
        undefined
      );
      const appsData = [...appsDataRaw].sort((a, b) => {
        const ta = new Date(a.created_at || '').getTime();
        const tb = new Date(b.created_at || '').getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });

      if (appsData.length > 0) {
        // Fetch applicant profiles (nome, email e CV do próprio migrante)
        const applicantIds = Array.from(new Set(appsData.map(app => app.applicant_id)));
        const profileDocs = await Promise.all(applicantIds.map(id => getDocument<{ id: string; name?: string | null; email?: string | null; resumeUrl?: string | null }>('profiles', id)));
        const profilesById = new Map<string, { name: string; email: string; resumeUrl: string | null }>();
        applicantIds.forEach((id, idx) => {
          const p = profileDocs[idx];
          if (p) profilesById.set(id, { name: p.name || t.get('company.applications.unknownApplicant'), email: p.email || '', resumeUrl: (typeof p.resumeUrl === 'string' && p.resumeUrl.trim()) ? p.resumeUrl.trim() : null });
        });

        const applicationsWithProfiles: Application[] = appsData.map(app => {
          const prof = profilesById.get(app.applicant_id);
          return {
            id: app.id,
            cover_letter: app.cover_letter,
            status: app.status,
            created_at: app.created_at,
            applicantId: app.applicant_id,
            applicantResumeUrl: prof?.resumeUrl ?? null,
            migrantAttachedCvUrl: (typeof app.migrant_attached_cv_url === 'string' && app.migrant_attached_cv_url.trim()) ? app.migrant_attached_cv_url.trim() : null,
            companyAttachedCvUrl: (typeof app.company_attached_cv_url === 'string' && app.company_attached_cv_url.trim()) ? app.company_attached_cv_url.trim() : null,
            applicant: prof ? { name: prof.name, email: prof.email } : { name: t.get('company.applications.unknownApplicant'), email: '' },
          };
        });

        setApplications(applicationsWithProfiles);
      } else {
        setApplications([]);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateApplicationStatus(
    applicationId: string,
    newStatus: 'submitted' | 'reviewing' | 'interview' | 'accepted' | 'rejected'
  ) {
    await updateDocument('job_applications', applicationId, { status: newStatus });
    setApplications(prev => prev.map(app => (app.id === applicationId ? { ...app, status: newStatus } : app)));
    setSelectedApplication(null);
  }

  async function setCompanyAttachedCv(applicationId: string, url: string | null) {
    await updateDocument('job_applications', applicationId, { company_attached_cv_url: url });
    setApplications(prev => prev.map(app => (app.id === applicationId ? { ...app, companyAttachedCvUrl: url } : app)));
    setSelectedApplication(prev => (prev && prev.id === applicationId ? { ...prev, companyAttachedCvUrl: url } : prev));
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'submitted':
        return { label: t.get('company.applications.status.submitted'), color: 'bg-blue-100 text-blue-700', icon: Clock };
      case 'reviewing':
        return { label: t.get('company.applications.status.reviewing'), color: 'bg-yellow-100 text-yellow-700', icon: Eye };
      case 'interview':
        return { label: t.get('company.applications.status.interview'), color: 'bg-purple-100 text-purple-700', icon: Calendar };
      case 'accepted':
        return { label: t.get('company.applications.status.accepted'), color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'rejected':
        return { label: t.get('company.applications.status.rejected'), color: 'bg-red-100 text-red-700', icon: XCircle };
      default:
        return { label: status, color: 'bg-muted text-muted-foreground', icon: Clock };
    }
  };

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard/empresa/ofertas" className="inline-flex items-center gap-2 hover:underline">
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {t.get('company.applications.backToOffers')}
            </Link>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mt-2 leading-snug text-primary">
            {job?.title?.trim() || '—'}
          </h1>
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 mt-5">
            <FileText className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            {t.get('company.applications.pageTitle')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t.get('company.applications.count', { count: applications.length })}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
            {/* Applications List */}
            <div className="lg:col-span-2 space-y-4">
              {applications.length === 0 ? (
                <div className="cpc-card p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">{t.get('company.applications.empty.title')}</h3>
                  <p className="text-muted-foreground">
                    {t.get('company.applications.empty.subtitle')}
                  </p>
                </div>
              ) : (
                applications.map((app) => {
                  const statusConfig = getStatusConfig(app.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={app.id}
                      className={`cpc-card p-6 cursor-pointer transition-all ${
                        selectedApplication?.id === app.id
                          ? 'ring-2 ring-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedApplication(app)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                            {app.applicant.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{app.applicant.name}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {app.applicant.email}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t.get('company.applications.appliedOn', { date: new Date(app.created_at).toLocaleDateString(locale) })}
                        </p>
                        {app.cover_letter && (
                          <p className="text-sm mt-2 line-clamp-2">{app.cover_letter}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Application Details Panel */}
            <div className="lg:col-span-1">
              {selectedApplication ? (
                <div className="cpc-card p-6 sticky top-24">
                  <h3 className="font-semibold mb-4">{t.get('company.applications.details.title')}</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">{t.get('company.applications.details.labels.candidate')}</label>
                      <p className="font-medium">{selectedApplication.applicant.name}</p>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">{t.get('company.applications.details.labels.email')}</label>
                      <p className="font-medium">{selectedApplication.applicant.email}</p>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">{t.get('company.applications.details.labels.date')}</label>
                      <p className="font-medium">
                        {new Date(selectedApplication.created_at).toLocaleDateString(locale)}
                      </p>
                    </div>

                    {selectedApplication.cover_letter && (
                      <div>
                        <label className="text-sm text-muted-foreground">{t.get('company.applications.details.labels.coverLetter')}</label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-lg">
                          {selectedApplication.cover_letter}
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border space-y-3">
                      <div>
                        <label className="text-sm text-muted-foreground">{t.get('company.applications.details.labels.candidateCv')}</label>
                        {selectedApplication.applicantResumeUrl ? (
                          <a
                            href={selectedApplication.applicantResumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            {t.get('company.applications.details.viewCandidateCv')}
                          </a>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground">{t.get('company.applications.details.noCandidateCv')}</p>
                        )}
                      </div>
                      {selectedApplication.migrantAttachedCvUrl ? (
                        <div>
                          <label className="text-sm text-muted-foreground">{t.get('applicationDetail.migrantAttachedCv')}</label>
                          <a
                            href={selectedApplication.migrantAttachedCvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            {t.get('applicationDetail.migrantAttachedCv')}
                          </a>
                        </div>
                      ) : null}
                      <div>
                        <label className="text-sm text-muted-foreground">{t.get('company.applications.details.labels.attachedCv')}</label>
                        <div className="mt-1">
                          <CVUploadButton
                            contextId={selectedApplication.id}
                            contextType="application"
                            uploaderUid={user?.uid ?? ''}
                            currentUrl={selectedApplication.companyAttachedCvUrl}
                            onUploadComplete={(url) => void setCompanyAttachedCv(selectedApplication.id, url)}
                            onRemove={() => void setCompanyAttachedCv(selectedApplication.id, null)}
                            disabled={!user?.uid}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-2">
                      <p className="text-sm font-medium mb-2">{t.get('company.applications.details.updateStatus')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'reviewing')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t.get('company.applications.actions.reviewing')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'interview')}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          {t.get('company.applications.actions.interview')}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'accepted')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t.get('company.applications.actions.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'rejected')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t.get('company.applications.actions.reject')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cpc-card p-6 text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {t.get('company.applications.selectPrompt')}
                  </p>
                </div>
              )}
            </div>
          </div>
    </div>
  );
}
