"use strict";
/**
 * PDI — lógica de geração no servidor (espelho de src/lib/pdi/generation.ts).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDI_REVIEW_SECTIONS = exports.PDI_DOMAIN_TARGET_MIN = exports.SCAS_META_TARGET_PERCENT = exports.SCAS_RECOMMENDATION_RECOMMENDED_MAX = exports.SCAS_RECOMMENDATION_MANDATORY_BELOW = void 0;
exports.recommendTrail = recommendTrail;
exports.mapRecommendationToPdiState = mapRecommendationToPdiState;
exports.computeTargetGlobal = computeTargetGlobal;
exports.computeTargetForDomain = computeTargetForDomain;
exports.generateAutoTrilhas = generateAutoTrilhas;
exports.generateApoiosFromTriage = generateApoiosFromTriage;
exports.bumpVersion = bumpVersion;
exports.includedTrilhas = includedTrilhas;
exports.allReviewSectionsViewed = allReviewSectionsViewed;
exports.validatePdiForSend = validatePdiForSend;
const scasScoring_1 = require("./scasScoring");
exports.SCAS_RECOMMENDATION_MANDATORY_BELOW = 3.0;
exports.SCAS_RECOMMENDATION_RECOMMENDED_MAX = 3.5;
exports.SCAS_META_TARGET_PERCENT = 20;
exports.PDI_DOMAIN_TARGET_MIN = 3.0;
function recommendTrail(domainScore) {
    if (domainScore < exports.SCAS_RECOMMENDATION_MANDATORY_BELOW)
        return 'obrigatoria';
    if (domainScore <= exports.SCAS_RECOMMENDATION_RECOMMENDED_MAX)
        return 'recomendada';
    return 'opcional';
}
function mapRecommendationToPdiState(recommendation) {
    if (recommendation === 'obrigatoria')
        return 'OBRIGATORIA';
    if (recommendation === 'recomendada')
        return 'RECOMENDADA';
    return 'OPCIONAL';
}
function computeTargetGlobal(scoreGlobal) {
    return (0, scasScoring_1.roundScore)(scoreGlobal * (1 + exports.SCAS_META_TARGET_PERCENT / 100));
}
function computeTargetForDomain(domainScore) {
    if (domainScore == null)
        return null;
    if (domainScore < exports.PDI_DOMAIN_TARGET_MIN)
        return exports.PDI_DOMAIN_TARGET_MIN;
    return (0, scasScoring_1.roundScore)(Math.min(5, domainScore + 0.5));
}
function generateAutoTrilhas(scores, trails) {
    const byDomain = {
        D1: scores.score_d1 != null ? recommendTrail(scores.score_d1) : null,
        D2: scores.score_d2 != null ? recommendTrail(scores.score_d2) : null,
        D3: scores.score_d3 != null ? recommendTrail(scores.score_d3) : null,
        D4: scores.score_d4 != null ? recommendTrail(scores.score_d4) : null,
    };
    const result = [];
    for (const trail of trails) {
        if (!trail.scas_domain)
            continue;
        const domain = trail.scas_domain;
        const recommendation = byDomain[domain];
        if (!recommendation)
            continue;
        result.push({
            trail_id: trail.id,
            recommended_state: mapRecommendationToPdiState(recommendation),
            origin: 'AUTO',
            scas_domain: domain,
            start_date: null,
            end_date: null,
            completion_status: 'NAO_INICIADA',
        });
    }
    return result;
}
function generateApoiosFromTriage(urgencies) {
    const set = new Set((urgencies ?? []).map((u) => u.toLowerCase()));
    const apoios = [];
    if (set.has('legal_info') || set.has('visa_info')) {
        apoios.push({
            type: 'JURIDICO',
            level: set.has('visa_info') ? 'URGENTE' : 'NECESSARIO',
            options: [],
            notes: null,
        });
    }
    const basicOptions = [];
    if (set.has('housing'))
        basicOptions.push('HABITACAO');
    if (set.has('food'))
        basicOptions.push('ALIMENTACAO');
    if (set.has('health'))
        basicOptions.push('SAUDE');
    if (basicOptions.length > 0) {
        apoios.push({ type: 'NECESSIDADES_BASICAS', level: 'NECESSARIO', options: basicOptions, notes: null });
    }
    if (set.has('psychological') || set.has('emotional_support')) {
        apoios.push({ type: 'PSICOLOGICO', level: 'ACOMPANHAMENTO_REGULAR', options: [], notes: null });
    }
    if (set.has('employment') || set.has('job_support')) {
        apoios.push({ type: 'SOCIOPROFISSIONAL', level: 'NECESSARIO', options: ['ORIENTACAO'], notes: null });
    }
    return apoios;
}
function bumpVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)$/);
    if (!match)
        return '1.0';
    return `${Number(match[1])}.${Number(match[2]) + 1}`;
}
function includedTrilhas(trilhas) {
    return trilhas.filter((t) => t.recommended_state !== 'NAO_INCLUIDA');
}
exports.PDI_REVIEW_SECTIONS = ['trilhas', 'apoios', 'objetivos', 'declaracao'];
function allReviewSectionsViewed(viewed) {
    const set = new Set(viewed ?? []);
    return exports.PDI_REVIEW_SECTIONS.every((s) => set.has(s));
}
function validatePdiForSend(doc) {
    const errors = [];
    if (!doc.participant_id)
        errors.push('participant');
    if (!doc.source_t0_assessment_id)
        errors.push('t0');
    if (doc.score_global == null)
        errors.push('scores');
    if (doc.target_global == null)
        errors.push('targets');
    if (includedTrilhas(doc.trilhas ?? []).length === 0)
        errors.push('trilhas');
    return { ok: errors.length === 0, errors };
}
