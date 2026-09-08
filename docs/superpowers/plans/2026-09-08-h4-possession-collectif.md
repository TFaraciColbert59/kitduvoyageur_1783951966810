# H4 — Natures possession & collectif — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sections possession (6) et collectif (3) réelles dans `/hub/[section]`, widgets réels par nature, consommation (jamais duplication) des composants/services canoniques.

**Architecture:** Composition stricte — composants `features/materiel` + services `get*` + `shakedownEngine` + `TripSidebarRight` + `fetchCrewBySlug` + patterns `groupes/page` (server client). Sélection widgets extraite en helper pur testé.

**Tech Stack:** Server Components (data), client ciblés (invitations, cockpits existants).

**Spec:** `docs/CHANTIER_H_HUB_VOYAGEUR.md` §9.2 (H4) + D4/D10.

## Global Constraints

- Mêmes composants + mêmes services que les pages sources (parité vérifiée build+captures). Dérivations triviales recopiées à l'identique (H-AUTO-21 : pas de refactor des pages sources mid-chantier).
- Cockpits viewport-locked (kit, depart) wrappés `md:h-full min-h-[70dvh]` (hub center flow mobile, h-full desktop).
- Sortie inchangée (redirects déjà H3). Collectif capture via cookie `lkv_active_adventure` (base64url) en dev (H-AUTO-23).
- H-D85 : wrappers hub en `var(--…)` uniquement, zéro littéral route/segment.
- Invitations : pattern `handleInvite` groupes/page.tsx:149 (update/delete `group_members`, RLS).

---

### Task 1: selectHubWidgets pur + spec (TDD)

**Files:**
- Create: `src/features/hub/engine/selectHubWidgets.ts` — `selectHubWidgets(profile): { shown: HubWidgetDef[]; folded: number }` (ordre priorité, repli >1800).
- Test: `tests/features/hub/selectHubWidgets.spec.ts` (tri, repli, natures disjointes).
- Modify: `HubSidebarRight` (utilise le helper).

- [ ] Spec RED (fonction inexistante) → impl GREEN → refactor sidebar → commit `refactor(h4): selectHubWidgets pur + spec`.

### Task 2: Sections possession (6) — composition pages sources

**Files (create, `src/features/hub/components/possession/`):**
- `HubInventaireSection.tsx` — `getInventory()+getProductSuggestions()` + InventoryOverview/Workspace/PurchasesInvest/AiInsightBanner/CrossSellStrip (assemblage = materiel/inventaire/page).
- `HubKitSection.tsx` — `getKits()+getInventory()+getPublicKits()+getProductSuggestions(24)` + KitsCockpit, wrapper hauteur cockpit.
- `HubPreparationSection.tsx` — `<PreparationCockpit/>` direct.
- `HubDepartSection.tsx` — `getDepartDetail(undefined)+getKits()+getInventory()+getLoans()+getProductSuggestions(8)` + weather + DepartCockpit (+Suspense skeleton), wrapper hauteur.
- `HubDisponibiliteSection.tsx` — `getLoans()+getInventory()` + conflits (`materiel_kit_items` + `detectConflicts`) + heatmap + 10 composants (assemblage = disponibilite/page).
- `HubAlertesSection.tsx` — `getAlerts()+getInventory()+getOccasionProducts()+getWeather()` + score + 10 composants (assemblage = alertes/page).
- Modify: `src/app/hub/[section]/page.tsx` — dispatch id → section (possession 6 ci-dessus ; collectif Task 3 ; sortie redirect inchangé ; générique supprimé).

- [ ] Implémenter → tsc + H-D85 → captures /hub/inventaire + /hub/kit + /hub/alertes (desktop+mobile, inspection) → commit `feat(h4): sections possession réelles (composition)`.

### Task 3: Sections collectif (3) + invitations

**Files (create, `src/features/hub/components/collectif/`):**
- `HubGroupeSection.tsx` — server : groupe (`travel_groups`+`group_members`+profils, pattern groupes/page:95-107, server client) ou équipage (`fetchCrewBySlug` via slug résolu des lists) : header (nom, membres, rôle), liste membres (initiales + rôle, miroir [slug] page), voyages liés (liens `tripSectionHref`), CTA entrer si lié.
- `HubInvitationsSection.tsx` — server : invites pending (`group_members` pending + `travel_groups` nom, pattern :135-147) + client `HubInviteButtons` (accept/refuse, pattern handleInvite:149, busy state, refresh router).
- `HubVoyagesLiesSection.tsx` — server : trips liés (`trips` eq `group_id` ou crew trips) + cartes lien voyage.
- Widgets collectif réels : `invitations-apercu` (pending + lien), `presence-groupe` (membres + lien), `entrer-voyage` (CTA si slug) — rendus dans HubSidebarRight (props étendues : counts + groupLabel + linkedTripSlug + pendingInvites).
- Widgets possession réels : `stock-apercu` (items + lien inventaire), `alertes-materiel` (non résolues + top sévérité + lien), `dispo-apercu` (prêts actifs + prochain retour + lien), `prochain-depart` (lien depart). Données = counts (+ prêts via getLoans dans le layout ? NON — counts suffisent : items/loans/alerts ; prochain retour = lien simple).
- Sortie : HubSidebarRight compose `TripSidebarRight` (`deriveTripProfile` + `getTripPhaseDetails` purs, trip du layout).

- [ ] Implémenter → tsc + H-D85 → captures collectif via cookie dev (overview + groupe + invitations, desktop+mobile) → commit `feat(h4): sections + widgets collectif, widgets réels`.

### Task 4: Portes + revue + tag

- [ ] G1 0 · G2 0 échec ≥1141 · G3 (12/12+14/14+invariants) · G4 build · G5 captures inspectées.
- [ ] Revue : Tufte (densité widgets), Norman (affordances sections, monolithe découpé sans perte) — objections traitées/consignées.
- [ ] MISSION_LOG + commit + tag h4-done + push.

## Self-Review

- §H4 couvert : 7 routes wrappées (rendues par la coquille, deep-links intacts — aucun redirect avant H5) ✅ ; shakedown consommé via PreparationCockpit/gearGapEngine (pas de copie moteur) ✅ ; groupes découpé (sections, pas de monolithe) ✅ ; CTA entrer-voyage ✅ ; mini-sheets BottomTabBar = H5 (pas ici) ✅.
- Back Android/offline = H6. IA = H5.
