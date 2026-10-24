# Système de post partagé — contrat

**Décision :** le fil Communauté garde des **cartes inline**. Le post Compte, le fil
Communauté et les futurs posts Carnets / Clubs / Sorties partagent le même socle visuel.

## Ce qui est partagé

- `src/features/posts/ui/post-system.css` : fond Compte, verre Compte, top du panneau,
  rayons et ombres.
- `src/features/posts/ui/PostGlassPanel.tsx` : panneau commentaires/partage, header préservé,
  top dynamique, swipe horizontal et fermeture verticale.
- `src/styles/community-feed.css` : le fil utilise le fond `account-bg.webp`, le header
  transparent et le panneau verre.

## Valeurs intangibles

| Token | Valeur |
|---|---|
| Fond | `account-bg.webp`, base `#cfd6c8`, `center 30%`, voile Compte |
| Verre | `linear-gradient(180deg, rgba(255,255,255,.486), rgba(255,255,255,.384))` |
| Flou | `blur(25.2px) saturate(1.8) brightness(1.05)` |
| Top panneau | bas du header + 8 px ; défaut 64 px |
| Contenu | 8 px sous le panneau |

## Règles

1. Le header du post (pillule auteur + `···`) et la top bar ne sont **jamais** recouverts.
2. Le panneau commence **sous** le header ; le contenu est scrollable.
3. Aucun titre ni croix dans le panneau ; le swipe bas ferme, le swipe horizontal bascule
   commentaires ↔ partage.
4. Une seule couche de flou par panneau ouvert.
5. Les pages Carnets / Clubs / Sorties ne doivent pas recréer de CSS `.lkdv-post-*` :
   elles réutilisent `PostGlassPanel` et `post-system.css`.

## Exemple futur

```tsx
<PostGlassPanel
  side="comments"
  headerRef={headerRef}
  onClose={() => setPanel(null)}
  onSwitch={setPanel}
>
  <PostConversationPane view={view} />
</PostGlassPanel>
```

La migration complète `PostSurface` / `PostConversationPane` / `PostSharePane` est décrite
dans `docs/superpowers/specs/2026-10-24-communaute-post-system-design.md` (lots 2-4).
