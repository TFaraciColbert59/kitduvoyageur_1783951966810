# Décisions du chantier (à ne pas rouvrir)

**KS-001 — Création, pas migration.** Le dépôt n'a pas de Kit Studio ; on crée `src/features/kit-studio/` et on porte la maquette. *Conséquence* : aucune dépendance sur `compas`.

**KS-002 — Tiroir dans la WebView.** Les cartes contiennent des vignettes WebGL et des gestes riches ; une feuille SwiftUI/UIKit ne peut pas les héberger sans réécrire la 3D en SceneKit. On reproduit fidèlement la feuille Apple (détente, poignée, verre, élasticité, glissement de fermeture) en web. *Réévaluable plus tard* via `NATIVE_UI_BRIDGE` pour des feuilles de confirmation seulement.

**KS-003 — Une seule hauteur : 30 %.** Pas de détentes multiples en v1 (le brief demande « hauteur max »). Les contenus longs défilent dans le tiroir.

**KS-004 — three.js embarqué (npm), jamais de CDN.** La CSP du dépôt bloque jsDelivr ; le hors ligne est une exigence.

**KS-005 — Persistance en 3 étages.** Local d'abord, compte ensuite, lignées en bonus (voir `SPEC-ARCHITECTURE.md`). Pas de migration sans validation Opus et rollback.

**KS-006 — Annuler.** Le bouton flottant disparaît (brief) ; l'annulation reste possible via une icône ↺ dans la capsule de mode, visible seulement quand la pile n'est pas vide. Aucun toast.

**KS-007 — Pas de paiement en v1.** « Commander » prépare la commande (liste de pièces, total) et ouvre le parcours boutique existant ; aucun flux Stripe nouveau.

**KS-008 — Couleurs par tokens.** Aucune couleur littérale nouvelle ; les teintes d'objets passent par `palette.ts`.

**KS-009 — Appareil de référence : iPhone 16 Pro (402 × 874).** Les autres tailles servent de contrôle.

**KS-010 — Pas de coordination humaine.** En cas d'ambiguïté : trancher selon ces ADR et `BRIEF-TONY.md`, consigner dans `docs/kit-studio/JOURNAL.md`. Seuls blocages légitimes : un secret absent, une suppression de données irréversible, un refus d'un outil.
