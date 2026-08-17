# Journal de Vérification et Preuves Réelles — LCP Mobile `/explorer`

**Date & Heure :** 17 août 2026  
**Branche Git :** `main`  
**Dernier Commit :** `68b4fb98e815354ab4996e94995b314f4678af27` (pushé sur GitHub)

---

## 1. Sorties brutes des commandes de contrôle initial

### Commande 1 : `grep -n "MobileHomeRedirect" src/app/page.tsx`
```powershell
Select-String -Path 'src/app/page.tsx' -Pattern 'MobileHomeRedirect'
```
**Résultat brut :**
*(Aucune occurrence trouvée — `MobileHomeRedirect` a été retiré de `src/app/page.tsx` dans le commit `68b4fb9`)*

### Commande 2 : `head -5 src/app/explorer/page.tsx`
```powershell
Get-Content -Path 'src/app/explorer/page.tsx' -TotalCount 5
```
**Résultat brut :**
```typescript
import React from 'react';
import { getTrails } from '@/lib/queries/trails';
import ExplorerClient from '@/components/explorer/ExplorerClient';

export const revalidate = 60;
```

### Commande 3 : `grep -n "dynamic\|revalidate" src/app/api/hikes/route.ts`
```powershell
Select-String -Path 'src/app/api/hikes/route.ts' -Pattern 'dynamic|revalidate'
```
**Résultat brut :**
```
src\app\api\hikes\route.ts:4:export const revalidate = 60;
src\app\api\hikes\route.ts:37:    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
```

---

## 2. Preuves de présence et contenu des fichiers créés

### Fichier 1 : `src/lib/queries/trails.ts`
Contenu complet :
```typescript
import { createClient } from '@/lib/supabase/server';
import type { MapTrail } from '@/components/explorer/types';

export interface GetTrailsOptions {
  minDist?: number;
  maxDist?: number | null;
  difficulty?: string | null;
  search?: string | null;
  includeShort?: boolean;
}

/**
 * Charge et déduplique les randonnées côté serveur ou API.
 * Surcharge les valeurs COALESCE par les tables de référence (hiking_routes, trail_metadata, trail_scores).
 */
export async function getTrails(options: GetTrailsOptions = {}): Promise<MapTrail[]> {
  const {
    minDist = 2.0,
    maxDist = null,
    difficulty = null,
    search = null,
    includeShort = false,
  } = options;

  const supabase = await createClient();

  let query = supabase
    .from('explore_trails')
    .select('id, name, start_lat, start_lng, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, ref, network, terrain_type, family_friendly, season, ai_description');

  if (!includeShort && minDist > 0) {
    query = query.gte('distance_km', minDist);
  }

  if (maxDist !== null && !isNaN(maxDist)) {
    query = query.lte('distance_km', maxDist);
  }

  if (difficulty && difficulty !== 'all') {
    query = query.ilike('difficulty', `%${difficulty}%`);
  }

  if (search && search.trim() !== '') {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  query = query.order('distance_km', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching trails:', error);
    return [];
  }

  // ── Vraies données : remplace les valeurs COALESCE de la vue par les tables réelles ──
  const [routeRes, metaRes, scoreRes] = await Promise.all([
    supabase.from('hiking_routes').select('id, name, distance_km'),
    supabase
      .from('trail_metadata')
      .select('trail_id, difficulty, duration_hours, elevation_gain, terrain_type, family_friendly, season, ai_description'),
    supabase.from('trail_scores').select('trail_id, adventure_score, nature_score, panorama_score'),
  ]);

  const routesById = new Map<number, { name: string | null; distance_km: number | null }>();
  (routeRes.data || []).forEach((r: any) => {
    routesById.set(Number(r.id), { name: r.name ?? null, distance_km: r.distance_km ?? null });
  });

  const metaByTrail = new Map<number, Record<string, unknown>>();
  (metaRes.data || []).forEach((m: any) => {
    metaByTrail.set(Number(m.trail_id), m);
  });

  const scoresByTrail = new Map<number, Record<string, unknown>>();
  (scoreRes.data || []).forEach((s: any) => {
    scoresByTrail.set(Number(s.trail_id), s);
  });

  // Deduplication logic: Keep the best/longest trail for duplicate start coordinates
  const seenStartCoords = new Set<string>();
  const deduplicated: MapTrail[] = [];

  for (const t of data || []) {
    const numericId = Number(t.id);
    const routeReal = routesById.get(numericId);
    const metaReal = metaByTrail.get(numericId);
    const scoreReal = scoresByTrail.get(numericId);

    const latKey = t.start_lat !== null && t.start_lat !== undefined ? Number(t.start_lat).toFixed(3) : 'null';
    const lngKey = t.start_lng !== null && t.start_lng !== undefined ? Number(t.start_lng).toFixed(3) : 'null';
    const coordKey = `${latKey}_${lngKey}`;

    if (coordKey !== 'null_null' && seenStartCoords.has(coordKey)) {
      continue;
    }

    if (coordKey !== 'null_null') {
      seenStartCoords.add(coordKey);
    }

    const distanceReal = routeReal?.distance_km != null ? Number(routeReal.distance_km) : (t.distance_km != null ? Number(t.distance_km) : null);
    const nameReal = routeReal?.name || t.name || `Randonnée #${t.id}`;

    deduplicated.push({
      id: String(t.id),
      name: nameReal,
      lat: t.start_lat !== undefined && t.start_lat !== null ? Number(t.start_lat) : null,
      lng: t.start_lng !== undefined && t.start_lng !== null ? Number(t.start_lng) : null,
      distance_km: distanceReal,
      duration_hours: metaReal?.duration_hours != null ? Number(metaReal.duration_hours) : (t.duration_hours != null ? Number(t.duration_hours) : null),
      difficulty: metaReal?.difficulty != null ? String(metaReal.difficulty) : (t.difficulty != null ? String(t.difficulty) : null),
      elevation_gain: metaReal?.elevation_gain != null ? Number(metaReal.elevation_gain) : (t.elevation_gain != null ? Number(t.elevation_gain) : null),
      terrain_type: metaReal?.terrain_type != null ? String(metaReal.terrain_type) : (t.terrain_type != null ? String(t.terrain_type) : null),
      family_friendly: (metaReal?.family_friendly as boolean | undefined) ?? t.family_friendly ?? null,
      season: metaReal?.season != null ? String(metaReal.season) : (t.season != null ? String(t.season) : null),
      ai_description: metaReal?.ai_description != null ? String(metaReal.ai_description) : (t.ai_description != null ? String(t.ai_description) : null),
      adventure_score: scoreReal?.adventure_score != null ? Number(scoreReal.adventure_score) : (t.adventure_score != null ? Number(t.adventure_score) : null),
      nature_score: scoreReal?.nature_score != null ? Number(scoreReal.nature_score) : (t.nature_score != null ? Number(t.nature_score) : null),
      panorama_score: scoreReal?.panorama_score != null ? Number(scoreReal.panorama_score) : (t.panorama_score != null ? Number(t.panorama_score) : null),
      geojson: null,
    });
  }

  return deduplicated;
}
```

### Fichier 2 : `src/app/explorer/page.tsx`
Contenu complet :
```typescript
import React from 'react';
import { getTrails } from '@/lib/queries/trails';
import ExplorerClient from '@/components/explorer/ExplorerClient';

export const revalidate = 60;

export default async function ExplorerPage() {
  const initialTrails = await getTrails();

  return <ExplorerClient initialTrails={initialTrails} />;
}
```

### Fichier 3 : Preuve de rendu SSR sans JS (requête HTTP brute)
Requête directe sur `http://localhost:4000/explorer` :
- **Taille HTML renvoyée au 1er octet :** `2 293 937 octets` (2,29 Mo de HTML complet)
- **Extrait des balises de titres générées côté serveur dans le HTML brut :**
  ```html
  <h3 class="font-semibold text-[#1C2620] text-sm leading-tight mb-0.5 line-clamp-2">Boucle Fagnes et Val Joly</h3>
  <h3 class="font-semibold text-[#1C2620] text-sm leading-tight mb-0.5 line-clamp-2">Boucle Forges et Etangs</h3>
  <h3 class="font-semibold text-[#1C2620] text-sm leading-tight mb-0.5 line-clamp-2">Boucle Val de Sambre et Maroilles</h3>
  <h3 class="font-semibold text-[#1C2620] text-sm leading-tight mb-0.5 line-clamp-2">Boucle du Pays Solesmois</h3>
  <h3 class="font-semibold text-[#1C2620] text-sm leading-tight mb-0.5 line-clamp-2">Via Francigena France 02, Arras - Reims</h3>
  ```
