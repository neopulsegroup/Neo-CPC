# Estratégia de Branches · Estado Actual + Opções

> **Data:** 2026-06-15 · final do Bloco 6.
> **Para:** Silva (review e decisão de merge).

---

## 1. Estado actual (verificado)

```
* feature/bloco6-polish       ← HEAD actual do working tree
  feature/bloco5-validacao
  feature/bloco4-sprint4
  feature/bloco3-deploy-safety
  feature/bloco2-lgpd
  feature/consolidate-resend
  feature/fase1-agendamentos-fundacao
  main                        ← produção, intocada
```

### O que cada branch aponta

**Todas as 7 branches `feature/*` apontam para o MESMO commit base** (`73b5166 · Sprint C-Item 4 · Áreas de Serviço`).

```
feature/bloco2-lgpd                  → 73b5166
feature/bloco3-deploy-safety         → 73b5166
feature/bloco4-sprint4               → 73b5166
feature/bloco5-validacao             → 73b5166
feature/bloco6-polish                → 73b5166
feature/consolidate-resend           → 73b5166
feature/fase1-agendamentos-fundacao  → 73b5166
main                                 → 73b5166
```

### Onde vive o trabalho

**Tudo no working tree**, ~98 ficheiros modificados/novos.

A directriz "Sem commits" repetida em cada bloco significou que todas as
mudanças ficaram em **uncommitted state**, partilhado entre todas as branches
através do checkout (branches são marcadores de progresso, não snapshots
isolados).

### Implicações

- O Silva **não pode rever cada bloco em separado** sem antes commitar.
- O working tree contém **todos os 5 blocos misturados** (consolidate-resend
  até bloco6).
- `git diff main` mostra tudo de uma vez.

---

## 2. Opções de separação

### Opção A · Commit cumulativo em `feature/bloco6-polish` (mais simples)

Um único commit que contém **tudo** de consolidate-resend até bloco6.
- ✅ Rápido (1 comando)
- ✅ Não perde nenhum ficheiro
- ❌ Sem granularidade — Silva revê 98 ficheiros num único diff
- ❌ Branches `feature/blocoN-*` para `N<6` ficam vazias e enganadoras (devem ser apagadas)

Comando:
```bash
git add -A
git commit -m "Blocos 1-6 acumulados (resend, LGPD, deploy, sprint4, validação, polish)"
git branch -D feature/bloco2-lgpd feature/bloco3-deploy-safety feature/bloco4-sprint4 \
              feature/bloco5-validacao feature/consolidate-resend
# feature/bloco6-polish fica como a única branch de trabalho
```

### Opção B · Reconstruir um commit por bloco (mais trabalhoso, granular)

Idealmente Silva faz cherry-pick virtual: para cada bloco, escolhe os
ficheiros desse bloco, commit, troca de branch, repete.

Roadmap por bloco (ver `CHANGELOG.md` para a lista oficial de cada um):

| Bloco | Ficheiros principais | Commit message sugerida |
|---|---|---|
| consolidate-resend | `functions/src/email/sendEmail.ts`, `functions/src/contactResend.ts`, todos os triggers, `functions/src/index.ts`, `SettingsPage.tsx`, `settingsUtils.ts` | "consolidate-resend: SMTP eliminado, RESEND unificado" |
| bloco2-lgpd | `functions/src/lib/userCollections.ts`, `functions/src/deleteOwnAccount.ts`, `functions/src/retentionCleanup.ts`, `src/features/admin/`, `MigrantsAdminPage`, `ProfilePage` migrante, locales | "bloco2: LGPD (T-07/08/09/10/11)" |
| bloco3-deploy-safety | `DEPLOY.md`, `scripts/backup-firestore.sh`, `docs/BACKUP.md`, `docs/STAGING.md`, `.github/workflows/deploy.yml`, `src/integrations/firebase/client.ts` (env vars) | "bloco3: deploy + backup + staging prep + CI/CD" |
| bloco4-sprint4 | `src/lib/emailVerification.ts`, `EmailVerificationGuard`, `EmailVerificationPage`, `BookingSessionWizardDialog.tsx` (fullscreen), `src/lib/exportBrandingHeaders.ts`, exports XLSX/DOCX | "bloco4: email verification + branding XLSX/DOCX + modal fullscreen" |
| bloco5-validacao | `docs/SECURITY_AUDIT.md`, `docs/FEATURES.md` (additions T-13/T-12) | "bloco5: audit funcional + segurança" |
| bloco6-polish | `eslint.config.js`, `src/integrations/firebase/auth.ts` (rename), `src/features/cms/ContentEditorForm.tsx`, `scripts/fix-admin-role.ts`, `docs/EMAIL_DNS.md`, `docs/MONITORING.md`, `docs/SECRETS_ROTATION.md`, `docs/PENDING_HANDOFF.md` | "bloco6: lint clean + 3 docs Renato + handoff" |

Pseudo-procedimento por bloco:
```bash
git checkout feature/consolidate-resend
git add <ficheiros desse bloco>
git commit -m "..."

git checkout feature/bloco2-lgpd
git cherry-pick feature/consolidate-resend   # arrasta base
# adiciona apenas os ficheiros NOVOS do bloco 2
git add <ficheiros bloco 2>
git commit -m "..."
# etc.
```

- ✅ Cada branch tem o seu commit isolado, review independente
- ❌ Trabalhoso (~30 minutos manuais); risco de incluir o ficheiro errado num bloco
- ❌ Requer disciplina ao re-fazer o stack

### Opção C · NÃO commitar; entregar working tree como está (status quo)

O Silva avalia tudo em conjunto via `git diff main`.
- ✅ Zero risco de erro no split
- ✅ É exactamente o que se entrega hoje
- ❌ Sem branches reviewable; mas se Silva planeia merge tudo-em-um para main, é o mais directo

---

## 3. Recomendação

**Opção C para a entrega imediata** + Opção A se Silva quiser uma branch "tudo
em um" para PR única.

A Opção B só vale a pena se o Silva quiser **separar PRs para review por terceiros**
(ex.: revisor externo, colega) — para uso interno do Silva, B custa mais do que dá.

---

## 4. O que NÃO foi feito (intencionalmente)

- ❌ **Nenhum commit foi criado** durante os 6 blocos. Esta foi a directriz
  explícita em cada bloco ("Sem commits").
- ❌ **Nenhum merge para `main`**. `main` continua intocada e igual a `origin/main`.
- ❌ **Nenhum push para o remote**. Tudo vive no clone local.

---

## 5. Próximos passos sugeridos para o Silva

1. **Rever as 7 entradas em `CHANGELOG.md`** (consolidate-resend → bloco6) para
   contexto do que cada bloco fez.
2. **Decidir A, B ou C** acima.
3. **Executar a opção escolhida** (ou pedir ao dev para executar).
4. Se quiser remoto: `git push origin feature/<nome>` para cada branch que
   quiser partilhar.
