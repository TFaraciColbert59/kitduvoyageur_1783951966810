# A7 — Hub, cockpit et offline — Rapport implémenteur (commits 1 à 3)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Spec normative : `docs/superpowers/specs/2026-09-11-a7-hub-cockpit-offline-design.md`
- Périmètre : commits 1 à 3 (spec intégrale)
- Skills appliqués : `apple-ui-designer`, `ux-mobile`, `interaction-design`, TDD strict

## Commits (ordre exact de la spec)

1. `d8c1a5cc` — `feat(a7): vue cockpit bornee et declencheurs de recalcul`
2. `ec1988f6` — `feat(a7): offline V2 — operations idempotentes et base Dexie`
3. `8832ea0b` — `feat(a7): UI cockpit, section hub et bandeau offline`

## Vérifications globales

- `npx vitest run tests/adventure-intelligence` (post commit 3) : **35 fichiers / 233 tests passés**, 0 échec.
- `npx vitest run tests/adventure-intelligence tests/design/unification.spec.ts` : **36 fichiers / 238 tests passés**, 0 échec (garde-fous U-D60 → U-D64 inclus).
- `npm run type-check` : exit 0 après chaque commit.
- `npm run lint` : exit 0 après chaque commit (avertissements préexistants uniquement ; lint ciblé `--file` sur les 4 fichiers UI = « No ESLint warnings or errors »).
- `npm run build` : **jamais exécuté** (contrainte respectée).
- Aucun fichier de page/route Hub modifié (composants autonomes, prêts à monter en Phase 9).

---

## Commit 1 — Vue cockpit bornée et déclencheurs de recalcul

**Fichiers**
- `src/features/adventure-intelligence/domain/cockpit.ts` (330 lignes)
- `src/features/adventure-intelligence/domain/recalcTriggers.ts` (155 lignes)
- `tests/adventure-intelligence/cockpit.spec.ts` — `TEST-A7-COCK-01..06` (6 tests)
- `tests/adventure-intelligence/recalc-triggers.spec.ts` — `TEST-A7-TRIG-01..06` (6 tests)

**Implémentation cockpit**
- `buildCockpitView(input)` : projection pure et bornée. Constantes exportées `MAX_COCKPIT_INDICATORS = 3`, `MAX_COCKPIT_ACTIONS = 3`, seuils difficulté 75/90, batterie 20/10.
- Héro unique : titre (`plan.title` sinon « Aventure »), sous-titre (offline > prochain segment critique > difficulté > « Prêt à consulter »), statut traduit (`draft|active|completed|archived`).
- Indicateurs ordonnés (difficulté → alertes → décisions → batterie → confiance) puis plafonnés à 3 ; ton dérivé : difficulté > 90 critical / > 75 warning / > 50 neutral / sinon positive, batterie ≤ 10 critical / ≤ 20 warning, confiance high positive / low warning.
- Actions prioritaires : décisions requises (celles à confirmation d'abord) > signaler > naviguer, plafonnées à 3.
- Alertes triées gravité (critical → warning → info) puis distance croissante, libellé FR réutilisant `categoryDisplay` (A5) + distance.
- ETA toujours en fourchette : P90 < P50 est ramené à P50, P50 seul laisse P90 `null` (jamais de fausse précision) ; `aheadBehindMinutes` optionnel propagé.
- Difficulté étiquetée (Facile → Très difficile / Inconnue), stratégie d'allure traduite (`comfort|recommended|fast`), demi-tour, confiance, raisons et `offline` propagés. Entrée vide → vue calme sans exception.

**Implémentation recalcTriggers**
- `evaluateRecalc` : position (haversine A1) ≥ 250 m, reprise après pause ≥ 2 min (`moving: true` + `lastPositionAt` âgé), écart d'allure ≥ 15 % (relatif, dans les deux sens), hors-trace (nouvel épisode uniquement), version signalements, batterie ≤ 20 % (une fois : ne re-déclenche pas tant que le dernier niveau connu reste ≤ 20), version d'itinéraire.
- Anti-rebond : `now − lastRecalcAt < 60 s` ⇒ `shouldRecalculate: false`, `nextState` inchangé (les raisons candidates sont conservées pour l'UI) afin de ne pas perdre les signaux.
- `nextState` ne consomme les baselines (position, allure, versions, batterie) que lors d'un recalcul effectif ; le reset d'épisode hors-trace (`offRoute: false → lastOffRouteAt: null`) reste observé à chaque évaluation. Seuils exportés et testés.

**TDD**
- RED : les 2 suites échouent en collecte — `Cannot find package '@/features/adventure-intelligence/domain/cockpit'` et `.../domain/recalcTriggers'` — 0 test collecté.
- GREEN : 12/12 tests après implémentation, sans modification des tests.
- `npm run type-check` exit 0, `npm run lint` exit 0.

## Commit 2 — Offline V2 : opérations idempotentes et base Dexie

**Fichiers**
- `src/features/adventure-intelligence/offline/operations.ts` (pur, zéro I/O/Dexie)
- `src/features/adventure-intelligence/offline/db.ts` (Dexie, couche fine)
- `tests/adventure-intelligence/offline-operations.spec.ts` — `TEST-A7-OFF-01..05` (5 tests)

**Implémentation operations.ts**
- `OFFLINE_STORES` : les 10 stores ADR-AI-007 ; `OFFLINE_QUEUE_STORES` + garde `isOfflineQueueStore`.
- `makeIdempotencyKey({ kind, entityId, payloadHash })` = `kind:entityId:hash` stable ; `hashPayload` = FNV-1a 32 bits sur JSON à clés triées (ordre insensible, pas de crypto).
- `createOfflineOperation` : `id === idempotencyKey`, `attempts` borné, `createdAt` injectable (déterminisme des tests).
- `dedupeOperations` : première occurrence gagnante, ordre stable.
- `packSizeBytes` : somme des octets UTF-8 sérialisés, 0 pour un pack vide.
- `planLegacyMigration(raw)` : clés connues `lkdv_offline_sync_queue` / `lkdv_offline_reports_queue` / `lkdv_offline_decisions_queue` / `lkdv_offline_adventure_pack` + métadonnées `lkdv_offline_pack_version`, `lkdv_offline_last_sync` ; clé inconnue ou JSON illisible → `skipped` (jamais de destruction silencieuse) ; sortie dédupliquée.

**Implémentation db.ts**
- `AdventureOfflineDb extends Dexie`, nom `lkdv-adventure-offline-v1` : 10 stores physiques conformes à l'ADR ; index queue `'id, &idempotencyKey, createdAt, store'` (clé d'idempotence unique), caches `'id, updatedAt'`, `sync_metadata: 'key'`.
- Helpers : `enqueue` (transaction, `false` si clé déjà présente), `pending(store?)` (tri `createdAt`), `markSynced(ids)` (suppression multi-stores), `markFailed(ids)` (incrément `attempts`), `metadata(key)` / `metadata(key, value)` (lecture/écriture typée).

**TDD**
- RED : `Cannot find package '@/features/adventure-intelligence/offline/operations'` — 0 test collecté.
- GREEN : 5/5 tests après implémentation. Suite A7 complète post-commit : 35 fichiers / 233 tests.
- Aucun test Dexie (contrainte spec : pas d'IndexedDB en Node) — la logique est intégralement dans `operations.ts`.
- `npm run type-check` exit 0, `npm run lint` exit 0.

## Commit 3 — UI cockpit, section hub et bandeau offline

**Fichiers**
- `src/features/adventure-intelligence/ui/AdventureCockpit.tsx`
- `src/features/adventure-intelligence/ui/AdventureHubSection.tsx`
- `src/features/adventure-intelligence/ui/OfflineBanner.tsx`
- `src/features/adventure-intelligence/ui/index.ts`

**Implémentation**
- `AdventureCockpit` : client, rend strictement `buildCockpitView` (mémorisé) dans l'ordre imposé — héro → 3 indicateurs → jusqu'à 3 actions → alertes verticales → ETA fourchette → difficulté (+ barre) → allure → demi-tour → confiance → raisons de recalcul (bouton « Recalculer ») → bandeau offline. Callbacks optionnels `onDecide/onReport/onNavigate/onRecalculate`, `pendingSyncCount`.
- `AdventureHubSection` : bloc Hub — état global (indicateurs ou message calme `role="status"`), décisions requises (`priorityActions` de type `decide`), grille 2/4 colonnes vers les sections existantes (`DEFAULT_HUB_QUICK_LINKS` = ids du registre hub `itinerary`, `safety`, `checklist`, `journal` — aucune route nouvelle), bouton « Ouvrir », bandeau offline.
- `OfflineBanner` : `role="status"` + `aria-live="polite"`, non bloquant, ne rend rien en ligne, compte d'actions en attente au singulier/pluriel, icône `wifi-off`.

**Preuves design / a11y**
- Tokens `var(--lkv-*)` exclusivement (aucun hex, aucun `#E4501C`), `Icon` en import par défaut, rayons/ombres système uniquement.
- Garde-fous `tests/design/unification.spec.ts` verts : U-D61 (classes froides), U-D62 (`rounded-[Npx]`/`shadow-[...]` littéraux), U-D63 (dialogues natifs), U-D64 — aucun littéral interdit dans les nouveaux fichiers.
- Cibles tactiles : boutons actions/hub ≥ 44 px (`min-h-[44px]`/`min-h-[48px]`/`min-h-[64px]`) ; bandeau non interactif.
- Safe-area : `pb-[env(safe-area-inset-bottom)]` sur le cockpit ; lint ciblé `--file` : « No ESLint warnings or errors ».
- `prefers-reduced-motion` via `useReducedMotion` (Framer Motion) ; animations limitées à `opacity`/`y` 6 px, 220 ms (< 450 ms).
- Sémantique : sections/`ul` étiquetées (`aria-label`), `role="status"` pour les états calmes et l'offline, sévérité des alertes doublée d'un texte `sr-only`, `suppressHydrationWarning` sur les heures localisées (`toLocaleTimeString`) pour éviter les faux mismatch SSR/client.
- Pas de skeleton : la vue est pure et synchrone (pas d'état de chargement), donc aucun risque de CLS introduit.

**Vérifications**
- `npx vitest run tests/adventure-intelligence tests/design/unification.spec.ts` : 36 fichiers / 238 tests verts.
- `npm run type-check` exit 0 ; `npm run lint` exit 0 ; lint ciblé des 4 fichiers UI sans avertissement.

---

## Points d'attention / reporté

1. **Tests Dexie** : conformément à la spec, `db.ts` n'a pas de test unitaire (pas d'IndexedDB en Node). `enqueue/pending/markSynced/markFailed/metadata` sont typés et volontairement minces ; leur comportement réel (transactions, index unique) reste à couvrir en Phase 9 (Playwright/browser).
2. **Montage réel différé (Phase 9)** : les 3 composants sont autonomes et ne sont montés dans aucune page/route Hub (contrainte « ne pas modifier les pages Hub existantes »). L'intégration visuelle, les tests Playwright visuels/a11y et le câblage des callbacks restent à faire.
3. **Types de cache offline** : les 6 stores de données utilisent `OfflineCacheEntry { id, payload, updatedAt }`. Le raffinement par entité (route, segment, prédiction…) viendra quand les écritures de cache réelles seront branchées.
4. **Heuristique de pause** : `pause_reprise_2min` repose sur `moving === true` + `lastPositionAt` non rafraîchi depuis 2 min. Si le GPS continue d'émettre pendant une pause, aucun signal n'est levé — contrat documenté, à confronter au flux réel en Phase 8/9.
5. **Import inter-feature** : `domain/cockpit.ts` réutilise `categoryDisplay` de `terrain-live/lib/terrainDisplay` (pur, sans I/O) pour les libellés d'alertes ; pas de cycle (terrainDisplay n'importe que les schémas A1).
6. **Anti-rebond** : lors du blocage 60 s, les raisons candidates sont renvoyées mais `nextState` reste inchangé (aucun signal consommé) — les déclencheurs seront rejoués à la prochaine évaluation post-fenêtre.
7. **Heures localisées** : formatées côté client avec `suppressHydrationWarning` ; prévoir un formatage déterministe si un rendu SSR de ces valeurs est exigé en Phase 9.
