# P2/P5 — Téléphones, écusson, captures (ui-builder) · état au 12/11

## 1. Chaîne d'incrustation — PROUVÉE sur plaques d'essai et sur 2 vraies images

- `tools/phone/make_plates.py` : plaques d'essai 1920×1080 avec vérité terrain (rendu **projectif numpy**, pas three.js — choix de budget) : `front`, `front-white`, `flat`, `macro` (2 coins), `strap`. Planche : `qa/snapshots/phone/plaques-essai.jpg`.
- `tools/phone/phonekey.py` : masque vert (ou blanc), bords contre le cadre noir seulement (les doigts sont exclus), quadrilatère d'aire max sur l'enveloppe, 4 côtés ajustés par moindres carrés hors coins arrondis, coins = intersections ; rayon, flou de mise au point (étalonné), lumière ambiante ; plaque percée RGBA, démélange des bords + dé-vert limité aux abords de l'écran (les verts de la scène restent) ; `--corners` manuel ; alertes `ecran-coupe-par-le-cadre`, `coins-hors-cadre`, `coins-extrapoles`, `cote-peu-visible`.
- Erreur des coins contre la vérité (commande lancée, px) : front 0,04/0,04/0,34/0,06 · flat ≤ 0,10 · strap ≤ 0,06 · macro 0,14/0,15 (coins visibles), **38,6/54,9 pour les deux coins hors cadre extrapolés** · blanc ~1,4–1,7. Flou mesuré/vrai : 0,70/0,7 · 1,14/1,1 · 1,62/1,6 · 0,66/0,6. Pixels verts opaques résiduels : 0 sur toutes les plaques.
- `phone-lab/lib/phone/phone.js` + `phone.css` : capture 1290×2796 SOUS la plaque percée par `matrix3d` (homographie), coins arrondis, teinte de scène (multiplication), niveau, flou = netteté ⊕ vitesse du plan, reflet qui glisse avec la caméra, fondus d'états et défilement (fonctions du temps). Le défilement (E1) est codé mais **non démontré** (pas de capture haute).
- `tools/phone/build-lab.mjs` génère `phone-lab/` : 7 scènes de 1,5 s (5 plaques d'essai + img40 + img43), poussée + roulis. `npx hyperframes lint` : **0 erreur, 0 avertissement** ; `check --json` (7 scènes, avec img40/img43, relancé le 12/11) : ok, 0 erreur, 0 avertissement.
- Preuves regardées (début/milieu/fin, `--zoom` sur l'écran) : `qa/snapshots/phone/lab-{front,flat,macro,strap,front-white}-debut-milieu-fin.jpg`, `lab-front-pouce-zoom.jpg`, `reel-img40-{plan,zoom}-debut-milieu-fin.jpg`, `reel-img43-{plan,zoom}-debut-milieu-fin.jpg`, `reel-img43-frange-avant-apres.jpg`.

## 2. Détection sur les 11 vraies images (sorties lourdes dans `qa/tmp/phone/`, ignoré par git)

Planche regardée : `qa/snapshots/phone/reel-detection-11-plaques.jpg` (coins tracés + plaque percée sur magenta).

| Image | Écran | 4 coins | Couleur | Doigts devant | Remarque |
|---|---|---|---|---|---|
| img07 | oui | oui (BR sous le pouce, déduit des côtés) | vert | pouce gardé | le « défaut » de réception (coin masqué) est géré |
| img40 | oui | oui | vert | index gardé | incrustation E2 propre (preuve ci-dessus) |
| img41 | oui | oui (BR sous le pouce) | vert | pouce gardé | |
| img42 | oui | oui | vert, **petite encoche + 4 croix sombres dans l'écran** | — | les croix restent opaques sur l'écran : à retoucher (ou nouvelle image) ; écran petit (96×192 px) |
| img43 | oui | **2** (haut) ; bas extrapolé | vert | pouce gardé, frange corrigée | montre le **HAUT** de l'écran : le bouton « Commander » (en bas de l'app) ne peut pas tomber sous le pouce → refaire img43 avec les coins du BAS visibles, ou accepter de voir le sac |
| img18 | oui | oui | vert | — | |
| img46 | oui | oui | vert | — | |
| img22 | oui | oui | vert | mains gardées | téléphone **à l'horizontale** : l'ordre des coins donne un écran tourné (normal pour l'appareil photo ; à fixer par `--corners` selon E9) |
| img27 | oui | oui | vert | — | |
| img37 | oui | oui (BR sous le pouce) | vert | pouce gardé | |
| img38 | oui | oui | vert | — | |

## 3. Écusson du sac — ÉCRIT, NON PROUVÉ

`tools/badge/badge.py` (localisation du carré sombre, coins ajustés, texture tirée du rendu à plat `assets/ref/lkdv-one-45-0.png`, homographie, niveaux, flou et grain du plan ; `selftest` avec vérité terrain sur `lkdv-one-45-40`). **Reporté** : jamais exécuté (il manque `tools/badge/ref-near.json` avec le point approché de l'écusson ; img44 : écusson vers (980, 490)). Aucune preuve avant/après.

## 4. Captures (détail : `trailer/SCREENS.md`)

Capturés (1290×2796 vérifié) : E02a–d, E03, E05a, E05b, E06. Non capturés : E1, E4, E7–E13 (compte rempli, carnet avec img09, fonds de carte bloqués ici, publication). Défauts réels de l'app vus : « Dolomites » → « Dolomitenblick » (Renon) sans itinéraire ; bouton réel « Commander · 5 pièces · 471 € » ; pas de « Prêté par Sami » ni « Occasion » dans Kit Studio.

## 5. Question groupée pour Tony

> Pour capturer E1, E4, E5 (prêt/location/total qui fond), E7–E13 avec de vrais écrans : **(1)** crées-tu un compte de démonstration dédié au trailer (ex. « Léa », e-mail jetable), ou nous autorises-tu à le créer ? **(2)** Peut-on y semer les données par script sur l'aperçu (base de production) : voyage « Dolomites » avec itinéraire (Sorapis, Tre Cime, Seceda), participants Sami/Inès/Tom (trois comptes ou places nommées), kit avec objets « En prêt », « À louer », « À acheter », un carnet d'un autre voyageur contenant img09, le carnet de Léa avec la photo du lac et un retour « Essentiel » sur le réchaud, et une publication visible dans le fil ? **(3)** Acceptes-tu que les écrans cartographiques (E4, E7, E8, E10) soient capturés depuis ta machine (ici les fonds `tiles.openfreemap.org` sont bloqués), ou ajoutes-tu cet hôte ?
>
> **Recommandation** : un compte dédié créé par nous, données semées par un script relisible dans `trailer/tools/capture/seed/` (supprimable d'un geste), sur l'aperçu ; on évite le compte démo partagé (d'autres y écrivent, données de marque « F.C. Barcelona » visibles). Corriger d'abord dans l'app la lecture « Dolomites » → « Dolomitenblick », sinon E2/E4 montreront ce défaut. Côté images : refaire img43 (coins du bas visibles) et nettoyer les croix de img42.

## 6. Reporté / faible

Écusson (non exécuté) ; 9:16 non traité ; défilement E1 non démontré ; plaques d'essai non three.js ; flou de mouvement = flou isotrope (pas directionnel) ; repli blanc moins précis (≈1,5 px) ; les plaques percées des vraies images sont copiées dans `phone-lab/assets/plates/` (≈3,4 Mo chacune, dérivées des images de Tony : à ignorer dans git par l'orchestrateur, `.gitignore` hors de mon périmètre).
