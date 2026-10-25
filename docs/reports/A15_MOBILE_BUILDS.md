# A15 — Builds mobiles : ce qui a été exécuté, ce qui manque

Date : 2026-09-11 · Machine : Windows (win32), Node v24.18.0.
**Aucun build natif signé n'est possible sur cette machine** : les prérequis
Android SDK/JDK ≥ 11 et macOS/Xcode sont absents. Ce document consigne les
commandes réellement exécutées et leurs sorties exactes — aucune simulation.

## 1. `npm run mobile:build` — EXÉCUTÉ AVEC SUCCÈS (partie web)

Commande exacte :

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'   # env Supabase locale uniquement
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='<anon locale demo>'
$env:SUPABASE_SERVICE_ROLE_KEY='<service_role locale demo>'
npm run mobile:build        # = npm run build && npx cap sync
```

Sortie réelle (extraits) :

```text
✓ 157 glyphes SF-style générés dans public/icons/sf/
    next build : ✓ Compiled successfully in 19.7s
    ✓ Generating static pages (77/77)
    Route (app) : 150+ routes, Middleware 98.6 kB
    npx cap sync :
    √ Copying web assets from public to android\app\src\main\assets\public in 186.14ms
    √ update android in 87.99ms
    √ Copying web assets from public to ios\App\App\public in 181.69ms
    [info] Writing Package.swift
    √ update ios in 47.37ms
    [info] Sync finished in 0.819s
    Found 9 Capacitor plugins (app, camera, geolocation, haptics, keyboard,
    network, preferences, splash-screen, status-bar) pour Android et iOS.
```

Conclusion : le bundle web et la synchronisation Capacitor fonctionnent sur cette
machine ; les projets `android/` et `ios/` sont à jour côté assets web.

## 2. Build Android natif — ÉCHEC (prérequis manquants, sortie exacte)

Commande exécutée dans `android/` :

```powershell
.\gradlew.bat :app:assembleDebug --no-daemon
```

Sortie réelle (fin de log) :

```text
Downloading https://services.gradle.org/distributions/gradle-8.14.3-all.zip ... 100%
Welcome to Gradle 8.14.3!

FAILURE: Build failed with an exception.

* What went wrong:
A problem occurred configuring root project 'android'.
> Could not resolve all artifacts for configuration 'classpath'.
   > Could not resolve com.android.tools.build:gradle:8.13.0.
     Required by: root project :
      > Dependency requires at least JVM runtime version 11. This build uses a Java 8 JVM.
   > Could not resolve com.google.gms:google-services:4.4.4.
      > Dependency requires at least JVM runtime version 11. This build uses a Java 8 JVM.
```

Prérequis manquants constatés :
- **JDK ≥ 11 (idéalement 17)** : seul `Java 1.8.0_401` est installé
  (`java -version`), l'Android Gradle Plugin 8.13.0 exige ≥ 11.
- **Android SDK** : `ANDROID_HOME` et `ANDROID_SDK_ROOT` vides,
  `%LOCALAPPDATA%\Android\Sdk` absent, `adb`/`sdkmanager` introuvables.
- **Signing** : aucun keystore (`*.jks`/`*.keystore`) dans `android/` ;
  les secrets de signature ne sont pas (et ne doivent pas être) dans le dépôt.
- `android/local.properties` (chemin SDK) absent.

Même avec le JDK corrigé, le build échouerait ensuite sur le SDK Android absent.

## 3. Build iOS — IMPOSSIBLE sur cette machine

- Xcode/`xcodebuild` n'existent pas sous Windows ; un Mac avec Xcode 16+ est requis.
- `ios/App/App.xcodeproj` existe mais **aucun `DEVELOPMENT_TEAM`** n'est configuré
  et aucun certificat/profil de signature n'est présent.
- Prérequis : compte Apple Developer (rôles Admin/App Manager), certificat de
  distribution, provisioning profiles, App Store Connect + TestFlight.

## 4. Prérequis externes pour aller jusqu'au bout (aucune simulation)

| Cible | Prérequis exact | Validation attendue |
|---|---|---|
| Android debug | JDK 17, Android SDK (platform 35, build-tools), `local.properties` | `gradlew :app:assembleDebug` → APK debug |
| Android release | keystore de release + variables de signature (CI secrets) | AAB signé, `bundletool` vérifiable |
| Android test interne | Compte Google Play Console, app créée, testeurs | upload AAB + internal testing track |
| iOS debug | Mac + Xcode 16+, simulateur ou appareil | `xcodebuild -scheme App build` |
| iOS release/TestFlight | Compte Apple Developer, certificat + profil, App Store Connect | archive + upload TestFlight |
| Les deux stores | Fiches store, captures, politique de confidentialité, classification | Soumission review Apple/Google |

## 5. Statut

- Partie web/Capacitor : **prête et prouvée localement** (`npm run mobile:build` OK).
- APK/AAB signés et TestFlight : **bloqués externes** (SDK/JDK/macOS/comptes stores).
- Aucun fichier de build n'a été commité ; les artefacts générés ont été nettoyés.
