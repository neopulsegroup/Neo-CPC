"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServerAuditLogContext = buildServerAuditLogContext;
function buildServerAuditLogContext(input = {}) {
    const doc = {
        user_agent: input.userAgent ?? 'Neo-CPC/functions',
        ip_address: input.ipAddress ?? 'internal',
        origin: 'function',
    };
    if (typeof input.durationMs === 'number' && !Number.isNaN(input.durationMs)) {
        doc.duration_ms = Math.max(0, Math.round(input.durationMs));
    }
    return doc;
}
