import { useLanguage } from '@/contexts/LanguageContext';

type Props = {
  className?: string;
};

export function ApplicantProfileUnavailableBadge({ className = '' }: Props) {
  const { t } = useLanguage();
  const label = t.get('company.applications.profileUnavailable');
  const hint = t.get('company.applications.profileUnavailableHint');

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 ${className}`.trim()}
      title={hint}
    >
      {label}
    </span>
  );
}
