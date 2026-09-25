# Performance Lab setup notes

## Mode validé

Le lab fonctionne dans un worktree `perf/*` propre, sur localhost, avec des fixtures synthétiques. Les agents ne peuvent ni stage ni commit : après revue, l'opérateur exécute lui-même la commande de staging fournie.

Un fonctionnement overnight sans surveillance exige une VM ou un conteneur sans secrets. Le mode workstation ne doit pas être exposé à Internet.

## Bootstrap initial

La branche Liquid Glass courante contient déjà des modifications non liées. Pour installer le pack sans les mélanger :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\install-performance-lab.ps1" -AllowDirtyBootstrap -AllowUntrackedSkills -SkipValidation
```

`-AllowDirtyBootstrap` autorise seulement l'installation initiale sur la branche courante. `-AllowUntrackedSkills` tolère uniquement les skills nouvellement téléchargés. `-SkipValidation` évite que le type-check global, susceptible d'être cassé par le travail Liquid Glass en cours, bloque le bootstrap. La validation complète est obligatoire dans le worktree `perf/*` propre. Aucun switch n'autorise `/perf-baseline` ou `/perf-day`, et une configuration MCP conflictuelle reste bloquante.

Après revue, commite uniquement les fichiers du lab et les dépendances MCP verrouillées. Ne commit pas les changements Liquid Glass.

## Worktree obligatoire

```powershell
git worktree add "..\kitduvoyageur-perf" -b "perf/space-bunny-lab"
Set-Location "..\kitduvoyageur-perf"
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File ".\install-performance-lab.ps1"
```

L'installateur normal refuse :

- une branche qui ne commence pas par `perf/` ;
- un worktree avec des changements préexistants ;
- un agent manquant ;
- une commande manquante ;
- un serveur MCP non résolu ;
- un skill non suivi par Git ;
- un type-check ou un lint en échec.

## Modèle

Les sept agents utilisent :

```yaml
model: opencode-go/space-bunny-free
variant: max
```

Vérification :

```powershell
opencode models opencode-go
opencode debug agent perf-orchestrator
```

## MCP verrouillé

`package.json` et `package-lock.json` épinglent :

- `chrome-devtools-mcp@1.10.1` ;
- `@playwright/mcp@0.0.82`.

`opencode.json` lance ces paquets depuis `node_modules` avec `node`, pas avec `npx` au runtime.

Chrome DevTools est configuré avec profil isolé, en-têtes réseau redactés, CrUX désactivé, évaluation JavaScript désactivé et allowlist d'URL localhost. Cette allowlist nécessite Chrome 149 ou plus récent. Elle bloque aussi les sous-ressources third-party : les totaux réseau ne sont valides que pour les origines explicitement autorisées.

Playwright est configuré en WebKit mobile, isolé, sans WebMCP et sans génération de code. Son option d'origines autorisées est une défense en profondeur, pas une frontière de sécurité selon le package Microsoft.

```powershell
opencode mcp list
opencode agent list
opencode debug agent perf-orchestrator
```

Quitte puis relance OpenCode après toute modification de configuration.

## Skills suivis par Git

Le lab attend ces skills suivis par Git et présents dans `skills-lock.json` :

- Addy Osmani : `performance`, `core-web-vitals`, `web-quality-audit` ;
- Vercel : `vercel-react-best-practices` ;
- Supabase : `supabase-postgres-best-practices` ;
- LKDV : `lkdv-performance-method`.

L'installateur ne télécharge plus de skills à l'exécution. Toute mise à jour d'un skill doit être faite dans un environnement de quarantine, revue puis verrouillée dans `skills-lock.json`.

## Permissions

- Les outils Playwright et Chrome sont nommés explicitement, jamais exposés par wildcard.
- `browser_run_code_unsafe`, `browser_evaluate`, les clics, formulaires, uploads et exécution JavaScript ne sont pas disponibles.
- Le shell est en `deny` par défaut ; seules les commandes de lecture et de test sont autorisées. Les builds et analyses restent `ask` pour l'orchestrateur et l'implémenteur.
- `git add` et `git commit` sont refusés aux agents ; l'opérateur les exécute hors du lab après revue.
- Push, reset dur, changement de branche, déploiement et migrations destructives sont refusés.
- Les agents profilers et le reviewer ne peuvent pas éditer le code.

## Données de mesure

- build de production local uniquement ;
- viewport mobile explicite ;
- fixtures synthétiques ;
- aucune session utilisateur réelle ;
- aucun `storage-state` ;
- aucune origine non locale ;
- traces et heap snapshots dans le workspace temporaire MCP ;
- redaction des cookies, tokens, query strings, DOM et identifiants ;
- aucun artefact brut commité.

## Première session

```powershell
npm run type-check
npm run lint
```

Dans OpenCode :

```text
/perf-baseline
```

Inspecte `docs/performance/BASELINE.md`, puis :

```text
/perf-day
```

Le lab travaille jusqu'à la fermeture d'OpenCode, l'épuisement des étapes ou la première demande d'approbation opérateur. Il ne se relance pas seul après un redémarrage.
