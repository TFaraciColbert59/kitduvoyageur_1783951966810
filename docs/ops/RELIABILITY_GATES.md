# Local reliability gates

`/api/og-preview` retains its fail-closed IP limit and public-address checks on
every redirect. One three-second budget covers DNS, all redirect hops, response
headers and HTML reads. At most 100 KiB of body bytes are decoded; every obtained
response body or reader is cancelled when leaving its hop. Cancellation is not
awaited because upstream cleanup can hang. The DNS validation and subsequent
fetch still use separate resolutions: DNS rebinding/pinning is not fixed here.

`npm run ops:slo-check -- --load load.json --health health.json --json` consumes
local A15/A14 evidence. A15 latency and 5xx samples require at least 100 samples,
finite counters, an explicit pass/fail verdict, zero unexpected 4xx and zero
network errors. Missing counters and inconclusive verdicts stay
`insufficient_data`. A valid sample whose measured latency or 5xx ratio exceeds
the SLO remains a failure even when A15's verdict is `fail`.

`--metrics metrics.json` accepts independently collected measurements keyed by
the nine `Phase10MeasurementKey` identifiers. Instantaneous numbers remain
supported for definitions without a sample minimum. Sample measurements use
`{ "value": 100, "count": 100, "valid": true }`; sample-based read latency and 5xx
measurements require this structure, literal `valid: true`, and an integer count
of at least 100. Bare numbers cannot bypass these requirements through `--metrics`.
The supplied A14/A15 evidence takes precedence over `--metrics`. These files are
local evidence inputs, not production instrumentation or proof of capacity.

CLI exit statuses are 0 only when every SLO passes, 1 for a measured SLO failure
or an exceeded supplied AI budget, and 2 for incomplete evidence or unreadable
configuration. A healthy A15-only file returns 2 because it does not measure all
nine SLOs. Alert delivery and external load testing are not performed.

Focused regression command:

```sh
npx vitest run tests/api/og-preview-deadline.spec.ts tests/observability/slo.spec.ts tests/observability/slo-load-gate.spec.ts --maxWorkers=2
```
