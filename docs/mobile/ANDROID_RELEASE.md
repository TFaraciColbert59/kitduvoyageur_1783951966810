# Android — build release signé (AAB) reproductible

**Date de rédaction :** 2026-09-12
**Périmètre :** construire localement un Android App Bundle (`.aab`) signé
`com.lekitduvoyageur.app`, sans aucun secret versionné.
**Statut :** chaîne locale **opérationnelle et prouvée** (AAB signé, `jarsigner`
exit 0). Publication Play, iOS et tests appareils = **items humains**.

---

## 1. Résultat de référence (machine de build actuelle)

| Élément | Valeur |
|---|---|
| AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| Copie durable (hors dépôt) | `C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-app-release.aab` |
| Taille | 146 405 405 octets (~139,6 Mio) |
| SHA-256 AAB | `C01A9DB0D60DE1B3DF35D69D2A99383DA10BF8B5AA5563374AA604C0E398C5A5` |
| Signature | `jarsigner -verify` → `jar verified.` (exit 0) |
| Certificat | `CN=Le Kit du Voyageur, OU=Mobile, O=Le Kit du Voyageur, L=Paris, C=FR` |
| Empreinte SHA-256 cert | `17:24:D5:3C:CE:38:DC:72:0D:A7:83:23:BE:3E:FC:34:DE:85:4C:25:0E:7B:24:D8:EF:EA:8F:1C:AE:66:78:C0` |
| Validité du certificat | 2026-09-12 → 2054-01-28 (10 000 jours) |
| Application | `applicationId com.lekitduvoyageur.app`, versionCode 1, versionName 1.0 |
| SDK cible | minSdk 24 / compileSdk 36 / targetSdk 36 (`android/variables.gradle`) |

> **Avertissement taille :** 146,4 Mo est proche du plafond d'upload Play
> (150 Mo au moment de la rédaction — à revérifier). Poids principal :
> `public/` = 134,7 Mo dont `public/assets` = 112,9 Mo, embarqués tels quels par
> `npx cap sync`. Réduire les assets avant toute soumission store.

## 2. Prérequis exacts (et pourquoi)

| Outil | Version installée | Pourquoi |
|---|---|---|
| **JDK 21** | Temurin `21.0.12.1+1` (2026-08-18) | **Obligatoire** : Capacitor 8 compile en `sourceCompatibility 21` (`android/app/capacitor.build.gradle`, `node_modules/@capacitor/android/capacitor/build.gradle:66`). Un JDK 17 seul échoue : `Cannot find a Java installation ... matching {languageVersion=21}`. |
| JDK 17 | Temurin `17.0.20.1+1` | Suffisant pour `sdkmanager`/`keytool` ; utile en secours, non requis pour Gradle ici. |
| Android cmdline-tools | 16.0 (`commandlinetools-win-11076708`) | Fournit `sdkmanager`. |
| platform-tools | 37.0.1 (`adb` 1.0.41) | Appareils/émulateurs. |
| platforms;android-36 | révision 2 | `compileSdkVersion = 36` (`android/variables.gradle`). |
| build-tools;36.0.0 | 36.0.0 | Version des build-tools du projet. |
| Gradle | wrapper 8.14.3 (cache `~/.gradle/wrapper/dists/gradle-8.14.3-all`) | `android/gradle/wrapper/gradle-wrapper.properties`. |
| AGP | 8.13.0 | `android/build.gradle`. |
| Node / npm | v24.18.0 / 12.0.2 | `npx cap sync android`, `npm run *`. |

### Chemins installés sur la machine de référence

```text
JDK 21   : C:\Users\Tony\AppData\Local\LKDV\tools\jdk-21
JDK 17   : C:\Users\Tony\AppData\Local\LKDV\tools\jdk-17
SDK      : C:\Users\Tony\AppData\Local\LKDV\android-sdk
```

## 3. Installation du toolchain (procédure reproductible)

La session d'agent n'a **pas de droits administrateur** : `winget install`
(MSI) reste bloqué sur l'invite UAC non interactive. L'installation utilisée
est donc **portable** (archives officielles, sans admin) — même résultat.

```powershell
$tools = "$env:LOCALAPPDATA\LKDV\tools"
$sdk   = "$env:LOCALAPPDATA\LKDV\android-sdk"
New-Item -ItemType Directory -Force -Path $tools, $sdk | Out-Null

# JDK 21 et 17 (Adoptium/Temurin, archives officielles via l'API Adoptium)
curl.exe -L -o "$env:TEMP\temurin21.zip" "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
curl.exe -L -o "$env:TEMP\temurin17.zip" "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
tar.exe -xf "$env:TEMP\temurin21.zip" -C $tools   # puis renommer le dossier extrait en jdk-21
tar.exe -xf "$env:TEMP\temurin17.zip" -C $tools   # puis renommer le dossier extrait en jdk-17

# cmdline-tools (URL officielle Google)
curl.exe -L -o "$env:TEMP\cmdline-tools.zip" "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
New-Item -ItemType Directory -Force -Path "$sdk\cmdline-tools\latest" | Out-Null
tar.exe -xf "$env:TEMP\cmdline-tools.zip" -C "$env:TEMP\clt"
Copy-Item -Recurse -Force "$env:TEMP\clt\cmdline-tools\*" "$sdk\cmdline-tools\latest\"

# Licences + paquets requis
$env:JAVA_HOME = "$tools\jdk-21"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --licenses   # répondre y à chaque licence
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Alternative administrateur (poste avec UAC interactif) :

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK --accept-source-agreements --accept-package-agreements
winget install --id EclipseAdoptium.Temurin.17.JDK --accept-source-agreements --accept-package-agreements
```

### Variables d'environnement

Pour la session courante (PowerShell) :

```powershell
$env:JAVA_HOME    = "$env:LOCALAPPDATA\LKDV\tools\jdk-21"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\LKDV\android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

Persistance utilisateur (sans admin, effectif aux prochaines sessions) :

```powershell
setx JAVA_HOME "$env:LOCALAPPDATA\LKDV\tools\jdk-21"
setx ANDROID_HOME "$env:LOCALAPPDATA\LKDV\android-sdk"
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\LKDV\android-sdk"
```

`android/local.properties` (déjà ignoré par git) porte aussi le chemin SDK :
`sdk.dir=C:/Users/Tony/AppData/Local/LKDV/android-sdk`.

## 4. Signature release — zéro secret versionné

### 4.1 Modèle de secret

- Le keystore et ses mots de passe vivent **hors du dépôt**.
- `android/keystore.properties` (ignoré par git) alimente Gradle en local.
- En CI, les variables `LKDV_KEYSTORE_FILE`, `LKDV_KEYSTORE_STORE_PASSWORD`,
  `LKDV_KEYSTORE_KEY_ALIAS`, `LKDV_KEYSTORE_KEY_PASSWORD` sont lues en repli.
- `android/keystore.properties.example` (versionné, valeurs vides) sert de
  modèle.

### 4.2 Générer un keystore (exemple exécuté en Phase 11)

```powershell
# Mots de passe aléatoires 40 caractères, un seul mot de passe pour un PKCS12
$tools = "$env:LOCALAPPDATA\LKDV\tools"
$ks = "C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-release.keystore"
& "$tools\jdk-21\bin\keytool.exe" -genkeypair -v `
  -keystore $ks -alias lkdv-release -keyalg RSA -keysize 4096 -validity 10000 `
  -storetype PKCS12 -storepass:file store.txt -keypass:file key.txt `
  -dname "CN=Le Kit du Voyageur, OU=Mobile, O=Le Kit du Voyageur, L=Paris, C=FR"
```

> **PKCS12 :** `keytool` ignore `-keypass` ; le mot de passe de clé **doit être
> identique** au mot de passe du store. Sinon Gradle échoue avec
> `UnrecoverableKeyException: ... Given final block not properly padded`.

### 4.3 `android/keystore.properties` (local, jamais commité)

```properties
storePassword=<motdepasse>
keyPassword=<motdepasse>       # identique au store en PKCS12
keyAlias=lkdv-release
storeFile=C:/Users/Tony/AppData/Local/Temp/opencode/lkdv-release.keystore
```

### 4.4 Câblage Gradle (`android/app/build.gradle`)

Le module `app` charge `keystore.properties` (ou repli variables d'env) et
n'applique `signingConfigs.release` **que si** les 4 valeurs sont présentes :
sans secrets, la configuration reste valide et le build release sort non signé
(aucune erreur de configuration).

### 4.5 Sauvegarde — avertissement critique

Le fichier de secrets généré est
`C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-keystore.txt` (mot de passe +
alias + chemin keystore, avec avertissement intégré) :

- **Perte du keystore ou du mot de passe = impossibilité définitive de publier
  des mises à jour sur Google Play** (hors réinitialisation via Play App
  Signing si la clé d'upload a été perdue — la clé d'app reste alors chez
  Google).
- À transférer immédiatement dans un coffre (1Password/Bitwarden/Vault) et à
  sauvegarder hors machine (support chiffré, coffre physique).
- SHA-256 keystore de référence :
  `A79AD1D2655652BD3102B6BA1156C28859946474D97CA579B2C2CB7F0DFC7FC4`
  (4 420 octets, PKCS12, validité 10 000 jours).

## 5. Construire l'AAB signé

Depuis la racine du dépôt, avec `JAVA_HOME`/`ANDROID_HOME` définis (§3) :

```powershell
npx cap sync android
cd android
.\gradlew.bat bundleRelease --console=plain
```

Sortie attendue (réelle, 2026-09-12) :

```text
BUILD SUCCESSFUL in 12s
449 actionable tasks: 14 executed, 435 up-to-date
```

Artefact : `android/app/build/outputs/bundle/release/app-release.aab`
(tâches `packageReleaseBundle` + `signReleaseBundle`).

## 6. Vérifier la signature

```powershell
& "$env:JAVA_HOME\bin\jarsigner.exe" -verify android\app\build\outputs\bundle\release\app-release.aab
# → "jar verified." (exit 0)

& "$env:JAVA_HOME\bin\keytool.exe" -printcert -jarfile android\app\build\outputs\bundle\release\app-release.aab
# → Propriétaire CN=Le Kit du Voyageur..., empreinte SHA-256 du certificat
```

Avertissements normaux à accepter :

- `This jar contains entries whose certificate chain is invalid ... unable to
  find valid certification path` : normal pour un certificat **auto-signé**
  (Android/Play ne valident pas une chaîne CA publique pour la signature
  d'application).
- `Entry ... is signed in JarFile but is not signed in JarInputStream` :
  avertissement JDK sur les entrées compressées d'un AAB, sans impact.

`apksigner` ne s'applique qu'aux APK ; pour un AAB, `jarsigner` est l'outil de
vérification local. La validation complète Play se fait à l'upload.

## 7. Étapes humaines après le build (non exécutables par l'agent)

1. **Sauvegarder** keystore + mots de passe dans un coffre (§4.5).
2. Créer le compte Google Play Console et l'application
   `com.lekitduvoyageur.app` (voir `STORES_CHECKLIST.md`).
3. Activer Play App Signing, uploader l'AAB en test interne.
4. Compléter fiche store, Data Safety, classification de contenu, URL de
   confidentialité.
5. Tests sur appareils physiques (matrice dans `STORES_CHECKLIST.md`).
6. iOS : Mac + Xcode 16+, compte Apple Developer, certificats, TestFlight.
7. Rollout progressif selon le chantier (interne → 1 % → …), décision humaine.

## 8. Dépannage

| Symptôme | Cause | Correctif |
|---|---|---|
| `Cannot find a Java installation ... {languageVersion=21}` | JAVA_HOME pointe JDK 17/8 | Utiliser JDK 21 (`§2`) pour Gradle |
| `UnrecoverableKeyException ... not properly padded` | `keyPassword` ≠ `storePassword` en PKCS12 | Aligner les deux valeurs |
| `Dependency requires at least JVM runtime version 11` | JDK 8 | JDK 21 |
| `winget install` sans sortie puis timeout | UAC non interactif, session non admin | Archives portables (`§3`) ou shell admin |
| `SDK location not found` | `ANDROID_HOME`/`local.properties` absents | `§3` |
| AAB > plafond Play | Assets web 134,7 Mo | Alléger `public/assets`, découper l'app |

## 9. Fichiers versionnés par cette procédure

| Fichier | Rôle | Secret |
|---|---|---|
| `android/app/build.gradle` | lecture `keystore.properties` + repli env, signingConfig conditionnelle | non |
| `android/keystore.properties.example` | modèle à recopier, valeurs vides | non |
| `android/.gitignore` | ignore `*.jks`, `*.keystore`, `keystore.properties`, `local.properties` | non |

**Jamais versionnés :** `android/keystore.properties`, `*.jks`, `*.keystore`,
`android/local.properties`, tout `.aab`/`.apk` (déjà couverts par
`android/.gitignore`).
