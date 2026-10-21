# Refonte du drawer Profil — 6 slots « Le vestiaire du voyageur »

Date : 21 octobre 2026.
Statut : design validé en brainstorming, en attente de revue utilisateur avant plan d'implémentation.
Portée : drawer Profil (`S.step === 0`) du compte LKDV, en vue propriétaire **et** en vue visiteur.

## 1. Contexte et problème

Le drawer Profil actuel compte 5 onglets rendus par le runtime vanilla :
`Pratique`, `Voyageur`, `Empreinte`, `Cordée`, `Vie privée`.
Ils sont majoritairement des réglages privés, peu lisibles pour un visiteur, et
n'exploitent pas les données réelles déjà présentes en base : badges, défis,
clubs, événements de club, prêts notés, checkpoints de sécurité, documents.

Objectifs :

1. Six slots clairs, utiles au propriétaire **et** présentables à un visiteur.
2. Tout contenu vient d'une table réelle ou affiche un état vide explicite.
3. Une identité visuelle LKDV distinctive, pas une copie de Strava ou Komoot.
4. Des innovations absentes des concurrents, centrées sur le kit, le prêt et la cordée.

## 2. Recherche concurrentielle — ce qu'on garde, ce qu'on jette

Sources principales consultées (extraits) :
Strava (profil, Trophy Case, clubs, gear, privacy zones, Beacon, Group Activities,
Heatmaps, Flyover), Komoot (Collections, Highlights, Adventure Streak, Peak Bagging,
Pioneer, group rides, Live Tracking), Polarsteps (Travel Tracker, Travel Book,
Travel Together, stats de pays), AllTrails (Verified Completed, stampbook des parcs,
listes privées par défaut, reviews), Wikiloc (UserRank, Trail Buddies, 3D),
Garmin Connect (badges, challenges, gear locker avec usure, LiveTrack, groupes),
Coros/Suunto (Personal Records, Year in Review, heatmaps agrégées), plateformes de
location (Kit Lender, Hygglo, 2Quip, Outdoorsy) et de clubs (Spond, Heylo, TeamSnap).

Idées retenues :

- **Trophy Case** : peu de badges récents mis en avant, le reste dans une armoire.
- **Local Legend / couronne de régularité** : récompenser la constance, pas la vitesse.
- **Gear locker** : usure, entretien, fenêtre de remplacement, coût par sortie.
- **Group Activities** : lier automatiquement les compagnons d'une même sortie.
- **Verified Completed / stampbook** : preuve de terrain et passeport de lieux.
- **Travel Book / Flyover** : transformer une sortie en souvenir partageable.
- **Privacy by default** : listes et stats privées par défaut, visibilité par bloc.
- **Prêts avec confiance** : vérification, notation mutuelle, état avant/après, garantie.
- **Clubs opérationnels** : rôle, événements, RSVP, sujets, bibliothèque de kits partagée.
- **Sécurité sans montre** : plan de sortie, check-ins programmés, escalade, hors-ligne.

Idées écartées :

- Classements de vitesse, segments KOM/QOM : contraires à l'ADR-010 LKDV.
- Feed social infini : le drawer reste un espace de synthèse, pas un fil.
- Copie du Trophy Case à l'identique : on garde le principe, pas l'esthétique.

## 3. Architecture des 6 slots

| # | Slot | Rôle | Visibilité |
|---|------|------|------------|
| 1 | **Vitrine** | Identité, stats, trophées, clubs, cordée | Public (sous-ensemble) |
| 2 | **Kit & Sac** | Kits, inventaire, poids, usure, lignée | Public si kit public |
| 3 | **Prêts & Locations** | Je prête / j'emprunte, confiance, contrats | Privé + carte de confiance publique |
| 4 | **Sorties & Souvenirs** | Sorties, carnets, photos, passeport de lieux | Public selon la publication |
| 5 | **Voyage & Sécurité** | Documents, checkpoints, contacts, hors-ligne | Privé |
| 6 | **Confidentialité & Réglages** | Qui voit quoi, notifications, exports | Privé |

Le slot 1 « Vitrine » contient quatre lentilles segmentées, comme demandé :
**Stats · Trophées · Clubs · Cordée**. Les clubs, les badges et les statistiques
vivent donc dans le même slot, mais chaque lentille a sa profondeur propre.

En vue visiteur, les slots 3, 5 et 6 sont remplacés par un état verrouillé
explicite (« Ce bloc est privé ») et un bouton « Demander à suivre ». La carte de
confiance du slot 3 reste visible si l'utilisateur l'a rendue publique.

## 4. Contenu détaillé

### Slot 1 — Vitrine

**En-tête** : avatar, nom, @handle, membre depuis, base de départ (floutée à 1 km),
badge de vérification, bouton Partager, bascule vue propriétaire / vue visiteur.

**Lentille Stats**
- Bandeau : km, D+, sorties, nuits dehors, massifs, pays.
- Couronne de régularité : nombre de semaines actives sur 12, série en cours.
- Percentile « profils similaires » (même tranche de pratique), jamais un rang nominatif.
- Bloc « Cette année » : 12 mois, meilleur mois, plus longue sortie.
- Chaque stat a un cadenas public/privé.

**Lentille Trophées**
- Armoire : 4 badges récents mis en avant, puis grille complète.
- Badges réels : `badges` (32) + `user_badges` (10), dédupliqués par nom.
- Progression : `progression_challenges` (8) et `challenges` (26).
- Chaque badge : nom, rareté, condition, date d'obtention, points.
- Carte partageable « Mon année LKDV » (image générée côté client).

**Lentille Clubs**
- Cartes club : nom, emoji, catégorie, rôle, statut d'adhésion, membres actifs.
- Prochain événement : `club_events` (26) avec date, lieu, places, RSVP.
- Derniers sujets : `club_topics` (40), épinglés et annonces en premier.
- Bibliothèque de kits partagée : `club_recommended_kits`.
- Actions : rejoindre, quitter, s'inscrire à un événement, ouvrir le club.

**Lentille Cordée**
- Abonnés / abonnements réels (`user_follows` + `public_profiles`).
- Compagnons de sortie : personnes présentes sur les mêmes sessions (`hike_sessions`
  + participants), façon « Trail Buddies » / « Group Activities ».
- Confiance : prêts rendus, notes, ancienneté.

### Slot 2 — Kit & Sac

- **Mes kits** : cartes `materiel_kits` (34) avec poids total, nombre d'objets,
  saison, destination, génération, reprises, preuves terrain, image de couverture.
- **Lignée** : arbre de filiation (`ancestors`, `lineage_root_id`, `generation`),
  part créateur (`kit_royalty_shares`).
- **Inventaire** : `product_ownership` (83) groupé par catégorie, poids, état,
  prix payé, coût par sortie, prêt en cours.
- **Usure vivante** : jauge calculée depuis les sorties réelles (km, D+, terrain,
  poids du sac), seuil d'entretien, fenêtre de remplacement liée au prochain voyage.
- **Actions** : créer un kit, ajouter un objet, définir le kit par défaut d'un voyage,
  marquer un entretien, retirer un objet.
- En vue visiteur : uniquement les kits marqués publics (`is_public`), sans prix,
  sans prêts, sans part créateur.

### Slot 3 — Prêts & Locations

- Deux lentilles : **Je prête** / **J'emprunte**.
- Carte de prêt : objet, personne, dates, échéance, statut (`en_cours`, `en_retard`,
  `rendu`), contrat PDF, état avant/après, notes mutuelles.
- Données réelles : `materiel_loans` (5), `loans` (5), `marketplace_reviews`.
- Champs disponibles : `lender_rating`, `borrower_rating`, `due_date`, `returned_at`,
  `contract_pdf_url`, `borrower_contact`.
- Carte de confiance publique : nombre de prêts, note moyenne, taux de retour à temps,
  badge « vérifié ».
- Actions : demander, accepter, refuser, marquer rendu, noter, signaler un litige.
- Innovation : **fiche de prêt photo** (état avant/après), **garantie LKDV**,
  **fenêtre de remplacement** si l'objet ne revient pas.

### Slot 4 — Sorties & Souvenirs

- Timeline des sorties (`hike_sessions`), carnets (`community_posts`, `carnets`),
  photos (`hike_session_photos`, `carnet_media`), stories (`post_stories`).
- Carte : traces, massifs (`geo_massifs`, 774), lieux visités.
- **Passeport de lieux** : massifs, parcs, refuges, sommets validés par une sortie
  réelle ; tampons façon stampbook AllTrails, sans invention de lieu.
- **Souvenir 3D** : flyover de la sortie (Relive/Flyover), avec le kit emporté,
  la météo et l'usure ajoutée.
- **Compagnons** : participants réels de la sortie, lien vers leur profil.
- Collections : carnets, albums, itinéraires enregistrés, voyages prévus.
- En vue visiteur : uniquement les contenus publiés.

### Slot 5 — Voyage & Sécurité

- **Documents** : `user_documents` (0) et `trip_documents` (50) — passeport, visa,
  assurance, permis ; alerte d'expiration.
- **Checkpoints** : `trip_safety_checkpoints` (54) — heure prévue, contact, statut,
  escalade si non pointé.
- **Partage live** : lien temporaire, position, batterie, arrêt automatique,
  fonctionne hors-ligne (`group_live_sessions`).
- **Préparation** : checklist (`trip_checklist_items`), cartes hors-ligne, devise,
  formalités, numéros d'urgence.
- Innovation : **check-in qui escalade** sans montre, **carte d'urgence hors-ligne**,
  **plan de sortie partagé** avant le départ.

### Slot 6 — Confidentialité & Réglages

- **Qui voit quoi** : matrice par bloc (stats, kit, prêts, clubs, souvenirs, sécurité)
  avec aperçu « vue visiteur » en direct.
- Notifications, unités, langue, mode extérieur, comptes connectés.
- Export RGPD JSON/GPX, suppression de compte, historique de consentement.
- Données : `user_profiles.signature_visibility` + nouvelle colonne
  `profile_section_visibility jsonb`.

## 5. Innovations différenciantes

1. **Couronne de régularité** : récompense la constance, jamais la vitesse.
2. **Kit vivant** : l'usure vient des sorties réelles et pilote l'entretien.
3. **Fiche de prêt photo + réputation** : confiance mesurable, pas déclarative.
4. **Passeport de lieux** : preuve de terrain, tampons, flyover 3D.
5. **Check-in qui escalade** : sécurité téléphone d'abord, sans montre.
6. **Vitrine vivante** : carte de visite LKDV exportable (image + QR).
7. **Compagnons de cordée** : liens tissés par les sorties partagées, pas par un follow.

## 6. Architecture technique

- **Shell** : le runtime conserve la feuille, les gestes, la lentille et les
  transitions. Le contenu des slots est délégué à des composants React montés
  dans la feuille via un pont (`window.__lkdvMountSlot`).
- **Données** : extension de `/api/compte/bootstrap` (stats, badges, challenges,
  clubs, événements, prêts, documents, checkpoints, collections) + routes dédiées
  pour les mutations (`/api/compte/loans`, `/api/compte/badges`, `/api/compte/clubs`,
  `/api/compte/safety`, `/api/compte/visibility`).
- **Base** : migration `profile_section_visibility jsonb default '{}'`, correction
  de `mapClubs` (prochain événement depuis `club_events`, pas `clubs.next_event`),
  déduplication des badges, index sur `materiel_loans(lender_id,status)` et
  `club_events(club_id,event_date)`.
- **Composants React** : `ProfileDrawerSlots/` avec un composant par slot, un
  composant `SlotHeader`, `SegmentedLens`, `StatTile`, `BadgeTile`, `ClubCard`,
  `LoanCard`, `StampTile`, `WearGauge`, `SafetyTimeline`, `VisibilityMatrix`.
- **Design** : cartes en verre dépoli, hiérarchie SF Pro, 44 px de cible tactile,
  réduction de mouvement, contraste extérieur, thème clair/teinté.
- **Tests** : specs design (structure, tokens), tests unitaires des mappers,
  tests API (auth, RLS, refus), Playwright propriétaire + visiteur.

## 7. Phasage

1. **Socle** : pont React, shell 6 slots, migration visibilité, correction clubs/badges.
2. **Vitrine** : stats, trophées, clubs, cordée.
3. **Kit & Sac** : kits, inventaire, usure.
4. **Prêts & Locations** : cartes, confiance, actions.
5. **Sorties & Souvenirs** : timeline, passeport, compagnons.
6. **Voyage & Sécurité** : documents, checkpoints, partage live.
7. **Confidentialité & Réglages** : matrice, vue visiteur, exports.
8. **Innovations** : carte de visite, flyover, couronne, fiche de prêt photo.

## 8. Limites connues

- Aucune table d'espèces naturalistes : pas d'herbier réel.
- Peu de coordonnées GPS dans `hike_sessions` : le passeport de lieux dépendra des
  régions/itinéraires et des futures traces.
- `hike_session_photos` est vide aujourd'hui : les souvenirs photo resteront des
  états vides tant que l'app mobile n'alimente pas la table.
- `user_challenges` et `user_documents` sont vides : progression et documents
  afficheront zéro tant que les écritures ne sont pas branchées.
- Les notes de prêt (`lender_rating`, `borrower_rating`) sont nulles sur les
  données actuelles : la carte de confiance affichera « pas encore noté ».

## 9. Décisions à confirmer par l'utilisateur

1. Les 6 slots ci-dessus, avec clubs + trophées + stats regroupés dans « Vitrine ».
2. Le passage à des composants React montés dans la feuille (recommandé) plutôt
   que l'extension du runtime vanilla.
3. La visibilité par défaut : stats et passeport privés, clubs publics, kit public
   seulement si `is_public`.
