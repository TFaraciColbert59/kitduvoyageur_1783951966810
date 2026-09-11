# A10 — Installation / mise à niveau certifiée depuis la baseline de production.
#
# Stratégie officielle (ruling Étape 0) : BASELINE (schema-only au cutoff
# 20260911120000) + migrations post-baseline, tout en strict (ON_ERROR_STOP=1).
#
#   install : PostgreSQL vide → baseline (+auth, +grants) → ledger 143 →
#             migrations post-baseline strictes → TAP runner → F1 → EXPLAIN
#   upgrade : identique avec ledger initialisé AVANT les migrations (simule la
#             mise à niveau d'une base historique au cutoff)
#
# Exigences verrouillées :
#   • chaque migration appliquée est inscrite dans
#     supabase_migrations.schema_migrations (jamais « en attente » à la fin) ;
#   • les suites pgTAP passent par un VRAI runner TAP (`supabase test db`) ;
#   • F1 et EXPLAIN (ANALYZE, BUFFERS) sont bloquants.
#
# Usage : pwsh scripts/db/install-from-baseline.ps1 -Mode install|upgrade

param(
  [ValidateSet('install', 'upgrade')] [string]$Mode = 'install',
  [string]$Container = 'supabase_db_ai-finalization',
  [string]$LocalUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  [int]$ExplainMaxMs = 500,
  [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot/../..").Path
)

$ErrorActionPreference = 'Continue'
Set-Location $ProjectRoot
$failures = @()

function Invoke-Strict([string]$Path, [string]$Label) {
  cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f - < `"$Path`"" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Output "  [FAIL] $Label"; $script:failures += $Label; return $false }
  Write-Output "  [ok]   $Label"
  return $true
}

function Record-Ledger([string]$Version) {
  cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c `"INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('$Version') ON CONFLICT DO NOTHING;`"" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Output "  [FAIL] ledger $Version"; $script:failures += "ledger $Version" }
}

Write-Output "[certify] Mode=$Mode — reset du schéma public"
@"
DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
"@ | Set-Content -Encoding UTF8 "$env:TEMP\a10_reset.sql"
Invoke-Strict "$env:TEMP\a10_reset.sql" 'reset schema public' | Out-Null

Write-Output "[certify] Préambule extensions (PostGIS, pg_trgm, unaccent)"
@"
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
"@ | Set-Content -Encoding UTF8 "$env:TEMP\a10_prelude.sql"
Invoke-Strict "$env:TEMP\a10_prelude.sql" 'préambule extensions' | Out-Null

Write-Output "[certify] Baseline schema-only (production au cutoff 20260911120000)"
Invoke-Strict (Join-Path $ProjectRoot 'supabase/baseline/prod_schema_20260911.sql') 'baseline prod_schema_20260911.sql' | Out-Null

Write-Output "[certify] Intégration auth (trigger auth.users absent du dump public)"
Invoke-Strict (Join-Path $ProjectRoot 'supabase/baseline/auth_integration.sql') 'auth_integration.sql' | Out-Null

Write-Output "[certify] Privilèges Supabase (GRANTs absents du dump) + default privileges"
Invoke-Strict (Join-Path $ProjectRoot 'supabase/baseline/grants.sql') 'grants.sql' | Out-Null

# Ledger : la baseline représente les 143 migrations de production déjà intégrées.
$ledger = @(Get-Content (Join-Path $ProjectRoot 'supabase/baseline/applied_migrations.txt') | Where-Object { $_.Trim() })
Write-Output "[certify] Ledger : $($ledger.Count) versions prod inscrites (baseline intégrée)"
@"
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, name text, statements text[]);
"@ | Set-Content -Encoding UTF8 "$env:TEMP\a10_ledger.sql"
Invoke-Strict "$env:TEMP\a10_ledger.sql" 'ledger schema' | Out-Null
$inserts = ($ledger | ForEach-Object { "INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('$_') ON CONFLICT DO NOTHING;" }) -join "`n"
$inserts | Set-Content -Encoding UTF8 "$env:TEMP\a10_ledger_values.sql"
Invoke-Strict "$env:TEMP\a10_ledger_values.sql" "ledger $($ledger.Count) versions prod" | Out-Null

$postBaseline = @(Get-ChildItem "supabase/migrations/*.sql" | Sort-Object Name | Where-Object {
  $v = ($_.BaseName -split '_')[0]; $ledger -notcontains $v
})

Write-Output "[certify] Migrations post-baseline : $($postBaseline.Count) fichiers (strictes, ledger inscrit après succès)"
foreach ($f in $postBaseline) {
  $version = ($f.BaseName -split '_')[0]
  if (Invoke-Strict $f.FullName "migration $($f.Name)") { Record-Ledger $version }
}

# Zéro migration en attente : tout fichier post-baseline doit être au ledger.
$pending = $postBaseline | Where-Object { $ledger -notcontains ($_.BaseName -split '_')[0] } | ForEach-Object { $_.Name }
$recorded = cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -t -A -c `"SELECT version FROM supabase_migrations.schema_migrations`"" 2>$null
$recordedSet = @($recorded | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$notRecorded = $postBaseline | Where-Object { $recordedSet -notcontains ($_.BaseName -split '_')[0] } | ForEach-Object { $_.Name }
if ($notRecorded.Count -gt 0) {
  Write-Output "  [FAIL] migrations non inscrites au ledger : $($notRecorded -join ', ')"
  $failures += 'ledger pending'
} else {
  Write-Output "  [ok]   ledger complet ($($recordedSet.Count) versions, 0 en attente)"
}

Write-Output "[certify] pgTAP — runner TAP réel (supabase test db)"
cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -c `"CREATE EXTENSION IF NOT EXISTS pgtap;`"" 2>&1 | Out-Null
$tapOut = cmd /c "npx supabase test db --db-url `"$LocalUrl`"" 2>&1
$tapText = ($tapOut | Out-String)
$notOk = ([regex]::Matches($tapText, '(?m)^\s*not ok')).Count
$resultLine = ($tapText -split "`n" | Where-Object { $_ -match '^Result:' } | Select-Object -Last 1)
if ($LASTEXITCODE -ne 0 -or $notOk -gt 0) {
  Write-Output "  [FAIL] pgTAP ($notOk assertion(s) rouge(s)) — $($resultLine.Trim())"
  $failures += 'pgTAP'
} else {
  Write-Output "  [ok]   pgTAP ($($resultLine.Trim()))"
}

Write-Output "[certify] F1 — policies larges sur user_profiles (bloquant)"
cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c `"DO `$`$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname IN ('public_read_user_profiles','anon_read_profiles_basic','Public read user_profiles'); IF n <> 0 THEN RAISE EXCEPTION 'F1: % policy(ies) large(s) restante(s)', n; END IF; IF to_regclass('public.public_profiles') IS NULL THEN RAISE EXCEPTION 'F1: vue public_profiles absente'; END IF; END `$`$;`"" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Output "  [FAIL] F1"; $failures += 'F1' } else { Write-Output "  [ok]   F1 (0 policy large, vue présente)" }

Write-Output "[certify] EXPLAIN (ANALYZE, BUFFERS) proximité — bloquant < $ExplainMaxMs ms"
$explainOut = cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -c `"EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.a5_terrain_reports_near(44.0, 6.0, 5000)`"" 2>&1
$explainText = ($explainOut | Out-String)
$execMs = $null
if ($explainText -match 'Execution Time:\s*([0-9.]+)\s*ms') { $execMs = [double]$Matches[1] }
if (-not $explainText.Contains('a5_terrain_reports_near') -or $null -eq $execMs -or $execMs -gt $ExplainMaxMs) {
  Write-Output "  [FAIL] EXPLAIN (execution=$execMs ms, max=$ExplainMaxMs ms)"
  $failures += 'EXPLAIN'
} else {
  Write-Output "  [ok]   EXPLAIN $execMs ms (plan RPC présent)"
}

if ($failures.Count -eq 0) {
  Write-Output "[certify] SUCCÈS — mode $Mode certifié (0 échec, 0 migration en attente)."
  exit 0
}
Write-Output "[certify] ÉCHECS ($($failures.Count)) :"
$failures | ForEach-Object { Write-Output "  - $_" }
exit 1
