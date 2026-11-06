# Tâches (source : `backlog.json`)

Les vagues indiquent ce qui peut partir **en parallèle**. Chemin critique : T00 → T02 → T10 → T11 → T14 → T19 → T21 → T22 → T24 → T25.

| Id | Vague | Tâche | Agent | Modèle · effort | Dépend de | Tours max |
|---|---|---|---|---|---|---|
| T00 | 1 | Bootstrap, branche, mesure de départ | `ks-ops` | Haiku · bas | — | 10 |
| T01 | 2 | Plan du dépôt (REPO-MAP) | `ks-scout` | Haiku · bas | T00 | 12 |
| T02 | 2 | Ajouter three et vérifier CSP/transpile | `ks-ops` | Haiku · bas | T00 | 10 |
| T03 | 2 | Générer le catalogue brut depuis la maquette | `ks-scribe` | Haiku · bas | T00 | 12 |
| T04 | 3 | Palette par tokens + format | `ks-builder` | Sonnet · moyen | T03, T01 | 20 |
| T05 | 3 | Domaine : totaux, capacités, place restante | `ks-builder` | Sonnet · moyen | T03 | 25 |
| T06 | 4 | Domaine : équilibre, blocages, « Prêt à N % » | `ks-builder` | Sonnet · moyen | T05 | 25 |
| T07 | 4 | Domaine : rangement, échange, rangement auto | `ks-builder` | Sonnet · moyen | T05 | 25 |
| T08 | 3 | Domaine : pièces, points d'attache, commande | `ks-builder` | Sonnet · moyen | T03 | 25 |
| T09 | 5 | Store et persistance étage 1 (local) | `ks-builder` | Sonnet · moyen | T05, T07, T08 | 25 |
| T10 | 4 | Scène : cycle de vie et sac procédural | `ks-3d` | Sonnet · élevé | T02, T03 | 40 |
| T11 | 5 | Scène : objets, fantômes, caméra de zone, gestes | `ks-3d` | Sonnet · élevé | T10 | 40 |
| T12 | 5 | Vignettes 3D (moteur + cache) | `ks-3d` | Sonnet · élevé | T10 | 30 |
| T13 | 3 | Tiroir : coque, poignée, capsules, pager, pilule | `ks-builder` | Sonnet · moyen | T01 | 25 |
| T14 | 6 | Cartes : rail, carte, capsules de familles et de mode | `ks-builder` | Sonnet · moyen | T09, T12, T13 | 25 |
| T15 | 6 | Feuilles Bilan et Fiche objet | `ks-builder` | Sonnet · moyen | T06, T13 | 25 |
| T16 | 6 | Feuilles Sac/Pièce, Commande, Deck | `ks-builder` | Sonnet · moyen | T08, T13 | 25 |
| T17 | 4 | Libellés, aria, textes | `ks-scribe` | Haiku · bas | T13 | 12 |
| T18 | 6 | Route, chrome masqué, lien d'entrée, hors ligne | `ks-builder` | Sonnet · moyen | T09, T13, T10 | 25 |
| T19 | 7 | E2E WebKit mobile + référence visuelle | `ks-builder` | Sonnet · moyen | T14, T15, T16, T18 | 25 |
| T20 | 8 | Portes automatiques (a11y, perf, vie privée, tsc, lint) | `ks-ops` | Haiku · bas | T19 | 10 |
| T21 | 9 | Correctifs du lot 1 | `ks-builder` | Sonnet · moyen | T20 | 25 |
| T22 | 10 | Relecture indépendante (architecture, données, sécurité, fuites) | `ks-reviewer` | Opus · élevé | T21 | 20 |
| T23 | 11 | Correctifs de la relecture | `ks-builder` | Sonnet · moyen | T22 | 25 |
| T24 | 12 | PR, CI, fusion, production, contrôle, retour arrière si besoin | `ks-ops` | Haiku · bas | T23 | 12 |
| T25 | 13 | Build iOS et installation sur l'iPhone 16 Pro | `ks-ops` | Haiku · bas | T24 | 12 |
| T26 | 14 | Rapport final et grand livre | `ks-scribe` | Haiku · bas | T25 | 8 |

## Critères d'acceptation

- **T00** — Branche claude/kit-studio-v2 créée ; agents, skills, MCP installés ; tsc, lint et Vitest de départ consignés (nombre d'échecs déjà présents noté, pour ne pas les imputer au chantier). _(fichiers : scripts/bootstrap.sh, docs/kit-studio/JOURNAL.md)_
- **T01** — Fichier ≤ 150 lignes : tokens --lkv-*, MobileNavWrapper/HIDE_CHROME_PREFIXES, hooks haptiques, @capacitor/preferences, schéma materiel_kits/trip_items (migrations), scripts verify/*, config Playwright, commandes de test exactes. _(fichiers : docs/kit-studio/REPO-MAP.md)_
- **T02** — three + @types/three fixés ; next build non cassé ; aucune URL externe ajoutée à la CSP. _(fichiers : package.json, package-lock.json, next.config.mjs)_
- **T03** — Script reproductible lisant reference/Kit_Studio_actuel.html (l. 535-751) ; 39 objets, 2 sacs, 4 coloris, 6 modules, 3 kits, 8 zones, 6 familles ; TS typé ; test de comptage. _(fichiers : scripts/port-catalog.mjs, src/features/kit-studio/domain/catalog.ts)_
- **T04** — Aucune couleur littérale hors palette.ts ; formats g/kg/€/% avec espaces insécables testés ; test échoue si un hex apparaît ailleurs dans kit-studio/. _(fichiers : domain/palette.ts, domain/format.ts, __tests__/format.test.ts)_
- **T05** — totals, capOf, room, effG, bagWeight portés (l. 700-860 de la maquette) ; un test par règle, cas limites inclus. _(fichiers : domain/totals.ts, __tests__/totals.test.ts)_
- **T06** — cog/cogState, blockers, gain de préparation ; tests dont « trop loin du dos » et « trousse périmée ». _(fichiers : domain/balance.ts, domain/blockers.ts, __tests__/balance.test.ts)_
- **T07** — pack, unpack, swap, relocate, autopack ; zone pleine → zone alternative ; déterministe. _(fichiers : domain/packing.ts, domain/swap.ts, __tests__/packing.test.ts)_
- **T08** — pieces, pieceState, ptsCap/ptsUsed, toOrder, orderTotal ; total en centimes entiers. _(fichiers : domain/parts.ts, domain/attach.ts, domain/order.ts, __tests__/order.test.ts)_
- **T09** — zustand ; zod valide toute lecture ; clé lkdv-kit-studio:v1 ; migration de version testée ; hors ligne OK ; pile d'annulation. _(fichiers : store/*, services/kitRepository.ts, domain/schema.ts, __tests__/store.test.ts)_
- **T10** — Boucle à la demande, perte/restauration de contexte, dispose complet (renderer.info.memory stable sur 20 cycles), sac et pièces conformes à la maquette (captures comparées). _(fichiers : scene/createScene.ts, scene/bagBuilder.ts, scene/lifecycle.ts, __tests__/scene.lifecycle.test.ts)_
- **T11** — Orbite, inclinaison, pincement, double toucher, glisser d'objet ; alternatives clavier ; caméra pilotée par dk (SPEC-DRAWER). _(fichiers : scene/itemMesh.ts, scene/ghosts.ts, scene/camera.ts, scene/gestures.ts)_
- **T12** — Un renderer partagé, clé de cache, file d'attente, repli SVG ; 12 vignettes < 600 ms mesurées. _(fichiers : scene/thumbnails.ts, __tests__/thumbnails.test.ts)_
- **T13** — Hauteur 30 % toutes vues ; pilule à 2 px ; capsules icônes seules ; focus et Échap ; mouvement réduit. _(fichiers : ui/Drawer/*, ui/Pill.tsx, ui/kit-studio.css, __tests__/drawer.test.tsx)_
- **T14** — 3 cartes visibles, nom 2 lignes max sans chevauchement, sélection sans bordure colorée, glisser vers le sac. _(fichiers : ui/cards/*)_
- **T15** — 4 pages Bilan, fiche (mesures en grille, Échanger, Histoire) ; scroll confiné ; aucun élément sous la barre basse. _(fichiers : ui/sheets/BilanSheet.tsx, ui/sheets/ItemSheet.tsx)_
- **T16** — Commander vit dans le tiroir ; total exact ; deck valide carte par carte ; pas de flux de paiement. _(fichiers : ui/sheets/BagSheet.tsx, ui/sheets/OrderSheet.tsx, ui/sheets/DeckSheet.tsx)_
- **T17** — Toutes les chaînes FR centralisées ; chaque bouton icône a un aria-label ; liste de contrôle a11y remplie. _(fichiers : ui/strings.ts)_
- **T18** — /kit-studio rend sans tab bar ; lien depuis le hub ou le matériel (jamais depuis /compas) ; loading/error ; dynamic ssr:false pour la scène. _(fichiers : src/app/kit-studio/*, MobileNavWrapper.tsx, lien hub/matériel)_
- **T19** — Parcours complet à 402×874 ; 4 tailles ; balayage « aucune bordure colorée » ; captures de référence enregistrées. _(fichiers : tests/e2e-kit-studio/*)_
- **T20** — Script vert ou liste d'échecs ≤ 30 lignes ; garde-fou /compas intact. _(fichiers : scripts/verify-kit-studio.sh)_
- **T21** — Tous les échecs de T20 corrigés, test de non-régression ajouté pour chacun.
- **T22** — ≤ 30 lignes : bloquants / importants / mineurs, chacun avec fichier:ligne et correction proposée. _(fichiers : docs/kit-studio/REVIEW.md)_
- **T23** — Bloquants et importants fermés avec test ; mineurs consignés.
- **T24** — CI verte, fusion sur main, déploiement vérifié sur l'URL de production (HTTP 200, route rend, capture), sinon retour arrière immédiat.
- **T25** — Sur Mac relié : app installée et lancée ; sinon IPA de la CI + fiche de 5 minutes prête (voir ios/RUN-ON-IPHONE.md). _(fichiers : ios/RUN-ON-IPHONE.md)_
- **T26** — Livré, preuves, part de tours par modèle, limites, action restante pour Tony (s'il y en a une). _(fichiers : docs/kit-studio/RAPPORT-FINAL.md, docs/kit-studio/LEDGER.md)_

Chemins relatifs de `src/features/kit-studio/` sauf indication contraire.