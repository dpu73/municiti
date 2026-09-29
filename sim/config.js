// Every tunable number in the simulation lives here.
// Spec reference: docs/one-turn-spec.md §10

export const config = Object.freeze({
  // Turn zero
  CLIMATE: 'midwest',
  FOUNDING_MONTH: 3,            // April — first winter arrives at turn 8
  START_TREASURY: 50_000,
  START_LOTS: 12,
  LOT_CAPACITY: 3,              // people per single-family lot
  SEED_INCOME: 1_500,           // $/month while unincorporated
  DEFAULT_MILLAGE: 8,

  // Revenue
  ASSESSED_VALUE: { residential: 180_000 },

  // Degradation
  BASE_DECAY: 0.5,              // condition points per month, fully funded, weatherMod 1
  USAGE_WEIGHT: 0.5,            // full occupancy multiplies wear by (1 + this)
  ROAD_MAINT_NEED: 400,         // $/month to fully fund one road segment
  ROAD_BUILD_COST: 15_000,      // one new segment, built with each zoning batch

  // Snow (spec §12b)
  COUNTY_PLOW_COST: 900,        // $ per road segment per full-snow month; always available
  COUNTY_PLOW_LAG: 0.5,         // fraction of a snowy month the county leaves roads unplowed
  OWN_PLOW_LAG: 0.1,            // same, with your own plow
  PLOW_CAPACITY: 6,             // road segments one plow can keep clear
  PLOW_OPEX: 700,               // $ fuel + driver per plow per full-snow month
  PLOW_WEAR: 3,                 // condition points per plow per full-snow month
  REPAIR_COST_PER_POINT: 150,   // $ of capital to restore one condition point

  // Desirability
  MILLAGE_REF: 8,               // tax-burden input reads 50 at this millage
  SERVICE_NEED_PER_CAPITA: 400, // $/year per resident for full service quality
  DESIRABILITY_WEIGHTS: {
    serviceQuality: 0.30,
    infrastructure: 0.25,
    taxBurden: 0.20,
    safety: 0.15,
    amenities: 0.10,
  },

  // Population
  MIGRATION_K: 0.02,            // word-of-mouth: fraction of existing pop per month at full pressure
  SEED_PULL: 1.5,               // people/month the seed itself attracts at full pressure, pop-independent

  // Development
  ABSORPTION_TRIGGER: 0.8,      // occupancy fraction that triggers new construction
  ABSORPTION_RATE: 2,           // lots converted per turn
  BUILD_TURNS: 6,
  LOT_BATCH: 6,                 // lots zoned per auto-zoning action
  LOT_ZONING_COST: 2_000,       // $ per lot (survey, utility stubs) paid from treasury

  // Incorporation
  INCORPORATION_POP: 25,

  // Debt (spec §12)
  DEBT_LIMIT_RATIO: 0.086,      // bonds capped at this share of assessed value (IL non-home-rule)
  COUNTY_LOAN_SHORT_CAP: 50_000,
  COUNTY_LOAN_LONG_CAP: 100_000,
  COUNTY_SHORT_SPREAD: 0.010,   // county loans cost more than your own bonds
  COUNTY_LONG_SPREAD: 0.020,
  COUNTY_F_PENALTY: 0.030,      // county still lends at F, painfully
  BOND_LONG_SPREAD: 0.005,
  RATING_SPREAD: { A: 0.000, B: 0.010, C: 0.020, D: 0.035, F: 0.060 },
  START_BASE_RATE: 0.040,
  RATE_FLOOR: 0.020,
  RATE_CEILING: 0.090,
  RATE_DRIFT: 0.0075,           // max yearly move of the county base rate
  REVIEW_RESERVE_TARGET: 6,     // months of opex for full marks

  // County takeover (spec §12, un-parked v0.4)
  TAKEOVER_DEFICIT_MONTHS: 10,  // consecutive months negative → takeover
  TAKEOVER_BALANCE_MONTHS: 3,   // or treasury below −(this many months of opex) → immediate
  AUSTERITY_MAINT_RATIO: 0.5,   // county funds road maintenance at this share of need
  AUSTERITY_SERVICE_RATIO: 0.25,// and services at this share of full need
  AUSTERITY_MILLAGE_MULT: 1.5,
  AUSTERITY_MILLAGE_CAP: 16,
  TAKEOVER_SELL_AFTER: 6,       // months under takeover still negative → sell assets
  SALVAGE_RATIO: 0.4,           // sale price = price × this × condition/100
  TAKEOVER_EXIT_RESERVE: 3,     // months of reserves needed to regain control

  // Events (d100)
  STORM_MAX_ROLL: 4,
  GRANT_MAX_ROLL: 6,
  STORM_DAMAGE: 20,
  GRANT_AMOUNT: 5_000,
});
