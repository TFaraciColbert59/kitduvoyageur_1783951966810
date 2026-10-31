# Échecs de tests préexistants — classification (31/10/2026)

Contexte : la CI `quality-gates` échouait **avant même d'exécuter les tests** sur
la porte « Gate 2.5 — Design Governance ». Cette porte est corrigée
(PR « fix(ci) »). Le présent document classe ce qui reste rouge dans
`npm test`, avec la cause exacte et la décision prise.

## Méthode

- Branche de validation combinant les correctifs de ce chantier
  (`ci/combined-validation`), `TMPDIR` réel (pas le lien symbolique `/var` de
  macOS), sur les 48 fichiers identifiés comme rouges sur `main`.
- Résultat : **39 fichiers / 102 tests échouent** (544 passent) sur ces
  fichiers, contre 43/109 avant correctifs (le reste du run complet est vert).
- Les échecs listés ci-dessous **existent sur `main`** : la preuve par
  réexécution sur un worktree propre à `origin/main` est dans
  `RAPPORT_FINAL.md` §4.

## Catégories

### 1. Contrats de refonte « Compte » (≈ 60 échecs) — hors zones gelées

`tests/design/compte-refonte-v9…v21`, `compte-liquid-glass-v8`,
`compte-drawer-a11y`, `src/components/compte/__tests__/*`.

Cause : chaque vague de refonte a laissé son test de contrat qui assert le
markup/les classes exactes d'une version antérieure. Exemple vérifié :
`compte-refonte-v9` attend la chaîne `#tm{display:none` **dans un fichier
runtime JS**, règle qui vit désormais ailleurs. Ce ne sont pas des régressions
fonctionnelles mais de la dette de tests de design.

Décision : **non corrigé dans ce chantier**. Corriger impose soit de modifier
l'UI du Compte sans recette visuelle (risque produit), soit de réécrire les
tests (interdit : « sans masquer ni désactiver les tests »). Lot dédié requis,
avec captures avant/après.

### 2. Contrats « création » Communauté (≈ 17 échecs)

`tests/design/create-{post,carnet,club,story,sortie,media-picker,controls}`.

Cause : tests Testing Library qui cherchent des rôles/onglets absents du
markup actuel (`role="tab"` nommé « Format », bouton « Continuer »). Même
nature : contrat de design obsolète, pas une erreur runtime.

Décision : reporté au lot « contrats design », avec validation visuelle.

### 3. Zones gelées HUB / Compas (≈ 6 échecs) — **interdit de toucher**

`tests/design/hub-liquid-glass` (2), `tests/features/hub/hubRedirects` (1),
`src/components/mobile-nav/navigation/__tests__/hub-adventures-drawer` (1),
`src/features/compas/__tests__/overpassEndpoints` (2).

Décision : **bloqué par la règle de gel**. Aucun fichier HUB/Compas n'a été
modifié. Ces tests resteront rouges tant que la zone n'est pas rouverte.

### 4. Audit — credential littéral (1 échec, corrigé)

`tests/audit/audit-scripts-static.spec.ts` détectait l'URL du projet Supabase
en dur (`<ref>.supabase.co`) dans `FreedomKitDrawer.tsx` (Communauté). Ce n'est
pas un secret, mais un couplage d'environnement interdit par la règle.

Correctif : les URLs produits passent par `NEXT_PUBLIC_SUPABASE_URL`
(`publicProductImage(path)`), plus aucune occurrence du domaine en dur.
Le test doit redevenir vert — vérifié localement.

### 5. Cartes — `preconnect` dans le layout partagé (2 échecs)

`tests/map/leafletTiles.spec.ts` interdit toute URL ArcGIS hors repli de
développement ; il détecte les `<link rel="preconnect">` de
`src/app/layout.tsx`. Ce sont des indices réseau, pas des tuiles.
`tests/map/standardBase.spec.ts` : même famille (scan de sources).

Décision : non modifié. Le layout est partagé avec HUB/Compas (gel) et retirer
un `preconnect` dégraderait la latence réelle pour satisfaire un scan trop
large. À traiter en ajustant le test (avec justification), pas le produit.

### 6. Divers contrats de design (≈ 12 échecs)

`design-system/icon-resolution`, `design/task-2a-contrast`,
`navigation-glass-a11y`, `lot2-shell`, `m02-destination-registry`,
`stories-viewer-clean`, `adventure-prep/design-tokens-p017`,
`compte/map/__tests__/camera`.

Même famille que §1/§2 : assertions de contrat sur des classes, des ordres de
navigation ou des libellés qui ont évolué. `m02` dépend de l'ordre des
destinations incluant la route HUB (zone gelée).

### 7. Faux échecs locaux (macOS) — pas des échecs CI

`tests/audit/fix-round-1` échouait 3 fois localement car `TMPDIR` pointe sur
`/var`, lien symbolique que le script d'audit refuse par sécurité. Avec un
`TMPDIR` réel (`/Users/…/lkdv-real-tmp`) : **20/20 passent**. Sous Linux CI
(`/home/runner/...`), pas de lien → ce n'est pas une cause d'échec CI.

## Ce qui a été traité dans ce chantier

| Cause | État |
|---|---|
| Gate 2.5 design governance (bloquait le job avant les tests) | **corrigé** |
| Credential littéral dans la Communauté | **corrigé** |
| Porte « TypeScript » | verte |
| Porte « Build » | verte |
| Porte « Lighthouse / bundle-analysis / build-ios » | vertes |
| 102 tests de contrats design préexistants | **documentés, non corrigés** |
| Tests HUB/Compas | **bloqués par le gel** |

## Recommandation

Un lot « contrats design » par écran, avec : capture de l'état actuel, mise à
jour du test (ou de l'UI) justifiée, revue visuelle, un commit par écran.
Sans ce lot, `quality-gates` restera rouge — ce n'est pas un problème de code
applicatif mais de dette de tests.


---

# Mise à jour après intégration (même journée)

Les PR #128 (gouvernance + credentials), #131 (contrats Compte), #133 (code
mort), #135 (4 bugs réels) sont fusionnées. Mesure sur les 48 fichiers
initialement rouges, sur `main` à jour :

`606 tests exécutés · ~589–601 passent · 45–48 échouent selon la charge`

Les échecs restants se répartissent ainsi :

| Famille | Volume | Cause / décision |
|---|---:|---|
| Création Communauté (`create-*`) | ~17 | Le pager du formulaire est réduit à **une** étape alors que le contrat en attend quatre (Format/Médias/Détails/Publication). Décision produit requise. |
| `community-feed-contract` | 4 | Contrat d'assemblage du fil (drawers/recherche) non satisfait par le rendu actuel. |
| Contrats Compte résiduels | 5 | Divergences réelles de design (variables de verre v17/v18, lentille v21, `openSheet` v11, `tileArt` v13, endpoint v8) — arbitrage design. |
| Zones gelées HUB/Compas | ~6 | **Interdit de toucher** par mandat. |
| Cartes | 2 | `preconnect` du layout partagé, scan trop large. |
| Divers design | ~8 | `navigation-glass-a11y`, `lot2-shell`, `m02`, `task-2a`, `stories-viewer`, `icon-resolution`, `camera`. |
| Tests d'intégration instables | 0–7 | `ProfileDrawerBootstrap`, audits sous charge : varient d'une exécution à l'autre, sans lien avec ce chantier. |

Aucun de ces tests n'a été désactivé ou affaibli ; les causes sont documentées
au cas par cas.
