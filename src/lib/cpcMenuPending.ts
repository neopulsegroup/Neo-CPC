import { getCompanyRegistrationStatus } from '@/lib/companyVerification';
import { isSessionPendingApproval } from '@/lib/sessionApproval';

export type CpcMenuPendingCounts = {
  agenda: number;
  companies: number;
  offers: number;
};

export const CPC_MENU_PENDING_PATHS = {
  agenda: '/dashboard/cpc/agenda',
  companies: '/dashboard/cpc/empresas',
  offers: '/dashboard/cpc/ofertas',
} as const;

export function countPendingAgendaItems(input: {
  pendingSupportCount: number;
  sessions: Array<{ status?: string | null }>;
}): number {
  const pendingSessions = input.sessions.filter((s) => isSessionPendingApproval(s.status)).length;
  return Math.max(0, input.pendingSupportCount) + pendingSessions;
}

export function countPendingCompanies(companies: Array<{ verified?: unknown; rejected?: unknown }>): number {
  return companies.filter((c) => getCompanyRegistrationStatus(c) === 'pending').length;
}

export function countPendingOffers(offers: Array<{ status?: string | null }>): number {
  return offers.filter((o) => (o.status ?? '').trim() === 'pending_review').length;
}

export function pendingCountForMenuPath(
  path: string,
  counts: CpcMenuPendingCounts
): number {
  if (path === CPC_MENU_PENDING_PATHS.agenda) return counts.agenda;
  if (path === CPC_MENU_PENDING_PATHS.companies) return counts.companies;
  if (path === CPC_MENU_PENDING_PATHS.offers) return counts.offers;
  return 0;
}

export function formatPendingBadgeLabel(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}
