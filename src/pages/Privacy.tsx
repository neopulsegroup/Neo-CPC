import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Privacy() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.policies.privacy.title}</h1>
          <p className="text-xl opacity-90">{t.policies.common.platform}</p>
        </div>
      </section>

      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-4xl mx-auto cpc-card p-8">
            <p className="text-sm text-muted-foreground mb-8">{t.get('policies.common.lastUpdated', { date: updatedAt })}</p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.intro.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.intro.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.intro.p2}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.privacy.sections.intro.p3}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.intro.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.intro.p4}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.controller.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.privacy.sections.controller.p1}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              <li>{t.policies.common.contacts.companyLine}</li>
              <li>{t.policies.common.contacts.addressLine}</li>
              <li>
                <a className="text-primary underline underline-offset-4" href={`mailto:${t.policies.common.contacts.email}`}>
                  {t.policies.common.contacts.email}
                </a>
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-2">{t.policies.privacy.sections.controller.dpoTitle}</p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.controller.dpoEmailPrefix}{' '}
              <a className="text-primary underline underline-offset-4" href={`mailto:${t.policies.common.contacts.email}`}>
                {t.policies.common.contacts.email}
              </a>
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.purposes.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.p1}
            </p>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.accountManagementTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.accountManagementList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.screeningTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.screeningList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.trainingTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.trainingList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.schedulingTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.schedulingList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.jobInsertionTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.jobInsertionList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.communicationTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.purposes.communicationList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.purposes.improvementTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.purposes.improvementList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.dataCategories.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataCategories.p1}
            </p>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.dataCategories.identificationTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataCategories.identificationList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.dataCategories.profileIntegrationTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataCategories.profileIntegrationList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.dataCategories.screeningTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataCategories.screeningList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.dataCategories.platformUsageTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataCategories.platformUsageList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mb-3">{t.policies.privacy.sections.dataCategories.technicalTitle}</h3>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataCategories.technicalList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.dataCategories.p2}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.legalBasis.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.legalBasis.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.legalBasis.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.sharing.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.sharing.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              <li>
                <span className="font-medium text-foreground">{t.policies.privacy.sections.sharing.items.team.label}</span> —{' '}
                {t.policies.privacy.sections.sharing.items.team.desc}
              </li>
              <li>
                <span className="font-medium text-foreground">{t.policies.privacy.sections.sharing.items.employers.label}</span> —{' '}
                {t.policies.privacy.sections.sharing.items.employers.desc}
              </li>
              <li>
                <span className="font-medium text-foreground">{t.policies.privacy.sections.sharing.items.providers.label}</span> —{' '}
                {t.policies.privacy.sections.sharing.items.providers.desc}
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.sharing.p2}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.internationalTransfers.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.internationalTransfers.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.internationalTransfers.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.retention.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.retention.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.retention.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.security.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.security.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.security.list1.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.privacy.sections.security.p2}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.security.list2.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.dataSubjectRights.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t.policies.privacy.sections.dataSubjectRights.p1}</p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.dataSubjectRights.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.dataSubjectRights.p2}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.complaints.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.complaints.p1}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.complaints.authority}{' '}
              <a className="text-primary underline underline-offset-4" href="https://www.cnpd.pt" target="_blank" rel="noreferrer">
                https://www.cnpd.pt
              </a>
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.changes.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t.policies.privacy.sections.changes.p1}
            </p>

            <h2 className="text-2xl font-bold mb-4">{t.policies.privacy.sections.contacts.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t.policies.privacy.sections.contacts.p1}
            </p>
            <ul className="list-disc pl-6 text-muted-foreground leading-relaxed">
              <li>{t.policies.common.contacts.companyLine}</li>
              <li>{t.policies.common.contacts.addressLine}</li>
              <li>
                <a className="text-primary underline underline-offset-4" href={`mailto:${t.policies.common.contacts.email}`}>
                  {t.policies.common.contacts.email}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </Layout>
  );
}
