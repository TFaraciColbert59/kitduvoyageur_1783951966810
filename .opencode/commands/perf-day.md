---
description: Run LKDV's autonomous all-day performance loop using specialized profilers, implementer and reviewer.
agent: perf-orchestrator
---
Run the LKDV autonomous performance lab continuously for this session.

First run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/perf/assert-lab-workspace.ps1 -RequireClean`. Stop on failure. Never switch branches, stash, reset or clean anything.

Use only localhost production builds and synthetic local fixtures. Never use real user sessions, storage-state files, credential pages or non-local origins.

Start by verifying or refreshing the baseline. Then repeatedly select the highest-value evidence-backed bottleneck and perform ONE controlled experiment at a time.

Mandatory for every cycle:
baseline -> hypothesis -> specialist diagnosis -> smallest implementation -> same benchmark -> independent review -> keep/revert -> journal -> exact staging command for the operator.

Never stage, commit, push, merge, deploy, force-reset, or perform destructive database operations.

Stop work on a hypothesis after two failed attempts.
Prefer user-perceived mobile performance and iPhone/WebKit behavior.
At the end of the session, summarize accepted gains, rejected experiments, unresolved bottlenecks and the next best experiments.
