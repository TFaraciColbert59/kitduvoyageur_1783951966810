/**
 * LKDV research-only deterministic model. No application or database access.
 * Run: node docs/research/2026-10-25-recompenses-lkdv/simulate-economy.mjs
 * Every input below is a scenario assumption, never an observed LKDV metric.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const weeksPerMonth = 52 / 12;
const startDate = '2026-10-25';
const profiles = [
  { id: 'occasionnel', weight: 0.70, likes: 7, activities: 0.25, shares: 0.25, help: 0.25, preparation: 0.25 },
  { id: 'actif', weight: 0.25, likes: 35, activities: 2, shares: 1.5, help: 1, preparation: 2 },
  { id: 'tres_actif', weight: 0.04, likes: 70, activities: 3, shares: 2, help: 2, preparation: 3 },
  { id: 'fraude_qui_passe_les_controles', weight: 0.01, likes: 3500, activities: 20, shares: 20, help: 20, preparation: 20 },
];

function brief(p) {
  // Share x3 means 50 base +100 bonus =150 total, NOT 50 +150.
  return p.likes * 5 + p.activities * 50 + Math.min(p.shares, p.activities) * 100;
}
function cappedBrief(p) {
  // 10 rewarded likes/day assumed spread across seven days; total cap500/week.
  return Math.min(500, Math.min(p.likes, 70) * 5 + p.activities * 50 + Math.min(p.shares, p.activities) * 100);
}
function useful(p) {
  // Proposed illustrative counts, subject to validation and funding.
  return Math.min(250,
    Math.min(p.activities, 3) * 50
    + Math.min(p.shares, p.activities, 2) * 25
    + Math.min(p.help, 2) * 25
    + Math.min(p.preparation, 1) * 10);
}

const schemes = [
  { id: 'A_brief_sans_plafond_15000', lampPoints: 15000, earn: brief, unitScale: 1 },
  { id: 'B_brief_plafonne_15000', lampPoints: 15000, earn: cappedBrief, unitScale: 1 },
  { id: 'C_utilite_plafonnee_15000', lampPoints: 15000, earn: useful, unitScale: 1 },
  { id: 'C_utilite_plafonnee_1500_plus_genereux', lampPoints: 1500, earn: useful, unitScale: 1 },
  { id: 'C_echelle_divisee_par10_tout_identique', lampPoints: 1500, earn: p => useful(p) / 10, unitScale: 0.1 },
];
const round = n => Math.round(n * 1e6) / 1e6;
const dateAfterWeeks = weeks => {
  const d = new Date(`${startDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Math.ceil(weeks) * 7);
  return d.toISOString().slice(0, 10);
};

const cadence = [];
const horizon = [];
const sensitivities = [];
const budgets = [];

for (const scheme of schemes) {
  for (const profile of profiles) {
    const weekly = scheme.earn(profile);
    const weeks = weekly ? scheme.lampPoints / weekly : null;
    cadence.push({
      scheme: scheme.id,
      profile: profile.id,
      weekly_points: round(weekly),
      weeks_to_lamp_at_mean_cadence: weeks === null ? null : round(weeks),
      first_weekly_settlement_reaching_lamp: weeks === null ? null : Math.ceil(weeks),
      illustrative_date_at_weekly_settlement: weeks === null ? null : dateAfterWeeks(weeks),
      weeks_to_100_nominal_points: weekly ? round(100 / weekly) : null,
      weeks_to_250_nominal_points: weekly ? round(250 / weekly) : null,
    });
    for (const weeksElapsed of [13, 52, 104]) {
      const earned = weekly * weeksElapsed;
      const lamps = Math.floor((earned + 1e-9) / scheme.lampPoints);
      const balance = earned - lamps * scheme.lampPoints;
      assert(balance >= -1e-8 && balance < scheme.lampPoints + 1e-8);
      assert(Math.abs(earned - lamps * scheme.lampPoints - balance) < 1e-8);
      horizon.push({ scheme: scheme.id, profile: profile.id, weeks: weeksElapsed,
        earned_points: round(earned), lamp_exchanges_if_all_eligible_rights_used: lamps,
        remaining_points: round(balance) });
    }
  }
  const meanWeekly = profiles.reduce((sum, p) => sum + p.weight * scheme.earn(p), 0);
  for (const mau of [1000, 10000]) {
    const monthlyIssued = mau * meanWeekly * weeksPerMonth;
    for (const allInLampCost of [12, 20, 35]) {
      // Planning accrual: no cash payout or legal/accounting qualification implied.
      const fullStressReserve = monthlyIssued / scheme.lampPoints * allInLampCost;
      for (const ultimateRedemption of [0.25, 0.60, 1]) {
        sensitivities.push({ scheme: scheme.id, mau,
          lamp_cost_all_in_eur: allInLampCost,
          ultimate_redemption_assumption: ultimateRedemption,
          monthly_points_issued: round(monthlyIssued),
          expected_ultimate_cost_of_monthly_issuance_eur: round(fullStressReserve * ultimateRedemption),
          full_redemption_reserve_for_monthly_issuance_eur: round(fullStressReserve),
          full_reserve_eur_per_mau_month: round(fullStressReserve / mau),
        });
      }
      for (const cashBudgetPerMau of [0.5, 2, 5]) {
        const fundedCash = mau * cashBudgetPerMau;
        const maxPointsFundedAtFullRedemption = fundedCash * scheme.lampPoints / allInLampCost;
        budgets.push({ scheme: scheme.id, mau,
          lamp_cost_all_in_eur: allInLampCost,
          cash_budget_eur_per_mau_month: cashBudgetPerMau,
          assumed_funded_cash_eur: fundedCash,
          monthly_points_proposed: round(monthlyIssued),
          max_points_funded_at_full_redemption: round(maxPointsFundedAtFullRedemption),
          issuance_coverage_ratio: round(fundedCash / fullStressReserve),
          budget_covers_full_issuance: fundedCash + 1e-9 >= fullStressReserve,
        });
      }
    }
  }
}

// Model invariants: useful controls cap liability, but not identity farming.
assert(Math.abs(profiles.reduce((s, p) => s + p.weight, 0) - 1) < 1e-9);
assert.equal(brief({ likes: 0, activities: 1, shares: 1 }), 150);
assert.equal(cappedBrief({ likes: 3500, activities: 20, shares: 20 }), 500);
assert.equal(useful({ activities: 20, shares: 20, help: 20, preparation: 20 }), 250);
assert.equal(useful({ activities: 0, shares: 0, help: 0, preparation: 0 }), 0);
const a = sensitivities.find(r => r.scheme === schemes[2].id && r.mau === 1000 && r.lamp_cost_all_in_eur === 20 && r.ultimate_redemption_assumption === 1);
const generous = sensitivities.find(r => r.scheme === schemes[3].id && r.mau === 1000 && r.lamp_cost_all_in_eur === 20 && r.ultimate_redemption_assumption === 1);
const rescaled = sensitivities.find(r => r.scheme === schemes[4].id && r.mau === 1000 && r.lamp_cost_all_in_eur === 20 && r.ultimate_redemption_assumption === 1);
assert(Math.abs(generous.full_redemption_reserve_for_monthly_issuance_eur / a.full_redemption_reserve_for_monthly_issuance_eur - 10) < 1e-5);
assert(Math.abs(rescaled.full_redemption_reserve_for_monthly_issuance_eur - a.full_redemption_reserve_for_monthly_issuance_eur) < 1e-5);

const result = {
  status: 'research_scenarios_only_not_observed_metrics_or_production_rules',
  startDate, weeksPerMonth, profiles,
  assumptions: {
    lampAllInCostsEur: [12, 20, 35],
    ultimateRedemption: [0.25, 0.60, 1],
    cashBudgetPerMauMonthEur: [0.5, 2, 5],
    zeroStartingBalance: true,
    noExpiryNoBehaviourChangeNoInflation: true,
    deferredValidationAndStockDelaysNotModelled: true,
    shippingReturnsFraudSupportTaxesMustBeIncludedInAllInCost: true,
    farmerIsWorstCaseAcceptedFraudNotGuaranteedDetection: true,
  }, cadence, horizon, sensitivities, budgets,
};
const out = fileURLToPath(new URL('./simulation-economie.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.table(cadence.filter(r => !r.scheme.includes('echelle')).map(r => ({
  scheme: r.scheme, profile: r.profile, weekly: r.weekly_points,
  weeks: r.weeks_to_lamp_at_mean_cadence,
})));
console.table(sensitivities.filter(r => r.mau === 1000 && r.lamp_cost_all_in_eur === 20 && r.ultimate_redemption_assumption === 1)
  .map(r => ({ scheme: r.scheme, monthlyFullReserveEur: r.full_redemption_reserve_for_monthly_issuance_eur,
    eurPerMauMonth: r.full_reserve_eur_per_mau_month })));
console.log(`Wrote ${out}; deterministic invariants passed.`);
