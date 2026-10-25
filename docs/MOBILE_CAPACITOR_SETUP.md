# LKDV — Guide Complet de Configuration et Déploiement Capacitor (iOS & Android)

Ce guide décrit l'architecture, la configuration et les commandes nécessaires pour développer, tester et compiler l'application mobile **Le Kit du Voyageur** sur iOS (iPhone/iPad) et Android.

---

## 1. 📋 Prérequis

### Tous environnements (Windows / macOS / Linux) :
- Node.js >= 18.x
- npm >= 9.x
- Dépendances du projet installées (`npm install`)

### Pour compiler iOS (Obligatoire : macOS) :
- macOS avec **Xcode 15+** installé
- CocoaPods (`sudo gem install cocoapods`) ou Swift Package Manager (géré automatiquement par Capacitor 8)
- Compte Apple Developer (gratuit pour tester sur son propre iPhone, payant pour l'App Store)

### Pour compiler Android (Windows / macOS / Linux) :
- **Android Studio** installé avec Android SDK (API level 33+)
- Java JDK 17+

---

## 2. ⚙️ Configuration du Projet

### Identifiants de l'Application :
- **Nom de l'App :** `Le Kit du Voyageur`
- **App ID (Bundle Identifier) :** `com.lkdv.app`
- **Fichier de configuration :** `capacitor.config.ts`

### Plugins Natifs Installés :
- `@capacitor/app` : Cycle de vie, bouton retour matériel Android, deep links
- `@capacitor/camera` : Prise de vue terrain & sélection de photos
- `@capacitor/geolocation` : GPS haute précision & suivi d'itinéraire
- `@capacitor/haptics` : Retours haptiques Taptic Engine iOS & moteur vibrant Android
- `@capacitor/keyboard` : Redimensionnement automatique & style sombre
- `@capacitor/network` : Détection en temps réel de l'état online/offline
- `@capacitor/preferences` : Stockage persistant sécurisé
- `@capacitor/splash-screen` : Écran de démarrage personnalisé vert forêt (`#17402C`)
- `@capacitor/status-bar` : Style sombre translucide sur Dynamic Island & encoche

---

## 3. 🚀 Commandes de Développement et de Build

### Commandes Quotidiennes (Scripts npm intégrés) :

```bash
# 1. Développement web standard
npm run dev

# 2. Build Next.js & synchronisation des assets avec Capacitor
npm run mobile:build

# 3. Synchronisation rapide des plugins et assets (sans rebuild complet)
npm run mobile:sync

# 4. Ouvrir le projet dans Xcode (macOS uniquement)
npm run mobile:open:ios

# 5. Ouvrir le projet dans Android Studio (Windows / macOS)
npm run mobile:open:android
```

---

## 4. 🍎 Procédure de Déploiement sur iPhone (macOS + Xcode)

1. Ouvrir le projet dans Xcode :
   ```bash
   npx cap open ios
   ```
2. Dans le panneau de gauche de Xcode, sélectionner la racine du projet **App**.
3. Dans l'onglet **Signing & Capabilities** :
   - Sélectionner votre compte dans **Team**.
   - Vérifier que le **Bundle Identifier** est bien `com.lkdv.app`.
   - Cocher **Automatically manage signing**.
4. Connecter votre iPhone par câble ou via le réseau Wi-Fi local.
5. Dans la barre supérieure de Xcode, sélectionner votre iPhone comme cible d'exécution.
6. Cliquer sur le bouton **Play (Run)** ou presser `Cmd + R`.
7. Lors du premier lancement sur l'iPhone : aller dans *Réglages > Général > Gestion des appareils* et approuver le certificat développeur.

---

## 5. 🤖 Procédure de Déploiement sur Android (Android Studio)

1. Ouvrir le projet dans Android Studio :
   ```bash
   npx cap open android
   ```
2. Laisser Gradle synchroniser les dépendances (`Sync Project with Gradle Files`).
3. Connecter un appareil Android en mode *Débogage USB* ou démarrer un émulateur Android.
4. Cliquer sur le bouton vert **Run 'app'** (`Shift + F10`).

---

## 6. 🌐 Mode Live Reload pour le Développement Mobile

Pour tester vos modifications en direct sur un iPhone ou un appareil Android sans devoir relancer un build complet à chaque fois :

1. Lancer le serveur Next.js en écoute sur votre réseau local :
   ```bash
   # Remplacez 192.168.1.X par votre adresse IP locale sur votre Wi-Fi
   npm run dev -- -H 0.0.0.0
   ```
2. Définir la variable d'environnement `CAPACITOR_SERVER_URL` avant de synchroniser :
   ```bash
   # Windows (PowerShell) :
   $env:CAPACITOR_SERVER_URL="http://192.168.1.X:4000"; npx cap sync

   # macOS / Linux :
   CAPACITOR_SERVER_URL="http://192.168.1.X:4000" npx cap sync
   ```
3. Lancer l'application dans Xcode ou Android Studio. Toute modification de votre code Next.js s'actualisera en direct sur le téléphone tout en conservant l'accès aux API natives de Capacitor !

---

## 7. 🔒 Sécurité et Bonnes Pratiques

- **Aucun secret d'API** privé (`SUPABASE_SERVICE_ROLE_KEY`, clés Stripe secrètes) n'est injecté dans le bundle client mobile.
- Seules les variables publiques `NEXT_PUBLIC_*` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont accessibles côté client.
- Les requêtes d'écriture et opérations sensibles passent par les politiques RLS Supabase ou par les API routes sécurisées.
