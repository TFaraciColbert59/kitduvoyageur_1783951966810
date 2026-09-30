# Encoding: UTF-8
<#
  LKDV — "La Trajectoire Vivante" : un seul comando pour l'essayer.

  Usage :
    powershell -ExecutionPolicy Bypass -File scripts/ops/essayer-trajectoire.ps1

  Le script fait tout : il libere le port, build, demarre le serveur de
  PRODUCTION sur :4028, verifie que /trajectoire repond 200, puis laisse le
  serveur TOURNE pour que tu testes a la main. Il ne lance pas le serveur de
  dev en parallele : deux serveurs, deux caches, deux sources de verite.

  Pour arreter : Ctrl+C dans ce terminal, ou
    powershell -Command "Get-NetTCPConnection -LocalPort 4028 -State Listen | % { Stop-Process -Id $_.OwningProcess }"
#>
param(
  [switch]$SkipBuild,
  [int]$Port = 4028,
  [string]$Route = '/trajectoire'
)

$ErrorActionPreference = 'Continue'
$racine = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $racine

function Ecrire-Titre([string]$t) {
  Write-Host ''
  Write-Host ("=" * 68) -ForegroundColor DarkGray
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host ("=" * 68) -ForegroundColor DarkGray
}

function Ok  ([string]$m) { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Err ([string]$m) { Write-Host "  [ECHEC] $m" -ForegroundColor Red }
function Note([string]$m) { Write-Host "  [INFO] $m" -ForegroundColor DarkGray }

# ---------------------------------------------------------------------------
# 1. LIBERER LE PORT (un ancien essai peut encore l'tenir)
# ---------------------------------------------------------------------------
Ecrire-Titre "1/4  Liberation du port $Port"
$occupants = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($occupants.Count -gt 0) {
  foreach ($o in $occupants) {
    try {
      Stop-Process -Id $o.OwningProcess -Force -ErrorAction Stop
      Note "processus $($o.OwningProcess) arrete"
    } catch {
      Err "impossible d'arreter le processus $($o.OwningProcess) : $($_.Exception.Message)"
    }
  }
  Start-Sleep -Seconds 2
} else {
  Note "port libre"
}

# ---------------------------------------------------------------------------
# 2. BUILD
# ---------------------------------------------------------------------------
if (-not $SkipBuild) {
  Ecrire-Titre "2/4  Build de production"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Err "le build a echoue — le serveur ne demarre pas."
    exit 1
  }
  Ok "build termine"
} else {
  Ecrire-Titre "2/4  Build ignore (-SkipBuild)"
}

# ---------------------------------------------------------------------------
# 3. SERVEUR DE PRODUCTION
# ---------------------------------------------------------------------------
Ecrire-Titre "3/4  Demarrage du serveur sur :$Port"
$log = Join-Path $racine ".trajectoire-server.log"
if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log -Force }

$env:PORT = "$Port"
$proc = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'start') `
  -WorkingDirectory $racine -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $log -RedirectStandardError "$log.err"
Note "pid $($proc.Id) — journal : $log"

$url = "http://localhost:$Port$Route"
$pret = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  try {
    $rep = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    if ($rep.StatusCode -eq 200) { $pret = $true; break }
  } catch { }
}

if (-not $pret) {
  Err "$url n'a pas repondu 200 dans les 90 s."
  if (Test-Path "$log.err") { Get-Content "$log.err" -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed } }
  if (Test-Path $log) { Get-Content $log -Tail 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray } }
  exit 1
}
Ok "$url repond 200"

# ---------------------------------------------------------------------------
# 4. MODE D'ESSAI
# ---------------------------------------------------------------------------
Ecrire-Titre "4/4  A toi de jouer"
Write-Host ''
Write-Host "  Ouvre :  $url" -ForegroundColor White
Write-Host ''
Write-Host '  Ce que tu dois voir, et comment le verifier :' -ForegroundColor White
Write-Host '   1. Une regle logarithmique de 1 h a 720 h, 7 reperes (1 h, 6 h, 1 j, 3 j,'
Write-Host '      7 j, 14 j, 30 j). Deplacable a la souris ET au clavier.'
  Write-Host '   2. Clavier : Tab jusqu au curseur, puis fleches, Home, End, Page Up/Down'
  Write-Host '      (une zone entiere). Le libelle lu par le lecteur d ecran annonce'
  Write-Host '      la duree, pas un compte brut : "1 h", "30 heures (1,3 jour)",'
  Write-Host '      "720 heures (30 jours)".'
Write-Host '   3. Les 5 puces de zone (Sortie / Journee / Raid / Expedition / Tour du monde)'
Write-Host '      sautent direct a la zone.'
Write-Host '   4. Les 8 cartes se recalculent a chaque deplacement : budget, dangerosite,'
Write-Host '      fenetre meteo, plan vivant, etapes, kit, traces, veille.'
Write-Host '   5. Le paysage change de couleur avec la zone.'
Write-Host '   6. Reecris l intention (ex. "Desert Zagora", "Lofoten sans voiture"),'
Write-Host '      "Recalculer" : la destination et les contraintes changent.'
Write-Host '   7. Bascule l Autopilot : les 3 vigies passent de "inactive" a leur detail.'
Write-Host ''
Write-Host '  Ce que tu ne dois PAS voir : aucune valeur qui bouge sans que tu l'
Write-Host '  demandes ; aucune carte vide ; aucun hex de couleur hors design system.'
Write-Host ''
Write-Host '  Ctrl+C arrete le serveur. Merci !' -ForegroundColor Cyan
Write-Host ''

# On garde le processus vivant : le terminal reste occupe jusqu'a Ctrl+C.
try {
  Wait-Process -Id $proc.Id
} catch {
  Note "le serveur s'est arrete."
}
