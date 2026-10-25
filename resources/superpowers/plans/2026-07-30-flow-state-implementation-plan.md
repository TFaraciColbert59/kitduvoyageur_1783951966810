# Plan d'Implémentation: Flow State Fluidité & Kit Generator

**Basé sur:** `docs/superpowers/specs/2026-07-30-flow-state-fluidite-kit-generator-design.md`
**Date:** 2026-07-30
**Objectif:** Implémenter la fluidité Instagram-like (Chantier 9) et refondre le kit generator (Chantier 10)

---

## Phase 0: Setup & Dependencies

### Tâches
1. **Installer Framer Motion**
   ```bash
   npm install framer-motion@12
   ```

2. **Créer l'architecture de base**
   - Créer `src/lib/animations/` directory
   - Créer `src/lib/animations/constants.ts` avec springConfigs et pageTransitions
   - Créer `src/lib/animations/hooks/` directory pour les hooks réutilisables

3. **Vérifier les hooks existants**
   - Confirmer que `useHapticFeedback` existe dans `src/hooks/`
   - Confirmer que `useSwipe` existe dans `src/hooks/`

---

## Phase 1: Composants d'Animation Core

### 1.1 AnimatedPage Component
**Fichier:** `src/components/animations/AnimatedPage.tsx`

```typescript
'use client';

import { motion, useAnimationControls } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { springConfigs, pageTransitions } from '@/lib/animations/constants';

interface AnimatedPageProps {
  children: React.ReactNode;
  variant?: 'slideUp' | 'fadeIn' | 'slideRight';
  gestureEnabled?: boolean;
}

export function AnimatedPage({ 
  children, 
  variant = 'slideUp',
  gestureEnabled = true 
}: AnimatedPageProps) {
  const router = useRouter();
  const controls = useAnimationControls();
  
  const handleSwipeRight = () => {
    if (gestureEnabled) {
      controls.start({ x: '100%', opacity: 0 });
      setTimeout(() => router.back(), 200);
    }
  };
  
  return (
    <motion.div
      initial={pageTransitions[variant].initial}
      animate={pageTransitions[variant].animate}
      exit={pageTransitions[variant].exit}
      transition={springConfigs.smooth}
      drag={gestureEnabled ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.x > 100 && velocity.x > 200) {
          handleSwipeRight();
        }
      }}
      style={{ width: '100%', minHeight: '100vh' }}
    >
      {children}
    </motion.div>
  );
}
```

**Tests:**
- Vérifier transition slideUp sur page d'accueil
- Tester swipe-back gesture
- Vérifier que dragConstraints empêche le swipe-left

### 1.2 ScrollReveal Component
**Fichier:** `src/components/animations/ScrollReveal.tsx`

```typescript
'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { springConfigs } from '@/lib/animations/constants';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  threshold?: number;
}

export function ScrollReveal({ 
  children, 
  delay = 0, 
  threshold = 0.2 
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  
  return (
    <motion.div
      ref={ref}
      initial={{ y: 20, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
      transition={{ ...springConfigs.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}
```

### 1.3 GestureCard Component
**Fichier:** `src/components/animations/GestureCard.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GestureCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
}

export function GestureCard({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  onTap 
}: GestureCardProps) {
  const { light, medium } = useHapticFeedback();
  const [isDragging, setIsDragging] = useState(false);
  
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, { offset, velocity }) => {
        setIsDragging(false);
        if (offset.x < -100 && velocity.x < -200 && onSwipeLeft) {
          medium();
          onSwipeLeft();
        } else if (offset.x > 100 && velocity.x > 200 && onSwipeRight) {
          medium();
          onSwipeRight();
        }
      }}
      onTap={() => {
        if (!isDragging && onTap) {
          light();
          onTap();
        }
      }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}
```

### 1.4 LoadingSkeleton Component
**Fichier:** `src/components/animations/LoadingSkeleton.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';

interface LoadingSkeletonProps {
  variant: 'card' | 'list' | 'text' | 'image';
  count?: number;
}

export function LoadingSkeleton({ variant, count = 1 }: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count });
  
  const variants = {
    card: 'h-[200px] rounded-2xl',
    list: 'h-[80px] rounded-xl',
    text: 'h-[16px] rounded',
    image: 'aspect-square rounded-xl'
  };
  
  return (
    <>
      {skeletons.map((_, i) => (
        <motion.div
          key={i}
          className={`bg-ink-100 ${variants[variant]}`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </>
  );
}
```

### 1.5 StaggerGrid Component
**Fichier:** `src/components/animations/StaggerGrid.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import { springConfigs } from '@/lib/animations/constants';

interface StaggerGridProps {
  children: React.ReactNode[];
  columns?: 2 | 3 | 4;
  staggerDelay?: number;
}

export function StaggerGrid({ 
  children, 
  columns = 2, 
  staggerDelay = 0.05 
}: StaggerGridProps) {
  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springConfigs.smooth, delay: i * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
```

---

## Phase 2: Hooks d'Animation

### 2.1 useScrollReveal Hook
**Fichier:** `src/lib/animations/hooks/useScrollReveal.ts`

```typescript
import { useRef } from 'react';
import { useInView } from 'framer-motion';

export function useScrollReveal(threshold = 0.2) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  
  const variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };
  
  return { ref, isInView, variants };
}
```

### 2.2 useParallax Hook
**Fichier:** `src/lib/animations/hooks/useParallax.ts`

```typescript
import { useScroll, useTransform } from 'framer-motion';

export function useParallax(speed = 0.5) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, 1000 * speed]);
  
  return y;
}
```

### 2.3 useSwipeGesture Hook
**Fichier:** `src/lib/animations/hooks/useSwipeGesture.ts`

```typescript
import { useState } from 'react';

export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 100
) {
  const [startX, setStartX] = useState(0);
  
  const handlers = {
    onTouchStart: (e: TouchEvent) => setStartX(e.touches[0].clientX),
    onTouchEnd: (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diff = endX - startX;
      
      if (Math.abs(diff) > threshold) {
        if (diff > 0 && onSwipeRight) onSwipeRight();
        if (diff < 0 && onSwipeLeft) onSwipeLeft();
      }
    }
  };
  
  return handlers;
}
```

### 2.4 useDragToRefresh Hook
**Fichier:** `src/lib/animations/hooks/useDragToRefresh.ts`

```typescript
import { useState } from 'react';
import { useAnimationControls } from 'framer-motion';

export function useDragToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const controls = useAnimationControls();
  
  const handleDragEnd = async (e: any, { offset, velocity }: any) => {
    if (offset.y > 80 && velocity.y > 200) {
      setIsRefreshing(true);
      await controls.start({ y: 60 });
      await onRefresh();
      await controls.start({ y: 0 });
      setIsRefreshing(false);
    }
  };
  
  return { isRefreshing, controls, handleDragEnd };
}
```

### 2.5 useOnlineStatus Hook
**Fichier:** `src/hooks/useOnlineStatus.ts`

```typescript
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOnline, setLastOnline] = useState<Date | null>(null);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnline(new Date());
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return { isOnline, lastOnline };
}
```

### 2.6 useInfiniteScroll Hook
**Fichier:** `src/hooks/useInfiniteScroll.ts`

```typescript
import { useRef, useEffect, useState } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  options: UseInfiniteScrollOptions = {}
) {
  const { threshold = 0.5, rootMargin = '0px' } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [page, setPage] = useState(1);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          loadMore().then(() => setPage((p) => p + 1));
        }
      },
      { threshold, rootMargin }
    );
    
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    
    return () => observer.disconnect();
  }, [loadMore, threshold, rootMargin]);
  
  return { sentinelRef, isIntersecting, page };
}
```

---

## Phase 3: Migration Page d'Accueil (POC)

### 3.1 Wrapper AnimatedPage sur Homepage
**Fichier:** `src/app/page.tsx`

Modifier le composant existant pour wrapper le contenu mobile dans `AnimatedPage`:

```typescript
import { AnimatedPage } from '@/components/animations/AnimatedPage';
import { ScrollReveal } from '@/components/animations/ScrollReveal';
import { StaggerGrid } from '@/components/animations/StaggerGrid';

// Dans la section mobile:
<div className="block md:hidden">
  <AnimatedPage variant="fadeIn">
    <MobilePageShell>
      {/* Hero section avec parallax subtil */}
      <ScrollReveal>
        <HomeHeroSection />
      </ScrollReveal>
      
      {/* QuickGrid avec stagger animation */}
      <StaggerGrid columns={2} staggerDelay={0.05}>
        {quickGridItems.map((item) => (
          <QuickGridCard key={item.id} {...item} />
        ))}
      </StaggerGrid>
      
      {/* Editorial card avec scroll reveal */}
      <ScrollReveal delay={0.2}>
        <EditorialCard />
      </ScrollReveal>
      
      {/* Stats row */}
      <ScrollReveal delay={0.3}>
        <StatsRow />
      </ScrollReveal>
    </MobilePageShell>
  </AnimatedPage>
</div>
```

### 3.2 Améliorer BottomTabBar avec Animation
**Fichier:** `src/components/mobile-nav/BottomTabBar.tsx`

Ajouter animation du dot indicator avec `layoutId`:

```typescript
import { motion } from 'framer-motion';

// Dans le composant BottomTabBar, pour chaque tab:
{isActive && (
  <motion.div
    layoutId="activeTabIndicator"
    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-forest-800"
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  />
)}
```

Ajouter feedback haptique sur tap:

```typescript
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const { light } = useHapticFeedback();

const handleTabClick = (path: string) => {
  light();
  router.push(path);
};
```

---

## Phase 4: Refonte Kit Generator

### 4.1 Architecture State Machine
**Fichier:** `src/lib/kit-generator/types.ts`

```typescript
export type GeneratorStep = 
  | 'destination' 
  | 'context' 
  | 'profile' 
  | 'generating' 
  | 'editing';

export interface GeneratorState {
  step: GeneratorStep;
  destination?: {
    name: string;
    lat: number;
    lng: number;
    country: string;
  };
  context?: {
    duration: number;
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    activities: string[];
  };
  profile?: {
    experience: 'beginner' | 'intermediate' | 'expert';
    maxWeight: number;
    budget: number;
    style: 'comfort' | 'minimalist' | 'ultralight';
  };
  kit?: KitItem[];
}

export interface KitItem {
  id: string;
  name: string;
  category: string;
  weightG: number;
  priceEur: number;
  why: string;
  alternatives?: KitItem[];
  productId?: string;
}
```

### 4.2 Service IA avec Cache PostGIS
**Fichier:** `src/lib/kit-generator/ai-service.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { GeneratorState, KitItem } from './types';

export class KitGeneratorService {
  private supabase = createClient();
  
  async generateKit(state: GeneratorState): AsyncGenerator<KitItem> {
    // 1. Check cache
    const cached = await this.checkCache(state);
    if (cached) {
      yield* this.streamCached(cached);
      return;
    }
    
    // 2. Generate via OpenRouter MCP
    const stream = await this.callOpenRouter(state);
    
    // 3. Validate & enrich each item
    for await (const chunk of stream) {
      const item = this.parseItem(chunk);
      const validated = await this.validateItem(item);
      const enriched = await this.enrichFromDB(validated);
      yield enriched;
    }
    
    // 4. Cache result
    await this.cacheKit(state, items);
  }
  
  private async checkCache(state: GeneratorState): Promise<KitItem[] | null> {
    if (!state.destination) return null;
    
    const { data } = await this.supabase.rpc('find_similar_kits', {
      lat: state.destination.lat,
      lng: state.destination.lng,
      duration: state.context?.duration,
      season: state.context?.season,
      activities: state.context?.activities,
      radius_km: 100,
      duration_tolerance: 2,
      max_age_days: 7
    });
    
    return data?.[0]?.items || null;
  }
  
  private async callOpenRouter(state: GeneratorState) {
    // TODO: Implement OpenRouter MCP call
    // Use streaming response
  }
  
  private parseItem(chunk: string): KitItem {
    // Parse JSON chunk
    return JSON.parse(chunk);
  }
  
  private async validateItem(item: KitItem): Promise<KitItem> {
    // Validate with Zod schema
    return item;
  }
  
  private async enrichFromDB(item: KitItem): Promise<KitItem> {
    // Search in products DB
    const { data } = await this.supabase
      .from('produits')
      .select('*')
      .textSearch('nom', item.name)
      .limit(1)
      .single();
    
    return { ...item, productId: data?.id };
  }
  
  private async cacheKit(state: GeneratorState, items: KitItem[]) {
    // Save to cache table
  }
  
  private async *streamCached(items: KitItem[]): AsyncGenerator<KitItem> {
    for (const item of items) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield item;
    }
  }
}
```

### 4.3 Composant Workflow Principal
**Fichier:** `src/components/kit-generator/GeneratorFlow.tsx`

```typescript
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratorState, GeneratorStep } from '@/lib/kit-generator/types';
import { DestinationStep } from './steps/DestinationStep';
import { ContextStep } from './steps/ContextStep';
import { ProfileStep } from './steps/ProfileStep';
import { GeneratingStep } from './steps/GeneratingStep';
import { EditingStep } from './steps/EditingStep';

export function GeneratorFlow() {
  const [state, setState] = useState<GeneratorState>({
    step: 'destination'
  });
  
  const stepComponents: Record<GeneratorStep, React.ComponentType<any>> = {
    destination: DestinationStep,
    context: ContextStep,
    profile: ProfileStep,
    generating: GeneratingStep,
    editing: EditingStep
  };
  
  const StepComponent = stepComponents[state.step];
  
  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <StepComponent
            state={state}
            onNext={(data) => setState({ ...state, ...data })}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

### 4.4 Steps Individuels

**Fichier:** `src/components/kit-generator/steps/DestinationStep.tsx`

```typescript
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from '@/components/animations/ScrollReveal';

export function DestinationStep({ state, onNext }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  return (
    <div className="p-6">
      <ScrollReveal>
        <h1 className="text-2xl font-bold mb-2">Où pars-tu ?</h1>
        <p className="text-ink-300 mb-6">Commence par choisir ta destination</p>
      </ScrollReveal>
      
      <motion.input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-4 rounded-xl border-2 border-ink-100"
        placeholder="Rechercher un pays, une région..."
        whileFocus={{ scale: 1.02 }}
      />
      
      {/* Suggestions list */}
      {/* Mini map preview */}
      
      <motion.button
        onClick={() => onNext({ destination: selectedDestination, step: 'context' })}
        className="mt-6 w-full bg-forest-800 text-white p-4 rounded-xl"
        whileTap={{ scale: 0.98 }}
      >
        Continuer
      </motion.button>
    </div>
  );
}
```

**Fichiers similaires à créer:**
- `src/components/kit-generator/steps/ContextStep.tsx`
- `src/components/kit-generator/steps/ProfileStep.tsx`
- `src/components/kit-generator/steps/GeneratingStep.tsx`
- `src/components/kit-generator/steps/EditingStep.tsx`

---

## Phase 5: Migration Pages Critiques

### 5.1 Explorer Page
**Fichier:** `src/app/explorer/page.tsx`

Ajouter:
- Pull-to-refresh sur liste aventures
- Scroll reveal sur cards
- Infinite scroll

### 5.2 Panier Page
**Fichier:** `src/app/panier/page.tsx`

Ajouter:
- GestureCard avec swipe-to-delete sur items
- Animation de suppression (slide-out + fade)
- Haptic feedback sur actions

### 5.3 Produit Detail Page
**Fichier:** `src/app/produit/[slug]/ProductDetailClient.tsx`

Ajouter:
- Galerie swipeable avec snap points
- Sticky buy bar avec animation slide-up
- Scroll reveal sur attributs

---

## Phase 6: Performance & Optimisation

### 6.1 Lazy Loading Framer Motion
Utiliser `LazyMotion` pour réduire le bundle:

```typescript
import { LazyMotion, domMax, m } from 'framer-motion';

export function App() {
  return (
    <LazyMotion features={domMax}>
      {/* Use <m.div> instead of <motion.div> */}
    </LazyMotion>
  );
}
```

### 6.2 Reduced Motion
Respecter les préférences utilisateur:

```typescript
import { useReducedMotion } from 'framer-motion';

export function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      animate={{ opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

### 6.3 GPU Acceleration
Ajouter sur éléments animés:

```css
.animated-element {
  will-change: transform;
  transform: translateZ(0);
}
```

---

## Tests & Validation

### Tests Unitaires
- Hooks d'animation (useScrollReveal, useParallax, etc.)
- Service IA (mock OpenRouter responses)
- Validation rules engine

### Tests E2E (Playwright)
- Workflow complet kit generator (5 steps)
- Navigation avec gestures (swipe-back, swipe-to-delete)
- Pull-to-refresh sur listes

### Performance Benchmarks
- Bundle size: ≤ +80 kB avec Framer Motion
- FPS: ≥ 55 fps sur animations scroll
- Lighthouse score: ≥ 90 performance mobile

---

## Rollout Timeline

**Week 1:** Phase 0-2 (Setup + Components Core + Hooks)
**Week 2:** Phase 3 (Homepage POC + BottomTabBar)
**Week 3-4:** Phase 4 (Kit Generator Refonte complète)
**Week 5:** Phase 5 (Migration pages critiques: Explorer, Panier, Produit)
**Week 6:** Phase 6 (Performance, optimisation, tests)
**Week 7:** QA, beta testing, monitoring
**Week 8:** Launch 🚀
