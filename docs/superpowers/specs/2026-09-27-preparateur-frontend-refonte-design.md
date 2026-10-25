# Design Doc — Refonte 100 % frontend du Préparateur d'aventure LKDV

**Date :** 2026-09-27  
**Scope :** `src/features/adventure-prep/` — tous les composants, CSS inclus  
**Backend intouché :** store Zustand, moteurs purs, types, IA NVIDIA/OpenRouter, Supabase  
**Référence maquette :** `project/maquette/` (30 écrans HTML) + `prompt-codex-preparateur-lkdv.md`

---

## 1. Contexte et objectif

### Ce qui existe et fonctionne (ne pas toucher)

| Couche | Fichiers | État |
|---|---|---|
| Types de domaine | `types.ts` | ✅ Complet, conforme maquette |
| Store Zustand | `store/useAdventurePrepStore.ts` | ✅ Solide, autosave, testé |
| Moteurs purs | `engine/*.ts` (15 fichiers) | ✅ Testés, zéro side-effect |
| Intégration IA | `engine/aiItinerary.ts`, `engine/generation.ts` | ✅ NVIDIA Nemotron câblé |
| Route `/prepare` | `src/app/prepare/page.tsx` | ✅ Deux états (avec/sans aventure) |
| Shell AppShell | `src/components/shell/AppShell.tsx` | ✅ safe-area, barre navigation masquée |
| Design system tokens | `adventure-prep.css` (lignes 1–160) | ✅ Tokens complets, Liquid Glass iOS |
| Tests | `__tests__/*.test.ts(x)` (34 fichiers) | ✅ À préserver — aucun test ne doit casser |

### Ce qui est à refondre (périmètre exclusif)

```
src/features/adventure-prep/components/
├── ActivityPickerScreen.tsx    ← REFONTE
├── AdventurePrepScreen.tsx     ← conserver (wrapper minimal)
├── AdventurePrepShell.tsx      ← REFONTE (nav + offline)
├── DepartureStep.tsx           ← REFONTE complète (étape 3)
├── DestinationStep.tsx         ← REFONTE complète (étape 1)
├── ItineraryStep.tsx           ← REFONTE complète (étape 2)
├── PrepCrumb.tsx               ← REFONTE (progression + nav)
├── PrepFlow.tsx                ← conserver (orchestrateur)
├── PrepGearSheets.tsx          ← REFONTE (GearSheet + ConsumablesSheet)
├── PrepInviteScreen.tsx        ← REFONTE (invitation)
├── PrepItinerarySheets.tsx     ← REFONTE (StepSheet, StepsSheet, AdjustSheet, AddStepSheet)
├── PrepMap.tsx                 ← REFONTE (carte + contrôles flottants)
├── PrepSetupSheets.tsx         ← REFONTE (PlaceSheet, CalendarSheet, GroupSheet, PreferencesSheet, ParticipantsSheet)
├── PrepSheets.tsx              ← conserver (routeur de sheets)
└── adventure-prep.css          ← EXTENSION uniquement (lignes 160–fin à refondre)
```

---

## 2. Architecture : trois écrans + un système de sheets

### Principe A1 (inviolable)
- **Un écran = une décision dominante**
- Barre de navigation basse **absente** pendant tout le flux
- Carte **toujours présente** dans chaque écran, en bas
- Un seul CTA principal visible, explicite, en bas
- Progression en mots : **Destination · Parcours · Départ**

### Flux complet

```
Hub (long press ou bouton "Préparer")
  └─> Tiroir Hub (drawer) → "Préparer une activité"
        └─> ActivityPickerScreen (plein écran, modal)
              └─> PrepFlow (orchestrateur)
                    ├─ DestinationStep     [Étape 1 — Destination]
                    ├─ ItineraryStep       [Étape 2 — Parcours]
                    └─ DepartureStep       [Étape 3 — Départ]
                          └─> Enregistrer → hub actif (aventure créée)
```

Sheets ouverts sur demande depuis chaque écran :
- `place`, `calendar`, `group`, `preferences` (depuis étape 1)
- `step`, `steps`, `adjust`, `add`, `coverage` (depuis étape 2)
- `gear`, `consumables`, `participants`, `invite` (depuis étape 3)

---

## 3. Spécifications écran par écran

### 3.0 — ActivityPickerScreen (choix d'activité)

**Réf :** `02-activity-picker.html`

**Layout :**
- Nav : ← Retour | « Quelle aventure ? » | [recherche]
- Barre de recherche sticky sous la nav
- Chips de catégorie : À pied · À vélo · Eau · Neige/montagne · Voyage/séjour · Autres
- Grille d'activités (2 colonnes) sous la catégorie sélectionnée
- Bloc « Récents / Favoris » en premier si présents
- CTA fixe « Continuer » (activé après sélection)
- « Partir librement » en lien secondaire sous le CTA

**Contrat technique :**
- Utilise `ACTIVITY_CATEGORIES` + `primaryCandidates` + `searchActivities` du catalogue existant
- Sélection → `useAdventurePrepStore.setActivity(id)`
- Recents lus/écrits dans `localStorage` via `RECENT_STORAGE_KEY`

---

### 3.1 — DestinationStep — « On part où ? » [Étape 1]

**Réf :** `10-step1-randonnee.html`, `11-step1-voyage.html`, `12-step1-sejour.html`, `13-step1-local.html`

**Layout (A4) :**
```
[Nav 52px : ← | Destination · Parcours · Départ | ✕]
[Titre : "On part où ?" + aide contextuelle]
[Bloc 1 : Parcours]
  - Départ (lieu)
  - Arrivée / Destination (selon activité)
  - Boucle / Aller simple (segmented)
  - Inverser ↕ (si aller simple, hors boucle)
[Bloc 2 : Quand ?]
  - Date de départ + Durée proposée ou Retour
  - Durée proposée signalée « Durée proposée », modifiable
[Bloc 3 : Avec qui ?]
  - Solo / Groupe (segmented)
  - Avatars des membres connus
[Préférences (lien)] → sheet 'preferences'
[Carte — flex:1, sticky bottom, min-height 128px]
[CTA fixe : « Créer mon parcours »]
```

**Adaptation par activité (A4 tableau) :**
| Activité | Bloc parcours | Bloc calendrier |
|---|---|---|
| Randonnée, vélo, trail | Départ + boucle/aller | Date + temps disponible |
| Voyage, road trip | Départ + destination | Départ + durée ou retour |
| Séjour autour d'un lieu | Destination/hébergement | Dates du séjour |
| Activité locale | Lieu de pratique | Date + durée indicative |

**Métriques étape 1 :** uniquement durée choisie et nombre de participants dans leurs blocs. Aucun budget, aucune distance routée avant calcul.

**Avant génération :** la carte montre des repères (marqueurs de départ/arrivée) mais **jamais une ligne présentée comme itinéraire praticable**.

---

### 3.2 — Génération (sans écran d'attente vide) [A5]

**Réf :** `20-generation.html`

**Comportement :**
1. Le bouton réagit immédiatement (disabled + spinner) — empêche doublons
2. La carte reste affichée
3. Ligne d'avancement progressive : « Recherche du parcours… » → « Vérification des étapes… »
4. Résultats apparaissent à mesure qu'ils arrivent (streaming)
5. Bouton « Arrêter » conserve les saisies
6. En cas d'échec : « Réessayer » + « Continuer avec les éléments disponibles »
7. **Jamais de pourcentage inventé** — `GenerationPhase.label` uniquement
8. Bandeau notice si l'IA a échoué mais que le parcours de repli est disponible

**Implémentation :** lire `draft.generation.status` + `draft.generation.phases` du store existant.

---

### 3.3 — ItineraryStep — « Voici ton aventure » [Étape 2]

**Réf :** `30-step2-randonnee.html`, `31-step2-voyage.html`, `32-step2-sejour.html`, `33-step2-detail-etape.html`

**Layout (A6) :**
```
[Nav : ← | Destination · Parcours · Départ | ✕]
[Sous-titre hypothèses : "Nature · tranquille · budget modéré" → tap → sheet 'preferences']
[Métriques 3 colonnes — selon metricsContext]
[Sélecteur de jour — uniquement si > 1 jour]
[Fiche de l'étape sélectionnée]
  - Photo ou icône catégorie (72×72, rayon 14)
  - Nom | Heure indicative + durée | Raison courte (2 lignes max)
  - Prix ou « Prix à vérifier »
  - [Détails] [Remplacer] [Conserver ✓]
[Boutons : Ajuster | Étapes | Ajouter]
[Carte avec jour sélectionné ou ensemble]
[CTA fixe : « Préparer le départ »]
```

**Métriques par contexte (A6 tableau) :**
| Contexte | M1 | M2 | M3 |
|---|---|---|---|
| terrain (rando/vélo) | Distance km | Durée marche | D+ m |
| voyage (road trip) | Durée séjour | Transport | Budget/pers |
| sejour (local) | Durée | Nb activités | Budget/pers |

Chaque métrique précise son périmètre : jour sélectionné ou aventure complète. La durée de déplacement se distingue de la durée totale avec les pauses.

**Bouton « Ajuster » (sheet 'adjust') :** cinq ajustements nommés + phrase libre. L'IA propose les changements avec leur impact en mots. « Appliquer » / « Garder l'actuel ». Étapes conservées et réservations confirmées ne sont **pas déplacées silencieusement**.

**Bouton « Étapes » (sheet 'steps') :** programme complet : trajets, arrêts, pauses, nuits avec horaires. Sélectionner une ligne revient à la fiche + point correspondant.

**Bouton « Ajouter » (sheet 'add') :** recherche de lieu, activité, repas, hébergement, ravitaillement, étape personnelle.

---

### 3.4 — DepartureStep — « Tout est prêt ? » [Étape 3]

**Réf :** `50-step3.html`, `51-vue-equipement.html`, `52-vue-eau-repas.html`, `53-vue-participants.html`, `54-invitation.html`

**Layout (A9) :**
```
[Nav : ← | Destination · Parcours · Départ | ✕]
[Couverture compacte : nom aventure + icône Modifier]
[Bloc 1 : Équipement]
  - Résumé "X éléments à vérifier" → tap → sheet 'gear'
[Bloc 2 : Eau et repas]
  - Besoins estimés + ravitaillements → tap → sheet 'consumables'
[Bloc 3 : Participants]
  - Avatars + invitations en attente → tap → sheet 'participants'
[Ligne « À vérifier » + N points ouverts si applicable]
[Carte avec étapes, nuits et ravitaillements]
[CTA fixe : « Enregistrer mon aventure »]
```

**Métriques de préparation (A9) :**
- Équipement à vérifier : nombre non confirmé
- Éléments manquants : absents de l'inventaire connu (distinction possession inconnue vs absente)
- Poids du sac : somme des éléments attribués (mentionner les poids manquants)
- Eau à emporter : estimation jusqu'au prochain ravitaillement, hypothèses modifiables
- Repas à prévoir : repas non couverts par les étapes de restauration retenues
- Budget : estimé / engagé / restant (sans compter deux fois une réservation)
- **Jamais de note globale** type « 98 % prêt »

**Enregistrer :** crée l'aventure → hub actif. **Ne lance pas** le suivi GPS (bouton séparé dans le hub).

---

### 3.5 — Carte (A7) — même interface à toutes les étapes

**Réf :** `40-carte-plein-ecran.html`

**Contrôles flottants (verre, coin haut gauche/droit) :**
- Haut gauche : chip périmètre « Jour 1 » / « Ensemble »
- Haut droit : bouton Agrandir → carte plein écran
- Haut droit (sous agrandir) : Recentrer (cadre le parcours, ≠ position)
- Dans vue agrandie : « Ma position » (demandée au moment utile) + Filtres
- Attribution et info données : toujours lisibles, non recouvertes

**Marqueurs :**
- Étape retenue : disque 28px, fond vert, chiffre blanc, bordure blanche 2.5px
- Suggestion : disque 28px, fond blanc, bordure **pointillée** verte
- Sélectionné : scale 1.28 + halo 4px
- POI : carré 32px rayon 9, icône 16px (restaurant, source, hébergement, camping, bus, gare)
- Tracés : à pied = trait plein 4.5px ; vélo = tirets 10/6 ; motorisé = trait 6px gris + pointillé blanc ; brouillon = pointillé ronds 35%

**Comportement :**
- Toucher un point → fiche de l'étape
- Déplacer la carte manuellement → suspend le recentrage automatique
- La carte reste en place d'une étape à l'autre (pas de rechargement brutal)

---

### 3.6 — Fiches de lieu et states d'offre (A8)

**Réf :** `41-fiche-lieu-offre.html`

**5 états explicites :**
1. **Suggestion** (contour pointillé) — jamais présenté comme réservé
2. **Retenu** (signet vert) — bloqué lors de la prochaine proposition
3. **À réserver** (ticket, ambre) — engagement en attente
4. **Confirmé par toi** (coche) — auto-déclaré par l'utilisateur
5. **Confirmé par le fournisseur** (sceau, bleu) — preuve vérifiée

**Règles :**
- Chaque état = icône + libellé, **jamais couleur seule**
- « Voir l'offre » n'ouvre que le lien partenaire, ne change pas l'état
- Montants : prix/personne, prix/nuit, total groupe — jamais mélangés
- Budget incomplet = annoncé comme partiel avec les postes manquants

---

### 3.7 — Sheets : vues secondaires détaillées

#### PlaceSheet — Recherche de lieu
- Champ de recherche (focus auto)
- Résultats : commune + pays
- Lieux récents
- Option : « Ma position actuelle »
- Option : « Choisir sur la carte »
- CTA : « Choisir ce lieu »

#### CalendarSheet — Calendrier
- Sélecteur de date (month view, min 44×44 par case)
- Heure facultative (optionnelle)
- Durée ou date de retour
- Durée proposée signalée « Durée proposée »
- CTA : « Appliquer »

#### GroupSheet — Groupe
- Solo / Groupe (segmented)
- Adultes (stepper)
- Enfants si pertinent (stepper)
- Animaux (switch)
- Membres déjà connus (avatars cliquables)
- CTA : « Confirmer le groupe »

#### PreferencesSheet — Préférences
- Budget par personne (slider ou segmented : Économe / Modéré / Confort)
- Rythme (Tranquille / Normal / Rapide)
- Transport (À pied / Train / Voiture / Avion / Mixte)
- Intérêts (chips multiselect)
- Besoins d'accessibilité (chips multiselect)
- CTA : « Appliquer »

#### StepSheet — Détail d'une étape
- Photo réelle ou placeholder catégorie
- Nom, catégorie, raison du choix
- Informations pratiques (horaires, durée)
- Prix / disponibilité connus — source + fraîcheur
- 5 états de réservation explicites
- Actions : Ajouter au parcours | Remplacer | Retirer | Voir l'offre | J'ai réservé | Signaler

#### StepsSheet — Programme complet
- Liste chronologique : trajets, arrêts, pauses, nuits
- Horaires indicatifs par ligne
- Tap sur une ligne → ferme le sheet + sélectionne l'étape dans l'écran

#### AdjustSheet — Ajuster
- 5 boutons nommés : Moins cher | Moins de transport | Plus de nature | Plus tranquille | Plus de découvertes
- Champ texte libre (1 phrase)
- Bouton « Proposer des changements » → génération différentielle
- Affichage de l'impact proposé avant confirmation
- « Appliquer » / « Garder l'actuel »

#### AddStepSheet — Ajouter
- 6 types : Lieu | Activité | Repas | Hébergement | Ravitaillement | Étape personnelle
- Recherche contextuelle selon type
- CTA : « Ajouter à l'étape [N] »

#### GearSheet — Équipement
- Filtres : À vérifier / Manquant / Tout
- Liste par catégorie
- Par ligne : nom, quantité, personne responsable, poids connu, case « Dans le sac »
- « Ajouter un élément »
- **Possédé ≠ préparé** : l'IA ne coche pas « Dans le sac » à la place de l'utilisateur

#### ConsumablesSheet — Eau et repas
- Besoins par segment ou par journée
- Points de ravitaillement + fiabilité
- Quantités modifiables
- Alternative si un point est indisponible

#### ParticipantsSheet — Participants
- Membres confirmés + invités (avatars)
- Matériel partagé attribué (avec responsable + confirmation)
- Bouton « Inviter » → sheet 'invite'
- Bouton « Copier le lien »
- Gestion des droits (peut modifier les étapes : oui/non)

#### PrepInviteScreen — Invitation
- Couverture de l'aventure (nom, dates, destination)
- Budget estimatif visible
- Message personnalisé modifiable
- Droits : peut proposer des étapes (switch)
- Partage via lien ou partage natif
- **L'invitation ne donne pas accès à la localisation**

---

## 4. Direction visuelle (A2) — strictement issue de core.css et adventure-prep.css

| Élément | Valeur |
|---|---|
| Fond | `--lkv-surface` + radial vert topographique (opacity 0.5) |
| Surfaces de texte | `color-mix(in srgb, var(--card-tint-solid) 92%, #fff)` — presque opaques |
| Verre | Réservé aux commandes flottantes sur la carte uniquement |
| Couleur principale | `--lkv-action` (vert) — actions et sélections |
| Typographie | SF Pro via `-apple-system` — **aucune police web chargée** |
| Bouton principal | Fond vert, texte contrasté, libellé explicite. Hauteur 52px |
| Bouton secondaire | Surface neutre + bordure légère |
| Animations | 180ms press / 220ms apparition / 250ms sheet — `prefers-reduced-motion` respecté |
| États sélectionnés | Couleur **plus** coche ou libellé — jamais la couleur seule |

**À éviter :**
- Du verre partout (uniquement flottants sur carte)
- Des petites cartes imbriquées successives
- Une animation permanente
- Un hex en dur dans un composant (utiliser les tokens)

---

## 5. Règles CSS — écriture

- **Aucun hex** dans les composants TSX — uniquement via `style=` avec tokens CSS
- Classes BEM existantes à réutiliser : `.prep-block`, `.prep-block__row`, `.prep-cell`, `.prep-segmented`, etc.
- Nouvelles classes préfixées `.prep-` uniquement
- Nouvelles règles ajoutées à la fin de `adventure-prep.css` — **les 160 premières lignes de tokens ne changent pas**
- Tailwind **non utilisé** dans `adventure-prep` — le feature a sa propre feuille de style

---

## 6. Accessibilité (inviolable)

- Cibles tactiles min 44×44px partout
- Boutons ronds : 44×44px
- Jours de calendrier : 44×44px min
- Marqueurs de carte : 44×44px zone de tap
- Lignes de liste : min 56px de hauteur
- `aria-live="polite"` sur les zones de progression et de génération
- `aria-current="step"` sur l'étape en cours dans la progression
- Focus visible partout (`outline: 2px solid var(--lkv-focus-ring)`)
- Couleur jamais seule pour transmettre un état
- `prefers-reduced-motion` : transitions supprimées, indicateur de chargement = point fixe

---

## 7. Robustesse

- **Sans réseau** : le flux reste utilisable. Les données géocodées et les étapes déjà générées restent accessibles via le store.
- **IA indisponible** : le parcours de repli (moteur pur sans IA) s'affiche avec un bandeau notice explicite.
- **Aucune offre disponible** : les étapes s'affichent sans prix, avec mention « à vérifier ».
- **Petit écran** : la carte se compacte en premier (`--prep-map-height-compact`). Le défilement est autorisé plutôt que de réduire les caractères.
- **Clavier ouvert** : le body scrolle, le CTA reste atteignable.
- **Texte agrandi 200 %** : grilles passent à 1 colonne, carte à 200px fixe, la progression n'affiche que l'étape courante.

---

## 8. Décomposition en tâches (pour writing-plans)

### Bloc A — CSS/Tokens (fondation)
- A1 : Auditer les classes existantes de `adventure-prep.css` (lignes 160–fin) — identifier ce qui est déjà correct vs. à refondre
- A2 : Réécrire les règles CSS des écrans principaux (`.prep-screen`, `.prep-body`, `.prep-foot`)
- A3 : CSS des composants UI manquants (métriques, fiche étape, sélecteur jour, boutons actions)
- A4 : CSS des states d'offre (5 états, chips, badges)

### Bloc B — ActivityPickerScreen (entrée)
- B1 : Refondre le layout (nav + search + catégories + grille + CTA)
- B2 : Récents/favoris correctement positionnés
- B3 : « Partir librement » en lien secondaire

### Bloc C — DestinationStep (étape 1)
- C1 : Les 3 blocs principaux (Parcours, Quand, Avec qui)
- C2 : Adaptation selon activité (4 variantes)
- C3 : Lien Préférences + résumé
- C4 : Carte sticky + CTA « Créer mon parcours »

### Bloc D — ItineraryStep (étape 2)
- D1 : Métriques 3 colonnes (3 contextes)
- D2 : Sélecteur de jour (si > 1 jour)
- D3 : Fiche d'étape complète (photo, nom, heure, raison, prix, actions)
- D4 : Boutons Ajuster / Étapes / Ajouter
- D5 : Carte avec marqueurs numérotés + suggestions
- D6 : État de génération (spinner progressif, arrêt, échec)

### Bloc E — DepartureStep (étape 3)
- E1 : Couverture compacte + nom éditable
- E2 : Blocs Équipement / Eau-repas / Participants avec résumés cliquables
- E3 : Ligne « À vérifier » (points ouverts concrets, jamais un score)
- E4 : Carte finale + CTA « Enregistrer mon aventure »

### Bloc F — Sheets
- F1 : PlaceSheet (recherche, recents, position, carte)
- F2 : CalendarSheet (month view, durée proposée)
- F3 : GroupSheet (solo/groupe, adultes, enfants, animaux, membres)
- F4 : PreferencesSheet (budget, rythme, transport, intérêts, accessibilité)
- F5 : StepSheet (fiche complète + 5 états + actions)
- F6 : StepsSheet (programme, tap vers étape)
- F7 : AdjustSheet (5 ajustements + champ libre + impact)
- F8 : AddStepSheet (6 types, recherche)
- F9 : GearSheet (filtres, liste, « Dans le sac »)
- F10 : ConsumablesSheet (eau, repas, points, alternatives)
- F11 : ParticipantsSheet (membres, matériel partagé, droits)
- F12 : PrepInviteScreen (couverture, message, droits, partage)

### Bloc G — Carte (PrepMap)
- G1 : Contrôles flottants (verre, périmètre, agrandir, recentrer)
- G2 : Marqueurs conformes specs (numérotés, suggestion, sélectionné, POI)
- G3 : Styles de tracé (pied, vélo, motorisé, brouillon)
- G4 : Vue plein écran (overlay, Ma position, Filtres)
- G5 : Attribution données (visible, non recouverte)

### Bloc H — Shell et navigation
- H1 : PrepNav / PrepCrumb (progression mots, étapes terminées accessibles)
- H2 : AdventurePrepShell (bandeau offline, context)
- H3 : Raccordement tiroir Hub → PrepFlow

### Bloc I — Tests et vérification
- I1 : Tous les tests existants passent (aucune régression moteur)
- I2 : Vérification visuelle sur les 3 tailles d'écran (393×852, 320×568, 430×932)
- I3 : Vérification texte agrandi 200%
- I4 : Vérification prefers-reduced-motion
- I5 : Vérification sans réseau

---

## 9. Contraintes de non-régression

1. **Aucun test existant ne doit casser** — les 34 fichiers de tests couvrent les moteurs purs ; ne jamais modifier les fichiers `engine/`, `store/`, `types.ts`
2. **Le store Zustand reste la source unique de vérité** — aucun état local dupliqué
3. **Aucun prix, disponibilité ou lieu inventé** — tout champ incertain = état `a_reserver` ou `null`
4. **La progression est sauvegardée automatiquement** — via le store existant (autosave localStorage)
5. **Aucune dépense, réservation ou diffusion de localisation sans accord explicite**

---

## 10. Décisions techniques

| Décision | Choix | Raison |
|---|---|---|
| CSS | CSS Modules feature (`adventure-prep.css`) | Déjà en place, cohérence, pas de Tailwind dans cette feature |
| State | Zustand store existant uniquement | Autosave, testé, source de vérité |
| Carte | `PrepMap.tsx` (MapLibre ou SVG fallback existant) | Cohérence avec le reste de l'app |
| Typographie | SF Pro system stack (`-apple-system`) | Aucune police web chargée |
| Animations | CSS transitions sur tokens `--prep-duration-*` | `prefers-reduced-motion` géré |
| Images | Photos réelles du dossier `project/maquette/photos/` pour les placeholders | Même jeu de données que la maquette |
