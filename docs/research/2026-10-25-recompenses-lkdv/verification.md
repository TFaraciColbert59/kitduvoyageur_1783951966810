# Vérifications de la livraison documentaire

Date : 25 octobre 2026. Ce journal concerne la recherche et son simulateur ; il ne certifie pas les parcours applicatifs en production.

| Contrôle exécuté | Résultat / portée |
|---|---|
| Exécution du simulateur par l’auteur puis par l’agent principal | Code de sortie 0 ; invariants satisfaits |
| Contenu de simulation | 5 variantes × 4 profils = 20 cadences ; 60 projections ; 90 sensibilités ; 90 couvertures budgétaires |
| Invariants du modèle | Partage ×3 = 150 au total ; caps 500/250 ; poids de cohortes = 1 ; conservation solde/échanges ; prix seul ÷10 → coût ×10 ; gains et prix ÷10 → coût identique |
| Parsing de tous les JSON de recherche | 31 fichiers valides au contrôle final |
| Liens locaux Markdown | 84 cibles vérifiées, 0 cible cassée avant mise à jour de ce journal ; liens vers fichiers et répertoires, fragments et lignes non validés sémantiquement par ce contrôle |
| Registre Exa consolidé | 36 recherches ; 226 résultats demandés ; 56 URL distinctes récupérées après déduplication littérale ; 20 travaux scientifiques exploités avec niveaux d’accès signalés |
| Recherche de motifs de secrets dans les livrables | Aucun motif de jeton GitHub, clé secrète Supabase ou JWT trouvé ; contrôle par motifs, pas garantie générale de classification |
| Relecture indépendante de l’audit par agent UX | Totaux et affirmations vérifiés contre les JSON et le chemin API ; absence de conclusion d’exploitation active |
| Relecture de la proposition par agents science et économie | Clarifications intégrées : sous-cap social inclus dans 250, agrégat hebdomadaire distinct d’un moteur par événement, financement sécurisé, causalité affichage/récompense et résultat binaire par personne |
| État du checkout | Trois fichiers `src` déjà modifiés au début restent dans le statut ; les nouveaux fichiers de cette recherche sont tous sous `docs/research/2026-10-25-recompenses-lkdv/` |
| Actions distantes | Connecteurs GitHub en lecture ; requêtes SQL SELECT de métadonnées et agrégats uniquement ; aucune migration, attribution, dépense, retrait, publication ou changement de flag |

Reproduction de la simulation depuis la racine du dépôt :

```powershell
node docs/research/2026-10-25-recompenses-lkdv/simulate-economy.mjs
```

Le contrôle JSON utilise `ConvertFrom-Json -ErrorAction Stop`. Le contrôle de liens résout chaque lien local relatif au fichier Markdown, ignore les URL Web et retire les suffixes de ligne/fragments ; il n’établit pas que les liens externes resteront accessibles ultérieurement. Les 56 pages récupérées via Exa incluent des versions, miroirs et textes parfois limités à un résumé ou à une extraction plafonnée ; elles ne sont pas 56 preuves scientifiques indépendantes.

Les lectures Supabase ne sont pas un snapshot transactionnel commun. Les valeurs peuvent varier avec le trafic ; les fichiers de preuve décrivent les requêtes et la date de consultation. Les fonctions SQL inspectées n’ont pas été invoquées pour produire une récompense réelle. Aucun essai de fraude ni scan de sécurité exhaustif n’a été réalisé.

Non exécutés dans cette phase documentaire : suite applicative Vitest, pgTAP, build, tests navigateur/mobile, parcours authentifiés d’échange/livraison, restauration des soldes ou test de charge. Ces vérifications relèvent de la prochaine phase d’implémentation et des scénarios de recette décrits dans les rapports.
