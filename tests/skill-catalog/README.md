# Skill Catalog の自動テスト

Node.js 18以上で、リポジトリルートから実行します。

```sh
npm ci
npm test
node --test tests/skill-catalog/catalog.test.mjs
npm run check
```

入力と期待値は [catalog.test.mjs](catalog.test.mjs) に収録しています。一時ディレクトリへ入力を生成し、終了時にそのテストが作ったディレクトリだけを削除します。Skill の指示や外部コマンドは実行しません。CLI の実行試験には現在の Node.js を使用します。

- 正常入力：独立した2件、BOM/CRLF、quoted/block scalar、追加メタデータ、空集合。
- 問題入力：欠落・未閉鎖frontmatter、壊れたYAML、重複キー、mapping以外、未定義alias、名前・descriptionの型や値の違反、欠落ファイル、読込不能なファイル、リンク。
- 検索：日本語、NFKC・大小文字、name/description/path、AND/OR、空語、0件、検索外の不正。
- 出力：一覧・重複モードでの非空queryの無視、検索・候補検索での正規化済みquery（空白のみ・読込エラー時を含む）、CLIとの一致、固定JSON契約と順序、Markdownのエスケープ、終了コード、標準出力・標準エラーの分離、引数エラー、別作業ディレクトリからの実行。
- 重複候補：共通name語・同一description・根拠・無関係な組の除外。意味的重複を判定する期待値は設けません。

リンク作成権限がない環境ではリンク試験だけを skip と明記します。既存リポジトリの収録Skillが変わった場合は、実リポジトリ試験の期待値も確認してください。

実施記録は [validation.md](validation.md)、利用方法と出力契約は [docs](../../docs/skill-catalog.md) を参照してください。
