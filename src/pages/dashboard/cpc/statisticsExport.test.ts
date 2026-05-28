import { describe, expect, it } from 'vitest';

import * as XLSX from 'xlsx';
import * as docx from 'docx';

import { defaultBranding } from '@/lib/documentBranding';

import { buildStatisticsReport, exportStatisticsDocx, exportStatisticsPdf, exportStatisticsXlsx } from './statisticsExport';

describe('statisticsExport', () => {
  const parseUnknownDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  it('gera PDF estruturado (não vazio)', async () => {
    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      filteredUsers: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [],
      parseUnknownDate,
    });

    const bytes = await exportStatisticsPdf(report, { maxTrailRows: 10, maxRawUsers: 10, documentBranding: defaultBranding() });
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('gera XLSX com sheets esperadas', async () => {
    const report = buildStatisticsReport({
      year: 2026,
      period: 'q1',
      regionFilter: 'Lisboa',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-03-31T23:59:59.999Z') },
      users: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      filteredUsers: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [{ trailId: 't1', trail: 'Percurso 1', completed: 0 }],
      parseUnknownDate,
    });

    const buf = await exportStatisticsXlsx(report, XLSX);
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Resumo', 'Regiões', 'Mensal', 'Percursos', 'Base']);
  });

  it('gera DOCX (zip) com conteúdo não vazio', async () => {
    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      filteredUsers: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [],
      parseUnknownDate,
    });

    const blob = await exportStatisticsDocx(report, docx, { maxTrailRows: 10, maxRawUsers: 10 });
    const ab = await new Response(blob).arrayBuffer();
    const u8 = new Uint8Array(ab);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(u8.length).toBeGreaterThan(0);
  });

  // TASK-01.1: agregação por Ano de Registo
  it('agrega registrationYearStats ordenado por ano desc, ignorando migrantes sem ano', () => {
    const filteredUsers = [
      { id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'u2', createdAt: '2026-02-02T00:00:00.000Z' },
      { id: 'u3', createdAt: '2026-03-02T00:00:00.000Z' },
      { id: 'u4', createdAt: '2026-04-02T00:00:00.000Z' },
      { id: 'u5', createdAt: '2026-05-02T00:00:00.000Z' },
    ];
    const registrationYearByUser = new Map<string, number | null>([
      ['u1', 2024],
      ['u2', 2026],
      ['u3', 2024],
      ['u4', null], // sem ano → omitido
      ['u5', 2025],
    ]);

    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: filteredUsers,
      filteredUsers,
      regionByUser: new Map(),
      progressByUser: new Map(),
      kpis: { total: 5, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [],
      monthly: [],
      trailPerf: [],
      registrationYearByUser,
      parseUnknownDate,
    });

    expect(report.registrationYearStats).toEqual([
      { year: 2026, count: 1 },
      { year: 2025, count: 1 },
      { year: 2024, count: 2 },
    ]);
  });

  // TASK-01.1: XLSX inclui aba "Ano de Registo" quando há dados
  it('XLSX inclui aba "Ano de Registo" quando registrationYearStats não está vazio', async () => {
    const filteredUsers = [
      { id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'u2', createdAt: '2026-02-02T00:00:00.000Z' },
    ];
    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: filteredUsers,
      filteredUsers,
      regionByUser: new Map([['u1', 'Lisboa'], ['u2', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 2, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 2, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 2 }],
      trailPerf: [],
      registrationYearByUser: new Map([['u1', 2025], ['u2', 2026]]),
      parseUnknownDate,
    });

    const buf = await exportStatisticsXlsx(report, XLSX);
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toContain('Ano de Registo');
    // Verifica que a aba tem header + 2 linhas de dados
    const sheet = wb.Sheets['Ano de Registo'];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(rows[0]).toEqual(['Ano', 'Inscritos']);
    expect(rows).toHaveLength(3);
  });

  // TASK-01.1: PDF aceita registrationYearStats sem crashar
  it('PDF inclui secção Ano de Registo quando registrationYearByUser fornecido', async () => {
    const filteredUsers = [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }];
    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: filteredUsers,
      filteredUsers,
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [],
      registrationYearByUser: new Map([['u1', 2025]]),
      parseUnknownDate,
    });

    const bytes = await exportStatisticsPdf(report, {
      maxTrailRows: 10,
      maxRawUsers: 10,
      documentBranding: defaultBranding(),
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(report.registrationYearStats).toHaveLength(1);
  });
});
