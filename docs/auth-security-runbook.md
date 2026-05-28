# Runbook de Incidentes — Cadastro e Autenticação

Este runbook descreve resposta operacional para incidentes no fluxo de autenticação/cadastro (`Auth` + `registerUserSecure`).

## 1) Escopo e sinais de incidente

Cobertura:
* Registo de utilizadores
* Login
* CAPTCHA/reCAPTCHA
* Rate limiting
* App Check (quando ativo)

Sinais comuns:
* aumento de `RATE_LIMITED`
* aumento de `REGISTER_FAILED`
* falhas de captcha em massa
* queda abrupta de conversão no cadastro
* usuários relatando erro genérico repetido

## 2) Matriz rápida de severidade

* **SEV-1**: indisponibilidade total de cadastro/login em produção
* **SEV-2**: degradação relevante (ex.: captcha a bloquear utilizadores legítimos)
* **SEV-3**: anomalias pontuais (ex.: spikes localizados de rate limit)

## 3) Fontes de diagnóstico

* Logs de Functions (`registerUserSecure`) com `requestId`
* Dashboards de erro (Sentry/Datadog/Cloud Logging)
* Métricas:
  * taxa de sucesso do cadastro
  * distribuição por `details.error`
  * latência p95/p99
* Reclamações de suporte com timestamp + email (mascarado) + screenshot

## 4) Playbooks por cenário

### A) Pico de `RATE_LIMITED`

**Sintoma**
* Muitos bloqueios em curto período.

**Hipóteses**
* ataque automatizado
* janela de rate limit agressiva para tráfego legítimo
* NAT corporativo concentrando IPs

**Ações**
1. Confirmar origem (ASN/IP range, user-agent).
2. Se ataque: manter bloqueio e monitorar.
3. Se falso positivo:
   * ajustar temporariamente janela/tentativas (deploy controlado),
   * validar impacto por segmento.
4. Registar decisão e `requestId` de amostras.

**Rollback**
* reverter parâmetros para baseline após estabilização.

---

### B) `CAPTCHA_REQUIRED` ou falha de captcha em massa

**Sintoma**
* subida de erros de captcha sem mudança de tráfego.

**Hipóteses**
* chave inválida/expirada
* score mínimo alto demais
* bloqueio de script no cliente (CSP/rede)

**Ações**
1. Validar `RECAPTCHA_SECRET_KEY` e `VITE_RECAPTCHA_SITE_KEY`.
2. Confirmar carregamento do script no browser.
3. Reduzir `RECAPTCHA_MIN_SCORE` de forma controlada (ex.: 0.5 -> 0.3) se necessário.
4. Monitorar fraude e taxa de conversão.

**Mitigação temporária**
* se indisponibilidade crítica do provedor, considerar desativar captcha temporariamente (removendo `RECAPTCHA_SECRET_KEY`) com monitorização reforçada.

---

### C) `AUTH_PROVIDER_UNAVAILABLE` / indisponibilidade externa

**Sintoma**
* falhas generalizadas de cadastro/login sem padrão por usuário.

**Ações**
1. Confirmar status do provedor.
2. Comunicar incidente internamente e ao suporte.
3. Ativar banner de status (se disponível) para reduzir tentativas repetidas.
4. Revalidar após recuperação do provedor.

**Pós-incidente**
* analisar janela de erro e impacto em onboarding.

---

### D) Suspeita de enumeração de usuário

**Sintoma**
* tentativas sequenciais por listas de emails.

**Ações**
1. Garantir que UI mantém mensagens genéricas.
2. Revisar logs por padrões automatizados.
3. Endurecer rate limit por origem.
4. Validar se houve vazamento de mensagens técnicas.

## 5) Checklist operacional de resposta

* [ ] Classificar severidade (SEV-1/2/3)
* [ ] Coletar 3-5 `requestId` representativos
* [ ] Identificar erro dominante (`details.error`)
* [ ] Verificar variáveis de ambiente de segurança
* [ ] Aplicar mitigação mínima necessária
* [ ] Monitorar por 30-60 min após mudança
* [ ] Comunicar status para suporte/produto
* [ ] Registrar lições aprendidas

## 6) Comunicação com suporte (template)

**Mensagem interna curta**
> Estamos com instabilidade no cadastro. O problema está identificado no fluxo seguro de autenticação. Já aplicamos mitigação e estamos monitorando. Pedido: recolher `horário`, `email` (parcial) e screenshot do erro para correlação por `requestId`.

## 7) Pós-incidente (hardening)

* revisar thresholds de rate limit
* revisar score mínimo de captcha
* adicionar alerta proativo para desvio de conversão
* expandir testes de caos para provedor externo

