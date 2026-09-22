# QA visuelle P2 — routes Communauté (« après »)

- Baseline « avant » : `phase-communaute/avant/` (12 captures : `/communaute` · `/clubs` · `/avis` × 393×852 · 430×932 · 412×915 · 1440×900, consent mocké, bandeau absent).
- Captures « après » (ce dossier) : `apres/` (même matrice, JPEG q72, DPR 1) + `manifest-p2-avant.json` + `manifest-p2-apres.json`.
- Serveur : `next dev -p 4028` relancé à neuf (cache `.next` corrompu régénéré : `ENOENT vendor-chunks/zod.js`), `NATIVE_TABBAR_ENABLED=false` — identique P0/P1.
- Protocole cookies (exigé) : `scripts/design/baseline/communaute-p2-shots.spec.ts` (miroir P1) — consentement mocké (`lkdv_cookie_consent` v1) AVANT navigation + repli dismiss (clic « Refuser ») ; garde assertée : `cookieBannerVisible=false` sur les 12 captures (cf. manifests). Contexte navigateur neuf par capture. Erreurs console : 0 sur 8 captures, `401 Supabase` (fetch anonyme, data-layer hors scope) sur 4 — aucun `pageerror`, aucun 500 après régénération du serveur.

## Corrections (scope strict : communaute, clubs, avis, stories, cookie/CTA/toasts)

1. Fades iOS de fin de scroll (mask `linear-gradient` + `-webkit-` prefix, statique, GPU, + `pr-28px` de fin de course) : `Tabs` hub mobile (« Sorties »), rangée massifs, `CommunityStoriesBar` (story « M »), catégories `MobileClubsHub`, filtres desktop carnets/clubs (`communaute/page`), `Tabs` avis desktop+mobile. Plus aucun élément coupé net.
2. Navigation unique : `handleTabSelect` (hub + sidebar desktop + hero) en miroir du plateau — `carnets`→`/carnets`, `clubs`→`/clubs`, `groupes`→`/groupes`, `fil/evenements/entraide`→`?tab=` ; `MobileCommunityHub` contrôlé (état local + écoute `community-tab-change` supprimés, l'URL est la seule source) ; replis auto-liens `?tab=` remplacés par vraies routes (`/clubs`, `/hub`). Registre unique `CLUB_SECTIONS` (ids stables) exporté par `ClubVerticalTabs`, consommé par la page `[id]` (commutation contenu) et `MobileCommunityHub→MobileClubDetailView` (type + `aria-label` sections) ; écoute `club-detail-tab-change` conservée (seul fil plateau→mobile, pas de doublon).
3. Offsets bas uniques via `--nav-offset` : bandeau cookies (`calc(var(--nav-offset) + var(--space-2))`, desktop 20px inchangé — pas de bottom bar), toasts `clubs` + `clubs/[id]` (`nav-offset + space-4`, `max-w` anti-débordement) ; boutons du bandeau 38px→44px (`--lkv-touch-min`).
4. Contrastes sur image ≥4.5 : `ClubHero` (labels `/60`→`/85`, description `/80`→`/90`, valeur « En ligne » `forest-400`→`forest-100`, pastilles clair→texte sombre / sombre→blanc solide), cover mobile (`bg-black/55` + blanc, kicker `forest-300`→`white/90`), pastille cover desktop (`black/40`→`/55`), actions `CommunityPostCard` sur photo (icônes blanches sur verre clair→`text-primary` sombre), `StoriesViewer` (heure `white/70`→`/90`, pastille initiale `white/20`→`black/40` + blur), chevron `CommunityHubNav` (`white/70`→muted). Audit `visual-contrast.mjs` : 0 échec.
5. Avis, une seule couche : `WriteReviewModal` n'empile plus la taxonomie en `Chip`s — choix radio monoligne 44px (`transition-colors` uniquement), `initialType` hérité du filtre page (`tous`→`produit`) ; seuls les `Tabs` page naviguent. Pastilles `10px`→token 11px (`caption-2`).

## Interdits respectés

Aucune logique métier / Supabase / auth / RLS / API touchée (requêtes et `onJoin/onRefresh` inchangés) ; `NATIVE_TABBAR_ENABLED=false` inchangé (test `lot2-shell` vert) ; composants partagés design-system intacts (`Tabs/Chip/Modal/SearchField/Badge/Button`, `tokens.css`, `tokens.ts`, plateau/bottom bar) ; animations existantes GPU (`transform`/`opacity`, `transition-colors`) + `motion-reduce` conservés ; cibles ≥44px sur tout le scope modifié.

## Vérifications

- `type-check` : 0 erreur · `lint` : exit 0 (0 erreur, warnings pré-existants) · `test` : 2948 passés / 0 échoué (27 skipped, identique P0/P1) · `build` : exit 0 (275/275 pages) · `visual-contrast` : 0 échec.

## Concerns / suivi

- Bouton d'effacement `SearchField` = 36px et `Button sm` = 36px (<44) : composants UI partagés, hors scope (changement global) — à traiter au niveau design system (même ruling qu'en P1).
- Plateau mobile partagé (`NavigationPlateau`, infra) : tronque encore à droite (« Entraide ») et compte `9.5px` — non touché (infra partagée) ; le fade P2 couvre les rails du scope.
- Repli groupe sans id → `/hub` (les groupes vivent côté hub/aventures, `/groupes` redirigé par middleware) ; `/clubs/[id]` sans slug valide → état « Club introuvable » inchangé (pas de seed, données réelles).
- En-tête mobile `/avis` (titre quasi-blanc sur photo sans voile) : lisible sur le fond actuel mais sans garantie de ratio — signalé, non voilé (hors clause ClubHero/covers stricte).
- Fragilité dev : `npm run build` invalide le cache du `next dev` co-hébergé (`.next` partagé) — redémarrage à neuf requis avant captures (fait ici) ; préférer `PW_BASE_URL` vers un serveur dédié.
