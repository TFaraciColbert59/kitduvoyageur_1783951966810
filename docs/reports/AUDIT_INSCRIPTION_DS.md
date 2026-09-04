# AUDIT — Page `/inscription` (conformité Design System v2.0)

Date : 2026-09-04 · Cible : `src/app/inscription/page.tsx` (120 lignes, 2 vues : desktop
`hidden md:block` + mobile `block md:hidden` inline).
Référence : `docs/Design-tokens.md` v2.0 (§1 Interdictions, §10 Règles d'or).
Statut : **AUDIT SEUL — aucune correction** (chantier de conformité séparé, voir ADR-010).

## Synthèse

La page est structurellement correcte (patterns desktop/mobile, tokens `#17402C`, papiers
`#FBFAF6`, bordures `rgba(23,64,44,0.06)`) mais **hors design system sur 4 axes** : palette
emerald/red par défaut, hex interdit `#10b981`, CTA « maison » sans `.glass-capsule-btn`,
et **zéro usage de `.glass`** sur une page qui devrait être en verre DS.

## Inventaire des violations

| # | Ligne | Vue | Valeur | Règle violée (Design-tokens) |
|---|---|---|---|---|
| 1 | 46 | desktop | `bg-emerald-500/10` (cercle succès) | §1 « classes Tailwind par défaut (`emerald-*`…) interdites » — token sage requis |
| 2 | 47 | desktop | `text-emerald-500` (icône succès) | idem |
| 3 | 60 | desktop | `bg-red-50 border-red-200 text-red-700` + `text-red-500` (bloc erreur) | §1 red-* interdit — utiliser token **danger** `#A8443A` / texte `#8A241B` |
| 4 | 84 | mobile | `color: '#10b981'` (✓ succès) | Hex hors palette (emerald) — token sage requis |
| 5 | 94 | mobile | `#FEE2E2` / `#FECACA` / `#DC2626` (bloc erreur) | Triplet rouge système hors palette — token danger |
| 6 | 51, 66 | desktop | CTA `bg-primary …` (Link « Se connecter », bouton submit) | §10 règle d'or n°3 « jamais réinventer un bouton » — `.glass-capsule-btn` |
| 7 | 100 | mobile | Bouton submit inline `style={{ background:'#17402C' }}` + 87 (Link) | idem — composant/`glass-capsule-btn` requis |
| 8 | 45, 54, 83, 95 | les 2 | Cartes `bg-card … border-border` / papier solide — **0 usage `.glass`** | Surface verre DS attendue (`.glass`/`GlassCard`) ; page « compte » voisines utilisent le verre |

## Commandes de conformité exécutées (résultats réels)

```bash
cd src/app/inscription
# hex interdits Design-tokens §1
rg -n "#E4501C|#1C2620|#2D5A3D|#0d1a12|#0d1a14|#9B2C2C|#8C6A1A|#2D6B4A|#7FA97A|#A3C4A3|#1B4332|#0F2D1F|#0B1F17|#E53E3E|#C53030|#82C39B|#10b981"
# → page.tsx:84  #10b981

# classes Tailwind par défaut
rg -n "emerald-|amber-|rose-|red-|gray-"
# → lignes 46, 47, 60 (emerald-500, red-50/red-200/red-700/red-500)

# CTA maison
rg -n "bg-primary|glass-capsule-btn"
# → lignes 51, 66 (bg-primary, aucun .glass-capsule-btn)

# usage .glass
rg -c "glass"
# → 0

# base ink obsolète rgba(11,31,23)
rg -n "rgba\(11, ?31, ?23"
# → 0 (ok — la page utilise bien rgba(23,64,44,…))
```

## Conforme (bonus)

- Labels, titres, liens : `#17402C` ✓ (tokens label/sage-700).
- Fonds papier `#FBFAF6` ✓ et bordures `rgba(23,64,44,0.06)` ✓ (base ink actuelle).
- Aucun `rgba(11,31,23,…)` ✓ ni `#E4501C` ✓.
- Pattern dual-view desktop/mobile conforme, mobile en inline styles.
- Spinner loading : classes `border-white/30 border-t-white` — bordure blanche, acceptable
  (à re-vérifier au chantier de conformité).

## Décision

**Ne pas corriger ici** — chantier de conformité DS séparé (ADR-010, « Ouvert » n°3).
Ce rapport est la base de travail ; les valeurs de remplacement suggérées (tokens sage /
danger, `.glass`, `.glass-capsule-btn`) restent à valider sur maquette avec la règle d'or
« reproduire le rendu de `/materiel` ».