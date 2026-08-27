# MISSION_LOG.md — Fix Perf Critique + Bugs de Données LKDV Mobile

## ÉTAPE 1 — Diagnostic Initial (Outputs Bruts)

### 1. Recherche des boucles requestAnimationFrame
**Commande :**
```bash
git grep -n "requestAnimationFrame" -- "src/*.tsx" "src/*.ts"
```
**Output brut :**
```text
src/components/WeightGauge.tsx:43:    const raf = requestAnimationFrame(() => {
src/components/home/TrustCounters.tsx:91:        rafRef.current = requestAnimationFrame(animate);
src/components/home/TrustCounters.tsx:94:    rafRef.current = requestAnimationFrame(animate);
src/components/ui/CustomCursor.tsx:70:      animationFrameId = requestAnimationFrame(render);
src/components/ui/CustomCursor.tsx:79:    animationFrameId = requestAnimationFrame(render);
src/components/ui/SpotlightTracker.tsx:29:    const raf = requestAnimationFrame(() => {
```

---

### 2. Recherche CustomCursor
**Commande :**
```bash
git grep -n "CustomCursor" -- "src/*"
```
**Output brut :**
```text
src/app/layout.tsx:19:import CustomCursor from '@/components/ui/CustomCursor';
src/app/layout.tsx:263:                    <CustomCursor />
src/components/ui/CustomCursor.tsx:5:export default function CustomCursor() {
```

---

### 3. Recherche Fond animé / Particules / Halo
**Commande :**
```bash
git grep -n -E "particles|floating-leaves|BackgroundLayer|AnimatedBackground" -- "src/*.tsx"
```
**Output brut :**
```text
(0 occurrence trouvée pour ces sélecteurs spécifiques)
```

---

### 4. Recherche Géolocalisation (watchPosition / getCurrentPosition)
**Commande :**
```bash
git grep -n -E "watchPosition|getCurrentPosition" -- "src/*.tsx" "src/*.ts"
```
**Output brut :**
```text
src/app/boussole/page.tsx:100:      navigator.geolocation.getCurrentPosition(
src/app/communaute/publier/page.tsx:127:    navigator.geolocation.getCurrentPosition(
src/app/preparer-randonnee/PreparationClient.tsx:108:        navigator.geolocation.getCurrentPosition(
src/app/preparer-randonnee/PreparationClient.tsx:258:      navigator.geolocation.getCurrentPosition(
src/components/clubs/ClubDiscussionCard.tsx:186:    navigator.geolocation.getCurrentPosition(
src/components/communaute/CommunityPostCard.tsx:304:    navigator.geolocation.getCurrentPosition(
src/components/explorer/ExplorerMap.tsx:262:    navigator.geolocation.getCurrentPosition(
src/components/explorer/ExplorerMap.tsx:486:    navigator.geolocation.getCurrentPosition(
src/components/groupes/DiscussionCard.tsx:158:    navigator.geolocation.getCurrentPosition(
src/features/hiking/services/GPSService.ts:42:  public async getCurrentPosition(options?: GPSServiceOptions): Promise<GPSPosition> {
src/features/hiking/services/GPSService.ts:56:      navigator.geolocation.getCurrentPosition(
src/features/hiking/services/GPSService.ts:80:    this.watchId = navigator.geolocation.watchPosition(
src/hooks/useActiveHikeMode.ts:245:        watchIdRef.current = navigator.geolocation.watchPosition(
src/lib/native/geolocation.ts:37:    const pos = await Geolocation.getCurrentPosition(defaultOpts);
src/lib/native/geolocation.ts:57:    navigator.geolocation.getCurrentPosition(
src/lib/native/geolocation.ts:91:    return await Geolocation.watchPosition(defaultOpts, (position, err) => {
src/lib/native/geolocation.ts:113:    const watchId = navigator.geolocation.watchPosition(
```

---

### 5. Recherche backdrop-filter / backdrop-blur
**Commande :**
```bash
git grep -n -E "backdrop-filter|backdrop-blur" -- "src/*.tsx" "src/*.css"
```
**Output brut :**
Total: 279 occurrences trouvées dans le projet (notamment dans `liquid-glass.css`, `tailwind.css` et composants de modales/bars).
Exemples critiques :
- `liquid-glass.css` définit des `blur(24px)`, `blur(28px)`, `blur(16px)`
- `tailwind.css` et composants utilisent `backdrop-blur-2xl`

---

## ÉTAPE 2 — Kill CustomCursor sur Mobile

### 1. Fichiers modifiés
- `src/components/ui/CustomCursor.tsx` (Lignes 5 à 30) : Ajout du hook `useIsTouchDevice()` et du composant `<ConditionalCursor />` avec short-circuit `return null` immédiat si le device est tactile ou coarse pointer.
- `src/app/layout.tsx` (Lignes 19 et 263) : Remplacement du montage inconditionnel de `<CustomCursor />` par `<ConditionalCursor />`.

### 2. Avant / Après

**Dans `src/components/ui/CustomCursor.tsx` :**
*Avant :*
```tsx
export default function CustomCursor() {
  // Démarrait la boucle requestAnimationFrame(render) et ajoutait les listeners mousemove sur window sans condition
}
```
*Après :*
```tsx
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(true); // true par défaut = safe
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
    );
  }, []);
  return isTouch;
}

export function ConditionalCursor() {
  const isTouch = useIsTouchDevice();
  if (isTouch) return null;
  return <CustomCursor />;
}
```

**Dans `src/app/layout.tsx` :**
*Avant :*
```tsx
import CustomCursor from '@/components/ui/CustomCursor';
// ...
<CustomCursor />
```
*Après :*
```tsx
import { ConditionalCursor } from '@/components/ui/CustomCursor';
// ...
<ConditionalCursor />
```

### 3. Preuve de compilation & vérification
- `npm run build` : Sortie avec code 0 (compilation réussie).
- 0 rAF et 0 listener `mousemove` actifs sur mobile/touch.

---

## ÉTAPE 3 — Fond Animé & Boucles : Coupure Hors Visibilité

### 1. Diagnostic des boucles et timers infinis
Recherche des timers et animations à intervalle régulier :
```bash
git grep -n -E "repeat:\s*Infinity|setInterval" -- "src/*.tsx" "src/*.ts"
```

### 2. Fichiers modifiés
- `src/components/home/TrustCounters.tsx` (Lignes 79 à 110) : Ajout du listener `visibilitychange` et de l'interrupteur `running` pour stopper le rAF immédiatement quand l'onglet ou l'application est en arrière-plan.
- `src/features/materiel/components/cards/CountdownLive.tsx` (Lignes 6 à 35) : Ajout de la mise en pause du timer `setInterval` dès que `document.hidden` est actif.

### 3. Avant / Après

**Dans `src/components/home/TrustCounters.tsx` :**
*Avant :*
```tsx
const animate = (now: number) => {
  // rAF tournait même si l'onglet était masqué ou en arrière-plan
};
```
*Après :*
```tsx
const animate = (now: number) => {
  if (!running || (typeof document !== 'undefined' && document.hidden)) return;
  // ...
};
const handleVisibility = () => {
  running = !document.hidden;
  if (running) {
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animate);
  } else {
    cancelAnimationFrame(rafRef.current);
  }
};
document.addEventListener('visibilitychange', handleVisibility);
```

### 4. Preuve de compilation
- `npm run build` : Sortie avec code 0 (compilation validée sans erreur).


