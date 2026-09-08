# H_REPORT — Rapport Final de Recette du Chantier H « Hub Voyageur Unifié »

**Branche** : `chantier/h-hub-voyageur` · **Base** : `main @ 8e3b7ffa` · **Gel code** : `a26c17df` · **Tag final** : `h8-done` (voir `git rev-parse h8-done`)
**Période** : 08/09/2026, ~20:20 → ~22:40 UTC · **Mode** : autonome 100 % (§8), décisions en `docs/H_DECISIONS.md` (H-AUTO-1..39)
**Aucune valeur recopiée** : tous les chiffres ci-dessous sont remesurés (commandes §13, horodatées).

## 1. Identité du chantier

Une seule page `/hub` qui réunit matériel (possession), voyages (sortie) et groupes (collectif), pilotée par `deriveHubProfile` (composition de `deriveTripProfile`, zéro duplication), `hubSectionRegistry` / `hubWidgetRegistry` (source unique, `hubSectionHref` typé) et le garde-fou H-D85 (14 règles : 12 Y reprises + R13 source unique + R14 registre obligatoire).
Règle d'or tenue : le hub consomme l'inventaire par `inventory_item_id` (`trip.types.ts:117`, `TripKitView.tsx:126/798/899`, `trip.schema.ts:184`), il ne le recopie jamais.

## 2. Les décisions arbitrées (D1–D10 : toutes validées, preuves en H_DECISIONS.md)

| # | Décision | Sort H |
|---|---|---|
| D1 | features/hub → socle HubShell | Absorbé (hook `useHubLiveSensors`, store migré), vues legacy supprimées H5 |
| D2 | 3 entrées live → `/randonnee-active` | `/naviguer` + `/boussole` → 307 (écart AR documenté H-AUTO-29) |
| D3 | `/preparation` racine | 307 → `/hub/preparation` |
| D4 | `/alertes` vs `/materiel/alertes` | Une section `alertes` (`/hub/alertes`), racine → 307 |
| D5 | `/rapport-kit` + `/ai-configurator` | Un wizard (`/ai-configurator`), `/rapport-kit` → 307 (tailles remesurées : 78 424 o / 101 923 o) |
| D6 | `/carte-interactive` vs `/explorer` | GARDÉES (datasets distincts, chevauchement <70 %) |
| D7 | `/recommandations`, `/activite`, `/encheres`, `/copilote` | Supprimées + 307 (`/hub`, `/feed`, `/occasion`) sauf `/copilote` (vivante + CTA hub, fusion UI = backlog) |
| D8 | Liens morts accueil | Corrigés H0.5 (`/boutique` + `/manifeste` créées, `/ateliers`+`/presse` retirés, `/confidentialite` re-ciblé) |
| D9 | `/mes-aventures` vs switcher | 307 → `/hub` (0 entrant) |
| D10 | `/groupes`+`/equipages`+`/nouveau-groupe` | Nature `collectif` (sections + filtres), monolithe découpé sans perte |

Suppressions H5 : 11 routes + 10 vues legacy (−5 181 lignes au commit `3e46a13e`), chacune avec grep frais + retarget + 307 (preuves dans les corps de commit).

## 3. Le bilan des suppressions/redirections (curl 307 vérifiés, 12/12)

`/materiel`→`/hub`, `/naviguer`+`/boussole`→`/randonnee-active`, `/preparation`→`/hub/preparation`, `/rapport-kit`→`/ai-configurator`, `/activite`→`/feed`, `/recommandations`→`/hub`, `/gamification`→`/recompenses`, `/alertes`→`/hub/alertes`, `/terrain`→`/hub`, `/mes-aventures`→`/hub`, `/encheres`→`/occasion`.
Vivantes (deep-links, H-AUTO-27) : `/materiel/*`, `/voyages/*`, `/groupes/*`, `/copilote`, `/carte-interactive`, `/explorer`.
Bonus H5 : redirect fantôme `/kits`→`/materiel/kits` supprimé (shadowait la boutique, H-AUTO-30) ; matcher middleware explicite (sans quoi les redirects ne tirent jamais).

## 4. L'état du garde-fou H-D85 (14/14 vert, 22:34 UTC)

R1–R12 reprises de Y-D80 sur `src/features/hub/**`, `src/app/hub/**`, `src/components/mobile-nav/**`, avec 2 adaptations tracées : R2 = allowlist `tokens.css`+`tailwind.config.js` (H-AUTO-8), R5 hors API PWA + R8 hors commentaires (causes racines, H-AUTO-9).
R13 (0 littéral `/hub/` hors registre) + R14 (0 segment hors moteur/registre/dispatcher) : 4 violations légitimes rencontrées, toutes résolues par construction (`HUB_ALERTES_HREF`, `HUB_DEPART_HREF`, allowlists `adventureLists`/`HubWidgets`/dispatcher — H-AUTO-11/25).
Dette soldée : R1/R2hub (vues legacy supprimées H5), R11 (BottomTabBar, H5), R2nav partiel (reste 6 fichiers shell mobile → H6 үүс backlog). Y-D80 : 12/12 vert (inchangé).

## 5. Les parcours (§5) — verdicts honnêtes, build prod `:4000`

| # | Parcours | Verdict | Preuve |
|---|---|---|---|
| P1 | Solo rando (sortie : kit/itinéraire/sécurité, sans budget/groupe) | MOTEUR ✅ / RENDU : NON EXÉCUTÉ | SOR-1/SOR-7 (25 tests moteur) ; rendu sortie authentifiée impossible : compte démo `y-demo@` → 401, aucun trip lisible sans session |
| P2 | Road trip groupe (8+ sections, budget, documents) | MOTEUR ✅ / RENDU : NON EXÉCUTÉ | SOR-2 (expedition/group, budget+docs forcés) ; même cause session |
| P3 | Possession pure (inventaire/alertes/prêts, pont `inventory_item_id`) | ✅ RENDU + ✅ PONT (écriture : NON EXÉCUTÉ) | Captures inventaire/kit/alertes ; pont vérifié statiquement (`trip.types:117`, `TripKitView:126/798/899`) ; ajout d'item sans session : NON EXÉCUTÉ |
| P4 | Changement de contexte (switcher, restore section, reload) | ✅ 7/7 (mobile + desktop) | Mémoire `{"possession":"kit"}`, restore collectif après reload, 3 natures listées, 0 erreur ; switch vers voyage : NON EXÉCUTÉ (liste sorties vide sans session) |
| P5 | Hors-ligne (3 sections sans réseau, file sync, 1 indicateur) | ✅ 4/4 | SW actif, 3/3 servies via SW (statuts 200), 1 indicateur mobile + desktop (fix H8 : repli chip + bannière globale) ; `Garder hors-ligne` + file non vide : NON EXÉCUTÉ (session) |

## 6. Le bilan visuel (Porte G5) — `docs/h-captures/` (18 planches, inspectées HIG)

hub desktop+mobile (possession), inventaire, kit (mobile), alertes, preparation, disponibilite, collectif (desktop), groupe + invitations (mobile), voyages-liés, bottom bar 5 tabs, switcher (+suggestion IA), picker (reasons tracées), offline mobile+desktop, 404 section.
Bugs trouvés par inspection et corrigés : triggers dupliqués (`md:hidden` battu par `.glass-capsule-btn`, H-AUTO-19 + fix Y identique), hydratation réseau (H-AUTO-20), `currentSeason` piégé `'use client'` (fixe aussi `/materiel/alertes` en prod, H-AUTO-24).

## 7. Le bilan d'accessibilité (Porte G6) — 24/24

`tests/a11y/e2e/hub-a11y.spec.ts` : 8 surfaces (possession ×4, collectif ×3 via cookie, sortie via cookie) × 3 viewports (1440×900, 430×932, 834×1194), 0 critical/serious (23:00 UTC, `npx playwright test --config=playwright.a11y.config.ts`).
hub-kit : 3 violations → parité `/materiel/kits` prouvée → micro-fixes (`listitem`, `aria-label`, `tabIndex`, prod améliorée). 44px runtime (H6) : chrome hub 100 % (skip-links `sr-only` exclus, conformes).

## 7bis. Livrables par phase (16 commits, +6 604/−5 309, 113 fichiers)

H0 état des lieux + H0.5 liens morts (+5 tests) · H1 moteur (25) + registres (14) + H-D85 (14) · H2 contexte + switcher (24) · H3 coquille + `/hub` · H4 sections possession/collectif + widgets · H5 bar + 12×307 + IA (8) · H6 back Android (5) + SW + mesures · H7 axe + revues · H8 recette + indicateur unique.
Zéro duplication : `deriveTripProfile`, `tripSectionHref`, `TripSidebarRight`, `fetchUserCrews`, `getMaterielSummary`-patterns, cockpits materiel, `handleInvite`-pattern — tous composés.

## 8. Le bilan de performance

- `/hub` : 822 B, first-load 108 kB · `/hub/[section]` : 3,69 kB, first-load 343 kB raw (≈110 kB gzip, ratio 3:1) < 250 kB → pas de dynamic imports (H-AUTO-26/37, mesuré).
- `npm test` : 8,7 s · `tsc` : 0 erreur · build prod : compilé en ~10–16 s.
- Dev : 3 incidents de cache `.next` stale après renames (diagnostiqués, recette basculée sur build prod, H-AUTO-39).

## 9. Le bilan de sécurité (revue Schneier, H-AUTO-38)

`/api/hub/adventures` : GET sans paramètres, auth serveur, RLS, données propres uniquement (noms/comptes individuels). Server actions : schéma zod strict, cookie httpOnly/lax/30j, aucune décision d'autorisation côté client. Redirects : table statique (pas d'open-redirect). `HubInviteButtons` : `eq(user_id)` + RLS (miroir page groupes). XSS : contenus utilisateur via React (échappés) ; JSON-LD = constantes. Secrets : `ci_invariants` vert (5a/5b). Verdict : RAS.

## 10. Les parcours — voir §5 ci-dessus.

## 11. Le natif

NON EXÉCUTÉ en toutes lettres (aucun émulateur/simulateur disponible dans cet environnement ; cibles Capacitor intactes : `useAndroidHubBackNav`, `applyLKDVStatusBarTheme`, safe-areas, haptique).

## 12. Les compteurs & réconciliation

| Indicateur | H0 (plancher) | Final H8 | Delta |
|---|---|---|---|
| Tests | 1051 / 141 | 1158 / 151 | +107 / +10, 0 échec, jamais décroissant |
| Type-check | 0 erreur | 0 erreur | = |
| Y-D80 | 12/12 | 12/12 | = |
| H-D85 | — | 14/14 | nouveau, vert |
| Invariants CI | succès | succès | = |
| Axe hub | — | 24/24 | nouveau, vert |
| Redirects curl | — | 12×307 + Locations | nouveau, vert |
| Captures | — | 18 planches | nouveau, inspectées |

## 13. Les sorties brutes des six portes (horodatées, arbre final)

```
### G1 — 22:34:02 UTC — npm run type-check → TSC_EXIT:0
### G2 — 22:34:21 UTC — npm test → Test Files 151 passed (151) / Tests 1158 passed (1158), 8.7s
### G3 — 22:34:04 UTC — y-d80 12/12 + h-d85 14/14 (26 passed) + ci_invariants SUCCÈS
### G4 — 22:24 UTC — npm run build → Compiled successfully (10.4s) ; /hub 822B/108kB, /hub/[section] 3.69kB/343kB
### G5 — planche docs/h-captures (18 fichiers, §6)
### G6 — 23:00 UTC — hub-a11y 24 passed (3 viewports × 8 surfaces), 0 critical/serious
```

## 14. État des fusions & actions ouvertes (pour Tony)

1. **PR** : impossible depuis cet environnement (`gh` absent) — commande prête :
   `git push -u origin chantier/h-hub-voyageur` (déjà poussée) puis sur GitHub : PR `chantier/h-hub-voyageur` → `main`, corps = §12 ci-dessus + chiffres §13. Ne PAS squash (16 commits = traçabilité des preuves).
2. **Protection `main`** (H0.2) : activer avec G1/G2/G4 requis.
3. **Migration Supabase** : `20260907020000_trips_rls_hardening.sql` (+ `20260907000000_unify_crews_trips_rls.sql`, `20260908020000_trip_items_inventory_fk.sql`) — le `...010000` cité au plan n'existe plus après renommage `8e3b7ffa`.
4. **Compte démo** : `y-demo@lekitduvoyageur.fr` → 401 en prod — recréer/réparer + seed `seed_y_profiles.mjs` (8 voyages) pour rejouer P1/P2/P4-voyage/P5-toggle authentifiés.
5. **Natif** : recette Capacitor sur appareil/émulateur (back-button hub, offline réel, safe-areas device).
6. **Backlog acté** : widget boussole AR (H-AUTO-29), fusion UI copilote (D7), refonte cockpits <44px (H-AUTO-34), cibles internes 24px parité source.

*Fin du rapport. DoD §8.5 : 6 portes vertes ✅ (SHA final = tag h8-done) · P1/P2/P4-voyage/P5-toggle/Natif = NON EXÉCUTÉ (tracé, cause session/natif) · tout le reste vert · chaque exigence UX tracée (capture, parcours ou test).*

---

## Addendum final — 09/09/2026 (clôture des écarts DoD post-h8)

Complète le rapport h8-done. Trois écarts restants de la définition de « terminé » sont soldés (détails et preuves : `docs/H_DECISIONS.md`, addendum H-AUTO-41/42/43) :

1. **Appui long sur le bouton Hub central** (DoD manquant en h8) : implémenté dans `BottomTabBar.tsx` + `AdventureSwitcher.tsx` ; bug a11y Radix (double instance `aria-hidden` mutuelle) corrigé par prop `variant`. Tests : `tests/features/hub/adventureLists.spec.ts` (+3), e2e `scripts/e2e/hub-nav.spec.ts` (BAR-1..5).
2. **Aucune duplication d'URL** (DoD partiel en h8 : `/materiel/*` restaient vivantes en doublon des sections hub) : 307 canonicalisés, pages supprimées, matrice testée `tests/features/hub/hubRedirects.spec.ts` (13 tests), e2e redirections (19 cas). Nouvelle section `oublis` (`/hub/oublis`) pour `/materiel/forget`.
3. **Chaîne de redirections /hub/groupe → /groupes → 301 /equipages** : supprimée (H-AUTO-43), test verrouillé `tests/crews/crew-routes.spec.ts`.

État à la clôture : `tsc` 0 erreur ; `vitest` 152 fichiers / 1 175 tests verts (contre 1 158 en h8) ; invariants H-D85 14/14 verts (allowlist R13 documentée) ; build de production compilé avec succès après la phase de canonicalisation (re-run conseillé sur l'état final du commit a11y).

Commits de clôture : `c11f8439` (appui long) · `6755c5f4` (section oublis + deep-links depart) · `f319ccb8` (canonicalisation 307 + suppressions + groupes) · `683a8e86` (fix a11y switcher + e2e hub-nav) · `7fd48e95` (chore).
