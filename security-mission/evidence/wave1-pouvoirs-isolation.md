# Wave 1 — Pouvoirs & isolation (rapport de découverte, 2026-10-09)

Méthode : 3 sous-agents lecture seule, lectures strictes `git show HEAD:<path>` / `git grep` sur
`14d80de8`. Aucune exécution. Faits avec `chemin:ligne`. Aucune conclusion de vulnérabilité.

## 1. Matrice des 123 routes API (synthèse) — source : agent inventaire

Fait structurel majeur : `src/middleware.ts:6` ne protège QUE `/admin` et `/checkout` (pages), et le
matcher `src/middleware.ts:134-153` ne contient AUCUN motif `/api/**` → 0 handler API couvert par le
middleware ; toute protection doit être dans la route.

| Classe | Nb | Contrôle |
|---|---|---|
| Cron Bearer CRON_SECRET | 15 | secret, ordre correct (rejet avant effets) |
| Webhooks signés | 2 | stripe constructEvent ; affiliate HMAC timing-safe |
| Admin (getUser + is_admin) | 3 | admin/rewards (is_admin seul), ai/ping, hub/dashboard |
| Session Supabase | 53 | getUser + 401/403, zod ~30, rateLimit ~30 |
| Auth conditionnelle `NODE_ENV==='production'` | 2 | ai/chat-completion:66, guides/[country]/ask:38 |
| **Sans contrôle d'identité visible** | **48** | cf. §2 |

## 2. Routes sans contrôle d'identité (48) — catégorisation honnête

- **Publiques par design probable (lecture, RLS anon)** : amenities (RL IP:42), badges/unread
  (getUser optionnel:15), discovery/search (RL IP:46), elevation (RL:42), geocode (RL:30), hikes,
  hikes/[id], hikes/geojson, pays/* (RL:305), pois (RL:21), weather (RL:33), trails (RL:17),
  produit/*-check, voyages GET, voyages/mine (getUser optionnel), kits/discovery, carnets/[id],
  hike-sessions/[id], kit-report/generate (auth optionnelle:47 + RL), trip-assistant (auth
  optionnelle:19 + RL), trips/autogen (auth optionnelle + RL + service role en aval),
  materiel/optimize (getUser non-gardien:59, zod:62, pas de RL), materiel/scan (idem),
  identity/signature (userId query → RPC re-vérifie auth.uid() côté SQL), og-preview (garde SSRF),
  route/route.ts (allowlist + RL), route/cache (regex + RL + service role), terrain/conditions,
  trajectoire/narration (RL IP), paiements webhooks, etc.
- **À effet de bord déclenchable sans identité** (les plus sensibles) :
  - `notifications/process/route.ts:44` : AUCUN contrôle ; service role ; envoie emails Resend
    (`:122`), web-push, modifie statuts de livraison ; lit 10 `notification_deliveries` pending.
  - `notifications/digest/route.ts:30/34` : AUCUN contrôle ; service role ; RPC `send_digests` puis
    appelle `/api/notifications/process` (`:44-48`).
  - `pays/[code]/route.ts:299` : GET → génération IA payante si cache froid, `?refresh=1` (:315)
    force le contournement ; écrit un fichier cache (`:72`).
  - `checkout/route.ts:137` : POST sans 401 (getUser optionnel :180) ; `success_url`/`cancel_url`
    construits depuis le body (`:214-216`) sans allowlist visible.
  - `seed/route.ts:108` : POST ; prod → 403 (`:109`) ; `SEED_SECRET` en query (`:118`) comparé `!==`
    (`:120`) ; service role avec repli anon (`:125-127`) ; inserts multi-tables si autorisé.
  - `dev/generate-country-blocks/route.ts:15` : GET ; garde NODE_ENV dev seulement (`:16`) ;
    génération + review IA.
- **Divergence interne** : 3 routes utilisent un rate-limit mémoire par instance au lieu de la lib
  Upstash : checkout (`:140`), discovery/search (`:46`), pays/[code] (`:305`) — cf. H-009.

## 3. Crons (15) — contrôle homogène

Gabarit exact (les 15) : `if (!secret || authHeader !== 'Bearer ' + secret) 401` AVANT tout effet.
- Comparaison `!==` non timing-safe (les 15) — H-006. `timingSafeEqual` seulement dans
  `affiliateEngine.ts:118,223`.
- 6 GET mutantes : cleanup-ephemeral-groups:13, cleanup-solo-crews:14, expire-live-positions:14,
  finalize-kit-attributions:13, refresh-atlas-density:13, refresh-kit-scores:13 — H-007.
- 6 renvoient `err.message` brut : cleanup-ephemeral-groups:53, cleanup-solo-crews:77,
  expire-live-positions:53, finalize-kit-attributions:34, refresh-atlas-density:34,
  refresh-kit-scores:34 — H-008.
- Seule route avec entrées : refresh-country-guides:32-36 (`scope/countries/limit/offset/force`,
  pas de whitelist `scope`, pas de check config 503) — H-015.
- Aucun déclencheur cron dans le dépôt (`vercel.json` absent à HEAD) : plateforme indéterminée.

## 4. Admin

- `/api/admin/rewards` : POST ; `rpc('is_admin')` (`:16`) ; actions finalize_period / process_withdrawal
  / process_contribution / update_config ; paramètres vérifiés en présence seulement ; `error.message`
  renvoyé (`:41,59,79,99`). Point notable : `update_config` upserte `reward_config` (`:92-99`).
- L'UI `/admin` (4 fichiers) : contrôle SSR à vérifier (page/layout) — prochaine passe.

## 5. Base de données (statique) — source : agent DB

- `lkv_can` : `20260907000000:82-258` DEFINER; `search_path` figé par ALTER (`20260913010000:133`) ;
  `REVOKE anon` (`20260917010000:106`).
- Divergences SQL↔miroir TS (détaillées) : (1) policies DELETE crew_members/trip_participants
  ajoutent `OR auth.uid()=user_id` quel que soit le statut (`:296`, `:315`) — non modélisé par le
  miroir ; (2) SELECT crew_members passe par `lkv_can('crews',crew_id,'select')` (`:284`) → membres
  lisibles pour crew public/link, le miroir exige adhésion active ; (3) SELECT trip_participants
  passe par `lkv_can('trips',trip_id,'select')` (`:303`) — miroir exige `confirmed` ; (4) miroir
  `Visibility` inclut `'unlisted'` absent du CHECK SQL (`:30`). H-012.
- Aucune policy RESTRICTIVE (0) ; FORCE RLS sur 20 tables (hors crews/trips/crew_members/
  trip_participants).
- Storage : buckets `carnet-media` (public), `gear-photos` (public), `user-documents` (privé, policy
  par folder uid), `group-media` (**public**, limite 10 MiB, mime incluant `application/gpx+xml` et
  `octet-stream`) — **aucune policy storage.objects trouvée pour group-media** ; `message-attachments`
  (privé, policies is_conversation_member re-écrites initplan `20260925010000`).
- SECURITY DEFINER : ~190 définitions ; 50 sans `search_path` dans la même instruction (statut final
  souvent corrigé par ALTER ultérieur — à vérifier en base locale via `proconfig`) — H-013.
  Cas inspectés : is_admin OK (search_path + REVOKE anon), can_read_trip/can_edit_trip (sp OK,
  REVOKE anon, pas de REVOKE PUBLIC trouvé), get_kit_journal (sp OK, GRANT authenticated, AUCUN
  contrôle auth.uid() interne — lecteur arbitraire ? À vérifier : la fonction prend-elle un
  paramètre de kit et qui peut lire quoi — vague 1bis), get_user_signature (contrôle interne OK),
  handle_kit_lineage (trigger only, REVOKE all), finalize_reward_period / process_withdrawal
  (is_admin() interne ; search_path via ALTER 20260917010000:164-165).
- GRANT EXECUTE vers anon : 7 lignes relevées (dont `20260911551000:100` = is_admin — révoqué ensuite
  par `20260926010000:19`).

## 6. Faits non déterminés (à ne pas présenter comme acquis)

- RLS effective en production (proacl réel, droits par défaut, policies créées hors migrations).
- ACL finale des 50 SECURITY DEFINER sans fenêtre search_path (ALTER ultérieurs).
- Usage applicatif réel du bucket group-media (traces GPX personnelles ? intention public ?).
- Quis peut appeler get_kit_journal et avec quels paramètres (contrôle interne absent).
- Comportement réel des routes sans env configuré (503) vs déployé.
- Déclencheurs des crons et protection plateforme des routes notifications.
- CSRF : cartographie des Server Actions et des mutations sans origin-check non faite (F-001).
- Vérification dynamique d'aucune de ces observations (aucune exécution, conforme à la policy).
