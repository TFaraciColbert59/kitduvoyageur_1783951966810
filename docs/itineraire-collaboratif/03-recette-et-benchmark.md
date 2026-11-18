# Recette et benchmark du créateur d’itinéraires

Référence historique du 18 novembre 2026. Rejouer chaque critère sur la branche d’implémentation. Barème sur cinq vérifications, 0 si non établi, 1 si partiel, 2 si établi. Les données de production de l’audit sont conservées dans le rapport privé.

| Catégorie | LKDV | Komoot | AllTrails | Outdooractive | Strava | Parcours Rando |
|---|---:|---:|---:|---:|---:|---:|
| Découverte et cartes | 5.75 | 7.75 | 8.00 | 9.75 | 6.50 | 2.75 |
| Planification d’itinéraires | 4.50 | 9.25 | 8.75 | 8.75 | 5.00 | 8.50 |
| Matériel et autonomie | 6.75 | 0.00 | 0.00 | 0.00 | 1.50 | 8.50 |
| Navigation et terrain | 4.75 | 9.75 | 8.25 | 8.50 | 7.50 | 0.50 |
| Sport et capteurs | 3.50 | 5.50 | 5.75 | 6.75 | 10.00 | 2.50 |
| Communauté et groupes | 7.00 | 4.50 | 3.25 | 7.00 | 9.25 | 1.50 |
| Carnets et réutilisation | 5.75 | 6.25 | 6.50 | 8.25 | 6.50 | 5.75 |
| Confiance et données | 6.25 | 7.75 | 6.50 | 7.25 | 8.00 | 6.50 |
| Accès et ergonomie | 6.50 | 7.50 | 7.50 | 7.50 | 6.50 | 6.00 |
| Services matériel | 5.75 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

## D1 · Recherche de sorties

- **D1.1 · Recherche textuelle (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D1.2 · Carte ou zone (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D1.3 · Filtre par activité (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D1.4 · Filtre chiffré de distance, durée ou D+ (1/2 au relevé).** Rendre le filtre numérique explicite et cumulable avec le sport. Vérifier les résultats aux bornes de distance, de durée ou de D+ et afficher les valeurs inconnues.
- **D1.5 · Recherche par commune géocodée (0/2 au relevé).** Résoudre la commune avant de chercher les traces. Sans GPS, Lille recentre la carte au bon endroit et deux communes homonymes sont désambiguïsées.

## D2 · Fiche pour choisir une sortie

- **D2.1 · Distance et D+ (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D2.2 · Durée et difficulté (0/2 au relevé).** Afficher une durée estimée et une difficulté expliquée. Vérifier les unités, les hypothèses et l’état des données manquantes sur trois fiches.
- **D2.3 · Profil altimétrique (1/2 au relevé).** Tracer un profil à partir de la géométrie exploitable. Sélectionner un point du profil et retrouver le même point sur la carte.
- **D2.4 · Type de sol (0/2 au relevé).** Associer une surface aux segments dont la source le permet. Tester une route mixte et afficher « inconnu » sur les segments non renseignés.
- **D2.5 · Photos ou avis sur l’itinéraire (0/2 au relevé).** Permettre un avis ou une photo liés à l’itinéraire. Un deuxième compte voit la contribution datée sur la bonne fiche après rechargement.

## D3 · Fonds et points d’intérêt

- **D3.1 · Carte et variante relief (1/2 au relevé).** Proposer plan et relief avec un repli lisible. Changer le fond sans perdre trace, zoom ni sélection.
- **D3.2 · Fond IGN France documenté (0/2 au relevé).** Intégrer un fond IGN France autorisé pour l’usage retenu. Vérifier l’accès sur deux zones et afficher attribution et périmètre.
- **D3.3 · 3D ou satellite (1/2 au relevé).** Valider au moins la 3D ou le satellite. Ouvrir une trace dans cette vue et revenir au plan lorsque le rendu échoue.
- **D3.4 · Repères utiles eau ou hébergement (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D3.5 · Attribution de la donnée visible (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.

## D4 · Conditions récentes du terrain

- **D4.1 · Avis ou observation datée (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D4.2 · Signalement dédié (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D4.3 · Confirmation ou réponse publique (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **D4.4 · Affichage d’alerte ou fermeture sur carte (1/2 au relevé).** Relier une alerte ou fermeture à une zone et à la fiche de la route touchée. La même alerte apparaît aux deux endroits avec sa source.
- **D4.5 · Filtre ou expiration de fraîcheur (0/2 au relevé).** Ajouter date, durée de validité et filtre de fraîcheur. Une fermeture expirée quitte la vue active et reste identifiable dans l’historique.

## P1 · Créer et éditer un tracé

- **P1.1 · Routage par points (1/2 au relevé).** Créer une route entre trois points avec recalcul quand un point bouge. Vérifier que l’échec du routeur propose une reprise manuelle.
- **P1.2 · Dessin point à point (1/2 au relevé).** Dessiner et corriger une section point à point sans accrochage forcé. La section reste identique à la réouverture.
- **P1.3 · Profils selon l’activité (1/2 au relevé).** Appliquer des profils distincts à pied et à vélo. Vérifier que le changement de profil modifie le segment selon une règle connue.
- **P1.4 · Édition après sauvegarde (1/2 au relevé).** Modifier puis enregistrer un tracé existant. Après rechargement, retrouver la version enregistrée et garder l’original si l’édition a été lancée sur une copie.
- **P1.5 · Aperçu distance et dénivelé (1/2 au relevé).** Afficher distance et dénivelé sur la géométrie réellement sauvegardée. Comparer avec deux GPX de référence et signaler l’absence de données d’altitude.

## P2 · Préparer plusieurs étapes

- **P2.1 · Découper ou générer plusieurs jours (1/2 au relevé).** Découper une trace continue ou planifier trois jours. Vérifier l’ordre, les jonctions et le recalcul après déplacement d’une coupure.
- **P2.2 · Jours datés (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **P2.3 · Points de nuit ou réservations reliés (1/2 au relevé).** Attacher un refuge ou un lieu de nuit à une étape. À la réouverture, vérifier l’association et distinguer un lieu choisi d’une réservation confirmée.
- **P2.4 · Notes par étape ou journée (1/2 au relevé).** Éditer une note par journée. Déplacer une étape et vérifier que sa note la suit.
- **P2.5 · Export des étapes comme traces (0/2 au relevé).** Exporter chaque étape en GPX. Ouvrir les fichiers dans un lecteur externe et vérifier les bons départs et arrivées.

## P3 · Import, export et partage GPX

- **P3.1 · Importer un GPX (1/2 au relevé).** Importer un GPX valide et gérer les fichiers vides, invalides et multi-segments. La trace reçue correspond au fichier.
- **P3.2 · Exporter sa trace (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **P3.3 · Exporter un itinéraire de catalogue (0/2 au relevé).** Télécharger un GPX depuis une fiche de catalogue autorisée. Vérifier géométrie, nom et attribution requise.
- **P3.4 · Éditer une importation (0/2 au relevé).** Créer une copie éditable d’une importation. Modifier un point sans altérer le fichier source et exporter le nouveau tracé.
- **P3.5 · Partager une route via lien (1/2 au relevé).** Partager une route par lien. Vérifier lecture, restrictions et révocation depuis une session distincte.

## P4 · Météo de préparation

- **P4.1 · Prévision sur le lieu (1/2 au relevé).** Afficher la prévision du lieu choisi sur le plan. Tester le changement de lieu et une indisponibilité du fournisseur.
- **P4.2 · Prévision par point, heure ou étape (1/2 au relevé).** Afficher la prévision au point et créneau ou à l’étape sélectionnés. Un changement de date recharge la bonne fenêtre horaire.
- **P4.3 · Pluie et température (1/2 au relevé).** Afficher ensemble précipitations et température avec unités. Une mesure absente est indiquée comme indisponible.
- **P4.4 · Horizon ou source datée (1/2 au relevé).** Afficher fournisseur, date d’actualisation et horizon. Une date lointaine ou une donnée périmée déclenche l’état prévu.
- **P4.5 · Couches ou alertes sur aléas associés (0/2 au relevé).** Superposer des alertes issues d’une source identifiée quand une zone est couverte. Vérifier une zone sans couverture et une alerte terminée.

## K1 · Inventaire personnel réutilisable

- **K1.1 · Ajouter ses objets (1/2 au relevé).** Créer puis modifier un objet possédé. Poids, quantité et catégorie se retrouvent sur un second écran après rechargement.
- **K1.2 · Poids unitaire (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K1.3 · Catégories et quantités (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K1.4 · Réutiliser les objets dans plusieurs kits (1/2 au relevé).** Réutiliser un objet dans deux kits via son identifiant. Un changement de poids actualise les kits éditables et préserve les snapshots de sorties passées.
- **K1.5 · État, usage ou entretien (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.

## K2 · Kits, checklist et poids

- **K2.1 · Construire un kit nommé (1/2 au relevé).** Créer, nommer et rouvrir un kit depuis le Hub. Vérifier qu’il apparaît dans le sélecteur de Compas.
- **K2.2 · Checklist à cocher (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K2.3 · Poids du kit (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K2.4 · Séparer porté ou consommable (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K2.5 · Lien ou export du kit (1/2 au relevé).** Exporter ou partager un kit. L’ouverture sur un autre appareil restitue les quantités, poids et règles d’accès.

## K3 · Eau, repas et consommables

- **K3.1 · Estimation d’eau (1/2 au relevé).** Afficher le calcul d’eau par étape et ses hypothèses. Rejouer le calcul sur un jeu de référence et afficher l’état du ravitaillement.
- **K3.2 · Eau ajustée à durée ou chaleur (1/2 au relevé).** Recalculer le besoin lorsqu’on modifie la durée ou la chaleur. Les valeurs non renseignées et la part ajustable sont visibles.
- **K3.3 · Plan des repas par jour (0/2 au relevé).** Créer un menu par jour avec portions. Le poids calculé remonte dans le sac après chaque modification.
- **K3.4 · Poids des consommables dans le kit (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K3.5 · Calcul des cartouches de réchaud (0/2 au relevé).** Modéliser la consommation du réchaud avec hypothèses modifiables et capacité de cartouche. Vérifier les unités et l’arrondi sur des cas de calcul figés.

## K4 · Relier le sac à la sortie

- **K4.1 · Lien voyage/sortie vers un kit (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K4.2 · Réemploi des objets possédés (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **K4.3 · Poids cible ou budget du kit (1/2 au relevé).** Fixer un poids cible ou budget de kit. Ajouter un article puis vérifier totaux, écart et persistance de la cible.
- **K4.4 · Partage de la liste de sortie (1/2 au relevé).** Partager la liste du départ. Un destinataire autorisé ouvre la bonne version et un visiteur sans droit voit l’état prévu.
- **K4.5 · Attribution de poids ou d’objets à des équipiers (1/2 au relevé).** Attribuer articles ou poids à deux équipiers. Les totaux par personne concordent avec le total partagé et évoluent à la réattribution.

## T1 · Guidage pendant le déplacement

- **T1.1 · Position sur une trace (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **T1.2 · Instructions de direction (1/2 au relevé).** Afficher la prochaine instruction et sa distance sur une trace connue. Vérifier un embranchement et le passage automatique à l’instruction suivante.
- **T1.3 · Alerte hors tracé (1/2 au relevé).** Signaler un écart de trace avec gestion de la précision GPS. Rejouer écart réel, retour sur la trace et bruit seul.
- **T1.4 · Voix pendant navigation (0/2 au relevé).** Lire les consignes à voix haute et permettre de couper le son. Rejouer avec écran verrouillé et signaler la disponibilité selon plateforme.
- **T1.5 · Recalcul de la route (0/2 au relevé).** Recalculer depuis une déviation lorsque le routage est disponible. Le voyageur voit la modification et retrouve la trace initiale si le calcul échoue.

## T2 · Préparer le hors-ligne

- **T2.1 · Télécharger un parcours (1/2 au relevé).** Télécharger une route et ses données utiles. Après fermeture et mode avion, la route enregistrée se rouvre.
- **T2.2 · Fond de carte téléchargé (1/2 au relevé).** Télécharger les tuiles d’un fond dont l’usage est autorisé. Couper le réseau et vérifier les niveaux de zoom annoncés.
- **T2.3 · Suivre sans réseau (0/2 au relevé).** Suivre une trace en mode avion après redémarrage. Vérifier position, progression et signalement honnête des fonctions réseau indisponibles.
- **T2.4 · Choisir une zone (1/2 au relevé).** Sélectionner une zone avec emprise et estimation de volume. Le contenu téléchargé correspond à l’emprise sélectionnée.
- **T2.5 · Vérifier ou gérer les téléchargements (1/2 au relevé).** Lister les packs avec taille, état, suppression et reprise. Interrompre un téléchargement et vérifier qu’un pack incomplet reste identifiable.

## T3 · Enregistrement et continuité

- **T3.1 · Capture de points GPS (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **T3.2 · Pause et reprise (1/2 au relevé).** Mettre en pause puis reprendre. Le segment arrêté est distingué et les métriques de déplacement restent cohérentes.
- **T3.3 · Résultat sauvegardé (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **T3.4 · Enregistrement sans réseau (1/2 au relevé).** Enregistrer hors connexion puis synchroniser. Vérifier la trace complète et un seul résultat après deux reconnexions.
- **T3.5 · Écran verrouillé documenté sur téléphone (0/2 au relevé).** Prouver la continuité écran verrouillé sur les téléphones pris en charge. Documenter durée, appareils, permissions et récupérations d’interruption.

## T4 · Suivi de position partagé

- **T4.1 · Lien de suivi (1/2 au relevé).** Créer un lien de suivi borné. L’ouvrir sur un deuxième téléphone et vérifier son association à la bonne session.
- **T4.2 · Arrêt ou expiration (1/2 au relevé).** Arrêter ou faire expirer le suivi. Sur le téléphone destinataire, l’actualisation s’arrête et le statut change.
- **T4.3 · Contacts de confiance (1/2 au relevé).** Choisir les contacts de confiance pour une sortie. Vérifier l’autorisation de partage puis le retrait d’un contact.
- **T4.4 · Carte du suivi côté destinataire (1/2 au relevé).** Afficher la position reçue et sa date. Couper le réseau de l’émetteur et vérifier l’indication de dernière position reçue.
- **T4.5 · Contrôle de la précision ou signal de dernière position (1/2 au relevé).** Proposer une position moins précise ou un indicateur de fraîcheur. Tester que le destinataire reçoit exactement le niveau annoncé.

## C1 · Fil, contenus et interactions

- **C1.1 · Publication avec média (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C1.2 · Réaction (1/2 au relevé).** Réagir puis retirer la réaction. Le compteur concorde sur deux comptes et après rechargement.
- **C1.3 · Commentaire (1/2 au relevé).** Publier un commentaire, le relire et le signaler. Respecter l’audience et les règles quand son auteur le modifie ou le retire.
- **C1.4 · Suivre une personne (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C1.5 · Attacher une sortie ou trace au contenu (1/2 au relevé).** Joindre une sortie ou trace à un post. Vérifier que le lien ouvre le bon objet avec des droits cohérents.

## C2 · Clubs et gestion des membres

- **C2.1 · Rejoindre un club (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C2.2 · Créer un club (1/2 au relevé).** Créer un club et l’ouvrir depuis un second compte. Nom, visibilité et règles persistent.
- **C2.3 · Audiences publiques ou privées (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C2.4 · Rôle d’administration (1/2 au relevé).** Distinguer administrateur et membre. Vérifier les actions permises et refusées par rôle lors d’un changement d’administration.
- **C2.5 · Règles ou gestion des membres (1/2 au relevé).** Permettre la gestion de l’adhésion et l’accès aux règles. Rejouer demande, admission et départ.

## C3 · Organiser une sortie ensemble

- **C3.1 · Invitation (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C3.2 · Réponse ou inscription (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C3.3 · Route associée (1/2 au relevé).** Associer un itinéraire versionné à une sortie collective. Un invité retrouve la bonne route et peut vérifier son état.
- **C3.4 · Capacité ou liste d’attente (1/2 au relevé).** Poser une capacité ou une liste d’attente. Deux inscriptions simultanées à la dernière place respectent la limite.
- **C3.5 · Mise à jour de route ou coédition (0/2 au relevé).** Publier une révision de route ou permettre une coédition contrôlée. Un participant reçoit la version mise à jour et peut identifier celle utilisée au départ.

## C4 · Messagerie dans l’app

- **C4.1 · Conversations 1 à 1 (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C4.2 · Conversations collectives (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **C4.3 · Média ou pièce jointe (1/2 au relevé).** Envoyer une pièce jointe entre deux comptes de test. Vérifier reprise sur réseau intermittent et ouverture réservée aux participants.
- **C4.4 · Route ou GPX envoyé (1/2 au relevé).** Envoyer un GPX ou une route et l’ouvrir dans Explorer. Le destinataire récupère le bon tracé avec les droits attendus.
- **C4.5 · Filtrage des demandes ou blocage (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.

## R1 · Carnet ou récit de sortie

- **R1.1 · Texte éditable (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **R1.2 · Médias (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **R1.3 · Trace ou stats liées (1/2 au relevé).** Créer un carnet lié à une sortie avec trace et statistiques réelles. Recharger et vérifier le lien avec la même activité.
- **R1.4 · Étapes ou journées de récit (1/2 au relevé).** Structurer un récit en journées ou étapes avec médias. Réordonner sans perdre l’association au jour concerné.
- **R1.5 · Contrôle du partage (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.

## R2 · Favoris et collections personnelles

- **R2.1 · Marquer un favori (1/2 au relevé).** Enregistrer et retirer un favori. Vérifier la persistance web et mobile.
- **R2.2 · Liste nommée (0/2 au relevé).** Créer, renommer et rouvrir une collection personnelle.
- **R2.3 · Mélanger plusieurs types d’objets (0/2 au relevé).** Ranger par exemple une route, un repère et un kit dans la même collection. Chaque objet se rouvre dans son écran.
- **R2.4 · Partager la liste (0/2 au relevé).** Partager une collection avec audience contrôlée. Un invité voit uniquement les éléments qu’il est autorisé à ouvrir.
- **R2.5 · Retrouver l’objet depuis le mobile (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.

## R3 · Réutiliser et apprendre du réalisé

- **R3.1 · Créer depuis une trace déjà réalisée (1/2 au relevé).** Créer un nouveau plan depuis une activité terminée. Vérifier qu’il reprend la trace choisie et reste éditable indépendamment.
- **R3.2 · Rattacher matériel au compte rendu (1/2 au relevé).** Joindre au bilan le snapshot du matériel utilisé. Modifier le kit réutilisable et vérifier que le bilan garde l’état du départ.
- **R3.3 · Dupliquer un kit réutilisable (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **R3.4 · Garder provenance ou historique (1/2 au relevé).** Conserver l’auteur ou la source et l’historique de la réutilisation. Suivre l’origine d’une copie après deux versions.
- **R3.5 · Relier avis terrain et matériel utilisé (0/2 au relevé).** Lier un retour de terrain à un objet utilisé et à sa sortie. Retrouver l’observation datée à l’écran pour préparer le départ suivant.

## R4 · Défis et progression sociale

- **R4.1 · Badges ou accomplissements (1/2 au relevé).** Déclencher un badge sur un accomplissement vérifiable. Rejouer le même événement et contrôler l’absence de doublon.
- **R4.2 · Défis collectifs (1/2 au relevé).** Créer un défi collectif et vérifier que seules les activités éligibles le font progresser pour deux participants.
- **R4.3 · Classements (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **R4.4 · Historique de progression (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **R4.5 · Règles de récompense visibles (1/2 au relevé).** Exposer règle, conditions et historique de récompense. Les points affichés concordent avec le registre après correction d’une activité.

## Q1 · Contrôle d’audience

- **Q1.1 · Régler la visibilité du profil (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q1.2 · Régler la visibilité de l’activité (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q1.3 · Régler la visibilité d’un récit ou post (1/2 au relevé).** Régler l’audience d’un carnet ou post. Vérifier auteur, invité et visiteur pour le texte et les médias.
- **Q1.4 · Espace groupe restreint (1/2 au relevé).** Protéger les contenus d’un groupe restreint. Après retrait d’un membre, contrôler l’affichage et les liens dans une nouvelle session.
- **Q1.5 · Options au niveau de chaque contenu (1/2 au relevé).** Changer le réglage d’un objet précis sans affecter les autres. Vérifier la décision de visibilité sur la fiche et dans le fil.

## Q2 · Protection de la localisation

- **Q2.1 · Recherche sans GPS (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q2.2 · Permission à l’usage (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q2.3 · Masquage de portions ou zone privée (0/2 au relevé).** Masquer une zone privée ou une portion du tracé. Vérifier carte, lien et exports partagés avec un compte distinct.
- **Q2.4 · Arrêt ou durée du suivi live (1/2 au relevé).** Donner une durée ou une action d’arrêt claire au partage en direct. Rejouer expiration, arrêt et lecture d’un ancien lien.
- **Q2.5 · Explication de l’impact sur la visibilité (1/2 au relevé).** Expliquer avant partage ce que verra le destinataire. Comparer l’aperçu proposé au résultat du second compte.

## Q3 · Exporter et supprimer ses données

- **Q3.1 · Export du compte (1/2 au relevé).** Exporter les données d’un compte de recette. Vérifier format lisible, périmètre et accès réservé au propriétaire.
- **Q3.2 · Suppression du compte (1/2 au relevé).** Rejouer la suppression sur un compte jetable. Contrôler statut, accès révoqué et traitement des objets selon les règles de conservation.
- **Q3.3 · Export d’activité (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q3.4 · Format machine lisible (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q3.5 · Export spécifique du matériel (1/2 au relevé).** Exporter le matériel dans un format utilisable. Contrôler catégories, quantités et unités sur un réimport de recette.

## Q4 · Modération et provenance

- **Q4.1 · Signaler un contenu (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q4.2 · Bloquer un membre (2/2 au relevé).** Rejouer le contrôle déjà crédité afin de préserver le comportement.
- **Q4.3 · Suivre un statut de traitement (1/2 au relevé).** Afficher le statut de traitement au membre selon ses droits. Rejouer réception, examen et décision sans exposer le dossier privé.
- **Q4.4 · Identifier une source officielle ou partenaire (0/2 au relevé).** Identifier la provenance officielle ou partenaire sur la fiche. Vérifier le libellé, le lien source et la date.
- **Q4.5 · Distinguer exemple, estimation et fait vérifié (0/2 au relevé).** Distinguer exemples, estimations et faits vérifiés dans l’interface. Appliquer ce contrôle au fil, aux compteurs d’accueil et aux données terrain.
