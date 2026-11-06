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
