import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    dryRun: false,
    onlyTables: null,
    limit: null,
    pageSize: 1000,
    createAuthUsers: true,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === '--help' || part === '-h') args.help = true;
    else if (part === '--dry-run') args.dryRun = true;
    else if (part === '--no-create-auth-users') args.createAuthUsers = false;
    else if (part === '--tables') {
      const v = argv[i + 1];
      i += 1;
      args.onlyTables = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null;
    } else if (part === '--limit') {
      const v = argv[i + 1];
      i += 1;
      args.limit = v ? Number(v) : null;
    } else if (part === '--page-size') {
      const v = argv[i + 1];
      i += 1;
      args.pageSize = v ? Number(v) : 1000;
    }
  }
  return args;
}

function printHelp() {
  const cmd = `node ${path.relative(process.cwd(), path.join(__dirname, 'migrate-supabase-to-firestore.mjs'))}`;
  // No comments in repo code; this is runtime output.
  console.log(
    [
      'Migração Supabase -> Firestore (admin SDK)',
      '',
      `Uso: ${cmd} [opções]`,
      '',
      'Variáveis de ambiente necessárias:',
      '  SUPABASE_URL                     ex: https://xxxx.supabase.co',
      '  SUPABASE_SERVICE_ROLE_KEY        service_role key (NUNCA commitar)',
      '',
      'Firebase Admin (uma das opções):',
      '  GOOGLE_APPLICATION_CREDENTIALS   caminho para JSON de service account',
      '  FIREBASE_SERVICE_ACCOUNT_JSON    JSON completo (string) do service account',
      '  FIREBASE_PROJECT_ID              (opcional) se usar application default',
      '',
      'Opções:',
      '  --dry-run                        não grava no Firestore / não cria users no Auth',
      '  --tables profiles,triage,...      roda só para essas tabelas',
      '  --limit N                         limita total de linhas por tabela (útil para teste)',
      '  --page-size N                     tamanho do lote de leitura via REST (default 1000)',
      '  --no-create-auth-users            não cria/resolve users no Firebase Auth (exige mapping manual)',
    ].join('\n')
  );
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim().length === 0) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return v;
}

function loadFirebaseAdminCredential() {
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonInline && jsonInline.trim().length > 0) {
    const parsed = JSON.parse(jsonInline);
    return cert(parsed);
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && credPath.trim().length > 0) {
    const abs = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath);
    const raw = fs.readFileSync(abs, 'utf8');
    const parsed = JSON.parse(raw);
    return cert(parsed);
  }
  return applicationDefault();
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
  }
  return value;
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function safeString(value) {
  return typeof value === 'string' ? value : null;
}

function safeStringArray(value) {
  if (!Array.isArray(value)) return null;
  const list = value.filter((v) => typeof v === 'string');
  return list.length ? list : [];
}

function generateTempPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

async function supabaseFetchPage({ supabaseUrl, serviceKey, table, select, rangeFrom, rangeTo }) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
  url.searchParams.set('select', select);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Range: `${rangeFrom}-${rangeTo}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase REST erro (${table}) ${res.status} ${res.statusText}: ${text}`);
  }
  const json = await res.json();

  const contentRange = res.headers.get('content-range') || res.headers.get('Content-Range') || '';
  const match = /\/(\d+)$/.exec(contentRange);
  const total = match ? Number(match[1]) : null;

  return { rows: Array.isArray(json) ? json : [], total };
}

async function supabaseFetchAll({ supabaseUrl, serviceKey, table, select, limitTotal, pageSize }) {
  const out = [];
  let from = 0;
  let total = null;

  while (true) {
    const to = from + pageSize - 1;
    const page = await supabaseFetchPage({ supabaseUrl, serviceKey, table, select, rangeFrom: from, rangeTo: to });
    if (total === null && typeof page.total === 'number') total = page.total;
    out.push(...page.rows);
    from += pageSize;

    const reachedLimit = typeof limitTotal === 'number' && out.length >= limitTotal;
    if (reachedLimit) return out.slice(0, limitTotal);

    if (page.rows.length < pageSize) return out;
    if (typeof total === 'number' && out.length >= total) return out;
  }
}

async function commitBatches({ firestore, writes, dryRun }) {
  const chunkSize = 450;
  let committed = 0;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const batchWrites = writes.slice(i, i + chunkSize);
    if (!dryRun) {
      const batch = firestore.batch();
      for (const w of batchWrites) batch.set(w.ref, w.data, { merge: true });
      await batch.commit();
    }
    committed += batchWrites.length;
  }
  return committed;
}

function buildTriageDoc({ uid, triageRow }) {
  const answers = triageRow?.answers && typeof triageRow.answers === 'object' ? triageRow.answers : null;
  const out = {
    userId: uid,
    completed: Boolean(triageRow?.completed),
    completedAt: toIsoString(triageRow?.completed_at) || (triageRow?.completed ? toIsoString(triageRow?.updated_at) : null),
    created_at: toIsoString(triageRow?.created_at) || null,
    updated_at: toIsoString(triageRow?.updated_at) || null,
    legal_status: safeString(triageRow?.legal_status),
    work_status: safeString(triageRow?.work_status),
    housing_status: safeString(triageRow?.housing_status),
    language_level: safeString(triageRow?.language_level),
    interests: safeStringArray(triageRow?.interests),
    urgencies: safeStringArray(triageRow?.urgencies),
    answers: answers,
    draft: null,
    draftUpdatedAt: null,
    draftRevision: null,
    draftFormSignature: null,
    draftChecksum: null,
    migratedFromSupabaseAt: new Date().toISOString(),
  };
  return stripUndefined(out);
}

function buildProfileDoc({ uid, profileRow, triageRow }) {
  const answers = triageRow?.answers && typeof triageRow.answers === 'object' ? triageRow.answers : null;
  const birthDate = answers && typeof answers.birth_date === 'string' ? answers.birth_date : null;
  const nationality = answers && typeof answers.nationality === 'string' ? answers.nationality : null;
  const phoneFromAnswers = answers && typeof answers.phone === 'string' ? answers.phone : null;
  const contactPreference = answers && typeof answers.contact_preference === 'string'
    ? (['email', 'phone', 'whatsapp'].includes(answers.contact_preference) ? answers.contact_preference : null)
    : null;

  const isInPortugal = answers && typeof answers.is_in_portugal === 'string' ? answers.is_in_portugal : null;
  const currentLocation = isInPortugal === 'no' && answers && typeof answers.current_country === 'string' ? answers.current_country : null;
  const arrivalDate = answers && typeof answers.arrival_date === 'string' ? answers.arrival_date : null;

  const out = {
    name: profileRow?.name || null,
    email: profileRow?.email || null,
    phone: profileRow?.phone || phoneFromAnswers || null,
    avatar_url: profileRow?.avatar_url || null,
    birthDate,
    nationality,
    currentLocation,
    arrivalDate,
    contactPreference,
    updatedAt: FieldValue.serverTimestamp(),
    migratedFromSupabaseAt: new Date().toISOString(),
  };
  return stripUndefined(out);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  initializeApp({
    credential: loadFirebaseAdminCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });
  const auth = getAuth();
  const firestore = getFirestore();

  const selectedTables = args.onlyTables ? new Set(args.onlyTables) : null;
  const want = (name) => (selectedTables ? selectedTables.has(name) : true);

  console.log(`dryRun=${args.dryRun} createAuthUsers=${args.createAuthUsers} limit=${args.limit ?? '∞'} pageSize=${args.pageSize}`);

  console.log('1) A ler triage do Supabase...');
  const supaTriage = want('triage')
    ? await supabaseFetchAll({ supabaseUrl, serviceKey, table: 'triage', select: '*', limitTotal: args.limit, pageSize: args.pageSize })
    : [];
  const triageBySupabaseUserId = new Map(supaTriage.map((t) => [t.user_id, t]));

  console.log('2) A ler profiles do Supabase...');
  const supaProfiles = want('profiles')
    ? await supabaseFetchAll({ supabaseUrl, serviceKey, table: 'profiles', select: '*', limitTotal: args.limit, pageSize: args.pageSize })
    : [];

  const supabaseUserIdToFirebaseUid = new Map();

  if (want('profiles')) {
    console.log(`3) A resolver/criar users no Firebase Auth (${supaProfiles.length})...`);
    for (const row of supaProfiles) {
      const email = row.email;
      if (!email || typeof email !== 'string') continue;

      let userRecord = null;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch {
        userRecord = null;
      }

      if (!userRecord && args.createAuthUsers && !args.dryRun) {
        userRecord = await auth.createUser({
          email,
          displayName: row.name || undefined,
          password: generateTempPassword(),
        });
      }

      if (userRecord) {
        supabaseUserIdToFirebaseUid.set(row.user_id, userRecord.uid);
      }
    }
  }

  const ensureUid = (supabaseUserId) => {
    const uid = supabaseUserIdToFirebaseUid.get(supabaseUserId);
    if (!uid) throw new Error(`Sem mapping para user_id=${supabaseUserId}. Rode com --create-auth-users ou crie o utilizador no Firebase Auth com o mesmo email.`);
    return uid;
  };

  const writes = [];

  if (want('profiles')) {
    console.log('4) A migrar users + profiles (Firestore)...');
    for (const row of supaProfiles) {
      const uid = ensureUid(row.user_id);
      const role = typeof row.role === 'string' ? row.role : 'migrant';

      const userDoc = stripUndefined({
        email: row.email || null,
        name: row.name || null,
        role,
        createdAt: toIsoString(row.created_at) || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        migratedFromSupabaseAt: new Date().toISOString(),
      });

      const triageRow = triageBySupabaseUserId.get(row.user_id) || null;
      const profileDoc = buildProfileDoc({ uid, profileRow: row, triageRow });

      writes.push({ ref: firestore.collection('users').doc(uid), data: userDoc });
      writes.push({ ref: firestore.collection('profiles').doc(uid), data: profileDoc });
    }
  }

  if (want('triage')) {
    console.log('5) A migrar triage (Firestore)...');
    for (const row of supaTriage) {
      const uid = ensureUid(row.user_id);
      const triageDoc = buildTriageDoc({ uid, triageRow: row });
      writes.push({ ref: firestore.collection('triage').doc(uid), data: triageDoc });
    }
  }

  const migrateIdTable = async ({ table, collection, mapRow }) => {
    if (!want(table)) return;
    console.log(`6) A ler ${table} do Supabase...`);
    const rows = await supabaseFetchAll({ supabaseUrl, serviceKey, table, select: '*', limitTotal: args.limit, pageSize: args.pageSize });
    console.log(`7) A preparar escrita ${collection} (${rows.length})...`);
    for (const r of rows) {
      const { docId, data } = mapRow(r);
      writes.push({ ref: firestore.collection(collection).doc(docId), data });
    }
  };

  await migrateIdTable({
    table: 'companies',
    collection: 'companies',
    mapRow: (r) => {
      const uid = ensureUid(r.user_id);
      const data = stripUndefined({
        user_id: uid,
        company_name: r.company_name || null,
        nif: r.nif || null,
        sector: r.sector || null,
        description: r.description || null,
        location: r.location || null,
        website: r.website || null,
        verified: Boolean(r.verified),
        created_at: toIsoString(r.created_at),
        updated_at: toIsoString(r.updated_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  await migrateIdTable({
    table: 'job_offers',
    collection: 'job_offers',
    mapRow: (r) => {
      const data = stripUndefined({
        company_id: r.company_id,
        title: r.title,
        description: r.description ?? null,
        requirements: r.requirements ?? null,
        location: r.location ?? null,
        salary_range: r.salary_range ?? null,
        contract_type: r.contract_type ?? null,
        sector: r.sector ?? null,
        status: r.status ?? null,
        applications_count: r.applications_count ?? null,
        created_at: toIsoString(r.created_at),
        updated_at: toIsoString(r.updated_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  await migrateIdTable({
    table: 'job_applications',
    collection: 'job_applications',
    mapRow: (r) => {
      const applicantUid = ensureUid(r.applicant_id);
      const data = stripUndefined({
        job_id: r.job_id,
        applicant_id: applicantUid,
        status: r.status ?? null,
        cover_letter: r.cover_letter ?? null,
        created_at: toIsoString(r.created_at),
        updated_at: toIsoString(r.updated_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  await migrateIdTable({
    table: 'sessions',
    collection: 'sessions',
    mapRow: (r) => {
      const migrantUid = ensureUid(r.migrant_id);
      const professionalUid = r.professional_id ? ensureUid(r.professional_id) : null;
      const data = stripUndefined({
        migrant_id: migrantUid,
        professional_id: professionalUid,
        session_type: r.session_type,
        scheduled_date: typeof r.scheduled_date === 'string' ? r.scheduled_date : toIsoString(r.scheduled_date),
        scheduled_time: typeof r.scheduled_time === 'string' ? r.scheduled_time : toIsoString(r.scheduled_time),
        status: r.status ?? null,
        notes: r.notes ?? null,
        created_at: toIsoString(r.created_at),
        updated_at: toIsoString(r.updated_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  await migrateIdTable({
    table: 'trails',
    collection: 'trails',
    mapRow: (r) => {
      const data = stripUndefined({
        title: r.title,
        description: r.description ?? null,
        category: r.category,
        modules_count: r.modules_count ?? 0,
        duration_minutes: r.duration_minutes ?? 0,
        difficulty: r.difficulty ?? 'beginner',
        is_active: Boolean(r.is_active),
        created_at: toIsoString(r.created_at),
        updated_at: toIsoString(r.updated_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  await migrateIdTable({
    table: 'trail_modules',
    collection: 'trail_modules',
    mapRow: (r) => {
      const data = stripUndefined({
        trail_id: r.trail_id,
        title: r.title,
        content_type: r.content_type,
        content_url: r.content_url ?? null,
        content_text: r.content_text ?? null,
        order_index: r.order_index ?? null,
        duration_minutes: r.duration_minutes ?? null,
        created_at: toIsoString(r.created_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  await migrateIdTable({
    table: 'user_trail_progress',
    collection: 'user_trail_progress',
    mapRow: (r) => {
      const uid = ensureUid(r.user_id);
      const data = stripUndefined({
        user_id: uid,
        trail_id: r.trail_id,
        modules_completed: r.modules_completed ?? 0,
        progress_percent: r.progress_percent ?? 0,
        started_at: toIsoString(r.started_at),
        completed_at: toIsoString(r.completed_at),
        migratedFromSupabaseAt: new Date().toISOString(),
      });
      return { docId: r.id, data };
    },
  });

  console.log(`8) A gravar no Firestore (${writes.length} documentos)...`);
  const committed = await commitBatches({ firestore, writes, dryRun: args.dryRun });
  console.log(`OK: ${committed} writes ${args.dryRun ? '(dry-run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
