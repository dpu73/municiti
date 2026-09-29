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

**2026-09-28 late, v0.2** — seasons (Midwest profile, founding in April), snow with county
plowing as the default, road segments added with each zoning batch, a snowplow with two
bids, assets with upkeep and warranty. 120 turns, seed 1, balanced:

| plow | pop | desirability | treasury |
|---|---|---|---|
| none (county plows) | 28 | 44 | $98k |
| auction at turn 0 | 27 | 43 | $22k |
| dealer at turn 0 | — | — | can't afford |

**Finding:** with 1–2 roads the plow is a $75k mistake over ten years — correct. The
crossover needs more road segments → more zoning → demand → desirability. Growth is slower
than v0.1 (28 vs 47) because winter closes roads and zoning now costs $27k a batch. Money
is scarcer; good. The dealer plow being unreachable is the debt system's cue.

**v0.1 finding:** every scenario stalls and hoards. `balanced` stops growing at ~48 people
sitting on $222k, because service quality is `services / (pop × 400)` and the budget was
set once at turn zero. Growth outruns a fixed budget, desirability sinks to 50, demand
dies. **The missing piece is the annual budget decision** — the player re-allocating a
growing treasury against growing needs. That is the core loop from the teardown, and it
doesn't exist yet. Build it before tuning any constants; the hoard is a symptom.

---

## 12. Fiscal system — designed, not built (2026-09-28)

Resolved in design; formulas are first drafts. Build order is §13. Nothing here runs yet.

**The three numbers.** `budget` is spending *authority* (annual appropriations — departments
spend within it without asking). `treasury` is *reserves* — the money actually on hand,
tracked as `reserveMonths = treasury / (annual opex / 12)`. Anything outside the budget is
paid for by **borrowing**, never by asking a board. Economic cost, not procedural friction.

**Debt.** `state.debt[]` holds bonds/loans: `{ principal, rate, termTurns, payment }` with
level-payment amortization `payment = P·r/(1−(1+r)^−n)` (r monthly). Phase 2 sums payments
into `debtService`. Paying principal down frees capacity.

**Capacity — one hard cap, one price, one warning.**
```
incorporated:   debtCapacity = DEBT_LIMIT_RATIO × Σ assessedValue(occupied)   // ~8.6% of EAV, IL non-home-rule
unincorporated: county loans only — 2 fixed products with flat caps
                5yr up to COUNTY_LOAN_SHORT_CAP;  15yr up to COUNTY_LOAN_LONG_CAP
```
- **City size → the hard cap.** Capacity is a share of assessed value, so it grows with the
  tax base. That is the county's limit; there is no second one.
- **Reserves → the price.** Thin reserves lower the rating, which raises the rate. They
  never block a loan.
- **Debt service → the warning.** `debtServiceRatio` feeds the rating and heads the budget
  screen. Deliberately *not* a hard cap: letting the player over-leverage and feel Phase 4
  turn on them is the game. County takeover at 10 deficit months is the backstop.

Incorporation swaps county loans for your own bonds: better rates, capacity that grows
with the tax base. This is the felt upside that pays for losing seed income.

**Rate environment.** `countyBaseRate` is a slow bounded random walk (drift ± a fraction of
a point per year within `[RATE_FLOOR, RATE_CEILING]`). Products don't change; the price of
money does, so *when* to borrow is a decision.

**Credit rating — annual review, A–F.** Once every 12 turns, grade from three inputs
already in state: `reserveMonths`, deficit months in the past year,
`outstandingPrincipal / debtCapacity`, plus `debtServiceRatio`. Ladder: **A · B · C · D · F**.
`rate(newBond) = countyBaseRate + SPREAD[grade]`. Locked until the next review, so
cleaning up the books before review is a real move. **F closes the bond market:** county
loans only, at a penalty spread. Rating also gates grant eligibility.

**Debt burden.** `debtServiceRatio = debtService / revenue`. First number on the annual
budget screen; warning zone above ~0.15–0.20. **No separate "anger" stat.** Too much debt
service forces either cuts (service quality ↓ → desirability ↓) or higher millage (tax
burden ↓ → desirability ↓). Phase 4 already is the angry citizens.

**Grants — offered at budget time, never free.** Each annual budget the county puts 1–3
grants on the table from a small pool, weighting shifted year to year:
`{ amount, matchRatio, restrictedTo }` with `restrictedTo` a class — roads, water, parks,
vehicles. Player commits the match and spends on the county's priority, or passes.
Eligibility gated by rating. Unmatched unrestricted grants fail the teardown test, and the
old random grant event goes away once this exists.

**Inflation.** Slow price escalator on everything, 2–3%/yr. Parked; it's a difficulty dial.

## 12b. Climate, procurement, service triangle — designed, not built (2026-09-28)

**Why weather comes next.** The first thing worth buying is a snowplow, and a plow needs a
winter. Seasons turn `tile.weatherMod` from a flat 1.0 into a 12-month profile per climate.
Snow accelerates wear and an unplowed road is impassable (hard Phase 4 hit per month).

**Climates.** Six to start; each must have a *signature hazard* that changes purchases and
decay, or it's cosmetic. Seventh (Northeast coastal) waits until these run.

| Climate | Signature hazard | Forces |
|---|---|---|
| Midwest | freeze-thaw (decay multiplier when temp crosses 0 repeatedly), tornado | potholes, plows, sirens |
| Mountain / ski | deep snow, short season | plow fleet, salt, closures, summer-only construction |
| Tropical island | hurricanes, salt air | corrosion multiplier, storm surge, no winter |
| Humid South | hurricanes, flash flooding, heat | drainage capital, heat load on services |
| Arid Southwest | extreme heat, monsoon floods, drought | water as constrained service, flood control, low road wear |
| Pacific NW | persistent rain, landslides | stormwater load, mud, low snow cost |

**Service triangle (per service).**
- **County — free, always available, pinned bad.** Service-quality input fixed at
  `COUNTY_SERVICE_QUALITY` (~30/100); nothing raises it. Possible response-time penalty on
  events. Free must hurt or everyone free-rides forever.
- **Contractors — middle.** Small table of providers `{ costPerCapita, quality, reliability }`.
- **Build your own — the department.** Budget + staff + required capital assets (station,
  engine); quality from funding ratio × equipment condition. This is the department system
  from the vision doc. Arrives after weather creates the first need.

**Procurement — bids differ on more than price or it's a click.** Each capital purchase
gets 2–3 bids differing on `{ price, deliveryTurns, condition, warrantyTurns }`:
- **County auction** — cheap, used, fast; higher maintNeed, shorter life.
- **Local dealer** — new, pricier, slower; warranty suppresses maintNeed for N turns.
Credit rating affects the *financing* attached to a bid (term offer vs cash-only), not
the sticker price. Cheap-now vs cheap-later is the decision.

**Road condition → speed → time.** Condition sets a speed multiplier per segment
(`speedMod = f(condition)`, potholes slow you down). Response and travel times are
path sums over speed-weighted segments, so a neglected road makes the fire truck late —
in the table as a service-quality penalty, in Street Mode as the drive itself. One number,
both layers.

**Assets.** `{ type, condition, maintNeed, opex, lifespanTurns, warrantyTurns }`. Owned
vehicles are the vehicles Street Mode drives — same object, both layers.

## 12c. Long horizon — eras, census, county (designed 2026-09-28, not scheduled)

Nothing here enters the build until §11 is satisfied with the fiscal loop. Recorded so it
doesn't decay into vibes.

**Eras = constants as a timeline.** Start year is a config value; the calendar advances
with turns. Constants that should vary by era (all already in `config.js`):
`BUILD_TURNS` ↓, `LOT_ZONING_COST` ↑ (land scarcity), `SERVICE_NEED_PER_CAPITA` ↑ (living
standards), pollution tolerance ↓, power/water availability ↑, asset catalog availability.
Pick ~4 eras by what changes mechanically; the year is cosmetic within an era. Mild
anachronism is acceptable. Assets keep their era's visual until replaced (`boughtTurn`).

**Three nested cadences.** Month → year (budget, credit review) → **decade (census)**.
The census is the scheduled moment for irreversible things: annexation, secession on
sustained unhappiness, county-wide votes, mega-projects, regional transit.

**County = 3×3 grid; 6–8 cells usable**, the rest water, preserve, mountain or canyon.
A cell is a *settlement site*, not a city boundary. Two scales:
- *Parcels* (inside a cell): bought any time with money. Zoning batches already do this.
- *Cells*: annexing a populated neighbor cell or town, or losing one to secession on
  sustained low desirability, happens only at the census by vote.
Incorporation is unchanged — a status the municipality chooses at `INCORPORATION_POP`.
No click-to-incorporate; the click is "buy this parcel".

**Founding screen (after debt):** the 3×3 grid with each cell's seed shown; the player
picks. Needs ≥3 seed types that behave differently to be a decision, e.g. farmland
(steady income), river crossing (less income, higher SEED_PULL), ore (high income that
depletes). Until then a map is a picture.

**Settlement sites.** Neighbors are municipalities run by policy
functions (the bench's `budgetPolicy` with personalities) in lockstep resolution. **Pre-sim:**
choosing a start year later than founding runs the same `resolveTurn` for every site from
the founding era to the start year — no separate generator. This is the payoff for a
headless, deterministic sim.

**Eras:** agricultural → industrial → modern → near-future (a logical next step, not
sci-fi). Four.

**Mega-projects (census cadence).**
- *Vote:* one proposal wins at the census, Civ-style (weighting TBD: per-city vs per-capita).
- *Engineering phase:* fixed length; sets specifics — route, capacity, which cities get
  stations; a route crossing water adds bridges and cost.
- *Construction phase:* each city contributes money per year (AI towns by policy).
  `completionTurns = totalNeed / contributionRate × educationMod`, floored ~24–36 turns,
  capped ~60–72; at the cap the county finishes it and bills everyone.
- *Free-rider rule (load-bearing):* contributors get the unlock at completion, at cost.
  Non-contributors buy in later at a surcharge that grows with delay (~150% → 200%), or
  not at all where engineering excluded them (no retroactive rail stop). Contribution
  share sets vote weight on the *next* project — influence as computed history, not a
  spendable resource. No "cooperation" stat unless playtesting proves these two levers
  insufficient.
- *Unlock:* completion grants the capability county-wide **regardless of era** — a bus
  depot opens and every city can buy buses and stations. Era gates the catalog;
  mega-projects override the gate. This is how a lagging town leapfrogs.

**Regional transit connectivity:** bus goes where roads go; rail needs track and bridges;
water transit needs a connected body of water (canal as a mega-project). Every city must
connect to at least one other by some mode — a connected graph, not a complete one.

**Selection flow (parking lot):** region (climate) → county (map) → start era. One preset
map first; map builder is far future.

## 13. Build order

0. **Debug panel groundwork** — `config` becomes defaults + a runtime override layer
   (editable, resettable); each phase stamps its spec section so a panel can show the
   formula beside the numbers. When the sim earns an `index.html`, the first UI is the
   turn table plus this panel. For a simulation the debugger *is* the product for a while.
1. **Annual budget decision** — every 12 turns re-set `budget` and `millage`; a
   `budgetPolicy` function stands in for the player in the headless runner.
2. **Debt + credit review** — bonds, county loans, capacity, debt service in Phase 2,
   annual rating, `debtServiceRatio` on the budget screen.
3. ~~Seasons + Midwest climate~~ — done v0.2 (`sim/climate.js`).
4. ~~Snowplow with county-auction vs dealer bids~~ — done v0.2 (`sim/actions.js`); cash only.
5. **Debt** (item 2) is now blocking: the dealer plow and any real capital purchase need it.
6. **Grants** — petition with match and restriction.
7. **Remaining climates, contractors, departments** — per §12b.

Then re-run §11 and see whether allocating scarce money across competing needs is
interesting in a table. If yes, it earns an `index.html`.

## 14. Parking lot

Street Mode · individual agents (cohorts first) · department heads · AI neighbors · county
grid & terrain · climate profiles · annexation/secession · bonds & debt service · county
takeover effects · CRIP · board meetings (procedural layer over §12, later) · inflation ·
infrastructure replacement · full property lifecycle ·
demographic desirability weights · commercial/industrial zoning · services triangle
(build/trade/buy) · unlock tracks · data centers & fulfillment centers as late-game deals ·
multiplayer · 3D pipeline · audio.
