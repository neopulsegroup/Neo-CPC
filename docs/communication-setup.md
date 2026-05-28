# Comunicação (stack final SaaS)

## Arquitetura alvo

| Área | Tecnologia |
|---|---|
| Auth | Firebase Auth |
| Reset de senha | Firebase Auth nativo (`sendPasswordResetEmail`) |
| Emails transacionais (contato) | Resend |
| Backend | Firebase Functions |
| Banco | Firestore |

## Fluxos

1. **Esqueceu senha**  
   Frontend chama Firebase Auth e o email de recuperação é enviado pelo template nativo do Firebase.

2. **/contacto**  
   Frontend chama callable `submitContactForm` -> Function envia via Resend -> grava log em `contact_messages`.

## Configuração obrigatória (externa)

### 1) Resend API key (Functions)

```bash
firebase functions:secrets:set RESEND_API_KEY
```

### 2) Email remetente no Resend

- Verifique o domínio `portalcpc.com` no Resend.
- Configure SPF/DKIM no DNS.
- Defina o remetente em variável de ambiente das Functions (`RESEND_FROM_EMAIL`), por exemplo:
  `Portal CPC <geral@portalcpc.com>`.

> Se não definir, o fallback do código é `onboarding@resend.dev`.

### 3) Email destino do formulário de contacto

No Firestore, documento:

- `system_settings/contact.notificationEmail = "geral@portalcpc.com"`

## Deploy

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions:submitContactForm
```

## Desenvolvimento local

### Frontend

```bash
npm run dev
```

### Emulador de functions (opcional)

```bash
npm run emulators:start
```

`.env.local`:

```bash
VITE_FUNCTIONS_EMULATOR=true
VITE_FUNCTIONS_EMULATOR_HOST=127.0.0.1
VITE_FUNCTIONS_EMULATOR_PORT=5001
```

## Segurança

- Não versionar `RESEND_API_KEY`.
- Limitar CORS das callables aos domínios oficiais.
- Validar `name/email/message` na function (já implementado).
