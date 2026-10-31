# Code mort supprimé — lot 1 (31/10/2026)

## Preuve d'absence d'usage

Méthode (reproductible) : graphe d'imports complet sur les 9 500 fichiers suivis
par git — imports statiques, `import()`, `require`, ré-exports, alias `@/`,
résolution `index.*` et extensions — puis recherche textuelle du nom du module
dans **tout** le dépôt (code, tests, scripts), enfin vérification manuelle.

7 fichiers n'avaient **aucune** référence entrante ni mention ailleurs que dans
leur propre fichier :

| Fichier | Octets |
|---|---:|
| `src/components/social/CommentsSheet.tsx` | 18 208 |
| `src/components/glass/GlassSurface.tsx` | 2 155 |
| `src/components/compte/drawer/slotIcons.tsx` | 1 498 |
| `src/components/TopoSeparator.tsx` | 978 |
| `src/features/discovery/providers/klook/klookErrors.ts` | 736 |
| `src/components/account/AccountRoundButton.tsx` | 707 |
| `src/features/discovery/providers/klook/klookSchemas.ts` | 459 |

Aucun n'est une convention Next (`page`, `layout`, `route`, `loading`, …), aucun
n'est chargé dynamiquement (aucun `import()` construit par chaîne trouvé dans le
dépôt), aucun n'est cité par les tests.

## Quarantaine (réversible)

Déplacement via l'outil du dépôt, pas une suppression directe :

```
npm run cleanup:quarantine -- --paths <les 7 fichiers> \
  --reason "aucun import, aucune mention code/test hors fichier lui-même" --apply --yes
```

Manifeste : `.cleanup-trash/2026-10-31T17-59-38-413Z/manifest.json`
(sha256 + blob git par fichier).

Restauration exacte :

```
npm run cleanup:quarantine -- --restore 2026-10-31T17-59-38-413Z
```

## Validation

- `npm run build` → **exit 0** (compilation, lint, type-check) après retrait ;
- `npm run type-check` → exit 0 ;
- aucune référence restante (grep).

## Ce qui reste volontairement

L'analyse stricte identifie ~80 fichiers `src/` supplémentaires sans référence
entrante. Ils ont **tous** été modifiés entre le 25 et le 30/10/2026 par les
refontes en cours (Communauté « card », Compte, matériel, trips). Les supprimer
reviendrait à détruire du travail récent potentiellement non encore branché :
ils restent en place, listés dans `CODE_MORT_CANDIDATS.md`, pour arbitrage du
propriétaire du dépôt.

Aucun fichier HUB ni Compas n'est concerné (les 11 candidats de ces zones sont
exclus par principe).
