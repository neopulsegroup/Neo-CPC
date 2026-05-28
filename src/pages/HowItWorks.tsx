import type { LucideIcon } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageContent } from '@/features/cms/usePageContent';
import { ClipboardList, UserCircle, Calendar, GraduationCap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const MIGRANT_STEPS: { key: 'step1' | 'step2' | 'step3' | 'step4'; icon: LucideIcon; color: string; number: string }[] = [
  { key: 'step1', icon: ClipboardList, color: 'bg-blue-500', number: '01' },
  { key: 'step2', icon: UserCircle, color: 'bg-green-500', number: '02' },
  { key: 'step3', icon: Calendar, color: 'bg-purple-500', number: '03' },
  { key: 'step4', icon: GraduationCap, color: 'bg-teal-500', number: '04' },
];

export default function HowItWorks() {
  const { t } = useLanguage();
  const { content } = usePageContent('how-it-works');

  return (
    <Layout>
      {/* Hero */}
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{content('howItWorks.title', 'howItWorks.title')}</h1>
          <p className="text-xl opacity-90">{content('howItWorks.subtitle', 'howItWorks.subtitle')}</p>
        </div>
      </section>

      {/* Migrante */}
      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 md:mb-12">
              {content('howItWorks.migrantHeading', 'howItWorks.migrantHeading')}
            </h2>
            {MIGRANT_STEPS.map((step, index) => (
              <div key={step.key} className="relative">
                {index < MIGRANT_STEPS.length - 1 && (
                  <div className="absolute left-8 top-24 bottom-0 w-0.5 bg-border hidden md:block" />
                )}

                <div className="flex flex-col md:flex-row gap-6 mb-12">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-16 h-16 rounded-2xl ${step.color} text-white flex items-center justify-center font-bold text-xl shadow-lg`}
                    >
                      {step.number}
                    </div>
                  </div>

                  <div className="flex-1 cpc-card p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <step.icon className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-bold">{content(`howItWorks.migrantSteps.${step.key}.title`, `howItWorks.migrantSteps.${step.key}.title`)}</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {content(`howItWorks.migrantSteps.${step.key}.description`, `howItWorks.migrantSteps.${step.key}.description`)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Empresa */}
      <section className="cpc-section bg-muted/30">
        <div className="cpc-container">
          <div className="max-w-3xl mx-auto cpc-card p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">{content('howItWorks.companyHeading', 'howItWorks.companyHeading')}</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">{content('howItWorks.companyLead', 'howItWorks.companyLead')}</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground mb-6 leading-relaxed">
              <li>{content('howItWorks.companyBullet1', 'howItWorks.companyBullet1')}</li>
              <li>{content('howItWorks.companyBullet2', 'howItWorks.companyBullet2')}</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">{content('howItWorks.companyMatch', 'howItWorks.companyMatch')}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cpc-section">
        <div className="cpc-container text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{content('howItWorks.ctaTitle', 'howItWorks.ctaTitle')}</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{content('howItWorks.ctaSubtitle', 'howItWorks.ctaSubtitle')}</p>
          <Button size="lg" asChild>
            <Link to="/registar">
              {t.nav.register}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
