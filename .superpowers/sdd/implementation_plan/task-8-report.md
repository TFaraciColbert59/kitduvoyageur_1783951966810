# Task 8 Report — Workflow CI GitHub Actions pour tests visuels

## Status
**DONE**

## Commit créé
- `3cf6b00` : `ci: add visual regression workflow for mobile shell (Playwright iPhone 14 Pro)`

## Fichiers créés / modifiés
- **Créé** : `.github/workflows/visual-regression.yml` (Workflow GitHub Actions exécutant les tests de régression visuelle sur push/PR `main` avec setup Node 20, build, wait-on port 4028, exécution `npm run test:visual` et upload d'artefacts en cas d'échec)
- **Modifié** : `package.json` et `package-lock.json` (Ajout du package `wait-on` dans les `devDependencies`)

## Vérifications
- **Syntaxe YAML** : `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/visual-regression.yml'))"` -> **VALIDE (Exit code 0)**
- **Présence `wait-on`** : `npm list wait-on` -> `wait-on@9.1.0` présent dans les `devDependencies`
- **Intégrité de `.github/workflows/nextjs.yml`** : Fichier non modifié (aucun diff)

## Concerns éventuels
- Aucun. `wait-on` a été installé proprement en devDependency et le workflow est complètement configuré avec retention des artefacts (rapports et screenshots diff) de 7 jours en cas d'échec.
