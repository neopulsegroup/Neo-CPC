/**
 * Calendário e “dia civil” de referência da aplicação: Lisboa (Portugal).
 * Usar para datas YYYY-MM-DD, filtros por mês/semana e comparações com o “hoje” do CPC.
 */
export const APP_TIME_ZONE = 'Europe/Lisbon';

const WEEKDAY_SHORT_TO_JS_SUN0: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Data civil (YYYY-MM-DD) numa zona horária, para um instante UTC. */
export function getCalendarDateIsoInTimeZone(date: Date, timeZone = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/** Alias semântico: mesma função com `APP_TIME_ZONE` por omissão (Lisboa). */
export const getCalendarDateIsoInAppTimeZone = (date: Date) => getCalendarDateIsoInTimeZone(date);

export function todayIsoAppCalendar(): string {
  return getCalendarDateIsoInTimeZone(new Date());
}

/** Último dia do mês civil (1–12), calendário gregoriano. */
export function lastDayOfCalendarMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function monthStartEndIsoForCalendarMonth(year: number, month1to12: number): { monthStart: string; monthEnd: string } {
  const m = String(month1to12).padStart(2, '0');
  const monthStart = `${year}-${m}-01`;
  const last = lastDayOfCalendarMonth(year, month1to12);
  const monthEnd = `${year}-${m}-${String(last).padStart(2, '0')}`;
  return { monthStart, monthEnd };
}

export function monthStartEndIsoInAppTimeZone(date = new Date()): { monthStart: string; monthEnd: string } {
  const iso = getCalendarDateIsoInTimeZone(date);
  const [y, mo] = iso.split('-').map(Number);
  return monthStartEndIsoForCalendarMonth(y, mo);
}

export function previousMonthStartEndFromTodayIso(todayIso: string): { monthStart: string; monthEnd: string } {
  const [y, m] = todayIso.split('-').map(Number);
  if (m === 1) return monthStartEndIsoForCalendarMonth(y - 1, 12);
  return monthStartEndIsoForCalendarMonth(y, m - 1);
}

/** Soma dias a uma data civil YYYY-MM-DD (gregoriano, independente do fuso). */
export function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const x = new Date(Date.UTC(y, mo - 1, d + deltaDays));
  const yy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(x.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Domingo=0 … Sábado=6, para a data civil `isoDate` vista em Lisboa (meio-dia UTC como âncora). */
export function getJsWeekdaySun0ForCalendarDateIso(isoDate: string, timeZone = APP_TIME_ZONE): number {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const instant = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).formatToParts(instant);
  const short = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const key = short.slice(0, 3);
  return WEEKDAY_SHORT_TO_JS_SUN0[key] ?? 1;
}

/** Segunda do calendário de Lisboa que contém `todayIso`; semana Seg–Dom. */
export function weekStartEndIsoMondayInAppCalendar(todayIso: string): { weekStart: string; weekEnd: string } {
  const day = getJsWeekdaySun0ForCalendarDateIso(todayIso);
  const diffToMonday = day === 0 ? 6 : day - 1;
  const weekStart = addCalendarDaysIso(todayIso, -diffToMonday);
  const weekEnd = addCalendarDaysIso(weekStart, 6);
  return { weekStart, weekEnd };
}
