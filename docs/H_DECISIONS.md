# H_DECISIONS — Arbitrages D1–D10 + journal des décisions autonomes

**Branche** : `chantier/h-hub-voyageur` · **Base** : `8e3b7ffa` · **Rédigé** : H0 (09/2026, mesures locales horodatées dans MISSION_LOG.md)
**Sources** : `docs/H_ROUTE_MAP.md` (§1–§7), `docs/CHANTIER_H_HUB_VOYAGEUR.md` (§10), mesures `Get-ChildItem` + `grep href` du 08/09/2026.

> Règle : aucune suppression exécutée ici. Chaque suppression exigera en H5 : grep d'entrants à zéro collé dans le commit + redirect 307 + portes vertes + compteur ≥ plancher H0.3 (1051 tests / 141 suites).

---

## D1 — features/hub (terrain) → socle du HubShell H : VALIDÉE

- `src/features/hub/` : 14 fichiers (HubShell, HubTopBar, BaseCampView, ActionModeView, widgets SOS/hydratation/eau/compas, PrepScoreGauge, SmartPromptsList, `useHubStore.ts` 6 787 o, prepScoreCalculator, types, index).
- `src/app/terrain/` : 2 fichiers, 1 702 o (coquille fine → actif réel dans features/hub).
- Entrants `href="/terrain"` hors features/hub : **0** (grep H0) → hub orphelin confirmé.
- **Décision** : absorber. BaseCampView ≈ vue possession, ActionModeView ≈ mode live, useHubStore (GPS/batterie/ultra-save) migré tel quel. Gain H3+H6 confirmé.

## D2 — 3 entrées live GPS → 1 (`/randonnee-active`) : VALIDÉE

- Tailles page : `/naviguer` 17 112 o · `/boussole` 16 863 o · `/randonnee-active` 1 278 o (coquille → `features/hiking/HikingCockpitPage`, le plus complet).
- **Décision** : `/randonnee-active` canonique ; `/naviguer` + `/boussole` → redirect 307 en H5 ; SOS/compas/AR → widgets cockpit. Exécution H5 uniquement (captures avant/après exigées).

## D3 — `/preparation` racine → redirect `/hub/preparation` : VALIDÉE

- `/preparation` : 1 816 o (1 fichier). `/materiel/preparation` : wrapper → PreparationCockpit (feature 117 ko citée ROUTE_MAP §2).
- **Décision** : redirect 307 en H5. Bonus constat H0 : `/preparer-randonnee` redirige **déjà** vers `/materiel/depart` (page marquée « supprimée ») — pattern redirect existant à réutiliser.

## D4 — `/alertes` racine vs `/materiel/alertes` : VALIDÉE (fusion, sens à auditer en H4)

- `/alertes` : 33 666 o (2 fichiers) · `/materiel/alertes` : 5 460 o (2 fichiers).
- **Décision** : une seule section `alertes` du hub (nature possession). Le sens de la fusion (qui absorbe qui) est tranché en H4 après lecture des deux implémentations — pas de choix par défaut silencieux.

## D5 — `/rapport-kit` + `/ai-configurator` → un seul wizard : VALIDÉE (fusion, survivant tranché en H4/H5)

- `/rapport-kit` : 78 424 o (2 fichiers) · `/ai-configurator` : 101 923 o (3 fichiers).
- **Décision** : un seul wizard invocable depuis la section kit (Z1 sanctuarise le configurateur ; écart de taille noté : ai-configurator > rapport-kit, contrairement aux 77,6/51,3 ko cités §2 — les chiffres §2 incluaient probablement les features, à remesurer en H5 avant suppression). `/rapport-kit` → redirect vers le wizard survivant.

## D6 — `/carte-interactive` vs `/explorer` : REPORTÉE EN H4 (diff fonctionnel requis)

- `/carte-interactive` : 17 700 o (5 fichiers) · `/explorer` : 7 740 o (4 fichiers).
- Entrants BottomTabBar matchPaths partagés (ROUTE_MAP §3) mais contenus distincts pressentis (refuge/eau vs sentiers).
- **Décision** : pas d'absorption sans diff fonctionnel mesuré (chevauchement > 70 %). Les deux restent hors hub (tabs Découverte) dans tous les cas.

## D7 — `/recommandations`, `/activite`, `/encheres` : VALIDÉE SOUS CONDITION DE PREUVE

- Tailles : `/recommandations` 3 304 o · `/activite` 10 069 o · `/encheres` 4 641 o.
- Entrants `href="…"` (grep H0) : `/recommandations` **0** · `/encheres` **0** · `/activite` **1** (`ActiviteCard.tsx` groupes) · `/mes-aventures` **0** (cible) · `/copilote` **0** · `/terrain` **0**.
- **Décision** : suppression + redirect 307 envisageable en H5 **si** le grep à zéro est re-confirmé au moment du commit (les chiffres ci-dessus sont H0, pas des preuves de suppression). `/activite` a 1 entrant → à traiter (rediriger le lien ou garder).
- `/copilote` (6 944 o, 0 entrant) : **fusionné comme assistant contextuel du hub** (consomme déjà ActiveTrip d'après ROUTE_MAP §3 — à vérifier en H5 ; si faux, consigner et garder la route).

## D8 — Liens morts accueil : VALIDÉE, exécution H0.5 immédiate

- Confirmé H0 : `/boutique` **45 références** pour **0 route** (`src/app/boutique` absente) — accueil, hero, grids, panier, produit, compte, search. `/manifeste`, `/ateliers`, `/presse`, `/confidentialite` : cf. ROUTE_MAP §4 (404 vérifiés).
- **Décision** : H0.5 corrige avant H1 (création `/boutique` minimale OU retarget vers `/kits` + 404 → pages existantes). Ces 404 sont visibles en prod : signal qualité prioritaire.

## D9 — `/mes-aventures` vs AdventureSwitcher : VALIDÉE (absorption probable, à confirmer en H2)

- `/mes-aventures` : 20 426 o (2 fichiers), 0 entrant href.
- **Décision** : si AdventureSwitcher couvre favoris/reprise, `/mes-aventures` → redirect `/hub`. Sinon, la route devient la vue « liste » du switcher. Tranché en H2 après implémentation du switcher.

## D10 — `/groupes` + `/equipages` + `/nouveau-groupe` → nature collectif : VALIDÉE

- `/groupes` : 56 861 o (3 fichiers, monolithe à découper) · `/equipages` : 23 762 o · `/nouveau-groupe` : 40 211 o (suspect confirmé : plus lourd que la liste elle-même).
- **Décision** : une nature `collectif`, distinction groupe/équipage = filtre interne ; `/nouveau-groupe` audité en H4 (probable section `creer` du hub). Groupe avec voyage lié → CTA « entrer dans le voyage ».

---

## Journal autonome (décisions prises seul, §8.4)

| # | Décision | Justification |
|---|---|---|
| H-AUTO-1 | `testing-qa` substitue `testing-anti-patterns` (absente de `.agents/skills/`) | §9.1 : consigner et poursuivre sans improviser d'équivalent |
| H-AUTO-2 | `systematic-debugging` couvre `root-cause-tracing` (absente) | Même règle ; cause racine exigée avant tout correctif |
| H-AUTO-3 | Trois docs créés (`H_DECISIONS` + `H_ROUTE_DECISIONS` + `H_INVENTAIRE`) au lieu d'un seul | §13 exige les trois fichiers ; `H_DECISIONS` = journal vivant, les deux autres = matrices de référence |
| H-AUTO-4 | Plancher tests H0.3 = **1051 tests / 141 suites** (mesuré 08/09/2026), pas 1049/140 du §13 | verification-before-completion : valeurs remesurées, jamais recopiées |
| H-AUTO-5 | Fast-forward `chantier/h-hub-voyageur` sur `main` (`8e3b7ffa`) avant H1 | Branche existante en retard d'1 commit (fix migrations rejouables, requis pour RLS) |
| H-AUTO-6 | Migration RLS à appliquer = `20260907020000_trips_rls_hardening.sql` (+ `20260907000000_unify_crews_trips_rls.sql`, `20260908020000_trip_items_inventory_fk.sql`) | Le `...010000` cité §12 n'existe plus après renommage `8e3b7ffa` ; action Tony sur Supabase |
| H-AUTO-7 | H0.5 (`/boutique` + 404 accueil) exécuté avant H1 | Bugs prod visibles ; D8 validée ; petit périmètre, zéro risque hub |
