# Mission Codex — Mise à jour et nettoyage non destructif d’Inventaire, Boutique et Mon Matériel (LKDV)

> **Date de cadrage : mercredi 19 août 2026, 12:20 — Europe/Paris**

## 0. Changement de décision — règle absolue

La décision précédente de suppression est annulée.

Tu ne dois **supprimer aucun module fonctionnel** parmi :

- **Mon Matériel** ;
- **Inventaire** ;
- **Boutique** ;
- leurs routes, leurs pages, leurs composants, leurs hooks, leurs services, leurs API, leurs tables Supabase ou leurs données.

La mission est désormais une **mise à jour, une consolidation et un nettoyage non destructif**.

> Conserver les fonctionnalités existantes, éliminer la dette technique, les doublons, les incohérences visuelles et les comportements fragiles, puis moderniser l’expérience sans casser les parcours utilisateurs actuels.

Toute suppression de fichier, de route, de composant ou de code est interdite par défaut. Si un élément semble obsolète, dupliqué ou inutilisé :

1. le documenter ;
2. vérifier ses imports, appels, routes et usages réels dans l’ensemble du dépôt ;
3. le conserver ou le déplacer/encapsuler de manière rétrocompatible ;
4. ne le supprimer que si une consigne explicite ultérieure l’autorise.

---

# 1. Mission produit

Rénover les domaines **Mon Matériel**, **Inventaire** et **Boutique** pour qu’ils soient :

- cohérents entre eux ;
- visuellement homogènes ;
- techniquement maintenables ;
- robustes face aux données incomplètes ;
- accessibles ;
- simples à comprendre ;
- connectés sans doublons aux sources Supabase existantes.

L’utilisateur doit pouvoir suivre un parcours clair :

```text
Catalogue / Boutique → Panier / Commande → Réception → Inventaire → Kit → Départ → Disponibilité / prêt / entretien
```

Ce parcours doit s’appuyer sur les données réelles quand elles existent. Il ne faut jamais présenter des données mock comme des données personnelles réelles.

---

# 2. Autonomie complète de Codex

Tu es un agent de développement **100 % autonome**.

- Ne demande pas de validation intermédiaire.
- Commence par analyser le dépôt, le schéma Supabase et la documentation existante.
- Construis un plan complet, avec phases et sous-étapes, avant de modifier le code.
- Réalise les tâches dans l’ordre le plus sûr.
- Après chaque sous-étape réellement terminée : teste, corrige, documente et coche la sous-étape.
- Utilise tous les skills, outils et agents disponibles de manière proactive : recherche de code, audit Supabase, migrations seulement si indispensables, lint, TypeScript, build, tests, Playwright et captures visuelles.
- Ne désactive jamais RLS et ne contourne jamais une policy de sécurité.
- Ne supprime jamais de données Supabase.
- Ne supprime jamais un fichier, une route ou une dépendance dans cette mission.
- N’écrase pas une fonctionnalité existante sans conserver son comportement à travers une couche de compatibilité ou une migration progressive.
- Préfère extraire, centraliser, déprécier et rediriger les usages internes plutôt que supprimer.

---

# 3. Dépôt, branche et fichiers de pilotage

| Élément | Valeur |
|---|---|
| Dépôt | `TFaraciColbert59/kitduvoyageur_1783951966810` |
| Branche de départ | `main` |
| Branche de travail | `feat/mon-materiel-inventaire-boutique-cleanup-v3` |
| Page principale | `src/app/mon-materiel/page.tsx` |
| Fichier de progression | `docs/PROGRESS-mon-materiel.md` |
| Présente spécification | `docs/CODEX_RESET_INVENTAIRE_BOUTIQUE_MON_MATERIEL.md` |
| Projet Supabase attendu | `lekitduvoyageur2` |
| Région attendue | `eu-west-3` |
| Fuseau horaire de référence | Europe/Paris |

## Livrables

- Inventaire, Boutique et Mon Matériel conservés et modernisés.
- Architecture assainie sans suppression destructive.
- Sources de données et règles métier centralisées.
- Expérience visuelle cohérente sur les trois modules.
- Tous les parcours existants conservés ou améliorés.
- Tests et captures visuelles ajoutés ou mis à jour.
- Fichier de progression rigoureusement tenu à jour.
- Commits clairs et pull request vers `main`.

---

# 4. Principe de non-régression et nettoyage sans suppression

## Interdictions

Ne pas :

- supprimer `/mon-materiel` ;
- supprimer les routes Inventaire, Boutique, Panier ou Checkout ;
- supprimer les composants métier existants ;
- supprimer les hooks existants ;
- supprimer les endpoints API ;
- supprimer les tables, policies, triggers, données ou buckets Supabase ;
- supprimer les dépendances NPM ;
- supprimer les assets ;
- casser les URLs publiques ou internes ;
- supprimer les tests existants.

## Nettoyage autorisé et attendu

Tu peux et dois :

- déplacer du code vers une architecture plus claire ;
- créer des wrappers rétrocompatibles ;
- marquer un composant ou hook comme déprécié dans son commentaire ;
- remplacer ses usages internes progressivement ;
- fusionner la logique dans une source de vérité unique ;
- retirer les imports inutilisés **à l’intérieur d’un fichier conservé** ;
- corriger les types, les erreurs lint, les états de chargement et les erreurs utilisateur ;
- normaliser noms, types et conventions ;
- améliorer les performances sans modifier le résultat fonctionnel ;
- améliorer l’accessibilité ;
- améliorer les tests ;
- ajouter des migrations uniquement si une donnée structurante manque réellement et si la migration est additive, réversible et sécurisée.

## Inventaire des éléments “à nettoyer”

Avant toute modification, produire une cartographie dans `docs/PROGRESS-mon-materiel.md` :

```md
## Audit v3 — Inventaire / Boutique / Mon Matériel

| Élément | Type | Usages externes vérifiés | Problème observé | Décision non destructive | Risque |
|---|---|---:|---|---|---|
| ... | route / composant / hook / API / table / style | ... | duplication / dette / incohérence / bug | conserver + extraire / adapter / déprécier / encapsuler | ... |
```

---

# 5. Fichier de progression — protocole obligatoire

Conserver l’intégralité de l’historique actuel dans `docs/PROGRESS-mon-materiel.md`.

Ajouter une nouvelle section :

```md
# Mise à jour v3 — Inventaire, Boutique et Mon Matériel
```

Puis écrire un plan complet avant de coder :

```md
## Plan d’exécution

- [ ] Phase 0 — Audit du code, des routes, de la navigation et de Supabase
  - [ ] Lire intégralement le fichier de progression existant
  - [ ] Répertorier les routes et parcours existants
  - [ ] Auditer les tables et policies Supabase concernées
  - [ ] Identifier le code dupliqué ou fragile sans le supprimer
- [ ] Phase 1 — Architecture et compatibilité
  - [ ] Définir les sources de vérité métier
  - [ ] Créer les adaptateurs rétrocompatibles nécessaires
  - [ ] Centraliser les types et états partagés
- [ ] Phase 2 — Nettoyage technique de Mon Matériel
  - [ ] ...
- [ ] Phase 3 — Nettoyage technique de l’Inventaire
  - [ ] ...
- [ ] Phase 4 — Nettoyage technique de la Boutique
  - [ ] ...
- [ ] Phase 5 — Cohérence des flux inter-modules
  - [ ] ...
- [ ] Phase 6 — Passe visuelle et accessibilité
  - [ ] ...
- [ ] Phase 7 — Tests, captures, documentation et PR
  - [ ] ...
```

Après chaque sous-étape terminée, ajouter :

```md
### Journal des modifications

#### YYYY-MM-DD — HH:MM Europe/Paris — Phase X.Y terminée
- Réalisé :
  - ...
- Fichiers :
  - Créé : `...`
  - Modifié : `...`
  - Conservé / déprécié : `...`
- Données :
  - Tables consultées : `...`
  - Migration additive : aucune / `...`
- Validation :
  - `npm run lint` : OK
  - `npx tsc --noEmit` : OK
  - `npm run build` : OK
  - Tests : X/X OK
  - Captures : `...`
- Décisions / risques :
  - ...
- Prochaine étape :
  - ...
```

---

# 6. Audit Supabase obligatoire avant toute implémentation

Utiliser le skill Supabase. Ne pas supposer les colonnes, contraintes ou RLS.

## Tables prioritaires

| Table | Rôle attendu |
|---|---|
| `gear_items` | inventaire personnel |
| `gear_images` | photos de matériel |
| `gear_history` | historique de vie, entretien, événements |
| `loans` | prêts et retours |
| `custom_kits` | kits personnels |
| `custom_kit_items` | contenu des kits personnels |
| `kits` | kits catalogue/modèles |
| `kit_items` | contenu des kits catalogue |
| `shop_products` | catalogue Boutique |
| `orders` | commandes |
| `order_items` | lignes de commande |
| `stock_movements` | mouvements et traçabilité |
| `occasion_items` | matériel d’occasion |
| `rental_items` | location |
| `listings` | annonces |
| `configurator_sessions` | sessions configurateur |
| `kit_reports` | rapports liés aux kits |
| tables de départ/randonnée | à identifier par analyse du dépôt |

## Vérifications impératives

Pour chaque table réellement touchée :

- colonnes et types exacts ;
- clés et relations ;
- index ;
- contraintes ;
- policies RLS ;
- triggers et fonctions ;
- usages frontend existants ;
- cas de données vides ;
- comportement multi-utilisateur.

Documenter les résultats dans le fichier de progression. Ne modifier le schéma que de manière additive et seulement si aucune structure existante ne permet de résoudre proprement le besoin.

---

# 7. Architecture cible : consolidation non destructive

Ne pas réécrire brutalement toute l’application. Extraire et centraliser progressivement les responsabilités métier dans une couche partagée.

Structure indicative, à adapter aux conventions réelles :

```text
src/
  features/
    equipment/
      domain/
        gear-status.ts
        gear-availability.ts
        gear-alerts.ts
        gear-history.ts
      hooks/
        useEquipmentData.ts
        useGearStatuses.ts
      components/
        GearStatusStack.tsx
        GearCard.tsx

    kits/
      domain/
        kit-completeness.ts
        kit-availability.ts
      hooks/
        useKitsData.ts

    commerce/
      domain/
        order-lifecycle.ts
        product-compatibility.ts
      hooks/
        useCatalogData.ts
        useOrdersData.ts

    mon-materiel/
      components/
      fullscreen/
      hooks/
```

Cette structure est indicative. Le but est :

- une seule logique de statuts ;
- des appels Supabase regroupés ;
- des types partagés ;
- des composants réutilisables ;
- une compatibilité avec les exports et hooks existants.

## Compatibilité obligatoire

Si tu crées un nouveau hook ou service :

- conserve les anciens hooks/fichiers ;
- transforme-les si nécessaire en adaptateurs vers la nouvelle couche ;
- préserve leur signature publique autant que possible ;
- ajoute un commentaire de dépréciation si pertinent ;
- migre les usages internes progressivement.

---

# 8. Source de vérité : statuts cumulables du matériel

Un équipement peut être en même temps :

- possédé ;
- neuf, bon état, usé ou à remplacer ;
- entretenu ou à réviser ;
- valide, bientôt périmé ou périmé ;
- disponible, prêté, emprunté, réservé, engagé dans un kit ou perdu ;
- lié à plusieurs kits ou départs ;
- favori ;
- en vente ou en location ;
- en commande ou reçu.

Créer, ou consolider si elle existe déjà, une fonction pure et testable du type :

```ts
getGearStatus(gear, context): GearStatus
```

Exemple de contrat :

```ts
type GearStatus = {
  ownership: "owned" | "ordered" | "wanted" | "not_owned";
  condition: "new" | "good" | "worn" | "maintenance_due" | "replace";
  validity: "valid" | "expiring" | "expired";
  availability: "available" | "loaned_out" | "borrowed" | "reserved" | "lost";
  assignments: {
    kitIds: string[];
    departureIds: string[];
  };
  alerts: GearAlert[];
  badges: GearBadge[];
  primaryAction: GearAction;
};
```

Adapter ce type au schéma et aux types existants, sans casser les usages.

## Règles UI

- Les statuts sont cumulés, jamais écrasés par un statut unique.
- Les badges suivent un ordre de gravité cohérent.
- Chaque badge a un texte, une icône et une couleur ; la couleur n’est jamais le seul signal.
- Toutes les pages utilisant un équipement doivent exploiter la même logique.

---

# 9. Flux inter-modules à fiabiliser sans retirer l’existant

## Boutique → Panier → Commande → Inventaire

Conserver les flux existants, puis les fiabiliser.

Pour un produit non possédé :

1. ajout au panier via la logique existante ;
2. mémorisation de la destination si disponible (kit, checklist ou départ) ;
3. affichage comme “En commande” lorsque les données de commande existent ;
4. confirmation de réception par l’utilisateur ou statut fiable de livraison ;
5. création/mise à jour de l’équipement dans `gear_items` si le flux actuel le supporte ;
6. rattachement au kit ou départ cible si l’intention a été mémorisée ;
7. écriture dans `gear_history` si ce journal est réellement employé par le modèle existant.

Ne pas inventer une automatisation impossible avec le schéma réel. Si l’intention de destination manque, ajouter une structure **additive** et documentée seulement après audit.

## Inventaire → Kits → Départs

- Les kits doivent refléter la disponibilité réelle des objets.
- Les objets prêtés, périmés, perdus ou déjà réservés doivent être clairement signalés.
- Les départs doivent identifier les blocages matériels sans dupliquer les calculs à plusieurs endroits.
- Toute résolution doit proposer une action réaliste : utiliser un substitut, récupérer un prêt, remplacer, ajouter au panier, ou modifier le kit.

## Prêts et disponibilité

- Conserver les données de `loans` et les parcours actuels.
- Calculer les retards, conflits et disponibilités via une logique partagée.
- Ne jamais rendre automatiquement un prêt sans action utilisateur ou donnée de retour fiable.

---

# 10. Mise à jour de Mon Matériel

Conserver la route et les capacités existantes. Mettre à jour l’expérience en évitant les régressions.

## Cockpit principal

- Conserver les six domaines métier :
  1. À ne pas oublier
  2. Alertes & fiabilité
  3. Mes kits
  4. Prochain départ
  5. Inventaire & catalogue
  6. Disponibilité
- Conserver les actions et les chemins utilisateur existants.
- Assainir les composants pour réduire les duplications.
- Mettre à jour les cards pour qu’elles affichent des valeurs réelles ou des états vides explicites.

## Disposition visuelle

Desktop :

```text
3 cards en haut
3 cards en bas
Grille régulière 3 × 2
```

- mêmes gabarits de cards ;
- espacement régulier ;
- comportement mobile adapté, sans forcer trois colonnes ;
- conserver le drag-and-drop seulement s’il fonctionne déjà, s’il est accessible et s’il apporte de la valeur ;
- si le drag-and-drop est conservé, préserver la persistance existante et la compatibilité avec les utilisateurs actuels.

## Fullscreen

Conserver les fullscreen existants et leurs liens. Les restructurer de façon modulaire si nécessaire, sans casser :

- l’ouverture depuis une card ;
- la fermeture `Escape` ;
- le focus trap ;
- le retour de focus ;
- l’absence de scroll du fond ;
- les animations et préférences `prefers-reduced-motion`.

Chaque fullscreen doit pouvoir afficher :

- chargement ;
- erreur ;
- état vide ;
- données réelles ;
- actions directes contextualisées.

---

# 11. Mise à jour de l’Inventaire

Conserver toutes les pages, fiches, modales et parcours existants.

## Objectifs de nettoyage

- unifier l’affichage des badges de statut ;
- réutiliser une card équipement commune partout où possible ;
- centraliser les calculs de poids, disponibilité, péremption et entretien ;
- éviter les requêtes Supabase répétées ou contradictoires ;
- traiter correctement images absentes, poids inconnus, dates absentes, objets sans catégorie et inventaire vide ;
- conserver les formulaires d’ajout/modification avec validations claires ;
- conserver les flux de prêt, maintenance, historique et kits.

## Recherche, filtres et tri

Ne pas retirer les capacités existantes. Fiabiliser :

- recherche par nom, marque, catégorie, tag et kit ;
- filtres par état, disponibilité, favori et usage ;
- tri par récent, poids, fréquence, urgence ;
- annulation/réinitialisation claire ;
- synchronisation d’URL uniquement si déjà utilisée ou ajoutée de manière non disruptive.

## Fiche équipement

Améliorer sans supprimer les fonctionnalités actuelles :

- images ;
- informations techniques ;
- statuts cumulés ;
- historique ;
- prêts ;
- entretien ;
- kits associés ;
- provenance et commande si disponible ;
- actions contextuelles.

---

# 12. Mise à jour de la Boutique

Conserver routes, catalogue, panier, commandes et checkout existants.

## Objectifs de nettoyage

- réutiliser les types produit et composants partagés lorsque cela ne casse pas les parcours ;
- normaliser disponibilité, stock, prix, poids, catégorie et marque depuis `shop_products` ;
- rendre les erreurs panier/checkout explicites ;
- ne pas dupliquer localStorage et Supabase si un mécanisme de synchronisation existe déjà ;
- préserver les comportements d’achat actuels ;
- améliorer les états de chargement, vide, indisponible et rupture de stock.

## Compatibilité équipement

Lorsqu’un utilisateur consulte un produit :

- signaler de façon non bloquante s’il possède un équivalent fonctionnel ;
- proposer d’ouvrir l’objet existant ou de poursuivre l’achat ;
- ne jamais empêcher l’achat sur une supposition ;
- afficher le contexte kit/départ seulement si la donnée est réellement disponible.

## Commandes

- Conserver les pages et modèles existants.
- Clarifier les statuts : commandé, expédié, livré, réception à confirmer.
- Centraliser ces statuts dans une couche de domaine ou adaptateur, sans casser les API actuelles.
- Conserver toute traçabilité existante (`orders`, `order_items`, `stock_movements`).

---

# 13. Direction visuelle — liquid glass clair, fond animé vert

## Intention

L’interface doit devenir plus claire, apaisante et premium, sans perdre la teinte nature/verte de LKDV :

> Un cockpit outdoor lumineux, lisible et calme, posé sur un paysage naturel vivant.

## Fond vidéo animé

Une vidéo de référence a été transmise par l’utilisateur. Utiliser cet asset seulement s’il est présent dans le dépôt ou fourni dans l’environnement de travail.

Ne pas télécharger un nouvel asset externe sans instruction explicite.

Comportement :

```html
<video autoplay muted loop playsinline preload="metadata">
```

Exigences :

- arrière-plan plein écran ;
- `object-cover` ;
- sans interaction ;
- poster/fallback si la vidéo est indisponible ;
- `prefers-reduced-motion` : image fixe ou première frame ;
- overlay vert clair pour préserver la lisibilité ;
- performance mobile surveillée.

## Liquid glass

Faire évoluer les surfaces sans casser le design system global :

- surfaces très claires et légèrement chaudes ;
- transparence de l’ordre de `bg-white/70` à `bg-white/80` ;
- flou fort mais maîtrisé ;
- bordure blanche subtile ;
- ombre douce ;
- teinte verte douce en halo ou en accent ;
- fond vidéo perceptible mais jamais gênant ;
- contraste WCAG AA maintenu.

Tokens indicatifs à centraliser si le projet le permet :

```css
--mm-ink: #1C2620;
--mm-forest: #2D5A3D;
--mm-forest-soft: #E6F0E7;
--mm-paper: #F5F3EE;
--mm-amber: #8C6A1A;
--mm-danger: #9B2C2C;
--mm-glass: rgba(255, 255, 255, 0.76);
--mm-glass-border: rgba(255, 255, 255, 0.82);
```

Ne pas imposer ces tokens si un système équivalent existe déjà : préférer l’extension cohérente des tokens en place.

## Accessibilité

- jamais une information portée uniquement par une couleur ;
- icône + texte + couleur pour les statuts ;
- focus visible ;
- navigation clavier ;
- cibles tactiles d’au moins 44 px ;
- aucun emoji dans l’UI ;
- `Escape` ferme les overlays ;
- focus trap et retour de focus dans les fullscreen ;
- contraste WCAG AA minimum.

---

# 14. Tests et qualité obligatoires

## Baseline avant modifications

Avant toute évolution :

1. exécuter les tests existants ;
2. relever les échecs préexistants ;
3. documenter cette baseline dans le fichier de progression.

## Après chaque phase majeure

Exécuter :

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Puis lancer les tests applicables.

## Tests fonctionnels à préserver ou ajouter

- affichage d’un équipement avec statuts cumulés ;
- inventaire vide et inventaire renseigné ;
- ajout/modification d’un équipement ;
- affichage d’une fiche équipement ;
- prêt et retour ;
- kit complet/incomplet ;
- objet indisponible dans un départ ;
- catalogue et fiche produit ;
- ajout panier ;
- commande et réception si le flux existe ;
- navigation de Mon Matériel ;
- ouverture/fermeture des six fullscreen ;
- chargement, erreur et états vides.

## Playwright et captures visuelles

Ajouter ou adapter les tests Playwright pour couvrir :

- Mon Matériel desktop 1920 et mobile 380 ;
- cockpit grille 3 × 2 en desktop ;
- chacun des six fullscreen ;
- Inventaire ;
- Boutique ;
- panier et commande si les tests existants possèdent un environnement sûr ;
- menu mobile ;
- navigation clavier ;
- absence d’erreurs console ;
- `prefers-reduced-motion`.

Captures obligatoires documentées dans le fichier de progression :

| Écran | Desktop 1920 | Mobile 380 |
|---|---:|---:|
| Mon Matériel — cockpit | obligatoire | obligatoire |
| Les 6 fullscreen | obligatoire | obligatoire |
| Inventaire | obligatoire | obligatoire |
| Boutique | obligatoire | obligatoire |
| Panier / commande si testable | obligatoire | obligatoire |

---

# 15. Commits et pull request

## Commits

Créer des commits atomiques, sans suppression destructive. Exemple :

1. `docs: add non-destructive cleanup plan for equipment commerce`
2. `refactor: centralize equipment status and availability logic`
3. `refactor: consolidate inventory data hooks with compatibility adapters`
4. `refactor: consolidate shop order and product states`
5. `feat: refresh mon materiel cockpit and fullscreen experience`
6. `style: apply accessible light liquid glass system`
7. `test: expand equipment inventory and commerce coverage`
8. `docs: complete cleanup progress report`

## Pull request

Ouvrir une PR vers `main` avec :

- les modules conservés ;
- les fichiers et couches de compatibilité ajoutés ;
- les doublons/dettes nettoyés ;
- les tables Supabase auditées ;
- les migrations additives éventuelles ;
- les parcours protégés contre régression ;
- les résultats lint, TypeScript, build et Playwright ;
- les captures ;
- les risques restants et les éléments marqués dépréciés, sans suppression.

---

# 16. Définition de terminé

La mission est terminée uniquement quand :

- Inventaire, Boutique et Mon Matériel sont tous conservés et accessibles ;
- aucune route, donnée, table, composant métier, hook, API ou dépendance n’a été supprimé ;
- la dette technique identifiée est documentée et nettoyée de manière non destructive ;
- les règles de statut et disponibilité sont centralisées ou clairement encapsulées ;
- les parcours Boutique → Commande → Inventaire → Kit → Départ sont cohérents et non régressifs ;
- Mon Matériel est visuellement plus clair, avec une grille 3 × 2 desktop et une teinte verte cohérente ;
- les fullscreen existants restent fonctionnels, accessibles et riches en états réels ;
- les données Supabase sont utilisées correctement et sans contournement de RLS ;
- les tests, lint, TypeScript et build sont verts ;
- les captures desktop/mobile sont vérifiées ;
- `docs/PROGRESS-mon-materiel.md` est complet et à jour après chaque phase ;
- une PR documentée est ouverte vers `main`.
