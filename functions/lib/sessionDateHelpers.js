"use strict";
/**
 * TASK-07 — Helpers de data/hora de sessões.
 *
 * **Problema:** `sessions.scheduled_date` (YYYY-MM-DD) + `sessions.scheduled_time`
 * (HH:MM) são armazenados como strings que representam **hora local de Europe/Lisbon**
 * (confirmado em `src/lib/appCalendar.ts` APP_TIME_ZONE). Para janelas de cron
 * (23-25h, 45-75min antes de "agora") precisamos converter para UTC.
 *
 * Portugal tem DST (UTC+0 inverno, UTC+1 verão), por isso não pode usar offset
 * fixo. Usamos Intl.DateTimeFormat para descobrir o offset que Lisboa aplica a
 * cada momento específico.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionLisbonTimestampMs = sessionLisbonTimestampMs;
exports.formatSessionDateForEmail = formatSessionDateForEmail;
const SESSION_TIME_ZONE = 'Europe/Lisbon';
/**
 * Descobre o offset (em minutos) que `SESSION_TIME_ZONE` aplica num dado
 * instante UTC. Positivo quando Lisboa está à frente de UTC.
 *
 * Trick: formata `naiveUtcMs` no fuso alvo, reconstrói esse "looks like"
 * como se fosse UTC e mede a diferença.
 */
function lisbonOffsetMinutes(naiveUtcMs) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: SESSION_TIME_ZONE,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(naiveUtcMs));
    const get = (type) => {
        const raw = parts.find((p) => p.type === type)?.value;
        return raw ? Number(raw) : 0;
    };
    const lisbonY = get('year');
    const lisbonM = get('month');
    const lisbonD = get('day');
    const lisbonH = get('hour');
    const lisbonMin = get('minute');
    const lisbonS = get('second');
    const asLisbonUtcMs = Date.UTC(lisbonY, lisbonM - 1, lisbonD, lisbonH, lisbonMin, lisbonS);
    return (asLisbonUtcMs - naiveUtcMs) / 60000;
}
/**
 * Converte `('YYYY-MM-DD', 'HH:MM')` interpretado como hora local de Lisboa
 * para timestamp UTC em milissegundos.
 *
 * Devolve `null` se as strings forem inválidas.
 */
function sessionLisbonTimestampMs(scheduledDate, scheduledTime) {
    if (typeof scheduledDate !== 'string' || typeof scheduledTime !== 'string')
        return null;
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledDate.trim());
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(scheduledTime.trim());
    if (!dateMatch || !timeMatch)
        return null;
    const [, y, m, d] = dateMatch;
    const [, hh, mm] = timeMatch;
    const naiveUtcMs = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0);
    if (Number.isNaN(naiveUtcMs))
        return null;
    const offsetMin = lisbonOffsetMinutes(naiveUtcMs);
    // "10:00 Lisbon" em verão (offset +60) = 09:00 UTC ⇒ subtrair offset.
    return naiveUtcMs - offsetMin * 60000;
}
/** Formata data + hora para apresentação em emails na locale do destinatário. */
function formatSessionDateForEmail(scheduledDate, scheduledTime, locale) {
    const ms = sessionLisbonTimestampMs(scheduledDate, scheduledTime);
    if (ms === null) {
        // Fallback ao texto cru se não der para parsear.
        return [scheduledDate, scheduledTime].filter((v) => typeof v === 'string').join(' ');
    }
    const intlLocale = locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-ES' : locale === 'fr' ? 'fr-FR' : 'pt-PT';
    return new Intl.DateTimeFormat(intlLocale, {
        timeZone: SESSION_TIME_ZONE,
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(new Date(ms));
}
