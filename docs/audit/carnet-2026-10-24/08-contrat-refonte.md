# Contrat de refonte — fiche carnet en style Communauté

**Date :** 24 octobre 2026
**Statut :** proposition historique — **remplacée par `10-spec-visuelle-carnet.md`** pour toute décision de design. Conservée pour l’analyse des variantes A/B et du phasage.

> **Note du 24/10 12 h :** la référence unique est désormais le Compte + la Communauté. La spec finale (`10-spec-visuelle-carnet.md`) verrouille une seule colonne 520, une seule police, un seul sélecteur et un seul bouton. Les mentions de serif éditorial ci-dessous ne sont plus la cible.
**Base :** `docs/audit/carnet-2026-10-24/AUDIT-COMPLET.md`
**Référence :** `/communaute` (spec `docs/superpowers/specs/2026-10-23-communaute-feed-design.md`)
**Périmètre proposé :** `/carnets/[id]` uniquement. Le hub `/carnets` et `/clubs/[id]` sont hors scope, mais partagent la CSS `lkdv-social-detail` — à traiter dans un lot séparé.

---

## 1. Intention

Faire de la fiche carnet **un objet de la Communauté** : un récit de terrain qu'on lit, qu'on aime, qu'on commente et qu'on partage, dans la même grammaire visuelle que le feed — pas une page de magazine avec sidebars, certifications et doubles navigations.

Trois principes :

1. **Une seule colonne.** La largeur est celle du feed (430–520 mobile, 520–640 desktop). Le contenu respire verticalement.
2. **La donnée réelle est la seule source.** Aucun nom, chiffre, badge, photo ou certification inventé. Si une donnée manque, on affiche un état vide.
3. **Le carnet est un post augmenté.** En-tête auteur + cover + actions + récit, puis des sections empilées (étapes, carte, moments, kit, nature), puis les commentaires.

---

## 2. Deux variantes

### Variante A — « Carnet social » (recommandée)

```
┌──────────────────────────────────────────┐
│  ‹  Carnet                          ···  │  header minimal, safe-top
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  (avatar) Camille Rochat     ···   │  │  pastille auteur, verre
│  │  @camille · il y a 3 j             │  │
│  │                                    │  │
│  │           COVER 4:5                │  │  vraie cover, radius 28
│  │                                    │  │
│  │                     (♥) (◻) (➤)    │  │  capsule d'actions
│  └────────────────────────────────────┘  │
│                                          │
│  Tour du Mont-Blanc                      │  H1 display
│  en autonomie complète                   │  serif italique
│  « Dix jours, trois pays… »              │  sous-titre
│                                          │
│  ┌ 106 km  ·  2 002 m D+  ·  2 jours ┐  │  stats réelles, une ligne
│                                          │
│  ── Récit ─────────────────────────────  │  sections en cartes verre
│  ┌────────────────────────────────────┐  │
│  │  Étape 1 · Chamonix → Les Houches  │  │
│  │  …                                   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Carte & trace                      │  │  lazy, 16:9
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Moments (2)                        │  │  grille 1:1 / 4:5
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Dans le sac · 4,2 kg               │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Commentaires (3)                   │  │  vrais commentaires
│  └────────────────────────────────────┘  │
│                                          │
│  ╭ Explorer Compas Matériel Hub Compte ╮ │  barre basse 48 px
└──────────────────────────────────────────┘
```

**Pour :** fidèle à la demande, cohérent avec le feed, une seule colonne à maintenir, responsive simple, lecture mobile-first.
**Contre :** perte de la « fiche technique » latérale ; la carte et les étapes prennent de la hauteur ; le desktop peut paraître étroit pour un contenu riche.

### Variante B — « Carnet éditorial augmenté »

```
┌────────────────────────────────────────────────────────────┐
│  ‹  Carnet                                             ···  │
│                                                            │
│  ┌──────────────────────────────┐  ┌────────────────────┐  │
│  │        COVER 16:9            │  │  Auteur            │  │
│  │                              │  │  Stats             │  │
│  │                              │  │  Actions           │  │
│  └──────────────────────────────┘  └────────────────────┘  │
│  Titre / sous-titre                                         │
│  ┌──────────────────────────────┐  ┌────────────────────┐  │
│  │  Récit, étapes, moments      │  │  Carte sticky      │  │
│  │                              │  │  Kit               │  │
│  └──────────────────────────────┘  └────────────────────┘  │
│  Commentaires                                               │
│  ╭ Explorer Compas Matériel Hub Compte ╮                   │
└────────────────────────────────────────────────────────────┘
```

**Pour :** garde la densité éditoriale et la carte visible, plus confortable en 1280–1440.
**Contre :** retombe dans un layout à colonnes, s'éloigne du feed, deux coquilles à maintenir, risque de rejouer le bug 768.

**Recommandation : A**, avec une exception desktop : passer la colonne à **640 px** au-delà de 1200 px, et afficher la carte en pleine largeur de colonne. Si le contenu carte doit rester visible en permanence, utiliser un bouton « Voir la carte » qui ouvre une sheet plein écran, pas une colonne sticky.

---

## 3. Anatomie cible (variante A)

### 3.1 Header

| Élément | Spécification | Action |
|---|---|---|
| Retour | 44×44, chevron, verre, `aria-label="Retour aux carnets"` | `/carnets` ou historique |
| Titre | `Carnet` en 17 semibold, ou vide | — |
| Menu `···` | 44×44, verre | Partager, copier le lien, signaler, exporter (si owner) |
| Fond | transparent, sticky, `safe-top` | — |

Pas de breadcrumb, pas de logo, pas de Header global desktop. La page est autonome.

### 3.2 En-tête de post

| Élément | Spécification | Source |
|---|---|---|
| Pastille auteur | avatar 36, nom 13/600, handle 11, verre, radius 999 | `public_profiles` |
| Date | `il y a 3 j` ou date de fin | `created_at`/`end_date` |
| Cover | ratio 4:5 mobile, 16:9 desktop, radius 28, `object-fit: cover` | `cover_image` ; fallback dégradé |
| Actions | capsule verre, 3 boutons 44×44 : like, commentaire, partage | — |
| Like | cœur, `aria-pressed`, compteur réel | `carnet_likes` |
| Commentaire | bulle, compteur réel, ouvre la sheet | `carnet_comments` |
| Partage | `navigator.share` → clipboard | URL canonique |
| Favori | dans le menu `···` (comme le post Communauté) | `carnet_favorites` |

### 3.3 Corps

| Section | Contenu | Rendu |
|---|---|---|
| Titre | `title` complet, H1 display ; sous-titre serif italique si `description` | texte |
| Méta | destination, période, voyageurs, difficulté **si réelle** | ligne discrète |
| Stats | distance, dénivelé, durée, moments, hébergements — **uniquement si valeur réelle** | 3–5 cellules |
| Récit | `description` longue + étapes | carte verre |
| Étapes | `TimelineJours` avec vraies étapes / hébergements | timeline |
| Carte | `CarnetMap` lazy, 16:9, état vide explicite | carte |
| Moments | grille 1:1 ou carrousel, `carnet_media` + `carnet_moments` | grille |
| Kit | `KitSouvenirCard` avec poids réel | carte |
| Nature | `SpeciesIdentifier` avec auth gate et persistance | carte |
| Commentaires | liste réelle + formulaire, 3 derniers + « voir tout » | carte / sheet |

### 3.4 Barre basse

La barre du Compte/Communauté, 48 px, 5 onglets. **Pas de plateau carnet.** Les sections se naviguent par ancres ou par un sommaire discret en haut du corps (chips « Récit · Étapes · Carte · Moments · Kit »), scroll horizontal, 44 px de haut.

---

## 4. Contrat de matériau et de typographie

### 4.1 Tokens

| Usage | Token | Valeur |
|---|---|---|
| Fond | `.lkv-app-background` | photo globale + voile |
| Verre carte | `--community-glass` | `rgba(255,255,255,.62)` |
| Verre capsule | `--community-capsule` | `rgba(255,255,255,.65)` |
| Verre fort | `--community-glass-strong` | `rgba(255,255,255,.72)` |
| Encre | `--lkv-forest-900` | `#0F2A1D` (rescope local) |
| Encre secondaire | `--lkv-forest-600` | `#365233` |
| Accent | `--lkv-forest-500` | `#5B7F55` |
| Danger | `--lkv-danger` | `#A8443A` |
| Rayon carte | `--lkv-radius-card` / 28 px | — |
| Rayon capsule | 999 px | — |
| Ombre | `--bar-glass-shadow` | — |

**Règle :** la fiche carnet rescope `--lkv-text-primary/secondary/muted` sur `--lkv-forest-*` comme `.lkdv-community-experience` (`community-social.css:800-835`). Elle ne reste **pas** en blanc sur photo. Si un thème sombre est nécessaire, il est explicite (`.dark`) et testé.

### 4.2 Typographie

| Niveau | Style |
|---|---|
| H1 | display 32–40, poids 700, interligne 1.08 |
| H1 line 2 | serif italic, même taille, couleur forest 700 |
| Sous-titre | serif italic 16–18, forest 700 |
| H2 section | display 20–24, 700 |
| Corps | sans 15/1.55, forest 800 |
| Citation | serif italic 16/1.5 |
| Label | mono 11–12, uppercase, tracking 0.12em |
| Stats | mono 20–28, tabular-nums |

Minimum **12 px** pour les labels ; plus de 10 px.

### 4.3 Rythme

- Gouttière de colonne : 16 px mobile, 24 px desktop.
- Entre cartes : 12 px mobile, 16 px desktop.
- Padding carte : 16–20 px.
- Sections : 32 px de séparation.
- Un seul niveau d'ombre ; pas d'ombre sur chaque badge.

---

## 5. Mapping des composants

| Actuel | Cible | Action |
|---|---|---|
| `CarnetView` (double arbre) | `CarnetPageShell` + `CarnetBody` | Réécrire, un seul arbre |
| `Header` global desktop | `CarnetTopBar` | Nouveau, minimal |
| `CarnetDetailVerticalTabs` | `CarnetSectionNav` (chips/ancres) | Remplacer |
| `CarnetDetailRightSidebar` | `CarnetMetaCard` (dans le flux) | Fusionner, supprimer les faux badges |
| `CarnetHero` | `CarnetPostHeader` (auteur + cover + actions) + `CarnetTitle` | Scinder |
| `StatsBar` | `CarnetStats` | Garder, filtrer les vraies valeurs |
| `CarnetMap` | `CarnetMap` | Garder, `dynamic` + intersection, état vide |
| `TimelineJours` | `CarnetTimeline` | Garder, corriger l'appariement |
| `MomentCard` | `CarnetMomentCard` | Utiliser `imageUrl`, likes réels, pas de random |
| `KitSouvenirCard` | `CarnetKitCard` | Passer le poids réel, catégories réelles |
| `RandonneesSouvenirCard` | `CarnetMediaGrid` ou supprimer | Les « randonnées » sont des étapes, pas des sorties |
| `SpeciesIdentifier` | `CarnetSpeciesCard` | Auth gate, `momentId`, persistance |
| `CommentsSheet` | `CarnetComments` + `CarnetCommentComposer` | Brancher `carnet_comments` |
| `MobileCarnetDetailView` | — | Supprimer, fusionner dans `CarnetBody` |
| `LocalCarnetRenderer` | route `/carnets/brouillon/[id]` | Déplacer |
| `NavigationPlateau` branche carnet | — | Supprimer la branche carnet |
| CSS `lkdv-social-detail` partagée | `carnet-social.css` | Découpler des clubs |

---

## 6. Contrat de données

### 6.1 Champs à ajouter à `CarnetData`

```ts
meta: {
  // existants…
  coverImage?: string;
  coverImageAlt?: string;
  handle?: string;
  publishedAt?: string;
  periodLabel?: string;        // "26 sept. – 2 oct. 2026"
  verified?: boolean;          // vrai badge, ou rien
  difficulty?: string | null;  // seulement si réel
}
engagement: {
  likes: number;
  comments: number;
  views: number;
  viewerLiked: boolean;
  viewerSaved: boolean;
}
```

Les commentaires ne doivent pas être dans `CarnetData` (payload RSC) : les charger à l'ouverture de la sheet via une route ou un client Supabase, pour garder la page légère.

### 6.2 Requêtes cibles

| Donnée | Table | Filtre | Note |
|---|---|---|---|
| Carnet | `carnets` | `id` | client serveur, session |
| Auteur | `public_profiles` | `id` | vue filtrée |
| Étapes | `groupe_etapes` **ou** `carnet_moments` | `groupe_id`/`carnet_id` | ne pas inventer |
| Hébergements | `groupe_hebergements` **ou** rien | — | ne pas inventer |
| Moments | `carnet_moments` | `carnet_id` | `limit`, ordre |
| Médias | `carnet_media` | `carnet_id` | `position` |
| Kit | `carnet_kit_items` | `carnet_id` | somme réelle |
| Likes | `carnet_likes` | `carnet_id` | `count` + `viewer` |
| Commentaires | `carnet_comments` | `carnet_id` | pagination |
| Vues | `carnet_views` | insert | une fois/session |
| Favori | `carnet_favorites` | `carnet_id,user_id` | — |

### 6.3 Règles de vérité

1. Aucun total divisé par un nombre de jours.
2. Aucune distance/dénivelé affichée si la source est absente.
3. Aucun nom/avatar par défaut.
4. Aucune certification sans `verified=true` et sans preuve (trace/session).
5. Aucune photo tierce en fallback : dégradé de marque + initiales.
6. Les compteurs viennent des tables, pas des colonnes `*_count` (ou les colonnes sont maintenues par trigger et testées).

---

## 7. Contrat des interactions

| Action | Anonyme | Connecté | Persistance |
|---|---|---|---|
| Like | Ouvre la connexion | Upsert/delete `carnet_likes`, cœur plein | Oui, idempotent |
| Commentaire | Ouvre la connexion | Insert `carnet_comments`, optimistic | Oui |
| Réponse | Oui (si threaded) | Insert avec `parent_id` | Oui si migration |
| Favori | Ouvre la connexion | Upsert/delete `carnet_favorites` | Oui |
| Partage | `navigator.share`/clipboard | idem | — |
| GPX | Désactivé si pas de trace | Téléchargement réel | — |
| Export | Owner seulement (ou version publique minimale) | JSON/PDF | — |
| Kit check | Local | Local + sync (option) | localStorage |
| Species | Auth gate | Upload + résultat persisté | `identified_species` |
| Vues | Insert | Insert | 1/session |

**Règle :** aucune action n'affiche un toast de succès avant la confirmation serveur. Optimistic UI avec rollback.

---

## 8. États

| État | Rendu |
|---|---|
| Chargement | Skeleton de la coquille cible (header, cover, 3 cartes), pas l'ancien `loading.tsx` |
| Public anonyme | Page complète, actions = CTA de connexion |
| Connecté | Actions actives, compteurs viewer |
| Privé / owner | Bandeau « Carnet privé », actions owner (éditer, partager, exporter) |
| Privé / autre | 404 réel, pas de fuite d'existence |
| Introuvable | `notFound()` + page 404 designée |
| Erreur | `error.tsx` avec message et « Réessayer » |
| Vide | Sections absentes ou état vide illustré, jamais de faux contenu |
| Sans trace | Carte désactivée + « Aucune trace GPS » ; pas de GPX |
| Sans image | Dégradé de marque + initiales |
| Hors ligne | Bandeau + contenu cache si disponible |

---

## 9. Responsive

| Breakpoint | Layout |
|---|---|
| < 480 | colonne 100 %, padding 14–16, cover 4:5 |
| 480–767 | colonne 100 %, max 520, cover 4:5 |
| 768–1199 | colonne 520–640 centrée, cover 16:9, **pas de sidebars** |
| ≥ 1200 | colonne 640–720 centrée, cover 16:9, éventuellement carte en pleine largeur |
| ≥ 1600 | colonne 720, marges larges |

**Interdit :** sidebars fixes, `h-[100dvh] overflow-hidden`, double barre, contenu qui dépend du scroll interne.

---

## 10. Accessibilité et performance — budgets

### A11y

- Cibles ≥ 44×44 partout.
- Contraste ≥ 4.5:1 pour le texte, ≥ 3:1 pour les icônes.
- Focus visible sur tous les contrôles.
- Scroll document (ou conteneur focusable) ; `PageDown` fonctionne.
- H1 unique, H2 par section, H3 pour les cartes.
- `role="tablist"`/`aria-selected` ou `aria-current` pour les sections.
- `alt` éditorial pour les photos, tuiles décoratives `alt=""`.
- `prefers-reduced-motion` respecté.
- Test axe + navigation clavier + VoiceOver sur 430 et 1440.

### Perf

- JS route < **150 Ko gzip**.
- LCP < **2,5 s** sur 4G simulée ; cover `priority`, dimensions explicites.
- Leaflet chargé seulement à l'intersection.
- Images `next/image` avec `sizes`, AVIF/WebP.
- Pas de requête Supabase en cascade : une lecture serveur + un lot engagement.
- CSS route-scopé, pas de nouvelle feuille globale.

---

## 11. Plan de migration

### Lot 1 — Vérité données (1–2 j)

- Corriger le client Supabase de `getCarnetComplet`.
- Supprimer `groupe_etapes`/`groupe_hebergements` ou les créer.
- Supprimer les auteurs/photos/chiffres inventés.
- Brancher `carnet_comments`, `carnet_likes`, `carnet_views`, `carnet_media`.
- Corriger les stats synthétiques et l'appariement des hébergements.
- Tests unitaires des transforms + e2e public/privé.

### Lot 2 — Sécurité et états (0,5–1 j)

- JSON-LD échappé.
- `notFound()` + `error.tsx` réel.
- Auth gates mobile.
- Validation upload IA + rate limit.
- CSP images.

### Lot 3 — Coquille Communauté (2–3 j)

- `CarnetPageShell`, `CarnetTopBar`, `CarnetPostHeader`, `CarnetTitle`, `CarnetStats`.
- Suppression des sidebars, du plateau et de `MobileCarnetDetailView`.
- Cover réelle, fallback.
- Sections en cartes.
- Barre basse unique.

### Lot 4 — Interactions et sections (2–3 j)

- Like/comment/save réels.
- CommentsSheet branchée.
- Carte lazy + état vide.
- Kit poids réel + checklists.
- Species persisté.
- GPX conditionnel.

### Lot 5 — Finition (1–2 j)

- A11y (cibles, contraste, clavier, titres).
- Perf (images, bundle, cache).
- SEO (JSON-LD, metadata, 404).
- Tests visuels 430/768/1440 + a11y + budget.

**Total indicatif : 7–11 jours** hors migration DB lourde.

---

## 12. Décisions à prendre

1. **Variante A ou B ?** Recommandation : A, colonne 640 desktop.
2. **Sections en flux ou chips d'ancrage ?** Recommandation : flux + chips discrètes, pas de plateau.
3. **Commentaires threaded ?** Recommandation : plat pour cette refonte, migration `parent_id` dans un lot séparé.
4. **Certifications :** produit réel (`verified` + preuve) ou suppression ? Recommandation : suppression de l'affichage, conservation de la colonne pour un futur badge.
5. **Périmètre CSS :** créer `carnet-social.css` et laisser `lkdv-social-detail` aux clubs, ou migrer les deux ? Recommandation : découpler.
6. **Export :** JSON complet owner, PDF public, ou rien ? Recommandation : PDF public + JSON owner.
7. **Vues :** compteur visible ou analytics seulement ? Recommandation : analytics seulement pour cette version.

---

## 13. Ce que je ne ferai pas sans validation

- Modifier la base (migration `parent_id`, triggers de compteurs, tables de groupe).
- Supprimer `/carnets/[id]` ou changer son URL.
- Toucher à `/clubs/[id]` ou au hub `/carnets`.
- Changer le modèle de certification ou les CGU.
- Déployer.

Dès que tu valides les points 1–7, je passe au plan d'implémentation détaillé (spec + tâches + tests) puis à l'exécution.
