# PARITÉ · Explorer v2

Comparaison écran par écran entre la maquette
(`handoff/explorer-v2/maquette/captures/<Ecran>.png`, 390×844) et le rendu réel
(`docs/explorer-v2/preuves/screens/<Ecran>.png`, 390×844, build de production).
Les paires assemblées (maquette | réel) sont dans `docs/explorer-v2/parite/`
et se régénèrent avec `node scripts/explorer-v2/capture-scenes.mjs --base=…`.

## Légende

| Statut | Sens |
|---|---|
| ✅ | Structure, onglets, hiérarchie et contenu conformes |
| 🟡 | Structure conforme, contenu partiel : état vide là où la base est vide (`00_MISSION §6.4`) |
| 🔴 | Écart de structure assumé (élément de la maquette absent) |

Règle de jugement : structure, onglets, boutons, hiérarchie et jetons de couleur.
Une donnée absente en base est **masquée** avec l'état vide prévu — ce n'est pas
un écart de structure.

## Les 41 écrans

| # | Écran | Scène | Statut | Points vérifiés / écarts |
|---|---|---|---|---|
| 1 | Monde | `monde` | ✅ | Capsule recherche + globe, cartes « Près de toi », capsule d'onglets ancrée en bas, carte 2.5D temps réel |
| 2 | Pays · France | `pays` | ✅ | 18 régions réelles, onglets Aperçu/Carnets/Départs/Pratique, carnets et départs BDD |
| 3 | Région · ARA | `region` | 🟡 | Départements réels Natural Earth ; « Massifs » remplacé par la liste réelle (pas de table massifs) |
| 4 | Lieu · Chamonix | `lieu` | 🟡 | Relief 3D, repères OSM, mini 2D/3D ; titre = département (pas de table communes) |
| 5 | Sommet | `sommet` | 🟡 | 4 onglets, métriques réelles ; profil et « 128 membres » absents des données |
| 6 | Eau · Chéserys | `eau` | ✅ | Onglets État/Accès, **signalements réels** (distance, présent/disparu), confirmation |
| 7 | Rando | `rando` | ✅ | Profil altimétrique DEM réel, métriques, trace OSM, mini carte/survol |
| 8 | Départ | `depart` | ✅ | Formulaire réel (titre, lieu, dates, places) écrivant dans `trips` sous RLS |
| 9 | Recherche | `ia` | ✅ | Recherche réelle + filtres extraits (« Point d'eau · 8 km max ») |
| 10 | Calques | `calques` | ✅ | Compteurs réels par couche + entrée « Zone hors ligne » |
| 11 | Hors ligne | `offline` | ✅ | Estimation tuiles, téléchargement (10,4 Mo), purge, **mode avion vérifié** |
| 12 | Démarrer | `lancer` | ✅ | 9 sports réels, table `explorer_sport_map` |
| 13-21 | Course, Kayak, Randonnée, Vélo, Ski, Escalade, Trail, Famille, Bivouac de nuit | `course`…`bivlive` | ✅ | 4 onglets (Direct/Tours/Cœur/Sécurité), chrono 44 px, pastille + SOS, numéro d'urgence réel |
| 22 | Hors itinéraire | `horstrace` | ✅ | Bandeau ambre « Hors itinéraire · N m », règle 40 m/15 s testée |
| 23 | SOS | `sos` | ✅ | Maintien 1,5 s, compte à rebours 5 s annulable (Échap), enregistrement RLS |
| 24 | Bilan | `resume` | 🟡 | Métriques + état d'enregistrement ; pas de sortie à résumer en scène |
| 25 | Arrière-plan | `arriere` | 🔴 | Pas de Live Activity (iOS absent de cet environnement) — état réel affiché |
| 26 | Bienvenue | `bienvenue` | ✅ | 6 profils, « Autoriser ma position », « Plus tard » |
| 27 | Sans position | `noloc` | 🟡 | Message + relance ; pas de géolocalisation réelle en test |
| 28 | Nuit | `nuit` | ✅ | Thème sombre complet (verre, textes, carte assombrie) |
| 29 | Mode facile | `facile` | 🟡 | État chargé ; simplification d'interface non appliquée |
| 30 | Globe · un pays touché | `monde_jp` | ✅ | Aperçu pays depuis le globe |
| 31-35 | Japon, Nagano, États-Unis, Chili, Mongolie | `japon`… | ✅ | Pays/régions réels, unités impériales pour les US, hémisphère sud pour le Chili |
| 36 | Refuge | `refuge` | 🟡 | Refuge OSM réel ; pas d'avis (table absente) |
| 37 | Bivouac | `bivouac` | 🟡 | Camping OSM réel ; réglementation en état vide |
| 38 | Belvédère | `vue` | ✅ | Point de vue OSM réel, météo MET Norway |
| 39 | Danger | `danger` | 🟡 | État vide (aucun signalement actif) — mécanique testée |
| 40 | Accès | `acces` | ✅ | Parkings et arrêts OSM réels |
| 41 | Ami | `ami` | 🔴 | Aucune position partagée en base (`group_live_positions` = 0) |

## Ce qui est prouvé, et comment

1. **Structure** : `tests/explorer-v2/screens.e2e.spec.ts` — 41 tests verts
   (titre réel non vide, onglets annoncés, barre basse unique, thème sombre).
2. **Rendu** : 41 captures réelles + 41 paires côte à côte versionnées.
3. **Revue visuelle** : 9 paires relues image par image dans cette session
   (Monde, Pays, Région, Lieu, Sommet, Eau, Course, Capsule, Pratique Japon) ;
   les autres sont jugées sur capture + test structurel.

## Écarts assumés et leur raison

| Écart | Raison |
|---|---|
| Pas de Live Activity (25) | Pas de Mac/Xcode/appareil (BLOCAGES #6) |
| Ami vide (41) | Table de positions vide : aucune donnée à afficher |
| Titre « département » au lieu de la commune (4) | Aucune table de communes ; Natural Earth s'arrête au niveau 2 |
| « Massifs » remplacé par les départements (3) | Aucune table de massifs |
| Profil/membres absents (5) | Pas de données de fréquentation par sommet |
