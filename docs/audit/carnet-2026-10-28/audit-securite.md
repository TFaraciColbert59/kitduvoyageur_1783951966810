# Audit sécurité — fiche carnet (`/carnets/[id]`)

Date : 28 octobre 2026 · worktree `/Users/fr168256/Desktop/lkdv-cf-carnet2` · branche `cf/carnet-latest`
Supabase : projet `icxyvwzfjbflcbqukpfz` · Next.js 15 / React 19
Nature : **audit en lecture seule + correctifs locaux sans risque**. Aucune migration, aucune policy,
aucun GRANT, aucune variable d'environnement, aucun déploiement, aucun merge.

Périmètre inspecté : `src/app/carnets/[id]/**`, `src/features/carnet/**`, `src/components/carnet/**`,
plus les points de contact directs de la fiche (`next.config.mjs`, `csp.config.mjs`,
`src/app/api/carnet/identify-species/route.ts`, `src/components/social/ReportSheet.tsx`).

Méthode : en-têtes capturés sur un serveur local réel (`next dev -p 4311`, arrêté après mesure),
lecture des données réelles via PostgREST à la clé anon, introspection `pg_policies` / `pg_proc` /
`information_schema`, rendu serveur d'une fiche publique réelle
(`749e9e8c-9540-5a73-8b6c-6ab07264f62f`).

---

## 1. En-têtes de sécurité réellement envoyés

Mesuré sur `/carnets/749e9e8c-9540-5a73-8b6c-6ab07264f62f` (et `/carnets/<id inexistant>`) :

| En-tête | Valeur observée | Verdict |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | présent |
| `X-Content-Type-Options` | `nosniff` | présent |
| `X-Frame-Options` | `DENY` | présent (doublon utile de `frame-ancestors`, absent de la CSP) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | présent |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self), interest-cohort=()` | présent |
| `Content-Security-Policy-Report-Only` | politique de `csp.config.mjs` | **non appliquée** (voir écarts) |
| `Cache-Control` | `no-store, must-revalidate` | présent, mais **la règle `private, no-store` de `next.config.mjs` n'atteint pas la réponse** |
| `X-Powered-By` | `Next.js` | **non retiré** (divulgation de pile) |

### Écarts d'en-têtes

1. **CSP en Report-Only, jamais appliquée** en local et par défaut
   (`CSP_MODE` absent → `Content-Security-Policy-Report-Only`). Rien n'est bloqué aujourd'hui.
   Décision produit documentée, mais l'effet réel est : aucune protection XSS en profondeur.
2. **`script-src` contient `'unsafe-inline'` ET `'unsafe-eval'`.** Toute injection HTML devient
   exécution de script. C'est précisément ce que le JSON-LD inline empêche de retirer sans nonce.
3. **Directives absentes de la CSP** : `frame-ancestors`, `object-src 'none'`, `base-uri 'self'`,
   `form-action 'self'`. (`X-Frame-Options: DENY` couvre le clickjacking, pas les trois autres.)
4. **`img-src 'self' data: blob: https:`** — le joker `https:` autorise **tout** hôte d'image,
   ce qui annule la liste blanche `images.remotePatterns` pour les `<img>` de la fiche.
5. **`Cache-Control`** : la double ceinture `private, no-store` de `/carnets/:path*` est écrasée par
   le renderer dynamique (`no-store, must-revalidate`). Le résultat reste non-cacheable, mais
   `private` n'est pas envoyé : un cache partagé mal configuré n'a pas l'interdiction explicite.
6. **`X-Powered-By`** non désactivé.
7. Absents (faible) : `Cross-Origin-Opener-Policy`, `X-Permitted-Cross-Domain-Policies`,
   `Cross-Origin-Resource-Policy`.

---

## 2. Secrets et frontière client / serveur

- **`getCarnetDetail` porte `import 'server-only'`** (ligne 1) : aucune chance d'import navigateur.
  C'est bien lui qui lit `carnets`, `carnet_moments`, `carnet_kit_items`, `carnet_likes`,
  `carnet_comments` (compteurs), `carnet_collaborators`, `hike_sessions`,
  `hike_session_participants`, `public_profiles`.
- **Aucun `process.env` dans `src/components/carnet/**` ni `src/features/carnet/**`.**
- **Aucun `SERVICE_ROLE` / `SUPABASE_SERVICE*` / clé privée** dans un fichier `'use client'`
  (balayage des 31 fichiers clients du périmètre + balayage global `src/`).
- **Chunks client** : la chaîne `service_role` apparaît dans
  `.next/static/chunks/app/carnets/[id]/page.js` **uniquement dans les commentaires JSDoc de
  `@supabase/supabase-js`** (`"Never expose your service_role key in the browser"`), jamais une
  valeur. Aucun `sk_live_…` réel, aucune `BEGIN … PRIVATE KEY`. En build de production ces
  commentaires sont retirés par la minification.
- **La fiche n'est pas la seule à lire les données** : le navigateur lit et écrit aussi en direct,
  à la clé anon, sous RLS — `useCarnetComments` (`carnet_comments`), `useCarnetEngagement`
  (`carnet_likes`, `carnet_favorites`, `carnet_views`), `CarnetManagePane` (`carnets` update /
  delete), `CarnetScreen` (`comment_reports` insert). Ces accès sont couverts par les policies
  vérifiées au §3.

---

## 3. RLS, `security definer`, `EXECUTE`

RLS **activée** sur les 10 tables du périmètre. Policies vérifiées une par une :

| Table | Policies (SELECT public) | Lecture anonyme réelle |
| --- | --- | --- |
| `carnets` | `Public read carnets`, `carnets_auth_read` : `visibility='public' OR author_id=uid` | 82 lignes vues, **0 ligne non publique** (`Content-Range: */0` sur `visibility=neq.public`) |
| `carnet_moments` | `carnet_moments_read_scoped` (même règle via `carnets`) | OK |
| `carnet_comments` | `carnet_comments_read_scoped` | OK |
| `carnet_likes` | `carnet_likes_read_scoped` | OK |
| `carnet_collaborators` | `carnet_collaborators_read_scoped` (public + soi) | OK |
| `carnet_kit_items` | `carnet_kit_items_read_scoped` | OK |
| `carnet_favorites` | `carnet_favorites_read_scoped` | OK |
| `hike_sessions` | `hike_sessions_select_owner_or_public_carnet` | OK |
| `hike_session_participants` | `hike_participants_select` → `can_view_hike_session(session_id)` | **ERREUR 42501** (voir ci-dessous) |
| `comment_reports` | `comment_reports_select_own_or_moderator` | `[]` pour anon (aucune fuite de signalement) |

Écritures : toutes les policies d'écriture sont liées à `auth.uid()` (`author_id`/`user_id`) ou au
rôle. `essai_sans_ecriture_publique` (`NOT is_anonymous_session()`) protège en plus l'insertion
depuis une session anonyme.

### Écarts RLS

1. **`can_view_hike_session` n'est pas exécutable par `anon`** —
   `has_function_privilege('anon', …, 'EXECUTE') = false`, confirmé en conditions réelles :
   `GET /rest/v1/hike_session_participants` à la clé anon →
   `{"code":"42501","message":"permission denied for function can_view_hike_session"}`.
   Conséquence : **tout visiteur non connecté voit une fiche publique sans aucun participant issu
   des sorties** (la policy `hike_participants_select` s'évalue pour le rôle `public`, la fonction
   refuse, PostgREST renvoie une erreur, `getCarnetDetail` la traduit en `data: null` → `[]`).
   La fonction est `SECURITY DEFINER` avec `search_path=public, pg_temp` : elle est correctement
   écrite, il ne manque que le `GRANT EXECUTE … TO anon` (ou un `GRANT` au rôle `public`).
   **Décision utilisateur requise** (GRANT).
2. **`carnet_views` : `INSERT` public avec `with_check = true`.**
   N'importe qui, anonyme compris, peut insérer des lignes arbitraires pour n'importe quel
   `carnet_id` → **inflation du compteur de vues** (trigger `sync_carnet_views_count`).
   Politique assumée historiquement (« accepte l'insertion publique »), mais non bornée :
   aucun dédoublonnage par utilisateur ni par journée. **Décision utilisateur requise** (policy).
3. **Défense en profondeur** : `anon` possède `SELECT, INSERT, UPDATE, DELETE` au niveau **GRANT**
   sur `carnets`, `carnet_moments`, `carnet_comments`, `carnet_likes`, `carnet_collaborators`,
   `carnet_kit_items`, `carnet_favorites`, `hike_sessions`, `hike_session_participants`,
   `comment_reports`. RLS est la seule barrière : une policy oubliée sur une future table, ou une
   policy permissive ajoutée par erreur, ouvre l'écriture au monde. Rien à corriger dans cette
   mission (interdiction de toucher aux GRANT), à traiter comme dette.
4. **`public_profiles` est une vue** (pas de RLS, normal pour une vue) sur `user_profiles`, filtrée
   par `profile_visibility` et `auth.uid()`. Elle **n'expose pas d'email**. Elle expose en revanche
   `location`, `website`, `links`, `loyalty_points`, `xp`, `level` à `anon` (vérifié :
   `GET /rest/v1/public_profiles?select=handle,location,website,loyalty_points,xp,level` → 200).
   Écart faible : la fiche ne demande que `id, full_name, handle, avatar_url, trust_score`, mais la
   vue est plus large que nécessaire.
5. `user_profiles` : `profile_select_public_subset` (anon, `qual = false`) → aucun email lisible
   par anon (`GET /rest/v1/user_profiles?select=id,email` → `[]`).
6. `carnets.visibility` **n'a aucune contrainte `CHECK`** (aucun `contype='c'` sur la table). Une
   valeur arbitraire n'ouvre rien (les policies testent `= 'public'`), mais la donnée n'est pas
   bornée. `carnet_comments.content`, `carnets.title/description`, `carnet_moments.citation` sont
   des `text` **sans longueur maximale** en base.

---

## 4. Entrées et injections

| Point | Constat |
| --- | --- |
| `serializeJsonLd` | **Complet** : échappe `<` → `\u003c`, `>` → `\u003e`, `&` → `\u0026`, U+2028, U+2029. Vérifié sur le rendu réel : `https://images.unsplash.com/…&w=1600` sort en `\u0026`. Rien à corriger. |
| `dangerouslySetInnerHTML` | **Un seul site** dans le périmètre : le `<script type="application/ld+json">` de `page.tsx`, alimenté par `serializeJsonLd` uniquement. |
| Échappement React | Tous les autres contenus (titre, description, moments, commentaires, kit) passent par des nœuds texte. Aucun `innerHTML`. |
| Longueur des champs libres | **Composer de commentaire sans `maxLength`** (corrigé, voir §6). `ReportSheet` (`social/`, partagé) : `textarea` de précisions **sans `maxLength`**, concaténée dans `comment_reports.reason` → non borné, **non corrigé** (composant hors périmètre carnet). Colonnes `text` sans `CHECK` côté base. |
| URL d'image | `cover_image`, `carnet_moments.image_url` sont rendues telles quelles dans des `<img src>` (aucun `next/image`, donc **aucune validation d'hôte**) : une URL arbitraire est chargée, ce qui permet un pixel de suivi (IP + Referer tronqué) depuis la fiche. Pas d'exécution de script (`javascript:` est inerte en `img`). |
| `stripImageMetadata` | **Non appelé dans le périmètre carnet** : la fiche ne fait aucun upload. `CarnetNaturePane` envoie une photo à `/api/carnet/identify-species`, qui la transmet en base64 au modèle et **ne la stocke pas**. Le nettoyage EXIF est bien en place sur les chemins qui stockent (`CreateDrawer`, `CommunityStoriesBar`, `StoryCreateForm`, `ConversationView`). |
| `/api/carnet/identify-species` | Authentification obligatoire (401 sinon), rate limit 10/min fail-closed, erreur 500 générique (`'Erreur inattendue'`), détail en `console.error`. **Manquent** : taille maximale du `imageBase64` et liste blanche de `mimeType` (interpolé dans un data-URL). |
| Injections SQL | Aucune concaténation : tout passe par `supabase-js` (paramétré). Pas de `ilike` dans la fiche. |
| Redirections | Aucune redirection pilotée par l'entrée dans la fiche. |

---

## 5. Données personnelles

- **Aucun email** dans le HTML rendu d'une fiche publique (balayage `@` du corps : zéro) ni dans
  le JSON-LD (`Person` = `name` + `alternateName` = handle public).
- **Aucune coordonnée exacte dans le JSON-LD** et aucune clé `lat`/`lng` dans le HTML statique.
  En revanche la trace (`hike_sessions.positions_geojson`) **est** envoyée au client dans le
  payload RSC : c'est la donnée affichée par la carte 3D, elle est donc publique par conception
  pour un carnet public. `place.lat/lng` = premier point de la trace, même donnée. Pas de
  coordonnées de domicile, pas de point de départ hors trace.
- `public_profiles` n'expose ni email ni téléphone. `comment_reports` n'est lisible que par son
  auteur, un modérateur ou un admin (anon : `[]`).
- Journaux : `console.error('[carnet/comments] lecture refusée:', queryError)` ne contient que le
  message PostgREST, pas de donnée personnelle.

---

## 6. Constats

### Critique

Aucun. Rien trouvé qui permette de lire, modifier ou supprimer les données d'un autre utilisateur :
la RLS tient sur les 10 tables, la lecture anonyme d'un carnet privé renvoie 0 ligne, et aucun
secret n'atteint le navigateur.

### Moyen

| # | Constat | Emplacement | Preuve |
| --- | --- | --- | --- |
| M1 | `anon` n'a pas `EXECUTE` sur `can_view_hike_session` → participants des sorties **invisibles aux visiteurs non connectés** (erreur 42501 silencieuse) | policy `hike_participants_select` + GRANT fonction | `GET /rest/v1/hike_session_participants` anon → `42501 permission denied for function can_view_hike_session` |
| M2 | CSP en Report-Only **et** `'unsafe-inline'` + `'unsafe-eval'` dans `script-src` → aucune protection XSS en profondeur | `csp.config.mjs`, `next.config.mjs` | en-tête `Content-Security-Policy-Report-Only` sur `/carnets/[id]` |
| M3 | `carnet_views` : `INSERT` public `with_check = true` → compteur de vues gonflable par n'importe qui | policy `public_insert_carnet_views` | `pg_policies` |
| M4 | `anon` a les GRANT `INSERT/UPDATE/DELETE` sur toutes les tables carnet ; RLS seule barrière | `has_table_privilege('anon', …)` | introspection |
| M5 | 404 logique servi en **HTTP 200** pour un carnet inexistant / privé (soft-404 indexable) | `page.tsx` (`notFound()` en `generateMetadata`) | `curl /carnets/00000000-…-000000000000` → `200`, corps `not-found` ; une route inconnue rend bien `404` |
| M6 | `imageBase64` non borné et `mimeType` non validé sur l'identification d'espèce | `api/carnet/identify-species/route.ts` | lecture |
| M7 | Composer de commentaire **sans** `maxLength` alors que `carnet_comments.content` est un `text` non borné | `CarnetCommentsPane.tsx` | **corrigé** |

### Faible

| # | Constat | Emplacement |
| --- | --- | --- |
| F1 | `Cache-Control` : `private` absent (règle `private, no-store` écrasée par le rendu dynamique) | `next.config.mjs` |
| F2 | `X-Powered-By: Next.js` non retiré | `next.config.mjs` |
| F3 | `img-src https:` (joker) annule la liste blanche d'hôtes d'image | `csp.config.mjs` |
| F4 | Directives CSP absentes : `frame-ancestors`, `object-src`, `base-uri`, `form-action` | `csp.config.mjs` |
| F5 | Aucune contrainte `CHECK` sur `carnets.visibility` ni longueur maximale sur les `text` | base |
| F6 | `public_profiles` expose `location/website/links/loyalty_points/xp/level` à anon | vue |
| F7 | `ReportSheet` : `textarea` de précisions sans `maxLength` (composant partagé) | `components/social/ReportSheet.tsx` |
| F8 | `<img src>` avec URL arbitraire (pixel de suivi possible), aucun hôte validé | `CarnetMediaViewer`, `CarnetPages`, `CarnetPostSheet` |
| F9 | `getCarnetDetail` exécute **deux fois** le même `count` sur `carnet_likes` (3e promesse ignorée) | `getCarnetDetail.ts:125-136` |
| F10 | `groupe_etapes` / `groupe_hebergements` **n'existent pas** : deux requêtes échouent en silence pour le carnet qui porte un `groupe_id` (1/82) | `getCarnetDetail.ts:96-111` |
| F11 | `CarnetScreen.tsx.bak` traîné dans `src/` (ignore par git, jamais compilé) | `components/carnet/profile/` |
| F12 | Le message PostgREST brut était stocké dans l'état du hook de commentaires (`error`) | **corrigé** |
| F13 | Littéral `'sk_live_••••••••…'` dans un composant `'use client'` — valeur masquée factice, pas un secret, mais déclenche les scanners | `src/app/admin/page.tsx:808` (hors périmètre carnet) |

---

## 7. Correctifs appliqués (locaux, sans risque)

1. **Échappement JSON-LD** : `serializeJsonLd` était **déjà complet** — aucun changement de code,
   trois tests ajoutés pour verrouiller les cas `&`, U+2028/U+2029 et un payload complet contenant
   `</script><svg onload=…>` (`jsonld.test.ts`).
2. **`maxLength` sur le champ libre de la fiche** : `CARNET_COMMENT_MAX_LENGTH = 500` exporté et
   posé sur le composer de commentaire — même plafond que la réponse privée d'une story, aucune
   modification du chemin d'envoi (`CarnetCommentsPane.tsx`).
3. **Erreur générique côté client** : `useCarnetComments` expose `COMMENTS_READ_ERROR`
   (« Les commentaires n'ont pas pu être chargés. ») et pousse le message technique en
   `console.error` (`useCarnetComments.ts`). L'état `error` n'était rendu nulle part : aucun pixel
   ne change.
4. **`rel="noopener noreferrer"`** : déjà présent sur les liens sortants de la fiche
   (`CarnetField`, unique `target="_blank"` du périmètre). Aucun changement, un test le verrouille.

### Tests ajoutés

- `src/components/carnet/profile/__tests__/CarnetSecurite.test.tsx` (3 tests) : `rel` + `target`
  sur un lien sortant, absence de `target` sur un champ bouton, `maxLength` réel du composer.
- `src/features/carnet/detail/__tests__/jsonld.test.ts` (+2 tests).
- `src/features/carnet/detail/__tests__/useCarnetComments.test.tsx` (+1 test : refus de lecture →
  message générique, détail en console).

### Vérification

- `npx vitest run src/components/carnet src/features/carnet` → **25 fichiers, 264 tests verts**
  (258 avant, +6).
- `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit` → **0 erreur**.

---

## 8. Ce qui exige une décision de l'utilisateur

| Décision | Objet | Effet |
| --- | --- | --- |
| **GRANT** | `grant execute on function public.can_view_hike_session(uuid) to anon;` | corrige M1 : les visiteurs non connectés voient enfin les participants réels des sorties |
| **Policy** | borner `public_insert_carnet_views` (dédoublonnage par `user_id`/jour, ou insertion via RPC `security definer`) | corrige M3 (inflation des vues) |
| **Policy / GRANT** | resserrer les GRANT `anon` d'écriture (M4) | défense en profondeur ; risque de régression à évaluer écran par écran |
| **En-têtes serveur** | passer `CSP_MODE=enforce` après retrait de `'unsafe-inline'`/`'unsafe-eval'` (nonce sur le JSON-LD), ajouter `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, retirer `X-Powered-By`, restreindre `img-src` | corrige M2, F2, F3, F4 |
| **En-têtes serveur** | vérifier l'écrasement de `private, no-store` sur `/carnets/:path*` en build de prod | corrige F1 |
| **Migration** | `CHECK` sur `carnets.visibility`, longueur maximale sur `carnet_comments.content` / `carnets.title` / `description` | corrige F5 |
| **Hors périmètre carnet** | `maxLength` sur le `textarea` de `ReportSheet`, validation d'hôte sur les `<img>` de la fiche (F7, F8) | à arbitrer avec les écrans Communté / Compte |
| **Routing** | statut 404 réel pour un carnet absent ou privé (M5), à confirmer en build de production | SEO / indexation |

## 9. Preuves exécutées (reproductibles)

```bash
# en-têtes réels de la fiche
npx next dev -p 4311 &
curl -s -D - -o /dev/null http://127.0.0.1:4311/carnets/749e9e8c-9540-5a73-8b6c-6ab07264f62f

# participants : refus RLS pour anon
curl -s "$SUPABASE_URL/rest/v1/hike_session_participants?select=session_id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# → {"code":"42501","message":"permission denied for function can_view_hike_session"}

# portée réelle de la lecture anonyme des carnets
curl -sI "$SUPABASE_URL/rest/v1/carnets?select=id&visibility=neq.public" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | grep -i content-range
# → Content-Range: */0
```
