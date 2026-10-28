# RAPPORT FINAL · Explorer v2

Date : 2026-10-28 · Branche : `feat/explorer-v2` · Base : `feat/explorer-v2` issue de
`0e0a35e4` (ancêtre de `origin/main` `4969d92a`).

## 1. Ce qui est fait

### Fondations (P0)
- Worktree isolé, `npm ci` propre, `explorer:verify` implémenté (10 étapes).
- Audit BDD revérifié ligne à ligne → `AUDIT_VERIFIE.md` (7 écarts découverts, dont
  **0 région française** dans `admin_regions_geo`, **0 politique RLS** sur `geo_pois`).
- 8 skills chantier installées dans `.agents/skills` et `.agent/skills`.

### Données et sécurité (P1)
- 2 migrations appliquées sur `icxyvwzfjbflcbqukpfz` :
  `activity_sessions`, `activity_points`, `finish_activity_session` (SECURITY DEFINER),
  `country_practical`, `osm_poi_cache`, extension `sos_alerts` (6 colonnes),
  `activity_catalog.escalade-voie`, `explorer_sport_map` (9 sports),
  flag `explorer_v2_enabled` (0 %), politiques RLS (9), index GIST.
- RPC `explorer_pois` (**115 ms**), `explorer_place` (**172–210 ms** après réécriture
  d'un premier jet à 3 113 ms), `explorer_routes` (**286 ms**).
- 522 repères OSM réels importés sur les Alpes (260 sommets, 93 belvédères,
  85 cols, 170 arrêts, 24 parkings) — Le Brévent, Aiguille du Midi, Mont Blanc du Tacul.
- 4 routes API (`/api/explorer/v2/{countries,place,weather,search}`) avec Zod et cache.

### Moteur carte et coquille (P2/P3)
- `MapStage` unique chargé en différé, projection globe → mercator, relief terrarium
  1,3 dès le niveau 3, couches pays/régions/itinéraires/trace.
- Feuille à 4 crans (peek 176 / low 300 / mid 52 % / full 88 %), glissement au doigt,
  capsule d'onglets avec lentille (libellé à côté de l'icône), mini-sélecteur,
  pastille d'activité, SOS, toast, barre basse unique.
- 237 pays Natural Earth, 239 fichiers de régions, résolution de la région sous le
  doigt par point-dans-polygone.
- 41 scènes de la maquette chargeables par `?scene=` (hors production).

### Preuves
- 14 tests unitaires verts (store, haptique, scènes, géométrie, point-dans-polygone).
- 10 tests Playwright `@explorer-v2` : **20/20 verts** (10 tests × 2 projets
  `mobile-chromium` et `mobile-webkit`, build de production, `--workers=1`).
- Captures réelles de 41 écrans → `docs/explorer-v2/preuves/screens/`,
  paires de parité assemblées → `docs/explorer-v2/parite/`.
- Build de production vert, `next lint` vert, `tsc --noEmit` vert sur les fichiers Explorer.

## 2. Mesures

| Mesure | Valeur | Budget | État |
|---|---|---|---|
| First Load JS `/explorer` | **342 Ko** | ≤ 170 Ko | ❌ (legacy `ExplorerClient` encore importé) |
| `explorer_pois` | 115 ms | < 300 ms | ✅ |
| `explorer_place` | 172–210 ms | < 300 ms | ✅ |
| `explorer_routes` | 286 ms | < 300 ms | ✅ |
| Build | vert (54 s) | — | ✅ |
| Lint | vert (warnings préexistants) | 0 erreur | ✅ |
| Tests unitaires Explorer | 14/14 | 100 % | ✅ |
| Tests e2e Explorer | 20/20 (2 projets) | 100 % | ✅ |

## 3. Limites restantes (chacune avec sa preuve)

1. **Bundle à 342 Ko** au lieu de 170 Ko : `src/app/explorer/page.tsx` importe encore
   `ExplorerClient` (legacy) en plus d'`ExplorerV2`. La suppression du legacy (P10-04)
   divise le bundle ; elle est volontairement reportée pour garder le retour arrière
   (flag à 0 %). Preuve : ligne `ƒ /explorer 40.2 kB 342 kB` de `next build`.
2. **Géométries en base** : les 49 617 lignes de `admin_regions_geo` restent sans
   géométrie et la France n'a aucune ligne. Les régions sont servies par Natural Earth
   en statique. Preuve : `AUDIT_VERIFIE.md §2.1`.
3. **Faits pratiques pays vides** : `country_practical` est créée mais sans import
   Wikidata ; les blocs urgences/prises/conduite affichent l'état vide. Preuve :
   `select count(*) from country_practical` = 0.
4. **Hiérarchie P0–P3, 13 styles de tracés, survol 3D, orbite 40 s, hors-trace,
   SOS maintenu, bilan en base, zone hors ligne, Live Activity** : non implémentés.
   Preuve : `ETAT_DES_POINTS.md`.
5. **Parité 42 écrans** : les captures existent, la revue visuelle paire par paire
   n'est pas terminée ; `PARITE.md` donne le statut honnête écran par écran.
6. **Aucun test sur authentifié** : pas de compte de test, donc RLS croisée et
   écriture d'activité non exercées.

## 4. Décisions

15 décisions consignées dans `DECISIONS.md` (worktree, régions Natural Earth,
policy `geo_pois`, contrainte de sous-types, import Overpass ciblé, réécriture de RPC,
capsule locale, barre basse unique, haptique `rigid`, flag, clé serveur, `?scene=`,
Playwright, population masquée, avatars masqués).

## 5. État de la livraison

- Commit local : `cc44413c1` sur `feat/explorer-v2`.
- **Push refusé par GitHub** (403, jeton du trousseau expiré, pas de clé SSH,
  `gh` absent, MCP GitHub en lecture seule) : voir `BLOCAGES.md #11`.
  La branche est donc livrée localement avec le patch de code
  `docs/explorer-v2/` et les preuves ; deux commandes suffisent à Tony pour
  pousser et ouvrir la PR.
- Gate `npm run explorer:verify` : voir `docs/explorer-v2/VERIFY_LAST.md`
  (artifact réel de la dernière exécution).

## 6. Commandes de reproduction

```bash
npm ci
npm run type-check                 # vert hors fichiers legacy
npx vitest run tests/explorer-v2   # 14 tests
EXPLORER_V2_E2E=1 NEXT_PUBLIC_EXPLORER_SCENES=1 npm run build
EXPLORER_V2_E2E=1 npm run start    # http://localhost:4028
PW_BASE_URL=http://localhost:4028 npx playwright test tests/explorer-v2 \
  --project=mobile-chromium --project=mobile-webkit --workers=1
node scripts/explorer-v2/capture-scenes.mjs --base=http://localhost:4028
node scripts/explorer-v2/build-geo.mjs     # régénère les fonds Natural Earth
node scripts/explorer-v2/click-inventory.mjs --base=http://localhost:4028
npm run explorer:verify            # gate complète (encore rouge : cf. §3)
```
