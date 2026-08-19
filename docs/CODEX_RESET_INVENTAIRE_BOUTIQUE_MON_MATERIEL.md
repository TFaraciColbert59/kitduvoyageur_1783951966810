# Mission Codex — Suppression complète d’Inventaire, Boutique et Mon Matériel (LKDV)

## 0. Mandat

Tu es l’agent technique principal de LKDV. Ta mission est de **supprimer complètement et proprement les modules Inventaire, Boutique et Mon Matériel** du produit LKDV.

Cette mission est un **reset fonctionnel et technique total** de ces trois domaines. Il ne s’agit pas de les cacher, de les désactiver visuellement, ni de les refondre : ils doivent disparaître du frontend, de la navigation, des routes, des composants, des hooks, des API et des dépendances qui leur sont exclusivement dédiées.

> Le produit doit continuer à compiler, fonctionner et naviguer correctement après la suppression. Aucune page restante ne doit contenir un lien mort vers Inventaire, Boutique ou Mon Matériel.

Les données Supabase existantes ne doivent **pas être supprimées** dans cette mission. Les tables et données liées sont conservées temporairement pour préserver l’historique et permettre une future reconstruction propre. Seul le code et l’expérience produit sont retirés.

---

# 1. Règles d’autonomie absolue

Tu es **100 % autonome**.

- Ne t’arrête pas pour demander une confirmation intermédiaire.
- Analyse l’intégralité du dépôt avant de supprimer quoi que ce soit.
- Construis un plan exhaustif avant toute modification.
- Exécute le plan sous-étape par sous-étape.
- Après chaque sous-étape terminée : exécute les validations, corrige les erreurs, mets à jour le fichier de progression et coche uniquement la sous-étape réellement terminée.
- Utilise tous les outils, skills et agents disponibles de façon proactive : recherche globale du dépôt, Supabase, lint, TypeScript, build, tests, Playwright et captures visuelles.
- Ne supprime pas des composants, routes ou services partagés sans avoir vérifié tous leurs imports/usages dans le dépôt.
- Ne supprime jamais de données Supabase réelles et ne modifie jamais le schéma de production dans cette mission.
- Ne désactive jamais RLS et ne contourne jamais une policy de sécurité.
- Ne laisse aucun import inutilisé, route cassée, lien mort, erreur console ou dépendance orpheline.

---

# 2. Dépôt, branche et livrables

| Élément | Valeur |
|---|---|
| Dépôt | `TFaraciColbert59/kitduvoyageur_1783951966810` |
| Branche de départ | `main` |
| Nouvelle branche | `chore/remove-inventaire-boutique-mon-materiel` |
| Fichier de progression | `docs/PROGRESS-mon-materiel.md` |
| Fichier de spécification | `docs/CODEX_RESET_INVENTAIRE_BOUTIQUE_MON_MATERIEL.md` |
| Fuseau de référence | Europe/Paris |

## Livrables obligatoires

- Inventaire, Boutique et Mon Matériel totalement retirés du frontend LKDV.
- Aucune route accessible ou lien de navigation pointant vers ces modules.
- Composants, hooks, stores, types, routes API et styles exclusivement dédiés supprimés.
- Les briques partagées extraites/conservées seulement si elles sont toujours utilisées ailleurs.
- Dépendances NPM devenues inutiles retirées avec prudence.
- `docs/PROGRESS-mon-materiel.md` tenu à jour après chaque phase.
- `npm run lint`, `npx tsc --noEmit` et `npm run build` verts.
- Tests existants adaptés et nouveaux tests de non-régression de navigation.
- PR ouverte vers `main`, documentée précisément.

---

# 3. Définition stricte du périmètre supprimé

## Modules à supprimer intégralement

1. **Mon Matériel**
   - route `/mon-materiel` ;
   - cockpit, widgets, fullscreen ;
   - gestion de kits, disponibilité, alertes, checklist et préparation liée au matériel ;
   - logique de drag-and-drop, localStorage et persistance associées ;
   - composants et styles exclusivement liés.

2. **Inventaire**
   - routes d’inventaire et de gestion d’équipement ;
   - fiches produit personnelles ;
   - ajout/modification/suppression d’équipement ;
   - prêts, maintenance, images, historique, kits personnels ;
   - hooks, stores, services et endpoints dédiés ;
   - liens depuis les autres pages vers ces expériences.

3. **Boutique**
   - routes boutique, catalogue, panier et checkout liés à l’achat de matériel ;
   - fiches produits marchandes, commandes, suivi de livraison, favoris boutique ;
   - composants, hooks, services, API et états client dédiés ;
   - liens et CTA vers achat/catalogue/panier.

## Important : vérifier avant suppression

Certaines briques peuvent être utilisées en dehors de ces modules. Avant suppression, rechercher systématiquement les imports et appels.

| Élément potentiellement partagé | Décision attendue |
|---|---|
| Navigation / header / footer | Retirer uniquement les liens et badges liés aux modules supprimés ; préserver le reste. |
| Design system / primitives UI | Conserver si utilisé ailleurs. |
| Authentification | Conserver. |
| Composants image génériques | Conserver si utilisé ailleurs. |
| Système de notification / toast | Conserver si utilisé ailleurs. |
| Intégrations paiement | Ne retirer que si elles sont exclusivement utilisées par la Boutique ; documenter toute décision. |
| Supabase client / types génériques | Conserver. |
| Pages de départ, itinéraire, communauté ou IA | Conserver sauf dépendances exclusivement matérielles à retirer/remplacer. |
| Panier global | Supprimer uniquement s’il n’a aucun usage restant ; sinon retirer seulement le flux matériel/boutique. |

## Ce qui doit rester intact

- Toutes les fonctionnalités LKDV hors Inventaire, Boutique et Mon Matériel.
- Comptes, authentification, profils et permissions.
- Toutes les données Supabase existantes.
- Les autres routes, leurs styles et leur navigation.
- Le design system commun lorsqu’il est encore utilisé.

---

# 4. Étape 0 obligatoire — Audit et plan avant toute suppression

Avant d’écrire ou supprimer la moindre ligne de code :

1. Lire entièrement `docs/PROGRESS-mon-materiel.md`.
2. Faire une recherche globale dans le dépôt pour tous les termes, routes et symboles suivants, puis élargir selon les résultats :

```text
mon-materiel
inventaire
inventory
boutique
shop
catalog
cart
checkout
gear
gear_items
kit
custom_kits
loan
loans
order
orders
shop_products
AddEditGearModal
GearDetailDrawer
KitCockpitDrawer
useEquipment
useUserKits
src/lib/cart.ts
```

3. Identifier :
   - toutes les routes ;
   - tous les composants ;
   - tous les hooks ;
   - tous les stores/contextes ;
   - toutes les routes API ;
   - tous les types ;
   - tous les tests ;
   - toutes les migrations qui seraient encore référencées ;
   - toutes les entrées navigation/header/footer/mobile ;
   - tous les liens écrits en dur ;
   - tous les imports de dépendances NPM propres à ces modules.
4. Produire dans `docs/PROGRESS-mon-materiel.md` un inventaire exhaustif, avant toute suppression.
5. Établir un plan complet à sous-étapes cochables.

Créer ou compléter cette section :

```md
# Reset v3 — Suppression Inventaire, Boutique et Mon Matériel

## Inventaire de suppression

| Élément | Type | Usages externes vérifiés | Décision | Justification |
|---|---|---:|---|---|
| ... | route / composant / hook / API / style / dépendance | ... | supprimer / conserver / extraire / remplacer | ... |

## Plan d’exécution

- [ ] Phase 1 — Audit complet et cartographie des dépendances
  - [ ] ...
- [ ] Phase 2 — Retrait des routes et de la navigation
  - [ ] ...
- [ ] Phase 3 — Retrait du code exclusivement dédié
  - [ ] ...
- [ ] Phase 4 — Nettoyage des références, tests et dépendances
  - [ ] ...
- [ ] Phase 5 — Validation exhaustive et PR
  - [ ] ...
```

Ne cocher aucune étape par anticipation.

---

# 5. Protocole de suppression sûr

## Phase 1 — Cartographier et sécuriser

- Réaliser l’inventaire de tout le périmètre.
- Identifier tous les usages externes de chaque fichier avant suppression.
- Pour toute brique partagée, extraire ce qui est générique avant de retirer le code propre aux modules supprimés.
- Vérifier la structure de routing Next.js afin de ne laisser aucun segment, layout, metadata ou import d’erreur.
- Vérifier les redirections existantes.

## Phase 2 — Retirer routes et navigation

Supprimer ou remplacer proprement :

- route `/mon-materiel` ;
- routes inventaire ;
- routes boutique ;
- routes panier/checkout liées au matériel ;
- liens dans header, footer, menu mobile, command palette, raccourcis, breadcrumbs et CTA ;
- badges de quantité panier ou alertes matériel ;
- liens présents dans les pages restantes.

### Comportement des anciennes URLs

Ne pas laisser une page blanche ni une erreur brute.

- Mettre en place une redirection appropriée vers une destination existante et cohérente, ou une page `not-found` propre selon les conventions du projet.
- Le choix doit être documenté dans le fichier de progression.
- Vérifier les URLs avec Playwright et les requêtes directes.

## Phase 3 — Retirer le code exclusif

Supprimer après vérification :

- composants d’inventaire ;
- composants de boutique ;
- composants de Mon Matériel ;
- hooks et services exclusifs ;
- stores et contextes exclusifs ;
- endpoints API exclusifs ;
- types exclusifs ;
- styles exclusifs ;
- assets exclusivement liés si aucun autre usage ;
- tests devenus obsolètes, à remplacer par des tests de non-régression adaptés.

Ne supprimer aucune primitive partagée uniquement parce qu’elle est importée depuis un dossier supprimé. Vérifier son usage réel.

## Phase 4 — Nettoyer les dépendances et configurations

- Chercher les imports morts dans tout le dépôt.
- Retirer les dépendances NPM devenues inutiles **uniquement** après avoir confirmé qu’elles ne sont plus importées nulle part.
- Mettre à jour `package.json` et lockfile via le gestionnaire de paquets déjà utilisé par le dépôt.
- Nettoyer les variables d’environnement exclusivement liées à la boutique, sans supprimer de secrets ni modifier la production si une vérification manque.
- Retirer les entrées sitemap, robots, metadata, analytics events, feature flags, traductions et documentation exclusivement liées si elles existent.
- Vérifier que les types Supabase générés ou manuels ne cassent pas : ne pas supprimer les tables côté Supabase ni les types globaux sans raison. Les laisser est acceptable si leur suppression casse des flux conservés.

---

# 6. Supabase : conservation stricte des données

## Règle fondamentale

Cette mission supprime le **code et l’expérience frontend**. Elle ne supprime pas les données ni tables Supabase.

Ne pas supprimer ou modifier :

- `gear_items` ;
- `gear_images` ;
- `gear_history` ;
- `loans` ;
- `custom_kits` ;
- `custom_kit_items` ;
- `kits` ;
- `kit_items` ;
- `shop_products` ;
- `orders` ;
- `order_items` ;
- `stock_movements` ;
- `occasion_items` ;
- `rental_items` ;
- `listings` ;
- ni toute table commerciale ou inventaire associée.

## Audit Supabase requis

Utiliser le skill Supabase pour :

- identifier les tables réellement sollicitées par le code supprimé ;
- vérifier qu’aucun trigger, edge function, cron, webhook ou vue n’est appelé par une page conservée ;
- documenter ces résultats dans le fichier de progression ;
- ne créer une migration que si une route/API supprimée laisse une dépendance dangereuse prouvée. Sinon, aucune migration.

Les données restent volontairement disponibles pour une future reconstruction ou une migration produit ultérieure.

---

# 7. Qualité du frontend après retrait

Le produit restant doit être propre et cohérent.

## Navigation

- Aucun lien « Mon Matériel », « Inventaire », « Boutique », « Catalogue », « Panier » ou « Checkout » ne doit subsister si lié aux modules supprimés.
- Aucun badge avec quantité d’articles, de commandes ou d’alertes matérielles ne doit apparaître.
- Aucun bouton d’achat matériel, d’ajout panier ou d’ajout équipement ne doit subsister.
- Aucun lien ne doit conduire vers une route retirée.

## États et erreurs

- Aucune page restante ne doit crasher si les données d’inventaire/boutique ne sont plus demandées.
- Supprimer les appels réseau superflus vers les tables de matériel/boutique depuis les composants restants.
- Aucune erreur console causée par un import, hook ou provider supprimé.
- Aucune erreur de build liée à une route/ressource supprimée.

## Visuel

- Retirer seulement les surfaces, fonds, badges et styles propres à ces modules.
- Ne pas dégrader le design global du site.
- Vérifier desktop et mobile sur les principales pages restantes.

---

# 8. Tests et validations obligatoires

## Avant suppression

- Lancer la suite de tests existante pour obtenir une baseline.
- Documenter les tests déjà rouges avant intervention, s’il y en a.

## Après chaque phase majeure

Exécuter :

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Puis exécuter la suite de tests applicable.

## Tests Playwright à ajouter ou adapter

Valider au minimum :

1. L’application charge sans erreur console sur les pages principales conservées.
2. Header, footer et menu mobile ne montrent plus les modules supprimés.
3. Les anciennes URLs `/mon-materiel`, inventaire, boutique, panier et checkout ont le comportement attendu (redirection ou `not-found` selon le choix documenté).
4. Aucun lien dans les pages restantes ne dirige vers les modules supprimés.
5. Aucun appel critique vers API boutique/inventaire ne survient au chargement des pages restantes.
6. Desktop 1920 px et mobile 380 px : navigation restante utilisable.

## Captures obligatoires

Prendre et documenter des captures desktop et mobile :

- page d’accueil ;
- navigation/header ;
- menu mobile ;
- une page métier principale conservée ;
- comportement de chaque ancienne URL supprimée.

Ajouter les chemins des captures et une courte vérification dans `docs/PROGRESS-mon-materiel.md`.

---

# 9. Fichier de progression : format obligatoire

Conserver l’historique existant, puis ajouter une section de reset v3.

Après chaque sous-étape, ajouter :

```md
### Journal des modifications

#### YYYY-MM-DD — HH:MM Europe/Paris — Phase X.Y terminée
- Réalisé :
  - ...
- Fichiers :
  - Créé : `...`
  - Modifié : `...`
  - Supprimé : `...`
- Supabase :
  - Tables auditées : `...`
  - Migration : aucune / `...`
- Validation :
  - `npm run lint` : OK / erreur documentée et corrigée
  - `npx tsc --noEmit` : OK
  - `npm run build` : OK
  - Tests : X/X OK
  - Captures : `...`
- Risques / décisions :
  - ...
- Prochaine étape :
  - ...
```

---

# 10. Stratégie de commits

Créer des commits atomiques et lisibles. Exemple de découpe :

1. `docs: add removal plan for inventory shop and mon materiel`
2. `chore: remove inventory shop and mon materiel navigation`
3. `chore: remove mon materiel route and exclusive components`
4. `chore: remove inventory and shop routes and exclusive code`
5. `chore: clean orphan imports services and dependencies`
6. `test: cover navigation after inventory shop removal`
7. `docs: complete inventory shop and mon materiel reset report`

Adapter les commits si la structure réelle du projet le nécessite.

---

# 11. Pull request finale

Créer une PR de `chore/remove-inventaire-boutique-mon-materiel` vers `main`.

La description doit contenir :

- le périmètre supprimé ;
- les routes supprimées ou redirigées ;
- les composants/hooks/services/API retirés ;
- les composants partagés conservés/extraits ;
- confirmation explicite que les données Supabase n’ont pas été supprimées ;
- dépendances retirées ;
- résultats lint / TypeScript / build / Playwright ;
- captures réalisées ;
- risques, limites et éléments volontairement conservés pour une future reconstruction.

---

# 12. Définition de terminé

La mission est terminée uniquement si :

- Inventaire, Boutique et Mon Matériel sont totalement retirés du frontend ;
- leurs routes ne sont plus accessibles comme fonctionnalités actives ;
- la navigation ne contient aucun lien ni badge associé ;
- il n’existe aucun lien mort vers ces modules ;
- aucun import, composant, hook, API ou dépendance exclusivement dédié ne subsiste ;
- les données et tables Supabase ont été conservées intactes ;
- l’application restante fonctionne sans régression visible ;
- `npm run lint`, `npx tsc --noEmit` et `npm run build` sont verts ;
- les tests et captures demandés sont réalisés ;
- le fichier de progression est complet et à jour ;
- une PR claire est ouverte vers `main`.
