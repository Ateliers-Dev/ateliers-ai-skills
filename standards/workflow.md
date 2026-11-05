# Skill の作成・運用ガイド

## 作成・更新

1. 既存ファイル、最近の差分、利用例、依頼範囲を確認する。既存変更や作成日を上書きしない。
2. [品質基準](quality.md) に沿って用途・発火条件・対象外・副作用の境界を決める。
3. Skill 本体、テスト、人間向け docs を揃える。既存の動作に影響する変更は期待事項も見直す。
4. docs の更新日は信頼できる現在日時を JST に変換して決定する。既存作成日は保持する。日付が不明なら推測で埋めず、未確認として確認する。
5. 構造・相対リンク・日付形式・生成結果の除外を検証し、必要な動作試行を行う。独立評価と自己評価を区別する。
6. 検証記録に実施方法と未検証範囲を残し、差分を確認して依頼された範囲をコミットする。

構造チェックの例（Node.js 18以上、リポジトリルートで実行）：

```text
node tests/ateliers-skill-review/check-structure.mjs
node tests/ateliers-skill-review/check-structure.mjs --self-test
```

日付形式が正しくても履歴の正しさは証明できません。変更前の作成日と内容差分を別に確認します。

## レビューから Issue へ

レビュー結果は Issue 作成の前段です。すべての指摘を自動起票しません。まず根拠、重要度、改善案、受け入れ条件を整理し、同じ原因をまとめます。

| 種類 | 用途 |
| --- | --- |
| Skill Request | 新しい用途・Skill の要望 |
| Skill Defect | 期待と実際の不一致、再現可能な欠陥 |
| Skill Improvement | 既存動作の改善提案 |
| Skill Maintenance | 基準、依存、docs、テスト等の保守 |

GitHub 接続がなくてもローカル資料だけでレビューし、Issue 候補を回答できます。起票は利用者が対象リポジトリと候補を特定して明示的に許可した場合だけ行います。「レビューして」「候補を出して」は起票許可ではありません。許可済みの範囲は再確認不要です。接続・権限がなければ候補を提示して止め、成功したと報告しません。

Forms は `.github/ISSUE_TEMPLATE/` にあります。秘密情報を除き、版・根拠・未確認点を添えます。フォームを使わないツールからの起票でも同等の情報を含めます。

Forms の構文は [GitHub 公式資料](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) を参照してください。GitHub 上の表示・投稿確認はローカル YAML 検証とは別に扱います。
