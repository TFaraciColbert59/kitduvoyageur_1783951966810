# Fiche carnet — écran fixe et drawers — design

**Date :** 24 octobre 2026
**Statut :** spec issue de la 3ᵉ revue utilisateur. Remplace les specs `11` et `alignement` pour la structure de page.
**Base de code :** branche `carnet/align-v3` (worktree isolé — voir § 9).
**Références mesurées :** `/compte` et `/communaute` en production, 430 × 932.

---

## 1. Ce qui change, et pourquoi

| Constat utilisateur | Cause mesurée | Décision |
|---|---|---|
| Le fond des cartes et des drawers n'est pas bon | la carte du Compte est un `linear-gradient(180deg, #ffffff7c → #ffffff62)` + `.card-scroll` interne ; la fiche empile des cartes de section sur le fond | une seule surface de carte, `.card-scroll` interne, drawers sur la même surface |
| L'ouverture des drawers « à la place des stories » n'est pas bonne | la fiche remplace la carte par le drawer, sans transition ni hauteur animée | drawer = contenu de la carte, hauteur animée 220 ms, capsule et poignée persistantes |
| Clic sur la couverture : rien | la couverture est un simple bouton de viewer | ouvre le **drawer Carnet** (identité + récit + étapes + matériel + nature) |
| Clic sur les 3 statistiques : rien | les stats sont des `div` | chaque stat est un bouton qui ouvre un drawer (§ 4) |
| Les 3 boutons en haut à droite ne sont pas les bons | la fiche a partage / enregistrer / `···` | `+`, recherche, cloche — **identiques à la Communauté** |
| Les éléments en haut à gauche ne sont pas les bons | la fiche a un retour + une pilule 34 | une seule **pilule Communauté** (40, 13/600, chevron) portant le titre |
| La grille des posts est mauvaise | tuiles 134 pleine largeur, sans en-tête, sans ouverture | grille 3 × 134 r2 **avec ouverture d'un drawer Post** |
| Le drawer des posts n'existe pas | aucun composant | **nouveau drawer Post** (§ 5) |
| Le sélecteur en bas à droite n'est pas identique | `.ckp-toggle` 30 px, radius 999, lentille blanche plein | `.ig-tabs` du Compte : **31 px, radius 12, fond `rgba(23,43,36,.06)`, lentille `.ig-th` 320 ms** |
| La page ne doit pas être scrollable | `main` en flux, sections empilées | **écran fixe** `100dvh`, `overflow: hidden`, contenu dans les drawers |
| La barre basse n'est pas identique | composant partagé mais rendu 410/10 à certains endroits, libellés 600 | barre du Compte : **402 à x14, 48, icônes 19, libellés 10/500, lentille 79 × 40** |

---

## 2. Anatomie cible (430 × 932, aucun scroll)

```
┌──────────────────────────────────────────────┐
│ ╭ Tour du Mont-Blanc ⌄ ╮      (+) (⌕) (🔔)   │  barre 48 — grammaire Communauté
├──────────────────────────────────────────────┤
│ ╭──────────────────────────────────────────╮ │  carte 406 r24, .card-scroll
│ │ ╭───╮  106 km    2 002 m     7           │ │  couverture 66 en anneau + 3 stats boutons
│ │ ╰───╯  DISTANCE  DÉNIVELÉ   JOURS        │ │
│ │ Islande · 25 avr. – 6 mai 2026            │ │  ligne de contexte
│ │ Léa Fontaine · 94 · Vérifié               │ │  ligne auteur
│ │ Douze jours de désert, de gués…           │ │  bio 2 lignes
│ │  (♥) 23   (💬) 3   (🗺) Parcours          │ │  3 anneaux 44
│ │ ┌─────┬─────┬─────┐                       │ │
│ │ │     │     │     │  grille 3 × 134 r2    │ │
│ │ ├─────┼─────┼─────┤                       │ │
│ │ └─────┴─────┴─────┘                       │ │
│ │                    ╭ ▦ │ 🗺 ╮             │ │  sélecteur 31/lens
│ ╰──────────────────────────────────────────╯ │
│ ╭──────────────────────────────────────────╮ │
│ │        (le drawer remplace le contenu)    │ │  poignée + capsule 48 + sous-lens 30
│ ╰──────────────────────────────────────────╯ │
│  ╭ Explorer  Compas  Matériel  Hub  Compte ╮ │  barre 48, 402, lentille masquée
└──────────────────────────────────────────────┘
```

Règles :
- `html/body` de la route : pas de scroll (`overscroll-behavior: none`), hauteur `100dvh`.
- La carte a une hauteur **animée** : fermée ≈ 560 px ; ouverte (drawer) = hauteur disponible jusqu'à la barre basse, `max-height: calc(100dvh − 48 − 48 − 20)`.
- Le contenu long d'un drawer défile **dans la carte** (`.card-scroll`), jamais la page.
- Les sections « Récit / Matériel / Nature » ne sont plus sur la page : elles sont des volets.

---

## 3. Barre du haut — grammaire Communauté

| Élément | Valeur |
|---|---|
| Hauteur | `48` (`padding 8px 0`), collante, fond transparent puis verre après 12 px |
| Gauche | **pilule 40** (`padding 0 14`, radius 999, verre `--bar-glass-bg`, ombre `--bar-thumb-shadow`), texte `600 13/1`, **chevron 14** ; ouvre le **drawer Carnet** |
| Droite | 3 `.gbtn` 38, `gap 6` : **Créer** (`plus`), **Rechercher** (`search`), **Notifications** (`bell` + badge non-lus) |
| Actions | `+` → half-drawer Création (réutilise `CommunityCreateDrawer`) ; `⌕` → `CommunitySectionsDrawer` en mode recherche ; `🔔` → `/compte?tab=notifications` |
| Retour | supprimé de la barre : la pilule porte le chevron qui ouvre le drawer ; le retour navigateur reste natif |

---

## 4. Correspondance carte → drawers

| Déclencheur | Drawer | Volets (capsule 48) | Sous-lens 30 |
|---|---|---|---|
| Couverture (anneau 66) | **Carnet** | Récit · Étapes · Matériel · Nature | — |
| Stat **DISTANCE** | **Parcours** | Parcours seul | Grille / Carte |
| Stat **DÉNIVELÉ +** | **Parcours** (même drawer, volet dénivelé) | Parcours seul | Profil altimétrique / Carte |
| Stat **JOURS** | **Étapes** | Étapes seul | Journal / Carte |
| Anneau **♥** | **J’aime** | — | Tous / Mutuels |
| Anneau **💬** | **Commentaires** | — | Récents / Anciens |
| Anneau **Parcours** (visiteur) | **Parcours** | Parcours · Étapes | Carte / Grille |
| Anneau **Gérer** (propriétaire) | **Gérer** | — | — |
| Tuile de la grille | **Post** (moment) | — | 1 / N |
| `···` | Menu 226 px | — | — |
| Ligne auteur | `/profil/[id]` | — | — |

Un seul drawer à la fois. Fermeture : poignée, `Échap`, re-clic du déclencheur, retour du drawer vers la carte (animation inverse).

---

## 5. Contenus des drawers — données réelles

### 5.1 Drawer Carnet (couverture)

| Volet | Contenu | Source |
|---|---|---|
| Récit | titre, destination, dates, description complète, badge Vérifié, auteur + score, nombre de jours et de moments | `CarnetDetail.title/destination/dateRange/description/verified/author/days/moments` |
| Étapes | timeline : badge jour, `JOUR n · date`, `départ → arrivée`, km, D+, durée, météo, récit, **nuit (refuge)** | `CarnetDetail.days[]` |
| Matériel | poids total + lignes `nom · détail · poids`, points de couleur | `CarnetDetail.kit` |
| Nature | identificateur d'espèce (photo → API) + état vide | `POST /api/carnet/identify-species` |

### 5.2 Drawer Parcours

Carte Leaflet 1:1, trace forest 4,5, départ/arrivée, crédit Esri complet, `distance · D+`, bouton **Télécharger le GPX** (désactivé sans trace), état vide « Aucune trace GPS. ». Source : `trace`, `distanceKm`, `elevationM`.

### 5.3 Drawer Étapes

Même timeline que 5.1 mais plein écran du drawer, avec les hébergements en pied de jour (`overnight`).

### 5.4 Drawer J’aime

Liste des profils ayant aimé : avatar 32, nom 12/600, `@handle`, ville, badge de réaction (`like`, `bravo`, `useful`). Source : `carnet_likes` + `public_profiles`. Sous-lens **Tous / Mutuels**. État vide : « Aucun j’aime pour l’instant. »

### 5.5 Drawer Commentaires

Liste à plat (avatar 28, nom, date, texte, suppression du sien), composer 36 + envoi 34, sous-lens **Récents / Anciens**. Source : `carnet_comments` + `public_profiles`.

### 5.6 Drawer Post (moment) — **nouveau**

Structure identique au post de la Communauté, dans la carte :

```
╭──────────────────────────────────────────────╮
│ (av 28) Léa Fontaine · JOUR 3 · 18:30    ··· │  en-tête du moment
│ ┌──────────────────────────────────────────┐ │
│ │            photo 1:1 (viewer)            │ │  tap = viewer plein écran
│ └──────────────────────────────────────────┘ │
│ ‹ 3/7 ›                                      │  navigation moment
│ « Bivouac au col, ciel dégagé. »             │  citation
│ Lieu · 28 sept.                              │
│ (♥) 23   (💬) 3   (↗)                        │  actions
│ Commentaires (3)                             │
│ composer                                     │
╰──────────────────────────────────────────────╯
```

- Données : `photoMoments[index]` + `detail.engagement` + `comments`.
- `‹ ›` parcourt les moments illustrés ; le compteur affiche `n/N`.
- Les likes/commentaires sont **ceux du carnet** (la base ne porte pas de commentaire par moment) — mention explicite dans l'UI : « Commentaires du carnet ».
- `···` ouvre le menu 226 px (partager, copier, signaler).

### 5.7 Drawers secondaires

| Drawer | Contenu |
|---|---|
| Création (top `+`) | half-drawer 50 dvh, 6 tuiles (Publication, Carnet, Sortie GPS, Kit, Club, Story) — composant de la Communauté |
| Recherche (top `⌕`) | `CommunitySectionsDrawer` en mode recherche |
| Gérer (owner) | visibilité, export JSON, copier le lien, suppression (confirmation en place) |
| Partage | copier, partage natif, WhatsApp / X / Facebook / e-mail |
| Signalement | `ReportSheet` (composant partagé) |

---

## 6. Sélecteur 31 px — valeurs exactes

```css
.ckp-tabs {
  position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
  height: 31px; padding: 2px; border-radius: 12px;
  background: rgba(23, 43, 36, .06);
  box-shadow: inset 0 1px 1px rgba(23, 43, 36, .06), inset 0 -1px 0 rgba(255, 255, 255, .65);
}
.ckp-tabs button {
  position: relative; z-index: 1; border: 0; background: none; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font: 600 10.8px/1 var(--font-sans); color: var(--feed-muted); cursor: pointer;
  transition: color .18s;
}
.ckp-tabs button[aria-selected='true'] { color: #17402c; }
.ckp-tabs .ckp-th {
  position: absolute; top: 2px; bottom: 2px; left: 2px;
  width: calc((100% - 4px) / var(--n, 2)); border-radius: 10px;
  background: rgba(255, 255, 255, .86);
  box-shadow: 0 2px 6px rgba(23, 43, 36, .1), inset 0 1px 0 #fff;
  transform: translateX(calc(var(--i, 0) * 100%));
  transition: transform .32s cubic-bezier(.22, 1.15, .36, 1);
}
```

---

## 7. Barre basse — valeurs exactes

| Élément | Valeur |
|---|---|
| Barre | `position: fixed`, `bottom: 10px`, `left: 50%`, largeur `min(100% − 28px, 402px)`, hauteur **48**, radius 999, `padding 2` |
| Cellules | 5, `grid`, icône **19**, libellé **10/500**, `gap 1` |
| Lentille | 79 × 40, `left: 3`, `top/bottom: 4`, `translateX(i × 100%)`, 420 ms |
| Onglet actif | `color: #2F6B45`, `font-weight: 600` |
| Fiche carnet | **aucun onglet actif** → lentille `opacity: 0` (même composant, même géométrie) |

---

## 8. Animations (aucune oubliée)

| Élément | Animation |
|---|---|
| Ouverture du drawer | hauteur de carte 220 ms `cubic-bezier(.22,1,.36,1)`, contenu en fondu 140 ms |
| Fermeture | inverse, 180 ms |
| Capsule 48 | lentille 420 ms `cubic-bezier(.32,.72,0,1)` |
| Sélecteur 31 | lentille 320 ms `cubic-bezier(.22,1.15,.36,1)` |
| Poignée | `active` : opacité .6 |
| Anneaux 44 | `active` : `scale(.92)` |
| Tuiles | `active` : `scale(.96)` |
| Boutons ronds | `active` : `scale(.94)` |
| Drawer Post ‹ › | glissement horizontal 240 ms |
| GSAP | aucun — tout en CSS, `prefers-reduced-motion` coupe tout |

---

## 9. Contraintes d'exécution

1. **Worktree isolé obligatoire** : un autre agent écrit dans `/Users/fr168256/Desktop/lkdv-communaute-feed`. Tout le chantier se fait dans un worktree neuf créé depuis `carnet/align-v3`, et se déploie depuis lui.
2. **Aucun scroll de page** : vérifié à 430, 768, 1440 (`document.documentElement.scrollHeight === innerHeight`).
3. **Données réelles uniquement** : les nouveaux drawers lisent `CarnetDetail`, `carnet_likes`, `carnet_comments`, `public_profiles`. Aucun fallback démo.
4. **Identique = mesuré** : chaque valeur du § 6-7 est vérifiée en production par script Playwright (`getComputedStyle`), consignée dans la recette.

---

## 10. Hors périmètre

- `/compte`, `/communaute`, `/carnets` (hub) : inchangés.
- Réactions multiples (`reaction`) : affichées en badge, non sélectionnables.
- Statut HTTP 404 des routes dynamiques : sujet plateforme.
