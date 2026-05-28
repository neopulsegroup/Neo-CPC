export type CandidateStage = 'triage' | 'interview' | 'rejected' | 'hired';
export type ExperienceLevel = 'junior' | 'mid' | 'senior';

export type CandidateFormValues = {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  desired_role: string;
  experience: ExperienceLevel;
  skills: string;
  job_offer_id: string;
  match_percent: string;
  stage: CandidateStage;
};

export function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function stripUnsafeChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    if (code < 32) continue;
    if (code === 127) continue;
    out += ch;
  }
  return out.trim();
}

export function normalizeEmail(value: string): string {
  return stripUnsafeChars(value).toLowerCase();
}

export function normalizePhone(value: string): string {
  const cleaned = stripUnsafeChars(value);
  const plus = cleaned.startsWith('+') ? '+' : '';
  const digits = cleaned.replace(/[^\d]/g, '');
  return `${plus}${digits}`;
}

export function normalizeCPF(value: string): string {
  return stripUnsafeChars(value).replace(/[^\d]/g, '');
}

export function isValidCPF(value: string): boolean {
  const cpf = normalizeCPF(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map((d) => Number(d));
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += digits[i] * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== digits[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += digits[i] * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === digits[10];
}

export function parseSkills(raw: string): string[] {
  const cleaned = stripUnsafeChars(raw);
  if (!cleaned) return [];
  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const key = normalizeText(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.slice(0, 30);
}

export function formatCPF(value: string): string {
  const cpf = normalizeCPF(value);
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

export function formatPhone(value: string): string {
  const phone = normalizePhone(value);
  if (!phone) return '';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length <= 4) return phone;
  if (phone.startsWith('+')) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  return digits;
}

export function csvEscape(value: string): string {
  const safe = value.replaceAll('"', '""');
  return `"${safe}"`;
}

function clampMatch(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function validateCandidate(values: CandidateFormValues, t: { get: (k: string) => string }) {
  const errors: Partial<Record<keyof CandidateFormValues, string>> = {};
  const name = stripUnsafeChars(values.name);
  const cpf = normalizeCPF(values.cpf);
  const email = normalizeEmail(values.email);
  const phone = normalizePhone(values.phone);
  const desiredRole = stripUnsafeChars(values.desired_role);
  const matchRaw = stripUnsafeChars(values.match_percent);
  const matchVal = matchRaw ? Number(matchRaw) : null;

  if (name.length < 2) errors.name = t.get('company.candidates.form.errors.name');
  if (!cpf || !isValidCPF(cpf)) errors.cpf = t.get('company.candidates.form.errors.cpf');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t.get('company.candidates.form.errors.email');
  if (!phone || phone.replace(/[^\d]/g, '').length < 8) errors.phone = t.get('company.candidates.form.errors.phone');
  if (desiredRole.length < 2) errors.desired_role = t.get('company.candidates.form.errors.desired_role');
  if (!values.experience) errors.experience = t.get('company.candidates.form.errors.experience');
  if (!values.stage) errors.stage = t.get('company.candidates.form.errors.stage');
  if (matchVal !== null && (Number.isNaN(matchVal) || matchVal < 0 || matchVal > 100)) errors.match_percent = t.get('company.candidates.form.errors.match');
  return errors;
}

export function toCandidatePayload(companyId: string, values: CandidateFormValues) {
  const skills = parseSkills(values.skills);
  const matchRaw = stripUnsafeChars(values.match_percent);
  const matchVal = matchRaw ? clampMatch(Number(matchRaw)) : null;
  return {
    company_id: companyId,
    name: stripUnsafeChars(values.name),
    cpf: normalizeCPF(values.cpf),
    email: normalizeEmail(values.email),
    phone: normalizePhone(values.phone),
    desired_role: stripUnsafeChars(values.desired_role),
    experience: values.experience,
    skills: skills.length ? skills : null,
    job_offer_id: values.job_offer_id ? stripUnsafeChars(values.job_offer_id) : null,
    match_percent: matchVal,
    stage: values.stage,
  };
}

