import { describe, expect, it } from 'vitest';

import { sanitizeForPdfText } from './pdfWinAnsiText';

describe('sanitizeForPdfText', () => {
  it('remove emojis e bandeiras', () => {
    expect(sanitizeForPdfText('Trilha 🇵🇹 Integração')).toBe('Trilha Integracao');
  });

  it('substitui setas e tracos especiais', () => {
    expect(sanitizeForPdfText('2.5 → 3.5 — nota')).toBe('2.5 -> 3.5 - nota');
  });
});
