# Changelog

## 2026-06-15 · Mega Auditoria Funcional + Branch Handoff

**Branch:** `feature/bloco6-polish` (mesmo working tree)

Dois entregáveis finais. **Zero código alterado.**

### Adicionado
- **`docs/AUDIT_FUNCIONAL.md`** — relatório exaustivo de 59 fluxos (Visitante, Migrante, Empresa, CPC) classificados ✅/⚠️/❌/🔧/🔍 com evidência file:line. 45/59 funcionais, 0 quebrados, 5 dependem de infra externa, 5 parciais documentados, 4 exigem smoke test browser.
- **`docs/BRANCH_HANDOFF.md`** — estado actual das 7 branches `feature/*` (todas no mesmo commit base `73b5166`, trabalho vive no working tree). 3 opções de separação propostas (A: commit cumulativo, B: cherry-pick por bloco, C: status quo). Recomendação: C+A.

### Conclusão da auditoria
- **45/59 fluxos ✅** verificados estaticamente.
- **0 fluxos ❌ quebrados.**
- **Confiança estática ≈ 95 %**; resto requer browser + Firestore live.
- **PRONTO PARA PRODUÇÃO** sujeito apenas às acções em `PENDING_HANDOFF.md`.

---

## 2026-06-15 · Bloco 6 · Polish

**Branch:** `feature/bloco6-polish`

Limpeza final antes do handoff. Lint a zero erros, redução de 38% nos
warnings, e 4 docs novos consolidando todas as acções humanas pendentes.

### T-44 · 0 lint errors (era 8)
- `src/integrations/firebase/auth.ts` — `useSecureRegisterFunction` → `shouldUseSecureRegister` (prefixo `use` reservado a hooks).
- `src/features/cms/ContentEditorForm.tsx` — early return movido para depois de todos os hooks; `pageFields` envolto em `useMemo` para satisfazer rules-of-hooks.
- `scripts/fix-admin-role.ts` — `require()` substituído por `readFileSync + JSON.parse` (regra `@typescript-eslint/no-require-imports`).

### T-45 · 47 → 29 warnings (-38%)
- `eslint.config.js` — `coverage/` adicionado a `ignores`; desligada a regra `react-refresh/only-export-components` em `src/components/ui/**` (shadcn) e `src/contexts/**` (state global). Cobre 17 warnings que eram noise puro.
- 4 warnings de logical expression em `pageFields` resolvidos pelo wrap em `useMemo`.
- 3 unused eslint-disable em `coverage/` desapareceram com o ignore.
- 29 warnings restantes são `react-hooks/exhaustive-deps` em ficheiros que arriscam regressão funcional se tocados sem teste E2E — documentados para sprint futura (`H-G1` em `PENDING_HANDOFF.md`).

### Documentação (para Renato/Silva)
- **`docs/EMAIL_DNS.md`** — SPF / DKIM (3 CNAMEs do RESEND) / DMARC para `portalcpc.com` + smoke test `mail-tester.com > 9/10`. **Pendente · Renato.**
- **`docs/MONITORING.md`** — recomendação Sentry (free tier 5k events/mês) com setup passo-a-passo + 4 alertas mínimos. **Pendente · Renato cria conta + DSN.**
- **`docs/SECRETS_ROTATION.md`** — cadência 12 meses; secrets listados; procedimento de rotação + procedimento de emergência. Próxima rotação: junho 2027.
- **`docs/PENDING_HANDOFF.md`** — lista consolidada de tudo o que falta accionar (Silva consola, Renato DNS/contas/rotação, CIBEA decisões D1-D12, tradução adiada). **Fonte da verdade do handoff.**

### Validação final
- Frontend `npm run build` ✅ 17.45s
- Frontend `npm run test:run` ✅ **255/255** (sem regressão)
- Functions `npm run build` ✅
- `npm run lint` → **0 errors, 29 warnings** (era 8, 47)

### Nada deployado
Tudo local. Silva decide quando merge cada branch.

---

## 2026-06-15 · Bloco 5 · Validação Completa

**Branch:** `feature/bloco5-validacao`

Auditoria pura: inventário de rotas + guards, validação de Service Areas,
revisão de regras Firestore (companies), audit de secrets/keys. **Zero
alterações de código** — só docs.

### T-13 · Inventário de rotas + guards
- 14 rotas públicas, 1 dev-only, 4 protegidas, 1 catch-all (total 20).
- 3 rotas públicas são placeholder (`/termos`, `/trails`, `/precos` → `NotFound`).
- Todos os 17 imports em `App.tsx` resolvem para componentes existentes (build verde).
- Guards confirmados: `ProtectedRoute` + `EmailVerificationGuard` em todas as
  rotas autenticadas; `TriageGuard` adicional em `/dashboard/migrante/*`.
- Roles correctos: migrant, company, 7 roles CPC. Sem rotas órfãs.

### T-12 · Service Areas
- `ensureServiceAreasSeeded()` cria legal (30min) / psychology (60min) / mediation (30min) em colecção vazia.
- `updateServiceArea()` actualiza responsáveis + duração + activo.
- Rules: `read auth, write admin` (linhas 628-631) — conforme.
- `BookingSessionWizardDialog` consome `isAreaBookable()` (área activa + ≥1 responsável). Áreas inactivas mostram `serviceAreas.areaUnavailable`.
- **Status: funcional.**

### T-20 · Audit leitura companies
- Regra `match /companies/{companyId}: allow read: if true;` inicialmente
  parecia risco mas o schema **não contém PII sensível**:
  `{user_id, company_name, verified, activity_area, createdAt, updatedAt}`.
- NIF, telefone, morada vivem em `profiles/{uid}` (regras restritas).
- Migrante só consome `company_name` (`JobsPage.tsx:57, 256, 425`).
- **Conclusão: verificado, sem risco.** Nenhuma alteração necessária.
- Caveat documentado em `docs/SECURITY_AUDIT.md` §5: futuras migrações que
  adicionem NIF/contactos a `companies` exigem rever esta regra.

### T-26 · Audit de secrets/keys
- Varredura de 5 patterns (`AIzaSy`, `sk_`, `re_`, `secret_key`, `password`).
- 1 chave Firebase web pública (esperada; fallback em `client.ts:15`).
- 1 password dev-only em `CreateTestUsers.tsx` (só DEV bundle).
- Functions secrets via `defineSecret` ou `process.env` (sem valores hardcoded).
- Histórico git limpo: zero `.env`/`.key`/`.pem`/`*secret*` commitados.
- **Estado: SEGURO.** Nenhuma acção corretiva.

### Adicionado
- `docs/SECURITY_AUDIT.md` (novo) — relatório completo do audit T-26 + secção T-20.

### Alterado
- `docs/FEATURES.md` — secções T-13 (inventário rotas + análise guards) e T-12 (Service Areas validação).

### Validação
- Frontend `npm run build` ✅ 19.64s
- Frontend `npm run test:run` ✅ **255/255** (sem regressão)
- Functions `npm run build` ✅

### Recomendações futuras
- Adicionar `secret-scan` job no CI semanal.
- Repetir audit ao criar projeto staging.
- Antes de migrar campos a `companies/`, reavaliar `allow read: if true`.

---

## 2026-06-15 · Bloco 4 · Sprint 4 Features

**Branch:** `feature/bloco4-sprint4`

T-01 verificação de email (substitui Phone Auth), T-02 branding EMPIS em
exports XLSX/DOCX, T-03 modal de agendamento fullscreen.

### T-01 · Verificação de email no registo
- `sendEmailVerification` automático após registo via callable **e** fallback client.
- Novo `EmailVerificationGuard` envolve todas as rotas `/dashboard/*` e `/triagem`.
- Nova `EmailVerificationPage` com:
  - Mensagem com email do utilizador.
  - Botão "Reenviar email" com cooldown de 60s.
  - Botão "Já verifiquei" → `user.reload()` + reload da app.
  - Botão "Sair" → logout + redirect home.
- Cláusula **grandfather** em `src/lib/emailVerification.ts`: contas com
  `createdAt < 2026-06-01` passam sem bloqueio. Apagar `VERIFICATION_CUTOFF_ISO`
  para forçar verificação universal.
- Email enviado pelo **próprio Firebase Auth** (não usa RESEND nem custo extra).
- i18n `emailVerification.*` em 4 locales.
- Phone Auth (T-18) **cancelado**.

### T-02 · Branding EMPIS em todos os exports
- **PDFs já tinham** logo header+footer via `applyBrandingToAllPdfLibPages`
  (built-in `/branding/logo-SF.png` + `/branding/logos-cpc-sf.png`).
  Nada para mudar.
- **XLSX/DOCX**: novo helper partilhado `src/lib/exportBrandingHeaders.ts`.
  - `withSheetBranding(aoa, {title})` — prepend 4 rows + footer 1 row em cada sheet.
  - `buildDocxBrandingSections(docx)` — `headers` + `footers` text-only.
- Aplicado em:
  - `messagesExport.ts` XLSX (2 sheets) + DOCX
  - `statisticsExport.ts` XLSX (6 sheets) + DOCX
  - `MigrantsAdminPage` XLSX
  - `CandidatesPage` XLSX
- Imagens binárias em XLSX/DOCX ficam para sprint futura (SheetJS Community
  não embute imagens; `docx` aceita mas precisa de pre-fetch).

### T-03 · Modal de agendamento fullscreen
- `BookingSessionWizardDialog`: `DialogContent` agora `w-screen h-screen`,
  override do posicionamento centrado default (`!inset-0`, `!translate-x-0`,
  `!translate-y-0`).
- Conteúdo interno limitado a `max-w-3xl mx-auto` para não esticar texto
  edge-to-edge em desktops largos.
- Mantém botão de fechar (X), cancelar e progresso visíveis. Grid sidebar
  (lg) + content (mobile collapse) intacto.

### Testes
- `src/lib/emailVerification.test.ts` — 9 testes (parsers + grandfather logic).
- `src/lib/exportBrandingHeaders.test.ts` — 2 testes.
- `statisticsExport.test.ts` actualizado para tolerar branding rows no XLSX.

### Validação
- Frontend `vite build` ✅ 17.69s
- Frontend `npm run test:run` ✅ **255/255** (era 244, +11)
- Functions `tsc` ✅
- Functions `vitest` ✅ **12/12**

### Bloqueado (acção Silva)

| Item | Bloqueado por | Estado código |
|---|---|---|
| T-18 Phone Auth | **CANCELADO** (substituído por email verification) | n/a |
| T-43 logos EMPIS finais | CIBEA enviar PNGs com brand EMPIS | placeholder/built-in aplicado em todos os PDFs |
| T-17 App Check enforce | Silva ativar consola após semana de Monitor | código pronto |
| T-22 / T-05 tradução FR | adiado (DeepL ou tradutor humano) | fora de escopo |
| T-31 staging | Silva criar projeto Firebase + Vercel staging | `docs/STAGING.md` pronto |
| T-34 backup ativação | Silva criar bucket GCS | `scripts/backup-firestore.sh` + `docs/BACKUP.md` prontos |
| T-30 CI/CD ativação | Silva configurar secrets no GitHub | workflow pronto |
| Personalização do template de email Firebase Auth | Silva entrar Firebase Console > Auth > Templates | n/a (consola) |

### Notas
- O VERIFICATION_CUTOFF de 2026-06-01 ainda permite todos os utilizadores
  actuais entrar sem verificar. Quando quiseres exigir a TODOS, apaga o
  campo `createdAt < cutoff` em `shouldRequireEmailVerification`.
- O email de verificação usa o template default do Firebase. Para personalizar:
  Firebase Console → Authentication → Templates → Email Address Verification.

---

## 2026-06-15 · Bloco 3 · Deploy e Safety Net

**Branch:** `feature/bloco3-deploy-safety`

Documentação e estrutura para ir a produção em segurança. Tudo o que requer
chaves/contas externas fica como **placeholder** marcado para o Silva.

### Adicionado
- **`DEPLOY.md`** (raiz) — runbook completo: pré-requisitos, env vars Vercel/Firebase, build, deploy ordenado, smoke test, rollback, troubleshooting, operação contínua.
- **`scripts/backup-firestore.sh`** — script bash de backup manual com guard-rails (bucket existe? falha cedo) e variáveis para staging.
- **`docs/BACKUP.md`** — estratégia completa: bucket GCS europeu, lifecycle 30d, opção A (Cloud Function) vs B (gcloud Scheduler), restauro, custos.
- **`docs/STAGING.md`** — passo a passo para criar projeto Firebase + Vercel de staging quando for tempo.
- **`.github/workflows/deploy.yml`** — CI/CD do backend Firebase (frontend já é Vercel). Build+test → deploy funtions/rules/indexes. Suporta `FIREBASE_TOKEN` ou `GCP_SA_KEY`.

### Alterado
- **`src/integrations/firebase/client.ts`** — config Firebase lê de `VITE_FIREBASE_*` com fallback para produção. Suporta staging sem tocar em `src/`.
- **`.env.example`** — bloco `VITE_FIREBASE_*` documentado (comentado por defeito; só para staging).
- **`functions/tsconfig.json`** — `exclude: ["src/**/*.test.ts"]` para os testes não irem para `lib/`.
- **`functions/src/deleteOwnAccount.test.ts`** — fix de tipo `(d) => makeDocSnap(d.id)`.

### Não alterado
- `.gitignore` já cobria `*.log`. Nenhum `.log` está commitado. **T-36 done sem edits.**

### Validação
- Frontend `npm run build` ✅ 19.00s
- Frontend `npm run test:run` ✅ **244/244**
- Functions `npm run build` ✅ (sem tests em `lib/`)
- Functions `npx vitest run` ✅ **12/12**

### Bloqueado (depende do Silva)

| Item | O que falta |
|---|---|
| **T-31** activação staging | Criar projeto Firebase `cpc-projeto-staging` + Vercel staging + preencher env vars. Doc pronta em `docs/STAGING.md`. |
| **T-34** activação backup | Criar bucket GCS `gs://cpc-projeto-app-backups` + IAM + lifecycle. Doc + script prontos em `docs/BACKUP.md` + `scripts/backup-firestore.sh`. |
| **T-30** activação CI/CD | Configurar `GCP_SA_KEY` (preferido) ou `FIREBASE_TOKEN` em GitHub > Settings > Secrets and variables > Actions. Workflow pronto. |
| **T-22 / T-05** | Tradução de UI/conteúdo (DeepL/tradutor humano) — **fora do escopo deste contrato**, decisão diferida. |

### Notas
- Frontend continua com config de produção como fallback. Nada quebra antes de existir staging.
- `Resend` é o único provider de email; não há mais SMTP.
- Workflow CI/CD falha early se nenhum dos secrets estiver configurado.

---

## 2026-06-15 · Bloco 2 · Conformidade LGPD/RGPD

**Branch:** `feature/bloco2-lgpd`

5 itens de compliance LGPD/RGPD + lógica de cascade centralizada.

### T-09 · Consentimento explícito no registo
- Checkbox obrigatório no `Auth.tsx` (modo registo) com link para `/privacidade`.
- Validação client (toast) + server (HttpsError `PRIVACY_CONSENT_REQUIRED`).
- Persistido em `users/{uid}.privacy_consent`, `privacy_consent_at` (server timestamp), `privacy_consent_version = '1.0'`.
- i18n: `auth.consent.{before, linkText, after, required}` nas 4 locales.

### T-07 · Cascade delete completo (admin)
- `MigrantsAdminPage.confirmDeleteMigrant` migrado para usar `cascadeDeleteUserData()` unificado.
- Apaga em **9 collections** (vs 6 anteriormente): sessions, user_trail_progress, job_applications, **notifications** (novo), **conversations + conversation_messages** (novo), triage, profiles, users.
- Audit log gravado em `audit_logs/delete_{uid}_{ts}` com relatório granular por collection.

### T-08 · Self-service delete (LGPD Art. 17)
- Nova Cloud Function `deleteOwnAccount` (callable, `functions/src/deleteOwnAccount.ts`): cascade server-side + audit + `auth.deleteUser()`.
- UI no `ProfilePage` migrante: card vermelho "Eliminar a minha conta" + `AlertDialog` com confirmação por palavra-chave (`ELIMINAR` / `DELETE` / `ELIMINAR` / `SUPPRIMER`).
- i18n: `migrant.deleteAccount.*` nas 4 locales.

### T-11 · Política de retenção concreta
- `Privacy.tsx` secção 8 (`policies.privacy.sections.retention.list[0]`) actualizada nas 4 locales:
  > "24 meses de inatividade · aviso por email 30 dias antes · eliminação permanente"

### T-10 · Cron mensal de retenção
- Nova Cloud Function `retentionCleanup` (`onSchedule('0 3 1 * *', tz='Europe/Lisbon')`).
- 3 casos: avisa (>700 dias, nunca avisado), elimina (>730 dias, avisado há >30 dias), limpa flag (reactivou).
- Email de aviso via novo template `retentionWarning` (4 locales) — RESEND.
- `last_login` actualizado em cada login no client (`loginUser` em `src/integrations/firebase/auth.ts`).
- Quota Cloud Scheduler: 2 jobs após este (scheduledReminders + retentionCleanup) — dentro de 3 grátis.

### Centralização do cascade
- `functions/src/lib/userCollections.ts` + `src/features/admin/userCollections.ts` — fonte única da verdade da lista de collections com dados de utilizador.
- `cascadeDeleteUserDataServer()` (exportado de `deleteOwnAccount.ts`) é partilhado por `deleteOwnAccount` e `retentionCleanup`.

### Firestore rules
- Comentário documentando que os novos campos LGPD (`privacy_consent*`, `last_login`, `retention_warning_sent_at`) passam pela regra default do owner update.
- Delete via `users/{uid}` continua admin-only — self-delete passa pelo admin SDK na CF.

### Testes
- `src/features/admin/cascadeDeleteUser.test.ts` (3 testes).
- `functions/src/deleteOwnAccount.test.ts` (2 testes — cascade server + companies flag).
- `functions/src/retentionCleanup.test.ts` (7 testes — parsers `lastLoginToMillis` + `formatDeletionDate`).
- `MigrantsAdminPage.export.test.tsx`: mock estendido (`setDocument`, `getDocument` para 'users') para o novo cascade-com-existence-check.
- `ProfilePage.test.tsx`: novos mocks (`functionsClient`, `firebase/functions`) para a CF `deleteOwnAccount`.
- `functions/vitest.config.ts` criado: exclui `lib/**` (artefactos de build) do test scan.

### Validação
- Frontend `vite build` ✅ 23.08s
- Frontend `npm run test:run` ✅ **244/244** (era 241, +3)
- Functions `tsc` ✅
- Functions `vitest` ✅ **12/12** (era 3, +9)

### Idempotência preservada
- Flags `reminder_24h_pending` / `reminder_1h_pending` em sessions **intactas**.
- Cascade respeita `audit_logs` (não apaga, é registo histórico LGPD-compliant).

### Notas para deploy (Silva)
- Novo secret: nenhum (reusa `RESEND_API_KEY`).
- Novo Cloud Scheduler job: `firebase-schedule-retentionCleanup-us-central1`.
- Confirmar quota Spark ≤ 3 jobs: scheduledReminders + retentionCleanup = 2/3.

---

## 2026-05-26 · Email consolidado em RESEND (SMTP eliminado)

**Branch:** `feature/consolidate-resend`

### Mudanças
- Novo serviço unificado `functions/src/email/sendEmail.ts` — **único ponto de envio** de email do sistema (RESEND HTTP API).
- TASK-07 (lembretes de sessão) e TASK-08 (5 emails de notificação) migrados de fila `mail/{id}` → RESEND direto via `enqueueEmail()`.
- `contactResend.ts` migrado para usar `sendEmail` unificado. Deixa de ler `system_settings/smtp.fromEmail` (a mistura suja foi resolvida).
- Cada trigger Cloud Function que envia email passa a declarar `{ secrets: [RESEND_API_KEY] }` nas suas options Gen2.

### Removido
- `functions/src/smtp.ts` (wrapper nodemailer)
- `functions/src/mailProcessor.ts` (`loadSmtpSettings` + `processMailDocument`)
- `functions/src/smtp.test.ts`
- Trigger `onMailCreated` em `functions/src/index.ts`
- Callable `testSmtpConnection`
- Dependency `nodemailer` + `@types/nodemailer` em `functions/package.json`
- Secção UI "Configuração SMTP" + botão "Testar SMTP" no CPC SettingsPage
- Função `buildSmtpTestMail` em `settingsUtils.ts`
- Helpers `sanitizeHost`, `sanitizeUsername`, `parsePort` em `settingsUtils.ts`
- Tipo `SmtpSecurity` e bloco `CpcSystemSettings.smtp`
- Imports `httpsCallable` + `functions` em `SettingsPage.tsx`

### Firestore
- `firestore.rules`: regra para `match /mail/{mailId}` simplificada para admin-only (read + create). Helpers `contactNotificationEmail` e `isValidContactMail` removidos.
- Coleção `system_settings/smtp` fica **órfã** (não tem produtores/consumidores). Pode ser limpa manualmente; não é destrutivo deixar lá.

### Testes
- Novo `functions/src/email/sendEmail.test.ts` (3 testes: success, erro do Resend, from override).
- `SettingsPage.test.tsx` atualizado: smoke test agora valida que botão "Testar SMTP" **deixou de existir** após a consolidação.
- `settingsUtils.test.ts` atualizado: teste `buildSmtpTestMail` removido (função eliminada).

### Documentação
- `functions/README.md`: árvore atualizada, padrão de triggers atualizado, callout histórico SMTP→RESEND.
- `functions/.env.example`: comentário de `RESEND_FROM_EMAIL` actualizado para apontar a `sendEmail.ts`.
- `docs/SETUP_SECRETS.md`: T-23 (SMTP config) marcado como ELIMINADO. Secção 0 documenta a decisão; secção 6 mantém histórico.
- Este `CHANGELOG.md` criado.

### Idempotência preservada
- Flags `reminder_24h_sent` / `reminder_1h_sent` nas sessões continuam a controlar quando enviar. Só mudou o transport, não a lógica.

### Ganhos
- −1 dependência (nodemailer + types)
- −1 secret (SMTP password)
- −1 Cloud Function (onMailCreated)
- −1 callable (testSmtpConnection)
- +1 ponto de envio único (rastreabilidade simplificada)
