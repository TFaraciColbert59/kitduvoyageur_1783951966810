# Dépendances — audit (31/10/2026)

Méthode : pour chaque entrée `dependencies`/`devDependencies` de `package.json`,
recherche du nom dans tous les fichiers `.ts/.tsx/.js/.mjs/.jsx/.css` de
`src/`, `scripts/` et `tests/` (imports, `require`, sous-chemins). Les usages
**de configuration** (`next.config`, `tailwind.config`, `postcss.config`,
`eslint.config`, `vite.config`, `.mcp.json`) ont été vérifiés séparément.

## Résultat brut

58 paquets n'ont **aucun import** dans `src/`. La majorité sont des faux
positifs légitimes :

| Catégorie | Exemples | Statut |
|---|---|---|
| Outils de build/config | `tailwindcss`, `autoprefixer`, `postcss`, `eslint-config-*`, `@typescript-eslint/*`, `@types/*`, `@vitejs/plugin-*`, `@cloudflare/vite-plugin`, `vinext`, `@vinext/cloudflare`, `vite-css-modules` | utilisés par les configs — **conserver** |
| CLI / scripts | `@capacitor/cli`, `@playwright/test` (33 scripts, 59 tests), `@axe-core/playwright`, `autocannon`, `dotenv` (32 scripts), `typescript`, `tsx`, `jsdom`, `prettier` | utilisés hors `src/` — **conserver** |
| MCP / agents | `@playwright/mcp`, `chrome-devtools-mcp`, `@omniroute/opencode-plugin`, `@dhiwise/component-tagger` | outillage local, non bundlé — **conserver** |
| Icônes / UI générées | `@phosphor-icons/core` (sprite généré), `liquid-glass-react` | à vérifier au prochain lot — **conserver** (doute) |
| **Candidats réellement inutilisés** | `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@radix-ui/react-accordion`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `vaul`, `react-day-picker`, `react-dropzone`, `@tailwindcss/typography`, `react-server-dom-webpack` | **aucune référence** trouvée |

## Décision : aucun retrait dans ce chantier

Raisons, dans l'ordre de poids :

1. **Aucun gain de bundle démontrable** : ces paquets ne sont importés nulle
   part, donc déjà absents du bundle par tree-shaking. Le gain se limiterait à
   l'installation et à la surface de chaîne d'approvisionnement.
2. **`package.json` porte une garde explicite** (`rocketCritical` :
   « DO NOT REMOVE OR MODIFY ABOVE DEPENDENCIES ») qui cite `recharts`. La
   retirer sans validation produit revient à contourner une décision d'équipe.
3. **Validation impossible ici** : un retrait exige `npm install` (lockfile),
   build complet (~15 min), suite Vitest complète et E2E Playwright (base de
   test absente → `BLOCKED`). Sans E2E, une dépendance chargée dynamiquement
   pourrait casser un écran sans être détectée.
4. Le protocole du chantier impose « le doute garde » : faux négatif >> faux
   positif.

**Suite recommandée** (hors périmètre, à planifier) : lot dédié « dépendances »,
un paquet par commit, avec `npm install`, build, `npm test`, E2E sur base de
test, et mesure de `node_modules` + temps d'installation avant/après.

## Vérification de non-régression du lot outillage

Le seul changement de dépendances de ce chantier est la **resynchronisation du
lockfile** (aucun paquet ajouté à `package.json`) :

- 3 versions transitives bougent (`ajv` 6.15→8.20, `json-schema-traverse`
  0.4.1→1.0.0, `webpack-sources` 3.5.1→3.7.0, toutes tirées par les paquets
  déjà déclarés) ;
- 23 paquets jusqu'ici absents du lockfile sont ajoutés (`webpack@5.112.2`,
  `@opencode-ai/plugin@1.19.5`, …) ;
- aucune version de dépendance **directe** ne change ;
- `npm ci` repasse (était cassé sur HEAD) et `npm run build` sort en exit 0.
