// Phase 1 — Revenue. Spec §2
import { occupiedLots } from '../state.js';

export function revenue(state, config) {
  const propertyTax = occupiedLots(state)
    .reduce((sum, lot) => sum + (lot.assessedValue * state.millage / 1000) / 12, 0);

  const seedIncome = state.incorporated ? 0 : state.tile.seed.income;
  const stickerFees = state.population * (state.fees?.sticker ?? 0) / 12;
  const permitFees = state.pendingPermits ?? 0;          // homes started last month pay now
  state.pendingPermits = 0;
  const total = propertyTax + seedIncome + stickerFees + permitFees;

  state.treasury += total;
  state.fiscal.revenueYTD += total;
  state.lastTurn.propertyTax = propertyTax;
  state.lastTurn.seedIncome = seedIncome;
  state.lastTurn.fees = stickerFees + permitFees;
  state.lastTurn.revenue = total;
  return state;
}
