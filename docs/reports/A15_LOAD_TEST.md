# A15 — Tests de charge locaux (preuves exécutées)

Date : 2026-09-11 · Worktree : `worktrees/ai-finalization` (branche `audit/adventure-intelligence`)
Environnement : Supabase local Docker (`supabase_db_ai-finalization`, PostgreSQL 17.6, 127.0.0.1:54322 / PostgREST 127.0.0.1:54321) + serveur Next local (`next start -p 4028`, build de production).
Machine : AMD Ryzen 7 7800X3D (16 threads), 32 GB RAM·Windows, Node v24.18.0.
Résultat machine : `docs/reports/A15_LOAD_TEST.json` (généré par le script, non retouché).

> **Limite explicite : environnement local Docker ≠ production.** Les chiffres ci-dessous
> mesurent le chemin de données réel sur une base locale, sans TLS, sans CDN, sans
> connection pooler, sans WAF, tous processus sur la même machine. Ils ne constituent
> **pas** une garantie de capacité de production.

## Protocole exécuté

| Élément | Valeur réelle |
|---|---|
| Script | `scripts/ops/a15_load_test.mjs` (garde-fou : toute cible non locale refuse de démarrer) |
| Durée / concurrence | 15 s par scénario · 20 connexions |
| Données | 2 000 signalements synthétiques `confirmed` autour de (45,1 ; 2,8), 1 plan + 1 version + 3 décisions (utilisateur jetable local) |
| Nettoyage | fixtures restantes : **0** · flags actifs en fin de test : **aucun** |
| Moteur proximité | autocannon 8.0.0 (API programmatique, devDependency) sur `POST /rest/v1/rpc/a5_terrain_reports_near` (anon local) |
| Moteur conditions | générateur HTTP natif Node avec cookie de session `@supabase/ssr` réel et `X-Forwarded-For` tournant (le limiteur A11 est par IP : 30 jetons, recharge 0,5/s) |
| Moteur plan | `pg` direct, 3 requêtes identiques à `getAdventurePlan` (plan + dernière version + décisions) |

p95 autocannon : non exposé nativement par la v8 (bornes p90 et p97,5) — interpolation
linéaire documentée dans le script (`p95FromAutocannon`).

## Résultats réels (15 s, 20 connexions, 2 000 signalements)

| Scénario | Moteur / chemin | Requêtes | Débit | p50 | p95 | p99 | 4xx | 5xx | Erreurs | Verdict seuil A12 (p95 < 300 ms, 0 5xx) |
|---|---|---|---|---|---|---|---|---|---|---|
| Proximité (RPC PostGIS) | autocannon → PostgREST → `a5_terrain_reports_near` | 76 764 | 5 118 req/s | 75 ms | **142 ms** | 157 ms | 0 | 0 | 0 | **PASS** |
| Lecture conditions | Next `GET /api/terrain/conditions` (200/200, JSON réel) | 5 272 | 350,8 req/s | 55,8 ms | **71,0 ms** | 83,1 ms | 0 | 0 | 0 | **PASS** |
| Lecture plan (couche SQL) | `pg` direct, 3 requêtes `getAdventurePlan` | 82 190 | 5 475,9 req/s | 3,6 ms | **4,3 ms** | 6,0 ms | 0 | 0 | 0 | **PASS** |

Statuts HTTP observés : `{"200": 76 764}` (proximité), `{"200": 5 272}` (conditions).
Aucun 4xx inattendu, aucun 5xx, aucune erreur réseau sur les trois scénarios.

## Commandes exactes (reproductibles)

```powershell
# Build local (env Supabase locale, jamais la production) puis serveur Next
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='<anon locale demo>'
$env:SUPABASE_SERVICE_ROLE_KEY='<service_role locale demo>'
npm run build
node node_modules/next/dist/bin/next start -p 4028

# Test de charge complet
node scripts/ops/a15_load_test.mjs --duration 15 --connections 20 --reports 2000 `
  --next-url http://127.0.0.1:4028 --out docs/reports/A15_LOAD_TEST.json
```

Le script crée lui-même l'utilisateur jetable local (API admin locale), ouvre une
session, bascule `terrain_live` ON le temps du scénario conditions puis OFF, et
supprime toutes ses fixtures en sortie (vérifié : 0 résidu).

## Limites et non-couverture

1. **Local ≠ production** : pas de TLS, CDN, pooler, multi-instance, ni rate limiting
   distribué. Les seuils p95 < 300 ms du plan A12 restent à re-mesurer sur
   l'environnement de test distant avant tout palier ≥ 20 %.
2. **Scénario conditions** : la limite 30 jetons / 0,5 jeton/s par IP est contournée
   par rotation d'IP (sinon, comportement attendu : 429 après la rafale). Un vrai
   client unique doit respecter `Retry-After`.
3. **Génération de plan non testée en charge** : coût IA (OpenRouter) et latence
   LLM ne sont pas mesurables localement sans clé et sans quota — voir
   `A15_COSTS.md` ; le scénario mesure uniquement la lecture de plan (couche SQL).
4. **Un seul échantillon matériel** : un seul poste ; la batterie/appareils réels
   relèvent de `A12_LOAD_AND_DEVICE_TEST_PLAN.md` (campagne humaine).
5. Les tuiles OpenTopoMap/OSM ne sont pas chargées par ces scénarios (pas d'egress
   tuiles mesuré).
