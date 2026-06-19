import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CpcCurriculumPreview } from '@/components/curriculum/CpcCurriculumPreview';
import {
  buildCpcCurriculumViewModel,
  hasCpcCurriculum,
  type ProfileDoc,
} from '@/features/curriculum/profileCurriculumModel';
import {
  exportCurriculumPreviewToPdf,
  sanitizeCurriculumPdfFileName,
} from '@/features/curriculum/exportCurriculumPdf';
import { User, Mail, Phone, ArrowLeft, Briefcase, Calendar, Download, FileText, GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import { useToast } from '@/hooks/use-toast';
import { ApplicantProfileUnavailableBadge } from '@/pages/dashboard/company/ApplicantProfileUnavailableBadge';

interface Profile {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

interface ProfessionalProfile {
  professionalTitle: string | null;
  professionalExperience: string | null;
  skills: string | null;
  languagesList: string | null;
  resumeUrl: string | null;
}

interface ApplicationSummary {
  id: string;
  job_title: string;
  created_at: string;
  status: string | null;
}

function displayValue(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || '—';
}

export default function CandidateProfilePage() {
  const { candidateId } = useParams();
  const { profile: viewerProfile } = useAuth();
  const { t } = useLanguage();
  const { formatDate } = useAppDateTime();
  const { toast } = useToast();
  const cpcCvExportRef = useRef<HTMLDivElement>(null);
  const [exportingCpcCv, setExportingCpcCv] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [profileDoc, setProfileDoc] = useState<ProfileDoc | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const backHref = viewerProfile?.role === 'company' ? '/dashboard/empresa/candidaturas' : '/dashboard/cpc';

  useEffect(() => {
    void fetchCandidate();
  }, [candidateId]);

  async function fetchCandidate() {
    if (!candidateId) return;
    setLoading(true);
    setProfileUnavailable(false);
    setProfessional(null);
    setProfileDoc(null);

    try {
      let prof: ProfileDoc | null = null;

      try {
        prof = await getDocument<ProfileDoc>('profiles', candidateId);
      } catch {
        setProfileUnavailable(true);
      }

      if (prof) {
        setProfileDoc(prof);
        const name = typeof prof.name === 'string' ? prof.name : '';
        setProfile({
          user_id: candidateId,
          name: name || t.get('company.candidate.fallbackName'),
          email: typeof prof.email === 'string' ? prof.email : '',
          phone: typeof prof.phone === 'string' ? prof.phone : null,
          avatar_url: typeof prof.avatar_url === 'string' ? prof.avatar_url : null,
        });

        const firestoreUrl = typeof prof.resumeUrl === 'string' ? prof.resumeUrl.trim() : '';
        const fromStorage = localStorage.getItem(`resume:${candidateId}`);
        const resumeUrl = firestoreUrl || (fromStorage && fromStorage.trim() ? fromStorage.trim() : null);

        setProfessional({
          professionalTitle: typeof prof.professionalTitle === 'string' ? prof.professionalTitle : null,
          professionalExperience: typeof prof.professionalExperience === 'string' ? prof.professionalExperience : null,
          skills: typeof prof.skills === 'string' ? prof.skills : null,
          languagesList: typeof prof.languagesList === 'string' ? prof.languagesList : null,
          resumeUrl,
        });
      } else if (!profileUnavailable) {
        setProfile(null);
      }

      const appsRaw = await queryDocuments<{ id: string; created_at: string; status: string | null; job_id: string }>(
        'job_applications',
        [{ field: 'applicant_id', operator: '==', value: candidateId }],
        undefined
      );
      const apps = [...appsRaw].sort((a, b) => {
        const ta = new Date(a.created_at || '').getTime();
        const tb = new Date(b.created_at || '').getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });

      if (apps.length > 0) {
        const jobIds = Array.from(new Set(apps.map((a) => a.job_id).filter(Boolean)));
        const jobDocs = await Promise.all(jobIds.map((id) => getDocument<{ title?: string | null }>('job_offers', id)));
        const jobsById = new Map<string, { title?: string | null }>();
        jobIds.forEach((id, idx) => {
          const doc = jobDocs[idx];
          if (doc) jobsById.set(id, doc);
        });

        const summaries: ApplicationSummary[] = apps.map((a) => ({
          id: a.id,
          job_title: jobsById.get(a.job_id)?.title || t.get('company.candidate.fallbackOfferTitle'),
          created_at: a.created_at,
          status: a.status,
        }));
        setApplications(summaries);
      } else {
        setApplications([]);
      }
    } catch (e) {
      console.error('Erro ao carregar candidato:', e);
    } finally {
      setLoading(false);
    }
  }

  const skillsTokens = useMemo(() => {
    const tokens = (professional?.skills || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, [professional?.skills]);

  const cpcCurriculumAvailable = useMemo(() => hasCpcCurriculum(profileDoc), [profileDoc]);

  const cpcCurriculumModel = useMemo(
    () =>
      buildCpcCurriculumViewModel(profileDoc, {
        fullName: profile?.name || t.get('company.candidate.fallbackName'),
        professionalTitle: displayValue(professional?.professionalTitle),
        email: profile?.email || '—',
        phone: profile?.phone || '—',
        location: '—',
        summary: '—',
      }),
    [profile?.email, profile?.name, profile?.phone, professional?.professionalTitle, profileDoc, t]
  );

  async function handleDownloadCpcCv() {
    const root = cpcCvExportRef.current;
    if (!root) {
      toast({
        title: t.get('migrant.curriculum.feedback.exportPdfErrorTitle'),
        description: t.get('migrant.curriculum.feedback.exportPdfErrorDescription'),
        variant: 'destructive',
      });
      return;
    }
    setExportingCpcCv(true);
    try {
      const safe = sanitizeCurriculumPdfFileName(cpcCurriculumModel.fullName || 'curriculo');
      await exportCurriculumPreviewToPdf(root, `${safe}.pdf`);
    } catch {
      toast({
        title: t.get('migrant.curriculum.feedback.exportPdfErrorTitle'),
        description: t.get('migrant.curriculum.feedback.exportPdfErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setExportingCpcCv(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile && profileUnavailable) {
    return (
      <div>
        <Link to={backHref} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t.get('company.candidate.backToApplications')}
        </Link>
        <Card className="p-8 text-center space-y-3">
          <ApplicantProfileUnavailableBadge className="inline-flex" />
          <p className="text-muted-foreground">{t.get('company.applications.profileUnavailableHint')}</p>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t.get('company.candidate.notFound')}</p>
          <Link to={backHref} className="text-primary hover:underline mt-2 inline-block">
            {t.get('company.candidate.back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to={backHref} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.get('company.candidate.backToApplications')}
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{profile.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {profile.email}
                  </span>
                  {profile.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {profile.phone}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-6">{t.get('company.candidate.professionalProfile.title')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                  {t.get('company.candidate.professionalProfile.professionalTitle')}
                </p>
                <p className="mt-2 font-medium">{displayValue(professional?.professionalTitle)}</p>
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                  {t.get('company.candidate.professionalProfile.professionalExperience')}
                </p>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {displayValue(professional?.professionalExperience)}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                  {t.get('company.candidate.professionalProfile.skills')}
                </p>
                {skillsTokens.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skillsTokens.map((skill) => (
                      <span key={skill} className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">—</p>
                )}
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                  {t.get('company.candidate.professionalProfile.languages')}
                </p>
                <p className="mt-2 text-sm">{displayValue(professional?.languagesList)}</p>
              </div>
            </div>
          </Card>

          <Card id="curriculo-cpc" className="p-6 scroll-mt-24">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {t.get('company.candidate.cpcCv.title')}
              </h2>
              {cpcCurriculumAvailable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={exportingCpcCv}
                  onClick={() => void handleDownloadCpcCv()}
                >
                  {exportingCpcCv ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {exportingCpcCv
                    ? t.get('migrant.curriculum.actions.exportingPdf')
                    : t.get('company.candidate.cpcCv.download')}
                </Button>
              ) : null}
            </div>
            {cpcCurriculumAvailable ? (
              <div ref={cpcCvExportRef}>
                <CpcCurriculumPreview model={cpcCurriculumModel} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t.get('company.candidate.cpcCv.notAvailable')}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.get('company.candidate.externalCv.title')}
            </h2>
            {professional?.resumeUrl ? (
              <a
                href={professional.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-primary hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                {t.get('company.candidate.externalCv.download')}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{t.get('company.candidate.externalCv.notAvailable')}</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {t.get('company.candidate.applications.title')}
            </h2>
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.get('company.candidate.applications.empty')}</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="p-3 rounded-lg border">
                    <p className="font-medium">{app.job_title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(app.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
