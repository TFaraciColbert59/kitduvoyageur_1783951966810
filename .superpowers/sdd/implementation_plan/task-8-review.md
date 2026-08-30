## Spec compliance: ✅

- **Création isolée de `.github/workflows/visual-regression.yml`** : ✅ Conforme (`.github/workflows/nextjs.yml` non modifié).
- **Exécution des tests visuels via `npm run test:visual`** : ✅ Conforme (`run: npm run test:visual` avec `PW_BASE_URL: http://localhost:4028`).
- **Attente de disponibilité du serveur avec `wait-on`** : ✅ Conforme (`run: npx wait-on http://localhost:4028 --timeout 60000`).
- **Upload des artefacts en cas d'échec** : ✅ Conforme (`actions/upload-artifact@v4` avec `if: failure()` pour `playwright-report/` et `test-results/`, rétention 7 jours).
- **Injection des variables d'environnement Supabase** : ✅ Conforme (`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` mappés depuis les secrets GitHub + `NEXT_PUBLIC_CI: 'true'`).
- **Dépendance `wait-on` dans `devDependencies`** : ✅ Conforme (`"wait-on": "^9.1.0"` présent dans `package.json` et `package-lock.json`).
- **Validité de la syntaxe YAML** : ✅ Conforme (validation Python `yaml.safe_load` avec code de sortie 0).

## Findings
None

## Task quality: Approved
