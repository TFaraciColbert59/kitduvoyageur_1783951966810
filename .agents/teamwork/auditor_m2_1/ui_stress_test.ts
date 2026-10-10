import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GPXLiveCard } from '../../../src/features/messaging/components/GPXLiveCard';
import { KitLiveCard } from '../../../src/features/messaging/components/KitLiveCard';
import { PackMergeSheet } from '../../../src/features/messaging/components/PackMergeSheet';
import { EquipmentLiveCard } from '../../../src/features/messaging/components/EquipmentLiveCard';
import { ExpeditionLiveCard } from '../../../src/features/messaging/components/ExpeditionLiveCard';

console.log('=== STARTING ADVERSARIAL UI COMPONENT STRESS TESTS ===');

// 1. GPXLiveCard with negative/zero duration and strange characters
const gpxEdge = {
  type: 'gpx_snapshot' as const,
  title: '<script>alert("xss")</script> & Mont Blanc',
  distanceKm: 0,
  elevationGainM: 0,
  estimatedDurationMinutes: 0,
  svgPolylinePath: '0,0 240,80',
  bounds: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
};
const gpxHtml = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpxEdge }));
if (!gpxHtml.includes('--')) {
  throw new Error('FAIL: Expected duration 0 to display "--"');
}
if (gpxHtml.includes('<script>')) {
  throw new Error('FAIL: React failed to escape raw script tag in title');
}
console.log('PASS: GPXLiveCard edge cases and XSS escaping verified.');

// 2. KitLiveCard with 0 items, 0 weight
const kitEdge = {
  type: 'kit_snapshot' as const,
  kitId: 'kit-empty',
  title: '',
  totalWeightGrams: 0,
  itemCount: 0,
  categories: [],
};
const kitHtml = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: kitEdge }));
if (!kitHtml.includes('0 g') || !kitHtml.includes('0 objets')) {
  throw new Error('FAIL: KitLiveCard empty state failed to render');
}
console.log('PASS: KitLiveCard empty state verified.');

// 3. PackMergeSheet with undefined result and open=false
const sheetClosed = renderToStaticMarkup(React.createElement(PackMergeSheet, { open: false }));
if (sheetClosed !== '') {
  throw new Error('FAIL: Closed PackMergeSheet rendered unexpected markup');
}
const sheetOpenEmpty = renderToStaticMarkup(React.createElement(PackMergeSheet, { open: true }));
if (!sheetOpenEmpty.includes('Pack Merge')) {
  throw new Error('FAIL: Open PackMergeSheet failed to render default header');
}
console.log('PASS: PackMergeSheet toggle states verified.');

// 4. EquipmentLiveCard with missing brand/photo
const eqEdge = {
  type: 'equipment_snapshot' as const,
  equipmentId: 'eq-bare',
  name: 'Simple Carabiner',
  category: 'safety',
  weightGrams: 45,
};
const eqHtml = renderToStaticMarkup(React.createElement(EquipmentLiveCard, { snapshot: eqEdge }));
if (!eqHtml.includes('45 g') || !eqHtml.includes('Simple Carabiner')) {
  throw new Error('FAIL: Bare equipment item failed to render');
}
console.log('PASS: EquipmentLiveCard bare item verified.');

// 5. ExpeditionLiveCard with 0 members and unknown status
const expEdge = {
  type: 'expedition_snapshot' as const,
  expeditionId: 'exp-empty',
  title: 'Solo Trip',
  status: 'planning' as const,
  participantCount: 0,
};
const expHtml = renderToStaticMarkup(React.createElement(ExpeditionLiveCard, { snapshot: expEdge }));
if (!expHtml.includes('0 membres') || !expHtml.includes('Solo Trip')) {
  throw new Error('FAIL: Bare expedition card failed to render');
}
console.log('PASS: ExpeditionLiveCard bare trip verified.');

console.log('=== ALL UI COMPONENT STRESS TESTS PASSED CLEANLY ===');
