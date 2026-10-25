# Plan d'exécution — CHANTIER Y « HUB VOYAGE UNIQUE »

Source de vérité : `unification.md` (chantier Y, v1.0). Ce plan est la mise en œuvre
adaptée à l'état réel du dépôt vérifié à l'instant, avec une **pré-phase obligatoire**
absente du document car elle n'existait pas quand il a été rédigé.

---

## ⚠️ Trois écarts entre le document et la réalité (vérifiés)

1. **46 fichiers modifiés non commités** sur `chantier/x-design-unique` — tout le
   travail de la session écoulée (unification Liquid Glass du module `/voyages`,
   fond canopée central, 7 correctifs de sécurité, migration RLS écrite).
   Le document part d'un arbre propre à `ce605ac0`. Il faut commiter/pousser ce
   travail **avant** Y0.1, sinon la fusion de la PR #31 l'abandonnerait.
2. **`gh` indisponible** → Y0.1 (fusion PR #31) ne peut pas être une action API de
   l'agent. Je prépare tout (corps de PR corrigé, portes vertes) ; **la fusion est un
   clic manuel de Tony**. Idem pour la protection de branche (§0.1 du doc).
3. **Y0.7 (sécurité) est déjà réalisé à ~70 %** : l'audit complet du module voyages a
   été fait en session (3 HIGH / 8 MEDIUM / 7 LOW, 7 correctifs appliqués, migration
   `20260907010000_trips_rls_hardening.sql` écrite mais **non appliquée**).
   `docs/Y_SECURITY.md` partira de ce rapport ; restent à vérifier : `tripOfflineStorage.ts`
   (données en clair), grep `service_role` côté client, `share_token` (journalisation),
   exposition `visibility: public`.

Autres recoupements utiles : les violations Y-D80 attendues en Y1.5 sont déjà
inventoriées en session (TripSyncStatusIndicator 16 classes froides, ActiveTripBanner
`bg-emerald-*` + `min-h-[32px]`, `ai-configurator/page.tsx` hex en dur, `window.print`
de `PaysLeftSidebar`) → Y3.5. Le correctif `#main-content` de `tailwind.css` et le
travail BottomTabBar déjà faits anticipent une partie de Y2.

---

## Pré-phase Y-pré — Sécuriser le travail de session (bloquant, ~1 h)

1. **Tri des fichiers** : ne pas commiter `Nouveau Document texte.txt` (parasite) ni
   `shots/` (artefacts de capture) ; déplacer `shot.mjs` → `scripts/dev/` ou l'ignorer ;
   `unification.md` → commité comme document de chantier.
2. **Commits atomiques** (convention §7.3 du doc, un commit par domaine, portes citées) :
   - `feat(voyages): unification Liquid Glass — vues cockpit, modales, planificateur, wizard, hub`
   - `fix(design): fond #main-content transparent (canopée visible au centre) + plateau BottomTabBar sous-pages`
   - `fix(security): webhook fail-closed, JSON-LD échappé, .or() paramétrés, share_token vérifié et non exposé, kit-actions zod+auth, carnet ownership, gpx force-dynamic`
   - `chore(db): migration RLS hardening H2/M4/M5/M7 (ÉCRITE, NON APPLIQUÉE)`
   - `docs(y0): unification.md chantier Y`
3. **Portes sur la branche** : G1 `type-check` (0 erreur), G2 `npm test` (≥ 942 tests),
   G3 design suite (81/81). Puis push `chantier/x-design-unique`.
4. **PR #31** : corriger le corps (vraies polices Manrope/DM Sans/IBM Plex Mono/
   Instrument Serif ; rayons 6/10/14/20/26/28/32 ; conclusion visuelle honnête) et
   l'étendre au nouveau commit. **Fournir à Tony le lien de fusion manuelle.**
5. Point d'arrêt : **Tony fusionne #31** → alors création de `chantier/y-hub-voyage`
   depuis le nouveau `main` (Y0.1 achevée).

---

## Y0 — Fondations et arbitrages (bloquant, §6 du doc)

- **Y0.0 Relevé de l'état réel** : lecture AGENTS/CLAUDE/DESIGN_SYSTEM/HANDOFF/
  DESIGN_TRUTH ; listing `.agents/skills/` vs §0.3 ; inventaire complet régénéré →
  `docs/Y_INVENTORY.md` ; six portes exécutées = **références de départ** horodatées.
- **Y0.1 Fusion PR #31** : voir Y-pré. Blocage assumé si Tony ne fusionne pas →
  `docs/Y_BLOCKERS.md`, poursuite sur sous-phases indépendantes (Y0.2–Y0.5 ne
  dépendent pas de la fusion).
- **Y0.2 Quatre arbitrages + 2 secondaires** : diff fonctionnel écrit pour chacun
  (itinéraire : planner vs tab ; ConfiguratorWizard mort ? ; barres mobiles ;
  ResumeActiveTripCard ; carte section-vs-mode ; scrollbar). Sorties de commandes
  collées → `docs/Y_DECISIONS.md`.
- **Y0.3 Spéc** : `docs/Y_HUB_SPEC.md` (4 zones, 11 sections, 12 widgets, matrice
  profil×section, recettes §0.7, durées/courbes/z-index de liquid-glass.css).
- **Y0.4 Seed déterministe** : `scripts/seed/seed_y_profiles.mjs`, 8 slugs fixes
  (`y-day-solo` … `y-exped-group`) ancrés au 01/06/2026, idempotent, `seed:y`.
  Prérequis : vérifier la configuration Supabase de l'environnement avant.
- **Y0.5 Outillage capture** : `tests/visual/_helpers/prepareVisualPage.ts` (horloge
  figée, consentement, masques **nommés** `[data-visual-mask]`) ; `scripts/visual/
  contact-sheet.mjs` + `visual:sheet` ; `tests/a11y/` + `test:a11y` (axe) ; projet
  `ipad-portrait` 834×1194. Planche « avant » committée = référence du chantier.
- **Y0.6 CI** : workflow GitHub exécutant G1–G4 + G6, G5 en artefact. Rappel explicite
  dans le rapport : **activer la protection de branche = action manuelle Tony**.
- **Y0.7 Sécurité** : `docs/Y_SECURITY.md` à partir de l'audit de session + les 4
  compléments listés ci-dessus. Risques confirmés → sous-phases Y8.3.
- **Y0.8 Go/No-Go** : zéro `❓` restant, preuves complètes → tag `y0-done`, MISSION_LOG.

---

## Y1 — Moteur de profil et registres (TDD strict, §6 Y1)

1. **Y1.1 Tests AVANT le code** : `tripProfileEngine.spec.ts` (~60 tests — 8
   combinaisons matrice, bornes d'échelles 1/2/4/5/14/15, 7 activités, cas limites,
   assertion sur sections + widgets + `reason`). Rouge attendu et consigné.
2. **Y1.2** `engine/tripProfileEngine.ts` + type `TripProfile` (fonction pure,
   **horloge injectée**). Vert 60/60.
3. **Y1.3/Y1.4** `tripSectionRegistry.ts` (11 sections + `tripSectionHref` typé) et
   `tripWidgetRegistry.ts` (12 widgets) + tests d'unicité/hauteurs.
4. **Y1.5** `tests/design/y-d80-guard.spec.ts` — 12 règles, périmètre élargi
   (trips + voyages + groupes + ai-configurator), report fichier:ligne:extrait.
   Rouge attendu sur les violations connues → `docs/Y_VIOLATIONS.md`.
5. **Y1.6** tag `y1-done`, MISSION_LOG.

---

## Y2 → Y9 — Séquence (le document fait foi)

- **Y2 Layout unique** : `TripSidebarRight` générique → `layout.tsx` de segment →
  `TripSidebarLeft` sur le registre (11 sections, permissions complètes dont
  `budget`/`canManageBudget`) → `TripSectionPicker` → migration de `page.tsx`.
  Diff visuel sidebar attendu **0 px** sur les 7 sections existantes.
- **Y3 Dédoublonnage** (7 commits isolés, revenables) : sidebars gauches, statut
  réseau unique (`TripNetworkStatus`), `ActiveTripSwitcher` (cmdk + GlassSheet),
  arbitrage en-têtes, **Y3.5 = Y-D80 12/12 vert**, suppression code mort (grep collé).
- **Y4 Les 11 sections** (parallélisable sur sections terminales uniquement, 3 agents
  worktree) — dont 2 nouvelles : `securite` (TripSafetyCheckpoint) et `journal`
  (TripNote), données existantes jamais exposées.
- **Y5 Navigation** (liste enrichie, mémoire de section, mobile, retour Android).
- **Y6 Fusions modules** (configurateur en panneau dans `gear`, ponts
  materiel/groupes/pays — le stock jamais muté par le voyage).
- **Y7 App-first** (safe-areas, cibles ≥ 44 px mesurées runtime, haptique, offline
  dexie **documents exclus du cache**, status-bar).
- **Y8 Qualité** (axe 0 critical/serious ; perf : dynamic imports three/maplibre/
  leaflet/recharts, budgets JS < 250 ko gzip, LCP < 2,5 s ; sécurité = appliquer la
  migration après validation sur copie + H1 complet + M8 ; revue croisée).
- **Y9 Recette** : 6 portes + 5 parcours, planche finale 74 captures vs « avant »,
  `docs/Y_REPORT.md` au modèle §9 (valeurs **réellement mesurées**, jamais recopiées),
  PR puis fusion après revue.

---

## Conditions d'arrêt appliquées telles quelles (§7.4 du doc)

Migration schéma nécessaire · contraste non résoluble · diff visuel hors périmètre
(`/pays`, `/materiel`, `/compte`) · compteurs de tests en baisse · porte échouée 3× ·
ambiguïté du document · décision Y0.2 faussée à l'usage · risque sécurité nouveau ·
dépendance nouvelle. Chaque arrêt → `docs/Y_BLOCKERS.md` + poursuite sur la
sous-phase indépendante suivante.

## Décisions réservées à Tony (hors périmètre agent)

1. Fusion manuelle de la PR #31 (gh indisponible).
2. Activation de la protection de branche GitHub (30 s, transforme les portes en garanties).
3. Application de `20260907010000_trips_rls_hardening.sql` après validation sur copie.
4. Statut de la PR #30 (chantier U) : fusionner / fermer / rebaser.
