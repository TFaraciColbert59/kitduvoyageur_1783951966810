# ==============================================================================
# A14 — Test réel de sauvegarde / restauration / rollback (base locale UNIQUEMENT).
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File scripts/ops/a14_backup_restore_test.ps1
#   ... -SkipFlagRollback                      # saute le test de rollback flags
#   ... -EvidencePath <chemin.json>            # écrit la preuve JSON (sans PII)
#
# Ce script ne touche JAMAIS une base distante :
#   - il opère exclusivement via `docker exec` dans le conteneur Supabase local ;
#   - il refuse un conteneur inconnu ;
#   - la base jetable s'appelle obligatoirement a14_* et est supprimée en fin de test.
#
# Séquence :
#   1. pg_dump complet (schéma + données) de la base locale ;
#   2. création d'une base jetable a14_restore_test ;
#   3. pg_restore complet (zéro erreur attendue) ;
#   4. vérifications de comptages (tables, policies, fonctions, lignes clés) ;
#   5. suppression de la base jetable et du dump ;
#   6. rollback flags : UPDATE feature_flags (via test d'intégration local, 503/skip)
#      puis vérification que TOUS les flags sont OFF à la fin.
#
# Sortie : exit 0 si tout est vérifié, 1 sinon. Preuve imprimée en JSON.
# ==============================================================================
[CmdletBinding()]
param(
  [string]$Container = 'supabase_db_ai-finalization',
  [string]$SourceDb = 'postgres',
  [string]$RestoreDb = 'a14_restore_test',
  [string]$DumpContainerPath = '/tmp/a14_backup_restore.dump',
  [string]$EvidencePath = '',
  [switch]$SkipFlagRollback
)

$ErrorActionPreference = 'Continue'
$script:Failures = @()

function Write-Step([string]$Message) {
  Write-Output "==> $Message"
}

function Fail([string]$Message) {
  Write-Output "ECHEC : $Message"
  $script:Failures += $Message
}

function Invoke-Docker([string[]]$DockerArgs, [switch]$AllowFailure) {
  $output = & docker @DockerArgs 2>&1 | Out-String
  $code = $LASTEXITCODE
  if (-not $AllowFailure -and $code -ne 0) {
    throw "docker $($DockerArgs -join ' ') a echoue (code $code): $output"
  }
  return @{ Output = $output; Code = $code }
}

function Invoke-Psql([string]$Db, [string]$Sql, [switch]$AsPostgres) {
  $user = if ($AsPostgres) { 'postgres' } else { 'supabase_admin' }
  $result = Invoke-Docker @('exec', $Container, 'psql', '-U', $user, '-d', $Db, '-v', 'ON_ERROR_STOP=1', '-Atc', $Sql)
  return $result.Output.Trim()
}

# ── 0. Garde-fous ────────────────────────────────────────────────────────────
if ($RestoreDb -notmatch '^a14_[a-z0-9_]+$') {
  Fail "nom de base jetable refuse : '$RestoreDb' (doit matcher ^a14_[a-z0-9_]+$)"
  exit 1
}

$containerStatus = (Invoke-Docker @('inspect', $Container, '--format', '{{.State.Status}}')).Output.Trim()
if ($containerStatus -ne 'running') {
  Fail "conteneur local '$Container' non demarre (statut: $containerStatus)"
  exit 1
}
Write-Step "conteneur local verifie : $Container ($containerStatus)"

if ($SourceDb -ne 'postgres') {
  Fail "base source inattendue '$SourceDb' — ce test est reserve a la base locale postgres"
  exit 1
}

# Nettoyage defensif d'un reliquat de test precedent.
Invoke-Psql 'postgres' "DROP DATABASE IF EXISTS $RestoreDb" | Out-Null
Invoke-Docker @('exec', $Container, 'rm', '-f', $DumpContainerPath) | Out-Null

# ── 1. Dump complet (schema + donnees) ───────────────────────────────────────
Write-Step "pg_dump complet de $SourceDb (schema + donnees)"
$dumpWatch = [System.Diagnostics.Stopwatch]::StartNew()
Invoke-Docker @('exec', $Container, 'pg_dump', '-U', 'supabase_admin', '-d', $SourceDb, '-Fc', '--no-owner', '--no-privileges', '-f', $DumpContainerPath) | Out-Null
$dumpWatch.Stop()
$dumpEndedAt = Get-Date
$dumpBytes = [int64]((Invoke-Docker @('exec', $Container, 'stat', '-c', '%s', $DumpContainerPath)).Output.Trim())
if ($dumpBytes -le 0) { Fail 'dump vide ou introuvable' } else { Write-Step "dump produit : $dumpBytes octets en $($dumpWatch.ElapsedMilliseconds) ms" }

# ── 2. Base jetable ──────────────────────────────────────────────────────────
Write-Step "creation de la base jetable $RestoreDb"
Invoke-Psql 'postgres' "CREATE DATABASE $RestoreDb" | Out-Null

$restoreStartedAt = Get-Date
$restoreWatch = [System.Diagnostics.Stopwatch]::StartNew()

# ── 3. Restauration complete ────────────────────────────────────────────────
Write-Step "pg_restore complet vers $RestoreDb"
$restore = Invoke-Docker @('exec', $Container, 'pg_restore', '-U', 'supabase_admin', '-d', $RestoreDb, '--no-owner', '--no-privileges', $DumpContainerPath) -AllowFailure
$errorLines = @(($restore.Output -split "`n") | Where-Object { $_ -match 'error:' })
if ($restore.Code -ne 0 -or $errorLines.Count -gt 0) {
  Fail "pg_restore: code=$($restore.Code), erreurs=$($errorLines.Count) (premieres: $(($errorLines | Select-Object -First 3) -join ' | '))"
} else {
  Write-Step 'restauration complete : 0 erreur'
}

# ── 4. Verifications de comptages (source vs restauree) ─────────────────────
$scalarQueries = [ordered]@{
  public_tables = "SELECT count(*) FROM pg_tables WHERE schemaname='public'";
  public_policies = "SELECT count(*) FROM pg_policies WHERE schemaname='public'";
  public_functions = "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'";
  auth_tables = "SELECT count(*) FROM pg_tables WHERE schemaname='auth'";
  feature_flags = "SELECT count(*) FROM public.feature_flags";
  adventure_engine_runs = "SELECT count(*) FROM public.adventure_engine_runs";
  adventure_plans = "SELECT count(*) FROM public.adventure_plans";
  user_profiles = "SELECT count(*) FROM public.user_profiles";
  terrain_reports = "SELECT count(*) FROM public.terrain_reports";
  hike_sessions = "SELECT count(*) FROM public.hike_sessions";
}
$verification = [ordered]@{}
foreach ($key in $scalarQueries.Keys) {
  $sourceValue = Invoke-Psql $SourceDb $scalarQueries[$key]
  $restoreValue = Invoke-Psql $RestoreDb $scalarQueries[$key]
  $verification[$key] = [ordered]@{ source = $sourceValue; restore = $restoreValue; equal = ($sourceValue -eq $restoreValue) }
  if ($sourceValue -ne $restoreValue) {
    Fail "comptage '$key' divergent : source=$sourceValue restaure=$restoreValue"
  }
}
if ($script:Failures.Count -eq 0) { Write-Step 'comptages source/restauration identiques (tables, policies, fonctions, lignes cles)' }

$restoreWatch.Stop()

# ── 5. Suppression de la base jetable ───────────────────────────────────────
Write-Step "suppression de la base jetable $RestoreDb"
Invoke-Psql 'postgres' "DROP DATABASE IF EXISTS $RestoreDb" | Out-Null
Invoke-Docker @('exec', $Container, 'rm', '-f', $DumpContainerPath) | Out-Null
$restoreDbGone = (Invoke-Psql 'postgres' "SELECT count(*) FROM pg_database WHERE datname = '$RestoreDb'")
if ($restoreDbGone -ne '0') { Fail "base jetable $RestoreDb toujours presente" } else { Write-Step 'base jetable supprimee' }

# ── 6. Rollback flags (test d'integration local reel : 503/skip) ────────────
$flagRollback = [ordered]@{ executed = $false; exitCode = $null; flagsOffAtEnd = $null }
if (-not $SkipFlagRollback) {
  Write-Step 'rollback flags : test d''integration local (terrain_live OFF => 503, ON => pass-through, OFF => 503)'
  $statusRaw = (& supabase status -o json 2>$null | Out-String)
  $startIndex = $statusRaw.IndexOf('{')
  $endIndex = $statusRaw.LastIndexOf('}')
  if ($startIndex -lt 0 -or $endIndex -le $startIndex) {
    Fail 'supabase status -o json illisible — impossible de recuperer les cles locales'
  } else {
    $localStatus = ($statusRaw.Substring($startIndex, $endIndex - $startIndex + 1) | ConvertFrom-Json)
    $env:A14_LOCAL_API_URL = $localStatus.API_URL
    $env:A14_LOCAL_SERVICE_ROLE_KEY = $localStatus.SERVICE_ROLE_KEY
    $env:A14_LOCAL_INTEGRATION = '1'
    & npx vitest run tests/ops/a14-flag-rollback.integration.spec.ts 2>&1 | Out-String | Write-Output
    $flagRollback.executed = $true
    $flagRollback.exitCode = $LASTEXITCODE
    if ($LASTEXITCODE -ne 0) { Fail "test de rollback flags en echec (code $LASTEXITCODE)" }
  }
}

# Verification finale : tous les flags OFF par defaut (ADR-AI-008).
$enabledFlags = Invoke-Psql $SourceDb "SELECT coalesce(string_agg(id, ','), '') FROM public.feature_flags WHERE enabled = true"
$flagRollback.flagsOffAtEnd = ($enabledFlags -eq '')
if ($enabledFlags -ne '') { Fail "flags encore actifs apres test : $enabledFlags" } else { Write-Step 'tous les flags sont OFF (etat par defaut restaure)' }

# ── Preuve JSON (aucune donnee personnelle) ─────────────────────────────────
$evidence = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  container = $Container
  sourceDb = $SourceDb
  restoreDb = $RestoreDb
  dump = [ordered]@{ bytes = $dumpBytes; durationMs = $dumpWatch.ElapsedMilliseconds }
  restore = [ordered]@{ durationMs = $restoreWatch.ElapsedMilliseconds; errors = $errorLines.Count; exitCode = $restore.Code }
  rpo = [ordered]@{
    measuredSeconds = [Math]::Round(($restoreStartedAt - $dumpEndedAt).TotalSeconds, 3)
    note = 'Fenetre de perte potentielle entre fin de dump et debut de restauration (ici quasi nulle, base au repos).'
    policyTargetHours = 24
  }
  rto = [ordered]@{
    measuredSeconds = [Math]::Round($restoreWatch.ElapsedMilliseconds / 1000.0, 3)
    note = 'Creation base jetable + pg_restore complet + verifications.'
    policyTargetMinutes = 60
  }
  verification = $verification
  flagRollback = $flagRollback
  failures = @($script:Failures)
  ok = ($script:Failures.Count -eq 0)
}
$evidenceJson = ($evidence | ConvertTo-Json -Depth 6)
Write-Output "A14_BACKUP_RESULT $evidenceJson"
if ($EvidencePath -ne '') {
  $evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8
  Write-Output "preuve ecrite : $EvidencePath"
}

if ($script:Failures.Count -gt 0) {
  Write-Output "RESULTAT : ECHEC ($($script:Failures.Count) probleme(s))"
  exit 1
}
Write-Output 'RESULTAT : SUCCES (sauvegarde restauree, base jetable supprimee, flags OFF)'
exit 0
