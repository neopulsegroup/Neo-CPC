#!/usr/bin/env node
/**
 * scripts/translate-locale-free.mjs
 *
 * Translates remaining untranslated French strings (identical to en.json)
 * using the free Google Translate API, preserving variables and protected terms.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const localesDir = path.join(repoRoot, 'src', 'locales');
const configPath = path.join(__dirname, 'translate-locale.config.json');

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJson(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
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

function collectTranslatables(ptNode, enNode, frNode, currentPath, results, skipKeyPathsSet) {
  if (typeof ptNode === 'string') {
    if (typeof frNode === 'string' && typeof enNode === 'string' && frNode === enNode && ptNode.trim().length > 0) {
      if (!skipKeyPathsSet.has(currentPath)) {
        results.push({ path: currentPath, ptSource: ptNode, enSource: enNode });
      }
    }
    return;
  }
  if (ptNode && typeof ptNode === 'object' && frNode && typeof frNode === 'object' && enNode && typeof enNode === 'object') {
    for (const key of Object.keys(ptNode)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      collectTranslatables(ptNode[key], enNode[key], frNode[key], childPath, results, skipKeyPathsSet);
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProtectedPattern(terms) {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`(${sorted.join('|')})`, 'g');
}

async function translateSingleText(text, protectedPattern) {
  const placeholders = [];
  let protectedText = text.replace(/\{(\w+)\}/g, (match) => {
    placeholders.push(match);
    return `__P${placeholders.length - 1}__`;
  });

  const termsMap = [];
  if (protectedPattern) {
    protectedText = protectedText.replace(protectedPattern, (match) => {
      termsMap.push(match);
      return `__T${termsMap.length - 1}__`;
    });
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=fr&dt=t&q=${encodeURIComponent(protectedText)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
  const json = await res.json();
  let translated = json[0].map(x => x[0]).join('');

  // Restore protected terms (using case-insensitive regex to tolerate engine changes)
  for (let i = 0; i < termsMap.length; i++) {
    const rx = new RegExp(`__\\s*[tT]\\s*${i}\\s*__`, 'gi');
    translated = translated.replace(rx, termsMap[i]);
  }

  // Restore placeholders (using case-insensitive regex to tolerate engine changes)
  for (let i = 0; i < placeholders.length; i++) {
    const rx = new RegExp(`__\\s*[pP]\\s*${i}\\s*__`, 'gi');
    translated = translated.replace(rx, placeholders[i]);
  }

  return translated;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const config = readJson(configPath);
  const ptPath = path.join(localesDir, `pt.json`);
  const enPath = path.join(localesDir, `en.json`);
  const frPath = path.join(localesDir, `fr.json`);

  const pt = readJson(ptPath);
  const en = readJson(enPath);
  const fr = readJson(frPath);

  const skipKeyPathsSet = new Set(Array.isArray(config.skipKeyPaths) ? config.skipKeyPaths : []);
  const protectedTerms = Array.isArray(config.protectedTerms) ? config.protectedTerms : [];
  const protectedPattern = buildProtectedPattern(protectedTerms);

  const translatables = [];
  collectTranslatables(pt, en, fr, '', translatables, skipKeyPathsSet);

  console.log(`=========================================`);
  console.log(`Free Google Translation: PT -> FR`);
  console.log(`=========================================`);
  console.log(`Total strings to translate: ${translatables.length}`);

  if (translatables.length === 0) {
    console.log("Everything is already translated!");
    return 0;
  }

  // Create a backup
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupPath = `${frPath}.bak.${ts}`;
  fs.copyFileSync(frPath, backupPath);
  console.log(`Backup created: ${path.relative(repoRoot, backupPath)}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < translatables.length; i++) {
    const item = translatables[i];
    try {
      const translated = await translateSingleText(item.ptSource, protectedPattern);
      if (translated && setByPath(fr, item.path, translated)) {
        successCount++;
        console.log(`[${i + 1}/${translatables.length}] Translated "${item.path}": "${item.ptSource}" -> "${translated}"`);
      } else {
        failCount++;
        console.warn(`[${i + 1}/${translatables.length}] Failed to set value at path: ${item.path}`);
      }
    } catch (err) {
      failCount++;
      console.error(`[${i + 1}/${translatables.length}] Failed translating "${item.path}":`, err.message);
    }
    // Sleep a short duration to prevent rate limiting
    await sleep(150);
  }

  // Save the result
  writeJson(frPath, fr);
  console.log(`\n=========================================`);
  console.log(`Translation finished!`);
  console.log(`Saved: ${path.relative(repoRoot, frPath)}`);
  console.log(`Successfully translated: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`=========================================`);

  return 0;
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
