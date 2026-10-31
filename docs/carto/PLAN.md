# CARTO · Plan de fidélité

Référence visuelle et technique **imposée** : Maptoolkit Hiking 3D
(`https://styles.maptoolkit.org/hiking-3d.json`, 133 couches, terrain `rgb-tiles`).
Hybride : imagerie **ArcGIS World Imagery** (déjà licenciée dans le projet) sous les
couches Maptoolkit.

## Référence (à reproduire)

| Élément | Source de vérité |
|---|---|
| Sentiers, courbes, ombrage, végétation, POI outdoor | style officiel `hiking-3d.json` |
| Relief 3D | `terrain: { source: 'rgb-tiles', exaggeration: 1 }` du style |
| Attribution | logo Maptoolkit ≥ 24 px + `© Maptoolkit © Openstreetmap` (TOS §8) |
| Satellite | `ibasemaps-api.arcgis.com/.../World_Imagery` + « Powered by Esri » |
| Identité LKDV | teintes des aplats (`applyLkdvIdentity`), le reste du style est conservé |

## Architecture

```
src/features/carto/
  maptoolkit.ts      # constantes, licence, style adapté (testé)
  LKDVMap.tsx        # composant partagé (à venir) : instance, caméra, terrain,
                     # satellite/hybride, attribution, marqueurs, GPX, clusters
  layers/            # couches LKDV (POI, traces, signalements, sélection)
  adapters/          # entrées par écran (Explorer, carnets, posts, voyages…)
src/components/map/engine/   # INCHANGÉ — HUB et Compas continuent de l'utiliser
```

Règle : `engine/*` n'est **jamais** modifié (protection HUB/Compas) ; le nouveau
système vit dans `features/carto` et les écrans migrés l'importent.

## Lots

| # | Lot | Fichiers | Preuve |
|---|---|---|---|
| C1 | Base Maptoolkit + tests | `features/carto/maptoolkit.ts`, `tests/carto/*` | 6 tests verts sur le style officiel ✅ |
| C2 | `LKDVMap` (instance, caméra, terrain, hybride, attribution) | `features/carto/LKDVMap.tsx` | capture 3D + hybride, test composant |
| C3 | Couches LKDV (POI, clusters, GPX, signalements) | `features/carto/layers/*` | tests unitaires + e2e |
| C4 | Migration Explorer v2 | `explorer-v2/map/MapStage.tsx` | parité 41 écrans + e2e |
| C5 | Migration écrans secondaires | carnets, compte, pays, groupes, messagerie, matériel, communauté | captures avant/après |
| C6 | Nettoyage + non-régression HUB/Compas | suppression des styles dupliqués | `git diff` vide sur HUB/Compas + tests |

## Hors périmètre (interdit)

- `src/features/hub/**`, `src/components/hub/**`, `src/app/hub/**`
- `src/features/compas/**`, `src/app/compas/**`
- Toute modification de `src/components/map/engine/**` (HUB s'y branche)

## Conditions à confirmer avant production

1. **Éligibilité Community License** : CA < 1 M€ **et** < 10 ETP (§4 du TOS).
2. **Enregistrement du Referer** sur maptoolkit.org (100 req/s au lieu de 10).
3. **Clé ArcGIS** `NEXT_PUBLIC_ARCGIS_API_KEY` : absente de `.env.local` → hybride
   satellite non testable ici ; la couche est codée et testée, elle s'activera dès
   que la clé sera fournie.

## Critères de sortie

- Toutes les cartes autorisées instancient `LKDVMap` (aucune instance MapLibre
  ad hoc restante hors HUB/Compas).
- Base Maptoolkit 3D par défaut ; hybride satellite activable.
- Attribution Maptoolkit visible en permanence, logo ≥ 24 px.
- Aucune tuile Maptoolkit mise en cache hors ligne.
- Diff Git nul sur HUB et Compas ; leurs tests passent.
