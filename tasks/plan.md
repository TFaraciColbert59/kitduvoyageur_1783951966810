# LKDV — Plan final d’implémentation de Progression 2.0

**10 octobre 2026 — conception livrée, implémentation à exécuter.**

L’upgrade rend visibles et compréhensibles les aventures réellement accomplies, les préparations utiles et les contributions reconnues. Le premier livrable produit sera une progression accessible depuis les surfaces existantes, avec gain confirmé, historique et prochaine mission. Le programme complet couvre les 25 domaines du brief, en huit phases et 48 tâches vérifiables. L’économie chiffrée est dans LKDV_Economie_Points_2_0.md ; le registre de règles est une spécification de conception, pas une migration prête à appliquer.

## 1. Référence et état vérifié

Dépôt : TFaraciColbert59/kitduvoyageur_1783951966810. Lecture figée sur main au commit **08498ef59a21dc1fccfaa45d167ca3109e1ef2b5**, daté du 10 octobre 2026 à 14:50:34 UTC. Projet Supabase : lekitduvoyageur2, eu-west-3, PostgreSQL 17 ; lectures du 10/10. Le document fourni reprend un audit antérieur : certains points ont déjà été corrigés depuis. Les constats ci-dessous reposent sur la base actuelle et le code figé, pas seulement sur cet audit.

| Objet | Fait constaté | Conséquence pour le plan |
| --- | --- | --- |
| Protection des anciens soldes | Le trigger de profil protège maintenant loyalty_points, loyalty_level, xp et level ; écritures clientes de loyalty_history, loyalty_redemptions et orders révoquées ; RPC legacy non exécutables par authenticated. | P0 vérifie et conserve ces protections ; ne pas annoncer leur absence comme une faille encore actuelle. Des grants UPDATE de profil restent normaux, le trigger constitue le garde-fou par colonne. |
| Réconciliation de fidélité | 16 lignes de journal, dont 10 ouvertures ; **0 écart** entre profils et somme du journal dans la lecture effectuée. | Conserver le journal et les droits reportés. La réconciliation comptable n’atteste pas à elle seule l’authenticité de chaque droit historique. |
| Démonstration | 15 PROGRESSION_AWARD, 15 outbox processed, **0 événement et 0 décision** canoniques ; is_demo absent. Le seed et la spec de stabilisation documentent cette signature. | L’isolation des données de démonstration reste une condition d’entrée ; ces nombres ne prouvent pas une panne du consumer. |
| Règles | Une version v1 active, 7 producteurs, 10 seuils de niveau ; 9 profils de progression. | Étendre le registre et les producteurs, conserver les seuils au lancement. |
| Autres objets | 111 reward_accounts ; 31 transactions totales ; 8 défis canoniques ; 26 anciens défis ; 32 badges ; 31 récompenses de fidélité ; 0 échange de fidélité constaté. | Les compteurs ne décrivent pas autant d’utilisateurs actifs ; dédupliquer les catalogues en préservant les associations historiques. |
| Trois familles de valeur économique | Fidélité historique, parts du Reward Engine, crédit boutique de lignée. Les lignes de progression ont affects_balance=false. | Une vue Mes avantages, avec trois unités distinctes ; aucune conversion automatique XP/argent. |
| Visibilité | ProgressionCompactCard et MaProgressionView existent ; /progression redirige vers /hub?panel=points. La carte compacte disparaît actuellement si son chargement échoue. | Améliorer ces composants, mutualiser les données, afficher un état disponible/vide/en attente/erreur compréhensible. |
| Demandes de gain | Les demandes carnet/checklist côté client sont best-effort ; un échec réseau est avalé. L’outbox existante commence après l’écriture d’un gain. | Ajouter une intention durable avant attribution : une outbox de projection ne récupère pas une attribution jamais appelée. |
| Calculs | Le bonus de randonnée dépend des segments ; les constantes de bonus sont dans producerHooks. La RPC compte les caps par action à partir de now(). | Recalculer depuis des faits stables ; sortir les constantes des hooks ; vérifier les caps en transaction, à la date métier. |
| Preuves de voyage | Le producteur accepte aujourd’hui une checklist complète ou un POI marqué visited comme alternative à une session traitée. | Renforcer : une préparation cochée ne prouve pas un voyage accompli. |
| Exploitation | pg_cron 1.6.4 est installé ; aucun job progression/classement trouvé dans cron.job. vercel.json contient la région cdg1, aucun cron. La route outbox exporte POST. | Mettre en place une exécution observée. Un simple ajout de schedule Vercel ne fonctionnerait pas correctement avec cette route sans adaptateur GET. |
| Tests historiques | Les documents de septembre publient des résultats locaux ; le rapport du 10/10 décrit un déploiement DB du premier incrément. | Résultats historiques à reproduire sur la branche cible ; aucune suite de LKDV n’a été exécutée pendant cette conception. |

La présence du code sur main n’atteste pas le déploiement web actif. Vérifier les routes de fidélité et de commandes dans l’environnement de préproduction, puis les sondes de production. Le chantier de stabilisation déjà ouvert se poursuit ; il ne faut pas créer une seconde opération concurrente de reconstruction.

### Fichiers à réutiliser

| Domaine | Chemins existants vérifiés |
| --- | --- |
| Contrat et calcul | src/features/progression/domain/types.ts ; domain/rules.ts ; server/progressionDto.ts |
| Attribution et preuves | src/features/progression/server/awardProducer.ts ; server/producerHooks.ts ; src/lib/progression-award-requests.ts |
| Services et routes | server/progressionService.ts ; server/challengeService.ts ; src/app/api/progression/ ; src/app/api/cron/progression-outbox/route.ts |
| Interface | src/components/progression/MaProgressionView.tsx ; ProgressionCompactCard.tsx ; src/features/hub/components/HubShell.tsx ; HubMobileSectionsSheet.tsx ; src/components/ui/Sheet.tsx |
| Inventaire et prêts | src/features/materiel/actions/createLoan.ts ; updateLoanStatus.ts ; services/getLoans.ts |
| Collaboration | src/features/tribu/actions/taskTemplates.ts ; src/features/trips/hooks/useTripStatus.ts ; tables travel_groups, group_tasks, club_challenge_entries |
| Avantages | src/features/loyalty/server.ts ; validation.ts ; src/features/checkout/serverPricing.ts ; src/features/kits/royalty.ts ; tables loyalty_history, reward_accounts, store_credit_ledger |
| Validation | tests/features/progression/ ; tests/phase1/loyalty-validation.spec.ts ; supabase/tests/database/progression_*.test.sql ; phase1_balance_lockdown.test.sql |
| Exploitation | docs/progression/OPERATIONS.md ; PRODUCER_MATRIX.md ; LOCAL_DB_TESTING.md ; scripts/ops/progression_outbox_health.mjs ; vercel.json |

Le stack constaté est Next 15.5.25, React 19.0.3, Supabase et Capacitor ; ne pas utiliser les souvenirs d’une autre branche pour imposer une migration de framework. Conserver Vercel pour le web et Capacitor pour le mobile.

## 2. Décisions d’architecture

### Le parcours fiable

Une action finalisée écrit son état métier et une intention d’attribution dans la même transaction. Le serveur vérifie ensuite la preuve, la version applicable, les quotas et l’unicité. award_progression_gain écrit la décision et la transaction ; l’outbox actuelle construit l’événement et les projections. Le client lit le gain confirmé et peut distinguer ce qui attend encore sa projection.

Les chemins commerciaux conservent leurs journaux propres. Ils partagent l’identité et la vérification des faits, mais leurs montants, droits et règles financières ne sont pas calculés depuis les XP. Un badge ou une mission est une vue de faits déjà validés ; sa complétion n’appelle pas un nouveau crédit.

### Ajouts minimaux

| Objet proposé | Usage | Limite de portée |
| --- | --- | --- |
| progression_award_intents — nouvelle table interne | Demande durable : user, action, source, date métier, état, tentative, prochaine exécution ; unique par réalisation. | Références aux preuves existantes, sans copier les GPS ou documents personnels. Écriture atomique avec la source ; lecture/écriture réservées aux traitements autorisés. |
| progression_mission_assignments — nouvelle table | Quelques missions choisies par utilisateur, version du modèle, cibles, intervalle et réalisations distinctes comptées. | Réutilise le catalogue progression_challenges ; pas de deuxième moteur de points. |
| progression_discoveries — nouvelle table | Identifiants géographiques canoniques et faits sources pour les tampons réels, déclarés ou virtuels. | Pas de géométrie du monde stockée ; distinction de provenance ; progression géographique privée par défaut. |
| progression_claims — nouvelle table interne | Réservation d’un fait déjà récompensé : user_id, claim_group, evidence_key et référence de décision ; unique sur ces trois premières colonnes. Plusieurs claims peuvent référencer une décision. | Une activité réserve son fait et, si applicable, sa nouveauté parcours/saison ; un carnet peut réserver plusieurs médias. Pas de version de barème dans la clé. Clés historiques conservées et correspondance additive des anciens identifiants. |
| Champs ciblés dans prêts, tâches et validations | Emprunteur, deux confirmations de retour, confirmateur de tâche, validation éditoriale. | Ajouter seulement dans la phase qui active la preuve correspondante. |
| Catalogue de distinctions | Badges et cosmétiques déverrouillés par conditions versionnées. | Réutiliser badges/user_badges et les associations historiques ; aucun solde cosmétique. |

Aucun microservice, Redis, blockchain, nouveau moteur de récompenses ou magasin de GPS n’est nécessaire pour ce programme. Les nouvelles tables exposées ont RLS, grants minimaux et policies explicites ; les objets internes privilégient un schéma non exposé. Supabase service_role reste uniquement serveur. Un SDK authentifié ne donne pas le droit de choisir user_id, points ou poids.

### Attribution, concurrence et dates

1. Authentifier l’appel et résoudre l’utilisateur côté serveur ; identifier source canonique et fait. Rechercher d’abord une décision déjà terminale : un rejeu doit retrouver son succès même si un quota a été atteint depuis.
2. Prendre un verrou transactionnel par utilisateur pour les plafonds, puis réserver les claims d’objet/activité et de bonus dans progression_claims. Les réservations sont écrites avec le gain et annulées si sa transaction échoue ; un refus ne consomme pas une nouveauté. Les contraintes sont scopées par utilisateur : le contrôle de propriété empêche de reprendre la session personnelle d’un autre compte ; les participants distincts d’une sortie commune peuvent chacun progresser. Tester deux événements distincts arrivant simultanément à la dernière place du quota ; l’idempotence seule ne couvre pas ce cas.
3. Charger la version du barème applicable à effective_at, pas seulement active=true à l’instant du traitement. Valider montant, plafond et poids dans le moteur également ; ne pas s’appuyer uniquement sur le wrapper TypeScript.
4. Utiliser des fenêtres de date métier explicites : jour UTC, semaine ISO UTC, intervalle saison [début, fin). Refuser les dates futures invraisemblables ; conserver la date et la provenance de l’enregistrement hors ligne. Bornes half-open pour éviter une attribution aux deux saisons à la frontière.
5. Répartir des entiers par plus fort reste, avec priorité fixe Explorer, Préparer, Partager, Entraider. Aujourd’hui les tie-breaks TS et SQL doivent être alignés ; les anciennes allocations ne sont pas recalculées.
6. Écrire décision, transaction et outbox atomiquement ; une erreur annule l’ensemble. Une indisponibilité garde l’intention en attente, sans transformer une panne temporaire en refus définitif. Une preuve incomplète reste non attribuée jusqu’à son contrôle.
7. Corriger un abus par un mouvement lié, raison et recours ; reconstruire les projections depuis les transactions sans recréditer les portefeuilles. Les opérations financières respectent la discipline de transaction du dépôt, avec gestion des reprises et erreurs de sérialisation ; ne pas prétendre qu’une RPC ordinaire est SERIALIZABLE sans vérifier le contexte d’exécution.

Les doublons sont contrôlés par réalisation et objet : activité commune entre adaptateurs ; préparation sentier/Compas exclusive ; empreinte d’un média et publication qui le rémunère ; correction/accessibilité exclusive ; entretien/réparation du même acte exclusifs. Des actions réellement distinctes peuvent se cumuler : randonnée, débrief, carnet original. L’itinérance ajoute un accomplissement de plusieurs jours, pas une répétition de la récompense de sortie.

Les quotas comptent les groupes cap_group publiés dans le registre : randonnée et autres adaptateurs partagent 2/8/48 réalisations ; préparations sentier et Compas partagent 1/3/18 ; les deux rôles de prêt partagent 1/2/8 par utilisateur. Les autres actions ont leur propre groupe. Une nouvelle réservation de média vérifie toutes ses empreintes atomiquement : elle ne peut prendre quelques éléments puis échouer sur un doublon. La publication reste possible même lorsqu’elle ne reçoit aucun XP. Les claims historiques ne sont pas supprimées pour rouvrir artificiellement un gain.

## 3. Les 25 domaines, un à un

| # | Domaine | Upgrade concret et intégration | Condition d’acceptation |
| ---: | --- | --- | --- |
| 1 | Identité | Résumé d’explorateur dans Ma progression, titre choisi et histoire des accomplissements. Le niveau ne devient pas un rôle public automatique ; ne pas modifier le sceau terrain ou révéler l’orientation privée. | Permission et certificat professionnel indépendants des XP ; visibilité choisie des distinctions. |
| 2 | Progression | Une barre de niveau, quatre lignes de compétences et des jalons explicables. Conserver les dix seuils, afficher la progression dans le palier courant plutôt que le total comparé à un maximum arbitraire. | Somme des compétences exactement égale aux gains ventilés ; source de niveau unique. |
| 3 | Passeport | Tampons pays/régions/massifs et souvenirs de voyages. Faits GPS contrôlés = réalisés ; saisie personnelle = déclaré ; défi virtuel = virtuel. Les trois ne sont pas interchangeables. | Un tampon peut enrichir plusieurs vues sans plusieurs crédits ; export et suppression respectés. |
| 4 | Carte | Couche personnelle de découvertes utilisant les entités géographiques et cartes existantes, chargée à la demande. Montrer villes, régions et collections ; éviter une fiction de territoire entièrement exploré pour un point visité. | Aucun nouveau téléchargement mondial de randonnées ; positions exactes privées ; pas de lieux sensibles révélés. |
| 5 | Aventures | Récapitulatif avant/pendant/après : préparation due, activité en cours, réalisations validées, gain détaillé et prochain choix. Records personnels privés et souvenirs avec date. | Une sortie terminée hors ligne reste visible en attente puis se réconcilie une seule fois. |
| 6 | Matériel | Débrief final, problèmes résolus, kit mieux adapté, entretien et réparation. L’achat, le prix ou l’allègement extrême n’augmentent pas le niveau. Prêt comme alternative d’accès au matériel. | L’historique relie gain et changement concret ; pas de points pour un toggle d’alerte ou une version recréée. |
| 7 | Compas | Le seul préparateur actuel reçoit une mission de préparation contextuelle et un bilan de fin. Les contrôles dus dépendent de l’aventure ; l’IA conseille et le serveur constate leur complétion. | Une intention vide de voyage ne rapporte rien ; verdict de sécurité jamais piloté par le gain d’XP. |
| 8 | IA | Classement de missions dans un catalogue validé selon préférences, temps, projets et disponibilité des preuves. Suggestion facultative avec raison ; repli déterministe. | L’IA ne crée ni barème ni preuve ni gain ; texte externe traité comme contenu, pas comme instruction de moteur. |
| 9 | Quêtes | Trois missions au plus en cours : courte, hebdomadaire ou projet. Huit catégories du brief : découverte, préparation, progression, communauté, coopération, collection, formation, personnelle. | Le gain annoncé est la somme des actions encore éligibles ; fin de quête = distinction, 0 XP supplémentaire. |
| 10 | Défis collectifs | Objectifs de club/amis sur des participants et faits distincts : préparer ensemble, tenir une sortie, transmettre du matériel. Avancement collectif sans rendre publiques les preuves individuelles. | Quitter, faire une pause ou annuler n’entraîne pas de dette ni pression automatique sur les autres. |
| 11 | Communauté | Réponses acceptées, informations locales corrigées, guides relus, traces et traductions utiles. La réputation locale décrit un historique de contributions, sans se déduire des likes. | Une publication non validée attend ; auteur, bénéficiaire et validateur séparés ; signalement et recours disponibles. |
| 12 | Classements | Amis et clubs d’abord, puis ville/région/pays/monde avec même XP saisonnier éligible. Opt-in de compétition distinct de la confidentialité générale ; masque géographique prudent. | Pas d’exposition d’adresse ou de carte GPS ; minimum de participants et protections d’énumération. Le 1 km reste fermé. |
| 13 | Ligues | Cohortes facultatives selon activité récente et ancienneté, gelées pour une saison de 8 semaines. Distinction de participation ou progression, sans bonus d’XP pour gagner la ligue. | Ne démarrer qu’avec population suffisante et règles compréhensibles ; aucune ligue fantôme alimentée par démos. |
| 14 | Badges | Catalogue unique : premières fois, pratiques, préparation, saisons, coopération, découvertes et contributions. Bronze/argent/or désignent des jalons d’un même badge ; rareté descriptive publiée. | Dédupliquer les définitions sans retirer les badges acquis ; 0 crédit automatique au déblocage. |
| 15 | Récompenses | Souvenirs et cosmétiques d’abord ; Mes avantages réunit les trois historiques économiques. Parts à pool variable et crédits de lignée expliqués séparément. | Pas de conversion XP/€ ; avantages sponsorisés financés et conditions de remise vérifiées. |
| 16 | Personnalisation | Objectifs choisis selon randonnée, vélo, voyages, van, visites ou pratique adaptée. Correspondance de preuves, pas de double crédit pour une activité multitag. | Choix révocable, préférences privées ; progression possible depuis la région de vie. |
| 17 | Accessibilité | Objectifs adaptables, préparation à domicile, contributions et aventures virtuelles clairement indiquées. Interface compatible lecteur d’écran, contrastes et texte agrandi. | Ne pas collecter un diagnostic pour choisir un rythme ; une preuve équivalente permet une base comparable. |
| 18 | Écologie | Reconnaître actions encadrées et informations utiles ; encourager réparation, prêt et découverte locale. Pas de « score carbone » inventé ni récompense par déchets photographiés. | Événement encadré vérifié ; pas d’incitation à visiter des zones fragiles ou contourner un interdit. |
| 19 | Constance | Choisir un rythme hebdomadaire, prévoir repos et interruption. Montrer semaines où l’objectif personnel est atteint, sans perte de niveau ou dette de série. | Pas de bonus journalier cumulatif ni obligation de sortir malgré météo ou blessure. |
| 20 | Historique | Chronologie paginée : action, montant, compétences, source, version, état, date réelle et éventuelle correction. Bilan saison et carrière. | L’utilisateur sait expliquer son dernier gain ; une projection retardée ne crée pas un deuxième événement. |
| 21 | Animations | Confirmation légère, compteur, barre par transform et message accessible ; haptique si disponible. Plusieurs gains simultanés sont regroupés en bilan. | Animations réduites respectées ; pas de modalité bloquant navigation/GPS ; pas de célébration d’un gain encore en attente. |
| 22 | Notifications | Distinction confirmée, tâche collective ou prochain objectif choisi. Préférences et regroupement, deep-link vers la sheet et déduplication par événement. | Pas de push pour chaque point, répétition ou pression de série ; désactivation sans perdre les droits. |
| 23 | Administration | Prévisualiser version du barème, simuler coûts, comparer refus et quotas, gérer saisons, modération et corrections. Journal d’admin et activation progressive. | Publication de règles vérifiée et atomique ; droit admin attesté côté serveur ; aucune édition opaque de solde. |
| 24 | Fiabilité | Intentions durables, preuves proportionnées, plafonds transactionnels, journal, anti-doublon, recours et reconstruisibilité. Anti-collusion calibrée par faits, sans blocage aveugle des nouveaux membres. | Un rejeu, une panne ou deux appels simultanés ne perdent ni ne doublent le gain ; corrections retraçables. |
| 25 | Mesure produit | Baseline et suivi compréhension, première réalisation vérifiée, adoption de missions, qualité, reprises après pause et concentration des XP. | Une hausse des points ne suffit pas au succès ; mesures par cohorte et garde-fous sur coûts/refus. |

### Présentation mobile précise

Réutiliser Sheet et le langage du Compas, les tokens --lkv-* et la navigation à cinq destinations. Les instructions apple-ui-designer et Aura interaction-design du dépôt ont été lues ; leur palette historique s’efface devant les tokens actuels explicitement prioritaires dans CLAUDE.md. Éviter un nouveau design system ou des couleurs de grade.

- **Vue compacte Hub/Compte :** niveau et barre dans le palier, total permanent, un prochain objectif. La première vue vide propose une préparation ou une sortie appropriée ; panne = état réessayable distinct de zéro point.
- **Sheet Ma progression :** en-tête avec retour/fermeture, résumé, quatre lignes de compétences, mission choisie, dernières réalisations. Passeport, distinctions et saison s’ouvrent dans des sections secondaires. Texte système et tailles sémantiques ; chiffres tabulaires ; zones tactiles de 44 px minimum.
- **Bilan de fin :** ordre réalisation → gain confirmé → prochain choix. « Analyse en cours » pour un traitement distant ; montant confirmé issu de la transaction après son commit, puis synchronisation de la projection. Le solde affiché ne simule pas un gain dans le cache.
- **Passeport :** souvenirs datés, nature de la preuve et visibilité, regroupement pays/régions ; pas de carte mondiale 3D chargée avec la sheet initiale.
- **Mes avantages :** montants et unités séparés, conditions puis historique. Accès depuis la progression mais pas de mélange avec les quatre compétences.

Un seul point d’ouverture logique pour Hub, Compte et récapitulatif, avec contexte et retour au module d’origine. Conserver les anciens liens /progression et /compte#progression via un résolveur vers la sheet ; elle doit pouvoir s’ouvrir même sans voyage actif. Ne pas ajouter de sixième onglet ni déclencher une boucle de redirection. Le rang reste secondaire et facultatif.

Les transitions de sheet durent environ 300–450 ms, les microretours 100–150 ms ; ce sont des cibles de design issues du skill, à valider sur appareil. Mouvement via transform/opacity, respect de prefers-reduced-motion, annonces ARIA live non répétées, focus restitué à la fermeture, haptique via l’API réellement exposée par le hook actuel. Le dépôt contient des usages divergents du hook : vérifier sa signature au moment du développement.

## 4. Phases et sous-phases

### P0 — Finir la stabilisation existante

**0.1 État et restauration.** Reprendre le chantier phase1-points, cartographier migrations locales/distantes et déploiement web. Vérifier snapshot et restauration sur environnement isolé. Les sauvegardes sensibles restent privées ; aucune remise à zéro des soldes.

**0.2 Démos.** Utiliser la provenance du seed, pas une simple adresse email supposée. Archiver, marquer is_demo, exclure agrégats et classements. Pour les 15 transactions déjà créditées, reconstruire événements/projections sans les recréditer ; produire rapport avant/après et laisser les autres comptes intacts.

**0.3 Parcours historiques.** Confirmer les nouvelles routes en ligne, anti-forge commande, prix serveur, annulations et remboursements. Vérifier que « confirmed » implique réellement un paiement pour l’émission future de fidélité : la fonction actuelle se fonde sur des statuts et une commande virement peut être créée confirmed. Ajouter un état d’encaissement explicite avant toute émission commerciale nouvelle.

**0.4 Supervision.** Observer l’exécution des jobs, écarts et retards. Vérifier grants, RLS, fonctions privilégiées et absence de nouveau chemin client. Les tests doivent inclure la modification normale du profil comme contrôle positif.

**Sortie :** pas de données démo dans les mesures réelles, zéro écart inexpliqué, ledger reconstructible, protection et sept parcours de base vérifiés. Une stabilisation incomplète bloque les nouveaux barèmes, pas la rédaction ou la preview d’interface.

### P1 — Upgrade visible des sept producteurs existants

**1.1 Contrat et registre.** Documenter unités, versions à date d’effet, allocations, caps, claims et états. Garder les dix seuils. Retirer promesses d’expertise, privilèges et montants inventés ; rendre l’aperçu de règles lisible.

**1.2 Attribution durable.** Ajouter les intentions avant attribution et assurer la transaction avec les sources. Créer le consommateur, sa reprise, sa borne et son journal ; les demandes best-effort ne sont plus le seul déclencheur.

**1.3 Preuves et quotas.** Renforcer checklist/voyage/publication, finaliser le débrief avant gain, remplacer segments par métriques métier. Calculer scopes partagés, dates et plafonds sous verrou ; traiter replays avant quotas. Tester adversarial et concurrence.

**1.4 UI transversale.** Carte compacte, sheet, gain et historique paginé dans les composants existants ; cache par utilisateur, invalidation après gain, reprise à l’ouverture et après retour d’arrière-plan. État pending explicite ; pas de falsification optimiste des soldes.

**1.5 Premier canari.** Ouvrir le nouveau barème pour un petit groupe de comptes internes hors démo, suivre les refus et le backlog. Rendre la première sortie entièrement parcourable avec gain confirmé et explication.

**Sortie :** préparer → accomplir → débriefer/partager → voir un gain confirmé ; aucune nouvelle économie parallèle. Le déploiement UI peut précéder l’activation de règles quand celles-ci sont encore fermées.

### P2 — Missions et distinctions

**2.1 Catalogue.** Convertir les huit défis utiles en modèles versionnés et dédupliquer les 26 historiques. Écarter tout défi dont le producteur n’existe pas ; sa description ne doit pas promettre des XP fictifs.

**2.2 Choix et suivi.** Assignations limitées à trois missions, comptage par événements sources distincts, remplacement/abandon possible, coût de remplacement nul. Compatibilité avec l’ancien current_challenge_id pendant migration.

**2.3 Badges et rythme.** Conditions de distinctions/collections et jalons par compétences, historique conservé, aucune récompense de déblocage récursive. Rythme hebdomadaire choisi et pause sans sanction.

**2.4 Suggestions.** Recommandations déterministes puis IA optionnelle dans le catalogue. Consulter uniquement données autorisées et pertinentes ; fournisseur IA interchangeable pour le classement de missions, sans modifier le moteur d’attribution.

**Sortie :** une mission indique actions restantes et XP encore éligibles, explique son accomplissement et s’éteint sans nouveau crédit.

### P3 — Passeport, carte et matériel

**3.1 Découvertes.** Créer les souvenirs à partir des activités vérifiées, avec identifiants pays/région/massif canoniques et provenance. Imports/déclarations restent explicitement déclarés ; aventures virtuelles ne deviennent pas des visites réelles.

**3.2 Carte personnelle.** Superposer ces identifiants aux données cartographiques actuelles, pagination et chargement différé. Visibilité privée, lieux sensibles masqués, export/suppression ; pas de densification mondiale de la base.

**3.3 Préparation et pratiques.** Adaptateurs pour activités autres que randonnée, Compas sans sentier et objectifs adaptés ; clé d’activité commune et preuves publiées. Vérifier les réalisations avant d’ouvrir chaque nouvel adaptateur.

**3.4 Matériel.** Diff de kit après retour terrain et apprentissages préparatoires. Entretien non récompensé tant que l’intervention n’est pas objectivée dans P5. Réutiliser l’inventaire et les lignées ; aucun gain pour retirer un objet essentiel.

**Sortie :** parcours de proximité ou pratique adaptée complet, souvenirs géographiques justes, progrès du matériel compréhensibles et aucun double crédit d’activité.

### P4 — Contributions utiles et réputation locale

**4.1 Avis et corrections.** Validation des visites, données utiles et delta éditorial ; file de modération existante place_reports, règles d’acceptation et recours. Varier accessibilité sans second crédit du même rapport.

**4.2 Entraide.** Activer qa_questions/qa_answers avec réponse acceptée, bénéficiaire distinct et protections contre accords entre comptes. Règles lisibles ; nouveau contributeur non exclu faute d’ancienneté.

**4.3 Guides, médias, traces, traductions.** Révisions/licences, empreintes et apport inédit. Ne pas confondre longueur d’un texte ou vote populaire avec qualité. IA peut assister la revue, avec décision contrôlée et explicable.

**4.4 Expertise territoriale.** Montrer nombre et nature de contributions acceptées dans leur région/pratique, sans classement de compétence professionnelle. Distinguer exploration et contribution ; pas de promotion admin par XP.

**Sortie :** une information utile publiée puis validée donne son montant unique ; rejet/recours ne perdent pas l’historique de décision.

### P5 — Coopération, prêts et ligues facultatives

**5.1 Sorties et tâches.** Présence vérifiée consentie, organisation réelle, double confirmation de tâches importantes et contribution collective visible. Check-in auto-déclaré seul insuffisant ; pas de points de simple inscription.

**5.2 Prêts et vie du matériel.** Renseigner borrower_id, retour signé des deux parties, dates et restrictions de pair/objet. Entretien/réparation confirmés selon une preuve proportionnée ; pas de justificatif d’achat obligatoire pour progresser.

**5.3 Accompagnement et écologie.** Participants et organisateur distincts ; double confirmation et revue des anomalies. Scopes anti-collusion communs aux échanges, sans stocker conversations ou données de santé.

**5.4 Classements puis ligues.** Opt-in explicite ; amis/clubs avant territoires larges. Minimum actuel de cinq participants conservé pour agrégats, mais une ligue proposée exige au moins vingt participants éligibles réels ; ces seuils sont des choix produit, pas une garantie de confidentialité. Le 1 km reste fermé jusqu’à validation anti-triangulation sur appareils et population suffisante. Classer une saison finie seulement après grâce, corrections et gel ; règles d’égalité documentées.

**Sortie :** progresser ensemble reste possible sans compétition ni partage de traces ; les données de démonstration ne fournissent jamais de masse critique artificielle.

### P6 — Avantages financés et administration économique

**6.1 Inventaire des droits.** Catalogue et duplications, soldes historiques, sources, engagements et conditions. Choisir un mapping explicite vers la vue Mes avantages ; aucun changement de ratio ou expiration rétroactive.

**6.2 Fidélité.** Nouveaux gains sur encaissement réel, base marchandises et retours partiels. Bons futurs du dossier économique uniquement après vérification marge/réserve/conditions ; valorisation serveur du panier. Le client n’envoie pas un prix de récompense autoritaire.

**6.3 Parts et crédit boutique.** Émission qualifiée de parts, pool effectivement financé, gel de période, résidus en centimes et rémunération de lignée existante. Fermer seulement l’émission future de likes/messages ; préserver droits et retraits historiquement légitimes. Ne pas fermer globalement cashout pour remplacer une règle de gain.

**6.4 Administration.** Prévisualisation et simulation, historique de publication, contrôle des ajustements, coupe-circuit par producteur, revue des anomalies. La configuration en base ne remplace pas une vérification de trésorerie.

**Sortie :** chaque avantage délivré a une origine, un coût, une réserve et un débit/contre-mouvement traçables. Les XP restent sans conversion monétaire.

### P7 — Validation finale et amélioration continue

**7.1 Mobile et accessibilité.** Capture 390×844, 430×932, tablette et écran étroit ; VoiceOver/TalkBack, texte agrandi, thèmes, réduction d’animations, interruption réseau/GPS et reprise après veille. Rendu web Capacitor et gestes de sheet vérifiés sur téléphones réels.

**7.2 Charge et coût.** Scénarios 2× le trafic attendu, taille du ledger et intentions, burst hors ligne, batch borné et reprise. EXPLAIN pour les requêtes chaudes, aucune lecture de journal entier pour la carte d’accueil. Adapter fréquence et lots après mesure ; pas d’affirmation de 60/120 fps ou 99,9 % sans preuve.

**7.3 Mesure.** Baseline avant nouvelle émission ; progression comprise, première réalisation, utilisation des missions, qualité/modération et reprise après pause. Concentration des XP et écarts entre cohortes ; suivi des erreurs et coûts commerciaux.

**7.4 Déploiement.** Flags séparés pour UI, barème, adaptateurs, passeport, coopération, ligues, émission commerciale. Migration additive testée et rollback applicatif compatible avec journaux nouveaux ; canari 1 % → 5 % → 25 % → 100 % sous conditions de santé, pas seulement avec un timer.

**Sortie :** critères du programme atteints et preuves jointes, aucun faux « terminé » pour un test non exécuté. Les fonctionnalités sans population, preuve ou financement restent fermées avec un état produit clair.

## 5. Ce qui permet un premier upgrade rapide

Le premier lot utilisateur comprend P0 nécessaire, P1 complet et P2.1–P2.3 sur les producteurs existants : état des gains fiable, carte visible, sheet, historique, prochaine mission et distinctions cohérentes. Ces éléments apportent une amélioration quotidienne sans attendre un passeport mondial, une modération de toutes les contributions ou des partenariats commerciaux.

Le catalogue de 29 actions définit l’horizon complet ; sept producteurs sont réutilisés en premier, les autres s’ouvrent par tranche après validation de leur preuve. Le nombre de sous-phases n’est pas un engagement de calendrier. Les 48 tâches sont dimensionnées à 1–5 fichiers habituels ; si une tâche dépasse cela ou ne tient plus en une session, la scinder en conservant son identifiant parent et ses dépendances. Les migrations communes, le calcul d’attribution et les contrats restent séquentiels ; seuls UI indépendantes, documentation et tests de contrats déjà gelés peuvent être travaillés en parallèle.

Pas de nouvelle infrastructure cartographique ni migration Next/React incluse. L’IA ne doit pas devenir une dépendance du premier gain. Les scénarios numériques donnent 205 XP pour une première aventure documentée, 255/semaine pour un profil régulier et 725 pour un profil très actif, avant contraintes spécifiques de saison : ce sont des simulations fictives, pas des observations de production.

## 6. Exploitation et vérifications

### Planification

Choix initial : Supabase Cron déjà installé pour les consommateurs SQL et le refresh de classement ; exécution par un rôle de job dédié autorisé, lots bornés et journal des tentatives. Cibles de départ à mesurer : intention/attribution toutes les 1–5 min, outbox toutes les 5 min, classement toutes les 15 min. Les traitements TS qui relisent des preuves applicatives exigent un worker Next sécurisé appelé par une planification HTTP autorisée, avec secrets protégés et timeout ; vérifier les extensions/permissions nécessaires avant de le choisir. Ne pas supposer qu’un cron SQL appelle du TypeScript par lui-même.

Une alternative Vercel utilise un adaptateur GET avec le même contrôle CRON_SECRET que POST. Vérifier le plan : la documentation consultée indique Hobby une fois par jour et Pro/Enterprise jusqu’à une fois par minute. Le plan Vercel du projet n’a pas été lu ; il ne faut donc ni présumer que 5 min est disponible ni imposer un abonnement payant. La planification retenue doit être observée en exécution, avec panne simulée et restauration, avant activation de gains.

### Matrice de vérification exigée

| Domaine | Test concret | Réussite attendue |
| --- | --- | --- |
| Attribution | Sept producteurs, erreur réseau entre source et appel, consumer interrompu, cache périmé | Intention conservée ; un gain final et une seule projection. |
| Quotas | Deux sources distinctes à la dernière place du plafond, événements hors ligne, date future, limites de semaine/saison | Respect transactionnel du quota et dates immuables ; aucune fuite de bonus de nouveauté. |
| Idempotence | Double clic, retry, version v1/v2, alias activité, deux comptes sur le même lieu | Même résultat pour même réalisation, indépendance inter-comptes, pas de recrédit à changement de règles. |
| Répartition | Montants 1/15/25/30/40/45/60/80/150 et poids mixtes | Entiers déterministes identiques TS/SQL, somme exacte, historique préservé. |
| Preuves | Checklist vide ou un item libre, voyage coché, carnet privé/orphelin, kit étranger, trace clonée | Aucune réalisation inventée ; refus/attente explicable sans casser le parcours métier. |
| Missions | Même événement dans plusieurs missions, abandon, mission remplacée, item de collection obtenu | Avancement valide et distinct, 0 gain supplémentaire automatique. |
| Social | Auto-réponse, groupe de comptes complices, faux retour de prêt, tâche confirmée par soi | Détection/attente/revue ; aucune rémunération sur simple interaction. |
| Finance | Paiement asynchrone, webhook dupliqué/désordonné, commande virement non encaissée, retour partiel, bonus dépensé | Aucun crédit avant encaissement ; débits/contre-mouvements cohérents ; aucune modification d’XP. |
| Confidentialité | Profil privé, opt-out classements, re-identification locale, suppression/export | Pas de coordonnées dans agrégats, pas de preuve privée publiée, collections et nouvelles tables couvertes. |
| Mobile | Veille, réseau absent puis retour, session différente, texte agrandi et lecteur d’écran | Pas de gain inventé, cache isolé, geste et focus corrects. |
| Exploitation | Rejeu du même lot, worker en panne, règle désactivée, remigration/rollback | Backlog détecté puis rattrapé ; rollback n’efface ni ne double les journaux. |

Commandes existantes à réutiliser pendant l’implémentation : npm test -- tests/features/progression/ ; npm run type-check ; npm run build ; npm run verify:invariants ; npm run test:e2e:mobile ; npm run test:e2e:webkit ; npm run test:a11y. Découvrir les options CLI Supabase par --help puis suivre LOCAL_DB_TESTING.md pour les tests pgTAP sur une base isolée ; le dépôt signale une baseline à utiliser, donc ne pas présumer qu’un reset complet de toute son histoire passe déjà.

Les builds et tests globaux se font aux points de contrôle après 2–3 tranches, puis au gel ; les suites ciblées accompagnent chaque changement de comportement. Ne pas ajouter des tests qui recopient des détails d’animation sans vérifier un parcours, ni relancer des suites identiques sans raison. Les preuves sont datées avec commit, environnement et résultat ; un échec préexistant reste explicitement consigné.

### Garde-fous de sortie mesurables

- Zéro transaction de progression sans décision/événement après rattrapage, hors archives démo identifiées ; zéro écart inexpliqué de portefeuille.
- Délais de validation et projection suivis séparément ; alerte initiale outbox >15 min ou dead>0, puis adaptation au débit mesuré. Aucun retard commercial transformé en gain disponible affiché.
- Sources de vérité : registre versionné, transaction et journal d’avantages. Le cache utilise user_id et version, se vide à la déconnexion et refuse les payloads d’un autre compte.
- Test de compréhension pilote : au moins 8 personnes sur 10 expliquent leur dernier gain et la prochaine action possible. C’est une cible de lancement proposée, pas un résultat atteint ni une preuve statistique.
- Contrastes et lecteurs d’écran validés ; objectifs de fluidité/charge consignés comme cibles tant qu’ils ne sont pas mesurés.
- Fin de saison : nouvelle saison préparée à l’avance, ancienne en clôture pendant 14 jours de grâce, classement définitif gelé ensuite ; gains vérifiés tardifs permanents seulement. Une correction de fraude après gel reste traçable et peut nécessiter une correction publique des résultats.

## 7. Risques réels et traitement

| Risque | Traitement |
| --- | --- |
| Ajouter des XP à des clics déguisés en préparation | Contrôles dus serveur, quotas et distinction action finalisée/création. Préparer peut rapporter, seulement si le résultat utile est vérifié. |
| Augmenter le spam en donnant des points à toute publication | Validation utile, objet canonique, plafonds de famille et claims de contenu ; recommandations indépendantes du volume de posts. |
| Répartir les points ou récompenser plusieurs vues en double | Un événement total, somme de compétences exacte, badge/mission/passeport sans crédit supplémentaire. |
| Faire d’un niveau une certification de montagne ou un rôle de modération | Descriptions neutres et autorisations séparées ; contraintes de l’identité terrain existante conservées. |
| Perdre un gain best-effort avant l’outbox | Intention atomique côté données métier, reprise bornée et état d’attente visible. |
| Effacer des droits en « fusionnant » les économies | Inventaire, snapshots, mapping explicite, conservation des journaux et migrations additives. |
| Lire une doc ancienne comme un état de production | Référence figée, relevés datés, sondes d’environnement et distinction code/déployé/testé. |
| Saturer Supabase en progression mondiale | Identifiants géographiques et faits minimes ; pas de copie de traces ni routes mondiales ; indexes, pagination, rétention de files techniques. |
| Inciter à dépasser ses capacités ou financer une sortie par une récompense promise | Plafonds, rythme choisi, zéro bonus de danger, XP sans valeur, pool seulement après financement réel. |
| Poser trop de gates et immobiliser l’amélioration | Livrer UI/lecture et premières missions tôt ; ouvrir un producteur quand sa preuve est prête ; ne pas attendre les partenaires pour rendre les progrès visibles. |

## 8. Références et livrables

Documentation LKDV : [producteurs](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/docs/progression/PRODUCER_MATRIX.md), [état de septembre](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/docs/progression/STATE.md), [stabilisation du 10/10](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/docs/superpowers/specs/2026-10-10-phase1-stabilisation-points-design.md), [déploiement DB du premier incrément](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/docs/phase1/RAPPORT-DEPLOIEMENT-INCR1.md), [moteur serveur](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/src/features/progression/server/awardProducer.ts), [preuves](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/src/features/progression/server/producerHooks.ts), [fidélité](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/src/features/loyalty/server.ts), [exploitation](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/08498ef59a21dc1fccfaa45d167ca3109e1ef2b5/docs/progression/OPERATIONS.md). Les relevés Supabase agrégés sont conservés dans evidence/etat-verifie.json.

Documentation officielle consultée : [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [fonctions](https://supabase.com/docs/guides/database/functions), [Cron](https://supabase.com/docs/guides/cron), [Vercel fréquence](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel contrôle d’accès aux crons](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [verrous](https://www.postgresql.org/docs/current/explicit-locking.html), [Stripe webhooks](https://docs.stripe.com/webhooks). Le changelog Supabase du 10/10 a été examiné : vérifier l’upgrade mineur PostgreSQL et les évolutions d’API dans le chantier de stabilisation ; ne pas ajouter une migration de dépendances au seul upgrade des points.

Recherche produit : 16 sources retenues dans research/sources-progression.md, dont articles originaux et documentations de Duolingo, Garmin, Strava, komoot et Geocaching. Le comptage Exa de 100 résultats demandés correspond à 90 URLs de recherche distinctes examinées par titres/extraits et 20 URLs demandées en lecture, pas 100 articles intégralement lus. Les règles chiffrées restent des choix LKDV à tester.

Livrables : économie détaillée, registre JSON, simulations et script reproductible, ce plan, tasks/todo.md avec 48 tâches et points de contrôle, recherche et relevés agrégés. Copie de ce plan dans tasks/plan.md pour reprise par un agent ; emplacement recommandé dans le dépôt à la mise en œuvre : docs/progression/2.0/ pour les décisions et le registre. Aucun plan incomplet du dépôt n’a été écrasé.

**Limites de la mission de conception :** code lu et base inspectée en lecture seule ; simulations arithmétiques exécutées ; aucune modification GitHub, migration, écriture de solde, activation de cron ou validation sur téléphone. Les tests d’implémentation du programme restent à exécuter. Les étapes financières nécessitent des coûts et droits vérifiés ; le dossier ne vaut pas approbation juridique de leurs conditions.

