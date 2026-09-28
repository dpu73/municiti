// resolveTurn — runs the seven phases in strict order. Spec §1
//
// Pure in the sense that matters: given the same state, config and rng seed it
// produces the same next state. It mutates a *copy* of the input so callers can
// keep history (and so a future multiplayer host can diff turns).

import { config as defaultConfig } from './config.js';
import { revenue }      from './phases/revenue.js';
import { expenses }     from './phases/expenses.js';
import { degradation }  from './phases/degradation.js';
import { desirability } from './phases/desirability.js';
import { population }   from './phases/population.js';
import { development }  from './phases/development.js';
import { events }       from './phases/events.js';

export const PHASES = [
  revenue,
  expenses,
  degradation,
  desirability,
  population,
  development,
  events,
];

export function resolveTurn(prevState, rng, config = defaultConfig) {
  const state = structuredClone(prevState);
  state.turn += 1;
  state.lastTurn = {};

  for (const phase of PHASES) {
    phase(state, config, rng);
  }
  return state;
}

/** Spec §8. A player choice once eligible; the run script calls this on first eligibility. */
export function canIncorporate(state, config = defaultConfig) {
  return !state.incorporated && state.population >= config.INCORPORATION_POP;
}

export function incorporate(state) {
  const next = structuredClone(state);
  next.incorporated = true;
  next.log.push({ turn: next.turn, type: 'incorporated' });
  return next;
}
