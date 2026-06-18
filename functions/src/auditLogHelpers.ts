export type ServerAuditLogContextInput = {
  durationMs?: number;
  userAgent?: string;
  ipAddress?: string;
};

export function buildServerAuditLogContext(input: ServerAuditLogContextInput = {}): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    user_agent: input.userAgent ?? 'Neo-CPC/functions',
    ip_address: input.ipAddress ?? 'internal',
    origin: 'function',
  };

  if (typeof input.durationMs === 'number' && !Number.isNaN(input.durationMs)) {
    doc.duration_ms = Math.max(0, Math.round(input.durationMs));
  }

  return doc;
}
