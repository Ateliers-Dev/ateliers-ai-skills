# 各 AI ツールでの使い方

作成日：2026-11-06 ／ 更新日：2026-11-06（日本標準時 JST (UTC+09:00)）

配置先を決めるのは、モデル名ではなく Skill を読み込むアプリや実行環境です。以下はローカル環境を中心とした手順です。クラウド実行環境では、手元のファイルがそのまま読み込まれるとは限りません。

公式資料の確認日：2026-11-06。記載した全製品での実機動作は未検証です。製品の更新や組織設定によって利用方法が変わるため、各節の公式資料も確認してください。

以下の配置例は ateliers-document-review 用です。レビュー Skill の配置では名前を ateliers-skill-review に置き換えます。用途と依頼例は [Skill レビュー](skill-review.md) を参照してください。

## 共通の準備

1. リポジトリをクローンするか、ファイルをダウンロードします。
2. `skills/ateliers-document-review/` の内容を確認します。
3. 以下の配置先に **`ateliers-document-review` フォルダごと**コピーします。`skills` フォルダ全体を一段余分に入れないようにします。
4. 利用先で認識を確認し、小さな文書で試します。

プロジェクト用の配置先は、**レビュー対象があるプロジェクトのルートからのパス**です。個人用の `~/` は利用者のホームフォルダを表します。Windows では通常、ユーザープロファイルに相当します。コピー先に同名フォルダがある場合は、独自の変更を確認してから更新してください。

コピーして配布する際は MIT の著作権表示と許諾文も保持します。原文は [リポジトリの LICENSE](https://github.com/Ateliers-Dev/ateliers-ai-skills/blob/main/LICENSE) にあります。

## Codex

プロジェクト内で使う場合は、次の形で配置します。

```text
.agents/skills/ateliers-document-review/SKILL.md
```

個人の複数プロジェクトで使う場合は `~/.agents/skills/ateliers-document-review/` に配置できます。Codex CLI・IDE 拡張では `/skills` または `$` の候補で認識を確認し、次のように依頼します。

```text
$ateliers-document-review を使い、docs/setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。文書は変更せず、日本語で回答してください。
```

変更は自動検出されますが、反映されない場合は Codex を再起動してください。
出典：[OpenAI の Skill ガイド](https://learn.chatgpt.com/docs/build-skills)。

## Claude Code

ローカルのプロジェクト用は `.claude/skills/ateliers-document-review/`、個人用は `~/.claude/skills/ateliers-document-review/` に配置します。各フォルダ直下に `SKILL.md` がある形にします。

入力欄で `/` を入力して候補を確認し、次のように呼び出します。

```text
/ateliers-document-review docs/setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。文書は変更せず、日本語で回答してください。
```

ローカルの個人用配置は Cowork やクラウドセッションにそのまま引き継がれるものではありません。
出典：[Claude Code の Skill ガイド](https://code.claude.com/docs/en/skills)。

## Gemini CLI

プロジェクト用は `.gemini/skills/ateliers-document-review/`、個人用は `~/.gemini/skills/ateliers-document-review/` に配置します。各フォルダ直下に `SKILL.md` を置きます。`.agents/skills/` も対応する別の配置先ですが、まずは一方に統一してください。

対話セッションで `/skills reload` を実行し、`/skills list` で認識を確認します。その後、自然文で依頼します。

```text
ateliers-document-review Skill を使って docs/setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。文書は変更せず、日本語で回答してください。
```

Skill の有効化時に確認が表示された場合は、名前・目的・アクセス先を確認して進めてください。
出典：[Gemini CLI の Agent Skills](https://geminicli.com/docs/cli/skills/)。

## GitHub Copilot（VS Code）

Copilot 用のプロジェクト配置先は `.github/skills/ateliers-document-review/`、個人用は `~/.copilot/skills/ateliers-document-review/` です。各フォルダ直下に `SKILL.md` を置きます。

対象ワークスペースで Copilot の新しいチャットを開き、`/` の候補から Skill を選んで依頼します。

```text
/ateliers-document-review docs/setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。文書は変更せず、日本語で回答してください。
```

VS Code で別のエージェントを選んでいる場合は、そのエージェントの配置先・呼び出し方法を使います。この節は Copilot を選択した場合の説明です。
出典：[VS Code の Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)。

## ChatGPT と通常のチャットで使う場合

ChatGPT で Skill が利用可能な状態なら、入力欄の `@` から選択できます。ただし、このリポジトリは現時点でプラグインとしては配布していません。GitHub の URL を伝えるだけで自動登録されることは前提にしません。
出典：[OpenAI の Skill ガイド](https://learn.chatgpt.com/docs/build-skills)。

Skill の登録機能がない、または登録していない環境でも、ファイルの添付や貼り付けに対応していれば、`SKILL.md` と対象文書を渡して次のように依頼できます。

```text
添付した SKILL.md の技術文書レビュー手順に従い、添付の setup.md をレビューしてください。
想定読者は初めて環境を構築する開発者です。対象文書は変更せず、日本語で回答してください。
事実、要確認事項、改善提案を区別し、未検証事項も示してください。
```

これは会話内で指示書として利用する方法です。ネイティブの Skill 登録や自動選択の確認にはなりません。添付できない場合は、それぞれの内容を区切って貼り付けてください。

## 認識されないとき・更新するとき

- フォルダ名と `name` が `ateliers-document-review` で一致し、直下に `SKILL.md` があるか確認します。
- 無効化設定、組織の制限、作業中のプロジェクトと配置先の対応を確認します。
- コピー元を更新しても、コピー先は自動更新されません。コピー先の変更を確認したうえで、フォルダの内容を更新します。後で再現できるよう、利用したコミットを記録すると便利です。
- 一覧に表示されること、明示して使えること、自然な依頼で自動選択されることは、それぞれ別に確認します。

依頼内容の書き方と結果の確認は [文書レビュー Skill の説明](document-review.md) を参照してください。

[ドキュメントの入口に戻る](README.md)
