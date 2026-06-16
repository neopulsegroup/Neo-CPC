# Política de Rotação de Secrets · CPC

> **Bloco:** Bloco 6 · T-24
> **Responsável:** Renato (com apoio do dev para deploy)

---

## 1. Cadência

**12 meses** para rotação obrigatória. Rotação imediata se houver suspeita
de leak (commit acidental, ex-funcionário com acesso, alerta do provider).

---

## 2. Secrets em uso

| Secret | Onde está guardado | Onde é usado | Provider |
|---|---|---|---|
| `RESEND_API_KEY` | Firebase Functions Secret | `functions/src/email/sendEmail.ts` (todos os emails do sistema) | Resend |
| `RECAPTCHA_SECRET_KEY` | Firebase Functions Secret | `functions/src/registerUserSecure.ts:182` (validação CAPTCHA no registo) | Google reCAPTCHA |
| `RECAPTCHA_MIN_SCORE` | Firebase Functions Secret (config) | `functions/src/registerUserSecure.ts:212` | n/a (valor 0.5 default) |
| `ENFORCE_APPCHECK` | Firebase Functions Secret (config) | `functions/src/registerUserSecure.ts:283` | n/a (flag 'true'/'false') |
| `RESEND_FROM_EMAIL` | Firebase Functions env (opcional) | `functions/src/email/sendEmail.ts:23` | n/a (config) |
| `FIREBASE_TOKEN` ou `GCP_SA_KEY` | GitHub Actions Secrets | `.github/workflows/deploy.yml` | Google Cloud |

> **Chaves Firebase web pública** (`AIzaSy...` em `client.ts:15`) **não são
> secrets** — são identificadores públicos. Não rodam.

---

## 3. Procedimento de rotação

### Por secret (template)

1. **Gerar nova key** no painel do provider.
2. **Configurar no Firebase Secrets:**
   ```bash
   firebase functions:secrets:set NOME_DO_SECRET
   # cola o novo valor quando pedido
   ```
3. **Re-deploy** das functions afectadas:
   ```bash
   firebase deploy --only functions
   ```
4. **Verificar funcionamento:**
   - `RESEND_API_KEY` → smoke test do `/contacto` ou registo (recebe email).
   - `RECAPTCHA_SECRET_KEY` → smoke test do registo (não bloqueia).
   - `GCP_SA_KEY` → re-trigger do workflow `deploy.yml` no GitHub UI.
5. **Revogar a key antiga** no painel do provider.

### Específico GitHub Actions

```
GitHub repo → Settings → Secrets and variables → Actions
→ FIREBASE_TOKEN ou GCP_SA_KEY → Update
```
Não é preciso re-deploy; a próxima run do workflow já usa o novo valor.

---

## 4. Calendário

Última rotação: **n/a** (secrets iniciais ainda nunca rodaram).

| Secret | Última rotação | Próxima rotação | Responsável |
|---|---|---|---|
| `RESEND_API_KEY` | 2026-XX (data inicial) | 2027-06 | Renato |
| `RECAPTCHA_SECRET_KEY` | 2026-XX | 2027-06 | Renato |
| `GCP_SA_KEY` (CI/CD) | n/a (a configurar) | 12 meses após config | Renato |

Renato actualiza este ficheiro após cada rotação. Sugestão: agendar lembrete
no calendário pessoal com 30 dias de antecedência.

---

## 5. Rotação de emergência (suspeita de leak)

1. **Revogar imediatamente** no painel do provider (impede usos novos da key
   antiga).
2. Configurar nova key no Firebase Secrets.
3. Re-deploy.
4. Verificar funcionamento.
5. Verificar logs (`Cloud Logging` para functions, Sentry para errors)
   por usos suspeitos antes da revogação.
6. **Registar incidente** em `docs/INCIDENTS.md` (criar se não existir).

---

## 6. Auditoria

- O audit de segurança em `docs/SECURITY_AUDIT.md` (Bloco 5) confirma
  que nenhum secret está hard-coded no repo.
- A política recomenda repetir esse audit antes de cada rotação para
  garantir que não há regressão.
