# MOTION.md — charte de mouvement des vidéos LKDV

À lire avant d'animer quoi que ce soit dans `video/`. Les valeurs viennent de `src/styles/tokens.css`, `DESIGN_SYSTEM.md`, `docs/compas/DESIGN_REFERENCE.md` et du trailer « Une phrase suffit » (`video/trailer-lkdv`, qui sert de référence).

## Couleurs (jamais de couleur littérale nouvelle)

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Forest | `#17402C` (`--lkv-forest-900`) | encre sur fond clair, boutons pleins, tracé de parcours, sol de secours |
| Sage | `#5B7F55` (`--lkv-sage-500`) | barres de progression, pastilles, petites capitales |
| Stone | `#FAF8F5` (`--lkv-stone-50`) | texte sur photo, fond du Kit Studio, bouton d'appel |
| Encre des ombres | `rgba(11,31,23,α)` | toutes les ombres et voiles ; jamais `rgba(0,0,0)` |
| Alerte | `#A63D2F` | objet vital manquant, uniquement |

Interdits : `#E4501C`, `#1C2620`, `#A3C4A3`, `#0B1F17` en aplat, `#2D6B4A` dans du neuf ; les dégradés violets ; les néons.

## Matière

- **Verre** (Liquid Glass v8) : `rgba(250,248,245,0.66–0.84)`, `backdrop-filter: blur(24px) saturate(1.5)`, bord 1 px `rgba(255,255,255,0.85)`, ombre `0 24px 60px rgba(11,31,23,0.22)`. Rayons : 28 (carte), 32 (grande carte), 36–44 (tiroir), 999 (pastille).
- **Photo** : les images de la marque (`public/assets/images/*`) en plein cadre ; voile forest de 28 à 72 % du côté du texte, jamais de vignette noire.
- **Produit** : vraie UI uniquement (captures réelles, ou reconstruction avec les libellés et chiffres exacts) ; jamais d'interface inclinée en 3D ; les sacs et modules viennent des `.glb` publiés (règle « maillages réels uniquement »).

## Typographie

- Titres : Inter 800, 80 à 132 px en 1080p (7 à 12 % de la hauteur), interlettrage −2,5 à −3,5 %, deux lignes au plus.
- Un seul mot accentué par titre : italique EB Garamond 500 (substitut libre de Georgia), stone sur photo, forest sur verre.
- Petites capitales : Inter 700, 22 à 30 px, interlettrage +14 %.
- Texte à lire ≥ 28 px en 1080p (≥ 40 px en 1080×1920).

## Mouvement

| Rôle | Courbe | Durée |
| --- | --- | --- |
| Arrivée | `expo.out` (≈ `--lkv-ease-out` `cubic-bezier(0.16,1,0.3,1)`) | 0,4–0,8 s |
| Caméra, couleur, carte qui glisse | `power2.inOut` | 0,5–0,7 s |
| Sortie, zoom traversant | `power3.in` | 0,3–0,36 s (40 % plus court que l'entrée) |
| Ressort (puce, module, coche) | `back.out(1.2–1.8)` ≈ amortissement 0,8 | 0,35–0,7 s, sur la position ou l'échelle seulement |
| Titre | mot à mot, flou 6 → 0 px, 0,07 s d'écart, sans déplacement | posé puis immobile |
| Changement de contenu sur une même surface | flou 8 px, 0,13–0,2 s | — |

Transitions permises (3 à 5 par film, chacune causée par un objet) : la carte photo qui devient le monde (`clip-path`), le bouton qui devient le monde, l'iris depuis le clic, le fouet horizontal, le raccord sur le téléphone immobile, la plongée dans l'écran.

Interdits : tout qui glisse vers le haut en fondu, titres qui dérivent, boucles de « respiration », particules, halos, rebonds sur l'interface, logo docké en coin, trois cartes en rangée.

## Son

- Musique avant chorégraphie ; coupes sur les mesures (128 BPM : 0,469 s le temps, 1,875 s la mesure).
- Effets rares et causés (clic, frappe, pop, whoosh, montée + impact une seule fois sous le badge).
- Mixage final : −14 LUFS intégrés, crête vraie ≤ −1 dBTP. Attribution des musiques CC BY dans la description.

## Formats

| Sortie | Taille | Zone sûre |
| --- | --- | --- |
| Film 16:9 | 1920×1080, 30 i/s | 90 % action, 80 % titres |
| Réseaux 9:16 | 1080×1920, 30 i/s | textes entre y 240 et y 1420, rien dans les 120 px de droite (`reel-export`) |
| Encodage réseaux | H.264, yuv420p, bt709, plage limitée, `+faststart`, AAC | — |
