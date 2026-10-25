# LKDV — Progression canonique et direction mobile : design

19 septembre 2026 · Base : branche `feat/unified-progression-rankings-uiux` (commit 34b52f47), 11 commits au-dessus de `main` (677acd96).
Spec de référence du programme. Intègre les décisions validées par le porteur du projet, dont les huit corrections de la section « Données, moteur et sécurité ».

## 1. Objectif et principes

Rendre la progression **réelle, serveur-autoritaire et vérifiable**, l'intégrer à la direction produit mobile (préparer, vivre, partager, progresser) et couvrir les exigences de lancement international.

1. **Un seul moteur d'attribution** : le Reward Engine existant, étendu. La progression est une projection des gains validés.
2. **Une action métier → une décision d'attribution → un gain global → plusieurs projections cohérentes.**
3. **Le client ne choisit jamais** points, compétences ou saison. Il transmet des faits ; le serveur décide.
4. **Aucune donnée de démonstration** : pas de faux utilisateurs, pas de rang codé en dur, pas de défaut géographique, pas de fallback `user_demo`. L'inconnu est distinct de zéro.
5. **Préserver l'existant** : soldes, droits, badges, historique ; migration additive ; pas de réécriture silencieuse.

## 2. Moteur canonique, données et sécurité

### 2.1 Gain canonique dans `reward_transactions`

Colonnes additives :

| Colonne | Rôle |
|---|---|
| `idempotency_key TEXT UNIQUE` | Occurrence métier : `<source>:<source_id>` (ex. `hike_session:<uuid>`), parfois `<source>:<user_id>:<source_id>` (ex. `trail_prep:<user>:<route_id>`). **Jamais de `rules_version` dans la clé.** |
| `effective_at TIMESTAMPTZ` | Date métier réelle de l'action. |
| `season_id TEXT REFERENCES progression_seasons(id)` | Saison résolue à l'attribution par la politique de grâce. |
| `rules_version TEXT NOT NULL DEFAULT 'v1'` | Version des règles appliquées (information, pas dans la clé). |
| `skill_allocations JSONB` | **Montants par compétence** : `[{skill, weight, points}]`. Pour un gain positif : `SUM(points) = points` exactement ; arrondi déterministe (plus fort reste) ; structure validée en base. |
| `counts_for_progression BOOLEAN NOT NULL DEFAULT false` | Marquage explicite. |
| `affects_balance BOOLEAN NOT NULL DEFAULT true` | Marquage explicite ; une attribution de progression pure ne crée aucun droit économique. |

Types d'écriture :
- Types existants (like, comment, post, carnet, message groupe, referral, redemption, expiration, fraude, admin) : comportement économique inchangé ; projection progression seulement si la version de règles les mappe explicitement.
- Nouveau type `PROGRESSION_AWARD` : progression uniquement, `affects_balance = false`.
- `FRAUD_REVERSAL` : référence le gain original (`reference_id` + `metadata.original_transaction_id`), suit l'outbox, produit une allocation négative. Aucune suppression de ligne.

Le trigger `update_reward_account_on_transaction` est audité et adapté **avant** toute nouvelle écriture : il ignore `affects_balance = false`. `user_progression` est une projection distincte, jamais un second solde économique.

### 2.2 Décisions journalisées

`progression_decisions` : `idempotency_key PK`, `user_id`, `action_type`, `source_type`, `source_id`, `outcome` (`awarded` | `awarded_lifetime_only` | `refused` | `duplicate`), `reason`, `reward_transaction_id NULL`, `rules_version`, `created_at`.
Chaque producteur insère sa décision (`INSERT … ON CONFLICT DO NOTHING RETURNING`). Clé existante → décision renvoyée telle quelle : le rejeu est explicable, y compris refus et gains nuls.

### 2.3 Outbox et consommateur atomique

`progression_outbox` : `id`, `reward_transaction_id UUID NOT NULL UNIQUE REFERENCES reward_transactions(id)`, `user_id`, `season_id`, `status` (`pending|processing|processed|failed|dead`), `attempts`, `available_at`, `locked_at`, `processed_at`, `last_error`, `payload_snapshot JSONB`.
Écrit dans la même transaction que le gain (trigger sur les types mappés).
Consommateur `process_progression_outbox(p_limit)` : `FOR UPDATE SKIP LOCKED`, une transaction par lot ; pour chaque ligne : réservation, détection de rejeu, journal `progression_events`, cumuls `user_progression` et `user_season_progress`, progression des défis, marquage `processed` — **tout réussit ensemble**. Reprises avec backoff (`attempts`, `available_at`), passage `failed` puis `dead` avec alerte (compteur exposé au healthcheck). Exécution : cron protégé par `CRON_SECRET` + rôle serveur uniquement.

### 2.4 Projections

- `progression_events` : `reward_transaction_id UNIQUE`, `season_id`, `rules_version`, `effective_at`, `skill_allocations` (montants), `points_total`, `is_reversed`, `explanation`, `idempotency_key UNIQUE`.
- `user_season_progress (user_id, season_id)` : cumuls et compétences de la saison ; `user_progression` expose la saison courante et le cumul permanent.
- `rebuild_progression_from_ledger(p_user_id)` : reconstruction admin/service à partir des décisions et allocations **enregistrées** ; ne réapplique jamais les barèmes courants ; ne déclenche aucune récompense ; ne recrédite rien.
- Compensation : une fraude confirmée crée `FRAUD_REVERSAL` (ledger) → outbox → allocation négative ; le rebuild rejoue la compensation.

### 2.5 Saisons

`progression_seasons` : dates figées, `rules_version`, statut. Résolution : `effective_at` dans la fenêtre de la saison ; retard ≤ grâce (défaut 14 j, configurable) → saison prévue, même terminée, sans écraser la saison courante ; au-delà → décision `refused` / `awarded_lifetime_only` selon la politique configurée (défaut : refus consigné). `close_progression_season` fige les agrégats et marque terminée ; aucune remise à zéro destructive.

### 2.6 Règles versionnées

`progression_rules` : `version` PK, seuils de niveau, matrice action → poids, barèmes, plafonds jour/semaine/saison, rendements décroissants, durée de saison, seuil de participants, délai de grâce, politique événements tardifs, mapping type de transaction → projection. Version `v1` seedée. Un changement de version ne recrédite jamais une action passée.

### 2.7 Sécurité et autorisation

- REVOKE `EXECUTE` pour `PUBLIC`, `anon`, `authenticated` sur toute fonction d'attribution, de compensation, de consommation d'outbox et de rebuild ; `GRANT EXECUTE` au rôle serveur (`service_role`) ; `search_path` figé.
- Contrôle d'identité : `auth.uid() = p_user_id` uniquement pour les appels utilisateur. Les appels serveur (cron, service) sont autorisés par rôle explicite puis vérifient le propriétaire **depuis la source métier**. **Un UID nul n'autorise jamais.**
- `claim_reward_points` durcie : identité, existence/propriété de la cible selon l'action, clé d'idempotence, unicité `(user_id, action_type, target_id)` sur `pending_contributions`.
- RLS : écritures directes client révoquées sur ledger, projections, outbox, décisions, rattachements validés. Les tables sensibles n'ont aucune policy client.
- Territoire : `user_territory` (déclaré, identifiants stables) et `user_territory_private` (coordonnées, consentement, verrou), lisibles par le propriétaire et le serveur uniquement. Aucune coordonnée, distance ou UUID dans les payloads de classement.

### 2.8 Historique et correspondance versionnée

`progression_legacy_mapping` : `user_id`, source (`xp`, `level`, `loyalty`), valeur, `mapped_lifetime_points`, `mapping_version`, `applied_at`. Le niveau atteint est conservé comme plancher honorifique ; aucune saison rétroactive, aucune compétence inventée. Les colonnes legacy (`xp`, `level`, `loyalty_points`) deviennent lecture seule (garde d'écriture), leurs règles d'affichage existantes préservées.

## 3. Producteurs

### 3.1 Prêts à brancher (preuve serveur existante)

| Producteur | Source et preuve | Déclencheur | Barème v1 | Poids | Clé |
|---|---|---|---|---|---|
| Session de randonnée traitée | `hike_sessions.processing_status='processed'` + passages/observations écrits par le processeur | fin du cron `process-hike-sessions` | 40 + paliers sur métriques serveur (passages, qualité), plafond 150 | Explorer 1.0 | `hike_session:<id>` |
| Activité préparée depuis un sentier réel | `prepareActivityFromTrail` résultat `created` (index unique user+route) | service serveur après création | 30, une fois par sentier | Se préparer 1.0 | `trail_prep:<user>:<route_id>` |
| Débrief terrain du kit | `kit_field_reports` sur session `processed` portant le kit (durci) | POST `/api/kits/[id]/field-report` | 20 + 2/élément, plafond 40 | Se préparer 0.7 · Partager 0.3 | `kit_report:<session_id>` |
| Avis de lieu publié | `place_reviews` unicité `(place_id, author_id)` | Server Action `addPlaceReviewAction` | 15 ; +25 si preuve terrain recalculée serveur ; édition sans recrédit | Partager 1.0 | `place_review:<place_id>` |

### 3.2 À compléter dans ce programme

| Producteur | Preuve à finir | Critères proposés | Poids |
|---|---|---|---|
| Carnet publié | publication réelle (visibilité ≠ privée) + lien voyage/session + moments/médias | ≥ 3 moments ou ≥ 1 média ; points à la publication, pas à la création | Partager 1.0 |
| Checklist complétée | RPC de clôture « 100 % des items dus faits », une fois par voyage | voyage planifié/actif, date de départ encadrée | Se préparer 1.0 |
| Voyage terminé | automate d'état + au moins une preuve serveur (session traitée liée, checklist, POI visités) | transition contrôlée vers `completed` | Explorer 0.7 · Se préparer 0.3 |

Chacun reste **désactivé** jusqu'à validation livrée et testée.

### 3.3 Désactivés, documentés

Parrainage, SOS, découverte attestée, import GPX comme réalisation, participation aux sorties, défis de club, signalements de lieu, entretien/réparation, kit adapté (score client), tâches collectives (pas de validation croisée), prêt restitué (`borrower_id` jamais renseigné), contributions club (pas de critère), Q&A (flux inexistant), Terrain Live (flag produit OFF), fidélité/xp legacy (écritures client). Chaque cas est listé avec ce qui manque pour l'activer.

### 3.4 Règles communes

Clé d'idempotence générée serveur ; `effective_at` = date métier ; grâce configurable ; plafonds et rendements décroissants explicites (même sentier dans la saison : ×0.5 puis ×0.25, affichés) ; exclusion des achats, dépenses, valeur du matériel, clics, connexions, temps d'écran, messages privés, créations/suppressions répétées ; explication du gain et de la répartition montrée à l'utilisateur ; aucun gain pour un badge ou un défi (conséquences, jamais boucles).

## 4. Classements territoriaux

Agrégats `progression_leaderboard_agg (season_id, scope_type, scope_id, user_id, season_points, level)` rafraîchis par file idempotente (`leaderboard_refresh` avec dédup par scope+utilisateur), traités par le job serveur hors transaction d'attribution. `last_refreshed_at` par scope restitué dans l'API. Le score est identique pour les cinq filtres ; seuls le groupe comparé et le rang changent.

- **Scopes** : ville, région, pays, monde (identifiants stables : codes INSEE/ISO) ; local 1 km.
- **Pagination** : keyset `(season_points DESC, user_id ASC)` ; fenêtre « mes voisins » serveur ; aucun chargement global.
- **Seuil** : minimum configurable de 5 participants éligibles, utilisateur inclus. En dessous : « Communauté en formation » + bouton « Voir ma ville ». Aucun faux joueur, aucun élargissement silencieux.
- **1 km** : calcul exclusivement serveur. Point de rattachement privé, confirmé avec consentement, sans suivi permanent, verrouillé pendant la saison (changement : règle explicite de déménagement/correction, journalisée et plafonnée). Candidats = participants consentants dans `ST_DWithin(geography, 1000 m)` du point ; l'utilisateur ne peut pas fournir de centre alternatif. Payload : alias, niveau, points de saison, rang — jamais UUID, coordonnées, distances ou cartes.
- **Anti-triangulation** : limite de consultation par utilisateur (ex. 30/h), journal d'accès, seuil qui masque les petits groupes, aucune variation de rayon. **Feature flag `local_leaderboard_active` OFF** tant que les tests (changements de centre, requêtes répétées, comptes multiples, communautés petites) ne passent pas. Les autres classements restent actifs.
- **Localisation refusée/absente** : choix manuel de commune pour les échelons administratifs (identifiant stable, pas de centre-ville inventé) ; 1 km indisponible sans rattachement privé suffisant. Participation réversible : quitter le local ne retire ni points ni niveau.
- **Vue publique** : accès via routes serveur contrôlées ; aucune vue client contournant la RLS ; `EXECUTE` restreint et `search_path` figé pour les fonctions privilégiées.

## 5. Produit et navigation

### 5.1 Cinq destinations

Registre canonique unique des destinations (href, libellés FR/EN, `matchPaths`, `aria-label`), consommé par la barre inférieure, le tiroir et les en-têtes :

| Destination | Route principale | Contenu prioritaire | Accès secondaires |
|---|---|---|---|
| Aventures | `/hub` | Aventure active, prochain départ, création | Voyages, préparation, carnets, résumé de progression |
| Explorer | `/explorer` | Carte + liste synchronisées, recherche, filtres | Détails lieux/itinéraires, recentrage |
| Matériel | `/materiel` (nouvelle surface d'entrée) | Kit actif, à préparer, ajout d'équipement | Inventaire, configurateur, prêts/réparations, boutique |
| Communauté | `/communaute` | Contenu utile et recherche d'abord | Clubs, sorties, messagerie, signalement |
| Moi | `/compte` | Profil et Ma progression | Récompenses, distinctions, préférences, confidentialité, assistance |

- Barre inférieure à 5 destinations, libellés visibles, icônes 22–24, cible ≥ 44×44, `aria-current="page"`, haptique conservée ; appui long sur Aventures → sélecteur d'aventure.
- `/groupes` retiré des états actifs ambigus (redirigé vers le Hub comme aujourd'hui, libellé aligné) ; `COMMUNITY_TABS` mort supprimé ; sous-navigation 44 px utiles ; `touch-action` cohérent.
- Un seul landmark `main#main-content` (AppShell) ; suppression des `main` dupliqués ; échelle de z-index unique (nav < sheet < modal < toast) ; focus géré au changement de route.
- Routes profondes et redirections préservées, testées une par une ; aucun bouton factice.

### 5.2 Aventures et Ma progression

- Aventures : une action dominante réelle (reprendre / terminer la préparation / préparer la première sortie) ; carte de progression compacte (niveau, rang disponible, prochain défi) **uniquement si les données existent** ; détails dans Ma progression.
- Ma progression (`/progression`) : divulgation progressive — en-tête (Points LKDV cumulés, points de saison, niveau), résumé compact, puis 4 compétences, classement (5 filtres), défis, distinctions, solde utilisable (récompenses uniquement) avec liens vers `/recompenses` et `/fidelite`. Règles économiques distinctes conservées ; une dépense ne fait jamais régresser niveau ou saison.
- Défis : un prochain défi pertinent, remplaçable (1/semaine), progression dérivée des événements canoniques ; aucune sanction d'absence.
- Distinctions : badge historique conservé en lecture + distinctions dérivées (niveau, saison, contributions vérifiées), présentation commune ; aucun gain automatique.
- Célébration brève et regroupée **après confirmation serveur** du gain (jamais sur un calcul client).
- Zéro donnée de démo : suppression des faux utilisateurs, du rang codé en dur, du défaut Chamonix, du fallback `user_demo`, du `trust_score || 50` (inconnu affiché « — »).

## 6. Direction visuelle et accessibilité

- Palette claire : fond `#F5F7F3`, surface `#FFFFFF`, texte `#172B24`, secondaire `#56665D`, action `#226148`, accent `#D3EBD9`. Sombre : fond `#101C17`, surface `#1B2D24`, texte `#F1F5F1`, tous les états complétés. Mode sombre câblé (`prefers-color-scheme` + classe `dark`), plus de verrouillage clair.
- Adaptations documentées par rapport au dossier (autonomie accordée) : police système pour le corps/UI, Manrope conservée pour les titres de marque ; verre allégé, réservé aux surfaces superposées ; topographie décorative jamais derrière du texte essentiel.
- Échelle d'espacements `4/8/12/16/24/32`, marge écran 16 ; rayons `12/16/24` ; corps 16, secondaire 14, titres 22–28 ; chiffres tabulaires ; texte agrandi géré.
- Toucher 44×44 web, adaptations natives par plateforme ; mouvement 120–220 ms, réduction d'animations respectée.
- Contraste mesuré sur le rendu composé : 4,5:1 texte courant, 3:1 grand texte et éléments non textuels ; aucun séparateur pâle comme seule frontière.
- Correctifs M01–M10 et audit desktop : M02–M10 restants (registre, sous-nav, z-index/landmarks, service worker honnête, `cleartext`/`allowMixedContent` séparés dev/release, cycle de vie natif, prefetch réseau inconnu, `trust_score`, matrice Playwright), P2 restants (dates communauté sur `/evenements`, accessibilité DOM, configurateur, accueil). Tout comportement natif non reproductible reste déclaré « non vérifié ».

## 7. Internationalisation

- Base existante : `src/lib/i18n` (dictionnaires fr/en, formatters) conservée et étendue en source de vérité : clés par domaine, interpolation, pluriels via `Intl.PluralRules`, formats nombre/date/monnaie/unités, fuseaux ; pseudo-localisation +40 % pour tester les débordements.
- FR défaut, EN complet pour toutes les clés introduites et les surfaces critiques (navigation, progression, connexion, compte, hub, explorer, communauté, réglages) ; rapport de couverture listant les chaînes restantes, sans prétendre à une traduction complète non livrée.
- Préparation RTL : propriétés logiques pour les composants nouveaux/modifiés.
- Langue, pays, fuseau, monnaie et unités distincts ; dates de saison explicites ; aucune conversion financière implicite.

## 8. Performance, exploitation, publication

- Budgets par route (JS, images, requêtes, mémoire) ; carte/3D à la demande ; listes bornées et paginées ; jamais le chargement de tous les utilisateurs.
- Mesures locales (Lighthouse/Unlighthouse) sur les routes modifiées, identifiées comme laboratoire, jamais présentées comme terrain.
- Flags serveur (mécanisme existant `domain_flags`/cohortes étendu) : `progression_awards_enabled` (kill switch), `local_leaderboard_active`, `progression_ui_v2` ; défaut sûr désactivé.
- Observabilité : logs corrélés existants ; healthcheck outbox (retard, `failed`, `dead`) et alertes documentées ; SLO proposés, non mesurés en production.
- Sauvegarde/restauration : script existant exécuté localement ; retour arrière documenté ; compatibilité des anciennes versions d'app (routes et payloads additifs).
- Publication : builds Capacitor préparés, exigences stores et confidentialité vérifiées, suppression de compte et modération effectives ; **aucun déploiement** sans autorisation.

## 9. Vérification et preuves

Tests obligatoires :
1. Double claim concurrent → un seul gain ; rejeu → décision identique.
2. Panne du processeur au milieu du lot → reprise sans double incrément.
3. Compensation `FRAUD_REVERSAL` suivie d'un rebuild → projection exacte.
4. Frontière de saison (retard ≤ grâce, > grâce) → saison correcte, saison courante intacte.
5. RLS : accès croisé entre comptes refusé ; tentative de score client refusée ; coordonnées inaccessibles.
6. Classement : même score selon les filtres ; seuil 5 ; anti-sondage (centres répétés, comptes multiples).
7. Producteurs : un événement = un gain global ; somme des allocations = gain ; aucun gain pour producteur désactivé.
8. Dépense/retrait/expiration → niveau et saison inchangés.
9. Hors ligne : synchronisation tardive → un seul gain, saison de grâce correcte.
10. E2E : action réelle → gain unique → cohérence après rechargement ; Explorer↔Hub avec et sans WebGL ; configurateur ; récupération de compte.

Preuves : captures avant/après à 390×844, 430×932, 768×1024, 1440×900, ouvertes et inspectées, avec registre (route, commit, compte de test, état des données, viewport, réseau) ; `type-check`, `lint`, tests, `build` avec les scripts du dépôt ; états chargement/vide/erreur/refus/hors ligne sur les parcours touchés. La matrice producteurs `action → source → validation → gain → répartition → plafond → test` est livrée avec le code.

## 10. Phasage

| Phase | Contenu | Critère de sortie |
|---|---|---|
| P1 Moteur | Migration additive, décisions, outbox, projection par saison, rebuild, durcissement RPC/RLS, tests SQL locaux | Tests 1–5, 7–8 verts sur Supabase local |
| P2 Producteurs | 3 existants durcis + 4 prêts + 3 à compléter ; matrice livrée | E2E gains réels, producteurs désactivés documentés |
| P3 Classement | Agrégats + job, 5 filtres, 1 km sous flag, anti-triangulation | Tests 6 verts, flag OFF documenté |
| P4 Produit/nav | 5 destinations, Aventures, Ma progression canonique, M02–M10, audit desktop | Captures + a11y, zéro donnée fictive |
| P5 Visuel | Tokens clair/sombre, typo, espacements, contraste, mouvement | Contrastes mesurés, captures avant/après |
| P6 i18n | Infra, dictionnaires, surfaces critiques, rapport de couverture | FR/EN critiques navigables, pseudo-loc testé |
| P7 Lancement | Perf locale, flags, observabilité, sauvegarde/restauration, docs stores | Rapport final implémenté/vérifié/restant |

## 11. Hors périmètre et restant à valider

- Validation native iOS/Android réelle (aucun appareil/macOS ici) : « non vérifiée ».
- Web Vitals terrain, charge à l'échelle, SLO de production : méthode fournie, mesures non revendiquées.
- Traduction EN de l'intégralité des 400+ composants : infra + surfaces critiques livrées, reste listé.
- Publication stores, migrations de production, déploiements : hors périmètre sans autorisation explicite.
- Terrain Live, Q&A, prêts, parrainage et autres producteurs désactivés : dépendances listées.

## 12. Risques

| Risque | Mitigation |
|---|---|
| Divergence projection/ledger | Rebuild reproductible + tests de compensation ; une seule écriture canonique |
| Perte de droits économiques | Types et flags explicites ; trigger auditée avant modification ; tests dédiés |
| Fuite de localisation | Calcul serveur, seuil, flag OFF, tests anti-triangulation, aucune coordonnée exposée |
| Scope trop large | Phasage strict, critères de sortie, rapport honnête à chaque phase |
| Régression design sur 400 fichiers | Tokens centraux, tests de design existants (guard hex/rayons), captures avant/après |
