import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { STANDARD_FILES, syncCommonStandards } from '../../scripts/sync-common-standards.mjs';
import { reconcileSyncPullRequest } from '../../scripts/manage-common-standards-pr.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function makeRepository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'common-standards-'));
  await mkdir(path.join(root, 'standards'), { recursive: true });
  await mkdir(path.join(root, 'skills', 'first-skill'), { recursive: true });
  await mkdir(path.join(root, 'skills', 'second-skill', 'nested'), { recursive: true });
  await writeFile(path.join(root, 'skills', 'first-skill', 'SKILL.md'), '# First\n');
  await writeFile(path.join(root, 'skills', 'second-skill', 'SKILL.md'), '# Second\n');
  await writeFile(path.join(root, 'skills', 'second-skill', 'nested', 'SKILL.md'), '# Nested\n');
  for (const file of STANDARD_FILES) {
    await writeFile(path.join(root, 'standards', file), `source: ${file}\n`);
  }
  return root;
}

test('copies both standards into every direct Skill and includes new Skills', async (t) => {
  const root = await makeRepository();
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = await syncCommonStandards(root);
  assert.equal(first.skillCount, 2);
  assert.equal(first.changedFiles.length, 4);

  await mkdir(path.join(root, 'skills', 'future-skill'), { recursive: true });
  await writeFile(path.join(root, 'skills', 'future-skill', 'SKILL.md'), '# Future\n');
  const second = await syncCommonStandards(root);
  assert.equal(second.skillCount, 3);
  assert.equal(second.changedFiles.length, 2);

  for (const skill of ['first-skill', 'second-skill', 'future-skill']) {
    for (const file of STANDARD_FILES) {
      assert.deepEqual(
        await readFile(path.join(root, 'skills', skill, 'references', file)),
        await readFile(path.join(root, 'standards', file)),
      );
    }
  }
  await assert.rejects(readFile(path.join(root, 'skills', 'second-skill', 'nested', 'references', STANDARD_FILES[0])));
});

test('reports no changes when copies already match, and updates changed content only', async (t) => {
  const root = await makeRepository();
  t.after(() => rm(root, { recursive: true, force: true }));

  await syncCommonStandards(root);
  assert.deepEqual(await syncCommonStandards(root), { skillCount: 2, changedFiles: [] });

  await writeFile(path.join(root, 'standards', STANDARD_FILES[0]), 'updated\n');
  const result = await syncCommonStandards(root);
  assert.equal(result.changedFiles.length, 2);
  assert.ok(result.changedFiles.every((file) => file.endsWith(STANDARD_FILES[0])));
});

test('fails clearly when a source document is missing', async (t) => {
  const root = await makeRepository();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(root, 'standards', STANDARD_FILES[1]));
  await assert.rejects(syncCommonStandards(root), /ENOENT/);
});

test('all direct Skills include current standards copies and explicit reading guidance', async () => {
  const skillsDir = path.join(repositoryRoot, 'skills');
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skillNames = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(path.join(skillsDir, entry.name, 'SKILL.md'));
      skillNames.push(entry.name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  assert.equal(skillNames.length, 8);
  for (const skill of skillNames) {
    const skillDir = path.join(skillsDir, skill);
    const instructions = await readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
    assert.match(instructions, /references\/ai-collaboration-policy\.md/);
    assert.match(instructions, /references\/instruction-conflict-resolution\.md/);
    assert.match(instructions, /リポジトリ外の作業では `AGENTS\.md` の探索を強制しません/);
    for (const file of STANDARD_FILES) {
      assert.deepEqual(
        await readFile(path.join(skillDir, 'references', file)),
        await readFile(path.join(repositoryRoot, 'standards', file)),
      );
    }
  }
});

test('closes the open synchronization PR when main has no remaining sync diff', async () => {
  const calls = [];
  const result = await reconcileSyncPullRequest({
    hasDiff: false,
    run: async (args) => {
      calls.push(args);
      return args[1] === 'list' ? '[{"number":42,"state":"OPEN","mergedAt":null}]' : '';
    },
  });

  assert.equal(result, 'closed');
  assert.deepEqual(calls.map((args) => args.slice(0, 3)), [
    ['pr', 'list', '--base'],
    ['pr', 'close', '42'],
  ]);
  assert.ok(calls[1].includes('--comment'));
});

test('does nothing when no diff exists and there is no open synchronization PR', async () => {
  const calls = [];
  const result = await reconcileSyncPullRequest({
    hasDiff: false,
    run: async (args) => {
      calls.push(args);
      return '[]';
    },
  });

  assert.equal(result, 'unchanged');
  assert.equal(calls.length, 1);
});

test('reopens a previously closed unmerged PR when a sync diff returns', async () => {
  const calls = [];
  const result = await reconcileSyncPullRequest({
    hasDiff: true,
    run: async (args) => {
      calls.push(args);
      return args[1] === 'list' ? '[{"number":42,"state":"CLOSED","mergedAt":null}]' : '';
    },
  });

  assert.equal(result, 'reopened');
  assert.deepEqual(calls[1], ['pr', 'reopen', '42']);
});

test('keeps the existing open synchronization PR when updated branch content is pushed', async () => {
  const calls = [];
  const result = await reconcileSyncPullRequest({
    hasDiff: true,
    run: async (args) => {
      calls.push(args);
      return args[1] === 'list' ? '[{"number":42,"state":"OPEN","mergedAt":null}]' : '';
    },
  });

  assert.equal(result, 'updated');
  assert.equal(calls.length, 1);
});

test('creates a synchronization PR when none exists', async () => {
  const calls = [];
  const result = await reconcileSyncPullRequest({
    hasDiff: true,
    run: async (args) => {
      calls.push(args);
      return args[1] === 'list' ? '[]' : '';
    },
  });

  assert.equal(result, 'created');
  assert.equal(calls[1][1], 'create');
  assert.ok(calls[1].includes('sync/common-ai-standards'));
});

test('creates a new synchronization PR if the closed PR became merged before reopening', async () => {
  const calls = [];
  const result = await reconcileSyncPullRequest({
    hasDiff: true,
    run: async (args) => {
      calls.push(args);
      if (args[1] === 'list') return '[{"number":42,"state":"CLOSED","mergedAt":null}]';
      if (args[1] === 'reopen') throw new Error('Cannot reopen a merged pull request');
      if (args[1] === 'view') return '{"state":"MERGED","mergedAt":"2026-11-16T00:00:00Z"}';
      return '';
    },
  });

  assert.equal(result, 'created');
  assert.deepEqual(calls.map((args) => args[1]), ['list', 'reopen', 'view', 'create']);
});

test('reports reopen failures when the PR is still closed instead of creating a duplicate', async () => {
  const calls = [];
  await assert.rejects(
    reconcileSyncPullRequest({
      hasDiff: true,
      run: async (args) => {
        calls.push(args);
        if (args[1] === 'list') return '[{"number":42,"state":"CLOSED","mergedAt":null}]';
        if (args[1] === 'reopen') throw new Error('Permission denied');
        if (args[1] === 'view') return '{"state":"CLOSED","mergedAt":null}';
        return '';
      },
    }),
    /Permission denied/,
  );

  assert.deepEqual(calls.map((args) => args[1]), ['list', 'reopen', 'view']);
});
