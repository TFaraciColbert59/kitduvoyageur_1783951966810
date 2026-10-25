# Refonte du cockpit Départ (/hub/depart) + robustesse explorer mobile/natif — Design

- **Date** : 2026-09-12
- **Statut** : proposé (en attente de revue)
- **Branche cible** : `chantier/depart-refonte`
- **Portée** : page `/hub/depart` desktop + mobile (volet 1) ; page `/explorer` sur app mobile/native (volet 2, traité en systematic-debugging)

## 1. Contexte & problème

La page `/hub/depart` est visuellement chaotique (capture propriétaire du 12/09 sur `/hub/depart?id=none&route=219`, colonnes déséquilibrées, cartes flottantes, alertes qui se chevauchent). Diagnostic établi par lecture de code complète :

1. **Chaîne `h-full` cassée** : `src/app/hub/[section]/page.tsx` enveloppe le contenu dans `div.space-y-2.5` (hauteur auto) → `HubDepartSection.tsx:41` (`md:h-full`) et tout le cockpit `DepartCockpit.tsx:459,599` retombent en hauteur automatique ; 5 zones de scroll concurrentes, colonnes étirées avec grands vides.
2. **Cockpit 3 colonnes dupliqué dans la colonne centre du hub** (`DepartCockpit.tsx:598-677`) : 5 colonnes cumulées ≥ 1024 px (260 + 280 + centre + 300/330 + 300), minimum 628 px de sidebars impossibles à caser sous ~1680 px → clippage (`overflow-hidden`), centre écrasé.
3. **z-index incohérents** : tab bar mobile `z-9999` > modales maison `z-50` > île flottante `z-40` > sticky `z-30` ; carte plein écran `fixed inset-0 z-50` rendue dans un contexte animé/`.glass` (clipping).
4. **Surfaces dupliquées** : alertes ×2 (`MobileVitalAlertBanner` + `DepartAlerts`), météo ×2 (bandeau inline + `DepartWeather`), poids ×2 (onglet all + `DepartEquipmentHub`).
5. **Code mort** : `DepartHeader.tsx` (525 l.), `MobileWeightHeader`, `SECTIONS_TABS/ScrollableTabs`, modale de prêt inatteignable, `searchQuery` mort, classes `danger` inexistantes.
6. **Vocabulaire DS violé** : `rose-*`, `sand-*`, `forest-*`, `bg-white/60|90`, `dark:`, micro-labels mono — interdits par `docs/Design-tokens.md`.
7. **Breakpoint isolé** : bascule mobile/desktop en `md` (768) alors que toutes les sections du hub basculent en `lg` (1024) ; entre 768 et 1023 le cockpit 3 colonnes s'affiche dans l'espace le plus contraint.
8. **Données** : `?route=X` depuis l'explorateur affiche le showcase « Tour du Mont-Blanc — 4j Bivouac » au lieu du sentier choisi (`getDepartDetail.ts:274`), alors que le tracé réel est bien résolu — ressenti « le bouton Préparer ne fait rien ».

Côté `/explorer` sur mobile (rapport dédié) :
- **P1** : le carrousel mobile (`z-[800]`, `ExplorerMobileHikeCarousel.tsx:89-92`) recouvre le CTA « Explorer ma zone / Vue globe » (`z-510`) et les boutons zoom (`z-500`) dès que des sentiers sont chargés — bug de stacking documenté (`MISSION_LOG.md:611`), jamais corrigé.
- **P2/P4 (natif)** : géolocalisation impossible dans l'app installée (`ios/App/App/Info.plist` sans clé de localisation, manifest Android sans permission, `navigator.geolocation` brut dans `ExplorerClient.tsx:139-166`) ; sans GPS le repli mène à Chamonix z6 où le palier continent **ne fetch aucun sentier** (`mapTheme.ts:46-51`) → écran vide.
- **P5/P6** : `capacitor.config.json` sans `server.url` (placeholder `public/index.html`) ; service worker non désactivé en natif.

## 2. Objectifs / Non-objectifs

**Objectifs**
- Refonte complète du cockpit départ desktop + mobile au langage visuel du hub, sans duplication de shell, sans surface dupliquée, sans code mort.
- `?route=X` prépare le sentier choisi (nom, tracé, distance réels) — aucune écriture en base.
- Explorer mobile/natif utilisable : contrôles accessibles avec carrousel, géolocalisation native possible, pas de cul-de-sac sans GPS.

**Non-objectifs**
- Pas de nouvelle fonctionnalité métier (pas de partage temps réel, pas d'IA).
- Pas de migration DB, pas de changement de flag de rollout.
- Pas de refonte de l'Explorer desktop (déjà livré).

## 3. Décisions validées (propriétaire, 12/09)

| # | Question | Décision |
|---|---|---|
| D1 | Structure desktop | **Flux canonique dans la colonne centre** du hub (pas de cockpit 3 colonnes, pas de bento) |
| D2 | Fonctions conservées | Tout est conservé **mais simplifié** : checklist+matériel+poids+alertes ; carte+météo **fusionnées** ; participants+fiche officielle regroupés ; ÉCO/Wi-Fi/partage **fondus** dans le hero |
| D3 | `?route=X` | **Préparer le sentier choisi** (identité = sentier réel), pas de démo TMB, pas de création en base |
| D4 | Organisation interne | **Approche A — flux par priorité d'action** : Hero → Alertes → Sac → Terrain → Équipement → Équipe |

## 4. Architecture cible

### 4.1 Desktop (≥ 1024 px)

- `HubDepartSection` reste le point d'entrée SSR ; **suppression du wrapper 3 colonnes interne** de `DepartCockpit` (L598-677) et des paddings dupliqués (`max-w-[1680px] px-4…`).
- Nouveau `DepartDesktopView` (client) rendu dans la colonne centre du hub :
  - `flex flex-col gap-5` ;
  - **grille 2 colonnes `xl:`** pour Sac ↔ Terrain ;
  - sous `xl` : empilement colonne unique.
- Les rails du hub (`HubSidebarLeft` 260 px, `HubSidebarRight` 300 px ≥ lg) restent **la seule** navigation/contexte — aucune sidebar dupliquée.
- `MenuBack` + `h1.sr-only` fournis par `page.tsx` : conservés tels quels.

### 4.2 Mobile (< 1024 px)

- Bascule en `lg` **comme toutes les sections** (`hidden lg:block` / `lg:hidden` dans `page.tsx`).
- Nouvelle `DepartMobileExperience` — `src/features/hub/components/mobile/depart/` — anatomie canonique (référence `SafetyMobileExperience`) :
  - wrapper `flex min-w-0 flex-col gap-5 pb-1` ;
  - hero `glass relative overflow-hidden rounded-[1.75rem] p-4` (eyebrow, `glass-pill`, `BudgetRing`, stats, CTA) ;
  - `GroupeChipsRow`, rails `GroupeRail`, drawers `GroupeDrawer`/`GlassDrawer` ;
  - **aucun** calcul de safe-area (rôle d'`AppShell`), **aucun** header sticky maison, **aucun** padding dupliqué.

### 4.3 Extraction de logique (anti-chaos)

Sortir de `DepartCockpit` :
- `useDepartAlerts` (génération + snooze + dismiss unifiés) ;
- `useDepartOfflineCache` (localStorage `lkdv_depart_cache_*`, batterie, file offline) ;
- `resolveDepartIdentity(depart, trail)` — helper pur : identité affichée = sentier choisi si présent.

### 4.4 Overlays

- Toutes les modales maison `fixed inset-0 z-50` → `GlassDrawer`/`GlassModal` (`z-[10000]/[10001]`) : rien ne passe sous la tab bar `z-9999`.
- Plein écran carte → `GlassModal` (fin du `fixed z-50` dans contexte animé).

### 4.5 Suppressions (code mort)

`DepartHeader.tsx` (525 l.), `MobileWeightHeader`, `SECTIONS_TABS`/`ScrollableTabs`/`TabOption`, modale de prêt inatteignable, `searchQuery` mort, usages de la classe `danger` inexistante, imports inutilisés. Les événements `window` conservés uniquement s'ils servent encore (sinon remplacés par les hooks).

## 5. Contenu par bloc (approche A)

1. **Hero — identité** : eyebrow « Départ actif », `glass-pill` statut (En préparation/Prêt/Actif/Terminé), titre = nom réel (départ ou sentier `?route=X`), date/countdown live, `BudgetRing` % prêt, 3 tuiles stats (`glass-sub-card`) : poids total, éléments manquants, distance ; CTA « Ouvrir la fiche » (primary), « Partager » (secondaire) ; pastille discrète ÉCO/Wi-Fi.
2. **Alertes** — **un** bandeau `glass tone-danger` (action vitale + dismiss, snooze conservé) ; si aucune alerte : ligne « Tout est prêt » sobre (aucune carte vide).
3. **Sac** (poids + checklist) : en-tête + jauge segmentée, 3 pastilles poids, analyse catégories en accordéon, checklist complète (groupes, filtre Tous/Restants, TTS, ajout/suppression). Desktop ≥ xl : colonne gauche ; mobile : rail « prochains articles » + drawer checklist.
4. **Terrain** (carte + météo fusionnées) : carte tracé réel (plein écran via `GlassModal`), météo 3 jours + éphéméride dans la même surface. Météo absente → surface sans bloc météo (jamais de carte vide).
5. **Équipement** : `DepartEquipmentHub` conservé (parc/inventaire/boutique, recherche, filtres) habillé canonique (`glass-sub-card`, segmented, drawers), CTA « ajouter au sac ».
6. **Équipe & fiche** : participants (initiales, ICE), appels 112/15 (style danger via tokens), fiche officielle en drawer (impression/partage, bascule statut actif/terminé).

## 6. Vocabulaire visuel & motion

- **Tokens uniquement** : `--lkv-*`, `.glass`, `.glass-sub-card`, `.glass-pill`, `.glass-eyebrow`, `.glass-capsule-btn(.primary)`, `.glass-circle-btn`, `hub-rail`. Interdits : `rose/sand/forest`, `bg-white/60|90`, `dark:`.
- **Typo** : titres `font-display`, corps DM Sans, micro-labels `text-[10px] uppercase tracking-[0.14em]`.
- **Motion** : reveals canoniques (opacity 0→1, y 6-8, 0.22-0.24 s, ease `[0.22,1,0.36,1]`, stagger ≤ 0.3) ; `active:scale-[0.97]` + haptique `useHapticFeedback` par action ; `prefers-reduced-motion` respecté ; rails via `GroupeRail` exclusivement.
- **A11y** : `role="checkbox"`/`aria-checked` sur les items checklist mobile (manque actuel), focus visibles, contrastes tokens.

## 7. Données & erreurs

- `getDepartDetail(id, route)` : quand un sentier réel est résolu, l'identité (`destination`, `trail`, distance) vient du **sentier** ; kit = kit de démarrage par défaut **renommé sans marque TMB** (ex. « Kit de départ ») ; aucune écriture DB. `resolveDepartIdentity` pur, testé.
- Météo `null` → bloc terrain sans météo ; `trails=[]` → pas de carte tracé (pas de cadre vide).
- Invité / `id=none` → mêmes règles (le sentier dès qu'il est résolu).
- Offline → un seul bandeau, file d'actions conservée.
- Explorer natif : géolocalisation refusée/absente → **on reste sur le globe** (pas de plongeon Chamonix), message non bloquant ; dernière position connue réutilisée si disponible.

## 8. Volet 2 — Explorer mobile/natif (systematic-debugging)

Processus : cause racine démontrée avant correctif, preuves brutes dans `docs/explorer-mobile/`.

| # | Problème | Intention | Critère d'acceptation |
|---|---|---|---|
| E1 | Carrousel `z-800` recouvre zoom + CTA | Corriger le stacking (contrôles tapables, sans perdre le carrousel) | Zoom, « Explorer ma zone/Vue globe », « Préparer » tapables avec carrousel visible sur 390×844 et 430×932 |
| E2 | Géoloc native impossible | Wrapper `src/lib/native/geolocation.ts` + `NSLocationWhenInUseUsageDescription` (iOS) + `ACCESS_FINE/COARSE_LOCATION` (Android) | Permission demandée dans l'app installée ; refus → comportement non bloquant |
| E3 | Sans GPS → Chamonix vide | Repli : rester sur le globe (ou zone France dense) sans fetch vide | « Explorer ma zone » sans GPS affiche des sentiers ou reste sur le globe, jamais page vide muette |
| E4 | SW actif en natif | Garde `isNative()` sur l'enregistrement `/sw.js` | Pas de SW dans l'app Capacitor |
| E5 | `server.url` absent | Documenter/exiger `CAPACITOR_SERVER_URL` au build natif | App installée charge l'app servie |

## 9. Tests & vérification

- **Unitaires** : `resolveDepartIdentity` ; hooks extraits ; suppression de code mort sans casse (`tsc`).
- **e2e** (`scripts/e2e/`) : cockpit desktop rend ses 6 sections ; expérience mobile rend ; flux `Préparer` → **nom du sentier choisi visible**.
- **Visuels** : captures desktop + mobile du nouveau cockpit (`docs/depart/`) ; captures explorer mobile après E1.
- **Gates** : `npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` · suites visuelles/e2e ; mise à jour de `tests/mobile-layout.spec.ts` (assertions obsolètes).
- **Rapports** : entrées brutes `MISSION_LOG.md`.

## 10. Risques & atténuation

| Risque | Atténuation |
|---|---|
| Régression fonctionnelle (checklist/équipement très volumineux) | Logique métier conservée à l'identique, seule l'enveloppe change ; e2e de flux + tests existants |
| Carrousel/contrôles explorer : correction de stacking à effets de bord | Root cause d'abord, correctif minimal, captures avant/après aux 2 tailles |
| App native non testable localement (pas de simulateur iOS sous Windows) | Critères testables en WebView Android émulateur si dispo ; sinon protocole de test manuel fourni + preuves `docs/` |
| Cascade `.glass` vs `rounded-*` | Vérification visuelle systématique des captures |

## 11. Rollback

- Volet 1 : branche dédiée, merge `--no-ff` ; revert du merge restaure l'ancien cockpit (aucune migration).
- Volet 2 : correctifs isolés par problème (E1…E5), chacun réversible indépendamment.
