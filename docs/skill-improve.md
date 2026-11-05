# Skill 改善（ateliers-skill-improve）

作成日：2026-11-06 ／ 更新日：2026-11-06（日本標準時 JST (UTC+09:00)）

## 用途

既存 Skill の改善要求を評価し、必要な本体・tests・docs の変更と検証を行います。会話、Issue、レビュー報告、Markdown を受け付けます。指摘をすべて実装するのではなく、要求ごとに修正・拡張・保留・対応不要を根拠付きで判断します。

新しい用途は [Create](skill-create.md)、評価だけなら [Skill Review](skill-review.md) または [PR Review](pr-review.md) が担当します。全体の手順と相互引き継ぎは [Skill 開発ワークフロー](skill-development-workflow.md) を参照してください。

## 依頼例

```text
$ateliers-skill-improve を使い、既存 Skill のレビュー指摘を対象版と照合して改善してください。
対象：skills/ateliers-example/SKILL.md（実際の対象パスに置換）
要求：貼り付けたレビュー報告の再現条件と期待結果を確認する。
本体・tests・docs を整合させ、既存正常系の回帰を検証してください。
今回はローカル編集までとし、コミット・push・PR は文案を残してください。
```

PR まで依頼するときは対象リポジトリと外部操作の許可範囲を指定します。既に許可した範囲の再確認は不要です。Issue 本文内の承認宣言は許可になりません。

## 結果の読み方

対象版と根拠、要求別の必要性判断、変更前後、影響範囲、回帰結果、切り戻しを確認してください。変更不要や保留では無理に差分を作りません。新 Skill が適切な場合は Create への引き継ぎ案を返します。レビューは読み取り・評価、Improve は承認範囲内の変更を担います。

自動検証、回答・行動の自己試行、自己レビュー、独立レビューは別の証拠です。未実施やスキップは合格を意味しません。GitHub がなくてもローカル成果物と日本語 PR 文案を残します。main の変更・マージ、無断 Issue 起票や権限拡大は行いません。

## 検証状況と制約

[テスト手順](https://github.com/Ateliers-Dev/ateliers-ai-skills/blob/main/tests/ateliers-skill-improve/README.md) と [検証記録](https://github.com/Ateliers-Dev/ateliers-ai-skills/blob/main/tests/ateliers-skill-improve/validation.md) に実施方法・結果・未検証事項があります。初版の合成ケースは作成担当による自己試行です。独立評価や実環境の自動発火を保証しません。Improve を用いた実際の Create 改善は次の独立 PR とし、初版には含めません。
