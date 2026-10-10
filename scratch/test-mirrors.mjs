const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const q = '[out:json][timeout:10];(relation["type"="route"]["route"~"^(hiking|foot)$"](45.91,6.85,45.94,6.89););out tags center 5;';

for (const ep of endpoints) {
  const start = Date.now();
  try {
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        'User-Agent': 'LeKitDuVoyageur/1.0 (https://lekitduvoyageur.com)',
      },
      body: new URLSearchParams({ data: q }),
    });
    const text = await res.text();
    const duration = Date.now() - start;
    console.log(`[${ep}] status=${res.status} duration=${duration}ms preview=${text.slice(0, 100)}`);
  } catch (err) {
    console.log(`[${ep}] ERROR: ${err.message}`);
  }
}
