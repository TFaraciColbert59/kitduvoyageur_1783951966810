# Y_VIOLATIONS — Inventaire du garde-fou Y-D80

Régénéré le 2026-09-07T21:25:34.274Z
Total : **475 violations** · Cible : 0 (G3 = 12/12 en fin de Y3.5).

| Règle | Objet | Total | Phase |
|---|---|---|---|
| R1 | Classes froides | 81 | Y3.5 |
| R2 | Hex brut | 240 | Y3.5 |
| R3 | rounded-[Npx] | 45 | Y3.5 |
| R4 | shadow-[…] | 1 | Y3.5 |
| R5 | Dialogues natifs | 15 | Y3.5 |
| R6 | Cibles < 44px | 7 | Y3.5 |
| R7 | Contrôles non stylés | 8 | Y3.5 |
| R8 | Statut réseau multiple | 0 | Y3.2 |
| R9 | h1 multiples | 0 | Y3.5 |
| R10 | aside hors canonique | 5 | Y2.2/Y3.1 |
| R11 | Routes littérales | 72 | Y3.5 |
| R12 | window.print | 1 | Y4.10 |

## Détail par règle (fichiers les plus touchés)

### R1 — Classes froides (81)

- `src/features/trips/components/autoGen/ProposalCard.tsx` × 22
- `src/features/trips/wizard/Step5Preview.tsx` × 9
- `src/features/trips/components/autoGen/TripBriefBar.tsx` × 8
- `src/features/trips/components/ResumeActiveTripCard.tsx` × 8
- `src/features/trips/wizard/Step2Dates.tsx` × 8
- `src/features/trips/wizard/Step1Destinations.tsx` × 7
- `src/features/trips/components/autoGen/AutoGenTripView.tsx` × 5
- `src/app/groupes/page.tsx` × 5
- `src/features/trips/wizard/Step3StylePace.tsx` × 4
- `src/features/trips/wizard/Step4Travelers.tsx` × 3
- `src/app/ai-configurator/components/KitConfiguratorWizard.tsx` × 2

### R2 — Hex brut (240)

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

### R3 — rounded-[Npx] (45)

- `src/features/trips/components/TripBudgetView.tsx` × 9
- `src/features/trips/components/TripCompletionModal.tsx` × 5
- `src/app/voyages/[slug]/kit/loading.tsx` × 5
- `src/features/trips/components/TripDocumentsView.tsx` × 4
- `src/features/trips/components/TripNotesView.tsx` × 4
- `src/features/trips/components/TripSafetyView.tsx` × 3
- `src/features/trips/components/TripTeamView.tsx` × 3
- `src/app/ai-configurator/components/ConfiguratorWizard.tsx` × 3
- `src/app/voyages/loading.tsx` × 2
- `src/features/trips/components/QuickCreateTripModal.tsx` × 1
- `src/features/trips/components/TripChecklistView.tsx` × 1
- `src/features/trips/components/TripFiltersBar.tsx` × 1
- … +4 autres fichiers

### R4 — shadow-[…] (1)

- `src/features/trips/components/TripCompactHeader.tsx` × 1

### R5 — Dialogues natifs (15)

- `src/features/trips/components/TripTeamView.tsx` × 3
- `src/app/groupes/page.tsx` × 3
- `src/features/trips/components/TripBudgetView.tsx` × 2
- `src/features/trips/components/TripDocumentsView.tsx` × 2
- `src/features/trips/components/TripNotesView.tsx` × 2
- `src/features/trips/components/autoGen/ProposalCard.tsx` × 1
- `src/features/trips/components/TripSafetyView.tsx` × 1
- `src/features/trips/components/TripShareModal.tsx` × 1

### R6 — Cibles < 44px (7)

- `src/features/trips/components/autoGen/ProposalCard.tsx` × 3
- `src/features/trips/wizard/Step1Destinations.tsx` × 3
- `src/features/trips/components/autoGen/TripBriefBar.tsx` × 1

### R7 — Contrôles non stylés (8)

- `src/app/groupes/page.tsx` × 8

### R8 — Statut réseau multiple (0)



### R9 — h1 multiples (0)



### R10 — aside hors canonique (5)

- `src/features/trips/components/KitSidebarRight.tsx` × 1
- `src/features/trips/planner/ItinerarySidebarRight.tsx` × 1
- `src/features/trips/wizard/TripWizard.tsx` × 1
- `src/app/voyages/VoyagesClient.tsx` × 1
- `src/app/groupes/[groupId]/page.tsx` × 1

### R11 — Routes littérales (72)

- `src/app/voyages/actions.ts` × 31
- `src/app/voyages/kit-actions.ts` × 12
- `src/app/voyages/completion-actions.ts` × 5
- `src/app/voyages/collab-actions.ts` × 3
- `src/features/trips/components/QuickCreateTripModal.tsx` × 2
- `src/features/trips/components/ResumeActiveTripCard.tsx` × 2
- `src/features/trips/components/TripItineraryTab.tsx` × 2
- `src/features/trips/components/TripShareModal.tsx` × 2
- `src/features/trips/planner/ItineraryPlannerClient.tsx` × 2
- `src/features/trips/wizard/useTripDraft.ts` × 2
- `src/app/voyages/budget-actions.ts` × 2
- `src/app/voyages/document-actions.ts` × 2
- … +5 autres fichiers

### R12 — window.print (1)

- `src/app/voyages/[slug]/export/ExportClientView.tsx` × 1

