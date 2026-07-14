# v5 Phase 0 — Investigation & Baseline Findings

**Date:** 2026-07-12
**Status:** DRAFT — awaiting review at Checkpoint 0. No production code changed. Full test suite not run.

Methodology: read `engine.js` (buildScenario, the annual engine) and the `wfData` `useMemo`
block in `App.jsx` (the monthly engine) in full, line by line, cross-referencing every place
one engine samples/approximates something the other computes exactly. Findings below marked
"confirmed against fixtures" were verified by running all 3 pinned scenarios through both
engines (via the running dev server + `window.__engine`/`window.__liveRows`/`window.__wfData`,
the same test-scaffolding hooks Playwright uses) and diffing actual numbers — not just reading
code.

---

## 0a. Known-exceptions list — reclassified into four buckets

Per your request, reclassified from the original 10-item list into: **(A)** modeling decisions
needed before Phase 1 (genuinely different formulas, must choose one), **(B)** latent bugs the
divergence was masking (one engine is simply wrong; fixtures SHOULD move because the old value
was wrong), **(C)** clean aggregation exceptions (monthly is legitimately more precise, small
expected shift), **(D)** new capability that must be built in the monthly engine, not aggregated.

---

### CATEGORY A — Modeling decisions — **ALL RESOLVED 2026-07-12**

#### A1. Maintenance cost — RESOLVED: structure-value basis, uncapped, ongoing

**Decision:** the maintenance cost line that hits cash flow/NW is `struct6`/`struct15`/`structLaf` ×
`maintStr%` × propCPI, **uncapped**, ongoing for the life of the model — the 5-year reserve cap is
dropped. Structure value is the right driver (not market value); uncapped is the honest lifetime
cost treatment. The old annual `value×maintRate` formula and the old monthly 5-year-capped-reserve
formula are BOTH retired in favor of this third formula, which doesn't exist verbatim in either
engine today.

**Deferred, not in v5 scope:** a capped reserve-FUNDING readout (separate from the cost line) may
be reintroduced later as a display-only view if it has value — not built now.

**Phase 1 implementation note surfaced by this decision:** the pooled-proceeds sale-year routing
(CLAUDE.md: "draw → HI-debt avalanche → reserve/buffer top-ups → sweep") currently tops off
`res6`/`res15`/`resLaf` (capped maintenance reserves) as part of its "reserve/buffer" step, alongside
`rd`/`ob`. Since maintenance is no longer a capped bucket, there's nothing left for that part of the
step to top off. **Proposed resolution (flagging for your confirmation, not deciding unilaterally):**
retire `res6`/`res15`/`resLaf` as capped buckets entirely; the sale-year "reserve/buffer top-up" step
narrows to `rd`/`ob` only. See the Phase 1 plan below.

#### A2. Pins — RESOLVED: pins run the full monthly engine

Pins now run a complete monthly simulation, same as live. Every `pin_<id>_*` chart field sources
from that pin's own monthly-engine output, computed identically to how live is computed. This also
directly enables A4 (see below).

#### A3. `cashAst`/`invested` — RESOLVED: inert, treat as 0, no shortfall ledger

Confirmed empirically inert (0 across all 21 rows, all 3 pins — see the original writeup). Decision:
the aggregation layer treats this component as a constant 0. No shortfall-funding ledger is built in
the monthly engine. If a future session needs to model "obligation exceeds proceeds," that's new
work on both sides at that time, not now.

#### A4. `surplus` vs. `fcfChart` — RESOLVED: delete the `fcfChart` VARIABLE, not the chart

The Free Cash Flow **chart** is unchanged and keeps rendering. What's deleted is the redundant
annual-engine `fcfChart` field/formula. Because A2 now gives every pin its own monthly run, there's
no longer any reason for the FCF chart to read two different sources depending on live-vs-pinned —
**all scenarios (live + pins) source the FCF line from the monthly `disc` field**, computed
identically. This is a genuine bug fix as a side effect: today live and pinned FCF lines can
diverge because they're computed two different ways; after this change they can't.
`reqWork` stays derived from the `surplus`/`totalOut` basis (total income minus total spending,
including full debt service) — a different, correct concept from `disc`, not affected by this change.

---

### Original numbered detail for A1-A4 (kept for the record of what was decided against)

- **Annual engine** (`maint`): `property.value × maintRate`, uncapped, always accrues, driven
  by each property's market-value slider.
- **Monthly engine** (`maintRes`/`res6`/`res15`/`resLaf`): driven by the **separate** Cash-Flow-tab
  `struct6`/`struct15`/`structLaf` sliders (structure-replacement-value, not `properties[].value`),
  fed into reserve buckets **capped at 5 years' worth**. Once capped, contribution drops to $0.
- **Measured:** pin_36, year 3 (cal 2029): annual `maint=$494/mo` (flat) vs. monthly
  `maintRes=$0/mo` for the entire year (reserve already at cap). Pin_35/pin_37, year 3: annual
  `maint=$500/mo` vs. monthly `maintRes=$469/mo` (not yet capped, close but not equal — different
  input sliders, coincidentally similar magnitude at this particular point).
- **Why this is A, not B:** neither formula is "wrong" — they're two legitimate but different
  product decisions (an ongoing % of home value, vs. a capped sinking fund sized off rebuild
  cost) that happen to both currently exist in the codebase. There's no code comment or design
  doc asserting one is the intended/correct one. **I need your call**: which is the model going
  forward — uncapped value-based, capped structure-based, or something else (e.g. keep both as
  separate line items instead of collapsing to one `maint` field)?

#### A2. Pins: annual-only today — do they get a full monthly run post-refactor?

`addPin`/`buildRowsFromSnapshot` call `buildScenario` only, for every pin, always (explicit
v4.1.5 comment: "pins only ever run the annual engine"). Once `buildScenario` is deleted and
the annual/Simulator view becomes pure aggregation of monthly output, every `pin_<id>_*`
chart field needs a source. Two options: (a) each pin also runs a full 252-row monthly
simulation (straightforward mechanically — the monthly engine doesn't care whose params it
runs — cheap at this scale, 3 pins × 252 rows is trivial), or (b) pins keep some other,
narrower path. The spec's acceptance criterion ("no independent annual financial math
remains") reads as requiring (a), but that's my inference, not something the spec states
explicitly for pins specifically — **flagging for your explicit confirmation**, not a numeric
divergence to measure (nothing to compare; pins simply don't have monthly output today).

#### A3. `cashAst`/`invested`: no monthly-engine concept exists at all

`buildScenario`'s `cashAst` (pre-2027 pooled settlement-shortfall cash funding, used for NW's
`invested` component) has no `wfData` analog. The nearest relative, `savingsAcc`, tracks a
**different** thing (post-debt-clear accumulated sweep, only ever additive, never drawn down
for a shortfall). These aren't the same concept measured at different granularity — they're
different concepts. **Needs a design decision**: does the single engine keep a distinct
shortfall-funding mechanism, fold it into `savingsAcc` semantics, or retire the concept? Not
scored as "new capability" (D) because it's not obviously "build the monthly version of the
annual thing" — it's not clear the annual thing should survive as-is.

#### A4. `surplus` vs. `fcfChart`: two different annual-engine definitions of "disposable income" today, need to become one

`buildScenario` computes `surplus` (used for `reqWork`/`passive`/NW) and `fcfChart` (a
separate, later-added, chart-only field — see the v4.1.5 comment on why it was added instead
of reusing `surplus`) via two different formulas in the same function. Both currently exist
because `fcfChart` was added later specifically to fix a chart-display bug without touching
`surplus`'s other consumers. Post-refactor there's one monthly-aggregated "disposable income"
number — **you need to confirm `reqWork` (a headline milestone) should be redefined off
whichever single aggregated definition wins**, since today it's implicitly tied to the
`surplus` formula specifically, not `fcfChart`.

---

### CATEGORY B — Latent bugs (fixtures WILL move; old value was simply wrong)

#### B1. HI-debt-clear year can be off by a full year+ — monthly engine is correct

- **Measured:** pin_35, pin_36: both engines agree on calendar year 2027 (annual reports
  year-only; monthly pinpoints Jan '27, mo=6 — expected, just finer resolution, not a bug by
  itself). **pin_37: annual engine reports debt clears in 2028. Monthly engine shows it
  actually clears in March 2027 (mo=8) — 11+ months / a full calendar year off.** `workFreeYr`
  and `debtClearYr` in `keyStats` will move for any scenario like pin_37.
- **Which engine is correct, and why:** the monthly engine. CLAUDE.md is explicit that `wfData`
  "is the authoritative engine for anything that needs true monthly resolution... the
  cash-flow waterfall tiers," while the annual engine is documented as the "big picture" view.
  Concretely, `buildScenario`'s per-month debt-sweep mirror loop has no Rainy-Day or
  Operating-Buffer tiers at all — it computes available surplus for the avalanche as income
  minus fixed costs minus health minus mortgage minus HI minimums, full stop, never subtracting
  `rdAdd`/`obAdd` the way the monthly engine does before computing its own avalanche pool. The
  annual engine is missing entire competing claims on the same dollars — that's a bug (an
  incomplete port of the intended waterfall), not an intentional simplification with its own
  rationale.
- **Honesty check on direction:** I can explain the *mechanism* (missing tiers) but I have NOT
  fully traced why it makes pin_37 clear debt *later* in the annual engine when the missing
  tiers should, in isolation, make the annual engine's surplus pool *larger* (and so paydown
  *faster*, not slower). The tax-estimate divergence (C1 below) and the once-per-year rent-growth
  snapshot (C2 below) both also feed into "available surplus" and could plausibly flip the net
  direction case-by-case — I have not isolated a single root cause with certainty, only
  confirmed that the monthly engine implements the documented-correct design and the annual
  engine does not. Recommend Phase 1 re-verify pin_37's specific mechanism once the single
  engine exists, since it may surface a second bug I haven't found yet.

#### B2. Sale-year "sweep to savings" mislabels reserve top-ups as true savings — monthly engine is correct

- **Measured** (same sale-year pool, both engines' debt-paydown amounts match closely so this
  isn't a debt-avalanche timing issue — it's specifically the post-debt allocation):

  | | annual `wfToSavings` | monthly `oneTimeReserveFill` | monthly `oneTimeSweep` (true savings) |
  |---|---|---|---|
  | pin_35 | $5,020 | $10,063 | $0 |
  | pin_36 | $52,520 | $57,563 | $0 |
  | pin_37 | $0 | $0 | $0 |

- **Which engine is correct, and why:** the monthly engine. CLAUDE.md documents the intended
  pooled-proceeds design explicitly: "draw → HI-debt avalanche (full remainder, debt-first) →
  reserve/buffer top-ups → whatever's left joins the ordinary monthly sweep." The monthly
  engine implements exactly this (`oneTimeReserveFill` before `oneTimeSweep`). The annual
  engine's own code comment self-admits the gap: "Annual approximation: reserve buckets aren't
  modeled here, so the one-time inflow goes straight to... sweep savings." This isn't an
  ambiguous design choice, it's a documented-but-unimplemented step in the annual mirror.
  pin_36's case is the starkest: **the entire reported $52,520 "savings" figure is actually
  100% reserve fill** in the true accounting — none of it is real discretionary savings.

#### B3. Sale-year tax overstated 25-50% — ACCEPTED as a bug, not resampling: annual engine drops the sold property's mortgage-interest deduction for the WHOLE sale year

Split out of the original C1 (tax resampling) after tracing the actual mechanism, per your
question (c). This is a real bug, not sampling noise.

- **Root cause, confirmed against fixtures:** the annual engine's mortgage-interest input to
  `estimateTax` (`_mtgInt`) is built from `balById`, which is gated by the coarse **year-level**
  `keepMap` (`cal < saleYear`). For the sale year itself, `cal < saleYear` is false — so
  `balById.sixth = 0` for the **entire** sale-year row, even though 6th St is genuinely owned
  and paying interest for the months before the actual sale quarter.
- **Measured (pin_35, sale year 2027, 6th St sold Q2):** annual `primBalRaw` (the balance
  actually used for that row's tax-interest deduction) = **$0** for all of 2027. The monthly
  engine correctly keeps `mtgBal6` at the real $805,495 balance and shows the true payment
  pattern: `fc_mtg` = $5,510/mo for Jan-Mar (still owned), dropping to $2,237/mo from April
  onward (the true Q2 sale month). The dropped deduction is worth roughly $39K/yr on that
  balance at 4.875% — in the same ballpark as the measured $7,158/yr sale-year tax gap for
  pin_35 (the remainder of that gap is the ordinary resampling effect, C1 below).
- **Which engine is correct, and why:** the monthly engine — it uses true monthly ownership
  (`ownedMo`) for the interest calc, same as it correctly does for the mortgage *payment*
  already. The annual engine uses a DIFFERENT, coarser gate (`keepMap`, year-level) for the
  interest-deduction figure specifically, inconsistent with its own (correct) monthly-resolution
  handling of the payment itself.
- **Resolves automatically:** once tax is computed via the monthly engine's own method for
  every row (as it already does correctly), this bug simply disappears — no dedicated fix
  needed beyond deleting the annual engine's approximation.

---

### CATEGORY C — Clean aggregation exceptions (monthly more precise, small expected shift, not a bug)

#### C1. Tax estimate, ORDINARY YEARS ONLY: once/year (annual) vs. re-annualized every month (monthly)

**Narrowed 2026-07-12** — the sale-year portion of this finding (the large +25-50% deltas) was
traced to a specific bug and moved to B3 above. What remains here is genuinely clean: `wfData`
calls `estimateTax()` fresh every month on that month's own annualized income; `buildScenario`
called it once per row on period-average income. Under progressive brackets these aren't
mathematically equivalent even in principle (Jensen's-inequality-type effect from averaging
before vs. after the nonlinear tax function) — a real precision difference from sampling
frequency, not a wrong formula (same `estimateTax()` function on both sides, no ownership-gating
bug involved in a non-sale year).

- **Measured** (annual `tax` field vs. sum of monthly `fc_tax`, ordinary — non-sale — years):

  | | yr3 (cal 2029) | yr5 (cal 2031) |
  |---|---|---|
  | pin_35 | annual $8,580 vs monthly $8,957 (−4.2%) | annual $9,036 vs monthly $9,449 (−4.4%) |
  | pin_36 | annual $16,752 vs monthly $18,429 (−9.1%) | annual $18,216 vs monthly $20,002 (−8.9%) |
  | pin_37 | annual $16,656 vs monthly $18,025 (−7.6%) | annual $18,108 vs monthly $19,575 (−7.5%) |

  Pattern: annual understates tax by ~4-9% in ordinary years, consistently. Small and
  directionally consistent — a genuine clean aggregation exception. (The sale-year rows, e.g.
  pin_35's $21,588 vs $14,430, are B3's bug, not this.)

#### C2. Rental/cost growth compounds once/year (annual) vs. continuously (monthly)

`buildScenario` evaluates `(1+rate)^elapsedYrs` once per row, frozen at that row's year-start.
`wfData` evaluates the same formula fresh every month via `mo/12`.

- **Measured:** pin_35, year 3 (cal 2029): annual reports a flat `rental=$3,256/mo` for the
  whole year; monthly's actual months range from $3,392 (Jan) to $3,485 (Dec) — the annual
  figure sits **below the entire monthly range**, not near its midpoint. Applies identically
  to core-cost inflation (`coreinf`) and property tax/insurance inflation (`propinf`) — anywhere
  `elapsedYrs` is used as a once-per-row snapshot instead of a continuous `mo/12` compounding.
- **Expected shift:** ~1-2% per year at typical 3-5%/yr growth rates, compounding mildly across
  a 20-year horizon. Genuinely small and directionally consistent (annual under-reports).

---

### CATEGORY D — New capability to build (not aggregation; monthly engine doesn't have the concept yet)

#### D1. Property appreciation / value tracking — doesn't exist in the monthly engine

`wfData` tracks mortgage balances and rental cash flows only; it has no notion of a property's
current appreciated market value. `reValue`/`reEquity`/NW's RE component are 100%
annual-engine constructs today (`prop.value × (1+appPct)^elapsedYrs`).
- **Can it borrow the annual formula during transition?** Yes, directly — the same formula
  ports to monthly by swapping `elapsedYrs` for continuous `mo/12` (which also happens to fix
  C2's once-per-year snapshot issue for this specific field, for free, as a side effect of
  building it in the monthly engine to begin with). Not a fresh-design problem, just needs to
  be added as new per-month state in `wfData`, using the formula that already exists.

#### D2. Per-debt and per-property balance/rental breakdowns not exposed by `wfData` — but already computed internally, just not output

`wfData` rows expose combined `hiDebt` but not `ccBal`/`sophiaBal`/`nolanBal` individually
(needed for the Simulator's HI-debt breakdown table, which the Group G tests assert on by
literal label). It exposes `mtgBal6`/`mtgBal15` by name but no Lafayette/Barberry equivalent.
It exposes a combined `rentalMo` total but no per-property breakdown (`propRentalYr`'s
monthly analog).
- **Can it borrow the annual engine's formula, or is it fresh work?** Neither, really — it's
  even easier than that. `wfData`'s own internal state (`ccBal`, `sophiaBal`, `nolanBal`,
  `_mtgSt[prop.id].bal` per property, per-property rental accumulators) **already exists and is
  already computed correctly inside the monthly loop** — it's just not pushed into the row
  object at the end. This is wiring, not new math.

#### D3. `totalOut` — no single matching monthly field, but assemblable from existing monthly sub-fields

Annual's `totalOut` has no `wfData` counterpart, but unlike D1/A3, this one doesn't need new
math either — it's `tier1 + maintRes + rdAdd + obAdd + (minPmt+sweep) + mtgExtra`, all of which
`wfData` already computes per month. New aggregation-layer logic (a sum of existing fields),
not new engine capability.

#### D4. Structured event lists (`loanStarts`/`loanPayoffs`/`mtgTransitions`/`mtgPayoffs`) — currently text-only in `wfData`

`wfData.events` is an array of human-readable display strings ("Family loan starts -- $611/mo").
The annual engine's equivalents are structured arrays of `{label, delta}` objects. Reconstructing
the structured form by parsing the display strings back out would be fragile. Recommend `wfData`
emit structured event objects alongside (or instead of) the display strings — straightforward,
since the underlying state change (a loan starting, a payoff) is already detected inline right
where each event string is currently pushed; it's a matter of also pushing a structured record.

---

### Cross-cutting note (not independently categorized)

`chartData.nw` today is `annualEngine.nw/1000 + monthlySavingsAcc` — the codebase already
"aggregates" for NW specifically by adding one engine's stock component to the other's flow
accumulation. This isn't a new finding to act on by itself; it resolves automatically once A1
(maintenance), A3 (`cashAst`), B1 (debt-clear pace), and D1 (appreciation) are each resolved —
listed here only so Phase 1 doesn't treat `nw` as "already aggregated, leave it alone."

### Explicitly NOT an exception (ruled out, not classified above)

The Nolan-loan grace-period gate (`absMo<5` vs. `mo>=5`) — both engines compare the identical
elapsed-months-since-`BASE.startMonth` basis and the identical threshold (5), so they agree
with each other today (CLAUDE.md's "unverified calendar accuracy" caveat is about real-world
correctness, not cross-engine drift). Not a source of divergence; excluded above.

---

## 0b. Baseline fixtures

Captured all 3 currently-pinned scenarios (exported from the live app by the user:
`1675Price-1` id 35, `17250Price-STRs` id 36, `1675Price-2-STRsOn15thIn26` id 37) by importing
that export into a running dev-server instance and, for each pin, clicking "Load into editor"
then reading the same test-scaffolding hooks Playwright uses
(`window.__liveRows`, `window.__wfData`, `window.__chartData`, `window.__chartMarkers`,
`window.__engine.keyStats(...)`, `window.__liveSc`). No test suite was run — this reuses the
app's existing instrumentation, not the Playwright spec file.

Written to `v5_fixtures/`:
- `pin_35_1675Price-1.json`
- `pin_36_17250Price-STRs.json`
- `pin_37_1675Price-2-STRsOn15thIn26.json`

Each file contains, for that scenario:
- `liveRows` — full annual engine output, all 21 rows, all 71 fields/row (includes
  `dispoResults`/`dispoResultsNoOffset` is NOT included — those are non-enumerable array
  properties attached to the `rows` array itself, not plain JSON-serializable this way; **note
  for Phase 1**: if the fixture comparison needs disposition-level detail, re-capture those
  separately, they weren't lost, just not captured in this dump).
- `wfData` — full monthly engine output, all 252 rows, all 46 fields/row (the entire Cash Flow
  tab's data source).
- `chartData` — the actual per-year plotting dataset for every Simulator-tab chart (NW, FCF/
  surplus, Debt Balances, Fixed Costs, reqWork, liquidation NW), including all 3 pins'
  `pin_<id>_*` comparison-line fields (since all 3 pins were loaded simultaneously/visible
  during capture).
- `chartMarkers` — `debtClearYear`/`sweepToSavingsYear` reference-line years.
- `liveStats` — `workFreeYr`/`debtClearYr`/`nwYr10`/`maxDI`/`launchRW` headline milestones.
- `liveSc` — the live scenario param state at capture time (sanity-checked against each pin's
  `paramSnapshot` — confirmed exact match, e.g. pin 35's `ssStartMonth:10` and
  `properties[0].value:1675000` both round-tripped correctly).

This is the full charted surface for both tabs, per pinned scenario — the regression baseline
Phase 1's Checkpoint 1a fixture-comparison test should diff against, adjusted for the approved
0a exceptions.

---

## 0c. Aggregation mapping

For each `liveRows` (annual) field, how it should derive from `wfData` (monthly) output once
`buildScenario` is deleted. **Stock** = snapshot at year-end (or year-start, per the existing
v4.3.0 pre-decrement snapshot convention — see CLAUDE.md). **Flow** = sum over the year's months.

| Annual field(s) | Kind | Monthly source | Notes |
|---|---|---|---|
| `rental`, `passive`, `pension`, `yourSs`, `brendaSs`, `workInc` | Flow | sum(`wfData.rental`/`pension`/`yourSs`/`brendaSs`/`workIncome`) | Clean rollup — monthly versions are already more exact (true calendar-month gating), so this is a legitimate improvement, not just a refactor. |
| `health` | Flow | sum(`wfData.fc_health`) | Clean — `healthMonthly()` already shared/exact between engines. |
| `mtg`, `propCost`, `core` | Flow | sum(`wfData.fc_mtg`/`fc_propCost`/`fc_core`) | Clean rollup. |
| `tax` | Flow | sum(`wfData.fc_tax`) | Clean rollup — `wfData`'s own monthly-native tax calc becomes canonical for every row (not just ordinary years), which also automatically fixes B3 (the sale-year mortgage-interest-deduction bug) since there's no more annual-only `keepMap`-gated `_mtgInt` calc to be wrong. Expect ordinary-year values to shift ~4-9% (C1, clean) and sale-year values to shift up to ~50% (B3, bug fix, not a rollup artifact). |
| `maint` | Flow | **NEW formula, not a rollup of either engine's existing field** — `struct6/15/Laf × maintStr% × propCPI`, uncapped, every month, summed | **RESOLVED (A1):** neither engine's current field is reused. The annual engine's `value×maintRate` and the monthly engine's capped `maintRes` are both retired. Phase 1 must add this as new per-month accrual logic in the single engine (structurally close to the monthly engine's existing `_maint6Base` calc, just with the 5-year cap removed). See A1's note on the pooled-routing reserve-fill-step interaction (`res6`/`res15`/`resLaf` retirement) below. |
| `famLoan`, `famLoanBal` | Flow / Stock | sum(`wfData.fc_famLoan`) / `wfData.loansBal` (year-end) | Clean — `loansBal` already exists. |
| `minDebt`, `debtSweep`, `totalDebtPmt` | Flow | sum(`wfData.fc_hiMins`) / sum(`wfData.sweep`) / sum | Clean, though reconcile `fc_hiMins` vs. `minPmt` (both exist in `wfData`, confirm which is canonical before wiring). |
| `sweepToSavings`, `sweepChart`, `fcfChart`, `surplus` | Flow | sum(`wfData.sweepToSavings`) / sum(`wfData.disc`) | `chartData` already does most of this today (`discByYear`, `sweepByYear`). But annual `surplus` and `fcfChart` are currently two DIFFERENT fields computed two different ways in `buildScenario` (see the v4.1.5 comment on `fcfChart`) — Phase 1 needs to pick ONE aggregated definition for both, or keep them as two distinct aggregations with a documented reason. |
| `hiDebt`, `hiDebtRaw`, `hiDebtK` | Stock | `wfData.hiDebt` (year-boundary row) | Clean, and this is the field most likely to shift materially — see B1 (up to a full calendar year, pin_37 example). |
| `ccBal`, `sophiaBal`, `nolanBal` | Stock | **not currently exposed per-row in `wfData`** | Gap — see D2. Needs new fields added to the monthly engine's row output (state already computed internally, just not pushed to the row). |
| `totalInc` | Flow | sum(`wfData.totalInc`) | Clean. |
| `totalOut` | Flow | **no single matching `wfData` field** | Gap — `wfData` doesn't compute one combined "total outflow" per row; would need to be assembled from `tier1 + maintRes + rdAdd + obAdd + debtService + mtgExtra` as new aggregation-layer logic, not a rollup of an existing field. |
| `reqWork` | Derived | `totalOut(aggregated) - passive(aggregated)` | Clean IF `totalOut` above is resolved. |
| `nw`, `reEquity`, `reValue`, `reMortgage` | Stock | **`reValue`/`reEquity` have no monthly source at all** | Gap — see D1, appreciation tracking doesn't exist in the monthly engine yet; formula ports directly, just needs continuous mo/12 instead of elapsedYrs. `reMortgage` is mostly covered by `mtgBal6`/`mtgBal15` but missing Lafayette (D2). |
| `invested`, `cashAst` | Stock | **no clean monthly analog** | `cashAst` is an annual-engine-only concept (pre-2027 settlement-shortfall cash funding) with no `wfData` equivalent; closest relative is `savingsAcc` but they track different things (see A3). Needs a Phase 1 design decision, not a mechanical mapping. |
| `primBalRaw`, `dplxBalRaw`, `lafBalRaw` | Stock | `wfData.mtgBal6` / `mtgBal15` / **missing** | Lafayette balance not currently surfaced per-row — gap, see D2. |
| `propRentalYr` | Flow (per-property) | **no per-property breakdown in `wfData`** | Gap — `wfData` only tracks a combined `rentalMo` total across all properties, not per-property. New field needed. |
| `dispoTax`, `dispoNet`, `settlementOut`, `wfDebtPaid`, `wfToSavings`, `hiPaydownDetail` | Flow/one-time | `wfData.settleDraw`/`oneTimePaydown`/`oneTimeReserveFill`/`oneTimeSweep`/`paydownDetail` | Present and MORE accurate in `wfData` already (B2) — clean rollup, but numeric values WILL shift because the annual version was simply wrong (B2), and `wfToSavings`'s meaning needs to split into "reserve fill" vs. "true sweep" on the annual side too. |
| `loanStarts`, `loanPayoffs`, `mtgTransitions`, `mtgPayoffs` | Event lists | `wfData.events[]` | Currently only as free-text strings, not structured data — the aggregation layer would need to parse `events` text to reconstruct these structured lists, which is fragile. Recommend `wfData` emit structured event objects (label, type, delta) alongside (or instead of) the display strings, rather than parsing them back out. |
| `mtgExtra` | Flow | sum(`wfData.mtgExtra`) | Clean. |
| `ioMode` | Stock (boolean) | derivable from `wfData`'s per-property mortgage recast state | Not currently exposed as a boolean flag in the row output; would need adding, but the underlying state already exists in `_mtgSt`. |
| `cumInc`, `cumCost`, `cumPension`, `cumWork`, `cumSS`, `cumRental`, `cumDraw`, `cumGap`, `cumTax`, `cumMtg`, `cumHealth`, `cumCore`, `cumProp`, `cumMaint`, `cumDebt` | Running flow | running sum of the corresponding aggregated annual flow field | Clean once each underlying flow field above is resolved. |

**Update 2026-07-12 — all Category A items resolved.** `maint` (A1: new uncapped
structure-value formula, not a rollup — see updated table row above), `surplus` vs. `fcfChart`
(A4: `fcfChart` deleted, `disc` is now the FCF-chart source for live AND pins, `reqWork` stays
on the `surplus`/`totalOut` basis), `cashAst`/`invested` (A3: treated as a constant 0, no
shortfall ledger built), and whether pins get their own monthly run (A2: yes) are no longer
open questions — see the Phase 1 plan below for how each gets implemented. Still-open
**mechanical** (not decision-requiring) items: `totalOut` (D3, needs assembly from existing
monthly sub-fields), `reValue`/`reEquity`/appreciation (D1, missing capability, formula ports
directly), per-debt/per-property balance and rental breakdowns (D2, gaps in `wfData`'s row
shape, state already computed internally), and structured event lists (D4, currently
text-only).

---

## CHECKPOINT 0 — CLEARED 2026-07-12

All Category A modeling decisions made; B-bugs and C-precision items confirmed with the correct
engine identified for each. Proceeding to present the Phase 1 plan below for approval. **No
Phase 1 code has been written.**

---

## Phase 1 plan (for approval — no code yet)

Restates the original spec's Phase 1 steps, now made concrete by every Phase 0 finding and
Category A/B/C/D resolution above.

### 1. Build out the single monthly engine (`wfData`) as sole source of truth

New work needed beyond what `wfData` already does today:

- **Maintenance (A1):** add `struct6/15/Laf × maintStr% × propCPI`, uncapped, as an ordinary
  per-month cost line (structurally similar to the existing `_maint6Base` calc minus the 5-year
  cap). **Retire `res6`/`res15`/`resLaf` as capped reserve buckets** — proposed in A1, treating
  as accepted unless you object when reviewing this plan. The sale-year pooled-proceeds routing's
  "reserve/buffer top-up" step (CLAUDE.md's step (c)) narrows from 5 buckets to 2 (`rd`/`ob`
  only) as a direct consequence — `oneTimeReserveFill` in the monthly engine's output no longer
  includes a maintenance-reserve component.
- **Tax (B3/C1):** no dedicated fix needed — the monthly engine's existing per-month
  `estimateTax()` call already uses true `ownedMo`-gated mortgage balances and already runs for
  every row. This becomes canonical for the annual view too (via aggregation), which
  automatically fixes B3 and absorbs C1's small remaining ordinary-year precision difference.
- **Property appreciation (D1):** add continuous monthly appreciation tracking
  (`prop.value × (1+appPct)^(mo/12)`) as new per-month state — direct port of the annual
  formula's math, just continuous instead of once-per-row. Needed for `reValue`/`reEquity`/NW.
- **Per-debt and per-property exposure (D2):** push `ccBal`/`sophiaBal`/`nolanBal` individually
  (state already tracked internally, just not in the row output), add a Lafayette mortgage
  balance field alongside the existing `mtgBal6`/`mtgBal15`, and add a per-property rental
  breakdown (state already computed per-property inside the loop, just summed before output).
- **`totalOut` (D3):** add as an assembled field — `tier1 + maintRes(new formula) + rdAdd + obAdd
  + (minPmt+sweep) + mtgExtra` — from fields the monthly engine already computes.
- **Structured events (D4):** emit structured `{label, type, delta}` objects alongside (or
  instead of) the existing display strings, at each point an event string is already pushed.
- **`cashAst`/`invested` (A3):** no engine work — the aggregation layer just reports 0.

### 2. Pins run the full monthly engine (A2)

Replace pins' `buildRowsFromSnapshot` (currently `buildScenario`-only) with a call into the same
single engine live uses. Every `pin_<id>_*` chart field (including the FCF line, per A4) sources
from that pin's own monthly output — computed identically to live, eliminating the live-vs-pin
FCF divergence risk that exists today.

### 3. `fcfChart` variable deleted; FCF chart unaffected (A4)

`chartData`'s FCF-line logic simplifies to always reading `disc` (aggregated from monthly) for
every scenario, live or pinned — no more `annualFcfExDraw` fallback branch. `reqWork` continues
to derive from the `surplus`/`totalOut` basis (item 1's `totalOut`, not `disc`).

### 4. Annual/Simulator view = pure aggregation, per the 0c mapping table above

Stocks = year-boundary snapshot; flows = sum over the year's months; `reqWork` = aggregated
`totalOut` − aggregated `passive`. `nw` stops being a hybrid add-of-two-engines (0a's
cross-cutting note) and becomes one aggregation: RE value/equity from the new monthly
appreciation tracking (D1) + mortgage balances (D2) − HI/LI debt (already monthly-native) +
`savingsAcc` (already monthly-native). `invested` = 0 (A3).

### 5. Delete `buildScenario` and its dedicated per-month mirror loop entirely

Once aggregation reproduces the Phase 0 fixtures (adjusted for the approved B1/B2/B3 bug-fixes
and C1/C2 precision shifts — everything else should match exactly), remove the annual engine's
independent implementation from `engine.js`. Keep only what the aggregation layer itself needs.

### Expected fixture deltas at Checkpoint 1a (so mismatches can be triaged correctly)

- **Should match exactly:** everything not listed below.
- **Should move (bug fixes, B1/B2/B3):** `debtClearYr`/`workFreeYr` (up to ~1 year, direction
  scenario-dependent — re-verify pin_37's specific mechanism per B1's open note), sale-year
  `wfToSavings`/reserve-vs-sweep split, sale-year `tax`.
- **Should move slightly (clean precision, C1/C2):** ordinary-year `tax` (~4-9%), rental/core/
  property-cost figures (~1-2%/yr, compounding mildly over the horizon).
- **Should move a lot, expected (A1 modeling decision):** `maint`, and everything downstream of
  it (`totalOut`, `surplus`, `reqWork`, `nw`) — this is a deliberate behavior change, not a
  refactor artifact. **Specifically: late-horizon NW will be LOWER in every scenario**, not just
  differently distributed. Mechanism: under the old capped-reserve formula, once `res15`+`resLaf`
  hit their 5-year cap, `maintRes` (the cost line) drops to **$0 for the rest of the 21-year
  horizon** — real, measured in the current fixtures: pin_35/37 cap out by cal 2031 (mo 60),
  pin_36 by cal 2028 (mo 25, sale-year reserve fill got it there faster). Under the new uncapped
  +inflated formula, maintenance keeps accruing as a real cost at ~$469/mo (2029 dollars, 15th +
  Lafayette combined, growing at the 3.5%/yr `propCpi`) all the way to the horizon end (2046),
  instead of $0. **Measured cumulative extra cost from cap-month to horizon end, computed
  directly against the current fixtures:** pin_35 ≈ **$142K**, pin_36 ≈ **$161K** (caps earliest,
  so accrues 3 more years of "extra" cost), pin_37 ≈ **$142K**. Expect late-horizon NW (yr 15-20)
  to be lower by a comparable order of magnitude in each pinned scenario — this is a real,
  quantified, expected shift, not a bug to chase down if seen at Checkpoint 1a.
- **New fields with no prior baseline to compare against:** per-debt/per-property balances,
  structured events, `totalOut` (D2-D4).

**CHECKPOINT 1a (targeted, not yet run):** fixtures-comparison test only, per the spec. Report
every mismatch; iterate until only the categories above remain.
**CHECKPOINT 1b (full suite, not yet run):** only after 1a is clean, with your confirmation.

---

Awaiting your approval to begin Phase 1 implementation.

---

## Phase 1 — IMPLEMENTED. Checkpoint 1a report (2026-07-12)

Build steps 1-5 are done: `buildMonthlyScenario` + `aggregateMonthlyToAnnual` +
`computeDispositions` (all in `engine.js`) are the single engine; `App.jsx` wires
`wfData`→`liveRows` through the aggregation, pins run the full monthly engine (A2),
`fcfChart`/`sweepChart` are gone (A4), and `buildScenario` is deleted entirely. Verified with
`npm run build` (clean) and a headless smoke test (app loads, 21 annual/246 monthly rows,
zero console errors, all 3 tabs navigate cleanly). **The full Playwright suite (Checkpoint 1b)
has NOT been run. Nothing has been committed.**

Verification method: compared the new engine's output against the Phase 0 fixture files
(`v5_fixtures/*.json`) field-by-field, every row, for all 3 pinned scenarios — a pure-Node
script, not the Playwright suite. **Result: zero unexpected deltas across all 3 scenarios,
all 21 years, all ~70 fields per row**, after the fixes below.

### Bugs I found and fixed during my own verification (before presenting this)

Flagging these explicitly rather than presenting only the clean final result — three of these
were serious enough that I want you to know they existed, however briefly, in my own
implementation:

1. **Month-count bug (own bug):** hardcoded `252` months (21×12) is only exactly 21 calendar
   years when `BASE.startMonth` is January. For the actual default (July), it overshoots 6
   months past December of year 20, spilling into a spurious 22nd partial year. Fixed to
   `monthsElapsedBeforeYear(21, startMonth)`. Worth noting: **this bug already existed in the
   pre-v5 `wfData` block too** — it just never surfaced because the old `chartData` only ever
   visited years present in the separately-bounded 21-row `buildScenario` output.
2. **Missing `savingsAcc` in `nw` (own bug):** my first draft of `aggregateMonthlyToAnnual`
   forgot to fold `savingsAcc` into `nw` — caught because it made `nwYr10` identical across
   all 3 scenarios (a dead giveaway, since they have materially different rental income).
3. **`propMtgBal` not gated by ownership (own bug, the serious one):** a sold property's
   mortgage state simply stops being stepped once sold (by design), but I was reading its
   frozen pre-sale balance unconditionally instead of zeroing it out post-sale. This wrongly
   subtracted a paid-off $805K mortgage from NW for every year after 6th St's sale — it's
   what was producing the alarmingly large NW deltas I saw in my own first-pass smoke test.
   Fixed by gating on ownership, matching the old annual engine's `keepMap`-gated convention.
4. **`famLoanBal` units bug (own bug):** forgot to divide by 1000; was reporting $21,432K
   instead of $21K.
5. **`cumDraw` missing the one-time settlement draw (own bug):** the old annual engine blended
   the scheduled-lifestyle-draws flow and the one-time settlement draw into one `drawInc`
   field before computing `cumDraw`; my new `drawInc` only covers the scheduled draws. Fixed
   by adding `settleDraw` back into `cumDraw` directly.

All five are now fixed and covered by the zero-unexpected-deltas result above.

### Newly-discovered findings, not in the original 0a list

- **`dplxBalRaw`/`lafBalRaw` (15th St / Lafayette mortgage balances) drift by a few hundred
  dollars a year, growing to ~$1,300 by year 15** — traced to the pre-v5 world having TWO
  separately hand-written mortgage-stepping implementations (`buildScenario`'s own `stepMtg`
  and `wfData`'s own `_stepMtg`), never deduplicated the way `planHiPaydown`/`splitResidual`
  were. Small floating-point/rounding differences across 246 compounding steps. Resolves
  automatically now that there's one implementation — not something Phase 0 caught (I only
  read the code, didn't diff actual mortgage-balance numbers until now), and not a bug, just
  a previously-unmeasured clean precision difference in the same spirit as C1/C2.
- **`primBalRaw` (6th St mortgage balance) — a direct sibling of B3, confirmed:** the OLD
  annual engine's year-level `keepMap` gate zeroed 6th St's mortgage balance for the *entire*
  sale year (2027), even for January-March when it was genuinely still owned (the sale closes
  Q2/April). Same root-cause bug as B3 (which was about the *tax* interest deduction) — this
  is the identical coarse-gating bug also corrupting the sale-year `primBalRaw`/`reMortgage`
  figure. Confirmed via `unitOwnedThisMonth`: January-March 2027 genuinely returns `owned=true`
  for 6th St. New engine correctly shows the true ~$805K balance for those months; old showed
  $0 all year. Only affects the sale year itself (2027) — years before and after agree exactly.

### A1's NW impact — corrected twice, now validated with real counterfactual engine runs (2026-07-12)

**Read this section, not the superseded draft it replaces.** The original Phase 0 estimate
(late-horizon NW **lower** by ~$142-161K, comparing capped `wfData.maintRes` against the
uncapped formula) was flagged as wrong in an earlier pass of this report — that correction
itself turned out to be wrong too, for a different reason. Full trace, so the mistake and the
fix are both on the record:

1. **Phase 0 estimate:** −$142-161K. Wrong baseline (compared against `wfData`'s capped
   reserve, which was never what fed the annual `nw` field).
2. **First "correction":** claimed the real effect was tiny (+$7-10K, `cumMaint` only) and NW
   actually goes *up*. This used an incomplete counterfactual — it isolated only the direct
   cost-line basis swap (value×rate vs. struct×rate), missing that A1 has a **second,
   dominant** mechanism: the old capped system, once each reserve filled (~2028-2031
   depending on scenario), redirected the *entire* ongoing maintenance amount straight into
   the savings sweep for the remaining 15+ years (`maintRedirect` in the old `wfData`). Removing
   the cap removes that redirect too — maintenance becomes a permanent draw on cash flow
   instead of a temporary one.
3. **Final, validated figure** (after finding and fixing a double-counting bug in my own
   isolation script — see below): **A1's full effect is −$197K to −$267K at year 20** (−$49K to
   −$70K at year 10) — matching the *original* Phase 0 direction, in the same order of
   magnitude as the original estimate, now measured by running the actual engine with just
   that one behavior reverted rather than estimated by comparing the wrong fields.

**Full named, sized decomposition, all 3 pins, year 20 ($K) — verified to sum to the actual
total within $4-10K (interaction/precision residual):**

| | pin_35 | pin_36 | pin_37 |
|---|---|---|---|
| **Total ΔNW (old→new)** | **+39** | **+473** | **+820** |
| A1 — direct cost-line (basis swap only) | +18 | +96 | +182 |
| A1 — lost capped-reserve→sweep redirect | −215 | −351 | −449 |
| **A1 total** | **−197** | **−255** | **−267** |
| B3 (sale-yr mortgage-interest tax gate) | 0 | +7 | +3 |
| C1 (tax: monthly vs. once/yr) | −5 | −9 | −14 |
| C2 (rental: monthly vs. once/yr) | +4 | +14 | +23 |
| Savings now correctly included (= old `wfData`'s own always-correct figure) | +233 | +726 | +1,085 |
| Residual (interaction, `primBalRaw` sibling, mortgage-stepper precision) | +4 | −10 | −10 |

Method: real counterfactual runs of the actual engine (not formulas worked out on paper) — for
each factor, ran the new engine with just that one behavior reverted to old-style, measured the
marginal `nw` difference. Caught one real bug in this process before trusting it: my first "full
A1" counterfactual double-counted maintenance (once via an uncapped uncapped cost line, again
via a separately-tracked capped-reserve subtraction) — the true old `wfData` only ever did the
second one; `tier1` there never included maintenance in any form. Fixed, then validated: the
isolated pieces plus the savings-inclusion term reproduce the actual total to within $4-10K.

**Was your currently-committed, pre-refactor NW display actually wrong?** No. Checked directly:
- **Live scenarios:** the old `chartData` already added `wfData`'s real, correctly-compounded
  `savingsAcc` back into the displayed NW — this was already correct.
- **Pinned comparison lines** (what your 3 saved pins show): used a cruder annual-compounding
  approximation instead of the true monthly figure. Measured against your actual saved pins:
  low by **$8K, $10K, and $44K respectively** — a 1-4% understatement, not the six-figure swings
  in the table above. Those six-figure numbers come entirely from comparing against
  `liveRows.nw`, an internal field that was never displayed to you.

### Requested addition 1: MAINTENANCE standalone report (pin_35 — pin_36/37 nearly identical, see full log)

Real engine output, `propMaintYr` (new per-property field), $/mo average per year:

| yr | cal | 6th St | 15th St | Lafayette | **new combined** | old `maint` |
|---|---|---|---|---|---|---|
| 0 | 2026 | 378 | 315 | 158 | **850** | 844 |
| 1 | 2027 | 96 | 323 | 162 | **580** | 467 |
| 2 | 2028 | 0 | 335 | 167 | **501** | 484 |
| 5 | 2031 | 0 | 371 | 185 | **556** | 536 |
| 10 | 2036 | 0 | 440 | 220 | **660** | 637 |
| 15 | 2041 | 0 | 523 | 262 | **784** | 756 |
| 20 | 2046 | 0 | 621 | 310 | **931** | 898 |

6th St's contribution correctly drops to 0 after the Q2 2027 sale (partial in the sale year
itself, reflecting the true ownership-gated months). The combined total grows smoothly at the
3.5%/yr `propCpi` rate with no cap — confirms A1 is implemented as decided: uncapped, ongoing,
inflated, structure-value-driven. The gap between new and old narrows to single-digit dollars
early on (both formulas were already close, per the correction above) and grows to ~$33/mo by
year 20 — small, and now I can say precisely why (calibration, not a capped-vs-uncapped gap).

### Requested addition 2: B1 pin_37 debt-clear mechanism, resolved

**Conclusion: `debtClearYr` does NOT actually change for pin_37 — it's 2028 in both the old
and new engine.** My original Phase 0 finding ("annual reports 2028, monthly clears in March
2027") was comparing two different things and made the divergence look bigger than it is.

Traced with real numbers: the pool-year routing (the Q2-scheduled sale's proceeds) applies at
the *start of the pool year*, January 2027, regardless of which quarter the sale physically
closes in (a pre-existing, unrelated modeling simplification, present in both old and new
engines equally). Monthly balance trace around the clearing point:

```
mo=4 (Nov '26)  hiDebt=$255K
mo=5 (Dec '26)  hiDebt=$255K
mo=6 (Jan '27)  hiDebt=$2K    <- pool-year lump sum lands here
mo=7 (Feb '27)  hiDebt=$1K
mo=8 (Mar '27)  hiDebt=$0K    <- true clearing (during February)
```

`debtClearYr` is read off the **first-of-calendar-year snapshot** (balance as of Jan 1, before
that January's own paydown) — both engines, always, per the v4.3.0 stock-snapshot convention.
As of Jan 1 2027, balance is $2K (not yet $0) in *both* the old and new engine — they agree.
Only by Jan 1 2028 does either report $0. So **both engines were always going to report 2028
for this specific stat**, regardless of the underlying avalanche-pace bug B1 identified. The
avalanche-pace difference is real (confirmed structurally: the old annual mirror-loop had no
rd/ob buffer competition) but for pin_37 it doesn't happen to straddle a year boundary, so it
doesn't show up in this particular headline number. **`workFreeYr` DID move (2028→2027)** —
that's a separate milestone (driven by `reqWork` hitting 0, which depends on the full A1/A4/C1/C2
basket, not the debt-avalanche pace specifically), not evidence of the same mechanism.

### Full before/after summary, all 3 pins

`nwYr10`/`nwYr20` below use the OLD *displayed* figure (raw `liveRows.nw` + `wfData`'s real
savings — what you actually saw), not the internal `liveRows.nw` field alone (never displayed,
and identical across all 3 pins by coincidence since 15th/Barberry are configured identically
across them — see the A1 section above for why that field is the wrong comparison point).

| | workFreeYr | debtClearYr | nwYr10 (displayed) | nwYr20 (displayed) |
|---|---|---|---|---|
| pin_35 old→new | 2027→2027 | 2027→2027 | $2,548K→$2,501K | $4,350K→$4,156K |
| pin_36 old→new | 2027→2027 | 2027→2027 | $2,813K→$2,746K | $4,843K→$4,590K |
| pin_37 old→new | **2028→2027** | 2028→2028 | $2,805K→$2,745K | $5,202K→$4,937K |

### `maxDI` — a real, previously-unflagged definitional change on a dormant field

`maxDI` (`keyStats`) is **not read anywhere in the current UI** (checked directly — no component
references `.maxDI` off `liveStats` or `pin.stats`), so this has zero visible impact today, but
the definition genuinely changed and should be a conscious choice before it's ever wired up:

| | OLD | NEW |
|---|---|---|
| Formula | `totalIncome − totalOut`, debt-sweep term forced to 0 once HI debt clears | `disc` — the floor/split-protected "kept" FCF, always (same value the Cash Flow tab's Free Cash line already shows) |
| Answers | "If the auto-sweep were suspended, what's the most cash available in the best year?" — a capacity/headroom question | "Under the actual sweep policy, what's the most spendable cash I'll ever see?" — a realistic-forecast question, bounded by `discFloor`/`lifestyleSplit%` |
| Measured (35/36/37) | $5,093K / $7,622K / $3,908K | $800K / $1,311K / $1,195K |

Recommendation (not decided unilaterally): keep the NEW definition — it's consistent with every
other FCF-adjacent figure in the app. If the OLD "capacity ceiling" question is still wanted,
it's a genuinely different stat worth adding deliberately, not reviving under this name.

### Scenario re-ranking on corrected NW (requested before commit)

None of the 3 saved pins is a "keep everything" scenario — all three sell 6th St in 2027 Q2 and
differ only in 15th St/Barberry rental configuration, which are configured identically across
all three. A1's effect therefore lands on all three fairly similarly in absolute terms. A
genuine never-sell scenario would carry A1 exposure for the full 21 years, not just
post-2027 — expect a larger relative effect there; not tested, no such pin exists in this set.

**Year 10 NW, old displayed → new:**
1. `17250Price-STRs` $2,813K → $2,746K (still #1, margin over #2 shrinks from $8K to $1K — now effectively a tie)
2. `1675Price-2-STRsOn15thIn26` $2,805K → $2,745K
3. `1675Price-1` $2,548K → $2,501K (still #3)

**Year 20 NW, old displayed → new:**
1. `1675Price-2-STRsOn15thIn26` $5,202K → $4,937K (still #1)
2. `17250Price-STRs` $4,843K → $4,590K (still #2)
3. `1675Price-1` $4,350K → $4,156K (still #3)

**NW ranking is unchanged at both horizons.** Numbers are lower and closer together, nothing
swaps places. One ranking DID change on a different stat: `workFreeYr` — `1675Price-2-STRsOn15thIn26`
was tied for *last* under OLD (2028, vs. 2027/2027) and is tied for *first* under NEW
(2027/2027/2027) — driven by the A1/A4/C1/C2 basket, not the debt-avalanche pace (confirmed
separately: `debtClearYr` for this scenario stays 2028→2028, unchanged).

### Lint note

`npm run lint`: 30 problems (baseline) → 36 (now). Investigated the delta directly — it's
**not new anti-patterns in code I touched**. The increase is entirely `react-hooks`
"React Compiler" rule categories (`Cannot create components during render`, `Calling setState
synchronously`) firing on the pre-existing `Chart` component and unrelated `setState` calls I
never touched. Confirmed by checking those exact lines — they're untouched pre-existing code.
Best explanation: the old `wfData` block's mutable-closure pattern (`let ccBal`, reassigned
across a big closure) tripped a different react-compiler rule
(`Cannot reassign variable after render completes`, present in the OLD baseline at a location
that no longer exists) that was apparently causing the linter to bail out of analyzing further
into the file; removing that pattern lets it reach further and surface pre-existing issues
elsewhere. Net change in categories I actually touched: `no-unused-vars` 17→15,
`react-hooks/exhaustive-deps` 9→8 — both improved.

### Not yet done

- Playwright suite (Checkpoint 1b) — not run, per your instruction.
- Manual visual verification (Phase 2) — not done.
- `retirement-simulator.spec.js` itself — untouched; several tests will need updating at 1b
  (e.g. the `data-testid="pooled-routing-result"` display text now includes a reserve-fill
  term per B2, `window.__engine.buildScenario` no longer exists).
- `maxDI` display decision (above) — not acted on, awaiting your call.
- Nothing committed.

### 2026-07-12 status

A1's NW decomposition corrected (twice) and validated against real counterfactual engine runs;
`maxDI` definitions laid out for your decision; 3-pin re-ranking complete (NW ranking unchanged
at yr10/yr20; `workFreeYr` ranking changed for one scenario). Awaiting your review of both
before Checkpoint 1b (full suite) or any commit.
