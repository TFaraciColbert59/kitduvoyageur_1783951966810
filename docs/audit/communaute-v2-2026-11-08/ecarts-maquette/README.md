# Inventaire des écarts avec la maquette — Communauté v2

Ce dossier compare les **tiroirs livrés** (Explorer + Création, sous-tiroirs et formulaires)
à la **maquette** de référence (`handoff/communaute-v2/annexes/maquette-communaute.html` et ses
58 captures 390×844 dans `docs/audit/communaute-v2-2026-11-08/recette/captures-maquette/`).

## Contenu

| Fichier | Rôle |
|---|---|
| `captures-v2/` | **82 captures** (390×844 + variantes 360/430) du build V2 (données simulées `@ui-mock`, zéro réseau/base), + `MANIFEST.json` |
| `capture-all.spec.ts` | Spec Playwright de capture (rejouable : voir en tête du fichier) |
| `VERIFIER.sh` | Pipeline de vérification complet (build, vitest, e2e ×2, axe, captures) |
| `playwright.capture.config.ts` | Config Playwright dédiée (viewport 390×844) |
| `ECARTS-MAQUETTE.md` | **Index + synthèse** des écarts (gravités, décisions, suites) |
| `BILAN-FIDELITE.md` | **Résultat du chantier de fidélité** (83/85 comblés, preuves, blocages J-08, reprise) |
| `CHECKLIST-100.md` | Suivi item par item (cases, statuts, journal de progression) |
| `BACKLOG-100.md` | Backlog exhaustif dédupliqué (85 items, lots, preuves) |
| `GALERIE.html` | Galerie appairée des captures V2 ↔ maquette |
| `finition.spec.ts` + `playwright.finition.config.ts` | Captures de **finition** app + maquette dans le même état : 360/430 au-delà de l'étape 1, thème sombre de chaque tiroir, Création vide/chargement/erreur, invité (sortie : `captures-finition/`) |
| `audit-transverses.spec.ts` | Audit transversal : contraste AA des libellés sur le fond réel, rayon du focus clavier, cibles tactiles ≥ 44 px (sortie : `audit-transverses.json`) |
| `ECARTS-EXPLORER.md` | Détail des écarts — tiroir Explorer et ses sous-tiroirs |
| `ECARTS-CREATION.md` | Détail des écarts — tiroir Création, 6 formulaires, sous-tiroirs |
| `ECARTS-TRANSVERSES.md` | Écarts transverses (couleurs, typo, rayons, motion, densités, états) |

## Rejouer les captures

Prérequis : build V2 servi sur `http://127.0.0.1:4028` (`NEXT_PUBLIC_COMMUNAUTE_V2=true`,
`NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co`).

```bash
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key PW_BASE_URL=http://127.0.0.1:4028 \
npx playwright test \
  --config=docs/audit/communaute-v2-2026-11-08/ecarts-maquette/playwright.capture.config.ts
```

## Correspondance captures V2 ↔ références maquette

| Domaine | Captures V2 | Références maquette |
|---|---|---|
| Recherche | `explorer-recherche*`, `explorer-etat-*` | `explorer-recherche.png`, `recherche-*.png`, `etat-st-*.png` |
| Carnets | `explorer-carnets*` | `explorer-carnets.png`, `explorer-carnets-peek.png`, `explorer-carnets-tri-menu.png` |
| Clubs | `explorer-clubs*`, `explorer-ile` | `explorer-clubs.png`, `clubs-chips.png`, `clubs-filtre-activite.png`, `clubs-peek.png`, `explorer-clubs-detail.png` |
| Sorties | `explorer-sorties*`, `explorer-agenda-jour` | `explorer-sorties.png`, `explorer-sorties-detail.png` |
| Publication | `creation-publication-*` | `creation-publication-etape1/2/3.png`, `pub-etape1-*.png`, `pub-etape2-contenu.png`, `pub-etape3-diffusion.png` |
| Story | `creation-story-*` | `creation-story-etape1/2/3.png`, `story-e1/e2/e3.png` |
| Carnet | `creation-carnet-*` | `creation-carnet-etape1.png`, `carnet-e1..e4.png` |
| Sortie | `creation-sortie-*` | `creation-sortie-etape1/2.png`, `sortie-e1..e4.png` |
| Kit | `creation-kit-*` | `creation-kit-etape1/2.png`, `kit-e1..e3.png` |
| Club | `creation-club-*` | `creation-club-etape1/2.png`, `club-e1..e4.png` |
| États / gestes | `explorer-etat-*`, `explorer-carnets-peek`, `creation-fermeture-confirmation`, `creation-brouillon`, `creation-succes-ile` | `etat-st-*.png`, `ferme-par-echap.png`, `echap-ferme-menu-seulement.png`, `role-invite-explorer.png` |

## Déjà documenté ailleurs (ne pas recompter deux fois)

- `handoff/communaute-v2/JOURNAL.md` — décisions, exceptions (`01 § 6`), J-01…J-13.
- `docs/audit/communaute-v2-2026-11-08/integration/RAPPORT-INTEGRATION.md` — écarts visuels et
  corrections du harnais d'intégration.
- `docs/audit/communaute-v2-2026-11-08/COUVERTURE-200.md` — 187 fait (dont 4 dépendant de la production) /
  0 partiel / 0 non fait / 13 reporté, avec preuves par numéro (état du 2026-11-10).
