# Setup de Secrets e Configuração de Produção

> Checklist para colocar o CPC em produção. Cada item identifica quem o
> executa (Silva = consolas/secrets; Agente = código/docs).
>
> Projeto Firebase: `cpc-projeto-app`. Frontend: Vercel. Backend: Cloud Functions us-central1.

---

## 0. Email consolidado em RESEND ✅

**Decisão tomada (feature/consolidate-resend, 2026-05-26):** todo o email do
sistema sai por RESEND. SMTP foi eliminado:

- `functions/src/smtp.ts` removido
- `functions/src/mailProcessor.ts` removido
- `functions/src/smtp.test.ts` removido
- Dependência `nodemailer` desinstalada
- Trigger `onMailCreated` e callable `testSmtpConnection` removidos
- UI SMTP no `CPC SettingsPage` removida
- Doc Firestore `system_settings/smtp` deixou de ter produtores/consumidores
  (pode ser limpo manualmente; não é destrutivo)

T-23 (configurar SMTP) está **eliminado**. Apenas `RESEND_API_KEY` precisa
ser configurada agora.

---

## 1. Frontend — Vercel Environment Variables

Aceder a Vercel > Project Settings > Environment Variables. Marcar **todas** para `Production`, `Preview` e `Development`. Redeploy após adicionar.

- [ ] `VITE_RECAPTCHA_SITE_KEY` — site key reCAPTCHA v3 (T-14)
- [ ] `VITE_FIREBASE_APPCHECK_SITE_KEY` — site key App Check (T-17)
- [ ] `VITE_USE_SECURE_REGISTER_FUNCTION` = `true` (recomendado)

Opcionais:
- [ ] `VITE_FUNCTIONS_REGION` = `us-central1` (só se diferente do default)
- [ ] `VITE_I18N_FIRESTORE_OVERRIDES` = `true` (só se quiseres overrides CMS em dev)

> **Nota:** Firebase config (apiKey, authDomain, projectId, etc.) está hardcoded em `src/integrations/firebase/client.ts:7-14`. Não há env vars para isto — assumido como público OK. Quando houver staging, considerar extrair (D10).

---

## 2. Backend — Firebase Functions Secrets

Pré-requisito: `firebase login` + `firebase use cpc-projeto-app` (ou ter `.firebaserc` na raiz, já criado).

```bash
# reCAPTCHA v3 secret key (T-15)
firebase functions:secrets:set RECAPTCHA_SECRET_KEY

# reCAPTCHA threshold (T-16) — valor: 0.5 (default) ou 0.7 para mais rigor
firebase functions:secrets:set RECAPTCHA_MIN_SCORE

# Resend API key (T-21)
firebase functions:secrets:set RESEND_API_KEY

# Quando estiver pronto para enforce (T-17, depois de 1 semana monitorizar)
firebase functions:secrets:set ENFORCE_APPCHECK
# valor: true
```

Verificar quais estão configurados:
```bash
firebase functions:secrets:get RECAPTCHA_SECRET_KEY
firebase functions:secrets:get RESEND_API_KEY
firebase functions:secrets:get RECAPTCHA_MIN_SCORE
firebase functions:secrets:get ENFORCE_APPCHECK
```

> **Importante:** `RECAPTCHA_MIN_SCORE`, `ENFORCE_APPCHECK`, `RESEND_FROM_EMAIL` são lidos via `process.env.X` no código atual (`functions/src/registerUserSecure.ts:201,262`). Funciona como secret OU como env var. Preferir secret para uniformidade.

---

## 3. Consolas externas

### reCAPTCHA v3 (Google Cloud) — T-14

- [ ] https://console.cloud.google.com/security/recaptcha → projeto `cpc-projeto-app`
- [ ] Criar chave reCAPTCHA v3 (tipo: site web, score-based)
- [ ] Domínios permitidos:
  - `portalcpc.com`
  - `www.portalcpc.com`
  - `localhost`
  - `127.0.0.1`
- [ ] Copiar **Site Key** → `VITE_RECAPTCHA_SITE_KEY` (Vercel + .env local)
- [ ] Copiar **Secret Key** → `firebase functions:secrets:set RECAPTCHA_SECRET_KEY`

### Firebase App Check — T-17

- [ ] Firebase Console > App Check > Register web app
- [ ] Provider: **reCAPTCHA v3** (reusa site key acima, OU criar dedicada)
- [ ] Modo inicial: **Monitor** (não enforce) — observar logs durante ~1 semana
- [ ] Quando estiver tudo verde, mudar para **Enforce**
- [ ] Copiar site key → `VITE_FIREBASE_APPCHECK_SITE_KEY`

### Resend — T-21

- [ ] https://resend.com → conta + API key
- [ ] Domains > Add Domain > `portalcpc.com`
- [ ] Configurar DNS records (TXT, MX, DKIM) no provider do domínio
- [ ] Esperar verificação (até 48h)
- [ ] Copiar API key → `firebase functions:secrets:set RESEND_API_KEY`
- [ ] Definir email remetente: `RESEND_FROM_EMAIL=contacto@portalcpc.com` (ou similar)

### Cloud Scheduler — T-25

(Apenas verificação, após deploy)

- [ ] Após `firebase deploy --only functions`
- [ ] Aceder a https://console.cloud.google.com/cloudscheduler
- [ ] Confirmar job `firebase-schedule-scheduledReminders-us-central1` listado e **ENABLED**
- [ ] Frequência: **every 15 minutes**
- [ ] Quota Spark plan: **1/3 jobs usados** (este é o único cron do projeto)

---

## 4. Local dev setup

- [ ] Copiar `.env.example` → `.env` e preencher
- [ ] `.firebaserc` já presente (default project: `cpc-projeto-app`)
- [ ] `npm install` na raiz e em `functions/`

Para correr com emuladores Firebase:
```bash
# Terminal 1
firebase emulators:start

# Terminal 2 (com VITE_USE_EMULATOR=true no .env)
npm run dev
```

---

## 5. Deploy final

Ordem recomendada:

```bash
# 1. Validar rules
firebase deploy --only firestore:rules

# 2. Deploy indexes (se mudaram)
firebase deploy --only firestore:indexes

# 3. Deploy functions (todos os triggers + scheduled)
firebase deploy --only functions

# 4. Redeploy Vercel (pode ser por trigger Git ou manual)
```

Após deploy:

- [ ] Smoke test 1 — registo de novo utilizador → reCAPTCHA valida, conta criada
- [ ] Smoke test 2 — formulário de contacto `/contacto` → email chega via RESEND
- [ ] Smoke test 3 — marcar sessão → email de confirmação chega ao migrante + consultor
- [ ] Smoke test 4 — aguardar/forçar cron de lembrete (ou esperar janela 24h)
- [ ] Console Firebase > App Check → tokens a chegar (modo Monitor)
- [ ] Console Cloud Logging → procurar `notification_enqueued`, `mail_sent`

---

## 6. Histórico: SMTP → RESEND consolidação ✅

Esta secção documenta o que existia antes da consolidação para referência
de troubleshooting de logs/dados antigos.

### Antes (canal SMTP via fila `mail/{id}`)

- **Produtores:** TASK-07 + TASK-08 (7 triggers) escreviam em `mail/{id}`.
- **Consumer:** `onMailCreated` trigger → `processMailDocument()` em
  `mailProcessor.ts` → `nodemailer` via `smtp.ts`.
- **Config:** `system_settings/smtp` doc com host/port/security/username/
  password/fromEmail.
- **UI:** CPC SettingsPage tinha card "Configuração SMTP" + botão "Testar SMTP".

### Depois (RESEND HTTP direto)

- **Produtores:** mesmos 7 triggers, agora chamam `sendEmail()` direto.
- **Sem fila intermédia:** elimina retry implícito do Firestore trigger,
  mas RESEND tem retry HTTP próprio para erros transitórios.
- **Único ponto de envio:** `functions/src/email/sendEmail.ts`.
- **Único secret:** `RESEND_API_KEY` (vs. SMTP password + Firebase secret + ...).

### Ganhos medidos

- **-1 dependency** (nodemailer + @types/nodemailer)
- **-1 secret** (SMTP password)
- **-1 Cloud Function** (onMailCreated)
- **-1 callable** (testSmtpConnection)
- **-1 collection** (system_settings/smtp órfão)
- **+1 ponto de envio único** (sendEmail.ts) — todos os logs/audit num sítio só
- **Idempotência dos lembretes (TASK-07) preservada** — flags reminder_*_pending continuam a controlar quando enviar

---

## Decisões pendentes a confirmar

| ID | Pergunta | Onde |
|---|---|---|
| T-23 decisão | Consolidar tudo em RESEND? | Esta secção |
| T-17 timing | Quando passar App Check de Monitor para Enforce? | Após smoke test em prod |
| D10 | URL base via env var | `docs/CLIENT_DECISIONS.md` |
