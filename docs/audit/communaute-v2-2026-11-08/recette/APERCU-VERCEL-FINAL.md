# Aperçu Vercel final — vérification des deux tiroirs (vrai backend, compte de démo)

- **Déploiement** : `https://kitduvoyageur-1783951966810-nsj0gu31k.vercel.app`
  (commit `ce5313a`, branche `feat/communaute-v2`, build Vercel Preview)
- **Date** : 2026-11-08
- **Méthode** : Playwright Chromium, viewport **390 × 844**, `fr-FR`, `Europe/Paris`,
  connexion par `/api/demo-login` (variable Preview `DEMO_AUTO_LOGIN=true`, compte de démo
  uniquement), lecture seule — aucune écriture, aucune donnée réelle modifiée.
- **Script** : `/tmp/verify-preview2.mjs` (hors dépôt), traces : `APERCU-FINAL-REPORT.json`.

## Résultats observés

| Étape | Résultat |
|---|---|
| `/api/demo-login` | Redirige vers `/compte`, session de démo active. |
| `/communaute` | Rendu du fil v1 (normal, le drapeau V2 ne change pas le fil) + bouton d'ouverture. |
| Ouverture Explorer (bouton « Explorer et rechercher ») | Feuille v2 montée : `cv2-sheet` **8→382 × 50→836** (carte clippée /compte), capsule 56 px **8→382 × 68→137**. |
| Volets | Recherche, Carnets, Clubs, Sorties : les 4 onglets de capsule basculent (captures). |
| Échap | Feuille démontée (`cv2-sheet` absent après fermeture) — fermeture clavier OK. |
| Ouverture Création (bouton « Créer dans l'application ») | Feuille v2 montée (aperçu vivant, mini-capsule des 6 types, étape 1/3). |

Captures : `captures-v2/apercu-final-*.png` (7 PNG) + `APERCU-FINAL-REPORT.json`.

## Limites constatées (conformes au blocage J-08)

- Les RPC `community_carnets_feed`, `community_clubs_feed` (et suivantes) renvoient **404** sur
  la base de production : les migrations ne sont pas appliquées (sauvegarde absente, J-08).
  L'Explorer affiche donc ses **états d'erreur propres** (« Carnets indisponibles — Réessayer »)
  et les données réelles du fil v2 ne peuvent pas être recettées ici ; les parcours de données
  sont prouvés sur le build local à backend simulé (`PREUVES.md`, `integration/`).
- `pageerror: TypeError: Cannot read properties of null (reading 'appendChild')` sur le chunk
  applicatif 5032 : **pré-existant sur `main`/la production** (même erreur mesurée sur
  `https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app`,
  aucun rapport avec les tiroirs v2). À traiter dans un chantier séparé.
- Aucun 5xx ; aucun débordement horizontal (scrollWidth = innerWidth = 390).
