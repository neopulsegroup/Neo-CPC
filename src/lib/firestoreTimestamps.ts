/** Normaliza `created_at` vindo do Firestore (string ISO ou Timestamp) para ISO string. */
export function createdAtToIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

export function createdAtToMs(value: unknown): number {
  const iso = createdAtToIso(value);
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}
