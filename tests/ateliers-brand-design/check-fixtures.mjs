import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = read('fixtures/fixture-manifest.md');
const cases = read('inputs/cases.md');
const expected = read('expected.md');
const procedure = read('README.md');
const prompts = read('prompts.md');
const images = [
  { id: 'BD-CHAR-REF-001', file: 'fixtures/images/BD-CHAR-REF-001.png' },
  { id: 'BD-CAND-V1-001', file: 'fixtures/images/BD-CAND-V1-001.png' },
];

for (const image of images) {
  const bytes = fs.readFileSync(path.join(root, image.file));
  const row = manifest.split('\n').find(line => line.includes(`\`${image.id}\``));
  assert.ok(row, `manifest contains ${image.id}`);
  assert.ok(row.includes(image.file.replace('fixtures/', '')), `manifest path matches ${image.id}`);
  assert.ok(row.includes(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()), `manifest SHA-256 matches ${image.id}`);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${image.id} is PNG`);
  assert.equal(bytes.readUInt32BE(16), 512, `${image.id} width`);
  assert.equal(bytes.readUInt32BE(20), 512, `${image.id} height`);
}

for (const id of ['C1-N', 'C1-I', 'P1-N', 'P1-I']) {
  assert.ok(cases.includes(`## ${id}：`), `case exists: ${id}`);
  assert.ok(expected.includes(`| ${id} |`), `expectation exists: ${id}`);
}
assert.ok(cases.includes('BD-CHAR-REF-001') && cases.includes('BD-CAND-V1-001'), 'image IDs appear in test inputs');
assert.ok(expected.includes('紫の虹彩') && expected.includes('青の虹彩') && expected.includes('胸飾り'), 'image-specific criteria are defined for evaluator');
const section = (text, heading) => {
  const start = text.indexOf(`## ${heading}：`);
  assert.notEqual(start, -1, `section exists: ${heading}`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
};
assert.ok(!section(cases, 'C1-N').includes('.png'), 'C1-N intentionally has no image attachment');
assert.ok(section(cases, 'C1-I').includes('BD-CHAR-REF-001.png'), 'C1-I specifies its reference image');
assert.ok(!section(cases, 'P1-N').includes('.png'), 'P1-N intentionally has no image attachment');
assert.ok(section(cases, 'P1-I').includes('BD-CHAR-REF-001.png') && section(cases, 'P1-I').includes('BD-CAND-V1-001.png'), 'P1-I specifies both images');
assert.ok(section(cases, 'F1').includes('inputs/fixtures/fictitious-brand-guide.md'), 'F1 identifies the fictional guide');
assert.ok(procedure.includes('明示呼び出しと自動選択') && prompts.includes('自動選択ケース'), 'explicit and automatic activation procedures are distinguished');
console.log('PASS: image assets, dimensions, SHA-256, C1/P1 attachment branches, evaluation criteria, and case setup');
