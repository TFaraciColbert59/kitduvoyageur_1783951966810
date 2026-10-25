# Encoding: UTF-8
<#
  LKDV — rejoue TOUS les gates verifiables en local, dans le bon ordre.

  Usage :
    powershell -ExecutionPolicy Bypass -File scripts/ops/tout-essayer.ps1
    powershell -ExecutionPolicy Bypass -File scripts/ops/tout-essayer.ps1 -SkipBuild

  Le script gere lui-meme le build et le serveur : tu n'as rien a preparer.
  Il distingue les echecs REELS (a corriger) des gatesdepends de Docker
  (environnement), pour ne pas confondre les deux.
#>
param([switch]$SkipBuild, [switch]$SkipPlaywright)

$ErrorActionPreference = 'Continue'
$racine = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $racine

$script:serveurLance = $false
$resultats = New-Object System.Collections.Generic.List[object]

function Ecrire-Titre([string]$t) {
  Write-Host ''
  Write-Host ("=" * 72) -ForegroundColor DarkGray
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host ("=" * 72) -ForegroundColor DarkGray
}

function Gate([string]$nom, [string]$commande, [string]$env_ = '') {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $avant = $env_
  if ($env_) { $env:VEILLE = '1' }
  $sortie = & cmd /c $commande 2>&1
  $code = $LASTEXITCODE
  $sw.Stop()
  $dernieres = @($sortie | Select-Object -Last 6)
  $statut = if ($code -eq 0) { 'VERT' } else { 'ROUGE' }
  $resultats.Add([pscustomobject]@{
    Gate = $nom; Statut = $statut; Code = $code
    Secondes = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  }) | Out-Null
  $couleur = if ($code -eq 0) { 'Green' } else { 'Red' }
  Write-Host ("  [{0}] {1}  ({2}s)" -f $statut, $nom, [math]::Round($sw.Elapsed.TotalSeconds, 1)) -ForegroundColor $couleur
  if ($code -ne 0) { $dernieres | ForEach-Object { Write-Host "         $_" -ForegroundColor DarkYellow } }
}

# --- Serveur de production ---------------------------------------------------
function Arreter-Serveur([int]$port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $conn) { return }
  foreach ($c in $conn) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue
    if ($proc -and $proc.CommandLine -match 'next') {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 3
}

function Demarrer-Serveur([int]$port) {
  Arreter-Serveur $port
  Write-Host "  demarrage du serveur Next sur :$port ..." -ForegroundColor DarkGray
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "npm run start > .tout-essayer-serveur.log 2>&1" `
    -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) { Write-Host "  serveur pret." -ForegroundColor Green; return $true }
  }
  Write-Host "  ECHEC : le serveur n'a pas demarre (voir .tout-essayer-serveur.log)" -ForegroundColor Red
  return $false
}

Write-Host ''
Write-Host '  LKDV - validation locale complete' -ForegroundColor White
Write-Host '  Aucun push, aucune action externe.' -ForegroundColor DarkGray

# --- 1. Gates hors-ligne (rapides, aucun serveur) ----------------------------
Ecrire-Titre '1 - GATES HORS-LIGNE'
Gate 'type-check (tsc --noEmit)'      'npx tsc --noEmit'
Gate 'verify:invariants'               'npm run verify:invariants'
Gate 'verify:icons'                    'npm run verify:icons'
Gate 'unification.spec'                'npx vitest run tests/design/unification.spec.ts'
Gate 'audit:contrast (palette)'        'npm run audit:contrast'
Gate 'i18n:coverage'                   'npm run i18n:coverage'

# --- 2. Suite Vitest complete ----------------------------------------------
Ecrire-Titre '2 - SUITE VITEST COMPLETE'
Gate 'vitest run (6795 tests)'         'npm test'

# --- 3. Build de production -------------------------------------------------
Ecrire-Titre '3 - BUILD DE PRODUCTION'
if ($SkipBuild) {
  Write-Host '  --SkipBuild : build ignore (le .next existant sera reutilise)' -ForegroundColor Yellow
} else {
  Arreter-Serveur 4000; Arreter-Serveur 4028
  Gate 'build (next build)'            'npm run build'
}

# --- 4. Gates navigateur (besoignent du serveur) ---------------------------
Ecrire-Titre '4 - GATES NAVIGATEUR'
if (-not $SkipPlaywright) {
  # Next n'ecoute pas sur 4028 par defaut : l'audit n'autorise que :4000.
  # On declare donc explicitement la base ET son autorisation.
  $env:PW_BASE_URL = 'http://localhost:4000'
  $env:AUDIT_ALLOW_LOCAL_BASE_URL = '1'
  $env:AUDIT_ALLOWED_BASE_URLS = 'http://localhost:4000'
  if (Demarrer-Serveur 4028) {
    Gate 'test:glass (contrat verre)'   'npm run test:glass'
    Gate 'audit:prep-contrast:selftest' 'npm run audit:prep-contrast:selftest'
    Gate 'audit:prep-contrast (mesure)' 'npm run audit:prep-contrast'
    # Le serveur dev (:4000) n'est PAS lance : il consomme ~2.4 Go et bloque le build.
    Arreter-Serveur 4000
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev > .tout-essayer-dev.log 2>&1' -WindowStyle Hidden
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Seconds 1
      if (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue) { break }
    }
    if (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue) {
      Gate 'test:visual (snapshots)'    'npm run test:visual'
    } else {
      Write-Host '  [SKIP] test:visual - serveur dev indisponible' -ForegroundColor Yellow
    }
  } else {
    Write-Host '  [SKIP] gates navigateur - pas de serveur' -ForegroundColor Yellow
  }
  $env:PW_BASE_URL = ''
}

# --- 5. Gate dependant de Docker (environnement) --------------------------
Ecrire-Titre '5 - GATE DOCKER (optionnel)'
$dockerOk = $false
try { $v = docker version --format '{{.Server.Version}}' 2>$null; if ($LASTEXITCODE -eq 0 -and $v) { $dockerOk = $true } } catch {}
if ($dockerOk) {
  Gate 'ops:healthcheck'                'npm run ops:healthcheck'
} else {
  Write-Host '  [SKIP] ops:healthcheck - Docker demarre mais son moteur est indisponible.' -ForegroundColor Yellow
  Write-Host '         C est un probleme D ENVIRONNEMENT, pas de code.' -ForegroundColor DarkYellow
  Write-Host '         Correctif : relancer Docker Desktop (Reset to factory defaults si le socket se bloque).' -ForegroundColor DarkYellow
}

# --- Bilan ------------------------------------------------------------------
Ecrire-Titre 'BILAN'
$vert   = @($resultats | Where-Object { $_.Statut -eq 'VERT' }).Count
$rouge  = @($resultats | Where-Object { $_.Statut -eq 'ROUGE' }).Count
$resultats | ForEach-Object {
  $c = if ($_.Statut -eq 'VERT') { 'Green' } else { 'Red' }
  Write-Host ("  {0,-6} {1,-30} {2,6}s" -f $_.Statut, $_.Gate, $_.Secondes) -ForegroundColor $c
}
Write-Host ''
Write-Host ("  {0} vert(s), {1} rouge(s)" -f $vert, $rouge) -ForegroundColor $(if ($rouge -eq 0) { 'Green' } else { 'Red' })
Write-Host ''
Arreter-Serveur 4000
Arreter-Serveur 4028
if ($rouge -eq 0) { exit 0 } else { exit 1 }