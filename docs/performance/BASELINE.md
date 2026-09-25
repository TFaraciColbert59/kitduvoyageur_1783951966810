# LKDV Performance Baseline

Ce fichier est un template jusqu'à l'exécution de `/perf-baseline` sur un worktree `perf/*` propre.

## Environment

- Commit :
- Date :
- Node :
- Next :
- Browser :
- Machine :
- Viewport/device :
- CPU throttling :
- Network :
- Data fixture synthétique :
- Cache state :

## Build/bundle

| Metric | Value |
|---|---:|
| Shared JS | |
| Explorer shell First Load JS | |
| MapLibre gzip | |
| MapLibre raw | |

## Journeys — lab

| Journey | Origin | Cache | Runs | Median | P90 | Notes |
|---|---|---|---:|---:|---:|---|
| Cold start -> HUB usable | localhost | cold | | | | |
| HUB -> Explorer usable | localhost | warm | | | | |
| Explorer -> map interactive | localhost | warm | | | | |
| Community usable | localhost | warm | | | | |
| Messages usable | localhost | warm | | | | |

## Core Web Vitals — field

Ces données sont importées manuellement depuis la source RUM approuvée ; le lab localhost ne collecte aucun champ externe. Ne pas mélanger ces données avec les mesures lab. Indiquer la source RUM, la fenêtre, le p75, le formulaire et la taille d'échantillon.

| Scope | Window | Sample size | Form factor | LCP p75 | INP p75 | CLS p75 | Source |
|---|---|---:|---|---:|---:|---:|---|
| | | | | | | | |

## Core Web Vitals — lab

| Route/journey | Viewport | Runs | Cache | CPU/network | LCP | INP | CLS | Evidence |
|---|---|---:|---|---|---:|---:|---:|---|
| | | | | | | | | |

## Network

L'allowlist Chrome bloque les sous-ressources non locales. Les volumes third-party et Supabase ne sont donc pas représentés dans ces chiffres. Pour une analyse third-party, utiliser un run séparé avec des origines explicitement approuvées.

| Journey | Requests | Transfer | Largest avoidable dependency |
|---|---:|---:|---|
| | | | |

## Memory

| Lifecycle | Heap before | Heap after cycles | Detached nodes/listeners | Verdict |
|---|---:|---:|---:|---|
| Explorer mount/unmount x5 | | | | |

## Top bottlenecks

Remplir uniquement à partir de preuves. Ne pas comparer une observation lab unique à un budget field p75.
