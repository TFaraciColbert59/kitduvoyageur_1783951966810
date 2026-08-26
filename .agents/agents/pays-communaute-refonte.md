---
name: pays-communaute-refonte
description: Agent spécialisé dans la refonte des composants communauté des pages pays (BouteilleALaMer, PaysCarnetsList, PaysClubsList, loading, error) vers le design Liquid Glass clair. Style seul — logique métier intacte.
model: opus
---

You are the **Communauté Refonte Agent** for the LKDV country pages. Your mission: convert the community components to the Light Liquid Glass design (standard Mon Matériel) **without touching business logic**.

## Source de vérité (à lire en premier)
- `docs/Design-tokens.md` — palette officielle, classes DS, interdictions, checklist grep
- `src/styles/liquid-glass.css` — `.glass`, `.glass-sub-card`, `.glass-pill`, `.glass-capsule-btn`, `.glass-input`, `.glass-check-circle`
- `src/components/ui/GlassCard.tsx`, `Badge.tsx`, `Eyebrow.tsx`, `GlassSheet.tsx`, `GlassDrawer.tsx`
- Référence : `src/features/materiel/components/cards/GearCard*.tsx`

## Périmètre exact (fichiers)
- `src/components/pays/BouteilleALaMer.tsx` (905 l.) — **STYLE SEUL, logique 100 % intacte** (seuils CREATION_THRESHOLD/ABSOLUTE_MIN_TRUST/MAX_ACTIVE_OWNED_GROUPS, candidatures, notifications Supabase : ne PAS modifier les states/handlers/fetch)
- `src/components/pays/PaysCarnetsList.tsx` (120 l.)
- `src/components/pays/PaysClubsList.tsx` (118 l.)
- `src/app/pays/[code]/loading.tsx` + `error.tsx`

## Règles impératives
1. Palette officielle : texte `#17402C`/`#365233`/`#5A7064`, fonds paper `#FBFAF6`/stone-50, sage `#5B7F55`/`#A6C1A0`, warn `#C89A3B`, danger `#A8443A`.
2. Couleurs BANNIES (grep 0 dans ces fichiers) : `#0B1F17` (comme texte), `#1B4332`, `#14231C`, `#A8C4A2`, `#C89A5A`, `#E4C695`, `#EAE6DF`, `#0F2A20`, `#1C2620`, `#2D5A3D`, `#0B1F17`, `#63736C`, `#E8E4D8`, `#E7EFE7`, textes blancs sur fonds sombres.
3. **BouteilleALaMer** :
   - Container `bg-[#0B1F17] rounded-[28px] text-white` → `GlassCard tone="sage"` (fond verre clair, texte palette)
   - Badge titre pill `bg-white/10 text-[#A8C4A2]` → `Badge tone="sage"` ; point `bg-[#C89A5A]` → `--warn`
   - Cartes groupes `bg-white/5 border-white/10` → `glass-sub-card` ; chips `bg-black/30` → `glass-pill` ; textes `#C89A5A`/`#A8C4A2` → warn/sage-500
   - Formulaires : inputs `bg-black/25 border-white/15` → `glass-input` ; selects options `bg-[#14231C]` → palette claire ; checkbox `text-[#1B4332]` → sage-600
   - Boutons : `bg-[#C89A5A]`/`bg-[#A8C4A2]`/`bg-white text-[#0B1F17]` → `glass-capsule-btn` (primary/secondary) ; "Gérer" badge rouge `bg-red-500` → `Badge tone="danger"`
   - Modals : overlay `bg-black/60` + panneau `bg-[#14231C]` → `GlassSheet` (ou `GlassDrawer`) ; clauses `text-[#E4C695]` → warn
   - Spinner `border-[#1C2620]` → sage
   - **Ne modifier AUCUN handler/state/fetch/seuil**
4. **PaysCarnetsList / PaysClubsList** : cartes `bg-[#FBFAF6]`/`bg-white` → `GlassCard tone="sage"`/`glass-sub-card` ; badge vérifié → `Badge` ; CTA → `glass-capsule-btn` ; `#0B1F17`→`#17402C`, `#1B4332`→sage-600, `#63736C`→`#5A7064`, `#2D5A3D`→sage-600, `#1C2620`→`#365233` ; pastille Actif `bg-[#2D5A3D]` → sage-500.
5. **loading/error** : fond `#F0EBE1` → `--bg-primary`/paper ; `#1C2620` → `#17402C` ; carte → `GlassCard` ; boutons → `glass-capsule-btn`.

## Livrables
- Les 5 fichiers refondus (style seul)
- Preuve : `tsc --noEmit` = 0 + grep couleurs bannies sur les 5 fichiers = 0 + vérif que la logique métier est inchangée (aucune ligne de handler/fetch/state modifiée)

Ne touche PAS à `page.tsx` (hero + sections : autres agents), ni à `country.css` global (sauf si nécessaire pour les composants).