import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditDurationMs,
  auditTimerStart,
  buildAuditLogDocument,
  resetAuditLogCachesForTests,
  resolveAuditClientIp,
} from '@/lib/auditLog';

describe('auditLog helpers', () => {
  beforeEach(() => {
    resetAuditLogCachesForTests();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '203.0.113.10' }),
    }));
    vi.stubGlobal('navigator', { userAgent: 'vitest-agent' });
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuditLogCachesForTests();
  });

  it('builds audit documents with request context and duration', () => {
    const doc = buildAuditLogDocument(
      {
        action: 'user.blocked',
        actor_id: 'actor-1',
        context: 'cpc',
        target_id: 'target-1',
        startedAtMs: auditTimerStart() - 42,
      },
      { ip_address: '10.0.0.1', user_agent: 'vitest-agent' }
    );

    expect(doc).toMatchObject({
      action: 'user.blocked',
      actor_id: 'actor-1',
      context: 'cpc',
      target_id: 'target-1',
      ip_address: '10.0.0.1',
      user_agent: 'vitest-agent',
      origin: 'app',
    });
    expect(typeof doc.duration_ms).toBe('number');
    expect(doc.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('caches resolved client ip for the session', async () => {
    await expect(resolveAuditClientIp()).resolves.toBe('203.0.113.10');
    await expect(resolveAuditClientIp()).resolves.toBe('203.0.113.10');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('computes duration from explicit startedAtMs', () => {
    const startedAtMs = auditTimerStart() - 25;
    expect(auditDurationMs(startedAtMs)).toBeGreaterThanOrEqual(20);
  });
});
