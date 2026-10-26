# Branche `chantier/pays-refonte` — ce qui reste, ce qui part

**Base** : `main` @ `0e0a35e4` (commit de la grammaire déployée) · **Prod** : Cloudflare Worker `kitduvoyageur`, branche miroir `deploy/cf-pays`.

## Gardé (fonctionnel, dernière version)

| Fichier | Rôle | Preuve |
|---|---|---|
| `src/components/pays/PaysGlassV8.tsx` | Fiche pays : coquille verrouillée + contenu (cartes média/compactes, recherche, filtres, états, volets) | porte 17/17 |
| `src/components/pays/CountryMap.tsx` | Carte réelle déplaçable + zoom + contrôles + attribution | captures |
| `src/components/pays/formatPays.ts` | Nombres, surfaces, distances, dates, pluriels | 10 tests |
| `src/components/pays/{Destinations,Activites,Culture,Gastronomie,Hebergements,Pratique,Communaute}View.tsx` | Vues détaillées montées dans le volet « Détails » | test de câblage |
| `src/components/pays/{PaysClubsList,PaysCarnetsList,BouteilleALaMer}.tsx` | Listes communauté (utilisées par la vue Communauté) | — |
| `src/design/account/{liquid-lens.ts,AccountDrawerHost.tsx}` | Lentille liquide partagée + drawer 406 × 708,3 | porte |
| `src/styles/account-glass.css` | Épingles + primitives de contenu (source unique) | porte |
| `src/app/pays/[code]/CountryDetailClient.tsx` | Coquille + volet Détails (vues historiques) | test |
| `src/components/account/AccountBottomBar.tsx` | Barre 48, 5 items, `renderAs="button"`, pastille | porte |
| `scripts/design/design-fidelity.mjs` `design-diff.mjs` | Porte 17/19 ancres + diff pixel | exécutés |
| `src/components/carnet/profile/CarnetProfileView.tsx` | Fiche carnet refondue | porte 19/19 |
| `tests/features/discovery/wiring.spec.ts` | Câblage Discovery aligné sur l'architecture actuelle | 3 tests |
| `docs/superpowers/plans/2026-10-25-pays-contenu-20.md` | Plan des 20 améliorations de contenu | — |

## Supprimé (mort, 0 import)

| Fichier | Lignes | Raison |
|---|---|---|
| `src/components/pays/MobileCountryDetailView.tsx` | 560 | remplacé par `PaysGlassV8` |
| `src/components/pays/PaysHeroOverview.tsx` | 284 | desktop 3 colonnes supprimé |
| `src/components/pays/PaysLeftSidebar.tsx` | 162 | idem |
| `src/components/pays/PaysRightSidebar.tsx` | 133 | idem |

## Nettoyé ailleurs

- CSS : anciennes générations de drawer (`data-det=open`, `.sh-h/.sh-t/.sh-b`), `.lkdv-info-card`, bouton fermer retiré → **472 lignes en moins**.
- `account-grammar-pins.css` : doublon vidé (les épingles vivent dans `account-glass.css`), le fichier reste pour l'import de `MessagesScreen`.
- `audit-pays/` : 113 captures intermédiaires → **6 preuves + 9 références** (18 Mo au total), 6 rapports.
- Test `wiring.spec.ts` réécrit pour l'architecture actuelle (même intention : les blocs partenaire restent câblés).

## État vérifié

| Contrôle | Local | Prod Cloudflare |
|---|---|---|
| `/pays/fr` — 430 / 768 / 1440 | **17/17 · 17/17 · 17/17** | **17/17 · 17/17 · 17/17** |
| `/carnets/[id]` — 430 / 768 / 1440 | **19/19 · 19/19 · 19/19** | (branche vinext : autre implémentation) |
| Tests pays + discovery | **138 / 138** | — |
| Build Next / vinext | OK | version `a9d1fe20` |

## Décisions ouvertes (hors nettoyage)

1. Carnet refondu ↔ carnet vinext : deux implémentations, à fusionner ou à trancher.
2. Hub `/carnets` : encore legacy.
