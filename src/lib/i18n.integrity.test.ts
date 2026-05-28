import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { flattenTranslationStringKeys, getTranslationStringAtPath, translations } from '@/lib/i18n';

function toSortedArray(value: Set<string>) {
  return Array.from(value).sort((a, b) => a.localeCompare(b));
}

function scanCodeForGetKeys(rootDir: string): Set<string> {
  const out = new Set<string>();

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      if (!entry.isFile()) continue;
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const content = fs.readFileSync(full, 'utf8');
      const re = /\bt\.get\(\s*['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null = null;
      while ((match = re.exec(content))) {
        out.add(match[1]);
      }
    }
  }

  walk(rootDir);
  return out;
}

describe('i18n - integridade', () => {
  it('PT/EN/ES/FR têm o mesmo conjunto de chaves (strings) e nenhuma chave vazia', () => {
    const ptKeys = new Set(flattenTranslationStringKeys(translations.pt));
    const enKeys = new Set(flattenTranslationStringKeys(translations.en));
    const esKeys = new Set(flattenTranslationStringKeys(translations.es));
    const frKeys = new Set(flattenTranslationStringKeys(translations.fr));

    expect(toSortedArray(enKeys)).toEqual(toSortedArray(ptKeys));
    expect(toSortedArray(esKeys)).toEqual(toSortedArray(ptKeys));
    expect(toSortedArray(frKeys)).toEqual(toSortedArray(ptKeys));

    for (const key of ptKeys) {
      for (const lang of ['pt', 'en', 'es', 'fr'] as const) {
        const value = getTranslationStringAtPath(lang, key);
        expect(value, `${lang}:${key} deve existir`).toBeTypeOf('string');
        expect(value?.trim(), `${lang}:${key} não deve ser vazio`).not.toBe('');
      }
    }
  });

  it('t.get() só referencia chaves existentes em PT', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const srcRoot = path.join(repoRoot, 'src');
    const referenced = scanCodeForGetKeys(srcRoot);

    for (const key of referenced) {
      const value = getTranslationStringAtPath('pt', key);
      expect(value, `Chave não existe em PT: ${key}`).toBeTypeOf('string');
      expect(value?.trim(), `Chave vazia em PT: ${key}`).not.toBe('');
    }
  });
});

