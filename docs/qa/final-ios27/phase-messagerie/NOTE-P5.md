# QA visuelle P5 — messagerie (« après »)

- Captures « avant » : `phase-messagerie/avant/` (1 route × 2 viewports = 2 fichiers,
  `messagerie` × `393x852` + `1440x900`, JPEG q72, DPR 1) + `manifest-p5-avant.json`.
- Captures « après » : `phase-messagerie/apres/` (même matrice) +
  `manifest-p5-apres.json`.
- Serveur : `next dev -p 4028` relancé à neuf (l'ancien processus servait un
  cache `.next` périmé : chunks 404 en `text/plain` → 16 erreurs console sur la
  première passe ; même fragilité qu'en P2/P4 après `build`), puis recompilation
  HMR des correctifs P5 avant la passe « après ».
  `NATIVE_TABBAR_ENABLED=false` — identique P0/P1/P2/P3/P4.
- Protocole cookies (exigé) : `scripts/design/baseline/messagerie-p5-shots.spec.ts`
  (miroir P1/P3/P4) — consentement mocké (`lkdv_cookie_consent` v1) AVANT navigation
  + repli dismiss (clic « Refuser ») ; garde assertée :
  `cookieBannerVisible=false` sur les 4 captures (cf. manifests).
  Contexte navigateur neuf par capture. Projet Playwright : `--project=desktop-1440`
  de `playwright.baseline.config.ts` (viewports posés manuellement dans le spec,
  mobile = `isMobile/hasTouch`, `reducedMotion: reduce`).
  Erreurs console : 0 avant, 0 après.
- Scope strict : routes messagerie uniquement (`/messagerie`, composants
  `features/messaging`). Interdits respectés : temps réel/statuts/pièces jointes
  (P6), logique métier, Supabase/auth/RLS/API, `admin/**`, `dev/**` non touchés.

## Conventions appliquées (mécaniques, sans redesign)

- Textes 9px → `text-[length:var(--lkv-text-caption-2)]` (11px, comme P1/P2/P4).
- Verre neutre et tokens `--lkv-*` inchangés par ailleurs (déjà conformes).
- GPU-only : `translate3d` conservé sur la carte swipe, transition
  `var(--motion-control-duration) var(--ease-glass)` ; aucune animation ajoutée
  (`prefers-reduced-motion` géré par `reducedMotion: reduce` au rendu).
- Touch ≥44px sur tout ce qui est touché : boutons swipe `min-h/min-w-44px`,
  carte `min-h-[76px]`, champ composer `min-h-[44px]` (existant, vérifié).

## Corrections (scope strict, aucune logique métier)

1. `ConversationRow` (`features/messaging/components/ConversationRow.tsx`) :
   - 4× `text-[9px]` (libellés swipe Accepter/Refuser/Archiver-Restaurer/Muet-Son)
     → token `caption-2` (11px).
   - `role="link"` imbriqué dans `<button>` (avatar + titre, double tab-stop,
     HTML invalide) → supprimé : avatar et titre rendus non interactifs
     (`aria-hidden` / `span` simple). La carte entière reste l'unique contrôle
     (bouton « ouvrir la conversation », `aria-label` enrichi conservé) ; la fiche
     profil reste accessible depuis l'en-tête de `ConversationView` (déjà en place,
     `router.push(/profil/…)` là-bas, non touché). Import `useRouter` devenu
     inutile retiré.
   - Non-lus masqués (gras + ombre seule, commentaire « pas de compteur ») →
     pastille compteur visible (`--lkv-danger` / `--lkv-text-inverted`, token
     `caption-2`, `99+` au-delà de 99, `aria-hidden`, l'annonce reste portée par
     l'`aria-label` du bouton).
   - Boutons swipe (labels déjà présents, vérifiés) : `min-h/min-w-[44px]` +
     `focus-visible:ring` (`--lkv-focus-ring`, inset) ; carte : `focus-visible:ring`
     + offset.
2. `MessageComposer` (`features/messaging/components/MessageComposer.tsx`) :
   - Labels vérifiés au rendu : `textarea` (`Votre message`), boutons photo / vocal /
     menu / envoi / annuler-réponse tous `aria-label` + `title` — présents, inchangés.
   - Ajout manquant : `input[type=file]` caché (déclenché par le bouton photo) labellisé
     (`aria-label="Joindre une photo à la conversation"`, `tabIndex={-1}`).
3. Tabs messagerie vérifiés au rendu (ajout inutile, déjà conformes) : `Tabs`
   desktop (`role=tablist/tab`, `aria-label="Filtrer les conversations"`,
   badge demandes en token `caption-2`) + tray mobile via `NavigationPlateau`
   (`isMessageriePage`, partagé — non touché, cf. recensement).
4. Offsets `nav-offset` : page `/messagerie` via `MobilePageShell`
   (`hasBottomNav`, safe-areas internes au calque conversation) — vérifié sur
   captures 393×852 (aucun recouvrement bottom-bar), non touché.

## Recensement <44px — décision design-system séparée (signalés seulement, non touchés)

- `NavigationPlateau` partagé : pastille demandes `9.5px` + `fontSize: 12px`
  (ruling P2/P4 reconduit).
- `IconButton size="sm"` (annuler-réponse composer) et `SearchField` effacement 36px
  (rulings P1/P2/P3 reconduits) — composants partagés, hors scope P5.
- `ConversationList` badge demandes desktop déjà en token `caption-2` (11px) — conforme.

## Vérifications

- `type-check` : 0 erreur · `lint` : exit 0 (0 erreur, 606 warnings pré-existants,
  identique P4) · `test` : 2948 passés / 0 échoué (27 skipped, identique P0–P4) ·
  `build` : exit 0 · `verify:invariants` : SUCCÈS (6/6 + icon-names) ·
  captures : 4/4, `cookieBannerVisible=false`, `consoleErrorCount=0`.

## Concerns / suivi

- Captures `/messagerie` non authentifié : mur « Connexion requise » (attendu,
  auth interdite en P5) — les correctifs `ConversationRow`/composer portent sur
  l'état authentifié, vérifié par `type-check`/`lint`/`test` uniquement.
  Revalidation visuelle authentifiée possible en P6 (fonctionnel).
- `ConversationRow` conserve `rounded-2xl` (non tokenisé : `radius-lg` = 24px
  changerait le visuel ; hors liste P5, scope strict).
- Fragilité dev reconduite (P2/P4) : cache `.next` périmé du serveur co-hébergé →
  relance à neuf requise avant captures (fait ici, PID 18460).
