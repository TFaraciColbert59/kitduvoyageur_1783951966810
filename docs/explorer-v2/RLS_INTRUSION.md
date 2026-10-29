# RLS_INTRUSION · Explorer v2

- Date : 2026-10-29T08:55:36.267Z
- Comptes : recette.lea@lkdv.test (A) · recette.yanis@lkdv.test (B, abonné mutuel)
- Résultat : ✅ toutes les politiques tiennent

| Contrôle | Résultat | Détail |
|---|---|---|
| A lit sa propre session live | OK | 1 ligne(s) |
| anon ne lit aucune session | OK | HTTP 200, 0 ligne(s) |
| B (abonné mutuel) lit la session live partagée de A | OK | 1 ligne(s) |
| B ne lit aucun point GPS de A | OK | 0 point(s) |
| A lit ses propres points GPS | OK | 41 point(s) |
| B ne peut pas modifier la session de A | OK | HTTP 200, 0 ligne(s) |
| B ne peut pas créer une session au nom de A | OK | HTTP 403 |
| B ne lit aucune alerte SOS | OK | 0 ligne(s) |
| geo_pois lisible publiquement (anon) | OK | HTTP 200 |
| country_practical lisible publiquement | OK | HTTP 200 |
| osm_poi_cache fermé au public | OK | HTTP 200 |
