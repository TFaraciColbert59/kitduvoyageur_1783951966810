# RÉCONCILIATION DE L'HISTORIQUE DES MIGRATIONS SUPABASE

Statut : **ZONE ORANGE (Document cadre & Procédure d'exécution pour Tony)**  
Projet Supabase RÉEL : `icxyvwzfjbflcbqukpfz`  
⚠️ **Projet FANTÔME à NE JAMAIS CIBLER** : `lwrmuggefbmboikjgudc` (référence obsolète et dangereuse issue d'anciens plans maîtres).

---

## 1. Contexte & Règle d'engagement

L'agent Antigravity n'applique **aucune migration directement sur la base distante** (Zone Orange).
La base distante `icxyvwzfjbflcbqukpfz` a fait l'objet de sondages en lecture seule révélant que :
- Les colonnes `stripe_session_id`, `subtotal_eur`, etc. de la table `orders` n'y sont pas encore créées.
- Les tables et vues du chantier Lignées (`materiel_kits.forked_from`, `kit_field_reports`, `kit_trust_scores`) ainsi que du chantier Orientation/Empreinte (`user_orientation`, `user_field_signature`) doivent être appliquées de manière séquencée et contrôlée.
- **La migration `20260903050000_kit_attributions.sql` (Lot 6 — Royalties créateurs) est GELÉE** : elle ne doit **PAS** être appliquée tant que le modèle légal et fiscal des reversements marchands n'est pas validé.

---

## 2. Commande d'inspection à lancer par Tony

Avant toute application, Tony doit vérifier l'état actuel de la base distante via la commande Supabase CLI :

```bash
# Vérifier l'état de synchronisation des migrations sur le projet réel icxyvwzfjbflcbqukpfz
supabase migration list --linked
```

> **Critère de succès** : Supabase affiche la liste des migrations avec leur statut `Remote` / `Local`.
> Si une migration locale est absente de la colonne `Remote`, elle est candidate au déploiement selon l'ordre ci-dessous.

---

## 3. Tableau de réconciliation des migrations récentes

| Migration | Intitulé / Rôle | Statut Dossier Local | Statut Distant (`icxyvwzfjbflcbqukpfz`) | Action requise |
|---|---|---|---|---|
| `20260903000000_ai_foundations.sql` | Fondations embeddings AI | `supabase/migrations/` | *(À vérifier via CLI)* | À appliquer si manquante |
| `20260903010000_kit_lineage.sql` | Lignées de kits (colonnes filiation, GIN, cycle check, immuabilité) | `supabase/migrations/` (24 pgTAP) | *(À vérifier via CLI)* | Lot 1 actif |
| `20260903020000_kit_field_proof.sql` | Épreuve terrain (kit_field_reports, journal anonymisé, RLS) | `supabase/migrations/` (16 pgTAP) | *(À vérifier via CLI)* | Lot 2 actif |
| `20260903030000_stripe_fix.sql` | RLS orders/order_items + trigger déstockage + webhook idempotence | `supabase/migrations/` | *(À vérifier via CLI)* | Lot 3 actif |
| `20260903040000_kit_conservation.sql` | Vues matérialisées survie d'items & scores de confiance | `supabase/migrations/` (8 pgTAP) | *(À vérifier via CLI)* | Lot 4 actif |
| `20260903041000_kit_souches_seed.sql` | Kits souches de référence (bivouac alpin, ultra-léger) | `supabase/migrations/` | *(À vérifier via CLI)* | Lot 4 seed actif |
| `20260903050000_kit_attributions.sql` | Lot 6 — Partage de valeur & store credit | **GELÉE PHYSIQUEMENT** (`supabase/migrations_frozen/`) | **ABSENTE (INTERDITE)** | **AUCUNE (GELÉE HORS MIGRATIONS)** |
| `20260904010000_user_orientation.sql` | Boussole d'orientation (table privée, RLS strict own) | `supabase/migrations/` | *(À vérifier via CLI)* | Identité active |
| `20260904020000_user_field_signature.sql` | Matview empreinte terrain + k-anonymat | `supabase/migrations/` | *(À vérifier via CLI)* | Identité active |

---

## 4. Protocole de déploiement sécurisé (Validation sur copie préalable)

> ⚠️ **IMPORTANT — FONCTIONNEMENT DE `supabase db push`** :  
> `supabase db push` n'a **AUCUN flag `--include`** pour cibler unitairement des versions. La commande applique **toutes les migrations** présentes dans `supabase/migrations/` qui n'ont pas encore été exécutées.
>
> C'est pour cette raison exacte que `20260903050000_kit_attributions.sql` a été **déplacée physiquement dans `supabase/migrations_frozen/`** : ainsi, `supabase db push` ne la voit pas et ne pourra jamais l'appliquer par erreur lors du déploiement d'Orientation/Empreinte (`20260904010000` et `20260904020000`).

### Protocole obligatoire en deux temps :

#### Phase 1 : Validation sur base copie / branche de test
Avant tout déploiement sur l'instance de production `icxyvwzfjbflcbqukpfz` :
1. Lancer un dry-run pour inspecter la liste exacte des migrations à jouer :
   ```bash
   supabase db push --dry-run --linked
   ```
2. Appliquer les migrations sur la base miroir de test :
   ```bash
   supabase db push --db-url "<COPIE_DATABASE_URL>"
   ```
3. Exécuter l'ensemble de la suite pgTAP sur la copie :
   ```bash
   supabase test db --db-url "<COPIE_DATABASE_URL>"
   ```
   *(Attendu : 58 assertions passantes — 24 lineage + 16 field_proof + 8 conservation + 10 security_lignees).*
4. Jouer le script de backfill sur la copie et vérifier le ratio de matching `product_id`.

#### Phase 2 : Déploiement distant (uniquement après validation copie)
Une fois la Phase 1 validée :
```bash
supabase db push --linked
```

---

## 5. Plans de Rollback détaillés

En cas d'erreur ou d'incident lors du déploiement distant, voici les scripts de retour arrière unitaire :

### Rollback `20260904020000_user_field_signature.sql`
```sql
DROP MATERIALIZED VIEW IF EXISTS public.user_field_signature;
DROP FUNCTION IF EXISTS public.refresh_user_field_signature();
```

### Rollback `20260904010000_user_orientation.sql`
```sql
DROP TRIGGER IF EXISTS trg_user_orientation_updated ON public.user_orientation;
DROP FUNCTION IF EXISTS public.touch_user_orientation_updated_at();
DROP TABLE IF EXISTS public.user_orientation;
```

### Rollback `20260903041000_kit_souches_seed.sql`
```sql
DELETE FROM public.materiel_kits
WHERE slug IN ('bivouac-alpin-3j', 'randonnee-ultralegere-ete', 'trek-autonomie-massif-central');
```

### Rollback `20260903040000_kit_conservation.sql`
```sql
DROP MATERIALIZED VIEW IF EXISTS public.kit_trust_scores;
DROP MATERIALIZED VIEW IF EXISTS public.kit_item_survival_by_kit;
DROP FUNCTION IF EXISTS public.refresh_kit_conservation_matviews();
```

### Rollback `20260903030000_stripe_fix.sql`
```sql
DROP TRIGGER IF EXISTS trg_order_decrement_stock ON public.orders;
DROP FUNCTION IF EXISTS public.decrement_stock_on_order();
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS subtotal_eur,
  DROP COLUMN IF EXISTS shipping_eur,
  DROP COLUMN IF EXISTS payment_method;
DROP TABLE IF EXISTS public.checkout_intents;
```

### Rollback `20260903020000_kit_field_proof.sql`
```sql
DROP FUNCTION IF EXISTS public.get_kit_field_journal(uuid, integer);
DROP TABLE IF EXISTS public.kit_field_reports;
ALTER TABLE public.hiking_routes DROP COLUMN IF EXISTS region;
ALTER TABLE public.hike_sessions DROP COLUMN IF EXISTS kit_id;
```

### Rollback `20260903010000_kit_lineage.sql`
```sql
DROP TRIGGER IF EXISTS trg_kit_lineage ON public.materiel_kits;
DROP FUNCTION IF EXISTS public.handle_kit_lineage();
DROP FUNCTION IF EXISTS public.check_kit_ancestry_cycle(uuid, uuid);
ALTER TABLE public.materiel_kits
  DROP COLUMN IF EXISTS lineage_root_id,
  DROP COLUMN IF EXISTS forked_from,
  DROP COLUMN IF EXISTS generation,
  DROP COLUMN IF EXISTS ancestors;
```
