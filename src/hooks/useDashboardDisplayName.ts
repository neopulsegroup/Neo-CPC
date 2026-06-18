import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCompanyNamePreference } from '@/hooks/useCompanyNamePreference';
import { resolveDashboardWelcomeDisplayName } from '@/lib/userDisplayName';

/** Nome exibido na saudação dos dashboards e no header autenticado. */
export function useDashboardDisplayName(): string {
  const { profile, profileData, user } = useAuth();
  const { t } = useLanguage();
  const isCompany = profile?.role === 'company';
  const companyPreference = useCompanyNamePreference(user?.uid, isCompany);

  return useMemo(
    () =>
      resolveDashboardWelcomeDisplayName({
        role: profile?.role,
        profileDocName: profileData?.name,
        userDocName: profile?.name,
        authDisplayName: user?.displayName,
        profileEmail: profile?.email,
        authEmail: user?.email,
        companyPreference,
        fallbacks: {
          migrant: t.get('auth.roles.migrant'),
          company: t.get('company.menu.user_fallback'),
          cpc: t.get('cpc.menu.user_fallback'),
        },
      }),
    [
      companyPreference,
      profile?.email,
      profile?.name,
      profile?.role,
      profileData?.name,
      t,
      user?.displayName,
      user?.email,
    ]
  );
}
