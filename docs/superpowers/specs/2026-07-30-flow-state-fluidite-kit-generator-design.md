# Design: Flow State Fluidité & Kit Generator (Chantiers 9 & 10)

**Date:** 2026-07-30
**Stack:** Next.js 15 (App Router) / React 19 / TypeScript strict / Tailwind CSS / Framer Motion 12 / Supabase (PostgreSQL + PostGIS)
**Cible:** Application Mobile LKDV (Le Kit du Voyageur)

---

## 1. Architecture Globale d'Animation (Chantier 9)

Un système d'animation et de gestion gestuelle unifié, basé sur **Framer Motion**, est intégré pour apporter une fluidité homogène "Instagram-like" à l'ensemble de l'expérience mobile.

### Animation Tokens (Centraux)
Les configurations physiques des ressorts (spring) et les transitions standardisées sont définies dans un fichier de constantes partagées pour assurer la cohérence de l'UI.

```typescript
// src/lib/animations/constants.ts
export const springConfigs = {
  smooth: { type: "spring", stiffness: 300, damping: 30 },
  snappy: { type: "spring", stiffness: 400, damping: 25 },
  gentle: { type: "spring", stiffness: 200, damping: 35 }
};

export const pageTransitions = {
  slideUp: {
    initial: { y: 30, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -30, opacity: 0 }
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideRight: {
    initial: { x: -30, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 30, opacity: 0 }
  }
};
```

### Composants d'Animation Réutilisables

1. **`AnimatedPage`** : Enveloppe de niveau page mobile qui applique automatiquement les transitions d'entrée/sortie et gère la navigation gestuelle par swipe arrière (back gesture).
2. **`ScrollReveal`** : Utilise l'Intersection Observer (via `useInView` de Framer Motion) pour animer l'apparition des éléments lors du défilement.
3. **`GestureCard`** : Fournit un support pour le drag-to-delete/action ainsi que des animations dynamiques de pression avec feedback haptique.
4. **`LoadingSkeleton`** : Composants de chargement squelettes uniformes et pulsés, éliminant les sauts de mise en page abrupts.
5. **`StaggerGrid`** : Orchestre l'apparition échelonnée (staggered delay) des éléments d'une grille pour un rendu progressif ultra-fluide.

---

## 2. Refonte du Kit Generator (Chantier 10)

Le Kit Generator (`src/app/ai-configurator/page.tsx` et composants associés) est transformé en une expérience conversationnelle et adaptative de premier plan ("La meilleure UX possible").

### Workflow Métier en 5 Étapes

#### Étape 1 : Destination
- Saisie de la destination avec auto-complétion fluide (recherche géographique synchrone/asynchrone).
- Carte interactive réduite (mini-map réactive) affichant la zone ciblée en temps réel.
- Animation d'apparition en fondu de la destination validée.

#### Étape 2 : Contexte du Voyage
- Sélection de la durée via un sélecteur tactile ou curseur fluide.
- Sélection de la saison et des activités outdoor clés via des puces (chips) interactives à état actif animé.
- Prévisualisation instantanée et réactive du gabarit de pack en arrière-plan.

#### Étape 3 : Profil Voyageur
- Définition du profil à l'aide de curseurs (sliders) réactifs :
  - Niveau d'expérience (débutant, intermédiaire, expert).
  - Poids maximal cible (kg).
  - Budget estimatif (€).
  - Préférence de style (confort, minimaliste, ultra-léger).

#### Étape 4 : Génération & Streaming IA
- Animation de matérialisation progressive (stagger + morph) des catégories d'équipement.
- Streaming des suggestions d'équipements en temps réel via OpenRouter MCP (Claude 3.5 Sonnet).
- Mise à jour en temps réel des jauges de poids et de budget de manière fluide (spring-animated SVG/Tailwind).

#### Étape 5 : Édition Interactive du Kit Généré
- Organisation des objets par drag & drop simple.
- Suppression rapide d'objets via un swipe-left sur chaque ligne avec feedback haptic.
- Ajout de produits alternatifs à l'aide de carrousels horizontaux fluides (swipeable alternatives).
- Sauvegarde automatique transparente avec indicateur d'état discret.

---

## 3. Spécifications Techniques & Couche Services

### Gestion de l'IA & Caching PostGIS
Toutes les générations de kits exploitent un cache intelligent de proximité pour économiser les appels d'API IA et garantir un chargement instantané.

```typescript
// Spécification de la fonction de recherche de kits similaires via PostGIS
// RPC Supabase : find_similar_kits
// Paramètres : lat, lng, duration, season, activities, max_weight, budget
```

Le service IA interroge d'abord la base de données Supabase pour localiser les configurations correspondantes dans un rayon de 100 km (via PostGIS CRS EPSG:4326), adaptant ensuite les détails au profil utilisateur de façon déterministe ou par appel de complétion léger si aucun cache n'est disponible.

### Validation Métier (Rules Engine)
Les kits générés par l'IA passent obligatoirement par un moteur de validation client/serveur basé sur des schémas strictes avec **Zod**. Les attributs essentiels de chaque équipement (poids en grammes, prix en euros, niveau de sécurité requis) sont validés pour éliminer toute incohérence avant l'affichage.

---

## 4. Plan de Migration des Pages Existantes

Le déploiement des animations de fluidité et des composants "Flow State" se déroule de façon incrémentale sur 4 phases majeures :

### Phase 1 : Cœur Applicatif & POC
- **Fichiers concernés :**
  - `src/app/page.tsx` (Accueil)
  - `src/app/ai-configurator/page.tsx` (Configurateur)
  - `src/components/mobile-nav/BottomTabBar.tsx` (Navigation active dot spring layoutId)
  - `src/components/mobile-nav/TopBar.tsx` (Micro-animations search & cart)

### Phase 2 : Pages d'Exploration & Produit
- **Fichiers concernés :**
  - `src/app/explorer/page.tsx` (Scroll reveal, mini-map, pull-to-refresh)
  - `src/app/produit/[slug]/ProductDetailClient.tsx` (Galerie photo responsive swipeable, sticky buy bar)

### Phase 3 : Flux Transactionnel & Inventaire
- **Fichiers concernés :**
  - `src/app/panier/page.tsx` (Swipe-to-delete items)
  - `src/app/checkout/page.tsx` (Séquenceur de paiement animé, barres d'étapes)
  - `src/app/mon-kit/page.tsx` (Chamboulement des bagages, animations drag, visual weight meters)

### Phase 4 : Pages Contenus & Compte Voyageur
- **Fichiers concernés :**
  - `src/app/carnets/page.tsx` (Tabs scrollables, staggered cards)
  - `src/app/profil/page.tsx` (Animations des badges, micro-interactions, stats incrémentales animées)

---

## 5. Performance, Accessibilité & Résilience

### Budget de Performance
- Lazy-loading des animations Framer Motion lourdes à l'aide de l'API `LazyMotion` (`domMax`) pour minimiser le bundle JS principal.
- Utilisation de `will-change` et de l'accélération matérielle GPU uniquement sur les calques animés actifs pour éviter les fuites de mémoire.

### Résilience Hors-ligne
- Intégration de détection de connectivité réseau (`useOnlineStatus`).
- Interface de feedback non-intrusive (bannière discrète hors-ligne) intégrée avec fluidité au-dessus de la BottomTabBar.
- Caching persistant des derniers kits générés et favoris dans le `localStorage` avec mécanisme de rafraîchissement asynchrone ("Stale-While-Revalidate").

### Accessibilité (a11y)
- Respect des préférences système de l'utilisateur via le hook `useReducedMotion` de Framer Motion (désactivation automatique des transitions de déplacement pour un comportement par fondu simple).
- Focus-traps fluides sur tous les tiroirs mobiles (drawers) et overlays.
