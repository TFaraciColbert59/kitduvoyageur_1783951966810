# MCP du chantier (tous gratuits)

| Serveur | Pour | Remarque |
|---|---|---|
| `context7` | Documentation à jour de three.js, Next.js, Capacitor, Playwright, Zustand | Évite les recherches web coûteuses |
| `playwright` | Parcours et captures WebKit mobile (moteur de Safari) | Équivalent iPhone 15 Pro (écran 393 × 852) ; pour 402 × 874 utiliser `page.setViewportSize` dans les tests |
| `chrome-devtools` | Mesures de performance, console, réseau | Local seulement |
| `vercel` | Déploiements, journaux, accès aux aperçus protégés | Compte Vercel de Tony (authentification OAuth à la première utilisation) |
| `supabase-lecture` | Lire schémas et politiques RLS | **Lecture seule** (`read_only=true`) ; les migrations passent par `ks-reviewer` puis les scripts du dépôt |
| `xcodebuild` | Build et installation iOS | **macOS seulement** ; ignorer sur Windows/Linux |

Si un serveur ne démarre pas : continuer sans lui (les équivalents en ligne de commande suffisent), ne pas bloquer le chantier. Les noms de paquets sont ceux des éditeurs ; en cas d'échec d'installation, le noter dans `JOURNAL.md` et utiliser `npx playwright`, `gh`, `vercel` ou `xcodebuild` directement.
