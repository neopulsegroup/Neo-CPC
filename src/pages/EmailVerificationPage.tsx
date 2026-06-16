import { useCallback, useEffect, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { Loader2, Mail, LogOut, RotateCw, CheckCircle2 } from 'lucide-react';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

/**
 * T-01 (Bloco 4). Ecrã apresentado quando o utilizador autenticado ainda não
 * verificou o email. Permite reenviar (cooldown 60s) e fazer manual re-check.
 */
export default function EmailVerificationPage() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending || !user) return;
    setResending(true);
    try {
      await sendEmailVerification(user, {
        url: `${window.location.origin}/entrar`,
        handleCodeInApp: false,
      });
      setCooldown(60);
      toast.success(t.get('emailVerification.resent'));
    } catch (error) {
      console.error('resend_verification_failed', error);
      toast.error(t.get('emailVerification.resendError'));
    } finally {
      setResending(false);
    }
  }, [cooldown, resending, user, t]);

  const handleCheck = useCallback(async () => {
    if (checking || !user) return;
    setChecking(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        // Hard-reload para o guard reavaliar com auth state actualizado.
        window.location.reload();
      } else {
        toast.error(t.get('emailVerification.notYet'));
      }
    } catch (error) {
      console.error('reload_user_failed', error);
      toast.error(t.get('emailVerification.notYet'));
    } finally {
      setChecking(false);
    }
  }, [checking, user, t]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('logout_failed', error);
    }
    window.location.assign('/');
  }, [logout]);

  const message = t
    .get('emailVerification.message')
    .replace('{email}', user?.email ?? '')
    .replace('{{email}}', user?.email ?? '');

  return (
    <Layout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-md px-4">
          <div className="cpc-card p-8 space-y-6">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Mail className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">{t.get('emailVerification.title')}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              <p className="text-xs text-muted-foreground">{t.get('emailVerification.checkSpam')}</p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleCheck}
                disabled={checking}
                className="w-full"
              >
                {checking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {t.get('emailVerification.checkButton')}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="w-full"
              >
                {resending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {cooldown > 0
                  ? t.get('emailVerification.cooldown').replace('{seconds}', String(cooldown)).replace('{{seconds}}', String(cooldown))
                  : t.get('emailVerification.resend')}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleLogout}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                {t.get('emailVerification.logout')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
