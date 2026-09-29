# Decisions log

Why things were decided the way they were. The spec (`one-turn-spec.md`) says *what*; this
says *why*, so settled questions don't get re-litigated. Newest at the bottom.

## 2026-08 — Teardown
- **Rebuilt from a one-turn spec instead of the feature-inventory doc.** The original doc
  listed systems that "affect desirability" with no math. Vibes without mechanics are
  design debt. Rule that came out of it: a feature enters only if it creates a decision.
- **Seven phases in strict order; degradation before desirability.** So this month's
  potholes affect this month's migration. A one-turn lag would make cause and effect mushy.
- **Homestead turn zero, population 1.** Passes the teardown test: unincorporated land
  means no bureaucracy, and incorporation becomes the game's first real unlock.
- **Seeds are options, not destiny.** Founding conditions must not determine outcomes.

## 2026-09-28 — Reboot
- **Reused the `municiti` repo; March prototype moved to `archive/march-prototype`.**
  One repo, full history. The Three.js road builder was Street Mode plumbing built before
  the loop existed; it isn't wasted, it's shelved.
- **Sim is headless, dependency-free ES modules; state is plain JSON.** So it runs in Node
  and the browser identically, is reproducible from a seed, and can later diff turns for
  multiplayer and pre-simulate a county's history with the same code.
- **Migration tempo is a tuning constant, not a design decision.** Argued about for two
  sessions; resolved by putting it in config and watching runs.
- **Fractional migration carry.** Rounding zeroed all flows at small populations. Carry the
  remainder between turns.
- **Capital budget is an allowance, not a charge.** Charged only as spent on repairs. That's
  how capital budgets behave and it keeps unspent capital in reserves.
- **Zoning as a standing policy in the headless sim.** Becomes a monthly decision when board
  meetings exist; same mechanics.
- **Borrowing, not board approval, is the release valve for spending outside the budget.**
  A board is procedural friction we'd have to give a personality; borrowing is economic
  cost with a formula. The board can layer on later as the *procedure* for issuing a bond.
- **Interest, not "inflation," is the cost of buying beyond your means.** The truck costs
  the same; the money costs more. Inflation is a separate slow escalator, parked.
- **One hard debt cap (share of assessed value), everything else priced.** Reserves set
  the rate via rating; debt-service ratio is a warning and a rating input, never a wall.
  Letting the player over-leverage and feel Phase 4 turn on them *is* the game. Capping
  the same thing twice makes the second cap invisible.
- **Credit rating A–F, reviewed annually, locked between reviews.** Discrete grades are
  legible; annual review makes "clean up before the review" a real move. F closes the
  bond market; county loans remain at a penalty. Rejected Aaa/Aa notation as unreadable.
- **No separate "anger" stat.** Phase 4 already is the angry citizens. Too much debt
  service forces cuts or higher millage and desirability falls.
- **Grants are offered at budget time with a match and a restriction.** Free unrestricted
  grants fail the teardown test. Folding them into the budget screen avoids a new screen.
- **Debug panel is build-order item 0.** Every constant is editable at runtime; for a
  simulation the debugger is the product for a while.
- **Weather moved ahead of the asset catalog.** The first purchase (a plow) needs a reason
  to exist; winter is the reason. A purchase with no need behind it fails our own test.
- **County services are free and pinned bad.** If free were merely mediocre, everyone
  would free-ride forever and the department system would never be used.
- **Procurement bids differ on price, delivery, condition and warranty — not price alone.**
  Cheap-now vs cheap-later is a decision; lowest-price-wins is a click. Rating affects the
  financing attached to a bid, not the sticker.
- **Road condition → speed → response time.** One number that is a service penalty in
  the table and a bumpy drive in Street Mode. Best bridge between the layers so far.
- **Hosting moved from Netlify to GitHub Pages.** Netlify's free tier is credit-metered
  per deploy; a dozen pushes a day burned it. Pages is unmetered for a public repo.

## 2026-09-29 (00:00–00:15) — Long horizon
- **Eras are constants on a timeline, not a tech tree.** Four: agricultural, industrial,
  modern, near-future. Every era effect is an existing constant made a function of year.
  Mild anachronism is acceptable; the year is cosmetic within an era.
- **Three nested cadences: month, year, decade.** The census is the one scheduled moment
  for irreversible things (annexation, secession, county votes, mega-projects).
- **County is a 3×3 grid of settlement sites (6–8 usable); a cell is not a city boundary.**
  Parcels move by purchase any time; cells move at the census by vote. Incorporation stays
  a population-threshold choice; no SimCity click-to-incorporate.
- **Pre-simulating a county to a later start year uses the same `resolveTurn`.** No
  separate generator. This is the payoff for a headless deterministic sim.
- **Mega-project free-rider rule is load-bearing.** Without a cost to not contributing,
  the rational move is to contribute nothing and the project is a cutscene.
- **Late joiners pay an engineering study, not a surcharge.** Same wallet effect, diegetic
  instead of punitive, and it's a real opt-out for towns the project doesn't help. Study
  costs are where inflation first enters the game (~5%/yr with noise).
- **One city one vote; ties go to total contributed to date.** Rejected contribution-
  weighted voting and a "cooperation" resource: both need formulas that don't exist yet.
  Revisit only if playtesting shows ties are rare or the levers are thin.
- **A map is a picture until it's a decision.** The 3×3 founding screen needs ≥3 seed
  types that behave differently before it's worth drawing.

## 2026-09-29 (afternoon) — Fiscal loop closes
- **Borrowing is a first-class action with a payment preview; credit review runs outside
  `resolveTurn`.** So the review result can be shown on the budget screen, and so the sim's
  turn stays pure.
- **County takeover is an eighth phase, not an event.** It has to run every turn to apply
  austerity and check for exit. Trigger is *either* ten deficit months *or* a balance below
  three months of opex, so a fast collapse doesn't get ten months of grace.
- **Takeover reaches add-ons, never base assets.** SimCity's plop-then-upgrade shape: the
  station stays, the extra trucks and helipad get furloughed and sold. Assets carry a tier.
- **The county's austerity budget stands after control returns until the player adopts a
  new one.** The humiliation has a tail; the player has to actively rebuild.
- **Modal layout.** Toolbar of tools (Budget, Loans, Buy, Policy, Town), stat tiles that
  open their own detail, one narrative card, yearly ledger. No permanent side panel: tools
  will keep accumulating and a sidebar doesn't scale. Config stays behind a gear.
- **Mid-year budget changes allowed for now.** The annual lock arrives with board meetings
  and should be an incorporation effect, not a rule imposed at turn zero.
