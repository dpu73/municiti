// Phase 2 — Expenses. Spec §3
//
// Operations are charged in full every month. Capital is NOT charged here —
// it's an allowance that Phase 3 draws down for repairs, and only actual
// repair spending hits the treasury.
export function expenses(state, config) {
  let opex = 0;
  for (const dept of Object.values(state.budget)) {
    opex += (dept.operations ?? 0) / 12;
  }

  state.treasury -= opex;
  state.deficitStreak = state.treasury < 0 ? state.deficitStreak + 1 : 0;

  state.lastTurn.opex = opex;
  state.lastTurn.expenses = opex;   // Phase 3 adds repair spend to this
  return state;
}
