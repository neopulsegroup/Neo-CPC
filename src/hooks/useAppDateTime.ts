import { useMemo } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import {
  APP_TIME_ZONE,
  createAppDateFormatters,
  formatAppDate,
  formatAppDateLong,
  formatAppDateTime,
  formatAppMonthLongYear,
  formatAppMonthYear,
  formatAppWeekdayShort,
  languageToAppLocale,
  type AppFormatOptions,
  type AppDateInput,
} from '@/lib/appDateTime';

export function useAppDateTime() {
  const { language } = useLanguage();
  const locale = useMemo(() => languageToAppLocale(language), [language]);
  const formatters = useMemo(() => createAppDateFormatters(language), [language]);

  return useMemo(
    () => ({
      locale,
      language,
      timeZone: APP_TIME_ZONE,
      formatters,
      formatDateTime: (value: AppDateInput, options?: Omit<AppFormatOptions, 'locale'>) =>
        formatAppDateTime(value, { locale: language, ...options }),
      formatDate: (value: AppDateInput, options?: Omit<AppFormatOptions, 'locale'>) =>
        formatAppDate(value, { locale: language, ...options }),
      formatDateLong: (value: AppDateInput, options?: Omit<AppFormatOptions, 'locale'>) =>
        formatAppDateLong(value, { locale: language, ...options }),
      formatMonthYear: (value: AppDateInput, options?: Omit<AppFormatOptions, 'locale'>) =>
        formatAppMonthYear(value, { locale: language, ...options }),
      formatMonthLongYear: (value: AppDateInput, options?: Omit<AppFormatOptions, 'locale'>) =>
        formatAppMonthLongYear(value, { locale: language, ...options }),
      formatWeekdayShort: (value: AppDateInput, options?: Omit<AppFormatOptions, 'locale'>) =>
        formatAppWeekdayShort(value, { locale: language, ...options }),
    }),
    [formatters, language, locale]
  );
}
