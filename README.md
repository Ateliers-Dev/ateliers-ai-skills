# ateliers-ai-skills

Ateliers-Dev の共通作業に使う AI Skill を管理します。

## 収録 Skill

| 名前 | 用途 |
| --- | --- |
| [ateliers-document-review](skills/ateliers-document-review/SKILL.md) | 技術文書の整合性、手順、根拠、読み手に必要な情報をレビュー |

`skills/<名前>/SKILL.md` が配布単位です。名前には `ateliers-` を付け、他の Skill と識別しやすくします。

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
生成結果は `tests/**/results/` に保存し、Git 管理から除外します。

## ライセンス

このリポジトリは [MIT License](LICENSE) で公開しています。

Copyright (c) 2026 Ateliers-Dev
