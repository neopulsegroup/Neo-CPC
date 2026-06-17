import { describe, expect, it } from 'vitest';

import {
  computeMigrantOverallProgressPercent,
  computeMigrantSessionsProgressPercent,
  countMigrantCompletedModules,
  countMigrantCompletedSessions,
} from './migrantHistoryMetrics';

describe('migrantHistoryMetrics', () => {
  it('conta sessões concluídas com vários estados', () => {
    const sessions = [
      { status: 'Concluída' },
      { status: 'completed' },
      { status: 'Agendada' },
      { status: 'Cancelada' },
    ];
    expect(countMigrantCompletedSessions(sessions)).toBe(2);
    expect(computeMigrantSessionsProgressPercent(sessions)).toBe(50);
  });

  it('soma módulos concluídos em todas as trilhas', () => {
    expect(
      countMigrantCompletedModules([
        { modules_completed: 2 },
        { modules_completed: 3 },
        { modules_completed: null },
      ])
    ).toBe(5);
  });

  it('calcula relatório de progresso como média das áreas', () => {
    expect(
      computeMigrantOverallProgressPercent({
        trailsProgressAvg: 80,
        sessionsProgress: 60,
        profileCompleteness: 100,
        triageProgress: 0,
      })
    ).toBe(60);
  });
});
