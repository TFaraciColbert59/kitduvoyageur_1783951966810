# Y_DECISIONS — Arbitrages du chantier Y

Date : 07/09/2026 · Branche : `chantier/x-design-unique` @ `c1c981cb`
Chaque décision : options, diff fonctionnel, décision, justification, preuve commandée.

---

## Arbitrage 1 — Itinéraire : `TripItineraryTab` vs `ItineraryPlannerClient`

**Options.** (a) Garder le seul planner, supprimer l'onglet. (b) Garder les deux avec
rôles distincts. (c) Garder le seul onglet.

**Diff fonctionnel.** `TripItineraryTab` (lecteur) : liste canonicalisée des étapes,
barre de stats (étapes/distance/D+/provenance), bandeaux saisonnalité, boutons
« Ouvrir le Planificateur » + « Régénérer », état vide avec génération. Utilisé par
`TripPhasePrepareView` (section itinerary) et `TripLiveCockpitView` (« Voir tout le
tracé ») — preuve : grep, 2 imports. `ItineraryPlannerClient` (éditeur, route
`/itineraire`) : DayNavigator, édition/réordonnancement/déplacement d'étapes,
insertion/duplication/suppression de jours, modales `StepEditModal`/`MoveStepModal`.
Aucune fonction éditable n'existe dans l'onglet.

**Décision.** (b) conforme à l'hypothèse par défaut du doc : **le planner reste
l'éditeur** de la route `/itinéraire` ; **`TripItineraryTab` devient lecteur en
lecture seule** — dans Y4.2 il perd son bouton « Régénérer » de la barre d'outils
(le bouton ne reste que dans l'état vide, où il est indispensable) et renvoie
toutes les actions d'édition vers le planner. Pas de suppression de fichier.

**Écartée.** (a) casserait la vue « tracé » du cockpit live qui n'a pas de route dédiée.

---

## Arbitrage 2 — `ConfiguratorWizard.tsx` : code mort ?

**Preuve commandée (collée).**
```
$ grep -rln "ConfiguratorWizard" src/ tests/ scripts/ | grep -v KitConfiguratorWizard
src/app/ai-configurator/components/ConfiguratorWizard.tsx
src/app/ai-configurator/page.tsx
-rw-r--r-- 50709 Sep  7 18:27 src/app/ai-configurator/components/ConfiguratorWizard.tsx
```

**Décision.** **VIVANT** — importé par `ai-configurator/page.tsx`. L'hypothèse de
suppression (49 569 o) est **rejetée**. Il devient en Y6.1 le panneau invocable
depuis la section `gear` (contrat `TripKitAnalysis` / `ContextualGearRecommendation`).

---

## Arbitrage 3 — Barres persistantes mobiles

**Preuve commandée (collée).**
```
$ grep -rn "PersistentMetricsBar" src/ --include="*.tsx" | grep -v autoGen/PersistentMetricsBar
src/features/trips/components/autoGen/AutoGenTripView.tsx:6:import { PersistentMetricsBar } ...
src/features/trips/components/autoGen/AutoGenTripView.tsx:126:      <PersistentMetricsBar ...
```

**Décision.** `PersistentMetricsBar` n'est monté **que dans `AutoGenTripView`**
(flux auto-généré IA), jamais dans le cockpit manuel ni le hub. Le conflit
« deux barres fixes » visé par le doc n'existe donc **pas dans le périmètre hub**.
Décision : **conservé tel quel dans le flux autoGen** (il est déjà calé au-dessus de
`--bottom-nav-height` au z-30, test x7 vert), **hors périmètre du hub** ; ses classes
froides seront tokenisées par Y-D80/Y3.5 comme tout `src/features/trips/**`.
`MobileNavWrapper` reste la navigation primaire mobile.

---

## Arbitrage 4 — `ResumeActiveTripCard`

**Preuve commandée (collée).**
```
$ grep -rn "ResumeActiveTripCard" src/ --include="*.tsx" | grep -v components/ResumeActiveTripCard
src/app/page.tsx:36:          <ResumeActiveTripCard />
```

**Décision.** **Conservé.** Son unique usage est la page d'accueil (entrée
site-wide « reprendre mon voyage »), pas une surface du hub : il n'est pas
redondant avec `ActiveTripSwitcher` qui vivra dans l'en-tête des surfaces voyage.
Ses violations tokens (dégradés `emerald`) seront corrigées via Y-D80/Y3.5.

---

## Arbitrage 5 — Carte : section ou mode de l'itinéraire

**Décision.** **Mode d'affichage de la section `itinerary`** (hypothèse par défaut
du doc). Pas de 11e section `carte`, pas de 4e moteur de carte. `trip_pois`
s'affiche dans le mode carte du planner/lecteur. Le registre des sections compte
donc **10 entrées**, pas 11 (les 9 existantes + `securite` + `journal`, `export`
inclus = 10 segments).

---

## Arbitrage 6 — `no-scrollbar` vs `custom-scrollbar`

**Preuve commandée (collée, extrait).**
```
$ grep -rn "no-scrollbar|custom-scrollbar" src/app/materiel/ src/features/materiel/
OccasionMarketplace.tsx:13: ... overflow-x-auto no-scrollbar ...
DepartChecklist.tsx:567:  ... overflow-y-auto no-scrollbar ...
DepartCockpit.tsx:295/360/592: ... no-scrollbar ...
DepartEquipmentHub.tsx:617: ... no-scrollbar ...
```
Zéro `custom-scrollbar` dans `/materiel`.

**Décision.** **`no-scrollbar` partout dans le cockpit voyage** (aligné sur
`/materiel`, la source canonique du visuel). Les colonnes droites passent de
`custom-scrollbar` à `no-scrollbar` en Y2.1/Y2.2.

---

## Décisions transverses consignées

- **Fusion PR #31** : `gh` indisponible sur l'environnement → la fusion est un clic
  manuel de Tony (corps de PR à corriger avant). Blocage consigné dans
  `Y_BLOCKERS.md`, sous-phases indépendantes poursuivies (§7.4).
- **Protection de branche** : désactivée côté GitHub ; activation manuelle requise.
- **Migration RLS** `20260907010000_trips_rls_hardening.sql` : écrite (H2/M4/M5/M7),
  application interdite avant validation sur copie.
