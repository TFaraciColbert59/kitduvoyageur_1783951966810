# Review & Adversarial Challenge Report: Milestone 3 (Requirement R4)

**Reviewer**: Reviewer 2 (Roles: reviewer, critic)  
**Date**: 2026-10-03T18:47:00Z  
**Target**: Milestone 3 (Requirement R4: Mobile UI & Apple HIG Interaction)  
**Worker Deliverable**: `.agents/teamwork/worker_m3_ui_1/handoff.md`  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

Direct observations and evidence gathered from independent inspection, tool execution, and adversarial analysis:

### 1.1 Tool Execution & Automated Checks
- **TypeScript Typecheck (`npm run type-check`)**:
  Command: `npm run tsc --noEmit`
  Result: **Exited with code 0 (0 errors)**.
- **ESLint (`npm run lint`)**:
  Command: `npm run lint`
  Result: **Exited with code 0 (0 errors in Milestone 3 files)**.
- **Unit & Integration Tests (`npx vitest run tests/community/mobile-ui.spec.ts`)**:
  Result: **20 tests passed out of 20 (100%)**.
- **Community Suite (`npx vitest run tests/community/`)**:
  Result: **112 tests passed out of 112 across 9 test files (100%)**.

### 1.2 Inspection of Persistent Mutations (`CommunityPostCard.tsx`)
In `src/components/communaute/CommunityPostCard.tsx`:

1. **Save Toggle (Lines 374–397)**:
   ```typescript
   374: const handleToggleSave = async () => {
   375:   const nextSaved = !isSaved;
   376:   setIsSaved(nextSaved);
   377:   setShowMoreMenu(false);
   378:   triggerHaptic('selection');
   379:   showToast(nextSaved ? 'Enregistré dans vos favoris ⭐' : 'Retiré de vos favoris');
   380:
   381:   try {
   382:     const res = await fetch('/api/community/interactions', {
   383:       method: 'POST',
   384:       headers: { 'Content-Type': 'application/json' },
   385:       body: JSON.stringify({ action: 'save', postId: post.id }),
   386:     });
   387:     if (!res.ok) {
   388:       setIsSaved(!nextSaved);
   389:       showToast('Erreur lors de l’enregistrement');
   390:     } else {
   391:       onSaveToggle?.(post.id, nextSaved);
   392:     }
   393:   } catch {
   394:     setIsSaved(!nextSaved);
   395:     showToast('Erreur de connexion');
   396:   }
   397: };
   ```
   *Observation*: `handleToggleSave` contains complete error rollback (`setIsSaved(!nextSaved)`) for both HTTP non-2xx responses (`!res.ok`) and network exceptions (`catch`).

2. **Hide Post Mutation (Lines 399–421)**:
   ```typescript
   399: const handleHidePost = async () => {
   400:   setIsHidden(true);
   401:   setShowMoreMenu(false);
   402:   triggerHaptic('medium');
   403:   showToast('Publication masquée de votre fil.');
   404:   onHide?.(post.id);
   405:
   406:   try {
   407:     await fetch('/api/community/interactions', {
   408:       method: 'POST',
   409:       headers: { 'Content-Type': 'application/json' },
   410:       body: JSON.stringify({
   411:         action: 'feedback',
   412:         targetType: 'post',
   413:         targetId: post.id,
   414:         feedbackType: 'hide',
   415:       }),
   416:     });
   417:     onFeedback?.(post.id, 'hide');
   418:   } catch (err) {
   419:     console.error('[CommunityPostCard] Erreur hide:', err);
   420:   }
   421: };
   ```
   *Observation*: `handleHidePost` does **NOT** check `res.ok`. The return value of `fetch` is ignored. If the endpoint returns 401 (e.g. unauthenticated session), 400 (validation error), or 500 (database error), `fetch` does not throw, so no error is caught. Furthermore, the parent callback `onHide?.(post.id)` is fired immediately at line 404, unmounting the card in `MobileCommunityHub` before the server responds. If the mutation fails, no rollback occurs, and no error message is communicated to the user.

3. **"Moins comme ceci" Mutation (Lines 423–443)**:
   ```typescript
   423: const handleLessLikeThis = async () => {
   424:   setShowMoreMenu(false);
   425:   triggerHaptic('medium');
   426:   showToast('Nous afficherons moins de contenus de ce type.');
   427:
   428:   try {
   429:     await fetch('/api/community/interactions', {
   430:       method: 'POST',
   431:       headers: { 'Content-Type': 'application/json' },
   432:       body: JSON.stringify({
   433:         action: 'feedback',
   434:         targetType: 'post',
   435:         targetId: post.id,
   436:         feedbackType: 'less_like_this',
   437:       }),
   438:     });
   439:     onFeedback?.(post.id, 'less_like_this');
   440:   } catch (err) {
   441:     console.error('[CommunityPostCard] Erreur less_like_this:', err);
   442:   }
   443: };
   ```
   *Observation*: The success toast is displayed unconditionally at line 426 before the request is even sent. The `res.ok` status is ignored, and network failures in `catch` only output `console.error` without alerting the user that the feedback failed to persist.

### 1.3 Inspection of Guest Mode & 4 Tabs (`MobileCommunityHub.tsx`)
In `src/components/communaute/MobileCommunityHub.tsx` (Lines 356–401):
```tsx
356: {!user && (
357:   <Card className="space-y-3 p-[var(--space-4)] text-center">
358:     <span className="text-3xl">👤</span>
359:     <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold">
360:       Connectez-vous pour voir vos abonnements
361:     </h3>
362:     <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
363:       Suivez vos compagnons d&apos;expédition pour ne manquer aucun de leurs récits.
364:     </p>
365:     <Link href="/connexion" className="inline-block pt-1">
366:       <Button variant="primary" size="sm">
367:         Se connecter
368:       </Button>
369:     </Link>
370:   </Card>
371: )}
372:
373: {user && isLoading ? (
374:   <div className="space-y-[var(--space-3)]">
...
381:   </div>
382: ) : user && feedItems.length === 0 ? (
383:   <Card>
384:     <EmptyState
...
389:     />
390:   </Card>
391: ) : (
392:   feedItems.map((item) => (
393:     <CommunityPostCard
394:       key={item.post.id}
395:       post={item.post}
396:       transparency={item.transparency}
397:       user={user}
398:       onHide={handleRemovePost}
399:     />
400:   ))
401: )}
```
*Observation*: When `user` is null (guest mode):
- Condition `user && isLoading` is `false`.
- Condition `user && feedItems.length === 0` is `false`.
- Execution falls through into the final `else` branch: `feedItems.map(...)`.
When a guest navigates from `'pour-toi'` to `'abonnements'`, `feedItems` initially holds the items loaded in `'pour-toi'`. These items are rendered directly beneath the "Connectez-vous pour voir vos abonnements" card while the new tab fetch is pending or if the fetch fails. Furthermore, the loading skeleton is never displayed because `user && isLoading` is `false`.

### 1.4 Inspection of Transparency Sheet (`TransparencySheet.tsx`)
In `src/components/communaute/TransparencySheet.tsx`:
- Algorithmic breakdown factors and weights:
  * Intent: `weightLabel: 'Poids 30%'` (score: `breakdown?.intent ?? 0.65`, signal: `tripDestination`)
  * Utility: `weightLabel: 'Poids 25%'` (score: `breakdown?.utility ?? 0.75`, signal: `isVerifiedCarnet`)
  * Quality: `weightLabel: 'Poids 20%'` (score: `breakdown?.quality ?? 0.8`, signal: `authorTrustScore`)
  * Geo: `weightLabel: 'Poids 15%'` (score: `breakdown?.geo ?? 0.5`, signal: `massif`)
  * Social: `weightLabel: 'Poids 10%'` (score: `breakdown?.social ?? 0.4`, signal: `clubName`)
  * Sum of weights: `30 + 25 + 20 + 15 + 10 = 100%`.
- Apple HIG bottom sheet: uses Radix-based `<Sheet>` with `dragToDismiss={true}`, smooth progress bar pills, min 44px close button.
- Zero orange: strictly uses LKDV forest/sage green tokens (`--lkv-action`, `--glass-border`, `--glass-bg-subtle`). Exact check: 0 occurrences of `#E4501C`.

### 1.5 Inspection of Action Sheet (`PostActionSheet.tsx`)
In `src/components/communaute/PostActionSheet.tsx`:
- Touch targets: All action buttons use `min-h-[48px]` and cancel button uses `min-h-[44px]`.
- Actions: 6 primary actions ("Enregistrer", "Pourquoi je vois ce contenu", "Copier le lien", "Moins comme ceci", "Masquer", "Signaler").
- Destructive styling: Signaler uses `--lkv-danger` and `--lkv-danger-bg`.
- Haptics: Triggers `selection`, `light`, `medium`, `warning` styles.

### 1.6 Integrity Audit
- No hardcoded test outputs or fake results embedded in production code.
- No dummy/facade implementations: components render actual DOM trees with authentic data mapping.
- No fabricated test reports: independent execution confirmed all 20 tests in `mobile-ui.spec.ts` pass legitimately.
- **Integrity Tag**: **NO INTEGRITY VIOLATION DETECTED**.

---

## 2. Logic Chain

1. **Requirement R4 & Milestone 3 Scope**:
   - R4 explicitly requires:
     * Persistent Save, Hide, and "Moins comme ceci" actions hooked to Supabase/API with error rollback.
     * Algorithmic transparency sheet matching Feed V1 30/25/20/15/10 breakdown.
     * Clean feed integration across all 4 operational tabs ('pour-toi', 'abonnements', 'autour-de-moi', 'clubs') and robust guest mode support.
2. **Persistence & Rollback Verification**:
   - `handleToggleSave` correctly implements rollback via `setIsSaved(!nextSaved)` when `!res.ok` or on network error.
   - However, `handleHidePost` and `handleLessLikeThis` omit the `res.ok` check entirely and fail to rollback or notify the user when the API returns 401 (unauthenticated), 400, or 500.
   - Since `/api/community/interactions` strictly returns 401 for unauthenticated calls, a guest clicking "Masquer ce post" will see the post vanish locally, receive a positive confirmation toast, but have the mutation rejected by the server, causing the post to reappear on next reload.
3. **Guest Mode UX Verification**:
   - On Tab 2 ('abonnements'), the unauthenticated state is handled with a login CTA card.
   - However, the subsequent rendering ternary evaluates `feedItems.map(...)` whenever `user` is falsy, leaking the previous tab's posts beneath the login prompt and bypassing loading skeletons.
4. **Conclusion Formulation**:
   - While the components are exceptionally well built, type-safe (0 errors), lint-clean, and HIG-compliant, the absence of error rollback in 2 out of 3 persistent mutations and the guest mode rendering bug in Tab 2 require changes before final approval.

---

## 3. Caveats

- **API Route `/api/community/interactions`**: The backend endpoint itself is fully compliant, securely validating authentication, UUID formats, action parameters, and delegating to RPCs with database table fallbacks. The defect is located strictly on the client calling side in `CommunityPostCard.tsx`.
- **Desktop Views**: Desktop `/communaute` relies on `CommunityLeftSidebar` and server-fetched initial data; mobile `/communaute` delegates to `MobileCommunityHub` and `/api/community/feed`. Both share `CommunityPostCard`.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Worker M3 must address the following two concrete findings:

### Finding 1 [Major]: Add Error Checking and Rollback for `handleHidePost` and `handleLessLikeThis`
- **Location**: `src/components/communaute/CommunityPostCard.tsx`, lines 399–443.
- **Problem**: `fetch` response is not verified with `res.ok`. When unauthenticated or server fails, the action silently fails without rollback or error feedback.
- **Required Fix**:
  1. In `handleHidePost`: Capture `const res = await fetch(...)`. If `!res.ok`, revert `setIsHidden(false)` and show `showToast('Erreur lors du masquage de la publication')`. If network throws in `catch`, revert `setIsHidden(false)` and show `showToast('Erreur de connexion')`. (Consider accepting an `onRestore?: (postId: string) => void` callback from parent or only calling `onHide` after confirmed success).
  2. In `handleLessLikeThis`: Move `showToast('Nous afficherons moins de contenus de ce type.')` inside `if (res.ok)`. If `!res.ok`, display `showToast('Impossible d’enregistrer votre préférence')`. In `catch`, display `showToast('Erreur de connexion')`.

### Finding 2 [Major]: Fix Guest Mode Rendering on 'Abonnements' Tab
- **Location**: `src/components/communaute/MobileCommunityHub.tsx`, lines 356–401.
- **Problem**: Nested ternary falls into `feedItems.map(...)` when `user` is null, rendering ghost posts from prior tabs beneath the login card.
- **Required Fix**: Restructure the 'abonnements' section so that feed items are only rendered when `user` is authenticated:
  ```tsx
  {!user ? (
    <Card className="space-y-3 p-[var(--space-4)] text-center">
      {/* Login CTA Card */}
    </Card>
  ) : isLoading ? (
    <div className="space-y-[var(--space-3)]">
      {/* Skeletons */}
    </div>
  ) : feedItems.length === 0 ? (
    <Card>
      <EmptyState ... />
    </Card>
  ) : (
    feedItems.map((item) => (
      <CommunityPostCard key={item.post.id} post={item.post} ... />
    ))
  )}
  ```

---

## 5. Verification Method

To independently verify the resolution of these findings:

1. **Run Unit & Integration Tests**:
   ```bash
   npx vitest run tests/community/mobile-ui.spec.ts
   ```
   *Expected outcome*: All tests pass.
2. **Run Full Community Test Suite**:
   ```bash
   npx vitest run tests/community/
   ```
   *Expected outcome*: 112+ tests pass.
3. **Run TypeScript Check**:
   ```bash
   npm run type-check
   ```
   *Expected outcome*: 0 errors (Exit code 0).
4. **Run ESLint**:
   ```bash
   npm run lint
   ```
   *Expected outcome*: 0 errors in affected files.
5. **Inspect Modified Files**:
   - `src/components/communaute/CommunityPostCard.tsx` (verify `res.ok` checks and error rollback for hide and feedback).
   - `src/components/communaute/MobileCommunityHub.tsx` (verify clean guest mode separation on 'abonnements').
