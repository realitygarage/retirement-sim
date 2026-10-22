# Claude Code Handoff — 2026-10-22

Consolidated instructions for the next Claude Code session: the Sept 2026 HI-debt refresh (carried forward, untouched since it was written) plus a newly-spotted Work Income Curve bug. Per the usual workflow — diagnose and propose a diff for each item, show it to Bob, let him review before writing, and don't run the full Playwright suite unless asked.

---

## PART A — HI-Debt Loan Refresh + Deferment-Gate Fix + Defaults-tab Caption

*(Full detail originally captured 2026-09-28 in `claude/hi-debt-loan-refresh-and-deferment-gate.md` in the claude.ai project — reproduced here in full so this one doc is self-contained.)*

### What prompted this

Screenshot of Nolan's Edfinancial repayment page (Standard Repayment Plan, "Last Updated 09/01/2026") showed 4 Parent PLUS loans, all in deferment until Dec 2026:

- $42,224.46 @ 8.94%
- $21,735.07 @ 9.08%
- $43,811.23 @ 8.05%
- $39,452.57 @ 7.54%

Total: $147,223.33. Edfinancial's own combined estimated monthly payment once repayment starts: $1,856.00.

Sophia's loan is already active (not in deferment) — Bob is paying $737.53/mo actual.

Bob also flagged (via a screenshot of the live Defaults tab's "Read-Only Mirrors" section) that the "SOPHIA HI LOANS (FEB 2026)" / "NOLAN HI LOANS (FEB 2026)" cards are captioned `edit on: not editable -- historical fact, see engine.js SOPHIA_LOANS` / `...NOLAN_LOANS` — which read as "this loan data can't be edited" and is what led him to think the balances were hardcoded. See A4 below.

### A1. Loan balance/rate/min are NOT actually hardcoded — already live/editable

`defaults.js` (`DEFAULTS`/`SC_DEFAULTS`) and `engine.js` (`SOPHIA_LOANS`/`NOLAN_LOANS`) look hardcoded, but the per-person blended values (`sophiaBal/sophiaRate/sophiaMin`, `nolanBal/nolanRate/nolanMin`) are threaded through as live scenario state in App.jsx (`sc`, with `setSophiaBal`/`setNolanBal`/etc.) and rendered as an editable "HI Debt Balances" panel — balance / rate / minimum-payment inputs per bucket (Credit Card, Sophia Loans, Nolan Loans). Both engines (`buildScenario` in engine.js, and `wfData` in App.jsx) read `p.nolanBal || NOLAN_LOANS.reduce(...)` — i.e. the hardcoded arrays are only the fallback used to seed the *default* starting value, not the live simulation math.

The live sim always tracks ONE blended balance/rate/minimum per person, never each of the 4 individual loans — that's a deliberate simplification, not a bug. It means results won't match the servicer's exact per-loan avalanche order, but will be very close for planning purposes.

**Action:** no architecture change needed for this part — just refresh the numbers (below), either typed into the HI Debt Balances panel for a one-off look, or updated in `defaults.js` so they're the new baseline every session starts from.

### A2. The default values are stale (Feb 2026 statement data, untouched since)

Current defaults (`nolanBal: 141_117`, `nolanMin: 1787`, `nolanRate: 0.084`) came from Feb 2026 balances (per the `engine.js` comment "actual balances Feb 2026"). ~7 months of deferment interest has grown Nolan's total by roughly $6,100 since then, which matches the screenshot.

**Recommended refresh (Nolan):**
- `nolanBal`: 141_117 → 147_223
- `nolanMin`: 1787 → 1856 (use Edfinancial's own computed repayment-plan figure rather than re-deriving a standard 10-yr amortization estimate from the balance)
- `nolanRate`: 0.084 → ~0.0832 (balance-weighted average of the 4 current rates; optional — the existing default is already close)

**Sophia:** her $737.53 actual vs. `sophiaMin: 737` default is immaterial, but her balance default (`58_057`) is *also* frozen at Feb 2026 and hasn't reflected 7 months of principal paydown in the model. Worth pulling her current Edfinancial total the same way so both buckets reflect current reality, not just Nolan's.

### A3. Real bug: Nolan's deferment-end gate is elapsed-months-based, not calendar-based

Flagged and left open as of the session 42 journal ("Nolan-loan grace-period gate still elapsed-months-based"). Both engines gate Nolan's loan from "deferred" (accrual only) to "active" (minimum payments + avalanche-eligible) purely by counting months elapsed since the simulation's launch date:

- `engine.js` `buildScenario`: `if(absMo<5){ nolanBal = nolanBal*(1+nolanRate/12); /* accrue only */ } else { nolanActive = true; }`
- `App.jsx` `wfData`: equivalent `nolanOn` flip; on-screen event label "Nolan loan payments begin" is hardcoded to `mo===5`

Neither reads an actual calendar date — it's baked in as "always 5 months after whenever the launch-date slider says the sim starts." That can't represent "deferment runs through Dec 2026" as a fact independent of the launch date, and will silently drift out of sync if the launch date ever changes.

**Recommended fix:** add a real editable parameter — e.g. `nolanDefermentEndCal` (a calendar year+month, same pattern as the existing `sellYear`/`lafStopYear` fields) — and gate off of it in both engines instead of `absMo<5` / `mo===5`. Expose it as a control next to the existing Nolan Loans block in the HI Debt Balances panel so Bob can move it himself whenever Edfinancial updates the deferment end date, with no code change required. Because both the annual and monthly engines independently implement this gate (per the two-engine architecture in `v5_architecture_note.md`), the fix needs to land in both places to avoid violating the existing "monthly wfData is authoritative, annual must agree" invariant.

When wiring this in: confirm with Bob whether "deferment until Dec 2026" means Dec 2026 is the last deferred month (first payment due Jan 2027) or the first repayment month itself (first payment due Dec 2026) — simplest is to define the field as "first calendar month a payment is due" and let him enter whichever is correct once it's editable, rather than guessing.

### A4. Defaults-tab caption is misleading — reads as "can't be edited" when only the audit breakdown is frozen

The Defaults tab's "Read-Only Mirrors" section has cards titled "SOPHIA HI LOANS (FEB 2026)" / "NOLAN HI LOANS (FEB 2026)" listing the 4 individual loans per person, captioned:

`edit on: not editable -- historical fact, see engine.js SOPHIA_LOANS` (and the Nolan equivalent pointing at `NOLAN_LOANS`)

That caption is technically accurate for the per-loan breakdown itself — it *is* a frozen Feb 2026 snapshot, used only to originally seed the blended default (see A1) — but it reads, at a glance, as "this loan data can't be edited," with no pointer to where the actual live/editable balance, rate, and minimum payment for each kid do live (the HI Debt Balances panel on the Simulator tab). That ambiguity is exactly what caused this round of confusion.

**Recommended fix:** reword the caption to distinguish the frozen historical breakdown from the live editable total it seeds, e.g.:

`edit on: this per-loan breakdown is a frozen Feb 2026 snapshot for audit only -- to change the working balance, rate, or minimum payment, edit "Nolan Loans" in the HI Debt Balances panel on the Simulator tab`

(mirror for Sophia). Consider also relabeling the card titles themselves — e.g. "NOLAN HI LOANS -- ORIGINAL BREAKDOWN (FEB 2026, historical)" — so the frozen-snapshot nature reads clearly even without stopping to read the caption line.

### Part A suggested commit shape (3 commits)

1. **Caption/label fix** — reword the Defaults-tab "not editable" captions (and optionally card titles) on the Sophia/Nolan HI Loans cards to point at the live editable location, per A4. Cheapest, lowest-risk; land first.
2. **Data refresh** — update Nolan's (and re-pulled Sophia's) balance/min/rate in `defaults.js` (`DEFAULTS` and `SC_DEFAULTS`), per A2.
3. **Behavior fix** — replace the elapsed-months Nolan gate with a calendar-based `nolanDefermentEndCal` param in both `engine.js` and `App.jsx`'s `wfData`, plus a slider/date control for it in the HI Debt Balances panel, per A3.

---

## PART B — Work Income Curve: monthly Cash Flow table lags ~2 quarters behind the set target

### What prompted this

Bob set a Work Income Curve point to **$0 at 2027 Q1** on the Simulator tab (curve now shown as: 2026 Q3 = $5,417, 2027 Q1 = $0, 2031 Q1 = $0, 2034 Q1 = $0). On the Cash Flow tab's Month-by-Month table, the **Work** column doesn't actually reach $0 until **Jul 2027** — six months / two quarters after the point he set:

| Month | Work |
|---|---|
| Oct '26 | $3,835 |
| Nov '26 | $3,240 |
| Dec '26 | $2,642 |
| Jan '27 | $2,060 |
| Feb '27 | $1,513 |
| Mar '27 | $1,022 |
| Apr '27 | $605 |
| May '27 | $282 |
| Jun '27 | $74 |
| Jul '27 | (not confirmed on screen, but trending to ~$0) |

**Expected:** once a curve point is set to $0 at 2027 Q1, modeled work income should be at (or essentially at) $0 starting Jan 2027 — not still declining through June.

### Diagnosis — CONFIRMED as a monthly-engine-specific bug, not a shared curve-shape issue

Bob confirmed the key diagnostic: the Simulator tab's own work-income figure (driven by the annual engine, `buildScenario` in engine.js) **already shows ~$0 starting 2027** — i.e. it already matches the 2027 Q1 = $0 point as expected. Only the Cash Flow tab's monthly table (driven by `wfData` in App.jsx) lags, not reaching $0 until Jul 2027.

That rules out a pure curve-shape/smoothing artifact in `workFromCurve` itself as the primary cause — if the spline's tangent/overshoot behavior were the problem, it would show up identically in both engines, since (per the cached architecture) both call the same `workFromCurve(yr, pts)` function. Instead, **this narrows the bug specifically to `wfData`'s monthly loop** — most likely how it converts each calendar month into whatever fractional position it feeds into the curve-sampling logic, or a difference in sampling cadence (e.g. evaluating the curve less often, or off a different reference point, than the annual engine does per year).

Leading hypothesis: `wfData`'s monthly loop passes a stale, incorrectly-offset, or coarser (e.g. whole-year instead of month-fractional) position into the curve sampler than `buildScenario` does — for instance, if it's still computing position as `Math.floor(mo/12)` (whole elapsed years only) rather than a true `mo/12` fraction, or applying a launch-month offset that the annual engine doesn't. Secondary possibility: `wfData` samples the curve correctly but then smooths/carries over the result across months in a way the annual rollup doesn't.

### What to do

1. Reproduce: set a Work Income Curve point to $0 at a specific quarter with nonzero value(s) before it, and confirm the exact month the Cash Flow table's Work column actually reaches (and *stays at*) $0, vs. the quarter that was set and vs. what the Simulator tab's own figure already shows.
2. In `App.jsx`, find exactly where `wfData`'s monthly loop computes work income (grep for `workFromCurve` or wherever `wkInc`/`workIncome` is set per month) and compare it directly against `buildScenario`'s per-year computation in `engine.js` — identify the specific difference in how each converts the current period into a position on the curve.
3. Propose a fix as a diff for Bob to review before writing — align `wfData`'s monthly sampling with the (already-correct) annual engine's logic, adjusted for month-level granularity.
4. Add a Playwright regression case: set a curve point to a specific value at a specific quarter, assert the Cash Flow table's Work column reaches that value starting in that exact month, matching the Simulator tab's own figure for the same period — not lagging behind it.

### Part B suggested commit shape

1. **Fix** — correct `wfData`'s monthly curve-sampling to match the annual engine's (already correct) logic. Single focused commit; Part A's "both engines must agree" caution doesn't apply in reverse here since the annual engine is the one that's already right.
2. **Regression test** — Playwright case covering the scenario above, checking Cash Flow table and Simulator tab figures agree for the same period.
