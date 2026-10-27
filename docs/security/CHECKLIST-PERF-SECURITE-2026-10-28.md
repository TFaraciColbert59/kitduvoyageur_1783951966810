# Checklist performance & sécurité — LKDV (manche autonome, 2026-10-28)

Légende : **✅ fait et vérifié** · **◐ fait dans une manche précédente** · **○ différé** (raison) · **✗ écarté** (risque de régression)

## Performance — 50 items

| # | Amélioration | État |
|---|---|---|
| 1 | Profil utilisateur en cache `sessionStorage` (retire 3,4 s du chemin critique) | ✅ |
| 2 | Déduplication des requêtes profil (une seule en vol) | ✅ |
| 3 | Battement de présence différé à 2,5 s | ✅ |
| 4 | Liste des conversations en cache de session, peinte avant le réseau | ✅ |
| 5 | Surcouches (kits, GPX, vocal, signalement) en import dynamique | ✅ |
| 6 | Rangées de conversation `React.memo` + callbacks stables | ✅ |
| 7 | Squelettes à la place des textes « Chargement… » | ✅ |
| 8 | `preconnect` Supabase + Storage | ✅ |
| 9 | Avatars dimensionnés + `decoding="async"` | ✅ |
| 10 | `prefetch('/compte')` au survol de la pillule | ✅ |
| 11 | `contain: paint` sur le fil (découpe les coins sans surcoût) | ✅ |
| 12 | Vignette GPX en SVG projeté (pas de MapLibre par bulle) | ✅ |
| 13 | `content-visibility: auto` sur les rangées hors écran du fil | ✅ |
| 14 | Cache mémoire des URLs signées (évite une signature par rendu) | ✅ |
| 15 | Signature d'une pièce jointe seulement quand elle devient visible | ✅ |
| 16 | `useDeferredValue` sur le filtre de conversations (frappe fluide) | ✅ |
| 17 | `decoding="async"` + `referrerPolicy` sur les vignettes distantes | ✅ |
| 18 | Bornage du parsing GPX (20 000 points max) — protège le CPU | ✅ |
| 19 | Suppression des animations non composées (transform/opacity only) | ◐ |
| 20 | `prefers-reduced-motion` respecté partout dans la grammaire | ◐ |
| 21 | Cache-Control `private, no-cache` sur `/messagerie` (bfcache) | ◐ (écrasé par le framework) |
| 22 | Coquille statique de `/messagerie` (TTFB < 300 ms) | ○ (chantier serveur) |
| 23 | Découpage i18n : FR statique, autres langues à la demande (−556 Ko) | ○ (107 tests : dict synchrone côté Compas) |
| 24 | CSS par écran (582 Ko de feuille globale) | ○ (découpage à coordonner) |
| 25 | `optimizePackageImports` sur les libs d'icônes | ○ (build à valider) |
| 26 | Preload des chunks critiques de la route | ○ (vinext ne l'expose pas) |
| 27 | Réduire les `preload` dupliqués (192 entrées / 103 fichiers) | ○ (outillage framework) |
| 28 | Images de fond en AVIF/WebP responsive | ○ |
| 29 | Virtualiser la liste des messages (fils longs) | ○ (risque UX) |
| 30 | Index DB sur FK chaudes (162 signalées) | ○ (tables messaging déjà couvertes) |
| 31 | `EXPLAIN` du RPC `get_last_messages` | ○ |
| 32 | Cache HTTP des réponses publiques (pays, randonnées) | ○ |
| 33 | Découper `community-feed.css` (92 Ko) hors des routes qui ne l'utilisent pas | ○ |
| 34 | Serve worker pour MapLibre uniquement sur les routes carte | ◐ (déjà en import dynamique) |
| 35 | Limiter les `backdrop-filter` aux surfaces visibles | ○ |
| 36 | Suspendre les abonnements realtime quand l'onglet est caché | ○ |
| 37 | Réduire la taille des payloads RSC (props serveur) | ○ |
| 38 | Pagination du fil (déjà 30 messages) → vérifier la taille | ○ |
| 39 | Compression Brotli côté Worker | ◐ (par défaut Cloudflare) |
| 40 | `Cache-Control: immutable` sur `/_next/static` | ◐ (framework) |
| 41 | Supprimer les styles morts de la grammaire messagerie | ✅ |
| 42 | Éviter les re-renders du composer à chaque frappe (état local isolé) | ◐ |
| 43 | `will-change` retiré des éléments non animés | ✅ |
| 44 | `content-visibility` sur les drawers hors écran | ✅ |
| 45 | Fonts locales (next/font) — pas de requête Google | ◐ |
| 46 | Images de messages `loading="lazy"` | ✅ |
| 47 | Réduire le nombre de providers React au niveau page | ○ |
| 48 | Mesure régulière (Web Vitals) branchée en prod | ○ |
| 49 | Budget de bundle en CI | ○ |
| 50 | Tests de non-régression perf (Lighthouse CI) | ○ |

## Sécurité — 50 items

| # | Contrôle | État |
|---|---|---|
| 1 | RLS vérifiée sur messages/conversations/membres (test réel 403) | ✅ |
| 2 | IDOR `stories/[id]/media` (bucket + chemin client) | ✅ |
| 3 | `notifications/process` + `digest` authentifiés | ✅ |
| 4 | `demo-login` derrière `DEMO_AUTO_LOGIN` | ✅ |
| 5 | IDOR `materiel/share` (kit_id) | ✅ |
| 6 | Redirections ouvertes `connexion` (`safeNextPath`) | ✅ |
| 7 | Retours Stripe limités à l'origine du site | ✅ |
| 8 | JSON-LD échappé (`serializeJsonLd`) | ✅ |
| 9 | Session obligatoire sur `ai/chat-completion` | ✅ |
| 10 | GPS horodaté hors `/api/hike-sessions/[id]` | ✅ |
| 11 | Schémas zod sur `rewards/claim` + `withdraw` | ✅ |
| 12 | `indexnow` (sitemap) réservé au cron | ✅ |
| 13 | Rate limit `og-preview` | ✅ |
| 14 | Comparaison des secrets de cron en temps constant (18/18) | ✅ |
| 15 | MIME déduit de l'extension avant upload (GPX iOS) | ✅ |
| 16 | URL signées limitées au bucket `message-attachments` | ✅ |
| 17 | Validation UUID du `post_id` avant requête | ✅ |
| 18 | Plafond de taille sur le parsing GPX (anti-DoS CPU) | ✅ |
| 19 | `referrerPolicy` sur toutes les images distantes | ✅ |
| 20 | `rel="noreferrer"` sur les liens externes des cartes | ✅ |
| 21 | Types de messages autorisés à ouvrir le drawer (liste blanche) | ✅ |
| 22 | Aucun `dangerouslySetInnerHTML` ajouté cette manche | ✅ |
| 23 | Aucune clé de stockage rendue à l'écran | ✅ |
| 24 | Aucun secret côté client (`NEXT_PUBLIC_*` audités) | ✅ |
| 25 | Upload borné à 25 Mio côté client et bucket | ◐ |
| 26 | Bucket privé + policies de chemin `[conv]/[uid]` | ◐ |
| 27 | `admin/rewards` sans schéma zod | ○ |
| 28 | 21 routes renvoyant `error.message` | ○ |
| 29 | Rate limits mémoire contournables en multi-instance | ○ |
| 30 | HIBP désactivé (mots de passe compromis) | ○ (console Supabase) |
| 31 | 13 fonctions `SECURITY DEFINER` exécutables par `anon` | ○ |
| 32 | Patches dépendances (`next`, Capacitor, zod) | ○ (build complet requis) |
| 33 | 14 tables à policies RLS permissives multiples | ○ |
| 34 | 162 FK sans index | ○ |
| 35 | Extensions PostGIS/trgm dans `public` | ○ |
| 36 | CSP en Report-Only avec `unsafe-inline` | ○ (chantier nonce) |
| 37 | Purge de session incomplète au logout | ○ |
| 38 | 1 an de validité des URLs signées `user-documents` | ○ |
| 39 | Buckets `carnet-media` / `gear-photos` listables | ○ |
| 40 | Sessions en `localStorage` (repli) | ○ |
| 41 | Sel RGPD codé en dur | ○ |
| 42 | `/api/admin/*` : revue d'autorisation complète | ○ |
| 43 | Webhook Stripe : signature vérifiée (fail-closed) | ◐ |
| 44 | SSRF `og-preview` : DNS revalidé à chaque saut | ◐ |
| 45 | Logs : aucune donnée personnelle sensible | ○ |
| 46 | Rotation des secrets cron | ○ |
| 47 | Tests d'autorisation automatisés sur les routes sensibles | ○ |
| 48 | Vérification `auth.uid()` dans toutes les RPC `service_role` | ◐ |
| 49 | En-têtes de sécurité (HSTS, nosniff, frame-deny) | ◐ |
| 50 | Audit trimestriel planifié | ○ |
