# Phase 3 Visuelle — P0 : baseline de référence fraîche

- Commit build : `023fd88b` (main, en avance de 54 commits sur origin/main au moment de la capture)
- Date (UTC) : 2026-09-22 ~23:55
- Serveur : `next dev -p 4028` relancé (process existant sur :4028 tué), `NATIVE_TABBAR_ENABLED=false`
- Vérifications préalables : `npm run type-check` → 0 erreur ; `npm run lint` → 0 erreur (warnings uniquement) ; `npm run build` → exit 0
- Tests : vitest `2948 passés / 0 échoués` (27 skipped) ; `npm run verify:invariants` → SUCCÈS

## Viewports exigés (matrice exacte `p0-matrix/`, JPEG q72, DPR 1)

`393×852` · `430×932` · `412×915` · `1440×900` — routes `/` (hub-*.jpg) et `/explorer` (explorer-*.jpg, path réel `src/app/explorer/` confirmé).
`manifest-p0.json` : URL finale + titre par capture. Aucun redirect auth : `/` et `/explorer` rendent directement (HTTP 200).

## Matrice complémentaire (config `playwright.baseline.config.ts`, `SHOTS_OUT_DIR`)

`iphone-16-pro` (393×852) · `iphone-se` (375×667) · `android-pixel` (412×915) · `desktop-1440` (1440×900) —
12 routes (`/`, `/materiel`, `/kits`, `/carte-interactive`, `/communaute`, `/carnets`, `/voyages`, `/boutique`, `/compte`, `/hub`, `/panier`, `/connexion`) + fullPage `/` et `/materiel`, `manifest.json` par gabarit (URL finale, titre, erreurs console). 4/4 projets Playwright passés.

## Constats bruts (vs attendu iOS 27)

1. Bottom bar mobile = pillule flottante 5 icônes SANS labels (home, groupe, boussole, message, profil/N) : plus de bottom bar à labels. Conforme.
2. Aucun hamburger visible sur mobile ; aucun onglet « Matériel » dans la nav mobile. Conforme.
3. Explorer mobile : carte edge-to-edge dès le haut, header mobile supprimé (ni logo, ni progression, ni compte) ; seul le sélecteur de couches Relief/Plan/Satellite subsiste en haut + bouton flottant latéral. Conforme.
4. Communauté mobile : header compact « LE KIT DU VOYAGEUR / Communauté » + chips (Pour vous, Carnets, Clubs) + stories + feed ; pas de topbar pleine largeur. Conforme.
5. Hub desktop 1440 : topbar pillule verre avec EXPLORER / MATÉRIEL / COMMUNAUTÉ / MON COMPTE (le libellé « MATÉRIEL » subsiste sur desktop uniquement — à statuer en P1 s'il doit disparaître aussi).
6. Bandeau cookies visible par défaut sur TOUTES les captures, recouvrant le bas du viewport (masque partiellement la bottom pill sur mobile). Baseline capturée consent non dismissé : prévoir dismiss/mock du consent pour les comparaisons P1+ afin d'éviter les faux positifs.
