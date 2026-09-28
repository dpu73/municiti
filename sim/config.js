// Every tunable number in the simulation lives here.
// Spec reference: docs/one-turn-spec.md §10

export const config = Object.freeze({
  // Turn zero
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

  // Events (d100)
  STORM_MAX_ROLL: 4,
  GRANT_MAX_ROLL: 6,
  STORM_DAMAGE: 20,
  GRANT_AMOUNT: 5_000,
});
