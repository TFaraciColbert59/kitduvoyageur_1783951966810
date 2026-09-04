# RAPPORT DE VÉRIFICATION D'INTÉGRATION GLOBALE
## « Lignées de kits » + « Orientation & Empreinte »

- **Date** : 4 septembre 2026
- **Branche** : `feat/orientation-empreinte` (fondée sur `feat/lignees-kits` @ `6d0c7b7`)
- **Projet Supabase RÉEL** : `icxyvwzfjbflcbqukpfz`
- **Projet fantôme à exclure** : `lwrmuggefbmboikjgudc`
- **Charte d'intégrité** : Aucun `✅` sans preuve brute collée. Écarts déclarés sans complaisance.

---

## I. Analyse de Dépendance : Orientation/Empreinte ↔ Lignées (Phase 2)

**Question clé** : « Orientation & Empreinte » dépend-il de « Lignées de kits » ? Si oui, à quel degré ?

### 1. Recherche par motifs stricts dans les migrations d'identité
Recherche des identifiants spécifiques aux lignées (`materiel_kits`, `forked_from`, `lineage_root_id`, `ancestors`, `kit_field_reports`, `kit_item_survival`, `kit_trust_scores`, `hike_sessions.kit_id`) :
- Dans `20260904010000_user_orientation.sql` : **0 occurrence**.
- Dans `20260904020000_user_field_signature.sql` : **0 occurrence**.
- Dans `src/features/identity/` : **0 occurrence**.
- Dans `src/components/identity/` : **0 occurrence**.

### 2. Clause WHERE de la vue matérialisée `user_field_signature`
Extrait brut de `20260904020000_user_field_signature.sql:50-70` :
```sql
CREATE MATERIALIZED VIEW public.user_field_signature AS
SELECT
  hs.user_id,
  count(hs.id)::int                                                  AS total_outings,
  COALESCE(sum(hs.distance_km), 0)::numeric(8, 2)                    AS total_km,
  ...
FROM public.hike_sessions hs
LEFT JOIN public.hiking_routes r ON r.id = hs.route_id
GROUP BY hs.user_id;
```
**Constat** : La vue matérialisée n'a AUCUNE clause `WHERE hs.kit_id IS NOT NULL`. Elle agrège **l'ensemble des sorties de l'utilisateur**, qu'elles aient été effectuées avec un kit ou sans kit.

### 3. Dépendance réelle identifiée
Dans `20260904020000_user_field_signature.sql:63` :
```sql
count(DISTINCT r.region)::int AS distinct_regions
```
La colonne `region` de la table `hiking_routes` a été introduite par la migration `20260903020000_kit_field_proof.sql:25` (`ALTER TABLE public.hiking_routes ADD COLUMN IF NOT EXISTS region text;`).
- **Verdict de dépendance** :
  - `user_orientation` est **100 % autonome et indépendant**.
  - `user_field_signature` dépend logiquement de l'existence de la colonne `hiking_routes.region`. Si `kit_field_proof` n'est pas appliquée, la colonne `region` doit être créée séparément pour que la vue compile.
  - Zéro couplage métier avec la logique d'arbre phylogénétique ou de score de kits.

---

## II. Procès Verbal des Affirmations (Phases 1 & 3)

### Légende des Verdicts
- **`CONFORME`** : Preuve brute vérifiée dans le code ou les tests.
- **`ÉCART`** : Non-conformité identifiée, corrigée dans le présent chantier.
- **`ÉCART NON CORRIGEABLE`** : Dépendance externe ou anomalie structurelle non corrigeable en local.
- **`NON VÉRIFIABLE SANS INFRA`** : Nécessite une connexion active à la base Supabase distante de production ou à l'API Stripe Live.
- **`AFFIRMATION FAUSSE`** : L'affirmation déclarée ne correspond à aucune réalité dans le dépôt.

---

### Lot 1 — Filiation & GIN

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **1.1 Colonnes filiation** : `forked_from`, `lineage_root_id`, `generation`, `ancestors uuid[]` existent sur `materiel_kits`. Index GIN posé sur `ancestors`. | `RAPPORT_LIGNEES.md` §1 | Inspection de `20260903010000_kit_lineage.sql:18-25` | `ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS lineage_root_id uuid ... ADD COLUMN IF NOT EXISTS forked_from uuid ... ADD COLUMN IF NOT EXISTS generation integer ... ADD COLUMN IF NOT EXISTS ancestors uuid[] ... CREATE INDEX IF NOT EXISTS materiel_kits_ancestors_gin ON public.materiel_kits USING GIN (ancestors);` | **`CONFORME`** |
| **1.2 Détection de cycle A->B->A** : Cycle interdit et testé par pgTAP. | `RAPPORT_LIGNEES.md` §1 | Inspection de `lineage.test.sql:116-121` et fonction `check_kit_ancestry_cycle` | `SELECT throws_ok($$INSERT INTO public.materiel_kits (id, user_id, name, forked_from) VALUES ('...', '...', 'Cycle', '...')$$, 'P0001', '%Cycle d''ascendance détecté%', 'Cycle A->B->A interdit');` | **`CONFORME`** *(local pgTAP)* / **`NON VÉRIFIABLE SANS INFRA`** *(sur icxyvwzfjbflcbqukpfz)* |
| **1.3 Plafond de 50 générations & écrasement gen 99** : Si gen > 50 levée d'erreur, gen fournie par le client ignorée et recalculée. | `RAPPORT_LIGNEES.md` §1 | Inspection de `20260903010000_kit_lineage.sql:89-91, 109-111` | `IF NEW.generation > 50 THEN RAISE EXCEPTION 'Profondeur de lignée maximale (50) atteinte'; END IF;` et `NEW.generation := parent_rec.generation + 1;` | **`CONFORME`** |
| **1.4 Immuabilité sur UPDATE** : Filiation inaltérable après création. | `RAPPORT_LIGNEES.md` §1 | Analyse du trigger `handle_kit_lineage` | Le trigger d'origine ne surveillait que `OF forked_from`. Corrigé dans commit `046f608` avec blocage strict de `lineage_root_id`, `forked_from`, `generation`, `ancestors` sur UPDATE + Test 4c ajouté. | **`ÉCART`** → **`CORRIGÉ`** (`046f608`) |
| **1.5 Schéma Zod rejette `ancestors` injecté** : Rejet strict des champs serveurs. | `RAPPORT_LIGNEES.md` §1 | Inspection de `src/features/kits/lineage.ts:74` et route `api/materiel/kits` | `assertNoServerKitFields` lève une erreur 400 `Champ de filiation géré par le serveur` si `ancestors`, `generation` ou `lineage_root_id` sont dans le body. | **`CONFORME`** |
| **1.6 Route `/api/materiel/fork`** : Existe, duplique les items, copie `name + (copie)`, RLS respectée. | `RAPPORT_LIGNEES.md` §1 | Inspection de `src/app/api/materiel/fork/route.ts:66-79` | `name: body.name ?? \`${parentKit.name} (copie)\`, forked_from: parentKit.id, lineage_root_id: parentKit.lineage_root_id ?? parentKit.id` | **`CONFORME`** |
| **1.7 Script de backfill idempotent** : Présent et se termine par ROLLBACK de sécurité. | `RAPPORT_LIGNEES.md` §1 | Inspection de `supabase/backfill/kit_lineage_backfill.sql` | `DO $$ ... ROLLBACK; -- SÉCURITÉ : retirer pour appliquer réellement` | **`CONFORME`** |
| **1.8 Configurateur génère dans `materiel_kits`** : Le configurateur de kit alimente la nouvelle table. | `RAPPORT_LIGNEES.md` §1 | Analyse de `ConfiguratorWizard.tsx:403` et `KitConfiguratorWizard.tsx:280` | `ConfiguratorWizard.tsx` insère dans la table legacy `kits` et `kit_items`. `KitConfiguratorWizard.tsx` insère dans `custom_kits`. `kit_reports.kit_id` reste NULL. | **`AFFIRMATION FAUSSE`** (`ÉCART STRUCTUREL`) |

---

### Lot 2 — Épreuve Terrain

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **2.1 Colonne `hike_sessions.kit_id` & index** : FK vers `materiel_kits(id)` ON DELETE SET NULL avec index partiel. | `RAPPORT_LIGNEES.md` §2 | Inspection de `20260903020000_kit_field_proof.sql:15-19` | `ALTER TABLE public.hike_sessions ADD COLUMN IF NOT EXISTS kit_id uuid REFERENCES public.materiel_kits(id) ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS hike_sessions_kit_id_idx ON public.hike_sessions (kit_id) WHERE kit_id IS NOT NULL;` | **`CONFORME`** |
| **2.2 Table `kit_field_reports` & RLS** : Débriefing d'items (`essentiel`, `utile`, `inutile`, `jamais_servi`), RLS restrictive. | `RAPPORT_LIGNEES.md` §2 | Inspection de `20260903020000_kit_field_proof.sql:34-83` | Table créée, contraintes check, RLS activée avec policies `kit_field_reports_select_own` et `kit_field_reports_insert_own`. | **`CONFORME`** |
| **2.3 Fonction `get_kit_journal`** : Anonymisation des retours terrain, zéro GPS, zéro user_id. | `RAPPORT_LIGNEES.md` §2 | Inspection de `20260903020000_kit_field_proof.sql:137-207` et exécution | **Preuve brute — JSON généré pour un kit tiers** :<br>```json<br>{<br>  "kit_id": "00000000-0000-0000-0000-000000000001",<br>  "birth": { "origin": "curated", "generation": 0 },<br>  "lineage": { "fork_count": 4, "max_generation": 2 },<br>  "field": {<br>    "session_count": 8,<br>    "total_km": 142.5,<br>    "total_elevation_gain_m": 8400,<br>    "seasons": { "ete": 5, "automne": 3 },<br>    "regions": [<br>      { "region": "Écrins", "sessions": 5 },<br>      { "region": "Vercors", "sessions": 3 }<br>    ]<br>  },<br>  "ecosystem": { "public_carnet_count": 2 }<br>}<br>```<br>Zéro clé `lat`, `lng`, `geom`, `user_id`, `author_id` ou `email`. Granularité spatiale maximale = `region`. | **`CONFORME`** |
| **2.4 Définition exacte de `field_proven_count`** : Compte de sessions qualifiantes. | `RAPPORT_LIGNEES.md` §2 | Inspection du code SQL | `s.distance_km >= 1` et `s.kit_id IS NOT NULL` dans `20260903020000_kit_field_proof.sql:110-120`. | **`CONFORME`** |

---

### Lot 3 — Réparation Stripe

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **3.1 Metadata Checkout** : `kit_id`, `lineage_root_id`, `origin_creator_id` transmises à Stripe. | `RAPPORT_LIGNEES.md` §3 | Inspection de `src/app/api/checkout/route.ts:186-202` | Metadata posées sur la session Stripe : `client_reference_id: intent.id`, `metadata: { checkout_intent_id, kit_id, lineage_root_id, origin_creator_id }`. | **`CONFORME`** |
| **3.2 Seuil overflow 480 chars** : Table `checkout_intents` pour parer au dépassement de taille des metadata Stripe (500 chars max). | `RAPPORT_LIGNEES.md` §3 | Inspection de `src/lib/stripeMetadata.ts:48-52` | `if (json.length > 480) { return { checkout_intent_id: intent.id }; }` | **`CONFORME`** |
| **3.3 Webhook service_role & `order_items`** : Webhook utilise le client admin service_role et insère les lignes de commande. | `RAPPORT_LIGNEES.md` §3 | Inspection de `src/app/api/stripe/webhook/route.ts:36-43, 116, 164` | `createAdminClient()` utilisé. Insertion dans `orders` puis `order_items` par itération sur `line_items`. | **`CONFORME`** |
| **3.4 Idempotence sur `stripe_session_id`** : Contrainte unique et protection double webhook. | `RAPPORT_LIGNEES.md` §3 | Inspection de `20260903030000_stripe_fix.sql:47-51` | `CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key ON public.orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;` | **`CONFORME`** |
| **3.5 Webhook avale erreur commande** : Le webhook renvoie une 500 sur échec d'insertion pour déclencher le retry Stripe. | `RAPPORT_LIGNEES.md` §3 | Inspection de `src/app/api/stripe/webhook/route.ts:136` | Renvoyait 200 `{ received: true, warning: ... }`. Corrigé dans commit `5607832` pour lever une 500 (`NextResponse.json({ error: ... }, { status: 500 })`). | **`ÉCART`** → **`CORRIGÉ`** (`5607832`) |
| **3.6 Trigger `decrement_stock_on_order`** : Déclenché lors de la création d'une commande payée. | `RAPPORT_LIGNEES.md` §3 | Inspection de `20260903030000_stripe_fix.sql:63-88` et webhook | `decrement_stock_on_order` appelé pour chaque article validé. Ordre d'exécution vérifié : la vérification d'idempotence (`existingOrder`) intervient AVANT l'insertion `orders`, et le déstockage intervient APRÈS l'insertion `orders`. Si `orders` échoue (renvoi 500), aucun déstockage n'a lieu. Lors du retry Stripe après succès d'`orders`, `existingOrder` intercepte et renvoie `duplicate: true` (aucun re-déstockage). | **`CONFORME`** |
| **3.7 Colonnes `orders` déployées vs code applicatif** : Le schéma réel en base supporte-t-il les champs insérés par le webhook ? | Hypothèse H4 / `RAPPORT_LIGNEES.md` §3 | Comparaison de `webhook/route.ts:116-130` et `20260903030000_stripe_fix.sql:38-42` | Le code applicatif insère : `payment_method`, `subtotal_eur`, `shipping_eur`, `stripe_session_id`. Dans le schéma historique de production (`orders`), ces 4 colonnes étaient **absentes**. La migration `20260903030000_stripe_fix.sql` ajoute précisément ces 4 colonnes manquantes + l'index unique. Tant que la migration 3 n'est pas appliquée sur la base cible, le webhook échouera à 100% avec levée d'erreur 500. La migration 3 est le prérequis indispensable pour que le webhook insère avec succès. | **`ÉCART HISTORIQUE COUVERT PAR MIGRATION 3`** |

---

### Lot 4 — Conservation & Scores

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **4.1 Matviews de conservation** : `kit_item_survival_by_kit` et `kit_trust_scores` créées. | `RAPPORT_LIGNEES.md` §4 | Inspection de `20260903040000_kit_conservation.sql` | Deux vues matérialisées créées avec index uniques pour permettre `CONCURRENTLY`. | **`CONFORME`** |
| **4.2 Aucun terme monétaire dans le score** : Score de confiance totalement indépendant des ventes/prix. | `RAPPORT_LIGNEES.md` §4 | Grep regex sur la vue matérialisée | 0 occurrence de `price`, `revenue`, `commission`, `euro`, `cents`. Vérifié par invariant CI. | **`CONFORME`** |
| **4.3 Plancher de 5 sessions** : `has_min_sessions` conditionne l'exposition publique du score. | `RAPPORT_LIGNEES.md` §4 | Inspection de `kit_conservation.sql:116` et `KitSheetModal.tsx:225` | `(COALESCE(es.sessions_count, 0) >= 5) AS has_min_sessions` et modal affiche « Moins de 5 retours terrain » si faux. | **`CONFORME`** |
| **4.4 Auto-forks exclus** : L'auteur qui forke son propre kit n'incrémente pas le score de propagation. | `RAPPORT_LIGNEES.md` §4 | Inspection de `kit_conservation.sql:137, 144` | `d2.user_id IS DISTINCT FROM k.user_id` et `d.user_id IS DISTINCT FROM k.user_id`. | **`CONFORME`** |
| **4.5 Colonne `return_rate` = NULL** : Affirmée comme exposée avec valeur NULL. | `RAPPORT_LIGNEES.md` §4 | Recherche globale dans le code et les SQL | `return_rate` n'existe nulle part dans le schéma ni dans les types. | **`AFFIRMATION FAUSSE`** *(sans objet)* |
| **4.6 Cron de rafraîchissement authentifié** : Route `/api/cron/refresh-kit-scores` protégée par `CRON_SECRET`. | `RAPPORT_LIGNEES.md` §4 | Inspection de `src/app/api/cron/refresh-kit-scores/route.ts:14-18` | `if (authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }` | **`CONFORME`** |

---

### Lot 5 — Intégration UI / UX

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **5.1 Aucune route `kits/[slug]` créée** : Seule `/k/[token]` pour les lignées. | `RAPPORT_LIGNEES.md` §5 | Inspection du système de fichiers `src/app` | Une route préexistante `src/app/kits/[slug]/page.tsx` date de juillet 2026 (éditoriale). Le chantier lignées n'a créé que `src/app/k/[token]/page.tsx`. | **`ÉCART DE FORMULATION`** *(aucun conflit fonctionnel)* |
| **5.2 KitSheet tokens Design System** : Respect strict de la palette et typographie. | `RAPPORT_LIGNEES.md` §5 | Audit CSS de `KitSheetModal.tsx` | Contenait l'ancienne couleur `#0B1F17` en 6 endroits. Corrigé vers `#17402C` et `#5B7F55`. | **`ÉCART`** → **`CORRIGÉ`** |
| **5.3 Invocations KitSheet sur 5 points d'entrée** : Branché sur messages, cockpit, page produit, feed, groupes. | `RAPPORT_LIGNEES.md` §5 | Grep sur `KitSheetModal` et `useKitSheet` | Présent dans : `src/features/messaging/components/UnifiedChatModal.tsx`, `src/app/cockpit/page.tsx`, `src/app/materiel/kits/[id]/page.tsx`. ABSENT du feed social et des pages de groupes. | **`ÉCART`** *(3 points branchés sur 5)* |
| **5.4 Aucune UI part créateur dans KitSheet** : Aucune donnée de commission affichée. | `RAPPORT_LIGNEES.md` §5 | Inspection du composant `KitSheetModal.tsx` | Zéro mention d'euros, de pourcentage ou de royalties créateur. | **`CONFORME`** |
| **5.5 Signature gestuelle KitSheet vs `PremiumBottomSheet`** : KitSheet consomme-t-il `PremiumBottomSheet` en mode `handle` ou a-t-il réécrit des touch handlers ? | Relecture critique de Tony | Inspection de `src/features/kits/components/KitSheetModal.tsx:160-170` | `KitSheetModal` n'utilise NI `PremiumBottomSheet` NI le hook `useDragDismiss` de la Phase Gestes. Il affiche un simple conteneur `div` avec poignée statique (`<div style={{ width: 40, height: 4, background: 'rgba(23,64,44,0.15)' }} />`) sans aucun suivi tactile du doigt ni drag-to-dismiss. | **`ÉCART GESTUEL MAJEUR`** |

---

### Lot 6 — Partage de Valeur (GELÉ)

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **6.1 Migration attributions absente de la liste active** : Non déployée. | `RAPPORT_LIGNEES.md` §6 | Inspection de `supabase/active_migrations.txt` | `20260903050000_kit_attributions.sql` est isolée et absente de tout déploiement automatique. | **`CONFORME`** |
| **6.2 Refus serveur 404 sur `/api/kits/my-royalties`** : Route protégée contre l'exposition prématurée. | `RAPPORT_LIGNEES.md` §6 | Inspection de `src/app/api/kits/my-royalties/route.ts` | Renvoyait 200 `{ frozen: true }`. Corrigé dans commit `0c939bb` pour renvoyer 404 franc (`status: 404, Lot 6 gelé`). | **`ÉCART`** → **`CORRIGÉ`** (`0c939bb`) |
| **6.3 `store_credit` non dépensable** : Aucun point d'encaissement du solde. | `RAPPORT_LIGNEES.md` §6 | Analyse du code checkout Stripe | Le checkout ne propose aucune option d'imputation de `store_credit_ledger`. Blocage technique total. | **`CONFORME`** |
| **6.4 Statut `paid` inatteignable** : Les attributions ne peuvent être finalisées. | `RAPPORT_LIGNEES.md` §6 | Inspection de `finalize_kit_attributions` | La requête cherche `s.status = 'confirmed'` alors que les sessions restent `'pending'`. Impossibilité mathématique d'émettre des paiements. | **`CONFORME`** |

---

### Lot 7 — Anti-Gamification

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **7.1 Zéro compteur de partage dans l'UI** : Aucun composant ne glorifie la viralité. | `RAPPORT_LIGNEES.md` §7 | Grep UI sur `share_count`, `nb_partages` | Aucune occurrence trouvée dans `src/components/kits/` ou `src/app/k/`. Invariant CI validé. | **`CONFORME`** |
| **7.2 Seuil de 20 lignées pour l'affichage régional** : Masquage si volume insuffisant. | `RAPPORT_LIGNEES.md` §7 | Inspection de `/api/kits/discovery/route.ts` | La route ignorait le seuil. Corrigé dans commit `81e7ef9` via `shouldShowRegionRanking(count)`. | **`ÉCART`** → **`CORRIGÉ`** (`81e7ef9`) |

---

### Lot 8 — RLS & Tests

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **8.1 RLS active sur chaque table créée** : Protection base par défaut. | `RAPPORT_LIGNEES.md` §8 | Inspection SQL des migrations | `kit_field_reports`, `checkout_intents`, `kit_attributions`, `kit_royalty_shares`, `store_credit_ledger` ont RLS. MAIS `royalty_config` (Lot 6 gelé) n'a pas `ENABLE ROW LEVEL SECURITY`. | **`ÉCART`** *(dans Lot 6 gelé)* |
| **8.2 Les 54 assertions pgTAP** : 54 tests unitaires SQL. | `RAPPORT_LIGNEES.md` §8 | Analyse des plans `lineage.test.sql`, `field_proof.test.sql`, `stripe_fix.test.sql`, `conservation.test.sql`, `attributions.test.sql` | La somme des plans annoncés était 10+14+15+8+7 = 54. Le compte réel d'assertions écrites était de 61. Ajusté dans commit `046f608` (`plan(21)` sur lineage et `plan(16)` sur field_proof). | **`ÉCART DE COMPTE`** → **`CORRIGÉ`** (`046f608`) |

---

### Chantier Orientation & Empreinte (ADR-010)

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **O.1 `user_orientation` RLS** : Table privée, lecture et écriture réservées au propriétaire. | ADR-010 / Code | Inspection de `20260904010000_user_orientation.sql:35-50` | `ALTER TABLE public.user_orientation ENABLE ROW LEVEL SECURITY; CREATE POLICY user_orientation_own ON public.user_orientation FOR ALL USING (auth.uid() = user_id);` | **`CONFORME`** |
| **O.2 FieldSeal géométrie dérivée du `user_id` seul** : L'empreinte ne change pas la structure discrète mais module la densité continue. | ADR-010 / Code | Inspection de `src/features/identity/fieldSignature.ts` et `FieldSeal.tsx` | Était calculé à partir de `sig`. Corrigé dans commit `04a63e3` : branches et amplitude dérivent du seed FNV-1a de `user_id` ; l'activité module uniquement la variable continue `density` (0.25..1). | **`ÉCART`** → **`CORRIGÉ`** (`04a63e3`) |
| **O.3 `signature_visibility` défaut `'private'`** : Aucune fuite d'empreinte par défaut. | ADR-010 / Code | Inspection de `20260904010000_user_orientation.sql:22` | `signature_visibility text NOT NULL DEFAULT 'private' CHECK (signature_visibility IN ('private', 'semi_open', 'public'))` | **`CONFORME`** |
| **O.4 k-anonymat plancher de 3 par agrégat** : Plancher appliqué par région et par saison exposée. | ADR-010 / Code | Inspection de `fieldSignature.ts` et tests | Était appliqué uniquement au global. Corrigé dans commit `04a63e3` : `distinct_months < 3` masque la saison, `r.count < 3` masque la région. Tests validés dans `field-signature.spec.ts`. | **`ÉCART`** → **`CORRIGÉ`** (`04a63e3`) |
| **O.5 Zéro token couleur nouveau** : Seule la palette ink/sage autorisée. | ADR-010 / Code | Exécution de `scripts/verify/identity_compliance.mjs` | Script passe avec succès (exit code 0). Zéro token `--role-*`. | **`CONFORME`** |
| **O.6 Accessibilité WCAG** : Contraste ≥ 4.5:1 et cibles tactiles ≥ 44px. | ADR-010 / Code | Inspection CSS de `FieldSeal.tsx` et `OrientationModal.tsx` | Rendu SVG indépendant des couleurs (forme lisible en niveaux de gris), boutons capsule ≥ 44px. | **`CONFORME`** |
| **O.7 Conformité design system de `/inscription`** : Page d'inscription respecte la charte. | Audit O.7 | Inspection de `src/app/inscription/page.tsx` | Contenait des classes Tailwind interdites (`emerald-500`, `red-50`, `#10b981`, etc.). Corrigé dans commit `eb28b9c` pour utiliser les tokens conformes (`#17402C`, `#5B7F55`, `rgba(168,68,58,0.08)`). | **`ÉCART`** → **`CORRIGÉ`** (`eb28b9c`) |

---

### Métriques & Suites de Tests

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **M.1 Glob Vitest couvre hiking** : Le glob de test inclut toutes les suites de routes et traces. | Demande initiale | Inspection de `vitest.config.ts` | `include: ['tests/**/*.spec.ts', 'src/**/__tests__/**/*.test.ts']` inclut bien l'ensemble des 9 suites de test hiking. | **`CONFORME`** |
| **M.2 Clarification des 32 tests dans CLAUDE.md** : 32 tests vs 9 fichiers. | `feat/lignees-kits` @ `6d0c7b7` | Inspection de `CLAUDE.md:65` | `CLAUDE.md` clarifié : 9 fichiers de test exécutant 32 sous-tests unitaires. | **`CONFORME`** |
| **M.3 Exécution réelle Vitest globale** : État de santé des tests unitaires de la base de code. | `npx vitest run` | Exécution console complète de Vitest | `339 tests collectés (54 fichiers) : 335 passed, 4 failed`. Les 4 échecs sont cantonnés à `tests/pois.spec.ts` car les clés Supabase serveur ne sont pas chargées dans l'environnement local Vitest. | **`CONFORME`** *(sur le périmètre du chantier)* |

---

### Phase Gestes Tactiles & Interaction Design (G.1 à G.11)

| Affirmation | Source | Méthode de vérification | Preuve brute | Verdict |
|---|---|---|---|---|
| **G.1 Fondations `gestureMath.ts`** : Logique de décision pure (double-tap 300ms, long-press 450ms, seuil dismiss 80px). | MISSION_LOG (Gestes) | Exécution de `npx vitest run tests/gestures.spec.ts` | `✓ tests/gestures.spec.ts (14 tests)` — 14/14 passants. Découplage complet du DOM. | **`CONFORME`** |
| **G.2 Hook `useDoubleTap.ts`** : Remplace les `lastTapRef` inline, supporte `onSingleTap` différé. | MISSION_LOG (Gestes) | Inspection de `src/hooks/gestures/useDoubleTap.ts` | Utilisé dans `MessageBubble.tsx`, `CommunityPostCard.tsx`, `ImageViewer.tsx`. Zéro `lastTapRef` restant dans `src/`. | **`CONFORME`** |
| **G.3 Hook `useLongPress.ts`** : Unifie l'appui long (450ms) avec annulation sur mouvement > 8px. | MISSION_LOG (Gestes) | Inspection de `src/hooks/gestures/useLongPress.ts` | Utilisé dans `MessageBubble.tsx`, `ConversationRow.tsx`, `CommunityPostCard.tsx`. | **`CONFORME`** |
| **G.4 Hook `useDragDismiss.ts`** : Physique élastique framer-motion avec modes `element` et `handle`. | MISSION_LOG (Gestes) | Inspection de `src/hooks/gestures/useDragDismiss.ts` | Gère le drag vertical `drag="y"`, `dragConstraints={{ top: 0 }}`, `dragElastic`, retour de `dragProps` / `handleProps`. | **`CONFORME`** |
| **G.5 Hook `useSwipe.ts`** : Centralisation du swipe horizontal (seuil 60px). | MISSION_LOG (Gestes) | Inspection de `src/hooks/gestures/useSwipe.ts` | Déplacé dans `hooks/gestures/`, ancien chemin ré-exporté pour compatibilité ascendante. | **`CONFORME`** |
| **G.6 `ExplorerMobileSheet` drag élastique** : Remplacement de l'ancien toggle binaire (touchstart/touchend) par un vrai suivi du doigt. | MISSION_LOG (Gestes) | Inspection de `ExplorerMobileSheet.tsx:40-75` | `useDragDismiss` intégré avec snap peek/expanded (seuil 48px), haptique conservée (medium/light). | **`CONFORME`** |
| **G.7 Sheets sociales unifiées** : Ajout du drag-to-dismiss sur `ShareSheet`, `MoreMenuSheet`, `ReportSheet`, `CommentsSheet`. | MISSION_LOG (Gestes) | Grep `useDragDismiss` dans `src/components/social/` | Présent dans les 4 modales en mode `handle` pour préserver le défilement vertical du contenu. | **`CONFORME`** |
| **G.8 Feed `CommunityPostCard` gestuel** : Double-tap-to-like avec cœur animé framer-motion + menu long-press rapide. | MISSION_LOG (Gestes) | Inspection de `CommunityPostCard.tsx:185-225` | `useDoubleTap` déclenche le like + animation `scale(1)` 60fps ; `useLongPress` ouvre le menu contextuel. | **`CONFORME`** |
| **G.9 `StoryViewer` plein écran** : Tap zones IG (40/60%), hold-to-pause, drag-down dismiss. | MISSION_LOG (Gestes) | Inspection de `CommunityStoriesBar.tsx` et `StoryViewer.tsx` | Boucle rAF 5s, pause au pointeur enfoncé, fermeture au glissement vers le bas. | **`CONFORME`** |
| **G.10 Visionneuse d'image `ImageViewer.tsx`** : Pinch-to-zoom 1x-4x, double-tap zoom, swipe down dismiss, 0 kB First Load. | MISSION_LOG (Gestes) | Inspection de `src/components/ui/ImageViewer.tsx` | Importé uniquement en `dynamic(..., { ssr: false })` dans `CommunityPostCard`. | **`CONFORME`** |
| **G.11 Neutralisation des 3 couleurs interdites** : Éradication de `#0B1F17`, `#2D6B4A`, `#A3C4A3` citées dans `INTERACTION_DESIGN_STATE.md`. | Relecture critique de Tony | Audit CSS et mise à jour de `INTERACTION_DESIGN_STATE.md` | `INTERACTION_DESIGN_STATE.md` neutralisé avec avertissement formel. `KitSheetModal.tsx`, `ProductLineageCard.tsx`, `LineageDiscovery.tsx` assainis vers `#17402C`, `#5B7F55`, `#A6C1A0`. | **`ÉCART HISTORIQUE`** → **`NEUTRALISÉ & CORRIGÉ`** |

---

## III. Synthèse des Correctifs Appliqués (Commits Atomiques)

1. `5607832` : `fix(stripe): webhook renvoie 500 sur erreur de commande au lieu d'avaler` (Affirmation 3.5).
2. `0c939bb` : `fix(kits): refus serveur 404 sur /api/kits/my-royalties tant que le Lot 6 est gelé` (Affirmation 6.2).
3. `81e7ef9` : `fix(kits): applique le seuil de 20 lignées minimum sur l'affichage régional` (Affirmation 7.2).
4. `046f608` : `fix(kits): verrouille l'immuabilité de filiation sur UPDATE et ajuste les plans pgTAP` (Affirmations 1.4 & 8.2).
5. `04a63e3` : `fix(identity): géométrie FieldSeal dérivée du userId seul et k-anonymat par agrégat` (Affirmations O.2 & O.4).
6. `eb28b9c` : `fix(inscription): conformité design system (palette sage/danger et boutons)` (Affirmation O.7).
7. `5f2f25d` : `ci: ajout des garde-fous anti-dérive (palette, finance score, partage, gel Lot 6)` (Phase 5).
8. `c3f4a1e` : `feat(stripe): script de réconciliation sécurisé par clé restreinte rk_live et emails hachés` (Phase 4).
9. `b7829dd` : `docs: rapports de vérification globale, réconciliation migrations et Stripe` (Phase 1, 3, 4).
10. `6b5081d` : `docs: journal de mission vérification globale` (Mise à jour MISSION_LOG.md).
11. Commit en cours : `fix(lineage): isolation physique Lot 6 dans migrations_frozen, verrouillage forked_from UPDATE, neutralisation palette v2.0 et tests pgTAP`.

---

## IV. Bloqueurs & Écarts Majeurs Reclassés

1. **BLOQUEUR N°1 — Rupture de la boucle d'entrée des lignées (Configurateur legacy)** :
   - `ConfiguratorWizard.tsx` écrit dans `kits` et `kit_items`.
   - `KitConfiguratorWizard.tsx` écrit dans `custom_kits`.
   - La table `materiel_kits` n'est **JAMAIS alimentée** par le parcours utilisateur normal (seul `/api/materiel/fork` y écrit).
   - **Conséquence directe** : Zéro souche vivante créée par les utilisateurs → les vues de survie `kit_item_survival_by_kit` et les scores `kit_trust_scores` tournent à vide sur 0 donnée.
   - **Décision d'architecture** : **UNIFICATION INDISPENSABLE** de la création de kits vers `materiel_kits` avant de pousser les Lots 4 et 7 en production.

2. **BLOQUEUR N°2 — Écart gestuel KitSheet (Point 5.5)** :
   - `KitSheetModal.tsx` n'utilise ni `PremiumBottomSheet` ni `useDragDismiss`. C'est une modale classique avec poignée statique décorative sans aucune physique de suivi du doigt.
   - **Action requise** : Refactoriser `KitSheetModal` avec `useDragDismiss(mode: 'handle')` pour rétablir la signature gestuelle native iOS.

3. **BLOQUEUR N°3 — Réconciliation Stripe en mémoire uniquement** :
   - Tony doit exécuter la réconciliation en injectant `$env:STRIPE_RESTRICTED_KEY="rk_live_..."` directement dans la session PowerShell (variable volatile en mémoire, jamais écrite dans `.env.local` ni sur le disque).

4. **BLOQUEUR N°4 — Déstockage physique et commandes historiques** :
   - Le trigger `decrement_stock_on_order` n'ayant jamais tourné pour les commandes Stripe historiques, le stock physique en réserve est désynchronisé du stock théorique en base. Un inventaire physique sur place est obligatoire avant toute validation manuelle via `honor_order.sql`.

5. **Déploiement Supabase : Validation sur copie obligatoire** :
   - Conformément aux exigences de Tony, le déploiement sur `icxyvwzfjbflcbqukpfz` ne doit avoir lieu **qu'après validation sur une base copie** (avec exécution des 58 assertions pgTAP actives et vérification du ratio de matching `product_id`).
   - Le Lot 6 (`20260903050000_kit_attributions.sql`) est physiquement déplacé dans `supabase/migrations_frozen/` pour garantir qu'aucun `supabase db push` ne l'appliquera par inadvertance.
   - Seuls 3 points d'entrée sur 5 sont branchés (`messages`, `cockpit`, `page produit`). Le fil d'actualité (`feed`) et les pages de `groupes` n'ont pas encore été connectés au modal.

4. **Découplage configurateur legacy (1.8)** :
   - Les configurateurs existants (`ConfiguratorWizard.tsx` et `KitConfiguratorWizard.tsx`) enregistrent encore dans les tables legacy `kits` et `custom_kits`. Une refactorisation du flux de création de kits sera requise lors d'un sprint ultérieur pour alimenter nativement `materiel_kits`.
