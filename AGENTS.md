# AGENTS.md — Guide Multi-Agents (Codex / Antigravity / CI)

Ce dépôt suit les conventions décrites dans [CLAUDE.md](CLAUDE.md) et la documentation complète dans [docs/README.md](docs/README.md).

## Règles d'exécution pour agents autonomes
1. **Lire avant d'éditer** : Charger uniquement les sections pertinentes de `docs/` et les fichiers sources cibles (< 2 000 lignes de contexte par tâche).
2. **Zéro régression** : Avant de conclure toute modification de code, exécuter :
   - `npm run design:check` (si CSS/design modifié)
   - `npm test` (tests ciblés ou suite Vitest)
   - `npm run lint`
   - Pour les changements majeurs : `FAST_BUILD=1 NODE_OPTIONS="--max-old-space-size=3072" npx next build && rm -rf .next/cache/webpack`
3. **Architecture & Hébergement** :
   - Web = **Cloudflare Workers (`vinext`)** uniquement (pas de Vercel).
   - Mobile = **Capacitor 8** (`ios/` + `android/`).
   - Base de données = **Supabase Postgres 17 + PostGIS** (`supabase/migrations/`).
4. **Conventions de commits** : Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`, `docs(...)`). Ne jamais commiter de binaires lourds, captures PNG temporaires ou fichiers `.env*`.
5. **Sécurité & RGPD** :
   - Toute nouvelle table Supabase publique doit activer RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) avec politiques explicites.
   - Les données biométriques/santé (FC, VMA, fatigue, RPE) relèvent de l'Art. 9 RGPD — tout partage IA reste strictement opt-in (voir `buildAiActivityInsightPayload`).
