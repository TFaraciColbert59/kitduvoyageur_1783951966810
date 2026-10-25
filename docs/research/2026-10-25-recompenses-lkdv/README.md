# LKDV — Recherche approfondie sur les récompenses

**25 octobre 2026 — recherche et audit préparatoires à la future implémentation.**

Le bon point de départ est **un solde dépensable, un objectif choisi et une confirmation fiable des gains**. Les XP, badges et droits créateurs peuvent rester utiles sans occuper l’interface quotidienne. La simplicité recherchée se construit dans la présentation ; les journaux gardent les distinctions nécessaires pour préserver l’argent et les droits des membres.

Cette recommandation est étayée, mais elle reste une hypothèse à valider dans LKDV. La littérature ne donne ni « dosage de dopamine », ni meilleur nombre de zéros, ni justification scientifique universelle pour +5 / +50 / ×3.

## Lire le dossier

| Document | Contenu |
|---|---|
| [01 — Preuves scientifiques](01-preuves-scientifiques.md) | 20 travaux, résultats, effectifs, durées, maintien après retrait, limites et transférabilité |
| [02 — Économie et cadre France/UE](02-economie-et-cadre.md) | Coût réel des objets, budgets, fraude, cinq variantes, mineurs, GPS, avis incités et nature des points |
| [03 — UX et programmes existants](03-ux-et-benchmarks.md) | Decathlon, Microsoft Rewards, REI, Sweatcoin ; surfaces de la refonte actuelle ; états, microcopy, animations et accessibilité |
| [04 — Audit GitHub / Supabase](04-audit-existant.md) | Règles vraiment actives, soldes et journaux, écarts documentaires, API héritée et attentes de traitement |
| [05 — Proposition et validation](05-proposition-et-validation.md) | Direction recommandée, barème de pilote, variante sociale, conservation/retrait, expérimentation et ordre du futur chantier |
| [Simulation reproductible](simulate-economy.mjs) et [résultats JSON](simulation-economie.json) | 5 variantes, 4 profils hypothétiques, 3 coûts d’objet, 3 taux d’utilisation, 2 tailles de communauté et budgets |
| [Traçabilité consolidée](sources-manifest.json), [preuves](evidence/), [vérifications](verification.md) | Requêtes, lectures, résultats Supabase agrégés et contrôles du dossier |

## Les conclusions qui changent le projet

### 1. Récompenser peut fonctionner ; accroître les clics ne suffit pas

Les essais montrent des effets sur l’activité et l’engagement, avec un maintien hétérogène après retrait. BE ACTIVE suit 1 062 personnes pendant 12 mois puis 6 mois : la combinaison gamification/argent conserve un effet sur les pas, tandis que les dispositifs pris isolément ne restent pas significatifs au suivi après correction des comparaisons. Ce n’est pas une preuve pour une boutique outdoor. [Étude originale BE ACTIVE](https://www.ahajournals.org/doi/10.1161/CIRCULATIONAHA.124.069531).

Les gestes sociaux ne sont pas à rejeter par principe. mLIFE (243 personnes, 12 mois) observe une meilleure adhérence et moins d’abandon avec points visibles/classement pour plusieurs soutiens sociaux, dont les likes ; le résultat principal de perte de poids en intention de traiter n’est pas significatif. Le dispositif ne teste ni likes isolés ni points convertibles en lampes. Il justifie un petit test borné, pas une émission ouverte de monnaie par réaction. [Étude originale mLIFE](https://pmc.ncbi.nlm.nih.gov/articles/PMC12304840/).

**Décision proposée :** mesurer réalisations utiles, qualité, satisfaction et retour volontaire ; garder la possibilité d’interrompre et de reprendre sans punition. Les récompenses sont certaines après validation et leurs conditions sont connues. L’objectif est une expérience plaisante et choisie ; la compulsion et le temps d’écran ne sont pas les critères d’optimisation.

### 2. Le prix de la lampe découle du délai et du financement

Au barème du brief, 15 000 points représentent **300 activités à +50**, **100 activités partagées au total de 150**, ou **3 000 likes à +5**. L’effort très différent de ces chemins crée une opportunité de farming ; cela ne permet pas d’estimer à lui seul combien de membres frauderont.

Le simulateur compare le brief ouvert, le brief plafonné et une grille d’utilité plafonnée. Avec les fréquences fictives C, 15 000 points demandent environ 87 semaines au profil actif et 545 au profil occasionnel. À gains inchangés, une lampe à 1 500 réduit ces délais à 8,7 et 54,5 semaines, et multiplie par dix le coût des droits émis. Diviser à la fois les gains et les prix par dix conserve les délais et le coût.

À **20 € de coût complet hypothétique** et **1 000 MAU fictifs**, la réserve de stress pour l’émission d’un mois va d’environ 433 € pour C/lampe15 000 à 4 326 € pour C/lampe1 500. Ce ne sont ni des dépenses réelles LKDV ni une prévision : les profils, poids, taux et coûts sont supposés. Le modèle garde un cas de fraude acceptée et distingue coût des droits créés et colis envoyés. [Hypothèses, formules et sensibilités](02-economie-et-cadre.md).

**Décision proposée :** choisir d’abord un premier avantage proche, le coût livré, le financement et le délai souhaité ; fixer ensuite prix et gains. Ne pas adopter 15 000 comme un optimum psychologique. Une boucle communautaire ne devient financièrement autonome que si des marges ou financements reçus couvrent les récompenses et leurs coûts.

### 3. L’ancien système ne peut pas être traité comme un bloc à supprimer

L’audit a confirmé les quatre circuits : XP, fidélité, parts économiques/cash, avoirs créateurs. Ils ne sont pas interchangeables. La base ne contient que le **barème v1 actif** ; les plafonds par famille de 1 080 XP/semaine et les bons à rendement de 2 % relèvent de propositions plus récentes. Des fonctions de contrôle de marge et de pool existent, mais leur présence ne démontre pas un raccordement au checkout. [Audit et sources](04-audit-existant.md).

Deux écarts doivent être résolus avant de donner davantage de valeur aux actions :

- **Documentation / chemin réel :** les paramètres legacy `rewards_active` et `cashout_active` sont vrais, les likes/messages gardent des branches économiques, et une route authentifiée les relaie via le rôle service. Les notes les décrivent pourtant comme fermés. Aucun gain de test n’a été déclenché ; l’exposition effective du déploiement doit être vérifiée.
- **Fiabilité :** 42 intentions de carnets sont en attente échue depuis plus de 24 h, avec zéro tentative enregistrée ; les 15 outbox traitées ne démontrent pas que cet étage amont fonctionne. Le pool enregistré et les distributions sont à 0 €. Une table n’établit pas la trésorerie bancaire, ni une cause certaine pour le retard.

**Décision proposée :** conserver journaux, preuves, idempotence et droits légitimes ; corriger les producteurs et messages contradictoires. Les vieux composants sans import sont distingués des écrans réellement montés. Les badges restent des souvenirs ; les compétences et saisons passent en détail facultatif.

### 4. La refonte peut rester sobre

L’entrée Récompenses s’intègre au Compte actuel et à ses drawers, sans nouvelle navigation générale. Carte propriétaire : « points disponibles », objectif choisi, progression réelle. Le détail contient catalogue court et historique ; XP et créateur restent secondaires. Ne pas additionner cash retirable et avoir boutique sans établir qu’ils confèrent le même droit.

L’action reçoit un retour immédiat ; le gain n’est célébré qu’après confirmation serveur. Un état « en vérification » reste distinct du solde utilisable. Le partage natif ou la copie d’un lien ne prouve pas une publication ni une lecture. La base d’activité reste accessible en privé ; un bonus de récit utile est distinct. Les animations proposées sont courtes, adaptées à la réduction des mouvements et accompagnées d’un statut accessible. [Contrat UX et surfaces précises](03-ux-et-benchmarks.md).

## Proposition concrète à étudier

Base C : activité validée 50, récit utile +25, aide acceptée 25, préparation pertinente 10, avec sous-plafonds et maximum de 250 points/semaine. Pas de gain dépensable par like dans le premier pilote. Variante sociale séparée : +5 sur un petit nombre de réactions authentiques, sous-plafond 15 inclus dans les 250 ; elle n’est pas incluse dans les résultats de simulation livrés. Aucun de ces montants n’est validé scientifiquement ou activé.

Les petits avantages à 100/250 points sont des scénarios à financer, pas des cadeaux déjà disponibles. L’activité doit rester utile même une fois le plafond atteint ; aucun bonus pour SOS, risque, vitesse, dépense de matériel ou abandon de confidentialité. Le programme doit protéger le public mineur, identifier les contreparties commerciales pertinentes et garder les droits cash des créateurs dans un circuit distinct. [Détail produit et expérimentation](05-proposition-et-validation.md), [portée France/UE](02-economie-et-cadre.md).

## Ordre de la suite

1. Réconcilier droits et chemins réellement actifs ; diagnostiquer l’attente des gains, sans effacer les historiques.
2. Obtenir coûts rendus, stock/prestation sécurisé et budget ; arrêter catalogue, délai et règles de reprise/retour.
3. Tester la compréhension du portefeuille et de l’objectif ; écrire la spécification de migration et d’intégration.
4. Implémenter derrière configuration fermée, avec tests d’atomicité, concurrence, idempotence et compensations ; intégrer les états UX à la refonte.
5. Mener un pilote financé, puis mesurer utilité, coût, satisfaction et maintien. Une comparaison « objectif vs catalogue » teste l’affichage ; démontrer l’effet économique propre des récompenses exige un témoin approprié.

La recherche demandée est livrée. **Aucun code applicatif, migration, solde, flag ou déploiement n’a été modifié.** Seuls ce dossier documentaire et son simulateur ont été créés. Les coûts de la lampe, l’enveloppe réellement disponible, les engagements historiques et les métriques d’usage restent à fournir ou confirmer avant mise en service.

## Couverture et limites

Exa a servi à **36 recherches sur trois axes**, soit **226 emplacements de résultats demandés**, avant déduplication et filtrage. Ce chiffre ne signifie pas 226 articles lus. Les lectures ont récupéré **56 URL distinctes**, après déduplication littérale, dont des pages limitées au résumé ou à une extraction plafonnée. La recherche scientifique exploite 20 travaux avec niveaux d’accès signalés ; les programmes, autorités et docs techniques sont comptés séparément. Les trois axes ont été menés en parallèle, puis les propositions et l’audit ont reçu des relectures croisées. Le [manifest consolidé](sources-manifest.json) précise les URL récupérées.

Le dossier ne prétend pas être une revue systématique exhaustive, une expertise juridique définitive, un calcul de rentabilité sur données réelles ou une recette fonctionnelle du frontend déployé. Les tests d’application historiques cités dans le dépôt n’ont pas été relancés. La simulation et les liens locaux ont été vérifiés dans cette livraison ; voir [journal](verification.md).

**Action d’accès distincte :** le remote Git local contenait un jeton dans son URL, apparu lors de la première lecture technique. Il faut le considérer comme exposé et le révoquer. Aucun secret n’est inclus dans les livrables ; la configuration Git n’a pas été modifiée.
