---
title: Audit vérifié du projet LKDV (01/09/2026)
aliases:
  - Audit vérifié
  - Vérification code vs docs
tags:
  - audit
  - vérifié
  - codebase
updated: 2026-09-01
status: 🟢 Vérifié par agents parallèles
---

# ✅ AUDIT VÉRIFIÉ DU PROJET LKDV — 01 septembre 2026

> [!abstract] **Contrôle code vs documentation** — 4 agents d'audit en lecture seule + vérifications centrales
> Cet audit confronte les affirmations des docs (CLAUDE.md, `docs/ETAT_DES_LIEUX_GLOBAL.md`, coffre Obsidian, MISSION_LOG) à la **réalité du code source** au commit `fb47b24`. Chaque affirmation a été vérifiée par preuve (grep, fichier:ligne, sortie de build).

---

## ⚙️ Vérifications centrales (relancées moi-même)

| Vérification | Commande | Résultat |
| :--- | :--- | :--- |
| **Type-check** | `npx tsc --noEmit` | ✅ **Exit 0 — 0 erreur** (5× confirmé, dont après corrections) |
| **Build prod** | `npm run build` | ✅ **Exit 0 — 323 pages statiques** (post-corrections), First Load JS partagé 103 kB, `/messagerie` 21.6 kB |
| **Orange `#E4501C`** | grep `#E4501C` dans `src/` | ✅ **0 occurrence réelle** (2 seules dans des commentaires de `liquid-glass.css`) |
| **Scripts sacro-saints** | `package.json` | ✅ `dev`, `build`, `start`, `type-check` intacts |

Le MISSION_LOG (Phases 0-6 + Mobile UX + Refonte Liquid Glass) est **fiable** sur : build 323/323, type-check 0, palette, tests pgTAP, preuves RLS.

---

## 🔴 Critiques — Sécurité & Repo (à traiter en priorité)

### C1. 3 fonctions SQL manquantes dans les migrations
- `public.is_conversation_member(uuid,uuid)`, `is_conv_owner(uuid,uuid)`, `is_conv_admin(uuid,uuid)` sont **référencées ~15×** dans `supabase/migrations/20260831000000_messaging_system_canonical.sql` (policies RLS l.284-384, storage l.407-427, trigger rôles l.192-200, tests pgTAP test 12/13) mais **0 `CREATE FUNCTION`** dans tout le repo SQL.
- **Conséquence :** la migration canonique n'est **pas auto-suffisante** — une base vierge échouerait à la 1ère `CREATE POLICY`. Les fonctions existent visiblement en prod (SQL Editor manuel, hors versionnement).
- **Action :** recréer ces fonctions dans une **nouvelle migration** (d'abord lire leurs définitions côté prod via `\df` ou le SQL Editor), vérifier `SET search_path = public, pg_temp;`, puis rejouer les 15 tests pgTAP.
- **Sévérité :** 🔴 — risque d'écart de sécurité entre prod et dev.

### C2. Table `user_blocks` absente des migrations
- Créée nulle part dans `supabase/migrations/`, mais référencée par `messagingService.ts:847`, `ReportBlockModal.tsx:110`, `BouteilleALaMer.tsx:88` et par la preuve brute du MISSION_LOG Phase 4.
- **Action :** l'ajouter à la même migration que C1 (colonnes `blocker_id`, `blocked_id`, `created_at`, contrainte `UNIQUE(blocker_id,blocked_id)`, RLS par `auth.uid()`).
- **Sévérité :** 🔴 (fonctionnalité de blocage dépend d'une table non versionnée).

---

## 🟠 Majeurs — Divergences doc-vs-code

| # | Affirmation doc | Réalité vérifiée |
| :--- | :--- | :--- |
| **M1** | « Redirects vers /boutique » (CLAUDE.md) | ❌ `next.config.mjs:74-131` : `/shop`, `/catalogue/:path*`, `/boutique`, `/mon-kit`, `/inventaire` → **tous vers `/explorer`** ; `/configurateur` → `/ai-configurator` (sans le « e », contraire à la doc moodle « ai-configurateur »). La doc Obsidian « → /mon-materiel » est aussi fausse. **3 sources de vérité contradictoires.** |
| **M2** | « Modales /communauté en next/dynamic » (CLAUDE.md) | ❌ /communauté a **0 import dynamique**. En revanche /compte (5 tabs, ssr:false) et /groupes/[groupId] (4, alias `nextDynamic`) sont conformes. |
| **M3** | **3 fichiers de code mort non documentés** | `src/components/communaute/CarnetFormModal.tsx`, `ClubFormModal.tsx`, `ClubDetailModal.tsx` existent mais **importés par personne** (grep : 0 import). Le « code mort TopBar » documenté, lui, est en réalité déjà supprimé. |
| **M4** | « CI avec 4 quality gates » (.github/ci.yml) | ❌ **Fichier inexistant.** CI réel : `.github/workflows/{nextjs,lighthouse-ci,ios,visual-regression}.yml` (deploy GitHub Pages + qualité). Pas de gate ESLint/type-check/build/validate-cache. `scripts/validate-country-cache.mjs` absent. |
| **M5** | Upload de pièces jointes messagerie | ❌ Incohérence path : policy storage INSERT exige 2 segments (`conversation_id/user_id/fichier`), mais `uploadAttachment` (`messagingService.ts:818`) uploade 1 segment (`conversationId/ts_rand.ext`) → **upload rejeté par RLS** (retombée silencieuse sur `URL.createObjectURL`). Bucket privé mais code lit via `getPublicUrl`. |

---

## ✅ Corrections immédiates appliquées (01/09/2026, après audit)

| Écart | Correction | Vérification |
| :--- | :--- | :--- |
| **m3** Fallback avatar cassé `/images/default-avatar.png` | Remplacé partout par `/assets/images/no_image.png` (convention CLAUDE.md) — **7 fichiers** : ConversationView, ConversationRow, MessageBubble, GroupSettingsModal, NewConversationModal, VoiceRecorderBar (via imports), messagingService (6 occurrences) | grep: **0 occurrence** restante |
| **m1** Classes d'animation mortes camelCase | Remplacées par les classes kebab **fonctionnelles** (`animate-fade-in`, `animate-scale-in`, `animate-slide-up`) dans **6 fichiers messagerie** ; `animate-in fade-in zoom-in` (plugin non installé) → `animate-fade-in` | grep messagerie: **0 occurrence** |
| **m7** Imports inutilisés | Retirés `Mountain` (GPXPreviewCard), `ChevronRight` (NewConversationModal) | respecte lint |
| **m6** Duplication keys tailwind.config | BoxShadow **fusionné** en un seul bloc (ajout `2xs` + `inner-xs`, conservation elevations), transitionTimingFunction **fusionné** (conservation `glass` + `emphasis`), plugin `tailwindcss-animate` **activé** | config valide, type-check ✅ |
| **m2** `shadow-2xs`/`inner-xs` manquantes | Désormais définies dans la config → les ombres fines deviennent effectives DS-wide | applied |

> **Note m1-bis** : il reste **21 occurrences** de classes animées mortes dans **17 fichiers hors messagerie** (features gear/hub/preparation/participants/hiking, déjà commités) — à traiter dans un chantier DS séparé.

---

## 🟡 Mineurs — Conformité style & améliorations

| # | Écart | Fichiers |
| :--- | :--- | :--- |
| **m1** | Classes d'animation **mortes** : `animate-fadeIn`, `animate-scaleIn`, `animate-slideUp` (camelCase) n'existent ni en Tailwind ni en CSS ; `animate-in fade-in zoom-in` du plugin `tailwindcss-animate` **non enregistré** dans `tailwind.config.js:182` (seul `@tailwindcss/typography`). → **Modales sans animation d'ouverture** | MessageComposer:92, MessageBubble:172, ConversationView:232, ConversationOptionsMenuModal:74,88, GroupSettingsModal:132, NewConversationModal:89 |
| **m2** | `shadow-2xs` / `shadow-inner-xs` **non définies** dans la config boxShadow → ombres fines absentes (sur ~152 fichiers, DS-wide) | MessageComposer, MessageBubble, ConversationRow, ConversationList, ConversationView, AudioPlayerBubble, GroupSettingsModal, NewConversationModal |
| **m3** | Fallback avatar cassé : `/images/default-avatar.png` → dossier inexistant (`public/images/` n'existe pas ; seule `public/assets/images/no_image.png`) → **404 sur avatars** | ConversationView:35, ConversationRow:24, MessageBubble:51, GroupSettingsModal:160,236, NewConversationModal:56,136 |
| **m4** | Bloc « Demande de message » **hors charte** (`emerald-600`, `stone-900`, `rose-950`, `amber-400`) | ConversationView:231-265 |
| **m5** | Boutons close de modales `36px` (<44px) ; `confirm()` natifs | GroupSettingsModal:96,112, modales (w-9 h-9) |
| **m6** | `Tailwind.config` clés dupliquées (boxShadow l.130-144 vs 155-164 ; easing l.145-151 vs 165-169) → easing `glass`/`emphasis` du 1er bloc **perdu** | tailwind.config.js |
| **m7** | Import inutilisés : `Mountain` (GPXPreviewCard:4), `ChevronRight` (NewConversationModal:7) ; typo token `#365233` vs sage-700 `#365237` (BottomTabBar:199), `#5C6B5E` hors tokens (BottomTabBar:875) | — |
| **m8** | Double hauteur potentielle page messagerie : `h-dvh` (page.tsx:29) + `paddingBottom: var(--bottom-nav-height)` d'AppShell → marge fantôme possible sous le composer | src/app/messagerie/page.tsx |

---

## ✅ Confirmations (les docs avaient raison)

- **TopBar.tsx supprimé** pour de bon (commit `9ac0eae`, 16 août, 366 lignes) — l'audit du 17/08 était déjà obsolète.
- **`usePullToRefresh` branché** sur `/communaute` via `MobileCommunityHub.tsx:11,44` + 3 autres hubs. Seul `useInfiniteScroll` (37 lignes) reste orphelin.
- **`useOwnedEquipment.ts` supprimé** physiquement (0 occurrence).
- Palette sans orange, dual-view (panier/carnets/communaute), imports dynamiques /compte + /groupes, `force-dynamic` sur 20 routes API (sauf `/api/hikes` en ISR 60s **volontaire**), 323 pages (explication : `generateStaticParams` pays ~195), ombres ink-based.
- Refonte messagerie Liquid Glass : classes `.glass-circle-btn/.glass-capsule-btn` bien définies (liquid-glass.css:511-859) et utilisées, viewport `calc(100dvh-var(--bottom-nav-height))`, smart scroll (<120px), groupement <2min, anti-zoom iOS `text-[16px]`, haptique 11/12 composants, `prefers-reduced-motion` respecté.

---

## 🎯 Recommandations priorisées

1. **[🔴] Migration de rattrapage BDD** — recréer `is_conversation_member`/`is_conv_owner`/`is_conv_admin` + `user_blocks` (sources : prod), rejouer pgTAP.
2. **[🟠] Corriger l'upload de pièces jointes** — aligner le path d'upload (1 segment) sur la policy (2 segments) **ou** assouplir la policy ; utiliser des URLs signées au lieu de `getPublicUrl`.
3. **[🟠] Réconcilier les redirects** — choisir une seule cible pour /boutique (/explorer est le comportement réel) et mettre à jour CLAUDE.md + Obsidian.
4. **[🟠] Nettoyer le code mort réel** — 3 modales communaute + supprimer le middleware `/catalogue` shadowé + corriger le CI documenté.
5. **[🟡] Corriger le DS** — activer `tailwindcss-animate`, ajouter `shadow-2xs`/`inner-xs`, lever la duplication de config, remplacer `animate-fadeIn`→`animate-fade-in`, fixer avatars `no_image.png`, harmoniser le bloc « demande de message ».

---

> [!tip] **Sources**
> Agent A (messagerie 15 fichiers), Agent B (architecture & code mort), Agent C (sécurité RLS), vérifications centrales type-check + build + greps.