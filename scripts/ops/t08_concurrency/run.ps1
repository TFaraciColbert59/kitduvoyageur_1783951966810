# T08 — Preuve de concurrence réelle sur la base locale Docker.
# Usage : powershell -File scripts/ops/t08_concurrency/run.ps1 [-Container supabase_db_ai-finalization]
# Résultat attendu : winners=1, refused_by_quota=1, race_transactions=1.
# LOCAL uniquement : jamais contre la production liée.
param([string]$Container = 'supabase_db_ai-finalization')

$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot '.'
$remote = '/tmp/t08_concurrency'

docker exec $Container mkdir -p $remote | Out-Null
foreach ($file in @('00_setup.sql', '10_session_a.sql', '20_session_b.sql', '90_verify.sql', '99_cleanup.sql')) {
  docker cp (Join-Path $dir $file) "${Container}:${remote}/${file}" | Out-Null
}

function Invoke-Sql([string]$file) {
  docker exec $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$remote/$file" 2>&1
}

Write-Host '--- préparation ---'
Invoke-Sql '00_setup.sql'

Write-Host '--- course : A (transaction 3 s) vs B (démarre 500 ms plus tard) ---'
$jobA = Start-Job -ScriptBlock {
  param($c, $f)
  docker exec $c psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f $f 2>&1
} -ArgumentList $Container, "$remote/10_session_a.sql"

Start-Sleep -Milliseconds 500
$outB = Invoke-Sql '20_session_b.sql'
$outA = Receive-Job -Job $jobA -Wait
Remove-Job -Job $jobA

Write-Host '--- sortie A ---'; $outA | ForEach-Object { Write-Host $_ }
Write-Host '--- sortie B ---'; $outB | ForEach-Object { Write-Host $_ }

Write-Host '--- vérification ---'
$verify = (Invoke-Sql '90_verify.sql') -join "`n"
Write-Host $verify

$winners = [regex]::Match($verify, '(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)').Groups
if ($winners.Count -ne 4) { throw 'Sortie de vérification illisible.' }
$w = [int]$winners[1].Value; $r = [int]$winners[2].Value; $t = [int]$winners[3].Value
if ($w -ne 1 -or $r -ne 1 -or $t -ne 1) {
  throw "Concurrence non conforme : winners=$w refused=$r transactions=$t (attendu 1/1/1)"
}
Write-Host 'PASS — un seul gagnant, un refus quota, une seule transaction.'

Write-Host '--- nettoyage ---'
Invoke-Sql '99_cleanup.sql'
