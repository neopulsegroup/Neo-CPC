import { describe, expect, it } from 'vitest';
import { EXPORT_BRANDING_ORG, EXPORT_BRANDING_TAGLINE, withSheetBranding } from './exportBrandingHeaders';

describe('withSheetBranding', () => {
  it('adiciona rows de branding no topo e footer', () => {
    const result = withSheetBranding([['header', 'header2'], ['v1', 'v2']], {
      title: 'Sheet de teste',
      generatedAtIso: '2026-06-15',
    });
    expect(result[0][0]).toBe(EXPORT_BRANDING_ORG);
    expect(result[1][0]).toBe(EXPORT_BRANDING_TAGLINE);
    expect(result[2][0]).toBe('Sheet de teste');
    expect(result[3][0]).toContain('Gerado em 2026-06-15');
    // Data original presente:
    expect(result.some((row) => row[0] === 'header' && row[1] === 'header2')).toBe(true);
    expect(result.some((row) => row[0] === 'v1' && row[1] === 'v2')).toBe(true);
    // Footer text.
    expect(result.at(-1)?.[0]).toBe(`${EXPORT_BRANDING_ORG} · ${EXPORT_BRANDING_TAGLINE}`);
  });

  it('tolera title vazio', () => {
    const result = withSheetBranding([['x']], { title: '' });
    expect(result.length).toBeGreaterThan(1);
    expect(result.some((row) => row[0] === 'x')).toBe(true);
  });
});
