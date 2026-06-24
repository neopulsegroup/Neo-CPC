import { useEffect, useMemo, useState } from 'react';
import { Loader2, Download, Target } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getCollection } from '@/integrations/firebase/firestore';
import {
  summarizeParticipantScas,
  type ScasAssessmentDoc,
} from '@/lib/scas/repository';
import { downloadCsv } from '@/features/scas/scasExport';

const EMPIS_GOAL = 70;

interface ProfileRow {
  id: string;
  name?: string | null;
}

interface ParticipantAggregate {
  participantId: string;
  name: string;
  t0Global: number | null;
  finalGlobal: number | null;
  variationPercent: number | null;
  metaReached: boolean;
  internalAlert: boolean;
  hasFinal: boolean;
}

export default function ScasDashboardPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<ParticipantAggregate[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [allAssessments, profiles] = await Promise.all([
          getCollection<ScasAssessmentDoc>('scas_assessments'),
          getCollection<ProfileRow>('profiles'),
        ]);
        if (cancelled) return;

        const nameById = new Map<string, string>();
        for (const p of profiles) nameById.set(p.id, p.name ?? p.id);

        const byParticipant = new Map<string, ScasAssessmentDoc[]>();
        for (const a of allAssessments) {
          if (a.status !== 'SUBMITTED') continue;
          const list = byParticipant.get(a.participant_id) ?? [];
          list.push(a);
          byParticipant.set(a.participant_id, list);
        }

        const rows: ParticipantAggregate[] = [];
        for (const [participantId, list] of byParticipant.entries()) {
          const summary = summarizeParticipantScas(list);
          if (!summary.t0) continue;
          rows.push({
            participantId,
            name: nameById.get(participantId) ?? participantId,
            t0Global: summary.t0.score_global,
            finalGlobal: summary.latestFinal?.score_global ?? null,
            variationPercent: summary.improvement?.variationPercent ?? null,
            metaReached: summary.improvement?.meta_atingida ?? false,
            internalAlert: summary.improvement?.alarme_interno ?? false,
            hasFinal: !!summary.latestFinal,
          });
        }
        rows.sort((a, b) => (b.variationPercent ?? -999) - (a.variationPercent ?? -999));
        setAggregates(rows);
      } catch (error) {
        console.error('Erro ao carregar dashboard SCAS', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = aggregates.length;
    const withFinal = aggregates.filter((a) => a.hasFinal).length;
    const metas = aggregates.filter((a) => a.metaReached).length;
    const alerts = aggregates.filter((a) => a.internalAlert).length;
    return { total, withFinal, metas, alerts };
  }, [aggregates]);

  const handleExport = () => {
    const header = ['participante', 'participante_id', 'T0_global', 'final_global', 'variacao_%', 'meta_atingida'];
    const rows = aggregates.map((a) => [
      a.name,
      a.participantId,
      a.t0Global?.toFixed(2) ?? '',
      a.finalGlobal?.toFixed(2) ?? '',
      a.variationPercent?.toFixed(2) ?? '',
      a.metaReached ? 'sim' : 'nao',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => (/[",\n;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
      .join('\n');
    downloadCsv('scas_dashboard.csv', csv);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const goalPercent = Math.min(100, Math.round((stats.metas / EMPIS_GOAL) * 100));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            {t.get('scas.dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t.get('scas.dashboard.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={aggregates.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          {t.get('scas.cpc.exportCsv')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">{t.get('scas.dashboard.participantsWithImprovement')}</p>
            <p className="text-3xl font-bold">{stats.metas}</p>
            <p className="text-xs text-muted-foreground">/ {EMPIS_GOAL}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 space-y-2">
            <p className="text-sm text-muted-foreground">{t.get('scas.dashboard.goalProgress')}</p>
            <Progress value={goalPercent} />
            <p className="text-xs text-muted-foreground">{goalPercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">{t.get('scas.dashboard.withFinalAssessment')}</p>
            <p className="text-3xl font-bold">{stats.withFinal}</p>
            <p className="text-xs text-muted-foreground">/ {stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">{t.get('scas.dashboard.internalAlerts')}</p>
            <p className="text-3xl font-bold">{stats.alerts}</p>
          </CardContent>
        </Card>
      </div>

      <div className="cpc-card p-6 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3">Participante</th>
              <th className="py-2 pr-3">T0</th>
              <th className="py-2 pr-3">Final</th>
              <th className="py-2 pr-3">{t.get('scas.cpc.variation')}</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {aggregates.map((a) => (
              <tr key={a.participantId} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{a.name}</td>
                <td className="py-2 pr-3">{a.t0Global?.toFixed(2) ?? '—'}</td>
                <td className="py-2 pr-3">{a.finalGlobal?.toFixed(2) ?? '—'}</td>
                <td className="py-2 pr-3">
                  {a.variationPercent != null ? `${a.variationPercent.toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 pr-3">
                  {a.metaReached ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      {t.get('scas.cpc.metaReached')}
                    </span>
                  ) : a.internalAlert ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {t.get('scas.cpc.internalAlert')}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {aggregates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.get('scas.cpc.noData')}</p>
        ) : null}
      </div>
    </div>
  );
}
