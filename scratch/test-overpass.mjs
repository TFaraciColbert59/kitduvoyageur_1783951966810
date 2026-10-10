const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: {
    'User-Agent': 'LeKitDuVoyageur/1.0 (https://lekitduvoyageur.com)',
  },
  body: new URLSearchParams({
    data: '[out:json][timeout:10];(relation["type"="route"]["route"~"^(hiking|foot)$"](45.91,6.85,45.94,6.89););out tags center 5;',
  }),
});

console.log('STATUS:', res.status, res.statusText);
const text = await res.text();
console.log('BODY LENGTH:', text.length);
console.log('PREVIEW:', text.slice(0, 300));
