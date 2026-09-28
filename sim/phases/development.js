// Phase 6 — Development. Spec §7
import { occupancyFraction } from '../state.js';

export function development(state, config) {
  let started = 0, completed = 0;

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
  if (state.desirability > 50 && occ >= config.ABSORPTION_TRIGGER) {
    for (const lot of state.lots) {
      if (started >= config.ABSORPTION_RATE) break;
      if (lot.state === 'vacant') {
        lot.state = 'construction';
        lot.turnsRemaining = config.BUILD_TURNS;
        started++;
      }
    }
  }

  state.lastTurn.lotsStarted = started;
  state.lastTurn.lotsCompleted = completed;
  return state;
}
