# Fiche carnet — refonte « profil du Compte » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la fiche `/carnets/[id]` (3 colonnes desktop + plateau mobile, données fictives) par la disposition exacte du Compte — top bar 52, carte d'identité 28, grille 3 colonnes de moments, sections en cartes 28, bottom bar 48, drawers du Compte — alimentée uniquement par des données réelles.

**Architecture:** Le serveur lit le carnet et son engagement avec le client Supabase **cookies** (`@/lib/supabase/server`), met en forme via une fonction pure testée (`buildCarnetDetail`), puis rend une vue cliente unique (`CarnetProfileView`) qui porte l'état local (sections, mode média, drawers) et les mutations d'engagement. Aucun composant de l'ancienne fiche n'est réutilisé : la grammaire vient des primitives Compte/Communauté déjà globales (`account-glass.css`, `liquid-capsules.css`, `community-feed.css`).

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript, Supabase (`@supabase/ssr`), CSS global scopé par préfixe `ckp-`, Vitest + Testing Library, Playwright.

**Specs (autorité, à lire avant d'implémenter) :**
- `docs/audit/carnet-2026-10-24/11-disposition-compte-carnet.md` — **autoritaire pour la disposition**
- `docs/audit/carnet-2026-10-24/10-spec-visuelle-carnet.md` — composants, boutons, drawers, tokens, états
- `docs/audit/carnet-2026-10-24/00-synthese.md` — constats P0/P1 à corriger
- `docs/audit/carnet-2026-10-24/08-contrat-refonte.md` — périmètre et lots

---

## Global Constraints

Toute tâche hérite de ces contraintes. Elles sont copiées des specs, pas inventées.

**Périmètre.** Seule la fiche `/carnets/[id]` change. Le hub `/carnets`, `/compte`, `/communaute`, `/clubs/[id]`, les routes API existantes et le schéma BDD ne changent pas (sauf la tâche 2 : `page.tsx` de la fiche et son JSON-LD).

**Géométrie.**
- Colonne `max-width: 520px`, centrée, `padding: 0 10px calc(78px + env(safe-area-inset-bottom, 0px))`. À 320, 430, 768, 1024, 1440 la colonne reste 520 max.
- Aucune sidebar, aucun layout 3 colonnes, aucun breadcrumb, aucun plateau, aucun `AppShell`.
- Top bar `52px + env(safe-area-inset-top)`, sticky, transparente puis verre après 12 px de scroll.
- Bottom bar `AccountBottomBar` (48 px, `bottom: 10px`), **aucun onglet actif**.

**Typographie.** Une seule famille : `var(--font-sans, -apple-system, system-ui, sans-serif)` (= SF Pro / Inter). Interdits : `font-serif`, `font-mono`, `--font-display`, Manrope. Chiffres en `font-variant-numeric: tabular-nums`.

**Couleurs (aucune nouvelle).** encre `#17402c`, muted `#56665d`, like `#e0245e`, danger `#a33227`, sage `#3d7a52`. Verre via `--bar-glass-bg`, `--bar-glass-blur`, `--bar-glass-shadow` (définis par `.lkdv-account-glass`).

**Rayons.** Carte 28. Couverture / carte / tuile média 18. Pilule 999.

**Un seul sélecteur.** Capsule principale = `CapsuleTabs` (48 px, `.segc.lg-tabs.lens-on` + `.sel-lens`, lentille 420 ms). Sélecteur secondaire = `.segc` 30 px, 2 cellules. Rien d'autre.

**Un seul bouton.** Rond 38 = `.gbtn`. Pilule 36 = `.ckp-pill`. Action de post 34 = `.pmi-post-btn`. Fermeture 34 = `.lkdv-overlay-close`. Ligne de menu 44. Cible tactile ≥ 44 (via `::after`).

**Données — zéro invention.**
- Aucun auteur par défaut, aucun avatar Unsplash, aucun « Antoine Duprès ».
- Aucun compteur codé en dur. Likes = `carnets.likes_count`, commentaires = `carnets.comments_count`, vues = `carnets.views_count`.
- Aucune statistique dérivée par division. Une statistique absente disparaît.
- Aucun badge « Vérifié » si `carnets.verified !== true`.
- Aucun texte de remplissage (« Matériel embarqué pour cette expédition. », « Trois traces »).
- Une donnée absente → état vide honnête (texte + action propriétaire si pertinente).

**Drawers.** Coquille `OverlaySheet` (Compte) : `width: min(100%, 520px)`, `max-height: min(92dvh, 820px)`, radius 26 haut, header 52, close 34, footer safe-area, focus trap, `Échap`. Menu `···` = 226 px, verre. Aucun drawer nouveau hors ceux listés.

**Mouvement.** Lentille 420 ms `cubic-bezier(.32,.72,0,1)`. Pressions `scale(.94)`. `@media (prefers-reduced-motion: reduce)` → aucune animation.

**Preuves obligatoires par tâche visuelle.** Captures 430×932 et 1440×900 ; `npm run design:diff` en fin de lot ; aucune régression sur `/compte` et `/communaute` (mêmes primitives partagées).

**Commandes de vérification.**
```bash
npm run type-check
npm test -- --run <fichier>
npm run build
```

**Décisions tranchées (à ne pas rouvrir).**
1. **Commentaires à plat.** `carnet_comments` ne porte ni `reply_to_id` ni likes. La spec `11` mentionne « réponses, likes » : la table ne les a pas. On n'invente pas — liste à plat, composer, suppression de son propre commentaire.
2. **Brouillons locaux retirés de la route.** Un brouillon `localStorage` n'est ni partageable ni indexable et produit un soft-404. `/carnets/[id]` renvoie un vrai 404 quand le carnet n'existe pas. Coût si erroné : un utilisateur perd l'aperçu d'un brouillon local, récupérable par le hub.
3. **Export = JSON conservé** (comportement actuel). Pas de PDF : il n'a jamais existé, on n'ajoute pas de fonctionnalité dans une refonte.
4. **Cover 1:1 dans la carte** (96 px mobile / 112 desktop), pas en pleine largeur.
5. **Nature = identificateur d'espèce** (API `/api/carnet/identify-species`). `carnet_moments.identified_species` est vide en base (0/228) : aucune galerie d'espèces, seulement l'état vide honnête.

---

## Carte des fichiers

**Créés**

| Fichier | Responsabilité |
|---|---|
| `src/features/carnet/detail/types.ts` | Contrat `CarnetDetail` + types de lignes BDD |
| `src/features/carnet/detail/format.ts` | Formatage FR (dates, km, m, poids) — pur |
| `src/features/carnet/detail/buildCarnetDetail.ts` | Mise en forme pure, sans invention |
| `src/features/carnet/detail/getCarnetDetail.ts` | Lecture serveur (cookies) + engagement |
| `src/features/carnet/detail/jsonld.ts` | JSON-LD échappé (`</script>`) |
| `src/features/carnet/detail/useCarnetEngagement.ts` | Like / favori optimistes |
| `src/features/carnet/detail/useCarnetComments.ts` | Liste + envoi + suppression |
| `src/components/carnet/profile/CarnetProfileView.tsx` | Composition + état des drawers |
| `src/components/carnet/profile/CarnetTopBar.tsx` | Retour + pilule titre + 3 gbtn |
| `src/components/carnet/profile/CarnetIdentityCard.tsx` | Carte 28 (cover, titre, stats, auteur, actions, capsule) |
| `src/components/carnet/profile/CarnetSectionTabs.tsx` | Capsule 48 + scroll des sections |
| `src/components/carnet/profile/CarnetMediaBlock.tsx` | Grille 3 col / mode carte + toggle 30 |
| `src/components/carnet/profile/CarnetMediaViewer.tsx` | Viewer plein écran |
| `src/components/carnet/profile/CarnetStorySection.tsx` | Récit + timeline des jours |
| `src/components/carnet/profile/CarnetKitSection.tsx` | Matériel + poids réel |
| `src/components/carnet/profile/CarnetNatureSection.tsx` | Identification d'espèce |
| `src/components/carnet/profile/CarnetCommentsPreview.tsx` | 2 commentaires + composer |
| `src/components/carnet/profile/CarnetCommentsSheet.tsx` | Feuille 92 dvh |
| `src/components/carnet/profile/CarnetMoreMenu.tsx` | Menu 226 px |
| `src/components/carnet/profile/CarnetManageSheet.tsx` | Gérer (owner) 76 dvh |
| `src/styles/carnet-profile.css` | Toute la feuille de la fiche (préfixe `ckp-`) |

**Tests créés**

`src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts`, `format.test.ts`, `jsonld.test.ts`, `useCarnetEngagement.test.tsx`, `useCarnetComments.test.tsx`, `src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`, `CarnetMediaBlock.test.tsx`, `CarnetSectionTabs.test.tsx`, `CarnetProfileView.test.tsx`.

**Modifiés**

`src/app/carnets/[id]/page.tsx` (données serveur, 404, JSON-LD, metadata), `src/app/carnets/[id]/loading.tsx` (squelette colonne), `src/app/layout.tsx` (import de `carnet-profile.css`).

**Supprimés (tâche 9, après bascule)**

`src/components/carnet/{CarnetView,CarnetHero,StatsBar,MomentCard,TimelineJours,JourCard,HebergementCard,KitSouvenirCard,RandonneesSouvenirCard,CarnetDetailVerticalTabs,CarnetDetailRightSidebar,MobileCarnetDetailView,SpeciesIdentifier}.tsx`, `src/components/carnets/LocalCarnetRenderer.tsx`, `src/lib/queries/carnet.ts`.

**Conservés**

`src/components/carnet/CarnetMap.tsx` (carte Leaflet, utilisée en mode carte), `src/app/carnets/page.tsx` (hub), `src/components/carnets/CreateCarnetView.tsx`.

---

## Task 1: Contrat de données + mise en forme pure

**Files:**
- Create: `src/features/carnet/detail/types.ts`
- Create: `src/features/carnet/detail/format.ts`
- Create: `src/features/carnet/detail/buildCarnetDetail.ts`
- Test: `src/features/carnet/detail/__tests__/format.test.ts`
- Test: `src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts`

**Interfaces:**
- Consumes: rien (pur, aucun réseau).
- Produces:
  - `formatKm(value: number | string | null): string | null`
  - `formatElevation(value: number | string | null): string | null`
  - `formatWeight(grams: number | null): string | null`
  - `formatDateRange(start: string | null, end: string | null): string | null`
  - `toNumber(value: unknown): number | null`
  - `buildCarnetDetail(input: BuildCarnetDetailInput): CarnetDetail`
  - Types `CarnetDetail`, `CarnetDay`, `CarnetMomentItem`, `CarnetKitItemRow`, `CarnetStatItem`, `CarnetAuthor`, `BuildCarnetDetailInput` exportés par `types.ts`.

- [ ] **Step 1: Écrire les types du contrat**

`src/features/carnet/detail/types.ts`

```ts
/** Contrat de la fiche carnet. Une valeur absente est `null`, jamais inventée. */

export interface CarnetRow {
  id: string;
  author_id: string | null;
  title: string | null;
  destination: string | null;
  description: string | null;
  cover_image: string | null;
  cover_image_alt: string | null;
  start_date: string | null;
  end_date: string | null;
  visibility: string | null;
  verified: boolean | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  distance_km: number | string | null;
  denivele_m: number | string | null;
  groupe_id: string | null;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
}

export interface HikeSessionRow {
  id: string;
  carnet_id: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
  duration_seconds: number | null;
  started_at: string | null;
  positions_geojson: unknown;
}

export interface EtapeRow {
  id: string;
  jour_numero: number | null;
  ordre: number | null;
  date_etape: string | null;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  recit: string | null;
  distance_km: number | string | null;
  denivele_m: number | string | null;
  duree_texte: string | null;
  meteo: string | null;
  temperature_c: number | null;
}

export interface HebergementRow {
  id: string;
  apres_jour_numero: number | null;
  nom: string | null;
  prix_cents: number | null;
  prix_note: string | null;
  altitude_m: number | null;
  note: string | null;
  hote: string | null;
}

export interface MomentRow {
  id: string;
  jour_numero: number | null;
  heure: string | null;
  citation: string | null;
  auteur_nom: string | null;
  lieu: string | null;
  image_url: string | null;
}

export interface KitItemRow {
  id: string;
  nom: string | null;
  detail: string | null;
  poids_g: number | null;
  couleur_tag: string | null;
  sort_order: number | null;
}

export interface AuthorRow {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  trust_score: number | null;
}

export interface CarnetAuthor {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  trustScore: number;
}

export interface CarnetStatItem {
  key: 'distance' | 'elevation' | 'days';
  label: string;
  value: string;
}

export interface CarnetMomentItem {
  id: string;
  dayNumber: number;
  time: string | null;
  caption: string | null;
  authorName: string | null;
  place: string | null;
  imageUrl: string | null;
}

export interface CarnetDay {
  id: string;
  dayNumber: number;
  label: string;
  from: string | null;
  to: string | null;
  note: string | null;
  distanceKm: number | null;
  elevationM: number | null;
  durationText: string | null;
  weather: string | null;
  /** Nom du refuge où l'on dort après cette journée. */
  overnight: string | null;
}

export interface CarnetKitItemRow {
  id: string;
  name: string;
  detail: string | null;
  weightG: number | null;
  color: string | null;
}

export interface CarnetKit {
  /** Somme des poids connus. `null` si aucun poids n'est renseigné. */
  totalWeightG: number | null;
  items: CarnetKitItemRow[];
}

export interface CarnetEngagement {
  likes: number;
  comments: number;
  views: number;
  liked: boolean;
  favorited: boolean;
}

export interface CarnetDetail {
  id: string;
  title: string;
  destination: string | null;
  description: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  startDate: string | null;
  endDate: string | null;
  dateRange: string | null;
  visibility: string;
  isPublic: boolean;
  verified: boolean;
  isOwner: boolean;
  author: CarnetAuthor | null;
  stats: CarnetStatItem[];
  engagement: CarnetEngagement;
  moments: CarnetMomentItem[];
  /** Moments qui portent une image : seuls ceux-là peuplent la grille. */
  photoMoments: CarnetMomentItem[];
  days: CarnetDay[];
  kit: CarnetKit;
  trace: unknown | null;
  distanceKm: number | null;
  elevationM: number | null;
}

export interface BuildCarnetDetailInput {
  carnet: CarnetRow;
  author: AuthorRow | null;
  hikeSession: HikeSessionRow | null;
  etapes: EtapeRow[];
  hebergements: HebergementRow[];
  moments: MomentRow[];
  kitItems: KitItemRow[];
  viewerId: string | null;
  liked: boolean;
  favorited: boolean;
}
```

- [ ] **Step 2: Écrire les tests de formatage (ils échouent)**

`src/features/carnet/detail/__tests__/format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  formatDateRange,
  formatElevation,
  formatKm,
  formatWeight,
  toNumber,
} from '../format';

describe('formatKm', () => {
  it('formate en français avec une décimale au maximum', () => {
    expect(formatKm(106)).toBe('106 km');
    expect(formatKm(12.44)).toBe('12,4 km');
    expect(formatKm('27.39')).toBe('27,4 km');
  });

  it('retourne null pour une valeur absente ou nulle', () => {
    expect(formatKm(null)).toBeNull();
    expect(formatKm(0)).toBeNull();
    expect(formatKm('')).toBeNull();
    expect(formatKm(Number.NaN)).toBeNull();
  });
});

describe('formatElevation', () => {
  it('sépare les milliers à la française', () => {
    expect(formatElevation(2002)).toBe('2 002 m');
    expect(formatElevation('540')).toBe('540 m');
  });

  it('retourne null sous 1 mètre', () => {
    expect(formatElevation(0)).toBeNull();
    expect(formatElevation(null)).toBeNull();
  });
});

describe('formatWeight', () => {
  it('bascule en kilos au-delà de 1 000 g', () => {
    expect(formatWeight(4200)).toBe('4,2 kg');
    expect(formatWeight(980)).toBe('980 g');
  });

  it('retourne null sans poids', () => {
    expect(formatWeight(null)).toBeNull();
    expect(formatWeight(0)).toBeNull();
  });
});

describe('formatDateRange', () => {
  it('affiche une plage abrégée', () => {
    expect(formatDateRange('2026-09-26', '2026-10-02')).toBe('26 sept. – 2 oct. 2026');
  });

  it('affiche une date seule quand la fin manque', () => {
    expect(formatDateRange('2026-09-26', null)).toBe('26 sept. 2026');
  });

  it('retourne null sans aucune date', () => {
    expect(formatDateRange(null, null)).toBeNull();
  });

  it('retourne null sur une date invalide', () => {
    expect(formatDateRange('pas-une-date', null)).toBeNull();
  });
});

describe('toNumber', () => {
  it('accepte number et string PostgREST', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber('42.5')).toBe(42.5);
  });

  it('retourne null sur tout le reste', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/features/carnet/detail/__tests__/format.test.ts`
Expected: FAIL — `Failed to resolve import "../format"`.

- [ ] **Step 4: Écrire `format.ts`**

```ts
const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const DAY_LABEL_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const GROUPED = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** `106 km`, `12,4 km`. `null` si la valeur est absente ou nulle. */
export function formatKm(value: number | string | null): string | null {
  const km = toNumber(value);
  if (km === null || km <= 0) return null;
  return `${ONE_DECIMAL.format(km)} km`;
}

/** `2 002 m`. `null` sous 1 mètre. */
export function formatElevation(value: number | string | null): string | null {
  const meters = toNumber(value);
  if (meters === null || meters < 1) return null;
  return `${GROUPED.format(meters)} m`;
}

/** `4,2 kg` / `980 g`. `null` sans poids connu. */
export function formatWeight(grams: number | null): string | null {
  if (grams === null || grams <= 0) return null;
  if (grams >= 1000) return `${ONE_DECIMAL.format(grams / 1000)} kg`;
  return `${grams} g`;
}

function parseDate(value: string): Date | null {
  // `2026-09-26` : on force midi UTC pour éviter tout décalage de fuseau.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `26 sept. – 2 oct. 2026`, `26 sept. 2026`, `null`. */
export function formatDateRange(start: string | null, end: string | null): string | null {
  const from = start ? parseDate(start) : null;
  const to = end ? parseDate(end) : null;
  if (!from && !to) return null;
  if (from && !to) return DAY_LABEL_YEAR.format(from);
  if (!from && to) return DAY_LABEL_YEAR.format(to);
  const a = from as Date;
  const b = to as Date;
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  if (!sameYear) return `${DAY_LABEL_YEAR.format(a)} – ${DAY_LABEL_YEAR.format(b)}`;
  return `${DAY_LABEL.format(a)} – ${DAY_LABEL_YEAR.format(b)}`;
}
```

- [ ] **Step 5: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/features/carnet/detail/__tests__/format.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 6: Écrire les tests du builder (ils échouent)**

`src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildCarnetDetail } from '../buildCarnetDetail';
import type { BuildCarnetDetailInput, CarnetRow } from '../types';

const CARNET: CarnetRow = {
  id: 'c1',
  author_id: 'u1',
  title: 'Tour du Mont-Blanc',
  destination: 'France / Italie / Suisse',
  description: 'Dix jours, trois pays.',
  cover_image: 'https://cdn.test/cover.jpg',
  cover_image_alt: 'Crête au lever du jour',
  start_date: '2026-09-26',
  end_date: '2026-10-02',
  visibility: 'public',
  verified: false,
  likes_count: 6,
  comments_count: 3,
  views_count: 2320,
  distance_km: 106.4,
  denivele_m: 2002,
  groupe_id: null,
  lieu_depart: 'Chamonix',
  lieu_arrivee: 'Chamonix',
};

function input(overrides: Partial<BuildCarnetDetailInput> = {}): BuildCarnetDetailInput {
  return {
    carnet: CARNET,
    author: { id: 'u1', full_name: 'Camille Rochat', handle: 'camille', avatar_url: null, trust_score: 94 },
    hikeSession: null,
    etapes: [],
    hebergements: [],
    moments: [],
    kitItems: [],
    viewerId: null,
    liked: false,
    favorited: false,
    ...overrides,
  };
}

describe('buildCarnetDetail — identité', () => {
  it('reprend les compteurs réels du carnet', () => {
    const detail = buildCarnetDetail(input());
    expect(detail.engagement).toEqual({ likes: 6, comments: 3, views: 2320, liked: false, favorited: false });
  });

  it('ne fabrique aucun auteur quand la ligne est absente', () => {
    const detail = buildCarnetDetail(input({ author: null }));
    expect(detail.author).toBeNull();
  });

  it('ne marque vérifié que si la colonne vaut true', () => {
    expect(buildCarnetDetail(input()).verified).toBe(false);
    expect(buildCarnetDetail(input({ carnet: { ...CARNET, verified: true } })).verified).toBe(true);
  });

  it('calcule la propriété avec le lecteur', () => {
    expect(buildCarnetDetail(input({ viewerId: 'u1' })).isOwner).toBe(true);
    expect(buildCarnetDetail(input({ viewerId: 'u2' })).isOwner).toBe(false);
    expect(buildCarnetDetail(input({ viewerId: null })).isOwner).toBe(false);
  });

  it('retombe sur la destination puis sur un libellé honnête quand le titre manque', () => {
    expect(buildCarnetDetail(input({ carnet: { ...CARNET, title: null } })).title).toBe('France / Italie / Suisse');
    expect(
      buildCarnetDetail(input({ carnet: { ...CARNET, title: null, destination: null } })).title,
    ).toBe('Carnet sans titre');
  });

  it('expose la plage de dates formatée', () => {
    expect(buildCarnetDetail(input()).dateRange).toBe('26 sept. – 2 oct. 2026');
  });
});

describe('buildCarnetDetail — statistiques', () => {
  it('affiche distance et dénivelé une seule fois, sans division', () => {
    const detail = buildCarnetDetail(input({ hikeSession: null }));
    expect(detail.stats.map((s) => s.key)).toEqual(['distance', 'elevation']);
    expect(detail.stats[0].value).toBe('106,4 km');
    expect(detail.stats[1].value).toBe('2 002 m');
  });

  it('préfère la trace GPS aux colonnes du carnet', () => {
    const detail = buildCarnetDetail(
      input({
        hikeSession: {
          id: 'h1',
          carnet_id: 'c1',
          distance_km: '118.2',
          elevation_gain_m: '2410',
          duration_seconds: 36000,
          started_at: '2026-09-26T06:00:00Z',
          positions_geojson: { type: 'LineString', coordinates: [] },
        },
      }),
    );
    expect(detail.distanceKm).toBe(118.2);
    expect(detail.elevationM).toBe(2410);
    expect(detail.stats[0].value).toBe('118,2 km');
  });

  it('compte les jours réels des étapes, jamais une division', () => {
    const detail = buildCarnetDetail(
      input({
        etapes: [
          { id: 'e1', jour_numero: 1, ordre: 1, date_etape: null, lieu_depart: 'Chamonix', lieu_arrivee: 'Les Houches', recit: null, distance_km: 12, denivele_m: 800, duree_texte: '5h', meteo: null, temperature_c: null },
          { id: 'e2', jour_numero: 2, ordre: 2, date_etape: null, lieu_depart: 'Les Houches', lieu_arrivee: 'Contamines', recit: null, distance_km: 18, denivele_m: 1200, duree_texte: '7h', meteo: null, temperature_c: null },
        ],
      }),
    );
    const days = detail.stats.find((s) => s.key === 'days');
    expect(days?.value).toBe('2');
    expect(detail.stats.map((s) => s.key)).toEqual(['distance', 'elevation', 'days']);
  });

  it('supprime toute cellule absente', () => {
    const detail = buildCarnetDetail(
      input({ carnet: { ...CARNET, distance_km: null, denivele_m: null } }),
    );
    expect(detail.stats).toEqual([]);
  });
});

describe('buildCarnetDetail — jours, moments, kit', () => {
  it('construit un jour par étape réelle avec son hébergement', () => {
    const detail = buildCarnetDetail(
      input({
        etapes: [
          { id: 'e1', jour_numero: 1, ordre: 1, date_etape: '2026-09-26', lieu_depart: 'Chamonix', lieu_arrivee: 'Les Houches', recit: 'Départ sous la pluie.', distance_km: 12, denivele_m: 800, duree_texte: '5h', meteo: 'pluie', temperature_c: 11 },
        ],
        hebergements: [
          { id: 'h1', apres_jour_numero: 1, nom: 'Refuge de Bellachat', prix_cents: 4600, prix_note: 'demi-pension', altitude_m: 2100, note: null, hote: null },
        ],
      }),
    );
    expect(detail.days).toHaveLength(1);
    expect(detail.days[0]).toMatchObject({
      dayNumber: 1,
      label: 'JOUR 1 · 26 sept.',
      from: 'Chamonix',
      to: 'Les Houches',
      note: 'Départ sous la pluie.',
      distanceKm: 12,
      elevationM: 800,
      overnight: 'Refuge de Bellachat',
    });
  });

  it('déduit les jours des moments quand il n’y a pas d’étapes, sans inventer de récit', () => {
    const detail = buildCarnetDetail(
      input({
        moments: [
          { id: 'm1', jour_numero: 2, heure: '18:30', citation: 'Bivouac au col.', auteur_nom: 'Camille', lieu: 'Col de la Seigne', image_url: 'https://cdn.test/1.jpg' },
          { id: 'm2', jour_numero: 2, heure: '20:10', citation: 'Ciel dégagé.', auteur_nom: null, lieu: null, image_url: null },
          { id: 'm3', jour_numero: 4, heure: null, citation: null, auteur_nom: null, lieu: 'Courmayeur', image_url: 'https://cdn.test/2.jpg' },
        ],
      }),
    );
    expect(detail.days.map((d) => d.dayNumber)).toEqual([2, 4]);
    expect(detail.days[0].label).toBe('JOUR 2');
    expect(detail.days[0].note).toBeNull();
    expect(detail.days[0].from).toBe('Col de la Seigne');
    expect(detail.stats.some((s) => s.key === 'days')).toBe(true);
  });

  it('ne peuple la grille photo qu’avec les moments qui ont une image', () => {
    const detail = buildCarnetDetail(
      input({
        moments: [
          { id: 'm1', jour_numero: 1, heure: null, citation: 'a', auteur_nom: null, lieu: null, image_url: 'https://cdn.test/1.jpg' },
          { id: 'm2', jour_numero: 1, heure: null, citation: 'b', auteur_nom: null, lieu: null, image_url: null },
        ],
      }),
    );
    expect(detail.moments).toHaveLength(2);
    expect(detail.photoMoments.map((m) => m.id)).toEqual(['m1']);
  });

  it('additionne seulement les poids réels et renvoie null sans aucun poids', () => {
    const detail = buildCarnetDetail(
      input({
        kitItems: [
          { id: 'k1', nom: 'Sac 45 L', detail: 'Hybride', poids_g: 1400, couleur_tag: null, sort_order: 1 },
          { id: 'k2', nom: 'Tente', detail: null, poids_g: null, couleur_tag: null, sort_order: 2 },
          { id: 'k3', nom: 'Réchaud', detail: null, poids_g: 2800, couleur_tag: null, sort_order: 3 },
        ],
      }),
    );
    expect(detail.kit.totalWeightG).toBe(4200);
    expect(detail.kit.items.map((i) => i.name)).toEqual(['Sac 45 L', 'Tente', 'Réchaud']);
    expect(detail.kit.items[1].weightG).toBeNull();
    expect(buildCarnetDetail(input()).kit.totalWeightG).toBeNull();
  });

  it('n’ajoute aucun texte d’introduction au matériel', () => {
    const detail = buildCarnetDetail(
      input({ kitItems: [{ id: 'k1', nom: 'Sac', detail: null, poids_g: 900, couleur_tag: null, sort_order: 1 }] }),
    );
    expect(JSON.stringify(detail.kit)).not.toContain('Matériel embarqué');
  });
});
```

- [ ] **Step 7: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts`
Expected: FAIL — `Failed to resolve import "../buildCarnetDetail"`.

- [ ] **Step 8: Écrire `buildCarnetDetail.ts`**

```ts
import { formatDateRange, formatElevation, formatKm, toNumber } from './format';
import type {
  BuildCarnetDetailInput,
  CarnetDay,
  CarnetDetail,
  CarnetMomentItem,
  CarnetStatItem,
} from './types';

const UNTITLED = 'Carnet sans titre';

function buildAuthor(input: BuildCarnetDetailInput) {
  const { author, carnet } = input;
  if (!author) return null;
  return {
    id: author.id,
    name: author.full_name?.trim() || author.handle?.trim() || 'Auteur non renseigné',
    handle: author.handle ?? null,
    avatarUrl: author.avatar_url ?? null,
    trustScore: toNumber(author.trust_score) ?? 0,
  };
}

function buildMoments(input: BuildCarnetDetailInput): CarnetMomentItem[] {
  return input.moments.map((m) => ({
    id: m.id,
    dayNumber: m.jour_numero ?? 1,
    time: m.heure ?? null,
    caption: m.citation?.trim() || null,
    authorName: m.auteur_nom?.trim() || null,
    place: m.lieu?.trim() || null,
    imageUrl: m.image_url?.trim() || null,
  }));
}

function buildDays(input: BuildCarnetDetailInput): CarnetDay[] {
  const overnightByDay = new Map<number, string>();
  for (const h of input.hebergements) {
    const day = h.apres_jour_numero;
    if (day && h.nom) overnightByDay.set(day, h.nom);
  }

  if (input.etapes.length > 0) {
    return input.etapes.map((e) => {
      const dayNumber = e.jour_numero ?? e.ordre ?? 1;
      const dateLabel = e.date_etape
        ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
            new Date(`${e.date_etape}T12:00:00Z`),
          )
        : null;
      return {
        id: e.id,
        dayNumber,
        label: dateLabel ? `JOUR ${dayNumber} · ${dateLabel}` : `JOUR ${dayNumber}`,
        from: e.lieu_depart?.trim() || null,
        to: e.lieu_arrivee?.trim() || null,
        note: e.recit?.trim() || null,
        distanceKm: toNumber(e.distance_km),
        elevationM: toNumber(e.denivele_m),
        durationText: e.duree_texte?.trim() || null,
        weather:
          [e.meteo?.trim(), e.temperature_c !== null && e.temperature_c !== undefined ? `${e.temperature_c} °C` : null]
            .filter(Boolean)
            .join(' · ') || null,
        overnight: overnightByDay.get(dayNumber) ?? null,
      };
    });
  }

  // Pas d'étapes : les moments donnent les journées, sans récit inventé
  // et sans répartition des totaux (l'ancienne fiche divisait distance et D+).
  const byDay = new Map<number, CarnetMomentItem[]>();
  for (const moment of buildMoments(input)) {
    const list = byDay.get(moment.dayNumber) ?? [];
    list.push(moment);
    byDay.set(moment.dayNumber, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, list]) => {
      const places = list.map((m) => m.place).filter((p): p is string => Boolean(p));
      return {
        id: `moment-day-${dayNumber}`,
        dayNumber,
        label: `JOUR ${dayNumber}`,
        from: places[0] ?? null,
        to: places.length > 1 ? places[places.length - 1] : null,
        note: null,
        distanceKm: null,
        elevationM: null,
        durationText: null,
        weather: null,
        overnight: overnightByDay.get(dayNumber) ?? null,
      };
    });
}

export function buildCarnetDetail(input: BuildCarnetDetailInput): CarnetDetail {
  const { carnet, hikeSession } = input;
  const distanceKm = toNumber(hikeSession?.distance_km) ?? toNumber(carnet.distance_km);
  const elevationM = toNumber(hikeSession?.elevation_gain_m) ?? toNumber(carnet.denivele_m);
  const moments = buildMoments(input);
  const days = buildDays(input);

  const stats: CarnetStatItem[] = [];
  const distanceLabel = formatKm(distanceKm);
  if (distanceLabel) stats.push({ key: 'distance', label: 'DISTANCE', value: distanceLabel });
  const elevationLabel = formatElevation(elevationM);
  if (elevationLabel) stats.push({ key: 'elevation', label: 'DÉNIVELÉ +', value: elevationLabel });
  if (days.length > 0) stats.push({ key: 'days', label: 'JOURS', value: String(days.length) });

  const kitWeight = input.kitItems.reduce<number | null>((total, item) => {
    const grams = toNumber(item.poids_g);
    if (grams === null || grams <= 0) return total;
    return (total ?? 0) + grams;
  }, null);

  return {
    id: carnet.id,
    title: carnet.title?.trim() || carnet.destination?.trim() || UNTITLED,
    destination: carnet.destination?.trim() || null,
    description: carnet.description?.trim() || null,
    coverImage: carnet.cover_image?.trim() || null,
    coverImageAlt: carnet.cover_image_alt?.trim() || null,
    startDate: carnet.start_date ?? null,
    endDate: carnet.end_date ?? null,
    dateRange: formatDateRange(carnet.start_date, carnet.end_date),
    visibility: carnet.visibility ?? 'public',
    isPublic: (carnet.visibility ?? 'public') === 'public',
    verified: carnet.verified === true,
    isOwner: Boolean(input.viewerId && carnet.author_id && input.viewerId === carnet.author_id),
    author: buildAuthor(input),
    stats,
    engagement: {
      likes: toNumber(carnet.likes_count) ?? 0,
      comments: toNumber(carnet.comments_count) ?? 0,
      views: toNumber(carnet.views_count) ?? 0,
      liked: input.liked,
      favorited: input.favorited,
    },
    moments,
    photoMoments: moments.filter((m) => Boolean(m.imageUrl)),
    days,
    kit: {
      totalWeightG: kitWeight,
      items: input.kitItems.map((k) => ({
        id: k.id,
        name: k.nom?.trim() || 'Élément sans nom',
        detail: k.detail?.trim() || null,
        weightG: toNumber(k.poids_g),
        color: k.couleur_tag ?? null,
      })),
    },
    trace: hikeSession?.positions_geojson ?? null,
    distanceKm,
    elevationM,
  };
}
```

- [ ] **Step 9: Lancer les tests, vérifier le vert**

Run: `npm test -- --run src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts src/features/carnet/detail/__tests__/format.test.ts`
Expected: PASS (17 + 15 tests).

- [ ] **Step 10: Type-check**

Run: `npm run type-check`
Expected: aucune erreur sur `src/features/carnet/detail/**`.

- [ ] **Step 11: Commit**

```bash
git add src/features/carnet/detail
git commit -m "feat(carnet): contrat de donnees et mise en forme sans invention"
```

---

## Task 2: Lecture serveur, 404 réel, metadata et JSON-LD échappé

**Files:**
- Create: `src/features/carnet/detail/getCarnetDetail.ts`
- Create: `src/features/carnet/detail/jsonld.ts`
- Test: `src/features/carnet/detail/__tests__/jsonld.test.ts`
- Modify: `src/app/carnets/[id]/page.tsx` (remplacement complet du fichier)

**Interfaces:**
- Consumes: `buildCarnetDetail` (Task 1), `createClient` de `@/lib/supabase/server`, `notFound` de `next/navigation`.
- Produces:
  - `getCarnetDetail(id: string): Promise<CarnetDetail | null>`
  - `buildCarnetJsonLd(detail: CarnetDetail, siteUrl: string): object`
  - `serializeJsonLd(value: unknown): string`

**Contexte à connaître :** l'ancien `getCarnetComplet` utilisait `@/lib/supabase/client` (client **navigateur**) dans un composant serveur : pas de cookies, donc RLS voyait un anonyme et un carnet privé renvoyait 404 à son propriétaire. Le nouveau code utilise `@/lib/supabase/server`, dont `createClient()` est **asynchrone** et lit `cookies()`.

- [ ] **Step 1: Écrire le test JSON-LD (il échoue)**

`src/features/carnet/detail/__tests__/jsonld.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildCarnetJsonLd, serializeJsonLd } from '../jsonld';
import { buildCarnetDetail } from '../buildCarnetDetail';
import type { BuildCarnetDetailInput, CarnetRow } from '../types';

const CARNET: CarnetRow = {
  id: 'c1',
  author_id: 'u1',
  title: 'Tour du Mont-Blanc',
  destination: 'France / Italie / Suisse',
  description: 'Dix jours, trois pays.',
  cover_image: 'https://cdn.test/cover.jpg',
  cover_image_alt: null,
  start_date: '2026-09-26',
  end_date: '2026-10-02',
  visibility: 'public',
  verified: true,
  likes_count: 6,
  comments_count: 3,
  views_count: 12,
  distance_km: 106.4,
  denivele_m: 2002,
  groupe_id: null,
  lieu_depart: 'Chamonix',
  lieu_arrivee: 'Chamonix',
};

const DETAIL = buildCarnetDetail({
  carnet: CARNET,
  author: { id: 'u1', full_name: 'Camille Rochat', handle: 'camille', avatar_url: null, trust_score: 94 },
  hikeSession: null,
  etapes: [],
  hebergements: [],
  moments: [],
  kitItems: [],
  viewerId: null,
  liked: false,
  favorited: false,
} satisfies BuildCarnetDetailInput);

describe('serializeJsonLd', () => {
  it('neutralise la fermeture de script et les chevrons', () => {
    const payload = serializeJsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    expect(payload).not.toContain('</script>');
    expect(payload).not.toContain('<img');
    expect(payload).toContain('\\u003c');
  });

  it('reste du JSON valide une fois déséchappé', () => {
    const payload = serializeJsonLd({ a: 1, b: 'x<y' });
    expect(JSON.parse(payload.replace(/\\u003c/g, '<'))).toEqual({ a: 1, b: 'x<y' });
  });
});

describe('buildCarnetJsonLd', () => {
  it('décrit le carnet avec son auteur réel et sa couverture', () => {
    const json = buildCarnetJsonLd(DETAIL, 'https://lekitduvoyageur.fr') as any;
    const work = json['@graph'][0];
    expect(work['@type']).toBe('CreativeWork');
    expect(work.name).toBe('Tour du Mont-Blanc');
    expect(work.image).toBe('https://cdn.test/cover.jpg');
    expect(work.author).toMatchObject({ '@type': 'Person', name: 'Camille Rochat' });
    expect(work.url).toBe('https://lekitduvoyageur.fr/carnets/c1');
    expect(work.datePublished).toBe('2026-09-26');
  });

  it('omet l’auteur quand il est inconnu', () => {
    const orphan = buildCarnetDetail({
      carnet: { ...CARNET, author_id: null },
      author: null,
      hikeSession: null,
      etapes: [],
      hebergements: [],
      moments: [],
      kitItems: [],
      viewerId: null,
      liked: false,
      favorited: false,
    });
    const json = buildCarnetJsonLd(orphan, 'https://lekitduvoyageur.fr') as any;
    expect(json['@graph'][0].author).toBeUndefined();
  });

  it('n’expose aucun compteur inventé', () => {
    const json = JSON.stringify(buildCarnetJsonLd(DETAIL, 'https://lekitduvoyageur.fr'));
    expect(json).not.toContain('24');
    expect(json).not.toContain('"8"');
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/features/carnet/detail/__tests__/jsonld.test.ts`
Expected: FAIL — module `../jsonld` introuvable.

- [ ] **Step 3: Écrire `jsonld.ts`**

```ts
import type { CarnetDetail } from './types';

/** Échappe le JSON pour un `<script type="application/ld+json">` inline. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildCarnetJsonLd(detail: CarnetDetail, siteUrl: string) {
  const url = `${siteUrl}/carnets/${detail.id}`;
  const work: Record<string, unknown> = {
    '@type': 'CreativeWork',
    '@id': `${url}#carnet`,
    name: detail.title,
    url,
    ...(detail.description ? { description: detail.description } : {}),
    ...(detail.coverImage ? { image: detail.coverImage } : {}),
    ...(detail.startDate ? { datePublished: detail.startDate } : {}),
    ...(detail.author
      ? {
          author: {
            '@type': 'Person',
            name: detail.author.name,
            ...(detail.author.handle ? { alternateName: `@${detail.author.handle}` } : {}),
          },
        }
      : {}),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      work,
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Carnets', item: `${siteUrl}/carnets` },
          { '@type': 'ListItem', position: 3, name: detail.title, item: url },
        ],
      },
    ],
  };
}
```

- [ ] **Step 4: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/features/carnet/detail/__tests__/jsonld.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Écrire `getCarnetDetail.ts`**

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { buildCarnetDetail } from './buildCarnetDetail';
import type {
  AuthorRow,
  CarnetRow,
  EtapeRow,
  HebergementRow,
  HikeSessionRow,
  KitItemRow,
  MomentRow,
} from './types';

const CARNET_COLUMNS = [
  'id',
  'author_id',
  'title',
  'destination',
  'description',
  'cover_image',
  'cover_image_alt',
  'start_date',
  'end_date',
  'visibility',
  'verified',
  'likes_count',
  'comments_count',
  'views_count',
  'distance_km',
  'denivele_m',
  'groupe_id',
  'lieu_depart',
  'lieu_arrivee',
].join(', ');

/**
 * Lit un carnet, son auteur, ses étapes, ses moments, son kit et l'engagement
 * du lecteur avec le client serveur (cookies) — la RLS voit donc la session :
 * un carnet privé reste lisible par son propriétaire.
 *
 * Retourne `null` si le carnet n'existe pas ou n'est pas lisible : la route
 * traduit cela en `notFound()`.
 */
export async function getCarnetDetail(id: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData?.user?.id ?? null;

  const { data: carnetData, error: carnetError } = await supabase
    .from('carnets')
    .select(CARNET_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (carnetError || !carnetData) return null;
  const carnet = carnetData as unknown as CarnetRow;

  const [authorResult, hikeResult, etapesResult, hebergementsResult, momentsResult, kitResult] =
    await Promise.all([
      supabase
        .from('public_profiles')
        .select('id, full_name, handle, avatar_url, trust_score')
        .eq('id', carnet.author_id ?? '')
        .maybeSingle(),
      supabase
        .from('hike_sessions')
        .select('id, carnet_id, distance_km, elevation_gain_m, duration_seconds, started_at, positions_geojson')
        .eq('carnet_id', carnet.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      carnet.groupe_id
        ? supabase
            .from('groupe_etapes')
            .select(
              'id, jour_numero, ordre, date_etape, lieu_depart, lieu_arrivee, recit, distance_km, denivele_m, duree_texte, meteo, temperature_c',
            )
            .eq('groupe_id', carnet.groupe_id)
            .order('ordre', { ascending: true })
        : Promise.resolve({ data: [] as EtapeRow[] }),
      carnet.groupe_id
        ? supabase
            .from('groupe_hebergements')
            .select('id, apres_jour_numero, nom, prix_cents, prix_note, altitude_m, note, hote')
            .eq('groupe_id', carnet.groupe_id)
            .order('apres_jour_numero', { ascending: true })
        : Promise.resolve({ data: [] as HebergementRow[] }),
      supabase
        .from('carnet_moments')
        .select('id, jour_numero, heure, citation, auteur_nom, lieu, image_url')
        .eq('carnet_id', carnet.id)
        .order('jour_numero', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('carnet_kit_items')
        .select('id, nom, detail, poids_g, couleur_tag, sort_order')
        .eq('carnet_id', carnet.id)
        .order('sort_order', { ascending: true }),
    ]);

  let liked = false;
  let favorited = false;
  if (viewerId) {
    const [likeResult, favoriteResult] = await Promise.all([
      supabase.from('carnet_likes').select('carnet_id').eq('carnet_id', carnet.id).eq('user_id', viewerId).maybeSingle(),
      supabase.from('carnet_favorites').select('carnet_id').eq('carnet_id', carnet.id).eq('user_id', viewerId).maybeSingle(),
    ]);
    liked = Boolean(likeResult.data);
    favorited = Boolean(favoriteResult.data);
  }

  return buildCarnetDetail({
    carnet,
    author: (authorResult.data as unknown as AuthorRow) ?? null,
    hikeSession: (hikeResult.data as unknown as HikeSessionRow) ?? null,
    etapes: (etapesResult.data as unknown as EtapeRow[]) ?? [],
    hebergements: (hebergementsResult.data as unknown as HebergementRow[]) ?? [],
    moments: (momentsResult.data as unknown as MomentRow[]) ?? [],
    kitItems: (kitResult.data as unknown as KitItemRow[]) ?? [],
    viewerId,
    liked,
    favorited,
  });
}
```

- [ ] **Step 6: Réécrire `src/app/carnets/[id]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CarnetProfileView from '@/components/carnet/profile/CarnetProfileView';
import { getCarnetDetail } from '@/features/carnet/detail/getCarnetDetail';
import { buildCarnetJsonLd, serializeJsonLd } from '@/features/carnet/detail/jsonld';

interface Props {
  params: Promise<{ id: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCarnetDetail(id);

  if (!detail) {
    return { title: 'Carnet introuvable', robots: { index: false, follow: false } };
  }

  const title = `${detail.title} — Le Kit du Voyageur`;
  const description =
    detail.description ??
    `Carnet d'expédition outdoor${detail.destination ? ` — ${detail.destination}` : ''} — Le Kit du Voyageur`;
  const canonical = `${siteUrl}/carnets/${detail.id}`;
  const images = detail.coverImage
    ? [{ url: detail.coverImage, alt: detail.coverImageAlt ?? detail.title }]
    : [{ url: '/assets/images/og-image.png', width: 1200, height: 630, alt: detail.title }];

  return {
    title,
    description,
    alternates: { canonical },
    robots: detail.isPublic ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      siteName: 'Le Kit du Voyageur',
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images: images.map((image) => image.url) },
  };
}

export default async function CarnetDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getCarnetDetail(id);

  // Vrai 404 : l'ancienne fiche rendait un brouillon local et répondait 200.
  if (!detail) notFound();

  return (
    <>
      {detail.isPublic ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildCarnetJsonLd(detail, siteUrl)) }}
        />
      ) : null}
      <CarnetProfileView detail={detail} />
    </>
  );
}

// Rendu dynamique requis : la lecture passe par `cookies()` (session + RLS).
// En ISR, `DYNAMIC_SERVER_USAGE` casse toutes les fiches en production.
export const dynamic = 'force-dynamic';
```

> `CarnetProfileView` n'existe pas encore : c'est la tâche 3. Le build reste rouge entre les tâches 2 et 3 — c'est prévu, la tâche 3 le referme. Les tests de cette tâche ne compilent pas la route.

- [ ] **Step 7: Lancer les tests de la tâche**

Run: `npm test -- --run src/features/carnet/detail`
Expected: PASS — 37 tests (format + builder + jsonld).

- [ ] **Step 8: Commit**

```bash
git add src/features/carnet/detail src/app/carnets/\[id\]/page.tsx
git commit -m "feat(carnet): lecture serveur cookies, 404 reel et json-ld echappe"
```

---

## Task 3: Coquille, fond, top bar et feuille de style

**Files:**
- Create: `src/styles/carnet-profile.css`
- Create: `src/components/carnet/profile/CarnetTopBar.tsx`
- Create: `src/components/carnet/profile/CarnetProfileView.tsx` (version minimale : coquille + top bar + carte vide + bottom bar ; complétée aux tâches 4 à 8)
- Modify: `src/app/layout.tsx:14` (import de la feuille)
- Test: `src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx`

**Interfaces:**
- Consumes: `AccountBottomBar` (`@/components/account/AccountBottomBar`), `AccountRoundButton`, `CapsuleTabs`, classes `lkdv-feed-shell` / `lkdv-feed-column` / `lkdv-feed-header` / `lkdv-account-glass`.
- Produces: `<CarnetProfileView detail={CarnetDetail} />` (export par défaut).

- [ ] **Step 1: Écrire la feuille complète**

`src/styles/carnet-profile.css` — **fichier intégral**, aucune valeur inventée hors tokens.

```css
/* =============================================================================
   Fiche carnet — grammaire profil du Compte (2026-10-24)

   Coquille, fond, boutons ronds, pastille auteur, menu ··· et barre basse sont
   ceux du Compte/Communauté (community-feed.css, account-glass.css,
   liquid-capsules.css). Cette feuille n'ajoute que la fiche — préfixe `ckp-`.
   Aucune couleur nouvelle : #17402c, #56665d, #e0245e, #a33227, #3d7a52.
   ============================================================================= */

.ckp-main { display: flex; flex-direction: column; gap: 10px; padding-top: 8px; }

/* --- Top bar -------------------------------------------------------------- */

.ckp-topbar { position: relative; }
.ckp-topbar[data-scrolled='true'] .ckp-topbar-veil { opacity: 1; }
.ckp-topbar-veil {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  transition: opacity .2s ease;
  background: var(--bar-glass-bg);
  -webkit-backdrop-filter: var(--bar-glass-blur); backdrop-filter: var(--bar-glass-blur);
  box-shadow: 0 0 0 .5px rgba(23, 43, 36, .10);
}
.ckp-topbar > * { position: relative; z-index: 1; }
.ckp-top-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ckp-top-actions { display: flex; align-items: center; gap: 6px; flex: none; }
.ckp-top-actions .gbtn, .ckp-top-left .gbtn { position: relative; }
.ckp-top-actions .gbtn::after, .ckp-top-left .gbtn::after { content: ''; position: absolute; inset: -3px; }

.ckp-title-pill {
  display: inline-flex; align-items: center; gap: 7px; max-width: 240px;
  height: 34px; padding: 4px 10px 4px 4px; border: 0; border-radius: 999px;
  background: var(--bar-glass-bg);
  -webkit-backdrop-filter: var(--bar-glass-blur); backdrop-filter: var(--bar-glass-blur);
  box-shadow: var(--bar-thumb-shadow); color: var(--feed-ink); cursor: pointer;
}
.ckp-title-pill:active { transform: scale(.97); }
.ckp-title-cover { width: 24px; height: 24px; border-radius: 8px; object-fit: cover; flex: none; }
.ckp-title-cover--empty {
  display: grid; place-items: center; border-radius: 8px;
  background: linear-gradient(160deg, #17402c, #3d7a52);
  color: #fff; font: 700 10px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-title-pill b {
  max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font: 700 12.5px/1.1 var(--font-sans, -apple-system, system-ui, sans-serif);
}

/* --- Carte d'identité ----------------------------------------------------- */

.ckp-card {
  position: relative; border-radius: 28px; padding: 14px; margin: 0;
  background: rgba(255, 255, 255, .62);
  -webkit-backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
  backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .95), 0 0 0 .5px rgba(23, 43, 36, .10), 0 10px 26px rgba(23, 43, 36, .12);
  color: var(--feed-ink);
}
.ckp-head { display: flex; align-items: flex-start; gap: 12px; }
.ckp-cover-wrap { position: relative; flex: none; }
.ckp-cover {
  width: 96px; height: 96px; border-radius: 18px; object-fit: cover; display: block;
  box-shadow: inset 0 0 0 .5px rgba(23, 43, 36, .12);
}
@media (min-width: 768px) { .ckp-cover { width: 112px; height: 112px; } }
.ckp-cover--empty {
  display: grid; place-items: center; gap: 2px; text-align: center;
  background: linear-gradient(160deg, #17402c, #3d7a52); color: #fff;
}
.ckp-cover--empty b { font: 700 24px/1 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-cover--empty small { font: 600 8.5px/1.1 var(--font-sans, -apple-system, system-ui, sans-serif); opacity: .8; }
.ckp-cover-expand {
  position: absolute; right: 6px; bottom: 6px; width: 22px; height: 22px;
  display: grid; place-items: center; border: 0; border-radius: 999px;
  background: rgba(255, 255, 255, .78); color: var(--feed-ink); cursor: pointer;
}
.ckp-cover-expand::after { content: ''; position: absolute; inset: -11px; }

.ckp-id-col { flex: 1; min-width: 0; }
.ckp-title-row { display: flex; align-items: flex-start; gap: 6px; }
.ckp-title {
  margin: 0; flex: 1; min-width: 0;
  font: 700 20px/1.15 var(--font-sans, -apple-system, system-ui, sans-serif);
  letter-spacing: -.015em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
@media (min-width: 768px) { .ckp-title { font: 700 22px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); } }
.ckp-badge {
  display: inline-flex; align-items: center; gap: 3px; flex: none;
  height: 18px; padding: 0 6px; border-radius: 999px;
  background: rgba(61, 122, 82, .12); color: #2f6b45;
  font: 700 9.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-badge--private { background: rgba(23, 43, 36, .08); color: var(--feed-muted); }
.ckp-sub, .ckp-dates { margin: 3px 0 0; color: var(--feed-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ckp-sub { font: 500 11px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-dates { font: 500 10.5px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); }

.ckp-stats { display: flex; gap: 8px; margin-top: 8px; }
.ckp-stat { min-width: 0; }
.ckp-stat-v {
  display: block; font: 700 17px/1.1 var(--font-sans, -apple-system, system-ui, sans-serif);
  font-variant-numeric: tabular-nums; letter-spacing: -.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ckp-stat-l {
  display: block; margin-top: 1px; color: var(--feed-muted);
  font: 600 9.5px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif);
  text-transform: uppercase; letter-spacing: .06em;
}

.ckp-author { display: flex; align-items: center; gap: 8px; margin-top: 10px; min-width: 0; }
.ckp-author.pmi-author { min-height: 36px; padding: 2px 10px 2px 2px; }
.ckp-author .pmi-author-av { width: 32px; height: 32px; }
@media (min-width: 768px) { .ckp-author .pmi-author-av { width: 44px; height: 44px; } }
.ckp-trust {
  display: inline-flex; align-items: center; gap: 3px; flex: none;
  padding: 0 6px; height: 18px; border-radius: 999px;
  background: rgba(255, 255, 255, .6); color: var(--feed-muted);
  font: 700 9.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-author-static { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ckp-avatar {
  width: 32px; height: 32px; flex: none; border-radius: 999px; object-fit: cover;
  box-shadow: 0 0 0 .5px rgba(23, 43, 36, .10);
}
.ckp-avatar--initial {
  display: grid; place-items: center; background: #ddebd8; color: var(--feed-ink);
  font: 700 12px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-author-name {
  display: block; font: 700 12.5px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ckp-author-meta {
  display: block; color: var(--feed-muted);
  font: 500 10.5px/1.25 var(--font-sans, -apple-system, system-ui, sans-serif);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.ckp-desc {
  margin: 10px 0 0;
  font: 400 13.5px/1.45 var(--font-sans, -apple-system, system-ui, sans-serif);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.ckp-desc-more {
  margin: 2px 0 0; padding: 0; border: 0; background: none; cursor: pointer;
  color: var(--feed-muted); font: 600 11px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-desc-more::after { content: ''; position: absolute; inset: -14px -8px; }

.ckp-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.ckp-pill {
  position: relative; display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px; border: 0; border-radius: 999px;
  background: rgba(255, 255, 255, .5);
  -webkit-backdrop-filter: blur(4px) saturate(1.9) brightness(1.07);
  backdrop-filter: blur(4px) saturate(1.9) brightness(1.07);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 0 0 .5px rgba(23, 43, 36, .10);
  color: var(--feed-ink); cursor: pointer;
  font: 600 11px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
  font-variant-numeric: tabular-nums;
}
.ckp-pill::after { content: ''; position: absolute; inset: -4px; }
.ckp-pill:active { transform: scale(.96); }
.ckp-pill svg { width: 16px; height: 16px; }
.ckp-pill.is-on { color: var(--feed-like); }
.ckp-pill--primary { background: #17402c; color: #fff; box-shadow: 0 4px 14px rgba(23, 64, 44, .24); }

.ckp-sep { height: .5px; margin: 12px 0 0; background: rgba(23, 43, 36, .10); }
.ckp-tabs { margin-top: 12px; }

/* --- Bloc médias ---------------------------------------------------------- */

.ckp-media { position: relative; }
.ckp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }
.ckp-tile {
  position: relative; aspect-ratio: 1 / 1; width: 100%; padding: 0; border: 0;
  overflow: hidden; background: #dfe8dc; cursor: pointer; border-radius: 0; display: block;
}
.ckp-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ckp-tile::after { content: ''; position: absolute; inset: 0; background: rgba(10, 20, 14, .55); opacity: 0; transition: opacity .15s ease; }
.ckp-tile:active::after { opacity: 1; }
.ckp-tile-more {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: rgba(10, 20, 14, .5); color: #fff;
  font: 700 17px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-toggle {
  position: absolute; right: 10px; bottom: 10px; z-index: 5;
  display: inline-flex; align-items: center; gap: 0; height: 30px; padding: 2px;
  border-radius: 999px; background: rgba(255, 255, 255, .34);
  -webkit-backdrop-filter: var(--bar-glass-blur); backdrop-filter: var(--bar-glass-blur);
  box-shadow: inset 0 0 0 .5px rgba(23, 43, 36, .08), inset 0 1px 2px rgba(23, 43, 36, .05), 0 6px 16px rgba(23, 43, 36, .12);
}
.ckp-toggle button {
  position: relative; width: 30px; height: 26px; display: grid; place-items: center;
  border: 0; border-radius: 999px; background: transparent; color: var(--feed-muted); cursor: pointer;
}
.ckp-toggle button[aria-pressed='true'] {
  background: #fff; color: var(--feed-ink);
  box-shadow: 0 1px 3px rgba(23, 43, 36, .14), 0 3px 8px rgba(23, 43, 36, .08);
  transition: background .42s cubic-bezier(.32, .72, 0, 1);
}
.ckp-toggle button::after { content: ''; position: absolute; inset: -7px -4px; }
.ckp-toggle svg { width: 14px; height: 14px; }

.ckp-map-wrap { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 18px; overflow: hidden; background: #dfe8dc; }
.ckp-map-canvas { position: absolute; inset: 0; }
.ckp-map-expand { position: absolute; top: 8px; right: 8px; z-index: 500; }
.ckp-empty {
  display: grid; place-items: center; gap: 6px; padding: 26px 18px; text-align: center;
  border-radius: 28px; background: rgba(255, 255, 255, .62);
  -webkit-backdrop-filter: blur(25.2px); backdrop-filter: blur(25.2px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .95), 0 0 0 .5px rgba(23, 43, 36, .10);
  color: var(--feed-muted);
}
.ckp-empty b { color: var(--feed-ink); font: 700 13px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-empty p { margin: 0; max-width: 250px; font: 500 11.5px/1.4 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-empty svg { width: 24px; height: 24px; opacity: .55; }

/* --- Sections ------------------------------------------------------------- */

.ckp-section {
  scroll-margin-top: 72px; border-radius: 28px; padding: 14px 16px;
  background: rgba(255, 255, 255, .62);
  -webkit-backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
  backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .95), 0 0 0 .5px rgba(23, 43, 36, .10), 0 10px 26px rgba(23, 43, 36, .10);
  color: var(--feed-ink);
}
.ckp-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ckp-h2 {
  margin: 0; font: 700 17px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif);
  letter-spacing: -.01em;
}
.ckp-h2 small {
  display: block; margin-top: 2px; color: var(--feed-muted);
  font: 600 10.5px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif);
  letter-spacing: .04em; text-transform: uppercase;
}
.ckp-text {
  margin: 8px 0 0; font: 400 13.5px/1.5 var(--font-sans, -apple-system, system-ui, sans-serif);
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.ckp-link { border: 0; background: none; padding: 0; cursor: pointer; color: var(--feed-muted); font: 600 11px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }

.ckp-daylist { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }
.ckp-day { position: relative; display: flex; gap: 10px; padding-bottom: 12px; }
.ckp-day:last-child { padding-bottom: 0; }
.ckp-day-rail { position: relative; width: 32px; flex: none; display: flex; flex-direction: column; align-items: center; }
.ckp-day-badge {
  width: 32px; height: 32px; display: grid; place-items: center; border-radius: 999px;
  background: rgba(23, 64, 44, .08); color: var(--feed-ink);
  font: 700 11px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
  font-variant-numeric: tabular-nums;
}
.ckp-day-line { flex: 1; width: 1px; margin-top: 4px; background: rgba(23, 43, 36, .12); }
.ckp-day:last-child .ckp-day-line { display: none; }
.ckp-day-body { flex: 1; min-width: 0; padding-top: 2px; }
.ckp-day-label { color: var(--feed-muted); font: 600 9.5px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); text-transform: uppercase; letter-spacing: .06em; }
.ckp-day-title { display: block; margin-top: 2px; font: 700 14px/1.25 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-day-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; color: var(--feed-muted); font: 500 10.5px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); font-variant-numeric: tabular-nums; }
.ckp-day-note { margin: 6px 0 0; font: 400 13px/1.5 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-day-overnight { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; color: var(--feed-muted); font: 500 10.5px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); }

.ckp-kit-list { display: flex; flex-direction: column; margin-top: 8px; }
.ckp-kit-row { display: flex; align-items: center; gap: 9px; min-height: 44px; padding: 6px 0; border-top: .5px solid rgba(23, 43, 36, .08); }
.ckp-kit-row:first-child { border-top: 0; }
.ckp-kit-dot { width: 10px; height: 10px; border-radius: 999px; flex: none; background: #17402c; }
.ckp-kit-name { flex: 1; min-width: 0; font: 600 12.5px/1.25 var(--font-sans, -apple-system, system-ui, sans-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ckp-kit-detail { color: var(--feed-muted); font: 500 10.5px/1.25 var(--font-sans, -apple-system, system-ui, sans-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ckp-kit-weight { flex: none; color: var(--feed-muted); font: 600 10.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif); font-variant-numeric: tabular-nums; }
.ckp-kit-total { margin-left: auto; font: 700 17px/1 var(--font-sans, -apple-system, system-ui, sans-serif); font-variant-numeric: tabular-nums; }

.ckp-drop {
  display: grid; place-items: center; gap: 8px; padding: 18px; margin-top: 10px;
  border-radius: 18px; border: 1px dashed rgba(23, 43, 36, .22);
  background: rgba(255, 255, 255, .35); text-align: center;
}
.ckp-drop p { margin: 0; color: var(--feed-muted); font: 500 11.5px/1.4 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-species { margin-top: 10px; padding: 12px; border-radius: 18px; background: rgba(255, 255, 255, .55); box-shadow: inset 0 0 0 .5px rgba(23, 43, 36, .08); }
.ckp-species b { display: block; font: 700 15px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-species i { display: block; margin-top: 1px; color: var(--feed-muted); font: 400 10.5px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); font-style: italic; }
.ckp-species p { margin: 6px 0 0; font: 400 12.5px/1.5 var(--font-sans, -apple-system, system-ui, sans-serif); }

.ckp-comment { display: flex; gap: 8px; padding: 8px 0; }
.ckp-comment-body { min-width: 0; flex: 1; }
.ckp-comment-name { font: 700 12px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-comment-time { margin-left: 6px; color: var(--feed-muted); font: 500 10px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-comment-text { margin: 2px 0 0; font: 400 12.5px/1.45 var(--font-sans, -apple-system, system-ui, sans-serif); overflow-wrap: anywhere; }
.ckp-composer { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.ckp-composer input {
  flex: 1; min-width: 0; height: 36px; border: .5px solid rgba(23, 43, 36, .14); border-radius: 999px;
  padding: 0 12px; background: rgba(255, 255, 255, .8); color: var(--feed-ink);
  font: 400 12.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif); outline: none;
}
.ckp-composer input:focus { border-color: rgba(23, 64, 44, .48); box-shadow: 0 0 0 3px rgba(91, 127, 85, .14); }
.ckp-send {
  position: relative; width: 34px; height: 34px; flex: none; display: grid; place-items: center;
  border: 0; border-radius: 999px; background: #17402c; color: #fff; cursor: pointer;
}
.ckp-send::after { content: ''; position: absolute; inset: -5px; }
.ckp-send:disabled { opacity: .4; cursor: not-allowed; }

/* --- Viewer média --------------------------------------------------------- */

.ckp-viewer {
  position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center;
  background: rgba(10, 20, 14, .94);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.ckp-viewer img { max-width: 100%; max-height: 100%; object-fit: contain; }
.ckp-viewer-close { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 12px); right: 12px; z-index: 2; }
.ckp-viewer-count {
  position: fixed; top: calc(env(safe-area-inset-top, 0px) + 16px); left: 50%; transform: translateX(-50%);
  padding: 4px 10px; border-radius: 999px; background: rgba(255, 255, 255, .16); color: #fff;
  font: 700 11px/1 var(--font-sans, -apple-system, system-ui, sans-serif); font-variant-numeric: tabular-nums;
}
.ckp-viewer-nav {
  position: fixed; top: 50%; transform: translateY(-50%); width: 38px; height: 38px;
  display: grid; place-items: center; border: 0; border-radius: 999px;
  background: rgba(255, 255, 255, .22); color: #fff; cursor: pointer;
}
.ckp-viewer-nav--prev { left: 10px; }
.ckp-viewer-nav--next { right: 10px; }
.ckp-viewer-caption {
  position: fixed; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  margin: 0 auto; max-width: 520px; padding: 10px 12px; border-radius: 18px;
  background: rgba(255, 255, 255, .16); color: #fff;
  font: 500 12px/1.4 var(--font-sans, -apple-system, system-ui, sans-serif);
}

/* --- Menu ··· ancré dans la top bar --------------------------------------- */

.ckp-more-anchor { position: relative; display: inline-flex; }
.ckp-more-anchor .pmi-options-menu { top: 44px; right: 0; }

@media (prefers-reduced-motion: reduce) {
  .ckp-topbar-veil, .ckp-tile::after, .ckp-toggle button[aria-pressed='true'] { transition: none; }
}
```

- [ ] **Step 2: Importer la feuille dans le layout racine**

Dans `src/app/layout.tsx`, après `import '@/styles/community-feed.css';` (ligne 14) :

```ts
import '@/styles/carnet-profile.css';
```

- [ ] **Step 3: Écrire le test de la top bar (il échoue)**

`src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetTopBar } from '../CarnetTopBar';

afterEach(() => cleanup());

const BASE = {
  title: 'Tour du Mont-Blanc',
  coverImage: 'https://cdn.test/cover.jpg',
  saved: false,
};

describe('CarnetTopBar — top bar 52 du Compte', () => {
  it('rend le retour, la pilule titre et les trois boutons ronds du Compte', () => {
    render(
      <CarnetTopBar {...BASE} onBack={() => {}} onShare={() => {}} onSave={() => {}} onMenu={() => {}} onTitleClick={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Retour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Partager' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Options du carnet' })).toBeTruthy();
    const pill = screen.getByRole('button', { name: /Tour du Mont-Blanc/ });
    expect(pill.className).toContain('ckp-title-pill');
    expect(pill.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/cover.jpg');
  });

  it('appelle les actions au clic', () => {
    const onShare = vi.fn();
    const onSave = vi.fn();
    const onMenu = vi.fn();
    render(
      <CarnetTopBar {...BASE} onBack={() => {}} onShare={onShare} onSave={onSave} onMenu={onMenu} onTitleClick={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Options du carnet' }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onMenu).toHaveBeenCalledOnce();
  });

  it('affiche l’initiale quand le carnet n’a pas de couverture', () => {
    render(
      <CarnetTopBar {...BASE} coverImage={null} onBack={() => {}} onShare={() => {}} onSave={() => {}} onMenu={() => {}} onTitleClick={() => {}} />,
    );
    const pill = screen.getByRole('button', { name: /Tour du Mont-Blanc/ });
    expect(pill.querySelector('img')).toBeNull();
    expect(pill.querySelector('.ckp-title-cover--empty')?.textContent).toBe('T');
  });

  it('marque le bouton Enregistrer comme actif', () => {
    render(
      <CarnetTopBar {...BASE} saved onBack={() => {}} onShare={() => {}} onSave={() => {}} onMenu={() => {}} onTitleClick={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Enregistrer' }).getAttribute('aria-pressed')).toBe('true');
  });
});
```

- [ ] **Step 4: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx`
Expected: FAIL — module `../CarnetTopBar` introuvable.

- [ ] **Step 5: Écrire `CarnetTopBar.tsx`**

```tsx
'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { AccountRoundButton } from '@/components/account/AccountRoundButton';

export interface CarnetTopBarProps {
  title: string;
  coverImage: string | null;
  saved: boolean;
  scrolled?: boolean;
  onBack: () => void;
  onShare: () => void;
  onSave: () => void;
  onMenu: () => void;
  onTitleClick: () => void;
}

/**
 * Top bar du Compte transposée : retour rond 38, pilule titre (cover 24 +
 * titre 12,5/700), trois `.gbtn` 38 à droite. Hauteur 52 + safe area.
 */
export function CarnetTopBar({
  title,
  coverImage,
  saved,
  scrolled = false,
  onBack,
  onShare,
  onSave,
  onMenu,
  onTitleClick,
}: CarnetTopBarProps) {
  return (
    <div className="ckp-topbar" data-scrolled={scrolled ? 'true' : 'false'}>
      <span className="ckp-topbar-veil" aria-hidden="true" />

      <div className="ckp-top-left">
        <AccountRoundButton label="Retour" onClick={onBack}>
          <Icon name="arrow-left" size={18} aria-hidden="true" />
        </AccountRoundButton>

        <button type="button" className="ckp-title-pill" onClick={onTitleClick} title={title}>
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- couverture distante, même source que la carte
            <img className="ckp-title-cover" src={coverImage} alt="" />
          ) : (
            <span className="ckp-title-cover ckp-title-cover--empty" aria-hidden="true">
              {title.charAt(0).toUpperCase()}
            </span>
          )}
          <b>{title}</b>
        </button>
      </div>

      <div className="ckp-top-actions">
        <AccountRoundButton label="Partager" onClick={onShare}>
          <Icon name="send" size={17} aria-hidden="true" />
        </AccountRoundButton>
        <AccountRoundButton label="Enregistrer" onClick={onSave}>
          <Icon name="bookmark" size={17} aria-hidden="true" variant={saved ? 'solid' : 'outline'} />
        </AccountRoundButton>
        <AccountRoundButton label="Options du carnet" onClick={onMenu}>
          <Icon name="more-horizontal" size={18} aria-hidden="true" />
        </AccountRoundButton>
      </div>
    </div>
  );
}

export default CarnetTopBar;
```

> `aria-pressed` du bouton Enregistrer est porté par `AccountRoundButton` : il faut l'ajouter en prop optionnelle dans ce composant (2 lignes, aucune régression : la prop est optionnelle et Communauté ne la passe pas).

- [ ] **Step 6: Ajouter `pressed` à `AccountRoundButton`**

`src/components/account/AccountRoundButton.tsx`

```tsx
export interface AccountRoundButtonProps {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  /** État d'un bouton à bascule (Enregistrer). Omis partout ailleurs. */
  pressed?: boolean;
}

export function AccountRoundButton({ label, onClick, children, className = '', pressed }: AccountRoundButtonProps) {
  return (
    <button
      type="button"
      className={`gbtn ${className}`.trim()}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 7: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Écrire la coquille `CarnetProfileView.tsx` (version 1)**

```tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { CarnetTopBar } from './CarnetTopBar';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetProfileViewProps {
  detail: CarnetDetail;
}

/**
 * Fiche carnet — disposition du Compte : une colonne 520, top bar 52,
 * carte d'identité 28, puis sections, bottom bar 48, aucun onglet actif.
 */
export function CarnetProfileView({ detail }: CarnetProfileViewProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [saved, setSaved] = useState(detail.engagement.favorited);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/carnets');
  }, [router]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <h1 className="sr-only">{detail.title}</h1>

      <div className="lkdv-feed-column">
        <header className="lkdv-feed-header ckp-topbar-host">
          <CarnetTopBar
            title={detail.title}
            coverImage={detail.coverImage}
            saved={saved}
            scrolled={scrolled}
            onBack={handleBack}
            onShare={() => {}}
            onSave={() => {}}
            onMenu={() => {}}
            onTitleClick={scrollToTop}
          />
        </header>

        <main className="ckp-main">{/* carte, médias, sections : tâches 4 à 8 */}</main>
      </div>

      <AccountBottomBar />
    </div>
  );
}

export default CarnetProfileView;
```

> `.lkdv-feed-header` est déjà sticky et porte le padding safe-area ; `CarnetTopBar` rend le fond (voile) et les trois boutons. Ne pas empiler deux paddings : le conteneur `header` garde la géométrie, `CarnetTopBar` ne met pas de padding vertical.

- [ ] **Step 9: Vérifier visuellement la coquille**

```bash
npm run dev
```

Ouvrir `http://localhost:4000/carnets/<id-public>` puis capturer :

```bash
npx playwright screenshot --viewport-size=430,932 "http://localhost:4000/carnets/<id>" /tmp/ckp-430-shell.png
npx playwright screenshot --viewport-size=1440,900 "http://localhost:4000/carnets/<id>" /tmp/ckp-1440-shell.png
```

Attendu : fond `account-bg` identique à `/compte`, colonne 520 centrée, top bar avec retour + pilule titre + 3 boutons ronds, bottom bar 48 sans lentille visible. `read_image` sur les deux captures.

- [ ] **Step 10: Commit**

```bash
git add src/styles/carnet-profile.css src/app/layout.tsx src/components/account/AccountRoundButton.tsx src/components/carnet/profile
git commit -m "feat(carnet): coquille profil, top bar et feuille de style"
```

---

## Task 4: Carte d'identité et capsule de sections

**Files:**
- Create: `src/components/carnet/profile/CarnetIdentityCard.tsx`
- Create: `src/components/carnet/profile/CarnetSectionTabs.tsx`
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetSectionTabs.test.tsx`

**Interfaces:**
- Consumes: `CarnetDetail` (Task 1), `CapsuleTabs`, `.pmi-author`, `.gbtn`, classes `ckp-*` (Task 3).
- Produces:
  - `<CarnetIdentityCard detail onOpenViewer onOpenAuthor onOpenComments onLike onOpenManage onSectionChange activeSection descriptionExpanded onExpandDescription />`
  - `CARNET_SECTIONS: readonly { id: 'recit' | 'parcours' | 'moments' | 'materiel' | 'nature'; label: string; icon: ReactNode }[]`
  - `<CarnetSectionTabs activeIndex onIndexChange />`

- [ ] **Step 1: Écrire le test de la carte (il échoue)**

`src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetIdentityCard } from '../CarnetIdentityCard';
import type { CarnetDetail } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

function detail(overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return {
    id: 'c1',
    title: 'Tour du Mont-Blanc',
    destination: 'France / Italie / Suisse',
    description: 'Dix jours, trois pays, deux bivouacs.',
    coverImage: 'https://cdn.test/cover.jpg',
    coverImageAlt: 'Crête au lever du jour',
    startDate: '2026-09-26',
    endDate: '2026-10-02',
    dateRange: '26 sept. – 2 oct. 2026',
    visibility: 'public',
    isPublic: true,
    verified: true,
    isOwner: false,
    author: { id: 'u1', name: 'Camille Rochat', handle: 'camille', avatarUrl: null, trustScore: 94 },
    stats: [
      { key: 'distance', label: 'DISTANCE', value: '106,4 km' },
      { key: 'elevation', label: 'DÉNIVELÉ +', value: '2 002 m' },
      { key: 'days', label: 'JOURS', value: '7' },
    ],
    engagement: { likes: 6, comments: 3, views: 2320, liked: false, favorited: false },
    moments: [],
    photoMoments: [],
    days: [],
    kit: { totalWeightG: null, items: [] },
    trace: null,
    distanceKm: 106.4,
    elevationM: 2002,
    ...overrides,
  };
}

const noop = () => {};

function renderCard(props: Partial<React.ComponentProps<typeof CarnetIdentityCard>> = {}) {
  return render(
    <CarnetIdentityCard
      detail={detail()}
      activeSection={0}
      onSectionChange={noop}
      onOpenViewer={noop}
      onOpenAuthor={noop}
      onOpenComments={noop}
      onLike={noop}
      onOpenManage={noop}
      onExpandDescription={noop}
      {...props}
    />,
  );
}

describe('CarnetIdentityCard — carte profil', () => {
  it('rend la couverture 1:1, le titre, la destination et les dates', () => {
    const { container } = renderCard();
    const img = container.querySelector('.ckp-cover') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/cover.jpg');
    expect(img.getAttribute('alt')).toBe('Crête au lever du jour');
    expect(screen.getByRole('heading', { level: 2, name: 'Tour du Mont-Blanc' })).toBeTruthy();
    expect(screen.getByText('France / Italie / Suisse')).toBeTruthy();
    expect(screen.getByText('26 sept. – 2 oct. 2026')).toBeTruthy();
  });

  it('affiche les trois statistiques réelles, jamais une valeur inventée', () => {
    const { container } = renderCard();
    const values = [...container.querySelectorAll('.ckp-stat-v')].map((n) => n.textContent);
    expect(values).toEqual(['106,4 km', '2 002 m', '7']);
  });

  it('supprime les cellules absentes', () => {
    const { container } = renderCard({ detail: detail({ stats: [] }) });
    expect(container.querySelectorAll('.ckp-stat')).toHaveLength(0);
  });

  it('ne montre le badge Vérifié que si verified', () => {
    renderCard();
    expect(screen.getByText('Vérifié')).toBeTruthy();
    cleanup();
    renderCard({ detail: detail({ verified: false }) });
    expect(screen.queryByText('Vérifié')).toBeNull();
  });

  it('affiche le badge Privé au propriétaire seulement', () => {
    renderCard({ detail: detail({ isPublic: false, isOwner: true }) });
    expect(screen.getByText('Privé')).toBeTruthy();
    cleanup();
    renderCard({ detail: detail({ isPublic: false, isOwner: false }) });
    expect(screen.queryByText('Privé')).toBeNull();
  });

  it('affiche « Auteur non renseigné » sans auteur, sans lien', () => {
    renderCard({ detail: detail({ author: null }) });
    expect(screen.getByText('Auteur non renseigné')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Camille/ })).toBeNull();
  });

  it('affiche les compteurs réels des pilules et bascule le like', () => {
    const onLike = vi.fn();
    const onOpenComments = vi.fn();
    renderCard({ onLike, onOpenComments });
    const like = screen.getByRole('button', { name: /J’aime, 6/ });
    expect(like.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(like);
    expect(onLike).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Commentaires, 3/ }));
    expect(onOpenComments).toHaveBeenCalledOnce();
  });

  it('ouvre la gestion pour le propriétaire', () => {
    const onOpenManage = vi.fn();
    renderCard({ detail: detail({ isOwner: true }), onOpenManage });
    fireEvent.click(screen.getByRole('button', { name: 'Gérer le carnet' }));
    expect(onOpenManage).toHaveBeenCalledOnce();
  });

  it('rend la capsule des 5 sections dans la carte', () => {
    renderCard();
    const tablist = screen.getByRole('tablist', { name: 'Sections du carnet' });
    expect(tablist.className).toContain('ckp-tabs');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `CarnetSectionTabs.tsx`**

```tsx
'use client';

import React from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';

/** Les 5 sections de la fiche. Aucune 6e : les étapes vivent dans le récit. */
export const CARNET_SECTIONS = [
  { id: 'recit', label: 'Récit', iconName: 'book-open' },
  { id: 'parcours', label: 'Parcours', iconName: 'route' },
  { id: 'moments', label: 'Moments', iconName: 'image-plus' },
  { id: 'materiel', label: 'Matériel', iconName: 'backpack' },
  { id: 'nature', label: 'Nature', iconName: 'compass' },
] as const;

export type CarnetSectionId = (typeof CARNET_SECTIONS)[number]['id'];

const ITEMS: CapsuleTabItem[] = CARNET_SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  icon: <Icon name={section.iconName} size={18} aria-hidden="true" />,
}));

export interface CarnetSectionTabsProps {
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

/** Capsule principale 48 px du Compte, dans la carte d'identité. */
export function CarnetSectionTabs({ activeIndex, onIndexChange }: CarnetSectionTabsProps) {
  return (
    <div className="ckp-tabs">
      <CapsuleTabs
        items={ITEMS}
        activeIndex={activeIndex}
        onIndexChange={onIndexChange}
        ariaLabel="Sections du carnet"
        showLabels
      />
    </div>
  );
}

export default CarnetSectionTabs;
```

- [ ] **Step 4: Écrire le test des onglets (il échoue)**

`src/components/carnet/profile/__tests__/CarnetSectionTabs.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARNET_SECTIONS, CarnetSectionTabs } from '../CarnetSectionTabs';

afterEach(() => cleanup());

describe('CarnetSectionTabs — capsule 48 dans la carte', () => {
  it('expose les cinq sections attendues, dans l’ordre', () => {
    expect(CARNET_SECTIONS.map((s) => s.label)).toEqual([
      'Récit',
      'Parcours',
      'Moments',
      'Matériel',
      'Nature',
    ]);
  });

  it('rend une seule lentille et délègue le changement d’index', () => {
    const onIndexChange = vi.fn();
    const { container } = render(<CarnetSectionTabs activeIndex={0} onIndexChange={onIndexChange} />);
    expect(container.querySelectorAll('.sel-lens')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Récit' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Matériel' }));
    expect(onIndexChange).toHaveBeenCalledWith(3);
  });

  it('avance au clavier avec les flèches', () => {
    const onIndexChange = vi.fn();
    render(<CarnetSectionTabs activeIndex={0} onIndexChange={onIndexChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 5: Écrire `CarnetIdentityCard.tsx`**

```tsx
'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetSectionTabs } from './CarnetSectionTabs';
import { formatWeight } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetIdentityCardProps {
  detail: CarnetDetail;
  activeSection: number;
  onSectionChange: (index: number) => void;
  onOpenViewer: () => void;
  onOpenAuthor: () => void;
  onOpenComments: () => void;
  onLike: () => void;
  onOpenManage: () => void;
  onExpandDescription: () => void;
}

function StatCells({ stats }: { stats: CarnetDetail['stats'] }) {
  if (stats.length === 0) return null;
  return (
    <div className="ckp-stats">
      {stats.map((stat) => (
        <div className="ckp-stat" key={stat.key} data-stat={stat.key}>
          <span className="ckp-stat-v">{stat.value}</span>
          <span className="ckp-stat-l">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

function AuthorRow({ author, onOpenAuthor }: { author: CarnetDetail['author']; onOpenAuthor: () => void }) {
  if (!author) {
    return (
      <div className="ckp-author-static">
        <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">?</span>
        <span>
          <b className="ckp-author-name">Auteur non renseigné</b>
          <small className="ckp-author-meta">Ce carnet n’a pas d’auteur rattaché.</small>
        </span>
      </div>
    );
  }

  const name = author.name;
  return (
    <button type="button" className="pmi-author ckp-author" onClick={onOpenAuthor} aria-label={`Profil de ${name}`}>
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant, même source que le Compte
        <img className="pmi-author-av" src={author.avatarUrl} alt="" />
      ) : (
        <span className="pmi-author-av pmi-author-initial" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="pmi-author-txt">
        <b className="ckp-author-name">{name}</b>
        <small className="ckp-author-meta">
          {author.handle ? `@${author.handle}` : 'Auteur du carnet'}
        </small>
      </span>
      {author.trustScore > 0 ? <span className="ckp-trust" aria-label={`Score de confiance ${author.trustScore}`}>{author.trustScore}</span> : null}
    </button>
  );
}

/** Carte d'identité du carnet — la carte profil du Compte, transposée. */
export function CarnetIdentityCard({
  detail,
  activeSection,
  onSectionChange,
  onOpenViewer,
  onOpenAuthor,
  onOpenComments,
  onLike,
  onOpenManage,
  onExpandDescription,
}: CarnetIdentityCardProps) {
  const showMore = Boolean(detail.description && detail.description.length > 160);

  return (
    <section className="ckp-card" aria-label="Identité du carnet">
      <div className="ckp-head">
        <div className="ckp-cover-wrap">
          {detail.coverImage ? (
            <button type="button" className="ckp-cover-wrap" onClick={onOpenViewer} aria-label="Agrandir la couverture" style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- couverture distante */}
              <img className="ckp-cover" src={detail.coverImage} alt={detail.coverImageAlt ?? ''} />
              <span className="ckp-cover-expand" aria-hidden="true">
                <Icon name="external-link" size={12} />
              </span>
            </button>
          ) : (
            <div className="ckp-cover ckp-cover--empty">
              <b aria-hidden="true">{(detail.destination ?? detail.title).charAt(0).toUpperCase()}</b>
              <small>Sans couverture</small>
            </div>
          )}
        </div>

        <div className="ckp-id-col">
          <div className="ckp-title-row">
            <h2 className="ckp-title">{detail.title}</h2>
            {detail.verified ? (
              <span className="ckp-badge">
                <Icon name="shield-check" size={12} aria-hidden="true" />
                Vérifié
              </span>
            ) : null}
            {!detail.isPublic && detail.isOwner ? (
              <span className="ckp-badge ckp-badge--private">
                <Icon name="lock" size={12} aria-hidden="true" />
                Privé
              </span>
            ) : null}
          </div>
          {detail.destination ? <p className="ckp-sub">{detail.destination}</p> : null}
          {detail.dateRange ? <p className="ckp-dates">{detail.dateRange}</p> : null}
          <StatCells stats={detail.stats} />
        </div>
      </div>

      <AuthorRow author={detail.author} onOpenAuthor={onOpenAuthor} />

      {detail.description ? (
        <>
          <p className={`ckp-desc${showMore ? ' is-clamped' : ''}`}>{detail.description}</p>
          {showMore ? (
            <button type="button" className="ckp-desc-more" onClick={onExpandDescription}>
              Lire la suite
            </button>
          ) : null}
        </>
      ) : null}

      <div className="ckp-actions">
        <button
          type="button"
          className={`ckp-pill${detail.engagement.liked ? ' is-on' : ''}`}
          onClick={onLike}
          aria-pressed={detail.engagement.liked}
          aria-label={`J’aime, ${detail.engagement.likes} ${detail.engagement.likes > 1 ? 'mentions' : 'mention'}`}
        >
          <Icon name="heart" size={16} variant={detail.engagement.liked ? 'solid' : 'outline'} aria-hidden="true" />
          {detail.engagement.likes}
        </button>
        <button
          type="button"
          className="ckp-pill"
          onClick={onOpenComments}
          aria-label={`Commentaires, ${detail.engagement.comments}`}
        >
          <Icon name="message-square" size={16} aria-hidden="true" />
          {detail.engagement.comments}
        </button>
        {detail.isOwner ? (
          <button type="button" className="ckp-pill" onClick={onOpenManage} aria-label="Gérer le carnet">
            <Icon name="pencil" size={16} aria-hidden="true" />
            Gérer
          </button>
        ) : null}
        {!detail.isOwner && detail.kit.totalWeightG ? (
          <span className="ckp-pill" aria-hidden="true">
            <Icon name="backpack" size={16} />
            {formatWeight(detail.kit.totalWeightG)}
          </span>
        ) : null}
      </div>

      <div className="ckp-sep" />
      <CarnetSectionTabs activeIndex={activeSection} onIndexChange={onSectionChange} />
    </section>
  );
}

export default CarnetIdentityCard;
```

> `Icon` accepte `variant="solid"` : vérifier que le glyphe `heart` existe en solid, sinon garder `outline` et colorer via `.ckp-pill.is-on` (déjà fait). Le test n'exige pas le variant.

- [ ] **Step 6: Brancher la carte dans la vue**

Remplacer le `<main className="ckp-main">{/* … */}</main>` de `CarnetProfileView` par :

```tsx
const [section, setSection] = useState(0);
const [liked, setLiked] = useState(detail.engagement.liked);
const [likeCount, setLikeCount] = useState(detail.engagement.likes);

const detailView = React.useMemo(
  () => ({ ...detail, engagement: { ...detail.engagement, liked, likes: likeCount } }),
  [detail, liked, likeCount],
);

const scrollToSection = useCallback((index: number) => {
  setSection(index);
  const id = CARNET_SECTIONS[index]?.id;
  if (!id) return;
  document.getElementById(`ckp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, []);

<main className="ckp-main">
  <CarnetIdentityCard
    detail={detailView}
    activeSection={section}
    onSectionChange={scrollToSection}
    onOpenViewer={() => setViewerIndex(0)}
    onOpenAuthor={() => setAuthorOpen(true)}
    onOpenComments={() => setCommentsOpen(true)}
    onLike={() => {
      setLiked((value) => !value);
      setLikeCount((value) => value + (liked ? -1 : 1));
    }}
    onOpenManage={() => setManageOpen(true)}
    onExpandDescription={() => scrollToSection(0)}
  />
</main>
```

Ajouter les états et les imports correspondants :

```tsx
import { CARNET_SECTIONS } from './CarnetSectionTabs';
import { CarnetIdentityCard } from './CarnetIdentityCard';

const [viewerIndex, setViewerIndex] = useState<number | null>(null);
const [authorOpen, setAuthorOpen] = useState(false);
const [commentsOpen, setCommentsOpen] = useState(false);
const [manageOpen, setManageOpen] = useState(false);
```

> Ces états pilotent les drawers des tâches 7 et 8. Tant qu'ils ne sont pas branchés, les rendre inutilisés déclenche `no-unused-vars` : la tâche 7 les consomme, garder les `set*` et supprimer les variables lues inutilisées à ce stade.

- [ ] **Step 7: Lancer les tests de la tâche**

Run: `npm test -- --run src/components/carnet/profile/__tests__`
Expected: PASS (4 + 9 + 3 tests).

- [ ] **Step 8: Captures 430 / 768 / 1440 et lecture**

```bash
npx playwright screenshot --viewport-size=430,932 "http://localhost:4000/carnets/<id>" /tmp/ckp-430-card.png
npx playwright screenshot --viewport-size=768,1024 "http://localhost:4000/carnets/<id>" /tmp/ckp-768-card.png
npx playwright screenshot --viewport-size=1440,900 "http://localhost:4000/carnets/<id>" /tmp/ckp-1440-card.png
```

Attendu : carte 28 avec cover 96 (112 à ≥768), titre sur 2 lignes max, 3 stats alignées, pastille auteur, description 3 lignes + « Lire la suite », deux pilules 36, capsule 48 à 5 cellules. `read_image` sur les trois.

- [ ] **Step 9: Commit**

```bash
git add src/components/carnet/profile
git commit -m "feat(carnet): carte d'identite et capsule de sections"
```

---

## Task 5: Bloc médias — grille 3 colonnes, mode carte, viewer

**Files:**
- Create: `src/components/carnet/profile/CarnetTraceMap.tsx`
- Create: `src/components/carnet/profile/CarnetMediaBlock.tsx`
- Create: `src/components/carnet/profile/CarnetMediaViewer.tsx`
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetMediaBlock.test.tsx`

**Interfaces:**
- Consumes: `detail.photoMoments`, `detail.trace`, `detail.distanceKm`, `detail.elevationM`, `CarnetTraceMap`.
- Produces:
  - `<CarnetMediaBlock detail mode onModeChange onOpenViewer onOpenMap onDownloadGpx />`
  - `<CarnetTraceMap trace distanceKm elevationM className />` (client, Leaflet dynamique)
  - `<CarnetMediaViewer items index onIndexChange onClose />`
  - `downloadGpx(name, trace): void` exporté par `CarnetMediaBlock.tsx`

- [ ] **Step 1: Écrire le test du bloc médias (il échoue)**

`src/components/carnet/profile/__tests__/CarnetMediaBlock.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetMediaBlock } from '../CarnetMediaBlock';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

vi.mock('../CarnetTraceMap', () => ({
  CarnetTraceMap: () => <div data-testid="trace-map" />,
}));

function moment(id: string, imageUrl: string | null): CarnetMomentItem {
  return { id, dayNumber: 1, time: null, caption: null, authorName: null, place: null, imageUrl };
}

function detail(photoMoments: CarnetMomentItem[], overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return {
    id: 'c1',
    title: 'Tour du Mont-Blanc',
    destination: null,
    description: null,
    coverImage: null,
    coverImageAlt: null,
    startDate: null,
    endDate: null,
    dateRange: null,
    visibility: 'public',
    isPublic: true,
    verified: false,
    isOwner: false,
    author: null,
    stats: [],
    engagement: { likes: 0, comments: 0, views: 0, liked: false, favorited: false },
    moments: photoMoments,
    photoMoments,
    days: [],
    kit: { totalWeightG: null, items: [] },
    trace: null,
    distanceKm: null,
    elevationM: null,
    ...overrides,
  };
}

describe('CarnetMediaBlock — grille du Compte', () => {
  it('rend une tuile carrée par photo, sans radius', () => {
    const { container } = render(
      <CarnetMediaBlock detail={detail([moment('a', 'https://cdn.test/a.jpg'), moment('b', 'https://cdn.test/b.jpg')])} mode="grid" onModeChange={() => {}} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    const tiles = container.querySelectorAll('.ckp-tile');
    expect(tiles).toHaveLength(2);
    expect((tiles[0] as HTMLElement).style.borderRadius).not.toContain('18');
    expect(container.querySelector('.ckp-grid')).toBeTruthy();
  });

  it('affiche un état vide honnête sans photo', () => {
    render(
      <CarnetMediaBlock detail={detail([])} mode="grid" onModeChange={() => {}} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    expect(screen.getByText('Aucun moment pour l’instant.')).toBeTruthy();
  });

  it('plafonne à 9 tuiles et résume le reste en « +N »', () => {
    const many = Array.from({ length: 12 }, (_, index) => moment(`m${index}`, `https://cdn.test/${index}.jpg`));
    const { container } = render(
      <CarnetMediaBlock detail={detail(many)} mode="grid" onModeChange={() => {}} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    expect(container.querySelectorAll('.ckp-tile')).toHaveLength(9);
    expect(container.querySelector('.ckp-tile-more')?.textContent).toBe('+3');
  });

  it('ouvre le viewer sur la bonne image', () => {
    const onOpenViewer = vi.fn();
    const { container } = render(
      <CarnetMediaBlock detail={detail([moment('a', 'https://cdn.test/a.jpg'), moment('b', 'https://cdn.test/b.jpg')])} mode="grid" onModeChange={() => {}} onOpenViewer={onOpenViewer} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    fireEvent.click(container.querySelectorAll('.ckp-tile')[1]);
    expect(onOpenViewer).toHaveBeenCalledWith(1);
  });

  it('bascule en mode carte avec la trace réelle', () => {
    const { rerender } = render(
      <CarnetMediaBlock detail={detail([], { trace: { type: 'LineString', coordinates: [] } })} mode="grid" onModeChange={() => {}} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    expect(screen.queryByTestId('trace-map')).toBeNull();
    rerender(
      <CarnetMediaBlock detail={detail([], { trace: { type: 'LineString', coordinates: [] } })} mode="map" onModeChange={() => {}} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    expect(screen.getByTestId('trace-map')).toBeTruthy();
  });

  it('affiche « Aucune trace GPS. » sans trace, et désactive le GPX', () => {
    const onDownloadGpx = vi.fn();
    render(
      <CarnetMediaBlock detail={detail([])} mode="map" onModeChange={() => {}} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={onDownloadGpx} />,
    );
    expect(screen.getByText('Aucune trace GPS.')).toBeTruthy();
    const gpx = screen.getByRole('button', { name: 'Télécharger le GPX' }) as HTMLButtonElement;
    expect(gpx.disabled).toBe(true);
  });

  it('expose le toggle 30 grille/carte comme un sélecteur à deux états', () => {
    const onModeChange = vi.fn();
    render(
      <CarnetMediaBlock detail={detail([moment('a', 'https://cdn.test/a.jpg')])} mode="grid" onModeChange={onModeChange} onOpenViewer={() => {}} onOpenMap={() => {}} onDownloadGpx={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Grille' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));
    expect(onModeChange).toHaveBeenCalledWith('map');
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetMediaBlock.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `CarnetTraceMap.tsx`**

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { leafletTiles } from '@/components/map/engine/leafletTiles';

export interface CarnetTraceMapProps {
  trace: unknown;
  distanceKm?: number | null;
  elevationM?: number | null;
  className?: string;
}

function extractCoords(trace: any): [number, number][] {
  const raw = trace?.geometry?.coordinates ?? trace?.coordinates ?? trace;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((point: any) => {
      if (Array.isArray(point)) return [Number(point[1]), Number(point[0])] as [number, number];
      if (point && typeof point === 'object') return [Number(point.lat), Number(point.lng)] as [number, number];
      return null;
    })
    .filter((point): point is [number, number] => Boolean(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

/**
 * Carte de la fiche : mêmes tuiles, même crédit et même trace que le Compte
 * (Leaflet, pas de Card ni de Button : le bloc porte sa propre géométrie 1:1).
 */
export function CarnetTraceMap({ trace, className = '' }: CarnetTraceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let mounted = true;

    if (mapRef.current) {
      mapRef.current.remove?.();
      mapRef.current = null;
    }
    try {
      delete (container as any)._leaflet_id;
    } catch {
      /* Leaflet garde un id : sans effet hors dev */
    }

    import('leaflet').then((L) => {
      if (!mounted) return;
      const coords = extractCoords(trace);
      const map = L.map(container, {
        center: coords[0] ?? [45.9, 6.9],
        zoom: coords.length > 0 ? 10 : 4,
        zoomControl: false,
        attributionControl: false,
        dragging: coords.length > 0,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.control.attribution({ prefix: false }).addTo(map);
      const tiles = leafletTiles('osm');
      L.tileLayer(tiles.url, { ...tiles.options, keepBuffer: 4 }).addTo(map);

      if (coords.length > 0) {
        const halo = L.polyline(coords, { color: '#ffffff', weight: 7, opacity: 0.9, lineCap: 'round' }).addTo(map);
        L.polyline(coords, { color: '#17402C', weight: 4.5, opacity: 1, lineCap: 'round' }).addTo(map);
        L.circleMarker(coords[0], { radius: 6, color: '#fff', fillColor: '#17402C', fillOpacity: 1, weight: 2 }).addTo(map);
        L.circleMarker(coords[coords.length - 1], { radius: 6, color: '#fff', fillColor: '#3d7a52', fillOpacity: 1, weight: 2 }).addTo(map);
        try {
          map.fitBounds(halo.getBounds(), { padding: [26, 26] });
        } catch {
          /* bounds dégénérés : la vue initiale suffit */
        }
      }

      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          /* carte démontée entre-temps */
        }
      }, 120);
      setReady(true);
    });

    const observer = new ResizeObserver(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch {
        /* noop */
      }
    });
    observer.observe(container);

    return () => {
      mounted = false;
      observer.disconnect();
      try {
        mapRef.current?.remove?.();
      } catch {
        /* noop */
      }
      mapRef.current = null;
    };
  }, [trace]);

  return (
    <div className={`ckp-map-canvas ${className}`.trim()} ref={containerRef} data-ready={ready ? 'true' : 'false'} aria-label="Carte du parcours" />
  );
}

export default CarnetTraceMap;
```

- [ ] **Step 4: Écrire `CarnetMediaViewer.tsx`**

```tsx
'use client';

import React, { useCallback, useEffect } from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';

export interface CarnetMediaViewerProps {
  items: CarnetMomentItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Viewer plein écran : image, 1/N, fermeture 38, légende verre. */
export function CarnetMediaViewer({ items, index, onIndexChange, onClose }: CarnetMediaViewerProps) {
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  const item = items[safeIndex];

  const go = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      onIndexChange((safeIndex + delta + items.length) % items.length);
    },
    [items.length, onIndexChange, safeIndex],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  if (!item) return null;

  const caption = [item.place, item.caption].filter(Boolean).join(' · ');

  return (
    <div className="ckp-viewer" role="dialog" aria-modal="true" aria-label="Photo du carnet">
      {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
      <img src={item.imageUrl ?? ''} alt={item.caption ?? 'Photo du carnet'} />
      <span className="ckp-viewer-count">
        {safeIndex + 1}/{items.length}
      </span>
      <button type="button" className="gbtn ckp-viewer-close" onClick={onClose} aria-label="Fermer">
        <Icon name="x" size={18} aria-hidden="true" />
      </button>
      {items.length > 1 ? (
        <>
          <button type="button" className="ckp-viewer-nav ckp-viewer-nav--prev" onClick={() => go(-1)} aria-label="Photo précédente">
            <Icon name="chevron-left" size={18} aria-hidden="true" />
          </button>
          <button type="button" className="ckp-viewer-nav ckp-viewer-nav--next" onClick={() => go(1)} aria-label="Photo suivante">
            <Icon name="chevron-right" size={18} aria-hidden="true" />
          </button>
        </>
      ) : null}
      {caption ? <p className="ckp-viewer-caption">{caption}</p> : null}
    </div>
  );
}

export default CarnetMediaViewer;
```

- [ ] **Step 5: Écrire `CarnetMediaBlock.tsx`**

```tsx
'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(() => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap), {
  ssr: false,
  loading: () => <div className="ckp-map-canvas" aria-hidden="true" />,
});

export type CarnetMediaMode = 'grid' | 'map';

export interface CarnetMediaBlockProps {
  detail: CarnetDetail;
  mode: CarnetMediaMode;
  onModeChange: (mode: CarnetMediaMode) => void;
  onOpenViewer: (index: number) => void;
  onOpenMap: () => void;
  onDownloadGpx: () => void;
}

const MAX_TILES = 9;

export function downloadGpx(name: string, trace: unknown) {
  const raw = (trace as any)?.geometry?.coordinates ?? (trace as any)?.coordinates ?? [];
  if (!Array.isArray(raw) || raw.length === 0) return;
  const points = raw
    .map((point: any) => {
      const lng = Array.isArray(point) ? point[0] : point?.lng;
      const lat = Array.isArray(point) ? point[1] : point?.lat;
      const ele = Array.isArray(point) ? point[2] : point?.ele;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
      return `<trkpt lat="${lat}" lon="${lng}">${Number.isFinite(ele) ? `<ele>${ele}</ele>` : ''}</trkpt>`;
    })
    .join('');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Le Kit du Voyageur"><metadata><name>${name}</name></metadata><trk><name>${name}</name><trkseg>${points}</trkseg></trk></gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Groupe grille / carte du carnet : la grille 3 colonnes du Compte, sans radius. */
export function CarnetMediaBlock({ detail, mode, onModeChange, onOpenViewer, onOpenMap, onDownloadGpx }: CarnetMediaBlockProps) {
  const photos = useMemo(() => detail.photoMoments, [detail.photoMoments]);
  const visible = photos.slice(0, MAX_TILES);
  const hidden = photos.length - visible.length;
  const hasTrace = Array.isArray((detail.trace as any)?.coordinates) || Array.isArray((detail.trace as any)?.geometry?.coordinates);

  return (
    <section className="ckp-media" id="ckp-parcours" aria-label="Moments et parcours">
      {mode === 'grid' ? (
        photos.length === 0 ? (
          <div className="ckp-empty">
            <Icon name="image-plus" size={24} aria-hidden="true" />
            <b>Aucun moment pour l’instant.</b>
            <p>{detail.isOwner ? 'Ajoutez un moment depuis votre carnet pour le voir ici.' : 'L’auteur n’a pas encore ajouté de photo.'}</p>
          </div>
        ) : (
          <div className="ckp-grid">
            {visible.map((moment, index) => (
              <button
                key={moment.id}
                type="button"
                className="ckp-tile"
                onClick={() => onOpenViewer(index)}
                aria-label={moment.caption ? `Photo ${index + 1} : ${moment.caption}` : `Photo ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
                <img src={moment.imageUrl ?? ''} alt="" loading={index < 3 ? 'eager' : 'lazy'} />
                {index === MAX_TILES - 1 && hidden > 0 ? <span className="ckp-tile-more">+{hidden}</span> : null}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="ckp-map-wrap">
          {hasTrace ? (
            <>
              <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} />
              <button type="button" className="gbtn ckp-map-expand" onClick={onOpenMap} aria-label="Agrandir la carte">
                <Icon name="external-link" size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="ckp-empty" style={{ height: '100%', borderRadius: 18 }}>
              <Icon name="route" size={24} aria-hidden="true" />
              <b>Aucune trace GPS.</b>
              <p>{detail.isOwner ? 'Ajoutez une trace depuis votre carnet.' : 'Ce carnet n’a pas de trace enregistrée.'}</p>
            </div>
          )}
          <div className="ckp-map-foot">
            <span className="ckp-day-meta">
              {detail.distanceKm ? `${detail.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : null}
              {detail.elevationM ? ` · ${detail.elevationM.toLocaleString('fr-FR')} m D+` : null}
            </span>
            <button type="button" className="ckp-pill ckp-pill--primary" onClick={onDownloadGpx} disabled={!hasTrace}>
              <Icon name="download" size={16} aria-hidden="true" />
              Télécharger le GPX
            </button>
          </div>
        </div>
      )}

      <div className="ckp-toggle" role="group" aria-label="Affichage des médias">
        <button type="button" aria-pressed={mode === 'grid'} aria-label="Grille" onClick={() => onModeChange('grid')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.6" />
            <rect x="14" y="3" width="7" height="7" rx="1.6" />
            <rect x="3" y="14" width="7" height="7" rx="1.6" />
            <rect x="14" y="14" width="7" height="7" rx="1.6" />
          </svg>
        </button>
        <button type="button" aria-pressed={mode === 'map'} aria-label="Carte" onClick={() => onModeChange('map')}>
          <Icon name="map" size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default CarnetMediaBlock;
```

Ajouter la règle de pied de carte dans `carnet-profile.css` :

```css
.ckp-map-foot {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 400;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, .88));
}
.ckp-map-foot .ckp-day-meta { margin: 0; }
```

- [ ] **Step 6: Brancher le bloc dans la vue**

Dans `CarnetProfileView`, après la carte :

```tsx
const [mediaMode, setMediaMode] = useState<CarnetMediaMode>('grid');

<CarnetMediaBlock
  detail={detailView}
  mode={mediaMode}
  onModeChange={setMediaMode}
  onOpenViewer={(index) => setViewerIndex(index)}
  onOpenMap={() => setMapOpen(true)}
  onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
/>

{viewerIndex !== null ? (
  <CarnetMediaViewer
    items={detail.photoMoments}
    index={viewerIndex}
    onIndexChange={setViewerIndex}
    onClose={() => setViewerIndex(null)}
  />
) : null}
```

Et faire suivre la capsule : `Parcours` (index 1) met `mediaMode` à `'map'`, `Moments` (index 2) à `'grid'`.

```tsx
const scrollToSection = useCallback((index: number) => {
  setSection(index);
  const id = CARNET_SECTIONS[index]?.id;
  if (id === 'parcours') setMediaMode('map');
  if (id === 'moments') setMediaMode('grid');
  if (!id) return;
  document.getElementById(`ckp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, []);
```

- [ ] **Step 7: Lancer les tests de la tâche**

Run: `npm test -- --run src/components/carnet/profile/__tests__`
Expected: PASS — 7 nouveaux tests + les 16 précédents.

- [ ] **Step 8: Vérifier le rendu de la carte Leaflet**

```bash
npx playwright screenshot --viewport-size=430,932 "http://localhost:4000/carnets/<id>" /tmp/ckp-430-media.png
```

Cliquer le toggle « Carte » puis capturer `/tmp/ckp-430-map.png`. Attendu : tuiles visibles, trace forest 4,5, marqueurs départ/arrivée, crédit complet, footer stats + « Télécharger le GPX » (désactivé si pas de trace).

- [ ] **Step 9: Commit**

```bash
git add src/components/carnet/profile src/styles/carnet-profile.css
git commit -m "feat(carnet): grille 3 colonnes, mode carte et viewer media"
```

---

## Task 6: Sections Récit, Matériel, Nature

**Files:**
- Create: `src/components/carnet/profile/CarnetStorySection.tsx`
- Create: `src/components/carnet/profile/CarnetKitSection.tsx`
- Create: `src/components/carnet/profile/CarnetNatureSection.tsx`
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetStorySection.test.tsx`

**Interfaces:**
- Consumes: `CarnetDetail.days`, `.description`, `.kit`, `.isOwner`.
- Produces:
  - `<CarnetStorySection detail />` → `<section id="ckp-recit" class="ckp-section">`
  - `<CarnetKitSection detail />` → `<section id="ckp-materiel" class="ckp-section">`
  - `<CarnetNatureSection canWrite onRequireAuth />` → `<section id="ckp-nature" class="ckp-section">`

> Note d'exécution : `?etape=kit` **n'existe pas** sur `/compas` (vérifié : aucun `searchParams` de ce nom). « Reconfigurer » pointe donc sur `/compas`, sans paramètre inventé.

- [ ] **Step 1: Écrire le test du récit (il échoue)**

`src/components/carnet/profile/__tests__/CarnetStorySection.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarnetStorySection } from '../CarnetStorySection';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

const DAY: CarnetDay = {
  id: 'd1',
  dayNumber: 3,
  label: 'JOUR 3 · 28 sept.',
  from: 'Les Contamines',
  to: 'Les Chapieux',
  note: 'Le col du Bonhomme sous la brume.',
  distanceKm: 18.2,
  elevationM: 1350,
  durationText: '7h30',
  weather: 'brume · 9 °C',
  overnight: 'Refuge de la Nova',
};

function detail(overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return {
    id: 'c1',
    title: 'Tour du Mont-Blanc',
    destination: null,
    description: 'Dix jours, trois pays, deux bivouacs.',
    coverImage: null,
    coverImageAlt: null,
    startDate: null,
    endDate: null,
    dateRange: null,
    visibility: 'public',
    isPublic: true,
    verified: false,
    isOwner: false,
    author: null,
    stats: [],
    engagement: { likes: 0, comments: 0, views: 0, liked: false, favorited: false },
    moments: [],
    photoMoments: [],
    days: [DAY],
    kit: { totalWeightG: null, items: [] },
    trace: null,
    distanceKm: null,
    elevationM: null,
    ...overrides,
  };
}

describe('CarnetStorySection — récit et étapes', () => {
  it('rend le récit complet et la timeline réelle', () => {
    render(<CarnetStorySection detail={detail()} />);
    expect(screen.getByRole('heading', { level: 2, name: /Récit/ })).toBeTruthy();
    expect(screen.getByText('Dix jours, trois pays, deux bivouacs.')).toBeTruthy();
    expect(screen.getByText('Les Contamines → Les Chapieux')).toBeTruthy();
    expect(screen.getByText('18,2 km')).toBeTruthy();
    expect(screen.getByText('1 350 m D+')).toBeTruthy();
    expect(screen.getByText('7h30')).toBeTruthy();
    expect(screen.getByText('Refuge de la Nova')).toBeTruthy();
  });

  it('n’affiche aucune étape inventée quand la liste est vide', () => {
    const { container } = render(<CarnetStorySection detail={detail({ days: [] })} />);
    expect(container.querySelectorAll('.ckp-day')).toHaveLength(0);
  });

  it('affiche l’état vide honnête sans récit ni étape', () => {
    render(<CarnetStorySection detail={detail({ description: null, days: [] })} />);
    expect(screen.getByText('Aucun récit pour l’instant.')).toBeTruthy();
  });

  it('propose au propriétaire de compléter son carnet', () => {
    render(<CarnetStorySection detail={detail({ description: null, days: [], isOwner: true })} />);
    expect(screen.getByRole('link', { name: /Modifier le carnet/ })).toBeTruthy();
  });

  it('n’affiche aucune météo quand la donnée manque', () => {
    render(<CarnetStorySection detail={detail({ days: [{ ...DAY, weather: null, overnight: null, note: null }] })} />);
    expect(screen.queryByText(/°C/)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetStorySection.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `CarnetStorySection.tsx`**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetStorySectionProps {
  detail: CarnetDetail;
}

function formatKm(value: number | null): string | null {
  if (!value || value <= 0) return null;
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

function formatElevation(value: number | null): string | null {
  if (!value || value <= 0) return null;
  return `${value.toLocaleString('fr-FR')} m D+`;
}

/** Récit complet et timeline des étapes. Aucune étape synthétique. */
export function CarnetStorySection({ detail }: CarnetStorySectionProps) {
  const isEmpty = !detail.description && detail.days.length === 0;

  return (
    <section id="ckp-recit" className="ckp-section" aria-labelledby="ckp-recit-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-recit-title">
          Récit
          {detail.days.length > 0 ? (
            <small>{detail.days.length} étape{detail.days.length > 1 ? 's' : ''}</small>
          ) : null}
        </h2>
      </div>

      {detail.description ? <p className="ckp-text">{detail.description}</p> : null}

      {detail.days.length > 0 ? (
        <div className="ckp-daylist">
          {detail.days.map((day) => {
            const km = formatKm(day.distanceKm);
            const elevation = formatElevation(day.elevationM);
            return (
              <article className="ckp-day" key={day.id}>
                <div className="ckp-day-rail">
                  <span className="ckp-day-badge">{day.dayNumber}</span>
                  <span className="ckp-day-line" aria-hidden="true" />
                </div>
                <div className="ckp-day-body">
                  <span className="ckp-day-label">{day.label}</span>
                  {day.from || day.to ? (
                    <b className="ckp-day-title">{[day.from, day.to].filter(Boolean).join(' → ')}</b>
                  ) : null}
                  <div className="ckp-day-meta">
                    {km ? <span>{km}</span> : null}
                    {elevation ? <span>{elevation}</span> : null}
                    {day.durationText ? <span>{day.durationText}</span> : null}
                    {day.weather ? <span>{day.weather}</span> : null}
                  </div>
                  {day.note ? <p className="ckp-day-note">{day.note}</p> : null}
                  {day.overnight ? <span className="ckp-day-overnight">Nuit · {day.overnight}</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="ckp-empty" style={{ marginTop: 10, boxShadow: 'none', background: 'transparent', padding: '18px 0' }}>
          <b>Aucun récit pour l’instant.</b>
          <p>
            {detail.isOwner
              ? 'Complétez votre carnet pour raconter l’expédition.'
              : 'L’auteur n’a pas encore écrit le récit.'}
          </p>
          {detail.isOwner ? (
            <Link className="ckp-pill" href="/carnets">
              Modifier le carnet
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default CarnetStorySection;
```

- [ ] **Step 4: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetStorySection.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Écrire `CarnetKitSection.tsx`**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatWeight } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetKitSectionProps {
  detail: CarnetDetail;
}

/** Matériel : poids réels, aucune ligne inventée, poids absent = aucune valeur. */
export function CarnetKitSection({ detail }: CarnetKitSectionProps) {
  const total = formatWeight(detail.kit.totalWeightG);

  return (
    <section id="ckp-materiel" className="ckp-section" aria-labelledby="ckp-materiel-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-materiel-title">
          Matériel
          {total ? <small>Poids total</small> : null}
        </h2>
        {total ? <span className="ckp-kit-total">{total}</span> : null}
        {detail.isOwner ? (
          <Link className="ckp-pill" href="/compas">
            <Icon name="compass" size={16} aria-hidden="true" />
            Reconfigurer
          </Link>
        ) : null}
      </div>

      {detail.kit.items.length > 0 ? (
        <div className="ckp-kit-list">
          {detail.kit.items.map((item) => {
            const weight = formatWeight(item.weightG);
            return (
              <div className="ckp-kit-row" key={item.id}>
                <span
                  className="ckp-kit-dot"
                  style={item.color ? { background: item.color } : undefined}
                  aria-hidden="true"
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ckp-kit-name">{item.name}</span>
                  {item.detail ? <span className="ckp-kit-detail">{item.detail}</span> : null}
                </span>
                {weight ? <span className="ckp-kit-weight">{weight}</span> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ckp-empty" style={{ marginTop: 10, boxShadow: 'none', background: 'transparent', padding: '18px 0' }}>
          <b>Matériel non renseigné.</b>
          <p>
            {detail.isOwner
              ? 'Renseignez le kit emporté pour calculer son poids.'
              : 'L’auteur n’a pas listé son matériel.'}
          </p>
        </div>
      )}
    </section>
  );
}

export default CarnetKitSection;
```

- [ ] **Step 6: Écrire `CarnetNatureSection.tsx`**

```tsx
'use client';

import React, { useCallback, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

interface SpeciesResult {
  name: string;
  common_name: string;
  confidence: 'haute' | 'moyenne' | 'faible';
  description: string;
  is_protected: boolean;
  group: 'plante' | 'champignon' | 'animal' | 'insecte' | 'inconnu';
}

export interface CarnetNatureSectionProps {
  canWrite: boolean;
  onRequireAuth?: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Nature : identification d'une espèce par photo via
 * `POST /api/carnet/identify-species` (auth requise, 10/min). Même API que
 * l'ancien `SpeciesIdentifier`, grammaire de la fiche.
 */
export function CarnetNatureSection({ canWrite, onRequireAuth }: CarnetNatureSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [species, setSpecies] = useState<SpeciesResult | null>(null);

  const setFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/') || !canWrite) return;
      setState('loading');
      setSpecies(null);
      try {
        const base64 = await fileToBase64(file);
        const response = await fetch('/api/carnet/identify-species', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        if (!response.ok) throw new Error('identify failed');
        setSpecies((await response.json()) as SpeciesResult);
        setState('done');
      } catch {
        setState('error');
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [canWrite],
  );

  return (
    <section id="ckp-nature" className="ckp-section" aria-labelledby="ckp-nature-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-nature-title">
          Nature
          <small>Identifier une espèce</small>
        </h2>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void setFile(file);
        }}
      />

      {state === 'done' && species ? (
        <div className="ckp-species">
          <b>{species.common_name || species.name}</b>
          <i>{species.name}</i>
          <div className="ckp-day-meta">
            <span>Confiance {species.confidence}</span>
            {species.is_protected ? <span>Espèce protégée</span> : null}
          </div>
          <p>{species.description}</p>
          <button type="button" className="ckp-link" onClick={() => setState('idle')} style={{ marginTop: 6 }}>
            Identifier une autre espèce
          </button>
        </div>
      ) : (
        <div className="ckp-drop">
          <Icon name="compass" size={24} aria-hidden="true" />
          <p>
            {state === 'loading'
              ? 'Identification en cours…'
              : state === 'error'
                ? 'Identification impossible. Réessayez avec une photo nette.'
                : 'Photographiez une plante, un champignon ou un animal pour l’identifier.'}
          </p>
          <button
            type="button"
            className="ckp-pill ckp-pill--primary"
            disabled={state === 'loading'}
            onClick={() => {
              if (!canWrite) {
                onRequireAuth?.();
                return;
              }
              inputRef.current?.click();
            }}
          >
            <Icon name="image-plus" size={16} aria-hidden="true" />
            {canWrite ? 'Prendre une photo' : 'Se connecter pour identifier'}
          </button>
        </div>
      )}
    </section>
  );
}

export default CarnetNatureSection;
```

- [ ] **Step 7: Brancher les trois sections dans la vue**

Dans `<main className="ckp-main">`, après `CarnetMediaBlock` :

```tsx
<CarnetStorySection detail={detailView} />
<CarnetKitSection detail={detailView} />
<CarnetNatureSection canWrite={canWrite} onRequireAuth={requireAuth} />
```

Imports :

```tsx
import { CarnetStorySection } from './CarnetStorySection';
import { CarnetKitSection } from './CarnetKitSection';
import { CarnetNatureSection } from './CarnetNatureSection';
```

`canWrite` et `requireAuth` sont posés ici en version minimale, puis remplacés en tâche 7 :

```tsx
import { useAuth } from '@/contexts/AuthContext';
const { user } = useAuth();
const canWrite = Boolean(user?.id) && !user?.is_anonymous;
const requireAuth = useCallback(() => {}, []);
```

- [ ] **Step 8: Lancer les tests et vérifier le rendu**

Run: `npm test -- --run src/components/carnet/profile/__tests__`
Expected: PASS.

```bash
npx playwright screenshot --viewport-size=430,932 --full-page "http://localhost:4000/carnets/<id>" /tmp/ckp-430-sections.png
```

Attendu : trois cartes 28 empilées, Récit avec timeline (badge 32 + trait 1 px), Matériel avec poids à droite, Nature avec zone pointillée. `read_image`.

- [ ] **Step 9: Commit**

```bash
git add src/components/carnet/profile
git commit -m "feat(carnet): sections recit, materiel et nature"
```

---

## Task 7: Engagement et commentaires (hooks + aperçu + feuille)

**Files:**
- Create: `src/features/carnet/detail/useCarnetEngagement.ts`
- Create: `src/features/carnet/detail/useCarnetComments.ts`
- Create: `src/components/carnet/profile/CarnetCommentsPreview.tsx`
- Create: `src/components/carnet/profile/CarnetCommentsSheet.tsx`
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx`
- Test: `src/features/carnet/detail/__tests__/useCarnetEngagement.test.tsx`
- Test: `src/features/carnet/detail/__tests__/useCarnetComments.test.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/client`, `fetchPublicProfilesWith`, `OverlaySheet`, `useToast`, `useAuth`.
- Produces:
  - `useCarnetEngagement({ carnetId, initial, userId, onRequireAuth })` → `{ liked, likes, favorited, favorites, toggleLike, toggleFavorite, registerView }`
  - `CarnetComment` + `useCarnetComments({ carnetId, user })` → `{ comments, loading, error, send, remove }`
  - `<CarnetCommentsPreview comments loading canWrite total onSend onOpenAll onRequireAuth />`
  - `<CarnetCommentsSheet open comments loading canWrite currentUserId onSend onRemove onClose onRequireAuth />`

**Contrat BDD vérifié en base :** `carnet_likes(carnet_id, user_id, reaction)` unique `(carnet_id,user_id)` ; `carnet_favorites(carnet_id,user_id)` ; `carnet_views(carnet_id,user_id)` ; `carnet_comments(id, carnet_id, author_id, content, created_at)` — **ni réponse, ni like de commentaire** (décision 1).

- [ ] **Step 1: Écrire le test du hook d'engagement (il échoue)**

`src/features/carnet/detail/__tests__/useCarnetEngagement.test.tsx`

```tsx
// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const insertCalls: Array<{ table: string; payload: unknown }> = [];
const deleteCalls: Array<{ table: string }> = [];
let failWrites = false;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return Promise.resolve({ error: failWrites ? { message: 'boom' } : null });
      },
      upsert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return Promise.resolve({ error: failWrites ? { message: 'boom' } : null });
      },
      delete: () => {
        deleteCalls.push({ table });
        return { eq: () => ({ eq: () => Promise.resolve({ error: failWrites ? { message: 'boom' } : null }) }) };
      },
    }),
  }),
}));

import { useCarnetEngagement } from '../useCarnetEngagement';

beforeEach(() => {
  insertCalls.length = 0;
  deleteCalls.length = 0;
  failWrites = false;
});

afterEach(() => vi.clearAllMocks());

const INITIAL = { likes: 6, comments: 3, views: 40, liked: false, favorited: false };

describe('useCarnetEngagement', () => {
  it('like de façon optimiste et écrit carnet_likes', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: 'u1', onRequireAuth: () => {} }),
    );
    expect(result.current.likes).toBe(6);

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.liked).toBe(true);
    expect(result.current.likes).toBe(7);
    expect(insertCalls).toEqual([
      { table: 'carnet_likes', payload: { carnet_id: 'c1', user_id: 'u1', reaction: 'like' } },
    ]);
  });

  it('retire le like existant', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({
        carnetId: 'c1',
        initial: { ...INITIAL, liked: true, likes: 7 },
        userId: 'u1',
        onRequireAuth: () => {},
      }),
    );

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.likes).toBe(6);
    expect(deleteCalls).toEqual([{ table: 'carnet_likes' }]);
  });

  it('demande l’authentification sans écrire en base pour un visiteur', async () => {
    const onRequireAuth = vi.fn();
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: null, onRequireAuth }),
    );

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(onRequireAuth).toHaveBeenCalledOnce();
    expect(result.current.liked).toBe(false);
    expect(insertCalls).toHaveLength(0);
  });

  it('revient à l’état précédent si l’écriture échoue', async () => {
    failWrites = true;
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: 'u1', onRequireAuth: () => {} }),
    );

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.likes).toBe(6);
  });

  it('enregistre une vue une seule fois', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: null, onRequireAuth: () => {} }),
    );

    await act(async () => {
      await result.current.registerView();
      await result.current.registerView();
    });

    expect(insertCalls.filter((call) => call.table === 'carnet_views')).toHaveLength(1);
  });

  it('bascule le favori', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: 'u1', onRequireAuth: () => {} }),
    );

    await act(async () => {
      await result.current.toggleFavorite();
    });

    await waitFor(() => expect(result.current.favorited).toBe(true));
    expect(insertCalls).toEqual([{ table: 'carnet_favorites', payload: { carnet_id: 'c1', user_id: 'u1' } }]);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/features/carnet/detail/__tests__/useCarnetEngagement.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `useCarnetEngagement.ts`**

```ts
'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CarnetEngagement } from './types';

export interface UseCarnetEngagementArgs {
  carnetId: string;
  initial: CarnetEngagement;
  userId: string | null;
  onRequireAuth?: () => void;
}

export function useCarnetEngagement({
  carnetId,
  initial,
  userId,
  onRequireAuth,
}: UseCarnetEngagementArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [liked, setLiked] = useState(initial.liked);
  const [likes, setLikes] = useState(initial.likes);
  const [favorited, setFavorited] = useState(initial.favorited);
  const [favorites, setFavorites] = useState(0);
  const viewSent = useRef(false);

  const toggleLike = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase
          .from('carnet_likes')
          .upsert({ carnet_id: carnetId, user_id: userId, reaction: 'like' }, { onConflict: 'carnet_id,user_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carnet_likes')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setLiked(!next);
      setLikes((value) => Math.max(0, value + (next ? -1 : 1)));
    }
  }, [carnetId, liked, onRequireAuth, supabase, userId]);

  const toggleFavorite = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    const next = !favorited;
    setFavorited(next);
    setFavorites((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase
          .from('carnet_favorites')
          .insert({ carnet_id: carnetId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carnet_favorites')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setFavorited(!next);
      setFavorites((value) => Math.max(0, value + (next ? -1 : 1)));
    }
  }, [carnetId, favorited, onRequireAuth, supabase, userId]);

  /** Une vue par montage : `carnet_views` accepte l'insertion publique. */
  const registerView = useCallback(async () => {
    if (viewSent.current) return;
    viewSent.current = true;
    try {
      await supabase.from('carnet_views').insert({ carnet_id: carnetId, user_id: userId });
    } catch {
      viewSent.current = false;
    }
  }, [carnetId, supabase, userId]);

  return { liked, likes, favorited, favorites, toggleLike, toggleFavorite, registerView };
}

export default useCarnetEngagement;
```

- [ ] **Step 4: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/features/carnet/detail/__tests__/useCarnetEngagement.test.tsx`
Expected: PASS (6 tests). Si la chaîne `delete().eq().eq()` ne correspond pas au mock, corriger **le mock**, jamais le hook : c'est exactement la chaîne déjà utilisée par le hub (`src/app/carnets/page.tsx:800`).

- [ ] **Step 5: Écrire le test des commentaires (il échoue)**

`src/features/carnet/detail/__tests__/useCarnetComments.test.tsx`

```tsx
// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commentsRows = [
  { id: 'm1', carnet_id: 'c1', author_id: 'u1', content: 'Merci Camille.', created_at: '2026-10-01T10:00:00Z' },
  { id: 'm2', carnet_id: 'c1', author_id: 'u2', content: 'Superbe !', created_at: '2026-10-02T10:00:00Z' },
];
const deleted: string[] = [];

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'carnet_comments') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: commentsRows, error: null }) }),
        }),
        insert: (payload: { content: string }) => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'new',
                  carnet_id: 'c1',
                  author_id: 'u1',
                  content: payload.content,
                  created_at: '2026-10-03T10:00:00Z',
                },
                error: null,
              }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: (_column: string, value: string) => {
              deleted.push(value);
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    },
  }),
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: () =>
    Promise.resolve({ u1: { id: 'u1', full_name: 'Camille', avatar_url: null } }),
}));

import { useCarnetComments } from '../useCarnetComments';

beforeEach(() => {
  deleted.length = 0;
});

describe('useCarnetComments', () => {
  it('charge la liste réelle avec les auteurs', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toHaveLength(2);
    expect(result.current.comments[0].authorName).toBe('Camille');
    expect(result.current.comments[1].authorName).toBe('Auteur');
  });

  it('envoie un commentaire et l’ajoute en fin de liste', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.send('  Bravo !  ')).toBe(true);
    });

    expect(result.current.comments.at(-1)?.content).toBe('Bravo !');
    expect(result.current.comments).toHaveLength(3);
  });

  it('refuse un commentaire vide sans écrire', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.send('   ')).toBe(false);
    });
    expect(result.current.comments).toHaveLength(2);
  });

  it('supprime son propre commentaire seulement', async () => {
    const { result } = renderHook(() => useCarnetComments({ carnetId: 'c1', user: { id: 'u1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.remove('m1')).toBe(true);
      expect(await result.current.remove('m2')).toBe(false);
    });

    expect(deleted).toEqual(['m1']);
    expect(result.current.comments.map((c) => c.id)).toEqual(['m2']);
  });
});
```

- [ ] **Step 6: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/features/carnet/detail/__tests__/useCarnetComments.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 7: Écrire `useCarnetComments.ts`**

```ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

export interface CarnetComment {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
}

export interface UseCarnetCommentsArgs {
  carnetId: string;
  user: { id: string; is_anonymous?: boolean } | null | undefined;
}

type CommentRow = {
  id: string;
  carnet_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

async function toComments(
  supabase: ReturnType<typeof createClient>,
  rows: CommentRow[],
): Promise<CarnetComment[]> {
  const profiles = await fetchPublicProfilesWith(
    supabase as never,
    rows.map((row) => row.author_id),
  );
  return rows.map((row) => {
    const profile = row.author_id ? profiles[row.author_id] : undefined;
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: profile?.full_name?.trim() || profile?.handle?.trim() || 'Auteur',
      authorAvatar: profile?.avatar_url ?? null,
      content: row.content,
      createdAt: row.created_at,
    };
  });
}

export function useCarnetComments({ carnetId, user }: UseCarnetCommentsArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<CarnetComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('carnet_comments')
      .select('id, carnet_id, author_id, content, created_at')
      .eq('carnet_id', carnetId)
      .order('created_at', { ascending: true })
      .then(async ({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }
        setComments(await toComments(supabase, (data ?? []) as CommentRow[]));
        setError(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [carnetId, supabase]);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || !user?.id || user.is_anonymous) return false;
      const { data, error: insertError } = await supabase
        .from('carnet_comments')
        .insert({ carnet_id: carnetId, author_id: user.id, content })
        .select('id, carnet_id, author_id, content, created_at')
        .single();
      if (insertError || !data) return false;
      const [comment] = await toComments(supabase, [data as CommentRow]);
      setComments((current) => [...current, comment]);
      return true;
    },
    [carnetId, supabase, user?.id, user?.is_anonymous],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!user?.id) return false;
      const target = comments.find((comment) => comment.id === commentId);
      if (!target || target.authorId !== user.id) return false;
      const { error: deleteError } = await supabase
        .from('carnet_comments')
        .delete()
        .eq('id', commentId)
        .eq('author_id', user.id);
      if (deleteError) return false;
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      return true;
    },
    [comments, supabase, user?.id],
  );

  return { comments, loading, error, send, remove };
}

export default useCarnetComments;
```

- [ ] **Step 8: Lancer les deux tests de hooks**

Run: `npm test -- --run src/features/carnet/detail/__tests__`
Expected: PASS (6 + 4 tests).

- [ ] **Step 9: Écrire l'aperçu et la feuille de commentaires**

`src/components/carnet/profile/CarnetCommentsPreview.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';

export interface CarnetCommentsPreviewProps {
  comments: CarnetComment[];
  loading: boolean;
  canWrite: boolean;
  total: number;
  onSend: (content: string) => Promise<boolean>;
  onOpenAll: () => void;
  onRequireAuth: () => void;
}

/** Aperçu : deux vrais commentaires, puis le composer 36 + envoi 34. */
export function CarnetCommentsPreview({
  comments,
  loading,
  canWrite,
  total,
  onSend,
  onOpenAll,
  onRequireAuth,
}: CarnetCommentsPreviewProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const visible = comments.slice(-2);

  const submit = async () => {
    if (!canWrite) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    const ok = await onSend(draft);
    if (ok) setDraft('');
    setBusy(false);
  };

  return (
    <section id="ckp-commentaires" className="ckp-section" aria-labelledby="ckp-commentaires-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-commentaires-title">
          Commentaires
          <small>{total} au total</small>
        </h2>
        <button type="button" className="ckp-link" onClick={onOpenAll}>
          Voir tout
        </button>
      </div>

      {loading ? (
        <p className="ckp-text" aria-busy="true">
          Chargement…
        </p>
      ) : visible.length === 0 ? (
        <p className="ckp-text">Aucun commentaire pour l’instant.</p>
      ) : (
        visible.map((comment) => (
          <div className="ckp-comment" key={comment.id}>
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
              <img className="ckp-avatar" src={comment.authorAvatar} alt="" />
            ) : (
              <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                {comment.authorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="ckp-comment-body">
              <span className="ckp-comment-name">{comment.authorName}</span>
              <span className="ckp-comment-time">
                {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <p className="ckp-comment-text">{comment.content}</p>
            </div>
          </div>
        ))
      )}

      <div className="ckp-composer">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={canWrite ? 'Ajouter un commentaire…' : 'Connectez-vous pour commenter'}
          aria-label="Ajouter un commentaire"
        />
        <button
          type="button"
          className="ckp-send"
          onClick={() => void submit()}
          disabled={busy || !draft.trim()}
          aria-label="Envoyer le commentaire"
        >
          <Icon name="send" size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default CarnetCommentsPreview;
```

`src/components/carnet/profile/CarnetCommentsSheet.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';

export interface CarnetCommentsSheetProps {
  open: boolean;
  comments: CarnetComment[];
  loading: boolean;
  canWrite: boolean;
  currentUserId: string | null;
  onSend: (content: string) => Promise<boolean>;
  onRemove: (commentId: string) => Promise<boolean>;
  onClose: () => void;
  onRequireAuth: () => void;
}

/** Feuille 92 dvh du Compte : liste à plat, suppression de son commentaire. */
export function CarnetCommentsSheet({
  open,
  comments,
  loading,
  canWrite,
  currentUserId,
  onSend,
  onRemove,
  onClose,
  onRequireAuth,
}: CarnetCommentsSheetProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async () => {
    if (!canWrite) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    if (await onSend(draft)) setDraft('');
    setBusy(false);
  };

  return (
    <OverlaySheet
      title="Commentaires"
      subtitle={`${comments.length} commentaire${comments.length > 1 ? 's' : ''}`}
      onClose={onClose}
      footer={
        <div className="ckp-composer" style={{ marginTop: 0 }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={canWrite ? 'Ajouter un commentaire…' : 'Connectez-vous pour commenter'}
            aria-label="Ajouter un commentaire"
          />
          <button
            type="button"
            className="ckp-send"
            onClick={() => void submit()}
            disabled={busy || !draft.trim()}
            aria-label="Envoyer le commentaire"
          >
            <Icon name="send" size={16} aria-hidden="true" />
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="ckp-text" aria-busy="true">
          Chargement…
        </p>
      ) : comments.length === 0 ? (
        <div className="lkdv-overlay-empty">
          <b>Aucun commentaire</b>
          <p>Soyez la première personne à réagir à ce carnet.</p>
        </div>
      ) : (
        comments.map((comment) => (
          <div className="ckp-comment" key={comment.id}>
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
              <img className="ckp-avatar" src={comment.authorAvatar} alt="" />
            ) : (
              <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                {comment.authorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="ckp-comment-body">
              <span className="ckp-comment-name">{comment.authorName}</span>
              <span className="ckp-comment-time">
                {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <p className="ckp-comment-text">{comment.content}</p>
            </div>
            {currentUserId && comment.authorId === currentUserId ? (
              <button
                type="button"
                className="ckp-link"
                onClick={() => void onRemove(comment.id)}
                aria-label="Supprimer mon commentaire"
              >
                <Icon name="trash2" size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))
      )}
    </OverlaySheet>
  );
}

export default CarnetCommentsSheet;
```

- [ ] **Step 10: Brancher engagement et commentaires dans la vue**

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { CarnetCommentsPreview } from './CarnetCommentsPreview';
import { CarnetCommentsSheet } from './CarnetCommentsSheet';

const { user } = useAuth();
const { toast } = useToast();
const currentUserId = user?.id ?? null;
const canWrite = Boolean(user?.id) && !user?.is_anonymous;

const requireAuth = useCallback(() => {
  toast(
    user?.id ? 'Créez un compte pour enregistrer, commenter ou publier.' : 'Connectez-vous pour continuer.',
    'info',
  );
  router.push(`/connexion?next=/carnets/${detail.id}`);
}, [detail.id, router, toast, user?.id]);

const engagement = useCarnetEngagement({
  carnetId: detail.id,
  initial: detail.engagement,
  userId: currentUserId,
  onRequireAuth: requireAuth,
});

const comments = useCarnetComments({ carnetId: detail.id, user });

useEffect(() => {
  void engagement.registerView();
}, [engagement.registerView]);

const detailView = React.useMemo(
  () => ({
    ...detail,
    engagement: {
      ...detail.engagement,
      liked: engagement.liked,
      likes: engagement.likes,
      favorited: engagement.favorited,
    },
  }),
  [detail, engagement.favorited, engagement.liked, engagement.likes],
);
```

Puis, après `CarnetNatureSection` :

```tsx
<CarnetCommentsPreview
  comments={comments.comments}
  loading={comments.loading}
  canWrite={canWrite}
  total={Math.max(detail.engagement.comments, comments.comments.length)}
  onSend={comments.send}
  onOpenAll={() => setCommentsOpen(true)}
  onRequireAuth={requireAuth}
/>

<CarnetCommentsSheet
  open={commentsOpen}
  comments={comments.comments}
  loading={comments.loading}
  canWrite={canWrite}
  currentUserId={currentUserId}
  onSend={comments.send}
  onRemove={comments.remove}
  onClose={() => setCommentsOpen(false)}
  onRequireAuth={requireAuth}
/>
```

La carte d'identité consomme `detailView`, et `onLike={() => void engagement.toggleLike()}`.

- [ ] **Step 11: Lancer les tests et vérifier en live**

Run: `npm test -- --run src/features/carnet/detail src/components/carnet/profile`
Expected: PASS.

Recette manuelle obligatoire :
1. Connecté, cliquer ♥ : compteur +1, **rafraîchir → le compteur reste** (preuve d'écriture).
2. Envoyer un commentaire : il apparaît, rafraîchir → il reste.
3. Déconnecté, cliquer ♥ : redirection `/connexion?next=/carnets/<id>`, aucune écriture.

```bash
npx playwright screenshot --viewport-size=430,932 --full-page "http://localhost:4000/carnets/<id>" /tmp/ckp-430-comments.png
```

- [ ] **Step 12: Commit**

```bash
git add src/features/carnet/detail src/components/carnet/profile
git commit -m "feat(carnet): engagement reel et commentaires persistes"
```

---

## Task 8: Menu ···, partage, gestion, carte et signalement

**Files:**
- Create: `src/components/carnet/profile/CarnetMoreMenu.tsx`
- Create: `src/components/carnet/profile/CarnetShareSheet.tsx`
- Create: `src/components/carnet/profile/CarnetManageSheet.tsx`
- Create: `src/components/carnet/profile/CarnetMapSheet.tsx`
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetMoreMenu.test.tsx`

**Interfaces:**
- Consumes: `.pmi-options-menu` (226 px, lignes 44), `OverlaySheet`, `ReportSheet` (`@/components/social/ReportSheet`), `CarnetTraceMap`.
- Produces:
  - `<CarnetMoreMenu open saved isOwner onSave onShare onCopy onReport onManage onClose />`
  - `<CarnetShareSheet open url title onClose onCopied />`
  - `<CarnetManageSheet open detail url onClose onVisibilityChange onExport onDelete />`
  - `<CarnetMapSheet open detail onClose onDownloadGpx />`

**Décisions d'implémentation.**
- Auteur : le clic ouvre `/profil/{authorId}` — route publique existante (`src/app/profil/[id]`), même grammaire Compte. On ne monte pas `ProfileDrawerHost` hors du runtime Compte (il exige `viewer`, `visibility` et un `portalRoot` fournis par la maquette) : ce serait une régression fragile pour un simple lien.
- Signalement : composant `ReportSheet` de la Communauté, table `comment_reports` avec `table_name: 'carnets'` — convention existante (`usePostInteractions.ts:141`).

- [ ] **Step 1: Écrire le test du menu (il échoue)**

`src/components/carnet/profile/__tests__/CarnetMoreMenu.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetMoreMenu } from '../CarnetMoreMenu';

afterEach(() => cleanup());

const noop = () => {};

describe('CarnetMoreMenu — menu ··· 226 px', () => {
  it('reprend la liste du menu du Compte', () => {
    render(<CarnetMoreMenu open saved={false} isOwner={false} onSave={noop} onShare={noop} onCopy={noop} onReport={noop} onManage={noop} onClose={noop} />);
    const menu = screen.getByRole('group', { name: 'Options du carnet' });
    expect(menu.className).toContain('pmi-options-menu');
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copier le lien/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Partager/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Signaler/ })).toBeTruthy();
  });

  it('libelle « Retirer des enregistrements » quand le carnet est enregistré', () => {
    render(<CarnetMoreMenu open saved isOwner={false} onSave={noop} onShare={noop} onCopy={noop} onReport={noop} onManage={noop} onClose={noop} />);
    expect(screen.getByRole('button', { name: /Retirer des enregistrements/ })).toBeTruthy();
  });

  it('n’ajoute « Gérer le carnet » que pour le propriétaire', () => {
    render(<CarnetMoreMenu open saved={false} isOwner onSave={noop} onShare={noop} onCopy={noop} onReport={noop} onManage={noop} onClose={noop} />);
    expect(screen.getByRole('button', { name: 'Gérer le carnet' })).toBeTruthy();
    cleanup();
    render(<CarnetMoreMenu open saved={false} isOwner={false} onSave={noop} onShare={noop} onCopy={noop} onReport={noop} onManage={noop} onClose={noop} />);
    expect(screen.queryByRole('button', { name: 'Gérer le carnet' })).toBeNull();
  });

  it('ne rend rien quand il est fermé', () => {
    const { container } = render(<CarnetMoreMenu open={false} saved={false} isOwner={false} onSave={noop} onShare={noop} onCopy={noop} onReport={noop} onManage={noop} onClose={noop} />);
    expect(container.querySelector('.pmi-options-menu')?.hasAttribute('hidden')).toBe(true);
  });

  it('appelle l’action et referme', () => {
    const onShare = vi.fn();
    const onClose = vi.fn();
    render(<CarnetMoreMenu open saved={false} isOwner={false} onSave={noop} onShare={onShare} onCopy={noop} onReport={noop} onManage={noop} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Partager/ }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetMoreMenu.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `CarnetMoreMenu.tsx`**

```tsx
'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';

export interface CarnetMoreMenuProps {
  open: boolean;
  saved: boolean;
  isOwner: boolean;
  onSave: () => void;
  onShare: () => void;
  onCopy: () => void;
  onReport: () => void;
  onManage: () => void;
  onClose: () => void;
}

/** Menu `···` du Compte : 226 px, lignes 44 px, même verre. */
export function CarnetMoreMenu({
  open,
  saved,
  isOwner,
  onSave,
  onShare,
  onCopy,
  onReport,
  onManage,
  onClose,
}: CarnetMoreMenuProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="pmi-options-menu" role="group" aria-label="Options du carnet" hidden={!open}>
      <button type="button" onClick={run(onSave)}>
        <Icon name="bookmark" size={18} aria-hidden="true" />
        <span>{saved ? 'Retirer des enregistrements' : 'Enregistrer'}</span>
      </button>
      <button type="button" onClick={run(onShare)}>
        <Icon name="send" size={18} aria-hidden="true" />
        <span>Partager</span>
      </button>
      <button type="button" onClick={run(onCopy)}>
        <Icon name="link" size={18} aria-hidden="true" />
        <span>Copier le lien</span>
      </button>
      {isOwner ? (
        <button type="button" onClick={run(onManage)}>
          <Icon name="pencil" size={18} aria-hidden="true" />
          <span>Gérer le carnet</span>
        </button>
      ) : null}
      <button type="button" className="pmi-report" onClick={run(onReport)}>
        <Icon name="flag" size={18} aria-hidden="true" />
        <span>Signaler</span>
      </button>
    </div>
  );
}

export default CarnetMoreMenu;
```

- [ ] **Step 4: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetMoreMenu.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Écrire `CarnetShareSheet.tsx`**

```tsx
'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';

export interface CarnetShareSheetProps {
  open: boolean;
  url: string;
  title: string;
  onClose: () => void;
  onCopied: () => void;
}

const TARGETS = [
  { id: 'whatsapp', label: 'WhatsApp', href: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  { id: 'x', label: 'X', href: (url: string, title: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { id: 'facebook', label: 'Facebook', href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: 'mail', label: 'E-mail', href: (url: string, title: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
] as const;

/** Partage du carnet : copie, partage natif, quatre destinations réelles. */
export function CarnetShareSheet({ open, url, title, onClose, onCopied }: CarnetShareSheetProps) {
  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
      onClose();
    } catch {
      /* presse-papiers refusé : l'URL reste sélectionnable dans la feuille */
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, url });
        onClose();
      } catch {
        /* partage annulé */
      }
    }
  };

  return (
    <OverlaySheet title="Partager le carnet" subtitle={title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="lkdv-drawer-btn is-primary" style={{ width: '100%' }} onClick={() => void copy()}>
          <Icon name="link" size={16} aria-hidden="true" />
          Copier le lien
        </button>
        {'share' in (typeof navigator === 'undefined' ? {} : navigator) ? (
          <button type="button" className="lkdv-drawer-btn is-secondary" style={{ width: '100%' }} onClick={() => void nativeShare()}>
            <Icon name="send" size={16} aria-hidden="true" />
            Partager…
          </button>
        ) : null}
        <div className="lkdv-overlay-card" style={{ marginTop: 4 }}>
          {TARGETS.map((target) => (
            <a
              key={target.id}
              className="lkdv-overlay-row"
              href={target.href(url, title)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="lkdv-overlay-row-main">
                <b>{target.label}</b>
              </span>
              <Icon name="external-link" size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
        <p className="ckp-text" style={{ margin: 0, color: 'var(--feed-muted)' }}>{url}</p>
      </div>
    </OverlaySheet>
  );
}

export default CarnetShareSheet;
```

- [ ] **Step 6: Écrire `CarnetManageSheet.tsx`**

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetManageSheetProps {
  open: boolean;
  detail: CarnetDetail;
  url: string;
  onClose: () => void;
  onExport: () => void;
  onCopied: () => void;
}

/** Gestion propriétaire : visibilité réelle, export JSON, copie, suppression. */
export function CarnetManageSheet({ open, detail, url, onClose, onExport, onCopied }: CarnetManageSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [visibility, setVisibility] = useState(detail.visibility);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const isPublic = visibility === 'public';

  const changeVisibility = async () => {
    const next = isPublic ? 'private' : 'public';
    setBusy(true);
    const { error } = await createClient().from('carnets').update({ visibility: next }).eq('id', detail.id);
    setBusy(false);
    if (error) {
      toast('Visibilité non modifiée.', 'error');
      return;
    }
    setVisibility(next);
    toast(next === 'public' ? 'Carnet public.' : 'Carnet privé.', 'success');
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await createClient().from('carnets').delete().eq('id', detail.id);
    setBusy(false);
    if (error) {
      toast('Suppression impossible.', 'error');
      return;
    }
    toast('Carnet supprimé.', 'success');
    onClose();
    router.push('/carnets');
  };

  return (
    <OverlaySheet title="Gérer le carnet" subtitle={detail.title} onClose={onClose}>
      <div className="lkdv-overlay-card">
        <button type="button" className="lkdv-overlay-row" onClick={() => void changeVisibility()} disabled={busy}>
          <span className="lkdv-overlay-row-main">
            <b>Visibilité</b>
            <small>{isPublic ? 'Public — visible dans la communauté' : 'Privé — visible par vous seul'}</small>
          </span>
          <span className={`lkdv-drawer-toggle${isPublic ? ' on' : ''}`} aria-hidden="true">
            <span />
          </span>
        </button>
        <button type="button" className="lkdv-overlay-row" onClick={onExport}>
          <span className="lkdv-overlay-row-main">
            <b>Exporter le carnet</b>
            <small>JSON complet — récit, étapes, moments, kit</small>
          </span>
          <Icon name="download" size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="lkdv-overlay-row"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(onCopied);
          }}
        >
          <span className="lkdv-overlay-row-main">
            <b>Copier le lien</b>
            <small>{url}</small>
          </span>
          <Icon name="link" size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="lkdv-overlay-card" style={{ marginTop: 10 }}>
        {confirmDelete ? (
          <div style={{ padding: 12 }}>
            <b style={{ display: 'block', fontSize: 13 }}>Supprimer définitivement ce carnet ?</b>
            <p style={{ margin: '4px 0 10px', fontSize: 11.5, color: '#5f6f66' }}>
              Le récit, les étapes, les moments et le kit seront supprimés.
            </p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="button" className="lkdv-drawer-btn is-ghost" onClick={() => setConfirmDelete(false)}>
                Annuler
              </button>
              <button type="button" className="lkdv-drawer-btn is-danger" onClick={() => void remove()} disabled={busy}>
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="lkdv-overlay-row" onClick={() => setConfirmDelete(true)}>
            <span className="lkdv-overlay-row-main" style={{ color: '#a33227' }}>
              <b>Supprimer le carnet</b>
              <small>Action définitive</small>
            </span>
            <Icon name="trash2" size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </OverlaySheet>
  );
}

export default CarnetManageSheet;
```

- [ ] **Step 7: Écrire `CarnetMapSheet.tsx`**

```tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(() => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap), {
  ssr: false,
  loading: () => <div className="ckp-map-canvas" aria-hidden="true" />,
});

export interface CarnetMapSheetProps {
  open: boolean;
  detail: CarnetDetail;
  onClose: () => void;
  onDownloadGpx: () => void;
}

/** Carte 92 dvh : trace, statistiques réelles, GPX. */
export function CarnetMapSheet({ open, detail, onClose, onDownloadGpx }: CarnetMapSheetProps) {
  if (!open) return null;
  const km = formatKm(detail.distanceKm);
  const elevation = formatElevation(detail.elevationM);

  return (
    <OverlaySheet
      title="Parcours"
      subtitle={detail.destination ?? detail.title}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="ckp-day-meta" style={{ margin: 0 }}>
            {km ? <span>{km}</span> : null}
            {elevation ? <span>{elevation} D+</span> : null}
          </span>
          <button type="button" className="lkdv-drawer-btn is-primary" onClick={onDownloadGpx}>
            <Icon name="download" size={16} aria-hidden="true" />
            Télécharger le GPX
          </button>
        </div>
      }
    >
      <div className="ckp-map-wrap" style={{ aspectRatio: '4 / 5' }}>
        <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} />
      </div>
    </OverlaySheet>
  );
}

export default CarnetMapSheet;
```

- [ ] **Step 8: Câbler les cinq surfaces dans la vue**

Nouveaux états et appels :

```tsx
import ReportSheet from '@/components/social/ReportSheet';
import { createClient } from '@/lib/supabase/client';
import { CarnetMoreMenu } from './CarnetMoreMenu';
import { CarnetShareSheet } from './CarnetShareSheet';
import { CarnetManageSheet } from './CarnetManageSheet';
import { CarnetMapSheet } from './CarnetMapSheet';

const [menuOpen, setMenuOpen] = useState(false);
const [shareOpen, setShareOpen] = useState(false);
const [manageOpen, setManageOpen] = useState(false);
const [mapOpen, setMapOpen] = useState(false);
const [reportOpen, setReportOpen] = useState(false);

const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/carnets/${detail.id}`;

const copyLink = useCallback(async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/carnets/${detail.id}`);
    toast('Lien copié.', 'success');
  } catch {
    toast('Copie impossible : sélectionnez l’adresse dans la barre du navigateur.', 'info');
  }
}, [detail.id, toast]);

const exportJson = useCallback(() => {
  const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${detail.title.replace(/[^a-zA-Z0-9]/g, '_')}-carnet.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Carnet exporté.', 'success');
}, [detail, toast]);

const share = useCallback(async () => {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title: detail.title, url: `${window.location.origin}/carnets/${detail.id}` });
      return;
    } catch {
      /* annulé : on retombe sur la feuille */
    }
  }
  setShareOpen(true);
}, [detail.id, detail.title]);

const report = useCallback(
  async (reason: string, details?: string) => {
    if (!currentUserId) {
      requireAuth();
      return;
    }
    const { error } = await createClient().from('comment_reports').insert({
      comment_id: detail.id,
      reporter_id: currentUserId,
      reason: details ? `${reason} — ${details}` : reason,
      table_name: 'carnets',
    });
    toast(error ? 'Le signalement n’a pas pu être envoyé.' : 'Signalement envoyé. Merci.', error ? 'error' : 'success');
    setReportOpen(false);
  },
  [currentUserId, detail.id, requireAuth, toast],
);
```

Dans la top bar : `onShare={share}`, `onSave={() => void engagement.toggleFavorite()}`, `onMenu={() => setMenuOpen((value) => !value)}`.
Autour du `···` : envelopper le bouton dans `<span className="ckp-more-anchor">` — le menu se positionne dessous (`top: 44px; right: 0`).

Après `AccountBottomBar` :

```tsx
<CarnetMoreMenu
  open={menuOpen}
  saved={engagement.favorited}
  isOwner={detail.isOwner}
  onSave={() => void engagement.toggleFavorite()}
  onShare={() => void share()}
  onCopy={() => void copyLink()}
  onReport={() => setReportOpen(true)}
  onManage={() => setManageOpen(true)}
  onClose={() => setMenuOpen(false)}
/>

<CarnetShareSheet open={shareOpen} url={shareUrl} title={detail.title} onClose={() => setShareOpen(false)} onCopied={() => toast('Lien copié.', 'success')} />

<CarnetManageSheet
  open={manageOpen}
  detail={detail}
  url={shareUrl}
  onClose={() => setManageOpen(false)}
  onExport={exportJson}
  onCopied={() => toast('Lien copié.', 'success')}
/>

<CarnetMapSheet open={mapOpen} detail={detail} onClose={() => setMapOpen(false)} onDownloadGpx={() => downloadGpx(detail.title, detail.trace)} />

<ReportSheet
  isOpen={reportOpen}
  onClose={() => setReportOpen(false)}
  contentId={detail.id}
  contentType="carnet"
  onSubmitReport={report}
/>
```

Le clic auteur : `<CarnetIdentityCard … onOpenAuthor={() => { if (detail.author) router.push(`/profil/${detail.author.id}`); }} />`.

- [ ] **Step 9: Lancer les tests et vérifier chaque surface**

Run: `npm test -- --run src/components/carnet/profile`
Expected: PASS.

Recette manuelle (5 clics, sur un carnet dont vous êtes propriétaire) :
1. `···` → menu 226 px sous le bouton, 5 entrées.
2. « Copier le lien » → toast, URL dans le presse-papiers.
3. « Gérer » → pose la visibilité à privé, `router.refresh()` : le badge « Privé » apparaît dans la carte.
4. Export → un `.json` est téléchargé et contient le récit réel.
5. « Agrandir » (mode carte) → feuille 92 dvh avec la carte 4:5 et le GPX.

- [ ] **Step 10: Commit**

```bash
git add src/components/carnet/profile
git commit -m "feat(carnet): menu, partage, gestion, carte et signalement"
```

---

## Task 9: Nettoyage, états, accessibilité, performance

**Files:**
- Modify: `src/app/carnets/[id]/loading.tsx` (squelette de la colonne)
- Modify: `src/app/carnets/[id]/error.tsx` (coquille + reprise)
- Modify: `src/styles/carnet-profile.css` (squelettes, focus visible, cibles 44)
- Delete: les 14 composants listés ci-dessous

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `npm run build` vert, aucune référence orpheline.

- [ ] **Step 1: Recenser les composants orphelins avant suppression**

```bash
for f in CarnetView CarnetHero StatsBar MomentCard TimelineJours JourCard HebergementCard KitSouvenirCard RandonneesSouvenirCard CarnetDetailVerticalTabs CarnetDetailRightSidebar MobileCarnetDetailView SpeciesIdentifier; do
  printf '%-32s ' "$f"; grep -rl "components/carnet/$f" src --include=*.tsx --include=*.ts | grep -v "components/carnet/$f.tsx" | tr '\n' ' '; echo
done
grep -rn "LocalCarnetRenderer\|lib/queries/carnet\|carnet-chartreuse" src --include=*.tsx --include=*.ts
```

Attendu : aucune sortie hors `CarnetView.tsx` / `LocalCarnetRenderer.tsx`. Si un fichier apparaît encore, **ne pas le supprimer** : le brancher d'abord.

- [ ] **Step 2: Supprimer les fichiers legacy**

```bash
git rm src/components/carnet/CarnetView.tsx \
  src/components/carnet/CarnetHero.tsx \
  src/components/carnet/StatsBar.tsx \
  src/components/carnet/MomentCard.tsx \
  src/components/carnet/TimelineJours.tsx \
  src/components/carnet/JourCard.tsx \
  src/components/carnet/HebergementCard.tsx \
  src/components/carnet/KitSouvenirCard.tsx \
  src/components/carnet/RandonneesSouvenirCard.tsx \
  src/components/carnet/CarnetDetailVerticalTabs.tsx \
  src/components/carnet/CarnetDetailRightSidebar.tsx \
  src/components/carnet/MobileCarnetDetailView.tsx \
  src/components/carnet/SpeciesIdentifier.tsx \
  src/components/carnets/LocalCarnetRenderer.tsx \
  src/lib/queries/carnet.ts
```

Puis vérifier ce qui reste :

```bash
grep -rn "LocalCarnetRenderer\|queries/carnet\|CarnetView\b" src --include=*.tsx --include=*.ts
npm run type-check
```

Attendu : aucune référence, type-check vert. `src/lib/mock/carnet-chartreuse.ts` n'est supprimé que si `grep -rn "carnet-chartreuse" src` ne renvoie rien.

- [ ] **Step 3: Réécrire le squelette de chargement**

`src/app/carnets/[id]/loading.tsx`

```tsx
import React from 'react';

export default function CarnetLoading() {
  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <div className="lkdv-feed-column">
        <div className="lkdv-feed-header">
          <div className="ckp-skeleton ckp-skeleton--pill" />
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
            <div className="ckp-skeleton ckp-skeleton--round" />
          </div>
        </div>
        <div className="ckp-main" aria-busy="true" aria-label="Chargement du carnet">
          <div className="ckp-card">
            <div className="ckp-head">
              <div className="ckp-skeleton ckp-skeleton--cover" />
              <div style={{ flex: 1 }}>
                <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '72%' }} />
                <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '48%', marginTop: 8 }} />
                <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '60%', marginTop: 18 }} />
              </div>
            </div>
            <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '40%', marginTop: 14 }} />
            <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '92%', marginTop: 12 }} />
            <div className="ckp-skeleton ckp-skeleton--line" style={{ width: '80%', marginTop: 6 }} />
            <div className="ckp-skeleton ckp-skeleton--tabs" />
          </div>
          <div className="ckp-skeleton ckp-skeleton--grid" />
          <div className="ckp-skeleton ckp-skeleton--section" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Réécrire l'erreur de la fiche**

`src/app/carnets/[id]/error.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function CarnetError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <div className="lkdv-feed-column">
        <div className="ckp-main" style={{ paddingTop: 72 }}>
          <div className="ckp-empty">
            <b>Ce carnet n’a pas pu être chargé.</b>
            <p>La lecture a échoué. Réessayez, ou revenez à la liste de vos carnets.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="ckp-pill ckp-pill--primary" onClick={reset}>
                Réessayer
              </button>
              <Link className="ckp-pill" href="/carnets">
                Mes carnets
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Ajouter squelettes, focus visible et cibles 44**

À la fin de `src/styles/carnet-profile.css` :

```css
/* --- Squelettes ----------------------------------------------------------- */

.ckp-skeleton {
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(255, 255, 255, .45), rgba(255, 255, 255, .75), rgba(255, 255, 255, .45));
  background-size: 200% 100%;
  animation: ckp-shimmer 1.4s ease-in-out infinite;
}
.ckp-skeleton--pill { width: 200px; height: 34px; border-radius: 999px; }
.ckp-skeleton--round { width: 38px; height: 38px; border-radius: 999px; }
.ckp-skeleton--cover { width: 96px; height: 96px; border-radius: 18px; flex: none; }
.ckp-skeleton--line { height: 12px; }
.ckp-skeleton--tabs { height: 48px; border-radius: 999px; margin-top: 14px; }
.ckp-skeleton--grid { aspect-ratio: 1 / 1; border-radius: 0; }
.ckp-skeleton--section { height: 160px; border-radius: 28px; }
@media (min-width: 768px) { .ckp-skeleton--cover { width: 112px; height: 112px; } }
@keyframes ckp-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* --- Accessibilité -------------------------------------------------------- */

.ckp-shell-focus :focus-visible,
.ckp-card :focus-visible,
.ckp-section :focus-visible,
.ckp-media :focus-visible {
  outline: 2px solid #17402c;
  outline-offset: 2px;
  border-radius: 8px;
}
.ckp-tile:focus-visible { outline-offset: -3px; border-radius: 0; }

@media (prefers-reduced-motion: reduce) {
  .ckp-skeleton { animation: none; }
  .ckp-day-line, .ckp-pill, .ckp-send { transition: none; }
}
```

- [ ] **Step 6: Passe accessibilité (Chrome DevTools MCP)**

Pour chaque point, mesurer puis corriger :

1. **Contraste** : texte muted `#56665d` sur verre blanc ≥ 4,5:1 ; compteurs 11 px idem. Si un texte passe sous 4,5:1, **assombrir vers `#3f4d45`** (déjà utilisé ailleurs dans la maison) — jamais une nouvelle teinte.
2. **Cibles** : `button.gbtn`, `.ckp-pill`, `.ckp-send`, `.ckp-toggle button`, `.ckp-tile` ≥ 44 px de zone cliquable (les `::after` posés en tâche 3/5 doivent couvrir l'écart).
3. **Titres** : `h1` sr-only (déjà), `h2` par section, aucun saut de niveau.
4. **Focus** : tabuler depuis le haut — retour → pilule titre → partager → enregistrer → options → cover → ♥ → commentaires → 5 onglets → tuiles → sections. Aucun piège, ordre conforme au DOM.
5. **Drawers** : `Échap` ferme, focus rendu au déclencheur (déjà dans `OverlaySheet`), `aria-modal` présent.

```bash
npm run test:a11y -- --grep carnet
```

Si aucun test a11y ne couvre la fiche, exécuter la passe manuelle et consigner les mesures dans le rapport de lot.

- [ ] **Step 7: Passe performance**

1. Le bundle de la route ne doit plus contenir `leaflet` **avant** le mode carte : `CarnetTraceMap` est déjà en `dynamic(..., { ssr: false })`.
2. Cover : `loading="eager"` + `fetchPriority="high"` sur l'image de la carte (`ckp-cover`), `loading="lazy"` au-delà des 3 premières tuiles.
3. Mesurer :

```bash
npm run build
npm run analyze
```

Consigner : taille du chunk de route, LCP simulé (4G) sur `/carnets/<id>`, nombre de requêtes. Objectif : LCP < 2,5 s et chunk route < 150 Ko gzip (l'ancienne fiche mesurait 306 Ko gzip et 5,49 s de LCP).

- [ ] **Step 8: Build complet**

```bash
npm run type-check && npm run lint && npm run build
```

Expected: build vert, aucune route en erreur, `/carnets/[id]` toujours `ƒ (Dynamic)`.

- [ ] **Step 9: Commit**

```bash
git add -A src/app/carnets src/components/carnet src/lib/queries src/lib/mock src/styles/carnet-profile.css
git commit -m "chore(carnet): suppression de l'ancienne fiche, etats, a11y et perf"
```

---

## Task 10: Recette, diff visuel et production

**Files:**
- Create: `docs/audit/carnet-2026-10-24/12-recette-refonte.md` (preuves)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: captures avant/après au même viewport, diff pixel, rapport de recette, URL de prod vérifiée.

- [ ] **Step 1: Capturer l'après aux six viewports**

```bash
for size in 430,932 768,1024 1440,900; do
  npx playwright screenshot --viewport-size=$size --full-page "http://localhost:4000/carnets/<id>" "/tmp/ckp-after-${size%%,*}.png"
done
```

Répéter en thème sombre (DevTools → `prefers-color-scheme: dark`) et sur `/communaute` + `/compte` pour prouver l'absence de régression des primitives partagées.

- [ ] **Step 2: Diff pixel contre l'avant**

```bash
npm run design:diff -- --before docs/audit/carnet-2026-10-24/evidence/carnet-430.png --after /tmp/ckp-after-430.png --out /tmp/ckp-diff-430.png
```

Lire chaque image de diff. Un écart non expliqué = un bug : corriger, pas documenter.

- [ ] **Step 3: Recette fonctionnelle complète**

| # | Test | Attendu |
|---|---|---|
| 1 | Carnet public, visiteur | Tout visible sauf actions d'écriture ; ♥ et commentaire renvoient vers `/connexion?next=` |
| 2 | Carnet privé, propriétaire | Visible, badge « Privé », actions de gestion présentes |
| 3 | Carnet privé, autre utilisateur | HTTP 404 réel |
| 4 | Carnet inexistant | HTTP 404 réel, `robots: noindex` |
| 5 | Like connecté | +1 immédiat, persiste après rafraîchissement |
| 6 | Commentaire | Persiste, supprimable par son auteur seulement |
| 7 | Vue | Une ligne `carnet_views` par visite |
| 8 | 5 sections | Chaque onglet scrolle sur sa section ; `Parcours` passe la carte, `Moments` la grille |
| 9 | Viewer | Flèches, `Échap`, compteur 1/N, légende |
| 10 | GPX | Téléchargé si trace, bouton désactivé sinon |
| 11 | Carte | Tuiles + crédit complet, aucune tuile si hors ligne (état vide) |
| 12 | Visibilité | Bascule public/privé persistée, badge mis à jour |
| 13 | Suppression | Confirmation, suppression, redirection `/carnets` |
| 14 | Auteur | Clic → `/profil/{id}` |
| 15 | Données | Aucun « Antoine Duprès », aucun compteur 24/8, aucun « Certifié », aucune distance divisée |
| 16 | Clavier | Parcours complet, focus visible, `Échap` ferme les feuilles |
| 17 | 768 px | Colonne 520 centrée, aucun écrasement |
| 18 | Build | `npm run type-check && npm run lint && npm run build` verts |

- [ ] **Step 4: Écrire le rapport de recette**

`docs/audit/carnet-2026-10-24/12-recette-refonte.md` : une ligne par test du tableau, statut, preuve (capture, requête SQL, sortie de commande), et la liste des écarts résiduels assumés.

- [ ] **Step 5: Déployer et vérifier l'URL**

```bash
git push origin chantier/post-system
```

Après déploiement Vercel :

```bash
curl -sI "https://<domaine>/carnets/<id>" | head -5
curl -s "https://<domaine>/carnets/inconnu" -o /dev/null -w '%{http_code}\n'
```

Attendu : `200` sur un carnet public, `404` sur un identifiant inconnu, JSON-LD présent et échappé dans le HTML.

- [ ] **Step 6: Rapport final**

Dans la réponse à l'utilisateur : ce qui est refondu, ce qui est prouvé (captures, diff, tests, URL), ce qui reste, ce qui est risqué. Trois captures minimum : 430 avant/après, 1440 après, diff 430.

---

## Auto-revue du plan

**Couverture de la spec `11-disposition-compte-carnet.md`**

| Exigence | Tâche |
|---|---|
| Colonne 520, fond Compte, top bar 52 | 3 |
| Pilule titre (cover 24) + 3 gbtn | 3 |
| Carte d'identité 28 (cover 96/112, titre, stats, auteur, description, actions) | 4 |
| Capsule 48, 5 sections, non sticky | 4 |
| Grille 3 col gap 2 sans radius + toggle 30 | 5 |
| Carte 1:1, trace, GPX | 5, 8 |
| Viewer média | 5 |
| Sections Récit / Matériel / Nature / Commentaires | 6, 7 |
| Bottom bar 48, aucun actif | 3 |
| Drawers Commentaires / Partage / Menu / Gérer / Carte / Signaler | 7, 8 |
| Fond, police, sélecteurs, boutons uniques | 3 (feuille) |
| Responsive 430/768/1440 | 3, 10 |
| Zéro donnée inventée | 1, 2 |
| 404 réel, JSON-LD échappé, RLS propriétaire | 2 |

**Écarts assumés par rapport à `11`** (documentés, pas silencieux) :
1. Commentaires « réponses + likes » → liste à plat (la table ne les a pas).
2. `.pmi-author`/`.gbtn`/`.tb` réutilisés tels quels : la carte d'identité ne réimplémente aucune primitive.
3. Drawer Profil auteur → route `/profil/{id}` (route réelle) plutôt que `ProfileDrawerHost` hors runtime.
4. `Export PDF` → export JSON conservé (fonctionnalité existante) ; pas de PDF.
5. `/compas?etape=kit` → `/compas` (paramètre inexistant).

**Cohérence des types** : `CarnetDetail`, `CarnetDay`, `CarnetMomentItem`, `CarnetKit`, `CarnetEngagement`, `CarnetComment` sont définis une seule fois (tâches 1 et 7) et consommés par les mêmes noms partout. `formatKm`, `formatElevation`, `formatWeight`, `formatDateRange`, `toNumber` sont exportés par `format.ts` et utilisés à l'identique dans les cartes, la timeline et les feuilles.

**Pas de placeholder** : chaque étape contient le code, la commande et l'attendu. Les seuls `<id>` à substituer sont des identifiants de carnet réels à prendre dans le hub — pas des valeurs de code.
