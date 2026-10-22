# Feature request: Annual (non-cumulative) Income chart — Simulator tab

**Captured:** 2026-10-22+, from Bob, after the Part A/B fixes in `claude/claude-code-handoff-2026-10-22.md` landed (v5.11.0).

**Updated post-session-43:** corrected below to reflect the confirmed single-engine architecture (`buildMonthlyScenario` in engine.js, since v5.0.0) rather than the old two-engine split this doc originally assumed — see `v5_architecture_note.md`'s status note for why that assumption was wrong.

## The ask

The Simulator tab has a cumulative income view already, but nothing showing income **by year** (non-cumulative) — Bob wants to see annual income over time as its own chart, in addition to the existing cumulative one.

## Recommendation: reuse the existing annual-aggregation + breakdown-chart mechanism, don't build a new chart type

Since v5.0.0 there is one engine (`buildMonthlyScenario`), producing monthly rows, with every income component you'd want already present per month: pension, work income, your SS, Brenda's SS, rental, draws. The Simulator tab's existing annual charts (NW, HI debt, Fixed Costs, and presumably the existing cumulative income chart) must already roll these monthly rows up to annual figures somehow — reuse that exact same aggregation step for the new chart's data, and reuse whatever shared chart-breakdown component those other charts already use (a `BREAKDOWNS`-style object with a stacked-series + bold-total-line convention, per the architecture as of the last time this project had direct visibility into App.jsx — confirm the current shape before implementing, since the UI has evolved past what's cached here).

Suggested new breakdown entry (adapt key names to whatever the live aggregation actually calls them):

```js
income: {
  label: "Annual Income — by source",
  series: [
    {key:"pension",  label:"Pension",       color:"..."},
    {key:"workInc",  label:"Work income",   color:"..."},
    {key:"yourSs",   label:"Your SS",       color:"..."},
    {key:"brendaSs", label:"Brenda SS",     color:"..."},
    {key:"rental",   label:"Rental",        color:"..."},
    {key:"drawInc",  label:"Draws",         color:"...", hideZero:true},
    {key:"totalInc", label:"Total income",  color:"...", bold:true},
  ],
  note:"Annual income by source, non-cumulative — pairs with the cumulative income view above/below.",
},
```

Since it's one engine now, there's no risk of this new chart disagreeing with the Cash Flow tab or drifting out of sync the way the old two-engine architecture could — whatever it displays is definitionally consistent with everything else on both tabs, because it all comes from the same `buildMonthlyScenario` output.

One thing to carry over from session 43's Work Income Curve fix: that fix corrected how a *user-entered* calendar point (year/quarter) converts into the engine's month-zero-anchored position (`BASE.startYear`/`startMonth`, not Jan 1). This new chart is read-only/presentational — it's just displaying already-computed per-year sums — so it shouldn't need any of that conversion logic itself, but worth a sanity check that whatever "year" label this chart puts on the x-axis uses the same calendar-year bucketing as the other annual charts (e.g. grouped by `calYear` from the monthly rows), not a re-derivation that could reintroduce a similar epoch mismatch.

**Placement:** put it directly adjacent to (immediately above or below) wherever the existing cumulative income chart lives on the Simulator tab, rather than at the bottom of the tab or grouped with the debt/cost charts. The two are a natural pair — "here's the shape, here's the running total" — and reading them side by side is more useful than reading them from different parts of the page. If the cumulative chart is itself one of the breakdown-selector entries (e.g. a `cumInc` key), consider listing `income` immediately next to it in the selector order so they're one click apart.

**Content default:** stacked breakdown by source (as sketched above) with a bold total line, matching the visual language of the other breakdown charts, rather than a single undifferentiated income line — more informative for roughly the same effort. If Bob would rather start with just the total line and add the source breakdown later, that's a smaller first cut of the same feature.

## What to do

1. Confirm the current shape of the annual-aggregation layer and breakdown-chart mechanism in the live `App.jsx`/`engine.js`, and the exact location of the existing cumulative income chart.
2. Propose a diff adding the `income` breakdown entry per above, placed next to the cumulative chart, for Bob to review before writing.
3. No new engine math needed beyond whatever aggregation already produces the other annual charts — this reuses it.