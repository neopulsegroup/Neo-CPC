export type PageId = 'home' | 'about' | 'how-it-works' | 'contact';
export type FieldType = 'text' | 'textarea';

export interface FieldDefinition {
  key: string;
  label: string;
  description?: string;
  type: FieldType;
  maxLength?: number;
  section: string;
}

export interface PageSchema {
  id: PageId;
  title: string;
  route: string;
  fields: FieldDefinition[];
}

export const PAGE_SCHEMAS: PageSchema[] = [
  {
    id: 'home',
    title: 'Página Inicial',
    route: '/',
    fields: [
      { key: 'hero.title', label: 'Título principal', type: 'text', section: 'Hero', maxLength: 80 },
      { key: 'hero.titleHighlight', label: 'Texto em destaque', type: 'text', section: 'Hero', maxLength: 50 },
      { key: 'hero.subtitle', label: 'Subtítulo', type: 'textarea', section: 'Hero', maxLength: 200 },
      { key: 'hero.iAm', label: 'Texto do primeiro botão', type: 'text', section: 'Hero', maxLength: 40 },
      { key: 'hero.migrant', label: 'Botão Sou Migrante', type: 'text', section: 'Hero', maxLength: 40 },
      { key: 'hero.company', label: 'Botão Sou Empresa', type: 'text', section: 'Hero', maxLength: 40 },
      { key: 'process.badge', label: 'Etiqueta do processo', type: 'text', section: 'Processo', maxLength: 50 },
      { key: 'process.title', label: 'Título do processo', type: 'text', section: 'Processo', maxLength: 80 },
      { key: 'process.subtitle', label: 'Subtítulo do processo', type: 'textarea', section: 'Processo', maxLength: 220 },
      { key: 'process.step1.title', label: 'Passo 1 - título', type: 'text', section: 'Processo', maxLength: 60 },
      { key: 'process.step1.description', label: 'Passo 1 - descrição', type: 'textarea', section: 'Processo', maxLength: 180 },
      { key: 'process.step2.title', label: 'Passo 2 - título', type: 'text', section: 'Processo', maxLength: 60 },
      { key: 'process.step2.description', label: 'Passo 2 - descrição', type: 'textarea', section: 'Processo', maxLength: 180 },
      { key: 'process.step3.title', label: 'Passo 3 - título', type: 'text', section: 'Processo', maxLength: 60 },
      { key: 'process.step3.description', label: 'Passo 3 - descrição', type: 'textarea', section: 'Processo', maxLength: 180 },
      { key: 'features.title', label: 'Título da secção de características', type: 'text', section: 'Características', maxLength: 80 },
      { key: 'features.description', label: 'Descrição das características', type: 'textarea', section: 'Características', maxLength: 220 },
      { key: 'features.item1', label: 'Item 1 das características', type: 'text', section: 'Características', maxLength: 120 },
      { key: 'features.item2', label: 'Item 2 das características', type: 'text', section: 'Características', maxLength: 120 },
      { key: 'features.item3', label: 'Item 3 das características', type: 'text', section: 'Características', maxLength: 120 },
      { key: 'features.cta', label: 'Texto do CTA secundário', type: 'text', section: 'Características', maxLength: 80 },
      { key: 'cta.title', label: 'Título da chamada à ação', type: 'text', section: 'Chamada', maxLength: 80 },
      { key: 'cta.subtitle', label: 'Subtítulo da chamada à ação', type: 'textarea', section: 'Chamada', maxLength: 180 },
      { key: 'cta.register', label: 'Texto do botão Registar', type: 'text', section: 'Chamada', maxLength: 40 },
      { key: 'cta.contact', label: 'Texto do botão Contactar', type: 'text', section: 'Chamada', maxLength: 40 },
    ],
  },
  {
    id: 'about',
    title: 'Sobre',
    route: '/sobre',
    fields: [
      { key: 'about.title', label: 'Título da página', type: 'text', section: 'Sobre', maxLength: 80 },
      { key: 'about.subtitle', label: 'Subtítulo da página', type: 'textarea', section: 'Sobre', maxLength: 180 },
      { key: 'about.mission', label: 'Título da missão', type: 'text', section: 'Missão', maxLength: 80 },
      { key: 'about.missionText', label: 'Texto da missão', type: 'textarea', section: 'Missão', maxLength: 260 },
      { key: 'about.missionQuote', label: 'Citação da missão', type: 'textarea', section: 'Missão', maxLength: 220 },
      { key: 'about.platformTitle', label: 'Título da plataforma', type: 'text', section: 'Plataforma', maxLength: 80 },
      { key: 'about.platformP1', label: 'Parágrafo 1 da plataforma', type: 'textarea', section: 'Plataforma', maxLength: 260 },
      { key: 'about.platformP2', label: 'Parágrafo 2 da plataforma', type: 'textarea', section: 'Plataforma', maxLength: 260 },
      { key: 'about.values', label: 'Título dos valores', type: 'text', section: 'Valores', maxLength: 80 },
      { key: 'about.valuesCards.inclusion.title', label: 'Valor Inclusão - título', type: 'text', section: 'Valores', maxLength: 60 },
      { key: 'about.valuesCards.inclusion.description', label: 'Valor Inclusão - descrição', type: 'textarea', section: 'Valores', maxLength: 140 },
      { key: 'about.valuesCards.empathy.title', label: 'Valor Empatia - título', type: 'text', section: 'Valores', maxLength: 60 },
      { key: 'about.valuesCards.empathy.description', label: 'Valor Empatia - descrição', type: 'textarea', section: 'Valores', maxLength: 140 },
      { key: 'about.valuesCards.cooperation.title', label: 'Valor Cooperação - título', type: 'text', section: 'Valores', maxLength: 60 },
      { key: 'about.valuesCards.cooperation.description', label: 'Valor Cooperação - descrição', type: 'textarea', section: 'Valores', maxLength: 140 },
      { key: 'about.valuesCards.sustainability.title', label: 'Valor Sustentabilidade - título', type: 'text', section: 'Valores', maxLength: 60 },
      { key: 'about.valuesCards.sustainability.description', label: 'Valor Sustentabilidade - descrição', type: 'textarea', section: 'Valores', maxLength: 140 },
    ],
  },
  {
    id: 'how-it-works',
    title: 'Como Funciona',
    route: '/como-funciona',
    fields: [
      { key: 'howItWorks.title', label: 'Título da página', type: 'text', section: 'Como Funciona', maxLength: 80 },
      { key: 'howItWorks.subtitle', label: 'Subtítulo da página', type: 'textarea', section: 'Como Funciona', maxLength: 180 },
      { key: 'howItWorks.migrantHeading', label: 'Título seção migrante', type: 'text', section: 'Migrante', maxLength: 80 },
      { key: 'howItWorks.migrantSteps.step1.title', label: 'Passo 1 - título', type: 'text', section: 'Migrante', maxLength: 60 },
      { key: 'howItWorks.migrantSteps.step1.description', label: 'Passo 1 - descrição', type: 'textarea', section: 'Migrante', maxLength: 180 },
      { key: 'howItWorks.migrantSteps.step2.title', label: 'Passo 2 - título', type: 'text', section: 'Migrante', maxLength: 60 },
      { key: 'howItWorks.migrantSteps.step2.description', label: 'Passo 2 - descrição', type: 'textarea', section: 'Migrante', maxLength: 180 },
      { key: 'howItWorks.migrantSteps.step3.title', label: 'Passo 3 - título', type: 'text', section: 'Migrante', maxLength: 60 },
      { key: 'howItWorks.migrantSteps.step3.description', label: 'Passo 3 - descrição', type: 'textarea', section: 'Migrante', maxLength: 180 },
      { key: 'howItWorks.migrantSteps.step4.title', label: 'Passo 4 - título', type: 'text', section: 'Migrante', maxLength: 60 },
      { key: 'howItWorks.migrantSteps.step4.description', label: 'Passo 4 - descrição', type: 'textarea', section: 'Migrante', maxLength: 180 },
      { key: 'howItWorks.companyHeading', label: 'Título seção empresa', type: 'text', section: 'Empresa', maxLength: 80 },
      { key: 'howItWorks.companyLead', label: 'Texto introdutório empresa', type: 'textarea', section: 'Empresa', maxLength: 220 },
      { key: 'howItWorks.companyBullet1', label: 'Empresa - bullet 1', type: 'text', section: 'Empresa', maxLength: 120 },
      { key: 'howItWorks.companyBullet2', label: 'Empresa - bullet 2', type: 'text', section: 'Empresa', maxLength: 120 },
      { key: 'howItWorks.companyMatch', label: 'Texto de match empresa', type: 'textarea', section: 'Empresa', maxLength: 220 },
      { key: 'howItWorks.ctaTitle', label: 'Título do CTA', type: 'text', section: 'Chamada', maxLength: 80 },
      { key: 'howItWorks.ctaSubtitle', label: 'Subtítulo do CTA', type: 'textarea', section: 'Chamada', maxLength: 180 },
    ],
  },
  {
    id: 'contact',
    title: 'Contactos',
    route: '/contacto',
    fields: [
      { key: 'contact.title', label: 'Título da página', type: 'text', section: 'Contactos', maxLength: 80 },
      { key: 'contact.subtitle', label: 'Subtítulo da página', type: 'textarea', section: 'Contactos', maxLength: 180 },
      { key: 'contact.info.email', label: 'Etiqueta de e-mail', type: 'text', section: 'Informações de contacto', maxLength: 80 },
      { key: 'contact.info.emailValue', label: 'E-mail de contacto', type: 'text', section: 'Informações de contacto', maxLength: 80 },
      { key: 'contact.info.phone', label: 'Etiqueta de telefone', type: 'text', section: 'Informações de contacto', maxLength: 80 },
      { key: 'contact.info.hours', label: 'Etiqueta de horário', type: 'text', section: 'Informações de contacto', maxLength: 80 },
      { key: 'contact.info.hoursValue', label: 'Texto do horário', type: 'text', section: 'Informações de contacto', maxLength: 80 },
      { key: 'contact.form.name', label: 'Campo nome', type: 'text', section: 'Formulário', maxLength: 60 },
      { key: 'contact.form.email', label: 'Campo e-mail', type: 'text', section: 'Formulário', maxLength: 60 },
      { key: 'contact.form.message', label: 'Campo mensagem', type: 'text', section: 'Formulário', maxLength: 60 },
      { key: 'contact.form.submit', label: 'Botão enviar', type: 'text', section: 'Formulário', maxLength: 40 },
      { key: 'contact.form.success', label: 'Mensagem de sucesso', type: 'textarea', section: 'Formulário', maxLength: 140 },
      { key: 'contact.form.sent', label: 'Título depois de enviar', type: 'text', section: 'Formulário', maxLength: 80 },
      { key: 'contact.form.sentSubtitle', label: 'Subtítulo depois de enviar', type: 'textarea', section: 'Formulário', maxLength: 160 },
      { key: 'contact.form.sendAnother', label: 'Botão enviar outra', type: 'text', section: 'Formulário', maxLength: 80 },
      { key: 'contact.form.placeholderName', label: 'Placeholder nome', type: 'text', section: 'Formulário', maxLength: 80 },
      { key: 'contact.form.placeholderEmail', label: 'Placeholder e-mail', type: 'text', section: 'Formulário', maxLength: 80 },
      { key: 'contact.form.placeholderMessage', label: 'Placeholder mensagem', type: 'text', section: 'Formulário', maxLength: 120 },
      { key: 'contact.faqTitle', label: 'Título das FAQs', type: 'text', section: 'FAQ', maxLength: 80 },
      { key: 'contact.faqs.0.q', label: 'FAQ 1 - pergunta', type: 'text', section: 'FAQ', maxLength: 120 },
      { key: 'contact.faqs.0.a', label: 'FAQ 1 - resposta', type: 'textarea', section: 'FAQ', maxLength: 220 },
      { key: 'contact.faqs.1.q', label: 'FAQ 2 - pergunta', type: 'text', section: 'FAQ', maxLength: 120 },
      { key: 'contact.faqs.1.a', label: 'FAQ 2 - resposta', type: 'textarea', section: 'FAQ', maxLength: 220 },
      { key: 'contact.faqs.2.q', label: 'FAQ 3 - pergunta', type: 'text', section: 'FAQ', maxLength: 120 },
      { key: 'contact.faqs.2.a', label: 'FAQ 3 - resposta', type: 'textarea', section: 'FAQ', maxLength: 220 },
    ],
  },
];
