import { addDocument, serverTimestamp } from '@/integrations/firebase/firestore';

export type AuditLogWriteInput = {
  action: string;
  actor_id: string;
  context?: string | null;
  target_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  before?: unknown;
  after?: unknown;
  beforeBranding?: unknown;
  afterBranding?: unknown;
  detail?: unknown;
  error?: string | null;
  startedAtMs?: number;
  duration_ms?: number;
  origin?: 'app' | 'http' | 'function';
};

export type AuditRequestContext = {
  ip_address: string;
  user_agent: string;
};

const IP_CACHE_KEY = 'neo_cpc_audit_client_ip';

let memoryIpCache: string | null = null;
let ipLookupPromise: Promise<string> | null = null;

export function getAuditUserAgent(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  return navigator.userAgent || 'unknown';
}

export async function resolveAuditClientIp(): Promise<string> {
  if (memoryIpCache) return memoryIpCache;

  if (typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(IP_CACHE_KEY);
      if (stored) {
        memoryIpCache = stored;
        return stored;
      }
    } catch {
      // ignore storage errors
    }
  }

  if (!ipLookupPromise) {
    ipLookupPromise = fetch('https://api.ipify.org?format=json')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => (typeof payload?.ip === 'string' && payload.ip.trim() ? payload.ip.trim() : 'unknown'))
      .catch(() => 'unknown')
      .then((ip) => {
        memoryIpCache = ip;
        try {
          sessionStorage.setItem(IP_CACHE_KEY, ip);
        } catch {
          // ignore storage errors
        }
        return ip;
      });
  }

  return ipLookupPromise;
}

export async function resolveAuditRequestContext(): Promise<AuditRequestContext> {
  const ip_address = await resolveAuditClientIp();
  return { ip_address, user_agent: getAuditUserAgent() };
}

export function auditTimerStart(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function auditDurationMs(startedAtMs: number): number {
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.max(0, Math.round(end - startedAtMs));
}

export function buildAuditLogDocument(
  input: AuditLogWriteInput,
  context: AuditRequestContext
): Record<string, unknown> {
  const duration_ms =
    typeof input.duration_ms === 'number'
      ? Math.max(0, Math.round(input.duration_ms))
      : input.startedAtMs != null
        ? auditDurationMs(input.startedAtMs)
        : undefined;

  const doc: Record<string, unknown> = {
    action: input.action,
    actor_id: input.actor_id,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
    origin: input.origin ?? 'app',
    createdAt: serverTimestamp(),
  };

  if (input.context != null) doc.context = input.context;
  if (input.target_id != null) doc.target_id = input.target_id;
  if (input.entity_type) doc.entity_type = input.entity_type;
  if (input.entity_id) doc.entity_id = input.entity_id;
  if (input.before !== undefined) doc.before = input.before;
  if (input.after !== undefined) doc.after = input.after;
  if (input.beforeBranding !== undefined) doc.beforeBranding = input.beforeBranding;
  if (input.afterBranding !== undefined) doc.afterBranding = input.afterBranding;
  if (input.detail !== undefined) doc.detail = input.detail;
  if (input.error) doc.error = input.error;
  if (duration_ms !== undefined) doc.duration_ms = duration_ms;

  return doc;
}

export async function writeAuditLog(input: AuditLogWriteInput): Promise<string> {
  const context = await resolveAuditRequestContext();
  const doc = buildAuditLogDocument(input, context);
  return addDocument('audit_logs', doc);
}

export function resetAuditLogCachesForTests(): void {
  memoryIpCache = null;
  ipLookupPromise = null;
}
