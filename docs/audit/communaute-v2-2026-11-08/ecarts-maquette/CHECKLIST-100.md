# CHECKLIST-100 — fidélité 100 % à la maquette (suivi d'exécution)

**Source** : `BACKLOG-100.md` (85 items, 7 phases). **Branche** : `feat/fidelite-maquette`.

Case `[x]` = fait **et vérifié** (preuve nommée), `[~]` = en cours/partiel, `[ ]` = à faire, `[?]` = à vérifier/arbitrage.


## Progression

| Phase | Items | Fait | En cours | Reste |
|---|---|---|---|---|
| 1 — P1 bloquants | 1 | 1 | 0 | 0 |
| 2 — Transverses (coque, design system, moteur commun) | 9 | 0 | 0 | 9 |
| 3 — Explorer | 5 | 0 | 0 | 5 |
| 4 — Création | 21 | 0 | 0 | 21 |
| 5 — P3 cosmétique (passes design) | 25 | 0 | 0 | 25 |
| 6 — Exceptions § 6 et assumés réconciliables | 10 | 0 | 0 | 10 |
| 7 — Vérification et livraison | 14 | 0 | 0 | 14 |
| **Total** | **85** | **1** | **0** | **84** |

> Les compteurs sont mis à jour à chaque revue de phase (voir journal de progression en bas).


## Phase 1 — P1 bloquants

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-001 | P1 | Recherche — résultats groupés et bascule « Sur la carte » (tous volets) — Attendu : le repli de couverture reste **dans** sa vignette 52×48 ; groupes (Carnets/Clubs/Sorties), en-têtes… | Captures `explorer-recherche-resultats` (3 groupes + compteurs + surlignage) et `explorer-recherche-sur-la-ca… | déjà fait* |

## Phase 2 — Transverses (coque, design system, moteur commun)

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [ ] | FID-002 | P2 | États d'erreur — 4 volets Explorer + Création — Attendu : pastille d'erreur teintée danger (`--bad-bg` #F5DDD9, glyphe #A8443A), distincte du vide. Constaté… | Captures `explorer-recherche-erreur` + erreurs Carnets/Clubs/Sorties ; axe ≥ 4,5:1 ; test contrat CSS (`fonda… | à faire |
| [ ] | FID-003 | P2 | Tuiles carnet — badges de signature (tous carnets) — Attendu : « Carnet de la semaine » = **verre clair + encre forêt** (#E5F6E0) ; « En route » = **pilule forêt… | Capture `explorer-carnets` crop ×2 : semaine #E5F6E0, en route forêt/blanc ; test visuel carnets. | à faire |
| [ ] | FID-004 | P2 | Détail Sortie — entête billet — Attendu : stub date **68 px à gauche**, corps à droite (`grid 68px 1fr`), hauteur min 104 px. Constaté : stub… | Capture `explorer-sorties-detail` superposable à `explorer-sorties-detail.png` ; e2e : `getBoundingClientRect… | à faire |
| [ ] | FID-005 | P2 | Pied de formulaire — 6 types — Attendu : **Retour visible et désactivé** à l'étape 1 (SP §4.1 autorise le masquage, mais 00 §3 et la maquett… | Captures étape 1 des 6 types (bouton grisé présent) ; e2e : `getByRole('button',{name:'Retour'})` visible + d… | à faire |
| [ ] | FID-006 | P2 | Mini-capsule d'étapes — 5 écrans — Attendu : ~76 px de réserve basse (aligné sur `.lkdv-cv2-pane`), dernier champ et hint lisibles au scroll max… | Captures des 5 écrans : dernier champ + hint entièrement visibles ; e2e `elementFromPoint` sur le dernier bou… | à faire |
| [ ] | FID-007 | P2 | Double libellé sur un même écran — Carnet/Tracé + Sortie/RDV — Attendu : un seul libellé par donnée. Constaté : « Distance »/« Dénivelé » en résumé (`TracePaneV2` L556-569)… | Captures : 1 occurrence de chaque libellé ; test de rendu (occurrence unique par libellé). | à faire |
| [ ] | FID-008 | P2 | Capsule 4 volets — détails empilés — Attendu : capsule **toujours visible**, y compris détail empilé (SP §2 « toujours visible »), au-dessus du `‹… | Captures des 2 détails : capsule visible ; e2e : `tablist` visible en détail + changement de volet possible ;… | à faire |
| [ ] | FID-009 | P2 | Publication/Format — carte « Événement » — Attendu : vraie radio dans le `radiogroup` + note explicative + bouton « Créer dans Sortie » (la maquette ne… | axe : 0 violation « radiogroup sans radio » ; capture `creation-publication-etape1` ; e2e : 3 radios atteigna… | à faire |
| [?] | FID-010 | P2 | Moteur de formulaire — compteur d'erreurs — **Question** : le compteur « N champs à corriger » doit-il rester visible (bandeau collant) ou peut-il sortir… | Capture `creation-publication-erreurs` : compteur **et** champ fautif visibles ; e2e après Suivant ×2. | à vérifier |

## Phase 3 — Explorer

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [ ] | FID-011 | P2 | Recherche/accueil — lieux populaires — Attendu : **tuiles illustrées** (couverture paysage) + nom + « N sorties ». Constaté : cartes verre neutres,… | Capture `explorer-recherche` superposable ; test unitaire `SearchHome` (libellé « sorties ») ; axe (image déc… | à faire |
| [ ] | FID-012 | P2 | Peek & Pop — carnet et club — Attendu : carte large + **bandeau de couverture/blason** + titre/meta + 3 actions (4 avec Fermer, cf. FID-065… | Captures des 2 peeks ; e2e peek (3 ou 4 actions après FID-065) ; test visuel. | à faire |
| [ ] | FID-013 | P2 | Clubs — blason et cadenas (tuile, club du mois, détail) — Attendu : blason SVG **nu** (plus grand), cadenas en **coin de carte**. Constaté : blason dans un contenant c… | Capture `explorer-clubs` + crop ×2 ; test `ClubCrest` (tailles 28/44/52/64/72). | à faire |
| [ ] | FID-014 | P2 | Détail club — action principale et prochaines sorties — Attendu : action = **état d'adhésion** (« Rejoindre » / « Membre ✓ ») ; « Quitter » réservé au peek ; prochai… | Capture `explorer-clubs-detail` ; e2e : membre → « Membre ✓ » (pas un bouton d'action), non-membre → « Rejoin… | à faire |
| [ ] | FID-015 | P2 | Sorties — action d'inscription dans le billet — Attendu : action **dans le pied du billet**, à droite de la jauge (pastille 44 px), un seul état affiché. Con… | Captures des 2 écrans : 1 seul libellé d'état par billet ; cible 44 px mesurée ; e2e inscription/désinscripti… | à faire |

## Phase 4 — Création

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [ ] | FID-016 | P2 | Brouillon — reprise à l'étape quittée — Attendu : rouvrir le brouillon **à l'étape quittée** (maquette `{d, step}`, HTML L2628-2636). Constaté : seul… | Capture `creation-brouillon` : étape 2 restaurée ; e2e : étape 2 → fermer → rouvrir → étape 2 ; test unitaire… | à faire |
| [ ] | FID-017 | P2 | Club/Identité — avatar + bannière — Attendu : **deux médias distincts** — avatar carré + bannière 3:1 (D `Club#2`). Constaté : un seul `cover` +… | Captures : `creation-club-etape1` (2 champs), `explorer-clubs` (avatar), `explorer-clubs-detail` (bannière) ;… | à faire |
| [ ] | FID-018 | P2 | Sortie/Itinéraire — échelle de difficulté — Attendu : **5 niveaux** (Très facile, Facile, Moyen, Difficile, Expert) avec définition. Constaté : 3 valeurs… | Capture `creation-sortie-etape2` (5 cartes) ; `explorer-sorties` (niveau lisible) ; test schéma (5 valeurs) +… | à faire |
| [ ] | FID-019 | P2 | Sortie/Sécurité — règle DVA ski de rando — Attendu : ski de rando **sans DVA** bloque l'étape Sécurité (maquette). Constaté : `superRefine` ne contrôle… | Capture étape 4 en erreur ; test unitaire (ski sans DVA → échec, ski avec → ok, rando sans DVA → ok) ; e2e. | à faire |
| [ ] | FID-020 | P2 | Publication/Photo — légende obligatoire — Attendu : légende **facultative** en format Photo (maquette). Constaté : `content` requis → « Écris une légen… | Capture étape 2 sans légende puis Suivant → étape 3 ; test unitaire schéma. | à faire |
| [ ] | FID-021 | P2 | Publication/Format — champ technique « clubId (repli) » — Attendu : aucun champ UUID visible ; la sélection se fait par les chips de clubs. Constaté : `TextFieldV2 nam… | Capture audience « Un club » avec liste chargée : aucun champ UUID ; test de rendu. | à faire |
| [ ] | FID-022 | P2 | Club — activités requises et placées en Identité — Attendu : au moins une activité **obligatoire**, saisie en Identité (« Choisis au moins une activité. »). Con… | Capture étape 1 en erreur ; test schéma ; e2e création sans activité bloquée. | à faire |
| [ ] | FID-023 | P2 | Kit/Compléter — suggestions actionnables — Attendu : un bouton **« Ajouter »** par suggestion (maquette). Constaté : liste texte « Ajoute-les à l'étape… | Capture étape 2 ; e2e : clic Ajouter → item dans l'inventaire + poids à jour. | à faire |
| [ ] | FID-024 | P2 | Kit/Inventaire — « Partir de » — Attendu : **4 points de départ** — kit existant, carnet, modèle, vide (CO `Kit#4` non fait). Constaté : absen… | Capture étape 1 (4 entrées) ; e2e : modèle bivouac → N items préremplis + poids cohérent. | à faire |
| [ ] | FID-025 | P2 | Kit — aperçu, sac en couches, anneau de poids — Attendu : **KitCard en tête** (étapes 1-3), anneau de poids (`KitRing`), « sac en couches », objectif **sélec… | Captures étapes 1-2 ; test visuel ; e2e : objectif modifié → anneau recalculé. | à faire |
| [ ] | FID-026 | P2 | Publication/Contenu — médias en lignes et affordances — Attendu : **lignes** (vignette, poignée, « Média 1 », « Envoyé », « Décrire l'image », supprimer 44 px ; HTML… | Capture étape 2 ; e2e : alt éditable sans appui long ; cibles ≥ 44 px (axe). | à faire |
| [ ] | FID-027 | P2 | Story/Média — hiérarchie de l'écran — Attendu : **aperçu compact 150 px** (« Story · 24 h / Ajoute un média / audience · réponses ») + 2 pilules Ga… | Captures étape 1 et erreur média : hint visible **sans scroll** ; e2e Suivant sans média → message visible. | à faire |
| [ ] | FID-028 | P2 | Story/Diffusion — aperçu final, lien carnet et jour — Attendu : section « **Aperçu final exact** » libellée + lien carnet **et choix du jour** dans la Diffusion. C… | Capture étape 3 ; e2e : sélection d'un jour → payload `linked_carnet_day`. | à faire |
| [ ] | FID-029 | P2 | Carnet/Infos — aperçu vivant et nombre de jours — Attendu : **aperçu vivant en tête** (couverture, titre, destination, jours, km, visibilité, voyageurs) + step… | Capture étape 1 ; e2e : dates 3 jours → stepper 3 ; stepper 5 → 5 jours à l'étape Jours. | à faire |
| [?] | FID-030 | P2 | Carnet/Jours — initialisation — **Question** : 3 jours par défaut synchronisés aux dates (maquette) ou 0 jour (V2) ? Écran : `creation-carnet… | Capture étape 3 avec 3 jours ; test schéma/engine. | à vérifier |
| [ ] | FID-031 | P2 | Carnet/Partage — invitation — Attendu : **chips d'amis + « Inviter par lien »**. Constaté : switch « Carnet collaboratif » + `@handle`, **s… | Capture étape 4 ; e2e : lien copié + 2 amis sélectionnés. | à faire |
| [?] | FID-032 | P2 | Moteur — action finale après erreur serveur — **Question** : renommer l'action en **« Réessayer »** après échec serveur (maquette) ou conserver « Publier »… | Capture d'un échec RPC simulé ; e2e : label bascule puis revient. | à vérifier |
| [?] | FID-033 | P3 | Île de succès — fermeture du tiroir — **Question** : fermer la feuille derrière l'île (maquette `finish()` → `startSheetClose()`) ou la laisser ouv… | Capture `creation-succes-ile` ; e2e : après envoi, feuille fermée + île visible + fil rafraîchi. | à vérifier |
| [ ] | FID-034 | P3 | Brouillon — « Effacer » — Attendu : confirmation « Effacer le brouillon ? » (maquette `lkvConfirm`). Constaté : `clearDraft` immédiat. | Capture du dialogue ; e2e : Effacer → dialogue → Annuler conserve le brouillon. | à faire |
| [?] | FID-035 | P3 | Confirmation de fermeture — périmètre — **Question** : confirmer aussi quand un **autre type** a du contenu (maquette `CRE.dirty()` sur tous les type… | e2e : brouillon Publication + ouverture Club vierge + fermeture → dialogue ; test unitaire. | à vérifier |
| [ ] | FID-036 | P3 | Confirmation de fermeture — scrim — Attendu : scrim **plein écran** (`inset:0`, maquette `confirm-back`). Constaté : couche en `position:absolute… | Capture `creation-fermeture-confirmation` ; e2e : clic hors dialogue sans effet. | à faire |

## Phase 5 — P3 cosmétique (passes design)

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [ ] | FID-037 | P3 | Recherche/accueil — tendances — Attendu : icône de tendance **unique** (flèche) + « N **recherches** ». Constaté : `sparkles`/`map-pin` selon… | Capture `explorer-recherche` ; test unitaire du libellé. | à faire |
| [ ] | FID-038 | P3 | Tuile carnet — visa — Attendu : visa sur **une ligne** (« FR · 4 J · 62,4 KM »). Constaté : 2ᵉ ligne `<i>N voyageurs</i>` (ajout no… | Capture `explorer-carnets` ; test visuel. | à faire |
| [ ] | FID-039 | P3 | Avatars — initiales (carnets, clubs, membres, peeks) — Attendu : **1 lettre**. Constaté : 2 lettres (LÉ, TO, IN, VC). | Captures des 3 écrans ; test unitaire `initials`. | à faire |
| [ ] | FID-040 | P3 | Fin de liste — pluriel et portée — Attendu : mention absente hors « Découvrir › Carnets » ; pluriel correct (0/1/n). Constaté : généralisée aux… | Captures des 4 volets ; test unitaire 0/1/2. | à faire |
| [ ] | FID-041 | P3 | Libellés Explorer — clubs, sorties, détail — Attendu : « Demander à **rejoindre** », niveau « **Moyen** », « Ajouter au calendrier **(.ics)** », « **lundi… | Captures des 3 écrans ; tests `format`. | à faire |
| [ ] | FID-042 | P3 | Sorties — segment, distance, jauge, agenda — Attendu : « **Grille** / Liste », distance **seulement** en « Près de moi », jauge « 9/12 · 3 places », pasti… | Captures des 2 écrans ; test `AgendaStrip` (8 tests existants). | à faire |
| [ ] | FID-043 | P3 | Mini-capsule — icônes de filtres et option active du tri — Attendu : globe / signet / **cœur** / épingle ; option active avec **anneau inset** 1 px. Constaté : boussole… | Captures des 2 écrans ; tests `SortMenuButton` (11). | à faire |
| [ ] | FID-044 | P3 | État de chargement — squelette — Attendu : grille **2 col × 6 tuiles** `aspect-ratio 4/5,6`, radius 18, mini-capsule masquée. Constaté : 1 tui… | Capture avec latence simulée ; test visuel. | à faire |
| [ ] | FID-045 | P3 | États vide et erreur — ancrage et pastille — Attendu : bloc **ancré sous la capsule** (`padding:28px 18px`, pas de `flex:1`), pastille translucide `--soft… | Captures des 2 états ; axe ; test visuel. | à faire |
| [ ] | FID-046 | P3 | Rayons et ratios (tuiles, couvertures) — Attendu : tuiles **18 px**, couverture **4/5**, tuile large **16/10**. Constaté : 20 px, 4/3, 16/9. | Mesure Playwright (ratio 0,8 et 1,6) ; capture ; test garde `radius`. | à faire |
| [ ] | FID-047 | P3 | Publication/Format — cartes — Attendu : icône **au-dessus** du libellé, pastille d'audience **à droite**, aperçu avec visuel (placeholder i… | Capture étape 1 ; test visuel. | à faire |
| [ ] | FID-048 | P3 | Libellés et compteurs de champs (Publication, média) — Attendu : « **Photos et vidéos *** » + compteur **dans** le libellé, « 1 / 10 » à droite, 600 max en Photo, m… | Captures des 2 écrans ; tests schéma (messages). | à faire |
| [ ] | FID-049 | P3 | Pied de formulaire — chevrons et fond — Attendu : chevrons ‹ Retour / Suivant › + fond **transparent**. Constaté : sans chevrons, dégradé. | Capture étape 2 ; test visuel. | à faire |
| [ ] | FID-050 | P3 | Story — méta, contrôles, calques, lien, rognage — Attendu : méta « Story · 24 h / audience / réponses », 2 boutons Galerie/Caméra, zoom ± + « Remplacer », list… | Captures étapes 1-2 ; e2e lien invalide signalé sans changer d'étape. | à faire |
| [ ] | FID-051 | P3 | Carnet — destination, récit, titre, point de départ, profil, couverture — Attendu : destination en **chips**, « Aide à l'écriture » en chips, titre **100**, 3 **cartes** de point de d… | Captures étapes 1/2/4 ; test schéma (max 100). | à faire |
| [?] | FID-052 | P3 | Sortie — billet d'aperçu, icônes, steppers, chips — Attendu : billet avec topo + météo + « 0 km · +0 m · 1 h », icônes d'activité **linéaires**, steppers distanc… | Captures des 4 étapes ; test visuel ; comparaison avec `sortie-e1.png`. | à vérifier |
| [ ] | FID-053 | P3 | Kit — groupes, objet perso, saison, description, nom — Attendu : **6 groupes visibles** (vides compris), objet perso avec libellés + chips catégorie + stepper poids… | Captures étapes 1-3 ; tests schéma. | à faire |
| [ ] | FID-054 | P3 | Club — activités, hints, rayon, questions, glisser, aperçu du post — Attendu : **5** activités + champ libre « Autre activité… », hint « Plusieurs choix possibles », note image f… | Captures des 4 étapes ; e2e questions conditionnelles. | à faire |
| [ ] | FID-055 | P3 | Bandeau « Brouillon restauré » — Attendu : **pilule 999**, fond `--soft` + inset 1 px, 600 12, **horloge + « · »**. Constaté : rectangle rayon… | Capture `creation-brouillon` ; test contrat CSS. | à faire |
| [ ] | FID-056 | P3 | Aperçu vivant — surtitre et emplacement — Attendu : **pas** de surtitre « APERÇU VIVANT · ÉTAPE n » ; aperçu en emplacement **fixe 150 px** au-dessus d… | Captures étapes 1-2 ; test visuel (position stable au scroll). | à faire |
| [ ] | FID-057 | P3 | Teintes non vertes hors danger (ochre) — Attendu : aucune teinte non verte hors danger. Constaté : `--lkv-warning` #C89A3B sur bandeau hors-ligne, com… | Captures hors-ligne + compteur ; test `unification.spec` étendu aux jetons. | à faire |
| [?] | FID-058 | P3 | Focus clavier — rayon des contrôles — **Question** : le passage en rayon 8 px au focus est-il voulu ? Écran : pilule focalisée au clavier (capture… | Capture clavier d'une pilule focalisée ; axe ; test visuel. | à vérifier |
| [ ] | FID-059 | P3 | Suppression de média — cible tactile — Attendu : **44 px**. Constaté : 30×30 (`.lkdv-cv2-media-remove`). | Capture étape 2 ; test cibles (axe). | à faire |
| [ ] | FID-060 | P3 | Rendu des erreurs de champ — Attendu : **texte rouge seul**, pas de bordure + icône ⚠ ; **rebond** de la capsule d'étape en erreur. Consta… | Capture `creation-publication-erreurs` ; test reduced-motion. | à faire |
| [ ] | FID-061 | P3 | Copies — île, confirmation, sélecteur produit — Attendu : « **Dans le fil de la communauté** », message de confirmation **générique**, « Ajouter »/« **Achete… | Captures des 3 écrans. | à faire |

## Phase 6 — Exceptions § 6 et assumés réconciliables

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [ ] | FID-062 | P3 | Publication/Diffusion — options reportées **visibles** — Attendu : SP §6 dit « **Masquer** ces options » (commentaires/j'aime, sondage, programmation). Constaté : seg… | Capture étape 3 : bloc absent ; test de rendu (libellé absent). | à faire |
| [?] | FID-063 | P3 | Ajouts V2 hors maquette — **Question** : conserver ou retirer les ajouts (hashtags, mentions, switch « annonce dans le fil », photo de… | Captures des 6 écrans + entrée JOURNAL ; test de rendu par ajout retiré. | à vérifier |
| [?] | FID-064 | P3 | Place des champs entre étapes — **Question** : réaligner sur la maquette ou acter le déplacement ? Cas : Carnet jours (Infos), Sortie date/he… | Captures des étapes concernées ; entrée JOURNAL datée. | à vérifier |
| [?] | FID-065 | P3 | Peek — 3 ou 4 actions — **Question** : ajouter la 4ᵉ action « **Fermer** » (maquette, 4 lignes) ou conserver 3 actions (E2E actuel et… | Captures carnet + club ; e2e comptage des actions. | à vérifier |
| [?] | FID-066 | P3 | Confirmation de fermeture — hiérarchie — **Question** : action sûre en **primaire sombre** (V2, doctrine « rouge réservé aux erreurs ») ou « Fermer »… | Capture + axe (contraste du rouge) ; entrée JOURNAL. | à vérifier |
| [ ] | FID-067 | P3 | Carnet — visa pays + anneau « En route » — Attendu : « **FR** · 4 J · 62,4 KM » ; « En route » avec **anneau conique animé**. Constaté : pas de pays (RP… | Capture `explorer-carnets` ; test de contrat RPC ; test visuel. | à faire |
| [ ] | FID-068 | P3 | Carnet/Sortie — édition du tracé et des jours — Attendu : suppression de segment, déplacement d'un point **intermédiaire**, glisser entre jours, import depui… | Captures avant/après ; e2e gestes ; test undo. | à faire |
| [ ] | FID-069 | P3 | Kit — modèle, préparation, unités — Attendu : modèle **sélectionnable** (journée/bivouac/alpi), mode **préparation**, unités **impériales** (préf… | Captures étapes 2-3 ; e2e modèle. | à faire |
| [?] | FID-070 | P3 | Chips de filtre — cible 32 px — **Question** : porter les chips à **44 px** (CLAUDE.md) ou acter l'alignement sur `/compte` (28 px) et la maq… | Captures 4 volets ; audit cibles axe avec dérogation documentée. | à vérifier |
| [?] | FID-071 | P3 | Météo — tuiles, détail, sticker Story — **Question** : brancher la route météo existante sur les tuiles, le détail et le sticker Story, ou confirmer… | Captures avec RDV renseigné ; e2e réseau simulé. | à vérifier |

## Phase 7 — Vérification et livraison

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [ ] | FID-072 | P1 | Preuve du P1 (bloquant du chantier) — Attendu : la preuve qui **ferme** FID-001 — 2 captures conformes + e2e qui échoue avant et passe après. Const… | 2 captures conformes + e2e vert Chromium **et** WebKit ; commit référencé. | à faire |
| [ ] | FID-073 | P2 | Recette visuelle — rejouer les 48 captures — Attendu : un jeu de captures **à jour** après corrections, avec table item → capture (une preuve par FID). Co… | 48 captures à jour ; galerie sans capture invalide ; tableau item → capture complet. | à faire |
| [ ] | FID-074 | P2 | Garde anti-recouvrement générique — Attendu : un test qui détecte un élément interactif **recouvert** (cause du P1, invisible à `toBeVisible()`).… | Test rouge sur l'ancien CSS (preuve de valeur) puis vert après correctif. | à faire |
| [ ] | FID-075 | P2 | Échap hiérarchisé — preuve — Attendu : 5 niveaux dans l'ordre (menu de tri → peek → confirmation → détail → tiroir), Échap consommée à cha… | 5 captures + e2e. | à faire |
| [ ] | FID-076 | P2 | États d'erreur des 3 volets + hors-ligne — Attendu : captures des erreurs Carnets/Clubs/Sorties et du bandeau hors-ligne (dernier contenu conservé). Con… | 4 captures + e2e. | à faire |
| [ ] | FID-077 | P2 | Rôle invité — gating des écritures — Attendu : like, rejoindre, s'inscrire et ouverture de Création passent par `requireAuth` ; marqueur d'invité… | 4 captures + e2e (aucune requête d'écriture). | à faire |
| [ ] | FID-078 | P2 | Porte de livraison — données et drapeau — Attendu : la fidélité ne peut être déclarée « 100 % » que sur données réelles ; les RPC v2 ne sont pas en pro… | Registre de migrations à jour + captures sur données réelles + drapeau vérifié. | à faire |
| [ ] | FID-079 | P3 | LensPager — preuve du geste — Attendu : seuil 48 px, verrou d'axe 8 px, 420 ms ; aucune capture du geste en cours. | Capture + e2e 3 assertions. | à faire |
| [ ] | FID-080 | P3 | Contraste des surtitres sur fond sombre — Attendu : AA sur le verre, y compris quand une zone sombre de la photo traverse le tiroir. Constaté : « AUDIE… | Rapport de contraste + capture. | à faire |
| [ ] | FID-081 | P3 | Focus clavier — preuve — Attendu : anneau 2 px, rayon inchangé (FID-058), ordre de tabulation, piège de focus du tiroir et du dialogue… | Captures + e2e + axe. | à faire |
| [ ] | FID-082 | P3 | 360 px et 430 px — Attendu : 0 débordement horizontal et composition identique (couverts par e2e 1f, non capturés ici). | 0 débordement ; captures. | à faire |
| [?] | FID-083 | P3 | Données réelles — blocs conditionnels — **Question** : les blocs RDV, météo, filigrane de trace, badge GPS et couvertures Storage se rendent-ils corr… | Captures sur données réelles + check liste des 5 blocs. | à vérifier |
| [?] | FID-084 | P3 | Densité générale du tiroir — **Question** : la densité V2 (sections 10 px, blocs plus hauts, écart titre/meta plus grand) doit-elle être r… | Mesures Playwright + captures appairées. | à vérifier |
| [ ] | FID-085 | P3 | Ombre de l'île — règle « ombres encrées » — Attendu : ombres à base d'encre `rgba(11,31,23,%)`, jamais `rgba(0,0,0)`. Constaté : `--cv2-island-shadow: 0… | Capture île ; test jetons. | à faire |

---

## Journal de progression

| Date/heure | Événement | Preuve |
|---|---|---|
| 2026-11-08 20:12 | **FID-001 (P1) corrigé** : `position: relative` sur `.lkdv-cv2x-search-cover` ; résultats visibles et bascule carte cliquable | captures `explorer-recherche-resultats`/`-sur-la-carte` régénérées + e2e 5a/5b/5c/5d/5e/1b verts (Chromium) ; commit `a77970a` |
| 2026-11-08 20:12 | **FID-072 (garde)** : garde anti-recouvrement ajoutée en e2e 5a (`elementFromPoint` dans la ligne + repli ≤ 60×56) + clic natif « Sur la carte » en 5e ; helper `domClick` supprimé | e2e 5a/5e rejoués verts ; commit `12dc3b5` |
| 2026-11-08 20:20 | **Backlog exhaustif + checklist** : 85 items / 7 phases, lots de parallélisation A–V | `BACKLOG-100.md`, ce fichier |
| 2026-11-08 20:22 | **Vague 1 lancée en parallèle** : 3 sous-agents code (Lot A Explorer / Lot B Création / Lots C+D coque+design) + 1 sous-agent tests (FID-072→082) | — |
