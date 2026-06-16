# Monitoring & Alerting · CPC

> **Status:** PENDENTE · Renato cria conta + DSN; dev integra SDK
> **Bloco:** Bloco 6 · T-35

---

## 1. Recomendação principal: Sentry

Razões:
- Tier gratuito **5 000 events/mês** chega largamente para a fase actual.
- SDKs maduros para React (`@sentry/react`) e Node (`@sentry/node`) que
  cobrem frontend e Cloud Functions.
- Source-maps automáticos (Vercel + Sentry).
- Dashboard partilhável com a CIBEA para visibility.
- Integração nativa com Slack/Email para alertas.

---

## 2. Alternativas consideradas

### Firebase Crashlytics — **não recomendado**
Só suporta apps mobile nativas. Não tem SDK web first-party.

### Vercel + Log Drains (Datadog, LogFlare) — viável mas mais caro
- Logs em real-time, mas o tier gratuito é só dos drains de terceiros.
- Pode entrar mais tarde, complementar ao Sentry.

### Google Cloud Logging — já temos
- As Cloud Functions já gravam para Cloud Logging (chaves estruturadas
  como `notification_sent`, `register_success`).
- Cobre o **backend** mas não o frontend. **Manter, complementar com Sentry.**

---

## 3. Setup Sentry (quando Renato criar a conta)

### Passo 1 — Conta + projeto
1. Entrar em https://sentry.io (free tier).
2. Create Project → React (frontend) → copiar DSN.
3. Create Project → Node.js (backend) → copiar DSN.
4. Em **Settings → General Settings → Data retention**: 30 dias é suficiente.

### Passo 2 — Variáveis de ambiente

**Frontend (Vercel):**
```
VITE_SENTRY_DSN_FRONTEND=https://<...>@sentry.io/<id>
```

**Backend (Firebase Secrets):**
```
firebase functions:secrets:set SENTRY_DSN_BACKEND
```

### Passo 3 — Integração frontend (dev)
```bash
npm install @sentry/react
```

Em `src/main.tsx`:
```typescript
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
```

Wrap o root em `Sentry.ErrorBoundary` opcionalmente.

### Passo 4 — Integração functions (dev)
```bash
cd functions && npm install @sentry/node
```

Em `functions/src/index.ts`:
```typescript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN_BACKEND) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_BACKEND,
    tracesSampleRate: 0.1,
  });
}
```

E em cada `try/catch` que já tem `logger.error`, adicionar `Sentry.captureException(error)`.

---

## 4. Alertas mínimos a configurar

| Evento | Threshold | Canal |
|---|---|---|
| `error.unhandled` no frontend | qualquer | Email → Renato |
| `failed_register_unexpected` na CF `registerUserSecure` | > 5/min | Email + Slack |
| `notification_send_failed` em sequência | > 10/min | Email |
| `retention_user_processing_failed` | qualquer | Email |

Threshold subido conforme o tráfego aumentar.

---

## 5. Custo esperado

Free tier (5k events/mês) cobre tráfego inicial (<100 utilizadores). À
escala, considerar o Team plan (~$26/mês) — ainda longe.

---

## 6. Status

- [ ] Renato cria conta Sentry + dois projetos (frontend, backend) (T-35)
- [ ] Renato fornece DSNs (frontend + backend)
- [ ] Dev integra `@sentry/react` em `main.tsx`
- [ ] Dev integra `@sentry/node` em `functions/src/index.ts`
- [ ] Configurar 4 alertas mínimos no dashboard Sentry
- [ ] Smoke test: induzir um erro propositado e confirmar que chega ao Sentry
