# MuniCity

A municipal simulator. Two layers: **Manager Mode** (govern a city, turn by turn) and
**Street Mode** (drive the vehicles of the city you governed). Vision document:
`MuniCity_Project_Prompt.docx` in the Claude Project. Working spec: `docs/one-turn-spec.md`.

## Current milestone: prove the loop

Before any rendering, the one-month turn has to be interesting as plain numbers.
`sim/` is a headless, dependency-free ES-module simulation of exactly that.

```
node sim/run.js                       # 120 turns, balanced budget
node sim/run.js --scenario stingy     # balanced | stingy | lavish | taxman
node sim/run.js --turns 60 --seed 7
```

## Layout

```
docs/one-turn-spec.md   the math; code follows it, not the other way round
sim/config.js           every tunable number
sim/state.js            turn-zero factory + helpers; state is plain JSON
sim/rng.js              seeded RNG (reproducible runs)
sim/phases/*.js         one file per phase, in spec order
sim/resolveTurn.js      runs the phases; incorporate()
sim/run.js              CLI runner + scenario table
```

No build tools. No npm. Everything is plain ES modules that run in Node 22+ and the browser.
