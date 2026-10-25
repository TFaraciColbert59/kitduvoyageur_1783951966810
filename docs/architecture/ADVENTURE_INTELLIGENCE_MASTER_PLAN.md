# Fichier proposé : `docs/ADVENTURE_INTELLIGENCE_MASTER_PLAN.md`

> **Note importante** — Je ne peux pas écrire directement dans le dépôt GitHub depuis cette interface. Le contenu ci-dessous est prêt à être copié dans le fichier indiqué.  
> Audit basé sur la branche `main`, au commit `1779502b5237c2f44378855e68f3105912bb2e29` du 10 septembre 2026. La présence du code est vérifiée, mais le déploiement réel des migrations, variables d’environnement et services externes ne peut pas être garanti sans accès à Supabase/Vercel.

---

# Le Kit du Voyageur  
## Adventure Intelligence System — Vision produit, audit de l’existant et plan directeur

**Version :** 1.0  
**Date :** 10 septembre 2026  
**Dépôt audité :** [TFaraciColbert59/kitduvoyageur_1783951966810](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810)  
**Branche auditée :** `main`  
**Commit de référence :** [`1779502b`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/commit/1779502b5237c2f44378855e68f3105912bb2e29)

---

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Vision stratégique](#2-vision-stratégique)
3. [Promesse produit](#3-promesse-produit)
4. [Méthode d’audit et légende](#4-méthode-daudit-et-légende)
5. [État général du dépôt](#5-état-général-du-dépôt)
6. [Ce qui existe déjà](#6-ce-qui-existe-déjà)
7. [Ce qui existe partiellement](#7-ce-qui-existe-partiellement)
8. [Ce qui est documenté mais pas encore réalisé](#8-ce-qui-est-documenté-mais-pas-encore-réalisé)
9. [Ce qui reste entièrement à construire](#9-ce-qui-reste-entièrement-à-construire)
10. [Matrice complète des capacités](#10-matrice-complète-des-capacités)
11. [Architecture cible](#11-architecture-cible)
12. [Adventure Orchestrator](#12-adventure-orchestrator)
13. [AdventurePlan : modèle central](#13-adventureplan--modèle-central)
14. [Moteur de performance personnelle](#14-moteur-de-performance-personnelle)
15. [Difficulté personnalisée](#15-difficulté-personnalisée)
16. [Intelligence collective des segments](#16-intelligence-collective-des-segments)
17. [Terrain Live : le Waze de l’outdoor](#17-terrain-live--le-waze-de-loutdoor)
18. [Prédiction d’allure, ETA et fatigue](#18-prédiction-dallure-eta-et-fatigue)
19. [Gestion des treks multi-jours](#19-gestion-des-treks-multi-jours)
20. [Intelligence de groupe](#20-intelligence-de-groupe)
21. [Génération complète depuis une seule phrase](#21-génération-complète-depuis-une-seule-phrase)
22. [Intégration avec les modules existants](#22-intégration-avec-les-modules-existants)
23. [Expérience mobile cible](#23-expérience-mobile-cible)
24. [Autonomie et contrôle utilisateur](#24-autonomie-et-contrôle-utilisateur)
25. [Modèle économique](#25-modèle-économique)
26. [Données, confidentialité et conformité](#26-données-confidentialité-et-conformité)
27. [Architecture de données cible](#27-architecture-de-données-cible)
28. [API et événements métier](#28-api-et-événements-métier)
29. [Roadmap recommandée](#29-roadmap-recommandée)
30. [Backlog priorisé](#30-backlog-priorisé)
31. [Qualité, tests et observabilité](#31-qualité-tests-et-observabilité)
32. [Indicateurs de succès](#32-indicateurs-de-succès)
33. [Risques principaux](#33-risques-principaux)
34. [Avantage concurrentiel](#34-avantage-concurrentiel)
35. [Décision stratégique finale](#35-décision-stratégique-finale)
36. [Références](#36-références)

---

# 1. Résumé exécutif

Le Kit du Voyageur possède déjà une base technique et fonctionnelle bien plus avancée qu’un simple prototype de planificateur.

Le dépôt comprend notamment :

- un système de voyages et d’étapes ;
- un pipeline déterministe d’auto-génération ;
- des blueprints de voyage ;
- un extracteur d’intention ;
- un solveur de cohérence ;
- un moteur de budget ;
- un moteur de kit contextuel ;
- une gestion d’inventaire et de matériel ;
- un module randonnée avec GPS, suivi de distance, dénivelé et allure ;
- un copilote terrain déterministe ;
- un système d’alertes ;
- un hub universel Voyage/Randonnée ;
- une couche groupe et équipage ;
- des pages mobiles spécialisées ;
- une infrastructure IA avec fournisseurs, quotas, cache, fallbacks et tâches asynchrones ;
- des guides pays ;
- une couche de découverte d’activités ;
- des fondations d’affiliation et de paiement Stripe ;
- une application Capacitor iOS/Android.

Le projet ne part donc **pas de zéro**.

En revanche, la vision développée dans ce document — un système capable de comprendre une demande unique, générer une aventure complète, apprendre de la personne, fusionner des passages collectifs et recalculer les conditions en direct — n’est pas encore complètement réalisée.

Les principales briques manquantes sont :

1. les connexions Apple HealthKit et Android Health Connect ;
2. un véritable profil de performance personnel appris dans le temps ;
3. un moteur physiologique prudent et explicable ;
4. la segmentation universelle des sentiers ;
5. l’agrégation collective des passages ;
6. la difficulté observée par segment ;
7. les signalements Terrain Live ;
8. la confirmation communautaire des événements ;
9. le recalcul d’ETA segment par segment ;
10. le reroutage dynamique personnalisé ;
11. l’orchestrateur global reliant tous les moteurs ;
12. une surveillance automatique continue avant et pendant le voyage ;
13. une couche transactionnelle complète ;
14. une gouvernance spécifique aux données de santé.

La conclusion centrale est la suivante :

> Le dépôt possède déjà les fondations d’un système d’exploitation de l’aventure, mais les moteurs sont encore majoritairement juxtaposés. La prochaine étape décisive consiste à construire une couche d’orchestration, un profil personnel appris, puis une intelligence collective du terrain.

---

# 2. Vision stratégique

## 2.1 Positionnement

Le Kit du Voyageur doit évoluer vers un :

# **Adventure Intelligence System**

ou, commercialement :

# **Adventure Autopilot**

Sa mission :

> Comprendre la personne, comprendre le terrain, comprendre le contexte et transformer une intention en aventure complète, cohérente, personnalisée et continuellement mise à jour.

Le produit ne doit pas seulement répondre à :

- Où aller ?
- Quel itinéraire suivre ?
- Combien cela coûte ?
- Quel matériel prendre ?

Il doit également répondre à :

- Cette activité est-elle difficile **pour moi** ?
- À quelle allure dois-je marcher aujourd’hui ?
- À quelle heure vais-je réellement arriver ?
- Combien de pauses devrais-je prévoir ?
- Est-ce compatible avec mon état de récupération ?
- Quel membre limitera l’allure du groupe ?
- Quelle portion sera la plus difficile ?
- Le sentier est-il praticable actuellement ?
- Existe-t-il un danger signalé récemment ?
- Que se passe-t-il si la météo change ?
- Dois-je partir plus tôt ?
- À quelle heure dois-je faire demi-tour ?
- Quel matériel me manque réellement ?
- Où puis-je l’acheter, le louer ou le partager ?
- Quel sera le budget final ?
- Quelles réservations et formalités sont nécessaires ?
- Quelle alternative est la plus sûre si le plan principal devient impossible ?

---

## 2.2 Les quatre intelligences du système

Le système cible repose sur quatre familles d’intelligence.

### A. Intelligence personnelle

Elle comprend :

- capacités physiques ;
- vitesse sur terrain plat ;
- comportement en montée ;
- comportement en descente ;
- endurance ;
- récupération ;
- sensibilité à la chaleur ;
- sensibilité au froid ;
- réaction à l’altitude ;
- fatigue cumulée ;
- poids du sac tolérable ;
- habitudes de pause ;
- préférences ;
- expérience ;
- limitations déclarées ;
- état du jour.

### B. Intelligence terrain

Elle comprend :

- distance ;
- dénivelé ;
- pente ;
- altitude ;
- revêtement ;
- technicité ;
- exposition ;
- orientation ;
- isolement ;
- points d’eau ;
- refuges ;
- réseau ;
- échappatoires ;
- difficulté observée ;
- ralentissements collectifs ;
- changements saisonniers.

### C. Intelligence collective

Elle fusionne :

- passages anonymisés ;
- ralentissements ;
- demi-tours ;
- sorties de trace ;
- pauses inhabituelles ;
- signalements volontaires ;
- confirmations ;
- photos ;
- données officielles ;
- récence ;
- diversité des contributeurs.

### D. Intelligence contextuelle

Elle comprend :

- météo actuelle ;
- météo prévue ;
- pluie récente ;
- neige ;
- vent ;
- chaleur ;
- humidité ;
- heure ;
- luminosité ;
- saison ;
- état des sentiers ;
- fermetures ;
- affluence ;
- disponibilité des hébergements ;
- prix ;
- perturbations de transport.

---

# 3. Promesse produit

## 3.1 La promesse principale

> **Une intention. Une aventure complète. Toujours à jour.**

Exemple :

> « Je veux partir cinq jours dans les Dolomites en septembre, sans voiture, avec un budget maximum de 1 200 €, dormir en refuge, faire des randonnées modérées et éviter les passages trop exposés. »

Le système doit pouvoir produire :

- destination précise ;
- dates recommandées ;
- transport aller-retour ;
- transports locaux ;
- hébergements ;
- étapes quotidiennes ;
- tracés ;
- distance et dénivelé ;
- difficulté objective ;
- difficulté personnelle ;
- difficulté pour le groupe ;
- allures recommandées ;
- horaires ;
- pauses ;
- ETA ;
- points d’eau ;
- alimentation ;
- matériel nécessaire ;
- comparaison avec l’inventaire ;
- poids du sac ;
- budget ;
- assurances ;
- documents ;
- réglementation ;
- plan de sécurité ;
- zones hors réseau ;
- cartes hors ligne ;
- alternatives ;
- liens de réservation ;
- alertes jusqu’au départ ;
- recalcul pendant l’activité ;
- bilan et apprentissage après la sortie.

L’utilisateur ne devrait répondre qu’aux questions réellement bloquantes.

---

# 4. Méthode d’audit et légende

## 4.1 Sources utilisées

L’audit s’appuie principalement sur :

- la structure du dépôt ;
- les fichiers source ;
- les migrations Supabase ;
- les plans et spécifications dans `docs/superpowers` ;
- les routes API ;
- les moteurs TypeScript ;
- les derniers commits ;
- les composants du Hub ;
- les composants randonnée ;
- les modules IA ;
- les modules d’affiliation et de découverte.

## 4.2 Légende

| Statut | Signification |
|---|---|
| ✅ **Présent** | Code métier ou interface clairement présent dans la branche `main` |
| 🟠 **Partiel** | Fondation présente, mais vision complète non couverte |
| 📘 **Spécifié** | Décrit dans un document ou un plan, sans preuve suffisante d’une implémentation complète |
| ❌ **Absent** | Aucune implémentation identifiable dans les zones auditées |
| ⚙️ **À vérifier en production** | Code présent, mais activation externe ou déploiement non vérifiable |

Il faut distinguer :

- un composant d’interface ;
- un moteur déterministe ;
- une persistance opérationnelle ;
- une connexion réelle à une API ;
- un système réellement actif en production.

La présence d’un fichier ne garantit pas que :

- la migration est appliquée ;
- la variable d’environnement est configurée ;
- le cron fonctionne ;
- les données sont réelles ;
- le fournisseur est activé ;
- le flux complet a été testé en conditions terrain.

---

# 5. État général du dépôt

## 5.1 Socle technique

Le projet utilise notamment :

- Next.js 15 ;
- React 19 ;
- TypeScript ;
- Supabase ;
- PostgreSQL ;
- Zod ;
- Zustand ;
- Tailwind CSS ;
- MapLibre ;
- Leaflet ;
- Recharts ;
- Capacitor iOS/Android ;
- géolocalisation Capacitor ;
- caméra ;
- haptique ;
- réseau ;
- préférences locales ;
- Dexie pour la persistance navigateur ;
- Web Push ;
- Stripe ;
- OpenRouter/Nemotron ;
- Vitest ;
- Playwright ;
- axe-core.

Le socle est cohérent avec une application mobile outdoor avancée.

## 5.2 Maturité générale

Estimation qualitative :

| Domaine | Maturité |
|---|---:|
| Interface et design system | 80 % |
| Hub universel | 75 % |
| Voyage et planification | 65 % |
| Matériel et inventaire | 75 % |
| Randonnée GPS | 55 % |
| IA d’enrichissement | 65 % |
| Orchestration globale | 25 % |
| Personnalisation physiologique | 10 % |
| Terrain collectif | 5 % |
| Terrain Live | 5 % |
| Réservations transactionnelles | 20 % |
| Monétisation | 30 % |
| Données santé | 0–5 % |
| Conformité santé structurée | 10 % |

Ces pourcentages sont des estimations d’architecture, pas des mesures de couverture de code.

---

# 6. Ce qui existe déjà

## 6.1 Hub universel Voyage/Randonnée

Le dépôt contient une architecture de Hub adaptatif.

La spécification du Hub Universel indique notamment :

- détection du type d’activité ;
- profil Voyage ou Randonnée ;
- composition par widgets ;
- catalogue central ;
- groupe transversal ;
- matériel transversal ;
- données randonnée reliées au voyage ;
- météo ;
- points d’eau ;
- réservations ;
- équipage.

Référence :

- [`docs/superpowers/specs/2026-09-09-hub-universel-phase1-design.md`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/docs/superpowers/specs/2026-09-09-hub-universel-phase1-design.md)

Le Hub constitue une excellente future surface pour afficher :

- score de préparation ;
- difficulté personnelle ;
- état du jour ;
- alertes terrain ;
- budget ;
- matériel ;
- ETA ;
- décisions en attente.

---

## 6.2 Refonte mobile des sections Hub

Le commit principal du 10 septembre annonce la refonte mobile de :

- budget ;
- équipement ;
- groupe ;
- équipe ;
- checklist ;
- documents ;
- sécurité ;
- journal.

Le design utilise :

- héros ;
- indicateurs ;
- rails horizontaux ;
- tiroirs ;
- actions tactiles ;
- moteurs purs ;
- navigation mobile ;
- composants spécialisés.

Référence :

- [`commit 1779502b`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/commit/1779502b5237c2f44378855e68f3105912bb2e29)

Cette base est réutilisable pour le futur Adventure Autopilot.

---

## 6.3 Pipeline d’auto-génération de voyage

Le dépôt contient un pipeline à six étapes :

1. extraction de l’intention ;
2. sélection d’un blueprint ;
3. clonage des couches ;
4. résolution de cohérence ;
5. arbitrage des compromis ;
6. production des propositions.

Référence :

- [`autoGenPipeline.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/trips/engine/autoGenPipeline.ts)

Le pipeline retourne :

- le brief ;
- le blueprint choisi ;
- les couches ;
- le journal des compromis ;
- le temps d’exécution.

C’est une fondation directe du futur orchestrateur.

---

## 6.4 Extraction déterministe de l’intention

Le système sait extraire une partie du besoin utilisateur :

- destination ;
- durée ;
- période ;
- participants ;
- budget ;
- style ;
- intensité ;
- contraintes ;
- mobilité ;
- ville de départ.

La philosophie actuelle est saine :

> Les contraintes importantes doivent être structurées et validées, pas seulement conservées dans un texte génératif.

---

## 6.5 Blueprints et couches fonctionnelles

L’architecture prévoit douze couches :

1. structure du voyage ;
2. itinéraire ;
3. transport principal ;
4. transport local ;
5. hébergement ;
6. nourriture et eau ;
7. matériel ;
8. points d’intérêt ;
9. budget ;
10. formalités ;
11. sécurité ;
12. savoir-faire.

Cette décomposition correspond déjà à la vision « une phrase → un voyage complet ».

---

## 6.6 Solveur de cohérence

Le solveur actuel gère notamment :

- contraintes verrouillées ;
- dépassement du budget ;
- alternatives d’hébergement ;
- poids de sac ;
- seuil de portage ;
- fréquence de ravitaillement.

Référence :

- [`coherenceSolver.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/trips/engine/coherenceSolver.ts)

C’est une bonne première version d’un solveur métier déterministe.

### Limite importante

Le solveur utilise actuellement une valeur de poids corporel par défaut et une règle fixe de 20 %.

Cela ne doit pas devenir une recommandation médicale universelle. La future version devra :

- utiliser un profil facultatif ;
- rendre la règle configurable ;
- prendre en compte l’expérience et le contexte ;
- afficher une justification ;
- éviter de présenter un seuil générique comme vérité physiologique.

---

## 6.7 Moteur de budget

Le dépôt contient un moteur de budget structuré :

- catégories ;
- calculs ;
- répartition ;
- suivi ;
- affichage mobile ;
- total dépensé ;
- reste ;
- alertes.

Référence :

- [`budgetEngine.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/trips/engine/budgetEngine.ts)

Ce moteur pourra être enrichi avec :

- prix réels ;
- historique des prix ;
- taux de change ;
- marge d’incertitude ;
- commissions ;
- coûts dépendant de l’itinéraire ;
- simulation de variantes.

---

## 6.8 Matériel, inventaire et kit contextuel

Le dépôt possède plusieurs briques importantes :

- inventaire ;
- consommables ;
- alertes ;
- préparation du départ ;
- objets manquants ;
- poids ;
- attribution du matériel ;
- scoring ;
- recommandations ;
- prompts contextuels ;
- rapport de kit ;
- moteur déterministe ;
- enrichissement IA.

Références :

- [`contextualKitEngine.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/trips/engine/contextualKitEngine.ts)
- [`configuratorCore.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/lib/ai/configuratorCore.ts)
- [`src/features/materiel/services`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/features/materiel/services)

C’est une brique très importante pour :

- optimiser le poids ;
- détecter les oublis ;
- adapter le kit à la météo ;
- proposer achat, location ou partage ;
- générer du revenu d’affiliation.

---

## 6.9 Moteur randonnée

Le module randonnée comprend notamment :

- calcul de distance GPS ;
- calcul de cap ;
- lissage de l’altitude ;
- calcul du dénivelé positif ;
- calcul de l’allure moyenne ;
- suivi d’une session ;
- machine à états ;
- alertes ;
- contrôleur de randonnée ;
- services GPS ;
- copilote.

Références :

- [`HikeEngine.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/hiking/engine/HikeEngine.ts)
- [`TrackingEngine.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/hiking/engine/TrackingEngine.ts)
- [`HikingController.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/hiking/controllers/HikingController.ts)

Cette base permet déjà de collecter des traces utiles au futur apprentissage.

---

## 6.10 Copilote terrain déterministe

Le copilote répond à des questions telles que :

- combien reste-t-il ?
- où est le prochain point d’eau ?
- suis-je en retard ?
- où faire une pause ?
- quel dénivelé ai-je parcouru ?

Référence :

- [`CopilotEngine.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/hiking/copilot/CopilotEngine.ts)

Il sait aussi générer des suggestions proactives en cas de :

- alerte météo ;
- baisse d’allure ;
- proximité d’un point d’intérêt.

### Limite actuelle

Le copilote compare encore l’utilisateur à une allure standard de `15 min/km`.

Cette valeur doit être remplacée par :

- une allure personnelle ;
- une allure par type de terrain ;
- une allure dépendant de la pente ;
- une allure dépendant de la fatigue ;
- une distribution statistique ;
- une fourchette de confiance.

---

## 6.11 Infrastructure IA

Le dépôt possède une architecture IA structurée, notamment :

- `askAI.ts` ;
- fournisseurs IA ;
- registre de fonctionnalités ;
- cache ;
- quotas ;
- fallbacks ;
- tâches asynchrones ;
- guides pays ;
- configurateur de kit ;
- récits post-randonnée ;
- routes API ;
- cron de traitement.

Références :

- [`src/lib/ai`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/lib/ai)
- [`src/app/api/ai`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/app/api/ai)
- [`process-ai-jobs`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/app/api/cron/process-ai-jobs)

La règle d’architecture documentée est excellente :

> **L’IA enrichit, mais les moteurs métier déterministes restent responsables des calculs et des décisions structurées.**

Cette règle doit rester centrale.

---

## 6.12 Guides pays et découverte

Le dépôt contient :

- pages pays ;
- guides générés ou enrichis ;
- recommandations ;
- régions ;
- activités ;
- gastronomie ;
- météo ;
- trails ;
- fournisseurs de découverte ;
- sélection serveur ;
- Viator ;
- liens Klook ;
- fallback.

Le commit du 10 septembre indique une couche provider-agnostique et des cartes pays dynamiques.

Référence :

- [`src/features/discovery`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/features/discovery)

---

## 6.13 Groupe et équipage

Le Hub universel inclut :

- création automatique d’un groupe associé à l’activité ;
- membres ;
- rôles ;
- invitations ;
- synchronisation collaborateurs/groupe ;
- masquage des groupes automatiques solo ;
- nettoyage en fin d’activité ;
- équipage visible dans le Hub.

Cette base sera directement exploitable pour :

- calculer l’allure du groupe ;
- identifier le membre limitant ;
- distribuer le matériel ;
- suivre la cohésion ;
- gérer les retards ;
- détecter une séparation.

---

## 6.14 Affiliation et Stripe

Le dépôt contient :

- un module d’affiliation ;
- composants ;
- données ;
- schémas ;
- moteur ;
- types ;
- métadonnées Stripe ;
- webhook Stripe.

Références :

- [`src/features/affiliation`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/features/affiliation)
- [`src/app/api/stripe/webhook`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/app/api/stripe/webhook)

Il existe donc déjà une fondation de monétisation, mais pas encore une plateforme transactionnelle complète de voyage.

---

# 7. Ce qui existe partiellement

## 7.1 « Une phrase → voyage complet »

### Présent

- extraction d’intention ;
- blueprints ;
- douze couches ;
- pipeline ;
- solveur ;
- budget ;
- itinéraire ;
- kit ;
- formalités ;
- sécurité ;
- points d’intérêt.

### Manquant

- génération de plusieurs candidats réellement recherchés ;
- arbitrage multicritère avancé ;
- disponibilité en temps réel ;
- prix réels consolidés ;
- réservation complète ;
- recalcul continu ;
- surveillance jusqu’au départ ;
- dépendances entre toutes les couches ;
- apprentissage personnel ;
- personnalisation physiologique ;
- décisions transactionnelles.

**Statut : 🟠 Partiel.**

---

## 7.2 Itinéraire intelligent

### Présent

- étapes ;
- construction d’itinéraire ;
- parcours randonnée ;
- distance ;
- dénivelé ;
- points d’intérêt ;
- météo ;
- structure de voyage.

### Manquant

- véritable routage multimodal global ;
- génération de plusieurs parcours outdoor ;
- score personnalisé ;
- segments techniques ;
- alternatives calculées en direct ;
- fermeture de sentiers ;
- reroutage hors ligne ;
- optimisation par heure de coucher du soleil.

**Statut : 🟠 Partiel.**

---

## 7.3 ETA et allure

### Présent

- allure moyenne ;
- distance restante ;
- estimation simple ;
- durée ;
- comparaison à une allure standard.

### Manquant

- allure personnelle apprise ;
- segmentation ;
- pente ;
- terrain ;
- météo ;
- altitude ;
- sac ;
- fatigue ;
- pauses ;
- incertitude ;
- correction en direct ;
- apprentissage post-sortie.

**Statut : 🟠 Très partiel.**

---

## 7.4 Difficulté

### Présent

- données de distance et dénivelé ;
- profils d’activité ;
- intensité ;
- quelques estimations de durée ;
- structure permettant un score.

### Manquant

- difficulté multidimensionnelle ;
- technicité ;
- exposition ;
- isolement ;
- difficulté observée ;
- difficulté personnelle ;
- difficulté groupe ;
- confiance statistique ;
- calibration.

**Statut : 🟠 Très partiel.**

---

## 7.5 Alertes

### Présent

- moteur d’alertes randonnée ;
- alertes météo ;
- alertes matériel ;
- notifications ;
- push ;
- tâches cron.

### Manquant

- signalements géolocalisés communautaires ;
- confirmations ;
- expiration ;
- déduplication ;
- réputation ;
- détection collective ;
- événements officiels ;
- couche cartographique live.

**Statut : 🟠 Partiel.**

---

## 7.6 Hors ligne

### Présent

- Capacitor ;
- préférences ;
- réseau ;
- stockage local ;
- technologies compatibles avec l’offline.

### Manquant ou non vérifié

- package complet par aventure ;
- cartes tuilées hors ligne ;
- alertes récentes embarquées ;
- alternatives hors ligne ;
- synchronisation robuste des signalements ;
- gestion des conflits ;
- file d’événements ;
- stratégie de versionnement.

**Statut : 🟠 Fondation technique.**

---

## 7.7 Monétisation

### Présent

- affiliation ;
- produits ;
- découverte d’activités ;
- liens externes ;
- Stripe ;
- webhook ;
- configurateur de kit.

### Manquant

- offres d’abonnement finalisées ;
- règles de droits ;
- paywall cohérent ;
- pass voyage ;
- réservation multi-prestataires ;
- tableau de commissions ;
- facturation B2B ;
- API commerciale ;
- marketplace locale.

**Statut : 🟠 Partiel.**

---

# 8. Ce qui est documenté mais pas encore réalisé

Les documents `docs/superpowers` contiennent plusieurs plans détaillés. Certains ont ensuite été réalisés, d’autres peuvent n’être que des plans.

Un document de plan ne doit jamais être traité comme preuve de production.

Parmi les sujets documentés :

- architecture IA ;
- routeur Nemotron/OpenRouter ;
- migration IA ;
- configurateur de kit ;
- récits post-randonnée ;
- guides pays ;
- Hub universel ;
- refonte mobile ;
- architecture mobile ;
- application first ;
- matériel ;
- découverte ;
- intégrations de contenu.

Références :

- [`docs/superpowers/plans`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/docs/superpowers/plans)
- [`docs/superpowers/specs`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/docs/superpowers/specs)

Pour chaque chantier, il faudra maintenir trois champs distincts :

```text
specification_status
implementation_status
production_status
```

Exemple :

```yaml
feature: country-guides
specification_status: complete
implementation_status: present
production_status: unknown
```

---

# 9. Ce qui reste entièrement à construire

## 9.1 Connexions santé

Aucune intégration complète clairement identifiable n’a été trouvée pour :

- Apple HealthKit ;
- Android Health Connect ;
- Garmin Health API ;
- Fitbit Web API ;
- Polar ;
- Suunto ;
- Coros ;
- capteurs Bluetooth cardio ;
- baromètres externes ;
- oxymètres.

**Statut : ❌ À construire.**

---

## 9.2 Profil de performance personnel

Il manque un modèle central persistant capable d’apprendre :

- allure plate ;
- allure en montée ;
- allure en descente ;
- sensibilité à la pente ;
- ralentissement après plusieurs heures ;
- pauses ;
- récupération ;
- réponse au poids du sac ;
- effet de la chaleur ;
- effet du froid ;
- effet de l’altitude ;
- stabilité ;
- confiance ;
- dérive temporelle.

**Statut : ❌ À construire.**

---

## 9.3 Segmentation du terrain

Il manque un référentiel universel de segments avec :

- géométrie ;
- sens ;
- longueur ;
- pente ;
- type de terrain ;
- altitude ;
- technicité ;
- exposition ;
- surface ;
- contexte ;
- versions.

**Statut : ❌ À construire.**

---

## 9.4 Passages normalisés

Il manque le pipeline :

```text
Trace GPS
→ nettoyage
→ map-matching
→ découpage
→ rattachement aux segments
→ extraction des mesures
→ normalisation par profil
→ agrégation
```

**Statut : ❌ À construire.**

---

## 9.5 Difficulté collective

Il manque :

- médiane pondérée ;
- ralentissement normalisé ;
- score d’effort observé ;
- score technique ;
- score d’exposition ;
- score de fatigue ;
- variantes par condition ;
- indice de confiance ;
- détection des anomalies.

**Statut : ❌ À construire.**

---

## 9.6 Terrain Live

Il manque :

- création d’un signalement ;
- catégories ;
- géolocalisation ;
- photo ;
- commentaire ;
- confirmation ;
- infirmation ;
- expiration ;
- état « résolu » ;
- réputation ;
- abus ;
- modération ;
- affichage cartographique ;
- alerte d’approche ;
- synchronisation hors ligne.

**Statut : ❌ À construire.**

---

## 9.7 Reroutage dynamique personnalisé

Il manque un moteur capable de dire :

> « Le sentier est fermé. L’alternative ajoute 2,4 km, 180 m D+, 48 minutes pour vous et augmente le risque d’arrivée après la tombée de la nuit. »

**Statut : ❌ À construire.**

---

## 9.8 Orchestrateur global

Le pipeline actuel assemble des couches, mais il ne constitue pas encore un orchestrateur complet capable de :

- lancer plusieurs moteurs ;
- gérer leurs dépendances ;
- résoudre les conflits ;
- surveiller les données ;
- recalculer les impacts ;
- versionner le plan ;
- demander une confirmation ;
- appliquer une action ;
- annuler une action ;
- expliquer chaque choix.

**Statut : ❌/🟠 À construire sur la fondation existante.**

---

# 10. Matrice complète des capacités

| Capacité | Statut | Commentaire |
|---|---|---|
| Hub Voyage | ✅ | Présent |
| Hub Randonnée | ✅ | Présent |
| Hub Groupe | ✅ | Présent |
| Hub mobile spécialisé | ✅ | Présent |
| Budget | ✅ | Moteur et UI présents |
| Inventaire | ✅ | Présent |
| Kit contextuel | ✅ | Présent |
| Checklist | ✅ | Présente |
| Documents | ✅ | Présents |
| Sécurité | ✅ | Présente, à approfondir |
| Journal | ✅ | Présent |
| GPS randonnée | ✅ | Présent |
| Distance et dénivelé | ✅ | Présents |
| Allure moyenne | ✅ | Présente |
| Copilote terrain simple | ✅ | Présent |
| Météo | ✅/🟠 | Présente, profondeur à vérifier |
| Pipeline auto-génération | ✅ | Présent |
| Extraction d’intention | ✅ | Présente |
| Blueprints | ✅ | Présents |
| Solveur de cohérence | ✅/🟠 | Présent mais encore limité |
| Infrastructure IA | ✅ | Présente |
| Cache et quotas IA | ✅/⚙️ | Code présent, déploiement à vérifier |
| Tâches IA asynchrones | ✅/⚙️ | Code présent, cron à vérifier |
| Guides pays | ✅/🟠 | Présents |
| Découverte d’activités | ✅ | Présente |
| Affiliation | ✅/🟠 | Fondation présente |
| Stripe | ✅/🟠 | Webhook présent |
| Réservation complète | ❌ | Non |
| HealthKit | ❌ | Non |
| Health Connect | ❌ | Non |
| Garmin/Fitbit | ❌ | Non |
| Profil terrain appris | ❌ | Non |
| Difficulté personnelle | ❌ | Non |
| Segments collectifs | ❌ | Non |
| Difficulté collective | ❌ | Non |
| Terrain Live | ❌ | Non |
| Reroutage live | ❌ | Non |
| ETA segmentée personnelle | ❌ | Non |
| Fatigue multi-jours | ❌ | Non |
| Intelligence de groupe | 🟠 | Groupe présent, prédiction absente |
| Surveillance automatique | 🟠 | Crons présents, orchestration absente |
| Offline complet par aventure | 🟠 | Socle présent |
| API B2B de difficulté | ❌ | Non |
| Marketplace locale | ❌ | Non |

---

# 11. Architecture cible

```text
┌───────────────────────────────────────────────────────────────┐
│                     EXPÉRIENCE UTILISATEUR                     │
│ Intention · Hub · Carte · Cockpit · Assistant · Notifications │
└──────────────────────────────┬────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────┐
│                    ADVENTURE ORCHESTRATOR                      │
│ Contraintes · dépendances · scénarios · décisions · versions  │
└───────┬────────┬─────────┬─────────┬────────┬────────┬────────┘
        │        │         │         │        │        │
        ▼        ▼         ▼         ▼        ▼        ▼
   Route     Budget      Kit      Health   Terrain   Booking
   Engine    Engine    Engine     Engine   Engine    Engine
        │        │         │         │        │        │
        └────────┴─────────┴─────────┴────────┴────────┘
                               │
┌──────────────────────────────▼────────────────────────────────┐
│                    COHERENCE SOLVER                            │
│ contraintes dures · compromis · score · sécurité · confiance  │
└──────────────────────────────┬────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────┐
│                       ADVENTURE PLAN                           │
│ plan versionné · provenance · fraîcheur · alternatives         │
└──────────────────────────────┬────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────┐
│                        LIVE RUNTIME                            │
│ GPS · météo · Terrain Live · ETA · fatigue · alertes · sync   │
└───────────────────────────────────────────────────────────────┘
```

---

# 12. Adventure Orchestrator

## 12.1 Responsabilité

L’orchestrateur ne doit pas inventer lui-même tous les résultats.

Il doit :

1. comprendre la demande ;
2. établir les contraintes ;
3. appeler les moteurs spécialisés ;
4. collecter leurs propositions ;
5. vérifier les sources ;
6. mesurer la fraîcheur ;
7. résoudre les conflits ;
8. calculer les impacts ;
9. produire plusieurs scénarios ;
10. demander confirmation si nécessaire ;
11. enregistrer les décisions ;
12. surveiller les changements.

## 12.2 Principe fondamental

```text
Les moteurs calculent.
Le solveur arbitre.
L’IA explique.
L’utilisateur contrôle.
```

## 12.3 Contrat de sortie d’un moteur

Chaque moteur devrait retourner :

```ts
interface EngineProposal<T> {
  engine: string;
  version: string;
  value: T;
  confidence: number;
  provenance: DataSource[];
  computedAt: string;
  validUntil?: string;
  assumptions: Assumption[];
  warnings: Warning[];
  alternatives: Alternative<T>[];
  impacts: PlanImpact[];
  requiresConfirmation: boolean;
}
```

---

# 13. AdventurePlan : modèle central

Le modèle cible devrait contenir :

```text
AdventurePlan
├── identity
├── intent
├── participants
├── personalProfiles
├── dates
├── destinations
├── transport
├── localMobility
├── accommodations
├── dailyStages
├── activityRoutes
├── terrainAnalysis
├── personalDifficulty
├── groupDifficulty
├── paceStrategies
├── foodAndWater
├── gearPlan
├── budget
├── bookings
├── documents
├── regulations
├── safetyPlan
├── offlinePackage
├── liveConditions
├── alternatives
├── confidence
├── decisions
├── monitoringRules
└── versions
```

Chaque valeur importante doit comporter :

- provenance ;
- date de calcul ;
- durée de validité ;
- confiance ;
- hypothèses ;
- dépendances ;
- motifs ;
- impacts.

---

# 14. Moteur de performance personnelle

## 14.1 Objectif

Créer un **Profil Terrain** propre à chaque personne.

Ce profil ne doit pas être un simple niveau « débutant/intermédiaire/expert ».

Il doit être multidimensionnel.

Exemple :

```yaml
endurance_marche: 74
capacite_montee: 68
capacite_descente: 57
aisance_technique: 61
tolerance_portage: 52
tolerance_chaleur: 43
tolerance_froid: 72
recuperation: 66
stabilite_allure: 79
orientation: 58
confiance_modele: 81
activites_utilisees: 47
```

## 14.2 Sources de données

### Données déclarées

- âge ;
- taille ;
- poids ;
- expérience ;
- activités pratiquées ;
- objectifs ;
- limitations ;
- douleurs ;
- préférences ;
- allergies ;
- traitements, uniquement si volontaire et justifié ;
- niveau ressenti ;
- appréhension du vide ;
- expérience avec sac.

### Données d’activité

- distance ;
- durée ;
- pauses ;
- dénivelé ;
- pente ;
- altitude ;
- vitesse ;
- cadence ;
- fréquence cardiaque ;
- puissance, si disponible ;
- température ;
- météo ;
- poids du sac ;
- type de terrain ;
- difficulté ressentie ;
- fatigue après activité.

### État du jour

- sommeil ;
- fréquence cardiaque au repos ;
- variabilité cardiaque ;
- activité récente ;
- charge récente ;
- récupération ;
- fatigue déclarée ;
- douleur ;
- hydratation ;
- température corporelle, si disponible ;
- stress, si disponible et consenti.

### Environnement

- pente ;
- surface ;
- technicité ;
- humidité ;
- vent ;
- chaleur ;
- froid ;
- altitude ;
- neige ;
- visibilité ;
- heure ;
- luminosité.

---

## 14.3 Niveaux d’apprentissage

### Niveau 0 — Profil froid

- données déclarées ;
- modèles génériques ;
- grandes marges ;
- confiance faible.

### Niveau 1 — Calibration

Après environ 3 à 5 activités :

- allure plate ;
- comportement en montée ;
- comportement en descente ;
- pauses moyennes.

### Niveau 2 — Personnalisation

Après environ 10 à 20 activités comparables :

- sensibilité au sac ;
- fatigue ;
- chaleur ;
- froid ;
- technicité ;
- durée.

### Niveau 3 — Adaptation contextuelle

Après historique suffisant :

- comportement par heure ;
- récupération multi-jours ;
- seuils personnels ;
- effet du sommeil ;
- effet de l’altitude ;
- dérive en fin d’effort.

Ces nombres sont des objectifs de produit, pas des garanties scientifiques.

---

# 15. Difficulté personnalisée

## 15.1 Difficulté objective

Elle doit intégrer :

- distance ;
- dénivelé positif ;
- dénivelé négatif ;
- pente moyenne ;
- pente maximale ;
- altitude ;
- technicité ;
- exposition ;
- orientation ;
- isolement ;
- météo ;
- portage ;
- durée ;
- possibilités d’abandon ;
- distance entre refuges ;
- couverture réseau ;
- disponibilité de l’eau.

## 15.2 Difficulté collective

Elle repose sur les passages observés :

- ralentissement normalisé ;
- fréquence des arrêts ;
- demi-tours ;
- sorties de trace ;
- hausse d’effort ;
- fatigue en sortie ;
- incidents signalés.

## 15.3 Difficulté personnelle

Formule conceptuelle :

```text
Difficulté personnelle
=
charge prévisionnelle
/
capacité disponible du jour
```

Elle doit utiliser :

- profil historique ;
- état du jour ;
- poids du sac ;
- expérience ;
- météo ;
- durée ;
- fatigue cumulée ;
- activité du groupe.

## 15.4 Présentation

Exemple :

```text
Difficulté officielle : Difficile
Difficulté observée : 74/100
Pour vous aujourd’hui : 61/100 — Modérée à exigeante
Confiance : 84 %

Facteurs principaux :
• montée régulière bien adaptée à votre profil ;
• descente technique plus lente pour vous ;
• sommeil légèrement insuffisant ;
• sac supérieur de 1,8 kg à votre zone habituelle ;
• terrain humide confirmé récemment.
```

---

# 16. Intelligence collective des segments

## 16.1 Découpage

Un parcours doit être découpé selon :

- changement de pente ;
- intersection ;
- changement de surface ;
- rupture technique ;
- changement d’exposition ;
- point d’eau ;
- refuge ;
- changement d’altitude marqué ;
- zone dangereuse.

Longueur indicative :

- 50 à 250 mètres pour les zones techniques ;
- davantage sur terrain homogène.

## 16.2 Observation normalisée

Pour chaque passage :

```text
temps_attendu
temps_observe
ralentissement_normalise
effort_normalise
cadence
arrets
sorties_de_trace
demi_tour
contexte
qualite_gps
qualite_capteurs
```

Exemple :

```text
Temps attendu : 4 min 40 s
Temps observé : 6 min 15 s
Ralentissement brut : +34 %
Effort cardio relatif : +18 %
Cadence : -21 %
Arrêt : 1 min 12 s
```

Le système doit séparer :

- le niveau de la personne ;
- la difficulté réelle du segment ;
- l’état du jour ;
- la qualité de l’observation.

## 16.3 Agrégation robuste

Le score collectif ne doit pas être une moyenne naïve.

Il doit utiliser :

- médiane pondérée ;
- qualité GPS ;
- précision du map-matching ;
- récence ;
- diversité des utilisateurs ;
- diversité des niveaux ;
- météo ;
- direction ;
- saison ;
- charge portée ;
- anomalies ;
- détection des doublons.

## 16.4 Scores par segment

```yaml
effort_physique: 72
technicite: 81
exposition: 44
orientation: 35
fatigue_generee: 63
risque_meteo: 28
difficulte_collective: 69
confiance: 92
passages: 284
utilisateurs_distincts: 137
```

## 16.5 Conditions différenciées

Un segment ne possède pas une difficulté unique.

Exemple :

| Condition | Difficulté |
|---|---:|
| Sec, montée | 54 |
| Humide, montée | 71 |
| Neige | 86 |
| Nuit, descente | 91 |

---

# 17. Terrain Live : le Waze de l’outdoor

## 17.1 Types de signalements

- arbre tombé ;
- chemin fermé ;
- boue ;
- neige ;
- glace ;
- crue ;
- pont endommagé ;
- chute de pierres ;
- animal dangereux ;
- mauvaise visibilité ;
- balisage manquant ;
- zone très fréquentée ;
- point d’eau sec ;
- refuge fermé ;
- travaux ;
- danger non catégorisé.

## 17.2 Création rapide

Le signalement doit prendre moins de cinq secondes :

1. toucher le bouton ;
2. choisir une catégorie ;
3. confirmer.

Automatiquement :

- position ;
- heure ;
- segment ;
- direction ;
- précision GPS ;
- contexte météo.

Optionnel :

- photo ;
- commentaire ;
- niveau de gêne ;
- passable ou non.

## 17.3 Cycle de vie

```text
Nouveau
→ En attente
→ Confirmé
→ Actif
→ Vieillissant
→ À vérifier
→ Résolu ou expiré
```

## 17.4 Confirmations

À l’approche :

```text
Arbre tombé dans 350 m
Signalé il y a 2 h
Confirmé par 14 personnes
Toujours présent ?
[Oui] [Non] [Je ne sais pas]
```

Le système peut aussi utiliser des signaux implicites :

- ralentissement ;
- détour ;
- demi-tour ;
- sortie de trace ;
- arrêt collectif.

## 17.5 Expiration indicative

| Événement | Durée indicative |
|---|---|
| Affluence | 1 à 3 heures |
| Mauvaise visibilité | 1 à 6 heures |
| Animal aperçu | 30 à 90 minutes |
| Boue | 12 à 48 heures |
| Neige/glace | Variable selon météo |
| Point d’eau sec | Plusieurs jours |
| Arbre tombé | Plusieurs jours |
| Pont endommagé | Longue durée |
| Fermeture officielle | Jusqu’à levée officielle |

## 17.6 Confiance

Facteurs positifs :

- confirmations ;
- récence ;
- cohérence des traces ;
- utilisateurs distincts ;
- photo ;
- source officielle ;
- réputation modérée.

Facteurs négatifs :

- contradictions ;
- ancienneté ;
- mauvaise précision GPS ;
- signalements dupliqués ;
- position incohérente.

## 17.7 Confidentialité

L’interface publique ne doit jamais afficher :

- identité du passage ;
- fréquence cardiaque individuelle ;
- données de santé ;
- vitesse nominative ;
- historique personnel.

Elle peut afficher :

```text
24 passages récents
Ralentissement collectif : +32 %
Confiance : élevée
Dernière confirmation : il y a 18 minutes
```

---

# 18. Prédiction d’allure, ETA et fatigue

## 18.1 Segmentation du calcul

Le parcours est découpé en segments.

Pour chaque segment :

```text
temps_segment
=
temps_base
× coefficient_personnel
× coefficient_pente
× coefficient_terrain
× coefficient_fatigue
× coefficient_sac
× coefficient_meteo
× coefficient_altitude
× coefficient_technicite
```

Il est préférable d’utiliser une fonction additive dans un espace logarithmique ou un modèle probabiliste afin d’éviter l’explosion arbitraire des coefficients.

## 18.2 Trois stratégies d’allure

### Confort

- effort faible ;
- pauses généreuses ;
- meilleure marge ;
- priorité à l’expérience.

### Recommandée

- compromis effort/durée ;
- marge de sécurité ;
- rythme durable.

### Rapide

- effort supérieur ;
- marge plus faible ;
- uniquement si le profil et le contexte le permettent.

Exemple :

| Stratégie | Allure | ETA |
|---|---|---|
| Confort | 2,8–3,1 km/h | 17 h 45 |
| Recommandée | 3,1–3,4 km/h | 17 h 20 |
| Rapide | 3,5–3,8 km/h | 16 h 50 |

## 18.3 Incertitude obligatoire

Ne jamais afficher une précision trompeuse.

Préférer :

```text
Arrivée estimée : 17 h 20
Fourchette probable : 17 h 05–17 h 42
Confiance : 82 %
```

## 18.4 Mise à jour live

Recalcul déclenché par :

- progression ;
- changement d’allure ;
- pause ;
- météo ;
- signalement ;
- sortie de trace ;
- baisse de batterie ;
- perte de réseau ;
- retard ;
- fatigue déclarée.

---

# 19. Gestion des treks multi-jours

Le système doit modéliser :

- fatigue cumulative ;
- récupération nocturne ;
- qualité du sommeil ;
- altitude ;
- alimentation ;
- hydratation ;
- poids du sac ;
- répétition des descentes ;
- douleurs déclarées ;
- météo successive.

Exemple :

```text
Capacité estimée :
Jour 1 : 100 %
Jour 2 : 89 %
Jour 3 : 82 %
Jour 4 : 85 % après étape courte
Jour 5 : 78 %
```

Le moteur pourra proposer :

- raccourcir une étape ;
- déplacer des kilomètres ;
- ajouter une nuit ;
- choisir un refuge différent ;
- transférer du matériel ;
- utiliser un transport local ;
- ajouter un jour de repos.

---

# 20. Intelligence de groupe

## 20.1 Profil collectif

Le groupe ne doit pas être calculé par simple moyenne.

Il faut considérer :

- le membre limitant ;
- l’écart de niveau ;
- le poids réparti ;
- l’expérience ;
- les limitations ;
- la cohésion ;
- la possibilité de séparation ;
- les responsabilités ;
- les enfants ;
- les animaux.

## 20.2 Résultat groupe

Exemple :

```text
Allure individuelle Tony : 3,4 km/h
Allure individuelle Emma : 2,9 km/h
Allure individuelle Lucas : 3,6 km/h
Allure de groupe recommandée : 2,8 km/h

Membre dimensionnant : Emma
Cause : descente technique
Recommandation : transférer 1,5 kg de son sac
Nouvelle ETA estimée : 17 h 35 ± 18 min
```

## 20.3 Sécurité de cohésion

Le système pourra détecter :

- distance croissante entre membres ;
- membre immobile ;
- perte de signal ;
- séparation à une intersection ;
- participant en retard ;
- rythme trop élevé pour un membre.

Ces fonctionnalités doivent être opt-in et transparentes.

---

# 21. Génération complète depuis une seule phrase

## 21.1 Compréhension

Les informations sont classées en quatre catégories.

### Explicites

Exemple :

- Dolomites ;
- cinq jours ;
- septembre ;
- sans voiture ;
- budget 1 200 € ;
- refuge ;
- difficulté modérée.

### Connues du profil

- ville de départ ;
- équipement possédé ;
- allure ;
- préférences ;
- contraintes alimentaires ;
- niveau ;
- historique.

### Inférées

- gare ou aéroport ;
- répartition du budget ;
- horaires ;
- quantité d’eau ;
- catégories de matériel.

Chaque inférence doit comporter une confiance.

### Bloquantes

- budget par personne ou total ;
- dates fixes ou flexibles ;
- consentement santé ;
- achat réel ou proposition ;
- réservation réelle ou simulation.

## 21.2 Candidats

Le système devrait produire trois variantes :

| Variante | Budget | Effort | Confort | Description |
|---|---:|---:|---:|---|
| Confort | 1 180 € | 62/100 | Élevé | Refuges confortables |
| Équilibrée | 960 € | 71/100 | Moyen | Meilleur compromis |
| Sauvage | 710 € | 79/100 | Faible | Plus autonome |

## 21.3 Sélection

Fonction conceptuelle :

```text
score =
adéquation
+ sécurité
+ qualité
+ fiabilité
+ respect du budget
+ préférences
+ disponibilité
- fatigue
- risques
- incertitude
- complexité
- temps de transport
```

## 21.4 Restitution compacte

```text
Dolomites — 7 jours
Compatibilité : 91 %
Budget : 1 428 €
Difficulté : Modérée à exigeante
Confiance : 86 %
Départ recommandé : 12 septembre
Plan principal prêt à 82 %
3 décisions requises
```

Les détails sont ouverts dans les sections du Hub.

---

# 22. Intégration avec les modules existants

| Module existant | Rôle futur |
|---|---|
| Explorer | Découverte personnalisée |
| Pays | Contexte, réglementation, saisons, risques |
| Voyages | Structure globale |
| Hub | Centre de décision |
| Randonnée | Acquisition terrain et cockpit |
| Matériel | Inventaire, poids, besoins |
| Budget | Coûts et suivi |
| Groupe | Capacités et cohésion |
| Documents | Formalités et réservations |
| Sécurité | Alertes et plans de repli |
| Journal | Retour d’expérience |
| IA | Explication et enrichissement |
| Affiliation | Monétisation |
| Discovery | Activités et offres |
| Stripe | Paiements et abonnements |

## Boucle globale

```text
Explorer
→ Intention
→ AdventurePlan
→ Hub de préparation
→ Cockpit terrain
→ Journal
→ Apprentissage personnel
→ Amélioration collective des segments
→ Meilleures recommandations futures
```

---

# 23. Expérience mobile cible

## 23.1 Règle anti-carrousels

La refonte actuelle est visuellement forte, mais les rails horizontaux ne doivent pas devenir le seul modèle de navigation.

Règles proposées :

```text
1 HeroCard
1 ActionStack
0 ou 1 OptionalRail
3 indicateurs principaux maximum
3 actions prioritaires visibles
1 grille de navigation
contenu exhaustif dans les tiroirs
```

## 23.2 Structure idéale

```text
Hero
→ indicateurs
→ à faire maintenant
→ grille des sections
→ un rail contextuel facultatif
→ détails dans les tiroirs
```

## 23.3 Utilisation correcte des carrousels

À conserver pour :

- jours du voyage ;
- étapes ;
- photos ;
- membres ;
- catégories exploratoires.

À éviter pour :

- alertes critiques ;
- documents expirés ;
- actions urgentes ;
- checklist ;
- navigation principale ;
- décisions à confirmer.

## 23.4 Bento grid

Remplacer une partie des rails par une grille 2 × 2 :

```text
┌────────────────┬────────────────┐
│ Budget         │ Équipement     │
│ 240 € restants │ 3 manquants    │
├────────────────┼────────────────┤
│ Sécurité       │ Groupe         │
│ 1 alerte       │ 4 membres      │
└────────────────┴────────────────┘
```

## 23.5 Alertes Terrain Live

Toujours sous forme de liste verticale :

```text
CRITIQUE — Sentier fermé à 2,1 km
VIGILANCE — Boue confirmée à 800 m
INFO — Point d’eau confirmé il y a 3 h
```

## 23.6 Corrections mobiles déjà identifiées

À vérifier/corriger :

- afficher les libellés visibles du carrousel de sections ;
- corriger les chaînes accentuées du journal ;
- vérifier les labels des boutons de fermeture ;
- augmenter les textes secondaires trop petits ;
- limiter les rails successifs ;
- clarifier « Équipiers », « Groupe » et « Carnet d’équipage » ;
- corriger la présentation du 114.

Concernant les urgences :

- **112** : numéro d’urgence européen ;
- **114** : urgence par SMS, application ou visio pour les personnes sourdes, malentendantes, aphasiques ou ne pouvant pas parler.

Le 114 ne doit pas être présenté simplement comme « secours en montagne ».

---

# 24. Autonomie et contrôle utilisateur

## 24.1 Niveau 1 — Conseiller

Le système propose, l’utilisateur agit.

## 24.2 Niveau 2 — Copilote

Le système peut appliquer automatiquement les changements non critiques :

- recalcul d’un budget ;
- mise à jour météo ;
- ajustement de checklist ;
- téléchargement offline ;
- déplacement d’une tâche.

## 24.3 Niveau 3 — Autopilote encadré

Le système peut exécuter des actions préautorisées :

- réservation remboursable sous un plafond ;
- notification de membres ;
- ajout de matériel à une liste ;
- proposition d’alternative.

Confirmation obligatoire pour :

- paiement définitif ;
- annulation coûteuse ;
- changement d’itinéraire risqué ;
- partage de santé ;
- activation du suivi live ;
- contact des secours ;
- modification touchant tout le groupe.

## 24.4 Journal de décision

Chaque changement automatique doit indiquer :

- ce qui a changé ;
- pourquoi ;
- quelle donnée a déclenché le changement ;
- quel moteur l’a proposé ;
- confiance ;
- impact ;
- possibilité d’annuler.

---

# 25. Modèle économique

## 25.1 Abonnements B2C proposés

### Free

- création de voyages ;
- budget de base ;
- checklist ;
- inventaire limité ;
- cartes en ligne ;
- quelques générations.

### Explorer — 39,99 €/an

- générations complètes ;
- cartes hors ligne ;
- navigation ;
- kit contextuel ;
- alertes basiques ;
- export.

### Expedition — 79,99 €/an

- profil terrain ;
- difficulté personnalisée ;
- ETA live ;
- apprentissage ;
- Terrain Live avancé ;
- multi-jours ;
- surveillance ;
- alternatives.

### Family/Group — 119 à 149 €/an

- jusqu’à six profils ;
- difficulté groupe ;
- partage du matériel ;
- budget commun ;
- suivi de cohésion ;
- sécurité familiale.

Les prix doivent être testés, pas considérés comme définitifs.

---

## 25.2 Pass par voyage

- Weekend : 6,99 € ;
- Voyage : 14,99 € ;
- Expédition : 29,99 €.

Le pass peut inclure :

- génération complète ;
- surveillance jusqu’au départ ;
- cartes hors ligne ;
- alertes ;
- export ;
- copilote live.

Ce modèle est utile pour les utilisateurs qui voyagent peu et refusent un abonnement annuel.

---

## 25.3 Affiliation

Sources potentielles :

- hébergements ;
- activités ;
- transport ;
- assurance ;
- location de véhicule ;
- matériel ;
- eSIM ;
- guides ;
- refuges ;
- location outdoor.

Règle produit :

> Les recommandations doivent rester basées sur l’adéquation réelle. La commission ne doit jamais devenir le facteur de classement principal.

Chaque proposition sponsorisée doit être identifiable.

---

## 25.4 Matériel

Revenus possibles :

- affiliation ;
- marketplace ;
- location ;
- reconditionné ;
- mise en relation ;
- commission sur partage payant ;
- packs de kit ;
- recommandations premium.

Le moteur de kit existant constitue déjà une porte d’entrée directe.

---

## 25.5 B2B

Clients possibles :

- offices de tourisme ;
- parcs ;
- collectivités ;
- refuges ;
- stations ;
- organisateurs ;
- assureurs ;
- guides ;
- marques outdoor ;
- plateformes cartographiques.

Produits B2B :

- tableau des conditions ;
- fréquentation agrégée ;
- difficulté observée ;
- historique des sentiers ;
- alertes ;
- API ETA ;
- API difficulté ;
- API compatibilité matériel ;
- API génération d’aventure ;
- widgets en marque blanche.

---

## 25.6 API commerciale

Exemples :

```text
POST /v1/difficulty/personal
POST /v1/eta
GET  /v1/terrain/segments/{id}
GET  /v1/terrain/conditions
POST /v1/adventures/generate
POST /v1/gear/compatibility
```

Facturation possible :

- par requête ;
- par utilisateur actif ;
- par parcours ;
- par territoire ;
- par abonnement annuel.

---

## 25.7 Marketplace locale

Prestataires :

- guides ;
- refuges ;
- taxis ;
- navettes ;
- loueurs ;
- transporteurs de bagages ;
- réparateurs ;
- magasins ;
- producteurs ;
- activités.

Revenus :

- commission ;
- abonnement professionnel ;
- visibilité ;
- leads qualifiés ;
- réservation.

---

## 25.8 Exemple économique hypothétique

Pour 100 000 utilisateurs actifs :

| Source | Hypothèse |
|---|---:|
| Abonnements | 700–900 k€ |
| Pass voyage | 150–250 k€ |
| Affiliation | 150–300 k€ |
| Matériel | 100–200 k€ |
| B2B/API | 150–400 k€ |
| Total indicatif | 1,25–2,05 M€ |

Il s’agit d’un scénario, pas d’une prévision garantie.

Les variables principales seront :

- conversion ;
- rétention ;
- coût cartographique ;
- coût IA ;
- coût des données ;
- saisonnalité ;
- commissions ;
- coût d’acquisition ;
- support ;
- assurance et responsabilité.

---

# 26. Données, confidentialité et conformité

## 26.1 Données de santé

Les données santé doivent être :

- facultatives ;
- minimisées ;
- séparées ;
- chiffrées ;
- soumises à consentement explicite ;
- révocables ;
- exportables ;
- supprimables ;
- jamais vendues ;
- jamais utilisées pour la publicité ciblée ;
- jamais exposées dans les données collectives.

## 26.2 Consentements séparés

Prévoir des consentements distincts pour :

- import d’activités ;
- sommeil ;
- fréquence cardiaque ;
- HRV ;
- données de localisation ;
- suivi live ;
- amélioration personnelle ;
- amélioration collective ;
- partage groupe ;
- recherche interne.

## 26.3 Calcul local prioritaire

Lorsque possible :

- données brutes santé sur le téléphone ;
- calcul des indicateurs localement ;
- envoi d’un résumé minimal ;
- suppression des séries inutiles ;
- pseudonymisation.

## 26.4 Agrégation collective

N’afficher une donnée collective qu’au-delà d’un seuil suffisant.

Exemple :

- moins de 4 passages : pas de publication ;
- 4 à 14 : confiance faible ;
- 15 à 99 : confiance moyenne ;
- 100 et plus : confiance élevée, si diversité suffisante.

Ces seuils devront être ajustés statistiquement.

## 26.5 AIPD

Une Analyse d’impact relative à la protection des données sera probablement nécessaire en raison de la combinaison :

- données santé ;
- géolocalisation ;
- profilage ;
- apprentissage ;
- prédictions ;
- surveillance ;
- décisions automatisées.

Référence CNIL :

- [Analyse d’impact relative à la protection des données](https://www.cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd)

## 26.6 Positionnement médical

Le produit ne doit pas prétendre :

- diagnostiquer ;
- prévenir une pathologie ;
- garantir la sécurité ;
- remplacer un médecin ;
- remplacer un guide ;
- remplacer les secours.

Formulation recommandée :

> Estimation outdoor personnalisée fondée sur vos activités, les données disponibles et les conditions observées. Elle ne constitue pas un avis médical ni une garantie de sécurité.

---

# 27. Architecture de données cible

## 27.1 Profil personnel

### `user_performance_profiles`

```text
id
user_id
activity_type
model_version
flat_pace
uphill_response
downhill_response
fatigue_curve
pause_model
heat_response
cold_response
altitude_response
pack_response
technical_response
confidence
sample_count
trained_at
valid_until
```

### `user_daily_readiness`

```text
user_id
date
sleep_score
recovery_score
recent_load
resting_hr_delta
hrv_delta
fatigue_declared
pain_declared
readiness_score
confidence
source_summary
```

### `health_consents`

```text
user_id
source
data_category
purpose
granted
granted_at
revoked_at
policy_version
```

---

## 27.2 Segments

### `terrain_segments`

```text
id
geometry
direction
length_m
gain_m
loss_m
mean_grade
max_grade
surface
technical_class
exposure_class
orientation_class
altitude_min
altitude_max
version
```

### `segment_passages`

```text
id
segment_id
user_id_pseudonymous
activity_id
direction
entered_at
exited_at
duration_s
stopped_s
gps_quality
map_match_quality
context_id
eligible_for_collective
```

### `segment_observations`

```text
passage_id
expected_duration_s
observed_duration_s
normalized_slowdown
relative_effort
cadence_change
offroute_count
uturn_detected
fatigue_before
fatigue_after
quality_weight
```

### `segment_aggregates`

```text
segment_id
condition_bucket
direction
passage_count
distinct_user_count
weighted_median_slowdown
effort_score
technical_score
fatigue_score
collective_difficulty
confidence
computed_at
```

---

## 27.3 Terrain Live

### `terrain_reports`

```text
id
segment_id
reporter_id
category
severity
passability
description
photo_url
location
created_at
expires_at
status
source_type
```

### `terrain_report_confirmations`

```text
report_id
user_id
confirmation
location_distance_m
created_at
gps_quality
```

### `terrain_events`

Événement consolidé pouvant fusionner plusieurs signalements proches.

---

## 27.4 Prédictions

### `user_segment_predictions`

```text
user_id
segment_id
context_hash
predicted_duration_p50
predicted_duration_p90
predicted_effort
personal_difficulty
confidence
model_version
computed_at
```

### `route_predictions`

```text
route_id
user_id
group_id
strategy
eta_p50
eta_p90
difficulty
fatigue_peak
turnaround_time
warnings
computed_at
```

---

## 27.5 Plan global

### `adventure_plans`

```text
id
owner_id
intent
status
current_version
created_at
updated_at
```

### `adventure_plan_versions`

```text
plan_id
version
snapshot
reason
generated_by
confidence
created_at
```

### `adventure_decisions`

```text
plan_id
decision_type
proposal
impact
requires_confirmation
status
decided_by
decided_at
```

---

# 28. API et événements métier

## 28.1 APIs principales

```text
POST /api/adventure/intent/parse
POST /api/adventure/generate
POST /api/adventure/recalculate
POST /api/adventure/confirm-decision
GET  /api/adventure/{id}
GET  /api/adventure/{id}/alternatives
```

```text
POST /api/performance/import
POST /api/performance/retrain
GET  /api/performance/profile
GET  /api/performance/readiness
```

```text
POST /api/terrain/passages
GET  /api/terrain/segments/{id}
GET  /api/terrain/conditions
POST /api/terrain/reports
POST /api/terrain/reports/{id}/confirm
```

```text
POST /api/predictions/route
POST /api/predictions/live
POST /api/predictions/group
```

## 28.2 Événements internes

```text
adventure.created
adventure.plan.generated
adventure.plan.recalculated
weather.changed
price.changed
booking.unavailable
trail.report.created
trail.report.confirmed
trail.condition.changed
hike.started
hike.position.recorded
hike.offroute.detected
hike.pace.deviation
hike.completed
performance.profile.updated
gear.inventory.changed
decision.confirmation.required
```

L’architecture événementielle évitera un orchestrateur monolithique.

---

# 29. Roadmap recommandée

## Phase 0 — Consolidation de l’existant

Objectifs :

- vérifier les migrations ;
- vérifier les crons ;
- vérifier les variables ;
- vérifier les fallbacks ;
- documenter les flux ;
- réduire les duplications ;
- figer les contrats des moteurs.

Livrables :

- registre de capacités ;
- statut réel production ;
- journal de décisions ;
- observabilité ;
- tests d’intégration.

---

## Phase 1 — Le miracle visible

Objectif :

> Une phrase produit un plan complet crédible.

À construire :

- orchestrateur V1 ;
- AdventurePlan ;
- trois variantes ;
- provenance ;
- confiance ;
- questions bloquantes ;
- budget ;
- kit ;
- itinéraire ;
- sécurité ;
- documents ;
- résumé compact.

Ne pas intégrer la santé dans cette première version.

---

## Phase 2 — ETA personnalisée sans données santé

Utiliser uniquement :

- GPS ;
- historique d’activités ;
- pente ;
- terrain ;
- pauses ;
- durée ;
- météo ;
- poids du sac ;
- difficulté ressentie.

Livrables :

- profil terrain V1 ;
- allure personnelle ;
- ETA personnelle ;
- difficulté personnelle ;
- apprentissage post-sortie.

Cette phase apporte déjà une forte valeur sans risque santé majeur.

---

## Phase 3 — Segmentation et intelligence collective

Livrables :

- map-matching ;
- segments ;
- passages ;
- observations ;
- agrégats ;
- difficulté collective ;
- confiance ;
- carte colorée.

---

## Phase 4 — Terrain Live V1

Livrables :

- six catégories de signalements ;
- création rapide ;
- confirmation ;
- expiration ;
- affichage ;
- liste verticale ;
- fonctionnement offline ;
- synchronisation.

---

## Phase 5 — Santé et capteurs

Livrables :

- consentements ;
- HealthKit ;
- Health Connect ;
- résumé local ;
- état du jour ;
- readiness ;
- AIPD ;
- audit sécurité.

Commencer avec un périmètre minimal :

- activités ;
- fréquence cardiaque ;
- sommeil ;
- fréquence au repos ;
- HRV si disponible.

---

## Phase 6 — Live personnalisé

Livrables :

- ETA recalculée ;
- fatigue ;
- pause recommandée ;
- heure de demi-tour ;
- dérive de rythme ;
- batterie ;
- réseau ;
- alternatives ;
- alertes vocales/haptiques critiques.

---

## Phase 7 — Trek et groupe

Livrables :

- fatigue multi-jours ;
- récupération ;
- répartition des étapes ;
- allure du groupe ;
- membre limitant ;
- partage du matériel ;
- cohésion.

---

## Phase 8 — Transactions

Livrables :

- abonnements ;
- pass ;
- réservation ;
- affiliation mesurée ;
- annulations ;
- remboursement ;
- règles d’autonomie ;
- commission tracking.

---

## Phase 9 — B2B et API

Livrables :

- API difficulté ;
- API ETA ;
- API conditions ;
- tableaux territoriaux ;
- intégrations partenaires ;
- SLA ;
- facturation.

---

# 30. Backlog priorisé

## P0 — Architecture indispensable

- [ ] Créer `AdventurePlan`.
- [ ] Créer l’orchestrateur.
- [ ] Définir les contrats de sortie des moteurs.
- [ ] Ajouter provenance, fraîcheur et confiance.
- [ ] Versionner chaque plan.
- [ ] Créer un journal de décisions.
- [ ] Distinguer proposition, confirmation et exécution.
- [ ] Remplacer les constantes génériques du copilote.

## P0 — Sécurité et conformité

- [ ] Cartographier les données personnelles.
- [ ] Réaliser l’AIPD.
- [ ] Définir les consentements.
- [ ] Définir la politique de rétention.
- [ ] Séparer santé et données publiques.
- [ ] Vérifier les secrets.
- [ ] Vérifier les politiques RLS.
- [ ] Vérifier les anciennes clés exposées.

## P1 — Valeur personnalisée

- [ ] Profil Terrain V1.
- [ ] Extraction de segments d’activité.
- [ ] Allure plate/montée/descente.
- [ ] Modèle de pauses.
- [ ] ETA personnelle.
- [ ] Difficulté personnelle.
- [ ] Indice de confiance.
- [ ] Feedback post-sortie.

## P1 — Intelligence collective

- [ ] Référentiel de segments.
- [ ] Map-matching.
- [ ] Passage normalisé.
- [ ] Agrégation.
- [ ] Conditions.
- [ ] Carte de difficulté.
- [ ] Anomalies.

## P1 — Terrain Live

- [ ] Signalements.
- [ ] Confirmations.
- [ ] Expiration.
- [ ] Déduplication.
- [ ] Modération.
- [ ] Offline.
- [ ] Notifications d’approche.

## P2 — Santé

- [ ] HealthKit.
- [ ] Health Connect.
- [ ] Garmin.
- [ ] Fitbit.
- [ ] Bluetooth.
- [ ] Readiness.
- [ ] Traitement local.

## P2 — Groupe

- [ ] Profils individuels.
- [ ] Allure collective.
- [ ] Membre limitant.
- [ ] Répartition du matériel.
- [ ] Cohésion live.
- [ ] Alertes de séparation.

## P2 — Économie

- [ ] Plans d’abonnement.
- [ ] Paywall.
- [ ] Pass voyage.
- [ ] Tracking d’affiliation.
- [ ] Dashboard revenu.
- [ ] Marketplace.
- [ ] API B2B.

## P3 — UX mobile

- [ ] Maximum un carrousel par écran.
- [ ] Navigation principale en grille.
- [ ] Alertes verticales.
- [ ] Textes minimum lisibles.
- [ ] Accessibilité à 200 %.
- [ ] Tests plein soleil.
- [ ] Tests faible batterie.
- [ ] Tests hors réseau.
- [ ] Correction des libellés et accents.

---

# 31. Qualité, tests et observabilité

## 31.1 Tests algorithmiques

Tester séparément :

- distance ;
- pente ;
- dénivelé ;
- segmentation ;
- map-matching ;
- allure ;
- fatigue ;
- difficulté ;
- confiance ;
- agrégation ;
- expiration ;
- reroutage ;
- solveur.

## 31.2 Backtesting

Pour chaque activité historique :

1. cacher le résultat réel ;
2. produire une prédiction ;
3. comparer ;
4. mesurer l’erreur ;
5. suivre la dérive du modèle.

Métriques :

- erreur ETA médiane ;
- erreur P90 ;
- calibration des intervalles ;
- erreur par pente ;
- erreur par terrain ;
- erreur par durée ;
- erreur par personne ;
- erreur par météo.

## 31.3 Shadow mode

Avant d’afficher une recommandation santé ou sécurité :

- exécuter le moteur silencieusement ;
- comparer aux résultats ;
- analyser les erreurs ;
- vérifier les faux positifs ;
- vérifier les faux négatifs.

## 31.4 Observabilité

Chaque calcul devrait enregistrer :

- moteur ;
- version ;
- temps ;
- sources ;
- fraîcheur ;
- confiance ;
- fallback ;
- erreur ;
- décision finale.

Ne jamais journaliser inutilement des données santé brutes.

---

# 32. Indicateurs de succès

## Produit

- temps nécessaire pour créer une aventure ;
- pourcentage de plans réellement utilisés ;
- nombre de questions posées ;
- taux de confirmation ;
- satisfaction ;
- rétention ;
- sorties terminées.

## Prédiction

- erreur ETA ;
- erreur difficulté ;
- calibration de confiance ;
- précision des pauses ;
- précision de l’allure ;
- détection d’obstacles ;
- fraîcheur des conditions.

## Sécurité

- alertes utiles ;
- alertes ignorées ;
- faux positifs ;
- faux négatifs ;
- sorties de trace détectées ;
- retards critiques détectés ;
- incidents évités déclarés.

## Terrain Live

- rapports ;
- confirmations ;
- délai de validation ;
- délai de résolution ;
- couverture des segments ;
- taux d’abus ;
- diversité des contributeurs.

## Économie

- conversion Free → Premium ;
- revenu moyen ;
- commission ;
- panier moyen ;
- coût IA ;
- coût cartographique ;
- marge ;
- revenu par voyage ;
- revenu B2B.

---

# 33. Risques principaux

## 33.1 Trop grande ambition simultanée

Le principal risque est de vouloir construire en même temps :

- générateur ;
- santé ;
- cartographie ;
- communauté ;
- réservation ;
- matériel ;
- B2B.

Réponse :

> Construire une boucle de valeur complète à la fois.

Ordre recommandé :

1. plan complet ;
2. ETA personnelle ;
3. segments collectifs ;
4. Terrain Live ;
5. santé ;
6. transactions ;
7. B2B.

## 33.2 Données insuffisantes

Au lancement, peu de passages seront disponibles.

Réponse :

- difficulté objective ;
- modèles génériques ;
- OpenStreetMap ;
- données publiques ;
- partenariats ;
- import d’historique ;
- confiance faible explicite.

## 33.3 Responsabilité sécurité

Une ETA ou une difficulté erronée peut influencer une décision.

Réponse :

- fourchettes ;
- marges conservatrices ;
- confiance ;
- explications ;
- sources ;
- pas de garantie ;
- bouton d’urgence indépendant ;
- alternatives prudentes.

## 33.4 Coût des fournisseurs

Cartes, itinéraires, météo, IA et contenus peuvent devenir coûteux.

Réponse :

- cache ;
- pré-calcul ;
- modèles déterministes ;
- OpenStreetMap ;
- fournisseurs interchangeables ;
- budget par fonctionnalité ;
- observabilité des coûts.

## 33.5 Qualité communautaire

Risques :

- faux signalements ;
- doublons ;
- photos trompeuses ;
- abus ;
- panique ;
- conflits.

Réponse :

- réputation limitée ;
- corroboration ;
- traces ;
- expiration ;
- sources officielles ;
- modération ;
- seuils.

---

# 34. Avantage concurrentiel

Le véritable avantage ne sera pas seulement l’interface ou l’IA conversationnelle.

Il sera constitué par :

- profils personnels calibrés ;
- passages normalisés ;
- difficulté par segment ;
- historique saisonnier ;
- liens météo-difficulté ;
- données terrain récentes ;
- prédictions évaluées ;
- compréhension du groupe ;
- inventaire et matériel ;
- capacité à relier planification et terrain réel.

La boucle défendable est :

```text
Plus d’utilisateurs
→ plus de passages
→ meilleurs segments
→ meilleure difficulté
→ meilleure ETA
→ meilleure expérience
→ plus d’utilisateurs
```

Cette boucle doit toutefois respecter strictement la confidentialité.

---

# 35. Décision stratégique finale

Le Kit du Voyageur dispose déjà d’un socle exceptionnellement large :

- voyage ;
- randonnée ;
- GPS ;
- budget ;
- matériel ;
- groupe ;
- pays ;
- découverte ;
- IA ;
- mobile ;
- affiliation ;
- paiement.

Le projet ne doit pas reconstruire ces briques.

Il doit maintenant les organiser autour de trois éléments centraux :

## 1. `AdventurePlan`

La source de vérité de l’aventure complète.

## 2. `Adventure Orchestrator`

La couche qui coordonne les moteurs et résout les dépendances.

## 3. `Outdoor Intelligence Engine`

La couche qui fusionne :

- profil personnel ;
- terrain ;
- collectif ;
- contexte ;
- temps réel.

Le produit final pourra alors porter la promesse :

> **Le système d’intelligence outdoor qui comprend la personne, apprend de chaque sortie, connaît le terrain et adapte chaque aventure en temps réel.**

Nom recommandé :

# **Adventure Autopilot**

Nom de la couche communautaire :

# **Terrain Live**

Nom du profil :

# **Profil Terrain**

Slogan principal :

# **Une intention. Une aventure complète. Toujours à jour.**

---

# 36. Références

## Dépôt

- [Dépôt GitHub](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810)
- [Commit mobile principal](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/commit/1779502b5237c2f44378855e68f3105912bb2e29)
- [Pipeline d’auto-génération](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/trips/engine/autoGenPipeline.ts)
- [Solveur de cohérence](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/trips/engine/coherenceSolver.ts)
- [Moteur randonnée](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/hiking/engine/HikeEngine.ts)
- [Copilote](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/src/features/hiking/copilot/CopilotEngine.ts)
- [Infrastructure IA](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/lib/ai)
- [Hub universel](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/main/docs/superpowers/specs/2026-09-09-hub-universel-phase1-design.md)
- [Plans techniques](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/docs/superpowers/plans)
- [Spécifications](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/docs/superpowers/specs)
- [Discovery](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/features/discovery)
- [Affiliation](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/main/src/features/affiliation)

## Santé

- [Apple HealthKit](https://developer.apple.com/documentation/healthkit)
- [Apple — Protection des données HealthKit](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [Android Health Connect](https://developer.android.com/health-and-fitness/guides/health-connect)
- [Types de données Health Connect](https://developer.android.com/health-and-fitness/guides/health-connect/plan/data-types)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/)
- [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)

## Confidentialité et droit

- [RGPD — texte officiel](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679)
- [CNIL — AIPD](https://www.cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd)
- [CNIL — AIPD et intelligence artificielle](https://www.cnil.fr/fr/realiser-une-analyse-dimpact-si-necessaire)
- [Directive européenne sur les voyages à forfait](https://eur-lex.europa.eu/eli/dir/2015/2302/oj/fra)

## Urgences

- [Service public — numéros d’urgence](https://www.service-public.fr/particuliers/actualites/A15841)
- [Urgence 114](https://www.info.urgence114.fr/)

---

## Conclusion courte

Le dépôt actuel couvre déjà une part importante de l’interface, de la planification, du matériel, de la randonnée et de l’infrastructure IA.

La vision complète reste cependant à construire autour de trois chantiers prioritaires :

1. **orchestrer réellement toutes les briques existantes** ;
2. **apprendre le profil de performance de chaque utilisateur** ;
3. **transformer les traces collectives en connaissance vivante du terrain**.

C’est cette fusion — et non un simple chatbot — qui pourra faire du Kit du Voyageur un système outdoor véritablement unique.