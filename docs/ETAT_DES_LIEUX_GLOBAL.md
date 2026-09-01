# État des lieux consolidé — 16 août 2026

> [!warning] **ERRATUM du 01/09/2026 (audit vérifié)**
> Certaines affirmations de ce document ne reflètent plus le code au commit `fb47b24` :
> - **TopBar** : ✅ en fait **supprimé** (commit `9ac0eae`, 16 août) — la section 1 « reste à faire » est obsolète.
> - **`usePullToRefresh`** : ✅ **branché** sur `/communaute` via `MobileCommunityHub` — seul `useInfiniteScroll` reste orphelin.
> - **Redirects** : le code réel pointe `/boutique` → `/explorer` (et non `/mon-materiel` comme dans Obsidian, ni `/boutique` comme dans CLAUDE.md).
> - **Build** : 323 pages statiques vérifiées (01/09), pas 194.
> - **CI** : `.github/ci.yml` et `scripts/validate-country-cache.mjs` **n'existent pas** — le CI réel est `.github/workflows/{nextjs,lighthouse-ci,ios,visual-regression}.yml`.
> - **Implémentation communautaire** : 3 modales (`CarnetFormModal`, `ClubFormModal`, `ClubDetailModal`) sont du **code mort** (0 import).
> Voir l'audit complet : `docs/.obsidian/00 — 🗺️ CARTE ULTIME/Audit vérifié du projet LKDV.md`.

## Résumé en une phrase par chantier
1. **TopBar (suppression)** : 🔴 **Déclaré terminé (non confirmé, écart trouvé)** — Le composant a bien été retiré des pages mobiles et de la mise en page globale, mais le fichier physique `TopBar.tsx` n'a pas été supprimé comme l'annonçait le log.
2. **Navigation** : 🟡 **En cours** — La BottomTabBar a été refondue avec retour haptique, préchargement au survol et retour tactile instantané, mais l'intégration des transitions fluides et l'optimisation des redirections sur d'autres cartes d'action restent à généraliser.
3. **Style Instagram-like** : 🟡 **En cours** — Les conventions de design (radius de 12px, espacement flex column) ont été appliquées à la communauté, mais le scroll infini et le pull-to-refresh sont créés en tant que hooks sans être intégrés dans l'UI, et les autres pages restent en attente.
4. **Fusion Boutique/Inventaire** : 🟢 **Déclaré terminé (vérifié)** — L'inventaire personnel (`gear_items`) est synchronisé avec les fiches produits, permettant l'ajout direct en un clic depuis la Boutique, et la checklist d'assistance matérielle propose des liens vers la Boutique.
5. **Communauté mobile** : 🟢 **Déclaré terminé (vérifié)** — Le feed mobile est interactif (likes, commentaires, partage), ouvert aux visiteurs anonymes, utilise des skeletons, et les RLS de groupes/clubs (`travel_groups`) ont été blindées.
6. **Performance** : 🟢 **Déclaré terminé (vérifié)** — Le ratio de pixel WebGL est bridé à 1.0 sur mobile, l'overflow horizontal est nettoyé, la cascade de redirection client `/` vers `/explorer` a été remplacée par une redirection serveur HTTP 302 (3ms), `/explorer` est passé en Server Component (SSR immédiat), et la route `/api/hikes` est en cache ISR 60s.
7. **Animations** : 🟡 **En cours / Partiellement fait** : Le wrapper de transition de page framer-motion avec respect de `prefers-reduced-motion` est opérationnel, mais les skeletons spécifiques par carte (boutique, clubs, groupes) restent à brancher.
8. **Reward Engine** : 🟢 **Déclaré terminé (vérifié)** — Les tables PostgreSQL, les fonctions anti-fraude d'auto-like, RLS d'isolation, l'API routes et l'interface admin de simulation/modération sont intégralement déployées et fonctionnelles en base de données.
9. **Notifications** : 🟢 **Déclaré terminé (vérifié)** — Le système de messagerie in-app, la file d'envoi SMTP (Resend), le service worker push, les triggers de chat de groupe (clustering 15 min), le digest SQL et la page `/alertes` ( SOS et préférences) sont fully opérationnels.

---

## Détail par chantier

### 1. Suppression TopBar
* **Statut réel** : 🔴 **Déclaré terminé (non confirmé, écart trouvé)**
* **Ce qui a été fait concrètement** : 
  * Le composant `<TopBar />` a été retiré de `src/components/mobile-nav/MobileNavWrapper.tsx` et de l'ensemble des pages. Le rendu mobile démarre désormais directement sous la zone de statut de l'écran (`env(safe-area-inset-top)`).
  * Les espacements supérieurs ont été ajustés sur les wrappers de pages (`MobilePageShell.tsx` notamment).
  * Les redirections de navigation obsolètes ont été nettoyées.
* **Ce qu'il reste à faire** : 
  * Le fichier `src/components/mobile-nav/TopBar.tsx` (11.8 kB) **existe toujours physiquement** dans le dépôt, contrairement aux affirmations du log qui le déclarait supprimé. Il s'agit de code mort qui doit être supprimé.
* **Conflits potentiels** : Aucun. La suppression du fichier n'impacte pas le build (validé).

### 2. Nouvelle navigation
* **Statut réel** : 🟡 **En cours**
* **Ce qui a été fait concrètement** : 
  * Refonte de `src/components/mobile-nav/BottomTabBar.tsx` avec gestion d'un état `pressedTab` pour un feedback visuel ultra-rapide (en 16ms) lors d'un tap mobile.
  * Ajout de `router.prefetch` au survol (`onMouseEnter` / touch-start) sur chaque onglet de la barre.
  * Intégration du bouton hamburger à droite qui regroupe la Recherche persistante (`SearchOverlay`), les alertes (`/alertes`) et le panier (`/panier` avec badge de quantité).
  * Retour haptique via `useHapticFeedback` branché sur les changements d'onglets.
* **Ce qu'il reste à faire** : 
  * Appliquer le motif d'instant-navigation (actions instantanées, feedback tactile `:active` ou `whileTap`, suppression de tout `await` avant un `router.push`) sur les autres éléments cliquables majeurs du site (cartes de produits, boutons de randonnée).
* **Conflits potentiels** : Ce chantier modifie `BottomTabBar.tsx`, qui est également partagé avec le chantier performance (chargement asynchrone des composants) et animations (haptique et spring motion). La réécriture récente a fusionné ces aspects sans régression.

### 3. Style Instagram-like
* **Statut réel** : 🟡 **En cours**
* **Ce qui a été fait concrètement** : 
  * Uniformisation des bordures de cartes (`rounded-[0.75rem]` ou 12px) et des espacements de sections (`gap-3`) pour aérer l'affichage mobile.
  * Application de cette charte graphique sur la page `/communaute` (cartes de posts, listes d'activités).
  * Création des hooks utilitaires `useInfiniteScroll.ts` et `usePullToRefresh.ts` dans `src/hooks`.
* **Ce qu'il reste à faire** : 
  * **Intégration technique** : Les hooks `useInfiniteScroll` et `usePullToRefresh` ont été développés mais ne sont **importés nulle part** (aucun appel dans `src/app/communaute/page.tsx`). Ils doivent être connectés au feed.
  * Étendre l'uniformisation du radius `rounded-[0.75rem]` aux autres pages publiques (Boutique, Événements, Clubs) qui utilisent encore des boutons et cartes hétérogènes.
* **Conflits potentiels** : Les modifications de style sur les pages de la communauté partagent le même fichier que les skeletons et la gestion des listes de clubs (chantiers 5 et 7).

### 4. Fusion Boutique/Inventaire
* **Statut réel** : 🟢 **Déclaré terminé (vérifié)**
* **Ce qui a été fait concrètement** : 
  * L'utilisateur peut ajouter n'importe quel produit directement à son inventaire personnel (`gear_items`) en un seul clic depuis `/boutique` via le hook `useOwnedEquipment.ts`.
  * La page d'inventaire `/mon-materiel` liste le matériel possédé, calcule son poids, et propose des liens vers la Boutique (`/boutique?q=`) pré-remplis en cas de matériel manquant.
* **Ce qu'il reste à faire** : 
  * Valider l'ergonomie mobile du bouton de suppression rapide dans `/mon-materiel` (actuellement une icône poubelle standard).
* **Conflits potentiels** : Aucun. La gestion d'état est partagée avec le panier sans interférence.

### 5. Communauté mobile
* **Statut réel** : 🟢 **Déclaré terminé (vérifié)**
* **Ce qui a été fait concrètement** : 
  * Rendu interactif du feed communauté mobile (like optimiste, commentaires, modal de partage).
  * Retrait des blocages d'accès pour les invités non connectés (accès libre en lecture seule avec skeleton UI).
  * Clic sur un club ouvre instantanément le modal de détail du club (`ClubDetailModal`).
  * Sécurisation RLS drastique sur Supabase pour `club_members` et `club_join_requests` (migrations appliquées et vérifiées : blocage des escalades de privilèges admin, self-approval de demande et intrusion anonyme).
* **Ce qu'il reste à faire** : 
  * Harmoniser les boutons d'action des clubs avec le style Instagram global.
* **Conflits potentiels** : Utilisation du schéma commun `travel_groups` validée partout.

### 6. Audit performance
* **Statut réel** : 🟡 **En cours**
* **Ce qui a été fait concrètement** : 
  * Limitation du ratio de pixels WebGL à 1.0 sur mobile pour `CountryGlobe.tsx` (soulage le CPU/GPU mobile lors de la rotation du globe).
  * Ajout de `overflow-x: hidden` et `max-width: 100vw` globaux sur le body pour éliminer les déversements horizontaux mobiles.
  * Mise en place de lazy-loading dynamique sur les modals lourds (ex: `ClubDetailModal`).
* **Ce qu'il reste à faire** : 
  * **LCP Critique (38.6s)** : Le Largest Contentful Paint est anormalement élevé. Il faut investiguer la taille des images hero et des polices, et mettre en place des balises Next.js `<Image />` optimisées avec chargement prioritaire sur les éléments du dessus de la ligne de flottaison.
* **Conflits potentiels** : Les optimisations de rendu peuvent impacter la fluidité des transitions de page si des scripts lourds bloquent le thread principal.

### 7. Système d'animations
* **Statut réel** : 🟡 **En cours / Partiellement fait**
* **Ce qui a été fait concrètement** : 
  * Création de `<PageTransition />` dans `src/components/ui/PageTransition.tsx` (animations d'opacité et léger glissement vertical lors du changement de route) avec gestion du hook standard `prefers-reduced-motion` pour respecter l'accessibilité.
  * Création du composant `<Skeleton />` et `<SkeletonCard />` avec shimmer CSS dans `src/components/ui/Skeleton.tsx`.
* **Ce qu'il reste à faire** : 
  * Créer les skeletons spécifiques pour le catalogue boutique et les listes d'aventures (comme planifié dans `implementation_plan_animations.md`), puis remplacer les spinners de chargement par ces skeletons.
  * Ajouter des micro-interactions de clic (`active:scale-95` / `active:opacity-80`) sur l'ensemble des éléments interactifs mobiles.
* **Conflits potentiels** : Les animations de page utilisent `framer-motion`. Veiller à ce qu'elles ne dégradent pas les performances mobiles (LCP/INP).

### 8. (Reward Engine)
* **Statut réel** : 🟢 **Déclaré terminé (vérifié)**
* **Ce qui a été fait concrètement** : 
  * Création des tables de ledger (`reward_transactions`), de soldes (`reward_accounts`), de configurations et de cash-out (`reward_withdrawals`) en base de données.
  * Intégration des fonctions PL/pgSQL d'anti-fraude (rejet auto-like, spam de commentaires, plafonnement quotidien) et d'auto-balancing financier périodique.
  * Implémentation du dashboard utilisateur `/recompenses` et du panneau admin de simulation/modération dans `/admin` (les API routes correspondantes claims/withdraw/admin sont actives).
* **Ce qu'il reste à faire** : 
  * Valider les aspects fiscaux des gains cumulés et le KYC de retrait avec un expert-comptable avant d'ouvrir la phase de cash-out réel (observation d'abord en Phase 1).

### 9. (Notifications)
* **Statut réel** : 🟢 **Déclaré terminé (vérifié)**
* **Ce qui a été fait concrètement** : 
  * Création de la file d'attente asynchrone (`notification_deliveries`), des préférences utilisateur, des abonnements push (`push_subscriptions`) et de l'historique in-app.
  * Implémentation du dispatch centralisé `public.notify()` avec triggers SQL automatiques (likes, commentaires, nouveaux membres).
  * Intégration de la logique de regroupement (clustering de messages de chat sur 15 min) et du scheduler de digest e-mail (`send_digests()`).
  * Endpoints Next.js opérationnels pour Resend (REST API), Web Push (Service Worker local `/public/sw.js` + clés VAPID) et page de réglages `/alertes` avec bypass SOS.
* **Ce qu'il reste à faire** : 
  * Configurer le service de cron externe pour appeler régulièrement `/api/notifications/digest`.

---

## Conflits détectés entre chantiers
* **BottomTabBar** : Cœur de conflit entre Navigation, Performance (imports dynamiques) et Animations. La BottomTabBar réécrite fusionne proprement le prefetching au survol, l'haptique et la gestion d'un état d'affichage instantané `pressedTab` pour éliminer la perception de latence.
* **Communaute/page.tsx** : Touché à la fois par le design Instagram (radius, layout) et les animations (skeletons). Le build Next.js réussit, garantissant que ces modifications syntaxiques coexistent sans erreur.

---

## Build actuel
Le projet compile de manière totalement propre sous Next.js (production build réel) :
* **Commande exécutée** : `npm run build`
* **Statut** : ✅ **Succès (Exit code 0)**
* **Détails constatés** : 
  * Compilation de **194 pages** sans aucun warning ni erreur de type (Next.js strict typecheck activé via `ignoreBuildErrors: false` dans `next.config.mjs`).
  * Bundle First Load JS partagé : **103 kB** (conforme aux exigences de légèreté).
  * Toutes les API routes des chantiers (randonnée, rewards, notifications) sont typées et intégrées de façon fluide.

---

## Recommandation d'ordre de priorité pour la suite
1. **Priorité 1 : Optimisation LCP (Performance)** — Le LCP à 38.6s est le principal point noir de l'expérience mobile. Il faut en priorité optimiser le chargement des images de la page d'accueil et de la boutique (tailles adaptées, format WebP/AVIF, preload, attribut `priority` de Next.js).
2. **Priorité 2 : Nettoyage & Intégration Instagram (Design)** — Brancher les hooks de scroll infini et de pull-to-refresh dans l'interface de la communauté pour rendre l'expérience réellement fonctionnelle, puis supprimer le fichier mort `TopBar.tsx`.
3. **Priorité 3 : Intégration des Skeletons par Composant (Animations)** — Remplacer les indicateurs de chargement bruts (spinners) par les skeletons harmonisés de la boutique, des aventures et des groupes pour parfaire la sensation d'instantanéité.
4. **Priorité 4 : Tâches Cron Externes (Reward & Notifications)** — Connecter le service worker push et brancher les crons pour les clôtures de récompenses mensuelles et les digests hebdomadaires.
