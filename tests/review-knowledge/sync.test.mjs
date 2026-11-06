import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { patterns, renderPattern, rewriteLinks, syncKnowledge } from '../../scripts/sync-review-knowledge.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = patterns[0];
const source = fs.readFileSync(path.join(repo, entry.source), 'utf8').replace(/\r\n/g, '\n');
const fixed = 'https://github.com/Ateliers-Dev/ateliers-ai-skills/commit/01e419a732b8398d9703f2767b53aac9656dac79';
function put(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ateliers-knowledge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of [entry.source, 'knowledge/reviews/README.md', 'knowledge/reviews/cases/pr-0009-path-validation.md']) {
    put(root, file, fs.readFileSync(path.join(repo, file)));
  }
  return root;
}
test('生成物は正規化本文のSHA256を持ち、別配置・BOM/CRLFでも同一バイトになる', t => {
  const root = fixture(t), other = fixture(t);
  const normalized = source.replace(/\n*$/, '\n');
  const hash = createHash('sha256').update(normalized).digest('hex');
  const before = fs.readFileSync(path.join(root, entry.source));
  const text = renderPattern(root, entry);
  assert.ok(text.includes(`内容SHA256 (UTF-8/LF正規化・リンク変換前): ${hash}`));
  assert.match(text, /直接編集禁止/);
  assert.ok(text.includes(`正本: ${entry.source}`));
  assert.ok(!text.includes('\r') && text.endsWith('\n') && !text.endsWith('\n\n'));
  put(other, entry.source, '\uFEFF' + normalized.replace(/\n/g, '\r\n'));
  assert.equal(renderPattern(other, entry), text);
  syncKnowledge(root, { write: true });
  assert.deepEqual(fs.readFileSync(path.join(root, entry.source)), before);
  const output = path.join(root, entry.output);
  const original = fs.readFileSync(output);
  syncKnowledge(root, { write: true });
  assert.deepEqual(fs.readFileSync(output), original);
  // HEADと作業ディレクトリは入力にしない。
  put(root, '.git/HEAD', 'ref: refs/heads/unrelated\n');
  assert.equal(renderPattern(root, entry), text);
});
test('欠落・本文/ヘッダーの手編集・正本更新を検出し、照合では一切修復しない', t => {
  const root = fixture(t), output = path.join(root, entry.output);
  assert.throws(() => syncKnowledge(root), /欠落または未同期/);
  assert.ok(!fs.existsSync(path.join(root, 'skills')));
  syncKnowledge(root, { write: true });
  syncKnowledge(root);
  const expected = fs.readFileSync(output, 'utf8');
  for (const changed of [expected + 'manual\n', expected.replace('直接編集禁止', '編集可能'), expected.replace(/\n/g, '\r\n')]) {
    fs.writeFileSync(output, changed);
    const stamp = fs.statSync(output).mtimeMs;
    assert.throws(() => syncKnowledge(root), /欠落または未同期/);
    assert.equal(fs.readFileSync(output, 'utf8'), changed);
    assert.equal(fs.statSync(output).mtimeMs, stamp);
  }
  fs.writeFileSync(output, expected);
  put(root, entry.source, source + '\n追記\n');
  assert.throws(() => syncKnowledge(root), /欠落または未同期/);
  assert.equal(fs.readFileSync(output, 'utf8'), expected);
  syncKnowledge(root, { write: true });
  syncKnowledge(root);
  fs.unlinkSync(output);
  assert.throws(() => syncKnowledge(root), /欠落または未同期/);
  assert.ok(!fs.existsSync(output));
});
test('相対リンクを配布先に依存しないURLへ変換し、固定コミットを保持する', t => {
  const root = fixture(t);
  const input = `[事例](../cases/pr-0009-path-validation.md) [入口](../README.md#更新方法) [固定](${fixed})`;
  assert.equal(rewriteLinks(input, entry.source, root),
    `[事例](https://github.com/Ateliers-Dev/ateliers-ai-skills/blob/main/knowledge/reviews/cases/pr-0009-path-validation.md) [入口](https://github.com/Ateliers-Dev/ateliers-ai-skills/blob/main/knowledge/reviews/README.md#更新方法) [固定](${fixed})`);
  const code = '`[例](missing.md)`\n\n```md\n[例](missing.md)\n```\n';
  assert.equal(rewriteLinks(code, entry.source, root), code);
});
test('未対応・不正・不存在のリンクをエラーにし、生成済みファイルを変更しない', t => {
  const root = fixture(t);
  syncKnowledge(root, { write: true });
  const before = fs.readFileSync(path.join(root, entry.output));
  for (const bad of ['[x](missing.md)', '[x](../../../../outside.md)', '[x](file:///tmp/a)', '[x](//host/a)',
    '[x](javascript:alert)', '[x](../README.md "title")', '[x][id]\n[id]: ../README.md',
    '![x](../README.md)', '<a href="../README.md">x</a>', '<../README.md>', '[x](../%zz.md)',
    '[x](..\\README.md)', '[nested [x]](../README.md)', '[x](../)', '[x](https://user:pass@example.com/a)']) {
    put(root, entry.source, source + '\n' + bad + '\n');
    assert.throws(() => syncKnowledge(root, { write: true }), undefined, bad);
    assert.deepEqual(fs.readFileSync(path.join(root, entry.output)), before);
  }
});
test('Git管理の生成物は同期済みで、Skillのみの配布に6観点と証拠・限界が残る', t => {
  syncKnowledge(repo);
  const installed = fs.mkdtempSync(path.join(os.tmpdir(), 'ateliers-distributed-'));
  t.after(() => fs.rmSync(installed, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'skills/ateliers-pr-review'), path.join(installed, 'ateliers-pr-review'), { recursive: true });
  assert.ok(!fs.existsSync(path.join(installed, 'knowledge')));
  const text = fs.readFileSync(path.join(installed, 'ateliers-pr-review/references/filesystem-path-safety.md'), 'utf8');
  assert.match(text, /## 対象技術・適用条件/);
  assert.match(text, /## 根拠・確認状況/);
  const sections = [...text.matchAll(/^## [1-6]\. .+\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  assert.equal(sections.length, 6);
  for (const section of sections) {
    for (const field of ['適用条件', '確認する問い', '入力例', '必要な証拠', '限界', '出典事例']) assert.ok(section[1].includes(`**${field}：**`));
  }
  assert.ok(text.includes(fixed));
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]);
  assert.ok(links.length >= 4);
  assert.ok(links.every(url => /^https:\/\//.test(url)));
});
test('CLIは既定と--checkが照合のみ、未知引数は失敗（別cwdからも実行可能）', () => {
  for (const args of [[], ['--check'], ['--bad'], ['--write', '--check']]) {
    const result = spawnSync(process.execPath, [path.join(repo, 'scripts/sync-review-knowledge.mjs'), ...args], { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, args.includes('--bad') || args.length > 1 ? 1 : 0, result.stderr);
  }
});

// リンク作成自体が権限/機能不足の場合だけ未実施にする。検査の失敗は skip しない。
function makeLink(t, target, link, type) {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try {
    fs.symlinkSync(target, link, type);
    return true;
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) throw error;
    t.skip(`${type} 作成不可: ${error.code}`);
    return false;
  }
}
function snapshot(file) {
  return { bytes: fs.readFileSync(file), mtime: fs.statSync(file, { bigint: true }).mtimeNs };
}
function assertRejected(root) {
  for (const options of [{ write: true }, { write: false }, undefined]) {
    assert.throws(() => syncKnowledge(root, options), /リンク経由|実体が異なる/);
  }
}

const directoryTypes = process.platform === 'win32' ? ['junction', 'dir'] : ['dir'];
for (const type of directoryTypes) {
  test(`${type}: 存在しない生成先の親を外部に作らない`, t => {
    const root = fixture(t), outside = fixture(t);
    put(outside, 'marker.md', '外部の目印\n');
    const marker = path.join(outside, 'marker.md'), before = snapshot(marker);
    if (!makeLink(t, outside, path.join(root, 'skills'), type)) return;
    assertRejected(root);
    assert.deepEqual(snapshot(marker), before);
    assert.ok(!fs.existsSync(path.join(outside, 'ateliers-pr-review')));
  });
  for (const location of ['knowledge', 'knowledge/reviews/patterns', 'skills',
    'skills/ateliers-pr-review/references', 'knowledge/reviews/cases']) {
    for (const missing of [false, true]) {
      test(`${type}: ${location} 経由を生成/照合で拒否（外部末端${missing ? 'なし' : 'あり'}）`, t => {
        const root = fixture(t), outside = fixture(t);
        syncKnowledge(root, { write: true });
        const link = path.join(root, location), target = path.join(outside, 'target');
        fs.cpSync(link, target, { recursive: true });
        const outputBefore = snapshot(path.join(root, entry.output));
        // 外部ファイルは同期済みと同じ内容でも拒否。不存在でも親リンクで拒否。
        const victimRelative = location === 'knowledge' ? 'reviews/patterns/filesystem-path-safety.md'
          : location === 'skills' ? 'ateliers-pr-review/references/filesystem-path-safety.md'
          : location.endsWith('cases') ? 'pr-0009-path-validation.md' : 'filesystem-path-safety.md';
        const victim = path.join(target, victimRelative);
        if (missing) fs.unlinkSync(victim);
        put(outside, 'marker.md', '外部の目印\n');
        const marker = path.join(outside, 'marker.md');
        const watched = [marker, ...(missing ? [] : [victim])];
        for (const file of watched) fs.utimesSync(file, new Date('2001-01-01Z'), new Date('2001-01-01Z'));
        const before = watched.map(snapshot);
        fs.rmSync(link, { recursive: true });
        if (!makeLink(t, target, link, type)) return;
        assertRejected(root);
        assert.deepEqual(watched.map(snapshot), before);
        if (missing) assert.ok(!fs.existsSync(victim));
        if (!location.startsWith('skills')) assert.deepEqual(snapshot(path.join(root, entry.output)), outputBefore);
        if (location.endsWith('cases')) {
          assert.throws(() => rewriteLinks('[外部](../cases/pr-0009-path-validation.md)', entry.source, root), /リンク経由|実体が異なる/);
        }
      });
    }
  }
  test(`${type}: 内向きリンク、root自身・rootの親、壊れた親も拒否`, t => {
    const root = fixture(t), holder = fixture(t);
    syncKnowledge(root, { write: true });
    const output = path.join(root, entry.output), before = snapshot(output);
    const alias = path.join(holder, 'alias');
    if (!makeLink(t, root, alias, type)) return;
    assertRejected(alias);
    fs.unlinkSync(alias);
    if (!makeLink(t, path.dirname(root), alias, type)) return;
    assertRejected(path.join(alias, path.basename(root)));
    fs.unlinkSync(alias);
    const references = path.dirname(output), inside = path.join(root, 'internal-references');
    fs.renameSync(references, inside);
    if (!makeLink(t, inside, references, type)) return;
    assertRejected(root);
    assert.deepEqual(snapshot(path.join(inside, path.basename(output))), before);
    fs.unlinkSync(references);
    if (!makeLink(t, path.join(holder, 'missing-directory'), references, type)) return;
    assertRejected(root);
    assert.ok(!fs.existsSync(path.join(holder, 'missing-directory')));
  });
}

for (const file of [entry.source, entry.output, 'knowledge/reviews/README.md']) {
  for (const dangling of [false, true]) {
    test(`ファイルシンボリックリンク: ${file}（${dangling ? '壊れたリンク' : '外部実体あり'}）を拒否`, t => {
      const root = fixture(t), outside = fixture(t);
      syncKnowledge(root, { write: true });
      const link = path.join(root, file), target = path.join(outside, 'victim.md');
      if (!dangling) fs.copyFileSync(link, target);
      put(outside, 'marker.md', '不変\n');
      const watched = [path.join(outside, 'marker.md'), ...(dangling ? [] : [target])];
      const before = watched.map(snapshot);
      const outputBefore = snapshot(path.join(root, entry.output));
      fs.unlinkSync(link);
      if (!makeLink(t, target, link, 'file')) return;
      assertRejected(root);
      assert.deepEqual(watched.map(snapshot), before);
      if (dangling) assert.ok(!fs.existsSync(target));
      if (file !== entry.output) assert.deepEqual(snapshot(path.join(root, entry.output)), outputBefore);
    });
  }
}

test('CLIの既定/--check/--writeは外向き親リンクを拒否し外部内容・mtimeを保持', t => {
  const root = fixture(t), outside = fixture(t);
  syncKnowledge(root, { write: true });
  const references = path.dirname(path.join(root, entry.output));
  const target = path.join(outside, 'references');
  fs.cpSync(references, target, { recursive: true });
  fs.rmSync(references, { recursive: true });
  const victim = path.join(target, path.basename(entry.output)), before = snapshot(victim);
  if (!makeLink(t, target, references, process.platform === 'win32' ? 'junction' : 'dir')) return;
  put(root, 'scripts/sync-review-knowledge.mjs', fs.readFileSync(path.join(repo, 'scripts/sync-review-knowledge.mjs')));
  for (const args of [[], ['--check'], ['--write']]) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/sync-review-knowledge.mjs'), ...args], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /リンク経由|実体が異なる/);
    assert.deepEqual(snapshot(victim), before);
  }
});

test('正本の欠落・非ディレクトリ親・出力ディレクトリは副作用前に失敗', t => {
  for (const scenario of ['source-missing', 'parent-file', 'output-directory']) {
    const root = fixture(t), output = path.join(root, entry.output);
    if (scenario === 'source-missing') fs.unlinkSync(path.join(root, entry.source));
    if (scenario === 'parent-file') put(root, 'skills', 'directoryではない');
    if (scenario === 'output-directory') fs.mkdirSync(output, { recursive: true });
    for (const write of [false, true]) assert.throws(() => syncKnowledge(root, { write }));
    if (scenario === 'source-missing') assert.ok(!fs.existsSync(path.join(root, 'skills')));
    if (scenario === 'parent-file') assert.equal(fs.readFileSync(path.join(root, 'skills'), 'utf8'), 'directoryではない');
    if (scenario === 'output-directory') assert.deepEqual(fs.readdirSync(output), []);
  }
});
