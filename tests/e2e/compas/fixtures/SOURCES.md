# Provenance des données du parcours E2E du Compas

Rien n'est inventé : chaque fichier est une réponse réelle, relevée telle quelle.

| Fichier | Source | Licence | Relevé |
|---|---|---|---|
| `geonames-vercors.tsv` | GeoNames `cities500.txt` (lieux habités de plus de 500 habitants, cadre 5,20–5,95 °E / 44,70–45,25 °N), colonnes mises en forme comme `scripts/geo/prep_geo_places.py` | CC BY 4.0, geonames.org | 12 oct. 2026 |
| `geonames-countryinfo-fr.tsv` | GeoNames `countryInfo.txt`, ligne `FR` | CC BY 4.0, geonames.org | 12 oct. 2026 |
| `captures/photon-*.json` | Photon (photon.komoot.io), données OpenStreetMap | ODbL, © contributeurs OpenStreetMap | 12–13 oct. 2026 |
| `captures/met-vercors.json` | MET Norway, Locationforecast 2.0 `complete` (lat 45,05 / lon 5,35) | CC BY 4.0, MET Norway | 13 oct. 2026 |

Chaque capture garde l'adresse interrogée (`source`) et la date (`capturedAt`).
Pour en ajouter une : `node tests/e2e/compas/support/capture.mjs <url> <nom> <paramètres,à,comparer>`
(l'adresse ne doit porter aucune clé d'API). Un appel que le test ne connaît pas fait échouer
le parcours (`unhandled` dans le journal des doublures) : c'est voulu.

Les services tiers sans capture sont déclarés « en panne » dans `support/doubles-server.mjs`
(`DOWN_HOSTS`) : le Compas annonce alors son repli, comme avec un service gratuit qui ne répond pas
(Overpass, routage, altitudes, NASA POWER, taux de change…).
