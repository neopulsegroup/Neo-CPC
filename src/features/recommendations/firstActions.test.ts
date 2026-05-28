import { describe, it, expect } from 'vitest';
import { inferFirstActions } from './firstActions';

const base = { hasCv: true, triageCompleted: true };

describe('inferFirstActions', () => {
  it('triagem incompleta retorna apenas complete-triage (urgent, rota /triagem)', () => {
    const r = inferFirstActions({ triage: null, hasCv: false, triageCompleted: false });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('complete-triage');
    expect(r[0].priority).toBe('urgent');
    expect(r[0].route).toBe('/triagem');
  });

  it('urgencies legal_info gera book-legal urgent que abre diálogo', () => {
    const r = inferFirstActions({ ...base, triage: { urgencies: ['legal_info'] } });
    const legal = r.find((a) => a.id === 'book-legal');
    expect(legal?.priority).toBe('urgent');
    expect(legal?.opensBooking).toBe(true);
    expect(legal?.route).toBeUndefined();
  });

  it('legal_status pending sem urgência gera book-legal recommended (não urgent)', () => {
    const r = inferFirstActions({ ...base, triage: { legal_status: 'pending' } });
    const legal = r.find((a) => a.id === 'book-legal');
    expect(legal?.priority).toBe('recommended');
  });

  it('não duplica book-legal quando já existe versão urgente', () => {
    const r = inferFirstActions({ ...base, triage: { legal_status: 'pending', urgencies: ['legal_info'] } });
    const legals = r.filter((a) => a.id === 'book-legal');
    expect(legals).toHaveLength(1);
    expect(legals[0].priority).toBe('urgent');
  });

  it('migrante sem CV gera complete-cv', () => {
    const r = inferFirstActions({ triage: {}, hasCv: false, triageCompleted: true });
    expect(r.some((a) => a.id === 'complete-cv')).toBe(true);
  });

  it('migrante com CV não gera complete-cv', () => {
    const r = inferFirstActions({ triage: {}, hasCv: true, triageCompleted: true });
    expect(r.some((a) => a.id === 'complete-cv')).toBe(false);
  });

  it('work_status unemployed_seeking gera view-jobs (rota /dashboard/migrante/emprego)', () => {
    const r = inferFirstActions({ ...base, triage: { work_status: 'unemployed_seeking' } });
    const jobs = r.find((a) => a.id === 'view-jobs');
    expect(jobs?.route).toBe('/dashboard/migrante/emprego');
  });

  it('language_level basic gera trilha de português', () => {
    const r = inferFirstActions({ ...base, triage: { language_level: 'basic' } });
    expect(r.some((a) => a.id === 'trail-portuguese')).toBe(true);
  });

  it('máximo de 5 ações mesmo com muitos critérios', () => {
    const r = inferFirstActions({
      hasCv: false,
      triageCompleted: true,
      triage: {
        legal_status: 'not_regularized',
        language_level: 'none',
        work_status: 'unemployed_seeking',
        urgencies: ['legal_info', 'psychological', 'food', 'employment'],
      },
    });
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('psicológico e social abrem diálogo de agendamento', () => {
    const r = inferFirstActions({ ...base, triage: { urgencies: ['psychological', 'health'] } });
    expect(r.find((a) => a.id === 'book-psychological')?.opensBooking).toBe(true);
    expect(r.find((a) => a.id === 'book-social')?.opensBooking).toBe(true);
  });
});
