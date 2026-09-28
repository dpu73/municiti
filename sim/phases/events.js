// Phase 7 — Events. Spec §9
import { clamp } from '../state.js';

export function events(state, config, rng) {
  const roll = rng.d100();
  let event = null;

  if (roll <= config.STORM_MAX_ROLL && state.infrastructure.length) {
    const target = rng.pick(state.infrastructure);
    target.condition = clamp(target.condition - config.STORM_DAMAGE, 0, 100);
    event = { type: 'storm', target: target.id, damage: config.STORM_DAMAGE };
  } else if (roll <= config.GRANT_MAX_ROLL) {
    state.treasury += config.GRANT_AMOUNT;
    event = { type: 'grant', amount: config.GRANT_AMOUNT };
  }

  state.lastTurn.roll = roll;
  state.lastTurn.event = event;
  if (event) state.log.push({ turn: state.turn, ...event });
  return state;
}
