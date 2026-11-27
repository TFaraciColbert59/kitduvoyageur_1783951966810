//! Strict Silent Fail-Safe Edge Gating (`is_edge_allowed`).
//!
//! Guarantees that unproven locomotion modes, waterways, ferries, alpine T4-T6 trails,
//! via ferratas, steep winter avalanche slopes, high-grade MTB singletracks, active fires,
//! and steps (for PMR) are hard-excluded before A* even considers them.

use crate::graph::*;

pub const MODE_RANDO: u32 = 0;
pub const MODE_TRAIL: u32 = 1;
pub const MODE_VELO: u32 = 2;
pub const MODE_GRAVEL: u32 = 3;
pub const MODE_VTT: u32 = 4;
pub const MODE_VAE: u32 = 5;
pub const MODE_SKI: u32 = 6;
pub const MODE_RAQUETTES: u32 = 7;
pub const MODE_KAYAK: u32 = 8;

#[inline]
pub fn is_edge_allowed(edge: &Edge, to_node: &Node, p: &RoutingParams) -> bool {
    // 1. Hard environmental safety vetoes: active wildfires or explicitly blocked terrain reports
    if (edge.hazard_flags & HAZARD_FLAG_FIRE) != 0 {
        return false;
    }
    if (edge.hazard_flags & HAZARD_FLAG_REPORT_BLOCKED) != 0 {
        return false;
    }

    let is_waterway = (edge.flags & EDGE_FLAG_WATERWAY) != 0 || edge.surface == SURFACE_WATER;
    let is_ferry = (edge.flags & EDGE_FLAG_FERRY) != 0;
    let is_ford = (edge.flags & EDGE_FLAG_FORD) != 0;
    let is_steps = (edge.flags & EDGE_FLAG_STEPS) != 0;
    let is_via_ferrata = (edge.flags & EDGE_FLAG_VIA_FERRATA) != 0;
    let is_glacier = (edge.flags & EDGE_FLAG_GLACIER_SNOW) != 0;

    // 2. Nautical / Waterway strict gating: NEVER route through a river/lake unless kayak mode + proven craft+PFD
    if is_waterway {
        if p.mode_code != MODE_KAYAK {
            return false;
        }
        if (p.cap_flags & CAP_FLAG_NAUTICAL_PROVEN) == 0 {
            return false;
        }
        if (p.env_flags & ENV_FLAG_FLOOD_ALERT) != 0 || (edge.hazard_flags & HAZARD_FLAG_FLOOD) != 0 {
            return false;
        }
        if (edge.ww_grade as u32) > p.ww_max_grade {
            return false;
        }
        return true;
    }

    // Kayak mode only traverses water edges or short portage connectors (surface != traffic road)
    if p.mode_code == MODE_KAYAK && (edge.flags & EDGE_FLAG_ROAD_TRAFFIC) != 0 {
        return false;
    }

    // 3. Ferries blocked by default on autonomous outdoor routes
    if is_ferry {
        return false;
    }

    // 4. Fords blocked during active flood alerts or for PMR / family profiles
    if is_ford {
        if (p.env_flags & ENV_FLAG_FLOOD_ALERT) != 0
            || (edge.hazard_flags & HAZARD_FLAG_FLOOD) != 0
            || p.mobility_code == 3
            || p.mobility_code == 1
        {
            return false;
        }
    }

    // 5. Via ferrata strictly requires explicit practice + harness/helmet
    if is_via_ferrata && (p.cap_flags & CAP_FLAG_VIA_FERRATA_OK) == 0 {
        return false;
    }

    // 6. Glacier / permanent snow strictly requires crampons/ice axe
    if is_glacier && (p.cap_flags & CAP_FLAG_HAS_CRAMPONS) == 0 {
        return false;
    }

    // 7. PMR strict mobility rules: zero steps, zero > 8 deg slope, paved/gravel only
    if p.mobility_code == 3 {
        if is_steps || edge.max_slope_deg > 8.5 {
            return false;
        }
        if edge.surface != SURFACE_PAVED && edge.surface != SURFACE_GRAVEL {
            return false;
        }
        if edge.sac_grade > 1 {
            return false;
        }
    }

    // 8. SAC hiking technical grade limit (for foot/trail/snowshoes/ski)
    if matches!(
        p.mode_code,
        MODE_RANDO | MODE_TRAIL | MODE_SKI | MODE_RAQUETTES
    ) {
        if (edge.sac_grade as u32) > p.sac_max_grade {
            return false;
        }
    }

    // 9. Cycling / Gravel / MTB / E-bike strict gating
    if matches!(p.mode_code, MODE_VELO | MODE_GRAVEL | MODE_VTT | MODE_VAE) {
        if is_steps || is_via_ferrata || edge.mtb_grade == 255 {
            return false;
        }
        if p.mode_code == MODE_VELO
            && edge.surface != SURFACE_PAVED
            && (edge.flags & EDGE_FLAG_CYCLEWAY) == 0
        {
            return false;
        }
        if p.mode_code == MODE_GRAVEL
            && matches!(edge.surface, SURFACE_ROCK_SCREE | SURFACE_SNOW_ICE)
        {
            return false;
        }
        if (edge.mtb_grade as u32) > p.mtb_max_grade {
            return false;
        }
    }

    // 10. Winter avalanche slope (>30 deg) strict gating when snowpack or freezing level active (ISSW 2024/2026)
    let snowy_terrain = p.snow_depth_cm >= 15.0
        || (p.freezing_level_m > 0.0 && to_node.ele_m >= p.freezing_level_m && p.precip_mm_h > 0.1)
        || (edge.hazard_flags & HAZARD_FLAG_AVALANCHE_SLOPE) != 0;
    if snowy_terrain && edge.max_slope_deg >= 30.0 {
        let avy_ok = (p.cap_flags & CAP_FLAG_WINTER_AVALANCHE_TRAINED) != 0;
        if !avy_ok || p.avalanche_bra >= 4 {
            return false;
        }
    }

    true
}
