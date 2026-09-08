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

---

## 8. MATRICE SKILLS & AGENTS — QUI, QUAND, POURQUOI

### 8.1 Principes d'orchestration (autonomie 100 %)

1. **Une sous-phase = un cycle** : lire le bloc du plan → relire les fichiers concernés en l'état (jamais de mémoire) → charger les skills déclarées → exécuter → portes → captures → commit → `MISSION_LOG.md` → suivante. Aucune exception.
2. **Skills = chargeables à la demande**. Avant chaque sous-phase, l'agent charge les skills de sa ligne dans la matrice ci-dessous avec `skill_view` et les suit scrupuleusement. Si une skill référencée est absente de `.agents/skills/`, consigner dans `docs/H_BLOCKERS.md` et poursuivre sans — jamais improviser un équivalent.
3. **Icon-agents = perspectives de revue**, pas d'exécution. Les agents `.claude/agents/` (Dieter Rams, Kent Beck, Linus Torvalds, Bruce Schneier…) sont invoqués comme **revues adversariales** à la fin des sous-phases indiquées : l'agent soumet son diff au regard du persona et consigne les objections dans le commit ou les corrige. Une objection non traitée = arrêt.
4. **Parallélisation** : `dispatching-parallel-agents` / `subagent-driven-development` uniquement sur les sections terminales de H4. Jamais sur registres, layout, coquille ou bottom bar (conflit garanti, leçon Y2).
5. **Arbitrage en autonomie** : si l'agent doit choisir entre deux options techniques valides, il choisit, écrit la décision + justification dans `docs/H_DECISIONS.md` et poursuit. Il ne s'arrête que sur les conditions de §9.3.

### 8.2 Matrice par phase

| Phase | Skills (à charger avant de commencer) | Icon-agents (revue en fin de phase) |
|---|---|---|
| **H0** Prérequis | `verification-before-completion`, `lkdv-development`, `using-superpowers`, `finishing-a-development-branch`, `github-workflow` | — (lecture seule) |
| **H1** Moteur & registres | `test-driven-development`, `testing-anti-patterns`, `code-quality`, `writing-plans` | **Kent Beck** (TDD et frontières de conception), **Leslie Lamport** (pures fonctions, invariant du registre) |
| **H2** Contexte & sélecteur | `apple-ui-designer`, `interaction-design`, `ux-mobile`, `code-quality` | **Jonathan Ive** (sélecteur : simplicité radicale), **Susan Kare** (icônes & états vides) |
| **H3** Coquille & nature sortie | `nextjs-performance`, `executing-plans`, `lkdv-development`, `apple-ui-designer` | **Dieter Rams** (invariance des 4 zones — « moins mais mieux »), **Jakob Nielsen** (constance, heuristiques) |
| **H4** Possession & collectif | `dispatching-parallel-agents`, `subagent-driven-development`, `apple-ui-designer`, `interaction-design`, `ux-mobile` | **Edward Tufte** (densité d'information widgets), **Don Norman** (affordances, gestion du monolithe groupes) |
| **H5** Bottom bar, IA, redirects | `apple-ui-designer`, `interaction-design`, `ux-mobile`, `ai-engineering-toolkit` | **Jakob Nielsen** (reconnaissance vs rappel — redirects & hamburger), **Alan Kay** détecté absent du pod Programming → remplacé par **Brendan Eich** (perf bundle) |
| **H6** App-first | `claude-android-skill`, `ux-mobile`, `interaction-design`, `apple-ui-designer` | **Kat Holmes** (inclusion — cibles 44 px, safe areas) |
| **H7** Qualité | `nextjs-performance`, `code-quality`, `security-audit`, `requesting-code-review`, `receiving-code-review` | **Linus Torvalds** (revue de code sans complaisance), **Bruce Schneier** (revue sécurité), **Steve Jobs** absent du pod → la revue produit est couverte par Rams/Norman |
| **H8** Recette | `verification-before-completion`, `finishing-a-development-branch`, `github-workflow` | **Barbara Liskov** (contrats respectés — les 5 parcours), revue finale **adversariale** sur le modèle du prompt d'audit Y |

### 8.3 Skills transverses (permanentes, toute sous-phase)

- `verification-before-completion` — active en permanence ; aucune sous-phase close sans ses preuves.
- `systematic-debugging` + `root-cause-tracing` — chargées à la première porte rouge, avant tout correctif. Un correctif sans cause racine identifiée est interdit.
- `using-git-worktrees` — obligatoire pour tout travail parallèle H4.
- `executing-plans` — discipline de séquence H0→H8, jamais de saut de phase.
- `lkdv-development` — conventions projet (dual-view, palette, RLS) en permanence.
- Non retenues : les ~30 skills `seo-*` (hors périmètre), `obsidian-*`, `defuddle`, `json-canvas`, `map-geospatial` (aucune géométrie nouvelle dans H ; PostGIS déjà servi), `brainstorming` (le brainstorm est ce document — H est exécution, pas conception). Si H3 touche la carte de l'itinéraire, `map-geospatial` se charge alors, ponctuellement.

---

## 9. MODE AUTONOME 100 % — PROTOCOLE D'EXÉCUTION SANS INTERVENTION

### 9.1 Contrat

L'agent exécute H0→H8 intégralement sans question, sans validation intermédiaire, sans pause. Il s'arrête **uniquement** sur les conditions de §9.3. Chaque décision prise seul est tracée. À l'arrivée : PR ouverte, portes exécutées, planche de contact, rapport `docs/H_REPORT.md` — tout doit être vérifiable par Tony sans relire le travail, uniquement par les preuves.

### 9.2 Boucle d'exécution (invariante)

```
pour chaque sous-phase:
  1. relire son bloc dans ce document + CHANTIER Y §pertinents
  2. charger les skills de sa ligne (matrice §8.2)
  3. relire les fichiers cibles EN L'ÉTAT (git status propre exigé)
  4. TDD si code : tests d'abord, rouge consigné, puis implémentation
  5. exécuter les portes déclarées (G1–G6 selon phase)
     → échec: systematic-debugging → cause racine → corriger → max 2 ré-essais
     → 3e échec: STOP (§9.3)
  6. captures des surfaces touchées + planche de contact + INSPECTION réelle
     (apple-ui-designer / interaction-design appliqués à la lecture des captures)
  7. revue icon-agent de fin de phase (§8.2), objections consignées/traitées
  8. commit convention Y §7.3 (portes ✅ + preuves dans le corps)
  9. MISSION_LOG.md + tag h{n}-done
```

### 9.3 Conditions d'arrêt (les seules)

1. Une porte échoue 3 fois de suite malgré 2 cycles cause-racine/correction.
2. Une migration de schéma Supabase s'avère nécessaire (interdit absolu).
3. Une ambiguïté de ce document contredite par le code — consignée dans `docs/H_BLOCKERS.md`, l'agent bascule alors sur la sous-phase indépendante suivante si elle existe.
4. Un risque sécurité non anticipé (leak hors-ligne, permission non servie côté serveur).
5. Une régression visible sur `/pays`, `/compte` ou une surface hors périmètre.
6. Le compteur de tests baisse sans justification documentable.

Sur arrêt : `docs/H_BLOCKERS.md` complété (sous-phase, tentatives, sortie brute, hypothèses écartées, décision requise), commit, push, puis reprise de tout ce qui est indépendant. Un arrêt n'est jamais un abandon.

### 9.4 Comportements interdits en autonomie (rappel durci)

Jamais de question à l'utilisateur · jamais de choix par défaut silencieux sur une décision structurante (→ `H_DECISIONS.md`) · jamais de `--update-snapshots` sans diff inspecté élément par élément · jamais de test sauté pour forcer le vert · jamais de « validé » sans sortie de commande horodatée · jamais de valeur recopiée depuis ce document dans le rapport sans remesure · jamais de push sur `main` · jamais de suppression sans grep de preuve collé dans le commit.

### 9.5 Définition de « terminé » (DoD global)

Les 6 portes vertes sur le SHA final · 5 parcours × 2 viewports verts · axe 0 critical/serious · cibles ≥44 px mesurées runtime · planche de contact finale inspectée et comparée à l'« avant » · compteur de tests ≥ référence H0.3 · Z2 mergé · `/materiel` redirigé et ses 7 sections rendues par le hub · bottom bar à 5 accès avec hub central · switcher 3 natures fonctionnel clavier complet · H_REPORT.md sans valeur non mesurée · PR ouverte avec corps = chiffres réellement produits · **les exigences UX de la Partie 10 chacune tracée (capture, parcours ou test)**.

---

## 10. OPTIMISATIONS UX — LA GRAMMAIRE D'EXPÉRIENCE

Règle directrice : le hub ne doit jamais demander à l'utilisateur de « naviguer vers » son aventure ; il doit la lui présenter. Six principes, chacun décliné en exigences testables et rattaché à une phase.

### 10.1 Ouverture « réponse d'abord » (H3/H5)
- Le hub s'ouvre sur l'aventure active avec **ce qui compte maintenant** en tête (J-N, météo, prochaine action), pas un sommaire de tout.
- Choix de contexte par défaut **déterministe** : départ dans < 72 h → cette sortie ; sinon voyage actif (`lkdv_active_trip`) ; sinon inventaire (possession). Zéro IA bloquante au rendu.
- Perceived speed : données du contexte actif dans le payload du layout (pas de chaîne requête→skeleton→contenu à l'ouverture).
- Trace : capture G5 « hub ouvert aux 3 natures » + parcours 4 (retour = même contexte et même section après rechargement).

### 10.2 Ergonomie au pouce — thumb zone (H2/H5)
- Tab central = accès hub en un geste. **Appui long sur le tab central** → menu de raccourcis contextuels (nouvelle sortie, ajouter du matériel, reprendre l'itinéraire) calqué sur les Home Screen Quick Actions iOS, généré depuis le registre.
- Toute action fréquente dans le tiers inférieur de l'écran ; l'information seule en haut.
- Switcher : ouverture au **premier caractère tapé** (type-ahead comme les listes natives), sélection en un pouce, GlassSheet centré sur la zone de préhension.
- Trace : parcours 2 (changement de contexte) entièrement pilotable au pouce, vérifié en capture 430×932.

### 10.3 Continuité visuelle (H3)
- Transitions partagées `layoutId` entre tab bar, switcher et sections (pattern déjà posé dans `BottomTabBar`) ; direction **push** en profondeur / **dismiss** au retour sur mobile — jamais de « rechargement web » entre deux sections.
- Skeletons par section + streaming : le cadre apparaît instantanément, les données se remplissent ; jamais d'écran blanc ni de spinner plein écran hors première visite.
- Retour après édition : scroll et focus restaurés sur l'élément modifié (mémoire de position par section, même mécanique que la mémoire de section).
- Durées/courbes héritées de `liquid-glass.css` (`--dur-fast` 180 ms pour les transitions de section, `--ease-glass`) ; `prefers-reduced-motion` → fondu simple sans translation.
- Trace : test de navigation de section < 200 ms (Y8.2 reconduit), inspection des captures de transition sur la planche.

### 10.4 Feedback sans dialogues (H4)
- Actions destructives : exécution immédiate + toast **« Annuler » 5 s** (undo), au lieu d'une confirmation. Les dialogues natifs restent interdits (règle X-D70 reconduite).
- Langage haptique unique et sobre : `light` = sélection/navigation, `medium` = validation, `success` = objectif atteint, `warning` = destructif. Jamais deux retours sur un même geste, jamais de haptique sur un simple scroll.
- Badge du hub à **sens** : nombre d'actions bloquantes (à préparer, invitations expirant, matériel manquant au prochain départ), pas de notifications brutes.
- Trace : parcours 1 (undo d'une suppression testé au clavier et au pouce), assertion toast `aria-live`.

### 10.5 Intelligent sans interruption (H5/H6)
- Les `reason` du profileur ne s'affichent qu'**à la demande** (info-bulle « Pourquoi cette section ? » dans le picker) — l'adaptation se voit sans jacasser.
- **Phase live** (sortie en cours) : le hub bascule en mode cockpit — GPS plein écran, cibles ≥ 56 px, contraste renforcé (plein soleil), consultation hors-ligne native ; le vocabulaire des zones reste identique (invariance H-D85).
- Urgence : J-N < 72 h → compte à rebours en token `--lkv-warning-dark` #8C6418 et alertes remontées en tête de colonne droite.
- L'IA suggère le contexte et reformule les `reason`, mais n'ajoute ni ne retire jamais une section d'autorité (règle R5 du plan : le picker garde la main).
- Trace : capture « mode live », test hors-ligne du parcours 5, revue icon-agent Norman.

### 10.6 Vocabulaire et promesses (H1/H8)
- **Carte de vocabulaire** figée dans `hubSectionRegistry` : un concept = un mot partout (« Équipement », plus « matériel / kit / sac » selon les pages). Libellés FR constants ; mono réservée aux métadonnées, jamais aux libellés d'action.
- États vides = invitations : premier voyage创建able en 3 étapes depuis le hub ; inventaire vide → « importer depuis mes commandes » ; zéro écran mort.
- Accessibilité = qualité perçue : Dynamic Type respecté, `prefers-reduced-transparency` → surfaces pleines au lieu du verre, focus visible sur chaque cible (déjà G6, élevé au rang d'exigence UX et pas seulement réglementaire).
- Trace : test H-D85 règle 15 (unicité des libellés par concept dans les registres), captures d'états vides × 3 natures.

Chaque exigence ci-dessus reçoit une trace dans les livrables de recette (capture dédiée, parcours, ou test). Faute de trace, elle est déclarée — pas faite.
