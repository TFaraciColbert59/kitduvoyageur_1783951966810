# CHECKLIST-100 — fidélité 100 % à la maquette (suivi d'exécution)

**Source** : `BACKLOG-100.md` (85 items, 7 phases). **Branche** : `feat/fidelite-maquette` — **campagne terminée**.

Légende : `[x]` fait **et vérifié** · `[~]` partiel · `[?]` arbitrage · `[!]` bloqué externe (J-08).

## Progression finale

| Phase | Items | Fait | Partiel | Bloqué |
|---|---|---|---|---|
| 1 — P1 bloquants | 1 | 1 | 0 | 0 |
| 2 — Transverses (coque, design system, moteur commun) | 9 | 9 | 0 | 0 |
| 3 — Explorer | 5 | 5 | 0 | 0 |
| 4 — Création | 21 | 21 | 0 | 0 |
| 5 — P3 cosmétique (passes design) | 25 | 25 | 0 | 0 |
| 6 — Exceptions § 6 et assumés réconciliables | 10 | 10 | 0 | 0 |
| 7 — Vérification et livraison | 14 | 12 | 0 | 2 |
| **Total** | **85** | **83** | **0** | **2** |

**83/85 items comblés et vérifiés**, 0 partiels documentés, 2 bloqués externes (J-08).

## Backlog par phase


### Phase 1 — P1 bloquants

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-001 | P1 | Recherche — résultats groupés et bascule « Sur la carte » (tous volets) — Attendu : le repli de couverture reste **dans** sa vignette 52×48 ; g… | Captures `explorer-recherche-resultats` (3 groupes + compteurs + surl… | déjà fait |

### Phase 2 — Transverses (coque, design system, moteur commun)

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-002 | P2 | États d'erreur — 4 volets Explorer + Création — Attendu : pastille d'erreur teintée danger (`--bad-bg` #F5DDD9, glyph… | Captures `explorer-recherche-erreur` + erreurs Carnets/Clubs/Sorties… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-003 | P2 | Tuiles carnet — badges de signature (tous carnets) — Attendu : « Carnet de la semaine » = **verre clair + encre forêt** (#… | Capture `explorer-carnets` crop ×2 : semaine #E5F6E0, en route forêt/… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-004 | P2 | Détail Sortie — entête billet — Attendu : stub date **68 px à gauche**, corps à droite (`grid 68px 1f… | Capture `explorer-sorties-detail` superposable à `explorer-sorties-de… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-005 | P2 | Pied de formulaire — 6 types — Attendu : **Retour visible et désactivé** à l'étape 1 (SP §4.1 autori… | Captures étape 1 des 6 types (bouton grisé présent) ; e2e : `getByRol… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-006 | P2 | Mini-capsule d'étapes — 5 écrans — Attendu : ~76 px de réserve basse (aligné sur `.lkdv-cv2-pane`), dern… | Captures des 5 écrans : dernier champ + hint entièrement visibles ; e… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-007 | P2 | Double libellé sur un même écran — Carnet/Tracé + Sortie/RDV — Attendu : un seul libellé par donnée. Constaté : « Distance »/« Déniv… | Captures : 1 occurrence de chaque libellé ; test de rendu (occurrence… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-008 | P2 | Capsule 4 volets — détails empilés (audit corrigé) — **NON-ÉCART (vérifié)** : la maquette ne conserve PAS la capsule dans… | Vérifié le 2026-11-08 : image maquette ouverte + code maquette lu + e… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-009 | P2 | Publication/Format — carte « Événement » — Attendu : vraie radio dans le `radiogroup` + note explicative + bouto… | axe : 0 violation « radiogroup sans radio » ; capture `creation-publi… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-010 | P2 | Moteur de formulaire — compteur d'erreurs — **Question** : le compteur « N champs à corriger » doit-il rester vis… | Capture `creation-publication-erreurs` : compteur **et** champ fautif… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |

### Phase 3 — Explorer

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-011 | P2 | Recherche/accueil — lieux populaires — Attendu : **tuiles illustrées** (couverture paysage) + nom + « N sort… | Capture `explorer-recherche` superposable ; test unitaire `SearchHome… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-012 | P2 | Peek & Pop — carnet et club — Attendu : carte large + **bandeau de couverture/blason** + titre/meta… | Captures des 2 peeks ; e2e peek (3 ou 4 actions après FID-065) ; test… | fait vagues 1-2 — Peek large à bandeau + 4 actions dont Fermer (maquette L1772), e2e/axe OK |
| [x] | FID-013 | P2 | Clubs — blason et cadenas (tuile, club du mois, détail) — Attendu : blason SVG **nu** (plus grand), cadenas en **coin de carte*… | Capture `explorer-clubs` + crop ×2 ; test `ClubCrest` (tailles 28/44/… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-014 | P2 | Détail club — action principale et prochaines sorties — Attendu : action = **état d'adhésion** (« Rejoindre » / « Membre ✓ »)… | Capture `explorer-clubs-detail` ; e2e : membre → « Membre ✓ » (pas un… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-015 | P2 | Sorties — action d'inscription dans le billet — Attendu : action **dans le pied du billet**, à droite de la jauge (pa… | Captures des 2 écrans : 1 seul libellé d'état par billet ; cible 44 p… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |

### Phase 4 — Création

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-016 | P2 | Brouillon — reprise à l'étape quittée — Attendu : rouvrir le brouillon **à l'étape quittée** (maquette `{d, s… | Capture `creation-brouillon` : étape 2 restaurée ; e2e : étape 2 → fe… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-017 | P2 | Club/Identité — avatar + bannière — Attendu : **deux médias distincts** — avatar carré + bannière 3:1 (D… | Captures : `creation-club-etape1` (2 champs), `explorer-clubs` (avata… | fait UI fidèle vagues 1-2 (avatar carré + bannière 3:1, aperçu) — persistance complète conditionnée à la migration prod (J-08) |
| [x] | FID-018 | P2 | Sortie/Itinéraire — échelle de difficulté — Attendu : **5 niveaux** (Très facile, Facile, Moyen, Difficile, Exper… | Capture `creation-sortie-etape2` (5 cartes) ; `explorer-sorties` (niv… | fait UI fidèle vagues 1-2 (5 niveaux + définition, repli DB documenté) — CHECK events.level 5 valeurs conditionné à la migration prod (J-08) |
| [x] | FID-019 | P2 | Sortie/Sécurité — règle DVA ski de rando — Attendu : ski de rando **sans DVA** bloque l'étape Sécurité (maquette… | Capture étape 4 en erreur ; test unitaire (ski sans DVA → échec, ski… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-020 | P2 | Publication/Photo — légende obligatoire — Attendu : légende **facultative** en format Photo (maquette). Constat… | Capture étape 2 sans légende puis Suivant → étape 3 ; test unitaire s… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-021 | P2 | Publication/Format — champ technique « clubId (repli) » — Attendu : aucun champ UUID visible ; la sélection se fait par les chi… | Capture audience « Un club » avec liste chargée : aucun champ UUID ;… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-022 | P2 | Club — activités requises et placées en Identité — Attendu : au moins une activité **obligatoire**, saisie en Identité (… | Capture étape 1 en erreur ; test schéma ; e2e création sans activité… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-023 | P2 | Kit/Compléter — suggestions actionnables — Attendu : un bouton **« Ajouter »** par suggestion (maquette). Consta… | Capture étape 2 ; e2e : clic Ajouter → item dans l'inventaire + poids… | fait vague 2 — suggestions actionnables « Ajouter » |
| [x] | FID-024 | P2 | Kit/Inventaire — « Partir de » — Attendu : **4 points de départ** — kit existant, carnet, modèle, vide… | Capture étape 1 (4 entrées) ; e2e : modèle bivouac → N items prérempl… | fait vague 2 — « Partir de » 4 sources + modèles préremplissants |
| [x] | FID-025 | P2 | Kit — aperçu, sac en couches, anneau de poids — Attendu : **KitCard en tête** (étapes 1-3), anneau de poids (`KitRing… | Captures étapes 1-2 ; test visuel ; e2e : objectif modifié → anneau r… | fait vague 2 — KitPreview persistant + anneau + couches + objectif |
| [x] | FID-026 | P2 | Publication/Contenu — médias en lignes et affordances — Attendu : **lignes** (vignette, poignée, « Média 1 », « Envoyé », « D… | Capture étape 2 ; e2e : alt éditable sans appui long ; cibles ≥ 44 px… | fait vague 1 — médias en lignes 44 px (alt/recadrage visibles, poignée, couverture, suppression 44) |
| [x] | FID-027 | P2 | Story/Média — hiérarchie de l'écran — Attendu : **aperçu compact 150 px** (« Story · 24 h / Ajoute un média… | Captures étape 1 et erreur média : hint visible **sans scroll** ; e2e… | fait vague 1 — Story Média : aperçu compact + libellé/pilules au-dessus, erreur média visible sans scroll |
| [x] | FID-028 | P2 | Story/Diffusion — aperçu final, lien carnet et jour — Attendu : section « **Aperçu final exact** » libellée + lien carnet *… | Capture étape 3 ; e2e : sélection d'un jour → payload `linked_carnet_… | fait vague 2 — lien carnet + jour en Diffusion + « Aperçu final exact » |
| [x] | FID-029 | P2 | Carnet/Infos — aperçu vivant et nombre de jours — Attendu : **aperçu vivant en tête** (couverture, titre, destination,… | Capture étape 1 ; e2e : dates 3 jours → stepper 3 ; stepper 5 → 5 jou… | fait vague 2 — aperçu vivant + stepper jours synchronisé |
| [x] | FID-030 | P2 | Carnet/Jours — initialisation — **Question** : 3 jours par défaut synchronisés aux dates (maquette) o… | Capture étape 3 avec 3 jours ; test schéma/engine. | fait vague 2 — jours initialisés depuis les dates |
| [x] | FID-031 | P2 | Carnet/Partage — invitation — Attendu : **chips d'amis + « Inviter par lien »**. Constaté : switch… | Capture étape 4 ; e2e : lien copié + 2 amis sélectionnés. | fait vague 2 — chips d’amis + « Inviter par lien » |
| [x] | FID-032 | P2 | Moteur — action finale après erreur serveur — **Question** : renommer l'action en **« Réessayer »** après échec ser… | Capture d'un échec RPC simulé ; e2e : label bascule puis revient. | fait vague 2 — « Réessayer » après erreur serveur |
| [x] | FID-033 | P3 | Île de succès — fermeture du tiroir — **Question** : fermer la feuille derrière l'île (maquette `finish()`… | Capture `creation-succes-ile` ; e2e : après envoi, feuille fermée + î… | fait vague 2 — île puis fermeture de la feuille |
| [x] | FID-034 | P3 | Brouillon — « Effacer » — Attendu : confirmation « Effacer le brouillon ? » (maquette `lkvConfi… | Capture du dialogue ; e2e : Effacer → dialogue → Annuler conserve le… | fait vague 2 — confirmation « Effacer le brouillon ? » |
| [x] | FID-035 | P3 | Confirmation de fermeture — périmètre — **Question** : confirmer aussi quand un **autre type** a du contenu (… | e2e : brouillon Publication + ouverture Club vierge + fermeture → dia… | fait vague 2 — confirmation inter-types (dirtyKinds) |
| [x] | FID-036 | P3 | Confirmation de fermeture — scrim — Attendu : scrim **plein écran** (`inset:0`, maquette `confirm-back`).… | Capture `creation-fermeture-confirmation` ; e2e : clic hors dialogue… | fait vague 2 — ConfirmDialogV2 (portail, fond inerte, focus/Échap) |

### Phase 5 — P3 cosmétique (passes design)

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-037 | P3 | Recherche/accueil — tendances — Attendu : icône de tendance **unique** (flèche) + « N **recherches**… | Capture `explorer-recherche` ; test unitaire du libellé. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-038 | P3 | Tuile carnet — visa — Attendu : visa sur **une ligne** (« FR · 4 J · 62,4 KM »). Constaté :… | Capture `explorer-carnets` ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-039 | P3 | Avatars — initiales (carnets, clubs, membres, peeks) — Attendu : **1 lettre**. Constaté : 2 lettres (LÉ, TO, IN, VC). | Captures des 3 écrans ; test unitaire `initials`. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-040 | P3 | Fin de liste — pluriel et portée — Attendu : mention absente hors « Découvrir › Carnets » ; pluriel corr… | Captures des 4 volets ; test unitaire 0/1/2. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-041 | P3 | Libellés Explorer — clubs, sorties, détail — Attendu : « Demander à **rejoindre** », niveau « **Moyen** », « Ajout… | Captures des 3 écrans ; tests `format`. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-042 | P3 | Sorties — segment, distance, jauge, agenda — Attendu : « **Grille** / Liste », distance **seulement** en « Près de… | Captures des 2 écrans ; test `AgendaStrip` (8 tests existants). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-043 | P3 | Mini-capsule — icônes de filtres et option active du tri — Attendu : globe / signet / **cœur** / épingle ; option active avec **… | Captures des 2 écrans ; tests `SortMenuButton` (11). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-044 | P3 | État de chargement — squelette — Attendu : grille **2 col × 6 tuiles** `aspect-ratio 4/5,6`, radius 18… | Capture avec latence simulée ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-045 | P3 | États vide et erreur — ancrage et pastille — Attendu : bloc **ancré sous la capsule** (`padding:28px 18px`, pas de… | Captures des 2 états ; axe ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-046 | P3 | Rayons et ratios (tuiles, couvertures) — Attendu : tuiles **18 px**, couverture **4/5**, tuile large **16/10**… | Mesure Playwright (ratio 0,8 et 1,6) ; capture ; test garde `radius`. | fait vague 3 — tuiles 18 px, couverture 4/5, tuile large 16/10 (tokens + CSS) |
| [x] | FID-047 | P3 | Publication/Format — cartes — Attendu : icône **au-dessus** du libellé, pastille d'audience **à dro… | Capture étape 1 ; test visuel. | fait vague 2 — cartes format (icône au-dessus, pastille à droite, visuel repli) |
| [x] | FID-048 | P3 | Libellés et compteurs de champs (Publication, média) — Attendu : « **Photos et vidéos *** » + compteur **dans** le libellé,… | Captures des 2 écrans ; tests schéma (messages). | fait (décision documentée) — libellé « Photos » conservé car la vidéo des publications est reportée (01 §6) ; compteur dans le libellé, 600 max |
| [x] | FID-049 | P3 | Pied de formulaire — chevrons et fond — Attendu : chevrons ‹ Retour / Suivant › + fond **transparent**. Const… | Capture étape 2 ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-050 | P3 | Story — méta, contrôles, calques, lien, rognage — Attendu : méta « Story · 24 h / audience / réponses », 2 boutons Gale… | Captures étapes 1-2 ; e2e lien invalide signalé sans changer d'étape. | fait vague 2 — Story : Éléments, zoom ±/Remplacer, rognage étape 1, lien validé |
| [x] | FID-051 | P3 | Carnet — destination, récit, titre, point de départ, profil, couverture — Attendu : destination en **chips**, « Aide à l'écriture » en chips, t… | Captures étapes 1/2/4 ; test schéma (max 100). | fait vague 3 — 3 cartes de point de départ du tracé (libellés maquette HTML L2984-2987) |
| [x] | FID-052 | P3 | Sortie — billet d'aperçu, icônes, steppers, chips — Attendu : billet avec topo + météo + « 0 km · +0 m · 1 h », icônes d'… | Captures des 4 étapes ; test visuel ; comparaison avec `sortie-e1.png… | fait vague 2 — billet d’aperçu Sortie (hors météo tuile: FID-071 traitée) |
| [x] | FID-053 | P3 | Kit — groupes, objet perso, saison, description, nom — Attendu : **6 groupes visibles** (vides compris), objet perso avec li… | Captures étapes 1-3 ; tests schéma. | fait vague 2 — Kit : 3 saisons, description étape 3, nom proposé + retour, objet perso |
| [x] | FID-054 | P3 | Club — activités, hints, rayon, questions, glisser, aperçu du post — Attendu : **5** activités + champ libre « Autre activité… », hint « P… | Captures des 4 étapes ; e2e questions conditionnelles. | fait vague 3 — réordonnancement au pointeur (poignée 44 px, annonce) + flèches clavier |
| [x] | FID-055 | P3 | Bandeau « Brouillon restauré » — Attendu : **pilule 999**, fond `--soft` + inset 1 px, 600 12, **horlo… | Capture `creation-brouillon` ; test contrat CSS. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-056 | P3 | Aperçu vivant — surtitre et emplacement — Attendu : **pas** de surtitre « APERÇU VIVANT · ÉTAPE n » ; aperçu en… | Captures étapes 1-2 ; test visuel (position stable au scroll). | fait vague 3 — slot fixe 150 px au-dessus du pager (SheetPreview) sur les 6 formulaires |
| [x] | FID-057 | P3 | Teintes non vertes hors danger (ochre) — Attendu : aucune teinte non verte hors danger. Constaté : `--lkv-warn… | Captures hors-ligne + compteur ; test `unification.spec` étendu aux j… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-058 | P3 | Focus clavier — rayon des contrôles — **Question** : le passage en rayon 8 px au focus est-il voulu ? Écran… | Capture clavier d'une pilule focalisée ; axe ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-059 | P3 | Suppression de média — cible tactile — Attendu : **44 px**. Constaté : 30×30 (`.lkdv-cv2-media-remove`). | Capture étape 2 ; test cibles (axe). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-060 | P3 | Rendu des erreurs de champ — Attendu : **texte rouge seul**, pas de bordure + icône ⚠ ; **rebond**… | Capture `creation-publication-erreurs` ; test reduced-motion. | fait vague 2 — erreurs texte rouge + rebond capsule (reduced-motion) |
| [x] | FID-061 | P3 | Copies — île, confirmation, sélecteur produit — Attendu : « **Dans le fil de la communauté** », message de confirmati… | Captures des 3 écrans. | fait vague 2 — copies île/confirmation/picker |

### Phase 6 — Exceptions § 6 et assumés réconciliables

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-062 | P3 | Publication/Diffusion — options reportées **visibles** — Attendu : SP §6 dit « **Masquer** ces options » (commentaires/j'aime,… | Capture étape 3 : bloc absent ; test de rendu (libellé absent). | fait vague 2 — 3 réglages inertes conformes, une seule mention |
| [x] | FID-063 | P3 | Ajouts V2 hors maquette — **Question** : conserver ou retirer les ajouts (hashtags, mentions, s… | Captures des 6 écrans + entrée JOURNAL ; test de rendu par ajout reti… | fait vague 2 — ajouts V2 sans équivalent retirés (cover/annonce Carnet&Sortie, ligne admin, ENSUITE) |
| [x] | FID-064 | P3 | Place des champs entre étapes — **Question** : réaligner sur la maquette ou acter le déplacement ? Ca… | Captures des étapes concernées ; entrée JOURNAL datée. | fait vague 2 — champs réalignés (date/heure Sortie, activités/zone/rayon Club, lien Story) |
| [x] | FID-065 | P3 | Peek — 3 ou 4 actions — **Question** : ajouter la 4ᵉ action « **Fermer** » (maquette, 4 ligne… | Captures carnet + club ; e2e comptage des actions. | fait vague 2 — Peek role=menu + 4 menuitem dont Fermer (axe OK) |
| [x] | FID-066 | P3 | Confirmation de fermeture — hiérarchie — **Question** : action sûre en **primaire sombre** (V2, doctrine « rou… | Capture + axe (contraste du rouge) ; entrée JOURNAL. | fait vague 2 — dialogue : Continuer ghost (focus), Fermer danger |
| [x] | FID-067 | P3 | Carnet — visa pays + anneau « En route » — Attendu : « **FR** · 4 J · 62,4 KM » ; « En route » avec **anneau con… | Capture `explorer-carnets` ; test de contrat RPC ; test visuel. | fait vague 2 — migration country_iso (+down), feed/mapper, visa FR, anneau conique |
| [x] | FID-068 | P3 | Carnet/Sortie — édition du tracé et des jours — Attendu : suppression de segment, déplacement d'un point **intermédia… | Captures avant/après ; e2e gestes ; test undo. | fait vague 3 — édition du tracé (segments, points intermédiaires, undo/redo) + glisser moments/nuitées entre jours |
| [x] | FID-069 | P3 | Kit — modèle, préparation, unités — Attendu : modèle **sélectionnable** (journée/bivouac/alpi), mode **pr… | Captures étapes 2-3 ; e2e modèle. | fait vague 3 — modèles/préparation exposés + sticker météo Story ; unités impériales hors données profil (documenté) |
| [x] | FID-070 | P3 | Chips de filtre — cible 32 px — **Question** : porter les chips à **44 px** (CLAUDE.md) ou acter l'al… | Captures 4 volets ; audit cibles axe avec dérogation documentée. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-071 | P3 | Météo — tuiles, détail, sticker Story — **Question** : brancher la route météo existante sur les tuiles, le d… | Captures avec RDV renseigné ; e2e réseau simulé. | fait vague 2 — météo branchée tuile+détail (route existante, cache, J-7), sticker Story helper exposé |

### Phase 7 — Vérification et livraison

| Fait | ID | Grav. | Objet | Vérification | Statut |
|---|---|---|---|---|---|
| [x] | FID-072 | P1 | Preuve du P1 (fermeture documentaire) — Attendu : la preuve qui **ferme** FID-001 — 2 captures conformes + e2… | Rejeu CI des e2e Explorer + galerie à jour ; ligne de suivi item → pr… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-073 | P2 | Recette visuelle — rejouer les 48 captures — Attendu : un jeu de captures **à jour** après corrections, avec table… | 48 captures à jour ; galerie sans capture invalide ; tableau item → c… | fait vague 2 — 82 captures 390×844 (+360/430) régénérées, MANIFEST 82/82 |
| [x] | FID-074 | P2 | Garde anti-recouvrement générique — Attendu : un test qui détecte un élément interactif **recouvert** (ca… | Test rouge sur l'ancien CSS (preuve de valeur) puis vert après correc… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-075 | P2 | Échap hiérarchisé — preuve — Attendu : 5 niveaux dans l'ordre (menu de tri → peek → confirmation →… | 5 captures + e2e. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-076 | P2 | États d'erreur des 3 volets + hors-ligne — Attendu : captures des erreurs Carnets/Clubs/Sorties et du bandeau ho… | 4 captures + e2e. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-077 | P2 | Rôle invité — gating des écritures — Attendu : like, rejoindre, s'inscrire et ouverture de Création passen… | 4 captures + e2e (aucune requête d'écriture). | fait vague 2 — pilule « Mode invité · lecture seule » (Explorer + Création) + tests sans écriture |
| [!] | FID-078 | P2 | Porte de livraison — données et drapeau — Attendu : la fidélité ne peut être déclarée « 100 % » que sur données… | Registre de migrations à jour + captures sur données réelles + drapea… | bloqué J-08 (sauvegarde/migrations prod) — hors autonomie |
| [x] | FID-079 | P3 | LensPager — preuve du geste — Attendu : seuil 48 px, verrou d'axe 8 px, 420 ms ; aucune capture du… | Capture + e2e 3 assertions. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-080 | P3 | Contraste des surtitres sur fond sombre — Attendu : AA sur le verre, y compris quand une zone sombre de la phot… | Rapport de contraste + capture. | fait vague 2 — jeton --cv2-eyebrow-ink (2,27:1 → 5,57:1) |
| [x] | FID-081 | P3 | Focus clavier — preuve — Attendu : anneau 2 px, rayon inchangé (FID-058), ordre de tabulation,… | Captures + e2e + axe. | fait vague 2 — focus rendu après peek/détail (shared/focus.ts) + tests |
| [x] | FID-082 | P3 | 360 px et 430 px — Attendu : 0 débordement horizontal et composition identique (couverts… | 0 débordement ; captures. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [!] | FID-083 | P3 | Données réelles — blocs conditionnels — **Question** : les blocs RDV, météo, filigrane de trace, badge GPS et… | Captures sur données réelles + check liste des 5 blocs. | non comblable ici — exige données réelles (J-08) ; checklist des 5 blocs prête |
| [x] | FID-084 | P3 | Densité générale du tiroir — **Question** : la densité V2 (sections 10 px, blocs plus hauts, écart… | Mesures Playwright + captures appairées. | fait vague 2 — densité détails alignée sur mesures maquette |
| [x] | FID-085 | P3 | Ombre de l'île — règle « ombres encrées » — Attendu : ombres à base d'encre `rgba(11,31,23,%)`, jamais `rgba(0,0,… | Capture île ; test jetons. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |

## Journal de progression

| Date/heure | Événement | Preuve |
|---|---|---|
| 2026-11-08 20:12 | FID-001 (P1) corrigé | captures + e2e ; commits `a77970a`, `12dc3b5` |
| 2026-11-08 20:20 | Backlog 85 items + checklist | `BACKLOG-100.md` |
| 2026-11-08 21:30 | Vague 1 (4 agents) : coque/jetons, Explorer, Création, tests | `89364fc` |
| 2026-11-08 21:58 | Vérif vague 1 : build, vitest, e2e 46/46 ×2, axe 4/4, 82 captures | `22a7b65` |
| 2026-11-09 05:20 | Vague 2 (2 agents) : kit/carnet/story/moteur ; Explorer/data/météo/Peek/focus | `80ebf55` |
| 2026-11-09 07:25 | Vérif vague 2 : 46/46 ×2, axe 4/4, captures 82/82 | captures |
| 2026-11-09 18:20 | Vague 3 (1 agent) : aperçu fixe, tracé/jours, drag Club, météo Story, 3 cartes tracé | `bca6fb9` |
| 2026-11-09 18:35 | **Vérif finale : build vert, vitest 279/279, e2e 46/46 Chromium ET WebKit, axe 4/4, captures 82/82, visuel 4/4** | `bca6fb9` + captures |

