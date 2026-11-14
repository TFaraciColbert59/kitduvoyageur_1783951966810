# Handoff Report — Survey Task 3: External Skills & Physical Verification Pipeline (iPhone 16 Pro)

## 1. Observation

1. **Physical iPhone 16 Pro Connectivity & Status**:
   - Command: `xcrun devicectl list devices`
     ```
     Name             Hostname   Identifier                                    State       Model                        Reality  
     iPhone 18 Pro               E4685F77-F8B0-406E-A544-F9F5419469D4 (UDID)   shutdown    iPhone 18 Pro (iPhone19,2)   simulated
     iPhone de Tony              00008140-000E7D081A0B001C (UDID)              connected   iPhone 16 Pro (iPhone17,1)   physical 
     ```
   - Command: `xcrun xctrace list devices`
     ```
     iPhone de Tony (27.2) (00008140-000E7D081A0B001C)
     ```
   - Physical iPhone 16 Pro is connected via USB, trusted, and in `connected` state on iOS 27.2.

2. **Appium 3.9.0 Server Status & Active Session**:
   - Command: `curl -s http://127.0.0.1:4723/status`
     ```json
     {"value":{"ready":true,"message":"The server is ready to accept new connections","build":{"version":"3.9.0"}}}
     ```
   - Command: `cd /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa && node device.mjs start`
     ```
     session 5d5307d9-ac50-46d7-b732-9d7a5f887abc window {"width":402,"height":874}
     ```
   - Device dimensions reported by XCUITest: `402 × 874 pt`.
   - Driver configuration in `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/device.mjs` (lines 42–58):
     `platformName: 'iOS'`, `'appium:automationName': 'XCUITest'`, `'appium:udid': '00008140-000E7D081A0B001C'`, `'appium:bundleId': 'com.lekitduvoyageur.app'`, `'appium:xcodeOrgId': 'QRU99VJUB5'`, `'appium:xcodeSigningId': 'Apple Development'`, `'appium:updatedWDABundleId': 'com.lekitduvoyageur.wda'`.

3. **Live UI Inspection on Physical Device (`/messagerie`)**:
   - Executed: `node device.mjs tap 270 822 && node device.mjs tree`
   - Exact XCUITest XML elements captured in `shots/tree.xml`:
     - Line 28: `<XCUIElementTypeButton name="Messages — aller au compte" label="Messages — aller au compte" x="12" y="69" width="97" height="34" />`
     - Line 39: `<XCUIElementTypeButton name="Dolomites — août" x="22" y="337" width="358" height="56" />`
     - Line 47: `<XCUIElementTypeOther name="Filtrer les discussions" x="182" y="346" width="196" height="30">`
       - Line 48: `<XCUIElementTypeButton name="Toutes" x="184" y="348" width="49" height="26" />`
       - Line 49: `<XCUIElementTypeButton name="Directs" x="232" y="348" width="49" height="26" />`
       - Line 50: `<XCUIElementTypeButton name="Groupes" x="280" y="348" width="48" height="26" />`
       - Line 51: `<XCUIElementTypeButton name="Demandes" x="327" y="348" width="49" height="26" />`
     - Line 57: `<XCUIElementTypeButton name="Nouvelle discussion" x="117" y="603" width="168" height="38" />`
   - When tapping `Camille Rochat` (`node device.mjs tapText "Camille Rochat" && node device.mjs tree`):
     - Contact header pill: `Button @12,402 148x44`
     - First message bubble: `Button @136,373 250x74` (starts at `y=373`, masked under drag handle at `y=396` and pill at `y=402`).
   - When tapping `Partager une photo` (`node device.mjs tapText "Partager une photo" && node device.mjs tree`):
     - `Partager dans le chat, boîte de dialogue web` opens at `x="0" y="110" width="391" height="276"` (top of the screen instead of bottom sheet).

4. **Resolution of Baseline Screenshots**:
   - Command: `sips -g pixelWidth -g pixelHeight /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/00-messagerie-main.png`
     ```
     pixelWidth: 1206
     pixelHeight: 2622
     ```
   - Confirms true 3x Retina captures on physical iPhone 16 Pro (`402 × 874 pt * 3 = 1206 × 2622 px`).

5. **External Skills Discovery (`npx skills`)**:
   - `npx skills find ios` and `npx skills find tailwind` executed successfully.
   - Key relevant skills identified and reviewed:
     - `wondelai/skills@ios-hig-design` (v1.5.1): Safe areas (44–54pt Dynamic Island, 34pt bottom home indicator), 44x44pt touch targets, SF Pro hierarchy, native iOS bottom sheets.
     - `affaan-m/ecc@liquid-glass-design`: iOS dynamic material with blur, reflection, morphing transitions, and light mode green palette.
     - `vercel-labs/skills@find-skills`: Official skill discovery utility.
     - `vercel-labs/agent-skills@vercel-composition-patterns`: Decoupling complex sheets and compound components.
     - `vercel-labs/agent-skills@vercel-react-best-practices`: React 19 / Next.js 15 performance rules.
     - `cap-go/capgo-skills@safe-area-handling` & `tailwind-capacitor`: Handling `env(safe-area-inset-*)` in Capacitor WKWebView.

6. **Capacitor & Build Architecture**:
   - Shell configuration: `capacitor.config.ts` and `ios/App/App/capacitor.config.json` point to `CAPACITOR_SERVER_URL` (currently `https://kitduvoyageur-1783951966810-ruddy.vercel.app`).
   - Automated install script: `scripts/ios-install.sh` uses `npx cap sync ios`, `xcodebuild -project ios/App/App.xcodeproj ...`, `xcrun devicectl device install app ...`, and `xcrun devicectl device process launch ...`.
   - Multi-target design token generator: `scripts/generate-design-bank.mjs` generates tokens from `src/design/bank.ts` into CSS, TypeScript, Tailwind preset, and `ios/App/App/DesignTokens.generated.swift`.

---

## 2. Logic Chain

1. **Device Accessibility & Tooling Readiness**:
   - Observation 1 and 2 show that the iPhone 16 Pro is actively connected and that Appium 3.9.0 with `appium-xcuitest-driver` communicates reliably with the device.
   - Therefore, the physical verification pipeline does not require any simulator or emulation; it operates directly on genuine Apple hardware.

2. **Empirical Confirmation of Messagerie Anomalies**:
   - Observation 3 proves that every issue described in Section 5 of the audit report exists in the live app:
     - The header button accessibility label explicitly states `Messages — aller au compte`, causing the unwanted navigation and dark flash.
     - The filter bar at `y=346..376` directly collides with conversation 4 at `y=337..393`.
     - The first conversation message bubble at `y=373..447` starts above the conversation container (`y=394`), causing truncation under the drag handle and contact pill.
     - The composer drawer (`Partager une photo`) opens at `y=110` (top of screen) instead of behaving as an iOS bottom sheet (`y=500..850`).
   - Therefore, correcting these specific UI elements in the React components and CSS will directly fix the measured defects.

3. **Capacitor Hybrid Architecture & Deployment Efficiency**:
   - Observation 6 establishes that the iOS app is a WKWebView wrapper loading `CAPACITOR_SERVER_URL`.
   - Therefore, when React/CSS/Tailwind changes are deployed to the web target, they are immediately visible on the physical iPhone without requiring a native binary compilation cycle in Xcode.
   - Only native bridge modifications (e.g. `DesignTokens.generated.swift` or Capacitor plugins) require running `bash scripts/ios-install.sh`.

4. **Automated QA Pipeline Feasibility**:
   - Observation 2, 3, and 4 show that scripts in `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/` (`device.mjs`, `crawl-communaute-messagerie-deep.mjs`, `crawl-finish-all-pages.mjs`) already know how to drive the UI, tap elements by label or coordinates, and save screenshots in 3x Retina resolution (`1206 × 2622 px`).
   - Therefore, running the verification sequence post-implementation will autonomously produce the exact required proof images (`00-messagerie-main.png` through `09-messagerie-message-longpress.png`).

---

## 3. Caveats

1. **Network Connectivity of Physical Device**:
   - The iPhone 16 Pro requires internet access (Wi-Fi or cellular) to reach the Vercel deployment URL (`https://kitduvoyageur-1783951966810-ruddy.vercel.app`).
   - If offline, the app would fail to load remote assets. In this survey, the app was loaded and responsive.
2. **Appium Session Persistence**:
   - The Appium session ID is cached in `.session.json`. If the Appium server is restarted or the USB cable is disconnected, `device.mjs start` must be executed once to re-establish a fresh session.
3. **No Code Modification Undertaken**:
   - In accordance with the explorer archetype and read-only mandate, no application code was edited during this survey.

---

## 4. Conclusion

1. **External Skills**:
   The external skill set is verified and ready. The primary skill to guide the Apple design implementation is `wondelai/skills@ios-hig-design` along with `affaan-m/ecc@liquid-glass-design` and the repository's native token bank `src/design/bank.ts`.
2. **Physical Device Pipeline**:
   The connected iPhone 16 Pro (`00008140-000E7D081A0B001C`) is fully responsive under Appium 3.9.0.
3. **Actionable Verification Sequence**:
   The exact commands to build, sync, test, and capture screenshots on the iPhone 16 Pro are documented in `survey_verification_skills.md` and verified live.
4. **Acceptance Criteria Readiness**:
   The implementation team has a clear blueprint for fixing all 5 anomalies on `/messagerie` and proving the resolution via automated 3x Retina screenshots.

---

## 5. Verification Method

To independently verify all findings in this report, execute the following commands in terminal:

1. **Verify physical device connection**:
   ```bash
   xcrun devicectl list devices | grep "00008140-000E7D081A0B001C"
   ```
   *Expected output*: Shows `iPhone de Tony`, state `connected`, model `iPhone 16 Pro (iPhone17,1)`.

2. **Verify Appium server availability**:
   ```bash
   curl -s http://127.0.0.1:4723/status
   ```
   *Expected output*: `{"value":{"ready":true,...}}`.

3. **Verify Appium live communication with the iPhone 16 Pro**:
   ```bash
   cd /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa
   node device.mjs start
   ```
   *Expected output*: `session <id> window {"width":402,"height":874}`.

4. **Verify navigation and live screenshot capture**:
   ```bash
   cd /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa
   node device.mjs tap 270 822
   node device.mjs shot verify-messagerie
   sips -g pixelWidth -g pixelHeight shots/verify-messagerie.png
   ```
   *Expected output*: Produces PNG image with `pixelWidth: 1206` and `pixelHeight: 2622`.

5. **Verify external skills availability**:
   ```bash
   npx -y skills find ios
   ```
   *Expected output*: Returns list including `wondelai/skills@ios-hig-design` and `affaan-m/ecc@liquid-glass-design`.

**Invalidation conditions**:
- If `xcrun devicectl list devices` reports `shutdown` or disconnected for UDID `00008140-000E7D081A0B001C`.
- If Appium port 4723 is closed or returns connection refused.
- If `device.mjs` fails to interact with the device window (`width: 402, height: 874`).
