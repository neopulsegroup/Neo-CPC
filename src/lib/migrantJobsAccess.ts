export type MigrantJobsAccessProfile = {
  professionalTitle?: string | null;
  professionalExperience?: string | null;
  skills?: string | null;
  languagesList?: string | null;
  authorizeEmployersProfessionalProfile?: boolean | null;
};

export const MIGRANT_JOBS_ACCESS_PROFILE_HASH = 'employer-professional-authorization';
export const MIGRANT_JOBS_ACCESS_PROFILE_PATH = `/dashboard/migrante/perfil#${MIGRANT_JOBS_ACCESS_PROFILE_HASH}`;

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getMissingProfessionalFieldsForJobs(profile: MigrantJobsAccessProfile | null | undefined): string[] {
  const p = profile ?? {};
  const missing: string[] = [];

  const professionalTitle = normalize(p.professionalTitle);
  if (!professionalTitle || professionalTitle.length < 2) missing.push('professionalTitle');

  const professionalExperience = normalize(p.professionalExperience);
  if (!professionalExperience || professionalExperience.length < 10) missing.push('professionalExperience');

  const skills = normalize(p.skills);
  const skillTokens = skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (skillTokens.length === 0) missing.push('skills');

  const languagesList = normalize(p.languagesList);
  if (!languagesList) missing.push('languagesList');

  return missing;
}

export function hasEmployerProfessionalAuthorization(profile: MigrantJobsAccessProfile | null | undefined): boolean {
  return profile?.authorizeEmployersProfessionalProfile === true;
}

export function canAccessMigrantJobs(profile: MigrantJobsAccessProfile | null | undefined): boolean {
  return getMissingProfessionalFieldsForJobs(profile).length === 0 && hasEmployerProfessionalAuthorization(profile);
}
