import { AlertTriangle, Ban } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CompanyRegistrationStatus } from '@/lib/companyVerification';

type Props = {
  status: CompanyRegistrationStatus;
};

export function CompanyVerificationBanner({ status }: Props) {
  const { t } = useLanguage();

  if (status === 'approved') return null;

  const isRejected = status === 'rejected';

  return (
    <div
      className={`cpc-card p-4 mb-6 flex items-start gap-3 ${
        isRejected ? 'border-rose-200 bg-rose-50/80' : 'border-amber-200 bg-amber-50/80'
      }`}
    >
      {isRejected ? (
        <Ban className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      )}
      <div>
        <p className="font-medium text-sm">
          {isRejected
            ? t.get('company.verification.rejectedTitle')
            : t.get('company.verification.pendingTitle')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isRejected
            ? t.get('company.verification.rejectedDescription')
            : t.get('company.verification.pendingDescription')}
        </p>
      </div>
    </div>
  );
}
