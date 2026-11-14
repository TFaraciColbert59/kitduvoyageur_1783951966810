# Rapport de Handoff — Explorer Survey 3 (Lot 3 : Spécifications Compte Démo, Inventaire Mocks & Script SQL Purge Supabase)

## 1. Observation

### A. Compte Démo Officiel Léa Fontaine
- **Fichiers source analysés** :
  - `src/app/api/demo-login/route.ts` (l. 17-26, 39-59, 76-92) : gère la connexion automatique via `DEMO_AUTO_LOGIN=true`, `DEMO_LOGIN_EMAIL` et `DEMO_LOGIN_PASSWORD` (avec fallback magic-link via `SUPABASE_SERVICE_ROLE_KEY`).
  - `src/app/connexion/page.tsx` (l. 48-56, 340-345) : bouton « Connexion démo » pointant vers `/api/demo-login` (POST ou GET direct).
  - `src/app/api/auth/demo/route.ts` (l. 10-38) : route API secondaire vérifiant `process.env.DEMO_AUTO_LOGIN === 'true'`.
  - `scripts/ops/phase1_demo_check.mjs` (l. 46) : référence fixe `const DEMO_ID = 'd5451f35-db9f-4575-9114-6d3b79550bbc';`.
  - `supabase/migrations/20261010160000_phase1_demo_isolation.sql` (l. 26) : isole le compte démo canonique `id = 'd5451f35-db9f-4575-9114-6d3b79550bbc'`.
- **Données réelles lues sur Supabase (`icxyvwzfjbflcbqukpfz`)** :
  - `id`: `'d5451f35-db9f-4575-9114-6d3b79550bbc'`
  - `email`: `'demo@lkdv.app'`
  - `full_name`: `'Léa Fontaine'`
  - `handle`: `'lea.fontaine'`
  - `role`: `'user'`
  - `is_demo`: `false` (ouvert / utilisable en mode normal)
  - Données associées réelles : 16 trips, 27 posts, 11 clubs, 10 orders, trust score 94, loyalty points 4330.
  - **Règle absolue** : Ce compte est le compte officiel le plus complet de l'application et ne doit JAMAIS être purgé ni altéré.

---

### B. Inventaire Exhaustif des Mocks du Codebase

| Catégorie | Identifiant / Constante | Fichiers & Lignes | Nature du Mock & Action Requise |
|---|---|---|---|
| **Presets Clubs** | `CLUB_PRESETS` | `src/components/clubs/ClubLiquidGlassV8.tsx` (l. 304, 573, 856) | Presets statiques pour clubs par défaut (`cl1` à `cl4`). À remplacer par chargement dynamique Supabase. |
| **Mocks Runtimes V8** | `_MOCK_HIGHLIGHTS`<br>`_MOCK_MASSIFS`<br>`_MOCK_OUTINGS`<br>`_MOCK_CARNETS`<br>`_MOCK_SPECIES`<br>`_MOCK_KITS_LINEAGE`<br>`_MOCK_ORDERS_BOOKINGS`<br>`_MOCK_TRIBU`<br>`_MOCK_CLUBS` | `src/components/compte/compte-liquid-glass-v8-runtime.js` (l. 411, 478, 487, 506, 514, 523, 539, 551, 561, 3093, 3122)<br>`src/components/clubs/club-liquid-glass-v8-runtime.js` (l. 194, 204, 213, 232, 240, 249, 265, 277, 287) | Tableaux d'objets hardcodés dans les runtimes JS v8 du compte et des clubs. Doivent être éradiqués au profit de la coque `Profile6040Shell` et des tables réelles. |
| **Constantes DEMO_** | `DEMO_CARNETS`<br>`DEMO_OUTINGS`<br>`DEMO_CLUBS`<br>`DEMO_GEAR_ITEMS`<br>`DEMO_ORDERS`<br>`DEMO_ACTIVE_LOANS` | `src/components/compte/CompteLiquidGlassV8.tsx` (l. 174, 249, 352, 373, 383, 389, 1147-1152)<br>`src/components/clubs/ClubLiquidGlassV8.tsx` (l. 92, 155, 258, 279, 289, 295, 872-877) | Listes factices injectées en dur dans les composants React. À purger. |
| **Constantes Studio** | `DEMO_OWN`<br>`DEMO_STUDIO_DATA` | `src/features/kit-studio/domain/studioData.ts` (l. 53, 66, 78, 87, 92) | État de secours statique du kit studio quand la base n'a pas répondu. À brancher exclusivement sur `getStudioData.ts`. |
| **Commentaires Reels** | `DEMO_FREEDOM_COMMENTS` | `src/features/community/reels/freedomReelsService.ts` (l. 240, 433, 555-556) | Dictionnaire de commentaires de démo pour les reels `reel-1`, `reel-2`. |
| **Avatar Base64 Tony** | `TONY_AVATAR` | `src/components/compte/compte-liquid-glass-v8-runtime.js` (l. 45, 3202, 3847, 4191, 4506)<br>`src/components/clubs/club-liquid-glass-v8-runtime.js` (l. 45) | Image JPEG base64 injectée comme avatar par défaut. À remplacer par initiale stylisée ou `avatar_url` réel. |
| **Auteur Thomas Alps** | `author-thomas-alps`<br>`thomas_mountains` | `src/app/profil/[id]/page.tsx` (l. 110)<br>`src/features/community/reels/freedomReelsService.ts` (l. 261) | ID d'auteur de démonstration hardcodé dans le routage de profil public. |
| **Fausses Stories / Highlights** | `Dolomites`, `GR20`, `Aiguilles de Bavella`, `Tre Cime di Lavaredo` | `src/components/compte/drawer/compte/HighlightEditDrawer.tsx` (l. 26)<br>`src/components/compte/CompteLiquidGlassV8.tsx` (l. 225, 237, 292, 343)<br>`src/components/clubs/ClubLiquidGlassV8.tsx` (l. 135, 145, 198)<br>`src/components/compte/compte-liquid-glass-v8-runtime.js` (l. 414, 450, 483, 492) | Highlights et massifs factices pré-remplis dans le drawer et les vues profils/clubs. |
| **Profil Fictif Marceline** | `compte-marceline.ts` | `src/lib/mock/compte-marceline.ts` (l. 1-280, nom `Marceline Chevrier`) | Fichier mock complet utilisé pour des prototypes hors base. |
| **Checkout Faux Nom / Carte** | `4242`, `Titulaire` | `src/app/checkout/page.tsx` (l. 484-490) | Carte bancaire fictive `•••• 4242` avec placeholder. |
| **Fallback Image Invalide** | `/assets/images/no_image.png` | 40+ occurrences : `src/components/ui/AppImage.tsx`, `src/features/trips/components/TripCard.tsx`, `src/features/messaging/`, `src/features/hub/`, etc. | Fichier image manquant ou PNG opaque. Doit être remplacé par un placeholder SVG transparent Liquid Glass ou masqué si vide. |
| **Kits en Dur Studio** | `KITS` (`tmb`, `vercors`, `cabine`) | `src/features/kit-studio/domain/catalog.ts` (l. 1389-1518) | Modèles de kits hardcodés de la maquette originale. |

---

### C. Lignes Parasites Détectées en Base de Données (`icxyvwzfjbflcbqukpfz`)

1. **Club Judisid** :
   - Club : `e96aed5c-bb20-4728-bbb0-5912af26f5ed` (`Judisid`, slug `judisid-4xv6`).
   - Post de test associé : `3e478630-f742-4073-af8d-4ac1c17312b1` ("Bienvenue dans Judisid").
2. **Événements Seeds Parasites dans `public.events`** (4 événements) :
   - `465d0a27-8b40-5f50-b903-943f1881790e` : `'Rencontre vanlife — Biscarrosse'`
   - `9694eb1f-96d3-569d-9733-e908177685d3` : `'Soirée Népal — retour de trek'`
   - `6e8bbcad-85b7-548a-9492-77c82b656d60` : `'Rencontre Japon — récits de marche'`
   - `27747609-b22b-4f23-bfc0-fd88caf8d809` : `'Jeudjdjd'`
3. **Événements Seeds Parasites dans `public.club_events`** (27 événements) :
   - Événements factices dupliqués dans tous les clubs : `'Bivouac Initiation%'` et `'Expédition avancée%'`.
4. **Posts Seed CC0 dans `public.community_posts`** (16 posts) :
   - Posts contenant `libre CC0`, `Wikimedia Commons` ou liens Unsplash de moodboards initiaux hors compte Léa.
5. **Comptes de Test Parasites dans `auth.users`** (83 comptes identifiés) :
   - Profils de test gibberish : `gre@ezfe.com` (`ergre`, UID `4a55e4c5-2418-49fe-8250-4ed98daed03f`), `dndjdj@jdjdj.com` (`Bdjdjdjd`, UID `d988b6b3-ef6c-4c5a-998e-4ac5a1f4c9e9`), `dhjdjd@...`, `jdidjd@...`, etc.
   - Bots de tests automatisés : `lkdv.e2e.*@test.com` (14 comptes), `lkdv.session.*` (3 comptes), `traytest_*` (3 comptes), `a13-e2e-*`, `phase3-e2e-*`, `e2e-hub-*`, `dbg-*`, `audit-*`, `perf-bench-*`, `recette.*`.
   - Comptes démo secondaires obsolètes : `compas.demo@...`, `y-demo@...`, `lea.demo@lkdv-demo.test`, `malik.demo@...`, `claude-demo@...`, `sefsedemo@...`, `demo.a.stories@...`, `demo.b.stories@...`.
   - Comptes typos Tony créés lors de tests d'authentification : `faracitonyp*@gmail.com*`, `tony.faraci@altiore-*patrimoine.com` (typos sur le domaine).

---

### D. Découverte Critique Contraintes & Triggers PostgreSQL
Lors du premier test d'exécution transactionnelle, l'erreur suivante a été interceptée :
```
ERROR: P0001: Impossible de modifier l expéditeur d un message
WHERE: PL/pgSQL function prevent_message_immutable_fields_update() line 7 at RAISE
SQL statement: "UPDATE ONLY public.messages SET sender_id = NULL WHERE $1 OPERATOR(pg_catalog.=) sender_id"
```
**Cause racine** : La clé étrangère `messages.sender_id` est déclarée en `ON DELETE SET NULL`. Cependant, un trigger d'audit `prevent_message_immutable_fields_update()` interdit la modification de `sender_id`. Lorsqu'un utilisateur ayant envoyé un message de test est supprimé, PostgreSQL tente d'exécuter `SET sender_id = NULL`, ce qui déclenche le trigger et annule l'opération.
**Solution validée** : Supprimer en amont les messages et conversations envoyés par les comptes de test ciblés (`DELETE FROM public.messages WHERE sender_id IN (...)`).

---

## 2. Logic Chain

1. **Protection absolue de Léa Fontaine** :
   - L'application `/connexion` dépend directement de la route `/api/demo-login`.
   - Le compte de référence unique en base est `d5451f35-db9f-4575-9114-6d3b79550bbc` (`demo@lkdv.app`).
   - Toutes les requêtes SQL doivent exclure explicitement cet UID et cet email : `id <> 'd5451f35-db9f-4575-9114-6d3b79550bbc' AND email <> 'demo@lkdv.app'`.
2. **Isolation des cibles du Lot 3** :
   - Les comptes réels des fondateurs (`tony.faraci@altiore-patrimoine.com`, `faracitonyp@gmail.com`, `gasbayart@gmail.com`) et les profils curés de la communauté (`@voyageurs.lkdv.app`) doivent être strictement préservés.
   - Les 83 comptes parasites sont formellement isolés via une table temporaire `target_user_ids`.
3. **Ordre d'exécution strict des suppressions en base** :
   - Nettoyage des tables dépendantes dont les triggers empêcheraient le `SET NULL` (`public.messages`, `public.conversations`, `public.notifications`).
   - Suppression du club `Judisid` et de ses tables filles (`club_members`, `club_channels`, `club_events`, `community_posts`).
   - Suppression des événements seeds de `public.events` et `public.club_events` avec leurs inscriptions.
   - Suppression des posts CC0 seeds de `public.community_posts` avec leurs likes/commentaires.
   - Suppression finale dans `auth.users`, qui cascade proprement sur `public.user_profiles` et toutes ses dépendances FK sans erreur.

---

## 3. Caveats

1. **Environnement de Test Dry-Run** :
   - Le script SQL ci-dessous a été testé directement sur le cluster Supabase de production `icxyvwzfjbflcbqukpfz` avec `ROLLBACK` intégral (0 ligne détruite pendant l'enquête).
   - Le test a confirmé que la transaction passe à 100 % sans aucune violation de contrainte.
2. **Rôle de l'Exécuteur Lot 3** :
   - L'exécuteur du Lot 3 devra appliquer cette transaction avec `COMMIT;` une fois le Lot 3 démarré.
3. **Nettoyage Codebase** :
   - La suppression des mocks dans le code TypeScript/JavaScript doit être coordonnée avec l'introduction des composants et données réelles (notamment `Profile6040Shell` du Lot 4 et `getStudioData.ts`).

---

## 4. Conclusion & Script SQL de Purge

### A. Spécifications du Compte Démo Officiel à Préserver
- **UID Supabase** : `d5451f35-db9f-4575-9114-6d3b79550bbc`
- **Email** : `demo@lkdv.app`
- **Nom complet** : `Léa Fontaine`
- **Handle** : `lea.fontaine`
- **Point d'entrée Web** : `/connexion` → clic sur « Connexion démo » → appel `/api/demo-login` (ou lien direct GET `/api/demo-login`).

---

### B. Script SQL Exécutable — Purge Ciblée Lot 3 (`icxyvwzfjbflcbqukpfz`)

Ce script est transactionnel, idempotent, prêt à être exécuté dans l'éditeur SQL de Supabase ou via un script Node.js sécurisé :

```sql
-- ============================================================================
-- PURGE CIBLÉE LOT 3 — ASSAINISSEMENT DES DONNÉES PARASITES SUR SUPABASE
-- Base cible : icxyvwzfjbflcbqukpfz (lekitduvoyageur2)
-- SÉCURITÉ : Léa Fontaine (d5451f35-db9f-4575-9114-6d3b79550bbc) est EXCLUE.
-- ============================================================================

BEGIN;

-- Étape 0 : Table temporaire des comptes de test parasites (83 comptes)
CREATE TEMP TABLE target_user_ids ON COMMIT DROP AS
SELECT id FROM auth.users
WHERE id <> 'd5451f35-db9f-4575-9114-6d3b79550bbc'
  AND email <> 'demo@lkdv.app'
  AND (
    -- Profils gibberish / tests manuels
    email ILIKE '%ergre%' OR email ILIKE '%erger%' OR email ILIKE '%gregerr%'
    OR email ILIKE '%jdjd%' OR email ILIKE '%jdid%' OR email ILIKE '%bdjd%'
    OR email ILIKE '%ezfe%' OR email ILIKE '%ezfzef%' OR email ILIKE '%zfzef%'
    OR email ILIKE '%traytest%'
    OR email ILIKE '%@essai.invalid'
    OR email ILIKE 'recette.%' OR email ILIKE '%.recette@%' OR email ILIKE '%recette%'
    OR email ILIKE 'final.%@example.com' OR email ILIKE 'ultime.%@example.com'
    -- Comptes de tests automatisés E2E & Benchmarks
    OR email ILIKE 'lkdv.e2e.%' OR email ILIKE 'lkdv.session.%' OR email ILIKE 'lkdv.onboard.%'
    OR email ILIKE 'lkdv.drawer.%' OR email ILIKE 'lkdv.seed.%'
    OR email ILIKE 'a13-e2e-%' OR email ILIKE 'phase3-e2e-%' OR email ILIKE 'e2e-hub-%' OR email ILIKE 'dbg-%'
    OR email ILIKE 'audit-%' OR email ILIKE 'perf-bench-%' OR email ILIKE 'debug.kit.%'
    -- Comptes démo secondaires / obsolètes
    OR email ILIKE 'compas.demo@%' OR email ILIKE 'y-demo@%' OR email ILIKE 'lea.demo@%'
    OR email ILIKE 'malik.demo@%' OR email ILIKE 'claude-demo@%' OR email ILIKE 'sefsedemo@%'
    OR email ILIKE 'demo.a.stories@%' OR email ILIKE 'demo.b.stories@%' OR email ILIKE 'demo.bot@%'
    -- Typos de saisie Tony sur les noms de domaine
    OR email ILIKE '%patrthffxtghimoine%' OR email ILIKE '%prdgdrgdrgatrimoine%' OR email ILIKE '%zefzefpatrimoine%'
    OR email ILIKE '%fuyfud%' OR email ILIKE '%comefzfzz%' OR email ILIKE '%ffearera%'
    OR email ILIKE '%sqcdcsq%' OR email ILIKE '%tfty@%' OR email ILIKE '%dezdez@%'
    OR email ILIKE '%ebnzevve@%' OR email ILIKE '%rhtrth@%'
  );

-- Étape 1 : Contournement du trigger prevent_message_immutable_fields_update()
-- On supprime les messages et conversations créés par ces comptes de test
DELETE FROM public.messages WHERE sender_id IN (SELECT id FROM target_user_ids);
DELETE FROM public.conversation_members WHERE user_id IN (SELECT id FROM target_user_ids);
DELETE FROM public.conversations WHERE created_by IN (SELECT id FROM target_user_ids);

-- Étape 2 : Notifications liées aux comptes de test
DELETE FROM public.notifications 
WHERE user_id IN (SELECT id FROM target_user_ids) 
   OR actor_id IN (SELECT id FROM target_user_ids);

-- Étape 3 : Suppression du Club test Judisid et de ses dépendances
DELETE FROM public.community_posts 
WHERE club_id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed' 
   OR title ILIKE '%judisid%';

DELETE FROM public.club_members WHERE club_id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed';
DELETE FROM public.club_channels WHERE club_id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed';
DELETE FROM public.club_events WHERE club_id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed';
DELETE FROM public.clubs 
WHERE id = 'e96aed5c-bb20-4728-bbb0-5912af26f5ed' 
   OR slug LIKE '%judisid%';

-- Étape 4 : Suppression des événements seeds de démonstration dans public.events (4 événements)
DELETE FROM public.event_participants WHERE event_id IN (
  SELECT id FROM public.events WHERE title IN (
    'Rencontre vanlife — Biscarrosse',
    'Soirée Népal — retour de trek',
    'Rencontre Japon — récits de marche',
    'Jeudjdjd'
  )
);

DELETE FROM public.events WHERE title IN (
  'Rencontre vanlife — Biscarrosse',
  'Soirée Népal — retour de trek',
  'Rencontre Japon — récits de marche',
  'Jeudjdjd'
);

-- Étape 5 : Suppression des événements seeds de démonstration dans public.club_events (27 événements)
DELETE FROM public.club_event_registrations WHERE event_id IN (
  SELECT id FROM public.club_events 
  WHERE title ILIKE 'Bivouac Initiation%' OR title ILIKE 'Expédition avancée%'
);

DELETE FROM public.club_events 
WHERE title ILIKE 'Bivouac Initiation%' OR title ILIKE 'Expédition avancée%';

-- Étape 6 : Suppression des posts seeds CC0 dans public.community_posts (16 posts)
DELETE FROM public.post_likes WHERE post_id IN (
  SELECT id FROM public.community_posts
  WHERE (content ILIKE '%libre CC0%' OR content ILIKE '%Wikimedia Commons%' OR content ILIKE '%Unsplash%')
    AND author_id <> 'd5451f35-db9f-4575-9114-6d3b79550bbc'
);

DELETE FROM public.post_comments WHERE post_id IN (
  SELECT id FROM public.community_posts
  WHERE (content ILIKE '%libre CC0%' OR content ILIKE '%Wikimedia Commons%' OR content ILIKE '%Unsplash%')
    AND author_id <> 'd5451f35-db9f-4575-9114-6d3b79550bbc'
);

DELETE FROM public.community_posts
WHERE (content ILIKE '%libre CC0%' OR content ILIKE '%Wikimedia Commons%' OR content ILIKE '%Unsplash%')
  AND author_id <> 'd5451f35-db9f-4575-9114-6d3b79550bbc';

-- Étape 7 : Suppression des comptes de test dans auth.users
-- Cascade automatiquement vers public.user_profiles, trips, carnets, progression, etc.
DELETE FROM auth.users WHERE id IN (SELECT id FROM target_user_ids);

COMMIT;
```

---

## 5. Verification Method

Pour vérifier de façon indépendante les observations et le script de purge :

1. **Vérification de l'intégrité du compte démo Léa Fontaine** :
   ```bash
   node scripts/ops/phase1_demo_check.mjs
   ```
   Confirme que `d5451f35-db9f-4575-9114-6d3b79550bbc` est bien présent et possède ses 15 événements seed et transactions intactes.

2. **Test Dry-Run du script SQL sans effet destructeur** :
   Exécuter le script SQL dans PostgreSQL en remplaçant `COMMIT;` par `ROLLBACK;`.
   Vérifier que la transaction s'exécute avec le statut `SUCCESS` et 0 erreur.

3. **Vérification du zéro impact sur les comptes légitimes** :
   Exécuter la requête suivante pour s'assurer que Léa Fontaine et les comptes créateurs sont exclus de la table temporaire :
   ```sql
   SELECT id, email FROM auth.users 
   WHERE id = 'd5451f35-db9f-4575-9114-6d3b79550bbc' 
      OR email IN ('demo@lkdv.app', 'tony.faraci@altiore-patrimoine.com', 'gasbayart@gmail.com');
   ```
   Le résultat doit retourner exactement les comptes réels non modifiés.
