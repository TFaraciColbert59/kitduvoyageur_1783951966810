# DISPATCH Task: Challenger Lot 2 Web (Adversarial Verification)

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_web`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
Worker Lot 2 Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2/handoff.md`

## Mission
Adversarial stress-testing of Web Primitives Unification:
1. Sheet & Drawer tests:
   - Run `npx vitest run src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/`.
   - Stress test the 3 snap positions (`collapsed`, `half`, `expanded`). Test edge cases: invalid snap value, uncontrolled vs controlled `snap` prop, rapid snap switching.
   - Verify that `src/components/compte/drawer/shell/DrawerShell.tsx` re-exporting `src/components/ui/drawer/DrawerShell.tsx` does not cause circular dependencies, broken named exports, or missing CSS classes.
2. SegmentedControl & Tabs:
   - Check keyboard navigation (Left/Right Arrow, Home/End), WAI-ARIA `role="tablist"` and `role="tab"`, `aria-selected`, `tabIndex`.
   - Test `CapsuleTabs`, `Tabs`, `SubTabBar` interoperability. Verify that `Tabs.tsx` maintains token class requirements (`bg-[var(--g1-bg)]`, `min-h-[var(--lkv-touch-min)]`) required by design governance tests.
3. Dynamic Island & Toast:
   - Verify that `showDynamicIsland` and `dismissDynamicIsland` dispatch custom events correctly.
   - Verify that `ToastHost` handles multiple rapid toasts without crashing or overlapping ungracefully.
   - Verify that no remaining file imports `react-hot-toast` or throws `MODULE_NOT_FOUND`.
4. Run tests independently and report findings.
5. Write your report in `handoff.md` with verdict: `APPROVE` or `REQUEST_CHANGES`.


## 2026-11-13T23:04:48Z
Adversarially challenge and stress-test the Web Primitives Unification of Lot 2.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_web
Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
Original user request: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
Worker Lot 2 Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2/handoff.md
Task dispatch details: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_web/DISPATCH.md

Read ORIGINAL_REQUEST.md and PROJECT.md first. Stress-test the unified Sheet 3 snaps system (edge snaps, rapid switching, controlled/uncontrolled state), DrawerShell re-export integrity, SegmentedControl keyboard/ARIA/haptic behavior and compatibility with Tabs/CapsuleTabs, DynamicIslandHost event dispatcher, ToastHost stacking, and confirm complete eradication of react-hot-toast. Execute tests independently.
Write your complete report to handoff.md in your state folder with clear verdict (APPROVE or REQUEST_CHANGES), and send a completion message back.
