# Y_HANDOFF — Passation de main (chantier Y, hub voyage unique)

> Écrit le 08/09/2026 par le session précédente. À lire **intégralement** avant toute
> écriture de code. Ce document = prompt de démarrage + état réel + tout le reste à faire.
> La source de vérité reste `unification.md` (le plan originel) + `docs/Y_HUB_SPEC.md`
> + `docs/Y_DECISIONS.md` (les arbitrages tranchés). En cas de contradiction : ce doc-ci,
> puis les trois ci-dessus, puis le code fait foi.

---

## 1. IDENTITÉ DU CHANTIER (état réel vérifié, non recopié)

| Champ | Valeur |
|---|---|
| Branche de travail | **`chantier/x-design-unique`** (⚠️ PAS `y-hub-voyage` — voir §3) |
| HEAD commit | `4c2c0518` — `feat(y4): widgets colonne droite pour les onze sections` |
| Tags posés | `y1-done`, `y2-done`, `y3-done` |
| Arbre de travail | **propre** (seuls des fichiers Obsidian non suivis traînent, ne pas toucher) |
| Cible finale | `main` (fusion manuelle côté GitHub, voir §3) |
| Mode | Agent autonome total, arrêt uniquement sur conditions §7.4 de `unification.md` |
| Doctrine | App-first (Capacitor 8), mobile 430×932 prioritaire |

### Portes (à rejouer à CHAQUE sous-phase)
```
G1 npm run type-check        G2 npm test          G3 npm test -- y-d80
G4 npm run build             G5 npm run test:visual   G6 npm run test:a11y
```
- G4 **sans `.env.local`** (le build doit passer sans lui). Penser à le déplacer/retirer temporairement si présent.
- G2 : le compteur de tests ne descend **jamais** sans déclaration.
- G3 : **12 règles Y-D80**, actuellement 12/12 vertes — le garde-fou est `tests/design/y-d80-guard.spec.ts`.
- G5 : `--update-snapshots` **jamais sans inspection** des diffs. Références = commits séparés justifiés.
- G6 : scan axe `critical`/`serious` = 0.

### État des portes au dernier commit (`4c2c0518`)
G1 ✅ · G2 ✅ 1020/1020 · G3 ✅ 12/12 · G4 ✅ build prod (routes `/voyages/[slug]/…` à ~160-185 kB First Load, cible Y8.2 = <250 kB) · clé d'entrevue.

---

## 2. CE QUI EST DÉJÀ FAIT (ne pas refaire)

**Y0** (fondations, sauf fusion PR) : inventaire `Y_INVENTORY.md`, 6 arbitrages trancés
dans `Y_DECISIONS.md`, spec `Y_HUB_SPEC.md`, seed `seed:y` (8 voyages `y-*` déterministes),
outillage capture (`prepareVisualPage`, `contact-sheet.mjs`, `playwright.a11y.config.ts`,
projet `ipad-portrait`), CI étendu, audit sécurité `Y_SECURITY.md` (R7 corrigé).
⛔ `B1` : fusion PR#31 impossible par agent (`gh` absent) → **clic manuel Tony**.
Migration RLS `20260907010000_trips_rls_hardening.sql` **écrite, NON appliquée** (validation sur copie requise avant).

**Y1** (tag `y1-done`) : `tripProfileEngine.ts` (TDD, 53 tests) — `deriveTripProfile(trip, now)` →
`TripProfile {scale, party, autonomy, activity, hasDates, hasBudget, isCollaborative,
sections, widgets, density, reason}`. Registres : `tripSectionRegistry` (10 sections —
la carte est un **mode** de `itinerary`, arbitrage 5) + `tripWidgetRegistry` (12 widgets,
priorités, `WIDGET_COLUMN_MAX_HEIGHT`). Garde-fou `y-d80-guard.spec.ts` 12 règles.

**Y2** (tag `y2-done`) : layout de segment `src/app/voyages/[slug]/layout.tsx` (charge le
voyage une fois, phase+profil, monte le shell) ; `TripHubShell.tsx` (unique : colonne gauche
260px / droite 300px / centre, `TripCompactHeader` sur toutes les sections sauf overview,
`ActiveTripSwitcher` + `TripNetworkStatus` en tête, `TripShareModal`, mobile via
`MobilePageShell` + BottomTabBar URL) ; `TripSidebarLeft` (pilotée par le registre, 10 sections,
`Link`+`tripSectionHref`, actif par pathname, permissions budget/docs appliquées, déclencheur
picker) ; `TripSidebarRight` générique (lit le registre, tri par priorité, repli) + widgets
Countdown/OfflineToggle ; 6 routes nouvelles (equipage, budget, documents, checklist,
securite, journal) + kit/itineraire/export/overview sous le layout ; loading/error/not-found.

**Y3** (tag `y3-done`) : dédoublonnage 7 sous-phases — sidebars gauches supprimées (règle 10),
`TripNetworkStatus` unique + abstraction réseau (règle 8), `ActiveTripSwitcher` cmdk+GlassSheet
(remplace `ActiveTripBanner`, contexte étendu + `/api/voyages/mine`), arbitrage des en-têtes
(3 cartes métriques → widgets, `CountryCard`), **Y3.5 jalon G3 : 12/12 vert**, code mort supprimé
(KitSidebarRight + ItinerarySidebarRight, 5512 o).

**Y4 partiel** (commit `4c2c0518`) : les **12 widgets de la colonne droite** sont implémentés et
intégrés dans `TripSidebarRight` (liste complète §3 de `Y_HUB_SPEC.md`) :
`src/features/trips/components/widgets/*.tsx` → Countdown, OfflineToggle, CountryCard,
PrimaryAction, Alerts, NextStep, SafetyNext, KitchenBalance, BudgetBurn, GroupPresence,
TripContext, DocsExpiry. L'hôte `TripSidebarRight` reçoit `activeSection` (CTA contextuel) et
dérive l'altitude max des étapes. Tous wildfire. Portes vertes ci-dessus.

---

## 3. CONTRAINTES NON NÉGOCIABLES

1. **Jamais pousser sur `main`.** La branche n'est pas protégée (vérifié) → aucune porte
   n'est opposable côté serveur ; la discipline est auto-appliquée.
2. **`gh` est indisponible** sur cet environnement (vérifié plusieurs fois). Toute action
   GitHub (fusion PR #31, création `chantier/y-hub-voyage`, fusion finale vers `main`,
   activation protection de branche) = **action manuelle Tony**, à signaler dans le rapport.
   Les commits/pushes se font en local sur `chantier/x-design-unique` (pas de push requis pour la suite autonomisable).
3. **Convention de commit** : `<type>(y#): pourquoi` · corps : ce qui change/why ·
   `Portes : G1 ✅ G2 ✅ (n) G3 ✅ (12/12) G4 ✅ G5 ✅ G6 ✅` · `Preuves : <sorties>`.
   Types : feat/fix/refactor/test/docs/perf/chore. Un commit par sous-phase. Jamais fourre-tout.
4. **Interdits absolus** (§7.2 `unification.md`) : jamais `--update-snapshots` sans inspection ;
   jamais ignorer/skip un test ; jamais réduire le nombre de tests sans déclaration ;
   jamais modifier un token hors `docs/DESIGN_TRUTH.md` ; jamais de dépendance nouvelle sans
   justification ; jamais toucher au schéma Supabase ; jamais recopier un chiffre sans revérifier ;
   jamais écrire « validé » pour une étape non exécutée.
5. **Conditions d'arrêt** (§7.4) : écrire dans `docs/Y_BLOCKERS.md`, puis **poursuivre sur une
   sous-phase indépendante si elle existe**. Stop total seulement si rien n'est indépendant.
6. **Workflow par sous-phase** : relire le bloc dans `unification.md` → relire les fichiers
   **dans leur état actuel** → écrire/modifier → exécuter les portes (max 2 corrections, puis arrêt)
   → régénérer/inspecter les captures → committer → `MISSION_LOG.md` → suivant.

---

## 4. RÉCAP DES ARBITRAGES TRANCHÉS (Y0.2 — ne pas re-décider)

1. **Itinéraire** : garder `ItineraryPlannerClient` (éditeur, route `/itineraire`) **et**
   `TripItineraryTab` (lecteur) — pas de suppression. En Y4.2, l'onglet perd son bouton
   « Régénérer » (le garder dans l'état vide) et renvoie l'édition vers le planner.
2. **ConfiguratorWizard.tsx** : **VIVANT** (importé par `ai-configurator/page.tsx`). Devient en
   Y6.1 le panneau invocable depuis `gear` (contrat `TripKitAnalysis`/`ContextualGearRecommendation`).
3. **Barres mobiles** : `PersistentMetricsBar` monté **seulement** dans `autoGen/AutoGenTripView`
   (hors hub) → conservé tel quel, hors périmètre. `MobileNavWrapper` = nav primaire.
4. **ResumeActiveTripCard** : conservé (usage = page d'accueil site-wide, pas une surface hub).
5. **Carte** : **mode d'affichage de `itinerary`** (pas de 11e section, pas de 4e moteur).
   Registre = 10 sections.
6. **Scrollbar** : `no-scrollbar` partout dans le cockpit (aligné sur `/materiel`).

---

## 5. RESTE À FAIRE — TOUT, POUR 100 %

### PHASE Y4 — LES ONZE SECTIONS (12-16 h, en cours)

Note : les 11 sections sont déjà **câblées** sous le layout (fichiers de route dans
`src/app/voyages/[slug]/`). Ce qui reste = revue/correction de chaque VUE contre le pattern +
outillage de capture + convergence.

> ⚠️ Un audit des 11 vues avait été lancé dans la session précédente mais **n'a pas rendu son
> rapport** (agent perdu). **À relancer d'abord** : vérifier chaque vue contre le pattern
> (a) pas de shell/sidebar remonté localement ; (b) pas d'en-tête dupliqué (le shell fait déjà
> `TripCompactHeader` / `TripHero` sur overview) ; (c) états vides via `EmptyState` ;
> (d) permission vérifiée **côté serveur** (docs → `canViewDocuments`, budget →
> `canManageBudget`) ; (e) garde-fou Y-D80 (aucune classe froide/hex/`window.print`/`<h1>` double).

Fichiers de route (à auditer + corriger chacun) → composant de vue :
- `page.tsx` → `TripOverviewClient` (must montrer `TripHero`, max 3 infos synthèse) — **Y4.1**
- `itineraire/page.tsx` → `ItineraryPlannerClient` (+ retire "Régénérer" de l'onglet lecteur) — **Y4.2**
- `kit/page.tsx` → `TripKitView` (+ intégration configurateur, + sélecteur `inventory_item_id`) — **Y4.3**
- `equipage/page.tsx` → `TripTeamView` — **Y4.4**
- `budget/page.tsx` → `TripBudgetView` (+ répartition par tête si party≠solo) — **Y4.5**
- `documents/page.tsx` → `TripDocumentsView` (permission serveur) — **Y4.6**
- `checklist/page.tsx` → `TripChecklistView` — **Y4.7**
- `securite/page.tsx` → `TripSafetyView` (section **nouvelle** : `TripSafetyCheckpoint`
  tableau — liste chronologique, statuts pending/checked/missed/alert_sent, pointage, contact
  appelable, hors-ligne) — **Y4.8**
- `journal/page.tsx` → `TripNotesView` (notes par jour, épinglage, auteur) — **Y4.9**
- `export/page.tsx` → `ExportClientView` (remplacer `window.print` par action dédiée, vérifier
  qu'un export public ne fuite ni docs/dépenses/identités) — **Y4.10**
- `overview` = `page.tsx` (fait-local au-dessus) — **Y4.1**

Priorité : **exécuter l'audit des 11 vues (relance), corriger, puis** :
- **Étendre les scans a11y** : `tests/a11y/e2e/voyages-a11y.spec.ts` — `SURFACES` ne couvre que
  6 routes ; ajouter les sections (utiliser un slug qui les possède, ex. `y-exped-group`).
- **Créer les specs visuels profils `y-*`** : `tests/visual/` — cibler les slugs `y-day-solo`,
  `y-long-group`, `y-exped-solo` (3 profils représentatifs §5.3) sur les surfaces + états
  particuliers (hors-ligne, section vide, permission refusée, sélecteur ouvert, GlassSheet
  mobile, chargement, erreur, panneau configurateur). Total visé ~74 captures (§5.3).
- Régénérer la **planche de contact** : `npm run visual:sheet` → `docs/visual/contact-sheet.html`.
- Tag **`y4-done`**, entrée `MISSION_LOG.md`.

### PHASE Y5 — NAVIGATION GLOBALE (4-5 h)
- **Y5.1** `/voyages` liste enrichie : intégrer le sélecteur (`ActiveTripSwitcher`), ajouter un
  filtrage par **profil dérivé** (scale/party) à `VoyagesClient.tsx` (filtres actuels :
  recherche/difficulté/activité/statut dans `TripFiltersBar`), `TripCard` affichant le profil.
  Conserver `IOSSegmentedControl` public/personnel.
- **Y5.2** Mémoire de section : dernière section visitée par voyage persistée (revenir sur un
  voyage rouvre là où on était) — étendre `ActiveTripContext` (§2.4).
- **Y5.3** Navigation mobile alignée sur le hub : `GlassSheet` de sections, gestes ≥ 44 px +
  accès clavier, `useHapticFeedback()` sur transitions.
- **Y5.4** Retour matériel Android : `@capacitor/app` intercepte, remonte la hiérarchie
  section → aperçu → liste → sortie. Jamais sortie d'app depuis une section.
- Portes G1-G6 + parcours 2 et 3.

### PHASE Y6 — FUSION DES MODULES (5-7 h)
- **Y6.1** Configurateur en panneau depuis `gear` : `KitConfiguratorWizard` invocable, préchargé
  avec activité/échelle/destination/altitude maximale (issues des `steps`). Contrat
  `TripKitAnalysis`/`ContextualGearRecommendation`. Aucune question dont la réponse est déjà
  dans le voyage.
- **Y6.2** Route `/ai-configurator` conservée en mode découverte sans voyage (ou redirigée) ;
  violations tokens déjà corrigées en Y3.5, à vérifier.
- **Y6.3** Pont matériel : sélecteur d'inventaire dans `gear`, écrit des `TripItem` avec
  `inventory_item_id`. **Le stock n'est jamais consommé/modifié par le voyage** — seulement
  référencé. Vérifier les 7 sous-routes de `/materiel` intactes.
- **Y6.4** Pont groupes : `/groupes` conservé liste ; `/groupes/[groupId]` renvoie vers le
  voyage quand il en existe un ; audit `page.tsx` (39 935 o).
- **Y6.5** Pont pays : widget `country-card` relie voyage → `/pays/[code]` (déjà en place).

### PHASE Y7 — APP-FIRST (4-6 h, skills claude-android-skill, ux-mobile, interaction-design)
- **Y7.1** Zones sûres `env(safe-area-inset-*)` sur les 11 surfaces × portrait/paysage via
  `AppShell`/`MobilePageShell` exclusivement (preuve capture).
- **Y7.2** Cibles tactiles ≥ 44 px mesurées par Playwright sur toutes les surfaces (la règle 6
  ne détecte que les `min-h-[…]` littéraux ; mesurer le reste au runtime).
- **Y7.3** Haptique `useHapticFeedback()` sur validation, suppression, pointage de sécurité,
  changement de section ; respect `prefers-reduced-motion`.
- **Y7.4** Hors-ligne complet → consolidation vers `dexie` selon audit Y0.7 ; 11 sections
  consultables hors-ligne ; file de sync avec résolution de conflit documentée ;
  **documents exclus du cache local** si risque confirmé.
- **Y7.5** `@capacitor/status-bar` accordé aux tokens ; `splash-screen` cohérent.
- Portes G1-G6 + parcours 4.

### PHASE Y8 — QUALITÉ (6-8 h)
- **Y8.1** A11y : `test:a11y` vert sur 11 surfaces × 3 viewports ; focus visible ; `aria-live`
  ; un seul `h1` ; contraste ≥ 4,5:1 (si un ratio échoue → **réduire la translucidité, jamais
  assombrir le texte**) ; nav clavier complète du hub + sélecteur.
- **Y8.2** Perf : imports dynamiques de `three`, `react-globe.gl`, `maplibre-gl`, `leaflet`,
  `recharts` (5 libs lourdes) ; audit des gros fichiers (`blueprintRegistry` 46 887 o,
  `PaysPratiqueView` 40 910 o, `groupes/page` 39 935 o, `BouteilleALaMer` 41 553 o,
  `MobileCountryDetailView` 28 188 o) ; budget JS par route < 250 kB gzip ; LCP < 2,5 s en 4G sim ;
  nav entre sections < 200 ms ; virtualisation `@tanstack/react-virtual` sur listes > 50.
  Tableau avant/après par route mesuré.
- **Y8.3** Sécurité : corriger chaque risque de `Y_SECURITY.md` « Reste à traiter » (H1-complet,
  M8 CSRF/lien partage privé, L1-L3, L6) ; chaque mutation vérifie la permission côté serveur ;
  tester parcours 5 ; vérifier `share_token` ; voyage `public` n'expose rien de privé.
- **Y8.4** Revue de code complète du diff `main…chantier/x-design-unique` ; chaque remarque
  traitée/justifiée par écrit.

### PHASE Y9 — RECETTE ET FUSION (3-4 h)
- **Y9.1** Les 6 portes intégralement, sans `.env.local` pour G4, zéro test ignoré, compteur ≥
  référence Y0.0 (1008). Les 5 parcours (§5.4 `unification.md`) + mention du test natif
  (exécuté OU mention explicite de non-exécution — jamais « validé » à la place).
- **Y9.2** Planche de contact finale ~74 captures, régénérées, inspectées une à une vs planche
  « avant » (Y0.5, 38 captures). Toute différence non intentionnelle = défaut.
- **Y9.3** Rapport `docs/Y_REPORT.md` selon modèle §12 (identité, décisions, suppressions,
  plaque Y-D80, contrastes, visuel, a11y, perf, sécurité, parcours, natif, compteurs, sorties
  brutes des 6 portes, reste ouvert).
- **Y9.4** Corps de PR généré depuis le rapport, **avec les valeurs réellement commitées**
  (ne pas recopier `unification.md`).
- **Y9.5** Fusion vers `main` : **manuelle Tony** (gh absent) — vérifier SHA final par appel API.

---

## 6. RAPPELS D'ENVIRONNEMENT & PIÈGES

- **Windows** : shell PowerShell (cmdlets) + outil Bash disponible. Chemins avec `[`/`]`
  (ex. `src/app/voyages/[slug]/`) : **toujours entre guillemets** en Bash/PS ou `git log --`
  car le shell peut interpréter les crochets.
- **CRLF warning git** : normal (LF→CRLF), sans gravité.
- **Ne pas toucher** : les fichiers `.obsidian/*` (non suivis), `.env.example`, `tsconfig.json`
  (sauf nécessité globale), scripts npm `dev`/`build` sacrosaints (sauf ajout `seed:y`,
  `visual:sheet`, `test:a11y` déjà présents).
- **Skills** demandées par phase (à invoquer via le mécanisme Skill si dispo) :
  Y4 `dispatching-parallel-agents`, `subagent-driven-development`, `apple-ui-designer`,
  `interaction-design`, `lkdv-development` ; Y5 `ux-mobile`, `interaction-design`,
  `claude-android-skill` ; Y6 `lkdv-development`, `code-quality`, `ai-engineering-toolkit` ;
  Y7 `claude-android-skill`, `ux-mobile`, `interaction-design`, `apple-ui-designer` ;
  Y8 `nextjs-performance`, `code-quality`, `requesting-code-review`, `receiving-code-review`,
  `claude-seo` ; Y9 `verification-before-completion`, `finishing-a-development-branch`,
  `github-workflow`. `verification-before-completion` active en permanence.
- **Timing** : partir de la **relance de l'audit des 11 vues** (Y4), c'est le goulot immédiat.
- Les **5 parcours e2e** de §5.4 sont décrits dans `unification.md` (création+kit, changement
  rapide de voyage, adaptation du profil, hors-ligne unicité réseau, permissions viewer).
  Un spec e2e existe : `scripts/e2e/voyage.spec.ts` — l'étendre plutôt que dupliquer.

---

## 7. LIVRABLES FINAUX ATTENDUS (checklist 100 %)
- [ ] Y4 : audit 11 vues → corrections → a11y étendu → specs visuels y-* → planche → tag `y4-done`
- [ ] Y5 : liste `/voyages` profil, mémoire section, nav mobile, retour Android → tag `y5-done`
- [ ] Y6 : configurateur panneau gear, route configurateur, ponts matériel/groupes/pays → tag `y6-done`
- [ ] Y7 : app-first complet → tag `y7-done`
- [ ] Y8 : a11y + perf + sécu + revue → tag `y8-done`
- [ ] Y9 : 6 portes + 5 parcours + planche 74 + `Y_REPORT.md` + PR + fusion main (manuelle)
- [ ] `MISSION_LOG.md` mis à jour à chaque fin de phase
- [ ] Rapports `Y_DECISIONS.md`, `Y_SECURITY.md`, `Y_BLOCKERS.md`, `Y_INVENTORY.md` cohérents

*Fin du document de passation — bonne route.*
