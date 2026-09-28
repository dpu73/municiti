// Phase 2 — Expenses. Spec §3
export function expenses(state, config) {
  let opex = 0, capex = 0;
  for (const dept of Object.values(state.budget)) {
    opex  += (dept.operations ?? 0) / 12;
    capex += (dept.capital ?? 0) / 12;
  }
  const total = opex + capex;

  state.treasury -= total;
  state.deficitStreak = state.treasury < 0 ? state.deficitStreak + 1 : 0;

  state.lastTurn.opex = opex;
  state.lastTurn.capex = capex;
  state.lastTurn.expenses = total;
  return state;
}
