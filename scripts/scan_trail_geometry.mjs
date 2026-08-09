// Scan geometry + start coords de explore_trails pour trouver les NaN/invalides (lecture seule)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function coordDims(c) {
  if (!Array.isArray(c)) return 'NOTARRAY';
  const first = c[0];
  if (typeof first === 'number') return c.length;
  return 'depth';
}

function walk(coords, cb) {
  if (!Array.isArray(coords)) return;
  const first = coords[0];
  if (typeof first === 'number') {
    cb(coords);
    return;
  }
  for (const c of coords) walk(c, cb);
}

async function main() {
  const PAGE = 1000;
  let from = 0;
  let rows = [];
  while (true) {
    const { data, error } = await supabase
      .from('explore_trails')
      .select('id, name, start_lat, start_lng, bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng, distance_km, duration_hours, difficulty, elevation_gain, geometry')
      .range(from, from + PAGE - 1);
    if (error) { console.log('ERR', error.code, error.message); break; }
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log('total rows:', rows.length);

  let badStart = 0, badBBox = 0, badGeom = 0, missingGeom = 0, dimsReport = {};
  const badStartList = [];
  const badGeomList = [];

  for (const r of rows) {
    // start
    const slat = r.start_lat, slng = r.start_lng;
    const startOk = slat != null && slng != null && Number.isFinite(Number(slat)) && Number.isFinite(Number(slng)) &&
      Number(slat) >= -90 && Number(slat) <= 90 && Number(slng) >= -180 && Number(slng) <= 180;
    if (!startOk) { badStart++; if (badStartList.length < 30) badStartList.push({ id: r.id, name: r.name, slat, slng }); }

    // bbox
    const b = [r.bbox_min_lat, r.bbox_min_lng, r.bbox_max_lat, r.bbox_max_lng];
    const bboxOk = b.every((v) => v != null && Number.isFinite(Number(v)));
    if (!bboxOk) badBBox++;

    // geometry
    let g = r.geometry;
    if (g == null) { missingGeom++; continue; }
    if (typeof g === 'string') { try { g = JSON.parse(g); } catch { badGeom++; badGeomList.push({ id: r.id, name: r.name, reason: 'JSON parse fail' }); continue; } }
    if (g.type !== 'MultiLineString' && g.type !== 'LineString') { badGeom++; badGeomList.push({ id: r.id, name: r.name, reason: 'type ' + g.type }); continue; }

    const lineCounts = [];
    const lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates];
    let geoBad = false;
    for (const line of lines) {
      if (!Array.isArray(line)) { geoBad = true; break; }
      let pts = 0;
      for (const pt of line) {
        pts++;
        if (!Array.isArray(pt) || pt.length < 2) { geoBad = true; break; }
        const lng = Number(pt[0]), lat = Number(pt[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) { geoBad = true; break; }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { geoBad = true; break; }
      }
      lineCounts.push(pts);
    }
    if (geoBad) { badGeom++; if (badGeomList.length < 30) badGeomList.push({ id: r.id, name: r.name, reason: 'invalid coord', lineCounts }); }
  }

  console.log('\n=== RÉSULTATS ===');
  console.log('start coords invalides:', badStart);
  console.log('bbox invalide:', badBBox);
  console.log('geometry invalide:', badGeom);
  console.log('geometry absente:', missingGeom);
  if (badStartList.length) { console.log('\nExemples start invalide:'); badStartList.forEach((x) => console.log(' ', JSON.stringify(x))); }
  if (badGeomList.length) { console.log('\nExemples geometry invalide:'); badGeomList.forEach((x) => console.log(' ', JSON.stringify(x))); }
  if (!badStart && !badBBox && !badGeom && !missingGeom) console.log('\n✅ TOUTES les données de explore_trails sont valides.');
}

main();