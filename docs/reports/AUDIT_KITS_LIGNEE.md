# AUDIT — Lignées de kits (Lot 0 du chantier « L'Épreuve du terrain »)

Date : 2026-09-03 · Branche : `feat/lignees-kits` · Méthode : lecture directe des fichiers
(`src/` + `supabase/migrations/`, 111 migrations) par 2 agents d'audit + vérifications
manuelles. Aucune modification apportée. Projet Supabase réel : **`icxyvwzfjbflcbqukpfz`**
(eu-west-3, nom `lekitduvoyageur2`).

> ⚠️ **Écart constaté — project ID** : le plan maître (`docs/LKDV_Plan_Maitre.md`, Prompt #1)
> mentionne `lwrmuggefbmboikjgudc`. La config réelle (`.env.local`) et le MISSION_LOG
> (16/08/2026, « Push des 66 migrations ») désignent `icxyvwzfjbflcbqukpfz`. **C'est ce
> dernier qui fait foi.** Le chiffre « 66 migrations » est obsolète : 111 fichiers sont
> présents, tous synchronisés.

---

## 1. Cartographie des deux représentations du kit

### 1.1 `materiel_kits` — l'entité vivante (utilisateur)
- **CREATE** : `20260825000000_materiel_rebuild.sql:25-40` (+ `consumables jsonb` en
  `20260825030000:2`).
- **Colonnes** : `id uuid PK` · `user_id → auth.users CASCADE` · `name` · `description` ·
  `season` (CHECK printemps/ete/automne/hiver/toute_saison) · `total_weight_g` ·
  `is_public` · `is_favorite` · `is_trashed` · `cover_image_url` · `tags text[]` ·
  `search_vector tsvector` · `consumables jsonb` · `created_at`/`updated_at`.
- **Index** : user_id, is_public partiel, GIN search_vector.
- **Triggers** : search_vector (BEFORE INSERT OR UPDATE) + `set_updated_at`.
- **RLS** : activée. SELECT `own_or_public` (`auth.uid()=user_id OR is_public=true`) ;
  INSERT/UPDATE/DELETE `own` par `auth.uid()=user_id`.
- **Qui lit/écrit** : `POST /api/materiel/kits` (crée kit+items+history),
  `GET /api/materiel/kits` (liste user), `POST /api/materiel/fork` (duplique),
  `GET /api/materiel/share` (lecture via **service_role** pour les liens externes).
- **Volume** : non vérifiable sans MCP Supabase (à interroger avant Lot 1.3).

### 1.2 `materiel_kit_items` — les articles du kit vivant
- **CREATE** : `20260825000000_materiel_rebuild.sql:136-147` (+ `name` en
  `20260825010000:3`).
- **Colonnes** : `id uuid PK` · `kit_id → materiel_kits CASCADE` ·
  `product_ownership_id → product_ownership SET NULL` · `user_id → auth.users CASCADE` ·
  `quantity` · `category` · `weight_g` · `is_checked` · `name` · timestamps.
- **RLS** : activée, 4 policies `own` par `auth.uid()=user_id`.
- **➡ HYPOTHÈSE 1 — CONFIRMÉE (absence de `product_id`)** : aucune colonne ne référence le
  catalogue. Le seul pont vers un objet est `product_ownership_id` (inventaire personnel).
  **Bloquant commission et conservation** : sans `product_id`, impossible de joindre un item
  de kit à un `order_items` (qui référence `shop_products`).

### 1.3 `materiel_kit_history` — le journal (source d'audit)
- **CREATE** : `20260825020000_materiel_kit_history.sql:3-10`. Colonnes : `kit_id` ·
  `user_id` · `action` (CHECK : created/updated/deleted/restored/**forked**/optimized/
  compared) · `payload jsonb` · `created_at`.
- **RLS** : activée ; SELECT/INSERT/DELETE `own` (pas d'UPDATE, journal).
- **⚠️ Alimentée par l'application uniquement, aucun trigger.** C'est la seule trace du
  parent d'un fork (`payload.source_kit_id`).

### 1.4 `kit_reports` + `configurator_sessions` — le snapshot du configurateur
- **CREATE** : `20260715100000_configurator_sessions_kit_reports.sql`.
- `configurator_sessions` : `user_id → user_profiles(id)` (≠ auth.users !) + champs
  voyage/réglages. RLS own.
- `kit_reports` : `user_id → user_profiles` · `session_id → configurator_sessions SET
  NULL` · `selected_items/alternatives/consumables/bring_yourself/weight_breakdown` (jsonb)
  · `total_weight_g` · `total_price_eur` · `status` (draft/saved/…) ·
  `converted_to_inventory` · timestamps. RLS own.
- **AUCUN lien vers `materiel_kits`** (pas de `kit_id`, pas de FK). Le flux est :
  generate (IA configurateur) → save → convert-inventory (export vers `gear_items`).
- **❌ `configurator_sessions.user_id` pointe vers `user_profiles`, pas `auth.users`** :
  toute nouvelle FK utilisateur devra viser la même table ou être en cohérence.

### 1.5 `share_tokens` — le partage externe
- **CREATE** : `20260825000000_materiel_rebuild.sql:244-252`. Colonnes : `kit_id` ·
  `owner_id` · `token text UNIQUE` (gen_random_bytes(16) hex) · `permission`
  (lecture/fork/co_edition) · `expires_at` · `created_at`.
- **RLS** : activée, policies `*_owner` (auth.uid()=owner_id).
- **⚠️ Aucune policy de lecture publique via token** : le GET `/api/materiel/share`
  utilise le **service_role** pour contourner → fonctionne aujourd'hui, mais le lien
  partagé ne peut JAMAIS être lu qu'ainsi. À garder en l'état (ne pas ouvrir de policy
  publique sur cette table).

### 1.6 `kits` / `kit_items` — le catalogue éditorial (souches fondatrices)
- **CREATE** : `20260713000000_products_kits_experts_reviews.sql:67-106` ; RLS activée ;
  policies publiques de lecture + admin (is_admin()) en écriture
  (`20260728160000_fix_permissive_rls_policies.sql:339-345`).
- Seed de 3 kits presets (`20260808000000_seed_preset_kits.sql`).
- **Référents** : `custom_kit_items` et `weight_calculations` (le "kit" de
  weight_calculations pointe vers le catalogue, PAS vers materiel_kits).

### 1.7 Commerce — `orders` / `order_items`
- `orders` : **CREATE v1** (`20260713000000:203-214`), **CREATE v2 IF NOT EXISTS**
  (`20260715240000:7-22`) **jamais appliqué sur la v1** → colonnes réelles = v1 +
  ALTER lot6 (`20260810212000:122-127`) : `shipping_method_id`, `discount_code_id`,
  `tax_rate_id`, `shipping_address jsonb`, `billing_address jsonb`, `notes text`.
  - **❌ Hypothèse forte** : `payment_method`, `subtotal_eur`, `shipping_eur`,
    `loyalty_points_earned` (v2) **n'existent probablement pas** → l'INSERT du webhook
    (stripe/webhook/route.ts:76-87) écrirait des colonnes fantômes → `orderError` →
    retour `warning` 200 **sans commande créée**. **À prouver au Lot 3 par un test de
    repro** (fait partie du « tuyau percé »).
  - Pas de `stripe_session_id` (idempotence absente ; seul `order_number` UNIQUE).
  - RLS : activée, `users_manage_own_orders` ; policy anon supprimée.
- `order_items` : **CREATE** `20260715240000:25-37` (+ variant lot6). Colonnes :
  `order_id → orders CASCADE` · **`product_id → shop_products(id) SET NULL`** ·
  `product_slug/name/brand` · `quantity` · `unit_price_eur` · `total_price_eur` ·
  `transaction_type`. RLS : activation + policies par EXISTS orders.user_id.

### 1.8 `hike_sessions` — la preuve terrain
- **CREATE** : `20260809200000:5-19`. Colonnes : `user_id → auth.users CASCADE` ·
  `route_id → hiking_routes` · `carnet_id → carnets SET NULL` · `started_at` · `ended_at`
  · `distance_km numeric` · `duration_seconds` · `elevation_gain_m` · `positions_geojson
  jsonb` (LineString [lng,lat] simplifié) · `poi_events jsonb` · `narratives jsonb` ·
  `created_at`. RLS own. Index user_id/route_id/carnet_id.
- **➡ HYPOTHÈSE 2 — CONFIRMÉE (absence de `kit_id`)** : aucun rattachement à un kit
  utilisateur. `distance_km` vient du client (jamais recalculé serveur).
- 🔒 **RGPD** : les `positions_geojson` sont des données de localisation précises →
  jamais exposables via un partage de kit (contrainte du Lot 2.5).

### 1.9 Messagerie — **HYPOTHÈSE 5 : mécanisme de PJ typée CONFIRMÉ (existant)**
- Système canonique final : `20260831000000_messaging_system_canonical.sql` +
  `20260901000000_messaging_security_helpers.sql`.
- Tables : `conversations` (direct/group, direct_pair_key UNIQUE partiel) ·
  `conversation_members` (rôles, unread, triggers) · **`messages`** (content,
  `message_type`, **`metadata jsonb`**, reply_to, deleted_at ; trigger d'immuabilité sur
  champs) · **`message_attachments`** (message_id, file_url, file_name, file_type,
  file_size) · `message_reactions` · `message_mentions` · `user_blocks`.
- **PJ typée déjà en place** : `messages.metadata` porte `kind:'product'` /
  `kind:'trail'` (ProductMessageMeta / TrailMessageMeta dans
  `src/features/messaging/services/messaging.types.ts`), + bucket storage privé
  `message-attachments` + helpers `is_conversation_member` (SECURITY DEFINER avec
  `SET search_path = public, pg_temp`).
- **Implication Lot 5.3** : un message kit = `message_type`/`metadata` `kind:'kit'` suivant
  LE pattern existant (pas de greenfield, pas de nouvelle table).

### 1.10 Reward engine (support du Lot 6.5)
- `reward_config` (key/value jsonb, configs en base) · `reward_periods` · `reward_accounts`
  (user_id PK, points + **`available_cash`/`pending_cash`**) · `reward_transactions`
  (ledger append-only, triggers) · `pending_contributions` · `reward_withdrawals`
  (idempotency_key UNIQUE, paiement **`bank_transfer`**).
- **❌ Le « crédit boutique » n'existe pas** : le cash est retirable en virement bancaire
  uniquement ; aucun mécanisme d'échange points/cash contre des articles. Le plan du
  Lot 6.5 (« versement en crédit boutique via /fidelite + /recompenses ») s'appuie sur une
  hypothèse fausse → **décision de conception à trancher avec Tony** (étendre
  reward_accounts d'un mode store credit, ou table dédiée).
- Funk. reward : SECURITY DEFINER **sans `SET search_path`** (norme maison à durcir sur
  nos nouveaux objets).

---

## 2. Verdicts des 5 hypothèses du plan

| # | Hypothèse | Verdict | Preuve |
|---|-----------|---------|--------|
| 1 | `materiel_kit_items` n'a **pas** de `product_id` vers le catalogue | ✅ **CONFIRMÉE** | `20260825000000:136-147`, `20260825010000:3` (seuls `kit_id` et `product_ownership_id`) |
| 2 | `hike_sessions` n'a **pas** de `kit_id` | ✅ **CONFIRMÉE** | `20260809200000:5-19` (aucun ALTER ultérieur) |
| 3 | `/api/materiel/fork` crée un **orphelin**, source enfouie dans `materiel_kit_history.payload` | ✅ **CONFIRMÉE** | `fork/route.ts:30-38` (insert sans `forked_from`, nom « (copie) », `:59-64` history `payload.source_kit_id`) |
| 4 | `/api/checkout` ne pose **aucune metadata** → webhook sans user_id ni product_id | ✅ **CONFIRMÉE et aggravée** | `checkout/route.ts:156-174` (0 metadata) ; `webhook/route.ts:46-61` (metadata vide → fallback line_items SANS id) → `:98` `if (!item.id) continue` → **jamais d'`order_items`, jamais de `decrement_stock_on_order`** ; et `orders` insérée avec des colonnes probablement inexistantes (`:76-87`) |
| 5 | Table de messagerie réelle + mécanisme de PJ typée | ✅ **CONFIRMÉE (PJ typée existe)** | `messages.metadata` (kind product/trail) + `message_attachments` (canonical) |

---

## 3. Découvertes supplémentaires (hors plan, impactantes)

1. **Deux catalogues coexistent** : `shop_products` (boutique effective, cible de
   `order_items.product_id`) et `products` (legacy recréée, cible du checkout et des
   tables lot6). **Décision** : le futur `product_id` de `materiel_kit_items` devra
   référencer **`shop_products(id)`** pour que le JOIN d'attribution tienne sur une même
   table (écart au SQL figé du plan 1.1, à acter).
2. **`orders` : le schéma v2 n'est jamais actif** → le webhook écrit des colonnes
   fantômes. Si confirmé par test, l'INSERT `orders` échoue AUSSI (au-delà des
   `order_items`). Le Lot 3 devra : (a) migrer `orders` vers le schéma v2/lot6 complet,
   (b) poser `stripe_session_id UNIQUE`, (c) metadata sur le checkout, (d) durcir
   `decrement_stock_on_order` (search_path + verrou `FOR UPDATE`/UPDATE atomique).
3. **`decrement_stock_on_order`** (`20260715240000:71-115`) : SECURITY DEFINER sans
   search_path, opère sur `shop_products` en SELECT-then-UPDATE **sans verrou** (race).
   Une variante lot9 traite une autre signature (`order_id uuid`, sur `public.products`)
   → obsolète à auditer.
4. **`share_tokens`** : aucune policy publique — seuls le service_role et le owner lisent.
   À conserver (le partage externe passe par la route, pas par RLS ouverte).
5. **`materiel_kit_history` sans trigger** : tout keep-alive de la lignée doit écrire
   l'événement en dur (conséquence : le trigger de filiation du Lot 1 écrira aussi une
   ligne d'historique si besoin).
6. **`configurator_sessions.user_id → user_profiles(id)`** (pas auth.users) : à imiter
   pour toute FK utilisateur des nouvelles tables de config (ex. `royalty_config`).
7. **Volume de lignes** : non vérifiable sans accès MCP Supabase → requis avant les
   backfills (Lot 1.3) et le calcul des planchers (Lot 4.2).

---

## 4. Conclusions pour le chantier

- **Lot 1 (filiation)** : faisable tel quel ; `product_id` cible `shop_products` ;
  trigger SECURITY DEFINER avec `SET search_path = public, pg_temp` ; backfill sur copie
  avant production.
- **Lot 2 (preuve terrain)** : `hike_sessions.kit_id` à ajouter ; `kit_field_reports`
  nouvelle table RLS own ; journal anonymisé via fonction SECURITY DEFINER (jamais les
  positions).
- **Lot 3 (tuyau Stripe)** : **prioritaire** — le système d'achat actuel est percé :
  rien n'attribue `user_id`, rien ne crée `order_items`, le stock ne décrémente jamais.
- **Lot 6 (part créateur)** : blocage sur le « crédit boutique » inexistant → à trancher
  avec Tony AVANT d'implémenter 6.5.
- **Prompt #1 sécurité (plan maître)** : RLS activée sur l'ensemble des tables auditées,
  `validatePrices` serveur présent (checkout/route.ts:28-112) → **Prompt #1 considéré
  comme validé** pour les besoins de ce chantier (à confirmer par Tony).