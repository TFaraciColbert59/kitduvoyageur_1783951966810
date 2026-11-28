# Couverture des 88 exigences `EX-…` — état au 2026-11-09 18:05

Règle : une exigence n'est « prouvée » que si une preuve rejouable existe dans `etat/preuves/`. Les statuts sont volontairement pessimistes.

| ID | Exigence (résumé) | Statut | Preuve / blocage |
| --- | --- | --- | --- |
| EX-GEN-01 | LKDV Control est une application séparée de LKDV, servie sur `lkdv-control.vercel.app` (projet Vercel distinct | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-GEN-02 | Les deux applications partagent une seule base : Supabase `icxyvwzfjbflcbqukpfz` | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-GEN-03 | Les 144 actions de `04_CATALOGUE_ACTIONS.md` sont disponibles dans le CRM, chacune par l'interface **et** par  | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-GEN-04 | Toute écriture passe par une commande métier côté serveur, jamais par un `update` direct depuis le navigateur | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-GEN-05 | Interface en français ; identifiants de code en anglais | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-AUTH-01 | Connexion par Supabase Auth (même projet), réservée aux comptes de l'équipe | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AUTH-02 | Double authentification obligatoire (TOTP) ; enrôlement guidé à la première connexion ; sans niveau `aal2`, au | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-AUTH-03 | Session de 12 h maximum, verrouillage après 30 min d'inactivité | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AUTH-04 | « Déconnecter partout » pour soi et, côté super admin, pour un membre de l'équipe | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-ROLE-01 | Rôle **super admin** : tous les droits, tous les accès, en permanence (décision de Tony) | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-ROLE-02 | Sept pôles : Confiance, Membres, Commerce, Contenus, Produit et IA, Croissance, Technique. Rattachement des 38 | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-ROLE-03 | Dans un pôle : rôle **responsable** (agit, valide les demandes des autres, règle son pôle) ou **membre** (acti | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-ROLE-04 | Élévation temporaire d'un membre de pôle vers un droit hors de son pôle : 1 h, motif obligatoire, journalisée | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-ROLE-05 | `admin_roles` (et les nouvelles tables de pôles) sont la seule source de vérité du rôle ; `public.is_admin()`  | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-ROLE-06 | Au moins deux comptes super admin peuvent exister ; chaque connexion super admin depuis un appareil nouveau dé | non prouvé | aucun test exécuté |
| EX-ROLE-07 | **Mode solo** : tant qu'un seul compte humain de l'équipe est actif, le super admin valide ses propres demande | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-INBOX-01 | Une seule file unifiée : 8 tables de signalements, SOS, tickets, demandes à valider, contributions, alertes te | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-INBOX-02 | Tri : urgence haute > délai le plus proche > ancienneté ; groupes visuels « Urgence haute », « Délai bientôt d | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-INBOX-03 | Compte à rebours de délai par élément : gris (> 5 min), orange (≤ 5 min ou ≤ 20 % du délai), rouge (dépassé) | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-INBOX-04 | Mise à jour en temps réel, sans rechargement ; présence des collègues (« X traite ce cas ») | non prouvé | aucun test exécuté |
| EX-INBOX-05 | Navigation `J` / `K`, `Entrée` pour ouvrir ; cas suivant préchargé | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-INBOX-06 | Progression du jour et série de jours où la file a été tenue ; aucun classement entre personnes | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-INBOX-07 | Traitement en lot des cas évidents (contributions, spam sûr) avec aperçu avant validation | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-01 | Carte de décision : 4 informations clés (quoi, qui, signalements, depuis) + 3 actions principales (Masquer `M` | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-02 | Images signalées grisées et floutées par défaut, nettes au survol ou au toucher prolongé | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-03 | Motif obligatoire choisi dans `admin.reason_codes` pour toute action restrictive ; précision libre facultative | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-04 | Message au membre généré depuis le motif, conforme à l'article 17 du DSA (faits, règle, recours à l'automatisa | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-05 | Annulation possible 10 s après masquer / laisser / approuver ; l'annulation est elle-même journalisée | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-06 | Échelle de sanctions graduée : message privé → masquage → suspension 7 j → 30 j → bannissement ; expiration de | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-07 | Bannissement : saisie du pseudo pour confirmer ; hors mode solo, validation par un second humain | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-08 | Contexte à côté de la décision : historique du membre, cas liés (même auteur, mêmes cibles, blocages), avertis | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-09 | Suggestion de l'IA affichée **après** l'affichage du contenu, avec niveau de confiance ; jamais de bouton « ap | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-10 | Plafond de cas sensibles par session (10 par défaut, réglable) puis pause proposée | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-11 | Recours (DSA art. 20) : le membre conteste depuis LKDV pendant 6 mois ; le recours arrive dans la file, attrib | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MOD-12 | Contenu masqué invisible des autres membres, visible de son auteur avec un bandeau « masqué par la modération  | non prouvé | aucun test exécuté |
| EX-MEM-01 | Fiche membre 360° en trois colonnes (identité, activité, contexte), conforme à `Membre.dc.html` | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MEM-02 | Données personnelles masquées par défaut ; affichage d'un clic, journalisé | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-MEM-03 | Résumé IA en 3 lignes, marqué « à relire » ; jamais d'accès IA aux documents d'identité ni à `user_orientation | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MEM-04 | Statut de compte : actif, suspendu (jusqu'à une date), banni ; effet immédiat en écriture dans LKDV et à la co | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MEM-05 | Export RGPD et suppression de compte en commandes métier, journalisées, avec délai de grâce de 30 jours pour l | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MEM-06 | Notes internes sur un membre (jamais visibles du membre) | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-COM-01 | **Tout remboursement, quel que soit le montant, est validé** (décision de Tony) : préparé par A (humain ou age | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-COM-02 | Le montant remboursable est calculé côté serveur et réservé à la demande ; deux demandes simultanées ne peuven | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-COM-03 | La validation est liée aux valeurs exactes (montant, paiement, commande) par empreinte ; toute modification l' | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-COM-04 | Exécution Stripe côté serveur uniquement, avec clé d'idempotence ; résultat journalisé ; notification au membr | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-COM-05 | Les autres actions d'argent (libération de paiement vendeur, crédit boutique manuel, retrait de récompenses, c | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-AGT-01 | Chaque agent a sa propre identité (compte de service Supabase), son pôle, sa liste fermée d'outils, son plafon | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-02 | Un agent propose ; il ne valide jamais ; il n'est jamais super admin | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-03 | Les agents appellent les mêmes commandes métier que les humains, via le serveur MCP du CRM (`/api/mcp`) | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-04 | Les contenus des membres lus par un agent sont traités comme des données, jamais comme des instructions | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-05 | Bouton d'arrêt par agent et « Arrêter tous les agents » ; effet en moins de 5 s | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-06 | Écran agents conforme à `Agents.dc.html` : activité 24 h, taux de propositions acceptées, plafond, outils | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-07 | Relecture hebdomadaire d'un échantillon de 10 décisions d'agents | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-AGT-08 | Modèles : NVIDIA NIM (règle LKDV) ; aucun autre fournisseur | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-AGT-09 | Agents livrés au départ : Trieur de signalements, Remboursements, Support, Résumeur de fiches, Relecteur de fi | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-RT-01 | Canaux privés `admin:*` (Supabase Realtime, autorisation par RLS sur `realtime.messages`) réservés à l'équipe | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-RT-02 | Événements : nouveaux signalements, SOS, tickets, demandes à valider, décisions prises, présence | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-RT-03 | Reprise après coupure : à la reconnexion, la file est rechargée depuis la base (le temps réel accélère, la bas | non prouvé | aucun test exécuté |
| EX-RT-04 | Côté LKDV, un contenu masqué disparaît des écrans ouverts sans rechargement | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-SEC-01 | Journal `admin.audit_log` en ajout seul ; chaque commande écrit dans la même transaction | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-SEC-02 | Consultations sensibles journalisées (fiche, e-mail, téléphone, conversation privée, document d'identité) | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-SEC-03 | Conservation : décisions 3 ans, consultations 1 an ; purge automatique | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-SEC-04 | Clé `service_role` uniquement côté serveur, jamais dans le navigateur | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-SEC-05 | Correction des constats du 8/11 : `hub_dashboard_kpis` et `public_profiles` en `security_invoker`, `EXECUTE` r | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-SEC-06 | Lecture d'une conversation privée signalée : motif, ouverture limitée, rapport hebdomadaire | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-SEC-07 | Documents d'identité (`trip_documents`) : jamais visibles des tiers, des pôles ni des agents ; consultables pa | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-SEC-08 | Bandeau d'information à la connexion : les accès sont journalisés | prouvé (local, rejouable) | preuves/db/RAPPORT.md, preuves/base, preuves/runtime |
| EX-LKDV-01 | Filtrage des contenus masqués par politiques restrictives sur `community_posts`, `post_comments`, `carnet_*_co | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-LKDV-02 | Un auteur ne peut pas modifier lui-même l'état de modération (verrou de colonnes) | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-LKDV-03 | Compte suspendu ou banni : écriture refusée (politiques restrictives) et connexion refusée pour un banni (`aut | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-LKDV-04 | Notification de modération avec motif et bouton « Contester » ; écran de recours | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-LKDV-05 | Suppression de `src/app/admin`, `src/app/api/admin`, de l'entrée `ADMIN_ROUTES` du middleware ; `/admin` → 404 | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-LKDV-06 | Aucune régression : tests LKDV existants identiques avant / après | bloqué par Tony (voir ETAT.md) | P3/P4 : déploiement et migrations de production bloqués |
| EX-UX-01 | Conformité visuelle aux 8 écrans de la maquette (jetons, typographie, rayons, verre, densité) | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-UX-02 | La checklist des 40 contrôles (`05_UI_UX_DESIGN.md` § 8) est cochée pour chaque écran | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-UX-03 | Barre de commande `⌘K` / `Ctrl+K` : recherche globale (membres, commandes, contenus, tickets) et actions autor | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-UX-04 | Bac à sable : 10 faux cas pour s'entraîner, retour à chaque décision | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-UX-05 | Messages d'erreur : cause, solution, saisie conservée, jamais de code brut (`42501` → phrase métier) | non prouvé | aucun test exécuté |
| EX-PERF-01 | Accusé de réception visuel < 100 ms ; réponse complète < 400 ms (p95) ; ouverture de la file < 1,5 s | non prouvé | aucun test exécuté |
| EX-PERF-02 | Listes de 10 000 lignes fluides (virtualisation) | non prouvé | aucun test exécuté |
| EX-MOB-01 | SOS, file et décisions utilisables sur téléphone (390 px), conforme à `SOS.dc.html` | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-SOS-01 | SOS = urgence haute : notification push immédiate, e-mail après 5 min sans « Je prends », escalade vers le sup | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-SOS-02 | Fiche SOS : appel au numéro d'urgence du pays (112 en Europe), dernière position (visible pendant l'alerte seu | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-SOS-03 | Calendrier d'astreinte et rappel la veille | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MES-01 | Indicateurs du CRM : temps médian par cas, part de décisions annulées ou renversées en recours, part traitée d | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MES-02 | Questionnaire UMUX-Lite (2 questions) mensuel dans le CRM | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-MES-03 | Les journaux ne servent jamais à mesurer le temps de travail individuel | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |
| EX-A11Y-01 | WCAG 2.2 AA : axe sans violation, contraste AA, focus visible, équivalent au clic pour tout glisser-déposer, c | partiel — code + tests écrits, non exécuté en production | code + tests écrits ; exécution E2E/visuelle impossible sans base migrée (P4) |

## Synthèse

- **partiel — code + tests écrits, non exécuté en production** : 53
- **bloqué par Tony (voir ETAT.md)** : 14
- **prouvé (local, rejouable)** : 14
- **non prouvé** : 7
- **Total** : 88
