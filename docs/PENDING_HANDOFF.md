# Pendências para Handoff · CPC

> **Última actualização:** 2026-06-15 · Bloco 6 final.
>
> Tudo aqui é trabalho que **depende de pessoas fora do escopo deste
> contrato** (Silva, Renato, CIBEA, tradução, decisões CIBEA).
> O código está pronto. Falta acção humana.

---

## A · Acções de consola (Silva)

| ID | Acção | Quando | Doc de referência |
|---|---|---|---|
| H-A1 | Criar **reCAPTCHA v3 keys** no Google Cloud Console (site key + secret) | Antes do 1º deploy | `docs/SETUP_SECRETS.md` §3 |
| H-A2 | Activar **App Check** no Firebase Console (modo Monitor inicialmente) | Antes do 1º deploy | `docs/SETUP_SECRETS.md` §3 |
| H-A3 | Criar **RESEND API key** e configurar via `firebase functions:secrets:set RESEND_API_KEY` | Antes do 1º deploy | `DEPLOY.md` §2.2 |
| H-A4 | Configurar `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`, `ENFORCE_APPCHECK` em Functions secrets | Antes do 1º deploy | `DEPLOY.md` §2.2 |
| H-A5 | **Deploy** `firestore.rules` + `functions` + `firestore.indexes` + `storage.rules` | Após secrets | `DEPLOY.md` §4 |
| H-A6 | Verificar **Cloud Scheduler** jobs criados (`scheduledReminders`, `retentionCleanup`) | Após primeiro `firebase deploy --only functions` | `DEPLOY.md` §6.2 |
| H-A7 | **Personalizar template** Firebase Auth → Email verification (cor, sender name, idioma) | Após deploy | Firebase Console → Auth → Templates |
| H-A8 | Criar **bucket GCS** `gs://cpc-projeto-app-backups` (europe-west1) + IAM + lifecycle 30d | Antes do 1º backup automático | `docs/BACKUP.md` §3 |
| H-A9 | Promover **App Check** de Monitor → Enforce | ~1 semana depois com logs OK | `docs/SETUP_SECRETS.md` §3 |
| H-A10 | Verificar **`storage-cors.json`** aplicado: `gsutil cors set storage-cors.json gs://cpc-projeto-app.firebasestorage.app` | Antes do 1º upload de CV/foto | `DEPLOY.md` §6.1 |

---

## B · Acções DNS (Renato)

| ID | Acção | Quando | Doc |
|---|---|---|---|
| H-B1 | **SPF** (`v=spf1 include:_spf.resend.com ~all`) em portalcpc.com | Antes do 1º email em produção | `docs/EMAIL_DNS.md` §2 |
| H-B2 | **DKIM** — 3 CNAMEs gerados pelo painel RESEND | Após adicionar domínio em resend.com/domains | `docs/EMAIL_DNS.md` §2 |
| H-B3 | **DMARC** (`v=DMARC1; p=quarantine; rua=mailto:dmarc@portalcpc.com`) | Após SPF+DKIM | `docs/EMAIL_DNS.md` §2 |
| H-B4 | **A/CNAME para Vercel** apontar `portalcpc.com` e `www.portalcpc.com` | Antes do go-live | `DEPLOY.md` §6.3 |
| H-B5 | Verificar **`mail-tester.com > 9/10`** | Após B1-B3 propagarem | `docs/EMAIL_DNS.md` §3 |

---

## C · Acções de conta externa (Renato)

| ID | Acção | Quando | Doc |
|---|---|---|---|
| H-C1 | Criar conta **Sentry** + 2 projetos (frontend, backend) + obter DSNs | Quando quiser monitorização | `docs/MONITORING.md` §3 |
| H-C2 | Fornecer DSNs ao dev para integração de SDK | Após criação dos projetos | idem |
| H-C3 | Configurar `GCP_SA_KEY` (preferido) ou `FIREBASE_TOKEN` em GitHub repo Settings → Secrets and variables → Actions | Quando quiser CI/CD automático | `.github/workflows/deploy.yml` |
| H-C4 | Criar **2º projeto Firebase** (`cpc-projeto-staging`) + Vercel staging | Quando quiser ambiente de QA | `docs/STAGING.md` |

---

## D · Rotação de secrets (Renato anual)

| ID | Acção | Quando | Doc |
|---|---|---|---|
| H-D1 | Rotação `RESEND_API_KEY` | 2027-06 | `docs/SECRETS_ROTATION.md` |
| H-D2 | Rotação `RECAPTCHA_SECRET_KEY` | 2027-06 | idem |
| H-D3 | Rotação `GCP_SA_KEY` (se CI/CD activo) | 12 meses após H-C3 | idem |

---

## E · Decisões CIBEA (Silva intermediar)

| ID | Pergunta | Origem |
|---|---|---|
| H-E1 (D2) | Nota mínima para passar quizzes (default 70%) | TASK-CR / `docs/CLIENT_DECISIONS.md` |
| H-E2 (D7) | Lista oficial de áreas de atividade da empresa | TASK-05 / `Auth.tsx:19` |
| H-E3 (D8) | Ano mínimo de registo aceitável no Select de "Ano de Registo" | TASK-FR / `ProfilePage.tsx:79` |
| H-E4 (D9) | Re-moderação de edits em ofertas `active` (forçar `pending_review`)? | TASK-VAL E5 / `docs/FEATURES.md` |
| H-E5 (D10) | URL base da app por env var (para staging) ou hardcoded? | `functions/src/emailTemplates.ts:45` |
| H-E6 (D11) | Variante de Crioulo + tradutor humano | TASK-FR / `docs/I18N.md` |
| H-E7 (D12) | **Logos EMPIS finais** (PNGs com brand cliente) | TASK-43 / `public/branding/` |

---

## F · Tradução (decisão diferida)

| ID | Acção | Quando | Status |
|---|---|---|---|
| H-F1 | Decidir entre DeepL API ou tradutor humano (T-22) | Quando arrancar Bloco de tradução | Adiado |
| H-F2 | Executar tradução completa FR (T-05) | Após H-F1 | Adiado |
| H-F3 | Executar tradução Kriolu (T-06) — só humana (CIBEA) | Após H-E6 | Adiado |

---

## G · Pequenos warnings (dev futuros)

| ID | Acção | Prioridade | Doc |
|---|---|---|---|
| H-G1 | Reduzir lint warnings restantes (29 → < 20) | baixa | `eslint.config.js` |
| H-G2 | Adicionar `secret-scan` job no CI | média | `docs/SECURITY_AUDIT.md` §7 |
| H-G3 | Extrair `APP_BASE_URL` de `emailTemplates.ts:45` para env var | quando staging existir | depends H-E5 |

---

## Resumo por responsável

| Pessoa | Itens |
|---|---|
| **Silva** | H-A1 a H-A10 (consola Firebase/Vercel), H-E1 a H-E7 (intermediar CIBEA) |
| **Renato** | H-B1 a H-B5 (DNS), H-C1 a H-C4 (contas), H-D1 a H-D3 (rotação anual) |
| **CIBEA** | responder H-E1 a H-E7 |
| **Dev futuro** | H-G1 a H-G3 (polish opcional), executar H-C2 quando DSN chegar |

---

> **Esta lista é a fonte da verdade** para handoff. Qualquer item executado
> deve ser tachado aqui em PR separado para manter histórico.
