# A14 — Audit sécurité ciblé & correctifs appliqués

Date : 2026-09-11 · Périmètre : surfaces d'abus (Terrain Live, uploads photo,
GeoJSON/carto), secrets de signature, routes sensibles (cron, dev, seed).
Méthode : revue de code ciblée + tests d'abus exécutés
(`tests/security/a14-abuse.spec.ts`, 19 tests verts).

## Findings et statut

| ID | Sévérité | Finding | Statut |
|---|---|---|---|
| SEC-A14-01 | Haute | `/api/hikes/geojson` acceptait toute bounding box et toute tolérance : requêtes planétaires possibles (coût RPC + payload non bornés) | **Corrigé** — `src/lib/geo/bbox.ts` (emprise ≤ 20°/axe avec recentrage, tolérance bornée [1e-5, 1e-2], refus des paramètres partiels/NaN/hors monde) + tests TEST-A14-ABUSE-GEOJSON-01…06 |
| SEC-A14-02 | Haute | Jeton d'invitation équipage signé HMAC avec **secret de repli en dur** (`lkdv-default-crew-secret-2026`) si l'environnement était incomplet | **Corrigé** — fail-closed : `CREW_INVITE_SECRET` (ou `SUPABASE_SERVICE_ROLE_KEY`) exigé ; création ⇒ erreur, vérification ⇒ null. Tests TEST-A14-ABUSE-SECRET-01/03 |
| SEC-A14-03 | Haute | URL de document sensible signée HMAC avec **secret de repli en dur** (`lkdv-doc-secret-2026`) | **Corrigé** — fail-closed : `DOC_SIGNING_SECRET` (ou service role) exigé, comparaison `timingSafeEqual` conservée. Tests TEST-A14-ABUSE-SECRET-02/03 |
| SEC-A14-04 | Vérifié OK | Terrain Live : rate limit 10 signalements/h (3/h compte < 24 h), cooldown 2 confirmations/5 min, confirmation unique, réputation plafonnée | En place (a5/a9), verrouillé par TEST-A14-ABUSE-TERRAIN-01…05 |
| SEC-A14-05 | Vérifié OK | Photos : **aucun upload binaire** côté API — URL http(s) uniquement + taille déclarée ≤ 5 Mo (validée aussi côté route Zod avant écriture) | En place, verrouillé par TEST-A14-ABUSE-PHOTO-01…05 (`formData(`/`upload(` = 0 occurrence dans `src/app/api` et `src/lib/storage`) |
| SEC-A14-06 | Vérifié OK | 10/10 routes `api/cron/*` exigent `Authorization: Bearer $CRON_SECRET` | En place (vérifié par revue exhaustive) |
| SEC-A14-07 | Vérifié OK | `/api/dev/*` exige `NODE_ENV=development` ; `/api/seed` est inerte sans `SEED_SECRET` et compare le secret exact | En place |
| SEC-A14-08 | Ops | Restauration locale : rôle `postgres` non superuser ⇒ erreurs `permission denied` (spatial_ref_sys, vault) | **Documenté** — restauration via `supabase_admin` (`A14_BACKUP_RESTORE.md`) |

## Correctifs appliqués (fichiers)

- `src/lib/geo/bbox.ts` (nouveau) : validation/bornage pur et testable.
- `src/app/api/hikes/geojson/route.ts` : 400 sur paramètres invalides, en-tête
  `x-lkdv-bbox-clamped: 1` quand l'emprise/tolérance a été bornée, RPC non
  appelée en cas d'entrée invalide.
- `src/features/crews/lib/invitations.ts` : suppression du secret par défaut,
  résolution d'environnement, fail-closed.
- `src/features/affiliation/engine/affiliateEngine.ts` : idem pour les documents
  signés.

Preuve d'exécution réelle : RPC cartographique toujours fonctionnelle avec
l'emprise France par défaut (base locale) :

```text
POST /rest/v1/rpc/get_routes_for_map {France} → 200 {"type":"FeatureCollection","features":[]}
```

## Tests d'abus (exécutés)

```text
npx vitest run tests/security/a14-abuse.spec.ts
 ✓ 19 tests passed (GEOJSON 01-06, TERRAIN 01-05, PHOTO 01-05, SECRET 01-03)
```

## Risques résiduels (tickets a15, non bloquants a14)

1. **Rate limiting distribué** : les seaux `/api/terrain/conditions` sont en
   mémoire par instance (best-effort) — à remplacer par un store partagé
   (Redis/Upstash) avant montée en charge (a15).
2. **5xx / RUM** : supervision à brancher côté plateforme (`A14_OBSERVABILITY.md`
   §5) ; non mesurable localement.
3. **Revue RLS systématique** : couverte par les suites pgTAP existantes
   (a1/a2/a10/a11) ; toute nouvelle table doit embarquer ses policies + test.
4. **Secrets** : rotation trimestrielle et vérification `rg 'eyJ|sk-' src`
   (A12_RUNBOOKS §5). Les clés locales Supabase de démo ne sont jamais des
   secrets de production.
