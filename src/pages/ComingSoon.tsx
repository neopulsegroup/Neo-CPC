import { Link, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronRight } from 'lucide-react';

function getFeatureKey(raw: string | null): 'findTalent' | 'findWork' | 'training' | 'terms' | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'find_talent' || v === 'talento' || v === 'talent') return 'findTalent';
  if (v === 'find_work' || v === 'trabalho' || v === 'work') return 'findWork';
  if (v === 'training' || v === 'formacao' || v === 'formação' || v === 'catalogo' || v === 'catálogo') return 'training';
  if (v === 'terms' || v === 'termos') return 'terms';
  return null;
}

export default function ComingSoon() {
  const { t } = useLanguage();
  const location = useLocation();
  const feature = new URLSearchParams(location.search).get('feature');
  const featureKey = getFeatureKey(feature);
  const featureLabel = featureKey ? t.comingSoon.features[featureKey] : null;

  return (
    <Layout>
      <section className="cpc-section">
        <div className="cpc-container">
          <div className="max-w-2xl mx-auto">
            <div className="cpc-card p-10 overflow-hidden relative">
              <div className="relative z-10 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Clock className="h-7 w-7" />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mt-6">{t.comingSoon.title}</h1>
                <p className="text-muted-foreground mt-3">{t.comingSoon.subtitle}</p>

                {featureLabel ? (
                  <div className="mt-6">
                    <Badge variant="secondary" className="text-sm">
                      {featureLabel}
                    </Badge>
                  </div>
                ) : null}

                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <Button asChild>
                    <Link to="/">
                      {t.comingSoon.actions.backHome}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/contacto">{t.comingSoon.actions.contact}</Link>
                  </Button>
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
