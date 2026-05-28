# CPC — Cloud Functions

Funções server-side em Firebase Functions (Node 20). Cada função vive num
ficheiro próprio em `src/`, é exportada no `src/index.ts` e implantada
junto com o resto do projeto.

## Estrutura

```
functions/
├── src/
│   ├── index.ts                       # Exporta todas as CFs implantadas
│   ├── admin.ts                       # Singleton firebase-admin + getFirestore()
│   ├── permissions.ts                 # isAdminUser(uid)
│   ├── smtp.ts                        # Wrapper SMTP (nodemailer)
│   ├── mailProcessor.ts               # Consome fila `mail/` (onMailCreated)
│   ├── registerUserSecure.ts          # Callable: registo seguro server-side
│   ├── contactResend.ts               # Callable: formulário público de contactos
│   │
│   ├── emailTemplates.ts              # TASK-08: 6 templates × 4 idiomas
│   ├── notificationHelpers.ts         # TASK-08: helpers partilhados
│   ├── onMigrantCreated.ts            # TASK-08: trigger welcome migrante
│   ├── onCompanyCreated.ts            # TASK-08: trigger welcome empresa
│   ├── onApplicationCreated.ts        # TASK-08: notifica empresa
│   ├── onApplicationStatusChanged.ts  # TASK-08: notifica migrante
│   ├── onJobOfferCreated.ts           # TASK-08: notifica moderadores CPC
│   ├── sessionDateHelpers.ts          # TASK-07: parse scheduled_date+time → UTC
│   ├── onSessionCreated.ts            # TASK-07: confirmação + flags reminder
│   └── scheduledReminders.ts          # TASK-07: cron 15min lembretes 24h/1h
└── package.json
```

## Build + deploy

```bash
cd functions
npm install
npm run build      # tsc → lib/
firebase deploy --only functions
```

## Triggers de notificação por email (TASK-08)

Padrão comum a todos os triggers de notificação:

1. **Leem o doc do trigger** (`event.data?.data()`).
2. **Filtram condições** específicas (ex.: `role === 'migrant'`,
   `status === 'pending_review'`).
3. **Verificam opt-out** (`profile.email_notifications_enabled !== false`).
4. **Resolvem destinatário** (`resolveRecipient(uid)`) → `{to, locale}`.
5. **Resolvem template** (`renderTemplate(name, locale, vars)`).
6. **Enfileiram em `mail/{auto-id}`** via `enqueueEmail()`.
7. O `onMailCreated` (já existente) consome a fila e envia via SMTP.

Falhas de envio **não bloqueiam** a operação principal — `enqueueEmail()`
captura erros e regista via `logger.error` com chaves estruturadas para
busca em produção.

### Tabela de triggers

| Trigger | Collection | Condição | Template | Destinatário(s) | Tag |
|---|---|---|---|---|---|
| `onMigrantCreated` | `profiles/{uid}` create | `role === 'migrant'` | `welcomeMigrant` | Migrante (profiles.email) | `welcome-migrant` |
| `onCompanyCreated` | `companies/{uid}` create | (sempre) | `welcomeCompany` | Empresa (profiles ou users.email) | `welcome-company` |
| `onApplicationCreated` | `job_applications/{appId}` create | (sempre) | `newApplication` | Empresa dona da oferta | `new-application` |
| `onApplicationStatusChanged` | `job_applications/{appId}` update | status → `accepted` OR `rejected` | `applicationAccepted` ou `applicationRejected` | Migrante candidato | `application-accepted` ou `application-rejected` |
| `onJobOfferCreated` | `job_offers/{offerId}` create | `status === 'pending_review'` | `jobOfferPendingReview` | Todos os moderadores CPC | `job-offer-pending-review` |

### Templates e locale

- 5 templates têm variantes PT/EN/ES/FR (welcome migrant/company, new
  application, application accepted/rejected).
- `jobOfferPendingReview` tem PT/EN apenas (público interno CIBEA).
- `renderTemplate()` faz fallback para PT quando a locale pedida não existe.
- A locale é lida de `profiles/{uid}.language` ou `.preferred_language`;
  default PT.

### Opt-out

Os destinatários podem desativar emails gravando
`profiles/{uid}.email_notifications_enabled: false`. As 5 CFs respeitam
esta flag via `resolveRecipient()`.

Não há migration necessária: o default (campo ausente = enviar) é o
comportamento esperado para utilizadores existentes.

### Identificação de moderadores CPC

`listCpcModerators()` (em `notificationHelpers.ts`) faz scan da collection
`users` e devolve os que têm `role` em:

```
admin, administrador, manager, coordinator,
cpc, team, staff, equipa
```

Para o universo da CPC (~dezenas de membros) o scan é aceitável; quando
escalar, considerar índice composto ou cache.

### Log keys estruturados

Para procurar facilmente nos logs de produção:

| Key | Quando |
|---|---|
| `notification_enqueued` | Email entrou na fila |
| `notification_enqueue_failed` | Falha ao montar/enfileirar |
| `notification_skipped_opted_out` | Destinatário com opt-out |
| `notification_skipped_no_email` | Sem email válido |
| `mail_sent` (audit_logs) | SMTP enviou com sucesso |
| `mail_send_error` (audit_logs) | SMTP falhou |

## Lembretes de sessão (TASK-07)

### Triggers

| Trigger | Tipo | Disparo | Ação |
|---|---|---|---|
| `onSessionCreated` | `onDocumentCreated('sessions/{id}')` | Nova sessão criada | Envia confirmação (email + in-app) ao migrante e ao profissional; marca a sessão com `reminder_24h_pending=true` e `reminder_1h_pending=true` |
| `scheduledReminders` | `onSchedule('every 15 minutes', tz='Europe/Lisbon')` | Cron Cloud Scheduler | Processa sessões com flag pendente; envia lembrete (email + in-app) se a sessão cair na janela; desliga a flag (idempotente) |

### Janelas de lembrete

| Tipo | Janela (offset do "agora") | Largura |
|---|---|---|
| 24h | `[now+23h, now+25h]` | 2h |
| 1h | `[now+45min, now+75min]` | 30min |

Janelas largas garantem que cada sessão é apanhada pelo menos uma vez,
mesmo com latência ou execuções saltadas do cron.

### Conversão data/hora → UTC

`sessions.scheduled_date` (YYYY-MM-DD) + `sessions.scheduled_time` (HH:MM)
são interpretados como **hora local de Europe/Lisbon** (alinhado com
`src/lib/appCalendar.ts` `APP_TIME_ZONE`). Portugal tem DST, por isso
`sessionDateHelpers.ts` usa `Intl.DateTimeFormat` para descobrir o offset
correto a cada momento (UTC+0 inverno / UTC+1 verão).

### Tipos de notificação in-app

A collection `notifications/{id}` recebe novos tipos:

| Type | Quando | Destinatários | Href |
|---|---|---|---|
| `session_scheduled` | onSessionCreated | migrante + staff | `/dashboard/migrante/sessoes` ou `/dashboard/cpc/agenda` |
| `session_reminder_24h` | cron janela 24h | migrante + staff | idem |
| `session_reminder_1h` | cron janela 1h | migrante + staff | idem |

### Idempotência

Cada flag (`reminder_24h_pending` / `reminder_1h_pending`) é desligada
após envio. Sessões no passado (já passaram da janela) também têm flag
desligada para evitar processamento repetido em loops futuros.

### Deploy do Cloud Scheduler

`onSchedule` cria automaticamente o job no Cloud Scheduler ao implantar:

```bash
firebase deploy --only functions:scheduledReminders
```

Verificar no Console:
- Cloud Scheduler → `firebase-schedule-scheduledReminders-us-central1`
- Quota gratuita do Spark plan: **3 jobs grátis**. Este é o único job
  agendado novo; resta margem para outros 2.

Se quiseres testar manualmente, podes invocar via Cloud Scheduler:
```bash
gcloud scheduler jobs run firebase-schedule-scheduledReminders-us-central1 \
  --location=us-central1
```

## Decisões pendentes

| ID | Pergunta | Estado |
|---|---|---|
| D10 | URL base da app está hardcoded para `https://www.portalcpc.com` em `emailTemplates.ts`. Quando houver staging próprio, extrair para env var. | aberto |
| D11 (novo) | Lembretes de 24h e 1h chegam sempre — sem botão "desativar lembretes desta sessão" no UI. Aceitável para v1? Útil para "Marquei mas afinal não posso ir" sem ter de cancelar a sessão. | aberto |
| D7 / D8 | Ver `docs/CLIENT_DECISIONS.md` | aberto |
