# Parité maquette — checklist de chantier

Objectif : 0 écart non justifié entre les 8 écrans de `bundle/references/maquette/*.dc.html` (et leurs drawers/formulaires) et l'application. Une case n'est cochée qu'avec une capture de preuve dans `etat/preuves/design/`.

## Outillage (fait)

- [x] Mode prévisualisation `CRM_DESIGN_PREVIEW=1` (hors production) : fixtures de la maquette, aucune donnée réelle — `crm/src/components/data/fixtures.ts`
- [x] `adminRpc()` sert les fixtures en prévisualisation — `admin-rpc.ts`
- [x] Middleware et CSP de dev compatibles (hydratation, ⌘K, drawers) — `middleware.ts`, `next.config.mjs`
- [x] Script de captures 25 vues (8 maquettes + drawers + formulaires + mobile) — `crm/scripts/capture-design.mjs`
- [x] Références 1440×1040 / 390×844 des 8 maquettes — `etat/preuves/reference/maquette/`
- [x] Inventaire des écarts A (1–4) et B (5–8) — `etat/preuves/design/DIFFS_A.md`, `DIFFS_B.md`

## Phase 1 — Coque, navigation, en-tête

- [x] Compteur « À traiter » = total de la file (34), pas la somme des pôles
- [x] En-tête complet sur l'accueil (temps réel, cloche, identité) ; réduit sur les écrans de travail (gabarits)
- [x] Carte « Votre session » uniquement sur l'accueil (maquette Main) ; compacte dans le rail du cas
- [x] « Temps réel connecté » en prévisualisation sans réseau
- [x] Pôle actif dans la navigation sur `/membres`, `/commandes`, `/pole/*` (fait pour préfixes ; vérifier captures)
- [x] Position/scroll de la carte session (maquette : bas du rail gauche, non tronquée)
- [x] Hauteurs d'en-tête, largeur nav, rayons/ombres mesurés = maquette

## Phase 2 — À traiter (`/`)

- [x] Groupes fusionnés « Signalements et contributions », sans compteur dans le bandeau
- [x] Compte à rebours relatif à l'heure réelle (gris/orange/rouge)
- [x] Rail contextuel : membre (avatar + signalements + avertissements), règle, cas liés, suggestion IA
- [x] Sous-titre : 1 urgence haute / 3 délais proches (compteurs dédiés)
- [x] Footer clavier retiré de la file (maquette sans barre) — vérifier capture
- [x] Densité des lignes (56 px), séparateurs, pastilles et alignements = maquette
- [x] Barre de progression « 12 traités sur 46 » (position/épaisseur)

## Phase 3 — Carte de décision (`/cas/...`)

- [x] Boutons : « Masquer le commentaire » (vert), « Laisser visible » (neutre), « Sanctionner l'auteur » (danger), « … »
- [x] Motif présélectionné depuis la règle du cas, aperçu du message membre
- [x] Média flouté + caption maquette (révélation au survol/focus, sans gros bouton)
- [x] Rail : membre compact, historique de modération + prochaine marche, cas liés, session compacte
- [x] Suggestion IA : agent en colonne, libellé + niveau de confiance, mention « visible après lecture »
- [x] Hauteur du bloc contenu, largeur de la carte décision, espacements = maquette
- [x] Drawer « … » (formulaire) conforme et utilisable (capture 05)
- [x] Toast d'annulation 10 s (après action) conforme

## Phase 4 — Fiche membre (`/membres/...`)

- [x] En-tête : avatar, nom, chips statut/avertissement/ancienneté, actions maquette
- [x] Colonne gauche : coordonnées masquées + Afficher, visibilité, 2FA, consentement, documents + motif
- [x] Résumé IA + badge « à relire », onglets (Activité/Modération/Commandes/Voyages), recherche
- [x] Fil d'activité groupé avec pastilles par type et dates
- [x] Rail : confiance (jauge + GPS), commandes (lignes), support, appareils/sessions
- [x] Drawer d'action membre (capture 08) conforme

## Phase 5 — Valider (`/valider/...`)

- [x] Récap demande, montant, empreinte, étapes, mode solo, saisie de confirmation, boutons
- [x] Capture avec saisie (10) et erreur de saisie

## Phase 6 — Équipe et agents (`/equipe`)

- [x] 6 cartes agents (statut, 24 h, taux accepté, jauge de plafond, outils, arrêter)
- [x] « Arrêter tous les agents » + confirmations
- [x] Capture arrêt (12)

## Phase 7 — Journal (`/journal`)

- [x] Filtres, colonnes, pastilles « Validé seul » / « Accès sensible », pagination

## Phase 8 — Barre de commande et drawer (`Commande.dc.html`)

- [x] Palette ⌘K : sections, largeur, ombre, raccourcis, aide clavier
- [x] Drawer générique : champs, aperçu message, boutons, focus piégé
- [x] Captures 14 et 15 conformes

## Phase 9 — SOS (`SOS.dc.html`)

- [x] Mobile 390 : 112 ≥ 52 px, « Je prends », position, contacts, déroulé
- [x] Bureau lisible ; capture 16 conforme

## Phase 10 — Écrans publics et secondaires

- [x] Connexion, double authentification, accès refusé (1440 + 390)
- [x] Catalogue, pôle, commande, technique, entraînement : cohérence gabarit

## Phase 11 — Vérification finale

- [x] 25 captures rejouées après corrections, 0 écart non justifié
- [x] Checklist des 40 contrôles écran par écran (`05_UI_UX_DESIGN.md` § 8) — `preuves/design/CHECKLIST_40.md`
- [x] `axe` 0 violation sur les états capturés ; cibles ≥ 44 px vérifiées
- [x] Jetons/typo mesurés au navigateur (couleurs, rayons, ombres, graisses)
- [x] `tsc`, `lint`, `vitest`, `next build` verts ; CI verte
- [x] Rapport de parité final (`etat/preuves/design/RAPPORT_PARITE.md`)


## État final (2026-11-09 21:20)

- 25 captures disponibles dans `etat/preuves/design/` (8 maquettes + drawers + formulaires + mobile + secondaires).
- `axe-core` : **0 violation** sur 15 écrans (1440) + SOS mobile — `etat/preuves/design/axe-design.json`.
- Couleurs/typo/rayons mesurés : fonds #F5F7F3/#FEFEFE, pastilles #D8E5D5/#FBF1DC, titres Manrope chargés, cartes rgba(255,255,255,.88), liseré clair rétabli.
- Écarts restants **justifiés** (voir `RAPPORT_PARITE.md` § 3) : recherche d'entités absente de la palette (pas de RPC), carte Empreinte ajoutée à l'écran Valider (EX-COM-03), bandeau « aperçu design » en préversion, partage famille SOS différé (route publique signée).
- Écarts non justifiés restants : 0 sur les 8 écrans de la maquette ; finitions secondaires listées dans le rapport.
