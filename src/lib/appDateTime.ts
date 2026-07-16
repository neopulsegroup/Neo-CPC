import { APP_TIME_ZONE } from '@/lib/appCalendar';

export { APP_TIME_ZONE };

export type AppLanguage = 'pt' | 'en' | 'es' | 'fr';

export type AppDateInput = Date | string | number | null | undefined;

export type AppFormatOptions = Intl.DateTimeFormatOptions & {
  locale?: string | null;
  fallback?: string;
};

export function languageToAppLocale(language?: string | null): string {
  if (language === 'en') return 'en-GB';
  if (language === 'es') return 'es-ES';
  if (language === 'fr') return 'fr-FR';
  return 'pt-PT';
}

/** Converte entradas comuns (ISO, timestamp, YYYY-MM-DD) para `Date` estável em Lisboa. */
export function toAppDate(value: AppDateInput): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveFormatArgs(options?: AppFormatOptions): {
  locale: string;
  formatOptions: Intl.DateTimeFormatOptions;
  fallback: string;
} {
  const { locale, fallback = '—', ...formatOptions } = options ?? {};
  return {
    locale: languageToAppLocale(locale),
    formatOptions: { timeZone: APP_TIME_ZONE, ...formatOptions },
    fallback,
  };
}

export function formatAppDateTime(value: AppDateInput, options?: AppFormatOptions): string {
  const date = toAppDate(value);
  if (!date) return options?.fallback ?? '—';
  const { locale, formatOptions, fallback } = resolveFormatArgs({
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  });
  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch {
    return fallback;
  }
}

export function formatAppDate(value: AppDateInput, options?: AppFormatOptions): string {
  const date = toAppDate(value);
  if (!date) return options?.fallback ?? '—';
  const { locale, formatOptions, fallback } = resolveFormatArgs({
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch {
    return fallback;
  }
}

export function formatAppDateLong(value: AppDateInput, options?: AppFormatOptions): string {
  return formatAppDate(value, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

export function formatAppWeekdayShort(value: AppDateInput, options?: AppFormatOptions): string {
  const date = toAppDate(value);
  if (!date) return options?.fallback ?? '—';
  const { locale, formatOptions, fallback } = resolveFormatArgs({
    weekday: 'short',
    ...options,
  });
  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch {
    return fallback;
  }
}

export function formatAppMonthYear(value: AppDateInput, options?: AppFormatOptions): string {
  const date = toAppDate(value);
  if (!date) return options?.fallback ?? '—';
  const { locale, formatOptions, fallback } = resolveFormatArgs({
    month: 'short',
    year: 'numeric',
    ...options,
  });
  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date).replace('.', '');
  } catch {
    return fallback;
  }
}

/** Formato fixo: dd-mm-yyyy às hh:mm (Lisboa), com conector localizado. */
export function formatAppDateAtTime(value: AppDateInput, options?: AppFormatOptions): string {
  const date = toAppDate(value);
  if (!date) return options?.fallback ?? '—';
  const { locale, fallback } = resolveFormatArgs(options);
  const atWord =
    locale.startsWith('pt')
      ? 'às'
      : locale.startsWith('es')
        ? 'a las'
        : locale.startsWith('fr')
          ? 'à'
          : 'at';
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: APP_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    return `${get('day')}-${get('month')}-${get('year')} ${atWord} ${get('hour')}:${get('minute')}`;
  } catch {
    return fallback;
  }
}

/** Partes para exibição tipo "em 18/06/26, às 15:20" (data curta + hora 24h, Lisboa). */
export function formatAppNotificationTimestampParts(
  value: AppDateInput,
  options?: AppFormatOptions
): { date: string; time: string } | null {
  const date = toAppDate(value);
  if (!date) return null;
  const { locale } = resolveFormatArgs(options);
  try {
    const datePart = new Intl.DateTimeFormat(locale, {
      timeZone: APP_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
    const timePart = new Intl.DateTimeFormat(locale, {
      timeZone: APP_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
    return { date: datePart, time: timePart };
  } catch {
    return null;
  }
}

export function formatAppMonthLongYear(value: AppDateInput, options?: AppFormatOptions): string {
  const date = toAppDate(value);
  if (!date) return options?.fallback ?? '—';
  const { locale, formatOptions, fallback } = resolveFormatArgs({
    month: 'long',
    year: 'numeric',
    ...options,
  });
  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch {
    return fallback;
  }
}

export type AppDateFormatters = {
  dateTime: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  dateLong: Intl.DateTimeFormat;
  monthYear: Intl.DateTimeFormat;
  monthLongYear: Intl.DateTimeFormat;
  weekdayShort: Intl.DateTimeFormat;
  monthTitle: Intl.DateTimeFormat;
};

export function createAppDateFormatters(localeInput?: string | null): AppDateFormatters {
  const locale = languageToAppLocale(localeInput);
  const base = { timeZone: APP_TIME_ZONE } as const;
  return {
    dateTime: new Intl.DateTimeFormat(locale, { ...base, dateStyle: 'short', timeStyle: 'short' }),
    date: new Intl.DateTimeFormat(locale, { ...base, day: '2-digit', month: 'short', year: 'numeric' }),
    dateLong: new Intl.DateTimeFormat(locale, { ...base, day: '2-digit', month: 'long', year: 'numeric' }),
    monthYear: new Intl.DateTimeFormat(locale, { ...base, month: 'short', year: 'numeric' }),
    monthLongYear: new Intl.DateTimeFormat(locale, { ...base, month: 'long', year: 'numeric' }),
    weekdayShort: new Intl.DateTimeFormat(locale, { ...base, weekday: 'short' }),
    monthTitle: new Intl.DateTimeFormat(locale, { ...base, month: 'long', year: 'numeric' }),
  };
}
