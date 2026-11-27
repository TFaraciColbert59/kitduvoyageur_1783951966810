//! Peer-reviewed biomechanical, physiological & environmental edge cost models.
//!
//! Incorporates:
//! - Minetti et al. (2002), J. Appl. Physiol.: 5th-order metabolic cost of slope (-45%..+45%)
//! - Looney et al. (2019), Med. Sci. Sports Exerc. (LCDA) & Weyand et al. (2021): load & terrain eta
//! - Campbell, Dennison & Thompson (2022), Applied Geography: Lorentzian percentile speed curve
//! - Vecchiato, Borasio & Savino (2026), Eur. Heart J. Digital Health (MOVE): pack O2 & altitude hypoxia
//! - Schmudlach & Eisenhut (ISSW 2024) & Undheim et al. (ISSW 2026): slope/avalanche/forest exposure

use crate::gating::*;
use crate::graph::*;

#[derive(Clone, Copy, Debug, Default)]
pub struct EdgeCostBreakdown {
    pub total_cost: f64,
    pub duration_sec: f64,
    pub base_duration_sec: f64,
    pub pack_delta_sec: f64,
    pub altitude_delta_sec: f64,
    pub weather_delta_sec: f64,
    pub fatigue_delta_sec: f64,
    pub kcal: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct ObjectiveWeights {
    pub time_w: f64,
    pub energy_w: f64,
    pub safety_w: f64,
    pub comfort_w: f64,
}

impl ObjectiveWeights {
    pub fn for_role(role: u32, user_priority: u32) -> Self {
        match role {
            // 1 = Safer / Sheltered
            1 => Self {
                time_w: 0.70,
                energy_w: 0.25,
                safety_w: 3.40,
                comfort_w: 0.65,
            },
            // 2 = Gentler / Lower metabolic load & D+
            2 => Self {
                time_w: 0.65,
                energy_w: 2.30,
                safety_w: 1.15,
                comfort_w: 1.25,
            },
            // 3 = Faster / Direct
            3 => Self {
                time_w: 1.45,
                energy_w: 0.15,
                safety_w: 0.60,
                comfort_w: 0.10,
            },
            // 0 = Recommended (adapts to user_orientation.priority)
            _ => match user_priority {
                1 => Self {
                    time_w: 0.85,
                    energy_w: 0.45,
                    safety_w: 2.20,
                    comfort_w: 0.55,
                },
                2 => Self {
                    time_w: 0.85,
                    energy_w: 1.45,
                    safety_w: 1.10,
                    comfort_w: 0.90,
                },
                3 => Self {
                    time_w: 1.25,
                    energy_w: 0.35,
                    safety_w: 0.90,
                    comfort_w: 0.20,
                },
                _ => Self {
                    time_w: 1.00,
                    energy_w: 0.65,
                    safety_w: 1.35,
                    comfort_w: 0.45,
                },
            },
        }
    }
}

/// Minetti et al. (2002) walking energy cost in J / (kg * m) for fractional slope `i` in [-0.45, 0.45].
#[inline]
pub fn minetti_walk_j_kg_m(grade: f64) -> f64 {
    let i = grade.clamp(-0.45, 0.45);
    let i2 = i * i;
    let i3 = i2 * i;
    let i4 = i2 * i2;
    let i5 = i4 * i;
    (280.5 * i5 - 58.7 * i4 - 76.8 * i3 + 51.9 * i2 + 19.6 * i + 2.5).max(0.8)
}

/// Minetti et al. (2002) running energy cost in J / (kg * m).
#[inline]
pub fn minetti_run_j_kg_m(grade: f64) -> f64 {
    let i = grade.clamp(-0.45, 0.45);
    let i2 = i * i;
    let i3 = i2 * i;
    let i4 = i2 * i2;
    let i5 = i4 * i;
    (155.4 * i5 - 30.4 * i4 - 43.3 * i3 + 46.3 * i2 + 19.5 * i + 3.6).max(1.7)
}

/// Looney (2019) / Weyand (2021) terrain surface metabolic factor `eta`.
#[inline]
pub fn surface_eta(surface: u32) -> f64 {
    match surface {
        SURFACE_PAVED => 1.00,
        SURFACE_DIRT_TRAIL => 1.12,
        SURFACE_GRAVEL => 1.16,
        SURFACE_GRASS_FOREST => 1.18,
        SURFACE_ROCK_SCREE => 1.50,
        SURFACE_SNOW_ICE => 1.85,
        SURFACE_WATER => 1.10,
        _ => 1.15,
    }
}

/// Campbell, Dennison & Thompson (2022) Lorentzian slope-travel-rate speed (m/s),
/// scaled by user's calibrated flat speed & percentile (2.5..97.5).
#[inline]
pub fn campbell_walk_speed_mps(grade_deg: f64, flat_speed_kmh: f64, percentile: f64) -> f64 {
    // 50th percentile Lorentzian peak is ~1.15 m/s at -1.53 deg, FWHM ~28 deg
    let shifted = grade_deg + 1.53;
    let lorentz = 1.0 / (1.0 + (shifted / 16.5).powi(2));
    // Calibrate around user's real flat speed (and gentle percentile tilt)
    let p_factor = 0.86 + (percentile.clamp(5.0, 95.0) / 100.0) * 0.28;
    let flat_mps = (flat_speed_kmh.clamp(2.2, 7.5) / 3.6) * (0.5 + 0.5 * p_factor);
    let steep_down_brake = if grade_deg < -12.0 {
        1.0 / (1.0 + ((-grade_deg - 12.0) * 0.035))
    } else {
        1.0
    };
    (flat_mps * (0.28 + 0.72 * lorentz) * steep_down_brake).max(0.22)
}

/// Evaluates full physical duration, energy expenditure & multi-criteria cost for an edge.
pub fn evaluate_edge(
    edge: &Edge,
    from_node: &Node,
    to_node: &Node,
    p: &RoutingParams,
    weights: ObjectiveWeights,
    edge_penalty: f64,
) -> EdgeCostBreakdown {
    let dist_m = (edge.length_m as f64).max(1.0);
    let dplus = (edge.dplus_m as f64).max(0.0);
    let dminus = (edge.dminus_m as f64).max(0.0);
    let net_grade = (dplus - dminus) / dist_m;
    let grade_deg = net_grade.atan().to_degrees();
    let mean_ele = ((from_node.ele_m + to_node.ele_m) * 0.5) as f64;
    let eta = surface_eta(edge.surface);

    // 1. Mode-specific base speed (m/s)
    let base_speed_mps = match p.mode_code {
        MODE_TRAIL => campbell_walk_speed_mps(grade_deg, p.flat_speed_kmh as f64 * 1.48, p.speed_percentile as f64),
        MODE_VELO => {
            let flat = 6.4_f64; // ~23 km/h
            if net_grade > 0.01 {
                (flat / (1.0 + net_grade * 18.0)).max(1.5)
            } else {
                (flat * (1.0 + (-net_grade).min(0.08) * 4.0)).min(11.5)
            }
        }
        MODE_GRAVEL => {
            let flat = 5.4_f64 / eta.sqrt();
            if net_grade > 0.01 {
                (flat / (1.0 + net_grade * 19.0)).max(1.3)
            } else {
                (flat * (1.0 + (-net_grade).min(0.08) * 3.0)).min(9.5)
            }
        }
        MODE_VTT => {
            let flat = 4.4_f64 / eta.sqrt();
            if net_grade > 0.01 {
                (flat / (1.0 + net_grade * 20.0)).max(1.1)
            } else {
                (flat * (1.0 + (-net_grade).min(0.10) * 2.5)).min(8.5)
            }
        }
        MODE_VAE => {
            let flat = 5.8_f64 / eta.sqrt();
            if net_grade > 0.01 {
                (flat / (1.0 + net_grade * 9.5)).max(2.6)
            } else {
                (flat * 1.15).min(9.0)
            }
        }
        MODE_SKI => {
            if net_grade > 0.02 {
                // Uphill skinning governed by user VAM
                let vam_mps = (p.ascent_m_per_h as f64).clamp(220.0, 1100.0) / 3600.0;
                (vam_mps / net_grade.max(0.03)).clamp(0.45, 1.35)
            } else if net_grade < -0.04 {
                4.2 // Controlled backcountry descent
            } else {
                1.3
            }
        }
        MODE_RAQUETTES => campbell_walk_speed_mps(grade_deg, p.flat_speed_kmh as f64 * 0.78, p.speed_percentile as f64),
        MODE_KAYAK => 1.55, // ~5.6 km/h calm water average
        _ => {
            // Rando: blend Campbell (2022) with surface eta & technical grade slowdown
            let tech_mult = match edge.sac_grade {
                0 | 1 => 1.00,
                2 => 0.94,
                3 => 0.84,
                4 => 0.74,
                5 => 0.64,
                _ => 0.56,
            };
            (campbell_walk_speed_mps(grade_deg, p.flat_speed_kmh as f64, p.speed_percentile as f64)
                / eta.powf(0.45))
                * tech_mult
        }
    };

    let base_duration_sec = dist_m / base_speed_mps.max(0.2);

    // 2. Pack weight slowdown (MOVE 2026: ~+20% O2 cost per +10% body weight -> ~12% pace impact per 10% load on uphill)
    let body_kg = (p.body_weight_kg as f64).clamp(35.0, 180.0);
    let pack_kg = (p.pack_weight_kg as f64).clamp(0.0, 35.0);
    let load_ratio = pack_kg / body_kg;
    let uphill_amp = if net_grade > 0.02 { 1.35 } else { 0.65 };
    let pack_mult = if matches!(p.mode_code, MODE_VELO | MODE_VAE | MODE_KAYAK) {
        1.0 + load_ratio * 0.35
    } else {
        1.0 + load_ratio * 1.15 * uphill_amp
    };
    let pack_delta_sec = base_duration_sec * (pack_mult - 1.0);

    // 3. Altitude hypoxia slowdown (MOVE 2026: -1% aerobic capacity / 100 m above 1500 m, attenuated by acclimatization)
    let effective_alt_m = (mean_ele - (p.acclim_ceiling_m as f64).max(1500.0)).max(0.0);
    let alt_slowdown = (effective_alt_m / 100.0) * 0.011;
    let altitude_delta_sec = base_duration_sec * alt_slowdown;

    // 4. Weather & ridge wind slowdown (Pugh wind drag + rain/cold slip)
    let exposed_ridge = (edge.flags & EDGE_FLAG_EXPOSED_RIDGE) != 0;
    let forest_cover = (edge.flags & EDGE_FLAG_FOREST_COVER) != 0;
    let local_wind = if exposed_ridge {
        p.ridge_wind_kmh as f64
    } else if forest_cover {
        (p.wind_kmh as f64) * 0.45
    } else {
        p.wind_kmh as f64
    };
    let wind_slowdown = if local_wind > 25.0 {
        ((local_wind - 25.0) * 0.006).min(0.45)
    } else {
        0.0
    };
    let precip_slowdown = if (p.precip_mm_h as f64) > 0.5 {
        let no_shell = if (p.cap_flags & CAP_FLAG_HAS_RAIN_SHELL) == 0 {
            1.45
        } else {
            1.0
        };
        ((p.precip_mm_h as f64).min(12.0) * 0.015 * no_shell).min(0.28)
    } else {
        0.0
    };
    let weather_delta_sec = base_duration_sec * (wind_slowdown + precip_slowdown);

    // 5. Fatigue / Readiness slowdown (ACWR + DOMS when readiness < 65)
    let fatigue_slowdown = if p.readiness_score >= 0.0 && p.readiness_score < 65.0 {
        ((65.0 - p.readiness_score as f64) / 65.0) * 0.22
    } else {
        0.0
    };
    let fatigue_delta_sec = base_duration_sec * fatigue_slowdown;

    let duration_sec =
        base_duration_sec + pack_delta_sec + altitude_delta_sec + weather_delta_sec + fatigue_delta_sec;

    // 6. Metabolic energy expenditure (Minetti 2002 + LCDA load & terrain eta)
    let j_kg_m = if p.mode_code == MODE_TRAIL {
        minetti_run_j_kg_m(net_grade)
    } else {
        minetti_walk_j_kg_m(net_grade)
    };
    let total_mass = body_kg + pack_kg;
    let mode_energy_scale = match p.mode_code {
        MODE_VELO | MODE_GRAVEL => 0.34,
        MODE_VTT => 0.46,
        MODE_VAE => 0.22,
        MODE_KAYAK => 0.55,
        _ => 1.0,
    };
    let kcal = (j_kg_m * eta * total_mass * dist_m * mode_energy_scale) / 4184.0;

    // 7. Safety & Comfort risk penalty (translated into equivalent seconds for multi-criteria A*)
    let mut safety_risk_sec = 0.0_f64;
    if (p.env_flags & ENV_FLAG_THUNDERSTORM) != 0 && exposed_ridge {
        safety_risk_sec += dist_m * 1.4; // Strongly divert off ridges under storm risk
    }
    if local_wind > 40.0 && exposed_ridge {
        safety_risk_sec += dist_m * 0.55;
    }
    if (edge.max_slope_deg as f64) >= 30.0 {
        safety_risk_sec += dist_m * (0.25 + (p.avalanche_bra as f64) * 0.30);
    }
    if (edge.flags & EDGE_FLAG_ROAD_TRAFFIC) != 0 && matches!(p.mode_code, MODE_RANDO | MODE_TRAIL) {
        safety_risk_sec += dist_m * 0.35; // Prefer dedicated paths over traffic roads
    }
    if (edge.flags & EDGE_FLAG_FORD) != 0 {
        safety_risk_sec += 180.0; // Prefer bridges over stream fords
    }
    if forest_cover && ((p.precip_mm_h as f64) > 1.0 || local_wind > 30.0 || p.temp_c > 28.0) {
        // Mild shelter bonus in wind/rain/heat (bounded so cost stays strictly positive)
        safety_risk_sec -= (dist_m * 0.08).min(duration_sec * 0.15);
    }

    let comfort_penalty_sec = if edge.surface == SURFACE_ROCK_SCREE {
        dist_m * 0.18
    } else if (edge.flags & EDGE_FLAG_STEPS) != 0 {
        dist_m * 0.12
    } else {
        0.0
    };

    // Normalized multi-criteria objective cost (strictly positive for A* optimality)
    let energy_equiv_sec = kcal * 9.5;
    let raw_cost = weights.time_w * duration_sec
        + weights.energy_w * energy_equiv_sec
        + weights.safety_w * safety_risk_sec
        + weights.comfort_w * comfort_penalty_sec;

    let min_admissible_cost = dist_m / 18.0; // Never below heuristic floor
    let total_cost = (raw_cost.max(min_admissible_cost)) * edge_penalty.max(1.0);

    EdgeCostBreakdown {
        total_cost,
        duration_sec,
        base_duration_sec,
        pack_delta_sec,
        altitude_delta_sec,
        weather_delta_sec,
        fatigue_delta_sec,
        kcal,
    }
}
