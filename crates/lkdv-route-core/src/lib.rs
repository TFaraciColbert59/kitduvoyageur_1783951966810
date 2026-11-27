//! Zero-dependency WASM binary ABI + exhaustive unit & oracle tests for `lkdv-route-core`.

pub mod astar;
pub mod biomechanics;
pub mod gating;
pub mod graph;

use astar::{plan_routes, ComputedRoute};
use graph::{CsrGraph, Edge, Node, RoutingParams};

const INPUT_MAGIC: u32 = 0x5644_4B4C; // "LKDV"
const OUTPUT_MAGIC: u32 = 0x524B_444C; // "LDKR"

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }
    fn read_u32(&mut self) -> Option<u32> {
        if self.pos + 4 > self.buf.len() {
            return None;
        }
        let v = u32::from_le_bytes(self.buf[self.pos..self.pos + 4].try_into().ok()?);
        self.pos += 4;
        Some(v)
    }
    fn read_f32(&mut self) -> Option<f32> {
        Some(f32::from_bits(self.read_u32()?))
    }
}

fn push_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn push_f32(out: &mut Vec<u8>, v: f32) {
    out.extend_from_slice(&v.to_bits().to_le_bytes());
}

fn encode_error(status: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(12);
    push_u32(&mut out, OUTPUT_MAGIC);
    push_u32(&mut out, status);
    push_u32(&mut out, 0);
    out
}

fn encode_routes(routes: &[ComputedRoute]) -> Vec<u8> {
    let mut out = Vec::with_capacity(256 + routes.len() * 128);
    push_u32(&mut out, OUTPUT_MAGIC);
    push_u32(&mut out, if routes.is_empty() { 1 } else { 0 });
    push_u32(&mut out, routes.len() as u32);
    for r in routes {
        push_u32(&mut out, r.role_code);
        push_f32(&mut out, r.distance_m);
        push_f32(&mut out, r.dplus_m);
        push_f32(&mut out, r.dminus_m);
        push_f32(&mut out, r.duration_sec);
        push_f32(&mut out, r.base_duration_sec);
        push_f32(&mut out, r.pack_delta_sec);
        push_f32(&mut out, r.altitude_delta_sec);
        push_f32(&mut out, r.weather_delta_sec);
        push_f32(&mut out, r.fatigue_delta_sec);
        push_f32(&mut out, r.kcal);
        push_f32(&mut out, r.max_slope_deg);
        push_f32(&mut out, r.exposed_30_m);
        push_f32(&mut out, r.paved_m);
        push_f32(&mut out, r.gravel_m);
        push_f32(&mut out, r.trail_m);
        push_f32(&mut out, r.technical_m);
        push_u32(&mut out, r.max_sac_grade);
        push_u32(&mut out, r.water_pts);
        push_u32(&mut out, r.shelters);
        push_f32(&mut out, r.overlap_ratio);
        push_u32(&mut out, r.node_path.len() as u32);
        for &nid in &r.node_path {
            push_u32(&mut out, nid);
        }
    }
    out
}

pub fn solve_binary_request(input: &[u8]) -> Vec<u8> {
    let mut rd = Reader::new(input);
    let magic = match rd.read_u32() {
        Some(v) if v == INPUT_MAGIC => v,
        _ => return encode_error(2),
    };
    let _ = magic;
    let version = match rd.read_u32() {
        Some(1) => 1,
        _ => return encode_error(2),
    };
    let _ = version;

    let (node_count, edge_count, start_node, goal_node) = match (
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
    ) {
        (Some(n), Some(e), Some(s), Some(g)) => (n as usize, e as usize, s as usize, g as usize),
        _ => return encode_error(2),
    };

    if node_count == 0 || node_count > 120_000 || edge_count > 400_000 {
        return encode_error(2);
    }

    let params = match (
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_u32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
        rd.read_f32(),
    ) {
        (
            Some(mode_code),
            Some(priority_code),
            Some(mobility_code),
            Some(cap_flags),
            Some(sac_max_grade),
            Some(mtb_max_grade),
            Some(ww_max_grade),
            Some(avalanche_bra),
            Some(env_flags),
            Some(body_weight_kg),
            Some(pack_weight_kg),
            Some(flat_speed_kmh),
            Some(ascent_m_per_h),
            Some(speed_percentile),
            Some(vo2max),
            Some(readiness_score),
            Some(acclim_ceiling_m),
            Some(wind_kmh),
            Some(ridge_wind_kmh),
            Some(precip_mm_h),
            Some(snow_depth_cm),
            Some(freezing_level_m),
            Some(temp_c),
        ) => RoutingParams {
            mode_code,
            priority_code,
            mobility_code,
            cap_flags,
            sac_max_grade,
            mtb_max_grade,
            ww_max_grade,
            avalanche_bra,
            env_flags,
            body_weight_kg,
            pack_weight_kg,
            flat_speed_kmh,
            ascent_m_per_h,
            speed_percentile,
            vo2max,
            readiness_score,
            acclim_ceiling_m,
            wind_kmh,
            ridge_wind_kmh,
            precip_mm_h,
            snow_depth_cm,
            freezing_level_m,
            temp_c,
        },
        _ => return encode_error(2),
    };

    let mut nodes = Vec::with_capacity(node_count);
    for _ in 0..node_count {
        match (rd.read_f32(), rd.read_f32(), rd.read_f32(), rd.read_u32()) {
            (Some(lat), Some(lon), Some(ele_m), Some(poi_flags)) => {
                nodes.push(Node {
                    lat,
                    lon,
                    ele_m,
                    poi_flags,
                });
            }
            _ => return encode_error(2),
        }
    }

    let mut edges = Vec::with_capacity(edge_count);
    for _ in 0..edge_count {
        match (
            rd.read_u32(),
            rd.read_u32(),
            rd.read_f32(),
            rd.read_f32(),
            rd.read_f32(),
            rd.read_f32(),
            rd.read_u32(),
            rd.read_u32(),
            rd.read_u32(),
        ) {
            (
                Some(from),
                Some(to),
                Some(length_m),
                Some(dplus_m),
                Some(dminus_m),
                Some(max_slope_deg),
                Some(surface),
                Some(grades_packed),
                Some(flags_packed),
            ) => {
                edges.push(Edge {
                    from,
                    to,
                    length_m,
                    dplus_m,
                    dminus_m,
                    max_slope_deg,
                    surface,
                    sac_grade: (grades_packed & 0xFF) as u8,
                    mtb_grade: ((grades_packed >> 8) & 0xFF) as u8,
                    ww_grade: ((grades_packed >> 16) & 0xFF) as u8,
                    flags: flags_packed & 0xFFFF,
                    hazard_flags: (flags_packed >> 16) & 0xFFFF,
                });
            }
            _ => return encode_error(2),
        }
    }

    let graph = CsrGraph::build(nodes, edges);
    let routes = plan_routes(&graph, start_node, goal_node, &params);
    encode_routes(&routes)
}

// ── Plain extern "C" WASM ABI (zero wasm-bindgen glue needed) ────────────────

static mut LAST_OUTPUT: Vec<u8> = Vec::new();

#[no_mangle]
pub extern "C" fn lkdv_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn lkdv_dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        let _ = Vec::from_raw_parts(ptr, 0, len);
    }
}

#[no_mangle]
pub unsafe extern "C" fn lkdv_plan_routes(input_ptr: *const u8, input_len: usize) -> u32 {
    if input_ptr.is_null() || input_len == 0 {
        let err = encode_error(2);
        let len = err.len() as u32;
        LAST_OUTPUT = err;
        return len;
    }
    let slice = std::slice::from_raw_parts(input_ptr, input_len);
    let out = solve_binary_request(slice);
    let len = out.len() as u32;
    LAST_OUTPUT = out;
    len
}

#[no_mangle]
pub unsafe extern "C" fn lkdv_output_ptr() -> *const u8 {
    (*std::ptr::addr_of!(LAST_OUTPUT)).as_ptr()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gating::*;
    use crate::graph::*;

    fn base_params() -> RoutingParams {
        RoutingParams {
            mode_code: MODE_RANDO,
            priority_code: 0,
            mobility_code: 0,
            cap_flags: 0,
            sac_max_grade: 2,
            mtb_max_grade: 0,
            ww_max_grade: 0,
            avalanche_bra: 2,
            env_flags: 0,
            body_weight_kg: 72.0,
            pack_weight_kg: 6.0,
            flat_speed_kmh: 4.3,
            ascent_m_per_h: 360.0,
            speed_percentile: 50.0,
            vo2max: 46.0,
            readiness_score: 75.0,
            acclim_ceiling_m: 1500.0,
            wind_kmh: 15.0,
            ridge_wind_kmh: 25.0,
            precip_mm_h: 0.0,
            snow_depth_cm: 0.0,
            freezing_level_m: 3200.0,
            temp_c: 14.0,
        }
    }

    fn make_edge(from: u32, to: u32, length_m: f32, dplus_m: f32) -> Edge {
        Edge {
            from,
            to,
            length_m,
            dplus_m,
            dminus_m: 0.0,
            max_slope_deg: ((dplus_m / length_m.max(1.0)).atan().to_degrees()).abs(),
            surface: SURFACE_DIRT_TRAIL,
            sac_grade: 2,
            mtb_grade: 1,
            ww_grade: 0,
            flags: 0,
            hazard_flags: 0,
        }
    }

    #[test]
    fn fail_safe_blocks_waterway_without_nautical_capability() {
        let nodes = vec![
            Node { lat: 45.920, lon: 6.860, ele_m: 1030.0, poi_flags: 0 },
            Node { lat: 45.925, lon: 6.865, ele_m: 1035.0, poi_flags: 0 },
            Node { lat: 45.930, lon: 6.870, ele_m: 1040.0, poi_flags: 0 },
        ];
        // Direct shortcut 0 -> 2 is a river (waterway), detour 0 -> 1 -> 2 is a trail
        let mut river = make_edge(0, 2, 400.0, 0.0);
        river.surface = SURFACE_WATER;
        river.flags = EDGE_FLAG_WATERWAY;
        river.ww_grade = 1;

        let e01 = make_edge(0, 1, 700.0, 10.0);
        let e12 = make_edge(1, 2, 700.0, 10.0);
        let graph = CsrGraph::build(nodes, vec![river, e01, e12]);

        let params = base_params();
        let routes = plan_routes(&graph, 0, 2, &params);
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].node_path, vec![0, 1, 2]);
    }

    #[test]
    fn fail_safe_blocks_t4_alpine_and_via_ferrata_and_avalanche_slopes() {
        let nodes = vec![
            Node { lat: 45.920, lon: 6.860, ele_m: 2000.0, poi_flags: 0 },
            Node { lat: 45.925, lon: 6.865, ele_m: 2450.0, poi_flags: 1 },
            Node { lat: 45.930, lon: 6.870, ele_m: 2600.0, poi_flags: 2 },
        ];
        let mut alpine_t5 = make_edge(0, 2, 800.0, 600.0);
        alpine_t5.sac_grade = 5;
        let mut via_f = make_edge(0, 2, 750.0, 600.0);
        via_f.flags = EDGE_FLAG_VIA_FERRATA;
        let mut avy_slope = make_edge(0, 2, 900.0, 600.0);
        avy_slope.max_slope_deg = 36.0;
        avy_slope.hazard_flags = HAZARD_FLAG_AVALANCHE_SLOPE;

        let safe1 = make_edge(0, 1, 1400.0, 450.0);
        let safe2 = make_edge(1, 2, 900.0, 150.0);

        let graph = CsrGraph::build(nodes, vec![alpine_t5, via_f, avy_slope, safe1, safe2]);
        let mut params = base_params();
        params.snow_depth_cm = 40.0;

        let routes = plan_routes(&graph, 0, 2, &params);
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].node_path, vec![0, 1, 2]);
        assert_eq!(routes[0].water_pts, 1);
        assert_eq!(routes[0].shelters, 1);
    }

    #[test]
    fn generates_distinct_admissible_alternatives_and_nonzero_factor_deltas() {
        // Diamond with 3 distinct paths: direct exposed steep ridge, sheltered forest valley, gentle paved road
        let nodes = vec![
            Node { lat: 45.920, lon: 6.860, ele_m: 1600.0, poi_flags: 0 }, // 0 start
            Node { lat: 45.925, lon: 6.862, ele_m: 2300.0, poi_flags: 0 }, // 1 steep ridge
            Node { lat: 45.925, lon: 6.870, ele_m: 1950.0, poi_flags: 1 }, // 2 sheltered forest
            Node { lat: 45.924, lon: 6.876, ele_m: 1750.0, poi_flags: 2 }, // 3 gentle valley
            Node { lat: 45.932, lon: 6.868, ele_m: 2150.0, poi_flags: 0 }, // 4 goal
        ];

        let mut r1 = make_edge(0, 1, 1500.0, 700.0);
        r1.flags = EDGE_FLAG_EXPOSED_RIDGE;
        let mut r2 = make_edge(1, 4, 1400.0, 0.0);
        r2.dminus_m = 150.0;
        r2.flags = EDGE_FLAG_EXPOSED_RIDGE;

        let mut f1 = make_edge(0, 2, 1900.0, 350.0);
        f1.flags = EDGE_FLAG_FOREST_COVER;
        let mut f2 = make_edge(2, 4, 1700.0, 200.0);
        f2.flags = EDGE_FLAG_FOREST_COVER;

        let mut g1 = make_edge(0, 3, 2100.0, 150.0);
        g1.surface = SURFACE_GRAVEL;
        let mut g2 = make_edge(3, 4, 2100.0, 400.0);
        g2.surface = SURFACE_GRAVEL;

        let graph = CsrGraph::build(nodes, vec![r1, r2, f1, f2, g1, g2]);
        let mut params = base_params();
        params.pack_weight_kg = 10.0;
        params.ridge_wind_kmh = 48.0;
        params.readiness_score = 52.0;

        let routes = plan_routes(&graph, 0, 4, &params);
        assert!(routes.len() >= 2, "expected recommended + at least 1 distinct alternative");
        assert!(routes[0].pack_delta_sec > 0.0);
        assert!(routes[0].altitude_delta_sec > 0.0);
        assert!(routes[0].fatigue_delta_sec > 0.0);
        assert!(routes[0].kcal > 100.0);
        assert!(routes[1].overlap_ratio <= 0.78);
    }

    #[test]
    fn pmr_blocks_steps_and_steep_dirt() {
        let nodes = vec![
            Node { lat: 45.920, lon: 6.860, ele_m: 1030.0, poi_flags: 0 },
            Node { lat: 45.921, lon: 6.862, ele_m: 1035.0, poi_flags: 0 },
            Node { lat: 45.922, lon: 6.864, ele_m: 1040.0, poi_flags: 0 },
        ];
        let mut steps = make_edge(0, 2, 200.0, 10.0);
        steps.flags = EDGE_FLAG_STEPS;
        steps.surface = SURFACE_PAVED;
        steps.sac_grade = 1;

        let mut ramp1 = make_edge(0, 1, 300.0, 5.0);
        ramp1.surface = SURFACE_PAVED;
        ramp1.sac_grade = 1;
        let mut ramp2 = make_edge(1, 2, 300.0, 5.0);
        ramp2.surface = SURFACE_PAVED;
        ramp2.sac_grade = 1;

        let graph = CsrGraph::build(nodes, vec![steps, ramp1, ramp2]);
        let mut params = base_params();
        params.mobility_code = 3; // PMR
        params.sac_max_grade = 1;

        let routes = plan_routes(&graph, 0, 2, &params);
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].node_path, vec![0, 1, 2]);
    }
}
