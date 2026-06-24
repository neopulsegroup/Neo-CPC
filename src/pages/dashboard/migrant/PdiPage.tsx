import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  CheckCircle2,
  Download,
  FileText,
  FileCheck,
  ChevronRight,
  Play,
  Plus,
  Search,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { getCollection, queryDocuments } from '@/integrations/firebase/firestore';
import { toast } from 'sonner';
import {
  PDI_REVIEW_SECTIONS,
  type PdiDoc,
  type PdiReviewSection,
  type PdiTrilhaEntry,
  allReviewSectionsViewed,
  canAcceptPdi,
  computePdiTrailProgress,
} from '@/lib/pdi';
import {
  acceptPdi,
  fetchMigrantPdi,
  markPdiSectionViewed,
} from '@/lib/pdi/repository';
import { downloadPdiPdf } from '@/features/pdi/pdiPdf';
import { cn } from '@/lib/utils';

interface TrailRow {
  id: string;
  title: string;
  description?: string | null;
}

interface TrailProgressRow {
  trail_id: string;
  completed_at?: string | null;
  progress_percent?: number | null;
}

function trailTagClass(state: PdiTrilhaEntry['recommended_state']): string {
  if (state === 'OBRIGATORIA') return 'bg-red-50 text-red-700 border-red-200';
  if (state === 'RECOMENDADA') return 'bg-violet-50 text-violet-700 border-violet-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function PdiPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [pdi, setPdi] = useState<PdiDoc | null>(null);
  const [trails, setTrails] = useState<TrailRow[]>([]);
  const [progress, setProgress] = useState<TrailProgressRow[]>([]);
  const [viewed, setViewed] = useState<Set<PdiReviewSection>>(new Set());
  const [declared, setDeclared] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showAllOptional, setShowAllOptional] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [doc, allTrails, trailProgress] = await Promise.all([
        fetchMigrantPdi(user.uid),
        getCollection<TrailRow>('trails'),
        queryDocuments<TrailProgressRow>('user_trail_progress', [
          { field: 'user_id', operator: '==', value: user.uid },
        ]),
      ]);
      setPdi(doc);
      setTrails(allTrails);
      setProgress(trailProgress);
      setViewed(new Set((doc?.review_sections_viewed ?? []) as PdiReviewSection[]));
    } catch (error) {
      console.error('Erro ao carregar PDI', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const trailById = useMemo(() => {
    const map = new Map<string, TrailRow>();
    for (const tr of trails) map.set(tr.id, tr);
    return map;
  }, [trails]);

  const includedTrilhas = useMemo(
    () => (pdi?.trilhas ?? []).filter((tr) => tr.recommended_state !== 'NAO_INCLUIDA'),
    [pdi]
  );

  const baseTrilhas = useMemo(
    () =>
      includedTrilhas.filter(
        (tr) => tr.recommended_state === 'OBRIGATORIA' || tr.recommended_state === 'RECOMENDADA'
      ),
    [includedTrilhas]
  );

  const optionalTrilhas = useMemo(
    () => includedTrilhas.filter((tr) => tr.recommended_state === 'OPCIONAL'),
    [includedTrilhas]
  );

  const progressSummary = useMemo(() => {
    if (!pdi) return null;
    return computePdiTrailProgress(pdi.trilhas, progress);
  }, [pdi, progress]);

  const nextTrail = useMemo(() => {
    if (!progressSummary) return null;
    const ordered = [...baseTrilhas, ...optionalTrilhas];
    for (const tr of ordered) {
      const detail = progressSummary.details.find((d) => d.trail_id === tr.trail_id);
      if (!detail?.completed) return tr;
    }
    return null;
  }, [baseTrilhas, optionalTrilhas, progressSummary]);

  const markSection = async (section: PdiReviewSection) => {
    setViewed((prev) => {
      const next = new Set(prev);
      next.add(section);
      return next;
    });
    if (pdi?.status === 'VALIDATED') {
      try {
        await markPdiSectionViewed(pdi.id, section, Array.from(viewed));
      } catch {
        /* validação no servidor no aceite */
      }
    }
  };

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const section of PDI_REVIEW_SECTIONS) {
      const el = sectionRefs.current[section];
      if (!el) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) void markSection(section);
        },
        { threshold: 0.5 }
      );
      observer.observe(el);
      observers.push(observer);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [pdi?.id, pdi?.status]);

  const viewedList = Array.from(viewed);
  const canAccept = pdi?.status === 'VALIDATED' && canAcceptPdi(pdi, viewedList) && declared;

  const handleAccept = async () => {
    if (!pdi || !canAccept) return;
    setAccepting(true);
    try {
      const result = await acceptPdi(pdi.id, viewedList);
      if (result.ok) {
        toast.success(t.get('pdi.migrant.accepted'));
        await load();
      }
    } catch (error) {
      console.error(error);
      toast.error(t.get('pdi.errors.accept'));
    } finally {
      setAccepting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdi) return;
    try {
      await downloadPdiPdf(pdi, new Map(trails.map((tr) => [tr.id, tr.title])), t);
    } catch (error) {
      console.error(error);
      toast.error(t.get('pdi.errors.pdf'));
    }
  };

  const getTrailPercent = (trailId: string) => {
    const detail = progressSummary?.details.find((d) => d.trail_id === trailId);
    return detail?.percent ?? 0;
  };

  const isTrailDone = (trailId: string) => {
    return !!progressSummary?.details.find((d) => d.trail_id === trailId)?.completed;
  };

  const isAccepted = pdi?.status === 'ACCEPTED';

  const renderTrailAction = (tr: PdiTrilhaEntry, percent: number, done: boolean) => {
    if (!isAccepted) {
      return (
        <Button variant="outline" className="w-full" disabled>
          {t.get('pdi.migrant.availableAfterAccept')}
        </Button>
      );
    }
    if (done) {
      return (
        <Button variant="outline" className="w-full gap-2" disabled>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          {t.get('pdi.migrant.trailDone')}
        </Button>
      );
    }
    if (percent > 0) {
      return (
        <Button asChild className="w-full gap-2">
          <Link to={`/dashboard/migrante/trilhas/${tr.trail_id}`}>
            {t.get('pdi.migrant.continueTrail')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      );
    }
    return (
      <Button asChild variant="outline" className="w-full">
        <Link to={`/dashboard/migrante/trilhas/${tr.trail_id}`}>{t.get('pdi.migrant.startTrail')}</Link>
      </Button>
    );
  };

  const renderBaseTrailCard = (tr: PdiTrilhaEntry, index: number) => {
    const meta = trailById.get(tr.trail_id);
    const percent = getTrailPercent(tr.trail_id);
    const done = isTrailDone(tr.trail_id);
    const tagKey =
      tr.recommended_state === 'OBRIGATORIA'
        ? 'pdi.migrant.tagNecessary'
        : 'pdi.migrant.tagRecommended';

    return (
      <div
        key={tr.trail_id}
        className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border',
              trailTagClass(tr.recommended_state)
            )}
          >
            {t.get(tagKey)}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">T{index + 1}</span>
        </div>
        <div>
          <h3 className="font-semibold leading-snug">{meta?.title ?? tr.trail_id}</h3>
          {meta?.description ? (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{meta.description}</p>
          ) : null}
        </div>
        <div className="space-y-1.5 mt-auto">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.get('pdi.migrant.progress')}</span>
            <span className="font-medium text-foreground">{percent}%</span>
          </div>
          <Progress value={percent} className="h-1.5" />
        </div>
        {renderTrailAction(tr, percent, done)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pdi) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-3">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-3">
          <FileCheck className="h-8 w-8 text-primary" />
          {t.get('pdi.migrant.title')}
        </h1>
        <p className="text-muted-foreground">{t.get('pdi.migrant.notAvailable')}</p>
        <Button asChild variant="outline">
          <Link to="/dashboard/migrante">{t.get('pdi.migrant.backHome')}</Link>
        </Button>
      </div>
    );
  }

  const visibleOptional = showAllOptional ? optionalTrilhas : optionalTrilhas.slice(0, 3);
  const globalPercent = progressSummary?.overallPercent ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <FileCheck className="h-8 w-8 text-primary" />
            {t.get('pdi.migrant.title')}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{t.get('pdi.migrant.pageSubtitle')}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {t.get('pdi.fields.version')}: {pdi.version} · {t.get(`pdi.status.${pdi.status}`)}
          </p>
        </div>
        <Button variant="outline" className="shrink-0 gap-2" onClick={() => void handleDownloadPdf()}>
          <Download className="h-4 w-4" />
          {t.get('pdi.migrant.exportPdi')}
        </Button>
      </div>

      {/* Progresso global + documento */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="stroke-primary"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - globalPercent / 100)}`}
                />
              </svg>
              <span className="absolute text-2xl font-bold">{globalPercent}%</span>
            </div>
            <div className="flex-1 space-y-4 w-full">
              <div>
                <h2 className="font-semibold text-lg">{t.get('pdi.migrant.globalProgressTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t.get('pdi.migrant.globalProgressDesc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{t.get('pdi.migrant.trailsCompleted')}</p>
                  <p className="text-lg font-semibold">
                    {progressSummary?.completed ?? 0} / {progressSummary?.total ?? includedTrilhas.length}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{t.get('pdi.migrant.nextGoal')}</p>
                  <p className="text-sm font-semibold truncate">
                    {nextTrail
                      ? trailById.get(nextTrail.trail_id)?.title ?? nextTrail.trail_id
                      : t.get('pdi.migrant.allTrailsDone')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          className="rounded-xl border bg-card p-5 shadow-sm text-left hover:bg-muted/30 transition-colors"
        >
          <h2 className="font-semibold">{t.get('pdi.migrant.documentTitle')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t.get('pdi.migrant.documentDesc')}</p>
          <div className="mt-4 flex h-32 items-center justify-center rounded-lg border bg-muted/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </div>
          </div>
        </button>
      </div>

      {/* Métricas SCAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t.get('pdi.fields.scoreGlobal'), value: pdi.score_global?.toFixed(2) ?? '—' },
          { label: t.get('pdi.fields.targetGlobal'), value: pdi.target_global?.toFixed(2) ?? '—' },
          {
            label: 'D1',
            value: `${pdi.score_d1?.toFixed(2) ?? '—'} → ${pdi.target_d1?.toFixed(2) ?? '—'}`,
          },
          {
            label: 'D4',
            value: `${pdi.score_d4?.toFixed(2) ?? '—'} → ${pdi.target_d4?.toFixed(2) ?? '—'}`,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-lg font-semibold mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Trilhas base */}
      <section ref={(el) => { sectionRefs.current.trilhas = el; }} className="space-y-4">
        <h2 className="text-lg font-semibold">{t.get('pdi.migrant.baseTrailsTitle')}</h2>
        {baseTrilhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.get('pdi.migrant.noBaseTrails')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {baseTrilhas.map((tr, i) => renderBaseTrailCard(tr, i))}
          </div>
        )}
      </section>

      {/* Trilhas complementares */}
      {optionalTrilhas.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t.get('pdi.migrant.optionalTrailsTitle')}</h2>
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="hidden sm:grid sm:grid-cols-[72px_1fr_2fr_120px_100px] gap-3 px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
              <span>Id</span>
              <span>{t.get('pdi.migrant.colState')}</span>
              <span>{t.get('pdi.migrant.colTrail')}</span>
              <span>{t.get('pdi.migrant.progress')}</span>
              <span className="text-right">{t.get('pdi.migrant.colAction')}</span>
            </div>
            {visibleOptional.map((tr, i) => {
              const meta = trailById.get(tr.trail_id);
              const percent = getTrailPercent(tr.trail_id);
              const done = isTrailDone(tr.trail_id);
              const idx = baseTrilhas.length + i + 1;
              return (
                <div
                  key={tr.trail_id}
                  className="grid sm:grid-cols-[72px_1fr_2fr_120px_100px] gap-3 items-center px-4 py-3 border-t first:border-t-0"
                >
                  <span className="text-sm font-semibold text-muted-foreground">T{idx}</span>
                  <span
                    className={cn(
                      'inline-flex w-fit text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
                      trailTagClass('OPCIONAL')
                    )}
                  >
                    {t.get('pdi.migrant.tagOptional')}
                  </span>
                  <span className="text-sm font-medium truncate">{meta?.title ?? tr.trail_id}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={percent} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-8">{percent}%</span>
                  </div>
                  <div className="flex justify-end">
                    {isAccepted ? (
                      done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : percent > 0 ? (
                        <Button asChild size="icon" variant="ghost">
                          <Link to={`/dashboard/migrante/trilhas/${tr.trail_id}`}>
                            <Play className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="icon" variant="ghost">
                          <Link to={`/dashboard/migrante/trilhas/${tr.trail_id}`}>
                            <Plus className="h-4 w-4" />
                          </Link>
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {optionalTrilhas.length > 3 ? (
            <button
              type="button"
              className="text-sm text-primary font-medium hover:underline"
              onClick={() => setShowAllOptional((v) => !v)}
            >
              {showAllOptional
                ? t.get('pdi.migrant.showLessOptional')
                : t.get('pdi.migrant.showAllOptional', { count: String(optionalTrilhas.length) })}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Apoios */}
      <section
        ref={(el) => { sectionRefs.current.apoios = el; }}
        className="rounded-xl border bg-card p-6 shadow-sm space-y-4"
      >
        <h2 className="text-lg font-semibold">{t.get('pdi.sections.apoios')}</h2>
        {pdi.apoios.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.get('pdi.migrant.noApoios')}</p>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pdi.apoios.map((a, i) => (
              <div key={i} className="rounded-lg border bg-muted/20 p-4">
                <p className="font-medium">{t.get(`pdi.apoios.${a.type}`)}</p>
                {a.notes ? <p className="text-sm text-muted-foreground mt-1">{a.notes}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Objetivos */}
      <section
        ref={(el) => { sectionRefs.current.objetivos = el; }}
        className="rounded-xl border bg-card p-6 shadow-sm space-y-3"
      >
        <h2 className="text-lg font-semibold">{t.get('pdi.sections.objetivos')}</h2>
        <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
          {pdi.notes?.trim() ? pdi.notes : t.get('pdi.migrant.defaultObjectives')}
        </p>
      </section>

      {/* Declaração e aceite */}
      <section
        ref={(el) => { sectionRefs.current.declaracao = el; }}
        className="rounded-xl border bg-card p-6 shadow-sm space-y-4"
      >
        <h2 className="text-lg font-semibold">{t.get('pdi.sections.declaracao')}</h2>
        <p className="text-sm text-muted-foreground">{t.get('pdi.migrant.declaration')}</p>
        {!isAccepted ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-4">
            <Checkbox
              id="pdi-declare"
              checked={declared}
              onCheckedChange={(v) => setDeclared(v === true)}
              disabled={!allReviewSectionsViewed(viewedList)}
            />
            <label htmlFor="pdi-declare" className="text-sm leading-snug cursor-pointer">
              {t.get('pdi.migrant.declareLabel')}
            </label>
          </div>
        ) : (
          <p className="text-sm text-green-700 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t.get('pdi.migrant.alreadyAccepted', { date: pdi.accepted_at?.slice(0, 10) ?? '' })}
          </p>
        )}
      </section>

      {pdi.status === 'VALIDATED' ? (
        <div className="sticky bottom-4 rounded-xl border bg-background/95 backdrop-blur p-4 shadow-lg">
          {!allReviewSectionsViewed(viewedList) ? (
            <p className="text-sm text-amber-700 mb-3">{t.get('pdi.migrant.scrollHint')}</p>
          ) : null}
          <Button className="w-full" size="lg" disabled={!canAccept || accepting} onClick={() => void handleAccept()}>
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.get('pdi.migrant.accept')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
