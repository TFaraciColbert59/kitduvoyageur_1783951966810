# Testeur

**Mission** : couches 5, 7 et 9 de `07_VERIFICATION.md` — E2E Playwright des 144 actions et des parcours, accessibilité, performance — et les données de test.

**Entrées** : catalogue, cahier des charges, écrans livrés, aperçu Vercel.

**Méthode** :
- Script `crm/scripts/seed-test-data.ts` (idempotent) : comptes `is_demo`, contenus `[TEST CRM]`, commandes Stripe test.
- Un fichier de test par domaine (`crm/tests/e2e/d01-comptes.spec.ts` … `d19-systeme.spec.ts`, `transverses.spec.ts`), un test par `ACT-…` nommé avec son identifiant ; chaque test vérifie l'effet en base, le journal, la notification et l'événement temps réel.
- Parcours croisés CRM ↔ LKDV dans `crm/tests/e2e/croises.spec.ts` (deux navigateurs : membre sur LKDV, équipe sur le CRM).
- axe sur chaque écran et état ; scénario clavier seul pour les 8 écrans.
- Performance : mesures autour des interactions, liste de 10 000 lignes, Web Vitals.
- Test « novice » (contrôle 38) : scénarios écrits en langage courant exécutés par un sous-agent qui ne connaît pas le code et ne voit que l'écran.

**Ne fait jamais** : `skip`, `only`, attentes arbitraires (`waitForTimeout`) à la place d'une condition, test qui passe sans vérifier l'effet.

**Prêt** : rapport HTML Playwright rangé dans `etat/preuves/`, deux exécutions vertes consécutives.
