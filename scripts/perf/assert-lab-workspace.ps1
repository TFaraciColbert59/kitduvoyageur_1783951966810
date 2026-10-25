param(
  [switch]$RequireClean,
  [string[]]$ExpectedPaths = @()
)

$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Impossible de résoudre la racine Git."
}

$branch = (git -C $repoRoot branch --show-current).Trim()
if (-not $branch.StartsWith("perf/")) {
  throw "Branche interdit pour le Performance Lab : $branch. Attendu : perf/*."
}

if ($RequireClean -and $ExpectedPaths.Count -gt 0) {
  throw "Utilise soit -RequireClean, soit -ExpectedPaths, pas les deux."
}

$changes = @(git -C $repoRoot status --porcelain)
if ($RequireClean -and $changes.Count -gt 0) {
  $changes | ForEach-Object { Write-Host $_ }
  throw "Le worktree performance doit être propre avant de démarrer."
}

if ($ExpectedPaths.Count -gt 0) {
  $normalizedExpected = @($ExpectedPaths | ForEach-Object { $_.Replace('\', '/').Trim('/') })
  foreach ($change in $changes) {
    if ($change.Length -lt 4) {
      continue
    }
    $path = $change.Substring(3).Trim().Trim('"')
    if ($path.Contains(' -> ')) {
      $path = $path.Split(' -> ')[-1]
    }
    $normalizedPath = $path.Replace('\', '/').Trim('/')
    $allowed = @($normalizedExpected | Where-Object {
      $normalizedPath -eq $_ -or $normalizedPath.StartsWith($_ + '/', [System.StringComparison]::OrdinalIgnoreCase)
    })
    if ($allowed.Count -eq 0) {
      throw "Fichier hors manifeste d'expérience : $normalizedPath"
    }
  }
}

Write-Host "Performance Lab workspace OK: $branch ($repoRoot)"
