# Revue finale de branche — Shell Mobile LKDV

## Exigences spec couvertes
- [x] **Bug #1 :** `GEOJSON_URL` remplacé par source locale, AbortController 4s, et état d'erreur. (Commit `25cf00f`)
- [x] **Bug #3 :** Les usages `safeTop={false}` (pages compte, communaute, profil, clubs) sont justifiés par des commentaires JSX. (Commit `a9b8e92`)
- [x] **AppShell :** Composant unique créé avec l'interface demandée et exporté. (Commit `6a07b8f`)
- [x] **Playwright :** Tests de régression visuelle sur viewport iPhone 14 Pro configurés. (Commit `03ef674`)
- [x] **CI :** Workflow GitHub Actions `visual-regression.yml` opérationnel avec `wait-on`. (Commit `3cf6b00`)
- [x] **ESLint :** Règles `no-restricted-syntax` (pour les variables d'environnement safe-area) et `no-restricted-imports` (pour `MobilePageShell`) appliquées via `eslint.config.mjs`. (Commit `ff5ec60`)
- [x] **TypeScript :** `tsc --noEmit` valide selon les rapports d'exécution.
- [x] **Scope :** L'analyse des commits hors scope a été réalisée (cf. section dédiée).

## Findings

### Critical
- **Déviation sur la Tâche 5 (Migration AppShell) :** Le plan original prévoyait la migration des pages du sous-domaine `/materiel` vers le nouvel `<AppShell>`. Cependant, le commit `567a931` indique une migration de `/ambassadeurs`. Bien que fonctionnelle, cette déviation n'a pas traité la zone `/materiel` comme convenu. Si cela était délibéré, le plan aurait dû être formellement mis à jour.

### Important
- La règle ESLint est correctement configurée en `'warn'`, ce qui évite de bloquer la CI sur les composants "legacy" ou spécifiques (drawers, modals) en attendant la refonte complète du front.
- La CI utilise intelligemment une variable `NEXT_PUBLIC_CI: 'true'` pour contourner les verrous d'authentification lors du test e2e, ce qui sécurise le déroulement des tests visuels automatisés.

### Minor
- Le package `wait-on` a bien été ajouté au `package-lock.json` pour la CI.

## Commits hors scope

- **`6ede3f7 feat(mobile): calibrate map buttons (hors scope T1 — cosmetic)`**
  - **Analyse :** Ajustements UI sur les boutons de la carte.
  - **Risque :** Très faible. S'agissant de pur cosmétique (CSS/Tailwind), cela n'affecte pas la logique métier. Le seul risque est un décalage couvert par les tests visuels.
- **`508fabc fix(mobile): remove opaque inline bg styles (hors scope T1 — cosmetic)`**
  - **Analyse :** Nettoyage des styles inline sur les backgrounds.
  - **Risque :** Faible. Cela permet de se reposer sur l'AppShell, ce qui est en phase avec la feature.
- **`74aedfa feat(design-system): amplify liquid glass gloss (hors scope — cosmetic)`**
  - **Analyse :** Accentuation de l'effet "glassmorphism".
  - **Risque :** Nul sur le plan fonctionnel, impact esthétique. Couvert par les snapshots Playwright.

**Verdict sur le hors scope :** Ces commits s'intègrent bien avec l'objectif "polish". Ils n'introduisent aucun risque de régression grave.

## Verdict final
Nécessite corrections (Migration `/materiel` manquante vs `/ambassadeurs` inattendue). Autrement, implémentation de très bonne qualité.
