/**
 * LKDV — Mon Matériel : tests unitaires du domaine.
 * Convention du dépôt : node:assert + runner léger, exécution via `npx tsx`.
 *   npx tsx src/features/mon-materiel/test/domain.test.ts
 */

import assert from 'node:assert';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';

import { evaluateGearAlerts, prioritizeAlerts } from '../domain/gear-alerts';
import { computeGearAvailability, buildAvailabilitySlots } from '../domain/gear-availability';
import { getGearStatus } from '../domain/gear-status';
import { evaluateKitCompleteness, findSubstitutes, kitTotalWeight, countKitItemStock } from '../domain/gear-completeness';
import { evaluateDepartureReadiness, buildDepartureChecklist, buildDepartureSnapshot } from '../domain/departure-readiness';
import { buildReceptionGear, hasDuplicate, toOrderedProductItem, destinationSummary } from '../domain/order-reception';
import { gearDestinationSchema, orderedProductItemSchema, newHikeFormSchema, safeParse } from '../domain/validation';

export function runAllMonMaterielDomainTests(): { success: boolean; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${name}:`, err?.message || err);
    }
  }

  /// ── Helpers ────────────────────────────────────────────────────────────────
  const gear = (over: Partial<UserEquipmentItem> = {}): UserEquipmentItem => ({
    id: 'g1',
    user_id: 'u1',
    name: 'Lampe frontale',
    category: 'Éclairage',
    weight_g: 85,
    condition: 'bon',
    ...over,
  });

  const kit = (over: Partial<CustomKit> = {}): CustomKit => ({
    id: 'k1',
    user_id: 'u1',
    name: 'Kit Test',
    description: '',
    for_destination: '',
    season: 'Été',
    activity: 'Trek',
    total_weight_g: 0,
    source: 'manuel',
    status: 'active',
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [],
    ...over,
  });

  const hike = (over: Partial<PlannedHike> = {}): PlannedHike => ({
    id: 'h1',
    name: 'Sortie test',
    distanceKm: 12,
    elevationGain: 500,
    difficulty: 'Moyen',
    isOvernight: false,
    targetDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    ...over,
  });

  const now = new Date('2026-08-19T12:00:00Z');

  /// ── Alertes ────────────────────────────────────────────────────────────────
  runTest('maintenance due → alerte critique + badge', () => {
    const alerts = evaluateGearAlerts(
      gear({ next_maintenance_date: '2026-08-01' }),
      { now }
    );
    assert.ok(alerts.some((a) => a.kind === 'maintenance_due' && a.severity === 'critical'));
  });

  runTest('péremption → alerte critique', () => {
    const alerts = evaluateGearAlerts(gear({ expiry_date: '2026-07-01' }), { now });
    assert.ok(alerts.some((a) => a.kind === 'expired' && a.severity === 'critical'));
  });

  runTest('prêt actif → alerte warning + statut prêté', () => {
    const alerts = evaluateGearAlerts(
      gear({ loan_status: 'prêté', loan_to_name: 'Léna', expiry_date: null }),
      { now }
    );
    assert.ok(alerts.some((a) => a.kind === 'loan_active'));
    const status = getGearStatus(gear({ loan_status: 'prêté', loan_to_name: 'Léna' }), { now });
    assert.ok(status.loan.active);
    assert.strictEqual(status.availability, 'on_loan');
  });

  runTest('conflit départ : réservé et prêté → critique', () => {
    const g = gear({ id: 'g1', name: 'Sac', loan_status: 'prêté', loan_to_name: 'Max' });
    const alerts = evaluateGearAlerts(g, {
      now,
      hikeCommittedGearIds: ['g1'],
      activeDeparture: { id: 'h1', name: 'Sortie test', targetDate: '2026-08-25' },
    });
    assert.ok(alerts.some((a) => a.kind === 'departure_conflict' && a.severity === 'critical'));
  });

  runTest('priorisation : critique avant warning', () => {
    const sorted = prioritizeAlerts([
      { kind: 'loan_active', gearId: 'a', label: 'Prêt', detail: '', severity: 'warning', actionKey: 'nudge' },
      { kind: 'expired', gearId: 'b', label: 'Périmé', detail: '', severity: 'critical', actionKey: 'replace' },
    ]);
    assert.strictEqual(sorted[0].kind, 'expired');
  });

  /// ── Statut cumulatif ───────────────────────────────────────────────────────
  runTest('getGearStatus cumule badges (prêt + engagé + en commande)', () => {
    const status = getGearStatus(
      gear({ loan_status: 'prêté', loan_to_name: 'Léna', source: 'achat' }),
      {
        now,
        hikeCommittedGearIds: ['g1'],
        activeDeparture: { id: 'h1', name: 'Sortie test', targetDate: '2026-08-25' },
        orderedItems: [
          {
            orderId: 'o1',
            orderItemId: 'oi1',
            productId: 'p1',
            name: 'Lampe frontale',
            quantity: 1,
            status: 'pending',
          },
        ],
      }
    );
    assert.strictEqual(status.loan.active, true);
    assert.strictEqual(status.engagement.committedToDeparture, true);
    assert.strictEqual(status.onOrder, true);
    const labels = status.badges.map((b) => b.label);
    assert.ok(labels.some((l) => l.includes('Prêté')));
    assert.ok(labels.some((l) => l.includes('Engagé')));
  });

  /// ── Disponibilité ──────────────────────────────────────────────────────────
  runTest('disponible si aucun blocage', () => {
    const av = computeGearAvailability(gear(), { now });
    assert.strictEqual(av.available, true);
    assert.strictEqual(av.blocks.length, 0);
  });

  runTest('prêté → indisponible, raisonPrêté', () => {
    const av = computeGearAvailability(gear({ loan_status: 'prêté', loan_to_name: 'Léna' }), { now });
    assert.strictEqual(av.available, false);
    assert.strictEqual(av.primaryReason, 'on_loan');
  });

  runTest('timeline contient les blocs prêt + départ', () => {
    const slots = buildAvailabilitySlots(
      gear({ id: 'g1', loan_status: 'prêté', loan_to_name: 'Léna' }),
      {
        now,
        hikeCommittedGearIds: ['g1'],
        activeDeparture: { id: 'h1', name: 'Sortie test', targetDate: '2026-08-25' },
      }
    );
    assert.ok(slots.some((s) => s.reason === 'on_loan'));
    assert.ok(slots.some((s) => s.reason === 'departure'));
  });

  /// ── Complétude de kit ──────────────────────────────────────────────────────
  runTest('kit complet (objets possédés disponibles)', () => {
    const k = kit({
      items: [
        { id: 'i1', kit_id: 'k1', gear_item_id: 'g1', item_name: 'Lampe frontale', category: 'Éclairage', weight_g: 85, quantity: 1, is_essential: true, is_checked: false },
        { id: 'i2', kit_id: 'k1', gear_item_id: 'g2', item_name: 'Sac 40L', category: 'Portage', weight_g: 1420, quantity: 1, is_essential: true, is_checked: false },
      ],
      total_weight_g: 1505,
    });
    const equipment: UserEquipmentItem[] = [
      gear({ id: 'g1', name: 'Lampe frontale', category: 'Éclairage' }),
      gear({ id: 'g2', name: 'Sac 40L', category: 'Portage', weight_g: 1420 }),
    ];
    const c = evaluateKitCompleteness(k, equipment, { now });
    assert.strictEqual(c.ownedCount, 2);
    assert.strictEqual(c.availableCount, 2);
    assert.strictEqual(c.missingCount, 0);
    assert.strictEqual(c.completenessPct, 100);
  });

  runTest('kit manquant : objet absent de l’inventaire', () => {
    const k = kit({
      items: [
        { id: 'i1', kit_id: 'k1', item_name: 'Sans → absent', category: 'Autre', weight_g: 10, quantity: 1, is_essential: true, is_checked: false },
      ],
    });
    const c = evaluateKitCompleteness(k, [gear()], { now });
    assert.strictEqual(c.missingCount, 1);
    assert.strictEqual(c.ownedCount, 0);
  });

  runTest('kit : objet possédé mais prêté → indisponible', () => {
    const k = kit({
      items: [
        { id: 'i1', kit_id: 'k1', gear_item_id: 'g1', item_name: 'Lampe frontale', category: 'Éclairage', weight_g: 85, quantity: 1, is_essential: true, is_checked: false },
      ],
    });
    const c = evaluateKitCompleteness(k, [gear({ id: 'g1', loan_status: 'prêté', loan_to_name: 'Léna' })], { now });
    assert.strictEqual(c.availableCount, 0);
    assert.strictEqual(c.unavailableCount, 1);
  });

  runTest('substituts trouvés par catégorie', () => {
    const subs = findSubstitutes(
      { id: 'i1', kit_id: 'k1', item_name: 'Tente', category: 'Couchage', weight_g: 1700, quantity: 1, is_essential: true, is_checked: false },
      [
        gear({ id: 'a', name: 'Tente X', category: 'Couchage & Tentes', weight_g: 1800 }),
        gear({ id: 'b', name: 'Réchaud', category: 'Cuisine', weight_g: 73 }),
        gear({ id: 'c', name: 'Tente vélo', category: 'Couchage', weight_g: 900, condition: 'à_remplacer' }),
      ]
    );
    assert.strictEqual(subs.length, 1);
    assert.strictEqual(subs[0].id, 'a');
  });

  runTest('poids de kit recalculé si colonne absente', () => {
    const k = kit({
      total_weight_g: 0,
      items: [
        { id: 'i1', kit_id: 'k1', item_name: 'Sac', category: 'Portage', weight_g: 1000, quantity: 2, is_essential: true, is_checked: false },
      ],
    });
    assert.strictEqual(kitTotalWeight(k), 2000);
  });

  /// ── Préparation départ ─────────────────────────────────────────────────────
  runTest('départ : aucun kit → to_check mais pas bloqué', () => {
    const r = evaluateDepartureReadiness(hike(), null, [gear()], []);
    assert.ok(['to_check', 'ready'].includes(r.status));
  });

  runTest('départ : article manquant au kit → bloqué', () => {
    const k = kit({
      items: [
        { id: 'i1', kit_id: 'k1', item_name: 'Absent', category: 'Autre', weight_g: 10, quantity: 1, is_essential: true, is_checked: false },
      ],
    });
    const r = evaluateDepartureReadiness(hike(), k, [gear()], []);
    assert.strictEqual(r.status, 'blocked');
    assert.strictEqual(r.blockers.length, 1);
    assert.strictEqual(r.blockers[0].kind, 'missing');
  });

  runTest('checklist : règles génériques + données kit', () => {
    const k = kit({
      items: [
        { id: 'i1', kit_id: 'k1', item_name: 'Absent', category: 'Autre', weight_g: 10, quantity: 1, is_essential: true, is_checked: false },
      ],
    });
    const checklist = buildDepartureChecklist(hike({ isOvernight: true, nightsCount: 1 }), k, [gear()]);
    assert.ok(checklist.some((c) => c.category === 'Documents'));
    assert.ok(checklist.some((c) => c.category === 'Kit Kit Test'));
    assert.ok(checklist.some((c) => c.level === 'critique'));
  });

  runTest('snapshot de préparation', () => {
    const snap = buildDepartureSnapshot(hike(), null, [gear()], ['id1']);
    assert.ok(snap.id);
    assert.ok(snap.createdAt);
    assert.strictEqual(snap.departureName, 'Sortie test');
    assert.ok(Array.isArray(snap.checklistCheckedIds));
  });

  /// ── Commande → réception ───────────────────────────────────────────────────
  runTest('receptionGear : source achat + produit lié', () => {
    const ordered = toOrderedProductItem({
      id: 'oi1',
      order_id: 'o1',
      product_id: 'p1',
      product_slug: 'lampe-petzl',
      product_name: 'Lampe Petzl',
      product_brand: 'Petzl',
      quantity: 2,
      unit_price_eur: 49,
    }, 'paid');
    const g = buildReceptionGear(ordered, null);
    assert.strictEqual(g.name, 'Lampe Petzl');
    assert.strictEqual(g.source, 'achat');
    assert.strictEqual(g.quantity, 2);
    assert.strictEqual(g.condition, 'neuf');
  });

  runTest('doublon détecté par nom', () => {
    const owned = gear({ id: 'x', name: 'Lampe Petzl' });
    assert.strictEqual(hasDuplicate({ name: 'Lampe Petzl', id: 'p1' }, [owned]), true);
    assert.strictEqual(hasDuplicate({ name: 'Autre objet', id: 'p2' }, [owned]), false);
  });

  runTest('destination summary', () => {
    assert.strictEqual(destinationSummary({ type: 'kit', refId: 'k1', label: 'Kit Test' }), 'Rattachement au kit « Kit Test » à confirmer');
    assert.strictEqual(destinationSummary(undefined), undefined);
  });

  runTest('stock checklist : quantité requise vs disponible', () => {
    const item = (over: Partial<CustomKit['items'][number]> = {}): CustomKit['items'][number] => ({
      id: 'i1', kit_id: 'k1', gear_item_id: 'g1', item_name: 'Lampe frontale', category: 'Éclairage', weight_g: 85,
      quantity: 2, is_essential: true, is_checked: false, ...over,
    });
    // Requis 2, possédé 2 disponibles → 2/2
    const inStock = countKitItemStock(item(), [gear({ id: 'g1', name: 'Lampe frontale', quantity: 2 })]);
    assert.deepStrictEqual(inStock, { available: 2, required: 2, total: 2 });
    // Aucun objet → 0 stock
    const none = countKitItemStock(item({ gear_item_id: undefined, item_name: 'Objet absent' }), []);
    assert.deepStrictEqual(none, { available: 0, required: 2, total: 0 });
    // Possédé mais en prêt → disponible 0, total > 0
    const lent = countKitItemStock(
      item(),
      [gear({ id: 'g1', name: 'Lampe frontale', loan_status: 'prêté', loan_to_name: 'Ana', quantity: 1 })]
    );
    assert.deepStrictEqual(lent, { available: 0, required: 2, total: 1 });
  });

  runTest('stock checklist : nomenclature catalogue vs inventaire', () => {
    const item = { id: 'i2', kit_id: 'k1', item_name: 'Tente 2 places', category: 'Abri', weight_g: 1800, quantity: 1, is_essential: true, is_checked: false } as CustomKit['items'][number];
    const stock = countKitItemStock(item, [gear({ id: 'g2', name: 'Tente 2 places', quantity: 3 })]);
    assert.deepStrictEqual(stock, { available: 3, required: 1, total: 3 });
  });

  /// ── Validation Zod (T3) ───────────────────────────────────────────────────
  runTest('Zod : newHikeFormSchema valide une saisie correcte', () => {
    const valid = safeParse(newHikeFormSchema, {
      name: 'Tour du Mont-Blanc',
      terrainMassif: 'Alpes',
      days: 7,
      distanceKm: 170,
      elevationGain: 10000,
      companions: 'Marc, Sophie',
    });
    assert.strictEqual(valid.ok, true);
  });

  runTest('Zod : newHikeFormSchema rejette un nom trop court ou des jours ≤ 0', () => {
    const shortName = safeParse(newHikeFormSchema, {
      name: 'X',
      days: 3,
      distanceKm: 20,
      elevationGain: 500,
    });
    assert.strictEqual(shortName.ok, false);
    assert.ok(shortName.error.includes('Nom de sortie requis'));

    const badDays = safeParse(newHikeFormSchema, {
      name: 'Sortie',
      days: 0,
      distanceKm: 20,
      elevationGain: 500,
    });
    assert.strictEqual(badDays.ok, false);
    assert.ok(badDays.error.includes('Durée ≥ 1 jour'));
  });

  runTest('Zod : gearDestinationSchema valide les types autorisés', () => {
    const kitDest = safeParse(gearDestinationSchema, {
      type: 'kit',
      refId: 'k1',
      label: 'Kit Bivouac',
    });
    assert.strictEqual(kitDest.ok, true);

    const invDest = safeParse(gearDestinationSchema, {
      type: 'inventory',
    });
    assert.strictEqual(invDest.ok, true);

    const invalidType = safeParse(gearDestinationSchema, {
      type: 'unknown',
    });
    assert.strictEqual(invalidType.ok, false);
  });

  runTest('Zod : orderedProductItemSchema valide les commandes reçues', () => {
    const valid = safeParse(orderedProductItemSchema, {
      orderId: 'o123',
      orderItemId: 'oi456',
      name: 'Sac de couchage',
      quantity: 1,
      status: 'paid',
    });
    assert.strictEqual(valid.ok, true);

    const invalidQty = safeParse(orderedProductItemSchema, {
      orderId: 'o123',
      orderItemId: 'oi456',
      name: 'Sac de couchage',
      quantity: 0,
      status: 'paid',
    });
    assert.strictEqual(invalidQty.ok, false);
    assert.ok(invalidQty.error.includes('Quantité ≥ 1'));
  });

  /// ── Bilan ──────────────────────────────────────────────────────────────────
  const success = failed === 0;
  console.log(`🏁 Mon Matériel — Domain Tests: ${passed} passed, ${failed} failed.`);
  return { success, passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('domain.test')) {
  const result = runAllMonMaterielDomainTests();
  process.exit(result.success ? 0 : 1);
}