# Install-Skills.ps1

Windows 用 PowerShell インストーラーです。実行前の確認、コピー対象、更新判定、安全上の注意は[ローカル Skill インストール手順](../docs/guides/skill-installation.md)を参照してください。

リポジトリのルートで、まず変更予定を確認します。

```powershell
.\tools\Install-Skills.ps1 -WhatIf
```

確認後に実行します。

```powershell
.\tools\Install-Skills.ps1
```

既定のコピー先は `$HOME\.agents\skills` です。別のコピー先を指定する場合は `-DestinationPath` を使います。実行確認を毎回求める場合は `-Confirm` を加えます。強制上書きオプションはありません。更新日時が同一、または差が2秒以内の場合も時刻精度の影響を考慮してスキップし、警告します。

一時ディレクトリを使った統合テスト（PowerShell 7）：

```powershell
pwsh -NoProfile -File tests\tools\Install-Skills.Tests.ps1
```
