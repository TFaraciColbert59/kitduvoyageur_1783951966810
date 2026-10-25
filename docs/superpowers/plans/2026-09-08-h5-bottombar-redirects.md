# H5 — Bottom bar, redirects, IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bottom bar 5 tabs avec hub central, délestage des doublons, redirects 307 des routes supprimées/fusionnées, hamburger cohérent, surcouche IA déterministe (suggestion, jamais restriction).

**Architecture:** 3 commits bar/redirects (tabs → délestage → redirects+suppressions) + 1 commit IA. Chaque suppression : grep d'entrants frais + retarget + redirect 307.

**Tech Stack:** Existants (framer-motion, haptics, cmdk). Middleware pour les redirects.

**Spec:** `docs/CHANTIER_H_HUB_VOYAGEUR.md` §2.4 + §3 + §9.2 (H5).

## Global Constraints

- Conservés : pilule layoutId, 44px, haptique, prefetch. Haptique medium sur hub, léger section (déjà).
- R11/R2nav BottomTabBar burnés (littéraux voyage supprimés c2, hex #5C6B5E → var c1).
- D6 : /carte-interactive GARDÉE (datasets distincts : trails PostGIS vs OSM live + générateur, chevauchement <70%).
- /gamification → /recompenses (mécaniques loyalty les plus proches).
- /materiel/*, /voyages/*, /groupes vivants (deep-links, H-AUTO-27) — seul /materiel racine redirige.
- /copilote vivante + CTA Assistant depuis les overviews (D7-partiel, fusion UI complète = backlog).
- IA : fonction pure + tests, affichée comme suggestion (jamais restrictive), zéro appel bloquant, offline-safe.

---

### Task 1 (commit 1) : 5 tabs, hub central

**Files:** `src/components/mobile-nav/BottomTabBar.tsx`
- DEFAULT_TABS[2] = `{ href: '/hub', label: 'Hub', iconName: 'tent', ariaLabel: 'Hub, mon aventure active', matchPaths: ['/hub', '/materiel', '/voyages', '/groupes', '/preparation', '/terrain'] }`.
- TabLink : `isHero` (icône 26 vs 22 + anneau accentué), conserve layoutId/44px/prefetch ; `handleClick` hub → `triggerHaptic('medium')`.
- prefetchData : `/hub` → prefetch `/api/hub/adventures` (staleTime 60s, miroir hikes).
- badgeFor('/hub') = `badges.materiel + (possession.alertsCount ?? 0)` via `useActiveAdventure()` (provider global).
- R2 : `#5C6B5E` (upper non-sélectionné) → `var(--lkv-text-muted)`.

- [ ] Implémenter → tsc + suite + capture mobile (hub actif sur /hub) → commit `feat(h5): bottom bar 5 tabs, hub central (1/3)`.

### Task 2 (commit 2) : délestage + hamburger

**Files:** `src/components/mobile-nav/BottomTabBar.tsx`
- Supprimer branches upper : isMaterielSection, isVoyageDetail, isGroupesHub, isGroupeCockpit (tabs, états, listeners `depart-section-change`, `kits-section-change`, `groupes-tab-change`, `groupe-cockpit-tab-change`, `hasUpperExtension`, `isWideUpperTray`, `currentUpperId`, `getUpperTabs`, `handleUpperTabSelect` — branches ; `tripSectionHref/sectionIdFromPathname/tripSectionRegistry/TripSectionId` imports si orphelins).
- Garder : messagerie, clubs±détail, carnets±détail, pays±détail, community, voyagesHub.
- Hamburger : Alertes → `/hub/alertes` (allègement + cohérence D4).
- Mesurer : taille fichier avant/après (cible −15–20 ko) ; grep : chaque identifiant supprimé à zéro dans le fichier.
- Burn R11 (retirer BottomTabBar de RULE_EXEMPTIONS si plus aucun littéral /voyages/).

- [ ] Implémenter → tsc + suite + H-D85 → capture (plus d'upper sur /materiel, /voyages/x, /groupes) → commit `refactor(h5): délestage upper extensions hub + hamburger (2/3)` avec preuves grep.

### Task 3 (commit 3) : redirects + suppressions

**Files:** `src/middleware.ts` (+ suppressions fichiers), liens internes retargetés.
- Redirects 307 : `/materiel`→`/hub` (exact), `/naviguer`→`/randonnee-active`, `/boussole`→`/randonnee-active`, `/preparation`→`/hub/preparation`, `/rapport-kit`→`/ai-configurator`, `/activite`→`/feed`, `/recommandations`→`/hub`, `/gamification`→`/recompenses`, `/alertes`→`/hub/alertes`, `/terrain`→`/hub`, `/mes-aventures`→`/hub`, `/encheres`→`/occasion` (si grep vide).
- Avant : grep frais d'entrants par route (`href="/x"`, `router.push('/x')`, `pathname === '/x'`, `startsWith('/x')`) ; retarget internes (ex. DepartMap→/preparer-randonnee déjà redirect, à re-cibler /hub/depart) ; preuve collée au commit.
- Suppressions fichiers : routes ci-dessus + composants terrain legacy (TerrainShell, HubTopBar, BaseCampView, ActionModeView, 4 widgets, PrepScoreGauge, SmartPromptsList, prepScoreCalculator si orphelin, exports index) + burn R1/R2hub TOTAL.
- Vérifier : `useHubStore` encore utilisé par HubShell (garder store+hook) ; `prepScoreCalculator` usage (store refreshPrepScore → garder si utilisé).

- [ ] Greps + retargets → middleware → suppressions → curl 307 × N → captures → commit `feat(h5): redirects 307 + suppressions à preuves (3/3)`.

### Task 4 (commit 4) : suggestion IA déterministe

**Files:**
- Create: `src/features/hub/engine/suggestAdventure.ts` + `tests/features/hub/suggestAdventure.spec.ts` (~8 tests).
- Modify: `AdventureSwitcher` (ligne Suggestion, icône Sparkles, non restrictive).

**Règles (exact) :** upcoming ≤7j le plus proche > invites>0 (collectif, 1er groupe) > alerts>0 (possession) > trip le plus récent (start_date max) > possession défaut. `reason` phrase chiffrée. Pure : `(lists, now) => { entry, reason } | null`. Tests : 5 règles + déterminisme (2 appels égaux) + vide→possession + empate (upcoming prime).

- [ ] TDD RED→GREEN → switcher → commit `feat(h5): suggestion aventure déterministe (IA non restrictive)`.

### Task 5 : portes + revue + tag

- [ ] G1 0 · G2 ≥1145 · G3 · G4 build · captures bar/redirects/IA · curl 307.
- [ ] Revue Nielsen (recognition vs rappel) — objections traitées.
- [ ] MISSION_LOG + commit + tag h5-done + push.

## Self-Review

- §2.4 couvert : 5 accès ✅ hub accentué + haptique ✅ restore contexte (cookie serveur) ✅ matchPaths ✅ badge agrégat ✅ sheets remplacés ✅ pilule/44px/haptique/prefetch ✅.
- Redirects §3 : 10+ suppressions avec preuves ✅. /boutique créée H0 ✅.
- IA §H5 : suggestion + reason, repli = elle-même (déterministe), jamais bloquante ✅ (R5).
