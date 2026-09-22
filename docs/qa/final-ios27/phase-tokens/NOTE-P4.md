# QA visuelle P4 — balayage global tokens (« après »)

- Captures « avant » : `phase-tokens/avant/` (4 routes × 2 viewports = 8 fichiers,
  `recompenses` · `evenements` · `feed` · `rapport-expedition` × `393x852` +
  `1440x900`, JPEG q72, DPR 1) + `manifest-p4-avant.json`.
- Captures « après » : `phase-tokens/apres/` (même matrice) +
  `manifest-p4-apres.json`.
- Serveur : `next dev -p 4028` relancé à neuf (cache `.next` corrompu régénéré :
  `ENOENT vendor-chunks/zod.js`, même fragilité qu'en P2 après `build`),
  `NATIVE_TABBAR_ENABLED=false` — identique P0/P1/P2/P3.
- Protocole cookies (exigé) : `scripts/design/baseline/phase-tokens-p4-shots.spec.ts`
  (miroir P1/P3) — consentement mocké (`lkdv_cookie_consent` v1) AVANT navigation
  + repli dismiss (clic « Refuser ») ; garde assertée :
  `cookieBannerVisible=false` sur les 16 captures (cf. manifests).
  Contexte navigateur neuf par capture. Projet Playwright : config
  `playwright.baseline.config.ts` (`desktop-1440`, viewports posés manuellement,
  mobile = `isMobile/hasTouch`, `reducedMotion: reduce`).
  Erreurs console : 0 avant, 0 après.

## Conventions appliquées (mécaniques, sans redesign)

- `rounded-lg` → `rounded-[var(--lkv-radius-sm)]` (14px),
  `rounded-xl` → `rounded-[var(--lkv-radius-md)]` (18px),
  `rounded-2xl` → `rounded-[var(--lkv-radius-lg)]` (24px = `--card-radius`) —
  même table que P3 (`FIELD_CLASS` en `radius-sm`).
- Textes 9/10/11px → `text-[length:var(--lkv-text-caption-2)]` (11px, comme P1/P2).
- `bg-background` (page) → fond retiré (toile applicative unique, comme P3 `carbone`
  et `feed`) ; `bg-background` (champ) → `bg-[color:var(--lkv-field-bg)]` ;
  `bg-dark-bg` (hero) → `bg-[color:var(--lkv-primary)]` (comme P3 `carbone`).
- Froides → sémantiques : rose → `--lkv-danger`, emerald/vert → `--lkv-success`,
  stone → `--lkv-border`/`--lkv-surface-muted`/`--lkv-field-bg`/`--stone-200`,
  sand → `--lkv-sand-500`, `bg-green/red-600` (toasts) → success/danger.
- `bg-white/80` : sur photo → `bg-[color:var(--glass-bg-medium)]` ;
  survol de carte/ligne → `hover:bg-[color:var(--lkv-hover-surface)]`.
- Toasts/bars `fixed bottom-6/bottom-10/bottom-4` →
  `bottom-[calc(var(--nav-offset)+var(--space-4))]` (même formule que P1/P2) ;
  formule ad hoc `safe-bottom+62px+8px` → `nav-offset+space-2` ;
  `--bottom-nav-height` → `--nav-offset` (token canonique unique).
- `alt=""` informatifs → alt réels (nom du membre/auteur, couverture).

## Corrections (scope strict, aucune logique métier)

1. Routes P4 : `feed` (hero + sticky bar tokenisés), `evenements` (radius,
   hero, barre, `bg-sage-700`→`--lkv-action`, `bg-white/20`→verre, 9px),
   `recompenses` (rose/emerald/stone/sand, radius, 9/10/11px),
   `rapport-expedition` (radius + sand ; voir ruling cyan ci-dessous).
2. Reliquats P0–P3 (autorisés : littéraux restants dans leurs fichiers) :
   `avis` (2 radius), `KitConfiguratorWizard` (radius ×3 familles),
   `outils/[slug]` (radius ×3, `bg-background` champs, erreur `red-500`→danger,
   anneau `emerald`→success, hero `bg-dark-bg`→primary, page sans fond),
   `EditProfileView` (offset ad hoc + radius), `StoriesViewer` (alt story).
3. Partagés : `ToastContext` (`green/red-600`→tokens, conteneur `bottom-4`→nav-offset,
   radius), `EmptyState` (rose→danger, radius), `Skeleton` (radius).
4. Offsets : `ParametresCompteCard`, `CommandesTab`, `ClubsTab`, `FideliteTab`,
   `carnets/page`, `compte/page`, `GearMobileExperience` → `nav-offset`.
5. Alt : `MobileClubDetailView`, `ClubTeamCard`, `ClubDiscussionCard`,
   `MobileCarnetDetailView`, `CarnetHubCard`, `MobileCarnetCard`,
   `CreateCarnetView`, `CreateClubView` + `StoriesViewer` (P2).
6. `bg-white/80` : `InfoChipsRow`, `SortieMoment`, `WeatherStrip`, `CountryFlag`,
   `AventuresTab`, `ClubsTab`, `PaysLeftSidebar`, `PaysPratiqueView`.

## PageHeader — évaluation (0 extension forcée, justifié)

`PageHeader` est déjà déployé sur 13 routes (boutique, materiel, kits, produit,
publier, compte/modifier, manifeste, hors-ligne, hub/[section], preparer-sentier).
Évaluées pour extension : `recompenses`, `evenements`, `feed`, `rapport-expedition`,
`faq`, `guides`, `lieux`, `fidelite`, `abonnements` — toutes portent un hero custom
(kicker + titre + actions contextuelles) : `PageHeader` ne s'y applique pas sans
redesign. Non forcé, conformément à la consigne. Seul `HeaderBackButton` ad hoc
hors `PageHeader` (`compte/modifier`) est déjà couplé à `PageHeader`.

## Rulings (verre, couleurs sombres, offsets)

- `glass` / `glass-sub-card` NE SONT PAS du legacy : ce sont les matériaux
  canoniques de `liquid-glass.css` (cartes et contenus). `.lkv-glass` est réservé
  aux contrôles flottants (retour/actions) sur verre neutre à base sombre.
  Aucune conversion `glass-*` → `.lkv-glass` appliquée (ce serait un contresens
  matière : carte claire → contrôle sombre). `glass-pill`/`pill-warn`/`pill-info`
  (`evenements`) conservés (système de pastilles existant, hors liste de purge).
- `rapport-expedition` : cockpit sombre immersif (chat IA). Cyan conservé comme
  accent lisible sur fond sombre (passer à `--lkv-info` #4B6B7C dégraderait le
  contraste, contraire à l'exigence P2 ≥4.5) ; `bg-dark-bg` conservé (substrat
  d'expérience, pas un hero marketing). Seuls radius + sand tokenisés.
  Même ruling que P1 (« MATÉRIEL » desktop conservé).
- `bottom-4` absolu intra-carte (`evenements` overlay cover) et `md:bottom-6`
  (desktop sans bottom bar : `EditProfileView`, `SosFloatingButton`,
  `InteractiveMap`/`ExplorerMap`) : intentionnels, non migrés.
- `text-foreground`/`border-border`/`divide-border` et `bg-white/5|10|60`,
  `bg-black/*` (cockpits sombres, modales) : aliases de thème / overlays neutres,
  hors liste de purge — non touchés.
- `weightCalculator.ts` (`amber/emerald/rose-100`) et `groupe.ts` (`amber-100`) :
  logique métier (statuts calculés) — non touchés (interdit).
- `hiking/*` (`DesktopDockBar`, `SafetyCenterModal`) : statuts temps réel
  (pause/enregistrement/batterie) + moteur de randonnée — non touchés.

## Recensement <44px — décision design-system séparée (non touchés)

- `SearchField` bouton d'effacement 36px (ruling P1/P2/P3 reconduit).
- `Button sm` 36px (ruling P2/P3 reconduit).
- Plateau mobile partagé (`NavigationPlateau`) : troncature + `9.5px` (P2 reconduit).
- Constat P4 supplémentaire : pastilles `text-[10.5px]` (`SortieMoment`) et
  compteurs `9.5px` plateau — même famille, même décision globale.

## Vérifications

- `type-check` : 0 erreur · `lint` : exit 0 (0 erreur, 606 warnings pré-existants)
  · `test` : 2948 passés / 0 échoué (27 skipped, identique P0–P3) ·
  `build` : exit 0 · `verify:invariants` : SUCCÈS (6/6 + icon-names) ·
  captures : 16/16, `cookieBannerVisible=false`, `consoleErrorCount=0`.

## Concerns / suivi

- Fragilité dev reconduite (P2) : `npm run build` invalide le cache du `next dev`
  co-hébergé (`.next` partagé, `ENOENT vendor-chunks/zod.js`) — redémarrage à neuf
  requis avant captures (fait ici).
- `feed-1440x900.jpg` après (+59 Ko vs avant) : hero `dark-bg` → `primary`
  (vert forêt vs noir) + suppression du voile `bg-background` — vérifier
  visuellement que le contraste du hero reste ≥4.5 (texte blanc sur primary).
- `recompenses` : `font-900` (classe invalide, sans effet) et `text-foreground`
  laissés — nettoyage à prévoir dans un passage typographie dédié.
- `evenements` : `text-foreground`/`muted-foreground`/`border-border` non migrés
  (aliases de thème, hors purge) — une passe d'alignement `lkv-text-*` reste
  possible mais hors P4.
