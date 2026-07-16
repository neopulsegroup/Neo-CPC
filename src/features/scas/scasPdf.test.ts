import { describe, expect, it } from 'vitest';

import { buildScasAssessmentPdfBytes } from './scasPdf';
import type { ScasAssessmentDoc } from '@/lib/scas/repository';

const assessment: ScasAssessmentDoc = {
  id: 'scas-1',
  participant_id: 'user-1',
  moment_type: 'T0',
  domain_scope: null,
  trail_id: null,
  status: 'SUBMITTED',
  mode: 'AUTONOMO',
  assisted_by_user_id: null,
  language: 'pt',
  started_at: '2026-01-10T10:00:00.000Z',
  submitted_at: '2026-01-10T10:30:00.000Z',
  is_locked: true,
  score_d1: 2.11,
  score_d2: 3.0,
  score_d3: 2.75,
  score_d4: 2.5,
  score_global: 2.52,
};

const uiLabels = {
  title: 'Questionario SCAS',
  participant: 'Participante',
  moment: 'Momento',
  date: 'Data',
  mode: 'Modo',
  language: 'Idioma',
  trail: 'Trilha',
  scores: 'Pontuacoes',
  global: 'Global',
  responses: 'Respostas',
  autonomous: 'Autonomo',
  assisted: 'Assistido',
  item: 'Resposta',
};

describe('buildScasAssessmentPdfBytes', () => {
  it('gera PDF A4 com respostas da avaliacao', async () => {
    const bytes = await buildScasAssessmentPdfBytes(assessment, {
      participantName: 'Jose Teste',
      responses: Array.from({ length: 21 }, (_, i) => ({
        id: `r${i + 1}`,
        assessment_id: 'scas-1',
        item_id: i + 1,
        value: (i % 5) + 1,
      })),
      uiLabels,
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF');
  });
});
