import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Linkedin, Instagram } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { COOKIE_CONSENT_OPEN_SETTINGS_EVENT } from '@/lib/cookieConsent';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="bg-muted/30 border-t border-border pt-16 pb-8">
      <div className="cpc-container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

          {/* Column 1: Brand */}
          <div className="space-y-4">
            <Link to="/" className="block">
              <div className="flex items-center mb-4">
                <img src={logo} alt={t.footer.logoAlt} className="h-16 w-auto" />
              </div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t.footer.tagline}
            </p>
          </div>

          {/* Column 2: Plataforma */}
          <div>
            <h4 className="font-bold text-foreground mb-6 uppercase text-xs tracking-wider">{t.footer.column1}</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/em-breve?feature=find_talent" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.findTalent}
                </Link>
              </li>
              <li>
                <Link to="/em-breve?feature=find_work" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.findWork}
                </Link>
              </li>
              <li>
                <Link to="/em-breve?feature=training" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.training}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Suporte */}
          <div>
            <h4 className="font-bold text-foreground mb-6 uppercase text-xs tracking-wider">{t.footer.column2}</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/ajuda" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.help}
                </Link>
              </li>
              <li>
                <Link to="/em-breve?feature=terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.cookies}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contactos */}
          <div>
            <h4 className="font-bold text-foreground mb-6 uppercase text-xs tracking-wider">{t.footer.column3}</h4>
            <ul className="space-y-4 mb-6">
              <li className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <Mail className="h-4 w-4 text-primary" />
                <span>{t.footer.contacts.email}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <span>{t.footer.contacts.phone}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{t.footer.contacts.location}</span>
              </li>
            </ul>

            <div className="flex items-center gap-4">
              <a
                href="https://www.linkedin.com/company/portalcpc-oporto-forte/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-full"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/portal.cpc/?utm_source=ig_web_button_share_sheet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-2 hover:bg-primary/10 rounded-full"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>


        {/* Portugal Inovação Social — contexto */}
        <div className="border-t border-border pt-8 mb-8">
          <div className="max-w-4xl mx-auto text-sm text-muted-foreground leading-relaxed space-y-4 text-center md:text-left">
            <p>{t.footer.socialInclusionIntro}</p>
            <p className="font-medium text-foreground/90">{t.footer.socialInclusionPhases}</p>
            <p>{t.footer.socialInclusionClosing}</p>
          </div>
        </div>

        {/* Support Logos */}
        <div className="border-t border-border pt-8 mb-8 flex flex-col items-center gap-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t.footer.coFunded}</p>
          <img
            src="/logos-apoio.png"
            alt={t.footer.supportLogosAlt}
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>{t.get('footer.copyright', { year: currentYear })}</p>
          <div className="flex gap-6">
            <Link to="/privacidade" className="hover:text-primary transition-colors">{t.footer.privacy}</Link>
            <Link to="/termos" className="hover:text-primary transition-colors">{t.footer.terms}</Link>
            <Link to="/cookies" className="hover:text-primary transition-colors">{t.footer.cookies}</Link>
            <button
              type="button"
              className="hover:text-primary transition-colors"
              onClick={() => window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_SETTINGS_EVENT))}
            >
              {t.footer.manageCookies}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
