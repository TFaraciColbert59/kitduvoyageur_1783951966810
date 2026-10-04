# POC Mini-chat Pays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mini-chat IA ancré (POC) sur la page `/pays/[code]`, branché sur les routes existantes, sans nouvelle infra ni prod.

**Architecture:** Logique pure dans `src/features/pays/chat/paysChatPrompt.ts` (construction requête + extraction kit, 100% testée). Composant fin `src/components/pays/PaysMiniChat.tsx` (fixed bottom-bar `.glass`, suggestions, états, bouton copier). Un seul point de montage dans `CountryDetailClient.tsx` (le `position: fixed` couvre desktop + mobile). Aucune PII envoyée : seuls `countryCode`, `countryName`, `question` et extraits publics du guide partent vers `/api/ai/chat-completion` en mode `nemotron`/`fast` (routeur existant, rate-limit 30/h conservé).

**Tech Stack:** Next.js 15.5.25 App Router, React 19, TypeScript 5, TanStack Query 5 (hook `useCountryPracticalGuide` existant), Vitest 4 (`renderToStaticMarkup` pour le composant, env node hermétique).

**Spec:** Rapport `deep-research-report (7).md` §2 (2 intents POC : kit + période), §6 (bottom-bar, alt-text, erreurs claires, offline basique), §9 (critères POC).

## Global Constraints

- `docs/Design-tokens.md` est la seule source de vérité visuelle ; classes `.glass*` de `src/styles/liquid-glass.css` uniquement ; 0 occurrence de `#E4501C` (grep obligatoire).
- Ne jamais inventer tables/colonnes/RPC/API : réutiliser `useCountryPracticalGuide`, `/api/ai/chat-completion`, `/api/ai/country-guide/[code]`.
- Input mobile `text-[16px]` minimum (anti-zoom iOS) ; `bottom` via `var(--bottom-nav-height)` ; `prefers-reduced-motion` respecté (pas d'animation non essentielle).
- Vitest hermétique : `vitest.config.ts:15-18` vide les clés IA ; aucun test ne dépend du réseau ni des clés.
- TDD strict : test qui échoue d'abord, implémentation minimale, refactor à vert.

---

### Task 1: Builder de requête ancrée + extraction kit (logique pure)

**Files:**
- Create: `src/features/pays/chat/paysChatPrompt.ts`
- Test: `tests/pays/pays-chat-prompt.spec.ts`

**Interfaces:**
- Consumes: `DEFAULT_LKDV_SYSTEM` from `@/lib/ai/requestMode`; `CountryPracticalGuideResponse` from `@/hooks/useCountryPracticalGuide`.
- Produces: `buildPaysChatRequest(input: PaysChatInput): PaysChatRequest` avec `{ provider: 'nemotron', task: 'fast', system: string, messages: [{ role: 'user', content: string }], stream: false }`; `extractKitItems(markdown: string): string[]`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { buildPaysChatRequest, extractKitItems } from '@/features/pays/chat/paysChatPrompt';

describe('buildPaysChatRequest', () => {
  it('ancre la requete kit sur le pays et le guide, sans PII', () => {
    const req = buildPaysChatRequest({
      countryCode: 'IS',
      countryName: 'Islande',
      question: 'Crée mon kit de voyage pour juillet',
      seasonMd: 'Juillet : 10-13°C, vent, pluie fréquente.',
    });
    expect(req.provider).toBe('nemotron');
    expect(req.task).toBe('fast');
    expect(req.stream).toBe(false);
    expect(req.system).toContain('Islande');
    expect(req.system).toContain('(IS)');
    expect(req.system).toContain('10-13°C');
    expect(req.system.length).toBeLessThanOrEqual(8000);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
    expect(JSON.stringify(req)).not.toMatch(/@/);
  });

  it('tronque le contexte saisonnier pour rester sous 8000 caracteres', () => {
    const req = buildPaysChatRequest({
      countryCode: 'FR',
      countryName: 'France',
      question: 'Quand partir ?',
      seasonMd: 'x'.repeat(20000),
    });
    expect(req.system.length).toBeLessThanOrEqual(8000);
    expect(req.system).toContain('France');
    expect(req.system).toContain('(FR)');
  });
});

describe('extractKitItems', () => {
  it('extrait les puces et numerotees, dedup, max 50', () => {
    const md = '- Veste imperméable\n* Veste imperméable\n1. Pantalon coupe-vent\n• Bonnet\nTexte libre';
    expect(extractKitItems(md)).toEqual(['Veste imperméable', 'Pantalon coupe-vent', 'Bonnet']);
  });

  it('retourne un tableau vide sans puces', () => {
    expect(extractKitItems('Pas de liste ici.')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pays/pays-chat-prompt.spec.ts`
Expected: FAIL with "Failed to resolve import @/features/pays/chat/paysChatPrompt"

- [ ] **Step 3: Write minimal implementation**

```typescript
export interface PaysChatInput {
  countryCode: string;
  countryName: string;
  question: string;
  seasonMd?: string;
}

export interface PaysChatRequest {
  provider: 'nemotron';
  task: 'fast';
  system: string;
  messages: Array<{ role: 'user'; content: string }>;
  stream: false;
}

const MAX_SYSTEM = 8000;
const MAX_SEASON = 1500;

export function buildPaysChatRequest(input: PaysChatInput): PaysChatRequest {
  const code = input.countryCode.trim().toUpperCase();
  const name = input.countryName.trim();
  const season = (input.seasonMd ?? '').slice(0, MAX_SEASON);
  const anchor =
    `Pays concerné : ${name} (${code}). ` +
    (season ? `Contexte vérifié du guide pays : ${season} ` : '') +
    `Réponds en t'appuyant en priorité sur ce contexte. ` +
    `Si la demande porte sur un kit de voyage, réponds par une liste à puces d'articles concrets. ` +
    `Si elle porte sur la période idéale, donne les mois et pourquoi. ` +
    `Cite les sources du guide quand elles existent. N'invente aucune donnée factuelle hors contexte.`;
  const system = `${DEFAULT_LKDV_SYSTEM} ${anchor}`.slice(0, MAX_SYSTEM);
  return {
    provider: 'nemotron',
    task: 'fast',
    system,
    messages: [{ role: 'user', content: input.question }],
    stream: false,
  };
}

export function extractKitItems(markdown: string): string[] {
  const items: string[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/);
    if (m && m[1] && !items.includes(m[1]) && items.length < 50) items.push(m[1]);
  }
  return items;
}
```

(avec `import { DEFAULT_LKDV_SYSTEM } from '@/lib/ai/requestMode';` en tête de fichier)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pays/pays-chat-prompt.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/pays/pays-chat-prompt.spec.ts src/features/pays/chat/paysChatPrompt.ts
git commit -m "feat(pays): requête chat ancrée + extraction kit (POC mini-chat)"
```

### Task 2: Composant PaysMiniChat (bottom-bar fixe)

**Files:**
- Create: `src/components/pays/PaysMiniChat.tsx`
- Test: `tests/pays/pays-mini-chat.spec.ts`

**Interfaces:**
- Consumes: `buildPaysChatRequest`, `extractKitItems` (Task 1); `useCountryPracticalGuide` from `@/hooks/useCountryPracticalGuide`.
- Produces: `PaysMiniChat({ countryCode: string; countryName: string })` — fixed bottom-bar, panneau suggestions/réponses, bouton copier.

- [ ] **Step 1: Write the failing test**

```typescript
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaysMiniChat } from '@/components/pays/PaysMiniChat';

vi.mock('@/hooks/useCountryPracticalGuide', () => ({
  useCountryPracticalGuide: () => ({ data: undefined, isLoading: false }),
}));

describe('PaysMiniChat', () => {
  it('rend la barre fermee avec suggestions et toggle accessible', () => {
    const html = renderToStaticMarkup(
      React.createElement(PaysMiniChat, { countryCode: 'IS', countryName: 'Islande' })
    );
    expect(html).toContain('Crée mon kit');
    expect(html).toContain('Quand partir ?');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Ouvrir le mini-chat');
  });
});

// Limite assumée : le panneau ouvert (placeholder, role="log", aria-live)
// n'est pas vérifiable en renderToStaticMarkup sans jsdom (env node).
// Couverture E2E Playwright prévue hors POC.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pays/pays-mini-chat.spec.ts`
Expected: FAIL with "Failed to resolve import @/components/pays/PaysMiniChat"

- [ ] **Step 3: Write minimal implementation**

Composant `'use client'` : état `open`, `input`, `messages: Array<{role, text, degraded?}>`, `loading`, `error`. Envoi : `buildPaysChatRequest({countryCode, countryName, question: input, seasonMd: guide?.sections?.meilleure_saison?.content_md})` puis `fetch('/api/ai/chat-completion', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...req})})`, réponse JSON `{ text?, degraded? }` ou SSE `buildSsePayload` parsé (frames `chunk`/`done`). Affichage sources du guide (`guide.sections.*.sources`) en liens. Bouton « Copier la liste » via `navigator.clipboard.writeText(extractKitItems(text).join('\n'))` avec fallback `textarea+execCommand`. Position : `fixed left-3 right-3 z-30` + `bottom: max(var(--bottom-nav-height, 0px), env(safe-area-inset-bottom, 0px))`. Classes `.glass`, `.glass-capsule-btn`, `.glass-input` uniquement. Input `text-[16px]`. `role="log" aria-live="polite"` sur les messages. Suggestions : « Crée mon kit de voyage » et « Quand partir ? ». Message d'erreur clair + bouton réessayer ; si `degraded`, bandeau « Réponse dégradée (hors-ligne IA) ».

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pays/`
Expected: PASS (tout le dossier)

- [ ] **Step 5: Commit**

```bash
git add tests/pays/pays-mini-chat.spec.ts src/components/pays/PaysMiniChat.tsx
git commit -m "feat(pays): composant mini-chat bottom-bar (POC)"
```

### Task 3: Montage + vérification qualité

**Files:**
- Modify: `src/app/pays/[code]/CountryDetailClient.tsx` (import + `<PaysMiniChat countryCode={country.code} countryName={country.nom} />` après `</AppShellDesktop>`, dans un fragment).
- Test: existants `tests/pays/` + `npx tsc --noEmit` + `npx next lint --file` sur fichiers touchés + `grep -rn "#E4501C" src/components/pays/PaysMiniChat.tsx src/features/pays/chat/` → 0 résultat.

- [ ] **Step 1: Monter le composant** (2 lignes : import + JSX dans un `<>...</>`).
- [ ] **Step 2: Lancer la suite ciblée** `npx vitest run tests/pays/ tests/trips/phase5-kit-completeness.spec.ts` → tout vert.
- [ ] **Step 3: Types + lint** `npx tsc --noEmit` (0 erreur) ; `npx next lint --file src/components/pays/PaysMiniChat.tsx --file src/features/pays/chat/paysChatPrompt.ts` (0 erreur).
- [ ] **Step 4: Conformité design** grep 0 résultat ; `role="log"`, input 16px, bottom token vérifiés par relecture.
- [ ] **Step 5: Commit** `git commit -m "feat(pays): monte le mini-chat sur /pays/[code] (POC)"`.

## Hors scope POC (phases suivantes, ne pas faire ici)

- pgvector / NeMo Retriever / embeddings (phase DB/RAG, nécessite accès Supabase + migrations).
- ImageAPI externe (Unsplash/Wikimedia + attribution) : POC = sources texte du guide uniquement.
- Écriture inventaire Mon Matériel (« Ajouter au kit » = copier, stub explicite).
- Playwright E2E (dev server + clés IA requis), déploiement prod, monitoring Prometheus.
