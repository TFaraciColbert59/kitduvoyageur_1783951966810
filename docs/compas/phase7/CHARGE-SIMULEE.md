# Compas — charge simulée : 1 000 préparations par jour dans les quotas gratuits (phase 7)

> Mesuré le 20 octobre 2026 à partir des compteurs réels de la base (`api_credit_days`, `ops_preparation_events`,
> tailles des tables). **Ce n'est pas un test de charge** : aucune rafale simultanée n'a été lancée, et une partie des
> préparations du jour répète les mêmes phrases (le cache en a épargné une partie). Les chiffres sont donc une
> **borne basse** de la consommation réelle pour un trafic varié.

## Ce qui est mesuré

| Mesure | Valeur | Source |
|---|---|---|
| Préparations réussies le 20 oct. | 256 | `ops_preparation_events` (`kind = 'ok'`) |
| Crédits Geoapify (géocodage, lieux) | 401 → **1,57 par préparation** | `api_credit_days`, service `geoapify` |
| Crédits Geoapify (routage) | 351 → **1,37 par préparation** | `api_credit_days`, service `geoapify-routing` |
| Total Geoapify | **≈ 2,9 crédits par préparation** | somme, en prenant les deux lignes comme deux consommations |
| Taille en base d'un voyage préparé | **≈ 16 Ko** (`trips`, `trip_steps`, `trip_items`) | 858 voyages, 13,7 Mo |
| Durée d'une préparation | médiane 30 s, p90 42 s, max 57 s | jeux du 20 oct. (100 phrases) |
| Base aujourd'hui | 241 Mo sur 500 Mo | `pg_database_size` |

## Ce que donnent 1 000 préparations par jour

| Service | Limite gratuite | Besoin à 1 000 / jour | Marge |
|---|---|---|---|
| **Geoapify** | 3 000 crédits/jour (le site s'arrête à 2 700) | ≈ **2 900** | **négative (−7 % sur l'arrêt du site)** : les ≈ 80 dernières préparations du jour passent en secours (Valhalla, puis estimation annoncée), sans erreur ni facture |
| Photon public | 3 requêtes/s pour tout le site (`PHOTON_PER_SECOND`) | une préparation de 40 s, 10 à 20 requêtes : ≈ 0,5 à 1 /s en moyenne | correcte en moyenne ; les pointes (plusieurs préparations en même temps) remplissent le créneau, d'où l'attente de 3 × 450 ms ajoutée (constat C-017) |
| MET Norway | 20 requêtes/s pour toute l'application | quelques requêtes par préparation | très large |
| Supabase (place) | 500 Mo | 1 000 voyages/jour × 16 Ko = 16 Mo/jour ; gardés 7 jours sans visite : ≈ 112 Mo en régime | **241 + 112 = 353 Mo**, sous la cible de 400 Mo |
| Supabase (sortie) | 5 Go/mois | non mesuré | à surveiller |

## Verdict honnête

- **Tient** : base, MET Norway, Photon en moyenne.
- **Ne tient pas sans dégradation** : Geoapify, à environ 2 900 crédits pour 1 000 préparations. Le code dégrade proprement
  (routage de secours, estimation dite « estimation »), mais le résultat n'est alors plus mesuré par Geoapify.
- **Pour retrouver de la marge sans payer** : réduire les crédits par préparation (le routage compte pour la moitié :
  un cache par tronçon plus long, ou le routage Valhalla en premier pour les tronçons longs), ou limiter les
  préparations à ≈ 900 par jour.

## Reste à faire pour fermer la ligne du plan

1. Un vrai test de charge : 20 préparations simultanées de phrases **toutes différentes**, compteurs relevés avant/après.
2. Relever la sortie Supabase (5 Go/mois) sur une semaine réelle.
3. Décider de la mesure de marge Geoapify ci-dessus.
