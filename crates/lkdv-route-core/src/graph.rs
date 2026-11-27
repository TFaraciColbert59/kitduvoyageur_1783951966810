//! Compact CSR graph and domain bitflags for `lkdv-route-core`.

pub const EDGE_FLAG_WATERWAY: u32 = 1 << 0;
pub const EDGE_FLAG_FERRY: u32 = 1 << 1;
pub const EDGE_FLAG_FORD: u32 = 1 << 2;
pub const EDGE_FLAG_STEPS: u32 = 1 << 3;
pub const EDGE_FLAG_VIA_FERRATA: u32 = 1 << 4;
pub const EDGE_FLAG_EXPOSED_RIDGE: u32 = 1 << 5;
pub const EDGE_FLAG_FOREST_COVER: u32 = 1 << 6;
pub const EDGE_FLAG_LIT: u32 = 1 << 7;
pub const EDGE_FLAG_CYCLEWAY: u32 = 1 << 8;
pub const EDGE_FLAG_ROAD_TRAFFIC: u32 = 1 << 9;
pub const EDGE_FLAG_GLACIER_SNOW: u32 = 1 << 10;

pub const HAZARD_FLAG_FIRE: u32 = 1 << 0;
pub const HAZARD_FLAG_FLOOD: u32 = 1 << 1;
pub const HAZARD_FLAG_AVALANCHE_SLOPE: u32 = 1 << 2;
pub const HAZARD_FLAG_STORM_EXPOSED: u32 = 1 << 3;
pub const HAZARD_FLAG_REPORT_BLOCKED: u32 = 1 << 4;

pub const CAP_FLAG_NAUTICAL_PROVEN: u32 = 1 << 0;
pub const CAP_FLAG_VIA_FERRATA_OK: u32 = 1 << 1;
pub const CAP_FLAG_WINTER_AVALANCHE_TRAINED: u32 = 1 << 2;
pub const CAP_FLAG_HAS_CRAMPONS: u32 = 1 << 3;
pub const CAP_FLAG_HAS_HEADLAMP: u32 = 1 << 4;
pub const CAP_FLAG_HAS_RAIN_SHELL: u32 = 1 << 5;
pub const CAP_FLAG_HAS_THERMAL: u32 = 1 << 6;
pub const CAP_FLAG_HAS_EBIKE: u32 = 1 << 7;
pub const CAP_FLAG_HAS_WATER_FILTER: u32 = 1 << 8;

pub const ENV_FLAG_THUNDERSTORM: u32 = 1 << 0;
pub const ENV_FLAG_FLOOD_ALERT: u32 = 1 << 1;
pub const ENV_FLAG_NIGHT_OVERLAP: u32 = 1 << 2;

pub const SURFACE_PAVED: u32 = 0;
pub const SURFACE_GRAVEL: u32 = 1;
pub const SURFACE_DIRT_TRAIL: u32 = 2;
pub const SURFACE_GRASS_FOREST: u32 = 3;
pub const SURFACE_ROCK_SCREE: u32 = 4;
pub const SURFACE_SNOW_ICE: u32 = 5;
pub const SURFACE_WATER: u32 = 6;

pub const POI_FLAG_WATER: u32 = 1 << 0;
pub const POI_FLAG_SHELTER: u32 = 1 << 1;

#[derive(Clone, Copy, Debug)]
pub struct Node {
    pub lat: f32,
    pub lon: f32,
    pub ele_m: f32,
    pub poi_flags: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct Edge {
    pub from: u32,
    pub to: u32,
    pub length_m: f32,
    pub dplus_m: f32,
    pub dminus_m: f32,
    pub max_slope_deg: f32,
    pub surface: u32,
    pub sac_grade: u8,
    pub mtb_grade: u8,
    pub ww_grade: u8,
    pub flags: u32,
    pub hazard_flags: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct RoutingParams {
    pub mode_code: u32,
    pub priority_code: u32,
    pub mobility_code: u32,
    pub cap_flags: u32,
    pub sac_max_grade: u32,
    pub mtb_max_grade: u32,
    pub ww_max_grade: u32,
    pub avalanche_bra: u32,
    pub env_flags: u32,
    pub body_weight_kg: f32,
    pub pack_weight_kg: f32,
    pub flat_speed_kmh: f32,
    pub ascent_m_per_h: f32,
    pub speed_percentile: f32,
    pub vo2max: f32,
    pub readiness_score: f32,
    pub acclim_ceiling_m: f32,
    pub wind_kmh: f32,
    pub ridge_wind_kmh: f32,
    pub precip_mm_h: f32,
    pub snow_depth_cm: f32,
    pub freezing_level_m: f32,
    pub temp_c: f32,
}

pub struct CsrGraph {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub offsets: Vec<usize>,
    pub adj_edge_indices: Vec<usize>,
}

impl CsrGraph {
    pub fn build(nodes: Vec<Node>, edges: Vec<Edge>) -> Self {
        let n = nodes.len();
        let mut counts = vec![0usize; n];
        for e in &edges {
            let u = e.from as usize;
            if u < n && (e.to as usize) < n {
                counts[u] += 1;
            }
        }
        let mut offsets = vec![0usize; n + 1];
        for i in 0..n {
            offsets[i + 1] = offsets[i] + counts[i];
        }
        let mut adj_edge_indices = vec![0usize; offsets[n]];
        let mut cursor = offsets[..n].to_vec();
        for (idx, e) in edges.iter().enumerate() {
            let u = e.from as usize;
            if u < n && (e.to as usize) < n {
                let pos = cursor[u];
                adj_edge_indices[pos] = idx;
                cursor[u] += 1;
            }
        }
        Self {
            nodes,
            edges,
            offsets,
            adj_edge_indices,
        }
    }

    #[inline]
    pub fn outgoing(&self, u: usize) -> &[usize] {
        &self.adj_edge_indices[self.offsets[u]..self.offsets[u + 1]]
    }
}

/// Fast equirectangular distance approximation in meters for A* heuristic (admissible).
#[inline]
pub fn haversine_m(lat1: f32, lon1: f32, lat2: f32, lon2: f32) -> f64 {
    let r = 6_371_000.0_f64;
    let d_lat = ((lat2 - lat1) as f64).to_radians();
    let d_lon = ((lon2 - lon1) as f64).to_radians();
    let lat1_r = (lat1 as f64).to_radians();
    let lat2_r = (lat2 as f64).to_radians();
    let a = (d_lat * 0.5).sin().powi(2)
        + lat1_r.cos() * lat2_r.cos() * (d_lon * 0.5).sin().powi(2);
    2.0 * r * a.sqrt().min(1.0).asin()
}
