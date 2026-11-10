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
- [~] Mode modification : menu « Modifier le carnet » (case à cocher), bouton « Terminer », tuile `+`,
      feuille « Créer » (9 types) qui **écrit réellement** un `carnet_moments` (zod, île + annulation, Ctrl/⌘+Z),
      « + Ajouter … » dans les lentilles Fil, Médias, Sac, Budget (preuve : `CarnetFinition.test.tsx`
      « mode modification », e2e `carnet-v2-finition.spec.ts`). **Reste** : pilules « Modifier » sur chaque carte,
      ajout d'étape, de nuit, de verdict et de voyageur (aucun écrit), photo/vidéo/note vocale : l'enregistrement
      audio n'est pas branché (titre + durée seulement). Le type n'est persisté qu'après application de
      `20261109100001_carnet_moments_type` (sinon repli : moment écrit sans type, type déduit à la relecture).

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
- [~] `prefers-reduced-motion` prouvé par composant (e2e : tuiles, pastille titre, `transition-duration` ≤ 10 ms) ; `prefers-reduced-transparency` écrit composant par composant
      en CSS (média query), **non rejoué automatiquement** (Playwright ne l'émule pas)

## Phase 7 — États, rôles, accès

- [x] Squelette de chargement de la fiche aligné sur la coque v2
- [x] Erreur de slot « Impossible de charger ce carnet. » + Réessayer, erreur d'un volet « Ce volet n'a pas pu s'afficher. » (les autres restent disponibles) : tests `CarnetFinition` ; banc : `/dev/carnet-v2?erreur=slot|volet`. Le banc de fidélité ne peut pas l'atteindre (aucun déclencheur en production, `tests/fidelity` non modifié)
- [~] Hors ligne : bandeau « Hors ligne », écriture refusée avec message (tests). Carte indisponible : état « Carte indisponible. » écrit dans `CompteMap` (variante carnet), **non testé** (WebGL toujours disponible ici)
- [x] Visiteur : pas de `+`, pas de mode modification, menu (Suivre le carnet, Partager…, Copier le lien, Signaler), lentille Budget absente (17 lentilles contre 18),
      position exacte jamais transmise (défense en profondeur dans l'écran), zone floue 60 px via la RPC `carnet_public_position` (lot D, différée ≥ 3 h, pgTAP existant)
      (preuve : `CarnetFinition.test.tsx` « visiteur », e2e « visiteur »). « Suivre le carnet » = suivre l'auteur (`user_follows`).
- [ ] Accès anonyme : hors périmètre sécurité, middleware inchangé (décision à assumer)

## Phase 8 — Recette finale

- [x] Captures 430/768/1440 + tiroir + peek + états (`prod-100-*`, `prod-*`)
- [ ] Axe 0 critical/serious : non rejoué dans cet environnement (banc axe non lancé) ; dernier résultat prouvé : 8 nov., 0
- [~] Portes du 9 nov. : 620 tests Vitest (carnet, features/carnet, compte) verts, `tsc` 0, ESLint 0 erreur, `next build` vert, 14/14 e2e `carnet-v2-finition` ; `perf:budget` et `verify:invariants` non rejoués
- [x] Prod vérifiée à l'URL (commit 1957aac/0ff2df8), mesures et axe 0

## Lot du 9 novembre 2026 — ce qui reste, raison exacte

- [ ] Pilules « Modifier » par carte, ajout d'étape / nuit / verdict / voyageur : aucun écrit encore (formulaires à écrire).
- [ ] Enregistrement audio réel de la note vocale : pas de MediaRecorder ni de stockage audio branchés.
- [ ] Migration `20261109100001_carnet_moments_type` : écrite, rollback et pgTAP écrits ; **non appliquée** (consigne : aucune migration de production), pgTAP non exécuté (aucune base Supabase locale).
- [ ] « À la une » : retraits et renommages gardés sur l'appareil (aucune table serveur de sélection).
- [ ] Épingles de moments : préférence de l'appareil (aucune table serveur).
- [ ] Stories des voyageurs, tiroir « Carnet » (QR, vues 7/30 j), fiches étape / nuit / objet complètes : non retouchés dans ce lot.
- [ ] Pixels : le banc de fidélité n'est pas sous 2 % (voir `docs/claude/FINITION-SUIVI.md`) ; les écarts restants sont l'illustration de la maquette contre le jeu de données du banc, l'anticrénelage du texte et la carte.
