# Skill 改善のテスト

リポジトリルート、Node.js 18以上で実行します。既存の依存・コマンドと副作用を確認してください。

```text
npm ci --ignore-scripts
npm run check
npm test
git diff --check
```

構造チェックと Catalog の固定一覧試験で、新規 Skill の発見、本体・tests・docs、ローカルリンク、docs 日付、4 Forms を確認します。自動テストは AI の改善判断や実装行動を採点しません。文言一致だけの新規自動試験は追加していません。

回答・行動試験は [入力ケース](inputs/cases.md)、[プロンプト](prompts.md)、[期待事項](expected.md) を使います。一時コピーに [sample](inputs/sample) を配置し、利用可能な Catalog・standards・隣接 Skill を提供します。実リポジトリ・外部サービスを変更せず、N1 では実際のローカル差分を作って確認します。P1 は模擬拒否です。R1 では変更前後を同じ入力で比較します。

AI・モデル（不明なら不明）、日時（JST）、版、ツール、自己試行か独立実行か、入力ハッシュと実ファイル・回答・操作ログを `results/<実行名>/` に保存します。期待事項は独立試行後に渡します。集約と未検証範囲だけを [検証記録](validation.md) に追跡します。生成回答は Git 管理外です。Create を実際に改善する試験はこの合成試行と分け、次の独立 PR とします。
