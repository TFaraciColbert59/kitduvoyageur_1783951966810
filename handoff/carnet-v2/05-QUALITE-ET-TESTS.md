# 05 — Qualité et tests

## 1. Portes à passer avant chaque push sur `main` (toutes vertes, aucune exception)
```bash
npx tsc --noEmit -p .
npm run lint                     # 0 erreur, 0 nouveau warning
npm test                         # vitest, réseau interdit en test
npx vitest run tests/design/unification.spec.ts
npm run build
npm run perf:budget
npm run verify:invariants
npm run verify:icons
npm run test:a11y                # 0 critical / serious
npx playwright test tests/e2e/carnet-v2*.spec.ts --project=mobile-webkit --project=mobile-chromium --project=desktop-chromium
npm run test:visual              # mettre à jour les références UNIQUEMENT pour la fiche carnet, jamais pour /compte
```
Plus la CI GitHub complète (`ci.yml`, dont `database-gates`) verte sur la PR.

## 2. Tests à écrire
**Unitaires (vitest)** : builders (`nights`, réactions par jour, verdicts, budget, rôle), formatage FR (km, m, €, dates, pluriels), deep link d'entrée, sélection des couches de carte par tiroir/lentille, regroupement des stories par auteur, garde `null` lat/lng.

**Composants (Testing Library)** : capsule 5 slots et 18 lentilles (rôle visiteur = 17, sans Budget), clavier ←/→/Home/End, roving tabindex, `aria-*`, piège de focus et retour du focus, Échap (ordre : story → aperçu → menu → popover → tiroir), pilule « Reprendre » visible seulement Sac/fiche objet, nuit cliquable, fiche participant avec grille, Réactions (like, envoi, suppression, annulation).

**pgTAP** : les 7 scénarios de `03` § 6.

**E2E Playwright** (`tests/e2e/carnet-v2.spec.ts`, comptes de démo, carnet de test) :
1. Participant : ouvrir la fiche, changer de jour par glisser dans les deux sens, par capsule, par trace sur la carte.
2. Ouvrir chaque tiroir et chaque lentille ; glisser entre lentilles ; fermer par poignée et par Échap.
3. Toucher une photo → post ; aimer ; commenter ; ouvrir partage ; fermer par glisser.
4. Couverture → stories ; pause au maintien ; répondre → message reçu dans `/messagerie` du destinataire de test.
5. Participant → fiche avec grille → post.
6. Route › Nuit → focus carte + fiche nuit.
7. Réactions : aimer le jour 2, commenter le jour 2, vérifier que le jour 3 n'a ni ce like ni ce commentaire.
8. Visiteur : pas de `+`, pas de Gérer, pas de Budget, position = zone, peut aimer/commenter ; carnet privé → 404.
9. Mode modification : ajouter une nuit, un verdict, un moment texte ; annuler via l'île.
10. 360/390/430 px : aucun débordement horizontal, aucune erreur console, aucune requête en échec.

**Visuel** : captures 390×844 de chaque tiroir/lentille comparées à la maquette (tolérance documentée) ; `/compte` inchangé (références existantes).

**Maestro (iOS)** : `.maestro/carnet.yaml` : lancement, ouverture d'un carnet, tiroir, post, story, retour.

## 3. Revue
Avant la fusion : relecture indépendante (sous-agent ou revue « icon-security-review » et « icon-design-review » du dépôt) des migrations/RLS et de l'écran. Corriger tout point bloquant, noter le reste dans le journal.
