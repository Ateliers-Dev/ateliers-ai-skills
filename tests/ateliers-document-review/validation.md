# 初版の検証記録

実施日：2026-11-06（日本時間）。初版コミットに含まれるファイルが検証対象です。

## 実施した確認

| 項目 | 方法と結果 |
| --- | --- |
| 既存構成 | GitHub の内容一覧が「This repository is empty.」を返すことを確認。既存ファイル・コミットがないため新規構成を作成 |
| Skill の構造 | `skill-creator/scripts/quick_validate.py skills/ateliers-document-review` → `Skill is valid!`。Python 3.12 と作業用フォルダの PyYAML 6.0.3 を使用 |
| 内容レビュー | 名前とフォルダ名、日本語の説明、適用範囲、事実・要確認・提案の区別、依頼なしの非変更、参照先、テストの判定基準を確認 |
| 結果の除外 | `git check-ignore` で `tests/ateliers-document-review/results/probe.md` と `tests/nested/example/results/probe.md` の両方が除外されることを確認 |
| 入力を使った試行 | 作成担当が同一チャット内で Skill を読み、正常文書と問題文書のレビュー回答を生成。正常文書の不要な欠陥指摘なし、問題文書の P1〜P6 と文書内命令の非実行を自己確認 |
| 入力の非変更 | 試行前後で下記 SHA-256 の一致を確認 |

```text
normal.md      1D48A92A24B70C09FF3E492BD723B80938A605AE6B2D61E5A0F8BB78E913751E
problematic.md 3A25A6EED120EABAF52D13D91C857C01BB259D13F0077BB61D870FF9082E127B
```

試行回答と自己採点はローカルの `results/initial/` に保存し、Git には含めません。

## 未検証・限界

- 新しい独立チャットでの実行と第三者による採点は未実施。作成担当は期待値を読んでおり、上記は非盲検の自己試行です。独立した動作評価の合格とは扱いません。
- Skill をインストールした状態での認識・自動選択、異なるモデルや環境での再現性は未検証です。
- 実在する技術文書、外部リンクや一次資料を調べるレビュー、大規模文書のレビューは未検証です。
- 構造検証の合格は内容の正確性や常時の指示遵守を保証しません。再実行には `README.md` と `prompts.md` を使用してください。
