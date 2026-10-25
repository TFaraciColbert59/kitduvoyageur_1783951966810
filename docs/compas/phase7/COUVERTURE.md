# Compas — tableau de bord du banc de test (phase 7)

Objectif : 100 % des contrôles **activés ET vérifiés par une assertion**. Un clic sans assertion ne compte pas ;
un enregistrement ambigu (deux contrôles possibles) n’est crédité à personne.

| Étape | Scénarios réussis | échoués | ignorés | Contrôles vérifiés | Couverture |
|---|---:|---:|---:|---:|---:|
| Départ | 6 | 1 | 0 | 31 / 38 | 81,5 % |
| Commun | 12 | 1 | 0 | 44 / 49 | 89,7 % |
| Où | 12 | 2 | 0 | 60 / 66 | 90,9 % |
| Nous | 9 | 0 | 0 | 30 / 44 | 68,1 % |
| Résa | 3 | 1 | 0 | 20 / 22 | 90,9 % |
| Verdict | 3 | 0 | 1 | 8 / 13 | 61,5 % |
| Kit | 17 | 0 | 0 | 68 / 70 | 97,1 % |
| **Total** | | | | **261 / 302** | **86,4 %** |

Hors contrôles déclarés non testables en session (41) : 100 %.
Activés sans assertion : 0 · en attente d’un lot : 0 · enregistrements ambigus : 8 · non reconnus : 16.

## Contrôles non exercés, par étape

### Départ — 7

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| [select] | Compas vide › profil voyageur | non testable : Profil voyageur : demandé seulement à un compte non anonyme jamais interrogé ; l’essai sans compte ne le reçoit jamais. | `src/components/identity/TravellerCard.tsx:126` |
| Lyon | Compas vide › profil voyageur | non testable : Profil voyageur : demandé seulement à un compte non anonyme jamais interrogé ; l’essai sans compte ne le reçoit jamais. | `src/components/identity/TravellerCard.tsx:159` |
| Enregistrement… | Compas vide › profil voyageur | non testable : Profil voyageur : demandé seulement à un compte non anonyme jamais interrogé ; l’essai sans compte ne le reçoit jamais. | `src/components/identity/TravellerCard.tsx:175` |
| Passer | Compas vide › profil voyageur | non testable : Profil voyageur : demandé seulement à un compte non anonyme jamais interrogé ; l’essai sans compte ne le reçoit jamais. | `src/components/identity/TravellerCard.tsx:179` |
| Refuser | invitations | non testable : Invitations : exigent deux comptes réels qui s’invitent. | `src/features/compas/components/TripInvitations.tsx:106` |
| Accepter | invitations | non testable : Invitations : exigent deux comptes réels qui s’invitent. | `src/features/compas/components/TripInvitations.tsx:109` |
| Voir | invitations | non testable : Invitations : exigent deux comptes réels qui s’invitent. | `src/features/compas/components/TripInvitations.tsx:115` |

### Commun — 5

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| Réessayer | erreur de page | non testable : Page d’erreur : exige une panne serveur ; aucune injection de panne possible sur l’aperçu. | `src/app/compas/error.tsx:69` |
| Retour au hub | erreur de page | non testable : Page d’erreur : exige une panne serveur ; aucune injection de panne possible sur l’aperçu. | `src/app/compas/error.tsx:76` |
| … | carte de l’étape | non testable : Branche jamais rendue : aucun appelant ne passe `href` (code mort à retirer ou à utiliser). | `src/features/compas/components/CompasCards.tsx:253` |
| Appliquer : … | carte › prochaine décision | non testable : Offert seulement pour répartir le matériel commun entre plusieurs membres ; l’aventure d’essai est solo. | `src/features/compas/components/CompasDecision.tsx:112` |
| Garder mon voyage | note d’essai | non testable : Rendu seulement si NEXT_PUBLIC_KEEP_TRIAL=on ; éteint sur l’aperçu. | `src/features/compas/components/TrialNote.tsx:16` |

### Où — 6

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| Effacer le départ | carte où | non testable : Bloqué par le constat O-04 : le départ « depuis Lyon » n’est pas retenu à la création de l’aventure. | `src/features/compas/components/CompasCards.tsx:447` |
| Un jour de moins | tiroir ou | non testable : Le catalogue de parcours de l’aperçu ne répond pas depuis les départs d’essai. | `src/features/compas/components/CompasOuFlows.tsx:571` |
| Un jour de plus | tiroir ou | non testable : Le catalogue de parcours de l’aperçu ne répond pas depuis les départs d’essai. | `src/features/compas/components/CompasOuFlows.tsx:581` |
| Choisir ce parcours | tiroir ou | non testable : Le catalogue de parcours de l’aperçu ne répond pas depuis les départs d’essai. | `src/features/compas/components/CompasOuFlows.tsx:599` |
| … | tiroir ou | non testable : Case du calendrier : dépend de la météo réelle (MET Norway), vérifiée dans certains passages seulement. | `src/features/compas/components/CompasOuFlows.tsx:907` |
| Voir le groupe | tiroir ou | non testable : Exige un compte collaborateur en lecture seule (deux comptes réels). | `src/features/compas/components/CompasOuFlows.tsx:1208` |

### Nous — 14

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| Refuser … | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1887` |
| Accepter … | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1896` |
| Retirer de la communauté | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1909` |
| Titre | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1944` |
| Confiance minimale : …/100 | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1957` |
| … | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1971` |
| … | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1972` |
| … | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1973` |
| Places dans le groupe | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1978` |
| Départ | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1995` |
| Retour | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:1999` |
| Message | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:2005` |
| J’ai 18 ans ou plus | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:2013` |
| Lancer | tiroir nous › annonce | non testable : « Bouteille à la mer » : le formulaire n’apparaît qu’avec une confiance ≥ 65 (compte d’essai : 50) et « Lancer » publie dans la communauté. | `src/features/compas/components/CompasSheets.tsx:2016` |

### Résa — 2

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| Voir l’offre | tiroir résa › nuits › recherche | non testable : Aucune offre ne revient sur l’aperçu (mode test) : le lien « Voir l’offre » n’est pas rendu. | `src/features/compas/components/CompasSheets.tsx:2180` |
| …… | tiroir résa › offres | non testable : Aucune donnée de lien partenaire sur l’aperçu. | `src/features/compas/components/CompasSheets.tsx:2518` |

### Verdict — 5

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| Décaler | tiroir verdict › veille | non testable : « Décaler » n’est proposé que si la prévision donne un jour mauvais et une meilleure fenêtre à ± 3 jours : dépend de la météo réelle. | `src/features/compas/components/CompasSheets.tsx:2982` |
| Meteoalarm | verdict › alertes officielles | non testable : N’existe que si une alerte officielle est en cours sur la zone. | `src/features/compas/components/MeteoalarmNotice.tsx:35` |
| www.meteoalarm.org | verdict › alertes officielles | non testable : N’existe que si une alerte officielle est en cours sur la zone. | `src/features/compas/components/MeteoalarmNotice.tsx:47` |
| … | verdict › alertes officielles | non testable : N’existe que si une alerte officielle est en cours sur la zone. | `src/features/compas/components/OfficialAlertTexts.tsx:50` |
| … | verdict › alertes officielles | non testable : N’existe que si une alerte officielle est en cours sur la zone. | `src/features/compas/components/WorldAlertNotice.tsx:36` |

### Kit — 2

| Contrôle | Écran | Raison | Source |
|---|---|---|---|
| Je l’ai récupéré | fiche objet | non testable : Exige un objet prêté ; le prêt est inaccessible avec une aventure active (K-002). | `src/features/compas/components/CompasSheets.tsx:299` |
| Emprunter | trouver un objet | non testable : Exige un second membre avec compte. | `src/features/compas/components/CompasSheets.tsx:582` |

## Enregistrements ambigus (non crédités)

- « Ajouter à l’inventaire » (@etape:kit ajouter › inventaire : ajouter à l’inventaire, l’ajouter au kit, catégories, fiche d’un objet déjà dans le kit) → src/features/compas/components/CompasSheets.tsx::AddSheet::button::compas.sheets.common.addToInventory | src/features/compas/components/CompasSheets.tsx::InventaireFlow::button::compas.sheets.common.addToInventory
- « Ajouter à l’inventaire » (@etape:kit ajouter › inventaire : ajouter à l’inventaire, l’ajouter au kit, catégories, fiche d’un objet déjà dans le kit) → src/features/compas/components/CompasSheets.tsx::AddSheet::button::compas.sheets.common.addToInventory | src/features/compas/components/CompasSheets.tsx::InventaireFlow::button::compas.sheets.common.addToInventory
- « Eau » (@etape:kit onglets et Mes kits › les huit parcours du tiroir Kit s’ouvrent chacun sur leur contenu) → src/features/compas/components/CompasSheets.tsx::ItemSheet::button::anonyme | src/features/compas/components/CompasSheets.tsx::StepSheet::button::compas.sheets.step.flows:kit.eau
- « Mes randos » (@etape:ou lecture et navigation › « Parcours » : sources, recherche, fiche d’un parcours et retour) → src/features/compas/components/CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill | src/features/compas/components/CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill#2
- « Autour · 50 km » (@etape:ou lecture et navigation › « Parcours » : sources, recherche, fiche d’un parcours et retour) → src/features/compas/components/CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill | src/features/compas/components/CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill#2
- « Lac » (@etape:ou retouches de l’aventure › « Préférences » : rythme, nuits, niveau, terrain, voiture, nuits dehors, poids max, éviter et envies) → src/features/compas/components/CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill | src/features/compas/components/CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill#2
- « Hôtels, Chalets & Lodges à Chamonix-Mont-BlancBooking.com » (@etape:resa réservations › « Nuits » : noter un hébergement à la main, chercher (lecture seule), « Noter », double-touche) → src/features/compas/components/CompasSheets.tsx::NuitsFlow::a::compas.sheets.common.partner | src/features/compas/components/CompasSheets.tsx::OffresFlow::a::compas.sheets.common.partner | src/features/compas/components/CompasSheets.tsx::LiveSearch::a::cls:cp-row
- « Vol en tandem parapente au-dessus de Chamonix - Au départ de Plan de L'Aiguille189 € · tarif à revalider » (@etape:resa réservations › « Offres » : catégories, « Chercher un hébergement nuit par nuit », recherches en direct) → src/features/compas/components/CompasSheets.tsx::NuitsFlow::a::compas.sheets.common.partner | src/features/compas/components/CompasSheets.tsx::OffresFlow::a::compas.sheets.common.partner | src/features/compas/components/CompasSheets.tsx::LiveSearch::a::cls:cp-row

## Enregistrements non reconnus (hors inventaire : coquille du site, contrôle non inventorié ?)

- `nav` « Étapes du Compas » · étape kit · @etape:commun capsule-et-affichage › capsule d’étapes : toucher une étape, ou la glisser sous la lentille
- `button` « Glisser pour agrandir la carte » · étape ou · @etape:commun carte › carte : agrandir / réduire, recentrer, personnaliser (fond, calques, carte nue, tout afficher)
- `button` « Jour 1 · Sainte-Eulalie-en-Royans » · étape ou · @etape:commun carte › encart d’un point touché : « Voir dans Parcours » puis « Fermer l’encart »
- `button` « Sources » · étape verdict · @etape:commun tiroirs › pied du tiroir : « Suivant », « Onglet précédent », « Terminer », et les onglets
- `input` « Enveloppe : 900 € » · étape ou · @etape:commun dis-le › « Dis-le » : comprendre une phrase, cocher, effacer, appliquer, puis « Annuler » (bouton et zone)
- `button` « Ski » · étape depart · @etape:depart compas-vide › « Ta demande » est lue à la frappe ; « Préciser » ouvre activités, durée et personnes
- `button` « Durée : plus » · étape depart · @etape:depart compas-vide › durée et personnes : « plus » et « moins » précisent le résumé, « auto » les rend
- `button` « Durée : moins » · étape depart · @etape:depart compas-vide › durée et personnes : « plus » et « moins » précisent le résumé, « auto » les rend
- `button` « Personnes : plus » · étape depart · @etape:depart compas-vide › durée et personnes : « plus » et « moins » précisent le résumé, « auto » les rend
- `button` « Personnes : moins » · étape depart · @etape:depart compas-vide › durée et personnes : « plus » et « moins » précisent le résumé, « auto » les rend
- `button` « Jetable l8rfrà peser · chacun · À trouver » · étape kit · @etape:kit carte et ligne › ligne d’objet : toucher, zone de la ligne, appui long, glisser puis « Retirer », emballer
- `input` « Poids max du sac de base (kg) » · étape ou · @etape:ou retouches de l’aventure › « Préférences » : rythme, nuits, niveau, terrain, voiture, nuits dehors, poids max, éviter et envies
- `span` « 203,71 € · tarif à revalider avant tout paiement » · étape resa · @etape:resa réservations › « Nuits » : noter un hébergement à la main, chercher (lecture seule), « Noter », double-touche

