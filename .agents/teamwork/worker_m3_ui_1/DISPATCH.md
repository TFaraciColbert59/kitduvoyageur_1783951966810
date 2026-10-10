## 2026-10-03T18:23:05Z
You are the Apple HIG Frontend Specialist Worker for LKDV Community Architecture Milestone 3 (Requirement R4).

Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m3_ui_1
Project root: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810
Original user request path: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Project specification: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md
Survey findings report: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_survey_ui_1\handoff.md
M1 database handoff: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m1_db_1\handoff.md
M2 recommendation engine handoff: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m2_algo_2\handoff.md

Domain Skills to consult:
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\skills\apple-ui-designer\SKILL.md
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\skills\interaction-design\SKILL.md
- c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agent\skills\frontend-developer\SKILL.md

Exclusive Write Ownership:
- src/app/communaute/page.tsx
- src/components/communaute/MobileCommunityHub.tsx
- src/components/communaute/CommunityPostCard.tsx
- src/components/communaute/TransparencySheet.tsx
- src/components/communaute/PostActionSheet.tsx
- src/components/social/CommunityHubNav.tsx
- src/app/api/community/interactions/route.ts
- tests/community/mobile-ui.spec.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission Objectives:
1. Modernize /communaute and MobileCommunityHub with 4 operational tabs:
   - 'pour-toi': Pour toi (Feed V1 scored engine from /api/community/feed?tab=pour-toi)
   - 'abonnements': Abonnements (followed creators chronological from /api/community/feed?tab=abonnements)
   - 'autour-de-moi': Autour de moi (geo proximity from /api/community/feed?tab=autour-de-moi with user coords from useGeolocation)
   - 'clubs': Clubs (mutual club collectives from /api/community/feed?tab=clubs)
   - Fluid in-place tab switching without full page reload.
   - Maintain discovery cards/carousels for durable carnets and clubs within the mobile stream.
2. Persistent Social Mutations with Immediate Haptic & Optimistic UI:
   - Create route `src/app/api/community/interactions/route.ts` to persist:
     * Save: toggle save in `post_saves` (calls toggle_post_save or inserts/deletes).
     * Feedback: insert into `content_feedback` with feedback_type ('hide', 'less_like_this', 'report').
   - In `CommunityPostCard.tsx`:
     * Save: optimistic toggle + immediate haptics (useHapticFeedback 'selection' or 'light') + server mutation.
     * Hide: optimistic removal from feed + immediate haptics ('medium') + server mutation ('hide').
     * "Moins comme ceci": optimistic toast feedback + haptics + server mutation ('less_like_this').
3. Transparency Controls:
   - Create `TransparencySheet.tsx` using Radix `<Sheet>`:
     * Triggered by tapping the transparency badge or action menu option "Pourquoi je vois ce contenu".
     * Displays pill badge, clear French explanation, and breakdown factors (Intent, Utility, Quality, Geo, Social).
4. Native Mobile Action Sheet:
   - Create `PostActionSheet.tsx` (replaces floating desktop popover on mobile) with iOS drag handle, 44px min touch targets, and actions: "Enregistrer", "Pourquoi je vois ce contenu", "Moins comme ceci", "Masquer", "Signaler".
5. Apple HIG Compliance:
   - SF Pro typography, Dynamic Type scale.
   - Liquid Glass tokens with ambient lighting.
   - Touch targets >= 44x44px.
   - Zero orange #E4501C color (strict LKDV palette: #17402C, #226148, #5B7F55, #F5F7F3).
   - Safe areas respected (AppShell).
6. Automated Tests & Verification:
   - Write tests in `tests/community/mobile-ui.spec.ts`.
   - Run `npx vitest run tests/community/mobile-ui.spec.ts` (100% pass).
   - Run `npm run type-check` (0 errors required).
   - Run `npm run lint` (0 errors required).
   - Document commands and results in handoff.md.

Deliverable:
Write your full report to c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m3_ui_1\handoff.md and notify the orchestrator via send_message when complete.
