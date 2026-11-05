# ateliers-ai-skills

Ateliers-Dev の共通作業に使う AI Skill を管理します。

## 収録 Skill

| 名前 | 用途 |
| --- | --- |
| [ateliers-document-review](skills/ateliers-document-review/SKILL.md) | 技術文書の整合性、手順、根拠、読み手に必要な情報をレビュー |
| [ateliers-skill-review](skills/ateliers-skill-review/SKILL.md) | Skill の構造・指示・安全性・テスト・docs をレビュー |
| [ateliers-skill-create](skills/ateliers-skill-create/SKILL.md) | 既存 Skill を調査し、新規 Skill の本体・tests・docs を作成・検証、許可範囲で PR 作成 |

`skills/<名前>/SKILL.md` が配布単位です。名前には `ateliers-` を付け、他の Skill と識別しやすくします。

## ドキュメント

Skill の仕組み、各 AI ツールでの使い方、文書レビュー Skill の説明は [docs/README.md](docs/README.md) を参照してください。

[Skill Catalog](docs/skill-catalog.md) は `SKILL.md` の frontmatter を正本に、一覧・キーワード検索・重複候補・JSON/Markdown 出力を提供します。Node.js 18以上で `npm ci` の後、`npm run catalog` で利用できます。専用 Skill の登録は不要です。

## 利用方法

このリポジトリの `skills/` は保管・配布用の構成です。クローンだけで自動認識されるとは限りません。利用する環境の Skill 配置先に `skills/ateliers-document-review/` フォルダをコピーするか、対応するインストーラーでこのパスを指定してください。

Codex の配置先や読み込み方法は [公式の Skill ガイド](https://learn.chatgpt.com/docs/build-skills) を参照してください。組織向け共通 Skill と個別プロジェクト専用 Skill の分割、インストールの自動化は初版の対象外です。

呼び出し例：

```text
$ateliers-document-review を使って docs/setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。文書は変更せず、指摘と提案を日本語で返してください。
```

## テスト・検証

[テスト手順](tests/ateliers-document-review/README.md) に入力、実行プロンプト、採点基準があります。
[初版の検証記録](tests/ateliers-document-review/validation.md) では実施済みと未検証の範囲を区別します。
[Skill Catalog の自動テスト手順](tests/skill-catalog/README.md) と [検証記録](tests/skill-catalog/validation.md) も参照してください。`npm run check` と `npm test` で構造チェックと自動テストを実行できます。
生成結果は `tests/**/results/` に保存し、Git 管理から除外します。

## 共通基準と Skill レビュー

[共通品質基準・作成運用ガイド](standards/README.md) に完成条件と Issue 運用をまとめています。新しい Skill は本体・テスト・人間向け docs を揃えます。

[Skill レビューの説明](docs/skill-review.md)、[テスト手順](tests/ateliers-skill-review/README.md)、[検証記録](tests/ateliers-skill-review/validation.md) を参照してください。Issue 候補の報告と起票を分け、明示的な許可がある場合だけ起票します。GitHub 非接続でもレビュー可能です。

新規作成は [Skill 作成](docs/skill-create.md)、[テスト手順](tests/ateliers-skill-create/README.md)、[検証記録](tests/ateliers-skill-create/validation.md) を参照してください。既存 Skill の再利用を優先し、接続なしでもローカル一式を作成できます。Improve Skill の実装は次フェーズです。

## ライセンス

このリポジトリは [MIT License](LICENSE) で公開しています。

Copyright (c) 2026 Ateliers-Dev
