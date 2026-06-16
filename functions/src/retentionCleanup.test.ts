import { describe, expect, it, vi } from 'vitest';

// Mocks dos módulos importados antes de carregar retentionCleanup.
vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: () => () => undefined,
}));
vi.mock('./admin', () => ({
  getAdminApp: () => ({ auth: () => ({ deleteUser: vi.fn() }) }),
  getFirestore: () => ({}),
}));
vi.mock('./notificationHelpers', () => ({
  RESEND_API_KEY: { name: 'RESEND_API_KEY', value: () => 'k' },
  asEmailLocale: (v: unknown) => (v === 'en' || v === 'es' || v === 'fr' ? v : 'pt'),
}));
vi.mock('./email/sendEmail', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'mock' }),
}));
vi.mock('./emailTemplates', () => ({
  renderTemplate: vi.fn(() => ({ subject: 's', html: 'h', text: 't' })),
}));
vi.mock('./deleteOwnAccount', () => ({
  cascadeDeleteUserDataServer: vi.fn().mockResolvedValue([]),
}));

import { lastLoginToMillis, formatDeletionDate } from './retentionCleanup';

describe('lastLoginToMillis', () => {
  it('aceita ISO string', () => {
    const ms = lastLoginToMillis('2024-01-15T12:00:00.000Z');
    expect(ms).toBe(Date.UTC(2024, 0, 15, 12, 0, 0));
  });

  it('aceita number (millis)', () => {
    expect(lastLoginToMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('aceita Firestore Timestamp-like com toMillis()', () => {
    const stamp = { toMillis: () => 1_234_567 };
    expect(lastLoginToMillis(stamp)).toBe(1_234_567);
  });

  it('aceita Date-like com toDate()', () => {
    const date = new Date('2025-06-01T00:00:00Z');
    const stamp = { toDate: () => date };
    expect(lastLoginToMillis(stamp)).toBe(date.getTime());
  });

  it('devolve null para valores inválidos ou ausentes', () => {
    expect(lastLoginToMillis(null)).toBeNull();
    expect(lastLoginToMillis(undefined)).toBeNull();
    expect(lastLoginToMillis('not-a-date')).toBeNull();
    expect(lastLoginToMillis({})).toBeNull();
  });
});

describe('formatDeletionDate', () => {
  it('produz dd/mm/yyyy a partir de millis', () => {
    const ms = Date.UTC(2027, 5, 3, 9, 30, 0);
    expect(formatDeletionDate(ms)).toBe('03/06/2027');
  });

  it('zero-padding de dia e mês', () => {
    const ms = Date.UTC(2026, 0, 7, 0, 0, 0);
    expect(formatDeletionDate(ms)).toBe('07/01/2026');
  });
});
