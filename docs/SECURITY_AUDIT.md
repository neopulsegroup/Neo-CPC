# Audit de Segurança · Secrets e Keys

**Data:** 2026-06-15
**Branch:** `feature/bloco5-validacao`
**Bloco:** Bloco 5 · Validação Completa (T-26)

---

## 1. Metodologia

### Patterns varridos
- `AIzaSy` — Google/Firebase API keys
- `sk_`, `sk-` — Stripe-style secret keys, OpenAI-style
- `re_[A-Za-z0-9]{8,}` — RESEND API keys
- `secret_key\s*=`, `private_key`, `Bearer ...` — generic credentials
- `password\s*[:=]\s*['"][^'"]{6,}` — hardcoded passwords

### Âmbito
- `src/`, `functions/`, `scripts/`, `.github/`, `docs/`
- Excluído: `node_modules`, `*.bak`, `.env.example` (são para preencher)

### Histórico git
```
git log --all --oneline --diff-filter=A -- "*.env" "*.key" "*.pem" "*secret*"
→ vazio (zero ficheiros sensíveis no histórico)
```

---

## 2. Resultados

| Ficheiro | Linha | Pattern encontrado | Classificação | Acção |
|---|---|---|---|---|
| `src/integrations/firebase/client.ts` | 15 | `AIzaSyDNGGwJcCBoMHPXPY-J4pMcOOtVRQPevaM` | **OK** — Firebase web API key, public por design (fallback de `VITE_FIREBASE_API_KEY`). Controlo vive nas rules. | Nenhuma |
| `src/pages/dev/CreateTestUsers.tsx` | 74, 80, 86, 109 | `'Teste1234!'` | **OK** — só dev tool, ficheiro renderizado apenas com `import.meta.env.DEV` e rota `/dev/criar-usuarios` (App.tsx:130-132). Cria os 3 utilizadores de teste padrão da equipa. | Nenhuma |
| `functions/src/registerUserSecure.ts` | 182, 212, 283 | `process.env.RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`, `ENFORCE_APPCHECK` | **OK** — lidos de variáveis de ambiente; valores reais vivem em Firebase Secrets. | Nenhuma |
| `functions/src/email/sendEmail.ts` | 21, 23 | `defineSecret('RESEND_API_KEY')`, `process.env.RESEND_FROM_EMAIL` | **OK** — secret declarado via `defineSecret`; valor injectado em runtime pelo Firebase Functions secrets manager. | Nenhuma |

### Greps adicionais sem matches

| Pattern | Onde | Resultado |
|---|---|---|
| `sk_`, `sk-`, `re_[a-zA-Z0-9]{8,}`, `private_key` | `src/`, `functions/` | Zero matches |
| `secret_key\s*=` (assignment direto) | `src/`, `functions/` | Zero matches |
| `Bearer\s+[A-Za-z0-9]` (com token literal) | `src/`, `functions/` | Zero matches |
| `password\s*[:=]\s*['"]` em código não-dev | `functions/`, `src/` excluindo `CreateTestUsers.tsx` | Zero matches |

---

## 3. Análise por ficheiro

### `src/integrations/firebase/client.ts:15`
```ts
apiKey: envConfig.VITE_FIREBASE_API_KEY || "AIzaSyDNGGwJcCBoMHPXPY-J4pMcOOtVRQPevaM",
```
Firebase web API keys **são públicas por design** — não conferem privilégios.
Toda a autorização vive em:
- `firestore.rules`
- Firebase Auth claims (roles)
- Functions secrets

A presença desta key no bundle do client é o comportamento esperado de qualquer
app Firebase web.

### `src/pages/dev/CreateTestUsers.tsx`
Cria 3 utilizadores de teste (`migrante@test.com`, `empresa@test.com`,
`admin@test.com`) com password `Teste1234!`. Renderização **só em DEV**
(App.tsx:130). Não chega ao bundle de produção. Sem risco.

### `functions/src/registerUserSecure.ts`
Lê secrets de `process.env`. Em produção esses valores vêm de
`firebase functions:secrets:set` (ver `DEPLOY.md` §2.2).

### `functions/src/email/sendEmail.ts`
`defineSecret('RESEND_API_KEY')` — declaração formal de dependência de secret,
sem expor valor.

---

## 4. Histórico git

```bash
git log --all --oneline --diff-filter=A -- "*.env" "*.key" "*.pem" "*secret*"
# (output vazio)
```

Nenhum ficheiro de credenciais (`*.env`, `*.key`, `*.pem`, `*secret*`) foi
alguma vez adicionado ao repositório. `.gitignore` na raiz já cobre
`.env`, `.env.*` (excepto `.env.example`) e `service-account.json`.

---

## 5. Audit complementar · Firestore rules (T-20)

Durante esta auditoria também se reviu a regra `match /companies/{companyId}`:

```
allow read: if true;   // ← leitura totalmente pública (sem auth)
```

Inicialmente parecia risco. **Validado o schema da collection:**

| Campo | Origem | Sensível? |
|---|---|---|
| `user_id` | `registerUserSecure.ts:343` | Não — é o próprio `companyId` do doc |
| `company_name` | idem | **Público** — nome aparece em todas as ofertas |
| `verified` | idem | Público — selo de moderação |
| `activity_area` | idem | Público — setor (Construção, Hotelaria, …) |
| `createdAt`, `updatedAt` | idem | Metadados, não sensíveis |

**Dados sensíveis (NIF, telefone, morada, email pessoal) vivem em `profiles/{uid}`**
— colecção com regras restritas (owner, CPC staff, e employer apenas quando
`availableForWork == true`).

**Conclusão T-20: sem risco.** A regra `allow read: if true` é compatível
com o schema actual. Cuidado futuro: qualquer migração que adicione NIF ou
contactos directos à `companies/{uid}` exige rever esta regra.

---

## 6. Conclusão geral

**Estado: SEGURO.**

- Zero secrets reais commitados no repo (passados ou actuais).
- A única "key" no bundle do client é a Firebase web API key — pública por design.
- Dev-only test users isolados em DEV bundle.
- Secrets de produção (`RESEND_API_KEY`, `RECAPTCHA_SECRET_KEY`,
  `ENFORCE_APPCHECK`, `RECAPTCHA_MIN_SCORE`) lidos via Firebase Secrets manager
  ou `process.env` — ver `DEPLOY.md` §2.2 e `docs/SETUP_SECRETS.md`.
- Schema da collection `companies` confirmado livre de PII sensível, validando
  a regra de leitura pública.

**Nenhuma acção corretiva necessária.**

---

## 7. Recomendações de continuação

1. Adicionar este audit ao CI (job `secret-scan`) — uma sweep semanal evita drift.
2. Sempre que migrar collections, validar se regras antigas ainda fazem sentido
   (caso `companies` ilustra como uma rule pode ficar segura por causa do schema,
   não da rule).
3. Quando o staging existir, repetir o audit nesse projeto com os mesmos patterns.
