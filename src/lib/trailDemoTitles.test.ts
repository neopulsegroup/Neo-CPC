import { describe, expect, it } from 'vitest';
import { filterNonDemoTrails, isDemoTrail, isDemoTrailTitle } from '@/lib/trailDemoTitles';

describe('trailDemoTitles', () => {
  it('identifies known demo trail titles', () => {
    expect(isDemoTrailTitle('Direitos Laborais em Portugal')).toBe(true);
    expect(isDemoTrailTitle('Preparação para o Trabalho')).toBe(true);
    expect(isDemoTrailTitle('Situação Legal')).toBe(true);
    expect(isDemoTrailTitle('Teste - Testar')).toBe(true);
  });

  it('returns false for real trail titles', () => {
    expect(isDemoTrailTitle('Integração Profissional no Algarve')).toBe(false);
  });

  it('identifies demo trail ids', () => {
    expect(isDemoTrail({ id: 'demo-trail-1', title: 'Qualquer' })).toBe(true);
    expect(isDemoTrail({ id: 'real-trail-1', title: 'Integração Profissional no Algarve' })).toBe(false);
  });

  it('filters demo trails from lists', () => {
    const trails = [
      { id: 't1', title: 'Integração Profissional no Algarve' },
      { id: 't2', title: 'Situação Legal' },
      { id: 'demo-trail-3', title: 'Outra' },
    ];
    expect(filterNonDemoTrails(trails)).toEqual([{ id: 't1', title: 'Integração Profissional no Algarve' }]);
  });
});
