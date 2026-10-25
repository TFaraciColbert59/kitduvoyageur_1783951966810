# Fiche carnet — alignement sur la grammaire Compte/Communauté — design

**Date :** 24 octobre 2026
**Statut :** spec validée par la décision « comme sur les drawers de la page compte, exemple profil ».
**Remplace :** les sections 3.3 à 3.6 de `docs/audit/carnet-2026-10-24/11-disposition-compte-carnet.md`.
**S'appuie sur :** `13-comparatif-compte-communaute.md` (valeurs mesurées en production, 430 × 932).

---

## 1. Principe

La fiche carnet n'a plus sa propre grammaire. Elle prend celle de `/compte`, mesurée, valeur par valeur :

1. **Colonne 406, carte radius 24**, gouttière 12 — et non 410 / 28 / 10.
2. **Une carte = une surface.** La carte d'identité contient l'identité, les actions rapides et **la grille de moments** — comme la carte profil du Compte.
3. **Un seul sélecteur : la capsule du drawer.** Elle n'existe qu'en mode drawer, comme dans le drawer Profil. Fermé, il n'y a pas d'onglets : les sections sont empilées.
4. **Le drawer est la carte.** Ouvrir un drawer remplace le contenu de la carte, garde sa géométrie (406 × n, r 24), ajoute une poignée 18 px et la capsule 48 icônes seules. Aucun voile sombre, aucun titre, aucune croix.
5. **Sous-sélecteur 30** en bas à droite du drawer, uniquement là où il existe un vrai choix (tri des commentaires).

Tout le reste — couleurs, verre, ombres, `.gbtn`, `.pmi-post-btn`, `.pmi-options-menu`, barre basse — est déjà identique : on n'y touche pas.

---

## 2. Tokens mesurés (source de vérité)

| Token | Valeur | Origine mesurée |
|---|---|---|
| `--ckp-gutter` | `12px` | carte Compte à x=12 sur 430 |
| `--ckp-card-w` | `406px` | 430 − 2 × 12 |
| `--ckp-card-r` | `24px` | `.card.cs` |
| `--ckp-card-pad` | `14px` | avatar à x=26 (12 + 14) |
| `--ckp-cover` | `66px`, radius `18px` | avatar `ig-avi-wrap` 66 × 66 (cercle → carré arrondi pour une couverture) |
| `--ckp-stat-v` | `19px/700`, `letter-spacing:-.38px` | `.num` |
| `--ckp-stat-l` | `10.5px/500`, `#56665d`, sans majuscules | libellé de stat |
| `--ckp-stat-cell` | `101 × 39`, radius `14px` | `ig-stat` |
| `--ckp-bio` | `12px/1.3`, `#56665d` | `.ig-bio-text` |
| `--ckp-action` | cercle `44px` + libellé `9px/500`, bloc `72 × 56` | `ig-hl` |
| `--ckp-grid-wrap-r` | `22px` | `ig-grid-wrap` |
| `--ckp-tile-r` | `2px`, tuile `134px` | `ig-tile` |
| `--ckp-capsule` | `378 × 48`, lentille `74 × 40`, icônes seules | `lkdv-slot-selector` dans le drawer |
| `--ckp-grabber` | zone `18px`, barre `40 × 4`, opacité `.35` | `.grab` |
| `--ckp-sub-capsule` | `30px`, cellule `30 × 26`, bas-droite `10px` | `ig-tabs-float` |
| `--ckp-tabbar-w` | `min(100% − 28px, 500px)` | `.tb` du Compte : 402 à x=14 |
| Titre de carte | `19px/700` — plafond typographique de la carte | plus grande taille mesurée dans `.card.cs` |

Aucune valeur hors de ces tokens n'est introduite. Aucune couleur nouvelle.

---

## 3. Anatomie — carte fermée

```
┌──────────────────────────────────────────────┐  gouttière 12
│ ┌──────────────────────────────────────────┐ │  carte 406, r 24
│ │ ┌──────┐  180 km        1800 m      7    │ │  couverture 66 + 3 stats
│ │ │ 1:1  │  DISTANCE     DÉNIVELÉ   JOURS  │ │  19/700 + 10,5/500
│ │ └──────┘                                 │ │
│ │  Titre du carnet (19/700, 2 lignes max)   │ │
│ │  Islande · 25 avr. – 6 mai 2026           │ │  11/10,5 muted
│ │  (av 28) demo  @lea.fontaine  94          │ │  pmi-author 28
│ │  Bio 12/1.3, 3 lignes                     │ │
│ │  (♥44)      (💬44)      (🔖44)            │ │  cercles 44 + libellés 9
│ │   22         3          Enregistrer       │ │
│ │  ┌─────┬─────┬─────┐                      │ │  grille DANS la carte
│ │  │     │     │     │                      │ │  wrap r22, tuiles 134 r2
│ │  └─────┴─────┴─────┘                      │ │  gap 2
│ └──────────────────────────────────────────┘ │
│  RÉCIT        (carte 24)                      │
│  MATÉRIEL     (carte 24)                      │
│  NATURE       (carte 24)                      │
│  COMMENTAIRES (carte 24)                      │
│  ╭ barre basse 48, 402 ╮                      │
└──────────────────────────────────────────────┘
```

Ordre imposé (celui du Compte) : identité (cover + titre + stats) → méta → auteur → bio → actions rapides → grille.

Les sections sous la carte gardent leur forme actuelle (cartes 24 après alignement) mais **perdent la capsule** : plus de sélecteur de sections. « Lire la suite » scrolle vers Récit.

---

## 4. Anatomie — carte en mode drawer

```
┌──────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────┐ │  même carte 406 r24
│ │              ▬▬▬▬                        │ │  poignée : zone 18, barre 40×4
│ │  ╭ 💬   ➤   🗺   ✎ ╮                     │ │  capsule 48, icônes seules
│ │  └───────────────────────────────────────┘│ │  378 × 48, lentille 74×40
│ │                                          │ │
│ │  Léonie Fabre  6 mai                     │ │  contenu du volet
│ │  Je m'en inspire pour mon trek…          │ │
│ │  …                                       │ │
│ │                        ╭ ⇅  ═ ═ ╮        │ │  sous-capsule 30, bas-droite
│ │  [ Ajouter un commentaire… ]        (➤)  │ │  composer (volet commentaires)
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

| Élément | Valeur |
|---|---|
| Conteneur | la carte elle-même : `406 × auto`, radius 24, verre inchangé |
| Poignée | zone 18 px en haut, barre 40 × 4 centrée, `rgba(23,43,36,.35)` ; clic = fermer |
| Capsule | 48, 378 de large (406 − 2 × 14), lentille 74 × 40, **icônes seules** + `aria-label` |
| Volets | Commentaires, Partage, Parcours (si trace), Gérer (propriétaire) — 3 ou 4 cellules |
| Sous-capsule | 30 px, uniquement sur Commentaires : Récents / Anciens (`created_at`) |
| Contenu | padding 14, scroll interne si > 60 dvh |
| Fermeture | clic sur la poignée, re-clic sur l'icône active, `Échap`, bouton « Fermer » du volet |
| Voile | **aucun** — la page reste visible et cliquable autour de la carte |
| Focus | piégé dans la carte tant que le drawer est ouvert ; rendu au déclencheur à la fermeture |

### Volets

| Volet | Contenu | Vide |
|---|---|---|
| Commentaires | liste à plat, avatar 28, nom 12/700, date 10/500, texte 12,5/1.45 ; suppression de son commentaire | « Sois le premier à répondre. » + texte 11,5 |
| Partage | copier le lien, partage natif, 4 destinations | — |
| Parcours | carte 1:1 radius 18, stats, GPX (désactivé sans trace) | « Aucune trace GPS. » |
| Gérer (owner) | visibilité, export JSON, copier le lien, supprimer (confirmation en place) | — |

Le **signalement** reste `ReportSheet` (composant produit partagé avec la Communauté) : seule exception documentée.

---

## 5. Correspondance composants

| Fiche actuelle | Devient |
|---|---|
| `CarnetProfileView` (colonne 10, carte 28) | colonne 12, carte 24 |
| `CarnetIdentityCard` (pills 36, capsule 5 sections) | identité + actions 44 + grille dans la carte |
| `CarnetSectionTabs` (capsule 5 sections avec libellés) | **supprimé** ; remplacé par `CarnetCardDrawer` (capsule 48 icônes seules) |
| `CarnetMediaBlock` (hors carte) | `CarnetMomentGrid` (dans la carte) + `CarnetParcoursPane` (volet) |
| `CarnetCommentsSheet` (`OverlaySheet` plein écran) | `CarnetCommentsPane` (dans la carte) |
| `CarnetShareSheet` (`OverlaySheet`) | `CarnetSharePane` (dans la carte) |
| `CarnetManageSheet` (`OverlaySheet`) | `CarnetManagePane` (dans la carte) |
| `CarnetMapSheet` (`OverlaySheet`) | `CarnetParcoursPane` (dans la carte) |
| `CarnetMediaViewer` (plein écran) | inchangé |
| `CarnetMoreMenu` (226 px) | inchangé |
| `CarnetTraceMap` | inchangé |

---

## 6. États et accessibilité

- `role="tablist"` sur la capsule, `role="tab"` + `aria-selected`, `aria-controls` vers le volet, roving tabindex (déjà garanti par `CapsuleTabs`).
- Le drawer porte `aria-label="Commentaires du carnet"` et `role="region"` ; `Échap` ferme.
- Cibles : cercles 44, capsule 48, sous-capsule 30 (zone cliquable 44 par `::after`).
- Contraste : libellés muted `#56665d` sur verre ≥ 4,5:1 (déjà vérifié sur `/compte`).
- `prefers-reduced-motion` : lentille figée, aucune animation d'ouverture.

---

## 7. Ce qui est supprimé (et pourquoi)

| Supprimé | Raison |
|---|---|
| Capsule de sections avec libellés | n'existe pas au Compte ; le sélecteur du Compte est un sélecteur de drawer |
| `OverlaySheet` pour commentaires / partage / gérer / carte | remplacé par le drawer-carte |
| Pilules 36 comme boutons d'action | n'existent ni au Compte (cercles 44) ni au post (34) |
| Cartes 28 dans la fiche | le Compte est en 24 |
| Grille hors carte | le Compte met la grille dans la carte |
| Colonne 410 / gouttière 10 | le Compte est en 406 / 12 |

---

## 8. Hors périmètre

- `/compte`, `/communaute`, `/carnets` (hub) : inchangés.
- Le hub continue d'afficher `likes_count` (colonne non maintenue) — sujet séparé.
- Statut HTTP 404 des routes dynamiques — sujet plateforme.
- `ReportSheet` garde sa forme actuelle.

---

## 9. Plan de preuve

1. Captures 430 / 768 / 1440 avant et après, au même viewport.
2. Tableau de conformité : chaque token du § 2 mesuré sur la fiche après refonte, comparé à la valeur mesurée du Compte.
3. Recette drawer : ouverture depuis ♥ / 💬 / ··· / « Gérer », changement de volet, sous-capsule de tri, `Échap`, re-clic, focus rendu.
4. `npm test` (nouveaux tests du drawer + géométrie), build Vercel, déploiement, vérification de l'URL.
