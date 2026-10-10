## 2026-10-04T19:00:16Z
[Message] timestamp=2026-10-04T19:00:16Z sender=22810fd4-62f8-4724-853b-2cdeda826f11 priority=MESSAGE_PRIORITY_HIGH content=You are challenger_m3_social_2, specialized in Adversarial Stress Testing of Cockpit Performance & Coordinate Formatting.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\challenger_m3_social_2

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md
And worker handoff:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\worker_m3_implementation_1\handoff.md

Adversarially challenge the Expedition Cockpit and Coordinate formatting:
1. Test `formatEmergencyCoordinates`:
   - Pathological coordinates: Null island (0, 0), North Pole (90, 0), South Pole (-90, 0), Antimeridian (0, 180 and 0, -180), NaN, null, undefined, extreme floating-point decimals, negative zero (`-0`). Ensure format is always clear, accurate, and never crashes.
2. Test zero-fetch performance & render speed:
   - Mount `RouteMiniMapPane` and `ExpeditionRoomCockpit` in isolation; verify strictly 0 network fetches (`global.fetch`).
   - Benchmark rendering speed: mounting cockpit under 50 items must execute in < 15ms.
3. Test design invariants:
   - Verify ZERO orange `#E4501C` in any rendered HTML or style classes.
   - Verify touch targets >= 44px across all 5 navigation tabs and 4 check-in broadcast buttons.
4. Run tests and report results.
5. Deliver your verdict (`APPROVE` or `REQUEST_CHANGES`) in `handoff.md` and message orchestrator.
