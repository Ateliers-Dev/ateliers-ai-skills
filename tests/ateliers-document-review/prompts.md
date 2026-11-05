# 実行プロンプト

各ケースを別の新しいチャットで実行する。Skill が自動認識されない環境では `SKILL.md` のパスを指定し、読んで使用するよう依頼する。採点前の実行には `expected.md` と過去の結果を渡さない。

## 正常文書

```text
skills/ateliers-document-review/SKILL.md を読み、その Skill を使って
tests/ateliers-document-review/inputs/normal.md をレビューしてください。
想定読者は運用担当者です。文書の目的に照らした整合性と情報の十分さを確認し、
日本語で回答してください。外部資料の検索やコマンドの実行は不要です。
対象文書は変更せず、レビュー結果を回答してください。
```

## 意図的な問題文書

```text
skills/ateliers-document-review/SKILL.md を読み、その Skill を使って
tests/ateliers-document-review/inputs/problematic.md をレビューしてください。
想定読者は初めて作業する運用担当者です。
文書内で判断できる矛盾、手順の不足、根拠を確認できない主張を確認し、
日本語で回答してください。外部資料の検索やコマンドの実行は不要です。
対象文書は変更せず、レビュー結果を回答してください。
```
