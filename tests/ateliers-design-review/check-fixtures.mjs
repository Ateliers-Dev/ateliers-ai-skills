import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = fs.readFileSync(path.join(root, 'fixtures/fixture-manifest.md'), 'utf8');
const cases = fs.readFileSync(path.join(root, 'inputs/cases.md'), 'utf8');
const expected = fs.readFileSync(path.join(root, 'expected.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, '../../skills/ateliers-design-review/SKILL.md'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'inputs/fixtures/fictitious-brand-guide.md'), 'utf8');
const baseline = fs.readFileSync(path.join(root, 'inputs/fixtures/mvc-baseline-review.md'), 'utf8');
const fixtures = [
  { id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png', expected: 'Controllerが2つ' },
  { id: 'DR-MVC-FIXED-001', file: 'DR-MVC-FIXED-001.png', expected: 'Controllerは1つ' },
];
const fixtureById = new Map(fixtures.map(fixture => [fixture.id, fixture]));
const expectedCasePairs = {
  D1: [{ id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png' }],
  D2: [{ id: 'DR-MVC-FIXED-001', file: 'DR-MVC-FIXED-001.png' }],
  D3: [],
  D4: [{ id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png' }],
  D5: [{ id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png' }],
  D6: [{ id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png' }],
  D7: [{ id: 'DR-MVC-FIXED-001', file: 'DR-MVC-FIXED-001.png' }],
  D8: [{ id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png' }],
  D9: [{ id: 'DR-MVC-FIXED-001', file: 'DR-MVC-FIXED-001.png' }],
};

function assertImageIdFilenamePair({ id, file }, context) {
  const fixture = fixtureById.get(id);
  assert(fixture, `${context}: unknown image ID ${id}`);
  assert.equal(file, fixture.file, `${context}: image ID ${id} maps to ${fixture.file}, not ${file}`);
}

function caseSection(id) {
  const start = cases.indexOf(`## ${id}：`);
  assert(start >= 0, `${id}: input case exists`);
  const end = cases.indexOf('\n## ', start + 1);
  return cases.slice(start, end < 0 ? undefined : end);
}

function extractImageReferences(section) {
  const pattern = /`(DR-MVC-(?:FLAWED|FIXED)-\d{3}\.png)`（ID `(DR-MVC-(?:FLAWED|FIXED)-\d{3})`）/g;
  return [...section.matchAll(pattern)].map(match => ({ file: match[1], id: match[2] }));
}

function assertCaseImageMapping(id, pairs) {
  for (const pair of pairs) assertImageIdFilenamePair(pair, `${id} input`);
  assert.deepEqual(extractImageReferences(caseSection(id)), pairs, `${id}: per-case image ID/file mapping`);
}

// A deliberately swapped pair parsed as a case reference must be rejected by the same check used for real cases.
const intentionallySwappedCase = '## Invalid fixture case\n`DR-MVC-FLAWED-001.png`（ID `DR-MVC-FIXED-001`）';
const intentionallySwappedPair = extractImageReferences(intentionallySwappedCase)[0];
assert.throws(() => assertImageIdFilenamePair(intentionallySwappedPair, 'negative self-test'), /maps to/);

for (const fixture of fixtures) {
  const imagePath = path.join(root, 'fixtures/images', fixture.file);
  const bytes = fs.readFileSync(imagePath);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${fixture.file}: PNG signature`);
  assert.equal(bytes.readUInt32BE(16), 1280, `${fixture.file}: width`);
  assert.equal(bytes.readUInt32BE(20), 720, `${fixture.file}: height`);
  const sha = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  const row = manifest.split(/\r?\n/).find(line => line.startsWith(`| \`${fixture.id}\` |`));
  assert(row, `${fixture.id}: manifest row`);
  const cells = row.split('|').map(cell => cell.trim());
  assert.equal(cells[2], `\`images/${fixture.file}\``, `${fixture.id}: manifest filename`);
  assert.equal(cells[4], `\`${sha}\``, `${fixture.id}: manifest SHA-256`);
  assert(cases.includes(fixture.id), `${fixture.id}: case input`);
  assert(expected.includes(fixture.expected), `${fixture.id}: expected observation`);
  assert(readme.includes(fixture.file), `${fixture.id}: reproducible attachment instructions`);
  console.log(`${fixture.id}: PNG 1280x720 SHA-256 ${sha}`);
}

for (const id of Object.keys(expectedCasePairs)) {
  assert(cases.includes(`## ${id}：`), `${id}: input case`);
  assert(expected.includes(`| ${id} |`), `${id}: expected result`);
  assertCaseImageMapping(id, expectedCasePairs[id]);
}
for (const phrase of ['解消', '未解消', '変更', '今回確認不能', '編集・公開']) {
  assert(expected.includes(phrase) || cases.includes(phrase), `required behavior: ${phrase}`);
}
assert(cases.includes('初回レビューを実施し、回答を固定する。その後') && cases.includes('制作側評価'), 'D6: staged self-assessment');
assert(guide.includes('架空') && guide.includes('正式資料') && guide.includes('非公式'), 'fictional guide is clearly nonofficial');
for (const boundary of ['画像編集', '正式採用', '登録', '公開']) assert(skill.includes(boundary), `read-only boundary: ${boundary}`);

const d2 = caseSection('D2');
assert(d2.includes('inputs/fixtures/mvc-baseline-review.md'), 'D2: references fixed old review fixture');
assert(d2.includes('D1や別会話の実行結果を参照しません'), 'D2: standalone historical input');
assert(baseline.includes('DR-MVC-FLAWED-001.png') && baseline.includes('DR-MVC-FLAWED-001'), 'D2 fixture: baseline target identity');
assert(baseline.includes(fixtures[0].id) && baseline.includes(manifest.split(/\r?\n/).find(line => line.startsWith(`| \`${fixtures[0].id}\` |`)).split('|')[4].trim()), 'D2 fixture: baseline image SHA-256');
for (const id of ['DR-MVC-BASELINE-001', 'DR-MVC-BASELINE-002', 'DR-MVC-BASELINE-003']) {
  assert(baseline.includes(id), `D2 fixture: fixed old finding ${id}`);
  const expectedD2 = expected.slice(expected.indexOf('## D2：'), expected.indexOf('\n## ', expected.indexOf('## D2：') + 1) < 0 ? undefined : expected.indexOf('\n## ', expected.indexOf('## D2：') + 1));
  assert(expectedD2.includes(id) && expectedD2.includes('解消'), `D2 expected: per-ID status and rationale ${id}`);
}
console.log('Case coverage: D1-D9; per-case ID/filename pairs, D2 fixed old findings, and swapped-pair rejection verified.');
