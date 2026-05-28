/**
 * Corrige es.json (PT→ES) onde es===en e pt!==en; gera fr.json (EN→FR) a partir de en.json.
 * Sem rede: mapas de frases/palavras + sufixos românicos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '..', 'src', 'locales');

/** Frases completas PT → ES (mais longas primeiro) */
const PT_ES_PHRASES = [
  ['Não sei como fazer', 'No sé cómo hacerlo'],
  ['Não, planeio chegar em breve', 'No, planeo llegar pronto'],
  ['Utilizamos cookies para melhorar a sua experiência', 'Utilizamos cookies para mejorar su experiencia'],
  ['A Plataforma CPC utiliza cookies essenciais para garantir o funcionamento do sistema e cookies opcionais para melhorar a experiência de navegação', 'La plataforma CPC utiliza cookies esenciales para garantizar el funcionamiento del sistema y cookies opcionales para mejorar la experiencia de navegación'],
  ['Rejeitar cookies opcionais', 'Rechazar cookies opcionales'],
  ['Configurar preferências', 'Configurar preferencias'],
  ['Aceitar todos', 'Aceptar todos'],
  ['Preferências de Cookies', 'Preferencias de cookies'],
  ['Pode escolher quais os tipos de cookies que autoriza na Plataforma CPC. Alguns cookies são essenciais para o funcionamento do sistema e não podem ser desativados.', 'Puede elegir qué tipos de cookies autoriza en la plataforma CPC. Algunas cookies son esenciales para el funcionamiento del sistema y no pueden desactivarse.'],
  ['Expandir tudo', 'Expandir todo'],
  ['Recolher tudo', 'Contraer todo'],
  ['Serviços Sociais', 'Servicios sociales'],
  ['Doutoramento', 'Doctorado'],
  ['Português', 'Portugués'],
  ['Erro', 'Error'],
].sort((a, b) => b[0].length - a[0].length);

const PT_ES_SUFFIX = [
  [/ções\b/g, 'ciones'],
  [/ção\b/g, 'ción'],
  [/idades\b/g, 'idades'],
  [/idade\b/g, 'idad'],
  [/ário\b/g, 'ario'],
  [/ários\b/g, 'arios'],
  [/ância\b/g, 'ancia'],
  [/ências\b/g, 'encias'],
  [/ência\b/g, 'encia'],
  [/ível\b/g, 'ible'],
  [/íveis\b/g, 'ibles'],
  [/oso\b/g, 'oso'],
  [/osa\b/g, 'osa'],
  [/osos\b/g, 'osos'],
  [/osas\b/g, 'osas'],
  [/amento\b/g, 'amiento'],
  [/amentos\b/g, 'amientos'],
  [/ico\b/g, 'ico'],
  [/ica\b/g, 'ica'],
  [/icos\b/g, 'icos'],
  [/icas\b/g, 'icas'],
];

/** Palavras PT → ES (token) */
const PT_ES_WORD = new Map(
  Object.entries({
    utilizador: 'usuario',
    Utilizador: 'Usuario',
    ferramentas: 'herramientas',
    equipa: 'equipo',
    Equipa: 'Equipo',
    migrantes: 'migrantes',
    Migrantes: 'Migrantes',
    restauração: 'restauración',
    Restauração: 'Restauración',
    sim: 'sí',
    Sim: 'Sí',
    página: 'página',
    Página: 'Página',
    perfil: 'perfil',
    Perfil: 'perfil',
    pesquisa: 'búsqueda',
    Pesquisa: 'Búsqueda',
    filtrar: 'filtrar',
    Filtrar: 'Filtrar',
    editar: 'editar',
    Editar: 'Editar',
    criar: 'crear',
    Criar: 'Crear',
    adicionar: 'añadir',
    Adicionar: 'Añadir',
    confirmar: 'confirmar',
    Confirmar: 'Confirmar',
    rejeitar: 'rechazar',
    Rejeitar: 'Rechazar',
    aceitar: 'aceptar',
    Aceitar: 'Aceptar',
    ativar: 'activar',
    Ativar: 'Activar',
    estado: 'estado',
    Estado: 'Estado',
    situação: 'situación',
    Situação: 'Situación',
    triagem: 'triaje',
    Triagem: 'Triaje',
    exportação: 'exportación',
    Exportação: 'Exportación',
    ajuste: 'ajuste',
    Ajuste: 'Ajuste',
    nome: 'nombre',
    Nome: 'Nombre',
    dados: 'datos',
    Dados: 'Datos',
    todos: 'todos',
    Todas: 'Todas',
    todas: 'todas',
    ver: 'ver',
    Ver: 'Ver',
    sem: 'sin',
    Sem: 'Sin',
  }),
);

function protectPlaceholders(s) {
  const parts = [];
  let i = 0;
  const out = s.replace(/\{[^}]+\}/g, (m) => {
    parts.push(m);
    return `\uE000${i++}\uE001`;
  });
  return { out, parts };
}

function restorePlaceholders(s, parts) {
  return s.replace(/\uE000(\d+)\uE001/g, (_, d) => parts[Number(d)] ?? '');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Texto em inglês mal colocado em en.json (ex.: políticas em PT) */
function looksPortuguese(s) {
  if (typeof s !== 'string' || s.length < 16) return false;
  return /(ação|ções|\butilizador\b|\butilizadores\b|\brecolhemos\b|\barmazenamos\b|\bconformidade\b|\bPlataforma CPC\b|\bEsta política\b|\bdados pessoais\b|\bpara\b.*\bcom\b)/i.test(
    s,
  );
}

function romancePtToEs(raw) {
  if (!raw || !raw.trim()) return raw;
  if (raw.trim() === 'e') return 'y';
  const { out: ph, parts } = protectPlaceholders(raw);
  let t = ph;
  for (const [a, b] of PT_ES_PHRASES) {
    if (a.length <= 4) t = t.replace(new RegExp(`\\b${escapeRe(a)}\\b`, 'g'), b);
    else if (t.includes(a)) t = t.split(a).join(b);
  }
  for (const [re, rep] of PT_ES_SUFFIX) t = t.replace(re, rep);
  t = t.replace(/\b([\p{L}]+)\b/gu, (w) => PT_ES_WORD.get(w) ?? PT_ES_WORD.get(w.toLowerCase()) ?? w);
  t = t.replace(/\bNão\b/g, 'No');
  return restorePlaceholders(t, parts);
}

/** EN → FR phrases (longest first) */
const EN_FR_PHRASES = [
  ['We use cookies to improve your experience', 'Nous utilisons des cookies pour améliorer votre expérience'],
  ['Cookie Preferences', 'Préférences des cookies'],
  ['Reject optional cookies', 'Refuser les cookies optionnels'],
  ['Configure preferences', 'Configurer les préférences'],
  ['Accept all', 'Tout accepter'],
  ['Expand all', 'Tout développer'],
  ['Collapse all', 'Tout réduire'],
  ['Social Services', 'Services sociaux'],
  ["I don't know how", 'Je ne sais pas comment'],
  ['Loading...', 'Chargement…'],
  ['An error occurred', 'Une erreur est survenue'],
  ['Privacy Policy', 'Politique de confidentialité'],
  ['Cookie Policy', 'Politique relative aux cookies'],
  ['Terms of Service', "Conditions d'utilisation"],
  ['Help Center', "Centre d'aide"],
  ['Forgot your password?', 'Mot de passe oublié ?'],
  ['Confirm Password', 'Confirmer le mot de passe'],
  ['Password must be at least 6 characters long', 'Le mot de passe doit contenir au moins 6 caractères'],
  ['Passwords do not match', 'Les mots de passe ne correspondent pas'],
  ['Already have an account?', 'Vous avez déjà un compte ?'],
  ["Don't have an account?", "Vous n'avez pas de compte ?"],
  ['Register Now', "S'inscrire maintenant"],
  ['Welcome back!', 'Bon retour !'],
  ['Send Message', 'Envoyer le message'],
  ['Message sent successfully!', 'Message envoyé avec succès !'],
  ['Frequently Asked Questions', 'Foire aux questions'],
  ['Technical Support', 'Support technique'],
  ['Legal Questions', 'Questions juridiques'],
  ['Contact Support', 'Contacter le support'],
  ['All rights reserved', 'Tous droits réservés'],
  ['How It Works', 'Comment ça marche'],
  ['About Portal CPC', 'À propos du portail CPC'],
  ['Our Mission', 'Notre mission'],
  ['Our Values', 'Nos valeurs'],
  ['Contact Us', 'Contactez-nous'],
  ['Find Talent', 'Trouver des talents'],
  ['Find Work', 'Trouver un emploi'],
  ['Training Catalog', 'Catalogue de formations'],
  ['Dashboard', 'Tableau de bord'],
  ['Register', "S'inscrire"],
  ['Login', 'Connexion'],
  ['Logout', 'Déconnexion'],
  ['Save', 'Enregistrer'],
  ['Cancel', 'Annuler'],
  ['Next', 'Suivant'],
  ['Back', 'Retour'],
  ['Submit', 'Soumettre'],
  ['Yes', 'Oui'],
  ['No', 'Non'],
  ['Email', 'E-mail'],
  ['Phone', 'Téléphone'],
  ['Name', 'Nom'],
  ['Message', 'Message'],
  ['Search', 'Rechercher'],
  ['Settings', 'Paramètres'],
  ['Portuguese', 'Portugais'],
  ['PhD', 'Doctorat'],
  ['Catering', 'Restauration'],
  ['and', 'et'],
  ['Error', 'Erreur'],
].sort((a, b) => b[0].length - a[0].length);

const EN_FR_WORD = new Map(
  Object.entries({
    Loading: 'Chargement',
    Save: 'Enregistrer',
    Cancel: 'Annuler',
    Delete: 'Supprimer',
    Edit: 'Modifier',
    Create: 'Créer',
    Add: 'Ajouter',
    Remove: 'Retirer',
    Close: 'Fermer',
    Open: 'Ouvrir',
    Download: 'Télécharger',
    Upload: 'Téléverser',
    Export: 'Exporter',
    Import: 'Importer',
    Filter: 'Filtrer',
    Sort: 'Trier',
    Actions: 'Actions',
    Status: 'Statut',
    Title: 'Titre',
    Description: 'Description',
    Date: 'Date',
    Time: 'Heure',
    User: 'Utilisateur',
    Users: 'Utilisateurs',
    Company: 'Entreprise',
    Companies: 'Entreprises',
    Profile: 'Profil',
    Account: 'Compte',
    Password: 'Mot de passe',
    Language: 'Langue',
    English: 'Anglais',
    Spanish: 'Espagnol',
    French: 'Français',
    Home: 'Accueil',
    About: 'À propos',
    Contact: 'Contact',
    Help: 'Aide',
    Privacy: 'Confidentialité',
    Cookies: 'Cookies',
    Terms: 'Conditions',
    Welcome: 'Bienvenue',
    Thank: 'Merci',
    Please: 'Veuillez',
    Select: 'Sélectionner',
    Choose: 'Choisir',
    Continue: 'Continuer',
    Finish: 'Terminer',
    Start: 'Démarrer',
    Stop: 'Arrêter',
    Yes: 'Oui',
    No: 'Non',
    Error: 'Erreur',
    Success: 'Succès',
    Warning: 'Avertissement',
    Info: 'Info',
    Required: 'Obligatoire',
    Optional: 'Facultatif',
    All: 'Tous',
    None: 'Aucun',
    Other: 'Autre',
    New: 'Nouveau',
    Old: 'Ancien',
    Active: 'Actif',
    Inactive: 'Inactif',
    Pending: 'En attente',
    Approved: 'Approuvé',
    Rejected: 'Rejeté',
    Draft: 'Brouillon',
    Published: 'Publié',
    Unpublished: 'Non publié',
  }),
);

function romanceEnToFr(raw) {
  if (!raw || !raw.trim()) return raw;
  const { out: ph, parts } = protectPlaceholders(raw);
  let t = ph;
  for (const [a, b] of EN_FR_PHRASES) {
    if (a.length <= 4) t = t.replace(new RegExp(`\\b${escapeRe(a)}\\b`, 'g'), b);
    else if (t.includes(a)) t = t.split(a).join(b);
  }
  t = t.replace(/\b([\p{L}']+)\b/gu, (w) => EN_FR_WORD.get(w) ?? EN_FR_WORD.get(w.toLowerCase()) ?? w);
  return restorePlaceholders(t, parts);
}

function applyPtToEsGap(en, es, pt) {
  if (typeof en === 'string' && typeof es === 'string' && typeof pt === 'string') {
    if (es === en && pt !== en) return romancePtToEs(pt);
    if (es === en && looksPortuguese(en)) return romancePtToEs(en);
    return es;
  }
  if (!en || typeof en !== 'object' || Array.isArray(en)) return es;
  const o = { ...es };
  for (const k of Object.keys(en)) {
    if (!(k in o) || !(k in pt)) continue;
    o[k] = applyPtToEsGap(en[k], o[k], pt[k]);
  }
  return o;
}

function applyEnToFr(en, pt) {
  if (typeof en === 'string' && typeof pt === 'string') {
    if (looksPortuguese(en)) return romanceEnToFr(romancePtToEs(pt));
    return romanceEnToFr(en);
  }
  if (typeof en === 'string') return romanceEnToFr(en);
  if (!en || typeof en !== 'object') return en;
  if (Array.isArray(en)) return en.map((x, i) => applyEnToFr(x, Array.isArray(pt) ? pt[i] : pt));
  const o = {};
  for (const k of Object.keys(en)) {
    o[k] = applyEnToFr(en[k], pt && typeof pt === 'object' && !Array.isArray(pt) ? pt[k] : undefined);
  }
  return o;
}

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
let es = JSON.parse(fs.readFileSync(path.join(localesDir, 'es.json'), 'utf8'));
const pt = JSON.parse(fs.readFileSync(path.join(localesDir, 'pt.json'), 'utf8'));

es = applyPtToEsGap(en, es, pt);
fs.writeFileSync(path.join(localesDir, 'es.json'), `${JSON.stringify(es, null, 2)}\n`, 'utf8');

const fr = applyEnToFr(en, pt);
fs.writeFileSync(path.join(localesDir, 'fr.json'), `${JSON.stringify(fr, null, 2)}\n`, 'utf8');

console.log('es.json e fr.json atualizados (offline).');
