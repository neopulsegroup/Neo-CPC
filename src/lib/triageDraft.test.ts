import { describe, expect, it } from 'vitest';
import { makeTriageDraft, parseTriageDraft } from './triageDraft';

describe('triageDraft', () => {
  it('gera checksum determinístico e valida na leitura', () => {
    const draft = makeTriageDraft({
      formSignature: 'abcd1234',
      updatedAt: '2026-03-12T10:00:00.000Z',
      revision: 1,
      stepId: 'personal_data',
      answers: { birth_date: '2000-01-01', languages: ['portuguese', 'english'], is_in_portugal: 'yes' },
      writerId: 'w1',
    });

    const parsed = parseTriageDraft(JSON.stringify(draft));
    expect(parsed).not.toBeNull();
    expect(parsed?.checksum).toBe(draft.checksum);
    expect(parsed?.answers).toEqual(draft.answers);
  });

  it('rejeita rascunho com checksum inválido (integridade)', () => {
    const draft = makeTriageDraft({
      formSignature: 'abcd1234',
      updatedAt: '2026-03-12T10:00:00.000Z',
      revision: 2,
      stepId: 'contacts',
      answers: { phone: '+351912345678' },
      writerId: 'w2',
    });

    const corrupted = { ...draft, answers: { phone: '+351000000000' } };
    const parsed = parseTriageDraft(JSON.stringify(corrupted));
    expect(parsed).toBeNull();
  });
});

