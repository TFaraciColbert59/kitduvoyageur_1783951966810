# Rapport d'Enquête Technique : Compétences Externes & Pipeline de Vérification Physique iPhone 16 Pro

**Auteur** : `teamwork_explorer` (Survey Task 3)  
**Date** : 2026-11-14  
**Appareil Physique Cible** : iPhone 16 Pro (`iPhone17,1`, iOS 27.2) · UDID `00008140-000E7D081A0B001C`  
**Application** : Le Kit du Voyageur (`com.lekitduvoyageur.app`)  
**Workspace QA Appium** : `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/`  
**Workspace Projet** : `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`

---

## 1. Synthèse Exécutive

Cette enquête valide de manière empirique et exhaustive :
1. **L'écosystème des compétences externes (`npx skills`)** : cartographie et sélection des compétences les plus pointues pour le design system Apple / HIG, les primitives WebKit/CSS, l'intégration React / Next.js 15, et l'automatisation mobile.
2. **Le pipeline de test et capture physique Appium / XCUITest** : la liaison USB temps réel avec l'iPhone 16 Pro physique (UDID `00008140-000E7D081A0B001C`) est 100 % opérationnelle via Appium 3.9.0 sur le port 4723. Les tests interactifs en direct (`device.mjs start`, `tap 270 822`, `tree`, `shot`) ont confirmé in situ chaque anomalie ergonomique répertoriée dans la section 5 de l'audit iPhone.
3. **La procédure exacte de build, synchronisation et déploiement Capacitor** : architecture hybride Capacitor WKWebView, variables requises (`CAPACITOR_SERVER_URL`), scripts de synchronisation (`scripts/ios-install.sh`), et signature Xcode (Personal Team `QRU99VJUB5`).
4. **Le protocole complet de capture de recette pour `/messagerie`** : séquence automatisée en 10 étapes produisant les 14 captures d'écran Retina 3x (`1206 × 2622 px`) requises pour la recette visuelle.

---

## 2. Cartographie des Compétences Externes (`npx skills`)

L'outil `npx skills` (version 1.8.1) a été interrogé sur les registres GitHub et skills.sh. Voici la sélection ciblée et validée pour le chantier Apple / LKDV :

### 2.1. Compétences Apple & iOS Human Interface Guidelines (HIG)

| Compétence | Source / Identifiant | Description & Rôle pour le Chantier LKDV |
|---|---|---|
| **`ios-hig-design`** | `wondelai/skills@ios-hig-design` | **Référence absolue Apple HIG** : safe areas exactes (Dynamic Island 44–54pt, barre d'accueil 34pt), cibles tactiles minimales 44×44pt, typographie SF Pro (`.largeTitle`, `.title`, `.body`, `.caption`), hiérarchie sans noir pur, gestes natifs, sheet presentations et detents. |
| **`liquid-glass-design`** | `affaan-m/ecc@liquid-glass-design` | **Matériau Liquid Glass iOS 26/27** : dynamique de verre avec flou (`UIVisualEffectView`), réflexion de lumière, transitions de morphing, `GlassEffectContainer`, mode clair/accentué sans noir sombre. |
| **`apple-ui-designer`** | Projet local (`.agents/skills/apple-ui-designer`) | **Philosophie produit Apple** : système natif en priorité, calme, confiant, élimination des gimmicks, ergonomie à une main, conventions UIKit / SwiftUI. |
| **`lkdv-ios27-page-refonte`** | Projet local (`.agents/skills/lkdv-ios27-page-refonte`) | **Règles d'or LKDV** : écran principal verrouillé à `100dvh` sans scroll global, carte 406px `r=24`, split 60/40, le Drawer EST la carte (pas de modal plein écran ni voile sombre), poignée de tirage grabber `36×5pt` / `40×4px`. |

### 2.2. Primitives CSS / WebKit, Tokens & Design System

| Compétence | Source / Identifiant | Rôle & Apport Technique |
|---|---|---|
| **`safe-area-handling`** | `cap-go/capgo-skills@safe-area-handling` | Gestion rigoureuse des variables d'environnement WebKit `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `viewport-fit=cover`. |
| **`tailwind-capacitor`** | `cap-go/capgo-skills@tailwind-capacitor` | Intégration optimisée de Tailwind CSS dans les coques WKWebView Capacitor mobiles (désactivation du rebond parasite, suppression du tap highlight `-webkit-tap-highlight-color: transparent`). |
| **`design-tokens`** | `julianoczkowski/designer-skills@design-tokens` | Modélisation des tokens sémantiques et des échelles harmoniques. |
| **`oklch-skill`** | `jakubkrehel/oklch-skill@oklch-skill` | Manipulation des espaces colorimétriques modernes OKLCH pour concevoir des dégradés verts continus et vibrants sans dérive vers le gris ou le noir. |

### 2.3. Architecture React & Performance

| Compétence | Source / Identifiant | Rôle & Apport Technique |
|---|---|---|
| **`find-skills`** | `vercel-labs/skills@find-skills` | Compétence recommandée par Vercel Labs pour explorer et installer à la volée des compétences supplémentaires. |
| **`vercel-composition-patterns`** | `vercel-labs/agent-skills@vercel-composition-patterns` | Découplage des composants à forte complexité (comme les tiroirs `ComposerMenuSheet` et `ConversationOptionsSheet`) via compound components et contextes dédiés. |
| **`vercel-react-best-practices`** | `vercel-labs/agent-skills@vercel-react-best-practices` | Règles de performance React/Next.js 15 : élimination des re-rendus inutiles sur les listes de messages, scroll virtualization, containment CSS (`contain: layout paint`). |
| **`vercel-react-view-transitions`** | `vercel-labs/agent-skills@vercel-react-view-transitions` | Animations natives et transitions fluides basées sur l'API CSS/React View Transitions. |

### 2.4. Automatisation QA Mobile & Appium

| Compétence | Source / Identifiant | Rôle & Apport Technique |
|---|---|---|
| **`xcuitest-real-device-config`** | `appium/skills@xcuitest-real-device-config` | Bonnes pratiques de configuration XCUITest sur matériel iOS physique réel (gestion des timeouts WDA, signing certs, provisioning profiles). |
| **`accessibility`** | `affaan-m/ecc@accessibility` | Audit d'accessibilité WCAG 2.2 AA et VoiceOver (labels accessibles, traits `Button`, `Header`, `SearchField`). |

---

## 3. Diagnostic Live de la Page Messagerie (`/messagerie`) sur l'iPhone 16 Pro

En exécutant `device.mjs` en direct sur l'iPhone 16 Pro physique (`node device.mjs tap 270 822` puis `node device.mjs tree`), l'arbre XCUITest réel a confirmé instantanément les anomalies relevées dans l'audit initial :

### 3.1. Bouton En-tête "Messages" redirigeant vers `/compte`
- **Arbre XCUITest mesuré** :
  ```xml
  <XCUIElementTypeButton type="XCUIElementTypeButton"
    name="Messages — aller au compte"
    label="Messages — aller au compte"
    x="12" y="69" width="97" height="34" />
  <XCUIElementTypeLink type="XCUIElementTypeLink"
    name="Notifications" label="Notifications"
    x="352" y="67" width="38" height="38" />
  ```
- **Constat** : Le bouton titre porte textuellement l'accessibilité `Messages — aller au compte`. Toucher ce bouton ou la cloche navigue vers `/compte` en provoquant un flash de tiroir noir `#0d1117`.

### 3.2. Chevauchement de la Pilule de Filtres sur la Liste des Conversations
- **Arbre XCUITest mesuré** :
  ```xml
  <!-- Conversation 4 dans la liste -->
  <XCUIElementTypeButton name="Dolomites — août" x="22" y="337" width="358" height="56" />

  <!-- Barre flottante de filtres -->
  <XCUIElementTypeOther name="Filtrer les discussions" x="182" y="346" width="196" height="30">
    <XCUIElementTypeButton name="Toutes" x="184" y="348" width="49" height="26" />
    <XCUIElementTypeButton name="Directs" x="232" y="348" width="49" height="26" />
    <XCUIElementTypeButton name="Groupes" x="280" y="348" width="48" height="26" />
    <XCUIElementTypeButton name="Demandes" x="327" y="348" width="49" height="26" />
  </XCUIElementTypeOther>
  ```
- **Constat** : La barre de filtre commence à `y = 346` et termine à `y = 376`. Elle est positionnée **directement au-dessus** de la ligne "Dolomites — août" (`y = 337..393`), masquant l'expéditeur et la date.

### 3.3. Masquage du Premier Message sous le Header de la Conversation
- **Arbre XCUITest mesuré lors de l'ouverture de "Camille Rochat"** :
  ```xml
  <!-- Volet inférieur de conversation -->
  <XCUIElementTypeOther name="Conversation, région" x="0" y="394" width="402" height="480">
    <XCUIElementTypeOther value="394.00" name="Régler la hauteur..." x="157" y="396" width="88" height="22" />
    <XCUIElementTypeButton name="Camille Rochat" x="12" y="402" width="148" height="44" />
  </XCUIElementTypeOther>

  <!-- 1re bulle de message -->
  <XCUIElementTypeButton x="136" y="373" width="250" height="74" />
  ```
- **Constat** : La bulle de message commence à `y = 373` alors que l'en-tête de la conversation commence à `y = 394` et la pastille contact à `y = 402`. Le haut de la bulle passe **sous la poignée de redimensionnement et sous le nom de Camille Rochat**.

### 3.4. Ouverture Défectueuse du Tiroir `ComposerMenuSheet` (`...`)
- **Arbre XCUITest mesuré lors du tap sur le bouton `...` (`x = 316, y = 728`)** :
  ```xml
  <XCUIElementTypeOther name="Partager dans le chat, boîte de dialogue web"
    x="0" y="110" width="391" height="276">
    <XCUIElementTypeOther name="en-tête de section" x="12" y="132" width="378" height="50">
      <XCUIElementTypeStaticText value="Partager dans le chat" x="12" y="139" width="141" height="19" />
  ```
- **Constat** : Alors que l'utilisateur clique en bas à `y = 728`, le tiroir s'ouvre **en haut à `y = 110`** par-dessus la liste de discussions. Sa hauteur fixe de `276px` tronque les options inférieures (`Randonnée / Itinéraire`), et la largeur `391px` ne remplit pas l'écran (`402px`).

---

## 4. Pipeline de Build, Synchronisation et Déploiement iPhone 16 Pro

### 4.1. Architecture de l'Application Mobile
L'application iOS LKDV est une coquille native **Capacitor 8** hébergeant une `WKWebView`.
- **Fichier de configuration maître** : `capacitor.config.ts` (et son reflet généré `ios/App/App/capacitor.config.json`).
- **URL chargée par la coquille** :
  - **En production / staging** : `https://kitduvoyageur-1783951966810-ruddy.vercel.app` (ou le déploiement courant Vercel).
  - **En développement local** : `CAPACITOR_DEV_SERVER=1` avec `CAPACITOR_SERVER_URL=http://<IP_MAC>:4000` (cleartext autorisé uniquement en mode dev).
- **Conséquence clé pour le développement** :
  Les modifications visuelles de routes web (React, CSS, Tailwind) déployées sur le serveur cible sont **immédiatement reflétées dans l'application iPhone** au rechargement de la WebView sans qu'il soit nécessaire de recompiler le binaire natif Xcode.
  La recompilation Xcode n'est requise que lors d'ajouts de plugins Capacitor natifs ou de modifications dans `ios/App/App`.

### 4.2. Procédure de Synchronisation & Déploiement Binaire (Voie Xcode / devicectl)

Le script de référence `scripts/ios-install.sh` orchestre le cycle complet :

```bash
# Variables d'environnement
export UDID="00008140-000E7D081A0B001C"
export SERVER_URL="https://kitduvoyageur-1783951966810-ruddy.vercel.app"
export DERIVED="/tmp/lkdv-dd"

# 1. Vérification de la disponibilité physique de l'iPhone 16 Pro
xcrun devicectl list devices | grep -q "$UDID.*connected"

# 2. Synchronisation des assets et configuration Capacitor
CAPACITOR_SERVER_URL="$SERVER_URL" npx cap sync ios

# 3. Compilation signée Xcode (Debug, appareil physique avec Personal Team QRU99VJUB5)
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination "id=$UDID" \
  -allowProvisioningUpdates \
  -derivedDataPath "$DERIVED" build

# 4. Installation de l'IPA Debug sur l'iPhone via devicectl
APP="$DERIVED/Build/Products/Debug-iphoneos/App.app"
xcrun devicectl device install app --device "$UDID" "$APP"

# 5. Lancement de l'application sur l'appareil
xcrun devicectl device process launch --device "$UDID" com.lekitduvoyageur.app
```

---

## 5. Procédure Automatisée de Test et Capture d'Écran Appium

### 5.1. État de l'Infrastructure QA
- **Serveur Appium** : Appium 3.9.0 actif sur `http://127.0.0.1:4723`.
- **Pilote XCUITest** : `appium-xcuitest-driver@12.22.8`.
- **Session active** : enregistrée dans `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/.session.json`.
- **Résolution physique de capture** : 402 × 874 pt à l'échelle 3x Retina = **1206 × 2622 px**.

### 5.2. Protocole de Capture de Recette pour `/messagerie`

Pour valider l'ensemble des corrections sur l'appareil physique, la suite de scripts exécute le parcours ordonné ci-dessous :

| ID Capture | Action & État Déclenché | Fichier Image de Sortie | Objectif de Vérification |
|---|---|---|---|
| **00** | Clic sur Tab Bar index 3 (`x=270, y=822`) | `00-messagerie-main.png` | Vérifier absence de redirection vers `/compte`, pas de flash noir, position propre de la pilule `Toutes`. |
| **01a** | Clic sur l'onglet `Groupes` | `01-messagerie-tab-groupes.png` | Liste des groupes affichée sans chevauchement. |
| **01b** | Clic sur l'onglet `Notifications` | `01-messagerie-tab-notifications.png` | Pas de redirection vers `/compte`, fil des notifications propre. |
| **02a** | Clic sur pilule filtre `Directs` (`x=232, y=348`) | `02-messagerie-filter-directs.png` | Filtrage dynamique sans déplacement d'autres blocs. |
| **02b** | Clic sur pilule filtre `Groupes` (`x=280, y=348`) | `02-messagerie-filter-groupes.png` | Filtrage propre des groupes. |
| **02c** | Clic sur pilule filtre `Demandes` (`x=327, y=348`) | `02-messagerie-filter-demandes.png` | **Un seul état vide**, texte du bouton d'action lisible (contraste conforme, pas de noir sur vert foncé). |
| **02d** | Re-clic sur filtre `Toutes` (`x=184, y=348`) | `02-messagerie-toutes.png` | Restauration propre de la liste complète. |
| **03** | Clic sur bouton "Nouvelle discussion" | `03-messagerie-nouvelle-discussion-tap.png` | Ouvre le sélecteur modal de destinataires (au lieu de focaliser la recherche). |
| **04** | Clic sur conversation "Camille Rochat" | `04-messagerie-conv-camille-rochat.png` | En-tête contact avec bouton fermer/options, **1er message non tronqué** sous la poignée. |
| **05** | Clic sur conversation "Voyageur LKDV" | `05-messagerie-conv-voyageur-lkdv.png` | Vérification des bulles et horodatages. |
| **06** | Clic sur groupe "Bivouac de printemps" | `06-messagerie-conv-groupe-bivouac.png` | **Pas de blocage sur squelettes gris**, pas de carte d'erreur "Publication indisponible". |
| **07** | Clic sur bouton `+` / `...` (`x=316, y=728`) | `07-messagerie-composer-menu-sheet.png` | **Ouvre en bottom sheet** (bas de l'écran `y=500..850`), padding gauche conforme, cartes complètes. |
| **08** | Clic sur en-tête conversation | `08-messagerie-conversation-options-sheet.png` | Options utiles (sourdine, blocage, suppression), pas de bouton redondant "Écrire un message". |
| **09** | Appui long sur une bulle de message (850ms) | `09-messagerie-message-longpress.png` | Barre d'emojis de réaction visible sans coupure haute par le volet de conversation. |

### 5.3. Script d'Exécution Unique Recommandé

Pour lancer cette suite de captures d'un seul trait lors de la phase de validation :
```bash
cd /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa
node crawl-communaute-messagerie-deep.mjs
node crawl-finish-all-pages.mjs
```
Les captures générées sont immédiatement stockées dans :
`/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/`
et consultables en pleine résolution Retina 3x (`1206 × 2622 px`).

---

## 6. Banque de Tokens & Primitives Recommandées pour l'Implémentation

Pour garantir la conformité stricte aux exigences Apple & LKDV sans aucun noir pur :

1. **Tokens Centraux (`src/design/bank.ts`)** :
   - Fond d'écran : `--lkv-surface-canvas: #FBFAF6`
   - Cartes et panneaux : `--lkv-surface-card: #FFFFFF` avec verre Liquid Glass (`linear-gradient(180deg, rgba(255,255,255,0.486), rgba(255,255,255,0.384))`, `backdrop-filter: blur(25.2px) saturate(1.8)`)
   - Encre primaire : `--lkv-text-primary: #172B24` (WCAG AAA, zéro `#000000`)
   - Encre secondaire : `--lkv-text-secondary: #56665D` (WCAG AA)
   - Accent marque : `--lkv-brand-primary: #17402C`, `--lkv-brand-action: #226148`
   - Poignée de tirage grabber : barre `36 × 5pt` (ou `40 × 4px`), couleur `rgba(23, 43, 36, 0.35)`
   - Arrondis continus : `border-radius: 24px` (carte hôte), `14px` (capsules et boutons)

2. **Primitives Typographiques WebKit** :
   - `-apple-system-headline` pour les en-têtes de conversation
   - `-apple-system-body` pour le corps des messages
   - `-apple-system-subheadline` pour les aperçus de messages
   - `-apple-system-caption1` pour les horodatages et statuts de lecture

3. **Génération multi-cibles** :
   Après modification de `src/design/bank.ts`, synchroniser immédiatement l'ensemble des cibles avec :
   ```bash
   npm run design:generate
   ```
   qui met à jour simultanément CSS, TypeScript, Tailwind, Swift (`DesignTokens.generated.swift`) et Android XML/Kotlin.
