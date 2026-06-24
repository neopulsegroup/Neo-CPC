# Módulo SCAS (Sociocultural Adaptation Scale)

Avaliação de impacto do projeto CPC/EMPIS. Mede a adaptação sociocultural dos
participantes em momentos do percurso e alimenta o Plano de Desenvolvimento
Individual (PDI).

## Stack

React + TypeScript + Firestore + Cloud Functions (não há SQL/migrações). As
"migrações" são: coleções Firestore + regras de segurança + seed + funções.

## Regras de negócio (fixas — EMPIS)

- 21 itens, 4 domínios (D1: 9 itens; D2/D3/D4: 4 cada). Escala 1–5 (emoji).
- Score por domínio = média dos itens do domínio. Score global = média dos 21.
- Recomendação de trilha (score T0 do domínio): `< 3,0` obrigatória; `3,0–3,5`
  recomendada; `> 3,5` opcional.
- Melhoria T0→T-PDI: `≥ 20%` → `meta_atingida`; `≥ 15% e < 20%` → `alarme_interno`.
- Momentos: `T0` (após triagem), `T_TRILHA` (por trilha do PDI com domínio
  mapeado), `T_PDI` (todas as trilhas concluídas), `T_ADICIONAL` (reavaliação).
- **Imutabilidade**: após submissão a sessão fica `is_locked`; nunca editável/
  apagável. O score é calculado no servidor (Cloud Function) e há log de auditoria.

Constantes centralizadas em `src/lib/scas/constants.ts` (e espelhadas em
`functions/src/scasScoring.ts`, porque o pacote `functions` compila isolado).

## Coleções Firestore

| Coleção | Conteúdo |
|---|---|
| `scas_items/{1..21}` | Catálogo (domínio, ordem, `i18n_key`). Seed. |
| `scas_assessments/{id}` | Sessão (momento, âmbito, modo, idioma, scores, `is_locked`). |
| `scas_responses/{assessmentId_itemId}` | Resposta 1–5 (id composto = único por item). |
| `scas_audit_log/{id}` | Log imutável de submissão (Admin SDK). |
| `pdi/{uid}` | Plano: trilhas atribuídas + estado (obrigatória/recomendada/opcional). |

## Fluxo

1. **Migrante** (`/dashboard/migrante/scas`): responde ao questionário (emoji,
   multilingue PT/EN/ES/FR, guarda progresso parcial). Banner de CTA na home.
2. **Submissão**: callable `submitScasAssessment` valida elegibilidade e
   completude, calcula os scores, bloqueia a sessão e escreve a auditoria.
3. **Equipa CPC** (perfil do participante): vê histórico/scores/variação/flags
   (apenas leitura), preenche em modo assistido, e constrói/valida o PDI a partir
   do T0. Dashboard agregado em `/dashboard/cpc/scas` com exportação CSV (REI).

## Como correr

### Seed dos 21 itens

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
  node scripts/seed-scas-items.mjs
```

### Regras de segurança

```bash
firebase deploy --only firestore:rules
```

### Cloud Function

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions:submitScasAssessment
```

### Testes

```bash
# Frontend (lógica de score, recomendação, metas, disparo de momentos)
npm test -- --run src/lib/scas

# Backend (espelho do cálculo de score)
cd functions && npx vitest run src/scasScoring.test.ts
```

## Ficheiros principais

| Área | Caminho |
|---|---|
| Lógica pura (score/recomendação/metas) | `src/lib/scas/{constants,scoring}.ts` |
| Disparo de momentos | `src/lib/scas/pending.ts` |
| Repositório Firestore + PDI | `src/lib/scas/repository.ts` |
| Hook/vista de preenchimento | `src/features/scas/{useScasFill.ts,ScasFillView.tsx}` |
| UI migrante | `src/pages/dashboard/migrant/ScasPage.tsx` + `src/features/scas/ScasPendingBanner.tsx` |
| UI equipa (perfil) | `src/features/scas/ScasParticipantPanel.tsx` |
| UI equipa (assistido) | `src/pages/dashboard/cpc/ScasAssistedPage.tsx` |
| Dashboard agregado | `src/pages/dashboard/cpc/ScasDashboardPage.tsx` |
| Exportação CSV | `src/features/scas/scasExport.ts` |
| Cloud Function | `functions/src/submitScasAssessment.ts` (+ `scasScoring.ts`) |
| Regras | `firestore.rules` (blocos `scas_*` e `pdi`) |
| Seed | `scripts/seed-scas-items.mjs` |
| i18n | `src/locales/{pt,en,es,fr}.json` → chave `scas` |
