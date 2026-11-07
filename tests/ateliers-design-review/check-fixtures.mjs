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
const fixtures = [
  { id: 'DR-MVC-FLAWED-001', file: 'DR-MVC-FLAWED-001.png', expected: 'Controllerが2つ' },
  { id: 'DR-MVC-FIXED-001', file: 'DR-MVC-FIXED-001.png', expected: 'Controllerは1つ' },
];

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

for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']) {
  assert(cases.includes(`## ${id}：`), `${id}: input case`);
  assert(expected.includes(`| ${id} |`), `${id}: expected result`);
}
for (const phrase of ['解消', '未解消', '変更', '今回確認不能', '編集・公開']) {
  assert(expected.includes(phrase) || cases.includes(phrase), `required behavior: ${phrase}`);
}
const expectedCase = (id, image) => {
  const start = cases.indexOf(`## ${id}：`);
  const end = cases.indexOf('\n## ', start + 1);
  const section = cases.slice(start, end < 0 ? undefined : end);
  assert(start >= 0 && section.includes(image), `${id}: expected image mapping`);
};
for (const id of ['D1', 'D4', 'D5', 'D6', 'D8']) expectedCase(id, 'DR-MVC-FLAWED-001.png');
for (const id of ['D2', 'D7', 'D9']) expectedCase(id, 'DR-MVC-FIXED-001.png');
assert(cases.includes('## D3：') && !cases.slice(cases.indexOf('## D3：'), cases.indexOf('\n## D4：')).includes('.png'), 'D3: no-image case');
assert(cases.includes('初回レビューを実施し、回答を固定する。その後') && cases.includes('制作側評価'), 'D6: staged self-assessment');
assert(guide.includes('架空') && guide.includes('正式資料') && guide.includes('非公式'), 'fictional guide is clearly nonofficial');
for (const boundary of ['画像編集', '正式採用', '登録', '公開']) assert(skill.includes(boundary), `read-only boundary: ${boundary}`);
console.log('Case coverage: D1-D9; image/no-image mapping and expected results present.');
