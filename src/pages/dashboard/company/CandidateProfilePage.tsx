import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { Card } from '@/components/ui/card';
import { User, Mail, Phone, ArrowLeft, FileText, Briefcase, Calendar, ExternalLink, BookOpen, CheckCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Profile {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

interface ApplicationSummary {
  id: string;
  job_title: string;
  created_at: string;
  status: string | null;
}

export default function CandidateProfilePage() {
  const { candidateId } = useParams();
  const { profile: viewerProfile } = useAuth();
  const { language, t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; session_type: string; scheduled_date: string; scheduled_time: string; status: string | null }>>([]);
  const [progress, setProgress] = useState<Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>>([]);
  const [trails, setTrails] = useState<Record<string, { id: string; title: string; modules_count: number | null }>>({});

  useEffect(() => {
    fetchCandidate();
  }, [candidateId]);

  async function fetchCandidate() {
    if (!candidateId) return;
    try {
      const prof = await getDocument<{
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
        resumeUrl?: string | null;
      }>('profiles', candidateId);

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
        if (firestoreUrl) setResumeUrl(firestoreUrl);
        else if (fromStorage) setResumeUrl(fromStorage);
        else setResumeUrl(null);
      } else {
        const demo = getDemoProfile(candidateId);
        setProfile(demo);
        setResumeUrl(getDemoResume(candidateId));
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
        const jobIds = Array.from(new Set(apps.map(a => a.job_id).filter(Boolean)));
        const jobDocs = await Promise.all(jobIds.map((id) => getDocument<{ title?: string | null }>('job_offers', id)));
        const jobsById = new Map<string, { title?: string | null }>();
        jobIds.forEach((id, idx) => {
          const doc = jobDocs[idx];
          if (doc) jobsById.set(id, doc);
        });

        const summaries: ApplicationSummary[] = apps.map(a => ({
          id: a.id,
          job_title: jobsById.get(a.job_id)?.title || t.get('company.candidate.fallbackOfferTitle'),
          created_at: a.created_at,
          status: a.status,
        }));
        setApplications(summaries);
      } else {
        setApplications([]);
      }

      const sess = await queryDocuments<{ id: string; session_type: string; scheduled_date: string; scheduled_time: string; status: string | null }>(
        'sessions',
        [{ field: 'migrant_id', operator: '==', value: candidateId }],
        { field: 'scheduled_date', direction: 'asc' }
      );
      setSessions(sess || []);

      const progArr = await queryDocuments<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>(
        'user_trail_progress',
        [{ field: 'user_id', operator: '==', value: candidateId }]
      );
      setProgress(progArr);
      const trailIds = Array.from(new Set(progArr.map(p => p.trail_id).filter(Boolean)));
      if (trailIds.length > 0) {
        const map: Record<string, { id: string; title: string; modules_count: number | null }> = {};
        const trailDocs = await Promise.all(trailIds.map((id) => getDocument<{ id: string; title: string; modules_count: number | null }>('trails', id)));
        trailDocs.forEach((t) => {
          if (t?.id) map[t.id] = t;
        });
        setTrails(map);
      } else {
        setTrails({});
      }

    } catch (e) {
      console.error('Erro ao carregar candidato:', e);
    } finally {
      setLoading(false);
    }
  }

  function getDemoProfile(id: string): Profile {
    const demos: Record<string, Profile> = {
      '1': { user_id: '1', name: 'Maria Silva', email: 'maria.silva@example.com', phone: '+351 910 000 001', avatar_url: null },
      '2': { user_id: '2', name: 'Ahmed Hassan', email: 'ahmed.hassan@example.com', phone: '+351 910 000 002', avatar_url: null },
      '3': { user_id: '3', name: 'Ana Pereira', email: 'ana.pereira@example.com', phone: '+351 910 000 003', avatar_url: null },
    };
    return demos[id] || { user_id: id, name: t.get('company.candidate.fallbackName'), email: 'candidato@example.com', phone: null, avatar_url: null };
  }

  function getDemoResume(id: string): string | null {
    return 'https://example.com/cv-demo.pdf';
  }

  if (loading) {
    return (
      <Layout>
        <div className="cpc-section">
          <div className="cpc-container">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="cpc-section">
          <div className="cpc-container">
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t.get('company.candidate.notFound')}</p>
              <Link
                to={viewerProfile?.role === 'company' ? "/dashboard/empresa" : "/dashboard/cpc"}
                className="text-primary hover:underline mt-2 inline-block"
              >
                {t.get('company.candidate.back')}
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <Link to={viewerProfile?.role === 'company' ? "/dashboard/empresa" : "/dashboard/cpc"} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t.get('company.candidate.backToDashboard')}
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
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.email}</span>
                      {profile.phone && (<span className="flex items-center gap-1"><Phone className="h-3 w-3" />{profile.phone}</span>)}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5" /> {t.get('company.candidate.resume.title')}</h2>
                {resumeUrl ? (
                  <div className="space-y-4">
                    <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                      <iframe src={resumeUrl} className="w-full h-full" title={t.get('company.candidate.resume.iframeTitle')} />
                    </div>
                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      {t.get('company.candidate.resume.openInNewWindow')}
                    </a>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {t.get('company.candidate.resume.notAvailable')}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="h-5 w-5" /> {t.get('company.candidate.sessions.title')}</h2>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.get('company.candidate.sessions.empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{s.session_type}</p>
                            <p className="text-xs text-muted-foreground">{t.get('company.candidate.sessions.status', { status: s.status || t.get('company.candidate.sessions.defaultStatus') })}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-medium">{new Date(s.scheduled_date).toLocaleDateString(locale)}</p>
                          <p className="text-muted-foreground">{s.scheduled_time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5" /> {t.get('company.candidate.trails.title')}</h2>
                {progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.get('company.candidate.trails.empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {progress.map((p) => {
                      const trail = trails[p.trail_id];
                      const isCompleted = p.completed_at !== null;
                      const percent = p.progress_percent || 0;
                      const total = trail?.modules_count || 0;
                      const completed = p.modules_completed || 0;
                      return (
                        <Link key={p.trail_id} to={`/dashboard/migrante/trilhas/${p.trail_id}`} className="block p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">{trail?.title || p.trail_id}</p>
                            {isCompleted ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> {t.get('company.candidate.trails.completed')}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {t.get('company.candidate.trails.modulesProgress', { completed, total })}
                              </span>
                            )}
                          </div>
                          <Progress value={percent} className="h-2" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5" /> {t.get('company.candidate.applications.title')}</h2>
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.get('company.candidate.applications.empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {applications.map(app => (
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
      </div>
    </Layout>
  );
}
