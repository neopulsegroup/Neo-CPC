#!/usr/bin/env node
/**
 * TASK-FR — Tradução automática de locale via DeepL.
 *
 * Lê `src/locales/en.json` (source) + `src/locales/fr.json` (target),
 * traduz apenas as strings em `fr.json` que continuam idênticas a `en.json`
 * (ou seja, ainda não foram traduzidas), e escreve o resultado em `fr.json`.
 *
 * Termos protegidos (ex.: CPC, EMPIS, CIBEA, Algarve) são embrulhados em
 * `<x>` antes de enviar; o DeepL respeita `ignore_tags=x` e devolve-os
 * inalterados. As tags são removidas após a tradução. Tokens de interpolação
 * (ex.: `{count}`) e URLs são preservados pela `preserve_formatting=1` + o
 * comportamento default do DeepL, que raramente os altera.
 *
 * USO:
 *   # Apenas listar o que seria traduzido (sem chamadas à API):
 *   node scripts/translate-locale.mjs --dry-run
 *
 *   # Executar tradução real (requer DEEPL_API_KEY):
 *   export DEEPL_API_KEY="xxxx-xxxx-xxxx:fx"
 *   node scripts/translate-locale.mjs
 *
 *   # Opções:
 *   --dry-run             Não chama API, não escreve. Só lista plano.
 *   --source <lang>       Default: en  (lê src/locales/{lang}.json)
 *   --target <lang>       Default: fr
 *   --no-backup           Não cria backup do target antes de gravar.
 *   --help                Mostra esta ajuda.
 *
 * Ver docs/I18N.md para o fluxo completo e a lista de termos protegidos.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const localesDir = path.join(repoRoot, 'src', 'locales');
const configPath = path.join(__dirname, 'translate-locale.config.json');

/* ------------------------------------------------------------------ */
/* CLI parsing                                                         */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { dryRun: false, source: 'en', target: 'fr', noBackup: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-backup') args.noBackup = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--source') args.source = argv[++i];
    else if (a === '--target') args.target = argv[++i];
  }
  return args;
}

function printHelp() {
  // Heredoc emulado.
  const lines = [
    '',
    'translate-locale.mjs — TASK-FR (DeepL)',
    '',
    'USO:',
    '  node scripts/translate-locale.mjs --dry-run',
    '  DEEPL_API_KEY=... node scripts/translate-locale.mjs',
    '',
    'Opções:',
    '  --dry-run        Não chama API, não escreve. Só lista plano por secção.',
    '  --source <lang>  Default: en  (src/locales/{lang}.json)',
    '  --target <lang>  Default: fr',
    '  --no-backup      Não cria backup do target antes de gravar.',
    '  --help, -h       Mostra esta ajuda.',
    '',
    'Lista de termos protegidos: scripts/translate-locale.config.json',
    'Fluxo completo: docs/I18N.md',
    '',
  ];
  for (const line of lines) console.log(line);
}

/* ------------------------------------------------------------------ */
/* JSON utilities                                                      */
/* ------------------------------------------------------------------ */

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJson(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Walk paralelamente `enNode` e `frNode`. Para cada folha onde
 *   - ambos são string,
 *   - `fr === en` (ou seja, fr ainda não foi traduzido),
 *   - a path não está em `skipKeyPaths`,
 *   - a string tem conteúdo (não vazia/whitespace),
 * acumula `{ path, source }` em `results`.
 */
function collectTranslatables(enNode, frNode, currentPath, results, skipKeyPathsSet) {
  if (typeof enNode === 'string') {
    if (typeof frNode === 'string' && enNode === frNode && enNode.trim().length > 0) {
      if (!skipKeyPathsSet.has(currentPath)) {
        results.push({ path: currentPath, source: enNode });
      }
    }
    return;
  }
  if (enNode && typeof enNode === 'object' && frNode && typeof frNode === 'object') {
    for (const key of Object.keys(enNode)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      collectTranslatables(enNode[key], frNode[key], childPath, results, skipKeyPathsSet);
    }
  }
}

function setByPath(obj, dottedPath, value) {
  const keys = dottedPath.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) return false;
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return true;
}

/* ------------------------------------------------------------------ */
/* Protected terms (XML tag wrapping)                                  */
/* ------------------------------------------------------------------ */

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Devolve regex global para a primeira ocorrência exacta (case-sensitive). */
function buildProtectedPattern(terms) {
  if (terms.length === 0) return null;
  // Ordena por tamanho desc para evitar matches parciais (ex.: "CPC" dentro de "CPC++").
  const sorted = [...terms].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`(${sorted.join('|')})`, 'g');
}

/**
 * Embrulha cada ocorrência de termo protegido em `<x>termo</x>`. Tokens já
 * dentro de tags (improvável neste contexto) são ignorados pela ordem.
 */
function wrapProtectedTerms(text, pattern) {
  if (!pattern) return text;
  return text.replace(pattern, (match) => `<x>${match}</x>`);
}

/** Remove as tags `<x>...</x>` deixando o conteúdo. */
function unwrapProtectedTerms(text) {
  return text.replace(/<x>([\s\S]*?)<\/x>/g, '$1');
}

/* ------------------------------------------------------------------ */
/* DeepL                                                               */
/* ------------------------------------------------------------------ */

function deeplLanguageCode(lang) {
  return lang.toUpperCase();
}

async function deeplTranslate({ texts, apiKey, sourceLang, targetLang, deeplCfg }) {
  const isFreeKey = /:fx$/.test(apiKey);
  const url = isFreeKey ? deeplCfg.freeApiUrl : deeplCfg.proApiUrl;

  const body = new URLSearchParams();
  body.set('source_lang', deeplLanguageCode(sourceLang));
  body.set('target_lang', deeplLanguageCode(targetLang));
  body.set('preserve_formatting', deeplCfg.preserveFormatting ? '1' : '0');
  body.set('tag_handling', deeplCfg.tagHandling || 'xml');
  body.set('ignore_tags', 'x');
  for (const t of texts) body.append('text', t);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '<no body>');
    throw new Error(`DeepL HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
  }
  const data = await response.json();
  if (!Array.isArray(data?.translations)) {
    throw new Error(`DeepL: resposta sem campo 'translations': ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.translations.map((t) => String(t.text ?? ''));
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function groupBySection(items) {
  const map = new Map();
  for (const it of items) {
    const section = it.path.split('.')[0] || '(root)';
    map.set(section, (map.get(section) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function totalChars(items) {
  return items.reduce((sum, it) => sum + it.source.length, 0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const config = readJson(configPath);
  const sourcePath = path.join(localesDir, `${args.source}.json`);
  const targetPath = path.join(localesDir, `${args.target}.json`);

  for (const p of [sourcePath, targetPath]) {
    if (!fs.existsSync(p)) {
      console.error(`[ERROR] Locale file não existe: ${p}`);
      return 2;
    }
  }

  const source = readJson(sourcePath);
  const target = readJson(targetPath);
  const skipKeyPathsSet = new Set(Array.isArray(config.skipKeyPaths) ? config.skipKeyPaths : []);
  const protectedTerms = Array.isArray(config.protectedTerms) ? config.protectedTerms : [];
  const protectedPattern = buildProtectedPattern(protectedTerms);

  const results = [];
  collectTranslatables(source, target, '', results, skipKeyPathsSet);

  const sectionStats = groupBySection(results);
  const charCount = totalChars(results);

  /* ---------- Resumo ---------- */
  console.log('');
  console.log('================================================================');
  console.log(`  translate-locale.mjs   ${args.source} → ${args.target}   ${args.dryRun ? '[DRY-RUN]' : '[REAL RUN]'}`);
  console.log('================================================================');
  console.log(`  Source: ${path.relative(repoRoot, sourcePath)}`);
  console.log(`  Target: ${path.relative(repoRoot, targetPath)}`);
  console.log(`  Protected terms: ${protectedTerms.length}`);
  console.log(`  Skip paths: ${skipKeyPathsSet.size}`);
  console.log('');
  console.log(`  Strings a traduzir: ${results.length}`);
  console.log(`  Caracteres totais: ${charCount} (~${(charCount / 1000).toFixed(1)}k)`);
  console.log('');

  if (sectionStats.length === 0) {
    console.log('  Nada a traduzir — todas as strings em `' + args.target + '.json` já diferem do source.');
    console.log('');
    return 0;
  }

  console.log('  Por secção:');
  for (const [section, count] of sectionStats) {
    console.log(`    ${section.padEnd(28)} ${String(count).padStart(5)}`);
  }
  console.log('');

  const samples = results.slice(0, 5);
  if (samples.length > 0) {
    console.log('  Amostra (primeiras 5):');
    for (const s of samples) {
      const truncated = s.source.length > 80 ? s.source.slice(0, 77) + '…' : s.source;
      console.log(`    [${s.path}]`);
      console.log(`      "${truncated}"`);
    }
    console.log('');
  }

  if (args.dryRun) {
    console.log('  DRY-RUN: nenhuma chamada à API e ficheiro não modificado.');
    console.log('  Para correr a sério: ');
    console.log('    export DEEPL_API_KEY="xxxx-xxxx-xxxx:fx"');
    console.log('    node scripts/translate-locale.mjs');
    console.log('');
    return 0;
  }

  /* ---------- Run real ---------- */

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    console.error('[ERROR] DEEPL_API_KEY não definido no ambiente.');
    console.error('        Obtenha em https://www.deepl.com/pro-api e exporte:');
    console.error('        export DEEPL_API_KEY="xxxx-xxxx-xxxx:fx"');
    return 3;
  }

  console.log(`  API: ${/:fx$/.test(apiKey) ? 'DeepL Free' : 'DeepL Pro'}`);
  console.log('');

  const batchSize = Math.max(1, Math.min(50, config?.deepl?.batchSize ?? 25));
  const totalBatches = Math.ceil(results.length / batchSize);
  let translatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const wrapped = batch.map((it) => wrapProtectedTerms(it.source, protectedPattern));
    const batchIdx = Math.floor(i / batchSize) + 1;
    try {
      const translations = await deeplTranslate({
        texts: wrapped,
        apiKey,
        sourceLang: args.source,
        targetLang: args.target,
        deeplCfg: config.deepl ?? {},
      });
      for (let j = 0; j < batch.length; j += 1) {
        const translated = unwrapProtectedTerms(translations[j] ?? '');
        if (translated && setByPath(target, batch[j].path, translated)) {
          translatedCount += 1;
        } else {
          failedCount += 1;
        }
      }
      console.log(`  Lote ${String(batchIdx).padStart(3)}/${totalBatches}  ${batch.length} strings → OK`);
    } catch (err) {
      failedCount += batch.length;
      console.error(`  Lote ${batchIdx}/${totalBatches} FALHOU: ${String(err).slice(0, 200)}`);
      console.error('    (continuando com próximo lote — strings deste lote ficam inalteradas)');
    }
  }

  console.log('');

  /* ---------- Backup + write ---------- */

  if (!args.noBackup) {
    const ts = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14); // YYYYMMDDHHMMSS
    const backupPath = `${targetPath}.bak.${ts}`;
    fs.copyFileSync(targetPath, backupPath);
    console.log(`  Backup: ${path.relative(repoRoot, backupPath)}`);
  }

  writeJson(targetPath, target);
  console.log(`  Escrito: ${path.relative(repoRoot, targetPath)}`);
  console.log(`  Traduzido: ${translatedCount} / ${results.length} strings`);
  if (failedCount > 0) console.log(`  Falhas: ${failedCount} (manteve original)`);
  console.log('');
  console.log('  Próximo passo: rever manualmente as traduções e correr `npm run test:run -- i18n.integrity`.');
  console.log('');
  return 0;
}

main()
  .then((code) => {
    process.exit(code ?? 0);
  })
  .catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
