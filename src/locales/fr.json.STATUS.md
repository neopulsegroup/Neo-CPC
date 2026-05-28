# Estado do `fr.json`

> JSON não suporta comentários, por isso este marker fica em ficheiro
> separado. Atualizar quando o estado mudar.

**Última atualização:** 2026-05-26 (após criação do `scripts/translate-locale.mjs`)

## Estado atual

⚠️ **Tradução automática pendente — atualmente ~1374 strings ainda iguais ao EN.**

O ficheiro `fr.json` tem a **estrutura correta** (passa `src/lib/i18n.integrity.test.ts`)
mas o **conteúdo** de muitas chaves está em inglês porque o script
offline anterior (`scripts/offline-locale-fill.mjs`) não cobriu todo o
vocabulário.

## Próximo passo

1. Obter `DEEPL_API_KEY` (free tier — 500k chars/mês — chega à larga).
2. Correr:
   ```bash
   node scripts/translate-locale.mjs --dry-run    # confirmar plano
   node scripts/translate-locale.mjs              # executar tradução
   ```
3. Revisão humana das traduções — DeepL é base inicial, não produto final.
   Ver checklist em `docs/I18N.md`.

## Histórico

- **2026-05-26** — Estado documentado. Script DeepL criado e validado em
  dry-run (1374 strings, ~31k chars). API key ainda não disponível;
  tradução em espera.
- **Anterior** — `fr.json` gerado por `scripts/offline-locale-fill.mjs`
  (sufixos românicos + dicionário pequeno); cobriu uma fração das strings
  e deixou o resto idêntico ao EN.
