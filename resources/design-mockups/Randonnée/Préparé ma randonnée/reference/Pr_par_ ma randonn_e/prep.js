/* ═══════════════════════════════════════════════════════════════
   PRÉPARER MA RANDONNÉE — logic
   Data model : inventaire réel (persisté localStorage) + rando +
   météo → besoins → comparaison → score → validation
   ═══════════════════════════════════════════════════════════════ */

// ─── 1. RANDONNÉE SÉLECTIONNÉE ────────────────────────────────
// (dans le vrai flow, viendrait de la table `hikes` + point d'ancrage)
const HIKE = {
  id: "chamechaude-oct",
  name: { pre: "Traversée du", em: "Chamechaude" },
  location: "Chartreuse · Isère",
  distance: 14.2,      // km
  duration: 5.5,       // h
  ascent: 980,         // m D+
  descent: 980,
  difficulty: "T3",    // Alpine hiking scale — soutenu
  terrain: ["rocky", "exposed_ridge", "forest"],
  altMax: 2082,
  altMin: 950,
  season: "autumn"
};

// ─── 2. MÉTÉO + CONDITIONS (viendraient d'une API réelle) ─────
const WEATHER = {
  tempMin: 4,      // °C au sommet
  tempMax: 14,
  rainProb: 45,    // %
  windSpeed: 35,   // km/h en crête
  uvIndex: 3,
  sunset: "18:42",
  cloudCover: 70,
  conditions: ["cold_summit", "rain_possible", "windy_ridge"]
};

// ─── 3. INVENTAIRE UTILISATEUR RÉEL ───────────────────────────
// Chaque item porte un ID stable, une catégorie, des propriétés
// mesurables (capacity, warmth, etc.) et des tags pour matching.
const DEFAULT_INVENTORY = [
  { id: "inv_shoes_01", cat: "footwear", name: "Salomon X Ultra 4 GTX",
    tags: ["boots", "waterproof", "grip:high"], qty: 1 },
  { id: "inv_bp_01", cat: "backpack", name: "Osprey Talon 22 L",
    tags: ["backpack", "size:daypack"], capacity_l: 22, qty: 1 },
  { id: "inv_bottle_01", cat: "hydration", name: "Gourde Klean Kanteen",
    tags: ["water", "bottle"], capacity_ml: 750, qty: 1 },
  { id: "inv_jkt_01", cat: "outerwear", name: "Polaire Patagonia R1",
    tags: ["insulation", "midlayer", "warmth:medium"], qty: 1 },
  { id: "inv_poles_01", cat: "poles", name: "Bâtons pliables Black Diamond",
    tags: ["poles", "foldable", "trekking"], qty: 1 },
  { id: "inv_snack_01", cat: "food", name: "Barres énergétiques",
    tags: ["snack", "energy"], qty: 4 },
  { id: "inv_map_01", cat: "navigation", name: "Carte IGN 3334OT",
    tags: ["map", "paper", "chartreuse"], qty: 1 },
  { id: "inv_headlamp_01", cat: "light", name: "Petzl Actik Core",
    tags: ["headlamp", "rechargeable"], lumens: 450, qty: 1 },
  { id: "inv_sunglasses_01", cat: "eyewear", name: "Lunettes cat. 3",
    tags: ["sunglasses", "cat3"], qty: 1 },
  { id: "inv_firstaid_01", cat: "safety", name: "Trousse de secours",
    tags: ["firstaid"], qty: 1 }
];

// ─── 4. BESOINS RECOMMANDÉS POUR CETTE RANDO ──────────────────
// Chaque besoin porte : tags à matcher, quantité, priorité,
// raison contextuelle, et éventuellement une substitution acceptable.
const NEEDS = [
  { key: "footwear", cat: "footwear", name: "Chaussures de randonnée",
    tags: ["boots", "grip:high"], qty: 1,
    priority: "essential",
    why: "Terrain rocheux et pentes soutenues (T3).",
    icon: "boot" },
  { key: "backpack", cat: "backpack", name: "Sac à dos ≥ 20 L",
    tags: ["backpack"], minCapacityL: 20, qty: 1,
    priority: "essential",
    why: "Pour porter eau, couches et sécurité sur 5 h 30.",
    icon: "backpack" },
  { key: "water", cat: "hydration", name: "Eau",
    tags: ["water"], minCapacityMl: 2000, qty: 1,
    priority: "essential",
    why: "5 h 30 en montée · 2 L minimum recommandé.",
    icon: "drop" },
  { key: "midlayer", cat: "outerwear", name: "Couche chaude",
    tags: ["insulation", "midlayer"], qty: 1,
    priority: "essential",
    why: "4 °C au sommet du Chamechaude, vent 35 km/h.",
    icon: "shirt" },
  { key: "rainjacket", cat: "outerwear", name: "Veste imperméable",
    tags: ["rainshell", "waterproof"], qty: 1,
    priority: "essential",
    why: "45 % de risque de pluie · exposition en crête.",
    icon: "cloud-rain" },
  { key: "poles", cat: "poles", name: "Bâtons de randonnée",
    tags: ["poles"], qty: 1,
    priority: "recommended",
    why: "980 m de dénivelé négatif · protège les genoux.",
    icon: "poles",
    // acceptable substitutions from inventory (any of these tags is fine)
    acceptableSubs: ["foldable", "trekking"] },
  { key: "food", cat: "food", name: "Ravitaillement",
    tags: ["snack", "energy"], qty: 6,
    priority: "essential",
    why: "≈ 300 kcal/h × 5 h 30 = 6 barres/snacks.",
    icon: "leaf" },
  { key: "map", cat: "navigation", name: "Carte + navigation",
    tags: ["map"], qty: 1,
    priority: "essential",
    why: "Zone IGN 3334OT · redondance GPS en crête.",
    icon: "map" },
  { key: "headlamp", cat: "light", name: "Lampe frontale",
    tags: ["headlamp"], qty: 1,
    priority: "recommended",
    why: "Coucher du soleil à 18 h 42 · marge de sécurité.",
    icon: "lamp" },
  { key: "firstaid", cat: "safety", name: "Trousse de secours",
    tags: ["firstaid"], qty: 1,
    priority: "essential",
    why: "Sortie engagée en terrain isolé.",
    icon: "cross" },
  // ─── contextuel (météo / saison) ───
  { key: "gloves", cat: "outerwear", name: "Gants légers",
    tags: ["gloves"], qty: 1,
    priority: "contextual",
    why: "Vent 35 km/h en crête · froid ressenti négatif.",
    context: "météo",
    icon: "hand" },
  { key: "beanie", cat: "outerwear", name: "Bonnet",
    tags: ["beanie", "hat_warm"], qty: 1,
    priority: "contextual",
    why: "4 °C au sommet · perte de chaleur par la tête.",
    context: "météo",
    icon: "beanie" },
  { key: "sunscreen", cat: "skincare", name: "Crème solaire SPF 30+",
    tags: ["sunscreen"], qty: 1,
    priority: "contextual",
    why: "UV 3 en altitude même par temps couvert.",
    context: "altitude",
    icon: "sun" }
];

// ─── 5. ICON LIBRARY (24×24 line icons, cohérent Kit du Voyageur) ─
const ICONS = {
  boot: `<path d="M6 20V9a2 2 0 0 1 2-2h2v13"/><path d="M10 20l10 -1 -2 -6 -8 1"/><path d="M14 11l1 2M17 10l1 2"/>`,
  backpack: `<path d="M7 8a5 5 0 0 1 10 0v12H7z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/><path d="M9 13h6"/>`,
  drop: `<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>`,
  shirt: `<path d="M6 6l3-3h6l3 3 3 2-2 4-2-1v10H6V11L4 12 2 8z"/>`,
  "cloud-rain": `<path d="M7 15a4 4 0 1 1 1-7.9 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>`,
  poles: `<path d="M5 3l4 18M10 3l-1 3M9 6l2 1M19 3l-4 18M14 3l1 3M15 6l-2 1"/>`,
  leaf: `<path d="M5 19c0-8 6-14 15-14 0 9-6 15-15 15z"/><path d="M5 19l7-7"/>`,
  map: `<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>`,
  lamp: `<path d="M8 12h8a4 4 0 0 0 0-8H8a4 4 0 0 0 0 8z"/><path d="M8 12v8h8v-8"/><path d="M2 8h2M20 8h2M4 4l1.5 1.5M18.5 5.5L20 4"/>`,
  cross: `<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M12 10v6M9 13h6"/><path d="M9 6V4h6v2"/>`,
  hand: `<path d="M8 11V6a1.5 1.5 0 0 1 3 0v5M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5a1.5 1.5 0 0 1 3 0v6M17 11V7a1.5 1.5 0 0 1 3 0v7c0 4-3 7-6.5 7S8 18 8 15v-2"/>`,
  beanie: `<path d="M4 17a8 8 0 0 1 16 0"/><path d="M2 17h20v3H2z"/><path d="M12 4v3"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/>`,
  check: `<path d="M4 12l5 5L20 6"/>`,
  x: `<path d="M6 6l12 12M18 6l-12 12"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  swap: `<path d="M7 4L4 7l3 3M4 7h13a4 4 0 0 1 0 8h-1M17 20l3-3-3-3M20 17H7a4 4 0 0 1 0-8h1"/>`,
  gps: `<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>`,
  battery: `<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><rect x="5" y="9" width="10" height="6" rx="0.5" fill="currentColor" stroke="none"/>`,
  cloud: `<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7z"/>`,
  wind: `<path d="M4 8h11a3 3 0 1 0-3-3M4 12h15a3 3 0 1 1-3 3M4 16h11"/>`,
  temp: `<path d="M12 15V4a2 2 0 1 1 4 0v11a4 4 0 1 1-4 0z"/><circle cx="14" cy="18" r="1.5" fill="currentColor"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  route: `<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4"/>`,
  mountain: `<path d="M3 20l6-14 4 8 3-5 5 11z"/>`,
  bookmark: `<path d="M6 4h12v17l-6-4-6 4z"/>`,
  back: `<path d="M15 6l-6 6 6 6"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 8v1M12 12v5"/>`,
  shield: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>`,
  spark: `<path d="M12 3l1.5 5 5 1.5-5 1.5L12 16l-1.5-5-5-1.5 5-1.5z"/>`,
  timer: `<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 3h6"/>`,
  eye: `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`
};

const ICON = (name, extraAttrs = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extraAttrs}>${ICONS[name] || ""}</svg>`;

// ─── 6. STATE ─────────────────────────────────────────────────
const STORAGE_KEY = "lkv.prep.state.v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // sanity: ensure inventory exists
      if (Array.isArray(s.inventory)) return s;
    }
  } catch (_) {}
  return {
    inventory: DEFAULT_INVENTORY.map(x => ({ ...x })),
    ignored: [],       // needs.key the user chose to skip for this hike
    manuallyOk: []     // needs.key the user marked "je l'ai déjà" without adding
  };
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
}

let STATE = loadState();

// ─── 7. MATCHING / COMPARISON LOGIC ───────────────────────────
// For each need, find the best matching inventory item(s).
function matchNeed(need, inv) {
  // Category match first (strong signal), then tags
  const catCandidates = inv.filter(i => i.cat === need.cat);
  const tagCandidates = inv.filter(i =>
    need.tags.some(t => i.tags && i.tags.includes(t))
  );
  const subCandidates = (need.acceptableSubs || []).length
    ? inv.filter(i =>
        need.acceptableSubs.some(t => i.tags && i.tags.includes(t))
      )
    : [];

  // Prioritize direct tag match, then category, then substitution
  const primary = tagCandidates[0] || catCandidates[0] || null;
  const isSubstitution = !tagCandidates.length && !!subCandidates[0] && !catCandidates.length;
  const item = primary || subCandidates[0] || null;

  if (!item) {
    return { status: "missing", item: null, isSubstitution: false, gap: need.qty, coverage: 0 };
  }

  // Quantity/capacity check
  let coverage = 1;
  let gap = 0;
  let gapUnit = "";
  if (need.minCapacityMl && item.capacity_ml) {
    coverage = item.capacity_ml / need.minCapacityMl;
    if (coverage < 1) {
      gap = need.minCapacityMl - item.capacity_ml;
      gapUnit = "ml";
    }
  } else if (need.minCapacityL && item.capacity_l) {
    coverage = item.capacity_l / need.minCapacityL;
    if (coverage < 1) {
      gap = need.minCapacityL - item.capacity_l;
      gapUnit = "L";
    }
  } else if (need.qty && item.qty) {
    coverage = item.qty / need.qty;
    if (coverage < 1) {
      gap = need.qty - item.qty;
      gapUnit = "u";
    }
  }
  coverage = Math.min(1, Math.max(0, coverage));

  const status = coverage >= 1
    ? (isSubstitution ? "substitution" : "ok")
    : "partial";

  return { status, item, isSubstitution, gap, gapUnit, coverage };
}

function evaluateAll() {
  const results = NEEDS.map(need => {
    if (STATE.ignored.includes(need.key)) {
      return { need, status: "ignored", item: null, coverage: 0, gap: 0, gapUnit: "" };
    }
    const m = matchNeed(need, STATE.inventory);
    // "manuallyOk" — user said "j'ai déjà" without a matching item present
    if (m.status === "missing" && STATE.manuallyOk.includes(need.key)) {
      return { need, status: "ok", item: null, coverage: 1, gap: 0, gapUnit: "", manuallyOk: true };
    }
    return { need, ...m };
  });
  return results;
}

// Score : essentials weigh 2×, recommended 1.2×, contextual 0.8×
function computeScore(results) {
  let earned = 0, total = 0;
  for (const r of results) {
    if (r.status === "ignored") continue;
    const w = r.need.priority === "essential" ? 2
            : r.need.priority === "recommended" ? 1.2
            : 0.8;
    total += w;
    if (r.status === "ok" || r.status === "substitution") earned += w;
    else if (r.status === "partial") earned += w * r.coverage;
  }
  if (total === 0) return 100;
  return Math.round((earned / total) * 100);
}

// ─── 8. ADD TO INVENTORY (persistence) ────────────────────────
function addToInventory(need) {
  // Craft an inventory entry from the need
  const newItem = {
    id: `inv_${need.key}_${Date.now()}`,
    cat: need.cat,
    name: need.name,
    tags: [...need.tags],
    qty: need.qty || 1,
    ...(need.minCapacityMl ? { capacity_ml: need.minCapacityMl } : {}),
    ...(need.minCapacityL ? { capacity_l: need.minCapacityL } : {}),
    _addedForHike: HIKE.id
  };
  STATE.inventory.push(newItem);
  saveState(STATE);
}
function completePartial(need, result) {
  // For water etc — bump the existing item's capacity to meet the need
  const item = STATE.inventory.find(i => i.id === result.item.id);
  if (!item) return;
  if (need.minCapacityMl) item.capacity_ml = need.minCapacityMl;
  else if (need.minCapacityL) item.capacity_l = need.minCapacityL;
  else if (need.qty) item.qty = need.qty;
  saveState(STATE);
}
function markManuallyOk(need) {
  if (!STATE.manuallyOk.includes(need.key)) STATE.manuallyOk.push(need.key);
  saveState(STATE);
}
function ignoreForHike(need) {
  if (!STATE.ignored.includes(need.key)) STATE.ignored.push(need.key);
  saveState(STATE);
}
function unignore(need) {
  STATE.ignored = STATE.ignored.filter(k => k !== need.key);
  saveState(STATE);
}
function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  STATE = loadState();
}

// ─── 9. RENDERING ─────────────────────────────────────────────
function fmtQty(need, result) {
  if (need.minCapacityMl) {
    const have = result.item?.capacity_ml || 0;
    return { have: `${(have/1000).toFixed(2).replace(".", ",")} L`,
             need: `${(need.minCapacityMl/1000).toFixed(1).replace(".", ",")} L`,
             gap: result.gap ? `−${(result.gap/1000).toFixed(2).replace(".", ",")} L` : null };
  }
  if (need.minCapacityL) {
    const have = result.item?.capacity_l || 0;
    return { have: `${have} L`, need: `${need.minCapacityL} L`,
             gap: result.gap ? `−${result.gap} L` : null };
  }
  const have = result.item?.qty || 0;
  const q = need.qty || 1;
  return { have: `${have}`, need: `${q}`,
           gap: result.gap ? `−${result.gap}` : null };
}

function renderGearItem(result) {
  const { need, status, item, isSubstitution, coverage, manuallyOk } = result;
  const q = fmtQty(need, result);
  const cls = {
    ok: "state-ok",
    substitution: "state-sub",
    partial: "state-partial",
    missing: "state-missing",
    ignored: "state-ok"
  }[status] || "";
  const pill = {
    ok: `<span class="pill ok">${ICON("check")} Dispo</span>`,
    substitution: `<span class="pill sub">${ICON("swap")} Équivalent</span>`,
    partial: `<span class="pill partial">${ICON("info")} Insuffisant</span>`,
    missing: `<span class="pill missing">${ICON("x")} Manquant</span>`,
    ignored: `<span class="pill ok">Ignoré</span>`
  }[status];
  const prio = need.priority === "essential"
    ? `<span class="prio">Essentiel</span>` : "";

  const showBar = ["partial", "missing", "ok", "substitution"].includes(status)
    && (need.minCapacityMl || need.minCapacityL || (need.qty && need.qty > 1));
  const barPct = Math.round(coverage * 100);

  const showQtyRow = showBar || status === "partial" || status === "missing";

  // Actions per state
  let actions = "";
  if (status === "missing") {
    actions = `
      <div class="gear-actions">
        <button class="primary" data-act="add" data-key="${need.key}">${ICON("plus")} Ajouter</button>
        <button data-act="mark" data-key="${need.key}">${ICON("check")} Je l'ai déjà</button>
        <button class="ghost" data-act="ignore" data-key="${need.key}">Ignorer</button>
      </div>`;
  } else if (status === "partial") {
    actions = `
      <div class="gear-actions">
        <button class="primary" data-act="complete" data-key="${need.key}">${ICON("plus")} Compléter</button>
        <button data-act="mark" data-key="${need.key}">${ICON("check")} Ça suffira</button>
      </div>`;
  }

  const subNote = isSubstitution && item ? `
    <div class="gear-sub-note">
      ${ICON("swap")}
      <div>Tu n'as pas de ${need.name.toLowerCase()}, mais <em>${item.name}</em> conviennent.</div>
    </div>` : "";

  const manualNote = manuallyOk ? `
    <div class="gear-sub-note">
      ${ICON("check")}
      <div><em>Confirmé</em> dans ton équipement personnel.</div>
    </div>` : "";

  return `
    <div class="gear-item ${cls}" data-key="${need.key}">
      <div class="icon">${ICON(need.icon || "bookmark")}</div>
      <div class="body">
        <div class="n">${need.name}${prio}</div>
        <div class="why">${need.why}</div>
        ${showQtyRow ? `
          <div class="qty">
            <span class="have">Possédé <span style="font-weight:600;color:inherit">${q.have}</span></span>
            <span class="need">/ ${q.need}</span>
            ${q.gap ? `<span class="gap">${q.gap}</span>` : ""}
            ${showBar ? `<span class="qty-bar"><span class="fill" style="width:${barPct}%"></span></span>` : ""}
          </div>` : ""}
        ${subNote}${manualNote}
        ${actions}
      </div>
      <div class="status">${pill}</div>
    </div>`;
}

function renderOkItem(result) {
  const { need, item } = result;
  const nm = item?.name || need.name;
  const qty = item?.capacity_ml
    ? `${(item.capacity_ml/1000).toFixed(2).replace(".", ",")} L`
    : item?.capacity_l ? `${item.capacity_l} L`
    : item?.qty ? `× ${item.qty}` : "OK";
  return `
    <div class="ok-item" data-key="${need.key}">
      <div class="ic">${ICON(need.icon || "check")}</div>
      <div class="txt">
        <div class="n">${nm}</div>
        <div class="q">${qty}</div>
      </div>
      <div class="check">${ICON("check")}</div>
    </div>`;
}

function renderScoreRing(score) {
  const R = 26, C = 2 * Math.PI * R;
  const off = C * (1 - score / 100);
  return `
    <div class="score-ring">
      <svg viewBox="0 0 62 62">
        <circle class="track" cx="31" cy="31" r="${R}" fill="none" stroke-width="5"/>
        <circle class="fill" cx="31" cy="31" r="${R}" fill="none" stroke-width="5"
          stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
      </svg>
      <div class="num">${score}<span class="pct">%</span></div>
    </div>`;
}

function renderConditions() {
  return `
    <div class="conditions-strip">
      <div class="cell">
        <div class="l">${ICON("route")} DIST</div>
        <div class="v">${HIKE.distance.toString().replace(".", ",")}<em> km</em></div>
        <div class="s">D+${HIKE.ascent}</div>
      </div>
      <div class="cell">
        <div class="l">${ICON("clock")} DURÉE</div>
        <div class="v">${Math.floor(HIKE.duration)}<em>h</em>${Math.round((HIKE.duration % 1) * 60)}</div>
        <div class="s">${HIKE.difficulty}</div>
      </div>
      <div class="cell">
        <div class="l">${ICON("temp")} TEMP</div>
        <div class="v">${WEATHER.tempMin}<em>°</em></div>
        <div class="s">crête</div>
      </div>
      <div class="cell">
        <div class="l">${ICON("cloud-rain")} PLUIE</div>
        <div class="v">${WEATHER.rainProb}<em>%</em></div>
        <div class="s">${WEATHER.windSpeed} km/h</div>
      </div>
    </div>`;
}

function renderSafety(score) {
  const gearOk = score >= 85;
  return `
    <div class="safety-grid">
      <div class="safety-row">
        <div class="ic">${ICON("shield")}</div>
        <div class="body">
          <div class="n">Équipement</div>
          <div class="v">${score}% · ${gearOk ? "prêt" : "à compléter"}</div>
        </div>
        <div class="status-ic ${gearOk ? "ok" : "warn"}">${ICON(gearOk ? "check" : "info")}</div>
      </div>
      <div class="safety-row">
        <div class="ic">${ICON("cloud")}</div>
        <div class="body">
          <div class="n">Météo vérifiée</div>
          <div class="v">${WEATHER.tempMin}–${WEATHER.tempMax}°C · pluie ${WEATHER.rainProb}%</div>
        </div>
        <div class="status-ic ok">${ICON("check")}</div>
      </div>
      <div class="safety-row">
        <div class="ic">${ICON("gps")}</div>
        <div class="body">
          <div class="n">GPS · localisation</div>
          <div class="v">Précision 3 m · ready</div>
        </div>
        <div class="status-ic ok">${ICON("check")}</div>
      </div>
      <div class="safety-row">
        <div class="ic">${ICON("map")}</div>
        <div class="body">
          <div class="n">Carte hors ligne</div>
          <div class="v">IGN 3334OT · 42 Mo téléchargés</div>
        </div>
        <div class="status-ic ok">${ICON("check")}</div>
      </div>
      <div class="safety-row">
        <div class="ic">${ICON("battery")}</div>
        <div class="body">
          <div class="n">Batterie téléphone</div>
          <div class="v">87 % · autonomie ≈ 9 h</div>
        </div>
        <div class="status-ic ok">${ICON("check")}</div>
      </div>
      <div class="safety-row ${WEATHER.rainProb > 40 ? "warn" : ""}">
        <div class="ic">${ICON("info")}</div>
        <div class="body">
          <div class="n">Alerte à surveiller</div>
          <div class="v">${WEATHER.rainProb > 40 ? `Averse possible dès 14 h` : "Aucune"}</div>
        </div>
        <div class="status-ic ${WEATHER.rainProb > 40 ? "warn" : "ok"}">${ICON(WEATHER.rainProb > 40 ? "info" : "check")}</div>
      </div>
    </div>`;
}

// ─── 10. FULL SCREEN RENDER ───────────────────────────────────
function render(rootSelector = "#prep-screen", { activeTab } = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return;

  const results = evaluateAll();
  const missing = results.filter(r => r.status === "missing");
  const partial = results.filter(r => r.status === "partial");
  const okOrSub = results.filter(r => r.status === "ok" || r.status === "substitution");
  const contextual = results.filter(r => r.need.priority === "contextual");
  const nonContextualMissing = missing.filter(r => r.need.priority !== "contextual");
  const contextualNeeds = contextual;

  const score = computeScore(results);
  const readyEnough = score >= 85 && nonContextualMissing.every(r => r.need.priority !== "essential");
  const anyEssentialMissing = missing.some(r => r.need.priority === "essential");

  // remember active tab
  const tab = activeTab || root.dataset.tab || "missing";
  root.dataset.tab = tab;

  root.innerHTML = `
    <!-- STATUS BAR -->
    <div class="status-bar on-dark">
      <div>10:04</div>
      <div class="right">
        <svg viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
        <svg viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="1"><rect x="1" y="1" width="19" height="10" rx="2"/><rect x="3" y="3" width="12" height="6" rx="1" fill="currentColor"/><rect x="21" y="4" width="2" height="4" rx="0.5" fill="currentColor"/></svg>
      </div>
    </div>

    <!-- HERO -->
    <div class="hero">
      <div class="contour"></div>
      <div class="specks"></div>
      <svg class="route-svg" viewBox="0 0 380 240" preserveAspectRatio="none">
        <path d="M20,220 Q80,180 130,160 T220,110 T360,40"
              fill="none" stroke="#17402C" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="3 6" opacity="0.32"/>
        <circle cx="20" cy="220" r="5" fill="#17402C"/>
        <circle cx="360" cy="40" r="5" fill="#17402C"/>
      </svg>
      <button class="back" data-act="back">${ICON("back")}</button>
      <button class="save">${ICON("bookmark")}</button>
      <div class="hero-body">
        <div class="eyebrow">Préparation · ${HIKE.location}</div>
        <h1 class="name">${HIKE.name.pre} <em>${HIKE.name.em}</em></h1>
        <div class="facts">
          <span class="fact">${ICON("route")}<span class="num">${HIKE.distance.toString().replace(".", ",")} km</span></span>
          <span class="fact">${ICON("clock")}<span class="num">${Math.floor(HIKE.duration)}h${Math.round((HIKE.duration % 1) * 60)}</span></span>
          <span class="fact">${ICON("mountain")}<span class="num">D+${HIKE.ascent}m</span></span>
          <span class="fact diff">${ICON("spark")}<span class="num">${HIKE.difficulty}</span></span>
        </div>
      </div>
    </div>

    <!-- SCORE PANEL -->
    <div class="score-panel">
      ${renderScoreRing(score)}
      <div class="txt">
        <div class="k">Score de préparation</div>
        <div class="h">
          ${score >= 95 ? `Tu es <em>prêt</em> à partir.`
          : score >= 85 ? `Presque <em>prêt</em>.`
          : score >= 70 ? `Encore <em>quelques items</em>.`
          : `Il te manque <em>l'essentiel</em>.`}
        </div>
        <div class="s">${okOrSub.length}/${results.length - STATE.ignored.length} · ${missing.length} manquant${missing.length > 1 ? "s" : ""} · ${partial.length} insuffisant${partial.length > 1 ? "s" : ""}</div>
      </div>
    </div>

    <!-- CONTENT -->
    <div class="content">
      ${renderConditions()}

      <!-- TABS -->
      <div class="tabs">
        <button data-tab="missing" class="${tab === "missing" ? "on miss" : ""}">
          Il te manque <span class="cnt">${missing.length + partial.length}</span>
        </button>
        <button data-tab="ok" class="${tab === "ok" ? "on ok" : ""}">
          Suffisant <span class="cnt">${okOrSub.length}</span>
        </button>
        <button data-tab="ctx" class="${tab === "ctx" ? "on warn" : ""}">
          Selon conditions <span class="cnt">${contextualNeeds.length}</span>
        </button>
      </div>

      <!-- MISSING PANE -->
      <div class="pane ${tab === "missing" ? "on" : ""}" data-pane="missing">
        ${missing.length + partial.length > 0 ? `
          ${partial.map(renderGearItem).join("")}
          ${nonContextualMissing.filter(r => r.need.priority !== "contextual").map(renderGearItem).join("")}
          ${missing.filter(r => r.need.priority === "contextual").map(renderGearItem).join("")}
        ` : `
          <div class="empty">
            <div class="ic">${ICON("check")}</div>
            <div class="t">Rien ne <em>manque.</em></div>
            <div class="s">Tu as tout ce qu'il faut pour partir.</div>
          </div>`}
      </div>

      <!-- OK PANE -->
      <div class="pane ${tab === "ok" ? "on" : ""}" data-pane="ok">
        <div class="section-head" style="padding-top:0;">
          <div class="h">Ton <em>équipement</em> est suffisant<span class="badge ok">${okOrSub.length}</span></div>
        </div>
        ${okOrSub.length > 0 ? `
          <div class="ok-list">${okOrSub.map(renderOkItem).join("")}</div>
        ` : `
          <div class="empty">
            <div class="ic">${ICON("info")}</div>
            <div class="t">Ton inventaire est <em>vide.</em></div>
            <div class="s">Commence par ajouter ce qu'il te manque.</div>
          </div>`}
        <div class="section-head" style="margin-top:8px;">
          <div class="h">Sécurité <em>randonnée</em></div>
        </div>
        ${renderSafety(score)}
      </div>

      <!-- CONTEXTUAL PANE -->
      <div class="pane ${tab === "ctx" ? "on" : ""}" data-pane="ctx">
        <div class="section-head" style="padding-top:0;">
          <div class="h">Recommandé <em>selon</em> les conditions</div>
        </div>
        ${contextualNeeds.length > 0
          ? contextualNeeds.map(renderGearItem).join("")
          : `<div class="empty"><div class="ic">${ICON("check")}</div><div class="t">Rien de <em>particulier.</em></div><div class="s">Les conditions sont favorables.</div></div>`}
      </div>
    </div>

    <!-- DOCK -->
    <div class="dock">
      <div class="mini-status">
        <div class="l">
          <span class="dot ${anyEssentialMissing ? "miss" : missing.length ? "warn" : ""}"></span>
          ${anyEssentialMissing ? "Essentiels manquants" : (missing.length + partial.length) ? `${missing.length + partial.length} à compléter` : "Tout est prêt"}
        </div>
        <div>${score}% · ${okOrSub.length}/${results.length - STATE.ignored.length}</div>
      </div>
      <button class="cta" data-act="start" ${anyEssentialMissing ? "disabled" : ""}>
        ${ICON("gps")} Démarrer la <em>randonnée</em>
        <span class="arrow">${ICON("arrow")}</span>
      </button>
      ${anyEssentialMissing
        ? `<div class="sec">Complète les essentiels pour <em>partir</em></div>`
        : missing.length
          ? `<div class="sec">Partir quand même — j'ajusterai en route</div>`
          : ``}
    </div>

    <!-- TOAST -->
    <div class="toast" id="prep-toast">
      <div class="ic">${ICON("check")}</div>
      <div><span id="toast-text">Ajouté</span> · <em>persisté</em></div>
    </div>
  `;

  wire(root);
}

// ─── 11. INTERACTIONS ─────────────────────────────────────────
function showToast(msg = "Ajouté à ton inventaire") {
  const root = document.querySelector("#prep-screen");
  if (!root) return;
  const el = root.querySelector("#prep-toast");
  const txt = root.querySelector("#toast-text");
  if (!el || !txt) return;
  txt.textContent = msg;
  el.classList.add("on");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("on"), 1600);
}

function wire(root) {
  // Tabs
  root.querySelectorAll(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tab;
      root.dataset.tab = t;
      root.querySelectorAll(".tabs button").forEach(b => b.classList.remove("on", "miss", "warn", "ok"));
      const cls = t === "missing" ? "miss" : t === "ok" ? "ok" : "warn";
      btn.classList.add("on", cls);
      root.querySelectorAll(".pane").forEach(p => p.classList.toggle("on", p.dataset.pane === t));
    });
  });

  // Gear actions
  root.querySelectorAll("[data-act]").forEach(btn => {
    btn.addEventListener("click", e => {
      const act = btn.dataset.act;
      const key = btn.dataset.key;
      const need = NEEDS.find(n => n.key === key);

      if (act === "add" && need) {
        // Animate the target row briefly, then persist + re-render
        const row = root.querySelector(`.gear-item[data-key="${key}"]`);
        if (row) row.classList.add("state-added");
        setTimeout(() => {
          addToInventory(need);
          showToast(`${need.name} ajouté`);
          render("#prep-screen");
        }, 320);
      } else if (act === "complete" && need) {
        const row = root.querySelector(`.gear-item[data-key="${key}"]`);
        if (row) row.classList.add("state-added");
        const results = evaluateAll();
        const r = results.find(x => x.need.key === key);
        setTimeout(() => {
          if (r) completePartial(need, r);
          showToast(`${need.name} complété`);
          render("#prep-screen");
        }, 320);
      } else if (act === "mark" && need) {
        markManuallyOk(need);
        showToast(`Confirmé — ${need.name}`);
        render("#prep-screen");
      } else if (act === "ignore" && need) {
        ignoreForHike(need);
        showToast(`Ignoré pour cette rando`);
        render("#prep-screen");
      } else if (act === "start") {
        if (btn.disabled) return;
        startHike();
      } else if (act === "back") {
        // no-op in prototype; would history.back()
        showToast("Retour à la sélection");
      }
    });
  });
}

// ─── 12. START HIKE — swap to tracking view ───────────────────
function startHike() {
  const root = document.querySelector("#prep-screen");
  if (!root) return;
  // fade-out prep, fade-in tracking
  root.style.transition = "opacity 300ms";
  root.style.opacity = "0";
  setTimeout(() => {
    root.innerHTML = trackingScreenHTML();
    root.style.opacity = "1";
    // wire the "return to prep" button
    const back = root.querySelector("[data-act='return-prep']");
    if (back) back.addEventListener("click", () => render("#prep-screen"));
  }, 320);
}
function trackingScreenHTML() {
  return `
    <div class="status-bar on-dark">
      <div>10:04</div>
      <div class="right">
        <svg viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
        <svg viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="1"><rect x="1" y="1" width="19" height="10" rx="2"/><rect x="3" y="3" width="12" height="6" rx="1" fill="currentColor"/><rect x="21" y="4" width="2" height="4" rx="0.5" fill="currentColor"/></svg>
      </div>
    </div>
    <div class="tracking-map">
      <div class="contour"></div>
      <svg class="route-svg" viewBox="0 0 380 780" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
        <path d="M40,720 Q90,650 130,580 T190,390 T260,220 T340,80"
              fill="none" stroke="#17402C" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="2 6" opacity="0.35"/>
        <path d="M40,720 Q90,650 130,580 T130,510"
              fill="none" stroke="#17402C" stroke-width="5"
              stroke-linecap="round"/>
      </svg>
      <div class="me-marker"><div class="halo"></div><div class="dot"></div></div>
      <div style="position:absolute;top:60px;left:16px;right:16px;padding:12px 14px;background:rgba(251,250,246,0.94);backdrop-filter:blur(20px);border:1px solid rgba(11,31,23,0.08);border-radius:22px;box-shadow:0 10px 26px rgba(11,31,23,0.14);display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:14px;background:var(--lkv-forest-800);color:#fff;display:flex;align-items:center;justify-content:center;">${ICON("gps")}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--lkv-font-mono);font-size:10px;color:var(--lkv-forest-800);font-weight:600;letter-spacing:0.1em;">GPS OK · ON ROUTE</div>
          <div style="font-size:18px;font-weight:500;letter-spacing:-0.015em;margin-top:2px;">Navigation <em style="font-family:var(--lkv-font-serif);font-style:italic;color:var(--lkv-forest-800);font-weight:400;">démarrée</em></div>
          <div style="font-size:11px;color:var(--lkv-ink-500);font-family:var(--lkv-font-mono);margin-top:3px;letter-spacing:0.04em;">0,0 / 14,2 km · départ ${HIKE.location}</div>
        </div>
      </div>
      <button data-act="return-prep" style="position:absolute;bottom:32px;left:50%;transform:translateX(-50%);padding:10px 18px 10px 14px;background:rgba(23,64,44,0.95);color:#fff;border-radius:999px;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:500;box-shadow:0 8px 20px rgba(11,31,23,0.25);">
        ${ICON("back")} <span>Revenir à la <em style="font-family:var(--lkv-font-serif);font-style:italic;color:var(--lkv-sage-300);font-weight:400;">préparation</em></span>
      </button>
    </div>
  `;
}

// ─── EXPOSED for the cockpit boards (multi-artboard view) ─────
window.LKV_Prep = {
  render, resetState, HIKE, WEATHER, NEEDS, evaluateAll, computeScore,
  ICON, addToInventory, ignoreForHike, markManuallyOk,
  STATE: () => STATE,
  // helpers for the cockpit-planche mock states
  simulate: {
    freshInventory: () => {
      // wipe user's local state to defaults — DESTRUCTIVE for demo only
      localStorage.removeItem(STORAGE_KEY);
      STATE = loadState();
    }
  }
};

// ─── auto-boot ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Fresh demo state on every load so the interactive board is
  // predictable — user's real added items would persist elsewhere.
  const params = new URLSearchParams(location.search);
  if (params.get("keep") !== "1") {
    localStorage.removeItem(STORAGE_KEY);
    STATE = loadState();
  }
  if (document.querySelector("#prep-screen")) render("#prep-screen");
});
