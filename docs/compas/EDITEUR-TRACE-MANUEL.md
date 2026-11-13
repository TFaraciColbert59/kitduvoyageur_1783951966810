# Éditeur de parcours — tronçon manuel hors réseau (R01 · K2.14)

Référence : fiche Komoot `K2.14`, mission `R01`, base `687b477`.
Périmètre : éditeur de parcours existant du Compas, sans nouvel écran.

## Ce qui est livré

Un tronçon entre deux points consécutifs peut être **tracé à la main**. Il est
alors marqué `manual` et affiché en pointillés ambre, tandis que les tronçons
calculés restent en trait plein forêt.

- **Entrée** : liste « Tronçons du tracé » de l’éditeur, bouton « Tracer à la
  main » sur un tronçon.
- **Geste** : toucher la carte ajoute un repère avant l’arrivée. « Terminer le
  tracé manuel » enregistre le tronçon ; « Annuler le tracé » le retire (ou
  restaure le tracé existant si l’on modifiait un tronçon déjà manuel).
- **Sortie** : « Revenir au calcul » supprime le tronçon manuel et relance le
  routage de ce seul tronçon.

Le mode manuel reste dans le sous-écran de l’éditeur déjà ouvert par le tiroir
« Où » : le retour au parent conserve son contexte, sans nouveau drawer.

## Contrat de données

Aucune migration, aucune nouvelle table. Le brouillon reste dans
`trips.metadata.compas.routeDraft`, déjà protégé par `can_edit_trip`.

`routeRevision.ts` ajoute `sections`, un tableau d’un élément par paire de
points consécutifs :

```ts
type RouteSection = {
  id: string;
  mode: 'routed' | 'manual';
  fromIndex: number;   // point de départ, index dans draft.points
  toIndex: number;     // fromIndex + 1
  geometry: { type: 'LineString'; coordinates: [lon, lat][] };
  distanceKm: number;  // mesurée : routeur pour routed, ligne dessinée pour manual
  durationMin: number | null; // null pour manual
  provider: string | null;    // null pour manual
};
```

`geometry` reste la ligne complète (calculée + manuelle) pour les surfaces qui
n’affichent qu’un tracé. `sections` porte la distinction.

### Compatibilité

- Un brouillon d’avant K2.14 n’a pas `sections` : il reste lisible, sa
  géométrie est traitée comme calculée (`sections: []`).
- Un découpage incomplet, désordonné ou illisible est ignoré : la géométrie
  entière est conservée, aucune section n’est devinée.
- Le serveur refuse un découpage fourni qui ne couvre pas exactement les paires
  de points, ou qui n’est pas dans l’ordre.
- Le numéro d’engine passe à `lkdv-route-editor/2` ; les anciennes révisions
  gardent leur valeur et restent relues.

## Aucun faux chemin réseau

C’est la règle structurante de l’implémentation :

1. `autoRuns()` coupe la liste de points à chaque tronçon manuel. Seules les
   suites de tronçons **calculés** partent à `/api/route`.
2. Les extrémités d’un tronçon manuel ne sont jamais envoyées au routeur.
   Aucun fournisseur ne peut donc produire une ligne « plausible » à leur place.
3. La distance d’un tronçon manuel est la somme haversine des segments
   dessinés. Elle n’est pas présentée comme une mesure de réseau.
4. Sa durée reste `null` : la durée totale du brouillon devient `null` dès
   qu’un tronçon manuel existe, plutôt que d’inventer une vitesse.
5. Son `provider` est `null`. Le cache `/api/route/cache` n’est ni lu ni écrit
   pour un tronçon manuel.
6. Le tracé manuel est dessiné en pointillés (`HubRouteMap.manualSegments`),
   avec un état « Manuel hors réseau » dans la liste et un rappel
   « dont X km hors réseau » dans le résumé du Compas.

## Droits et données préservées

- L’écriture passe toujours par `compasSaveRouteDraftAction` :
  `requireEditor(tripId)` puis `updateTripMetadata`, comme avant K2.14.
- Aucun changement de RLS, de grant, de policy ou de fonction SQL.
- Les séances (`hike_sessions`) et les parcours du catalogue
  (`hiking_routes`) ne sont pas touchés.
- Choisir un parcours du catalogue efface toujours `routeDraft` comme avant.
- Les autres surfaces du Compas continuent de lire `routeDraft.geometry` et
  `routeDraft.distanceKm` ; elles ne dépendent pas de `sections`.

## Limites connues

- **Un tronçon manuel par paire de points.** On ne dessine pas une liaison
  libre qui saute plusieurs points, ni un réseau de variantes.
- **Pas de déplacement des repères manuels intermédiaires.** On les pose au
  toucher ; pour les corriger, on annule et on recommence le tronçon. Les
  points d’étape restent déplaçables et recalent les extrémités.
- **Distance planimétrique.** La longueur manuelle ne suit pas le relief et
  n’est pas corrigée par la pente.
- **Durée non calculée.** Aucun barème de vitesse n’est appliqué au manuel :
  la durée totale est volontairement inconnue tant qu’un tronçon manuel existe.
- **Ancien brouillon.** Tant qu’aucun recalcul n’a eu lieu, un brouillon sans
  `sections` s’affiche comme un tracé calculé unique ; le premier geste de
  calcul ou de tracé manuel construit le découpage.
- **Hors éditeur.** Les surfaces qui n’affichent qu’un tracé (aperçu Compas)
  montrent la ligne complète ; la distinction pointillés + mention « hors
  réseau » est portée par l’éditeur et le résumé. Un export GPX qui voudrait
  distinguer les tronçons manuels n’est pas traité ici.
- **Taille des métadonnées.** Un tronçon calculé est simplifié à 500 points ;
  le découpage peut donc porter jusqu’à environ 11 × 500 points. C’est borné,
  mais plus lourd qu’un seul tracé.
- **Pas de détection automatique du hors-réseau.** C’est la personne qui décide
  de tracer à la main ; l’application ne bascule pas toute seule un tronçon en
  manuel après un refus `off_network`.

## Fichiers touchés

- `src/features/adventure-prep/routeRevision.ts` : `RouteSection`, lecture
  défensive, composition, recalcul des extrémités, suppression de point.
- `src/features/compas/components/RouteEditor.tsx` : état `sections`, mode
  manuel, découpage des appels de routage, liste des tronçons, panneau manuel.
- `src/features/hub/components/mobile/HubRouteMap.tsx` : `manualSegments`,
  pointillés ambre, cadrage incluant le manuel.
- `src/features/compas/server/compasActions.ts` : validation zod des sections
  et cohérence du découpage ; action et droits inchangés.
- `src/features/compas/components/CompasOuFlows.tsx` : mention « dont X km hors
  réseau » dans le résumé.
- `src/features/compas/compas.css` : lignes de tronçons et panneau manuel.
- `src/lib/i18n/translations/compas-steps.{fr,en,de,es,it}.ts` : libellés.

## Vérification

Consigne de mission : **aucun test, suite, build, lint ni tsc n’a été exécuté
avant la fin**. Aucun commit, aucune mise en production, aucun appel réseau
externe au modèle n’a été effectué.

La vérification faite ici est une lecture de code :

- un tronçon `manual` est exclu de `autoRuns()` et n’apparaît dans aucune query
  `/api/route` ;
- `durationMin` est forcé à `null` dès qu’un manuel existe ;
- `readRouteDraft` retombe sur l’ancien contrat si `sections` manque ou est
  incohérent ;
- `compasSaveRouteDraftAction` conserve `requireEditor` et
  `updateTripMetadata`.

Risque résiduel assumé : sans exécution de `tsc` ni des tests, une erreur de
typage ou une régression d’intégration peut subsister. Elle devra être levée
lors de la première exécution autorisée.
