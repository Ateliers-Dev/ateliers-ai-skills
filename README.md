# ateliers-ai-skills

Ateliers-Dev の共通作業に使う AI Skill を管理します。

## 収録 Skill

| 名前 | 用途 |
| --- | --- |
| [ateliers-github-issue](skills/ateliers-github-issue/SKILL.md) | 会話の今のアイデア・将来案・バグ・タスクを下書き化し、登録先・重複確認と明示承認を経て Issue を新規登録 |
| [ateliers-document-review](skills/ateliers-document-review/SKILL.md) | 技術文書の整合性、手順、根拠、読み手に必要な情報をレビュー |
| [ateliers-skill-review](skills/ateliers-skill-review/SKILL.md) | Skill の構造・指示・安全性・テスト・docs をレビュー |
| [ateliers-skill-create](skills/ateliers-skill-create/SKILL.md) | 既存 Skill を調査し、新規 Skill の本体・tests・docs を作成・検証、許可範囲で PR 作成 |
| [ateliers-pr-review](skills/ateliers-pr-review/SKILL.md) | PR 差分・品質・テスト・文書・リスクを根拠付きでレビューし、重要度とマージ判断を報告 |
| [ateliers-skill-improve](skills/ateliers-skill-improve/SKILL.md) | 既存 Skill の改善必要性を判断し、本体・tests・docs を変更・回帰検証、許可範囲で PR 作成 |
| [ateliers-brand-design](skills/ateliers-brand-design/SKILL.md) | Ateliers / Atelier Yu のデザイン制作、プロンプト、承認段階、品質確認を支援 |

`skills/<名前>/SKILL.md` が配布単位です。名前には `ateliers-` を付け、他の Skill と識別しやすくします。

## ドキュメント

Skill の仕組み、各 AI ツールでの使い方、文書レビュー Skill の説明は [docs/README.md](docs/README.md) を参照してください。

既存 Skill を使った作成・レビュー・改善の操作順、依頼文例、承認境界は [Skill 開発・運用の操作手順](docs/guides/skill-development-guide.md) を参照してください。Windows でユーザー領域に Skill を配置する場合は [ローカルインストール手順](tools/README.md) を参照してください。

[Skill Catalog](docs/skill-catalog.md) は `SKILL.md` の frontmatter を正本に、一覧・キーワード検索・重複候補・JSON/Markdown 出力を提供します。Node.js 18以上で `npm ci` の後、`npm run catalog` で利用できます。専用 Skill の登録は不要です。

## 利用方法

レビューで得た事例と再利用できる確認観点は[レビュー知見](knowledge/reviews/README.md)に保存しています。対象技術・適用条件・証拠と未確認事項を確認して利用してください。

ファイルパス安全性の知見は `knowledge/reviews/patterns/filesystem-path-safety.md` を唯一の編集正本とし、`skills/ateliers-pr-review/references/filesystem-path-safety.md` を機械生成して同梱します。生成物は直接編集せず、正本の変更後に `npm run knowledge:generate` を実行して両方をコミットします。`npm run check` は同期の照合だけを行い、欠落・手編集・未同期を検出します。[生成と照合の詳細](knowledge/reviews/README.md#同梱資料の生成と照合)を参照してください。Skill 本体の参照動作と行動評価は後続の PR B で扱います。

このリポジトリの `skills/` は保管・配布用の構成です。クローンだけで自動認識されるとは限りません。利用する環境の Skill 配置先に `skills/ateliers-document-review/` フォルダをコピーしてください。Windows で Codex のユーザー領域へ収録 Skill を配置する場合は [`tools/Install-Skills.ps1`](tools/Install-Skills.ps1) を利用できます。

Codex の配置先や読み込み方法は [公式の Skill ガイド](https://learn.chatgpt.com/docs/build-skills) を参照してください。Windows の `.agents\skills` ユーザー領域へのコピーは上記の PowerShell ツールで行えます。組織向け共通 Skill と個別プロジェクト専用 Skill の自動配布は対象外です。

呼び出し例：

```text
$ateliers-document-review を使って docs/setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。文書は変更せず、指摘と提案を日本語で返してください。
```

## テスト・検証

[テスト手順](tests/ateliers-document-review/README.md) に入力、実行プロンプト、採点基準があります。
[初版の検証記録](tests/ateliers-document-review/validation.md) では実施済みと未検証の範囲を区別します。
[Skill Catalog の自動テスト手順](tests/skill-catalog/README.md) と [検証記録](tests/skill-catalog/validation.md) も参照してください。`npm run check` と `npm test` で構造チェックと自動テストを実行できます。
[レビュー知見の配布・同期テスト](tests/review-knowledge/README.md) と [検証記録](tests/review-knowledge/validation.md) に、生成・単独配布・実インストーラーの確認範囲を記載しています。
生成結果は `tests/**/results/` に保存し、Git 管理から除外します。

## 共通基準と Skill レビュー

会話中の案を残すには [GitHub Issue 登録](docs/github-issue.md) を使います。「今のアイデアを忘れないようにイシュー登録しておいてください」と依頼すると、まず下書きを提示します。投稿前の承認と実装の依頼は別です。

[共通品質基準・作成運用ガイド](standards/README.md) に完成条件と Issue 運用をまとめています。新しい Skill は本体・テスト・人間向け docs を揃えます。

[Skill レビューの説明](docs/skill-review.md)、[テスト手順](tests/ateliers-skill-review/README.md)、[検証記録](tests/ateliers-skill-review/validation.md) を参照してください。Issue 候補の報告と起票を分け、明示的な許可がある場合だけ起票します。GitHub 非接続でもレビュー可能です。

新規作成は [Skill 作成](docs/skill-create.md)、[テスト手順](tests/ateliers-skill-create/README.md)、[検証記録](tests/ateliers-skill-create/validation.md) を参照してください。既存 Skill の再利用を優先し、接続なしでもローカル一式を作成できます。

既存 Skill の変更は [Skill 改善](docs/skill-improve.md)、[テスト手順](tests/ateliers-skill-improve/README.md)、[検証記録](tests/ateliers-skill-improve/validation.md) を参照してください。作成・改善・レビューを組み合わせる手順は [Skill 開発ワークフロー](docs/skill-development-workflow.md) に Mermaid 図とともにまとめています。

PR の変更レビューは [PR レビュー](docs/pr-review.md)、[テスト手順](tests/ateliers-pr-review/README.md)、[検証記録](tests/ateliers-pr-review/validation.md) を参照してください。Create を使用した初回の実作成工程と評価は [E2E 記録](tests/ateliers-skill-create/e2e-pr-review.md) に残しています。

## ライセンス

このリポジトリは [MIT License](LICENSE) で公開しています。

Copyright (c) 2026 Ateliers-Dev
