// Debt, credit rating, borrowing. Spec §12.
import { clamp, occupiedLots } from './state.js';

export const GRADES = ['A', 'B', 'C', 'D', 'F'];

/** Level-payment amortization; r is the annual rate, n the term in months. */
export function monthlyPayment(principal, annualRate, n) {
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

export function assessedValueTotal(state) {
  return occupiedLots(state).reduce((s, l) => s + l.assessedValue, 0);
}

export function outstandingPrincipal(state) {
  return state.debt.reduce((s, d) => s + d.principal, 0);
}

/** Hard cap. Incorporated: share of assessed value. Unincorporated: county product caps. */
export function debtCapacity(state, config) {
  if (state.incorporated) return config.DEBT_LIMIT_RATIO * assessedValueTotal(state);
  return config.COUNTY_LOAN_SHORT_CAP + config.COUNTY_LOAN_LONG_CAP;
}

export function annualOpex(state) {
  return Object.values(state.budget).reduce((s, d) => s + (d.operations ?? 0), 0);
}

export function reserveMonths(state) {
  const opex = annualOpex(state);
  return opex ? state.treasury / (opex / 12) : Infinity;
}

export function annualDebtService(state) {
  return state.debt.reduce((s, d) => s + d.payment, 0) * 12;
}

/** Products the player can borrow against right now. */
export function loanProducts(state, config) {
  const g = state.credit.grade;
  const base = state.county.baseRate;
  const spread = config.RATING_SPREAD[g];
  const out = outstandingPrincipal(state);
  const products = [];

  // County loans: always available, worse terms, flat caps, penalty at F.
  const countyPenalty = g === 'F' ? config.COUNTY_F_PENALTY : 0;
  const countyOut = state.debt.filter(d => d.kind === 'county').reduce((s, d) => s + d.principal, 0);
  products.push({
    id: 'county-short', kind: 'county', label: 'County loan — 5 yr',
    rate: base + spread + config.COUNTY_SHORT_SPREAD + countyPenalty, termTurns: 60,
    max: Math.max(0, config.COUNTY_LOAN_SHORT_CAP - countyOut),
  });
  products.push({
    id: 'county-long', kind: 'county', label: 'County loan — 15 yr',
    rate: base + spread + config.COUNTY_LONG_SPREAD + countyPenalty, termTurns: 180,
    max: Math.max(0, config.COUNTY_LOAN_SHORT_CAP + config.COUNTY_LOAN_LONG_CAP - countyOut),
  });

  // Municipal bonds: incorporated only, market closed at F, capped by assessed value.
  if (state.incorporated && g !== 'F') {
    const room = Math.max(0, debtCapacity(state, config) - out);
    products.push({ id: 'bond-10', kind: 'bond', label: 'General obligation bond — 10 yr', rate: base + spread, termTurns: 120, max: room });
    products.push({ id: 'bond-20', kind: 'bond', label: 'General obligation bond — 20 yr', rate: base + spread + config.BOND_LONG_SPREAD, termTurns: 240, max: room });
  }
  return products;
}

export function borrow(state, product, amount) {
  if (state.takeover) throw new Error('no borrowing during a county takeover');
  amount = Math.round(amount);
  if (!(amount > 0)) throw new Error('borrow: amount must be positive');
  if (amount > product.max + 0.5) throw new Error(`borrow: ${amount} exceeds ${product.label} limit of ${Math.round(product.max)}`);
  const next = structuredClone(state);
  next.treasury += amount;
  next.debt.push({
    id: `${product.id}-${next.turn}-${next.debt.length}`,
    kind: product.kind, label: product.label,
    principal: amount, original: amount,
    rate: product.rate, termTurns: product.termTurns, remainingTurns: product.termTurns,
    payment: monthlyPayment(amount, product.rate, product.termTurns),
    issuedTurn: next.turn,
  });
  next.log.push({ turn: next.turn, type: 'borrowed', what: product.label, amount, rate: product.rate });
  return next;
}

/**
 * Annual credit review + rate environment drift. Called once per year by the runner
 * (not inside resolveTurn) so the result can be shown on the budget screen.
 */
export function annualReview(state, config, rng) {
  const next = structuredClone(state);
  const f = next.fiscal;

  // Score 0–100 from four inputs already in state.
  const rm = reserveMonths(next);
  const reservesPts = clamp(rm / config.REVIEW_RESERVE_TARGET, 0, 1) * 40;
  const deficitPts = clamp(1 - f.deficitMonthsYTD / 5, 0, 1) * 25;
  const cap = debtCapacity(next, config);
  const leverage = cap > 0 ? outstandingPrincipal(next) / cap : 0;
  const leveragePts = clamp(1 - leverage, 0, 1) * 20;
  const dsr = f.revenueYTD > 0 ? f.debtServiceYTD / f.revenueYTD : 0;
  const dsrPts = clamp(1 - (dsr - 0.10) / 0.20, 0, 1) * 15;
  const score = reservesPts + deficitPts + leveragePts + dsrPts;
  let grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  if (state.credit.probation && grade !== 'F') grade = 'D';   // one cycle of probation after a takeover

  next.credit = {
    grade, score: Math.round(score), reviewedTurn: next.turn,
    inputs: { reserveMonths: rm, deficitMonths: f.deficitMonthsYTD, leverage, debtServiceRatio: dsr },
    previous: state.credit.grade,
    probation: !!state.takeover,   // stays on while the county is still in charge
  };

  // Rate environment: bounded random walk, once a year.
  const drift = (rng.next() - 0.5) * 2 * config.RATE_DRIFT;
  next.county.baseRate = clamp(next.county.baseRate + drift, config.RATE_FLOOR, config.RATE_CEILING);

  next.fiscal = { deficitMonthsYTD: 0, revenueYTD: 0, debtServiceYTD: 0, lastYear: { ...f, debtServiceRatio: dsr } };
  next.log.push({ turn: next.turn, type: 'credit review', grade, score: Math.round(score) });
  return next;
}
