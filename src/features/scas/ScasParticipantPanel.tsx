import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageSquarePlus, Download, ClipboardList } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import { Button } from '@/components/ui/button';
import { getCollection } from '@/integrations/firebase/firestore';
import {
  summarizeParticipantScas,
  type ScasAssessmentDoc,
} from '@/lib/scas/repository';
import { fetchParticipantAssessments } from '@/lib/scas/repository';
import { buildParticipantScasCsv, downloadCsv } from './scasExport';

interface TrailRow {
  id: string;
  title: string;
}

export interface ScasParticipantPanelProps {
  participantId: string;
  participantName: string;
  canAssist: boolean;
}

export function ScasParticipantPanel({
  participantId,
  participantName,
  canAssist,
}: ScasParticipantPanelProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { formatDateTime } = useAppDateTime();

  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<ScasAssessmentDoc[]>([]);
  const [trails, setTrails] = useState<TrailRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, allTrails] = await Promise.all([
        fetchParticipantAssessments(participantId),
        getCollection<TrailRow>('trails'),
      ]);
      setAssessments(list);
      setTrails(allTrails);
    } catch (error) {
      console.error('Erro ao carregar painel SCAS', error);
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeParticipantScas(assessments), [assessments]);
  const submitted = summary.submitted;
  const trailTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tr of trails) map.set(tr.id, tr.title);
    return map;
  }, [trails]);

  const handleExport = useCallback(() => {
    const csv = buildParticipantScasCsv(participantName, summary);
    downloadCsv(`scas_${participantId}.csv`, csv);
  }, [participantName, summary, participantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const variationBadge = (() => {
    if (!summary.improvement) {
      return <span className="text-xs text-muted-foreground">{t.get('scas.cpc.pendingFinal')}</span>;
    }
    const { variationPercent, meta_atingida, alarme_interno } = summary.improvement;
    const cls = meta_atingida
      ? 'bg-green-100 text-green-800'
      : alarme_interno
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
    const label = meta_atingida
      ? t.get('scas.cpc.metaReached')
      : alarme_interno
        ? t.get('scas.cpc.internalAlert')
        : t.get('scas.cpc.belowTarget');
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
        {variationPercent.toFixed(1)}% · {label}
      </span>
    );
  })();

  return (
    <div className="cpc-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {t.get('scas.cpc.sectionTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t.get('scas.cpc.sectionSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {canAssist ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/dashboard/cpc/migrantes/${participantId}/scas`)}
            >
              <MessageSquarePlus className="h-4 w-4 mr-1" />
              {t.get('scas.cpc.assistedFill')}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={handleExport} disabled={submitted.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            {t.get('scas.cpc.exportCsv')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{t.get('scas.cpc.variation')}:</span>
        {variationBadge}
      </div>

      {submitted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.get('scas.cpc.noData')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">{t.get('scas.cpc.moment')}</th>
                <th className="py-2 pr-3">{t.get('scas.cpc.date')}</th>
                <th className="py-2 pr-3">D1</th>
                <th className="py-2 pr-3">D2</th>
                <th className="py-2 pr-3">D3</th>
                <th className="py-2 pr-3">D4</th>
                <th className="py-2 pr-3">{t.get('scas.cpc.global')}</th>
                <th className="py-2 pr-3">{t.get('scas.cpc.mode')}</th>
                <th className="py-2 pr-3">{t.get('scas.cpc.language')}</th>
              </tr>
            </thead>
            <tbody>
              {submitted.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">
                    {t.get(`scas.moments.${a.moment_type}`)}
                    {a.trail_id ? (
                      <span className="block text-xs text-muted-foreground">
                        {trailTitleById.get(a.trail_id) ?? a.trail_id}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {a.submitted_at ? formatDateTime(a.submitted_at) : '—'}
                  </td>
                  <td className="py-2 pr-3">{a.score_d1?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 pr-3">{a.score_d2?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 pr-3">{a.score_d3?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 pr-3">{a.score_d4?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 pr-3 font-semibold">{a.score_global?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 pr-3">
                    {a.mode === 'ASSISTIDO'
                      ? t.get('scas.cpc.assistedBy', { name: a.assisted_by_user_id ?? '' })
                      : t.get('scas.mode.AUTONOMO')}
                  </td>
                  <td className="py-2 pr-3 uppercase">{a.language}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">{t.get('scas.cpc.readOnly')}</p>
        </div>
      )}

    </div>
  );
}
