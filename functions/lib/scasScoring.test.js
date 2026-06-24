"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scasScoring_1 = require("./scasScoring");
function uniform(value) {
    const map = {};
    for (const id of scasScoring_1.SCAS_ITEM_IDS)
        map[id] = value;
    return map;
}
(0, vitest_1.describe)('functions scasScoring (espelho de src/lib/scas)', () => {
    (0, vitest_1.it)('mapeia exatamente 21 itens em 4 domínios (9/4/4/4)', () => {
        const all = Object.values(scasScoring_1.SCAS_DOMAIN_ITEMS).flat().sort((a, b) => a - b);
        (0, vitest_1.expect)(all).toEqual(scasScoring_1.SCAS_ITEM_IDS);
        (0, vitest_1.expect)(scasScoring_1.SCAS_DOMAIN_ITEMS.D1).toHaveLength(9);
    });
    (0, vitest_1.it)('completo: 4 domínios + global', () => {
        (0, vitest_1.expect)((0, scasScoring_1.computeScores)(uniform(3), null)).toEqual({
            score_d1: 3,
            score_d2: 3,
            score_d3: 3,
            score_d4: 3,
            score_global: 3,
        });
    });
    (0, vitest_1.it)('âmbito de domínio só preenche esse domínio', () => {
        const responses = { 5: 4, 9: 4, 15: 4, 19: 4 };
        const scores = (0, scasScoring_1.computeScores)(responses, 'D3');
        (0, vitest_1.expect)(scores.score_d3).toBe(4);
        (0, vitest_1.expect)(scores.score_global).toBeNull();
    });
    (0, vitest_1.it)('global com 2 casas decimais', () => {
        const responses = uniform(3);
        responses[1] = 4; // 64/21 = 3.0476...
        (0, vitest_1.expect)((0, scasScoring_1.computeScores)(responses, null).score_global).toBe(3.05);
    });
    (0, vitest_1.it)('completude por âmbito', () => {
        const partial = { 5: 4, 9: 4, 15: 4, 19: 4 };
        (0, vitest_1.expect)((0, scasScoring_1.isAssessmentComplete)(partial, 'D3')).toBe(true);
        (0, vitest_1.expect)((0, scasScoring_1.isAssessmentComplete)(partial, null)).toBe(false);
    });
});
