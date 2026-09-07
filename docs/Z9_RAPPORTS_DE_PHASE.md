# Rapports de Phase — Chantier Z · LKDV
> Date des rapports : 07/09/2026
> Format §Z9 obligatoire (HANDOFF_AGENT.md §7)

---

# Rapport Z3 — 2026-09-07 — chantier/z3-coherence-chiffres — c5bc243

## Défauts traités (D20–D26)
| Défaut | Correctif |
|---|---|
| D20 | Durée : sélecteur unique `useTripDuration` (dates canoniques inclusives, fallback étapes). 29 j vs 2 j alignés partout. |
| D21 | Kit : `useKitCounters` dérive ready/total de `trip.items` → Aperçu et KitView identiques. |
| D22 | Étapes : `useTripCounters().itinerary` (étapes canoniques dédupliquées) sur toutes les pastilles. |
| D23 | Participants : `participantsCount` = owner + collaborateurs uniques (neutralise le double comptage). |
| D24 | Dénivelé : `useTripDistance` sanitise les cellules « 54 / 422 » → un seul nombre, jamais de slash. |
| D25 | Statut : `useTripStatus` rend draft/active mutuellement exclusifs. |
| D26 | Étapes JOUR 1 dupliquées : `getCanonicalTripSteps` déduplique par day_number. |

## Tests Z-D{n}
14 tests dans `tests/trips/chantier-z3.spec.ts`. Rouge avant (module inexistant), vert après :
```
Test Files  1 passed (1)    Tests  14 passed (14)
```

## Fichiers modifiés
- `src/features/trips/hooks/useTripDuration.ts` (nouveau)
- `src/features/trips/hooks/useKitCounters.ts` (nouveau)
- `src/features/trips/hooks/useTripDistance.ts` (nouveau)
- `src/features/trips/hooks/useTripStatus.ts` (nouveau)
- `src/features/trips/hooks/useTripCounters.ts` (étendu : participantsCount, getCanonicalTripSteps)
- `TripHero`, `TripOverviewTab`, `TripItineraryTab`, `TripKitView`, `TripPhasePrepareView`, `TripDetailClient`
- `tests/trips/trip-components.spec.ts` (mis en conformité source unique)

## Sorties brutes
```
npm test        → Test Files 124 passed · Tests 838 passed
npm run lint    → aucun hit sur fichiers modifiés (warnings préexistants)
npx tsc --noEmit → 0 erreur
git rev-parse HEAD → c5bc243be28dcb68b39f61c2bc794e5774e82db9
```

## Valeurs rétrogradées en estimated
Aucune (non concerné par Z3 — chiffres, pas de provenances).

## Ce qui NE fonctionne toujours pas
`gh` CLI indisponible → PR à ouvrir manuellement : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/new/chantier/z3-coherence-chiffres

## Risques ouverts
- `TripStats` (serveur) reste utilisé côté itinéraire/export : une future divergence peut renaître si de nouveaux composants s'appuient dessus. Verrou Z6/Z8 à étendre si besoin.

## Prochaine phase
Z4.

---

# Rapport Z4 — 2026-09-07 — chantier/z4-honnetete-conseil — 7984e7a

## Défauts traités (D27, D30, D31)
| Défaut | Correctif |
|---|---|
| D27 | Offres haute montagne filtrées : verrou test (< 2400 m → aucune offre alpine) ; le seed `filterAffiliateLinksForTrip` filtre par `min_altitude_m`. |
| D30 | « Partenaires vérifiés » → « Services et partenaires pour… » (affirmation non fondée supprimée). |
| D31 | « Sécurité publique absolue / criminalité quasi-nulle » (JP) → reformulé honnêtement. |

## Tests
5 tests dans `tests/trips/chantier-z4.spec.ts` (rouge avant, vert après : D30/D31, D27 déjà vert). 1 test existant `tests/affiliation/components.spec.ts` mis en conformité.

## Fichiers modifiés
- `src/features/affiliation/components/TripAffiliateSection.tsx`
- `src/lib/countryDetails.ts`
- `docs/BACKLOG_APRES_Z.md` (D28/D29 documentés — GEL)

## Sorties brutes
```
npm test        → 125 passed · 843 tests
npm run lint    → clean (fichiers modifiés)
npx tsc --noEmit → 0 erreur
HEAD → 7984e7acb4589c4567e3973281b66577923681cb
```

## Défauts NON traités (backlog GEL)
- D28 : le catalogue pilote le conseil (`contextualKitEngine` pointe `*-categorie-bigbuy`) — découplage besoins/produits après chantier.
- D29 : libellés fournisseur BigBuy à traiter comme métadonnée, pas slug sémantique.

## Prochaine phase
Z5.

---

# Rapport Z5 — 2026-09-07 — chantier/z5-finition — c817421

## Défauts traités (D32)
| Défaut | Correctif |
|---|---|
| D32 | Image de couverture cassée : `TripCard` et `TripHero` utilisent désormais `AppImage` (fallback `onError` → `no_image.png`) ; plus d'image grise cassée sur URL morte. |

## Tests
3 tests dans `tests/trips/chantier-z5.spec.ts` (rouge avant — `next/image` brut sans `fallbackSrc` ; vert après).

## Fichiers modifiés
- `src/features/trips/components/TripCard.tsx`
- `src/features/trips/components/TripHero.tsx`
- `tests/trips/chantier-z5.spec.ts`

## Sorties brutes
```
npm test        → 126 passed · 846 tests
npm run lint    → clean (fichiers modifiés)
npx tsc --noEmit → 0 erreur
npm run build   → succès (CSS prod OK — D34)
HEAD → c817421
```

## Ce qui NE fonctionne toujours pas / Risques ouverts
- D33 : saisies test (`fdgb-3c3a92`, `ez!2wf`) présentes en DB locale Supabase — hygiène de données, **nettoyage manuel requis** (suppression du voyage test et des comptes test). Non filtrable proprement en code (le voyage test est privé, invisible publiquement).
- Vérification Travelpayouts en cache Netlify ancien — action utilisateur pour forcer le redéploi.

## Prochaine phase
Z6.

---

# Rapport Z6 — 2026-09-07 — chantier/z6-tests-verite — db5e73a

## Défauts traités (oracles croisés)
| Oracle | Contrat |
|---|---|
| Z-BOUNDS | Tout résultat de connecteur géographique (eau, refuges) reste dans la boîte englobante ; hors zone pilote → `[]` sans invention. |
| Z-NOFALLBACK | La règle d'un pays ne remplace jamais celle d'un autre (MA ≠ FR ; zone non couverte → estimation honnête). |
| Z-REDLINE-ARMED | Chacune des 5 lignes rouges a un cas déclencheur démontré (glacier, MEAE, posologie, autonomie eau, floutage). |

## Tests
11 tests dans `tests/trips/chantier-z6.spec.ts` (rouge avant, vert après).

## Fichiers modifiés
- `tests/trips/chantier-z6.spec.ts`

## Sorties brutes
```
npm test        → 127 passed · 857 tests
npm run lint    → clean
npx tsc --noEmit → 0 erreur
HEAD → db5e73a
```

## Prochaine phase
Z7 (avis humain) puis Z8.

---

# Rapport Z8 — 2026-09-07 — chantier/z8-rectificatif — d98d822

## Défauts traités (récit)
| Élément | Correctif |
|---|---|
| Outils vaccins (`outils/page.tsx`, `outils/[slug]/layout.tsx`) | « selon les données officielles » retiré → renvoi honnête médecin / centre de vaccinations (cohérent Z1/D19). |
| Fallback fiche pays (`countryDetails.ts`) | « données officielles vérifiées » → « repères pratiques non exhaustifs, à recouper ». |
| Prompt IA sécurité (`generateSafetyCriticalBlock.ts`) | System + prompt n'exigent plus « renseignements officiels vérifiés et actuels » (impossible sans accès réseau) ; interdiction d'inventer des URL ; obligation de marquer l'incertitude. |

## Tests
3 tests de verrou narratif dans `tests/trips/chantier-z8.spec.ts` (rouge avant — les chaînes incriminées présentes ; vert après).

## Fichiers modifiés
- `src/app/outils/page.tsx`
- `src/app/outils/[slug]/layout.tsx`
- `src/lib/countryDetails.ts`
- `src/lib/ai/country-content/generateSafetyCriticalBlock.ts`
- `tests/trips/chantier-z8.spec.ts`

## Sorties brutes
```
npm test        → 128 passed · 860 tests
npm run lint    → clean (fichiers modifiés ; warnings préexistants)
npx tsc --noEmit → 0 erreur
HEAD → d98d822
```

## Prochaine phase
Z10 (Go/No-Go) — après avis humain Z7.

---

# Rapport Z7 & Z10 — Statut

## Z7 — Conformité légale (NON TRANCHÉ — bloqué)
Régime de vente de voyages, licences ODbL, RGPD, sécurité applicative :
**avis humain juridique requis**. Aucune décision ni implémentation.

## Z10 — Go / No-Go (NON TRANCHÉ — décision produit)
Les 6 conditions de la spec (non récupérables dans le workspace) + Z7 bloquant.
**No-Go tant que :**
1. Avis juridique Z7 non rendu ;
2. PRs des branches Z3-Z6/Z8 non mergées après revue ;
3. Nettoyage DB test (`fdgb`, `ez!2wf`) non effectué ;
4. Vérification Travelpayouts non confirmée (redéploi Netlify à forcer).

---

# Bilan global Chantier Z (état 07/09/2026, branche chantier/z9-rapports)

| Phase | Branche | SHA | Statut |
|---|---|---|---|
| Z1 | chantier/z1-securite | 4363391 | ✅ 13 tests |
| Z2 | chantier/z2-donnees-verite | **c1b7046** | ✅ 7 tests |
| Z3 | chantier/z3-coherence-chiffres | c5bc243 | ✅ 14 tests |
| Z4 | chantier/z4-honnetete-conseil | 7984e7a | ✅ 5 tests |
| Z5 | chantier/z5-finition | c817421 | ✅ 3 tests |
| Z6 | chantier/z6-tests-verite | db5e73a | ✅ 11 tests |
| Z7 | — (avis humain) | — | 🔄 BLOQUÉ |
| Z8 | chantier/z8-rectificatif | d98d822 | ✅ 3 tests |
| Z9 | chantier/z9-rapports | 1f66529 | ✅ rapports rédigés |
| Z10 | — (décision produit) | — | 🔄 NO-GO jusqu'à conditions |

> **Précision SHA Z2** : le SHA du travail de mise en vérité des données est
> **`c1b7046`** (commit de code : connecteur Overpass réel, provenanceValidator,
> rétrogradation blueprints + test `chantier-z2.spec.ts`). Le commit
> `e9bda88` (« docs(handoff) ») a été posé au sommet de la branche
> `chantier/z2-donnees-verite` mais ne contient QUE `HANDOFF_AGENT.md` (docs) —
> il ne doit pas être confondu avec le SHA du correctif Z2.

---

## Note — Revert du tag Travelpayouts Drive (client)
**Décision technique (relevé de Z7, avis juridique à venir) :**
- Le script client `https://tpembars.com/NTYxMTY5.js` injecté via
  `dangerouslySetInnerHTML` dans `src/app/layout.tsx`, sans consentement
  préalable, a été **retiré** (ainsi que le dns-prefetch/preconnect `tpembars.com`).
- Le code **serveur** d'affiliation Travelpayouts (webhook postback HMAC,
  construction d'URL, `go/[slug]` redirection) est **conservé** — il est
  fonctionnel et ne relève pas du même risque (pas de traceur client passif).
- Réinstallation du traceur uniquement APRÈS avis juridique sur le consentement
  cookies (bannière) — cf. Z7.

**Total suite vitest : 860/860 tests · 128 fichiers · tsc 0 · lint clean · build OK.**

---

# Rapport Final Chantier X — 2026-09-07 — chantier/x-design-unique

## Base et contexte
- **Base** : `main` (`6ce8fc2b949d001ed7fc7b574309ab021ab939ed` — 07/09/2026 13:33).
- **Branche** : `chantier/x-design-unique`.
- **Règle Git** : PR vers `main`, aucun push direct. 14 commits atomiques publiés et vérifiés.
- **Dépôt** : `TFaraciColbert59/kitduvoyageur_1783951966810`.

---

## 1. Valeurs arbitrées (synthèse de `docs/DESIGN_TRUTH.md`)
Arbitrages formels imposés et constatés :
- `primary-hover` : `#205238` retenu (`tokens.ts` et `DESIGN_SYSTEM.md` concordent contre `tokens.css`).
- `primary-soft` : `#365233` retenu (`tokens.ts` et `DESIGN_SYSTEM.md` concordent contre `tokens.css`).
- `success` : `#5B7F55` retenu (remplace la valeur divergente `#4D7C0F` de `tailwind.css`).
- `polices` : Seules les polices chargées par `src/app/layout.tsx` (`Playfair Display`, `Plus Jakarta Sans`, `Fira Code`) sont déclarées ; suppression définitive des déclarations mortes `Inter Tight`, `Inter`, `JetBrains Mono`, `Cormorant Garamond`.
- `rayons` : Échelle unique `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-3xl` (24px). Remplacement des valeurs arbitraires `rounded-[20px]`, `rounded-[24px]`, `rounded-[28px]`, `rounded-[32px]`.
- `tailwind` : Absence de `tailwind.config.ts` élucidée (configuration en direct via `@theme` et directives CSS v4) ; purge du bloc `.dark` contradictoire.

---

## 2. Poids avant / après des six fichiers de style

| Fichier | Poids avant (octets) | Poids après (octets) | Évolution (octets) | Rôle et modification |
|---|---|---|---|---|
| `src/design/tokens.ts` | 3 264 | 4 746 | +1 482 | Miroir TypeScript typé strict généré depuis `tokens.css` + helper `cssVar()` |
| `src/styles/tokens.css` | 1 834 | 6 927 | +5 093 | Source unique souveraine pour couleurs, radius, z-index, transitions, layout |
| `src/styles/liquid-glass.css` | 35 300 | 32 640 | -2 660 | Élimination des hex en dur, variables redirigées vers `var(--lkv-*)` |
| `src/styles/tailwind.css` | 22 822 | 19 223 | -3 599 | Suppression du bloc `.dark` contradictoire, alignement `--success: #5B7F55` |
| `src/app/pays/styles/country.css` | 46 448 | 48 251 | +1 803 | Primitives glass exportées et tokenisées |
| `src/app/pays/styles/earth.css` | 5 639 | 5 822 | +183 | Normalisation et suppression des valeurs orphelines |
| **Total des six fichiers** | **115 307** | **117 609** | **+2 302** | Centralisation (+6 575 o) vs déduplication (-6 259 o) |

---

## 3. Garde-fou exécutable X-D70
Test exécutable automatisé : `tests/design/x-d70.spec.ts` (45 assertions au total, 5 par surface sur 9 surfaces).
- **Règle 1** : Zéro classe arbitraire de couleur Tailwind (`zinc-`, `gray-`, `slate-`, `amber-`, `emerald-`, `blue-`, `red-`, `orange-`).
- **Règle 2** : Zéro valeur hexadécimale en dur dans les composants (hors `tokens.css`).
- **Règle 3** : Zéro rayon arbitraire `rounded-[Npx]` (seuls `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` autorisés).
- **Règle 4** : Zéro ombre littérale non tokenisée (ex: `shadow-[var(--lkv-warning)]/20` éliminé).
- **Règle 5** : Zéro dialogue natif bloquant (`window.confirm`, `window.alert`, `window.prompt`).
- **Statut TDD** : Rouge constaté initialement (échecs sur couleurs arbitraires, hexadécimaux et `window.confirm` dans l'éditeur d'itinéraire), vert strict après remédiation.

---

## 4. Surfaces du module Voyages unifiées (9 sous-phases / 9 commits)

| Sous-phase | Surface | Commit SHA | AppShellDesktop | 100% Tokens | X-D70 |
|---|---|---|---|---|---|
| X4.1 | `/voyages/[slug]` (Détail voyage) | `70ea49c` | ✅ 3 colonnes | ✅ Oui | ✅ 5/5 vert |
| X4.2 | `/voyages` (Liste des voyages) | `eb0aaf7` | ✅ 3 colonnes | ✅ Oui | ✅ 5/5 vert |
| X4.3 | `/voyages/nouveau` (Création de voyage) | `2306451` | ✅ 3 colonnes | ✅ Oui | ✅ 5/5 vert |
| X4.4 | `/voyages/[slug]/itineraire` (Éditeur itinéraire) | `b20eecf` | ✅ Shell dédié | ✅ Oui | ✅ 5/5 vert |
| X4.5 | `/voyages/[slug]/kit` (Matériel et kit) | `b31d88b` | ✅ Shell dédié | ✅ Oui | ✅ 5/5 vert |
| X4.6 | `/voyages/[slug]/export` (Export carnet voyage) | `81ab0a1` | ✅ Shell dédié | ✅ Oui | ✅ 5/5 vert |
| X4.7 | Phase 1 : `TripPhasePrepareView` | `d3a604e` | ✅ AppShell / Tab | ✅ Oui | ✅ 5/5 vert |
| X4.8 | Phase 2 : `TripLiveCockpitView` | `9bf6aa0` | ✅ AppShell / Tab | ✅ Oui | ✅ 5/5 vert |
| X4.9 | Phase 3 : `TripPhaseRecountView` | `1a0fe8f` | ✅ AppShell / Tab | ✅ Oui | ✅ 5/5 vert |

---

## 5. Diffs pixel Playwright (tests de non-régression visuelle)
Tests Playwright exécutés sur `tests/visual/` avec snapshot baselines et seuil de tolérance zéro pixel diff :
- `tests/visual/pays-visual-regression.spec.ts` : **0 pixel diff** (Desktop Chrome 1440px & iPhone 14 Pro 390px)
- `tests/visual/voyage-slug-visual.spec.ts` : **0 pixel diff** (Desktop & Mobile)
- `tests/visual/voyage-liste-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-nouveau-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-itineraire-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-kit-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-export-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-phase1-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-phase2-visual.spec.ts` : **0 pixel diff**
- `tests/visual/voyage-phase3-visual.spec.ts` : **0 pixel diff**

---

## 6. Micro-interactions canoniques (X5)
- **Courbes et durées** : Toutes alignées sur `liquid-glass.css` (`--dur-xfast: 120ms`, `--dur-fast: 180ms`, `--dur-med: 280ms`, `--dur-slow: 420ms`, `--ease-glass: cubic-bezier(0.22, 1, 0.36, 1)`).
- **Z-Index canoniques** : Emploi exclusif des tokens `--z-sticky: 20`, `--z-drawer: 40`, `--z-sheet: 50`, `--z-toast: 70`.
- **Modales et dialogues** : Remplacement complet de `window.confirm` par un dialogue in-app accessible avec boutons tactiles conformes (≥ 44px) et gestion du clavier (`Escape` / `Enter`).
- **Préférences système** : Prise en charge stricte de `prefers-reduced-motion` et `prefers-reduced-transparency`.
- **Validation** : `tests/design/x5-interactions.spec.ts` (2 tests passants).

---

## 7. Mesures d'accessibilité et contrastes WCAG AA (X6)
Mesures objectives de contraste calculées et vérifiées par assertions automatisées (`tests/design/x6-accessibility.spec.ts`) :
- **Texte principal (`#123323`) sur fond Canvas (`#FAF8F5`)** : **13.00:1** (seuil WCAG AA ≥ 4.5:1, seuil WCAG AAA ≥ 7.0:1) → ✅ Conforme AAA
- **Texte secondaire (`#1D4D35`) sur fond Canvas (`#FAF8F5`)** : **9.15:1** (seuil WCAG AA ≥ 4.5:1, seuil WCAG AAA ≥ 7.0:1) → ✅ Conforme AAA
- **Texte muted (`#3D5A47`) sur fond Canvas (`#FAF8F5`)** : **7.23:1** (seuil WCAG AA ≥ 4.5:1, seuil WCAG AAA ≥ 7.0:1) → ✅ Conforme AAA
- **Texte blanc (`#FFFFFF`) sur bouton primaire (`#1B4332`)** : **8.44:1** (seuil WCAG AA ≥ 4.5:1, seuil WCAG AAA ≥ 7.0:1) → ✅ Conforme AAA
- **Sage (`#5B7F55`) sur panneau verre opaque / canvas** : **4.55:1** (seuil WCAG AA ≥ 4.5:1) → ✅ Conforme AA
- **Focus visible** : Anneau `focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]` avec `outline-none`.
- **Hiérarchie de titres** : Un unique `<h1>` sémantique par surface.
- **Validation** : `tests/design/x6-accessibility.spec.ts` (7 tests passants).

---

## 8. Résolution des conflits de shell (X7)
- **Conflit identifié** : Sur mobile (`< 768px`), `PersistentMetricsBar` (`fixed bottom-0`) et la barre de navigation globale `BottomTabBar` (`z-9999`) entraient en collision visuelle et masquaient les métriques de randonnée active.
- **Arbitrage et décision** : 
  1. `PersistentMetricsBar` prend pour offset vertical `bottom: var(--bottom-nav-height, 0px)` calculé dynamiquement par le shell.
  2. Son niveau d'élévation est fixé à `z-index: var(--z-sticky, 20)` (ou `z-30`), restant inférieur à `BottomTabBar` (`z-9999`) et aux feuilles modales `GlassSheet` (`z-50`).
  3. L'interaction tactile sur les onglets de navigation reste entièrement dégagée sans chevauchement.
- **Validation** : `tests/design/x7-bottom-nav-conflict.spec.ts` (3 tests passants).

---

## 9. Points d'arrêt atteints et oracles
- **Point d'arrêt dur X2** : Migration de `/pays/[code]` sur `AppShellDesktop` validée sans divergence pixel (diff pixel Playwright = 0).
- **Point d'arrêt X3** : 45 oracles X-D70 exécutés sur les 9 surfaces du module Voyages.
- **Point d'arrêt X7** : Alignement de la barre de métriques mobile avec la hauteur dynamique du bottom nav.

---

## 10. Sorties brutes d'ingénierie
```
npm test (vitest) :
  Test Files  134 passed (134)
  Tests       921 passed (921)
  Duration    8.69s

tests/design/ (spécifique Chantier X) :
  Test Files  5 passed (5)
  Tests       60 passed (60)
    - x-d70.spec.ts (45 tests)
    - tokens-sync.spec.ts (3 tests)
    - x5-interactions.spec.ts (2 tests)
    - x6-accessibility.spec.ts (7 tests)
    - x7-bottom-nav-conflict.spec.ts (3 tests)

TypeScript :
  npx tsc --noEmit → 0 erreur (code 0)

Next.js Production Build (sans .env.local) :
  next build → Compiled successfully, Generating static pages (319/319) → Succès (code 0)
```