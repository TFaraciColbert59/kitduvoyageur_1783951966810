import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const families = { Terrain: 'terrain', Préparation: 'preparation', Partage: 'partage', Entraide: 'entraide' };
const skills = { Explorer: 'explorer', Préparer: 'preparer', Partager: 'partager', Entraider: 'entraider' };
const legacyProducerKeys = {
  hike_session_processed: 'hike_session:<session_id>',
  trail_prepared: 'trail_prep:<user_id>:<route_id>',
  kit_field_report: 'kit_report:<session_id>',
  place_review: 'place_review:<user_id>:<place_id>',
  carnet_published: 'carnet:<carnet_id>',
  checklist_completed: 'checklist:<trip_id>',
  trip_completed: 'trip:<trip_id>',
};

/** Resolve the current hooks' sourceType/sourceId templates without executing them. */
export function parseLegacyProducerKeys(hooksSource) {
  const variables = { sessionId: '<session_id>', userId: '<user_id>', routeId: '<route_id>', placeId: '<place_id>', carnetId: '<carnet_id>', tripId: '<trip_id>' };
  const keys = {};
  for (const [, action, sourceType, sourceId] of hooksSource.matchAll(/action:\s*'([^']+)',\s*sourceType:\s*'([^']+)',\s*(?:\/\/[^\n]*\n\s*)*sourceId:\s*(`[^`]+`|\w+)/g)) {
    const id = sourceId.startsWith('`') ? sourceId.slice(1, -1).replace(/\$\{(\w+)\}/g, (_, name) => variables[name] ?? `<unknown:${name}>`) : variables[sourceId] ?? `<unknown:${sourceId}>`;
    keys[action] = `${sourceType}:${id}`;
  }
  return keys;
}

/** Parse the authoritative Markdown, independently of the reconstructed registry. */
export function parseEconomy(markdown) {
  const actions = [], levels = [], familyCaps = {}, commercialRows = [], zeroXpRows = [];
  let section = '';
  for (const line of markdown.split('\n')) {
    if (/^#{2,3} /.test(line)) section = line.replace(/^#+ /, '');
    if (!line.startsWith('| ')) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (section === 'Actions à 0 XP' && /^0/.test(cells[1])) zeroXpRows.push(line.trim());
    if (section === 'Économie commerciale et rémunération' && /^\d+$/.test(cells[1])) commercialRows.push(cells);
    if (families[section] && /^P[1-5]$/.test(cells[4])) {
      const [label, amount, allocation, caps, phase, proof] = cells;
      const amounts = amount.split('–').map(Number);
      const weights = Object.fromEntries(Object.values(skills).map(skill => [skill, 0]));
      for (const [, skill, weight] of allocation.matchAll(/(Explorer|Préparer|Partager|Entraider) (\d+) %/g)) weights[skills[skill]] = Number(weight);
      actions.push({ label, min: amounts[0], max: amounts.at(-1), weights, caps: caps.split('/').map(Number), phase, proof, family: families[section] });
    }
    if (section === 'Niveaux et identité' && /^\d+$/.test(cells[0])) levels.push({ level: Number(cells[0]), minimum_lifetime_xp: Number(cells[1].replace(/\s/g, '')) });
    if (section === 'Plafonds d’XP transversaux' && families[cells[0]]) familyCaps[families[cells[0]]] = { week: Number(cells[1].replace(/\s/g, '')), season: Number(cells[2].replace(/\s/g, '')) };
  }
  return { actions, levels, familyCaps, commercialRows, zeroXpRows };
}

/** A closed specification check, deliberately not an activation or a DB write. */
export function verifyRegistry(registry, markdown, producerSource = '', hooksSource = '') {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  const source = parseEconomy(markdown);
  check(source.actions.length === 29, 'Economy must supply all 29 action rows');
  check(registry.rules?.length === source.actions.length, 'Registry action count differs from economy');
  check(registry.status === 'draft_closed' && registry.effective_from === null, 'Draft publication must remain closed without effective date');
  check(registry.version === '2.0', 'Wrong rule version');
  check(same(registry.levels, source.levels) && source.levels.length === 10, 'Level thresholds differ from economy');
  check(same(registry.family_xp_caps, source.familyCaps), 'Family XP caps differ from economy');
  const rules = registry.rules ?? [];
  check(new Set(rules.map(rule => rule.id)).size === rules.length, 'Duplicate stable action identifier');
  check(new Set(rules.map(rule => rule.label)).size === rules.length, 'Duplicate source action label');
  for (const action of source.actions) {
    const rule = rules.find(candidate => candidate.label === action.label);
    if (!rule) { errors.push(`Missing economy action: ${action.label}`); continue; }
    const prefix = `${rule.id}: `;
    check(rule.xp?.min === action.min && rule.xp?.max === action.max && rule.xp?.unit === 'xp', prefix + 'XP amount differs from economy');
    check(same(rule.skill_weights_percent, action.weights), prefix + 'Skill allocation differs from economy');
    check(same(rule.count_caps, Object.fromEntries(['day', 'week', 'season'].map((key, index) => [key, action.caps[index]]))), prefix + 'Action count caps differ from economy');
    check(rule.family === action.family && rule.first_phase === action.phase, prefix + 'Family or phase differs from economy');
    check(rule.proof_requirements === action.proof, prefix + 'Proof requirement differs from economy');
    check(rule.enabled === false && rule.effective_from === null && rule.effective_until === null, prefix + 'Unpublished rule is active or dated');
    check(rule.version === registry.version, prefix + 'Version mismatch');
    check(/^[a-z][a-z0-9_]+$/.test(rule.id), prefix + 'Invalid stable identifier');
    check(Object.values(rule.skill_weights_percent ?? {}).every(value => Number.isInteger(value) && value >= 0) && Object.values(rule.skill_weights_percent ?? {}).reduce((sum, value) => sum + value, 0) === 100, prefix + 'Weights must be integer percentages totaling 100');
    check(rule.idempotency?.includes_rule_version === false && rule.idempotency?.scope === 'user_id + canonical_business_source', prefix + 'Idempotency must be user-scoped and version-independent');
    check(rule.claim_groups?.length > 0 && rule.activation_conditions?.includes('server_proof_verified'), prefix + 'Claims or proof activation condition missing');
  }
  const byId = Object.fromEntries(rules.map(rule => [rule.id, rule]));
  const groups = [['activity_completed', 'hike_session_processed', 'activity_completed'], ['adventure_prepared', 'trail_prepared', 'compass_prepared'], ['loan_returned', 'loan_borrower_returned', 'loan_lender_returned']];
  for (const [group, first, second] of groups) check(byId[first]?.cap_group === group && byId[second]?.cap_group === group && same(byId[first]?.count_caps, byId[second]?.count_caps), `Shared quota ${group} missing`);
  for (const rule of rules) if (!groups.some(([, first, second]) => [first, second].includes(rule.id))) check(rule.cap_group === rule.id, `${rule.id}: unexpected shared quota`);
  if (producerSource) {
    const union = producerSource.match(/export type ProducerAction =([\s\S]*?);/)?.[1] ?? '';
    const producers = [...union.matchAll(/'([^']+)'/g)].map(match => match[1]);
    check(producers.length === 7, 'Expected seven existing producer IDs; review contract drift');
    for (const id of producers) check(byId[id]?.producer_status === 'existing_requires_upgrade', `Existing producer ID missing: ${id}`);
  }
  for (const [id, key] of Object.entries(legacyProducerKeys)) check(byId[id]?.idempotency?.legacy_key === key, `Legacy key mismatch: ${id}; expected ${key}`);
  if (hooksSource) {
    const observedKeys = parseLegacyProducerKeys(hooksSource);
    check(Object.keys(observedKeys).length === 7, 'Expected seven parseable legacy source keys; review producer hooks drift');
    for (const [id, key] of Object.entries(legacyProducerKeys)) check(observedKeys[id] === key, `Producer hook legacy key drift: ${id}; expected ${key}`);
  }
  const duration = { kind: 'verified_active_duration', tiers: [{ minimum_active_minutes: 20, xp: 40 }, { minimum_active_minutes: 60, xp: 70 }, { minimum_active_minutes: 120, xp: 100 }, { minimum_active_minutes: 240, xp: 130 }], adapted_goal_base_xp: 40, adapted_goal_requires_published_verified_criteria: true, novelty: { xp: 20, maximum_per_canonical_route_per_season: 1, requires_geometry_and_activity_match: true, claim_group: 'route_novelty', reserved_only_on_full_award: true }, segments_bonus: false };
  // Prose formulas lack a dedicated Markdown table: require source anchors as well.
  check(/40 XP à partir de 20 minutes actives, 70 à 60 minutes, 100 à 120 minutes, 130 à 240 minutes/.test(markdown) && /\+20 XP une fois par parcours canonique et par saison/.test(markdown), 'Duration/novelty source changed; review formula');
  for (const id of ['hike_session_processed', 'activity_completed']) check(same(byId[id]?.xp?.formula, duration), `${id}: duration/novelty formula differs`);
  check(/20 \+ 2 × nombre d’équipements distincts évalués, borné à 10 équipements/.test(markdown) && same(byId.kit_field_report?.xp?.formula, { kind: 'finalized_distinct_equipment', base: 20, per_equipment: 2, maximum_equipment: 10 }), 'Final debrief formula differs');
  check(same(byId.place_review?.xp?.formula, { kind: 'qualified_review', base: 15, visit_verified_before_award: 40, later_visit_extra_award: false, edits_extra_award: false }), 'Review proof timing formula differs');
  check(same(registry.skill_allocation?.tie_break, Object.values(skills)) && registry.skill_allocation?.method === 'largest_remainder' && registry.skill_allocation?.single_total_gain === true, 'Skill rounding invariant missing');
  check(registry.business_time?.immutable === true && registry.business_time?.grace_days === 14 && registry.business_time?.after_season_freeze === 'verified_lifetime_only', 'Business date/late award invariant missing');
  check(registry.cap_policy?.award === 'all_or_nothing' && registry.cap_policy?.carry_forward === false, 'Family quota must reject whole gain without carry-forward');
  check(registry.commercial?.enabled === false && registry.commercial?.effective_from === null && registry.commercial?.historical_rights_preserved === true, 'Unfunded commercial publication or historic rights violation');
  const shareRows = { 'Réponse qualifiée acceptée': 'answer_accepted', 'Correction de lieu/sentier acceptée': 'place_report_accepted', 'Contribution de guide acceptée': 'guide_contribution_accepted', 'Information d’accessibilité acceptée': 'accessibility_report_accepted', 'Traduction utile acceptée': 'translation_accepted', 'Trace utile acceptée': 'track_contribution_accepted' };
  const shares = {};
  for (const [label, , proposed] of source.commercialRows) if (shareRows[label]) shares[shareRows[label]] = Number(proposed.match(/^(\d+) parts/)?.[1]);
  check(same(registry.commercial?.contribution_share_awards, shares) && Object.keys(shares).length === 6, 'Commercial shares differ from economy');
  const loyaltyRow = source.commercialRows.find(([label]) => label === 'Achat boutique effectivement encaissé');
  check(registry.commercial?.new_loyalty_credits_per_paid_merchandise_euro === Number(loyaltyRow?.[2].match(/^(\d+) crédits/)?.[1]), 'Loyalty receipt rate differs from economy');
  check(/50 parts\/semaine et 200 par période économique existante/.test(markdown) && same(registry.commercial?.contribution_share_caps, { week: 50, existing_economic_period: 200 }), 'Share caps differ from economy');
  const voucherLine = markdown.split('\n').find(line => line.startsWith('Barème de nouveaux bons')) ?? '';
  const vouchers = [...voucherLine.matchAll(/([\d ]+)(?: crédits)? → (\d+) €/g)].map(match => ({ credits: Number(match[1].trim().replace(/\s/g, '')), value_cents: Number(match[2]) * 100 }));
  check(vouchers.length === 3 && same(registry.commercial?.new_voucher_proposals, vouchers), 'Voucher proposals differ from economy');
  check(/10 % du panier éligible, 25 % de sa marge contributive vérifiée/.test(markdown) && same(registry.commercial?.discount_caps_percent, { eligible_cart: 10, verified_contribution_margin: 25 }), 'Discount margin constraints differ from economy');
  check(same(registry.zero_xp_policy?.source_table_rows, source.zeroXpRows), 'Zero-XP policy differs from economy table');
  for (const [id, scope, period] of [['equipment_maintenance', 'equipment', 'rolling_days'], ['mentoring_completed', 'participant_pair', 'calendar_months'], ['loan_borrower_returned', 'participant_pair_and_equipment', 'rolling_days'], ['loan_lender_returned', 'participant_pair_and_equipment', 'rolling_days']]) {
    check(same(byId[id]?.object_caps, [{ scope, maximum_actions: 1, [period]: period === 'rolling_days' ? 90 : 1 }]), `${id}: object/pair cap missing`);
  }
  check(same(byId.place_photo_accepted?.object_caps, [{ scope: 'activity', maximum_actions: 3 }]), 'Photo activity cap missing');
  for (const id of ['loan_borrower_returned', 'loan_lender_returned']) check(byId[id]?.minimum_loan_hours === 24 && byId[id]?.roles_exclusive_per_user_and_loan === true, `${id}: loan duration/role exclusion missing`);
  for (const [ids, group] of [[['place_report_accepted', 'accessibility_report_accepted'], 'place_report'], [['equipment_maintenance', 'equipment_repair_documented'], 'equipment_intervention'], [['carnet_published', 'place_photo_accepted'], 'content_media']]) for (const id of ids) check(byId[id]?.claim_groups?.includes(group), `${id}: shared deduplication claim missing`);
  check(registry.zero_xp_policy?.xp_to_money_conversion === false && registry.zero_xp_policy?.essential_features_require_xp === false, 'XP monetary/essential access invariant violated');
  check(registry.competition?.local_1km_enabled === false && registry.competition?.league_enabled === false && registry.competition?.demo_participants_excluded === true, 'Population/privacy activation gate violated');
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const registry = JSON.parse(readFileSync(resolve(root, 'docs/progression/2.0/rules-registry.json'), 'utf8'));
  const errors = verifyRegistry(registry, readFileSync(resolve(root, registry.source), 'utf8'), readFileSync(resolve(root, 'src/features/progression/server/awardProducer.ts'), 'utf8'), readFileSync(resolve(root, 'src/features/progression/server/producerHooks.ts'), 'utf8'));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Progression 2.0 registry: 29 economy actions, 10 levels, seven legacy producer IDs verified; all activation gates closed.');
}
