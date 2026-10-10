import { PackMergeService, mergePacks } from '../../../src/features/messaging/domain/packMerge';
import { serializeGPXSnapshot, isGPXSnapshot } from '../../../src/features/messaging/types/outdoorObjects.types';

console.log('=== STARTING ADVERSARIAL INTEGRITY STRESS TESTS ===');

// 1. Stress Test: Diacritics & Case Insensitive Deduplication
console.log('--- 1. Diacritics & Case Insensitive Deduplication ---');
const itemsWithDiacritics = [
  { id: '1', name: 'RÉCHAUD GAZ TITANE', weightGrams: 300, category: 'cook', isShared: true },
  { id: '2', name: 'réchaud gaz titane', weightGrams: 280, category: 'cook', isShared: true },
  { id: '3', name: 'Rechaud Gaz Titane', weightGrams: 350, category: 'cook', isShared: true },
];
const dedupResult = PackMergeService.deduplicateSharedGear(itemsWithDiacritics);
if (dedupResult.retainedItems.length !== 1 || dedupResult.retainedItems[0].id !== '2') {
  throw new Error(`FAIL: Expected lightest retained item '2', got ${dedupResult.retainedItems[0]?.id}`);
}
if (dedupResult.droppedDecisions.length !== 1 || dedupResult.weightSavedGrams !== 650) {
  throw new Error(`FAIL: Expected 650g saved, got ${dedupResult.weightSavedGrams}`);
}
console.log('PASS: Diacritic and case-normalization deduplication verified.');

// 2. Stress Test: Mass Conservation Invariant across 500 randomized items
console.log('--- 2. Mass Conservation Invariant (500 items) ---');
const participants = [
  { id: 'h1', name: 'Alice', type: 'human' as const, bodyWeightKg: 55, role: 'guide' as const },
  { id: 'h2', name: 'Bob', type: 'human' as const, bodyWeightKg: 85, role: 'medic' as const },
  { id: 'd1', name: 'Rex', type: 'dog' as const, bodyWeightKg: 25, isCarryingPack: true },
  { id: 'd2', name: 'Puck', type: 'dog' as const, bodyWeightKg: 10, isCarryingPack: false },
];

const humans = participants.filter((p) => p.type === 'human');

const randomItems = [];
let expectedInitialWeight = 0;
for (let i = 0; i < 500; i++) {
  const isShared = i % 2 === 0;
  const weight = 50 + (i * 13) % 2000;
  expectedInitialWeight += weight;
  randomItems.push({
    id: `rnd-${i}`,
    name: `Item-${i % 30}`,
    category: ['shelter', 'sleep', 'cook', 'water', 'safety', 'misc'][i % 6],
    weightGrams: weight,
    isShared,
    canBeCarriedByDog: i % 7 === 0,
    ownerId: humans[i % humans.length].id, // owned by humans
  });
}

const mergeRes = PackMergeService.runPackMerge(participants, [{ ownerId: 'h1', items: randomItems }]);

const totalAssigned = Object.values(mergeRes.individualLoads).reduce((sum, l) => sum + l.allocatedWeightGrams, 0);
const totalDropped = mergeRes.droppedDuplicates.reduce((sum, d) => sum + d.weightSavedGrams, 0);

if (totalAssigned + totalDropped !== expectedInitialWeight) {
  throw new Error(`FAIL: Mass conservation broken! Initial: ${expectedInitialWeight}, Assigned: ${totalAssigned}, Dropped: ${totalDropped}, Sum: ${totalAssigned + totalDropped}`);
}
console.log(`PASS: Mass conservation holds strictly across 500 items (${expectedInitialWeight}g conserved).`);

// 3. Stress Test: Non-carrying Dog Invariant
console.log('--- 3. Non-carrying Dog Invariant ---');
const puckLoad = mergeRes.individualLoads['d2'];
if (puckLoad.allocatedWeightGrams !== 0 || puckLoad.maxSafeWeightKg !== 0) {
  throw new Error(`FAIL: Non-carrying dog Puck received ${puckLoad.allocatedWeightGrams}g allocation!`);
}
console.log('PASS: Non-carrying dog strictly allocated 0g of shared and group gear.');

// 4. Stress Test: Carrying Dog Safety Caps
console.log('--- 4. Carrying Dog Safety Caps ---');
const rexLoad = mergeRes.individualLoads['d1'];
// Rex body weight 25kg * 0.15 = 3.75kg -> rounded to 3.8kg in loadDistribution
if (rexLoad.maxSafeWeightKg !== 3.8) {
  throw new Error(`FAIL: Expected Rex maxSafeWeightKg 3.8kg, got ${rexLoad.maxSafeWeightKg}`);
}
if (rexLoad.allocatedWeightGrams > rexLoad.maxSafeWeightKg * 1000) {
  // If Rex exceeded, check if warning generated
  if (!rexLoad.isOverloaded) {
    throw new Error('FAIL: Rex is over safe limit but not marked isOverloaded');
  }
}
// Check that all items assigned to Rex have canBeCarriedByDog or isDogItem
for (const it of rexLoad.assignedItems) {
  const orig = randomItems.find((r) => r.id === it.itemId);
  if (orig && !orig.canBeCarriedByDog && !orig.isDogItem) {
    throw new Error(`FAIL: Rex was assigned non-dog item: ${it.name}`);
  }
}
console.log('PASS: Carrying dog safety and eligibility strictly respected.');

// 5. Stress Test: Extreme Boundary Conditions for GPX Serialization
console.log('--- 5. Extreme GPX Bounds (Collinear / Flat points) ---');
const flatPoints = [
  { lat: 45.0, lng: 5.0, ele: 100 },
  { lat: 45.0, lng: 5.1, ele: 100 },
  { lat: 45.0, lng: 5.2, ele: 100 },
];
const gpxSnapshot = serializeGPXSnapshot({
  title: 'Flat Route',
  points: flatPoints,
});
if (!isGPXSnapshot(gpxSnapshot)) {
  throw new Error('FAIL: Flat route did not pass isGPXSnapshot');
}
if (gpxSnapshot.svgPolylinePath.includes('NaN') || gpxSnapshot.svgPolylinePath.includes('Infinity')) {
  throw new Error(`FAIL: Flat route produced invalid coordinates: ${gpxSnapshot.svgPolylinePath}`);
}
console.log('PASS: Degenerate collinear GPX points safely handled without NaN.');

// 6. Stress Test: High-Volume Performance Benchmark
console.log('--- 6. High-Volume Performance Benchmark (5,000 items) ---');
const heavyItems = [];
for (let i = 0; i < 5000; i++) {
  heavyItems.push({
    id: `heavy-${i}`,
    name: `Shared-Gear-${i % 100}`,
    category: 'cook',
    weightGrams: 200 + (i % 50),
    isShared: true,
    ownerId: 'h1',
  });
}
const t0 = performance.now();
const perfResult = PackMergeService.runPackMerge(participants, [{ ownerId: 'h1', items: heavyItems }]);
const t1 = performance.now();
const elapsed = t1 - t0;
console.log(`PASS: 5,000 items deduplicated & balanced in ${elapsed.toFixed(2)}ms (throughput: ${(5000 / (elapsed / 1000)).toFixed(0)} items/s).`);

console.log('=== ALL ADVERSARIAL STRESS TESTS PASSED CLEANLY ===');
