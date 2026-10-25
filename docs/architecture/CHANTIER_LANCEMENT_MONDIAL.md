# CHANTIER — Lancement mondial du Kit du Voyageur

**Version :** 1.0  
**Date de référence :** 2026-09-11  
**Révision Git vérifiée :** `1c570b50791925b3f75c565ce3bb0ba2bd77eba2`  
**Branches :** `main` = `audit/adventure-intelligence`  
**Statut global :** `NO-GO production mondiale`  
**Statut autorisé :** développement, environnement local, preview, puis préproduction certifiée  
**Principe directeur :** aucune affirmation « prêt pour des millions » sans preuve distante, tests de charge représentatifs et rollout progressif.

---

## 1. Objectif produit

Livrer une boucle utilisateur unique et continue :

```text
DÉCOUVRIR
  → CRÉER UN VOYAGE
  → CHOISIR UN PARCOURS RÉEL
  → ENRICHIR AVEC LES POI ET PARTENAIRES
  → PRÉPARER KIT / BUDGET / DOCUMENTS / SÉCURITÉ
  → TÉLÉCHARGER HORS-LIGNE
  → PARTIR
  → SUIVRE LE COCKPIT
  → ÉCRIRE LE CARNET
  → TERMINER LA SORTIE
  → RELIRE ET ANONYMISER
  → PUBLIER
  → COMMENTER / RÉAGIR
  → ENRICHIR LES AGRÉGATS COLLECTIFS
  → AMÉLIORER LES PROPOSITIONS FUTURES
```

Cette boucle doit être utilisable sans navigation parallèle, écran de démonstration ou saisie manuelle d'identifiants techniques.

---

## 2. Vérité opérationnelle

### 2.1 Éléments réellement présents

- Next.js 15, React 19 et TypeScript.
- Supabase PostgreSQL/PostGIS avec RLS.
- Modules voyage, randonnée, kit, budget, sécurité, carnet, communauté, affiliation.
- Adventure Intelligence :
  - plans ;
  - versions ;
  - prédictions ;
  - profils de performance ;
  - Terrain Live ;
  - offline ;
  - groupes/treks ;
  - entitlements ;
  - consentements ;
  - feature flags ;
  - rollout.
- MapLibre, Leaflet, Capacitor, Dexie, Stripe et OpenRouter.
- Tests Vitest, Playwright, accessibilité, visuels et pgTAP.
- Export et suppression RGPD testés localement.
- Tests de charge locaux :
  - proximité PostGIS : p95 142 ms ;
  - conditions : p95 71 ms ;
  - lecture de plan SQL : p95 4,3 ms.
- Web build et synchronisation Capacitor disponibles.
- Déploiement Vercel fonctionnel.

### 2.2 Éléments non certifiés

- Base Supabase distante de test avec migrations et pgTAP en CI.
- Parcours E2E complet sur infrastructure distante.
- Charge de génération IA.
- Rate limiting distribué.
- Infrastructure multi-instance.
- Observabilité de production.
- Fournisseur commercial de tuiles.
- Couverture géographique mondiale.
- Builds Android/iOS signés.
- Tests sur appareils physiques.
- Calibration terrain réelle.
- Stripe et webhooks réels.
- Validation juridique internationale.
- Modération communautaire à grande échelle.

### 2.3 Anomalies produit vérifiées

1. `AutoGenTripCreateView` reçoit les couches générées mais crée surtout un voyage minimal via `createTripAction`.
2. La chaîne suivante n'est donc pas encore garantie atomiquement :

```text
trip_id
→ adventure_plan_id
→ selected_route_id
→ kit_id
→ hike_session_id
→ journal_id
→ community_post_id
```

3. La page Communauté initialise encore des données de démonstration en dur.
4. Elle conserve ces démonstrations lorsque la base retourne zéro résultat.
5. La création de carnet utilise `public` comme visibilité initiale.
6. Des données locales `localStorage` sont fusionnées avec les données serveur dans certains parcours.
7. Le moteur de prédiction sait signaler l'absence de géométrie, mais le produit doit interdire toute confusion entre :
   - estimation abstraite ;
   - vrai parcours navigable.
8. La couverture mondiale n'existe pas encore : le lancement doit publier une matrice réelle de couverture.

---

## 3. Architecture cible sans réécriture destructive

### 3.1 Choix

Conserver temporairement :

```text
Next.js App Router
  ├── UI et Server Components
  ├── Routes API / commandes
  ├── Modules de domaine
  └── Workers/cron
          ↓
Supabase
  ├── PostgreSQL/PostGIS
  ├── Auth/RLS
  ├── Storage
  ├── files de travaux
  └── événements domaine
```

Ne pas créer immédiatement un microservice par moteur.

Un service ne sera extrait que si au moins une condition est démontrée :

- besoin de dimensionnement indépendant ;
- travail CPU long ;
- disponibilité indépendante ;
- isolement de sécurité ;
- contrat externe stable ;
- goulot mesuré en production.

### 3.2 Source de vérité

| Domaine | Source de vérité |
|---|---|
| Utilisateur | Supabase Auth |
| Voyage | `trips` |
| Étapes | `trip_steps` |
| Plan IA | `adventure_plans` + versions |
| Parcours | randonnée BDD ou GPX utilisateur validé |
| Segments | `trail_segments` |
| POI | catalogue POI versionné |
| Kit | kit lié au voyage |
| Budget | lignes budgétaires liées au voyage |
| Documents | métadonnées DB + Storage privé |
| Session terrain | `hike_sessions` |
| Carnet privé | carnet lié au voyage/session |
| Publication | publication communautaire distincte |
| Profil collectif | agrégats anonymisés seulement |
| Paiement | Stripe ; entitlement matérialisé côté serveur |

### 3.3 Identifiants obligatoires

```text
user_id
trip_id
adventure_plan_id
plan_version_id
selected_route_id
kit_id
hike_session_id
journal_id
community_post_id
correlation_id
```

Chaque transition doit être persistée et traçable. Aucun écran ne doit demander à l'utilisateur de saisir un de ces identifiants.

### 3.4 Commandes métier canoniques

- `CreateTripFromIntent`
- `GenerateAdventurePlans`
- `SelectAdventurePlan`
- `AttachRoute`
- `BuildTravelerKit`
- `PrepareOfflinePack`
- `StartHikeSession`
- `AppendJournalEntry`
- `CompleteHikeSession`
- `PreparePublication`
- `PublishJournal`
- `RecordReaction`
- `AggregateAnonymousLearning`

Toutes les commandes doivent être :

- authentifiées ;
- validées par Zod ;
- idempotentes ;
- corrélées ;
- auditables ;
- protégées par RLS ;
- sûres à rejouer.

---

# 4. Organisation des agents

## 4.1 Agents permanents

| Agent | Responsabilité | Skills |
|---|---|---|
| `ORCHESTRATOR` | dépendances, ordre, conflits, état du chantier | `agent-orchestration-multi-agent-optimize`, `context-manager`, `workflow-patterns` |
| `ARCHITECT` | contrats, ADR, frontières de modules | `architecture-decision-records`, `comprehensive-review-full-review` |
| `DATABASE` | migrations, PostGIS, RLS, index, pgTAP | `security-auditor`, `performance-engineer` |
| `BACKEND` | commandes, APIs, événements, idempotence | `nextjs-app-router-patterns`, `typescript-advanced-types` |
| `FRONTEND` | parcours Hub, états, intégration des composants | `frontend-developer`, `react-state-management` |
| `DESIGN` | système UI minimaliste et cohérence mobile | `ui-ux-designer`, `tailwind-design-system` |
| `MOBILE` | Capacitor, GPS, stockage, permissions, batterie | `frontend-mobile-development-component-scaffold` |
| `SECURITY` | auth, RLS, secrets, abus, uploads, paiement | `security-auditor`, `frontend-security-coder`, `frontend-mobile-security-xss-scan` |
| `QA` | tests unitaires, intégration, E2E et non-régression | `javascript-testing-patterns`, `unit-testing-test-generate`, `e2e-testing-patterns` |
| `ACCESSIBILITY` | clavier, lecteur d'écran, focus, contrastes | `wcag-audit-patterns` |
| `PERFORMANCE` | charge, cache, SQL, bundle, CDN | `performance-engineer`, `application-performance-performance-optimization` |
| `REVIEWER` | revue indépendante avant chaque merge | `code-reviewer`, `code-review-excellence` |
| `DOCS` | preuves, runbooks, références | `reference-builder`, `obsidian-markdown` |
| `DEBUGGER` | analyse d'échec sans élargir le périmètre | `debugger`, `defuddle` |

## 4.2 Règle de séparation

L'agent qui implémente une phase ne signe pas seul sa validation.

Minimum :

```text
implémentation → agent du domaine
tests          → QA
sécurité       → SECURITY
validation     → REVIEWER
acceptation    → ORCHESTRATOR
production     → humain habilité
```

---

# 5. Niveaux d'autonomie

| Niveau | Autorisé |
|---|---|
| `A0 — lecture` | audit, inventaire, documentation |
| `A1 — code local` | code, migrations additives, tests, documentation |
| `A2 — test distant` | migrations et données synthétiques sur projet de test |
| `A3 — préproduction` | déploiement après gates vertes |
| `A4 — production` | uniquement via PR protégée, approbation humaine et rollout |
| `A5 — décision sensible` | juridique, prix, stores, clés, suppression massive : humain uniquement |

### Interdictions agents

- Aucun secret dans Git.
- Aucun accès automatique à la production.
- Aucun `DROP`, suppression massive ou migration destructive autonome.
- Aucun tracé inventé.
- Aucun prix ou disponibilité partenaire inventé.
- Aucun contenu communautaire fictif en production.
- Aucun passage de palier automatique sans observation.
- Aucun changement de dépendance critique non approuvé.
- Aucun usage des données privées pour l'intelligence collective sans consentement.

---

# 6. Phases du chantier

## Phase 0 — Réparer et figer la base de livraison

**Priorité : P0 — bloquante**

### Travaux

- [ ] Corriger ou désactiver réellement le workflow GitHub Pages/Jekyll qui échoue.
- [ ] Identifier tous les checks requis.
- [ ] Activer la protection de `main`.
- [ ] Exiger une PR, les checks et la résolution des conversations.
- [ ] Interdire force-push et suppression.
- [ ] Générer un SBOM.
- [ ] Scanner dépendances, secrets et licences.
- [ ] Étiqueter le premier commit entièrement certifié.
- [ ] Interdire tout développement fonctionnel non nécessaire pendant la stabilisation.

### Agents

`ORCHESTRATOR`, `ARCHITECT`, `QA`, `SECURITY`, `REVIEWER`.

### Gate

```text
type-check       PASS
lint             PASS
tests            PASS
design guards    PASS
build Next.js    PASS
invariants       PASS
icons            PASS
bundle           PASS
lighthouse       PASS
aucun workflow parasite rouge
```

### Définition de terminé

Un seul SHA est identifié et toutes les preuves correspondent exactement à ce SHA.

---

## Phase 1 — Certifier la base de données distante

**Priorité : P0 — bloquante**

### Travaux

- [ ] Créer un projet Supabase de test isolé.
- [ ] Configurer :
  - `SUPABASE_TEST_URL`
  - `SUPABASE_TEST_ANON_KEY`
  - `SUPABASE_TEST_SERVICE_ROLE_KEY`
  - `LKDV_TEST_DATABASE_URL`
- [ ] Activer :
  - `LKDV_E2E_ENABLED=true`
  - `LKDV_DB_TESTS_ENABLED=true`
- [ ] Rejouer toutes les migrations depuis une base vide.
- [ ] Exécuter toutes les suites pgTAP.
- [ ] Générer les types Supabase depuis le schéma réel.
- [ ] Vérifier le drift schéma dépôt/test.
- [ ] Importer le schéma des tables historiquement distantes par migration additive.
- [ ] Tester RLS avec deux utilisateurs, un administrateur et un visiteur.
- [ ] Vérifier sauvegarde/restauration.
- [ ] Tester une migration interrompue puis reprise.

### Agents

`DATABASE`, `SECURITY`, `QA`, `PERFORMANCE`.

### Gate

- zéro migration échouée ;
- zéro table métier sans RLS ;
- zéro donnée inter-utilisateurs ;
- pgTAP vert ;
- sauvegarde restaurable ;
- `EXPLAIN ANALYZE` acceptable sur requêtes géographiques.

---

## Phase 2 — Unifier la chaîne d'identifiants

**Priorité : P0**

### Travaux

- [ ] Formaliser les relations entre voyage, plan, route, kit, session, carnet et publication.
- [ ] Ajouter les contraintes, index et clés étrangères manquantes.
- [ ] Créer une projection serveur `TripExperience` pour alimenter le Hub.
- [ ] Supprimer les recherches implicites par slug quand un ID métier est disponible.
- [ ] Ajouter `correlation_id` à chaque commande.
- [ ] Mettre en place une transaction ou saga compensable pour les créations multi-objets.
- [ ] Empêcher les plans orphelins et publications sans carnet source.

### Agents

`ARCHITECT`, `DATABASE`, `BACKEND`, `REVIEWER`.

### Gate

Un test d'intégration crée puis retrouve toute la chaîne :

```text
user → trip → plan → route → kit → session → journal → publication
```

Aucun objet orphelin après échec injecté à chaque étape.

---

## Phase 3 — Finaliser la création de voyage

**Priorité : P0**

### Travaux

- [ ] Relier `AutoGenTripCreateView` à la vraie commande de génération.
- [ ] Persister le brief original et sa version.
- [ ] Rechercher d'abord les randonnées disponibles dans la couverture active.
- [ ] Générer une à trois propositions à partir de géométries réelles.
- [ ] Appeler Adventure Intelligence pour chaque proposition valide.
- [ ] Afficher distance, D+, ETA P50/P90, difficulté, confiance et limites.
- [ ] Persister la proposition choisie.
- [ ] Créer automatiquement kit, budget, documents attendus et checklist.
- [ ] Activer le voyage dans le Hub.
- [ ] Rediriger vers l'aperçu réel, pas vers un écran parallèle.
- [ ] Gérer 401, 409, 429, 500, 503 et reprise après interruption.

### Règle géographique

```text
géométrie BDD valide
OU GPX utilisateur validé
OU fournisseur de routage autorisé
SINON aucun bouton « Démarrer la navigation »
```

Le repli `uniform_from_blueprint` peut fournir une estimation indicative, jamais un tracé navigable.

### Agents

`BACKEND`, `FRONTEND`, `DATABASE`, `QA`, `SECURITY`.

### Gate E2E

```text
connexion
→ phrase
→ propositions
→ sélection
→ voyage actif
→ route affichée
→ kit visible
→ budget visible
→ documents visibles
```

---

## Phase 4 — Couverture mondiale, randonnées et POI

**Priorité : P0 pour ouverture mondiale**

### Travaux

- [ ] Créer une table/version de couverture par pays et région.
- [ ] Définir une pipeline d'import :
  1. téléchargement autorisé ;
  2. contrôle de licence ;
  3. normalisation ;
  4. validation GeoJSON/GPX ;
  5. déduplication ;
  6. calcul distance/D+/difficulté ;
  7. rattachement segments ;
  8. import POI ;
  9. validation automatique ;
  10. échantillonnage humain ;
  11. publication sous feature flag.
- [ ] Ne jamais déclarer une région couverte sans seuil de qualité.
- [ ] Ajouter hôtels, transports, eau, refuges, restaurants, secours et restrictions.
- [ ] Séparer :
  - POI géographique ;
  - offre commerciale ;
  - affiliation ;
  - disponibilité/prix horodaté.
- [ ] Afficher clairement « lien affilié ».
- [ ] Implémenter expiration et actualisation des offres.
- [ ] Prévoir import GPX dans les zones non couvertes.
- [ ] Contrôler droits d'utilisation des données dans chaque pays.

### Agents

`DATABASE`, `BACKEND`, `PERFORMANCE`, `SECURITY`, agent humain données/licences.

### Gate régionale

Une région n'est publiée que si :

- géométries valides ≥ seuil décidé ;
- aucune rupture injustifiée ;
- POI géolocalisés et sourcés ;
- licences enregistrées ;
- requêtes spatiales sous SLO ;
- 20 parcours échantillonnés manuellement ;
- rollback du dataset possible.

---

## Phase 5 — Kit voyageur complet

### Travaux

- [ ] Construire le kit depuis le voyage choisi.
- [ ] Inclure équipement personnel, partagé et manquant.
- [ ] Relier chaque recommandation à une raison vérifiable.
- [ ] Ajouter poids, quantité, propriétaire et état.
- [ ] Ajouter documents :
  - identité ;
  - billets ;
  - réservations ;
  - assurance ;
  - contacts ;
  - documents locaux.
- [ ] Stocker les documents sensibles dans un bucket privé.
- [ ] Utiliser une URL signée courte.
- [ ] Ajouter budget prévisionnel et réel.
- [ ] Générer les contrôles sécurité adaptés au pays et à l'activité.
- [ ] Enrichir avec des agrégats anonymisés des anciens voyageurs.
- [ ] Interdire l'exposition d'un kit individuel sans consentement.

### Agents

`BACKEND`, `DATABASE`, `FRONTEND`, `SECURITY`, `DESIGN`.

### Gate

Le kit est prêt immédiatement après sélection du plan et reste entièrement modifiable.

---

## Phase 6 — Cockpit terrain et hors-ligne

### Travaux

- [ ] Relier le plan sélectionné au cockpit.
- [ ] Utiliser les GPS fixes réels.
- [ ] Détecter départ, progression, pause, sortie de route et arrivée.
- [ ] Rerouter uniquement sur une géométrie réelle.
- [ ] Recalculer ETA et consommation.
- [ ] Intégrer Terrain Live.
- [ ] Remplacer le rate limiter mémoire par un stockage distribué.
- [ ] Construire un pack hors-ligne versionné.
- [ ] Chiffrer les données sensibles locales.
- [ ] Définir les conflits de synchronisation champ par champ.
- [ ] Tester extinction réseau, redémarrage, batterie faible et reprise.
- [ ] Brancher un fournisseur de tuiles avec contrat commercial.

### Agents

`MOBILE`, `BACKEND`, `PERFORMANCE`, `SECURITY`, `QA`.

### Gate

Test terrain réel :

```text
pack téléchargé
→ mode avion
→ navigation
→ entrée carnet
→ signalement mis en file
→ fermeture application
→ réouverture
→ reconnexion
→ synchronisation sans perte ni doublon
```

---

## Phase 7 — Carnet et communauté sans démonstrations

### Travaux

- [ ] Supprimer les posts, clubs, groupes et événements codés en dur.
- [ ] Utiliser de vrais états vides.
- [ ] Interdire la fusion silencieuse de données `localStorage` avec la production.
- [ ] Lier le carnet au voyage et à la session.
- [ ] Ajouter entrées journalières, dépenses, matériel, photos et péripéties.
- [ ] Enregistrer hors-ligne puis synchroniser.
- [ ] Passer la visibilité initiale de `public` à `private`.
- [ ] Créer une étape de prépublication :
  - aperçu ;
  - choix des sections ;
  - retrait des coordonnées sensibles ;
  - masquage des documents ;
  - anonymisation des personnes ;
  - consentement explicite.
- [ ] Publier un snapshot distinct du carnet privé.
- [ ] Ajouter commentaires, réactions, favoris, signalements et blocage utilisateur.
- [ ] Ajouter modération, file de revue et journal d'action.
- [ ] Interdire tout contenu fictif en production.

### Agents

`FRONTEND`, `BACKEND`, `SECURITY`, `QA`, `DESIGN`, `ACCESSIBILITY`.

### Gate

Modifier le carnet privé après publication ne doit pas exposer automatiquement de nouvelle donnée.

---

## Phase 8 — Paiement, sécurité, vie privée et conformité

### Travaux

- [ ] Configurer les six Price IDs Stripe.
- [ ] Vérifier les signatures webhook.
- [ ] Assurer l'idempotence des événements Stripe.
- [ ] Tester paiement, renouvellement, échec, remboursement et annulation.
- [ ] Calculer les entitlements côté serveur.
- [ ] Ajouter WAF, rate limiting distribué et protection anti-bot.
- [ ] Réaliser une nouvelle revue RLS exhaustive.
- [ ] Tester accès horizontal et vertical.
- [ ] Définir rétention et localisation des sauvegardes.
- [ ] Valider DPA et transferts internationaux.
- [ ] Désigner le contact confidentialité/DPO.
- [ ] Réaliser ou confirmer l'analyse AIPD.
- [ ] Publier règles communautaires, modération et procédure d'appel.
- [ ] Localiser les mentions légales par marché.

### Agents

`SECURITY`, `DATABASE`, `BACKEND`, `QA`, validation humaine juridique.

### Gate

Aucune ouverture publique sans validation juridique enregistrée.

---

## Phase 9 — UI/UX mondiale

### Travaux

- [ ] Une seule navigation principale.
- [ ] Une action primaire par écran.
- [ ] Design tokens uniques.
- [ ] États standardisés :
  - chargement ;
  - vide ;
  - erreur ;
  - hors-ligne ;
  - accès refusé ;
  - indisponible ;
  - couverture absente.
- [ ] Réduire les pages client géantes.
- [ ] Déplacer les requêtes initiales vers le serveur lorsque possible.
- [ ] Virtualiser listes longues.
- [ ] Localiser dates, unités, devises et nombres.
- [ ] Supporter fuseaux horaires et sens RTL.
- [ ] WCAG 2.2 AA.
- [ ] Respecter mouvement réduit et contraste renforcé.
- [ ] Fournir une alternative textuelle aux cartes.

### Agents

`DESIGN`, `FRONTEND`, `MOBILE`, `ACCESSIBILITY`, `PERFORMANCE`.

### Gate

Tests visuels et accessibilité sur mobile compact, mobile large, tablette et desktop.

---

## Phase 10 — Observabilité et capacité

### SLO proposés

| Indicateur | Cible |
|---|---:|
| Disponibilité API principale | 99,9 % |
| Lecture API p95 | < 300 ms |
| Écriture API p95 | < 500 ms |
| Erreurs 5xx | < 1 % |
| Synchronisations destructives | 0 |
| Violations RLS | 0 |
| Perte d'entrée carnet | 0 |
| Jobs en retard | seuil et alerte documentés |

### Travaux

- [ ] Traces distribuées par `correlation_id`.
- [ ] Logs structurés sans données sensibles.
- [ ] Dashboard API, DB, IA, cartographie, Stripe et synchronisation.
- [ ] Alertes avec destinataire réel.
- [ ] Mesure RUM.
- [ ] Budget et alertes de coût.
- [ ] Cache CDN et cache géospatial.
- [ ] Pooling de connexions.
- [ ] Tests de saturation et de récupération.
- [ ] Tests à 100, 1 000 puis 10 000 utilisateurs concurrents représentatifs.
- [ ] Tester la génération IA séparément.
- [ ] Tester volume mondial de tuiles et offline.
- [ ] Documenter capacité par région.

### Agents

`PERFORMANCE`, `BACKEND`, `DATABASE`, `SECURITY`, `QA`.

### Règle

« Des millions d'utilisateurs » signifie une population inscrite ou mensuelle, pas nécessairement un million de connexions simultanées. La concurrence cible doit être explicitement dimensionnée et testée.

---

## Phase 11 — Mobile natif et terrain

### Travaux

- [ ] Installer JDK 17 et Android SDK.
- [ ] Générer une AAB signée.
- [ ] Créer le projet Play Console.
- [ ] Construire iOS avec Xcode 16+.
- [ ] Configurer certificats et TestFlight.
- [ ] Tester permissions, GPS, caméra, réseau et notifications.
- [ ] Tester au minimum :
  - Android milieu de gamme ;
  - Android récent ;
  - iPhone compact ;
  - iPhone récent ;
  - tablette.
- [ ] Mesurer batterie, mémoire, température, stockage et réseau instable.
- [ ] Tester au moins 30 paires ETA/réel avant rollout public.
- [ ] Étendre ensuite la calibration par activité, terrain, climat et saison.

### Agents

`MOBILE`, `QA`, `PERFORMANCE`, humain stores/signature.

### Gate

Aucune publication store sans build signé, test interne et validation sur appareils physiques.

---

## Phase 12 — Préproduction et lancement progressif

### Ordre obligatoire

```text
interne
→ 1 %
→ observation
→ 5 %
→ observation
→ 20 %
→ observation
→ 50 %
→ observation
→ 100 %
→ stabilisation
```

### Arrêt immédiat si

- fuite de données ;
- violation RLS ;
- synchronisation destructive ;
- corruption de session ;
- ETA dangereusement sous-estimée ;
- modération indisponible ;
- signalements critiques non traités ;
- coût hors budget ;
- consommation batterie excessive ;
- erreurs supérieures au seuil.

### Rollback

- désactiver le feature flag ;
- arrêter les nouvelles générations ;
- conserver les données compatibles ;
- ne pas supprimer les tables ;
- restaurer la version applicative ;
- ouvrir un incident ;
- produire un post-mortem ;
- reprendre au palier précédent.

### Autorité

Seul un humain habilité autorise chaque augmentation de palier.

---

# 7. Matrice de gates finale

| Gate | Responsable | Preuve exigée |
|---|---|---|
| G0 Code | QA | type-check, lint, tests, build |
| G1 DB | DATABASE | migrations + pgTAP |
| G2 Sécurité | SECURITY | RLS, secrets, abus, dépendances |
| G3 Produit | QA | E2E complet sans mocks |
| G4 Données | Data/Geo | couverture et licences |
| G5 Visuel | DESIGN | snapshots approuvés |
| G6 Accessibilité | ACCESSIBILITY | zéro critique/sérieux |
| G7 Offline | MOBILE | perte réseau et reprise |
| G8 Paiement | BACKEND | webhooks et entitlements |
| G9 RGPD | Juridique | validation écrite |
| G10 Charge | PERFORMANCE | rapport préproduction |
| G11 Observabilité | SRE | alertes réellement reçues |
| G12 Mobile | Mobile/QA | builds signés et appareils |
| G13 Rollout | Humain | décision et métriques |

---

# 8. Critères GO/NO-GO

## GO préproduction

- SHA unique ;
- CI totalement verte ;
- migrations et pgTAP distants verts ;
- boucle E2E complète ;
- données de démonstration retirées ;
- couverture affichée honnêtement ;
- secrets de test configurés ;
- observabilité de préproduction opérationnelle.

## GO public limité

- Stripe validé si monétisation activée ;
- fournisseur de tuiles contractualisé ;
- rate limiting distribué ;
- juridique validé ;
- modération active ;
- sauvegarde/restauration testée ;
- appareils physiques validés ;
- premiers résultats terrain disponibles.

## GO mondial

- pays réellement ouverts documentés ;
- licences compatibles ;
- traductions et unités validées ;
- numéros et règles de sécurité localisés ;
- charge préproduction réussie ;
- budgets validés ;
- rollout progressif terminé sans seuil d'arrêt.

## NO-GO actuel

Le produit ne peut pas être honnêtement déclaré prêt pour des millions d'utilisateurs maintenant, car :

1. la CI du HEAD contient encore un échec ;
2. les gates DB/visuelles distantes sont incomplètes ou ignorées ;
3. le parcours création → plan → route → kit → session → carnet → publication n'est pas intégralement relié ;
4. la communauté contient encore des données de démonstration ;
5. la couverture mondiale n'existe pas ;
6. l'infrastructure, les tuiles, le rate limiting et l'observabilité ne sont pas dimensionnés à cette échelle ;
7. les builds mobiles signés et tests terrain manquent ;
8. la validation juridique manque.

---

# 9. Ordre d'exécution immédiat

```text
1. Corriger le check GitHub Pages/Jekyll.
2. Protéger main.
3. Provisionner Supabase test.
4. Activer database-gates, E2E, accessibilité et visuel.
5. Unifier les identifiants et les transactions métier.
6. Relier réellement AutoGen → Adventure Plan → route → trip.
7. Générer automatiquement kit/budget/documents/sécurité.
8. Relier session terrain → carnet → publication.
9. Supprimer tous les contenus fictifs et rendre le carnet privé par défaut.
10. Mettre en place la couverture géographique et le pipeline POI.
11. Ajouter Redis/Upstash ou équivalent pour le rate limiting.
12. Contractualiser les tuiles.
13. Configurer Stripe.
14. Brancher observabilité et alertes.
15. Réaliser charge distante, appareils et calibration terrain.
16. Obtenir la validation juridique.
17. Lancer interne puis 1 %, jamais directement 100 %.
```

---

# 10. Journal de preuve obligatoire

Chaque phase doit produire :

```text
docs/reports/PHASE_<N>_VERIFICATION.md
docs/reports/PHASE_<N>_RESULTS.json
docs/reports/PHASE_<N>_ROLLBACK.md
```

Le rapport doit contenir :

- SHA testé ;
- environnement ;
- commandes exécutées ;
- résultats ;
- captures ou artefacts ;
- limites ;
- risques résiduels ;
- responsable ;
- date ;
- décision `PASS`, `FAIL` ou `INSUFFICIENT_DATA`.

`INSUFFICIENT_DATA` ne vaut jamais `PASS`.

---

## Verdict consolidé

Le dépôt contient une base très avancée, mais le lancement mondial immédiat serait prématuré. Le chemin critique n'est plus de créer davantage de fonctionnalités : il faut maintenant **relier les fonctions existantes, retirer les démonstrations, certifier la base distante, industrialiser les données géographiques et prouver l'exploitation à l'échelle**.

Sources vérifiées :

- [HEAD actuel `1c570b5`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/commit/1c570b50791925b3f75c565ce3bb0ba2bd77eba2)
- [Comparaison `main...audit/adventure-intelligence`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/compare/main...audit/adventure-intelligence)
- [Checks du HEAD](https://api.github.com/repos/TFaraciColbert59/kitduvoyageur_1783951966810/commits/1c570b50791925b3f75c565ce3bb0ba2bd77eba2/check-runs)
- [Workflow CI](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/.github/workflows/ci.yml)
- [Launch readiness A15](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/docs/reports/A15_LAUNCH_READINESS.md)
- [Tests de charge A15](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/docs/reports/A15_LOAD_TEST.md)
- [Observabilité A14](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/docs/reports/A14_OBSERVABILITY.md)
- [RGPD A14](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/docs/reports/A14_GDPR.md)
- [Skills réellement disponibles](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/audit/adventure-intelligence/.agent/skills)
