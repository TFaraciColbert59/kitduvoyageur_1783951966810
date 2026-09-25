# LKDV Space Bunny Performance Lab

Pack OpenCode dédié aux performances de **Le Kit du Voyageur (LKDV)**.

Boucle stricte :

**mesurer → diagnostiquer → hypothèse → petite modification → re-mesurer → reviewer indépendant → garder ou revert → journal → commande de staging pour l'opérateur**

Aucune optimisation n'est acceptée sur intuition seule.

## Modèle

```yaml
model: opencode-go/space-bunny-free
variant: max
```

## Architecture

- orchestrateur sans édition de code applicatif ;
- quatre profilers read-only : navigateur, React/Next, base et parcours ;
- un implementer limité aux chemins performance ;
- un reviewer indépendant read-only ;
- outils Chrome et Playwright listés un par un ;
- shell `deny` par défaut, avec allowlist de lecture/tests ;
- MCP locaux épinglés dans `package-lock.json` ;
- branche `perf/*` et worktree propre obligatoires ;
- aucun staging ni commit par un agent ; l'opérateur commit après revue.

## Installation

Bootstrap unique sur la branche de travail actuelle :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\install-performance-lab.ps1" -AllowDirtyBootstrap -AllowUntrackedSkills -SkipValidation
```

Le bootstrap utilise `-SkipValidation` car le type-check global peut être cassé par le travail Liquid Glass en cours. Avant toute commande du lab, relance l'installateur sans switch dans le worktree `perf/*` propre : la validation complète est alors obligatoire.

Après revue et commit des seuls fichiers du lab :

```powershell
git worktree add "..\kitduvoyageur-perf" -b "perf/space-bunny-lab"
Set-Location "..\kitduvoyageur-perf"
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File ".\install-performance-lab.ps1"
opencode
```

Puis :

```text
/perf-baseline
/perf-day
```

## Garde-fous

Le lab ne doit jamais :

- travailler sur `main` ou une branche sans préfixe `perf/` ;
- démarrer dans un worktree sale ;
- mélanger des changements Liquid Glass préexistants ;
- exposer un wildcard Playwright ou Chrome ;
- exécuter du code arbitraire via un outil MCP ;
- télécharger un skill ou lancer un MCP non verrouillé au runtime ;
- committer ou pousser ; l'opérateur commit lui-même après revue ;
- pousser, merger, déployer, réinitialiser Git ou détruire une base ;
- utiliser une session utilisateur réelle ou une origine non locale ;
- committer un secret, cookie, token ou artefact brut ;
- accepter une optimisation sans preuve avant/après.

## Limite opérationnelle

Ce mode est sécurisé pour une session de travail longue, mais il s'arrête aux approbations humaines. Pour une exécution nocturne sans surveillance, place le même worktree dans une VM sans secrets avec un superviseur Windows ou CI dédié.
