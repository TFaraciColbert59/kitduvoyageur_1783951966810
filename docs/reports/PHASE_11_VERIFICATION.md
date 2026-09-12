# PHASE 11 — Vérification (Mobile natif et terrain — partie autonomisable)

**Date :** 2026-09-12
**Branche :** `feat/phase11-mobile-build` — base `64b225a6` (= `origin/main`,
fusion Phase 4 `#45`)
**Environnement :** Windows 11 (win32), session **non administrateur**,
Node v24.18.0 / npm 12.0.2, JDK Temurin 21.0.12.1 (Gradle) + 17.0.20.1
(sdkmanager/keytool), Android SDK 36 locale, Gradle wrapper 8.14.3, AGP 8.13.0,
Capacitor 8.5.0.
**Responsable :** agent MOBILE/QA ; comptes stores, iOS, appareils physiques et
calibration terrain = humain non saisi.
**Décision :** **PASS (périmètre local)** — AAB release **signé** produit et
vérifié ; **`INSUFFICIENT_DATA`** pour publication Play, iOS/TestFlight,
appareils physiques, mesures batterie/mémoire/réseau et 30 paires ETA/réel
(jamais `PASS`).

---

## 1. Audit condensé (existant vérifié vs ajouté)

| Domaine | Existant (A15, audité) | Ajouté Phase 11 |
|---|---|---|
| JDK | `Java 1.8.0_401` seul ; échec AGP « JVM ≥ 11 » | JDK 21 **et** 17 portables (Temurin) hors dépôt |
| Android SDK | absent (`ANDROID_HOME` vide) | cmdline-tools 16.0, platform-tools 37.0.1, `platforms;android-36`, `build-tools;36.0.0`, licences acceptées |
| Build natif | `gradlew :app:assembleDebug` échouait (JVM + SDK) | `gradlew bundleRelease` → **BUILD SUCCESSFUL**, AAB signé |
| Signature | aucun keystore, aucun câblage | keystore PKCS12 temp (hors dépôt) + `keystore.properties` ignoré + repli env + `.example` versionné |
| Secrets | absents (règle A15) | **toujours** : rien de secret n'est commité (vérifié par `git check-ignore` et `git status`) |
| Stores | non tentés | checklist humaine rédigée (`docs/mobile/STORES_CHECKLIST.md`) |
| iOS | impossible (pas de Mac/Xcode) | documenté, **non tenté** (conforme à la consigne) |
| Terrain | aucun test appareil/ETA | protocole et matrice documentés ; **non exécutés** |

Écarts par rapport à la consigne initiale, assumés et documentés :

1. `android/variables.gradle` exige `compileSdk 36` (pas 35) → SDK 36 installé.
2. Capacitor 8 exige **Java 21** (pas seulement 17) → JDK 21 utilisé pour
   Gradle ; JDK 17 conservé mais insuffisant pour ce projet.
3. `winget` (MSI) bloqué par l'UAC non interactif (session non admin) →
   installation portable depuis les distributions officielles Adoptium/Google,
   strictement équivalente ; la variante `winget` est documentée.

## 2. Livrables

### 2.1 Chaîne Android locale

- `C:\Users\Tony\AppData\Local\LKDV\tools\jdk-21` (Temurin 21.0.12.1+1)
- `C:\Users\Tony\AppData\Local\LKDV\tools\jdk-17` (Temurin 17.0.20.1+1)
- `C:\Users\Tony\AppData\Local\LKDV\android-sdk` :
  cmdline-tools 16.0 (`commandlinetools-win-11076708`), platform-tools 37.0.1,
  `platforms;android-36` (rev 2), `build-tools;36.0.0` ; 7/7 licences acceptées.
- `android/local.properties` (ignoré) : `sdk.dir=C:/Users/Tony/AppData/Local/LKDV/android-sdk`.
- Persistance documentée : `setx JAVA_HOME` / `ANDROID_HOME` / `ANDROID_SDK_ROOT`
  (voir `docs/mobile/ANDROID_RELEASE.md` §3).

### 2.2 Sync Capacitor

`npx cap sync android` → exit 0 (0,446 s) :
assets web copiés (`public` → `android/app/src/main/assets/public`), 9 plugins
détectés (app 8.1.1, camera 8.2.3, geolocation 8.2.2, haptics 8.0.2,
keyboard 8.0.5, network 8.0.1, preferences 8.0.1, splash-screen 8.0.2,
status-bar 8.0.3).

### 2.3 AAB release signé

| Élément | Valeur |
|---|---|
| Fichier | `android/app/build/outputs/bundle/release/app-release.aab` |
| Copie durable hors dépôt | `C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-app-release.aab` |
| Taille | **146 405 405 octets** (~139,6 Mio) |
| SHA-256 | `C01A9DB0D60DE1B3DF35D69D2A99383DA10BF8B5AA5563374AA604C0E398C5A5` |
| `jarsigner -verify` | **exit 0 — `jar verified.`** |
| Certificat | `CN=Le Kit du Voyageur, OU=Mobile, O=Le Kit du Voyageur, L=Paris, C=FR`, RSA 4096, SHA384withRSA |
| Empreinte cert SHA-256 | `17:24:D5:3C:CE:38:DC:72:0D:A7:83:23:BE:3E:FC:34:DE:85:4C:25:0E:7B:24:D8:EF:EA:8F:1C:AE:66:78:C0` |
| Validité | 2026-09-12 → 2054-01-28 (10 000 jours) |

Alertes `jarsigner` bénignes et expliquées : chaîne de certification non
publique (certificat auto-signé, normal pour une signature d'app) et entrées
compressées « not signed in JarInputStream » (comportement JDK connu sur les
AAB). Aucune n'invalide le `jar verified.`.

### 2.4 Signature sans secret versionné

- Keystore de release (hors dépôt) :
  `C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-release.keystore`
  — 4 420 octets, PKCS12, alias `lkdv-release`, SHA-256
  `A79AD1D2655652BD3102B6BA1156C28859946474D97CA579B2C2CB7F0DFC7FC4`.
- Secrets + avertissement de sauvegarde :
  `C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-keystore.txt`
  (mots de passe aléatoires 40 caractères ; **perte = plus de mise à jour Play**).
- Câblage : `android/app/build.gradle` lit `keystore.properties` puis, en repli,
  `LKDV_KEYSTORE_FILE` / `LKDV_KEYSTORE_STORE_PASSWORD` /
  `LKDV_KEYSTORE_KEY_ALIAS` / `LKDV_KEYSTORE_KEY_PASSWORD` ; la `signingConfig`
  release n'est appliquée que si les 4 valeurs existent.
- `android/keystore.properties` (local) et `android/local.properties` :
  **ignorés** — prouvé par `git check-ignore -v`.
- `android/keystore.properties.example` versionné (valeurs vides).

### 2.5 Changements `android/` (explication)

| Fichier | Changement | Justification |
|---|---|---|
| `android/app/build.gradle` | Bloc `signingConfigs.release` + lecture `keystore.properties`/env + `if (hasReleaseSigning) signingConfig` | Signer l'AAB sans jamais versionner de secret ; build non signé toujours possible sans secrets |
| `android/.gitignore` | Activer `*.jks`, `*.keystore` ; ajouter `keystore.properties` | Empêcher tout commit de secret |
| `android/keystore.properties.example` | Nouveau modèle à valeurs vides | Documentation exécutable pour un nouveau poste/CI |

`npx cap sync` a réécrit `android/app/capacitor.build.gradle` et
`android/capacitor.settings.gradle` **à contenu identique** (seuls les fins de
ligne différaient) : fichiers restaurés (`git checkout --`), aucun diff.

### 2.6 Documentation

- `docs/mobile/ANDROID_RELEASE.md` : procédure reproductible complète
  (prérequis, installation portable, env, signature, build, vérification,
  dépannage, étapes humaines).
- `docs/mobile/STORES_CHECKLIST.md` : Play Console, Apple/TestFlight, matrice
  5 profils d'appareils, batterie/mémoire/réseau instable, 30 paires ETA/réel,
  gate G12 ; étapes humaines marquées.

## 3. Commandes et résultats bruts

| Commande | Résultat |
|---|---|
| `winget install EclipseAdoptium.Temurin.17.JDK …` | **timeout sans sortie** (UAC non interactif) → bascule archives portables |
| `sdkmanager --licenses` | **7/7 licences acceptées** (exit 0) |
| `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"` | **exit 0** ; adb 1.0.41, platform 36 rev 2, build-tools 36.0.0 |
| `npx cap sync android` | **exit 0** (0,446 s, 9 plugins) |
| `gradlew bundleRelease` (1re tentative, JDK 17) | **FAILED** : `Cannot find a Java installation ... {languageVersion=21}` → JDK 21 installé |
| `gradlew bundleRelease` (2e tentative) | **FAILED** : `UnrecoverableKeyException ... not properly padded` (`keyPassword` ≠ `storePassword` en PKCS12) → `keystore.properties` corrigé |
| `gradlew bundleRelease` (finale) | **BUILD SUCCESSFUL in 12s — 449 tâches (14 executed, 435 up-to-date)** |
| `jarsigner -verify app-release.aab` | **exit 0 — `jar verified.`** |
| `keytool -printcert -jarfile app-release.aab` | certificat CN=Le Kit du Voyageur, validité 2054-01-28 |
| `npm run type-check` | **exit 0**, 0 erreur |
| `npm run lint` | **exit 0**, 0 erreur (warnings préexistants uniquement) |
| `npm run test` (run 1) | 317 fichiers passés / 4 skipped ; **1 test en échec** : `tests/trips/chantier-z5.spec.ts > Z-D32.1` — **timeout d'import 5 000 ms** (test flaky, module volumineux, machine chargée) |
| `npm run test` (run 2, immédiat) | **exit 0 — 318 fichiers passés / 4 skipped ; 2 259 tests passés / 27 skipped / 0 échoué** |

Extraits réels :

```text
√ Copying web assets from public to android\app\src\main\assets\public in 238.32ms
[info] Found 9 Capacitor plugins for android
[info] Sync finished in 0.446s

> Task :app:packageReleaseBundle UP-TO-DATE
> Task :app:signReleaseBundle UP-TO-DATE
BUILD SUCCESSFUL in 12s
449 actionable tasks: 14 executed, 435 up-to-date

jar verified.
Warning: This jar contains entries whose certificate chain is invalid.
  Reason: PKIX path building failed: ... (certificat auto-signé — normal)

Test Files  318 passed | 4 skipped (322)
     Tests  2259 passed | 27 skipped (2286)
```

## 4. Snapshots visuels impactés

**Aucun** : aucun composant, page, style ou asset modifié (uniquement
`android/`, docs et rapports). Aucune baseline visuelle à régénérer.

## 5. Limites et risques résiduels (honnêtes)

1. **AAB volumineux** : 146,4 Mo (assets web `public/` = 134,7 Mo dont
   `public/assets` = 112,9 Mo). Proche du plafond Play (150 Mo — `[À VÉRIFIER]`),
   à alléger avant toute soumission.
2. **Publication store non faite** : aucun compte, aucune piste, aucun upload.
3. **iOS non prouvé** : pas de Mac/Xcode ; documentation et checklist
   uniquement.
4. **Aucun test appareil physique** : permissions, GPS, caméra, réseau,
   notifications, batterie, mémoire, température, stockage = `INSUFFICIENT_DATA`.
5. **Aucune paire ETA/réel** (30 exigées) et aucune calibration étendue.
6. **Test flaky identifié** : `tests/trips/chantier-z5.spec.ts > Z-D32.1`
   (`Test timed out in 5000ms` sur import dynamique à froid) ; vert au second
   run complet et hors périmètre Phase 11 (aucun code TS modifié). À stabiliser
   séparément (timeout du test ou import préchargé).
7. **Build exécuté depuis un agent** : le harnais tue les processus foreground
   silencieux ; les builds longs ont été relancés en processus détaché avec log.
   Sans impact sur la validité des artefacts (exit 0 obtenu en direct à la
   finale).
8. **Secrets** : le keystore et ses mots de passe sont uniquement dans le
   dossier temp de la machine — leur perte est irréversible pour les mises à
   jour Play (avertissement intégré au fichier de secrets).
9. **`local.properties`** contient un chemin machine, non portable ; ignoré par
   git (comportement standard Android).

## 6. Décision

**PASS (périmètre local technique)** pour : toolchain Android installé et
documenté, `cap sync` reproductible, **AAB release signé** (SHA-256 et
signature vérifiés), configuration de signature **sans aucun secret versionné**,
non-régression npm complète (type-check, lint, 2 259 tests).

**`INSUFFICIENT_DATA` (jamais `PASS`)** pour : Play Console et test interne,
iOS/TestFlight, tests sur appareils physiques, mesures batterie/mémoire/réseau,
30 paires ETA/réel, calibration étendue.
