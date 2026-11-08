# Brief d'équipe — chantier Communauté v2

Document de coordination interne à l'équipe d'implémentation. Il ne remplace pas le bundle :
les fichiers `00` à `07` et les annexes font foi. En cas de contradiction, le bundle gagne et le
Lead arbitre. Toute décision prise sans arbitrage va dans `handoff/communaute-v2/JOURNAL.md`.

## 0. Où on travaille

- Worktree dédié : `/Users/fr168256/Documents/deepseek-harness/default-workspace/lkdv-communaute-v2`
  (branche `feat/communaute-v2`, partie de `origin/main` = `08993b8`). **Ne jamais travailler dans
  `kitduvoyageur_1783951966810`** (checkout sale d'un autre chantier).
- Dépôt GitHub : `TFaraciColbert59/kitduvoyageur_1783951966810`. Ne pas pousser `main` :
  le Lead s'occupe de la PR, de la fusion, du déploiement, des migrations de prod et de l'iPhone.
- Node 26 / npm 11, dépendances installées (`node_modules` présent). Playwright : les navigateurs
  sont dans le cache utilisateur.
- Rien n'existe encore côté v2 : le code v1 (`src/features/community/{sections,create,feed}`) reste
  monté derrière le drapeau `NEXT_PUBLIC_COMMUNAUTE_V2` et ne doit pas changer de comportement.

## 1. Ordre de lecture (obligatoire, avant d'écrire du code)

1. `handoff/communaute-v2/README.md` puis `00` → `07-SPEC` dans l'ordre.
2. Annexes : `D` (200 améliorations = la loi du contenu), `H` (existant + 34 écarts),
   `J` (schéma/écritures), `A`/`B`/`C` (système `/compte`).
3. `CLAUDE.md`, `AGENTS.md`, `DESIGN_SYSTEM.md` à la racine.
4. La maquette : `http://127.0.0.1:8765/maquette-communaute.html` (serveur local déjà lancé,
   `python3 -m http.server 8765` dans `annexes/`). Panneau démo à droite : rôle, volets, types,
   états, options. Captures de repérage : `../audit-communaute-v2/maquette/*.png` dans le
   workspace DSH (`/Users/fr168256/Documents/deepseek-harness/default-workspace/audit-communaute-v2/`).
   Manipuler réellement (capsule, mini-capsule, tri, peek, étapes, erreurs) avant de coder.
5. Code réel `/compte` (priorité absolue sur la maquette en cas d'écart) :
   `src/components/compte/drawer/**`, `src/components/compte/overlay/**`,
   `src/components/ui/drawer/**`, `src/components/ui/CapsuleTabs.tsx`,
   `src/components/compte/compte-apple-hig.css`, `src/components/compte/compte-v8.css`,
   `src/styles/{tokens,liquid-capsules,liquid-selectors,drawer-selectors-tabbar}.css`.

## 2. Règles dures (rappeld du `00-MISSION.md` § 4)

- Migrations additives/idempotentes uniquement, chacune avec son `.down.sql`. Aucun `drop table`,
  `drop column`, `truncate`, `delete`/`update` de masse. Jamais de pgTAP contre la prod.
- RPC `security definer` : `auth.uid()` vérifié, `set search_path = public`, `revoke … from public`
  puis `grant … to authenticated` ; les RPC de lecture `security invoker` sont aussi données à `anon`.
- Aucune couleur littérale hors `tokens.css` (garde `tests/design/unification.spec.ts`), uniquement
  des verts ; rouges réservés aux erreurs/suppression. Aucune police hors jetons.
- 0 erreur console, 0 débordement à 360/390/430, cibles ≥ 44 px, `prefers-reduced-motion` partout,
  libellés visibles, champs 16 px, une erreur affichée une fois.
- Aucun contenu visible par de vrais utilisateurs (aperçu et prod écrivent dans la base de prod) :
  comptes de démo uniquement, story `only_me`, carnet/kit privés, jamais de sortie ni de club réels.
- Tests : réseau interdit en vitest (`npm test`). E2E sur base de test/preview uniquement.
- Ne pas modifier `.env.example`, `tsconfig.json`, les scripts `dev`/`build`.
- Ne pas créer de second post, visualiseur de stories, carte, ni toucher `/carnets/[id]`,
  `src/app/clubs/[id]`, `/communaute?tab=evenements`, `/explorer`.
- Ne pas supprimer les tiroirs v1 dans cette PR (hors `CarnetCreateForm.tsx` orphelin).

## 3. État de la base de prod constaté le 2026-11-08 (audité en lecture seule)

- Projet `icxyvwzfjbflcbqukpfz`, Postgres 17, extensions `postgis`, `pg_trgm` (schéma `public`),
  `unaccent` (public), `pg_cron`, `pgcrypto`. `public.unaccent_lower(text)` existe.
- **Le registre `supabase_migrations.schema_migrations` (377 lignes) est en retard sur le dépôt** :
  dernière version = `20261108000000`. Absents notamment : tout `20261022*`, `20261023*`, `20261024*`,
  `20261025*`, `20261026130000_creation_meta`, `20261028160000_community_search_and_club_counts`,
  `20261029120000`, `20261031200000/210000/215000/220000`, et les 5 migrations carnet-v2
  `20261108100001..000005`. Conséquences vérifiées en base :
  - `public.carnet_nights` **n'existe pas** ⇒ le formulaire Carnet et `create_carnet_v2` masquent les
    nuits si `to_regclass('public.carnet_nights') is null` (déjà prévu par le bundle). Ne pas créer
    cette table (elle appartient à carnet-v2).
  - `community_posts.creation_meta` **n'existe pas** ⇒ l'ajouter en `add column if not exists` dans
    notre lot E (idempotent, additif).
  - `clubs.rules` **n'existe pas** (le formulaire v1 écrit dedans : la création v1 est donc cassée en
    prod, ne pas s'en inspirer) ⇒ notre lot D la crée.
  - `clubs.privacy` : valeurs observées `open` (23) et `secret` (15) seulement — pas de `closed` ⇒
    la contrainte `clubs_privacy_check (open,closed,secret)` peut être posée sans risque.
  - Les triggers de compteurs de la migration `20261028160000` (membres de club) **ne sont pas en
    prod** : nos RPC d'adhésion mettent `members_count` à jour elles-mêmes (recount) ; plus tard, le
    trigger d'un autre chantier recalculera sans double comptage.
  - `community_posts` n'a pas `place_label`/`place_geom`/`tags` ; `post_stories` n'a pas `trim_*` ni
    `linked_carnet_id` ni `alt_text` ; `events` n'a aucune des colonnes du lot C ; `carnets` n'a pas
    `start_geom` ; `clubs` n'a pas `zone_geom` ; `event_participants` n'a pas `status` ; les RPC
    `community_search*`, `*_feed`, `join_club`, `review_join_request`, `create_*`, `check_club_slug`
    n'existent pas encore. Toute migration doit être écrite pour cet état réel, avec
    `if not exists`/`or replace` partout.
  - Existent déjà en prod (ne pas recréer) : `join_event`, `leave_event`, `replace_kit_items`,
    `is_club_member`, `can_view_story`, `toggle_community_post_like`, `current_feature_flags`.
- Outillage machine : **pas de `gh`, `vercel`, `supabase`, `psql`, ni Docker/Postgres local**.
  - GitHub : jeton dans le trousseau (`git credential fill`), API REST utilisable par `curl`.
  - Supabase : outil MCP `mcp__supabase__*` (SQL prod en lecture/écriture) — c'est le seul canal DB.
  - Vercel : outil MCP `mcp__vercel__*`.
  - pgTAP : **uniquement en CI** (`database-gates` sur la PR) : pas de Postgres local. Écrire les
    tests pour rejouer les migrations depuis la CI éphémère ; itérer par pushes sur la branche.
- CI de `main` au départ : `LKDV Unified Quality Gates` vert ; `Visual Regression — Shell Mobile`
  déjà rouge (pré-existant) ; `ops-alerts` (« Alerte du rapport quotidien ») déjà rouge.
  Nos portes = `quality-gates` + `database-gates` verts sur la PR (le visuel ne sera vert que si
  nos specs visual et les références sont propres).

## 4. Architecture cible (créée par le Lead, sauf mention)

Tout le code v2 vit sous `src/features/community/v2/` + styles `src/styles/communaute-v2.css`
(classe racine `.lkdv-communaute-v2`), les primitives partagées sous `src/components/ui/drawer/`.
La page `/communaute` garde son rendu et monte, drapeau à `true`, les deux nouveaux tiroirs à la
place des anciens (`dynamic(ssr:false)`, mêmes props / callbacks).

```
src/features/community/v2/
  shared/
    types.ts            (Lead)  VMs des tuiles/lignes, statuts, contrats de hooks
    format.ts           (Lead)  FR dates/distances/poids/pluriels, groupes agenda, surlignage,
                                clés de tri, .ics — pur et testé
    CommunitySheetShell.tsx (Lead) coque card-clippée : capsule 56, mini-capsule 30,
                                bouton/menu de tri, pile de détails, Échap ordonné, focus trap,
                                drag poignée (rubber-band/seuil), inert, haptique, reduced-motion
    communaute-v2-shell.css  (Lead, importé par le shell)
    useSessionMemory.ts (Lead)  mémoire de session (volet/filtre/tri/requête/scroll)
  explore/
    CommunityExploreSheetV2.tsx  (Explorer)  montage du tiroir Explorer
    ExploreCapsule.tsx           (Explorer)  capsule 4 volets
    panes/{SearchPane,CarnetsPane,ClubsPane,EventsPane}.tsx (Explorer)
    details/{SearchMapSheet,ClubDetailSheet,EventDetailSheet,MemberPreview,PeekOverlay}.tsx (Explorer)
    tiles/{CarnetTileV2,ClubTileV2,EventTicketV2,MemberRow}.tsx (Explorer)
    search/{SearchHome,SearchResults,highlight.ts} (Explorer)
    useExploreState.ts           (Explorer)
  data/
    communityFeedRpc.ts          (Explorer)  appels RPC typés feed/recherche/agenda
    communityFeedMappers.ts      (Explorer)  lignes RPC → VM de tuile
    useCarnetsFeed.ts/useClubsFeed.ts/useEventsFeed.ts/useCommunitySearch.ts (Explorer)
    communityMutations.ts        (Explorer)  join/leave/request club, join/leave event, like
  create/
    CreateSheetV2.tsx            (Création)  montage du tiroir Création
    engine/{CreateFormEngineV2.tsx,steps.ts,useDraftV2.ts,createSchemasV2.ts,errors.ts} (Création)
    fields/{FieldV2,ChipsV2,MediaFieldV2,PlaceFieldV2,NumberStepperV2,DateFieldV2,SegmentedV2}.tsx (Création)
    forms/{PostFormV2,StoryFormV2,CarnetFormV2,SortieFormV2,KitFormV2,ClubFormV2}.tsx (Création)
    story/{StoryEditorV2,StoryStageV2,StoryTrimV2}.tsx (Création)
    kit/ProductPickerSheetV2.tsx (Création)
    carnet/{TracePaneV2,DaysPaneV2}.tsx (Création)
    createRpc.ts                 (Création)  appels des RPC `create_*`
src/components/ui/drawer/
  SortMenuButton.tsx             (Fondations) bouton 30 + menu glass (role=menu/menuitemradio)
  DynamicIsland.tsx              (Fondations) île de confirmation réutilisable (inspirée de
                                src/components/carnet/v2/CarnetIsland.tsx)
src/features/community/v2/shared/
  ClubCrest.tsx / EventTicket.tsx / AgendaStrip.tsx (Fondations)
src/styles/
  tokens.css                     (Fondations : --type-post/carnet/club/sortie/membre + matériaux)
  communaute-v2.css              (Fondations : bases tuiles/lignes/cartes/champs/chips/states)
src/app/communaute/page.tsx      (Lead : drapeau + montage)
src/app/sorties/[id]/page.tsx    (Lead : fiche sortie minimale)
src/components/compte/drawer/LensPager.tsx et src/components/ui/drawer/LensPager.tsx
                                 (Lead : primitive partagée ; si elle diffère de /compte, l'aligner)
```

## 5. Interfaces partagées imposées

Contrats écrits par le Lead dans `shared/types.ts` (les respecter, ne pas les dupliquer) :

```ts
type ExploreTab = 'search' | 'carnets' | 'clubs' | 'sorties';
type CarnetFilter = 'discover' | 'mine' | 'followed' | 'near';
type CarnetSort = 'recent' | 'popular' | 'near' | 'duration';
type ClubFilter = 'discover' | 'mine' | 'near';
type ClubSort = 'activity' | 'near' | 'size';
type EventFilter = 'discover' | 'mine' | 'near';
type SearchScope = 'all' | 'posts' | 'carnets' | 'clubs' | 'sorties' | 'membres';

interface FeedState<T> { items: T[]; loading: boolean; loadingMore: boolean;
  error: string | null; hasMore: boolean; refresh: () => void; loadMore: () => void; }
```

Coque (contrat précis, le Lead l'implémente ; ne pas en écrire un doublon) :

```tsx
<CommunitySheetShell
  open onClose kind="explore" | "create"
  label="Explorer" | "Créer"
  capsule={{ items, active, onChange }}          // 56 px, icônes seules, role=tablist
  mini={{ items, active, onChange, label, sort? }} // 30 px bas-droite ; sort = {value, defaultValue, options, onChange}
  footer={ReactNode}                             // création : barre Retour/Suivant/action finale
  panes={ReactNode[]}                            // lens pager horizontal (suit le doigt)
  detail={ReactNode | null}                      // pile de détails ; bouton ‹ Retour géré par la coque
  onBack={() => void}
  onEscape?: () => boolean                        // true = couche interne consommée (menu/peek/confirm)
  requireAuth?: () => void
  user: ExplorerUser | null
/>
```

- La coque garantit : fond `inert` + `aria-hidden`, pas de voile, fermeture poignée (>30 % ou
  >0,55 px/ms), Échap (ordre : menu tri → peek → confirmation → détail → tiroir), focus trap,
  focus rendu au déclencheur, entrée .72 s `--ease-out`, sortie .56 s, capsule lentille .42 s
  `--motion-ease-standard`, mini-capsule lentille .28 s `--ease-spring`, cascade `.45 s`,
  haptique (4 sélection, 6 ouverture d'onglet, 8 ouverture/fermeture/push, 10 mutation, 12 undo,
  14 appui long, succès), `prefers-reduced-motion`.
- Les VMs de `types.ts` sont la seule forme passée aux tuiles ; les mappers RPC → VM vivent dans
  `data/communityFeedMappers.ts` et sont testés unitairement.

## 6. Répartition des écritures (scopes disjoints)

| Membre | Périmètre d'écriture (workspace-relatif, worktree) |
|---|---|
| Lead | `handoff/communaute-v2/**`, `docs/audit/communaute-v2-*/**`, `src/features/community/v2/shared/**`, `src/app/communaute/page.tsx`, `src/app/sorties/**`, `src/components/ui/drawer/LensPager.tsx`, `src/components/compte/drawer/LensPager.tsx`, `src/styles/communaute-v2-shell.css`, `playwright.config.ts`, `.github/workflows/ci.yml`, `package.json`, `next.config.mjs`, `csp.config.mjs`, `src/app/layout.tsx` |
| Fondations UI | `src/components/ui/drawer/SortMenuButton.tsx`, `src/components/ui/drawer/DynamicIsland.tsx`, `src/features/community/v2/shared/{ClubCrest,EventTicket,AgendaStrip}.tsx`, `src/styles/tokens.css` (ajouts en fin de fichier), `src/styles/communaute-v2.css`, tests de ces fichiers |
| Explorer | `src/features/community/v2/explore/**`, `src/features/community/v2/data/**` |
| Création | `src/features/community/v2/create/**`, suppression de `src/features/community/create/CarnetCreateForm.tsx` |
| DB | `supabase/migrations/*_communaute_v2_*`, `supabase/migrations_down/*_communaute_v2_*`, `supabase/tests/database/communaute_v2_*` |
| Tests/Recette | `tests/e2e/communaute-v2*.spec.ts`, `tests/a11y/e2e/communaute-v2-a11y.spec.ts`, `tests/visual/communaute-v2*.spec.ts`, `.maestro/communaute.yaml`, `docs/audit/communaute-v2-*/recette/**` |

Un fichier hors de son scope = demander au Lead (message) au lieu d'écrire. Commit conventionnel
français (`feat(communaute-v2): …`, `fix(…): …`, `test(…): …`, `chore(db): …`) ; citer les numéros
du document (`Carnets#3`, `Clubs#7`). Ne jamais commiter rouge : `npx tsc --noEmit -p .` + tests
ciblés avant chaque commit. Committer souvent (petits commits) pour que le Lead puisse recetter.

## 7. Commandes utiles

```bash
cd /Users/fr168256/Documents/deepseek-harness/default-workspace/lkdv-communaute-v2
npx tsc --noEmit -p .                 # type-check (obligatoire avant commit)
npx vitest run <chemin>               # tests ciblés (réseau interdit)
npx vitest run tests/design/unification.spec.ts   # garde design (littéraux/teintes)
npm run lint                          # eslint
npm run build                         # build Next (lent, lancer en fond)
npm run perf:budget                   # budget perf
npm run verify:invariants && npm run verify:icons
npm run test:a11y
npx playwright test <spec> --project=mobile-webkit --project=mobile-chromium --project=desktop-chromium
node scripts/db/migrations-alignment.mjs <registre> --strict   # lecture seule, si besoin
bash scripts/db/ci/run_pgtap.sh       # seulement si DATABASE_URL local (absent ici)
```

## 8. Coordination

- Rapporter au Lead par `send_message` (target `lead`) : fichiers touchés, tests exécutés + résultat,
  erreurs, décisions à remonter. Pas de journaux bruts.
- Signaler immédiatement tout blocage machine (accès, secret manquant, test structurellement impossible).
- Le Lead recette les intégrations, applique les migrations de prod, gère PR/Vercel/iOS et écrit
  `RAPPORT.md`/`JOURNAL.md`.
- Ne pas lancer de commande destructive (`git reset --hard`, `git clean`, `rm -rf` hors artefacts),
  ne pas toucher à `main`, ne pas modifier les fichiers d'un autre scope.
