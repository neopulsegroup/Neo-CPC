/** RFC 4180-style CSV: campos entre aspas, aspas duplicadas como escape. */

export function escapeCsvField(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildTranslationsCsv(
  keys: string[],
  getRow: (key: string) => { pt: string; en: string; es: string; fr: string },
): string {
  const header = ['key', 'pt', 'en', 'es', 'fr'].map(escapeCsvField).join(',');
  const body = keys.map((k) => {
    const r = getRow(k);
    return [k, r.pt, r.en, r.es, r.fr].map(escapeCsvField).join(',');
  });
  return [header, ...body].join('\r\n');
}

export function parseCsv(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const flushRow = () => {
    if (row.some((c) => c.length > 0)) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (c === ',') {
      pushField();
      i++;
      continue;
    }

    if (c === '\r') {
      pushField();
      i++;
      if (text[i] === '\n') i++;
      flushRow();
      continue;
    }

    if (c === '\n') {
      pushField();
      i++;
      flushRow();
      continue;
    }

    field += c;
    i++;
  }

  pushField();
  if (row.some((c) => c.length > 0)) flushRow();

  return rows;
}

export type TranslationCsvRow = { pt: string; en: string; es: string; fr: string };

export type ParsedTranslationsCsv = {
  rows: Map<string, TranslationCsvRow>;
  unknownKeys: string[];
  skippedEmpty: number;
};

export function parseTranslationsCsvImport(content: string, knownKeys: Set<string>): ParsedTranslationsCsv {
  const table = parseCsv(content);
  const rows = new Map<string, TranslationCsvRow>();
  const unknownKeys: string[] = [];
  let skippedEmpty = 0;

  if (table.length === 0) {
    return { rows, unknownKeys, skippedEmpty: 0 };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const ik = idx('key');
  const ip = idx('pt');
  const ie = idx('en');
  const is = idx('es');
  const ifr = idx('fr');

  if (ik === -1 || ip === -1 || ie === -1 || is === -1 || ifr === -1) {
    const err = new Error('INVALID_HEADER');
    (err as Error & { code?: string }).code = 'INVALID_HEADER';
    throw err;
  }

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    if (!line || line.every((c) => !String(c).trim())) {
      skippedEmpty++;
      continue;
    }
    const key = String(line[ik] ?? '').trim();
    if (!key) {
      skippedEmpty++;
      continue;
    }
    if (!knownKeys.has(key)) {
      unknownKeys.push(key);
      continue;
    }
    rows.set(key, {
      pt: String(line[ip] ?? ''),
      en: String(line[ie] ?? ''),
      es: String(line[is] ?? ''),
      fr: String(line[ifr] ?? ''),
    });
  }

  return { rows, unknownKeys, skippedEmpty };
}
