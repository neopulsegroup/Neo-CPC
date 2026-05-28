import { describe, expect, it } from 'vitest';
import {
  filterEventLogRows,
  getEventLogActionDescription,
  getEventLogScope,
  localDateKeyFromMs,
} from '@/pages/dashboard/cpc/eventLogDisplay';

const t = {
  get: (key: string) => {
    const map: Record<string, string> = {
      'cpc.pages.eventLog.actions.user.blocked': 'Utilizador bloqueado',
      'cpc.pages.eventLog.actions.activities.create': 'Atividade criada',
      'cpc.pages.eventLog.actions.unknown_action': 'cpc.pages.eventLog.actions.unknown_action',
    };
    return map[key] ?? key;
  },
};

describe('getEventLogActionDescription', () => {
  it('returns translated label for known dotted actions', () => {
    expect(getEventLogActionDescription('user.blocked', t)).toBe('Utilizador bloqueado');
    expect(getEventLogActionDescription('activities.create', t)).toBe('Atividade criada');
  });

  it('falls back to raw action code when translation is missing', () => {
    expect(getEventLogActionDescription('custom_event', t)).toBe('custom_event');
  });

  it('returns em dash for empty action', () => {
    expect(getEventLogActionDescription('—', t)).toBe('—');
  });
});

const sampleRows = [
  {
    id: '1',
    actorId: 'u1',
    actorLabel: 'Ana',
    action: 'user.blocked',
    actionLabel: 'Utilizador bloqueado',
    context: 'cpc',
    targetId: 'x',
    createdAtMs: new Date('2026-05-10T12:00:00').getTime(),
    scope: 'cpc' as const,
  },
  {
    id: '2',
    actorId: 'u2',
    actorLabel: 'Bruno',
    action: 'activities.create',
    actionLabel: 'Atividade criada',
    context: 'migrant_profile',
    targetId: 'y',
    createdAtMs: new Date('2026-05-20T12:00:00').getTime(),
    scope: 'migrant' as const,
  },
];

describe('filterEventLogRows', () => {
  it('filters by actor, date range and search together', () => {
    const day = localDateKeyFromMs(sampleRows[0].createdAtMs);
    const filtered = filterEventLogRows(sampleRows, {
      search: 'bloqueado',
      actorId: 'u1',
      dateFrom: day,
      dateTo: day,
      scope: 'all',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
  });

  it('filters by scope tab', () => {
    const filtered = filterEventLogRows(sampleRows, {
      search: '',
      actorId: 'all',
      dateFrom: '',
      dateTo: '',
      scope: 'migrant',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('2');
  });
});

describe('getEventLogScope', () => {
  it('uses actor role when available', () => {
    expect(getEventLogScope('migrant', 'cpc_settings')).toBe('migrant');
    expect(getEventLogScope('company', 'activities')).toBe('company');
    expect(getEventLogScope('admin', 'cpc_settings')).toBe('cpc');
  });

  it('falls back to context when role is missing', () => {
    expect(getEventLogScope('', 'migrant_profile')).toBe('migrant');
    expect(getEventLogScope('', 'company_jobs')).toBe('company');
    expect(getEventLogScope('', 'cpc_settings')).toBe('cpc');
  });
});
