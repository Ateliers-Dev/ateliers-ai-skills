# Skill 作成のテスト

Node.js 18以上でリポジトリルートから実行します。

```text
npm ci
npm run check
npm test
node --test tests/ateliers-skill-create/create.test.mjs
git diff --check
```

既存チェッカーで構造・リンク・docs 日付・4 Forms を確認します。追加テストは実リポジトリの Create の登録と、再利用調査で使う Catalog の CLI/API 連携を確認します。AI の意味的判断や行動は自動採点しません。

回答・行動試験は一時作業コピーに本体・既存 Skill・standards・Catalog と依存を渡し、[プロンプト](prompts.md) ごとに実施します。[入力](inputs/normal.md) と本体を渡し、期待事項は試行後に読みます。独立実行では新規チャットを使い、過去の回答・期待値を渡しません。実在 Issue・main・外部サービスは変更しません。

回答・作成物・操作・前後の入力ハッシュを `results/<実行名>/` に保存し、[期待事項](expected.md) で採点します。AI・モデル（不明なら不明）・日時（JST）・版・ツール・自己試行か独立実行かを記録し、集約結果だけ [検証記録](validation.md) に残します。生成結果はコミットしません。模擬権限拒否を実サービスの拒否試験と混同しません。
