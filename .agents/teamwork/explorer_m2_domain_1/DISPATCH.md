## 2026-10-04T10:32:26Z
You are explorer_m2_domain_1, specialized in Outdoor Objects Domain & Pack Merge Algorithm.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_domain_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Your task for Milestone 2 (First-Class Outdoor Objects & Live Cards):
1. Design `src/features/messaging/types/outdoorObjects.types.ts`:
   - Pre-computed snapshots: `GPXSnapshot`, `KitSnapshot`, `EquipmentSnapshot`, `ExpeditionSnapshot`, `ActivitySheetSnapshot`.
   - Wire with `Message.metadata` and messaging types.
2. Design `src/features/messaging/domain/packMerge.ts`:
   - Group collective gear deduplication (shared tents, stoves, water purification).
   - Load distribution algorithm integrating with existing `src/features/preparation/services/loadDistribution.ts`.
   - Respect strict physiological safety thresholds: 20% max body weight ratio for humans, 15% for dogs.
   - Support roles ('guide', 'medic', 'scout') and produce warnings if weight exceeds thresholds.
3. Write `analysis.md` and deliver `handoff.md` in your working directory.
Communicate when done via send_message to orchestrator.
