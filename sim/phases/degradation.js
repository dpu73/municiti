// Phase 3 — Degradation. Spec §4
import { clamp, occupancyFraction } from '../state.js';

export function degradation(state, config) {
  const maintNeedTotal = state.infrastructure.reduce((s, i) => s + i.maintNeed, 0);
  const maintFunding = (state.budget.publicWorks.operations ?? 0) / 12;
  const fundingRatio = maintNeedTotal === 0 ? 1 : clamp(maintFunding / maintNeedTotal, 0, 1);

  // At turn start nobody lives here yet, so occupancy wear is 0 until housing exists.
  const occ = state.infrastructure.length && housingExists(state) ? occupancyFraction(state) : 0;
  const usageMod = 1 + config.USAGE_WEIGHT * clamp(occ, 0, 1);

  const decay = config.BASE_DECAY * state.tile.weatherMod * usageMod * (2 - fundingRatio);

  for (const obj of state.infrastructure) {
    obj.condition = clamp(obj.condition - decay, 0, 100);
  }

  state.lastTurn.fundingRatio = fundingRatio;
  state.lastTurn.decay = decay;
  return state;
}

function housingExists(state) {
  return state.lots.some(l => l.state === 'occupied');
}
