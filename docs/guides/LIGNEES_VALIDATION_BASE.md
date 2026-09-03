# Validation base — Chantier « Lignées de kits » (Gates 1 & 3)

> À exécuter par Tony sur une **COPIE / branche Supabase** (jamais la prod directement).
> Projet prod de référence : `icxyvwzfjbflcbqukpfz` (eu-west-3).
> Branche code : `feat/lignees-kits`. Migrations à valider, dans l'ordre :

1. `supabase/migrations/20260903010000_kit_lineage.sql`
2. `supabase/migrations/20260903020000_kit_field_proof.sql`
3. `supabase/migrations/20260903030000_stripe_fix.sql`

---

## Étape A — Appliquer les 3 migrations sur la copie

**Option CLI (recommandée)** — depuis la racine du repo, après avoir lié le projet de copie :

```powershell
npx supabase link --project-ref <ref_projet_de_copie>
npx supabase db push
```

> Si la copie est un projet **vide**, `db push` rejouera les 108 migrations historiques
> AVANT les 3 nouvelles — normal, c'est un clone complet. Si la copie est une **branche
> récente** (mêmes migrations déjà en place), seules les 3 dernières passeront.

**Option SQL editor** — copier-coller les 3 fichiers dans l'ordre. Toutes les déclarations
sont `IF NOT EXISTS` / `DROP IF EXISTS ... THEN CREATE` (idempotentes et sûres à relancer).

---

## Étape B — Suites pgTAP (14 + 15 assertions)

1. Installer pgtap sur la copie (SQL editor) :
   ```sql
   create extension if not exists pgtap;
   ```
2. Exécuter **intégralement** (en une fois) :
   - `supabase/tests/database/lineage.test.sql` → attendu `ok 14 / 14`
   - `supabase/tests/database/field_proof.test.sql` → attendu `ok 15 / 15`

Chaque fichier est une transaction annulée (`ROLLBACK` final) — aucune donnée ne persiste.

**Résultats attendus en bref** : fork simple → gen 1 ; fork de fork → gen 2 ;
client envoyant `generation=99` → écrasé ; cycle/parent inexistant → exception ;
suppression du parent → `ancestors` conserve l'uuid disparu ; profondeur 51 → refusée ;
`field_proven_count` incrémenté ≥1 km, jamais négatif ; upsert débriefing → 1 ligne ;
journal sans lat/lon/noms, granularité max = région.

---

## Étape C — Backfill (non destructif), seulement après B

Fichier : `supabase/backfill/kit_lineage_backfill.sql`

1. Ouvrir dans le SQL editor de la copie.
2. Vérifier les `NOTICE` du rapport : `kits au total`, `paires de fork candidates`,
   `passe N : X kit(s) rattaché(s)`, `items appariés / non appariés`.
3. Remplacez le `ROLLBACK;` final par `COMMIT;` **seulement si** les chiffres semblent
   raisonnables (le forun n'apparie jamais un produit s'il n'est pas exact et unique).
4. Rapporter les 4 compteurs dans le fil de discussion MISSION_LOG.

---

## Étape D — Gate 3 : test Stripe réel (mode test)

Pré-requis local :
```powershell
# .env.local — ajouter (ne jamais commiter) :
STRIPE_WEBHOOK_SECRET=whsec_...   # depuis le dashboard Stripe (mode test)
STRIPE_SECRET_KEY=sk_test_...     # déjà présent ? vérifier
```

1. `npx stripe listen --forward-to localhost:4000/api/stripe/webhook` (1er terminal).
2. `npm run dev` (2e terminal).
3. Passer une commande complète (`/boutique` → panier → checkout test card `4242 4242 4242 4242`).
4. Vérifier en base (copie/staging) :
   - `orders` créée avec `user_id` **non nul** (si connecté) et `stripe_session_id` rempli ;
   - `order_items` avec `product_id` **remplis** (un par article) ;
   - `shop_products.stock` décrémenté ;
   - rejouer le même événement webhook (Stripe CLI : `stripe trigger checkout.session.completed`
     avec le même session_id via l'historique) → réponse `duplicate: true`, aucune ligne en double.

---

## Retour attendu

Rapporter dans la conversation : sortie des 2 suites pgTAP, compteurs du backfill, et le
résultat du test Stripe (commandes créées / non, order_items remplis, doublon bloqué).
Je diagnostique immédiatement tout échec (le plus probable : insert `auth.users` minimal
dans les fixtures pgTAP selon la version de Supabase, ou une signature RLS différente).