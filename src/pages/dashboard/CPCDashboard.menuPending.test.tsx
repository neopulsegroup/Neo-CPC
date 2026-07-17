import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ptJson from '@/locales/pt.json';
import CPCDashboard from './CPCDashboard';

const mockSubscribeQuery = vi.fn();

let authState: { profile: { name?: string; role?: string; email?: string }; user?: { uid?: string } } = {
  profile: { name: 'Ana', role: 'admin', email: 'ana@teste.com' },
  user: { uid: 'u-admin' },
};

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/LanguageContext', () => {
  function tGet(path: string, params?: Record<string, string | number>): string {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ptJson);
    const template = typeof value === 'string' ? value : path;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
  }
  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: { get: tGet },
    }),
  };
});

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: vi.fn().mockResolvedValue([]),
  countDocuments: vi.fn().mockResolvedValue(0),
  getDocument: vi.fn().mockResolvedValue(null),
  updateDocument: vi.fn(),
  addDocument: vi.fn(),
  deleteDocument: vi.fn(),
  setDocument: vi.fn(),
  serverTimestamp: vi.fn(),
  subscribeQuery: (...args: unknown[]) => mockSubscribeQuery(...args),
  subscribeDocument: () => () => {},
}));

describe('CPCDashboard - badges de pendentes no menu', () => {
  beforeEach(() => {
    authState = {
      profile: { name: 'Ana', role: 'admin', email: 'ana@teste.com' },
      user: { uid: 'u-admin' },
    };
    mockSubscribeQuery.mockReset().mockImplementation((args: unknown) => {
      const a = args as {
        collectionName: string;
        filters?: Array<{ field: string; value: unknown }>;
        onNext: (docs: unknown[]) => void;
      };
      if (a.collectionName === 'support_requests') {
        a.onNext([{ id: 'sr1' }, { id: 'sr2' }]);
      } else if (a.collectionName === 'sessions') {
        a.onNext([{ id: 's1' }]);
      } else if (a.collectionName === 'companies') {
        a.onNext([{ id: 'c1' }, { id: 'c2', verified: true }, { id: 'c3', rejected: true }]);
      } else if (a.collectionName === 'job_offers') {
        a.onNext([{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }, { id: 'j4' }]);
      } else {
        a.onNext([]);
      }
      return () => {};
    });
  });

  it('mostra badges à direita em Agenda, Empresas e Ofertas quando há pendentes', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/cpc']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation');

    await waitFor(() => {
      expect(nav.querySelector('a[href="/dashboard/cpc/agenda"]')?.textContent).toContain('3');
    });

    const agenda = nav.querySelector('a[href="/dashboard/cpc/agenda"]');
    const empresas = nav.querySelector('a[href="/dashboard/cpc/empresas"]');
    const ofertas = nav.querySelector('a[href="/dashboard/cpc/ofertas"]');

    expect(agenda?.querySelector('span.ml-auto')?.textContent).toBe('3');
    expect(empresas?.querySelector('span.ml-auto')?.textContent).toBe('1');
    expect(ofertas?.querySelector('span.ml-auto')?.textContent).toBe('4');

    // Cadeado-like alignment: badge is the last child with ml-auto
    expect(agenda?.lastElementChild?.className).toContain('ml-auto');
  });
});
