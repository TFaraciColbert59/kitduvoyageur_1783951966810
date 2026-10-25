# LKDV — Revue mobile, direction produit et critères de lancement

19 septembre 2026 · Priorité iPhone, puis Android · Document de cadrage pour l’implémentation

## Ce qui a été vérifié

Le prompt existant a été relu et la direction mobile a été travaillée avec des sous-agents distincts pour le produit, la revue statique et les exigences de lancement. La consultation du site public a été reprise, mais le navigateur disponible expose uniquement une fenêtre de 1363 × 936 et aucune fonction documentée de changement de viewport. La politique du navigateur a ensuite refusé l’ouverture du support local envisagé pour l’inspection. Aucun contournement n’a été effectué.

**Aucune nouvelle capture mobile, validation sur iPhone ou mesure de charge n’a donc été produite.** Ce dossier distingue les constats de code, les observations desktop historiques et les choix de conception. Il ne constitue pas un audit visuel mobile terminé. Les captures desktop du précédent rapport restent historiques ; elles ne prouvent pas l’état de la version native ou de la branche actuellement développée.

L’implémentation précédente a été acceptée par le porteur du projet. Le prochain travail doit partir de la branche réellement retenue et compléter ce qui existe. Les chiffres de tests ou commits d’un ancien compte rendu ne constituent pas une nouvelle vérification du code déployé.

## Revue statique du code mobile : dix constats sourcés

Périmètre : branche main, commit **677acd961e5ea53269cad4c88dff7d195eb5c885**. Aucune exécution ni mesure sur appareil. La branche feat/unified-progression-rankings-uiux n’apparaissait pas dans la liste accessible ; elle peut exister localement ou ailleurs. Les constats ci-dessous doivent être comparés au checkout d’implémentation retenu et ne remettent pas à zéro le travail accepté.

P1 désigne ici une priorité de correction/validation avant lancement ; P2 une correction de cohérence ou de confort. Un risque déduit du code n’est pas présenté comme un incident reproduit sur iPhone.

| ID / priorité | Fait observé dans le code et source | Conséquence / validation demandée |
|---|---|---|
| M01 · P1 | Viewport global : maximumScale:1 et userScalable:false. [layout](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/app/layout.tsx) | Le code restreint le zoom. Autoriser l’agrandissement et vérifier texte à 200 %, reflow et commandes sans troncature. |
| M02 · P1 | /groupes apparaît dans Hub et Communauté ; état actif calculé indépendamment ; tab.label non rendu. [BottomTabBar](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/mobile-nav/BottomTabBar.tsx) | Deux états actifs possibles pour une route. Registre canonique, libellés visibles et aria-current ; vérifier chaque destination et lien profond. |
| M03 · P2 | Sous-navigation : hauteur 30 px ; ancêtres touchAction:none, plateau pan-x. [BottomTabBar](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/mobile-nav/BottomTabBar.tsx) | Zones inférieures à l’objectif produit et contrat tactile contradictoire. Garantir 44×44 utiles et reproduire le glissement sur appareil ; l’échec tactile n’a pas été observé ici. |
| M04 · P2 | Barre à zIndex9999, composants Glass à 10000/10001, ancienne Sheet à z-50 ; deux main#main-content dans layout et shell. [AppShell](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/shell/AppShell.tsx), [Sheet](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/ui/Sheet.tsx), [GlassModal](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/ui/GlassModal.tsx) | Consolider couches/portails/focus et landmark principal. Le masquage effectif dépend des contextes d’empilement et reste à reproduire. |
| M05 · P1 | Capacitor dépend de CAPACITOR_SERVER_URL ; aucun enregistrement du service worker dans ce runtime, mais bannière affirmant du contenu en cache. [configuration](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/capacitor.config.ts), [service worker](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/ServiceWorkerRegistration.tsx), [bannière](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/mobile-nav/OfflineBanner.tsx) | Le cache annoncé n’est pas démontré par ces composants. Tester démarrage sans réseau, contenu téléchargé, absence de cache et reprise ; afficher l’état réel. |
| M06 · P1 publication | cleartext:true et android.allowMixedContent:true ; validation HTTPS release non montrée dans ce fichier. [configuration](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/capacitor.config.ts) | Séparer dev/release, borner l’origine et imposer HTTPS pour la publication. C’est un risque de configuration, pas une preuve d’attaque ni d’exposition réelle. |
| M07 · P2 | Bootstrap branche onBackButton, pas onAppActive/onAppInactive disponibles ; retour par historique ; timers de splash 1200ms/200ms. [bootstrap](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/NativeAppBootstrap.tsx), [listeners](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/lib/native/app.ts) | Rechercher les autres gestionnaires puis vérifier fermeture clavier/feuille, retour et restauration à la reprise. L’écran utile ou l’erreur récupérable doit piloter la fin du splash. |
| M08 · P2 | Préchargement jusqu’à huit routes ; réseau inconnu autorisé ; Link prefetch=true malgré le garde de données. [PrefetchRoutes](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/components/PrefetchRoutes.tsx), [networkPrefs](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/lib/perf/networkPrefs.ts) | Unifier politique routes/données, limiter sur réseau inconnu et mesurer coûts/transferts. Aucun ralentissement chiffré n’a été mesuré dans cette revue. |
| M09 · P1 exactitude | Récompenses : cinq lectures séquentielles et profile?.trust_score \|\| 50. [page récompenses](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/src/app/recompenses/page.tsx) | La valeur valide 0 devient 50 : corriger la distinction zéro/inconnu. Réutiliser les tables financières réelles et paralléliser seulement les lectures indépendantes. |
| M10 · P1 validation | E2E principal Desktop Chrome ; projet visuel iphone-14-pro forcé Chromium en 430×932. [Playwright](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/playwright.config.ts), [tests visuels](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/677acd961e5ea53269cad4c88dff7d195eb5c885/playwright.visual.config.ts) | Ces configurations ne démontrent ni Safari ni WKWebView. Matrice nommée précisément, web mobile/WebKit et validation native séparée ; ne conclure aucune absence de tests ailleurs. |

Bases à conserver : AppShell centralise déjà les safe areas, les liens principaux disposent de zones de 44×44, les modales Glass utilisent Radix, la réduction des animations est prévue et les récompenses lisent des tables persistantes. Cette revue n’a ni testé les autorisations serveur ni réaudité exhaustivement le moteur de progression accepté.

## Direction retenue : préparer, vivre, partager, progresser

LKDV doit aider immédiatement à préparer ou vivre une aventure. La compétition accompagne ces actions utiles. Elle ne doit ni envahir les parcours ni demander à l’utilisateur de comprendre plusieurs systèmes de points.

| Destination principale | Contenu prioritaire | Accès secondaires |
|---|---|---|
| Aventures | Aventure active, prochain départ ou création de la première aventure | Voyages, préparation, carnets, résumé de progression |
| Explorer | Carte et liste synchronisées, recherche, filtres | Détails de lieux/itinéraires, recentrage |
| Matériel | Kit actif, éléments à préparer, ajout d’équipement | Inventaire, configurateur, prêts/réparations, boutique contextuelle |
| Communauté | Contenu utile, recherche, échanges | Clubs, sorties, messagerie, signalement |
| Moi | Profil et Ma progression | Récompenses, distinctions, préférences, confidentialité, assistance |

Cette architecture est une **décision de conception proposée**. Avant modification, mapper toutes les destinations existantes, conserver les liens profonds et vérifier les droits d’accès. La messagerie reste accessible directement depuis Communauté et ses notifications ; elle ne devient pas un sixième onglet.

La première vue d’Aventures présente une seule action dominante, choisie selon les données réelles : reprendre une aventure, terminer sa préparation ou préparer sa première sortie. Une carte de progression compacte montre le niveau, le rang disponible et le prochain défi. Les détails sont accessibles depuis « Ma progression ».

### Fusion du système ludique

| Ce que l’utilisateur voit | Ce qui est fusionné | Règle de cohérence |
|---|---|---|
| Points LKDV | Présentations dispersées des points existants | Une unité ; libellés Points cumulés, Points cette saison et Solde utilisable (récompenses uniquement), sans ajouter une monnaie XP |
| Niveau voyageur | Niveaux et paliers concurrents | Cumul validé permanent ; dépenser des points ne fait pas régresser |
| Défis | Missions, challenges et tâches de découverte pertinentes | Un prochain défi visible ; remplacement possible ; pas de sanction d’absence |
| Distinctions | Badges, succès et titres | Historique et droits conservés ; présentation commune |
| Ma progression | Gamification et vues de classement | Un espace canonique, accessible du cockpit et du profil |
| Récompenses | Accès fidélité et avantages | Présentation cohérente, mais règles économiques et droits distincts conservés |
| Quatre compétences | Activités réellement vérifiables de l’app | Explorer, Se préparer, Partager, S’entraider ; aucun diagnostic de compétence sportive réelle |

Un événement validé produit un seul gain global. Sa répartition entre compétences totalise ce même gain. Le classement utilise les gains de la saison ; le niveau utilise le cumul validé. Les activités historiques ne sont pas injectées dans une nouvelle saison et une réimportation ne crédite aucun gain supplémentaire.

Les achats, prix du matériel, messages privés, informations médicales, clics et temps d’écran ne servent pas à classer. L’inventaire des données doit être exhaustif ; leur utilisation compétitive reste justifiée par l’utilité, la preuve disponible et les règles existantes.

### Du rayon de 1 km au monde

Un seul classement offre les filtres Autour de moi (1 km), Ville, Région, Pays et Monde. Le score ne change pas avec le filtre. Le rang et le nombre de participants, eux, dépendent du groupe comparé.

Le rayon de 1 km est centré sur un rattachement privé et stable, choisi avec consentement. Deux personnes peuvent donc voir des groupes différents : l’interface doit éviter de présenter cette comparaison comme un titre officiel commun de « meilleur du quartier ». Les coordonnées exactes ne sont jamais renvoyées au client de classement. Le minimum proposé de cinq participants constitue seulement un premier seuil à évaluer ; il ne protège pas, à lui seul, contre la réidentification ou la triangulation.

Le prochain agent doit définir et tester les limites de changement de rattachement, les sondages répétés, les petites communautés, les frontières, les territoires sans niveau régional et la localisation refusée. Un choix manuel de commune permet de participer aux niveaux territoriaux disponibles ; le rayon de 1 km reste indisponible tant qu’un rattachement privé suffisant manque. Aucun élargissement de rayon silencieux, faux joueur ou position inventée.

## Direction visuelle mobile

Une interface outdoor lumineuse, calme et lisible : fond sauge pâle, surfaces claires, actions vert forêt. Le verre reste léger et réservé aux éléments superposés. La topographie décorative ne passe pas derrière du texte essentiel. La refonte est autorisée ; les fonctions utiles et l’identité LKDV sont conservées.

| Élément | Proposition à implémenter et vérifier |
|---|---|
| Couleurs claires | Fond `#F5F7F3`, surface `#FFFFFF`, texte `#172B24`, texte secondaire `#56665D`, action `#226148`, accent doux `#D3EBD9` |
| Couleurs sombres | Fond `#101C17`, surface `#1B2D24`, texte `#F1F5F1` ; compléter tous les états, pas seulement inverser le fond |
| Espacements | Échelle `4 / 8 / 12 / 16 / 24 / 32`, marge d’écran 16 ; adaptation aux safe areas dans un seul shell |
| Formes | Rayons `12 / 16 / 24` ; pilules réservées aux filtres/étiquettes ; éviter les cartes imbriquées |
| Typographie | Police système, corps 16, secondaire 14, titres 22–28 ; chiffres tabulaires ; prise en charge du texte agrandi |
| Toucher | Objectif web 44 × 44 CSS px ; adaptations natives selon plateforme ; espacement suffisant entre actions |
| Mouvement | Transitions utiles de 120–220 ms, réduction des animations respectée ; célébration courte regroupée après validation réelle |
| Contraste | Mesuré sur le rendu composé : 4,5:1 pour le texte courant, 3:1 pour le grand texte et les éléments non textuels concernés ; ne pas employer un séparateur pâle comme seule frontière d’un contrôle |

La carte dispose d’un panneau bas à positions définies, d’une liste équivalente et de boutons qui permettent les mêmes actions sans geste complexe. La fermeture d’un détail précède le retour à la destination précédente. Matériel montre les besoins et les données connues ; un inventaire vide ne doit produire aucun pourcentage de préparation flatteur. Communauté affiche contenu et recherche avant les grands blocs décoratifs. La messagerie conserve le brouillon et garde le champ d’envoi visible au-dessus du clavier.

## Pistes issues du précédent audit desktop

Ces observations ont été rapportées sur une session anonyme ordinateur. Leur persistance sur la branche retenue et leur manifestation mobile restent à reproduire.

| Priorité de reproduction | Observation historique | Résultat attendu si confirmée |
|---|---|---|
| P1 | Explorer : échec WebGL2, chargement persistant, erreur au départ vers le Hub | Initialisation et destruction sûres, délai borné, liste fonctionnelle, navigation conservée |
| P1 | Hub vide : départ J-0, date du jour, fiabilité/état à 100 % | Donnée inconnue distincte de zéro, état initial utile, aucune date ou qualité inventée |
| P1 | Configurateur trek : produit bébé et catégorie couteau incohérente | Contraintes d’usage/âge, taxonomie vérifiée, provenance, manques affichés |
| P1 | Communauté : événements de juillet dans les prochaines sorties en septembre, doublon | Filtrage date/fuseau/statut et déduplication métier |
| P2 | « Réserver cet abri » mène vers Explorer | Libellé conforme à l’action réelle et données commerciales sourcées |
| P2 | Cartes hautes, stories vides, contenu repoussé | Une première vue utile et densité adaptée au tactile |
| P2 | Récupération de mot de passe non visible, guidage par placeholders | Parcours de récupération fonctionnel, labels persistants, erreurs utiles |
| P2 | Repères de navigation variables, noms accessibles techniques, étapes tronquées | Shell cohérent, noms d’action compréhensibles, choix et étapes accessibles |

## Preuves mobiles à produire pendant l’implémentation

Un registre associera chaque capture à la route, au commit/build, à l’heure, au compte de test, à l’état des données, au viewport, au runtime et au réseau. Les images doivent être ouvertes et inspectées. Les états chargement, vide, erreur, refus de permission et hors ligne sont capturés lorsque pertinents. Aucun compte privé réel n’est utilisé pour fabriquer une démonstration.

| Parcours | Captures et manipulation minimale | Critère de réussite |
|---|---|---|
| Démarrage / compte | Lancement froid, connexion, erreur, récupération, lien profond | Retour à la destination attendue ; aucun contenu masqué par clavier ou barres système |
| Aventures | Nouveau compte, voyage planifié, voyage actif, fin d’aventure | État honnête, action principale unique et accessible |
| Matériel / configurateur | Vide, ajout, kit, choix longs, données incomplètes | Produit compatible, éléments manquants explicites, aucun débordement |
| Explorer | Carte, liste, panneau, refus GPS, panne WebGL, retour Hub | Navigation intacte et alternative utilisable |
| Communauté / clubs | Vide, flux long, événement passé, publication, signalement | Pagination, dates correctes, scroll conservé, actions accessibles |
| Messagerie | Clavier ouvert, envoi, coupure réseau, reconnexion | Brouillon conservé, statut explicite, aucun doublon |
| Progression | Gain réel, 4 compétences, 5 filtres, communauté trop petite | Gain unique persistant ; score identique selon filtre ; rang personnel visible |
| Récompenses / confidentialité | Solde, droits, dépense, localisation, suppression de compte | Droits conservés ; dépense sans régression du niveau ; parcours effectifs |

Priorité iPhone cible disponible, puis petit iPhone et Android intermédiaire. En web, vérifier 360 × 800, 390 × 844 et 430 × 932 CSS px, texte agrandi, clavier et orientation ; ces dimensions ne prouvent pas les comportements natifs. Tester VoiceOver/TalkBack, retour système, reprise après arrière-plan, permissions et zones sûres sur runtime adapté. Toute couverture manquante reste « non vérifiée ».

## Exigences pour un lancement international

Les chiffres ci-dessous sont des **objectifs initiaux proposés**, pas des résultats obtenus. Les budgets doivent être confrontés à la pile réelle et aux moyens disponibles.

| Domaine | Cible / preuve demandée |
|---|---|
| Performance web mobile | p75 terrain : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 ; segmentation route/région/appareil ; les tests laboratoire sont identifiés séparément |
| Coque native | Mesure du démarrage et du premier écran utile, reprises, mémoire et fluidité ; environnement et appareil déclarés |
| Ressources | Budgets par route pour JS, images, requêtes et mémoire ; carte/moteur 3D à la demande ; listes bornées et paginées ; pas de chargement de tous les utilisateurs |
| Disponibilité | Proposition ≥99,9 % sur 30 jours pour les parcours critiques ; instrumentation et historique requis avant toute affirmation |
| Stabilité et API | Proposition sessions sans crash ≥99,8 %, erreurs serveur <0,5 %, API critiques p95 ≤800 ms dans les régions testées ; préciser dénominateurs, fenêtres et exclusions |
| Accessibilité | WCAG 2.2 AA ciblé pour le web ; tests assistifs manuels en complément des outils automatiques |
| Langues | Français et anglais complets/revus au départ ; activation des autres langues seulement après validation ; pseudo-localisation +40 %, pluriels et RTL |
| Formats | Langue, pays, fuseau, monnaie et unités distincts ; dates d’activité et de saison explicites ; pas de conversion financière implicite |
| Résilience | Timeouts, retries bornés, brouillons, cache limité et synchronisation idempotente ; aucune attribution de points de confiance depuis le client hors ligne |
| Confidentialité | Position exacte exclue du classement public ; consentement, droits d’accès, export/suppression ; redaction des données sensibles dans les logs et captures |
| Communauté | Signalement, blocage, traitement des abus et assistance opérationnels dans les langues/pays ouverts |
| Déploiement | Flags serveur, compatibilité des anciennes apps, migration additive, restauration testée, arrêt/retour arrière documentés |

Les seuils Web Vitals sont documentés par [web.dev](https://web.dev/articles/vitals). Les exigences d’accessibilité sont à vérifier dans [WCAG 2.2](https://www.w3.org/TR/WCAG22/) ; les recommandations de cibles natives Android sont décrites dans la [documentation Android](https://developer.android.com/guide/topics/ui/accessibility/apps). Les points de conception internationale s’appuient sur les [recommandations W3C i18n](https://www.w3.org/International/quicktips/).

### Capacité et coûts : rendre « des millions » mesurable

Séparer comptes inscrits, utilisateurs actifs quotidiens, simultanéité, sessions temps réel, requêtes/seconde, écritures, stockage et appels facturés. Construire un scénario chiffré avec hypothèses explicites et sensibilité aux pics. Un objectif d’inscrits ne prouve pas la capacité de connexion simultanée.

Sur un environnement de test autorisé, exécuter les parcours représentatifs au pic prévu puis à une marge proposée de 2×. Inclure un territoire dense, le calcul du rang personnel, la fin de saison, les imports et la reconnexion hors ligne. Produire durée, jeu de données, concurrence, débit réellement atteint, latences p50/p95/p99, erreurs, saturation et coût. Aucun test de charge en production par défaut et aucune extrapolation au-delà des mesures.

Limiter pagination, uploads, notifications, calculs lourds et services facturés ; vérifier les droits serveur pour chaque objet et opération. Ces contrôles répondent notamment au risque de [consommation non bornée de ressources décrit par OWASP](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).

### Publication et exploitation

Préparer une bêta puis un déploiement par cohortes, par exemple 1 % → 5 % → 25 % → 100 %. Chaque passage dépend de mesures, d’une durée et d’un échantillon suffisants, avec arrêt sur régression. La méthode est cohérente avec les [pratiques de canary releases de Google SRE](https://sre.google/workbook/canarying-releases/).

Vérifier les règles à jour des stores ciblés, les permissions réellement utilisées, les informations de confidentialité, le parcours de suppression de compte et la modération des contenus publics. Apple décrit notamment ces attentes dans ses [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Une validation technique ne démontre pas, à elle seule, que tous les services sont disponibles commercialement ou administrativement dans tous les pays.

Le dossier final d’implémentation doit relier chaque exigence à une preuve. Tout défaut P0/P1 ouvert sur un parcours critique empêche de qualifier la version de prête au lancement. Les domaines non testés restent explicitement ouverts. Les publications, dépenses et migrations de production suivent les autorisations réellement données dans l’environnement d’exécution.
