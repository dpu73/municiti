#!/usr/bin/env node
// Run N turns headless and print a table. Spec §11 defines what "working" means.
//
//   node sim/run.js                    default budget, 120 turns
//   node sim/run.js --turns 60
//   node sim/run.js --scenario stingy   see SCENARIOS below
//   node sim/run.js --seed 7

import { createTurnZero } from './state.js';
import { createRng } from './rng.js';
import { resolveTurn, canIncorporate, incorporate } from './resolveTurn.js';

export const SCENARIOS = {
  // Balanced: roads fully maintained ($400/mo) + modest repair capital, services for ~15 people.
  balanced: { publicWorks: { operations: 4_800, capital: 2_400 }, services: { operations: 6_000, capital: 0 }, millage: 8 },
  // Stingy: minimal everything, no capital. Roads die, people leave.
  stingy:   { publicWorks: { operations: 1_200, capital: 0 }, services: { operations: 1_200, capital: 0 }, millage: 8 },
  // Lavish: overspend on services and capital. Grows fast, bleeds cash.
  lavish:   { publicWorks: { operations: 4_800, capital: 6_000 }, services: { operations: 18_000, capital: 0 }, millage: 8 },
  // Taxman: balanced budgets paid for with high millage.
  taxman:   { publicWorks: { operations: 4_800, capital: 2_400 }, services: { operations: 6_000, capital: 0 }, millage: 16 },
  // Potholes: pays for services, never repairs anything. Isolates the infrastructure lever.
  potholes: { publicWorks: { operations: 1_200, capital: 0 }, services: { operations: 6_000, capital: 0 }, millage: 8 },
};

export function runScenario({ scenario = 'balanced', turns = 120, seed = 1, autoIncorporate = true } = {}) {
  const s = SCENARIOS[scenario];
  if (!s) throw new Error(`unknown scenario "${scenario}" — options: ${Object.keys(SCENARIOS).join(', ')}`);

  const rng = createRng(seed);
  let state = createTurnZero({ budget: { publicWorks: s.publicWorks, services: s.services }, millage: s.millage });
  const history = [state];

  for (let t = 0; t < turns; t++) {
    state = resolveTurn(state, rng);
    if (autoIncorporate && canIncorporate(state)) state = incorporate(state);
    history.push(state);
  }
  return history;
}

// ── table output ─────────────────────────────────────────────────────────────

const fmt$ = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const pad = (v, w) => String(v).padStart(w);

export function printTable(history, every = 6) {
  console.log(
    pad('turn', 4), pad('pop', 4), pad('des', 5), pad('road', 5), pad('treasury', 11),
    pad('rev/mo', 8), pad('exp/mo', 8), pad('lots', 4), pad('occ', 3), pad('bld', 3), pad('def', 3), ' inc  event',
  );
  for (const st of history) {
    if (st.turn % every !== 0 && st.turn !== history.length - 1) continue;
    const lt = st.lastTurn;
    const occ = st.lots.filter(l => l.state === 'occupied').length;
    const bld = st.lots.filter(l => l.state === 'construction').length;
    const road = st.infrastructure[0]?.condition ?? 0;
    console.log(
      pad(st.turn, 4), pad(st.population, 4), pad(st.desirability.toFixed(1), 5), pad(road.toFixed(0), 5),
      pad(fmt$(st.treasury), 11), pad(fmt$(lt.revenue ?? 0), 8), pad(fmt$(lt.expenses ?? 0), 8),
      pad(st.lots.length, 4), pad(occ, 3), pad(bld, 3), pad(st.deficitStreak, 3),
      st.incorporated ? '  ✓  ' : '     ', lt.event ? lt.event.type : '',
    );
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const isMain = typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const args = process.argv.slice(2);
  const get = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
  const opts = {
    scenario: get('--scenario', 'balanced'),
    turns: Number(get('--turns', 120)),
    seed: Number(get('--seed', 1)),
  };
  console.log(`\nMuniCity sim — scenario: ${opts.scenario}, turns: ${opts.turns}, seed: ${opts.seed}\n`);
  const history = runScenario(opts);
  printTable(history);
  const last = history.at(-1);
  console.log(`\nfinal: pop ${last.population}, desirability ${last.desirability.toFixed(1)}, treasury ${fmt$(last.treasury)}, ${last.log.length} logged events\n`);
}
