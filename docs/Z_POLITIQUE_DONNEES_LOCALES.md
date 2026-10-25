# Politique de Cache des Données Réelles (Chantier Z — Z2.3)
Date : 07/09/2026
Référence git : `chantier/z2-donnees-verite`
Auteur : LKDV Data & Platform Pod

---

## 1. Contexte & Objectif

Le connecteur `lookupWaterSources` interroge en direct l'API OpenStreetMap Overpass (`https://overpass-api.de/api/interpreter`). Pour respecter la politique d'utilisation acceptable de l'infrastructure Overpass (fair-use) et garantir des temps de réponse inférieurs à 50 ms pour les utilisateurs en session active, une stratégie de cache stricte est mise en œuvre.

## 2. Spécification de la Politique de Cache

| Paramètre | Spécification | Justification |
|---|---|---|
| **Support de stockage** | En mémoire (`Map<string, CachedWaterSources>`) | Zéro latence I/O, isolation par instance |
| **Clé de cache (`cacheKey`)** | `minLat.toFixed(3),minLon.toFixed(3),maxLat.toFixed(3),maxLon.toFixed(3)` | Arrondi à 3 décimales (~110 m de précision), favorisant les hits lors de micro-déplacements de carte |
| **Durée de vie (TTL)** | 3 600 000 ms (1 heure) | Les points d'eau physiques (fontaines, sources) changent rarement au cours d'une journée |
| **Capacité maximale** | 50 entrées géographiques | Empreinte mémoire bornée (< 500 Ko), politique d'éviction FIFO (suppression de la plus ancienne clé) |
| **Timeout réseau** | 4 000 ms (`AbortSignal.timeout(4000)`) | Empêche tout blocage de l'interface en cas de congestion Overpass |
| **Repli en cas d'échec / offline** | Repli strict sur nœuds réels certifiés situés dans la boîte, ou `[]` | Zéro point inventé : respect absolu des règles Z-R1 et Z-R2 |

## 3. Invalidation & Actualisation

1. **Expiration naturelle** : Toute entrée dont `Date.now() - timestamp > TTL` est ignorée et relance un appel Overpass.
2. **Invalidation par saturation** : Dès que le cache atteint 50 entrées, la clé la plus ancienne est détruite.
3. **Attribution ODbL** : Chaque point retourné conserve l'identifiant exact du nœud OSM et la mention de licence Open Database License (`ODbL`).
