## 2026-10-04T19:06:56Z
You are worker_m3_remediation_1, responsible for implementing the surgical remediation for Milestone 3 based on reviewer_m3_social_2 findings.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m3_remediation_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md
Read the reviewer_m3_social_2 handoff report:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\reviewer_m3_social_2\handoff.md

Your exclusive write ownership covers:
- `src/features/messaging/components/clubs/ClubRoleBadge.tsx`
- `src/features/messaging/components/expedition/ExpeditionRoomCockpit.tsx`
- `src/features/messaging/components/expedition/FieldCheckInsPane.tsx`
- `src/features/messaging/components/expedition/SharedChecklistPane.tsx`
- `tests/messaging/clubs-expedition-rooms.spec.ts`
- `tests/messaging/challenger-m3-cockpit-stress.spec.ts`

Implementation Tasks:
1. Fix Governance Rule U-D61 & Eliminate Banned Cold Classes:
   - In `src/features/messaging/components/clubs/ClubRoleBadge.tsx`:
     Replace banned cold Tailwind classes (`zinc`, `amber`, `emerald`, `blue`, `purple`) with official LKDV design tokens:
     Use `stone` instead of `zinc`, `forest`/`sage` instead of `emerald`, `sand` or CSS custom properties `var(--lkv-action)` / `var(--lkv-secondary)` instead of `amber`, `sky`/`ink` instead of `blue`, or semantic CSS variables `var(--lkv-*)`. Do NOT evade tests via external lookup objects — use legitimate LKDV tokens!
   - In `src/features/messaging/components/expedition/ExpeditionRoomCockpit.tsx`:
     Remove `STATUS_BADGE_STYLE = 'bg-emerald-500/20 text-emerald-600'` and any other cold classes. Use semantic LKDV classes or `var(--lkv-*)`.
   - In `src/features/messaging/components/expedition/FieldCheckInsPane.tsx`:
     Replace cold classes with semantic design variables or allowed warm palettes. ZERO cold classes (`zinc`, `gray`, `slate`, `amber`, `emerald`, `blue`).
   - ZERO orange `#E4501C` anywhere!

2. Implement True Responsive Desktop 2-Column Layout in `ExpeditionRoomCockpit.tsx`:
   - On desktop (`lg:flex` or `md:grid md:grid-cols-2` or similar responsive layout):
     Render the conversation stream (`chat` / `children`) on the left side, and the tactical console pane (`weather`, `route`, `checklist`, `checkins`) on the right side concurrently!
   - On mobile (`< md:` or `< lg:`):
     Keep the Apple HIG segmented switcher where selecting a tab displays that pane.
   - Localize segmented switcher tab labels into French:
     `'chat'` -> `"Discussion"`, `'weather'` -> `"Météo"`, `'route'` -> `"Tracé GPX"`, `'checklist'` -> `"Checklist"`, `'checkins'` -> `"Points de situation"`.
     (Ensure props or internal keys still map cleanly to activePane).

3. Add Accessibility Attributes in `SharedChecklistPane.tsx`:
   - Add `role="checkbox"` and `aria-checked={item.isCompleted}` to the toggle button.
   - Add accessible labels.

4. Support All 8 Checklist Categories in `SharedChecklistPane.tsx`:
   - In the quick-add `<select>`, expose all 8 categories:
     `gear` (Matériel), `safety` (Sécurité), `food` (Vivres), `logistics` (Logistique), `navigation` (Navigation), `camp` (Bivouac), `medical` (Médical), `admin` (Administratif).

5. Update test assertions in `tests/messaging/clubs-expedition-rooms.spec.ts` and `tests/messaging/challenger-m3-cockpit-stress.spec.ts` if needed (e.g. for French tab labels, 2-column layout, and `role="checkbox"`).

6. Run build and tests:
   - `npx vitest run tests/messaging/clubs-expedition-rooms.spec.ts`
   - `npx vitest run tests/messaging/challenger-m3-cockpit-stress.spec.ts`
   - `npx vitest run tests/messaging/` (all 280+ tests MUST pass!)
   - `npx vitest run tests/design/unification.spec.ts` (rule U-D61 MUST pass genuinely!)
   - `npx tsc --noEmit` (0 TypeScript errors)
   - `npm run lint` (0 ESLint errors)

7. Deliver `handoff.md` in your working directory documenting all modifications and verification commands.
