# レビュー知見の配布・同期テスト

作成日：2026-11-06 ／ 更新日：2026-11-06（日本標準時 JST (UTC+09:00)）

Phase 3 PR A の生成器・同期・配布を検証します。AI の条件付き参照・フォールバックや PR #9 を使う行動評価は PR B の対象です。

## 要求と検証

| 要求・判断 | 変更前 → 変更後 | 回帰検証・期待結果 |
| --- | --- | --- |
| 配布時に知見を読めるよう拡張 | リポジトリの knowledge/ のみ → 正本を保持し、Skill 配下へ機械生成 | Skill のみを一時領域へコピーし、6観点・適用条件・問い・例・証拠・限界・出典と絶対URLが残る |
| 二重編集を防ぐ同期基盤を追加 | 照合なし → 欠落・手編集・未同期を失敗にする | 照合前後の内容・mtime が一致し、欠落ディレクトリも作らない。明示生成後は合格 |
| 再現可能な生成を追加 | 生成器なし → UTF-8/LF と内容 SHA-256、HEAD・日時非依存 | BOM/CRLF、別配置、別HEAD表記、繰り返し生成で同一出力。正本を変更しない |
| 配布後のリンクを維持 | 相対参照 → 絶対URLへ変換 | 事例・入口・アンカーの期待URL、固定コミット保持、コード内の非変換、未対応形式の失敗 |
| 既存インストーラーとの互換性を確認 | 汎用 references fixture のみ → 実際の生成物も確認 | SHA-256 一致のコピー、古い配布物の更新、新しい・同時刻・許容差内の既存資料の内容/時刻保護 |

## 再実行

Node.js 18以上で `npm ci` の後、リポジトリルートから実行します。

```text
npm run knowledge:generate
npm run check
npm test
git diff --check
```

照合だけなら `node scripts/sync-review-knowledge.mjs` または `--check`、個別の自動テストは `node --test tests/review-knowledge/sync.test.mjs` です。明示生成は Git 管理の生成物を書き換えます。テストは OS の一時領域を使い終了時に削除し、リポジトリの正本と生成物は変更しません。

実インストーラーの試験は Windows で実行します。ユーザーの実際のインストール先へは配置せず、一時リポジトリと一時コピー先を使います。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/tools/Install-Skills.Tests.ps1
pwsh -NoProfile -File tests/tools/Install-Skills.Tests.ps1
```

[検証記録](validation.md)で作者実行・未検証事項を区別します。ログ等の生成結果を保存する場合は `tests/review-knowledge/results/` を使い、Git 管理しません。

切り戻す場合は PR A の変更一式を戻し、check/test を再実行します。Skill 本体・インストーラー本体・standards の変更や main の書き換えは不要です。
