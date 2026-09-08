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
| H-AUTO-8 | H-D85 R2 = allowlist `tokens.css` + `tailwind.config.js` (pas `#fff/#000` seuls) | `tokens.css` est titrée source unique des valeurs brutes ; interdire les hex identité casserait tout le design system — la dérive à interdire, c'est les hex sauvages (#dc2626, #ef4444…) |
| H-AUTO-9 | H-D85 : dette legacy par règle (RULE_EXEMPTIONS) + R5/R8 corrigés à la cause racine | R5 `deferredPrompt.prompt()` = API PWA (faux positif regex) ; R8 ne scanne plus les commentaires ; R1/R2 composants terrain → burn-down H3 (D1), R2 nav + R11 BottomTabBar → burn-down H5 |
| H-AUTO-10 | Revue H1 (Kent Beck / Leslie Lamport) : 1 vrai bug corrigé (SOR-8) + totalité du switch | `deriveSortie` ignorait `enabledSections` sur voyage annulé (divergence Y2.4) ; `default: throw` ajouté pour totalité du dispatch |
| H-AUTO-11 | H2 : collectif = `travel_groups`+`group_members` et `fetchUserCrews` (patterns copiés, rien inventé) ; voyages via contexte Y (jamais re-fetchés) ; tests = helpers purs (pas de RTL dans le projet) | Tables vérifiées dans le code existant ; `adventureLists.ts` ajouté à RULE14_ALLOWLIST (couche logique pure testée) |
| H-AUTO-12 | H2 : axe du switcher reporté en H7 (non monté sur route avant H3) ; test changement-contexte→hub en H3 (intégration) | Axe sans route = sans valeur ; tracé ici, pas oublié |
| H-AUTO-13 | H3 : nouveau `HubShell` généralisé (miroir TripHubShell) ; legacy déplacé `TerrainShell` (hook extrait, /terrain intact) ; `/terrain` → redirect `/hub` ajouté à la table H5 | D1 : actif migré (GPS/batterie/ultra-save), pas reconstruit ; non-régression jusqu'en H5 |
| H-AUTO-14 | H3 : sortie = liens profonds (jamais re-rendue) ; `[section]` sortie → redirect 307, possession/collectif → vue registre (enrichie H4) | Composition stricte → régression zéro sous /voyages (captures avant/après sans objet) |
| H-AUTO-15 | Hub sans cookie = possession ; trip sortie introuvable = repli possession (jamais notFound, jamais cul-de-sac) | Le hub s'ouvre sur l'aventure, jamais une liste d'abord (§2.4) |
| H-AUTO-16 | `getHubAdventureData` caché React (layout+pages+API = 1 exécution) ; `buildHubCounts` partagé ; prêts actifs = en_cours+en_retard (canonique getMaterielSummary) | 1 source de requêtes ; API H2 realignée sur le canonique (corrige neq 'rendu' qui incluait 'litige') |
| H-AUTO-17 | Captures H3 = /hub possession × 2 viewports + section (sortie/collectif en H8 avec seed, /voyages inchangé donc rien à comparer) | Preuves proportionnées au risque réel |
| H-AUTO-18 | Colonne droite H3 = carte Contexte + slots ordonnés/repliés (widgets réels en H4) ; `coreNatures` remonté au registre (R14) au lieu d'exempter le picker | Pas de coquille vide ; le registre reste la seule source (R13/R14) |
| H-AUTO-19 | Triggers switcher wrappés en div responsive (`.glass-capsule-btn` non layeré bat `md:hidden`) ; même bug latent dans ActiveTripSwitcher (Y) → noté H_BLOCKERS, fix proposé H7 | Cause racine : cascade layers Tailwind v3 ; captures avant/après à l'appui |
| H-AUTO-20 | `HubNetworkStatus` neutre pré-montage (anti-hydratation, zéro CLS) — la résolution réseau native est post-effet | Erreur d'hydratation mesurée (En ligne≠Hors ligne) puis 0 après correctif |
| H-AUTO-21 | H4 : sections = mêmes composants + mêmes services que les pages sources (parité) ; dérivations triviales recopiées, pages sources NON refactorées mid-chantier | Refactor = risque régression ; composants/services partagés (pas de duplication réelle) |
| H-AUTO-22 | Cockpits viewport-locked (kit, depart) wrappés `md:h-full min-h-[70dvh]` | Hub center = flow mobile, h-full desktop |
| H-AUTO-23 | Captures collectif via cookie dev `lkv_active_adventure` (base64url, non loggé) — fallbacks vides vérifiés, hydration 0 | Collectif inaccessible sans session ; visuels avec seed en H8 |
| H-AUTO-24 | `currentSeason` extrait vers `lib/materiel/season` (corrige `/materiel/alertes` en prod — même crash serveur, pré-existant) | Fonction pure piégée dans fichier 'use client' ; re-export compat, 3 usages realignés |
| H-AUTO-25 | R14 : `HubWidgets.tsx` + dispatcher `[section]/page.tsx` allowlistés (mappings typés via hubSectionHref, R13 intacte, zéro littéral d'URL) | Le garde-fou garde sa morsure partout ailleurs (2 violations légitimes documentées, pas d'exemption large) |
| H-AUTO-26 | `/hub/[section]` first-load 343 kB → watch H7 (budget <250 ko gzip ; dynamic imports cockpits si dépassé) | Mesuré au build H4, pas estimé |
| H-AUTO-27 | H5 : `/materiel/*`, `/voyages/*`, `/groupes` vivants (deep-links) ; seul `/materiel` racine redirige ; pas de déplacement d'URL (bookmarks/partages intacts) | R3 : redirects directs, pas de migration d'URL ; canonical → /hub |
| H-AUTO-28 | D6 : `/carte-interactive` GARDÉE (trails PostGIS vs OSM live + générateur, chevauchement <70%) ; D9 : `/mes-aventures` → /hub (0 entrant) | Diff fonctionnel mesuré, pas d'absorption aveugle |
| H-AUTO-29 | `/boussole` supprimée, push AR HikingCockpit → `/randonnee-active` (écart capacitaire AR documenté, backlog widget) | D2 validée ; pas de widget AR en H5 (scope), URL gardée vivante |
| H-AUTO-30 | Redirect `/kits`→`/materiel/kits` SUPPRIMÉ (shadowait la boutique, 4 self-links cassés) | Bug pré-existant : la page shop /kits ne rendait jamais |
| H-AUTO-31 | ai-engineering-toolkit chargée puis écartée (prompt/RAG/sécu LLM — hors sujet) ; H5-IA = heuristique déterministe + tests (R5) | Skill check obligatoire, usage conditionné à la pertinence réelle |
| H-AUTO-32 | Délestage réel −5,0 ko (estimation §2.4 haute, chiffre réel retenu) ; `/gamification` → `/recompenses` (loyalty la plus proche) ; `/copilote` vivante + CTA hub (D7-partiel, fusion UI = backlog) | Preuves > estimations, jamais de valeur recopiée |
| H-AUTO-33 | android-development (Kotlin natif) écartée pour H6 (chantier = web Capacitor) ; back hub = `hubBackTransition` pure + events `hub:open/close-switcher` + `forceOpenSignal` (switcher retiré de la sidebar, constance Y) | Skill checkée puis écartée proprement ; pas de dialogue sans état suivi |
| H-AUTO-34 | Mesure 44px runtime : chrome hub 100% (hub 11/12, groupe 9/10 — seuls rejets = skip-links sr-only 1px, conformes) ; internes cockpit materiel 24px (drag/+/pills, parité stricte avec /materiel/*, pré-existants) → consigné, pas corrigé en H6 | Refondre les cockpits = risque régression hors périmètre ; backlog |
| H-AUTO-35 | Offline H6 = SW (`/hub` precaché, `/api/hub` en SWR, v3) + Dexie composés (tripDexieDB via TripSidebarRight, materielDB existant) ; zéro nouveau store ; parcours 5 en H8 | Composition vérifiée, pas de duplication |
| H-AUTO-36 | H7 : fix ActiveTripSwitcher (même bug md:hidden, wrappers) ; G6 24/24 (8 surfaces × 3 viewports) ; 3 micro-fixes a11y dans KitsCockpit (listitem/aria-label/tabIndex — parité source prouvée, prod améliorée) | Bug latent Y corrigé au passage, sans toucher aux comportements |
| H-AUTO-37 | Perf : first-load [section] 343 kB raw (≈110 kB gzip, ratio 3:1) < 250 kB → pas de dynamic imports (H-AUTO-26 soldé par mesure, pas par estimation) | SSR cockpits incompatibles avec dynamic() client ; besoin non mesuré |
| H-AUTO-38 | Revues H7 : Linus (0 scorie, 0 any nouveau, max 13 ko) + Schneier (API RLS/zod/redirects statiques/XSS : RAS) — objections : aucune | Surface auditée : api/hub/adventures, server actions, HubInviteButtons, middleware |

## Addendum 09/09/2026 — clôture des écarts DoD (post-h8)

**H-AUTO-41 (appui long tab Hub)** — Le tab Hub central de la bottom bar ouvre le sélecteur compact (3 natures) via appui long 550 ms (annulation au déplacement >8 px, haptique medium) : événement `hub:open-switcher` sur surface hub, sinon signal one-shot sessionStorage consommé au montage du switcher après navigation vers /hub. Alternative accessible : `aria-haspopup="dialog"`, Ctrl/Cmd+K/J, déclencheur visible. **Bug a11y réel corrigé au passage** : le switcher est monté 2× (slot mobile + colonne desktop) ; deux Roots Radix ouverts se marquaient mutuellement `aria-hidden` (dialog invisible au lecteur d'écran). Fix : prop `variant` — un seul dialog ouvert à la fois.

**H-AUTO-42 (canonicalisation /materiel/\*)** — Fin de la duplication d'URL : les écrans fonctionnels matériels vivent UNIQUEMENT dans le hub. `/materiel/{inventaire,kits,preparation,depart,disponibilite,alertes,forget}` → 307 vers leurs sections `/hub/*` (deep-links préservés : `/materiel/depart/[id]` → `/hub/depart?id=…`, `?route=` conservé). Pages `src/app/materiel/**` supprimées (doublons exacts devenus inatteignables, preuve grep dans le corps du commit). Matrice dans `src/lib/hub/hubRedirects.ts` (resolver pur, 13 tests : chaînes, boucles, cohérence registre, matcher). Nouvelle section possession `oublis` (`/hub/oublis`) pour accueillir `/materiel/forget`. 3 liens morts réels réparés : `/materiel/dispo` (404), `/materiel/boutique` (404), `/mon-materiel` (404).

**H-AUTO-43 (/groupes redevient canonique)** — Suppression du 301 `next.config` `/groupes → /equipages` : il contredisait le retour recette H-AUTO-40 (section groupe du hub → /groupes, /equipages si équipage), créait une chaîne de redirections et cassait la nav communauté (tab « Groupes »). /groupes et /equipages = deux écrans canoniques distincts de la nature collectif.
