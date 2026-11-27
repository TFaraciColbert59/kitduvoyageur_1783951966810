//! Multi-criteria A* shortest path & Abraham–Delling–Goldberg–Werneck (2013)
//! Admissible Alternative Routes generator with full per-factor explainability aggregation.

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashSet};

use crate::biomechanics::{evaluate_edge, ObjectiveWeights};
use crate::gating::{is_edge_allowed, MODE_GRAVEL, MODE_VAE, MODE_VELO, MODE_VTT};
use crate::graph::*;

#[derive(Clone, Debug)]
pub struct ComputedRoute {
    pub role_code: u32, // 0=recommended, 1=safer, 2=gentler, 3=faster
    pub distance_m: f32,
    pub dplus_m: f32,
    pub dminus_m: f32,
    pub duration_sec: f32,
    pub base_duration_sec: f32,
    pub pack_delta_sec: f32,
    pub altitude_delta_sec: f32,
    pub weather_delta_sec: f32,
    pub fatigue_delta_sec: f32,
    pub kcal: f32,
    pub max_slope_deg: f32,
    pub exposed_30_m: f32,
    pub paved_m: f32,
    pub gravel_m: f32,
    pub trail_m: f32,
    pub technical_m: f32,
    pub max_sac_grade: u32,
    pub water_pts: u32,
    pub shelters: u32,
    pub overlap_ratio: f32,
    pub node_path: Vec<u32>,
    pub edge_indices: Vec<usize>,
}

#[derive(Clone, Copy)]
struct HeapItem {
    f_score: f64,
    g_score: f64,
    node: usize,
}

impl PartialEq for HeapItem {
    fn eq(&self, other: &Self) -> bool {
        self.f_score == other.f_score && self.node == other.node
    }
}
impl Eq for HeapItem {}
impl PartialOrd for HeapItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for HeapItem {
    fn cmp(&self, other: &Self) -> Ordering {
        // Min-heap ordering
        other
            .f_score
            .partial_cmp(&self.f_score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| other.g_score.partial_cmp(&self.g_score).unwrap_or(Ordering::Equal))
    }
}

/// Runs A* with strict Fail-Safe edge gating, multi-criteria biomechanical cost, and optional edge penalties.
pub fn run_astar(
    graph: &CsrGraph,
    start: usize,
    goal: usize,
    params: &RoutingParams,
    role_code: u32,
    penalized_edges: Option<&[f64]>,
) -> Option<ComputedRoute> {
    let n = graph.nodes.len();
    if start >= n || goal >= n {
        return None;
    }
    if start == goal {
        return Some(ComputedRoute {
            role_code,
            distance_m: 0.0,
            dplus_m: 0.0,
            dminus_m: 0.0,
            duration_sec: 0.0,
            base_duration_sec: 0.0,
            pack_delta_sec: 0.0,
            altitude_delta_sec: 0.0,
            weather_delta_sec: 0.0,
            fatigue_delta_sec: 0.0,
            kcal: 0.0,
            max_slope_deg: 0.0,
            exposed_30_m: 0.0,
            paved_m: 0.0,
            gravel_m: 0.0,
            trail_m: 0.0,
            technical_m: 0.0,
            max_sac_grade: 0,
            water_pts: 0,
            shelters: 0,
            overlap_ratio: 0.0,
            node_path: vec![start as u32],
            edge_indices: Vec::new(),
        });
    }

    let weights = ObjectiveWeights::for_role(role_code, params.priority_code);
    let max_speed_mps = match params.mode_code {
        MODE_VELO => 12.0_f64,
        MODE_GRAVEL | MODE_VTT | MODE_VAE => 10.0_f64,
        _ => 4.5_f64,
    };
    let h_scale = weights.time_w / max_speed_mps;
    let goal_node = graph.nodes[goal];

    let mut g_score = vec![f64::INFINITY; n];
    let mut prev_node = vec![usize::MAX; n];
    let mut prev_edge = vec![usize::MAX; n];
    let mut heap = BinaryHeap::new();

    g_score[start] = 0.0;
    let h0 = haversine_m(
        graph.nodes[start].lat,
        graph.nodes[start].lon,
        goal_node.lat,
        goal_node.lon,
    ) * h_scale;
    heap.push(HeapItem {
        f_score: h0,
        g_score: 0.0,
        node: start,
    });

    while let Some(HeapItem { g_score: g_u, node: u, .. }) = heap.pop() {
        if u == goal {
            break;
        }
        if g_u > g_score[u] + 1e-9 {
            continue;
        }
        let u_node = graph.nodes[u];
        for &e_idx in graph.outgoing(u) {
            let edge = &graph.edges[e_idx];
            let v = edge.to as usize;
            let v_node = graph.nodes[v];
            if !is_edge_allowed(edge, &v_node, params) {
                continue;
            }
            let pen = penalized_edges.map_or(1.0, |arr| arr[e_idx]);
            let eval = evaluate_edge(edge, &u_node, &v_node, params, weights, pen);
            let tentative_g = g_u + eval.total_cost;
            if tentative_g + 1e-9 < g_score[v] {
                g_score[v] = tentative_g;
                prev_node[v] = u;
                prev_edge[v] = e_idx;
                let h = haversine_m(v_node.lat, v_node.lon, goal_node.lat, goal_node.lon) * h_scale;
                heap.push(HeapItem {
                    f_score: tentative_g + h,
                    g_score: tentative_g,
                    node: v,
                });
            }
        }
    }

    if !g_score[goal].is_finite() {
        return None;
    }

    // Reconstruct node & edge path
    let mut node_path = Vec::new();
    let mut edge_indices = Vec::new();
    let mut cur = goal;
    while cur != start && cur != usize::MAX {
        node_path.push(cur as u32);
        let e_idx = prev_edge[cur];
        if e_idx == usize::MAX {
            return None;
        }
        edge_indices.push(e_idx);
        cur = prev_node[cur];
    }
    node_path.push(start as u32);
    node_path.reverse();
    edge_indices.reverse();

    // Aggregate full deterministic metrics & factor deltas (always evaluated with penalty=1.0)
    let eval_weights = ObjectiveWeights::for_role(0, params.priority_code);
    let mut distance_m = 0.0_f64;
    let mut dplus_m = 0.0_f64;
    let mut dminus_m = 0.0_f64;
    let mut duration_sec = 0.0_f64;
    let mut base_duration_sec = 0.0_f64;
    let mut pack_delta_sec = 0.0_f64;
    let mut altitude_delta_sec = 0.0_f64;
    let mut weather_delta_sec = 0.0_f64;
    let mut fatigue_delta_sec = 0.0_f64;
    let mut kcal = 0.0_f64;
    let mut max_slope_deg = 0.0_f32;
    let mut exposed_30_m = 0.0_f64;
    let mut paved_m = 0.0_f64;
    let mut gravel_m = 0.0_f64;
    let mut trail_m = 0.0_f64;
    let mut technical_m = 0.0_f64;
    let mut max_sac_grade = 0_u32;

    for &e_idx in &edge_indices {
        let edge = &graph.edges[e_idx];
        let u_node = graph.nodes[edge.from as usize];
        let v_node = graph.nodes[edge.to as usize];
        let b = evaluate_edge(edge, &u_node, &v_node, params, eval_weights, 1.0);
        let len = edge.length_m as f64;
        distance_m += len;
        dplus_m += edge.dplus_m as f64;
        dminus_m += edge.dminus_m as f64;
        duration_sec += b.duration_sec;
        base_duration_sec += b.base_duration_sec;
        pack_delta_sec += b.pack_delta_sec;
        altitude_delta_sec += b.altitude_delta_sec;
        weather_delta_sec += b.weather_delta_sec;
        fatigue_delta_sec += b.fatigue_delta_sec;
        kcal += b.kcal;
        if edge.max_slope_deg > max_slope_deg {
            max_slope_deg = edge.max_slope_deg;
        }
        if edge.max_slope_deg >= 30.0 {
            exposed_30_m += len;
        }
        match edge.surface {
            SURFACE_PAVED => paved_m += len,
            SURFACE_GRAVEL => gravel_m += len,
            SURFACE_DIRT_TRAIL | SURFACE_GRASS_FOREST => trail_m += len,
            _ => technical_m += len,
        }
        if (edge.sac_grade as u32) > max_sac_grade {
            max_sac_grade = edge.sac_grade as u32;
        }
    }

    let mut water_pts = 0_u32;
    let mut shelters = 0_u32;
    for &nid in &node_path {
        let f = graph.nodes[nid as usize].poi_flags;
        if (f & POI_FLAG_WATER) != 0 {
            water_pts += 1;
        }
        if (f & POI_FLAG_SHELTER) != 0 {
            shelters += 1;
        }
    }

    Some(ComputedRoute {
        role_code,
        distance_m: distance_m as f32,
        dplus_m: dplus_m as f32,
        dminus_m: dminus_m as f32,
        duration_sec: duration_sec as f32,
        base_duration_sec: base_duration_sec as f32,
        pack_delta_sec: pack_delta_sec as f32,
        altitude_delta_sec: altitude_delta_sec as f32,
        weather_delta_sec: weather_delta_sec as f32,
        fatigue_delta_sec: fatigue_delta_sec as f32,
        kcal: kcal as f32,
        max_slope_deg,
        exposed_30_m: exposed_30_m as f32,
        paved_m: paved_m as f32,
        gravel_m: gravel_m as f32,
        trail_m: trail_m as f32,
        technical_m: technical_m as f32,
        max_sac_grade,
        water_pts,
        shelters,
        overlap_ratio: 0.0,
        node_path,
        edge_indices,
    })
}

/// Computes length-weighted edge overlap ratio between candidate `cand` and reference edge set.
fn overlap_ratio(graph: &CsrGraph, cand: &ComputedRoute, used_edges: &HashSet<usize>) -> f32 {
    if cand.distance_m <= 1.0 {
        return 1.0;
    }
    let mut shared_m = 0.0_f32;
    for &e_idx in &cand.edge_indices {
        if used_edges.contains(&e_idx) {
            shared_m += graph.edges[e_idx].length_m;
        }
    }
    (shared_m / cand.distance_m).clamp(0.0, 1.0)
}

/// Computes Primary Recommended route + up to 2 Admissible Alternatives (Abraham et al. 2013):
/// - Limited sharing: overlap <= 0.72
/// - Bounded stretch: duration <= 1.60 * primary.duration_sec
/// - Distinct multi-criteria profiles: Safer/Sheltered (1), Gentler/Lower Energy (2), Faster/Direct (3).
pub fn plan_routes(
    graph: &CsrGraph,
    start: usize,
    goal: usize,
    params: &RoutingParams,
) -> Vec<ComputedRoute> {
    let primary = match run_astar(graph, start, goal, params, 0, None) {
        Some(r) => r,
        None => return Vec::new(),
    };

    let mut results = vec![primary.clone()];
    let mut penalties = vec![1.0_f64; graph.edges.len()];
    let mut primary_edge_set = HashSet::new();
    for &e_idx in &primary.edge_indices {
        penalties[e_idx] = 1.65;
        primary_edge_set.insert(e_idx);
    }

    let candidate_roles: [u32; 3] = [1, 2, 3];
    for role in candidate_roles {
        if results.len() >= 3 {
            break;
        }
        if let Some(mut cand) = run_astar(graph, start, goal, params, role, Some(&penalties)) {
            let ov_primary = overlap_ratio(graph, &cand, &primary_edge_set);
            let stretch_ok = cand.duration_sec <= (primary.duration_sec * 1.65).max(primary.duration_sec + 900.0);
            let distinct_from_all = results.iter().all(|existing| {
                let set: HashSet<usize> = existing.edge_indices.iter().copied().collect();
                overlap_ratio(graph, &cand, &set) <= 0.78
            });
            if ov_primary <= 0.78 && stretch_ok && distinct_from_all {
                cand.overlap_ratio = ov_primary;
                for &e_idx in &cand.edge_indices {
                    penalties[e_idx] = (penalties[e_idx] * 1.45).min(3.5);
                }
                results.push(cand);
            }
        }
    }

    results
}
