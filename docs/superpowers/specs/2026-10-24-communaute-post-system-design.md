# Communauté — socle de post partagé (design)

**Date :** 2026-10-24
**Statut :** proposition à valider — aucun code écrit
**Périmètre :** fil Communauté, post Compte, futurs posts Carnets / Clubs / Sorties
**Décision utilisateur :** **cartes inline** conservées dans le fil ; pas de bascule vers le
`PostDrawer` Compte.

---

## 1. Objectif

Le post du fil Communauté et le post du Compte doivent être **le même système** :

- même fond de page que le Compte ;
- même verre liquide que la carte principale du Compte pour les panneaux commentaires/partage ;
- header du post toujours visible quand un panneau est ouvert ;
- mêmes éléments (header, `···`, média, capsule d’actions, commentaires, partage) ;
- ce socle sera réutilisé **tel quel** pour les posts des pages Carnets, Clubs et Sorties.

Le fil garde ses **cartes inline**. On ne remplace pas le fil par des modals.

---

## 2. Références visuelles exactes

### 2.1 Fond du Compte

Le fond visible du Compte est composé de :

- couleur de base `#cfd6c8` ;
- image `public/assets/images/account-bg.webp` ;
- `background-size: cover` ;
- `background-position: center 30%` ;
- filtre `brightness(1.1) saturate(1.05)` ;
- voile :
  ```css
  linear-gradient(180deg,
    rgba(255,250,236,.08) 0%,
    rgba(255,255,255,0) 30%,
    rgba(245,242,236,.12) 60%)
  ```

Le fil Communauté utilise **exactement** ce fond, pas le gradient crème/sauge actuel.

### 2.2 Verre de la carte Compte

La carte principale du Compte (poste) est :

```css
background: linear-gradient(180deg,
  rgba(255,255,255,.486) 0%,
  rgba(255,255,255,.384) 100%);
backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
-webkit-backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.95),
  inset 0 -1px 1px rgba(255,255,255,.4),
  0 0 0 .5px rgba(23,43,36,.08),
  0 8px 22px rgba(23,43,36,.1);
```

Le panneau commentaires/partage reprend cette recette à l’identique. Il est **translucide** :
l’image du post reste perceptible derrière, sans masquer le texte.

### 2.3 Géométrie du header

Dans le post Compte, le header (avatar, nom, handle, options) reste au-dessus du contenu
commentaires/partage. Dans le fil inline :

- header : `top: 12px`, hauteur min **44 px** pour la pillule auteur ; `···` 34 px à droite ;
- panneau : commence **sous** le header, avec 8 px de respiration ;
- hauteur par défaut : `--post-panel-top: 64px` ;
- le panneau est mesuré dynamiquement si le header passe sur 2 lignes (ResizeObserver) ;
- le contenu du panneau commence 8 px plus bas (`72px` dans le cas standard).

Le header du post et la top bar de la page restent **au-dessus** du panneau et visibles.

---

## 3. Architecture cible

Nouveau module : `src/features/posts/ui/`

```
PostSurface.tsx          cadre du post (variante feed / modal)
PostHeader.tsx           avatar, nom, badge, handle · temps, ···
PostMedia.tsx            image/vidéo, tap, swipe, compteur
PostActions.tsx          capsule like / commentaire / partage
PostOptions.tsx          menu enregistrer, copier, republier, signaler, supprimer
PostGlassPanel.tsx       panneau verre, topInset dynamique, swipe, fermeture
PostConversationPane.tsx commentaires, réponses, likes, édition, signalement
PostSharePane.tsx        recherche destinataire, conversations, partage externe
PostView.ts              adaptateur commun PostDetail / FeedPost
post-system.css          tokens et styles uniques
```

### 3.1 `PostView`

```ts
export interface PostView {
  id: string;
  author: {
    id: string;
    name: string;
    handle?: string | null;
    avatarUrl?: string | null;
    trustScore?: number | null;
  };
  createdAt: string;
  content: string;
  media: Array<{ url: string; type: 'image' | 'video'; alt?: string | null }>;
  location?: { lat: number; lng: number; label?: string } | null;
  stats: { likes: number; comments: number; shares: number };
  viewer: { liked: boolean; saved: boolean; isOwner: boolean };
  context: 'feed' | 'account' | 'carnet' | 'club' | 'sortie';
}
```

Les adaptateurs `fromFeedPost(post)` et `fromPostDetail(post)` vivent dans `PostView.ts`.
Aucune page ne construit son propre objet post.

### 3.2 `PostSurface`

- variante `feed` : carte carrée, header inline, média, capsule d’actions, `···`.
- variante `modal` : contenu du `PostDrawer` Compte ; header fourni par `OverlaySheet`.
- variante `embed` : réservée aux futurs posts Carnets/Clubs/Sorties ; même header et mêmes actions.
- Le composant ne charge aucune donnée : il reçoit un `PostView` et des callbacks.

### 3.3 `PostGlassPanel`

```ts
interface PostGlassPanelProps {
  open: boolean;
  side: 'comments' | 'share';
  topInset?: number | 'header';
  headerRef?: React.RefObject<HTMLElement>;
  onClose: () => void;
  onSwitch: (side: 'comments' | 'share') => void;
  children: React.ReactNode;
}
```

- `topInset="header"` : mesure le header et pose `--post-panel-top = header.bottom + 8`.
- top par défaut 64 px ; `top` du panneau = `var(--post-panel-top, 64px)`.
- verre Compte exact ; une seule couche `backdrop-filter`.
- header du post au-dessus (z-index supérieur), contenu du panneau scrollable.
- swipe horizontal : commentaires ↔ partage ; swipe bas : fermeture.
- aucun titre ni croix dans le panneau (le header du post fait office de header).

### 3.4 `PostHeader`

- `PostHeader` reprend `PostAuthorPill` + `···` (`PostOptions`).
- variante `inline` : pillule flottante actuelle.
- variante `modal` : header `OverlaySheet` (avatar, titre, handle) + `···`.
- mêmes données, mêmes actions, même `aria-label`.
- `PostHeader` expose une `ref` pour la mesure du panneau.

### 3.5 Commentaires / partage

`PostConversationPane` et `PostSharePane` sont les **seuls** panneaux de contenu :

- commentaires : liste, réponses, likes, édition, suppression, signalement, composer ;
- partage : recherche destinataire, conversations, envoi, copie, partage externe, republier.
- Le `PostDrawer` Compte et le fil Communauté les utilisent tous les deux.
- Les hooks de données restent :
  - `features/community/posts/queries` et `mutations` pour le Compte ;
  - `usePostComments`, `usePostShareTargets`, `usePostInteractions` pour le fil.
- Un adaptateur `PostCommentsAdapter` / `PostShareAdapter` normalise les callbacks ; aucune
  duplication de règles métier.

---

## 4. Intégration

### 4.1 Fil Communauté

`CommunityFeedPost` devient :

```tsx
<PostSurface
  view={fromFeedPost(post)}
  variant="feed"
  header={<PostHeader view={view} variant="inline" options={...} />}
  onOpenPanel={setPanel}
>
  {panel ? (
    <PostGlassPanel
      open
      side={panel}
      topInset="header"
      headerRef={headerRef}
      onClose={() => setPanel(null)}
      onSwitch={setPanel}
    >
      {panel === 'comments' ? <PostConversationPane ... /> : <PostSharePane ... />}
    </PostGlassPanel>
  ) : null}
</PostSurface>
```

- Le panneau est dans la carte, sous le header.
- Le swipe d’ouverture reste : gauche → commentaires, droite → partage.
- Le header et la top bar ne bougent pas.

### 4.2 Post Compte

`PostDrawer` conserve `OverlaySheet` (header + drawer) et utilise :

- `PostHeader` variante `modal` dans le header du sheet ;
- `PostActions` / `PostOptions` / `PostMedia` dans l’onglet Post ;
- `PostConversationPane` et `PostSharePane` dans les onglets Commentaires / Partager ;
- `PostGlassPanel` n’est pas utilisé en modal : le sheet est déjà le conteneur ; le contenu
  commence sous le header, comme aujourd’hui.

### 4.3 Futurs posts Carnets / Clubs / Sorties

Contrat documenté dans `docs/communaute/POST-SYSTEM.md` :

```tsx
<PostSurface
  view={fromCarnetPost(carnetPost)}
  variant="embed"
  context="carnet"
>
  ...
</PostSurface>
```

- même header, même `···`, même capsule d’actions, même panneau verre ;
- aucun CSS de post spécifique à ces pages ;
- les tests contractuels vérifient qu’aucune page ne redéfinit `.lkdv-post-*`.

---

## 5. Tokens et CSS

```css
:root {
  --account-canvas-bg: #cfd6c8;
  --account-canvas-image: url('/assets/images/account-bg.webp');
  --account-canvas-position: center 30%;
  --account-canvas-filter: brightness(1.1) saturate(1.05);

  --post-glass-bg: linear-gradient(180deg,
    rgba(255,255,255,.486),
    rgba(255,255,255,.384));
  --post-glass-blur: blur(25.2px) saturate(1.8) brightness(1.05);
  --post-glass-shadow:
    inset 0 1px 0 rgba(255,255,255,.95),
    inset 0 -1px 1px rgba(255,255,255,.4),
    0 0 0 .5px rgba(23,43,36,.08),
    0 8px 22px rgba(23,43,36,.1);

  --post-panel-top: 64px;
  --post-panel-content-top: 72px;
  --post-radius: 28px;
  --post-header-gap: 8px;
}
```

- Le fond est une couche pseudo `::before` fixe, `filter` appliqué à cette couche uniquement,
  `isolation: isolate` sur la coquille pour que le contenu reste au-dessus.
- Une seule feuille `post-system.css` ; plus de styles de panneau dans `community-feed.css`.
- `@supports not (backdrop-filter: blur(1px))` : fond blanc à 92 % en secours.
- `prefers-reduced-motion` : pas d’animation de panneau.
- `will-change: transform` uniquement pendant l’ouverture.

---

## 6. Comportement et accessibilité

- Header visible en permanence quand un panneau est ouvert.
- Top bar de la page visible (aucun overlay plein écran).
- `Escape` ferme le panneau ; swipe bas ferme ; swipe horizontal change de panneau.
- Focus : premier champ du panneau ; retour au bouton d’ouverture à la fermeture.
- Le panneau est `role="dialog"` `aria-modal="false"` (il ne bloque pas la top bar) ; le header
  reste focusable.
- Le texte garde le contraste du Compte ; pas de texte blanc sur verre clair.
- Les médias ont `loading="lazy"`, `decoding="async"`, dimensions explicites.

---

## 7. Performance

- Aucun nouvel asset : `account-bg.webp` est déjà chargée/cachée.
- Une seule couche de flou par panneau ouvert ; pas de blur sur les cartes fermées.
- Le panneau n’est monté qu’à l’ouverture (état `panel`).
- Pas de duplication d’image de fond : un seul pseudo-élément.
- Le socle partagé évite de charger deux systèmes de post.
- Objectif : aucune régression sur les budgets Compte/Carte définis dans
  `docs/communaute/RAPPORT-PERF-FINAL.md`.

---

## 8. Tests

### Unitaires
- `PostView` : adaptation `FeedPost` / `PostDetail` sans perte.
- `PostGlassPanel` : top par défaut 64 px ; top dynamique = bas du header + 8.
- `PostHeader` : `···` toujours présent, `aria-label` correct.
- Tokens : `--post-glass-bg`, `--post-glass-blur`, `--account-canvas-*` identiques aux valeurs Compte.

### Visuels
- 430 / 768 / 1440.
- Échantillon pixel du fond Communauté vs Compte (même image, même cadrage).
- Panneau ouvert : header visible, top bar visible, panneau à 64 px.
- Compte : `PostDrawer` inchangé.

### E2E
- Ouvrir commentaires et partage par bouton et swipe.
- Vérifier que la pillule auteur et `···` sont visibles et cliquables.
- Fermer par swipe bas / Échap.
- Commenter, répondre, liker, signaler, rechercher un destinataire, envoyer.
- Compte : mêmes actions dans le `PostDrawer`.

### Contrat futur
- Un test lit `src/features/posts/ui` et vérifie que Carnets/Clubs/Sorties n’ont pas de CSS
  `.lkdv-post-*` dupliqué.

---

## 9. Découpage

1. **Lot 1 — fond + verre + top 64** : tokens, fond Communauté, panneau verre, header préservé.
2. **Lot 2 — primitives** : `PostHeader`, `PostActions`, `PostOptions`, `PostSurface`.
3. **Lot 3 — panneaux partagés** : `PostConversationPane`, `PostSharePane` ; migration fil + Compte.
4. **Lot 4 — contrat futur** : `docs/communaute/POST-SYSTEM.md`, test contractuel, exemple Carnet/Club/Sortie.

Chaque lot est indépendamment testable et peut être déployé.

---

## 10. Décisions

| # | Décision | Valeur |
|---|---|---|
| D1 | Feed inline | **oui** (choix utilisateur) |
| D2 | Fond | image/cadrage/filtre/voile exacts du Compte |
| D3 | Verre | recette exacte de la carte Compte |
| D4 | Top du panneau | header mesuré + 8 px, défaut 64 px |
| D5 | Header | toujours visible ; top bar aussi |
| D6 | Titre/croix du panneau | aucun ; header du post = header |
| D7 | Futur | un seul `PostSurface` / `PostGlassPanel` pour Carnets/Clubs/Sorties |
| D8 | Données | aucune migration ; adaptateurs seulement |
| D9 | Modal | réservé au `PostDrawer` Compte ; pas de bascule du fil |

---

## 11. Hors périmètre

- Remplacer le fil par des modals.
- Nouveaux champs DB / API.
- Implémentation des pages Carnets/Clubs/Sorties dans ce lot (seulement le contrat).
- Refonte complète du runtime Compte.

---

## 12. Critères d’acceptation

- [ ] Le fond du fil Communauté est visuellement identique au fond du Compte.
- [ ] Le panneau commentaires/partage est translucide avec la recette verre du Compte.
- [ ] La pillule auteur et le `···` restent visibles quand le panneau est ouvert.
- [ ] La top bar de la page reste visible.
- [ ] Le contenu du panneau commence sous le header (≈ 72 px).
- [ ] Le post Compte et le post Communauté utilisent les mêmes composants.
- [ ] Le contrat futur est documenté et testé.
- [ ] Aucune régression des actions commentaires/partage ni des budgets performance.
