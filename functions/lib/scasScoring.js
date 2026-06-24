"use strict";
/**
 * SCAS — lógica de score no servidor (autoridade de cálculo).
 *
 * Espelha src/lib/scas/{constants,scoring}.ts. Mantido aqui porque o pacote
 * `functions` é compilado isoladamente (rootDir=src, CommonJS) e não importa
 * de `../src`. Qualquer alteração às regras de cálculo deve ser refletida em
 * ambos os locais. Os números 3,0/3,5/15%/20% são fixos (EMPIS).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCAS_ITEM_IDS = exports.SCAS_DOMAIN_ITEMS = exports.SCAS_SCORE_DECIMALS = exports.SCAS_TOTAL_ITEMS = exports.SCAS_MAX_VALUE = exports.SCAS_MIN_VALUE = void 0;
exports.roundScore = roundScore;
exports.isValidResponseValue = isValidResponseValue;
exports.itemsForScope = itemsForScope;
exports.isAssessmentComplete = isAssessmentComplete;
exports.computeDomainScore = computeDomainScore;
exports.computeGlobalScore = computeGlobalScore;
exports.computeScores = computeScores;
exports.SCAS_MIN_VALUE = 1;
exports.SCAS_MAX_VALUE = 5;
exports.SCAS_TOTAL_ITEMS = 21;
exports.SCAS_SCORE_DECIMALS = 2;
exports.SCAS_DOMAIN_ITEMS = {
    D1: [1, 3, 6, 10, 11, 13, 16, 20, 21],
    D2: [4, 8, 14, 18],
    D3: [5, 9, 15, 19],
    D4: [2, 7, 12, 17],
};
exports.SCAS_ITEM_IDS = Array.from({ length: exports.SCAS_TOTAL_ITEMS }, (_, index) => index + 1);
const ROUND_FACTOR = 10 ** exports.SCAS_SCORE_DECIMALS;
function roundScore(value) {
    return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}
function isValidResponseValue(value) {
    return (typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= exports.SCAS_MIN_VALUE &&
        value <= exports.SCAS_MAX_VALUE);
}
function itemsForScope(domainScope) {
    return domainScope ? [...exports.SCAS_DOMAIN_ITEMS[domainScope]] : [...exports.SCAS_ITEM_IDS];
}
function isAssessmentComplete(responses, domainScope) {
    return itemsForScope(domainScope).every((itemId) => isValidResponseValue(responses[itemId]));
}
function computeDomainScore(responses, domain) {
    const items = exports.SCAS_DOMAIN_ITEMS[domain];
    let sum = 0;
    for (const itemId of items) {
        const value = responses[itemId];
        if (!isValidResponseValue(value))
            return null;
        sum += value;
    }
    return roundScore(sum / items.length);
}
function computeGlobalScore(responses) {
    let sum = 0;
    for (const itemId of exports.SCAS_ITEM_IDS) {
        const value = responses[itemId];
        if (!isValidResponseValue(value))
            return null;
        sum += value;
    }
    return roundScore(sum / exports.SCAS_TOTAL_ITEMS);
}
function computeScores(responses, domainScope) {
    const empty = {
        score_d1: null,
        score_d2: null,
        score_d3: null,
        score_d4: null,
        score_global: null,
    };
    if (domainScope) {
        return {
            ...empty,
            [`score_${domainScope.toLowerCase()}`]: computeDomainScore(responses, domainScope),
        };
    }
    return {
        score_d1: computeDomainScore(responses, 'D1'),
        score_d2: computeDomainScore(responses, 'D2'),
        score_d3: computeDomainScore(responses, 'D3'),
        score_d4: computeDomainScore(responses, 'D4'),
        score_global: computeGlobalScore(responses),
    };
}
