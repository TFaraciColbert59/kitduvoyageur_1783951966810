# Écarts Explorer — V2 livrée vs maquette de référence

**Date** : 2026-11-08 (Europe/Paris) — passe de comparaison visuelle, lecture seule.
**Périmètre** : tiroir **Explorer** de la Communauté v2 et ses sous-tiroirs — Recherche
(accueil, résultats, carte, erreur, chargement, vide), Carnets (volet, tri, peek, tuile → fiche),
Clubs (volet, filtre activité, détail, demandes, île, peek), Sorties (volet, agenda du jour, détail),
rôle invité, gestes (Échap, glisser) et états de volet.
**Hors périmètre** : tiroir Création (`ECARTS-CREATION.md`), écarts design system transverses
(`ECARTS-TRANSVERSES.md`), index et synthèse (`ECARTS-MAQUETTE.md`).

## Méthode

1. Ouverture réelle des PNG **maquette ET V2** (390×844), appairés côte à côte à l'échelle 1:1
   (montages 786×866), puis recadrages ×2–×3 pour les libellés, les tailles et les teintes douteuses.
2. Confirmation dans le code livré (`grep`/`read` ciblés) pour chaque point incertain : libellé,
   règle CSS, structure DOM, condition d'affichage. Aucune déduction non vérifiée : les points
   non tranchés sont marqués `à vérifier`.
3. Classement : **P1** bloquant/parcours ou accessibilité · **P2** notable (hiérarchie, libellé,
   manque fonctionnel visible) · **P3** cosmétique (pixels, arrondi, densité).
   Statut : `assumé` (exception documentée) · `décidé` (choix du JOURNAL/commentaire de code) ·
   `à corriger` · `à vérifier`.
4. Distinction systématique : (a) **déjà documenté** (cite le document), (b) **non documenté**
   découvert ici, (c) **non comparable** (données simulées, état sans équivalent maquette).

Aucune modification de code, aucun serveur, aucun build lancé. Seul ce fichier est écrit.

## Sources exactes

| Rôle | Chemin |
|---|---|
| Captures V2 (livrée) | `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2/` (48 PNG 390×844, `MANIFEST.json` ; `explorer-clubs-peek.png` ajouté en cours de passe, non dépouillé ici) |
| Captures maquette | `docs/audit/communaute-v2-2026-11-08/recette/captures-maquette/` (58 PNG 390×844) |
| Spec de capture V2 | `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/capture-all.spec.ts` |
| Maquette interactive | `handoff/communaute-v2/annexes/maquette-communaute.html` |
| Specs | `handoff/communaute-v2/01-SPEC-PRODUIT.md`, `02-DESIGN-ET-COMPOSANTS.md`, `00-MISSION.md`, `04-PLAN-IMPLEMENTATION.md` |
| Déjà documenté | `docs/audit/communaute-v2-2026-11-08/integration/RAPPORT-INTEGRATION.md`, `docs/audit/communaute-v2-2026-11-08/COUVERTURE-200.md`, `handoff/communaute-v2/JOURNAL.md`, `docs/audit/communaute-v2-2026-11-08/recette/PREUVES.md` |
| Code comparé | `src/features/community/v2/explore/**`, `src/features/community/v2/shared/**`, `src/styles/communaute-v2.css`, `src/styles/communaute-v2-shell.css` |

Constat de source : le dossier `recette/captures-maquette/` ne contient **aucun `forge-*.png`**
(mentionné dans le brief) ; les références utilisées sont celles qui existent.

## Tableau principal — une ligne par écran/composant

> Convention fichier : `M:` = `recette/captures-maquette/<fichier>`, `V:` = `ecarts-maquette/captures-v2/<fichier>`.
> Les compteurs sont indiqués à côté de la gravité (`P1`, `P2`, `P3`, `—` = non notable / non comparable).

| Écran | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| Coque — position et chrome du tiroir | M:`explorer-recherche.png` | V:`explorer-recherche.png` | V2 : tiroir ouvert **sous la barre haute** (« Explorer », loupe, `+`, cloche) qui reste visible ; maquette : feuille plein écran sous la barre d'état, barre haute absente. Hauteur utile ≈ 80 px de moins. Écart de coque **assumé** par `01 §1-2` (barre haute « rendu actuel conservé », coque `/compte` clippée). | P2 | assumé (`01 §1-2`) |
| Coque — poignée, capsule 56, mini-capsule 30 | M: tous volets | V: tous volets | Poignée 38×5 identique ; capsule 4 icônes 48–56 px, lentille animée présente ; mini-capsule 30 px + bouton de tri 30 px à droite, matériaux conformes. Pas d'écart de structure relevé. | — | conforme |
| Recherche — accueil · tendances | M:`explorer-recherche.png` | V:`explorer-recherche.png` | V2 : icône `sparkles` (kind ≠ place) / `map-pin` (lieu) et sous-titre **« 128 apparitions cette semaine »** ; maquette : icône de tendance unique (flèche) et **« 40 recherches »**. V2 : 5 tendances vs 6 en maquette = données. Eyebrow 11 px vs 10,5 px déjà noté (`COUVERTURE-200` Recherche#6). | P3 | à corriger (libellé + icône) |
| Recherche — accueil · lieux populaires | M:`explorer-recherche.png` | V:`explorer-recherche.png` | Maquette : **tuiles illustrées** (paysage) avec nom + « 128 sorties » ; V2 : cartes verre neutres avec pastille `map-pin`, nom + « 128 apparitions cette semaine ». Perte de l'illustration et du compteur « sorties » (identité visuelle). | P2 | à corriger |
| Recherche — accueil · recherches récentes | M:`explorer-recherche.png` | V:`explorer-recherche.png` | Section absente de la capture V2 : `S.recent` vide dans le mock. Le code la prévoit (`SearchHome.tsx` L31-55, chips supprimables). | — | non comparable (données) |
| Recherche — résultats | M:`recherche-resultats.png`, `explorer-recherche-chamonix.png` | V:`explorer-recherche-resultats.png` | **Écran entièrement vide.** La pane est recouverte par l'aplat de repli de couverture d'un résultat carnet : `.lkdv-cv2x-cover-fallback` est `position:absolute; inset:0` (`explore-v2.css` L56) et `.lkdv-cv2x-search-cover` (L990) n'est **pas** positionné → le repli s'étire sur `.lkdv-cv2-body` (`position:relative`, `communaute-v2-shell.css`). Groupes Carnets/Clubs/Sorties, en-têtes + compteurs, « Voir tout », surlignage, croix « Effacer » : invisibles. `waitFor` passe car la tuile existe mais est recouverte. | P1 | à corriger |
| Recherche — « Sur la carte » | M:`recherche-sur-la-carte.png` | V:`explorer-recherche-sur-la-carte.png` | Capture V2 **invalide** : clic forcé sur « Sur la carte » intercepté par le repli ci-dessus → navigation vers une fiche ; on voit le squelette de `/communaute` + bandeau cookies, tiroir démonté. Recouvrement déjà signalé dans `capture-all.spec.ts` (« Recouvrement CSS connu (.lkdv-cv2x-cover-fallback) »), mais **jamais relié au blank de l'écran résultats**. Carte, repères, légende, bascule Liste/carte non observables côté V2. | P1 | à corriger (même correctif) |
| Recherche — état erreur | M:`recherche-erreur.png` | V:`explorer-recherche-erreur.png` | Structure identique (icône, « Recherche indisponible », « Ce n'est pas “aucun résultat” », Réessayer). V2 : icône en pastille verre **neutre** (maquette : rose/danger) ; bouton Réessayer en pastille blanche 44 px (maquette : pastille fantôme) ; bloc centré verticalement (maquette : sous les chips). | P3 | à corriger (teinte danger) / à vérifier (position) |
| État chargement | M:`etat-st-load.png` | V:`explorer-etat-chargement.png` | Maquette : grille de 6 tuiles skeleton vertes + shimmer, mini-capsule masquée ; V2 : 1 grande tuile + paires de tuiles + barres de titre blanches, mini-capsule et tri conservés. Anatomie/densité du skeleton différentes (`COUVERTURE-200` Recherche#12 parle de lignes). | P3 | à vérifier (design skeleton) |
| État vide | M:`etat-st-empty.png` | V:`explorer-etat-vide.png` | Captures non iso : maquette = lens « Découvrir » (« Aucun carnet à découvrir », illustration montagne 44 px) ; V2 = lens « Mes carnets » (« Aucun carnet pour l'instant », icône livre en pastille). CTA « Créer mon premier carnet » identique ; V2 centre verticalement le bloc, maquette le place sous la capsule. | P3 | à vérifier (états non iso) |
| Carnets — volet | M:`explorer-carnets.png` | V:`explorer-carnets.png` | 1) **Visa** : V2 « 5 j · 62,4 km / 3 VOYAGEURS », sans pays — sans pays est **déjà documenté** (`Carnets#2`) ; la **2e ligne « n VOYAGEURS » est un ajout non documenté** (maquette « FR / 4 J · 62,4 KM »). 2) « En route » en pastille + point au lieu de l'anneau conique — **déjà documenté** (`Carnets#4`). 3) Couvertures : aplats clairs au lieu des illustrations (fixtures sans URL → non comparable). 4) Avatars : initiales 2 lettres (LÉ, TO, IN) vs 1 lettre. 5) Fin de liste « Tu as tout vu. N carnets » (hors maquette). 6) Carte de la semaine : badge identique, hauteur légèrement moindre. | P3 | assumé (`Carnets#2/#4`) + à corriger (visa voyageurs) |
| Carnets — menu de tri | M:`explorer-carnets-tri-menu.png` | V:`explorer-carnets-tri-menu.png` | Conforme : `role=menu`, 4 options 44 px, coche, ancrage au-dessus du bouton 30 px, verre clair, Échap consommée (`RAPPORT-INTEGRATION.md`). Diff : option active plus teintée en V2, largeur ≈ 200 px vs 196 px. | P3 | conforme / à vérifier |
| Carnets — peek (appui long) | M:`explorer-carnets-peek.png` | V:`explorer-carnets-peek.png` | V2 : boîte compacte centrée, média 86×68 → pastille initiales « LM », titre inline, **3 actions sans « Fermer »** ; maquette : carte large avec **bandeau de couverture**, titre + meta, **4 lignes** (dont Fermer), scrim plus dense. Absence de Fermer = `PeekOverlay.tsx` « ni bouton Fermer — la recette E2E en attend exactement trois ». | P2 (aperçu) / P3 (Fermer) | à corriger (aperçu) / décidé (Fermer) |
| Carnets — tuile → fiche | — (détail empilé non capturé côté maquette) | V:`explorer-carnets-fiche-existante.png` | Exception `01 §6` : la tuile **navigue** vers la fiche existante `/carnets/[id]` (Carnets#13 reporté). La capture V2 montre le squelette de la page fiche + bandeau cookies (attente 2,5 s insuffisante), pas le tiroir. Aucune comparaison de structure possible. | — | non comparable (exception documentée) |
| Clubs — volet | M:`explorer-clubs.png` | V:`explorer-clubs.png` | 1) Blason V2 dans un **contenant carré arrondi clair** vs blason SVG nu en maquette ; 2) cadenas à droite du blason (V2) vs coin de carte (maquette) ; 3) « Demander » vs « Demander à rejoindre » ; 4) « Membre ✓ » en **bandeau pâle pleine largeur** — **déjà documenté** (`RAPPORT-INTEGRATION.md` mineur 3) ; 5) avatars 2 lettres vs 1 ; 6) chips 32 px (zone tactile étendue `::after` → 46 px) vs 28 px ; 7) « 2 amis membres » vs « 3 amis » = données. | P2 | à corriger (blason/cadenas/libellé) / assumé (`RAPPORT` 3) |
| Clubs — filtre activité | M:`clubs-filtre-activite.png`, `clubs-chips.png` | V:`explorer-clubs-filtre-activite.png` | La capture maquette n'est **pas filtrée** (liste complète alors que la chip « Escalade » est pressée) → comparaison partielle. V2 filtre correctement (2 clubs) et ajoute « Tu as tout vu. 2 clubs » (hors maquette ; pluriel figé). | P3 | à vérifier (capture maquette) |
| Clubs — détail | M:`explorer-clubs-detail.png` | V:`explorer-clubs-detail.png` | 1) **Capsule 4 volets absente** en V2 (`CommunitySheetShell.tsx` `showCapsule = !detail`) alors que la maquette la conserve au-dessus du `‹ Retour` (`01 §2` « toujours visible »). 2) Action principale : V2 « Quitter le club » (bandeau pâle) là où la maquette affiche « Rejoindre »/« Membre ✓ » ; « Quitter » n'existe en maquette que dans le peek. 3) « Prochaines sorties » : V2 = liens + chevron, **sans bouton S'inscrire** ; maquette = billet compact + action 44 px. 4) « VC VC VO » = mock `public_profiles` incomplet (**déjà non-écart**, `RAPPORT`). 5) `1 / 5` vs `1 / 8` = données. | P2 | à corriger (1-2-3) |
| Clubs — demandes d'adhésion | — (absente de la maquette) | V:`explorer-clubs-demandes.png` | Pile admin **prévue par `04-PLAN-IMPLEMENTATION.md:25`** mais sans équivalent maquette. Capture = île « Demande envoyée · Annuler » + section DEMANDES (1) avec Accepter/Refuser, qui pousse le reste du détail. | — | non comparable (ajout V2 prévu) |
| Île « Club rejoint » | — (aucune capture maquette) | V:`explorer-ile.png` | La maquette possède `island()` mais aucune capture d'île. Capture V2 : île sombre en haut (titre + sous-titre + Annuler), tuile passée à « Membre ✓ ». Aucun référentiel image. | — | non comparable |
| Clubs — peek | M:`clubs-peek.png` | V:`explorer-clubs-peek.png` | Capture V2 ajoutée pendant la passe et **non dépouillée** (consigne d'arrêt). Lecture de code `openClubPeek` : Voir / Rejoindre / Partager (3 actions, sans Fermer), préview sans bandeau blason large ; maquette : bandeau blason + 4 lignes. Même famille que le peek carnet (ligne 13). | P3 | à vérifier (capture non dépouillée) |
| Sorties — volet | M:`explorer-sorties.png` | V:`explorer-sorties.png` | 1) **Action d'inscription hors billet** : V2 la rend dans `.lkdv-cv2x-event-action` **sous** le billet, pleine largeur (`.lkdv-cv2x-join`), alors que la maquette l'insère **dans le pied du billet** à droite de la jauge ; effet « double bandeau » + doublon d'état (« Inscrit » dans le billet et « Inscrit ✓ » dans le bouton). 2) Bascule « Billets / Liste » au lieu de « Grille / Liste » — **déjà connu** (`COUVERTURE-200` Sorties#3). 3) Météo absente des tuiles — **déjà documenté** (Sorties#8). 4) Distance affichée sur **tous** les billets (maquette : seulement « Près de moi »). 5) Niveau en minuscules (« moyen ») vs « Moyen ». 6) Agenda : pastilles plus hautes avec « Dim. » vs lettres « D » ; jour actif sombre dans les deux. 7) Jauge « 9/12 3 places restantes » (fraction en plus vs maquette). | P2 | à corriger (1) / assumé (2-3) / à corriger P3 (4-7) |
| Sorties — jour filtré | — (aucune capture « jour ») | V:`explorer-agenda-jour.png` | Pas de capture maquette d'un jour filtré : comparaison impossible. La capture V2 révèle deux écarts propres : **doublon d'état** « Inscrit » (pied de billet) + « Inscrit ✓ » (bouton), et **« Tu as tout vu. 1 sorties »** (pluriel non géré ; `EventsPane.tsx` label `` `${n} sorties` ``). | P3 | à corriger (pluriel/doublon) |
| Sorties — détail | M:`explorer-sorties-detail.png` | V:`explorer-sorties-detail.png` | 1) **Capsule absente** (idem détail club). 2) Section **SÉCURITÉ** (DVA/Pelle/Sonde/Frontale) ajoutée, hors maquette. 3) Blocs RENDEZ-VOUS (mini-carte + Itinéraire), météo J-7 et lien « Sortie du club » non visibles dans la capture (fixtures sans RDV/météo/club) → blocs non comparables ici. 4) Libellés/format : « Ajouter au calendrier » (sans « (.ics) »), « Voir la fiche de la sortie », « Vendredi 13 Novembre » (majuscule) vs « lundi 9 novembre », heure « 08:00 » vs « 18 h 30 ». 5) « Récap de la sortie » (passée) non visible. | P2 (1) / P3 | à corriger (1) / à vérifier (2-3) |
| Rôle invité | M:`role-invite-explorer.png` | V:`explorer-invite.png` | Non comparable : la maquette capture un **toast du panneau démo** (« Rôle : invité — Rejoindre, aimer et créer demandent une connexion. ») sur le volet Clubs ; la V2 ouvre le volet **Carnets** (défaut) sans marqueur d'invité. Le gating `requireAuth` des écritures n'est pas observable sur une capture statique. | — | non comparable / à vérifier |
| Échap — tiroir / menu de tri | M:`ferme-par-echap.png`, `echap-ferme-menu-seulement.png` | — (non capturé) | Aucune capture V2 des deux séquences. Code/test : `CommunitySheetShell` gère `onEscape` (menu de tri → peek → confirmation → détail → tiroir) et `SortMenuButton` consomme Échap (`RAPPORT-INTEGRATION.md`). | — | à vérifier |
| Glisser entre filtres (LensPager) | M:`explorer-glisser-filtres.png` | — (non capturé en cours de glisser) | LensPager implémenté (mini-capsule + `--i`, verrou d'axe, seuil) ; aucune capture V2 du geste en cours. | — | à vérifier |
| États d'erreur des volets (Carnets/Clubs/Sorties) | M:`etat-st-err.png` | — (non capturé) | Seule l'erreur Recherche est capturée côté V2. Les états `ExploreError` des 3 volets (`Carnets indisponibles`, etc.) ne sont pas comparés visuellement. | — | à vérifier |
| État hors-ligne | M:`etat-st-off.png` | — (non capturé) | Aucune capture V2 hors-ligne ; `ExploreOfflineBanner` existe dans le code mais n'est pas prouvé visuellement. | — | à vérifier |

## Écarts transverses Explorer

1. **Deux niveaux de chrome en V2.** Barre haute `/communaute` visible + tiroir clippé `snap card`
   (`01 §1-2`) : la hauteur utile est inférieure à la maquette, qui montre une feuille plein écran
   sous la barre d'état. Assumé, mais c'est la source de tous les décalages verticaux écran par écran.
2. **Capsule 4 volets masquée dès qu'un détail est empilé** (`CommunitySheetShell.tsx:382`,
   `showCapsule = !detail`) : la maquette la conserve au-dessus du `‹ Retour` dans le détail club et
   le détail sortie. Écart structurel répété (`01 §2` : capsule « toujours visible »).
3. **Matériau/fond des blasons de club.** V2 : blason dans un contenant carré arrondi clair ;
   maquette : blason SVG nu, plus grand visuellement. Répété tuile, club du mois, détail.
4. **Avatars.** V2 : initiales sur 2 lettres ; maquette : 1 lettre. Répété carnets, clubs, membres.
5. **Actions d'écriture hors des tuiles.** V2 : bouton d'action en **bandeau pâle/pleine largeur sous
   la tuile** (Rejoindre/Membre/Demander, S'inscrire, Inscrit) ; maquette : pastille dans le pied de
   la tuile/billet. Conséquence : doublons d'état visibles (« Inscrit » + « Inscrit ✓ »).
   Déjà signalé pour les clubs (`RAPPORT` mineur 3), **non documenté pour les sorties**.
6. **Densité.** V2 aère davantage : sections de détail espacées de 10 px, blocs plus hauts,
   écart entre titre et meta plus grand ; la maquette est plus dense (mêmes tailles de texte
   toutefois : titres 600 14 px, méta 10,5 px, testé par ailleurs).
7. **Formats de date/heure.** V2 : « Vendredi 13 Novembre », « 08:00 » ; maquette : « lundi 9 novembre »,
   « 18 h 30 » (détail). Le format `formatTime` est réutilisé partout (liste = « 18:30 » dans les deux).
8. **Libellés de fin de liste.** V2 généralise « Tu as tout vu. N carnets/sorties/clubs » à tous les
   volets (maquette : uniquement lens Découvrir Carnets), avec pluriel figé (« 1 sorties »).
9. **Squelettes.** V2 : skeleton unique grand format (1 grande tuile + paires + barres), fond clair ;
   maquette : 6 tuiles vertes uniformes. Anatomie différente mais rôle identique (Recherche#12).
10. **États vides.** V2 : icône dans pastille + bloc centré verticalement ; maquette : illustration
    pleine (SVG paysage) + bloc en haut de pane. Le CTA est identique (pill primaire sombre).

## Écrans non comparables (raison)

| Écran | Capture V2 | Raison |
|---|---|---|
| Recherche — recherches récentes | `explorer-recherche.png` | `S.recent` vide dans les fixtures (le code rend la section si non vide) : différence de donnée, pas d'écart UI. |
| Recherche — « Sur la carte » | `explorer-recherche-sur-la-carte.png` | Capture invalide : navigation déclenchée par le recouvrement CSS (bug P1) ; l'écran carte n'a pas été capturé. |
| Carnets — tuile → fiche | `explorer-carnets-fiche-existante.png` | Exception documentée `01 §6` (navigue vers `/carnets/[id]`, Carnets#13 reporté) ; capture = squelette de chargement de la fiche + bandeau cookies. |
| Clubs — demandes d'adhésion | `explorer-clubs-demandes.png` | Bloc admin sans équivalent dans la maquette (prévu `04-PLAN-IMPLEMENTATION.md:25`). |
| Clubs — île « Club rejoint » | `explorer-ile.png` | Aucune capture d'île dans la maquette (fonction `island()` présente mais non capturée). |
| Rôle invité | `explorer-invite.png` | La maquette montre un toast de démonstration de rôle sur le volet Clubs ; V2 ouvre Carnets ; gating non observable en capture. |
| Couvertures de carnets / blasons d'illustration | `explorer-carnets*` | Fixtures sans URL Storage : aplats de repli côté V2 (limite documentée `RAPPORT-INTEGRATION.md`, « couvertures absentes »). |
| Agenda du jour | `explorer-agenda-jour.png` | Aucune capture maquette d'un jour filtré (seul le volet par défaut est capturé). |
| Détail sortie — RDV/météo/club | `explorer-sorties-detail.png` | Fixtures sans point de RDV, sans météo, sans club : blocs absents côté V2, non comparables en l'état. |
| Peek club | `explorer-clubs-peek.png` | Capture V2 ajoutée en fin de passe, non dépouillée (consigne d'arrêt) ; à traiter comme la ligne peek carnet. |

## Déjà documenté ailleurs (ne pas recompter comme nouveauté)

- Contacts/couvertures : `RAPPORT-INTEGRATION.md` (couvertures absentes, initiales mock « VC VC VO »,
  bouton « Membre ✓ » en bandeau pâle, mineur 3).
- Numérotation produit : `COUVERTURE-200.md` — Carnets#2 (visa sans pays), Carnets#4 (pas d'anneau
  conique), Carnets#19 (« Tout voir » absent), Sorties#3 (« Billets » au lieu de « Grille »),
  Sorties#8 (météo absente des tuiles), Clubs#3 (chips sans icône), Recherche#6 (eyebrow 11 px),
  Recherche#12 (skeleton lignes), exclusions `01 §6` (Carnets#13, Sorties#14/#15).
- Décisions : `JOURNAL.md` J-01…J-13 (aucune ne couvre les écarts ci-dessus sauf mention explicite) ;
  `PeekOverlay.tsx` documente les 3 actions sans Fermer.
- Limites : `recette/PREUVES.md`.
- Le recouvrement `.lkdv-cv2x-cover-fallback` est signalé **en passant** dans `capture-all.spec.ts`
  (clic forcé « Sur la carte »), sans analyse de son effet sur l'écran résultats.

## Top 8 à corriger en priorité (P1/P2, action concrète, fichier probable)

| # | Gravité | Action | Fichier probable |
|---|---|---|---|
| 1 | **P1** | Rendre le repli de couverture contenu : `position: relative` sur `.lkdv-cv2x-search-cover` (et vérifier `.lkdv-cv2x-search-media`) pour que `.lkdv-cv2x-cover-fallback` reste dans sa vignette 52×48. Conséquence attendue : résultats visibles, clic « Sur la carte » non intercepté. Ajouter une capture de contrôle + un test qui vérifie que la bascule Liste/carte est cliquable quand un résultat carnet n'a pas de couverture. | `src/features/community/v2/explore/explore-v2.css` (L56 et L990) |
| 2 | **P1** | Rejouer la capture `recette-sur-la-carte` après correctif #1 (elle est aujourd'hui invalide) et vérifier carte + repères + légende + bascule contre `recherche-sur-la-carte.png`. | `capture-all.spec.ts` (scénario carte) |
| 3 | **P2** | **Capsule visible dans les détails empilés** : ne pas la masquer quand `detail` est ouvert (ou décider et tracer au JOURNAL). La maquette la conserve au-dessus du `‹ Retour`. | `src/features/community/v2/shared/CommunitySheetShell.tsx` (`showCapsule = !detail`, L382) |
| 4 | **P2** | **Sorties : réintégrer l'action dans le pied du billet** (ou assumer et documenter le bandeau). Corriger le doublon d'état « Inscrit » + « Inscrit ✓ » et la pleine largeur. | `src/features/community/v2/explore/tiles/EventTicketV2.tsx` + `explore-v2.css` (`.lkdv-cv2x-event-action`, `.lkdv-cv2x-join`) |
| 5 | **P2** | **Détail club** : remplacer « Quitter le club » par l'état d'adhésion de la maquette (« Membre ✓ ») et laisser « Quitter » au peek ; ajouter l'action S'inscrire aux « Prochaines sorties » (billet compact). | `src/features/community/v2/explore/details/ClubDetailView.tsx` |
| 6 | **P2** | **Lieux populaires** : restaurer la tuile illustrée (couverture + compte « N sorties ») au lieu de la carte pastille + « apparitions » ; et libeller les tendances « N recherches » avec l'icône de tendance de la maquette. | `src/features/community/v2/explore/search/SearchHome.tsx` |
| 7 | **P2** | **Peek carnet/club** : rendre le bandeau d'aperçu (couverture/blason) et une boîte plus large comme la maquette ; trancher l'ajout de « Fermer » (aujourd'hui `PeekOverlay.tsx` impose 3 actions pour l'E2E). | `src/features/community/v2/explore/details/PeekOverlay.tsx` |
| 8 | **P3** | Libellés/format à corriger en lot : visa « n VOYAGEURS » (CarnetTileV2), pluriel « 1 sorties/carnets/clubs » (`ExploreStates.tsx` L175 + labels des panes), « Demander à rejoindre », distance affichée hors « Près de moi », niveau « moyen » → « Moyen », « Ajouter au calendrier (.ics) ». | `CarnetTileV2.tsx`, `ExploreStates.tsx`, `ClubTileV2.tsx`, `EventTicket.tsx`, `EventDetailView.tsx` |

## Synthèse

- **28 lignes** au tableau : 19 captures V2 ouvertes, 14 comparaisons valides, 10 écrans/blocs non comparables (dont 3 liés à des données simulées et 2 à des exceptions documentées), 4 points de geste/état sans capture V2.
- **Gravité** : **P1 = 2** · **P2 = 7** · **P3 = 9** · non notables/conformes = 2 · à vérifier = 8.
- **Écarts non documentés découverts = 14**, dont 2 P1 (résultats masqués par le repli de couverture,
  clic « Sur la carte » intercepté) ; les 12 autres sont P2/P3 (capsule en détail, action de sortie
  hors billet, Quitter le club, pas d'inscription depuis le détail club, lieux populaires sans
  illustration, peek sans bandeau, visa « n VOYAGEURS », pluriel « 1 sorties », distance partout,
  « Demander » au lieu de « Demander à rejoindre », blason/cadenas, section Sécurité du détail sortie).
- **Écarts déjà documentés réutilisés = 9** (Carnets#2, Carnets#4, Carnets#13, Sorties#3, Sorties#8,
  Clubs#3, Recherche#6, Recherche#12, `RAPPORT` mineur 3) + limites `RAPPORT` (couvertures, initiales).
- **Verdict** : le squelette du tiroir est fidèle (capsule, mini-capsule, tri, peek, états, îles,
  mémoire), mais deux régressions bloquantes (P1) rendent l'écran de résultats inutilisable et le
  geste « Sur la carte » inopérant ; les écarts P2 restants sont des écarts de composition visuelle
  répétés (capsule en détail, action hors tuile, blasons, lieux populaires), corrigeables sans
  toucher à l'architecture.
