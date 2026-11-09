# Cahier des charges — LKDV Control

Chaque exigence a un identifiant `EX-…`, une formulation vérifiable et un critère d'acceptation (CA). Les décisions de Tony du 8 novembre 2026 sont intégrées. Sources : `references/RECHERCHE_CRM.md` (audit + recherche) et la maquette.

## 1. Produit

| ID | Exigence | Critère d'acceptation |
| --- | --- | --- |
| EX-GEN-01 | LKDV Control est une application séparée de LKDV, servie sur `lkdv-control.vercel.app` (projet Vercel distinct, dossier `crm/` du dépôt) | Aucun lien, route ou cookie partagé avec `lekitduvoyageur.fr` ; `robots: noindex` ; en-tête `X-Robots-Tag: noindex` |
| EX-GEN-02 | Les deux applications partagent une seule base : Supabase `icxyvwzfjbflcbqukpfz` | Une action faite dans le CRM est visible dans LKDV en moins de 2 s (test E2E croisé) |
| EX-GEN-03 | Les 144 actions de `04_CATALOGUE_ACTIONS.md` sont disponibles dans le CRM, chacune par l'interface **et** par la barre de commande | Test E2E par action ; la barre de commande liste exactement les actions autorisées au rôle connecté |
| EX-GEN-04 | Toute écriture passe par une commande métier côté serveur, jamais par un `update` direct depuis le navigateur | Aucune écriture de table depuis le client (analyse statique du code `crm/`) ; toutes les écritures passent par `admin.cmd_*` ou une route serveur |
| EX-GEN-05 | Interface en français ; identifiants de code en anglais | Revue de libellés ; aucun texte anglais visible |

## 2. Identité, rôles, pôles

| ID | Exigence | CA |
| --- | --- | --- |
| EX-AUTH-01 | Connexion par Supabase Auth (même projet), réservée aux comptes de l'équipe | Un membre LKDV ordinaire est refusé avec un message clair |
| EX-AUTH-02 | Double authentification obligatoire (TOTP) ; enrôlement guidé à la première connexion ; sans niveau `aal2`, aucun écran ni aucune commande | Test : session `aal1` refusée en base (`admin.assert_staff`) et dans le middleware |
| EX-AUTH-03 | Session de 12 h maximum, verrouillage après 30 min d'inactivité | Test avec horloge simulée |
| EX-AUTH-04 | « Déconnecter partout » pour soi et, côté super admin, pour un membre de l'équipe | Les sessions révoquées n'accèdent plus à rien (test) |
| EX-ROLE-01 | Rôle **super admin** : tous les droits, tous les accès, en permanence (décision de Tony) | Matrice de droits : aucune commande refusée au super admin, sauf l'auto-validation hors mode solo |
| EX-ROLE-02 | Sept pôles : Confiance, Membres, Commerce, Contenus, Produit et IA, Croissance, Technique. Rattachement des 38 domaines selon `04_CATALOGUE_ACTIONS.md` | Table `admin.poles` peuplée ; chaque commande a un pôle |
| EX-ROLE-03 | Dans un pôle : rôle **responsable** (agit, valide les demandes des autres, règle son pôle) ou **membre** (actions courantes) | Tests de la matrice `02_ARCHITECTURE.md` § 5 |
| EX-ROLE-04 | Élévation temporaire d'un membre de pôle vers un droit hors de son pôle : 1 h, motif obligatoire, journalisée | Test : droit expiré après 60 min |
| EX-ROLE-05 | `admin_roles` (et les nouvelles tables de pôles) sont la seule source de vérité du rôle ; `public.is_admin()` les lit | Les 6 comptes existants gardent tous leurs droits (super admin) |
| EX-ROLE-06 | Au moins deux comptes super admin peuvent exister ; chaque connexion super admin depuis un appareil nouveau déclenche une alerte | Test d'alerte |
| EX-ROLE-07 | **Mode solo** : tant qu'un seul compte humain de l'équipe est actif, le super admin valide ses propres demandes en deux temps (file « À valider » puis confirmation en tapant le montant) ; journal « validé seul (mode solo) » ; le mode se coupe automatiquement dès un 2e compte humain actif | Tests : solo actif → auto-validation possible ; 2e compte actif → auto-validation refusée en base |

## 3. File « À traiter » (accueil)

| ID | Exigence | CA |
| --- | --- | --- |
| EX-INBOX-01 | Une seule file unifiée : 8 tables de signalements, SOS, tickets, demandes à valider, contributions, alertes techniques, propositions d'agents | Chaque source a un test d'apparition dans la file |
| EX-INBOX-02 | Tri : urgence haute > délai le plus proche > ancienneté ; groupes visuels « Urgence haute », « Délai bientôt dépassé », « À valider », « Signalements et contributions » | Test d'ordre |
| EX-INBOX-03 | Compte à rebours de délai par élément : gris (> 5 min), orange (≤ 5 min ou ≤ 20 % du délai), rouge (dépassé) | Test visuel et unitaire |
| EX-INBOX-04 | Mise à jour en temps réel, sans rechargement ; présence des collègues (« X traite ce cas ») | Test E2E à deux sessions |
| EX-INBOX-05 | Navigation `J` / `K`, `Entrée` pour ouvrir ; cas suivant préchargé | Test clavier ; temps d'ouverture du cas suivant < 100 ms |
| EX-INBOX-06 | Progression du jour et série de jours où la file a été tenue ; aucun classement entre personnes | Revue : aucun compteur individuel comparatif |
| EX-INBOX-07 | Traitement en lot des cas évidents (contributions, spam sûr) avec aperçu avant validation | Test |

## 4. Modération

| ID | Exigence | CA |
| --- | --- | --- |
| EX-MOD-01 | Carte de décision : 4 informations clés (quoi, qui, signalements, depuis) + 3 actions principales (Masquer `M`, Laisser `L`, Sanctionner `S`) + « … » | Conformité maquette `Moderation.dc.html` |
| EX-MOD-02 | Images signalées grisées et floutées par défaut, nettes au survol ou au toucher prolongé | Test visuel |
| EX-MOD-03 | Motif obligatoire choisi dans `admin.reason_codes` pour toute action restrictive ; précision libre facultative | Commande refusée sans motif (test base) |
| EX-MOD-04 | Message au membre généré depuis le motif, conforme à l'article 17 du DSA (faits, règle, recours à l'automatisation, voies de recours), aperçu avant envoi | Test du contenu de la notification |
| EX-MOD-05 | Annulation possible 10 s après masquer / laisser / approuver ; l'annulation est elle-même journalisée | Test |
| EX-MOD-06 | Échelle de sanctions graduée : message privé → masquage → suspension 7 j → 30 j → bannissement ; expiration des avertissements à 1 an ; tolérance zéro (mineurs) hors échelle | Tests de progression et d'expiration |
| EX-MOD-07 | Bannissement : saisie du pseudo pour confirmer ; hors mode solo, validation par un second humain | Test |
| EX-MOD-08 | Contexte à côté de la décision : historique du membre, cas liés (même auteur, mêmes cibles, blocages), avertissements actifs, règle concernée | Conformité maquette |
| EX-MOD-09 | Suggestion de l'IA affichée **après** l'affichage du contenu, avec niveau de confiance ; jamais de bouton « appliquer la suggestion » | Test d'ordre d'affichage |
| EX-MOD-10 | Plafond de cas sensibles par session (10 par défaut, réglable) puis pause proposée | Test |
| EX-MOD-11 | Recours (DSA art. 20) : le membre conteste depuis LKDV pendant 6 mois ; le recours arrive dans la file, attribué à une autre personne que l'auteur de la décision (en mode solo : au super admin, avec mention) | Test bout en bout |
| EX-MOD-12 | Contenu masqué invisible des autres membres, visible de son auteur avec un bandeau « masqué par la modération » et le lien « Contester » | Test LKDV |

## 5. Membres

| ID | Exigence | CA |
| --- | --- | --- |
| EX-MEM-01 | Fiche membre 360° en trois colonnes (identité, activité, contexte), conforme à `Membre.dc.html` | Conformité maquette |
| EX-MEM-02 | Données personnelles masquées par défaut ; affichage d'un clic, journalisé | Test journal |
| EX-MEM-03 | Résumé IA en 3 lignes, marqué « à relire » ; jamais d'accès IA aux documents d'identité ni à `user_orientation` | Test : le contexte envoyé au modèle ne contient pas ces champs |
| EX-MEM-04 | Statut de compte : actif, suspendu (jusqu'à une date), banni ; effet immédiat en écriture dans LKDV et à la connexion | Tests LKDV |
| EX-MEM-05 | Export RGPD et suppression de compte en commandes métier, journalisées, avec délai de grâce de 30 jours pour la suppression | Tests |
| EX-MEM-06 | Notes internes sur un membre (jamais visibles du membre) | Test RLS |

## 6. Commerce et argent

| ID | Exigence | CA |
| --- | --- | --- |
| EX-COM-01 | **Tout remboursement, quel que soit le montant, est validé** (décision de Tony) : préparé par A (humain ou agent), validé par B humain ≠ A, sauf mode solo | Test base : auto-validation refusée hors mode solo |
| EX-COM-02 | Le montant remboursable est calculé côté serveur et réservé à la demande ; deux demandes simultanées ne peuvent dépasser le paiement d'origine | Test de concurrence |
| EX-COM-03 | La validation est liée aux valeurs exactes (montant, paiement, commande) par empreinte ; toute modification l'annule | Test |
| EX-COM-04 | Exécution Stripe côté serveur uniquement, avec clé d'idempotence ; résultat journalisé ; notification au membre | Test en mode test Stripe |
| EX-COM-05 | Les autres actions d'argent (libération de paiement vendeur, crédit boutique manuel, retrait de récompenses, changement de prix) suivent le même circuit de validation | Tests |

## 7. Agents IA

| ID | Exigence | CA |
| --- | --- | --- |
| EX-AGT-01 | Chaque agent a sa propre identité (compte de service Supabase), son pôle, sa liste fermée d'outils, son plafond d'actions par heure | Table `admin.agents` ; tests de refus hors liste |
| EX-AGT-02 | Un agent propose ; il ne valide jamais ; il n'est jamais super admin | Test base : toute validation par un agent est refusée |
| EX-AGT-03 | Les agents appellent les mêmes commandes métier que les humains, via le serveur MCP du CRM (`/api/mcp`) | Test d'appel MCP |
| EX-AGT-04 | Les contenus des membres lus par un agent sont traités comme des données, jamais comme des instructions | Banc de tests d'injection (07_VERIFICATION.md, couche 8) : 0 action déclenchée |
| EX-AGT-05 | Bouton d'arrêt par agent et « Arrêter tous les agents » ; effet en moins de 5 s | Test |
| EX-AGT-06 | Écran agents conforme à `Agents.dc.html` : activité 24 h, taux de propositions acceptées, plafond, outils | Conformité maquette |
| EX-AGT-07 | Relecture hebdomadaire d'un échantillon de 10 décisions d'agents | Fonction présente, test |
| EX-AGT-08 | Modèles : NVIDIA NIM (règle LKDV) ; aucun autre fournisseur | Analyse statique des appels réseau |
| EX-AGT-09 | Agents livrés au départ : Trieur de signalements, Remboursements, Support, Résumeur de fiches, Relecteur de fiches pays, Surveillant d'erreurs | Les 6 existent, droits conformes à `Agents.dc.html` |

## 8. Temps réel

| ID | Exigence | CA |
| --- | --- | --- |
| EX-RT-01 | Canaux privés `admin:*` (Supabase Realtime, autorisation par RLS sur `realtime.messages`) réservés à l'équipe | Test : membre ordinaire refusé |
| EX-RT-02 | Événements : nouveaux signalements, SOS, tickets, demandes à valider, décisions prises, présence | Test par événement |
| EX-RT-03 | Reprise après coupure : à la reconnexion, la file est rechargée depuis la base (le temps réel accélère, la base fait foi) | Test de coupure réseau |
| EX-RT-04 | Côté LKDV, un contenu masqué disparaît des écrans ouverts sans rechargement | Test E2E |

## 9. Sécurité et vie privée

| ID | Exigence | CA |
| --- | --- | --- |
| EX-SEC-01 | Journal `admin.audit_log` en ajout seul ; chaque commande écrit dans la même transaction | UPDATE/DELETE/TRUNCATE refusés (test) |
| EX-SEC-02 | Consultations sensibles journalisées (fiche, e-mail, téléphone, conversation privée, document d'identité) | Tests |
| EX-SEC-03 | Conservation : décisions 3 ans, consultations 1 an ; purge automatique | Test de la tâche de purge |
| EX-SEC-04 | Clé `service_role` uniquement côté serveur, jamais dans le navigateur | Analyse du bundle client |
| EX-SEC-05 | Correction des constats du 8/11 : `hub_dashboard_kpis` et `public_profiles` en `security_invoker`, `EXECUTE` retiré à `anon` sur les fonctions `SECURITY DEFINER` non publiques, policy explicite sur les 41 tables sans policy, protection des mots de passe divulgués | Advisors Supabase : 0 erreur |
| EX-SEC-06 | Lecture d'une conversation privée signalée : motif, ouverture limitée, rapport hebdomadaire | Test |
| EX-SEC-07 | Documents d'identité (`trip_documents`) : jamais visibles des tiers, des pôles ni des agents ; consultables par le super admin seul, avec motif, ouverture de 15 min, journal | Tests ; mise à jour de la règle dans `CLAUDE.md` |
| EX-SEC-08 | Bandeau d'information à la connexion : les accès sont journalisés | Présent |

## 10. LKDV (application publique)

| ID | Exigence | CA |
| --- | --- | --- |
| EX-LKDV-01 | Filtrage des contenus masqués par politiques restrictives sur `community_posts`, `post_comments`, `carnet_*_comments`, `place_reviews`, `product_reviews`, `post_stories`, `club_topics`, `club_topic_replies` | Tests RLS par rôle |
| EX-LKDV-02 | Un auteur ne peut pas modifier lui-même l'état de modération (verrou de colonnes) | Test : la mise à jour est refusée |
| EX-LKDV-03 | Compte suspendu ou banni : écriture refusée (politiques restrictives) et connexion refusée pour un banni (`auth.users.banned_until` via l'API admin, côté serveur) | Tests |
| EX-LKDV-04 | Notification de modération avec motif et bouton « Contester » ; écran de recours | Test bout en bout |
| EX-LKDV-05 | Suppression de `src/app/admin`, `src/app/api/admin`, de l'entrée `ADMIN_ROUTES` du middleware ; `/admin` → 404 | Test |
| EX-LKDV-06 | Aucune régression : tests LKDV existants identiques avant / après | Comparaison des rapports |

## 11. Expérience, accessibilité, performance

| ID | Exigence | CA |
| --- | --- | --- |
| EX-UX-01 | Conformité visuelle aux 8 écrans de la maquette (jetons, typographie, rayons, verre, densité) | Couche 6 de vérification : écart visuel ≤ seuil défini |
| EX-UX-02 | La checklist des 40 contrôles (`05_UI_UX_DESIGN.md` § 8) est cochée pour chaque écran | Rapport par écran |
| EX-UX-03 | Barre de commande `⌘K` / `Ctrl+K` : recherche globale (membres, commandes, contenus, tickets) et actions autorisées | Test |
| EX-UX-04 | Bac à sable : 10 faux cas pour s'entraîner, retour à chaque décision | Présent |
| EX-UX-05 | Messages d'erreur : cause, solution, saisie conservée, jamais de code brut (`42501` → phrase métier) | Revue + tests |
| EX-A11Y-01 | WCAG 2.2 AA : axe sans violation, contraste AA, focus visible et jamais masqué, équivalent au clic pour tout glisser-déposer, cibles ≥ 44 px | Couche 5 |
| EX-PERF-01 | Accusé de réception visuel < 100 ms ; réponse complète < 400 ms (p95) ; ouverture de la file < 1,5 s | Couche 7 |
| EX-PERF-02 | Listes de 10 000 lignes fluides (virtualisation) | Test de charge |
| EX-MOB-01 | SOS, file et décisions utilisables sur téléphone (390 px), conforme à `SOS.dc.html` | Tests mobile |

## 12. Astreinte et urgences

| ID | Exigence | CA |
| --- | --- | --- |
| EX-SOS-01 | SOS = urgence haute : notification push immédiate, e-mail après 5 min sans « Je prends », escalade vers le super admin | Test avec horloge simulée |
| EX-SOS-02 | Fiche SOS : appel au numéro d'urgence du pays (112 en Europe), dernière position (visible pendant l'alerte seulement, consultation journalisée), contacts d'urgence déclarés | Conformité `SOS.dc.html` |
| EX-SOS-03 | Calendrier d'astreinte et rappel la veille | Présent |

## 13. Mesure

| ID | Exigence | CA |
| --- | --- | --- |
| EX-MES-01 | Indicateurs du CRM : temps médian par cas, part de décisions annulées ou renversées en recours, part traitée dans les délais | Écran « Pilotage » |
| EX-MES-02 | Questionnaire UMUX-Lite (2 questions) mensuel dans le CRM | Présent |
| EX-MES-03 | Les journaux ne servent jamais à mesurer le temps de travail individuel | Revue |
