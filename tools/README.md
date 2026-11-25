# Install-Skills.ps1

> 作成日: 2026-11-06
> 更新日: 2026-11-25
> 作成者: yuu503

Windows 用 PowerShell インストーラーです。実行前の確認、コピー対象、更新判定、安全上の注意は[ローカル Skill インストール手順](../docs/guides/skill-installation.md)を参照してください。

リポジトリのルートで、まず変更予定を確認します。

```powershell
.\tools\Install-Skills.ps1 -WhatIf
```

確認後に実行します。

```powershell
.\tools\Install-Skills.ps1
```

配置先は `-Target` で選びます。省略時は Codex 用と Claude Code 用の両方に配置します。

| `-Target` | 既定の配置先 |
| --- | --- |
| `Codex` | `$HOME\.agents\skills` |
| `Claude` | `$HOME\.claude\skills`（Claude Code の個人用 Skill） |
| `All`（省略時） | 上記の両方 |

```powershell
.\tools\Install-Skills.ps1 -Target Claude -WhatIf
.\tools\Install-Skills.ps1 -Target All
```

別のコピー先を明示する場合は、リポジトリ外の完全修飾絶対パスを `-DestinationPath` に指定します。相対パス、ドライブ相対パス、リポジトリ内のパスは拒否します。`-DestinationPath` は配置先を 1 か所に固定します（`-Target` を省略した場合も 1 か所のみ）。`-Target All` を明示した併用はできません。実行確認を毎回求める場合は `-Confirm` を加えます。強制上書きオプションはありません。更新日時が同一、または差が2秒以内の場合も時刻精度の影響を考慮してスキップし、警告します。

一時ディレクトリを使った統合テスト（PowerShell 7）：

```powershell
pwsh -NoProfile -File tests\tools\Install-Skills.Tests.ps1
```
