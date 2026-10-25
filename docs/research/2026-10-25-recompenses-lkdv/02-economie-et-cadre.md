# LKDV — économie des récompenses et cadre France/UE

Recherche arrêtée au **25 octobre 2026**. Document préparatoire ; aucun barème n'est activé et aucune migration n'est exécutée. Les montants ci-dessous sont des **hypothèses de simulation**, pas les coûts, revenus ou comportements observés de LKDV. L'audit de l'état réel GitHub/Supabase est traité dans le dossier principal : des consignes documentaires peuvent contredire les portes effectivement ouvertes en production.

Le programme peut présenter une expérience très simple tout en gardant une comptabilité rigoureuse. La question décisive est : **combien de récompenses réelles LKDV peut-il financer, pour quelles contributions utiles, et dans quel délai accessible ?** Une émission de points ne crée pas la ressource qui paiera une lampe. Le like à +5 et le partage ×3 déplacent la dépense vers les gestes les moins coûteux à automatiser. Leur effet financier se calcule ; leur efficacité communautaire reste à mesurer.

## 1. Ce que signifie vraiment « lampe à 15 000 points »

Calculs arithmétiques, avec le barème demandé dans le brief et sans plafonds :

| Chemin exclusif | Calcul | Quantité nécessaire |
|---|---:|---:|
| Likes +5 | 15 000 / 5 | 3 000 likes |
| Activités +50 | 15 000 / 50 | 300 activités |
| Activité partagée, gain total ×3 | 15 000 / 150 | 100 activités partagées |

L'interprétation retenue est **50 de base +100 de bonus =150 au total**, pas 50+150. Le partage est rattaché à l'activité originale ; dix destinations de partage ne doivent jamais produire dix bonus.

À coût complet hypothétique de 20 € par lampe, une action à 5 points engage environ **0,0067 €** de coût de récompense à rédemption intégrale ; une activité à 50 engage 0,0667 €, et l'activité partagée à 150 engage 0,20 €. Ces chiffres représentent un coût budgétaire sous ces hypothèses, **pas une valeur monétaire garantie du point**, ni un montant retirable.

Le nominal ne fixe pas la générosité. Diviser **tous les gains et tous les prix** par dix conserve exactement les délais et les coûts. Baisser seulement la lampe de 15 000 à 1 500, sans changer les gains, rend le système **dix fois plus généreux**. La version divisée par dix du simulateur contient des demi-points ; pour une future implémentation en entiers, choisir une unité divisible par les barèmes ou un autre facteur commun, sans arrondis silencieux.

## 2. Trois politiques, cinq variantes comparées

Ces politiques sont des propositions de recherche. Aucun plafond, multiplicateur ou prix de ce tableau n'est une conclusion neuroscientifique.

| Politique | Règles de simulation | Risque principal testé |
|---|---|---|
| A — brief ouvert | Like 5 ; activité 50 ; partage de cette activité +100 ; aucun plafond | Émission illimitée et avantage à l'automatisation |
| B — brief plafonné | A ; 10 likes récompensés/jour ; plafond total 500/semaine | Le plafond réduit la dépense mais rémunère toujours le clic |
| C — utilité plafonnée | Like 0 ; activité validée 50, max. 3/semaine ; récit utile de l'activité +25, max. 2 ; aide vérifiée 25, max. 2 ; préparation utile 10, max. 1 ; total max. 250/semaine | Charge de validation, accessibilité, qualité réelle |

Pour C, trois variantes : lampe 15 000 ; lampe 1 500 aux mêmes gains ; échelle divisée par dix pour **les gains et la lampe**. Le plafond total 250 réduit le total théorique des sous-plafonds de 260. Un contenu refusé, un replay, une activité importée en doublon ou une action non admissible ne doit rien émettre. Le simulateur inclut volontairement un fraudeur **qui réussit à passer les contrôles** : un plafond n'est pas une preuve de détection.

### Profils hypothétiques

| Profil | Likes/semaine | Activités/semaine | Activités partagées/semaine | Aides/semaine | Préparations/semaine | Poids dans la population fictive |
|---|---:|---:|---:|---:|---:|---:|
| Occasionnel | 7 | 0,25 | 0,25 | 0,25 | 0,25 | 70 % |
| Actif | 35 | 2 | 1,5 | 1 | 2 | 25 % |
| Très actif | 70 | 3 | 2 | 2 | 3 | 4 % |
| Fraude admise, cas de stress | 3 500 | 20 | 20 | 20 | 20 | 1 % |

Les fractions expriment une cadence moyenne, pas un demi-événement crédité. Les poids ne sont pas une estimation de la communauté LKDV. Un faux compte admis n'est pas une personne et peut être multiplié : les plafonds par compte ne suffisent pas contre les fermes de comptes.

### Délais résultants à solde initial nul

| Variante | Occasionnel, points/sem. → semaines lampe | Actif | Très actif | Fraude admise |
|---|---:|---:|---:|---:|
| A, lampe 15 000 | 72,5 → 206,9 | 425 → 35,3 | 700 → 21,4 | 20 500 → 0,73 |
| B, lampe 15 000 | 72,5 → 206,9 | 425 → 35,3 | 500 → 30 | 500 → 30 |
| C, lampe 15 000 | 27,5 → 545,5 | 172,5 → 87,0 | 250 → 60 | 250 → 60 |
| C, lampe 1 500, gains inchangés | 27,5 → 54,5 | 172,5 → 8,7 | 250 → 6 | 250 → 6 |
| C, gains **et** prix ÷10 | 2,75 → 545,5 | 17,25 → 87,0 | 25 → 60 | 25 → 60 |

Les dates calculées dans le JSON supposent une cadence stable à partir du 25 octobre 2026 et des versements hebdomadaires. Ce sont des illustrations mécaniques, pas des prévisions de retour des utilisateurs. L'exemple C à 15 000 laisse l'occasionnel à plus de dix ans : un objectif affiché en permanence à cet horizon mérite d'être reconsidéré, indépendamment de sa sécurité financière.

**Petites étapes :** dans C non redimensionné, 100 points prennent environ 3,6 semaines à l'occasionnel et 0,58 semaine à l'actif ; 250 prennent 9,1 et 1,45 semaine. Cela permet de tester un premier avantage réellement financé à 100 ou 250, ou un jalon informatif clairement nommé. Un jalon sans valeur matérielle ne doit pas se présenter comme un cadeau obtenu. Le prix d'une lampe choisie reste à fixer après devis et financement.

### Coût de l'émission mensuelle, scénario 20 € tout compris

Réserve de stress si tous les points émis servent finalement à obtenir la lampe ; conversion 52/12 semaines par mois. Il s'agit du coût des droits créés dans le mois, pas des colis réellement envoyés dans ce même mois.

| Variante | Points émis/mois pour 1 000 MAU fictifs | Réserve pleine rédemption 1 000 MAU | 10 000 MAU | Coût/MAU/mois |
|---|---:|---:|---:|---:|
| A | 1 690 000 | 2 253 € | 22 533 € | 2,253 € |
| B | 788 667 | 1 052 € | 10 516 € | 1,052 € |
| C, lampe 15 000 | 324 458 | 433 € | 4 326 € | 0,433 € |
| C, lampe 1 500, gains inchangés | 324 458 | 4 326 € | 43 261 € | 4,326 € |
| C, gains et prix ÷10 | 32 446 | 433 € | 4 326 € | 0,433 € |

Dans A, l'unique pour cent de comptes fraudeurs produit **plus de la moitié des points** de la population fictive. Ce résultat découle des hypothèses choisies et illustre la sensibilité au farming ; il ne décrit pas une fraude mesurée sur LKDV.

Le JSON teste aussi des coûts complets de **12 / 20 / 35 €**, des rédemptions finales de **25 / 60 / 100 %**, et des budgets hypothétiques de **0,50 / 2 / 5 € par MAU par mois**, pour 1 000 et 10 000 MAU. Exemple : C/lampe1 500 à 35 € engage 7,57 €/MAU/mois à rédemption intégrale, donc dépasse même le budget fictif de 5 €. Un taux de rédemption de 60 % divise le coût moyen attendu par rapport au stress, mais ne supprime aucun droit déjà attribué.

## 3. Le circuit financier à construire

### Un coût complet, pas le prix public de la lampe

Pour chaque récompense, établir un devis et enregistrer : coût d'achat net effectivement supporté, emballage/préparation, livraison, stockage, remplacements/SAV, fraude et litiges, paiement éventuel, fiscalité réellement applicable, support et pertes de stock. Afficher séparément les frais de livraison que l'utilisateur doit payer le cas échéant, avant son choix. Le « cadeau » qui exige un achat ou des frais importants n'est pas équivalent à une lampe intégralement offerte.

Si le catalogue contient plusieurs objets, calculer la réserve au coût admissible le plus défavorable par point, ou affecter des stocks/budgets précis aux récompenses choisies. Le coût moyen historique est insuffisant si chacun peut réclamer librement l'objet dont le rapport coût/points est le plus élevé.

### Formules opérationnelles proposées

```text
budget_communautaire_disponible =
  trésorerie explicitement affectée
  + sponsoring contractuellement acquis et encaissé
  + part approuvée de marge contributive encaissée
  - engagements antérieurs déjà financés
  - réserve sécurité nécessaire

coût_complet_par_point_pour_un_objet = coût_complet_objet / prix_objet_en_points

coût_attendu_des_nouveaux_droits =
  points_nouveaux × coût_par_point × taux_rédemption_finale_estimé

stress_de_couverture = points_encore_utilisables × coût_par_point_admissible_max

points_nouveaux_finançables = budget_vraiment_libre / coût_par_point_de_stress

revenu_incrémental_net =
  marge contributive incrémentale attribuable au programme
  - coût complet des récompenses
  - modération / fraude / support / infrastructure incrémentaux
```

La marge incrémentale exige un groupe de comparaison ou une autre identification crédible ; le chiffre d'affaires total des utilisateurs récompensés n'est pas la preuve d'une recette causée par les points. Ni le like, ni le partage, ni une ligne de configuration de pool ne constituent un encaissement.

Une réserve pour droits en circulation n'est pas le chiffre d'affaires, et le modèle de stress ci-dessus n'est pas une écriture comptable réglementaire. À titre de repère **si le référentiel IFRS s'applique**, IFRS 15 traite les droits matériels associés à un achat et les droits non exercés ; l'exemple 52 illustre les points de fidélité. La qualification des points gagnés hors achat, le référentiel effectivement applicable à LKDV, la TVA, les avoirs et les éventuels revenus de créateurs doivent être arrêtés avec la comptabilité compétente. La simulation n'assimile pas tous les points à une dette remboursable en espèces. [IFRS 15, B39–B47](https://www.ifrs.org/content/dam/ifrs/publications/html-standards/english/2026/issued/ifrs15.html), [exemple 52](https://www.ifrs.org/content/dam/ifrs/publications/html-standards/english/2026/issued/ifrs15-ie.html).

### Politique de couverture proposée

1. Financer et annoncer les opportunités **avant l'action**. Le nombre de missions rémunérées peut être limité ; l'utilisateur doit le savoir avant de consacrer son temps.
2. Réserver le coût au moment où un droit certain est accordé. « En validation » ne se confond pas avec « disponible » ; définir un délai et un recours.
3. Honorer les droits déjà acquis. Une enveloppe mensuelle épuisée bloque les émissions futures annoncées comme telles, pas la consommation rétroactivement refusée de points existants.
4. Prévoir le coût des points non encore dépensés et des livraisons ; les soldes qui s'accumulent ne sont pas de l'argent économisé.
5. Pour les nouvelles règles, versionner les gains et le catalogue. Communiquer les changements à l'avance ; préserver les engagements antérieurs plutôt que dévaluer silencieusement les soldes.
6. Conserver les journaux historiques distincts : XP, fidélité achetée, contributions créateurs, avoirs boutique. Une interface unifiée n'autorise aucune conversion implicite.

Une règle simple à comprendre peut être financée par un budget communautaire marketing de départ, puis par marge/sponsors réellement reçus. Elle n'est pas nécessairement autosuffisante. Les achats à forte marge d'une minorité ne doivent pas être supposés financer tous les autres sans chiffres.

## 4. Fraude et comportements induits : règles proposées

| Déclencheur | Déformation possible | Garde proposée | Coût / limite |
|---|---|---|---|
| Like crédité | Bots, annuler/reliker, groupes réciproques, achat de comptes | V1 proposée : réaction gratuite, sans point dépensable ; conserver feedback social | Ne mesure pas à lui seul la valeur d'un contenu |
| Partage ×3 | Spam, exposition forcée du GPS, republications minimes, liens jamais consultés | Bonus additif unique pour un récit utile lié à une activité, qualité vérifiable, audience choisie | Le clic de partage externe ne prouve pas une lecture |
| Activité | GPX synthétique, doublons d'import, fractionnement d'une sortie | Identité d'événement, rattachement original, fenêtre anti-duplication, contrôle proportionné | Le GPS ne prouve pas tout ; éviter collecte invasive |
| Aide validée par pairs | Collusion de comptes et extorsion de validation | Pas d'auto-validation, limites par paire, signaux qualité, audit et recours humain | Les faux positifs excluent des contributeurs légitimes |
| Préparation | Cocher/recocher un kit, préparation fictive | Une séquence reliée à une activité, plafond, replay nul | Les personnes moins sportives doivent avoir d'autres contributions accessibles |
| Bon / objet | Double dépense, requêtes concurrentes, stock absent, retour de commande | Réservation atomique stock+points, idempotence, journal append-only, compensation | Refus sans débit définitif, messages compréhensibles |
| Parrainage | Auto-parrainage, multi-comptes, visites sans valeur | Récompenser un événement réellement admissible ; aucune prime à carnet d'adresses aspiré | Vérification proportionnée et budget dédié |

Ne jamais accroître la rémunération avec la vitesse, la prise de risque, les incidents SOS, la publication de coordonnées sensibles ou le caractère positif d'un avis produit. Ne pas demander de continuer une randonnée dangereuse pour atteindre un seuil. Les plafonds limitent l'émission d'un compte, pas celle d'une ferme de comptes : il faut une enveloppe financée, une validation du fait déclencheur et des contrôles de rédemption proportionnés.

## 5. Cadre réglementaire : portée exacte et traduction produit

Il s'agit de repères de conception issus des sources primaires lues, pas d'une qualification juridique définitive de LKDV. Les critères de taille du fournisseur, les publics admis, les contrats et les flux réels sont à vérifier avant lancement.

### DSA : adultes, mineurs, taille du fournisseur

L'article 25 du DSA vise les interfaces trompeuses/manipulatrices altérant substantiellement la décision libre et éclairée ; son paragraphe 2 articule cette règle avec les pratiques déjà couvertes par le RGPD ou la directive sur les pratiques commerciales déloyales. L'article 28 protège les mineurs et interdit, dans son champ, la publicité fondée sur leur profilage. L'article 19 prévoit une exclusion de cette section pour les micro/petites entreprises, sous conditions et sauf désignation VLOP. La taille et la qualification de LKDV n'ont pas été établies ici. **Il ne faut donc pas présenter ces articles comme une interdiction générale de toute récompense adulte applicable automatiquement à LKDV.** [DSA, art. 19, 25 et 28](https://eur-lex.europa.eu/eli/reg/2022/2065/2022-10-27/eng).

Les lignes directrices Commission publiées en juillet 2025, §61(b), visent notamment les récompenses virtuelles pour actions répétées lorsqu'elles favorisent l'usage excessif ou compulsif des mineurs. Le §57 traite les paramètres protecteurs par défaut ; le §8 rappelle l'exclusion des micro/petites entreprises. Le texte fournit un repère d'application de l'art. 28 ; suivre ses recommandations est volontaire et ne garantit pas automatiquement la conformité. **Choix LKDV proposé :** progrès réel, seuils transparents, aucun tirage aléatoire acheté, pas de série quotidienne punitive, notifications réglables, mode mineur protecteur et contrôle de l'audience. [Lignes directrices 2025/5519, §8, §57 et §61](https://eur-lex.europa.eu/eli/C/2025/5519/oj/eng), [Commission : statut des lignes directrices](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors).

### Données personnelles, GPS et mineurs

La CNIL distingue permission technique du téléphone et consentement juridique ; une autorisation de localisation ne suffit pas à couvrir tous les traitements ultérieurs. Séparer validation d'activité, partage communautaire, anti-fraude et prospection : déterminer pour chacun la base légale et les besoins réels. **Proposition :** pas de bonus conditionné à rendre sa trace précise publique ; audience privée possible, masquage domicile/départ/arrivée, vérification sans conservation disproportionnée du trajet. [CNIL, permissions mobiles, 14 janvier 2025](https://cnil.fr/fr/permissions-applications-mobiles-recommandations-de-la-cnil-pour-respecter-la-vie-privee).

La CNIL rappelle de limiter données, précision et conservation à la finalité, et de prévoir l'effacement. Le journal financier peut garder le fait d'un droit et sa justification nécessaire sans conserver indéfiniment la trace GPS complète. Pour un programme de fidélité, sa clarification d'octobre 2025 précise notamment l'accès/portabilité de certaines données d'achat et promotions ; elle ne signifie pas que tout algorithme de calcul est communicable par portabilité. Prévoir l'export des données personnelles pertinentes dans le périmètre applicable. [CNIL, minimisation](https://cnil.fr/fr/minimiser-les-donnees-collectees), [CNIL, fidélité et portabilité](https://cnil.fr/fr/programmes-de-fidelite-la-cnil-precise-lapplication-du-droit-la-portabilite-des-donnees).

Pour la France, la CNIL décrit le consentement des mineurs aux services en ligne : sous certaines conditions, seuls à partir de 15 ans et avec leurs parents en dessous. Ce repère ne résout ni toute capacité contractuelle ni l'ensemble des traitements. Définir l'âge d'accès aux récompenses et les modalités adaptées, plutôt que supposer qu'un compte déclaré majeur ou une case suffit. [CNIL, protection des mineurs](https://www.cnil.fr/fr/la-cnil-publie-8-recommandations-pour-renforcer-la-protection-des-mineurs-en-ligne).

### Avis, recommandations et partage rémunéré

La DGCCRF rappelle les informations à donner sur les avis consommateurs, dont l'existence d'une contrepartie, et les obligations de contrôle lorsqu'on affirme une expérience vérifiée. Les faux avis et la présentation biaisée sont visés ; les contreparties pour avis positifs exposent particulièrement à tromperie. **Proposition :** même gain pour avis utile favorable ou défavorable, contrepartie lisible, critères de modération publics, aucun retrait d'avis négatif pour préserver une vente. Un simple like social et un avis produit n'ont pas automatiquement le même statut ; éviter leur confusion dans la boutique. [Ministère, règles des avis](https://www.economie.gouv.fr/particuliers/mes-droits-conso/bien-consommer/peut-faire-confiance-aux-avis-en-ligne), [DGCCRF, faux commentaires](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/avis-en-ligne-attention-aux-faux-commentaires).

Le guide ministériel 2026 décrit l'influence commerciale avec contrepartie financière/en nature, promotion et communication numérique au public ; il demande une intention commerciale identifiable. Si LKDV rémunère une publication externe promouvant son application ou un équipement, évaluer ce cadre et fournir la mention appropriée. **Tout récit de randonnée récompensé n'est pas automatiquement une activité d'influence** : l'objet et les conditions de la publication comptent. Le guide rappelle aussi des obligations fiscales/sociales dans le champ de l'activité professionnelle ; ne pas afficher « argent gratuit sans déclaration ». [Guide officiel, janvier 2026, questions 1, 7–8 et 17–18](https://www.economie.gouv.fr/files/files/2026/202601-guide-influence-commerciale.pdf?v=1767360394).

### Points, avoirs, argent retirable : ne pas fusionner par vocabulaire

La définition de monnaie électronique repose notamment sur une valeur monétaire stockée, une créance émise contre réception de fonds en vue de paiements et l'acceptation par un tiers. Appeler une unité « points » n'établit ni n'écarte à lui seul cette qualification. Des points gratuits d'activité, non achetables, non transférables et utilisés auprès de LKDV seul présentent un modèle distinct d'un portefeuille rechargeable/retirable ou d'un instrument accepté par des partenaires ; la qualification nécessite les contrats et flux exacts. [Directive 2009/110/CE, art. 2](https://eur-lex.europa.eu/eli/dir/2009/110/2018-01-13/eng).

L'ACPR 2022-P-01 modifiée en 2023 précise les restrictions techniques/contractuelles des exclusions pour réseau ou éventail limité, et des exigences de notification lorsque certains seuils sont franchis. Ce régime concerne les instruments entrant dans le périmètre pertinent ; **un programme à points n'a pas automatiquement à notifier un million d'euros**, ni une exemption automatique parce que son catalogue est outdoor. Élargir à des tiers, vendre des points, permettre les transferts ou le cashout impose de réexaminer le modèle. **Choix proposé pour le pilote :** aucun achat de points, aucun transfert P2P, aucun retrait monétaire de l'unité communautaire ; traiter les droits créateurs déjà existants à part. [ACPR, position 2022-P-01, critères et suivi](https://acpr.banque-france.fr/system/files/import/acpr/media/2023/07/26/20230726_position_2022-p-01.pdf).

Veille au 25 octobre 2026 : le document du Conseil daté du 21 octobre 2026 présente encore PSD3/PSR dans le processus législatif et décrit la position en première lecture. La page Commission distingue l'accord politique de novembre 2025 de la législation existante. Cette recherche ne traite donc pas le futur regroupement des régimes de paiement et monnaie électronique comme déjà applicable ; vérifier le texte publié et son calendrier lors d'un éventuel lancement plus tardif. [Conseil, ST 8535/26 ADD 1](https://data.consilium.europa.eu/doc/document/ST-8535-2026-ADD-1/en/pdf), [Commission, services de paiement](https://finance.ec.europa.eu/consumer-finance-and-payments/payment-services/payment-services_en).

## 6. Décisions à instruire avant le développement

| Décision | Proposition testable | Donnée manquante |
|---|---|---|
| Unité visible | « Points LKDV » ou nom court testé ; un seul solde dépensable affiché en premier | Test de compréhension, collision avec crédits historiques |
| Fonction du like | Feedback social, pas d'émission dépensable dans le premier pilote | Effet causal d'une prime au like et coût anti-fraude |
| Partage | Bonus additif unique, qualité utile, audience choisie | Capacité et coût de vérification ; consentements |
| Premier avantage | Petit avantage financé avec prix et conditions explicites | Coût fournisseur/logistique réel, disponibilité |
| Lampe objectif | Prix calculé avec délai cible et enveloppe ; pas 15 000 par principe | Devis, marge encaissée, cadence de contribution mesurée |
| Budget | Fonds explicitement affectés avant l'émission | Montant de trésorerie validé et durée du pilote |
| Réserve | Tableau des engagements, rédemptions, stock et coûts | Historique fiable des droits ouverts, évaluation comptable |
| Mineurs | Parcours protecteur, pas de pression répétitive ni exposition GPS requise | Public visé, qualification juridique, règles d'âge |
| Mesure | Qualité utile, contribution validée, coût par contribution incrémentale, satisfaction et rétention choisie | Population de test, protocole, métrique primaire |

### Mesures du pilote proposées

Suivre ensemble : participants exposés et activés ; points gagnés/refusés/en attente ; part de gains validés puis annulés ; contributions utiles uniques ; signalements et qualité ; délai de première récompense ; taux et délai de rédemption ; coût complet réalisé ; réserve pour droits ouverts ; concentration des gains ; recours et faux positifs ; rétention après arrêt ou réduction annoncée des incitations ; dépenses, notifications et regrets perçus. Les ouvertures/jour ou le volume de clics seuls ne répondent pas à la question de la valeur créée.

Préférer une comparaison contrôlée des variantes (par groupes de communauté si les interactions créent de la contamination), avec budget comparable. Mesurer plusieurs semaines après retrait annoncé pour distinguer habitude autonome et activité achetée. Taille d'échantillon, durée et différence minimale utile se calculent depuis les métriques de base ; aucun nombre magique n'est fourni ici.

## 7. Reproduction et limites de la simulation

Exécuter depuis la racine du dépôt :

```powershell
node docs/research/2026-10-25-recompenses-lkdv/simulate-economy.mjs
```

Le script n'utilise aucune dépendance externe, ne lit aucune clé et n'accède ni au réseau ni à Supabase. Il produit `simulation-economie.json` : 20 lignes de cadence, 60 projections à 13/52/104 semaines, 90 sensibilités coût/rédemption et 90 couvertures budgétaires. Il vérifie le triple total correct, les plafonds, la conservation des soldes, l'identité économique du redimensionnement global et le coût ×10 de la baisse isolée du prix. Exécution du 25 octobre 2026 : code de sortie 0, invariants satisfaits.

Le modèle suppose zéro solde initial, comportements constants, absence d'expiration et prix fixes. Il ne prédit ni adoption, ni causalité, ni amélioration de qualité, ni saisonnalité, ni activité liée au handicap, ni changements météo, ni besoins de personnel. Le coût complet est supposé inclure les charges d'exécution ; il ne calcule pas séparément chaque poste ni ne garantit leur montant. Les limites de stock et délais de validation/livraison ne sont pas simulés. Le plafond est un écrêtage hebdomadaire agrégé : l'ordre des événements et une politique de gains entiers acceptés/refusés ne sont pas simulés, et peuvent laisser un reliquat inutilisé. Les échanges cumulés supposent utilisation intégrale des droits éligibles ; les scénarios de rédemption fournissent séparément une estimation attendue. Les soldes historiques réels et les droits créateurs devront être ajoutés pour un budget de lancement.

## 8. Traçabilité des sources

Exa : **14 requêtes, 66 emplacements de résultats demandés** (`sources_reviewed` selon la convention du skill), puis **19 appels de lecture couvrant 18 URL uniques**. Ce n'est pas « 66 études lues ». Une lecture DSA a été allongée puis remplacée par le texte consolidé complet ; deux URL DSA présentent le même règlement. Les sources secondaires remontées ont été exclues des conclusions juridiques. L'ancien guide influence hébergé par la DRIEETS a été consulté puis remplacé, pour les conclusions, par la version ministérielle 2026. Les liens et requêtes sont consignés dans `02-sources-economie.json`.

Qualité des sources : EUR-Lex porte les textes normatifs et lignes directrices ; Commission, CNIL, DGCCRF et ACPR sont les autorités expliquant leur propre cadre ; IFRS Foundation publie son propre référentiel, dont l'applicabilité à LKDV n'est pas présumée. Les recommandations d'architecture, barèmes, formules de financement, profils et scénarios demeurent des propositions de conception explicitement séparées des obligations sourcées.
