// Phase 2 — Expenses. Spec §3
//
// Operations are charged in full every month. Capital is NOT charged here —
// it's an allowance that Phase 3 draws down for repairs. Owned assets cost
// their maintNeed every month once the warranty is up.
export function expenses(state, config) {
  let opex = 0;
  for (const dept of Object.values(state.budget)) {
    opex += (dept.operations ?? 0) / 12;
  }

  let assetUpkeep = 0;
  for (const a of state.assets) {
    if (state.turn < a.arrivesTurn) continue;
    if (state.turn <= a.warrantyUntil) continue;
    assetUpkeep += a.maintNeed;
  }

  // Debt service: level payments; principal shrinks; paid-off notes drop away.
  let debtService = 0;
  for (const d of state.debt) {
    const interest = d.principal * d.rate / 12;
    const toPrincipal = Math.min(d.principal, d.payment - interest);
    d.principal -= toPrincipal;
    d.remainingTurns -= 1;
    debtService += interest + toPrincipal;
  }
  state.debt = state.debt.filter(d => d.principal > 0.5 && d.remainingTurns > 0);

  const total = opex + assetUpkeep + debtService;
  state.treasury -= total;
  state.deficitStreak = state.treasury < 0 ? state.deficitStreak + 1 : 0;
  if (state.treasury < 0) state.fiscal.deficitMonthsYTD += 1;
  state.fiscal.debtServiceYTD += debtService;

  state.lastTurn.opex = opex;
  state.lastTurn.assetUpkeep = assetUpkeep;
  state.lastTurn.debtService = debtService;
  state.lastTurn.expenses = total;   // later phases add to this
  return state;
}
