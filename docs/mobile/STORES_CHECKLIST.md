# Checklist stores et terrain — Phase 11 (mobile natif)

**Date :** 2026-09-12
**Statut global :** le build Android signé est prouvé localement
(`docs/mobile/ANDROID_RELEASE.md`). **Tout le reste de ce document est
`INSUFFICIENT_DATA` : ce sont des étapes humaines non exécutées.**
Aucune publication store n'a été tentée.

> Légende : `[HUMAIN]` = action nécessitant un compte, un appareil physique, un
> Mac ou une décision humaine. `[À VÉRIFIER]` = règle store évolutive, à
> revalider dans la console au moment de la soumission.

---

## 1. Google Play Console — Android

### 1.1 Compte et application

- [ ] `[HUMAIN]` Créer un compte Google Play Console (compte développeur,
      frais d'inscription uniques, identité + coordonnées à vérifier).
- [ ] `[HUMAIN]` Créer l'application `com.lekitduvoyageur.app`
      (nom « Le Kit du Voyageur », type application, gratuit/payant, catégorie).
- [ ] `[HUMAIN]` Accepter les déclarations (export US, lois locales).
- [ ] `[HUMAIN]` Activer **Play App Signing** (clé d'upload = keystore Phase 11 ;
      sauvegarde obligatoire, voir `ANDROID_RELEASE.md` §4.5).
- [ ] `[HUMAIN]` Vérifier `versionCode`/`versionName`
      (`android/app/build.gradle` : 1 / 1.0) et incrémenter à chaque envoi.

### 1.2 Fiche store (obligatoire avant revue)

- [ ] `[HUMAIN]` Titre, description courte/longue, langue principale.
- [ ] `[HUMAIN]` Icône, bannière, au moins 2 captures téléphone ; captures
      tablette si l'app est déclarée compatible (`[À VÉRIFIER]` selon les
      exigences en vigueur).
- [ ] `[HUMAIN]` **Politique de confidentialité** hébergée (URL publique
      requise — s'appuyer sur les livrables RGPD Phase 8/12).
- [ ] `[HUMAIN]` **Data Safety** : déclarer précisément les données collectées
      (position, photos, e-mail, données d'usage) et leur partage effectif.
      Toute déclaration doit correspondre au code, pas à l'intention.
- [ ] `[HUMAIN]` **Classification de contenu** (questionnaire) et public cible.
- [ ] `[HUMAIN]` Accès à l'application pour les testeurs/relecteurs si écran de
      connexion (compte de démonstration).
- [ ] `[HUMAIN]` Conformité versions : `targetSdk` ≥ niveau exigé par Google au
      moment de la soumission (ici targetSdk 36, `[À VÉRIFIER]`).

### 1.3 Tester puis publier

- [ ] `[HUMAIN]` Uploader l'AAB signé
      (`android/app/build/outputs/bundle/release/app-release.aab`) sur une piste
      **test interne**.
- [ ] `[HUMAIN]` Ajouter les testeurs et valider l'installation depuis le lien
      d'opt-in.
- [ ] `[HUMAIN]` Piste **test fermé** : respecter la règle Google pour les
      comptes personnels récents (nombre minimal de testeurs sur une durée
      continue — `[À VÉRIFIER]`, historiquement 12 testeurs / 14 jours).
- [ ] `[HUMAIN]` Corriger tout avertissement Play (taille d'AAB proche de
      150 Mo : voir `ANDROID_RELEASE.md` §1), puis promouvoir.
- [ ] `[HUMAIN]` Rollout progressif conforme au chantier :
      interne → 1 % → observation → 5 % → 20 % → 50 % → 100 %, arrêt immédiat si
      seuils d'arrêt (fuite, ETA dangereuse, batterie, coût, erreurs).

## 2. Apple / iOS — impossible sur cette machine

Prérequis matériels et comptes :

- [ ] `[HUMAIN]` **Mac avec Xcode 16+** (aucun `xcodebuild` possible sous
      Windows — ne pas tenter).
- [ ] `[HUMAIN]` Compte **Apple Developer Program** (rôles Admin/App Manager).
- [ ] `[HUMAIN]` Certificats de distribution + profils de provisionnement
      (gérés via Xcode ou App Store Connect).
- [ ] `[HUMAIN]` Identifiant de bundle `com.lekitduvoyageur.app`, `DEVELOPMENT_TEAM`
      configuré dans `ios/App/App.xcodeproj`.
- [ ] `[HUMAIN]` Créer l'app dans **App Store Connect**, remplir confidentialité
      (privacy nutrition labels), classification d'âge, conformité export
      (chiffrement), notes de revue.
- [ ] `[HUMAIN]` Archiver (`xcodebuild archive`) → upload **TestFlight** →
      test interne, puis externe (revue Beta App).
- [ ] `[HUMAIN]` Captures/fiche App Store, URL de support et de confidentialité.

État actuel vérifiable dans le dépôt : `ios/` existe, `npx cap sync` met à jour
les assets iOS, mais **aucun build iOS n'est prouvé** (pas de Mac/Xcode, pas de
certificat).

## 3. Matrice appareils physiques (obligatoire avant rollout public)

Aucun appareil n'a été testé par l'agent (pas d'accès matériel). À réaliser par
un humain, avec relevés.

| Profil | Exigence minimale | Ce qui doit être prouvé |
|---|---|---|
| Android milieu de gamme | 4–6 Go RAM, ~2022–2023, GPS lent | Démarrage < 3 s, carte fluide, caméra, GPS en arrière-plan, pas de kill mémoire |
| Android récent | 8+ Go RAM, Android 15/16 | targetSdk, permissions modernes, notifications, 5G/Wi-Fi |
| iPhone compact | petit écran (ex. gamme SE/mini) | lisibilité, zones tactiles, safe areas, clavier |
| iPhone récent | Dynamic Island/notch, iOS récent | animations, permissions, fond/foreground |
| Tablette | Android ou iPad | layout large, rotation, offlines, carte plein écran |

Par appareil, tester explicitement :

- [ ] `[HUMAIN]` Permissions : localisation (précise/approx.), caméra, photos,
      notifications — refus puis réactivation depuis Réglages.
- [ ] `[HUMAIN]` GPS : acquisition, perte de signal (tunnel/forêt), reprise,
      position en arrière-plan, économie d'énergie.
- [ ] `[HUMAIN]` Caméra : photo, import galerie, stockage plein, rotation.
- [ ] `[HUMAIN]` Réseau : Wi-Fi ↔ 4G/5G, mode avion, latence élevée, coupures,
      reprise de synchronisation sans perte de carnet (offline-first Phase 6).
- [ ] `[HUMAIN]` Notifications : réception app ouverte/fermée, deep link.
- [ ] `[HUMAIN]` Batterie : mesure avant/après session terrain (ex. 2 h de suivi
      GPS), température appareil, %/h et présence de chauffe anormale.
- [ ] `[HUMAIN]` Mémoire/stockage : espace occupé par l'app, cache, comportement
      sous 500 Mo libres.
- [ ] `[HUMAIN]` Accessibilité rapide : police système agrandie, contraste.

## 4. Tests terrain et calibration ETA

### 4.1 Protocole

- [ ] `[HUMAIN]` **30 paires ETA/réel minimum** avant rollout public, sur des
      itinéraires et profils variés (marche, vélo, dénivelé, terrain, météo).
- [ ] `[HUMAIN]` Consigner chaque paire dans le tableau ci-dessous (aucune
      donnée inventée : les valeurs réelles seules comptent).
- [ ] `[HUMAIN]` Ne pas ouvrir le rollout public si l'ETA est dangereusement
      sous-estimée (critère d'arrêt du chantier).

| # | Date | Activité | Terrain / climat / saison | Appareil | ETA prévue | Temps réel | Écart % | Réseau | Batterie départ→fin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | |
| 2 | | | | | | | | | | |
| … | | | | | | | | | | |
| 30 | | | | | | | | | | |

### 4.2 Extension après les 30 paires

- [ ] `[HUMAIN]` Étendre la calibration par **activité**, **terrain**,
      **climat** et **saison** (chantier Phase 11), avec les mêmes relevés.

## 5. Preuves attendues et gate G12

| Preuve | Responsable | État Phase 11 |
|---|---|---|
| AAB signé + `jarsigner` exit 0 | agent | **FOURNI** (local) |
| Config signature sans secret | agent | **FOURNI** |
| Upload Play test interne | humain | `INSUFFICIENT_DATA` |
| Fiche store + Data Safety + confidentialité | humain | `INSUFFICIENT_DATA` |
| Build iOS + TestFlight | humain (Mac) | `INSUFFICIENT_DATA` |
| Tests 5 profils d'appareils (batterie/mémoire/réseau) | humain | `INSUFFICIENT_DATA` |
| 30 paires ETA/réel | humain terrain | `INSUFFICIENT_DATA` |

Rappel de la gate (chantier, G12) : **aucune publication store sans build
signé, test interne et validation sur appareils physiques.** Le build signé est
acquis ; les deux autres conditions restent humaines.

## 6. Ce qui n'est pas fait et ne doit pas être revendiqué

- Aucun compte Play Console ni Apple Developer n'existe pour ce projet.
- Aucun AAB n'a été uploadé ; aucune piste de test n'existe.
- Aucun test iOS, aucun TestFlight.
- Aucun test sur appareil physique, aucune mesure batterie/mémoire/réseau réelle.
- Aucune paire ETA/réel mesurée ; aucune calibration étendue.
