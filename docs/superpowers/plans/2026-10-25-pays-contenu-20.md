# Pays & Drawers — 20 améliorations d'AFFICHAGE DU CONTENU

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Améliorer l'affichage du contenu de la fiche pays et de ses volets — hiérarchie, formatage, groupement, états — **sans toucher au design ni aux règles de base** (tokens, matières, géométrie, chrome).

**Architecture :** Aucune surface nouvelle, aucun composant de chrome. On travaille uniquement **à l'intérieur** des primitives existantes : `.lkdv-media-card`, `.lkdv-sheet-card`, `.lkdv-info-row`, `.lkdv-media-badge` (déjà mesurées). Les seuls ajouts sont **typographiques** (rôles déjà définis dans la grammaire : 13,5/700, 11, 10,5/500, 9,5/700) et des **états de contenu** (vide, erreur image, chargement).

**Tech Stack :** React 19 + Next 15, CSS global scopé, Playwright (`design:fidelity`), données Supabase réelles.

**Spec :** `audit-pays/INVENTAIRE-DESIGN-REFERENCE.md` (§2 typographie, §4.11 carte média) + captures `audit-pays/drawers/profil-*.png`.

## Contraintes globales (non négociables)

- **Interdit de modifier** : tokens, gradients, ombres, flous, rayons, géométrie des parts (`.top`, carte 406 × 541,1, `.mapzone`, barre 402 × 48), top bar, barre basse, surfaces de drawer, sélecteur.
- **Autorisé** : ordre, groupement, libellés, formats (nombres, dates, unités), troncature, densité, états vides/erreur/chargement, compteurs, liens, `alt`/`aria`.
- Rôles typographiques utilisés **uniquement** ceux de la grammaire : titre 13,5/700 · sous-titre 11/400 · méta 10,5/500 · micro-libellé 9,5/700 · valeur 15/700 tint.
- `font-variant-numeric: tabular-nums` sur toute valeur ; espaces insécables dans les nombres.
- Aucune donnée inventée : champ absent → ligne masquée, pas de `—` décoratif.
- Chaque tâche finit par : `npx tsc --noEmit`, `npm run design:fidelity -- /pays/fr` (**17/17**, variante sans stories), capture, commit.

---

## Les 20 améliorations (contenu uniquement)

| # | Amélioration | Effet | Source |
|---|---|---|---|
| 1 | **Une seule grammaire de carte** pour les 6 sections : titre 13,5/700, sous-titre 11, méta 10,5 sur filet | plus de cartes « spéciales » qui cassent le rythme | §4.11 mesuré |
| 2 | **Formatage des nombres** : insécables, `tabular-nums`, unités collées (`643 801 km²`, `27,4 km`, `1 620 m`) | lecture instantanée, colonnes alignées | §2 |
| 3 | **Dates relatives** pour la communauté (« il y a 2 j »), **absolues courtes** pour les carnets (« 1 → 22 oct. 2025 ») | contexte temporel utile au premier regard | Notifications |
| 4 | **Troncature maîtrisée** : titre 1 ligne, sous-titre 2 lignes, méta 1 ligne ; texte complet dans `title`/`alt` | plus de hauteurs imprévisibles | Airbnb |
| 5 | **Compteur réel dans le titre de section** (`Incontournables · 5`) | on sait ce qu'on va trouver | Paramètres |
| 6 | **Phrase d'intro par section** (une ligne, donnée réelle : saison, région, nb de clubs) | contexte avant la liste | Notifications |
| 7 | **Carte vedette** : le 1er item est plus grand (photo 16/9), les suivants en 16/10 | hiérarchie visuelle du contenu | Airbnb |
| 8 | **Groupement par catégorie** : Gastronomie par type, Activités par difficulté, avec micro-libellés 9,5/700 | scan par intention | Notifications (`AUJOURD'HUI`) |
| 9 | **Tri explicite** en tête de liste (texte cliquable « Plus récent · Plus aimé · A → Z »), sans nouveau chrome | maîtrise de l'ordre | Linear |
| 10 | **États vides spécifiques** par section, avec l'action pertinente (pas un message générique) | le vide devient utile | Tailwind UI |
| 11 | **Image cassée** → placeholder typographique (initiales + catégorie), jamais un trou | aucune carte « morte » | — |
| 12 | **Squelettes de contenu** aux dimensions exactes (photo 16/10, titre 13, méta 10) | pas de saut de mise en page | §6 |
| 13 | **Méta enrichie sans invention** : afficher durée/dénivelé/prix seulement si présents, séparateur `·` unique | info utile, zéro bruit | §4.11 |
| 14 | **Pluriels corrects** (« 1 activité » / « 3 activités », « 1 membre » / « 20 membres ») | finition éditoriale | — |
| 15 | **Résumé du pays** : 2 lignes max + « Lire la suite » qui ouvre le volet Détails | plus de pavé tronqué net | Airbnb |
| 16 | **Sources lisibles** : nom + domaine + `↗`, `rel="noopener"`, doublon d'URL dédupliqué | confiance et propreté | — |
| 17 | **Recherche locale** dans la section courante (champ en tête de liste, filtre instantané) | utile dès 8 items | Linear |
| 18 | **Filtre par catégorie** en chips texte (une seule ligne, scroll), état actif = texte tint | raffine sans chrome | shadcn |
| 19 | **Accessibilité du contenu** : `alt` descriptif des photos, `aria-label` des cartes, annonce `aria-live` du compteur affiché | lecteurs d'écran | Radix |
| 20 | **Matrice données → affichage** documentée (chaque champ a un rôle typographique et une règle de repli) | plus de décision au cas par cas | — |

**Ce qui n'est pas dans ce plan** : en-tête collant, contrôles de carte, morphing du sélecteur, mini-nav de drawer, toggles, pastilles d'état, jauge, stepper. Ce sont des changements de design/chrome — hors périmètre par ta consigne.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/components/pays/PaysGlassV8.tsx` | Composition des cartes, groupements, tris, états, troncatures |
| `src/styles/account-glass.css` | **Uniquement** des ajustements typographiques dans les primitives existantes (`line-clamp`, `tabular-nums`, séparateurs) — aucune valeur de matière |
| `src/components/pays/CountryMap.tsx` | `alt`/`aria` du repère (contenu), pas de contrôle |
| `scripts/design/design-fidelity.mjs` | Inchangé (17/17) |
| `audit-pays/*.png` | Preuves par section |

---

### Task 1 : Socle de formatage (nombres, dates, pluriels)

**Files:**
- Create: `src/components/pays/formatPays.ts`
- Test: `src/components/pays/__tests__/formatPays.test.ts`

**Interfaces:**
- Produces : `formatNumber(n)`, `formatDistance(km)`, `formatElevation(m)`, `formatArea(km2)`, `formatDateRange(start, end)`, `relativeDate(iso)`, `plural(n, sing, plur)`.

- [ ] **Step 1 : test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { formatArea, formatDistance, plural, relativeDate, formatDateRange } from '../formatPays';

describe('formatage pays', () => {
  it('sépare les milliers par une insécable', () => {
    expect(formatArea(643801)).toBe('643\u202F801 km²');
  });
  it('colle l’unité à la décimale', () => {
    expect(formatDistance(27.4)).toBe('27,4 km');
  });
  it('accorde le pluriel', () => {
    expect(plural(1, 'activité', 'activités')).toBe('1 activité');
    expect(plural(3, 'activité', 'activités')).toBe('3 activités');
  });
  it('rend une date relative en français', () => {
    expect(relativeDate(new Date(Date.now() - 2 * 864e5).toISOString())).toBe('il y a 2 j');
  });
  it('rend une plage de dates courte', () => {
    expect(formatDateRange('2025-10-01', '2025-10-22')).toBe('1 → 22 oct. 2025');
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run src/components/pays/__tests__/formatPays.test.ts`
Expected: FAIL (module introuvable)

- [ ] **Step 3 : implémenter**

```ts
const NBSP = '\u202F';

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR').replace(/\u00A0/g, NBSP);
}
export function formatArea(km2: number | string | null | undefined): string | null {
  const n = typeof km2 === 'string' ? Number(km2.replace(/[^\d.]/g, '')) : km2;
  return n ? `${formatNumber(n)} km²` : null;
}
export function formatDistance(km: number | null | undefined): string | null {
  return typeof km === 'number' ? `${String(km).replace('.', ',')} km` : null;
}
export function formatElevation(m: number | null | undefined): string | null {
  return typeof m === 'number' ? `${formatNumber(m)} m` : null;
}
export function plural(n: number, sing: string, plur: string): string {
  return `${n} ${n > 1 ? plur : sing}`;
}
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  if (Number.isNaN(s.getTime())) return null;
  const d = (x: Date) => `${x.getDate()} ${MOIS[x.getMonth()]}`;
  if (!e || Number.isNaN(e.getTime())) return `${d(s)} ${s.getFullYear()}`;
  return s.getFullYear() === e.getFullYear()
    ? `${s.getDate()} → ${d(e)} ${e.getFullYear()}`
    : `${d(s)} ${s.getFullYear()} → ${d(e)} ${e.getFullYear()}`;
}
export function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const h = Math.floor((Date.now() - t) / 36e5);
  if (h < 1) return 'à l’instant';
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}
```

- [ ] **Step 4 : test vert**

Run: `npx vitest run src/components/pays/__tests__/formatPays.test.ts` → PASS

- [ ] **Step 5 : commit**

```bash
git add src/components/pays/formatPays.ts src/components/pays/__tests__/formatPays.test.ts
git commit -m "feat(pays): formatage des nombres, dates et pluriels"
```

---

### Task 2 : Une seule grammaire de carte + troncature maîtrisée

**Files:** Modify `src/components/pays/PaysGlassV8.tsx`, `src/styles/account-glass.css`

- [ ] **Step 1 : les 6 sections produisent le même objet**

`mediaCards` accepte `{ title, sub, meta, badge, badge2, image, alt, tone }` et **toutes** les sections le remplissent (culture/pratique/communauté inclus, sans image → `image: null`).

- [ ] **Step 2 : troncature dans la primitive existante (aucune valeur de matière)**

```css
.lkdv-media-card__cap b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lkdv-media-card__cap span {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lkdv-media-card__meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 3 : porte + capture** `audit-pays/c2-cartes.png` (6 sections) → 17/17
- [ ] **Step 4 : commit**

---

### Task 3 : Compteurs, phrases d'intro, groupements, tri

**Files:** Modify `src/components/pays/PaysGlassV8.tsx`

- [ ] **Step 1 :** titre de section + compteur réel via `plural(n, …)` (masqué si 0)
- [ ] **Step 2 :** phrase d'intro par section, construite **uniquement** de données réelles :
  - destinations : `plural(n, 'étape', 'étapes')` + région
  - activités : `plural(n, 'activité', 'activités')` + saisons distinctes
  - gastronomie : `plural(n, 'spécialité', 'spécialités')`
  - communauté : `plural(clubs, 'club', 'clubs')` + `plural(carnets, 'carnet', 'carnets')`
  - culture / pratique : nombre de repères
- [ ] **Step 3 :** groupement par catégorie avec micro-libellé 9,5/700 (déjà dans la grammaire pour les sections datées)
- [ ] **Step 4 :** tri en tête de liste : trois libellés texte (Plus récent · Plus aimé · A → Z), actif en `var(--tint)` — **aucun nouveau chrome**
- [ ] **Step 5 :** porte + captures `c3-{destinations,activites,gastronomie}.png` + commit

---

### Task 4 : Carte vedette + méta enrichie sans invention

**Files:** Modify `src/components/pays/PaysGlassV8.tsx`

- [ ] **Step 1 :** 1er item en photo 16/9 (attribut de contenu, pas de style de carte : on garde la primitive, seule l'image change de ratio via `style={{ aspectRatio: '16 / 9' }}`)
- [ ] **Step 2 :** méta = `[durée, dénivelé, prix].filter(Boolean).join(' · ')` — jamais de `·` orphelin
- [ ] **Step 3 :** capture + porte + commit

---

### Task 5 : États (vide spécifique, image cassée, squelettes)

**Files:** Modify `src/components/pays/PaysGlassV8.tsx`, `src/styles/account-glass.css`

- [ ] **Step 1 :** état vide **par section** avec l'action utile :
  - hébergements → « Aucun hébergement publié · Voir les clubs du pays » (lien réel)
  - communauté → « Aucun carnet · Écrire le premier » (`/carnets/nouveau`)
  - gastronomie → « Aucune adresse · Explorer l’atlas »
- [ ] **Step 2 :** `onError` sur chaque `<img>` → placeholder typographique (2 initiales + catégorie), même boîte
- [ ] **Step 3 :** squelettes aux dimensions des cartes (photo 16/10, titre 13, méta 10) pendant `weather/community` en chargement
- [ ] **Step 4 :** porte + captures des 3 états + commit

---

### Task 6 : Résumé du pays, sources, recherche et filtre local

**Files:** Modify `src/components/pays/PaysGlassV8.tsx`

- [ ] **Step 1 :** bio 2 lignes (`-webkit-line-clamp: 2` déjà dans la primitive) + « Lire la suite » (texte) → ouvre le volet Détails
- [ ] **Step 2 :** sources : `nom · domaine ↗`, dédoublonnées par URL, `rel="noopener noreferrer"`
- [ ] **Step 3 :** champ de recherche local en tête de liste (`.lkdv-info-row` + `<input>` sans bordure, fond transparent) filtrant titres et sous-titres
- [ ] **Step 4 :** chips de filtre catégorie sur une ligne (texte, état actif tint)
- [ ] **Step 5 :** porte + captures + commit

---

### Task 7 : Accessibilité du contenu

**Files:** Modify `src/components/pays/PaysGlassV8.tsx`, `src/components/pays/CountryMap.tsx`

- [ ] **Step 1 :** `alt` = titre du lieu sur chaque photo ; `aria-label` des cartes = `titre · sous-titre`
- [ ] **Step 2 :** `aria-live="polite"` annonçant « Incontournables · 5 étapes affichées »
- [ ] **Step 3 :** navigation clavier du tri et des chips (Tab/Entrée), focus visible existant
- [ ] **Step 4 :** `npx vitest run` ciblé + porte + commit

---

### Task 8 : Recette et déploiement

- [ ] `npx tsc --noEmit` + `next build` + `vitest run src/components/pays`
- [ ] `design:fidelity -- /pays/fr --all` → **17/17 × 3** ; `/carnets/[id]` → 19/19 × 3
- [ ] captures 430/768/1440 des 6 sections + 4 volets
- [ ] port sur `/Users/fr168256/lkdv-cf`, **un seul** `vinext-cloudflare deploy`, vérifier l'URL CF
- [ ] matrice données → affichage (§20) ajoutée au rapport, commit final

---

## Auto-revue

- **Couverture** : les 20 lignes sont couvertes (1-4,13,14,18 → T1/T2/T4/T7 ; 5,6,8,9 → T3 ; 7,13 → T4 ; 10,11,12 → T5 ; 15,16,17 → T6 ; 19 → T7 ; 20 → T8).
- **Placeholders** : aucun ; les emplacements de fichiers et signatures sont explicites.
- **Cohérence** : `formatPays.ts` est la seule fabrique de chaînes ; `mediaCards` est le seul modèle de carte ; la porte reste 17/17 (aucune ancre modifiée).
- **Périmètre** : zéro token, zéro matière, zéro géométrie, zéro chrome ajouté.
