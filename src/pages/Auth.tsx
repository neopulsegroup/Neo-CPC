import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { mapAuthErrorToMessage } from '@/lib/authErrorMapper';
import { toast } from 'sonner';
import { User, Building2, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';

type AuthMode = 'login' | 'register';

/**
 * TASK-05: opções de Área de Atividade no registo de empresa.
 * TODO(D7): confirmar lista oficial com CIBEA (ver docs/CLIENT_DECISIONS.md).
 */
const ACTIVITY_AREA_KEYS = [
  'construction',
  'hospitality',
  'tech',
  'health',
  'education',
  'commerce',
  'industry',
  'agriculture',
  'transport',
  'services',
  'other',
] as const;
type ActivityAreaKey = typeof ACTIVITY_AREA_KEYS[number];

/**
 * Labels em PT para gravar em `companies.activity_area` independentemente
 * do idioma da UI no registo. CIBEA lê dados em PT, e o CompanyDashboard
 * trata o campo como string livre.
 */
const ACTIVITY_AREA_LABELS_PT: Record<Exclude<ActivityAreaKey, 'other'>, string> = {
  construction: 'Construção',
  hospitality: 'Hotelaria e Restauração',
  tech: 'Tecnologia',
  health: 'Saúde',
  education: 'Educação',
  commerce: 'Comércio',
  industry: 'Indústria',
  agriculture: 'Agricultura',
  transport: 'Transportes e Logística',
  services: 'Serviços',
};

function resolveActivityAreaLabel(key: string, otherText: string): string {
  if (key === 'other') return otherText.trim();
  if (key in ACTIVITY_AREA_LABELS_PT) {
    return ACTIVITY_AREA_LABELS_PT[key as keyof typeof ACTIVITY_AREA_LABELS_PT];
  }
  return '';
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isRegisterPath = location.pathname === '/registar';
  const initialMode = isRegisterPath || searchParams.get('mode') === 'register' ? 'register' : 'login';
  const initialRole = searchParams.get('role') as UserRole | null;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    nif: '',
    // TASK-05: chave da opção selecionada (vazio = não escolhido) + texto livre quando "Outro".
    activityArea: '',
    activityAreaOther: '',
  });

  const { t } = useLanguage();
  const { login, register, isAuthenticated, profile, triage, isLoading: authLoading, accessIssue, clearAccessIssue } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && profile && !authLoading) {
      // Determine where to redirect based on role and triage status
      if (profile.role === 'migrant') {
        const triageCompleted = triage?.completed ?? false;
        // Se a triagem não estiver completa, redireciona para a triagem.
        // Se estiver completa, vai para o dashboard.
        navigate(triageCompleted ? '/dashboard/migrante' : '/triagem');
      } else if (profile.role === 'company') {
        navigate('/dashboard/empresa');
      } else {
        navigate('/dashboard/cpc');
      }
    }
  }, [isAuthenticated, profile, triage, authLoading, navigate]);

  const roles = [
    { id: 'migrant' as UserRole, label: t.auth.roles.migrant, icon: User, description: t.auth.roles.migrantDesc },
    { id: 'company' as UserRole, label: t.auth.roles.company, icon: Building2, description: t.auth.roles.companyDesc },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAccessIssue();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        toast.success(t.auth.welcomeBack);
      } else {
        if (!selectedRole) {
          toast.error(t.auth.selectProfileError);
          setIsLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error(t.auth.passwordMismatch);
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          toast.error(t.auth.passwordLengthError);
          setIsLoading(false);
          return;
        }
        // TASK-05: validar e resolver activity_area apenas para empresa.
        let activityAreaResolved: string | undefined;
        if (selectedRole === 'company') {
          if (!formData.activityArea) {
            toast.error(t.get('auth.company.activityArea.required'));
            setIsLoading(false);
            return;
          }
          if (formData.activityArea === 'other' && !formData.activityAreaOther.trim()) {
            toast.error(t.get('auth.company.activityArea.required'));
            setIsLoading(false);
            return;
          }
          activityAreaResolved = resolveActivityAreaLabel(
            formData.activityArea,
            formData.activityAreaOther
          );
          if (!activityAreaResolved || activityAreaResolved.length < 2) {
            toast.error(t.get('auth.company.activityArea.required'));
            setIsLoading(false);
            return;
          }
        }
        await register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: selectedRole,
          nif: selectedRole === 'company' ? formData.nif : undefined,
          activityArea: activityAreaResolved,
        });
      toast.success(t.auth.accountCreated);
      
      // Force navigation after registration based on role
      if (selectedRole === 'company') {
        navigate('/dashboard/empresa');
      } else if (selectedRole === 'migrant') {
        navigate('/triagem');
      } else {
        navigate('/dashboard/cpc');
      }
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      toast.error(
        mapAuthErrorToMessage({
          error,
          mode,
          t,
          secureRegistrationMessage: true,
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout hideFooter>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Role Selection Screen (for register)
  if (mode === 'register' && !selectedRole) {
    return (
      <Layout hideFooter>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
          <div className="w-full max-w-lg px-4">
            <div className="text-center mb-8">
              <img src={logo} alt="CPC" className="h-12 mx-auto mb-6" />
              <h1 className="text-2xl font-bold mb-2">{t.auth.selectRole}</h1>
              <p className="text-muted-foreground">
                {t.auth.subtitleAccountSelection}
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className="w-full cpc-card p-6 flex items-center gap-4 text-left hover:border-primary transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <role.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{role.label}</h3>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {t.auth.hasAccount}{' '}
              <button
                onClick={() => setMode('login')}
                className="text-primary hover:underline font-medium"
              >
                {t.auth.login}
              </button>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-md px-4">
          {mode === 'register' && selectedRole && (
            <button
              onClick={() => setSelectedRole(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.auth.backToSelection}
            </button>
          )}

          <div className="cpc-card p-8">
            <div className="text-center mb-8">
              <img src={logo} alt="CPC" className="h-10 mx-auto mb-6" />
              <h1 className="text-2xl font-bold">
                {mode === 'login' ? t.auth.login : t.auth.register}
              </h1>
              {mode === 'register' && selectedRole && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t.auth.registerAs} <span className="font-medium text-primary">
                    {roles.find(r => r.id === selectedRole)?.label}
                  </span>
                </p>
              )}
            </div>

            {mode === 'login' && accessIssue && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <div className="font-semibold">
                  {accessIssue === 'blocked' ? t.auth.accessDeniedBlockedTitle : t.auth.accessDeniedDisabledTitle}
                </div>
                <div className="mt-1">
                  {accessIssue === 'blocked' ? t.auth.accessDeniedBlockedDescription : t.auth.accessDeniedDisabledDescription}
                </div>
                <div className="mt-2 font-medium">{t.auth.accessDeniedContactAdmin}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {selectedRole === 'company' ? t.auth.companyName : t.auth.fullName}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={selectedRole === 'company' ? t.auth.placeholderCompany : t.auth.placeholderName}
                  />
                </div>
              )}

              {mode === 'register' && selectedRole === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="nif">{t.auth.nif || 'NIF'}</Label>
                  <Input
                    id="nif"
                    value={formData.nif}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    required
                    placeholder={t.auth.placeholderNif || '123456789'}
                    minLength={9}
                    maxLength={9}
                  />
                </div>
              )}

              {/* TASK-05: Área de Atividade obrigatória para empresa. */}
              {mode === 'register' && selectedRole === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="activityArea">{t.get('auth.company.activityArea.label')}</Label>
                  <Select
                    value={formData.activityArea}
                    onValueChange={(v) => setFormData({ ...formData, activityArea: v })}
                  >
                    <SelectTrigger id="activityArea" aria-required="true">
                      <SelectValue placeholder={t.get('auth.company.activityArea.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_AREA_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {t.get(`auth.company.activityArea.options.${key}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.activityArea === 'other' && (
                    <Input
                      id="activityAreaOther"
                      value={formData.activityAreaOther}
                      onChange={(e) => setFormData({ ...formData, activityAreaOther: e.target.value })}
                      required
                      placeholder={t.get('auth.company.activityArea.otherPlaceholder')}
                      maxLength={120}
                      className="mt-2"
                    />
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="exemplo@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              )}

              {mode === 'login' && (
                <div className="text-right">
                  <Link to="/recuperar-senha" className="text-sm text-primary hover:underline">
                    {t.auth.forgotPassword}
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  mode === 'login' ? t.auth.login : t.auth.register
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  {t.auth.noAccount}{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setSelectedRole(null);
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {t.auth.register}
                  </button>
                </>
              ) : (
                <>
                  {t.auth.hasAccount}{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="text-primary hover:underline font-medium"
                  >
                    {t.auth.login}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
