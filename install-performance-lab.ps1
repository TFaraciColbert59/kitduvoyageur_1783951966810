param(
  [string]$Model = "opencode-go/space-bunny-free",
  [string]$Variant = "max",
  [switch]$SkipMcp,
  [switch]$SkipSkills,
  [switch]$SkipValidation,
  [switch]$AllowDirtyBootstrap,
  [switch]$AllowUntrackedSkills
)

$ErrorActionPreference = "Stop"

$ownedAgentFiles = @(
  "browser-profiler.md",
  "database-profiler.md",
  "journey-benchmark.md",
  "perf-implementer.md",
  "perf-orchestrator.md",
  "perf-reviewer.md",
  "react-next-profiler.md"
)

$ownedCommandFiles = @(
  "perf-baseline.md",
  "perf-day.md",
  "perf-hunt.md"
)

$ownedSkillFiles = @(
  "SKILL.md"
)

$ownedDocumentFiles = @(
  "BASELINE.md",
  "EXPERIMENTS.md",
  "SETUP.md",
  "backlog.md",
  "performance-budgets.json",
  "performance-budgets.schema.json",
  "performance-log.md"
)

$requiredSkills = @(
  "performance",
  "core-web-vitals",
  "supabase-postgres-best-practices",
  "vercel-react-best-practices",
  "web-quality-audit"
)

function Set-ObjectProperty {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)]$Value
  )

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
  } else {
    $property.Value = $Value
  }
}

function Assert-ContainedPath {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $root = [System.IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\')
  $candidate = [System.IO.Path]::GetFullPath($Path)
  if (-not $candidate.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Chemin hors du dépôt refusé : $candidate"
  }
}

function Assert-NoReparsePoint {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (Test-Path -LiteralPath $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Junction ou symlink refusé : $Path"
    }
  }
}

function Copy-PerformanceLabFile {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Fichier Performance Lab introuvable : $Source"
  }

  $sourcePath = (Resolve-Path -LiteralPath $Source).ProviderPath
  $destinationParent = Split-Path -Parent $Destination
  if (-not (Test-Path -LiteralPath $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent | Out-Null
  }
  $destinationPath = [System.IO.Path]::GetFullPath($Destination)
  if ($sourcePath -ieq $destinationPath) {
    return
  }
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

function Set-PerformanceAgentMetadata {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string[]]$AgentFiles,
    [Parameter(Mandatory = $true)][string]$ModelId,
    [Parameter(Mandatory = $true)][string]$ModelVariant
  )

  $encoding = [System.Text.UTF8Encoding]::new($false)
  foreach ($agentFile in $AgentFiles) {
    $path = Join-Path $RepositoryRoot ".opencode\agents\$agentFile"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Agent Performance Lab manquant : $path"
    }

    $content = [System.IO.File]::ReadAllText($path)
    $match = [regex]::Match($content, '\A---\r?\n(?<frontmatter>.*?)\r?\n---', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $match.Success) {
      throw "Frontmatter YAML invalide : $path"
    }

    $frontmatter = $match.Groups['frontmatter'].Value
    if (-not [regex]::IsMatch($frontmatter, '(?m)^model:\s*.*$')) {
      throw "Champ model manquant : $path"
    }
    $frontmatter = [regex]::Replace($frontmatter, '(?m)^model:\s*.*$', "model: $ModelId")
    if ([regex]::IsMatch($frontmatter, '(?m)^variant:\s*.*$')) {
      $frontmatter = [regex]::Replace($frontmatter, '(?m)^variant:\s*.*$', "variant: $ModelVariant")
    } else {
      $frontmatter = [regex]::Replace($frontmatter, '(?m)^(model:\s*.*)$', "`$1`nvariant: $ModelVariant")
    }

    $updated = $content.Substring(0, $match.Groups['frontmatter'].Index) + $frontmatter + $content.Substring($match.Groups['frontmatter'].Index + $match.Groups['frontmatter'].Length)
    [System.IO.File]::WriteAllText($path, $updated, $encoding)
  }
}

function Test-PerformanceSkills {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string[]]$SkillNames,
    [Parameter(Mandatory = $true)][switch]$AllowUntracked
  )

  $lockPath = Join-Path $RepositoryRoot "skills-lock.json"
  if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
    throw "skills-lock.json introuvable."
  }
  $lock = [System.IO.File]::ReadAllText($lockPath) | ConvertFrom-Json

  foreach ($skillName in $SkillNames) {
    $relativePath = ".agents/skills/$skillName/SKILL.md"
    $path = Join-Path $RepositoryRoot ($relativePath -replace '/', '\')
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Skill performance manquant : $relativePath"
    }
    if ($null -eq $lock.skills.PSObject.Properties[$skillName]) {
      throw "Skill non verrouillé dans skills-lock.json : $skillName"
    }
    if (-not $AllowUntracked) {
      git -C $RepositoryRoot ls-files --error-unmatch -- $relativePath | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Skill performance non suivi par Git : $relativePath"
      }
    }
  }
}

function Assert-LocalMcpPackages {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $requiredFiles = @(
    "node_modules\chrome-devtools-mcp\build\src\bin\chrome-devtools-mcp.js",
    "node_modules\@playwright\mcp\cli.js"
  )
  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $relativePath) -PathType Leaf)) {
      throw "Paquet MCP local manquant : $relativePath. Lance npm ci dans le worktree performance."
    }
  }
}

function Assert-ChromeVersion {
  $paths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  $chromePath = $paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if ($null -eq $chromePath) {
    throw "Chrome 149+ est requis pour l'allowlist URL du Performance Lab."
  }
  $version = [version](Get-Item -LiteralPath $chromePath).VersionInfo.ProductVersion
  if ($version.Major -lt 149) {
    throw "Chrome 149+ est requis pour l'allowlist URL. Version détectée : $version"
  }
}

function Set-OpenCodeMcp {
  param([Parameter(Mandatory = $true)][string]$ConfigPath)

  $changed = $false
  if (Test-Path -LiteralPath $ConfigPath) {
    $config = [System.IO.File]::ReadAllText($ConfigPath) | ConvertFrom-Json
  } else {
    $changed = $true
    $config = [pscustomobject]@{
      '$schema' = 'https://opencode.ai/config.json'
      instructions = @('AGENTS.md')
    }
  }

  if ($null -eq $config.PSObject.Properties['mcp']) {
    $changed = $true
    Set-ObjectProperty -Object $config -Name 'mcp' -Value ([pscustomobject]@{})
  }

  $desiredServers = @{
    'chrome-devtools' = [pscustomobject]@{
      type = 'local'
      command = @(
        'node',
        'node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js',
        '--headless',
        '--isolated',
        '--no-usage-statistics',
        '--redact-network-headers',
        '--no-performance-crux',
        '--no-javascript-evaluation',
        '--allowed-url-pattern=http://localhost:*/*',
        '--allowed-url-pattern=http://127.0.0.1:*/*'
      )
      environment = [pscustomobject]@{
        CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS = '1'
      }
      enabled = $true
      timeout = 120000
    }
    'playwright' = [pscustomobject]@{
      type = 'local'
      command = @(
        'node',
        'node_modules/@playwright/mcp/cli.js',
        '--browser=webkit',
        '--mobile',
        '--headless',
        '--isolated',
        '--no-webmcp',
        '--codegen=none',
        '--allowed-origins=http://localhost:*;http://127.0.0.1:*'
      )
      enabled = $true
      timeout = 120000
    }
  }

  foreach ($serverName in $desiredServers.Keys) {
    $desired = $desiredServers[$serverName]
    $existing = $config.mcp.PSObject.Properties[$serverName]
    if ($null -eq $existing) {
      $changed = $true
      Set-ObjectProperty -Object $config.mcp -Name $serverName -Value $desired
      continue
    }

    $desiredCommand = $desired.command | ConvertTo-Json -Compress
    $existingCommand = if ($null -ne $existing.Value.PSObject.Properties['command']) { $existing.Value.command | ConvertTo-Json -Compress } else { $null }
    $desiredEnvironment = if ($null -ne $desired.PSObject.Properties['environment']) { $desired.environment | ConvertTo-Json -Compress } else { $null }
    $existingEnvironment = if ($null -ne $existing.Value.PSObject.Properties['environment']) { $existing.Value.environment | ConvertTo-Json -Compress } else { $null }
    $conflict = $existing.Value.type -ne $desired.type -or $existingCommand -ne $desiredCommand -or $desiredEnvironment -ne $existingEnvironment -or $existing.Value.enabled -ne $desired.enabled -or $existing.Value.timeout -ne $desired.timeout
    if ($conflict) {
      throw "Configuration MCP conflictuelle pour $serverName. Résous le conflit manuellement avant l'installation."
    }
  }

  if ($null -eq $config.PSObject.Properties['tools']) {
    $changed = $true
    Set-ObjectProperty -Object $config -Name 'tools' -Value ([pscustomobject]@{})
  }
  foreach ($toolPattern in @('chrome-devtools_*', 'playwright_*')) {
    $existingTool = $config.tools.PSObject.Properties[$toolPattern]
    if ($null -eq $existingTool) {
      $changed = $true
      Set-ObjectProperty -Object $config.tools -Name $toolPattern -Value $false
    } elseif ($existingTool.Value -ne $false) {
      throw "Outils MCP globalement activés en conflit : $toolPattern"
    }
  }

  if ($changed) {
    $json = $config | ConvertTo-Json -Depth 20
    $encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($ConfigPath, $json + [Environment]::NewLine, $encoding)
  }
}

function Test-ModelAvailable {
  param(
    [Parameter(Mandatory = $true)][string]$ModelId,
    [Parameter(Mandatory = $true)][string]$ModelVariant
  )

  $parts = $ModelId.Split('/', 2)
  if ($parts.Count -ne 2) {
    throw "Model ID invalide : $ModelId"
  }
  $provider = $parts[0]
  $model = $parts[1]
  $fullId = "$provider/$model"
  $output = (& cmd.exe /d /s /c "opencode models $provider 2>nul" | Out-String)
  $modelIds = @($output -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '/' })
  if ($LASTEXITCODE -ne 0 -or $modelIds -notcontains $fullId) {
    throw "Modèle OpenCode introuvable : $ModelId"
  }

  $verboseOutput = (& cmd.exe /d /s /c "opencode models $provider --verbose 2>nul" | Out-String)
  $lines = @($verboseOutput -split "`r?`n")
  $start = -1
  $end = $lines.Count
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index].Trim() -ceq $fullId) {
      $start = $index + 1
      continue
    }
    if ($start -ge 0 -and $lines[$index].Trim() -match '^[^/\s]+/[^/\s]+$') {
      $end = $index
      break
    }
  }
  if ($start -lt 0) {
    throw "Métadonnées OpenCode introuvables pour : $ModelId"
  }
  $block = ($lines[$start..($end - 1)] -join "`n")
  if ($block -notmatch '"' + [regex]::Escape($ModelVariant) + '"\s*:') {
    throw "Variant OpenCode introuvable pour $ModelId : $ModelVariant"
  }
}

function Test-OpenCodeLabResolution {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string[]]$AgentNames,
    [Parameter(Mandatory = $true)][string[]]$CommandNames,
    [Parameter(Mandatory = $true)][string]$ModelId,
    [Parameter(Mandatory = $true)][string]$ModelVariant
  )

  $raw = (& cmd.exe /d /s /c "opencode debug config 2>nul" | Out-String)
  if ($LASTEXITCODE -ne 0) {
    throw "OpenCode n'a pas résolu la configuration."
  }
  $config = $raw | ConvertFrom-Json

  foreach ($agentName in $AgentNames) {
    $agentProperty = $config.agent.PSObject.Properties[$agentName]
    if ($null -eq $agentProperty -or $null -eq $agentProperty.Value.model) {
      throw "Agent non résolu : $agentName"
    }
    if ($agentProperty.Value.model -ne $ModelId -or $agentProperty.Value.variant -ne $ModelVariant) {
      throw "Modèle ou variant incorrect pour $agentName"
    }
  }

  foreach ($commandName in $CommandNames) {
    if ($null -eq $config.command.PSObject.Properties[$commandName]) {
      throw "Commande non résolue : $commandName"
    }
  }

  foreach ($serverName in @('chrome-devtools', 'playwright')) {
    if ($null -eq $config.mcp.PSObject.Properties[$serverName]) {
      throw "Serveur MCP non résolu : $serverName"
    }
  }
}

Write-Host "=== LKDV Space Bunny Performance Lab ==="

$repoRoot = (git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Lance ce script depuis un dépôt Git LKDV."
}

if ($Model.Contains("#")) {
  $modelParts = $Model.Split("#", 2)
  $Model = $modelParts[0]
  if (-not $PSBoundParameters.ContainsKey("Variant")) {
    $Variant = $modelParts[1]
  }
}

if ($Model -notmatch '^[A-Za-z0-9._/-]+$' -or $Variant -notmatch '^[A-Za-z0-9._-]+$') {
  throw "Model ou Variant invalide."
}
Test-ModelAvailable -ModelId $Model -ModelVariant $Variant

$branch = (git -C $repoRoot branch --show-current).Trim()
$changes = @(git -C $repoRoot status --porcelain)
$unsafeWorkspace = -not $branch.StartsWith("perf/") -or $changes.Count -gt 0
if ($unsafeWorkspace -and -not $AllowDirtyBootstrap) {
  throw "Installation refusée : le Performance Lab exige une branche perf/* et un worktree propre. Utilise -AllowDirtyBootstrap uniquement pour le premier bootstrap, puis valide les fichiers avant de créer le worktree."
}
if ($unsafeWorkspace) {
  Write-Warning "Bootstrap sur $branch avec $($changes.Count) changement(s). N'exécute aucun agent de performance dans cet état."
}

if (-not $SkipValidation) {
  npm run type-check
  if ($LASTEXITCODE -ne 0) {
    throw "Le type-check du projet échoue."
  }
  npm run lint
  if ($LASTEXITCODE -ne 0) {
    throw "Le lint du projet échoue."
  }
}

$packRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$destinationRoots = @(
  ".opencode\agents",
  ".opencode\commands",
  ".opencode\skills\lkdv-performance-method",
  "docs\performance",
  "scripts\perf"
)
foreach ($relativeRoot in $destinationRoots) {
  $destinationRoot = Join-Path $repoRoot $relativeRoot
  Assert-ContainedPath -RepositoryRoot $repoRoot -Path $destinationRoot
  Assert-NoReparsePoint -Path $destinationRoot
  if (-not (Test-Path -LiteralPath $destinationRoot)) {
    New-Item -ItemType Directory -Path $destinationRoot | Out-Null
  }
}

foreach ($fileName in $ownedAgentFiles) {
  Copy-PerformanceLabFile `
    -Source (Join-Path $packRoot ".opencode\agents\$fileName") `
    -Destination (Join-Path $repoRoot ".opencode\agents\$fileName")
}
foreach ($fileName in $ownedCommandFiles) {
  Copy-PerformanceLabFile `
    -Source (Join-Path $packRoot ".opencode\commands\$fileName") `
    -Destination (Join-Path $repoRoot ".opencode\commands\$fileName")
}
foreach ($fileName in $ownedSkillFiles) {
  Copy-PerformanceLabFile `
    -Source (Join-Path $packRoot ".opencode\skills\lkdv-performance-method\$fileName") `
    -Destination (Join-Path $repoRoot ".opencode\skills\lkdv-performance-method\$fileName")
}
foreach ($fileName in $ownedDocumentFiles) {
  Copy-PerformanceLabFile `
    -Source (Join-Path $packRoot "docs\performance\$fileName") `
    -Destination (Join-Path $repoRoot "docs\performance\$fileName")
}
Copy-PerformanceLabFile `
  -Source (Join-Path $packRoot "scripts\perf\assert-lab-workspace.ps1") `
  -Destination (Join-Path $repoRoot "scripts\perf\assert-lab-workspace.ps1")

if (-not $SkipSkills) {
  Write-Host "Validation des skills performance suivis par Git..."
  Test-PerformanceSkills -RepositoryRoot $repoRoot -SkillNames $requiredSkills -AllowUntracked:$AllowUntrackedSkills
}

if (-not $SkipMcp) {
  Write-Host "Validation des paquets MCP locaux verrouillés..."
  Assert-LocalMcpPackages -RepositoryRoot $repoRoot
  Assert-ChromeVersion
  Set-OpenCodeMcp -ConfigPath (Join-Path $repoRoot "opencode.json")
}

Set-PerformanceAgentMetadata `
  -RepositoryRoot $repoRoot `
  -AgentFiles $ownedAgentFiles `
  -ModelId $Model `
  -ModelVariant $Variant

if (-not $SkipValidation) {
  Write-Host "Validation OpenCode..."
  Test-OpenCodeLabResolution `
    -RepositoryRoot $repoRoot `
    -AgentNames $ownedAgentFiles.ForEach({ [System.IO.Path]::GetFileNameWithoutExtension($_) }) `
    -CommandNames $ownedCommandFiles.ForEach({ [System.IO.Path]::GetFileNameWithoutExtension($_) }) `
    -ModelId $Model `
    -ModelVariant $Variant

  if (-not $SkipMcp) {
    $mcpOutput = (& cmd.exe /d /s /c "opencode mcp list 2>nul" | Out-String)
    if ($LASTEXITCODE -ne 0 -or $mcpOutput -notmatch 'chrome-devtools' -or $mcpOutput -notmatch 'playwright') {
      throw "La validation MCP a échoué."
    }
  }
}

Write-Host ""
if ($SkipValidation) {
  Write-Host "Installation terminée. Validation applicative ignorée (-SkipValidation)."
} else {
  Write-Host "Installation validée."
}
Write-Host "1. Quitte puis relance OpenCode."
Write-Host "2. Ouvre uniquement le worktree perf/space-bunny-lab propre."
Write-Host "3. Exécute /perf-baseline."
Write-Host "4. Lance /perf-day puis stage et commit hors du lab après revue."
