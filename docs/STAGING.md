# Staging Environment · Guia de criação

> **Quem executa:** Silva (envolve criar projeto Firebase + conta Vercel).  
> **Estado actual:** preparação de código pronta (T-31 do Bloco 3). O projeto
> de staging em si ainda **não existe**.

Este documento é o passo a passo para o dia em que decidirmos criar staging.
O código já lê o config do Firebase a partir de env vars com fallback, por
isso adicionar staging não obriga a tocar em `src/`.

---

## 1. Decisão de cortar staging

Quando avançar? Sinais:

- Mudanças em `firestore.rules` deixaram de ser triviais.
- Há features que beneficiariam de QA antes de produção (ex.: candidatura empresa↔migrante).
- O Bloco 8 (testes E2E) arranca — convém correr em ambiente isolado.

Sem qualquer destes sinais, deploy directo a produção continua razoável.

---

## 2. Criar o projeto Firebase de staging

Nome sugerido: `cpc-projeto-staging`.

```bash
# Na Firebase Console:
# https://console.firebase.google.com → Add project → cpc-projeto-staging
# Plano: Spark (gratuito) é suficiente para QA interno; subir a Blaze se for
# preciso Cloud Scheduler ou egress maior.
```

Activar:

- **Authentication** → Email/password.
- **Firestore Database** → Native mode → região `europe-west3` (Frankfurt; mais próximo).
- **Storage** → bucket default.
- **Functions** → ao primeiro deploy.

Ligar a app web (Project Settings → Add app → Web → registar com nome `cpc-staging-web`).
Copiar o config snippet — os 6 valores que vão para Vercel.

---

## 3. Criar o ambiente Vercel staging

Opção mais simples: **projeto Vercel separado** (vs preview deployments do mesmo).

- Vercel → New Project → importar o repo `neopulsegroup/Neo-CPC`.
- Production Branch: `staging` (criar a branch no repo).
- Domain: `staging.portalcpc.com` (ou subdomínio Vercel se não houver DNS).

---

## 4. Configurar env vars no Vercel (staging)

Em Vercel > staging project > Settings > Environment Variables, marcar
para **Production** (na conta staging, "production" significa "o ramo staging"):

```env
VITE_FIREBASE_API_KEY=<vindo do Firebase Console staging>
VITE_FIREBASE_AUTH_DOMAIN=cpc-projeto-staging.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=cpc-projeto-staging
VITE_FIREBASE_STORAGE_BUCKET=cpc-projeto-staging.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<do Firebase Console>
VITE_FIREBASE_APP_ID=<do Firebase Console>

# Reutilizar/criar para staging:
VITE_RECAPTCHA_SITE_KEY=<chave dedicada de staging, ou reaproveitar com domínios extra>
VITE_FIREBASE_APPCHECK_SITE_KEY=<chave dedicada>
VITE_USE_SECURE_REGISTER_FUNCTION=true
```

> Sem alteração ao código de `src/`. O `client.ts` já lê estas variáveis
> (ou cai no fallback de produção se estiverem vazias).

---

## 5. Configurar secrets do Firebase staging

```bash
firebase use cpc-projeto-staging
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set RECAPTCHA_SECRET_KEY
firebase functions:secrets:set RECAPTCHA_MIN_SCORE   # ex.: 0.5
# (ENFORCE_APPCHECK fica vazio até validar com tráfego)
```

> A `RESEND_API_KEY` em staging pode ser a mesma de produção (mesmo domínio
> verificado), ou criar uma nova chave Resend dedicada para conseguir
> separar logs no painel Resend.

---

## 6. Actualizar CORS allowlists

Em `functions/src/registerUserSecure.ts` (`REGISTER_CORS_ORIGINS`),
adicionar o domínio de staging:

```typescript
'https://staging.portalcpc.com',
'https://cpc-projeto-staging.web.app',
'https://cpc-projeto-staging.firebaseapp.com',
```

Re-deploy: `firebase deploy --only functions:registerUserSecure`.

---

## 7. Deploy ao staging

```bash
git checkout staging
git merge main          # ou cherry-pick da feature em causa
git push origin staging
# → Vercel faz build automático
firebase use cpc-projeto-staging
firebase deploy --only functions,firestore:rules,firestore:indexes
```

---

## 8. Smoke test em staging

Mesmo checklist do `DEPLOY.md` §7, mas em `staging.portalcpc.com`. Aceitar
para promoção a produção só depois de passar todos.

---

## 9. Notas

- **Dois projetos = duas quotas Spark.** Cloud Scheduler em staging cabe nos
  3 jobs grátis (scheduledReminders + retentionCleanup = 2).
- **Não usar o projeto de produção como staging.** Misturar dados quebra
  audit logs e LGPD compliance.
- **App Check em staging:** começar em modo Monitor (sem enforce) durante
  algumas semanas, igual ao histórico de produção.

---

## Estado de execução

- [ ] Projeto Firebase staging criado
- [ ] Projeto Vercel staging criado
- [ ] Env vars Vercel preenchidas
- [ ] Firebase secrets configurados em staging
- [ ] CORS allowlist atualizada e re-deployed
- [ ] Branch `staging` no repo
- [ ] Smoke test executado uma vez

> Toda esta secção é trabalho do Silva. O agente só prepara o código.
