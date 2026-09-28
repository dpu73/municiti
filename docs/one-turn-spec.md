# MuniCity — One Turn Specification (v0)

**Status:** working spec. This is the math the sim implements. If the code and this
document disagree, one of them is wrong — fix it here first, then in code.

**Scope rule:** nothing enters this spec unless it appears in a formula below. Everything
else (Street Mode, agents, department heads, AI neighbors, weather profiles, annexation,
bonds, the county takeover *effects*) lives in the parking lot until the loop earns it.

---

## 0. Turn zero — the founding state vector

The player stakes a claim to one tract of unincorporated land. Population is 1: the
player's avatar. Nothing exists except what the tile came with (its **seed**) and what the
player does before turn 1 resolves.

Minimum state for phases 1–7 to be computable:

| Field | v0 value | Notes |
|---|---|---|
| `turn` | 0 | months elapsed |
| `incorporated` | false | flips once, see §8 |
| `treasury` | `START_TREASURY` | one number |
| `deficitStreak` | 0 | consecutive turns with treasury < 0 |
| `population` | 1 | the avatar; never drops below 1 |
| `tile.weatherMod` | 1.0 | flat; climate profiles are parked |
| `tile.seed` | `{ type: 'farmland', income: SEED_INCOME }` | the "why anyone would come here" |
| `infrastructure[]` | one road segment, condition 100 | so Phase 3 has something to decay |
| `lots[]` | `START_LOTS` vacant residential lots | so Phase 6 has something to absorb |
| `millage` | `DEFAULT_MILLAGE` | property tax rate, mills |
| `budget` | annual $ per department | the player's first real decision |
| `desirability` | 50 | equilibrium |
| `migrationCarry` | 0 | fractional people carried between turns, see §6 |
| `policy.autoZone` | true | standing rule: zone more lots when out of land and demand exists, see §7 |

**Player decisions available at turn zero:** set `budget`, set `millage`. That's it.
Placing the road and zoning the lots is fixed in v0 (the founding "presentation" layer is
parked); they're just data in the state vector.

---

## 1. Phase order

Resolved in strict order every turn. **Degradation precedes desirability** so this
month's potholes affect this month's migration — no one-turn lag between cause and effect.

1. Revenue
2. Expenses
3. Degradation
4. Desirability
5. Population
6. Development
7. Events

Each phase is a pure function `(state, config, rng) → state`. Phases may read anything
written by earlier phases in the same turn. They never read later phases' outputs.

---

## 2. Phase 1 — Revenue

```
propertyTax   = Σ over OCCUPIED lots of (assessedValue × millage / 1000) / 12
seedIncome    = incorporated ? 0 : tile.seed.income
revenue       = propertyTax + seedIncome
treasury     += revenue
```

- Only **completed, occupied** buildings are assessed (real-time assessment on completion).
- `assessedValue` is fixed per lot type in v0 (`ASSESSED_VALUE[zone]`).
- Seed income is the pre-incorporation primary-extraction economy in its smallest form: a
  flat monthly number. It stops at incorporation, which is what makes incorporation a
  real decision rather than a free upgrade.
- Fees, contracts, grants, bonds: parked.

## 3. Phase 2 — Expenses

```
opex          = Σ over departments of (budget[dept].operations / 12)
treasury     -= opex
deficitStreak = treasury < 0 ? deficitStreak + 1 : 0
```

- Operations are charged in full every month. **Capital is not charged here.** It is a
  monthly allowance that Phase 3 draws down for repairs; only actual spending hits the
  treasury and unspent capital stays put. That's how capital budgets behave in practice.
- v0 departments: `publicWorks`, `services` (a single stand-in for police/fire/etc.).
- Debt service and service contracts: parked (0).
- `deficitStreak` is tracked; the county takeover it triggers at 10 is parked. The counter
  exists so the pressure is visible in the table.

## 4. Phase 3 — Degradation

For every infrastructure object:

```
maintNeedTotal = Σ maintNeed over all infrastructure
fundingRatio   = clamp(budget.publicWorks.operations / 12 / maintNeedTotal, 0, 1)
usageMod       = 1 + USAGE_WEIGHT × occupancyFraction
condition     -= BASE_DECAY × tile.weatherMod × usageMod × (2 − fundingRatio)
condition      = clamp(condition, 0, 100)
```

- `occupancyFraction = population / totalHousingCapacity` (0 when capacity is 0).
- Fully funded maintenance → normal decay. Zero funding → double decay. Linear between.

Then **repair**, worst object first:

```
allowance = budget.publicWorks.capital / 12
for obj in infrastructure sorted by condition ascending:
    points    = min(100 − condition, allowance / REPAIR_COST_PER_POINT)
    condition += points
    allowance -= points × REPAIR_COST_PER_POINT
treasury -= (capital actually spent)
```

- Maintenance (operations) slows decay; capital reverses it. Both are needed and they
  compete for the same money — that's the Public Works decision in miniature.
- Replacement / rebuild of a dead object: parked. Repair is continuous for now.

## 5. Phase 4 — Desirability

One number per tile, 0–100, a weighted sum of exactly five inputs:

| Input | Weight | v0 definition |
|---|---|---|
| serviceQuality | 0.30 | `clamp(budget.services.operations / (population × SERVICE_NEED_PER_CAPITA), 0, 1) × 100` |
| infrastructure | 0.25 | mean `condition` over all infrastructure |
| taxBurden (inverted) | 0.20 | `100 − clamp(millage / MILLAGE_REF × 50, 0, 100)` — at `MILLAGE_REF` this input is 50 |
| safety | 0.15 | **stub: = serviceQuality** until police is its own department |
| amenities | 0.10 | **stub: 50** until parks/green space exist |

```
desirability = 0.30·serviceQuality + 0.25·infrastructure + 0.20·taxBurden
             + 0.15·safety + 0.10·amenities
```

Demographic weighting (different groups weighting these differently) is the first thing
that comes off the parking lot once the loop works. It's a matrix of weights instead of
one row — the structure already supports it.

## 6. Phase 5 — Population

```
capacity        = Σ capacity over OCCUPIED lots
vacancy         = capacity − population
pressure        = (desirability − 50) / 50                    // −1 … +1
flow            = MIGRATION_K × population × pressure          // word of mouth
                + SEED_PULL × pressure                          // the seed itself
migrationCarry += flow
netMigration    = trunc(migrationCarry);  migrationCarry −= netMigration
if netMigration > vacancy: netMigration = max(vacancy, 0); migrationCarry = 0
population      = max(1, population + netMigration)
```

- Two pulls. The proportional term is people telling people. The `SEED_PULL` term is the
  tile's natural draw — pop-independent, so a town of 1 can still be found. At full
  pressure with `SEED_PULL = 1.5` the first settler arrives in the first month; at pop 1
  with only the proportional term it would take 80 months.
- **Fractional carry.** Rounding was the v0 bug: at pop 33, −0.19/month rounded to zero
  and nobody ever left. The carry accumulates across turns so small flows still move
  whole people eventually.
- Inflow is capped by vacant housing and the carry resets when it hits the cap (would-be
  arrivals don't queue forever). Outflow is uncapped.
- Desirability 50 is equilibrium. `MIGRATION_K` and `SEED_PULL` are **tuning constants,
  not design decisions.**

## 7. Phase 6 — Development

```
for every lot under construction:
    turnsRemaining −= 1
    if turnsRemaining == 0: lot → occupied (joins tax base next Phase 1)

occupancyFraction = population / capacity   (1.0 if capacity == 0)
demand = desirability > 50 and occupancyFraction >= ABSORPTION_TRIGGER

if demand and policy.autoZone and no vacant lots and treasury >= LOT_BATCH × LOT_ZONING_COST:
    zone LOT_BATCH new vacant residential lots; treasury −= cost

if demand:
    convert up to ABSORPTION_RATE vacant lots → construction (turnsRemaining = BUILD_TURNS)
```

- Absorption over time; nothing appears instantly.
- **Zoning is the player's lever**, expressed for now as a standing policy so the headless
  sim can exercise it. When board meetings arrive it becomes a monthly decision with the
  same mechanics. Land costs money; that's what keeps growth from being free.
- The full property lifecycle (occupancy → vacancy → disrepair → condemnation →
  acquisition) is parked. Only vacant → construction → occupied exists in v0.

## 8. Incorporation

```
eligible = population >= INCORPORATION_POP
```

Incorporation is a **player choice** once eligible, not automatic. In v0 the run script
incorporates on the first eligible turn so the effect is visible. Effects in v0:

- `seedIncome` → 0 (the extraction economy hands off to the tax economy)
- Nothing else yet. CRIP, board meetings, the annual fiscal lock, department heads — all
  parked. They arrive as things incorporation *turns on*.

The decision it creates: incorporate early and lose seed income before the tax base can
replace it, or stay unincorporated and keep taking the seed money while the settlement
outgrows what one landowner can fund.

## 9. Phase 7 — Events

One d100 roll per turn against a small table:

| Roll | Event | Effect |
|---|---|---|
| 1–4 | Storm | one random infrastructure object: `condition −= STORM_DAMAGE` |
| 5–6 | Grant | `treasury += GRANT_AMOUNT` |
| 7–100 | Nothing | — |

The rng is seeded so a run is reproducible. That's the whole event system for now.

---

## 10. Constants (`sim/config.js`)

Every number above lives in one file. First-guess values:

| Constant | Value | Rationale |
|---|---|---|
| `START_TREASURY` | 50,000 | enough for ~2 years of tiny budgets |
| `START_LOTS` | 12 | single-family, capacity 3 each → 36 people |
| `SEED_INCOME` | 1,500 /mo | farmland; roughly one household's surplus |
| `ASSESSED_VALUE.residential` | 180,000 | |
| `DEFAULT_MILLAGE` | 8 | |
| `MILLAGE_REF` | 8 | tax-burden input reads 50 at this rate |
| `BASE_DECAY` | 0.5 /mo | a fully funded road lasts ~200 months ≈ 17 yrs |
| `USAGE_WEIGHT` | 0.5 | full occupancy → 1.5× wear |
| `SERVICE_NEED_PER_CAPITA` | 400 /yr | |
| `REPAIR_COST_PER_POINT` | 150 | full rebuild of one segment ≈ $15,000 |
| `MIGRATION_K` | 0.02 | word of mouth, ±2%/mo of existing pop |
| `SEED_PULL` | 1.5 | people/mo the seed attracts at full pressure |
| `ABSORPTION_TRIGGER` | 0.8 | build when 80% full |
| `ABSORPTION_RATE` | 2 lots/turn | |
| `BUILD_TURNS` | 6 | |
| `LOT_BATCH` | 6 | lots zoned per action |
| `LOT_ZONING_COST` | 2,000 | per lot |
| `INCORPORATION_POP` | 25 | |
| `STORM_DAMAGE` | 20 | |
| `GRANT_AMOUNT` | 5,000 | |

---

## 11. What "working" means

The loop is proven when a 120-turn (10-year) run with default constants shows:

1. Population grows from 1, stalls against housing, development unlocks more, grows again.
2. Roads decay visibly and desirability tracks it.
3. At least one budget allocation leads to growth and at least one leads to decline —
   i.e. the player's turn-zero decision *matters*.
4. Incorporation is a real tradeoff: incorporating at pop 25 should hurt the treasury for
   several turns before property tax catches up.

If (3) fails, the constants are wrong or the desirability formula is too flat. Fix that
before adding anything.

### Run log

**2026-09-28, v0.1** — 120 turns, seed 1, five turn-zero budgets:

| scenario | pop | desirability | treasury |
|---|---|---|---|
| balanced | 47 | 46 | $222k |
| stingy | 4 | 49 | $375k |
| lavish | 112 | 56 | $189k |
| taxman | 29 | 45 | $355k |
| potholes | 19 | 51 | $327k |

(1), (2), (3) pass. (4) is a near-wash: at 12 houses property tax ($1,440/mo) almost
exactly replaces seed income ($1,500/mo). Interesting knife-edge; leave it.

**Finding:** every scenario stalls and hoards. `balanced` stops growing at ~48 people
sitting on $222k, because service quality is `services / (pop × 400)` and the budget was
set once at turn zero. Growth outruns a fixed budget, desirability sinks to 50, demand
dies. **The missing piece is the annual budget decision** — the player re-allocating a
growing treasury against growing needs. That is the core loop from the teardown, and it
doesn't exist yet. Build it before tuning any constants; the hoard is a symptom.

---

## 12. Parking lot

**Next up:** annual budget decision (re-set `budget` and `millage` every 12 turns).

Street Mode · individual agents (cohorts first) · department heads · AI neighbors · county
grid & terrain · climate profiles · annexation/secession · bonds & debt service · county
takeover effects · CRIP · board meetings · infrastructure replacement · full property lifecycle ·
demographic desirability weights · commercial/industrial zoning · services triangle
(build/trade/buy) · unlock tracks · data centers & fulfillment centers as late-game deals ·
multiplayer · 3D pipeline · audio.
