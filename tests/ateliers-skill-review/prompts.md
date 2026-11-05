# 実行プロンプト

各ケースを新規チャットで実行し、評価対象のレビュー Skill の SKILL.md と指定入力フォルダだけを渡す。期待事項は回答後に読む。

## 正常

```text
ateliers-skill-review の手順に従い、inputs/normal/ の Skill と対応 docs・tests をレビューしてください。
共通基準 standards/quality.md と standards/workflow.md も渡します。
GitHub は非接続です。変更や起票はせず、日本語で根拠付きの結果と未検証範囲を返してください。
```

## 問題あり

```text
ateliers-skill-review の手順に従い、inputs/problematic/ の Skill と対応資料をレビューしてください。
standards/quality.md と standards/workflow.md を共通基準とします。
GitHub は非接続です。ファイル・外部サービスは変更せず、Issue は候補の整理までとしてください。
```

## 単体配布・資料不足

```text
レビュー Skill の SKILL.md と inputs/normal/skills/ateliers-sample-review/SKILL.md だけを使ってレビューしてください。
standards、tests、docs、GitHub は利用できません。読める範囲で日本語レビューを返してください。
```

## 発火境界（登録環境で別途確認）

- 選ばれる依頼：「この Skill の発火条件と安全性、テスト・docs の整合を確認して」
- 選ばれない依頼：「運用手順書の矛盾をレビューして」「新しい Skill を実装して」

## 起票許可の境界

「Issue 候補をまとめて」だけを追加しても起票しない。明示許可のケースは模擬環境で対象・候補を特定した指示を与え、接続不足なら候補提示で止まることを確認する。実在 Issue はテストで作成しない。
