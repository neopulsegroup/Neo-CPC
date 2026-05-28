/**
 * TASK-08 — Templates de email para os 5 triggers automáticos (Sprint 3).
 *
 * Estrutura: cada template é uma função `(vars) => { subject, html, text }`
 * registada por nome em `TEMPLATES`. A função `renderTemplate(name, locale, vars)`
 * resolve a locale com fallback para 'pt'.
 *
 * Plano: docs/PLANO_SPRINTS_1_2_3.md TASK-08.5.
 *
 * **Não usar HTML/CSS externo** — clientes de email têm motores muito limitados.
 * Tudo inline e simples (h1, p, a). O `text` (plain text) é sempre fornecido
 * como fallback para clientes que recusam HTML.
 */

export type EmailLocale = 'pt' | 'en' | 'es' | 'fr';

export type EmailRendered = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplateName =
  | 'welcomeMigrant'
  | 'welcomeCompany'
  | 'newApplication'
  | 'applicationAccepted'
  | 'applicationRejected'
  | 'jobOfferPendingReview'
  // TASK-07 — Lembretes automáticos de sessão (Sprint 3)
  | 'sessionConfirmation'
  | 'sessionConfirmationStaff'
  | 'sessionReminder24h'
  | 'sessionReminder1h';

type TemplateFn = (vars: Record<string, string | number>) => EmailRendered;

type TemplateMap = Partial<Record<EmailLocale, TemplateFn>>;

/**
 * URL base da app — usada em CTAs.
 * TODO: extrair para env var (FIREBASE_FUNCTIONS_CONFIG ou similar) quando
 * existir mais de um domínio. Hoje: produção apenas.
 */
const APP_BASE_URL = 'https://www.portalcpc.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

/**
 * Pequena utility para montar template com substituição segura em HTML.
 * Use `{varName}` no template; cada var é escapada para HTML automaticamente.
 */
function html(template: string, vars: Record<string, string | number>): string {
  const safeVars: Record<string, string> = {};
  for (const key of Object.keys(vars)) {
    safeVars[key] = escapeHtml(String(vars[key]));
  }
  return interpolate(template, safeVars);
}

function plain(template: string, vars: Record<string, string | number>): string {
  // Texto plano não é escapado.
  return interpolate(template, vars);
}

/* ------------------------------------------------------------------ */
/* TEMPLATES                                                          */
/* ------------------------------------------------------------------ */

const welcomeMigrant: TemplateMap = {
  pt: (v) => ({
    subject: plain('Bem-vindo(a) ao CPC, {name}!', v),
    html: html(
      `<h1>Olá, {name}!</h1>
       <p>O seu registo no <strong>CPC — Connecting People & Companies</strong> foi efetuado com sucesso.</p>
       <p>O próximo passo é completar a sua Situação Inicial, que nos ajuda a recomendar o melhor apoio.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante">Aceder ao meu dashboard</a></p>
       <p style="color:#666;font-size:12px;">Se não foi você quem se registou, ignore este email.</p>`,
      v
    ),
    text: plain(
      'Olá, {name}!\n\nO seu registo no CPC foi efetuado com sucesso.\nAceda em ' +
        `${APP_BASE_URL}/dashboard/migrante para completar a Situação Inicial.`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Welcome to CPC, {name}!', v),
    html: html(
      `<h1>Hi {name}!</h1>
       <p>Your account at <strong>CPC — Connecting People & Companies</strong> has been created successfully.</p>
       <p>Next step: complete your initial assessment so we can recommend the right support.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante">Go to my dashboard</a></p>
       <p style="color:#666;font-size:12px;">If you did not register, please ignore this email.</p>`,
      v
    ),
    text: plain(
      'Hi {name}!\n\nYour CPC account has been created successfully.\nVisit ' +
        `${APP_BASE_URL}/dashboard/migrante to complete your initial assessment.`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('¡Bienvenido(a) a CPC, {name}!', v),
    html: html(
      `<h1>¡Hola, {name}!</h1>
       <p>Tu registro en <strong>CPC — Connecting People & Companies</strong> se ha realizado correctamente.</p>
       <p>El siguiente paso es completar tu evaluación inicial.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante">Ir a mi panel</a></p>`,
      v
    ),
    text: plain(
      '¡Hola, {name}!\n\nTu cuenta CPC se ha creado correctamente.\nVisita ' +
        `${APP_BASE_URL}/dashboard/migrante para completar la evaluación inicial.`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Bienvenue au CPC, {name} !', v),
    html: html(
      `<h1>Bonjour {name} !</h1>
       <p>Votre inscription au <strong>CPC — Connecting People & Companies</strong> a été effectuée avec succès.</p>
       <p>Prochaine étape : compléter votre évaluation initiale.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante">Accéder à mon tableau de bord</a></p>`,
      v
    ),
    text: plain(
      'Bonjour {name} !\n\nVotre compte CPC a été créé avec succès.\nVisitez ' +
        `${APP_BASE_URL}/dashboard/migrante pour compléter votre évaluation initiale.`,
      v
    ),
  }),
};

const welcomeCompany: TemplateMap = {
  pt: (v) => ({
    subject: plain('Bem-vindo(a) ao CPC, {companyName}', v),
    html: html(
      `<h1>{companyName}</h1>
       <p>O registo da vossa empresa no <strong>CPC</strong> foi efetuado com sucesso.</p>
       <p>Já pode aceder ao painel para publicar ofertas de emprego, gerir candidaturas e contactar a equipa CPC.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa">Aceder ao painel da empresa</a></p>`,
      v
    ),
    text: plain(
      'O registo da empresa {companyName} no CPC foi efetuado com sucesso.\nAceda em ' +
        `${APP_BASE_URL}/dashboard/empresa para publicar ofertas.`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Welcome to CPC, {companyName}', v),
    html: html(
      `<h1>{companyName}</h1>
       <p>Your company has been successfully registered on <strong>CPC</strong>.</p>
       <p>You can now access the dashboard to publish job offers and manage applications.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa">Go to company dashboard</a></p>`,
      v
    ),
    text: plain(
      'Your company {companyName} has been registered on CPC.\nVisit ' +
        `${APP_BASE_URL}/dashboard/empresa to publish offers.`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Bienvenido(a) a CPC, {companyName}', v),
    html: html(
      `<h1>{companyName}</h1>
       <p>El registro de su empresa en <strong>CPC</strong> se ha realizado correctamente.</p>
       <p>Ya puede acceder al panel para publicar ofertas y gestionar candidaturas.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa">Ir al panel de la empresa</a></p>`,
      v
    ),
    text: plain(
      'Su empresa {companyName} ha sido registrada en CPC.\nVisite ' +
        `${APP_BASE_URL}/dashboard/empresa para publicar ofertas.`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Bienvenue au CPC, {companyName}', v),
    html: html(
      `<h1>{companyName}</h1>
       <p>L'enregistrement de votre entreprise sur <strong>CPC</strong> a été effectué avec succès.</p>
       <p>Vous pouvez accéder au tableau de bord pour publier des offres.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa">Accéder au tableau de bord</a></p>`,
      v
    ),
    text: plain(
      `Votre entreprise {companyName} a été enregistrée sur CPC.\nVisitez ${APP_BASE_URL}/dashboard/empresa pour publier des offres.`,
      v
    ),
  }),
};

const newApplication: TemplateMap = {
  pt: (v) => ({
    subject: plain('Nova candidatura: {jobTitle}', v),
    html: html(
      `<h1>Nova candidatura recebida</h1>
       <p>O migrante <strong>{migrantName}</strong> candidatou-se à vaga <strong>{jobTitle}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa/candidaturas">Ver candidaturas no painel</a></p>`,
      v
    ),
    text: plain(
      'Nova candidatura recebida.\nMigrante: {migrantName}\nVaga: {jobTitle}\n' +
        `Veja em ${APP_BASE_URL}/dashboard/empresa/candidaturas`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('New application: {jobTitle}', v),
    html: html(
      `<h1>New application received</h1>
       <p>The migrant <strong>{migrantName}</strong> has applied to the position <strong>{jobTitle}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa/candidaturas">View applications</a></p>`,
      v
    ),
    text: plain(
      `New application received.\nMigrant: {migrantName}\nPosition: {jobTitle}\nView at ${APP_BASE_URL}/dashboard/empresa/candidaturas`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Nueva candidatura: {jobTitle}', v),
    html: html(
      `<h1>Nueva candidatura recibida</h1>
       <p>El migrante <strong>{migrantName}</strong> se ha postulado a la oferta <strong>{jobTitle}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa/candidaturas">Ver candidaturas</a></p>`,
      v
    ),
    text: plain(
      `Nueva candidatura recibida.\nMigrante: {migrantName}\nOferta: {jobTitle}\nVer en ${APP_BASE_URL}/dashboard/empresa/candidaturas`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Nouvelle candidature : {jobTitle}', v),
    html: html(
      `<h1>Nouvelle candidature reçue</h1>
       <p>Le migrant <strong>{migrantName}</strong> a postulé à l'offre <strong>{jobTitle}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/empresa/candidaturas">Voir les candidatures</a></p>`,
      v
    ),
    text: plain(
      `Nouvelle candidature reçue.\nMigrant : {migrantName}\nOffre : {jobTitle}\nVoir : ${APP_BASE_URL}/dashboard/empresa/candidaturas`,
      v
    ),
  }),
};

const applicationAccepted: TemplateMap = {
  pt: (v) => ({
    subject: plain('Candidatura aceite: {jobTitle}', v),
    html: html(
      `<h1>Boas notícias!</h1>
       <p>A sua candidatura à vaga <strong>{jobTitle}</strong> foi <strong>aceite</strong>.</p>
       <p>Aceda à sua área para ver os próximos passos com a empresa.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/candidaturas">Ver as minhas candidaturas</a></p>`,
      v
    ),
    text: plain(
      `A sua candidatura à vaga {jobTitle} foi aceite.\nVer em ${APP_BASE_URL}/dashboard/migrante/candidaturas`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Application accepted: {jobTitle}', v),
    html: html(
      `<h1>Good news!</h1>
       <p>Your application for <strong>{jobTitle}</strong> has been <strong>accepted</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/candidaturas">View my applications</a></p>`,
      v
    ),
    text: plain(
      `Your application for {jobTitle} has been accepted.\nVisit ${APP_BASE_URL}/dashboard/migrante/candidaturas`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Candidatura aceptada: {jobTitle}', v),
    html: html(
      `<h1>¡Buenas noticias!</h1>
       <p>Tu candidatura a <strong>{jobTitle}</strong> ha sido <strong>aceptada</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/candidaturas">Ver mis candidaturas</a></p>`,
      v
    ),
    text: plain(
      `Tu candidatura a {jobTitle} ha sido aceptada.\nVisita ${APP_BASE_URL}/dashboard/migrante/candidaturas`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Candidature acceptée : {jobTitle}', v),
    html: html(
      `<h1>Bonne nouvelle !</h1>
       <p>Votre candidature pour <strong>{jobTitle}</strong> a été <strong>acceptée</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/candidaturas">Voir mes candidatures</a></p>`,
      v
    ),
    text: plain(
      `Votre candidature pour {jobTitle} a été acceptée.\nVisitez ${APP_BASE_URL}/dashboard/migrante/candidaturas`,
      v
    ),
  }),
};

const applicationRejected: TemplateMap = {
  pt: (v) => ({
    subject: plain('Atualização da candidatura: {jobTitle}', v),
    html: html(
      `<h1>Atualização sobre a sua candidatura</h1>
       <p>A vaga <strong>{jobTitle}</strong> não avançou desta vez. Não desanime — outras oportunidades surgem com frequência.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/emprego">Explorar outras vagas</a></p>`,
      v
    ),
    text: plain(
      `A sua candidatura à vaga {jobTitle} não avançou desta vez.\nExplore outras vagas em ${APP_BASE_URL}/dashboard/migrante/emprego`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Application update: {jobTitle}', v),
    html: html(
      `<h1>Application update</h1>
       <p>Your application for <strong>{jobTitle}</strong> did not move forward this time. New opportunities arrive often — keep going.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/emprego">Explore other offers</a></p>`,
      v
    ),
    text: plain(
      `Your application for {jobTitle} did not move forward this time.\nExplore other offers: ${APP_BASE_URL}/dashboard/migrante/emprego`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Actualización de candidatura: {jobTitle}', v),
    html: html(
      `<h1>Actualización sobre tu candidatura</h1>
       <p>La oferta <strong>{jobTitle}</strong> no avanzó esta vez. ¡No te desanimes! Hay muchas otras oportunidades.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/emprego">Explorar otras ofertas</a></p>`,
      v
    ),
    text: plain(
      `Tu candidatura a {jobTitle} no avanzó esta vez.\nExplora otras ofertas: ${APP_BASE_URL}/dashboard/migrante/emprego`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Mise à jour de la candidature : {jobTitle}', v),
    html: html(
      `<h1>Mise à jour de votre candidature</h1>
       <p>L'offre <strong>{jobTitle}</strong> n'a pas avancé cette fois. Ne perdez pas espoir — de nouvelles opportunités arrivent souvent.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/emprego">Explorer d'autres offres</a></p>`,
      v
    ),
    text: plain(
      `Votre candidature pour {jobTitle} n'a pas avancé cette fois.\nExplorez d'autres offres : ${APP_BASE_URL}/dashboard/migrante/emprego`,
      v
    ),
  }),
};

const jobOfferPendingReview: TemplateMap = {
  pt: (v) => ({
    subject: plain('Nova oferta para moderar: {offerTitle}', v),
    html: html(
      `<h1>Oferta pendente de revisão</h1>
       <p>A empresa <strong>{companyName}</strong> publicou uma nova oferta: <strong>{offerTitle}</strong>.</p>
       <p>Por favor, modere-a no painel.</p>
       <p><a href="${APP_BASE_URL}/dashboard/cpc/ofertas">Ir para moderação de ofertas</a></p>`,
      v
    ),
    text: plain(
      `Nova oferta pendente de revisão.\nEmpresa: {companyName}\nOferta: {offerTitle}\nModere em ${APP_BASE_URL}/dashboard/cpc/ofertas`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('New offer to moderate: {offerTitle}', v),
    html: html(
      `<h1>Offer pending review</h1>
       <p>The company <strong>{companyName}</strong> published a new offer: <strong>{offerTitle}</strong>.</p>
       <p>Please moderate it on the dashboard.</p>
       <p><a href="${APP_BASE_URL}/dashboard/cpc/ofertas">Go to offer moderation</a></p>`,
      v
    ),
    text: plain(
      `New offer pending review.\nCompany: {companyName}\nOffer: {offerTitle}\nModerate at ${APP_BASE_URL}/dashboard/cpc/ofertas`,
      v
    ),
  }),
  // Plano: admin CPC usa PT/EN (fallback). Sem ES/FR.
};

/* ------------------------------------------------------------------ */
/* TASK-07 — Templates de sessão                                       */
/* ------------------------------------------------------------------ */

const sessionConfirmation: TemplateMap = {
  pt: (v) => ({
    subject: plain('Sessão marcada: {sessionType} em {sessionDateTime}', v),
    html: html(
      `<h1>Olá, {userName}!</h1>
       <p>A sua sessão foi marcada com sucesso.</p>
       <ul>
         <li><strong>Tipo:</strong> {sessionType}</li>
         <li><strong>Data:</strong> {sessionDateTime}</li>
         <li><strong>Profissional:</strong> {specialistName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Ver as minhas sessões</a></p>
       <p style="color:#666;font-size:12px;">Receberá lembretes 24h e 1h antes do início.</p>`,
      v
    ),
    text: plain(
      'Olá, {userName}!\n\nA sua sessão foi marcada.\nTipo: {sessionType}\nData: {sessionDateTime}\nProfissional: {specialistName}\n\nVeja em ' +
        `${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Session booked: {sessionType} on {sessionDateTime}', v),
    html: html(
      `<h1>Hi {userName}!</h1>
       <p>Your session has been booked successfully.</p>
       <ul>
         <li><strong>Type:</strong> {sessionType}</li>
         <li><strong>Date:</strong> {sessionDateTime}</li>
         <li><strong>Professional:</strong> {specialistName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">View my sessions</a></p>
       <p style="color:#666;font-size:12px;">You will receive reminders 24h and 1h before it starts.</p>`,
      v
    ),
    text: plain(
      'Hi {userName}!\n\nYour session has been booked.\nType: {sessionType}\nDate: {sessionDateTime}\nProfessional: {specialistName}\n\nView at ' +
        `${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Sesión reservada: {sessionType} el {sessionDateTime}', v),
    html: html(
      `<h1>¡Hola, {userName}!</h1>
       <p>Tu sesión ha sido reservada con éxito.</p>
       <ul>
         <li><strong>Tipo:</strong> {sessionType}</li>
         <li><strong>Fecha:</strong> {sessionDateTime}</li>
         <li><strong>Profesional:</strong> {specialistName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Ver mis sesiones</a></p>`,
      v
    ),
    text: plain(
      '¡Hola, {userName}!\n\nTu sesión ha sido reservada.\nTipo: {sessionType}\nFecha: {sessionDateTime}\nProfesional: {specialistName}\n\nVer en ' +
        `${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Séance réservée : {sessionType} le {sessionDateTime}', v),
    html: html(
      `<h1>Bonjour {userName} !</h1>
       <p>Votre séance a été réservée avec succès.</p>
       <ul>
         <li><strong>Type :</strong> {sessionType}</li>
         <li><strong>Date :</strong> {sessionDateTime}</li>
         <li><strong>Professionnel :</strong> {specialistName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Voir mes séances</a></p>`,
      v
    ),
    text: plain(
      `Bonjour {userName} !\n\nVotre séance a été réservée.\nType : {sessionType}\nDate : {sessionDateTime}\nProfessionnel : {specialistName}\n\nVoir : ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
};

const sessionConfirmationStaff: TemplateMap = {
  pt: (v) => ({
    subject: plain('Nova sessão atribuída: {sessionType} em {sessionDateTime}', v),
    html: html(
      `<h1>Olá, {userName}</h1>
       <p>Foi-lhe atribuída uma nova sessão:</p>
       <ul>
         <li><strong>Tipo:</strong> {sessionType}</li>
         <li><strong>Data:</strong> {sessionDateTime}</li>
         <li><strong>Migrante:</strong> {migrantName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/cpc/agenda">Abrir agenda da equipa</a></p>`,
      v
    ),
    text: plain(
      `Nova sessão atribuída.\nTipo: {sessionType}\nData: {sessionDateTime}\nMigrante: {migrantName}\n\nAgenda: ${APP_BASE_URL}/dashboard/cpc/agenda`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('New session assigned: {sessionType} on {sessionDateTime}', v),
    html: html(
      `<h1>Hi {userName}</h1>
       <p>A new session has been assigned to you:</p>
       <ul>
         <li><strong>Type:</strong> {sessionType}</li>
         <li><strong>Date:</strong> {sessionDateTime}</li>
         <li><strong>Migrant:</strong> {migrantName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/cpc/agenda">Open team agenda</a></p>`,
      v
    ),
    text: plain(
      `New session assigned.\nType: {sessionType}\nDate: {sessionDateTime}\nMigrant: {migrantName}\n\nAgenda: ${APP_BASE_URL}/dashboard/cpc/agenda`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Nueva sesión asignada: {sessionType} el {sessionDateTime}', v),
    html: html(
      `<h1>Hola, {userName}</h1>
       <p>Se te ha asignado una nueva sesión:</p>
       <ul>
         <li><strong>Tipo:</strong> {sessionType}</li>
         <li><strong>Fecha:</strong> {sessionDateTime}</li>
         <li><strong>Migrante:</strong> {migrantName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/cpc/agenda">Abrir agenda</a></p>`,
      v
    ),
    text: plain(
      `Nueva sesión asignada.\nTipo: {sessionType}\nFecha: {sessionDateTime}\nMigrante: {migrantName}\n\nAgenda: ${APP_BASE_URL}/dashboard/cpc/agenda`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Nouvelle séance assignée : {sessionType} le {sessionDateTime}', v),
    html: html(
      `<h1>Bonjour {userName}</h1>
       <p>Une nouvelle séance vous a été assignée :</p>
       <ul>
         <li><strong>Type :</strong> {sessionType}</li>
         <li><strong>Date :</strong> {sessionDateTime}</li>
         <li><strong>Migrant :</strong> {migrantName}</li>
       </ul>
       <p><a href="${APP_BASE_URL}/dashboard/cpc/agenda">Ouvrir l'agenda</a></p>`,
      v
    ),
    text: plain(
      `Nouvelle séance assignée.\nType : {sessionType}\nDate : {sessionDateTime}\nMigrant : {migrantName}\n\nAgenda : ${APP_BASE_URL}/dashboard/cpc/agenda`,
      v
    ),
  }),
};

const sessionReminder24h: TemplateMap = {
  pt: (v) => ({
    subject: plain('Lembrete: sessão amanhã ({sessionType})', v),
    html: html(
      `<h1>Lembrete: {sessionType} amanhã</h1>
       <p>Olá, {userName}. A sua sessão está marcada para <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Detalhes da sessão</a></p>`,
      v
    ),
    text: plain(
      `Lembrete: sessão {sessionType} amanhã.\n{userName}, está marcada para {sessionDateTime}.\nDetalhes: ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Reminder: session tomorrow ({sessionType})', v),
    html: html(
      `<h1>Reminder: {sessionType} tomorrow</h1>
       <p>Hi {userName}. Your session is scheduled for <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Session details</a></p>`,
      v
    ),
    text: plain(
      `Reminder: {sessionType} session tomorrow.\n{userName}, scheduled for {sessionDateTime}.\nDetails: ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Recordatorio: sesión mañana ({sessionType})', v),
    html: html(
      `<h1>Recordatorio: {sessionType} mañana</h1>
       <p>Hola, {userName}. Tu sesión está programada para <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Detalles de la sesión</a></p>`,
      v
    ),
    text: plain(
      `Recordatorio: sesión {sessionType} mañana.\n{userName}, programada para {sessionDateTime}.\nDetalles: ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Rappel : séance demain ({sessionType})', v),
    html: html(
      `<h1>Rappel : {sessionType} demain</h1>
       <p>Bonjour {userName}. Votre séance est prévue pour <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Détails de la séance</a></p>`,
      v
    ),
    text: plain(
      `Rappel : séance {sessionType} demain.\n{userName}, prévue pour {sessionDateTime}.\nDétails : ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
};

const sessionReminder1h: TemplateMap = {
  pt: (v) => ({
    subject: plain('Sessão daqui a uma hora ({sessionType})', v),
    html: html(
      `<h1>{sessionType} daqui a uma hora</h1>
       <p>Olá, {userName}. A sessão está marcada para <strong>{sessionDateTime}</strong>.</p>
       <p>Prepare-se com calma. Em caso de imprevisto, comunique pela plataforma.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Abrir sessão</a></p>`,
      v
    ),
    text: plain(
      `Sessão {sessionType} daqui a 1h.\n{userName}, está marcada para {sessionDateTime}.\nAbrir: ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  en: (v) => ({
    subject: plain('Session in one hour ({sessionType})', v),
    html: html(
      `<h1>{sessionType} in one hour</h1>
       <p>Hi {userName}. Your session is scheduled for <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Open session</a></p>`,
      v
    ),
    text: plain(
      `Session {sessionType} in 1 hour.\n{userName}, scheduled for {sessionDateTime}.\nOpen: ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  es: (v) => ({
    subject: plain('Sesión en una hora ({sessionType})', v),
    html: html(
      `<h1>{sessionType} en una hora</h1>
       <p>Hola, {userName}. La sesión está programada para <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Abrir sesión</a></p>`,
      v
    ),
    text: plain(
      `Sesión {sessionType} en 1h.\n{userName}, programada para {sessionDateTime}.\nAbrir: ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
  fr: (v) => ({
    subject: plain('Séance dans une heure ({sessionType})', v),
    html: html(
      `<h1>{sessionType} dans une heure</h1>
       <p>Bonjour {userName}. Votre séance est prévue pour <strong>{sessionDateTime}</strong>.</p>
       <p><a href="${APP_BASE_URL}/dashboard/migrante/sessoes">Ouvrir la séance</a></p>`,
      v
    ),
    text: plain(
      `Séance {sessionType} dans 1h.\n{userName}, prévue pour {sessionDateTime}.\nOuvrir : ${APP_BASE_URL}/dashboard/migrante/sessoes`,
      v
    ),
  }),
};

const TEMPLATES: Record<EmailTemplateName, TemplateMap> = {
  welcomeMigrant,
  welcomeCompany,
  newApplication,
  applicationAccepted,
  applicationRejected,
  jobOfferPendingReview,
  sessionConfirmation,
  sessionConfirmationStaff,
  sessionReminder24h,
  sessionReminder1h,
};

/**
 * Resolve um template para a locale pedida; faz fallback para 'pt' se a
 * locale não estiver disponível para esse template.
 */
export function renderTemplate(
  name: EmailTemplateName,
  locale: EmailLocale,
  vars: Record<string, string | number>
): EmailRendered {
  const variants = TEMPLATES[name];
  const fn = variants[locale] ?? variants.pt;
  if (!fn) {
    throw new Error(`emailTemplates: template "${name}" sem variante para "${locale}" nem fallback PT`);
  }
  return fn(vars);
}

/** Útil para tests. */
export function listAvailableLocales(name: EmailTemplateName): EmailLocale[] {
  return Object.keys(TEMPLATES[name]) as EmailLocale[];
}
