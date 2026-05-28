import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { Card } from '@/components/ui/card';
import { User, Mail, Phone, ArrowLeft, Briefcase, Calendar, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { language, t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
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

    try {
      let prof: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
        resumeUrl?: string | null;
        professionalTitle?: string | null;
        professionalExperience?: string | null;
        skills?: string | null;
        languagesList?: string | null;
      } | null = null;

      try {
        prof = await getDocument<typeof prof>('profiles', candidateId);
      } catch {
        setProfileUnavailable(true);
      }

      if (prof) {
        setProfile({
          user_id: candidateId,
          name: prof.name || t.get('company.candidate.fallbackName'),
          email: prof.email || '',
          phone: prof.phone ?? null,
          avatar_url: prof.avatar_url ?? null,
        });

        const firestoreUrl = typeof prof.resumeUrl === 'string' ? prof.resumeUrl.trim() : '';
        const fromStorage = localStorage.getItem(`resume:${candidateId}`);
        const resumeUrl = firestoreUrl || (fromStorage && fromStorage.trim() ? fromStorage.trim() : null);

        setProfessional({
          professionalTitle: prof.professionalTitle ?? null,
          professionalExperience: prof.professionalExperience ?? null,
          skills: prof.skills ?? null,
          languagesList: prof.languagesList ?? null,
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

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';

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

              <div className="md:col-span-2 pt-2 border-t">
                <p className="text-[11px] tracking-wider text-muted-foreground uppercase mb-3">
                  {t.get('company.candidate.professionalProfile.resume')}
                </p>
                {professional?.resumeUrl ? (
                  <div className="space-y-4">
                    <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                      <iframe
                        src={professional.resumeUrl}
                        className="w-full h-full"
                        title={t.get('company.candidate.resume.iframeTitle')}
                      />
                    </div>
                    <a
                      href={professional.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t.get('company.candidate.resume.openInNewWindow')}
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.get('company.candidate.resume.notAvailable')}</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
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
                      {new Date(app.created_at).toLocaleDateString(locale)}
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
