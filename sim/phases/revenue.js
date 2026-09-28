// Phase 1 — Revenue. Spec §2
import { occupiedLots } from '../state.js';

export function revenue(state, config) {
  const propertyTax = occupiedLots(state)
    .reduce((sum, lot) => sum + (lot.assessedValue * state.millage / 1000) / 12, 0);

  const seedIncome = state.incorporated ? 0 : state.tile.seed.income;
  const total = propertyTax + seedIncome;

  state.treasury += total;
  state.lastTurn.propertyTax = propertyTax;
  state.lastTurn.seedIncome = seedIncome;
  state.lastTurn.revenue = total;
  return state;
}
