# 🚀 MASTER PROMPT ANTIGRAVITY — LKDV
## RECONSTRUCTION CIBLÉE : `/materiel/depart/...`

**Projet :** Le Kit du Voyageur (LKDV)

**Repository :** https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810

**Zone unique de travail autorisée :**
- `http://localhost:4000/materiel/depart/...`
- route source principale actuelle : `src/app/materiel/depart/page.tsx`
- sous-chemin de cockpit actuellement utilisé : `/materiel/depart/none` et `/materiel/depart/{id}`

**Environnement cible :** Google Antigravity IDE

**Date de référence :** 30 août 2026

**Extension de monitoring optionnelle :** Antigravity Panel par n2ns

---

# 0. MISSION ABSOLUE

Tu es l’agent principal chargé de **reconstruire, refondre et fiabiliser exclusivement l’expérience de la page `/materiel/depart/...` de LKDV**.

Tu ne travailles PAS sur toute l’application.

Tu ne dois PAS refondre les pages suivantes sauf nécessité technique directe et documentée pour que `/materiel/depart/...` fonctionne correctement :

- `/`
- `/materiel`
- `/materiel/forget`
- `/materiel/kits`
- `/materiel/inventaire`
- `/materiel/alertes`
- `/materiel/dispo`
- `/preparer-randonnee`
- `/mes-aventures`
- exploration globale
- autres dashboards
- commerce global
- fonctionnalités non nécessaires au cockpit de départ

Toute modification extérieure à `/materiel/depart/...` doit être :

1. strictement nécessaire ;
2. minimale ;
3. justifiée ;
4. réversible ;
5. documentée dans le journal de travail.

**Objectif : transformer uniquement ce parcours en cockpit matériel de départ ultra-rapide, premium, tactique, mobile-first, robuste et production-ready, sans casser le reste du projet.**

---

# 1. CONTEXTE : RECONSTRUCTION, PAS GREENFIELD

Le dépôt GitHub contient déjà une implémentation et une architecture existantes.

Tu dois donc considérer le code présent comme un **système à auditer, comprendre, améliorer et reconstruire**, jamais comme un simple dossier vide.

Le comportement actuel confirmé du dépôt est notamment le suivant :

- `src/app/materiel/depart/page.tsx` est une page d’index dynamique qui lit `searchParams` (`route` ou `routeId`) et redirige vers `/materiel/depart/none` ou `/materiel/depart/none?route=...`.
- `src/features/materiel/components/depart/LazyExplorerMap.tsx` contient déjà une carte lazy-loadée, avec `touchAction: 'pan-x pan-y pinch-zoom'`, et transmet `disableGeolocate` au composant de carte.
- `src/features/materiel/components/cards/GearCardDepart.tsx` existe déjà et affiche notamment destination, compte à rebours, préparation, poids et entrée dans le cockpit.
- `src/features/materiel/services/getMaterielSummary.ts` existe déjà côté serveur, avec des données telles que `readinessPct`, `status`, `totalWeightKg`, `itemsCount` et un calcul à partir des kits et éléments de matériel.

**Conséquence majeure :** avant de réécrire quoi que ce soit, inspecte exactement les composants réellement utilisés par le cockpit `/materiel/depart/...` et cartographie leurs dépendances.

Ne suppose jamais qu’un composant existe sous un autre nom.

Ne remplace jamais un composant simplement parce qu’une architecture théorique serait différente.

---

# 2. PÉRIMÈTRE EXACT DE LA PAGE

Le périmètre fonctionnel cible est le **parcours de préparation d’un départ matériel**.

La page doit devenir le centre de pilotage du départ choisi.

Elle doit permettre, selon les données déjà présentes dans le repository :

- identifier la randonnée / destination ;
- visualiser l’état de préparation ;
- voir le matériel associé au départ ;
- comprendre immédiatement ce qui est prêt, incomplet ou critique ;
- accéder aux éléments du kit ;
- visualiser le poids ;
- manipuler la carte associée au départ lorsque celle-ci est disponible ;
- naviguer vers les actions utiles sans surcharger l’écran ;
- conserver une utilisation fluide sur iPhone et desktop ;
- rester exploitable avec réseau lent ou partiellement indisponible si les données déjà chargées le permettent.

**Ce prompt n’autorise pas la création d’un nouveau produit parallèle.**

Il impose une reconstruction de l’expérience existante.

---

# 3. CONTRAINTES PRIORITAIRES

En cas de conflit, respecter cet ordre :

1. sécurité et confidentialité ;
2. intégrité des données ;
3. absence de régression ;
4. bon fonctionnement du cockpit de départ ;
5. performance et sensation d’instantanéité ;
6. responsive et compatibilité iPhone ;
7. accessibilité ;
8. architecture maintenable ;
9. esthétique Liquid Glass ;
10. effets visuels.

Aucun effet de verre, animation ou graphique ne justifie une régression de performance, d’accessibilité ou de stabilité.

---

# 4. RÈGLE ABSOLUE : NE JAMAIS HALLUCINER LES SKILLS

Les noms de rôles ci-dessous sont des rôles fonctionnels.

Ils ne signifient pas que ces noms existent réellement dans Antigravity.

Avant toute invocation :

1. inspecte les skills disponibles ;
2. recherche le nom exact ;
3. si absent, sélectionne le skill réel le plus proche ;
4. note la substitution ;
5. n’invente jamais une commande, un agent ou un skill.

Le repository `rmyndharis/antigravity-skills` doit être utilisé comme catalogue réel lorsqu’il est disponible.

---

# 5. INSTALLATION DES SKILLS — TOKEN EFFICIENT

Commence par vérifier l’état de l’environnement.

Utilise en priorité :

```bash
npx @rmyndharis/antigravity-skills list
npx @rmyndharis/antigravity-skills search security
npx @rmyndharis/antigravity-skills search ui
npx @rmyndharis/antigravity-skills search nextjs
npx @rmyndharis/antigravity-skills search performance
npx @rmyndharis/antigravity-skills search testing
npx @rmyndharis/antigravity-skills search mobile
```

Si le CLI `agy` est réellement disponible, la commande expérimentale peut être tentée :

```bash
agy plugin install https://github.com/rmyndharis/antigravity-skills
```

Ne bloque jamais le projet si cette voie échoue.

Utilise la voie `npx`.

---

# 6. SKILLS À CHARGER SELON LA PHASE

## Phase Discovery / Spec

Rechercher en priorité :

- `nextjs-app-router-patterns`
- `typescript-pro`
- `backend-architect` ou équivalent
- `database-architect` si lecture/migration Supabase nécessaire
- `security-auditor`

## Phase UI

Rechercher :

- `ui-ux-designer`
- `ui-visual-validator`
- `react-modernization`
- `component-driven-design` ou équivalent

## Phase performance

Rechercher :

- `application-performance-performance-optimization`
- `performance-engineer` ou équivalent

## Phase tests

Rechercher :

- `e2e-testing-patterns`
- `unit-testing-test-generate`
- `performance-testing-review-ai-review`
- `code-reviewer`

## Phase sécurité

Rechercher lorsque pertinent :

- `security-auditor`
- `frontend-mobile-security-xss-scan`
- `mobile-security-coder`
- `gdpr-data-handling`

**Ne charge que les skills réellement nécessaires à la phase en cours.**

---

# 7. PERSONAS / RÔLES À UTILISER

## `@state-architect`

Mission : architecture de données et état local du cockpit.

Il peut être remplacé par le skill réel d’architecture disponible.

## `@ui-designer`

Mission : UX, responsive, design system, hierarchy, Liquid Glass, mobile-first.

## `@performance-engineer`

Mission : réduire le poids JS, les requêtes, les rerenders, les chargements inutiles et les waterfalls.

## `@security-auditor`

Mission : contrôler les données exposées côté client, les accès, les paramètres de route, les entrées utilisateur, les risques XSS et les fuites.

## `@test-engineer`

Mission : tests unitaires, intégration, responsive, interaction, non-régression et E2E ciblés.

## `@code-reviewer`

Mission : revue finale du diff, simplicité, cohérence et absence d’effet de bord.

---

# 8. WORKFLOW OBLIGATOIRE

Tu dois travailler en gates.

```text
DISCOVERY
   ↓
SPEC
   ↓
STOP + VALIDATION UTILISATEUR
   ↓
BUILD LOT 1
   ↓
STOP + VALIDATION UTILISATEUR
   ↓
BUILD LOT 2
   ↓
STOP + VALIDATION UTILISATEUR
   ↓
TEST
   ↓
SECURITY REVIEW
   ↓
PERFORMANCE REVIEW
   ↓
RESPONSIVE REVIEW
   ↓
FINAL INTEGRATION
```

**Ne saute aucune gate.**

---

# 9. PHASE 1 — DISCOVERY EXHAUSTIVE DU COCKPIT

Avant de coder, inspecte uniquement ce qui est nécessaire à `/materiel/depart/...`.

## 9.1 Fichiers à identifier

Trouve notamment :

- `src/app/materiel/depart/page.tsx`
- tous les segments dynamiques associés à `/materiel/depart`
- composants importés directement ou indirectement
- `LazyExplorerMap`
- `GearCardDepart`
- `CountdownLive`
- `getMaterielSummary`
- `GlassCard`
- `Badge`
- `ProgressBar`
- hooks liés au matériel
- stores liés au matériel
- requêtes Supabase liées au départ
- types du matériel
- composants de checklist
- composants de poids
- composants de carte
- composants mobiles
- composants de navigation affectant la page
- CSS/Tailwind utilisé par la page
- fonctions d’agrégation
- tests déjà présents

---

# 10. DISCOVERY : AUDIT DU ROUTING

Tu dois comprendre précisément :

### `/materiel/depart`

Route index actuellement utilisée comme point d’entrée.

### `/materiel/depart/none`

Route cockpit sans identifiant de départ explicite.

### `/materiel/depart/{id}`

Route cockpit d’un départ réel lorsque l’identifiant existe.

Tu dois déterminer :

- qui choisit l’ID ;
- comment `route` et `routeId` sont transmis ;
- comment les données du départ sont chargées ;
- si `/none` est un état spécial ou simplement un fallback ;
- quelle est la source canonique du kit ;
- quels paramètres sont fiables ou manipulables par l’utilisateur ;
- comment éviter qu’un ID arbitraire permette l’accès à des données d’un autre utilisateur.

---

# 11. DISCOVERY : DONNÉES MATÉRIELLES

Cartographie les données réellement utilisées par le cockpit.

Au minimum, identifie les champs équivalents à :

```ts
id
name
destination
startsAt
readinessPct
status
totalWeightKg
itemsCount
```

et les champs détaillés des équipements :

```ts
itemId
name
weightGrams
category
status
isChecked
isWorn
isConsumable
isVital
quantity
```

Ne crée pas de champ s’il existe déjà sous un autre nom.

Ne duplique pas les types.

---

# 12. DISCOVERY : SOURCE DE VÉRITÉ DU POIDS

La page doit afficher le poids provenant d’une source cohérente.

Établis :

1. la source du poids individuel ;
2. la source du poids total ;
3. le moment du calcul ;
4. la possibilité de double comptage ;
5. la distinction entre poids du matériel, consommables et porté ;
6. la présence éventuelle de poids mis en cache ;
7. la stratégie d’invalidation.

Ne corrige pas arbitrairement les calculs sans démontrer leur incohérence à partir du repository.

---

# 13. DISCOVERY : PRÉPARATION

Le cockpit doit comprendre le sens exact de `readinessPct`.

Dans le code existant, le résumé de matériel calcule une préparation basée sur les éléments cochés du premier kit actif.

Tu dois vérifier :

- si cette logique est réellement la source utilisée par la page ;
- si tous les items importants sont inclus ;
- si les doublons sont possibles ;
- si un kit vide est traité correctement ;
- si `0%`, `40%`, `80%`, `100%` sont les bons seuils produit existants ;
- si le statut `ok/warning/critical` est calculé ailleurs.

Ne change pas les seuils simplement pour une préférence visuelle.

---

# 14. DISCOVERY : CARTE

Le repository possède déjà `LazyExplorerMap`.

Tu dois vérifier :

- source du `trail` ;
- dimensions réelles de la carte ;
- hauteur mobile ;
- hauteur desktop ;
- interaction tactile ;
- pinch zoom ;
- pan ;
- scroll parent ;
- overflow ;
- `touch-action` ;
- événements Leaflet ;
- sélection du tracé ;
- chargement dynamique ;
- délai de rendu ;
- fallback lorsqu’aucune randonnée n’est disponible.

**Ne recrée pas une autre carte si la carte existante peut être réparée et optimisée.**

---

# 15. PROBLÈMES MOBILE À RECHERCHER OBLIGATOIREMENT

La page `/materiel/depart/...` doit être auditée en priorité sur iPhone.

Tester au minimum :

- petit écran iPhone ;
- iPhone standard ;
- grand iPhone ;
- Dynamic Island ;
- encoche ;
- home indicator ;
- portrait ;
- paysage ;
- clavier virtuel si un champ existe ;
- texte agrandi ;
- largeur très étroite ;
- adresse/nom de destination long ;
- plusieurs lignes de contenu ;
- carte tactile ;
- bottom navigation éventuelle ;
- safe areas ;
- débordement vertical ;
- scroll global involontaire ;
- éléments fixes qui masquent le contenu.

---

# 16. RÈGLES SAFE AREA

Tous les conteneurs fixes en haut ou en bas doivent être compatibles avec :

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

Attention :

- ne pas additionner des safe areas plusieurs fois ;
- ne pas créer de vide excessif sur desktop ;
- utiliser les safe areas seulement là où nécessaire.

---

# 17. OBJECTIF UX DU COCKPIT

Le cockpit doit répondre à cette question en moins de quelques secondes :

> « Est-ce que mon départ est prêt et qu’est-ce que je dois faire maintenant ? »

Hiérarchie visuelle obligatoire :

1. destination / départ ;
2. statut global ;
3. progression ;
4. actions prioritaires ;
5. poids ;
6. carte ;
7. détail matériel ;
8. informations secondaires.

Ne transforme pas la page en tableau de bord analytique illisible.

---

# 18. DESIGN SYSTEM — LIQUID GLASS ADAPTÉ À CETTE PAGE

Le Liquid Glass est autorisé sur la préparation et les données de confort.

## Clear Glass

Pour :

- statut ;
- progression ;
- résumé ;
- actions secondaires ;
- cartes matériel non sensibles.

Base de référence :

```css
background: rgba(255,255,255,0.05);
border: 1px solid rgba(255,255,255,0.10);
backdrop-filter: blur(10px);
```

## Frosted Glass

À réserver aux overlays et détails nécessitant plus de séparation visuelle.

```css
background: rgba(0,0,0,0.40);
backdrop-filter: blur(20px);
```

Ne jamais multiplier les surfaces floutées inutilement : le blur est coûteux.

---

# 19. MODE PERFORMANCE / ULTRA-SAVE LOCAL

Le cockpit `/materiel/depart/...` n’a pas vocation à afficher des centaines d’effets.

Prévoir une stratégie de réduction des effets lorsque :

- le téléphone est à faible batterie ;
- l’app est en mode terrain ;
- le support ne gère pas correctement le blur ;
- `prefers-reduced-motion` est actif ;
- l’app est explicitement en mode économie d’énergie.

Quand Ultra-Save est actif :

```css
backdrop-filter: none;
box-shadow: none;
animation: none;
transition: none;
```

Le rendu doit rester parfaitement utilisable.

---

# 20. TYPOGRAPHIE

Priorités :

- destination très lisible ;
- statut immédiatement identifiable ;
- chiffres de poids lisibles ;
- pourcentage de préparation lisible ;
- CTA suffisamment grand ;
- texte secondaire discret mais non illisible.

Éviter :

- trop petits textes ;
- cinq niveaux de gris presque identiques ;
- lignes trop serrées ;
- texte condensé dans les cartes mobiles.

---

# 21. ICÔNES

Les icônes doivent être cohérentes avec l’écosystème existant.

Ne pas multiplier les bibliothèques.

Toutes les actions icon-only doivent avoir un `aria-label`.

Une information critique ne doit jamais être représentée uniquement par une icône ou une couleur.

---

# 22. MOTION

Les transitions doivent être rapides et utiles.

Autorisé :

- apparition légère ;
- changement de statut ;
- progression ;
- ouverture d’un détail ;
- transition de carte.

Interdit :

- animation permanente décorative ;
- rebond long ;
- shimmer lourd en permanence ;
- plusieurs animations concurrentes ;
- animation bloquant l’interaction.

Toujours respecter :

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

# 23. ARCHITECTURE CIBLE DU COCKPIT

Organise le code par responsabilités.

Exemple logique :

```text
src/
  app/materiel/depart/
  features/materiel/
    components/depart/
    components/cards/
    hooks/
    services/
    domain/
    types/
```

Ne pousse pas toute la logique dans `page.tsx`.

La page doit orchestrer.

Les composants doivent présenter.

Les fonctions de domaine doivent calculer.

Les services doivent charger / muter les données.

---

# 24. TYPESCRIPT

TypeScript strict autant que possible.

Éviter :

- `any` ;
- casts massifs ;
- objets anonymes recopiés partout ;
- chaînes magiques ;
- types divergents pour la même entité.

Créer des types partagés lorsqu’une donnée est utilisée dans plusieurs composants.

---

# 25. ÉTAT LOCAL / STORE

Ne crée pas de gigantesque store global pour cette page si l’état est purement local.

À distinguer :

### Données serveur

- départ ;
- items ;
- poids ;
- préparation ;
- carte / randonnée.

### État UI local

- panneau ouvert ;
- filtre ;
- catégorie active ;
- vue compacte ;
- détail sélectionné ;
- animation en cours.

### État persistant pertinent

- préférence d’affichage uniquement si elle a un vrai intérêt produit.

---

# 26. RÈGLE : NE PAS DUPLIQUER LE SERVEUR DANS LE CLIENT

Si une valeur est déjà disponible côté serveur, ne la recalcule pas dans trois composants clients.

Exemple :

`readinessPct` doit venir d’une source cohérente.

Le client peut afficher cette valeur.

Le client ne doit pas produire trois versions divergentes du même pourcentage.

---

# 27. MODÈLE DE DONNÉES DU COCKPIT

La structure finale doit couvrir, selon les données existantes :

```ts
interface DepartCockpitData {
  id: string;
  destination: string;
  startsAt: string;
  readinessPct: number;
  status: 'ok' | 'warning' | 'critical';
  totalWeightKg: number;
  itemsCount: number;
  trail?: TrailReference | null;
  items: GearItem[];
}
```

Ne crée cette interface exactement sous ce nom que si cela correspond à l’architecture retenue.

Elle représente un contrat logique, pas une obligation de nommage.

---

# 28. MODÈLE D’UN ITEM MATÉRIEL

Le contrat logique doit permettre de distinguer au minimum :

```ts
interface GearItem {
  id: string;
  name: string;
  weightGrams: number;
  category: string;
  status: 'to_buy' | 'owned' | 'packed';
  isChecked?: boolean;
  isWorn?: boolean;
  isConsumable?: boolean;
  isVital?: boolean;
}
```

Adapte les valeurs aux enums réellement présents dans le repository.

---

# 29. CALCUL DU POIDS

Quand un poids de base est nécessaire, utiliser une fonction pure.

Logique cible :

```text
BaseWeight = somme(weight)
SI status == packed
ET isConsumable == false
ET isWorn == false
```

Le calcul doit :

- éviter les doubles comptes ;
- gérer `null` / `undefined` ;
- refuser ou normaliser les poids négatifs ;
- être testable sans la UI ;
- être cohérent avec la donnée affichée au serveur.

---

# 30. PRÉPARATION / READINESS

Le score affiché doit représenter la préparation réelle.

Ne jamais utiliser une valeur aléatoire ou cosmétique.

Le calcul cible est conceptuellement :

```text
checkedItems / totalItems * 100
```

Mais **si le repository possède déjà une règle métier plus précise, conserve-la** et documente son fonctionnement.

Toujours borner le rendu :

```text
0 <= readinessPct <= 100
```

---

# 31. STATUT GLOBAL

Le composant doit rendre explicitement les états :

- prêt ;
- à finaliser ;
- incomplet / critique ;
- chargement ;
- erreur ;
- hors-ligne / données obsolètes lorsqu’applicable.

Ne pas afficher “prêt” alors que la donnée réelle est inconnue.

---

# 32. ARCHITECTURE UI RECOMMANDÉE

La page doit privilégier une structure de ce type :

```text
PAGE COCKPIT
│
├── Top / contexte départ
│   ├── destination
│   ├── date / compte à rebours
│   └── statut
│
├── Résumé préparation
│   ├── readiness
│   ├── poids
│   └── items
│
├── Actions prioritaires
│   ├── préparer / reprendre
│   ├── voir matériel
│   └── action contextuelle utile
│
├── Carte départ
│
├── Liste / résumé matériel
│
└── détails secondaires
```

Cette structure est indicative : réutilise les composants existants avant d’en créer de nouveaux.

---

# 33. LOT BUILD 1 — EN-TÊTE + ÉTAT GLOBAL

Après validation de la spec seulement.

Implémenter uniquement :

- shell de page ;
- safe areas ;
- destination ;
- date / compte à rebours existant ;
- badge statut ;
- readiness ;
- poids global ;
- nombre d’items ;
- CTA principal.

### Exigence mobile

Sur iPhone :

- aucune collision Dynamic Island ;
- pas de hauteur fixe fragile ;
- destination longue correctement tronquée ou mise sur deux lignes ;
- CTA toujours accessible ;
- aucun scroll horizontal.

### Gate

Arrête-toi après ce lot.

Présente :

1. fichiers modifiés ;
2. composants créés / réutilisés ;
3. comportement mobile ;
4. tests effectués ;
5. limites restantes.

Attends validation.

---

# 34. LOT BUILD 2 — CARTE

Après validation du Lot 1.

Réutiliser `LazyExplorerMap` lorsque possible.

Objectifs :

- carte immédiatement visible quand les données sont déjà prêtes ;
- lazy-load du moteur lourd ;
- pas de blocage du reste de la page ;
- pan tactile fluide ;
- pinch zoom ;
- pas de scroll parent capturant le geste ;
- aucun `overflow-hidden` qui casse les événements ;
- fallback propre si absence de trail ;
- hauteur adaptée au viewport mobile.

## Performance carte

Ne charge pas plus de données que nécessaire.

La page ne doit pas demander des couches globales lourdes pour un seul départ.

### Gate

Arrête-toi et attends validation.

---

# 35. LOT BUILD 3 — MATÉRIEL / CHECKLIST DU DÉPART

Après validation du Lot 2.

Construire / refactorer :

- liste des items ;
- catégories ;
- statut ;
- progression ;
- poids ;
- distinction packed / owned / to_buy ;
- indication des éléments critiques ;
- feedback d’action.

## UX

L’utilisateur doit comprendre immédiatement :

- ce qui est fait ;
- ce qui manque ;
- ce qui pèse lourd ;
- ce qui est prioritaire.

Ne pas transformer la page en liste de 100 cartes géantes.

Préférer :

- sections ;
- accordéons ;
- résumé sticky lorsque pertinent ;
- virtualisation si la liste est réellement longue.

### Gate

Stop.

---

# 36. LOT BUILD 4 — SHAKEDOWN / OPTIMISATION DU POIDS

Ce lot doit rester **strictement limité au contexte de départ**.

Fonctions possibles selon l’existant :

- total ;
- répartition ;
- items les plus lourds ;
- doublons ;
- vital manquant ;
- alternatives déjà disponibles dans le système.

Ne crée pas un moteur e-commerce complet sur cette page.

Ne transforme pas le cockpit en boutique.

L’upsell doit être secondaire et non bloquant.

### Gate

Stop.

---

# 37. INTERACTIONS

Toute interaction importante doit fournir un feedback immédiat.

Exemples :

- check/uncheck item ;
- ouverture de détail ;
- navigation vers un item ;
- changement de filtre ;
- ouverture de carte ;
- retour ;
- erreur réseau.

Éviter les spinners plein écran.

Privilégier :

- état local optimiste si sûr ;
- revalidation en arrière-plan ;
- skeleton ciblé ;
- feedback inline.

---

# 38. STRATÉGIE DE NAVIGATION RAPIDE

L’objectif est une sensation “instantanée”.

À mettre en place lorsqu compatible avec l’architecture :

- server rendering utile ;
- prefetch des routes probables ;
- cache client pour lecture ;
- éviter waterfalls ;
- charger la carte dynamiquement ;
- charger les composants secondaires à la demande ;
- éviter les fetchs identiques concurrents ;
- ne pas remonter tout l’arbre React lors d’un changement d’item.

---

# 39. PERFORMANCE : AUDIT OBLIGATOIRE

Mesurer au minimum :

- temps avant contenu utile ;
- temps carte ;
- nombre de requêtes ;
- taille des réponses ;
- poids JS initial ;
- rerenders ;
- mémoire si problématique ;
- coût des animations ;
- coût du blur.

Objectif :

> montrer rapidement le contenu essentiel puis enrichir en arrière-plan.

---

# 40. RÈGLE : PAS DE CHARGEMENT GLOBAL INUTILE

La page de départ ne doit pas charger :

- toute la base de matériel ;
- toutes les cartes ;
- toutes les aventures ;
- toutes les alertes globales ;
- tous les produits ;
- tous les participants ;
- toutes les routes géographiques.

Uniquement les données réellement nécessaires au départ.

---

# 41. OFFLINE / RÉSEAU DÉGRADÉ

Cette page n’a pas besoin de transformer l’ensemble de LKDV en application offline complète, mais elle doit se comporter proprement quand le réseau est mauvais.

Lorsque des données déjà chargées sont disponibles :

- les conserver à l’écran ;
- afficher l’état stale si nécessaire ;
- ne pas vider l’écran brutalement ;
- expliquer ce qui n’a pas pu être mis à jour.

Ne jamais présenter de fausses données comme fraîches.

---

# 42. SÉCURITÉ DES ROUTES

Le paramètre de route / query string ne doit jamais être considéré comme une autorisation.

Si le cockpit utilise un identifiant de kit / départ :

1. vérifier que l’utilisateur est authentifié lorsque requis ;
2. utiliser les RLS Supabase ;
3. vérifier que la ressource appartient bien à l’utilisateur ou est partageable selon la règle réelle ;
4. ne jamais faire confiance à un ID fourni par l’URL ;
5. ne jamais exposer de données d’un autre utilisateur.

---

# 43. SÉCURITÉ FRONTEND

Contrôler :

- XSS ;
- HTML injecté ;
- contenu utilisateur ;
- noms de matériel contenant des caractères inattendus ;
- paramètres d’URL ;
- erreurs affichées à l’utilisateur ;
- logs ;
- secrets ;
- données Supabase.

Ne jamais envoyer au client des données serveur inutiles uniquement “au cas où”.

---

# 44. SÉCURITÉ SUPABASE

Si le cockpit accède à Supabase :

- inspecter les requêtes existantes ;
- inspecter RLS ;
- vérifier les filtres `user_id` ;
- vérifier les jointures ;
- limiter les colonnes ;
- éviter `select('*')` si cela expose des données non nécessaires ;
- ne jamais embarquer de service-role key dans le client.

Toute migration doit être documentée et réversible.

---

# 45. ACCESSIBILITÉ

La page doit être utilisable :

- clavier sur desktop ;
- lecteur d’écran pour les actions critiques ;
- contraste suffisant ;
- focus visible ;
- labels ;
- contrôles touch accessibles ;
- aucune dépendance à la couleur seule.

Les statuts doivent être textuels :

- Prêt
- À finaliser
- Critique

et non seulement vert/orange/rouge.

---

# 46. RESPONSIVE — MATRICE OBLIGATOIRE

Tester au minimum :

```text
320 px
375 px
390 px
414 px
430 px
768 px
1024 px
1280 px
1440 px+
```

Tester :

- portrait ;
- paysage ;
- zoom navigateur ;
- texte agrandi ;
- Dynamic Island ;
- home indicator ;
- clavier ;
- très longs noms.

---

# 47. LAYOUT MOBILE

La page ne doit pas dépendre d’un `height: 100vh` fragile.

Préférer les primitives modernes adaptées aux navigateurs mobiles, lorsque compatibles avec le projet :

- `100dvh` ;
- `min-height` ;
- safe areas ;
- flex / grid ;
- contenu intrinsèque.

Éviter les hauteurs codées en dur sauf justification.

---

# 48. CARTE MOBILE

La carte doit :

- occuper réellement l’espace prévu ;
- être manipulable au doigt ;
- ne pas être enfermée dans un conteneur qui casse le geste ;
- ne pas déplacer la page entière lorsque l’utilisateur veut pan/zoom ;
- conserver ses contrôles dans la safe area ;
- rester utilisable lorsque le viewport est petit.

Tester spécifiquement le cas suivant :

> l’utilisateur pose le doigt sur la carte et veut la déplacer sans faire défiler la page.

---

# 49. ÉTATS DE LA PAGE

Chaque bloc critique doit prévoir :

```text
loading
success
empty
error
offline
stale
```

## Loading

Skeleton léger.

## Empty

Message utile et action possible.

## Error

Erreur compréhensible + possibilité de réessayer.

## Offline

Conserver les données disponibles + indicateur clair.

## Stale

Indiquer que les données peuvent être anciennes.

---

# 50. PAS DE FAUX CONTENU

Interdiction de :

- inventer une destination ;
- inventer un poids ;
- inventer un statut ;
- inventer une date ;
- inventer un score ;
- inventer un tracé ;
- inventer une disponibilité matériel.

En absence de données : afficher l’état réel correspondant.

---

# 51. TESTS UNITAIRES

Créer / compléter des tests pour les fonctions pures.

Minimum :

1. somme de poids correcte ;
2. exclusion des consommables ;
3. exclusion du porté ;
4. préparation à 0 % ;
5. préparation à 100 % ;
6. valeur hors plage normalisée ;
7. statut dérivé correctement ;
8. nom vide correctement géré ;
9. poids nul géré ;
10. item manquant géré.

---

# 52. TESTS D’INTÉGRATION

Tester :

- chargement du départ ;
- rendu du statut ;
- rendu du poids ;
- rendu de la progression ;
- présence / absence de la carte ;
- état vide ;
- état erreur ;
- état offline ;
- action sur checklist ;
- mise à jour sans rerender global inutile.

---

# 53. TESTS UI / RESPONSIVE

Tester les scénarios :

### iPhone petit

- aucun débordement ;
- CTA visible ;
- destination lisible ;
- carte manipulable.

### iPhone Dynamic Island

- aucun élément masqué ;
- aucun bouton sous l’île.

### iPhone grand

- aucun gaspillage vertical excessif ;
- bonne densité.

### Desktop

- largeur correctement exploitée ;
- hiérarchie claire ;
- carte lisible ;
- pas de cartes étirées artificiellement.

---

# 54. TESTS SÉCURITÉ

Minimum :

1. utilisateur A ne peut pas lire le départ de B par changement d’ID ;
2. query string invalide n’expose rien ;
3. contenu texte injecté ne produit pas d’exécution HTML/JS ;
4. absence de clé serveur dans le bundle client ;
5. données inutiles non envoyées au client.

---

# 55. TESTS PERFORMANCE

Contrôler :

- temps de rendu initial ;
- carte lazy ;
- absence de requêtes dupliquées ;
- absence de rerender du document complet après modification d’un item ;
- coût des composants animés ;
- coût du blur.

---

# 56. E2E — PARCOURS PRINCIPAL

Construire un E2E du type :

```text
ouvrir /materiel/depart
↓
rediriger vers cockpit
↓
charger le départ
↓
voir la destination
↓
voir la préparation
↓
voir le poids
↓
ouvrir la carte
↓
interagir avec la carte
↓
ouvrir le matériel
↓
modifier un état si prévu
↓
voir la préparation mise à jour
```

Ne pas automatiser un comportement qui n’existe pas dans le produit réel.

---

# 57. ANTI-RÉGRESSION

Avant chaque modification, identifier :

- importeurs ;
- consommateurs ;
- routes dépendantes ;
- types partagés ;
- services partagés ;
- usages de `GearCardDepart` ;
- usages de `getMaterielSummary` ;
- usages de `LazyExplorerMap`.

Une amélioration du cockpit ne doit pas casser la page `/materiel` ou d’autres consommateurs.

---

# 58. GESTION DES COMPOSANTS EXISTANTS

Priorité :

1. réutiliser ;
2. refactorer ;
3. extraire ;
4. remplacer seulement si nécessaire.

Ne crée pas une nouvelle `GlassCard2`, `ProgressBar2`, `DepartCardV2` sans nécessité claire.

---

# 59. GESTION DU CODE LEGACY

Si un composant actuel fonctionne mais est imparfait :

- comprendre son contrat ;
- conserver ses APIs publiques lorsque raisonnable ;
- améliorer son implémentation ;
- ajouter les tests ;
- migrer progressivement.

Éviter les grandes suppressions sans validation.

---

# 60. RÈGLE DE SIMPLICITÉ

Le résultat final doit être plus simple mentalement qu’avant.

L’utilisateur ne doit pas voir :

- 15 métriques ;
- 8 boutons concurrents ;
- 4 cartes empilées pour la même information ;
- des options secondaires avant l’action principale.

Le système peut être complexe derrière l’interface.

L’interface ne doit pas refléter cette complexité brute.

---

# 61. HIÉRARCHIE DU COCKPIT

## Niveau 1 — Maintenant

- départ ;
- statut ;
- action principale.

## Niveau 2 — Préparation

- progression ;
- poids ;
- items manquants.

## Niveau 3 — Contexte

- carte ;
- détails.

## Niveau 4 — Secondaire

- analyse avancée ;
- suggestions ;
- upsell.

---

# 62. RÈGLE POUR LES GRAPHIQUES

Le cockpit n’est pas une page BI.

Les grands graphiques sont interdits s’ils ralentissent ou nuisent à la compréhension.

Pour le poids :

- chiffre principal ;
- répartition simple ;
- éventuellement petite visualisation.

---

# 63. RÈGLE POUR L’UPSELL

Une recommandation boutique ne doit jamais :

- bloquer l’utilisateur ;
- déplacer le CTA principal ;
- surcharger le premier écran ;
- charger toute la boutique.

Elle doit être contextuelle et secondaire.

---

# 64. LOGGING

Les logs de cette page ne doivent pas contenir :

- tokens ;
- secrets ;
- clés Supabase ;
- informations privées inutiles ;
- données excessives issues des requêtes.

Les logs de debug peuvent être activés uniquement de manière contrôlée.

---

# 65. OBSERVABILITÉ

Si l’application possède déjà un outil d’observabilité, réutilise-le.

Surveiller notamment :

- erreur chargement départ ;
- erreur carte ;
- erreur mise à jour checklist ;
- erreurs Supabase ;
- crash mobile ;
- temps de rendu anormal.

Ne pas ajouter un nouveau service externe uniquement pour cette page sans justification.

---

# 66. GIT

Les modifications doivent être petites et cohérentes.

Après chaque lot :

```bash
git diff
```

Puis, selon les scripts du projet :

```bash
npm run lint
npm test
npm run build
```

Adapter si les scripts réels sont différents.

---

# 67. PROTOCOLE ANTI-BUG

Quand un bug apparaît :

1. reproduire ;
2. identifier la couche ;
3. trouver la cause racine ;
4. corriger la cause ;
5. écrire un test ;
6. relancer ;
7. vérifier les effets de bord.

Interdit :

- timeout arbitraire pour masquer un bug ;
- `catch` qui avale l’erreur ;
- suppression du test ;
- désactivation d’une sécurité ;
- code temporaire non signalé.

---

# 68. ADR

Créer un ADR si la reconstruction impose une décision importante sur :

- state management ;
- cache ;
- carte ;
- stratégie de requêtes ;
- Supabase ;
- mobile ;
- offline ;
- sécurité ;
- structure du domaine matériel.

Format :

```md
# ADR-XXXX — Titre

## Contexte

## Problème

## Options

## Décision

## Conséquences

## Migration

## Rollback
```

---

# 69. PHASE SPEC — LIVRABLE OBLIGATOIRE

Tu dois produire avant tout code UI :

## Architecture

- arborescence ciblée ;
- composants existants réutilisés ;
- composants à refactorer ;
- composants à créer ;
- services utilisés ;
- types ;
- source de vérité des données.

## État

- serveur ;
- client ;
- local UI ;
- cache.

## UX

- hiérarchie ;
- layout mobile ;
- layout desktop ;
- carte ;
- erreurs ;
- empty ;
- offline.

## Sécurité

- auth ;
- RLS ;
- paramètres de route ;
- XSS ;
- données client.

## Performance

- lazy ;
- cache ;
- préchargement ;
- requêtes ;
- rerenders.

## Tests

- unitaires ;
- intégration ;
- E2E ;
- responsive ;
- sécurité.

**STOP OBLIGATOIRE.**

Attends le GO utilisateur avant `/build`.

---

# 70. FORMAT DE RÉPONSE APRÈS CHAQUE PHASE

Répondre avec exactement ces sections :

### 1. Ce qui a été inspecté

### 2. Ce qui a été décidé

### 3. Ce qui a été modifié

### 4. Les validations effectuées

### 5. Les risques / points d’attention

### 6. Le point où l’agent s’arrête

Ne jamais prétendre qu’une commande a été exécutée si elle ne l’a pas été.

---

# 71. DÉMARRAGE IMMÉDIAT

Commence maintenant uniquement par :

```text
DISCOVERY → /materiel/depart/... → SPEC → STOP
```

## Étape A — Lire le repository

Inspecte les fichiers réellement utilisés par la page.

## Étape B — Cartographier

Produis la liste exacte :

- route(s) ;
- composants ;
- services ;
- types ;
- data flow ;
- dépendances ;
- tests ;
- points de fragilité.

## Étape C — Audit mobile

Identifie explicitement :

- top bar ;
- bottom bar ;
- safe areas ;
- carte ;
- scroll ;
- overflow ;
- boutons ;
- densité.

## Étape D — Sélection des skills

Ne charge que les skills utiles.

## Étape E — `/spec`

Produis la spécification détaillée de la reconstruction de **cette page uniquement**.

**Ne touche pas à la UI avant validation.**

---

# 72. APRÈS LE GO — ORDRE DES LOTS

Après validation de la spec :

### LOT 1

Shell + top + statut + préparation + poids + CTA.

### LOT 2

Carte + interaction tactile + responsive.

### LOT 3

Matériel + checklist + catégories + poids.

### LOT 4

Shakedown / optimisation locale du départ.

### LOT 5

États erreur/offline + finition mobile + performance.

### LOT 6

Tests + revue sécurité + revue performance + revue UI.

### LOT 7

Build production + final check.

Après chaque lot :

**STOP + validation utilisateur.**

---

# 73. DÉFINITION DU DONE POUR CETTE PAGE

La page `/materiel/depart/...` est DONE uniquement lorsque :

```text
SPEC validée
+ reconstruction réalisée
+ fonctionnalités existantes conservées ou migrées proprement
+ mobile validé
+ iPhone validé
+ carte tactile validée
+ états loading/empty/error/offline couverts
+ sécurité revue
+ performance revue
+ tests verts
+ lint vert
+ build vert
+ aucun effet de bord critique identifié
= DONE
```

---

# 74. INTERDICTIONS FINALES

Tu ne dois pas :

- refaire toute l’application ;
- refondre `/materiel` en entier ;
- créer une nouvelle architecture globale sans nécessité ;
- remplacer Supabase sans raison ;
- remplacer Next.js sans raison ;
- inventer des données ;
- inventer un skill ;
- inventer un agent ;
- supprimer les composants existants sans audit ;
- multiplier les dépendances ;
- charger toute la carte ;
- charger toute la boutique ;
- exposer des données inutiles au client ;
- casser le tactile mobile ;
- faire des animations décoratives lourdes ;
- cacher les erreurs.

---

# 75. OBJECTIF VISUEL FINAL

La page doit donner la sensation :

> **“Je regarde mon départ, je sais immédiatement s’il est prêt, ce qui manque, combien il pèse, et je peux agir sans réfléchir.”**

Le résultat doit être :

- premium ;
- clair ;
- compact ;
- tactile ;
- rapide ;
- haut de gamme ;
- robuste ;
- mobile-first ;
- compatible iPhone ;
- sans surcharge visuelle.

Le Liquid Glass est un langage visuel, pas l’objectif principal.

L’objectif principal est la **qualité opérationnelle du cockpit matériel de départ**.

---

# FIN — INSTRUCTION À L’AGENT

**Travaille exclusivement sur `/materiel/depart/...`.**

**Lis l’existant. Comprends l’existant. Spécifie. Arrête-toi. Attends validation. Puis construis par lots.**

**Commence maintenant par DISCOVERY + SPEC uniquement.**
