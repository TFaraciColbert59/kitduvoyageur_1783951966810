#!/usr/bin/env bash
# Installe et lance l'app LKDV sur l'iPhone branché (Capacitor : la coquille charge le site déployé).
# Usage : bash scripts/ios-install.sh [UDID]
# Prérequis : iPhone branché, déverrouillé, « Faire confiance » accepté, Mode développeur activé,
#             Xcode connecté au compte Apple (Personal Team QRU99VJUB5).
set -euo pipefail
UDID="${1:-00008140-000E7D081A0B001C}"
# URL chargée par la coque. `koosmoweb.fr` n'a pas encore de zone DNS (aucun A/CNAME au 05/11) :
# en attendant, on câble le déploiement de production vérifié. Remplacer par https://koosmoweb.fr
# quand la zone pointera sur Vercel.
SERVER_URL="${CAPACITOR_SERVER_URL:-https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app}"
DERIVED="${DERIVED_DATA:-/tmp/lkdv-dd}"

echo "▸ Appareil : $UDID"
xcrun devicectl list devices | grep -q "$UDID.*available" || {
  echo "✗ iPhone non joignable. Brancher, déverrouiller, accepter « Faire confiance »." >&2
  xcrun devicectl list devices | grep -i iphone || true
  exit 1
}

echo "▸ Sync Capacitor → $SERVER_URL"
CAPACITOR_SERVER_URL="$SERVER_URL" npx cap sync ios

echo "▸ Build signé (Debug, appareil)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=$UDID" -allowProvisioningUpdates -derivedDataPath "$DERIVED" build | tail -3

APP="$DERIVED/Build/Products/Debug-iphoneos/App.app"
echo "▸ Installation"
xcrun devicectl device install app --device "$UDID" "$APP"

echo "▸ Lancement"
xcrun devicectl device process launch --device "$UDID" com.lekitduvoyageur.app
echo "✓ Kit Studio : ouvrir /kit-studio dans l'app (lien depuis le départ)."
