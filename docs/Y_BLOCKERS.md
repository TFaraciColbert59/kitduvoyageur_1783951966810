# Y_BLOCKERS — Blocages du chantier Y

Format : sous-phase · tenté · sortie · hypothèses écartées · décision requise · impact.

---

## B1 — Y0.1 : fusion de la PR #31 impossible par l'agent

- **Sous-phase** : Y0.1 (fusionner PR #31).
- **Tenté** : `gh --version` → binaire absent de l'environnement (confirmé deux fois).
- **Sortie** : aucune (commande introuvable) ; remote = HTTPS
  `https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810.git`.
- **Hypothèses écartées** : push direct sur `main` — **interdit par §7.2** ; fusion
  locale + push main — même interdit ; API REST sans token — aucune cred disponible.
- **Décision requise (Tony)** : fusionner la PR #31 dans l'interface GitHub après
  correction de son corps (les 4 commits `6581a6ec`, `cabd5c24`, `3d7f7eaf`,
  `c1c981cb` sont poussés et les portes G1/G2/G3 vertes dessus). Puis activer la
  protection de branche (réglage repo).
- **Impact** : `chantier/y-hub-voyage` ne peut pas être créée depuis le nouveau
  `main`. Le chantier continue sur les sous-phases indépendantes de Y0 (Y0.2 →
  Y0.7) sur la branche X, conformément au §7.4 ; la bascule de branche se fera
  dès la fusion effective (rebase des commits Y0 déjà produits si nécessaire).
