---
description: Build a reproducible LKDV performance baseline before optimization.
agent: perf-orchestrator
---
Establish a fresh LKDV performance baseline.

First run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/perf/assert-lab-workspace.ps1 -RequireClean`. Stop on failure. Never switch branches, stash, reset or clean anything.

Use only localhost production builds and synthetic local fixtures. Never use real user sessions, storage-state files, credential pages or non-local origins.

Do not edit application code.

Read the existing performance budget and perf scripts. Delegate browser, React/Next, DB and journey profiling where useful.

At minimum capture:
- production build route sizes
- bundle analyzer summary
- MapLibre measured size
- representative mobile journey timings
- Web Vitals/trace evidence on runnable routes
- request counts/transfer where meaningful
- obvious memory lifecycle problems
- existing test/build health

Write/update `docs/performance/BASELINE.md` and `docs/performance/performance-budgets.json` only if the new measurements are directly comparable and trustworthy.

Finish with the top 5 evidence-backed bottlenecks, without implementing them.
