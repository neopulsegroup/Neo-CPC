# PDI — Plano de Desenvolvimento Individual

Módulo de PDI integrado com SCAS: geração automática a partir do T0, revisão CPC, aceite digital do migrante e versionamento imutável.

## Coleções Firestore

| Coleção | Descrição |
|---------|-----------|
| `pdi/{pdiId}` | Documento versionado (auto-ID). Campos embutidos: `trilhas[]`, `apoios[]`. |
| `pdi_acceptance/{id}` | Aceite imutável (indicador EMPIS). Escrita apenas via Cloud Function. |
| `pdi_version_log/{id}` | Log de revisões (append-only). |

## Máquina de estados

`DRAFT_GENERATED` → `IN_REVIEW` → `VALIDATED` → `ACCEPTED`

- `SUPERSEDED`: versão anterior arquivada (nunca apagada).

## Cloud Functions (`us-central1`)

- `generatePdiFromT0` — CPC; exige SCAS T0 submetido; gera trilhas AUTO + apoios da triagem.
- `validateAndSendPdi` — CPC; valida conteúdo mínimo; `VALIDATED` + notificação `PDI_DISPONIVEL`.
- `acceptPdi` — migrante; exige todas as secções percorridas; cria `pdi_acceptance`.
- `revisePdi` — CPC; `SUPERSEDED` + nova versão `IN_REVIEW` + notificação `PDI_REVISTO`.

## Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes
cd functions && npm run build && cd ..
firebase deploy --only functions:generatePdiFromT0,functions:validateAndSendPdi,functions:acceptPdi,functions:revisePdi
```

## Testes

```bash
npm test -- src/lib/pdi/pdi.test.ts
npm test -- src/lib/scas/
```

## UI

- **CPC**: `PdiParticipantPanel` no perfil do migrante (`ProfilePage`).
- **Migrante**: `/dashboard/migrante/pdi` — revisão, aceite condicionado, PDF (`pdf-lib`), acompanhamento post-aceite.

## Regras EMPIS (não alterar)

Metas SCAS: 3,0 / 3,5 / ×1,15 (alarme) / ×1,20 (meta global).
