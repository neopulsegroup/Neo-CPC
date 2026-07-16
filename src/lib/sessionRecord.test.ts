import { describe, expect, it } from 'vitest';
import {
  buildSessionRecordActivities,
  buildSessionRecordScreening,
  personInitials,
  readSessionRecordFields,
  shortMigrantId,
} from './sessionRecord';

describe('sessionRecord', () => {
  it('personInitials extrai iniciais do nome', () => {
    expect(personInitials('Lucas Dubois')).toBe('LD');
  });

  it('shortMigrantId usa sufixo do uid', () => {
    expect(shortMigrantId('migrant-abc123')).toBe('#ABC123');
  });

  it('readSessionRecordFields normaliza campos da sessão', () => {
    expect(
      readSessionRecordFields({
        notes: 'Nota clínica',
        notes_urgent: true,
        recommended_track: 'language',
        immediate_next_step: 'schedule',
        notes_updated_at: '2024-02-01T10:00:00.000Z',
      })
    ).toEqual({
      notes: 'Nota clínica',
      notesUrgent: true,
      recommendedTrack: 'language',
      immediateNextStep: 'schedule',
      notesUpdatedAt: '2024-02-01T10:00:00.000Z',
    });
  });

  it('buildSessionRecordScreening devolve vazio sem triagem concluída', () => {
    const result = buildSessionRecordScreening(null, null, { get: (key) => key }, (iso) => iso);
    expect(result.isEmpty).toBe(true);
  });

  it('buildSessionRecordActivities ignora sessão atual e limita a dois itens', () => {
    const items = buildSessionRecordActivities({
      sessions: [
        {
          id: 'current',
          migrant_id: 'm1',
          session_type: 'psicologa',
          scheduled_date: '2024-02-10',
          scheduled_time: '10:00',
        },
        {
          id: 'other',
          migrant_id: 'm1',
          session_type: 'jurista',
          service_label: 'Consulta Jurídica',
          scheduled_date: '2024-02-01',
          scheduled_time: '09:00',
        },
      ],
      currentSessionId: 'current',
      progress: [],
      trails: {},
      formatDate: (iso) => iso,
      sessionTitle: (session) => session.service_label || session.session_type,
      trailProgressLabel: (percent) => `${percent}%`,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Consulta Jurídica');
  });
});
