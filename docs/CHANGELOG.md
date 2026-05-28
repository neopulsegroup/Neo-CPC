# Changelog

## 2026-05-27 · Demandas de nível baixo (sprint curta)

- **Triagem (Item 1, parcial):** removidos do fluxo os passos "Preparação Cultural" (6) e "Motivação e Expectativas" (7) inteiros, e a pergunta `arrival_date_pt` do passo "Integração" (8); `legal_status` mantido. Passos "Autonomia" (9) e "Perfil Socioprofissional" (12) **adiados a pedido** (impacto em filtros de idioma/situação laboral por rever). Campos preservados no Firestore; código de leitura a jusante usa optional chaining (não quebra).
- **Atividades (Item 2):** removida a validação que impedia datas passadas (Zod superRefine + atributo `min` do input). Data continua obrigatória e válida.
- **Empresa — vagas (Item 3):** novo campo `required_skills: string[]` em `job_offers`. Input separado por vírgulas com pré-visualização em chips no editor; exibido no detalhe da vaga (lado migrante em JobDetailPage; lado empresa no editor). Vagas antigas sem o campo tratadas como lista vazia.
- **Empresa — candidato (Item 4):** removido o botão "Usar CV de demonstração" de CandidateProfilePage e o import órfão de Button.
- **Empresa — candidaturas (Item 5):** adicionado filtro por vaga (dropdown com vagas reais da empresa, default "Todas as Vagas") em CompanyApplicationsPage. Filtra `job_applications` por `jobId`; sem fuga de dados entre empresas. Nota: o "Todas as Vagas" mencionado pelo João existia em CandidatesPage (bolsa de talento) onde não filtrava nada — implementado no hub de candidaturas reais por decisão.
- **Agenda (Item 6):** slots de agendamento passam a 30 em 30 minutos (gerador 09:00–17:00) em BookingSessionWizardDialog. Verificação de disponibilidade (stub determinístico) aplicada por slot.
- Sem renomeação de campos Firestore. Testes 178/178; build limpo.

## 2026-05-27 · PT como fonte única de tradução

Decisão arquitetural: o texto PT (do CMS ou do JSON `pt.json`) passa a ser a fonte única.
EN/ES/FR são sempre derivados por tradução automática client-side via Translator API.
Os JSONs `en.json`/`es.json`/`fr.json` deixam de ser consumidos em runtime; mantêm-se
no repositório como backup/fallback histórico.

Motivação: eliminar incoerência entre traduções antigas dos JSONs (feitas em momentos
distintos) e o texto editado pela equipa CPC no CMS. Garantir que editar um texto PT
propaga para todos os idiomas de forma consistente.

Implementação:
- Novo `src/features/cms/translatorSyncCache.ts` — cache síncrono em memória + fila
  de pedidos + sistema de listeners para forçar re-render quando uma tradução chega.
- `LanguageContext.tsx` reescrito: `t.get(path)` e o proxy `t.foo.bar` resolvem sempre
  contra o PT base (override `i18n_overrides.pt` → `pt.json`) e depois pedem tradução
  ao sync cache. Quando uma tradução nova chega ao cache, `translationVersion` incrementa
  e o React re-renderiza.
- Pré-carregamento em batch: ao trocar para um idioma não-PT, dispara `scheduleTranslation`
  para todas as chaves do `pt.json` e todos os `ptOverrides`, em paralelo.
- `usePageContent.ts` alinhado: usa o mesmo `translatorSyncCache` partilhado em vez de
  manter cache próprio. Quando há override.pt no CMS, traduz através do sync cache; sem
  override, delega ao `t.get`.

Testes:
- `usePageContent.test.tsx` actualizado para a nova lógica (11 testes).
- Novo `translatorSyncCache.test.ts` com 7 testes (cache hit/miss, idempotência,
  notificações, unsubscribe, limpeza).
- Novo `LanguageContext.test.tsx` com 6 testes (PT directo, EN cacheado, EN sem cache,
  re-render quando cache muda, fallback sem suporte, chave inexistente).

Limitação conhecida:
- Em navegadores sem suporte do Translator API (Firefox, Safari), todo o texto cai
  em PT — fallback gracioso.
- Primeira visita a um idioma não-PT pode demorar 10-20s para todas as ~1500 chaves
  serem traduzidas. Cache persistente em `localStorage` amortiza a partir daí.
- Qualidade da tradução depende do modelo on-device do Chrome (similar ao Google
  Translate). Para textos críticos, a Beatriz pode sobrepor com override manual no
  CMS no idioma específico (override directo tem prioridade sobre a tradução
  automática).

Validação manual:
- Chrome 148, override CMS `hero.title = "Bem-vindos ao Algarve, terra de oportunidades"`.
- EN: "Welcome to the Algarve, land of opportunities"
- ES: "Bienvenidos al Algarve, Tierra de Oportunidades"
- FR: "Bienvenue à l'Algarve, terre d'opportunités"
- Todas as 4 superfícies (Header, Hero, Process, Features, CTA) coerentes em cada
  idioma. 1447 entradas cacheadas em `localStorage` por idioma alvo.

Reversibilidade: para reverter, voltar `LanguageContext.tsx` ao estado anterior
(que lia `translations[language]` directamente do JSON). Os JSONs por idioma
continuam intactos no repositório.

## 2026-05-27 · CMS com Tradução Automática Client-Side

- Novo serviço `src/features/cms/translatorService.ts` expõe `isTranslatorSupported()`, `translateText(text, source, target)` e `clearTranslationCache()`. Usa a Translator API nativa do navegador (Chrome/Edge 138+).
- `usePageContent` integra o serviço: quando o idioma corrente não é PT e não há override manual nesse idioma, tenta traduzir o override PT em runtime. Cache em `localStorage` (prefixo `cpc.translation.cache.v1.`).
- Em navegadores sem suporte (Firefox, Safari), o fallback é o JSON estático i18n (comportamento da v1.4).
- `ContentEditorForm` invalida o cache de traduções após cada save bem-sucedido (texto PT mudou → traduções antigas obsoletas).
- Aviso visual no editor actualizado para explicar a tradução automática.
- Suite expandida para 10 testes (eram 7): adicionados 3 cenários (tradução automática activa, sem suporte, override manual tem prioridade sobre tradução).
- Sem dependência de API externa. Sem chave. Sem custo.

## 2026-05-27 · Coerência CMS e Documentação

- `processSteps` da Home estendido aos 3 passos no padrão CMS (`src/pages/Index.tsx:28-37`). Passos 2 e 3 deixam de usar `t.process.stepN.*` directo e passam a chamar `content('process.stepN.title|description', ...)` como o passo 1.
- Verificado que as 6 chaves `process.step{1,2,3}.{title,description}` já existem em `src/features/cms/pageSchemas.ts:35-40`. Sem alteração necessária ao schema.
- D11 em `docs/CLIENT_DECISIONS.md` alinhado com o estado real (ficheiro `src/locales/kea.json` não existe; texto anterior afirmava que tinha sido criado).
- Investigação documentada sobre o relato "tradução parou de funcionar": ver Bloco 9 abaixo. Suspeita principal: cache stale do `LanguageContext` (`cpc-i18n-overrides-{lang}-v{version}` em `localStorage`) e/ou fallback `ptOverrides` que ainda existe no `LanguageContext.tsx:76,202` (sistema paralelo `i18n_overrides`, não o CMS `page_content`).

## 2026-05-27 · Correção CMS v1.4 · Fallback de tradução

- Lógica de fallback em `usePageContent.ts` simplificada e corrigida: `content(fieldKey, i18nKey)` devolve sempre `t.get(i18nKey)` quando o override no idioma corrente está em falta ou vazio.
- `override.pt` deixa de ser usado como fallback para outros idiomas — EN/ES/FR/kea passam a cair no JSON quando não há override no idioma activo.
- Suite `usePageContent.test.tsx` expandida para 7 testes cobrindo PT, EN (3 cenários incluindo regressão crítica e whitespace), ES e FR.
- Sem alterações nas 4 páginas públicas (`Index`, `About`, `HowItWorks`, `Contact`): todas já chamam `content(key, i18nKey)` com 2 argumentos.

**Nota de adaptação:** o projecto não usa `react-i18next` (tem `LanguageContext` custom com `t.get(key)`). Os mocks dos testes foram adaptados para mockar `@/contexts/LanguageContext` em vez de `react-i18next`, mantendo a mesma cobertura de cenários.

## 2026-05-27 · Demandas operacionais 4.1, 5.1.1, 5.1.2

### Renomeação Triagem → Situação Inicial
- Strings actualizadas em 4 locales (pt, en, es, fr).
- Strings literais em `ProfilePage` (export PDF, toasts) e templates de email do migrante.
- Stage de candidatura `"Em Triagem" → "Em Análise"` (PT) / `"In review"` (EN) / `"En revisión"` (ES) / `"En examen"` (FR) para evitar o termo em todos os contextos visíveis.
- Sem alterações em rotas, coleções Firestore (`triage`, `triage_completed`), nomes de ficheiros, componentes ou identificadores técnicos.

### Ordenação de Migrantes por data de registo
- Adicionadas 4 opções no dropdown de ordenação em `MigrantsAdminPage`: data (mais recente / mais antigo) e nome (A–Z / Z–A).
- Default: **Data de registo (mais recente)**.
- Persistência da escolha via `localStorage` (`cpc.migrants.sort`).
- Migrantes sem `createdAt` aparecem no fim da lista (tratamento defensivo, sem erro).
- Lógica extraída para `sortMigrants.ts` com suite de testes unitários (16 testes).

### Reorganização do menu do Migrante
- Quadro "Documentos & Configurações" removido do `ProfilePage` do migrante.
- **Currículo** movido para "Perfil Profissional".
- **Idioma de Contacto** (label renomeado de "Idioma de Interface") e **Preferência de Contacto** movidos para "Informação Pessoal".
- Nome técnico do campo no Firestore mantido (apenas alteração visual do label).
- Funcionalidades existentes (editar idioma, preferência, CV) inalteradas.
