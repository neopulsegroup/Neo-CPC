# CPC · Runbook de Deploy

Documento operacional para colocar o CPC em produção a partir do zero.
Pensado para ser seguido por alguém que nunca tocou no projecto.

> **Projeto Firebase:** `cpc-projeto-app`
> **Frontend hosting:** Vercel (`portalcpc.com`)
> **Backend:** Cloud Functions Gen2, região `us-central1`
> **Repo:** [`neopulsegroup/Neo-CPC`](https://github.com/neopulsegroup/Neo-CPC)

---

## 1. Pré-requisitos

| Tool | Versão | Notas |
|---|---|---|
| Node.js | **20.x** | Functions engine declara Node 20; usar `nvm use 20` |
| npm | 10.x (bundled com Node 20) | `npm ci` é usado pelo CI |
| Firebase CLI | `>=13` | `npm i -g firebase-tools` |
| Google Cloud CLI | recente | só para storage/CORS/backup (`gcloud`, `gsutil`) |
| Git | qualquer | repo `neopulsegroup/Neo-CPC` |

**Acessos** (pedir ao Silva se não tens):
- Owner/Editor do projeto Firebase `cpc-projeto-app`.
- Conta Vercel ligada ao repo.
- Conta Resend (para inspecionar logs de email).
- (opcional) GitHub Actions, se fores configurar CI/CD.

**Login local:**
```bash
firebase login
firebase use cpc-projeto-app    # ou existe `.firebaserc` que já fixa isto
gcloud auth login               # só se fores correr backup ou CORS
```

---

## 2. Variáveis de ambiente

### 2.1 Frontend (Vercel)

Configurar em **Vercel > Project Settings > Environment Variables**.
Marcar todas para `Production`, `Preview` e `Development`. Redeploy depois de criar.

| Variável | Obrigatório | Fonte |
|---|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | ✅ | Google Cloud → Security → reCAPTCHA Enterprise/v3 |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | ✅ | Firebase Console → App Check → reCAPTCHA v3 provider |
| `VITE_USE_SECURE_REGISTER_FUNCTION` | recomendado | valor `true` |
| `VITE_FUNCTIONS_REGION` | opcional | default `us-central1` |
| `VITE_I18N_FIRESTORE_OVERRIDES` | opcional | só em dev |
| `VITE_FIREBASE_*` (6 vars) | só para staging | ver [`docs/STAGING.md`](docs/STAGING.md) |

Ver `.env.example` (na raiz) para a lista canónica e descrições.

> **Firebase web config** (apiKey, authDomain, projectId, etc.) tem fallback
> hard-coded em `src/integrations/firebase/client.ts:7-21` apontando para
> produção. Em produção não precisas mexer.

### 2.2 Backend (Firebase Functions Secrets)

Configurar via CLI. Nunca commitar valores.

| Secret | Obrigatório | Onde é lido |
|---|---|---|
| `RESEND_API_KEY` | ✅ | `functions/src/email/sendEmail.ts:21` |
| `RECAPTCHA_SECRET_KEY` | ✅ | `functions/src/registerUserSecure.ts:182` |
| `RECAPTCHA_MIN_SCORE` | opcional (default `0.5`) | `functions/src/registerUserSecure.ts:212` |
| `ENFORCE_APPCHECK` | opcional (default `false`) | `functions/src/registerUserSecure.ts:283` |
| `RESEND_FROM_EMAIL` | opcional | `functions/src/email/sendEmail.ts:23` |

```bash
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set RECAPTCHA_SECRET_KEY
firebase functions:secrets:set RECAPTCHA_MIN_SCORE      # ex.: 0.5 → 0.7
firebase functions:secrets:set ENFORCE_APPCHECK         # 'true' quando estiver pronto
```

Para confirmar (mostra só metadata, nunca o valor):
```bash
firebase functions:secrets:get RESEND_API_KEY
```

---

## 3. Build local (verificação antes de deploy)

```bash
npm ci
npm run build                      # frontend (vite)
npm run test:run                   # 244 testes
cd functions
npm ci
npm run build                      # tsc → functions/lib/
npx vitest run                     # 12 testes (functions)
cd ..
```

Se qualquer um destes falhar, **não fazer deploy**. Investigar primeiro.

---

## 4. Deploy do Backend (Firebase)

Ordem recomendada (rules → indexes → functions) para evitar dependências partidas:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage:rules
firebase deploy --only functions
```

Ou tudo de uma vez:
```bash
firebase deploy --only firestore,storage,functions
```

**Triggers/CFs activos** (ver `functions/src/index.ts`):

| Tipo | Nome | Trigger |
|---|---|---|
| Callable | `registerUserSecure` | HTTP (público) |
| Callable | `submitContactForm` | HTTP (público) |
| Callable | `deleteOwnAccount` | HTTP (auth) |
| Firestore | `onMigrantCreated` | `profiles/{uid}` create |
| Firestore | `onCompanyCreated` | `companies/{uid}` create |
| Firestore | `onApplicationCreated` | `job_applications/{id}` create |
| Firestore | `onApplicationStatusChanged` | `job_applications/{id}` update |
| Firestore | `onJobOfferCreated` | `job_offers/{id}` create |
| Firestore | `onSessionCreated` | `sessions/{id}` create |
| Scheduler | `scheduledReminders` | `every 15 minutes` (Lisbon) |
| Scheduler | `retentionCleanup` | `0 3 1 * *` (mensal, Lisbon) |

Após primeiro deploy, confirma no Console que cada secret está atribuído à
função certa (o tsc valida o nome do secret mas não que esteja configurado).

---

## 5. Deploy do Frontend (Vercel)

**Padrão:** push em `main` → Vercel detecta e faz build/deploy automático.

**Manual** (se precisares):
```bash
npx vercel --prod
```

**Sanity check rápido em prod após deploy:**
- Abrir `https://portalcpc.com` em incógnito.
- Sem erros na consola.
- `Network` → request inicial 200.
- Idioma é apanhado correctamente.

---

## 6. Configuração de infraestrutura (uma vez por projeto)

### 6.1 CORS do Storage

```bash
gsutil cors set storage-cors.json gs://cpc-projeto-app.firebasestorage.app
gsutil cors get gs://cpc-projeto-app.firebasestorage.app   # confirmar
```

Ficheiro: `storage-cors.json` na raiz.

### 6.2 Cloud Scheduler

`firebase deploy --only functions` cria automaticamente os jobs do
`onSchedule`. Após o primeiro deploy:

```
Cloud Console → Cloud Scheduler → us-central1
- firebase-schedule-scheduledReminders-us-central1     (every 15min)
- firebase-schedule-retentionCleanup-us-central1       (mensal, dia 1 03:00)
```

Quota Spark: **3 jobs grátis**. Utilizados: **2/3**.

### 6.3 DNS

`portalcpc.com` e `www.portalcpc.com` apontam para Vercel. CNAME documentado
na conta Vercel; nada para fazer aqui a não ser que se mude de provider.

### 6.4 Resend domain verification

Sem isto os emails ficam em "domain not verified".
- Resend Dashboard → Domains → `portalcpc.com`
- Adicionar TXT/MX/DKIM no DNS provider e esperar verificação.
- Default sender: `geral@portalcpc.com` (override via `RESEND_FROM_EMAIL`).

---

## 7. Verificação pós-deploy (smoke test)

Correr em produção logo após deploy. Falhar qualquer um = considerar rollback.

- [ ] `https://portalcpc.com` carrega sem erros visíveis nem 5xx.
- [ ] **Registo** novo migrante: reCAPTCHA passa, conta criada, redirecciona à triagem.
- [ ] **Login** + logout funcionam.
- [ ] **Formulário de contacto** (`/contacto`): submissão envia email via RESEND.
- [ ] **Marcar sessão** (perfil CPC): email de confirmação chega ao migrante.
- [ ] **Self-delete** (perfil migrante): conta apagada + signout.
- [ ] **Cloud Scheduler**: ambos os jobs `ENABLED` no Console.
- [ ] **Cloud Logging**: filtros `notification_sent`, `register_success` aparecem.
- [ ] **App Check** (modo Monitor): tokens a chegar sem rejeições.

---

## 8. Rollback

### 8.1 Frontend (Vercel)
Vercel → Deployments → escolher deploy anterior → **Promote to Production**.
Reverte em segundos. Sem perda de dados (são todos backend).

### 8.2 Functions (Firebase)
Sem rollback automático. Re-deploy da versão anterior:
```bash
git checkout <commit-bom>
cd functions && npm ci && npm run build && cd ..
firebase deploy --only functions
```

### 8.3 Firestore rules / indexes
Git é o histórico:
```bash
git checkout <commit-bom> -- firestore.rules firestore.indexes.json
firebase deploy --only firestore:rules,firestore:indexes
```

### 8.4 Firestore data
Só via restore de backup. Ver [`docs/BACKUP.md`](docs/BACKUP.md).

---

## 9. Troubleshooting comum

| Sintoma | Causa provável | Verificar/corrigir |
|---|---|---|
| `CORS error` no upload de ficheiros | `storage-cors.json` não aplicado | §6.1, re-correr `gsutil cors set` |
| Email não chega | `RESEND_API_KEY` ausente OU domínio não verificado no Resend | §2.2 + §6.4. Ver Resend Logs |
| Function falha com `permission-denied` | Secret não atribuído à function ou IAM falta | Re-deploy a function; conferir `firebase functions:secrets:get` |
| `Index not found` em query | Índice composto em falta | Erro dá link directo para criar; ou `firebase deploy --only firestore:indexes` |
| Registo dá `RATE_LIMITED` | bucket `security_rate_limits` cheio | Esperar 15min; em prod considerar reset manual da doc no Firestore |
| Cloud Scheduler diz `permission denied` | Service account do scheduler sem permissões | Console → IAM → adicionar `roles/cloudfunctions.invoker` |
| `App Check` 401 nas callables | `ENFORCE_APPCHECK=true` sem tokens válidos | Voltar a `false` (Monitor) até estabilizar |
| Frontend não pega env var nova | Vercel não fez redeploy | Trigger manual de redeploy depois de mudar env |

---

## 10. Operação contínua

- **Logs:** `firebase functions:log --only <name>` para olhar 1 função; Cloud
  Logging Console para queries cruzadas com chaves estruturadas (`requestId`,
  `notification_sent`, `register_success`).
- **Backup:** correr `scripts/backup-firestore.sh` antes de qualquer migração
  destrutiva. Ver [`docs/BACKUP.md`](docs/BACKUP.md).
- **CI/CD opcional:** ver `.github/workflows/deploy.yml`. Requer secrets
  `FIREBASE_TOKEN` / `GCP_SA_KEY` no GitHub.
- **Staging:** ver [`docs/STAGING.md`](docs/STAGING.md). Ainda não existe.

---

## 11. Histórico relevante

- **Email transport (2026-05-26):** SMTP eliminado, tudo via RESEND HTTP.
  Ver [`CHANGELOG.md`](CHANGELOG.md).
- **LGPD (2026-06-15):** consent obrigatório, cascade delete unificado,
  self-delete imediato, cron de retenção mensal (24 meses). Ver CHANGELOG.

---

## Decisões deliberadamente abertas

| ID | Pergunta | Onde |
|---|---|---|
| D10 | URL base hard-coded em `emailTemplates.ts:45` (`https://www.portalcpc.com`). Extrair para env var quando houver staging. | `functions/src/emailTemplates.ts` |
| T-17 | Quando passar App Check de Monitor → Enforce? | Após smoke test em prod estável |
| T-23 | (resolvido) SMTP eliminado. | `docs/SETUP_SECRETS.md` §6 |
