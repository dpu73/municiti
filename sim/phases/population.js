// Phase 5 — Population. Spec §6
import { housingCapacity } from '../state.js';

export function population(state, config) {
  const capacity = housingCapacity(state);
  const vacancy = capacity - state.population;
  const pressure = (state.desirability - 50) / 50;      // -1 .. +1

  // Two pulls: word-of-mouth (proportional to who's already here) and the
  // seed itself (independent of population — what founds the town).
  const flow = config.MIGRATION_K * state.population * pressure
             + config.SEED_PULL * pressure;

  // Fractional carry: nothing is lost to rounding between turns.
  state.migrationCarry += flow;
  let net = Math.trunc(state.migrationCarry);
  state.migrationCarry -= net;

  if (net > 0) {
    const room = Math.max(vacancy, 0);
    if (net > room) {
      // Would-be arrivals who found no housing don't queue up forever.
      state.migrationCarry = 0;
      net = room;
    }
  }

  const before = state.population;
  state.population = Math.max(1, state.population + net);
  state.lastTurn.netMigration = state.population - before;
  state.lastTurn.vacancy = vacancy;
  return state;
}
