# Wave 1 — complétion + Wave 2 (argent) — faits (2026-10-09)

## 1. AuthContext / purge SW (F-002) — vérifié

- Émission : `src/contexts/AuthContext.tsx:158-165` — `lastUserIdRef` + effet sur `user?.id` :
  tout changement d'id (login B après A, logout) poste `{type:'LKDV_PURGE_PRIVATE'}` au SW.
- **Trou confirmé** : la purge est postée à `navigator.serviceWorker?.controller` — si `controller`
  est `null` (première visite, SW non encore activé après update, enregistrement en échec), le message
  est silencieusement perdu (aucun fallback). → H-017.
- Pas de purge des caches à l'expiration de session sans changement d'id (n/a).

## 2. Bucket group-media (F-006) — usage confirmé

- Upload client : `src/components/groupes/DiscussionCard.tsx:101-150` et
  `src/components/clubs/ClubDiscussionCard.tsx:151-162` — `storage.from('group-media').upload(...)`
  puis `getPublicUrl(...)` posté dans `group_messages`.
- Bucket `public=true`, 10 MiB, mime incl. `application/gpx+xml` et `application/octet-stream`
  (`20260815000000:272-282`) ; aucune policy `storage.objects` pour ce bucket trouvée en migration.
- Conséquence : tout objet injecté est servi publiquement par URL (comportement standard Supabase des
  buckets publics) ; confidentialité fondée sur l'URL non devinable. Contenu = pièces jointes de
  discussions de groupes (souvent privés). → F-006 (candidat) + H-017bis (bucket privé + URLs signées).
- Reste indéterminé : existence de policies créées hors migrations (dashboard).

## 3. get_kit_journal (F-007) — reclassé

- `20260903020000_kit_field_proof.sql:137-210` : retourne uniquement des agrégats anonymisés
  (fork_count, session_count, total_km, D+, saisons, régions massif, compteurs de carnets publics) ;
  aucun lat/lon, nom ou email. Conçu pour le partage (KitSheet).
- Aucun contrôle `auth.uid()`/`is_public` ; GRANT `authenticated`.
- Conclusion : pas de violation démontrée ; **reclassé H-015** (vérifier `is_public`/consentement produit).

## 4. UI /admin (U-ADM-02) — vérifié (statique)

- `src/app/admin/page.tsx` est un composant client ; accès à la route gardé par middleware
  (`is_admin()` — `src/middleware.ts:72-80`).
- Requêtes réelles client (RLS) : `products`, `kits`, `user_profiles` (email/full_name — réservé
  admin par policy), `community_posts`, `clubs`, `product_reviews`, `orders`, `withdrawals`,
  `reward_accounts`, `admin_audit_logs`, `shop_products`, `product_images`.
- Les gros écrans « démo » (KPI/commandes/modération) contiennent des données **en dur** (mock)
  dans le bundle — pas de fuite, mais surface produit à nettoyer (non sécurité).

## 5. user_profiles — historique et remédiation (vérifié)

- Historique : policy large `public_read_profiles USING (true)` (20260713150000:11) puis
  `"Public read user_profiles" USING (true)` (20260713140000:653), `anon_read_profiles_basic`, etc.
- **Remédiation (2026-09-11)** : `20260911290000_a10_f1_public_profiles.sql` — vue
  `public.public_profiles` (colonnes publiques seulement, sans email/téléphone/rôle), DROP des
  policies larges (y compris une dérive prod hors dépôt `"Public read user_profiles"`), et policy
  admin `user_profiles_select_admin` via `is_admin()`. `profile_select_public_subset` (anon) =
  `USING(false)` (`20260904020000:38-42`).
- État repo = fermé. Résiduel : **vérifier que la migration est appliquée en prod et qu'aucune
  nouvelle dérive n'existe** → H-018.
- Protections colonnes privilégiées : trigger `guard_user_profile_privileged_columns`
  (`20260911551000:23-74`) — anti auto-promotion role/trust_score/suspension/2FA/email. OK.
- Seeds : 12 utilisateurs `auth.users` à mot de passe fixe (`20260713150000:36-105`), idem dans
  `20260713130000`, `20260713140000`, `20260713160000`, `20260713170000` (emails *@email.fr,
  `crypt('…2024!')`) ; compte système `lkdv-studio@` avec `encrypted_password='!'` (désactivé) OK.
  → F-008 (candidat) : credentials publics dans un dépôt public ; présence en prod à vérifier (D1).

## 6. Checkout (F-005) — reclassé

- Prix **revalidés serveur** contre `products`/`kits` (`checkout/route.ts:55-135`, appel `:164-171`) ;
  order_items et prix recalculés serveur au webhook (`webhook:161-177`).
- `successUrl`/`cancelUrl` libres (`:236-237`) : impact limité au navigateur de l'appelant
  (pas de victime) → **rejeté** comme constat ; durcissement H-016 (allowlist same-origin).
- Service-role → repli anon (`:45`) : H-014. Rate-limit mémoire par instance (`:140`) : H-008.

## 7. Stripe webhook (U-STRIPE-01) — vérifié (statique)

- Signature sur corps brut avant tout effet (`:350-369`) ; idempotence événement `stripe_events`
  réservée AVANT effet (`:373-385`), libérée en cas d'échec (`:414-419`) ; idempotence métier
  `orders.stripe_session_id` unique (`:69-78`) ; prix serveur ; entitlements best-effort.
- Réserve : `decrement_stock_on_order` en try/catch avec simple log (`:203-212`) — commande confirmée
  même si le déstockage échoue (dérive stock possible) → H-020. Remboursements : reverse attribution
  best-effort (`:305-329`).
- `error.message` renvoyé (`:368,419`) → H-007.

## 8. Rewards (U-LEDGER-01) — vérifié (statique)

- `claim` : auth + rate-limit fail-closed + RPC service_role avec user.id session ; points jamais du
  client (`claim/route.ts:13-59`). `withdraw` : auth + 5/h fail-closed + RPC session, `amount>0`
  (`withdraw/route.ts:13-50`) ; borne supérieure et solde délégués au SQL (à vérifier en base).
- `error.message` RPC renvoyé (`withdraw:47`) → H-007.

## 9. materiel/share — vérifié

- POST owner-scoped (zod, insert RLS) ; GET hors RLS après validation token 32-hex + expiration
  (`share/route.ts:52-97`) ; cookie KIT_REF httpOnly/lax posé si secret.
- Réserve : réponse GET = `select('*, materiel_kit_items(*)')` sans projection selon `permission`
  (`:75-83`) — un token de partage expose tous les champs du kit (serial/notes privées éventuelles)
  → H-017bis2 (projection par permission).

## 10. Baseline tests (résumé — détails BASELINE.md)

- tsc/lint/build : 0. Vitest : 5 fichiers / 8 tests en échec (préexistants, clean checkout),
  6903 passed. Réseau : aucun accès externe pendant la suite (specs gated/loopback).
