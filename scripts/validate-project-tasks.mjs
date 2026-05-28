import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TASKS_FILE = path.join(ROOT, 'project-tasks.md');

const REQUIRED_COLUMNS = [
  'ID',
  'Tarefa',
  'Status',
  'Prioridade',
  'Responsável',
  'Prazo',
  'Progresso',
  'Atualizado em',
  'Referência',
];

const ALLOWED_STATUS = new Set(['todo', 'in_progress', 'blocked', 'done']);
const ALLOWED_PRIORITY = new Set(['P0', 'P1', 'P2', 'P3']);

function toIsoDateUtc(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, day] = value.split('-').map((p) => Number(p));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(day)) return false;
  const t = Date.UTC(y, m - 1, day);
  const d = new Date(t);
  return !Number.isNaN(d.getTime()) && toIsoDateUtc(d) === value;
}

function parseMarkdownTable(lines) {
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

function findRegistryTable(raw) {
  const anchor = '## Registro de Tarefas (Obrigatório)';
  const idx = raw.indexOf(anchor);
  if (idx === -1) return null;

  const after = raw.slice(idx + anchor.length);
  const lines = after.split(/\r?\n/);

  const tableStart = lines.findIndex((l) => l.trim().startsWith('|'));
  if (tableStart === -1) return null;

  const tableLines = [];
  for (let i = tableStart; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l.trim().startsWith('|')) break;
    tableLines.push(l);
  }

  const rows = parseMarkdownTable(tableLines);
  if (rows.length < 2) return null;
  return rows;
}

function makeError(message) {
  return { level: 'error', message };
}

function makeWarn(message) {
  return { level: 'warn', message };
}

function validateRows(header, dataRows) {
  const issues = [];

  const colIndex = new Map(header.map((name, i) => [name, i]));
  for (const col of REQUIRED_COLUMNS) {
    if (!colIndex.has(col)) issues.push(makeError(`Coluna obrigatória ausente: "${col}"`));
  }
  if (issues.some((i) => i.level === 'error')) return issues;

  const today = toIsoDateUtc(new Date());
  const seenIds = new Set();

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx += 1) {
    const row = dataRows[rowIdx];
    const rowNumber = rowIdx + 1;

    function get(col) {
      return row[colIndex.get(col)]?.trim() ?? '';
    }

    const id = get('ID');
    const task = get('Tarefa');
    const status = get('Status');
    const priority = get('Prioridade');
    const owner = get('Responsável');
    const due = get('Prazo');
    const progressRaw = get('Progresso');
    const updated = get('Atualizado em');
    const ref = get('Referência');

    if (!id) issues.push(makeError(`Linha ${rowNumber}: ID vazio`));
    if (id && !/^[A-Z]{2,10}-\d{1,6}$/.test(id)) issues.push(makeError(`Linha ${rowNumber}: ID inválido "${id}" (ex.: CPC-123)`));
    if (id) {
      if (seenIds.has(id)) issues.push(makeError(`Linha ${rowNumber}: ID duplicado "${id}"`));
      seenIds.add(id);
    }

    if (!task) issues.push(makeError(`Linha ${rowNumber}: Tarefa vazia`));

    if (!ALLOWED_STATUS.has(status)) issues.push(makeError(`Linha ${rowNumber}: Status inválido "${status}"`));
    if (!ALLOWED_PRIORITY.has(priority)) issues.push(makeError(`Linha ${rowNumber}: Prioridade inválida "${priority}"`));

    if (task) {
      const match = /^\[(x| )\]\s+/.exec(task);
      if (!match) {
        issues.push(makeError(`Linha ${rowNumber}: Tarefa deve começar com "[x]" ou "[ ]" (ex.: "[ ] Minha tarefa")`));
      } else {
        const isChecked = match[1] === 'x';
        const expectedChecked = status === 'done';
        if (isChecked !== expectedChecked) {
          issues.push(makeError(`Linha ${rowNumber}: Marcação de Tarefa (${isChecked ? '[x]' : '[ ]'}) inconsistente com Status "${status}"`));
        }
      }
    }

    if (!owner) issues.push(makeError(`Linha ${rowNumber}: Responsável vazio`));

    if (!isIsoDate(due)) issues.push(makeError(`Linha ${rowNumber}: Prazo inválido "${due}" (YYYY-MM-DD)`));
    if (!isIsoDate(updated)) issues.push(makeError(`Linha ${rowNumber}: Atualizado em inválido "${updated}" (YYYY-MM-DD)`));
    if (!ref) issues.push(makeError(`Linha ${rowNumber}: Referência vazia`));

    const progress = Number(progressRaw);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      issues.push(makeError(`Linha ${rowNumber}: Progresso inválido "${progressRaw}" (0-100)`));
    } else {
      if (status === 'done' && progress !== 100) issues.push(makeError(`Linha ${rowNumber}: Status done exige Progresso 100`));
      if (status !== 'done' && progress === 100) issues.push(makeError(`Linha ${rowNumber}: Progresso 100 exige Status done`));
    }

    if (status !== 'done' && isIsoDate(due) && due < today) {
      issues.push(makeError(`Linha ${rowNumber}: Tarefa ativa com prazo vencido (${due})`));
    }

    if (status !== 'done' && isIsoDate(updated) && updated < today) {
      issues.push(makeWarn(`Linha ${rowNumber}: Tarefa ativa não foi atualizada hoje (${updated})`));
    }
  }

  return issues;
}

function validateCheckboxMarkup(raw) {
  const issues = [];
  const invalidUpperX = raw.match(/-\s*\[X\]\s+/g);
  if (invalidUpperX) issues.push(makeError('Marcação inválida: use "- [x]" (minúsculo) em vez de "- [X]"'));
  const missingSpace = raw.match(/-\s*\[(x| )\](\S)/g);
  if (missingSpace) issues.push(makeError('Marcação inválida: use espaço após "]" em checklists (ex.: "- [ ] Tarefa")'));
  return issues;
}

const raw = await fs.readFile(TASKS_FILE, 'utf8');
const rows = findRegistryTable(raw);
if (!rows) {
  console.error('ERRO: não foi possível localizar a tabela em "## Registro de Tarefas (Obrigatório)" em project-tasks.md');
  process.exit(1);
}

const [header, separator, ...dataRows] = rows;
if (!separator?.every((c) => /^:?-{3,}:?$/.test(c) || c === '---')) {
  console.error('ERRO: tabela do Registro de Tarefas parece inválida (linha separadora ausente/incorreta).');
  process.exit(1);
}

const issues = [...validateRows(header, dataRows), ...validateCheckboxMarkup(raw)];
const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn');

for (const w of warns) console.warn(`AVISO: ${w.message}`);
for (const e of errors) console.error(`ERRO: ${e.message}`);

if (errors.length > 0) process.exit(1);
if (process.env.TASKS_STRICT === '1' && warns.length > 0) process.exit(1);
