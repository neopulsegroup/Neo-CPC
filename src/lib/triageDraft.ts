export type TriageDraftV1 = {
  schemaVersion: 1;
  formSignature: string;
  updatedAt: string;
  revision: number;
  stepId: string;
  answers: Record<string, unknown>;
  checksum: string;
  writerId?: string;
};

export const TRIAGE_DRAFT_SCHEMA_VERSION = 1 as const;

export function triageDraftStorageKey(uid: string): string {
  return `triage:draft:v1:${uid}`;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(',')}}`;
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function computeTriageDraftChecksum(payload: Omit<TriageDraftV1, 'checksum'>): string {
  return fnv1aHex(stableStringify(payload));
}

export function makeTriageDraft(input: Omit<TriageDraftV1, 'schemaVersion' | 'checksum'>): TriageDraftV1 {
  const base: Omit<TriageDraftV1, 'checksum'> = {
    schemaVersion: TRIAGE_DRAFT_SCHEMA_VERSION,
    ...input,
  };
  return { ...base, checksum: computeTriageDraftChecksum(base) };
}

export function parseTriageDraft(json: string): TriageDraftV1 | null {
  try {
    const parsed = JSON.parse(json) as Partial<TriageDraftV1>;
    if (parsed.schemaVersion !== TRIAGE_DRAFT_SCHEMA_VERSION) return null;
    if (typeof parsed.formSignature !== 'string') return null;
    if (typeof parsed.updatedAt !== 'string') return null;
    if (typeof parsed.revision !== 'number') return null;
    if (typeof parsed.stepId !== 'string') return null;
    if (!parsed.answers || typeof parsed.answers !== 'object') return null;
    if (typeof parsed.checksum !== 'string') return null;

    const base: Omit<TriageDraftV1, 'checksum'> = {
      schemaVersion: TRIAGE_DRAFT_SCHEMA_VERSION,
      formSignature: parsed.formSignature,
      updatedAt: parsed.updatedAt,
      revision: parsed.revision,
      stepId: parsed.stepId,
      answers: parsed.answers as Record<string, unknown>,
      writerId: typeof parsed.writerId === 'string' ? parsed.writerId : undefined,
    };
    const expected = computeTriageDraftChecksum(base);
    if (expected !== parsed.checksum) return null;
    return { ...base, checksum: parsed.checksum };
  } catch {
    return null;
  }
}

export function loadLocalTriageDraft(uid: string): TriageDraftV1 | null {
  try {
    const raw = localStorage.getItem(triageDraftStorageKey(uid));
    if (!raw) return null;
    return parseTriageDraft(raw);
  } catch {
    return null;
  }
}

export function saveLocalTriageDraft(uid: string, draft: TriageDraftV1): void {
  localStorage.setItem(triageDraftStorageKey(uid), JSON.stringify(draft));
}

export function clearLocalTriageDraft(uid: string): void {
  try {
    localStorage.removeItem(triageDraftStorageKey(uid));
  } catch {
    return;
  }
}

export function compareDraftRecency(a: Pick<TriageDraftV1, 'updatedAt' | 'revision'>, b: Pick<TriageDraftV1, 'updatedAt' | 'revision'>): number {
  const ta = Date.parse(a.updatedAt);
  const tb = Date.parse(b.updatedAt);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
  return a.revision - b.revision;
}

