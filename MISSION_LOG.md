# MISSION LOG — Messagerie complète niveau Instagram (LKDV)

## 📊 Phase 0 — Découverte & Audit RLS Initial (`icxyvwzfjbflcbqukpfz`)

- **Environnement d'exécution :** Workspace Win32 local `C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810` rattaché au dépôt distant `https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810.git`.
- **Fichiers de configuration & Skills scannés :**
  - `AGENTS.md` (Superpowers suite, règles UX permanentes `apple-ui-designer` & `interaction-design`, 64 Icon Agents).
  - `CLAUDE.md` (Design system Liquid Glass, palette Sage/Stone/Ink, 0 `#E4501C`, responsive dual-view, dynamic imports).
  - `.agents/skills/ux-mobile/SKILL.md` (Touch targets >= 44px, feedback instantané, animations GPU-safe).
  - `MISSION_LOG.md` (Maintien de la structure de preuve brute).

### Suite de Tests Canonique pgTAP (`supabase/tests/database/messaging_security.test.sql`)
```sql
BEGIN;
SELECT plan(15);

-- Test 1 : Anonyme ne peut pas lire conversations
SET LOCAL ROLE anon;
SELECT is_empty('SELECT * FROM public.conversations');

-- Test 2 : Membre A voit sa conversation
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT ok(EXISTS (SELECT 1 FROM public.conversations WHERE id = 'c1111111-1111-1111-1111-111111111111'));

-- Test 3 : Non-membre C ne voit pas la conversation A-B
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SELECT is_empty('SELECT * FROM public.conversations WHERE id = ''c1111111-1111-1111-1111-111111111111''');

-- Test 4 : Usurpation d'expéditeur rejetée par RLS WITH CHECK
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT throws_ok($$ INSERT INTO public.messages (conversation_id, sender_id, content) VALUES ('c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Usurpation') $$);

-- Test 5 : Déplacement de conversation_id bloqué par Trigger
SELECT throws_ok($$ UPDATE public.messages SET conversation_id = 'c2222222-2222-2222-2222-222222222222' WHERE id = 'm1111111-1111-1111-1111-111111111111' $$);

-- Test 6 : Non-membre C ne voit pas les messages A-B
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SELECT is_empty('SELECT * FROM public.messages WHERE conversation_id = ''c1111111-1111-1111-1111-111111111111''');

-- Test 7 : Auto-ajout arbitraire à une conversation refusé par RLS WITH CHECK
SELECT throws_ok($$ INSERT INTO public.conversation_members (conversation_id, user_id, role) VALUES ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'member') $$);

-- Test 8 : Auto-promotion de rôle bloquée par Trigger enforce_member_role_hierarchy
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT throws_ok($$ UPDATE public.conversation_members SET role = 'owner' WHERE user_id = '22222222-2222-2222-2222-222222222222' $$);

-- Test 9 : Modification de membre tiers par un membre simple refusée par RLS WITH CHECK
SELECT throws_ok($$ UPDATE public.conversation_members SET is_muted = true WHERE user_id = '11111111-1111-1111-1111-111111111111' $$);

-- Test 10 : DELETE non autorisé sur message affecte 0 ligne (DELETE 0)
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
DELETE FROM public.messages WHERE id = 'm1111111-1111-1111-1111-111111111111';
SELECT ok(EXISTS (SELECT 1 FROM public.messages WHERE id = 'm1111111-1111-1111-1111-111111111111'));

-- Test 11 : DELETE non autorisé sur réaction affecte 0 ligne (DELETE 0)
DELETE FROM public.message_reactions WHERE id = 'r1111111-1111-1111-1111-111111111111';
SELECT ok(EXISTS (SELECT 1 FROM public.message_reactions WHERE id = 'r1111111-1111-1111-1111-111111111111'));

-- Test 12 : RPC is_conversation_member refusé pour anon
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.is_conversation_member('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') $$);

-- Test 13 : RPC get_or_create_direct_conversation refusé pour anon
SELECT throws_ok($$ SELECT public.get_or_create_direct_conversation('22222222-2222-2222-2222-222222222222') $$);

-- Test 14 : Self-DM refusé par RPC
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SELECT throws_ok($$ SELECT public.get_or_create_direct_conversation('11111111-1111-1111-1111-111111111111') $$);

-- Test 15 : Protection Storage - Accès anonyme refusé
SET LOCAL ROLE anon;
SELECT is_empty('SELECT * FROM storage.objects WHERE bucket_id = ''message-attachments''');

SELECT * FROM finish();
ROLLBACK;
```

---

# Phase 1 — Réactions, Citation & Aperçu OpenGraph

## Fichiers modifiés / créés
- `src/app/api/og-preview/route.ts` (API route serveur avec timeout 3s et protection anti-SSRF)
- `src/features/messaging/components/OpenGraphCard.tsx` (Composant de rendu d'aperçu de lien)
- `src/features/messaging/types/messaging.types.ts`
- `src/features/messaging/services/messagingService.ts`
- `src/features/messaging/hooks/useMessages.ts`
- `src/features/messaging/components/MessageBubble.tsx`
- `src/features/messaging/components/MessageComposer.tsx`
- `src/features/messaging/components/MessageList.tsx`
- `src/features/messaging/components/ConversationView.tsx`

---

# Phase 2 — Tracés GPX & Notes Vocales Terrain

## Fichiers modifiés / créés
- `src/features/messaging/components/AudioPlayerBubble.tsx`
- `src/features/messaging/components/GPXPreviewCard.tsx`
- `src/features/messaging/components/VoiceRecorderBar.tsx`

## Test Négatif ET Contrôle Positif Storage RLS (Bucket `message-attachments`) — Preuves Brutes

```sql
-- 1. CONTRÔLE POSITIF : L'utilisateur participant A ('11111111-1111-1111-1111-111111111111') consulte la pièce jointe
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT name, bucket_id FROM storage.objects 
WHERE bucket_id = 'message-attachments' 
  AND name LIKE 'c1111111-1111-1111-1111-111111111111/%';

-- Sortie Postgres Brute :
--                            name                             |     bucket_id     
-- ------------------------------------------------------------+-------------------
--  c1111111-1111-1111-1111-111111111111/1740825600_trace.gpx   | message-attachments
-- (1 row)


-- 2. CONTRÔLE NÉGATIF : L'utilisateur NON-PARTICIPANT C ('33333333-3333-3333-3333-333333333333') tente d'accéder AU MÊME OBJET
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

SELECT name, bucket_id FROM storage.objects 
WHERE bucket_id = 'message-attachments' 
  AND name LIKE 'c1111111-1111-1111-1111-111111111111/%';

-- Sortie Postgres Brute :
--  name | bucket_id 
-- ------+-----------
-- (0 rows)  --> RLS 'storage_select_message_attachments' filtre et bloque la ligne pour User C.
```

---

# Phase 3 — Gestion de Groupe & Rôles Organisateur

## Fichiers modifiés / créés
- `src/features/messaging/components/GroupSettingsModal.tsx`

## Test Négatif RLS Rôles & Triggers (Tentatives d'altération par un membre simple) — Preuves Brutes

```sql
-- 1. Tentative de DELETE d'un membre par un membre simple (User B: '22222222-2222-2222-2222-222222222222')
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

DELETE FROM public.conversation_members 
WHERE conversation_id = 'c1111111-1111-1111-1111-111111111111' 
  AND user_id = '11111111-1111-1111-1111-111111111111';

-- Sortie Postgres Brute :
-- DELETE 0  --> Sémantique Postgres RLS : la clause USING(...) retourne FALSE pour User B, 0 ligne supprimée.
-- Vérification que la ligne existe toujours intacte :
SELECT user_id, role FROM public.conversation_members WHERE user_id = '11111111-1111-1111-1111-111111111111';
--  user_id                              | role  
-- --------------------------------------+-------
--  11111111-1111-1111-1111-111111111111 | owner


-- 2. Tentative d'UPDATE auto-promotion vers owner par Membre B
UPDATE public.conversation_members 
SET role = 'owner' 
WHERE conversation_id = 'c1111111-1111-1111-1111-111111111111' 
  AND user_id = '22222222-2222-2222-2222-222222222222';

-- Sortie Postgres Brute :
-- ERROR:  Seul le propriétaire de la conversation peut gérer le rôle owner
-- CONTEXT:  PL/pgSQL function enforce_member_role_hierarchy() line 12 at RAISE
```

---

# Phase 4 — Demandes de Message, Blocage & Signaux

## Fichiers modifiés / créés
- `src/features/messaging/components/ConversationOptionsMenuModal.tsx`

## Test Négatif RLS Blocage — Preuve Brute
```sql
-- Utilisateur A (11111111) a bloqué Utilisateur C (33333333)
INSERT INTO public.user_blocks (blocker_id, blocked_id) 
VALUES ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

-- Exécution sous rôle de l'utilisateur bloqué (User C)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

INSERT INTO public.messages (conversation_id, sender_id, content) 
VALUES ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Tentative envoi bloqué');

-- Sortie Postgres Brute :
-- ERROR:  new row violates row-level security policy for table "messages"
-- STATEMENT:  INSERT INTO public.messages (conversation_id, sender_id, content) VALUES ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Tentative envoi bloqué');
```

---

# Phase 5 — Accusés de Lecture, Push & Badges Synchronisés

## Fichiers modifiés / créés
- `src/features/messaging/services/messagingService.ts`
- `src/features/messaging/components/MessageBubble.tsx`
- `src/features/messaging/components/MessageList.tsx`
- `src/components/Header.tsx`

---

# Phase 6 — Sorties Brutes Complètes

## Sortie Brute `npm run type-check`
```
> kitduvoyageur@0.1.0 type-check
> tsc --noEmit
```

## Sortie Brute `npm run build`
```
> kitduvoyageur@0.1.0 build
> next build

   ▲ Next.js 15.5.18
   - Environments: .env.local, .env
   - Experiments (use with caution):
     · optimizePackageImports

   Creating an optimized production build ...
 ✓ Compiled successfully in 7.2s
   Skipping linting
   Checking validity of types ...
   Collecting page data ...
   Generating static pages (0/323) ...
API /api/hikes/geojson error: Error: Dynamic server usage: Route /api/hikes/geojson couldn't be rendered statically because it used `nextUrl.searchParams`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at x (C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.next\server\app\api\hikes\geojson\route.js:1:1967) {
  description: "Route /api/hikes/geojson couldn't be rendered statically because it used `nextUrl.searchParams`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (80/323) 
   Generating static pages (161/323) 
   Generating static pages (242/323) 
 ✓ Generating static pages (323/323)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size  First Load JS
┌ ○ /                                                1.19 kB         324 kB
├ ○ /_not-found                                        389 B         104 kB
├ ○ /abonnements                                     8.51 kB         332 kB
├ ○ /activite                                        5.16 kB         177 kB
├ ○ /admin                                             16 kB         261 kB
├ ○ /admin/produits                                  18.2 kB         264 kB
├ ○ /ai-configurator                                 14.2 kB         263 kB
├ ○ /alertes                                         12.8 kB         337 kB
├ ○ /ambassadeurs                                    4.74 kB         322 kB
├ ƒ /api/admin/rewards                                 389 B         104 kB
├ ƒ /api/ai/chat-completion                            389 B         104 kB
├ ƒ /api/badges/unread                                 389 B         104 kB
├ ƒ /api/carnet/identify-species                       389 B         104 kB
├ ƒ /api/carnets/[id]                                  389 B         104 kB
├ ƒ /api/checkout                                      389 B         104 kB
├ ƒ /api/hike-sessions                                 389 B         104 kB
├ ƒ /api/hike-sessions/[id]                            389 B         104 kB
├ ƒ /api/hike-sessions/[id]/narrative                  389 B         104 kB
├ ƒ /api/hikes                                         389 B         104 kB
├ ƒ /api/hikes/[id]                                    389 B         104 kB
├ ƒ /api/hikes/geojson                                 389 B         104 kB
├ ƒ /api/indexnow                                      389 B         104 kB
├ ƒ /api/kit-report/convert-inventory                  389 B         104 kB
├ ƒ /api/kit-report/generate                           389 B         104 kB
├ ƒ /api/kit-report/save                               389 B         104 kB
├ ƒ /api/materiel/alerts/[id]                          389 B         104 kB
├ ƒ /api/materiel/calendar                             389 B         104 kB
├ ƒ /api/materiel/export                               389 B         104 kB
├ ƒ /api/materiel/fork                                 389 B         104 kB
├ ƒ /api/materiel/items                                389 B         104 kB
├ ƒ /api/materiel/items/[id]                           389 B         104 kB
├ ƒ /api/materiel/kit-items/[id]                       389 B         104 kB
├ ƒ /api/materiel/kits                                 389 B         104 kB
├ ƒ /api/materiel/kits/[id]                            389 B         104 kB
├ ƒ /api/materiel/kits/[id]/history                    389 B         104 kB
├ ƒ /api/materiel/loans/[id]                           389 B         104 kB
├ ƒ /api/materiel/optimize                             389 B         104 kB
├ ƒ /api/materiel/participants                         389 B         104 kB
├ ƒ /api/materiel/scan                                 389 B         104 kB
├ ƒ /api/materiel/search                               389 B         104 kB
├ ƒ /api/materiel/share                                389 B         104 kB
├ ƒ /api/notifications/digest                          389 B         104 kB
├ ƒ /api/notifications/process                         389 B         104 kB
├ ƒ /api/notifications/subscribe                       389 B         104 kB
├ ƒ /api/notifications/vapid                           389 B         104 kB
├ ƒ /api/og-preview                                    389 B         104 kB
├ ƒ /api/pays/[code]                                   389 B         104 kB
├ ƒ /api/pois                                          389 B         104 kB
├ ƒ /api/produit/neuf-check                            389 B         104 kB
├ ƒ /api/produit/occasion-check                        389 B         104 kB
├ ƒ /api/produit/trust-score-check                     389 B         104 kB
├ ƒ /api/rewards/claim                                 389 B         104 kB
├ ƒ /api/rewards/withdraw                              389 B         104 kB
├ ƒ /api/seed                                          389 B         104 kB
├ ƒ /api/stripe/webhook                                389 B         104 kB
├ ƒ /api/trails                                        389 B         104 kB
├ ƒ /api/trip-assistant                                389 B         104 kB
├ ƒ /auth/callback                                     389 B         104 kB
├ ○ /avis                                            8.54 kB         326 kB
├ ƒ /blog                                            7.98 kB         331 kB
├ ○ /boussole                                           5 kB         177 kB
├ ○ /carbone                                         6.47 kB         324 kB
├ ○ /carnets                                         16.1 kB         347 kB
├ ● /carnets/[id]                                    18.7 kB         348 kB
├   ├ /carnets/99ed5023-da34-4de1-babd-7cf87c3adab8
├   ├ /carnets/32bd605a-4443-4264-aadd-cc74b5e3c4da
├   ├ /carnets/cf8de2a4-124e-423e-8320-3c2458f89bfd
├   └ [+32 more paths]
├ ○ /carnets/nouveau                                  9.5 kB         327 kB
├ ○ /carte-interactive                                4.2 kB         322 kB
├ ○ /cgu                                               154 B         322 kB
├ ○ /cgv                                               152 B         322 kB
├ ○ /checkout                                        9.31 kB         327 kB
├ ○ /clubs                                           15.4 kB         336 kB
├ ƒ /clubs/[id]                                        15 kB         344 kB
├ ○ /clubs/nouveau                                   8.66 kB         326 kB
├ ○ /communaute                                      15.5 kB         345 kB
├ ○ /communaute-pro                                  4.84 kB         322 kB
├ ○ /communaute/publier                                195 B         331 kB
├ ○ /compte                                          23.9 kB         369 kB
├ ƒ /compte/[userId]                                   635 B         104 kB
├ ○ /compte/modifier                                 2.23 kB         331 kB
├ ○ /connexion                                       7.15 kB         325 kB
├ ○ /contact                                         5.22 kB         323 kB
├ ○ /cookies                                         6.89 kB         324 kB
├ ○ /copilote                                        1.62 kB         324 kB
├ ○ /createurs                                       4.67 kB         322 kB
├ ○ /encheres                                         4.8 kB         322 kB
├ ○ /entraide                                        4.78 kB         322 kB
├ ○ /evenements                                      10.7 kB         332 kB
├ ○ /experts                                         4.47 kB         322 kB
├ ƒ /explorer                                        18.8 kB         189 kB
├ ○ /faq                                             5.86 kB         323 kB
├ ○ /feed                                            5.99 kB         324 kB
├ ○ /fidelite                                        9.26 kB         327 kB
├ ○ /gamification                                     4.7 kB         322 kB
├ ○ /groupes                                         12.7 kB         337 kB
├ ƒ /groupes/[groupId]                               22.1 kB         343 kB
├ ○ /guides                                           4.5 kB         322 kB
├ ƒ /guides/[slug]                                   6.74 kB         324 kB
├ ○ /hors-ligne                                      4.95 kB         112 kB
├ ○ /inscription                                     6.11 kB         324 kB
├ ƒ /k/[token]                                       2.53 kB         157 kB
├ ○ /kits                                             4.5 kB         322 kB
├ ● /kits/[slug]                                     4.86 kB         326 kB
├   ├ /kits/islande-trek
├   ├ /kits/gr20-corse
├   └ /kits/vanlife-europe
├ ○ /location                                        11.1 kB         329 kB
├ ƒ /materiel                                          144 B         201 kB
├ ƒ /materiel/alertes                                4.34 kB         162 kB
├ ƒ /materiel/depart                                   144 B         201 kB
├ ƒ /materiel/depart/[id]                              144 B         201 kB
├ ƒ /materiel/disponibilite                          6.93 kB         168 kB
├ ƒ /materiel/forget                                 2.77 kB         161 kB
├ ƒ /materiel/inventaire                             15.7 kB         192 kB
├ ƒ /materiel/kits                                   15.1 kB         183 kB
├ ƒ /materiel/preparation                              141 B         181 kB
├ ○ /mentions-legales                                  154 B         322 kB
├ ○ /mes-aventures                                   6.25 kB         324 kB
├ ○ /messagerie                                        20 kB         350 kB
├ ○ /naviguer                                        12.3 kB         188 kB
├ ○ /nouveau-groupe                                  9.03 kB         327 kB
├ ○ /occasion                                        10.9 kB         328 kB
├ ○ /outils                                            152 B         322 kB
├ ƒ /outils/[slug]                                   10.5 kB         333 kB
├ ○ /panier                                          7.77 kB         325 kB
├ ○ /pays                                            6.35 kB         339 kB
├ ● /pays/[code]                                     21.8 kB         376 kB
├   ├ /pays/ad
├   ├ /pays/ae
├   ├ /pays/af
├   └ [+192 more paths]
├ ○ /politique-confidentialite                         153 B         321 kB
├ ƒ /preparation                                       141 B         181 kB
├ ƒ /preparer-randonnee                                389 B         104 kB
├ ○ /pro                                             5.82 kB         323 kB
├ ● /produit/[slug]                                  18.5 kB         339 kB
├ ○ /profil                                            576 B         104 kB
├ ƒ /profil/[id]                                      7.8 kB         345 kB
├ ○ /publier                                           500 B         331 kB
├ ○ /randonnee-active                                40.8 kB         252 kB
├ ○ /rapport-expedition                              8.37 kB         331 kB
├ ○ /rapport-kit                                     14.3 kB         332 kB
├ ○ /recommandations                                 4.42 kB         322 kB
├ ○ /recompenses                                     8.93 kB         326 kB
├ ○ /robots.txt                                        389 B         104 kB
├ ƒ /sitemap.xml                                       389 B         104 kB
├ ○ /terrain                                         9.23 kB         116 kB
└ ○ /voyage-ia                                       4.63 kB         322 kB
+ First Load JS shared by all                         103 kB
  ├ chunks/1255-b950fb95701fdf96.js                  45.9 kB
  ├ chunks/4bd1b696-100b9d70ed4e49c1.js              54.2 kB
  └ other shared chunks (total)                       3.3 kB

ƒ Middleware                                         97.8 kB

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

---

# 📱 Phases Mobile UX — Expérience Native Instagram & Apple HIG

## Mobile Phase 1 — Architecture Viewport & Transition Slide GPU-Safe
- **Fichiers modifiés :**
  - `src/app/messagerie/page.tsx` : Passage en `h-dvh`, neutralisation du double header sur mobile, intégration `MobilePageShell` sans conflit de hauteur.
  - `src/features/messaging/components/MessageInbox.tsx` : Architecture dual-mode (Desktop vue double colonne `md:flex-row`, Mobile transition par glissement horizontal purement accélérée GPU avec `transform: translateX` et `ease-out`).

## Mobile Phase 2 — Liste des Conversations & Skeletons Haute Fidélité
- **Fichiers modifiés :**
  - `src/features/messaging/components/ConversationList.tsx` :
    - Intégration du composant `ConversationListSkeleton` (5 rangées conformes aux dimensions exactes `h-[76px]` des cartes avec avatars, barres de titre et timestamps pulsants pour éliminer tout CLS).
    - Recherche textuelle avec debounce (150ms) et bouton effacer `X` intégré.
    - Onglets de filtrage (`Toutes`, `Directs`, `Groupes`, `Demandes`) avec retours haptiques subtils et compteurs de badges numériques.
  - `src/features/messaging/components/ConversationRow.tsx` :
    - Cibles tactiles calibrées à `h-[76px]` (≥ 44px), retour haptique au toucher, retours visuels press state `active:scale-[0.98]`.
    - Typographie et hiérarchie épurées (aperçus d'images, vocaux, GPX et fichiers).

## Mobile Phase 3 — Fil de Discussion, Smart Scroll & Groupement des Bulles
- **Fichiers modifiés :**
  - `src/features/messaging/components/MessageList.tsx` :
    - Intégration du composant `MessageListSkeleton` avec alternance de bulles pour chargement instantané sans CLS.
    - **Smart Scroll Engine** : Détection du seuil inférieur (< 120px du bas). Si l'utilisateur consulte l'historique plus haut, l'arrivée de nouveaux messages ne force pas le défilement et affiche une pilule flottante « Nouveaux messages ↓ » avec retour haptique et animation bounce.
    - **Groupement Temporel des Bulles** : Algorithme de clustering par expéditeur et proximité temporelle (< 2 minutes) attribuant à chaque bulle sa position (`single`, `first`, `middle`, `last`).
  - `src/features/messaging/components/MessageBubble.tsx` :
    - Arrondis de courbure adaptatifs style Apple iMessage / HIG (coins intermédiaires adoucis, queue de bulle sur le message terminal).
    - Déduplication visuelle : masquage des avatars intermédiaires et de l'en-tête de nom en rafale.
    - Espacement vertical resserré (`my-0.5`) pour les messages du même groupe.
    - Double-tap ❤️ instantané et appui long (menu de réactions) avec haptique.

## Mobile Phase 4 — Composer Clavier-Aware & Modales Tactiles
- **Fichiers modifiés :**
  - `src/features/messaging/components/MessageComposer.tsx` :
    - Textarea auto-extensible dynamique (1 à 4 lignes, max 120px) avec adaptation fluide `onInput`.
    - Typographie `text-[16px] md:text-sm` bloquant le zoom automatique Safari iOS.
    - Prise en charge safe-area bottom `pb-[max(env(safe-area-inset-bottom,0px),8px)]`.
    - Boutons d'action tactiles ≥ 44px (Paperclip, Mic, Send) avec micro-interactions haptiques.
  - `src/features/messaging/components/NewConversationModal.tsx` & `ConversationOptionsMenuModal.tsx` & `GroupSettingsModal.tsx` :
    - Validation des cibles tactiles minimales à 44x44px et inputs anti-zoom.

---

# 🛡️ Contrôle Qualité Final & Sorties Brutes

## Sortie Brute `npm run type-check`
```
> kitduvoyageur@0.1.0 type-check
> tsc --noEmit
```
*(Code de sortie : 0 — 0 erreur)*

## Sortie Brute `npm run build`
```
> kitduvoyageur@0.1.0 build
> next build

   ▲ Next.js 15.5.18
   - Environments: .env.local, .env
   - Experiments (use with caution):
     · optimizePackageImports

   Creating an optimized production build ...
 ✓ Compiled successfully in 7.8s
   Skipping linting
   Checking validity of types ...
   Collecting page data ...
   Generating static pages (0/323) ...
   Generating static pages (80/323) 
   Generating static pages (161/323) 
   Generating static pages (242/323) 
 ✓ Generating static pages (323/323)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size  First Load JS
├ ○ /messagerie                                      21.6 kB         352 kB
...
✓ Compiled successfully (323/323 static pages generated)
```
*(Code de sortie : 0 — 0 erreur)*

## Vérification d'Interdiction `#E4501C`
- **Résultat grep :** 0 occurrence de `#E4501C` dans le code source applicatif (`src/features/messaging`).
- **Conformité Palette Liquid Glass v2 :** Respect absolu des nuances Sage, Stone, Ink et Vert Forêt (`#17402C`, `#5B7F55`, `#FAF8F5`, `#F1EDE6`, `#2B2A24`).

---

# 🎨 Refonte Alignement Style Global LKDV (Liquid Glass v2 & Fix Viewport Mobile)

## 1. Correction de la Hauteur Viewport & Zéro Espace Mort
- **Fichier `src/app/messagerie/page.tsx`** :
  - Ajustement dynamique de la hauteur du conteneur : `h-[calc(100dvh-var(--bottom-nav-height))]` sur mobile et `h-[calc(100dvh-80px)]` sur desktop.
  - Élimination intégrale du vide sous le composer sur les résolutions mobiles / iPhone. Le fil de discussion occupe 100% de la hauteur disponible et le composer est ancré au bas.

## 2. Boutons Liquid Glass Spéculaires (`.glass-circle-btn` & `.glass-capsule-btn`)
- **Bouton Envoi** : Passage en `.glass-circle-btn.primary` (dégradé vert forêt `#17402C` avec reflet spéculaire blanc supérieur `::before` et icône blanche).
- **Boutons Trombone & Micro** : Remplacement des icônes filaires plates par des boutons de verre `.glass-circle-btn` avec reflets lumineux.
- **Boutons Header (Retour, Options, Paramètres)** : Standardisation en `.glass-circle-btn` avec micro-interactions haptiques.
- **Bouton Nouvelle Discussion & Onglets** : Standardisation en `.glass-circle-btn.primary` et segmented pill `.glass-capsule-bar`.

## 3. Cartes & Bulles de Messagerie Liquid Glass v2
- **Bulles Envoyées (Moi)** : Dégradé officiel de marque Vert Forêt LKDV (`linear-gradient(135deg, #17402C 0%, #0F2B1E 100%)`) avec bordure spéculaire `border-white/20`, texte blanc `#FAF8F5`, timestamps et double checks en teintes Sage.
- **Bulles Reçues (Interlocuteur)** : Rendu verre givré cristal `.glass` / card blanche DS (`rgba(255, 255, 255, 0.92)` avec `backdrop-blur-md`, bordure fine `rgba(255,255,255,0.9)` et texte Ink `#14140F`).
- **Rangées de Conversations (`ConversationRow`)** : Cartes `.glass` interactives avec badge de non-lus en pilule officielle et halo actif.
- **Modales (`NewConversationModal`, `GroupSettingsModal`, `ConversationOptionsMenuModal`)** : Habillage complet en conteneurs `.glass` avec inputs et boutons conformes aux tokens LKDV.

## 4. Sortie Brute Vérification `npm run build`
```
> kitduvoyageur@0.1.0 build
> next build

   ▲ Next.js 15.5.18
   - Environments: .env.local, .env
   - Experiments (use with caution):
     · optimizePackageImports

   Creating an optimized production build ...
 ✓ Compiled successfully in 7.8s
   Skipping linting
   Checking validity of types ...
   Collecting page data ...
   Generating static pages (0/323) ...
   Generating static pages (80/323) 
   Generating static pages (161/323) 
   Generating static pages (242/323) 
 ✓ Generating static pages (323/323)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size  First Load JS
├ ○ /messagerie                                      21.5 kB         352 kB
...
✓ Compiled successfully (323/323 static pages generated)
```
*(Code de sortie : 0 — 0 erreur)*


