import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import os from 'node:os';
import YAML from 'yaml';
import { parseSkill } from '../../scripts/skill-catalog.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const exists = p => fs.existsSync(p);
const stripCode = text => text.replace(/```[^\n]*\n[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

function walk(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['.git', 'node_modules', 'results', 'inputs'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function anchors(text) {
  const counts = new Map();
  return stripCode(text).split('\n').filter(l => /^#{1,6} /.test(l)).map(l => {
    const base = l.replace(/^#{1,6} /, '').trim().toLowerCase()
      .replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    return base + (n ? `-${n}` : '');
  });
}

export function check(root, { forms = true } = {}) {
  const findings = [];
  const add = (code, file, detail) => findings.push({ code, file: path.relative(root, file).replaceAll('\\', '/'), detail });
  const yaml = file => {
    try {
      const doc = YAML.parseDocument(read(file), { uniqueKeys: true });
      if (doc.errors.length) throw doc.errors[0];
      return doc.toJS();
    } catch (e) { add('YAML', file, e.message); return null; }
  };
  const skills = path.join(root, 'skills');
  if (!exists(skills)) add('SKILLS_MISSING', skills, 'skills がない');
  for (const dir of exists(skills) ? fs.readdirSync(skills) : []) {
    const folder = path.join(skills, dir);
    if (!fs.statSync(folder).isDirectory()) continue;
    const skill = path.join(folder, 'SKILL.md');
    if (!exists(skill)) { add('SKILL_MISSING', skill, 'SKILL.md がない'); continue; }
    const text = read(skill);
    const parsed = parseSkill(text, dir);
    for (const error of parsed.errors) add(error.code, skill, error.detail);
    if (parsed.errors.some(error => error.code === 'FRONTMATTER')) continue;
    if (!exists(path.join(root, 'tests', dir))) add('TESTS_MISSING', skill, '対応 tests がない');
    // このリポジトリの docs 命名規約。意味上の対応は人が確認する。
    if (!exists(path.join(root, 'docs', dir.replace(/^ateliers-/, '') + '.md')))
      add('DOCS_MISSING', skill, '対応 docs がない');
  }
  for (const file of walk(root).filter(p => p.endsWith('.md'))) {
    const text = read(file);
    if (file.startsWith(path.join(root, 'docs') + path.sep)) {
      const header = text.match(/^# [^\r\n]+\r?\n\s*\n([^\r\n]+)/);
      const dates = header?.[1].match(/^作成日：(\d{4}-\d{2}-\d{2}) ／ 更新日：(\d{4}-\d{2}-\d{2})（日本標準時 JST \(UTC\+09:00\)）$/);
      if (!dates) add('DOC_DATE', file, 'H1 直後の日付・JST 表記がない');
      else {
        const valid = d => { const t = new Date(d + 'T00:00:00+09:00'); return !Number.isNaN(+t) && new Date(+t + 9 * 3600000).toISOString().slice(0, 10) === d; };
        if (!valid(dates[1]) || !valid(dates[2]) || dates[1] > dates[2]) add('DOC_DATE_VALUE', file, '日付または順序が不正');
      }
    }
    // 通常のインラインリンク・画像と参照形式の定義を検査。HTML/MDX は対象外。
    const prose = stripCode(text);
    const urls = [...prose.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(m => m[1]);
    urls.push(...[...prose.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)].map(m => m[1]));
    for (const raw of urls) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) continue;
      let target, anchor;
      try { [target, anchor] = raw.replace(/^<|>$/g, '').split('#').map(decodeURIComponent); }
      catch { add('LINK_ENCODING', file, raw); continue; }
      const dest = target ? path.resolve(path.dirname(file), target) : file;
      if (!exists(dest)) { add('LINK_MISSING', file, raw); continue; }
      if (anchor && dest.endsWith('.md') && !anchors(read(dest)).includes(anchor)) add('ANCHOR_MISSING', file, raw);
      if (file.startsWith(path.join(root, 'docs') + path.sep) && !dest.startsWith(path.join(root, 'docs') + path.sep))
        add('DOC_LINK_OUTSIDE', file, raw);
    }
  }
  if (forms) {
    const dir = path.join(root, '.github/ISSUE_TEMPLATE');
    const expected = ['request', 'defect', 'improvement', 'maintenance'].map(k => `skill-${k}.yml`);
    const actual = exists(dir) ? fs.readdirSync(dir).filter(n => /\.ya?ml$/.test(n) && !/^config\.ya?ml$/.test(n)) : [];
    if (actual.length !== 4 || expected.some(n => !actual.includes(n))) add('FORMS_COUNT', dir, '所定の4 Forms が必要');
    const names = new Set();
    for (const name of actual) {
      const file = path.join(dir, name), form = yaml(file);
      if (!form) continue;
      if (typeof form.name !== 'string' || names.has(form.name) || typeof form.description !== 'string' || !form.description.trim() || !Array.isArray(form.body)) {
        add('FORM_SCHEMA', file, 'name/description/body が不正'); continue;
      }
      names.add(form.name);
      const ids = new Set(); let required = 0;
      for (const field of form.body) {
        if (field.type === 'markdown') {
          if (typeof field.attributes?.value !== 'string') add('FORM_SCHEMA', file, 'markdown value がない');
          continue;
        }
        if (!['textarea', 'input', 'dropdown', 'checkboxes'].includes(field.type) || !/^[a-zA-Z0-9_-]+$/.test(field.id ?? '') || ids.has(field.id) || !field.attributes?.label)
          add('FORM_SCHEMA', file, 'field type/id/label が不正');
        ids.add(field.id);
        if (typeof field.validations?.required !== 'boolean') add('FORM_SCHEMA', file, 'required は真偽値');
        if (field.validations?.required) required++;
      }
      if (required > 3 || required === 0) add('FORM_REQUIRED', file, '必須は1〜3項目');
    }
  }
  return findings;
}

function selfTest() {
  assert.deepEqual(check(path.join(here, 'inputs/normal'), { forms: false }), []);
  const bad = check(path.join(here, 'inputs/problematic'), { forms: false });
  for (const code of ['NAME_MISMATCH', 'NAME_FORMAT', 'TESTS_MISSING', 'LINK_MISSING', 'DOC_DATE'])
    assert(bad.some(f => f.code === code), `問題例で ${code} を検出すること`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ateliers-check-'));
  try {
    fs.cpSync(path.join(here, 'inputs/normal'), tmp, { recursive: true });
    const doc = path.join(tmp, 'docs/sample-review.md');
    const original = read(doc);
    fs.writeFileSync(doc, original.replace('2026-11-06', '2026-02-30'));
    assert(check(tmp, { forms: false }).some(f => f.code === 'DOC_DATE_VALUE'));
    fs.writeFileSync(doc, original + '\n[不存在の見出し](README.md#missing)\n');
    assert(check(tmp, { forms: false }).some(f => f.code === 'ANCHOR_MISSING'));
    const skill = path.join(tmp, 'skills/ateliers-sample-review/SKILL.md');
    fs.writeFileSync(skill, read(skill).replace('name: ateliers-sample-review', 'name: [broken'));
    assert(check(tmp, { forms: false }).some(f => f.code === 'FRONTMATTER'));
    assert(check(tmp).some(f => f.code === 'FORMS_COUNT'));
    const forms = path.join(tmp, '.github/ISSUE_TEMPLATE');
    fs.mkdirSync(forms, { recursive: true });
    fs.cpSync(path.join(repo, '.github/ISSUE_TEMPLATE'), forms, { recursive: true });
    const form = path.join(forms, 'skill-defect.yml');
    fs.appendFileSync(form, '\nname: duplicate\n');
    assert(check(tmp).some(f => f.code === 'YAML'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log('PASS: 正常例、問題例、日付・アンカー・壊れた YAML・Forms 欠落と重複キー');
}

if (process.argv.includes('--self-test')) selfTest();
else {
  const findings = check(repo);
  for (const f of findings) console.error(`${f.code} ${f.file}: ${f.detail}`);
  console.log(`${findings.length ? 'FAIL' : 'PASS'}: 構造・ローカルリンク・docs 日付・Issue Forms (${findings.length} findings)`);
  process.exitCode = findings.length ? 1 : 0;
}
