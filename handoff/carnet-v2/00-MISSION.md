# Mission : fiche carnet v2 (`/carnets/[id]`) — de la maquette à la production

**Agent :** Gemini 4 Argon sur Antigravity, en autonomie complète.
**Dépôt :** `TFaraciColbert59/kitduvoyageur_1783951966810` (Next.js 15, React 19, Supabase, Vercel, Capacitor iOS).
**Livrable :** la fiche carnet de la maquette `annexes/maquette-fiche-carnet.html`, en production sur Vercel, branchée sur les vraies données Supabase, installée sur l'iPhone de Tony via Xcode, utilisable par tous les utilisateurs.

---

## 1. Ce que tu dois faire, sans revenir vers Tony avant la fin

1. Lire ce dossier en entier, dans l'ordre du `README.md`, puis `CLAUDE.md`, `AGENTS.md`, `DESIGN_SYSTEM.md` à la racine du dépôt. Les règles de ces trois fichiers s'appliquent à toi comme à Claude.
2. Implémenter la fiche (`01-SPEC-PRODUIT.md`, `02-DESIGN-ET-COMPOSANTS.md`, `04-PLAN-IMPLEMENTATION.md`).
3. Écrire et appliquer les migrations Supabase (`03-DONNEES-SUPABASE.md`).
4. Faire passer toutes les portes qualité (`05-QUALITE-ET-TESTS.md`).
5. Livrer : PR, aperçu Vercel, fusion dans `main`, production Vercel, migrations en prod, app iOS sur l'iPhone (`06-DEPLOIEMENT.md`).
6. Dérouler la recette complète en production (`07-RECETTE.md`).
7. Écrire le rapport final `handoff/carnet-v2/RAPPORT.md` (modèle en fin de `07-RECETTE.md`) et **seulement ensuite** prévenir Tony.

Tu ne poses aucune question en cours de route. Quand un choix n'est pas tranché ici, tu prends l'option la plus sûre pour les données et les utilisateurs, tu l'écris dans `handoff/carnet-v2/JOURNAL.md` (date, décision, raison, alternative écartée) et tu continues.

## 2. Décisions déjà prises (ne pas rediscuter)

| Sujet | Décision |
|---|---|
| Référence de design | `/compte` à 100 % : gestes, animations, micro-animations, composants, tiroirs, sélecteurs, couleurs, polices, tailles. La maquette en est la traduction exacte ; en cas d'écart entre maquette et code réel de `/compte`, **le code de `/compte` gagne**. |
| Structure | 5 tiroirs (Fil de bord, Route, Sac, Chiffres, Équipage) = 5 slots de la capsule 56 px ; **18 sous-tiroirs** = lentilles (mini-capsule 30 px + LensPager). Liste exacte dans `01-SPEC-PRODUIT.md`. |
| Budget | Lentille 4 du tiroir Chiffres, masquée au visiteur. Pas de sixième tiroir. |
| J'aime et commentaires | Par jour, **dans un seul sous-tiroir « Réactions »** (Équipage). |
| Photos et moments | Ouvrent le composant post de `/compte` (identique : j'aime, commentaires, partage, options, gestes). |
| Avatar du carnet | Ouvre le visualiseur de stories de l'app (identique) ; répondre envoie un **message privé** à l'auteur du slide. |
| Participant | Ouvre sa fiche avec ses moments en grille de posts (identique à la grille du profil). |
| Nuits / refuges | Cliquables : focus carte (marqueur grossi + callout) et fiche empilée. |
| « Reprendre ce kit » | Pilule de verre 30 px en bas à gauche du tiroir Sac, icône signet. |
| Rôle visiteur | **Utilisateur connecté qui ne participe pas au carnet.** L'accès anonyme reste bloqué par `src/middleware.ts` (hors périmètre, voir § 5). |
| URL | Pas d'état écrit dans l'URL (comme `/compte`). Lecture unique d'un deep link d'entrée (`?jour=2&tiroir=route`) et conservation de `?commentaires=1`. |
| Thème | Clair comme `/compte` (seuls `--page/--on-page/--muted-page/--rule` changent en sombre). |
| Mise en production | Derrière le drapeau `NEXT_PUBLIC_CARNET_V2` (défaut `true` en prod à la fin). Le drapeau à `false` rétablit l'ancien `CarnetScreen` sans redéploiement de code. |

## 3. Garde-fous non négociables

Tu as le feu vert pour pousser sur `main`, déployer en prod et appliquer les migrations. En échange :

1. **Données de prod intouchables.** Migrations uniquement additives et idempotentes (`create table if not exists`, `add column if not exists`, `drop policy if exists` + `create policy`). Aucun `drop table`, `drop column`, `truncate`, `delete` ni `update` de masse. Aucun renommage de `carnet_*`, `hike_session_*`, `groupe_etapes`, `groupe_hebergements`. Chaque migration a son `.down.sql` dans `supabase/migrations_down/`.
2. **Sauvegarde avant migration prod** : déclenche le workflow `db-backup.yml` (ou équivalent documenté) et attends son succès avant d'appliquer quoi que ce soit en prod.
3. **RLS d'abord.** Chaque nouvelle table : RLS activée dans la même migration, politiques écrites, tests pgTAP (`supabase/tests/`) qui prouvent qu'un visiteur ne lit pas un carnet privé, ne voit pas la position exacte, ne voit pas le budget, et ne peut écrire qu'en son nom. Relis la politique SELECT **effective** de `carnets` en base avant d'écrire la tienne.
4. **Portes qualité vertes avant chaque push sur `main`** : `npx tsc --noEmit -p .`, `npm run lint` (0 erreur), `npm test`, `npm run build`, `npm run perf:budget`, `npm run verify:invariants`, `npm run verify:icons`, `npm run test:a11y` (0 critical/serious), `npx vitest run tests/design/unification.spec.ts`, les nouveaux e2e Playwright de la fiche. Jamais de test désactivé, jamais de `--no-verify`, jamais de `@ts-ignore` / `eslint-disable` ajoutés pour passer.
5. **Aperçu avant prod.** La PR doit avoir un déploiement d'aperçu Vercel vert, recetté (`07-RECETTE.md` § A) avant la fusion.
6. **Pas de force push, pas de réécriture d'historique de `main`, pas de `git stash` nu.**
7. **Secrets** : jamais dans le code, les logs, les commits ou le rapport. Tu utilises ceux déjà configurés (Vercel, Supabase, Apple). S'il en manque un, tu le notes dans le rapport et tu termines tout le reste.
8. **Aucun message envoyé à de vrais utilisateurs** pendant les tests en prod : utilise les comptes de démo (`DEMO_LOGIN_EMAIL`) et un carnet de test que tu crées puis passes en privé.

## 4. Seuls cas où tu t'arrêtes avant la fin

Tu t'arrêtes (en laissant tout dans un état propre et documenté) uniquement si :
- un accès indispensable manque (Vercel, Supabase prod, compte Apple, iPhone non branché ou verrouillé) **après** avoir terminé tout ce qui n'en dépend pas ;
- une migration échoue en prod : tu exécutes immédiatement son `.down.sql`, tu vérifies l'intégrité, tu repasses le drapeau à `false` si nécessaire, tu documentes ;
- la prod régresse (erreurs 5xx, page blanche, Sentry/console en rouge) : rollback Vercel immédiat (`vercel rollback` ou « Promote » du déploiement précédent), drapeau à `false`, documentation.

Dans ces trois cas, le rapport final dit précisément ce qui est fait, ce qui reste, et la commande exacte pour reprendre.

## 5. Hors périmètre

- Accès anonyme aux carnets publics (middleware) : ne pas toucher. Le noter comme suite possible dans le rapport.
- Création de carnet, hub `/carnets`, cartes de carnet dans la communauté : ne rien casser, ne rien refondre.
- Refonte de `/compte` ou du Compas.
- Changement de fournisseur de carte, d'auth, de paiement.

## 6. Définition de « fini »

- La fiche en prod est conforme à la maquette et au code de `/compte` (captures comparées, `07-RECETTE.md`).
- Toutes les données affichées sont réelles (aucune donnée de démo codée en dur hors mode démo existant).
- Participant et visiteur se comportent comme spécifié, prouvé par tests (unitaires, pgTAP, e2e).
- 0 erreur console, 0 débordement horizontal à 360/390/430 px, Lighthouse/perf budget dans les seuils du dépôt, a11y sans critical/serious.
- L'app iOS installée sur l'iPhone ouvre la fiche, gestes et haptique fonctionnels.
- `RAPPORT.md` et `JOURNAL.md` complets, PR fusionnée, `main` vert en CI.
