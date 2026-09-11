# A10 — Installation / mise à niveau certifiée depuis la baseline de production.
#
# Stratégie officielle (ruling Étape 0, revue indépendante) : BASELINE + migrations
# post-baseline. Le dépôt ne prétend PAS reconstruire l'historique 100 % depuis un
# PostgreSQL vide (dérive prod documentée) ; il certifie :
#   install : PostgreSQL vide → baseline schema-only → 29 migrations post-baseline
#             → pgTAP → F1 → EXPLAIN   (installation neuve)
#   upgrade : baseline (= snapshot historique au cutoff 20260911120000)
#             → ledger initialisé avec les 143 versions prod appliquées
#             → uniquement les migrations postérieures → pgTAP → F1 → EXPLAIN
#
# Toutes les phases certifiantes utilisent psql -X -v ON_ERROR_STOP=1 : aucune
# erreur SQL n'est tolérée.
#
# Usage : pwsh scripts/db/install-from-baseline.ps1 -Mode install|upgrade
# Prérequis : Docker Desktop + stack Supabase locale démarrée.

param(
  [ValidateSet('install', 'upgrade')] [string]$Mode = 'install',
  [string]$Container = 'supabase_db_ai-finalization',
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

$ledger = @(Get-Content (Join-Path $ProjectRoot 'supabase/baseline/applied_migrations.txt') | Where-Object { $_.Trim() })
$postBaseline = @(Get-ChildItem "supabase/migrations/*.sql" | Sort-Object Name | Where-Object {
  $v = ($_.BaseName -split '_')[0]; $ledger -notcontains $v
})

if ($Mode -eq 'upgrade') {
  Write-Output "[certify] Ledger initialisé ($($ledger.Count) versions prod appliquées)"
  $inserts = ($ledger | ForEach-Object { "INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('$_') ON CONFLICT DO NOTHING;" }) -join "`n"
  $ledgerSql = "CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, name text, statements text[]);`n$inserts`n"
  $ledgerSql | Set-Content -Encoding UTF8 "$env:TEMP\a10_ledger.sql"
  Invoke-Strict "$env:TEMP\a10_ledger.sql" "ledger prod (143 versions)" | Out-Null
}

Write-Output "[certify] Migrations post-baseline : $($postBaseline.Count) fichiers (strictes)"
foreach ($f in $postBaseline) { Invoke-Strict $f.FullName "migration $($f.Name)" | Out-Null }

Write-Output "[certify] pgTAP"
cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -c `"CREATE EXTENSION IF NOT EXISTS pgtap;`"" 2>&1 | Out-Null
$testFiles = Get-ChildItem "supabase/tests/database/*.test.sql" | Sort-Object Name
foreach ($t in $testFiles) { Invoke-Strict $t.FullName "pgTAP $($t.Name)" | Out-Null }

Write-Output "[certify] F1 — policies larges sur user_profiles"
cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c `"DO `$`$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname IN ('public_read_user_profiles','anon_read_profiles_basic','Public read user_profiles'); IF n <> 0 THEN RAISE EXCEPTION 'F1: % policy(ies) large(s) restante(s)', n; END IF; IF to_regclass('public.public_profiles') IS NULL THEN RAISE EXCEPTION 'F1: vue public_profiles absente'; END IF; END `$`$;`"" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Output "  [FAIL] F1"; $failures += 'F1' } else { Write-Output "  [ok]   F1 (0 policy large, vue présente)" }

Write-Output "[certify] EXPLAIN proximité (base de validation)"
cmd /c "docker exec -i $Container psql -X -U postgres -d postgres -q -c `"EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.a5_terrain_reports_near(44.0, 6.0, 5000)`"" 2>&1 | Select-String -Pattern 'Execution Time|Function Scan' | ForEach-Object { Write-Output "  $_" }

if ($failures.Count -eq 0) {
  Write-Output "[certify] SUCCÈS — mode $Mode certifié (0 échec)."
  exit 0
}
Write-Output "[certify] ÉCHECS ($($failures.Count)) :"
$failures | ForEach-Object { Write-Output "  - $_" }
exit 1
