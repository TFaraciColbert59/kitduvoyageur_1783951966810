# A9 — Audit de sécurité (Phase 9)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence`
Méthode : inspection statique du code et des migrations + suites pgTAP (exécution sur copie).

## 1. RLS (toutes tables du domaine)

| Contrôle | Statut |
|---|---|
| `adventure_data_consents` — propriétaire uniquement, `external_readiness` non octroyable | ✅ M1 + pgTAP RLS-01/02 |
| `trail_segment_features` — lecture publique non sensible, écriture service | ✅ M1 |
| `hike_sessions` (extension) — policy propriétaire existante conservée | ✅ M2 |
| `session_segment_passages` — propriétaire via session, écriture service | ✅ M2 + pgTAP RLS-03 |
| `performance_observations` — propriétaire, écriture service | ✅ M2 |
| `user_performance_profiles` (+versions) — propriétaire, écriture service | ✅ M3 + pgTAP RLS-04 |
| `segment_collective_aggregates` — seuil public ≥ 5 utilisateurs distincts | ✅ M4 + pgTAP RLS-05 |
| `terrain_reports` — aucune policy publique (identité protégée), vue dédiée | ✅ M5 + pgTAP RLS-06 |
| `terrain_report_confirmations` — propriétaire, 1 par utilisateur | ✅ M5 |
| `terrain_events` — actifs non expirés publics, pas d'identité | ✅ M5 |
| `adventure_plans` (+versions/décisions/runs) — propriétaire + `can_read_trip` | ✅ M6 + pgTAP RLS-07 |
| `segment_predictions`, `route_predictions` — propriétaire | ✅ M7 |
| `adventure_domain_events` — acteur en lecture, claim service-only | ✅ M8/M9 + pgTAP RLS-08/09 |
| Nouvelles tables FORCE RLS (consents, passages, observations, profils, prédictions) | ✅ |
| **Point ouvert** : policy legacy `public_read_user_profiles` (`20260713210000`) | ⚠️ à vérifier/fermer sur copie — correctif ciblé si confirmée |

## 2. APIs

- `POST /api/adventure/generate` : auth obligatoire (401), Zod (texte 10–2000), `force-dynamic`.
- `POST /api/terrain/reports` : Zod, `severity` requise, modération (10/h), description ≤ 1000.
- `POST /api/terrain/reports/[id]/confirm` : Zod, cooldown 2/5 min (429), unicité par utilisateur.
- `GET /api/terrain/conditions` : rayon borné 1 m–50 km (Zod), RPC sans identité.
- Crons : `CRON_SECRET` exigé (`process-hike-sessions`, `aggregate-segments`,
  `expire-terrain-reports`) — vérifié à l'exécution par en-tête Bearer.
- Erreurs : `{ error, details? }` ; aucun stack exposé.

## 3. Données d'entrée

- GeoJSON : validation Zod (LineString ou points), minimum 2 points,
  **plafond 50 000 points** (correctif A9) — rejet au-delà.
- Photos : `photo_url` validée (URL) ; aucun chemin d'upload de fichier exposé (storage non activé).
- Descriptions : ≤ 1000 caractères (schéma + base).
- Requêtes de proximité : rayon et coordonnées bornés.

## 4. Fonctions SQL et privilèges

- `SECURITY DEFINER` : `adventure_touch_updated_at` (non sensible),
  `a1_sync_terrain_report_counts`, `claim_pending_adventure_events`,
  `a2_claim_pending_sessions`, `a4_recent_eligible_segments` — toutes avec
  `SET search_path = public, pg_temp`.
- EXECUTE : révoqué pour `anon`/`authenticated` sur les fonctions de traitement (M9),
  y compris l'ancien `claim_pending_ai_jobs` (durcissement rétroactif).
- Aucune fonction `SECURITY DEFINER` exposée sans filtre.

## 5. Service role — inventaire

| Usage | Fichier |
|---|---|
| Cron sessions | `src/app/api/cron/process-hike-sessions/route.ts` |
| Cron agrégation | `src/app/api/cron/aggregate-segments/route.ts` |
| Cron expiration terrain | `src/app/api/cron/expire-terrain-reports/route.ts` |
| Lecture conditions publiques | `src/app/api/terrain/conditions/route.ts` |
| Création/confirmation terrain | `src/app/api/terrain/reports/*` |
| Génération de plan (persistance) | `src/app/api/adventure/generate/route.ts` |

Aucun client service-role n'est importé côté composant client (`server-only` respecté).

## 6. Secrets et journalisation

- Le client Supabase serveur exige les variables d'environnement et échoue explicitement
  sinon (`src/lib/supabase/server.ts`).
- **Finding F5 (préexistant)** : `src/lib/supabase/client.ts:65` conserve un fallback JWT
  **anon** en dur. Cette clé est publique par conception (soumise à RLS, embarquée dans le
  bundle) : l'impact sécurité est faible, mais la politique repo « clés jamais en dur » n'est
  pas respectée. Recommandation : suppression du fallback + échec explicite comme côté serveur,
  dans un correctif dédié (hors périmètre de cette branche pour ne pas risquer une build sans
  variable d'environnement).
- Journaux : erreurs techniques uniquement ; aucune donnée santé (aucune n'existe) ;
  aucun contenu de trace brute journalisé.

## 7. Suppression utilisateur (cascades)

`ON DELETE CASCADE` vérifié : `hike_sessions`, `session_segment_passages`,
`performance_observations`, profils (+versions), consentements, prédictions,
`adventure_plans` (+versions/décisions), `terrain_reports`, `terrain_report_confirmations`,
`adventure_domain_events` (acteur `SET NULL`), `lkv_events` (acteur `SET NULL`).

## 8. Findings résiduels

| # | Sévérité | Finding | Action |
|---|---|---|---|
| F1 | Moyenne | Policy legacy `public_read_user_profiles` potentiellement ouverte | Vérifier sur copie puis correctif ciblé (gate manuelle) |
| F2 | Faible | Octroi `anon` de la RPC de proximité sans effet (INVOKER + RLS) | Assumé, défense en profondeur |
| F3 | Faible | Upload photo : URL seulement, pas d'upload fichier | Storage/validation à activer si l'upload réel arrive (hors roadmap actuelle) |
| F4 | Faible | `positions_geojson` : pas de contrainte de taille en base | Plafond applicatif ajouté (50 000 points) ; contrainte DB envisageable en hardening continu |
| F5 | Faible | Fallback clé **anon** en dur (`src/lib/supabase/client.ts:65`) | Clé publique par conception ; supprimer le fallback dans un correctif dédié |

**Conclusion sécurité** : les frontières de données privées sont tenues par construction
(RLS + vues + seuils) et testées (pgTAP + tests TS). Aucun connecteur santé. Le seul point
ouvert (F1) est une dette préexistante à vérifier sur copie.
