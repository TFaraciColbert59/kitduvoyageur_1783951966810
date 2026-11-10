# Fiche carnet v2 — checklist 100 % maquette

Référence : `annexes/maquette-fiche-carnet.html` (430×932). Chaque ligne est
fermée par une mesure ou une capture, pas par une impression.

## Phase 0 — Socle (fait, contre-vérifié)

- [x] Jetons du socle sur la racine (`--label`, `--label2`, `--tint`, `--ga`, `--gb`)
- [x] Carte `406×542 @12,49`, recette `.cs`, fond photo
- [x] Feuille `406×521.9 @12,48`, capsule 56, lentilles 30, `DRAWER_V2_CSS`
- [x] Barre haute 3 boutons, popover Affichage 2 interrupteurs
- [x] Fond `inert`, focus piégé, Échap, retour focus, scroll lock
- [x] Responsive 430/768/1440/390/360, colonne 430 centrée
- [x] `scrollHeight = innerHeight`, zéro débordement
- [x] Like carnet réel (post + peek), grille `role=group`, lignes du tiroir en boutons
- [x] Socle vérifié le 8 nov. (axe 0, 118 tests, perf 9/9) : chiffres historiques, remplacés par la recette finale (phase 8)

## Phase 1 — Vue du jour fidèle (priorité visuelle)

- [x] `dayhead` exact : badge `Tout`/`J{n}`, titre `from → to`, ligne
      `date · durée · km · D+`, météo à droite
- [x] Résumé = liste de `voyage-card` 144 px (photo/art, `pill-gps` J/date,
      `pill-alt` altitude de nuit, `from → to`, km · D+ · moments)
- [x] Clic sur une `voyage-card` → change de jour avec l'animation de swipe
- [x] Suppression du doublon `lkdv-ig-summary` (le dayhead le remplace)
- [x] Vue jour = dayhead + grille 3 colonnes (plus de bannière de verre)
- [x] Tuiles : pastille de type (9 types), heure, épingle, aplat par type
      (preuve : `CarnetFinition.test.tsx` « pastilles de type complètes », captures `docs/audit/carnet-v2-2026-11-09/captures/jour2-*`)
- [x] Swipe horizontal ±60 px, sortie 180 ms / entrée 320 ms, flèches clavier
- [x] Mode modification complet : menu « Modifier le carnet », « Terminer », tuile `+`, feuille « Créer » (9 types, `carnet_moments`),
      pilules « Modifier » sur chaque carte du Fil, des espèces et sur les fiches étape / nuit / objet / voyageur, « + Ajouter » une étape,
      une nuit, un verdict, un voyageur, une dépense, une rencontre, une espèce. Écritures par **Server Actions validées par zod**
      (`src/features/carnet/detail/editActions.ts`, schémas `editSchemas.ts`), droit vérifié par `is_carnet_participant` puis par la RLS ;
      île + annulation (Ctrl/⌘+Z), suppression confirmée en place. Note vocale **réelle** (MediaRecorder, `useVoiceRecorder.ts`,
      lecture dans les cartes du Fil). Preuves : `editSchemas.test.ts`, `editActions.test.ts` (17), `voiceAndMedia.test.ts`,
      `CarnetEditMode.test.tsx` (14), banc `carnet-modif-*`. Limites : l'étape s'écrit dans `groupe_etapes` (pas de table d'étapes propre au
      carnet) donc un carnet sans groupe refuse avec un message ; inviter / changer le rôle / retirer un voyageur est réservé à l'auteur (RLS).
      Les moments écrits portent leur type après `20261109100001_carnet_moments_type` (repli sinon).

## Phase 2 — Carte du bas fidèle

- [x] Fond topo (contours) pour le carnet : bascule topo par défaut, vérifiée en capture
- [x] Badges N1/N2/N3 verre/encre codés ; aucune nuit en démo, donc non affichés (donnée manquante)
- [x] Départ/arrivée (marqueurs réels) et tracé du jour actif (si points GPS du jour)
- [x] Clic sur un tracé → change de jour (preuve : e2e « toucher la trace d'un jour », clic MapLibre réel sur la couche de capture 22 px, 390×844 et 430×932)
- [x] Badge carte `Tout`/`J{n}`, échelle globe/massif/sentier, recentrer, zoom ± (3 contrôles)
- [x] Mode contexte du tiroir : filtre `saturate(.6) brightness(.97)`, contrôles masqués, couches réduites au slot actif
      (Fil → moments selon la lentille, Route → étapes ou nuits, Sac → objets du kit, Équipage → position)
      (preuve : `finition.test.ts` « couches de carte par tiroir », e2e « mode contexte »)

## Phase 3 — Altitude réelle

- [x] Enrichissement des altitudes manquantes par API DEM réelle (Open-Meteo)
- [x] Profil réel exposé dans `CarnetDetail.elevationProfile`
- [x] Accessoire `#acc` visible : badge, D+, sparkline, scrubber
- [x] Curseur du scrubber synchronisé avec un curseur sur la carte
- [x] Lentille Route › Altitude : courbe réelle + curseur

## Phase 4 — Peek & post 100 %

- [x] Migration `carnet_moment_likes` (RLS) — appliquée en prod le 8 nov. 21:20 (selon le journal ; non revérifié ici, aucun accès à la base de production)
- [x] Migration `carnet_moment_saves` (RLS) — appliquée en prod (selon le journal du 8 nov. ; non revérifié ici)
- [x] Migration `carnet_moment_comments` (RLS) — appliquée en prod (selon le journal du 8 nov. ; non revérifié ici)
- [x] Peek 5 actions : J'aime, Commenter, Enregistrer, Partager, Signaler
- [x] Post : j'aime/commentaires/enregistrer par moment
- [x] Signalement moment et carnet dans `comment_reports` (table polymorphe)
- [x] États vides/erreur des actions (île, états vides)

## Phase 5 — Sac, verdicts, reprise

- [x] Migration colonnes verdict (`carnet_kit_items.verdict*`) — appliquée en prod (selon le journal du 8 nov. ; non revérifié ici)
- [x] Filtres Essentiel/Utile/Jamais servi/Défaillant/Manquait avec compteurs + état vide (fixture Écrins : 14 objets, 5 verdicts ; test « filtres », verdict inconnu sans plantage)
- [x] Décision : la pilule « Reprendre » de **lecture** n'existe pas dans la maquette (seule `.kit-pill` existe, Sac et fiche objet) ;
      elle est retirée du code le 9 nov. (test « Reprendre n'existe que dans le Sac »). La case « faite » du 8 nov. était fausse.
- [x] Pilule « Reprendre » (kit) : bas gauche, toutes les lentilles du Sac et fiche objet, jamais ailleurs, annulable par l'île (test + capture `tiroir-sac-verdicts-*`)

## Phase 6 — Motion & détails

- [x] Morphing de la pilule titre + point d'édition
- [x] Cascade des lignes du tiroir 0/30/60/90 ms
- [x] Lentille chromatique : glow au press/glissement de la barre globale
- [x] Poignée de carte : drag > 20 px et clic
- [x] `prefers-reduced-motion` prouvé par composant (e2e : tuiles, pastille titre, `transition-duration` ≤ 10 ms) ; `prefers-reduced-transparency` gardé par `reducedTransparency.test.ts` (toute surface floutée doit avoir son repli opaque : 13 manquantes trouvées et corrigées) ; non émulable dans Playwright : jamais rejoué en navigateur
      en CSS (média query), **non rejoué automatiquement** (Playwright ne l'émule pas)

## Phase 7 — États, rôles, accès

- [x] Squelette de chargement de la fiche aligné sur la coque v2
- [x] Erreur de slot « Impossible de charger ce carnet. » + Réessayer, erreur d'un volet « Ce volet n'a pas pu s'afficher. » (les autres restent disponibles) : tests `CarnetFinition` ; banc : `/dev/carnet-v2?erreur=slot|volet`. Le banc de fidélité ne peut pas l'atteindre (aucun déclencheur en production, `tests/fidelity` non modifié)
- [x] Hors ligne : bandeau « Hors ligne », écriture refusée avec message (tests). Carte indisponible : testée avec WebGL refusé (`CompteMapUnavailable.test.tsx` : message, aucune instanciation MapLibre, variante hors ligne)
- [x] Visiteur : pas de `+`, pas de mode modification, menu (Suivre le carnet, Partager…, Copier le lien, Signaler), lentille Budget absente (17 lentilles contre 18),
      position exacte jamais transmise (défense en profondeur dans l'écran), zone floue 60 px via la RPC `carnet_public_position` (lot D, différée ≥ 3 h, pgTAP existant)
      (preuve : `CarnetFinition.test.tsx` « visiteur », e2e « visiteur »). « Suivre le carnet » = suivre l'auteur (`user_follows`).
- [ ] Accès anonyme : hors périmètre sécurité, middleware inchangé (décision à assumer)

## Phase 8 — Recette finale

- [x] Captures 430/768/1440 + tiroir + peek + états (`prod-100-*`, `prod-*`)
- [x] Axe 0 critical/serious, contraste compris : `tests/fidelity/a11y-carnet.spec.ts` (430×932 clair) — page participant, 5 tiroirs, 4 onglets du tiroir Carnet, mode modification + feuille d'édition, page visiteur + 5 tiroirs : 3/3 verts
- [~] Portes du 10 nov. : `tsc` 0, ESLint 0 erreur, Vitest carnet + features/carnet + compte 685/685 (un test préexistant, `ProfileDrawerBootstrap`, échoue parfois sous charge et passe seul), `verify:invariants` vert ; voir le compte rendu pour `next build`, `perf:budget` et e2e
- [x] Prod vérifiée à l'URL (commit 1957aac/0ff2df8), mesures et axe 0

## Lot du 10 novembre 2026 (passe 2) — ce qui reste, raison exacte

- [x] Pilules « Modifier », ajout d'étape / nuit / verdict / voyageur, note vocale réelle : voir Phase 1.
- [x] Stories des voyageurs : un groupe par voyageur, pilule auteur → fiche du voyageur dans l'Équipage, signalement du moment, « Message envoyé à {prénom} »,
      j'aime = j'aime du moment (`carnet_moment_likes`), bouton de partage dans le groupe d'actions. Le dock de réponse est absent sur ses propres stories (on ne se répond pas).
- [x] Tiroir « Carnet » réel : notifications du carnet (`notifications.related_type = 'carnet'`, filtres, « Tout lire »), partage (QR encodé sans dépendance et décodé par un
      décodeur indépendant, copier, vues et j'aime réels), paramètres (confidentialité et position en direct écrites par Server Action), gérer (titre, description 160, export GPX et JSON,
      suppression confirmée en place). **Non fait** : vues 7 / 30 jours (aucune table de vues datées), export PDF, unités impériales (contrôle présent, « bientôt »),
      parcours de découverte.
- [x] Fiches étape / nuit / objet / voyageur et lentilles Fil, Route, Sac, Équipage au format de la maquette (classes portées dans `carnet-v2-lenses.css`).
      **Écart de modèle** : la maquette liste cinq points de passage par jour, la base ne porte qu'une étape (départ → arrivée) par jour ; l'app montre l'étape. Pictogrammes d'objets
      par type absents de la donnée : icône générique. Météo : glyphe + température lus du texte de l'étape ; arc du soleil et lune non faits.
- [x] « À la une » et épingles : **gardés sur l'appareil, décision documentée** — la spec 01 § 1.2 ne demande aucune persistance serveur et la maquette garde `S.hl` en mémoire ;
      aucune migration pour cela.
- [ ] Migrations écrites, **non appliquées** (consigne), pgTAP écrits **non exécutés** (aucune base locale) : `20261110100000_carnet_moments_media_bucket` (seau audio + vidéo ; le seau
      `carnet-media` est limité aux images), `20261110100100_carnet_participants_write_etapes` (un participant écrit les étapes du groupe de son carnet).
- [x] Faille trouvée en passant : le téléversement des photos écrivait sous `carnet-moments/<uid>/…` alors que `carnet_media_insert_owner` exige `<uid>/…` en premier segment (envoi refusé en production). Corrigé.
- [x] Bug de rendu trouvé par le banc : texte des dépenses quasi illisible (encre du thème liquide sur fond crème) ; pilule d'état « Terminé » à tort (jours civils, lue après le montage).
- [ ] Pixels : voir la section Scores. Résumé 3,2 % et J1 3,5 % à 430, tiroirs 4,6–12,6 %, mode modification 9–12 %. Pas sous 2 % : voir « Écart résiduel » ci-dessous.

### Écart résiduel (mesuré, 430×932 clair)

- Texte : l'anticrénelage du même texte rendu deux fois par deux arbres DOM laisse 1 à 3 % de pixels (bandes y 0–320 du Résumé : 3,2 % au total).
- Boutons « Ouvrir le carnet » et pilule d'état : 2,2 px de largeur d'écart (141 contre 138,8) dont la cause n'est pas isolée.
- Tiroirs : capsule des 5 volets (icônes lucide de la primitive partagée avec `/compte` contre les icônes dessinées de la maquette, anneau d'état actif différent) et pictogrammes d'objets ; Route : modèle de données (voir ci-dessus).
- Création étape 2 (8,7 %) : champs de la feuille (maquette : `.lkdv-overlay-field` de 12,5 px ; app : 16 px pour éviter le zoom iOS, décision d'accessibilité).
- Stories : le média plein cadre est masqué (photo réelle) : le ratio « 0,0 % » n'est **pas** une mesure de fidélité ; les boîtes se jugent aux mesures DOM (9/26 à 430 : décalage de la zone sûre haute 32 px contre 70 px de la maquette, bouton ··· 44 px contre 34 px (règle 44 px), dock).
- 768×1024 : la maquette montre un téléphone 390×844, l'app une colonne de 430 px sur toute la hauteur ; la comparaison se fait sur l'intersection des cadres, d'où 18–38 % : mesure de cadre, pas de rendu.
- Les mesures sombres n'ont pas été rejouées dans cette passe (clair seulement).
