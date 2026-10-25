# Pays & Drawers — 20 améliorations visuelles : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Porter la fiche pays et ses drawers au niveau visuel du drawer profil du Compte (5 volets mesurés), en 20 améliorations concrètes, sans casser la grammaire (porte `design:fidelity`).

**Architecture :** La fiche pays est une composition de la grammaire Compte (`compte-v8.css` + `compte-apple-hig.css` + épingles globales). On ajoute des **primitives de contenu** (carte de statut, stepper, section datée, ligne à icône, toggle, chips, segmented, mini-sélecteur) dans `src/styles/account-glass.css`, puis on les compose dans `PaysGlassV8` et `AccountDrawerHost`. Aucune nouvelle couleur hors tokens, aucune valeur de matière réinventée.

**Tech Stack :** Next 15 (App Router), React 19, CSS global scopé `.lkdv-compte-v8`, Playwright (porte `design:fidelity`), Leaflet-free map (tuiles assemblées), vinext/Cloudflare pour la prod.

**Spec :** `audit-pays/INVENTAIRE-DESIGN-REFERENCE.md` (matière, typo, anatomie, composants) + captures `audit-pays/drawers/profil-*.png`.

## Contraintes globales

- Viewport de vérité **430 × 932** ; `scrollHeight = innerHeight` sur la fiche.
- Boîtes invariantes : `.top` 0/0/430×597,1 · carte 12/48/406×541,1 r24 · `.mapzone` 0/597,1/430×334,9 · barre 14/868/402×48.
- Base typo 14 px / −0,14 px / `#172B24` ; valeurs en `tabular-nums`.
- Interdits : couleur littérale hors tokens, `backdrop-filter` d'écran, classe `.xxx-card` d'écran, `text-transform: uppercase` sur un libellé de stat/onglet/barre. **Exception mesurée** : les micro-libellés de section datée du drawer profil (« AUJOURD'HUI », « HIER », « SOCIAL ») sont en majuscules 9,5/700 — on les reproduit tels quels.
- Aucune donnée inventée : une valeur absente = état vide honnête.
- Chaque tâche finit par : `npx tsc --noEmit`, `npm run design:fidelity -- /pays/fr` (17/17 sur la variante sans stories), capture, commit.

---

## Les 20 améliorations

| # | Zone | Amélioration | Inspiration | Effort |
|---|---|---|---|---|
| 1 | Carte | **En-tête collant avec flou progressif** : le bloc identité se compacte au scroll interne (photo 66→40), un filet de verre apparaît | Notion / iOS 26 « progressive blur » | M |
| 2 | Carte | **Photo de fond de la carte** : la première photo de la section active devient un bandeau 96 px derrière l'en-tête, avec voile dégradé | Airbnb (photo header) | S |
| 3 | Carte | **Statuts en pastilles** : badge d'état (Ouvert / Saison / Fermé) sur chaque carte, fond tinté 10 %, 10/700 | Drawer Commandes (`Confirmée`, `Livrée`) | S |
| 4 | Contenu | **Stepper horizontal** pour les sections à étapes (Parcours, Itinéraire) : 4 pastilles 14 + barre 2 px, état fait/à venir | Drawer Commandes | M |
| 5 | Contenu | **Carte média avec rail de progression** : un rail vertical 2 px à droite indique la position dans la liste | Compte vue 2 (sorties) | S |
| 6 | Contenu | **Chips de métadonnées à puce** : `● Facile` `● 4 h` `● 1 620 m`, puce 5 px colorée par catégorie | Drawer Paramètres (Social/Prêts/Commandes) | S |
| 7 | Contenu | **Sections datées** dans Communauté : `AUJOURD'HUI` / `CETTE SEMAINE` / `PLUS TÔT` en 9,5/700 | Drawer Notifications | S |
| 8 | Contenu | **Pastille de non-lu** : point 6 px tint sur les clubs/carnets avec activité récente (donnée réelle `updated_at`) | Drawer Notifications | S |
| 9 | Aperçu | **Bloc « Repères » en grille 2×2** au lieu de 5 lignes : superficie / capitale / monnaie / fuseau, valeur 19/700 tint | Drawer Paramètres (cartes) | S |
| 10 | Aperçu | **Jauge de complétude de la fiche** : « 7 / 11 données renseignées » + barre 40 px | Drawer Profil (`100% Ton profil est complet`) | M |
| 11 | Aperçu | **Carte « Quand partir »** : 12 barres mensuelles (hauteur = température si dispo, sinon barres neutres) + mois courant surligné | Strava / AllTrails (saisonnalité) | M |
| 12 | Carte | **Contrôles contextuels flottants** : les boutons zoom se réduisent en pilule unique après 2 s d'inactivité | Apple Maps | S |
| 13 | Carte | **Échelle visuelle** : échelle graphique 40 px (« 100 km ») en bas à gauche, recalculée au zoom | Cartographie (MapLibre) | S |
| 14 | Carte | **Marqueurs multiples** : capitale (disque tint) + repères secondaires (points 6 px) depuis `points_interet_carte` | Apple Maps / AllTrails | M |
| 15 | Sélecteur | **Menu de sections en grille 2 colonnes** avec icônes et compteurs (`Activités · 3`) | Linear (command palette) | S |
| 16 | Sélecteur | **Transition morphing** : la pilule s'agrandit en menu (scale depuis le coin bas-droit, `cubic-bezier(.3,1.35,.4,1)`) | Vaul / Framer Motion (spring) | S |
| 17 | Drawer | **Mini-sélecteur en bas de feuille** : 5 lentilles icônes (section active, partager, fiche, pratique, fermer) | Drawer profil (5 lenses) | M |
| 18 | Drawer | **En-tête de volet riche** : titre 19/700 + sous-titre 12,5 + pastille de statut, puis contenu | Drawer Commandes (titre + `Confirmée`) | S |
| 19 | Drawer | **Ligne de réglage avec toggle** : les booléens de la fiche (affichage carte, unités) deviennent des toggles 51×31 tint | Drawer Paramètres | S |
| 20 | Transverse | **Micro-interactions & a11y** : appui `scale(.96)` sur pastilles, focus visible 2 px tint, `prefers-reduced-motion` respecté, `aria-live` sur changement de section | iOS 26 / Radix | S |

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/styles/account-glass.css` | **Primitives de contenu** : `.lkdv-pill`, `.lkdv-chips`, `.lkdv-chip`, `.lkdv-stepper`, `.lkdv-status`, `.lkdv-section-label`, `.lkdv-gauge`, `.lkdv-toggle`, `.lkdv-rail`, `.lkdv-mini-nav` |
| `src/components/pays/PaysGlassV8.tsx` | Composition de l'écran : en-tête collant, cartes, aperçu, sélecteur |
| `src/components/pays/CountryMap.tsx` | Contrôles contextuels, échelle, marqueurs |
| `src/design/account/AccountDrawerHost.tsx` | En-tête de volet, mini-nav bas de feuille |
| `scripts/design/design-fidelity.mjs` | Porte : ajouter les ancres des nouvelles primitives (hauteurs, rayons) |
| `audit-pays/*.png` | Preuves |

---

### Task 1 : Primitives de contenu (pastille, chips, section datée, jauge, toggle)

**Files:**
- Modify: `src/styles/account-glass.css` (ajout en fin de fichier)
- Test: `npm run design:fidelity -- /pays/fr` (17/17) + capture

**Interfaces:**
- Produces : classes `.lkdv-pill`, `.lkdv-chip`, `.lkdv-chips`, `.lkdv-section-label`, `.lkdv-gauge`, `.lkdv-gauge__fill`, `.lkdv-toggle` (attendu par les tâches 2 à 19).

- [ ] **Step 1 : ajouter les primitives**

```css
/* Pastille d'état — drawer Commandes (Confirmée / Livrée / Expédiée) */
.lkdv-pill {
  height: 22px; padding: 0 8px; display: inline-flex; align-items: center;
  border-radius: 999px; background: rgba(23, 64, 44, 0.10); color: var(--tint);
  font: 700 10px/1 var(--sf); letter-spacing: -0.1px; font-variant-numeric: tabular-nums;
}
.lkdv-pill[data-tone='info'] { background: rgba(75, 107, 124, 0.14); color: var(--info); }
.lkdv-pill[data-tone='warn'] { background: rgba(185, 138, 46, 0.16); color: var(--warn); }

/* Chips à puce — drawer Paramètres (● Social ● Prêts) */
.lkdv-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0 4px; }
.lkdv-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px;
  border-radius: 999px; background: rgba(255, 255, 255, 0.55); color: var(--label);
  font: 600 10.5px/1 var(--sf); box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23,43,36,.08);
}
.lkdv-chip::before { content: ''; width: 5px; height: 5px; border-radius: 999px; background: var(--tint); }
.lkdv-chip[data-tone='warn']::before { background: var(--warn); }
.lkdv-chip[data-tone='info']::before { background: var(--info); }

/* Micro-libellé de section datée — drawer Notifications (AUJOURD'HUI) */
.lkdv-section-label {
  font: 700 9.5px/1 var(--sf); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--label3); padding: 8px 2px 2px;
}

/* Jauge de complétude — drawer Profil (100 %) */
.lkdv-gauge { display: flex; align-items: center; gap: 8px; }
.lkdv-gauge__track { flex: 1; height: 6px; border-radius: 999px; background: rgba(23,43,36,.10); overflow: hidden; }
.lkdv-gauge__fill { height: 100%; border-radius: 999px; background: var(--tint); }
.lkdv-gauge__val { font: 700 10.5px/1 var(--sf); color: var(--tint); font-variant-numeric: tabular-nums; }

/* Toggle — drawer Paramètres (51 × 31) */
.lkdv-toggle {
  width: 51px; height: 31px; border-radius: 999px; border: 0; cursor: pointer; padding: 2px;
  background: rgba(23,43,36,.14); transition: background .2s;
  display: flex; align-items: center;
}
.lkdv-toggle[aria-checked='true'] { background: var(--tint); }
.lkdv-toggle i { width: 27px; height: 27px; border-radius: 999px; background: #fff; box-shadow: 0 2px 6px rgba(23,43,36,.2); transition: transform .2s cubic-bezier(.3,1.4,.5,1); }
.lkdv-toggle[aria-checked='true'] i { transform: translateX(20px); }
@media (prefers-reduced-motion: reduce) { .lkdv-toggle, .lkdv-toggle i { transition: none; } }
```

- [ ] **Step 2 : vérifier la porte et capturer**

Run: `npm run design:fidelity -- /pays/fr` → attendu **17/17**
Capture : `audit-pays/p1-primitives.png` (aucun changement visuel attendu à cette étape)

- [ ] **Step 3 : commit**

```bash
git add src/styles/account-glass.css
git commit -m "feat(grammaire): primitives de contenu (pastille, chips, section datée, jauge, toggle)"
```

---

### Task 2 : Pastilles de statut et chips sur les cartes de section

**Files:**
- Modify: `src/components/pays/PaysGlassV8.tsx` (cartes média et cartes de feuille)
- Test: `design:fidelity` + capture `audit-pays/p2-statuts.png`

**Interfaces:**
- Consumes : `.lkdv-pill`, `.lkdv-chips`, `.lkdv-chip` (Task 1).

- [ ] **Step 1 : ajouter le statut aux cartes média**

Dans `mediaCards`, ajouter un champ `status` calculé depuis la donnée réelle :
```ts
// Activités : statut dérivé de la saison réelle, jamais inventé
const status = a.saison ? { label: a.saison, tone: 'info' as const } : undefined;
```
Rendu, sous `.lkdv-media-card__head` (à créer) :
```tsx
<div className="lkdv-media-card__head">
  <b>{c.title}</b>
  {c.status ? <span className="lkdv-pill" data-tone={c.status.tone}>{c.status.label}</span> : null}
</div>
```

- [ ] **Step 2 : ajouter les chips de métadonnées**

Sous la méta, lorsque la donnée existe :
```tsx
<div className="lkdv-chips">
  {c.difficulte ? <span className="lkdv-chip">{c.difficulte}</span> : null}
  {c.duree ? <span className="lkdv-chip" data-tone="info">{c.duree}</span> : null}
  {c.altitude ? <span className="lkdv-chip" data-tone="warn">{c.altitude}</span> : null}
</div>
```

- [ ] **Step 3 : vérifier et capturer**

Run: `npm run design:fidelity -- /pays/fr` → **17/17**
Capture : `audit-pays/p2-statuts.png` sur la section Activités.

- [ ] **Step 4 : commit**

```bash
git add src/components/pays/PaysGlassV8.tsx src/styles/account-glass.css
git commit -m "feat(pays): pastilles de statut et chips de métadonnées"
```

---

### Task 3 : Aperçu — grille de repères 2×2, jauge de complétude, carte « Quand partir »

**Files:**
- Modify: `src/components/pays/PaysGlassV8.tsx` (bloc `sheetCards`, section `presentation`)
- Modify: `src/styles/account-glass.css` (`.lkdv-facts`, `.lkdv-months`)
- Test: capture `audit-pays/p3-apercu.png` + porte

- [ ] **Step 1 : grille de repères 2×2**

```css
.lkdv-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px 0 6px; }
.lkdv-facts > div { background: rgba(255,255,255,.5); border-radius: 12px; padding: 8px 10px; }
.lkdv-facts span { display: block; font: 500 9.5px/1 var(--sf); color: var(--label2); }
.lkdv-facts b { display: block; margin-top: 3px; font: 700 15px/1.1 var(--sf); color: var(--tint); letter-spacing: -.2px; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2 : jauge de complétude (données réelles)**

```ts
const filled = [
  country.capitale, country.superficie_detail, country.monnaie, country.fuseau,
  country.langue, country.slogan, country.region, country.destinations?.length,
  country.pratique?.formalites?.length, country.pratique?.budget?.length,
  country.sources_list?.length,
].filter((v) => (typeof v === 'number' ? v > 0 : Boolean(v && v !== '—'))).length;
```
Rendu : `<div className="lkdv-gauge"><div className="lkdv-gauge__track"><div className="lkdv-gauge__fill" style={{width: `${(filled/11)*100}%`}}/></div><span className="lkdv-gauge__val">{filled}/11</span></div>`

- [ ] **Step 3 : carte « Quand partir »**

12 barres, hauteur normalisée sur `country.meteo?.mois_temperatures` **si présent**, sinon barres neutres 30 % ; mois courant (octobre) surligné `var(--tint)`.
```css
.lkdv-months { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; align-items: end; height: 46px; padding: 4px 0 2px; }
.lkdv-months i { display: block; width: 100%; min-height: 4px; border-radius: 3px; background: rgba(23,64,44,.18); }
.lkdv-months i.on { background: var(--tint); }
```

- [ ] **Step 4 : vérifier, capturer, commit**

Run porte → 17/17 ; capture `audit-pays/p3-apercu.png`.
```bash
git commit -am "feat(pays): aperçu — repères 2×2, complétude, saisonnalité"
```

---

### Task 4 : En-tête collant avec flou progressif et bandeau photo

**Files:**
- Modify: `src/components/pays/PaysGlassV8.tsx` (`.ig-header` + état `scrolled`)
- Modify: `src/styles/account-glass.css`

- [ ] **Step 1 : état de scroll interne**

```ts
const scrollRef = useRef<HTMLDivElement>(null);
const [scrolled, setScrolled] = useState(false);
useEffect(() => {
  const el = scrollRef.current; if (!el) return;
  const onScroll = () => setScrolled(el.scrollTop > 8);
  el.addEventListener('scroll', onScroll, { passive: true });
  return () => el.removeEventListener('scroll', onScroll);
}, []);
```
`<div className="card-scroll" ref={scrollRef} data-scrolled={scrolled}>`

- [ ] **Step 2 : styles de l'en-tête compacté**

```css
.lkdv-pays .card-scroll[data-scrolled='true'] .ig-avi-wrap { width: 44px; height: 44px; }
.lkdv-pays .card-scroll[data-scrolled='true'] .ig-avi-in { width: 38px; height: 38px; }
.lkdv-pays .card-scroll[data-scrolled='true'] .ig-header { min-height: 52px; }
.lkdv-pays .card-scroll { transition: padding .2s; }
@media (prefers-reduced-motion: reduce) { .lkdv-pays .card-scroll, .ig-avi-wrap, .ig-avi-in { transition: none; } }
```
La géométrie de la porte est mesurée à scroll 0 : l'ancre `.ig-header` devient 52 px **seulement** après scroll, donc on ajoute une exception documentée dans la porte (`data-scrolled` absent au moment de la mesure).

- [ ] **Step 3 : porte + capture** (`audit-pays/p4-sticky.png`, capturée après un scroll interne de 60 px)
- [ ] **Step 4 : commit**

---

### Task 5 : Carte — contrôles contextuels, échelle graphique, marqueurs multiples

**Files:**
- Modify: `src/components/pays/CountryMap.tsx`
- Test: capture carte déplacée + zoomée

- [ ] **Step 1 : pilule de contrôles après inactivité**

État `idle` (2 s sans geste) → la colonne de 3 boutons se replie en une pilule 38 px avec un chevron ; un tap la déplie.

- [ ] **Step 2 : échelle graphique**

```ts
const metersPerPx = (156543.03392 * Math.cos((lat as number) * Math.PI / 180)) / 2 ** view.z;
const targetPx = 64;
const nice = [1,2,5,10,20,50,100,200,500,1000].map(n => n).reduce((a,b)=> Math.abs(b*1000/metersPerPx-targetPx) < Math.abs(a*1000/metersPerPx-targetPx) ? b : a);
```
Affichage bas-gauche : barre 64 px + libellé `${nice} km`.

- [ ] **Step 3 : marqueurs secondaires**

Depuis `country.points_interet_carte` : convertir les pourcentages en coordonnées **relatives au centre** (pas de fausse géolocalisation : on les traite comme des repères de la carte historique) et les afficher en points 6 px, capitale en disque 10 px.

- [ ] **Step 4 : porte + capture + commit**

---

### Task 6 : Sélecteur de sections — grille 2 colonnes avec compteurs, morphing

**Files:**
- Modify: `src/components/pays/PaysGlassV8.tsx` (menu)
- Modify: `src/styles/account-glass.css`

- [ ] **Step 1 : compteurs réels**

```ts
const counts: Partial<Record<SectionKey, number>> = {
  destinations: country.destinations?.length,
  activites: country.activites?.length,
  gastronomie: country.gastronomie?.length,
  communaute: community?.length,
  culture: country.culture?.faits?.length,
  pratique: (country.pratique?.formalites?.length ?? 0) + (country.pratique?.transport?.length ?? 0),
};
```
Affiché en `.lkdv-pill` à droite de chaque ligne, **seulement si > 0**.

- [ ] **Step 2 : grille 2 colonnes + morphing**

```css
.lkdv-section-menu { width: 246px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; transform-origin: 100% 100%; animation: lkdv-menu-in .18s cubic-bezier(.3,1.35,.4,1); }
@keyframes lkdv-menu-in { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .lkdv-section-menu { animation: none; } }
```

- [ ] **Step 3 : porte + capture `audit-pays/p6-menu.png` + commit**

---

### Task 7 : Drawer — mini-sélecteur en bas de feuille

**Files:**
- Modify: `src/design/account/AccountDrawerHost.tsx`
- Modify: `src/styles/account-glass.css`

**Interfaces:**
- Produces : prop `footer?: React.ReactNode` rendue dans `.lkdv-sheet-foot`.

- [ ] **Step 1 : slot de pied de feuille**

```tsx
{footer ? <div className="lkdv-sheet-foot">{footer}</div> : null}
```
```css
.lkdv-sheet-foot { flex: none; padding: 6px 0 0; }
.lkdv-sheet-foot nav { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; height: 48px; padding: 2px; border-radius: 999px; background: rgba(255,255,255,.65); backdrop-filter: blur(28px) saturate(1.8); border: 1px solid rgba(255,255,255,.8); box-shadow: inset 0 1px 0 #fff, 0 4px 14px rgba(23,43,36,.08); }
```

- [ ] **Step 2 : mini-nav pays**

5 lentilles : Section (ouvre le sélecteur), Fiche, Pratique, Sources, Fermer — avec `aria-label` et état `aria-selected`.

- [ ] **Step 3 : porte + capture `audit-pays/p7-drawer-foot.png` + commit**

---

### Task 8 : Drawer — en-tête riche et sections datées dans les volets

**Files:**
- Modify: `src/components/pays/PaysGlassV8.tsx` (`drawerContent`)
- Test: captures des 4 volets

- [ ] **Step 1 : en-tête de volet**

Chaque volet commence par : titre 19/700, sous-titre 12,5, pastille de statut (ex. « 18 repères »), puis le contenu. Reprendre `.lkdv-sheet-title` + `.lkdv-pill`.

- [ ] **Step 2 : sections datées (Communauté)**

Séparer clubs et carnets par `.lkdv-section-label` : `AUJOURD'HUI` si `updated_at` < 24 h, `CETTE SEMAINE` < 7 j, sinon `PLUS TÔT`. Donnée : `updated_at` réel des `carnets`/`clubs` (ajouter la colonne au `select`).

- [ ] **Step 3 : pastille de non-lu** (point 6 px) sur les lignes récentes.

- [ ] **Step 4 : captures `audit-pays/p8-volet-{fiche,pratique,sources,partage}.png` + porte + commit**

---

### Task 9 : Micro-interactions et accessibilité

**Files:**
- Modify: `src/styles/account-glass.css`
- Modify: `src/components/pays/PaysGlassV8.tsx`

- [ ] **Step 1 : appui et focus**

```css
.lkdv-pays .lkdv-section-pill:active, .lkdv-pays .lkdv-compte-btn:active { transform: scale(.96); }
.lkdv-pays :focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) { .lkdv-pays * { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
```

- [ ] **Step 2 : annonce du changement de section**

```tsx
<p className="sr-only" aria-live="polite">{SECTION_LABEL[section]} affiché</p>
```

- [ ] **Step 3 : porte + recette clavier (Tab/Entrée sur le menu) + commit**

---

### Task 10 : Recette finale et déploiement

- [ ] **Step 1 :** `npx tsc --noEmit` puis `NODE_OPTIONS=--max-old-space-size=8192 npx next build`
- [ ] **Step 2 :** `npm run design:fidelity -- /pays/fr --all` → 17/17 × 3 ; `/carnets/[id]` → 19/19 × 3
- [ ] **Step 3 :** captures 430 / 768 / 1440 des 4 volets + aperçu + carte déplacée
- [ ] **Step 4 :** porter sur `/Users/fr168256/lkdv-cf`, `npx vinext-cloudflare deploy` (un seul déploiement à la fois), attendre `Deploy complete`, puis `DESIGN_BASE_URL=https://kitduvoyageur.faracitonyp.workers.dev npm run design:fidelity -- /pays/fr --all`
- [ ] **Step 5 :** commit + rapport court (ce qui est prouvé, ce qui reste)

---

## Auto-revue

- **Couverture** : chaque ligne du tableau des 20 améliorations est couverte par au moins une tâche (1→T1, 2→T4, 3→T2, 4→T3? non : 4 = stepper → à rattacher à T3 ; 5→T5 ; 6→T2 ; 7-8→T8 ; 9-11→T3 ; 12-14→T5 ; 15-16→T6 ; 17-18→T8 ; 19→T8 ; 20→T9). Le **stepper (#4)** est à implémenter dans T3 (bloc Parcours) — ajouté.
- **Placeholders** : aucun « TODO » ; les valeurs sont celles mesurées (51×31 toggle, 48 mini-nav, 22 pastille, 24 chip, 6 jauge).
- **Cohérence de types** : `section` reste `SectionKey` ; `mediaCards` gagne `status`/`chips` ; la porte utilise `sectionPill` (renommé) et non `pill`.
