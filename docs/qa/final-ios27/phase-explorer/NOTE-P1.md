# QA visuelle P1 — collisions Explorer/carte (« après »)

- Baseline « avant » : `docs/design-system/phase3-visual-p0/p0-matrix/` (explorer-*.jpg, consent non dismissé, bandeau cookies visible).
- Captures « après » (ce dossier) : `explorer-393x852.jpg` · `explorer-430x932.jpg` · `explorer-412x915.jpg` · `explorer-1440x900.jpg` (JPEG q72, DPR 1) + `manifest-p1.json`.
- Serveur : `next dev -p 4028` relancé à neuf (process P0 tué), `NATIVE_TABBAR_ENABLED=false` — identique P0.
- Protocole cookies (exigé) : `scripts/design/baseline/explorer-p1-shots.spec.ts` — consentement mocké (`lkdv_cookie_consent` v1, même clé que `prepareVisualPage`) AVANT navigation + repli dismiss (clic « Refuser ») ; garde assertée : `cookieBannerVisible=false` sur les 4 viewports (cf. manifest). Contexte navigateur neuf par viewport.

## Corrections (scope strict : ExplorerClient, UnifiedExplorerMap, tuiles, rails, CTA, toasts)

1. Recherche unique : la recherche du rail filtres est désormais mobile-only (`md:hidden` dans `ExplorerFilterPanel`) — sur desktop seule la colonne liste fixe porte la recherche ; jamais deux barres `fixed` superposées.
2. Rail/CTA uniques + dépilage : rail filtres = colonne haut-droite sur mobile, rail vertical centré sur desktop ; CTA « Rechercher ici » masqué quand les filtres sont ouverts ; CTA « Sortie entre amis » masqué quand le badge live le remplace (même ancre) et remonté à nav+100 pour ne plus chevaucher le CTA carte centré (nav+36) — vérifié visuellement 393/430/412.
3. Toasts : formule UNIQUE via `--nav-offset` (globeNotice `nav+164`, badge live `nav+100`) — les formules `bottom-[152px]` ad hoc et `md:bottom-24` / `md:bottom-40` sont supprimées. Aucun `bottom-6`/`bottom-10` dans le scope.
4. Compteur : attribution carte `text-[9px]` → token `text-[length:var(--lkv-text-caption-2)]` (11px).
5. Carte : ordre documenté des 5 couches (L0 canvas base → L1 voile z-sticky → L2 attribution z-sticky → L3 contrôles/tuiles/légende/pays z-fab → L4 toast z-toast) ; légende densité en formule unique `nav+156` (au-dessus live nav+100 et tuiles nav+36). Zéro `bg-dark-bg` dans le scope (rg vérifié ; fonds déjà tokenisés `glass-bg-medium`). Moteur MapLibre/Leaflet (hex internes `engine/`) : non touché, documenté seulement.
6. Panneaux desktop : gardes `overflow-hidden` + `overscroll-contain` (liste, rail filtres) ; `max-w-[calc(100vw-32px)]` sur carte sélection et badge live.
7. RULING : libellé « MATÉRIEL » de la topbar DESKTOP 1440 conservé (pattern desktop légitime, hors scope mobile) — visible sur `explorer-1440x900.jpg`, commentaire `P1 RULING` dans le code.

## Interdits respectés

Aucune logique métier / Supabase / auth / RLS / API touchée (rendu conditionnel d'affichage uniquement) ; animations existantes GPU (`transform`/`opacity`, framer-motion) ; `prefers-reduced-motion` déjà géré côté caméra ; CTA ≥44px (`min-h-[48px]`, IconButton lg=48, SearchField h44).

## Vérifications

- `type-check` : 0 erreur · `lint` : exit 0 (610 warnings pré-existants, 0 erreur) · `test` : 2948 passés / 0 échoué (27 skipped, identique P0) · `build` : exit 0.

## Concerns / suivi

- Bouton d'effacement `SearchField` = 36px (<44) : composant UI partagé, hors scope P1 (changement global) — à traiter au niveau design system.
- Vue desktop/globe sans sentiers dans le viewport → état vide « Aucun itinéraire trouvé » : comportement données réel, inchangé (idem P0).
- Toast globeNotice desktop remonté à nav+164 (contre md:bottom-24 historique) : assumé, au-dessus des contrôles.
- `safeControls=false` (aucun consommateur actuel, `UnifiedExplorerMap` n'est monté que par `ExplorerClient` en `safeControls`) : branches de repli conservées pour compatibilité API.
