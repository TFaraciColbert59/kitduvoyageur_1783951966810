# 🧭 ROADMAP VOYAGE — LKDV (Le Kit du Voyageur)

> **DOCUMENT MAÎTRE D'EXÉCUTION AUTONOME DU PROGRAMME « MODULE VOYAGE ».**
>
> Ce fichier contient tout ce qui est nécessaire à l'exécution complète du
> programme sans instruction complémentaire : objectifs, périmètre, plan global,
> sous-plans par phase, tâches et sous-tâches, agents et sous-agents avec leurs
> rôles, skills et leur moment d'usage, ordre d'exécution et dépendances,
> vérifications et tests à chaque étape, critères de réussite et conditions de
> passage, gestion des erreurs et régressions, validation finale.
>
> **Source de vérité unique.** Tout écart de périmètre s'écrit ICI avant d'être codé.
> En cas de divergence entre ce fichier et un prompt d'exécution ponctuel,
> **ce fichier fait autorité**.

| Champ | Valeur |
|---|---|
| **Dépôt** | `TFaraciColbert59/kitduvoyageur_1783951966810` |
| **Programme** | Module Voyage — 9 chantiers (C0 → C8) + Recette Finale |
| **Stack** | Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS |
| **Backend** | Supabase (PostgreSQL 15 + PostGIS), RLS obligatoire sur 100 % des tables |
| **Paiement** | Stripe (server-side only, webhooks async) |
| **IA** | OpenRouter (modèle gratuit illimité) |
| **Cartes** | Leaflet + tuiles OSM · **3D** : react-globe.gl + three.js |
| **Tests** | Runner unitaire du projet (à confirmer : vitest/jest) + Playwright + Playwright visual |
| **Suivi d'exécution** | `docs/PROGRESS_VOYAGE.md` |
| **Historique** | `MISSION_LOG.md` |
| **Conventions** | `CLAUDE.md`, `DESIGN_SYSTEM.md`, `AGENTS.md` |
| **Sous-tâches totales** | 612 réparties sur 10 chantiers |

---

# TABLE DES MATIÈRES

**PARTIE I — CADRE**
- [§1. Objectifs et périmètre](#s1)
- [§2. Anti-périmètre](#s2)
- [§3. Invariants techniques non négociables](#s3)
- [§4. Invariants produit gelés](#s4)
- [§5. Contraintes légales](#s5)
- [§6. Catalogue des SKILLS et moment d'usage](#s6)
- [§7. Catalogue des AGENTS et matrice d'assignation](#s7)
- [§8. Doctrine des SOUS-AGENTS](#s8)
- [§9. Contrat d'autonomie](#s9)
- [§10. Garde-fous anti-dérive](#s10)
- [§11. Protocole du fichier de progression](#s11)
- [§12. Gestion des erreurs, régressions et imprévus](#s12)
- [§13. Plan global, ordre et graphe de dépendances](#s13)

**PARTIE II — CHANTIERS**
- [§14. C0 — Unification messagerie ↔ groupes](#c0)
- [§15. C1 — Fondations de l'entité Trip](#c1)
- [§16. C2 — Wizard et moteur de répartition](#c2)
- [§17. C3 — Planificateur d'itinéraire](#c3)
- [§18. C4 — Lieux communautaires](#c4)
- [§19. C5 — Affiliation Travelpayouts](#c5)
- [§20. C6 — IA et kit contextuel](#c6)
- [§21. C7 — Collaboratif, partage, offline, papiers, budget](#c7)
- [§22. C8 — Boucle de fin : voyage vécu → carnet](#c8)

**PARTIE III — CLÔTURE**
- [§23. Recette finale et pré-lancement](#rf)
- [§24. Registre des risques](#s24)
- [§25. Annexes techniques](#s25)

---
---

# PARTIE I — CADRE

<a name="s1"></a>
# §1. OBJECTIFS ET PÉRIMÈTRE

## 1.1 Énoncé du besoin

Construire un système complet de préparation de voyage dans un ou plusieurs
pays, couvrant l'intégralité du cycle de vie : idée → planification →
réservation → équipement → voyage vécu → récit → réutilisation par la communauté.

Le système doit couvrir la sélection de randonnées, de lieux à visiter et
d'endroits mis en avant par la communauté, les kits et produits nécessaires,
les vols, hôtels, restaurants, transports et activités — ces derniers étant
monétisés par liens d'affiliation.

## 1.2 Le concept central : le Voyage comme entité pivot

**Diagnostic de l'existant.** Les modules du projet sont aujourd'hui des îles :
un carnet, un kit, une randonnée, une fiche pays, un cockpit GPS, une boutique,
une messagerie. Chacun fonctionne, aucun ne parle aux autres.

**La solution.** Le module Voyage introduit l'objet qui les relie tous.

Un voyage se définit comme : `1..N pays` × `1..N étapes` × `1..N jours`, et pour
chaque jour, `0..N items hétérogènes` (randonnée, lieu, restaurant, hébergement,
transport, activité, logistique). Le kit, le budget, les papiers, le chat et le
carnet post-voyage s'accrochent tous au même `trip_id`.

**Ce que ça permet concrètement.** Afficher dans un seul écran : « ton vol
Paris–Lima + ton refuge du Salkantay + tes 3 kg de matériel manquants + 47 € de
commission potentielle + les 4 amis qui viennent avec toi ». Aucun concurrent
généraliste ne fait ça, parce qu'aucun ne possède à la fois la boutique de
matériel, le cockpit GPS et la communauté.

## 1.3 Objectifs business, par ordre de priorité gelé

| Rang | Objectif | Mécanisme | Marge |
|---|---|---|---|
| **1** | **Vendre le matériel de la boutique LKDV** | Kit contextuel (C6) → panier Stripe existant | Marge pleine |
| **2** | **Encaisser de l'affiliation** | Travelpayouts (C5) : vols, hôtels, voitures, assurance, eSIM | 1,1 % à 70 % selon produit |
| **3** | **Acquérir du trafic SEO** | Pages `/lieux/[slug]`, `/pays`, voyages publics, carnets | Indirecte |

**Conséquence architecturale majeure.** Tout le parcours doit converger vers
`/voyages/[slug]/kit`. Les chantiers C0 à C5 et C7 à C8 existent pour amener
l'utilisateur au C6 dans les meilleures conditions possibles. Le C6 est le seul
chantier qui produit directement du revenu à marge pleine.

## 1.4 KPI unique de succès du programme

> **Nombre de voyages créés qui atteignent le statut « kit complété »**
> (c'est-à-dire `trip_kit_items` sans aucune ligne au statut `needed`).

Ce KPI a été choisi parce qu'il capture simultanément l'acquisition (voyage
créé), l'engagement (planification menée à terme) et la monétisation (kit
complété implique décision d'achat, de location ou de possession). Un KPI de
trafic ou de nombre d'inscrits serait décoratif.

**KPI secondaires à instrumenter** : taux de complétion du wizard (C2), nombre
de contributions communautaires par lieu (C4), taux de clic sur liens affiliés
et taux de conversion (C5), nombre de voyages dupliqués (C8).

## 1.5 Périmètre fonctionnel complet — inventaire exhaustif

### 1.5.1 Planification
Création multi-pays · wizard guidé en 5 étapes · répartition automatique des
jours par pays et par étape · calcul des temps de trajet · avertissements de
saisonnalité · édition jour par jour · réordonnancement · déplacement d'items
entre jours · duplication et insertion de jours · carte multi-pays · templates ·
duplication d'un voyage public.

### 1.5.2 Contenu
Randonnées issues de `hiking_routes` · lieux communautaires (`places`) avec
photos, tips, avertissements, prix et notes d'accès · refuges et bivouacs (actif
unique non couvert par Booking) · guides pays existants · scoring communautaire
avec preuve d'usage · floutage des lieux sensibles · modération a posteriori.

### 1.5.3 Réservation et monétisation
Deeplinks Travelpayouts pour vols, hébergements, location de voiture, assurance,
eSIM, activités · boutique LKDV en priorité · location · occasion · emprunt
communautaire · suivi de clics et de conversions par postback.

### 1.5.4 Équipement
Kit contextuel dérivé de la destination, de la saison, de l'altitude, du style
et de la durée · diff avec l'inventaire du voyageur · bilan de poids réparti par
participant · réutilisation du `PreparationCockpit` existant · check-list de
départ mobile · bilan a posteriori de ce qui a servi.

### 1.5.5 Logistique
Papiers (visa, vaccins, assurance, permis, eSIM, passeport, billets) avec
échéances et upload chiffré · budget estimé contre réel par catégorie et par
personne · check-list temporelle J-60 / J-30 / J-7 / veille · notifications
in-app et email.

### 1.5.6 Social
Collaboration multi-utilisateurs avec rôles · chat unifié avec les groupes
existants · partage par lien ou public · export PDF et GPX · pack offline ·
publication de carnets · contribution en retour aux lieux visités.

### 1.5.7 Vécu
Passage en mode « voyage actif » · vue du jour · accès au cockpit GPS existant ·
cochage des items réalisés · agrégation automatique des `hike_sessions` ·
génération de statistiques et de carnet.

## 1.6 Surface de routes cible (complète)

```
/voyages                          Liste de mes voyages + voyages publics inspirants
/voyages/nouveau                  Wizard de création en 5 étapes
/voyages/[slug]                   Vue d'ensemble (timeline, carte, budget, complétude)
/voyages/[slug]/itineraire        Planificateur jour par jour
/voyages/[slug]/carte             Carte multi-pays
/voyages/[slug]/kit               Kit du voyage — CŒUR BUSINESS
/voyages/[slug]/reservations      Vols, hébergements, activités → affiliation
/voyages/[slug]/papiers           Visa, vaccins, assurance, eSIM
/voyages/[slug]/budget            Budget estimé vs réel
/voyages/[slug]/checklist         Jalons J-60 / J-30 / J-7 / veille
/voyages/[slug]/partage           Lien public, export PDF, collaborateurs
/voyages/[slug]/carnet            Carnet post-voyage (C8)
/lieux                            Exploration des lieux communautaires
/lieux/[slug]                     Fiche lieu — SEO majeur
/go/[linkSlug]                    Redirecteur d'affiliation (302, server-only)
/admin/revenus                    Dashboard affiliation
/admin/moderation                 File de modération des contributions
```

## 1.7 Situation initiale : COLD START ASSUMÉ

Le nombre d'utilisateurs actifs réels est quasi nul. Cette réalité conditionne
trois décisions structurantes que tout agent doit intégrer.

**Premièrement**, le seed de données est vital et non négociable. Un
planificateur sans données de lieux est une coquille vide. C'est un travail de
contenu autant que de code, et le C4 fixe un seuil chiffré de 40 lieux qualifiés
par pays.

**Deuxièmement**, chaque écran doit avoir un `EmptyState` soigné, parce que
c'est ce que verront 100 % des premiers visiteurs. Un écran vide et muet est un
défaut bloquant en recette finale.

**Troisièmement**, la boucle de contribution en retour (tâche 8.3.5) est le
moteur qui sortira le produit du cold start : un voyageur qui vient de terminer
son voyage est le contributeur le plus motivé qui existe. Cette boucle n'est pas
un bonus, c'est la stratégie d'amorçage.

---

<a name="s2"></a>
# §2. ANTI-PÉRIMÈTRE — CE QU'ON NE FAIT PAS EN V1

Cette section existe parce que l'ambition initiale du projet était « tout tout
tout tout ». Le meilleur moyen de ne rien livrer est de tout vouloir. **Tout
agent qui ressent l'envie d'ajouter un élément de cette liste doit s'arrêter et
relire cette section.**

| Exclusion | Justification |
|---|---|
| **Réservation en direct** | On est apporteur d'affaires, pas agence de voyage. Statut d'agence réglementé (garantie financière, immatriculation Atout France). Hors de portée d'un auto-entrepreneur. |
| **Recherche de vols avec prix réels** (Duffel, Amadeus) | Coût et complexité disproportionnés au regard d'une commission de 1,1 à 1,5 %. Le deeplink de recherche suffit et convertit. |
| **Multi-langue et multi-devise opérationnels** | Les colonnes `currency` et `locale` existent dès le C1, l'UI reste FR/EUR. Ouvrir l'i18n triple le coût de chaque écran. |
| **Notifications push** | Nécessite service worker, permissions, infrastructure de push. In-app + email couvrent 90 % du besoin. |
| **Application mobile native** | Le dual-view responsive est déjà le choix du projet. |
| **Fiches d'hôtels commerciaux stockées** | Booking le fait mieux, et stocker leurs données pose des questions de licence. Deeplink uniquement. **En revanche on stocke les refuges et bivouacs** : c'est notre actif unique, non couvert par Booking. |
| **Restaurants comme centre de profit** | Quasi aucun programme d'affiliation exploitable en restauration. Traités comme pur contenu communautaire et aimant SEO. |
| **Réseaux d'affiliation multiples** | Travelpayouts seul au départ : un contrat, une facturation, adapté à un auto-entrepreneur. La table `affiliate_partners` permet d'en ajouter sans refonte. |
| **Classement mondial unique des lieux** | Comparer un refuge népalais et un bistrot parisien n'a aucun sens. Classement par pays et par activité. |
| **Drag & drop tactile mobile au premier jet** | Coût élevé, fiabilité faible. Boutons d'abord, DnD en surcouche, abandon documenté si non fiabilisable. |
| **Modération a priori** | Sans équipe de modération, une file d'attente devient un goulot mortel qui tue la contribution. A posteriori + auto-flag. |
| **Paywall / abonnement pour le module Voyage** | Décision produit : 100 % gratuit. Aucun paywall à câbler. |

---

<a name="s3"></a>
# §3. INVARIANTS TECHNIQUES NON NÉGOCIABLES

Ces règles ont été **vérifiées par lecture du dépôt**. Elles ne se rediscutent
pas. Toute violation est un défaut bloquant en revue de code.

## 3.1 Conventions de base de données

**Clés étrangères utilisateur.** Toujours `public.user_profiles(id)`, **jamais**
`auth.users(id)` en direct. Vérifié : `conversations.created_by`,
`messages.sender_id`, `conversation_members.user_id` pointent tous vers
`user_profiles`. Les policies continuent d'utiliser `auth.uid()` puisque
`user_profiles.id` est aligné sur `auth.users.id`, mais la FK doit suivre la
convention maison.

**Table des groupes.** `public.travel_groups`, et **non** `groupes`. Cette
erreur a été commise une fois dans une version antérieure du plan et corrigée.

**Nommage des migrations.** Horodaté `YYYYMMDDHHMMSS_nom_explicite.sql`, jamais
numéroté séquentiellement. Exemples réels du dépôt :
`20260831000000_messaging_system_canonical.sql`,
`20260901000000_messaging_security_helpers.sql`.

**Nature des migrations.** Additives et idempotentes, sans exception :
```sql
create table if not exists ...
create index if not exists ...
create or replace function ...
drop policy if exists <nom> on <table>;   -- avant chaque create policy
alter table ... add column if not exists ...
```
**Aucun `DROP TABLE`. Aucun `DROP COLUMN`. Aucune donnée détruite.** Le projet
peut n'avoir qu'un seul environnement Supabase avec des données réelles : toute
migration doit être applicable sans risque.

**Fonctions `security definer`.** Toujours accompagnées de :
```sql
set search_path = public, pg_temp   -- protection contre le search_path hijacking
```
puis `revoke all on function ... from public;` suivi de `grant execute` ciblé
sur les rôles strictement nécessaires. Une fonction `security definer` sans
`search_path` figé est une faille d'élévation de privilèges.

**PostGIS.** CRS `EPSG:4326` uniquement. Colonnes `geography(Point,4326)`
dérivées de `lat`/`lng` par trigger, jamais renseignées à la main. Index GIST
obligatoire sur toute colonne `geog` interrogée spatialement.

**RLS.** Activée sur 100 % des tables du module. Vérification par requête
`select tablename, rowsecurity from pg_tables where schemaname='public'`, jamais
par relecture de code.

## 3.2 Conventions applicatives

**Accès base.** Exclusivement via le service layer avec `import 'server-only'`
en première ligne du fichier. Aucun composant client n'importe jamais un module
de requêtes. Pattern de référence à calquer : `src/lib/queries-compte.ts`.

**Écritures.** Exclusivement via Server Actions, avec validation `zod` en entrée
et vérification d'autorisation explicite. Jamais d'écriture directe depuis un
composant client.

**Routes API.** `export const dynamic = 'force-dynamic'` systématique pour
éviter le cache statique, conformément à `CLAUDE.md`.

**Secrets.** Clés API en variables d'environnement, jamais en dur. Aucune clé
Supabase service, OpenRouter, Stripe ou marker Travelpayouts ne doit jamais
apparaître dans un bundle client. Vérifié par grep automatisé en recette.

**Typage.** TypeScript strict. Zéro `any`, zéro `@ts-ignore`, zéro
`eslint-disable` nouveau. Les unions de statuts TypeScript doivent être
strictement alignées sur les contraintes `CHECK` SQL correspondantes.

**Dépendances.** Aucune dépendance npm ajoutée sans justification écrite dans le
journal des décisions et accord humain explicite.

## 3.3 Design system et responsive

**Dual-view systématique.** Desktop en classes Tailwind, mobile en inline styles
dans `MobilePageShell`, conformément au pattern établi dans `CLAUDE.md`.
**Coût réel assumé et budgété : environ +40 % de temps par écran.** Ce n'est pas
une dérive, c'est une décision produit (« les deux au max »).

**Breakpoints de test.** 390 px (mobile de référence) et 1440 px (desktop de
référence). Tout écran est validé aux deux largeurs.

**Tokens.** Ceux de `DESIGN_SYSTEM.md`. Vert de marque `#17402C`.

**⚠️ Piège de contraste documenté.** Ne jamais poser `text-[#17402C]` sur un
fond `#17402C`. Ce bug existe réellement dans `src/app/voyage-ia/page.tsx`
(texte invisible dans le titre h1). Il sera supprimé avec le fichier au C2, mais
sert d'exemple : tout contraste doit être vérifié.

**Composants imposés.** `AppImage` avec fallback pour toute image, `LkvIcon`
pour les icônes, `EmptyState` pour tout état vide, `MobilePageShell` pour toute
page mobile.

**Performance UI.** `dynamic import` obligatoire pour tout composant lourd
(cartes Leaflet avec `ssr: false`, modales, viewers 3D). Zones tactiles ≥ 44 px.

**Robustesse de route.** `loading.tsx` et `error.tsx` sur chaque route créée.
Aucune page 500 tolérée en recette.

---

<a name="s4"></a>
# §4. INVARIANTS PRODUIT GELÉS

Ces décisions ont été prises explicitement. Elles ne se rediscutent pas, y
compris si un agent estime qu'un autre choix serait meilleur. Un agent qui
souhaite les contester le fait dans le journal des décisions, sans bloquer.

| Sujet | Décision gelée | Conséquence d'exécution |
|---|---|---|
| **Priorité business** | Boutique → Affiliation → SEO | Le C6 est le chantier prioritaire en valeur |
| **Accès** | 100 % gratuit, aucun paywall | Rien à câbler côté `/abonnements` |
| **Situation** | Cold start assumé | Seed obligatoire, `EmptyState` partout |
| **Géographie** | Multi-pays dès le schéma ET dès l'UI | `trip_countries` en table dédiée, pas de colonne unique |
| **Seed initial** | FR, NP, PE, IS, MA | Simples `country_code`, modifiables par UPDATE, zéro impact schéma |
| **Groupes** | Réutilisation de `travel_groups` existant | FK optionnelle `group_id`. **C'est au groupe de s'adapter au type d'activité, pas l'inverse.** On ne crée pas de nouveau système de groupes. |
| **Modération** | A posteriori, par signalement | File de traitement dans `/admin`, pas de blocage à la publication |
| **IA** | Illimitée sur OpenRouter | Mais elle **ordonne, argumente, rédige** — elle **n'invente JAMAIS un lieu, un produit ou un prix** |
| **Réseau d'affiliation** | Travelpayouts seul au départ | Un contrat, une facturation. Table `affiliate_partners` extensible. |
| **Mention d'affiliation** | Discrète **mais présente** | `text-xs` gris, au-dessus du bloc, non repliable, `rel="sponsored nofollow"` |
| **Ordre d'affichage** | La rémunération ne l'influence **jamais** | Écrit dans les CGU, testé automatiquement |
| **Cible d'usage** | Mobile ET desktop au même niveau | Dual-view systématique, +40 % assumé |
| **Chat de voyage** | Si `group_id` existe, le chat du voyage **EST** celui du groupe | Évite la fragmentation en fils morts |
| **Lieux sensibles** | Floutage possible à ~500 m | Enjeu éthique et de sécurité physique |
| **`/preparation`** | **ACTIF À PRÉSERVER** | Monte un vrai `PreparationCockpit`. Ne pas supprimer, ne pas transformer en landing. Réutilisé au C6. |
| **`/voyage-ia`** | **COQUILLE VIDE À SUPPRIMER** | Un input, `setPhase('interview')`, « Formulaire à venir », `getChatCompletion` importé jamais appelé. Rien à migrer. |

## 4.1 Précision sur la décision « mention d'affiliation discrète »

La demande initiale était « le moins visible possible ». Cette formulation a été
refusée et remplacée par « discrète mais présente », pour trois raisons.

**Raison juridique.** Dissimuler la nature commerciale d'un lien relève de la
pratique commerciale trompeuse par omission (art. L121-2 et L121-3 du Code de la
consommation). Sanction encourue : jusqu'à 2 ans d'emprisonnement et 300 000 €
d'amende. En auto-entrepreneur, le patrimoine personnel est exposé.

**Raison contractuelle.** Travelpayouts, Amazon Associates et Booking incluent
tous une clause de disclosure. Un compte fermé pour non-conformité, c'est le C5
à la poubelle et les commissions en cours perdues.

**Raison commerciale.** Sur un produit dont le cœur est la confiance
communautaire, la transparence assumée stabilise le taux de clic. L'utilisateur
qui découvre après coup qu'il a été monétisé en douce ne revient jamais.

**Implémentation retenue** : une ligne `text-xs` en gris moyen, au-dessus du
bloc de liens, non repliable, du type « Liens partenaires — nous touchons une
commission, sans surcoût pour toi. » Sobre, une ligne, ne casse pas le design.

## 4.2 Précision sur la décision « IA n'invente jamais »

L'IA est illimitée, donc elle est dans le chemin critique dès le C6. Mais la
contrainte suivante est absolue et testée : **l'IA ne fournit jamais d'identifiant
d'entité.** Elle reçoit un contexte issu de la base (liste de lieux réels avec
leurs IDs, liste de produits réels) et elle ordonne, argumente, rédige. Toute
sortie est validée par `zod` contre les IDs réellement existants. Un ID inconnu
provoque le rejet de la sortie et le déclenchement du fallback déterministe.

**Bénéfice inattendu de cette contrainte** : elle élimine mécaniquement le risque
d'hallucination de lieu, qui serait mortel pour la crédibilité d'un produit de
randonnée (envoyer quelqu'un vers un refuge qui n'existe pas est un risque
physique, pas seulement un défaut logiciel).

## 4.3 Précision sur le zéro-LLM du C2

Malgré l'IA illimitée, le moteur de répartition du C2 est **100 % déterministe,
sans aucun appel LLM**. Trois raisons.

Un moteur déterministe est testable, reproductible et débogable ; un LLM ne
l'est pas. On ne pourrait jamais prouver que « 14 jours sur 3 pays » produit bien
14 jours si un LLM était dans la boucle.

Le wizard doit fonctionner sans dépendance réseau tierce, y compris en cas de
panne d'OpenRouter.

L'IA arrive au C6 comme **couche d'enrichissement par-dessus** ce socle, pas à
la place. C'est l'ordre qui produit un système robuste.

---

<a name="s5"></a>
# §5. CONTRAINTES LÉGALES

Section à relire intégralement avant les chantiers C4, C5 et C7.

## 5.1 Transparence publicitaire (bloquant C5)

**Textes applicables** : art. L121-2 et L121-3 du Code de la consommation
(pratique commerciale trompeuse) ; loi n° 2023-451 du 9 juin 2023 visant à
encadrer l'influence commerciale.

**Obligation** : mention claire, lisible et identifiable en toutes circonstances
de la nature commerciale du lien.

**Sanction** : jusqu'à 2 ans d'emprisonnement et 300 000 € d'amende, portée à
10 % du chiffre d'affaires pour une personne morale. Statut auto-entrepreneur ⇒
patrimoine personnel exposé.

**Contrôle** : DGCCRF, avec des contrôles durcis sur ce sujet depuis 2023.

**Implémentation** : composant `<AffiliateDisclosure />` au-dessus de chaque
bloc de liens, `rel="sponsored nofollow"` sur tous les sortants, test automatisé
qui échoue si un lien `/go/` apparaît sans disclosure dans le même arbre de rendu.

## 5.2 Cookies et consentement (bloquant C5)

**Texte** : directive ePrivacy transposée, doctrine CNIL.

**Obligation** : consentement préalable, libre, éclairé et révocable avant tout
dépôt de cookie de tracking tiers.

**Conséquence d'exécution** : sans CMP fonctionnel, **aucun tracking tiers n'est
légal**. C'est un point d'arrêt dur en tâche 5.0.3. Si le consentement est
refusé, le lien affilié doit rester **fonctionnel sans tracking** — on ne bloque
jamais l'utilisateur.

## 5.3 RGPD

**Minimisation** : aucune donnée personnelle inutile. Concrètement, `affiliate_clicks`
stocke un `session_hash` haché, **jamais une IP en clair**.

**Droit à l'effacement** : effectif et testé. Suppression de compte ⇒ données de
voyage et documents réellement supprimés, fichiers du Storage inclus. C'est
exactement le sens du bug **B6** du C0 : un message « supprimé » qui reste
lisible par appel API direct signifie que le droit à l'effacement n'est pas
effectif.

**Données sensibles** : `trip_documents` contient des scans de passeports et de
visas. Ils sont invisibles même aux `viewer` d'un voyage public, par policy RLS
dédiée dès le C1. Le coût de ce choix est nul, le bénéfice considérable.

**Rétention** : purge automatique des clics d'affiliation au-delà de 13 mois
(durée usuelle admise par la CNIL pour la mesure d'audience).

## 5.4 DSA et règlement P2B

**Obligation** : documenter publiquement les critères de classement des contenus
et indiquer si une rémunération influence l'ordre d'affichage.

**Position retenue** : la rémunération n'influence **jamais** l'ordre
d'affichage, et c'est écrit dans les CGU. C'est à la fois plus défendable
juridiquement et meilleur pour la confiance.

## 5.5 Licence des données OSM

**Obligation** : attribution ODbL visible pour toute donnée importée depuis
OpenStreetMap via Overpass.

**Implémentation** : mention d'attribution sur les cartes et les fiches lieux
issues d'un import, avec `places.source = 'osm'` traçable.

## 5.6 Licence des contributions utilisateurs

**Obligation** : les CGU doivent prévoir une licence non exclusive permettant à
LKDV d'afficher, redimensionner et diffuser les photos et textes contribués.
Sans cela, chaque photo est un risque.

## 5.7 Sécurité physique des personnes

Enjeu spécifique au produit outdoor. Publier les coordonnées exactes d'un spot
de bivouac sauvage, d'une source d'eau en zone aride ou d'un site archéologique
non protégé peut causer une dégradation irréversible ou mettre des personnes en
danger. Le champ `places.sensitivity` avec floutage serveur à ~500 m répond à
cette obligation morale. L'audit sécurité du C4 est renforcé sur ce point précis.

## 5.8 Informations réglementées

Les informations de visa, de vaccination et d'assurance sont présentées comme
**indicatives**, avec renvoi explicite aux sources officielles. Jamais de conseil
juridique ou médical affirmatif. Idem pour tout contenu généré par IA sur ces
sujets, qui porte en plus la mention « généré automatiquement, à vérifier ».

---

<a name="s6"></a>
# §6. CATALOGUE DES SKILLS ET MOMENT D'USAGE

Inventaire réel vérifié dans `.claude/skills/` : **17 skills**. Chacun contient
un `SKILL.md` à lire.

## 6.1 Les 17 skills disponibles

| # | Skill | Nature | Utilisé dans |
|---|---|---|---|
| 1 | `using-superpowers` | Méta — conditionne tous les autres | **TOUS** — à lire en premier, avant tout |
| 2 | `writing-plans` | Planification | Phase X.0 de chaque chantier |
| 3 | `executing-plans` | Exécution | Phases X.1 à X.5 de chaque chantier |
| 4 | `test-driven-development` | Qualité | **TOUS** — RED→GREEN→REFACTOR |
| 5 | `verification-before-completion` | Qualité | Fin de **chaque phase**, pas seulement fin de chantier |
| 6 | `systematic-debugging` | Résolution | Déclenchement **obligatoire au 2e échec** sur un même problème |
| 7 | `subagent-driven-development` | Orchestration | **TOUS** — cadre de délégation |
| 8 | `dispatching-parallel-agents` | Orchestration | Phases parallélisables identifiées par chantier |
| 9 | `requesting-code-review` | Revue | Phase X.6 de chaque chantier |
| 10 | `receiving-code-review` | Revue | Phase X.6, traitement des retours |
| 11 | `finishing-a-development-branch` | Clôture | Phase X.6, PR et nettoyage |
| 12 | `using-git-worktrees` | Outillage | Si parallélisation réelle sur worktrees séparés |
| 13 | `apple-ui-designer` | Design | C0 (0.3), C2 (2.2), C3 (3.2/3.3), C4 (4.5), C6 (6.4), C7, C8 |
| 14 | `brainstorming` | Exploration | Uniquement avant un point d'arrêt dur, pour préparer des options |
| 15 | `ai-engineering-toolkit` | IA | **C6 uniquement** — le seul chantier avec du LLM |
| 16 | `claude-seo` | SEO | **C4** (`/lieux/[slug]`), **C7** (voyages publics), **C8** (carnets) |
| 17 | `writing-skills` | Méta | Hors périmètre du programme — ne pas charger |

## 6.2 Matrice de chargement par chantier

| Skill | C0 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | RF |
|---|---|---|---|---|---|---|---|---|---|---|
| `using-superpowers` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `writing-plans` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `executing-plans` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `test-driven-development` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `verification-before-completion` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `systematic-debugging` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `subagent-driven-development` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `dispatching-parallel-agents` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `requesting-code-review` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `receiving-code-review` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `finishing-a-development-branch` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `using-git-worktrees` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | — |
| `apple-ui-designer` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `brainstorming` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `ai-engineering-toolkit` | — | — | — | — | — | — | ● | — | ○ | ○ |
| `claude-seo` | — | — | — | — | ● | — | — | ● | ● | ● |
| `writing-skills` | — | — | — | — | — | — | — | — | — | — |

**Légende** : ● obligatoire · ○ conditionnel (charger si le déclencheur survient) · — ne pas charger

## 6.3 Déclencheurs des skills conditionnels

`systematic-debugging` se charge **dès le deuxième échec sur un même problème**.
Ne jamais tenter une troisième fois à l'identique.

`using-git-worktrees` se charge si et seulement si tu parallélises réellement
sur des worktrees séparés (recommandé quand deux sous-agents travaillent sur des
zones de fichiers totalement disjointes et longues).

`brainstorming` se charge uniquement lorsqu'un point d'arrêt dur est atteint et
que tu dois présenter plusieurs options argumentées à l'humain.

`ai-engineering-toolkit` se charge exclusivement au C6, et éventuellement au C8
pour la génération de texte de liaison du carnet.

`claude-seo` se charge pour toute page destinée à l'indexation : fiches lieux
(C4), voyages publics (C7), carnets publics (C8), et vérification finale (RF).

---

<a name="s7"></a>
# §7. CATALOGUE DES AGENTS ET MATRICE D'ASSIGNATION

## 7.1 Nature des agents dans ce dépôt

Les fichiers de `.claude/agents/` ne sont **pas des outils exécutables**. Ce sont
des **personas experts en Markdown** : des grilles de lecture, des systèmes de
valeurs, des façons de critiquer. Tu les lis, tu adoptes leur rigueur, tu produis
leur type d'analyse.

**Structure réelle vérifiée** : 8 domaines (`business/`, `data-ai/`, `design/`,
`healthcare/`, `platform-operations/`, `product-policy/`, `programming/`,
`security/`), chacun contenant plusieurs fichiers `prenom-nom.md` de 7 à 14 ko,
plus deux agents projet à la racine : `pays-communaute-refonte.md` et
`pays-conformite-lg.md`.

## 7.2 ⚠️ ACTION PRÉALABLE OBLIGATOIRE

**Première tâche de tout chantier** : exécuter `ls -R .claude/agents/` et
consigner l'inventaire réel dans le fichier de progression.

Les noms de personas cités ci-dessous sont de deux natures.

**Vérifiés comme existants** :
- `security/` : `moxie-marlinspike.md`, `mudge-zatko.md`, `katie-moussouris.md`,
  `mikko-hypponen.md`, `tarah-wheeler.md`
- `data-ai/` : `andrew-ng.md`, `cassie-kozyrkov.md`, `demis-hassabis.md`,
  `dj-patil.md`
- `business/` : `clayton-christensen.md`, `elon-musk.md`, `eric-ries.md`,
  `jeff-bezos.md`, `michael-porter.md`, `reid-hoffman.md`, `satya-nadella.md`,
  `steve-jobs.md`
- Racine : `pays-communaute-refonte.md`, `pays-conformite-lg.md`

**Plausibles mais NON vérifiés** (les listings d'API étaient tronqués) : tous
les personas de `programming/`, `design/`, `product-policy/` et
`platform-operations/`. Quand je cite « profil concurrence, ex. Lamport », tu
dois **lister le dossier réel, choisir le persona le plus proche du profil
demandé, et documenter la substitution** dans le journal des décisions.

**Règle absolue** : si un persona cité n'existe pas, tu prends le plus proche
équivalent du même domaine et tu le notes. Tu n'inventes jamais un fichier
d'agent, et tu ne bloques jamais pour cette raison.

## 7.3 Matrice d'assignation des personas par chantier et par phase

| Chantier | Phase | Domaine → profil recherché | Ce que tu attends de lui |
|---|---|---|---|
| **C0** | 0.0 Reconnaissance | `programming/` profil « lecture sans complaisance » · `platform-operations/` profil « cartographie avant refonte » | Audit brutal de l'existant, aucune complaisance |
| **C0** | 0.1 Migration | `programming/` profil **concurrence et invariants** · `data-ai/dj-patil.md` | Validation de l'advisory lock, des triggers, des invariants |
| **C0** | 0.1 RLS | `security/moxie-marlinspike.md` · `security/mudge-zatko.md` | Modèle de menace, recherche active de contournement |
| **C0** | 0.1 RGPD | `security/tarah-wheeler.md` (ou profil « protection des personnes ») | B6/B7 sont des fuites de données, pas des bugs |
| **C0** | 0.2 Produit | `product-policy/` profil produit senior | Cohérence de la règle du chat de voyage |
| **C0** | 0.3 Front | `programming/` profil **abstraction** · `design/` profils ergonomie | Un composant, deux variantes, zéro duplication |
| **C1** | 1.1 Schéma | `data-ai/dj-patil.md` · `programming/` profil systèmes | Modélisation, index, PostGIS |
| **C1** | 1.2 RLS | `security/moxie-marlinspike.md` · `security/mudge-zatko.md` | **Audit bloquant** sur 9 tables, policy par policy |
| **C1** | 1.4 UI | `design/` profils ergonomie | Dual-view, `EmptyState` cold start |
| **C2** | 2.1 Moteur | `data-ai/cassie-kozyrkov.md` · `programming/` profil rigueur algorithmique | Déterminisme, invariants de répartition |
| **C2** | 2.2 Wizard | `design/` profils ergonomie · `product-policy/` | Taux de complétion du parcours |
| **C2** | 2.4 Seed | `pays-communaute-refonte.md` (agent projet) | Qualité éditoriale des destinations |
| **C3** | 3.1 Ordonnancement | `programming/` profil concurrence | `order_index`, conflits d'édition |
| **C3** | 3.2/3.3 UI | `design/` profils ergonomie · `apple-ui-designer` (skill) | Écran de rétention maximale |
| **C4** | 4.1 Schéma | `data-ai/dj-patil.md` | Modélisation lieux + scoring |
| **C4** | 4.2 Scoring | `data-ai/cassie-kozyrkov.md` · `data-ai/andrew-ng.md` | Rigueur statistique, biais de la moyenne d'étoiles |
| **C4** | 4.3 Sensibles | `security/tarah-wheeler.md` · `security/eva-galperin.md` si présent | **Sécurité physique des personnes** |
| **C4** | 4.5 SEO/UI | `claude-seo` (skill) · `pays-communaute-refonte.md` | Indexation et qualité communautaire |
| **C5** | 5.0 Vérif partenaire | `business/michael-porter.md` | Position concurrentielle, choix de réseau |
| **C5** | 5.2 Deeplink | `security/moxie-marlinspike.md` | Aucune fuite de marker côté client |
| **C5** | 5.3 Postback | `security/mudge-zatko.md` · `platform-operations/` | Signature, idempotence, rate limiting |
| **C5** | 5.4 Conformité | `pays-conformite-lg.md` (agent projet) · `product-policy/` | **Audit DGCCRF bloquant** |
| **C6** | 6.1 Moteur kit | `data-ai/dj-patil.md` · `programming/` | Règles en données, pas en code |
| **C6** | 6.2 Cascade | `business/clayton-christensen.md` · `business/jeff-bezos.md` | Conversion sans trahir l'utilisateur |
| **C6** | 6.3 IA | `data-ai/demis-hassabis.md` · `data-ai/andrew-ng.md` · `ai-engineering-toolkit` (skill) | Anti-hallucination, fallback |
| **C6** | 6.3 Sécurité IA | `security/moxie-marlinspike.md` | Injection de prompt, exposition de clés |
| **C6** | 6.4 UI | `design/` · `apple-ui-designer` | Check-list mobile utilisable d'une main |
| **C7** | 7.1 Collaboration | `programming/` profil concurrence · `product-policy/` | Matrice de rôles, édition concurrente |
| **C7** | 7.2 Partage | `security/katie-moussouris.md` | Divulgation, non-exposition des documents |
| **C7** | 7.4 Papiers | `security/tarah-wheeler.md` | **Documents d'identité — audit renforcé** |
| **C8** | 8.1 États | `programming/` profil systèmes | Machine à états, transitions invalides |
| **C8** | 8.2 Agrégation | `data-ai/dj-patil.md` | Rattachement spatio-temporel |
| **C8** | 8.3 Carnet | `design/` · `claude-seo` (skill) | Qualité éditoriale et SEO |
| **C8** | 8.4 Duplication | `security/moxie-marlinspike.md` · `business/reid-hoffman.md` | Non-fuite + effet de réseau |
| **RF** | Sécurité globale | `security/` **au complet** (5 personas) | Audit final bloquant |
| **RF** | Conformité globale | `pays-conformite-lg.md` · `product-policy/` | Audit légal final bloquant |
| **RF** | Opérations | `platform-operations/` | Runbook, robustesse |

## 7.4 Domaines à ne jamais charger

`healthcare/` — hors périmètre absolu du produit. Aucun chantier ne le mobilise.

`business/` — ne pas charger avant le C5. Aucun enjeu de monétisation dans les
chantiers C0 à C4, le charger plus tôt ne fait que polluer le contexte.

---

<a name="s8"></a>
# §8. DOCTRINE DES SOUS-AGENTS

## 8.1 Obligation d'usage

**Tu dois utiliser des sous-agents.** Travailler seul sur un chantier de ce
programme est une erreur d'exécution : le volume de lecture et de test dépasse
ce qu'un contexte unique peut tenir sans dérive.

Skills de référence : `subagent-driven-development` pour le cadre,
`dispatching-parallel-agents` pour la parallélisation.

## 8.2 Les 8 rôles de sous-agents

| Rôle | Mission | Périmètre d'écriture autorisé | Ne fait jamais |
|---|---|---|---|
| **`SCOUT`** | Lire et cartographier le code existant. Produire des fiches de synthèse avec citations `fichier:ligne`. | **Aucun** (lecture seule) | Coder |
| **`SQL-SMITH`** | Écrire migrations, RPC, triggers, policies, index | `supabase/migrations/**` | Toucher au front |
| **`RLS-BREAKER`** | **Sous-agent adversaire interne.** Tenter de contourner les policies du projet : lire ce qui doit être invisible, écrire ce qui doit être interdit. Récompensé quand il trouve une faille. | `**/*.rls.test.ts` | Corriger (il signale, il ne répare pas) |
| **`ENGINE-SMITH`** | Écrire la logique métier pure (moteurs, calculs, règles) | `src/features/*/engine/**`, `src/lib/**` | Toucher à l'UI ou au SQL |
| **`FRONT-SMITH`** | Composants, hooks, pages, dual-view | `src/components/**`, `src/hooks/**`, `src/app/**` | Toucher au SQL |
| **`TEST-WRIGHT`** | Tests unitaires, intégration, Playwright, visual. Garantit le protocole RED→GREEN. | `**/*.test.ts`, `tests/**`, `e2e/**` | Modifier le code testé |
| **`REVIEWER`** | Revue adverse en fin de phase, avec la grille du persona assigné | **Aucun** (commentaires uniquement) | Corriger lui-même |
| **`SCRIBE`** | Tenir `docs/PROGRESS_VOYAGE.md`, coller les preuves, journal des décisions | `docs/**` | Coder |

## 8.3 Contrat de délégation obligatoire

Chaque brief de sous-agent contient **impérativement** ces six éléments :

**Un objectif unique en une phrase.** Si l'objectif tient en deux phrases, c'est
deux sous-agents.

**Le périmètre de fichiers autorisé en écriture**, en liste explicite. Pas de
« tout ce qui est nécessaire ».

**Les interdictions explicites.** « Tu ne modifies aucune migration existante »,
« tu ne touches pas à `@/features/preparation` », etc.

**Le format de retour attendu.** Diff, fiche de synthèse, sortie de test.

**Le critère d'acceptation vérifiable.** Pas « du bon code », mais « le test X
passe et la commande Y renvoie Z ».

**L'obligation de citation.** Toute affirmation sur le code existant doit être
appuyée par une citation `fichier:ligne`.

## 8.4 Règle de rejet

Un sous-agent qui rend un travail **sans citation de source** voit son travail
**rejeté et refait**. Tu ne fusionnes jamais un retour de sous-agent sans le
relire toi-même. Un sous-agent n'a pas autorité pour cocher une sous-tâche.

## 8.5 Règles de parallélisation

**Autorisée à l'intérieur d'une phase. Jamais entre phases. Jamais entre
chantiers.**

Deux sous-agents ne doivent **jamais** écrire dans le même fichier. Si un
découpage produit un chevauchement, c'est le découpage qui est mauvais.

**Phases parallélisables par chantier** :
- C0 : 0.0 (3× `SCOUT`) · 0.4 (`TEST-WRIGHT` ∥ `RLS-BREAKER`)
- C1 : 1.0 (2× `SCOUT`) · 1.3 ∥ 1.4 partiellement · 1.5 (`TEST-WRIGHT` ∥ `RLS-BREAKER`)
- C2 : 2.1 (les 7 modules du moteur en parallèle, ils sont indépendants) · 2.5
- C3 : 3.2 ∥ 3.3 (desktop et mobile sont des fichiers distincts) · 3.5
- C4 : 4.4 (import ∥ éditorial) · 4.5 (fiche ∥ exploration ∥ admin) · 4.6
- C5 : 5.2 ∥ 5.3 (deeplink et postback sont disjoints) · 5.5
- C6 : 6.1 ∥ 6.3 (moteur déterministe et couche IA sont disjoints) · 6.5
- C7 : 7.1 ∥ 7.2 ∥ 7.3 ∥ 7.4 (quatre zones distinctes) · 7.5
- C8 : 8.2 ∥ 8.3 partiellement · 8.5

**Phases strictement séquentielles** : toute phase X.1 qui produit une migration
unique (un seul auteur par fichier de migration), toute phase de décision
produit, toute phase X.5 de vérification transversale, toute phase X.6 de clôture.

## 8.6 Ce que tu ne délègues JAMAIS

Les décisions produit · l'arbitrage d'un point d'arrêt dur · la validation
finale du cochage d'une sous-tâche · la rédaction du rapport final de chantier ·
la décision de considérer un bug comme corrigé · la fusion d'une PR.

---

<a name="s9"></a>
# §9. CONTRAT D'AUTONOMIE

## 9.1 Principe

Tu exécutes chaque chantier **de la première à la dernière phase, sans demander
l'autorisation de continuer**.

## 9.2 Tu ne rends la parole que dans trois cas

Le chantier est **terminé** et tu produis le rapport final.

Tu heurtes un **point d'arrêt dur** listé dans la section du chantier concerné.

Tu as épuisé le **protocole d'escalade** de §12.4 sur un même problème.

## 9.3 Formulations formellement interdites

« Veux-tu que je continue ? » · « Je peux maintenant passer à la phase
suivante ? » · « Souhaites-tu que j'implémente cette partie ? » · « Dis-moi si
tu veux que je lance les tests. » · « Voici ce que je propose de faire
ensuite. » suivi d'un arrêt · « J'ai préparé le plan, confirme et je démarre. »

Tu continues. Tu implémentes. Tu lances les tests. Tu commites. Tu enchaînes.

## 9.4 Corollaire : ne t'arrête pas non plus par excès de prudence

Si un choix est **réversible** et de **faible impact**, tu tranches, tu
documentes ta décision dans le journal, tu avances. Tu ne t'arrêtes que si le
choix est **irréversible** ou **hors périmètre**.

Exemples de choix que tu tranches seul : nom d'un fichier, structure interne
d'un composant, formulation d'un message d'erreur, choix entre deux formes
équivalentes de requête, ordre de deux sous-tâches indépendantes.

Exemples de choix que tu n'arbitres pas seul : suppression d'un fichier existant
hors périmètre, ajout d'une dépendance npm, modification du schéma d'un chantier
antérieur validé, abandon d'une sous-phase.

---

<a name="s10"></a>
# §10. GARDE-FOUS ANTI-DÉRIVE

Quatre dérives connues des agents sur les missions longues. Chacune a une
contre-mesure **obligatoire et vérifiable**.

## 10.1 Dérive de contexte → hallucination de schéma

**Symptôme.** Après 5 à 10 fichiers lus, l'agent commence à inventer des noms de
colonnes et de tables plausibles mais faux.

**Contre-mesure.** Avant **chaque** écriture de SQL ou de TypeScript touchant la
base, relire le fichier source concerné et **citer la ligne exacte** dans le
raisonnement, sous cette forme :

```
SOURCE VÉRIFIÉE : 20260831000000_messaging_system_canonical.sql:L47
→ conversation_members.user_id UUID REFERENCES public.user_profiles(id)
```

Jamais de mémoire, toujours de la relecture. **Si tu ne peux pas citer, tu ne
peux pas écrire.**

## 10.2 Sur-affirmation

**Symptôme.** L'agent déclare « fait » ce qui est seulement « écrit », et
« validé » ce qui est seulement « censé fonctionner ».

**Contre-mesure.** La règle de cochage à quatre conditions de §11.2, appliquée
sans exception. Tu ne peux pas écrire « ✅ » sans avoir collé une sortie de
terminal réelle.

## 10.3 Test complaisant

**Symptôme.** L'agent écrit des tests qui passent quoi qu'il arrive : assertions
triviales, mocks qui masquent le comportement réel, `expect(true).toBe(true)`
déguisé.

**Contre-mesure — protocole RED obligatoire.** Pour tout correctif de bug et
toute règle métier, tu dois produire dans le fichier de progression **deux
sorties de terminal** :

```
[RED]   test B6 → ÉCHEC  (avant correctif)  ← preuve que le test détecte le bug
[GREEN] test B6 → SUCCÈS (après correctif)  ← preuve que le correctif fonctionne
```

**Un test qui n'a jamais été rouge ne compte pas et ne permet pas de cocher.**
Si tu as écrit le correctif avant le test, tu fais `git stash` du correctif, tu
lances le test, tu prouves le rouge, puis `git stash pop`.

## 10.4 Compression du périmètre

**Symptôme.** L'agent traite les trois premières sous-phases en détail puis
survole les suivantes.

**Contre-mesure.** Le fichier de progression est ton ancre. Tu le mets à jour
**après chaque sous-tâche**, pas à la fin de la phase. Si tu constates qu'une
sous-tâche a été sautée, tu reviens la faire avant d'avancer. Le compte
`X/Y sous-tâches` du tableau de bord doit correspondre au nombre annoncé dans ce
document.

---

<a name="s11"></a>
# §11. PROTOCOLE DU FICHIER DE PROGRESSION

Fichier : `docs/PROGRESS_VOYAGE.md`. À créer au C0, poursuivi à chaque chantier
par une nouvelle section. Tenu **en continu**, commité à chaque phase terminée.

## 11.1 Format imposé

Une ligne par sous-tâche, sans exception.

```markdown
| ID | Sous-tâche | État | Preuve de validation | Commit | Date |
|----|-----------|------|---------------------|--------|------|
| 0.1.4 | Trigger bump_conversation | ✅ | [RED] test B2 échec + [GREEN] succès, sortie collée L340 | a1b2c3d | 2026-.. |
| 1.2.6 | RLS trip_documents | ✅ | RLS-BREAKER 12 tentatives, 0 fuite, sortie L512 | e4f5g6h | 2026-.. |
| 4.4.4 | Socle éditorial 5 pays | ⏸️ | Bloqué : 22 lieux/pays au lieu de 40. Voir §Blocages. | — | 2026-.. |
```

**États autorisés** : ⬜ à faire · 🔄 en cours · ✅ validé · ❌ échoué · ⏸️ bloqué

## 11.2 RÈGLE ABSOLUE DE COCHAGE

Une sous-tâche passe à **✅ uniquement** si les **quatre** conditions sont
réunies simultanément :

1. le code est écrit **et commité** ;
2. un test **automatisé** la couvre **et il est vert** ;
3. la **sortie réelle** de la commande de vérification est **collée dans le
   fichier** (extrait brut, pas un résumé, pas une paraphrase) ;
4. `tsc`, `lint` et `build` restent **verts** après la modification.

## 11.3 Interdictions formelles

Cocher par anticipation. Cocher parce que « ça devrait marcher ». Cocher sans
avoir exécuté la commande. **Inventer une sortie de terminal.** Cocher sur la
foi du rapport d'un sous-agent sans avoir relu.

## 11.4 Protocole du ⏸️

Si une commande ne peut pas être exécutée dans ton environnement, l'état est ⏸️,
accompagné de : la **commande exacte** que l'humain doit lancer, le **résultat
attendu**, et **ce qui sera débloqué** par cette vérification.

> **Une sous-tâche honnêtement ⏸️ vaut infiniment mieux qu'un ✅ mensonger.**
>
> C'est le mode d'échec numéro un de ce type de programme : quarante cases
> cochées dont douze non vérifiées donnent l'illusion d'un chantier fini et font
> construire le suivant sur du sable. Un faux ✅ au C2 contamine six chantiers,
> parce que le C3, le C6 et le C8 s'appuient directement sur le moteur du C2.

## 11.5 Sections obligatoires du fichier

**Tableau de bord de tête** : X/Y sous-tâches, pourcentage par phase et par
chantier, date de dernière mise à jour.

**Inventaire de chargement** : skill/agent demandé · trouvé oui/non ·
substitution éventuelle · chargé oui/non. Une ligne par élément.

**Baseline d'avant-chantier** : sortie de `tsc`, `lint`, `build` **avant** toute
intervention. Si la baseline est déjà rouge, l'écrire noir sur blanc et ne pas
s'en attribuer la faute.

**Journal des décisions techniques** : décision · alternatives écartées ·
justification · réversibilité · date.

**Registre des blocages** : sous-tâche · nature du blocage · **question exacte
posée à l'humain** · ce qui est débloqué par la réponse.

**Dette assumée** : ce qui est volontairement reporté · à quel chantier · impact
· coût estimé de résolution.

**Volumes de données réels** : tableau par pays et par type d'entité, mis à jour
au C2 et au C4. C'est la mesure de crédibilité du produit.

**Journal RED/GREEN** : pour chaque bug et chaque règle métier, les deux sorties.

---

<a name="s12"></a>
# §12. GESTION DES ERREURS, RÉGRESSIONS ET IMPRÉVUS

## 12.1 Classification des anomalies

| Classe | Définition | Réaction |
|---|---|---|
| **A — Bloquant sécurité** | Fuite de données, contournement RLS, secret exposé | **Arrêt immédiat** de la phase. Correction avant toute autre chose. Journal. Ne jamais reporter. |
| **B — Bloquant fonctionnel** | La sous-phase ne peut pas être livrée | `systematic-debugging`. Si 2 échecs : escalade §12.4. |
| **C — Régression** | Quelque chose qui marchait ne marche plus | Bisect, correction, **test de non-régression ajouté**. |
| **D — Défaut mineur** | Cosmétique, message, formulation | Correction immédiate si < 5 min, sinon dette documentée. |
| **E — Hors périmètre** | Bug réel mais dans un module non concerné | **Ne pas corriger.** Documenter dans « anomalies hors périmètre » et signaler dans le rapport final. |

## 12.2 Protocole de régression

Toute régression suit cette séquence, sans raccourci.

**Détection.** La suite de tests d'un chantier antérieur échoue, ou le build
casse.

**Isolement.** Identifier le commit fautif par bisect. Ne jamais « corriger à
l'aveugle ».

**Test de non-régression d'abord.** Écrire un test qui reproduit la régression
et qui **échoue** (RED). C'est ce test qui prouvera la correction.

**Correction.** Le test passe (GREEN).

**Ajout permanent.** Le test rejoint la suite du chantier concerné et sera
rejoué à chaque chantier ultérieur.

**Journal.** Consigner : régression · commit fautif · cause racine · test ajouté.

## 12.3 Rejeu obligatoire des suites antérieures

À la fin de **chaque** chantier, tu rejoues **l'intégralité** des suites de
tests des chantiers précédents. Pas un échantillon. La suite RLS du C1 est
rejouée au C2, au C3, au C4, au C5, au C6, au C7, au C8 et en recette finale.

Motif : les policies RLS sont l'endroit du projet où une modification innocente
casse silencieusement la sécurité d'une autre table.

## 12.4 Protocole d'escalade (3 niveaux)

**Niveau 1 — Première tentative.** Approche directe.

**Niveau 2 — Deuxième tentative.** Charger `systematic-debugging`. Formuler une
hypothèse explicite, la tester, la réfuter ou la confirmer. **Ne jamais retenter
la même approche à l'identique.**

**Niveau 3 — Troisième tentative.** Changer d'angle radicalement : déléguer à un
`SCOUT` pour relire l'existant avec un œil neuf, ou à un `REVIEWER` pour
critiquer ton approche. Charger `brainstorming` pour produire trois options
argumentées.

**Après le niveau 3 : escalade humaine.** Tu rends la parole avec, en une page :
le problème · les trois approches tentées et pourquoi elles ont échoué · les
options envisagées avec leurs coûts · ta recommandation · la question exacte à
laquelle tu as besoin d'une réponse.

## 12.5 Imprévus fréquents et réaction attendue

| Imprévu | Réaction |
|---|---|
| **Une table citée dans ce document n'existe pas sous ce nom** | Lister le schéma réel, prendre le nom réel, documenter la divergence, continuer. **Point d'arrêt seulement si aucun équivalent n'existe.** |
| **La baseline est déjà rouge avant ton intervention** | Point d'arrêt dur. L'écrire noir sur blanc. Ne pas s'en attribuer la faute. Ne pas la corriger sans accord (hors périmètre). |
| **Une migration existante contredit ce document** | La migration réelle fait foi. Documenter, adapter, continuer. |
| **Un test antérieur était faux (faux ✅ détecté)** | **Le signaler explicitement dans le rapport.** Corriger le test. Réévaluer tout ce qui en dépendait. C'est la situation la plus grave du programme. |
| **Un compte partenaire n'est pas validé (C5)** | Point d'arrêt dur en 5.0.2. Ne pas coder l'intégration à l'aveugle. |
| **Le volume de données est insuffisant (C2/C4)** | Point d'arrêt dur. Arbitrer : réduire à 3 pays soignés plutôt que 5 pays vides. |
| **Une fonctionnalité s'avère techniquement non fiabilisable** | **Ne pas livrer une version cassée.** Abandonner officiellement, documenter en dette avec justification. Exemple prévu : DnD tactile mobile au C3. |
| **Tu découvres un bug de sécurité hors périmètre** | Classe A malgré le hors-périmètre : signaler immédiatement dans le rapport, ne pas corriger sans accord si ça touche un autre module. |
| **Le contexte devient trop long** | Résumer l'état dans `PROGRESS_VOYAGE.md`, déléguer la suite à un sous-agent frais avec le fichier comme brief. |

---

<a name="s13"></a>
# §13. PLAN GLOBAL, ORDRE ET GRAPHE DE DÉPENDANCES

## 13.1 Tableau de bord du programme

| # | Chantier | Dépend de | Bloque | Sous-tâches | Branche |
|---|---|---|---|---|---|
| **C0** | Unification messagerie ↔ groupes | — | C1, C7 | 78 | `feat/c0-messaging-unification` |
| **C1** | Fondations entité Trip | C0 | C2→C8 | 71 | `feat/c1-trips-core` |
| **C2** | Wizard + moteur de répartition | C1 | C3, C6, C8 | 76 | `feat/c2-trip-wizard` |
| **C3** | Planificateur d'itinéraire | C2 | C8 | 68 | `feat/c3-itinerary-planner` |
| **C4** | Lieux communautaires | C1 | C5, C6, C8 | 82 | `feat/c4-community-places` |
| **C5** | Affiliation Travelpayouts | C1, C4 | C6 | 63 | `feat/c5-affiliation` |
| **C6** | IA + kit contextuel | C2, C4, C5 | — | 59 | `feat/c6-ai-kit` |
| **C7** | Collaboratif, partage, offline | C0, C1 | C8 | 74 | `feat/c7-collab-offline` |
| **C8** | Voyage vécu → carnet | C3, C4, C7 | — | 52 | `feat/c8-trip-completion` |
| **RF** | Recette finale | tous | — | 39 | `release/voyage-v1` |
| | | | **TOTAL** | **662** | |

## 13.2 Graphe de dépendances

```
C0 ──┬──► C1 ──┬──► C2 ──► C3 ──┐
     │         │                │
     │         ├──► C4 ──┬──────┤
     │         │         │      │
     │         │         └► C5 ─┤
     │         │                │
     │         │      C2+C4+C5 ─┴─► C6
     │         │
     └─────────┴──► C7 ──────────────► C8 ◄── C3, C4
                                        │
                                        ▼
                                       RF
```

## 13.3 Justification de l'ordre

**C0 en premier** parce que le C1 dépend du nom réel de `travel_groups` et de la
convention `user_profiles`, et parce que les sept bugs de messagerie identifiés
incluent deux problèmes RGPD actifs (B6, B7) qui existent aujourd'hui en
production, indépendamment du module Voyage.

**C1 avant tout le reste** parce que l'entité Trip est le pivot : neuf chantiers
écrivent dans ses tables.

**C2 avant C3** parce qu'on ne construit pas une interface d'édition sur un
moteur non testé.

**C4 en parallèle logique de C2/C3** mais après C1 : le schéma `places` ne
dépend que de `trip_items.ref_type`.

**C5 après C4** parce que le disclosure et l'ordre d'affichage doivent
s'appliquer à un contenu qui existe.

**C6 en dernier des chantiers de valeur** parce qu'il consomme le moteur (C2),
les lieux (C4) et l'affiliation (C5). C'est le chantier qui rapporte, il doit
s'appuyer sur des fondations validées.

**C7 dépend de C0** pour le `ConversationPanel` factorisé.

**C8 en dernier** parce qu'il ferme la boucle et alimente en retour le scoring
du C4.

## 13.4 Gate universel d'entrée de chantier

Aucun chantier ne démarre si les cinq conditions suivantes ne sont pas réunies.

Le chantier précédent est ✅ ou ses ⏸️ sont explicitement documentés et n'ont pas
d'impact bloquant sur le chantier à démarrer.

La branche du chantier précédent est mergée ou son état est documenté.

`docs/PROGRESS_VOYAGE.md` est à jour et son tableau de bord cohérent.

La baseline `tsc` / `lint` / `build` du chantier à démarrer est prise et consignée.

L'inventaire réel des skills et agents nécessaires est confirmé.

## 13.5 Gate universel de sortie de chantier

Aucun chantier n'est déclaré terminé si les huit conditions suivantes ne sont pas
réunies.

Toutes ses sous-tâches sont ✅ ou ⏸️ documentées — **aucune ⬜, aucune 🔄**.

`npx tsc --noEmit` renvoie zéro erreur et **aucun `@ts-ignore` n'a été ajouté**.

`npm run lint` renvoie zéro warning nouveau.

`npx next build` est vert.

Les migrations du chantier ont été **rejouées deux fois de suite** sans erreur
(preuve d'idempotence).

**L'intégralité** des suites de tests des chantiers antérieurs est rejouée et verte.

L'audit du persona `security/` assigné est rendu par écrit et sans anomalie de
classe A.

La revue de code est faite, les retours traités, `MISSION_LOG.md` mis à jour, la
PR ouverte.

---
---

# PARTIE II — CHANTIERS

<a name="c0"></a>
# §14. CHANTIER 0 — UNIFICATION MESSAGERIE ↔ GROUPES

## 14.1 Identité

| Champ | Valeur |
|---|---|
| **Branche** | `feat/c0-messaging-unification` |
| **Dépend de** | Rien |
| **Bloque** | C1 (noms de tables, convention `user_profiles`), C7 (`ConversationPanel`) |
| **Phases** | 7 (0.0 → 0.6) |
| **Sous-tâches** | 78 |
| **Migration** | `<horodatage>_messaging_group_unification.sql` |
| **Audit bloquant** | `security/` — deux fuites de données personnelles à corriger |

## 14.2 Objectif et valeur

**Objectif fonctionnel.** Quand on crée un groupe ou qu'on parle au groupe, c'est
la même chose : le chat de la messagerie et celui de la page du groupe sont un
seul et même fil. Un message envoyé d'un côté apparaît de l'autre, non pas parce
qu'il est synchronisé, mais parce que c'est **littéralement la même ligne en base**.

**Valeur immédiate hors module Voyage.** Ce chantier corrige sept bugs dont deux
problèmes RGPD actifs. Il a donc une valeur propre, même si le module Voyage
n'existait pas.

**Valeur pour le programme.** Il établit les conventions réelles (`travel_groups`,
`user_profiles`) sur lesquelles neuf chantiers s'appuient, et il produit le
`ConversationPanel` réutilisé par le chat de voyage au C7.

## 14.3 Principe d'architecture directeur : ON NE SYNCHRONISE RIEN

La demande initiale était formulée comme « le chat est synchronisé avec celui de
la page du groupe et inversement ». **Cette approche est refusée.**

Deux fils de discussion qu'on réplique produisent des divergences, des doublons
et des messages perdus, de façon garantie. Le problème n'est pas résoluble
proprement par synchronisation ; il est résoluble trivialement par unicité.

Le schéma actuel contient déjà la bonne réponse :
`travel_groups.conversation_id UUID UNIQUE REFERENCES conversations(id)`
*(à confirmer en 0.0.2 par lecture réelle de la migration).*

Un groupe **possède** une conversation, en relation 1-1. Il y a donc **une seule**
ligne dans `conversations`, **une seule** table `messages`, et **deux surfaces
d'affichage** qui lisent le même `conversation_id`.

Rien à synchroniser : c'est structurellement le même objet.

**Le travail restant** est donc de câbler le cycle de vie (création, propagation
d'appartenance, compteurs) et de factoriser l'UI en un composant unique.

## 14.4 Les 7 bugs constatés

Constats issus de la lecture de
`supabase/migrations/20260831000000_messaging_system_canonical.sql`.

| ID | Bug | Conséquence réelle | Gravité |
|---|---|---|---|
| **B1** | **Aucune policy INSERT sur `conversations`** — le `GRANT` n'accorde que SELECT/UPDATE/DELETE à `authenticated` | **Impossible de créer une conversation de groupe aujourd'hui.** La fonctionnalité n'existe pas. Cohérent avec l'approche DM (tout passe par `get_or_create_direct_conversation`), mais le pendant groupe est absent. | Bloquant |
| **B2** | `last_message_at` : colonne + index `idx_conversations_last_message_at` présents, **aucun trigger ne l'alimente** | Tri de la liste des conversations figé à la date de création. Liste inutilisable dès qu'il y a plus de trois conversations. | Élevé |
| **B3** | `unread_count` : colonne + CHECK `>= 0` présents, **rien ne l'incrémente ni ne le remet à zéro** | Compteurs de non-lus non fonctionnels. | Élevé |
| **B4** | `message_mentions` : RLS activé, **zéro policy**, malgré `GRANT SELECT, UPDATE` | Table totalement inaccessible aux utilisateurs authentifiés. Le système de mentions ne peut pas fonctionner. | Élevé |
| **B5** | `message_attachments` : `GRANT DELETE` accordé **sans policy DELETE** correspondante | Suppression de pièce jointe impossible. | Moyen |
| **B6** | `members_select_messages` **ne filtre pas `deleted_at`** | Un message « supprimé » reste lisible par appel API direct. Le masquage n'est qu'un artifice d'UI. **Le droit à l'effacement RGPD n'est pas effectif.** | **CRITIQUE** |
| **B7** | `is_conversation_member` ignore vraisemblablement `left_at` | Un ancien membre peut lire les messages postérieurs à son départ. **Fuite de données personnelles.** | **CRITIQUE** |

## 14.5 Équipe du chantier

**Skills obligatoires (11)** : `using-superpowers` (en premier), `writing-plans`,
`executing-plans`, `test-driven-development`, `verification-before-completion`,
`systematic-debugging`, `subagent-driven-development`,
`dispatching-parallel-agents`, `requesting-code-review`, `receiving-code-review`,
`finishing-a-development-branch`.

**Skills conditionnels** : `apple-ui-designer` (phase 0.3), `using-git-worktrees`
(si parallélisation réelle), `brainstorming` (si point d'arrêt).

**Skills interdits** : `ai-engineering-toolkit` (aucun LLM ici), `claude-seo`
(aucune page publique), `writing-skills`.

**Personas** : voir §7.3, lignes C0.

**Sous-agents** : `SCOUT` ×3 (phase 0.0), `SQL-SMITH` (0.1), `RLS-BREAKER`
(0.1 et 0.4), `FRONT-SMITH` (0.3), `TEST-WRIGHT` (0.4), `REVIEWER` (fin de
chaque phase), `SCRIBE` (continu).

---

## PHASE 0.0 — RECONNAISSANCE

**Objectif de phase.** Établir la vérité du terrain. Aucune ligne de code
produit. À la sortie de cette phase, tu dois pouvoir citer `fichier:ligne` pour
chaque affirmation que tu feras dans les phases suivantes.

**Skills actifs** : `using-superpowers`, `writing-plans`.
**Personas** : `programming/` profil lecture sans complaisance,
`platform-operations/` profil cartographie.
**Sous-agents** : 3× `SCOUT` en parallèle.

### 0.0.1 — Inventaire réel des skills et agents
**Action.** Exécuter `ls -R .claude/skills/` et `ls -R .claude/agents/`. Lire le
`SKILL.md` des 11 skills obligatoires. Lister les personas réellement présents
dans chaque domaine.
**Livrable.** Tableau dans `PROGRESS_VOYAGE.md` : demandé · trouvé · substitution
· chargé.
**Critère.** Les 11 skills obligatoires sont chargés ou leur absence est signalée.
Toute substitution de persona est documentée.
**Preuve.** Sortie de `ls -R` collée.

### 0.0.2 — Nom réel de la table des membres de groupe
**Action.** Trouver la table des membres de `travel_groups` (`travel_group_members` ?
autre ?), sa colonne de rôle, et les valeurs autorisées par son CHECK. Confirmer
l'existence de `travel_groups.conversation_id UUID UNIQUE`.
**Pourquoi c'est critique.** Le RPC de 0.1.1 et le trigger de 0.1.2 en dépendent
entièrement. Une erreur ici casse tout le chantier.
**Critère.** Nom de table, nom de colonne de rôle et valeurs du CHECK cités avec
`fichier:ligne`.
**Point d'arrêt.** Si aucune table de membres de groupe n'existe → arrêt dur.

### 0.0.3 — Lecture intégrale des helpers de sécurité
**Action.** Lire `supabase/migrations/20260901000000_messaging_security_helpers.sql`
en entier. Extraire le corps exact de `is_conversation_member` et de
`get_or_create_direct_conversation`.
**Pourquoi.** `get_or_create_direct_conversation` est le **patron** du RPC groupe
à écrire en 0.1.1 : mêmes conventions, même gestion d'erreur, même style.
`is_conversation_member` est l'objet du correctif B7.
**Critère.** Le corps des deux fonctions est cité intégralement dans la fiche
`SCOUT`.

### 0.0.4 — Cartographie du front messagerie
**Action.** Lire `src/app/messagerie/layout.tsx` et `page.tsx`. Identifier tout
composant de chat existant, tout hook d'abonnement Realtime, toute logique
d'envoi de message.
**Livrable.** Fiche `SCOUT` : arbre de composants, où vit l'état, où vit le
Realtime, ce qui est dupliqué.
**Critère.** Chaque composant listé avec son chemin exact et son rôle.

### 0.0.5 — Cartographie du front groupes
**Action.** Lire les pages et composants de groupes (`src/app/groupes/**` si
présent, `src/components/groups/**`). Identifier s'il existe déjà un chat de
groupe, même partiel.
**Livrable.** Fiche `SCOUT`.
**Critère.** Réponse explicite à : « existe-t-il aujourd'hui du code de chat dans
la surface groupe ? »

### 0.0.6 — Reproduction et documentation des 7 bugs
**Action.** Pour chacun de B1 à B7, prouver le bug par une requête SQL réelle ou
un appel d'API, **avant toute correction**.
**Exemples de preuves attendues** :
```sql
-- B1 : aucune policy INSERT sur conversations
select policyname, cmd from pg_policies
where schemaname='public' and tablename='conversations';
-- attendu : aucune ligne avec cmd='INSERT'

-- B4 : RLS actif mais zéro policy sur message_mentions
select relrowsecurity from pg_class where relname='message_mentions';
select count(*) from pg_policies where tablename='message_mentions';
-- attendu : true, puis 0

-- B6 : deleted_at non filtré
select qual from pg_policies
where tablename='messages' and policyname='members_select_messages';
-- attendu : aucune mention de deleted_at
```
**Critère.** Sept preuves collées dans `PROGRESS_VOYAGE.md`.
**Point d'arrêt.** Si un bug n'est **pas** reproductible, le schéma réel diverge
de la migration lue → arrêt dur, ne pas corriger à l'aveugle.

### 0.0.7 — Baseline
**Action.** Exécuter `npx tsc --noEmit`, `npm run lint`, `npx next build` et la
suite de tests existante. Consigner l'état **AVANT** intervention.
**Critère.** Quatre sorties collées.
**Point d'arrêt.** Si la baseline est déjà rouge → arrêt dur. L'écrire noir sur
blanc, ne pas s'en attribuer la faute, ne pas la corriger sans accord.

### 0.0.8 — Plan d'exécution
**Action.** Avec `writing-plans`, rédiger le plan détaillé du chantier en tenant
compte des découvertes de 0.0.1 à 0.0.7. Créer `docs/PROGRESS_VOYAGE.md` avec
les 78 lignes de sous-tâches en ⬜.
**Critère.** Le fichier existe, est commité, et son tableau de bord affiche
`0/78`.

### 0.0.9 — Branche
**Action.** `git checkout -b feat/c0-messaging-unification`.
**Critère.** `git branch --show-current` renvoie le bon nom.

**GATE DE SORTIE DE PHASE 0.0.** Les 9 sous-tâches sont ✅ ou ⏸️. Les 7 bugs sont
prouvés. Les noms réels de tables sont confirmés et cités. La baseline est
consignée. `PROGRESS_VOYAGE.md` existe.

---

## PHASE 0.1 — MIGRATION SQL

**Objectif de phase.** Une migration additive et idempotente qui crée le cycle de
vie de la conversation de groupe et corrige les sept bugs.

**Skills actifs** : `executing-plans`, `test-driven-development`,
`verification-before-completion`.
**Personas** : `programming/` profil concurrence et invariants,
`data-ai/dj-patil.md`, `security/moxie-marlinspike.md`, `security/mudge-zatko.md`,
`security/tarah-wheeler.md`.
**Sous-agents** : `SQL-SMITH` (auteur unique du fichier), `RLS-BREAKER` (audit
adverse), `REVIEWER`.
**Parallélisation** : **interdite** sur cette phase — un seul auteur par fichier
de migration.

**Fichier** : `supabase/migrations/<YYYYMMDDHHMMSS>_messaging_group_unification.sql`

### 0.1.1 — RPC `get_or_create_group_conversation`

**Action.** Créer la fonction manquante qui corrige **B1**.

```sql
create or replace function public.get_or_create_group_conversation(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_conv   uuid;
  v_title  text;
begin
  if v_caller is null then
    raise exception 'Authentification requise';
  end if;

  -- Le demandeur doit être membre du groupe
  -- ⚠️ ADAPTER le nom de table et de colonne selon 0.0.2
  if not exists (
    select 1 from public.travel_group_members m
    where m.group_id = p_group_id and m.user_id = v_caller
  ) then
    raise exception 'Accès refusé au groupe';
  end if;

  -- Verrou anti-course : deux appels simultanés ne créent qu'une conversation
  perform pg_advisory_xact_lock(hashtext('grpconv:' || p_group_id::text));

  select g.conversation_id, g.name into v_conv, v_title
  from public.travel_groups g where g.id = p_group_id;

  if v_conv is not null then
    return v_conv;
  end if;

  insert into public.conversations (type, title, created_by)
  values ('group', v_title, v_caller)
  returning id into v_conv;

  update public.travel_groups set conversation_id = v_conv where id = p_group_id;

  -- Peuplement initial depuis les membres du groupe
  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conv, m.user_id,
         case when m.role in ('owner','admin') then m.role else 'member' end
  from public.travel_group_members m
  where m.group_id = p_group_id
  on conflict (conversation_id, user_id) do nothing;

  return v_conv;
end $$;

revoke all on function public.get_or_create_group_conversation(uuid) from public;
grant execute on function public.get_or_create_group_conversation(uuid) to authenticated;
```

**Points d'attention.** Le `pg_advisory_xact_lock` est indispensable : sans lui,
deux clics simultanés créent deux conversations et le `UNIQUE` sur
`conversation_id` provoque une erreur brute côté utilisateur. La clause
`on conflict do nothing` suppose une contrainte unique sur
`(conversation_id, user_id)` — **la vérifier en 0.0.3, et l'ajouter si absente**.
Le mapping de rôle doit respecter le CHECK réel de `conversation_members.role`
relevé en 0.0.2.

**Critère.** La fonction existe, est `security definer` avec `search_path` figé,
les grants sont ciblés.
**Preuve.** `\df+ public.get_or_create_group_conversation` + test 0.4.2 vert.

### 0.1.2 — Trigger de propagation de l'appartenance

**Action.** Propager les mouvements de `travel_group_members` vers
`conversation_members`.

**Règle capitale.** Sur départ du groupe, **on ne supprime pas la ligne, on
renseigne `left_at`**. Cela préserve l'historique du fil et permet d'appliquer le
correctif B7.

```sql
create or replace function public.sync_group_members_to_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conv uuid;
  v_gid  uuid := coalesce(new.group_id, old.group_id);
begin
  select conversation_id into v_conv from public.travel_groups where id = v_gid;
  if v_conv is null then
    return null;   -- pas encore de conversation : rien à propager
  end if;

  if (tg_op = 'INSERT') then
    insert into public.conversation_members (conversation_id, user_id, role)
    values (v_conv, new.user_id,
            case when new.role in ('owner','admin') then new.role else 'member' end)
    on conflict (conversation_id, user_id)
      do update set left_at = null,
                    role = excluded.role;

  elsif (tg_op = 'UPDATE') then
    update public.conversation_members
       set role = case when new.role in ('owner','admin') then new.role else 'member' end
     where conversation_id = v_conv and user_id = new.user_id;

  elsif (tg_op = 'DELETE') then
    update public.conversation_members
       set left_at = now()
     where conversation_id = v_conv and user_id = old.user_id;
  end if;

  return null;
end $$;
```

**Prérequis.** La colonne `left_at timestamptz` doit exister sur
`conversation_members` — l'ajouter en additif si absente :
`alter table public.conversation_members add column if not exists left_at timestamptz;`

**Cas de réintégration.** Un membre qui revient dans le groupe voit son `left_at`
remis à `null` par le `do update`. C'est le comportement voulu : il retrouve
l'accès, y compris à l'historique.

**Critère.** Trigger actif sur les trois opérations, `left_at` correctement posé
au départ.
**Preuve.** Test 0.4.4 vert (RED puis GREEN).

### 0.1.3 — Durcissement de `is_conversation_member` (correctif B7)

**Action.** Réécrire la fonction pour exclure les membres partis.

```sql
create or replace function public.is_conversation_member(p_conv uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conv
      and cm.user_id = p_user
      and cm.left_at is null            -- ← CORRECTIF B7
  );

$$;
```

**Attention.** Conserver **exactement** la signature existante relevée en 0.0.3
(nombre et ordre des paramètres, type de retour), sinon toutes les policies qui
l'appellent cassent. Si la signature réelle diffère, adapter sans la changer.

**Nuance à traiter.** Faut-il qu'un ex-membre garde l'accès aux messages
**antérieurs** à son départ ? Décision retenue : **non** pour la lecture via
l'API (simplicité, sécurité, et le fil de groupe est par nature collectif). Si
l'équipe souhaite un accès historique, ce serait une policy distincte avec
`messages.created_at < cm.left_at`, à documenter en dette.

**Critère.** Un ex-membre ne lit plus rien du fil.
**Preuve.** Test 0.4.4 : RED avant, GREEN après.

### 0.1.4 — Trigger `bump_conversation_on_message` (correctifs B2 + B3)

**Action.** Alimenter `last_message_at` et `unread_count`.

```sql
create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         updated_at      = now()
   where id = new.conversation_id;

  update public.conversation_members
     set unread_count = unread_count + 1
   where conversation_id = new.conversation_id
     and user_id <> new.sender_id
     and left_at is null;

  return null;
end $$;

drop trigger if exists trg_bump_conversation_on_message on public.messages;
create trigger trg_bump_conversation_on_message
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();
```

**Points d'attention.** `after insert` et `returns null` : le trigger n'a pas à
modifier la ligne insérée. L'exclusion `left_at is null` évite d'incrémenter le
compteur d'un ex-membre. L'exclusion `user_id <> new.sender_id` évite de se
notifier soi-même.

**Cas à traiter.** Faut-il décrémenter sur suppression de message ? Décision :
**non**, complexité disproportionnée et risque de compteur négatif malgré le
CHECK. Documenter en dette.

**Critère.** Après un envoi, `last_message_at` est à jour et les autres membres
actifs ont `unread_count` incrémenté de 1.
**Preuve.** Test 0.4.5, RED puis GREEN.

### 0.1.5 — RPC `mark_conversation_read`

**Action.** Le pendant de 0.1.4 : remise à zéro.

```sql
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_conversation_member(p_conversation_id, v_caller) then
    raise exception 'Accès refusé';
  end if;

  update public.conversation_members
     set unread_count = 0,
         last_read_at = now()
   where conversation_id = p_conversation_id
     and user_id = v_caller;
end $$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
```

**Critère.** Un membre remet son compteur à zéro ; un non-membre reçoit une
exception.
**Preuve.** Test 0.4.5.

### 0.1.6 — Policies manquantes sur `message_mentions` (correctif B4)

**Action.** Créer les policies absentes, cohérentes avec les grants existants
(`SELECT`, `UPDATE`).

```sql
drop policy if exists mentions_select on public.message_mentions;
create policy mentions_select on public.message_mentions for select
  using (
    public.is_conversation_member(
      (select m.conversation_id from public.messages m where m.id = message_id),
      auth.uid()
    )
  );

drop policy if exists mentions_update_own on public.message_mentions;
create policy mentions_update_own on public.message_mentions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

**Note.** L'`UPDATE` restreint à `user_id = auth.uid()` correspond à l'usage
attendu : marquer sa propre mention comme lue. Adapter au nom réel de la colonne
relevé en 0.0.3.

**Critère.** Un membre lit les mentions de son fil ; un tiers ne lit rien ; un
membre ne modifie que ses propres mentions.
**Preuve.** Test 0.4.1 (B4), RED puis GREEN.

### 0.1.7 — Policy DELETE sur `message_attachments` (correctif B5)

**Action.**

```sql
drop policy if exists attachments_delete_own on public.message_attachments;
create policy attachments_delete_own on public.message_attachments for delete
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
    )
  );
```

**Cohérence à vérifier.** La policy de suppression du Storage
(`storage_delete_message_attachments`, présente dans la migration canonique)
autorise la suppression si `(storage.foldername(name))[2]::uuid = auth.uid()`.
Les deux règles doivent concorder : l'auteur du message est l'auteur du fichier.
Si ce n'est pas le cas, documenter la divergence.

**Critère.** L'auteur supprime sa pièce jointe ; un tiers ne peut pas.
**Preuve.** Test 0.4.1 (B5).

### 0.1.8 — Filtre `deleted_at` sur la lecture des messages (correctif B6 — RGPD)

**Action.** Recréer la policy de sélection des messages en excluant les messages
supprimés.

```sql
drop policy if exists members_select_messages on public.messages;
create policy members_select_messages on public.messages for select
  using (
    deleted_at is null                                   -- ← CORRECTIF B6 (RGPD)
    and public.is_conversation_member(conversation_id, auth.uid())
  );
```

**Décision à trancher et documenter.** L'auteur d'un message supprimé doit-il
continuer à le voir ? Décision retenue : **non**. « Supprimé » doit signifier
« invisible ». Un affichage de type « ce message a été supprimé » relève de l'UI
et peut être produit sans exposer le contenu.

**Vérifier aussi.** Le nom exact de la policy relevé en 0.0.6, et l'existence
d'autres policies de lecture sur `messages` qui contourneraient celle-ci.

**Critère.** Un message avec `deleted_at` non nul est invisible **y compris par
appel API direct**.
**Preuve.** Test 0.4.1 (B6), RED puis GREEN, avec appel API direct dans le test.

### 0.1.9 — Colonne `trips.conversation_id`

**Action.** Préparer le chat de voyage du C7, en additif.

```sql
-- ⚠️ À exécuter APRÈS le C1 si trips n'existe pas encore.
-- Sinon, déplacer cette sous-tâche dans la migration du C1.
alter table public.trips
  add column if not exists conversation_id uuid unique
  references public.conversations(id) on delete set null;
```

**Décision d'ordonnancement.** Si `trips` n'existe pas encore au moment du C0
(ce qui est le cas normal), cette colonne est **déplacée dans la migration du
C1** et la sous-tâche est marquée ⏸️ avec la mention « reportée au C1, tâche
1.1.2 ». Ce n'est pas un échec, c'est un ordonnancement correct.

### 0.1.10 — RPC `get_or_create_trip_conversation`

**Action.** Symétrique de 0.1.1, appliquant la règle produit de 0.2.1.

```sql
create or replace function public.get_or_create_trip_conversation(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_conv   uuid;
  v_group  uuid;
  v_title  text;
begin
  if v_caller is null then
    raise exception 'Authentification requise';
  end if;

  if not public.can_edit_trip(p_trip_id) then   -- helper du C1
    raise exception 'Accès refusé au voyage';
  end if;

  select t.conversation_id, t.group_id, t.title
    into v_conv, v_group, v_title
  from public.trips t where t.id = p_trip_id;

  if v_conv is not null then
    return v_conv;
  end if;

  -- RÈGLE PRODUIT 0.2.1 : si le voyage appartient à un groupe,
  -- le chat du voyage EST celui du groupe. On ne crée rien.
  if v_group is not null then
    v_conv := public.get_or_create_group_conversation(v_group);
    update public.trips set conversation_id = v_conv where id = p_trip_id;
    return v_conv;
  end if;

  perform pg_advisory_xact_lock(hashtext('tripconv:' || p_trip_id::text));

  insert into public.conversations (type, title, created_by)
  values ('group', v_title, v_caller)
  returning id into v_conv;

  update public.trips set conversation_id = v_conv where id = p_trip_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conv, c.user_id,
         case when c.role = 'owner' then 'owner'
              when c.role = 'editor' then 'admin'
              else 'member' end
  from public.trip_collaborators c
  where c.trip_id = p_trip_id
  on conflict (conversation_id, user_id) do nothing;

  -- L'owner du voyage n'est pas nécessairement dans trip_collaborators
  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conv, t.owner_id, 'owner' from public.trips t where t.id = p_trip_id
  on conflict (conversation_id, user_id) do nothing;

  return v_conv;
end $$;
```

**Dépendance.** Cette fonction dépend de `can_edit_trip` et de
`trip_collaborators`, tous deux créés au C1. Elle est donc **⏸️ au C0 et
implémentée au C7**, tâche 7.1.4. La sous-tâche reste listée ici pour la
traçabilité de la conception.

**Note sur `type`.** On conserve `type='group'` : le CHECK de `conversations`
n'autorise que `direct|group`. Inutile de le complexifier avec un type `trip`.

### 0.1.11 — Index de support
**Action.**
```sql
create index if not exists idx_conversation_members_active
  on public.conversation_members(conversation_id, user_id)
  where left_at is null;
create index if not exists idx_messages_conv_not_deleted
  on public.messages(conversation_id, created_at desc)
  where deleted_at is null;
```
**Justification.** Les deux nouvelles clauses `where` des policies (B6, B7)
deviennent des prédicats fréquents ; sans index partiel, chaque lecture de fil
dégrade.
**Critère.** `explain analyze` sur la lecture d'un fil de 1000 messages utilise
l'index partiel.

### 0.1.12 — Vérification d'idempotence
**Action.** `supabase db reset --local` puis `supabase db push` **deux fois de
suite**.
**Critère.** Aucune erreur au second passage. Aucun objet dupliqué.
**Preuve.** Les deux sorties collées.

### 0.1.13 — Audit RLS adverse
**Action.** Lancer `RLS-BREAKER` avec les personas `security/moxie-marlinspike.md`
et `security/mudge-zatko.md`. Sa mission : tenter de contourner chacune des
policies créées ou modifiées, dans le cadre d'un audit interne autorisé du
projet.
**Vecteurs à couvrir.** Lecture d'un fil dont on n'est pas membre · lecture d'un
message supprimé · lecture après départ du groupe · création de conversation sans
appartenance au groupe · suppression de la pièce jointe d'autrui · modification
de la mention d'autrui · appel des RPC avec un `p_group_id` arbitraire.
**Critère.** Zéro contournement réussi. Chaque tentative documentée avec son
résultat.
**Preuve.** Rapport écrit du `RLS-BREAKER` collé dans `PROGRESS_VOYAGE.md`.
**Blocage.** Toute anomalie trouvée est de classe A : correction immédiate avant
de passer à 0.2.

**GATE DE SORTIE DE PHASE 0.1.** Les 13 sous-tâches ✅ ou ⏸️ justifiées. Migration
idempotente prouvée deux fois. `RLS-BREAKER` sans contournement. Les cinq bugs
corrigeables par SQL (B1, B2, B3, B4, B5, B6, B7) ont chacun leur paire RED/GREEN.

---

## PHASE 0.2 — RÈGLE PRODUIT DU CHAT DE VOYAGE

**Objectif de phase.** Trancher une décision produit et la documenter. Phase
courte mais non délégable.

**Skills actifs** : `executing-plans`.
**Personas** : `product-policy/` profil produit senior.
**Sous-agents** : aucun — **décision non déléguable**.

### 0.2.1 — Décision : quel fil pour un voyage ?
**Décision retenue.** Si `trip.group_id` est non nul, le chat du voyage **EST**
celui du groupe : on ne crée rien. Sinon, une conversation dédiée est créée à la
demande.
**Justification à consigner.** Un club de randonnée qui organise trois voyages
garde un fil unique et vivant plutôt que quatre fils morts. Un voyageur solo qui
invite deux amis obtient quand même un fil. La création est paresseuse (à la
demande), donc aucun objet inutile n'est créé.
**Alternatives écartées.** Une conversation systématique par voyage (fragmente
les échanges d'un même groupe) · aucune conversation de voyage (oblige à sortir
du contexte pour discuter).
**Critère.** La décision est écrite dans le journal des décisions avec ses
alternatives et sa justification.

### 0.2.2 — Décision : pas de nouveau `type` de conversation
**Décision.** `conversations.type` reste `direct | group`. Un chat de voyage est
un `group`.
**Justification.** Ajouter un type `trip` obligerait à modifier le CHECK, à
auditer toutes les policies qui filtrent sur `type`, et n'apporterait aucune
capacité nouvelle. Le lien vers le voyage est porté par
`trips.conversation_id`, ce qui suffit.
**Critère.** Décision consignée.

### 0.2.3 — Décision : accès historique d'un ex-membre
**Décision.** Un ex-membre ne lit plus le fil, y compris les messages antérieurs
à son départ.
**Justification.** Simplicité de la policy, sécurité maximale, et un fil de
groupe est par nature collectif. L'alternative (`messages.created_at < left_at`)
est implémentable mais ajoute une jointure à chaque lecture pour un besoin non
exprimé.
**Dette.** Si le besoin apparaît, la policy alternative est documentée en annexe.
**Critère.** Décision consignée et cohérente avec 0.1.3.

### 0.2.4 — Décision : pas de décrément d'`unread_count`
**Décision.** La suppression d'un message ne décrémente pas les compteurs.
**Justification.** Complexité disproportionnée, risque de compteur négatif malgré
le CHECK, impact utilisateur négligeable.
**Critère.** Décision consignée en dette assumée.

### 0.2.5 — Documentation dans `CLAUDE.md`
**Action.** Ajouter une section « Messagerie unifiée » dans `CLAUDE.md` décrivant
le principe d'unicité, les trois RPC, les triggers, et la règle 0.2.1.
**Critère.** La section existe et un développeur qui la lit comprend qu'il ne
doit jamais dupliquer un fil.

**GATE DE SORTIE DE PHASE 0.2.** Les 5 décisions sont écrites, justifiées, et
cohérentes avec le SQL de 0.1. `CLAUDE.md` est à jour.

---

## PHASE 0.3 — FACTORISATION FRONT

**Objectif de phase.** **C'est ici que se joue réellement l'unification côté
utilisateur.** Un seul hook, un seul composant, deux surfaces d'affichage, zéro
logique dupliquée.

**Skills actifs** : `executing-plans`, `apple-ui-designer`,
`test-driven-development`.
**Personas** : `programming/` profil abstraction, `design/` profils ergonomie.
**Sous-agents** : `FRONT-SMITH` (hook), `FRONT-SMITH-2` (composant) — parallélisables
si l'interface entre les deux est figée d'abord.

### 0.3.1 — Contrat d'interface du hook
**Action.** Avant tout code, figer par écrit la signature de
`useConversation(conversationId)` : ce qu'il retourne, ce qu'il expose comme
actions, ses états.
```ts
interface UseConversationResult {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  sendMessage: (body: string, attachments?: File[]) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: () => Promise<void>;
  members: ConversationMember[];
  unreadCount: number;
}
```
**Pourquoi d'abord.** Ce contrat permet de paralléliser 0.3.2 et 0.3.4 sans
collision.
**Critère.** Le contrat est écrit dans un fichier de types et commité avant toute
implémentation.

### 0.3.2 — Implémentation de `useConversation`
**Action.** Créer `src/hooks/useConversation.ts`.
**Responsabilités.** Chargement paginé (curseur sur `created_at`, page de 30) ·
envoi optimiste avec rollback en cas d'échec · abonnement Realtime sur le channel
`messages:conversation_id=eq.X` · déduplication (un message envoyé optimistiquement
puis reçu par Realtime ne doit pas apparaître deux fois) · reconnexion avec
backoff exponentiel · appel de `mark_conversation_read` au focus.
**Points d'attention.** La déduplication est le piège classique : utiliser un
identifiant client temporaire (`clientId`) réconcilié avec l'`id` serveur au
retour. Le `markRead` doit être debouncé pour ne pas marteler la base.
**Critère.** Le hook fonctionne isolément, testé par un test d'intégration.
**Preuve.** Test 0.4.6.

### 0.3.3 — Gestion des états de connexion
**Action.** Exposer et afficher `connectionState`. Réutiliser l'`OfflineBanner`
et `useOnlineStatus` existants du projet.
**Critère.** En coupant le réseau, l'utilisateur voit un état explicite, pas un
chat qui semble fonctionner et perd les messages.

### 0.3.4 — Composant unique `ConversationPanel`
**Action.** Créer `src/components/messaging/ConversationPanel.tsx` avec la
signature :
```tsx
<ConversationPanel
  conversationId={id}
  variant="page" | "embedded"
  className?
/>
```
**Responsabilités.** Liste virtualisée des messages · composeur · pièces jointes
· réactions · mentions · indicateur de lecture · état vide soigné · état d'erreur.
**Dual-view à l'intérieur du composant.** Desktop en Tailwind, mobile en inline
styles, conformément au pattern du projet. La variante `embedded` réduit les
marges et supprime l'en-tête (fourni par le conteneur).
**Critère.** Le composant est autonome : lui donner un `conversationId` suffit.

### 0.3.5 — Branchement de `/messagerie` (variante `page`)
**Action.** Remplacer la logique de chat existante de `src/app/messagerie/` par
`<ConversationPanel variant="page" />`. Conserver la liste des conversations
(triée par `last_message_at`, désormais fonctionnelle grâce à B2).
**Critère.** `/messagerie` fonctionne à l'identique ou mieux, avec zéro logique
de chat locale.

### 0.3.6 — Branchement de la page groupe (variante `embedded`)
**Action.** Ajouter un onglet « Discussion » à la page groupe, qui appelle
`get_or_create_group_conversation` puis monte
`<ConversationPanel variant="embedded" />`.
**Critère.** Un message envoyé ici apparaît dans `/messagerie` sans rechargement.

### 0.3.7 — Suppression de la duplication
**Action.** Supprimer tout code de chat devenu mort, identifié en 0.0.4 et 0.0.5.
**Critère.** Aucun composant de chat en double.
**Preuve.** Test de grep 0.4.7.

### 0.3.8 — Accessibilité du chat
**Action.** Rôle `log` avec `aria-live="polite"` sur la liste, libellés sur les
actions, navigation clavier complète, focus géré à l'envoi.
**Critère.** Parcours complet du chat au clavier seul.
**Preuve.** Test Playwright a11y 0.4.9.

### 0.3.9 — Revue visuelle
**Action.** Avec `apple-ui-designer` et les personas `design/`, revoir les deux
variantes aux deux largeurs.
**Critère.** Aucun débordement, aucune zone tactile < 44 px, contrastes conformes.

**GATE DE SORTIE DE PHASE 0.3.** Les 9 sous-tâches ✅. Un seul hook, un seul
composant. Les deux surfaces branchées. Aucune duplication. A11y validée.

---

## PHASE 0.4 — TESTS

**Objectif de phase.** Prouver que les sept bugs sont corrigés et que
l'unification fonctionne réellement. **Le protocole RED/GREEN de §10.3 est
obligatoire sur chaque bug.**

**Skills actifs** : `test-driven-development`, `verification-before-completion`.
**Sous-agents** : `TEST-WRIGHT` ∥ `RLS-BREAKER` (fichiers distincts).

### 0.4.1 — Suite de non-régression des 7 bugs
**Action.** Un test **nommé** par bug, avec sa paire RED/GREEN.
```
messaging-bugs.test.ts
  B1 — un membre du groupe peut créer la conversation de groupe
  B2 — last_message_at est mis à jour après envoi
  B3 — unread_count est incrémenté pour les autres membres actifs
  B4 — un membre lit les mentions de son fil, un tiers ne lit rien
  B5 — l'auteur supprime sa pièce jointe, un tiers ne peut pas
  B6 — un message deleted_at est invisible, y compris par appel API direct
  B7 — un ex-membre ne lit plus le fil
```
**Critère.** Sept tests, quatorze sorties (7 RED + 7 GREEN) collées.

### 0.4.2 — Test d'unicité de la conversation de groupe
**Action.** Appeler `get_or_create_group_conversation` deux fois → même `uuid`
retourné, une seule ligne créée.
**Critère.** Idempotence prouvée.

### 0.4.3 — Test de concurrence
**Action.** Deux appels **simultanés** à `get_or_create_group_conversation` sur
le même groupe → une seule conversation.
**Pourquoi.** C'est le test qui valide le `pg_advisory_xact_lock`. Sans lui,
l'advisory lock est du code non vérifié.
**Critère.** Une seule ligne dans `conversations` pour ce groupe.

### 0.4.4 — Test du cycle de vie de l'appartenance
**Action.** Ajouter un membre au groupe → il apparaît dans
`conversation_members` · changer son rôle → propagé · le retirer → `left_at`
posé et lecture bloquée · le réintégrer → `left_at` remis à `null` et lecture
rétablie.
**Critère.** Les quatre transitions vérifiées.

### 0.4.5 — Test des compteurs
**Action.** A envoie → B a `unread_count = 1`, A a `0`, `last_message_at` à jour ·
B appelle `mark_conversation_read` → `unread_count = 0`, `last_read_at` posé ·
un non-membre appelle `mark_conversation_read` → exception.
**Critère.** Les trois cas vérifiés.

### 0.4.6 — Test d'unification réelle (le test central du chantier)
**Action.** Un message envoyé depuis la surface groupe est lu depuis
`/messagerie` avec le **même `message.id`**, et réciproquement.
**Pourquoi c'est le test central.** Il prouve qu'il n'y a pas deux fils
synchronisés mais un seul objet. Si ce test passe, l'architecture est correcte.
**Critère.** Égalité des `id` vérifiée dans les deux sens.

### 0.4.7 — Test anti-duplication de code
**Action.** Grep automatisé prouvant qu'aucune logique d'envoi de message,
d'abonnement Realtime ou de rendu de fil n'existe en dehors de
`useConversation` et `ConversationPanel`.
**Critère.** Le test échoue si un futur développeur duplique le chat.

### 0.4.8 — Test RLS complet du domaine messagerie
**Action.** Matrice : membre actif / ex-membre / non-membre / anon × `conversations`,
`conversation_members`, `messages`, `message_attachments`, `message_reactions`,
`message_mentions` × select/insert/update/delete.
**Critère.** Chaque cellule de la matrice est un test nommé, aucune surprise.

### 0.4.9 — Playwright e2e et a11y
**Action.** Parcours réel sur les deux surfaces, en 390 px et 1440 px : ouvrir,
envoyer, recevoir en temps réel, marquer lu, joindre un fichier, mentionner.
Plus un parcours au clavier seul.
**Critère.** Vert aux deux largeurs. Realtime réellement testé (deux contextes
navigateur).

### 0.4.10 — Playwright visual
**Action.** Snapshots des deux variantes, deux largeurs, états : vide, chargé,
erreur, hors ligne.
**Critère.** Snapshots générés et validés.

**GATE DE SORTIE DE PHASE 0.4.** Les 10 sous-tâches ✅. 7 paires RED/GREEN
collées. Le test d'unification 0.4.6 est vert. La matrice RLS est complète.

---

## PHASE 0.5 — VÉRIFICATION TRANSVERSALE

**Objectif.** Prouver que rien d'autre n'a cassé.

**Skills actifs** : `verification-before-completion`.

### 0.5.1 — `npx tsc --noEmit`
**Critère.** Zéro erreur. **Aucun `@ts-ignore` ajouté** (diff vérifié).

### 0.5.2 — `npm run lint`
**Critère.** Zéro warning nouveau par rapport à la baseline 0.0.7.

### 0.5.3 — `npx next build`
**Critère.** Vert. Pas de régression majeure de taille de bundle.

### 0.5.4 — Suite de tests complète du projet
**Action.** Lancer **toute** la suite existante, pas seulement celle du chantier.
**Critère.** Aucune régression par rapport à la baseline.

### 0.5.5 — Double rejeu de la migration
**Action.** `supabase db reset --local` puis `db push` deux fois.
**Critère.** Idempotence confirmée.

### 0.5.6 — Vérification RLS par requête système
**Action.**
```sql
select tablename, rowsecurity from pg_tables
where schemaname='public'
  and tablename like 'conversation%' or tablename like 'message%';
select tablename, policyname, cmd from pg_policies
where schemaname='public' and (tablename like 'conversation%' or tablename like 'message%')
order by tablename, cmd;
```
**Critère.** RLS active partout, et chaque table a au moins une policy par
commande accordée par un `GRANT`. **C'est le test qui aurait détecté B1, B4 et
B5 à l'origine.**

### 0.5.7 — Grep de sécurité
**Action.** Aucun secret, aucune clé service, aucune requête base côté client.
**Critère.** Grep propre.

### 0.5.8 — Revue croisée des grants et policies
**Action.** Pour chaque table de messagerie, comparer les `GRANT` et les
policies. Un `GRANT` sans policy correspondante est un bug de classe B4/B5.
**Livrable.** Tableau `table × commande × grant × policy` dans le rapport.
**Critère.** Aucune ligne incohérente.

**GATE DE SORTIE DE PHASE 0.5.** Les 8 sous-tâches ✅. Aucune régression.
Tableau grants/policies cohérent.

---

## PHASE 0.6 — CLÔTURE

**Skills actifs** : `requesting-code-review`, `receiving-code-review`,
`verification-before-completion`, `finishing-a-development-branch`.

### 0.6.1 — Audit sécurité écrit (BLOQUANT)
**Action.** Rapport formel des personas `security/moxie-marlinspike.md`,
`security/mudge-zatko.md` et `security/tarah-wheeler.md`, table par table,
policy par policy, avec une section dédiée à B6 et B7 en tant que fuites de
données personnelles.
**Format.** S'inspirer de `pays-conformite-lg.md` pour la rigueur du format.
**Critère.** Rapport rendu, zéro anomalie de classe A.
**Blocage.** Une anomalie de classe A interdit la clôture.

### 0.6.2 — Revue de code
**Action.** `requesting-code-review` avec `REVIEWER` sur l'ensemble du diff.
**Critère.** Revue rendue.

### 0.6.3 — Traitement des retours
**Action.** `receiving-code-review`. Chaque retour est traité : corrigé, ou
refusé avec justification écrite.
**Critère.** Zéro retour non traité.

### 0.6.4 — Vérification finale
**Action.** `verification-before-completion` sur l'intégralité du chantier :
relire les 78 lignes du fichier de progression et vérifier que chaque ✅ a bien
ses quatre conditions.
**Critère.** Aucun ✅ sans preuve collée. **C'est ici qu'on attrape les faux ✅.**

### 0.6.5 — Mise à jour de `MISSION_LOG.md`
**Action.** Consigner le chantier : périmètre, 7 bugs corrigés, décisions,
dette, durée.
**Critère.** Entrée créée.

### 0.6.6 — Mise à jour de `CLAUDE.md`
**Action.** Section « Messagerie unifiée » finalisée (commencée en 0.2.5).
**Critère.** Un développeur qui lit `CLAUDE.md` comprend le principe d'unicité.

### 0.6.7 — Finalisation du fichier de progression
**Action.** Tableau de bord à `78/78` (ou `X/78` avec les ⏸️ justifiés), journal
des décisions complet, dette assumée listée, journal RED/GREEN complet.
**Critère.** Aucune ⬜, aucune 🔄.

### 0.6.8 — Rapport final de chantier
**Contenu obligatoire.** Ce qui est fait · ce qui est ⏸️ et pourquoi · dette
assumée avec impact et coût · anomalies hors périmètre découvertes · les trois
premières actions du C1 · **et, s'il y a lieu, la mention explicite de tout faux
✅ détecté**.
**Critère.** Rapport honnête, sans embellissement.

### 0.6.9 — PR
**Action.** `finishing-a-development-branch`. PR vers `main` (ou `develop` selon
la CI, qui se déclenche sur push et PR vers `main`/`develop`). **Jamais de push
direct sur `main`.**
**Critère.** PR ouverte, CI verte.

## 14.6 Points d'arrêt durs du C0

Le nom réel de la table des membres de groupe est introuvable ou aucune table
équivalente n'existe (0.0.2).

Un ou plusieurs bugs de B1 à B7 ne sont **pas reproductibles**, indiquant que le
schéma réel diverge de la migration lue (0.0.6).

La baseline `tsc` / `lint` / `build` est déjà rouge avant intervention (0.0.7).

`travel_groups.conversation_id` n'existe pas et l'ajouter impliquerait de
modifier une migration existante.

L'audit 0.6.1 révèle une fuite non corrigeable sans changement de schéma.

Une décision de 0.2 s'avère incompatible avec le schéma réel.

## 14.7 Risques spécifiques du C0

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Signature de `is_conversation_member` modifiée par erreur → toutes les policies cassent | Moyenne | Critique | Conserver la signature exacte relevée en 0.0.3 ; test 0.4.8 complet |
| Déduplication Realtime mal gérée → messages en double à l'écran | Élevée | Moyen | `clientId` réconcilié ; test 0.4.6 |
| Advisory lock non testé → conversations dupliquées en production | Moyenne | Élevé | Test de concurrence 0.4.3 obligatoire |
| Suppression de code de chat existant qui servait ailleurs | Moyenne | Moyen | Grep exhaustif en 0.0.4/0.0.5 avant suppression en 0.3.7 |
| Correctif B6 casse l'affichage « message supprimé » | Faible | Faible | Traité en UI, sans exposer le contenu |

## 14.8 Dette autorisée au C0

Pas de décrément d'`unread_count` à la suppression d'un message (0.2.4).

Pas d'accès historique pour un ex-membre (0.2.3) — policy alternative documentée
en annexe si le besoin apparaît.

`trips.conversation_id` et `get_or_create_trip_conversation` reportés au C1/C7
(0.1.9, 0.1.10).

---

<a name="c1"></a>
# §15. CHANTIER 1 — FONDATIONS DE L'ENTITÉ TRIP

## 15.1 Identité

| Champ | Valeur |
|---|---|
| **Branche** | `feat/c1-trips-core` |
| **Dépend de** | C0 (noms de tables confirmés, convention `user_profiles`) |
| **Bloque** | C2, C3, C4, C5, C6, C7, C8 — **tout le reste** |
| **Phases** | 7 (1.0 → 1.6) |
| **Sous-tâches** | 71 |
| **Migration** | `<horodatage>_trips_core.sql` |
| **Audit bloquant** | `security/` sur 9 tables, policy par policy |

## 15.2 Objectif et valeur

Créer l'entité pivot et **seulement** l'entité pivot. Neuf tables, une RLS
irréprochable, un service layer, des types, et deux routes en **lecture seule**.
Aucune fonctionnalité avancée.

**Pourquoi ce périmètre étroit.** Sept chantiers écrivent dans ces tables. Une
erreur de modélisation ou de sécurité ici se propage partout. Mieux vaut un C1
minimal et parfait qu'un C1 riche et fragile.

## 15.3 Équipe

**Skills** : les 11 obligatoires + `apple-ui-designer` (phase 1.4).
**Personas** : `data-ai/dj-patil.md` et `programming/` profil systèmes (1.1) ·
`security/moxie-marlinspike.md` + `security/mudge-zatko.md` (1.2, **bloquant**) ·
`design/` profils ergonomie (1.4).
**Sous-agents** : `SCOUT` ×2 (1.0), `SQL-SMITH` (1.1, 1.2), `RLS-BREAKER`
(1.2, 1.5), `ENGINE-SMITH` (1.3), `FRONT-SMITH` (1.4), `TEST-WRIGHT` (1.5),
`REVIEWER`, `SCRIBE`.

---

## PHASE 1.0 — RECONNAISSANCE (7 sous-tâches)

### 1.0.1 — Chargement
Docs, 11 skills, personas assignés. Inventaire rapporté. Relire la dette et les
⏸️ du C0.

### 1.0.2 — Confirmation des dépendances externes
**Action.** Confirmer par lecture : `public.travel_groups(id)` et
`public.user_profiles(id)`. Vérifier si `trips` existe déjà (il ne devrait pas).
**Critère.** Les deux FK citées avec `fichier:ligne`.
**Point d'arrêt.** Si les noms diffèrent de ce que le C0 a établi.

### 1.0.3 — Horodatage de la migration
**Action.** Relever le dernier fichier de `supabase/migrations/` et choisir un
horodatage postérieur.
**Critère.** Nom de fichier conforme `YYYYMMDDHHMMSS_trips_core.sql`.

### 1.0.4 — Vérification des extensions et helpers
**Action.** Confirmer `postgis`, `uuid-ossp` (ou `gen_random_uuid` natif), et
l'existence d'un helper `set_updated_at()`.
**Note.** La migration de messagerie utilise `gen_random_uuid()` ; s'aligner sur
la convention réelle du projet plutôt que d'imposer `uuid_generate_v4()`.
**Critère.** Convention d'UUID du projet identifiée et respectée.

### 1.0.5 — Lecture du pattern de service layer
**Action.** Lire `src/lib/queries-compte.ts` intégralement : client Supabase
serveur utilisé, gestion d'erreur, typage, conventions de nommage.
**Critère.** Le pattern est décrit et sera calqué en 1.3.

### 1.0.6 — Baseline
`tsc`, `lint`, `build`, tests. Consignés.
**Point d'arrêt** si rouge.

### 1.0.7 — Branche
`git checkout -b feat/c1-trips-core`.

---

## PHASE 1.1 — MIGRATION SQL : LES 9 TABLES (14 sous-tâches)

**Sous-agent** : `SQL-SMITH` seul. **Parallélisation interdite.**

### 1.1.1 — En-tête et helpers
```sql
create extension if not exists postgis;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
```

### 1.1.2 — Table `trips`
```sql
create table if not exists public.trips (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.user_profiles(id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 160),
  slug                text not null unique,
  status              text not null default 'draft'
                      check (status in ('draft','planning','booked','active','completed','archived')),
  visibility          text not null default 'private'
                      check (visibility in ('private','link','public')),
  share_token         uuid not null default gen_random_uuid(),
  start_date          date,
  end_date            date,
  duration_days       int check (duration_days between 1 and 400),
  travelers_count     int not null default 1 check (travelers_count between 1 and 50),
  trip_styles         text[] not null default '{}',
  budget_target_cents int check (budget_target_cents >= 0),
  currency            char(3) not null default 'EUR',
  locale              text not null default 'fr',
  cover_image_url     text,
  summary             text,
  group_id            uuid references public.travel_groups(id) on delete set null,
  conversation_id     uuid unique references public.conversations(id) on delete set null,
  duplicated_from     uuid references public.trips(id) on delete set null,
  completeness        smallint not null default 0 check (completeness between 0 and 100),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trips_date_order check (start_date is null or end_date is null or end_date >= start_date)
);
```
**Notes.** `conversation_id` intègre ici la sous-tâche 0.1.9 reportée du C0.
`share_token` séparé de l'`id` pour pouvoir être rotaté au C7 sans changer
l'URL canonique. `duration_days` permet un voyage sans dates (« Pérou, 3
semaines, un jour »).

### 1.1.3 — `trip_countries`
```sql
create table if not exists public.trip_countries (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  country_code   char(2) not null,
  order_index    int not null default 0,
  arrival_date   date,
  departure_date date,
  nights         int check (nights >= 0),
  created_at     timestamptz not null default now(),
  unique (trip_id, country_code)
);
```
**Note.** Table dédiée et non colonne unique : c'est ce qui rend le multi-pays
natif dès le schéma. L'`order_index` définit l'ordre de l'itinéraire.

### 1.1.4 — `trip_stages` + trigger `geog`
```sql
create table if not exists public.trip_stages (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  country_code char(2) not null,
  name         text not null,
  lat          double precision check (lat between -90 and 90),
  lng          double precision check (lng between -180 and 180),
  geog         geography(Point,4326),
  altitude_m   int,
  day_from     int check (day_from >= 1),
  day_to       int check (day_to >= 1),
  order_index  int not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint trip_stages_day_order check (day_from is null or day_to is null or day_to >= day_from)
);

create or replace function public.trip_stages_sync_geog()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geog = st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end $$;

drop trigger if exists trg_trip_stages_geog on public.trip_stages;
create trigger trg_trip_stages_geog
  before insert or update of lat, lng on public.trip_stages
  for each row execute function public.trip_stages_sync_geog();
```
**Note.** `altitude_m` sur l'étape est ce qui permettra au C6 de déduire un kit
d'altitude sans que l'utilisateur le déclare.

### 1.1.5 — `trip_days`
```sql
create table if not exists public.trip_days (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  day_index  int not null check (day_index between 1 and 400),
  date       date,
  stage_id   uuid references public.trip_stages(id) on delete set null,
  title      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_index)
);
```
**Piège pour le C3.** La contrainte `unique (trip_id, day_index)` impose une
renumérotation sans trou à chaque insertion ou suppression de jour. C'est
volontaire (l'intégrité vaut mieux que la facilité) mais le C3 doit le gérer
avec une transaction.

### 1.1.6 — `trip_items` + trigger `geog`
```sql
create table if not exists public.trip_items (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  day_id            uuid references public.trip_days(id) on delete set null,
  stage_id          uuid references public.trip_stages(id) on delete set null,
  kind              text not null
                    check (kind in ('hike','poi','restaurant','stay','transport','activity','logistics')),
  ref_type          text check (ref_type in ('hiking_route','place','refuge','product','external')),
  ref_id            uuid,
  external_ref      jsonb,
  title             text not null,
  description       text,
  lat               double precision,
  lng               double precision,
  geog              geography(Point,4326),
  start_at          timestamptz,
  duration_min      int check (duration_min >= 0),
  price_cents       int check (price_cents >= 0),
  currency          char(3) default 'EUR',
  booking_status    text not null default 'idea'
                    check (booking_status in ('idea','shortlist','booked','done','skipped')),
  booking_ref       text,
  affiliate_link_id uuid,
  source            text not null default 'user'
                    check (source in ('user','ai','community','import')),
  order_index       int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- trigger geog identique à 1.1.4
```
**Décisions capitales.** `affiliate_link_id` est une **colonne nue sans FK** :
la table cible est créée au C5. La FK sera activée en 5.1.5. `source` est ce qui
permettra au C2 de régénérer l'itinéraire sans détruire le travail de
l'utilisateur (`source='user'` préservé). `external_ref jsonb` accueille les
items non locaux (`{provider:'travelpayouts', id:'...'}`).

### 1.1.7 — `trip_kit_items`
```sql
create table if not exists public.trip_kit_items (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  product_id        uuid,
  inventory_item_id uuid,
  label             text not null,
  category          text,
  qty               int not null default 1 check (qty > 0),
  weight_g          int check (weight_g >= 0),
  status            text not null default 'needed'
                    check (status in ('needed','owned','to_buy','to_rent','to_borrow','packed')),
  is_essential      boolean not null default false,
  source            text not null default 'user' check (source in ('user','ai','template')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```
**Note.** `product_id` et `inventory_item_id` sans FK au C1 : les noms réels des
tables catalogue et inventaire seront confirmés au C6. Documenter cette dette.

### 1.1.8 — `trip_documents`
```sql
create table if not exists public.trip_documents (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  type         text not null
               check (type in ('visa','vaccin','assurance','permis','esim','passeport','billet','autre')),
  label        text not null,
  status       text not null default 'todo'
               check (status in ('todo','in_progress','done','not_required')),
  due_on       date,
  expires_on   date,
  storage_path text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```
**Table la plus sensible du schéma.** Voir 1.2.6.

### 1.1.9 — `trip_budget_lines`
```sql
create table if not exists public.trip_budget_lines (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  category     text not null
               check (category in ('transport','hebergement','nourriture','activites','materiel','assurance','divers')),
  label        text not null,
  amount_cents int not null check (amount_cents >= 0),
  currency     char(3) not null default 'EUR',
  is_estimate  boolean not null default true,
  paid_on      date,
  item_id      uuid references public.trip_items(id) on delete set null,
  created_at   timestamptz not null default now()
);
```

### 1.1.10 — `trip_collaborators`
```sql
create table if not exists public.trip_collaborators (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('owner','editor','viewer')),
  invited_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
```
**Note.** PK composite : un utilisateur ne peut avoir qu'un rôle par voyage.

### 1.1.11 — Triggers `updated_at`
Sur `trips`, `trip_stages`, `trip_days`, `trip_items`, `trip_kit_items`,
`trip_documents`.

### 1.1.12 — Trigger `geog` sur `trip_items`
Identique à 1.1.4, sur `trip_items`.

### 1.1.13 — Les 17 index
```sql
create index if not exists idx_trips_owner         on public.trips(owner_id, status);
create index if not exists idx_trips_public        on public.trips(visibility, updated_at desc)
                                                   where visibility = 'public';
create index if not exists idx_trips_group         on public.trips(group_id) where group_id is not null;
create index if not exists idx_trips_slug          on public.trips(slug);
create index if not exists idx_trip_countries_cc   on public.trip_countries(country_code);
create index if not exists idx_trip_countries_trip on public.trip_countries(trip_id, order_index);
create index if not exists idx_trip_stages_trip    on public.trip_stages(trip_id, order_index);
create index if not exists idx_trip_stages_geog    on public.trip_stages using gist(geog);
create index if not exists idx_trip_days_trip      on public.trip_days(trip_id, day_index);
create index if not exists idx_trip_items_trip     on public.trip_items(trip_id, order_index);
create index if not exists idx_trip_items_day      on public.trip_items(day_id, order_index);
create index if not exists idx_trip_items_kind     on public.trip_items(trip_id, kind);
create index if not exists idx_trip_items_ref      on public.trip_items(ref_type, ref_id) where ref_id is not null;
create index if not exists idx_trip_items_geog     on public.trip_items using gist(geog);
create index if not exists idx_trip_kit_trip       on public.trip_kit_items(trip_id, status);
create index if not exists idx_trip_docs_trip      on public.trip_documents(trip_id, status);
create index if not exists idx_trip_budget_trip    on public.trip_budget_lines(trip_id, category);
create index if not exists idx_trip_collab_user    on public.trip_collaborators(user_id);
```

### 1.1.14 — Vérification d'idempotence
Double rejeu.

---

## PHASE 1.2 — RLS : LA PHASE CRITIQUE (11 sous-tâches)

**Audit `security/` bloquant.** `RLS-BREAKER` mobilisé.

### 1.2.1 — Les deux helpers `security definer`
**Pourquoi ils existent.** Pour **casser la récursion infinie** entre la policy
de `trips` (qui interroge `trip_collaborators`) et celle de `trip_collaborators`
(qui interroge `trips`). Sans eux, PostgreSQL lève
`infinite recursion detected in policy`.

```sql
create or replace function public.can_read_trip(p_trip uuid)
returns boolean language sql security definer
set search_path = public, pg_temp stable as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip
      and (
        t.owner_id = auth.uid()
        or t.visibility = 'public'
        or exists (select 1 from public.trip_collaborators c
                   where c.trip_id = t.id and c.user_id = auth.uid())
      )
  );

$$;

create or replace function public.can_edit_trip(p_trip uuid)
returns boolean language sql security definer
set search_path = public, pg_temp stable as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip
      and (
        t.owner_id = auth.uid()
        or exists (select 1 from public.trip_collaborators c
                   where c.trip_id = t.id
                     and c.user_id = auth.uid()
                     and c.role in ('owner','editor'))
      )
  );

$$;
```

### 1.2.2 — Grants ciblés
```sql
revoke all on function public.can_read_trip(uuid) from public;
revoke all on function public.can_edit_trip(uuid) from public;
grant execute on function public.can_read_trip(uuid) to authenticated, anon;
grant execute on function public.can_edit_trip(uuid) to authenticated;
```
**Note.** `can_read_trip` accessible à `anon` pour permettre la lecture des
voyages publics sans authentification. `can_edit_trip` **jamais** à `anon`.

### 1.2.3 — Activation de RLS sur les 9 tables
Puis vérification par `pg_tables.rowsecurity`.

### 1.2.4 — Policies de `trips`
```sql
create policy trips_select on public.trips for select
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or exists (select 1 from public.trip_collaborators c
               where c.trip_id = trips.id and c.user_id = auth.uid())
  );
create policy trips_insert on public.trips for insert
  with check (owner_id = auth.uid());
create policy trips_update on public.trips for update
  using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy trips_delete on public.trips for delete
  using (owner_id = auth.uid());
```
**Note.** La policy `select` n'utilise pas `can_read_trip` mais sa logique
inline : sur la table `trips` elle-même il n'y a pas de récursion, et l'inline
permet à l'optimiseur d'utiliser les index.

### 1.2.5 — Policies des 6 tables filles standard
Générées en boucle sur `trip_countries`, `trip_stages`, `trip_days`,
`trip_items`, `trip_kit_items`, `trip_budget_lines` : `select` via
`can_read_trip(trip_id)`, `all` via `can_edit_trip(trip_id)`.

### 1.2.6 — `trip_documents` : LE CAS SPÉCIAL
```sql
create policy trip_documents_select on public.trip_documents for select
  using (public.can_edit_trip(trip_id));
create policy trip_documents_write on public.trip_documents for all
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
```
**Justification.** Les documents sont invisibles même aux `viewer` d'un voyage
**public**. Un scan de passeport qui fuiterait via un lien public serait une
violation RGPD caractérisée. **Le coût de ce choix est nul, le bénéfice
considérable.** Ne jamais assouplir cette policy, même si un utilisateur le
demande — ce serait une régression de sécurité.

### 1.2.7 — Policies de `trip_collaborators`
```sql
create policy trip_collab_select on public.trip_collaborators for select
  using (user_id = auth.uid() or public.can_edit_trip(trip_id));
create policy trip_collab_write on public.trip_collaborators for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
```
**Note.** Écriture réservée à l'`owner` : un `editor` ne peut pas inviter, ce qui
évite l'escalade de privilèges.

### 1.2.8 — RPC de partage par token
```sql
create or replace function public.get_trip_by_share_token(p_token uuid)
returns setof public.trips
language sql security definer
set search_path = public, pg_temp stable as $$
  select * from public.trips
  where share_token = p_token and visibility in ('link','public')
  limit 1;

$$;
revoke all on function public.get_trip_by_share_token(uuid) from public;
grant execute on function public.get_trip_by_share_token(uuid) to authenticated, anon;
```
**Contrainte d'usage.** Appelable **uniquement depuis un Server Component**.
Documenté dans le service layer.

### 1.2.9 — Vérification anti-récursion
**Action.** Requête sur `trips` avec collaborateurs.
**Critère.** Aucune erreur `infinite recursion detected in policy`.

### 1.2.10 — Vérification systématique grants/policies
Comme en 0.5.6/0.5.8 : chaque commande accordée par un `GRANT` a une policy.
**C'est le contrôle qui a manqué au C0 et a produit B1, B4 et B5.**

### 1.2.11 — Audit `RLS-BREAKER`
**Vecteurs.** B lit le voyage privé de A · B modifie le voyage de A · B supprime ·
B lit les `trip_documents` d'un voyage public de A · un `viewer` écrit · un
`editor` supprime le voyage · un `editor` invite · `anon` lit du privé · appel
direct des RPC avec des UUID arbitraires · lecture par token d'un voyage `private`.
**Critère.** Zéro contournement.

---

## PHASE 1.3 — TYPES ET SERVICE LAYER (12 sous-tâches)

### 1.3.1 — `src/features/trips/types.ts`
Unions strictement alignées sur les CHECK SQL. Interfaces `Trip`, `TripCountry`,
`TripStage`, `TripDay`, `TripItem`, `TripKitItem`, `TripDocument`,
`TripBudgetLine`, `TripCollaborator`, et l'agrégat `TripFull` avec `myRole`.

### 1.3.2 — `src/features/trips/schemas.ts`
Schémas `zod` miroirs des contraintes SQL : `CreateTripSchema`,
`UpdateTripSchema`, et les schémas d'items. Chaque `CHECK` SQL a son équivalent
zod (bornes de `travelers_count`, longueur de `title`, ordre des dates).

### 1.3.3 — `src/lib/queries-trips.ts` — en-tête
`import 'server-only'` en **première ligne**. Client Supabase serveur calqué sur
`queries-compte.ts`.

### 1.3.4 — `listMyTrips`
Voyages de l'utilisateur, triés par `updated_at desc`.

### 1.3.5 — `getTripFull` — UNE SEULE REQUÊTE
```ts
.from('trips')
.select(`*,
  countries:trip_countries(*),
  stages:trip_stages(*),
  days:trip_days(*, items:trip_items(*)),
  kit:trip_kit_items(*),
  documents:trip_documents(*),
  budget:trip_budget_lines(*),
  collaborators:trip_collaborators(*)`)
.eq('slug', slug).single()
```
**Exigence.** Un seul aller-retour réseau. **Six requêtes séquentielles = refus
en revue.** C'est ce qui garde la page sous 200 ms.

### 1.3.6 — `getTripByShareToken`
Via le RPC 1.2.8, puis chargement des relations.

### 1.3.7 — Génération de slug
`slugify(title)` + suffixe court. **Unicité garantie par retry sur violation de
contrainte unique**, jamais par SELECT préalable (sujet aux courses).

### 1.3.8 — `createTrip`
Validation zod, slug, insert, retour typé.

### 1.3.9 — `updateTrip` / `deleteTrip`
Avec vérification d'autorisation explicite en plus de la RLS (défense en
profondeur).

### 1.3.10 — `computeCompleteness`
**Formule gelée.** Itinéraire 25 points si au moins un item par jour · kit 25 si
aucun item `needed` · papiers 20 si aucun `todo` · budget 15 si renseigné ·
réservations 15 si aucun `stay`/`transport` en `idea`.

### 1.3.11 — `src/features/trips/actions.ts`
Server Actions : validation zod, autorisation, `revalidatePath`. Aucune écriture
depuis un composant client.

### 1.3.12 — Test de perf
`getTripFull` compte exactement une requête réseau.

---

## PHASE 1.4 — UI DUAL-VIEW (9 sous-tâches)

### 1.4.1 — `/voyages` desktop
Grille Tailwind, cartes de voyage avec pays, dates, complétude, statut.

### 1.4.2 — `/voyages` mobile
`MobilePageShell`, inline styles, liste verticale.

### 1.4.3 — `EmptyState` cold start
**Sous-tâche à ne pas négliger.** C'est l'écran que **100 %** des premiers
visiteurs verront. Illustration, explication de la valeur, CTA vers
`/voyages/nouveau` (le lien peut être inactif, le wizard arrive au C2).

### 1.4.4 — `/voyages/[slug]` desktop
Vue d'ensemble **en lecture seule** : en-tête, chips pays, timeline des jours,
jauge de complétude, blocs kit/papiers/budget en résumé.

### 1.4.5 — `/voyages/[slug]` mobile
Même contenu, `MobilePageShell`.

### 1.4.6 — `notFound()` sur inaccessible
**Exigence de sécurité.** Un voyage inaccessible renvoie 404, **jamais** 403.
Jamais de fuite d'information par message d'erreur différencié : un attaquant ne
doit pas pouvoir déduire l'existence d'un voyage privé.

### 1.4.7 — Respect du design system
Tokens, `AppImage` avec fallback, `LkvIcon`, zones ≥ 44 px, `dynamic import`.

### 1.4.8 — `loading.tsx` et `error.tsx`
Sur les deux routes.

### 1.4.9 — Revue visuelle
`apple-ui-designer` + personas `design/`, 390 px et 1440 px.

---

## PHASE 1.5 — TESTS (11 sous-tâches)

### 1.5.1 — Slug : unicité et retry
### 1.5.2 — `computeCompleteness` : tous les paliers
0, 25, 50, 65, 85, 100 et intermédiaires.
### 1.5.3 — Validation zod : cas limites
0 voyageur, 51 voyageurs, `end_date < start_date`, titre vide, titre 161
caractères, `duration_days` 0 et 401.

### 1.5.4 — **TESTS RLS — les plus importants du chantier**
Avec deux utilisateurs A et B, chaque assertion est un test nommé.
```
B ne lit pas le voyage privé de A
B ne modifie pas le voyage de A
B ne supprime pas le voyage de A
B lit un voyage public de A
B ne voit JAMAIS les trip_documents de A, même si le voyage est public
un viewer ne peut pas écrire
un editor peut écrire mais pas supprimer le voyage
un editor ne peut pas inviter
anon ne lit que le public
anon ne lit aucun trip_document
un token de voyage private ne donne rien
```

### 1.5.5 — Test anti-récursion
Aucune erreur `infinite recursion detected in policy`.

### 1.5.6 — Intégration : 3 pays / 14 jours
Exactement 3 `trip_countries`, 14 `trip_days` numérotés 1..14 **sans trou**.

### 1.5.7 — Cascade de suppression
Suppression d'un voyage → toutes les lignes filles purgées, zéro orpheline.
Vérifié table par table.

### 1.5.8 — Playwright e2e
`/voyages` et `/voyages/[slug]`.

### 1.5.9 — Playwright visual
390 px et 1440 px, états vide et rempli.

### 1.5.10 — Playwright a11y
Parcours clavier.

### 1.5.11 — Perf
`getTripFull` en une requête, page < 200 ms sur données seed.

---

## PHASE 1.6 — CLÔTURE (7 sous-tâches)

1.6.1 `tsc` · 1.6.2 `lint` · 1.6.3 `build` · 1.6.4 double rejeu de migration ·
1.6.5 **audit `security/` écrit sur les 9 tables, policy par policy (BLOQUANT)** ·
1.6.6 revue de code et traitement · 1.6.7 `verification-before-completion`,
`MISSION_LOG.md`, rapport final, PR.

## 15.4 Points d'arrêt durs du C1
Noms de `travel_groups` / `user_profiles` divergents · baseline rouge · audit
1.6.5 révélant une faille non corrigeable sans changement de schéma · récursion
RLS non résoluble · impossibilité de garantir `day_index` sans trou.

## 15.5 Risques spécifiques du C1
| Risque | Prob. | Impact | Mitigation |
|---|---|---|---|
| Récursion infinie de policies | Moyenne | Élevé | Helpers `security definer` + test 1.5.5 |
| Fuite de `trip_documents` | Faible | **Critique** | Policy dédiée 1.2.6 + test 1.5.4 + `RLS-BREAKER` |
| `getTripFull` en N requêtes | Élevée | Moyen | Exigence explicite 1.3.5 + test 1.3.12 |
| Types TS désalignés des CHECK SQL | Élevée | Moyen | 1.3.1 + 1.3.2 miroirs, test 1.5.3 |
| 404 vs 403 → fuite d'existence | Moyenne | Moyen | 1.4.6 explicite |

## 15.6 Dette autorisée au C1
`product_id` et `inventory_item_id` sans FK (noms confirmés au C6) ·
`affiliate_link_id` sans FK (table créée au C5) · aucune édition dans l'UI
(c'est le C3).

---

<a name="c2"></a>
# §16. CHANTIER 2 — WIZARD ET MOTEUR DE RÉPARTITION

## 16.1 Identité

| Champ | Valeur |
|---|---|
| **Branche** | `feat/c2-trip-wizard` |
| **Dépend de** | C1 |
| **Bloque** | C3, C6, C8 |
| **Sous-tâches** | 76 |
| **Règle structurante** | **ZÉRO appel LLM** |

## 16.2 Objectif

Transformer une envie (« Pérou, 3 semaines, trek ») en itinéraire structuré et
exploitable, par un moteur entièrement déterministe.

## 16.3 La règle structurante : ZÉRO appel LLM

**Aucun appel LLM dans ce chantier**, malgré l'IA illimitée. `getChatCompletion`
ne doit apparaître nulle part dans le code produit.

**Trois justifications.** Un moteur déterministe est testable, reproductible,
débogable ; un LLM ne l'est pas — on ne pourrait jamais prouver que « 14 jours
sur 3 pays » produit bien 14 jours. Le wizard doit fonctionner sans dépendance
réseau tierce. L'IA arrive au C6 comme couche d'enrichissement **par-dessus** ce
socle.

**Règle d'alerte.** Si tu ressens le besoin d'un LLM pour résoudre un problème de
ce chantier, c'est le signe que le problème est mal posé : arrête-toi et demande.

## 16.4 État vérifié de l'existant — deux corrections importantes

**`/voyage-ia` est une coquille vide.** Vérifié par lecture de
`src/app/voyage-ia/page.tsx` : un input, un `setPhase('interview')`, le texte
« Formulaire à venir », un `getChatCompletion` importé mais jamais appelé, et un
bug de contraste (`text-[#17402C]` sur fond `#17402C`). **Il n'y a rien à
sauver : tu remplaces, tu ne migres aucune logique.**

**`/preparation` monte un vrai `PreparationCockpit`.** Vérifié par lecture de
`src/app/preparation/page.tsx` : il importe `PreparationCockpit` depuis
`@/features/preparation` (participants, poids, audit du sac). **C'EST UN ACTIF.**
Correction du plan initial : tu ne le transformes **pas** en landing, tu ne le
supprimes **pas**. Il devient une brique réutilisée par le kit du voyage au C6.
Ce chantier n'y touche que pour ajouter un lien entrant.

---

## PHASE 2.0 — RECONNAISSANCE (7 sous-tâches)

### 2.0.1 — Chargement
Docs, skills, personas. Relire la dette du C1.

### 2.0.2 — Relecture du schéma C1 **en base**
**Action.** Pas la doc, la base réelle : noms de colonnes, CHECK, valeurs d'enum.
**Pourquoi.** Le wizard doit produire des données valides du premier coup.

### 2.0.3 — **COMPTAGE DES DONNÉES DISPONIBLES — POINT DE RUPTURE**
**Action.** Compter les lignes réelles de `hiking_routes`, des tables de POI et
de refuges (`trail_pois`, etc.), et des guides `/pays`. Ventiler par pays.
**Pourquoi c'est LE risque du projet.** Le moteur ne peut proposer que ce qui
existe. Si les tables sont quasi vides, le wizard produira des itinéraires vides
et sera une démo creuse.
**Livrable.** Tableau chiffré dans `PROGRESS_VOYAGE.md`.
**POINT D'ARRÊT DUR.** Si les tables sont quasi vides → arrêter et arbitrer le
périmètre du seed **avant** de coder. Mieux vaut 3 pays soignés que 5 pays vides.

### 2.0.4 — Lecture de `@/features/preparation`
**Action.** Comprendre le `PreparationCockpit`, repérer ce qui sera réutilisable
au C6. **Ne rien modifier.**

### 2.0.5 — Lecture de `src/features/trips/schemas.ts`
Les schémas du wizard **étendent** les existants, ne les dupliquent pas.

### 2.0.6 — Baseline
### 2.0.7 — Branche `feat/c2-trip-wizard`

---

## PHASE 2.1 — MOTEUR DE RÉPARTITION (17 sous-tâches)

**Emplacement** : `src/features/trips/engine/`.
**Nature** : fonctions **pures**. Aucun accès réseau, aucun accès base. Les
données arrivent en paramètres. C'est ce qui les rend testables à 100 %.
**Sous-agent** : `ENGINE-SMITH`. **Les 7 modules sont indépendants et
parallélisables.**
**TDD strict** : test rouge d'abord, sans exception. C'est de la logique pure, il
n'y a aucune excuse pour ne pas la couvrir intégralement.

### 2.1.1 — `types.ts`
`PlannerInput` (pays ordonnés, dates ou durée, styles, voyageurs, rythme, saison
déduite, données disponibles injectées) et `PlannerOutput` (étapes, jours, items
suggérés, avertissements).

### 2.1.2 — `allocateDays.ts` — répartition
**Algorithme.** Répartition de N jours sur P pays, proportionnelle au poids de
chaque pays (nombre de POI disponibles, superficie, durée conseillée du guide),
avec **plancher de 2 jours par pays** et **arrondi par la méthode du plus grand
reste**.
**Pourquoi le plus grand reste.** `Math.round` naïf perd ou crée des jours : sur
14 jours et 3 pays, trois arrondis indépendants peuvent donner 13 ou 15.
**Invariant testé.** `somme(jours par pays) === durée totale`, **toujours**.

### 2.1.3 — `allocateDays` : cas dégénérés
1 jour et 3 pays (le plancher de 2 est impossible) → avertissement explicite,
pas de crash. 400 jours et 1 pays. 0 pays → erreur claire.

### 2.1.4 — `travelTime.ts` — distance
Distance géodésique par Haversine côté TypeScript (`ST_Distance` côté SQL pour
les requêtes).

### 2.1.5 — `travelTime.ts` — barèmes
Marche 4 km/h · route 45 km/h en montagne, 70 km/h ailleurs · avion si > 700 km
avec forfait de 4 h (transferts, attente, embarquement).

### 2.1.6 — `travelTime.ts` — génération d'items transport
Insertion d'un `trip_item` `kind='transport'` quand le trajet dépasse **90 min**.
**Justification du seuil.** En dessous, le trajet est un détail de la journée ;
au-dessus, il structure la journée et doit être visible dans l'itinéraire.

### 2.1.7 — `paceRules.ts`
Trois rythmes : `chill` (2 activités/jour, 2 h de trajet max), `standard`
(3 activités, 4 h), `intense` (5 activités, 6 h).

### 2.1.8 — `seasonality.ts` — table de règles
**Exigence.** Règles **en données, pas en `if` imbriqués**, pour rester
extensible aux prochains pays sans toucher au code.
**Règles initiales.** Mousson au Népal de juin à septembre · saison sèche au
Pérou de mai à septembre · routes islandaises F fermées d'octobre à mai ·
chaleur marocaine en juillet-août · neige en altitude française de novembre à mai.

### 2.1.9 — `seasonality.ts` — production d'avertissements
**Règle.** Produit des **avertissements**, **ne bloque jamais** la création. Un
utilisateur a le droit d'aller au Népal en juillet ; il a le droit d'être informé.

### 2.1.10 — `selectCandidates.ts` — sélection
Tri par score communautaire quand il existera (C4), sinon par proximité de
l'étape et adéquation au style.

### 2.1.11 — `selectCandidates.ts` — contrainte anti-invention
**Règle absolue.** **Ne renvoie que des références réelles** (`ref_type` +
`ref_id` existants). Si la base est vide pour un pays, renvoie **zéro item et un
avertissement explicite** — jamais de placeholder inventé.
**Justification.** Un itinéraire contenant un refuge inexistant est un risque
physique pour le randonneur, pas seulement un défaut logiciel.

### 2.1.12 — `buildItinerary.ts` — orchestration
Pays → étapes → jours → items.

### 2.1.13 — `buildItinerary.ts` — contraintes de qualité
Jour 1 et dernier jour allégés (arrivée/départ) · pas deux randonnées exigeantes
consécutives · une étape n'est jamais coupée en deux par un changement de pays.

### 2.1.14 — Déterminisme garanti
**Aucun `Math.random`. Aucun `Date.now()` dans les fonctions pures.** Toute
notion de « maintenant » est injectée en paramètre.
**Test.** 100 exécutions avec la même entrée → 100 sorties identiques bit pour bit.

### 2.1.15 — Gestion des voyages sans dates
`start_date` null → planning en jours relatifs J+1, J+2. La saisonnalité utilise
alors un mois indicatif fourni ou est omise avec un avertissement.

### 2.1.16 — Recalcul partiel
Exposer une fonction de recalcul d'un seul jour, pour que le C3 puisse
recalculer les temps de trajet après un déplacement d'item sans tout régénérer.

### 2.1.17 — Test de grep anti-LLM
Test automatisé prouvant que `getChatCompletion` est absent de
`src/features/trips/**`. **Automatisé, pas une vérification visuelle.**

---

## PHASE 2.2 — WIZARD `/voyages/nouveau` (16 sous-tâches)

**Principe d'état.** État en URL (`?step=2`) pour permettre retour arrière,
partage et rechargement sans perte. Brouillon persisté en `localStorage` sous
`lkdv:trip-draft`, **plus insertion en base au statut `draft` dès l'étape 3**.

### 2.2.1 — Layout du wizard
Barre de progression, retour, sortie avec confirmation, zones ≥ 44 px.

### 2.2.2 — Étape 1 : recherche et ajout de pays
Recherche, ajout multiple.

### 2.2.3 — Étape 1 : réordonnancement des pays
**L'ordre définit l'itinéraire.** Boutons monter/descendre, accessibles.

### 2.2.4 — Étape 1 : mise en avant honnête
Les 5 pays seedés sont mis en avant. Les autres sont accessibles **avec un
avertissement honnête** « peu de données disponibles ».
**Justification.** Mieux vaut prévenir que décevoir. Un utilisateur averti qui
obtient peu de contenu n'est pas déçu ; un utilisateur non averti ne revient pas.

### 2.2.5 — Étape 2 : dates ou durée
Soit dates précises, soit durée seule (le C1 autorise `start_date` null).

### 2.2.6 — Étape 2 : avertissements de saisonnalité immédiats
Affichés dès la saisie des dates, pas à la fin.

### 2.2.7 — Étape 2 : validations
`end_date >= start_date`, `duration_days` entre 1 et 400.

### 2.2.8 — Étape 3 : styles et rythme
Multi-sélection de `trip_styles` (trek, roadtrip, ville, plongée, ski, culturel,
gastronomie) + rythme.

### 2.2.9 — Étape 3 : **insertion en base**
**Le voyage est inséré ici**, statut `draft`, pour ne plus rien perdre au-delà de
ce point.
**Justification.** Trois étapes de saisie perdues par un rechargement, c'est un
utilisateur perdu.

### 2.2.10 — Étape 4 : voyageurs
Nombre (1..50).

### 2.2.11 — Étape 4 : rattachement à un groupe
Si l'utilisateur appartient à un `travel_groups`, proposition de rattacher le
voyage (`group_id`).
**Rappel.** C'est au groupe de s'adapter. **On ne crée pas de groupe ici.**

### 2.2.12 — Étape 5 : aperçu avant validation
Appel du moteur, affichage de la répartition par pays, du nombre de jours et des
avertissements. **Deux iss

États autorisés : `⬜ à faire`, `🟨 en cours`, `✅ validé`, `🟥 bloqué`, `⏭️ reporté (dette)`.

Règle de cochage : **une case ne passe à ✅ que si les quatre conditions sont réunies** —
(1) le code existe et est commité ; (2) un test automatisé le couvre et passe ; (3) la sortie
terminale de ce test est collée dans la colonne Preuve ; (4) `tsc`, `lint` et `build` restent
verts après le changement. Trois conditions sur quatre = `🟨`, pas `✅`.

Sections obligatoires du fichier : tableau de bord des 9 chantiers, baseline initiale, tableau
skill/agent (`nom · trouvé · substitution · chargé`), journal de décisions (une ligne par choix
irréversible avec la raison et les alternatives écartées), registre des blocages, registre de
dette assumée (`DETTE-Cn-m` avec impact et échéance), et volumétries de données.

---

# PARTIE XIV — GESTION DES ERREURS, RÉGRESSIONS ET IMPRÉVUS

**Test qui échoue** : premier échec ⇒ relire le test et le code. Deuxième échec ⇒ activer
`systematic-debugging` : formuler 3 hypothèses, les classer, écrire un test qui discrimine, puis
corriger. Interdiction formelle de modifier l'assertion pour obtenir du vert.

**Build cassé** : arrêt immédiat de toute nouvelle écriture, retour au dernier commit vert
(`git stash` si nécessaire), correction isolée, puis reprise. On ne construit jamais sur du rouge.

**Régression détectée** : écrire d'abord un test qui la reproduit, le voir échouer, corriger, le
voir passer, puis le conserver définitivement dans la suite. Consigner l'incident dans PROGRESS
avec l'ID `REG-Cn-m`.

**Migration déjà appliquée en production** : ne jamais éditer une migration passée. Créer une
migration corrective additive, la rendre idempotente, et documenter la raison.

**Schéma réel différent de la roadmap** : la réalité gagne toujours. Mettre à jour la roadmap et
PROGRESS, citer `fichier:ligne`, puis continuer. Ce n'est pas un point d'arrêt.

**Skill ou agent introuvable** : consigner l'absence, choisir la substitution la plus proche,
documenter le choix, continuer. Ne jamais inventer un chemin de fichier.

**Dérive de contexte (au-delà de ~5 fichiers lus)** : relire la source avant chaque écriture SQL
ou TS. Aucune écriture sur mémoire. Cette contre-mesure est permanente.

**Sur-affirmation** : toute affirmation sur l'état du dépôt doit être accompagnée d'une citation
ou d'une sortie terminale. « Je pense que » n'est pas une preuve et n'autorise pas un cochage.

## Points d'arrêt durs (les seuls cas où l'agent s'arrête et demande)

1. La baseline est rouge avant tout travail et la cause dépasse le périmètre du chantier.
2. Une faille RLS est identifiée mais non corrigible sans changement de modèle de données.
3. Une donnée réelle risque d'être détruite (suppression de colonne, migration destructive).
4. Un choix irréversible engage un chantier ultérieur sans que la roadmap le tranche.
5. Le seuil de données de C2 (40 lieux/pays) est inatteignable même après seed.
6. Un secret, une clé d'API ou une donnée personnelle est découvert en clair dans le dépôt.

Dans tous les autres cas : décider, documenter la décision et sa raison, avancer.

---

# PARTIE XV — VALIDATION FINALE COMPLÈTE (APRÈS C8)

**Bloc technique** : `npx tsc --noEmit` = 0 erreur · `npm run lint` = 0 warning ·
`npx next build` vert · `supabase db reset --local` puis `db push` ×2 sans diff · suite complète
de tests verte · e2e Playwright verte à 390 px et 1440 px · snapshots visuels stables ·
0 `any`, 0 `@ts-ignore`, 0 `eslint-disable` non justifié (vérifiés par grep, résultats collés).

**Bloc sécurité** : les 9 tables `trip_*` + `place_*` + `affiliate_*` en RLS active ; matrice
d'attaque complète rejouée (anon, tiers, viewer, editor, membre de groupe, token valide, token
invalide) ; aucune fonction `SECURITY DEFINER` sans `SET search_path` ; documents jamais
exposés en visibilité `link` ; coordonnées de lieux fragiles floutées dans les trois surfaces
(API, RLS, export) ; postback affilié résistant à signature invalide, rejeu et doublon ;
aucun secret dans le dépôt.

**Bloc vie privée / conformité** : hash d'IP salé et rétention des clics ≤ 13 mois effectivement
purgée ; bandeau cookies conforme CNIL ; mention d'affiliation présente au-dessus de chaque bloc
avec `rel="sponsored nofollow"` ; EXIF strippé sur les photos publiées ; aucun contenu personnel
envoyé à l'IA.

**Bloc produit** : le parcours complet est exécutable de bout en bout — créer un voyage
(C2), le réorganiser au doigt et au clavier (C3), y ajouter un lieu communautaire (C4), voir
des liens partenaires conformes (C5), obtenir des suggestions IA qui n'inventent rien (C6),
inviter deux personnes et exporter un PDF plus un pack hors-ligne (C7), publier un carnet et le
voir apparaître sur une page pays indexable (C8) — le tout avec la messagerie unifiée de C0
comme fil unique de discussion.

**Bloc performance** : `getTripFull` < 200 ms sur 14 jours / 60 items ; `/go/[slug]` < 300 ms ;
pages pays LCP < 2,5 s et CLS < 0,1 en mobile émulé ; vues matérialisées et index PostGIS en
place, plans d'exécution vérifiés sur les 5 requêtes les plus chaudes.

**Bloc documentation** : `docs/PROGRESS_VOYAGE.md` avec 612 sous-tâches statuées et prouvées ;
`docs/ROADMAP_VOYAGE.md` à jour de toutes les corrections de réalité ; `MISSION_LOG.md`
renseigné par chantier ; `CLAUDE.md` complété des nouvelles conventions ; registre de dette
vide ou entièrement justifié avec échéances.

**Rapport final exigé** (honnête, sans embellissement) : ce qui est livré et prouvé, ce qui est
livré mais fragile, ce qui n'est pas livré et pourquoi, les dettes assumées avec leur coût
estimé, les décisions irréversibles prises en autonomie, et les trois prochaines actions
recommandées.

---

# ANNEXES

## A. Commandes de référence

```bash
git checkout -b feat/cN-<slug>
supabase migration new <nom>
supabase db reset --local && supabase db push
npx tsc --noEmit
npm run lint
npx next build
npx playwright test
npx playwright test --config=playwright.visual.config.ts
grep -rn "any\|@ts-ignore\|eslint-disable" src/features src/lib src/app


[ ] Plan de la phase écrit avant le code
[ ] Tests écrits avant le code (RED prouvé)
[ ] Code écrit, tests GREEN, sorties collées
[ ] tsc / lint / build verts après changement
[ ] Migration idempotente (double push sans diff)
[ ] Matrice d'attaque RLS rejouée si le schéma a bougé
[ ] Dual-view vérifiée 390 px et 1440 px
[ ] Accessibilité clavier vérifiée si interaction ajoutée
[ ] Revue de code demandée, retours traités, revalidation obtenue
[ ] PROGRESS mis à jour avec preuves, commit et date
[ ] Décisions irréversibles consignées au journal


Le fichier est complet. Enregistre-le sous `docs/ROADMAP_VOYAGE.md` à la racine du dépôt.

Deux remarques honnêtes avant que tu lances l'exécution. D'abord, les taux d'affiliation cités en C5 datent de mai 2026 et bougent souvent : fais-les revérifier par l'agent au moment où il ouvre réellement les comptes, plutôt que de les traiter comme acquis. Ensuite, le risque R1 de C2 reste le plus sérieux du projet — si `hiking_routes` et les tables de lieux sont quasi vides, tout ce qui suit s'appuie sur du vide, et c'est la première chose à mesurer.

Dis-moi si tu veux maintenant le prompt d'exécution autonome d'un chantier précis (C1 est le prochain dans l'ordre) sur le même modèle que celui de C0.