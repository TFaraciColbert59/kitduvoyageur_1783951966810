# PHASE 2 — Base de référence et protocole de validation

> **Statut : Phase 2 NON démarrée.** Ce document est le dossier « avant » exigé par le
> protocole : mesures, captures, état SDK, matrice de validation. Aucune décision de design
> iOS 27 / Liquid Glass n'est prise ici.

## 1. Priorité des sources Apple (règle de validation)

1. Apple Design Resources iOS 27
2. Apple Human Interface Guidelines actuelles
3. WWDC26 (sessions 278, 251)
4. Documentation UIKit / SwiftUI actuelle
5. WWDC25 (fondations Liquid Glass — sessions 284, 356, 323, 243, 256)

Règles :
- **Aucune API, propriété ou comportement n'est considéré disponible depuis la mémoire.**
  Vérification obligatoire dans le SDK réellement installé avant usage.
- Si une API iOS 27 est absente du SDK installé : ne pas l'inventer, conserver une
  abstraction compatible, documenter le blocage.

## 2. État du SDK installé (vérifié le 2026-09-20)

| Élément | État constaté | Source |
|---|---|---|
| Capacitor | 8.5.0 (core, cli, ios, android) | `package.json` |
| Plugins présents | app, camera, geolocation, haptics, keyboard, network, preferences, splash-screen, status-bar | `package.json` |
| iOS | Projet SPM (`ios/App/CapApp-SPM`), **pas de Podfile**, `IPHONEOS_DEPLOYMENT_TARGET = 15.0` | `ios/App/App.xcodeproj/project.pbxproj` |
| iOS — build local | **Impossible sur cette machine (Windows)** : Xcode absent. Build délégué au workflow `ios.yml` (macos-latest) | `.github/workflows/ios.yml` |
| Android | `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36`, AndroidX 1.11/1.17 | `android/variables.gradle` |
| Android — build local | **Non opérationnel** : `ANDROID_HOME` absent, SDK Android non installé, `java -version` = 1.8 (Gradle requiert JDK 17+) | environnement local |
| Coquille native | Charge l'URL distante `CAPACITOR_SERVER_URL` (`server.url`) ; `public/index.html` = placeholder | `capacitor.config.ts` |
| Assets Apple | `SF-Symbols-27.dmg` présent à la racine (à installer sur macOS) | dépôt |
| Librairies Liquid Glass web | `liquid-glass-react` (utilisé par `PremiumGlassCard.client`), `@samasante/liquid-glass` (Glass Lab dev) | `package.json` |
| **SDK iOS 27 / API Liquid Glass natives** | **Non vérifiés** — nécessitent macOS + Xcode. Aucun usage autorisé avant vérification. | — |

### Commandes de vérification à exécuter sur macOS avant toute API native

```bash
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
xcrun simctl list runtimes
```

Puis, pour chaque API envisagée : vérifier la disponibilité dans le SDK (`@available`,
headers Swift/UIKit) et la compatibilité avec `IPHONEOS_DEPLOYMENT_TARGET` (15.0 actuel —
relèvement éventuel à décider en Phase 2).

## 3. Native vs Web — candidats (aucune décision prise)

| Besoin | Aujourd'hui (Web) | Natif iOS | Plugin Capacitor présent | À vérifier Phase 2 |
|---|---|---|---|---|
| Bottom tab bar | `BottomTabBar` (glass web) | UITabBar | ❌ (pas de navigation-bar plugin) | Faisabilité plugin vs barre web |
| Top bars / navigation | `TopBar` / headers custom | UINavigationBar | ❌ | Idem |
| Safe areas | `AppShell` + `env(safe-area-inset-*)` | natif (contentInset) | ✅ via WebView (`contentInset: never`) | Rendu Dynamic Island réel |
| Haptics | `useHapticFeedback` | UIFeedbackGenerator | ✅ `@capacitor/haptics` | Patterns HIG |
| Sheets / menus | `GlassModal`, sheets maison | UISheetPresentationController, menus | ❌ | Valeur réelle vs web |
| Share sheet | partage web | UIActivityViewController | ❌ (`@capacitor/share` absent) | Ajout plugin |
| Permissions | Web APIs | natif | ✅ camera, geolocation ; ❌ push-notifications (config présente sans dépendance) | Écart config/plugin à corriger |
| Clavier | `@capacitor/keyboard` | natif | ✅ | `resize: body` vs insets |

## 4. Matrice minimale de validation Phase 2

Gabarits (config `playwright.baseline.config.ts`) :

| Gabarit | Taille | Captures |
|---|---|---|
| iPhone 16 Pro (Dynamic Island) | 393 × 852 | ✅ baseline |
| Petit iPhone | 375 × 667 | ✅ baseline |
| Android mobile | 412 × 915 | ✅ baseline |
| Desktop web | 1440 × 900 | ✅ baseline |

États à couvrir : portrait, clavier ouvert, scroll long, modal/sheet, contenu vide,
contenu volumineux, dark/light. **Les captures automatisées ne sont pas une preuve
suffisante** : la revue visuelle (alignements, espacements, hiérarchie, cohérence, safe
areas, bottom nav, headers, scroll) est obligatoire avant/après chaque migration.

## 5. Captures de référence « avant »

- Dossier : `docs/design-system/baseline-screenshots/<gabarit>/` (60 fichiers, 2,78 Mo,
  JPEG q72, DPR 1, animations figées).
- 12 écrans : `/`, `/materiel`, `/kits`, `/carte-interactive`, `/communaute`, `/carnets`,
  `/voyages`, `/boutique`, `/compte`, `/hub`, `/panier`, `/connexion` + full-page
  `home`/`materiel`.
- `manifest.json` par gabarit : URL finale, titre, erreurs console (smoke test).
- Limites constatées (à couvrir en Phase 2) : captures **non authentifiées** → redirections
  `/carte-interactive → /explorer`, `/voyages → /hub`, `/boutique → /explorer` ; bruit
  console d'environnement (`_vercel/speed-insights` 404, 401/500 API sans session).
  Prévoir une passe authentifiée via `npm run seed:demo` + captures des états vides/chargés.
- Régénération : `npx playwright test --config=playwright.baseline.config.ts`
  (serveur de production auto-démarré sur `:4028`).

## 6. Mesures « avant » (Phase 1)

Générées par `node scripts/design/baseline-metrics.mjs --write` →
`docs/design-system/baseline-metrics.json`.

| Mesure | Avant |
|---|---|
| Couleurs hex codées en dur (`src/**/*.{ts,tsx}`) | 5 203 |
| `rounded-[...]` | 342 |
| `text-[...]` | 8 030 |
| `z-[...]` | 86 |
| Styles inline (`style={{...}}`) | 1 529 |
| `window.confirm/alert/prompt` directs | 2 |
| Appels `lkvConfirm/Alert/Prompt` | 74 |
| Importeurs modales — GlassModal / Sheet / GlassSheet / PremiumBottomSheet / GlassDrawer | 23 / 2 / 5 / 2 / 10 |
| Fichiers `role="dialog"` (overlays maison) | 17 |
| Implémentations bottom bar (fichiers dédiés) | 3 |
| `fixed bottom-0` | 3 |
| Pages `src/app` avec header custom | 13 |
| Primitives `src/components/ui` | 49 |
| Pages desktop/mobile séparées | 54 |
| Fichiers `*Card.tsx` / `*Modal.tsx` / `*Sheet.tsx` / `*Header.tsx` / `*Button.tsx` / `*Tabs.tsx` | 73 / 23 / 19 / 4 / 6 / 7 |

Top 5 fichiers (hex) : `communaute/publier/page.tsx` (311), `CreateCarnetView.tsx` (135),
`PaysPratiqueView.tsx` (120), `FideliteTab.tsx` (117), `CreateClubView.tsx` (105).

`PHASE2_REPORT.md` devra fournir ces mêmes chiffres après migration. Toute valeur restante
doit être justifiée, spécifique au contenu, ou inscrite dans la dette Phase 3.

## 7. Règle anti-régression

> Existe-t-il déjà une primitive ou un pattern dans `@/design` capable de couvrir ce besoin ?

Si oui : étendre ou réutiliser. Si non : créer dans `src/components/ui` puis exposer via
`@/design`. **Ne jamais créer une variante uniquement pour reproduire exactement l'ancien
écran.**

## 8. Checklist d'ouverture Phase 2 (avant la première ligne de design)

- [ ] Vérifier le SDK iOS 27 réel sur macOS (Xcode + SDK + runtimes simulateur).
- [ ] Trancher le support minimal (`IPHONEOS_DEPLOYMENT_TARGET`) selon les API retenues.
- [ ] Vérifier la faisabilité d'une bottom bar native (plugin) vs barre web.
- [ ] Corriger l'écart `PushNotifications` (config sans dépendance).
- [ ] Ajouter une passe de captures authentifiées (seed démo) + états vides/chargés.
- [ ] Valider la matrice sur appareil/simulateur (WKWebView ≠ Chromium).
