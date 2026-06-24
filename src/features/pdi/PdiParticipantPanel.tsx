import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, FileCheck, RefreshCw, Send, CheckCircle2, Circle, Clock } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCollection, queryDocuments } from '@/integrations/firebase/firestore';
import { toast } from 'sonner';
import {
  type PdiApoioEntry,
  type PdiApoioType,
  type PdiDoc,
  type PdiTrailState,
  PDI_TRAIL_STATE_OPTIONS,
  buildEditableTrilhasList,
  computePdiTrailProgress,
  includedTrilhas,
  isPdiEditable,
  setTrailStateInPdiTrilhas,
  sortTrailCatalogRows,
  type TrailProgressRow,
} from '@/lib/pdi';
import type { ScasDomain } from '@/lib/scas';
import {
  fetchParticipantAssessments,
  summarizeParticipantScas,
  type ScasAssessmentDoc,
} from '@/lib/scas/repository';
import type { PdiAcceptanceDoc } from '@/lib/pdi/types';
import {
  fetchPdiAcceptance,
  fetchParticipantPdiHistory,
  generatePdiFromT0,
  revisePdi,
  updatePdiDraft,
  validateAndSendPdi,
} from '@/lib/pdi/repository';

interface TrailRow {
  id: string;
  title: string;
  scas_domain?: ScasDomain | null;
  is_active?: boolean;
}

const APOIO_TYPES: PdiApoioType[] = [
  'JURIDICO',
  'NECESSIDADES_BASICAS',
  'PSICOLOGICO',
  'SOCIOPROFISSIONAL',
  'OUTRO',
];

export interface PdiParticipantPanelProps {
  participantId: string;
}

export function PdiParticipantPanel({ participantId }: PdiParticipantPanelProps) {
  const { t } = useLanguage();
  const { formatDateTime } = useAppDateTime();

  const [loading, setLoading] = useState(true);
  const [pdi, setPdi] = useState<PdiDoc | null>(null);
  const [acceptedPdi, setAcceptedPdi] = useState<PdiDoc | null>(null);
  const [history, setHistory] = useState<PdiDoc[]>([]);
  const [trails, setTrails] = useState<TrailRow[]>([]);
  const [trailProgress, setTrailProgress] = useState<TrailProgressRow[]>([]);
  const [assessments, setAssessments] = useState<ScasAssessmentDoc[]>([]);
  const [acceptance, setAcceptance] = useState<PdiAcceptanceDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviseReason, setReviseReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pdiHistory = await fetchParticipantPdiHistory(participantId);
      const active =
        pdiHistory.find(
          (d) =>
            d.status === 'DRAFT_GENERATED' ||
            d.status === 'IN_REVIEW' ||
            d.status === 'VALIDATED'
        ) ?? null;
      const accepted =
        pdiHistory.find((d) => d.status === 'ACCEPTED') ?? null;

      const [allTrails, progress, scasList, acceptanceDoc] = await Promise.all([
        getCollection<TrailRow>('trails'),
        queryDocuments<TrailProgressRow>('user_trail_progress', [
          { field: 'user_id', operator: '==', value: participantId },
        ]),
        fetchParticipantAssessments(participantId),
        accepted ? fetchPdiAcceptance(accepted.id) : Promise.resolve(null),
      ]);

      setHistory(pdiHistory);
      setPdi(active);
      setAcceptedPdi(accepted);
      setTrails(allTrails);
      setTrailProgress(progress);
      setAssessments(scasList);
      setAcceptance(acceptanceDoc);
    } catch (error) {
      console.error('Erro ao carregar PDI', error);
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayPdi = pdi ?? acceptedPdi;
  const isTracking = displayPdi?.status === 'ACCEPTED';
  const editable = pdi ? isPdiEditable(pdi) : false;
  const reviseTarget = pdi ?? acceptedPdi;

  const trailTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tr of trails) map.set(tr.id, tr.title);
    return map;
  }, [trails]);

  const catalogTrails = useMemo(
    () => sortTrailCatalogRows(trails.filter((tr) => tr.is_active !== false)),
    [trails]
  );

  const displayTrilhas = useMemo(() => {
    if (!displayPdi) return [];
    if (editable) {
      return buildEditableTrilhasList(catalogTrails, displayPdi.trilhas);
    }
    return includedTrilhas(displayPdi.trilhas);
  }, [displayPdi, editable, catalogTrails]);

  const trailProgressSummary = useMemo(() => {
    if (!displayPdi) return null;
    return computePdiTrailProgress(displayPdi.trilhas, trailProgress);
  }, [displayPdi, trailProgress]);

  const scasSummary = useMemo(() => summarizeParticipantScas(assessments), [assessments]);

  const handleGenerate = async () => {
    setBusy('generate');
    try {
      const result = await generatePdiFromT0(participantId);
      if (result.ok) toast.success(t.get('pdi.cpc.generated'));
      await load();
    } catch (error) {
      console.error(error);
      toast.error(t.get('pdi.errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!pdi || !editable) return;
    setBusy('save');
    try {
      await updatePdiDraft(pdi.id, {
        trilhas: pdi.trilhas,
        apoios: pdi.apoios,
        notes: pdi.notes,
        status: pdi.status === 'DRAFT_GENERATED' ? 'IN_REVIEW' : pdi.status,
      });
      toast.success(t.get('pdi.cpc.saved'));
      await load();
    } catch (error) {
      console.error(error);
      toast.error(t.get('pdi.errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const handleValidateSend = async () => {
    if (!pdi) return;
    setBusy('send');
    try {
      await updatePdiDraft(pdi.id, {
        trilhas: pdi.trilhas,
        apoios: pdi.apoios,
        notes: pdi.notes,
        status: 'IN_REVIEW',
      });
      const result = await validateAndSendPdi(pdi.id);
      if (result.ok) toast.success(t.get('pdi.cpc.sent'));
      await load();
    } catch (error) {
      console.error(error);
      toast.error(t.get('pdi.errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const handleRevise = async () => {
    if (!reviseTarget || reviseReason.trim().length < 3) return;
    setBusy('revise');
    try {
      await revisePdi(reviseTarget.id, reviseReason.trim());
      toast.success(t.get('pdi.cpc.revised'));
      setReviseReason('');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(t.get('pdi.errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const updateTrailState = (trailId: string, state: PdiTrailState) => {
    if (!pdi) return;
    const catalogTrail = catalogTrails.find((tr) => tr.id === trailId) ?? null;
    setPdi({
      ...pdi,
      trilhas: setTrailStateInPdiTrilhas(pdi.trilhas, trailId, state, catalogTrail),
    });
  };

  const addApoio = () => {
    if (!pdi) return;
    setPdi({
      ...pdi,
      apoios: [...pdi.apoios, { type: 'OUTRO', level: null, options: [], notes: null }],
    });
  };

  const updateApoio = (index: number, patch: Partial<PdiApoioEntry>) => {
    if (!pdi) return;
    setPdi({
      ...pdi,
      apoios: pdi.apoios.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    });
  };

  const removeApoio = (index: number) => {
    if (!pdi) return;
    setPdi({ ...pdi, apoios: pdi.apoios.filter((_, i) => i !== index) });
  };

  const variationBadge = (() => {
    if (!scasSummary.improvement) {
      return (
        <span className="text-xs text-muted-foreground">{t.get('pdi.cpc.scasPendingFinal')}</span>
      );
    }
    const { variationPercent, meta_atingida, alarme_interno } = scasSummary.improvement;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="cpc-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            {t.get('pdi.cpc.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isTracking ? t.get('pdi.cpc.trackingSubtitle') : t.get('pdi.cpc.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!pdi && !acceptedPdi ? (
            <Button size="sm" onClick={() => void handleGenerate()} disabled={busy === 'generate'}>
              {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.get('pdi.cpc.generate')}
            </Button>
          ) : null}
          {editable ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void handleSave()} disabled={busy === 'save'}>
                {t.get('pdi.cpc.save')}
              </Button>
              <Button size="sm" onClick={() => void handleValidateSend()} disabled={busy === 'send'}>
                <Send className="h-4 w-4 mr-1" />
                {t.get('pdi.cpc.validateSend')}
              </Button>
            </>
          ) : null}
          {pdi?.status === 'VALIDATED' || acceptedPdi ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRevise()}
              disabled={busy === 'revise' || reviseReason.trim().length < 3}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t.get('pdi.cpc.revise')}
            </Button>
          ) : null}
        </div>
      </div>

      {displayPdi ? (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <strong>{t.get('pdi.fields.version')}:</strong> {displayPdi.version}
            </span>
            <span>
              <strong>{t.get('pdi.fields.status')}:</strong> {t.get(`pdi.status.${displayPdi.status}`)}
            </span>
            <span>
              <strong>{t.get('pdi.fields.scoreGlobal')}:</strong>{' '}
              {displayPdi.score_global?.toFixed(2) ?? '—'} → {displayPdi.target_global?.toFixed(2) ?? '—'}
            </span>
            {isTracking && (acceptance?.accepted_at || displayPdi.accepted_at) ? (
              <span>
                <strong>{t.get('pdi.cpc.acceptedAt')}:</strong>{' '}
                {formatDateTime(acceptance?.accepted_at ?? displayPdi.accepted_at ?? '')}
              </span>
            ) : null}
          </div>

          {isTracking && trailProgressSummary ? (
            <div className="rounded-lg bg-muted/40 p-4 space-y-3">
              <h3 className="font-medium">{t.get('pdi.cpc.trackingTitle')}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t.get('pdi.cpc.trailsProgressLabel')}</p>
                  <p className="text-lg font-semibold">
                    {t.get('pdi.cpc.trailsProgress', {
                      completed: String(trailProgressSummary.completed),
                      total: String(trailProgressSummary.total),
                    })}
                  </p>
                  <Progress value={trailProgressSummary.overallPercent} className="mt-2 h-2" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.get('pdi.cpc.trailsInProgress')}</p>
                  <p className="text-lg font-semibold">{trailProgressSummary.inProgress}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.get('pdi.cpc.scasEvolution')}</p>
                  <div className="mt-1">{variationBadge}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div>
              <h3 className="font-medium">{t.get('pdi.sections.trilhas')}</h3>
              {editable ? (
                <p className="text-xs text-muted-foreground mt-1">{t.get('pdi.cpc.trilhasHint')}</p>
              ) : null}
            </div>
            {displayTrilhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.get('pdi.cpc.noTrilhasCatalog')}</p>
            ) : (
              displayTrilhas.map((entry) => {
                const progDetail = trailProgressSummary?.details.find((d) => d.trail_id === entry.trail_id);
                return (
                  <div
                    key={entry.trail_id}
                    className={`rounded border p-3 space-y-2 ${
                      entry.recommended_state === 'NAO_INCLUIDA' && editable ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {trailTitleById.get(entry.trail_id) ?? entry.trail_id}
                        </p>
                        {entry.scas_domain ? (
                          <p className="text-xs text-muted-foreground">
                            {t.get(`scas.domains.${entry.scas_domain}`)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t.get('pdi.cpc.noScasDomain')}</p>
                        )}
                      </div>
                      {editable ? (
                        <Select
                          value={entry.recommended_state}
                          onValueChange={(v) => updateTrailState(entry.trail_id, v as PdiTrailState)}
                        >
                          <SelectTrigger className="w-44 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PDI_TRAIL_STATE_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {t.get(`pdi.trailState.${opt}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm shrink-0">
                          {t.get(`pdi.trailState.${entry.recommended_state}`)}
                        </span>
                      )}
                    </div>
                    {isTracking && progDetail ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {progDetail.completed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : progDetail.inProgress ? (
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Circle className="h-3.5 w-3.5" />
                            )}
                            {progDetail.completed
                              ? t.get('pdi.cpc.trailCompleted')
                              : progDetail.inProgress
                                ? t.get('pdi.cpc.trailInProgress', { percent: String(progDetail.percent) })
                                : t.get('pdi.cpc.trailNotStarted')}
                          </span>
                          {progDetail.completed && progDetail.completed_at ? (
                            <span>{formatDateTime(progDetail.completed_at)}</span>
                          ) : null}
                        </div>
                        <Progress value={progDetail.percent} className="h-1.5" />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{t.get('pdi.sections.apoios')}</h3>
              {editable ? (
                <Button size="sm" variant="outline" onClick={addApoio}>
                  {t.get('pdi.cpc.addApoio')}
                </Button>
              ) : null}
            </div>
            {displayPdi.apoios.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.get('pdi.cpc.noApoios')}</p>
            ) : (
              displayPdi.apoios.map((apoio, index) => (
                <div key={index} className="rounded border p-3 space-y-2">
                  {editable ? (
                    <Select
                      value={apoio.type}
                      onValueChange={(v) => updateApoio(index, { type: v as PdiApoioType })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APOIO_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t.get(`pdi.apoios.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm font-medium">{t.get(`pdi.apoios.${apoio.type}`)}</p>
                  )}
                  {apoio.notes || editable ? (
                    <Textarea
                      value={apoio.notes ?? ''}
                      onChange={(e) => updateApoio(index, { notes: e.target.value })}
                      placeholder={t.get('pdi.cpc.apoioNotes')}
                      disabled={!editable}
                      rows={2}
                    />
                  ) : null}
                  {editable ? (
                    <Button size="sm" variant="ghost" onClick={() => removeApoio(index)}>
                      {t.get('pdi.cpc.remove')}
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">{t.get('pdi.sections.objetivos')}</h3>
            {editable ? (
              <Textarea
                value={displayPdi.notes ?? ''}
                onChange={(e) => pdi && setPdi({ ...pdi, notes: e.target.value })}
                placeholder={t.get('pdi.cpc.notesPlaceholder')}
                rows={3}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {displayPdi.notes?.trim() ? displayPdi.notes : t.get('pdi.migrant.defaultObjectives')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.get('pdi.cpc.noPdi')}</p>
      )}

      {(pdi?.status === 'VALIDATED' || acceptedPdi) && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="font-medium">{t.get('pdi.cpc.reviseTitle')}</h3>
          <Textarea
            value={reviseReason}
            onChange={(e) => setReviseReason(e.target.value)}
            placeholder={t.get('pdi.cpc.reviseReason')}
            rows={2}
          />
        </div>
      )}

      {history.length > 1 ? (
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">{t.get('pdi.cpc.history')}</h3>
          <ul className="text-sm space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-muted-foreground">
                v{h.version} · {t.get(`pdi.status.${h.status}`)} · {h.created_at?.slice(0, 10)}
                {h.accepted_at ? ` · ${t.get('pdi.cpc.acceptedAt')} ${h.accepted_at.slice(0, 10)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
