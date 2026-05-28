import { describe, it, expect } from 'vitest';
import { sortMigrants, getTime, isSortOption } from './sortMigrants';

describe('sortMigrants', () => {
  const migrants = [
    { first_name: 'Ana',   created_at: new Date('2025-01-15T10:00:00Z') },
    { first_name: 'Bruno', created_at: new Date('2025-03-10T10:00:00Z') },
    { first_name: 'Carla', created_at: new Date('2025-02-20T10:00:00Z') },
  ];

  it('ordena por data de registo descendente (mais recente primeiro)', () => {
    const r = sortMigrants(migrants, 'created_at_desc');
    expect(r[0].first_name).toBe('Bruno');
    expect(r[2].first_name).toBe('Ana');
  });

  it('ordena por data de registo ascendente (mais antigo primeiro)', () => {
    const r = sortMigrants(migrants, 'created_at_asc');
    expect(r[0].first_name).toBe('Ana');
    expect(r[2].first_name).toBe('Bruno');
  });

  it('ordena por nome A-Z', () => {
    const r = sortMigrants(migrants, 'name_asc');
    expect(r.map((m) => m.first_name)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('ordena por nome Z-A', () => {
    const r = sortMigrants(migrants, 'name_desc');
    expect(r.map((m) => m.first_name)).toEqual(['Carla', 'Bruno', 'Ana']);
  });

  it('migrante sem created_at vai para o fim em ordenação descendente', () => {
    const sem = [{ first_name: 'Diogo', created_at: undefined }, ...migrants];
    const r = sortMigrants(sem, 'created_at_desc');
    expect(r[r.length - 1].first_name).toBe('Diogo');
  });

  it('migrante sem created_at vai para o fim em ordenação ascendente', () => {
    const sem = [{ first_name: 'Diogo', created_at: undefined }, ...migrants];
    const r = sortMigrants(sem, 'created_at_asc');
    expect(r[r.length - 1].first_name).toBe('Diogo');
  });

  it('não mutaciona o array original', () => {
    const original = [...migrants];
    sortMigrants(migrants, 'name_desc');
    expect(migrants).toEqual(original);
  });
});

describe('getTime', () => {
  it('retorna 0 para null/undefined', () => {
    expect(getTime(null)).toBe(0);
    expect(getTime(undefined)).toBe(0);
  });

  it('aceita Date', () => {
    const d = new Date('2025-01-01T00:00:00Z');
    expect(getTime(d)).toBe(d.getTime());
  });

  it('aceita Firestore Timestamp via toDate()', () => {
    const fake = { toDate: () => new Date('2025-05-01T00:00:00Z') };
    expect(getTime(fake)).toBe(new Date('2025-05-01T00:00:00Z').getTime());
  });

  it('aceita Firestore Timestamp via seconds', () => {
    expect(getTime({ seconds: 1700000000 })).toBe(1700000000 * 1000);
  });

  it('aceita ISO string', () => {
    expect(getTime('2025-01-01T00:00:00Z')).toBe(new Date('2025-01-01T00:00:00Z').getTime());
  });

  it('retorna 0 para string inválida', () => {
    expect(getTime('invalid')).toBe(0);
  });

  it('aceita number (unix ms)', () => {
    expect(getTime(1700000000000)).toBe(1700000000000);
  });
});

describe('isSortOption', () => {
  it('aceita valores válidos', () => {
    expect(isSortOption('created_at_desc')).toBe(true);
    expect(isSortOption('created_at_asc')).toBe(true);
    expect(isSortOption('name_asc')).toBe(true);
    expect(isSortOption('name_desc')).toBe(true);
  });

  it('rejeita valores inválidos', () => {
    expect(isSortOption('foo')).toBe(false);
    expect(isSortOption(null)).toBe(false);
    expect(isSortOption(undefined)).toBe(false);
    expect(isSortOption(123)).toBe(false);
  });
});
