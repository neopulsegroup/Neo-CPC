import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageContent } from '@/features/cms/usePageContent';
import { Target, Heart, Users, Globe } from 'lucide-react';
import pt2030PdfUrl from '../../Referencias/PT2030_FichaOperacao_A4_Algarve2030_preenchido.pdf?url';

const VALUE_CARD_KEYS = ['inclusion', 'empathy', 'cooperation', 'sustainability'] as const;

const valueIcons = {
  inclusion: Heart,
  empathy: Users,
  cooperation: Target,
  sustainability: Globe,
} as const;

export default function About() {
  const { t } = useLanguage();
  const { content } = usePageContent('about');

  return (
    <Layout>
      {/* Hero */}
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{content('about.title', 'about.title')}</h1>
          <p className="text-xl opacity-90">{content('about.subtitle', 'about.subtitle')}</p>
        </div>
      </section>

      {/* Mission */}
      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{content('about.mission', 'about.mission')}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {content('about.missionText', 'about.missionText')}
              </p>
            </div>

            <div className="cpc-card p-8 bg-accent/30 border-none">
              <p className="text-lg text-center italic text-muted-foreground">
                "{content('about.missionQuote', 'about.missionQuote')}"
              </p>
            </div>

            <div className="mt-12 space-y-6">
              <div className="space-y-3">
                <div className="w-full overflow-hidden rounded-xl border bg-background">
                  <iframe
                    src={`${pt2030PdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title="PT2030 Ficha Operacao Algarve 2030"
                    scrolling="no"
                    className="w-full border-0"
                    style={{ aspectRatio: '1 / 1.4142' }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Se o PDF nao abrir no navegador, clique em{' '}
                  <a
                    href={pt2030PdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Abrir documento
                  </a>
                  .
                </p>
              </div>
              <h2 className="text-2xl font-bold text-center">{content('about.platformTitle', 'about.platformTitle')}</h2>
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>{content('about.platformP1', 'about.platformP1')}</p>
                <p>{content('about.platformP2', 'about.platformP2')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="cpc-section bg-muted/30">
        <div className="cpc-container">
          <h2 className="text-3xl font-bold text-center mb-12">{t.about.values}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUE_CARD_KEYS.map((key) => {
              const Icon = valueIcons[key];
              return (
                <div key={key} className="cpc-card p-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold mb-2">{t.get(`about.valuesCards.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t.get(`about.valuesCards.${key}.description`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
