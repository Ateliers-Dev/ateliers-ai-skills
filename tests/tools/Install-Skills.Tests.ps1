[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$installer = Join-Path $repoRoot 'tools\Install-Skills.ps1'
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ateliers-skills-test-' + [guid]::NewGuid().ToString('N'))
$passed = 0
$failed = 0
$skipped = 0
$skipSignal = $false

function Assert-True {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) { throw $Message }
}

function Invoke-Installer {
    [CmdletBinding()]
    param([string] $SourceRoot, [string] $Destination, [string] $DestinationInsideRepository, [switch] $DestinationSibling, [switch] $WhatIf)
    $tempRepo = Join-Path $temporaryRoot ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path (Join-Path $tempRepo 'tools') -Force | Out-Null
    Copy-Item -LiteralPath $installer -Destination (Join-Path $tempRepo 'tools\Install-Skills.ps1')
    Copy-Item -LiteralPath $SourceRoot -Destination (Join-Path $tempRepo 'skills') -Recurse
    if ($DestinationInsideRepository) { $Destination = Join-Path $tempRepo $DestinationInsideRepository }
    if ($DestinationSibling) { $Destination = (Join-Path (Split-Path -Parent $tempRepo) ((Split-Path -Leaf $tempRepo) + '-sibling')) }
    if ($WhatIf) {
        & (Join-Path $tempRepo 'tools\Install-Skills.ps1') -DestinationPath $Destination -WhatIf
    } else {
        & (Join-Path $tempRepo 'tools\Install-Skills.ps1') -DestinationPath $Destination
    }
}

function New-TestSkill {
    param([string] $Root, [string] $Name = 'ateliers-test')
    $skill = Join-Path $Root $Name
    New-Item -ItemType Directory -Path $skill -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $skill 'SKILL.md') -Value '---' -NoNewline
    return $skill
}

function Run-Case {
    param([string] $Name, [scriptblock] $Body)
    try {
        & $Body
        if ($script:skipSignal) { $script:skipSignal = $false; return }
        Write-Host "PASS: $Name"
        $script:passed++
    } catch {
        Write-Host "FAIL: $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

function Report-Skipped {
    param([string] $Name, [string] $Reason)
    Write-Host "SKIP: $Name - $Reason"
    $script:skipped++
    $script:skipSignal = $true
}

New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
try {
    Run-Case 'new copy, nested resources, and localized paths' {
        $root = Join-Path $temporaryRoot '日本語 source with spaces'
        $dest = Join-Path $temporaryRoot '日本語 destination with spaces'
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        $skill = New-TestSkill -Root $root
        New-Item -ItemType Directory -Path (Join-Path $skill 'references\nested') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $skill 'references\nested\guide.md') -Value 'reference'
        Set-Content -LiteralPath (Join-Path $skill 'scratch.tmp') -Value 'exclude'
        Invoke-Installer -SourceRoot $root -Destination $dest | Out-Null
        Assert-True (Test-Path -LiteralPath (Join-Path $dest 'ateliers-test\SKILL.md')) 'SKILL.md was not copied.'
        Assert-True (Test-Path -LiteralPath (Join-Path $dest 'ateliers-test\references\nested\guide.md')) 'Nested reference was not copied.'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $dest 'ateliers-test\scratch.tmp'))) 'Temporary file was copied.'
    }

    Run-Case 'identical content is skipped and extra destination file is retained' {
        $root = Join-Path $temporaryRoot 'same-source'; $dest = Join-Path $temporaryRoot 'same-dest'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null
        $skill = New-TestSkill -Root $root
        $sourceFile = Join-Path $skill 'SKILL.md'; $targetSkill = Join-Path $dest 'ateliers-test'
        New-Item -ItemType Directory -Path $targetSkill -Force | Out-Null
        $targetFile = Join-Path $targetSkill 'SKILL.md'
        Copy-Item $sourceFile $targetFile
        $targetTimestamp = [datetime]::UtcNow.AddHours(-2)
        (Get-Item $targetFile).LastWriteTimeUtc = $targetTimestamp
        (Get-Item $sourceFile).LastWriteTimeUtc = [datetime]::UtcNow
        Set-Content -LiteralPath (Join-Path $targetSkill 'user.txt') -Value 'keep'
        Invoke-Installer -SourceRoot $root -Destination $dest | Out-Null
        Assert-True ((Get-Item $targetFile).LastWriteTimeUtc -eq $targetTimestamp) 'Identical content was copied instead of skipped.'
        Assert-True (Test-Path -LiteralPath (Join-Path $targetSkill 'user.txt')) 'Destination-only file was removed.'
    }

    Run-Case 'newer source overwrites and preserves source timestamp' {
        $root = Join-Path $temporaryRoot 'newer-source'; $dest = Join-Path $temporaryRoot 'newer-dest'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null
        $skill = New-TestSkill -Root $root
        $sourceFile = Join-Path $skill 'SKILL.md'; $targetSkill = Join-Path $dest 'ateliers-test'
        New-Item -ItemType Directory -Path $targetSkill -Force | Out-Null
        $targetFile = Join-Path $targetSkill 'SKILL.md'
        Set-Content -LiteralPath $targetFile -Value 'old destination'
        (Get-Item $sourceFile).LastWriteTimeUtc = [datetime]::UtcNow.AddMinutes(-2)
        (Get-Item $targetFile).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-1)
        Invoke-Installer -SourceRoot $root -Destination $dest | Out-Null
        Assert-True ((Get-Content -Raw $targetFile) -eq (Get-Content -Raw $sourceFile)) 'Newer source did not overwrite.'
        Assert-True ((Get-Item $targetFile).LastWriteTimeUtc -eq (Get-Item $sourceFile).LastWriteTimeUtc) 'Source timestamp was not preserved.'
    }

    Run-Case 'newer destination is protected with warning' {
        $root = Join-Path $temporaryRoot 'newer-destination'; $dest = Join-Path $temporaryRoot 'newer-destination-out'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null
        $skill = New-TestSkill -Root $root
        $targetSkill = Join-Path $dest 'ateliers-test'; New-Item -ItemType Directory -Path $targetSkill -Force | Out-Null
        $targetFile = Join-Path $targetSkill 'SKILL.md'; Set-Content -LiteralPath $targetFile -Value 'newer target'
        (Get-Item (Join-Path $skill 'SKILL.md')).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-2)
        (Get-Item $targetFile).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-1)
        $warning = Invoke-Installer -SourceRoot $root -Destination $dest -WarningAction Continue 3>&1 | Out-String
        Assert-True ((Get-Content -Raw $targetFile).Contains('newer target')) 'Newer destination was overwritten.'
        Assert-True ($warning -match 'コピー先の更新日時がコピー元より新しいため保護') 'Protection reason was not reported.'
    }

    Run-Case 'equal timestamps with different content are protected' {
        $root = Join-Path $temporaryRoot 'equal-time'; $dest = Join-Path $temporaryRoot 'equal-time-out'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null
        $skill = New-TestSkill -Root $root; $sourceFile = Join-Path $skill 'SKILL.md'
        $targetSkill = Join-Path $dest 'ateliers-test'; New-Item -ItemType Directory -Path $targetSkill -Force | Out-Null
        $targetFile = Join-Path $targetSkill 'SKILL.md'; Set-Content -LiteralPath $targetFile -Value 'different'
        $stamp = [datetime]::UtcNow.AddHours(-2); (Get-Item $sourceFile).LastWriteTimeUtc = $stamp; (Get-Item $targetFile).LastWriteTimeUtc = $stamp
        Invoke-Installer -SourceRoot $root -Destination $dest -WarningAction SilentlyContinue | Out-Null
        Assert-True ((Get-Content -Raw $targetFile).Contains('different')) 'Equal-time destination was overwritten.'
    }

    Run-Case 'timestamps within file-system precision tolerance are protected' {
        $root = Join-Path $temporaryRoot 'near-time'; $dest = Join-Path $temporaryRoot 'near-time-out'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null
        $skill = New-TestSkill -Root $root; $sourceFile = Join-Path $skill 'SKILL.md'
        $targetSkill = Join-Path $dest 'ateliers-test'; New-Item -ItemType Directory -Path $targetSkill -Force | Out-Null
        $targetFile = Join-Path $targetSkill 'SKILL.md'; Set-Content -LiteralPath $targetFile -Value 'near-time destination'
        $stamp = [datetime]::UtcNow.AddHours(-2); (Get-Item $sourceFile).LastWriteTimeUtc = $stamp.AddSeconds(1); (Get-Item $targetFile).LastWriteTimeUtc = $stamp
        Invoke-Installer -SourceRoot $root -Destination $dest -WarningAction SilentlyContinue | Out-Null
        Assert-True ((Get-Content -Raw $targetFile).Contains('near-time destination')) 'Near-time destination was overwritten.'
    }

    Run-Case 'WhatIf creates and copies nothing' {
        $root = Join-Path $temporaryRoot 'whatif-source'; $dest = Join-Path $temporaryRoot 'whatif-destination'
        New-Item -ItemType Directory -Path $root -Force | Out-Null; New-TestSkill -Root $root | Out-Null
        Invoke-Installer -SourceRoot $root -Destination $dest -WhatIf | Out-Null
        Assert-True (-not (Test-Path -LiteralPath $dest)) 'WhatIf created the destination.'
    }

    Run-Case 'a missing destination is created' {
        $root = Join-Path $temporaryRoot 'missing-dest-source'; $dest = Join-Path $temporaryRoot 'missing\nested\destination'
        New-Item -ItemType Directory -Path $root -Force | Out-Null; New-TestSkill -Root $root | Out-Null
        Invoke-Installer -SourceRoot $root -Destination $dest | Out-Null
        Assert-True (Test-Path -LiteralPath (Join-Path $dest 'ateliers-test\SKILL.md')) 'Nested destination was not created.'
    }

    Run-Case 'relative, drive-relative, and root-relative destination paths are refused' {
        $root = Join-Path $temporaryRoot 'relative-path-source'
        New-Item -ItemType Directory -Path $root -Force | Out-Null; New-TestSkill -Root $root | Out-Null
        foreach ($path in @('.\relative-skills', 'C:relative-skills', '\root-relative-skills')) {
            $caught = $false
            try { Invoke-Installer -SourceRoot $root -Destination $path | Out-Null } catch { $caught = $_.Exception.Message -match '完全修飾された絶対パス' }
            Assert-True $caught "Ambiguous destination path was accepted: $path"
        }
    }

    Run-Case 'repository root and all repository subdirectories are refused as destinations' {
        $root = Join-Path $temporaryRoot 'overlap-source'
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        $skill = New-TestSkill -Root $root
        New-Item -ItemType Directory -Path (Join-Path $skill 'references\nested'), (Join-Path $root 'docs') -Force | Out-Null
        foreach ($inside in @('.', 'skills', 'skills\ateliers-test', 'skills\ateliers-test\references\nested', 'tools', 'docs')) {
            $caught = $false
            try { Invoke-Installer -SourceRoot $root -DestinationInsideRepository $inside | Out-Null } catch { $caught = $_.Exception.Message -match 'コピー先はリポジトリ内' }
            Assert-True $caught "Repository-contained destination was accepted: $inside"
        }
        $caseInsensitiveCaught = $false
        try { Invoke-Installer -SourceRoot $root -DestinationInsideRepository 'SKILLS\ATELIERS-TEST' | Out-Null } catch { $caseInsensitiveCaught = $_.Exception.Message -match 'コピー先はリポジトリ内' }
        Assert-True $caseInsensitiveCaught 'Case-insensitive repository path comparison failed.'
        Invoke-Installer -SourceRoot $root -DestinationSibling -WhatIf | Out-Null
    }

    Run-Case 'WhatIf leaves an existing file and its timestamp unchanged' {
        $root = Join-Path $temporaryRoot 'whatif-existing-source'; $dest = Join-Path $temporaryRoot 'whatif-existing-destination'
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        $skill = New-TestSkill -Root $root
        Set-Content -LiteralPath (Join-Path $skill 'SKILL.md') -Value 'new source content'
        $targetSkill = Join-Path $dest 'ateliers-test'; New-Item -ItemType Directory -Path $targetSkill -Force | Out-Null
        $targetFile = Join-Path $targetSkill 'SKILL.md'; Set-Content -LiteralPath $targetFile -Value 'existing destination content'
        $targetTimestamp = [datetime]::UtcNow.AddHours(-2); (Get-Item $targetFile).LastWriteTimeUtc = $targetTimestamp
        (Get-Item (Join-Path $skill 'SKILL.md')).LastWriteTimeUtc = [datetime]::UtcNow
        Invoke-Installer -SourceRoot $root -Destination $dest -WhatIf | Out-Null
        Assert-True ((Get-Content -Raw $targetFile).Contains('existing destination content')) 'WhatIf changed existing file content.'
        Assert-True ((Get-Item $targetFile).LastWriteTimeUtc -eq $targetTimestamp) 'WhatIf changed existing file timestamp.'
    }

    Run-Case 'destination inside a junction is refused' {
        $root = Join-Path $temporaryRoot 'junction-source'; $outside = Join-Path $temporaryRoot 'junction-outside'; $holder = Join-Path $temporaryRoot 'junction-holder'
        New-Item -ItemType Directory -Path $root,$outside,$holder -Force | Out-Null; New-TestSkill -Root $root | Out-Null
        $junction = Join-Path $holder 'link'
        try { New-Item -ItemType Junction -Path $junction -Target $outside -ErrorAction Stop | Out-Null } catch { Report-Skipped 'destination inside a junction is refused' 'この実行環境ではジャンクションを作成できません。'; return }
        $caught = $false
        try { Invoke-Installer -SourceRoot $root -Destination (Join-Path $junction 'skills') | Out-Null } catch { $caught = $_.Exception.Message -match 'リンクまたはジャンクション' }
        Assert-True $caught 'Destination junction was not refused.'
    }

    Run-Case 'junction inside an existing Skill directory is refused' {
        $root = Join-Path $temporaryRoot 'inner-junction-source'; $dest = Join-Path $temporaryRoot 'inner-junction-dest'; $outside = Join-Path $temporaryRoot 'inner-junction-outside'
        New-Item -ItemType Directory -Path $root,$dest,$outside -Force | Out-Null
        $skill = New-TestSkill -Root $root
        New-Item -ItemType Directory -Path (Join-Path $skill 'references') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $skill 'references\guide.md') -Value 'reference'
        New-Item -ItemType Directory -Path (Join-Path $dest 'ateliers-test') -Force | Out-Null
        try { New-Item -ItemType Junction -Path (Join-Path $dest 'ateliers-test\references') -Target $outside -ErrorAction Stop | Out-Null } catch { Report-Skipped 'junction inside an existing Skill directory is refused' 'この実行環境ではジャンクションを作成できません。'; return }
        $caught = $false
        try { Invoke-Installer -SourceRoot $root -Destination $dest | Out-Null } catch { $caught = $_.Exception.Message -match 'リンクまたはジャンクション' }
        Assert-True $caught 'Junction inside Skill destination was not refused.'
    }

    Run-Case 'symbolic link in an existing Skill write path is refused' {
        $root = Join-Path $temporaryRoot 'symlink-source'; $dest = Join-Path $temporaryRoot 'symlink-dest'; $outside = Join-Path $temporaryRoot 'symlink-outside'
        New-Item -ItemType Directory -Path $root,$dest,$outside -Force | Out-Null
        $skill = New-TestSkill -Root $root
        New-Item -ItemType Directory -Path (Join-Path $skill 'references') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $skill 'references\guide.md') -Value 'reference'
        New-Item -ItemType Directory -Path (Join-Path $dest 'ateliers-test') -Force | Out-Null
        try { New-Item -ItemType SymbolicLink -Path (Join-Path $dest 'ateliers-test\references') -Target $outside -ErrorAction Stop | Out-Null } catch { Report-Skipped 'symbolic link in an existing Skill write path is refused' 'この実行環境ではシンボリックリンクを作成できません。'; return }
        $caught = $false
        try { Invoke-Installer -SourceRoot $root -Destination $dest | Out-Null } catch { $caught = $_.Exception.Message -match 'リンクまたはジャンクション' }
        Assert-True $caught 'Symbolic link inside Skill destination was not refused.'
    }

    Run-Case 'destination file/directory conflict reports target and fails' {
        $root = Join-Path $temporaryRoot 'error-source'; $dest = Join-Path $temporaryRoot 'error-dest'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null; New-TestSkill -Root $root | Out-Null
        New-Item -ItemType File -Path (Join-Path $dest 'ateliers-test') -Force | Out-Null
        $caught = $false
        try { Invoke-Installer -SourceRoot $root -Destination $dest 2>&1 | Out-Null } catch { $caught = $_.Exception.Message -match 'コピー先として必要なディレクトリ' }
        Assert-True $caught 'File/directory conflict did not return an actionable error.'
    }

    Run-Case 'copy error is reported after partial progress without claiming success' {
        $root = Join-Path $temporaryRoot 'mid-error-source'; $dest = Join-Path $temporaryRoot 'mid-error-dest'
        New-Item -ItemType Directory -Path $root,$dest -Force | Out-Null
        $skill = New-TestSkill -Root $root
        Set-Content -LiteralPath (Join-Path $skill 'SKILL.md') -Value 'copy this first'
        New-Item -ItemType Directory -Path (Join-Path $skill 'references'), (Join-Path $dest 'ateliers-test\references') -Force | Out-Null
        $sourceLaterFile = Join-Path $skill 'references\later.md'; Set-Content -LiteralPath $sourceLaterFile -Value 'source later'
        $targetLaterFile = Join-Path $dest 'ateliers-test\references\later.md'; Set-Content -LiteralPath $targetLaterFile -Value 'locked destination'
        (Get-Item $sourceLaterFile).LastWriteTimeUtc = [datetime]::UtcNow
        (Get-Item $targetLaterFile).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-2)
        $lock = [System.IO.File]::Open($targetLaterFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        try {
            $caught = $false
            try { Invoke-Installer -SourceRoot $root -Destination $dest 2>&1 | Out-Null } catch { $caught = $_.Exception.Message -match 'エラーが発生しました' -and $_.Exception.Message -match 'ateliers-test' }
            Assert-True $caught 'Installer did not report the failed Skill and return an error.'
            Assert-True (Test-Path -LiteralPath (Join-Path $dest 'ateliers-test\SKILL.md')) 'Expected earlier successful copy was not retained.'
        } finally { $lock.Dispose() }
    }
} finally {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "結果: 成功 $passed 件 / 失敗 $failed 件 / 環境都合で未実施 $skipped 件"
if ($failed -gt 0) { exit 1 }
