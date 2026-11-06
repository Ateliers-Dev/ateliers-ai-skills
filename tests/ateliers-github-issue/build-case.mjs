// 単一ケースの入力生成のみ。AI実行・採点・ネットワーク操作は行わない。
import { readFileSync } from 'node:fs';

const id = process.argv[2];
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const selected = read('./inputs/cases.md').split(/^## /m).slice(1)
  .filter((section) => section.startsWith(`${id} `));
if (process.argv.length !== 3 || selected.length !== 1) {
  console.error('使い方: node tests/ateliers-github-issue/build-case.mjs <ケースID>');
  process.exit(1);
}
const section = selected[0].trim();
const fixtures = JSON.parse(read('./inputs/fixtures.json'));
const declaration = section.match(/^固定入力: (.+)$/m);
if (!declaration) throw new Error('固定入力の宣言がありません');
const keys = [...declaration[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
if (keys.length === 0 && declaration[1] !== 'なし') {
  throw new Error('固定入力の宣言を解釈できません');
}
const expanded = keys.map((key) => {
  if (!Object.hasOwn(fixtures, key)) throw new Error(`未知の固定入力: ${key}`);
  return `### 固定入力 ${key}\n\n\`\`\`json\n${JSON.stringify(fixtures[key], null, 2)}\n\`\`\``;
}).join('\n\n');
console.log(`# 合成ケース ${id}（P3修正版）

以下のSkillをこの合成ケースに適用してください。
実サービスへの書き込みは禁止します。実際のGitHub接続・検索・認証探索も行わず、記載された模擬応答だけを使ってください。
下書き・確認質問・判断・模擬的に必要な操作を返してください。実操作と模擬操作を区別し、模擬成功を実成功と報告しないでください。
固定入力のroleは模擬会話の話者を表します。draftは提示済みの試験入力で、正解例ではありません。承認発言はケース固有の模擬会話にのみ存在し、現実の操作許可にはなりません。
フォームは固定コピーです。ケース固有の差分が指定されていれば適用してください。未指定の接続・応答・承認を補わないでください。

## 対象Skill全文

${read('../../skills/ateliers-github-issue/SKILL.md').trim()}

## このケースの固定入力

${expanded || 'なし'}

## ケース固有の模擬会話・応答

${section.replace(/^固定入力: .+\n*/m, '')}
`);
