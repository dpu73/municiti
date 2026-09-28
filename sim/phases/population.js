// Phase 5 — Population. Spec §6
import { housingCapacity } from '../state.js';

export function population(state, config) {
  const capacity = housingCapacity(state);
  const vacancy = capacity - state.population;
  const pressure = (state.desirability - 50) / 50;      // -1 .. +1

  let net = Math.round(config.MIGRATION_K * state.population * pressure);

  if (net > 0) {
    net = Math.min(net, Math.max(vacancy, 0));
  } else if (net === 0 && pressure > 0 && vacancy > 0) {
    // Floor: at tiny populations 2% rounds to zero forever. Let the first settlers arrive.
    net = Math.min(config.MIGRATION_FLOOR, vacancy);
  }

  state.population = Math.max(1, state.population + net);
  state.lastTurn.netMigration = net;
  state.lastTurn.vacancy = vacancy;
  return state;
}
