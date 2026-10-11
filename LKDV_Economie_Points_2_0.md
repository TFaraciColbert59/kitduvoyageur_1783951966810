# LKDV — Économie de Progression 2.0

**Proposition du 10 octobre 2026. Aucun barème de ce document n’a été activé.** Les montants ci-dessous sont des décisions de conception, pas des valeurs prescrites par la recherche. La priorité est un upgrade du moteur existant. P0 à P7 désignent les phases du plan joint.

**Catalogue : 29 actions récompensables, 24 comportements explicitement sans XP.** Toutes les nouvelles règles ont leur porte d’activation fermée dans le fichier de spécification JSON ; un montant proposé n’atteste pas l’existence de son producteur.

## Terrain

| Action | XP | Répartition du gain | Max actions jour / semaine / saison | Première phase | Preuve exigée |
| --- | ---: | --- | --- | --- | --- |
| Randonnée réellement accomplie | 40–150 | Explorer 100 % | 2/8/48 | P1 | Producteur existant ; paliers de durée recalculée serveur, nouveauté de parcours unique. |
| Vélo, activité urbaine, sortie accessible ou autre activité accomplie | 40–150 | Explorer 100 % | 2/8/48 | P3 | Nouveau producteur par adaptateur métier ; réalisation vérifiée, objectif accessible et consentement. |
| Clôturer une itinérance réellement accomplie | 45 | Explorer 70 % · Préparer 30 % | 1/2/8 | P1 | Au moins 2 journées distinctes et 2 réalisations liées, propriété et couverture vérifiées ; une checklist seule ne prouve plus le voyage. |

## Préparation

| Action | XP | Répartition du gain | Max actions jour / semaine / saison | Première phase | Preuve exigée |
| --- | ---: | --- | --- | --- | --- |
| Préparer une aventure depuis un sentier | 30 | Préparer 100 % | 1/3/18 | P1 | Sentier réel et préparation pertinente terminée ; la création seule ne suffit plus. |
| Préparer une aventure sans sentier, dans le Compas | 30 | Préparer 100 % | 1/3/18 | P3 | Mêmes contrôles pertinents ; exclut le gain trail_prepared pour la même aventure. |
| Terminer les contrôles de départ | 25 | Préparer 100 % | 1/4/24 | P1 | Checklist serveur non vide, au moins 3 contrôles dus pertinents ; un item libre coché ne suffit pas. |
| Finaliser le débrief terrain du kit | 20–40 | Préparer 70 % · Partager 30 % | 1/3/18 | P1 | 20 + 2 par équipement distinct évalué, maximum 10 ; snapshot final sur activité vérifiée. |
| Réussir un module de préparation, orientation ou sécurité | 30 | Préparer 100 % | 1/2/8 | P3 | Évaluation côté serveur, module éditorial validé, une fois par module substantiel ; aucune qualification professionnelle promise. |
| Effectuer un entretien documenté du matériel | 20 | Préparer 100 % | 1/1/4 | P5 | Intervention réelle et confirmation proportionnée ; une simple alerte résolue ne suffit pas ; objet 1/90 jours. |
| Améliorer un kit à partir d’un retour terrain | 25 | Préparer 100 % | 1/1/4 | P3 | Différence persistée avec problème terrain résolu et éléments de sécurité conservés ; version inverse et réduction de poids seule exclues. |

## Partage

| Action | XP | Répartition du gain | Max actions jour / semaine / saison | Première phase | Preuve exigée |
| --- | ---: | --- | --- | --- | --- |
| Publier un avis utile sur un lieu | 15–40 | Partager 100 % | 2/6/24 | P1 | 15 après contrôle du contenu, 40 si preuve de visite contrôlée dès attribution ; pas de crédit d’édition. |
| Publier un carnet d’aventure utile | 60 | Partager 100 % | 1/2/12 | P1 | Publication volontaire public/amis, réalisation réelle liée et contenu original suffisant ; mêmes médias non recrédités. |
| Partager un kit éprouvé et documenté | 30 | Préparer 20 % · Partager 80 % | 1/2/8 | P3 | Kit porté sur terrain et commentaire utile, une fois par kit racine et contributeur ; auto-forks exclus. |
| Ajouter une photo de terrain utile à un lieu | 10 | Partager 100 % | 3/5/20 | P4 | Photo originale, visitée, consentie et acceptée ; max 3/activité ; pas de gain si le même média est rémunéré dans un carnet. |
| Faire accepter une contribution substantielle à un guide | 80 | Partager 50 % · Entraider 50 % | 1/1/4 | P4 | Révision identifiable relue et acceptée ; delta inédit, pas le recopiage d’un carnet déjà crédité. |
| Faire accepter une traduction utile | 20 | Partager 70 % · Entraider 30 % | 2/3/12 | P4 | Révision relue, licence permise, langue cible et contenu utiles ; génération brute IA non éligible. |
| Contribuer une trace utile et authentifiée | 40 | Partager 60 % · Entraider 40 % | 1/2/8 | P4 | Trace d’une réalisation contrôlée apportant une donnée nouvelle acceptée ; import seul ou répétition de la même trace exclu. |
| Publier un avis matériel fondé sur son utilisation | 15 | Partager 100 % | 1/2/8 | P4 | Équipement porté/utilisé, acheté ou emprunté ; contenu utile ; ne recrédite pas le même débrief transformé en avis. |
| Faire valider une observation naturaliste utile | 15 | Partager 80 % · Entraider 20 % | 2/3/12 | P5 | Validation éditoriale/partenaire, lieu sensible protégé ; prédiction IA seule ou visite risquée exclue. |

## Entraide

| Action | XP | Répartition du gain | Max actions jour / semaine / saison | Première phase | Preuve exigée |
| --- | ---: | --- | --- | --- | --- |
| Faire accepter une correction de lieu ou de sentier | 40 | Partager 50 % · Entraider 50 % | 1/3/12 | P4 | Delta utile et récent accepté par modérateur indépendant ; doublon de problème exclu. |
| Apporter une réponse acceptée et utile | 25 | Entraider 100 % | 2/4/16 | P4 | Réponse acceptée par demandeur distinct, contrôle anti-collusion ; un gain par question. |
| Accomplir une séance d’entraide ou d’accompagnement | 40 | Préparer 20 % · Entraider 80 % | 1/2/8 | P5 | Session consentie et double confirmation, présence objectivée sans enregistrer la conversation ; paire limitée à 1/mois. |
| Organiser une sortie de club réellement tenue | 60 | Préparer 40 % · Entraider 60 % | 1/1/4 | P5 | Un organisateur désigné et au moins 3 autres participants vérifiés ; créer l’événement ne rapporte rien. |
| Accomplir une tâche collective utile | 20 | Préparer 20 % · Entraider 80 % | 2/3/12 | P5 | Tâche du catalogue, contribution confirmée par un autre membre ; pas de micropartition ni de double crédit comme organisateur. |
| Restituer un matériel emprunté | 25 | Entraider 100 % | 1/2/8 | P5 | Prêt réel ≥24 h, emprunteur et prêteur distincts, retour confirmé par les deux ; paire/objet 1 par 90 jours. |
| Prêter un matériel jusqu’à son retour | 25 | Entraider 100 % | 1/2/8 | P5 | Même prêt validé, pour le prêteur ; ne peut se créditer le gain emprunteur ; plafond prêt partagé. |
| Participer à une action environnementale encadrée | 40 | Explorer 20 % · Entraider 80 % | 1/1/4 | P5 | Action confirmée par organisateur indépendant ; ne pousse ni hors sentier ni vers un site fragile. |
| Réparer un équipement et documenter une méthode utile | 40 | Préparer 50 % · Entraider 50 % | 1/1/4 | P5 | Intervention confirmée et tutoriel relu, sans achat requis ni certification de sûreté ; même acte exclu de maintenance. |
| Faire accepter une information d’accessibilité | 40 | Partager 50 % · Entraider 50 % | 1/2/8 | P4 | Observation concrète datée relue ; remplace place_report_accepted pour le même rapport, aucune santé inférée. |

## Lire ces nombres

Les quatre compétences répartissent le même gain. Exemple : 40 XP de débrief donnent 28 Préparer et 12 Partager ; le total permanent augmente de 40, pas de 80. Les points de saison sont une projection de ces gains dans une période, pas une monnaie supplémentaire. Le niveau permanent dépend seulement des XP acquis à vie.

Les colonnes jour/semaine/saison sont des **nombres d’actions**, pas des plafonds d’XP. Les dates métier sont immuables. Jour UTC, semaine ISO UTC, saison de huit semaines ; affichage des dates dans le fuseau de l’utilisateur. Une activité traversant minuit reste une activité. Une réception tardive ne déplace pas l’action vers une autre semaine. Les gains négatifs concernent uniquement des corrections motivées dans le journal.

Les variantes partagent leurs quotas : randonnée et autres activités comptent ensemble pour 2/8/48 ; préparation depuis un sentier ou depuis le Compas pour 1/3/18 ; prêteur et emprunteur pour 1/2/8 par utilisateur. Le champ cap_group du registre rend ces trois regroupements explicites. Les autres actions conservent un compteur propre. Une même réalisation ne peut pas changer de variante pour contourner un plafond.

### Formules des gains variables

- **Activité réelle :** 40 XP à partir de 20 minutes actives, 70 à 60 minutes, 100 à 120 minutes, 130 à 240 minutes. Le serveur recalcule la durée ; les pauses et un téléphone laissé immobile ne produisent pas de durée active. Un objectif adapté vérifié peut donner la base de 40 XP sans imposer 20 minutes ou recueillir un diagnostic. Ses critères sont publiés avant le départ et validés comme les autres preuves. Les variantes ne se cumulent pas pour une même activité.
- **Nouveauté :** +20 XP une fois par parcours canonique et par saison, dans le même gain d’activité ; maximum 150 XP. Le rapprochement de parcours contrôle géométrie et activité, pas seulement un identifiant OSM. Ce bonus n’encourage ni un nouveau pays ni un trajet lointain. Refaire le même parcours conserve son gain de base.
- **Débrief :** 20 + 2 × nombre d’équipements distincts évalués, borné à 10 équipements, donc au maximum 40 XP. Attribuer seulement lors de la finalisation du débrief, avec les observations sauvegardées ; éviter de figer le gain au premier élément saisi.
- **Avis de lieu :** 15 XP pour un avis qualifié ; 40 si sa preuve de visite est validée avant attribution. La publication et ses éditions constituent une seule demande. Une visite ajoutée après attribution ne crée pas automatiquement une seconde récompense.

Ces formules remplacent pour les nouveaux événements le bonus de randonnée fondé sur le nombre de segments OSM : la segmentation d’un tracé ne doit pas créer des XP. Les anciens gains restent historisés avec leurs règles d’origine.

### Plafonds d’XP transversaux

| Famille d’action | Maximum par semaine | Maximum par saison de 8 semaines |
| --- | ---: | ---: |
| Terrain | 600 | 4 800 |
| Préparation | 120 | 960 |
| Partage | 180 | 1 440 |
| Entraide | 180 | 1 440 |
| **Total théorique** | **1 080** | **8 640** |

Une action appartient à une seule famille, même si elle répartit ses XP entre deux compétences. Les caps par action, par objet et par famille s’appliquent ensemble ; le premier atteint bloque le gain. Le gain est accepté en entier ou refusé avec une raison, sans tronquer les compétences. Un événement de 40 XP avec seulement 25 XP de budget restant reste enregistré comme réalisation mais reçoit 0 XP avec explication. Il ne peut pas être déplacé ou recrédité la semaine suivante. Les bornes théoriques ne sont ni un objectif à atteindre ni une simulation d’usage observé.

Deux sorties découpées artificiellement, deux adaptateurs d’une même activité, une création puis suppression, deux carnets recopiés, un GPX cloné ou un même rapport classé comme correction puis accessibilité ne font pas deux réalisations. Les emprunts partagent un quota par utilisateur : prêteur et emprunteur peuvent chacun recevoir 25, mais une personne ne cumule pas les deux rôles pour le même prêt. Randonnée et voyage se cumulent uniquement si le voyage représente un accomplissement distinct de plusieurs journées. Une simple clôture d’une sortie journalière ne déclenche plus le bonus de voyage.

## Actions à 0 XP

| Action ou résultat | XP | Traitement |
| --- | ---: | --- |
| Inscription, connexion, temps d’écran, clic, ouverture d’un module | 0 | Aider à utiliser LKDV, sans rémunérer la présence. |
| Like, commentaire simple, message privé ou de groupe | 0 | Reconnaissance sociale ; une réponse qualifiée acceptée suit la règle dédiée. |
| Publication brute, photo non qualifiée ou contenu IA non relu | 0 | Attendre la preuve et la qualité correspondant au producteur. |
| Invitation ou parrainage | 0 | Éventuel programme partenaire séparé, sans acheter un niveau. |
| Achat ou abonnement | 0 | Fidélité commerciale distincte ; aucune XP. |
| Anniversaire | 0 | Souhait ou souvenir, sans progression de terrain. |
| Import GPX seul | 0 | Importer un itinéraire ne prouve pas l’avoir parcouru. |
| Badge, titre, fin de mission ou montée de ligue | 0 supplémentaire | Afficher les gains des actions sources et les distinctions. |
| Tampon de ville, région, pays ou massif | 0 supplémentaire | Le même événement enrichit le passeport et la carte. |
| Alerte SOS ou intervention d’urgence | 0 | Fonction de sécurité, jamais une compétition ou une source de monnaie. |
| Vitesse, danger, altitude extrême, météo défavorable | 0 de bonus | Ces mesures peuvent informer la préparation, pas inciter à prendre un risque. |
| Numéro de série, achat de matériel cher ou baisse du poids seule | 0 | Propriété et prix ne prouvent pas une compétence ; optimiser implique pertinence et sécurité. |
| Consentement à la localisation ou au partage public | 0 de bonus | Progresser en privé ; ne pas monnayer l’abandon de sa confidentialité. |

## Niveaux et identité

Conserver les seuils existants lors du premier upgrade : aucun recalcul arbitraire des anciens comptes, aucun changement de niveau à la fin de saison ou lors d’une dépense commerciale.

| Niveau | XP permanents minimum |
| --- | ---: |
| 1 | 0 |
| 2 | 100 |
| 3 | 300 |
| 4 | 700 |
| 5 | 1 500 |
| 6 | 3 000 |
| 7 | 5 500 |
| 8 | 9 000 |
| 9 | 14 000 |
| 10 | 20 000 |

Les appellations historiques sont conservées dans l’historique ; réécrire les descriptions qui prétendent certifier l’autonomie alpine, attribuer un rôle de guide ou donner des pouvoirs de modération. Les titres futurs sont des identités de voyage, pas des diplômes. Accès aux fonctions essentielles, sécurité, GPX, entraide et création de sortie indépendants des XP. Une permission admin ou un rôle de club requiert une décision d’autorisation distincte.

Les compétences gagnent des jalons de présentation à 100, 300, 700, 1 500 et 3 000 XP de compétence. Elles ne produisent ni nouveau crédit ni niveau de qualification professionnelle. La spécialisation est descriptive et facultative. L’orientation privée et le sceau terrain public existants restent indépendants de ces compteurs.

## Économie commerciale et rémunération

Dans l’interface, deux portes : **Ma progression** et **Mes avantages**. La seconde distingue les trois actifs existants — fidélité, parts du pool et crédit boutique — avec leurs unités et leur historique. Réunir les vues ne fusionne pas les droits ou la comptabilité.

| Action | XP | Avantage proposé pour les nouveaux événements | Condition |
| --- | ---: | --- | --- |
| Achat boutique effectivement encaissé | 0 | 10 crédits de fidélité par euro de marchandises payé | Après remises, hors livraison, paiement confirmé côté serveur ; remboursements partiels pris en compte. |
| Réponse qualifiée acceptée | 25 | 5 parts de contribution | Émission économique seulement en P6, preuve indépendante et budget financé. |
| Correction de lieu/sentier acceptée | 40 | 10 parts | Même contrôle ; pas de double crédit accessibilité pour le même rapport. |
| Contribution de guide acceptée | 80 | 25 parts | Révision substantielle et utile relue. |
| Information d’accessibilité acceptée | 40 | 10 parts | Variante exclusive de la correction correspondante. |
| Traduction utile acceptée | 20 | 5 parts | Version relue et licence permise. |
| Trace utile acceptée | 40 | 10 parts | Nouvelle donnée et réalisation contrôlée. |
| Vente attribuée à une lignée de kit | 0 | Crédit boutique calculé par la configuration de royalties existante | Preuve terrain, attribution, vente encaissée et éventuel retour ; ne pas convertir les XP. |
| Like, message, clic, invitation, parrainage, rapport généré automatiquement | 0 | 0 nouveau crédit | Les droits historiques légitimes restent dans leur journal. |

Les parts sont les **points économiques déjà existants** de reward_accounts, présentés sous un nom qui indique leur rôle. Ce changement ne crée pas un cinquième solde. Plafond futur proposé : 50 parts/semaine et 200 par période économique existante. Aucun financement par l’achat obligatoire du contributeur. Le score de confiance sert au contrôle de risque, pas de niveau d’aventure.

### Fidélité : coût de la proposition

Barème de nouveaux bons à simuler en P6 : 1 000 crédits → 2 € ; 2 500 → 5 € ; 5 000 → 10 €. Avec 10 crédits/€, cela représente **2 %** du montant éligible payé. Les anciens crédits et les 31 récompenses du catalogue exigent un inventaire des droits avant toute substitution ; ces exemples ne dévalorisent pas rétroactivement les soldes existants.

La réduction appliquée à un panier est bornée par le plus petit de : valeur du bon, 10 % du panier éligible, 25 % de sa marge contributive vérifiée. Ne débiter que les crédits correspondant à la réduction réellement consommée ; conserver le reste. Une marge inconnue ou négative bloque l’émission de nouveaux avantages, pas l’accès aux fonctions du produit. Une réserve finance les avantages émis ; aucune projection optimiste de ventes ne suffit.

Un achat payé 100 € de marchandises → 1 000 crédits → avantage proposé de 2 €, sous les conditions de réserve. Un remboursement de 25 € retire 250 crédits non consommés. Si l’avantage a déjà été consommé, traiter le remboursement et le recouvrement selon le contrat commercial applicable, sans débit silencieux des XP et sans empêcher les droits du consommateur. Ce traitement doit être vérifié avec les responsables du programme avant activation.

### Pool de contribution : pas de taux euro garanti

Réutiliser les périodes et le journal existants. Proposition : le pool distribuable provient d’une fraction des marges réellement encaissées et/ou d’un financement partenaire reçu, après coûts, remboursements et réserve ; plafonds budgétaires publiés. La configuration actuelle contient un pourcentage de 15 %, un plafond mensuel de 5 000 et un annuel de 50 000 : leur présence en base ne démontre ni un financement ni un mécanisme effectivement exploité. Vérifier unité, base de calcul et trésorerie avant P6.

Au gel d’une période : allocation en centimes = plancher(pool disponible en centimes × parts éligibles de l’utilisateur / total des parts éligibles). Les centimes résiduels vont dans la réserve et sont tracés. Exemple fictif : pool 120 €, 600 parts, 25 parts → 5 €. Pool nul → aucune valeur distribuable. La valeur n’est pas fixée avant clôture. Les XP ne sont jamais échangeables contre ces parts.

Les parts des périodes anciennes gardent leurs conditions historiques ; une nouvelle grille ne dilue pas rétroactivement une période déjà clôturée. Les créateurs conservent leur circuit de crédit boutique : réutiliser royalty_config, kit_attributions et store_credit_ledger, traiter les retours, puis expliciter l’avantage confirmé. Les anciens droits valides ne sont pas supprimés en fermant l’émission de nouvelles récompenses de likes ou de messages.

## Gouvernance du barème

Chaque règle contient identifiant stable, version, début d’application, action, montants, répartition, famille, limites, preuve et explication. La clé d’idempotence contient utilisateur et source métier canonique, **jamais la version du barème**. Les clés existantes compatibles sont conservées ; une table de liaison empêche un nouveau nom d’action de recréditer l’ancienne réalisation.

Les nouveaux événements lisent la version applicable à leur date métier. Les anciens gains conservent leur montant et leur ventilation ; aucun nouveau barème ne les rejoue. Une correction pour fraude crée un mouvement lié et une explication, avec recours. Le passage de saison remet seulement le compteur de la période suivante à zéro. La réception tardive conserve la saison de réalisation jusqu’à 14 jours de grâce ; après gel, un gain réellement vérifié peut rester permanent sans changer les résultats définitifs de la saison.

**Portes d’activation :** P0 = stabilisation prouvée ; P1 = upgrade des producteurs actuels et visibilité ; P2 = missions ; P3 = activités complémentaires et matériel ; P4 = contributions ; P5 = coopération ; P6 = avantages financés ; P7 = réglage et déploiement final. Les règles nouvelles restent fermées tant que leur preuve manque. Voir le plan pour les tests et les sous-phases.

## Sources et nature des choix

Base technique : [matrice existante](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/docs/progression/PRODUCER_MATRIX.md), [règles et seuils](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/src/features/progression/domain/rules.ts), [producteurs](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/src/features/progression/server/producerHooks.ts), lecture Supabase du 10/10/2026. Les nombres sont proposés ; ils ne sont pas activés en production.

La recherche jointe retient 16 sources originales ou officielles. [Duolingo](https://blog.duolingo.com/time-spent-learning-well/) décrit les limites d’une métrique favorisant les répétitions faciles. [Strava](https://support.strava.com/en-us/articles/15401916-strava-challenges) distingue objectifs privés et classement. Ces observations motivent des missions utiles et une compétition facultative ; elles ne valident pas causalement les montants de LKDV.

