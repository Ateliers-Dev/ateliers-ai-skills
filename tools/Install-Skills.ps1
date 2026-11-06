[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter()]
    [string] $DestinationPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedPath {
    param([Parameter(Mandatory)][string] $Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
}

function Test-PathWithinDirectory {
    param(
        [Parameter(Mandatory)][string] $CandidatePath,
        [Parameter(Mandatory)][string] $DirectoryPath
    )

    $candidate = Get-NormalizedPath -Path $CandidatePath
    $directory = Get-NormalizedPath -Path $DirectoryPath
    if ([string]::Equals($candidate, $directory, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $directoryPrefix = $directory + [System.IO.Path]::DirectorySeparatorChar
    return $candidate.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparsePoint {
    param(
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][string] $Context
    )

    $fullPath = Get-NormalizedPath -Path $Path
    $root = [System.IO.Path]::GetPathRoot($fullPath)
    $current = $root
    $relative = $fullPath.Substring($root.Length)
    foreach ($part in ($relative -split '[\\/]+' | Where-Object { $_ })) {
        $current = Join-Path $current $part
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "安全確認に失敗しました（$Context）: リンクまたはジャンクションを含むパスです: $current"
            }
        }
    }
}

function Get-InstallableFiles {
    param([Parameter(Mandatory)][string] $SkillPath)

    $excludedDirectories = @('.git', 'node_modules', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache')
    $excludedNames = @('.DS_Store', 'Thumbs.db', 'desktop.ini')
    $files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push($SkillPath)

    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
            if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "コピー元にシンボリックリンクまたはジャンクションがあります。安全のため中止します: $($entry.FullName)"
            }
            if ($entry.PSIsContainer) {
                if ($excludedDirectories -contains $entry.Name) { continue }
                $pending.Push($entry.FullName)
                continue
            }

            if ($excludedNames -contains $entry.Name -or
                $entry.Name -like '~$*' -or
                $entry.Name -match '\.(tmp|temp|bak|pyc|pyo)$') {
                continue
            }
            $files.Add([System.IO.FileInfo]$entry)
        }
    }
    return $files
}

function Ensure-SafeDirectory {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
    param([Parameter(Mandatory)][string] $Path)

    Assert-NoReparsePoint -Path $Path -Context 'コピー先ディレクトリ'
    if (Test-Path -LiteralPath $Path) {
        if (-not (Get-Item -LiteralPath $Path -Force).PSIsContainer) {
            throw "コピー先として必要なディレクトリの場所にファイルがあります: $Path"
        }
        return
    }

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        Ensure-SafeDirectory -Path $parent
    }
    if ($PSCmdlet.ShouldProcess($Path, 'ディレクトリを作成')) {
        New-Item -ItemType Directory -Path $Path -ErrorAction Stop | Out-Null
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repositoryRoot 'skills'
if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "コピー元の skills ディレクトリが見つかりません: $sourceRoot"
}
Assert-NoReparsePoint -Path $sourceRoot -Context 'コピー元 skills'

if ($PSBoundParameters.ContainsKey('DestinationPath')) {
    $normalizedDestinationPath = $DestinationPath.Replace('/', '\')
    $isDriveAbsolute = $normalizedDestinationPath -match '^[A-Za-z]:\\'
    $isUncAbsolute = $normalizedDestinationPath -match '^\\\\[^\\]+\\[^\\]+(?:\\|$)'
    $isDevicePath = $normalizedDestinationPath -match '^(?:\\\\\?\\|\\\\\.\\)'
    if ($isDevicePath) {
        throw "Windows デバイス名前空間のパスは使用できません: $DestinationPath"
    }
    if (-not $isDriveAbsolute -and -not $isUncAbsolute) {
        throw "DestinationPath には完全修飾された絶対パスを指定してください（相対パス・ドライブ相対パスは使用できません）: $DestinationPath"
    }
    $DestinationPath = $normalizedDestinationPath
} else {
    $DestinationPath = Join-Path $HOME '.agents\skills'
}

$destination = Get-NormalizedPath -Path $DestinationPath
$repositoryRoot = Get-NormalizedPath -Path (Split-Path -Parent $PSScriptRoot)
if (Test-PathWithinDirectory -CandidatePath $destination -DirectoryPath $repositoryRoot) {
    throw "コピー先はリポジトリ内に指定できません。リポジトリ外の絶対パスを指定してください: $destination"
}
$destinationRoot = [System.IO.Path]::GetPathRoot($destination)
if (-not $destinationRoot -or $destination -eq $destinationRoot.TrimEnd('\', '/')) {
    throw "ルートディレクトリをコピー先には指定できません: $destination"
}
Assert-NoReparsePoint -Path $destination -Context 'コピー先と親階層'

$skills = @(Get-ChildItem -LiteralPath $sourceRoot -Directory -Force | Sort-Object Name)
if ($skills.Count -eq 0) {
    throw "コピー元に Skill ディレクトリがありません: $sourceRoot"
}

$errors = [System.Collections.Generic.List[string]]::new()
$copied = 0
$overwritten = 0
$skipped = 0

foreach ($skill in $skills) {
    try {
        Assert-NoReparsePoint -Path $skill.FullName -Context 'Skill コピー元'
        $manifestPath = Join-Path $skill.FullName 'SKILL.md'
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }

        $skillDestination = Join-Path $destination $skill.Name
        $files = @(Get-InstallableFiles -SkillPath $skill.FullName)
        foreach ($sourceFile in $files) {
            $relativePath = $sourceFile.FullName.Substring($skill.FullName.Length).TrimStart('\', '/')
            $plannedTarget = Join-Path $skillDestination $relativePath
            Assert-NoReparsePoint -Path $plannedTarget -Context '既存 Skill と書き込み対象'
            if ((Test-Path -LiteralPath $plannedTarget) -and (Get-Item -LiteralPath $plannedTarget -Force).PSIsContainer) {
                throw "コピー先ファイルの場所にディレクトリがあります: $plannedTarget"
            }
        }
        Ensure-SafeDirectory -Path $skillDestination
        foreach ($sourceFile in $files) {
            $relativePath = $sourceFile.FullName.Substring($skill.FullName.Length).TrimStart('\', '/')
            $targetFile = Join-Path $skillDestination $relativePath
            $targetDirectory = Split-Path -Parent $targetFile
            Ensure-SafeDirectory -Path $targetDirectory
            Assert-NoReparsePoint -Path $targetFile -Context '既存 Skill と書き込み対象'

            $action = '新規コピー'
            if (Test-Path -LiteralPath $targetFile) {
                if ((Get-Item -LiteralPath $targetFile -Force).PSIsContainer) {
                    throw "コピー先ファイルの場所にディレクトリがあります: $targetFile"
                }
                $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
                $targetHash = (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash
                if ($sourceHash -eq $targetHash) {
                    Write-Host "スキップ（内容一致）: $targetFile"
                    $skipped++
                    continue
                }

                $sourceUtc = $sourceFile.LastWriteTimeUtc
                $targetUtc = (Get-Item -LiteralPath $targetFile -Force).LastWriteTimeUtc
                $timeDifference = $sourceUtc - $targetUtc
                $timeTolerance = [System.TimeSpan]::FromSeconds(2)
                if ([math]::Abs($timeDifference.TotalSeconds) -le $timeTolerance.TotalSeconds) {
                    Write-Warning "スキップ（内容が異なり、更新日時が同一または2秒以内の差のため保護）: $targetFile`n  コピー元 UTC: $($sourceUtc.ToString('o'))`n  コピー先 UTC: $($targetUtc.ToString('o'))`n  ファイルシステムの時刻精度や Git チェックアウトにより新旧を確定できない可能性があります。内容は SHA-256 で異なることを確認済みです。"
                    $skipped++
                    continue
                }
                if ($sourceUtc -lt $targetUtc) {
                    Write-Warning "スキップ（内容が異なり、コピー先の更新日時がコピー元より新しいため保護）: $targetFile`n  コピー元 UTC: $($sourceUtc.ToString('o'))`n  コピー先 UTC: $($targetUtc.ToString('o'))`n  Git チェックアウト等で更新日時が実際の内容の新旧を示さない場合があります。内容は SHA-256 で異なることを確認済みです。"
                    $skipped++
                    continue
                }
                $action = 'コピー元の方が新しいため上書き'
            }

            if ($PSCmdlet.ShouldProcess($targetFile, $action)) {
                Copy-Item -LiteralPath $sourceFile.FullName -Destination $targetFile -Force -ErrorAction Stop
                (Get-Item -LiteralPath $targetFile -Force).LastWriteTimeUtc = $sourceFile.LastWriteTimeUtc
                if ($action -eq '新規コピー') { $copied++ } else { $overwritten++ }
                Write-Host "$action`: $targetFile"
            }
        }
    }
    catch {
        $message = "Skill '$($skill.Name)' の処理に失敗しました: $($_.Exception.Message)"
        $errors.Add($message)
        Write-Error -Message $message -ErrorAction Continue
    }
}

Write-Host "完了: 新規コピー $copied 件、上書き $overwritten 件、スキップ $skipped 件"
if ($errors.Count -gt 0) {
    $errorDetails = $errors -join [System.Environment]::NewLine
    throw ('インストール中に {0} 件のエラーが発生しました。対象と原因:{1}{2}' -f $errors.Count, [System.Environment]::NewLine, $errorDetails)
}
