import { describe, expect, it } from 'vitest';
import { buildTranslationsCsv, parseCsv, parseTranslationsCsvImport } from './csvTranslations';

describe('csvTranslations', () => {
  it('faz round-trip com vírgulas e aspas nos campos', () => {
    const keys = ['a.b', 'c.d'];
    const csv = buildTranslationsCsv(keys, (k) =>
      k === 'a.b'
        ? { pt: 'Olá, "mundo"', en: 'Hi', es: 'Hola', fr: 'Salut' }
        : { pt: 'x', en: 'y', es: 'z', fr: 'w' },
    );
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(['key', 'pt', 'en', 'es', 'fr']);
    expect(rows[1][0]).toBe('a.b');
    expect(rows[1][1]).toBe('Olá, "mundo"');
    const known = new Set(keys);
    const parsed = parseTranslationsCsvImport(csv, known);
    expect(parsed.rows.get('a.b')).toEqual({ pt: 'Olá, "mundo"', en: 'Hi', es: 'Hola', fr: 'Salut' });
  });

  it('ignora chaves desconhecidas no import', () => {
    const csv = '"key","pt","en","es","fr"\r\n"k1","p","e","s","f"\r\n"unknown","a","b","c","d"\r\n';
    const parsed = parseTranslationsCsvImport(csv, new Set(['k1']));
    expect(parsed.rows.size).toBe(1);
    expect(parsed.unknownKeys).toEqual(['unknown']);
  });
});
