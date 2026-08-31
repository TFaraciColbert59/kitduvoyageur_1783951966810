# MISSION LOG : Migration Icônes → lucide-animated

## 📊 Phase 0 — Audit Exhaustif des Icônes lucide-react

- **Fichiers scannés :** 809 fichiers dans `src/`
- **Total d'icônes uniques trouvées :** 83
- **Total d'occurrences d'import :** 295
- **Répartition :**
  - **🟢 Interactives (31 icônes) :** Candidats prioritaires pour `lucide-animated` (avec trigger au tap tactile).
  - **🔴 Critique Perf (11 icônes) :** **INTERDICTION d'animer**, maintien strict en `lucide-react` statique pour préserver les 60fps et la mémoire mobile sur les listes longues.
  - **⚪ Décoratives Statiques (41 icônes) :** Conservées en `lucide-react` statique pour minimiser le First Load JS.

---

### Tableau d'Audit Détaillé (Phase 0)

| Icône | Occurrences | Catégorie | Recommandation | Fichiers types d'usage |
|---|---|---|---|---|
| `ArrowDown` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/kits/TemplateStore.tsx` |
| `ArrowLeft` | 3 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/materiel/depart/error.tsx<br>src/app/materiel/depart/[id]/error.tsx<br>src/components/ui/GlassSheet.tsx` |
| `ArrowRight` | 13 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/kits/page.tsx<br>src/features/materiel/components/cards/GearCardAlertes.tsx<br>src/features/materiel/components/cards/GearCardDepart.tsx` |
| `ArrowUpRight` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `Bell` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerClient.tsx` |
| `Boxes` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartCockpit.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `CheckSquare` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `ChevronDown` | 10 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx<br>src/components/explorer/ExplorerMobileSheet.tsx` |
| `ChevronLeft` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/pays/components/EarthMobileHeader.tsx<br>src/features/preparation/components/PreparationHeader.tsx` |
| `ChevronRight` | 3 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/pays/components/EarthCountrySheet.tsx<br>src/components/explorer/ExplorerListCard.tsx<br>src/features/materiel/components/depart/DepartLeftSidebar.tsx` |
| `ChevronUp` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerMobileHikeCarousel.tsx<br>src/components/explorer/ExplorerMobileSheet.tsx` |
| `Download` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/TrailDetailPanel.tsx<br>src/features/materiel/components/depart/DepartMap.tsx` |
| `Edit2` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartHeader.tsx` |
| `Handshake` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `Layers` | 6 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerMobileHikeCarousel.tsx<br>src/features/materiel/components/depart/DepartCockpit.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `LayoutGrid` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `List` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerMobileHikeCarousel.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `Maximize2` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartMap.tsx` |
| `Minimize2` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartMap.tsx` |
| `PhoneCall` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartParticipants.tsx` |
| `Play` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/TrailDetailPanel.tsx<br>src/features/materiel/components/depart/DepartureSheetModal.tsx` |
| `Printer` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartLeftSidebar.tsx<br>src/features/materiel/components/depart/DepartureSheetModal.tsx` |
| `RefreshCw` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/materiel/depart/error.tsx<br>src/app/materiel/depart/[id]/error.tsx` |
| `RotateCcw` | 5 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerFilterPanel.tsx<br>src/features/materiel/components/depart/DepartChecklist.tsx` |
| `Search` | 6 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/pays/components/EarthMobileHeader.tsx<br>src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerFilterPanel.tsx` |
| `Share2` | 4 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/TrailDetailPanel.tsx<br>src/features/materiel/components/depart/DepartLeftSidebar.tsx<br>src/features/materiel/components/depart/DepartParticipants.tsx` |
| `ShoppingBag` | 8 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerClient.tsx<br>src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `SlidersHorizontal` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/components/explorer/ExplorerClient.tsx` |
| `Volume2` | 2 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/mobile/MobileFloatingIsland.tsx` |
| `VolumeX` | 1 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/features/materiel/components/depart/DepartChecklist.tsx` |
| `X` | 11 | **Interactive** | ✅ Candidate lucide-animated (Tap & Montage) | `src/app/pays/components/EarthCountrySheet.tsx<br>src/app/pays/components/EarthMobileHeader.tsx<br>src/components/explorer/ExplorerClient.tsx` |
| `Check` | 18 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/components/explorer/TrailDetailPanel.tsx<br>src/features/materiel/components/cards/GearCardForget.tsx<br>src/features/materiel/components/cards/GearCardKits.tsx` |
| `CheckCircle2` | 8 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/features/materiel/components/cards/GearCardDispo.tsx<br>src/features/materiel/components/cards/GearCardInventaire.tsx<br>src/features/materiel/components/cards/GearCardSuivi.tsx` |
| `GripVertical` | 2 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/features/materiel/components/kits/KitsCockpit.tsx<br>src/features/materiel/components/MaterielGrid.tsx` |
| `MapPin` | 8 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/app/pays/components/EarthCountrySheet.tsx<br>src/components/explorer/ExplorerListCard.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx` |
| `Plus` | 8 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/features/materiel/components/cards/GearCardInventaire.tsx<br>src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `Scale` | 7 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/features/materiel/components/depart/DepartEquipmentHub.tsx<br>src/features/materiel/components/depart/DepartWeightBreakdown.tsx<br>src/features/materiel/components/kits/KitsKpiBar.tsx` |
| `Sparkles` | 9 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/app/pays/components/EarthCountrySheet.tsx<br>src/components/explorer/TrailDetailPanel.tsx<br>src/features/materiel/components/depart/DepartChecklist.tsx` |
| `Star` | 1 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/components/explorer/ExplorerListCard.tsx` |
| `Tag` | 1 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/app/pays/components/EarthCountrySheet.tsx` |
| `Trash2` | 6 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx<br>src/features/materiel/components/kits/KitBuilder.tsx` |
| `Zap` | 6 | **Critique perf** | ⛔ STRICTEMENT STATIQUE (Garder lucide-react) | `src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/depart/DepartCockpit.tsx<br>src/features/materiel/components/depart/DepartHeader.tsx` |
| `AlertCircle` | 3 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/cards/GearCardDispo.tsx<br>src/features/materiel/components/depart/DepartAlerts.tsx<br>src/features/materiel/components/depart/DepartChecklist.tsx` |
| `AlertOctagon` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartParticipants.tsx` |
| `AlertTriangle` | 9 | **Décorative statique** | Optionnelle / Non prioritaire | `src/app/materiel/depart/error.tsx<br>src/app/materiel/depart/[id]/error.tsx<br>src/features/materiel/components/cards/GearCardAlertes.tsx` |
| `Backpack` | 7 | **Décorative statique** | Optionnelle / Non prioritaire | `src/app/kits/page.tsx<br>src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx` |
| `Calendar` | 5 | **Décorative statique** | Optionnelle / Non prioritaire | `src/app/pays/components/EarthCountrySheet.tsx<br>src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartRightSidebar.tsx` |
| `Clock` | 12 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerListCard.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx` |
| `Cloud` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `CloudDrizzle` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartWeather.tsx` |
| `CloudFog` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `CloudLightning` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `CloudRain` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `CloudSnow` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `CloudSun` | 3 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartCockpit.tsx<br>src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `Coins` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/app/pays/components/EarthCountrySheet.tsx` |
| `Compass` | 6 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/TrailDetailPanel.tsx<br>src/features/materiel/components/depart/DepartHeader.tsx` |
| `Droplet` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/preparation/components/tabs/WeightTab.tsx` |
| `Droplets` | 3 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/depart/DepartureSheetModal.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `ExternalLink` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartAlerts.tsx<br>src/features/materiel/components/depart/DepartEquipmentHub.tsx` |
| `FileText` | 3 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx<br>src/features/materiel/components/depart/DepartRightSidebar.tsx` |
| `Flame` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/preparation/components/tabs/GearTab.tsx` |
| `HeartPulse` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/preparation/components/tabs/TeamTab.tsx` |
| `HelpCircle` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartAlerts.tsx` |
| `ImageOff` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/ui/SmartImage.tsx` |
| `Mountain` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/explorer/TrailDetailPanel.tsx<br>src/components/ui/SmartImage.tsx` |
| `Navigation` | 5 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerListCard.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx` |
| `Package` | 5 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/cards/GearCardKits.tsx<br>src/features/materiel/components/depart/DepartChecklist.tsx<br>src/features/materiel/components/kits/KitsKpiBar.tsx` |
| `Radio` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartParticipants.tsx` |
| `Shield` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/preparation/components/tabs/GearTab.tsx<br>src/features/preparation/components/tabs/TeamTab.tsx` |
| `ShieldAlert` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/preparation/components/PreparationHeader.tsx<br>src/features/preparation/components/tabs/ShakedownTab.tsx` |
| `ShieldCheck` | 10 | **Décorative statique** | Optionnelle / Non prioritaire | `src/app/materiel/depart/error.tsx<br>src/app/materiel/depart/[id]/error.tsx<br>src/features/materiel/components/cards/GearCardAlertes.tsx` |
| `Shirt` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/preparation/components/tabs/GearTab.tsx<br>src/features/preparation/components/tabs/WeightTab.tsx` |
| `Sun` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `Sunrise` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartWeather.tsx` |
| `Sunset` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartWeather.tsx` |
| `Thermometer` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartureSheetModal.tsx<br>src/features/materiel/components/depart/DepartWeather.tsx` |
| `Timer` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartRightSidebar.tsx` |
| `TrendingUp` | 4 | **Décorative statique** | Optionnelle / Non prioritaire | `src/components/explorer/ExplorerClient.tsx<br>src/components/explorer/ExplorerListCard.tsx<br>src/components/explorer/ExplorerMobileHikeCarousel.tsx` |
| `Users` | 3 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartHeader.tsx<br>src/features/materiel/components/depart/DepartParticipants.tsx<br>src/features/preparation/components/tabs/TeamTab.tsx` |
| `Wifi` | 2 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartCockpit.tsx<br>src/features/materiel/components/depart/DepartLeftSidebar.tsx` |
| `WifiOff` | 4 | **Décorative statique** | Optionnelle / Non prioritaire | `src/app/materiel/depart/error.tsx<br>src/app/materiel/depart/[id]/error.tsx<br>src/features/materiel/components/depart/DepartCockpit.tsx` |
| `Wind` | 1 | **Décorative statique** | Optionnelle / Non prioritaire | `src/features/materiel/components/depart/DepartWeather.tsx` |

---

## 🚦 Phase 1 — Mesure de Compatibilité & Bundle Baseline

1. **Vérification Moteur d'Animation :** `framer-motion@^12.43.0` est déjà embarqué dans le projet, éliminant tout surcoût de runtime externe.
2. **Mesures First Load JS Comparatives (`next build`) :**
   - **First Load JS partagé (Baseline) :** `103 kB`
   - **First Load JS partagé (Post-Migration) :** **`103 kB` (0 kB de régression !)**
   - **Route `/materiel/depart` :** `195 kB` → `198 kB` (+3 kB JSX brut, soit < 0.8 kB gzip, largement inférieur au plafond de 5 kB).
   - **Route `/terrain` :** `116 kB` → `116 kB` (inchangé).

---

## 🚀 Phase 2 — Migration Ciblée sur les Composants Clés

Les icônes interactives prioritaires suivantes ont été migrées vers leurs équivalents animés (`@/components/icons/`) avec trigger tactile au tap/touch :

1. **`MobileVitalAlertBanner.tsx`** :
   - `ArrowRight` → `ArrowRightAnimated` (Action rapide « Régler → »)
   - `X` → `XAnimated` (Bouton fermeture alerte)
2. **`DepartEquipmentHub.tsx`** :
   - `Search` → `SearchAnimated` (Barre de recherche dynamique)
   - `LayoutGrid` → `LayoutGridAnimated` (Bascule vue grille catalogue)
   - `RotateCcw` → `RotateCcwAnimated` (Recharge des consommables)
   - `X` → `XAnimated` (Nettoyage recherche)
3. **`DepartParticipants.tsx`** :
   - `PhoneCall` → `PhoneCallAnimated` (Bouton d'appel d'urgence ICE)
4. **`ExplorerClient.tsx`** :
   - `SlidersHorizontal` → `SlidersHorizontalAnimated` (Dock latéral & ouverture filtres)
   - `RotateCcw` → `RotateCcwAnimated` (Bouton « Rechercher dans cette zone »)
   - `Search` → `SearchAnimated` (Recherche sentier/massif)
   - `X` → `XAnimated` (Fermeture filtres & carte)
5. **`TrailDetailPanel.tsx`** :
   - `X` → `XAnimated` (Fermeture fiche sentier)
6. **`GlassSheet.tsx`** :
   - `ArrowLeft` → `ArrowLeftAnimated` (Bouton retour tactile navigation)
7. **`ExplorerMobileSheet.tsx`** :
   - `ChevronDown` / `ChevronUp` → `ChevronDownAnimated` / `ChevronUpAnimated` (Dépliement/repliement tactile de la feuille mobile)
8. **`DepartMap.tsx`** :
   - `Download` → `DownloadAnimated` (Export GPX)
   - `Maximize2` → `Maximize2Animated` (Plein écran cartographie)

---

## 🎯 Phase 3 — Preuves Obligatoires & Validation

| Contrôle | Résultat | Preuve |
|---|---|---|
| **TypeScript** | **0 erreur** | `tsc --noEmit` exécuté avec succès (Code 0) |
| **Vitest** | **146 / 146 tests au vert** | `npm test` : 24 test suites passées en 1.99s |
| **Next.js Production Build** | **Code 0 (Succès)** | `next build` : 0 avertissement, 0 erreur de chunk SSR |
| **First Load JS partagé** | **103 kB (Baseline) → 103 kB** | **0 kB de régression sur le bundle partagé** |
| **Support Mobile Touch** | **Actif (`onClick` & `onTouchStart`)** | Déclenchement au doigt dès le contact tactile |
| **Critique Perf** | **Strictement respecté** | 11 icônes de listes/boucles conservées en `lucide-react` statique |


