# Recette C — iPhone (installation, lancement, limites)

- **Appareil** : iPhone de Tony — iPhone 16 Pro (`iPhone17,1`), UDID `00008140-000E7D081A0B001C`,
  apparié et « available ».
- **Xcode** : 27.2 (build 27B52), signature Debug automatique (Personal Team `QRU99VJUB5`).
- **Coquille Capacitor** : `ios/App/App.xcodeproj`, schéma `App`, bundle `com.lekitduvoyageur.app`.
- **URL chargée par la coquille** : déploiement Vercel **Preview** du commit de recette
  `ce5313a` — `https://kitduvoyageur-1783951966810-nsj0gu31k.vercel.app`
  (`NEXT_PUBLIC_COMMUNAUTE_V2=true` sur Preview). La Production n'est pas utilisable pour la
  recette C : la V2 y est `false` (J-08, migrations non appliquées) — écart documenté.
- **Commandes** :
  ```bash
  CAPACITOR_SERVER_URL=https://kitduvoyageur-1783951966810-nsj0gu31k.vercel.app \
    bash scripts/ios-install.sh 00008140-000E7D081A0B001C
  ```
  (sync Capacitor → build signé → `devicectl device install app` → `process launch`).

## Résultats

| Étape | Sortie observée |
|---|---|
| `npx cap sync ios` | `Sync finished in 0.647s`, 11 plugins Capacitor synchronisés |
| `xcodebuild … -allowProvisioningUpdates` | **`** BUILD SUCCEEDED **`** |
| `xcrun devicectl device install app` | `App installed`, bundle `com.lekitduvoyageur.app`, installationUUID `473C6AC3-97D6-44BA-9402-A473DB602469` |
| `xcrun devicectl device process launch` | **`Launched application with com.lekitduvoyageur.app bundle identifier.`** |
| Capture d'écran appareil (`devicectl device capture screenshot`) | `captures-v2/iphone-app-lancee.png` (1206 × 2622) : l'app tourne en plein écran, barre d'état iOS, safe areas respectées, aucun chrome navigateur. |

Journal complet : `/tmp/ios-install2.log` (hors dépôt, reproductible par la commande ci-dessus).

## Limites de cette recette (aucune case cochée sans preuve)

| Case `07 § C` | Statut | Raison |
|---|---|---|
| App installée via Xcode | **FAIT (vérifié)** | build + install + launch ci-dessus + capture |
| Ouvrir les deux tiroirs depuis la Communauté | **NON TESTÉ** | aucune automatisation de **tap** sur appareil physique disponible (ni Maestro CLI, ni WebDriverAgent/idb installés — budget 0 €, pas de nouvelle dépendance) ; l'ouverture des tiroirs est prouvée sur le **même build web** en Preview Chromium (`report/APERCU-FINAL-REPORT.json`) et en local WebKit/Chromium (e2e 34/34 × 2 moteurs) |
| Haptique (capsules, tri, rejoindre, envoi) | **NON TESTÉ** | nécessite une interaction manuelle sur l'appareil |
| Safe areas (encoche, indicateur d'accueil) | **PREUVE VISUELLE** | capture `iphone-app-lancee.png` = app plein écran sous l'encoche, contenu dans les safe areas |
| Clavier ne masque jamais le pied / le champ actif | **NON TESTÉ** | interaction manuelle requise (le comportement `visualViewport` est couvert par la spec e2e `7` — sautée faute de simulateur de clavier iOS réel) |
| Caméra/photothèque et géolocalisation, textes d'autorisation en fr | **PARTIEL** | Constat de recette : seul `NSLocationWhenInUseUsageDescription` existait ; les libellés **caméra / photothèque / ajout à la photothèque** ont été ajoutés en français dans `ios/App/App/Info.plist` (plist validé `plutil -lint`). L'**ouverture réelle** de la caméra/photothèque reste **NON TESTÉE** (interaction manuelle requise) |
| Flow Maestro `.maestro/communaute.yaml` | **NON TESTÉ** | CLI `maestro` absente de la machine (flow écrit et YAML validé) |
