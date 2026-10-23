import { calculateWeightBreakdown } from '../materiel/domain/shakedownEngine';

export const ENGINE_VERSION = 'lkdv-simulation-1.0.0';
export type Mode = 'balanced' | 'ul' | 'eco';
export type Acquisition = 'owned' | 'loan' | 'rent' | 'used' | 'new';
export type Slot = 'pack' | 'shelter' | 'bag' | 'pad' | 'rain' | 'light' |
  'first_aid' | 'navigation' | 'water_container' | 'water_treatment' | 'cook';
export interface Spec {
  productId: string;
  slot: Slot;
  name: string;
  weightG: number | null;
  volumeMl: number | null;
  comfortC: number | null;
  rValue: number | null;
  verified: boolean;
}
export interface Option {
  id: string;
  spec: Spec;
  source: Acquisition;
  priceCents: number;
  currency: 'EUR';
  availableUnits: number;
  validUntil: string;
  measuredWeightG: number | null;
  worn: boolean;
}
export interface Requirement { slot: Slot; quantity: number }
export interface Conditions {
  accommodation: 'tent' | 'tarp' | 'refuge' | 'hotel';
  cooking: boolean;
  naturalWater: boolean;
  minTempC: number | null;
  minimumPadR: number | null;
  coldMarginC: number;
}
export interface Limits {
  mode: Mode;
  budgetCents: number;
  packWeightG: number;
  packedVolumeMl: number;
  beamWidth: number;
  candidatesPerSlot: number;
}
export interface Selected { option: Option; quantity: number }
export interface Result {
  version: string;
  items: Selected[];
  missing: Slot[];
  warnings: string[];
  costCents: number;
  baseWeightG: number;
  wornWeightG: number;
  consumablesWeightG: number | null;
  packWeightG: number | null;
  knownPackWeightG: number;
  volumeMl: number | null;
  coverage: 'complete' | 'incomplete';
  constraintStatus: 'within_preferences' | 'exceeded' | 'unknown';
  search: { algorithm: string; exhaustive: false; beamWidth: number };
}
export function finite(value: number, min: number, max: number, field: string): void {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`Valeur invalide : ${field}`);
}
export function requirements(c: Conditions): Requirement[] {
  const slots: Slot[] = ['pack','rain','light','first_aid','navigation','water_container'];
  if (c.accommodation !== 'hotel') slots.push('bag');
  if (c.accommodation === 'tent' || c.accommodation === 'tarp') {
    slots.push('shelter','pad');
  }
  if (c.cooking) slots.push('cook');
  if (c.naturalWater) slots.push('water_treatment');
  return slots.map(slot => ({slot,quantity:1}));
}
function eligible(o: Option, r: Requirement, c: Conditions, nowMs: number): boolean {
  if (!o.spec.verified || o.spec.slot !== r.slot) return false;
  if (o.availableUnits < r.quantity) return false;
  if (!Number.isFinite(Date.parse(o.validUntil)) || Date.parse(o.validUntil) <= nowMs) return false;
  if (r.slot === 'bag' && c.minTempC !== null) {
    if (o.spec.comfortC === null || o.spec.comfortC > c.minTempC-c.coldMarginC) return false;
  }
  if (r.slot === 'pad' && c.minimumPadR !== null) {
    if (o.spec.rValue === null || o.spec.rValue < c.minimumPadR) return false;
  }
  return true;
}
export function weightOf(o: Option): number | null {
  return o.measuredWeightG ?? o.spec.weightG;
}
interface State {
  items: Selected[]; missing: Slot[]; cost: number; mass: number;
  volume: number; unknownMass: boolean; unknownVolume: boolean;
}
function objective(s: State, l: Limits): number {
  const weight = s.mass / Math.max(1,l.packWeightG);
  const cost = s.cost / Math.max(1,l.budgetCents);
  const volume = s.volume / Math.max(1,l.packedVolumeMl);
  return l.mode==='ul' ? 0.8*weight+0.1*cost+0.1*volume :
    l.mode==='eco' ? 0.15*weight+0.75*cost+0.1*volume :
      0.45*weight+0.4*cost+0.15*volume;
}
function signature(s: State): string {
  return s.items.map(x=>`${x.option.id}:${x.quantity}`).sort().join('|');
}
export function optimize(
  options: readonly Option[], reqs: readonly Requirement[], conditions: Conditions,
  limits: Limits, nowIso: string, consumablesG: number | null
): Result {
  finite(conditions.coldMarginC,0,15,'marge thermique');
  if(conditions.minTempC!==null) finite(conditions.minTempC,-60,50,'température');
  if(conditions.minimumPadR!==null) finite(conditions.minimumPadR,0,15,'R-value');
  finite(limits.budgetCents,0,100000000,'budget');
  finite(limits.packWeightG,1,100000,'poids préféré');
  finite(limits.packedVolumeMl,1,500000,'volume');
  finite(limits.beamWidth,1,256,'largeur recherche');
  finite(limits.candidatesPerSlot,1,32,'candidats');
  if (!Number.isInteger(limits.beamWidth)||!Number.isInteger(limits.candidatesPerSlot))
    throw new Error('Bornes de recherche entières requises');
  if (consumablesG!==null) finite(consumablesG,0,100000,'consommables');
  const nowMs=Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) throw new Error('Horloge invalide');
  if (reqs.length>32 || options.length>2048) throw new Error('Charge moteur excessive');
  if (new Set(reqs.map(r=>r.slot)).size!==reqs.length) throw new Error('Slots dupliqués');
  if (new Set(options.map(o=>o.id)).size!==options.length) throw new Error('Options dupliquées');
  for (const r of reqs) {
    finite(r.quantity,1,100,'quantité');
    if (!Number.isInteger(r.quantity)) throw new Error('Quantité entière requise');
  }
  for (const o of options) {
    finite(o.priceCents,0,100000000,'prix');
    finite(o.availableUnits,0,100,'disponibilité');
    if (!Number.isInteger(o.priceCents)||!Number.isInteger(o.availableUnits))
      throw new Error('Prix et quantités entiers requis');
    if (o.source==='owned' && o.priceCents!==0) throw new Error('Coût détenu incohérent');
    if(o.spec.weightG!==null) finite(o.spec.weightG,0,100000,'poids catalogue');
    if(o.measuredWeightG!==null) finite(o.measuredWeightG,0,100000,'poids mesuré');
    if(o.spec.volumeMl!==null) finite(o.spec.volumeMl,0,500000,'volume article');
  }
  const exceed=(s:State)=>s.cost>limits.budgetCents ||
    s.mass+(consumablesG??0)>limits.packWeightG || s.volume>limits.packedVolumeMl;
  const compare=(a:State,b:State)=>a.missing.length-b.missing.length ||
    Number(exceed(a))-Number(exceed(b)) ||
    Number(a.unknownMass||a.unknownVolume)-Number(b.unknownMass||b.unknownVolume) ||
    objective(a,limits)-objective(b,limits) || signature(a).localeCompare(signature(b),'en');
  let beam:State[]=[{items:[],missing:[],cost:0,mass:0,volume:0,unknownMass:false,unknownVolume:false}];
  for (const r of [...reqs].sort((a,b)=>a.slot.localeCompare(b.slot,'en'))) {
    const candidates=options.filter(o=>eligible(o,r,conditions,nowMs));
    const single=(o:Option):State=>({items:[{option:o,quantity:r.quantity}],missing:[],
      cost:o.priceCents*r.quantity,mass:o.worn?0:(weightOf(o)??0)*r.quantity,
      volume:o.worn?0:(o.spec.volumeMl??0)*r.quantity,
      unknownMass:weightOf(o)===null,unknownVolume:!o.worn&&o.spec.volumeMl===null});
    candidates.sort((a,b)=>compare(single(a),single(b)));
    const next:State[]=[];
    for(const state of beam) {
      if(candidates.length===0) next.push({...state,missing:[...state.missing,r.slot]});
      for(const o of candidates.slice(0,limits.candidatesPerSlot)) {
        if(state.items.some(x=>x.option.id===o.id)) continue;
        const q=r.quantity, mass=weightOf(o);
        next.push({items:[...state.items,{option:o,quantity:q}],missing:state.missing,
          cost:state.cost+o.priceCents*q,
          mass:state.mass+(o.worn?0:(mass??0)*q),
          volume:state.volume+(o.worn?0:(o.spec.volumeMl??0)*q),
          unknownMass:state.unknownMass||mass===null,
          unknownVolume:state.unknownVolume||(!o.worn&&o.spec.volumeMl===null)});
      }
    }
    beam=next.sort(compare).slice(0,limits.beamWidth);
  }
  const best=beam[0];
  if(!best) throw new Error('Aucune solution exploitable');
  const breakdown=calculateWeightBreakdown(best.items.map(({option:o,quantity})=>({
    id:o.id,name:o.spec.name,weightGrams:weightOf(o)??0,category:o.spec.slot,
    status:'packed',quantity,isWorn:o.worn,isConsumable:false
  })));
  const warnings:string[]=[];
  if(conditions.minTempC===null) warnings.push('Météo minimale inconnue : adéquation thermique non établie.');
  if(conditions.minimumPadR===null && reqs.some(r=>r.slot==='pad'))
    warnings.push('Exigence matelas non renseignée : contrôle thermique incomplet.');
  if(best.unknownMass) warnings.push('Poids manquant : total exact indisponible.');
  if(best.unknownVolume) warnings.push('Volume manquant : capacité non établie.');
  if(consumablesG===null) warnings.push('Consommables inconnus : charge exacte indisponible.');
  if(exceed(best)) warnings.push('Au moins une préférence poids, volume ou budget est dépassée.');
  warnings.push('Estimation de préparation, jamais une validation médicale ni une garantie de sécurité.');
  const known=breakdown.totalPackWeightGrams+(consumablesG??0);
  return {version:ENGINE_VERSION,items:best.items,missing:best.missing,warnings,
    costCents:best.cost,baseWeightG:breakdown.baseWeightGrams,
    wornWeightG:breakdown.wornWeightGrams,consumablesWeightG:consumablesG,
    knownPackWeightG:known,
    packWeightG:best.unknownMass||consumablesG===null?null:known,
    volumeMl:best.unknownVolume?null:best.volume,
    coverage:best.missing.length?'incomplete':'complete',
    constraintStatus:exceed(best)?'exceeded':best.unknownMass||best.unknownVolume||consumablesG===null?'unknown':'within_preferences',
    search:{algorithm:'bounded-beam-v1',exhaustive:false,beamWidth:limits.beamWidth}};
}
export interface WaterSegment {
  id:string; walkingHours:number|null; litersPerHour:number|null;
  cookingMl:number; reserveMl:number; reliableRefillAtEnd:boolean;
}
export function waterPlan(segments: readonly WaterSegment[]): {
  departuresMl:Record<string,number|null>; maxCarriedMl:number|null
} {
  if(segments.length>2048) throw new Error('Trop de segments');
  const groups:WaterSegment[][]=[]; let group:WaterSegment[]=[];
  const seen=new Set<string>();
  for(const s of segments) {
    if(!s.id || seen.has(s.id)) throw new Error('Segment non unique');
    seen.add(s.id);
    if(s.walkingHours!==null) finite(s.walkingHours,0,48,'durée segment');
    if(s.litersPerHour!==null) finite(s.litersPerHour,0,5,'débit individuel');
    finite(s.cookingMl,0,10000,'eau cuisson'); finite(s.reserveMl,0,10000,'réserve');
    group.push(s); if(s.reliableRefillAtEnd) {groups.push(group);group=[];}
  }
  if(group.length) groups.push(group);
  const departuresMl:Record<string,number|null>={}; let maximum=0; let unknown=false;
  for(const g of groups) {
    let remaining:number|null=0;let reserve=0;
    for(let i=g.length-1;i>=0;i--) {
      const s=g[i];reserve=Math.max(reserve,s.reserveMl);
      if(s.walkingHours===null||s.litersPerHour===null||remaining===null) remaining=null;
      else remaining+=Math.ceil(s.walkingHours*s.litersPerHour*1000)+s.cookingMl;
      departuresMl[s.id]=remaining===null?null:remaining+reserve;
      if(departuresMl[s.id]===null) unknown=true;
      else maximum=Math.max(maximum,departuresMl[s.id]!);
    }
  }
  return {departuresMl,maxCarriedMl:unknown?null:maximum};
}
export function pandolfWatts(bodyKg:number,loadKg:number,speedMps:number,gradePct:number,terrain:number):number|null {
  finite(bodyKg,20,300,'masse corporelle');finite(loadKg,0,100,'charge');
  finite(speedMps,0,3,'vitesse');finite(terrain,1,5,'terrain');
  finite(gradePct,-100,100,'pente');
  // Bornes de produit conservatrices, PAS domaine de validation clinique.
  // Aucun calcul de descente sans modèle dédié validé séparément.
  if(gradePct<0 || gradePct>20 || speedMps>2) return null;
  return 1.5*bodyKg+2*(bodyKg+loadKg)*(loadKg/bodyKg)**2+
    terrain*(bodyKg+loadKg)*(1.5*speedMps**2+0.35*speedMps*gradePct);
}
export function shareMass(totalG:number,participantIds:readonly string[]):Record<string,number> {
  finite(totalG,0,1000000,'masse à répartir');
  if(!Number.isInteger(totalG)||!participantIds.length||new Set(participantIds).size!==participantIds.length)
    throw new Error('Partage invalide');
  const ids=[...participantIds].sort(); const base=Math.floor(totalG/ids.length);
  return Object.fromEntries(ids.map((id,i)=>[id,base+(i<totalG%ids.length?1:0)]));
}
