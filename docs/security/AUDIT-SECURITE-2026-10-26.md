# Audit de sécurité — LKDV (Next.js 15 + Supabase + Workers)

**Date :** 2026-10-26
**Périmètre :** dépôt `~/Desktop/lkdv-cloudflare` @ `e8de2e38` (187 routes API, 794 fichiers, base Supabase `icxyvwzfjbflcbqukpfz`)
**Méthode :** 3 audits parallèles (routes API, frontières client/secret, injections/XSS), lecture des 187 `route.ts`, grep exhaustif, advisors Supabase (security), requêtes `pg_policies` / `pg_proc` / `information_schema`, test d'exploitation réel sur une policy sensible, `npm audit`.

---

## 1. Verdict

**Aucune injection SQL, aucune XSS exploitable, aucun secret commité, aucun `eval`/`child_process`, RLS des messages vérifiée par un test réel.**
Le risque réel est ailleurs : **une signature `service_role` guidée par des colonnes écrites par le client** (IDOR critique), **trois routes d'effet de bord sans authentification**, et **deux redirections ouvertes**.

| Sévérité | Nombre | État |
|---|---|---|
| Critique | 1 | **corrigé** (stories media) |
| Élevée | 4 | **3 corrigés**, 1 IDOR kit corrigé |
| Moyenne | 10 | 2 corrigés (checkout, JSON-LD), 8 planifiés |
| Faible | 173 routes + dette diverse | documentés |

---

## 2. Critique — corrigé

### C1. IDOR par signature service_role sur `/api/stories/[id]/media`
`storage_bucket` et `storage_path` sont écrits par le client (`StoryCreateForm.tsx:110-111`) et la RLS `stories_insert_own` ne vérifie que `author_id`. La route les passait tels quels à `service_role.storage.createSignedUrl`.
**Impact :** tout compte connecté pouvait lire n'importe quel objet privé (`user-documents` = passeports/documents de voyage, `message-attachments`, `outing-media`, `stories-private` d'autrui).
**Correction :** liste blanche `['stories-private']`, chemin obligatoirement préfixé par `${author_id}/`, et `image_url` legacy restreinte à l'origine Storage du projet. `tsc` 0, route inchangée pour les stories légitimes.

---

## 3. Élevées — corrigées

| # | Faille | Preuve | Correction |
|---|---|---|---|
| E1 | `/api/notifications/digest` GET/POST anonyme → `send_digests` en service_role puis déclenchement de `process` (campagne email/push complète en un onglet) | `notifications/digest/route.ts:30-53` | `isCronAuthorized()` sur GET et POST (401 sinon) |
| E2 | `/api/notifications/process` POST anonyme, service_role, Resend + web-push | `notifications/process/route.ts:49` | `isCronAuthorized()` (401) ; le déclencheur interne transmet `Authorization: Bearer CRON_SECRET` |
| E3 | `/api/demo-login` GET → session de démo sans interrupteur (login CSRF par simple lien) | `demo-login/route.ts:53` | exige `DEMO_AUTO_LOGIN === 'true'`, sinon 403 |
| E4 | IDOR `kit_id` sur `/api/materiel/share` : token créé pour un kit tiers, lecture `service_role` d'un kit privé | `materiel/share/route.ts:31` | vérification `materiel_kits.id = kit_id AND user_id = auth.uid()` avant insertion (404 sinon) |

## 4. Moyennes — 2 corrigées, 8 à planifier

**Corrigées**
- **Redirection ouverte** `/connexion?next=/\evil.com` (`connexion/page.tsx:27`) → `safeNextPath()` (refuse `//`, `\`, caractères de contrôle) ; sink `router.push` inchangé.
- **Redirections Stripe** `success_url` / `cancel_url` fournies par le client (`checkout/route.ts:155`) → même origine que `NEXT_PUBLIC_SITE_URL`, sinon retour par défaut.
- **JSON-LD** de `/pays/[code]` (contenu généré) → `serializeJsonLd()`.

**À planifier (priorité décroissante)**
1. `/api/ai/chat-completion` : auth seulement si `NODE_ENV === 'production'` et `...body.parameters` après `api_key` → modèle/paramètres client (coût).
2. `/api/hike-sessions/[id]` : `select('*')` expose `positions_geojson` / `positions_timed` (GPS horodaté) dès qu'un carnet est public.
3. `/api/rewards/{claim,withdraw}` : aucun schéma zod (montant sans borne haute, provider libre).
4. `/api/admin/rewards` : pas de schéma, `error.message` renvoyés, écriture en client anon.
5. `/api/og-preview`, `/api/indexnow` : publics sans rate limit (indexnow action `sitemap` à réserver au cron).
6. Rate limiting mémoire locale (`checkout`, `discovery/search`, `pays/[code]`) contournable en multi-instances → `enforceRateLimit`.
7. 17/18 crons comparent le secret hors temps constant → `isCronAuthorized`.
8. 18 routes renvoient `error.message` au client.

## 5. Base de données (advisors + inspection)

RLS des objets sensibles **conforme**, vérifiée par test réel :
- test d'insertion dans une conversation dont le compte n'est pas membre → **403** (`new row violates row-level security policy`) ;
- `messages` : INSERT `sender_id = auth.uid()` **et** `is_active_conversation_member` ;
- `conversation_members` / `conversations` : appartenance et rôles vérifiés ;
- policies `essai_sans_ecriture_publique` (40 tables) : **RESTRICTIVE**, elles n'élargissent rien (faux positif du linter) ;
- storage `message-attachments` : bucket **privé**, 25 Mio, liste MIME blanche, INSERT `uid` en 2ᵉ segment + membre de la conversation, SELECT membres, DELETE expéditeur ;
- service_role jamais utilisé côté client (0 marqueur dans les 365 chunks publics) ; `.env.local` non suivi.

Points ouverts (WARN/INFO, non exploitables en l'état) :
| Constat | Sévérité | Remédiation |
|---|---|---|
| Protection « mots de passe compromis » (HIBP) désactivée | Moyen | activer dans Auth → Password Security |
| `public_profiles` en `SECURITY DEFINER` | Faible | vue filtrée par `auth.uid()` et `profile_visibility` ; à garder sous surveillance |
| 13 fonctions `SECURITY DEFINER` exécutables par `anon` (`lkv_can`, `is_conversation_member`, `is_group_member`, `get_user_signature`…) | Faible | oracles d'existence/membership ; révoquer `EXECUTE` sur celles non publiques |
| Extensions `postgis`, `pg_trgm`, `unaccent` dans `public` | Faible | déplacer vers `extensions` |
| `spatial_ref_sys` sans RLS (table PostGIS) | Info | activer RLS sans policy |
| 6 vues matérialisées lisibles par `anon` | Info | données analytiques publiques |
| 40 tables RLS activée sans policy | Info | fermées par défaut, aucun accès API |

## 6. Frontières client / secrets / injections

- Aucun composant `'use client'` ne lit de variable serveur ; aucune `NEXT_PUBLIC_*` sensible (seule `NEXT_PUBLIC_ARCGIS_API_KEY` est un jeton facturé — restreindre le référent).
- `dangerouslySetInnerHTML` : 32 occurrences, 18 JSON-LD (17 sur constantes), 0 XSS exploitable ; helper `serializeJsonLd` disponible, appliqué à la page pays.
- `innerHTML` : 65 sinks, dont 56 dans deux runtimes de maquette avec données littérales ; `esc()` non appliqué partout → risque si bascule sur des données serveur.
- `HikeReportPDFService` : `document.write` non échappé, **zéro appelant** (code mort).
- Aucun `eval`, `new Function`, `child_process`, iframe, `window.parent` ; `dangerouslyAllowSVG: false`.
- SSRF `/api/og-preview` durci (DNS revalidé à chaque saut, 3 redirections, 100 Ko, 3 s).
- Webhook Stripe : signature vérifiée, fail-closed.

## 7. Dépendances (`npm audit --omit=dev`)

29 vulnérabilités : **3 critiques, 14 élevées, 12 modérées**. Corrections disponibles sans changement majeur.

| Paquet | Sévérité | Correctif | Exposition |
|---|---|---|---|
| `next` 15.5.27 | Critique (cache poisoning SSG/ISR + avis liés) | 15.5.28 | runtime |
| `@capacitor/ios` / `@capacitor/android` 8.5.0 | Critique (contenu distant chargé à l'origine de l'app) | 8.5.1 | app mobile |
| `zod` < 4.6.6 | Élevée (DoS mémoire) | 4.6.6 | validation serveur |
| `undefined 7.x`, `body-parser`, `source-map-js`, `vite`, `toml`, `brace-expansion`, `cf`, `@modelcontextprotocol/sdk` | Élevées | patches | build/outillage pour la plupart |

## 8. Réserve de méthode

- Aucun test d'exploitation HTTP sur `/api/notifications/process` et `/api/demo-login` : les gardes sont établies par le code ; la prod est vérifiée après déploiement (401/403 attendus).
- Les politiques RLS ont été lues dans la base **et** les migrations ; une policy posée à la main hors migration resterait invisible.
- Les 173 routes classées « Faible » n'ont pas toutes été lues intégralement (échantillon complet sur account/compte/marketplace/trips/terrain/orders).
