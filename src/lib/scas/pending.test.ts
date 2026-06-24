import { describe, expect, it } from 'vitest';

import { resolvePendingScasMoment, type PdiTrailRef } from './pending';

const PDI: PdiTrailRef[] = [
  { trail_id: 't-d3', scas_domain: 'D3', state: 'obrigatoria' },
  { trail_id: 't-d1', scas_domain: 'D1', state: 'recomendada' },
  { trail_id: 't-nodomain', scas_domain: null, state: 'opcional' },
];

describe('resolvePendingScasMoment', () => {
  it('não dispara nada se a triagem não está concluída', () => {
    expect(
      resolvePendingScasMoment({
        triageCompleted: false,
        metaReached: false,
        assessments: [],
        pdiTrails: PDI,
        trailProgress: [],
      })
    ).toBeNull();
  });

  it('dispara T0 quando triagem concluída e sem T0', () => {
    expect(
      resolvePendingScasMoment({
        triageCompleted: true,
        metaReached: false,
        assessments: [],
        pdiTrails: [],
        trailProgress: [],
      })
    ).toEqual({ moment_type: 'T0', domain_scope: null, trail_id: null });
  });

  it('não repete T0 já submetido', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: false,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
      ],
      pdiTrails: [],
      trailProgress: [],
    });
    expect(result).toBeNull();
  });

  it('dispara T_TRILHA ao concluir uma trilha do PDI com domínio', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: false,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
      ],
      pdiTrails: PDI,
      trailProgress: [{ trail_id: 't-d3', completed_at: '2026-01-01' }],
    });
    expect(result).toEqual({ moment_type: 'T_TRILHA', domain_scope: 'D3', trail_id: 't-d3' });
  });

  it('não dispara T_TRILHA para trilha sem domínio mapeado (edge 9)', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: false,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
      ],
      pdiTrails: PDI,
      trailProgress: [{ trail_id: 't-nodomain', completed_at: '2026-01-01' }],
    });
    expect(result).toBeNull();
  });

  it('não repete T_TRILHA já submetido para a mesma trilha', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: false,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
        { moment_type: 'T_TRILHA', domain_scope: 'D3', trail_id: 't-d3', status: 'SUBMITTED' },
      ],
      pdiTrails: PDI,
      trailProgress: [{ trail_id: 't-d3', completed_at: '2026-01-01' }],
    });
    expect(result).toBeNull();
  });

  it('dispara T_PDI quando todas as trilhas do PDI estão concluídas e avaliadas', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: false,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
        { moment_type: 'T_TRILHA', domain_scope: 'D3', trail_id: 't-d3', status: 'SUBMITTED' },
        { moment_type: 'T_TRILHA', domain_scope: 'D1', trail_id: 't-d1', status: 'SUBMITTED' },
      ],
      pdiTrails: PDI,
      trailProgress: [
        { trail_id: 't-d3', completed_at: '2026-01-01' },
        { trail_id: 't-d1', completed_at: '2026-02-01' },
        { trail_id: 't-nodomain', completed_at: '2026-03-01' },
      ],
    });
    expect(result).toEqual({ moment_type: 'T_PDI', domain_scope: null, trail_id: null });
  });

  it('não obriga a preenchimento se a meta já foi atingida', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: true,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
      ],
      pdiTrails: PDI,
      trailProgress: [{ trail_id: 't-d3', completed_at: '2026-01-01' }],
    });
    expect(result).toBeNull();
  });

  it('prioriza T_TRILHA pendente antes do T_PDI', () => {
    const result = resolvePendingScasMoment({
      triageCompleted: true,
      metaReached: false,
      assessments: [
        { moment_type: 'T0', domain_scope: null, trail_id: null, status: 'SUBMITTED' },
      ],
      pdiTrails: PDI,
      trailProgress: [
        { trail_id: 't-d3', completed_at: '2026-01-01' },
        { trail_id: 't-d1', completed_at: '2026-02-01' },
        { trail_id: 't-nodomain', completed_at: '2026-03-01' },
      ],
    });
    expect(result?.moment_type).toBe('T_TRILHA');
  });
});
