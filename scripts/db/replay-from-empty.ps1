# A10 — Replay de la chaîne de migrations sur base vide (local Supabase).
#
# Contexte : la chaîne historique (160+ migrations) n'est pas linéaire — drift
# production (colonnes/tables absentes du dépôt), réordonnancements, policies
# non idempotentes. Le replay certifié se fait donc en deux passes :
#   Passe A (tolérante)  : applique tous les fichiers, note les échecs.
#   Passe B (alignement) : ajoute les colonnes prod manquantes (gardées).
#   Passe C (stricte)    : réapplique uniquement les fichiers en échec.
# Sortie : liste des fichiers encore en échec (exit 1 si non vide).
#
# Usage : pwsh scripts/db/replay-from-empty.ps1
# Prérequis : Docker Desktop opérationnel ; première exécution ~3-5 minutes.

param(
  [string]$Container = 'supabase_db_ai-finalization',
  [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot/../..").Path
)

$ErrorActionPreference = 'Continue'
Set-Location $ProjectRoot

function Invoke-SqlFile([string]$Path, [bool]$Strict) {
  $flag = if ($Strict) { '-v ON_ERROR_STOP=1' } else { '' }
  cmd /c "docker exec -i $Container psql -U postgres -d postgres -q $flag -f - < `"$Path`"" 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

Write-Output "[replay] Reset schema public..."
cmd /c "docker exec -i $Container psql -U postgres -d postgres -q -c `"DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`"" 2>&1 | Out-Null

$files = Get-ChildItem "supabase/migrations/*.sql" | Sort-Object Name
Write-Output "[replay] Passe A (tolérante) : $($files.Count) fichiers"
$failed = @()
foreach ($f in $files) {
  if (-not (Invoke-SqlFile $f.FullName $false)) { $failed += $f }
}

Write-Output "[replay] Passe B (alignement prod→replay)"
Invoke-SqlFile (Join-Path $ProjectRoot 'supabase/replay/a10_replay_alignment.sql') $false | Out-Null

Write-Output "[replay] Passe C (stricte) sur $($failed.Count) fichier(s) en échec"
$stillFailed = @()
foreach ($f in $failed) {
  if (-not (Invoke-SqlFile $f.FullName $true)) { $stillFailed += $f.Name }
}

if ($stillFailed.Count -eq 0) {
  Write-Output "[replay] SUCCÈS : chaîne complète appliquée (2 passes + alignement)."
  exit 0
} else {
  Write-Output "[replay] ÉCHECS RESTANTS ($($stillFailed.Count)) :"
  $stillFailed | ForEach-Object { Write-Output "  - $_" }
  exit 1
}
