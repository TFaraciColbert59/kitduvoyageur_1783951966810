Tu es le responsable technique et produit de LKDV. Implémente intégralement la progression unifiée, les classements et les corrections UI/UX ci-dessous dans le projet existant. Livre du code fonctionnel, persistant et vérifié, pas une maquette ni un plan.

## 1. Autonomie et sous-agents
- Travaille en autonomie jusqu'à intégration et validation ; tranche les choix réversibles et documente-les. Ne demande pas de validation entre les phases.
- Respecte AGENTS.md, les skills applicables, les permissions et les changements utilisateur. Crée une branche isolée ; aucun reset destructif, secret exposé, déploiement public ou mutation destructive de production.
- Utilise réellement des sous-agents si disponibles : A audit données/Reward Engine ; B backend/classements ; C UI/UX/accessibilité ; D tests/sécurité/revue indépendante. Sinon exécute ces rôles séquentiellement et signale cette limite.
- Attribue des périmètres de fichiers distincts. A et C commencent en parallèle ; B implémente après stabilisation des contrats ; D vérifie l'intégration. L'agent principal arbitre et intègre.
- Charge les skills pertinents de design/audit, frontend, Supabase/Postgres, sécurité et tests disponibles. N'invente jamais un skill, un outil ou un résultat.
- Continue le travail réalisable si un accès manque ; déclare précisément le blocage sans contourner l'authentification ni prétendre avoir fini ce qui reste bloqué.

## 2. Auditer avant de modifier
- Inspecte la branche actuelle et les implémentations actives, notamment docs/reports/REWARD_ENGINE_STATE.md, /recompenses, /fidelite, /gamification, /compte, /hub et les types voyage, randonnée et matériel ; les anciennes routes peuvent être redirigées.
- Recense chaque source : table/champ, producteur, événement, persistance réelle, propriétaire, preuve, qualité, règle de points existante, compétence cible. Sépare implémenté, documenté, déclaratif et absent.
- Couvre profils, randonnées/GPS/distance/durée/dénivelé/POI, voyages/étapes/transports, inventaire/kits/checklists/état/prêts/réparations, carnets/médias, posts/commentaires/likes/avis, groupes/clubs/tâches/événements, badges/parrainage/récompenses.
- Ne confonds pas itinéraire catalogue, voyage planifié, lieu coché et activité réellement effectuée. Aucun champ manquant ou événement non branché ne doit produire des points.
- Vérifie la configuration et l'identité du projet Supabase contre les instructions du dépôt avant toute opération ; migrations et tests en environnement local ou de test, sans modifier les soldes de production.

## 3. Produit : un seul système visible
- Crée un espace canonique « Ma progression », intégré au compte et au cockpit, réutilisant composants, tokens et identité LKDV.
- Affiche seulement : points LKDV, niveau voyageur, titre, rang local et prochain défi. Dévoile les détails progressivement ; aucune nouvelle monnaie XP visible.
- Fusionne les missions/challenges/tâches découverte en « Défis », les badges/succès/titres en « Distinctions », et les accès fidélité/récompenses dans un espace cohérent conservant leurs droits distincts.
- Quatre compétences progressent automatiquement : Explorer (voyages/randonnées/découvertes), Se préparer (matériel/organisation), Partager (récits/conseils), S'entraider (aide/contributions collectives).
- Un événement produit un seul gain global, distribué entre compétences selon des poids dont la somme vaut 1 ; ne multiplie jamais le gain par le nombre de compétences.
- Le niveau dépend du cumul validé ; le rang dépend des gains de saison ; les récompenses économiques dépendent exclusivement des règles d'éligibilité existantes. Une dépense, expiration commerciale ou conversion ne diminue ni niveau ni score de saison.
- Une fraude confirmée peut corriger la progression via une écriture compensatrice traçable ; ne réécris jamais silencieusement l'historique.
- Préserve soldes, droits, badges et historique existants. Définis une correspondance versionnée des anciens niveaux ; n'additionne pas des unités historiques incompatibles et ne recrédite pas d'argent à la migration.
- Si l'historique ne permet pas d'attribuer une compétence, conserve le cumul historique sans lui inventer une répartition. Ne compte pas les anciennes actions dans la saison active.

## 4. Moteur fiable et équitable
- Étends le Reward Engine actif plutôt que créer un second moteur concurrent. Réutilise ses contributions et journaux ; ajoute uniquement les projections nécessaires à la progression.
- Attribution serveur, validation de la propriété et de l'état source, transactions atomiques, clé unique utilisateur/événement/source/version, traitement concurrent sûr et rejeu idempotent.
- Règles configurables et versionnées : barèmes, seuils de niveau, plafonds, rendements décroissants, critères de validation et répartition par compétence. Explique chaque gain à l'utilisateur.
- Valorise actions réalisées et utilité vérifiée ; aucun gain compétitif pour achats, prix du matériel, créations/suppressions répétées, temps d'écran, clics, auto-likes ou interactions artificielles.
- Les contenus et validations communautaires nécessitent anti-spam, contrôle des comptes distincts et détection de collusion ; les likes seuls ne mesurent pas une compétence.
- Contrôle cohérence temporelle et géographique des activités, doublons/imports, qualité GPS, sessions hors ligne et tentatives de rejeu. Une activité déclarative n'est jamais présentée comme vérifiée.
- Définis une politique explicite pour événements tardifs, corrections et suppressions ; utilise la date de l'activité validée avec délai de grâce configurable et clôture reproductible.
- Conserve les invariants financiers : pool réellement financé, aucune équivalence fixe point/euro inventée, aucune nouvelle promesse de cashout ni modification implicite des retraits.
- N'utilise pas documents, messages privés, informations médicales, dépenses ou valeur du matériel pour classer. Aucun défi ne récompense vitesse dangereuse, exposition aux alertes ou retrait d'équipement vital.

## 5. Classement et progression ludique
- Un classement, un score identique et cinq filtres : Autour de moi (1 km), Ville, Région, Pays, Monde ; détail par compétence facultatif.
- Rattachement territorial stable pendant une saison, consenti et modifiable selon une règle anti-abus explicite ; jamais de déplacement automatique du classement au gré du GPS.
- Le rayon de 1 km est une comparaison personnalisée entre rattachements privés, pas un titre officiel de quartier partagé. Ne publie ni coordonnées, ni distances précises, ni API permettant leur extraction ou triangulation.
- Seuil minimum configurable de participants pour afficher un classement local ; sinon « Communauté en formation » et proposition explicite de vue ville, sans faux joueurs ni élargissement silencieux.
- Prévois localisation refusée/absente, recherche manuelle de commune, territoires étrangers, frontières et rattachements incomplets. Utilise des identifiants géographiques stables.
- Saison de huit semaines par défaut, dates explicites, archives et niveau permanent. Promotion par divisions facultative en détail, règles de départage déterministes et traitement clair des égalités.
- Montre le rang de l'utilisateur et ses voisins de classement ; pagination et agrégats indexés côté serveur, sans charger tous les utilisateurs ou toutes les traces.
- Propose un seul prochain défi pertinent avec possibilité de remplacement ; missions hebdomadaires souples, distinctions et célébration brève regroupée après une action.
- Intègre des défis entre amis et objectifs coopératifs avec participation volontaire ; pas de notifications insistantes ni de pénalité de progression pour absence.

## 6. Audit UI/UX à reproduire puis corriger
- Audit externe du 19/09/2026 sur https://kitduvoyageur-1783951966810-ruddy.vercel.app, session anonyme ordinateur 1363×936 ; constats à reproduire sur la version actuelle, pas des preuves de bugs universels.
- P1 Explorer : WebGL2 indisponible dans le navigateur d'audit, carte vide et spinner persistant avec « Aucun itinéraire trouvé » ; console GPUInitializationError puis accès enable/destroy indéfinis et erreur globale en quittant Explorer pour le Hub. Gérer init partielle, cleanup sûr, limite de chargement et repli liste utilisable.
- P1 Hub : sans aventure ni objet, affiche « Départ J-0 », la date du jour, « fiabilité 100 % » et « 100 % en bon état ». Remplacer les données inconnues par un état initial honnête et une action unique ; aucun score fictif.
- P1 Configurateur : Trek 3–5 jours affiche un sac de couchage bébé « +6 Mois » et « Genouillère/Protection – Couteau », total 0,9 kg et CO₂ 1,8 kg. Auditer taxonomie, provenance, contraintes d'âge/usage et couverture des besoins ; bloquer les correspondances incompatibles et afficher les manques, sans inventer des remplacements.
- P1 Communauté : « Prochaines sorties » contient juillet 2026 et un doublon ; filtrer par dates/fuseaux/statuts, dédupliquer par identité métier et prévoir l'état vide.
- P2 Accueil : « Réserver cet abri » mène à Explorer plutôt qu'à une fiche de réservation ; aligner libellé et destination, vérifier la provenance des prix/avis/statistiques, sans inventer un service de réservation.
- P2 Hub : large colonne vide, cartes très hautes pour des zéros et accès répétés ; compacter, hiérarchiser et rendre l'ajout d'un premier équipement/kit immédiatement visible.
- P2 Communauté/Clubs : grand bloc introductif et stories vides repoussent contenu et recherche vers le bas ; réduire la hauteur, afficher le contenu utile plus tôt et conserver les onglets qui fonctionnent.
- P2 Connexion : absence visible de « Mot de passe oublié », champs guidés surtout par placeholders ; ajouter récupération fonctionnelle, labels persistants, affichage du mot de passe, erreurs utiles et retour à la destination initiale.
- P2 Navigation : menu et accès au compte changent dans Explorer ; harmoniser les repères, retours, états actifs, terminologie et points d'entrée vers Ma progression.
- P2 Accessibilité : le DOM communautaire expose des boutons nommés « PaperAirplaneIcon », « EllipsisHorizontalIcon » et seulement des nombres ; fournir noms d'action explicites et corriger les contrôles interactifs imbriqués.
- P2 Configurateur : dernières étapes visuellement tronquées, options non exposées comme radios dans le DOM observé, CTA éloigné du contenu ; rendre étapes lisibles, choix accessibles au clavier et actions proches des choix.
- Préserve le vert premium et le verre léger existants ; améliore contrastes mesurés, lisibilité des petits textes, focus, cibles tactiles et réduction des animations. Aucun redesign arbitraire.
- Parcours non audités extérieurement : écrans connectés, voyages privés, récompenses personnelles, messagerie, fin du configurateur, iOS natif et mobile. Audite-les réellement avec comptes de test autorisés et captures ; ne leur attribue aucun défaut sans preuve.

## 7. Intégration, migration et vérifications
- Cartographie toutes les routes frontend actives ; parcoure leurs états importants, capture avant/après à 390×844, 430×932, 768×1024 et 1440×900. Inspecte les images, ne te contente pas de les générer.
- Vérifie safe areas, clavier mobile, barres fixes, hauteur dynamique, scroll, modales, navigation retour et chargement carte/communauté ; marque « non testé » tout comportement natif non reproductible.
- Chaque écran doit gérer visiteur, nouveau compte, données existantes, vide, chargement, erreur, accès refusé et hors ligne lorsque pertinent ; état inconnu distinct de zéro.
- Conserve les liens profonds et redirections sans boucle ; remplace les composants doublons après migration de leurs consommateurs. Aucun bouton factice, mock production ou persistance uniquement localStorage.
- Prépare migrations additives, simulation de reprise, rapprochement avant/après des cumuls/droits et procédure de retour arrière ; aucune suppression irréversible des anciens journaux.
- Tests significatifs : double événement/concurrence, propriété/RLS, tentative de score client, import historique sans double gain, dépense sans baisse de rang, fraude compensée, frontière de saison, retard hors ligne, égalités et confidentialité géographique.
- E2E : action réelle → gain unique → niveau/compétence/défi/rang cohérents après rechargement ; changement de filtre sans changement du score ; navigation Explorer→Hub avec et sans WebGL ; configurateur sans produit incompatible ; récupération de compte.
- Mesure accessibilité et performance sur les routes modifiées, exécute typecheck/lint/tests/build avec les scripts du dépôt ; corrige les régressions et distingue les échecs préexistants.
- Termine seulement après revue indépendante des sous-agents et intégration ; livre branche/diff, inventaire des données, règles versionnées, rapport UX illustré avant/après, résultats exacts des tests et éventuels blocages restants.
- En fin de tâche, indique clairement ce qui est implémenté, testé, migré localement et non déployé. Ne déclare jamais la production modifiée sans l'avoir effectivement fait avec autorisation.
