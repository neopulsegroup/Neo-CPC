import { describe, expect, it } from 'vitest';

import {
  formatAppDate,
  formatAppDateAtTime,
  formatAppDateTime,
  formatAppNotificationTimestampParts,
  languageToAppLocale,
  toAppDate,
} from '@/lib/appDateTime';
import { APP_TIME_ZONE } from '@/lib/appCalendar';

describe('appDateTime', () => {
  it('mapeia idiomas para locale BCP47', () => {
    expect(languageToAppLocale('pt')).toBe('pt-PT');
    expect(languageToAppLocale('en')).toBe('en-GB');
  });

  it('interpreta datas YYYY-MM-DD com âncora UTC', () => {
    expect(toAppDate('2026-06-17')?.toISOString()).toBe('2026-06-17T12:00:00.000Z');
  });

  it('formata sempre com fuso de Lisboa', () => {
    const instant = new Date('2026-01-15T23:30:00.000Z');
    const formatted = formatAppDateTime(instant, { locale: 'pt' });
    const expected = new Intl.DateTimeFormat('pt-PT', {
      timeZone: APP_TIME_ZONE,
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(instant);
    expect(formatted).toBe(expected);
  });

  it('formata datas civis sem deslocar o dia', () => {
    expect(formatAppDate('2026-06-17', { locale: 'pt' })).toMatch(/17/);
  });

  it('formata data e hora no padrão dd-mm-yyyy às hh:mm', () => {
    const formatted = formatAppDateAtTime('2026-06-18T14:20:00.000Z', { locale: 'pt' });
    expect(formatted).toMatch(/^\d{2}-\d{2}-\d{4} às \d{2}:\d{2}$/);
    expect(formatted).toContain('18-06-2026 às');
  });

  it('extrai partes de data/hora para notificações', () => {
    const parts = formatAppNotificationTimestampParts('2026-06-18T14:20:00.000Z', { locale: 'pt' });
    expect(parts).not.toBeNull();
    expect(parts?.date).toMatch(/18\/06\/26/);
    expect(parts?.time).toMatch(/15:20/);
  });
});
