import { describe, expect, it } from 'vitest';

import { computePdiTrailProgress } from './pdiProgress';

describe('computePdiTrailProgress', () => {
  it('calcula progresso por trilha incluída', () => {
    const summary = computePdiTrailProgress(
      [
        { trail_id: 't1', recommended_state: 'OBRIGATORIA', origin: 'AUTO', completion_status: 'NAO_INICIADA' },
        { trail_id: 't2', recommended_state: 'RECOMENDADA', origin: 'AUTO', completion_status: 'NAO_INICIADA' },
        { trail_id: 't3', recommended_state: 'NAO_INCLUIDA', origin: 'MANUAL', completion_status: 'NAO_INICIADA' },
      ],
      [
        { trail_id: 't1', progress_percent: 100, completed_at: '2026-01-10' },
        { trail_id: 't2', progress_percent: 40 },
      ]
    );
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.overallPercent).toBe(50);
  });
});
