# Fiche carnet — trois points (26 octobre 2026)

Branche `cf/carnet-latest`, worktree `lkdv-cf-carnet2`, dev `localhost:4011`.
Carnet témoin : `9ba890ca-e071-5ab8-8624-6bd8a471a6c1` (Islande, public).
Carnet porteur de trace : `6c532f88-640d-524b-bb5e-6fa05ea62054` (Vercors, public).

## 1. Le `···` remonte dans la barre du haut

- Ordre mesuré de `.ckp-top-actions` : `Créer`, `Notifications, N non lues`, `Plus d’options` (dernier).
- La loupe a laissé sa place : plus aucun bouton `Rechercher` dans la barre.
- Le menu garde ses entrées et son comportement (Enregistrer / Partager / Copier le lien /
  Gérer le carnet pour le propriétaire / Signaler) ; seule son ancre change.
- Le sélecteur passe de 7 à 5 segments : `♥ J’aime`, `💬 Commenter`, `🔖 Enregistrer`,
  `▦ Posts`, `🗺 Parcours`. Largeur de capsule : 220,5 px (contre 307,5).

## 2. Lentille du sélecteur

CSS (`.ckp-card-foot > .ckp-th`) : 41,5 × 25, rayon 999, inset 2,5, fond `#fff`,
`0 1px 3px rgba(23,43,36,.18)` + `0 0 0 .5px rgba(23,43,36,.06)`,
`translateX(calc(var(--i) * (41.5px + 2px)))`, `transform 220ms cubic-bezier(.22,1,.36,1)`.
Aucune transition sur la largeur ni l'opacité. `prefers-reduced-motion` → `transition: none`
(vérifié : `transitionProperty: none`).

| Mesure | Valeur |
|---|---|
| lentille sur Posts | x 320,5 / y 551,5 / 41,5 × 25 |
| segment Posts | x 320,5 / y 551,5 / 41,5 × 25 |
| delta alignement | 0 / 0 / 0 / 0 px |
| après clic Parcours | x 364 — delta 0 |
| mi-transition (110 ms) | `translateX(172.32px)`, largeur 41,5, dans la capsule |
| pages sans segment (Étapes) | `data-off=true`, `opacity: 0`, aucun segment actif |

## 3. Trace 3D

### Diagnostic

1. `hike_sessions` pour `9ba890ca…` : **0 ligne**. `carnets.map_points` = `[]`, `groupe_id` = `NULL`.
   Aucune trace n'existe en base pour ce carnet — ni en Islande (requête bbox 62,5–66,8 N /
   −24,6…−13 E : 0 ligne). L'état vide est donc exact.
2. **La RLS ne bloque pas** : la policy `hike_sessions_select_owner_or_public_carnet`
   (SELECT, rôle public) autorise la lecture anonyme des sorties d'un carnet public, et
   `anon` a bien `SELECT` sur la table. Preuve REST à la clé anon :
   `GET /rest/v1/hike_sessions?carnet_id=eq.6c532f88…` → 200 avec la géométrie ;
   `?carnet_id=eq.9ba890ca…` → `[]`.
3. **Deux vrais bugs de code**, corrigés :
   - `getCarnetDetail` prenait la **dernière** sortie (`order started_at desc limit 1`) :
     sur le Vercors, cette sortie n'a pas de GPS, donc `detail.trace` restait `null`
     alors que 3 traces existaient. → `pickCarnetTrace` choisit la sortie la plus récente
     **qui porte une trace** (sans toucher aux statistiques, qui restent celles de la
     dernière sortie).
   - `CarnetMapCard` passait `authState="guest"` : `CompteMap` n'interrogeait aucune donnée
     et affichait « Connecte-toi pour voir ta carte » ; le tracé du carnet n'était **jamais**
     dessiné, même pour le propriétaire.

### Décision d'accès

Aucun client à privilèges élevés, aucune policy ajoutée : la lecture serveur avec le client
à cookies (donc la RLS) suffit et a été prouvée à la clé anon. Le carnet public est l'unité
de publication : sa trace est publique par conception. Risque résiduel signalé :
`hike_sessions.visibility='private'` n'est pas filtré par la policy — une sortie marquée
privée reste lisible si elle est rattachée à un carnet public. Non corrigé ici (hors
périmètre, changer la policy casserait la carte de ces carnets) ; à arbitrer.

### Rendu

`CompteMap` reçoit `variant="carnet"` + `trace` : source `compte-carnet-trace`, trois couches
(liseré blanc 6 px, halo `#5B7F55` 7 px flouté, ligne `#17402C` 3 px), cadrage `fitBounds`
avec `pitch: 45` (même inclinaison que la carte d'une sortie du Compte), aucun appel
`/api/compte/map`, aucun état « compte ». Sans trace : état vide honnête
« Aucun tracé enregistré pour ce carnet. ».

Mesures Vercors : `data-map-variant=carnet`, `data-map-trace=true`, 73 points dessinés
(trace simplifiée), `pitch 45`, zoom 7,68, centre 45,093 / 5,492, trois couches `visible`.
Mini-tracé de la couverture : 3 691 points (trace brute).

## Mesures de mise en page

| Viewport | scrollHeight = innerHeight | débordement X | capsule |
|---|---|---|---|
| 430 × 932 | 932 = 932 | non | x 187,5 · 220,5 × 30 |
| 768 × 1024 | 1024 = 1024 | non | x 356,5 · 220,5 × 30 |
| 1440 × 900 | 900 = 900 | non | x 692,5 · 220,5 × 30 |

## Captures (`docs/audit/carnet-2026-10-26/`)

- `avant-430.png`, `avant-selecteur-x3.png`, `avant-topbar-x3.png`
- `apres-430.png`, `apres-768.png`, `apres-1440.png`
- `apres-topbar-x3.png` — `···` en dernière position, loupe partie
- `apres-selecteur-posts-x3.png`, `apres-selecteur-parcours-x3.png`
- `apres-selecteur-mid-transition-x3.png` (gel à 110 ms), `…-mid-60ms-x3.png`, `…-mid-110ms-x3.png`
- `apres-selecteur-sans-segment-x3.png` (aucune lentille)
- `apres-menu-x3.png` (menu ancré sous le `···`)
- `apres-drawer-share-430.png` (drawers inchangés, sous la barre)
- `apres-carte-trace-3d-x3.png`, `apres-carte-trace-3d-x2.png`, `apres-vercors-430.png`
- `diff-430.png` (zones modifiées : sélecteur y 540-580, carte y 740-880)
