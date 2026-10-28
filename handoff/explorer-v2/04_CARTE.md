# 04 · Carte : hiérarchie, tracés, caméra, mode suivi

Planches de référence : `maquette/captures/{Hierarchie,Traces,Camera}.png`.

## 1. Hiérarchie d’affichage (`map/hierarchy.ts`)
| Priorité | Monde (z<3) | Pays (3–6) | Région (6–10) | Lieu (≥10) | En activité |
|---|---|---|---|---|---|
| P0 toujours | Toi, pays touché | Toi, région touchée | Toi, massif touché | Toi, point ouvert, dangers | Toi, itinéraire, prochain repère, dangers |
| P1 | Pays visités, départs ouverts | Spots phares | Massifs, GR®, grandes villes | Sommets majeurs, eau, refuges | Eau à venir, refuges, amis |
| P2 | Bonne saison | Villes, parcs | Parcs, neige | Randonnées, amis | Bivouac de nuit |
| P3 zoom proche | Noms de pays | Capitale | Villes secondaires | Belvédères, bivouac, accès (z ≥ 13) | masqué |

Règles : collision → priorité haute gagne, puis la plus proche de toi (`symbol-sort-key` = priorité×1e6 + distance) ; rien sous le tiroir, l’Island ou les boutons (padding de caméra = hauteur réelle du tiroir) ; ≤ 6 repères / 100×100 px sinon pastille chiffrée (clustering) ; +1 niveau à < 2 km ; un repère perd son étiquette avant de disparaître ; apparition/disparition en fondu 0,45 s ; ski de rando garde les sommets ; bivouac de nuit garde les spots ; le profil de bienvenue réordonne P1/P2 (famille : eau, aires, sentiers faciles d’abord).

## 2. Styles de tracés (couches MapLibre `line`)
| Style | Paint |
|---|---|
| Itinéraire prévu | casing `#FFFFFF` 7 px + ligne `#17402C` 4 px, `line-cap: round`, toujours au-dessus |
| Déjà parcouru | `#C9D3CC` 4 px (segment début→position via `line-gradient` + `lineMetrics:true`) |
| Ta position | cercle blanc 9 px, contour `#17402C` 2,4 px, halo pulsé 2,2 s, cône de cap |
| Sens de marche | `symbol` chevron blanc, `symbol-placement: line`, `symbol-spacing: 60`, partie restante seulement |
| GR® | casing blanc 6 px + `#C0392B` 3,4 px `line-dasharray [2,1.4]` |
| PR | casing blanc + `#E0B33A` dash |
| Variante | `#5B7F55` 2,6 px dash `[1.2,1]` |
| Trace d’un ami | couleur de son avatar, opacité 0,7, avatar en tête |
| Eau (kayak) | casing blanc + `#2F6F78` 3,4 px |
| Neige/névé | `#7FB3C8` pointillé rond |
| Danger/fermé | `line-pattern` hachures `#A8443A` + icône alerte au milieu |
| Survol | `#E9C46A` qui se dessine en 2,8 s (`line-trim-offset` animé) |
| Pente (option calque) | `line-gradient` < 8 % `#7FA27A`, 8–15 `#D8B25A`, 15–25 `#C27A4A`, > 25 `#A8443A` |

## 3. Mouvements de caméra (`map/camera.ts`)
Tout mouvement est interrompu par le premier geste (`movestart` d’origine utilisateur) ; avec `prefers-reduced-motion` : `jumpTo` + fondu 200 ms. Le `padding` intègre toujours le tiroir.
| Mouvement | Déclencheur | Paramètres |
|---|---|---|
| Plongée entre niveaux | toucher pays/région/lieu, molette, pincement, fil d’Ariane | `flyTo` 1,3 s, courbe (.65,0,.3,1), centre = point touché ; niveau ↔ zoom : monde 1,6 · pays 4,8 · région 7,2 · lieu 12 |
| Survol de trace | mini « Survol 3D » | `freeCameraOptions` le long de la trace lissée sur 200 m, pitch 55°, 9 s (durée ∝ distance, max 20 s), regard 300 m devant, profil synchronisé |
| Orbite de sommet | ouverture d’un sommet | pitch 45°, `rotateTo` bouclé 360° en 40 s, rayon selon proéminence, pause au toucher, reprise après 6 s sans geste |
| Révélation | refuge, eau, danger, ami, bivouac, belvédère, accès | `jumpTo` serré (zoom +1,7, pitch 0) puis `easeTo` 1,8 s (.3,.1,.15,1) vers pitch 45° |
| Suivi en activité | démarrage | cap en haut (`bearing` = cap GPS lissé), pitch 60°, zoom par vitesse (marche 15,5 · course 15 · vélo 14,2 · kayak 14,6 · ski 14,8), utilisateur au tiers bas (`padding.top` grand), `easeTo` 900 ms à chaque fix |
| Vue d’ensemble | bilan, double toucher en activité | `fitBounds` trace, pitch 0, marges = tiroir + Island, 0,9 s |

Bouton boussole (en activité, à la place des calques) : bascule nord en haut ↔ cap en haut, haptique sélection.

## 4. Mode suivi (activité)
- Chrome masqué : recherche, fil d’Ariane, calques ; affichés : carte « prochain repère » (cap, distance, nom), boussole, bouton SOS rouge (maintien 1,5 s).
- Barre basse réduite à une pastille (sport, chrono, distance) + pause/drapeau/stop (stop = maintien 0,8 s).
- Hors-itinéraire : distance à la trace > 40 m pendant > 15 s (`get_route_deviation` serveur ou worker local) → carte du haut ambre « Hors itinéraire · 80 m », flèche de retour, haptique avertissement ; retour < 25 m → succès.
- Positions : filtre de précision (> 30 m ignorée), lissage Kalman simple, envoi par lots de 10 s, stockage local si hors ligne (`offline_sync_operations`).
- Arrière-plan : démarrage Live Activity ; retour app : fin d’affichage Island.
