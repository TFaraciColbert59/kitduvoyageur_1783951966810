---
name: lkdv-explorer-v2-ios-native
description: Use for Explorer v2 Capacitor/iOS work - haptics mapping, geolocation permissions, keep-awake, Live Activity Swift plugin, Info.plist keys and the macOS CI build.
---
# Natif iOS (Capacitor 8)

- Réutiliser `src/lib/native/haptics.ts` et `@capacitor/geolocation` ; détection `Capacitor.isNativePlatform()`.
- `Info.plist` : `NSLocationWhenInUseUsageDescription` (texte clair en français), `NSSupportsLiveActivities = YES`.
- Plugin local `ios/App/App/LiveActivity/` : `LkdvActivityAttributes` (ActivityKit), `LiveActivityPlugin.swift` (`CAPPlugin`, méthodes `start`, `update`, `end`), widget extension minimale pour l’Island (compact : sport + chrono ; étendu : distance, D+, allure).
- Pont TS `src/features/explorer-v2/native/liveActivity.ts` : no-op sur web, erreurs avalées et consignées.
- Écran allumé pendant l’activité : Wake Lock API (web) / `UIApplication.shared.isIdleTimerDisabled` (natif via le même plugin).
- Preuve : workflow `.github/workflows/ios.yml` vert sur la branche (minutes gratuites) ; si épuisées → `BLOCAGES.md`, et le code reste compilable.
