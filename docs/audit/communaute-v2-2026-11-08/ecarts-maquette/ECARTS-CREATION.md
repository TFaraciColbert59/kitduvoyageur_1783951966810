# Écarts Création — Communauté v2 livrée vs maquette

**Date** : 2026-11-08
**Captures** : les captures V2 ont été **régénérées le 2026-11-08** (même build V2, harnais
`docs/audit/communaute-v2-2026-11-08/ecarts-maquette/capture-all.spec.ts`) ; les 3 captures
Publication (étapes 1/2/3) sont désormais **distinctes et correctement étiquetées**.
**Périmètre** : tiroir **Création** de la Communauté v2 livrée (`NEXT_PUBLIC_COMMUNAUTE_V2=true`) —
6 types (Publication, Story, Carnet, Sortie, Kit, Club), toutes les étapes, le sous-tiroir
« Choisir un produit » du Kit, et les états transverses (erreurs, brouillon, confirmation de
fermeture, île de succès).
**Hors périmètre** : tiroir Explorer (voir `ECARTS-EXPLORER.md`), styles transverses généraux
(voir `ECARTS-TRANSVERSES.md`), corrections de code (aucune modification effectuée).

## Méthode

1. **Ouverture réelle des captures** (390×844) : les 28 captures V2 `captures-v2/creation-*.png`
   et les captures maquette pertinentes de `recette/captures-maquette/` (30 fichiers ; les
   **doublons d'étapes** de la référence ont été identifiés par empreinte SHA-256, voir §
   « Anomalies d'étiquetage »). Aucune comparaison « de mémoire ».
2. **Lecture ciblée du code livré** pour les libellés, règles et champs non visibles sur les
   captures : `create/engine/steps.ts`, `create/engine/createSchemasV2.ts`,
   `create/engine/CreateFormEngineV2.tsx`, `create/engine/useDraftV2.ts`, `create/CreateSheetV2.tsx`,
   `create/forms/*.tsx`, `create/kit/ProductPickerSheetV2.tsx`, `create/create-v2.css`,
   `shared/CommunitySheetShell.tsx`, `src/styles/communaute-v2-shell.css`.
3. **Lecture de la référence maquette** : `handoff/communaute-v2/annexes/maquette-communaute.html`
   (moteur de création L2660-2760, formulaires L2797-3330), `01-SPEC-PRODUIT.md` § 4,
   `02-DESIGN-ET-COMPOSANTS.md`, `annexes/D-document-refonte.md` (exigences numérotées
   `Publication#n` … `Club#n`), et les documents déjà produits
   (`integration/RAPPORT-INTEGRATION.md`, `COUVERTURE-200.md`, `JOURNAL.md`, `recette/PREUVES.md`).
4. **Conventions de gravité** : **P1** bloquant parcours/accessibilité · **P2** notable
   (champ/libellé/étape manquants, hiérarchie, règle métier) · **P3** cosmétique.
   **Statuts** : `assumé` (exception documentée `01 § 6`/JOURNAL), `décidé` (choix tracé dans
   `steps.ts`/spec), `à corriger`, `à vérifier` (doute ou capture insuffisante).
   Chaque différence porte son tag `[P1]/[P2]/[P3]` ; les compteurs de synthèse comptent les
   **occurrences taguées** (une même cause transverse peut apparaître sur plusieurs écrans).

## Synthèse

| Indicateur | Valeur |
|---|---|
| Types de création comparés | **6 / 6** (Publication, Story, Carnet, Sortie, Kit, Club) |
| Étapes + sous-tiroir comparés | **22** (3+3+4+4+3+1+4) + **4 états transverses** = **26 écrans** |
| Étapes/ordre/libellés d'étapes | **conformes** aux deux références (mêmes 3/4 étapes, mêmes libellés, mêmes actions finales) |
| Écarts recensés (occurrences taguées : tableau + transverses) | **P1 : 0 · P2 : 29 · P3 : 112** |
| Écarts **non documentés** découverts | **13** — 9 P2 + 4 P3 (liste § « Nouveaux écarts non documentés » ; ils sont déjà comptés ci-dessus, la section les reclasse par statut) |
| Écrans **non comparables** | **14 familles** (liste en § dédiée) |
| Anomalies d'étiquetage de captures | **V2 : 4 captures** · **maquette : 6 familles de doublons** (voir § dédiée) |

> **Aucun P1 confirmé** sur les états capturés. Les deux défauts majeurs déjà routés par
> `RAPPORT-INTEGRATION.md` (libellé « Point de rendez-vous » dupliqué, mini-capsule qui recouvre
> le contenu) restent classés **P2** ici : ils dégradent la lecture mais ne bloquent ni le
> parcours ni les actions.

---

## Tableau principal — une ligne par type × étape (et par sous-tiroir)

Légende des captures : `M` = maquette (`docs/audit/communaute-v2-2026-11-08/recette/captures-maquette/`),
`V2` = build livré (`docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2/`).
`HTML` = `handoff/communaute-v2/annexes/maquette-communaute.html`.

### Publication — 3 étapes (`POST_STEPS` : Format, Contenu, Diffusion)

| Écran / étape | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| **Format** | M `creation-publication-etape1.png`, `pub-etape1-remplie.png` ; HTML L2797-2820 | V2 `creation-publication-etape1.png` ; `forms/PostFormV2.tsx` L28-53, L90-206 | [P3] cartes format : icône **au-dessus** du libellé (M) vs icône **à gauche** (V2) ; [P3] « Photo / vidéo » → « Photo » (vidéo reportée `01 § 6`) ; [P2] « Événement » : **radio** de la grille + note + bouton « Créer dans Sortie » (M) vs **carte-bouton** qui bascule immédiatement sur le formulaire Sortie (V2), sans `role=radio` dans le radiogroup (cf. T10a) ; [P3] cartes audience : icônes globe/users/lock à gauche + pastille à droite (M) vs pastille seule à gauche (V2) ; [P2] audience « Un club » expose un champ technique « **Identifiant du club (repli)** » (UUID) absent de la maquette ; [P3] pas de placeholder visuel d'image dans l'aperçu V2 (carte texte) vs visuel « meadow » (M) ; Retour désactivé visible (M) vs masqué (V2, décidé `01 §4.1`, cf. T3a) ; [P3] « Suivant » sans chevron (V2). | P2 | à corriger (fallback club, Événement) / décidé (Retour) / à vérifier (aperçu) |
| **Contenu** | M `pub-etape2-contenu.png` (état vide), `creation-publication-etape2.png` ; HTML L2821-2837 | V2 `creation-publication-etape2.png` (régénérée : étape 2 réelle — média + légende) ; `PostFormV2.tsx` L208-273, `fields/MediaFieldV2.tsx` | [P3] libellés : « Photos et vidéos * » + compteur dans le libellé (M) vs « PHOTOS » + « 1 / 10 » sous le libellé (V2) ; [P3] « Ajouter une photo ou une vidéo » (M) vs « Ajouter une photo » (V2) ; [P2] médias en **lignes** (vignette, poignée, « Média 1 », « Envoyé », « Décrire l'image », supprimer 44 px ; HTML L2822-2827) vs **mosaïque de vignettes** avec poignée/suppression en overlay et badge « Couverture » (V2) — recadrage/alt toujours derrière un appui, non visibles sur la capture ; [P2] **légende obligatoire** en V2 (« Écris une légende. ») alors que la maquette ne l'exige pas pour le format Photo (règle de schéma, non observable sur cette capture où la légende est saisie) ; message média « Ajoute au moins une photo. » vs « …une photo ou une vidéo. » (cf. T4b) ; [P3] rappel doux « N images sans texte alternatif » absent du flux (alt derrière appui) ; [P3] section « Recadrage » 4:5/1:1/Original + grille non visible sans appui ; [P3] compteur 0/2000 (V2, formats billet/question) vs 600 max (M) ; [P3] la mini-capsule recouvre le haut du champ Légende et le hint (cf. T2a). | P2 | à corriger (légende, affordance recadrage/alt) / à vérifier (messages) / état « média ajouté » absent de la capture maquette (comparé au HTML) |
| **Diffusion** | M `pub-etape3-diffusion.png` = **doublon** de `pub-etape2-contenu.png` (aucune capture maquette exploitable de l'étape Diffusion) ; HTML L2838-2846 | V2 `creation-publication-etape3.png` (régénérée : étape 3 réelle) ; `PostFormV2.tsx` L275-312 | [P3] récap V2 « Diffusion / Fil public / Photo · 1 photo » vs récap maquette (format·audience, médias, commentaires, j'aime, programmation ; HTML L2846) ; [P3] V2 ajoute des champs **Hashtags** (chips + champ) et **Mentions** séparés, absents de la maquette (suggestions inline) ; [P3] commentaires/j'aime : interrupteurs réels (M) vs segment **inerte** « Activés/Masqués » + mention « prochaine version » (V2, reporté `01 § 6`, option non masquée) ; [P3] programmation absente (reporté `01 § 6`) ; [P3] densité : la mini-capsule recouvre le libellé « Commentaires et j'aime » et le hint de version (cf. T2a) ; [P3] action finale « Publier » et pied Retour conformes. | P3 | assumé (reportés) / à vérifier (UI inerte vs « masquer ») / maquette non exploitable (doublon) |

### Story — 3 étapes (`STORY_STEPS` : Média, Édition, Diffusion)

| Écran / étape | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| **Média** | M `story-e1.png` ; HTML L2878-2898 | V2 `creation-story-etape1.png` ; `forms/StoryFormV2.tsx` L76-122, L582-650, `story/StoryStageV2.tsx` | [P2] M : aperçu compact 150 px « Story · 24 h / Ajoute un média / Tout le monde · réponses ouvertes » + 2 pilules Galerie/Caméra + libellé « PHOTO OU VIDÉO * » **au-dessus** ; V2 : **scène 9:16 plein cadre** (~500 px) avec texte vide, barre interne « Galerie / Caméra » segmentée, libellé/hint rejetés **sous la scène** et recouverts par la mini-capsule (cf. T2a) ; [P2] le champ média n'est plus lisible comme un champ (label/hint sous la ligne de flottaison) ; [P3] pas de méta « Story · 24 h / audience · réponses » dans V2 ; [P3] Galerie/Caméra : 2 boutons (M) vs 1 segment (V2) ; Retour masqué (V2, décidé, cf. T3a). | P2 | à corriger (hiérarchie) / décidé (Retour) |
| **Édition** | M `story-e2-edition.png` = **doublon** de `story-e1.png` ; HTML L2899-2905 | V2 `creation-story-etape2.png` ; `StoryFormV2.tsx` L123-518 | [P2] éditeur : carte « Éditeur plein cadre » + bouton « Ouvrir l'éditeur » (M) vs **scène toujours affichée et édition inline** (V2, décidé `Story#2`) ; [P3] pas de boutons zoom ± ni « Remplacer » (M) — V2 : pincement + « Galerie » ; [P3] liste des **calques** (V2) vs liste des éléments (M) ; [P3] lien : champ « Lien (sticker) » + bouton « Ajouter en sticker » + validation live (M) vs champs Lien/Titre + « Retirer le lien » (V2), validation affichée à l'étape ; [P3] légende et texte alternatif sous la scène, souvent sous la ligne de flottaison (V2) ; [P3] rognage vidéo : curseurs en étape 1 (M) vs en étape 2 (V2). | P2 | décidé (`Story#2`) / à vérifier (zoom, lien) |
| **Diffusion** | M `story-e3-diffusion.png` = **doublon** de `story-e1.png` ; HTML L2906-2908 | V2 `creation-story-etape3.png` ; `StoryFormV2.tsx` L519-580 | [P2] pas de section « **Aperçu final exact** » libellée (M) — la scène V2 sert d'aperçu permanent ; [P2] lien carnet + choix du **jour** : dans la diffusion (M) vs dans l'édition (V2), et pas de choix de jour (partiel documenté `Story#11`) ; [P3] réponses : segment 3 options (V2) vs cartes radio 3 options avec descriptions (M) ; [P3] audiences 4 valeurs et switch de partage conformes. | P2 | partiel documenté (`Story#11`) / à vérifier |

### Carnet — 4 étapes (`CARNET_STEPS` : Infos, Tracé, Jours, Partage)

| Écran / étape | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| **Infos** | M `carnet-e1-infos.png`, `creation-carnet-etape1.png` ; HTML L2976-2981 | V2 `creation-carnet-etape1.png` ; `forms/CarnetFormV2.tsx` L38-121 | [P2] **aperçu vivant en tête** (couverture, titre, destination, jours, km, visibilité, voyageurs) absent en V2 (partiel documenté `Carnet#10`) ; [P2] « **Nombre de jours** » + hint « Proposé à partir des dates, et inversement » dans Infos (M) vs pas de stepper en Infos (proposition reportée à l'étape Jours) ; [P3] V2 ajoute **Voyageurs** (stepper) et **Visibilité** (cartes) en Infos alors que la maquette les place au Partage ; [P3] destination : champ + « Ma position » (V2) vs champ + chips de suggestions (M) ; [P3] « Récit » avec bouton IA (V2) vs chips « Aide à l'écriture » (M) ; [P3] titre max 140 (V2) vs 100 (M) ; [P3] dates natives `mm/dd/yyyy` (limite harnais documentée `RAPPORT-INTEGRATION` mineur #5). | P2 | partiel documenté (`Carnet#10`) / à corriger (jours) / décidé (placement) |
| **Tracé** | M `carnet-e2-trace.png` = **doublon** de `carnet-e1-infos.png` ; HTML L2982-2995 | V2 `creation-carnet-etape2.png` ; `CarnetFormV2.tsx` L123-146, `carnet/TracePaneV2.tsx` L390-600 | [P2] « **DISTANCE** »/« **DÉNIVELÉ** » affichés **deux fois** (rangée métrique de `TracePaneV2` puis `NumberFieldV2` de `TraceStep`) — visible sur la capture ; [P3] carte : SVG topo (M) vs MapLibre (écran blanc en capture, non comparable) ; [P3] « point de départ » en 3 cartes (tracer / GPX / sortie enregistrée) vs boutons d'import directs (V2) ; [P3] pas de suppression de segment ni déplacement de point intermédiaire (partiel documenté `Carnet#8`) ; [P3] profil d'altitude sans cadre « Profil d'altitude » (V2) ; [P3] annuler/rétablir conformes. | P2 | à corriger (doublon) / partiel documenté (`Carnet#8`) / non comparable (carte) |
| **Jours** | M `carnet-e3-jours.png` = **doublon** de `carnet-e1-infos.png` ; HTML L3006-3012 | V2 `creation-carnet-etape3.png` ; `carnet/DaysPaneV2.tsx` | [P2] V2 démarre à **0 jour** (état vide « Aucun jour pour l'instant. Ajoute un jour… ») vs **3 jours par défaut** synchronisés aux dates (M) ; [P3] onglets de jours + bouton + (V2) vs mini-capsule de jours + pager glissable (M, partiel documenté `Carnet#11`) ; [P3] moments typés (6 types) conformes ; [P3] nuits masquées en prod (assumé `Carnet#13` / `JOURNAL` J-03) ; [P3] pas de glisser entre jours (partiel `Carnet#11`). | P2 | à vérifier (0 jour) / partiel documenté |
| **Partage** | M `carnet-e4-partage.png` = **doublon** de `carnet-e1-infos.png` ; HTML L3008-3012 | V2 `creation-carnet-etape4.png` ; `CarnetFormV2.tsx` L148-352 | [P2] voyageurs : chips d'amis + « Inviter par lien » (M) vs switch « Carnet collaboratif » + `@handle` (V2), **sans lien d'invitation** ; [P3] visibilité en Partage (M) vs en Infos (V2) ; [P3] V2 ajoute **Hashtags** et un switch « Publier une annonce dans le fil » absents de la maquette ; [P3] aperçu fiche V2 = carte récap sans tracé/visa/couverture (partiel documenté `Carnet#10`) ; [P3] couverture : grille de photos (M) vs hint « Ajoute des photos… » (V2, même repli sans photo). | P2 | partiel documenté / à vérifier (invitation) |

### Sortie — 4 étapes (`SORTIE_STEPS` : Activité et lieu, Itinéraire, Participants, Sécurité)

| Écran / étape | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| **Activité et lieu** | M `sortie-e1.png`, `creation-sortie-etape1.png` ; HTML L3018-3035 | V2 `creation-sortie-etape1.png` ; `forms/SortieFormV2.tsx` L112-179, `sortie/MeetingMapV2.tsx` | [P2] **date + heure** (+ récurrence) dans l'étape 1 (M) vs étape 2 (V2, décidé `steps.ts`) — le billet prévisualisé n'affiche pas la date/heure à l'étape 1 ; [P3] billet : topo + météo + « 0 km · +0 m · 1 h » (M) vs pas de topo/météo et méta réduite (V2) ; [P3] chips activités : icônes linéaires (M) vs emoji (V2) ; [P3] V2 ajoute « Ma position » au lieu et une **photo de couverture** (absents M) ; [P3] carte RDV : topo SVG + épingle + coordonnées (M) vs MapLibre blanche + « Touche la carte pour placer le rendez-vous » (V2, non comparable) ; [P2] libellé « **Point de rendez-vous** » affiché deux fois (documenté `RAPPORT-INTEGRATION` majeur #1) ; [P3] pas de ligne « coordonnées enregistrées » visible (V2). | P2 | décidé (placement) / à corriger (doublon documenté) / non comparable (carte) |
| **Itinéraire** | M `sortie-e2-itineraire.png` = **doublon** de `sortie-e1.png` ; HTML L3036-3044 | V2 `creation-sortie-etape2.png` ; `SortieFormV2.tsx` L181-354 | [P2] **3 niveaux** (Facile/Moyen/Difficile) en V2 vs **échelle 5 niveaux** (Très facile → Expert) avec définition (M) ; [P3] date/heure/fin + météo + récurrence remontées ici (V2) vs étape 1 (M) ; [P3] import : 3 familles (trace / carnet / itinéraire) en cartes (M) vs bouton GPX unique (V2, partiel documenté `Sortie#5`) ; [P3] distance/D+ : steppers (M) vs champs numériques (V2) ; [P3] pas de météo dans le billet d'aperçu (V2). | P2 | à corriger (niveaux) / décidé (placement) / partiel documenté (`Sortie#5`) |
| **Participants** | M `sortie-e3-participants.png` = **doublon** de `sortie-e1.png` ; HTML L3045-3049 | V2 `creation-sortie-etape3.png` ; `SortieFormV2.tsx` L356-484 | [P3] capacité/jauge/liste d'attente conformes ; [P3] « Inviter des amis / un club » absents (reporté `Sortie#11`, assumé) ; [P3] club + kit via bouton « Choisir un club et un kit » (V2) vs chips directes (M) ; [P3] pas de carte « Aperçu de la jauge » encadrée (V2 affiche la jauge inline). | P3 | assumé (`Sortie#11`) / à vérifier (chargement à la demande) |
| **Sécurité** | M `sortie-e4-securite.png` = **doublon** de `sortie-e1.png` ; HTML L3050-3053 | V2 `creation-sortie-etape4.png` ; `SortieFormV2.tsx` L486-527, `createSchemasV2.ts` L554-573 | [P2] règle « **DVA obligatoire pour le ski de rando** » absente du schéma V2 (la maquette la valide) ; [P3] 8 chips (dont Carte, Trousse) en V2 vs 6 (M) ; [P3] « Matériel requis » (kit + chips d'objets) dans Sécurité (M) vs kit choisi en Participants (V2) ; [P3] switch « Publier une annonce dans le fil » en V2, absent de la maquette ; [P3] consignes + programme conformes. | P2 | à corriger (règle DVA) / décidé (annonce) / à vérifier |

### Kit — sous-tiroir sélecteur + 3 étapes (`KIT_STEPS` : Inventaire, Compléter, Partager)

| Écran / étape | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| **Sélecteur produit** (sous-tiroir) | Aucune capture M ; HTML L3200-3210 (vue `kit-pick`) | V2 `creation-kit-picker.png` ; `kit/ProductPickerSheetV2.tsx` | [P3] sous-tiroir empilé avec `‹ Retour`, titre + sous-titre (V2) vs vue `kit-pick` (M) — conforme `Kit#2` ; [P3] V2 ajoute des chips de catégories ; [P3] « Ajouter »/« Panier » par ligne (V2) vs « Ajouter »/« Acheter » (M) ; inventaire et boutique **vides** dans la fixture → listes non comparables. | P3 | conforme (`Kit#2`) / non comparable (données) |
| **Inventaire** | M `kit-e1-inventaire.png` ; HTML L3170-3176 | V2 `creation-kit-etape1.png` ; `forms/KitFormV2.tsx` L125-452 | [P2] **aperçu KitCard en tête** absent en V2 (partiel documenté `Kit#17`) ; [P2] « **Partir de** » (kit existant / carnet / modèle / vide) absent (non fait documenté `Kit#4`) ; [P3] anneau de poids + « sac en couches » absents (partiel `Kit#5`) — V2 a une barre de poids + objectif ; [P3] groupes de catégories **vides masqués** en V2 (M montre les 6) ; [P3] objet personnalisé : libellés visibles + chips catégorie + stepper (M) vs placeholders + `select` + `input number` (V2, partiel `Kit#10`) ; [P3] Scanner absent (reporté `Kit#3`). | P2 | documenté (`Kit#4/#5/#17`) / à corriger (libellés objet perso) |
| **Compléter** | M `kit-e2-completer.png` = **doublon** de `kit-e1-inventaire.png` ; HTML L3176-3190 | V2 `creation-kit-etape2.png` ; `KitFormV2.tsx` L454-505 | [P2] pas de « sac en couches » + anneau `KitRing` ni objectif **sélectionnable** (M) — V2 : % de complétude + barre en Inventaire (partiel `Kit#5/#6`) ; [P2] suggestions **non actionnables** en V2 (liste texte) vs boutons « Ajouter » (M, cf. N9) ; [P3] mode préparation / unités impériales absents (partiel `Kit#11/#15`) ; [P3] saison 5 valeurs (V2) vs 3 (M) ; [P3] modèle (journée/bivouac/alpi…) absent en V2 (suggestions sur modèle figé, partiel `Kit#9`) ; [P3] couverture photo en étape 2 (V2) vs étape 3 (M). | P2 | partiel documenté / à vérifier (suggestions) |
| **Partager** | M `kit-e3-partager.png` = **doublon** de `kit-e1-inventaire.png` ; HTML L3190-3195 | V2 `creation-kit-etape3.png` ; `KitFormV2.tsx` L507-570 | [P3] nom : hint « proposé automatiquement » + lien « Revenir au nom proposé » (M) vs auto-remplissage silencieux (V2) ; [P3] description en étape 3 (M) vs étape 2 (V2) ; [P3] visibilité 3 valeurs (M) vs 2 (V2, assumé `Kit#14`) ; [P3] couverture par chips (M) vs photo en étape 2 (V2, `Kit#1` fait) ; [P3] récap V2 maison (partiel `Kit#17`). | P3 | assumé (`Kit#14`) / partiel documenté |

### Club — 4 étapes (`CLUB_STEPS` : Identité, Univers, Adhésion, Publication)

| Écran / étape | Maquette (fichier) | V2 (fichier) | Différences observées | Gravité | Statut |
|---|---|---|---|---|---|
| **Identité** | M `club-e1-identite.png`, `creation-club-etape1.png` ; HTML L3270-3278 | V2 `creation-club-etape1.png` ; `forms/ClubFormV2.tsx` L76-179 | [P2] image : **avatar carré + bannière 3:1** (M) vs **un seul média** avec recadrage 1:1/3:1 (V2) — impossible d'avoir les deux ; [P2] activités **requises et placées en Identité** (M) vs déplacées en Univers et **non requises** par le schéma V2 ; [P3] zone d'activité (lieu + mini-carte + rayon) en Identité (M) vs texte + chips de rayon en Univers (V2, partiel `Club#4`) ; [P3] adresse affichée deux fois (aperçu URL + input, V2) vs préfixe inline unique (M) ; [P3] aperçu V2 ajoute une ligne « admin » ; [P3] pas de hint « Plusieurs choix possibles » en Identité V2. | P2 | à corriger (image, activité requise) / décidé (placement) / partiel (`Club#4`) |
| **Univers** | M `club-e2-univers.png` = **doublon** de `club-e1-identite.png` ; HTML L3290-3292 | V2 `creation-club-etape2.png` ; `ClubFormV2.tsx` L181-264 | [P2] activités + description + zone (V2) vs avatar/bannière + description (M) — **activités déplacées** hors de l'Identité ; [P3] 8 activités (V2) vs 5 (M) + champ libre « Autre activité… » ; [P3] pas de note « l'image n'est plus obligatoire » ; [P3] chips rayon 25/50/100/200 km (V2) vs stepper rayon 5-60 (M). | P2 | décidé (`steps.ts`) / à vérifier |
| **Adhésion** | M `club-e3-adhesion.png` = **doublon** de `club-e1-identite.png` ; HTML L3295-3299 | V2 `creation-club-etape3.png` ; `ClubFormV2.tsx` L266-411 | [P3] cartes Ouvert/Sur validation conformes ; [P3] questions d'adhésion affichées **en permanence** en V2 vs seulement si « Sur validation » (M) ; [P3] visibilité du club (Public/Privé/Secret) absente (reporté `Club#10`, assumé) ; [P3] réordonnancement par flèches (V2) vs poignée glisser (M) ; [P3] modèles de charte conformes. | P3 | assumé (`Club#10`) / à vérifier (questions) |
| **Publication** | M `club-e4-publication.png` = **doublon** de `club-e1-identite.png` ; HTML L3300-3303 | V2 `creation-club-etape4.png` ; `ClubFormV2.tsx` L413-452 | [P3] co-administrateurs et invitations absents (reportés `Club#11/#12`, assumé) ; [P3] pas d'« Aperçu du post » rendu (partiel `Club#13`) ; [P3] V2 ajoute une carte « ENSUITE · Organise la première sortie » ; [P3] libellés message d'accueil conformes. | P3 | assumé / partiel documenté |

---

## Écarts transverses Création

### T1. Coque et matière — conforme sur la structure, teinte différente (décidé)

- **T1a** [P3] V2 = verre **clair crème** de `/compte` ; maquette = verre **vert**. Choix documenté
  (`02-DESIGN-ET-COMPOSANTS.md` § 3 bis, `RAPPORT-INTEGRATION.md` « fondations ») : voir
  `ECARTS-TRANSVERSES.md` pour le détail. **Statut : décidé.**
- Capsule 56 px, 6 types, lentille 0,42 s, poignée, fond `inert`, piège de focus, Échap, glisser de
  fermeture : **conformes** (aucun écart constaté).
- Mini-capsule 30 px, position bas-droite au-dessus du pied, `tablist` roving : **conforme** en
  dimension et en libellés (`Étape i : …`).

### T2. Mini-capsule d'étapes qui recouvre le contenu — **déjà documenté**

- **T2a** [P2] Le contenu défile **sous** la mini-capsule et le `padding-bottom` du pane
  (`has-footer` → 16 px) ne réserve pas les ~46 px nécessaires : libellés/hints/dernières lignes
  masqués (Story Média, Kit Inventaire, Club Univers, Sortie RDV, Carnet Jours). **Déjà documenté**
  (`RAPPORT-INTEGRATION.md`, majeur #2, routé à Création). **Statut : à corriger.**

### T3. Pied de formulaire

- **T3a** [P3] **Retour masqué à l'étape 1** en V2 (`CreateSheetV2.tsx` L491) vs **désactivé mais
  visible** dans la maquette. Le masquage est explicitement demandé par `01-SPEC-PRODUIT.md` § 4.1
  (« Retour (masqué à l'étape 1) »). **Statut : décidé.**
- **T3b** [P3] Pas de chevrons sur « Retour »/« Suivant » (V2) vs chevrons gauche/droite (maquette) ;
  fond du pied en dégradé (V2) vs transparent (maquette).
- **T3c** [P3] Après une **erreur serveur**, la maquette renomme l'action finale en « **Réessayer** » ;
  V2 conserve « Publier »/« Créer… » et affiche l'erreur au-dessus du bouton (`lkdv-cv2c-server`,
  conforme au reste de la spec). **Statut : à vérifier.**
- Bouton occupé + progression média : conforme (`busyLabel` « Envoi des médias… X % »).

### T4. Erreurs de validation

- Une erreur = un message sous le champ, focus sur le premier champ fautif, compteur en tête :
  **conforme** à `01 § 4.1` et à `Publication#17`.
- **T4a** [P2] Le compteur « N champs à corriger » est rendu **en tête du pane** (`header` du moteur,
  avant l'aperçu) : dès que le focus saute au champ fautif, le pane défile et le compteur **sort de
  l'écran** (visible sur `creation-publication-erreurs.png` : aucune trace du compteur). La maquette
  n'a pas de compteur, mais l'intention du document (« compteur en tête qui amène le focus ») est
  perdue. **Statut : à vérifier.**
- **T4b** [P3] Messages différents de la maquette : « Ajoute au moins une photo. » (V2) vs
  « Ajoute au moins une photo ou une vidéo. » ; « Écris une légende. » (V2, règle en plus) vs pas de
  règle légende en Photo (maquette).
- **T4c** [P3] Rendu : bordure rouge + icône ⚠ (V2) vs texte rouge seul (maquette) ; pas d'animation
  `bounce` de l'étape en erreur (maquette).

### T5. Brouillon

- Bandeau « Brouillon restauré · Effacer » : **conforme** ; brouillon par type, écriture 400 ms +
  fermeture + `pagehide`/`visibilitychange` : **conforme** (`Publication#16`, `Carnet#1`).
- **T5a** (cf. N1) **L'étape n'est pas restaurée** : `useDraftV2.ts` ne stocke que `values`
  (`CreateDraftV2Record`), et le moteur repart à `stepIndex = 0` au remontage. La maquette stocke
  `{d, step}` (`maquette L2628-2636`) et **rouvre sur l'étape quittée**. Sur
  `creation-brouillon.png`, le brouillon (format Billet, titre) est bien restauré mais l'écran
  revient à l'étape 1. **Statut : à corriger** (non documenté).
- **T5b** [P3] « Effacer » **efface immédiatement** (`clearDraft`) ; la maquette ouvre une
  confirmation « Effacer le brouillon ? » (`lkvConfirm`). **Statut : à vérifier.**
- **T5c** [P3] La confirmation de fermeture ne regarde que le **type actif**
  (`activeNav?.hasContent`) ; la maquette regarde **tous les types modifiés** (`CRE.dirty()`).
  Fermer depuis un type vierge alors qu'un autre a un brouillon ne demande donc pas confirmation
  (le brouillon est déjà écrit). **Statut : à vérifier.**

### T6. Confirmation de fermeture

- Titre et message **conformes** (« Fermer sans publier ? » / brouillon conservé sur l'appareil) ;
  focus initial sur l'action sûre « Continuer l'édition » : **conforme**.
- **T6a** [P3] **Ordre et emphase inversés** : maquette = « Continuer l'édition » (ghost, gauche) +
  « Fermer » (danger rouge, droite) ; V2 = « Fermer » (secondaire neutre, gauche) + « Continuer
  l'édition » (primaire sombre, droite). **Statut : à vérifier.**
- **T6b** [P3] Le scrim de V2 est limité au tiroir (`lkdv-cv2c-confirm-layer` en `position:absolute`
  dans la feuille) ; la maquette couvre tout l'écran (`confirm-back` `inset:0`). **Statut : à
  vérifier.**
- **T6c** [P3] Message V2 : « Ton brouillon **de publication** est conservé… » (type interpolé) vs
  message générique maquette.

### T7. Île de succès

- Titres et actions **conformes** (« Publié », « Story publiée », « Carnet créé », « Sortie créée »,
  « Kit créé », « Club créé » ; Voir / Partager / Ouvrir la page ; actions secondaires
  « Organiser une sortie » / « Utiliser pour une sortie »).
- **T7a** [P3] V2 **laisse le tiroir ouvert** derrière l'île, avec le formulaire **remis à l'étape 1**
  (`creation-succes-ile.png`) ; la maquette **ferme le tiroir** (`finish()` → `startSheetClose()`).
  La spec dit « île … puis fermeture » ; le comportement V2 ferme à l'action/au clic sur l'île.
  **Statut : à vérifier.**
- **T7b** [P3] Sous-titre post : « Visible dans le fil. » (V2) vs « Dans le fil de la communauté »
  (maquette).

### T8. Aperçu vivant

- **T8a** [P3] V2 : aperçu **dans le pane** de l'étape (il défile avec le formulaire), 250 px max,
  échelle 0,94, avec légende « APERÇU VIVANT · ÉTAPE i : LIBELLÉ » ; maquette : emplacement **fixe**
  de 150 px au-dessus du pager, sans légende (`aria-label="Aperçu en direct"`).
- **T8b** [P3] La maquette **masque l'aperçu quand le clavier est ouvert** (`.phone.kb .cr-prev`),
  V2 non. (Non testable en headless.)
- **T8c** [P2] Aperçu **absent** sur les premières étapes de **Carnet** (1-3) et de **Kit** (1-2) —
  partiels déjà documentés `Carnet#10` / `Kit#17` (V2 : récap seulement à la dernière étape).
- **T8d** [P3] Aperçu Story : la scène 9:16 sert d'aperçu permanent (V2) vs aperçu compact + éditeur
  séparé (maquette) — voir lignes Story.

### T9. Densités, typographies, rayons, composants

- Libellés 600 10 px majuscules, champs 16 px / 48 px, chips et pilules 44 px, rayons et verre des
  cartes `/compte`, jetons uniquement : **conformes** (`FieldV2.tsx`, `create-v2.css`,
  `RAPPORT-INTEGRATION.md`). Aucun littéral de couleur hors jetons (garde design verte).
- **T9a** [P3] Icônes : jeux différents selon les types (lucide dans la maquette, emoji pour les
  activités Sortie en V2) ; `ChipsFieldV2` du Club sans icônes (écart mineur déjà noté
  `COUVERTURE Club#3`).

### T10. Accessibilité

- Pas de violation `critical`/`serious` (axe, `PREUVES.md`), `fieldset`/`legend`, erreurs
  `aria-describedby`, cibles 44 px : **conformes** sur les écrans testés.
- **T10a** [P2] Carte « **Événement** » : bouton de navigation **sans `role=radio`** à l'intérieur
  d'un `role=radiogroup` (Publication/Format) — incohérence pour les lecteurs d'écran (la maquette
  en fait une vraie radio). **Statut : à corriger.**
- **T10b** [P3] Compteur d'erreurs hors écran après focus (cf. T4a).

### T11. Médias et envoi

- Refus immédiat à la sélection, progression, couverture marquée, réordonnancement : **conformes**
  (`Publication#6/#8`, `PREUVES.md`).
- **T11a** [P3] Suppression de média : cible **30×30** en V2 vs 44 px exigé (déjà documenté
  `COUVERTURE Publication#6`, écart mineur).
- Envoi réel Storage non testé (fixture) : voir « Écrans non comparables ».

---

## Nouveaux écarts non documentés (découverts dans cet inventaire)

Ces points ne figurent ni dans `RAPPORT-INTEGRATION.md`, ni dans `COUVERTURE-200.md`, ni dans
`JOURNAL.md`, ni dans `PREUVES.md` (à dater du 2026-11-08).

1. **N1 [P2] — Le brouillon ne restaure pas l'étape** (retour à l'étape 1 au lieu de l'étape
   quittée). Fichiers : `create/engine/useDraftV2.ts` (`CreateDraftV2Record` sans `step`),
   `create/engine/CreateFormEngineV2.tsx` (`setStepState(0)` au montage). Référence maquette :
   `maquette L2628-2636` (`{d, step}`).
2. **N2 [P2] — Club : un seul média avec recadrage au lieu d'avatar carré + bannière 3:1.**
   Fichiers : `create/forms/ClubFormV2.tsx` (`MediaFieldV2 name="cover"`),
   `create/engine/createSchemasV2.ts` (`cover` + `coverRatio`). Contredit `D-document-refonte.md`
   `Club#2` (« recadrage carré pour l'avatar et 3:1 pour la bannière »).
3. **N3 [P2] — Sortie : 3 niveaux de difficulté au lieu des 5 de la maquette** (Très facile,
   Facile, Moyen, Difficile, Expert). Fichiers : `createSchemasV2.ts` `SORTIE_LEVELS_V2`,
   `forms/SortieFormV2.tsx` `LEVELS`.
4. **N4 [P2] — Sortie : la règle « DVA obligatoire pour le ski de rando » n'est pas validée.**
   Fichier : `createSchemasV2.ts` `sortieSchemaV2.superRefine` (seules date passée et heure de fin
   sont contrôlées). La maquette bloque l'étape Sécurité sans DVA si `act === 'ski'`.
5. **N5 [P2] — Carnet/Tracé : libellés « Distance » et « Dénivelé » affichés deux fois.**
   Fichiers : `carnet/TracePaneV2.tsx` L556-569 (rangée métrique) + `forms/CarnetFormV2.tsx`
   L137-140 (`NumberFieldV2` distanceKm/deniveleM).
6. **N6 [P2] — Publication/Photo : la légende devient obligatoire** (« Écris une légende. ») alors
   que la maquette ne l'exige pas pour le format Photo. Fichier : `createSchemasV2.ts`
   `postSchemaV2.superRefine` (`format === 'photo'`).
7. **N7 [P2] — Publication/Format : champ technique « Identifiant du club (repli) » exposé** dans
   l'audience « Un club ». Fichier : `forms/PostFormV2.tsx` `FormatStep` (`TextFieldV2 name="clubId"`).
8. **N8 [P2] — Club : activités non requises** (le schéma accepte `activities: []`), alors que la
   maquette exige « Choisis au moins une activité. ». Fichier : `createSchemasV2.ts`
   `clubSchemaV2.activities` (`.max(5)` sans `.min(1)`).
9. **N9 [P2] — Kit/Compléter : suggestions non actionnables** (simple liste texte « Ajoute-les à
   l'étape Inventaire ») alors que la maquette offre un bouton « Ajouter » par suggestion.
   Fichier : `forms/KitFormV2.tsx` `ComplementsStep`.
10. **N10 [P3] — Carnet/Jours : démarrage à 0 jour** (état vide) alors que la maquette initialise
    3 jours et les synchronise aux dates. Fichier : `createSchemasV2.ts` `carnet` defaults
    (`days: []`).
11. **N11 [P3] — Brouillon : « Effacer » sans confirmation** vs `lkvConfirm('Effacer le brouillon ?')`
    dans la maquette. Fichier : `CreateFormEngineV2.tsx` (`clearDraft`).
12. **N12 [P3] — Publication/Événement : bascule immédiate** sur Sortie, sans la note explicative +
    bouton « Créer dans Sortie » de la maquette ; carte non `radio` dans le `radiogroup`.
    Fichier : `forms/PostFormV2.tsx` `FormatStep`.
13. **N13 [P3] — Extras V2 absents de la maquette** : Hashtags + Mentions (Publication/Diffusion),
    Hashtags + switch « Publier une annonce dans le fil » (Carnet/Partage), photo de couverture
    (Sortie/Activité et lieu), switch d'annonce (Sortie/Sécurité), ligne admin (Club/aperçu).

> Les points 10-13 sont cosmétiques ou additifs ; ils sont listés pour l'exhaustivité et ne
> demandent pas nécessairement une correction.

---

## Écrans non comparables (avec raison)

1. **Publication / Diffusion** : la capture maquette `pub-etape3-diffusion.png` est un **doublon**
   de `pub-etape2-contenu.png` — il n'existe **aucune référence visuelle maquette** de l'étape
   Diffusion. La capture V2 existe désormais (`creation-publication-etape3.png`, régénérée) mais se
   compare au **HTML** (L2838-2846) et au code, pas à une capture maquette.
2. **Story / Édition et Diffusion** : `story-e2-edition.png` et `story-e3-diffusion.png` sont des
   **doublons** de `story-e1.png` (étape 1 en erreur). Les captures V2 existent mais sans référence
   visuelle maquette ; comparaison code + HTML.
3. **Carnet / Tracé, Jours, Partage** : `carnet-e2/e3/e4` sont des **doublons** de
   `carnet-e1-infos.png`. En plus, la carte V2 (MapLibre) est **blanche** en capture (WebGL headless)
   alors que la maquette utilise un SVG topo : rendu carte non comparable.
4. **Sortie / Itinéraire, Participants, Sécurité** : `sortie-e2/e3/e4` sont des **doublons** de
   `sortie-e1.png`. Comparaison code + HTML.
5. **Kit / Compléter et Partager** : `kit-e2/e3` sont des **doublons** de `kit-e1-inventaire.png`.
   Le sélecteur produit n'a **aucune capture maquette** ; inventaire et boutique sont **vides** dans
   la fixture → listes non comparables.
6. **Club / Univers, Adhésion, Publication** : `club-e2/e3/e4` sont des **doublons** de
   `club-e1-identite.png`. Comparaison code + HTML.
7. **Carte du rendez-vous (Sortie/Activité et lieu)** : MapLibre blanche en headless (tuiles
   neutralisées) vs SVG topo maquette → non comparable.
8. **Météo** (Sortie/Itinéraire, Story/Édition) : la météo n'est pas déclenchée sans coordonnées
   de RDV dans la fixture (et les routes `/api/weather` ne sont pas branchées) → V2 n'affiche rien
   ou « Météo pas encore disponible » ; comparaison visuelle impossible.
9. **Médias réels / Storage** : uploads simulés (`PREUVES.md` « Données réelles… NON TESTABLE ICI ») ;
   les vignettes V2 viennent d'images de fixture, le pipeline réel (EXIF, 10/25 Mo, vidéo) n'est pas
   comparé ici.
10. **Caméra Story / vidéo / rognage** : `@capacitor/camera` indisponible au navigateur ; pas de
    vidéo dans la fixture → « Caméra », rognage et lecture d'extrait non comparables visuellement.
11. **Clavier iPhone, haptique, safe areas** : non simulables (`PREUVES.md` § C2-C3).
12. **Dates/heures natives** : Chromium headless affiche `mm/dd/yyyy` et `08:30 AM` (limite harnais
    déjà documentée pour la date ; le format 12 h n'est pas un défaut code).
13. **Île de succès, confirmation de fermeture, bandeau brouillon** : **aucune capture maquette**
    correspondante (`ferme-par-echap.png` montre le fil après fermeture, pas la confirmation).
    Comparaison faite sur le code maquette (`lkvConfirm`, `CRE.onOpen`, `island`).
14. **États vides/chargement/erreur du tiroir Création** : non capturés côté V2 (le tiroir ne
    dépend pas de données distantes à l'ouverture) ; non comparables.

---

## Anomalies d'étiquetage des captures (à ne pas interpréter comme des bugs produit)

### Captures V2 (26 fichiers `creation-*.png`)

Les 3 captures **Publication** (`creation-publication-etape1/2/3.png`) ont été régénérées le
2026-11-08 et sont désormais correctement étiquetées (Format / Contenu / Diffusion) : elles ne
figurent donc plus ci-dessous. Les anomalies restantes portent sur les autres captures.

| Capture | Problème constaté |
|---|---|
| `creation-brouillon.png` | Le brouillon (format Billet + titre) est bien restauré, mais l'écran revient à l'**étape 1** : c'est le comportement V2 (cf. N1), pas un état de capture erroné. À ne pas lire comme « brouillon vide ». |
| `creation-succes-ile.png` | Île « Publié » affichée **au-dessus du tiroir resté ouvert** avec le formulaire réinitialisé (étape 1) — comportement V2 (cf. T7a), pas un état partiel. |
| `creation-carnet-etape3.png` | État **vide** (0 jour) car la fixture ne propose pas de dates : la mini-capsule de jours et les moments ne sont pas visibles → écran partiellement comparable seulement. |
| `creation-publication-erreurs.png` | Le compteur d'erreurs est **hors écran** (pane défilé vers le premier champ fautif) ; les erreurs inline, elles, sont bien visibles (cf. T4a). |

### Captures maquette (référence) — doublons d'étapes

Les captures « étape 2/3/4 » de la référence sont, pour la plupart, des **doublons de l'étape 1**
(ou de l'étape 2) : elles ne peuvent pas servir de référence visuelle pour ces étapes.

| Groupe | Fichiers identiques (SHA-256) | État réellement montré |
|---|---|---|
| Publication | `pub-etape2-contenu.png` = `pub-etape3-diffusion.png` | étape Contenu (vide) |
| Story | `story-e2-edition.png` = `story-e3-diffusion.png` | étape Média (erreur « Ajoute une photo ou une vidéo ») |
| Carnet | `carnet-e2-trace.png` = `carnet-e3-jours.png` = `carnet-e4-partage.png` | étape Infos avec erreurs titre/destination |
| Sortie | `sortie-e2-itineraire.png` = `sortie-e3-participants.png` = `sortie-e4-securite.png` | étape Activité et lieu avec erreurs titre/lieu |
| Kit | `kit-e2-completer.png` = `kit-e3-partager.png` = `creation-kit-etape2.png` | étape Inventaire avec erreur poids |
| Club | `club-e2-univers.png` = `club-e3-adhesion.png` = `club-e4-publication.png` | étape Identité avec erreurs nom/activité/adresse |

Autres doublons utiles : `creation-story-etape2/3.png`, `creation-club-etape2.png`,
`creation-sortie-etape2.png` = étape 1 en erreur ; `creation-kit-etape1/2.png` = étape Inventaire ;
`creation-carnet-etape1.png` = `carnet-e1-infos.png`. Les captures `creation-publication-etape1/2/3.png`
sont, elles, **distinctes et correctes** depuis la régénération du 2026-11-08.

---

## Top 8 à corriger en priorité (P1/P2, actions concrètes — aucun code modifié)

| # | Écart | Action concrète | Fichier probable | Statut |
|---|---|---|---|---|
| 1 | **Brouillon sans étape** (N1) | Persister `step` dans `CreateDraftV2Record`, le restaurer au montage du moteur (et le réinitialiser au changement de type / après envoi) ; test e2e : brouillon fermé à l'étape 2 → réouverture à l'étape 2. | `create/engine/useDraftV2.ts`, `create/engine/CreateFormEngineV2.tsx` | à corriger (non documenté) |
| 2 | **Mini-capsule qui recouvre le contenu** (T2a) | Porter le `padding-bottom` du pane Création à ~76 px quand `has-footer` + mini-capsule (aligner sur `.lkdv-cv2-pane`), ou décaler la mini-capsule au-dessus du pied sans recouvrement ; vérifier Story Média, Kit Inventaire, Club Univers, Sortie RDV. | `create/create-v2.css`, `src/styles/communaute-v2-shell.css` | à corriger (déjà documenté `RAPPORT-INTEGRATION` majeur #2) |
| 3 | **Club : image unique vs avatar + bannière** (N2) | Remplacer `cover`/`coverRatio` par deux médias (`avatar` carré + `banner` 3:1) ou exposer deux champs distincts, payload RPC et affichage inclus. | `create/forms/ClubFormV2.tsx`, `create/engine/createSchemasV2.ts`, `create/createRpc.ts` | à corriger (non documenté) |
| 4 | **Sortie : 5 niveaux + règle DVA ski** (N3/N4) | Ajouter `tres_facile`/`expert` à l'énumération et aux cartes ; ajouter la validation conditionnelle `activity === 'ski' && !safetyChecklist.includes('DVA')` dans l'étape Sécurité. | `create/engine/createSchemasV2.ts`, `create/forms/SortieFormV2.tsx` | à corriger (non documenté) |
| 5 | **Carnet/Tracé : libellés Distance/Dénivelé dupliqués** (N5) | Supprimer la rangée métrique de `TracePaneV2` (ou la fusionner avec les `NumberFieldV2` de `TraceStep`) pour n'afficher qu'un libellé + une valeur par métrique. | `create/carnet/TracePaneV2.tsx`, `create/forms/CarnetFormV2.tsx` | à corriger (non documenté) |
| 6 | **Publication/Photo : légende obligatoire** (N6) | Rendre la légende facultative pour `format === 'photo'` (retirer l'issue `Écris une légende.`) ou la documenter comme décision produit ; harmoniser le message média avec la maquette. | `create/engine/createSchemasV2.ts` | à corriger (non documenté) |
| 7 | **Publication/Format : champ « clubId (repli) » + carte Événement non radio** (N7/T10a) | Masquer le champ UUID quand la liste `myClubs` est chargée (le garder en interne seulement) ; donner à la carte Événement un vrai rôle `radio` + note explicative, ou la sortir du `radiogroup`. | `create/forms/PostFormV2.tsx` | à corriger (non documenté) |
| 8 | **Club : activités non requises** (N8) | Ajouter `.min(1, 'Choisis au moins une activité.')` aux activités (et éventuellement la longueur minimale du nom de 3 caractères comme la maquette). | `create/engine/createSchemasV2.ts` | à corriger (non documenté) |

> Priorités suivantes, P2 déjà documentés : « Point de rendez-vous » dupliqué
> (`RAPPORT-INTEGRATION` majeur #1), aperçu vivant absent Carnet/Kit (`Carnet#10`/`Kit#17`),
> `Kit#4` « Partir de », préparation/unités `Kit#11/#15`, lien carnet + jour `Story#11`,
> DVA/documentation `Sortie#5/#11`.

---

## Annexe — correspondance captures utilisées

| Type | Maquette (référence réellement exploitable) | V2 (captures) |
|---|---|---|
| Publication | `creation-publication-etape1.png`, `pub-etape1-remplie.png`, `pub-etape1-erreurs.png`, `pub-etape2-contenu.png` ; HTML L2797-2846 | `creation-publication-etape1.png` (Format), `creation-publication-etape2.png` (Contenu), `creation-publication-etape3.png` (Diffusion), `creation-publication-erreurs.png` |
| Story | `story-e1.png` ; HTML L2878-2908 | `creation-story-etape1/2/3.png` |
| Carnet | `carnet-e1-infos.png`, `creation-carnet-etape1.png` ; HTML L2976-3012 | `creation-carnet-etape1/2/3/4.png` |
| Sortie | `sortie-e1.png`, `creation-sortie-etape1.png` ; HTML L3018-3053 | `creation-sortie-etape1/2/3/4.png` |
| Kit | `kit-e1-inventaire.png` ; HTML L3170-3210 | `creation-kit-picker.png`, `creation-kit-etape1/2/3.png` |
| Club | `club-e1-identite.png`, `creation-club-etape1.png` ; HTML L3270-3303 | `creation-club-etape1/2/3/4.png` |
| États transverses | aucune capture ; HTML L1757-1765 (`lkvConfirm`), L1988-1991 (fermeture), L2620-2640 (brouillon), L2708-2711 (bandeau), `island()` | `creation-fermeture-confirmation.png`, `creation-brouillon.png`, `creation-succes-ile.png` |

**Conclusion** : le squelette du tiroir Création (étapes, moteur, coque, capsule/mini-capsule,
validation à l'étape, brouillon, confirmation, île) est **fidèle à la maquette et à la spec**. Les
écarts restants sont concentrés sur (a) la **restitution du brouillon** (étape perdue), (b) la
**répartition des champs entre étapes** (Carnet, Sortie, Club), (c) quelques **règles métier
manquantes ou en trop** (DVA ski, activités club, légende photo, niveaux de difficulté), (d) la
**place de l'aperçu vivant** et de la **mini-capsule** dans la fenêtre, et (e) le **verre vert de la
maquette vs le verre clair `/compte`** (décision documentée). Aucun blocage de parcours constaté sur
les états capturés.


---

## Compléments apportés après l'analyse (captures ajoutées, non dépouillées ligne à ligne)

| Capture | État montré | Lecture rapide |
|---|---|---|
| `creation-publication-billet.png` | Publication format **Billet**, étape 2 « Contenu » | Titre + texte remplis, aperçu vivant « Étape 2 : Contenu » ; mêmes écarts de libellés/affordances que la ligne Contenu, sans la mosaïque média (format texte). |
| `creation-story-erreur-media.png` | Story étape 1 « Média » après **Suivant sans média** | Message « Ajoute une photo ou une vidéo. » ; la mini-capsule recouvre partiellement le bas du bloc média/hint (écart T2a) ; confirme que le champ média reste sous la ligne de flottaison (écart Story Média). |

Ces deux captures sont postérieures à la passe de comparaison principale (demandées en complément
par le Lead) : elles ne modifient ni les compteurs ni les conclusions ci-dessus.
