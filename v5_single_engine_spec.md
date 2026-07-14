# Retirement Sim v5.0.0 — Single-Engine Refactor: CONSOLIDATED SPEC

**Date:** 2026-07-10
**Goal:** Collapse the two-engine design (annual `buildScenario` + monthly `wfData`) into
ONE monthly engine as the single source of truth, with the annual/Simulator view rebuilt
as a pure aggregation of monthly output. Eliminates the entire class of annual-vs-monthly
divergence bugs structurally.
**Approach:** Direct cutover (no long-lived parallel engine), made safe by (a) full-
granularity output FIXTURES captured before any change, and (b) a phase-0 investigation
producing a known-exceptions list. Acceptance = "the charts don't move" except on pre-
approved exceptions.
**Prerequisite MET:** trusted baseline scenarios pinned. Directory backed up.

---

## CRITICAL: test-run discipline

The regression suite is large and slow. Do NOT run it after every edit. Run the full
suite ONLY at the explicit checkpoints marked below, and only when I confirm. Between
checkpoints, verify work by targeted means (the fixtures comparison, a single focused
test, or reasoning over diffs) — not full-suite runs. When in doubt, pause and ask before
kicking off the suite. This extends the project's standing "tests never run automatically"
rule — it matters more here because the refactor is large and the suite is expensive.

---

## PHASE 0 — investigation + baseline (NO production code changes)

Deliverables for my review before ANY refactor work:

**0a. Known-exceptions list.** Identify every place the two engines currently differ or
where one is treated as authoritative — especially spots where the annual engine samples
at year-granularity while the monthly engine is finer, or vice versa. When collapsed to
the single monthly engine, these resolve to the monthly answer, which may LEGITIMATELY
shift a charted number vs. today's annual chart. Produce a list: quantity, where it
diverges, expected direction/rough size of shift after cutover, and why. I approve this
list before proceeding — a shift on a listed quantity is EXPECTED, not a regression.

**0b. Baseline fixtures.** For each pinned baseline scenario, dump the FULL charted output
(not just headline numbers) to a committed fixtures file: every series the Simulator and
Cash Flow tabs plot — NW (book + liq), HI/LI debt balances, free cash flow, all monthly
waterfall columns — at every time point, plus headline milestones (work-free year, debt-
clear year, NW at yr10). This file is the regression baseline; the post-refactor engine
must reproduce it exactly except on the 0a exceptions.

**0c. Aggregation mapping.** For each annual/Simulator quantity, specify how it derives
from monthly output: stocks (NW, debt balances, cash) = the value at year-end (or the
agreed snapshot convention from v4.3.0); flows (income, tax, draws, paydown activity) =
sum over the year's months. Flag anything that isn't a clean stock-or-flow rollup.

**CHECKPOINT 0:** I review 0a/0b/0c. No full-suite run yet. I approve before Phase 1.

---

## PHASE 1 — the refactor

1. **Monthly engine = single source of truth.** `wfData` (monthly) becomes the sole
   calculation path for all financial logic: income, expenses, dispositions, taxes,
   debt paydown (HI + LI + mortgage), waterfall, net worth components.

2. **Annual/Simulator view = pure aggregation.** Replace `buildScenario`'s independent
   annual math with an aggregation layer that rolls monthly output up to annual per the
   0c mapping. The Simulator tab's charts read aggregated monthly output — NOT a separate
   calculation. `groupBy(year)` over monthly results.

3. **Delete the duplicated annual math.** Once aggregation reproduces the fixtures,
   remove `buildScenario`'s independent formulas. Do not leave dead parallel code — the
   whole point is one engine. (Retain only what's needed as the aggregation layer itself.)

4. **Preserve all v4 behavior:** property/unit/segment income with cost profiles; quarter-
   precise dispositions with verbatim (non-appreciated) sale price; §121/1031 tax;
   pooled proceeds routing (obligation → draw → waterfall); IO→P&I mortgage recast;
   mortgage-principal sweep bucket; debt tiering (per-loan closingEligible/sweepable,
   rate-ordered queue); birth-date-derived Medicare/FRA; per-spouse SS year+month;
   explicit start-date anchor. None of these change behavior — they now live in one engine.

**CHECKPOINT 1a (targeted):** Run ONLY the fixtures-comparison test — assert single-engine
output matches the Phase-0 fixtures value-by-value, except on the approved 0a exceptions.
Report every mismatch (quantity, year, delta). This is the primary correctness gate. Do
NOT run the full suite yet.

Iterate on mismatches until only approved-exception deltas remain.

**CHECKPOINT 1b (full suite):** ONLY after fixtures match — run the full regression suite
once, with my confirmation. Expect some existing tests to need updating where they
asserted annual-engine-specific intermediate values (those assertions may have encoded the
old divergence). Update them to the single-engine truth, not to silence failures — flag
each changed test and why.

---

## PHASE 2 — my verification (manual, before commit)

Before committing, I verify:
- Each baseline pin's NW and HI/LI-debt charts visually match my pre-refactor screenshots
  (except approved exceptions).
- Headline milestones (work-free, debt-clear, NW yr10) match the fixtures.
- Spot-check a fresh scenario behaves sensibly.

Only after I confirm: bump to v5.0.0, commit "v5.0.0 -- single monthly engine, annual view
as pure aggregation; two-engine divergence eliminated", journal entry documenting the
aggregation mapping, the approved exceptions list, and any tests updated.

---

## Acceptance criteria

- Single-engine output matches Phase-0 fixtures exactly, except on the pre-approved 0a
  exceptions list.
- No independent annual financial math remains — annual view is aggregation only.
- Baseline charts do not move (except approved exceptions), confirmed by fixtures test AND
  my visual check.
- Full suite green (with documented, justified test updates).

## Scope discipline

This is a STRUCTURAL refactor — behavior held constant. If a change would alter financial
behavior (not just where it's computed), STOP and flag it. "Make the engines agree" here
means "make the annual view derive from monthly," NOT "pick new numbers." Any genuinely
new behavior is out of scope for v5 and gets deferred.

## After v5

Richer debt logic and any other deferred sophistication can now be built ONCE on the single
engine. Schema is frozen as of v4.5.0 for the baseline; post-v5 changes resume normal
versioning.
