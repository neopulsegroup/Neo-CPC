# Changelog

## 2026-05-29 · Sprint C-Item 4 · Áreas de Serviço

### Nova funcionalidade
- **Módulo `serviceAreas`** (`src/features/serviceAreas/serviceAreas.ts`): 3 áreas fixas — **Jurídico** (30 min), **Psicológico** (60 min), **Mediação** (30 min). Cada área tem responsáveis (UIDs + nomes), duração padrão e flag de ativa. Seed automático na coleção `service_areas` quando vazia.
- **Página admin** (`ServiceAreasAdminPage`, rota `/dashboard/cpc/areas-servico`, só admin): atribuir/remover responsáveis (multi-seleção dos consultores via `listConsultants`), definir duração padrão (30/60) e ativar/desativar cada área. Entrada de menu visível só para admin.
- **Integração no agendamento** (`BookingSessionWizardDialog`): os especialistas da etapa 2 deixam de ser dados de demonstração e passam a ser os **responsáveis reais** da área selecionada. Nova prop `initialArea` (salta a etapa 1 e pré-seleciona a área). Área inativa ou sem responsáveis mostra mensagem `serviceAreas.areaUnavailable` e bloqueia a marcação. A sessão criada grava `service_area_id`, `service_area_name`, `duration_minutes` e `consultant_uid` (campos aditivos — sessões antigas continuam válidas).
- **Próximos passos** (`FirstActionsCard`/`MigrantDashboard`): as ações `book-legal`/`book-psychological`/`book-social` abrem o agendamento já na área correta (`legal`/`psychology`/`mediation`).

### Regras Firestore (deploy pelo Silva)
- `firestore.rules`: coleção `service_areas` — **leitura** por qualquer utilizador autenticado (o migrante precisa para agendar); **escrita** só admin. **Deploy pelo Silva** (`firebase deploy --only firestore:rules`).

### i18n
- Chaves `serviceAreas.*` em PT/EN/ES/FR (título, nomes das áreas, duração, responsáveis, estados, ações e mensagem de indisponibilidade).

### Testes
- 5 testes do módulo `serviceAreas` (load ordenado, seed, no-recreate, update, `isAreaBookable`).
- 3 testes do `BookingSessionWizardDialog` (initialArea abre na etapa 2 com responsáveis reais; área sem responsáveis mostra indisponível; confirmação grava `service_area_id`/`duration_minutes`).
- Testes existentes do `SessionsPage` adaptados às novas dependências (mock de `useLanguage` + `getCollection`).
- Suíte completa: **242 testes a passar** (os 2 "errors" residuais são o artefacto pré-existente de `URL.revokeObjectURL` em `ProfilePage`, sem relação com este sprint).

**Decisões confirmadas:** substituir especialistas hardcoded por responsáveis reais; manter a escolha **manual** do responsável (não automática); manter o token `psychology` (alinhado às sessões já gravadas), com a chave de nome `serviceAreas.psychological`.


## 2026-05-28 · Correção Sprint B + Extensão para Migrante

### Correções
- **Bug 1 (CORS):** criado `storage-cors.json` com origens dev + produção. **A aplicar pelo Silva** via `gsutil cors set storage-cors.json gs://cpc-projeto-app.firebasestorage.app` (o agente não tem credenciais gcloud).
- **Bug 2 (useLanguage):** investigado — a ordem de providers em `App.tsx` já está correta (`LanguageProvider` envolve Auth → Tooltip → Router → rotas) e a home carrega com 0 erros num load fresco. O erro reportado é um **artefacto de HMR** do Vite ao editar ficheiros de contexto ao vivo; resolve-se com hard-reload. **Sem alteração de código** (não havia defeito).
- **Bug 3.1 (índices):** adicionados a `firestore.indexes.json` os índices `trails(is_active, category)` e `job_offers(company_id, created_at DESC)`. **Deploy pelo Silva.**
- **Bug 3.2 (regras):** `firestore.rules` — adicionada permissão para o **migrante atualizar o CV da sua própria candidatura** (apenas `migrant_attached_cv_*`). Leitura pela empresa dona da vaga já era permitida via `employerPublisher`/`companyOwnsCompanyId`.

### Nova funcionalidade (Opção C — ambos os pontos de entrada)
- Migrante anexa CV personalizado **no momento da candidatura** (passo opcional após submeter, em `JobDetailPage`) e **na lista "Minhas Candidaturas"** (`MyApplicationsPage`).
- Estados elegíveis para anexar/substituir: `submitted`, `reviewing`, `interview`. Estados finais (`accepted`, `rejected`) bloqueiam o upload mas mostram link se houver CV.
- Gravado em `job_applications/{id}.migrant_attached_cv_url|name|uploaded_at`.
- Vista da empresa (`JobApplicationsPage`) mostra até **3 CVs**: do perfil do candidato, anexado pelo migrante para a vaga, e anexado pela empresa.
- Reutiliza 100% a infra da Sprint B (`CVUploadButton`, `uploadCvFile`, audit em `cv_uploads_audit`).
- i18n `jobApply.*`, `myApplications.*`, `applicationDetail.*` em PT/EN/ES/FR.
- 7 testes novos (1 uploadCvFile migrante + 3 MyApplicationsPage + 3 JobApplicationsPage).

### Pendências de infraestrutura (Silva)
1. `gsutil cors set storage-cors.json gs://cpc-projeto-app.firebasestorage.app`
2. `firebase deploy --only firestore:rules,storage:rules,firestore:indexes`
3. Aguardar 5-10 min (construção de índices) e fazer smoke test.

**Nota:** os estados reais da candidatura são `submitted | reviewing | interview | accepted | rejected` (não `in_review`/`under_review`/`withdrawn`/`closed` do prompt); campos reais `applicant_id`/`job_id` (não `migrant_uid`/`job_offer_id`). Adaptado em conformidade.


## 2026-05-28 · Sprint B · Empresa: importar CV com seletor de arquivo

- **Cenário implementado: A2** — a empresa anexa um CV externo (PDF/DOC/DOCX, máx. 5 MB) a uma candidatura, **complementando** (não substituindo) o CV do próprio migrante.
- `CVUploadButton` (`src/features/cv/CVUploadButton.tsx`) — seletor de ficheiro com validação client-side (tipo + tamanho), estados de loading, link "Ver CV carregado" e remoção. Totalmente i18n.
- `uploadCvFile` (`src/features/cv/uploadCvFile.ts`) — upload para Firebase Storage (`cv_uploads/{contextType}/{contextId}/...`) + **audit trail** em `cv_uploads_audit` (conformidade RGPD básica). Validação também server-side-ish via `validateCvFile`.
- Integração em `JobApplicationsPage` (painel de detalhe da candidatura): mostra o CV do candidato (quando existe) E o upload do CV anexado pela empresa, gravado em `job_applications/{id}.company_attached_cv_url`.
- Regras de segurança: `firestore.rules` (`cv_uploads_audit`: leitura por uploader/CPC, criação só pelo próprio, sem update/delete) e `storage.rules` (`cv_uploads/...`: leitura autenticada, escrita com limite 5 MB e tipos PDF/DOC/DOCX).
- i18n `cvUpload.*` + `company.applications.details.{candidateCv,attachedCv,viewCandidateCv,noCandidateCv}` em PT/EN/ES/FR.
- 11 testes unitários novos (5 uploadCvFile + 6 CVUploadButton).

**Por fazer (requer a tua ação):** deploy das regras (`firebase deploy --only firestore:rules,storage:rules`) — **não foi feito** porque afeta produção e a autenticação Firebase deste ambiente não tem acesso de admin ao projeto. Sem o deploy, o upload real falha em produção até as regras subirem.


## 2026-05-28 · Sprint A · Triagem Inteligente

- **Perfil de Necessidades** gerado automaticamente a partir da Situação Inicial (`inferNeedsProfile.ts`)
  - 6 categorias: jurídico, habitação, emprego, linguístico, psicológico, social
  - Prioridades alta/média; ordenado por prioridade; `hasUrgentNeeds` para destaque
  - `NeedsProfileCard` no topo do dashboard do migrante (quando há necessidade urgente) e no perfil pela equipa CPC (ProfilePage, vista de outro utilizador)
- **Recomendação de primeiras ações** por regras leves (`firstActions.ts`)
  - Até 5 ações priorizadas (urgent / recommended / suggested)
  - Ações de "marcar sessão" abrem o `BookingSessionWizardDialog` no dashboard; restantes navegam para rotas reais (`/triagem`, `/dashboard/migrante/trilhas|curriculo|emprego`)
  - `FirstActionsCard` no topo do dashboard; migrante sem triagem vê só "Completar Situação Inicial"
- Chaves i18n `needs.*` e `firstActions.*` em PT/EN/ES/FR (traduções manuais)
- 23 testes unitários novos (13 needs + 10 firstActions)
- **Versão conceitual:** sem SCAS-R, scores numéricos validados ou fórmulas psicométricas

**Nota de adaptação:** a estrutura real da Situação Inicial diverge da assumida no prompt (coleção `triage/{uid}`, não `users.triage_responses`; tokens em inglês: `not_regularized`/`unemployed_seeking`/`homeless`/`none`; sem `urgent_help` — usa `urgencies` derivado de `identified_needs`/`desired_support`; conclusão via `triage.completed`; CV em `profiles.resumeUrl`; agendamento é diálogo, não rota). As regras foram adaptadas aos valores e rotas reais, com mapeamento de tokens confirmado pelo utilizador.


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
