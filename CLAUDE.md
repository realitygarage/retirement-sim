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
- All ~75 tests live in one file, `retirement-simulator.spec.js`, organized into lettered `test.describe` groups (Group A, B, C, ... in roughly chronological/feature order). Helper functions like `loadApp`, `clickTab`, `setSlider` are module-scoped (top of file) and shared everywhere; other helpers (`sellProperty`, `setRange`, `addSegment`) are scoped *inside* specific `describe` blocks and are not visible to tests in other groups — check the enclosing `describe` before assuming a helper is globally available.
- `setSlider`'s implementation locates a range input by proximity (`near`) to matching label text. This heuristic can silently grab the *wrong* slider when the target is far down a long scrollable sidebar (it has done so with no thrown error). For a slider that isn't the first/only one near its label, prefer walking the DOM structure explicitly (label `span` → parent row `div` → sibling `input[type="range"]`) instead of trusting `near`.

## Architecture

### Two parallel calculation engines that must never disagree

The app runs **two independent simulation engines** over the same inputs, and a lot of the design (and test suite) exists to keep them in sync:

1. **Annual engine** — `buildScenario()` in `src/engine.js`. Produces one row per calendar year (`liveRows` in `App.jsx`). This is the "big picture" engine: net worth, work-income-required, disposition/tax math for property sales, capital gains, §1031 exchanges, §121 exclusions, depreciation recapture.
2. **Monthly waterfall engine** — the `wfData` `useMemo` block inside `App.jsx` (not in `engine.js`). Produces one row per month across the full 252-month horizon. This is the authoritative engine for anything that needs true monthly resolution: exact sale-quarter cutoffs (`unitOwnedThisMonth`), the cash-flow waterfall tiers (fixed costs → maintenance reserves → rainy day/op buffer → FCF floor → surplus sweep), HI-debt avalanche paydown, and the one-time pooled-proceeds routing described below.

Both engines call into shared pure functions in `engine.js` (`unitSegmentGross/Net`, `estimateTax`, `disposeAsset`, `planHiPaydown`, `splitResidual`, mortgage state helpers, etc.) specifically so the two cannot drift apart on shared math. When changing anything that affects both (rental income, mortgage payments, tax estimates, property ownership timing), check both `buildScenario` and the `wfData` block, and look for a dev-mode `console.warn` "conservation" check in `App.jsx` that cross-validates the two engines' outputs against each other at runtime.

`window.__engine`, `window.__wfData`, and `window.__liveRows` exist purely so Playwright tests can inspect/call into both engines directly — don't treat their presence as evidence of a "public API," they're test scaffolding. `window.__engine` also exposes `monthsInYear`/`monthsElapsedBeforeYear` (v4.3.0) for testing the start-date-anchor math directly; `wfData` rows carry a raw `calYear` field (not just the display-formatted `cal` string) so tests and chart code can bucket by real calendar year without re-deriving it from `mo`.

### Property-centric schema (v4)

Properties are the root organizing concept, not a flat list of fields. Each property (`properties[]`, defaults in `defaults.js`'s `freshPropertiesDefaults()`) has: a `value`/`mortgage` (with an interest-only period that recasts to amortizing after `ioYears`), a `hold` block (keep/sell mode, sale year+quarter, tax basis and disposition details), and one or more `units[]`. Each unit has `segments[]` — time-ranged rental configurations (`str`/`mtr`/`ltr` kind, with per-kind rate structures) that can overlap (income sums) except that `ltr` segments are mutually exclusive with everything else on the same unit/time range (see `validateUnitSegments`/`unitSegmentOverlaps`). Property tax/insurance figures live in `PROP_TAX_INS` inside the `wfData` block (parallel constant in the annual engine), keyed by property id — they are NOT derived from `value`.

`value` does double duty and the two uses must stay split (v4.2.5): **disposition sale price uses the entered property value verbatim; appreciation is never applied to sale price. Appreciation applies only to Net Worth of still-held properties.** In `buildScenario`, `computeDispo()`'s `fmv` is `prop.value` with no `appreciationPct`/`Math.pow` factor; the separate `valById` calc a bit further down (for properties still in `keepMap`) is the only place `appreciationPct` should compound `prop.value`. Both are commented in `engine.js` at the point of use — check both if you touch either.

### Pooled proceeds routing (one-time sale-year cash flow)

When a property sale + the "One-Time Obligation" (a fixed lump-sum outflow, e.g. a settlement) land in the same calendar year, their combined effect is computed once via `splitResidual()`/`planHiPaydown()` (`engine.js`) and applied at the start of that pool year: **draw → HI-debt avalanche (full remainder, debt-first) → reserve/buffer top-ups → whatever's left joins the ordinary monthly sweep**. This debt-first-then-buffers order is deliberately scoped to *this one-time inflow only* — the ordinary recurring monthly waterfall (Fixed Costs → Maintenance Reserves → Rainy Day/Op Buffer → FCF Floor → Surplus sweep) stays buffers-before-debt. The one-time "draw" (`settleDraw`) is a display/reporting value only, tracked separately from the recurring "Free Cash Flow" (`disc`) field precisely so a one-time lump sum doesn't spike the ongoing monthly FCF chart.

### Model start-date anchor (v4.3.0)

The model's "now" is `BASE.startYear`/`BASE.startMonth` (`engine.js`), both editable on the Defaults tab's "Model Start Date" group (`DEFAULTS_REGISTRY` in `App.jsx`) — **never hardcode a "current" year/month anywhere in this codebase; read `BASE.startYear`/`BASE.startMonth` instead.** A stale hardcoded anchor (an implicit Jan-1 assumption in `buildScenario`, plus a hardcoded June-2026 `startDate` in `wfData`, plus a chart-bucketing formula that assumed `wfData`'s month 0 was January) was the root cause of a real bug: the chart's first column showed a paid-down HI-debt balance instead of the exact entered setting.

**Invariant: no balance is paid down, no value appreciated/inflated, before the start date.** Both engines enforce this the same way — a value is *snapshotted* (read before any mutation for the current period) rather than *computed after the fact*:
- `buildScenario`'s annual loop: `yr=0` is a genuine **partial period** (only the months from `startMonth` through December — see `monthsInYear`/`monthsElapsedBeforeYear`, exported from `engine.js`), not a fabricated full year. Stock fields (HI debt, mortgage balances) for row `yr` are captured *before* that iteration's monthly step loop runs; flow fields (income, costs) are that period's real total, scaled by the actual month count, not always 12.
- `wfData`'s monthly loop already captured balances pre-decrement each month (`hiDebtNow`) — it only needed its `startDate` wired to `BASE.startYear/startMonth` instead of a hardcoded June 2026.
- Growth/appreciation/inflation exponents use **continuous elapsed real time since the start date** (`monthsElapsedBeforeYear(yr,startMonth)/12`, fractional for the partial first period), not the plain integer `yr` — this collapses to the old exact behavior when `startMonth===1`, and is what stops a mid-year start from front-loading a full year of growth at the first Jan-1 boundary.
- Any calendar-year slider bound tied to "can this happen before now" (property sale year, loan start year, one-time obligation year, rental segment years) should be bounded by `BASE.startYear`/`BASE.startYear+20`, not a hardcoded `2026`/`2046`.

**Known exception — real external facts stay hardcoded, do not key them to `BASE.startYear`:** the Medicare transition (a fixed Nov-2026 date, `healthMonthly` in `engine.js`) and the SS earnings-test cap's reference tax year (`SS_CAP` in `App.jsx`) are true calendar facts, independent of when the model happens to start. Only *sim-relative* values (ages, SS-start-year, work/lifestyle-draw curve offsets) should be `BASE.startYear`-relative.

**Known follow-up, deliberately not fixed (see the newest session journal for the full before/after analysis):** the Nolan-loan grace-period gate (`absMo<5` in `engine.js`, `mo>=5` in `App.jsx`) is elapsed-months-since-start, and its real-world meaning shifts whenever `BASE.startMonth` changes — it needs an explicit absolute-calendar-date decision, not a threshold tweak. Both engines now share the *same* elapsed-time basis, so this gate no longer disagrees between the two engines the way it silently did before v4.3.0 — but its calendar accuracy relative to Nolan's actual loan terms is still unverified.

### Scenario pinning / comparison

The whole UI reflects one "live" scenario (current slider state). Users can "pin" a snapshot (`addPin`) which freezes a full param snapshot + precomputed annual rows + stats; pinned scenarios render as additional dashed lines on every chart, get their own legend entries, and get a user-assignable color (`pin.color`, defaulting from the `PIN_COLORS` palette in `defaults.js`) that drives that line's color consistently everywhere (chart lines, legends, the pin card, the comparison table). Pins persist to `localStorage` (`SAVE_SCHEMA_VERSION` gates compatibility — schema breaks bump this with no migration path).

### File map

- `src/engine.js` — pure calculation functions + constants (`BASE` household facts, `DISPO_DEFAULTS` tax rates). No React, no UI. `buildScenario()` is the annual engine entry point.
- `src/defaults.js` — default/initial state shapes: `freshPropertiesDefaults()`, `freshObligationDefaults()`, `DEFAULTS`/`SC_DEFAULTS` (engine-facing vs. UI-facing param shapes — note some fields are stored as %s in `SC_DEFAULTS` and decimals in `DEFAULTS`, see `makeParams()` for the conversion; newer nested data like `properties[].mortgage.rate` is decimal in both, no conversion step).
- `src/App.jsx` — everything else: all UI (single component, five tabs — Simulator, Cash Flow, Defaults, Input/Output Map, Glossary), the monthly waterfall engine, chart rendering (shared `Chart` component used by the five comparison charts), pin/scenario management. This file is large (~240KB); use `grep`/targeted reads rather than reading it end-to-end.
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

