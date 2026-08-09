import assert from 'node:assert';
import { JournalEventBuilder } from '../JournalEventBuilder';
import { JournalStore } from '../JournalStore';
import { GPSPosition, POI } from '../../types';

export function runAllJournalTests(): { success: boolean; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${name}:`, err?.message || err);
    }
  }

  console.log('🧪 Executing JournalEventBuilder & JournalStore Unit Tests...');

  runTest('Create automatic START event', () => {
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, altitude: 1200, timestamp: Date.now() };
    const evt = JournalEventBuilder.createStartEvent(pos);

    assert.strictEqual(evt.type, 'START');
    assert.strictEqual(evt.isAutomatic, true);
    assert.strictEqual(evt.altitudeM, 1200);
    assert.ok(evt.title.includes('Départ'));
  });

  runTest('Create automatic SUMMIT POI event', () => {
    const pos: GPSPosition = { latitude: 45.001, longitude: 6.002, altitude: 2450, timestamp: Date.now() };
    const summitPoi: POI = {
      id: 'p-1',
      name: 'Pic du Thabor',
      category: 'peak',
      lat: 45.001,
      lon: 6.002,
      distance_m: 0,
      bearing_deg: 0,
    };

    const evt = JournalEventBuilder.createPoiEvent(pos, summitPoi, 8.4);
    assert.strictEqual(evt.type, 'SUMMIT');
    assert.ok(evt.title.includes('Pic du Thabor'));
    assert.strictEqual(evt.distanceKm, 8.4);
  });

  runTest('Create manual PHOTO media event', () => {
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    const evt = JournalEventBuilder.createMediaEvent(
      'PHOTO',
      pos,
      3.2,
      'https://storage.com/photo.jpg',
      'Vue magnifique sur la vallée'
    );

    assert.strictEqual(evt.type, 'PHOTO');
    assert.strictEqual(evt.isAutomatic, false);
    assert.strictEqual(evt.mediaUrl, 'https://storage.com/photo.jpg');
    assert.strictEqual(evt.description, 'Vue magnifique sur la vallée');
  });

  runTest('JournalStore add, update, and delete events', () => {
    const store = new JournalStore();
    const pos: GPSPosition = { latitude: 45.0, longitude: 6.0, timestamp: Date.now() };
    
    const startEvt = JournalEventBuilder.createStartEvent(pos);
    store.addEvent(startEvt);
    assert.strictEqual(store.getEvents().length, 1);

    store.updateEvent(startEvt.id, { description: 'Description modifiée' });
    assert.strictEqual(store.getEvents()[0].description, 'Description modifiée');

    store.deleteEvent(startEvt.id);
    assert.strictEqual(store.getEvents().length, 0);
  });

  const success = failed === 0;
  console.log(`🏁 Journal Test Summary: ${passed} Passed, ${failed} Failed.`);
  return { success, passed, failed };
}

// Auto-run if invoked directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('JournalEventBuilder.test')) {
  runAllJournalTests();
}
