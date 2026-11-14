# Technical Remediation Plan & Code Designs: Lot 2 R2

**Agent**: teamwork_explorer_lot2_r2_rep  
**Role**: explorer, investigator, synthesizer  
**Milestone**: Lot 2 R2 Remediation Plan  
**Recipient**: teamwork_orchestrator (Conversation ID: `59615597-1e96-4de1-9730-9299e1e6ef8c`)  
**Status**: Complete (Hard Handoff)  
**Profile**: Strict Ground-Truth & Forensic Audit Remediation  

---

## 1. Observation

A forensic investigation of the Lot 2 work product and preceding audit reports (`teamwork_auditor_lot2/handoff.md`, `teamwork_reviewer_lot2_native/handoff.md`, and `teamwork_challenger_lot2_native/handoff.md`) reveals 7 specific technical and integrity defects across Android Kotlin, iOS Swift, and TypeScript layers:

### 1.1 Android Dummy Facades & Hardcoded Bypass in `LKDVNativeUIPlugin.kt`
- **File**: `android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt:285-306`
- **Verbatim Code**:
  ```kotlin
  @PluginMethod
  fun exportGPX(call: PluginCall) {
      val xml = call.getString("xml", "") ?: ""
      val fileName = call.getString("fileName", "trace.gpx") ?: "trace.gpx"
      try {
          val file = File(activity.cacheDir, fileName)
          FileOutputStream(file).use { out -> out.write(xml.toByteArray()) }
          val ret = JSObject()
          ret.put("active", true)
          ret.put("saved", true)
          call.resolve(ret)
      } catch (e: Exception) { ... }
  }

  @PluginMethod
  fun importGPX(call: PluginCall) {
      val ret = JSObject()
      ret.put("active", true)
      call.resolve(ret)
  }

  @PluginMethod
  fun presentPhotos(call: PluginCall) {
      val ret = JSObject()
      ret.put("active", true)
      ret.put("photos", JSArray())
      call.resolve(ret)
  }

  @PluginMethod
  fun authenticateBiometric(call: PluginCall) {
      val ret = JSObject()
      ret.put("active", true)
      ret.put("success", true)
      call.resolve(ret)
  }
  ```
- **Observations**:
  1. `authenticateBiometric` grants unconditional success (`success = true`) without user interaction or biometric prompt verification, despite `androidx.biometric:biometric:1.2.0-alpha05` and `android.permission.USE_BIOMETRIC` being configured in the project.
  2. `presentPhotos` returns an empty array immediately without invoking system contracts.
  3. `importGPX` returns empty state without invoking an open document picker.
  4. `exportGPX` writes silently to private internal `activity.cacheDir` without exposing or sharing the file with the user or external storage.
  5. `presentDate` (lines 188-224) renders an `EditText` input inside an `AlertDialog` requiring the user to type `"AAAA-MM-JJ"`, instead of using `MaterialDatePicker`.
  6. `getCapabilities` (lines 33-42) claims `photos: true`, `files: true`, and `biometrics: true` despite these being non-functional stubs.

### 1.2 Missing iOS Biometric Support in `SceneDelegate.swift` & `Info.plist`
- **Files**: `ios/App/App/SceneDelegate.swift`, `ios/App/App/Info.plist`
- **Observations**:
  1. `grep -rn "LAContext\|LocalAuthentication" ios/` yields **0 occurrences**. `ORIGINAL_REQUEST.md` (Item 3, Line 24) explicitly mandates: *"Face ID LAContext (et équivalents Kotlin Material 3 Android)"*.
  2. `LKDVNativeUIPlugin` in `SceneDelegate.swift` lacks an `authenticateBiometric` method in `pluginMethods` (lines 898-909) and implementation.
  3. `ios/App/App/Info.plist` lacks `NSFaceIDUsageDescription`, which causes runtime crashes on iOS devices attempting Face ID evaluation.

### 1.3 TypeScript Native Bridge Facade Disconnection in `src/lib/native/ui.ts`
- **File**: `src/lib/native/ui.ts:41-80`
- **Observations**:
  1. `supportsNativeUI()` was introduced at line 41 but has **0 callers** across `src/` and `tests/`.
  2. All 12 bridge methods (`presentNativeActions`, `presentNativePrompt`, `hasNativeDatePicker`, `presentNativeDate`, `hasNativeChoices`, `presentNativeChoices`, `hasNativePhotos`, `pickNativePhotos`, `hasNativeGPXFiles`, `importNativeGPX`, `exportNativeGPX`, `shareNativeURL`, `syncNativeUIRoute`) and consumers (`src/components/ui/dialogs.ts`, `src/components/NativeAppBootstrap.tsx`) call `supportsNativeIOSUI()`.
  3. Because `supportsNativeIOSUI()` explicitly checks `Capacitor.getPlatform() !== 'ios'`, Android is completely excluded (`false`). As a consequence, the entire Android Kotlin `LKDVNativeUIPlugin.kt` is unreachable dead code from TypeScript.
  4. `supportsNativeIOSUI()` also excludes `/compas`, keeping native UI dialogs blocked on `/compas`.

### 1.4 Broken Test Suite in `tests/explorer-v2/live-activity.spec.ts`
- **Command**: `npx vitest run tests/explorer-v2/live-activity.spec.ts`
- **Verbatim Error**:
  ```text
  FAIL tests/explorer-v2/live-activity.spec.ts > explorer-v2 · Live Activity (pont web) > ne fait rien sur le web et ne lève jamais
  AssertionError: promise rejected "TypeError: __vite_ssr_import_0__.Capacito…" instead of resolving
  Caused by: TypeError: Capacitor.isNativePlatform is not a function
    ❯ supportsLiveTracking src/features/explorer-v2/native/liveActivity.ts:36:18
    ❯ Module.isLiveActivitySupported src/features/explorer-v2/native/liveActivity.ts:43:8
    ❯ tests/explorer-v2/live-activity.spec.ts:40:22
  ```
- **Observations**: In `src/features/explorer-v2/native/liveActivity.ts:36`, `if (!Capacitor.isNativePlatform()) return false;` throws a `TypeError` when running in a Node/browser mock environment where `isNativePlatform` is not defined on the mock `Capacitor` object.

### 1.5 Kotlin Robustness and Exception Handling
- **File**: `android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`
- **Observations**:
  1. `actionsArray.getJSONObject(i)` (line 61) and `optionsArray.getJSONObject(i)` (line 149) throw unhandled `JSONException` if invalid arrays are passed across the bridge.
  2. `share` (line 238) invokes `activity.startActivity(shareIntent)` without catching `ActivityNotFoundException`.

---

## 2. Logic Chain

1. **Integrity Rule Compliance**: The project integrity guidelines strictly prohibit dummy stubs returning pre-fabricated constants (e.g. `success = true`, `photos = []`). Therefore, `LKDVNativeUIPlugin.kt`'s `authenticateBiometric`, `presentPhotos`, and `importGPX` must either implement genuine system contracts or accurately report lack of capability so the web layer handles them safely.
2. **Security Grounding**: Biometric authentication must enforce user verification through platform APIs:
   - On Android: `androidx.biometric.BiometricPrompt` attached to the host `FragmentActivity` on the main thread.
   - On iOS: `LocalAuthentication.LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)`.
3. **Storage & Sharing Grounding**: GPX files on Android cannot remain hidden in `cacheDir`. They must be shared via Android's `FileProvider` (already configured in `AndroidManifest.xml` and `res/xml/file_paths.xml`) using `Intent.ACTION_SEND` with `FLAG_GRANT_READ_URI_PERMISSION`.
4. **Platform Parity Grounding**: The TypeScript facade (`src/lib/native/ui.ts`) must expose `supportsNativeUI()` and route common UI dialogs (`presentNativeActions`, `presentNativePrompt`, `presentNativeDate`, `presentNativeChoices`, `shareNativeURL`, `lkvConfirm`, `lkvAlert`) through it, so Android users obtain genuine native Material 3 UI. Legacy tests checking `supportsNativeIOSUI()` must be reconciled by preserving `supportsNativeIOSUI` as a backward-compatible helper while validating `supportsNativeUI` for cross-platform flows.
5. **Runtime Safety Grounding**: `Capacitor?.isNativePlatform?.()` optional chaining ensures that web environments without native bindings safely evaluate to `false` without throwing uncaught runtime `TypeError` exceptions.
6. **Robustness Grounding**: Defensive parsing using `optJSONObject(i)` and `try-catch (e: ActivityNotFoundException)` ensures stability against malformed bridge payloads and missing intent handlers.

---

## 3. Caveats

1. **Android Build Environment**: In sandboxed macOS runner environments without an Android SDK/JDK installed locally, Gradle tasks cannot compile the APK directly. However, all Kotlin implementations adhere strictly to the AGP 8.13.0, Kotlin 1.9.24, AndroidX, and Material 3 (1.12.0) APIs declared in `android/app/build.gradle`.
2. **Biometric Hardware Variation**: In emulator or simulator environments without enrolled biometrics, `authenticateBiometric` will gracefully resolve `{ active: true, success: false, error: ... }`. This is the intended real-world behavior and satisfies audit integrity.
3. **Backward Compatibility**: `supportsNativeIOSUI` is retained in `src/lib/native/ui.ts` to ensure legacy tests and components specifically verifying iOS behavior continue to function without disruption.

---

## 4. Conclusion & Complete Technical Remediation Specifications

Below are the exact code designs, method signatures, required imports, and file diff specifications for all 7 issues.

---

### Issue 1: Android `BiometricPrompt` in `LKDVNativeUIPlugin.kt`

#### Target File
`android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`

#### Required Imports
```kotlin
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
```

#### Complete Implementation
Replace lines 301–306 of `LKDVNativeUIPlugin.kt` with:

```kotlin
    @PluginMethod
    fun authenticateBiometric(call: PluginCall) {
        val title = call.getString("title", "Authentification biométrique") ?: "Authentification biométrique"
        val subtitle = call.getString("subtitle")
        val description = call.getString("reason") ?: call.getString("description")
        val negativeButtonText = call.getString("cancelLabel", "Annuler") ?: "Annuler"

        activity.runOnUiThread {
            val fragmentActivity = activity as? FragmentActivity
            if (fragmentActivity == null) {
                val ret = JSObject()
                ret.put("active", false)
                ret.put("success", false)
                ret.put("error", "L'activité hôte n'est pas une FragmentActivity")
                call.resolve(ret)
                return@runOnUiThread
            }

            val executor = ContextCompat.getMainExecutor(fragmentActivity)
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("success", true)
                    call.resolve(ret)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("success", false)
                    ret.put("errorCode", errorCode)
                    ret.put("error", errString.toString())
                    call.resolve(ret)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Rejet temporaire (ex. mauvaise empreinte). La boîte reste ouverte.
                }
            }

            try {
                val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setNegativeButtonText(negativeButtonText)

                if (!subtitle.isNullOrEmpty()) {
                    promptInfoBuilder.setSubtitle(subtitle)
                }
                if (!description.isNullOrEmpty()) {
                    promptInfoBuilder.setDescription(description)
                }

                val biometricPrompt = BiometricPrompt(fragmentActivity, executor, callback)
                biometricPrompt.authenticate(promptInfoBuilder.build())
            } catch (e: Exception) {
                val ret = JSObject()
                ret.put("active", false)
                ret.put("success", false)
                ret.put("error", e.localizedMessage ?: "Erreur d'initialisation biométrique")
                call.resolve(ret)
            }
        }
    }
```

---

### Issue 2: iOS `LAContext` Face ID / Touch ID in `SceneDelegate.swift` + `Info.plist`

#### Target Files
1. `ios/App/App/SceneDelegate.swift`
2. `ios/App/App/Info.plist`

#### Required Imports in `ios/App/App/SceneDelegate.swift`
Add to top imports (around line 6):
```swift
import LocalAuthentication
```

#### Plugin Registration in `LKDVNativeUIPlugin.pluginMethods`
In `ios/App/App/SceneDelegate.swift` (lines 898–909), add:
```swift
CAPPluginMethod(name: "authenticateBiometric", returnType: CAPPluginReturnPromise),
```

#### Capability Check Update in `getCapabilities`
In `ios/App/App/SceneDelegate.swift` (lines 982–991), update to evaluate biometric policy:
```swift
    @objc func getCapabilities(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            let exists = self?.bridge?.viewController?.parent is LKDVNativeTabBarHost
            let context = LAContext()
            var authError: NSError?
            let biometricsAvailable = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError)

            if #available(iOS 16.0, *) {
                call.resolve([
                    "available": exists,
                    "actions": exists,
                    "prompts": exists,
                    "dates": exists,
                    "choices": exists,
                    "photos": exists,
                    "files": exists,
                    "biometrics": exists && biometricsAvailable
                ])
            } else {
                call.resolve([
                    "available": exists,
                    "actions": false,
                    "prompts": false,
                    "dates": false,
                    "choices": false,
                    "photos": false,
                    "files": false,
                    "biometrics": false
                ])
            }
        }
    }
```

#### Complete Method Implementation in `LKDVNativeUIPlugin`
In `ios/App/App/SceneDelegate.swift` (inside `LKDVNativeUIPlugin` class, around line 1111):
```swift
    @objc func authenticateBiometric(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? call.getString("title") ?? "Authentification requise pour continuer"
        let context = LAContext()
        var authError: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) {
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, evalError in
                DispatchQueue.main.async {
                    var ret: [String: Any] = [
                        "active": true,
                        "success": success
                    ]
                    if let evalError = evalError {
                        ret["error"] = evalError.localizedDescription
                        ret["errorCode"] = (evalError as NSError).code
                    }
                    call.resolve(ret)
                }
            }
        } else {
            DispatchQueue.main.async {
                call.resolve([
                    "active": true,
                    "success": false,
                    "error": authError?.localizedDescription ?? "Biométrie non disponible"
                ])
            }
        }
    }
```

#### `Info.plist` Face ID Permission Entry
In `ios/App/App/Info.plist` (inside `<dict>`):
```xml
	<key>NSFaceIDUsageDescription</key>
	<string>Le Kit du Voyageur utilise Face ID pour sécuriser l’accès à votre compte et confirmer vos actions sensibles.</string>
```

---

### Issue 3: Android Photo and File Pickers in `LKDVNativeUIPlugin.kt`

#### Target File
`android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`

#### Required Imports
```kotlin
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.annotation.ActivityCallback
```

#### Complete Implementation
Replace lines 286–298 and `getCapabilities` (lines 33–42) of `LKDVNativeUIPlugin.kt` with:

```kotlin
    @PluginMethod
    fun getCapabilities(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", true)
        ret.put("dates", true)
        ret.put("choices", true)
        ret.put("photos", true)
        ret.put("files", true)
        
        val biometricManager = androidx.biometric.BiometricManager.from(context)
        val canAuth = biometricManager.canAuthenticate(
            androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG or
            androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == androidx.biometric.BiometricManager.BIOMETRIC_SUCCESS
        ret.put("biometrics", canAuth)
        call.resolve(ret)
    }

    @PluginMethod
    fun presentPhotos(call: PluginCall) {
        val maxCount = call.getInt("maxCount", 1) ?: 1
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                if (maxCount > 1) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            startActivityForResult(call, intent, "photosCallback")
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    @ActivityCallback
    private fun photosCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            val ret = JSObject()
            ret.put("active", true)
            // Cancelled: photos is omitted/undefined in JSObject
            call.resolve(ret)
            return
        }

        val data = result.data
        val photos = JSArray()
        val ctx = context

        val clipData = data?.clipData
        if (clipData != null) {
            for (i in 0 until clipData.itemCount) {
                val uri = clipData.getItemAt(i).uri
                val photoObj = processImageUri(ctx, uri)
                if (photoObj != null) {
                    photos.put(photoObj)
                }
            }
        } else {
            val uri = data?.data
            if (uri != null) {
                val photoObj = processImageUri(ctx, uri)
                if (photoObj != null) {
                    photos.put(photoObj)
                }
            }
        }

        val ret = JSObject()
        ret.put("active", true)
        ret.put("photos", photos)
        call.resolve(ret)
    }

    @PluginMethod
    fun importGPX(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(
                    Intent.EXTRA_MIME_TYPES,
                    arrayOf("application/gpx+xml", "application/xml", "text/xml", "*/*")
                )
            }
            startActivityForResult(call, intent, "importGPXCallback")
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    @ActivityCallback
    private fun importGPXCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            val ret = JSObject()
            ret.put("active", true)
            // Cancelled: text is omitted/undefined
            call.resolve(ret)
            return
        }

        val uri = result.data?.data
        if (uri == null) {
            val ret = JSObject()
            ret.put("active", true)
            call.resolve(ret)
            return
        }

        try {
            val content = context.contentResolver.openInputStream(uri)?.use { stream ->
                stream.bufferedReader().readText()
            }
            val ret = JSObject()
            ret.put("active", true)
            if (content != null) {
                ret.put("text", content)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }

    private fun processImageUri(ctx: Context, uri: Uri): JSObject? {
        return try {
            val mimeType = ctx.contentResolver.getType(uri) ?: "image/jpeg"
            val fileName = queryDisplayName(ctx, uri) ?: "photo.jpg"
            val bytes = ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: return null
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

            JSObject().apply {
                put("name", fileName)
                put("type", mimeType)
                put("data", base64)
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun queryDisplayName(ctx: Context, uri: Uri): String? {
        var name: String? = null
        if (uri.scheme == "content") {
            ctx.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) {
                        name = cursor.getString(index)
                    }
                }
            }
        }
        if (name == null) {
            name = uri.lastPathSegment
        }
        return name
    }
```

---

### Issue 4: Android GPX Export via `FileProvider` + `Intent.ACTION_SEND`

#### Target File
`android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`

#### Required Imports
```kotlin
import androidx.core.content.FileProvider
```

#### Complete Implementation
Replace `exportGPX` (lines 264–283) of `LKDVNativeUIPlugin.kt` with:

```kotlin
    @PluginMethod
    fun exportGPX(call: PluginCall) {
        val xml = call.getString("xml", "") ?: ""
        val fileName = call.getString("fileName", "trace.gpx") ?: "trace.gpx"

        try {
            val file = File(activity.cacheDir, fileName)
            FileOutputStream(file).use { out ->
                out.write(xml.toByteArray())
            }

            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file
            )

            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/gpx+xml"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(sendIntent, "Exporter la trace GPX")
            activity.startActivity(chooser)

            val ret = JSObject()
            ret.put("active", true)
            ret.put("saved", true)
            call.resolve(ret)
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            ret.put("saved", false)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("active", true)
            ret.put("saved", false)
            call.resolve(ret)
        }
    }
```

---

### Issue 5: TypeScript Facade Wiring (`supportsNativeUI`) & Test Reconciliation

#### Target Files
1. `src/lib/native/ui.ts`
2. `src/components/ui/dialogs.ts`
3. `src/components/NativeAppBootstrap.tsx`
4. `tests/native/native-ui-bridge.spec.ts`
5. `tests/native/native-files.test.ts`

#### File Diffs

##### 1. `src/lib/native/ui.ts`
Add biometric plugin type:
```typescript
type NativeUIPlugin = {
  setRoute(options: { path: string; revision: number }): Promise<{ active: boolean }>;
  presentActions(options: NativeActionRequest): Promise<NativeUIResult>;
  share(options: { url: string }): Promise<{ active: boolean }>;
  presentPrompt(options: NativePromptRequest): Promise<{ active: boolean; value?: string }>;
  presentDate(options: { title: string; value?: string }): Promise<{ active: boolean; value?: string }>;
  getCapabilities(): Promise<{ available: boolean; dates?: boolean; choices?: boolean; photos?: boolean; files?: boolean; biometrics?: boolean }>;
  importGPX(): Promise<{ active: boolean; text?: string }>;
  exportGPX(options: { xml: string; fileName: string }): Promise<{ active: boolean; saved?: boolean }>;
  presentPhotos(options: { maxCount: number }): Promise<{ active: boolean; photos?: NativePhotoPayload[] }>;
  presentChoices(options: NativeChoicesRequest): Promise<{ active: boolean; value?: string }>;
  authenticateBiometric(options?: { reason?: string; title?: string }): Promise<{ active: boolean; success: boolean; error?: string; errorCode?: number }>;
};
```

Update platform detection functions:
```typescript
/** Returns true when running on iOS or Android within Capacitor without route exclusion. */
export function supportsNativeUI(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor?.isNativePlatform?.()) return false;
  const platform = Capacitor.getPlatform?.();
  return platform === 'ios' || platform === 'android';
}

/** Legacy iOS-only guard with /compas exclusion for backwards compatibility with legacy tests. */
export function supportsNativeIOSUI(path?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor?.isNativePlatform?.()) return false;
  if (Capacitor.getPlatform?.() !== 'ios') return false;
  const currentPath = path ?? window.location.pathname;
  return currentPath !== '/compas' && !currentPath.startsWith('/compas/');
}
```

Update bridge methods to use `supportsNativeUI()`:
- `presentNativeActions(request: NativeActionRequest)`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `presentNativePrompt(options: NativePromptRequest)`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `hasNativeDatePicker()`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `presentNativeDate(title: string, value = '')`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `hasNativeChoices()`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `presentNativeChoices(request: NativeChoicesRequest)`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `hasNativePhotos()`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `pickNativePhotos(maxCount: number)`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `hasNativeGPXFiles()`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `importNativeGPX()`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `exportNativeGPX(xml: string, fileName: string)`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- `shareNativeURL(url: string)`: Replace `!supportsNativeIOSUI()` with `!supportsNativeUI()`.
- Add `authenticateNativeBiometric`:
```typescript
export async function authenticateNativeBiometric(reason?: string): Promise<{ success: boolean; error?: string } | undefined> {
  if (!supportsNativeUI()) return undefined;
  try {
    const result = await ui.authenticateBiometric({ reason });
    if (!result.active) return undefined;
    return { success: result.success === true, error: result.error };
  } catch {
    return undefined;
  }
}
```

##### 2. `src/components/ui/dialogs.ts`
Update imports:
```typescript
import { presentNativeActions, presentNativePrompt, supportsNativeUI } from '@/lib/native/ui';
```
Update callers:
- Line 66 (`lkvConfirm`): `if (supportsNativeUI()) { ... }`
- Line 130 (`lkvPromptAsync`): `if (!supportsNativeUI()) return queueWebPrompt(options);`
- Line 170 (`lkvAlert`): `if (supportsNativeUI()) { ... }`

##### 3. `src/components/NativeAppBootstrap.tsx`
Update imports:
```typescript
import { supportsNativeUI, syncNativeUIRoute } from "@/lib/native/ui";
```
Update line 60:
```typescript
if (!isNative() || !supportsNativeUI()) return;
```

##### 4. Test Reconciliation in `tests/native/native-ui-bridge.spec.ts`
Keep existing legacy test intact:
```typescript
  it('only advertises iOS Capacitor support outside /compas for legacy helper', () => {
    expect(supportsNativeIOSUI()).toBe(true);
    expect(supportsNativeIOSUI('/compas')).toBe(false);
    expect(supportsNativeIOSUI('/compas/preparer')).toBe(false);
    bridge.platform = 'android';
    expect(supportsNativeIOSUI()).toBe(false);
    bridge.platform = 'ios';
    bridge.native = false;
    expect(supportsNativeIOSUI()).toBe(false);
  });

  it('advertises cross-platform supportsNativeUI on iOS and Android', () => {
    bridge.platform = 'ios';
    bridge.native = true;
    expect(supportsNativeUI()).toBe(true);
    bridge.platform = 'android';
    expect(supportsNativeUI()).toBe(true);
    bridge.platform = 'web';
    expect(supportsNativeUI()).toBe(false);
    bridge.native = false;
    expect(supportsNativeUI()).toBe(false);
  });
```

##### 5. Test Reconciliation in `tests/native/native-files.test.ts`
Update lines 39–45 to verify capability handshake:
```typescript
  it('advertises native Files when native platform is supported and capabilities agree', async () => {
    expect(await hasNativeGPXFiles()).toBe(true);
    api.getCapabilities.mockResolvedValueOnce({ available: true, files: false });
    expect(await hasNativeGPXFiles()).toBe(false);
    api.platform = 'web';
    expect(await hasNativeGPXFiles()).toBe(false);
  });
```

---

### Issue 6: Safe Optional Chaining in `src/features/explorer-v2/native/liveActivity.ts`

#### Target File
`src/features/explorer-v2/native/liveActivity.ts`

#### Lines 35–39 Diff
```typescript
<<<<
function supportsLiveTracking(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}
====
function supportsLiveTracking(): boolean {
  if (!Capacitor?.isNativePlatform?.()) return false;
  const platform = Capacitor.getPlatform?.();
  return platform === 'ios' || platform === 'android';
}
>>>>
```

#### Resulting Guarantee
In any test mock or web runtime where `Capacitor` is defined without `isNativePlatform`, the optional chaining evaluates safely to `undefined`, which flips to `false` without throwing `TypeError: Capacitor.isNativePlatform is not a function`.

---

### Issue 7: Kotlin Hardening (`optJSONObject`, `ActivityNotFoundException`, and `MaterialDatePicker`)

#### Target File
`android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`

#### Required Imports
```kotlin
import com.google.android.material.datepicker.MaterialDatePicker
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
```

#### Code Modifications

##### 1. Array Parsing Hardening in `presentActions` (lines 60–65)
```kotlin
        for (i in 0 until actionsArray.length()) {
            val obj = actionsArray.optJSONObject(i) ?: continue
            actionIds.add(obj.optString("id", ""))
            actionTitles.add(obj.optString("title", ""))
        }
```

##### 2. Array Parsing Hardening in `presentChoices` (lines 148–156)
```kotlin
        for (i in 0 until optionsArray.length()) {
            val obj = optionsArray.optJSONObject(i) ?: continue
            val id = obj.optString("id", "")
            ids.add(id)
            titles.add(obj.optString("title", ""))
            if (id == selectedId) {
                checkedIndex = i
            }
        }
```

##### 3. Intent Chooser Hardening in `share` (lines 227–243)
```kotlin
    @PluginMethod
    fun share(call: PluginCall) {
        val url = call.getString("url", "") ?: ""
        val title = call.getString("title", "Partager")
        val text = call.getString("text")

        try {
            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, if (!text.isNullOrEmpty()) "$text\n$url" else url)
                type = "text/plain"
            }
            val shareIntent = Intent.createChooser(sendIntent, title)
            activity.startActivity(shareIntent)

            val ret = JSObject()
            ret.put("active", true)
            call.resolve(ret)
        } catch (e: ActivityNotFoundException) {
            val ret = JSObject()
            ret.put("active", false)
            call.resolve(ret)
        }
    }
```

##### 4. Material 3 `MaterialDatePicker` in `presentDate` (lines 188–224)
Replace the `EditText` input with genuine Material 3 `MaterialDatePicker`:
```kotlin
    @PluginMethod
    fun presentDate(call: PluginCall) {
        val title = call.getString("title", "Choisir une date") ?: "Choisir une date"
        val value = call.getString("value", "") ?: ""

        activity.runOnUiThread {
            val fragmentActivity = activity as? FragmentActivity
            if (fragmentActivity == null) {
                val ret = JSObject()
                ret.put("active", false)
                call.resolve(ret)
                return@runOnUiThread
            }

            try {
                val builder = MaterialDatePicker.Builder.datePicker()
                    .setTitleText(title)

                if (value.isNotEmpty()) {
                    try {
                        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                            timeZone = TimeZone.getTimeZone("UTC")
                        }
                        val parsed = sdf.parse(value)
                        if (parsed != null) {
                            builder.setSelection(parsed.time)
                        }
                    } catch (_: Exception) {}
                }

                val picker = builder.build()
                picker.addOnPositiveButtonClickListener { selection ->
                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                    val formatted = sdf.format(Date(selection))
                    val ret = JSObject()
                    ret.put("active", true)
                    ret.put("value", formatted)
                    call.resolve(ret)
                }
                picker.addOnNegativeButtonClickListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    // null value conveys cancellation
                    call.resolve(ret)
                }
                picker.addOnCancelListener {
                    val ret = JSObject()
                    ret.put("active", true)
                    call.resolve(ret)
                }
                picker.show(fragmentActivity.supportFragmentManager, "LKDV_DATE_PICKER")
            } catch (e: Exception) {
                val ret = JSObject()
                ret.put("active", false)
                call.resolve(ret)
            }
        }
    }
```

---

## 5. Verification Method

Once Worker Lot 2 applies these diffs, independent verification must be performed with the following commands:

```bash
# 1. Verify the failing Live Activity spec now passes 100%
npx vitest run tests/explorer-v2/live-activity.spec.ts

# 2. Verify all native bridge tests pass
npx vitest run tests/native/

# 3. Verify design governance test suite (509 tests across 47 files)
npx vitest run tests/design/

# 4. Verify drawer and mobile navigation suites
npx vitest run src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/
npx vitest run src/components/mobile-nav/__tests__/

# 5. Verify static TypeScript compilation
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit

# 6. Verify iOS project plist syntax and Xcode project file
plutil -lint ios/App/App/Info.plist
plutil -lint ios/App/App.xcodeproj/project.pbxproj
xcrun -sdk iphonesimulator swiftc -parse ios/App/App/SceneDelegate.swift

# 7. Verify presence of real BiometricPrompt and LAContext implementations
grep -n "BiometricPrompt" android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt
grep -n "LAContext" ios/App/App/SceneDelegate.swift
grep -n "NSFaceIDUsageDescription" ios/App/App/Info.plist
```

### Invalidation Conditions
- Any occurrence of `success: true` or `photos: []` hardcoded in `LKDVNativeUIPlugin.kt` without genuine system picker or biometric interaction.
- Failure of `npx vitest run tests/explorer-v2/live-activity.spec.ts`.
- Any diagnostic error reported by `npx tsc --noEmit`.
- Inability of Android platform users to invoke native UI dialogs through `src/lib/native/ui.ts`.
