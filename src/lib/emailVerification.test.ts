import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/integrations/firebase/auth';
import {
  VERIFICATION_CUTOFF_ISO,
  createdAtToMillis,
  shouldRequireEmailVerification,
} from './emailVerification';

function makeProfile(createdAt: unknown): UserProfile {
  return {
    email: 'x@y.pt',
    name: 'X',
    role: 'migrant',
    active: true,
    blocked: false,
    createdAt,
    updatedAt: createdAt,
  } as unknown as UserProfile;
}

describe('createdAtToMillis', () => {
  it('aceita ISO string', () => {
    expect(createdAtToMillis('2026-01-01T00:00:00Z')).toBe(Date.UTC(2026, 0, 1));
  });
  it('aceita number (ms)', () => {
    expect(createdAtToMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
  it('aceita Firestore Timestamp-like', () => {
    expect(createdAtToMillis({ toMillis: () => 42 })).toBe(42);
  });
  it('devolve null para inválido', () => {
    expect(createdAtToMillis('not-a-date')).toBeNull();
    expect(createdAtToMillis(null)).toBeNull();
  });
});

describe('shouldRequireEmailVerification', () => {
  it('email já verificado → não bloqueia', () => {
    expect(
      shouldRequireEmailVerification({
        emailVerified: true,
        profile: makeProfile('2027-01-01T00:00:00Z'),
      })
    ).toBe(false);
  });

  it('não verificado + conta nova (após cutoff) → bloqueia', () => {
    expect(
      shouldRequireEmailVerification({
        emailVerified: false,
        profile: makeProfile('2027-01-01T00:00:00Z'),
      })
    ).toBe(true);
  });

  it('não verificado + conta antiga (antes do cutoff) → grandfather, não bloqueia', () => {
    expect(
      shouldRequireEmailVerification({
        emailVerified: false,
        profile: makeProfile('2025-01-01T00:00:00Z'),
      })
    ).toBe(false);
  });

  it('profile null → não bloqueia (loading)', () => {
    expect(
      shouldRequireEmailVerification({
        emailVerified: false,
        profile: null,
      })
    ).toBe(false);
  });

  it('cutoff ISO é o esperado', () => {
    expect(VERIFICATION_CUTOFF_ISO).toBe('2026-06-01T00:00:00.000Z');
  });
});
