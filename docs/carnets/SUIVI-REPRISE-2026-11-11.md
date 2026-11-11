# Suivi — reprise « Carnets de bord » (2026-11-11)

Reprise du chantier interrompu par la limite hebdomadaire de la session précédente.
Branche : `claude/kind-bell-bfyt69` (worktree `lkdv-carnets-claude`). Plan de la reprise :
`docs/carnets/PLAN-REPRISE-2026-11-11.md`.

## Ce qui était ouvert (état de la session précédente)

1. La page `/carnets` **n'existait pas** : seuls les composants du hub étaient présents, orphelins,
   et `CarnetScreen` poussait vers une route morte.
2. Le suivi « carnet en route » était incomplet côté fiche : position différée présente
   (`carnet_public_position`, 3 h + arrondi 5 km), mais ni progression lisible, ni battements,
   ni résumé du soir.
3. Le point RGPD `hike_sessions_select_owner_or_public_carnet` exposait les `positions_geojson`
   / `positions_timed` bruts à un anonyme pour tout carnet public : décision non prise.
4. La migration `20261110100100_carnet_etapes.sql` était écrite et testée (pgTAP 9/9) mais
   **non appliquée en production**, alors que le code de la branche en dépend.

## Ce qui a été fait

### Lot 1 — page `/carnets` (hub)

- `src/app/carnets/page.tsx` : route serveur (`force-dynamic`, metadata), enfin la route que
  `CarnetScreen`, la page d'erreur et le registre de navigation visent déjà.
- `src/features/carnet/hub/` : chargeur serveur sous RLS (aucune clé de service, aucune RPC
  Communauté v2 absente en production), types, phase dérivée des dates (préparation / en route /
  rentré, fuseau Europe/Paris), filtres.
- `src/components/carnets/hub/` : écran client, cartes de couverture 4/5 (photo ou mosaïque des
  dernières photos, sinon fond topographique), tracé en filigrane, tampon de pays, pastille
  vivante « En route · Jn sur N », métriques mono, avatars, j'aime 44 px, capsule de filtres
  (En route / Suivis / Monde / Les miens), bande « En route maintenant », squelettes à la forme
  des cartes, états vides et erreur avec « Réessayer ».
- `src/styles/carnets-hub.css` : tokens uniquement.
- `src/middleware.ts` : `/carnets` entre dans le matcher de connexion obligatoire, comme
  `/carnets/:path*` l'était déjà.
- `src/constants/routeRegistry.json` : l'ancienne redirection permanente `/carnets → /communaute`
  (« index des carnets supprimé ») **masquait la nouvelle page** (308 avant même le routage
  Next). L'entrée active est retirée et `/carnets` est déclaré route canonique (`kept`) ; les
  tests d'invariants de routage (`tests/routing`) restent verts. `/carnets/nouveau → /communaute`
  reste tel quel (création portée par la Communauté).
- Tests : chargeur (phases, repli photos, erreurs partielles) et écran (filtres, états, j'aime).

### Lot 2 — suivi « carnet en route » dans la fiche

- `src/components/carnet/v2/CarnetSuivi.tsx` (additif, aucun fichier livré réécrit) :
  - `CarnetProgression` : statut dérivé des dates, `role="progressbar"` avec `aria-valuetext`,
    km faits / prévus, jour J/Total ;
  - `CarnetBeats` : « Battements », un trait par moment groupé par jour, jour actif en forest,
    cibles clavier 44 px ;
  - `CarnetEveningSummary` : « Résumé du soir » du dernier jour terminé (km, D+, moments, nuit,
    photo phare), rien rendu s'il n'y a rien à raconter.
- Intégration dans la lentille « Suivre » de `CarnetDrawerV2` (progression, dernier signal,
  battements, résumé du soir, puis le choix « Me prévenir » existant). `onDayPick` câble les
  battements et le CTA du résumé sur le jour de la fiche.
- Tests : 19 tests RTL + garde-fous design (tokens, couleurs, 44 px, mouvement réduit).

### Lot 3 — RGPD et migrations

- **Appliquée en production** : `20261110100100_carnet_etapes` (table `carnet_etapes`, RLS
  `can_view_carnet` / `is_carnet_participant`, 4 policies, `anon` sans écriture). Vérifiée en
  base le 2026-11-11 (`table_exists=1`, `rls_enabled`, 4 policies, advisors relancés : aucune
  alerte nouvelle sur cette table). Rollback prêt :
  `supabase/migrations_down/20261110100100_carnet_etapes.down.sql`.
- **Écrite, validée, NON appliquée** : `20261111101000_carnet_public_trace_scope`, portée
  complète (voir « Fermeture RGPD du rôle authenticated » plus bas).
  - Retire au rôle `anon` tout accès direct à `hike_sessions` ; expose `hike_sessions_public`
    (carnets publics, tracé échantillonné 1 point sur 5 arrondi à ~110 m, sans horodatage ni
    `user_id`).
  - `getCarnetDetail` tranche le rôle **avant** les sorties (`is_carnet_participant`) : un
    participant lit `hike_sessions_participant`, un visiteur la vue simplifiée.
  - Validation faite dans une transaction annulée sur la production : `anon` sans privilège table,
    vue lue avec 6 lignes pour un carnet public réel, tracé 326 → 66 points, premier point
    `[6.895, 45.936]`. Aucune écriture conservée (vérifié après rollback).
  - **À appliquer impérativement avec le déploiement du code** : le code actuellement en
    production lit la table brute pour les visiteurs et les sorties personnelles ; la migration
    seule casserait leur carte et leurs écrans de sortie.

### Vérifications (preuves)

| Porte | Résultat |
| --- | --- |
| `npx tsc --noEmit -p .` (NODE_OPTIONS 8 Go) | 0 erreur (rejoué après chaque intégration) |
| `npm run lint` | 0 erreur (avertissements préexistants hors périmètre) |
| Vitest carnet + hub + routage (`src/features/carnet`, `src/components/carnet`, `src/components/carnets`, `tests/routing`) | 51 fichiers / 517 tests verts |
| dont `CarnetSuivi.test.tsx` (lot L2) | 19/19 |
| dont hub `/carnets` (chargeur, phase, écran) | 3 fichiers / 28 tests verts |
| Build Next fixtures (`bash tests/fidelity/build.sh`, `BUILD_ID` aBmzqUiPseaVGppdAIK6z) | vert |
| Recette Playwright `/carnets` (`tests/fidelity/hub.config.ts`, 390/430 × clair/sombre) | **28/28 verts** : rendu, filtres, états vide/erreur, route protégée, j'aime POST/DELETE, lentille Suivre |
| Banc de fidélité Carnet (non-régression, 390/430 clair) | 72 tests verts (dont axe fiche carnet) ; moyenne **7,3 %** de pixels (avant 7,8 %), **14** cellules ≤ 2 % (avant 2/40), mesures **95,8 %** (avant 95,7 %) |
| Greps design system (couleurs littérales, `rgba(0,0,0)`) sur les fichiers neufs | 0 |

Captures et scores complets : `docs/audit/carnets-hub-2026-11-11/` (40 captures : accueil, filtres,
états vides, j'aime actif, carte ouverte, lentille Suivre) et `tests/fidelity/out/galerie.html`.

Constats de recette corrigés pendant la reprise :

- **`/carnets` renvoyait un 308 vers `/communaute`** (redirection permanente du registre de
  routage) — page jamais atteinte ; entrée retirée, route déclarée canonique (voir lot 1).
- **La liste défilait derrière l'en-tête sticky transparent** de la coquille et les titres de
  couverture se superposaient au H1 une fois scrollé. Une surface de verre système a été ajoutée
  derrière `.lkdh-header` (tokens `--lkv-surface` + recette `--glass-*`, repli opaque en
  transparence réduite), captures rejouées après correctif.

Limite de recette honnête : le thème sombre est joué par le banc, mais la référence de la
coquille `/communaute` est un verre clair ; la capture « sombre » ne prouve pas un rendu sombre
complet (léger écart de fond seulement). Non testé : iPhone réel, WebKit (binaire indisponible
dans cet environnement, comme l'indiquait la session précédente).

## Reprise 2 — signal de bord, suivis persistés, vidéo (2026-11-11)

Deuxième vague, même jour, pour finir ce qui restait du lot 2 et du lot 3 de la maquette.

### Signal de bord (proposition n° 37) — fait

- **`POST /api/carnets/signal`** (`src/app/api/carnets/signal/route.ts`) : multipart
  `kind` (photo/vidéo/note), une ligne ≤ 400, lieu, `tripId`/`carnetId` facultatifs. Résolution
  serveur du carnet : carnet explicite (participant vérifié par `is_carnet_participant`), sinon
  carnet de l'utilisateur en cours (dates couvrant aujourd'hui), sinon carnet du voyage, sinon
  **carnet minimal créé** (titre « Carnet du {date} ») — le cockpit le réutilise à l'arrêt pour
  éviter un doublon. Jour = jours civils depuis `start_date`, borné 1..366. Médias envoyés dans
  les buckets publics du projet avec les MIME/plafonds vérifiés en base (photo `carnet-media`
  ≤ 10 Mo, vidéo `carnet-moments-media` ≤ 25 Mo), chemin `<uid>/carnet-moments/<carnetId>/…`
  conforme aux policies storage. Insertion `carnet_moments` par le même schéma zod et le même
  constructeur de ligne que la fiche (`validateMomentInput`/`momentInsertRow`, repli 42703).
  Aucune clé de service, aucune coordonnée stockée.
- **`src/features/carnet/detail/signalDeBord.ts`** : fonctions pures (jour, validation MIME/taille)
  et `publishSignal` (FormData same-origin, erreurs lisibles, UUID validés).
- **`CaptureSheet`** : les quatre gestes existants publient réellement — photo/vidéo → aperçu +
  ligne + « Envoyer le signal » ; note/moment → une ligne + « Envoyer » ; succès
  « Signal envoyé · J{n} », erreurs de la route affichées sans fermer la feuille ; rétrocompatible
  (sans `publish`, ancien comportement local conservé). **`HikingCockpitPage`** mémorise le carnet
  du premier signal et le transmet à `stopHike()`.
- Tests : 13 tests `signalDeBord` (jour borné, MIME/plafonds, FormData, UUID, 401/réseau) + 4 tests
  RTL du composant (publier photo/note, erreur, mode local).

### Suivre le carnet + fréquence de notification (propositions n° 20 et 41) — fait

- **Migration `20261111120000_carnet_follows` appliquée en production** (version
  `20261111133704` après application MCP) : table `carnet_follows` (PK carnet+personne,
  `notify_mode` = `moment` | `digest` | `highlights`, `updated_at`), 4 policies RLS
  (lecture/écriture de ses seuls suivis, auto-suivi d'un participant refusé, `delete` propre),
  `anon` sans aucun privilège. Validée d'abord dans une transaction annulée (table, RLS,
  policies, privilèges), rollback fourni, pgTAP 10 assertions livré.
- **`useCarnetFollow`** : lecture/écriture sous RLS, repli `localStorage` si table absente
  (42P01/PGRST205) ou erreur réseau, participant jamais « suiveur » de son carnet, invité sans
  appel réseau. 10 tests RTL.
- **Lentille « Suivre »** : bloc « Suivre ce carnet / Ne plus suivre » (pilule 44 px, `aria-pressed`)
  et les trois options « Me prévenir » adossées au compte quand la table répond
  (« Préférence enregistrée sur ton compte »), repli appareil sinon — le reste de la lentille
  (progression, dernier signal, battements, résumé du soir) ne bouge pas.

### Vidéo (proposition n° 31) — fait

- `src/components/carnet/v2/CarnetVideo.tsx` : `CarnetVideoFeed` (lecture muette en boucle, son au
  toucher, contrôles 44 px lecture/pause + son + ouverture, mouvement réduit respecté, erreur de
  lecture non bloquante) et `CarnetVideoThumb` (vignette inerte pour la mosaïque Médias).
- Branchés dans `MomentCard` (fil) et `CarnetMomentTileBody` (tuiles) : un moment vidéo rend
  désormais un `<video>` et non plus une image figée. Styles ajoutés aux CSS de lentilles
  (tokens, repli transparence réduite). 6 tests.
- État des lieux du reste du lot 3 : les neuf types (`photo, video, voice, text, meet, spend, kit,
  species, inc`) et leurs cartes existaient déjà (ticket budget, rencontre, planche d'espèces,
  note vocale, objets, incident) ; la vidéo était le rendu manquant.

### Fermeture RGPD du rôle authenticated (même migration, non appliquée)

- `hike_sessions_participant` (SECURITY DEFINER) rend la ligne complète à sa propre sortie,
  à un carnet où l'on participe ou à une sortie où l'on est présent ; `anon` en est exclu
  (les privilèges par défaut Supabase accordaient la vue aux deux rôles : `revoke` explicite,
  constaté en validation).
- `authenticated` perd le SELECT direct de `positions_geojson`, `positions_timed`, `poi_events`,
  `narratives` et `notes` ; il garde les colonnes neutres (statistiques, kit, route, traitement).
- Huit lecteurs migrés vers la vue participant : API liste des sorties, API narrative, cockpit
  (adventure-intelligence), synchronisation hors ligne, bootstrap du compte, carte du compte,
  sorties du compte (détail + contrôle propriétaire), fiche carnet (participant), plus l'import
  de trace du formulaire de carnet. Les tâches de fond à clé de service (cron) gardent la table.
- Invariant `tests/security/hike-sessions-raw-access.spec.ts` : casse le build si un futur code
  resélectionne une colonne brûlante sur la table, ou si un écran concerné n'utilise plus la vue.
- Vérifications après migration des lecteurs : tsc 0 ; **76 fichiers / 669 tests verts** (dont
  l'invariant RGPD) ; rebuild fixtures vert ; recette Playwright hub + fiche carnet participant
  **28/28** ; banc de fidélité Carnet + axe **36/36** — aucune régression.
- Validation transactionnelle sur la production (annulée ensuite) : `anon` sans table ni vue
  participant, `authenticated` sans colonne brute mais avec les colonnes neutres, vue participant
  à 6 lignes pour l'auteur du carnet de référence et 0 pour un visiteur connecté, vue publique
  34 lignes. **Non appliquée** : le code déployé lit encore la table brute.

### Vérifications (2e vague)

| Porte | Résultat |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 erreur |
| `npm run lint` | 0 erreur (avertissements préexistants hors périmètre) |
| Vitest `src/features/carnet`, `src/components/carnet`, `src/features/hiking`, `tests/routing` | **66 fichiers / 582 tests verts** |
| Nouvelles suites | signalDeBord 13, CaptureSheet 4, useCarnetFollow 10, CarnetVideo 6 |
| Migration production `carnet_follows` | appliquée + vérifiée (table, RLS, 4 policies, anon sans accès) |
| Recette Playwright hub + lentille Suivre (rebuild après correctifs) | **28/28 verts** (390/430 × clair/sombre) |
| Banc de fidélité Carnet + axe (390 clair, après vidéo/suivis) | **36/36 verts** — aucune régression |


## Ce qui reste (honnête)

1. **Déployer** : les migrations Communauté v2 (`20261108130001` → `20261108190000`) ne sont
   toujours pas appliquées en production, et la migration RGPD ci-dessus doit l'être avec le
   déploiement du code adapté. Le drapeau `NEXT_PUBLIC_COMMUNAUTE_V2` n'est pas activé en
   production. Aucune mise en production n'a été faite dans cette reprise.
2. **Fermeture RGPD du rôle `authenticated`** : faite sur la branche (migration
   `20261111101000` étendue — vue `hike_sessions_participant`, colonnes brûlantes retirées au
   rôle authenticated, huit lecteurs migrés, invariant `tests/security/hike-sessions-raw-access.spec.ts`),
   **à appliquer avec le déploiement** : le code en production lit encore la table brute.
3. **Galerie plein écran et vidéo** : la visionneuse du moment (`CarnetPostSheet`) et la galerie
   de la lentille Médias affichent les images ; une vidéo s'y ouvre encore comme une image. Le
   fil et les tuiles la lisent désormais, la visionneuse plein écran reste à adapter.
4. **Sons d'ambiance** (proposition n° 32) : la note vocale existe (MediaRecorder, onde,
   transcription absente) ; l'enregistrement d'ambiance distinct n'est pas fait.
5. **Décisions déjà listées par la session précédente** restent à Tony : édition (spec vs crayon),
   lentille « Commentaires » séparée, dérogation chips 28 px, ombre de l'île, 13 points reportés.
6. Couleurs littérales de `carnet-profile.css` (fiche **v1** legacy, proposition 65) non reprises :
   la v2 est le défaut, le fichier appartient au travail déjà livré.
7. **Recette non faite** : iPhone réel, WebKit (binaire indisponible), et le signal de bord du
   cockpit n'est couvert qu'en tests unitaires/RTL (pas de parcours Playwright sur
   `/randonnee-active`, qui exige une session GPS réelle).
