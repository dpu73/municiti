// Phase 3 — Degradation, then repair. Spec §4
import { clamp, occupancyFraction } from '../state.js';

export function degradation(state, config) {
  // ── decay ──────────────────────────────────────────────────────────────
  const maintNeedTotal = state.infrastructure.reduce((s, i) => s + i.maintNeed, 0);
  const maintFunding = (state.budget.publicWorks.operations ?? 0) / 12;
  const fundingRatio = maintNeedTotal === 0 ? 1 : clamp(maintFunding / maintNeedTotal, 0, 1);

  const occ = state.lots.some(l => l.state === 'occupied') ? occupancyFraction(state) : 0;
  const usageMod = 1 + config.USAGE_WEIGHT * clamp(occ, 0, 1);

  const decay = config.BASE_DECAY * state.tile.weatherMod * usageMod * (2 - fundingRatio);

  for (const obj of state.infrastructure) {
    obj.condition = clamp(obj.condition - decay, 0, 100);
  }

  // ── repair ─────────────────────────────────────────────────────────────
  // Monthly capital allowance, spent worst-first, charged only as used.
  let allowance = (state.budget.publicWorks.capital ?? 0) / 12;
  let spent = 0;
  const worstFirst = [...state.infrastructure].sort((a, b) => a.condition - b.condition);

  for (const obj of worstFirst) {
    if (allowance <= 0) break;
    const need = 100 - obj.condition;
    if (need <= 0) continue;
    const affordable = allowance / config.REPAIR_COST_PER_POINT;
    const points = Math.min(need, affordable);
    obj.condition += points;
    const cost = points * config.REPAIR_COST_PER_POINT;
    allowance -= cost;
    spent += cost;
  }

  state.treasury -= spent;
  state.deficitStreak = state.treasury < 0 ? Math.max(state.deficitStreak, 1) : state.deficitStreak;
  state.lastTurn.expenses += spent;
  state.lastTurn.fundingRatio = fundingRatio;
  state.lastTurn.decay = decay;
  state.lastTurn.repairSpend = spent;
  return state;
}
