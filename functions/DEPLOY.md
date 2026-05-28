# Funções (Backend)

## O que está incluído

- Trigger `onMailCreated`: envia emails ao criar documentos em `mail/{id}`.
- Callable `testSmtpConnection`: testa a ligação SMTP usando as configurações em `system_settings/smtp`.
- Callable `submitContactForm`: recebe o formulário `/contacto`, envia email via Resend e regista em `contact_messages`.

## Requisitos

- Firebase project configurado e permissões para deploy.
- Secret `RESEND_API_KEY` configurado no projeto:

```bash
firebase functions:secrets:set RESEND_API_KEY
```

## Deploy (Firebase Functions)

1. Instalar Firebase CLI:

```bash
npm i -g firebase-tools
```

2. Fazer login e selecionar projeto:

```bash
firebase login
firebase use --add
```

3. Deploy das funções:

```bash
firebase deploy --only functions
```

