#!/usr/bin/env bash
# macOS + Xcode + iPhone branché, déverrouillé, Mode Développeur activé. Installe et lance l'app.
set -euo pipefail
[ "$(uname)" = "Darwin" ] || { echo "Ce script exige macOS (voir ios/RUN-ON-IPHONE.md, voie B)"; exit 2; }
URL="${CAPACITOR_SERVER_URL:-https://kitduvoyageur-1783951966810-ruddy.vercel.app}"
TEAM="${IOS_TEAM_ID:-}"      # Personal Team de l'identifiant Apple gratuit (10 caractères). Ne pas committer.
BID="${IOS_BUNDLE_ID:-com.lekitduvoyageur.app}"
case "$URL" in https://*) ;; *) echo "CAPACITOR_SERVER_URL doit être en https"; exit 1;; esac
export CAPACITOR_SERVER_URL="$URL"
npm ci --no-audit --no-fund
node scripts/mobile/sync-release.mjs ios   # même commande que la CI (.github/workflows/ios.yml)
DEV=$(xcrun devicectl list devices 2>/dev/null | awk '/iPhone/ && /available|connected/ {print $3; exit}')
[ -n "$DEV" ] || { echo "Aucun iPhone détecté (brancher, déverrouiller, « Faire confiance »)."; xcrun devicectl list devices; exit 3; }
echo "Appareil : $DEV"
ARGS=(-project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "id=$DEV" -derivedDataPath build/ios -allowProvisioningUpdates)
[ -n "$TEAM" ] && ARGS+=(DEVELOPMENT_TEAM="$TEAM")
[ "$BID" != "com.lekitduvoyageur.app" ] && ARGS+=(PRODUCT_BUNDLE_IDENTIFIER="$BID")
xcodebuild "${ARGS[@]}" build | tail -25
APP=$(find build/ios/Build/Products -maxdepth 2 -name 'App.app' | head -1)
xcrun devicectl device install app --device "$DEV" "$APP"
xcrun devicectl device process launch --device "$DEV" "$BID" || true
echo "Installée. Ouvrir l'app, aller sur /kit-studio."
