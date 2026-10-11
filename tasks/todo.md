# LKDV — Tâches exécutables de Progression 2.0

**48 tâches planifiées, aucune cochée comme implémentée par cette mission.** Dépendances entre IDs ; toutes les tâches ont 3 critères maximum. Les chemins « nouveau » sont des cibles proposées, les autres ont été observés dans le dépôt, sauf cible explicitement à identifier. Les migrations sont créées par CLI après découverte de --help ; ne pas inventer un timestamp de migration. Si une tâche dépasse une session ou cinq fichiers, la scinder avant exécution en sous-tâches portant son ID parent.

Le contrat et les migrations partagés sont séquentiels. Ce tableau ne crée pas d’issues ou de demandes de revue externes. Le point de contrôle prépare un résultat concret pour revue ; le mandat d’autonomie déjà donné n’exige pas une nouvelle permission pour chaque tranche.

## P0 — Stabilisation

### T01 — Figer l’état et vérifier la restauration

Consigner le commit et les migrations réellement déployées, reprendre les sauvegardes existantes et restaurer les tables de points sur une base isolée.

**Critères d’acceptation**

- [ ] Relevé initial daté et provenance de chaque compteur.
- [ ] Restauration isolée contrôlée par comparaison des soldes et journaux.
- [ ] Aucune écriture en production pendant les sondes.

**Vérification :** Contrôle de restauration et comparaison SQL ; ne pas qualifier ce contrôle de suite applicative.

**Dépendances :** Aucune. **Portée :** M (3 cibles, 1–5 fichiers usuels).

**Fichiers :** docs/phase1/RAPPORT-DEPLOIEMENT-INCR1.md ; scripts/ops/phase1_prod_audit.mjs ; evidence de restauration (nouveau).

### T02 — Isoler les données de démonstration

Poursuivre l’incrément 2 de stabilisation : provenance, snapshot, flag demo, exclusion des classements et reconstruction canonique sans émission de nouveaux points.

**Critères d’acceptation**

- [ ] Les 15 transactions du seed restent traçables et ne sont pas recréditées.
- [ ] is_demo exclut les agrégats et la masse critique réelle.
- [ ] Rapport avant/après : aucun autre solde modifié.

**Vérification :** pgTAP rebuild et exclusion sur base isolée ; sondes de réconciliation après simulation du retour arrière.

**Dépendances :** T01. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** scripts/seed/seed_ultra_demo.mjs ; scripts/audit/phase1_demo_and_projection_scan.mjs (nouveau) ; migration additive via CLI (nouveau) ; supabase/tests/database/progression_canonique_rebuild.test.sql ; tests SQL d’exclusion demo (nouveau).

### T03 — Vérifier les parcours de fidélité protégés

Confirmer les guards, routes et statuts de paiement réels. Consigner tout écart entre code main et déploiement ainsi que les cas commande virement non encaissée.

**Critères d’acceptation**

- [ ] Changement normal de profil fonctionne ; modification points/XP/niveau refusée.
- [ ] Forge orders, écritures de journal et RPC client interdites.
- [ ] Un paiement non encaissé est identifié et exclu de l’émission commerciale future.

**Vérification :** Tests phase1 existants, sondes de routes authentifiées en préproduction et scénarios d’annulation.

**Dépendances :** T01. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/loyalty/server.ts ; src/features/checkout/serverPricing.ts ; supabase/tests/database/phase1_balance_lockdown.test.sql ; tests/phase1/loyalty-validation.spec.ts ; doc de sondes (nouveau).

**Point de contrôle après T03**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T04 — Observer les traitements de progression

Planifier les consumers SQL via le pg_cron installé, avec rôles de job, lots bornés et contrôles. Vérifier l’appel HTTP si un worker TS est retenu.

**Critères d’acceptation**

- [ ] Exécution du lot observée et nom/schedule/version documentés.
- [ ] Panne simulée détectée, reprise ne doublant aucun événement.
- [ ] Outbox dead ou retard >15 min remontent un état dégradé.

**Vérification :** Tests cron ciblés ; exécution et interruption sur environnement isolé ; vérifier les grants du rôle de job.

**Dépendances :** T01,T02,T03. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** scripts/ops/progression_outbox_health.mjs ; src/app/api/cron/progression-outbox/route.ts ; docs/progression/OPERATIONS.md ; migration de jobs via CLI (nouveau) ; tests/features/progression/progressionOutboxCron.spec.ts.

**Point de contrôle après T04**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P1 — Visibilité et attribution fiable

### T05 — Geler le contrat économique v2

Introduire schéma des règles, date d’effet, familles, poids, caps et scopes ; conserver seuils, clés anciennes et interprétation des types.

**Critères d’acceptation**

- [ ] Registre validé côté serveur et montants/poids bornés.
- [ ] Version applicable définie par date métier, sans recrédit historique.
- [ ] Aucune conversion XP/valeur commerciale et aucun pouvoir attribué par niveau.

**Vérification :** Tests DTO/règles ciblés et validation du registre JSON ; comparaison des dix seuils.

**Dépendances :** T04. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/domain/types.ts ; src/features/progression/domain/rules.ts ; src/features/progression/server/progressionDto.ts ; tests/features/progression/canonicalDto.spec.ts ; docs/progression/2.0/economie.md (nouveau).

### T06 — Écrire une intention durable avec la source

Créer progression_award_intents et relier les transitions finales des sept sources à une insertion atomique ; la demande client reste un accélérateur facultatif.

**Critères d’acceptation**

- [ ] Une transaction métier finalisée produit une intention durable unique.
- [ ] Une panne après commit de source conserve l’intention.
- [ ] Un producteur non éligible ou non finalisé n’écrit pas un gain.

**Vérification :** Tests de coupure entre source et appel ; pgTAP atomicité/rollback et unicité.

**Dépendances :** T05. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** migration intentions via CLI (nouveau) ; src/lib/progression-award-requests.ts ; src/features/progression/server/producerHooks.ts ; supabase/tests/database/intent_source_atomicity.test.sql (nouveau) ; tests/features/progression/intentFallback.spec.ts (nouveau).

### T07 — Consommer et reprendre les intentions

Créer traitement borné, contrôle de preuve, retry d’infrastructure, état pending/dead et planification autorisée ; réutiliser l’attribution existante.

**Critères d’acceptation**

- [ ] Intention consommée une seule fois malgré redémarrage de worker.
- [ ] Erreur temporaire ne devient pas un refus métier définitif.
- [ ] Faits et barème sont relus par le serveur, sans confiance dans payload client.

**Vérification :** Scénarios worker arrêté, doublon de lot, source manquante et récupération du backlog.

**Dépendances :** T06. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/intentConsumer.ts (nouveau) ; src/features/progression/server/awardProducer.ts ; src/app/api/cron/progression-awards/route.ts (nouveau) ; tests/features/progression/intentConsumer.spec.ts (nouveau) ; docs/progression/OPERATIONS.md.

**Point de contrôle après T07**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T08 — Appliquer les plafonds sous concurrence

Étendre award_progression_gain avec progression_claims, versions à date d’effet et caps par date métier ; retrouver la décision idempotente avant les quotas. Une décision peut réserver le fait principal, son bonus de nouveauté et plusieurs médias dans une seule transaction.

**Critères d’acceptation**

- [ ] Deux sources à la dernière place du quota ne gagnent pas toutes les deux ; variantes partagent cap_group et réservations annulées en cas d’échec.
- [ ] Replay restitue le succès passé même si la semaine est désormais plafonnée.
- [ ] Répartition TS/SQL identique ; frontières et dates futures contrôlées.

**Vérification :** Deux transactions concurrentes réelles sur base isolée ; pgTAP frontières de dates, plus fort reste et quotas.

**Dépendances :** T05,T07. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** migration attribution v2 via CLI (nouveau) ; src/features/progression/domain/rules.ts ; src/features/progression/server/awardProducer.ts ; supabase/tests/database/progression_canonique_award.test.sql ; tests/features/progression/awardProducer.spec.ts.

### T09 — Renforcer les sept preuves existantes

Réviser préparation, checklist, activité, débrief, avis, carnet et itinérance ; attendre finalisation et distinguer preuve de terrain de case cochée.

**Critères d’acceptation**

- [ ] Création vide, un item libre coché, POI déclaré seul et carnet orphelin refusent.
- [ ] Durée active/novelty et débrief final suivent exactement l’économie publiée.
- [ ] Les sept producteurs ont gain nominal, replay et refus testés.

**Vérification :** Tests ciblés des sept producteurs et intégration réelle source→intention→transaction→projection.

**Dépendances :** T08. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/producerHooks.ts ; src/features/progression/server/awardProducer.ts ; tests/features/progression/producerHooks.spec.ts ; tests/features/progression/producerHooksCompletion.spec.ts ; docs/progression/PRODUCER_MATRIX.md.

### T10 — Afficher une progression compacte fiable

Mutualiser une query privée par utilisateur et adapter la carte existante aux états vide, en attente et indisponible ; un objectif lisible remplace l’absence silencieuse.

**Critères d’acceptation**

- [ ] Carte visible au premier usage, même avec 0 XP.
- [ ] Erreur distincte d’un solde à zéro, action réessayer fonctionnelle.
- [ ] Cache isolé par compte et invalidé après gain/déconnexion.

**Vérification :** Parcours deux comptes successifs, réseau interrompu puis rétabli et cache périmé.

**Dépendances :** T05,T09. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/components/progression/ProgressionCompactCard.tsx ; src/features/progression/server/progressionService.ts ; src/features/progression/hooks/useProgression.ts (nouveau) ; tests/features/progression/compactCard.spec.tsx (nouveau).

**Point de contrôle après T10**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T11 — Ouvrir le bilan et l’historique dans la sheet

Étendre MaProgressionView et fournir historique paginé et détail des gains ; un résolveur d’ouverture relie Hub/Compte et anciens deep-links.

**Critères d’acceptation**

- [ ] Une action confirmée affiche le bon gain et sa répartition ; pending ne célèbre pas.
- [ ] Historique affiche source, date métier, version et correction.
- [ ] Sheet s’ouvre sans voyage actif et retourne au module d’origine sans sixième tab.

**Vérification :** E2E préparation→activité→gain→historique ; deep-links et focus clavier.

**Dépendances :** T10. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/components/progression/MaProgressionView.tsx ; src/app/api/progression/history/route.ts (nouveau) ; src/features/progression/server/progressionService.ts ; src/features/progression/ProgressionSheetProvider.tsx (nouveau) ; tests/features/progression/sheetFlow.spec.tsx (nouveau).

**Point de contrôle après T11**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P2 — Missions et distinctions

### T12 — Versionner le catalogue de missions

Réutiliser progression_challenges, dédupliquer les défis historiques et ne publier que des modèles dont les actions sources sont disponibles.

**Critères d’acceptation**

- [ ] Chaque mission expose critères, période, provenance et version.
- [ ] Les huit catégories du brief ont un modèle ou une dépendance fermée explicite.
- [ ] Pas de promesse de gain d’un producteur désactivé.

**Vérification :** Validation du catalogue et comparaison avec actions réellement activables.

**Dépendances :** T11. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/domain/missionCatalog.ts (nouveau) ; migration catalogue via CLI (nouveau) ; tests/features/progression/missionCatalog.spec.ts (nouveau) ; docs/progression/2.0/missions.md (nouveau).

### T13 — Permettre trois missions choisies

Créer assignations et endpoints de choix/remplacement/abandon, avec migration compatible de current_challenge_id.

**Critères d’acceptation**

- [ ] Maximum 3 missions actives et choix utilisateur mémorisé.
- [ ] Remplacement/abandon sans perte d’XP ni dette.
- [ ] Aucune lecture ou affectation de mission d’un autre compte.

**Vérification :** Tests limite 3, permission inter-comptes et remplacement de mission legacy.

**Dépendances :** T12. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** migration assignations via CLI (nouveau) ; src/features/progression/server/challengeService.ts ; src/app/api/progression/missions/route.ts (nouveau) ; src/components/progression/MaProgressionView.tsx ; tests/features/progression/missionAssignments.spec.ts (nouveau).

### T14 — Dériver l’avancement depuis les événements

Compter des réalisations sources distinctes dans les assignations, afficher le gain restant estimé et terminer sans récompense récursive.

**Critères d’acceptation**

- [ ] Même événement avancera plusieurs vues mais ne créera qu’un gain.
- [ ] Cible multi-activités compte des IDs métier distincts.
- [ ] Fin de mission n’ajoute aucun PROGRESSION_AWARD.

**Vérification :** Rejeu d’événements et clôture de mission ; exactitude après correction d’un fait.

**Dépendances :** T13. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/missionProjection.ts (nouveau) ; src/features/progression/server/progressionDto.ts ; src/components/progression/MaProgressionView.tsx ; supabase/tests/database/mission_projection.test.sql (nouveau).

**Point de contrôle après T14**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T15 — Unifier les distinctions

Dédupliquer les badges, conserver leurs propriétaires et publier conditions et jalons de compétences, sans recompense en boucle.

**Critères d’acceptation**

- [ ] Badge acquis conservé malgré fusion de ses définitions.
- [ ] Conditions versionnées et déblocage idempotent.
- [ ] Badge et niveau ne donnent ni points supplémentaires ni permission admin.

**Vérification :** Fixtures de badges doublonnés, replay de conditions et contrôle des autorisations.

**Dépendances :** T14. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** migration badges via CLI (nouveau) ; src/components/compte/BadgesCard.tsx ; src/features/progression/server/distinctions.ts (nouveau) ; tests/features/progression/distinctions.spec.ts (nouveau).

### T16 — Proposer un rythme choisi

Ajouter objectif hebdomadaire et pause, affichés dans la sheet, indépendants du niveau permanent et des soldes.

**Critères d’acceptation**

- [ ] Pause et reprise préservent XP et mission de projet.
- [ ] Aucune obligation quotidienne ou pénalité de série.
- [ ] Texte neutre et préférence modifiable sans diagnostic.

**Vérification :** Tests semaine avec pause/reprise, utilisateur peu actif et changement de fuseau.

**Dépendances :** T14. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/domain/rhythm.ts (nouveau) ; src/components/progression/MaProgressionView.tsx ; src/app/api/progression/preferences/route.ts (nouveau) ; tests/features/progression/rhythm.spec.ts (nouveau).

### T17 — Suggérer des missions dans un catalogue fermé

Créer sélection déterministe puis IA facultative sur modèles disponibles ; l’IA classe des choix et ne fournit aucune preuve ni montant.

**Critères d’acceptation**

- [ ] Suggestion valide sans fournisseur IA disponible.
- [ ] Montants et éligibilité toujours issus du serveur.
- [ ] Préférences privées seulement, texte malveillant sans effet sur attribution.

**Vérification :** Panne IA, modèle hors catalogue et injection dans description de mission.

**Dépendances :** T12,T13,T16. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/missionSuggestions.ts (nouveau) ; src/features/progression/domain/missionCatalog.ts (nouveau) ; src/app/api/progression/suggestions/route.ts (nouveau) ; tests/features/progression/missionSuggestions.spec.ts (nouveau).

**Point de contrôle après T17**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P3 — Passeport, carte et matériel

### T18 — Enregistrer les découvertes géographiques

Dériver les entités canoniques depuis une preuve contrôlée, avec découverte réelle/déclarée/virtuelle distincte et références minimales.

**Critères d’acceptation**

- [ ] Pays/région/massif rattachés à une réalisation contrôlée.
- [ ] Aucune XP pour l’ajout de vues géographiques.
- [ ] Déclaration ou expédition virtuelle ne devient pas visite réelle.

**Vérification :** Même événement plusieurs territoires, frontière géographique et GPX importé seul.

**Dépendances :** T09,T14. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** migration discoveries via CLI (nouveau) ; src/features/progression/server/discoveries.ts (nouveau) ; src/features/progression/server/progressionDto.ts ; tests/features/progression/discoveries.spec.ts (nouveau).

### T19 — Afficher le passeport privé

Créer section de souvenirs datés avec preuve et réglage de visibilité, par chargement différé de la sheet.

**Critères d’acceptation**

- [ ] Tampons datés, provenance et visibilité lisibles.
- [ ] Pas de trace ni document d’identité exposé.
- [ ] Vue légère et export/suppression pris en charge.

**Vérification :** Parcours passeport réel/déclaré/virtuel, profil privé et session tierce.

**Dépendances :** T18. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/components/progression/PassportSection.tsx (nouveau) ; src/components/progression/MaProgressionView.tsx ; src/app/api/progression/passport/route.ts (nouveau) ; tests/features/progression/passport.spec.tsx (nouveau).

### T20 — Superposer les découvertes à la carte actuelle

Ajouter une couche personnelle utilisant les IDs territoriaux et la cartographie présente ; aucun stockage mondial de routes supplémentaire.

**Critères d’acceptation**

- [ ] Une visite ponctuelle ne révèle pas une région entièrement parcourue.
- [ ] Aucune coordonnée exacte dans la vue publique.
- [ ] Chargement différé et requêtes bornées, mémoire mobile contrôlée.

**Vérification :** Carte mobile, lieux sensibles et volume de découvertes important sur données synthétiques.

**Dépendances :** T18,T19. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/components/DiscoveryMapLayer.tsx (nouveau) ; src/features/progression/server/discoveries.ts (nouveau) ; src/app/api/progression/discoveries/route.ts (nouveau) ; tests/features/progression/discoveryMap.spec.ts (nouveau).

**Point de contrôle après T20**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T21 — Adapter les activités hors randonnée

Introduire une preuve équivalente pour vélo/urbain/autres et clé activité commune ; publier critères avant activation de chaque mode.

**Critères d’acceptation**

- [ ] Même activité multitag ne donne qu’un gain.
- [ ] Durée ou objectif adapté sont contrôlés côté serveur.
- [ ] Aucun gain pour catégorie de pratique ou import seul.

**Vérification :** Adaptateur nominal, catégorie multiple, trace dupliquée et objectif adapté.

**Dépendances :** T09,T18. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/activityAdapters.ts (nouveau) ; src/features/progression/server/awardProducer.ts ; src/features/progression/server/producerHooks.ts ; tests/features/progression/activityAdapters.spec.ts (nouveau).

### T22 — Reconnaître une préparation Compas pertinente

Activer préparation sans sentier et module d’apprentissage éditorial validé ; exclure la préparation de sentier déjà payée pour la même aventure.

**Critères d’acceptation**

- [ ] Création vide de voyage et vérification purement cliente donnent 0.
- [ ] Claim préparation partagé entre sentier et Compas.
- [ ] Évaluation d’apprentissage serveur, une fois par module substantiel.

**Vérification :** Préparation réelle, toggle factice, double adaptateur et exercice répété.

**Dépendances :** T09,T17,T21. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/producerHooks.ts ; src/features/progression/domain/missionCatalog.ts (nouveau) ; src/features/progression/server/preparationProof.ts (nouveau) ; tests/features/progression/preparationProof.spec.ts (nouveau).

### T23 — Reconnaître une amélioration de kit éprouvée

Comparer versions persistées au retour terrain et confirmer un problème résolu ; partager le kit éprouvé avec un contenu utile.

**Critères d’acceptation**

- [ ] Achat/prix/poids seul ne rapportent pas d’XP.
- [ ] Version inverse, auto-fork et même problème déjà payé exclus.
- [ ] Sécurité et pertinence du kit conservées.

**Vérification :** Diff pertinent, retrait d’essentiel, boucle de versions et partage sans terrain.

**Dépendances :** T09,T22. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/kitImprovementProof.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; src/features/progression/domain/missionCatalog.ts (nouveau) ; tests/features/progression/kitImprovement.spec.ts (nouveau).

**Point de contrôle après T23**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P4 — Contributions utiles

### T24 — Valider les corrections utiles

Brancher la modération des rapports de lieux/sentiers et d’accessibilité sur une acceptation indépendante et un delta précis.

**Critères d’acceptation**

- [ ] Rapport pending reste sans gain.
- [ ] Correction et accessibilité du même problème ont une claim unique.
- [ ] Raison de refus et recours visibles.

**Vérification :** Rapport utile, doublon de problème, auto-validation et correction rejetée.

**Dépendances :** T08,T18. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/contributionValidation.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; migration de validations via CLI (nouveau) ; tests/features/progression/reportAcceptance.spec.ts (nouveau).

### T25 — Activer les réponses acceptées

Réutiliser les tables Q&A avec validation du demandeur, réponse utile et contrôle des pairs, puis attribution serveur.

**Critères d’acceptation**

- [ ] Demandeur et répondant distincts ; une récompense par question.
- [ ] Auto-réponse ou vote seul ne valide pas le gain.
- [ ] Désaccord et correction ont une trace et un recours.

**Vérification :** Question réelle, auto-acceptation, deux réponses et motif de collusion.

**Dépendances :** T24. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/answerProof.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; src/app/api/progression/answers/accept/route.ts (nouveau) ; tests/features/progression/answerAcceptance.spec.ts (nouveau).

### T26 — Dédupliquer les médias récompensés

Calculer empreinte d’un média original et rattachement au lieu/activité ; une même photo incluse dans un carnet ne donne pas une seconde récompense.

**Critères d’acceptation**

- [ ] Édition/ré-upload exact ou dérivé évident ne recréditent pas le même apport.
- [ ] Média utile et preuve de visite qualifiés.
- [ ] Consentements et localisation sensible contrôlés.

**Vérification :** Carnet puis lieu, lieu puis carnet, copies et export sans coordonnées.

**Dépendances :** T24. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/mediaClaim.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; src/features/progression/server/contributionValidation.ts (nouveau) ; tests/features/progression/mediaClaim.spec.ts (nouveau).

**Point de contrôle après T26**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T27 — Valider les contributions éditoriales

Publier protocole commun de révision et d’acceptation pour guides et traductions ; les adaptateurs restent petits et partagent le même contrôle de provenance.

**Critères d’acceptation**

- [ ] Révision utile, licence et langue cible vérifiées.
- [ ] Copie de carnet ou texte IA brut ne gagne rien.
- [ ] Version éditoriale identifiable et gain unique.

**Vérification :** Delta accepté, traduction répétée, copie et licence incompatible.

**Dépendances :** T24,T26. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/editorialProof.ts (nouveau) ; src/features/progression/server/contributionValidation.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; tests/features/progression/editorialProof.spec.ts (nouveau).

### T28 — Valider les traces contributives

Accepter une trace nouvelle issue d’une réalisation contrôlée et dont la contribution aux données est utile ; conserver la licence et les zones sensibles.

**Critères d’acceptation**

- [ ] Import GPX seul ne constitue pas une réalisation.
- [ ] Même trace ou révision déjà incluse dans un guide ne recrédite pas son apport.
- [ ] Trace publique expurgée des données personnelles requises.

**Vérification :** Trace authentifiée, trace clone, version inutile et géométrie sensible.

**Dépendances :** T21,T24,T27. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/traceProof.ts (nouveau) ; src/features/progression/server/contributionValidation.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; tests/features/progression/traceContribution.spec.ts (nouveau).

### T29 — Reconnaître l’usage matériel et la contribution locale

Faire qualifier l’avis matériel distinct du débrief ; montrer dans la sheet la nature des contributions acceptées par région/pratique, sans rôle professionnel.

**Critères d’acceptation**

- [ ] Équipement emprunté et possédé traités également.
- [ ] Avis recopié du même débrief ne double pas le gain.
- [ ] Reconnaissance locale descriptive, sans pouvoir ou certification.

**Vérification :** Avis terrain, avis d’achat seul, kit étranger et profil privé.

**Dépendances :** T23,T25,T28. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/gearReviewProof.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; src/components/progression/MaProgressionView.tsx ; tests/features/progression/gearReview.spec.ts (nouveau).

**Point de contrôle après T29**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P5 — Coopération et ligues

### T30 — Confirmer la tenue d’une sortie collective

Associer participants vérifiés, organisateur désigné et événement réalisé ; présence consentie sans publication de positions.

**Critères d’acceptation**

- [ ] Une simple inscription ou auto-check-in ne donne aucun gain.
- [ ] Au moins trois autres participants vérifiés pour le gain organisateur.
- [ ] Activité déjà payée ne se double pas comme participation.

**Vérification :** Événement annulé, participants absents, présence réelle et plusieurs organisateurs.

**Dépendances :** T21,T24. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/groupPresenceProof.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; migration présence/organisateur via CLI (nouveau) ; tests/features/progression/groupPresence.spec.ts (nouveau).

### T31 — Confirmer les tâches collectives

Ajouter confirmation indépendante aux tâches du catalogue et suivre la contribution collective ; exclure tâches minimales créées pour farmer.

**Critères d’acceptation**

- [ ] Confirmateur distinct du responsable.
- [ ] Même service déjà crédité comme organisation ne double pas le gain.
- [ ] Quitter un groupe ne retire pas un gain légitime.

**Vérification :** Auto-confirmation, tâche copiée/split et réalisation utile.

**Dépendances :** T30. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/tribu/actions/taskTemplates.ts ; src/features/progression/server/groupTaskProof.ts (nouveau) ; migration confirmation de tâche via CLI (nouveau) ; tests/features/progression/groupTaskProof.spec.ts (nouveau).

### T32 — Confirmer le cycle d’un prêt réel

Renseigner emprunteur, dates et confirmations de retour ; attribuer à chaque partie une fois avec restrictions de pair/objet.

**Critères d’acceptation**

- [ ] Prêteur et emprunteur distincts, prêt d’au moins 24 heures.
- [ ] Deux confirmations avant attribution ; un gain par rôle et prêt.
- [ ] Objet/paire ne réémettent pas de points avant 90 jours.

**Vérification :** Retour unilatéral, prêt à soi, boucle de prêts et double retry.

**Dépendances :** T31. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/materiel/actions/createLoan.ts ; src/features/materiel/actions/updateLoanStatus.ts ; src/features/progression/server/loanProof.ts (nouveau) ; migration de confirmations de prêt via CLI (nouveau) ; tests/features/progression/loanProof.spec.ts (nouveau).

**Point de contrôle après T32**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T33 — Valider une intervention sur le matériel

Enregistrer intervention et confirmation proportionnée pour entretien/réparation, avec exclusivité du même acte et respect des objets.

**Critères d’acceptation**

- [ ] Alerte simplement résolue sans intervention ne rapporte rien.
- [ ] Entretien et réparation du même acte ne se cumulent pas.
- [ ] Pas de justificatif d’achat obligatoire ni certification automatique de sécurité.

**Vérification :** Intervention confirmée, image seule, auto-confirmation et cycle avant 90 jours.

**Dépendances :** T23,T32. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/interventionProof.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; migration interventions via CLI (nouveau) ; tests/features/progression/interventionProof.spec.ts (nouveau).

### T34 — Valider les actions collectives encadrées

Réutiliser un protocole de confirmation pour accompagnement et environnement ; fournir adaptateur d’observation naturaliste seulement avec validation éditoriale.

**Critères d’acceptation**

- [ ] Accompagnement consenti confirmé par parties distinctes, fréquence par paire contrôlée.
- [ ] Action environnementale tenue et encadrée sans exposition d’un lieu fragile.
- [ ] Observation IA seule n’est pas une contribution validée.

**Vérification :** Organisateur absent, accompagnement répété, observation non validée et lieu protégé.

**Dépendances :** T24,T30,T33. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/collectiveProof.ts (nouveau) ; src/features/progression/server/contributionValidation.ts (nouveau) ; src/features/progression/server/producerHooks.ts ; tests/features/progression/collectiveProof.spec.ts (nouveau).

### T35 — Publier des classements volontaires

Déployer amis/clubs puis périmètres administratifs avec saison, consentement, participants réels et contrôle de confidentialité ; conserver 1 km fermé.

**Critères d’acceptation**

- [ ] Opt-out distinct du profil privé et suppression effective du classement.
- [ ] Agrégats sans démos, coords ou données de preuve.
- [ ] Aucun élargissement silencieux ni rang inventé si service indisponible.

**Vérification :** Énumération/triangulation synthétique, opt-out, faible population et cache inter-comptes.

**Dépendances :** T02,T30,T34. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/progressionService.ts ; src/features/progression/domain/leaderboard.ts ; src/app/api/progression/leaderboard/route.ts ; supabase/tests/database/progression_leaderboard_adversarial.test.sql ; tests/features/progression/leaderboardOptin.spec.ts (nouveau).

**Point de contrôle après T35**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T36 — Créer des ligues sur population suffisante

Former cohortes gelées pour la saison, minimum vingt éligibles, règles publiées et distinction sans gain de victoire.

**Critères d’acceptation**

- [ ] Aucune ligue à population insuffisante ou composée de démos.
- [ ] Appariement et règles d’égalité stables sur la période.
- [ ] Promotion ne change ni XP permanents ni permissions.

**Vérification :** Population faible, entrée tardive, égalité et preuve corrigée après gel.

**Dépendances :** T35. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/domain/leagues.ts (nouveau) ; migration de cohortes via CLI (nouveau) ; src/features/progression/server/leagueService.ts (nouveau) ; src/components/progression/MaProgressionView.tsx ; tests/features/progression/leagues.spec.ts (nouveau).

**Point de contrôle après T36**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P6 — Avantages financés

### T37 — Inventorier les droits commerciaux

Cartographier chaque solde/catalogue et source, dédupliquer les offres sans retirer d’association historique et chiffrer réserve/marge.

**Critères d’acceptation**

- [ ] Fidélité, parts et crédit boutique distingués, aucune conversion automatique.
- [ ] Les droits anciens ont un mapping et une règle de continuité.
- [ ] Budget, base du pool et conditions connus ou activation laissée fermée avec motif précis.

**Vérification :** Rapport agrégé des droits et scénarios de coût ; revue de cohérence des conditions.

**Dépendances :** T03,T29. **Portée :** M (3 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/loyalty/server.ts ; docs/progression/2.0/droits-et-couts.md (nouveau) ; scripts/audit/economic_entitlements_scan.mjs (nouveau).

### T38 — Émettre la fidélité sur encaissement réel

Rendre paiement et base marchandises autoritaires, avec traitement des événements dupliqués, désordonnés et remboursements partiels.

**Critères d’acceptation**

- [ ] 10 crédits par euro marchandises effectivement payé, hors livraison/remises.
- [ ] Virement non encaissé ne produit pas de nouveau crédit.
- [ ] Webhook répété et remboursement partiel conservent l’exactitude des journaux.

**Vérification :** Paiement async, refund partiel, ordre inversé, replay et comparaison avec réserve.

**Dépendances :** T37. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/loyalty/server.ts ; src/features/checkout/serverPricing.ts ; migration émission loyalty via CLI (nouveau) ; tests/phase1/loyalty-payment-lifecycle.spec.ts (nouveau) ; supabase/tests/database/loyalty_payment_lifecycle.test.sql (nouveau).

### T39 — Valoriser les bons côté serveur

Publier catalogue nouveau si financé, appliquer limites panier/marge et ne débiter que l’avantage consommé ; décrire restitution si paiement échoue.

**Critères d’acceptation**

- [ ] Le client ne détermine ni prix, coût de récompense ni réduction autoritaire.
- [ ] Débit limité à la réduction appliquée, reste conservé.
- [ ] Panier modifié, paiement raté et bonus déjà utilisé ont une règle de remboursement traçable.

**Vérification :** Quantité/prix manipulés, faible marge, livraison, double dépense et retour partiel.

**Dépendances :** T38. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/loyalty/server.ts ; src/features/loyalty/validation.ts ; src/features/checkout/serverPricing.ts ; tests/phase1/loyalty-redemption-value.spec.ts (nouveau) ; migration catalogue/debits via CLI (nouveau).

**Point de contrôle après T39**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T40 — Distribuer des parts sur un pool financé

Réutiliser Reward Engine pour contributions qualifiées, caps 50/semaine et 200/période, gel et répartition en centimes.

**Critères d’acceptation**

- [ ] Like/message futurs ne produisent plus de nouvelle part.
- [ ] Pool effectivement financé ; total distribué ne le dépasse pas.
- [ ] Périodes anciennes clôturées et droits légitimes préservés.

**Vérification :** Pool nul, marge négative, collusion, clôture rejouée et arrondis résiduels.

**Dépendances :** T25,T27,T28,T37. **Portée :** M (5 cibles, 1–5 fichiers usuels).

**Fichiers :** src/app/api/rewards/claim/route.ts ; src/app/api/admin/rewards/route.ts ; migration règles économiques via CLI (nouveau) ; tests/features/progression/fundedPool.spec.ts (nouveau) ; supabase/tests/database/funded_pool.test.sql (nouveau).

### T41 — Présenter les crédits de lignée existants

Conserver royalties et store_credit_ledger, distinguer montant provisoire/confirmé et afficher les conséquences de retours.

**Critères d’acceptation**

- [ ] Configuration existante respectée pour droits historiques.
- [ ] Attribution de vente contrôlée, remise/refund appliqués une fois.
- [ ] Aucune XP produite par la commission ou sa consommation.

**Vérification :** Vente attribuée, auto-fork, retour partiel, crédit en attente et confirmed.

**Dépendances :** T37,T38. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/kits/royalty.ts ; src/features/loyalty/server.ts ; src/components/progression/AdvantagesSection.tsx (nouveau) ; tests/features/progression/creatorCreditView.spec.ts (nouveau).

### T42 — Administrer les règles avec prévisualisation

Ajouter écran de simulation versionnée, publication journalisée, coupe-circuit par producteur et revue des anomalies, sans édition opaque des soldes.

**Critères d’acceptation**

- [ ] Rôle admin vérifié côté serveur, jamais user_metadata.
- [ ] Prévisualisation estime XP/refus/coûts sans aucune écriture de solde.
- [ ] Activation de version et arrêt d’émission tracés sans supprimer les droits.

**Vérification :** Utilisateur ordinaire, version invalide, publication concurrente et simulation sans mutation.

**Dépendances :** T39,T40,T41. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/app/api/admin/rewards/route.ts ; src/features/progression/server/rulePublication.ts (nouveau) ; src/features/progression/components/RuleSimulator.tsx (nouveau) ; tests/features/progression/rulePublication.spec.ts (nouveau).

**Point de contrôle après T42**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## P7 — Validation et déploiement

### T43 — Vérifier les parcours mobiles réels

Tester gestes, gains, bilan, deep-links, veille et réseau sur web mobile et Capacitor ; valider lecteurs d’écran et réduction de mouvement.

**Critères d’acceptation**

- [ ] Capture des quatre formats cibles et aucun overlay bloquant la navigation.
- [ ] Focus/safe-area/texte agrandi corrects, retour à la source.
- [ ] Pas de faux gain à la reprise d’un worker ou d’un réseau.

**Vérification :** npm run test:e2e:mobile ; npm run test:e2e:webkit ; npm run test:a11y ; VoiceOver/TalkBack manuels.

**Dépendances :** T11,T19,T36,T42. **Portée :** M (3 cibles, 1–5 fichiers usuels).

**Fichiers :** tests/e2e/progression-mobile.spec.ts (nouveau) ; tests/e2e/progression-offline.spec.ts (nouveau) ; checklist appareils/accessibilité (nouveau).

### T44 — Couvrir confidentialité et vie du compte

Inclure nouveaux objets dans export, suppression et rétention ; vérifier consentement, accès inter-comptes et cache des agrégats.

**Critères d’acceptation**

- [ ] Export fournit historique et nouvelles assignations/découvertes sans documents tiers.
- [ ] Suppression retire nouveaux objets et associations conformément aux droits de conservation applicables.
- [ ] Visibilité privée, opt-out et interdictions de coords restent vérifiés.

**Vérification :** Tests RLS/table grants et parcours export/suppression ; vérification schéma non exposé et secrets.

**Dépendances :** T18,T35,T42. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/server/progressionService.ts ; migration FK/RLS via CLI (nouveau) ; tests/features/progression/privacyLifecycle.spec.ts (nouveau) ; doc export/retention à étendre (cible existante à identifier).

### T45 — Mesurer charge et coûts du pipeline

Mesurer débit attendu puis 2×, burst offline et longues files ; indexer requêtes chaudes, borner batches et vérifier croissance.

**Critères d’acceptation**

- [ ] Résultats EXPLAIN et charge datés avec données synthétiques et environnement.
- [ ] Carte compacte/historique ne lisent pas le ledger entier.
- [ ] Panne puis rattrapage reste dans budgets et ne double pas les journaux.

**Vérification :** Charge dédiée, burst de reprises et coût par réalisation ; aucun test de charge sur prod partagé.

**Dépendances :** T07,T35,T40. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** scripts/ops/progression_outbox_health.mjs ; scripts/ops/progression_load.mjs (nouveau) ; migration indexes ciblés via CLI (nouveau) ; docs/progression/PERFORMANCE.md.

**Point de contrôle après T45**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

### T46 — Mesurer compréhension et qualité

Instrumenter événements minimaux sans contenu privé et établir baseline ; comparer compréhension, première réalisation et qualité par cohorte.

**Critères d’acceptation**

- [ ] Différence documentée entre total XP, réalisation et qualité.
- [ ] Pas de trace, conversation ou état de santé dans l’analytics.
- [ ] Pilote de compréhension et garde-fous refus/coûts publiés avec limites.

**Vérification :** Inspection des payloads, événements dédupliqués et pilote de compréhension ; pas de résultat de rétention inventé.

**Dépendances :** T14,T42,T43. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** src/features/progression/domain/analytics.ts (nouveau) ; src/components/progression/MaProgressionView.tsx ; docs/progression/2.0/mesures.md (nouveau) ; tests/features/progression/analyticsPayload.spec.ts (nouveau).

### T47 — Déployer par cohortes avec retour arrière

Flags UI/règles/adaptateurs/commerce distincts, migrations compatibles et canari sous conditions ; sauvegarde restaurable et compensation documentée.

**Critères d’acceptation**

- [ ] 1→5→25→100% seulement si santé/écarts et parcours satisfaits.
- [ ] Retour arrière coupe émission nouvelle et garde journaux historiques.
- [ ] Version app ancienne/nouvelle et DB additive restent compatibles pendant rollout.

**Vérification :** Dry-run de migrations et rollback sur environnement isolé ; reprise après changement de flag.

**Dépendances :** T43,T44,T45,T46. **Portée :** M (4 cibles, 1–5 fichiers usuels).

**Fichiers :** docs/progression/DEPLOYMENT.md ; docs/progression/OPERATIONS.md ; migration/flags via CLI (nouveau) ; scripts/ops/progression_rollout_check.mjs (nouveau).

### T48 — Clore le programme avec preuves

Rejouer contrôles finaux appropriés, figer la version et distinguer livré/déployé/testé/fermé ; fournir runbook et suivi d’économie.

**Critères d’acceptation**

- [ ] Chaque producteur actif possède preuves et test de non-régression.
- [ ] Toutes limites et portes restantes sont nommées ; aucun faux terminé.
- [ ] Runbook permet expliquer/corriger/reconstruire sans édition manuelle opaque.

**Vérification :** npm test ciblé puis global au gel ; npm run type-check ; npm run build ; npm run verify:invariants ; pgTAP et parcours finaux.

**Dépendances :** T47. **Portée :** M (3 cibles, 1–5 fichiers usuels).

**Fichiers :** docs/progression/STATE.md ; docs/progression/LAUNCH_READINESS.md ; docs/progression/2.0/rapport-final.md (nouveau).

**Point de contrôle après T48**

- [ ] Suites ciblées et invariants passent ; résultat daté joint.
- [ ] Parcours vertical de la tranche fonctionne ; application dans un état exploitable.
- [ ] Revue de conformité/cohérence effectuée ; build/types au jalon si code concerné, risques résiduels consignés.

## Contrôles transversaux de fin

- [ ] Les tâches fermées par absence de preuve/population/financement sont signalées, jamais présentées comme actives.
- [ ] Un même fait ne recrédite pas en changeant de barème, module, rôle ou support.
- [ ] Soldes, projections, droits historiques et corrections restent traçables.
- [ ] Les comptes démo sont exclus des mesures et de la compétition.
- [ ] Les métriques et tests déclarés ont réellement été exécutés dans l’environnement indiqué.

