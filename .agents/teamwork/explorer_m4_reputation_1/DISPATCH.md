## 2026-10-04T19:22:36Z
You are explorer_m4_reputation_1, specialized in Collaborative Reputation & Adventure Streaks for Milestone 4 (R4).
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m4_reputation_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Investigate the Reputation & Streak systems:
1. Anti-Spam Reciprocal Utility Contribution Engine:
   - Strictly 0 points for raw chat text messages (eliminates conversation spamming).
   - Points awarded solely for verifiable outdoor utility actions:
     * `GPX_TRACK_SHARED`: +25 pts (sharing verified GPX snapshot).
     * `CHECKLIST_ITEM_COMPLETED`: +10 pts (verifiable completion of expedition task).
     * `PACK_MERGE_CONFIRMED`: +15 pts (confirming collective gear allocation).
     * `FIELD_CHECKIN_SUBMITTED`: +15 pts (submitting verified field check-in status).
     * `SAFETY_ALERT_VERIFIED`: +30 pts (verified mountain hazard alert).
   - Domain logic: `calculateContributionPoints(event: UtilityEvent): number`, `getUserReputation(userId: string)`.
2. Collective Adventure Streaks Engine:
   - Tracks joint outdoor expeditions between 2 or more members.
   - A streak increments when members complete joint outings within configured activity windows (e.g. monthly or seasonal outings).
   - Domain logic: `calculateTeamStreak(teamMembers: string[], expeditions: ExpeditionRecord[]): AdventureStreak`.
3. UI Component Blueprints:
   - `ReputationBadge.tsx`: Displays contributor tier and utility score with Apple HIG Liquid Glass styling.
   - `AdventureStreakBanner.tsx`: Shows collective streak counter (🔥 4 sorties en équipe) with next outing countdown. ZERO orange `#E4501C`!
4. Design TypeScript types in `src/features/messaging/types/reputation.types.ts`:
   - `UtilityEventType`, `UtilityEvent`, `UserReputation`, `AdventureStreak`, `ReputationTier`.
5. Write your findings in `analysis.md` and deliver `handoff.md`.
Communicate when done via send_message to orchestrator.
