# 04 — Plan d'implémentation (ordre imposé, une PR)

Branche `feat/communaute-v2` depuis `main` à jour. Commits conventionnels en français (`feat(communaute): …`, `fix(communaute): …`, `test(communaute): …`, `chore(db): …`), petits et verts (`npx tsc --noEmit -p .` + tests ciblés avant chaque commit). Workflow superpowers (AGENTS.md) : plan → TDD → vérification → revue. Cite les numéros du document (`Clubs#6`) dans les messages de commit.

## Phase 0 — Préparation
- Lire `CLAUDE.md`, `AGENTS.md`, `DESIGN_SYSTEM.md`, ce dossier et ses annexes ; ouvrir la maquette et `/compte` en local côte à côte (`npm run dev`, port 4000, compte de démo).
- Vérifier le prérequis carnet-v2 (`00` § 2), le noter dans `JOURNAL.md`.
- `npm ci`, `npx tsc --noEmit -p .`, `npm test` verts sur `main` avant tout changement (sinon noter ce qui était déjà rouge).
- Relire `annexes/J-schema-communaute.md` puis **vérifier en base** chaque point marqué « à vérifier ».

## Phase 1 — Base de données (lots A → F de `03`)
Migrations + `.down.sql` + tests pgTAP, en deux groupes de fichiers (phase 1 ajouts purs, phase 2 réécritures, `03` en-tête). Validation locale et CI (`database-gates`). **Pas encore en prod.**

## Phase 2 — Couche données
- `useCommunitySections` remplacé, pour la V2, par des hooks par volet avec pagination par curseur : `useCarnetsFeed({filter, sort, near})`, `useClubsFeed({filter, sort, activity, near})`, `useEventsFeed({filter, day, near})`, `useCommunitySearch({q, scope})` (RPC, debounce 250 ms, annulation des requêtes périmées, état erreur distinct).
- Compteurs (j'aime, commentaires, membres, participants) lus côté serveur (`03` lot B), plus de chargement de 5 000 lignes.
- Mutations : `joinClub`, `leaveClub`, `requestJoinClub`, `joinEvent`, `leaveEvent`, like de carnet — optimistes, île avec Annuler, retour arrière en cas d'échec, bouton occupé (pas de double envoi).
- Créations : une fonction par type, appelant les RPC atomiques ; entrées validées par les schémas zod existants (`createSchemas.ts`) étendus.
- Tests unitaires de chaque hook et mapper (modèle : `src/features/carnet/detail/__tests__`).

## Phase 3 — Primitives
`SortMenuButton`, `DynamicIsland` (si non extraite), `ClubCrest`, `EventTicket`, `AgendaStrip`, recadrage `MediaPicker`, poignée de réordonnancement au doigt, gestion `visualViewport` (réutilisation de `src/hooks/useKeyboardInsets.ts`). Tests composants pour chacune.

## Phase 4 — Tiroir Explorer (`src/features/community/v2/explore/`)
Ordre : coque + capsule 4 volets + mini-capsule + pager → Carnets (tuiles, tri, états) → Clubs (chips, tri, détail empilé, adhésion, pile « Demandes (n) » pour admins) → Sorties (agenda, billets, détail, inscription, .ics) → Recherche (accueil, RPC, groupes, surlignage, « Sur la carte », clavier) → Peek & Pop → mémoire de session. Après chaque volet : captures 390 px comparées à la maquette.

## Phase 5 — Tiroir Création (`src/features/community/v2/create/`)
Ordre : moteur V2 (étapes en mini-capsule, Retour/Suivant, libellés, erreurs uniques, brouillon, clavier, île) → Publication → Story (éditeur plein cadre) → Sortie → Club → Kit (sélecteur empilé) → Carnet (migration de `CarnetMapDrawer` vers le moteur : tracé, jours, moments téléversés, partage). Pour chaque type : erreur provoquée puis corrigée, brouillon restauré, envoi réel en local, test e2e.

## Phase 6 — Drapeau et nettoyage minimal
- Drapeau `NEXT_PUBLIC_COMMUNAUTE_V2` lu dans `src/app/communaute/page.tsx`. `.env.example` est protégé (CLAUDE.md) : documente la variable dans `docs/` et dans le rapport, configure-la dans Vercel.
- Ne supprime pas les anciens tiroirs dans cette PR (seul `CarnetCreateForm.tsx`, orphelin, est supprimé après reprise de son aide au récit). Ouvre une PR brouillon séparée « chore(communaute): retirer les tiroirs v1 », non fusionnée, mentionnée dans le rapport.

## Phase 7 — Tests (`05`) puis Phase 8 — Livraison (`06`) puis Phase 9 — Recette (`07`)
