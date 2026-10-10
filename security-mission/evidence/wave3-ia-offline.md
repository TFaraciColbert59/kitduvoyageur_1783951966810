# Wave 3 — IA, offline/mobile, fichiers (faits, 2026-10-09)

Sources : 2 sous-agents lecture seule (git HEAD `14d80de8`). Faits avec chemin:ligne.

## 1. IA — routes et frontières (extraits)

- **Auth conditionnelle** : `ai/chat-completion` (auth seulement si NODE_ENV=production, route.ts:66-76) ;
  `guides/[country]/ask` (idem, :38-44) ; `kit-report/generate`, `trip-assistant`, `materiel/scan`,
  `materiel/optimize` = utilisateur **optionnel**. → H-009 confirmé par lecture.
- **Sans rate-limit** : `materiel/scan`, `materiel/optimize`, `guides/ask`, `ai/ping`. `scan`/`optimize`
  appellent Gemini directement (quota non couvert par `askAI`) → abus de coût anonyme possible → H-022.
- **Clé Gemini dans l'URL** (`generativelanguage.googleapis.com/...?key=…`) : `scan/route.ts:44`,
  `optimize/route.ts:144` ; erreurs brutes loggées (:126/:189) — l'URL peut finir dans des logs → H-022.
- **Cache IA sans scope utilisateur** : clé = sha256(feature|prompt|'fr') sans userId
  (`responseStore.ts:18-29`) ; TTL > 0 pour trail-narrative (1 an), country-guides (30 j),
  pays-recommendations, trajectoire (1 h) ; le cache est consulté AVANT le quota → deux utilisateurs au
  prompt identique partagent la réponse. Contenu = réponses génériques par prompt, pas de données
  d'un autre utilisateur injectées ; à confirmer produit par feature → H-021.
- **Quota fail-open** : `consumeQuota` renvoie true si client/RPC indisponible (`quota.ts:20-39`).
- **Sorties LLM écrites** : `ai_response_cache` brut (askAI.ts:102) ; `content_md` min 20 (sauf
  `recommendCountryKits` :180-183 sans minimum) ; Tier 1 safety = `needs_human_review` obligatoire
  (generateSafetyCriticalBlock.ts:167-175 ; RLS publique exige revue — migration :88-95). Aucun
  eval/shell/SQL dynamique trouvé dans `src/lib/ai/**` (grep négatif) ; seul plugin externe = `web`
  OpenRouter (max 5 résultats) → H-028 (schéma/sanitize systématique des sorties stockées).
- **Bug fonctionnel potentiel (non sécurité)** : `aiClient.ts:1-4` fetch interne sans cookies ;
  `chat-completion` exige une session en production → `trip-assistant` et `carnet/identify-species`
  pourraient recevoir 401 en prod (indéterminé sans exécution) — à signaler au produit.
- Quotas/bornes `askAI` corrects : maxTokens 64-8192, reasoning borné, timeouts fast/heavy, course de
  3 providers max, compteurs par tier/feature (migration), cap 5 tentatives jobs.

## 2. SSRF og-preview (F-010)

- Garde locale `og-preview/route.ts:5-35` : localhost/127.0.0.1/::1/0.0.0.0/.local + IPv4 privés
  (10/8, 172.16-31, 192.168/16, 169.254/16).
- **Contournements constatés (statiques)** :
  - `hostname` d'une URL IPv6 est **entre crochets** (`new URL('http://[::1]/').hostname === '[::1]'`)
    → les comparaisons `'::1'` ne matchent jamais ; aucune règle pour `fc00::/7`, `fe80::/10`,
    `::ffff:127.0.0.1` (vérifié Node v24.18.0).
  - `127.0.0.0/8` partiellement couvert : seul `127.0.0.1` exact est bloqué (`127.0.0.2` passe).
  - `fetch` suit les redirections par défaut (`route.ts:63`, aucun `redirect:'manual'`) → une URL
    publique peut 302 vers une destination interne après la garde.
  - Aucune résolution DNS vérifiée (rebinding), aucune allowlist de destinations.
- Effet possible : requêtes serveur vers endpoints internes/métadonnées, lecture ~100 KB HTML et retour
  de meta tags (exfiltration limitée). Non testé dynamiquement ; protections plateforme inconnues.

## 3. Offline / rétention inter-comptes (F-011)

- Purges existantes : SW runtime+images (message), React Query client, snapshot critique, contextes
  actifs (`ActiveTripContext.tsx:31-48,63-77`), `clearCriticalSnapshot` (ReactQueryProvider.tsx:47-56).
- **Stores NON purgés au logout/changement de compte** (aucun appel trouvé) :
  - `lkdv_participants_state_v1` — **données médicales** (groupe sanguin, allergies, ICE,
    médicaments) `useParticipantsStore.ts:13,25-55,102,120` ;
  - `kdv_cart` (`lib/cart.ts:18`), `kdv_wishlist` (`WishlistContext.tsx:25`), `lkdv_guest_*`
    (`useEquipment.ts:86-87`, `useUserKits.ts:42`, `useOfflineInventory.ts:14-18`) ;
  - drafts : `lkdv_adventure_prep_v*` (useAdventurePrepStore.ts:618), `lkdv_free_departure_v2`
    (trace GPS 400 pts, useFreeDepartureStore.ts:143-160), `lkdv_preparation_state_v2`,
    `lkdv:trip-draft` (useTripDraft.ts:13) ;
  - caches compte : `lkdv_compte_cache_profile_<uid>` / `dashboard_<uid>` (`useCompte.ts:21-82`) ;
  - IndexedDB : `lkdv-trips`, `lkdv-trip-sync`, `lkdv-materiel`, `lkdv-cache`, `lkdv-offline*` ;
    `purgeOfflineData` (A11, `db.ts:207-220`) existe mais **n'a aucun appelant dans src** ;
  - files offline : départ (`departOfflineQueue.ts:20`), hiking (`OfflineManager.ts:17`), inventaire
    (`offlineStorage.ts`).
- Conséquence : B sur le même appareil peut lire cart/wishlist/drafts/caches profil et données
  médicales d'A (persistance locale non scopée) ; test dynamique A→B non exécuté ici.
- `signOut` (AuthContext.tsx:189-193) = `signOut()` + `setProfile(null)` seulement.

## 4. Sync offline serveur

- `POST /api/adventure/offline/sync` : session obligatoire (`route.ts:52-58`), lot ≤ 50, payload ≤ 64 Ko,
  idempotence `kind:entity:hash` + registre `offline_sync_operations`, dead-letter 8, expiration 30 j.
- Client **service_role** utilisé (`route.ts:90-100`) malgré un docstring qui annonce un client de
  session (`offlineSync.ts:263-267`) ; contrôle propriétaire explicite pour les décisions
  (`offlineSync.ts:487-499`) ; sessions/reports passent par des créations avec userId de session
  (à vérifier exhaustivement) → H-023.
- Pas de champ de version sur les opérations (pack versionné, opérations non) → H-029 (compat).

## 5. Capacitor / mobile

- Config : release exige HTTPS (`capacitor.config.ts:13-18`), `cleartext` dev only, `androidScheme https`,
  `iosScheme capacitor`, `webContentsDebuggingEnabled` prod=false. Aucune `allowNavigation`.
- Deep links : aucun listener `appUrlOpen` ; iOS sans `CFBundleURLTypes` ; Android sans filtre VIEW.
- Tokens : pas de stockage natif dédié — session Supabase en cookies/localStorage WebView
  (`lib/supabase/client.ts:25-115`) ; wrapper Preferences sans appelant. → persistance at-rest indéterminée.
- **`android:allowBackup="true"`** (`AndroidManifest.xml:5`) → sauvegardes OS pouvant inclure le
  stockage WebView (session) → H-024. `FileProvider` expose external-path/cache-path racine (:28-33).
- Pas de permission CAMERA déclarée alors que le plugin caméra est utilisé (fonctionnel).
- `product-images` : bucket absent des migrations suivies (créé hors dépôt ?) → H-025.

## 6. Uploads / parsers

- Uploads : `group-media` (10 Mo client, public), `message-attachments` (privé, policy membre,
  signé 24 h, **aucun contrôle client taille/type** dans messagingService/ConversationView),
  `user-documents` (privé, signé 365 j), `product-images` (admin, seul `accept=image/*`).
- GPX : parse **client** `DOMParser` sans borne de taille (`GPXEngine.ts:15-20`,
  `GPXImportExportModal.tsx:29-44`) ; parse **serveur** par regex (`exportEngine.ts:283-298`, pas de
  DOMParser → pas de XXE, borne de taille non visible) → H-027.
- EXIF : aucun code EXIF ; `has_exif_stripped` par défaut true (migration) sans traitement observé.

## 7. Service worker

- 4 listeners (install/activate/message/fetch) ; aucun `push` ni `sync`. Messages
  `lkdv:set-active-route`/`lkdv:delete-route` émis par `useOfflineDownload.ts:176,225` **non gérés**
  par le SW HEAD ; cache `lkdv-tiles-route-<id>` référencé mais jamais créé → H-026.
- Push : envoi serveur VAPID, mais aucun `pushManager.subscribe` client trouvé (chaîne incomplète).

## 8. Faits non déterminés (honnête)

- Comportement prod réel : tokens WebView at-rest, bucket product-images, purge planifiée
  `ai_response_cache`, réponses 401 des fetch IA internes en production.
- Modules A7/A11/A13 (pack offline, purge, migrations legacy) sans appelant hors tests.
- Résolution d'entités XML par le DOMParser du navigateur (non démontrable ici).
- Protections plateforme (WAF) pour og-preview/notifications.
