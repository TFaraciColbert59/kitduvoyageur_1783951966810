# QA visuelle P3 — formulaires (« après »)

- Captures « après » (ce dossier) : 6 routes × 2 viewports = 12 fichiers
  (`contact`, `ai-configurator`, `outils-poids-sac`, `compte-modifier`, `blog`,
  `carbone` × `393x852` + `1440x900`, JPEG q72, DPR 1) + `manifest-p3.json`.
- Référence qualité : page `contact` (labels visibles, erreurs annoncées, 44px).
  Tous les formulaires touchés réutilisent ses classes `FIELD_CLASS` /
  `LABEL_CLASS` (tokens `--lkv-*`, `min-h-[var(--lkv-touch-min)]`).
- Serveur : `next dev -p 4028` relancé à neuf, `NATIVE_TABBAR_ENABLED=false`.
- Protocole cookies (exigé) : `scripts/design/baseline/formulaires-p3-shots.spec.ts`
  — consentement mocké (`lkdv_cookie_consent` v1, même clé que
  `prepareVisualPage` et le spec P1) AVANT navigation + repli dismiss
  (clic « Refuser ») ; garde assertée : `cookieBannerVisible=false` sur les
  12 captures + `consoleErrorCount=0` (cf. manifest).
- Contexte navigateur neuf par capture. Projet Playwright : `desktop-chromium`
  (viewports posés manuellement, mobile = `isMobile/hasTouch`,
  `reducedMotion: reduce`).

## Corrections (scope strict P3, aucune logique métier)

1. `KitConfiguratorWizard` : 20+ textes <11px → token
   `text-[length:var(--lkv-text-caption-2)]` ; `fieldset`+`legend` + `aria-label` /
   `aria-current="step"` sur le stepper (labels manquants) ; CTA `!min-h`/`!py`/
   `!px` fragiles → `min-h-[var(--lkv-touch-min)]` sans `!` (7 CTA) ;
   surfaces `bg/border-white/*` → tokens (`--lkv-surface-paper`,
   `--glass-border`, `--glass-bg-medium`) ; `transition-all`/`animate-pulse` →
   `motion-safe:` + `motion-reduce:transition-none`.
2. `outils/[slug]` : `ToolPoidssSac` converti en `<form>` avec 3 labels visibles
   (`Catégorie`, `Nom de l'article *`, `Poids (g) *`), erreur `role=alert` /
   `aria-live="assertive"` ; grille `sm:grid-cols-4` écrasée →
   `sm:grid-cols-2 lg:grid-cols-4` ; tous les inputs/tabs/radios du fichier en
   `min-h-[var(--lkv-touch-min)]` + `htmlFor`/`id` + `aria-checked`/`aria-selected`
   (`Budget` labels visibles, `Convertisseur` tablist, `Checklist` form+erreur,
   `Tailles`/`Rations`/`Planificateur` radiogroups, `Fuseaux` 1→2 col) ;
   boutons `!w-11` → `h-11 w-11 min-h-[var(--lkv-touch-min)]` tokens.
3. `EditProfileView` (`/compte/modifier`) : 12 champs regroupés en `fieldset` +
   sous-titres `h3` (État civil, Profil public, Biographie, Localisation, Fuseau
   + langues, Massifs, Disciplines, Niveau, Mesures) ; validation
   (prénom/nom/username/ville) avec résumé `role=alert` + erreurs par champ
   `aria-live="assertive"` + `aria-invalid`/`aria-describedby` ; `htmlFor`/`id`
   `profil-*` sur les 12 champs ; cover `src=""` → rendu conditionnel.
4. `Blog` : `NewsletterForm` + `CategoryFilterBar` + `BlogSearchInput` extraits et
   mutualisés desk/mobile (une seule source) ; newsletter avec `label` visible
   (avant : `aria-label` seul) + validation `role=alert`/`status` ; textes
   10px/9px → token ; surfaces `rgba(255,255,255,…)`/`border-white` → tokens ;
   `!px/!py` → tokens + 44px.
5. `carbone` : charte unique desk/mobile — `ParamsBasics`/`ParamsDetails`
   partagés (mêmes champs, mêmes `FIELD/LABEL_CLASS`, mêmes tokens), hero
   `bg-dark-bg`/`text-white` → `--lkv-primary`/`--lkv-text-inverted`, inputs
   `bg-background` → tokens contact, résultats `aria-live="polite"`.
6. Console 0 : attribut parasite `font-extrabold` (3× `outils`), `sticky={true}`
   fuitant vers le DOM via `PageHeader` (retiré au call-site
   `/compte/modifier`, composant partagé intact), `src=""` cover (conditionnel).

## FormPageLayout — évaluation (0 usage conservé, justifié)

`FormPageLayout` (niche `PageLayout`/`AppShell`) est incompatible sans redesign
avec les 5 cibles : wizard multi-étapes sans `<form>` submit, fragments
calculateurs `outils`/`carbone` (temps réel, pas de submit), `EditProfileView`
(layout custom + double montage desk/mobile), newsletter `blog` (fragment).
Adopté à la place : ses conventions (labels visibles, 44px, erreurs annoncées,
`PageActions`-like sticky bars conservées) + classes `contact` à l'identique.

## Interdits respectés

Aucune logique métier/calcul, Supabase/auth/RLS/API, `admin/**`, `dev/**` ;
`SearchField`/`Button sm` 36px non touchés (signalés ci-dessous) ;
`NATIVE_TABBAR_ENABLED=false` ; animations GPU (`transform`/couleurs,
`motion-safe`/`motion-reduce`) ; tout ce qui est touché ≥44px.

## Vérifications

- `type-check` : 0 erreur · `lint` : exit 0 (warnings pré-existants, 0 erreur) ·
  `test` : 2948 passés / 0 échoué (27 skipped) · `build` : exit 0 ·
  captures : 12/12, `cookieBannerVisible=false`, `consoleErrorCount=0`.

## Concerns / suivi

- `SearchField` (effacer 36px) + `Button sm` 36px : composants partagés, hors
  scope — à traiter au niveau design system.
- `PageHeader` fuit `sticky`/`transparent`/`scrollAware` vers le DOM via
  `...props` (contourné au call-site, non corrigé dans le partagé — volontaire).
- Production `next start` : 500 global constaté en local (serveur dev OK,
  captures dev) — à investiguer hors P3 (probable env runtime locale).
- Blog desk/mobile : cartes `Featured/Post` vs `MobileFeatured/MobilePost`
  conservées distinctes (UX liste vs grille), seule la tuyauterie
  (recherche/filtres/newsletter/empty-state) est dédupliquée — assumé.
