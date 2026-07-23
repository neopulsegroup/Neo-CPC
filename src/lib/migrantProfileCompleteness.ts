/**
 * Percentagem de preenchimento do perfil do migrante (Informação Pessoal + Perfil Profissional),
 * alinhada ao painel do migrante em `MigrantDashboard`.
 */
export type MigrantProfileFieldsForCompleteness = {
  name?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  cep?: string | null;
  identificationNumber?: string | null;
  region?: string | null;
  regionOther?: string | null;
  professionalTitle?: string | null;
  professionalExperience?: string | null;
  skills?: string | null;
  languagesList?: string | null;
};

export type MigrantPersonalInfoAuthFallbacks = {
  authName?: string | null;
  authPhone?: string | null;
};

const PERSONAL_INFO_REGIONS = ['Lisboa', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Outra'] as const;

function nonEmpty(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalize(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function digits(v: string): string {
  return v.replace(/\D/g, '');
}

function validateBirthDate(raw: string): boolean {
  if (!raw) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return false;
  const d = new Date(raw);
  return Number.isFinite(d.getTime());
}

function validateCepComplete(raw: string): boolean {
  const v = raw.trim();
  if (!v || !/^[\d-]+$/.test(v)) return false;
  const d = v.replace(/\D/g, '');
  return d.length >= 4 && d.length <= 9;
}

function validateRegion(raw: string): boolean {
  return (PERSONAL_INFO_REGIONS as readonly string[]).includes(raw);
}

/** Campos em falta na secção Informação Pessoal (labels PT para alertas). */
export function getMissingMigrantPersonalInfoFields(
  profileDoc: MigrantProfileFieldsForCompleteness | null | undefined,
  opts?: MigrantPersonalInfoAuthFallbacks
): string[] {
  const p = profileDoc || {};
  const missing: string[] = [];

  const name = normalize(p.name) || normalize(opts?.authName);
  if (!name) missing.push('Nome');

  const phoneRaw = normalize(p.phone) || normalize(opts?.authPhone);
  if (!phoneRaw || digits(phoneRaw).length < 9) missing.push('Telefone');

  const birthRaw = normalize(p.birthDate);
  if (!birthRaw || !validateBirthDate(birthRaw)) missing.push('Data de nascimento');

  if (!nonEmpty(normalize(p.nationality))) missing.push('Nacionalidade');

  const address = normalize(p.address);
  if (!address || address.length < 10) missing.push('Morada');

  if (!nonEmpty(normalize(p.addressNumber))) missing.push('Número');

  const cepRaw = normalize(p.cep) || normalize(p.identificationNumber);
  if (!validateCepComplete(cepRaw)) missing.push('CEP');

  const region = normalize(p.region);
  if (!region || !validateRegion(region)) missing.push('Região');
  if (region === 'Outra') {
    const other = normalize(p.regionOther);
    if (!other || other.length < 2) missing.push('Região (Outra)');
  }

  return missing;
}

/** Informação Pessoal completa — obrigatória para usar a plataforma. */
export function isMigrantPersonalInfoComplete(
  profileDoc: MigrantProfileFieldsForCompleteness | null | undefined,
  opts?: MigrantPersonalInfoAuthFallbacks
): boolean {
  return getMissingMigrantPersonalInfoFields(profileDoc, opts).length === 0;
}

export const MIGRANT_PERSONAL_INFO_PROFILE_PATH = '/dashboard/migrante/perfil';

export function computeMigrantProfileCompletenessPercent(
  profileDoc: MigrantProfileFieldsForCompleteness | null | undefined,
  opts?: MigrantPersonalInfoAuthFallbacks
): number {
  const p = profileDoc || {};
  const requiredChecks: boolean[] = [];

  requiredChecks.push(nonEmpty(normalize(p.name) || normalize(opts?.authName)));

  const phoneRaw = normalize(p.phone) || normalize(opts?.authPhone);
  requiredChecks.push(Boolean(phoneRaw) && digits(phoneRaw).length >= 9);

  const birthRaw = normalize(p.birthDate);
  requiredChecks.push(Boolean(birthRaw) && validateBirthDate(birthRaw));

  requiredChecks.push(nonEmpty(normalize(p.nationality)));

  const address = normalize(p.address);
  requiredChecks.push(Boolean(address) && address.length >= 10);

  requiredChecks.push(nonEmpty(normalize(p.addressNumber)));

  const cepRaw = normalize(p.cep) || normalize(p.identificationNumber);
  requiredChecks.push(validateCepComplete(cepRaw));

  const region = normalize(p.region);
  requiredChecks.push(Boolean(region) && validateRegion(region));
  if (region === 'Outra') {
    const other = normalize(p.regionOther);
    requiredChecks.push(Boolean(other) && other.length >= 2);
  }

  const professionalTitle = normalize(p.professionalTitle);
  requiredChecks.push(Boolean(professionalTitle) && professionalTitle.length >= 2);

  const professionalExperience = normalize(p.professionalExperience);
  requiredChecks.push(Boolean(professionalExperience) && professionalExperience.length >= 10);

  const skills = normalize(p.skills);
  const skillTokens = skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
  requiredChecks.push(skillTokens.length > 0);

  requiredChecks.push(nonEmpty(normalize(p.languagesList)));

  const filled = requiredChecks.filter(Boolean).length;
  return Math.round((filled / requiredChecks.length) * 100);
}
