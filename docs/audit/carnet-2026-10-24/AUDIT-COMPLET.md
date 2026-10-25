# AUDIT COMPLET — FICHE CARNET `/carnets/[id]`

**Version :** 1.0 — 24 octobre 2026
**Repo :** `/Users/fr168256/Desktop/lkdv-communaute-feed`
**Branche :** `chantier/post-system` (worktree)
**Serveur audité :** `http://127.0.0.1:4015` (dev) et `http://127.0.0.1:4014` (build production `.next-post-build`)
**Base :** projet Supabase `icxyvwzfjbflcbqukpfz` (`lekitduvoyageur2`), PostgreSQL 17
**Référence de style :** `/communaute` refondue
**Statut :** audit terminé, aucune modification de `src/`, `supabase/`, `tests/` ou `package.json`.

---

## 1. Méthode, périmètre, limites

### 1.1 Ce qui a été fait

- Lecture intégrale des fichiers de la route, des composants carnet, de la couche de requête, des routes API et des composants partagés (`CommentsSheet`, `NavigationPlateau`, `AppShell`, `Header`).
- Inspection du schéma live : colonnes, contraintes, index, policies RLS, volumétrie, cohérence des compteurs.
- Rendu réel desktop 1440×900, 1024×768, tablette 768×1024, mobile 430×932 ; captures dans `evidence/`.
- Tests live : navigation, onglets, like, commentaires, partage, carte, 404, absence de trace, carnet sans auteur.
- Mesures DOM : largeurs, hauteurs, scroll, cibles tactiles, couleurs calculées, nombre d'images sans alt, headings.
- Mesures réseau : requêtes Supabase, chunks JS, ressources, LCP/CLS/TTFB sur le build production.
- Recoupement avec `DESIGN_SYSTEM.md`, `docs/compas/DESIGN_REFERENCE.md`, `docs/superpowers/specs/2026-10-23-communaute-feed-design.md` et les specs du post system.

### 1.2 Ce qui n'a pas été fait

- Pas de test sur réseau mobile réel (4G/5G), ni de Lighthouse complet sur URL publique.
- Pas de test lecteur d'écran manuel (VoiceOver/TalkBack) ; l'audit a11y est statique + DOM.
- Pas de test de charge, pas de test de pénétration offensif.
- Pas d'écriture en base (pas de like/commentaire/favori créé), sauf lectures.
- Pas de vérification visuelle sous Safari/iOS réel ni Android natif.
- Pas de modification du code : les correctifs sont décrits, pas appliqués.

### 1.3 Limites de preuve

- Les mesures de performance ont été faites en local, sur un serveur de build déjà chaud/froid selon les cas. Elles surestiment probablement le TTFB réseau et sous-estiment la latence CDN réelle. Les **ratios** et les **poids** restent valides.
- Certaines captures `fullPage` contiennent la barre fixe au milieu du document : c'est un artefact de capture, pas un bug de positionnement. Les mesures DOM et les captures viewport font foi.
- La base contient des données de démonstration ; les constats de « fausses données » distinguent ce qui est seedé de ce qui est **fabriqué par le code**.

---

## 2. Inventaire de la page

### 2.1 Route et fichiers

| Fichier | Rôle | Lignes |
|---|---|---:|
| `src/app/carnets/[id]/page.tsx` | Server Component, metadata, JSON-LD, appel données | 154 |
| `src/app/carnets/[id]/loading.tsx` | Skeleton de route | 26 |
| `src/app/carnets/[id]/error.tsx` | Error boundary de route | 33 |
| `src/app/carnets/layout.tsx` | Metadata du segment | 26 |
| `src/lib/queries/carnet.ts` | `getCarnetComplet`, transforms | 277 |
| `src/components/carnet/CarnetView.tsx` | Orchestrateur desktop/mobile | 208 |
| `src/components/carnet/MobileCarnetDetailView.tsx` | Rendu mobile + interactions | 512 |
| `src/components/carnet/CarnetHero.tsx` | Hero desktop, actions | 237 |
| `src/components/carnet/CarnetDetailVerticalTabs.tsx` | Navigation verticale desktop | 100 |
| `src/components/carnet/CarnetDetailRightSidebar.tsx` | Sidebar certification / fiche / CTA | 119 |
| `src/components/carnet/CarnetMap.tsx` | Carte Leaflet | 244 |
| `src/components/carnet/TimelineJours.tsx` | Timeline jours + hébergements | 49 |
| `src/components/carnet/JourCard.tsx` | Carte d'un jour | 44 |
| `src/components/carnet/HebergementCard.tsx` | Carte hébergement | 36 |
| `src/components/carnet/MomentCard.tsx` | Carte moment + lightbox | 127 |
| `src/components/carnet/KitSouvenirCard.tsx` | Kit + checklists | 137 |
| `src/components/carnet/RandonneesSouvenirCard.tsx` | Liste « randonnées » + GPX | 60 |
| `src/components/carnet/StatsBar.tsx` | Barre de stats | 38 |
| `src/components/carnet/SpeciesIdentifier.tsx` | Upload + identification IA | 192 |
| `src/components/social/CommentsSheet.tsx` | Feuille de commentaires | 401 |
| `src/components/carnets/LocalCarnetRenderer.tsx` | Fallback brouillon local | 116 |
| `src/app/api/carnets/[id]/route.ts` | GET public | 41 |
| `src/app/api/carnets/[id]/publish/route.ts` | POST progression | 48 |
| `src/app/api/carnet/identify-species/route.ts` | POST IA vision | 127 |

### 2.2 Arbre de rendu

```
CarnetDetailPage (server)
├─ generateMetadata() .................... 1 requête carnets (server client, cookies)
├─ getCarnetComplet(id) .................. 1 requête carnets (client navigateur, sans cookies)
│  ├─ hike_sessions ...................... 1 requête
│  ├─ public_profiles .................... 1 requête
│  ├─ groupe_etapes ...................... table inexistante
│  ├─ groupe_hebergements ................ table inexistante
│  ├─ carnet_moments ..................... 1 requête
│  └─ carnet_kit_items ................... 1 requête
└─ CarnetView ('use client')
   ├─ Desktop (hidden < md)
   │  ├─ Header
   │  ├─ CarnetDetailVerticalTabs
   │  ├─ CarnetHero
   │  ├─ StatsBar
   │  ├─ CarnetMap + TimelineJours
   │  ├─ MomentCard[]
   │  ├─ KitSouvenirCard + RandonneesSouvenirCard
   │  ├─ SpeciesIdentifier
   │  └─ CarnetDetailRightSidebar
   └─ Mobile (md:hidden)
      ├─ AppShell
      └─ MobileCarnetDetailView
         ├─ Hero cover + author + actions
         ├─ Stats 4 cases
         ├─ Cartes overview / map / moments / kit / nature
         └─ CommentsSheet
```

### 2.3 Flux de données

1. `generateMetadata` interroge `carnets` avec le **client serveur** (cookies de session).
2. `CarnetDetailPage` appelle `getCarnetComplet` qui utilise le **client navigateur** (`@/lib/supabase/client`) même côté serveur.
3. Le résultat est transformé en `CarnetData` (type importé depuis `@/lib/mock/carnet-chartreuse`) puis sérialisé vers le client.
4. `CarnetView` choisit l'arbre desktop ou mobile via CSS (`hidden md:block` / `md:hidden`), pas via un rendu conditionnel serveur.
5. Les interactions sont locales ou directes Supabase, sans API dédiée pour les likes/commentaires.

### 2.4 Tables réellement disponibles

| Table | Lignes | Utilisée par la fiche ? |
|---|---:|---|
| `carnets` | 82 | Oui |
| `carnet_moments` | 228 | Oui (mais images ignorées) |
| `carnet_kit_items` | 223 | Oui |
| `carnet_favorites` | 178 | Oui (desktop uniquement) |
| `hike_sessions` | — | Oui |
| `public_profiles` (vue) | 237 | Oui |
| `carnet_comments` | 130 | **Non** |
| `carnet_likes` | 596 | **Non** |
| `carnet_views` | 2 320 | **Non** |
| `carnet_media` | 258 | **Non** |
| `carnet_gear_links` | — | **Non** |
| `carnet_collaborators` | — | **Non** |
| `groupe_etapes` | **absente** | Oui (échoue silencieusement) |
| `groupe_hebergements` | **absente** | Oui (échoue silencieusement) |

### 2.5 Captures

| Fichier | Contenu |
|---|---|
| `evidence/carnet-1440.png` | Desktop 1440, cookies acceptés, thème sombre |
| `evidence/carnet-1440-light.png` | Desktop 1440, `prefers-color-scheme: light` — rendu identique, encre blanche |
| `evidence/carnet-768.png` | Tablette 768 : centre écrasé à 152 px |
| `evidence/carnet-430.png` | Mobile 430, page complète |
| `evidence/carnet-430-map.png` | Mobile, onglet Carte & GPX, barres superposées |
| `evidence/carnet-430-comments.png` | Mobile, feuille de commentaires, champ blanc sur blanc |
| `evidence/carnet-chartreuse-430.png` | Carnet sans auteur : « Antoine Duprès », stats inventées |
| `evidence/carnet-404.png` | 404 soft, `NavigationPlateau` encore visible |
| `evidence/communaute-430.png` | Référence feed Communauté |
| `evidence/communaute-1440.png` | Référence desktop : colonne 520 centrée |

---

## 3. Architecture et rendu

### ARCH-001 — Le layout desktop casse à 768 px — **P0**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `src/components/carnet/CarnetView.tsx:78-79` active le desktop dès `md` (768 px). `src/components/carnet/CarnetView.tsx:80-92` fixe 230 px + 300 px de sidebars. Mesure live à 768 px : centre = **152 px** de large. Capture `evidence/carnet-768.png`.
- **Constat :** le titre s'écrit un mot par ligne, les paragraphes sont coupés, la sidebar droite recouvre visuellement le centre. Le layout n'a pas de breakpoint intermédiaire ni de repli des sidebars.
- **Impact :** toute tablette en portrait et les petits laptops (768–1100 px) sont inutilisables. C'est le défaut visuel le plus grave.
- **Correctif attendu :** supprimer les sidebars fixes dans la refonte ; passer à une colonne 520–640 px. Si un layout 3 colonnes est conservé, masked breakpoint ≥ 1200 px et sidebars `collapsible`.

### ARCH-002 — Deux arbres de rendu complets, tous deux dans le bundle — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:78` (`hidden md:block`), `CarnetView.tsx:190` (`md:hidden`), imports statiques de `MobileCarnetDetailView` et de tous les composants desktop en tête de fichier.
- **Constat :** les deux arbres sont montés dans le DOM (l'un caché en CSS), les deux jeux de composants et de hooks sont chargés, et les états sont dupliqués.
- **Impact :** bundle inutile, double logique, comportements divergents (like/save/share), maintenance deux fois plus coûteuse.
- **Correctif attendu :** un seul arbre responsive, ou un choix serveur via `user-agent`/CSS container queries avec composants partagés. Les actions doivent être des primitives communes.

### ARCH-003 — La fiche privée ne s'affiche pas pour son propriétaire — **P0**

- **Statut :** `[VÉRIFIÉ par le code, non testé en live faute de carnet privé]`
- **Preuve :** `src/lib/queries/carnet.ts:1` importe `createClient` de `@/lib/supabase/client`. Ce module utilise `createBrowserClient` et, côté serveur, `canUseCookies()` retourne `false`, `fromCookies()` retourne `[]` (`src/lib/supabase/client.ts`). `getCarnetComplet` est appelé dans un Server Component (`src/app/carnets/[id]/page.tsx:87`).
- **Constat :** la requête de la page s'exécute avec la clé anon **sans session**. La policy `Public read carnets` (`visibility='public' OR author_id=auth.uid()`) ne peut pas reconnaître le propriétaire. Un carnet `private` renvoie `null`.
- **Impact :** un propriétaire qui ouvre son propre carnet privé voit « Carnet introuvable » ou un brouillon local. La metadata, elle, peut être correcte car `generateMetadata` utilise le client serveur avec cookies — incohérence visible.
- **Correctif attendu :** utiliser `@/lib/supabase/server` dans `getCarnetComplet` (ou passer un client en paramètre), et un seul client cohérent pour metadata + page. Test de non-régression : propriétaire privé, visiteur anonyme, autre utilisateur.

### ARCH-004 — Scroll desktop inaccessible au clavier — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:79` (`h-[100dvh] overflow-hidden`), `CarnetView.tsx:95` (`overflow-y-auto`), aucun `tabIndex`. Test live : focus sur `BODY`, `PageDown` → `scrollTop` du conteneur = **0**, `scrollY` = 0. Le document ne scrolle pas non plus (`doc.scrollHeight = 900`).
- **Constat :** la seule zone scrollable n'est pas focusable. Un utilisateur clavier qui ne tabbe pas dans un bouton du centre ne peut pas faire défiler le récit.
- **Impact :** contenu inaccessible au clavier et à certains lecteurs d'écran ; critère WCAG 2.1.1.
- **Correctif attendu :** scroll document (recommandé) ou `tabIndex={0}` + `role="region"` + `aria-label` sur le conteneur, et test `PageDown`.

### ARCH-005 — Le layout est partagé avec `/clubs/[id]` — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `src/styles/community-social.css:733-754` définit `.lkdv-social-detail-desktop` / `.lkdv-social-detail-mobile` ; `src/app/clubs/[id]/page.tsx` utilise les mêmes classes ; `CarnetView.tsx:79,191` aussi.
- **Constat :** toute refonte du shell carnet either duplique la CSS ou modifie aussi les clubs. La CSS commente elle-même « carnet and club keep every LKDV terrain component ».
- **Impact :** couplage fort, risque de régression sur les clubs.
- **Correctif attendu :** créer un `CarnetSocialShell` dédié, ou migrer les deux pages dans un shell commun explicitement testé.

### ARCH-006 — Le fallback local transforme un 404 en brouillon — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:87-90` : si `getCarnetComplet` retourne `null`, rend `LocalCarnetRenderer`. Celui-ci lit `localStorage.user_carnets_data` (`LocalCarnetRenderer.tsx:22`) et cherche par `id` ou `title` (`:24`). Si trouvé, il rend `CarnetView` avec un bandeau « brouillon local » (`:103`). Sinon, il rend « Carnet introuvable » (`:87`). Aucun `notFound()`.
- **Constat :** un id inconnu renvoie HTTP 200, peut afficher un brouillon local, et n'a pas de statut 404 réel. La metadata est « Carnet introuvable » avec `noindex`.
- **Impact :** SEO (soft 404), UX (état ambigu), confidentialité locale (un brouillon privé peut apparaître sur une URL publique dans le même navigateur).
- **Correctif attendu :** `notFound()` quand l'id n'existe pas ; réserver le rendu local à une route dédiée (`/carnets/brouillon/[id]`) ou à un état explicite hors URL publique.

### ARCH-007 — Toutes les erreurs Supabase sont avalées — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:273-275` : `catch (err) { console.error(...); return null; }`. `page.tsx:87-90` transforme `null` en fallback local / introuvable. `src/app/carnets/[id]/error.tsx` existe mais ne reçoit jamais l'erreur.
- **Constat :** une panne réseau, une erreur RLS ou une table manquante sont indistinguables d'un carnet inexistant. L'utilisateur voit un faux 404 ; l'équipe ne voit qu'un `console.error` navigateur.
- **Impact :** diagnostic impossible, error boundary inutile, confiance produit dégradée.
- **Correctif attendu :** distinguer `notFound` (absence) d'une erreur (throw), remonter à `error.tsx`, logger côté serveur avec un identifiant de requête, et afficher un état « réessayer ».

### ARCH-008 — La metadata interroge la base deux fois — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:20-27` (SELECT carnet dans `generateMetadata`) puis `page.tsx:87` → `carnet.ts:19-21` (deuxième SELECT `*`). `dynamic = 'force-dynamic'` (`page.tsx:154`).
- **Constat :** deux allers-retours pour la même ligne, plus 5 requêtes liées, à chaque requête. TTFB production local mesuré ~2,1–2,6 s.
- **Impact :** latence et charge DB inutiles ; pas de cache.
- **Correctif attendu :** une seule lecture partagée (React `cache()` ou fonction serveur unique), séparer metadata statique et engagement dynamique, envisager ISR/revalidate pour les carnets publics.

### ARCH-009 — Les onglets ne sont pas dans l'URL — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:45` (`useState('overview')`) ; `MobileCarnetDetailView.tsx:68` (`useState<...>('overview')`) ; événement `carnet-detail-tab-change` (`:83`) émis par `useNavigationPlateau.ts:182-186`.
- **Constat :** refresh, back, partage et deep link retombent toujours sur « Récit ». Aucun `?tab=` ni ancre.
- **Impact :** impossible de partager « la carte » ou « le matériel » ; le bouton retour du navigateur quitte la page au lieu de revenir à l'onglet précédent.
- **Correctif attendu :** onglet dans l'URL (`?section=map`) ou ancres (`#parcours`, `#moments`), avec `scrollIntoView` et restauration au refresh.

### ARCH-010 — Double navigation mobile : 102 px de barres empilées — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `NavigationPlateau.tsx:43-50` ajoute 5 onglets carnet ; `AppShell.tsx:85-115` réserve `bottomNavHeight` ; live : `nav[aria-label="Navigation principale"]` = 102 px de haut (plateau 40 px + barre 60 px), `bottomNavHeightToken` inclut `hasUpperExtension`.
- **Constat :** la page carnet est la seule (avec clubs/pays) à empiler un plateau de section au-dessus de la barre basse. La Communauté n'a qu'une barre de 48 px. Sur 932 px de haut, 102 px = 11 % de l'écran.
- **Impact :** contenu masqué, sensation d'application dans l'application, divergence avec la référence.
- **Correctif attendu :** supprimer le plateau sur la fiche carnet et utiliser des onglets internes discrets ou des ancres ; garder la barre basse Communauté/Compte.

### ARCH-011 — `is_public` est du code mort — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:20-21` sélectionne `id,title,description,destination,cover_image,visibility,created_at` ; `page.tsx:43` teste `(carnet as any).is_public`, jamais sélectionné. La colonne n'existe pas dans `carnets`.
- **Constat :** le cast `as any` masque l'absence de colonne. Le comportement repose uniquement sur `visibility`.
- **Impact :** dette de typage, faux sentiment de support d'un champ inexistant.
- **Correctif attendu :** supprimer `is_public`, typer la sélection, centraliser la règle de visibilité.

### ARCH-012 — Le type de page dépend encore du mock — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:19` importe `CarnetData` depuis `@/lib/mock/carnet-chartreuse` ; de même `MobileCarnetDetailView.tsx:14`, `MomentCard.tsx:8`, `KitSouvenirCard.tsx:7`, `RandonneesSouvenirCard.tsx:4`, `TimelineJours.tsx:4`. Le type est réexporté depuis `@/types/carnet`, mais les composants importent le mock.
- **Constat :** le type de production est couplé à un fichier de fixture ; le nom « mock » suggère que la page peut encore en dépendre.
- **Impact :** confusion, imports fragiles, difficulté à supprimer les fixtures.
- **Correctif attendu :** importer `CarnetData` depuis `@/types/carnet` partout ; déplacer le fixture dans `tests/fixtures`.

### ARCH-013 — Le `cover_image` n'entre jamais dans `CarnetData` — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** le SELECT `carnets` ramène `cover_image` (`carnet.ts:19-20`), mais l'objet `meta` retourné (`carnet.ts:234-251`) ne contient pas de champ cover. `MobileCarnetDetailView.tsx:88-90` lit `metaAny.coverImage` (jamais fourni) et retombe sur Unsplash. Le desktop n'utilise que le fond global.
- **Constat :** la couverture réelle du carnet est perdue à l'entrée du modèle. Toutes les cartes mobiles utilisent la même photo générique.
- **Impact :** identité visuelle fausse, données inutilisées, confusion avec les autres carnets.
- **Correctif attendu :** ajouter `coverImage`, `coverImageAlt` à `CarnetData.meta`, les afficher, et prévoir un fallback neutre (dégradé de marque) plutôt qu'une photo tierce.

### ARCH-014 — `loading.tsx` ne correspond plus à la page — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `loading.tsx` utilise `min-h-screen`, `max-w-7xl`, un skeleton de hero large et 6 stats (`:6-21`), alors que la page est une coquille 3 colonnes / mobile feed avec header sticky.
- **Constat :** le skeleton est un ancien layout, il provoque un saut visuel à l'arrivée des données.
- **Impact :** perception de lenteur, CLS visuel.
- **Correctif attendu :** skeleton calqué sur la nouvelle coquille (header, cover, cartes), avec les mêmes largeurs et rayons.

### ARCH-015 — `notFound()` n'est jamais utilisé — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:87-90` ; aucun `notFound()` dans le fichier ; `curl` sur un id inconnu retourne **200**.
- **Constat :** soft 404 systématique.
- **Impact :** SEO, analytics, UX.
- **Correctif attendu :** `notFound()` pour absence réelle ; `error.tsx` pour panne ; brouillon local sur route dédiée.

---

## 4. Données, base, RLS

### 4.1 Schéma utile

**`carnets`** (colonnes vérifiées en live) : `id`, `author_id`, `title`, `destination`, `description`, `cover_image`, `cover_image_alt`, `start_date`, `end_date`, `weather`, `route_rating`, `visibility`, `tags`, `likes_count`, `comments_count`, `views_count`, `verified`, `created_at`, `updated_at`, `map_points`, `is_collaborative`, `favorites_count`, `groupe_id`, `distance_km`, `denivele_m`, `nb_nuits`, `nb_voyageurs`, `lieu_depart`, `lieu_arrivee`, `country_iso`, `trip_id`, `correlation_id`.

Il n'y a **pas** de colonnes `is_public`, `kit_intro`, `equipment_summary`, `duration`. Le code les lit pourtant (`carnet.ts:147,212,224`), ce qui produit `undefined` — donc des fallbacks silencieux, pas des erreurs.

**`carnet_moments`** : `id`, `carnet_id`, `jour_numero`, `heure`, `citation`, `auteur_nom`, `auteur_id`, `lieu`, `image_url`, `created_at`, `moment_timestamp`, `source` (check `manuel|auto`), `hike_session_id`, `identified_species` (jsonb).

**`carnet_kit_items`** : `id`, `carnet_id`, `nom`, `detail`, `poids_g`, `couleur_tag`, `sort_order`.

**`carnet_favorites`** : `id`, `carnet_id`, `user_id`, `created_at`, unique `(carnet_id,user_id)`.

**`carnet_comments`** : `id`, `carnet_id`, `author_id`, `content`, `created_at` — **pas** de `parent_id`, pas de likes, pas d'`updated_at`.

**`carnet_likes`** : `id`, `carnet_id`, `user_id`, `reaction` (text, défaut `'useful'`), `created_at`, unique `(carnet_id,user_id)`.

**`carnet_views`** : `id`, `carnet_id`, `user_id`, `ip_address`, `created_at`.

**`carnet_media`** : `id`, `carnet_id`, `url`, `type`, `caption`, `position`, `created_at`.

**`carnet_gear_links`**, **`carnet_collaborators`** existent aussi.

### 4.2 RLS — ce qui protège correctement

| Table | SELECT | Écriture |
|---|---|---|
| `carnets` | `visibility='public' OR author_id=auth.uid()` (2 policies) | owner manage ; insert/update/delete owner ; `essai_sans_ecriture_publique` restrictif |
| `carnet_moments` | carnet public ou owner | `auteur_id=auth.uid()` |
| `carnet_kit_items` | carnet public ou owner | owner du carnet |
| `carnet_favorites` | owner de la ligne ou carnet public/owner | `user_id=auth.uid()` |
| `carnet_comments` | carnet public ou owner | `author_id=auth.uid()` ; insert interdit aux sessions anonymes |
| `carnet_likes` | carnet public ou owner | `user_id=auth.uid()` |
| `carnet_views` | owner du carnet ou admin | insert public `true` |
| `carnet_media` | carnet public ou owner | owner du carnet |
| `hike_sessions` | owner ou carnet public/owner | owner |

**Point fort :** la RLS est globalement cohérente et ferme les lectures des carnets privés. Ce n'est pas le problème principal.

**Point faible :** la page ne s'appuie que sur la RLS, sans contrôle explicite de visibilité côté API ; et le client utilisé côté serveur n'a pas la session (ARCH-003).

### 4.3 Volumétrie et qualité

| Métrique | Valeur |
|---|---:|
| Carnets | 82 |
| Carnets publics | 82 |
| Auteurs null | 3 |
| `groupe_id` non null | 1 |
| Couvertures manquantes | 11 |
| Moments | 228 |
| Moments sans image | 35 |
| Moments sans auteur | 39 |
| Kit items | 223 |
| Favoris | 178 |
| Commentaires | 130 |
| Likes | 596 |
| Vues | 2 320 |
| Médias | 258 |

### DATA-001 — Les tables `groupe_etapes` et `groupe_hebergements` n'existent pas — **P1**

- **Statut :** `[VÉRIFIÉ]` (information_schema + live)
- **Preuve :** `carnet.ts:71` et `:74` interrogent `groupe_etapes` et `groupe_hebergements`. `information_schema.tables` ne les retourne pas. Le seul carnet avec `groupe_id` (`5f319c5d-…`, « Trois jours dans la Chartreuse ») déclenche ces requêtes ; Supabase renvoie une erreur, `data` est `null`, le code continue sans log.
- **Constat :** l'itinéraire de groupe et les hébergements ne sont jamais chargés. La page fabrique alors des jours à partir des moments (DATA-002).
- **Impact :** perte silencieuse de la donnée de groupe ; faux itinéraire ; impossible de distinguer « pas de données » de « table absente ».
- **Correctif attendu :** soit créer/migrer les tables et les policies, soit supprimer ces requêtes et assumer un modèle `carnets`/`carnet_moments` unique. Ne pas laisser un `from()` vers une table inexistante.

### DATA-002 — Les statistiques par jour sont inventées — **P0**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:110-140`. Si `groupe_etapes` est vide et qu'il y a des moments, chaque jour reçoit `totalDist / dayNumbers.length` et `totalElev / dayNumbers.length`. Live « Chartreuse » : 27,4 km / 3 = **9,1 km**, 1 620 m / 3 = **540 m D+**, répétés sur 3 jours ; le titre est `lieu → lieu` (même lieu).
- **Constat :** des chiffres plausibles sont fabriqués et présentés comme des mesures de terrain, sans mention « estimé ».
- **Impact :** trompe l'utilisateur et contredit la promesse « zéro mock ». Risque de confiance majeur pour une app de terrain.
- **Correctif attendu :** ne jamais diviser un total. Afficher « distance non renseignée » ou une estimation explicitement étiquetée (`≈`) avec sa source. Idéalement, stocker les étapes réelles.

### DATA-003 — Les compteurs `likes_count` / `comments_count` sont faux — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** carnet test : `carnets.likes_count=0`, `comments_count=0`, `favorites_count=0` ; en base `carnet_likes=6`, `carnet_comments=3`, `carnet_favorites=1`. La fiche affiche 24 et 8 (`CarnetHero.tsx:37-38`), le mobile 24 et 2 (`Mobile...:71,74`).
- **Constat :** trois sources de vérité concurrentes : colonnes de compteurs, tables de lignes, constantes UI. Aucune n'est synchronisée.
- **Impact :** chiffres faux, incohérence desktop/mobile, impossibility de trier/trier par popularité.
- **Correctif attendu :** compter depuis les tables (`count(*)` ou triggers), ou maintenir les compteurs par trigger et les lire ; supprimer les constantes.

### DATA-004 — Les tables d'engagement réelles sont ignorées — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** aucune occurrence de `carnet_comments`, `carnet_likes`, `carnet_views` ou `carnet_media` dans `src/components/carnet/**` ni dans `src/app/carnets/[id]/page.tsx`. Le hub `/carnets` les utilise (`src/app/carnets/page.tsx:276-320,690-810`), et `CommentItem` supporte `carnet_comments` (`src/components/communaute/CommentItem.tsx:26`).
- **Constat :** le produit a déjà la tuyauterie, la fiche ne la branche pas.
- **Impact :** 130 commentaires, 596 likes, 2 320 vues et 258 médias sont invisibles sur la page qui devrait les mettre en valeur.
- **Correctif attendu :** requêter ces tables dans la fiche, réutiliser `CommentItem`/`CommentsSheet`, et écrire un `carnet_views` à l'ouverture (une fois par session).

### DATA-005 — Auteur fictif quand `author_id` est null ou profil invisible — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:250-251` : `authorName: authorProfile?.full_name || (fullTitle.includes('Ring Road') ? 'Marie Dupont' : 'Antoine Duprès')` et avatar Unsplash. Live « Chartreuse » (`author_id=null`) affiche **« Antoine Duprès »**. `Mobile...:217` répète le fallback.
- **Constat :** un carnet sans auteur invente une identité et un visage. Ce n'est pas un fallback visuel neutre, c'est une fausse attribution.
- **Impact :** désinformation, problème de droits à l'image, confusion pour les auteurs réels.
- **Correctif attendu :** afficher « Auteur non renseigné » ou masquer le bloc auteur ; ne jamais utiliser un nom/avatar inventé.

### DATA-006 — `cover_image` perdu, images de moments ignorées — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:186` mappe bien `imageUrl: m.image_url` ; `MomentCard.tsx:14-26` ne lit jamais `moment.imageUrl` et utilise `PHOTO_MAP` ou une photo générique. `meta` ne contient pas `coverImage` (`carnet.ts:234-251`).
- **Constat :** les images réelles sont chargées puis jetées. La page affiche des photos Unsplash qui ne correspondent pas au carnet.
- **Impact :** contenu faux, gaspillage réseau, expérience générique.
- **Correctif attendu :** `<Image src={moment.imageUrl}>` avec fallback neutre ; idem pour la couverture.

### DATA-007 — Les hébergements sont associés par index, pas par nuit — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `TimelineJours.tsx:16-18` : `if (hebergements[i]) items.push({ ... hebergements[i], number: i + 1 })`.
- **Constat :** si le jour 1 n'a pas d'hébergement et le jour 2 oui, l'hébergement du jour 2 est affiché après le jour 1. `nightNumber` n'est pas utilisé pour l'appariement.
- **Impact :** itinéraire faux, prix/nuits décalés.
- **Correctif attendu :** apparier sur `hebergement.nightNumber === jour.dayNumber` (ou `apres_jour_numero`), avec un fallback explicite.

### DATA-008 — Le prix d'hébergement peut afficher « 0€ » — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:172` : `price: h.prix_cents ? ... : 0` ; `HebergementCard.tsx:13` affiche `{hebergement.price}€` sans condition ; `priceLabel` par défaut `'demi-pension'` (`carnet.ts:173`).
- **Constat :** un prix inconnu devient « 0€ / demi-pension », ce qui est une information commerciale fausse.
- **Correctif attendu :** `price: number | null`, et masquer le prix ou afficher « prix non renseigné ».

### DATA-009 — Des colonnes inexistantes sont lues — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:147` (`carnet.duration`), `:212` (`carnet.kit_intro`, `carnet.equipment_summary`), `:224` (`carnet.duration`). Ces colonnes ne sont pas dans `information_schema.columns`.
- **Constat :** le code compile grâce à `any`/`select('*')`, mais les valeurs sont toujours `undefined`. Les fallbacks masquent l'absence.
- **Impact :** fonctionnalités fantômes (durée, intro de kit), dette de schéma.
- **Correctif attendu :** soit ajouter les colonnes et les exposer, soit supprimer les lectures et les fallbacks.

### DATA-010 — La période affichée ignore `end_date` — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts:241-245` ne formate que `start_date` (ou `started_at`/`created_at`). `end_date` existe et vaut `2026-10-02` sur le carnet test ; la page affiche seulement « 26 septembre 2026 ».
- **Constat :** une expédition de 7 jours est présentée comme un jour unique.
- **Impact :** information incomplète, incohérence avec la fiche technique.
- **Correctif attendu :** formater une plage `26 sept. – 2 oct. 2026` avec gestion des années différentes.

### DATA-011 — Les commentaires n'ont ni reply ni like, mais l'UI en promet — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet_comments` n'a que `id, carnet_id, author_id, content, created_at`. `CommentItem` tente `parent_id` puis retombe sur un commentaire plat (`CommentItem.tsx` bloc `handleSendReply`). `CommentsSheet` gère des réponses via `reply_to_id` et des likes via `likes_count` (`CommentsSheet.tsx:16-23`).
- **Constat :** l'UI affiche « Répondre » et des cœurs, mais la table ne stocke ni parent ni likes. Les réponses sont aplaties ; les likes sont locaux.
- **Impact :** fonctionnalité factice, confusion.
- **Correctif attendu :** soit migrer `parent_id` + table `carnet_comment_likes`, soit retirer les affordances non supportées.

### DATA-012 — Les vues ne sont pas suivies par la fiche — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet_views` a 2 320 lignes ; le hub insère une vue (`src/app/carnets/page.tsx:276`) ; la fiche n'insère rien.
- **Constat :** les vues affichées (si un jour on les affiche) ne comptent pas les ouvertures de la fiche.
- **Impact :** analytics faux, pas de base pour un futur compteur social.
- **Correctif attendu :** insertion idempotente par session (cookie/localStorage), pas à chaque render.

### DATA-013 — Le profil public est une vue `security definer` — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `pg_class.reloptions` de `public_profiles` = `security_invoker=false` ; définition filtrant `is_demo=false` et `profile_visibility`. 237 lignes visibles pour 237+ profils.
- **Constat :** la vue contourne la RLS de `user_profiles` mais applique son propre filtre. C'est intentionnel (correctif du 22/10), mais c'est un point sensible : toute évolution doit préserver le filtre.
- **Impact :** risque de fuite si la définition est modifiée sans test.
- **Correctif attendu :** test de non-régression sur profils privés/invités, et documentation explicite dans le schéma.

### DATA-014 — Index présents, mais requêtes non bornées — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** index sur `carnets(author_id)`, `(visibility)`, `(groupe_id)`, `(trip_id)`, `carnet_moments(carnet_id)`, `carnet_kit_items(carnet_id)`, `carnet_comments(carnet_id)`, `carnet_likes(carnet_id)`, `carnet_views(carnet_id)`. La requête `carnet_moments` n'a pas de `limit` (`carnet.ts:77-81`) ; `select('*')` sur toutes les tables.
- **Constat :** un carnet avec 5 000 moments chargerait tout, y compris `identified_species` et `image_url`.
- **Impact :** mémoire, temps de rendu, payload RSC.
- **Correctif attendu :** pagination des moments, sélection de colonnes explicites, `limit` par défaut.

### DATA-015 — 35 moments sans image et 11 couvertures manquantes — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** requêtes de comptage.
- **Constat :** les états « sans image » ne sont pas conçus ; `MomentCard` met une photo générique à la place, ce qui masque l'absence.
- **Impact :** faux contenu, impossibilité de distinguer un moment sans photo.
- **Correctif attendu :** état vide illustré, pas de photo tierce.

---

## 5. API, authentification, sécurité

### 5.1 Endpoints

| Route | Méthode | Auth | Rôle |
|---|---|---|---|
| `/api/carnets/[id]` | GET | aucune (RLS) | carnet + moments |
| `/api/carnets/[id]/publish` | POST | session + owner | hook progression |
| `/api/carnet/identify-species` | POST | session + rate limit | IA vision |

### API-001 — XSS stockée dans le JSON-LD — **P0**

- **Statut :** `[VÉRIFIÉ par le code]`
- **Preuve :** `page.tsx:110-123` : `dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}`. `schemaOrg.name` et `description` viennent de `carnetData.meta`, donc de `carnets.title`/`description` contrôlés par l'auteur. Aucun échappement de `<`. Le repo applique pourtant `.replace(/</g, '\\u003c')` dans `src/app/voyages/[slug]/page.tsx:99`.
- **Constat :** un titre `</script><img src=x onerror=…>` ferme le script JSON-LD et injecte du HTML/JS dans la page publique. CSP : `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (`csp.config.mjs:28`), donc l'inline n'est pas bloqué.
- **Impact :** XSS stockée sur toutes les fiches publiques, y compris pour des visiteurs anonymes. Vol de session, actions en tant que victime, défiguration.
- **Correctif attendu :** sérialiser avec échappement `<`/`>`/`&`/U+2028, ou utiliser un composant `JsonLd` centralisé ; test avec un titre malveillant.

### API-002 — Le GET ne vérifie pas explicitement la visibilité — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `src/app/api/carnets/[id]/route.ts:16-22` : SELECT puis `if (carnetError || !carnet) 404`. Aucun `visibility` test, aucune session.
- **Constat :** la sécurité repose entièrement sur la RLS. Si une policy est élargie par erreur, l'API expose le carnet. Aujourd'hui la RLS est correcte, mais la défense en profondeur manque.
- **Impact :** risque de régression future, comportement 404 vs 403 indistinct.
- **Correctif attendu :** vérifier `visibility === 'public' || author_id === user.id`, renvoyer 404 pour un non-autorisé (pas 403, pour ne pas révéler l'existence).

### API-003 — L'upload d'espèce n'est pas borné — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `identify-species/route.ts:43-46` ne valide que la présence de `imageBase64` ; pas de taille, pas de type autorisé. `mimeType` est interpolé dans `data:${mimeType};base64,...` (`:60`). Rate limit 10/min (`:34-41`), auth requise (`:27-30`).
- **Constat :** un utilisateur authentifié peut envoyer une image de plusieurs Mo (ou un mimeType arbitraire), consommer du CPU/JSON et le budget IA. Le rate limit limite la fréquence, pas la taille.
- **Impact :** coût, DoS applicatif, abus du provider.
- **Correctif attendu :** limite de taille (ex. 5 Mo), allowlist `image/jpeg|png|webp`, validation magic bytes, rejet 413/415, timeout.

### API-004 — La mise à jour `identified_species` n'est pas vérifiée — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `identify-species/route.ts:109-117` : update `.eq('id', momentId)` sans `carnet_id` ni owner. La RLS `carnet_moments` n'autorise que `auteur_id = auth.uid()` ; 39 moments ont `auteur_id=null`. L'erreur est loggée mais la réponse reste 200.
- **Constat :** l'identification peut réussir sans être persistée ; l'utilisateur ne le sait pas. Un owner de carnet ne peut pas modifier un moment écrit par un collaborateur.
- **Impact :** perte de données silencieuse, incohérence de collaboration.
- **Correctif attendu :** vérifier l'appartenance au carnet, renvoyer un statut de persistance, et adapter la policy aux collaborateurs.

### API-005 — Les favoris sont écrits sans gestion d'erreur — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetHero.tsx:83-94` : `await supabase.from('carnet_favorites').delete/insert` sans vérifier `error` ; l'UI passe à « saved » immédiatement.
- **Constat :** une erreur RLS/réseau affiche quand même « Ajouté aux favoris ».
- **Impact :** faux positif, perte de confiance.
- **Correctif attendu :** gérer `error`, rollback optimiste, toast d'échec.

### API-006 — `/publish` renvoie 200 même en cas d'échec — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `publish/route.ts:43-46` : catch → `{ ok: true, awarded: false }, 200`.
- **Constat :** volontaire pour ne pas bloquer la publication, mais aucun signal serveur exploitable (pas de log corrélé, pas de métrique).
- **Impact :** progression silencieusement non attribuée.
- **Correctif attendu :** journaliser avec `carnet_id`/`user_id` et un identifiant de requête, exposer un compteur.

### API-007 — Pas de rate limit sur le GET public — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** aucune occurrence de `enforceRateLimit` dans `api/carnets/[id]/route.ts`.
- **Constat :** un client peut scrapper les 82 carnets et leurs moments.
- **Impact :** charge DB, scraping de contenu.
- **Correctif attendu :** rate limit `failMode:'open'` par IP, cache CDN/ISR.

### API-008 — CSP permissive — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `csp.config.mjs:28-31` : `script-src 'self' 'unsafe-inline' 'unsafe-eval'` ; `img-src 'self' data: blob: https:`.
- **Constat :** la CSP n'atténue pas l'XSS JSON-LD et autorise toutes les images HTTPS.
- **Impact :** défense en profondeur faible.
- **Correctif attendu :** nonce/hash pour les scripts, allowlist d'images (`images.unsplash.com`, `*.supabase.co`, `i.pravatar.cc`, tuiles OSM), suppression progressive de `unsafe-eval`.

### API-009 — Les images tierces sont chargées sans proxy — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetMap.tsx` charge les icônes Leaflet depuis `unpkg.com` (`:55-59`) ; les covers/moments depuis `images.unsplash.com` ; avatars depuis `i.pravatar.cc`. `image-hosts.config.mjs` les liste, mais les `<img>` natifs ne passent pas par `next/image`.
- **Constat :** dépendance à trois tiers, pas de cache optimisé, pas de contrôle de disponibilité.
- **Impact :** images cassées si un tiers change, latence, privacy.
- **Correctif attendu :** `next/image` avec `remotePatterns`, ou proxy Supabase Storage ; icônes Leaflet locales.

### API-010 — L'export JSON expose des champs internes — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:54-64` : `JSON.stringify(data)` télécharge tout `CarnetData`, y compris `hikeSessionId`, `poiEvents`, `traceGeojson`.
- **Constat :** un visiteur public peut exporter la trace et les POI, même si l'UI ne les affiche pas tous.
- **Impact :** fuite de données de localisation précises.
- **Correctif attendu :** définir un export public minimal ou réserver l'export complet à l'auteur.

---

## 6. Fonctionnel et interactions

### 6.1 Matrice des contrôles

| # | Contrôle | Desktop | Mobile | Effet réel | Persistance | Verdict |
|---|---|---|---|---|---|---|
| 1 | Fil d'Ariane Communauté/Carnets | Oui | Non | Liens | — | OK |
| 2 | Retour `/carnets` | Sidebar | Bouton ‹ | Navigation | — | OK |
| 3 | Onglets verticaux | Oui | Non | `activeTab` local | Non | Local |
| 4 | Plateau Récit/Carte/Moments/Matériel/Nature | Non | Oui | Event → `activeTab` | Non | Local |
| 5 | Auteur → profil | Oui | Oui | Lien | — | OK si authorId |
| 6 | Like carnet | Oui | Oui | +1 local, toast | **Non** | **Factice** |
| 7 | Commentaires (icône) | Oui | Oui | Desktop : onglet Moments ; mobile : sheet | **Non** | **Cassé/factice** |
| 8 | Enregistrer/favori | Oui | Oui | Desktop : DB ; mobile : local | Desktop oui, mobile non | **Incohérent** |
| 9 | Partager | Oui | Oui | Desktop : native/copie ; mobile : export JSON | Non | **Incohérent** |
| 10 | Exporter le carnet | Oui | Oui (via bouton) | Télécharge JSON | — | OK mais export large |
| 11 | Télécharger GPX (sidebar) | Oui | Non | GPX, vide si pas de trace | — | **Trompeur** |
| 12 | Télécharger GPX (carte) | Oui | Oui | Idem | — | **Trompeur** |
| 13 | GPX par randonnée | Oui | Non | GPX vide | — | **Cassé** |
| 14 | Imprimer | Oui | Non | `window.print()` | — | **Tronqué** (scroll interne) |
| 15 | Zoom carte +/− | Oui | Oui | Leaflet zoom | — | OK mais 24 px |
| 16 | Carte | Oui | Onglet map | Leaflet, tuiles | — | OK si réseau |
| 17 | Moment → lightbox | Oui | Oui | Modal | — | OK |
| 18 | Like moment | Oui | Oui | +1 local aléatoire | Non | **Factice** |
| 19 | Kit : cocher | Oui | Oui | État local | Non | Local |
| 20 | Kit : filtrer | Oui | Oui | Filtre par nom | — | Fragile |
| 21 | Kit : Reconfigurer IA | Oui | Non | Lien `/compas?etape=kit` | — | OK |
| 22 | Faune/flore : photo | Oui | Oui | POST API | Résultat non persisté | **Partiel** |
| 23 | Commentaire inline | Non | Oui | Ajout local | Non | **Factice** |
| 24 | Feuille commentaires | Non | Oui | Ajout/suppression/like locaux | Non | **Factice** |
| 25 | `Voir tout` commentaires | Non | Oui | Ouvre la sheet | — | OK |
| 26 | Stats mobile | Oui (StatsBar) | Oui (4 cases) | Distance/dénivelé réels ; jours et note faux | — | **Incohérent** |
| 27 | Badge « Certifié » | Oui | Non | Statique | — | **Faux** |
| 28 | « Membre Explorateur » | Oui | Non | Statique | — | **Faux** |
| 29 | « Trace 3D » | Oui | Non | Carte 2D | — | **Faux** |
| 30 | « Expédition Certifiée » | Oui | Non | Statique | — | **Faux** |
| 31 | Retour 404 | Oui | Oui | `/carnets` | — | OK |
| 32 | Réessayer (error) | Oui | Oui | `reset()` | — | Jamais atteint |

### UX-001 — Le like est une illusion — **P0**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetHero.tsx:37,72-81` ; `Mobile...:71,94-104` ; test live : clic sur « Aimer ce carnet » → compteur 24→25, **aucune requête `rest/v1` supplémentaire**. Refresh → 24.
- **Constat :** aucun `carnet_likes` n'est écrit, aucun état initial n'est lu. Le compteur est une constante.
- **Impact :** l'utilisateur croit avoir réagi ; rien n'est enregistré, l'auteur ne voit rien, les autres non plus.
- **Correctif attendu :** lire `carnet_likes` pour l'utilisateur, upsert/delete, compteur réel, optimistic UI + rollback.

### UX-002 — Les commentaires sont un décor — **P0**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `INITIAL_COMMENTS` (`Mobile...:32-50`) contient « Alexandre V. » et « Sophie Martin » avec des likes ; `CommentsSheet` reçoit ce state ; `handleAddComment` fait `setComments` + toast (`:112-126`) sans requête. Compteur desktop 8 (`CarnetHero.tsx:38`) ; compteur mobile `comments.length` = 2. Le carnet test a 3 commentaires réels en base.
- **Constat :** trois chiffres (8, 2, 3) et deux jeux de faux commentaires. Aucun n'est le vrai.
- **Impact :** trompe l'utilisateur, ne crée pas de conversation, perd les 130 commentaires existants.
- **Correctif attendu :** charger `carnet_comments` + profils, écrire avec `author_id`, afficher le vrai compteur, réutiliser `CommentItem`.

### UX-003 — Le bouton commentaire desktop ne fait pas ce qu'il annonce — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:104` : `onOpenComments={() => setActiveTab('moments')}`. Le clic bascule sur « Moments & Récits », il n'ouvre aucune feuille de commentaires (il n'y en a pas sur desktop).
- **Constat :** l'icône bulle et le compteur 8 sont un faux contrôle.
- **Impact :** frustration, incompréhension.
- **Correctif attendu :** ouvrir la même `CommentsSheet` que mobile, ou supprimer l'icône desktop tant que la feature n'existe pas.

### UX-004 — Enregistrer : DB sur desktop, local sur mobile — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetHero.tsx:83-94` écrit `carnet_favorites` ; `Mobile...:106-110` fait `setIsSaved` + toast, sans `user`, sans Supabase.
- **Constat :** la même action a deux comportements. Un utilisateur mobile croit avoir sauvegardé ; rien n'est en base.
- **Impact :** perte de favoris, incohérence de compte.
- **Correctif attendu :** une seule mutation partagée, avec auth gate et optimistic update.

### UX-005 — Partager : natif sur desktop, export JSON sur mobile — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetHero.tsx:58-70` utilise `navigator.share`/clipboard ; `Mobile...:281-290` appelle `onExport()` → `CarnetView.tsx:54-64` télécharge un JSON.
- **Constat :** sur mobile, « Partager » télécharge un fichier au lieu d'ouvrir la feuille de partage. Aucun lien copié.
- **Impact :** action incomprise, partage social impossible.
- **Correctif attendu :** `navigator.share` + fallback clipboard sur les deux, avec le lien canonique.

### UX-006 — Les GPX sont vides — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:22-38` génère un GPX avec `coords=[]` si `traceGeojson` absent, puis télécharge quand même. `RandonneesSouvenirCard.tsx:10-11` génère un `<trkseg></trkseg>` vide pour chaque « randonnée ».
- **Constat :** quatre boutons GPX (sidebar, carte, liste randonnées, mobile) peuvent produire un fichier valide mais sans point.
- **Impact :** l'utilisateur importe un GPX inutilisable ; promesse « trace GPS » non tenue.
- **Correctif attendu :** désactiver le bouton sans trace, ou générer un GPX d'itinéraire réel ; ne jamais télécharger un fichier vide.

### UX-007 — « Imprimer » imprime la première viewport — **P2**

- **Statut :** `[SUSPECTÉ, forte présomption]`
- **Preuve :** `CarnetView.tsx:79` (`h-[100dvh] overflow-hidden`), scroll interne (`:95`). Aucun `@media print` spécifique dans les fichiers carnet. Le bouton est dans `CarnetDetailVerticalTabs`.
- **Constat :** à l'impression, le conteneur scrollable est traité comme une boîte `overflow:hidden` : seul le contenu visible risque d'être imprimé.
- **Impact :** impression tronquée, promesse « imprimer » non tenue.
- **Correctif attendu :** feuille `@media print` qui déplie le conteneur, masque les navs et pagine ; test PDF.

### UX-008 — La carte affiche un itinéraire même sans trace — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetMap.tsx:37-42` centre la carte sur un fallback (Chamonix par défaut) ; `:120-122` affiche « Aucune trace GPS enregistrée » seulement si `mapLoaded && !hasRoute` ; le footer affiche quand même distance/dénivelé (`:230-236`).
- **Constat :** la carte montre une région générique et des chiffres, ce qui suggère une trace réelle. Pour le carnet test, `hike_sessions` est vide.
- **Impact :** confusion, fausse preuve de terrain.
- **Correctif attendu :** état vide explicite sans carte centrée sur une région arbitraire, ou carte désactivée avec CTA.

### UX-009 — Like de moment aléatoire — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `MomentCard.tsx:23` : `useState(Math.floor(Math.random() * 8) + 4)`. Aucun lien avec une table.
- **Constat :** le nombre de likes change à chaque montage/refresh et peut différer entre serveur et client (hydration).
- **Impact :** incohérence visuelle, faux engagement.
- **Correctif attendu :** likes réels ou aucun compteur.

### UX-010 — Poids du kit codé en dur — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `KitSouvenirCard.tsx:48` : « Poids estimé 4.8 kg » ; `carnet.ts:206-210` calcule `totalWeightStr` mais `CarnetView.tsx:157` ne passe que `intro` et `items` ; `Mobile...` idem.
- **Constat :** le poids affiché est faux pour tous les carnets, même à 0 article.
- **Impact :** information de terrain fausse (le poids est central pour un carnet de randonnée).
- **Correctif attendu :** passer `totalWeight` et l'afficher ; ne rien afficher si 0.

### UX-011 — Checklist sans persistance — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `KitSouvenirCard.tsx:14-25` : `checkedItems` local ; aucun appel DB.
- **Constat :** cocher « duvet » ne survit pas au refresh.
- **Impact :** l'utilisateur perd sa préparation.
- **Correctif attendu :** persister dans `localStorage` ou une table `carnet_kit_checks` ; sinon retirer l'affordance.

### UX-012 — Identification IA non persistée et sans gate — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `SpeciesIdentifier.tsx:67-110` poste l'image ; `momentId` n'est jamais fourni par `CarnetView.tsx:181` ni `Mobile...:500` ; `onIdentified` non passé. `identify-species/route.ts:27-30` renvoie 401 si pas de session ; le client affiche une erreur générique (`SpeciesIdentifier.tsx:104-106`).
- **Constat :** un visiteur anonyme peut lancer l'analyse, reçoit une erreur générique, et le résultat n'est jamais stocké même connecté.
- **Impact :** fonctionnalité inutile, coût IA potentiel, frustration.
- **Correctif attendu :** auth gate explicite, `momentId` réel, persistance `identified_species`, historique.

### UX-013 — Les onglets ne survivent pas au refresh — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** état local (`CarnetView.tsx:45`, `Mobile...:68`), pas d'URL.
- **Constat :** partager « la carte » est impossible ; refresh revient au récit.
- **Impact :** navigation fragile, partage incomplet.
- **Correctif attendu :** `?section=` ou ancres.

### UX-014 — Le carnet 404 garde la navigation carnet — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** capture `carnet-404.png` : « Récit / Carte & GPX / Moments / Matériel / Nature » reste affiché sur l'écran « Carnet introuvable ».
- **Constat :** les contrôles d'une page absente restent actifs.
- **Impact :** confusion, clics dans le vide.
- **Correctif attendu :** masquer le plateau sur l'état introuvable, ou rediriger vers `/carnets`.

### UX-015 — Aucun état de chargement/erreur pour les actions — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `handleToggleSave` et `handleToggleLike` n'ont ni `pending`, ni `disabled`, ni rollback (`CarnetHero.tsx:72-94`, `Mobile...:94-110`).
- **Constat :** double-clic possible, pas de feedback en cas d'échec.
- **Impact :** doublons/incohérences, pas de confiance.
- **Correctif attendu :** états `idle/pending/success/error`, boutons désactivés, toast d'échec.

---

## 7. Visuel et écart avec la Communauté

### 7.1 La référence Communauté

| Élément | Communauté |
|---|---|
| Largeur | 430–520 px, centrée, une colonne |
| Fond | toile globale + voile, pas de surface opaque |
| Header | pastille « Pour toi », `+`, recherche, cloche |
| Auteur | pastille 28 px, nom 12 px, handle 10,5 px, verre |
| Post image | carré 1:1, radius 28, image plein cadre |
| Post texte | carte verre 0.62, blur 25, texte 15/1.4 |
| Actions | capsule 3×34 px, like/comment/share |
| Barre basse | 48 px, 5 onglets, verre |
| Encre | forest 900 sur verre clair (rescope local) |
| Titre de page | aucun (h1 sr-only) |

### 7.2 La fiche carnet actuelle

| Élément | Carnet |
|---|---|
| Largeur | 1440 px, 3 colonnes (230 + centre + 300) |
| Fond | photo globale, verre translucide |
| Header | Header global 940 px |
| Auteur | pastille dans hero, nom + « Guide & Explorateur LKDV » |
| Hero | carte large, titre display + serif, badges |
| Actions | boutons texte + icônes, pas de capsule |
| Navigation | sidebar verticale + plateau mobile + barre basse |
| Encre | blanche sur photo, même en thème clair |
| Titre de page | H1 dans le hero, H4 avant lui dans la sidebar |

### VIS-001 — Deux systèmes d'encre incompatibles — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `html[data-liquid-ios27]` force `--lkv-text-primary: #fff` (`src/styles/liquid-ios27.css:40-80`) et `--lkv-surface-paper: rgba(255,255,255,.06)` (`:206-207`). La Communauté rescope ces tokens en forest sur `.lkdv-community-experience` (`community-social.css:800-835`). La fiche carnet ne le fait pas.
- **Constat :** la fiche est en « blanc sur photo » même en thème clair (capture `carnet-1440-light.png` identique à la sombre). La Communauté est en « forest sur verre clair ». Les deux pages ne peuvent pas être « le même style ».
- **Impact :** contraste faible sur les zones claires de la photo, incohérence de marque, refonte impossible sans trancher.
- **Correctif attendu :** rescoper l'encre sur la coquille carnet (forest 900) et poser un voile clair, ou assumer un thème sombre dédié — mais pas les deux.

### VIS-002 — Le layout est éditorial, pas social — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** capture 1440 ; `CarnetView.tsx:80-92` (3 colonnes) ; CSS `.lkdv-social-detail-desktop > main` (`community-social.css:738-744`).
- **Constat :** sidebars, breadcrumb, hero large, badges, double CTA. La Communauté est une colonne unique, sans sidebars, sans breadcrumb.
- **Impact :** la refonte demandée n'est pas un simple reskin : c'est un changement de structure.
- **Correctif attendu :** colonne unique, header de post, sections empilées.

### VIS-003 — La couverture réelle est absente — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `carnet.ts` ne mappe pas `cover_image` ; mobile fallback Unsplash (`:88-90`) ; desktop fond global.
- **Constat :** tous les carnets se ressemblent ; la photo choisie par l'auteur n'est pas le sujet visuel.
- **Impact :** perte d'identité, feed monotone.
- **Correctif attendu :** cover 4:5/1:1 avec `alt`, fallback dégradé de marque.

### VIS-004 — Les faux badges saturent la hiérarchie — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetHero.tsx:170-180` (Récit Vérifié / Certifié), `CarnetDetailRightSidebar.tsx:36-55` (Expédition Certifiée, Membre Explorateur, Guide Certifié), `:70` (Trace 3D), `CarnetHero.tsx:120` (badge destination/voyageurs/date), `JourCard` badges stats, `KitSouvenirCard` badge poids.
- **Constat :** au moins 7 badges/certifications sur un écran, dont plusieurs faux. Le regard ne sait plus ce qui est important.
- **Impact :** bruit visuel, crédibilité.
- **Correctif attendu :** un seul badge de statut réel (public/privé, vérifié ou non), pas deCertified inventé.

### VIS-005 — Typographie et rythme — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `text-[length:var(--lkv-text-caption-2)]` partout (10 px), `font-mono` uppercase tracking, serif italique pour les titres, display pour les labels. `CarnetHero` H1 `--lkv-text-title-xl` (probablement 40–48 px) ; `Mobile...` H1 `title-sm`/`title-lg`.
- **Constat :** quatre familles (display, serif, sans, mono) et des micro-labels 10 px très serrés. Sur la photo, les labels mono blancs/60 sont difficiles à lire.
- **Impact :** fatigue visuelle, accessibilité.
- **Correctif attendu :** échelle typo simplifiée, minimum 12 px pour les labels, réserver le mono aux données, serif aux citations.

### VIS-006 — Responsive : un seul breakpoint — **P0/P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** baseline `md` 768 ; capture 768 (152 px de centre) ; 1024 (379 px de centre) ; 1440 (702 px).
- **Constat :** aucun état tablette. La bascule mobile→desktop est trop tôt.
- **Impact :** page cassée sur une large plage d'écrans.
- **Correctif attendu :** mobile jusqu'à 900 px, colonne 520–640 jusqu'à 1280, et éventuellement une colonne large au-delà ; tests 390/430/768/1024/1280/1440.

### VIS-007 — Contraste sur photo — **P1**

- **Statut :** `[SUSPECTÉ, non mesuré au pixel]`
- **Preuve :** texte blanc `--lkv-text-primary` et `--lkv-text-muted` (blanc 0.5) sur photo ; labels `ITINÉRAIRE`, `PÉRIODE`, `ÉQUIPE` en 10 px blanc/60 (`CarnetHero.tsx:145-160`). La photo a des zones claires (ciel, neige).
- **Constat :** plusieurs couples texte/fond sont probablement sous 4.5:1, surtout les labels muted.
- **Impact :** lisibilité, WCAG 1.4.3.
- **Correctif attendu :** voile local, texte sur surface opaque, ou `text-shadow` ; mesurer avec `scripts/audit/visual-contrast.mjs`.

### VIS-008 — Icônes et emojis mélangés — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** emojis 🎒📖🌿📷🗺️🏕️❤️ dans les boutons/badges (`CarnetHero.tsx:192`, `Mobile...:342`, `JourCard`, `KitSouvenirCard`), à côté d'icônes SVG (`AppIcon`). `CarnetDetailVerticalTabs` utilise `📖` et `ChevronRightAnimated`.
- **Constat :** le langage iconographique n'est pas unifié ; les emojis rendent différemment selon l'OS.
- **Impact :** aspect prototype, incohérence cross-platform.
- **Correctif attendu :** une seule famille d'icônes, emojis réservés au contenu utilisateur.

### VIS-009 — Densité et espacement — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** capture 1440 : hero, stats, parcours, moments, kit, randonnées dans une colonne de 702 px, avec sidebars ; cartes `p-[var(--space-4)]` à `space-6` ; gap `space-5`.
- **Constat :** beaucoup de contenu entassé, scroll interne de 2 207 px pour 788 px visibles (2,8 écrans). Le hero est haut, les sections se chevauchent visuellement avec les sidebars.
- **Impact :** lecture fatigante, impression de dashboard.
- **Correctif attendu :** une colonne, sections aérées, rythme vertical régulier.

### VIS-010 — Le 404 et le loading ne sont pas dans le langage — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** capture 404 avec barre plateau + bottom nav ; `loading.tsx` ancien skeleton (`max-w-7xl`, 6 stats).
- **Constat :** les états périphériques cassent l'immersion.
- **Impact :** perception de finition.
- **Correctif attendu :** états designés avec la même coquille.

---

## 8. Performance

### 8.1 Mesures

| Mesure | Valeur | Contexte |
|---|---:|---|
| Chunks de la route `/carnets/[id]/page` | 20 fichiers, **1 076 Ko raw / 306 Ko gzip** | `.next-post-build/app-build-manifest.json` |
| JS total transféré | **~821 Ko** | build production, 1440, cache froid partiel |
| CSS total | **~333 Ko** dont image de fond 248 Ko | idem |
| Image de fond | `lkdv-bg-landscape.webp` 248 Ko | 1440×900 |
| TTFB | **2 120–2 572 ms** | local, build production |
| FCP | **4 276 ms** | mobile 430, local |
| LCP | **5 492 ms** — élément `IMG` cover 1200 px, `opacity-70` | mobile 430, local |
| CLS | **0,0006** | excellent |
| Nœuds DOM | 654–679 | correct |
| Images sans alt visibles | 6 tuiles OSM | décoratives mais non marquées |
| Requêtes Supabase | 6 (dont 2 pour la même ligne) + 2 favoris + présence + profils | live |

### PERF-001 — La page entière est un Client Component — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:1` `'use client'` ; tous les composants enfants sont importés statiquement ; `MobileCarnetDetailView`, `CommentsSheet`, `SpeciesIdentifier`, `CarnetMap` sont dans le bundle initial.
- **Constat :** le serveur sérialise les données puis le client hydrate tout l'arbre, y compris les composants qui ne sont pas visibles.
- **Impact :** 306 Ko gzip de route, hydration lente, INP dégradé.
- **Correctif attendu :** garder le serveur pour le contenu, isoler les îlots interactifs (`LikeButton`, `CommentsSheet`, `SpeciesIdentifier`, `CarnetMap`) en `dynamic()`/client components.

### PERF-002 — La carte se charge sous la ligne de flottaison — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView.tsx:111-133` rend `CarnetMap` dans l'onglet overview desktop ; live : 6 tuiles OSM chargées au premier écran, chunk Leaflet 302 Ko en dev. Aucun `IntersectionObserver`.
- **Constat :** l'utilisateur qui ne descend pas paie Leaflet + tuiles.
- **Impact :** réseau, LCP, batterie.
- **Correctif attendu :** `dynamic(() => import('./CarnetMap'), { ssr:false })` + chargement à l'intersection, placeholder statique.

### PERF-003 — Images non optimisées — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** aucun `next/image` dans `src/components/carnet/**` ; 6 `<img>` ; cover 1200 px, avatars 400 px, moments 800 px. `MomentCard.tsx:51` a seulement `loading="lazy"`.
- **Constat :** pas de `srcset`, pas de width/height, pas de conversion AVIF/WebP, pas de `fetchPriority`.
- **Impact :** octets inutiles, CLS (images sans dimensions), LCP.
- **Correctif attendu :** `next/image` avec `sizes`, `priority` sur la cover, `placeholder="blur"`, dimensions explicites.

### PERF-004 — CSS global lourd — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `src/app/layout.tsx:6-15` importe 10 feuilles globales (tokens, tailwind, liquid-glass, liquid-ios27, liquid-capsules, native-account-tabbar, community-social, account-glass, community-feed, post-system). CSS route 10,6 Ko + global 37,7 Ko (gzip ~2,7 Ko route).
- **Constat :** la fiche carnet hérite de styles de la Communauté, du Compte, du post system.
- **Impact :** cascade difficile, poids, régressions.
- **Correctif attendu :** CSS route-scopé ou modules, réduire les feuilles globales.

### PERF-005 — TTFB et requêtes — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `dynamic='force-dynamic'` (`page.tsx:154`) ; 2 SELECT carnets (metadata + page) ; 6 requêtes liées ; TTFB 2,1–2,6 s.
- **Constat :** aucun cache, chaque visite refait tout.
- **Impact :** LCP, coût DB.
- **Correctif attendu :** `unstable_cache`/ISR pour la partie publique, `React.cache` pour la lecture partagée, engagement en client.

### PERF-006 — `createClient()` recréé à chaque render — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetHero.tsx:39` ; `useEffect` dépend de `supabase` (`:56`), objet recréé à chaque render. Live : 2 requêtes favoris identiques.
- **Constat :** effet instable, requêtes dupliquées, risque de boucle si le state change.
- **Impact :** consommation réseau, bugs subtils.
- **Correctif attendu :** `useMemo(() => createClient(), [])` ou client singleton.

### PERF-007 — Aucun budget de page — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** budgets existent (`docs/PERFORMANCE_BUDGET*.md`) mais aucun test dédié à `/carnets/[id]`.
- **Constat :** pas de garde-fou.
- **Correctif attendu :** budget LCP < 2,5 s, JS route < 150 Ko gzip, images < 300 Ko, et test CI.

---

## 9. Accessibilité

### A11Y-001 — Champ de commentaire blanc sur blanc — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CommentsSheet.tsx:125` ; computed live : `color: rgb(255,255,255)`, `background-color: rgb(255,255,255)`, placeholder `--lkv-text-muted` (blanc). Capture `carnet-430-comments.png` : pill blanc vide.
- **Constat :** impossible de lire ce qu'on tape ou le placeholder.
- **Impact :** formulaire inutilisable pour tous, critique en contraste.
- **Correctif attendu :** encre forest sur fond clair, placeholder contrasté ; test axe.

### A11Y-002 — Cibles tactiles < 44 px — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** live 430 : like 61×36, comment 47×36, save 36×36, share 36×36, GPX 66×36, zoom 24×24, chips 32 px. `DESIGN_SYSTEM.md` exige 44×44.
- **Constat :** de nombreux contrôles sont sous le seuil.
- **Impact :** erreurs de tap, WCAG 2.5.5.
- **Correctif attendu :** `min-h-[44px] min-w-[44px]`, padding invisible si besoin.

### A11Y-003 — Scroll clavier impossible — **P1**

- Voir ARCH-004.

### A11Y-004 — Hiérarchie de titres — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** desktop : `H4 Récit LKDV` (sidebar) avant `H1` (hero), puis `H2 Le parcours`, `H3`, `H2 Les moments`, `H3 Dans le sac`, `H2 Expédition Certifiée`, `H3 Fiche Technique`. `H4` avant `H1` et plusieurs `H3` sans `H2` parent.
- **Constat :** l'ordre de lecture est incohérent.
- **Impact :** navigation par titres difficile.
- **Correctif attendu :** H1 unique en tête de contenu, H2 par section, H3 pour les cartes ; sidebar en `<nav>` sans titre H4.

### A11Y-005 — Onglets non sémantiques — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetDetailVerticalTabs.tsx:80-90` : `<Button aria-pressed>` ; `NavigationPlateau.tsx` : `<button>` avec `fontWeight` actif, pas d'`aria-current`/`aria-selected` ; pas de `role="tablist"`/`tab`.
- **Constat :** l'état actif est visuel seulement pour le plateau.
- **Impact :** lecteurs d'écran ne savent pas quelle section est active.
- **Correctif attendu :** `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, ou `aria-current="page"` pour les ancres.

### A11Y-006 — `Card` interactive contenant des boutons — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `MomentCard.tsx:38-41` : `<Card variant="interactive" onClick=...>` (role button) contenant `<IconButton>` like (`:62-80`).
- **Constat :** interactif imbriqué, ARIA invalide ; le clic like doit `stopPropagation`.
- **Impact :** navigation clavier ambiguë.
- **Correctif attendu :** ne pas mettre `onClick` sur la carte ; utiliser un bouton d'ouverture dédié ou un lien.

### A11Y-007 — Images sans alt / alt non pertinent — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** live : 6 tuiles OSM sans alt (décoratives), `MomentCard` alt = `moment.location` (ne décrit pas la photo), cover alt = titre. `next/image` absent.
- **Constat :** les images de moments n'ont pas de description utile ; les tuiles devraient être `alt=""` + `aria-hidden` si décoratives.
- **Impact :** lecteurs d'écran.
- **Correctif attendu :** `alt` éditorial, `role="presentation"` sur les tuiles.

### A11Y-008 — Contrastes — **P1/P2**

- Voir VIS-007. Les labels 10 px blanc/60 sur photo sont les plus à risque. Le badge « Confiance faible » etc. n'est pas concerné ici.

### A11Y-009 — `prefers-reduced-motion` partiel — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `MobileCarnetDetailView.tsx:319-327` `AnimatePresence` + `motion.div` sans `useReducedMotion` ; `MomentCard` a `motion-reduce` sur le hover (`:50`), mais le like `motion.svg` n'a pas de garde.
- **Constat :** les transitions restent actives pour certains utilisateurs.
- **Impact :** inconfort.
- **Correctif attendu :** `useReducedMotion` global, transitions à 0.

### A11Y-010 — Focus visible — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `Card` a `focus-visible:ring` ; `CarnetDetailVerticalTabs` utilise `Button` ; les boutons du plateau ont un style inline sans `:focus-visible` dédié ; `focus-visible` global existe dans `tokens.css` mais les styles inline peuvent le supprimer.
- **Constat :** à vérifier au clavier ; certains boutons n'ont pas d'anneau visible.
- **Impact :** navigation clavier.
- **Correctif attendu :** audit focus sur les 5 onglets, les actions, la carte, le kit.

### A11Y-011 — Zoom 200 % — **P2**

- **Statut :** `[SUSPECTÉ]`
- **Preuve :** layout 3 colonnes fixe, `h-[100dvh]`, textes 10 px ; à 200 %, le centre se réduit encore.
- **Constat :** risque de débordement et de contenu coupé.
- **Impact :** WCAG 1.4.4/1.4.10.
- **Correctif attendu :** tests 200 % et 320 px de large.

---

## 10. SEO

### SEO-001 — Soft 404 — **P1**

- Voir ARCH-015. `curl` → 200 sur un id inconnu, `noindex`.

### SEO-002 — JSON-LD non échappé — **P0**

- Voir API-001.

### SEO-003 — Image JSON-LD et auteur faux — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:113` `image: '/assets/images/og-image.png'` (relative, pas la cover) ; `author` = Organization LKDV (`:116-120`), pas la personne ; pas de `datePublished`/`dateModified`.
- **Constat :** le rich result ne reflète ni l'image ni l'auteur.
- **Impact :** CTR, exactitude.
- **Correctif attendu :** `image: cover_image || og`, `author: Person` si `author_id`, dates.

### SEO-004 — Contenu desktop absent du HTML initial — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView` est client ; les sections sont conditionnelles à `activeTab` (`:99-169`). Le HTML SSR contient l'overview (parcours, moments, kit) mais pas la section `faune-flore`, qui n'existe que dans l'onglet dédié. Les deux arbres sont dans le DOM.
- **Constat :** la section Faune & Flore IA n'est pas indexable, et l'essentiel du contenu dépend de l'hydratation client.
- **Impact :** SEO du récit complet.
- **Correctif attendu :** rendu serveur des sections ou contenu dans le HTML avec `hidden`.

### SEO-005 — Metadata correcte mais incomplète — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:14-84` : title, description, robots, canonical, OG, Twitter. `description` tronquée à 160, fallback correct. `robots` dépend de `visibility` (bien), `is_public` mort.
- **Constat :** pas de `keywords`, pas de `authors`, pas de `publishedTime`/`modifiedTime`, pas d'`alternates.languages`.
- **Impact :** rich results limités.
- **Correctif attendu :** compléter, sans surcharger.

### SEO-006 — Breadcrumb schema partiel — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `page.tsx:129-147` : position 3 = `titleLine1` seul, pas le titre complet ; pas de `item` pour la page courante ? Il y en a un.
- **Constat :** breadcrumb tronqué.
- **Correctif attendu :** titre complet.

---

## 11. Tests, observabilité, contenu, maintenabilité

### 11.1 Couverture

- 878 fichiers de test, aucun dédié à `/carnets/[id]`.
- Aucun test de `getCarnetComplet`, `CarnetHero`, `MobileCarnetDetailView`, `CommentsSheet` (carnet), `CarnetMap`, `SpeciesIdentifier`, `LocalCarnetRenderer`.
- Aucun test e2e de la fiche, aucun test visuel de la route, aucun test a11y.
- Le seul test « carnet » est `tests/trips/engine/carnetConversionEngine.spec.ts`, qui ne touche pas la page.

### TEST-001 — Aucun test de la fiche — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** recherche `tests/` ; 39 fichiers mentionnent « carnet », aucun ne cible la route ni les composants de détail.
- **Constat :** les régressions P0 ci-dessus n'ont pas pu être détectées.
- **Impact :** qualité non garantie.
- **Correctif attendu :** tests unitaires des transforms, tests composants des actions, e2e public/privé/anonyme, visuel 430/768/1440, a11y.

### OBS-001 — Erreurs avalées, pas de trace serveur — **P1**

- Voir ARCH-007. `console.error` navigateur seulement ; pas de Sentry/OTel corrélé.
- **Correctif attendu :** logger serveur avec `requestId`, `carnetId`, `userId`, et alerter sur taux de `null`.

### CONTENT-001 — Promesses fausses — **P0/P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** « Expédition Certifiée » / « Récit Vérifié » / « Certifié LKDV » / « Membre Explorateur » / « Guide Certifié » sur un carnet `verified=false` ; « Trace 3D » sur une carte 2D ; « Trois traces enregistrées » pour 0–3 jours ; « Poids estimé 4.8 kg » ; « 2 retours de la communauté » avec des commentaires fictifs ; « Carte & GPX » sans GPX.
- **Constat :** le contenu promet des preuves qui n'existent pas.
- **Impact :** confiance, conformité (allégations), image de marque.
- **Correctif attendu :** supprimer ou conditionner chaque promesse à une donnée réelle.

### CONTENT-002 — Faux commentaires — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `INITIAL_COMMENTS` avec noms/avatars/photos Unsplash ; « Sophie Martin » a liké ; « Merci pour le partage de la trace GPX » alors que le carnet n'a pas de GPX.
- **Constat :** des utilisateurs fictifs participent à la conversation.
- **Impact :** trompe l'utilisateur, risque de confusion avec de vrais membres.
- **Correctif attendu :** utiliser les vrais commentaires ; état vide si aucun.

### CONTENT-003 — Copy incohérente — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** desktop « Exporter le carnet » / « Télécharger le GPX » / « Récit Vérifié » ; mobile « Partager » (export) / « Note — » / « Durée 2 jours » / « Guide & Explorateur LKDV » (statique) ; « Expédition Certifiée » vs `verified=false` ; « Trace GPS & Relief 3D » vs Leaflet 2D ; « Carnet de terrain » vs « Carnet d'expédition ».
- **Constat :** le vocabulaire varie, parfois faux.
- **Impact :** lisibilité, confiance.
- **Correctif attendu :** glossaire produit unique (carnet, récit, étape, moment, sortie, trace).

### MAINT-001 — Duplication desktop/mobile — **P1**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `CarnetView` 208 lignes + `MobileCarnetDetailView` 512 lignes ; les deux gèrent like/save/share/stats/commentaires avec des logiques différentes. `CommentsSheet` 401 lignes, `CarnetHero` 237, `MomentCard` 127, `KitSouvenirCard` 137.
- **Constat :** deux implémentations, deux comportements, deux bugs.
- **Impact :** maintenance, régressions.
- **Correctif attendu :** hooks partagés (`useCarnetEngagement`, `useCarnetSections`), composants de présentation communs.

### MAINT-002 — `any`, casts, imports de mock — **P2**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `const metaAny = (data.meta || {}) as any` (`Mobile...:87`) ; `(carnet as any).is_public` (`page.tsx:43`) ; `traceGeojson?: any` (`CarnetMap.tsx:11`) ; `data.traceGeojson` typé `any` (`types/carnet.ts`) ; imports depuis `@/lib/mock/carnet-chartreuse`.
- **Constat :** les erreurs de schéma ne sont pas détectées.
- **Impact :** bugs silencieux (colonnes inexistantes).
- **Correctif attendu :** types Supabase générés, `unknown` + guards, suppression du mock.

### MAINT-003 — Composants morts / champs inutilisés — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `data.kit.totalWeight` calculé mais jamais passé ; `data.randonnees` dérivé des jours ; `hikeSessionId`/`poiEvents` jamais affichés ; `RandonneesSouvenirCard` n'a pas de données propres ; `is_public` mort.
- **Constat :** dette, faux sentiment de fonctionnalité.
- **Correctif attendu :** supprimer ou brancher.

### MAINT-004 — Documentation existante non à jour — **P3**

- **Statut :** `[VÉRIFIÉ]`
- **Preuve :** `DESIGN_SYSTEM.md` dit `/materiel` source de vérité et `/compas` référence, alors que la page carnet utilise un shell `lkdv-social-detail` non documenté ; `docs/communaute` documente la refonte Communauté, pas la fiche carnet.
- **Constat :** la refonte n'a pas de spec dédiée.
- **Correctif attendu :** écrire la spec de la fiche carnet et l'ajouter au design system.

---

## 12. Priorités et plan de refonte

### 12.1 Priorités

| Priorité | Chantiers |
|---|---|
| **P0 — avant toute refonte visuelle** | 768 px ; XSS JSON-LD ; privé ; fausses certifications ; fausses stats ; like/comment factices |
| **P1 — avec la refonte** | Brancher `carnet_comments/likes/views/media` ; cover réelle ; images moments ; poids kit ; GPX ; auteur ; 404 ; erreurs ; a11y cibles/commentaire ; scroll clavier |
| **P2 — qualité** | Responsive tablette ; onglets URL ; plateau ; loading/404 design ; perf images/map ; SEO ; tests |
| **P3 — polish** | Typo, emojis, micro-copy, dette |

### 12.2 Phasage recommandé

1. **Socle données** : corriger `getCarnetComplet` (client serveur), supprimer les tables inexistantes, brancher comments/likes/views/media, supprimer les fallbacks faux, corriger les stats synthétiques.
2. **Socle sécurité** : JSON-LD, visibilité, upload IA, rate limit, CSP.
3. **Socle états** : 404 réel, error boundary, loading, auth gates, empty states.
4. **Coquille Communauté** : une colonne, header de post, cover, sections, barre basse, suppression des sidebars/plateau.
5. **Interactions** : like/save/share/commentaires réels, GPX conditionnel, carte lazy, kit persisté, species.
6. **A11y/perf/SEO** : cibles 44, contraste, clavier, images, bundle, JSON-LD, tests.
7. **Tests & budget** : unitaires, composants, e2e, visuel, a11y, perf.

### 12.3 Critères d'acceptation (à valider)

- 390/430/768/1024/1280/1440 sans overflow ni texte coupé.
- Un carnet public s'affiche sans session ; un carnet privé s'affiche pour son owner et renvoie 404 pour les autres.
- Like/commentaire/save persistent et sont idempotents ; compteurs réels.
- Aucun nom/avatar/chiffre/certification inventé.
- Cover réelle affichée ; fallback neutre.
- 0 bouton GPX actif sans trace.
- Champ commentaire lisible (contraste ≥ 4.5:1).
- Cibles ≥ 44×44 ; scroll clavier OK ; focus visible.
- LCP < 2,5 s sur 4G simulée ; JS route < 150 Ko gzip ; pas de Leaflet avant intersection.
- JSON-LD échappé ; 404 réel ; metadata correcte.
- Tests : transforms, actions, e2e public/privé/anonyme, visuel 3 tailles, a11y.

### 12.4 Questions ouvertes

1. **A ou B** (voir `08-contrat-refonte.md`).
2. Sections en flux ou onglets internes ?
3. Desktop 520–640 ou 720–860 ?
4. Périmètre : fiche seule, ou hub `/carnets` + `/clubs/[id]` ?
5. Les certifications sont-elles un vrai produit (badge `verified`) ou doivent-elles disparaître ?
6. Les commentaires doivent-ils être threaded (migration) ou plats (existant) ?
7. Les likes de carnet sont-ils des « réactions » (`carnet_likes.reaction`) ou des cœurs simples ?

---

## Annexes

### A. Journal des vérifications live

| Test | Résultat |
|---|---|
| `GET /carnets/6f39…` (public) | 200, rendu desktop/mobile |
| `GET /carnets/does-not-exist-xyz` | **200**, titre « Carnet introuvable », `noindex` |
| `GET /api/carnets/6f39…` | 200, 1 255 octets, carnet + 2 moments |
| `GET /api/carnets/does-not-exist` | 404, `{"error":"Carnet introuvable"}` |
| Clic like desktop | compteur 24→25, **aucune requête réseau** |
| Refresh après like | compteur revient à 24 |
| Clic commentaire desktop | bascule sur l'onglet « Moments », pas de sheet |
| Clic partage mobile | télécharge un JSON (code) |
| `PageDown` desktop | `scrollTop` du centre = 0 |
| 768 px | centre = 152 px |
| 1024 px | centre = 379 px |
| 1440 px | centre = 702 px, scroll interne 2 207 px |
| Champ commentaire | `color: #fff`, `background: #fff` |
| `prefers-color-scheme: light` | rendu identique (encre blanche) |
| Carnet « Chartreuse » | « Antoine Duprès », 3 jours à 9,1 km / 540 m, 24 likes, 2 commentaires |
| LCP mobile prod | 5 492 ms, élément cover Unsplash 1200 px |
| TTFB prod | 2 120–2 572 ms |
| JS route prod | 306 Ko gzip / 1 076 Ko raw |

### B. Requêtes DB utilisées (lecture seule)

- `information_schema.columns` / `tables`
- `pg_policies`, `pg_constraint`, `pg_indexes`
- `pg_class.reloptions` / `pg_get_viewdef` pour `public_profiles`
- Comptages `carnets`, `carnet_moments`, `carnet_kit_items`, `carnet_comments`, `carnet_likes`, `carnet_views`, `carnet_media`, `carnet_favorites`
- Détail du carnet `6f39f0d3-…`, du carnet `5f319c5d-…`

### C. Inventaire des tailles

| Fichier | Lignes |
|---|---:|
| `MobileCarnetDetailView.tsx` | 512 |
| `CommentsSheet.tsx` | 401 |
| `CarnetMap.tsx` | 244 |
| `CarnetHero.tsx` | 237 |
| `CarnetView.tsx` | 208 |
| `SpeciesIdentifier.tsx` | 192 |
| `KitSouvenirCard.tsx` | 137 |
| `MomentCard.tsx` | 127 |
| `CarnetDetailRightSidebar.tsx` | 119 |
| `LocalCarnetRenderer.tsx` | 116 |
| `CarnetDetailVerticalTabs.tsx` | 100 |
| `RandonneesSouvenirCard.tsx` | 60 |
| `TimelineJours.tsx` | 49 |
| `JourCard.tsx` | 44 |
| `StatsBar.tsx` | 38 |
| `HebergementCard.tsx` | 36 |
| `carnet.ts` | 277 |

### D. Limites

- Les constats de contraste sont des suspicions non mesurées au pixel.
- L'XSS JSON-LD est prouvée par le code, pas exploitée en live.
- Le carnet privé est prouvé par le chemin de code, pas par un test live (aucun carnet privé en base).
- Les mesures perf sont locales et non représentatives du CDN.
- Aucun test lecteur d'écran manuel.
