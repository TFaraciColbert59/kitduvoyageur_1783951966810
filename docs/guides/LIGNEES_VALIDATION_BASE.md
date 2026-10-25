# Validation base — Chantier « Lignées de kits » (Gates 1 & 3)

> À exécuter par Tony sur une **COPIE / branche Supabase** (jamais la prod directement).
> Projet prod de référence : `icxyvwzfjbflcbqukpfz` (eu-west-3).
> Branche code : `feat/lignees-kits`.

## Vague à valider, dans l'ordre (5 migrations — la 6e est EXCLUE)

1. `supabase/migrations/20260903010000_kit_lineage.sql`
2. `supabase/migrations/20260903020000_kit_field_proof.sql`
3. `supabase/migrations/20260903030000_stripe_fix.sql`
4. `supabase/migrations/20260903040000_kit_conservation.sql`
5. `supabase/migrations/20260903041000_kit_souches_seed.sql`

> ❄️ **`20260903050000_kit_attributions.sql` (Lot 6) est GELÉE et ne fait PAS partie de
> la vague** : le crédit boutique n'est pas dépensable au checkout (Phase 2), une part
> créateur serait une promesse non tenue. Aucune table Lot 6 en base tant que la décision
> n'est pas prise (`RAPPORT_LIGNEES.md` §6.5, flag serveur `KIT_ROYALTY_ENABLED`).

---

## Constats d'environnement (2026-09-04) — ce qui est possible, ce qui ne l'est pas

| Tentative | Résultat réel | Conséquence |
|---|---|---|
| Branche Supabase (`supabase branches create`) | **402 — branching réservé au plan Pro** | La « validation sur copie » via branche éphémère est indisponible (org en Free) |
| Docker Desktop | **Absent de la machine** | Pas de stack locale (`supabase start`) à ce jour |
| `supabase db push --dry-run` (sur prod liée) | **Aucune écriture** — mais erreur `LegacyDbPushMissingLocalError` : le distant a 5 versions inconnues localement (`20260824191643 20260824191701 20260829142518 20260830072011 20260830072028`) | **L'historique migrations local↔prod est désynchronisé.** Ne PAS pousser en prod tant que ce n'est pas réconcilié (`supabase migration repair` / `db pull` — action prod, décision Tony) |
| Projet secondaire `lwrmuggefbmboikjgudc` (« LKDV », ACTIVE_HEALTHY, autre org) | Non lié, contenu inconnu | **À CONFIRMER par Tony** : est-ce la copie de validation ? Je n'y touche pas sans confirmation |

**Deux chemins réalistes pour valider GATE 1 :**

- **A′ — Local (plan Free, zéro coût)** : installer Docker Desktop, puis je fais
  `supabase init` (scratch) + `supabase start` + `db reset` (joue toute l'historique locale
  + les 5 nouvelles) + `supabase test db` (3 suites pgTAP). Tout sur la machine.
- **B′ — Copie distante** : activer le branching Pro, OU pointer sur une copie de projet
  (ex. `lwrmuggefbmboikjgudc` si c'en est une) — je fais `link` + `db push` + pgTAP via `db query`.

---

## Étape A — Appliquer les 5 migrations sur la copie

**Option CLI (recommandée)** — depuis la racine du repo, après avoir lié le projet de copie :

```powershell
npx supabase link --project-ref <ref_projet_de_copie>
npx supabase db push
```

> Si la copie est un projet **vide**, `db push` rejouera les migrations historiques AVANT
> les 5 nouvelles — normal, c'est un clone complet. Si la copie est une **branche
> récente** (mêmes migrations déjà en place), seules les nouvelles passeront.

**Option SQL editor** — copier-coller les 5 fichiers dans l'ordre. Toutes les déclarations
sont `IF NOT EXISTS` / `DROP IF EXISTS ... THEN CREATE` (idempotentes et sûres à relancer).

---

## Étape B — Suites pgTAP : 3 maintenant, 2 différées (Lot 6)

⚠️ **Écart assumé avec `RAPPORT_LIGNEES.md` §4bis (qui liste 5 suites)** :
`attributions.test.sql` et `security_lignees.test.sql` font des INSERT/asserts sur
`kit_attributions` / `kit_royalty_shares` / `insert_kit_attribution` — des objets du
**Lot 6 gelé**. Sur une base sans Lot 6, ces deux suites **ne peuvent pas passer**
(erreur table absente). Elles sont donc **différées** et repasseront à l'activation du
Lot 6. Le GATE 1 se joue sur **3 suites** :

1. Installer pgtap sur la copie (SQL editor) :
   ```sql
   create extension if not exists pgtap;
   ```
2. Exécuter **intégralement** (en une fois, chacune) :
   - `supabase/tests/database/lineage.test.sql` → attendu `ok 14 / 14`
   - `supabase/tests/database/field_proof.test.sql` → attendu `ok 15 / 15`
   - `supabase/tests/database/conservation.test.sql` → attendu `ok 8 / 8`

Chaque fichier est une transaction annulée (`ROLLBACK` final) — aucune donnée ne persiste.

**Résultats attendus en bref** : fork simple → gen 1 ; fork de fork → gen 2 ;
client envoyant `generation=99` → écrasé ; cycle/parent inexistant → exception ;
suppression du parent → `ancestors` conserve l'uuid disparu ; profondeur 51 → refusée ;
`field_proven_count` incrémenté ≥1 km, jamais négatif ; upsert débriefing → 1 ligne ;
journal sans lat/lon/noms, granularité max = région ; conservation : auto-forks exclus,
plancher 5 sessions, 2 axes distincts.

> Reporter les 3 sorties dans `RAPPORT_LIGNEES.md` §4bis (cases `lineage`, `field_proof`,
> `conservation`) et marquer `attributions` + `security_lignees` « différées (Lot 6) ».

---

## Étape C — Backfill (non destructif), seulement après B

Fichier : `supabase/backfill/kit_lineage_backfill.sql`

1. Ouvrir dans le SQL editor de la copie.
2. Vérifier les `NOTICE` du rapport : `kits au total`, `paires de fork candidates`,
   `passe N : X kit(s) rattaché(s)`, `items appariés / non appariés`.
3. Remplacez le `ROLLBACK;` final par `COMMIT;` **seulement si** les chiffres semblent
   raisonnables (le fork n'apparie jamais un produit s'il n'est pas exact et unique).
4. Rapporter les 4 compteurs dans MISSION_LOG.

---

## Étape D — Gate 3 : test Stripe réel (mode test)

Pré-requis local :

```powershell
# .env.local — ajouter (ne jamais commiter) :
STRIPE_WEBHOOK_SECRET=whsec_...   # depuis le dashboard Stripe (mode test)
STRIPE_SECRET_KEY=sk_test_...     # déjà présent ? vérifier
```

Le CLI Stripe n'est pas installé sur cette machine. Deux options :

```powershell
# a) installer le CLI officiel via npm (recommandé pour `stripe trigger`) :
npm install -g @stripe/stripe-cli
# b) sinon : le dashboard Stripe > webhooks > « Envoyer un événement de test »
#    permet de déclencher checkout.session.completed sans CLI.
```

1. `stripe listen --forward-to localhost:4000/api/stripe/webhook` (1er terminal).
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

Rapporter dans la conversation : sorties des **3 suites pgTAP**, compteurs du backfill, et le
résultat du test Stripe (commandes créées / non, order_items remplis, doublon bloqué).
Je diagnostique immédiatement tout échec (le plus probable : insert `auth.users` minimal
dans les fixtures pgTAP selon la version de Supabase, ou une signature RLS différente).

> **Préalable du chantier suivant** : la réconciliation Stripe (paiements orphelins) doit
> être **remplie** (pas seulement créée) avant de démarrer quoi que ce soit d'autre —
> kit prêt : `supabase/reconciliation/README.md` + `scripts/db/reconcile_stripe.mjs`.