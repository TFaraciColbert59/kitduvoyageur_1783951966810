# Audit complet — page d'un carnet (`/carnets/[id]`)

**Date :** 24 octobre 2026
**Repo audité :** `/Users/fr168256/Desktop/lkdv-communaute-feed` — worktree git, branche `chantier/post-system`
**Référence de style :** `/communaute` refondue (feed plein écran, colonne 430–520 px, verre clair, pastille auteur, capsule d'actions, barre basse Compte)
**Périmètre :** fiche d'un carnet, du rendu serveur au dernier bouton, desktop et mobile, données, RLS, API, sécurité, performance, accessibilité, SEO, tests, contenu.
**Méthode :** lecture du code, requêtes Supabase en lecture seule, rendu réel sur `http://127.0.0.1:4015`, captures 1440/1024/768/430, mesures DOM et réseau, recoupement avec les specs et la base live.
**Statut :** audit terminé, **aucune ligne de code applicatif modifiée**.

> **Mise à jour — 24 octobre 2026, 12 h :** la direction visuelle est verrouillée par `11-disposition-compte-carnet.md` (disposition) et `10-spec-visuelle-carnet.md` (composants, drawers, typographie). La référence unique est le Compte (bottom bar, drawer Profil, sous-drawers) + la Communauté (fil, posts, drawer post, création, boutons de top page). La spec fixe une seule colonne 520, une seule police, un seul sélecteur, un seul bouton et le détail de chaque drawer.

---

## 1. Verdict en une phrase

La fiche carnet est **une belle maquette éditoriale, mais pas un produit fiable** : elle fabrique des chiffres, des auteurs, des certifications et des interactions, elle casse à 768 px, elle n'utilise ni les tables d'engagement ni le cover image réels, et elle est structurellement à l'opposé du style Communauté qu'on veut désormais appliquer.

La refonte n'est donc pas un « relooking » : c'est une **remise à niveau données + interactions + responsive + design system**, puis une réécriture de la coquille en style Communauté.

---

## 2. Ce qui est vérifié, en chiffres

| Preuve | Valeur |
|---|---|
| Carnets en base | 82, tous `public` |
| Carnets sans auteur (`author_id` null) | 3 |
| Carnets avec `groupe_id` | 1 — dont les tables `groupe_etapes` / `groupe_hebergements` **n'existent pas** |
| Moments | 228, dont 35 sans image et 39 sans auteur |
| Kit items | 223 |
| Commentaires réels (`carnet_comments`) | 130 |
| Likes réels (`carnet_likes`) | 596 |
| Vues réelles (`carnet_views`) | 2 320 |
| Médias réels (`carnet_media`) | 258 |
| Carnet de test « Tour du Mont-Blanc » | 6 likes, 3 commentaires, 6 médias, 47 vues en base — **24 likes et 8 commentaires affichés** |
| Largeur du centre à 768 px | **152 px** (capture `evidence/carnet-768.png`) |
| Transfert JS production | ~821 Ko (build `.next-post-build`, port 4014) |
| TTFB production local | ~2,1 s |
| Cibles tactiles < 44 px | like 36 px, save/share 36 px, zoom carte 24 px, chips 32 px |
| Tests dédiés à la fiche carnet | **0** (878 fichiers de test, aucun sur `/carnets/[id]`) |
| Erreurs console live | HMR uniquement en dev ; aucune erreur métier visible, car les erreurs sont avalées |

---

## 3. Les 20 constats qui commandent la refonte

| # | Sévérité | Constat | Preuve |
|---|---|---|---|
| 1 | **P0** | À 768 px, le layout desktop 3 colonnes compresse le centre à **152 px** : titre cassé, contenu illisible, sidebars qui écrasent tout. | `CarnetView.tsx:78-79`; `evidence/carnet-768.png`; mesure DOM |
| 2 | **P0** | Toute fiche affiche « Expédition Certifiée », « Récit Vérifié », « Certifié LKDV », « Membre Explorateur / Guide Certifié » même quand `carnets.verified = false`. | `CarnetHero.tsx:170-180`; `CarnetDetailRightSidebar.tsx:36-55`; base : `verified=false` sur le carnet test |
| 3 | **P0** | Likes et commentaires fabriqués : 24/8 sur desktop, 24/2 sur mobile, alors que la base contient 6 likes et 3 commentaires. Aucun like n'est écrit ; ajouter un commentaire ne fait aucun appel réseau. | `CarnetHero.tsx:37-38,72-81`; `MobileCarnetDetailView.tsx:32-50,71-74,94-126`; réseau live |
| 4 | **P0** | Statistiques d'étape inventées : sans `groupe_etapes`, la distance et le dénivelé totaux sont **divisés par le nombre de jours** (106/2 = 53 km, 2002/2 = 1 001 m), et le même lieu est répété départ/arrivée. | `carnet.ts:110-140`; live « Chartreuse » : 27,4/3 = 9,1 km, 1 620/3 = 540 m |
| 5 | **P0** | Un carnet privé ne peut pas s'afficher pour son propriétaire : le Server Component appelle `getCarnetComplet()` qui utilise le client Supabase **navigateur** (`createClient` de `lib/supabase/client`), donc sans cookies de session côté serveur. La RLS voit un anonyme. | `carnet.ts:1,15`; `page.tsx:87-90`; `lib/supabase/client.ts` |
| 6 | **P0** | XSS stockée via le JSON-LD : `title` et `description` sont injectés dans `dangerouslySetInnerHTML` sans échapper `</script>`. Un auteur peut casser la balise. Le repo sait pourtant le faire ailleurs. | `page.tsx:110-123`; comparer `voyages/[slug]/page.tsx:99` |
| 7 | **P1** | Auteur fictif : « Antoine Duprès » / « Marie Dupont » et avatars Unsplash quand `author_id` est null ou que le profil n'est pas lisible. La fiche « Chartreuse » affiche « Antoine Duprès » alors que la base n'a **aucun auteur**. | `carnet.ts:250-251`; `MobileCarnetDetailView.tsx:217`; live |
| 8 | **P1** | La couverture réelle du carnet n'est **jamais** affichée : `cover_image` n'est pas mappé dans `CarnetData`, le desktop utilise le fond global, le mobile retombe sur une photo Unsplash. | `carnet.ts` retour `meta`; `MobileCarnetDetailView.tsx:88-90` |
| 9 | **P1** | Les tables d'engagement existent mais ne sont pas branchées : `carnet_comments`, `carnet_likes`, `carnet_views`, `carnet_media` (130 / 596 / 2 320 / 258 lignes). Le hub `/carnets` les utilise déjà. | base; `src/app/carnets/page.tsx:276-320,690-810`; détail : aucune requête |
| 10 | **P1** | Les images réelles des moments sont ignorées : `imageUrl` est bien récupéré puis remplacé par `PHOTO_MAP` ou une photo générique. | `carnet.ts:186`; `MomentCard.tsx:14-26` |
| 11 | **P1** | Likes de moments aléatoires (`Math.random()`), donc différents à chaque rendu et potentiellement en hydration mismatch. | `MomentCard.tsx:23` |
| 12 | **P1** | Poids du kit codé en dur « 4.8 kg », y compris avec 0 article ; le poids calculé (`data.kit.totalWeight`) n'est jamais passé au composant. | `KitSouvenirCard.tsx:48`; `carnet.ts:206-210` |
| 13 | **P1** | « Randonnées parcourues » est dérivé des jours, pas des sorties ; texte « Trois traces » codé en dur ; chaque bouton GPX télécharge un fichier **vide**. | `RandonneesSouvenirCard.tsx:10-11,30`; `CarnetView.tsx:22-38` |
| 14 | **P1** | Le bouton commentaire desktop n'ouvre pas les commentaires : il bascule sur l'onglet « Moments ». | `CarnetView.tsx:104` |
| 15 | **P1** | Sur mobile, like / save / commentaire fonctionnent **sans session**, affichent un toast de succès, et ne persistent rien. | `MobileCarnetDetailView.tsx:94-126` |
| 16 | **P1** | Champ de commentaire illisible : texte et placeholder blancs sur fond blanc dans la feuille. | `CommentsSheet.tsx:125`; computed live `color: rgb(255,255,255)`, `background: rgb(255,255,255)` |
| 17 | **P1** | Le contenu desktop ne se scrolle pas au clavier : `PageDown` avec le focus sur `body` laisse le conteneur à `scrollTop=0`. | live; `CarnetView.tsx:95` (conteneur `overflow-y-auto` sans `tabIndex`) |
| 18 | **P1** | Cibles tactiles sous 44 px : actions 36 px, zoom carte 24 px, chips 32 px, GPX 36 px. | live; `MobileCarnetDetailView.tsx:228-290`; `CarnetMap.tsx` |
| 19 | **P1** | Toute erreur Supabase est avalée : `getCarnetComplet` retourne `null`, ce qui devient « brouillon local » ou « carnet introuvable ». L'`error.tsx` ne se déclenche jamais. | `carnet.ts:273-275`; `page.tsx:87-90`; `error.tsx` |
| 20 | **P1** | URL invalide = HTTP **200** avec `noindex` et un écran « Carnet introuvable » ; peut aussi rendre un brouillon `localStorage`. Pas de vrai 404. | `curl` 200; `LocalCarnetRenderer.tsx:22,87`; `page.tsx:87-90` |

---

## 4. Scorecard

| Axe | Note | Justification |
|---|---:|---|
| Architecture de rendu | 3/10 | Double arbre desktop/mobile, client boundary total, layout partagé avec `/clubs/[id]`, scroll interne, fallback local |
| Données / BDD / RLS | 3/10 | Tables réelles ignorées, tables référencées inexistantes, compteurs faux, données synthétiques non étiquetées |
| API / auth / sécurité | 5/10 | Routes courtes et RLS solides, mais JSON-LD XSS, upload IA non borné, visibilité implicite, pas de rate limit sur le GET |
| Fonctionnel | 3/10 | Like/comment/save/partage incohérents entre desktop et mobile ; commentaires desktop inexistants ; GPX vide |
| Visuel | 3/10 | Identité forte mais hors style Communauté ; 768 cassé ; faux badges ; surcharge de capsules, emojis et fallbacks |
| Performance | 4/10 | 821 Ko de JS, 333 Ko de CSS, map sous la ligne de flottaison chargée d'emblée, images non optimisées |
| Accessibilité | 3/10 | Champ invisible, cibles < 44, scroll clavier impossible, hiérarchie de titres, contrastes sur photo |
| SEO | 5/10 | Metadata et canonical corrects, mais soft 404, JSON-LD non échappé, image et auteur schema faux |
| Tests | 1/10 | Aucun test de la fiche, aucun test des interactions, aucun test visuel de cette route |
| Contenu / confiance | 2/10 | Certifications, chiffres et auteurs faux ; promesse « zéro mock » contredite |

---

## 5. Direction de refonte recommandée (à valider)

**Principe :** faire de la fiche carnet un **objet social de la Communauté**, pas une page éditoriale à sidebars.

- **Une seule colonne** de 430–520 px sur mobile, 520–640 px sur desktop, centrée, fond global.
- **Un en-tête de post** : pastille auteur (avatar + nom + handle), menu `···`, actions capsule (like, commentaire, partage, favori), compteurs réels.
- **Une couverture réelle** en 4:5 ou 1:1, avec fallback propre si absente — pas de photo générique.
- **Un corps de carnet** en cartes verre empilées : récit, étapes, carte, moments, kit, faune/flore.
- **Des sections navigables** sans double barre : onglets internes discrets ou ancres, pas de `NavigationPlateau` + barre basse qui empilent 102 px.
- **Les vraies données** : `carnet_comments`, `carnet_likes`, `carnet_views`, `carnet_media`, `carnet_favorites`, `verified`, `cover_image`.
- **Les vrais états** : vide, non connecté, privé, erreur, chargement, hors ligne.
- **Le même langage visuel que `/communaute`** : verre clair, encre forest, rayons 28, capsules, typographie SF/Inter + serif éditorial pour les citations, zéro certification inventée.

Deux variantes sont détaillées dans `08-contrat-refonte.md` :
- **A. « Carnet social »** — fidèle à Communauté, une colonne, feed-like.
- **B. « Carnet éditorial augmenté »** — une colonne plus large, mêmes matériaux, plus de place pour la carte et les étapes.

---

## 6. Décision demandée

La disposition est prête : **shell et carte d’identité du Compte**, cover **1:1** dans la carte, grille 3 colonnes, capsule 48, bottom bar du Compte, drawer Profil. Les commentaires sont en **sheet**.

Il reste une seule validation : **tu valides cette disposition avant que je passe au plan d’implémentation ?** Je ne toucherai au code qu’après ton go.
