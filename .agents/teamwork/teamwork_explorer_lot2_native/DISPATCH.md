## 2026-11-13T22:29:00Z
You are teamwork_explorer_lot2_native.
Your role: Native Swift and Android Explorer.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_native

CRITICAL MANDATORY INSTRUCTIONS:
1. Read ORIGINAL_REQUEST.md at:
   /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
2. Read the master implementation plan at:
   /Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/implementation_plan.md (especially §1, §4, §6.3).
3. Read PROJECT.md at:
   /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md.

YOUR SPECIFIC OBJECTIVE FOR LOT 2 NATIVE INVESTIGATION:
Explore the native iOS (Swift) and Android (Kotlin/Material 3) shells and the TypeScript bridge:
1. **iOS Native Maxing**:
   - Inspect `ios/App/App/SceneDelegate.swift`: find where `/compas` is excluded from `UITabBar` Liquid Glass and how to enable `UITabBar` on ALL routes.
   - Inspect `ios/App/App/LiveActivity/LkdvLiveActivityPlugin.swift` and `SceneDelegate.swift`: verify registration in `SceneDelegate.swift` and check requirements for the ActivityKit widget extension (`LkdvWidgetsExtension`) on iOS 16.1+ / iOS 17+.
   - Inspect native UI bridges in `src/lib/native/` and Capacitor plugin registrations: `UIAlertController` (alert, confirmationDialog, prompt), `UIMenu`, `UIDatePicker`, `PHPicker`, `UIDocumentPicker` (GPX), `QLPreviewController`, `UIActivityViewController` (share), `SFSafariViewController`, Face ID `LAContext`, `CoreHaptics`.
2. **Android Native Parity**:
   - Inspect `android/app/src/main/java/com/lekitduvoyageur/app/MainActivity.java`.
   - Specify the exact architecture for `LKDVAndroidTabBarHost.kt` (Material 3 capsule navigation bar in Kotlin).
   - Specify the ongoing notification service `LiveOutingNotificationService.kt` for outing tracking (chronometer, km, D+ in status bar/notification drawer).
   - Specify Android native bridges corresponding to iOS (MaterialAlertDialogBuilder, Jetpack PhotoPicker, SAF document picker, BiometricPrompt, HapticFeedbackConstants).
3. **TypeScript Bridge Facade**:
   - Inspect `src/lib/native/ui.ts`, `src/lib/native/haptics.ts`, etc.
   - Define clean, graceful TypeScript facades that call native plugins when on Capacitor and provide graceful web fallbacks when in browser.

DO NOT MODIFY CODE. You are an explorer.
Write your detailed report to:
`/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_native/handoff.md`
When finished, send a brief completion message back with the handoff path.
