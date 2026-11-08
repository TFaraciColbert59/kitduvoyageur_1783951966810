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
npx playwright test tests/e2e/communaute-v2*.spec.ts --project=mobile-webkit --project=mobile-chromium --project=desktop-chromium
npm run test:visual              # références mises à jour UNIQUEMENT pour tests/visual/community-*
```
**Pour que ces tests s'exécutent vraiment** : `playwright.config.ts` limite `testMatch` à une liste fermée → ajoute `tests/e2e/communaute-v2*.spec.ts` ; le job `quality-gates` de `ci.yml` (≈ L88) n'exécute que quelques specs → ajoute une étape pour la tienne ; le job a11y ne lit que `tests/a11y/e2e` → ajoute `tests/a11y/e2e/communaute-v2-a11y.spec.ts`. Vérifie dans la sortie que tes tests sont comptés (jamais « No tests found »).

Vérifie les noms exacts dans `package.json` (voir `annexes/J-schema-communaute.md` § 7) ; si un script n'existe pas, utilise l'équivalent du dépôt et note-le. Plus la CI GitHub complète (dont `database-gates`) verte sur la PR.

## 2. Tests à écrire

**Unitaires (vitest)** : mappers de tuiles (carnet, club, sortie), formatage FR (dates entières, distances, poids, pluriels), clés de tri, regroupement de l'agenda (ce week-end / semaine prochaine / plus tard), surlignage du terme (accents compris), brouillon (écriture, restauration, purge après succès, exclusion des `blob:`), validation par étape de chaque schéma, calcul poids de kit et objectif ultraléger, génération de blason déterministe, `.ics`.

**Composants (Testing Library)** :
- Capsule 4 volets / 6 types, mini-capsule, clavier ←/→/Home/End, roving tabindex, `aria-*`.
- Bouton de tri : présent sur Carnets et Clubs seulement, absent en Recherche et Sorties et quand un détail est empilé ; menu `role=menu`, coche, point vert si tri ≠ défaut, Échap ferme le menu sans fermer le tiroir, clic extérieur, ↑ ↓, Tab.
- Moteur : Retour masqué à l'étape 1, Suivant bloqué avec focus sur le champ fautif, erreur affichée une seule fois, libellés visibles, flèches inertes dans un champ, bandeau brouillon, confirmation de fermeture avec piège de focus.
- Piège de focus et retour du focus, ordre d'Échap (`01` § 2).

**pgTAP** : tous les scénarios de `03` § 8, exécutés uniquement en local et en CI (`database-gates`), **jamais contre la prod**.

**E2E Playwright** (`tests/e2e/communaute-v2.spec.ts`, comptes de démo, données de test privées) :
1. Ouvrir Explorer par chaque déclencheur ; changer de volet par la capsule ; glisser entre filtres dans les deux sens ; fermer par poignée et Échap ; fond inerte.
2. Carnets : trier par Populaires via le menu, vérifier l'ordre et le point vert ; j'aime sans ouvrir la fiche ; Peek ; état vide « Mes carnets » → Création › Carnet.
3. Clubs : chip d'activité, tri Taille, détail empilé + Retour, Rejoindre (club ouvert) puis Annuler via l'île ; club sur validation → « Demande envoyée » puis, côté admin, « Demandes (1) » → Accepter → membre ; double clic = une seule adhésion.
4. Sorties : jour de l'agenda, détail, S'inscrire, sortie complète → liste d'attente, `.ics` téléchargé.
5. Recherche : « chamonix » trouve « Chamonix » ; « lac, blanc » ne casse pas ; erreur réseau simulée → « Recherche indisponible » + Réessayer ; ↑ ↓ Entrée ; « Sur la carte ».
6. Création (sur base locale ou éphémère, jamais la prod pour Sortie et Club), pour chacun des 6 types : provoquer une erreur, corriger, fermer (confirmation), rouvrir (brouillon restauré), publier, vérifier en base (et l'île). Sortie : la publication d'annonce existe ; Club : l'admin existe ; Carnet : photos téléversées, couverture, visibilité.
7. Clavier mobile simulé : le pied reste visible au-dessus du clavier.
8. Invité : Explorer lisible, toute écriture → `requireAuth`.
9. 360/390/430 px : aucun débordement horizontal, aucune erreur console, aucune requête en échec ; `prefers-reduced-motion`.
10. Stories : lecture d'une vidéo rognée (trim) et lien carnet masqué à un lecteur sans accès ; stories existantes inchangées.
11. Drapeau à `false` : les anciens tiroirs s'affichent et fonctionnent.

**Visuel** : captures 390×844 de chaque volet, filtre, menu de tri ouvert, détail, et de chaque étape des 6 formulaires, comparées à la maquette (tolérance documentée) ; `/compte` inchangé.

**Maestro (iOS)** : `.maestro/communaute.yaml` sur le modèle de `.maestro/compte.yaml` : lancement, Explorer, tri, détail club, Création › Story jusqu'à l'envoi en audience « Moi uniquement » (compte de démo), puis suppression.

## 3. Revue
Avant la fusion : relecture indépendante (sous-agent, ou revues « icon-security-review » et « icon-design-review » du dépôt) des migrations, RPC `security definer`, RLS et de l'écran. Corriger tout point bloquant, noter le reste dans le journal.
