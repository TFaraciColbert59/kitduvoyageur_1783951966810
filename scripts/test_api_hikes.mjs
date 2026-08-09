async function testApiHikes() {
  console.log('=== TEST GET /api/hikes ===');
  const start = Date.now();
  try {
    const res = await fetch('http://localhost:4028/api/hikes');
    const elapsed = Date.now() - start;

    console.log(`Statut HTTP: ${res.status} (réponse en ${elapsed}ms)`);
    if (!res.ok) {
      const err = await res.text();
      console.error('Erreur API:', err);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`✅ Total randonnées retournées par l'API : ${data.length}`);
    if (data.length > 0) {
      console.log('Sample 1ère randonnée :', {
        id: data[0].id,
        name: data[0].name,
        distance_km: data[0].distance_km,
        difficulty: data[0].difficulty,
      });
    }
  } catch (e) {
    console.error('❌ Exception fetch API:', e.message);
    process.exit(1);
  }
}

testApiHikes();
