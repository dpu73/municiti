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
  MIGRATION_K: 0.02,            // tuning constant, not a design decision
  MIGRATION_FLOOR: 1,           // minimum inflow when desirable and vacancy exists

  // Development
  ABSORPTION_TRIGGER: 0.8,      // occupancy fraction that triggers new construction
  ABSORPTION_RATE: 2,           // lots converted per turn
  BUILD_TURNS: 6,

  // Incorporation
  INCORPORATION_POP: 25,

  // Events (d100)
  STORM_MAX_ROLL: 4,
  GRANT_MAX_ROLL: 6,
  STORM_DAMAGE: 20,
  GRANT_AMOUNT: 5_000,
});
