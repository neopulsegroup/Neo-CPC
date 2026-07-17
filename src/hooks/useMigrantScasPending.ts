import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
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
 * Momento SCAS pendente (T0/T_TRILHA/T_PDI) do migrante autenticado.
 * Usado pelo banner da visão geral e pelo indicador no menu.
 *
 * @param enabled permite desativar a query (ex.: migrante sem Perfil A).
 */
export function useMigrantScasPending(enabled = true): PendingScasMoment | null {
  const { user, triage } = useAuth();
  const [pending, setPending] = useState<PendingScasMoment | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !user?.uid) {
      setPending(null);
      return;
    }

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
  }, [enabled, user?.uid, triage?.completed]);

  return pending;
}
