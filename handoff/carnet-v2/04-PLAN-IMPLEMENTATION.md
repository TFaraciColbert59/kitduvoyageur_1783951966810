# 04 — Plan d'implémentation (ordre imposé, une PR)

Branche : `feat/carnet-v2` depuis `main` à jour. Commits conventionnels en français (`feat(carnet): …`, `fix(carnet): …`, `test(carnet): …`, `chore(db): …`), petits et verts (CLAUDE.md § 1.5 : `npx tsc --noEmit -p .` + tests ciblés avant chaque commit). Workflow superpowers (AGENTS.md) : plan → TDD → vérification → revue.

## Phase 0 — Préparation
- Lire `CLAUDE.md`, `AGENTS.md`, `DESIGN_SYSTEM.md`, ce dossier et ses annexes ; ouvrir la maquette et `/compte` en local côte à côte (`npm run dev`, port 4000, compte de démo).
- Créer `handoff/carnet-v2/JOURNAL.md`.
- Vérifier l'état : `npm ci`, `npx tsc --noEmit -p .`, `npm test` doivent être verts sur `main` avant tout changement (sinon noter dans le journal ce qui était déjà rouge).

## Phase 1 — Base de données (lots A → E de `03`)
Migrations + `.down.sql` + tests pgTAP. Validation locale et CI (`database-gates`). **Pas encore en prod.**

## Phase 2 — Couche données
- Étendre `CarnetDetail` (`src/features/carnet/detail/types.ts`) : `nights`, `dayReactions` (likes/compte/liked par jour), `momentEngagement`, `kitVerdicts`, `livePosition` (participant) ou `publicZone` (visiteur), `budget` (participant), `viewerRole: 'participant' | 'visitor'`.
- `getCarnetDetail` : lectures supplémentaires en parallèle, toutes sous RLS ; fallback `groupe_hebergements`.
- Hooks client : `useCarnetDayReactions(carnetId, day)`, `useMomentEngagement(momentId)`, `useCarnetLivePosition`, `useKitFork` ; mutations optimistes + rollback + île. Valider toute entrée avec zod (routes API ou server actions, `export const dynamic = 'force-dynamic'`).
- Tests unitaires de chaque builder et hook (modèle : `src/features/carnet/detail/__tests__`).

## Phase 3 — Écran `CarnetScreenV2` (`src/components/carnet/v2/`)
Ordre : coquille (grille, barre haute, carte du carnet, île) → vue du jour (swipe + mini-capsule + `CarnetPostGrid`) → carte (`CarnetMapCard` étendu) → tiroir + 5 slots + 18 lentilles → piles (étape, nuit, objet, participant) → post (moment) → stories → tiroir Carnet → mode modification → états. Après chaque étape : comparer à la maquette et à `/compte` (captures 390 px), tests composants.
- Drapeau `NEXT_PUBLIC_CARNET_V2` lu dans `page.tsx` (Server Component). Ajoute la variable à `.env.example` **non** (fichier protégé par CLAUDE.md) : documente-la dans `docs/` et dans le rapport, configure-la dans Vercel (Preview `true`, Production `true` au moment de la mise en prod).
- Conserver : `?commentaires=1` (ouvre Équipage › Réactions), `/connexion?next=/carnets/{id}`, 404 dans `generateMetadata`, JSON-LD, export GPX/JSON, publication `/api/carnets/[id]/publish`.
- Deep link d'entrée lu une fois : `?jour=N`, `?tiroir=fil|route|sac|chiffres|equipage|carnet`.
- CSS : un fichier `src/styles/carnet-v2.css` (ou CSS module) n'utilisant que des jetons ; supprimer la dépendance à `carnet-profile.css` uniquement dans V2 (ne pas supprimer le fichier : l'ancien écran reste derrière le drapeau).

## Phase 4 — Tests
Voir `05-QUALITE-ET-TESTS.md`. Ajouter un flow Maestro `.maestro/carnet.yaml` sur le modèle de `.maestro/compte.yaml`.

## Phase 5 — Livraison
Voir `06-DEPLOIEMENT.md`.

## Phase 6 — Nettoyage (après 100 % vert en prod)
Ne supprime pas l'ancien `CarnetScreen` dans cette PR. Ouvre une PR séparée « chore(carnet): retirer CarnetScreen v1 » en brouillon, non fusionnée, mentionnée dans le rapport.
