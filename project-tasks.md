# Project Tasks

## Processo Obrigatório (Regra do Projeto)
- Toda alteração relevante (código, UI, infra, testes) exige atualização imediata deste arquivo, mantendo o estado real do projeto refletido aqui.
- Toda tarefa ativa deve existir no **Registro de Tarefas (obrigatório)** com: status, prioridade, responsável, prazo, progresso e data de atualização.
- Conclusões só podem ser marcadas como `done` quando validadas (lint/typecheck/test/build quando aplicável) e com `Progresso = 100`.
- Revisão diária obrigatória: tarefas ativas devem ter `Atualizado em` recente; tarefas vencidas devem ser replanejadas (atualizar `Prazo` + `Atualizado em`) ou concluídas.

## Registro de Tarefas (Obrigatório)
Formato validado automaticamente.

| ID | Tarefa | Status | Prioridade | Responsável | Prazo | Progresso | Atualizado em | Referência |
|---|---|---|---|---|---|---:|---|---|
| CPC-101 | [x] CPC • Trilhas: alternância de visualização (grade/lista) em “Trilhas existentes” | done | P2 | Renato | 2026-03-13 | 100 | 2026-03-13 | src/pages/dashboard/cpc/TrailsAdminPage.tsx |
| OPS-001 | [x] Automação: validação e notificações do project-tasks.md (CI + revisão diária) | done | P0 | Equipa | 2026-03-20 | 100 | 2026-03-13 | .github/workflows/project-tasks.yml |
| UI-001 | [x] UI • Cookies: popup de preferências com acordeão + responsividade (evitar overflow de texto) | done | P2 | Renato | 2026-03-16 | 100 | 2026-03-16 | src/components/cookies/CookieConsent.tsx |
| UI-002 | [x] UI • Remoção completa do dark mode (ícones, CSS, dependências, referências) | done | P1 | Renato | 2026-03-16 | 100 | 2026-03-16 | src/components/layout/Header.tsx; src/index.css; tailwind.config.ts; src/components/ui/sonner.tsx |
| UI-003 | [x] UI • Atualizar emails nas políticas (Privacidade/Cookies) | done | P3 | Renato | 2026-03-17 | 100 | 2026-03-17 | src/pages/Privacy.tsx; src/pages/Cookies.tsx |
| UI-004 | [x] CPC • Migrantes: exportação da lista (CSV/XLSX/PDF) com filtros e permissões (Email no lugar de CPF) | done | P2 | Renato | 2026-03-17 | 100 | 2026-03-23 | src/pages/dashboard/cpc/MigrantsAdminPage.tsx; src/locales/pt.json; src/locales/en.json; src/locales/es.json |
| CPC-105 | [x] CPC • Migrantes: exclusão persistida (regras Firestore + validação pós-delete + mensagem de permissão) | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | firestore.rules; src/pages/dashboard/cpc/MigrantsAdminPage.tsx; src/lib/i18n.ts |
| CPC-106 | [x] CPC • Equipa: somente Admin pode gerir/editar utilizadores (UI + regra de segurança) | done | P1 | Renato | 2026-03-18 | 100 | 2026-03-18 | src/pages/dashboard/CPCDashboard.tsx; firestore.rules; src/lib/i18n.ts |
| CPC-107 | [x] CPC • i18n runtime: permitir leitura de i18n/settings e i18n_overrides via Firestore Rules | done | P1 | Renato | 2026-03-18 | 100 | 2026-03-18 | firestore.rules; src/contexts/LanguageContext.tsx |
| CPC-108 | [x] CPC • Controle de acesso: bloquear login e acesso em tempo real (blocked/active) + auditoria + liberação pelo Admin | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | src/contexts/AuthContext.tsx; src/pages/Auth.tsx; src/pages/dashboard/cpc/MigrantsAdminPage.tsx; src/pages/dashboard/CPCDashboard.tsx; src/integrations/firebase/auth.ts; firestore.rules; src/contexts/AuthContext.access.test.tsx |
| CPC-109 | [x] CPC • Correção de carregamento: listas vazias em dashboard/cpc/migrantes e dashboard/cpc/equipa (roles case-insensitive + regras + fallback via profiles.role) | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | firestore.rules; src/pages/dashboard/cpc/MigrantsAdminPage.tsx; src/pages/dashboard/CPCDashboard.tsx; src/lib/i18n.ts |
| CPC-110 | [x] CPC • Hotfix de permissões persistentes: leitura do próprio perfil sem bloqueio + mapeamento de roles PT/EN + resiliência no carregamento | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | firestore.rules; src/contexts/AuthContext.tsx; src/pages/dashboard/cpc/MigrantsAdminPage.tsx |
| CPC-111 | [x] CPC • Hotfix final de ACL: compatibilidade com roles legadas (cpc/staff/equipa) + leitura owner em triage/progress sem bloqueio | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | firestore.rules |
| CPC-112 | [x] CPC • ACL: compatibilidade com schema legado (role em profile/perfil/type) para restaurar isCpcStaff e leituras em massa | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | firestore.rules |
| CPC-113 | [x] CPC • Diagnóstico/estabilidade Firestore: suporte a App Check (reCAPTCHA v3 via env) + retry para erros transitórios + logs com code | done | P0 | Renato | 2026-03-18 | 100 | 2026-03-18 | src/integrations/firebase/client.ts; src/integrations/firebase/firestore.ts |
| CPC-114 | [x] CPC • Agenda: modal de agendamento full overlay (z-index máximo + backdrop + clique fora) + visualização de nota de sessão (scroll vertical no registo) | done | P1 | Renato | 2026-03-20 | 100 | 2026-03-23 | src/pages/dashboard/cpc/TeamAgendaPage.tsx; src/components/ui/dialog.tsx; src/pages/dashboard/cpc/TeamAgendaPage.test.tsx; src/locales/pt.json; src/locales/en.json; src/locales/es.json |
| MIG-101 | [x] Migrante • Sessões: página idêntica à referência (lista/calendário, próximos/histórico, especialistas) + wizard de marcação (4 etapas) + ações (reagendar/cancelar/entrar em vídeo) + testes | done | P1 | Renato | 2026-03-20 | 100 | 2026-03-20 | src/pages/dashboard/migrant/SessionsPage.tsx; src/pages/dashboard/migrant/SessionsPage.wizard.test.tsx; src/pages/dashboard/migrant/SessionsPage.ui.test.tsx |
| CPC-115 | [x] CPC • Estatísticas: página em /dashboard/cpc/estatisticas com filtros (ano/período/região), KPIs, gráficos, tabela regional e exportações (PDF/DOCX/XLSX) com dados reais + item de menu | done | P0 | Renato | 2026-03-23 | 100 | 2026-03-23 | src/pages/dashboard/cpc/StatisticsPage.tsx; src/pages/dashboard/CPCDashboard.tsx; src/locales/pt.json; src/locales/en.json; src/locales/es.json |
| CPC-116 | [x] Trilhas • Progresso: gravar started_at em user_trail_progress (primeiro avanço) e adaptar estatísticas para considerar started_at no período | done | P1 | Renato | 2026-03-23 | 100 | 2026-03-23 | src/pages/dashboard/migrant/ModuleViewerPage.tsx; src/pages/dashboard/cpc/StatisticsPage.tsx |
| CPC-117 | [x] CPC • Migrantes: botão "Exportar Ficha" no perfil com geração de PDF (ficha + progresso) e download padronizado | done | P1 | Renato | 2026-03-23 | 100 | 2026-03-23 | src/pages/dashboard/migrant/ProfilePage.tsx; src/pages/dashboard/migrant/ProfilePage.test.tsx; package.json |
| CPC-118 | [x] CPC • Migrantes: botão "Exportar Triagem" no perfil com geração de PDF (respostas + timestamps) e download padronizado + permissões + erros + loading + testes | done | P1 | Renato | 2026-03-23 | 100 | 2026-03-23 | src/pages/dashboard/migrant/ProfilePage.tsx; src/pages/dashboard/migrant/ProfilePage.test.tsx |
| CPC-119 | [x] CPC • Migrantes: remover botão \"Exportar PDF\" da visão CPC do perfil (manter apenas na visão do próprio migrante) | done | P3 | Renato | 2026-03-31 | 100 | 2026-03-31 | src/pages/dashboard/migrant/ProfilePage.tsx |
| MIG-102 | [x] Migrante • Dashboard: alerta em Notificações quando perfil (Informação Pessoal + Perfil Profissional) está incompleto | done | P1 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/MigrantDashboard.tsx; src/pages/dashboard/MigrantDashboard.navigation.test.tsx |
| MIG-103 | [x] Migrante • Dashboard: Visão Geral lê Perfil de necessidades da base de dados e recalcula Progresso Geral por utilizador (dados reais) | done | P1 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/MigrantDashboard.tsx; src/pages/dashboard/MigrantDashboard.navigation.test.tsx; src/integrations/firebase/firestore.ts; src/locales/pt.json; src/locales/en.json; src/locales/es.json |
| MIG-104 | [x] Migrante • Dashboard: botão \"Marcar sessão\" na Visão Geral abre o mesmo wizard/modal de /dashboard/migrante/sessoes | done | P1 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/migrant/BookingSessionWizardDialog.tsx; src/pages/dashboard/migrant/SessionsPage.tsx; src/pages/dashboard/MigrantDashboard.tsx; src/pages/dashboard/MigrantDashboard.navigation.test.tsx |
| MIG-105 | [x] Migrante • Dashboard: card \"Trilhas Formativas\" usa botão \"Iniciar trilha formativa\" (mesmo padrão do card Visão Geral) | done | P3 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/MigrantDashboard.tsx |
| MIG-106 | [x] Migrante • Dashboard: card \"Agendamentos\" usa botão \"Marcar sessão\" no mesmo padrão visual do card Visão Geral | done | P3 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/MigrantDashboard.tsx |
| MIG-107 | [x] Migrante • Dashboard: card \"Área de Emprego\" usa botões no padrão do \"Completar CV\" (estilo do card Visão Geral) | done | P3 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/MigrantDashboard.tsx |
| MIG-108 | [x] Migrante • Perfil: "Editar Perfil" permite editar Informação Pessoal; Idiomas vira seletor de opções; remover campo "Necessidades principais" | done | P1 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/pages/dashboard/migrant/ProfilePage.tsx; src/pages/dashboard/migrant/ProfilePage.test.tsx; src/pages/dashboard/MigrantDashboard.tsx |
| MIG-109 | [x] Migrante • Base de dados: adicionar Data de Registo (registeredAt) no documento profiles/{uid} para fins estatísticos | done | P1 | Renato | 2026-04-06 | 100 | 2026-04-06 | src/integrations/firebase/auth.ts; src/api/migrantProfile.ts; src/api/migrantProfile.test.ts; src/pages/dashboard/MigrantDashboard.tsx |
| CPC-010 | [x] CPC • Estatísticas: "Detalhamento Regional" usa campo region/regionOther do perfil (dados reais do migrante) com fallback para localização antiga | done | P1 | Renato | 2026-04-07 | 100 | 2026-04-07 | src/pages/dashboard/cpc/StatisticsPage.tsx; src/pages/dashboard/cpc/StatisticsPage.test.tsx |
| CPC-011 | [x] CPC • Estatísticas: exportação PDF/DOCX/XLSX gera relatórios estruturados (com filtros, tabelas e base detalhada) e mostra progresso durante geração | done | P1 | Renato | 2026-04-07 | 100 | 2026-04-07 | src/pages/dashboard/cpc/StatisticsPage.tsx; src/pages/dashboard/cpc/statisticsExport.ts; src/pages/dashboard/cpc/statisticsExport.test.ts; package.json; package-lock.json |
| CPC-012 | [x] CPC • Definições: adicionar seção "Configurações" (email de notificações + SMTP + teste + autosave + auditoria) e ligar /contacto ao envio real via Firestore | done | P1 | Renato | 2026-04-07 | 100 | 2026-04-07 | src/pages/dashboard/CPCDashboard.tsx; src/pages/dashboard/cpc/SettingsPage.tsx; src/pages/dashboard/cpc/SettingsPage.test.tsx; src/pages/dashboard/cpc/settingsUtils.ts; src/pages/dashboard/cpc/settingsUtils.test.ts; src/pages/Contact.tsx; firestore.rules; src/locales/*.json |
| CPC-013 | [x] Backend • Functions: processador de emails (trigger mail/{id}) + teste SMTP via callable (testSmtpConnection) | done | P1 | Renato | 2026-04-07 | 100 | 2026-04-07 | functions/src/index.ts; functions/src/mailProcessor.ts; functions/src/smtp.ts; functions/src/permissions.ts; functions/DEPLOY.md; vite.config.ts |

### Convenções do Registro
- `Status`: `todo` | `in_progress` | `blocked` | `done`
- `Prioridade`: `P0` (crítico) | `P1` (alta) | `P2` (média) | `P3` (baixa)
- `Prazo` e `Atualizado em`: formato `YYYY-MM-DD`
- `Referência`: arquivo, link de issue/PR, ou contexto suficiente para rastreabilidade

### Guia de Estilo (Padrão Visual)
- No Registro de Tarefas (tabela), a coluna `Tarefa` deve começar com `[x]` (concluída) ou `[ ]` (pendente), e deve estar coerente com `Status`:
  - `Status = done` → `[x]`
  - `Status = todo | in_progress | blocked` → `[ ]`
- Em listas de tarefas fora da tabela, usar sempre o padrão:
  - `- [x] ...` para concluída
  - `- [ ] ...` para pendente

## Tarefas em Progresso (Legacy)

## Tarefas Implementadas (Legacy)
- [x] Remoção completa de dependências do Supabase no runtime (imports/uso do client) e limpeza de integrações Supabase no código.
- [x] Refatoração para Firestore nas páginas do Migrante (sessões, ofertas de emprego e detalhe, visualizador de módulos e progresso).
- [x] Refatoração para Firestore nas páginas da Empresa (criar oferta, listar ofertas, listar candidaturas, perfil de candidato).
- [x] Refatoração para Firestore nas páginas do CPC (dashboard, agenda de equipa, gestão/edição de trilhas e módulos).
- [x] Remoção de variáveis de ambiente do Supabase do repositório (.env).
- [x] Remoção do pacote @supabase/supabase-js e atualização do lockfile via npm install.
- [x] Implementação de script de migração Supabase -> Firebase (Auth + Firestore) com suporte a dry-run e seleção de tabelas.
- [x] Adição de dependência firebase-admin para suportar migração via Admin SDK.
- [x] Validação pós-alterações: lint/test/build executados com sucesso.
- [x] Exibição de "Urgências" e "Interesses" (triagem) com textos amigáveis (PT-PT) na "Visão Geral" do dashboard do Migrante.
- [x] Visualização completa do card "Status Migratório" (perguntas + respostas) no perfil do Migrante, com mapeamento de opções para PT-PT e tratamento de não respondidos.
- [x] Binding e formatação (máscara de telefone e data DD/MM/AAAA) dos campos "Telefone", "Data de nascimento" e "Nacionalidade" no card "Perfil" (dashboard/migrante/perfil), com testes para cenários com/sem dados.
- [x] Exibição somente leitura (texto estático) de "Telefone", "Data de nascimento" e "Nacionalidade" no card "Perfil" (dashboard/migrante/perfil), recuperando os dados a partir da triagem inicial e formatando em máscara de país/DD/MM/AAAA.
- [x] Remoção dos campos "Localização atual" e "Data de chegada" e do email duplicado ao lado do botão "Guardar alterações" no card "Perfil" (dashboard/migrante/perfil).
- [x] Reestruturação do layout da "Visão geral" do dashboard CPC (dashboard/cpc) com novo grid, KPIs, cards e widgets, mantendo responsividade e padrão visual do projeto.
- [x] Padronização do layout da página CPC "Equipa" para corresponder à estrutura/padrões de UI/UX de CPC "Migrantes" (filtros, lista, estados e ações), mantendo a funcionalidade de gestão de utilizadores.
- [x] Aplicação de overlay "Em breve" (opacidade + blur) nas secções "Capacidade Atual" e "Equipa em serviço" no dashboard CPC (Visão geral), com texto do pill em `text-white/90` (opacidade 0.9) para melhor equivalência visual com a referência e mantendo contraste WCAG 2.1 AA (>= 4.5:1) em cenário conservador.
- [x] CPC: "Ver perfil" em dashboard/cpc/migrantes redireciona para página interna de perfil do migrante com layout idêntico a dashboard/migrante/perfil (reutilização do mesmo layout/componentes, dados do migrante alvo, preservação de ações/formulários/indicadores, rota dedicada em /dashboard/cpc e navegação sem quebras; validado com lint/typecheck/test/build).

## Requisitos CPC (Checklist)

### Parte pública
- [x] Página inicial (home) com CTAs para registo/login como “Pessoa Migrante” e “Empresa”.
- [x] Páginas públicas: Sobre, Como Funciona, Contactos + FAQ.
- [x] Seleção de idioma (PT/EN/ES) com persistência.
- [ ] Formulário de contactos com envio real (backend/email).

### 1) Registos e Perfis
- [x] Registo/login por email para migrantes e empresas.
- [ ] Registo por telemóvel/OTP para migrantes.
- [x] Perfis internos CPC (mediador, jurista, psicólogo, gestor, coordenação, admin) e acesso ao painel CPC.
- [x] Cada tipo só acede ao que lhe diz respeito (rotas protegidas por role + redirecionamento).
- [x] Empresa: registo com nome e NIF.
- [ ] Empresa: campo “área de atividade” no registo/perfil.

### 2) Triagem Inicial
- [x] Triagem inicial multi-passos no fluxo do migrante, obrigatória antes do dashboard.
- [x] Gravação da triagem no Firestore (triage) com mapeamento para campos estruturados (ex.: legal_status, work_status, language_level, urgencies, interests).
- [x] Autosave da triagem (rascunho local + sincronização remota).
- [ ] “Perfil de necessidades” dedicado + recomendações/direcionamento automático (trilha/sessão/CV).

### 3) Agendamentos e Atendimento
- [x] Migrante: marcar sessões (mediador/jurista/psicóloga) e ver sessões marcadas.
- [x] Equipa CPC: criar, reagendar e cancelar sessões; filtrar por área e por profissional (atribuição básica).
- [ ] Equipa CPC: registar notas básicas das sessões (UI pronta; persistência/fluxo de gravação pendentes).
- [ ] Lembretes automáticos de sessão (email/notificações).

### 4) Trilhas Formativas
- [x] Migrante: catálogo de trilhas, detalhe, visualização de módulos (texto/vídeo/pdf) e progresso.
- [x] Progresso por utilizador (user_trail_progress; demo quando não há dados).
- [x] Equipa CPC: criar trilhas e gerir/editar módulos.
- [ ] Quizzes simples.
- [ ] Trilha recomendada com base na triagem.

### 5) Ligação ao Emprego (Empresas + Ofertas + CVs)
- [x] Migrante: ver ofertas e detalhe.
- [x] Migrante: candidatar-se diretamente (job_applications) com carta de apresentação opcional.
- [ ] Migrante: acompanhar estado/histórico de candidaturas.
- [x] Empresa: criar ofertas e listar ofertas.
- [ ] Empresa: editar ofertas.
- [x] Empresa: ver candidaturas recebidas por oferta e atualizar estado.
- [x] Empresa: ver perfil do candidato (inclui CV/link quando disponível).
- [x] CPC: ver candidaturas e listar ofertas pendentes de aprovação.
- [ ] CPC: aprovar/rejeitar/moderar ofertas (alterar status).

### 6) Painel Equipa CPC (Backoffice)
- [x] Lista de migrantes com filtros + acesso ao perfil + consulta de triagem.
- [x] Dashboard CPC com indicadores e exportação simples (CSV/PDF).
- [ ] Relatórios/exportação abrangentes (atendimentos/ofertas/candidaturas) com filtros.

### 7) Comunicação e Notificações
- [x] Notificações/chat/pedidos urgentes (MVP/demo via localStorage).
- [ ] Emails automáticos (criação de conta, lembretes, notificações de candidatura/oferta).
- [ ] Mensagens internas persistidas (chat real) e/ou fórum.

## Backlog (Subtarefas sugeridas)

### Parte pública
- [ ] Contactos: persistir mensagens em Firestore (ex.: contact_messages) com data/hora e origem.
- [ ] Contactos: envio real (Cloud Function/email provider) + proteção anti-spam (rate limit e/ou captcha).

### 1) Registos e Perfis
- [ ] Migrante: autenticação por telemóvel/OTP (UI + provider do Firebase Auth + validações).
- [ ] Empresa: adicionar “área de atividade” no registo e guardar no perfil da empresa (companies).
- [ ] Perfis CPC: decidir suporte a role “trainer” (acesso às rotas CPC) ou remover/normalizar roles.

### 2) Triagem Inicial
- [ ] Gerar e persistir “perfil de necessidades” a partir da triagem (ex.: needs_profile/flags/score).
- [ ] Implementar recomendações (“primeiras ações”) com base em urgências/interesses/língua/estado legal.
- [ ] UI no dashboard do migrante: card “Próximos passos” (marcar sessão / iniciar trilha / completar CV).

### 3) Agendamentos e Atendimento
- [ ] Sessões: permitir marcar como “Concluída” e guardar resultado (status padronizado).
- [ ] Sessões: adicionar “notas” (campos + UI na agenda CPC) e permissões por role.
- [ ] Notificações: lembretes automáticos de sessão (email e/ou notificação in-app) com agendamento.

### 4) Trilhas Formativas
- [ ] Quizzes: modelo de dados (perguntas/opções/respostas) + viewer + validação.
- [ ] Quizzes: persistir resultados e refletir no progresso (user_trail_progress).
- [ ] Recomendar trilha com base na triagem e mostrar “trilha recomendada” no dashboard do migrante.

### 5) Ligação ao Emprego
- [ ] Migrante: página “Minhas candidaturas” (lista + estado + link para oferta).
- [ ] Migrante: detalhe de candidatura (histórico/timeline de status).
- [ ] Empresa: editar ofertas (update em job_offers) mantendo fluxo de revisão quando aplicável.
- [ ] CPC: aprovar/rejeitar ofertas pendentes (alterar status em job_offers) + registar auditoria.

### 7) Comunicação e Notificações
- [ ] Notificações in-app reais (coleção notifications) substituindo localStorage.
- [ ] Chat persistido em Firestore (threads/mensagens) com permissões e leitura/entrega.
- [ ] Emails automáticos: conta criada, lembrete de sessão, candidatura recebida, oferta nova relevante.

## Tarefas Pendentes
- [ ] Migração completa do sistema
- [ ] Migração completa do sistema: definir escopo e mapeamentos (tabelas/coleções/campos).
- [ ] Migração completa do sistema: executar dry-run e gerar relatório de inconsistências.
- [ ] Migração completa do sistema: validação pós-migração (contagens, integridade, permissões, índices).
