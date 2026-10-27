# Audit performance & sécurité — /messagerie et système (2026-10-27)

**Cible mesurée :** `https://kitduvoyageur.faracitonyp.workers.dev/messagerie` (Cloudflare Worker), viewport 430×932, Chrome, réseau local.
**Après déploiement :** version `9f52798b` (Cloudflare).

---

## 1. Résultat : chargement

| Métrique | Avant | Après | Δ |
|---|---|---|---|
| TTFB (à froid) | 1 671 ms | **1 378 ms** | −18 % |
| FCP | 3 296 ms | **1 828 ms** | **−45 %** |
| LCP | 3 296 ms | **2 192 ms** | **−34 %** |
| TBT | 389 ms | **50 ms** | **−87 %** |
| Long tasks | 2 | 2 | — |
| TTFB / FCP (cache chaud) | — | **186 ms / 984 ms** | — |
| Première rangée visible | ~3 100 ms | **1 652 ms** (chaud), 2 879 ms (froid) | −47 % |

### Ce qui a produit le gain

1. **Profil mis en cache** (`sessionStorage`) et **dédupliqué** dans `AuthContext`. La requête `user_profiles` coûtait **3 437 ms + 2 515 ms** (deux appels concurrents) sur le chemin critique ; elle n'est plus bloquante. API la plus lente désormais : **172 ms**.
2. **Battement de présence différé** (2,5 s, hors chemin critique) : `user_presence` coûtait **2 071 ms** au montage.
3. **Liste des conversations mémorisée** et peinte dès que la session est connue (lot précédent), rafraîchie en fond.
4. **Surcouches en import dynamique** (kits, GPX, notes vocales, signalement, transfert) : ~50 Ko gzip hors bundle initial.

---

## 2. Ce qui reste lourd (mesuré, chiffré)

| Constat | Poids / coût | Levier |
|---|---|---|
| Bundle i18n complet (5 langues) dans un seul chunk | **556 Ko** | ne charger que la locale active (dictionnaires séparés + import dynamique) |
| Feuille de style principale | **582 Ko** (+224 Ko, +48 Ko) | découper par écran, sortir la grammaire Compte en CSS critique minimal |
| Chunks JS uniques chargés sur `/messagerie` | **103 fichiers**, ~2 Mo utiles | réduire via `optimizePackageImports`, barrel imports, et sortir les composants non utilisés de l'arbre |
| Même chunk demandé deux fois (103 uniques pour 192 entrées) | double parse/évaluation | corriger les `preload` non réutilisés (crossorigin) |
| TTFB à froid ~1,4 s | rendu Worker + auth | coquille servie statiquement, données en streaming |
| `rpc/get_last_messages` 88–2 150 ms | dépend de la charge | index déjà présent côté RPC, mais vérifier `EXPLAIN` en charge |
| 404 sur un chunk après déploiement (manifest RSC obsolète) | 1 requête perdue + retry | `CACHE_VERSION` du SW à incrémenter à chaque déploiement (fait côté infra), sinon navigation client qui échoue |

---

## 3. Audit base de données (advisors Supabase)

- **162 clés étrangères sans index couvrant** (INFO performance) — impact direct sur les jointures des écrans riches (clubs, carnet, marketplace). Priorité : les FK des tables chaudes (`conversations`, `conversation_members`, `messages`, `community_posts`, `carnet_*`).
- **Politiques RLS permissives multiples** sur 14 tables (INFO) : plusieurs policies `SELECT` pour le même rôle → planification inutile, et surface d'audit plus large. Remédiation : fusionner en une policy par rôle/action.
- **RLS vérifiée saine** sur les objets sensibles (test réel : insertion dans une conversation dont le compte n'est pas membre → 403). Aucun contournement trouvé.

## 4. Audit sécurité (état consolidé)

Rapport complet : `docs/security/AUDIT-SECURITE-2026-10-26.md`.

- **Corrigé** : IDOR critique `stories/[id]/media`, `notifications/process` et `digest` non authentifiés, `demo-login` sans interrupteur, IDOR `materiel/share`, redirections ouvertes (`connexion`, Stripe), JSON-LD pays, session obligatoire sur `ai/chat-completion`, GPS hors `/api/hike-sessions/[id]`, schémas zod sur `rewards/*`, `indexnow` réservé au cron, rate-limit `og-preview`, **18/18 crons** en comparaison à temps constant.
- **Ouvert** (aucune régression introduite par ce lot) : `admin/rewards` sans schéma, 21 routes renvoyant `error.message`, rate limits mémoire locale contournables en multi-instance, HIBP désactivé, 13 fonctions `SECURITY DEFINER` exécutables par `anon`.
- **Dépendances** : `npm audit --omit=dev` → **30 vulnérabilités : 3 critiques, 14 élevées, 13 modérées**. Correctifs disponibles sans changement majeur : `next` 15.5.28, `@capacitor/ios|android` 8.5.1, `zod` 4.6.6.
- **Code ajouté dans ce lot** (revu) : les nouveaux composants (`AttachmentDrawer`, `GpxThumb`, `TraceMap`) ne lisent que des URLs signées du bucket `message-attachments` (même origine Storage), n'interpolent aucun HTML, et n'exposent aucune donnée serveur côté client.

---

## 5. Plan priorisé (proposé)

1. **i18n paresseux** — 556 Ko → ~110 Ko (gain ~450 Ko sur chaque page).
2. **CSS par écran** — sortir la grammaire Compte du CSS global (582 Ko).
3. **Index des FK chaudes** — 10 à 20 index ciblés, gain sur toutes les listes.
4. **Coquille statique de `/messagerie`** — viser TTFB < 300 ms à froid.
5. **Patches de dépendances** (`next`, Capacitor, zod) avec build complet de vérification.
6. **Fusion des policies RLS permissives** (14 tables) — hygiène et performance.
