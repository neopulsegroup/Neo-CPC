import { describe, expect, it } from 'vitest';
import {
  buildMigrantJobsAccessProfile,
  canAccessMigrantJobs,
  getMissingProfessionalFieldsForJobs,
  hasEmployerProfessionalAuthorization,
} from './migrantJobsAccess';

describe('migrantJobsAccess', () => {
  const completeProfile = {
    professionalTitle: 'Técnico',
    professionalExperience: 'Mais de dez anos de experiência em logística.',
    skills: 'Excel, comunicação',
    languagesList: 'Português, Inglês',
    authorizeEmployersProfessionalProfile: true,
  };

  it('bloqueia acesso sem perfil profissional completo', () => {
    expect(canAccessMigrantJobs({ ...completeProfile, professionalTitle: '' })).toBe(false);
    expect(getMissingProfessionalFieldsForJobs({ ...completeProfile, skills: '' })).toContain('skills');
  });

  it('bloqueia acesso sem autorização explícita', () => {
    expect(hasEmployerProfessionalAuthorization({ ...completeProfile, authorizeEmployersProfessionalProfile: false })).toBe(false);
    expect(canAccessMigrantJobs({ ...completeProfile, authorizeEmployersProfessionalProfile: false })).toBe(false);
  });

  it('permite acesso com perfil completo e autorização', () => {
    expect(canAccessMigrantJobs(completeProfile)).toBe(true);
  });

  it('prioriza rascunho e extras sobre perfil persistido', () => {
    const effective = buildMigrantJobsAccessProfile({
      profile: { professionalTitle: 'Antigo', professionalExperience: 'Curta' },
      extras: { skills: 'Excel' },
      draft: {
        professionalTitle: 'Novo título',
        professionalExperience: 'Experiência profissional com mais de dez caracteres.',
        languagesList: 'Português',
      },
    });
    expect(effective.professionalTitle).toBe('Novo título');
    expect(effective.professionalExperience).toBe('Experiência profissional com mais de dez caracteres.');
    expect(effective.skills).toBe('Excel');
    expect(effective.languagesList).toBe('Português');
    expect(getMissingProfessionalFieldsForJobs(effective)).toEqual([]);
  });
});
