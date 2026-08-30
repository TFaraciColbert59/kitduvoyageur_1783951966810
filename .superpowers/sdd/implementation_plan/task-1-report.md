# Task 1 Report — GeoJSON local pour CountryGlobe

- **Status:** DONE
- **Commits créés:** `25cf00f` (`fix(globe): serve GeoJSON from /public, add 4s AbortController timeout + error state`) et `508fabc`
- **Fichiers modifiés / créés:**
  - `public/data/countries-110m.geojson` (téléchargé et committé dans le repo)
  - `src/components/pays/CountryGlobe.tsx` (servi localement depuis `/data/countries-110m.geojson`, timeout AbortController de 4s, gestion d'erreur explicite et suppression du spinner infini)

## Vérifications

1. **Suppression de l'URL externe :**
   ```powershell
   Select-String -Path "src/components/pays/CountryGlobe.tsx" -Pattern "githubusercontent.com"
   ```
   **Résultat :** Vide (0 occurrence).

2. **TypeScript :**
   ```powershell
   npx tsc --noEmit
   ```
   **Résultat :** 0 erreur (Exit code 0).

3. **Lint :**
   Aucune nouvelle erreur introduite sur `src/components/pays/CountryGlobe.tsx`.

## Concerns
Aucun concern. Le GeoJSON est désormais servi en local de façon résiliente avec timeout de 4 secondes et fallback d'erreur propre.
