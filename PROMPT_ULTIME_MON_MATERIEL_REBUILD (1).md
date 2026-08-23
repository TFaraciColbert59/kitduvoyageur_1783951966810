# 🌿 PROMPT ULTIME — Reconstruction Totale de "Mon Matériel" (LKDV)
### Cockpit Liquid Glass (Apple iOS 26 / WWDC 2025) — Exécution 100% autonome, code fourni

---

## 0. CONTEXTE POUR L'AGENT (Hermes)

Tu es un agent d'implémentation **autonome**. La page **Mon Matériel** de LKDV a été **entièrement supprimée** (fichiers, routes, composants). Tu dois la **reconstruire de zéro**, en utilisant le code fourni ci-dessous comme base directe (à adapter aux imports réels du repo, pas à réinventer), sans laisser de fichiers fantômes.

**Dépôt** : `TFaraciColbert59/kitduvoyageur_1783951966810`
**Supabase production** : `icxyvwzfjbflcbqukpfz` (région `eu-west-3`) — **seul projet à utiliser**
**⚠️ Projet fantôme à ignorer absolument** : `lwrmuggefbmboikjgudc` (ancien projet vide — vérifie la connexion active du MCP avant toute opération DB, sinon les migrations n'atteindront jamais les vrais utilisateurs, comme cela s'est déjà produit sur ce repo)
**Stack** : Next.js 15 (App Router uniquement), React 19, TypeScript strict, Tailwind CSS, Supabase (Postgres + PostGIS), Zod, Zustand
**Schéma groupes actif** : `travel_groups` (EN) — ne jamais utiliser `groupes` (FR, legacy/mort)

### Règles d'autonomie absolues
1. **Ne pose aucune question.** En cas d'ambiguïté, prends la décision la plus cohérente avec l'existant du repo, documente-la dans `MISSION_LOG.md`, et continue.
2. **Aucune déclaration de succès sans preuve.** Chaque fin de sous-phase est validée par une commande `grep`/`find`/`npm run build`/`npx tsc --noEmit` dont la sortie brute est collée dans `MISSION_LOG.md`. Une phase "✅" sans preuve = échec de mission.
3. **Canal unique** : `MISSION_LOG.md` à la racine. Une section horodatée par sous-phase : objectif → actions → preuve → statut.
4. **Branche dédiée** : `feat/materiel-rebuild-liquid-glass`.
5. **Commit atomique** après chaque sous-phase : `feat(materiel): <sous-phase> — <résumé>`.
6. **Zéro fichier fantôme** : pas de `.bak`, `.old`, `.v2`, `_OLD`, `-copy`, dossiers d'expérimentation. Un seul fichier canonique par responsabilité.
7. **Reprise possible** : si tu t'arrêtes, écris l'état exact (dernière sous-phase complétée + prochaine étape précise) dans `MISSION_LOG.md`.

### Règles d'or produit
- **Jamais** `#E4501C` (orange) — palette exclusivement Sage / Stone / Ink + sémantiques.
- **Zod** obligatoire sur toute entrée serveur.
- **RLS activée** sur toutes les tables, filtrée par `auth.uid()`.
- **Server Components par défaut** ; `'use client'` uniquement pour l'interactivité locale.
- **Jamais** deux feuilles glass empilées dans une même vue.
- **Jamais** de texte critique sur glass pur sans fond opaque garantissant un contraste ≥ 4.5:1.
- Bundle client **< 40 kB gzip** par route. WCAG 2.2 AA partout.

---

## PHASE 0 — Diagnostic post-suppression & mise en place

### 0.1 Vérifier la suppression
```bash
find . -type f \( -ipath "*materiel*" -o -ipath "*mon-materiel*" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*"
grep -rniE "mon.?materiel|MonMateriel|GearCard|/materiel" \
  --include="*.tsx" --include="*.ts" src/ app/ components/ lib/ 2>/dev/null
```
Coller la sortie dans `MISSION_LOG.md`.

### 0.2 Nettoyer les références orphelines
- Retirer tout lien `/materiel*` de la nav, du footer, de `app/sitemap.ts`, du `SearchOverlay`/`SearchContext`.
- Preuve : `npm run build 2>&1 | tail -50` sans erreur liée à `materiel`.

### 0.3 Auditer l'état Supabase
- `list_tables` (verbose) sur `icxyvwzfjbflcbqukpfz`, schéma `public`.
- Identifier les tables réutilisables vs à créer (Phase 3).
- **Ne jamais DROP une table contenant des données réelles** sans justification écrite dans `MISSION_LOG.md`.
- `get_advisors` (security + performance) → état de référence avant modification.

### 0.4 Initialiser le pilotage
- Créer `MISSION_LOG.md` (objectif, contraintes, table des 10 phases, journal).
- Créer la branche `feat/materiel-rebuild-liquid-glass`.
- Commit : `chore(materiel): init rebuild mission log + branch`.

---

## PHASE 1 — Fondations du Design System

### 1.1 `src/styles/globals.css` — Tokens complets

```css
:root {
  /* ===== Stone (neutres) ===== */
  --stone-50:#FAF8F5; --stone-100:#F1EDE6; --stone-200:#E4DED3; --stone-300:#D2CABC;
  --stone-400:#B8AE9E; --stone-500:#9A9182; --stone-600:#7A7365; --stone-700:#5B554A; --stone-800:#3F3B34;

  /* ===== Sage (primaire) ===== */
  --sage-50:#F2F6F1; --sage-100:#E1EBDE; --sage-200:#C8DAC3; --sage-300:#A6C1A0; --sage-400:#82A47C;
  --sage-500:#5B7F55; --sage-600:#486944; --sage-700:#365237;

  /* ===== Ink (texte) ===== */
  --ink-900:#14140F;
  --label:            var(--ink-900);
  --label-secondary:  color-mix(in oklab, var(--ink-900) 68%, transparent);
  --label-tertiary:   color-mix(in oklab, var(--ink-900) 48%, transparent);
  --label-quaternary: color-mix(in oklab, var(--ink-900) 32%, transparent);

  /* ===== Sémantiques ===== */
  --warn:#C89A3B;    --warn-bg:#C89A3B;
  --danger:#A8443A;  --danger-bg:#A8443A;
  --info:#4B6B7C;    --info-bg:#4B6B7C;

  /* ===== Glass ===== */
  --glass-bg-light:    color-mix(in oklab, var(--stone-50) 55%, transparent);
  --glass-bg-medium:   color-mix(in oklab, var(--stone-50) 72%, transparent);
  --glass-bg-strong:   color-mix(in oklab, var(--stone-50) 88%, transparent);
  --glass-bg-dark:     color-mix(in oklab, var(--ink-900)  45%, transparent);
  --glass-border:      color-mix(in oklab, white 35%, transparent);
  --glass-highlight-top:    linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent);
  --glass-highlight-radial: radial-gradient(120% 60% at 20% 0%, rgba(255,255,255,.35), transparent 55%);
  --glass-tint-sage:   color-mix(in oklab, var(--sage-500) 8%, transparent);
  --glass-blur-sm:14px; --glass-blur-md:22px; --glass-blur-lg:32px; --glass-sat:180%;

  /* ===== Élévations (5 niveaux, ligne spéculaire obligatoire dès elevation-3) ===== */
  --elevation-1: 0 1px 2px -1px rgba(20,20,15,.06), 0 2px 4px -2px rgba(20,20,15,.04);
  --elevation-2: 0 4px 12px -4px rgba(20,20,15,.08), 0 1px 2px -1px rgba(20,20,15,.06), inset 0 1px 0 rgba(255,255,255,.5);
  --elevation-3: 0 8px 32px -8px rgba(20,20,15,.12), 0 2px 8px -2px rgba(20,20,15,.06), inset 0 1px 0 rgba(255,255,255,.6);
  --elevation-4: 0 16px 48px -12px rgba(20,20,15,.18), 0 4px 12px -4px rgba(20,20,15,.08), inset 0 1px 0 rgba(255,255,255,.65);
  --elevation-5: 0 24px 80px -16px rgba(20,20,15,.25), 0 4px 12px -4px rgba(20,20,15,.08), inset 0 1px 0 rgba(255,255,255,.7);

  /* ===== Rayons (iOS 26 aligned) ===== */
  --r-xs:6px; --r-sm:10px; --r-md:14px; --r-lg:20px; --r-xl:26px; --r-2xl:32px; --r-full:9999px;

  /* ===== Espacement (grille 4pt) ===== */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;

  /* ===== Motion ===== */
  --ease-glass: cubic-bezier(.22, 1, .36, 1);
  --ease-emphasis: cubic-bezier(.32, .72, 0, 1);
  --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  --dur-xfast:120ms; --dur-fast:180ms; --dur-med:280ms; --dur-slow:420ms; --dur-xslow:800ms;

  /* ===== Typographie ===== */
  --font-display: "Inter Tight", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
  --font-body:    "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* ===== Grille de page ===== */
  --page-max-w: 1280px;
  --grid-gap: var(--space-5);
}

@media (prefers-color-scheme: dark) {
  :root {
    --glass-bg-light:  color-mix(in oklab, var(--ink-900) 55%, transparent);
    --glass-bg-medium: color-mix(in oklab, var(--ink-900) 68%, transparent);
    --glass-border:    color-mix(in oklab, white 8%, transparent);
    --elevation-3: 0 8px 32px -8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
    --label: #F1EDE6; --label-secondary: color-mix(in oklab, #F1EDE6 68%, transparent);
  }
}

@media (prefers-reduced-transparency: reduce) {
  .glass, [data-glass] {
    background: var(--stone-50) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .glass::before, .glass::after, [data-glass]::before, [data-glass]::after { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
  .glass:hover { transform: none !important; }
}

@supports not (backdrop-filter: blur(1px)) {
  .glass, [data-glass] { background: color-mix(in oklab, var(--stone-50) 92%, transparent); }
}

/* ===== Utilitaire glass de base — appliqué à TOUTES les cartes ===== */
.glass {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(var(--glass-blur-md)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur-md)) saturate(var(--glass-sat));
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  box-shadow: var(--elevation-3);
  transition:
    transform var(--dur-med) var(--ease-glass),
    box-shadow var(--dur-med) var(--ease-glass),
    background var(--dur-med) var(--ease-glass);
}
.glass::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 1px;
  background: var(--glass-highlight-top); pointer-events: none;
}
.glass::after {
  content: ''; position: absolute; inset: -1px; border-radius: inherit;
  background: var(--glass-highlight-radial); pointer-events: none;
}
.glass.interactive:hover { transform: translateY(-2px); box-shadow: var(--elevation-4); }
.glass.interactive:active { transform: translateY(0) scale(.995); transition-duration: var(--dur-xfast); }
.glass:focus-visible {
  outline: none;
  box-shadow: var(--elevation-3), 0 0 0 2px var(--stone-50), 0 0 0 4px color-mix(in oklab, var(--sage-500) 60%, transparent);
}
```

**Règle d'or Liquid Glass** : une seule feuille glass primaire par vue — jamais de glass-on-glass.

### 1.2 `tailwind.config.ts`
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stone: { 50:"#FAF8F5",100:"#F1EDE6",200:"#E4DED3",300:"#D2CABC",400:"#B8AE9E",500:"#9A9182",600:"#7A7365",700:"#5B554A",800:"#3F3B34" },
        sage:  { 50:"#F2F6F1",100:"#E1EBDE",200:"#C8DAC3",300:"#A6C1A0",400:"#82A47C",500:"#5B7F55",600:"#486944",700:"#365237" },
        ink:   { 900:"#14140F" },
        warn: "#C89A3B", danger: "#A8443A", info: "#4B6B7C",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: { xs:"6px", sm:"10px", md:"14px", lg:"20px", xl:"26px", "2xl":"32px" },
      boxShadow: {
        "elevation-1": "var(--elevation-1)", "elevation-2": "var(--elevation-2)",
        "elevation-3": "var(--elevation-3)", "elevation-4": "var(--elevation-4)", "elevation-5": "var(--elevation-5)",
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(.22,1,.36,1)", emphasis: "cubic-bezier(.32,.72,0,1)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
export default config;
```

### 1.3 Structure de dossiers cible
```
app/materiel/
  layout.tsx
  page.tsx                      # grille des 6 cartes
  depart/[id]/page.tsx
  forget/page.tsx
  kits/page.tsx
  inventaire/page.tsx
  alertes/page.tsx
  disponibilite/page.tsx
src/features/materiel/
  components/
    cards/           # GearCardDepart.tsx, GearCardForget.tsx, GearCardKits.tsx, GearCardInventaire.tsx, GearCardAlertes.tsx, GearCardDispo.tsx
    depart/           # widgets W-D-1..10
    forget/
    kits/             # widgets W-K-1..10
    inventaire/        # widgets W-I-1..10
    alertes/           # widgets W-L-1..10
    disponibilite/     # widgets W-A-1..10
  services/          # data fetching Supabase (Server only)
  hooks/             # useKits.ts, useAvailability.ts (Zustand)
  schemas/           # Zod
components/ui/
  GlassCard.tsx GlassSheet.tsx GlassCommand.tsx GlassDrawer.tsx ProductGlassCard.tsx
  Eyebrow.tsx Metric.tsx Badge.tsx ProgressBar.tsx SpotlightTracker.tsx
lib/materiel/
  db.ts (Dexie) events.ts optimizer.ts scanner.ts comparator.ts conflicts.ts
```
Preuve : `tree app/materiel src/features/materiel -L 3` collé dans le log.

---

## PHASE 2 — Composants socles (code complet)

### 2.1 `components/ui/GlassCard.tsx`
```tsx
'use client';
import { forwardRef, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type GlassTone = 'neutral' | 'sage' | 'warn' | 'danger' | 'info';
type GlassBlur = 'sm' | 'md' | 'lg';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: GlassTone;
  blur?: GlassBlur;
  interactive?: boolean;
  as?: 'div' | 'article';
  ariaLabelledBy?: string;
}

const toneTint: Record<GlassTone, string> = {
  neutral: '',
  sage: 'before:bg-[color:var(--glass-tint-sage)]',
  warn: 'ring-1 ring-warn/20',
  danger: 'ring-1 ring-danger/20',
  info: 'ring-1 ring-info/20',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ tone = 'neutral', blur = 'md', interactive = false, as = 'div', ariaLabelledBy, className, children, ...props }, ref) => {
    const Comp = motion[as as 'div'];
    return (
      <Comp
        ref={ref}
        role={as === 'article' ? 'article' : undefined}
        aria-labelledby={ariaLabelledBy}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          'glass',
          interactive && 'interactive cursor-pointer',
          `backdrop-blur-${blur === 'sm' ? '[14px]' : blur === 'lg' ? '[32px]' : '[22px]'}`,
          toneTint[tone],
          className
        )}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
GlassCard.displayName = 'GlassCard';
```

### 2.2 `components/ui/Metric.tsx`, `Eyebrow.tsx`, `Badge.tsx`, `ProgressBar.tsx`
```tsx
// components/ui/Eyebrow.tsx
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-[color:var(--label-secondary)] font-body">
      {children}
    </p>
  );
}

// components/ui/Metric.tsx
import { cn } from '@/lib/utils';
export function Metric({
  value, size = 'lg', tone = 'default', className,
}: { value: React.ReactNode; size?: 'md' | 'lg' | 'xl'; tone?: 'default' | 'sage' | 'danger'; className?: string }) {
  const sizeCls = {
    md: 'text-[32px] leading-[38px]',
    lg: 'text-[44px] leading-[48px]',
    xl: 'text-[64px] leading-[68px]',
  }[size];
  const toneCls = {
    default: 'text-[color:var(--label)]',
    sage: 'text-sage-500',
    danger: 'text-danger',
  }[tone];
  return (
    <span className={cn('font-display font-semibold tabular-nums tracking-tight', sizeCls, toneCls, className)}>
      {value}
    </span>
  );
}

// components/ui/Badge.tsx
import { cn } from '@/lib/utils';
type BadgeTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone';
const badgeTones: Record<BadgeTone, string> = {
  sage:   'bg-sage-500/15 text-sage-600 ring-sage-500/20',
  warn:   'bg-warn/15 text-warn ring-warn/25',
  danger: 'bg-danger/15 text-danger ring-danger/25',
  info:   'bg-info/15 text-info ring-info/25',
  stone:  'bg-stone-600/15 text-stone-600 ring-stone-600/20',
};
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center h-[22px] px-2.5 rounded-full text-[12px] leading-4 ring-1 backdrop-blur',
      badgeTones[tone]
    )}>
      {children}
    </span>
  );
}

// components/ui/ProgressBar.tsx
import { cn } from '@/lib/utils';
type ProgressTone = 'sage' | 'warn' | 'danger';
export function ProgressBar({
  value, tone = 'sage', label,
}: { value: number; tone?: ProgressTone; label: string }) {
  const fillCls = {
    sage: 'bg-gradient-to-r from-sage-500 to-sage-300',
    warn: 'bg-gradient-to-r from-warn to-warn/60',
    danger: 'bg-gradient-to-r from-danger to-danger/60',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full rounded-full bg-stone-200/70 overflow-hidden"
    >
      <div className={cn('h-full transition-[width] duration-300 ease-glass', fillCls)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
```

### 2.3 `components/ui/GlassSheet.tsx` (plein écran modal accessible)
```tsx
'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export function GlassSheet({
  open, onOpenChange, title, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-ink-900/30"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-label={title}>
              <motion.div
                className="fixed inset-0 z-50 overflow-y-auto bg-[color:var(--glass-bg-strong)] backdrop-blur-[32px] backdrop-saturate-[200%]"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14 glass border-b border-glass-border">
                  <Dialog.Close asChild>
                    <button
                      aria-label="Retour"
                      className="glass interactive h-9 w-9 flex items-center justify-center rounded-full"
                    >
                      <ArrowLeft size={18} className="text-[color:var(--label)]" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                  <Dialog.Title className="font-display font-semibold text-[20px] text-[color:var(--label)]">
                    {title}
                  </Dialog.Title>
                </header>
                <div className="px-4 pb-24 pt-4 max-w-[var(--page-max-w)] mx-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

### 2.4 `components/ui/GlassCommand.tsx` (⌘K universel)
```tsx
'use client';
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { z } from 'zod';
import { create } from 'zustand';

const QuerySchema = z.string().min(1).max(120);

interface CommandStore { open: boolean; context: string; setOpen: (v: boolean) => void; setContext: (c: string) => void; }
export const useCommandStore = create<CommandStore>((set) => ({
  open: false, context: 'global',
  setOpen: (open) => set({ open }),
  setContext: (context) => set({ context }),
}));

export function GlassCommand() {
  const { open, context, setOpen } = useCommandStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(!open); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const parsed = QuerySchema.safeParse(query);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink-900/40" />
        <Dialog.Content
          aria-label={`Recherche universelle — contexte ${context}`}
          className="fixed z-[70] left-1/2 top-24 -translate-x-1/2 w-[min(640px,92vw)] glass p-2"
        >
          <div className="flex items-center gap-2 px-3 h-11 rounded-[var(--r-md)] bg-white/40">
            <Search size={18} className="text-[color:var(--label-tertiary)]" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher dans ${context}… (kits, produits, itinéraires, alertes)`}
              className="flex-1 bg-transparent outline-none font-body text-[15px] text-[color:var(--label)]"
              aria-invalid={!parsed.success && query.length > 0}
            />
          </div>
          {/* Résultats : brancher sur la recherche tsvector Supabase (voir Phase 3.1) */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### 2.5 `components/ui/ProductGlassCard.tsx` (cross-sell réutilisable)
```tsx
import Image from 'next/image';
import { Badge } from './Badge';

export function ProductGlassCard({
  name, imageUrl, price, sponsored = true, href,
}: { name: string; imageUrl: string; price: string; sponsored?: boolean; href: string }) {
  return (
    <a href={href} className="glass interactive block w-[168px] shrink-0 p-3" aria-label={`${name}, ${price}`}>
      <div className="relative h-[120px] w-full rounded-[var(--r-md)] overflow-hidden bg-stone-100">
        <Image src={imageUrl} alt={name} fill sizes="168px" className="object-cover" />
      </div>
      <p className="mt-2 text-sm font-medium text-[color:var(--label)] line-clamp-2">{name}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-display font-semibold text-[15px] text-[color:var(--label)]">{price}</span>
        {sponsored && <Badge tone="stone">Partenaire</Badge>}
      </div>
    </a>
  );
}
```

### 2.6 `components/ui/GlassDrawer.tsx` (panneau latéral 520px)
```tsx
'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export function GlassDrawer({
  open, onOpenChange, title, width = 520, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; width?: number; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/25" />
        <Dialog.Content asChild aria-label={title}>
          <motion.div
            className="fixed right-0 top-0 z-50 h-full glass rounded-l-[var(--r-xl)] rounded-r-none overflow-y-auto"
            style={{ width }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between px-5 h-14 border-b border-glass-border">
              <Dialog.Title className="font-display font-semibold text-[17px]">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Fermer" className="h-8 w-8 rounded-full glass interactive flex items-center justify-center">
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </header>
            <div className="p-5">{children}</div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Installer : `lucide-react`, `framer-motion`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `maplibre-gl`, `recharts`, `@tailwindcss/forms`, `zustand`, `@tanstack/virtual`, `zod`, `@headlessui/react`.

Preuve : `ls components/ui/*.tsx` (9 fichiers attendus) + `npx tsc --noEmit` sans erreur sur ces fichiers.

---

## PHASE 3 — Supabase : schéma complet, RLS, migrations

### 3.1 Migration `supabase/migrations/<timestamp>_materiel_rebuild.sql`

```sql
-- ============================================================
-- MON MATÉRIEL — Schéma complet (kits, items, inventaire, alertes, prêts, partage)
-- ============================================================

-- Fonction générique de mise à jour updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. KITS
-- ============================================================
create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  season text check (season in ('printemps','ete','automne','hiver','toute_saison')),
  total_weight_g integer default 0,
  is_public boolean not null default false,
  is_favorite boolean not null default false,
  is_trashed boolean not null default false,
  cover_image_url text,
  tags text[] default '{}',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kits_user_id on public.kits(user_id);
create index if not exists idx_kits_public on public.kits(is_public) where is_public = true;
create index if not exists idx_kits_search on public.kits using gin(search_vector);

create or replace function public.kits_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('french', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kits_search_vector on public.kits;
create trigger trg_kits_search_vector before insert or update on public.kits
  for each row execute function public.kits_search_vector_update();

drop trigger if exists trg_kits_updated_at on public.kits;
create trigger trg_kits_updated_at before update on public.kits
  for each row execute function public.set_updated_at();

alter table public.kits enable row level security;

create policy "kits_select_own_or_public" on public.kits
  for select using (auth.uid() = user_id or is_public = true);
create policy "kits_insert_own" on public.kits
  for insert with check (auth.uid() = user_id);
create policy "kits_update_own" on public.kits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "kits_delete_own" on public.kits
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 2. PRODUCT_OWNERSHIP (inventaire personnel) — créée AVANT kit_items pour la FK
-- ============================================================
create table if not exists public.product_ownership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  category text,
  weight_g integer,
  price_cents integer,
  purchase_date date,
  condition text check (condition in ('neuf','bon','use','a_remplacer','pour_pieces')),
  photo_url text,
  barcode text,
  is_lent boolean not null default false,
  maintenance_due_at date,
  expiry_date date,
  tags text[] default '{}',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_ownership_user_id on public.product_ownership(user_id);
create index if not exists idx_product_ownership_search on public.product_ownership using gin(search_vector);

create or replace function public.product_ownership_search_vector_update()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('french', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(new.brand, '')), 'B') ||
    setweight(to_tsvector('french', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_product_ownership_search on public.product_ownership;
create trigger trg_product_ownership_search before insert or update on public.product_ownership
  for each row execute function public.product_ownership_search_vector_update();

drop trigger if exists trg_product_ownership_updated_at on public.product_ownership;
create trigger trg_product_ownership_updated_at before update on public.product_ownership
  for each row execute function public.set_updated_at();

alter table public.product_ownership enable row level security;

create policy "product_ownership_select_own" on public.product_ownership
  for select using (auth.uid() = user_id);
create policy "product_ownership_insert_own" on public.product_ownership
  for insert with check (auth.uid() = user_id);
create policy "product_ownership_update_own" on public.product_ownership
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "product_ownership_delete_own" on public.product_ownership
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 3. KIT_ITEMS (liaison kit <-> objets d'inventaire)
-- ============================================================
create table if not exists public.kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.kits(id) on delete cascade,
  product_ownership_id uuid references public.product_ownership(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  category text,
  weight_g integer default 0,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kit_items_kit_id on public.kit_items(kit_id);
create index if not exists idx_kit_items_user_id on public.kit_items(user_id);

drop trigger if exists trg_kit_items_updated_at on public.kit_items;
create trigger trg_kit_items_updated_at before update on public.kit_items
  for each row execute function public.set_updated_at();

alter table public.kit_items enable row level security;

create policy "kit_items_select_own" on public.kit_items
  for select using (auth.uid() = user_id);
create policy "kit_items_insert_own" on public.kit_items
  for insert with check (auth.uid() = user_id);
create policy "kit_items_update_own" on public.kit_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "kit_items_delete_own" on public.kit_items
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 4. ALERTS
-- ============================================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_ownership_id uuid references public.product_ownership(id) on delete cascade,
  type text not null check (type in ('entretien','peremption','pret','etat','conflit','meteo','reglementation')),
  severity text not null check (severity in ('info','warning','critical')) default 'warning',
  message text not null,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_alerts_user_id on public.alerts(user_id);
create index if not exists idx_alerts_unresolved on public.alerts(user_id, is_resolved) where is_resolved = false;

drop trigger if exists trg_alerts_updated_at on public.alerts;
create trigger trg_alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;

create policy "alerts_select_own" on public.alerts
  for select using (auth.uid() = user_id);
create policy "alerts_insert_own" on public.alerts
  for insert with check (auth.uid() = user_id);
create policy "alerts_update_own" on public.alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alerts_delete_own" on public.alerts
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 5. LOANS (prêts — accès croisé prêteur/emprunteur)
-- ============================================================
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  product_ownership_id uuid not null references public.product_ownership(id) on delete cascade,
  lender_id uuid not null references auth.users(id) on delete cascade,
  borrower_id uuid references auth.users(id) on delete set null,
  borrower_contact text,
  status text not null check (status in ('en_cours','rendu','en_retard','litige')) default 'en_cours',
  loaned_at date not null default current_date,
  due_date date,
  returned_at date,
  contract_pdf_url text,
  lender_rating numeric(2,1),
  borrower_rating numeric(2,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_loans_lender_id on public.loans(lender_id);
create index if not exists idx_loans_borrower_id on public.loans(borrower_id);

drop trigger if exists trg_loans_updated_at on public.loans;
create trigger trg_loans_updated_at before update on public.loans
  for each row execute function public.set_updated_at();

alter table public.loans enable row level security;

-- Accès croisé : prêteur ET emprunteur peuvent voir/mettre à jour le prêt
create policy "loans_select_involved" on public.loans
  for select using (auth.uid() = lender_id or auth.uid() = borrower_id);
create policy "loans_insert_lender" on public.loans
  for insert with check (auth.uid() = lender_id);
create policy "loans_update_involved" on public.loans
  for update using (auth.uid() = lender_id or auth.uid() = borrower_id)
  with check (auth.uid() = lender_id or auth.uid() = borrower_id);
create policy "loans_delete_lender" on public.loans
  for delete using (auth.uid() = lender_id);

-- ============================================================
-- 6. SHARE_TOKENS (partage de kit — lecture publique via token)
-- ============================================================
create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.kits(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  permission text not null check (permission in ('lecture','fork','co_edition')) default 'lecture',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_tokens_token on public.share_tokens(token);
create index if not exists idx_share_tokens_kit_id on public.share_tokens(kit_id);

alter table public.share_tokens enable row level security;

-- Lecture publique si le token est valide (vérification applicative côté API route,
-- car RLS ne peut pas lire un paramètre de requête HTTP directement)
create policy "share_tokens_select_owner" on public.share_tokens
  for select using (auth.uid() = owner_id);
create policy "share_tokens_insert_owner" on public.share_tokens
  for insert with check (auth.uid() = owner_id);
create policy "share_tokens_delete_owner" on public.share_tokens
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- FIN — Vérification obligatoire après application
-- ============================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('kits','kit_items','product_ownership','alerts','loans','share_tokens');
-- -> rowsecurity doit être TRUE pour les 6 tables, sans exception.
```

### 3.2 Application et vérification
Appliquer via le MCP Supabase (`apply_migration`), **jamais** via `execute_sql` brut, pour garder l'historique des migrations. Puis vérifier :
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('kits','kit_items','product_ownership','alerts','loans','share_tokens');
```
Résultat attendu : `rowsecurity = true` sur les 6 lignes. Coller ce résultat dans `MISSION_LOG.md`.

### 3.3 Gamification
Vérifier si `reward_engine` (migration `20260816000000_reward_engine.sql`) est actif ; si oui, brancher les événements (kit assigné, prêt rendu, objet ajouté) sur ce système plutôt que d'en créer un nouveau — chercher la fonction/trigger d'émission d'événements existante avant d'en écrire une nouvelle.

### 3.4 Vérification finale de phase
- `list_tables` (verbose) sur `icxyvwzfjbflcbqukpfz` → coller la sortie.
- `get_advisors` type `security` → **zéro alerte RLS manquante** sur les 6 tables avant de passer en Phase 4.
- `get_advisors` type `performance` → vérifier que les index créés couvrent les requêtes prévues (filtre par `user_id`, recherche full-text).

---

## PHASE 4 — Page grille principale `/materiel`

### 4.1 `app/materiel/page.tsx` — Layout & placement des 6 cartes

Grille CSS avec zones nommées : la carte **Départ** occupe 8 colonnes en hero (desktop), les 5 autres se répartissent en dessous sur 2 rangées de colonnes égales. Mobile : 1 colonne, ordre Départ → Forget → Kits → Inventaire → Alertes → Dispo (réordonnable par drag & drop, persistant).

```tsx
// app/materiel/page.tsx (Server Component)
import { GearCardDepart } from '@/src/features/materiel/components/cards/GearCardDepart';
import { GearCardForget } from '@/src/features/materiel/components/cards/GearCardForget';
import { GearCardKits } from '@/src/features/materiel/components/cards/GearCardKits';
import { GearCardInventaire } from '@/src/features/materiel/components/cards/GearCardInventaire';
import { GearCardAlertes } from '@/src/features/materiel/components/cards/GearCardAlertes';
import { GearCardDispo } from '@/src/features/materiel/components/cards/GearCardDispo';
import { MaterielGrid } from '@/src/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/src/features/materiel/services/getMaterielSummary';

export default async function MaterielPage() {
  const data = await getMaterielSummary(); // Server-only, appel Supabase avec RLS

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8">
      <h1 className="sr-only">Mon Matériel</h1>
      <MaterielGrid>
        <GearCardDepart data={data.depart} className="[grid-area:depart]" />
        <GearCardForget data={data.forget} className="[grid-area:forget]" />
        <GearCardKits data={data.kits} className="[grid-area:kits]" />
        <GearCardInventaire data={data.inventaire} className="[grid-area:inventaire]" />
        <GearCardAlertes data={data.alertes} className="[grid-area:alertes]" />
        <GearCardDispo data={data.dispo} className="[grid-area:dispo]" />
      </MaterielGrid>
    </main>
  );
}
```

```css
/* src/features/materiel/components/MaterielGrid.module.css
   Fichier CSS module dédié — plus fiable que les arbitrary values Tailwind
   pour des grid-template-areas multi-lignes combinées à des breakpoints. */
.grid {
  display: grid;
  gap: var(--grid-gap);
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-template-areas:
    "depart depart depart depart depart depart depart depart forget forget forget forget"
    "kits kits kits kits inventaire inventaire inventaire inventaire alertes alertes alertes alertes"
    "dispo dispo dispo dispo dispo dispo dispo dispo dispo dispo dispo dispo";
}
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
    grid-template-areas: "depart" "forget" "kits" "inventaire" "alertes" "dispo";
  }
}
```

```tsx
// src/features/materiel/components/MaterielGrid.tsx
'use client';
import styles from './MaterielGrid.module.css';

export function MaterielGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
```

### 4.2 Les 6 cartes — code complet

**4.2.1 — `GearCardDepart.tsx`** (hero 8 colonnes)
```tsx
'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CountdownLive } from './CountdownLive';

interface DepartData {
  id: string; destination: string; startsAt: string; readinessPct: number; status: 'ok' | 'warning' | 'critical';
}

export function GearCardDepart({ data, className }: { data: DepartData; className?: string }) {
  return (
    <GlassCard as="article" interactive tone="sage" ariaLabelledBy="depart-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <h2 id="depart-title" className="text-[32px] leading-[38px] font-display font-semibold tracking-tight text-[color:var(--label)]">
            {data.destination}
          </h2>
          <Badge tone={data.status === 'ok' ? 'sage' : data.status === 'warning' ? 'warn' : 'danger'}>
            {data.status === 'ok' ? 'Prêt' : data.status === 'warning' ? 'À finaliser' : 'Incomplet'}
          </Badge>
        </div>
        <Eyebrow>Prochain départ</Eyebrow>
        <Metric value={<CountdownLive target={data.startsAt} />} size="lg" />
        <ProgressBar value={data.readinessPct} label="Préparation du départ" tone={data.readinessPct >= 80 ? 'sage' : data.readinessPct >= 40 ? 'warn' : 'danger'} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-tertiary)]">{data.readinessPct}% préparé</span>
          <Link
            href={`/materiel/depart/${data.id}`}
            className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600"
          >
            Ouvrir le cockpit →
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
```

**4.2.2 — `GearCardForget.tsx`**
```tsx
'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface ForgetData { forgetRemaining: number; checkedItems: number; totalItems: number; nextDepartLabel: string | null }

export function GearCardForget({ data, className }: { data: ForgetData; className?: string }) {
  const pct = data.totalItems > 0 ? (data.checkedItems / data.totalItems) * 100 : 100;
  return (
    <GlassCard as="article" interactive ariaLabelledBy="forget-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>À ne pas oublier</Eyebrow>
        <h2 id="forget-title" className="sr-only">À ne pas oublier</h2>
        <Metric value={data.forgetRemaining} tone={data.forgetRemaining === 0 ? 'sage' : 'danger'} />
        <ProgressBar value={pct} label="Checklist de départ" tone={pct === 100 ? 'sage' : 'danger'} />
        {data.checkedItems === data.totalItems && data.totalItems > 0 && <Badge tone="sage">Prêt</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.nextDepartLabel ?? 'Aucun départ prévu'}</span>
          <Link href="/materiel/forget" className="text-sm font-medium text-sage-600">Voir tout →</Link>
        </div>
      </div>
    </GlassCard>
  );
}
```

**4.2.3 — `GearCardKits.tsx`**
```tsx
'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface KitsData { count: number; avgCompletionPct: number; trashCount: number; assignedKitName: string | null }

export function GearCardKits({ data, className }: { data: KitsData; className?: string }) {
  const tone = data.avgCompletionPct >= 80 ? 'sage' : data.avgCompletionPct >= 40 ? 'warn' : 'danger';
  return (
    <GlassCard as="article" interactive ariaLabelledBy="kits-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Mes kits</Eyebrow>
        <h2 id="kits-title" className="sr-only">Mes kits</h2>
        <Metric value={data.count} />
        <ProgressBar value={data.avgCompletionPct} label="Complétude moyenne des kits" tone={tone} />
        {data.trashCount > 0 && <Badge tone="stone">{data.trashCount} en corbeille</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-[color:var(--label-tertiary)]">{data.assignedKitName ?? 'Aucun kit assigné'}</span>
          <Link href="/materiel/kits" className="text-sm font-medium text-sage-600">Gérer les kits →</Link>
        </div>
      </div>
    </GlassCard>
  );
}
```

**4.2.4 — `GearCardInventaire.tsx`**
```tsx
'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface InventaireData { count: number; goodConditionPct: number; orderedCount: number; lastAddedLabel: string | null }

export function GearCardInventaire({ data, className }: { data: InventaireData; className?: string }) {
  return (
    <GlassCard as="article" interactive ariaLabelledBy="inv-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Inventaire & catalogue</Eyebrow>
        <h2 id="inv-title" className="sr-only">Inventaire</h2>
        <Metric value={data.count} />
        <ProgressBar value={data.goodConditionPct} label="Objets en bon état" tone={data.goodConditionPct >= 80 ? 'sage' : 'warn'} />
        {data.orderedCount > 0 && <Badge tone="info">{data.orderedCount} en commande</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.lastAddedLabel ?? 'Inventaire vide'}</span>
          <Link href="/materiel/inventaire" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
            Ajouter →
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
```

**4.2.5 — `GearCardAlertes.tsx`**
```tsx
'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface AlertesData { count: number; criticalCount: number; warningCount: number; reliabilityScore: number; lastAlertLabel: string | null }

export function GearCardAlertes({ data, className }: { data: AlertesData; className?: string }) {
  const tone = data.criticalCount > 0 ? 'danger' : data.warningCount > 0 ? 'warn' : 'sage';
  return (
    <GlassCard
      as="article"
      interactive
      tone={data.criticalCount > 0 ? 'danger' : 'neutral'}
      ariaLabelledBy="alertes-title"
      className={className}
    >
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Alertes & fiabilité</Eyebrow>
        <h2 id="alertes-title" className="sr-only">Alertes</h2>
        <Metric value={data.count} tone={data.criticalCount > 0 ? 'danger' : 'default'} />
        <ProgressBar value={data.reliabilityScore} label="Score de fiabilité" tone={tone} />
        <div className="flex gap-2">
          {data.criticalCount > 0 && <Badge tone="danger">{data.criticalCount} critiques</Badge>}
          {data.warningCount > 0 && <Badge tone="warn">{data.warningCount} avertissements</Badge>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.lastAlertLabel ?? 'Équipement sain'}</span>
          {data.count > 0 && <Link href="/materiel/alertes" className="text-sm font-medium text-sage-600">Voir détail →</Link>}
        </div>
      </div>
    </GlassCard>
  );
}
```

**4.2.6 — `GearCardDispo.tsx`**
```tsx
'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface DispoData { unavailableCount: number; total: number; hasConflict: boolean; nextReturnLabel: string | null }

export function GearCardDispo({ data, className }: { data: DispoData; className?: string }) {
  const availablePct = data.total > 0 ? ((data.total - data.unavailableCount) / data.total) * 100 : 100;
  const tone = availablePct === 100 ? 'sage' : data.unavailableCount <= 2 ? 'warn' : 'danger';
  return (
    <GlassCard as="article" interactive ariaLabelledBy="dispo-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Disponibilité</Eyebrow>
        <h2 id="dispo-title" className="sr-only">Disponibilité</h2>
        <Metric value={data.unavailableCount} tone={data.unavailableCount > 0 ? 'danger' : 'default'} />
        <ProgressBar value={availablePct} label="Équipement disponible" tone={tone} />
        {data.hasConflict && <Badge tone="danger">Conflit détecté</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.nextReturnLabel ?? 'Tout disponible'}</span>
          <Link href="/materiel/disponibilite" className="text-sm font-medium text-sage-600">Voir prêts →</Link>
        </div>
      </div>
    </GlassCard>
  );
}
```

Preuve fin de phase : `npx tsc --noEmit` sans erreur sur `app/materiel/page.tsx` + les 6 cartes, capture Playwright de la grille.

---

## PHASE 5 — Les 6 plein écrans × 10 widgets (placement détaillé)

**Principe de placement commun** : chaque plein écran utilise `GlassSheet` comme conteneur (header fixe + zone scrollable), et une grille 12 colonnes desktop / 1 colonne mobile. Les widgets "pleine largeur" (timeline, gantt, listes) occupent `col-span-12`, les widgets "compacts" (KPI, scores) `col-span-3` ou `col-span-4`, les widgets "moyens" (graphes) `col-span-6`.

### 5.1 `/materiel/depart/[id]` — Placement des 10 widgets

```
┌─────────────────────────────────────────────────────────────┐
│ Header : titre destination + retour glass                    │
├───────────────────────────────┬───────────────────────────────┤
│ W-D-1 Carte 3D immersive       │ W-D-2 Timeline météo 48h       │
│ (col-span-8, h-[320px])        │ (col-span-4, empilé)           │
│                                 ├───────────────────────────────┤
│                                 │ W-D-8 Terrain Readiness Score  │
├───────────────────────────────┼───────────────────────────────┤
│ W-D-3 Kit assigné               │ W-D-4 Checklist condensée      │
│ (col-span-4)                    │ (col-span-4, donut radial)     │
├───────────────────────────────┼───────────────────────────────┤
│ W-D-5 Consommables (4 tuiles)   │ W-D-6 Répartition poids donut  │
│ (col-span-6)                    │ (col-span-6)                   │
├───────────────────────────────────────────────────────────────┤
│ W-D-7 Participants & urgence (col-span-12)                     │
├───────────────────────────────────────────────────────────────┤
│ W-D-9 Kits communauté similaires — strip horizontal (col-span-12)│
├───────────────────────────────────────────────────────────────┤
│ W-D-10 Actions bar sticky bottom (position: sticky, bottom:0)   │
└───────────────────────────────────────────────────────────────┘
```

```tsx
// app/materiel/depart/[id]/page.tsx
import { Map3DImmersive } from '@/src/features/materiel/components/depart/Map3DImmersive';        // W-D-1
import { WeatherTimeline48h } from '@/src/features/materiel/components/depart/WeatherTimeline48h';  // W-D-2
import { AssignedKitCard } from '@/src/features/materiel/components/depart/AssignedKitCard';        // W-D-3
import { ChecklistDonut } from '@/src/features/materiel/components/depart/ChecklistDonut';          // W-D-4
import { ConsumablesTiles } from '@/src/features/materiel/components/depart/ConsumablesTiles';      // W-D-5
import { WeightDistributionDonut } from '@/src/features/materiel/components/depart/WeightDistributionDonut'; // W-D-6
import { ParticipantsEmergency } from '@/src/features/materiel/components/depart/ParticipantsEmergency'; // W-D-7
import { TerrainReadinessScore } from '@/src/features/materiel/components/depart/TerrainReadinessScore'; // W-D-8
import { SimilarCommunityKits } from '@/src/features/materiel/components/depart/SimilarCommunityKits'; // W-D-9
import { DepartActionsBar } from '@/src/features/materiel/components/depart/DepartActionsBar';      // W-D-10
import { getDepartDetail } from '@/src/features/materiel/services/getDepartDetail';

export default async function DepartPage({ params }: { params: { id: string } }) {
  const depart = await getDepartDetail(params.id);
  return (
    <div className="grid grid-cols-12 gap-4 pb-24">
      <div className="col-span-12 md:col-span-8">
        <Map3DImmersive route={depart.route} className="h-[320px] w-full" />
      </div>
      <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
        <WeatherTimeline48h forecast={depart.forecast} />
        <TerrainReadinessScore score={depart.readinessScore} />
      </div>
      <div className="col-span-12 md:col-span-4"><AssignedKitCard kit={depart.assignedKit} /></div>
      <div className="col-span-12 md:col-span-4"><ChecklistDonut sections={depart.checklistSections} /></div>
      <div className="col-span-12 md:col-span-6"><ConsumablesTiles consumables={depart.consumables} /></div>
      <div className="col-span-12 md:col-span-6"><WeightDistributionDonut items={depart.weightBreakdown} /></div>
      <div className="col-span-12"><ParticipantsEmergency participants={depart.participants} /></div>
      <div className="col-span-12"><SimilarCommunityKits kits={depart.similarKits} /></div>
      <DepartActionsBar departId={depart.id} className="sticky bottom-0" />
    </div>
  );
}
```

**Détail par widget** :
1. **W-D-1 Carte 3D** : MapLibre GL, tuiles IGN teintées Sage (`filter: saturate(1.2) hue-rotate(-10deg)` sur le canvas), tracé `stroke: var(--sage-500)` 3px + halo, profil altimétrique en SVG superposé en bas de carte.
2. **W-D-2 Météo 48h** : bandeau horizontal scrollable, 24 cellules `h-[72px] w-[56px]` glass, icône + température + % précipitation.
3. **W-D-3 Kit assigné** : poids total en `Metric size="md"`, liste de 8 items max avec icônes catégorie, CTA "Utiliser ce kit" → deeplink `features/hiking` cockpit préchargé.
4. **W-D-4 Checklist condensée** : donut radial 96px (Recharts `RadialBarChart`), 11 sections de couleur Sage dégradée, clic → ouvre `GlassDrawer` avec la checklist complète.
5. **W-D-5 Consommables** : 4 tuiles éditables inline (`<input type="number">` stylé glass) — Eau (L), Gaz (g), Repas (nb), En-cas (nb), recalcul automatique selon durée/participants.
6. **W-D-6 Répartition poids** : `PieChart` Recharts, couleurs `sage-300` → `sage-600` par catégorie, hover = surlignage.
7. **W-D-7 Participants** : avatars empilés (max 5, `-space-x-2`), champ contact d'urgence chiffré côté serveur (jamais affiché en clair côté client sans action explicite).
8. **W-D-8 Terrain Readiness Score** : score A+→E calculé serveur (kit prêt × météo × niveau × dénivelé × dispo objets), grande lettre `Metric size="xl"` colorée selon le score.
9. **W-D-9 Kits communauté** : strip horizontal `overflow-x-auto`, 3 cards de type `ProductGlassCard` (avatar auteur, likes, poids), lien vers `app/communaut/`.
10. **W-D-10 Actions bar** : `sticky bottom-0`, 5 boutons glass — ✓ Valider (Sage primary), 📱 Mobile (deeplink app), 📤 Partager (URL + QR via `share_tokens`), 📅 Calendrier (export ICS), 🗑️ Supprimer (danger ghost, confirmation requise).

Exemple de code widget compact — **W-D-8 Terrain Readiness Score** :
```tsx
// src/features/materiel/components/depart/TerrainReadinessScore.tsx
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

const SCORE_TONE: Record<string, 'default' | 'sage' | 'danger'> = {
  'A+': 'sage', A: 'sage', B: 'sage', C: 'default', D: 'danger', E: 'danger',
};

export function TerrainReadinessScore({ score }: { score: { grade: string; factors: string[] } }) {
  return (
    <GlassCard as="article" ariaLabelledBy="readiness-title" className="p-4">
      <Eyebrow>Terrain Readiness Score</Eyebrow>
      <h3 id="readiness-title" className="sr-only">Score de préparation terrain</h3>
      <Metric value={score.grade} size="xl" tone={SCORE_TONE[score.grade] ?? 'default'} />
      <ul className="mt-2 flex flex-col gap-1">
        {score.factors.map((f) => (
          <li key={f} className="text-xs text-[color:var(--label-tertiary)]">• {f}</li>
        ))}
      </ul>
    </GlassCard>
  );
}
```

### 5.2 `/materiel/forget` — Placement
```
┌───────────────────────────────────────────────┐
│ Header : titre + retour                        │
├───────────────────────────────────────────────┤
│ Liste de tâches (glass, une ligne par item)    │
│   [✓] Item 1        [ ] Item 2       ...       │
├───────────────────────────────────────────────┤
│ Compteurs consommables (3 tuiles, col-span-4)  │
├───────────────────────────────────────────────┤
│ Bouton "Valider la préparation" (full-width)   │
└───────────────────────────────────────────────┘
```
```tsx
// src/features/materiel/components/forget/ForgetChecklistItem.tsx
'use client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function ForgetChecklistItem({
  label, checked, onToggle,
}: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      aria-pressed={checked}
      className="glass w-full flex items-center gap-3 p-2 rounded-xl text-left"
    >
      <span
        className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
          checked ? 'bg-sage-500' : 'bg-stone-200'
        }`}
      >
        {checked && <Check size={12} className="text-white" aria-hidden="true" />}
      </span>
      <span className={`text-sm ${checked ? 'line-through text-[color:var(--label-quaternary)]' : 'text-[color:var(--label)]'}`}>
        {label}
      </span>
    </motion.button>
  );
}
```

### 5.3 `/materiel/kits` — Placement des 10 widgets
```
┌───────────────────────────────────────────────────────────────┐
│ Header : recherche GlassCommand (context="kits") + retour       │
├───────────────────────────────────────────────────────────────┤
│ W-K-1 KPI bar — 4 tuiles (col-span-3 chacune)                   │
├──────────────────┬──────────────────────────────────────────────┤
│ W-K-3 Filtres      │ W-K-2 Grille de kits (3 colonnes, col-span-9)│
│ latéraux 260px      │                                              │
│ (col-span-3)        │                                              │
├──────────────────┴──────────────────────────────────────────────┤
│ W-K-4 Kit Builder DnD — inventaire | kit en cours (col-span-12)  │
├───────────────────────────────────────────────────────────────┤
│ W-K-5 IA Optimizer (⌘K, diff avant/après) (col-span-12)          │
├──────────────────┬──────────────────────────────────────────────┤
│ W-K-6 Comparateur  │ W-K-9 Weather Match Score (col-span-6)        │
│ 2 kits (col-span-6)│                                              │
├───────────────────────────────────────────────────────────────┤
│ W-K-7 Template Store communautaire — feed (col-span-12)          │
├───────────────────────────────────────────────────────────────┤
│ W-K-8 Historique versions (timeline verticale, col-span-12)      │
├───────────────────────────────────────────────────────────────┤
│ W-K-10 Suggestions produits — strip ProductGlassCard×4 (col-12)  │
└───────────────────────────────────────────────────────────────┘
```
Widget clé — **W-K-4 Kit Builder drag & drop** :
```tsx
'use client';
import { Reorder } from 'framer-motion';
import { useState } from 'react';
import type { InventoryItem } from '@/src/features/materiel/schemas/inventory';

export function KitBuilder({
  inventory, initialKitItems, onDrop,
}: { inventory: InventoryItem[]; initialKitItems: InventoryItem[]; onDrop: (item: InventoryItem) => void }) {
  const [kitItems, setKitItems] = useState(initialKitItems);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass p-3">
        <p className="text-sm font-medium mb-2">Inventaire</p>
        <ul className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
          {inventory.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('itemId', item.id)}
              className="glass interactive p-2 text-sm cursor-grab"
            >
              {item.name}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="glass p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const itemId = e.dataTransfer.getData('itemId');
          const item = inventory.find((i) => i.id === itemId);
          if (item) { onDrop(item); setKitItems((prev) => [...prev, item]); }
        }}
      >
        <p className="text-sm font-medium mb-2">Kit en cours</p>
        <Reorder.Group axis="y" values={kitItems} onReorder={setKitItems} className="flex flex-col gap-1">
          {kitItems.map((item) => (
            <Reorder.Item key={item.id} value={item} className="glass p-2 text-sm">
              {item.name}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
```

### 5.4 `/materiel/inventaire` — Placement des 10 widgets
```
┌───────────────────────────────────────────────────────────────┐
│ Header : recherche glass (voice+scan+IA) + 4 onglets segmentés  │
├───────────────────────────────────────────────────────────────┤
│ W-I-1 Vue d'ensemble — 3 KPI 44px + barre fiabilité (col-12)     │
├───────────────────────────────────────────────────────────────┤
│ W-I-2 Recherche + tri + toggle vue (Cartes/Table/Timeline)       │
├──────────────────┬──────────────────────────────────────────────┤
│ W-I-4 Filtres      │ W-I-3 Grille virtualisée 2 colonnes           │
│ avancés (col-3)    │ (TanStack Virtual, cards 96px, col-9)         │
│                     │  → clic ouvre W-I-5 en GlassDrawer 520px      │
├───────────────────────────────────────────────────────────────┤
│ W-I-6 Scan OCR/Barcode — bouton flottant (position: fixed)       │
├──────────────────┬──────────────────────────────────────────────┤
│ W-I-7 Comparateur  │ W-I-8 Achats & investissement (2 graphes)     │
│ multi-objets (col-6)│ (col-6)                                      │
├───────────────────────────────────────────────────────────────┤
│ W-I-9 Insight IA — bandeau (col-12)                              │
├───────────────────────────────────────────────────────────────┤
│ W-I-10 Cross-sell IA — strip ProductGlassCard×4 (col-12)         │
└───────────────────────────────────────────────────────────────┘
```
Widget clé — **W-I-3 Grille virtualisée** :
```tsx
'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { InventoryItem } from '@/src/features/materiel/schemas/inventory';
import { InventoryCard } from './InventoryCard';

export function InventoryVirtualGrid({ items }: { items: InventoryItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(items.length / 2),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 104, // 96px carte + 8px gap
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="h-[70vh] overflow-y-auto">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const pair = items.slice(virtualRow.index * 2, virtualRow.index * 2 + 2);
          return (
            <div
              key={virtualRow.key}
              className="grid grid-cols-2 gap-3 absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)`, height: 96 }}
            >
              {pair.map((item) => <InventoryCard key={item.id} item={item} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Widget clé — **W-I-6 Scan OCR/Barcode** (Zod côté API) :
```ts
// app/api/materiel/scan/route.ts (Edge)
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const ScanSchema = z.object({
  imageBase64: z.string().min(100),
  barcode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // 1. Si barcode détecté côté client (Web BarcodeDetector), recherche produit par code-barres.
  // 2. Sinon, appel Gemini Vision pour extraire marque/modèle/poids depuis l'étiquette.
  // -> Implémenter l'appel Gemini dans lib/materiel/scanner.ts, jamais directement ici.
  return NextResponse.json({ brand: null, model: null, weightG: null, confidence: 0 });
}
```

### 5.5 `/materiel/alertes` — Placement des 10 widgets
```
┌───────────────────────────────────────────────────────────────┐
│ Header : titre + filtres select + GlassCommand (context="alertes")│
├──────────────────┬──────────────────────────────────────────────┤
│ W-L-1 Score        │ W-L-3 Onglets verticaux catégories (col-3)    │
│ fiabilité (col-3)  │                                              │
├──────────────────┴──────────────────────────────────────────────┤
│ W-L-2 Top 3 à surveiller — accordéon (col-12)                    │
├───────────────────────────────────────────────────────────────┤
│ W-L-4 Bandeau saisonnier IA (col-12, chip cliquable)              │
├───────────────────────────────────────────────────────────────┤
│ W-L-5 Timeline alertes 90j — chrono verticale (col-12)            │
├──────────────────┬──────────────────────────────────────────────┤
│ W-L-6 À compléter  │ W-L-7 Météo radar prochain départ (col-6)     │
│ (col-6)             │                                              │
├───────────────────────────────────────────────────────────────┤
│ W-L-8 Calendrier rappels entretien — vue mensuelle (col-12)       │
├───────────────────────────────────────────────────────────────┤
│ W-L-9 Marketplace occasion (col-12)                               │
├───────────────────────────────────────────────────────────────┤
│ W-L-10 Export & partage — 3 boutons (col-12)                      │
└───────────────────────────────────────────────────────────────┘
```
Widget clé — **W-L-5 Timeline alertes 90j** (chrono verticale) :
```tsx
// src/features/materiel/components/alertes/AlertsTimeline.tsx
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';

interface AlertEntry { id: string; date: string; message: string; severity: 'info' | 'warning' | 'critical' }

const severityTone = { info: 'info', warning: 'warn', critical: 'danger' } as const;

export function AlertsTimeline({ entries }: { entries: AlertEntry[] }) {
  return (
    <GlassCard className="p-4">
      <ol className="relative border-l border-glass-border pl-4 flex flex-col gap-4">
        {entries.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sage-500" aria-hidden="true" />
            <p className="text-xs text-[color:var(--label-quaternary)]">{e.date}</p>
            <p className="text-sm text-[color:var(--label)]">{e.message}</p>
            <Badge tone={severityTone[e.severity]}>{e.severity}</Badge>
          </li>
        ))}
      </ol>
    </GlassCard>
  );
}
```

### 5.6 `/materiel/disponibilite` — Placement des 10 widgets
```
┌───────────────────────────────────────────────────────────────┐
│ Header : titre + retour                                          │
├──────────────────┬──────────────────────────────────────────────┤
│ W-A-1 Gauge Sage   │ W-A-2 KPI 4 tuiles (col-8)                    │
│ 72px (col-4)        │                                              │
├───────────────────────────────────────────────────────────────┤
│ W-A-3 Timeline Gantt 30j — une ligne par objet (col-12)           │
├───────────────────────────────────────────────────────────────┤
│ W-A-4 Onglets prêts (Par moi / À moi / Engagés) (col-12)          │
├───────────────────────────────────────────────────────────────┤
│ W-A-5 Détecteur de conflits — Server Component (col-12)           │
├──────────────────┬──────────────────────────────────────────────┤
│ W-A-6 Carte prêts  │ W-A-7 Contrat de prêt digital (col-6)         │
│ heatmap (col-6)     │                                              │
├───────────────────────────────────────────────────────────────┤
│ W-A-8 Rappels automatiques — timeline notifs (col-12)             │
├──────────────────┬──────────────────────────────────────────────┤
│ W-A-9 Score        │ W-A-10 Actions collectives (col-6)            │
│ fiabilité (col-6)  │                                              │
└───────────────────────────────────────────────────────────────┘
```

Widget clé — **W-A-1 Gauge Sage animée** :
```tsx
'use client';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function AvailabilityGauge({ availableCount, total }: { availableCount: number; total: number }) {
  const pct = total > 0 ? (availableCount / total) * 100 : 100;
  const spring = useSpring(0, { stiffness: 120, damping: 20 });
  const strokeDashoffset = useTransform(spring, (v) => 2 * Math.PI * 32 * (1 - v / 100));

  useEffect(() => { spring.set(pct); }, [pct, spring]);

  return (
    <div className="relative h-[72px] w-[72px]" role="img" aria-label={`${availableCount} sur ${total} objets disponibles`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r="32" fill="none" stroke="var(--stone-200)" strokeWidth="8" />
        <motion.circle
          cx="36" cy="36" r="32" fill="none" stroke="var(--sage-500)" strokeWidth="8"
          strokeDasharray={2 * Math.PI * 32}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-semibold text-[15px] tabular-nums">
        {availableCount}/{total}
      </span>
    </div>
  );
}
```

Widget clé — **W-A-5 Détecteur de conflits** (Server Component, logique métier) :
```tsx
// src/features/materiel/components/disponibilite/ConflictDetector.tsx
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface ConflictResult { itemId: string; itemName: string; conflictType: 'kit_vs_depart' | 'kit_vs_loan'; details: string }

async function detectConflicts(userId: string): Promise<ConflictResult[]> {
  const supabase = getSupabaseServerClient();
  const { data: kitItems } = await supabase
    .from('kit_items')
    .select('id, product_ownership_id, kits(id, name)')
    .eq('user_id', userId);
  const { data: loans } = await supabase
    .from('loans')
    .select('product_ownership_id, due_date, status')
    .eq('lender_id', userId)
    .eq('status', 'en_cours');

  const conflicts: ConflictResult[] = [];
  for (const loan of loans ?? []) {
    const assigned = kitItems?.find((ki) => ki.product_ownership_id === loan.product_ownership_id);
    if (assigned) {
      conflicts.push({
        itemId: loan.product_ownership_id,
        itemName: 'Objet en conflit', // hydrater avec le nom réel via jointure product_ownership
        conflictType: 'kit_vs_loan',
        details: `Assigné à un kit alors qu'il est actuellement prêté (retour prévu ${loan.due_date}).`,
      });
    }
  }
  return conflicts;
}

export async function ConflictDetector({ userId }: { userId: string }) {
  const conflicts = await detectConflicts(userId);
  if (conflicts.length === 0) {
    return <p className="text-sm text-[color:var(--label-secondary)]">Aucun conflit détecté.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {conflicts.map((c) => (
        <li key={c.itemId} className="glass p-3 ring-1 ring-danger/25">
          <p className="text-sm font-medium text-danger">{c.itemName}</p>
          <p className="text-xs text-[color:var(--label-secondary)]">{c.details}</p>
        </li>
      ))}
    </ul>
  );
}
```

Preuve fin de phase : `npx tsc --noEmit` sans erreur sur les 6 dossiers de widgets + capture Playwright de chaque plein écran.

---

## PHASE 6 — Interconnexions natives avec le reste de LKDV

| Module | Interconnexion | Chemin repo | Point d'ancrage code |
|---|---|---|---|
| Itinéraires/Explorer | Génération de kit depuis un itinéraire, deeplink cockpit | `app/explorer/`, `features/hiking/` | bouton `AssignedKitCard` → `router.push('/hiking/cockpit?kitId=...')` |
| Communauté | Kits fork-ables, feed, marketplace occasion | `app/communaut/` | `SimilarCommunityKits`, action serveur `forkKit(kitId)` qui duplique `kits`+`kit_items` |
| Boutique | `ProductGlassCard` en cross-sell partout | `app/(shop)/` | widgets W-D-5, W-I-10, W-L-2, W-A-7, W-K-10 |
| IA Copilote | ⌘K contextuel, insights, optimiseur streaming | `lib/materiel/optimizer.ts`, `/api/materiel/optimize` (Edge) | `GlassCommand` avec `context` dynamique |
| Hors-ligne | Service Worker + Dexie, sync bidirectionnelle | `public/sw.js`, `lib/materiel/db.ts` | voir Phase 7.3 |
| Notifications | Web Push VAPID, toasts in-app | `lib/materiel/events.ts` | `@radix-ui/react-toast` sur succès d'action |
| Export | CSV/JSON/PDF/GPX | `/api/materiel/export` | boutons W-D-10, W-L-10 |
| Partage | URL courte + QR, permissions lecture/fork/co-édition | table `share_tokens` | `/api/materiel/share/route.ts` |
| Scan objet | BarcodeDetector + Gemini Vision | `lib/materiel/scanner.ts` | widget W-I-6 |
| Calendrier | Export ICS | `/api/materiel/calendar` | bouton W-D-10 |
| Compte | Dashboard, historique, badges | `app/compte/` | lien header |

Exemple d'API route d'export (`/app/api/materiel/export/route.ts`) :
```ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const ExportSchema = z.object({
  kitId: z.string().uuid(),
  format: z.enum(['csv', 'json', 'pdf', 'gpx']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = getSupabaseServerClient();
  const { data: kit, error } = await supabase
    .from('kits')
    .select('*, kit_items(*)')
    .eq('id', parsed.data.kitId)
    .single();
  if (error || !kit) return NextResponse.json({ error: 'Kit introuvable' }, { status: 404 });

  switch (parsed.data.format) {
    case 'csv': {
      const csv = ['Nom,Catégorie,Poids(g)', ...kit.kit_items.map((i: any) => `${i.category ?? ''},${i.weight_g ?? 0}`)].join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv' } });
    }
    case 'json':
      return NextResponse.json(kit);
    default:
      return NextResponse.json({ error: 'Format non encore implémenté' }, { status: 501 });
  }
}
```

Exemple d'API route de partage (`/app/api/materiel/share/route.ts`) — génération et lecture de token :
```ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const CreateShareSchema = z.object({
  kitId: z.string().uuid(),
  permission: z.enum(['lecture', 'fork', 'co_edition']).default('lecture'),
});

export async function POST(req: NextRequest) {
  const parsed = CreateShareSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('share_tokens')
    .insert({ kit_id: parsed.data.kitId, permission: parsed.data.permission })
    .select('token')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url: `https://lkdv.app/k/${data.token}` });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const TokenSchema = z.string().length(32);
  const parsed = TokenSchema.safeParse(token);
  if (!parsed.success) return NextResponse.json({ error: 'Token invalide' }, { status: 400 });

  // Lecture avec la clé service_role côté serveur uniquement (jamais exposée au client),
  // car RLS restreint la lecture au owner — la validation de token se fait ici, en dehors de RLS.
  const supabase = getSupabaseServerClient({ useServiceRole: true });
  const { data: shareToken } = await supabase
    .from('share_tokens')
    .select('kit_id, permission, expires_at')
    .eq('token', parsed.data)
    .maybeSingle();

  if (!shareToken || (shareToken.expires_at && new Date(shareToken.expires_at) < new Date())) {
    return NextResponse.json({ error: 'Lien expiré ou invalide' }, { status: 404 });
  }
  const { data: kit } = await supabase.from('kits').select('*, kit_items(*)').eq('id', shareToken.kit_id).single();
  return NextResponse.json({ kit, permission: shareToken.permission });
}
```

---

## PHASE 7 — Accessibilité, performance, hors-ligne

### 7.1 Accessibilité (WCAG 2.2 AA)
- Contraste ≥ 4.5:1 (vérifié axe DevTools) — fond opaque `bg-white/95` derrière tout texte critique sur glass.
- Focus visible systématique (jamais `outline: none` sans `:focus-visible` équivalent — voir `.glass:focus-visible` en Phase 1.1).
- ARIA : `role="progressbar"` + `aria-valuenow/min/max/label` sur `ProgressBar` (déjà fourni), `role="status" aria-live="polite"` sur les toasts, `aria-hidden="true"` sur les icônes décoratives, `aria-label` explicite sur les icônes signifiantes.
- `prefers-reduced-motion` et `prefers-reduced-transparency` respectés (déjà dans les tokens Phase 1.1).

### 7.2 Performance
- Bundle < 40 kB gzip/route (`next build && next-bundle-analyzer`).
- Max 3 couches `backdrop-filter` empilées par écran.
- `<Suspense>` + skeleton glass sur les widgets lourds :
```tsx
<Suspense fallback={<div className="glass h-[320px] w-full animate-pulse bg-white/30" />}>
  <Map3DImmersive route={depart.route} />
</Suspense>
```
- `will-change: transform, opacity` uniquement pendant l'animation active, retiré ensuite via `onAnimationComplete` (framer-motion).

### 7.3 Mode hors-ligne
```ts
// public/sw.js
const CACHE = 'lkdv-materiel-v1';
const OFFLINE_URLS = ['/materiel', '/materiel/kits', '/materiel/inventaire'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)));
});
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/materiel')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
});
```
```ts
// lib/materiel/db.ts
import Dexie, { type Table } from 'dexie';

export interface OfflineKit { id: string; userId: string; updatedAt: string; payload: unknown }
export interface OfflineItem { id: string; userId: string; updatedAt: string; payload: unknown }
export interface OfflineAlert { id: string; itemId: string; due: string; payload: unknown }

export class MaterielDB extends Dexie {
  kits!: Table<OfflineKit>;
  items!: Table<OfflineItem>;
  alerts!: Table<OfflineAlert>;
  constructor() {
    super('lkdv-materiel');
    this.version(1).stores({
      kits: 'id, userId, updatedAt',
      items: 'id, userId, updatedAt',
      alerts: 'id, itemId, due',
    });
  }
}
export const materielDB = new MaterielDB();

export async function syncOnReconnect(userId: string) {
  // Stratégie "last write wins" : comparer updatedAt local vs serveur, pousser uniquement les changements.
  // Implémenter côté service dédié (src/features/materiel/services/sync.ts) en s'appuyant sur Supabase Realtime
  // pour les mises à jour entrantes une fois de retour en ligne.
}
```

---

## PHASE 8 — Tests & qualité

- **Playwright** : parcours carte → plein écran → retour pour les 6 cartes × 3 états (vide/normal/critique) et les 6 plein écrans × 2 flux critiques, avec `@axe-core/playwright`.
- **Vitest** : schémas Zod, `optimizer.ts`, `conflicts.ts`, `events.ts`, `comparator.ts`.
- **Storybook/Chromatic** : chaque variante `GlassCard` (tone × blur × interactive) + les 60 widgets en régression visuelle.
- **ESLint/Prettier** : conformité `.eslintrc.json` existant, zéro nouvelle erreur.

Exemple de test Playwright :
```ts
// tests/materiel.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('grille Mon Matériel — carte Départ vers plein écran et retour', async ({ page }) => {
  await page.goto('/materiel');
  await expect(page.getByRole('article', { name: /départ/i })).toBeVisible();
  await page.getByRole('link', { name: /ouvrir le cockpit/i }).click();
  await expect(page).toHaveURL(/\/materiel\/depart\//);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('button', { name: /retour/i }).click();
  await expect(page).toHaveURL('/materiel');
});
```

Exemple de test Zod (Vitest) :
```ts
// tests/schemas/kit.spec.ts
import { describe, it, expect } from 'vitest';
import { KitSchema } from '@/src/features/materiel/schemas/kit';

describe('KitSchema', () => {
  it('rejette un kit sans nom', () => {
    const result = KitSchema.safeParse({ name: '', userId: 'x' });
    expect(result.success).toBe(false);
  });
  it('accepte un kit valide', () => {
    const result = KitSchema.safeParse({ name: 'Trek 3 jours', season: 'ete' });
    expect(result.success).toBe(true);
  });
});
```

---

## PHASE 9 — Vérification finale anti-hallucination

**Aucune phase ne peut être déclarée terminée sans les preuves suivantes, collées telles quelles dans `MISSION_LOG.md` :**

1. `git status` propre + `git log --oneline -20`.
2. `find app/materiel src/features/materiel components/ui -type f` → comparé à l'arborescence cible (Phase 1.3).
3. `grep -rn "E4501C" app/materiel src/features/materiel` → **doit être vide**.
4. `npm run build` → succès sans warning bloquant.
5. `npm run test` (Vitest) → tous verts.
6. `npx playwright test` → tous verts, rapport HTML référencé.
7. `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('kits','kit_items','product_ownership','alerts','loans','share_tokens');` → 6 lignes, `rowsecurity = true`.
8. `get_advisors` (security) sur `icxyvwzfjbflcbqukpfz` → zéro alerte RLS sur les tables matériel.
9. Description précise ou capture du rendu des 6 cartes + 3 plein écrans (Départ, Kits, Inventaire) validant le style Liquid Glass.

Si une preuve manque ou échoue, la phase reste **en cours**, jamais "terminée".

---

## PHASE 10 — Livraison

1. Rapport de validation dans `MISSION_LOG.md` : captures, résultats a11y, mesures de performance (bundle, FCP, LCP), liste des interconnexions testées.
2. Documentation : `/docs/materiel-liquid-glass.md` (guide utilisateur) + section dédiée dans `/docs/DEVELOPMENT.md`.
3. Pull request depuis `feat/materiel-rebuild-liquid-glass`, description reprenant les 10 phases et leurs preuves.

---

## ANNEXE A — Composants externes
`lucide-react`, `framer-motion`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `maplibre-gl` (confirmé pour la 3D immersive — react-leaflet reste réservé aux cartes 2D de `features/hiking/` et `features/terrain/`), `recharts`, `@tailwindcss/forms`, `zustand`, `@tanstack/virtual`, `zod`, `@headlessui/react`.

## ANNEXE B — Règles d'or (rappel)
Jamais l'orange `#E4501C` · Jamais de glass-on-glass · Jamais de texte critique sur glass pur sans fond opaque · Jamais de focus outline supprimé sans équivalent · Jamais plus de 3 propriétés animées simultanément · Jamais de transition > 500ms · Toujours Zod côté serveur · Toujours RLS sur les nouvelles tables.

## ANNEXE C — Sources
Apple HIG Materials (developer.apple.com/design/human-interface-guidelines/materials) · WWDC 2025 Session 219 "Meet Liquid Glass" · WCAG 2.2 Quick Reference (w3.org/WAI/WCAG22/quickref) · Dexie docs (dexie.org) · CLAUDE.md du repo LKDV (conventions internes).

---

🌿 *Ce document est la mission complète, code inclus. Démarre par la Phase 0 immédiatement, sans attendre de confirmation, et progresse séquentiellement en documentant chaque preuve dans `MISSION_LOG.md`.*
