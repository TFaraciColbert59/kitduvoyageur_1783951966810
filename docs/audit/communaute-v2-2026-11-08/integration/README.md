# Recette d'intégration visuelle — Communauté v2

Harnais Playwright **hors `src/`** pour capturer les deux tiroirs réels
(`NEXT_PUBLIC_COMMUNAUTE_V2=true`) en 390×844, sans aucune requête réelle :
PostgREST, GoTrue, Storage et origines externes sont interceptés.

Fichiers :

| Fichier | Rôle |
|---|---|
| `fixtures.mjs` | Données réalistes conformes à `handoff/communaute-v2/RPC-CONTRACTS.md` et `shared/types.ts` (carnets, clubs, sorties, agenda, recherche, détails, profils). Dates calculées relativement au jour de capture. |
| `network.mjs` | `page.route` : RPC, tables PostgREST (`.single()` géré via `Accept: application/vnd.pgrst.object+json`), Auth, Storage, origines externes. Pose la session synthétique (`sb-<ref>-auth-token`, format `@supabase/ssr` `base64-`). Modes `normal`, `empty`, `error`, `skeleton`. |
| `capture.mjs` | Scénarios : Explorer (4 volets, tri, détail, peek, vide/erreur/squelette, île) et Création (6 types, erreur inline, brouillon). Écrit `captures/*.png`, `console-report.json`, `_failures.json`. |
| `captures/` | Captures 390×844 de la dernière exécution. |
| `RAPPORT-INTEGRATION.md` | Écarts de fidélité par gravité (après première capture des deux tiroirs). |

## Lancer

```bash
# 1. Build de recette : la v2 est montée et Supabase pointe vers un hôte fictif
NEXT_PUBLIC_COMMUNAUTE_V2=true \
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
npm run build

# 2. Serveur (port 4028 par convention Playwright)
NEXT_PUBLIC_COMMUNAUTE_V2=true npm run start

# 3. Captures
node docs/audit/communaute-v2-2026-11-08/integration/capture.mjs
# cibler un groupe ou suffixer les captures :
node .../capture.mjs --only explorer --tag run2
node .../capture.mjs --base http://127.0.0.1:4028
```

Variables utiles : `CV2_BASE_URL` (défaut `http://127.0.0.1:4028`).

## Garde-fous

- Aucun secret, aucune session réelle : cookie et utilisateur synthétiques.
- Aucun appel réseau sortant : tout est `route.fulfill`.
- Le serveur doit être un build **avec** la v2 ; sinon le tiroir v1 s'ouvre et
  les sélecteurs `lkdv-cv2-*` échouent proprement (`_failures.json`).
- Le harnais continue après un scénario en échec et écrit une capture
  `-ECHEC.png` + le DOM `-ECHEC.html` pour diagnostiquer.
