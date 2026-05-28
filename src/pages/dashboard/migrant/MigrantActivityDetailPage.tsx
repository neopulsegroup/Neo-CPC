import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityDoc } from '@/features/activities/model';
import { formatDuration, toActivityFormatLabel, toActivityStatusLabel, toActivityTypeLabel } from '@/features/activities/model';
import { getActivity } from '@/features/activities/repository';

function badgeVariant(status: ActivityDoc['status']): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'agendada') return 'default';
  if (status === 'concluida') return 'outline';
  if (status === 'cancelada') return 'destructive';
  return 'secondary';
}

export default function MigrantActivityDetailPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activityId } = useParams<{ activityId: string }>();
  const id = activityId || '';
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ActivityDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setRow(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const doc = await getActivity(id);
        if (cancelled) return;
        setRow(doc);
      } catch {
        if (!cancelled) setRow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const allowed = useMemo(() => {
    if (!row || !user?.uid) return false;
    const ids = row.participantMigrantIds || [];
    if (ids.includes(user.uid)) return true;
    const em = user.email?.trim();
    if (!em) return false;
    if (ids.includes(em)) return true;
    if (ids.includes(em.toLowerCase())) return true;
    return false;
  }, [row, user?.uid, user?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!row || !allowed) {
    return (
      <div className="cpc-card p-10 text-center text-sm text-muted-foreground">
        <p>{t.get('cpc.activities.details.not_found')}</p>
        <Link to="/dashboard/migrante/atividades" className="inline-block mt-4 text-sm text-primary hover:underline">
          {t.get('dashboard.activities_back_list')}
        </Link>
      </div>
    );
  }

  const participantSummary = (() => {
    const migrants = row.participantMigrantIds?.length ?? 0;
    const consultants = row.participantConsultantIds?.length ?? 0;
    const companies = row.participantCompanyIds?.length ?? 0;
    return { migrants, consultants, companies, total: migrants + consultants + companies };
  })();

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard/migrante/atividades" className="inline-flex items-center gap-2 hover:underline">
              <ArrowLeft className="h-4 w-4" />
              {t.get('dashboard.activities_back_list')}
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 truncate">{row.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary">{toActivityTypeLabel(row.activityType)}</Badge>
            <Badge variant="secondary">{toActivityFormatLabel(row.format)}</Badge>
            <Badge variant={badgeVariant(row.status)}>{toActivityStatusLabel(row.status)}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.details.sections.general')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.date')}</p>
                  <p className="font-semibold mt-1">{row.date}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.time')}</p>
                  <p className="font-semibold mt-1">
                    {row.startTime} - {row.endTime}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDuration(row.durationMinutes)}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.location')}</p>
                <p className="font-semibold mt-1 break-words">{row.location || '—'}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.consultants')}</p>
                <p className="font-semibold mt-1">{(row.consultantNames || []).join(', ') || '—'}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.fields.topics')}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(row.topics || []).length ? (row.topics || []).map((topic) => <Badge key={topic} variant="outline">{topic}</Badge>) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{t.get('cpc.activities.details.sections.participants')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.details.participants.total')}</p>
                <p className="text-2xl font-bold mt-1">{participantSummary.total}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.details.participants.migrants')}</p>
                  <p className="font-semibold mt-1">{participantSummary.migrants}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.details.participants.consultants')}</p>
                  <p className="font-semibold mt-1">{participantSummary.consultants}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('cpc.activities.details.participants.companies')}</p>
                  <p className="font-semibold mt-1">{participantSummary.companies}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
