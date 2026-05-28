import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Globe, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { profile, triage, user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const deriveNameFromEmail = (email?: string | null) => {
    if (!email) return '';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[._-]+/g).filter(Boolean);
    if (parts.length === 0) return '';
    return parts.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1)).join(' ');
  };

  const displayName = (() => {
    const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const email = (typeof profile?.email === 'string' ? profile.email.trim() : '') || (typeof user?.email === 'string' ? user.email.trim() : '');
    const normalizedName = name.toLowerCase();
    if (!name || normalizedName === 'cpc') return deriveNameFromEmail(email) || '';
    return name;
  })();

  const navLinks = [
    { href: '/', label: t.nav.home },
    { href: '/sobre', label: t.nav.about },
    { href: '/como-funciona', label: t.nav.howItWorks },
    { href: '/contacto', label: t.nav.contact },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    const role = (profile?.role ?? (user?.user_metadata?.role as UserRole | undefined));
    if (!role) return '/';
    if (role === 'migrant') {
      // Always point to dashboard, let the TriageGuard handle redirection if needed
      return '/dashboard/migrante';
    }
    if (role === 'company') return '/dashboard/empresa';
    return '/dashboard/cpc';
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border/50 backdrop-blur-sm">
      <div className="cpc-container">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt={t.header.logoAlt} className="h-12 w-auto" />
            <div className="hidden lg:block ml-2 text-xs text-primary font-medium leading-tight">
              {t.header.taglineLine1}<br />{t.header.taglineLine2}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="hidden sm:flex items-center text-xs font-medium text-muted-foreground gap-1 mr-2">
              <button
                onClick={() => setLanguage('pt')}
                className={`hover:text-primary transition-colors ${language === 'pt' ? 'text-primary' : ''}`}
              >
                PT
              </button>
              <span>|</span>
              <button
                onClick={() => setLanguage('en')}
                className={`hover:text-primary transition-colors ${language === 'en' ? 'text-primary' : ''}`}
              >
                EN
              </button>
              <span>|</span>
              <button
                onClick={() => setLanguage('es')}
                className={`hover:text-primary transition-colors ${language === 'es' ? 'text-primary' : ''}`}
              >
                ES
              </button>
              <span>|</span>
              <button
                onClick={() => setLanguage('fr')}
                className={`hover:text-primary transition-colors ${language === 'fr' ? 'text-primary' : ''}`}
              >
                FR
              </button>
            </div>

            {/* Auth Buttons / User Menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-primary">
                    <User className="h-5 w-5" />
                    <span className="hidden sm:inline font-medium">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate(getDashboardPath())}>
                    {t.nav.dashboard}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t.nav.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Button variant="ghost" className="font-semibold text-primary hover:text-primary/90 hover:bg-blue-50" asChild>
                  <Link to="/entrar">{t.nav.login}</Link>
                </Button>
                <Button className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 shadow-md" asChild>
                  <Link to="/registar">{t.nav.register}</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-6 border-t border-border animate-in slide-in-from-top-5">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-medium text-muted-foreground hover:text-primary transition-colors px-2"
                >
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
                  <Button variant="ghost" className="justify-start text-primary font-semibold" asChild>
                    <Link to="/entrar" onClick={() => setMobileMenuOpen(false)}>{t.nav.login}</Link>
                  </Button>
                  <Button className="w-full bg-primary font-semibold text-white" asChild>
                    <Link to="/registar" onClick={() => setMobileMenuOpen(false)}>{t.nav.register}</Link>
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
