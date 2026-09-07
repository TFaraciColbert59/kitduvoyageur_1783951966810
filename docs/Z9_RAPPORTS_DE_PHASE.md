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
| Z2 | chantier/z2-donnees-verite | c1b7046 | ✅ 7 tests |
| Z3 | chantier/z3-coherence-chiffres | c5bc243 | ✅ 14 tests |
| Z4 | chantier/z4-honnetete-conseil | 7984e7a | ✅ 5 tests |
| Z5 | chantier/z5-finition | c817421 | ✅ 3 tests |
| Z6 | chantier/z6-tests-verite | db5e73a | ✅ 11 tests |
| Z7 | — (avis humain) | — | 🔄 BLOQUÉ |
| Z8 | chantier/z8-rectificatif | d98d822 | ✅ 3 tests |
| Z9 | chantier/z9-rapports | — | ✅ rapports rédigés |
| Z10 | — (décision produit) | — | 🔄 NO-GO jusqu'à conditions |

**Total suite vitest : 860/860 tests · 128 fichiers · tsc 0 · lint clean · build OK.**