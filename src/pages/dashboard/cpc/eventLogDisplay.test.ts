import { describe, expect, it } from 'vitest';
import {
  filterEventLogRows,
  getAuditLogActionKind,
  getEventLogActionDescription,
  getEventLogScope,
  inferAuditLogCriticality,
  inferAuditLogResult,
  localDateKeyFromMs,
  paginateRows,
} from '@/pages/dashboard/cpc/eventLogDisplay';

const t = {
  get: (key: string) => {
    const map: Record<string, string> = {
      'cpc.pages.eventLog.actions.user.blocked': 'Utilizador bloqueado',
      'cpc.pages.eventLog.actions.activities.create': 'Atividade criada',
      'cpc.pages.eventLog.actions.unknown_action': 'cpc.pages.eventLog.actions.unknown_action',
      'cpc.pages.eventLog.actionKinds.update': 'Update',
      'cpc.pages.eventLog.actionKinds.create': 'Create',
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
    actorEmail: 'ana@example.com',
    actorLabel: 'ana@example.com',
    action: 'user.blocked',
    actionLabel: 'Utilizador bloqueado',
    actionKind: 'Update',
    context: 'cpc',
    targetId: 'x',
    createdAtMs: new Date('2026-05-10T12:00:00').getTime(),
    scope: 'cpc' as const,
    criticality: 'high' as const,
    result: 'success' as const,
    origin: 'app' as const,
    requestLabel: 'APP cpc',
    httpStatus: 200,
  },
  {
    id: '2',
    actorId: 'u2',
    actorEmail: 'bruno@example.com',
    actorLabel: 'bruno@example.com',
    action: 'activities.create',
    actionLabel: 'Atividade criada',
    actionKind: 'Create',
    context: 'migrant_profile',
    targetId: 'y',
    createdAtMs: new Date('2026-05-20T12:00:00').getTime(),
    scope: 'migrant' as const,
    criticality: 'low' as const,
    result: 'success' as const,
    origin: 'app' as const,
    requestLabel: 'APP migrant_profile',
    httpStatus: 200,
  },
];

const defaultFilters = {
  search: '',
  actorId: 'all',
  dateFrom: '',
  dateTo: '',
  scope: 'all' as const,
  action: 'all',
  criticality: 'all',
  result: 'all',
  origin: 'all',
};

describe('filterEventLogRows', () => {
  it('filters by actor, date range and search together', () => {
    const day = localDateKeyFromMs(sampleRows[0].createdAtMs);
    const filtered = filterEventLogRows(sampleRows, {
      ...defaultFilters,
      search: 'bloqueado',
      actorId: 'u1',
      dateFrom: day,
      dateTo: day,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
  });

  it('filters by scope tab', () => {
    const filtered = filterEventLogRows(sampleRows, {
      ...defaultFilters,
      scope: 'migrant',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('2');
  });

  it('filters by criticality and result', () => {
    const filtered = filterEventLogRows(sampleRows, {
      ...defaultFilters,
      criticality: 'high',
      result: 'success',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
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

describe('audit log inference helpers', () => {
  it('infers criticality and result from action names', () => {
    expect(inferAuditLogCriticality('unauthorized_attempt')).toBe('high');
    expect(inferAuditLogCriticality('smtp_test_ok')).toBe('low');
    expect(inferAuditLogResult('smtp_test_error')).toBe('error');
    expect(inferAuditLogResult('smtp_test_ok')).toBe('success');
  });

  it('maps action kind labels', () => {
    expect(getAuditLogActionKind('user.blocked', t)).toBe('Update');
    expect(getAuditLogActionKind('activities.create', t)).toBe('Create');
  });
});

describe('paginateRows', () => {
  it('returns the requested page slice', () => {
    const values = [1, 2, 3, 4, 5];
    expect(paginateRows(values, 0, 2)).toEqual([1, 2]);
    expect(paginateRows(values, 1, 2)).toEqual([3, 4]);
    expect(paginateRows(values, 2, 2)).toEqual([5]);
  });
});
