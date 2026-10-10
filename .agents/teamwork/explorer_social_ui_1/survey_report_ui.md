# Rapport d'Audit & Architecture UI — « LKDV Social »
**Auteur** : `explorer_social_ui_1` (UI, Live Cards & Expedition Rooms Specialist)  
**Date** : 2026-10-04  
**Statut** : Rapport d'investigation UI / UX & Spécification technique d'architecture  
**Cible** : `src/features/messaging/`, `src/components/clubs/`, `src/components/groupes/`, `src/features/terrain-live/`, `src/features/kits/`, `src/styles/tokens.css`

---

## 1. Synthèse Exécutive

L'objectif de cette mission est de définir et spécifier l'architecture Frontend / UI pour **« LKDV Social »**, le système unifié de messagerie et de communauté outdoor d'aventure de *Le Kit du Voyageur*.

### Constat Majeur du Socle Existant
1. **Un socle canonique de messagerie solide mais limité** (`src/features/messaging/`) :
   - Dispose déjà d'une gestion moderne du chat (DMs, groupes, bulles iMessage-like avec réactions, swipe-to-reply, notes vocales, envoi GPX / produits / randonnées / kits).
   - Utilise une vue split-pane desktop (`MessageInbox.tsx`) et une vue plein écran mobile avec gesture back-guard et keyboard insets (`useKeyboardInset`).
   - **Gaps majeurs** : Les objets outdoor ne sont pas encore optimisés en snapshots (le GPX refait un `fetch` + parsing XML à chaud côté client), la carte de Kit ne dispose pas de l'action **Pack Merge**, il n'existe pas de cartes d'Expédition vivantes, et aucune intégration d'Expedition Rooms unifiée ou de Terra AI n'est présente.
2. **Une fragmentation historique entre Groupes et Messagerie** :
   - `src/components/groupes/` contient des briques riches pour les expéditions (`HeroVoyage`, `ParcoursCard`, `EquipementCard`, `TachesCard`, `DecisionsCard`), mais utilise une table legacy séparée (`group_messages`) avec un composant `DiscussionCard.tsx` déconnecté du flux canonique de messagerie.
   - Les clubs (`src/components/clubs/`) reposent sur des sujets de forum asynchrones (`topics`) et non sur des salons thématiques interactifs en temps réel (`#général`, `#matériel`, `#sorties`, `#sécurité`).
3. **Règle absolue d'architecture** :
   - **Aucun système parallèle ne doit être créé**. Les espaces communautaires (clubs, salons thématiques) et les *Expedition Rooms* doivent s'adosser directement sur l'infrastructure canonique de `src/features/messaging` (tables `conversations`, `messages`, `conversation_members`), tout en enrichissant l'UI d'un système de **Live Cards** et d'un layout **multi-pane réactif** respectant scrupuleusement les tokens **Liquid Glass** et les Human Interface Guidelines d'Apple.

---

## 2. Audit Détaillé du Codebase Existant

### 2.1 Socle de Messagerie Canonique (`src/features/messaging/`)

| Composant / Fichier | Responsabilité Actuelle | Réutilisabilité / Évolution Requise |
|---|---|---|
| `MessageBubble.tsx` | Rendu des bulles (iOS style), réactions emoji (iMessage palette), swipe-to-reply (Instagram style), long-press, avatars, statuts de lecture. | **Très haute réutilisabilité**. Doit être étendu pour router les nouveaux types de Live Cards (`expedition`, `terra_draft`, `field_checkin`, `kit_pack_merge`). |
| `MessageList.tsx` | Conteneur de discussion avec regroupement par tranche de 2 minutes, séparateurs de date, autoscroll contextuel et détection near-bottom. | **Réutilisable**. Doit accueillir la bannière flottante "Quiet Catch-Up" de Terra AI sans perturber le scroll virtuel. |
| `MessageComposer.tsx` | Barre d'écriture mobile/desktop avec safe-area, auto-resize textarea (44px à 132px), bouton photo direct, bouton dictaphone, menu contextuel `•••`. | **Très haute réutilisabilité**. Étendre le menu contextuel pour insérer directement un Tracé d'Expédition, un Check-in terrain, ou mentionner Terra. |
| `ComposerMenuSheet.tsx` | Bottom sheet iOS pour sélectionner GPX, Équipement personnel, Randonnée, ou Kit. | **Réutilisable**. Ajouter l'option d'attacher une fiche Expédition ou un signalement terrain. |
| `ConversationView.tsx` | Header avec safe-area iOS, affichage membre / groupe, orchestration messages + composer. | **Réutilisable**. Servira de brique de base pour le panneau conversationnel des Expedition Rooms et des salons de club. |
| `ConversationList.tsx` & `ConversationRow.tsx` | Liste des échanges avec filtres (Tous, Non lus, Groupes), badge d'inactivité/demandes en attente. | **Réutilisable**. Doit pouvoir filtrer par Clubs et Expéditions actives. |
| `messaging.types.ts` | Types TypeScript canoniques (`Conversation`, `Message`, `MessageType`, `MemberRole`). | **À enrichir** : étendre `ConversationType` ('club_channel', 'expedition'), `MessageType` ('expedition_card', 'field_checkin', 'terra_draft', 'terra_summary'), et `MemberRole` ('owner', 'admin', 'guide', 'safety', 'member'). |

### 2.2 Objets Outdoor Existants

| Composant | Fichier Source | État des Lieux & Limitations Actuelles |
|---|---|---|
| `GPXPreviewCard.tsx` | `features/messaging/components/GPXPreviewCard.tsx` | **Problème de performance** : Effectue un `fetch(gpxUrl)` et appelle `GPXEngine.parseGPX(text)` côté client à chaque affichage. Dans un fil de 50 messages, génère des requêtes réseau redondantes et des re-renders lourds. Doit utiliser un **snapshot précalculé** stocké dans `message.metadata` (distance, D+, min/max ele, mini polyline SVG). |
| `KitCard.tsx` | `features/messaging/components/KitCard.tsx` | **Trop basique** : Affiche uniquement `Kit · lignée`, le nom du kit, et "Voir la lignée →". Manque l'affichage du poids total, du nombre d'articles, de l'état de validation terrain, et de l'action centrale **Pack Merge**. |
| `TrailCard.tsx` | `features/messaging/components/TrailCard.tsx` | Carte cliquable avec distance, D+, région. Propre et compacte, bon modèle pour les Live Cards. |
| `ProductCard.tsx` | `features/messaging/components/ProductCard.tsx` | Carte équipement avec photo, badge et prix/catégorie. Propre et responsive. |
| `KitSheetModal.tsx` | `features/kits/components/KitSheetModal.tsx` | Fiche complète du kit (lignée, trust score, équipement, fork, export). Référence pour le drawer d'inspection de kit. |
| `TraceMiniMap.tsx` | `features/trips/components/TraceMiniMap.tsx` | Rendu SVG projeté ultra-léger et déterministe d'un tracé GPS avec halo lumineux. Idéal pour le snapshot instantané de tracé GPX ! |
| `WeatherStrip.tsx` | `features/hub/components/weather/WeatherStrip.tsx` | Bandeau météo réelle Open-Meteo avec mode `capsule` (flottant) et mode `strip` (complet). Zéro fausse donnée, respect strict des tokens LKDV. Prêt pour intégration directe en Expedition Room. |
| `QuickReportSheet.tsx` | `features/terrain-live/components/QuickReportSheet.tsx` | Signalement terrain en 3 gestes (catégorie, gravité, confirmation) avec 44px min et respect des safe-areas. Parfait pour les Field Check-ins en expédition. |

### 2.3 Espaces Clubs & Cockpits de Groupe

| Composant | Fichier Source | État des Lieux & Rapprochement Nécessaire |
|---|---|---|
| `MobileClubsHub.tsx` | `components/clubs/MobileClubsHub.tsx` | Hub de découverte des clubs avec recherche, filtres catégories, pull-to-refresh et cartes compactes. |
| `MobileClubDetailView.tsx` | `components/clubs/MobileClubDetailView.tsx` | Vue détaillée avec couverture, statut membre, onglets (Vue d'ensemble, Sorties, Groupes, Discussions, Membres). Actuellement, "Discussions" est un fil de topics asynchrones. Doit intégrer des **salons thématiques de messagerie** (Channels). |
| `ClubTeamCard.tsx` | `components/clubs/ClubTeamCard.tsx` | Liste l'équipe d'animation du club, mais ne distingue que `admin` et `moderator`. Doit refléter les 5 rôles modulaires LKDV : Propriétaire, Admin, Guide, Sécurité, Membre. |
| `HeroVoyage.tsx` | `components/groupes/HeroVoyage.tsx` | En-tête riche d'une expédition : compte à rebours J-X, métriques (jours, km, D+, nombre de membres), badge de saison, actions d'invitation. Parfait pour le bandeau d'Expedition Room. |
| `ParcoursCard.tsx` | `components/groupes/ParcoursCard.tsx` | Carte Leaflet interactive avec polyline et profil altimétrique. Prête pour l'onglet Itinéraire de l'Expedition Room. |
| `EquipementCard.tsx` | `components/groupes/EquipementCard.tsx` | Liste collaborative du matériel avec attribution par voyageur, catégories, poids en grammes, distinction matériel personnel vs partagé, et import depuis inventaire/kits. Base idéale pour la logique Pack Merge ! |
| `DecisionsCard.tsx` | `components/groupes/DecisionsCard.tsx` | Sondages et décisions collectives avec quorum, pourcentage de votes et résolution formelle. |
| `TachesCard.tsx` | `components/groupes/TachesCard.tsx` | Checklist partagée avec assignation et états À faire / Fait. |

---

## 3. Architecture des Objets Outdoor de Premier Rang & « Live Cards »

### 3.1 Problématique de Saturation du Flux de Chat
Dans une messagerie temps réel mobile, afficher des cartes complexes (cartes interactives Leaflet/MapLibre, listes complètes de matériel, formulaires) directement dans le flux des bulles entraîne :
- Une dégradation critique du scroll (saccades, layout thrashing, perte de 60fps).
- Une consommation excessive de mémoire et de requêtes réseau (si chaque carte charge sa propre ressource distante).
- Un étirement vertical démesuré qui noie les échanges textuels.

### 3.2 Principe des Live Cards : « Snapshot Compact + Action Sheet »
Chaque objet outdoor partagé en discussion adopte un contrat en **deux niveaux d'abstraction** :
1. **Niveau 1 — Snapshot Compact dans le thread** :
   - Hauteur contenue (hauteur max : 140px à 180px).
   - Rendu 100 % passif et instantané à partir du champ `message.metadata` (aucun appel réseau au scroll).
   - Utilisation de SVG précalculé pour les tracés, d'indicateurs synthétiques (badges, compteurs, jauges de poids) et de typographie système.
   - 1 action primaire contextuelle + 1 zone tapable pour ouvrir la vue détaillée en Sheet ou Modal.
2. **Niveau 2 — Vue Détaillée en Bottom Sheet / Drawer** :
   - Déclenchée au clic sur la carte ou sur son action secondaire.
   - Affichage interactif complet (carte vectorielle dynamique, zoom profil, fusion interactive d'articles, vote de décision).

```
┌────────────────────────────────────────────────────────┐
│ [Thread de discussion]                                  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🎒 Kit de Traversée Estivale (Ultralight 8.2 kg)  │  │
│  │ 24 articles · Conçu par Sarah · Vérifié terrain  │  │
│  │ [ Jauge Poids: 8.2 kg ] [ 3 articles mutualisables]│ │
│  │ ┌───────────────────────────┐ ┌────────────────┐ │  │
│  │ │ ⚡ Pack Merge (Fusionner)  │ │ Voir détails → │ │  │
│  │ └───────────────────────────┘ └────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
                           │ Tap "Pack Merge"
                           ▼
┌────────────────────────────────────────────────────────┐
│ [Bottom Sheet iOS : Pack Merge Studio]                 │
│  Comparaison instantanée : Kit partagé vs Votre Sac    │
│  • Doublons évités : 2 réchauds détectés (-380g)       │
│  • Manques comblés : Filtre à eau partagé              │
│  [ Bouton : Fusionner dans l'expédition (44px) ]       │
└────────────────────────────────────────────────────────┘
```

### 3.3 Spécification des 4 Cartes Outdoor Canoniques

#### A. Carte GPX Snapshot (`GPXSnapshotCard`)
- **Contenu du Snapshot** :
  - Nom de la trace, distance totale (km), dénivelé positif cumulé (m D+), altitude min/max (m), durée estimée.
  - Mini tracé vectoriel SVG généré par `TraceMiniMap` (lignes de dégradé vert forêt, halo blanc de contraste, points de départ/arrivée contrastés).
- **Actions** :
  - Action primaire : *Explorer sur la carte* (ouvre la trace dans le viewer interactif plein écran avec profil altimétrique).
  - Action secondaire : *Télécharger le .gpx* (mise en cache hors-ligne Dexie/PWA).

#### B. Carte Kit avec Action Pack Merge (`KitLiveCard`)
- **Contenu du Snapshot** :
  - Nom du kit, génération de lignée, créateur/guide, score de confiance terrain (`trustScore`).
  - Nombre total d'articles, poids total pesé (kg), jauge de catégorie (Bivouac, Sécurité, Cuisine).
  - Statut de mutualisation (ex: *"3 pièces partagées dans le groupe"*).
- **Action « Pack Merge »** :
  - Ouvre une feuille dédiée (`PackMergeSheet`) permettant de :
    1. Comparer les équipements du kit avec le sac actuel de l'utilisateur ou la checklist du groupe.
    2. Détecter automatiquement les redondances (ex: deux tentes 2 places, doublon de filtre à eau, deux réchauds à gaz).
    3. Cocher les équipements à "mutualiser" (assignés à un membre spécifique pour alléger les autres).
    4. Calculer le gain de poids individuel et collectif en direct.
    5. Enregistrer les modifications dans la checklist partagée de l'Expedition Room.

#### C. Carte Pièce d'Équipement (`EquipmentPieceCard`)
- **Contenu du Snapshot** :
  - Photo produit nette (ratio 1:1 ou miniature 64x64 avec fallback).
  - Nom de l'équipement, marque, poids exact (g), catégorie outdoor.
  - Propriétaire actuel ou statut de disponibilité (*"Disponible pour prêt"*, *"Assigné à Thomas"*).
- **Actions** :
  - Bouton *Emprunter / Assigner à mon sac* (action 1-tap avec haptic feedback).
  - Lien vers la fiche technique complète de l'inventaire.

#### D. Carte Expédition (`ExpeditionLiveCard`)
- **Contenu du Snapshot** :
  - Titre de l'expédition, massif/région, badge de niveau de difficulté (Facile, Modéré, Exigeant, Alpin).
  - Date de départ, compte à rebours compact (`J-12`), météo prévue sommaire.
  - Avatars empilés des participants inscrits (+ badge places restantes : *"3/6 places"*).
  - Mini polyline de l'itinéraire prévu.
- **Actions** :
  - *Rejoindre l'expédition* (si ouverte) ou *Ouvrir la salle d'expédition* (Expedition Room).

---

## 4. Espaces Communautaires & Salons de Club (Thematic Channels & Roles)

### 4.1 Structure de Navigation d'un Club Outdoor
Un club LKDV regroupe des passionnés par discipline ou par territoire géographique. Son architecture d'échange doit dépasser le simple mur de posts pour proposer une **organisation en salons thématiques temps réel** :

```
Club : « Les Alpinistes du Mercantour »
├── 🧭 Salons Thématiques (Channels canoniques adossés à messaging) :
│   ├── # general             (Échanges informels, accueil des nouveaux)
│   ├── # materiel-bivouac    (Partages de kits, tests de réchauds, Pack Merge)
│   ├── # sorties-prevues     (Propositions d'aventures, cartes d'expéditions)
│   └── # meteo-securite      (Vigilance terrain, comptes-rendus de conditions)
├── 📅 Événements & Sorties collectives
└── 🛡️ Annuaire des Membres avec Rôles Modulaires
```

### 4.2 Matrice des Rôles & Badges Visuels

Pour valoriser l'encadrement en montagne et la sécurité collective, LKDV Social définit 5 rôles distincts, affichés de façon cohérente dans les en-têtes de message, la liste des membres et le cockpit de club :

| Rôle LKDV | Identifiant | Badge Visuel & Teinte | Icône | Prérogatives Principales |
|---|---|---|---|---|
| **Propriétaire** | `owner` | Vert forêt de marque (`var(--lkv-primary)`), texte blanc | 👑 Couronne | Gestion administrative totale du club, transfert de propriété, archivage de salons, suppression. |
| **Administrateur** | `admin` | Sauge profond (`tone="sage"`), bordure dorée | 🛡️ Bouclier | Modération des messages, gestion des adhésions, création et gestion des salons thématiques et événements. |
| **Guide** | `guide` | Ciel alpin (`tone="info"`), pastille azur | 🏔️ Piolet / Sommet | Création et animation d'expéditions officielles, validation des tracés GPX de référence, accompagnement terrain. |
| **Sécurité** | `safety` | Ambre / Avertissement (`tone="warn"`), bordure signalétique | 🩹 Croix secours / Oeil | Validation des équipements obligatoires, publication d'alertes météo et de danger terrain, pilotage des check-ins. |
| **Membre** | `member` | Neutre translucide (`tone="stone"`) | 🥾 Chaussure / Aventurier | Participation aux discussions, partage de kits et d'itinéraires, vote aux sondages, inscription aux sorties. |

### 4.3 Composants d'Interface pour les Clubs
1. `ClubChannelPicker` : Barre de sélection horizontale (mobile) ou arborescence latérale (desktop) avec pastilles de messages non lus (`unread_count`) par salon.
2. `ClubRoleBadge` : Composant micro-typographique réutilisable combinant l'icône, le libellé court et la couleur sémantique du rôle, dimensionné pour s'insérer harmonieusement à côté du nom de l'auteur dans `MessageBubble`.
3. `ClubMembersRosterSheet` : Tiroir de consultation et de gestion des rôles avec boutons d'élévation de privilèges réservés aux administrateurs.

---

## 5. Expedition Rooms : Cockpit Unifié de Sortie Terrain

### 5.1 Concept : La Salle d'Expédition Multi-Surfaces
Une *Expedition Room* réunit tout le cycle de vie d'une aventure outdoor dans une **surface unique, synchronisée et tout-en-un**. Elle évite aux participants de jongler entre une application de messagerie externe, une application météo, une visionneuse GPX et un tableur de matériel.

### 5.2 Expérience Responsive & Multi-Panneaux

#### A. Expérience Mobile (Écran Unique avec Plateaux Glissants & Tabs)
Sur smartphone, l'espace d'écran vertical est précieux. L'Expedition Room propose :
- **Top Bar immersive** : Titre de l'expédition, date J-X, capsule météo compacte cliquable (`WeatherStrip variant="capsule"`), bouton SOS / Check-in rapide.
- **Conteneur Principal** : Fil de discussion canonique temps réel (`MessageList`) avec les Live Cards intégrées.
- **Segmented Control iOS flottant au-dessus du Composer** :
  1. `Discussion` (vue par défaut)
  2. `Itinéraire & Trace` (bascule vers la vue carte interactive + profil D+)
  3. `Matériel & Sacs` (ouvre la checklist partagée avec répartition des charges)
  4. `Check-ins & Sécurité` (journal des points de passage terrain validés)
- **Barre d'Action Basse** : `MessageComposer` avec accès rapide en 1-tap aux check-ins et aux kits.

#### B. Expérience Tablette & Desktop (Disposition Dual / Tri-Pane)
Sur écran large, l'Expedition Room exploite un layout multi-colonnes inspiré des cockpits d'aviation et d'alpinisme moderne :
- **Colonne Gauche (380px)** : Fil de discussion temps réel, composer et fil de messages.
- **Colonne Centrale (Flexible)** : Carte vectorielle dynamique plein format affichant la trace GPX, la position actuelle des membres si partagée, les POIs (refuges, sources d'eau, cols) et les signalements Terrain Live.
- **Colonne Droite (360px)** : Cockpit d'expédition interactif composé de 3 modules empilés :
  1. *Module Météo & Conditions* : Prévisions Open-Meteo à 4 jours, isotherme 0°C, indice UV, vent en crête.
  2. *Module Checklist Matériel & Pack Merge* : Barre de progression de paquetage, jauge de poids total, répartition du matériel commun.
  3. *Module Décisions & Sondages actifs* : Sondages en cours pour le choix des variantes d'itinéraire ou des horaires de départ.

### 5.3 Les 4 Piliers Fonctionnels de l'Expedition Room

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        EXPEDITION ROOM : MONT BLANC 2026                      │
├───────────────────────────────────────┬───────────────────────────────────────┤
│ 1. CONVERSATION LIVE                  │ 2. CARTE & ITINÉRAIRE INTERACTIF      │
│ • Messages chiffrés & temps réel      │ • Trace GPX avec profil d'élévation   │
│ • Cartes de Kit (Pack Merge)          │ • POIs d'eau potable et refuges       │
│ • Sondages de décisions de groupe     │ • Points de passage horodatés         │
│ • Terra AI Quiet Catch-Up             ├───────────────────────────────────────┤
│                                       │ 3. MÉTÉO & CONDITIONS EN TEMPS RÉEL   │
│                                       │ • Open-Meteo 4 jours (Temp, Pluie, Vent)│
│                                       │ • Alertes vigilance montagne          │
│                                       ├───────────────────────────────────────┤
│                                       │ 4. CHECKLIST PARTAGÉE & CHECK-INS     │
│                                       │ • Répartition matériel (Tente, Réchaud)│
│                                       │ • Jauge de poids cumulé               │
│                                       │ • Bouton « Check-in Col » (GPS 3-tap) │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

1. **Conversation Canonique** : Hérite de `ConversationView`, enrichie des commandes spécifiques à l'expédition.
2. **Widget Météo Alpin** : Intègre `WeatherStrip` avec données réelles Open-Meteo, alertes de vent en altitude et risque d'orage.
3. **Checklist Collaborative & Jauge de Poids** :
   - Tableau interactif des pièces d'équipement partagées (`EquipementCard` réarchitecturé).
   - Indicateur visuel de complétude (ex: *"18/22 équipements vérifiés"*).
   - Poids total réparti par participant pour éviter qu'un membre ne porte une charge disproportionnée.
4. **Journal des Check-ins Terrain** :
   - Utilise `QuickReportSheet` pour consigner des points de passage (*"Col de la Vanoise franchi à 11h20, conditions sèches"*).
   - Horodatage certifié, coordonnées GPS formatées, indicateur visuel de sécurité pour rassurer le groupe et les contacts d'urgence.

---

## 6. Intégration de l'IA Terra & Réputation Collaborative

### 6.1 Principes Fondamentaux de Sécurité & Respect de l'Utilisateur
- **Présence explicite** : Terra n'intervient jamais de manière intrusive ou automatisée sans sollicitation contextuelle.
- **Isolation stricte** : Terra n'a accès qu'au contexte strict de la conversation active.
- **Règle d'or du Brouillon (Draft-Only)** : **Aucune action proposée par Terra n'est exécutée sans confirmation explicite d'un utilisateur**. Toute création de sondage, modification de checklist ou création d'expédition reste sous forme de carte brouillon nécessitant un tap humain (*Confirmer* / *Refuser*).
- **Transparence absolue des citations** : Toute affirmation ou synthèse de Terra cite précisément ses messages sources, avec lien direct vers la bulle d'origine.

### 6.2 Composants UI Dédiés à Terra

#### A. Tiroir de Rattrapage Discret (« Quiet Catch-Up Drawer »)
- **Déclencheur UI** : Lorsque l'utilisateur ouvre une conversation ou une Expedition Room contenant des messages non lus (> 10 messages ou > 12h d'absence), une pilule discrète apparaît en haut du fil de messages :
  ```
  ┌────────────────────────────────────────────────────────┐
  │  ✨ Résumé Quiet Catch-Up (18 messages non lus)  [ Lire ]│
  └────────────────────────────────────────────────────────┘
  ```
- **Structure du Bottom Sheet / Drawer** :
  1. *Points clés discutés* (3 puces concises résumant les échanges).
  2. *Décisions adoptées* (ex: *"Départ fixé à 06h30 au parking supérieur"*).
  3. *Questions en suspens* (ex: *"Qui apporte la corde de rappel de 50m ?"*).
  4. *Actions à mener* (ex: *"Alex doit valider la trace GPX"*).
  5. *Citations sources* (liens cliquables vers les messages concernés).
  6. Bouton d'action : *"Marquer tout comme lu et fermer"*.

#### B. Carte de Validation d'Action Brouillon (« TerraDraftActionCard »)
Insérée dans le fil de discussion quand un utilisateur demande à Terra : *"Terra, propose un sondage pour le menu du bivouac"* ou *"Terra, prépare l'expédition pour le week-end prochain"* :
- **Design de la carte** :
  - En-tête : Badge Terra AI (`tone="info"`), label *"Proposition d'action (Brouillon)"*.
  - Corps : Détails formatés de l'objet à créer (Titre du sondage, options proposées, règles de quorum).
  - Avertissement légal : *"Cette action n'a aucun effet tant qu'elle n'est pas confirmée."*
  - Barre d'action avec cibles tactiles de 44px :
    - Bouton vert forêt : **✓ Valider et Publier**
    - Bouton gris translucide : **✎ Modifier les options**
    - Bouton rouge discret : **✕ Rejeter**

#### C. Citations de Sources & Popovers (« SourceCitationTag »)
- Format inline dans les réponses de Terra : `[Message de Sarah · 14h22]`.
- Comportement tactile :
  - Au clic : Smooth-scroll automatique dans la `MessageList` jusqu'au message référencé, avec pulsation lumineuse (`ring-2 ring-[var(--lkv-secondary)]`) durant 1,5 seconde.
  - Au survol / appui long : Micro-popover affichant le contenu verbatim du message sans quitter la lecture.

#### D. Système de Points d'Aventure & Streaks sans Spam
- La réputation collective repose sur la **réalisation d'aventures et l'utilité réciproque**, et **non sur le volume de messages bruts échangés** :
  - Points attribués pour : check-in terrain certifié, mise à disposition de matériel mutualisé, validation d'un tracé GPX fiable, aide active dans la préparation.
  - Aucune attribution de points pour les messages textuels simples afin de bannir tout comportement de spamming.
  - Widget visuel : badge d'effort collectif et streak d'expéditions partagées affiché dans l'en-tête du groupe.

---

## 7. Directives Ergonomie Mobile & Apple Human Interface Guidelines (HIG)

Pour conférer à LKDV Social le ressenti d'une application native iOS de premier plan (SwiftUI / HIG), les directives suivantes sont rigoureusement formalisées :

### 7.1 Typographie Système SF Pro & Échelle Hiérarchique
- Typographie système principale : `var(--font-sans)` (`system-ui`, `-apple-system`, `SF Pro Text`, `SF Pro Display`).
- Respect strict de la hiérarchie par le **poids et la taille**, et non par la profusion de couleurs :
  - Titres d'écrans : `var(--lkv-text-title-sm)` (20px, bold / semi-bold)
  - Sous-titres & Noms d'expéditeurs : `var(--lkv-text-subheadline)` (15px, font-semibold)
  - Corps de message : `var(--lkv-text-footnote)` ou `15px` avec `leading-relaxed` (1.45) pour une lisibilité optimale sur écran tactile.
  - Métadonnées & Timestamps : `var(--lkv-text-caption-2)` (11px, font-mono ou regular, opacité 75%).

### 7.2 Matériau Liquid Glass & Translucidité (iOS 26 / WWDC 2025 Standard)
Conforme aux primitives `GlassSurface.tsx` et `LiquidGlass.tsx` du projet :
- **Niveau G1** (`level="G1"`) : Cartes légères d'objets outdoor et bulles de messages reçus. Fond translucide blanc/sauge léger (`rgba(255, 255, 255, 0.72)`), léger flou d'arrière-plan (`backdrop-blur-md`), bordure fine opalescente (`var(--glass-border)`).
- **Niveau G2** (`level="G2"`) : En-têtes sticky, barres de filtres, cartes de contrôles d'itinéraires. Saturation rehaussée (`saturate-[var(--glass-sat)]`).
- **Niveau G3 / GC** (`level="G3"`) : Barre du Composer (`MessageComposer`), segmented control flottant, boutons d'action rapide. Matériau plus dense avec réflexion spéculaire douce.

### 7.3 Cibles Tactiles 44px & Ergonomie à Une Main
- **Taille minimale de touche** : Tous les éléments interactifs (boutons d'action, icônes d'envoi, cases à cocher de checklist, réactions emoji, déclencheurs de popovers) possèdent une zone tactile d'au moins **44 × 44 pixels** (`--lkv-touch-min: 44px`).
- **Thumb Zone** :
  - Le Composer et le sélecteur de panneaux de l'Expedition Room sont ancrés en bas d'écran.
  - La safe-area basse iOS est respectée en dynamique via `pb-[max(calc(var(--safe-bottom)-var(--kb-inset,0px)),8px)]`.
  - Pas de geste complexe nécessitant d'atteindre le coin supérieur gauche sur mobile : navigation arrière par bouton de header proéminent + geste de balayage depuis le bord gauche (`useBackGuard`).

### 7.4 Gestes Tactiles & Retours Haptiques
- **Drag-to-dismiss** : Tous les tiroirs d'inspection (KitSheet, PackMerge, Quiet Catch-Up, QuickReport) s'appuient sur `Sheet.tsx` avec `dragToDismiss={true}` et indicateur de préhension visuel (grabber bar).
- **Swipe-to-reply** : Geste de balayage horizontal sur les bulles pour citer instantanément un message.
- **Double-tap to react** : Déclenche un retour haptique léger et pose une réaction ❤️.
- **Haptic Feedback** : Déclenchement de vibrations calibrées via `@capacitor/haptics` (`useHapticFeedback`) :
  - `light` : clic sur filtre, changement d'onglet, réaction rapide.
  - `medium` : ouverture de menu contextuel, démarrage enregistrement vocal.
  - `success` : validation d'un Pack Merge, publication d'un check-in terrain.

---

## 8. Inventaire des Composants, Matrice de Réutilisation & Contrats d'Interface

### 8.1 Matrice de Réutilisation des Composants Existants

| Composant Existant | Emplacement | Statut | Modifications / Adaptations Requises |
|---|---|---|---|
| `MessageBubble.tsx` | `features/messaging/components/` | À étendre | Ajouter le dispatch des nouveaux types de messages : `'expedition'`, `'field_checkin'`, `'terra_draft'`, `'kit_merge'`. |
| `MessageComposer.tsx` | `features/messaging/components/` | À étendre | Intégrer les raccourcis d'envoi d'Expédition et de Check-in rapide dans le menu contextuel. |
| `ComposerMenuSheet.tsx`| `features/messaging/components/` | À étendre | Ajouter les items "Partager une expédition" et "Faire un check-in terrain". |
| `MessageList.tsx` | `features/messaging/components/` | À étendre | Injecter la bannière flottante "Quiet Catch-Up" en haut de la liste quand `hasUnreadSummary === true`. |
| `GPXPreviewCard.tsx` | `features/messaging/components/` | À remplacer / refactoriser | Transformer en `GPXSnapshotCard` (lecture directe des métadonnées précalculées + rendu SVG `TraceMiniMap` sans fetch distant). |
| `KitCard.tsx` | `features/messaging/components/` | À refactoriser | Transformer en `KitLiveCard` avec affichage du poids, des items, et bouton d'action `Pack Merge`. |
| `TraceMiniMap.tsx` | `features/trips/components/` | Réutilisable tel quel | Intégrer directement dans `GPXSnapshotCard` pour le rendu vectoriel instantané. |
| `WeatherStrip.tsx` | `features/hub/components/weather/` | Réutilisable tel quel | Intégrer dans l'Expedition Room en mode `capsule` (mobile) et mode `strip` (desktop). |
| `QuickReportSheet.tsx` | `features/terrain-live/components/` | Réutilisable tel quel | Utiliser comme modal de check-in terrain 3-tap dans l'Expedition Room. |
| `Sheet.tsx` | `components/ui/` | Réutilisable tel quel | Utiliser pour tous les tiroirs (Pack Merge, Quiet Catch-Up, Roster membres). |
| `GlassSurface.tsx` | `components/glass/` | Réutilisable tel quel | Conteneur des panneaux et cartes pour l'esthétique Liquid Glass. |

### 8.2 Nouveaux Composants à Développer

| Nouveau Composant | Dossier Cible | Rôle & Fonctionnalité |
|---|---|---|
| `GPXSnapshotCard.tsx` | `src/features/messaging/components/cards/` | Carte snapshot légère pour les tracés GPX (zéro requête réseau, SVG instantané, métriques clés, tap pour ouvrir la carte). |
| `KitLiveCard.tsx` | `src/features/messaging/components/cards/` | Carte enrichie de Kit de voyageur avec jauge de poids, pièces mutualisables et déclencheur Pack Merge. |
| `PackMergeSheet.tsx` | `src/features/messaging/components/sheets/` | Tiroir interactif comparant le sac d'un utilisateur au kit partagé pour fusionner les équipements et éviter les doublons. |
| `ExpeditionLiveCard.tsx` | `src/features/messaging/components/cards/` | Carte compacte d'expédition affichant la date, le J-X, la difficulté, les participants et le bouton d'accès à la room. |
| `FieldCheckinCard.tsx` | `src/features/messaging/components/cards/` | Carte d'émargement terrain avec statut de passage, géolocalisation vérifiée et horodatage. |
| `ExpeditionRoomView.tsx` | `src/features/messaging/components/expedition/` | Vue multi-pane orchestrant le fil de discussion, la carte interactive, la météo, la checklist et les check-ins. |
| `ExpeditionChecklistPane.tsx`| `src/features/messaging/components/expedition/` | Panneau de la checklist partagée avec assignation des charges et calcul de poids. |
| `ClubChannelsBar.tsx` | `src/features/messaging/components/clubs/` | Barre de sélection des salons thématiques d'un club (`#général`, `#matériel`, `#sorties`, `#sécurité`). |
| `ClubRoleBadge.tsx` | `src/features/messaging/components/clubs/` | Badge micro-typographique pour les 5 rôles (Propriétaire, Admin, Guide, Sécurité, Membre). |
| `TerraCatchUpPill.tsx` | `src/features/messaging/components/terra/` | Pilule discrète en haut du fil invitant au rattrapage silencieux. |
| `TerraQuietCatchUpSheet.tsx`| `src/features/messaging/components/terra/` | Tiroir de synthèse structurée (points clés, décisions, questions, citations cliquables). |
| `TerraDraftActionCard.tsx` | `src/features/messaging/components/terra/` | Carte brouillon d'action générée par Terra avec boutons explicites Valider / Rejeter. |
| `TerraSourcePopover.tsx` | `src/features/messaging/components/terra/` | Popover et gestionnaire de scroll pour surligner le message source d'une citation. |

---

### 8.3 Contrats d'Interface TypeScript (Types & Payloads)

```typescript
// ============================================================================
// EXTENSION DU MODÈLE CANONIQUE DE MESSAGERIE (src/features/messaging/types/)
// ============================================================================

export type ExtendedConversationType = 
  | 'direct' 
  | 'group' 
  | 'club_channel' 
  | 'expedition';

export type ExtendedMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'audio'
  | 'system'
  | 'gpx'
  | 'product'
  | 'trail'
  | 'kit'
  | 'expedition'
  | 'field_checkin'
  | 'terra_draft'
  | 'terra_summary';

export type ModularRole = 
  | 'owner'     // Propriétaire
  | 'admin'     // Administrateur
  | 'guide'     // Guide / Leader d'itinéraire
  | 'safety'    // Responsable sécurité / Secours
  | 'member';   // Membre participant

// ----------------------------------------------------------------------------
// PAYLOADS METADATA DES LIVE CARDS
// ----------------------------------------------------------------------------

/** Payload Snapshot GPX stocké dans message.metadata */
export interface GPXSnapshotMeta {
  kind: 'gpx_snapshot';
  gpx_url: string;
  file_name: string;
  title: string;
  distance_km: number;
  elevation_gain_m: number;
  elevation_min_m: number;
  elevation_max_m: number;
  estimated_duration_min?: number;
  polyline_svg_points: string; // "x1,y1 x2,y2 ..." précalculé (largeur 240, hauteur 90)
}

/** Payload Kit avec Pack Merge stocké dans message.metadata */
export interface KitLiveMeta {
  kind: 'kit_live';
  kit_id: string;
  kit_name: string;
  creator_name: string;
  generation: number;
  total_weight_g: number;
  items_count: number;
  shared_items_count: number;
  trust_score?: number;
  is_verified_field: boolean;
  categories_summary: Array<{ category: string; count: number; weight_g: number }>;
}

/** Payload Expédition stocké dans message.metadata */
export interface ExpeditionLiveMeta {
  kind: 'expedition_live';
  expedition_id: string;
  title: string;
  region: string;
  start_date: string;
  days_left: number;
  difficulty: 'easy' | 'moderate' | 'demanding' | 'alpine';
  participants_count: number;
  max_participants: number;
  participants_avatars: string[];
  gpx_distance_km?: number;
  gpx_elevation_gain_m?: number;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed';
}

/** Payload Check-in Terrain stocké dans message.metadata */
export interface FieldCheckinMeta {
  kind: 'field_checkin';
  checkin_id: string;
  place_name: string;
  coordinates: { lat: number; lng: number };
  timestamp: string;
  altitude_m?: number;
  passability: 'passable' | 'difficult' | 'impassable';
  severity: 'info' | 'warning' | 'critical';
  notes?: string;
  photo_url?: string;
  confirmed_by_count: number;
}

// ----------------------------------------------------------------------------
// CONTRATS TERRA AI
// ----------------------------------------------------------------------------

export interface TerraCitation {
  message_id: string;
  author_name: string;
  timestamp: string;
  preview_text: string;
}

export interface TerraQuietCatchUpSummary {
  conversation_id: string;
  unread_count: number;
  time_range: { from: string; to: string };
  key_points: string[];
  decisions_adopted: string[];
  open_questions: string[];
  pending_tasks: string[];
  citations: TerraCitation[];
}

export interface TerraDraftAction {
  draft_id: string;
  action_type: 'create_poll' | 'create_expedition' | 'add_checklist_item';
  status: 'draft' | 'confirmed' | 'rejected';
  payload: {
    poll?: {
      question: string;
      options: string[];
      quorum_needed?: number;
    };
    expedition?: {
      title: string;
      start_date: string;
      trail_id?: string;
    };
    checklist_item?: {
      name: string;
      category: string;
      weight_g?: number;
      assigned_to?: string;
    };
  };
  created_at: string;
  validated_by_user_id?: string;
}

// ----------------------------------------------------------------------------
// CONTRATS EXPEDITION ROOMS
// ----------------------------------------------------------------------------

export interface ExpeditionRoomState {
  conversation_id: string;
  expedition_id: string;
  active_tab: 'discussion' | 'itinerary' | 'checklist' | 'checkins';
  weather: {
    temp_c: number;
    weather_code: number;
    precip_pct: number;
    wind_kmh: number;
    location_label: string;
  } | null;
  gpx_route: {
    title: string;
    distance_km: number;
    elevation_gain_m: number;
    coordinates: [number, number][];
  } | null;
  checklist: Array<{
    id: string;
    item_name: string;
    weight_g: number;
    is_shared: boolean;
    assigned_user_id?: string;
    status: 'needed' | 'packed';
  }>;
  checkins: FieldCheckinMeta[];
}
```

---

## 9. Recommandations d'Implémentation & Feuille de Route Frontend

1. **Étape 1 — Création des Cartes Live Snapshot** :
   - Implémenter `GPXSnapshotCard.tsx` et brancher `TraceMiniMap.tsx` pour éliminer le coût réseau dans le chat stream.
   - Refactoriser `KitCard.tsx` en `KitLiveCard.tsx` et créer `PackMergeSheet.tsx` en s'appuyant sur les données existantes de `EquipementCard.tsx`.
   - Créer `ExpeditionLiveCard.tsx` et `FieldCheckinCard.tsx`.
2. **Étape 2 — Salons de Clubs & Rôles Modulaires** :
   - Introduire `ClubChannelsBar.tsx` pour naviguer entre les salons thématiques adossés aux conversations canoniques.
   - Intégrer `ClubRoleBadge.tsx` dans `MessageBubble.tsx` et dans les listes de membres.
3. **Étape 3 — Expedition Rooms Multi-Surfaces** :
   - Assembler `ExpeditionRoomView.tsx` avec layout responsive (tabs/sheets sur mobile, split 2/3 colonnes sur desktop).
   - Embarquer `ConversationView`, `WeatherStrip`, `ParcoursCard` et `ExpeditionChecklistPane`.
4. **Étape 4 — Intégration Terra AI** :
   - Créer `TerraCatchUpPill.tsx` et `TerraQuietCatchUpSheet.tsx` avec citations interactives.
   - Implémenter `TerraDraftActionCard.tsx` avec contrôles stricts de validation humaine (Confirm / Reject).
5. **Étape 5 — Tests de Non-Régression & Validation Apple HIG** :
   - Tests Vitest sur le rendu des Live Cards et la logique de détection de doublons de Pack Merge.
   - Contrôles visuels des hauteurs de cibles tactiles (44px min) et du comportement clavier mobile (`--kb-inset`).

---
*Ce rapport constitue la base de référence pour le plan d'implémentation et la réalisation par les agents développeurs.*
