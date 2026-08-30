# Task 1 Brief — GeoJSON local pour CountryGlobe

## Context
Tu travailles sur le shell mobile de **Le Kit du Voyageur** (Next.js 15 + React 19 + TypeScript + Tailwind CSS).

**Bug #1 confirmé :** `CountryGlobe.tsx` charge le GeoJSON Natural Earth depuis `raw.githubusercontent.com` (ligne 53 + useEffect lignes 98-103). Ce fetch externe bloque souvent sur mobile → écran figé "Chargement des pays…" indéfiniment.

## Fichiers à modifier

- **Create :** `public/data/countries-110m.geojson` — télécharger depuis GitHub, committer dans le repo
- **Modify :** `src/components/pays/CountryGlobe.tsx`

## Étapes exactes

### Step 1 — Télécharger le GeoJSON

```powershell
New-Item -ItemType Directory -Force -Path "public/data"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson" -OutFile "public/data/countries-110m.geojson"
```

Vérifier que le fichier existe et contient `"type":"FeatureCollection"`.

### Step 2 — Modifier CountryGlobe.tsx

Dans [`src/components/pays/CountryGlobe.tsx`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/components/pays/CountryGlobe.tsx) :

**2a. Remplacer la constante ligne 53 :**
```tsx
// SUPPRIMER cette ligne :
const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// AJOUTER à la place :
const GEOJSON_LOCAL = '/data/countries-110m.geojson';
```

**2b. Ajouter l'état `geoError` avec les autres useState (après ligne 70, là où `geoLoaded` est déclaré) :**
```tsx
const [geoError, setGeoError] = useState(false);
```

**2c. Remplacer le useEffect de fetch (lignes 98-103) par ce bloc complet :**
```tsx
// ── Load GeoJSON — source locale Next.js, timeout 4 s, état d'erreur explicite ──
useEffect(() => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  fetch(GEOJSON_LOCAL, { signal: controller.signal })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      setGeoFeatures(data.features || []);
      setGeoLoaded(true);
    })
    .catch(err => {
      if (err.name !== 'AbortError') console.error('[CountryGlobe] GeoJSON load failed:', err);
      setGeoError(true);
      setGeoLoaded(true); // sortir du spinner même en cas d'erreur
    })
    .finally(() => clearTimeout(timer));
  return () => { controller.abort(); clearTimeout(timer); };
}, []);
```

**2d. Remplacer le bloc de rendu du spinner (lignes 279-303) par ce bloc :**
```tsx
{/* Spinner pendant le chargement du GeoJSON */}
{!geoLoaded && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      background: 'transparent',
      zIndex: 5,
      pointerEvents: 'none',
    }}
  >
    <div
      className="w-8 h-8 rounded-full border-[3px] border-[#17402C] border-t-transparent animate-spin"
      style={{ animationDuration: '0.8s' }}
    />
    <span style={{ fontSize: 11, fontFamily: 'var(--lkv-font-mono, monospace)', fontWeight: 700, color: '#17402C', letterSpacing: '0.06em' }}>
      Chargement des pays…
    </span>
  </div>
)}

{/* État d'erreur explicite (jamais un spinner infini) */}
{geoLoaded && geoError && geoFeatures.length === 0 && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      zIndex: 5,
      pointerEvents: 'none',
    }}
  >
    <span style={{ fontSize: 13, color: '#A8443A', fontWeight: 700 }}>⚠ Impossible de charger la carte</span>
    <span style={{ fontSize: 11, color: '#5A7064' }}>Vérifiez votre connexion et rechargez la page.</span>
  </div>
)}
```

### Step 3 — Vérification

```powershell
# 1. Confirmer que l'URL externe est supprimée
Select-String -Path "src/components/pays/CountryGlobe.tsx" -Pattern "githubusercontent.com"
# Attendu : aucun résultat

# 2. TypeScript
npx tsc --noEmit
# Attendu : 0 erreur

# 3. Lint
npm run lint
# Attendu : passe (0 erreur bloquante)
```

### Step 4 — Commit

```powershell
git add public/data/countries-110m.geojson
git add src/components/pays/CountryGlobe.tsx
git commit -m "fix(globe): serve GeoJSON from /public, add 4s AbortController timeout + error state"
```

## Contraintes globales

- TypeScript strict — `tsc --noEmit` doit passer sans nouvelle erreur
- `npm run lint` doit passer sans nouvelle erreur
- Ne pas modifier d'autres fichiers
- Ne pas dispatcher de sous-agents

## Rapport attendu

Écrire le rapport dans `.superpowers/sdd/implementation_plan/task-1-report.md` avec :
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Commits créés (hash courts)
- Résultat de `Select-String -Path "src/components/pays/CountryGlobe.tsx" -Pattern "githubusercontent.com"` (doit être vide)
- Résultat de `tsc --noEmit` (doit être 0 erreur)
- Tout concern éventuel
