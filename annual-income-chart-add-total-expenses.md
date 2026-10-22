# Follow-up: add Total Annual Expenses to the Annual Income chart

**Captured:** post-v5.12.x, follow-up to the Annual Income chart shipped in `claude/annual-income-chart-feature.md`.

## The ask

Bob wants total annual expenses/costs added to the same Annual Income chart — so income (by source, stacked) and total costs are both visible per year, giving an at-a-glance read on annual surplus/deficit, not just the income side.

## Recommendation: overlay a "Total Expenses" line on the existing chart, reuse the figure that already drives "surplus" elsewhere

Don't build a new chart for this — add one more series to the Annual Income chart that just shipped. The app already computes a per-year total-cost figure somewhere (it's what "surplus" = income − costs is built from, which already feeds existing stats/charts like Work-Required and the NW projection) — reuse that exact annual total, don't recompute it. Render it as a second bold line drawn over the stacked income bars (not stacked into them), so the visual gap between the top of the income stack and the expenses line directly reads as that year's surplus or shortfall — which is the "clear picture" being asked for.

Suggested addition to the chart's series list (adapt the key to whatever the live aggregation calls annual total cost — likely something like `totalOut` based on the pre-chart architecture):

```js
{key:"totalOut", label:"Total expenses", color:"...", line:true, bold:true}
```

(however the existing chart component distinguishes an overlaid line from a stacked bar segment — follow its existing convention, e.g. however the Net Worth breakdown chart already draws its bold "Total NW" line over stacked bars, if that's the same mechanism).

## Scope check — two versions, pick the smaller one unless Bob wants more

- **Smaller (what's asked for):** just the one total-expenses number per year, as a single overlaid line. Minimal effort, reuses an existing figure, answers the literal ask.
- **Larger (not asked for, but a natural next step if wanted later):** a full annual cost *breakdown* by category (mortgage, health insurance, core living, HI debt minimums, family loan, rental op costs, property tax/insurance, maintenance, income tax) trended by year, mirroring the Annual Income chart's own by-source structure — effectively an annual version of the Cash Flow tab's existing Fixed Costs breakdown, which currently only shows a single month's snapshot ("launch month"), not a multi-year trend. Flag this as an option rather than building it now; wait for Bob to ask if the simple total-line version doesn't give him enough.

## What to do

1. Confirm what the live aggregation already calls the per-year total-expense figure (the one "surplus" is derived from) and reuse it directly — no new engine math.
2. Add it to the Annual Income chart as an overlaid total line, following whatever convention the chart component already uses for a bold total series.
3. Show a diff before writing, per usual.

## Suggested commit shape

One commit — this is additive to a chart that already exists, not a new feature.