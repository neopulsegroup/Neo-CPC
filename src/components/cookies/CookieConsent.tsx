import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { COOKIE_CONSENT_OPEN_SETTINGS_EVENT, defaultCookieConsentCategories, needsCookieConsentPrompt, readCookieConsent, writeCookieConsent } from '@/lib/cookieConsent';
import { ChevronDown } from 'lucide-react';

type Preferences = {
  analytics: boolean;
  personalization: boolean;
  externalServices: boolean;
};

type AccordionSectionId = 'necessary' | 'analytics' | 'personalization' | 'externalServices';

function getInitialPreferences(): Preferences {
  const existing = readCookieConsent();
  if (!existing) {
    const defaults = defaultCookieConsentCategories();
    return {
      analytics: defaults.analytics,
      personalization: defaults.personalization,
      externalServices: defaults.externalServices,
    };
  }

  return {
    analytics: existing.analytics,
    personalization: existing.personalization,
    externalServices: existing.externalServices,
  };
}

function CookieAccordionSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: AccordionSectionId;
  title: string;
  open: boolean;
  onToggle: (id: AccordionSectionId) => void;
  children: React.ReactNode;
}) {
  const contentId = `cookie-consent-section-${id}`;

  return (
    <div className="rounded-lg border border-border overflow-hidden min-w-0">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onToggle(id)}
      >
        <span className="font-medium text-foreground">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={contentId}
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-4 pt-0 text-sm text-muted-foreground leading-relaxed whitespace-normal break-words">{children}</div>
      </div>
    </div>
  );
}

export function CookieConsent() {
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(() => getInitialPreferences());
  const [multiMode, setMultiMode] = useState(false);
  const [openSections, setOpenSections] = useState<AccordionSectionId[]>([]);

  const accordionSections = useMemo(() => {
    return [
      { id: 'necessary' as const, title: t.get('cookieConsent.sections.necessary.title') },
      { id: 'analytics' as const, title: t.get('cookieConsent.sections.analytics.title') },
      { id: 'personalization' as const, title: t.get('cookieConsent.sections.personalization.title') },
      { id: 'externalServices' as const, title: t.get('cookieConsent.sections.externalServices.title') },
    ];
  }, [t]);

  const bannerTitle = t.get('cookieConsent.banner.title');
  const bannerDescription = useMemo(() => {
    return (
      <>
        {t.get('cookieConsent.banner.descriptionPrefix')}{' '}
        <Link className="text-primary underline underline-offset-4" to="/cookies">
          {t.get('policies.cookies.title')}
        </Link>{' '}
        {t.get('cookieConsent.banner.and')}{' '}
        <Link className="text-primary underline underline-offset-4" to="/privacidade">
          {t.get('policies.privacy.title')}
        </Link>
        {t.get('cookieConsent.banner.descriptionSuffix')}
      </>
    );
  }, [t]);

  const openPreferences = () => {
    setPreferences(getInitialPreferences());
    setDialogOpen(true);
  };

  const acceptAll = () => {
    writeCookieConsent({ analytics: true, personalization: true, externalServices: true });
    setShowBanner(false);
    setDialogOpen(false);
  };

  const rejectOptional = () => {
    writeCookieConsent({ analytics: false, personalization: false, externalServices: false });
    setShowBanner(false);
    setDialogOpen(false);
  };

  const savePreferences = () => {
    writeCookieConsent(preferences);
    setShowBanner(false);
    setDialogOpen(false);
  };

  useEffect(() => {
    setShowBanner(needsCookieConsentPrompt());
  }, []);

  useEffect(() => {
    const onOpen = () => openPreferences();
    window.addEventListener(COOKIE_CONSENT_OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    setMultiMode(false);
    setOpenSections([]);
  }, [dialogOpen]);

  const toggleSection = (id: AccordionSectionId) => {
    if (multiMode) {
      setMultiMode(false);
      setOpenSections([id]);
      return;
    }

    setOpenSections((prev) => (prev.includes(id) ? [] : [id]));
  };

  const allExpanded = openSections.length === accordionSections.length;
  const toggleExpandAll = () => {
    if (allExpanded) {
      setMultiMode(false);
      setOpenSections([]);
      return;
    }

    setMultiMode(true);
    setOpenSections(accordionSections.map((s) => s.id));
  };
  const bannerVisible = showBanner && !dialogOpen;

  return (
    <>
      {bannerVisible && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="cpc-container py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <p className="font-semibold text-foreground">{bannerTitle}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{bannerDescription}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="secondary" onClick={rejectOptional}>
                  {t.get('cookieConsent.banner.actions.rejectOptional')}
                </Button>
                <Button variant="outline" onClick={openPreferences}>
                  {t.get('cookieConsent.banner.actions.configure')}
                </Button>
                <Button onClick={acceptAll}>{t.get('cookieConsent.banner.actions.acceptAll')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[600px] max-h-[80vh] overflow-hidden p-0 flex flex-col">
          <div className="p-4 pb-2">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 text-left">
              <DialogTitle>{t.get('cookieConsent.dialog.title')}</DialogTitle>
              <Button variant="ghost" size="sm" onClick={toggleExpandAll}>
                {allExpanded ? t.get('cookieConsent.dialog.actions.collapseAll') : t.get('cookieConsent.dialog.actions.expandAll')}
              </Button>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-normal break-words">
                {t.get('cookieConsent.dialog.description')}
              </p>

              <div className="space-y-3">
                <CookieAccordionSection
                  id="necessary"
                  title="Cookies Estritamente Necessários"
                  open={openSections.includes('necessary')}
                  onToggle={toggleSection}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="font-medium text-foreground">{t.get('cookieConsent.sections.necessary.alwaysActiveTitle')}</p>
                      <p className="text-sm text-muted-foreground">{t.get('cookieConsent.sections.necessary.alwaysActiveStatus')}</p>
                    </div>
                    <Switch checked disabled aria-label={t.get('cookieConsent.sections.necessary.alwaysActiveAriaLabel')} />
                  </div>
                  <div className="mt-4 space-y-3">
                    <p>{t.get('cookieConsent.sections.necessary.description')}</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>{t.get('cookieConsent.sections.necessary.items.login')}</li>
                      <li>{t.get('cookieConsent.sections.necessary.items.secureNavigation')}</li>
                      <li>{t.get('cookieConsent.sections.necessary.items.restrictedAreas')}</li>
                      <li>{t.get('cookieConsent.sections.necessary.items.sessionManagement')}</li>
                      <li>{t.get('cookieConsent.sections.necessary.items.coreFeatures')}</li>
                    </ul>
                    <p>{t.get('cookieConsent.sections.necessary.footer')}</p>
                  </div>
                </CookieAccordionSection>

                <CookieAccordionSection
                  id="analytics"
                  title="Cookies de Desempenho e Estatística"
                  open={openSections.includes('analytics')}
                  onToggle={toggleSection}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="font-medium text-foreground">{t.get('cookieConsent.sections.common.controlTitle')}</p>
                      <p className="text-sm text-muted-foreground">{t.get('cookieConsent.sections.common.controlHint')}</p>
                    </div>
                    <Switch
                      checked={preferences.analytics}
                      onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, analytics: checked }))}
                      aria-label={t.get('cookieConsent.sections.analytics.ariaLabel')}
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <p>{t.get('cookieConsent.sections.analytics.description')}</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>{t.get('cookieConsent.sections.analytics.items.mostVisitedPages')}</li>
                      <li>{t.get('cookieConsent.sections.analytics.items.timeOnSite')}</li>
                      <li>{t.get('cookieConsent.sections.analytics.items.systemPerformance')}</li>
                      <li>{t.get('cookieConsent.sections.analytics.items.technicalErrors')}</li>
                    </ul>
                    <p>{t.get('cookieConsent.sections.analytics.footer')}</p>
                  </div>
                </CookieAccordionSection>

                <CookieAccordionSection
                  id="personalization"
                  title="Cookies de Personalização"
                  open={openSections.includes('personalization')}
                  onToggle={toggleSection}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="font-medium text-foreground">{t.get('cookieConsent.sections.common.controlTitle')}</p>
                      <p className="text-sm text-muted-foreground">{t.get('cookieConsent.sections.common.controlHint')}</p>
                    </div>
                    <Switch
                      checked={preferences.personalization}
                      onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, personalization: checked }))}
                      aria-label={t.get('cookieConsent.sections.personalization.ariaLabel')}
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <p>{t.get('cookieConsent.sections.personalization.description')}</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>{t.get('cookieConsent.sections.personalization.items.preferredLanguage')}</li>
                      <li>{t.get('cookieConsent.sections.personalization.items.relevantContent')}</li>
                      <li>{t.get('cookieConsent.sections.personalization.items.recommendedTracks')}</li>
                      <li>{t.get('cookieConsent.sections.personalization.items.userExperience')}</li>
                    </ul>
                  </div>
                </CookieAccordionSection>

                <CookieAccordionSection
                  id="externalServices"
                  title="Cookies de Serviços Externos"
                  open={openSections.includes('externalServices')}
                  onToggle={toggleSection}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="font-medium text-foreground">{t.get('cookieConsent.sections.common.controlTitle')}</p>
                      <p className="text-sm text-muted-foreground">{t.get('cookieConsent.sections.common.controlHint')}</p>
                    </div>
                    <Switch
                      checked={preferences.externalServices}
                      onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, externalServices: checked }))}
                      aria-label={t.get('cookieConsent.sections.externalServices.ariaLabel')}
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <p>{t.get('cookieConsent.sections.externalServices.description')}</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>{t.get('cookieConsent.sections.externalServices.items.videoPlatforms')}</li>
                      <li>{t.get('cookieConsent.sections.externalServices.items.communicationTools')}</li>
                      <li>{t.get('cookieConsent.sections.externalServices.items.analyticsTools')}</li>
                    </ul>
                    <p>{t.get('cookieConsent.sections.externalServices.footer')}</p>
                  </div>
                </CookieAccordionSection>
              </div>
            </div>
          </div>

          <div className="p-4 pt-0">
            <DialogFooter className="gap-2 sm:gap-3">
              <Button variant="secondary" onClick={rejectOptional}>
                {t.get('cookieConsent.dialog.actions.rejectOptional')}
              </Button>
              <Button variant="outline" onClick={acceptAll}>
                {t.get('cookieConsent.dialog.actions.acceptAll')}
              </Button>
              <Button onClick={savePreferences}>{t.get('cookieConsent.dialog.actions.save')}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
