# Handoff Report — Mobile UI & Interaction Survey (Requirement R4)

**Role**: Mobile UI & Interaction Explorer (Apple HIG Specialist)  
**Date**: 2026-10-03  
**Target Requirement**: R4 — Interface communautaire, ergonomie mobile native et contrôles de transparence utilisateur  
**Working Directory**: `.agents/teamwork/explorer_survey_ui_1`

---

## 1. Observation

### 1.1 Architecture des Routes et Fichiers `/communaute`
- **Route principale** : `src/app/communaute/page.tsx` (674 lignes).
  - Composant Client (`'use client'`), enveloppé dans `<Suspense>`.
  - Intègre `CompteBackground` pour le fond canopée/forêt.
  - Séparation responsive stricte :
    - **Mobile** (`block md:hidden`, lignes 240–259) :
      ```tsx
      <div className="block min-h-screen md:hidden">
        <AppShell videoBackground={true} safeTop={false}>
          <MobileCommunityHub
            posts={posts}
            carnets={filteredCarnets}
            clubs={filteredClubs}
            groups={groups}
            events={events}
            activeTab={activeTab as any}
            onTabChange={(tab) => handleTabSelect(tab as any)}
            loading={loading}
            user={user}
            onRefresh={fetchData}
            joinedEventIds={joinedEventIds}
            onJoinEvent={handleJoinEvent}
          />
        </AppShell>
      </div>
      ```
    - **Desktop** (`hidden md:flex`, lignes 264–370) : cockpit 3 colonnes composé de `CommunityLeftSidebar` (280px dans un conteneur `LiquidGlass`), un flux central avec `CommunityHeroOverview`, `CommunityStoriesBar`, `LineageDiscovery` et la liste des posts/carnets/clubs, et `CommunityRightSidebar` (flux en direct, sorties, clubs populaires).
- **Fichiers de layout et gestion des états** :
  - `src/app/communaute/layout.tsx` (51 lignes) : gère les métadonnées SEO, OpenGraph, Twitter Cards et Schema.org (`WebPage`, `BreadcrumbList`).
  - `src/app/communaute/loading.tsx` (43 lignes) : Skeletons d'onglets et de cartes de publications pour le streaming SSR.
  - `src/app/communaute/error.tsx` (47 lignes) : barrière d'erreur avec bouton « Réessayer » et retour accueil.
- **Sous-routes associées** :
  - `src/app/communaute/publier/page.tsx` : flux complet de création de publication avec upload d'image, tags matériel, position GPX.
  - `src/app/communaute/pro/page.tsx` et `src/app/communaute-pro` : espace B2B dédié aux guides et professionnels.
  - `src/app/carnets` et `src/app/clubs` : routes dédiées complètes (avec `[id]` et formulaires de création).

---

### 1.2 Navigation et Système d'Onglets Existants
- **Définition actuelle des onglets** dans `src/components/communaute/MobileCommunityHub.tsx` (lignes 31–38) et `src/components/social/CommunityHubNav.tsx` (lignes 25–32) :
  ```tsx
  export type CommunityMobileTab = 'fil' | 'carnets' | 'clubs' | 'groupes' | 'evenements' | 'entraide';

  const TABS: Array<{ id: CommunityMobileTab; label: string; icon: React.ReactNode }> = [
    { id: 'fil', label: 'Pour vous', icon: <Icon name="layers" size={17} aria-hidden="true" /> },
    { id: 'carnets', label: 'Carnets', icon: <Icon name="book-open" size={17} aria-hidden="true" /> },
    { id: 'clubs', label: 'Clubs', icon: <Icon name="users" size={17} aria-hidden="true" /> },
    { id: 'groupes', label: 'Expéditions', icon: <Icon name="map" size={17} aria-hidden="true" /> },
    { id: 'evenements', label: 'Sorties', icon: <Icon name="calendar" size={17} aria-hidden="true" /> },
    { id: 'entraide', label: 'Entraide', icon: <Icon name="message-square" size={17} aria-hidden="true" /> },
  ];
  ```
- **Gestion du changement d'onglets** dans `src/app/communaute/page.tsx` (lignes 59–73) :
  ```tsx
  const handleTabSelect = (tab: CommunityHubTab) => {
    setActiveTab(tab);
    if (tab === 'carnets') {
      router.push('/carnets');
    } else if (tab === 'clubs') {
      router.push('/clubs');
    } else if (tab === 'groupes') {
      router.push('/groupes');
    } else {
      router.push(`/communaute?tab=${tab}`);
    }
  };
  ```
- **Écart constaté avec R4** :
  L'exigence R4 requiert 4 vues de flux communautaire :
  1. **Pour toi** (Feed V1 algorithmique multi-signaux : Intent, Utility, Proximity, Quality, Reranking de diversité).
  2. **Abonnements** (Flux chronologique des créateurs et voyageurs suivis).
  3. **Autour de moi** (Flux géo-territorial basé sur la position GPS réelle via `useGeolocation` ou le voyage actif).
  4. **Clubs** (Flux & collectifs communautaires).
  Actuellement, `MobileCommunityHub` mélange des filtres de types d'objets (`carnets`, `clubs`, `groupes`) avec des redirections pleines pages pour certains (`router.push('/carnets')`), cassant la continuité fluide du flux mobile.

---

### 1.3 Design System, Apple HIG et Tokens Visuels
- **Fichier de tokens canonique** : `src/styles/tokens.css` (1112 lignes) & `tailwind.config.js` (205 lignes).
- **Palette LKDV conforme** :
  - `--lkv-primary`: `#17402C` (vert forêt maître).
  - `--lkv-action`: `#226148` (vert émeraude d'action).
  - `--lkv-secondary`: `#5B7F55` / `#A3C4A3` (sauge).
  - `--lkv-surface`: `#F5F7F3` / `--stone-50`: `#FAF8F5`.
  - `--lkv-text-primary`: `#172B24` (contraste > 7:1 sur fond clair).
  - **Interdiction absolue** : aucun usage de la couleur orange `#E4501C` dans les composants communautaires (respect strict de la règle LKDV).
- **Typographie Apple iOS** :
  - Pile système : `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', Inter, sans-serif`.
  - Échelle Dynamic Type :
    - `--lkv-text-caption-2`: `0.6875rem` (11px)
    - `--lkv-text-caption`: `0.75rem` (12px)
    - `--lkv-text-footnote`: `0.8125rem` (13px)
    - `--lkv-text-subheadline`: `0.9375rem` (15px)
    - `--lkv-text-body`: `1.0625rem` (17px)
    - `--lkv-text-headline`: `1.0625rem` (17px semibold)
    - `--lkv-text-title-sm`: `1.375rem` (22px)
    - `--lkv-text-title-lg`: `2.125rem` (34px - Large Title iOS)
- **Matériaux Verre & Translucidité** :
  - Tokens Liquid Glass : `--btn-tint`, `--btn-glass-border`, `--btn-blur: 26px`, `--btn-saturate: 1.10`, classe `lkv-rim-btn`.
  - Effet Ambilight dans `CommunityPostCard.tsx` (lignes 753–768) : flou dynamique de 50px de la photo avec masque dégradé sous le texte.
  - Masque de fondu aux extrémités (`[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]`) sur les barres horizontales défilantes (`Tabs`, filtres de massifs, stories).
- **Gestion des Safe Areas** :
  - `AppShell.tsx` (lignes 101–116) calcule dynamiquement `--bottom-nav-height`, `--page-top-inset`, `paddingBottom: max(var(--bottom-nav-height), ...)`.
  - Règle ESLint stricte `lkdv/shell-safe-area` interdisant `env(safe-area-inset-*)` en dur dans les pages.
- **Cibles tactiles minimales** :
  - `--lkv-touch-min`: `44px` (Apple HIG standard) et `--lkv-touch-comfortable`: `48px`. Respecté par les composants `Tabs`, `Button`, `IconButton`.

---

### 1.4 Patterns d'Interaction, Feedback et Gaps R4 dans `CommunityPostCard.tsx`
- **Haptique et Gestes opérationnels** :
  - `src/hooks/useHapticFeedback.ts` et `src/lib/native/haptics.ts` : pont Capacitor `@capacitor/haptics` avec repli Web Vibration API et protection `prefers-reduced-motion`. Styles supportés : `light`, `medium`, `heavy`, `selection`, `success`, `warning`, `error`.
  - `usePullToRefresh` : déclenche une vibration `medium` et un rafraîchissement avec spinner en tête de liste.
  - `useDoubleTap` : double tap sur média avec animation de cœur 60fps (GPU `transform`/`opacity`) et vibration `light`.
  - `useLongPress` : déclenche un menu contextuel rapide sur le post avec vibration `medium`.
- **GAPS CRITIQUES IDENTIFIÉS dans `CommunityPostCard.tsx`** :
  1. **Sauvegarde (Bookmark / Save)** :
     ```tsx
     // Lignes 346-350 de CommunityPostCard.tsx
     const handleToggleSave = () => {
       setIsSaved(!isSaved);
       setShowMoreMenu(false);
       showToast(isSaved ? 'Retiré de vos favoris' : 'Enregistré dans vos favoris ⭐');
     };
     ```
     *Constat direct* : la fonction mute uniquement un état React local `isSaved`. Aucun appel Supabase, aucune persistance dans la future table `post_saves` !
  2. **Masquage (Hide Post)** :
     ```tsx
     // Lignes 352-356 de CommunityPostCard.tsx
     const handleHidePost = () => {
       setIsHidden(true);
       setShowMoreMenu(false);
       showToast('Publication masquée de votre fil.');
     };
     ```
     *Constat direct* : la fonction mute uniquement l'état local `isHidden`. Aucun appel Supabase, aucun enregistrement de feedback utilisateur dans `content_feedback` !
  3. **Bouton « Moins comme ceci » (Negative Feedback explicite)** :
     *Constat direct* : absent de l'interface et du menu contextuel.
  4. **Contrôle de transparence « Pourquoi je vois ce contenu »** :
     *Constat direct* : totalement absent. Aucune modal ni bottom sheet n'expose la justification algorithmique (ex. : « Recommandé car vous suivez X », « Proche de votre itinéraire dans le Vercors », « Très utile pour préparer un bivouac »).
  5. **Menu d'actions mobile** :
     *Constat direct* : le menu actuel est un popover flottant `moreMenuNode` ancré en absolu (`absolute bottom-full right-0`), ce qui est peu adapté à l'ergonomie tactile à une main. Apple HIG préconise une Bottom Action Sheet (`Sheet` avec `detent="auto"`).

---

### 1.5 Outillage, TypeScript, Lint et Tests
- **TypeScript (`tsconfig.json`)** :
  - Mode strict actif, target `ES2017`, module `esnext`, moduleResolution `bundler`.
  - Exécution : `npm run type-check` (`tsc --noEmit`).
  - **Résultat vérifié** : code de sortie **0** (aucune erreur TypeScript sur l'ensemble du projet).
- **ESLint (`eslint.config.mjs`)** :
  - Flat config avec extensions Next.js core web vitals et règles personnalisées (`lkdv/shell-safe-area`).
  - Exécution : `npm run lint` (`next lint`).
  - **Résultat vérifié** : code de sortie **0** (aucune erreur bloquante, uniquement des avertissements préexistants).
- **Tests Unitaires Vitest (`vitest run`)** :
  - Exécution : `npm run test`.
  - **Résultat vérifié** : 736 fichiers de tests réussis, 6 991 tests passés avec succès. Les seuls échecs préexistants (5 tests) sont dans des specs non liées (`ai/registry.spec.ts`, `trajectoire/narration.spec.ts`, `n7-capture-393x852.test.ts`).

---

## 2. Logic Chain

1. **Prémisse 1 (Scope R4)** : L'objectif de R4 est de doter `/communaute` de 4 onglets opérationnels fluides (Pour toi, Abonnements chronologique, Autour de moi, Clubs), de persister les actions sociales (Sauvegarder, Masquer, Moins comme ceci) avec retour haptique/visuel immédiat, et d'offrir des contrôles de transparence explicites (« Pourquoi je vois ce contenu »).
2. **Déduction 2 (Architecture des Onglets)** : Actuellement, `MobileCommunityHub` affiche 6 onglets non alignés avec les flux de recommandation R3 (`fil`, `carnets`, `clubs`, `groupes`, `evenements`, `entraide`), dont certains effectuent des `router.push(...)` vers d'autres pages. Pour respecter R4, il faut unifier le composant d'onglets pour switcher entre les 4 flux recommandés :
   - `pour-toi` (Feed V1 scoré côté serveur).
   - `abonnements` (Posts d'auteurs suivis triés par `created_at` DESC).
   - `autour-de-moi` (Posts et carnets géolocalisés à proximité de la position GPS ou du camp de base).
   - `clubs` (Activités et publications des clubs de randonnée/trek).
   L'accès aux « Carnets durables » et « Clubs » doit être garanti par des cartes de découverte et des carrousels intégrés dans le flux, tout en maintenant les routes dédiées `/carnets` et `/clubs`.
3. **Déduction 3 (Mutation Persistante & Optimisme)** :
   - Dans `CommunityPostCard`, les interactions `Save` et `Hide` ne font qu'altérer l'état React local (`useState`).
   - Lorsque les tables `post_saves` et `content_feedback` seront déployées par l'agent Database (R2), l'interface UI devra exécuter :
     - Pour **Sauvegarder** : mise à jour optimiste de `isSaved` + haptic('selection') + insertion/suppression dans `post_saves` via Supabase client ou route API dédiée, avec rollback en cas d'échec.
     - Pour **Masquer** : mise à jour optimiste de `isHidden` + haptic('light') + insertion dans `content_feedback` (`feedback_type: 'hide'`).
     - Pour **Moins comme ceci** : mise à jour optimiste + haptic('medium') + insertion dans `content_feedback` (`feedback_type: 'less_like_this'`) avec motif optionnel.
4. **Déduction 4 (Contrôles de Transparence Apple HIG)** :
   - Le composant `Sheet.tsx` (basé sur Radix Dialog, avec poignée `dragToDismiss`, safe areas et backdrop blur) est déjà disponible et parfaitement stylisé.
   - Il doit être utilisé pour :
     1. Un menu d'actions tactile natif du post (Remplacer le popover desktop `moreMenuNode` sur mobile par une bottom sheet).
     2. La vue de transparence **« Pourquoi je vois ce contenu »** : affichant les signaux du score d'utilité Feed V1 (ex. : affinité thématique, proximité géographique, score de préparation équipement).
5. **Déduction 5 (Stabilité Codebase)** : Le code actuel compile avec 0 erreur TypeScript et 0 erreur ESLint. Tout enrichissement de R4 doit maintenir cette propreté exemplaire.

---

## 3. Caveats

- **Dépendance envers R1 & R2** : Les tables `post_saves` et `content_feedback` ne sont pas encore présentes dans la base de données actuelle. Le code UI devra intégrer une détection ou une couche de résilience pour fonctionner de manière optimiste même si la migration DB est en cours.
- **Dépendance envers R3 (Feed V1 Engine)** : L'algorithme de scoring et de reranking Feed V1 n'étant pas encore exposé via une API ou un service dédié, l'onglet « Pour toi » utilise actuellement `community_posts` trié par `created_at DESC`. Dès que le moteur Feed V1 sera en place, `/communaute` consommera son pipeline.
- **Mode Lecture Seule** : Cette exploration n'a appliqué aucune modification au code source ; elle dresse la cartographie exacte pour l'implémentation.

---

## 4. Conclusion

L'infrastructure mobile Next.js de LKDV possède déjà des fondations remarquables :
- Respect rigoureux des tokens de couleurs (pas d'orange `#E4501C`, vert forêt `#17402C` et sauge `#5B7F55`).
- Gestion native des Safe Areas (`AppShell`) et des cibles tactiles 44px.
- Moteur haptique iOS/Capacitor opérationnel avec fallback web et respect de `prefers-reduced-motion`.
- Bottom Sheet Radix (`Sheet.tsx`) avec glissement tactile (`dragToDismiss`).

Le chantier de modernisation pour Requirement R4 consiste précisément en :
1. **Refonte des onglets de flux** : Configurer les 4 onglets majeurs (`Pour toi`, `Abonnements`, `Autour de moi`, `Clubs`) dans `MobileCommunityHub` et `page.tsx` avec transitions fluides.
2. **Persistance réelle des interactions** : Connecter `handleToggleSave`, `handleHidePost` et le nouveau « Moins comme ceci » aux tables Supabase `post_saves` et `content_feedback` avec optimistic UI et retour haptique immédiat.
3. **Action Sheet Apple & Vue Transparence** : Remplacer le menu flottant du post par une Bottom Sheet native et implémenter le composant d'explication de recommandation (« Pourquoi je vois ce contenu »).
4. **Intégration de la géolocalisation** pour le flux « Autour de moi » via `useGeolocation`.

---

## 5. Verification Method

Pour vérifier l'intégrité de la base de code avant et après implémentation :

### Commandes de Validation
1. **Vérification TypeScript** :
   ```bash
   npm run type-check
   ```
   *Attendu* : Sortie avec code 0 (0 erreurs).
2. **Vérification ESLint** :
   ```bash
   npm run lint
   ```
   *Attendu* : Sortie avec code 0 (0 erreurs, warnings acceptés).
3. **Exécution des Tests Unitaires** :
   ```bash
   npm run test
   ```
   *Attendu* : La suite de tests Vitest passe (>= 6 991 tests au vert).

### Fichiers Clés à Inspecter
- `src/app/communaute/page.tsx`
- `src/components/communaute/MobileCommunityHub.tsx`
- `src/components/communaute/CommunityPostCard.tsx`
- `src/components/ui/Sheet.tsx`
- `src/components/ui/Tabs.tsx`
- `src/hooks/useHapticFeedback.ts`
- `src/hooks/useGeolocation.ts`
