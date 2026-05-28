import { Link } from 'react-router-dom';
import {
  ArrowRight,
  GraduationCap,
  Users,
  Rocket,
  CheckCircle2,
  User,
  Building2
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageContent } from '@/features/cms/usePageContent';

export default function Index() {
  const { t } = useLanguage();
  const { content } = usePageContent('home');

  const processSteps = [
    {
      icon: GraduationCap,
      title: content('process.step1.title', 'process.step1.title'),
      description: content('process.step1.description', 'process.step1.description'),
      color: 'bg-blue-100 text-primary',
    },
    {
      icon: Users,
      title: content('process.step2.title', 'process.step2.title'),
      description: content('process.step2.description', 'process.step2.description'),
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: Rocket,
      title: content('process.step3.title', 'process.step3.title'),
      description: content('process.step3.description', 'process.step3.description'),
      color: 'bg-teal-100 text-teal-600',
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 to-white pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="cpc-container text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 max-w-4xl mx-auto">
            {content('hero.title', 'hero.title')}<br />
            <span className="text-primary">{content('hero.titleHighlight', 'hero.titleHighlight')}</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            {content('hero.subtitle', 'hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-2xl mx-auto">
            {/* Migrant Card/Button */}
            <Link to="/registar?role=migrant" className="group flex-1">
              <div className="bg-primary hover:bg-primary/90 text-white rounded-xl p-6 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl flex items-center justify-center gap-4 h-full border-2 border-primary">
                <User className="w-8 h-8" />
                <div className="text-left">
                  <span className="block text-sm opacity-90 font-medium">{content('hero.iAm', 'hero.iAm')}</span>
                  <span className="block text-xl font-bold">{content('hero.migrant', 'hero.migrant')}</span>
                </div>
              </div>
            </Link>

            {/* Company Card/Button */}
            <Link to="/registar?role=company" className="group flex-1">
              <div className="bg-white hover:bg-blue-50 text-slate-800 rounded-xl p-6 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl flex items-center justify-center gap-4 h-full border-2 border-slate-100 group-hover:border-primary/20">
                <Building2 className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <span className="block text-sm text-slate-500 font-medium">{content('hero.iAm', 'hero.iAm')}</span>
                  <span className="block text-xl font-bold text-primary">{content('hero.company', 'hero.company')}</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Background decorative blob */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-100/50 rounded-full blur-3xl -z-10 opacity-60 pointer-events-none" />
      </section>

      {/* Process Section */}
      <section className="py-24 bg-white">
        <div className="cpc-container">
          <div className="text-center mb-16">
            <span className="text-primary font-bold text-sm tracking-widest uppercase mb-3 block">{content('process.badge', 'process.badge')}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{content('process.title', 'process.title')}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              {content('process.subtitle', 'process.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {processSteps.map((step, index) => (
              <div
                key={step.title}
                className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300"
              >
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-24 bg-slate-50">
        <div className="cpc-container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image Side */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] group">
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2671&auto=format&fit=crop"
                alt="Diverse team working together"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
            </div>

            {/* Content Side */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                {content('features.title', 'features.title')}
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                {content('features.description', 'features.description')}
              </p>

              <ul className="space-y-4 mb-10">
                {[
                  content('features.item1', 'features.item1'),
                  content('features.item2', 'features.item2'),
                  content('features.item3', 'features.item3')
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/sobre"
                className="group inline-flex items-center font-bold text-primary hover:text-blue-700 transition-colors"
              >
                {content('features.cta', 'features.cta')}
                <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-20 text-white">
        <div className="cpc-container">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="max-w-xl text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{content('cta.title', 'cta.title')}</h2>
              <h3 className="text-2xl md:text-3xl font-bold text-blue-200 mb-2">{content('cta.subtitle', 'cta.subtitle')}</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="xl" className="bg-white text-primary hover:bg-blue-50 font-bold px-8" asChild>
                <Link to="/registar">{t.cta.register}</Link>
              </Button>
              <Button size="xl" variant="outline" className="border-2 border-white text-white hover:bg-white/10 hover:text-white font-bold px-8" asChild>
                <Link to="/contacto">{t.cta.contact}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
