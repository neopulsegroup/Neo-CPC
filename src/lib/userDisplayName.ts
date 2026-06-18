import { resolveMigrantRegisteredName } from '@/lib/migrantProfileDisplay';

export type CompanyNamePreference = {
  legalName: string;
  userName: string;
  showUserName: boolean;
};

function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function deriveNameFromEmail(email?: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/g).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ');
}

export function parseCompanyNamePreference(doc: Record<string, unknown> | null | undefined): CompanyNamePreference {
  const legalName =
    (typeof doc?.company_name === 'string' && doc.company_name.trim()) ||
    (typeof doc?.legal_name === 'string' && doc.legal_name.trim()) ||
    '';
  const userName = (typeof doc?.user_display_name === 'string' && doc.user_display_name.trim()) || '';
  return {
    legalName,
    userName,
    showUserName: doc?.show_user_name === true,
  };
}

export function resolveMigrantWelcomeDisplayName(args: {
  profileDocName?: string | null;
  userProfileName?: string | null;
  migrantRoleFallback: string;
}): string {
  const name = resolveMigrantRegisteredName({
    profileDocName: args.profileDocName,
    userProfileName: args.userProfileName,
  });
  return name || args.migrantRoleFallback;
}

export function resolveCompanyWelcomeDisplayName(args: {
  namePreference?: CompanyNamePreference | null;
  profileDocName?: string | null;
  userDocName?: string | null;
  profileEmail?: string | null;
  authEmail?: string | null;
  role?: string | null;
  userFallback: string;
}): string {
  const preferredUserName = args.namePreference?.userName?.trim() || '';
  const preferredLegalName = args.namePreference?.legalName?.trim() || '';
  if (args.namePreference?.showUserName && preferredUserName) return preferredUserName;
  if (args.namePreference && !args.namePreference.showUserName && preferredLegalName) return preferredLegalName;

  const rawName =
    (typeof args.profileDocName === 'string' && args.profileDocName.trim()) ||
    (typeof args.userDocName === 'string' ? args.userDocName.trim() : '');
  const email =
    (typeof args.profileEmail === 'string' ? args.profileEmail.trim() : '') ||
    (typeof args.authEmail === 'string' ? args.authEmail.trim() : '');
  const derivedFromEmail = deriveNameFromEmail(email);
  const normalizedName = normalizeText(rawName);
  const normalizedRole = normalizeText(args.role ?? null);
  const isGeneric =
    normalizedName.length === 0 ||
    normalizedName === normalizedRole ||
    ['empresa', 'company', 'utilizador', 'user', 'admin'].includes(normalizedName);
  return isGeneric ? derivedFromEmail || args.userFallback : rawName;
}

export function resolveCpcWelcomeDisplayName(args: {
  profileDocName?: string | null;
  userDocName?: string | null;
  authDisplayName?: string | null;
  profileEmail?: string | null;
  authEmail?: string | null;
  role?: string | null;
  userFallback: string;
}): string {
  const profileDocName = typeof args.profileDocName === 'string' ? args.profileDocName.trim() : '';
  const userDocName = typeof args.userDocName === 'string' ? args.userDocName.trim() : '';
  const authName = typeof args.authDisplayName === 'string' ? args.authDisplayName.trim() : '';
  const rawName = profileDocName || userDocName || authName;
  const email =
    (typeof args.profileEmail === 'string' ? args.profileEmail.trim() : '') ||
    (typeof args.authEmail === 'string' ? args.authEmail.trim() : '');
  const derivedFromEmail = deriveNameFromEmail(email);
  const normalizedName = normalizeText(rawName);
  const normalizedRole = normalizeText(args.role ?? null);
  const isGeneric =
    normalizedName.length === 0 ||
    normalizedName === 'cpc' ||
    normalizedName === normalizedRole ||
    ['admin', 'administrador', 'equipa', 'staff', 'team'].includes(normalizedName);
  return isGeneric ? derivedFromEmail || args.userFallback : rawName;
}

export function resolveDashboardWelcomeDisplayName(args: {
  role?: string | null;
  profileDocName?: string | null;
  userDocName?: string | null;
  authDisplayName?: string | null;
  profileEmail?: string | null;
  authEmail?: string | null;
  companyPreference?: CompanyNamePreference | null;
  fallbacks: {
    migrant: string;
    company: string;
    cpc: string;
  };
}): string {
  const role = typeof args.role === 'string' ? args.role.toLowerCase() : '';
  if (role === 'migrant') {
    return resolveMigrantWelcomeDisplayName({
      profileDocName: args.profileDocName,
      userProfileName: args.userDocName,
      migrantRoleFallback: args.fallbacks.migrant,
    });
  }
  if (role === 'company') {
    return resolveCompanyWelcomeDisplayName({
      namePreference: args.companyPreference,
      profileDocName: args.profileDocName,
      userDocName: args.userDocName,
      profileEmail: args.profileEmail,
      authEmail: args.authEmail,
      role: args.role,
      userFallback: args.fallbacks.company,
    });
  }
  return resolveCpcWelcomeDisplayName({
    profileDocName: args.profileDocName,
    userDocName: args.userDocName,
    authDisplayName: args.authDisplayName,
    profileEmail: args.profileEmail,
    authEmail: args.authEmail,
    role: args.role,
    userFallback: args.fallbacks.cpc,
  });
}
