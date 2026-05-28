import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { ActivityDoc } from '@/features/activities/model';
import { formatDuration, toActivityFormatLabel, toActivityStatusLabel, toActivityTypeLabel } from '@/features/activities/model';
import { loadActivityForEdit, removeActivity } from '@/features/activities/controller';

function badgeVariant(status: ActivityDoc['status']): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'agendada') return 'default';
  if (status === 'concluida') return 'outline';
  if (status === 'cancelada') return 'destructive';
  return 'secondary';
}

export default function ActivityDetailsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const params = useParams();
  const activityId = params.activityId || '';
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ActivityDoc | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const doc = await loadActivityForEdit(activityId);
        setRow(doc);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('common.error');
        toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
        setRow(null);
      } finally {
        setLoading(false);
      }
    }
    if (activityId) load();
  }, [activityId, t]);

  const participantSummary = useMemo(() => {
    if (!row) return { migrants: 0, consultants: 0, companies: 0, total: 0 };
    const migrants = row.participantMigrantIds?.length ?? 0;
    const consultants = row.participantConsultantIds?.length ?? 0;
    const companies = row.participantCompanyIds?.length ?? 0;
    return { migrants, consultants, companies, total: migrants + consultants + companies };
  }, [row]);

  async function confirmDelete() {
    if (!row) return;
    const actorId = user?.uid;
    if (!actorId) {
      toast({ title: t.get('common.error'), description: t.get('cpc.activities.errors.no_auth'), variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      await removeActivity({ activityId: row.id, actorId });
      toast({ title: t.get('cpc.activities.delete.success.title'), description: t.get('cpc.activities.delete.success.desc', { title: row.title }) });
      window.location.assign('/dashboard/cpc/atividades');
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = rawMessage.includes('Missing or insufficient permissions')
        ? t.get('cpc.activities.errors.permission_denied')
        : rawMessage || t.get('cpc.activities.errors.delete_failed');
      toast({ title: t.get('common.error'), description: message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="cpc-card p-10 text-center text-sm text-muted-foreground">
        {t.get('cpc.activities.details.not_found')}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard/cpc/atividades" className="inline-flex items-center gap-2 hover:underline">
              <ArrowLeft className="h-4 w-4" />
              {t.get('cpc.activities.actions.back')}
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 truncate">{row.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary">{toActivityTypeLabel(row.activityType)}</Badge>
            <Badge variant="secondary">{toActivityFormatLabel(row.format)}</Badge>
            <Badge variant={badgeVariant(row.status)}>{toActivityStatusLabel(row.status)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/dashboard/cpc/atividades/${row.id}/editar`}>
            <Button className="gap-2">
              <Pencil className="h-4 w-4" />
              {t.get('cpc.activities.actions.edit')}
            </Button>
          </Link>
          <Button variant="outline" className="gap-2" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            {t.get('cpc.activities.actions.delete')}
          </Button>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.get('cpc.activities.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t.get('cpc.activities.delete.description', { title: row.title })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.get('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.get('cpc.activities.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

