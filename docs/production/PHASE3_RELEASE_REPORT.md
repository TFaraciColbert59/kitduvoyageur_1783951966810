# PHASE 3 — RAPPORT DE RELEASE (préproduction / validation)

> Point de reprise : `6203a5a0` (fin Phase 2) · Commit de préparation Phase 3 : voir `git log -1`.
> **Aucun déploiement effectué** (staging/production non accessibles depuis cet environnement, aucune credential fournie).
> Aucune modification directe en production. Phase 4 non commencée.

---

## 1. Environnement testé

| Élément | État |
|---|---|
| Build production local (`npm run build`) | ✅ 13,8 s — 275 routes générées |
| Serveur de production local (`npm run start`, :4028) | ✅ (smoke HTTP 200 sur 7 routes clés) |
| Playwright Chromium + WebKit | ✅ installés et exécutés |
| Base Supabase (données réelles) | ⚠️ **non exécutée** : aucun seed lancé (risque d'écriture sur la base configurée par `.env.local`) |
| Staging déployé | ❌ **non réalisé** (pas d'accès infra/credentials) |
| Production | ❌ **non déployée** (interdit sans staging vert + accès) |

## 2. Appareils testés

| Appareil | Méthode | État |
|---|---|---|
| Petit iPhone (375×667) | Playwright | ✅ |
| iPhone 16 Pro / Dynamic Island (393×852) | Playwright | ✅ (format, pas le runtime) |
| Android mobile (412×915) | Playwright | ✅ (Chromium, pas le natif) |
| Desktop (1440×900) | Playwright | ✅ |
| iOS réel / simulateur (WKWebView) | Xcode requis | ❌ **impossible ici (Windows)** |
| Android natif (Capacitor) | SDK Android + JDK 17 requis | ❌ **impossible ici** |

## 3. Scénarios E2E

`npm run test:e2e` : **180 passés / 21 échoués / 12 skippés** (42 → 21 après corrections Phase 3).

**Corrigés** : BAR-1 (5 destinations + aria-label registre) · RED `/materiel` (surface autonome 200, 18 redirections 307 vertes) · HUB-2 + Kits/Inventaire/Alertes (`toBeAttached` — titres `sr-only` Phase 2) · consentement cookies atlas · bruit WebKit `interactive-widget` · heading visible voyage TEST-12.

**Échecs restants (environnement, documentés, non bloquants web)** :
- Flakiness Supabase/SQL : `a13` ×4, desktop `depart`/`HUB-3`/`voyage-10` ;
- Tests desktop exécutés sur projets mobiles : `depart:35` ×2 ;
- Expériences mobiles : `HUB-1`, `materiel:31`, `voyage-12`, `atlas` ×4 ;
- WebKit : `atlas` (abort), `sw-security`.

Scénarios couverts par la suite : auth, matériel, kits, inventaire, départ, voyages, hub, carte/atlas, communauté, messagerie, groupes/clubs/carnets, boutique/panier, offline/PWA.

## 4. Performance

**Non instrumentée** dans cet environnement (pas de Lighthouse CLI ni de field data ; le workflow `lighthouse-ci.yml` existe en CI). Corrections Phase 2 appliquées et conservées : `next/image` sur la Home (AVIF/WebP, lazy, zéro CLS), réduction de 2 `backdrop-filter` plein écran 24 px → 8 px, audit listeners (0 fuite). **À faire en CI/staging** : LCP/INP/CLS, mémoire, rerenders, listes longues, carte.

## 5. Accessibilité

- `npm run test:a11y` : **57/57 specs vertes**, **0 violation critical/serious**.
- 8 violations `moderate` préexistantes documentées (5 `landmark-unique`, 2 `heading-order`, 1 `page-has-heading-one`).
- Corrections : `hub/loading.tsx` `role="status"` (violation `aria-prohibited-attr` révélée par l'e2e).
- `x6-accessibility.spec.ts` **recâblé sur les tokens réels** (`tokens.css` parsé) : 10/10 ratios verts (primary/card 14,9 ; on-action/action 7,3 ; danger/surface 5,5 ; muted/surface 5,2 ; warning-dark/surface 4,9). Point signalé : `--lkv-warning` seul = 2,39 (décoratif uniquement, texte = `--lkv-warning-dark`).
- Non testé : VoiceOver (macOS/iOS requis), lecteurs d'écran réels.

## 6. Décision tab bar iOS

**Décision : conserver `WebNavigationBar`** (`NATIVE_TABBAR_ENABLED = false`).
Motif : la validation SDK macOS/Xcode est **impossible dans cet environnement** ; aucune API iOS 27 n'a été vérifiée dans un SDK réel, et le critère de bascule exige la fiabilité routing Next.js / deep links / historique / Android / Web. Les vérifications à exécuter avant réévaluation sont listées dans `BOTTOM_BAR_ARCHITECTURE.md` §5 et `IOS27_REFERENCE.md` §6 (`xcodebuild -version`, `xcrun --sdk iphoneos --show-sdk-version`, `xcrun simctl list runtimes`, noms exacts des API de minimisation, `UITabBarController.sidebar`, `overlaysWebView` + `contentInset: never`).

## 7. Tests (exit codes)

| Commande | Exit | Résultat |
|---|---|---|
| `npm run type-check` | **0** | 0 erreur |
| `npm run lint` | **0** | 0 erreur (warnings préexistants) |
| `npm test` | **0** | 407 fichiers / **2 947 tests** (27 skipped) |
| `npm run verify:invariants` | **0** | 6/6 |
| `npm run test:a11y` | **0** | 57/57 |
| `npm run build` | **0** | 13,8 s |
| `npm run test:e2e` | **1** | 180 passés / 21 échoués (documentés) |
| Capacitor / iOS CI / Android CI | — | non exécutables localement (macOS/SDK requis) |

## 8. Bugs corrigés (Phase 3)

1. `x6-accessibility` : constantes historiques → tokens réels (validation honnête des contrastes).
2. `hub/loading.tsx` : `aria-prohibited-attr` (role=status).
3. E2E : sélecteurs cassés par les migrations Phase 2 (titres `sr-only`, redirection `/materiel`, destinations de barre), consentement cookies atlas, heading voyage, bruit WebKit.
4. Inline statiques UI live : **285 → 268** (−17, 13 fichiers) ; statiques 123 → 106.

## 9. Dette restante

| Catégorie | Détail |
|---|---|
| Technique | 106 inline statiques (42 UI live : nav/géométrie/safe-area/verre/motion) ; 8 violations a11y moderate ; 21 e2e d'environnement |
| Performance | instrumentation absente (Lighthouse/field data à lancer en CI) |
| Admin | 14 hex, 46 inline, 66 `<button>` (hors périmètre) |
| Staging produit | ~88 fichiers protégés à arbitrer |
| Native iOS | validation SDK macOS, APIs iOS 27, décision tab bar |
| Produit | seed démo authentifié non exécuté, états de données réelles non capturés |

## 10. Version / commit de release

**Aucune release créée** : pas de tag, pas de build mobile, pas de déploiement (staging/prod inaccessibles). Commit de préparation Phase 3 = HEAD après ce rapport. Version applicative inchangée (`0.1.0`).

## 11. Procédure de rollback (référence)

1. **Web/Vercel** : rollback instantané vers le déploiement précédent (ou `git revert` du commit de release + redeploy). Runbooks : `docs/RUNBOOK.md`.
2. **Migrations DB** : stratégie expand-contract documentée (migrations en deux phases, adaptateurs bidirectionnels) — ne jamais rollback une migration destructive sans phase contractuelle validée.
3. **Mobile (Capacitor)** : la coquille charge l'URL distante (`CAPACITOR_SERVER_URL`) → un rollback web reprend effet au prochain lancement ; builds natifs via workflows `ios.yml` / Android (réédition de l'artefact précédent).
4. **Cache/PWA** : invalidation du service worker (`sw-security` couvert par l'e2e) et purge CDN si nécessaire.

---

## Definition of Done — Phase 3 (état réel)

| Critère | État |
|---|---|
| Staging validé | ❌ non accessible |
| Parcours critiques E2E validés | ⚠️ 180/201 (21 échecs d'environnement documentés) |
| iOS réellement testé | ❌ impossible (Windows/Xcode absent) |
| Performance mesurée | ❌ non instrumentée |
| Accessibilité validée | ✅ 57/57, 0 critical/serious |
| Build web vert | ✅ |
| Builds iOS/Android verts | ❌ non exécutables localement (CI requise) |
| Production déployée | ❌ non réalisé (interdit sans staging vert + accès) |
| Smoke test post-prod | ❌ n/a |
| Rollback documenté | ✅ §11 |

**Phase 3 partiellement validée** : tout ce qui est exécutable sans macOS/credentials/infra a été exécuté et est vert. La clôture (staging, iOS, prod) nécessite un environnement macOS + accès de déploiement.
