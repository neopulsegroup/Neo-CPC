export type CompanyRegistrationStatus = 'pending' | 'approved' | 'rejected';

export type CompanyVerificationDoc = {
  verified?: unknown;
  rejected?: unknown;
};

export function getCompanyRegistrationStatus(company: CompanyVerificationDoc | null | undefined): CompanyRegistrationStatus {
  if (company?.verified === true) return 'approved';
  if (company?.rejected === true) return 'rejected';
  return 'pending';
}

export function companyCanPublishJobs(company: CompanyVerificationDoc | null | undefined): boolean {
  return company?.verified === true;
}

export function parseUnknownDate(value: unknown): Date | null {
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = (value as { seconds: number }).seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}
