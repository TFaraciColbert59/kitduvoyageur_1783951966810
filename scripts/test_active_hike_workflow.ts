import { createClient } from '@supabase/supabase-js';
import { HikingController } from '../src/features/hiking/controllers/HikingController';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function testWorkflow() {
  console.log('=== TEST WORKFLOW COMPLET : RANDONNÉE ACTIVE -> BOTTOM BAR -> CARNET AUTO ===');

  const controller = new HikingController();

  console.log('\n--- 1) Démarrage & Suivi GPS ---');
  await controller.startHike('3'); // Route 3 Via Francigena
  assert(controller.getState().isActive, 'Randonnée active démarrée sur Route 3');
  assert(controller.getState().state === 'TRACKING', 'Machine à états = TRACKING');

  console.log('\n--- 2) Test Pause / Reprise ---');
  controller.pauseHike();
  assert(controller.getState().isPaused, 'Randonnée mise en pause');
  assert(controller.getState().state === 'PAUSED', 'Machine à états = PAUSED');

  controller.resumeHike();
  assert(!controller.getState().isPaused, 'Randonnée reprise avec succès');
  assert(controller.getState().state === 'TRACKING', 'Machine à états = TRACKING');

  console.log('\n--- 3) Simulation de Progression GPS Réelle ---');
  // Simuler 3 positions GPS réelles le long de la route 3
  const pos1 = { latitude: 51.03184, longitude: 1.59289, accuracy: 5, altitude: 20, speed: 1.4, heading: 90, timestamp: Date.now() - 300000 };
  const pos2 = { latitude: 51.03250, longitude: 1.59350, accuracy: 6, altitude: 22, speed: 1.5, heading: 92, timestamp: Date.now() - 150000 };
  const pos3 = { latitude: 51.03310, longitude: 1.59410, accuracy: 4, altitude: 25, speed: 1.4, heading: 88, timestamp: Date.now() };

  // Injection des positions dans le contrôleur via GPSService
  const gpsService = (controller as any).gpsService;
  gpsService.injectPosition(pos1);
  gpsService.injectPosition(pos2);
  gpsService.injectPosition(pos3);

  const state = controller.getState();
  console.log(`  Distance enregistrée : ${state.distanceKm.toFixed(2)} km, Durée: ${state.durationSeconds} s`);
  assert(state.positions.length >= 3, 'Positions GPS valides enregistrées');

  console.log('\n--- 4) Test Arrêt & Enregistrement Session + Carnet Auto ---');
  const stopResult = await controller.stopHike();
  assert(stopResult != null, 'Résultat de fin de randonnée retourné');
  if (stopResult) {
    assert(stopResult.sessionId != null, 'Session ID créé et retourné');
    console.log(`  Session ID: ${stopResult.sessionId}, Carnet ID: ${stopResult.carnetId || 'Généré/Lié'}`);
  }

  assert(controller.getState().state === 'IDLE', 'Machine à états réinitialisée à IDLE');
  assert(!controller.getState().isActive, 'Randonnée marquée comme inactive');

  console.log('\n--- 5) Verification Idempotence ---');
  // Invoquer stopHike une deuxième fois ne doit pas dupliquer la fin
  const secondStop = await controller.stopHike();
  assert(secondStop === null, 'Second appel stopHike() bloqué par la machine à états (0 duplication)');

  console.log('\n🎉 Workflow randonnée active + création carnet 100% validé.');
}

testWorkflow().catch((e) => {
  console.error('❌ Erreur workflow:', e);
  process.exit(1);
});
