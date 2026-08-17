# Handoff : Formulaires & onglets Dashboard — Le Kit du Voyageur

## Vue d'ensemble

Ce package contient les maquettes desktop haute-fidélité pour **6 formulaires** de création/édition et la base d'un **onglet Dashboard développé (Aventures)** pour l'app Le Kit du Voyageur — une plateforme communautaire de voyageurs / randonneurs (aventures, carnets, clubs, boutique).

Les écrans livrés :

| # | Écran | Fichier |
|---|-------|---------|
| 1 | Ajouter une aventure | `Formulaire - Ajouter une aventure.html` |
| 2 | Nouveau carnet (récit / journal) | `Formulaire - Nouveau carnet.html` |
| 3 | Nouveau club (communauté durable) | `Formulaire - Nouveau club.html` |
| 4 | Nouveau groupe (sortie éphémère) | `Formulaire - Nouveau groupe.html` |
| 5 | Publier un post (fil communauté) | `Formulaire - Publier un post.html` |
| 6 | Modifier mon profil | `Formulaire - Modifier mon profil.html` |
| 7 | Dashboard · Onglet Aventures | `Dashboard - Aventures.html` *(voir statut)* |

**Statut de livraison :** Les 6 formulaires sont **complets**. L'onglet Dashboard Aventures est **partiellement construit** (le fichier HTML n'a pas été écrit à cause d'un arrêt en cours d'exécution). Le CSS partagé `dashboard.css` et la structure complète de la page sont documentés dans ce README — voir la section « Dashboard · onglets » plus bas. Les onglets **Carnets** et **Fidélité** restent à produire mais leur spécification est documentée ci-dessous.

---

## À propos des fichiers de design

Les fichiers HTML/CSS de ce bundle sont des **références de design** — des prototypes montrant l'apparence et le comportement voulus, **pas du code de production à copier directement**.

La tâche est de **recréer ces maquettes dans l'environnement du codebase existant** (React, Vue, SwiftUI, Flutter, natif…) en utilisant ses patterns et bibliothèques établis. Si aucun environnement n'existe encore, choisir le framework le plus adapté au projet.

Le repo source (kit du voyageur, GitHub `TFaraciColbert59/kitduvoyageur_1783951966810`) devrait exposer ses conventions — les respecter en priorité.

## Fidélité

**Haute-fidélité (hifi).** Les maquettes sont pixel-perfect : palette finale, typographie finale, spacings, ombres, rayons, animations et micro-interactions décrits. Le développeur doit reproduire le rendu à l'identique en utilisant les composants existants du codebase pour les primitives (Input, Button, Card, Toggle…) et en portant les tokens de design listés plus bas.

**Viewport cible :** Desktop uniquement, largeur cible **1440 px**, contenu centré dans un container `max-width: 1360px`. Le mobile n'est pas dans ce lot.

---

## Système de design partagé

Trois fichiers CSS servent de socle aux 7 écrans :

- **`tokens.css`** — Variables CSS (couleurs, typographie, radius, ombres, easings), reset, composants atomiques (`.lkv-btn`, `.lkv-logo`, `.lkv-chip`, `.lkv-icon`, `.lkv-glass`, `.lkv-eyebrow`).
- **`forms.css`** — Layout formulaire (topbar, hero, shell 2 colonnes, save-bar sticky) et composants formulaire (`.field`, `.f-segment`, `.f-chip-picker`, `.f-chip-choice`, `.f-switch`, `.f-upload`, `.f-photo-grid`, `.f-visibility`, `.f-steps`, `.f-people`, `.preview-card`, `.tips-card`).
- **`dashboard.css`** — Chrome Dashboard (`.d-hero`, `.d-topnav`, `.d-level`, `.d-tabs`, `.d-main`, `.d-card`, `.d-kpi-grid`, `.d-filter-row`).

### Tokens de design

#### Couleurs

```
Forêt (primaire)
--lkv-forest-950: #0B1F17    Fond profond, footer
--lkv-forest-900: #12281E    Gradients sombres
--lkv-forest-800: #1F4A3A    Primary · boutons, liens, accents
--lkv-forest-700: #2E6F57    Hover primary
--lkv-forest-600: #405E48    Mousse, texte sombre alternatif

Sauge (accent)
--lkv-sage-500:   #6DAA7D    Accent lumineux
--lkv-sage-300:   #AECBB4    Sur fond sombre
--lkv-sage-200:   #C8DDCC
--lkv-sage-100:   #DDEEE5    Brume, backgrounds subtils

Neutres
--lkv-ink-900:    #111614    Texte principal
--lkv-ink-700:    #2A322E    Texte secondaire
--lkv-ink-500:    #566159    Texte tertiaire
--lkv-ink-400:    #7A857C    Placeholders, labels muets
--lkv-ink-300:    #B5BDB7    Séparateurs
--lkv-stone-100:  #EFEEE9
--lkv-stone-50:   #F3F2ED    Input backgrounds
--lkv-paper:      #F8FAF8    Fond de page

Chaud (accent secondaire)
--lkv-warm-500:   #C99B5A    Badges "en cours", warnings doux
--lkv-warm-300:   #E4C695
--lkv-warm-100:   #FBF0DE    Badges, backgrounds

Sémantique
--lkv-danger:     #C15A5A    Suppression, danger zone
```

#### Typographie

```
Sans          : Manrope (300/400/500/600/700)
Serif accent  : Fraunces italic (400/500) — pour "em" décoratifs et bio
Mono          : JetBrains Mono (400/500) — pour KPI, IDs, dates système
```

Google Fonts (chargées dans `tokens.css`) :
```
Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500
Manrope:wght@300;400;500;600;700
JetBrains+Mono:wght@400;500
```

Échelle typographique (extraits utilisés dans les formulaires) :
- Hero `h1` : **56px / 500 / -0.03em / 1.0** (Manrope, avec `em` en Fraunces italic 400 en `--lkv-forest-800`)
- Section `h2` : **22px / 500 / -0.015em**
- Sub / lead : **18px** Fraunces italic 400, color `--lkv-ink-500`
- Body : **14px–15px / 400 / 1.55**
- Label : **12px / 500** letter-spacing 0.02em, color `--lkv-ink-700`
- Eyebrow : **11px / 500** letter-spacing 0.16em uppercase
- Helper / count : **11px** JetBrains Mono, color `--lkv-ink-400`

#### Radius

```
--lkv-r-xs: 6px   XS · badges
--lkv-r-sm: 10px  Inputs
--lkv-r-md: 16px  Zones dashed, blocks intérieurs
--lkv-r-lg: 24px  Cards
--lkv-r-xl: 28px  Section cards, hero
--lkv-r-2xl: 36px
--lkv-r-full: 999px  Pills (boutons, chips, save-bar)
```

#### Ombres

```
--lkv-shadow-xs: 0 1px 2px rgba(11,31,23,0.04), 0 1px 3px rgba(11,31,23,0.03)
--lkv-shadow-sm: 0 2px 8px rgba(11,31,23,0.06), 0 1px 2px rgba(11,31,23,0.04)
--lkv-shadow-md: 0 8px 24px rgba(11,31,23,0.08), 0 2px 6px rgba(11,31,23,0.04)
--lkv-shadow-lg: 0 20px 48px rgba(11,31,23,0.12), 0 4px 12px rgba(11,31,23,0.05)
--lkv-shadow-xl: 0 30px 80px rgba(11,31,23,0.16)
```

Le save-bar sticky en bas utilise `0 12px 40px rgba(11,31,23,0.12)` + `backdrop-filter: blur(24px)`.

#### Motion

```
--lkv-dur-fast: 160ms
--lkv-dur:      240ms
--lkv-dur-slow: 480ms
--lkv-ease:     cubic-bezier(0.4, 0, 0.2, 1)
--lkv-ease-out: cubic-bezier(0.16, 1, 0.3, 1)
```

Hover boutons : `transform: translateY(-1px)` + augmentation de shadow. Focus inputs : anneau `0 0 0 3px rgba(31,74,58,0.1)` + `border-color: --lkv-forest-800` + background passe de stone-50 à white.

---

## Structure commune aux formulaires

Tous les formulaires suivent la même architecture (voir `forms.css` pour les classes). Recréer cette structure comme un layout partagé dans le codebase cible.

```
FormPage
├── FormTopbar (sticky top)
│   ├── Logo + Breadcrumb (gauche)
│   └── StatusPill + Actions (droite: Sauver / Publier)
├── FormHero
│   ├── Eyebrow (uppercase, letter-spacing 0.16em)
│   ├── H1 (56px, Manrope + Fraunces italic sur mots-clés)
│   └── Lead (Fraunces italic 18px)
├── FormShell (grid 2 colonnes: 1fr / 380px, gap 32px)
│   ├── FormColumn (main)
│   │   └── FormSection[] — cartes blanches, radius 28px, padding 32px 36px
│   │       ├── sec-head (H2 + numéro serif)
│   │       ├── sec-sub (description, max-width 620px)
│   │       └── Fields (f-grid, thirds ou full)
│   └── FormAside (sticky top: 88px)
│       ├── PreviewCard (aperçu live du contenu créé)
│       ├── AsideCard "Progression / Checklist"
│       └── TipsCard (gradient forest sombre + accent sauge)
└── SaveBar (fixed bottom center, pill blanc glass)
    ├── Status (dot + texte de sauvegarde auto)
    └── Actions (Cancel / Preview / Primary CTA)
```

### Composants formulaire à implémenter

| Composant | Classe CSS ref | Usage |
|---|---|---|
| **Field** (label + input) | `.field` | Input, textarea, select stylés (fond `stone-50`, focus vert) |
| **InputGroup** (prefix/suffix) | `.f-input-group` | Icône ou unité (km, m D+, @) à gauche/droite du champ |
| **Select** custom | `.f-select` | Chevron SVG inline en background-image |
| **Segment** (radio pills) | `.f-segment` | 2–4 options courtes (Statut, Type de groupe…) |
| **ChipPicker** (tag input) | `.f-chip-picker` | Tags libres avec input intégré, chips supprimables |
| **ChipChoice** (multi-select) | `.f-chip-choice` | Options multiples avec check ✓ quand actif |
| **Switch** | `.f-switch` | Toggle 44×24 avec état `on` (fond forest-800) |
| **Upload** (dropzone) | `.f-upload` | Zone dashed avec icône ronde, hover sauge |
| **PhotoGrid** | `.f-photo-grid` | 4 colonnes, ratio 4/3, badge "Couverture" |
| **Visibility** (radio cards) | `.f-visibility` | 3 grandes cartes (Public / Clubs / Privé) |
| **Steps** (drag list) | `.f-step-row` + `.f-add-step` | Étapes itinéraire, chapitres, règles |
| **PeopleRow** | `.f-person-row` | Participant avec avatar, pseudo, rôle |
| **Checklist** | `.check-item` (done/now/vide) | Barre de progression dans l'aside |
| **PreviewCard** | `.preview-card` | Aperçu live d'aventure/carnet en cours |
| **TipsCard** | `.tips-card` | Gradient forest sombre, conseil éditorial |

---

## Détail par écran

### 1. Formulaire — Ajouter une aventure

**Fichier :** `Formulaire - Ajouter une aventure.html`
**Route suggérée :** `/aventures/nouvelle`
**But :** Créer un nouvel enregistrement d'aventure (sortie randonnée / bivouac / trail).

**Sections (dans l'ordre) :**

1. **Le voyage** (01 · L'essentiel) — Titre, sous-titre serif, type d'aventure (select), massif/région.
2. **Quand & avec qui** (02 · Cadre) — Dates départ/retour, durée auto-calculée, statut (segmented: Planifiée/En cours/Terminée), liste de participants avec avatars (chaque ligne = avatar 40px + nom + rôle admin/membre + bouton retirer) + input d'ajout par email/pseudo.
3. **La trace** (03 · GPX & profil) — Aperçu 2 colonnes : carte SVG stylisée (dégradé sauge, tracé sombre, waypoints) + profil d'altitude SVG (aire dégradée, ligne, KPI min/moy/max/D-). En dessous : dropzone GPX.
4. **Les étapes** (04 · Itinéraire) — Liste drag-and-drop `.f-step-row` (grip + numéro romain italique + titre éditable + méta mono + supprimer). Bouton "Ajouter une étape" dashed.
5. **Cadres techniques** (05 · Difficulté) — Échelle T1–T5 avec 5 cartes cliquables. Puis 3 champs : distance (km), D+ (m), temps effectif. Puis chips ambiances (Crêtes, Refuge gardé, Brume…).
6. **Les images** (06 · Souvenirs) — Grille photos 4 colonnes, ratio 4/3, badge "Couverture" sur la 1ère + bouton "×" au survol + tuile "+".
7. **Qui peut voir** (07 · Confidentialité) — 3 cartes Publique / Clubs / Privée.

**Aside :**
- PreviewCard avec cover + titre + méta
- Checklist "Préparation 68 %" avec 6 étapes (fait/en cours/à faire)
- Card "Conditions prévues" — 3 jours de météo mini
- TipsCard conseil rédaction

**SaveBar :** `[Supprimer] [Aperçu] [Publier l'aventure]`

### 2. Formulaire — Nouveau carnet

**Fichier :** `Formulaire - Nouveau carnet.html`
**Route :** `/carnets/nouveau`
**But :** Créer un récit / journal de voyage adossé à une aventure.

**Sections :**
1. **Couverture & titre** — Grande cover image 300px avec overlay actions + preview du titre en gros. Puis champs titre / sous-titre / chapô (textarea Fraunces italic).
2. **Aventure racontée** — Liste de 3 aventures existantes en cards cliquables (thumb 80×56 + titre + méta). L'aventure sélectionnée a le fond sauge-100 + border forest-800. Bouton "Créer un carnet sans aventure liée".
3. **Style de lecture** (typographie) — 3 tuiles avec échantillon "Aa" en 3 styles (Journal mixed / Reportage sans / Récit serif italic).
4. **Les chapitres** — Liste `.chapter` avec grip + numéro romain italique + titre + méta (mots · photos · statut rédigé/brouillon) + 3 boutons actions ronds.
5. **Mots-clés & classement** — ChipChoice thématiques (Bivouac, Chartreuse, Solo…) + ChipPicker tags libres.
6. **Diffusion & audience** — Segmented "Quand publier" (Brouillon/Maintenant/Planifier) + 3 cartes visibilité + toggles (commentaires, recommander, PDF).

**Aside :** PreviewCard, Checklist "Rédaction 65 %", TipsCard "Une image tous les 350 mots".

**SaveBar :** `[Aperçu lecteur] [Enregistrer] [Publier le carnet]`

### 3. Formulaire — Nouveau club

**Fichier :** `Formulaire - Nouveau club.html`
**Route :** `/clubs/nouveau`
**But :** Créer une communauté durable autour d'un massif + pratique.

**Sections :**
1. **L'identité du club** — Grande cover 260px avec overlay showcasing logo blanc + nom du club en grand + baseline + 3 stats (Membres/Admin/Sorties). Puis champs nom / baseline serif / description longue.
2. **Thématique & terrain** — Catégorie (select), rythme, ChipChoice zones géo (multi-sélection), ville d'ancrage, max membres.
3. **Les règles du club** — Liste `.rule-row` (icône 36×36 + input titre + input description + bouton supprimer). Bouton "Ajouter une règle".
4. **Admins & permissions** — Liste admins (avatar 48px + nom + select rôle Fondatrice/Co-admin/Modérateur) + input d'ajout. Puis 3 toggles (validation manuelle, sorties, discussion).
5. **Visibilité & adhésion** — 3 cartes (Public/Sur invitation/Privé) + champ lien d'invitation avec bouton "Copier".

**Aside :** Card explicative "Créer un club", Checklist 4/6, TipsCard "Groupe plutôt ?" avec lien vers Formulaire - Nouveau groupe.

**SaveBar :** `[Enregistrer en brouillon] [Aperçu public] [Créer le club]`

### 4. Formulaire — Nouveau groupe

**Fichier :** `Formulaire - Nouveau groupe.html`
**Route :** `/groupes/nouveau`
**But :** Groupe éphémère pour organiser une sortie précise.

**Sections :**
1. **Le groupe** — Hero card gradient forest 900→800 avec pictogramme carré 96×96 + titre serif + méta. Puis nom, description courte, sélecteur de couleur (6 pastilles rondes), sélecteur d'emoji picto (grille 6 col).
2. **Sortie concernée** — Aventure liée en card sauge-100 (thumb + titre + bouton "Changer"). Puis dates début/fin, type (segmented: Ponctuel/Récurrent/Ouvert), effectif max.
3. **Inviter les participants** — Onglets segmented (Pseudo interne / Email / Lien d'invitation). Puis ChipPicker avec chips avatars intégrés. Puis "Suggestions · derniers partenaires" (4 lignes contact avec bouton ✓ Ajoutée / + Inviter). Puis card "Lien d'invitation · groupe privé" avec URL mono dans pill + bouton Copier + expiration.
4. **Permissions du groupe** — 5 toggles (inviter, chat, position temps réel, liste logistique, archivage auto).

**Aside :** Card statut avec avatars empilés, card "Groupe ou club ?" (2 blocs comparatifs), TipsCard.

**SaveBar :** `[Annuler] [Créer sans inviter] [Créer & envoyer les invitations]`

### 5. Formulaire — Publier un post

**Fichier :** `Formulaire - Publier un post.html`
**Route :** `/posts/nouveau`
**But :** Publier un post court sur le fil communauté ou dans un club.

**Sections :**
1. **Type de publication** — 4 tuiles avec icône (Photo/vidéo, Note, Question, Événement).
2. **Le contenu** — Titre optionnel, puis éditeur rich text avec toolbar (B, I, U, séparateur, H, citation, liste, séparateur, lien, image, mention, spacer, MD). Zone contenteditable stylée. Compteur mots.
3. **Photos & vidéos** — Dropzone + media strip 4 colonnes (thumb photo/vidéo avec badge play triangle).
4. **Liens internes** — Aventure liée (select), Carnet lié (select), Localisation (input avec bouton Détecter), Tags (ChipPicker), Mentions (ChipPicker avec avatars).
5. **Où publier** — 3 cartes audience (Fil public / Un club / Abonnés) + ChipChoice de clubs + Segmented "Quand publier" + 2 toggles.

**Aside :** PostPreview LIVE (avatar + nom + méta + contenu + footer stats), Checklist "Post bien parti" 92 %, TipsCard "Meilleur moment : 19h".

**SaveBar :** `[Enregistrer] [Planifier] [Publier maintenant]`

### 6. Formulaire — Modifier mon profil

**Fichier :** `Formulaire - Modifier mon profil.html`
**Route :** `/compte/profil`
**But :** Édition du profil voyageur (avatar, bio, disciplines, comptes liés, confidentialité).

**Sections :**
1. **Identité publique** — Cover image 220px avec actions overlay + bloc avatar 96px avec bouton édit rond + infos (nom, pseudo, membre depuis) + boutons droite. Puis champs prénom/nom/nom d'usage/pseudo (avec vérification disponibilité), bio courte (Fraunces italic textarea), À propos (textarea long).
2. **Ancrage géographique** — Ville, pays, ChipChoice massifs favoris, fuseau, langues (ChipPicker).
3. **Pratiques & niveau** — DisciplineGrid 4 col (8 tuiles avec icône + label), LevelPicker 4 col (I Curieuse / II Régulière / III Explorateur / IV Guide — la sélection prend fond forest-800 + texte blanc), 3 champs métriques (distance moy, D+ confortable, rythme).
4. **Comptes liés** — Liste `.linked-row` (Strava, Garmin, Polar, Visorando) avec logo mono, nom, statut, bouton Déconnecter/Connecter.
5. **Qui peut voir quoi** (confidentialité) — 5 toggles alignés.

**Aside :** Profile preview card (gradient forest sombre, avatar centré, nom, bio italic, badges), Checklist complétude 82 %, TipsCard.

**SaveBar :** `[Annuler] [Aperçu] [Enregistrer les changements]`

---

## Dashboard · onglets

### Chrome partagé (`dashboard.css`)

Tous les onglets Dashboard partagent :

1. **Hero photographique** 380 px min — image de fond montagne + overlay gradient sombre. Contient :
   - Nav flottante glass pill : logo blanc + liens (Aventures, Refuges, Boutique, Carnet, Clubs, Mon compte actif) + icônes search/notif
   - Breadcrumb
   - Ligne principale grid `auto 1fr auto` : avatar rond 120px + info (eyebrow, H1 48px "Marceline *Chevrier.*", citation serif) + actions (bouton primary blanc "Nouvelle X" + bouton glass secondary)
2. **Level strip** — Barre glass forest sombre grid `2fr 1fr 1fr 1fr 1fr` : badge niveau III doré + label "Explorateur" + barre progression + puis 4 stats (sorties, carnets, clubs, distance)
3. **Tabs bar** sticky — 7 onglets : `Vue d'ensemble | Aventures 42 | Carnets 12 • | Clubs 4 | Commandes 18 | Fidélité 1240 | Paramètres`. L'onglet actif prend `color: --lkv-forest-800` + underline forest-800 2px. Chaque tab affiche un nombre en Fraunces italic 12px, color sage-500 quand actif.
4. **Main content** — Padding `32px 60px 40px`, max-width 1440, layout typiquement `1fr 320px` (contenu / aside).

### Onglet Aventures (partiellement livré)

Le fichier `Dashboard - Aventures.html` n'a pas été écrit sur disque (interruption). Le CSS partagé `dashboard.css` est prêt. Contenu à implémenter :

- **Section-head** : H2 "Toutes vos *aventures*" + sub italic + actions (Exporter GPX + Nouvelle aventure).
- **4 KPI cards** : Distance 2026 (786 km, ↑18%), Dénivelé (32,4 km D+), Nuits refuge (28), CO₂ économisé (142 kg).
- **Chart annuel** : Grille 12 mois, bars verticales dégradé sage→forest, hauteur proportionnelle au nombre de sorties, valeur en haut, mois en bas (Jan…Déc). Pic en octobre (bar warm).
- **Filter row** : chips Année (2026/2025/2024/2023), Statut (Toutes/Terminées/Planifiées/Brouillons), Massifs.
- **Liste aventures riches** `.adv-item` : grid `140px 1fr auto auto auto` — thumb 140×90 + info (nom, dates, participants avatars empilés, tags sauge) + KPI mono (distance, D+, difficulté T3) + status pill + actions (edit/arrow).
- **Bouton "Charger 34 aventures plus anciennes"**
- **Carte régionale** SVG France avec dots forest (taille = nombre de sorties) et labels : Chartreuse 18, Belledonne 9, Vercors 6…
- **Aside** : Next voyage card (gradient forest, "Traversée Chartreuse J-16"), Top massifs (rank I–V avec barres progression), "Meilleur mois : Octobre" avec record personnel.

### Onglet Carnets (spec, non livré)

- KPIs : 12 carnets publiés / 3 428 lectures / 214 likes / 87 commentaires
- Grille de cards carnets 3 colonnes (cover 4/3 + badge Publié/Brouillon + titre serif overlay + stats footer)
- Section "Brouillons en cours" : chapitres à finir avec progress
- Aside : Top lecteurs (5 abonnés les + engagés), calendrier de publication (mini calendar avec dots), suggestion de sujet à écrire

### Onglet Fidélité (spec, non livré)

- Hero XP animé : jauge circulaire "1 240 / 1 800" avec dégradé
- Historique gains/dépenses points (timeline verticale)
- Grille badges (18 gagnés + 24 à débloquer) — earned dorés, locked grisés
- Avantages Guide (liste des perks abonnement)
- Prochains jalons (2 nuits avant "Bivouac étoilé", etc.)
- Historique récompenses échangées (table)

---

## Interactions & comportements

### Sauvegarde auto
Tous les formulaires affichent un `status-dot` "Modifications non enregistrées" (warm) qui bascule en "Sauvegardé" (sage) après un debounce de ~800 ms sur tout champ modifié. La save-bar en bas montre le même statut sous forme de dot pulsant.

### Progression checklist
La checklist aside se met à jour en temps réel selon les champs remplis. Chaque item a un état `done` (fond forest-800, ✓), `now` (encadré warm-500), vide. Le pourcentage se recalcule.

### Chip pickers
- **ChipPicker (tags)** : input libre, Entrée valide un chip. Backspace retire le dernier chip si l'input est vide.
- **ChipChoice (multi-select)** : click toggle. État actif : fond sauge-100 + border forest-800 + préfixe ✓ auto.

### Segmented control
Un seul choix actif à la fois. Fond blanc + shadow-xs. Transition 160 ms.

### Switch
Toggle de 44×24 → 22×22 ball. Fond `rgba(11,31,23,0.14)` off / `--lkv-forest-800` on. Transition 240 ms sur `background` et `left` de la ball.

### Upload / Photo grid
- Dropzone hover : fond sauge-100 + border forest-800 solid.
- PhotoGrid : bouton rm rond `rgba(11,31,23,0.7)` en top-right. Badge "Couverture" bottom-left.

### Save bar
Position `fixed`, bottom 24, translate -50%. `min-width: 640px`. Reste toujours au-dessus du contenu grâce à z-index 100.

### États hover boutons
- Primary : `translateY(-1px)` + shadow accrue
- Outline : fond `rgba(31,74,58,0.06)` + border forest-800
- Ghost : fond `rgba(11,31,23,0.05)`

### Focus inputs
Border forest-800 + anneau `0 0 0 3px rgba(31,74,58,0.1)` + background stone-50 → white.

---

## State management à prévoir

Chaque formulaire nécessite :

- **`draftId`** : ID de brouillon persisté server-side (auto-save)
- **`formData`** : objet mappant chaque champ (validé côté client + serveur)
- **`isDirty`** : boolean pour l'indicateur "modifications non enregistrées"
- **`saveStatus`** : `'idle' | 'saving' | 'saved' | 'error'`
- **`completionPercent`** : dérivé de `formData` (voir logique par formulaire)
- **`previewData`** : dérivé de `formData` pour l'aperçu live dans l'aside

Pour les Dashboards :
- **`activeTab`** : synchronisé avec URL (`?tab=aventures`)
- **`filters`** : `{ year, status, massifs[] }`
- **`sortBy`** : `'date' | 'distance' | 'denivele'`

---

## Assets

**Images :** Toutes les images du bundle utilisent Unsplash (URLs publiques stables) — à remplacer par vos assets réels ou une CDN équivalente en production. Exemples utilisés :
- Portraits : `unsplash.com/photo-1544005313-94ddf0286df2`, `photo-1494790108377-be9c29b29330`, `photo-1438761681033-6461ffad8d80`, `photo-1500648767791-00dcc994a43e`, `photo-1534528741775-53994a69daeb`
- Paysages montagne : `photo-1464822759023-fed622ff2c3b`, `photo-1519681393784-d120267933ba`, `photo-1454496522488-7a8e488e8606`, `photo-1483729558449-99ef09a8c325`, `photo-1470114716159-e389f8712fda`, `photo-1533228876829-65c94e7b5025`, `photo-1533105079780-92b9be482077`, `photo-1506905925346-21bda4d32df4`, `photo-1447752875215-b2761acb3c5d`

**Icônes :** Toutes les icônes sont inline SVG, tracé 1.6px, `stroke-linecap: round` + `stroke-linejoin: round`. Le style est cohérent (voir `.lkv-icon` dans `tokens.css`). Aucune police d'icônes externe. En production, extraire vers une icon library.

**Logo :** SVG inline dans chaque topbar (marque « montagne stylisée »). À convertir en composant `<Logo />`.

**Emoji :** utilisés dans l'emo-picker du formulaire groupe (🏔🥾⛺🏕🌲🌄🧗🚵🎒🌊🌌🏞). En production : bibliothèque d'emoji native ou remplacer par SVG.

**Météo, difficulté GPX** : les visualisations SVG (chart altitude, carte trace, chart annuel, carte régionale) sont des maquettes purement décoratives. En production, brancher sur les vraies données GPX / Météo-France.

---

## Fichiers dans ce bundle

```
design_handoff_kit_voyageur_forms/
├── README.md                                    (ce fichier)
├── tokens.css                                   (variables & primitives)
├── forms.css                                    (layout & composants formulaires)
├── dashboard.css                                (chrome dashboard)
├── Formulaire - Ajouter une aventure.html
├── Formulaire - Nouveau carnet.html
├── Formulaire - Nouveau club.html
├── Formulaire - Nouveau groupe.html
├── Formulaire - Publier un post.html
└── Formulaire - Modifier mon profil.html
```

**À produire (non inclus car interruption d'exécution) :**
- `Dashboard - Aventures.html` — CSS prêt (`dashboard.css`), spec complète dans ce README
- `Dashboard - Carnets.html` — spec dans ce README, à concevoir
- `Dashboard - Fidélité.html` — spec dans ce README, à concevoir

---

## Prochaines étapes suggérées

1. **Extraire les tokens** dans le format du codebase (JS objects, Tailwind config, ou SwiftUI Color extensions).
2. **Créer les composants de base** avant d'attaquer les écrans : `Input`, `Textarea`, `Select`, `Switch`, `Segmented`, `ChipPicker`, `Card`, `Button` (primary/light/outline/ghost/ghost-light), `Checklist`, `SaveBar`.
3. **Créer un layout partagé `FormPage`** avec slots pour Topbar / Hero / Column / Aside / SaveBar.
4. **Implémenter les 6 formulaires** un par un — ils partagent 80 % de leur structure.
5. **Finaliser les 3 onglets Dashboard** en réutilisant la chrome (`.d-hero`, `.d-tabs`, `.d-level`).
6. **Brancher la persistance brouillon** (auto-save avec debounce 800 ms).
7. **Ajouter les validations** (côté client + serveur — voir sections avec `<span class="req">*</span>`).
