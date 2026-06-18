import { describe, expect, it } from 'vitest';

import {
  resolveCompanyWelcomeDisplayName,
  resolveCpcWelcomeDisplayName,
  resolveDashboardWelcomeDisplayName,
  resolveMigrantWelcomeDisplayName,
} from './userDisplayName';

describe('resolveDashboardWelcomeDisplayName', () => {
  const fallbacks = {
    migrant: 'Pessoa Migrante',
    company: 'Utilizador',
    cpc: 'Utilizador CPC',
  };

  it('usa o nome do perfil do migrante com o mesmo fallback da saudação', () => {
    expect(
      resolveMigrantWelcomeDisplayName({
        profileDocName: 'Ana Costa',
        userProfileName: 'Ana',
        migrantRoleFallback: fallbacks.migrant,
      })
    ).toBe('Ana Costa');

    expect(
      resolveDashboardWelcomeDisplayName({
        role: 'migrant',
        profileDocName: '',
        userDocName: '',
        fallbacks,
      })
    ).toBe('Pessoa Migrante');
  });

  it('respeita a preferência de exibição da empresa', () => {
    expect(
      resolveCompanyWelcomeDisplayName({
        namePreference: {
          legalName: 'Empresa Lda',
          userName: 'João Gestor',
          showUserName: true,
        },
        userFallback: fallbacks.company,
      })
    ).toBe('João Gestor');

    expect(
      resolveCompanyWelcomeDisplayName({
        namePreference: {
          legalName: 'Empresa Lda',
          userName: 'João Gestor',
          showUserName: false,
        },
        userFallback: fallbacks.company,
      })
    ).toBe('Empresa Lda');
  });

  it('deriva o nome CPC a partir do e-mail quando o nome é genérico', () => {
    expect(
      resolveCpcWelcomeDisplayName({
        profileDocName: 'cpc',
        authEmail: 'maria.silva@example.com',
        userFallback: fallbacks.cpc,
      })
    ).toBe('Maria Silva');
  });
});
