import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const normalize = value => value.normalize('NFKC').toLowerCase();
const terms = value => [...new Set(normalize(value).split(/\s+/u).filter(Boolean))];

// 構造チェッカーと同じ frontmatter・命名規約を使う。
export function parseSkill(text, folder) {
  const errors = [];
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let meta;
  try {
    if (!match) throw Error('先頭に閉じた YAML frontmatter が必要');
    const doc = YAML.parseDocument(match[1], { uniqueKeys: true });
    if (doc.errors.length) throw doc.errors[0];
    meta = doc.toJS({ maxAliasCount: 100 });
    if (!meta || Array.isArray(meta) || typeof meta !== 'object') throw Error('frontmatter は mapping が必要');
  } catch (error) {
    return { errors: [{ code: 'FRONTMATTER', detail: error.message }] };
  }
  if (meta.name !== folder) errors.push({ code: 'NAME_MISMATCH', detail: 'name とフォルダ名が不一致' });
  if (typeof meta.name !== 'string' || !/^ateliers-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name) || meta.name.length > 64)
    errors.push({ code: 'NAME_FORMAT', detail: 'name は64文字以内の ateliers- 接頭辞付き小文字英数字・ハイフンが必要' });
  if (typeof meta.description !== 'string' || !meta.description.trim())
    errors.push({ code: 'DESCRIPTION', detail: 'description は空でない文字列が必要' });
  return { name: meta.name, description: meta.description, errors };
}

export function buildCatalog(root = repo, { query = '', mode = 'list' } = {}) {
  if (!['list', 'search', 'candidates', 'duplicates'].includes(mode)) throw Error('未知の mode');
  const result = { schemaVersion: 1, mode, query, skills: [], duplicateCandidates: [], errors: [] };
  const add = (code, file, detail) => result.errors.push({ code, path: file, detail });
  const dir = path.join(root, 'skills');
  let entries;
  try {
    if (fs.lstatSync(dir).isSymbolicLink()) throw Error('skills のシンボリックリンクは対象外');
    entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name));
  } catch (error) {
    add('SKILLS_READ', 'skills', error.message);
    return result;
  }
  for (const entry of entries) {
    const file = `skills/${entry.name}/SKILL.md`;
    if (entry.isSymbolicLink()) { add('SYMLINK', `skills/${entry.name}`, 'シンボリックリンクは対象外'); continue; }
    if (!entry.isDirectory()) continue;
    try {
      const absolute = path.join(dir, entry.name, 'SKILL.md');
      if (fs.lstatSync(absolute).isSymbolicLink()) { add('SYMLINK', file, 'シンボリックリンクは対象外'); continue; }
      const parsed = parseSkill(fs.readFileSync(absolute, 'utf8'), entry.name);
      for (const error of parsed.errors) add(error.code, file, error.detail);
      if (!parsed.errors.length) result.skills.push({ name: parsed.name, description: parsed.description, path: file });
    } catch (error) { add('SKILL_READ', file, error.message); }
  }
  // 並び・根拠を固定し、語彙による候補抽出と意味上の判断を分離する。
  if (mode === 'duplicates') {
    for (let i = 0; i < result.skills.length; i++) {
      for (let j = i + 1; j < result.skills.length; j++) {
        const a = result.skills[i], b = result.skills[j];
        const sharedNameTokens = a.name.slice(9).split('-').filter(t => b.name.slice(9).split('-').includes(t));
        const reasons = [];
        if (normalize(a.description).trim() === normalize(b.description).trim()) reasons.push('same-description');
        if (sharedNameTokens.length) reasons.push('shared-name-token');
        if (reasons.length) result.duplicateCandidates.push({ paths: [a.path, b.path], reasons, sharedNameTokens: [...new Set(sharedNameTokens)].sort(compare) });
      }
    }
  }
  if (mode === 'search' || mode === 'candidates') {
    const keywords = terms(query);
    result.skills = result.skills.filter(skill => {
      const fields = [skill.name, skill.description, skill.path].map(normalize);
      const matches = term => fields.some(field => field.includes(term));
      return keywords.length === 0 || (mode === 'search' ? keywords.every(matches) : keywords.some(matches));
    });
  }
  return result;
}

const cell = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replace(/[\\|`\[\]*_~!]/g, char => `&#${char.charCodeAt(0)};`).replace(/[\r\n]+/g, ' ');

export function toMarkdown(result) {
  const lines = ['# Skill Catalog', '', `形式：${result.schemaVersion} / mode：${result.mode} / query：${cell(result.query)}`, '',
    '| name | description | path |', '| --- | --- | --- |'];
  for (const skill of result.skills) lines.push(`| ${cell(skill.name)} | ${cell(skill.description)} | ${cell(skill.path)} |`);
  lines.push('', `件数：${result.skills.length}`, '', '## 重複候補（意味的な重複は未判定）', '');
  for (const candidate of result.duplicateCandidates)
    lines.push(`- ${candidate.paths.map(cell).join(' / ')}：${candidate.reasons.join(', ')} (${candidate.sharedNameTokens.map(cell).join(', ')})`);
  if (!result.duplicateCandidates.length) lines.push('候補なし');
  lines.push('', '## エラー', '');
  for (const error of result.errors) lines.push(`- ${error.code} ${cell(error.path)}：${cell(error.detail)}`);
  if (!result.errors.length) lines.push('なし');
  return lines.join('\n') + '\n';
}

export function main(args = process.argv.slice(2)) {
  let root = repo, mode = 'list', query = '', format = 'markdown', selected = false;
  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--help') {
        console.log('Usage: node scripts/skill-catalog.mjs [--root PATH] [--search TEXT | --candidates TEXT | --duplicates] [--format json|markdown]');
        return 0;
      }
      if (arg === '--json') { format = 'json'; continue; }
      if (['--root', '--search', '--candidates', '--format'].includes(arg)) {
        const value = args[++i];
        if (value === undefined || value.startsWith('--')) throw Error(`${arg} に値が必要`);
        if (arg === '--root') root = path.resolve(value);
        else if (arg === '--format') format = value;
        else {
          if (selected) throw Error('検索・候補・重複モードは併用不可');
          selected = true; mode = arg.slice(2); query = value;
        }
      } else if (arg === '--duplicates') {
        if (selected) throw Error('検索・候補・重複モードは併用不可');
        selected = true; mode = 'duplicates';
      } else throw Error(`未知の引数：${arg}`);
    }
    if (!['json', 'markdown'].includes(format)) throw Error('format は json または markdown');
  } catch (error) { console.error(`ARGUMENT: ${error.message}`); return 2; }
  const result = buildCatalog(root, { mode, query });
  process.stdout.write(format === 'json' ? JSON.stringify(result, null, 2) + '\n' : toMarkdown(result));
  for (const error of result.errors) console.error(`${error.code} ${error.path}: ${error.detail}`);
  return result.errors.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
