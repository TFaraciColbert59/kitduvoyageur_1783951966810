# Compte — actions, drawers et notifications — plan d’implémentation

> **For agentic workers:** exécuter dans l’ordre. Chaque tâche se termine par un test ou une vérification observable. Spec : `docs/superpowers/specs/2026-10-23-compte-actions-drawers-notifications-design.md`.

**Goal :** rendre réelles les actions des posts, créer les sous-drawers manquants, unifier le design des drawers, brancher la création inline et une activité sans DM.

**Architecture :** overlay React hors de `#sheet` (`CompteOverlayHost`), couche de domaine `features/community/posts`, formulaires de création extraits, notifications lues côté serveur avec fallback de groupe.

**Stack :** Next 15, React 19, Supabase, TanStack Query, Vitest, Playwright, Vercel.

---

## Tâches

### 1. Fondations design + métriques
- Créer `src/lib/format/metrics.ts` + tests.
- Créer `src/components/compte/overlay/compte-overlay.css` et les primitives (`OverlaySheet`, `OverlayHeader`, `DrawerButton`, `DrawerToggle`).
- Corriger la syntaxe du seed (`iso-0.364)`).
- Vérifier `tsc` et tests unitaires.

### 2. Hôte d’overlays
- Créer `CompteOverlayHost` + contexte.
- Monter dans `CompteLiquidGlassV8`.
- Ponts runtime `__lkdvOpenPost/Create/Seal/Saved/Badge/Gear/Trust`.
- Focus trap, Escape, scroll lock, restitution du focus.
- Tests d’ouverture/fermeture.

### 3. Couche posts
- Créer `src/features/community/posts/{types,queries,mutations}.ts`.
- Like RPC, save, commentaires, reports, repost, delete, share, copy.
- Brancher `mapPosts` média/audience/user_liked/user_saved.
- Tests de mapping + mutations mockées.

### 4. PostDrawer
- 3 panneaux avec `LensPager` : Partage / Publication / Commentaires.
- Média réel, visionneuse, auteur, compteurs, actions.
- Commentaires complets, composer, réponses, likes, signalement.
- Partage interne/externe, copier le lien réel, republier, supprimer.
- Intégrer au runtime (remplacer `openPostModal` legacy).
- Tests composant + E2E démo.

### 5. Enregistrements
- `SavedPostsDrawer` + bouton signet runtime.
- Requête `post_saves` + posts, ouverture PostDrawer.
- Tests vide/rempli.

### 6. Trophée / produit / confiance
- `BadgeTile` bouton + `BadgeDetailSheet`.
- `GearRow` bouton + `GearDetailSheet`.
- `TrustCard` cliquable + `TrustDetailSheet` compact.
- Tests d’ouverture et données.

### 7. Empreinte
- `SealDrawer` compact avec radar proportionnel.
- Remplacer `sealzoom` runtime.
- Tests de contenu et style.

### 8. Notifications
- `notificationGroup` hybride, filtres DM.
- `loadActivity` : exclusion messages, compteur exact, acteurs, actions.
- UI Instagram (avatars, miniature, follow, groupes).
- Entrée `?tab=notifications`, cloche Header.
- Backfill `group` via script DML.
- Migration triggers follow/orders/loans/badges/challenges (fichier).
- Tests unitaires + SQL.

### 9. Création inline
- `CreateDrawerHost` + catalogue 6 types.
- Formulaires `CreatePostForm`, `CreateStoryForm`, `CreateCarnetForm`, `CreateKitForm`, `CreateClubForm`, `CreateTripForm`.
- Corriger `club_members` admin.
- Succès sans navigation, rafraîchissement bootstrap.
- Tests composants + E2E.

### 10. Design system des drawers existants
- Appliquer les tokens aux drawers Compte/Réseau/Sortie/Slots/Réglages/Club.
- Passer les CTA 44 à 34–36 visuels + cible 44.
- Toggles 42×25.
- Captures 430×932.

### 11. Corrections feed
- Report post vers `post_reports` (fallback `comment_reports` si migration non appliquée).
- Copier le lien séparé du partage.
- Suppression/republication.
- Messages `message_type='post'`.

### 12. Finition
- `tsc`, tests ciblés, build.
- Déploiement production.
- E2E démo : post, commentaires, partages, saved, badge, produit, empreinte, trust, création, notifications.
- Rapport de vérification.

---

## Contraintes globales

- Ne pas modifier les migrations existantes ; ajouter des migrations datées.
- Ne pas casser `CommunityPostCard`, `ProfileDrawerHost`, `SlotShell`.
- Pas de `router.push` pour ouvrir un sous-drawer.
- Aucun mock dans les nouveaux flux : si une donnée manque, état vide explicite.
- Tests avant build ; build avant deploy.
