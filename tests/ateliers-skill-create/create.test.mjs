import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildCatalog } from '../../scripts/skill-catalog.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('新規 Create は既存 Skill と共に Catalog から発見できる', () => {
  const result = buildCatalog(repo);
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.errors, []);
  for (const name of ['ateliers-skill-create', 'ateliers-skill-review', 'ateliers-document-review']) {
    const skill = result.skills.find(s => s.name === name);
    assert.ok(skill, name);
    assert.equal(skill.path, `skills/${name}/SKILL.md`);
    assert.ok(fs.readFileSync(path.join(repo, skill.path), 'utf8').length > 0);
  }
});

test('Create の再利用調査で既存レビューの候補本文へ到達できる', () => {
  const result = buildCatalog(repo, { mode: 'candidates', query: '文書 レビュー' });
  assert.deepEqual(result.errors, []);
  for (const name of ['ateliers-document-review', 'ateliers-skill-review']) {
    const candidate = result.skills.find(s => s.name === name);
    assert.ok(candidate, name);
    assert.ok(fs.existsSync(path.join(repo, candidate.path)));
  }
  // Create 自体も隣接作業の説明から候補になり得る。意味上の判断は別に行う。
  assert.ok(result.skills.some(s => s.name === 'ateliers-skill-create'));
});

test('Create で使う CLI と API が版・適用 query・候補について一致する', () => {
  const query = '　ＳＫＩＬＬ\t作成 skill  ';
  const result = spawnSync(process.execPath,
    [path.join(repo, 'scripts/skill-catalog.mjs'), '--root', repo, '--candidates', query, '--json'],
    { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, buildCatalog(repo, { mode: 'candidates', query }));
  assert.equal(parsed.query, 'skill 作成');
  assert.ok(parsed.skills.some(s => s.name === 'ateliers-skill-create'));
});
