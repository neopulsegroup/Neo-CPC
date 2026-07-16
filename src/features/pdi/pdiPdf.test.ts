import { describe, expect, it, vi } from 'vitest';

import { buildPdiPdfBytes } from './pdiPdf';
import type { PdiDoc } from '@/lib/pdi/types';

vi.mock('@/lib/documentBranding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/documentBranding')>();
  return {
    ...actual,
    fetchDocumentBranding: vi.fn(actual.fetchDocumentBranding),
  };
});

const t = {
  get: (key: string, params?: Record<string, string>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
};

const samplePdi: PdiDoc = {
  id: 'pdi-1',
  participant_id: 'user-1',
  version: '1.0',
  status: 'ACCEPTED',
  perfil: 'A',
  source_t0_assessment_id: 'scas-1',
  score_d1: 2.5,
  score_d2: 3.0,
  score_d3: 2.8,
  score_d4: 3.2,
  score_global: 2.9,
  target_global: 3.5,
  target_d1: 3.0,
  target_d2: 3.5,
  target_d3: 3.2,
  target_d4: 3.8,
  notes: 'Objetivos de integracao profissional.',
  created_by_user_id: 'tech-1',
  created_at: '2026-01-15T10:00:00.000Z',
  accepted_at: '2026-01-20T12:00:00.000Z',
  is_locked: true,
  trilhas: [
    {
      trail_id: 'trail-1',
      recommended_state: 'OBRIGATORIA',
      origin: 'AUTO',
      completion_status: 'EM_CURSO',
    },
  ],
  apoios: [{ type: 'SOCIOPROFISSIONAL', notes: 'Acompanhamento regular' }],
};

describe('buildPdiPdfBytes', () => {
  it('gera bytes PDF A4 com branding aplicado', async () => {
    const bytes = await buildPdiPdfBytes(samplePdi, t, {
      trailTitles: new Map([['trail-1', 'Trilha 🇵🇹 de Integracao']]),
      participantName: 'Ana Silva',
      progressByTrail: new Map([['trail-1', { percent: 40, completed: false }]]),
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF');
  });
});
