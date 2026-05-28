import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HelpCenter from './HelpCenter';

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      helpCenter: {
        title: 'Como podemos ajudar?',
        searchPlaceholder: 'Pesquise por temas, palavras-chave ou dúvidas...',
        frequentTopicsLabel: 'Temas frequentes:',
        frequentTopics: ['Agendamentos'],
        categories: {
          migrants: { title: 'Para Migrantes', items: ['Trilhas de Integração'] },
          companies: { title: 'Para Empresas', items: ['Gestão de Vagas'] },
          support: { title: 'Suporte Técnico', items: ['Problemas de Login'] },
          legal: { title: 'Questões Legais', items: ['Vistos e Residência'] },
        },
        noResults: 'Nenhum artigo encontrado para a sua pesquisa.',
        cta: {
          title: 'Ainda precisa de ajuda?',
          subtitle: 'Texto',
          chat: 'Contactar',
          whatsapp: 'WhatsApp Suporte',
        },
      },
      contact: {
        faqTitle: 'Perguntas Frequentes',
        faqs: [
          { q: 'O serviço é gratuito?', a: 'Sim, todos os serviços do CPC são completamente gratuitos.' },
          { q: 'Preciso de documentos para me registar?', a: 'Não é necessário apresentar documentos.' },
        ],
      },
    },
  }),
}));

describe('HelpCenter - FAQ acordeão', () => {
  it('expande e recolhe uma pergunta individualmente', () => {
    render(
      <MemoryRouter>
        <HelpCenter />
      </MemoryRouter>
    );

    expect(screen.getByText('Perguntas Frequentes')).toBeInTheDocument();

    const question = 'O serviço é gratuito?';
    const answer = 'Sim, todos os serviços do CPC são completamente gratuitos.';

    const trigger = screen.getByRole('button', { name: question });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(answer)).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
