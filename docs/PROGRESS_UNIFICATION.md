# SUIVI DU CHANTIER D'UNIFICATION LKDV (VOYAGES & GROUPES)
Référence HEAD initiale : `f86ff69` (main)
Dernière mise à jour : 2026-09-07T01:15:00+02:00

---

## Tableau de Bord d'Avancement par Sous-Phase

| Phase | Sous-Phase | Intitulé | Statut | Preuve / Validation |
|---|---|---|---|---|
| **P0** | **0.1** | Ligne de base technique (Vitest 572/572, tsc, lint, build) | **TERMINE** | `npm test` vert (572/572, 87 fichiers), `tsc` 0 err, `next build` 0 err |
| **P0** | **0.2** | Cartographie du modèle de données (11 groupes, 54 membres, 1 trip) | **TERMINE** | Supabase query live `execute_sql` |
| **P0** | **0.3** | Cartographie des usages croisés (H1-H7) | **TERMINE** | H1-H6 confirmées, H7 infirmée (pas d'usage direct clubs/communaute/activite) |
| **P0** | **0.4** | Cartographie UI (Shells, icônes, 4646x #17402C, jargon D9) | **TERMINE** | `git grep` des occurrences, inventaire AppShell vs Header/Footer |
| **P0** | **0.5** | Reproduction et localisation des défauts D1 à D12 | **TERMINE** | Code source fautif identifié et cité dans `AUDIT_UNIFICATION.md` |
| **P0** | **0.6** | Baseline mesurée (Temps de réponse, tailles JS, E2E Playwright) | **TERMINE** | Benchmarks routes /, /voyages, /groupes, Playwright 6/7 (D11 bloque 1 test) |
| **P0** | **0.7** | Livrables Phase 0 (`AUDIT_UNIFICATION.md`, `PROGRESS_UNIFICATION.md`) | **TERMINE** | Fichiers créés et validés |
|---|---|---|---|---|
| **P1** | **1.1** | Fallback du générateur d'itinéraire (Template / Paramétrique / Squelette) [D1] | **TERMINE** | Tests 15/15 verts (`itineraryFallback.spec.ts`, `buildItinerary.spec.ts`), 0 étape vide |
| **P1** | **1.2** | Source unique du profil d'altitude & découplage offres partenaires [D2] | **TERMINE** | Tests 8/8 verts (`elevationProfile.spec.ts`), découplage Chamonix < 2400m validé |
| **P1** | **1.3** | Cohérence des poids et des badges (Fix trousse 0g, faux ultralight) [D3, D4] | **TERMINE** | Tests 5/5 verts (`kitWeight.spec.ts`), badge 'none' si 0g, fallback 200g trousse |
| **P1** | **1.4** | Compteurs dérivés des données réelles (alignement badges/onglets) [D5, D6] | **TERMINE** | Tests 3/3 verts (`useTripCounters.spec.ts`), toggle recommandations > 6 dans UI |
| **P1** | **1.5** | Hiérarchie des recommandations (max 2 vitales justifiées) [D7] | **TERMINE** | Tests 3/3 verts (`recommendationHierarchy.spec.ts`), max 2 vitaux par trip garanti |
| **P1** | **1.6** | Dates civiles locales et fuseaux (élimination décalage UTC) [D8] | **TERMINE** | Tests 17/17 verts (`tripDates.spec.ts`), `formatCivilDateRange` sans dérive DST/fuseau |
| **P1** | **1.7** | Clôture Phase 1 & Démo vérifiée | **TERMINE** | Vitest 617/617 (93 files), `tsc` 0 err, `lint` 0 err, `build` 0 err, Playwright 7/7 |
|---|---|---|---|---|
| **P2** | **2.1** | Tokens CSS unifiés (`tokens.css`, trancher #5C6B5E vs #5B7F55) [D10] | **TERMINE** | Palette `lkv` unifiée, `#17402C` & `#5B7F55`, suppression `#5C6B5E`, contrastes >= 4.5:1 |
| **P2** | **2.2** | Codemod et règle ESLint anti-hexadécimal JSX | **TERMINE** | Codemod 47 fichiers, test `antiHexColor.spec.ts` 2/2 vert |
| **P2** | **2.3** | Primitives partagées (GlassCard, Sheet, Tabs, Badge, EmptyState) | **TERMINE** | Composants créés & exportés dans `src/components/ui`, test `primitives.spec.ts` 5/5 vert |
| **P2** | **2.4** | Normalisation des icônes (`lucide-react` par défaut) | **TERMINE** | Mapping sémantique `src/lib/icons.ts`, test `icons.spec.ts` 3/3 vert |
| **P2** | **2.5** | AppShell unique (absorption Header/Footer/MobilePageShell) | **TERMINE** | Arbre DOM unifié, résolution D11, tests `appShell.spec.ts` 3/3 vert |
| **P2** | **2.6** | Purge du jargon interne (« Chantier {n} », C1-C8) [D9] | **TERMINE** | `TripPlaceholderTab` supprimé, remplacé par `TripSafetyView`, test `antiJargon.spec.ts` 3/3 vert |
| **P2** | **2.7** | Accessibilité de base (cibles >= 44px, navigation clavier) | **TERMINE** | Cibles tactiles >= 44px, Vitest 634/634, `tsc` 0 err, `lint` 0 err, `build` 0 err, Playwright 7/7 |
|---|---|---|---|---|
| **P3** | **3.1** | Décision d'architecture et schéma cible (`docs/DATA_MODEL.md`) | **TERMINE** | Spécification canonique Crews / Trips / Participants / Rôles unifiés rédigée |
| **P3** | **3.2** | Migration SQL `up` + `down` testée sur staging | **TERMINE** | `20260907000000_unify_crews_trips_rls.sql` (`up` + `down`), idempotente, vues de transition |
| **P3** | **3.3** | RLS unifiée avec matrice de preuve 24+ cas | **TERMINE** | `lkv_can` implémenté (SQL & TS), test `rlsMatrix.spec.ts` 25/25 vert |
| **P3** | **3.4** | Exécution contrôlée & Intégrité | **TERMINE** | Vitest 659/659, `tsc` 0 err, `lint` 0 err, Playwright 7/7 vert |
|---|---|---|---|---|
| **P4** | **4.1** | Refonte `/groupes` -> `/equipages` (Server-First, élimination N+1) [D12] | **TERMINE** | Requêtes agrégées O(1), `queries-crews.ts`, test `crew-queries.spec.ts` vert |
| **P4** | **4.2** | Système unique d'invitations (liens signés + consentement) | **TERMINE** | Tokens signés HMAC avec expiration, modal de consentement explicite, test `crew-invitations.spec.ts` 7/7 |
| **P4** | **4.3** | Redirections 308 et compatibilité anciens liens | **TERMINE** | Redirection `/groupes` -> `/equipages` (308), test `crew-routes.spec.ts` vert |
| **P4** | **4.4** | UI équipage complète | **TERMINE** | Fiche `/equipages` et `/equipages/[slug]` avec AppShell, membres, expéditions |
|---|---|---|---|---|
| **P5** | **5.1** | Moteur des 3 phases temporelles (Préparer / Vivre / Raconter) | **TERMINE** | `temporalPhaseEngine.ts`, tests unitaires 13/13 verts (`temporalPhaseEngine.spec.ts`) |
| **P5** | **5.2** | Implémentation de la vue par phase | **TERMINE** | Contrôleur segmenté `TripPhaseController`, réutilisation vues existantes, synchro URL `?phase=` |
| **P5** | **5.3** | Mode Vivre (terrain, hors-ligne, urgence) | **TERMINE** | `TripLiveCockpitView` (plein soleil, dépense 2 taps, 112/114 & GPS), Playwright TEST-E2E-VOYAGE-08 8/8 vert |
|---|---|---|---|---|
| **P6** | **6.1** | Provider de contexte actif `ActiveTripProvider` (cookie httpOnly) | **TERMINE** | Cookie `lkv_active_trip` SSR + client mirror, test `activeTrip.spec.ts` 4/4 vert |
| **P6** | **6.2** | Interconnexion des modules (Matériel, Carte, Copilote, etc.) | **TERMINE** | Bannières contextuelles, injection prompt copilote, doc `MODULE_INTERCONNECTIONS.md` |
| **P6** | **6.3** | Recherche et navigation globale | **TERMINE** | GlobalSearch (Cmd+K) trips/crews/places/carnets, breadcrumb équipage/voyage/phase, reprise accueil, Playwright 9/9 vert |
|---|---|---|---|---|
| **P7** | **7.1** | Bus d'événements `lkv_events` et fonction `emitEvent()` | **TERMINE** | `EventBus` résilient in-process + Supabase server action dispatch, test `eventBus.spec.ts` 12/12 vert |
| **P7** | **7.2** | Consommateurs d'événements (fil d'activité, scoring, notifications) | **TERMINE** | Handlers typés (activity, notifications, scoring), composant `LiveActivityFeed` intégré `/communaute` & `/activite` |
| **P7** | **7.3** | RLS et confidentialité du bus | **TERMINE** | Migration `20260907010000_create_lkv_events_bus.sql` appliquée, 5 RLS policies, rétention RGPD 13 mois |
|---|---|---|---|---|
| **P8** | **8.1** | Export / import GPX 1.1 certifié | **TERMINE** | `parseTripGpx` & `generateTripGpx` GPX 1.1, action `importGpxToTripAction`, test `phase8-features.spec.ts` 4/4 vert |
| **P8** | **8.2** | Checklist pré-départ automatisée | **TERMINE** | Formalités pays intelligentes (UE vs non-UE, CEAM, vaccins), test 2/2 vert |
| **P8** | **8.3** | Météo saisonnière déterministe | **TERMINE** | Normales climatiques mensuelles (T°, pluie, vent) et `evaluateTripClimateRisk`, test 2/2 vert |
| **P8** | **8.4** | Carnet public indexable & SEO | **TERMINE** | Metadata OpenGraph, Twitter card, Schema.org TouristTrip & CreativeWork vérifiés |
| **P8** | **8.5** | Règlements de dépenses et budget réel | **TERMINE** | `simplifyDebts` (glouton équitable) et `calculateBudgetSummary`, test 2/2 vert |
| **P8** | **8.6** | Segments d'itinéraires réutilisables | **TERMINE** | `segmentEngine.ts`, catalogue certifié TMB/GR20/Laugavegur, `insertSegmentIntoTripSteps`, test 2/2 vert |
|---|---|---|---|---|
| **P9** | **9.1** | Monétisation éthique (Boutique prioritaire, tri technique neutre) | **TERMINE** | Séparation conseil / pub, `isValidAffiliateTargetUrl`, test `ethical-legal-security.spec.ts` |
| **P9** | **9.2** | Conformité légale (loi influence 2023, RGPD, HMAC) | **TERMINE** | Badge permanent "Sponsorisé", hash SHA-256 de session RGPD, HMAC constant-time postback |
| **P9** | **9.3** | Sécurité des documents d'identité | **TERMINE** | `maskSensitiveIdentityNumber`, URLs signées HMAC courte durée (15 min) avec expiration |
|---|---|---|---|---|
| **P10** | **10.1** | Optimisation performance & budgets web | À FAIRE | LCP, INP, CLS ciblés |
| **P10** | **10.2** | Accessibilité WCAG AA complète | À FAIRE | 0 violation axe-core |
| **P10** | **10.3** | Responsive 390 / 768 / 1440 px | À FAIRE | Ergonomie mobile certifiée |
| **P10** | **10.4** | Mode hors-ligne et sync déconnectée | À FAIRE | Service worker + IndexedDB |
| **P10** | **10.5** | Préparation i18n | À FAIRE | Extraction des chaînes |
|---|---|---|---|---|
| **P11** | **11.1** | Suite de tests unitaires exhaustive | À FAIRE | Cas limites et dégradés |
| **P11** | **11.2** | Tests d'intégration server actions | À FAIRE | Permissions et conflits |
| **P11** | **11.3** | Parcours E2E Playwright complets (6 parcours) | À FAIRE | Snapshots 3 breakpoints |
| **P11** | **11.4** | Preuves de sécurité et rejeu RLS | À FAIRE | Matrice d'isolation |
| **P11** | **11.5** | CI et blocage des régressions | À FAIRE | Portes qualité strictes |
|---|---|---|---|---|
| **P12** | **12.1** | Documentation technique et runbook | À FAIRE | Fiches d'architecture |
| **P12** | **12.2** | Nettoyage du code mort et suppression des flags | À FAIRE | Zéro vestige |
| **P12** | **12.3** | Script démo investisseur (7 min) | À FAIRE | Jeu de données reproductible |
| **P12** | **12.4** | Rapport final d'acceptation | À FAIRE | Format §14 strict |
