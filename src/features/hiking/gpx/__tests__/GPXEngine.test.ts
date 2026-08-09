import { GPXEngine } from '../GPXEngine';
import { GPSPosition, Waypoint } from '../../types';

function runTests() {
  console.log('🧪 Executing GPXEngine Unit Tests...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✕ ${name}`);
      failed++;
    }
  }

  // Test 1: Export GPX
  const mockPositions: GPSPosition[] = [
    { latitude: 45.2833, longitude: 5.8667, altitude: 1200, timestamp: 1723190400000 },
    { latitude: 45.2840, longitude: 5.8675, altitude: 1240, timestamp: 1723190700000 },
  ];
  const mockWaypoints: Waypoint[] = [
    { id: 'w1', name: 'Refuge du Habert', lat: 45.2840, lon: 5.8675, elevationM: 1240 },
  ];

  const gpxString = GPXEngine.exportGPX(mockPositions, mockWaypoints, 'Randonnée Test Chartreuse');

  assert(gpxString.includes('<gpx version="1.1"'), 'Generate valid GPX 1.1 header');
  assert(gpxString.includes('<name>Randonnée Test Chartreuse</name>'), 'Include hike title in metadata');
  assert(gpxString.includes('<wpt lat="45.284" lon="5.8675">'), 'Include waypoint node');
  assert(gpxString.includes('<trkpt lat="45.2833" lon="5.8667">'), 'Include track point nodes');

  // Summary
  console.log(`🏁 GPX Test Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
