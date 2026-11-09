# Mission : tiroirs de la Communauté v2 (Explorer + Création) — de la maquette à la production

**Agent :** Gemini 4 Argon sur Antigravity, en autonomie complète.
**Dépôt :** `TFaraciColbert59/kitduvoyageur_1783951966810` (Next.js 15, React 19, Supabase, Vercel, Capacitor iOS).
**Livrable :** les deux tiroirs de `/communaute` de la maquette `annexes/maquette-communaute.html` — **Explorer** (Recherche, Carnets, Clubs, Sorties) et **Création** (Publication, Story, Carnet, Sortie, Kit, Club) — en production sur Vercel, branchés sur les vraies données Supabase, installés sur l'iPhone de Tony via Xcode, utilisables par tous les utilisateurs.

---

## 1. Ce que tu dois faire, sans revenir vers Tony avant la fin

1. Lire ce dossier en entier dans l'ordre du `README.md`, puis `CLAUDE.md`, `AGENTS.md`, `DESIGN_SYSTEM.md` à la racine du dépôt. Leurs règles s'appliquent à toi.
2. Ouvrir la maquette dans Chrome (fichier local) et la manipuler entièrement, panneau démo compris : c'est la référence visuelle et comportementale.
3. Implémenter les deux tiroirs (`01`, `02`, `04`).
4. Écrire et appliquer les migrations Supabase (`03`).
5. Faire passer toutes les portes qualité (`05`).
6. Livrer : PR, aperçu Vercel, fusion dans `main`, production, migrations en prod, app iOS sur l'iPhone (`06`).
7. Dérouler la recette complète (`07`).
8. Écrire `handoff/communaute-v2/RAPPORT.md` (modèle en fin de `07`) et **seulement ensuite** prévenir Tony.

Tu ne poses aucune question en cours de route. Quand un choix n'est pas tranché ici, prends l'option la plus sûre pour les données et les utilisateurs, écris-la dans `handoff/communaute-v2/JOURNAL.md` (date, décision, raison, alternative écartée) et continue.

## 2. Prérequis : le chantier carnet-v2

Ce chantier suit `handoff/carnet-v2/`. Avant de commencer :
- si `handoff/carnet-v2/RAPPORT.md` existe avec le statut TERMINÉ et que `main` contient ses migrations : pars de `main` à jour ;
- sinon : `carnet_moments` et `carnet_media` existent déjà en prod (baseline) ; seule `carnet_nights` vient de carnet-v2 (`20261108100004_*` ; le dernier fichier du dépôt au moment de la rédaction est `20261108100005_carnet_v2_lot_e_kit_forks.sql`). `create_carnet_v2` écrit toujours carnet, moments et médias, et n'écrit les nuits que si `to_regclass('public.carnet_nights') is not null` (l'étape « nuits » est masquée sinon). Ne crée ni n'applique **pas** toi-même les migrations carnet-v2 : elles appartiennent à ce chantier. Note l'état constaté dans le journal.
- Ne touche pas à la fiche carnet (`/carnets/[id]`) dans cette PR (d'où le report de Carnets#13, `01` § 6).

## 3. Décisions déjà prises (ne pas rediscuter)

| Sujet | Décision |
|---|---|
| Référence de design | `/compte` à 100 % : gestes, animations, micro-animations, composants, tiroirs, sous-tiroirs, sélecteurs (placement et fonctionnement), couleurs, polices, tailles. La maquette en est la traduction ; **en cas d'écart entre maquette et code réel de `/compte`, le code de `/compte` gagne**, sauf pour les points listés dans ce tableau. |
| Teintes | **Uniquement des verts** de la palette (forêt, sauge, mousse, menthe…) via jetons. Aucune teinte jaune, ocre, terre cuite ou bleu-gris, ni pour les types (Publications, Carnets, Clubs, Sorties, Membres) ni ailleurs. Le rouge du jeton danger reste réservé aux erreurs et à la suppression. Les teintes littérales actuelles (`#8A6A2F`, `#3D6F63`, `#A05A3C`, `#4B6B7C`) disparaissent. |
| Coque | Une seule coque, celle de `/compte` (`SlotShell` + `DrawerShell` + `LensPager` + pile `OverlaySheet`). `CommunityDrawer` n'est plus utilisé par la V2. |
| Voile | **Pas de voile**, comme `/compte` : le fond est `inert`, on ferme par la poignée, Échap ou le bouton de fermeture, pas au tap hors du tiroir. (L'option « Voile (comparer) » de la maquette n'est qu'un outil de démo.) |
| Navigation | Capsule 56 px = volet (Explorer) ou type (Création). Mini-capsule 30 px en bas à droite = filtre (Explorer) ou étape (Création). Glisser horizontal = LensPager entre filtres, qui suit le doigt. Détails empilés avec ‹ Retour. |
| Tri | **Pas de rangée « Trier » dans le contenu.** Un bouton rond de 30 px, en verre, placé **tout à droite de la mini-capsule du bas** (même ligne, même matériau), ouvre un petit menu (`role=menu`, options `menuitemradio`, coche sur l'option active). Volets Carnets (Récents, Populaires, Proches, Durée) et Clubs (Activité récente, Proches, Taille) uniquement. Un point vert sur le bouton signale un tri autre que celui par défaut. Échap ferme le menu seul (pas le tiroir), clic extérieur ferme, ↑ ↓ naviguent, Tab ferme. Masqué quand un détail est empilé. Voir la maquette (`#sortbtn`, `#sortmenu`). |
| Formulaires | Un seul moteur pour les 6 types : étapes dans la mini-capsule, **Suivant et Retour visibles**, libellés visibles (600, 10 px, majuscules), champs en 16 px de 44 à 48 px, chaque erreur affichée **une seule fois**, sous son champ (en tête, seulement un compteur « 2 champs à corriger » qui amène le focus, sans répéter les messages), aperçu vivant en tête, brouillon partout avec bandeau « Brouillon restauré · Effacer », confirmation de fermeture si saisie, clavier géré par `visualViewport`. |
| Carnet (création) | Passe sur le moteur commun (étapes Infos, Tracé, Jours, Partage), brouillon compris. Les photos des moments sont **réellement téléversées** ; la couverture est choisie parmi elles ; la visibilité est un vrai champ (Privé par défaut, comme en base). |
| Écritures multiples | Toute création qui touche plusieurs tables passe par **une RPC atomique** (club + admin, sortie + post d'annonce, adhésion + compteur). Plus aucune séquence d'inserts côté client sans retour arrière. |
| Liens profonds | Membre → `/profil/<handle>` (repli id), sortie → sa fiche (créer la route `/sorties/[id]` si elle n'existe pas, voir `01` § 4.4), carnet → `/carnets/<id>`, club → `/clubs/<slug>`. |
| URL | Comme `/compte` : pas d'état écrit dans l'URL. Les déclencheurs existants restent (barre haute, loupe, `+`, `+` des stories). |
| Clubs : adhésion | `privacy` porte l'adhésion : `open` = Ouvert, `closed` = Sur validation. Les demandes sont réellement traitables : le détail de club V2 affiche aux admins et modérateurs une pile « Demandes (n) » (accepter / refuser via `review_join_request`). « Secret » et « Privé » comme visibilité (Club#10) sont reportés (`01` § 6). |
| Kits : visibilité | Public / Privé (`is_public`). « Amis » reporté. |
| Mise en production | Derrière le drapeau `NEXT_PUBLIC_COMMUNAUTE_V2` (Preview `true`, Production `true` à la fin). À `false`, les tiroirs actuels reviennent sans redéploiement de code (seulement un redéploiement pour la variable). |

## 4. Garde-fous non négociables

Tu as le feu vert pour pousser sur `main`, déployer en prod et appliquer les migrations. En échange :

1. **Données de prod intouchables.** Migrations uniquement additives et idempotentes (`create table if not exists`, `add column if not exists`, `create or replace function`, `drop policy if exists` + `create policy`). Aucun `drop table`, `drop column`, `truncate`, `delete` ou `update` de masse. Chaque migration a son `.down.sql` dans `supabase/migrations_down/`.
2. **Sauvegarde avant migration prod** : workflow `db-backup.yml` déclenché et réussi avant d'appliquer quoi que ce soit.
3. **RLS d'abord.** Toute RPC `security definer` vérifie elle-même `auth.uid()` et les droits ; `set search_path = public` ; `revoke execute ... from public` puis `grant ... to authenticated`. Seule exception : les RPC de **lecture** en `security invoker` (recherche, feeds, agenda, `check_club_slug`) sont aussi accordées à `anon` (l'invité lit l'Explorer) ; la RLS des tables s'y applique, et un test pgTAP prouve « anon lit, anon n'écrit pas ». Tests pgTAP qui prouvent : pas d'adhésion au nom d'un autre, pas de double adhésion, compteur juste, pas de lecture d'un club secret ou d'une sortie privée par un non-membre, recherche limitée à ce que l'appelant peut lire.
4. **Portes qualité vertes avant chaque push sur `main`** (liste exacte en `05`). Jamais de test désactivé, de `--no-verify`, de `@ts-ignore` ou `eslint-disable` ajoutés pour passer.
5. **Aperçu avant prod** : déploiement d'aperçu Vercel vert et recetté (`07` § A) avant la fusion.
6. Pas de force push, pas de réécriture d'historique de `main`, pas de `git stash` nu.
7. **Secrets** : jamais dans le code, les logs, les commits ou le rapport. S'il en manque un, note-le et termine tout le reste.
8. **Aucun contenu ni message visible par de vrais utilisateurs**, en prod **et en aperçu** (l'aperçu écrit dans la base de prod) : comptes de démo (`DEMO_LOGIN_EMAIL`) uniquement. Ce que la base permet de cacher : story « Moi uniquement » (`only_me`), carnet privé, kit privé, post en audience `abonnies` depuis un compte de démo **sans abonnés** (vérifie-le avant). Ce qu'elle ne permet pas de cacher (sorties `events`, clubs : lecture publique) : **ne les crée jamais sur la base réelle** ; leur création se recette sur une base locale (`supabase start`) ou une branche Supabase, et en e2e CI. Tout contenu de recette créé en prod est supprimé par son auteur via l'UI à la fin. Aucune invitation, demande d'adhésion ni inscription à une sortie d'un vrai utilisateur.
9. **Non-régression** : le fil, les stories, `/compte`, `/messagerie`, la fiche carnet, `/clubs/[id]`, `/communaute?tab=evenements` ne changent pas de comportement.

## 5. Seuls cas où tu t'arrêtes avant la fin

- Un accès indispensable manque (Vercel, Supabase prod, compte Apple, iPhone non branché ou verrouillé) **après** avoir terminé tout ce qui n'en dépend pas.
- Une migration échoue en prod : exécute immédiatement son `.down.sql`, vérifie l'intégrité, repasse le drapeau à `false` si besoin, documente.
- La prod régresse (5xx, page blanche, erreurs console ou CSP) : rollback Vercel immédiat, drapeau à `false`, documentation.

Dans ces trois cas, le rapport dit ce qui est fait, ce qui reste et la commande exacte pour reprendre.

## 6. Hors périmètre

- Carte `/explorer` et son tiroir (autre chantier, ne pas toucher).
- Fiche carnet `/carnets/[id]` (chantier carnet-v2), page club `src/app/clubs/[id]` (résout aussi le slug) et onglet `/communaute?tab=evenements` : seulement les liens vers eux, pas de refonte.
- Composant post du fil : réutilisé tel quel (d'où le report de Publication#11, #13, #14).
- Visualiseur de stories : modifiable **uniquement** pour lire `trim_start_ms`/`trim_end_ms`, afficher le lien vers un carnet aux lecteurs qui peuvent le voir, et offrir le mode composition de l'éditeur ; ces trois cas entrent dans la non-régression des stories.
- Notifications push, paiement des sorties, TestFlight.

## 7. Définition de « fini »

- Les deux tiroirs en prod sont conformes à la maquette et au code de `/compte` (captures comparées, `07`).
- Les 200 améliorations du document (`annexes/D-document-refonte.md`) sont faites, **sauf** celles listées « reportées » en `01` § 6 ; toute autre non faite est justifiée dans le rapport.
- Les 6 formulaires créent de vraies données, atomiquement, avec brouillon, erreurs une seule fois, clavier géré ; testé en e2e.
- Toutes les données affichées sont réelles (aucune donnée de démo codée en dur).
- 0 erreur console, 0 débordement horizontal à 360/390/430 px, perf budget respecté, a11y sans critical/serious.
- L'app iOS ouvre les deux tiroirs ; gestes, haptique, clavier et caméra fonctionnent.
- `RAPPORT.md` et `JOURNAL.md` complets, PR fusionnée, `main` vert en CI.
