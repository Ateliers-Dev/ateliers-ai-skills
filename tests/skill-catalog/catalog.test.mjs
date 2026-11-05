import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildCatalog, parseSkill, toMarkdown } from '../../scripts/skill-catalog.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(repo, 'scripts/skill-catalog.mjs');
const source = (name, description = '文書を確認する。') => `---\nname: ${name}\ndescription: ${description}\n---\n\n# 本文\n`;

function fixture(t, entries = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ateliers-catalog-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'skills'));
  for (const [name, text] of Object.entries(entries)) {
    const dir = path.join(root, 'skills', name);
    fs.mkdirSync(dir);
    if (text !== null) fs.writeFileSync(path.join(dir, 'SKILL.md'), text);
  }
  return root;
}

function cli(args, cwd = os.tmpdir()) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('一覧はfrontmatterの値・ルート相対POSIXパス・固定順序、本文・fixturesは対象外', t => {
  const root = fixture(t, {
    'ateliers-zulu': source('ateliers-zulu', '最後'),
    'ateliers-alpha': source('ateliers-alpha', '先頭') + 'description: 本文の値\n',
  });
  fs.mkdirSync(path.join(root, 'tests/skills/ateliers-fake'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills/README.md'), '説明');
  const expected = {
    schemaVersion: 1, mode: 'list', query: '',
    skills: [
      { name: 'ateliers-alpha', description: '先頭', path: 'skills/ateliers-alpha/SKILL.md' },
      { name: 'ateliers-zulu', description: '最後', path: 'skills/ateliers-zulu/SKILL.md' },
    ], duplicateCandidates: [], errors: [],
  };
  assert.deepEqual(buildCatalog(root), expected);
  assert.deepEqual(buildCatalog(root), expected);
});

for (const mode of ['list', 'duplicates']) {
  test(`${mode}は非空queryを適用せず空文字を返す`, t => {
    const root = fixture(t, {
      'ateliers-alpha-review': source('ateliers-alpha-review', '文書'),
      'ateliers-beta-review': source('ateliers-beta-review', 'コード'),
    });
    const result = buildCatalog(root, { mode, query: '用途' });
    assert.equal(result.query, '');
    assert.deepEqual(result, buildCatalog(root, { mode }));
    assert.equal(result.skills.length, 2);
    assert.equal(result.duplicateCandidates.length, mode === 'duplicates' ? 1 : 0);
    assert.equal(buildCatalog(path.join(root, 'absent'), { mode, query: '用途' }).query, '');
  });
}

for (const mode of ['search', 'candidates']) {
  test(`${mode}は実際に適用する正規化済みqueryを返す`, t => {
    const root = fixture(t, {
      'ateliers-alpha': source('ateliers-alpha', '文書 ＡＢＣ'),
      'ateliers-beta': source('ateliers-beta', 'コード ABC'),
    });
    const query = '　ＡＢＣ\t文書\nabc  ';
    const result = buildCatalog(root, { mode, query });
    assert.equal(result.query, 'abc 文書');
    assert.deepEqual(result.skills.map(s => s.name), mode === 'search' ? ['ateliers-alpha'] : ['ateliers-alpha', 'ateliers-beta']);
    assert.deepEqual(result, buildCatalog(root, { mode, query: result.query }));
    const empty = buildCatalog(root, { mode, query: '　 \t\n' });
    assert.equal(empty.query, '');
    assert.equal(empty.skills.length, 2);
    assert.equal(buildCatalog(path.join(root, 'absent'), { mode, query }).query, 'abc 文書');
    const output = cli(['--root', root, `--${mode}`, query, '--json']);
    assert.equal(output.status, 0);
    assert.equal(output.stderr, '');
    assert.deepEqual(JSON.parse(output.stdout), result);
  });
}

test('BOM・CRLF・quoted/block scalar・追加メタデータをYAMLとして解釈', () => {
  const text = '\uFEFF---\r\nname: "ateliers-alpha"\r\ndescription: >-\r\n  日本語の説明\r\n  続き\r\nmetadata:\r\n  version: 1\r\n---\r\n本文';
  assert.deepEqual(parseSkill(text, 'ateliers-alpha'), { name: 'ateliers-alpha', description: '日本語の説明 続き', errors: [] });
});

const malformed = {
  missing: 'name: ateliers-alpha',
  unclosed: '---\nname: ateliers-alpha\n',
  syntax: '---\nname: [broken\n---\n',
  duplicate: '---\nname: ateliers-alpha\nname: ateliers-alpha\n---\n',
  sequence: '---\n- name\n---\n',
  scalar: '---\nhello\n---\n',
  null: '---\nnull\n---\n',
  alias: '---\nname: *missing\n---\n',
  multipleDocuments: '---\nname: ateliers-alpha\n...\nname: broken\n---\n',
};
for (const [name, input] of Object.entries(malformed)) {
  test(`不正frontmatter: ${name}`, () => {
    assert.equal(parseSkill(input, 'ateliers-alpha').errors[0].code, 'FRONTMATTER');
  });
}

for (const [name, input, code] of [
  ['名前欠落', 'description: 文書', 'NAME_FORMAT'],
  ['名前の型', 'name: [ateliers-alpha]\ndescription: 文書', 'NAME_FORMAT'],
  ['名前不一致', 'name: ateliers-beta\ndescription: 文書', 'NAME_MISMATCH'],
  ['接頭辞', 'name: alpha\ndescription: 文書', 'NAME_FORMAT'],
  ['大文字', 'name: ateliers-Alpha\ndescription: 文書', 'NAME_FORMAT'],
  ['長さ', `name: ateliers-${'a'.repeat(56)}\ndescription: 文書`, 'NAME_FORMAT'],
  ['説明欠落', 'name: ateliers-alpha', 'DESCRIPTION'],
  ['説明の型', 'name: ateliers-alpha\ndescription: 123', 'DESCRIPTION'],
  ['空説明', 'name: ateliers-alpha\ndescription: "  "', 'DESCRIPTION'],
]) {
  test(`メタデータ検証: ${name}`, () => {
    assert(parseSkill(`---\n${input}\n---\n`, 'ateliers-alpha').errors.some(e => e.code === code));
  });
}

test('検索はname/description/pathのNFKC・大文字小文字を無視した部分一致AND、候補はOR', t => {
  const root = fixture(t, {
    'ateliers-alpha': source('ateliers-alpha', '文書 ＡＢＣ'),
    'ateliers-beta': source('ateliers-beta', 'コード ABC'),
  });
  const names = options => buildCatalog(root, options).skills.map(s => s.name);
  assert.deepEqual(names({ mode: 'search', query: 'abc 文書' }), ['ateliers-alpha']);
  assert.deepEqual(names({ mode: 'search', query: 'SKILL.MD ALPHA' }), ['ateliers-alpha']);
  assert.deepEqual(names({ mode: 'search', query: '未知' }), []);
  assert.equal(names({ mode: 'search', query: '  ' }).length, 2);
  assert.equal(names({ mode: 'candidates', query: '文書 コード' }).length, 2);
  assert.equal(names({ mode: 'search', query: '文書 コード' }).length, 0);
});

test('重複候補は共通name語・正規化した同一descriptionと根拠を返す', t => {
  const root = fixture(t, {
    'ateliers-alpha-review': source('ateliers-alpha-review', '文書'),
    'ateliers-beta-review': source('ateliers-beta-review', '別の用途'),
    'ateliers-gamma': source('ateliers-gamma', '文書'),
    'ateliers-unrelated': source('ateliers-unrelated', '孤立'),
  });
  const result = buildCatalog(root, { mode: 'duplicates' });
  assert.deepEqual(result.duplicateCandidates, [
    { paths: ['skills/ateliers-alpha-review/SKILL.md', 'skills/ateliers-beta-review/SKILL.md'], reasons: ['shared-name-token'], sharedNameTokens: ['review'] },
    { paths: ['skills/ateliers-alpha-review/SKILL.md', 'skills/ateliers-gamma/SKILL.md'], reasons: ['same-description'], sharedNameTokens: [] },
  ]);
  assert.equal(result.skills.length, 4);
  assert.equal(buildCatalog(root).duplicateCandidates.length, 0);
});

test('空集合・欠落ディレクトリ・SKILL欠落・読込不能を区別し、検索外の不正も報告', t => {
  const root = fixture(t);
  assert.deepEqual(buildCatalog(root).errors, []);
  assert.deepEqual(buildCatalog(root).skills, []);
  fs.mkdirSync(path.join(root, 'skills/ateliers-missing'));
  fs.mkdirSync(path.join(root, 'skills/ateliers-directory/SKILL.md'), { recursive: true });
  const result = buildCatalog(root, { mode: 'search', query: '無関係' });
  assert.deepEqual(result.errors.map(e => [e.code, e.path]), [
    ['SKILL_READ', 'skills/ateliers-directory/SKILL.md'], ['SKILL_READ', 'skills/ateliers-missing/SKILL.md'],
  ]);
  assert.equal(buildCatalog(path.join(root, 'absent')).errors[0].code, 'SKILLS_READ');
});

test('CLI JSONは単一の版付きオブジェクト、エラー時も有効なSkillを返し終了1', t => {
  const root = fixture(t, { 'ateliers-alpha': source('ateliers-alpha'), 'ateliers-bad': '不正' });
  const result = cli(['--root', root, '--json', '--search', 'alpha']);
  assert.equal(result.status, 1);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.skills.length, 1);
  assert.equal(json.errors[0].code, 'FRONTMATTER');
  assert.match(result.stderr, /FRONTMATTER skills\/ateliers-bad\/SKILL.md/);
});

test('CLIは作業場所に依存せず既存2Skillを取得、JSON/Markdown・候補・ヘルプを出力', t => {
  const json = cli(['--format', 'json']);
  assert.equal(json.status, 0);
  assert.equal(json.stderr, '');
  assert.deepEqual(JSON.parse(json.stdout).skills.map(s => s.name), ['ateliers-document-review', 'ateliers-skill-review']);
  const root = fixture(t, { 'ateliers-alpha': source('ateliers-alpha') });
  const md = cli(['--root', root]);
  assert.equal(md.status, 0);
  assert.match(md.stdout, /^# Skill Catalog/);
  assert.match(md.stdout, /\| ateliers-alpha \| 文書を確認する。 \| skills\/ateliers-alpha\/SKILL.md \|/);
  assert.equal(JSON.parse(cli(['--root', root, '--candidates', '文書', '--json']).stdout).skills.length, 1);
  assert.equal(JSON.parse(cli(['--root', root, '--duplicates', '--json']).stdout).mode, 'duplicates');
  assert.match(cli(['--help']).stdout, /Usage:/);
});

test('CLIの不正な引数は標準出力を汚さず終了2', () => {
  for (const args of [['--unknown'], ['--root'], ['--search', '--json'], ['--format', 'xml'], ['--search', 'a', '--duplicates']]) {
    const result = cli(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /ARGUMENT:/);
  }
});

test('Markdownは表の区切り・改行・HTML・バッククォートをエスケープ', () => {
  const result = { schemaVersion: 1, mode: 'search', query: '<script>|`', skills: [
    { name: 'ateliers-alpha', description: '一行\n二行|<tag>`', path: 'skills/ateliers-alpha/SKILL.md' },
  ], duplicateCandidates: [], errors: [{ code: 'FRONTMATTER', path: 'skills/bad/SKILL.md', detail: '一行\n二行' }] };
  const md = toMarkdown(result);
  assert.match(md, /一行 二行&#124;&lt;tag&gt;&#96;/);
  assert(!md.includes('<script>'));
});

test('シンボリックリンクを追跡せず明示的に報告', t => {
  const root = fixture(t);
  try { fs.symlinkSync(os.tmpdir(), path.join(root, 'skills/ateliers-link'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('リンク作成権限がない環境'); return; }
    throw error;
  }
  assert.equal(buildCatalog(root).errors[0].code, 'SYMLINK');
});
