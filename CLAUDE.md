# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## What this is

A single-page React app: a personal retirement/property-portfolio financial simulator for one specific family (hardcoded people, properties, loans, pensions). It is not a generic tool — figures like health insurance costs, Social Security amounts, mortgage balances, and HI (family/hardship) debt are real numbers for this household, hardcoded as defaults. There is no backend; everything runs client-side and scenarios persist to `localStorage`.

## Session Start
At the start of each session, read the highest-numbered session journal file in the project root before doing any work.

## Commands

```bash
npm run dev       # Vite dev server (default port 5173, falls back to 5174/5175 if busy)
npm run build     # production build (dist/)
npm run lint      # eslint .
```

### Running tests

Tests are Playwright and require the Vite dev server running at **`http://localhost:5173`** specifically (hardcoded `BASE` constant at the top of the spec file) — start `npm run dev` first if it isn't already running, then:

```bash
npx playwright test retirement-simulator.spec.js --reporter=list
```

Run a single test or group by name (`-g` matches test/describe titles):

```bash
npx playwright test retirement-simulator.spec.js -g "R11"
npx playwright test retirement-simulator.spec.js -g "Group S"
```

Notes on the test setup:
- The Playwright config file is named `playwright_config.js`, **not** `playwright.config.js`, so Playwright's CLI does not auto-detect it — running `npx playwright test` without `--config` uses Playwright's own defaults (headless), not the `headed`/1400×900/JSON-reporter settings in that file. Pass `--config=playwright_config.js` explicitly if you want those settings.
- `run_tests.ps1` (Windows) and `run_tests.sh` (Git Bash) are convenience wrappers that also start/stop the Vite dev server and tee output to `test-results/test-run.txt`. Past sessions have found `run_tests.ps1`'s `Start-Transcript` capture unreliable for long headed runs (silently truncated output) — if that happens, fall back to invoking `npx playwright test` directly and read its own stdout.
- Tests drive the real UI (sliders, buttons, tabs) rather than mocking state, and also reach into engine internals directly via `window.__engine`, `window.__wfData`, and `window.__liveRows`, which `App.jsx` exposes specifically for Playwright's `page.evaluate()` (see the top of `App.jsx`).
- All 132 tests live in one file, `retirement-simulator.spec.js`, organized into lettered `test.describe` groups (Group A, B, C, ... in roughly chronological/feature order). Helper functions like `loadApp`, `clickTab`, `setSlider` are module-scoped (top of file) and shared everywhere; other helpers (`sellProperty`, `setRange`, `addSegment`) are scoped *inside* specific `describe` blocks and are not visible to tests in other groups — check the enclosing `describe` before assuming a helper is globally available.
- `setSlider`'s implementation locates a range input by proximity (`near`) to matching label text. This heuristic can silently grab the *wrong* slider when the target is far down a long scrollable sidebar (it has done so with no thrown error). For a slider that isn't the first/only one near its label, prefer walking the DOM structure explicitly (label `span` → parent row `div` → sibling `input[type="range"]`) instead of trusting `near`.

## Architecture

### Single calculation engine (v5.0.0+)

The app runs **one calculation engine** — `buildMonthlyScenario()` in `src/engine.js` — producing one row per month across the full simulation horizon (`wfData` in `App.jsx`, via `useMemo(()=>buildMonthlyScenario(liveParams),[liveParams])`). It handles income, expenses, dispositions, taxes, debt paydown (HI + LI + mortgage), the cash-flow waterfall, and net-worth components at true monthly resolution: exact sale-quarter cutoffs (`unitOwnedThisMonth`), the cash-flow waterfall tiers (fixed costs → maintenance → rainy day/op buffer → FCF floor → surplus sweep), HI-debt avalanche paydown, and the one-time pooled-proceeds routing described below.

The annual/Simulator view (`liveRows` in `App.jsx`) is a **pure aggregation** of that monthly output via `aggregateMonthlyToAnnual()` (`engine.js`): stock fields (HI debt, mortgage balances) take the year's first-month snapshot; flow fields (income, costs) sum the year's real months. There is no independent annual engine — before v5.0.0, a separate `buildScenario()` annual engine and the `wfData` monthly block were two independent implementations that had to be kept in sync by hand and periodically drifted (see the v4.3.0/v4.3.1/v4.4.0 fixes in the App.jsx changelog header for real examples of that drift). That two-engine design was retired in the v5.0.0 single-engine refactor; see the `v5.0.0` entry at the top of `App.jsx` and `v5_phase0_findings.md` for the full investigation, the modeling decisions it required, and the latent cross-engine bugs the collapse fixed.

Pins (`addPin`) run the **same** full monthly engine as the live scenario — `buildRowsFromSnapshot` (`App.jsx`) calls `buildMonthlyScenario`+`aggregateMonthlyToAnnual` exactly like live does, and a pin stores both the aggregated annual `rows` and the raw monthly `wfRows`. Before v5.0.0, pins ran an annual-only approximation of the live engine, a second possible source of live-vs-pin drift; that's gone now too.

`window.__engine`, `window.__wfData`, and `window.__liveRows` exist purely so Playwright tests can inspect/call into the engine directly — don't treat their presence as evidence of a "public API," they're test scaffolding. `wfData` is the raw monthly output and `liveRows` is its annual aggregation — both derive from the same engine call, not two separate engines, so there is no "cross-engine conservation check" to look for anymore. `window.__engine` also exposes `monthsInYear`/`monthsElapsedBeforeYear` (v4.3.0) for testing the start-date-anchor math directly, and `ssClaimAge`/`deriveAgeAnchors`/`healthMonthly` (v4.4.0) for testing the birth-date-anchor derivation directly; `wfData` rows carry a raw `calYear` field (not just the display-formatted `cal` string) so tests and chart code can bucket by real calendar year without re-deriving it from `mo`.

### Property-centric schema (v4)

Properties are the root organizing concept, not a flat list of fields. Each property (`properties[]`, defaults in `defaults.js`'s `freshPropertiesDefaults()`) has: a `value`/`mortgage` (with an interest-only period that recasts to amortizing after `ioYears`), a `hold` block (keep/sell mode, sale year+quarter, tax basis and disposition details), and one or more `units[]`. Each unit has `segments[]` — time-ranged rental configurations (`str`/`mtr`/`ltr` kind, with per-kind rate structures) that can overlap (income sums) except that `ltr` segments are mutually exclusive with everything else on the same unit/time range (see `validateUnitSegments`/`unitSegmentOverlaps`). Property tax/insurance figures live in `PROP_TAX_INS` inside `buildMonthlyScenario` (`engine.js`), keyed by property id — they are NOT derived from `value`.

`value` does double duty and the two uses must stay split (v4.2.5): **disposition sale price uses the entered property value verbatim; appreciation is never applied to sale price. Appreciation applies only to Net Worth of still-held properties.** In `engine.js`'s `computeDispositions()`, its inner `computeDispo()`'s `fmv` is `prop.value` with no `appreciationPct`/`Math.pow` factor; the separate `propValue` calc inside `buildMonthlyScenario`'s monthly loop (gated by `ownedMo()`, for properties still held) is the only place `appreciationPct` should compound `prop.value`. Both are commented in `engine.js` at the point of use — check both if you touch either.

### Pooled proceeds routing (one-time sale-year cash flow)

When a property sale + the "One-Time Obligation" (a fixed lump-sum outflow, e.g. a settlement) land in the same calendar year, their combined effect is computed via `splitResidual()`/`planHiPaydown()` (`engine.js`), applied chronologically at each event's own quarter-start month (not lumped into January — see the v5.0.2 fix in the App.jsx changelog header): **draw → HI-debt avalanche (full remainder, debt-first) → reserve/buffer top-ups → whatever's left joins the ordinary monthly sweep**. This debt-first-then-buffers order is deliberately scoped to *this one-time inflow only* — the ordinary recurring monthly waterfall (Fixed Costs → Maintenance → Rainy Day/Op Buffer → FCF Floor → Surplus sweep) stays buffers-before-debt. The one-time "draw" (`settleDraw`) is a display/reporting value only, tracked separately from the recurring "Free Cash Flow" (`disc`) field precisely so a one-time lump sum doesn't spike the ongoing monthly FCF chart.

### Model start-date anchor (v4.3.0, simplified by the v5.0.0 single-engine collapse)

The model's "now" is `BASE.startYear`/`BASE.startMonth` (`engine.js`), both editable on the Defaults tab's "Model Start Date" group (`DEFAULTS_REGISTRY` in `App.jsx`) — **never hardcode a "current" year/month anywhere in this codebase; read `BASE.startYear`/`BASE.startMonth` instead.** A stale hardcoded anchor (an implicit Jan-1 assumption in the pre-v5.0.0 annual engine, plus a hardcoded June-2026 `startDate` in the pre-v5.0.0 monthly block, plus a chart-bucketing formula that assumed month 0 was January) was the root cause of a real bug: the chart's first column showed a paid-down HI-debt balance instead of the exact entered setting.

**Invariant: no balance is paid down, no value appreciated/inflated, before the start date.** `buildMonthlyScenario`'s single monthly loop enforces this by construction — a value is *snapshotted* (read before any mutation for the current period) rather than *computed after the fact*:
- Its `startDate` is `new Date(BASE.startYear, BASE.startMonth-1)` — month 0 of the loop IS the start month exactly. There's no separate "annual yr=0 partial period" to special-case anymore: `aggregateMonthlyToAnnual` groups the resulting monthly rows by calendar year, so a partial first year naturally contains only the real months present, with no fabricated Jan-1 start.
- Balances are captured pre-decrement each month (`hiDebtNow` and similar) before that month's paydown/step logic runs, so a snapshot always reflects "as entered" for a period nothing has run yet.
- Growth/appreciation/inflation exponents use the loop's own continuous month index (`mo/12`, where `mo=0` is the start month) directly. Since there's one engine and one time basis now, there's no separate elapsed-time correction formula that two implementations need to keep in sync the way the pre-v5.0.0 dual-engine design did. (`monthsElapsedBeforeYear`/`monthsInYear` still exist and are still exported for Playwright's direct testing — `monthsElapsedBeforeYear` is also still used inside `buildMonthlyScenario` to compute the total horizon length in months, but no longer for per-row growth exponents.)
- Any calendar-year slider bound tied to "can this happen before now" (property sale year, loan start year, one-time obligation year, rental segment years) should be bounded by `BASE.startYear`/`BASE.startYear+20`, not a hardcoded `2026`/`2046`.

**Known exception — real external facts stay hardcoded, do not key them to `BASE.startYear`:** the SS earnings-test cap's reference tax year (`SS_CAP` in `App.jsx`) is a true calendar fact (a specific IRS tax year), independent of when the model happens to start. Only *sim-relative* values (work/lifestyle-draw curve offsets) should be `BASE.startYear`-relative. (The Medicare transition used to be filed under this same exception as a "fixed Nov-2026 date" — as of v4.4.0 it isn't a hardcoded fact at all anymore, see the Birth-date anchor section below.)

**Known follow-up, deliberately not fixed (see the newest session journal for the full before/after analysis):** the Nolan-loan grace-period gate (`mo>=5` inside `buildMonthlyScenario`, `engine.js`) is an elapsed-months-since-start check, and its real-world meaning shifts whenever `BASE.startMonth` changes — it needs an explicit absolute-calendar-date decision, not a threshold tweak. Before v5.0.0 this existed as two separate checks (one per engine) that had to independently agree; the single-engine collapse made that particular cross-engine-drift risk moot by construction, but the gate's calendar accuracy relative to Nolan's actual loan terms is still unverified.

### Birth-date anchor (v4.4.0, simplified by the v5.0.0 single-engine collapse)

`BASE.yourBirthYear`/`yourBirthMonth` (Bob) and `BASE.brendaBirthYear`/`brendaBirthMonth` (Brenda), both Defaults-tab-editable, are the **single source of truth for every age-triggered event** — Medicare (age 65), FRA (age 67), and each spouse's SS claiming date. **Never hand-derive an age-based year/month from scratch; derive it from birth date instead**, following the pattern below, so a new trigger can't silently drift from the same real fact two other triggers already use.

- `engine.js`'s `deriveAgeAnchors(base)` computes `medicareYouYear`/`Month`, `brendaMedYear`/`Month`, `brendaFraYear`/`Month` (birthYear+65 or +67, same birth month) onto the `BASE` object. It runs once at module load and again at the end of `applyDefaultsOverrides()` — **after** overrides apply — so a stale saved override of one of the *derived* fields (e.g. a pre-v4.4.0 `brendaFraYear` in a saved defaults blob) is overwritten right back to the birth-date-derived value. These three derived fields are computed, not independently editable — they were removed from `DEFAULTS_REGISTRY`; only the four birth-date fields are exposed there.
- `healthMonthly()` (`engine.js`) gates Bob's Ericsson→Medicare switch and Brenda's Ericsson→Medicare switch off `medicareYouYear/Month` and `brendaMedYear/Month` respectively, compared as an absolute calendar month (`calYear*12+calMonth`) — month-precision, not year-only. Bob's transition derives to **Oct 2026** (his real Oct-18-1961 birthday) — this *corrected* a stale Nov-2026 hardcode that predated birth-date tracking; it was a real calibration fix, not just a refactor (see session29 journal).
- SS is **calendar-pegged like Medicare**, not year-index-relative: each spouse has independent `ssStartYear`/`ssStartMonth` (`ssBrendaStartYear`/`ssBrendaStartMonth` for Brenda) compared the same absolute-month way. `ssClaimAge(startYear, startMonth, birthYear, birthMonth)` (`engine.js`) is the one shared definition of "claiming age" — used by Bob's SS $-amount formula (continuous Early→FRA interpolation, generalized from the old stepped 65/66/67 toggle) and by the Simulator sidebar's derived age read-out. Brenda's SS dollar amount stays flat (`BASE.brendaSsFRA`) regardless of her claim date — no early/delayed formula exists for her (a deliberate scope decision, not an oversight; revisit only with new real numbers for her early-claim amount).
- Because `buildMonthlyScenario` computes at true monthly resolution, a spouse's SS claim starting mid-year needs no special handling: `yourSsMo`/`brendaSsMo` are gated on/off per real calendar month directly (compared as an absolute month, `calYear*12+calMonth >= claimStartYear*12+claimStartMonth`), and the annual view just averages the monthly values (`avgMo('yourSs')`/`avgMo('brendaSs')` in `aggregateMonthlyToAnnual`). Before v5.0.0, the old annual-only engine couldn't gate SS per-row the same way and instead built **period dollar totals** summed month-by-month then divided back down to a displayed `$/mo` rate — that workaround is gone. If you add a new age-triggered $ field, just gate it per-month in `buildMonthlyScenario` the same way `yourSsMo` does, and read the averaged value back out in `aggregateMonthlyToAnnual` — don't reintroduce the old period-total-then-divide pattern, it's no longer needed now that there's true monthly resolution everywhere.

### Scenario pinning / comparison

The whole UI reflects one "live" scenario (current slider state). Users can "pin" a snapshot (`addPin`) which freezes a full param snapshot plus the full monthly engine output (`wfRows`), the aggregated annual rows (`rows`), and stats — pins run the exact same engine live does (see "Single calculation engine" above), not an annual-only approximation. Pinned scenarios render as additional dashed lines on every chart, get their own legend entries, and get a user-assignable color (`pin.color`, defaulting from the `PIN_COLORS` palette in `defaults.js`) that drives that line's color consistently everywhere (chart lines, legends, the pin card, the comparison table). Pins persist to `localStorage` (`SAVE_SCHEMA_VERSION` gates compatibility — schema breaks bump this with no migration path).

### File map

- `src/engine.js` — pure calculation functions + constants (`BASE` household facts, `DISPO_DEFAULTS` tax rates). No React, no UI. `buildMonthlyScenario()` is the single engine entry point (one row per month); `aggregateMonthlyToAnnual()` derives the annual/Simulator view from its output — see "Single calculation engine" above.
- `src/defaults.js` — default/initial state shapes: `freshPropertiesDefaults()`, `freshObligationDefaults()`, `DEFAULTS`/`SC_DEFAULTS` (engine-facing vs. UI-facing param shapes — note some fields are stored as %s in `SC_DEFAULTS` and decimals in `DEFAULTS`, see `makeParams()` for the conversion; newer nested data like `properties[].mortgage.rate` is decimal in both, no conversion step).
- `src/App.jsx` — everything else: all UI (single component, five tabs — Simulator, Cash Flow, Defaults, Input/Output Map, Glossary), chart rendering (shared `Chart` component used by the five comparison charts), pin/scenario management. Calls `engine.js`'s `buildMonthlyScenario`/`aggregateMonthlyToAnnual` via `useMemo` (`wfData`/`liveRows`) rather than implementing its own engine. This file is large (~240KB); use `grep`/targeted reads rather than reading it end-to-end.
- `src/relationships-data.js` — static data (no logic) for the "Input / Output Map" tab's dependency diagram.
- `retirement-simulator.spec.js` — the entire Playwright test suite.
- `session*_journal.txt` — chronological, human-written-style dev logs, one per work session, documenting what shipped, decisions negotiated with the user, and open backlog. Check the most recent one for current project state/context before starting new work; this is the project's primary "what's going on and why" record, since there's no issue tracker.
- `v4_property_centric_spec.md`, `v3_phase1_consolidated_spec.md` — point-in-time design specs for major schema migrations. Historical/reference, not necessarily current — cross-check against actual code and the latest session journal.

## Conventions specific to this project

- **Version bump every change**: the app has an on-screen version badge and a matching header comment at the top of `App.jsx` (`// vX.Y.Z -- ...`); bump both together with any shipped change, and keep the two in sync with the corresponding Playwright version-string assertions (search the spec file for the current version string before renaming it).
- **No backward-compat shims across schema versions**: `SAVE_SCHEMA_VERSION` bumps are treated as clean breaks (old localStorage saves are simply discarded, not migrated) — don't add migration logic unless explicitly asked.
- Money amounts in state/props are generally raw dollars (not cents); some UI sliders display in $K or % while storing raw dollars or decimals underneath — check the specific `slider(...)` call's `fmt` callback rather than assuming a convention.

## Bash command style (avoid permission-prompt triggers)

- No `cd <path> &&` chaining; run commands from the project root directly.
- No brace expansion `{a,b}` in commands; write arguments out explicitly.
- Prefer simple, single-purpose commands over compound one-liners.
- Prefer the native file-edit tool over sed for file modifications.

## Workflow policies

- Never run the test suite automatically after changes; pause and summarize
  the diff for manual review first. Run tests only when explicitly asked.
- `git push` only with explicit permission from the user — it's the
  end-of-session checkpoint.

