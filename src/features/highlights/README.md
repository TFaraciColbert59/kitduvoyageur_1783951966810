# C03 — Highlights, collections et contributions

Lot isolé : `src/features/highlights/` (modèles, moteurs purs, services) et
`src/components/highlights/` (drawers et panneaux). Aucun fichier
`ExplorerV2.tsx`, `SheetContent.tsx`, `useGpsTracker.ts` ou `state/*` n'est
modifié : les surfaces qui possèdent déjà leur drawer montent ces composants.

## Couverture des fiches

| Fiche | Contrat porté par le lot                                                                          |
| ----- | ------------------------------------------------------------------------------------------------- |
| K1.10 | `recommendInspiration` + `InspirationRail` (sport, région, auteurs suivis, historique, fraîcheur) |
| K1.11 | `buildEditorialGuide` + `GuideDrawer` (thème, parcours, lieux, highlights)                        |
| K1.12 | `searchParkRoutes` + recherche de parc dans `GuideDrawer` (bbox, aucun filtre standard)           |
| K2.25 | `resolveStreetView` + `StreetViewPanel` (adaptateur injecté, repli Trail View)                    |
| K2.26 | `indexTrailPhotos` + `TrailViewPanel` (distance le long du tracé et cap, sans coordonnée)         |
| K5.13 | `createHighlight` (lieu ou tronçon, audience, confidentialité)                                    |
| K5.14 | `addTip`, `addPhoto`, `toggleVote` (contenu durable, galerie, votes)                              |
| K5.15 | `saveHighlightToPlaces` (« Mes lieux » réutilisable dans les collections)                         |
| K5.16 | `CollectionsService` (ordre, déplacement, retrait) + `CollectionDrawer`                           |
| K5.17 | `publicEditorialCollections` (guides/collections éditoriales publiques)                           |
| K5.18 | `searchCollections`, `createShareLink`, `resolveShareLink`, révocation                            |
| S3.05 | `routeCommunityMedia` + `CommunityRoutePanel` (photos/activités publiques)                        |
| S3.24 | `synthesizeRouteCommunity` (tags à plusieurs sources, description agrégée)                        |

## Invariant P01

`privacy.ts` est la seule porte de sortie. Une projection ne contient jamais :

- une photo `masked`, une photo sans EXIF nettoyé, ou une photo sans
  consentement public ;
- une latitude/longitude quand `hideExactLocation` est actif (le secteur
  `areaLabel` reste) ;
- le propriétaire d'une collection résolue par lien ;
- les coordonnées d'une photo Trail View (seulement distance et cap).

Les composants ne reçoivent que des vues (`HighlightView`, `CollectionView`,
`TrailPhotoMarker`, `RouteCommunityMedia`, `StreetViewResult`).

## Stockage

`HighlightsStore` est un port. `InMemoryHighlightsStore` sert aux tests et à la
préproduction. Un adaptateur Supabase devra appliquer la RLS par
`auth.uid()`, le propriétaire pour les écritures, et révoquer les liens au
retrait d'un média. Aucune migration n'est appliquée par ce lot.

## Vu de rue

`StreetViewProvider` est injecté. Sans adaptateur (Google/Mapillary), le
résultat est `provider-absent` : aucune clé, aucune URL tierce et aucun achat
implicite ne sont ajoutés. L'UI propose Trail View.

## Vérification

```bash
npx tsc --noEmit -p .
npx eslint src/features/highlights src/components/highlights
npx vitest run src/features/highlights
```
