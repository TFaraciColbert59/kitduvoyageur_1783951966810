# Liens de référence

Documentation officielle à relire en phase 0 (elle fait foi sur ce bundle si elle a changé depuis le 8/11/2026).

## Recherche et décisions de Tony
- Audit des points d'action admin (Claude Doc) : https://claude.ai/artifact/325kgbpqF23uVMcTUYfT3Q
- Recherche « CRM parfait » + décisions (Claude Doc) : https://claude.ai/artifact/HQ2yD3snegNPnFMjtgAErY — copie locale : `RECHERCHE_CRM.md`
- Maquette (Claude Design) : https://claude.ai/artifact/F1BqXNqqKrbCjb3gyTadSs — copie locale : `maquette/*.dc.html`

## Supabase
- MFA (TOTP) : https://supabase.com/docs/guides/auth/auth-mfa/totp
- Niveaux `aal1`/`aal2` dans les policies : https://supabase.com/docs/guides/auth/auth-mfa#enforce-rules-for-mfa-logins
- RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Realtime, autorisation des canaux privés : https://supabase.com/docs/guides/realtime/authorization
- Realtime, diffusion depuis la base (`realtime.send`) : https://supabase.com/docs/guides/realtime/broadcast
- Schémas exposés à l'API : https://supabase.com/docs/guides/api/using-custom-schemas
- API de gestion : https://supabase.com/docs/reference/api/introduction
- Auth admin (ban, signOut) : https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- `@supabase/ssr` avec Next.js : https://supabase.com/docs/guides/auth/server-side/nextjs
- Advisors / linter : https://supabase.com/docs/guides/database/database-linter
- pgTAP : https://supabase.com/docs/guides/database/extensions/pgtap

## Vercel
- Monorepo et Root Directory : https://vercel.com/docs/monorepos
- Ignored Build Step : https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
- Cron Jobs (limites par offre) : https://vercel.com/docs/cron-jobs/usage-and-pricing
- Deployment Protection : https://vercel.com/docs/deployment-protection
- Instant Rollback : https://vercel.com/docs/instant-rollback
- Conditions de l'offre Hobby (usage non commercial) : https://vercel.com/docs/limits/fair-use-guidelines

## Stripe
- Remboursements : https://docs.stripe.com/refunds
- Idempotence : https://docs.stripe.com/api/idempotent_requests
- Webhooks et vérification de signature : https://docs.stripe.com/webhooks
- Mode test et cartes de test : https://docs.stripe.com/testing

## IA, agents
- NVIDIA NIM (API compatible OpenAI) : https://docs.api.nvidia.com/nim/reference/llm-apis
- Model Context Protocol, spécification : https://modelcontextprotocol.io/specification
- OWASP Top 10 pour les applications LLM (injection de prompt) : https://genai.owasp.org/llm-top-10/

## Réglementation
- DSA (règlement (UE) 2022/2065), art. 16, 17, 20 : https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- CNIL, durées de conservation des journaux : https://www.cnil.fr/fr/la-cnil-publie-une-recommandation-relative-aux-mesures-de-journalisation
- WCAG 2.2 : https://www.w3.org/TR/WCAG22/

## Design et expérience
- Shopify Polaris, formulaires : https://polaris-react.shopify.com/patterns/new-app-design-guidelines
- NN/g, révélation progressive : https://www.nngroup.com/articles/progressive-disclosure/
- UMUX-Lite : https://measuringu.com/umux-lite/
