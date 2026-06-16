import type { ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import EmailVerificationPage from '@/pages/EmailVerificationPage';
import { shouldRequireEmailVerification } from '@/lib/emailVerification';

/**
 * T-01 (Bloco 4). Bloqueia rotas autenticadas até o email estar verificado.
 * Aplica grandfather clause: contas criadas antes do cutoff atravessam livremente
 * (ver `src/lib/emailVerification.ts`).
 */
export function EmailVerificationGuard({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useAuth();

  // O ProtectedRoute pai já cobre `!isAuthenticated` e o loading; este guard
  // só corre quando há sessão + profile possível.
  if (isLoading) {
    return <>{children}</>;
  }

  const requireVerification = shouldRequireEmailVerification({
    emailVerified: user?.emailVerified,
    profile,
  });

  if (requireVerification) {
    return <EmailVerificationPage />;
  }

  return <>{children}</>;
}
