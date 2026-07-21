import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageContent } from '@/features/cms/usePageContent';
import { formatAppDate } from '@/lib/appDateTime';
import type { PageId } from '@/features/cms/pageSchemas';

type LegalPolicyPageId = Extract<PageId, 'terms' | 'privacy' | 'cookies'>;

const POLICY_KEY_BY_PAGE: Record<LegalPolicyPageId, 'terms' | 'privacy' | 'cookies'> = {
  terms: 'terms',
  privacy: 'privacy',
  cookies: 'cookies',
};

function paragraphsFromBody(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function LegalPolicyPage({ pageId }: { pageId: LegalPolicyPageId }) {
  const { language, t } = useLanguage();
  const { content } = usePageContent(pageId);
  const policyKey = POLICY_KEY_BY_PAGE[pageId];
  const updatedAt = formatAppDate(new Date(), {
    locale: language,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const title = content(`policies.${policyKey}.title`, `policies.${policyKey}.title`);
  const platform = content('policies.common.platform', 'policies.common.platform');
  const body = content(`policies.${policyKey}.body`, `policies.${policyKey}.body`);
  const paragraphs = paragraphsFromBody(body);

  return (
    <Layout>
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-xl opacity-90">{platform}</p>
        </div>
      </section>

      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-4xl mx-auto cpc-card p-8">
            <p className="text-sm text-muted-foreground mb-8">
              {t.get('policies.common.lastUpdated', { date: updatedAt })}
            </p>

            <div className="space-y-4">
              {paragraphs.map((paragraph, index) => (
                <p key={`${policyKey}-${index}`} className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
