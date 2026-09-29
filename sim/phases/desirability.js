// Phase 4 — Desirability. Spec §5
import { clamp } from '../state.js';

export function desirability(state, config) {
  const W = config.DESIRABILITY_WEIGHTS;

  const serviceNeed = state.population * config.SERVICE_NEED_PER_CAPITA;
  const serviceQuality = serviceNeed === 0
    ? 100
    : clamp((state.budget.services.operations ?? 0) / serviceNeed, 0, 1) * 100;

  // Road condition, discounted by how much of the month roads were snowed shut.
  const meanCondition = state.infrastructure.length === 0
    ? 50
    : state.infrastructure.reduce((s, i) => s + i.condition, 0) / state.infrastructure.length;
  const infra = meanCondition * (state.lastTurn.passability ?? 1);

  const taxBurden = 100 - clamp(state.millage / config.MILLAGE_REF * 50, 0, 100);

  const safety = serviceQuality;   // stub until police is its own department
  const amenities = 50;            // stub until parks exist

  state.desirability =
      W.serviceQuality * serviceQuality
    + W.infrastructure * infra
    + W.taxBurden      * taxBurden
    + W.safety         * safety
    + W.amenities      * amenities;

  state.lastTurn.inputs = { serviceQuality, infra, taxBurden, safety, amenities };
  return state;
}
