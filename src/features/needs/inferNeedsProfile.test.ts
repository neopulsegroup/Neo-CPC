import { describe, it, expect } from 'vitest';
import { inferNeedsProfile } from './inferNeedsProfile';
import type { TriageResponses } from '@/types/triage';

describe('inferNeedsProfile', () => {
  it('triagem null devolve perfil vazio', () => {
    const r = inferNeedsProfile(null);
    expect(r.items).toEqual([]);
    expect(r.hasUrgentNeeds).toBe(false);
    expect(typeof r.generatedAt).toBe('string');
  });

  it('legal_status not_regularized gera item legal high', () => {
    const r = inferNeedsProfile({ legal_status: 'not_regularized' });
    const legal = r.items.find((i) => i.category === 'legal');
    expect(legal?.priority).toBe('high');
    expect(legal?.reasons).toContain('needs.reason.legal.unregularized');
    expect(r.hasUrgentNeeds).toBe(true);
  });

  it('legal_status pending gera item legal medium', () => {
    const r = inferNeedsProfile({ legal_status: 'pending' });
    const legal = r.items.find((i) => i.category === 'legal');
    expect(legal?.priority).toBe('medium');
    expect(r.hasUrgentNeeds).toBe(false);
  });

  it('housing_status homeless gera item housing high', () => {
    const r = inferNeedsProfile({ housing_status: 'homeless' });
    expect(r.items.find((i) => i.category === 'housing')?.priority).toBe('high');
  });

  it('housing_status precarious gera item housing medium', () => {
    const r = inferNeedsProfile({ housing_status: 'precarious' });
    expect(r.items.find((i) => i.category === 'housing')?.priority).toBe('medium');
  });

  it('work_status unemployed_seeking gera item employment high', () => {
    const r = inferNeedsProfile({ work_status: 'unemployed_seeking' });
    expect(r.items.find((i) => i.category === 'employment')?.priority).toBe('high');
  });

  it('language_level none gera item language high; basic gera medium', () => {
    expect(inferNeedsProfile({ language_level: 'none' }).items.find((i) => i.category === 'language')?.priority).toBe('high');
    expect(inferNeedsProfile({ language_level: 'basic' }).items.find((i) => i.category === 'language')?.priority).toBe('medium');
  });

  it('urgencies psychological gera item psychological high', () => {
    const r = inferNeedsProfile({ urgencies: ['psychological'] });
    expect(r.items.find((i) => i.category === 'psychological')?.priority).toBe('high');
    expect(r.hasUrgentNeeds).toBe(true);
  });

  it('urgencies emotional_support (pré-chegada) também gera psychological high', () => {
    const r = inferNeedsProfile({ urgencies: ['emotional_support'] });
    expect(r.items.find((i) => i.category === 'psychological')?.priority).toBe('high');
  });

  it('urgencies food/health gera apoio social high', () => {
    expect(inferNeedsProfile({ urgencies: ['food'] }).items.find((i) => i.category === 'social')?.priority).toBe('high');
    expect(inferNeedsProfile({ urgencies: ['cost_of_living'] }).items.find((i) => i.category === 'social')?.priority).toBe('high');
  });

  it('urgencies legal_info eleva jurídico a high mesmo sem legal_status', () => {
    const r = inferNeedsProfile({ urgencies: ['legal_info'] });
    expect(r.items.find((i) => i.category === 'legal')?.priority).toBe('high');
  });

  it('combinação ordena por prioridade (high antes de medium)', () => {
    const triage: TriageResponses = {
      legal_status: 'pending', // medium
      housing_status: 'homeless', // high
      language_level: 'basic', // medium
      urgencies: ['psychological'], // high
    };
    const r = inferNeedsProfile(triage);
    // primeiros itens devem ser os high
    const priorities = r.items.map((i) => i.priority);
    const firstMediumIndex = priorities.indexOf('medium');
    const lastHighIndex = priorities.lastIndexOf('high');
    expect(lastHighIndex).toBeLessThan(firstMediumIndex);
    expect(r.hasUrgentNeeds).toBe(true);
  });

  it('hasUrgentNeeds false quando só há medium', () => {
    const r = inferNeedsProfile({ legal_status: 'pending', language_level: 'basic' });
    expect(r.items.length).toBe(2);
    expect(r.hasUrgentNeeds).toBe(false);
  });
});
