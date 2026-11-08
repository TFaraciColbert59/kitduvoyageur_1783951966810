# Coloris par défaut non appliqué — constat du 8 novembre 2026

Constat uniquement, sans correction du code couleur, réservé à l'autre lot.

Le script `scripts/kit-studio/render-scene-atelier.mjs` appelle `createInitialState('tmb')`, puis choisit le corps à rendre. Il ne remplace aucune configuration de coloris. Le registre est celui de démonstration par défaut ; ce script ne charge pas le bootstrap des données du compte.

Pour le 45 L comme pour le 15 L, la configuration par défaut du corps contient `body.col = 'm-2d482a'`. Cette clé désigne le vert forêt du catalogue. Elle atteint bien `atlasUniformsFor` via `currentConfig` et la couche GLB.

Or `resolveTokenToThreeColor('m-2d482a')` renvoie **null**. Le résolveur connaît les identifiants de nuances tels que `forest`, les références CSS `var(...)`, ainsi que les couleurs RGB et hexadécimales brutes ; il ne résout pas cette clé `MaterialKey` du catalogue.

Avec une carte de zones et une trame présentes, le contrôle des paramètres renvoie :

```json
{
  "enabled": true,
  "tint": null,
  "weaveStrength": 2.4,
  "fabricRoughness": 0.88,
  "rigidRoughness": 0.25
}
```

`applyAtlasAppearance` laisse donc la greffe active, mais écrit `tintAmount = 0`. Les zones, la trame et le sheen peuvent fonctionner alors que la recoloration du tissu est éteinte. Le chartreuse de la planche ne correspond pas au vert forêt demandé par le défaut.

À l'inverse, `resolveTokenToThreeColor('forest')` renvoie une couleur valide (hexadécimal résolu `17402c`). La matrice de calibration `docs/kit-studio/captures/matrice-6-rendus-lkdv-one-45.png` annonce explicitement « Token forest » : elle n'exerce pas le même chemin de résolution que le défaut `m-2d482a`.

Conclusion : la non-application de la teinte est confirmée sur le chemin réel de la scène avec la configuration par défaut de démonstration. Cela constitue un mécanisme précis compatible avec le symptôme iPhone de Tony. Le même résultat sur les données serveur de son compte reste à vérifier par le lot couleur ; aucune extrapolation à tous les comptes n'est faite.

Le test WebGL d'atlas exerce explicitement les nuances `forest` et `ochre` (`atlas.test.ts`, lignes 246 et 251). Il reste discriminant pour la greffe, mais ne couvre pas la résolution de la clé de catalogue du défaut. Cela explique qu'il passe malgré ce défaut de coloris.

Les fichiers de résolveur, de configuration et de shader sont restés inchangés. La neutralisation temporaire du shader pendant la contre-épreuve a été restaurée intégralement.
