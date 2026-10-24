# Performance — Compte, drawers, carte : rapport final

**Date :** 2026-10-24
**Branche :** `perf/phase1`
**Dernier commit :** `25dc1f70`
**Production :** https://kitduvoyageur-1783951966810-o7161cvgr.vercel.app
**Alias :** `koosmoweb.fr`

Mesures labo : Chromium, viewport 430×932, cache désactivé, consentement cookies pré-rempli
pour éviter que la bannière ne devienne l’élément LCP. Les chiffres ne sont pas du RUM.

## Résultats

| Surface | Avant | Après |
|---|---:|---:|
| Compte — transfert | 3,03 MB | **1,37 MB** |
| Compte — chunk page | 242 KB | **56 KB** |
| Compte — LCP | 3,03 s | **1,57 s** |
| Compte — TBT | 1,51 s | **0,21 s** |
| Carte — transfert initial | 4,11 MB | **784 KB** |
| Carte — requêtes initiales | 120 | **46** |
| Carte — LCP initial | 1,54–2,59 s | **0,69 s** |
| Carte — JS interactif | chargé d’emblée | **chargé au tap** (+901 KB) |
| Carte — chunk Compte | 242 KB | **0** |
| og-image | 721 KB | **86 KB** |
| app_logo | 553 KB | **34 KB** |

## Changements livrés

### Compte
- Fond **base64** de la maquette extrait vers `account-bg.webp`.
- `<aside class="notes">` de démonstration supprimé du HTML injecté.
- Calque `.lkv-app-background` redondant supprimé sur `/compte` (221 KB), visuel identique.
- `og-image.png` recadré 1200×630 et compressé ; `app_logo.png` optimisé.
- CSS de la maquette Compte extrait vers une feuille **route-scopée** : le JS ne porte plus 216 KB de CSS inline ; visuel identique.
- Prefetch de route de la bottom nav désactivé : le chunk Compte ne part plus sur la carte.
- Carte du Compte différée (fallback 8 s au lieu de 2,8 s).
- Slots du drawer Profil en imports dynamiques : seul le slot consulté est téléchargé.

### Carte
- Poster statique local `carte-poster.webp` (50 KB) : rendu immédiat, LCP **0,69 s**.
- La carte interactive n’est chargée **qu’au tap** sur « Explorer la carte ».
- Fond global supprimé sur `/carte-interactive` (221 KB).
- Prefetch des 5 routes supprimé ; chunk Compte absent.
- Aucun canvas Leaflet avant activation (0 → 1 après tap).

### Vérifications
- Build de production : OK.
- `/compte`, `/carte-interactive`, `/communaute` : **200**, **0 erreur console**.
- Capture Compte avant/après identique (hash identique).
- Carte initiale : poster + CTA + bottom nav ; après tap : filtres, zoom, carte interactive.

## Reliquat structurel

Le quick win est terminé. Le reste demande une refonte, pas un patch :

1. **Supprimer `COMPTE_V8_HTML` et le runtime `innerHTML`** ; migrer le Compte en React/RSC.
2. **Découper `accountBootstrap`** (20+ requêtes) en noyau + endpoints par drawer.
3. **Carte interactive** : le chargement à l’intention est en place ; le moteur Leaflet complet
   reste à alléger/optimiser (tuiles, cache, workers).
4. **CSS/paint** : sortir les CSS inline, réduire les grands `backdrop-filter`.
5. **Sécurité** : CSP en Report-Only par défaut, fallbacks `SERVICE_ROLE || ANON` à supprimer,
   restrictions ArcGIS à vérifier.

## Sécurité — état

- Aucun secret ajouté ; aucune migration.
- RLS audience `community_posts` (club/abonnés) conservée.
- APIs Compte/Carte protégées par `requireUser` ou bootstrap privé.
- CSP toujours en Report-Only ; passage en enforce à planifier avec nonce.
- Les fallbacks service-role/anon de `checkout`/`seed`/`pays` restent à durcir.
