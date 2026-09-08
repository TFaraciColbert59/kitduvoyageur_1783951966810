# CHANTIER H — HUB DU VOYAGEUR (fusion matériel · voyage · groupe)

Plan d'intégration exécutable en autonomie.

| Champ | Valeur |
|---|---|
| Document | `docs/CHANTIER_H_HUB_VOYAGEUR.md` |
| Version | 1.0 — rédigé le 08/09/2026 |
| Branche de travail | `chantier/h-hub-voyageur`, créée depuis `main` (≥ `8865a7ff`, c.-à-d. Z0+Z1+Z2 fusionnés) |
| Prérequis bloquants | Z2 mergé sur main ; compteurs de tests figés ; export par défaut `shakedownEngine` confirmé |
| Doctrine | App-first, mobile 430×932 prioritaire, règles déterministes + IA explicative (jamais l'IA comme source unique de la navigation) |

---

## 0. PRÉREQUIS IMMÉDIATS (H0, bloquant)

**H0.1 — Clôturer Z2.** Les changements locaux non commités (`src/features/trips/components/TripKitView.tsx` +67/−3, `tests/features/trips/tripShakedownIntegration.spec.ts` nouveau) doivent être commités sur `chantier/z-materiel-hub`, portes G1–G4 relancées, puis PR → main. **Le chantier H ne démarre pas sur un arbre sale.**

**H0.2 — Refermer les dettes Y.** (agent : vérifier, Tony : agir) — protection de branche `main` toujours `"protected": false` côté GitHub ; migration RLS `20260907010000_trips_rls_hardening.sql` non confirmée. Tant que la protection n'est pas posée, H peut écraser Y/Z sans porte opposable.

**H0.3 — État des lieux.** Générer `docs/H_INVENTAIRE.md` : arbre des couches concernées (tailles Git LF, pas CRLF), liste des skills `.agents/skills/` réellement présentes, sortie des 6 portes sur le commit de départ (référence chiffrée obligatoire), et le décompte des tests (base `1049` au 08/09 — **revérifier, ne jamais recopier**).

---

## 1. VISION PRODUIT

Un seul endroit, le **hub**, où se réunit tout ce qui constitue une aventure :

- **notre équipement** (matériel, kits, disponibilité, prêts),
- **notre voyage** (randonnée solo d'un jour, trek d'un week-end, road trip multi-pays de 4 semaines),
- **ceux avec qui on part** (solo, duo, groupe, équipage).

Trois décisions structurantes, validées avec Tony :

1. **Mobile first** : bottom bar à 5 accès avec **le hub au centre**. Les 5 accès deviennent : `Pays` · `Explorer` · **`Hub`** · `Communauté` · `Profil`. Les onglets « Matériel » et la navigation « Groupes » de l'hamburger migrent dans le hub.
2. **Adaptation déterministe, IA explicative** : `tripProfileEngine` décide des sections (déterminisme, hors-ligne, testabilité). L'IA n'affiche que des **raisons et suggestions** via le mécanisme `reason` déjà porté par `TripSectionPicker`. Repli déterministe systématique si appel IA en échec ou hors-ligne.
3. **Sélecteur de contexte** : le hub s'initialise sur une « aventure » sélectionnable, comme un changement de compte mais limité au hub. C'est la **généralisation d'`ActiveTripSwitcher`** (cmdk desktop / GlassSheet mobile, déjà écrit et validé) à trois natures d'aventure.

### Les trois natures d'aventure

| Nature | Source de données | Sections types | Persistance |
|---|---|---|---|
| `possession` | `/materiel/*` (inventaire, kits, prêts, alertes) | inventaire, kits, preparation, alertes, disponibilite, forget | permanente, sans date |
| `sortie` | `Trip` + `TripFull` (hub Y) | les 10 sections canoniques Y | datée |
| `collectif` | `crews` + `groupes` | equipage, feed groupe, voyages liés | membres |

**Règle d'or héritée de Z1** : le hub *consomme* l'inventaire par `inventory_item_id`, il ne le recopie jamais. `/materiel` reste la source de vérité patrimoniale — mais il cesse d'être une destination racine : il devient rendu par la coquille du hub.

---

## 2. ARCHITECTURE CIBLE

### 2.1 La coquille unique (pas une page monolithe)

Un layout de segment `/hub` qui délègue aux registres :

```
src/app/hub/layout.tsx                 ← charge le contexte actif + la coquille
src/app/hub/page.tsx                   ← aperçu de l'aventure active
src/app/hub/[section]/page.tsx         ← section active (inventaire, kit, equipage, budget…)
```

- Desktop : le cockpit 3 colonnes déjà validé en Y (`AppShellDesktop`, 260px nav / centre / 300px widgets).
- Mobile : centre plein écran, colonne gauche en GlassSheet, widgets en bande défilante.
- Le contenu de chaque zone vient des **registres** (unique source de vérité) :

```
src/features/hub/registry/hubSectionRegistry.ts    ← sections des 3 natures
src/features/hub/registry/hubWidgetRegistry.ts     ← widgets colonne droite
src/features/hub/engine/hubProfileEngine.ts        ← pure, horloge injectée
src/features/hub/context/ActiveAdventureContext.tsx ← généralisation ActiveTripContext
src/features/hub/components/AdventureSwitcher.tsx   ← généralisation ActiveTripSwitcher
src/features/hub/components/HubShell.tsx
src/features/hub/components/widgets/*
```

### 2.2 `hubProfileEngine` — le moteur d'adaptation

Pure function `deriveAdventureProfile(adventure, now: Date): AdventureProfile`, sur le modèle de `tripProfileEngine` (310 lignes, 53 tests — même exigence TDD, horloge **injectée**, zéro `new Date()` interne).

```ts
type AdventureNature = 'possession' | 'sortie' | 'collectif';
interface AdventureProfile {
  nature: AdventureNature;
  scale: 'day' | 'short' | 'long' | 'expedition' | null;   // null si possession
  party: 'solo' | 'duo' | 'group';
  density: 'compact' | 'comfortable';
  sections: HubSectionId[];      // ordonnées
  widgets: HubWidgetId[];        // ordonnés par priorité
  reason: Record<HubSectionId, string>;  // traçabilité — affichée par le picker
}
```

Entrées dérivées de données existantes (aucune migration schéma) :
- `possession` : existence d'items/loans/alertes dans `/materiel` ;
- `sortie` : réutilise `deriveTripProfile` tel quel (composition, pas duplication) ;
- `collectif` : `crews.actions` + voyages liés au groupe.

Modulations : road trip multi-pays → budget + documents + cartes pays forcés ; rando solo 1 jour → kit + itinéraire + sécurité uniquement ; groupe → equipage + budget partagé ; possession pure → pas d'itinéraire ni de budget.

**Rien n'est jamais verrouillé** : le `HubSectionPicker` (généralisation de `TripSectionPicker`, déjà livré et testé) permet d'activer toute section masquée, choix persisté dans `metadata.enabled_sections`.

### 2.3 Le sélecteur d'aventure

`AdventureSwitcher.tsx` = `ActiveTripSwitcher.tsx` (8 910 o, cmdk + GlassSheet, recherche clavier, restauration de dernière section) étendu :
- source : `ActiveAdventureContext` (union des 3 natures, en cache react-query, `staleTime` raisonnable) ;
- liste **groupée par nature** (Mon matériel / Mes voyages / Mes groupes) avec compteurs et sous-titres de contexte (« Road trip 4 semaines — 3 compagnons ») ;
- persistance du contexte actif : clé `lkdv_active_adventure` (localStorage) + server action mirroring `setActiveTripAction` ;
- raccourcis conservés : Ctrl/Cmd+K et J ;
- l'IA peut réordonner/suggerérer le contexte par défaut (ex. « départ dans 2 jours ») **mais jamais restreindre la liste**.

### 2.4 La bottom bar

Refonte ciblée de `src/components/mobile-nav/BottomTabBar.tsx` (42 072 o — le poids vient des mini-sheets internes : messagerie, groupes, clubs, carnets, cockpit terrain, qui deviennent redondants avec le hub et seront dédoublonnés en H4) :

- 5 accès : `Earth` · `Aventures` · **`Hub` (centre, accentué, haptique medium à l'ouverture)** · `Communauté` · `Profil` ;
- le tab central ouvre `/hub` en restaurant le contexte actif (jamais une liste d'abord : le hub s'ouvre directement sur l'aventure) ;
- matchPaths du tab central : `/hub`, `/materiel/*`, `/voyages/*`, `/groupes/*` (transition douce pendant H5) ;
- badge sur le hub : items à préparer / alertes matériel / invitations groupe (agrégat) ;
- les sheets internes remplacés par le `AdventureSwitcher` et le `HubSectionPicker` → délestage estimé ~15–20 ko ;
- conservés au caractère : pilule animée `layoutId`, `min 44px`, haptique, prefetch.

---

## 3. MIGRATION DES PAGES EXISTANTES

| Route actuelle | Devenir | Phase |
|---|---|---|
| `/materiel` (racine, DepartCockpit) | **remplacée par le hub** : redirect 307 vers `/hub` ; le cockpit départ devient la section `depart` de la nature `possession` | H3 |
| `/materiel/{inventaire,kits,preparation,depart/[id],disponibilite,alertes,forget}` | 7 sections de la nature possession, rendues par la coquille hub (les 7 routes restent accessibles en deep-link, wrapées par le layout hub — pattern layout de segment Y) | H3 |
| `/voyages` | liste = nature `sortie` ; `/voyages/[slug]` conserve ses 10 sections (régression zéro : le hub pointe dessus via le switcher) | H3 |
| `/groupes` | liste = nature `collectif` ; `page.tsx` 43 581 o à découper (monolithe → sections) | H4 |
| `/ai-configurator` | reste le panneau invocable depuis la section kit (décision Y0.2/Z1 inchangée) | — |

**Règle de non-régression** : pendant H3–H4, `/materiel` et `/groupes` continuent de fonctionner ; les redirects ne tombent qu'en H5, après captures avant/après et validation des 5 parcours.

---

## 4. PHASES

### H0 — Prérequis et état des lieux (bloquant, 2–3 h)
Skills : `verification-before-completion`, `lkdv-development`. Actions : H0.1→H0.3, tag `h0-done`.

### H1 — Moteur et registres, TDD strict (4–6 h)
Skills : `test-driven-development`, `testing-anti-patterns`, `code-quality`.
1. Tests du moteur d'abord (~50 tests : 3 natures × échelles × partys, cas limites — pas de dates, dates inversées, groupe sans membres, inventaire vide, permissions fausses, `status: cancelled`). Rouge attendu, compteur consigné.
2. `hubProfileEngine.ts` + `AdventureProfile` → 50/50 verts.
3. `hubSectionRegistry.ts` : sections des 3 natures avec segments, libellés, icônes, phases, permissions, compteurs ; constructeur typé `hubSectionHref(adventure, sectionId)`.
4. `hubWidgetRegistry.ts` : widgets par nature avec priorités et hauteurs estimées (contrainte Y : somme ≤ 2× fenêtre 1440×900).
5. Garde-fou **H-D85** : extension Y-D80 au périmètre `src/features/hub/**`, `src/app/hub/**`, `src/components/mobile-nav/**` — 12 règles + règle 13 « une seule source de sections » + règle 14 « toute nature de section passe par le registre ». Portes G1–G3.

### H2 — Contexte et sélecteur (4–5 h)
Skills : `apple-ui-designer`, `interaction-design`.
1. `ActiveAdventureContext` (adaptation d'`ActiveTripContext` : liste union, `setActiveAdventure`, mémoire de section par aventure, cache).
2. `AdventureSwitcher` (cmdk / GlassSheet, groupes par nature, recherche, clavier complet, axe-scan 0 critical).
3. Test : changement de contexte → hub réinitialisé sur la bonne aventure et la bonne dernière section, survit au rechargement. Portes G1–G6.

### H3 — La coquille et la nature sortie (6–8 h) — phase la plus risquée
Skills : `nextjs-performance`, `executing-plans`.
1. `HubShell.tsx` : cockpit 3 colonnes / déclinaison mobile, alimenté par les registres.
2. `/hub/layout.tsx` + `page.tsx` (aperçu : countdown, alertes, prochaine action, carte pays) + `[section]/page.tsx` avec `loading.tsx`/`error.tsx` par section.
3. Nature `sortie` branchée sur `TripFull` via composition de `deriveTripProfile` — capture avant/après identique aux références Y pour les 10 sections (diff visuel attendu : zéro hors masques nommés).

### H4 — Natures possession et collectif (8–10 h, parallélisable partiellement sur sections terminales)
Skills : `dispatching-parallel-agents` (sections terminales uniquement, jamacais sur registres/layout), `ux-mobile`.
1. **Possession** : wrap des 7 routes `/materiel/*` sous le layout hub (deep-links préservés), widgets matériel (alertes, dispo, prêts) en colonne droite, moteur canonique `shakedownEngine` consommé (jamais dupliqué).
2. **Collectif** : découpage de `groupes/page.tsx` (43 581 o) en sections du registre ; `equipage` du hub absorbe invitations/rôles ; un groupe avec voyage lié → bouton principal « entrer dans le voyage ».
3. Dédoublement des mini-sheets de `BottomTabBar` (messagerie/groupes/clubs/cockpit) — chaque suppression : grep à zéro collé dans le commit, compteur de tests non décroissant.

### H5 — Bottom bar, transitions, IA (4–6 h)
Skills : `apple-ui-designer`, `interaction-design`, `ux-mobile`.
1. Refonte des 5 tabs avec hub central accentué (cf. §2.4).
2. Redirects `/materiel` → `/hub` (307), hamburger allégé.
3. Surcouche IA (optionnelle, repli déterministe) : suggestions de contexte actif et phrases `reason` enrichies via service serveur — jamais un appel bloquant le rendu, jamais hors-ligne.
4. Haptique medium à l'ouverture du hub, léger sur changement de section.

### H6 — App-first (3–5 h)
Skills : `claude-android-skill`, `ux-mobile`. Safe-areas sur les 3 natures, cibles ≥44 px **mesurées** runtime, retour matériel Android (`useAndroidTripBackNav` étendu au hub : section → aperçu → sélecteur → sortie), offline complet (dexie) sur sections possession + sortie.

### H7 — Qualité (5–7 h)
Skills : `nextjs-performance`, `requesting-code-review`, `receiving-code-review`.
- G6 : axe sur `/hub` × 3 viewports × 3 aventures types, 0 critical/serious.
- Perf : imports dynamiques (three/globe/leaflet/maplibre), budget JS route hub < 250 ko gzip, navigation de section < 200 ms.
- Revue complète du diff.

### H8 — Recette (3–4 h)
Skills : `verification-before-completion`, `finishing-a-development-branch`.
- 6 portes + les 5 parcours (§5) × 2 viewports + natif ou « NON EXÉCUTÉ » en toutes lettres.
- Planche de contact : captures `/hub` × (3 natures × 3 profils) × 3 viewports + états particuliers (hors-ligne, sélecteur ouvert, picker ouvert, vide, erreur).
- `docs/H_REPORT.md` sur le modèle Y_REPORT : SHA réels, sorties brutes horodatées, aucune valeur recopiée. PR → main, corps = valeurs réellement mesurées.

**Total estimé : 37–54 h. Séquence H0 → H1 → H2 → H3 → H4 → H5 → (H6, H7) → H8.**

---

## 5. LES 5 PARCOURS DE RECETTE

1. **Solo, rando d'un jour** : hub s'ouvre sur l'aventure sortie → 3 sections attendues (kit, itinéraire, sécurité), pas de budget/groupe.
2. **Road trip multi-pays 4 semaines en groupe** → 8+ sections, budget par tête, documents, carte pays.
3. **Gestion matérielle pure** : contexte possession → inventaire/alertes/prêts, aucun itinéraire ; ajout d'un item → visible dans la section kit du prochain départ (pont `inventory_item_id`).
4. **Changement de contexte** : switcher matériel → voyage → groupe ; restauration de la dernière section à chaque retour ; rechargement de page = contexte conservé.
5. **Hors-ligne** : « Garder hors-ligne » sur une sortie → navigation dans 3 sections sans réseau, file de synchro, **exactement un indicateur réseau à l'écran**.

---

## 6. RISQUES

| # | Risque | Mitigation |
|---|---|---|
| R1 | Z2 non mergé quand H démarre | H0.1 bloquant |
| R2 | Duplication tripProfileEngine ↔ hubProfileEngine | Composition (hub appelle le moteur Y), test le prouve |
| R3 | Redirect /materiel trop tôt | Redirects seulement en H5, captures avant |
| R4 | BottomTabBar 42 ko : refactor régressif | Refonte en 2 commits (tabs puis délestage sheets), captures par état |
| R5 | IA = non-déterminisme | Règles décident, IA explique ; repli hors-ligne testé |
| R6 | Doublon nouvelle sidebar | H-D85 règle 10/13, `<aside>` interdit hors coquille |
| R7 | Compteur de tests décroissant (démontage sheets) | Décompte déclaré par commit, plancher = référence H0.3 |

---

## 7. INTERDITS (repris de Y, applicables tels quels)

Pas de push sur main · pas de `--update-snapshots` sans inspection · jamais de test skip/only · jamais de schéma Supabase modifié · jamais d'hex hors allowlist · jamais de chiffre recopié sans remesure · jamais « validé » pour une étape non exécutée · toute ambiguïté = `docs/H_BLOCKERS.md`, jamais une invention.
