# 09 · Design : jetons, matières, icônes, animations, haptique

Valeurs extraites des générateurs de la maquette. Elles priment sur toute approximation. Les jetons existants de `src/styles/tokens.css` qui correspondent doivent être réutilisés (même nom si la valeur est identique ; sinon nouveau jeton `--xp-*`).

## 1. Jetons et recettes

| Nom | Valeur |
|---|---|
| `INK` | `#17402C` |
| `SAGE` | `#5B7F55` |
| `TEAL` | `#2F6F78` |
| `WARN` | `#B98A2E` |
| `BAD` | `#A8443A` |
| `MUT` | `#56665D` |
| `MUT2` | `#3F4F46` |
| `TXT` | `#172B24` |
| `GOOD` | `#3D7A52` |
| `FONT` | `-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display',Inter,system-ui,'Segoe UI',Roboto,sans-serif` |
| `BAR` | `background:linear-gradient(180deg,rgba(255,255,255,.52),rgba(255,255,255,.34) 55%,rgba(255,255,255,.44));-webkit-backdrop-filter:blur(8px) saturate(1.9) brightness(1.07);backdrop-filter:blur(8px) saturate(1.9) brightness(1.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 1px rgba(255,255,255,.45),inset 1px 0 1px rgba(255,255,255,.28),inset -1px 0 1px rgba(255,255,255,.28),inset 0 0 1` |
| `THUMB` | `background:linear-gradient(180deg,rgba(255,255,255,.66),rgba(255,255,255,.3));box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.07),0 2px 8px rgba(23,43,36,.08);border-radius:999px` |
| `PG` | `background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.16) 52%,rgba(255,255,255,.3)),rgba(150,186,142,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.4),inset 0 0 0 .6px rgba(255,255,255,.5),0 0 0 .6px rgba(23,64,44,.16),0 5px 14px rgba(23,64,44,.13);color:#17402C` |
| `INKBTN` | `background:linear-gradient(180deg,#24563C,#17402C);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 0 .5px rgba(23,64,44,.4),0 6px 16px rgba(23,64,44,.28);color:#fff` |
| `RBTN` | `background:rgba(255,255,255,.56);-webkit-backdrop-filter:blur(8px) saturate(1.9) brightness(1.07);backdrop-filter:blur(8px) saturate(1.9) brightness(1.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.1),0 4px 12px rgba(23,43,36,.12);color:#17402C` |
| `BLOCK` | `background:linear-gradient(180deg,rgba(255,255,255,.66),rgba(255,255,255,.5));box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 0 0 .5px rgba(23,43,36,.06),0 2px 8px rgba(23,43,36,.05);border-radius:16px` |

## 2. Icônes



Onglets (une icône constante par concept, table exacte de la maquette) :

| Onglet | Icône |
|---|---|
| Aperçu | `info` |
| Pour toi | `star` |
| Départs ouverts | `users` |
| Carnets du monde | `book` |
| Ton empreinte | `foot` |
| Calques du globe | `layers` |
| Régions | `map` |
| Carnets | `book` |
| Départs | `users` |
| Pratique | `bag` |
| Massifs | `mtn` |
| Randonnées | `hike` |
| Autour | `target` |
| Eau et refuges | `drop` |
| Amis | `users` |
| Accès | `hike` |
| Photos | `image` |
| Météo | `cloud` |
| État | `drop` |
| Trace | `route` |
| Points d’eau | `drop` |
| Conditions | `cloud` |
| Quand | `cal` |
| Équipage | `users` |
| Kit | `pack` |
| Partage | `share` |
| Direct | `pulse` |
| Tours | `repeat` |
| Cœur | `heart` |
| Sécurité | `shield` |
| Navigation | `nav` |
| Rivière | `waves` |
| Passages | `alert` |
| Infos | `info` |
| Règles | `shield` |
| Spot | `tent` |
| Nuit | `moon` |
| Avis | `msg` |
| Vue | `eye` |
| Lumière | `sun` |
| Détails | `alert` |
| Contourner | `route` |
| Y aller | `nav` |
| Parking | `pin` |
| Covoiturage | `users` |
| Position | `pin` |
| Sorties | `route` |
| Matériel | `pack` |
| Segment | `route` |
| Neige | `snow` |
| Itinéraire | `route` |
| Voie | `climb` |
| Topo | `map` |
| Cordée | `users` |
| Profil | `mtn` |
| Eau | `drop` |
| Balade | `walk` |
| Défis | `star` |
| Pauses | `house` |
| Ciel | `star` |
| Réveil | `clock` |

## 3. Typographie

Inter 400/500/600/700/800 (déjà chargée par l’app ; sinon Google Fonts). Titres tiroir 19/24 800 ; sous-titre 12,5/16 ; libellés onglets 12,5 650 ; métriques live 44 800 tabulaires (`font-variant-numeric: tabular-nums`).

## 4. Géométrie

Feuille : rayon 30 px haut, poignée 40×4. Capsule d’onglets 48 px, lentille blanche qui glisse (spring 0,38 s). Boutons ronds 40 px (cible 44). Tuiles 16 px de rayon, métriques 14 px. Marges latérales 12 px. Barre basse : composant existant.

## 5. Micro-animations

| Élément | Animation |
|---|---|
| Lentille d’onglet | spring (stiffness 420, damping 34) |
| Cran de feuille | spring (stiffness 320, damping 32), suit le doigt |
| Apparition contenu | fondu 0,35 s, délai 0,12 s |
| Repère | fondu 0,45 s, échelle 0,92→1 |
| Position | halo pulsé 2,2 s |
| Compte à rebours | échelle 1,4→1 + fondu par chiffre, 1 s |
| Toast | glisse de -8 px + fondu 0,3 s, reste 2,7 s |
| SOS maintenu | anneau qui se remplit 1,5 s |
| Stop maintenu | anneau 0,8 s |
| Hors-trace | carte du haut passe à l’ambre en 0,4 s |
Toutes désactivées ou réduites à un fondu avec `prefers-reduced-motion`.

## 6. Haptique (`state/haptics.ts`)

| Événement | Retour |
|---|---|
| Changement d’onglet, mini-sélecteur, boussole | selection |
| Ouverture tiroir, toucher repère | impact light |
| Changement de niveau | impact medium |
| Chiffre du compte à rebours | impact rigid |
| Départ de l’activité, sortie enregistrée, retour sur la trace | notification success |
| Hors itinéraire, SOS armé | notification warning |
| SOS déclenché | notification error + impact heavy |
Jamais plus d’un retour par 80 ms.

## 7. Thème sombre (exception Explorer)

Activé si le système est en sombre : fond carte assombri (style OpenFreeMap sombre), verre `rgba(28,36,32,.72)` + bordure `rgba(255,255,255,.12)`, texte `#EEF2EE`. Référence : `maquette/captures/Nuit.png`.