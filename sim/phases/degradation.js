// Phase 3 — Weather, snow, degradation, repair. Spec §4, §12b
import { clamp, occupancyFraction } from '../state.js';
import { CLIMATES, monthIndex } from '../climate.js';
import { hasMechanic, inService } from '../catalog.js';

export function degradation(state, config) {
  // ── weather this month ─────────────────────────────────────────────────
  const climate = CLIMATES[state.tile.climate];
  const m = monthIndex(state.turn, config);
  const weatherMod = climate.weatherMod[m];
  const snow = climate.snow[m];
  state.tile.weatherMod = weatherMod;

  // ── snow: who plows, what it costs, how long roads sit closed ─────────
  const roads = state.infrastructure.filter(i => i.type === 'road');
  const plows = state.assets.filter(a => a.type === 'plow' && inService(state, a));
  let passability = 1, plowCost = 0, plowedBy = 'none';

  if (snow > 0 && roads.length) {
    // Condition is efficiency: a 60 plow clears 60% of what a 100 plow does.
    const plowPower = plows.reduce((s, p) => s + p.condition / 100, 0);
    const coverage = clamp(plowPower * config.PLOW_CAPACITY / roads.length, 0, 1);
    const ownCost = plows.length * config.PLOW_OPEX * snow;
    const countyCost = roads.length * (1 - coverage) * config.COUNTY_PLOW_COST * snow;
    const lag = coverage * config.OWN_PLOW_LAG + (1 - coverage) * config.COUNTY_PLOW_LAG;
    passability = 1 - lag * snow;
    plowCost = ownCost + countyCost;
    plowedBy = coverage >= 1 ? 'own' : coverage > 0 ? 'mixed' : 'county';
    for (const p of plows) p.condition = clamp(p.condition - config.PLOW_WEAR * snow, 0, 100);
    state.treasury -= plowCost;
    state.lastTurn.expenses += plowCost;
  }

  // ── assets age ─────────────────────────────────────────────────────────
  const ageDecay = config.ASSET_AGE_DECAY * (hasMechanic(state) ? config.MECHANIC_FACTOR : 1);
  for (const a of state.assets) if (state.turn >= a.arrivesTurn) a.condition = clamp(a.condition - ageDecay, 0, 100);

  // ── decay ──────────────────────────────────────────────────────────────
  const maintNeedTotal = state.infrastructure.reduce((s, i) => s + i.maintNeed, 0);
  const maintFunding = (state.budget.publicWorks.operations ?? 0) / 12;
  const fundingRatio = maintNeedTotal === 0 ? 1 : clamp(maintFunding / maintNeedTotal, 0, 1);

  const occ = state.lots.some(l => l.state === 'occupied') ? occupancyFraction(state) : 0;
  const usageMod = 1 + config.USAGE_WEIGHT * clamp(occ, 0, 1);
  const decay = config.BASE_DECAY * weatherMod * usageMod * (2 - fundingRatio);

  for (const obj of state.infrastructure) {
    obj.condition = clamp(obj.condition - decay, 0, 100);
  }

  // ── repair: monthly capital allowance, worst-first, charged as used ────
  let allowance = (state.budget.publicWorks.capital ?? 0) / 12;
  const truck = state.assets.some(a => a.type === 'road-truck' && inService(state, a));
  const costPerPoint = config.REPAIR_COST_PER_POINT / (truck ? 1 + config.ROAD_TRUCK_REPAIR_BONUS : 1);
  let spent = 0;
  const repairable = [...state.infrastructure, ...state.assets.filter(a => state.turn >= a.arrivesTurn && !a.idled)]
    .sort((a, b) => a.condition - b.condition);

  for (const obj of repairable) {
    if (allowance <= 0) break;
    const need = 100 - obj.condition;
    if (need <= 0) continue;
    const cpp = obj.maintNeed != null && obj.type == null ? costPerPoint : config.REPAIR_COST_PER_POINT; // truck helps roads, not itself
    const points = Math.min(need, allowance / cpp);
    obj.condition += points;
    const cost = points * cpp;
    allowance -= cost;
    spent += cost;
  }

  state.treasury -= spent;
  if (state.treasury < 0) state.deficitStreak = Math.max(state.deficitStreak, 1);
  state.lastTurn.expenses += spent;

  Object.assign(state.lastTurn, {
    month: m, weatherMod, snow, passability, plowCost, plowedBy,
    fundingRatio, decay, repairSpend: spent, roadTruck: truck,
    outOfService: state.assets.filter(a => state.turn >= a.arrivesTurn && !a.idled && a.condition < config.OUT_OF_SERVICE_BELOW).map(a => a.id),
  });
  return state;
}
