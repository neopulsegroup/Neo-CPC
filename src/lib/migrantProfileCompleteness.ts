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

export function computeMigrantProfileCompletenessPercent(
  profileDoc: MigrantProfileFieldsForCompleteness | null | undefined,
  opts?: { authName?: string | null; authPhone?: string | null }
): number {
  const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const normalize = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const digits = (v: string) => v.replace(/\D/g, '');
  const validateBirthDate = (raw: string) => {
    if (!raw) return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return false;
    const d = new Date(raw);
    return Number.isFinite(d.getTime());
  };
  const validateCepComplete = (raw: string) => {
    const v = raw.trim();
    if (!v || !/^[\d-]+$/.test(v)) return false;
    const d = v.replace(/\D/g, '');
    return d.length >= 4 && d.length <= 9;
  };
  const validateRegion = (raw: string) => ['Lisboa', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Outra'].includes(raw);

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
