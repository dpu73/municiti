// Phase 6 — Development. Spec §7
import { occupancyFraction } from '../state.js';

export function development(state, config) {
  let started = 0, completed = 0, zoned = 0;

  // Advance construction first so a lot started this turn doesn't also tick.
  for (const lot of state.lots) {
    if (lot.state === 'construction') {
      lot.turnsRemaining -= 1;
      if (lot.turnsRemaining <= 0) {
        lot.state = 'occupied';
        completed++;
      }
    }
  }

  const occ = occupancyFraction(state);
  const demand = state.desirability > 50 && occ >= config.ABSORPTION_TRIGGER;

  // Zoning policy: out of vacant land + demand + can afford it → zone a batch.
  if (demand && state.policy.autoZone && !state.lots.some(l => l.state === 'vacant')) {
    const cost = config.LOT_BATCH * config.LOT_ZONING_COST;
    if (state.treasury >= cost) {
      for (let i = 0; i < config.LOT_BATCH; i++) {
        state.lots.push({
          id: `lot-${state.lots.length}`,
          zone: 'residential',
          state: 'vacant',
          turnsRemaining: 0,
          capacity: config.LOT_CAPACITY,
          assessedValue: config.ASSESSED_VALUE.residential,
        });
      }
      state.treasury -= cost;
      state.lastTurn.expenses += cost;
      zoned = config.LOT_BATCH;
      state.log.push({ turn: state.turn, type: 'zoned', lots: zoned, cost });
    }
  }

  // Absorption: convert vacant lots to construction at a fixed rate.
  if (demand) {
    for (const lot of state.lots) {
      if (started >= config.ABSORPTION_RATE) break;
      if (lot.state === 'vacant') {
        lot.state = 'construction';
        lot.turnsRemaining = config.BUILD_TURNS;
        started++;
      }
    }
  }

  state.lastTurn.lotsZoned = zoned;
  state.lastTurn.lotsStarted = started;
  state.lastTurn.lotsCompleted = completed;
  return state;
}
