import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building2, MapPin, Search, Settings, Scale, MessageSquareText } from 'lucide-react';

type HelpCategory = {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  borderClassName: string;
  items: string[];
};

export default function HelpCenter() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  const categories: HelpCategory[] = useMemo(
    () => [
      {
        key: 'migrants',
        title: t.helpCenter.categories.migrants.title,
        icon: MapPin,
        iconClassName: 'bg-blue-100 text-blue-700',
        borderClassName: 'border-blue-500',
        items: t.helpCenter.categories.migrants.items,
      },
      {
        key: 'companies',
        title: t.helpCenter.categories.companies.title,
        icon: Building2,
        iconClassName: 'bg-purple-100 text-purple-700',
        borderClassName: 'border-purple-500',
        items: t.helpCenter.categories.companies.items,
      },
      {
        key: 'support',
        title: t.helpCenter.categories.support.title,
        icon: Settings,
        iconClassName: 'bg-slate-100 text-slate-700',
        borderClassName: 'border-slate-500',
        items: t.helpCenter.categories.support.items,
      },
      {
        key: 'legal',
        title: t.helpCenter.categories.legal.title,
        icon: Scale,
        iconClassName: 'bg-red-100 text-red-700',
        borderClassName: 'border-red-500',
        items: t.helpCenter.categories.legal.items,
      },
    ],
    [t]
  );

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return t.contact.faqs;
    return t.contact.faqs.filter(
      (faq) => faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q)
    );
  }, [query, t]);

  return (
    <Layout>
      <section className="cpc-gradient-bg text-primary-foreground py-20">
        <div className="cpc-container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">{t.helpCenter.title}</h1>

            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.helpCenter.searchPlaceholder}
                className="pl-11 bg-white text-foreground border-white/20"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="opacity-90">{t.helpCenter.frequentTopicsLabel}</span>
              {t.helpCenter.frequentTopics.map((topic) => (
                <Badge key={topic} variant="secondary" className="bg-white/20 text-white border-white/20">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="cpc-section -mt-10">
        <div className="cpc-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <div key={cat.key} className={`cpc-card p-6 border-b-4 ${cat.borderClassName}`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cat.iconClassName}`}>
                  <cat.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mt-4">{cat.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {cat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                      <span className="leading-5">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cpc-section bg-muted/30">
        <div className="cpc-container">
          <h2 className="text-2xl font-bold text-center mb-8">{t.contact.faqTitle}</h2>
          <div className="max-w-2xl mx-auto">
            {filteredFaqs.length === 0 ? (
              <div className="cpc-card p-6 text-sm text-muted-foreground">{t.helpCenter.noResults}</div>
            ) : (
              <Accordion type="single" collapsible className="space-y-4">
                {filteredFaqs.map((faq) => (
                  <AccordionItem key={faq.q} value={faq.q} className="cpc-card border-0">
                    <AccordionTrigger className="px-6 py-5 text-left hover:no-underline">
                      <span className="font-semibold">{faq.q}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 text-muted-foreground text-sm">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </div>
      </section>

      <section className="cpc-section">
        <div className="cpc-container">
          <div className="cpc-card p-10 bg-slate-950 text-white overflow-hidden relative">
            <div className="relative z-10 max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold">{t.helpCenter.cta.title}</h2>
              <p className="text-white/70 mt-3 text-sm md:text-base">{t.helpCenter.cta.subtitle}</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="gap-2">
                  <Link to="/contacto">
                    <MessageSquareText className="h-4 w-4" />
                    {t.helpCenter.cta.chat}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
          </div>
        </div>
      </section>
    </Layout>
  );
}
