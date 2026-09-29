// Phase 8 — County oversight. Spec §12 (takeover).
// Runs last. Decides whether the county takes over, what it does while in charge,
// and when it hands the town back. "A humiliation with real fallout, not terminal."
import { annualOpex, reserveMonths } from '../finance.js';

export function oversight(state, config) {
  const opex = annualOpex(state);

  if (!state.takeover) {
    const slow = state.deficitStreak >= config.TAKEOVER_DEFICIT_MONTHS;
    const fast = opex > 0 && state.treasury < -(opex / 12) * config.TAKEOVER_BALANCE_MONTHS;
    if (slow || fast) {
      state.takeover = { sinceTurn: state.turn, reason: slow ? 'deficit months' : 'balance', sold: [], budgetBefore: structuredClone(state.budget), millageBefore: state.millage };
      state.log.push({ turn: state.turn, type: 'county takeover', reason: state.takeover.reason });
      state.credit.probation = true;
    }
    state.lastTurn.takeover = !!state.takeover;
    return state;
  }

  // ── under takeover: austerity every month ────────────────────────────
  const maintNeed = state.infrastructure.reduce((s, i) => s + i.maintNeed, 0) * 12;
  state.budget.publicWorks = { operations: Math.round(maintNeed * config.AUSTERITY_MAINT_RATIO), capital: 0 };
  state.budget.services = { operations: Math.round(state.population * config.SERVICE_NEED_PER_CAPITA * config.AUSTERITY_SERVICE_RATIO), capital: 0 };
  state.millage = Math.min(config.AUSTERITY_MILLAGE_CAP, Math.max(state.millage, Math.round(state.takeover.millageBefore * config.AUSTERITY_MILLAGE_MULT * 2) / 2));
  state.policy.autoZone = false;
  for (const a of state.assets) if (a.tier !== 'base') a.idled = true;

  // Still underwater after the grace period: sell assets, worst first.
  const monthsIn = state.turn - state.takeover.sinceTurn;
  const sellable = state.assets.filter(a => a.tier !== 'base');
  if (state.treasury < 0 && monthsIn >= config.TAKEOVER_SELL_AFTER && sellable.length) {
    const a = [...sellable].sort((x, y) => x.condition - y.condition)[0];
    const price = Math.round(a.price * config.SALVAGE_RATIO * a.condition / 100);
    state.treasury += price;
    state.assets = state.assets.filter(x => x.id !== a.id);
    state.takeover.sold.push({ turn: state.turn, label: a.label, price });
    state.log.push({ turn: state.turn, type: 'asset sold by county', what: a.label, price });
  }

  // ── exit ──────────────────────────────────────────────────────────────
  if (state.treasury > 0 && reserveMonths(state) >= config.TAKEOVER_EXIT_RESERVE) {
    for (const a of state.assets) a.idled = false;
    state.policy.autoZone = true;
    state.log.push({ turn: state.turn, type: 'control returned', after: monthsIn, sold: state.takeover.sold.length });
    state.takeover = null;
  }
  state.lastTurn.takeover = !!state.takeover;
  return state;
}
