# LKDV — Récompenses : benchmarks officiels et intégration à la refonte

Date de consultation : **25 octobre 2026**. Rapport de recherche et propositions ; aucune modification de l’application. Les constats locaux proviennent du code et des documents du checkout, sans nouvelle mesure visuelle en navigateur ni confirmation du déploiement. Les recommandations sont des **hypothèses de conception à tester**, pas des résultats scientifiques sur LKDV.

## Direction proposée

L’interface courante devrait répondre immédiatement à trois questions : **combien ai-je de points utilisables, vers quel objet est-ce que j’avance, et pourquoi mon dernier gain a-t-il changé ?** Un solde dépensable, un objectif choisi et un accès au détail suffisent. Les niveaux, compétences, trophées, ligues et parts créateur restent consultables à la demande. Une interface simple peut réunir les accès sans rendre interchangeables des droits économiques différents.

Le benchmark le plus proche est Decathlon : activité réelle → gain plafonné → catalogue. Microsoft Rewards illustre que récompenser une interaction très facile exige des limitations et une surveillance de l’usage artificiel. REI montre l’importance des achats nets, retours et conditions d’utilisation. Sweatcoin distingue mouvement vérifié, unités internes et offres de partenaires. **Aucune de ces pages ne démontre causalement qu’une mécanique améliore durablement la communauté LKDV.**

## 1. Méthode et portée

- **6 recherches Exa × 5 résultats demandés = `sources_reviewed: 30`** selon la convention du skill. Ce chiffre mesure les résultats demandés, avec doublons possibles ; il ne signifie pas 30 sources indépendantes intégralement lues.
- **13 URLs uniques lues par `web_fetch_exa`**, dont certaines avec extraction plafonnée : 8 pages de programmes et 5 pages Apple/W3C. La page HIG Motion a été lue jusqu’à la section visionOS ; les passages iOS généraux utilisés sont présents. Les PDF Decathlon ont été lus jusqu’aux articles de communication ; les règles chiffrées des articles 3.1–3.3 sont présentes. Aucun fait n’est attribué aux portions non obtenues.
- Quatre programmes, plus les règles d’accessibilité et de feedback. Sources exploitées : éditeurs du programme, Apple et W3C. Pages marketing utilisées pour décrire une mécanique, jamais comme preuve de son efficacité. Pas d’estimation du budget ni du taux de fraude des concurrents.
- Les règles visibles sur le Web peuvent évoluer. Le PDF Decathlon **mars 2026**, le plus récent des deux PDF datés trouvés, est retenu pour les chiffres ; la page HTML ancienne présente des paliers et plafonds différents. La FAQ Outdoor résume autrement la condition d’heure hebdomadaire. Ces divergences restent explicites.

Requêtes exactes :

1. `Official Decathlon France programme fidélité Decat Club points activité sportive 2026 règlement 100 points récompenses plafonds`
2. `Official Microsoft Rewards terms earning points redeem limits account automated searches prohibited points expiration`
3. `Official REI Co-op member rewards terms annual reward 10 percent exclusions redemption cash`
4. `Official Sweatcoin terms rewards walking step verification marketplace coin conversion daily earning limits`
5. `Official REI Co-op membership terms rewards redemption annual reward typical 10 percent exclusions`
6. `Official Apple Human Interface Guidelines feedback motion progress indicators accessibility reduced motion rewards interface`

## 2. Ce que les programmes établissent réellement

| Programme, source primaire et qualité | Mécanique vérifiée | Enseignement possible pour LKDV | Limite de comparaison |
|---|---|---|---|
| **Decathlon France**, [CGU mars 2026](https://contents.mediadecathlon.com/s1376728/k$8d7f66afa962e3b0d3b51883e0936c8f/defaut.pdf), art. 3.1–3.3. Règlement de l’opérateur, règles datées et précises. | 60 minutes de sport dans la semaine, fractionnables, donnent 100 points ; plafond sport 100/semaine, 5 200/an ; séances manuelles exclues. Achats : 10 points/€ éligible ; retours déduits. Avis certifiés/modérés : 10 points, plafonds 44 avis/mois et 100 points/semaine. Total hors achats plafonné à 20 000/an. Points valables 12 mois ; bons 2 000 points → 3 €, 3 000 → 5 €, 6 000 → 10 €, valables 6 mois. | Une activité vérifiable, une règle courte et un plafond limitent les gains faciles. Un catalogue concret peut réunir points achats et sport. Le remboursement doit avoir une contre-écriture. | Grande enseigne avec économie et catalogue différents. Les paliers ne constituent pas un optimum psychologique. Une même unité peut avoir plusieurs valeurs implicites selon le palier : 0,0015 €/point au premier, environ 0,00167 €/point aux deux suivants, calculs à partir des CGU. |
| **Decathlon Outdoor**, [FAQ programme](https://www.decathlon-outdoor.com/fr-fr/app/programme-de-fidelite). Éditeur de l’application ; description produit. | Le solde se consulte depuis le profil. Les 100 points hebdomadaires peuvent prendre quelques jours. Une sortie enregistrée d’au moins une heure est décrite comme éligible, même laissée en brouillon ou non retenue pour publication par la modération. | Distinguer **activité privée vérifiée** et **contenu publié**. Une récompense de pratique ne devrait pas exiger de rendre sa trace publique. Prévoir un état en attente. | Cette FAQ décrit une sortie d’une heure, alors que les CGU 2026 acceptent le fractionnement. Ne pas fusionner ces règles sans signaler l’écart. |
| **Microsoft Rewards**, [gagner des points](https://support.microsoft.com/en-us/accounts-billing/rewards/how-to-earn-microsoft-rewards-points) et [limitations](https://support.microsoft.com/en-us/accounts-billing/rewards/limiting-your-searches-in-microsoft-rewards). Support de l’opérateur, utile pour fonctionnement et abus déclarés. | Récompenses pour recherches, achats et activités ; limites quotidiennes variant par région. La page donne une équivalence indicative d’environ 5 000 points pour une récompense de 5 $, et précise l’absence de valeur cash. Expiration après 12 mois sans activité de gain. Des recherches rapides répétées, suites de caractères ou automatisations peuvent entraîner limitation, suspension et invalidation des points. | « Un clic vaut de l’argent » crée un besoin explicite de règles d’éligibilité et d’anti-automatisation. Un total de points ne suffit pas : afficher les gains refusés ou en contrôle et leur motif. | Les recherches contribuent directement au produit et au modèle commercial de Microsoft ; un like LKDV n’a pas une valeur économique démontrée équivalente. Le délai de 12 mois est celui de la page consultée, pas une règle à recopier. |
| **REI Co-op**, [conditions de fidélité](https://www.rei.com/terms/rei-membership-program). Règlement opérateur ; pas une étude d’efficacité. | Les Promotional Rewards sont des crédits marchandise personnels, non transférables, portant sur des achats qualifiants nets. Les exclusions comprennent notamment promotions, cartes cadeaux, frais et la portion réglée avec des récompenses. Les retours corrigent le calcul. Solde débité lors de l’utilisation ; consommation par ordre d’expiration. Les récompenses promotionnelles 2025 sont annoncées émises le 1er mars 2026 et expirent le 27 février 2027. | Ne pas créer une boucle « achat avec points → nouveaux points sur la même valeur ». Définir assiette éligible, état estimé/confirmé et correction lors de retour. | Coopérative américaine. Ne pas transposer ces clauses au droit français ; distinguer Promotional Rewards, dividendes et récompenses carte bancaire. |
| **Sweatcoin**, [conditions](https://sweatco.in/tnc), §6–8, et [conversion des pas](https://help.sweatco.in/hc/en-us/articles/360012673992-How-many-steps-does-it-take-to-earn-1-sweatcoin). Opérateur, fonctionnement décrit sans preuve de bénéfice durable. | La FAQ de février 2024 annonce 1 000 pas vérifiés → 1 sweatcoin avant commission de 5 %. Les conditions permettent des caps quotidiens et l’annulation de gains frauduleux ; pas de remboursement cash par défaut. Le marketplace donne accès à des codes/offres de tiers, avec conditions propres. | Un coût en points ne suffit pas à promettre un objet : préciser ce qui est fourni, stock, livraison, conditions partenaire, disponibilité et frais éventuels. | La formule historique de la FAQ ne prouve pas le barème actuellement présenté à chaque compte. La monnaie interne et le token crypto sont distincts ; aucune recommandation crypto pour LKDV. |

**Point de vigilance Decathlon.** [L’ancienne page HTML CGU](https://www.decathlon.fr/Conditions-Generales-Utilisation-Membership_lp-WPI3S5), trouvée en recherche, expose 6 400 points hors achats/an et d’autres paliers (notamment 9 000/12 000). Le [PDF février 2026](https://www.decathlon.fr/static/LandingPage/cgu/assets/refonte_cgu.pdf) et celui de mars 2026 lus donnent les règles ci-dessus. Le catalogue accessible dans un compte client n’a pas été testé. Ce rapport retient les PDF datés sans certifier une offre commerciale individuelle.

### Conclusions de conception tirées du benchmark — inférences

1. **Acheter, agir, contribuer peuvent converger visuellement ; les conditions de validation restent différentes.** Un like est réversible et très peu coûteux. Un avis utile peut être modéré. Une sortie requiert une preuve d’activité, sans que cela oblige à publier la géolocalisation.
2. **L’état en attente est un produit à concevoir.** Afficher immédiatement « +50 points en vérification » si le serveur a enregistré une demande, puis « +50 points validés » seulement après validation. Ne pas montrer le même solde comme dépensable pendant le contrôle.
3. **Un catalogue fiable vaut davantage qu’une grande valeur numérique.** « Lampe, 15 000 points, livraison incluse » et « remise partenaire jusqu’à 10 %, 15 000 points » sont deux droits différents. Les pages des opérateurs montrent justement cette diversité d’offres.
4. **Le benchmark ne valide ni +5/like, ni ×3/partage.** Ces choix demandent expérimentation et budget ; ils ne se déduisent pas des chiffres de concurrents.

## 3. Audit de la refonte locale : surfaces réelles et héritage

Les chemins et numéros ci-dessous sont vérifiés dans le checkout au moment de la recherche. Ils n’attestent pas qu’une version est servie en production.

| Surface | Constat dans le code | Conséquence pour le prochain chantier |
|---|---|---|
| `/compte` | [page.tsx:6](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/app/compte/page.tsx:6) importe `MobileCompteV2`, qui monte `CompteLiquidGlassV8` dans [MobileCompteV2.tsx:58](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/MobileCompteV2.tsx:58). | Intégrer dans le Compte actuel, pas dans l’ancien écran fidélité. |
| Fidélité actuelle | [CompteLiquidGlassV8.tsx:745](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/CompteLiquidGlassV8.tsx:745) traite `?tab=fidelite` via `openStep('3:3')`. Le [runtime:1529](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/compte-liquid-glass-v8-runtime.js:1529) affiche le solde issu de `S.profile.loyaltyPoints`, puis un texte d’avantages futurs. | Faire de cet accès la porte d’entrée Récompenses, remplacer les annonces vagues par objectif, catalogue réel et historique. |
| Source fidélité | [CompteLiquidGlassV8.tsx:990](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/CompteLiquidGlassV8.tsx:990) hydrate `loyalty_points` du profil. | Ne pas renommer cette valeur en XP, part créateur ou nouveau solde avant le contrat de migration. |
| Crédit et cash | [CompteLiquidGlassV8.tsx:1008](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/CompteLiquidGlassV8.tsx:1008) additionne `store_credit_cents / 100` et `available_cash` dans `storeCreditEur`. Le [runtime:1120](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/compte-liquid-glass-v8-runtime.js:1120) présente « Part créateur · Crédit boutique ». | Ce regroupement peut suggérer un droit d’usage unique qui reste à vérifier. Conserver les montants/droits séparés dans le détail ; ne pas traiter du cash retirable comme automatiquement consommable en bon. |
| Progression | [MaProgressionView.tsx:799](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/progression/MaProgressionView.tsx:799) expose cumul et saison ; [ligne 924](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/progression/MaProgressionView.tsx:924) affiche un `usableBalance` optionnel. [types.ts:6](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/features/progression/domain/types.ts:6) impose XP sans conversion monétaire et registres distincts. | La présence d’un champ `usableBalance` ne démontre ni un portefeuille réellement financé ni la convertibilité de l’XP. Passer XP et saison dans un détail Progression. |
| Bonne gestion de l’inconnu | [ProgressionCompactCard.tsx:18](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/progression/ProgressionCompactCard.tsx:18) documente données canoniques, compte propriétaire, erreurs et absence distinguées de zéro ; [ligne 59](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/progression/ProgressionCompactCard.tsx:59) rend un statut ou une alerte. | Réutiliser cette discipline pour le solde récompenses : indisponible ≠ 0. |
| Badges actuels | [VitrineSlot.tsx:785](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/drawer/slots/VitrineSlot.tsx:785) ajoute `+… pts` si `next.points` est non nul. [DetailDrawers.tsx:64](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/overlay/DetailDrawers.tsx:64) affiche également une récompense badge. | Vérifier les données et supprimer la promesse de bonus si les badges restent des trophées sans attribution supplémentaire. Conserver la collection et son histoire. |
| Ancien `FideliteTab` | [FideliteTab.tsx:566](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/FideliteTab.tsx:566) promet carnets/likes → argent réel ; [ligne 925](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/components/compte/FideliteTab.tsx:925) promet encore des points par badge. Une recherche `rg FideliteTab src` ne trouve aucun import, seulement sa définition. | Dette legacy constatée, visibilité en parcours actuel non établie. Inventorier les dépendances avant retrait ; ne pas présenter ce composant comme l’écran actuel. |
| Like communauté | [usePostInteractions.ts:44](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/features/community/feed/usePostInteractions.ts:44) met à jour le like de façon optimiste puis appelle `toggle_community_post_like`, avec retour arrière en cas d’erreur. | La réaction visuelle peut être immédiate ; un gain économique nécessite une confirmation indépendante et idempotente. Un unlike/relike ne doit pas refaire gagner. |
| Partage communauté | [usePostInteractions.ts:90](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/features/community/feed/usePostInteractions.ts:90) lance le partage natif ou copie l’URL ; [PostSharePanel.tsx:58](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/features/community/feed/PostSharePanel.tsx:58) utilise aussi `navigator.share`. | Ce callback ou une copie ne prouve ni publication publique, ni lecture, ni valeur créée. Ne pas attribuer ×3 sur simple ouverture/retour de feuille native. |
| Top bar communauté | [CommunityFeedTopBar.tsx:27](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/src/features/community/feed/CommunityFeedTopBar.tsx:27) a déjà Pour toi, création, recherche et notifications. | Une nouvelle pilule peut surcharger le header. Réutiliser un emplacement mesuré ou une ligne compacte dans la carte ; ne pas ajouter automatiquement un quatrième bouton. |

Le document [socle post du 24 octobre](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/docs/superpowers/specs/2026-10-24-communaute-post-system-design.md) est une proposition d’architecture, pas une preuve que chaque fichier proposé existe. Par exemple `PostActions.tsx` n’est pas présent au chemin proposé lors de cette inspection. `PostGlassPanel.tsx` et `post-system.css` existent et sont utilisés. La future intégration doit donc s’appuyer sur les composants réellement présents.

## 4. Contrat UX proposé : une récompense au premier plan

### Unité et hiérarchie

**Hypothèse produit :** appeler l’unité économique grand public « points » et conserver explicitement « XP » pour la progression personnelle. Ne pas introduire simultanément jetons, cristaux, diamants et crédits. Le choix d’un nom plus propriétaire ne doit venir qu’après un test de compréhension ; aucune étude citée ici ne démontre qu’un nom fait mieux qu’un autre.

Sur la carte principale du propriétaire, une ligne de synthèse : **« 2 450 points · Lampe : 2 450 / 15 000 »**, avec une petite image de l’objet choisi et une jauge secondaire. Ces chiffres sont des **exemples de contenu, jamais des valeurs à afficher en production par défaut**. La ligne ouvre le drawer Récompenses. Sans objectif choisi : « Choisir ma récompense ». Sans donnée serveur : « Solde indisponible », sans objectif fictif.

Le solde validé est le seul total fortement visible. L’attente est une ligne secondaire : « 50 points en vérification ». Ne jamais additionner visuellement attente et disponible sous « vous pouvez dépenser ». Le niveau reste près de l’identité ou dans le détail Progression, sans se confondre avec le solde. Aucun portefeuille d’un visiteur sur le profil public ; afficher les trophées et l’expérience selon les choix de visibilité.

Le prix en points seul est insuffisant. Une fiche d’objet doit préciser : bien ou réduction, modèle exact, stock réel, points requis, éventuel reste à payer, frais de livraison, territoire, délai et conditions de retour. Si le catalogue est sponsorisé, identifier le partenaire. Une récompense indisponible peut rester visible comme historique, mais ne doit pas servir d’objectif présenté comme actuellement réclamable.

### Parcours dans la grammaire actuelle

1. **Découvrir et choisir** : entrée Récompenses dans le drawer Compte existant → catalogue court → fiche → « Choisir cet objectif ». Choisir ne dépense aucun point. Changer d’objectif ne pénalise pas le solde.
2. **Agir** : une action éligible indique son gain et ses conditions près de l’action, de façon concise. Une activité enregistrée en privé conserve son gain de pratique si la règle économique l’autorise. Le partage est une décision distincte.
3. **Recevoir** : retour tactile et visuel immédiat pour l’action ; message de validation économique seulement quand le serveur confirme l’écriture. Les gains arrivant ensemble sont regroupés, pas joués en rafale.
4. **Comprendre** : toucher le solde ouvre un historique lisible « Sortie validée, +50, 25 octobre ». Une ligne détaille source, montant, état et motif, avec contestation possible si pertinent.
5. **Utiliser** : quand le total disponible suffit et que l’objet est réellement disponible, bouton « Utiliser 15 000 points ». Récapitulatif de coût et livraison avant confirmation ; débit définitif lié à la réservation/commande réussie, pas à l’appui initial.

Conserver `DrawerShell` et la carte hôte, le verre Forest, la poignée, les capsules accessibles, le scroll interne et la carte basse. Les dimensions 406 px/r24 à 430 px, capsules 48 px et split de page viennent du [skill de refonte consolidé](C:/Users/farac/Documents/kitduvoyageur_1783951966810-main/.agents/skills/lkdv-ios27-page-refonte/SKILL.md), **pas de nouvelles mesures**. Les adapter au viewport et à l’agrandissement du texte ; ne pas interpréter 406 px comme une largeur fixe universelle.

Deux volets suffisent au départ : **récompenses** et **historique**, via icônes nommées pour technologies d’assistance. Progression et créateur sont des liens secondaires distincts, pas trois compteurs supplémentaires. Le compteur doit être facile à retrouver dans les parcours éligibles ; « toujours visible » ne justifie pas de cacher la carte, le clavier, un panneau de post ou une action de sécurité. La nouvelle barre basse en cours de travail n’est pas modifiée dans cette recherche.

### États et microcopy — spécification proposée

| État | Présentation principale | Comportement et accès au détail |
|---|---|---|
| Chargement | Emplacement réservé ou tiret ; « Chargement du solde » | Pas de 0 transitoire, pas de chiffre de démonstration. |
| Donnée indisponible | « Solde indisponible » + Réessayer | Conserver l’objectif local comme sélection, sans lui attribuer une progression inventée. |
| Hors ligne | « Dernier solde connu · synchronisation en attente » | Dater la valeur ; ne pas permettre l’échange d’une donnée périmée. |
| Action reçue | « Sortie enregistrée · 50 points en vérification » | Afficher ce statut seulement si une intention serveur existe ; pas une promesse de validation. |
| Gain validé | « +50 points · Sortie validée » | Solde et objectif se mettent à jour depuis la réponse canonique. |
| Plafond atteint | « Plafond de cette période atteint » | Expliquer la règle et date de renouvellement. Éviter une relance demandant de revenir à une heure précise. |
| Doublon | « Cette sortie a déjà été récompensée » | Pas de deuxième animation de gain. |
| Validation refusée | « Cette activité n’est pas éligible » | Motif compréhensible, détail et possibilité de correction/recours ; pas d’accusation de fraude automatique. |
| Contrôle | « Attribution en cours de vérification » | Solde validé distinct, action de contact et délai seulement s’il est fiable. |
| Contre-écriture | « −50 points · Attribution corrigée » | Rattacher à l’événement d’origine et expliquer. Le remboursement d’achat et les droits acquis doivent suivre le contrat économique. |
| Objectif atteint | « Votre lampe est disponible » | Un retour discret, un bouton Réclamer ; pas de compte à rebours fictif ni échange automatique. |
| Stock épuisé | « Temporairement indisponible » | Pas de débit ; proposer autre objectif et option d’alerte choisie. |
| Échange en cours | « Réservation en cours » | Bouton protégé du double appui, fermeture possible sans nouvelle commande. |
| Échange réussi | « Récompense réservée » + référence | Débit confirmé, état de livraison et historique ; message distinct de « expédiée ». |

### Animation et accessibilité

Les HIG [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback.md) recommandent un retour proportionné, souvent intégré près de l’objet, et une interruption réservée aux informations importantes. Les HIG [Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md) recommandent un mouvement bref, précis, facultatif et sans animation excessive lors d’actions fréquentes. Ce sont des recommandations d’interface, pas des essais qui établissent un taux de rétention.

**Proposition LKDV :** appui 100–150 ms ; confirmation de gain par fondu 200–300 ms et légère transition du repère ; aucun nuage de pièces, roulette, confetti plein écran ou son obligatoire. Ces durées viennent de la grille du skill local Interaction Design et restent à tester. Animer `transform` et `opacity`, pas la largeur de la carte. Une jauge persistante d’objectif peut se mettre à jour sans prétendre être un indicateur d’attente système. Un chargement inconnu reste indéterminé, sans fausse progression vers 99 %.

Avec `prefers-reduced-motion`, remplacer déplacement, zoom et décompte animé par texte mis à jour et fondu simple, voire transition nulle. Apple explique les risques du zoom, rotation et mouvements périphériques dans ses [critères Reduced Motion](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/). Le critère [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), de niveau AAA, autorise la désactivation des mouvements d’interaction non essentiels ; la prise en charge est ici une exigence de conception LKDV, sans la présenter comme une obligation du niveau AA.

Une région `role="status"`/`aria-live="polite"` annonce une fois « 50 points validés, total 2 450 ». Ni prise de focus ni lecture de chaque chiffre intermédiaire. [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) traite précisément les statuts sans changement de contexte. Ne pas faire dépendre la compréhension d’une couleur ou d’un haptique. Les cibles tactiles 44×44 px sont le standard local adopté ; un pictogramme visible plus petit peut avoir une zone interactive étendue. Contrôler contraste du verre sur photos, mode texte agrandi, VoiceOver, focus clavier et annonces groupées.

## 5. Garder, modifier et retirer

| Décision proposée | Élément | Condition |
|---|---|---|
| **Garder** | XP à vie, trophées, sorties privées, journaux et preuves | Conserver l’historique et l’identité ; rendre ces détails secondaires dans l’interface quotidienne. |
| **Garder** | Composants DrawerShell, SlotShell, PostGlassPanel, rollback des likes, états indisponibles | Réutiliser les chemins actuels ; les règles économiques doivent vivre côté serveur. |
| **Modifier** | Entrée Fidélité → Récompenses, récapitulatif de solde, objectif choisi, historique | Définir d’abord le registre économique canonique et le financement. |
| **Modifier** | Somme cash + avoir actuellement affichée en crédit boutique | Clarifier droits et unités, contrat de migration et consommation réelle. |
| **Modifier** | Libellés « pts saison », « points actifs » et bonus badges résiduels | « XP de saison », « points disponibles » ; aucun bonus affiché sans droit attribuable. |
| **Retirer de la surface principale** | Quatre compétences, rangs multiples, compteurs de saison, multiplicateurs créateur | Déplacer dans Progression/Créateur, sans supprimer leurs données par défaut. |
| **Retirer après inventaire** | Ancien composant FideliteTab et promesses contradictoires | Vérifier imports dynamiques, tests, traductions et liens avant suppression ; pas de migration de données destructive dans ce rapport. |
| **Ne pas introduire** | Points pour SOS, vitesse, danger, présence continue, faux progrès, partage imposé, tirages opaques | Ces mécaniques n’aident pas à exprimer une contribution utile et vérifiable ; la sécurité doit rester indépendante des gains. |

## 6. Validation nécessaire avant implémentation

**Hypothèses et critères de recherche utilisateur :** vérifier qu’une personne nouvelle distingue points dépensables et XP, sait si son gain est confirmé, comprend ce qu’elle obtiendra et trouve ses conditions sans aide. Faire tester aussi l’échec d’un échange et une correction de gain. Inclure une personne avec texte agrandi et une utilisant un lecteur d’écran. La réussite d’un test de compréhension ne prouve pas une hausse durable d’engagement.

**Comparaison produit à préparer :** objectif choisi visible contre accès catalogue seul ; bonus de contribution vérifiée contre simple bonus de partage. Mesurer activité utile vérifiée, taux de publication utile, satisfaction, plaintes, refus, coûts et fraude. Ne pas utiliser seulement clics, nombre de likes ou temps passé comme preuve de valeur. Le protocole statistique et les barèmes relèvent du rapport économique et scientifique ; aucune promesse de précision scientifique sur +5/+50/×3 n’est faite ici.

**Recette de la future UI :** à 430×932 puis petit écran et texte agrandi, contrôler carte fermée, drawer Récompenses, historique, post avec panneau partage, clavier et carte basse ; pas de double navigation ; aucun compteur démo sur compte réel ; absence d’empiétement sur les actions terrain/sécurité ; reduced motion ; zéro double gain après retry/relike ; échange concurrent refusé proprement. Ce sont des vérifications à effectuer à l’implémentation, elles n’ont pas été exécutées dans ce rapport documentaire.

## 7. Registre des 13 URLs lues

1. [Decathlon CGU février 2026](https://www.decathlon.fr/static/LandingPage/cgu/assets/refonte_cgu.pdf)
2. [Decathlon CGU mars 2026](https://contents.mediadecathlon.com/s1376728/k$8d7f66afa962e3b0d3b51883e0936c8f/defaut.pdf)
3. [Decathlon Outdoor — fidélité](https://www.decathlon-outdoor.com/fr-fr/app/programme-de-fidelite)
4. [Microsoft — gagner des points](https://support.microsoft.com/en-us/accounts-billing/rewards/how-to-earn-microsoft-rewards-points)
5. [Microsoft — limitations des recherches](https://support.microsoft.com/en-us/accounts-billing/rewards/limiting-your-searches-in-microsoft-rewards)
6. [REI — conditions du programme](https://www.rei.com/terms/rei-membership-program)
7. [Sweatcoin — conditions](https://sweatco.in/tnc)
8. [Sweatcoin — conversion des pas](https://help.sweatco.in/hc/en-us/articles/360012673992-How-many-steps-does-it-take-to-earn-1-sweatcoin)
9. [Apple HIG — Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback.md)
10. [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)
11. [Apple — Reduced Motion](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/)
12. [W3C — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
13. [W3C — Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

Les pages HIG Progress indicators, anciennes CGU HTML et REI Member Reward ont fourni des extraits de recherche supplémentaires ; elles ne sont pas ajoutées au compte des 13 URLs fetchées.
