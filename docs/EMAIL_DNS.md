# Configuração DNS para Email · portalcpc.com

> **Status:** PENDENTE · Renato
> **Bloco:** Bloco 6 · T-33
> **Quem executa:** quem gere o DNS de `portalcpc.com`

---

## 1. Contexto

Emails do CPC são enviados via **RESEND** a partir de
`geral@portalcpc.com` (override possível via `RESEND_FROM_EMAIL`,
ver `functions/.env.example`).

Sem registos DNS de autenticação (SPF, DKIM, DMARC):
- Caixa de spam é o destino mais provável.
- Provider corporativo (Outlook/Gmail Workspace) pode rejeitar.
- Score em `mail-tester.com` cai abaixo de 5/10.

---

## 2. Registos necessários

### SPF
```
Tipo:   TXT
Host:   @            (ou portalcpc.com, conforme o painel DNS)
Valor:  v=spf1 include:_spf.resend.com ~all
TTL:    3600 (1h)
```

### DKIM
RESEND gera **3 CNAMEs DKIM** ao verificar o domínio (não copiamos um valor fixo).

1. Aceder a https://resend.com/domains
2. Adicionar `portalcpc.com`
3. Copiar os 3 CNAMEs que o RESEND mostra (tipo `resend._domainkey.portalcpc.com → ...`)
4. Adicionar no DNS provider

### DMARC
```
Tipo:   TXT
Host:   _dmarc
Valor:  v=DMARC1; p=quarantine; rua=mailto:dmarc@portalcpc.com; pct=100
TTL:    3600
```

> `p=quarantine` é o intermediário sensato: emails não-autenticados vão para
> spam (não rejeitados). Começar mais relaxado (`p=none`) só se quiseres uma
> fase de observação antes; promover para `p=reject` depois de 30 dias sem
> incidentes.

---

## 3. Verificação

### Painel RESEND
- Resend dashboard → Domains → portalcpc.com → estado deve ficar **"Verified"**.
- Tempo típico: 1-24h consoante o TTL anterior.

### mail-tester.com
1. Enviar email de teste do CPC (por exemplo via `/contacto`) para
   o endereço único que o `mail-tester.com` fornece.
2. Verificar o score.
3. **Target: > 9/10.**

### Comandos rápidos (Linux/Mac)
```bash
dig TXT portalcpc.com           # confirma SPF
dig CNAME resend._domainkey.portalcpc.com   # confirma DKIM (substituir o subdomínio que o RESEND der)
dig TXT _dmarc.portalcpc.com    # confirma DMARC
```

---

## 4. Estado

- [ ] SPF adicionado (Renato)
- [ ] DKIM verificado no painel RESEND (Renato)
- [ ] DMARC adicionado (Renato)
- [ ] `mail-tester.com` > 9/10 (Renato)
- [ ] Smoke test em produção: registo → email de verificação chega à caixa principal (Silva)

---

## 5. Notas

- Se o domínio mudar para subdomínio dedicado (ex. `mail.portalcpc.com`),
  todo este processo repete-se nesse subdomínio.
- DMARC em `p=reject` corta drasticamente phishing — recomendado após
  estabilizar.
- `aspmx.googlemail.com` ou outro MX da Workspace é **independente** disto
  — DKIM/SPF aqui é só sobre **emails saídos via RESEND**.
