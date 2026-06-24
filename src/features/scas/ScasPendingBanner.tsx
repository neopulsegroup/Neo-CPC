import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { queryDocuments } from '@/integrations/firebase/firestore';
import { resolvePendingScasMoment, type PendingScasMoment } from '@/lib/scas';
import {
  fetchParticipantAssessments,
  fetchPdi,
  summarizeParticipantScas,
} from '@/lib/scas/repository';

interface TrailProgressRow {
  trail_id: string;
  completed_at?: string | null;
}

/**
 * Banner de chamada à ação para o SCAS pendente (T0/T_TRILHA/T_PDI).
 * Carregamento leve e autossuficiente; devolve null se não há nada pendente.
 */
export function ScasPendingBanner() {
  const { user, triage } = useAuth();
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingScasMoment | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;

    void (async () => {
      try {
        const [assessments, pdi, progress] = await Promise.all([
          fetchParticipantAssessments(user.uid),
          fetchPdi(user.uid),
          queryDocuments<TrailProgressRow>('user_trail_progress', [
            { field: 'user_id', operator: '==', value: user.uid },
          ]),
        ]);
        if (cancelled) return;

        const summary = summarizeParticipantScas(assessments);
        const next = resolvePendingScasMoment({
          triageCompleted: triage?.completed === true,
          metaReached: summary.improvement?.meta_atingida ?? false,
          assessments: assessments.map((a) => ({
            moment_type: a.moment_type,
            domain_scope: a.domain_scope,
            trail_id: a.trail_id,
            status: a.status,
          })),
          pdiTrails: (pdi?.trails ?? []).map((tr) => ({
            trail_id: tr.trail_id,
            scas_domain: tr.scas_domain,
            state: tr.state,
          })),
          trailProgress: progress.map((p) => ({
            trail_id: p.trail_id,
            completed_at: p.completed_at ?? null,
          })),
        });
        if (!cancelled) setPending(next);
      } catch (error) {
        console.error('Erro ao verificar SCAS pendente', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, triage?.completed]);

  if (!pending) return null;

  const titleKey =
    pending.moment_type === 'T0'
      ? 'scas.migrant.ctaT0Title'
      : pending.moment_type === 'T_TRILHA'
        ? 'scas.migrant.ctaTrailTitle'
        : 'scas.migrant.ctaPdiTitle';
  const descKey =
    pending.moment_type === 'T0'
      ? 'scas.migrant.ctaT0Description'
      : pending.moment_type === 'T_TRILHA'
        ? 'scas.migrant.ctaTrailDescription'
        : 'scas.migrant.ctaPdiDescription';

  return (
    <Link
      to="/dashboard/migrante/scas"
      className="mb-6 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ClipboardList className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.get(titleKey)}</p>
        <p className="text-sm text-muted-foreground">{t.get(descKey)}</p>
      </div>
      <ArrowRight className="h-5 w-5 flex-shrink-0 text-primary" />
    </Link>
  );
}
