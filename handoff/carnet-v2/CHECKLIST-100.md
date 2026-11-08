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
- [x] Axe 0 critical/serious, 118/118 tests, `tsc` 0, build 0, perf 9/9

## Phase 1 — Vue du jour fidèle (priorité visuelle)

- [x] `dayhead` exact : badge `Tout`/`J{n}`, titre `from → to`, ligne
      `date · durée · km · D+`, météo à droite
- [x] Résumé = liste de `voyage-card` 144 px (photo/art, `pill-gps` J/date,
      `pill-alt` altitude de nuit, `from → to`, km · D+ · moments)
- [x] Clic sur une `voyage-card` → change de jour avec l'animation de swipe
- [x] Suppression du doublon `lkdv-ig-summary` (le dayhead le remplace)
- [x] Vue jour = dayhead + grille 3 colonnes (plus de bannière de verre)
- [~] Tuiles : pastille de type partielle (5 types), heure/épingle présentes
- [x] Swipe horizontal ±60 px, sortie 180 ms / entrée 320 ms, flèches clavier
- [ ] Mode modification : tuile `+` dans la grille

## Phase 2 — Carte du bas fidèle

- [x] Fond topo (contours) pour le carnet : bascule topo par défaut, vérifiée en capture
- [x] Badges N1/N2/N3 verre/encre codés ; aucune nuit en démo, donc non affichés (donnée manquante)
- [~] Départ/arrivée / tracé actif : partiel (tracé unique, pas de nuits)
- [ ] Clic sur un tracé → change de jour
- [~] Badge carte `Tout`/`J{n}` + zoom/recentrer ; échelle non exposée
- [~] Mode contexte du tiroir : badge + couches réduites partiels

## Phase 3 — Altitude réelle

- [x] Enrichissement des altitudes manquantes par API DEM réelle (Open-Meteo)
- [x] Profil réel exposé dans `CarnetDetail.elevationProfile`
- [x] Accessoire `#acc` visible : badge, D+, sparkline, scrubber
- [x] Curseur du scrubber synchronisé avec un curseur sur la carte
- [x] Lentille Route › Altitude : courbe réelle + curseur

## Phase 4 — Peek & post 100 %

- [x] Migration `carnet_moment_likes` (RLS) — appliquée en prod le 8 nov. 21:20
- [x] Migration `carnet_moment_saves` (RLS) — appliquée en prod
- [x] Migration `carnet_moment_comments` (RLS) — appliquée en prod
- [x] Peek 5 actions : J'aime, Commenter, Enregistrer, Partager, Signaler
- [x] Post : j'aime/commentaires/enregistrer par moment
- [x] Signalement moment et carnet dans `comment_reports` (table polymorphe)
- [x] États vides/erreur des actions (île, états vides)

## Phase 5 — Sac, verdicts, reprise

- [x] Migration colonnes verdict (`carnet_kit_items.verdict*`) — appliquée en prod
- [~] Filtres Essentiel/Utile/Jamais servi/Défaillant/Manquait + état vide ; aucune donnée verdict en démo
- [x] Pilule « Reprendre » de lecture (mémoire de scroll par lentille)
- [ ] Pilule « Reprendre le kit » conservée

## Phase 6 — Motion & détails

- [x] Morphing de la pilule titre + point d'édition
- [x] Cascade des lignes du tiroir 0/30/60/90 ms
- [ ] Lentille chromatique : barre globale, hors fiche (non faite)
- [x] Poignée de carte : drag > 20 px et clic
- [~] `prefers-reduced-motion` respecté ; `prefers-reduced-transparency` global seulement

## Phase 7 — États, rôles, accès

- [ ] Squelettes de slot/onglet : non faits
- [~] Erreur de slot : SlotShell fournit l'état, pas de scénario erreur dédié
- [ ] Hors ligne / carte indisponible : non testés
- [ ] Visiteur : zone floue différée, pas de budget, pas de `+`
- [ ] Accès anonyme : hors périmètre sécurité, middleware inchangé (décision à assumer)

## Phase 8 — Recette finale

- [x] Captures 430/768/1440 + tiroir + peek + états (`prod-100-*`, `prod-*`)
- [ ] Axe 0 critical/serious
- [ ] 118+ tests, `tsc`, build, perf, invariants
- [x] Prod vérifiée à l'URL (commit 1957aac/0ff2df8), mesures et axe 0
