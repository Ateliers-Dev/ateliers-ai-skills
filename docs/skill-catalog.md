# Skill Catalog（Skill 一覧・検索基盤）

作成日：2026-11-06 ／ 更新日：2026-11-06（日本標準時 JST (UTC+09:00)）

## 用途と境界

`scripts/skill-catalog.mjs` は、このリポジトリの Skill を一覧・検索する読み取り専用スクリプトです。`skills/<name>/SKILL.md` の YAML frontmatter を正本として `name`、`description`、`path` を取得します。README の手動一覧や本文からは取得しません。専用 Skill の登録は不要です。

将来の Create Skill が既存の用途を探すために使える、版番号付き JSON を用意しています。今回 Create / Improve Skill は実装していません。意味的な重複の最終判断、Skill の実行、ファイル編集、インストール、Issue 起票は行いません。

## 実行方法

Node.js 18 以上と既存のロックファイルを使用します。リポジトリルートで依存を準備してください。

```sh
npm ci
npm run catalog
node scripts/skill-catalog.mjs --search "文書 レビュー"
node scripts/skill-catalog.mjs --search "review" --json
node scripts/skill-catalog.mjs --candidates "文書 コード" --format json
node scripts/skill-catalog.mjs --duplicates --format markdown
node scripts/skill-catalog.mjs --root /path/to/repository --json
node scripts/skill-catalog.mjs --help
```

`npm run catalog -- --json` も利用できます。別プログラムで JSON を読む場合は、npm の実行メッセージを含まない `node scripts/skill-catalog.mjs --json` を使ってください。既定の対象はスクリプトが属するリポジトリです。実行時の作業ディレクトリには依存しません。`--root` の相対パスだけは作業ディレクトリ基準です。

| オプション | 動作 |
| --- | --- |
| 指定なし | 有効な全 Skill を Markdown の表で表示 |
| `--search TEXT` | 空白区切りの全キーワードが一致するものを検索（AND） |
| `--candidates TEXT` | いずれかのキーワードが一致するものを候補に抽出（OR） |
| `--duplicates` | 全 Skill の組から、名前の共通語または同一説明の組を抽出 |
| `--json` / `--format json` | 機械処理用 JSON を表示 |
| `--format markdown` | 人間向け Markdown を表示（既定） |
| `--root PATH` | 別リポジトリのルートを指定 |

検索は `name`、`description`、`path` のいずれかに対する部分一致です。Unicode NFKC 正規化と小文字化を行い、全角英数字や大文字小文字の差を吸収します。異なるキーワードは別の項目に一致しても構いません。空文字・空白のみの検索は全件を返します。正規表現・形態素解析・同義語・意味検索には対応しません。

`--search`、`--candidates`、`--duplicates` は併用できません。`--candidates` の結果だけで重複とは判断しないでください。

## 出力例と契約

空白のみの検索などで全件を得られます。以下は「存在しない用途」で検索した実際に再現できる JSON の例です。

```json
{
  "schemaVersion": 1,
  "mode": "search",
  "query": "存在しない用途",
  "skills": [],
  "duplicateCandidates": [],
  "errors": []
}
```

`skills` の各要素は次の3項目です。説明は frontmatter の文字列をそのまま返し、比較時だけ正規化します。

```json
{
  "name": "ateliers-skill-review",
  "description": "Skill の品質確認や改善点の洗い出しを依頼されたときに、SKILL.md、関連資料、テスト、人間向け説明の構造・指示・安全性・整合性をレビューする。一般の技術文書だけのレビュー、Skill の新規作成や修正の実装を主目的とする依頼には使わない。",
  "path": "skills/ateliers-skill-review/SKILL.md"
}
```

Markdown では次の列で表示します（説明はこの表示例のみ省略）。表を壊す改行・記号・HTML はエスケープされます。生成 Markdown は一覧表示用であり、docs の説明文書とは別です。

```text
| name | description | path |
| --- | --- | --- |
| ateliers-skill-review | （説明） | skills/ateliers-skill-review/SKILL.md |
```

JSON のトップレベルは常に `schemaVersion`、`mode`、`query`、`skills`、`duplicateCandidates`、`errors` を持ちます。`mode` は `list`、`search`、`candidates`、`duplicates`、`query` は実際に適用された検索条件です。一覧・重複モードでは入力値にかかわらず常に空文字です。検索（`search`）・候補検索（`candidates`）では、NFKC 正規化・小文字化・空白分割・重複語除去を行ったキーワードを初出順に半角スペース1つで結合して返します。空白のみの検索条件は空文字です。未使用の配列も空配列として出力します。パスは対象ルート相対・区切り `/` で、Skill はフォルダ名のコード単位昇順です。同じ入力から同じ順序を返し、時刻や絶対パスの識別子は付けません。互換性のない変更では `schemaVersion` を変更します。利用側は版番号を確認し、未知の追加フィールドを許容してください。

JavaScript からは `buildCatalog(root, { mode, query })` を import して同じオブジェクトを取得できます。`mode` と `query` は省略可能で、既定は `list` と空文字です。ルート省略時はスクリプトのリポジトリを使います。CLI は import 時には実行しません。

## 重複候補の読み方

`--duplicates` は接頭辞 `ateliers-` を除いた名前をハイフンで区切り、共通語がある組に `shared-name-token` を付けます。説明全文が NFKC・小文字化・前後空白除去後に等しい組には `same-description` を付けます。候補は `paths`（2件）、`reasons`（判定根拠）、`sharedNameTokens`（共通語の昇順・重複なし）を持ちます。

現在の2つのレビュー Skill は名前に `review` を共有するため、次の候補になります。

```json
{
  "paths": [
    "skills/ateliers-document-review/SKILL.md",
    "skills/ateliers-skill-review/SKILL.md"
  ],
  "reasons": ["shared-name-token"],
  "sharedNameTokens": ["review"]
}
```

これは統合の提案でも重複の確定でもありません。候補に出た各 Skill の対象・発火条件・対象外を読んで人または後続処理が判断します。異なる言葉で同じ用途を表した Skill は検出できません。`--candidates` には将来作りたい Skill の用途を複数の語で渡し、より広く探せます。全組の比較は Skill 数の二乗に比例するため、大規模データ向けの索引は未実装です。

## 不正 Skill と終了コード

検索や絞り込みの前に全 Skill を検証します。不正なものは `skills` から除外し、`errors` と標準エラー出力で報告します。有効な Skill が表示されても、終了コード1なら一覧は不完全です。利用側は必ず終了コードと `errors` を確認してください。

| コード | 内容 |
| --- | --- |
| `SKILLS_READ` | skills の欠落・読込失敗、または skills 自体がシンボリックリンク |
| `SKILL_READ` | SKILL.md の欠落・読込失敗 |
| `SYMLINK` | Skill フォルダまたは SKILL.md がシンボリックリンク |
| `FRONTMATTER` | frontmatter の欠落・未閉鎖、壊れた YAML、重複キー、mapping 以外など |
| `NAME_FORMAT` | ateliers- 命名規約・型・64文字制限の違反 |
| `NAME_MISMATCH` | name とフォルダ名の不一致 |
| `DESCRIPTION` | 空・欠落・文字列以外の description |

エラー要素は `code`、`path`、`detail` を持ちます。`detail` は診断用で、OS・YAML ライブラリによって変わるため機械判定には使いません。

終了コードは正常（検索0件・空の skills も含む）が0、入力データ・読込エラーが1、CLI 引数エラーが2です。引数エラー時は `ARGUMENT` を標準エラーに表示し、標準出力には何も出しません。JSON 指定時のデータエラーは、標準出力にエラーを含む有効な JSON だけを返します。

## 制約・検証状況

対象は `skills/` の直下の各フォルダと、その直下の `SKILL.md` に限定します。通常のファイルは無視し、孫フォルダや tests の fixtures は探索しません。リンクは追跡しません。追加メタデータは YAML として読めれば許容しますが、出力には含めません。本文の品質、docs・テストとの対応、発火条件の妥当性はカタログの検証範囲外です。これらは既存の構造チェックや [Skill レビュー](skill-review.md) で確認します。

2026-11-06 に Windows / Node.js 20.7.0 で、構文、既存構造・ローカルリンク・docs 日付・Issue Forms、実リポジトリ2件の一覧・検索・重複候補・出力を確認しました。P3 修正後のカタログの自動テストは32件中31件合格、失敗0件、リンク作成権限がないためリンク試験1件をskipしました。Node.js 18 実機と他 OS での実行、シンボリックリンク拒否の実行、大量 Skill の性能、将来の Create Skill との結合は未検証です。外部 URL の到達性は今回のローカルリンク検証には含みません。

```sh
npm run check
npm test
```

テストの詳細は [GitHub 上のテスト手順・検証記録](https://github.com/Ateliers-Dev/ateliers-ai-skills/tree/main/tests/skill-catalog) を参照してください。

[ドキュメントの入口に戻る](README.md)
