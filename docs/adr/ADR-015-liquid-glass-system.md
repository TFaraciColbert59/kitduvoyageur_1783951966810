# ADR-015 — Système Liquid Glass LKDV

**Date :** 2026-09-18  
**Statut :** Accepté  
**Décideurs :** Équipe LKDV  

## Contexte

LKDV est une application mobile-first (Next.js 15 + React 19 + Capacitor) ciblant iOS et Android. La charte visuelle Apple-like demande un verre translucide cohérent sur toutes les surfaces. Deux bibliothèques tierces ont été évaluées : `liquid-glass-react` (rdev, ~6 163 ⭐) et `@samasante/liquid-glass` (0.1.1, ~561 ⭐).

## Décision

### Niveau Standard — CSS canonique (production)

Toutes les surfaces utilisent la classe `.glass` définie dans `src/styles/liquid-glass.css` et les tokens de `src/styles/tokens.css`. Aucune bibliothèque JS pour la réfraction en production standard.

**Raisons :**
- Zéro JS runtime, SSR-safe, compatible RSC
- `backdrop-filter` natif avec fallback `@supports`
- Contrôle total des tokens (blur, saturation, shadow, radius)
- Fonctionne sur Chrome Android, Safari iOS, Firefox

### Niveau Premium — `liquid-glass-react` (rdev, opt-in)

Activé via `NEXT_PUBLIC_GLASS_PREMIUM=true` uniquement. Disponible dans le Glass Lab (`/dev/glass`) pour prototype et validation. Ciblé sur 3 surfaces prioritaires max : modales, tiroirs, barre de navigation flottante.

**Raisons du choix rdev vs samasante :**
- rdev : réfraction SVG-filter + déplacement + aberration chromatique, meilleur effet visuel
- samasante : plus léger, meilleur Safari/iOS, zéro dépendance
- Les deux sont devDependencies ; rdev est le prototype de référence

**Contraintes premium :**
- Jamais sur plus de 3 surfaces simultanées (GPU)
- Désactivé si `prefers-reduced-motion`, `prefers-reduced-transparency`, ou appareil faible (≤4 CPUs / ≤4 GB)
- Toujours `dynamic()` + `ssr: false` — jamais dans RSC
- L'arbre DOM accessible reste dans `GlassCard` standard ; rdev est `aria-hidden` + `inert`

## Règles anti-régression

1. **Blur imbriqué interdit** : `liquid-glass.css` ligne 702 supprime `backdrop-filter` sur toute sous-surface à l'intérieur d'une surface glass. Ne jamais contourner.
2. **Tokens exclusifs** : Aucune valeur optique inline dans les composants. Tout vient de `tokens.css`.
3. **Variantes canoniques** : `base | elevated | interactive | selected | overlay | critical`. Pas de variante par route.
4. **Fallbacks obligatoires** :
   - `@supports not (backdrop-filter: blur(1px))` → `var(--glass-solid)` opaque
   - `prefers-reduced-transparency` → fond solide
   - `forced-colors: active` → Canvas / CanvasText
   - `data-glass-effects='reduced'` → mode sobre, aucun blur

## Comparaison bibliothèques

| Critère | rdev 1.1.1 | samasante 0.1.1 | CSS natif |
|---------|-----------|----------------|----------|
| Étoiles GitHub | ~6 163 | ~561 | N/A |
| Réfraction | ✅ SVG filter | ✅ CSS filter | ❌ |
| Safari iOS | ⚠️ Partiel | ✅ Excellent | ✅ |
| Firefox | ⚠️ Partiel | ✅ | ✅ |
| SSR-safe | ❌ client only | ❌ client only | ✅ |
| Taille | ~45 kB | ~8 kB | 0 kB |
| GPU impact | Modéré | Faible | Minimal |

## Conséquences

- ✅ Tous les composants partagent les mêmes tokens, bordures et états
- ✅ Aucune régression SSR / RSC
- ✅ Fallbacks a11y automatiques
- ⚠️ La réfraction avancée reste prototype jusqu'à validation sur matériel iOS réel
- ⚠️ Safari et Firefox voient un effet partiel avec rdev — acceptable pour surfaces non critiques
