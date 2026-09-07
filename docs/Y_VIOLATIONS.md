# Y_VIOLATIONS — Inventaire du garde-fou Y-D80 (Y1.5)

Date : 07/09/2026 · Périmètre : src/features/trips + src/app/voyages + src/app/groupes + src/app/ai-configurator
Total : **510 violations** · R9 (h1) déjà verte · Corrections en Y3.2/Y3.5/Y4.10 (porte G3 = 12/12 à la fin de Y3.5).

| Règle | Objet | Total | Phase de correction |
|---|---|---|---|
| R1 | Classes froides (zinc/gray/slate/amber/emerald/blue/red/orange) | 89 | Y3.5 |
| R2 | Hex brut hors blanc/noir | 240 | Y3.5 |
| R3 | rounded-[Npx] arbitraire | 47 | Y3.5 |
| R4 | shadow-[…] littérale | 1 | Y3.5 |
| R5 | Dialogues natifs (alert/confirm/prompt) | 15 | Y3.5 |
| R6 | Cibles tactiles < 44px | 9 | Y3.5 |
| R7 | Contrôles natifs non stylés | 8 | Y3.5 |
| R8 | Statut réseau multiple | 3 | Y3.2 |
| R9 | h1 multiples | 0 | deja verte |
| R10 | <aside hors sidebars canoniques | 9 | Y2.2/Y3.1 |
| R11 | Routes /voyages/ littérales hors registre | 67 | Y3.5 (builder tripSectionHref + tripGpxHref) |
| R12 | window.print | 1 | Y4.10 |

## Détail par règle (fichiers les plus touchés)

### R1 — Classes froides (zinc/gray/slate/amber/emerald/blue/red/orange) (89)

- `src/features/trips/components/autoGen/ProposalCard.tsx` × 22
- `src/features/trips/wizard/Step5Preview.tsx` × 9
- `src/features/trips/components/autoGen/TripBriefBar.tsx` × 8
- `src/features/trips/components/ResumeActiveTripCard.tsx` × 8
- `src/features/trips/wizard/Step2Dates.tsx` × 8
- `src/features/trips/wizard/Step1Destinations.tsx` × 7
- `src/features/trips/components/TripSyncStatusIndicator.tsx` × 6
- `src/features/trips/components/autoGen/AutoGenTripView.tsx` × 5
- `src/app/groupes/page.tsx` × 5
- `src/features/trips/wizard/Step3StylePace.tsx` × 4
- `src/features/trips/wizard/Step4Travelers.tsx` × 3
- `src/features/trips/components/ActiveTripBanner.tsx` × 2
- … +1 autres fichiers

### R2 — Hex brut hors blanc/noir (240)

- `src/app/ai-configurator/components/ConfiguratorWizard.tsx` × 100
- `src/app/ai-configurator/components/KitConfiguratorWizard.tsx` × 75
- `src/app/groupes/page.tsx` × 42
- `src/app/groupes/[groupId]/page.tsx` × 9
- `src/features/trips/wizard/Step3StylePace.tsx` × 3
- `src/app/ai-configurator/page.tsx` × 3
- `src/features/trips/wizard/Step1Destinations.tsx` × 2
- `src/app/voyages/error.tsx` × 2
- `src/features/trips/components/TripDocumentsView.tsx` × 1
- `src/features/trips/engine/carnetConversionEngine.ts` × 1
- `src/features/trips/wizard/Step4Travelers.tsx` × 1
- `src/features/trips/wizard/Step5Preview.tsx` × 1

### R3 — rounded-[Npx] arbitraire (47)

- `src/features/trips/components/TripBudgetView.tsx` × 9
- `src/features/trips/components/TripCompletionModal.tsx` × 5
- `src/app/voyages/[slug]/kit/loading.tsx` × 5
- `src/features/trips/components/TripDocumentsView.tsx` × 4
- `src/features/trips/components/TripNotesView.tsx` × 4
- `src/features/trips/components/TripSafetyView.tsx` × 3
- `src/features/trips/components/TripTeamView.tsx` × 3
- `src/app/ai-configurator/components/ConfiguratorWizard.tsx` × 3
- `src/app/voyages/loading.tsx` × 2
- `src/app/voyages/[slug]/loading.tsx` × 2
- `src/features/trips/components/QuickCreateTripModal.tsx` × 1
- `src/features/trips/components/TripChecklistView.tsx` × 1
- … +5 autres fichiers

### R4 — shadow-[…] littérale (1)

- `src/features/trips/components/TripCompactHeader.tsx` × 1

### R5 — Dialogues natifs (alert/confirm/prompt) (15)

- `src/features/trips/components/TripTeamView.tsx` × 3
- `src/app/groupes/page.tsx` × 3
- `src/features/trips/components/TripBudgetView.tsx` × 2
- `src/features/trips/components/TripDocumentsView.tsx` × 2
- `src/features/trips/components/TripNotesView.tsx` × 2
- `src/features/trips/components/autoGen/ProposalCard.tsx` × 1
- `src/features/trips/components/TripSafetyView.tsx` × 1
- `src/features/trips/components/TripShareModal.tsx` × 1

### R6 — Cibles tactiles < 44px (9)

- `src/features/trips/components/autoGen/ProposalCard.tsx` × 3
- `src/features/trips/wizard/Step1Destinations.tsx` × 3
- `src/features/trips/components/ActiveTripBanner.tsx` × 2
- `src/features/trips/components/autoGen/TripBriefBar.tsx` × 1

### R7 — Contrôles natifs non stylés (8)

- `src/app/groupes/page.tsx` × 8

### R8 — Statut réseau multiple (3)

- `src/features/trips/components/TripSyncStatusIndicator.tsx` × 2
- `src/features/trips/components/TripOfflineBar.tsx` × 1

### R9 — h1 multiples

✅ 0 violation.

### R10 — <aside hors sidebars canoniques (9)

- `src/features/trips/components/KitSidebarLeft.tsx` × 1
- `src/features/trips/components/KitSidebarRight.tsx` × 1
- `src/features/trips/planner/ItinerarySidebarLeft.tsx` × 1
- `src/features/trips/planner/ItinerarySidebarRight.tsx` × 1
- `src/features/trips/wizard/TripWizard.tsx` × 1
- `src/app/voyages/VoyagesClient.tsx` × 1
- `src/app/voyages/[slug]/export/ExportClientView.tsx` × 1
- `src/app/voyages/[slug]/TripDetailClient.tsx` × 1
- `src/app/groupes/[groupId]/page.tsx` × 1

### R11 — Routes /voyages/ littérales hors registre (67)

- `src/app/voyages/actions.ts` × 21
- `src/app/voyages/kit-actions.ts` × 8
- `src/app/voyages/completion-actions.ts` × 5
- `src/features/trips/components/KitSidebarLeft.tsx` × 3
- `src/features/trips/planner/ItinerarySidebarLeft.tsx` × 3
- `src/app/voyages/collab-actions.ts` × 3
- `src/features/trips/components/ActiveTripBanner.tsx` × 2
- `src/features/trips/components/QuickCreateTripModal.tsx` × 2
- `src/features/trips/components/ResumeActiveTripCard.tsx` × 2
- `src/features/trips/planner/ItineraryPlannerClient.tsx` × 2
- `src/features/trips/wizard/useTripDraft.ts` × 2
- `src/app/voyages/budget-actions.ts` × 2
- … +10 autres fichiers

### R12 — window.print (1)

- `src/app/voyages/[slug]/export/ExportClientView.tsx` × 1

