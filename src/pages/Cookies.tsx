import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Cookies() {
  const { language, t } = useLanguage();
  const dateLocale = language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-GB';
  const updatedAt = new Intl.DateTimeFormat(dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return (
    <Layout>
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.policies.cookies.title}</h1>
          <p className="text-xl opacity-90">{t.policies.common.platform}</p>
        </div>
      </section>

      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-4xl mx-auto cpc-card p-8">
            <p className="text-sm text-muted-foreground mb-8">{t.get('policies.common.lastUpdated', { date: updatedAt })}</p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.intro.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.intro.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.cookies.sections.intro.p2}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.intro.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.intro.p3}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.what.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.what.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.what.p2}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.cookies.sections.what.p3}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.what.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.types.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {t.policies.cookies.sections.types.p1}
            </p>

            <h3 className="text-xl font-semibold mb-3">{t.policies.cookies.sections.types.necessary.title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.necessary.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.necessary.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.necessary.p2}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.types.necessary.baseLegal}
            </p>

            <h3 className="text-xl font-semibold mb-3">{t.policies.cookies.sections.types.analytics.title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.analytics.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.analytics.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.analytics.p2}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.types.analytics.baseLegal}
            </p>

            <h3 className="text-xl font-semibold mb-3">{t.policies.cookies.sections.types.personalization.title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.personalization.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.personalization.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.types.personalization.baseLegal}
            </p>

            <h3 className="text-xl font-semibold mb-3">{t.policies.cookies.sections.types.thirdParty.title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.thirdParty.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.thirdParty.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.types.thirdParty.p2}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.types.thirdParty.baseLegal}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.duration.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.duration.p1}
            </p>
            <h3 className="text-lg font-semibold mb-2">{t.policies.cookies.sections.duration.sessionTitle}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.duration.sessionBody}
            </p>
            <h3 className="text-lg font-semibold mb-2">{t.policies.cookies.sections.duration.persistentTitle}</h3>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.duration.persistentBody}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.consent.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.consent.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.consent.p2}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.consent.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.consent.p3}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.manage.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.manage.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.manage.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.manage.p2}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.manage.p3Prefix}{' '}
              <a className="text-primary underline underline-offset-4" href="https://www.allaboutcookies.org" target="_blank" rel="noreferrer">
                https://www.allaboutcookies.org
              </a>
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.dataProtection.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.dataProtection.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.dataProtection.p2}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.rights.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.cookies.sections.rights.p1}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.rights.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.rights.p2}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.changes.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.cookies.sections.changes.p1}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.cookies.sections.contacts.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.cookies.sections.contacts.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed">
              <li>{t.policies.common.contacts.companyLine}</li>
              <li>
                <a className="text-primary underline underline-offset-4" href={`mailto:${t.policies.common.contacts.email}`}>
                  {t.policies.common.contacts.email}
                </a>
              </li>
              <li>{t.policies.common.contacts.addressLine}</li>
            </ul>
          </div>
        </div>
      </section>
    </Layout>
  );
}
