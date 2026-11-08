# Rapport — tiroirs de la Communauté v2

> Statut provisoire rédigé au fil du chantier (2026-11-08). À compléter avec les liens CI,
> les preuves de recette et le statut final avant remise à Tony.

Statut : **EN COURS** — voir la section « Statut final » en bas.
Prérequis carnet-v2 : **code fusionné, migrations non appliquées en prod**
(conséquence : étape « Nuits » du formulaire Carnet masquée — `HAS_CARNET_NIGHTS=false`).
PR : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/155 ·
Commit de fusion : à venir · Déploiement prod : à venir ·
Drapeau `NEXT_PUBLIC_COMMUNAUTE_V2` : `true` en Preview, **`false` en Production** (blocage sauvegarde).

## Implémentation livrée

### Coque commune
- `CommunitySheetShell` : carte clippée /compte (top 44 px + safe, left/right 8, bottom 14,
  rayon 24), entrée `.72 s var(--ease-out)`, sortie `.56 s`, poignée 38×5 avec rubber-band
  (fermeture > 30 % ou > 0,55 px/ms), **pas de voile**, fond `inert` + `aria-hidden`,
  piège de focus, focus rendu au déclencheur, Échap ordonné (menu → peek → confirmation →
  détail → tiroir), `prefers-reduced-motion`/`-transparency`.
- Capsule 56 px (`CapsuleTabs` aligné /compte), mini-capsule 30 px, bouton de tri 30 px
  (`SortMenuButton`, `role=menu`/`menuitemradio`, point vert si tri ≠ défaut), LensPager
  (verrou 8 px, seuil 48 px, 420 ms `--ease-glass`), pile de détails `‹ Retour`,
  île dynamique (`DynamicIsland`).
- Mémoire de session (volet, filtre, tri, requête, scroll) sans stockage.
- Jetons : `--type-post/carnet/club/sortie/membre` (verts, AA), matériaux `--cv2-*`,
  feuilles `src/styles/communaute-v2.css` et `communaute-v2-shell.css` (aucun littéral hex).

### Explorer
- 4 volets : Recherche (accueil, tendances, résultats groupés, surlignage, carte,
  clavier, aria-live, erreur distincte), Carnets (mosaïque, tampon de visa, trace,
  anneau En route, GPS vérifiée, j'aime 44 px, voyageurs empilés, tri en menu,
  pagination), Clubs (Club du mois, blason, cadenas si adhésion sur validation,
  chips d'activité, tri, détail empilé riche, pile Demandes admin, glisser entre
  clubs), Sorties (bande agenda 14 jours, billets datés, groupes chronologiques,
  capacité/liste d'attente, météo J-7, .ics, détail avec RDV carte, fiche `/sorties/[id]`).
- Données : RPC `community_{carnets,clubs,events}_feed`, `community_search`,
  `community_events_agenda` (compteurs serveur, pagination par curseur, `near`).
  Mutations optimistes + île avec Annuler ; aucune écriture client de compteurs.

### Création
- Moteur unique V2 (react-hook-form + zod) : étapes en mini-capsule, Retour/Suivant
  visibles, libellés 600 10 px, champs 16 px/44-48 px, une erreur affichée une fois sous
  son champ + compteur en tête, brouillon 6 types (400 ms, pagehide, purge), bandeau
  « Brouillon restauré · Effacer », confirmation de fermeture avec piège de focus,
  clavier `visualViewport`, envoi occupé + progression, île de succès avec action.
- 6 formulaires : Publication, Story (éditeur 9:16 sur le visualiseur existant), Carnet
  (carte topo + tracé, jours, moments + photos téléversées, couverture, visibilité Privé
  par défaut), Sortie (activité, RDV carte + coordonnées, date+heure, difficulté,
  capacité/liste d'attente, sécurité, récurrence, club/kit), Kit (sélecteur produit en
  sous-tiroir, poids SQL, visibilité), Club (blason généré, slug vérifié, adhésion
  Ouvert/Sur validation, questions, post d'accueil).

## Base de données (préparée, **non appliquée en prod**)
- 8 migrations idempotentes + `.down.sql` : lots A→F phase 1
  (`20261108130001…130006`) puis phase 2 (`130007` liste d'attente, `130008` contrainte
  `clubs_privacy_check`), conformes à l'état réel audité de la base (registre en retard,
  `carnet_nights`/`creation_meta`/`clubs.rules` absents, triggers de compteur absents).
- Contrats : `handoff/communaute-v2/RPC-CONTRACTS.md`. Séquence d'application prod :
  `handoff/communaute-v2/PROD-APPLICATION.md`.
- 7 suites pgTAP (`communaute_v2_{search,feeds,events,clubs,creations,stories,rpc_security}`)
  + suites existantes inchangées (hors 2 fixtures `privacy` alignées sur le domaine).
- Alignement registre (lecture seule) : 366 alignés, 0 renommé, **61 repo-only** dont nos
  8 fichiers (jamais appliqués), 11 versions fantômes du connecteur — détail dans le
  RAPPORT final (passage de `/tmp/prod-ledger.txt` par `migrations-alignment.mjs`).
- Preuve d'alignement avant/après advisors : `/tmp/advisors-before.txt` (à joindre).

## Blocage et suites
Voir `handoff/communaute-v2/JOURNAL.md` J-08 : `BACKUP_PASSPHRASE` absent ⇒ aucune
migration prod, pas de recette prod, drapeau Production laissé à `false`.
Reprise exacte : `handoff/communaute-v2/PROD-APPLICATION.md`.

_(Le rapport final, avec portes qualité, couverture des 200 améliorations, recette A/B/C,
iPhone et retour arrière, est complété à la fin du chantier.)_
