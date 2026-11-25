# Windows でのローカル Skill インストール

> 作成日: 2026-11-06
> 更新日: 2026-11-25
> 作成者: yuu503

この手順は、PowerShell からリポジトリの Skill をユーザー領域（Codex 用の `.agents\skills`、Claude Code 用の `.claude\skills`）にコピーする方法です。使用するスクリプトはリポジトリの `tools/Install-Skills.ps1` です。

## 実行前の確認

リポジトリをローカルにチェックアウトし、対象の `skills/` とコピー先を確認します。スクリプトはコピー先の既存内容を削除しませんが、コピー元より新しい既存ファイルは更新日時の理由を表示して保護します。Git チェックアウトが更新日時に影響している可能性があるため、表示されたファイルの内容を確認してください。強制上書きオプションはありません。

## 変更予定の確認と実行

リポジトリのルートで PowerShell を起動し、先に `-WhatIf` で予定を確認します。

```powershell
.\tools\Install-Skills.ps1 -WhatIf
```

表示されたコピー先・対象を確認して実行します。

```powershell
.\tools\Install-Skills.ps1
```

## 配置先の選択（Codex / Claude Code）

`-Target` で配置先のツールを選びます。省略時は従来どおり Codex 用です。

| `-Target` | 配置先 | 用途 |
| --- | --- | --- |
| `Codex`（省略時） | `$HOME\.agents\skills` | Codex |
| `Claude` | `$HOME\.claude\skills` | Claude Code（個人用 Skill） |
| `All` | 上記の両方 | 両方のツールを使う場合 |

```powershell
.\tools\Install-Skills.ps1 -Target Claude -WhatIf
.\tools\Install-Skills.ps1 -Target Claude
```

どの配置先でも、コピー対象と更新判定、安全確認は同じです。`-Target All` では配置先ごとに処理し、完了時の件数は合計で表示します。`-DestinationPath` を指定すると配置先をその 1 か所に固定するため、`-Target All` とは併用できません。`-DestinationPath` を指定した場合、`-Target` は配置先に影響しません。`~/.claude` がシンボリックリンクの場合は、安全確認により拒否されます。`~/.claude` が無い環境では作成されます。また、`CLAUDE_CONFIG_DIR` で Claude Code の設定フォルダーを変更している場合は、`-DestinationPath` で配置先を指定してください。プロジェクト用（`.claude/skills` など）への配置は対象外です。必要な場合は [各 AI ツールでの使い方](../ai-tools.md) を参照して手動でコピーしてください。

別のコピー先を確認する場合は、リポジトリ外の完全修飾絶対パスを `-DestinationPath` に指定します。相対パスやリポジトリ配下のパスは安全のため拒否します。

```powershell
.\tools\Install-Skills.ps1 -DestinationPath 'C:\Temp\AI Skills\.agents\skills' -WhatIf
```

対象は `skills/` 直下にある `SKILL.md` を含む Skill ディレクトリです。マニフェストだけでなく、`references/`、`scripts/`、`assets/` などの必要なファイルも再帰コピーします。一時ファイルや一般的な OS・言語ツールのキャッシュは除外します。コピー先だけにあるファイルは残します。

`ateliers-pr-review/references/filesystem-path-safety.md` はファイルパス安全性の知見を同梱した生成物です。6観点の適用条件・入力例・証拠・限界を本文で読めるため、リポジトリルートの `knowledge/` を別途コピーする必要はありません。Skill フォルダ全体をコピーしてください。Skill 本体の条件付き参照・フォールバックは後続の PR B で扱います。

同梱資料を直接編集せず、保守時はリポジトリの `knowledge/reviews/patterns/filesystem-path-safety.md` を編集し、`npm run knowledge:generate` で生成、`npm run check` で照合します。インストーラーは生成・照合を実行せず、Git 管理された生成物をそのままコピーします。利用者によるインストール時の Node.js 実行は不要です。コピー先の同梱資料も下記の更新日時による保護対象となり、保護時には未更新の資料が残るため警告と内容を確認してください。

## 安全確認と更新判定

- 内容が同じファイルはスキップします。内容の比較には SHA-256 を使います。
- コピー元の UTC 更新日時が新しい場合は、確認可能な上書きとしてコピー元を反映し、更新日時を引き継ぎます。
- コピー先の UTC 更新日時が新しい場合は、内容が異なることと保護理由を警告し、スキップします。時刻が同じ、または差が2秒以内の場合も、ファイルシステムの時刻精度を考慮して保護・警告します。Git チェックアウトによって、時刻と内容の新旧が一致しないことがあります。
- `-WhatIf` はファイル・ディレクトリを変更しません。`-Confirm` は各作成・コピーを個別に確認します。
- コピー元・コピー先の親階層、既存 Skill 内、書き込み対象のパスにシンボリックリンクやジャンクション等を検出した場合は、安全のため拒否します。ファイルシステムの状態を確認している間に別プロセスがパスを差し替える競合までは防げないため、インストール先に対する同時変更は避けてください。
- 権限などのエラーは対象パスと原因を報告し、処理全体をエラーにします。管理者権限は要求しません。

このスクリプトは Codex 用 `.agents\skills` と Claude Code 用 `.claude\skills` への手動インストール専用です。同期削除、アンインストール、自動更新、その他のツール向けの配置は行いません。
