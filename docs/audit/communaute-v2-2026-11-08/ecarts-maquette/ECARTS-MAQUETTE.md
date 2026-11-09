# Écarts entre la maquette et la Communauté v2 livrée

**Date : 2026-11-08** · Périmètre : tiroirs **Explorer** et **Création** de `/communaute`
(système `/compte`), sous-tiroirs et formulaires. Comparaison **image par image** entre la
maquette de référence et le build livré, complétée par la lecture du code et des documents de
décision.

- Maquette : `handoff/communaute-v2/annexes/maquette-communaute.html` et ses **58 captures
  390×844** (`docs/audit/communaute-v2-2026-11-08/recette/captures-maquette/`).
- Code livré : `main` (`9b68c63`, PR #155), build V2 servi en local.
- **Captures de la V2 : 48 PNG 390×844** dans `captures-v2/` (données simulées `@ui-mock`,
  zéro réseau, zéro base), rejouables avec `capture-all.spec.ts` (voir `README.md`).
- Détail par domaine : [`ECARTS-EXPLORER.md`](./ECARTS-EXPLORER.md),
  [`ECARTS-CREATION.md`](./ECARTS-CREATION.md), [`ECARTS-TRANSVERSES.md`](./ECARTS-TRANSVERSES.md).

> Règle de lecture : un écart **n'est pas forcément un défaut**. Une partie des différences est
> une **exception admise** par `01-SPEC-PRODUIT.md` § 6 (référence par défaut)/`D-document-refonte.md`,
> une **décision du JOURNAL**, ou une **limite de la recette locale** (base de production non
> migrée, J-08). Chaque ligne le dit dans la colonne « Statut ».

## État final du chantier de fidélité (2026-11-09)

> **83 / 85 items comblés et vérifiés ; 0 partiel ; 2 bloqués externes (J-08).**
> Voir [`BILAN-FIDELITE.md`](./BILAN-FIDELITE.md) (preuves, commits, reprise) et
> [`CHECKLIST-100.md`](./CHECKLIST-100.md) (suivi item par item). Galerie appairée :
> [`GALERIE.html`](./GALERIE.html) (82 captures). Les sections de ce document décrivent
> l'**audit initial** (état avant corrections) ; leurs écarts ont été comblés ou explicitement
> documentés comme exceptions `01 § 6`.

Preuves finales : build vert, TypeScript 0 erreur, vitest **279/279**, e2e **46/46 Chromium ET
WebKit**, axe **4/4** (0 critical/serious), captures **82/82** (390×844 + 360/430), visuel 4/4,
contraste 42/42. Reproduire : `VERIFIER.sh`.

## Synthèse

Compteurs **par document** (occurrences taguées ; une même cause transverse peut apparaître dans
deux documents, les totaux ne sont donc pas une somme arithmétique à lire comme un nombre unique
d'écrans distincts) :

| Document | Périmètre | P1 | P2 | P3 | Non documentés |
|---|---|---|---|---|---|
| [`ECARTS-EXPLORER.md`](./ECARTS-EXPLORER.md) | 28 lignes (coque, Recherche, Carnets, Clubs, Sorties, invité, gestes, états) | **2** | 7 | 9 | **14** (dont 2 P1) |
| [`ECARTS-CREATION.md`](./ECARTS-CREATION.md) | 6 types · 22 étapes + sous-tiroir Kit + 4 états transverses = 26 écrans | 0 | **29** | **112** | **13** (9 P2 + 4 P3) |
| [`ECARTS-TRANSVERSES.md`](./ECARTS-TRANSVERSES.md) | 13 thèmes (couleurs, typo, rayons, ombres, espacements, motion, états, capsule, poignée, focus, safe areas, débordements) | 0 | 4 | 16 | **18** (4 P2 + 14 P3) |
| **Total occurrences** | — | **2** | **40** | **137** | **45** |

**Aucun P1 côté Création ni côté design system.** Les 2 P1 sont la même cause racine dans la
Recherche (voir ci-dessous). La grande majorité des écarts sont **P3 (cosmétique/densité)** ou
relèvent d'**exceptions déjà documentées** (`01 § 6`, JOURNAL, `COUVERTURE-200.md`).

### P1 — la Recherche livrée n'affiche pas ses résultats (à corriger en premier)

Sur l'écran **résultats** (tous les volets de recherche), `.lkdv-cv2x-cover-fallback`
(`position:absolute; inset:0`, `explore-v2.css` L56) **s'échappe de sa vignette 52×48** parce que
`.lkdv-cv2x-search-cover` (L990) n'établit pas de bloc conteneur (`position:static`) : l'aplat de
repli s'étire sur tout le corps du tiroir (`374×699`, mesuré) et masque groupes, compteurs,
en-têtes, surlignage et CTA. Conséquence secondaire : la bascule **« Sur la carte »** est
interceptée par ce même aplat (la capture carte est invalide : navigation vers une fiche).
Preuves : `captures-v2/explorer-recherche-resultats.png` (écran vide) et
`explorer-recherche-sur-la-carte.png` ; mesure Playwright : `elementFromPoint` au centre =
`SPAN.lkdv-cv2x-cover-fallback`, `rowCount=2` mais contenu invisible.
**Correctif proposé (1 ligne)** : `position: relative` sur `.lkdv-cv2x-search-cover`
(`src/features/community/v2/explore/explore-v2.css` L990), puis rejouer les captures
`explorer-recherche-resultats` / `explorer-recherche-sur-la-carte` et les e2e 5a/5b/5e.
Les tests e2e ne l'ont pas vu : `toBeVisible()` de Playwright ne détecte pas un élément recouvert.

### Top corrections priorisées (dédupliquées, toutes catégories)

| # | Gravité | Écart | Correction proposée | Document |
|---|---|---|---|---|
| 1 | **P1** | Résultats de recherche masqués + bascule carte interceptée (cause commune) | `position: relative` sur `.lkdv-cv2x-search-cover` + captures/e2e de contrôle | Explorer |
| 2 | P2 | Mini-capsule d'étapes qui **recouvre** le bas du contenu (Story Média, Kit Inventaire, Club Univers, Sortie RDV, Publication Légende) | réserver le `padding-bottom` du pane Création (~76 px) sous la mini-capsule | Création (déjà routé `RAPPORT-INTEGRATION`) |
| 3 | P2 | **Brouillon sans étape** : rouvrir un brouillon revient à l'étape 1 | persister `step` dans le brouillon + test de reprise à l'étape N | Création |
| 4 | P2 | Badges de tuile carnet **inversés** (`Carnet de la semaine` sombre / `En route` clair) + visa « n VOYAGEURS » non prévu | remettre verre clair + encre forêt pour la semaine, pilule forêt pour « En route » ; retirer la 2e ligne du visa | Transverses / Explorer |
| 5 | P2 | Sortie : bouton **S'inscrire hors billet** (double bandeau, doublon « Inscrit ») ; 3 niveaux au lieu de 5 ; règle **DVA** ski absente | pill dans le pied du billet ; ajouter `tres_facile`/`expert` ; validation `ski → DVA` | Explorer / Création |
| 6 | P2 | Club : **image unique** au lieu d'avatar carré + bannière 3:1 ; détail « Quitter le club » au lieu de « Membre ✓ », prochaines sorties sans action | deux médias distincts (schéma + RPC + affichage) ; corriger les libellés/actions du détail | Création / Explorer |
| 7 | — | ~~Capsule masquée dans les détails empilés~~ → **NON-ÉCART vérifié** : la maquette ne la conserve pas non plus (`renderStack()` remplace `SROOT`, HTML L2084 ; capture `explorer-clubs-detail.png` sans capsule). La V2 est conforme. | aucune | Explorer |
| 8 | P2 | États : l'**erreur n'a pas de teinte danger** (pastille identique au vide) | appliquer `--bad-bg`/`--bad` sur l'icône d'erreur | Transverses |
| 9 | P2 | Story : hiérarchie Média (scène plein cadre vs aperçu compact + libellé/hint sous la ligne de flottaison) | rapprocher la scène de l'aperçu maquette et remonter libellé/hint | Création |
| 10 | P2 | « Retour » absent à l'étape 1 (décidé `01 §4.1`) mais **présent** en maquette désactivé ; doublons Distance/Dénivelé du Carnet/Tracé | à trancher (documenter ou rétablir un Retour désactivé) ; supprimer la rangée métrique dupliquée | Création / Transverses |

> Les 45 écarts non documentés (dont 43 P2/P3) sont listés, avec capture et fichier probable, dans
> les trois documents détaillés. Les lots P3 (libellés, densités, arrondis, skeleton) sont à
> traiter par passe design, pas en correctifs isolés.

## Ce que la V2 reprend fidèlement de la maquette

- Coque commune : carte clippée du système `/compte` (top 44 px + safe area, gauche/droite 8,
  bas 14, rayon 24), matériaux de verre clair, pas de voile, fond `inert` + `aria-hidden`.
- Capsule 56 px à 4 volets / 6 types, mini-capsule 30 px pour les étapes et filtres, bouton de
  tri 30 px (`role="menu"`, point vert si tri modifié), `LensPager` (seuil 48 px).
- Pile de détails `‹ Retour`, Peek & Pop (appui long, 3 actions), île dynamique + Annuler,
  `prefers-reduced-motion` / `-transparency`.
- Explorer : 4 volets, recherche (accents/ponctuation, surlignage, carte), Carnets (mosaïque,
  visa, j'aime, avatars empilés), Clubs (blason, Club du mois, adhésion, demandes), Sorties
  (agenda 14 jours, billets, capacité/liste d'attente, `.ics`), états vide/erreur/chargement.
- Création : 6 formulaires, étapes en mini-capsule, aperçu vivant, erreurs affichées une seule
  fois + compteur, brouillon restauré, confirmation de fermeture avec piège de focus, île de
  succès, pied Retour/Suivant/action finale.

## Exceptions admises (ne sont pas des régressions)

Référence : `01-SPEC-PRODUIT.md` § 6, `D-document-refonte.md`, `JOURNAL.md`.

- **Sondage, commentaires/likes réels, programmation des posts, vidéo dans les publications**
  (éléments `01 § 6`).
- **Rappels de sortie** (notifications) et **occurrences récurrentes** : hors périmètre.
- **Transition partagée vers la fiche carnet** : la tuile Carnet de la V2 ouvre la fiche
  `/carnets/[id]` existante au lieu d'un détail empilé (Carnets#13) — capture
  `explorer-carnets-fiche-existante` (squelette : données de la fiche non mockées ici).
- **Étape « Nuits »** du carnet masquée : `carnet_nights` absente de la base de production
  (prérequis carnet-v2 non migré, J-08) ; le formulaire affiche les jours sans nuits.
- **Données réelles** : la production n'a pas les RPC v2 (migrations non appliquées, J-08) ;
  les captures et la comparaison utilisent les données simulées du harnais.

## Écrans / cas non comparables (raison)

| Cas | Raison |
|---|---|
| Aperçu Vercel avec **données réelles** | RPC v2 absentes de la base de production (J-08) → états d'erreur propres du tiroir. La comparaison de structure se fait sur le build à backend simulé. Voir `recette/APERCU-VERCEL-FINAL.md`. |
| **Fiche carnet** ouverte depuis la tuile | Page existante hors tiroir ; ses données ne sont pas mockées dans le harnais → capture squelette (preuve de la navigation, pas de la fiche). |
| **Médias réels / Stockage** | Téléversement simulé ; le rendu compare les composants, pas la qualité des images. |
| **Clavier iPhone, caméra, photothèque, haptique** | Non automatisables ici (pas de Maestro CLI, appareil non piloté) ; voir `recette/PREUVES.md`/`IPHONE.md`. |
| **Drapeau `false`** (tiroirs v1) | Exige un build séparé (drapeau figé au build) ; couvert par `tests/e2e/communaute-v2-flag.spec.ts`, pas par ces captures. |

## Inventaire des 45 captures V2

| Capture | Ce qu'elle montre |
|---|---|
| `explorer-recherche` | volet Recherche à l'ouverture (champ 48 px, chips, tendances, lieux) |
| `explorer-recherche-resultats` | résultats groupés « ecrins », surlignage, filtres |
| `explorer-recherche-sur-la-carte` | bascule « Sur la carte » + carte des résultats |
| `explorer-recherche-erreur` | « Recherche indisponible » + Réessayer (distinct d'un vide) |
| `explorer-etat-chargement` | squelette (latence simulée) |
| `explorer-etat-vide` | état vide « Mes carnets » + CTA de création |
| `explorer-carnets` / `-tri-menu` / `-peek` / `-fiche-existante` | mosaïque, menu de tri, Peek 3 actions, navigation fiche existante |
| `explorer-clubs` / `-filtre-activite` / `-peek` / `-detail` / `-demandes` / `explorer-ile` | chips, peek 3 actions, détail empilé, pile admin « Demandes », île après adhésion |
| `explorer-sorties` / `explorer-agenda-jour` / `-detail` | bande agenda, jour filtré, détail avec RDV/carte/`.ics` |
| `explorer-invite` | lecture seule en session anonyme |
| `creation-publication-etape1/2/3` + `creation-publication-billet` | Format (photo), Contenu (média + légende), Diffusion, variante Billet |
| `creation-publication-erreurs` | compteur « champs à corriger » + erreurs inline uniques |
| `creation-fermeture-confirmation` / `creation-brouillon` / `creation-succes-ile` | confirmation (piège de focus), brouillon restauré, île « Publié » |
| `creation-story-etape1/2/3` + `creation-story-erreur-media` | média 9:16, édition (recadrage/texte), diffusion, validation « média requis » |
| `creation-carnet-etape1/2/3/4` | Infos, Tracé, Jours (sans nuits), Partage |
| `creation-sortie-etape1/2/3/4` | Activité/lieu, Itinéraire, Participants, Sécurité |
| `creation-kit-picker` / `creation-kit-etape1/2/3` | sous-tiroir « Choisir un produit », Inventaire, Compléter, Partager |
| `creation-club-etape1/2/3/4` | Identité, Univers, Adhésion, Publication |
