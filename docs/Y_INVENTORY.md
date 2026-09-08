# Y_INVENTORY — Relevé de l'état réel (Y0.0)

Date : 07/09/2026 · Branche `chantier/x-design-unique` @ `1aa17837` (Y1.5)

## 1. Règles de gouvernance contraignantes (par doc source)

**AGENTS.md** — Workflow Superpowers obligatoire pour toute tâche majeure
(Brainstorming → Plan → Subagent/TDD → Vérification). Skills apple-ui-designer +
interaction-design obligatoires pour toute décision layout/mobile/microinteraction.

**DESIGN_SYSTEM.md** — Règle absolue : ne pas recréer ad hoc un composant existant,
aucune couleur/police arbitraire. `/materiel` = source de vérité visuelle (Liquid
Glass) ; `/compte` = source des patterns utilisateur. Primitives canoniques dans
`src/components/ui/` (LkvButton, GlassCard, LkvChip, IOSSegmentedControl,
ScrollableTabs, LkvInput…). Anti-zoom iOS : inputs mobiles à 16 px min.
⚠️ Tension notée : le hub voyage (branche X, gardes X-D70/Y-D80) utilise
`GlassCapsuleBtn` comme façade capsule — traité comme extension générique du
système, le garde-fou statique du périmètre voyage fait foi.

**CLAUDE.md** (30 971 o) — Architecture App Router, RLS obligatoire, tokens
`--lkv-*`, pattern dual-view desktop/mobile, haptique `{ haptic }`, images
fallback `no_image.png`, routes dynamiques `force-dynamic`, navigation client via
`useRouter` jamais `window.location`.

**HANDOFF_AGENT.md / docs/DESIGN_TRUTH.md** — consultés ; `docs/DESIGN_TRUTH.md`
absent de la branche (présent côté X historique) → tokens de référence = Annexe A
de `unification.md`, revérifiés dans `src/styles/tokens.css` (Y_HUB_SPEC §6).

## 2. Skills (.agents/skills/, 66 entrées)

**28 attendues → 26 confirmées, 2 absentes :**
- ❌ `root-cause-tracing` — absente ; équivalent : `systematic-debugging`.
- ❌ `testing-anti-patterns` — absente ; équivalent : `testing-qa` (présente).
Consigné conformément à §0.3 ; le chantier poursuit avec les équivalents.

Supplémentaires présentes et utiles : `security-audit`, `supabase-postgis`,
`map-geospatial`, `testing-qa`, `using-git-worktrees`, `lkdv-seo-agent`, suite SEO.

## 3. Inventaire des périmètres (TS/TSX, mesures réelles)

| Répertoire | Fichiers | Octets |
|---|---|---|
| `src/features/trips/` | 93 | 408 459 |
| `src/app/voyages/` | 22 | 59 946 |
| `src/app/materiel/` | 20 | 34 950 |
| `src/app/groupes/` | 3 | 50 669 |
| `src/app/ai-configurator/` | 3 | 91 684 |

Gros fichiers connus (revérifiés) : `blueprints/blueprintRegistry.ts` 46 887 o,
`ConfiguratorWizard.tsx` 50 709 o (VIVANT, arbitrage 2), `BouteilleALaMer.tsx`
41 553 o (hors périmètre), `groupes/page.tsx` 39 935 o, `PaysPratiqueView.tsx` 40 910 o.

## 4. Références de départ — six portes (horodatées 07/09/2026 ~21:20-21:35 UTC+2)

| Porte | Commande | Résultat de départ |
|---|---|---|
| G1 | `npm run type-check` | exit 0, zéro erreur |
| G2 | `npm test` | **942/942** (134 fichiers) — avant Y1 ; **1008/1008** après Y1 |
| G3 | design suite + Y-D80 | x-suite 81/81 ; **Y-D80 : 11/12 rouges, 510 violations** (docs/Y_VIOLATIONS.md) |
| G4 | `npm run build` | exit 0 ; shared 104 kB ; `/voyages` 371 kB, `/voyages/[slug]` **529 kB**, `/export` 340 kB, `/itineraire` 348 kB, `/kit` 345 kB, `/nouveau` 350 kB |
| G5 | `npm run test:visual` | 🔄 conversion helper + rebase inspecté (agent) |
| G6 | `npm run test:a11y` | à l'état de départ : suite créée (Y0.5), première course au retour de l'agent visuel |
| — | `node scripts/verify/ci_invariants.mjs` | ✅ tous invariants verts |
