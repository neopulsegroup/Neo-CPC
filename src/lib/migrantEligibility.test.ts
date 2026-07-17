import { describe, expect, it } from 'vitest';
import { canAccessScasAndPdi, canBookMigrantSessions, normalizeEligibilityProfile } from './migrantEligibility';

describe('migrantEligibility SCAS/PDI access', () => {
  it('só Perfil A tem acesso a SCAS e PDI', () => {
    expect(canAccessScasAndPdi('A')).toBe(true);
    expect(canAccessScasAndPdi('B')).toBe(false);
    expect(canAccessScasAndPdi(null)).toBe(false);
    expect(canAccessScasAndPdi(undefined)).toBe(false);
  });

  it('só Perfil A pode marcar sessões', () => {
    expect(canBookMigrantSessions('A')).toBe(true);
    expect(canBookMigrantSessions('B')).toBe(false);
    expect(canBookMigrantSessions(null)).toBe(false);
  });

  it('normaliza valores inválidos para null', () => {
    expect(normalizeEligibilityProfile('A')).toBe('A');
    expect(normalizeEligibilityProfile('C')).toBeNull();
    expect(normalizeEligibilityProfile(1)).toBeNull();
  });
});
