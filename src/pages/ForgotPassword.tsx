import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { resetPassword } from '@/integrations/firebase/auth';
import { mapAuthErrorToMessage } from '@/lib/authErrorMapper';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import logo from '@/assets/logo.png';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error(t.auth.passwordReset.emailRequired);
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(trimmed);
      setSent(true);
      toast.success(t.auth.passwordReset.success);
    } catch (error: unknown) {
      toast.error(
        mapAuthErrorToMessage({
          error,
          mode: 'reset',
          t,
        })
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Layout>
      <section className="cpc-section">
        <div className="cpc-container max-w-md mx-auto">
          <div className="text-center mb-8">
            <img src={logo} alt="CPC" className="h-12 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">{t.auth.passwordReset.title}</h1>
            <p className="text-muted-foreground mt-2">{t.auth.passwordReset.subtitle}</p>
          </div>

          <div className="cpc-card p-6">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Mail className="h-6 w-6" />
                </div>
                <p className="text-muted-foreground">{t.auth.passwordReset.successDetail}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/entrar">{t.auth.passwordReset.backToLogin}</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t.auth.email}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="exemplo@email.com"
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.common.loading}
                    </>
                  ) : (
                    t.auth.passwordReset.submit
                  )}
                </Button>
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link to="/entrar" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              {t.auth.passwordReset.backToLogin}
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
