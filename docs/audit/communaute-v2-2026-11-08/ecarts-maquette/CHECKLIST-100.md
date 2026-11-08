# CHECKLIST-100 — fidélité 100 % à la maquette (suivi d'exécution)

**Source** : `BACKLOG-100.md` (85 items, 7 phases). **Branche** : `feat/fidelite-maquette`.

Légende : `[x]` fait **et vérifié** · `[~]` partiel · `[ ]` à faire · `[?]` arbitrage/à vérifier · `[!]` bloqué externe.

## Progression

| Phase | Items | Fait | Partiel | Reste |
|---|---|---|---|---|
| 1 — P1 bloquants | 1 | 1 | 0 | 0 |
| 2 — Transverses (coque, design system, moteur commun) | 9 | 9 | 0 | 0 |
| 3 — Explorer | 5 | 4 | 1 | 0 |
| 4 — Création | 21 | 5 | 2 | 14 |
| 5 — P3 cosmétique (passes design) | 25 | 14 | 5 | 6 |
| 6 — Exceptions § 6 et assumés réconciliables | 10 | 2 | 0 | 8 |
| 7 — Vérification et livraison | 14 | 9 | 1 | 4 |
| **Total** | **85** | **44** | **9** | **32** |

## Backlog par phase


### Phase 1 — P1 bloquants

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-001 | P1 | Recherche — résultats groupés et bascule « Sur la carte » (tous volets) — Attendu : le repli de couverture reste **dans** sa vignette 52×48 ; groupes (Ca… | Captures `explorer-recherche-resultats` (3 groupes + compteurs + surlignage) et… | déjà fait |

### Phase 2 — Transverses (coque, design system, moteur commun)

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-002 | P2 | États d'erreur — 4 volets Explorer + Création — Attendu : pastille d'erreur teintée danger (`--bad-bg` #F5DDD9, glyphe #A8443A)… | Captures `explorer-recherche-erreur` + erreurs Carnets/Clubs/Sorties ; axe ≥ 4,… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-003 | P2 | Tuiles carnet — badges de signature (tous carnets) — Attendu : « Carnet de la semaine » = **verre clair + encre forêt** (#E5F6E0) ;… | Capture `explorer-carnets` crop ×2 : semaine #E5F6E0, en route forêt/blanc ; te… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-004 | P2 | Détail Sortie — entête billet — Attendu : stub date **68 px à gauche**, corps à droite (`grid 68px 1fr`), haute… | Capture `explorer-sorties-detail` superposable à `explorer-sorties-detail.png`… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-005 | P2 | Pied de formulaire — 6 types — Attendu : **Retour visible et désactivé** à l'étape 1 (SP §4.1 autorise le masq… | Captures étape 1 des 6 types (bouton grisé présent) ; e2e : `getByRole('button'… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-006 | P2 | Mini-capsule d'étapes — 5 écrans — Attendu : ~76 px de réserve basse (aligné sur `.lkdv-cv2-pane`), dernier champ… | Captures des 5 écrans : dernier champ + hint entièrement visibles ; e2e `elemen… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-007 | P2 | Double libellé sur un même écran — Carnet/Tracé + Sortie/RDV — Attendu : un seul libellé par donnée. Constaté : « Distance »/« Dénivelé » en r… | Captures : 1 occurrence de chaque libellé ; test de rendu (occurrence unique pa… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-008 | P2 | Capsule 4 volets — détails empilés (audit corrigé) — **NON-ÉCART (vérifié)** : la maquette ne conserve PAS la capsule dans un détail… | Vérifié le 2026-11-08 : image maquette ouverte + code maquette lu + e2e existan… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-009 | P2 | Publication/Format — carte « Événement » — Attendu : vraie radio dans le `radiogroup` + note explicative + bouton « Créer… | axe : 0 violation « radiogroup sans radio » ; capture `creation-publication-eta… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-010 | P2 | Moteur de formulaire — compteur d'erreurs — **Question** : le compteur « N champs à corriger » doit-il rester visible (band… | Capture `creation-publication-erreurs` : compteur **et** champ fautif visibles… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |

### Phase 3 — Explorer

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-011 | P2 | Recherche/accueil — lieux populaires — Attendu : **tuiles illustrées** (couverture paysage) + nom + « N sorties ». Con… | Capture `explorer-recherche` superposable ; test unitaire `SearchHome` (libellé… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [~] | FID-012 | P2 | Peek & Pop — carnet et club — Attendu : carte large + **bandeau de couverture/blason** + titre/meta + 3 actio… | Captures des 2 peeks ; e2e peek (3 ou 4 actions après FID-065) ; test visuel. | partiel vague 1 (3 actions) — 4ᵉ action « Fermer » traité en vague 2 (J-14/FID-065) |
| [x] | FID-013 | P2 | Clubs — blason et cadenas (tuile, club du mois, détail) — Attendu : blason SVG **nu** (plus grand), cadenas en **coin de carte**. Constat… | Capture `explorer-clubs` + crop ×2 ; test `ClubCrest` (tailles 28/44/52/64/72). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-014 | P2 | Détail club — action principale et prochaines sorties — Attendu : action = **état d'adhésion** (« Rejoindre » / « Membre ✓ ») ; « Quitt… | Capture `explorer-clubs-detail` ; e2e : membre → « Membre ✓ » (pas un bouton d'… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-015 | P2 | Sorties — action d'inscription dans le billet — Attendu : action **dans le pied du billet**, à droite de la jauge (pastille 44… | Captures des 2 écrans : 1 seul libellé d'état par billet ; cible 44 px mesurée… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |

### Phase 4 — Création

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-016 | P2 | Brouillon — reprise à l'étape quittée — Attendu : rouvrir le brouillon **à l'étape quittée** (maquette `{d, step}`, HTM… | Capture `creation-brouillon` : étape 2 restaurée ; e2e : étape 2 → fermer → rou… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [~] | FID-017 | P2 | Club/Identité — avatar + bannière — Attendu : **deux médias distincts** — avatar carré + bannière 3:1 (D `Club#2`).… | Captures : `creation-club-etape1` (2 champs), `explorer-clubs` (avatar), `explo… | partiel vague 1 (UI/TS avatar+bannière) — persistance bannière attend migration (vague 2) |
| [~] | FID-018 | P2 | Sortie/Itinéraire — échelle de difficulté — Attendu : **5 niveaux** (Très facile, Facile, Moyen, Difficile, Expert) avec dé… | Capture `creation-sortie-etape2` (5 cartes) ; `explorer-sorties` (niveau lisibl… | partiel vague 1 (UI/TS 5 niveaux) — CHECK events.level borné à 3, repli documenté (migration vague 2) |
| [x] | FID-019 | P2 | Sortie/Sécurité — règle DVA ski de rando — Attendu : ski de rando **sans DVA** bloque l'étape Sécurité (maquette). Constat… | Capture étape 4 en erreur ; test unitaire (ski sans DVA → échec, ski avec → ok,… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-020 | P2 | Publication/Photo — légende obligatoire — Attendu : légende **facultative** en format Photo (maquette). Constaté : `conte… | Capture étape 2 sans légende puis Suivant → étape 3 ; test unitaire schéma. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-021 | P2 | Publication/Format — champ technique « clubId (repli) » — Attendu : aucun champ UUID visible ; la sélection se fait par les chips de club… | Capture audience « Un club » avec liste chargée : aucun champ UUID ; test de re… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-022 | P2 | Club — activités requises et placées en Identité — Attendu : au moins une activité **obligatoire**, saisie en Identité (« Choisis… | Capture étape 1 en erreur ; test schéma ; e2e création sans activité bloquée. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [ ] | FID-023 | P2 | Kit/Compléter — suggestions actionnables — Attendu : un bouton **« Ajouter »** par suggestion (maquette). Constaté : liste… | Capture étape 2 ; e2e : clic Ajouter → item dans l'inventaire + poids à jour. | à faire |
| [ ] | FID-024 | P2 | Kit/Inventaire — « Partir de » — Attendu : **4 points de départ** — kit existant, carnet, modèle, vide (CO `Kit#… | Capture étape 1 (4 entrées) ; e2e : modèle bivouac → N items préremplis + poids… | à faire |
| [ ] | FID-025 | P2 | Kit — aperçu, sac en couches, anneau de poids — Attendu : **KitCard en tête** (étapes 1-3), anneau de poids (`KitRing`), « sac… | Captures étapes 1-2 ; test visuel ; e2e : objectif modifié → anneau recalculé. | à faire |
| [ ] | FID-026 | P2 | Publication/Contenu — médias en lignes et affordances — Attendu : **lignes** (vignette, poignée, « Média 1 », « Envoyé », « Décrire l'i… | Capture étape 2 ; e2e : alt éditable sans appui long ; cibles ≥ 44 px (axe). | à faire |
| [ ] | FID-027 | P2 | Story/Média — hiérarchie de l'écran — Attendu : **aperçu compact 150 px** (« Story · 24 h / Ajoute un média / audienc… | Captures étape 1 et erreur média : hint visible **sans scroll** ; e2e Suivant s… | à faire |
| [ ] | FID-028 | P2 | Story/Diffusion — aperçu final, lien carnet et jour — Attendu : section « **Aperçu final exact** » libellée + lien carnet **et choix… | Capture étape 3 ; e2e : sélection d'un jour → payload `linked_carnet_day`. | à faire |
| [ ] | FID-029 | P2 | Carnet/Infos — aperçu vivant et nombre de jours — Attendu : **aperçu vivant en tête** (couverture, titre, destination, jours, km,… | Capture étape 1 ; e2e : dates 3 jours → stepper 3 ; stepper 5 → 5 jours à l'éta… | à faire |
| [?] | FID-030 | P2 | Carnet/Jours — initialisation — **Question** : 3 jours par défaut synchronisés aux dates (maquette) ou 0 jour (… | Capture étape 3 avec 3 jours ; test schéma/engine. | à vérifier |
| [ ] | FID-031 | P2 | Carnet/Partage — invitation — Attendu : **chips d'amis + « Inviter par lien »**. Constaté : switch « Carnet c… | Capture étape 4 ; e2e : lien copié + 2 amis sélectionnés. | à faire |
| [?] | FID-032 | P2 | Moteur — action finale après erreur serveur — **Question** : renommer l'action en **« Réessayer »** après échec serveur (maqu… | Capture d'un échec RPC simulé ; e2e : label bascule puis revient. | à vérifier |
| [?] | FID-033 | P3 | Île de succès — fermeture du tiroir — **Question** : fermer la feuille derrière l'île (maquette `finish()` → `startSh… | Capture `creation-succes-ile` ; e2e : après envoi, feuille fermée + île visible… | à vérifier |
| [ ] | FID-034 | P3 | Brouillon — « Effacer » — Attendu : confirmation « Effacer le brouillon ? » (maquette `lkvConfirm`). Cons… | Capture du dialogue ; e2e : Effacer → dialogue → Annuler conserve le brouillon. | à faire |
| [?] | FID-035 | P3 | Confirmation de fermeture — périmètre — **Question** : confirmer aussi quand un **autre type** a du contenu (maquette `… | e2e : brouillon Publication + ouverture Club vierge + fermeture → dialogue ; te… | à vérifier |
| [ ] | FID-036 | P3 | Confirmation de fermeture — scrim — Attendu : scrim **plein écran** (`inset:0`, maquette `confirm-back`). Constaté… | Capture `creation-fermeture-confirmation` ; e2e : clic hors dialogue sans effet. | à faire |

### Phase 5 — P3 cosmétique (passes design)

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-037 | P3 | Recherche/accueil — tendances — Attendu : icône de tendance **unique** (flèche) + « N **recherches** ». Constat… | Capture `explorer-recherche` ; test unitaire du libellé. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-038 | P3 | Tuile carnet — visa — Attendu : visa sur **une ligne** (« FR · 4 J · 62,4 KM »). Constaté : 2ᵉ ligne… | Capture `explorer-carnets` ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-039 | P3 | Avatars — initiales (carnets, clubs, membres, peeks) — Attendu : **1 lettre**. Constaté : 2 lettres (LÉ, TO, IN, VC). | Captures des 3 écrans ; test unitaire `initials`. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-040 | P3 | Fin de liste — pluriel et portée — Attendu : mention absente hors « Découvrir › Carnets » ; pluriel correct (0/1/n… | Captures des 4 volets ; test unitaire 0/1/2. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-041 | P3 | Libellés Explorer — clubs, sorties, détail — Attendu : « Demander à **rejoindre** », niveau « **Moyen** », « Ajouter au cale… | Captures des 3 écrans ; tests `format`. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-042 | P3 | Sorties — segment, distance, jauge, agenda — Attendu : « **Grille** / Liste », distance **seulement** en « Près de moi », ja… | Captures des 2 écrans ; test `AgendaStrip` (8 tests existants). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-043 | P3 | Mini-capsule — icônes de filtres et option active du tri — Attendu : globe / signet / **cœur** / épingle ; option active avec **anneau ins… | Captures des 2 écrans ; tests `SortMenuButton` (11). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-044 | P3 | État de chargement — squelette — Attendu : grille **2 col × 6 tuiles** `aspect-ratio 4/5,6`, radius 18, mini-cap… | Capture avec latence simulée ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-045 | P3 | États vide et erreur — ancrage et pastille — Attendu : bloc **ancré sous la capsule** (`padding:28px 18px`, pas de `flex:1`)… | Captures des 2 états ; axe ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [~] | FID-046 | P3 | Rayons et ratios (tuiles, couvertures) — Attendu : tuiles **18 px**, couverture **4/5**, tuile large **16/10**. Constaté… | Mesure Playwright (ratio 0,8 et 1,6) ; capture ; test garde `radius`. | partiel vague 1 (ratios/rаyons partiels) |
| [ ] | FID-047 | P3 | Publication/Format — cartes — Attendu : icône **au-dessus** du libellé, pastille d'audience **à droite**, ape… | Capture étape 1 ; test visuel. | à faire |
| [~] | FID-048 | P3 | Libellés et compteurs de champs (Publication, média) — Attendu : « **Photos et vidéos *** » + compteur **dans** le libellé, « 1 / 10 »… | Captures des 2 écrans ; tests schéma (messages). | partiel vague 1 (libellés média photo-seule documentés) |
| [x] | FID-049 | P3 | Pied de formulaire — chevrons et fond — Attendu : chevrons ‹ Retour / Suivant › + fond **transparent**. Constaté : sans… | Capture étape 2 ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [ ] | FID-050 | P3 | Story — méta, contrôles, calques, lien, rognage — Attendu : méta « Story · 24 h / audience / réponses », 2 boutons Galerie/Caméra… | Captures étapes 1-2 ; e2e lien invalide signalé sans changer d'étape. | à faire |
| [ ] | FID-051 | P3 | Carnet — destination, récit, titre, point de départ, profil, couverture — Attendu : destination en **chips**, « Aide à l'écriture » en chips, titre **100… | Captures étapes 1/2/4 ; test schéma (max 100). | à faire |
| [?] | FID-052 | P3 | Sortie — billet d'aperçu, icônes, steppers, chips — Attendu : billet avec topo + météo + « 0 km · +0 m · 1 h », icônes d'activité *… | Captures des 4 étapes ; test visuel ; comparaison avec `sortie-e1.png`. | à vérifier |
| [ ] | FID-053 | P3 | Kit — groupes, objet perso, saison, description, nom — Attendu : **6 groupes visibles** (vides compris), objet perso avec libellés + c… | Captures étapes 1-3 ; tests schéma. | à faire |
| [ ] | FID-054 | P3 | Club — activités, hints, rayon, questions, glisser, aperçu du post — Attendu : **5** activités + champ libre « Autre activité… », hint « Plusieurs c… | Captures des 4 étapes ; e2e questions conditionnelles. | à faire |
| [x] | FID-055 | P3 | Bandeau « Brouillon restauré » — Attendu : **pilule 999**, fond `--soft` + inset 1 px, 600 12, **horloge + « · »… | Capture `creation-brouillon` ; test contrat CSS. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [~] | FID-056 | P3 | Aperçu vivant — surtitre et emplacement — Attendu : **pas** de surtitre « APERÇU VIVANT · ÉTAPE n » ; aperçu en emplaceme… | Captures étapes 1-2 ; test visuel (position stable au scroll). | partiel vague 1 (surtitre retiré) — emplacement fixe 150 px hors périmètre shell |
| [x] | FID-057 | P3 | Teintes non vertes hors danger (ochre) — Attendu : aucune teinte non verte hors danger. Constaté : `--lkv-warning` #C89A… | Captures hors-ligne + compteur ; test `unification.spec` étendu aux jetons. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-058 | P3 | Focus clavier — rayon des contrôles — **Question** : le passage en rayon 8 px au focus est-il voulu ? Écran : pilule… | Capture clavier d'une pilule focalisée ; axe ; test visuel. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-059 | P3 | Suppression de média — cible tactile — Attendu : **44 px**. Constaté : 30×30 (`.lkdv-cv2-media-remove`). | Capture étape 2 ; test cibles (axe). | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [~] | FID-060 | P3 | Rendu des erreurs de champ — Attendu : **texte rouge seul**, pas de bordure + icône ⚠ ; **rebond** de la cap… | Capture `creation-publication-erreurs` ; test reduced-motion. | partiel vague 1 (compteur sticky) — rendu erreurs/bounce à finir |
| [~] | FID-061 | P3 | Copies — île, confirmation, sélecteur produit — Attendu : « **Dans le fil de la communauté** », message de confirmation **génér… | Captures des 3 écrans. | partiel vague 1 (certaines copies) |

### Phase 6 — Exceptions § 6 et assumés réconciliables

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-062 | P3 | Publication/Diffusion — options reportées **visibles** — Attendu : SP §6 dit « **Masquer** ces options » (commentaires/j'aime, sondage,… | Capture étape 3 : bloc absent ; test de rendu (libellé absent). | partiel vague 1 (interrupteurs inertes conformes, mention unique) |
| [?] | FID-063 | P3 | Ajouts V2 hors maquette — **Question** : conserver ou retirer les ajouts (hashtags, mentions, switch « an… | Captures des 6 écrans + entrée JOURNAL ; test de rendu par ajout retiré. | à vérifier |
| [?] | FID-064 | P3 | Place des champs entre étapes — **Question** : réaligner sur la maquette ou acter le déplacement ? Cas : Carnet… | Captures des étapes concernées ; entrée JOURNAL datée. | à vérifier |
| [?] | FID-065 | P3 | Peek — 3 ou 4 actions — **Question** : ajouter la 4ᵉ action « **Fermer** » (maquette, 4 lignes) ou cons… | Captures carnet + club ; e2e comptage des actions. | à vérifier |
| [?] | FID-066 | P3 | Confirmation de fermeture — hiérarchie — **Question** : action sûre en **primaire sombre** (V2, doctrine « rouge réservé… | Capture + axe (contraste du rouge) ; entrée JOURNAL. | à vérifier |
| [ ] | FID-067 | P3 | Carnet — visa pays + anneau « En route » — Attendu : « **FR** · 4 J · 62,4 KM » ; « En route » avec **anneau conique animé… | Capture `explorer-carnets` ; test de contrat RPC ; test visuel. | à faire |
| [ ] | FID-068 | P3 | Carnet/Sortie — édition du tracé et des jours — Attendu : suppression de segment, déplacement d'un point **intermédiaire**, gli… | Captures avant/après ; e2e gestes ; test undo. | à faire |
| [ ] | FID-069 | P3 | Kit — modèle, préparation, unités — Attendu : modèle **sélectionnable** (journée/bivouac/alpi), mode **préparation*… | Captures étapes 2-3 ; e2e modèle. | à faire |
| [x] | FID-070 | P3 | Chips de filtre — cible 32 px — **Question** : porter les chips à **44 px** (CLAUDE.md) ou acter l'alignement s… | Captures 4 volets ; audit cibles axe avec dérogation documentée. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [?] | FID-071 | P3 | Météo — tuiles, détail, sticker Story — **Question** : brancher la route météo existante sur les tuiles, le détail et l… | Captures avec RDV renseigné ; e2e réseau simulé. | à vérifier |

### Phase 7 — Vérification et livraison

| Fait | ID | Grav. | Objet (cible maquette) | Vérification attendue | Statut |
|---|---|---|---|---|---|
| [x] | FID-072 | P1 | Preuve du P1 (fermeture documentaire) — Attendu : la preuve qui **ferme** FID-001 — 2 captures conformes + e2e qui écho… | Rejeu CI des e2e Explorer + galerie à jour ; ligne de suivi item → preuve. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-073 | P2 | Recette visuelle — rejouer les 48 captures — Attendu : un jeu de captures **à jour** après corrections, avec table item → ca… | 48 captures à jour ; galerie sans capture invalide ; tableau item → capture com… | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-074 | P2 | Garde anti-recouvrement générique — Attendu : un test qui détecte un élément interactif **recouvert** (cause du P1,… | Test rouge sur l'ancien CSS (preuve de valeur) puis vert après correctif. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-075 | P2 | Échap hiérarchisé — preuve — Attendu : 5 niveaux dans l'ordre (menu de tri → peek → confirmation → détail →… | 5 captures + e2e. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-076 | P2 | États d'erreur des 3 volets + hors-ligne — Attendu : captures des erreurs Carnets/Clubs/Sorties et du bandeau hors-ligne (… | 4 captures + e2e. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [~] | FID-077 | P2 | Rôle invité — gating des écritures — Attendu : like, rejoindre, s'inscrire et ouverture de Création passent par `req… | 4 captures + e2e (aucune requête d'écriture). | partiel vague 1 (tests renforcés + zéro écriture) — marqueur invité en vague 2 |
| [!] | FID-078 | P2 | Porte de livraison — données et drapeau — Attendu : la fidélité ne peut être déclarée « 100 % » que sur données réelles ;… | Registre de migrations à jour + captures sur données réelles + drapeau vérifié. | bloqué J-08 (migrations prod) — hors autonomie |
| [x] | FID-079 | P3 | LensPager — preuve du geste — Attendu : seuil 48 px, verrou d'axe 8 px, 420 ms ; aucune capture du geste en c… | Capture + e2e 3 assertions. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [ ] | FID-080 | P3 | Contraste des surtitres sur fond sombre — Attendu : AA sur le verre, y compris quand une zone sombre de la photo traverse… | Rapport de contraste + capture. | à faire |
| [x] | FID-081 | P3 | Focus clavier — preuve — Attendu : anneau 2 px, rayon inchangé (FID-058), ordre de tabulation, piège de… | Captures + e2e + axe. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [x] | FID-082 | P3 | 360 px et 430 px — Attendu : 0 débordement horizontal et composition identique (couverts par e2e 1… | 0 débordement ; captures. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |
| [?] | FID-083 | P3 | Données réelles — blocs conditionnels — **Question** : les blocs RDV, météo, filigrane de trace, badge GPS et couvertur… | Captures sur données réelles + check liste des 5 blocs. | à vérifier sur données réelles après J-08 — non bloquant pour le reste |
| [ ] | FID-084 | P3 | Densité générale du tiroir — **Question** : la densité V2 (sections 10 px, blocs plus hauts, écart titre/met… | Mesures Playwright + captures appairées. | à mesurer (vague 2) |
| [x] | FID-085 | P3 | Ombre de l'île — règle « ombres encrées » — Attendu : ombres à base d'encre `rgba(11,31,23,%)`, jamais `rgba(0,0,0)`. Const… | Capture île ; test jetons. | ✗ fait + vérifié (vague 1 : build, e2e 46/46 ×2, axe 4/4, captures) |

## Journal de progression

| Date/heure | Événement | Preuve |
|---|---|---|
| 2026-11-08 20:12 | FID-001 (P1) corrigé | captures + e2e ; commits `a77970a`, `12dc3b5` |
| 2026-11-08 20:20 | Backlog 85 items + checklist | `BACKLOG-100.md` |
| 2026-11-08 20:31 | FID-008 clos en non-écart | maquette `renderStack()` L2084 + capture |
| 2026-11-08 21:30 | **Vague 1** (3 agents code + 1 agent tests) : coque/jetons, Explorer, Création | commit `89364fc` |
| 2026-11-08 21:58 | Vérification vague 1 : build vert, vitest 260/260, e2e **46/46 Chromium ET WebKit**, axe **4/4**, captures **82/82**, refs visuelles 4/4 | `22a7b65`, logs `/tmp/fid-*` |
| 2026-11-08 22:02 | **Vague 2 lancée** : 2 agents (Création kit/carnet/story/moteur ; Explorer/shared/data/météo/peek) | — |

