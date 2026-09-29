// Turn-zero state factory and shared state helpers.
// Spec reference: docs/one-turn-spec.md §0
//
// State is plain JSON-serializable data. No classes, no methods — so it can be
// saved, diffed, sent over a wire for multiplayer, and inspected in a table.

import { config as defaultConfig } from './config.js';

/**
 * Build the founding state vector.
 * @param {object} decisions  The player's turn-zero choices.
 * @param {object} decisions.budget   Annual $ per department: { publicWorks: {operations, capital}, services: {...} }
 * @param {number} [decisions.millage]
 * @param {object} [decisions.policy]   Standing rules the sim applies without asking: { autoZone }
 */
export function createTurnZero(decisions, config = defaultConfig) {
  const budget = decisions.budget;
  if (!budget?.publicWorks || !budget?.services) {
    throw new Error('createTurnZero: budget must define publicWorks and services');
  }

  const lots = [];
  for (let i = 0; i < config.START_LOTS; i++) {
    lots.push({
      id: `lot-${i}`,
      zone: 'residential',
      state: 'vacant',            // vacant | construction | occupied
      turnsRemaining: 0,
      capacity: config.LOT_CAPACITY,
      assessedValue: config.ASSESSED_VALUE.residential,
    });
  }

  return {
    turn: 0,
    incorporated: false,
    treasury: config.START_TREASURY,
    deficitStreak: 0,
    population: 1,
    desirability: 50,
    migrationCarry: 0,          // fractional people carried between turns (spec §6)
    policy: { autoZone: true, ...(decisions.policy ?? {}) },
    millage: decisions.millage ?? config.DEFAULT_MILLAGE,
    budget,
    tile: {
      climate: config.CLIMATE,
      weatherMod: 1.0,          // set each turn from the climate profile
      seed: { type: 'farmland', income: config.SEED_INCOME },
    },
    assets: [],                 // vehicles and equipment you own (spec §12b)
    debt: [],                   // loans and bonds (spec §12)
    credit: { grade: 'B', score: 70, reviewedTurn: 0, inputs: null, previous: null },
    county: { baseRate: config.START_BASE_RATE },
    fiscal: { deficitMonthsYTD: 0, revenueYTD: 0, debtServiceYTD: 0, lastYear: null },
    infrastructure: [
      { id: 'road-0', type: 'road', condition: 100, maintNeed: config.ROAD_MAINT_NEED },
    ],
    lots,
    // Per-turn scratch values, rewritten each turn. Kept on state so the
    // table can show them and so later phases can read earlier ones.
    lastTurn: {},
    log: [],
  };
}

// ── helpers shared by phases ────────────────────────────────────────────────

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function occupiedLots(state) {
  return state.lots.filter(l => l.state === 'occupied');
}

export function housingCapacity(state) {
  return occupiedLots(state).reduce((sum, l) => sum + l.capacity, 0);
}

/** population / capacity; 1.0 when there is no housing at all. */
export function occupancyFraction(state) {
  const cap = housingCapacity(state);
  return cap === 0 ? 1.0 : state.population / cap;
}

export function annualBudgetTotal(deptBudget) {
  return (deptBudget.operations ?? 0) + (deptBudget.capital ?? 0);
}
