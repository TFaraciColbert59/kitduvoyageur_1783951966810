# PARITÉ · Explorer v2

Comparaison écran par écran entre la maquette (`handoff/explorer-v2/maquette/captures/<Ecran>.png`,
390×844) et le rendu réel (`docs/explorer-v2/preuves/screens/<Ecran>.png`, 390×844).
Les paires assemblées sont écrites par `node scripts/explorer-v2/capture-scenes.mjs`
dans `docs/explorer-v2/parite/<Ecran>.png`. **12 paires sont versionnées**
(Monde, Pays, Region, Lieu, Sommet, Eau, Rando, Course, Nuit, Bienvenue,
Calques, Refuge) pour ne pas alourdir le dépôt ; les 29 autres se régénèrent
en une commande :

```bash
node scripts/explorer-v2/capture-scenes.mjs --base=http://localhost:4028
```

Jugement sur : structure, onglets et boutons, hiérarchie, jetons de couleur,
éléments en plus ou en moins. Une donnée absente en base est **masquée** et
remplacée par l'état vide prévu : c'est conforme à la règle « zéro donnée
inventée » et n'est pas compté comme un écart de structure.

## Légende

| Statut | Sens |
|---|---|
| ✅ | Structure, onglets et hiérarchie conformes ; données réelles |
| 🟡 | Structure conforme, contenu partiel (état vide là où la base est vide) |
| 🔴 | Écart de structure ou écran non atteignable |
| ⚪ | Pas encore implémenté |

## Tableau

| Écran | Scène | Statut | Écarts constatés |
|---|---|---|---|
| Monde | `monde` | 🟡 | Capsule d'onglets sous les cartes comme la maquette ; cartes « Près de toi » calculées depuis la position ; onglet Carnets alimenté par les 82 carnets publics réels ; libellés du fond de carte masqués sur le globe |
| Pays · France | `pays` | 🟡 | 18 régions Natural Earth réelles ; **Carnets et Départs réels** (capture `preuves/carnets-pays.png`) ; « Bon moment pour » absent (aucune donnée de saison) |
| Région · ARA | `region` | 🟡 | 101 départements Natural Earth ; « Massifs » remplacé par la liste réelle des départements ; Carnets/Départs réels |
| Lieu · Chamonix | `lieu` | 🟡 | Titre = département réel (« Haute-Savoie ») car aucune table de communes ; relief 3D présent ; sélecteur 2D/3D présent ; Carnets réels ; Amis en état vide (0 position partagée) |
| Sommet · Le Brévent | `sommet` | 🟡 | Repère réel (OSM, 2 525 m) ; onglets Aperçu/Accès/Carnets/Météo ; profil SVG et « 128 membres » absents (données inexistantes) |
| Eau · Chéserys | `eau` | 🟡 | Onglets État/Accès ; signalements en état vide (`terrain_reports` = 0) |
| Refuge | `refuge` | 🟡 | Onglets Aperçu/Accès/Carnets ; pas d'avis (table absente) |
| Bivouac | `bivouac` | 🟡 | Repère réel ; réglementation en état vide |
| Belvédère | `vue` | 🟡 | Point de vue réel (import OSM) |
| Danger | `danger` | 🟡 | État vide (« aucun signalement actif ») — `terrain_reports` = 0 |
| Accès | `acces` | 🟡 | Parkings et arrêts OSM réels importés |
| Ami | `ami` | 🔴 | Aucune position partagée (`group_live_positions` = 0) : écran réduit à l'état vide |
| Rando · survol | `rando` | 🟡 | Itinéraire réel (OSM) ; profil altimétrique non implémenté ; onglets Trace/Conditions seulement |
| Départ | `depart` | 🔴 | Formulaire de création non implémenté (état vide) |
| Recherche | `ia` | 🟡 | Recherche texte réelle sur pays + repères chargés ; pas d'analyseur en langage naturel |
| Calques | `calques` | 🟡 | Compteurs réels par couche ; interrupteurs non branchés |
| Hors ligne | `offline` | 🔴 | Téléchargement de zone non implémenté (état réel affiché) |
| Démarrer | `lancer` | ✅ | 9 sports réels, table `explorer_sport_map` |
| Course / Kayak / Rando / Vélo / Ski / Escalade / Trail / Famille / Bivouac de nuit | `course`…`bivlive` | 🟡 | Métriques et pastille d'activité ; GPS rejoué non branché |
| Hors itinéraire | `horstrace` | 🟡 | État visuel présent ; détection 40 m / 15 s non implémentée |
| SOS | `sos` | 🟡 | Feuille SOS et bouton rouge ; maintien 1,5 s et écriture `sos_alerts` non branchés |
| Bilan | `resume` | 🟡 | État vide (« aucune sortie à résumer ») |
| Arrière-plan | `arriere` | 🔴 | Live Activity absente (BLOCAGES #6) |
| Bienvenue | `bienvenue` | ✅ | 6 profils, « Autoriser ma position », « Plus tard » |
| Sans position | `noloc` | 🟡 | Message d'état ; relance de la permission non branchée |
| Nuit | `nuit` | ✅ | Thème sombre appliqué (`data-theme="dark"`) |
| Mode facile | `facile` | 🟡 | État chargé ; simplification d'interface non appliquée |
| Monde Asie / Japon / Nagano / USA / Chili / Mongolie | `monde_jp`… | 🟡 | Pays et régions réels Natural Earth ; contenus éditoriaux absents |

## Ce que la parité ne peut pas encore prouver

1. **Aucune paire n'a été relue image par image dans cette session** pour les
   41 écrans : les captures réelles sont générées par
   `capture-scenes.mjs`, les paires assemblées, mais la revue visuelle
   exhaustive reste à faire (voir `RAPPORT_FINAL.md §Limites`).
2. Les écrans dont la donnée source est vide en base ne peuvent pas être jugés
   sur le contenu : seulement sur la structure et l'état vide.
