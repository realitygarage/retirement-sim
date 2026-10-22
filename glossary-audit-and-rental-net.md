# Glossary coverage audit + "Rental Net" definition

**Captured:** post-v5.11.0, after the Annual Income chart shipped.

## What prompted this

The new Annual Income chart's breakdown includes a "Rental Net" series, and Bob asked where that net figure is actually defined/calculated. Separately, he'd like the Glossary tab — which already covers debt/cash-flow concepts (Rainy Day Fund, Operating Buffer, HI Debt Sweep, Avalanche Method, IO vs P&I Mortgage, DI Cap, Net Worth, Work Earned vs Work Required) — expanded to cover any other chart/table terms that aren't self-explanatory.

## "Rental Net" — needs confirming from the live source

This project doesn't have current visibility into the exact `App.jsx`/`engine.js` the Annual Income chart was built from (cached copies here predate it) — Claude Code is in the best position to answer this precisely, since it just wrote the chart. Two plausible definitions, based on what already existed in the app before this chart, for Claude Code to check against:

1. **Net of rental operating costs** — gross rental revenue minus the STR platform fee %, cleaning fee %, and/or property-management fee % that the Cash Flow tab's Fixed Costs breakdown already tracks separately ("Rental op costs"). Mortgage interest/principal would stay a separate line elsewhere (Fixed Costs' "Mortgages"), to avoid double-counting between the two charts.
2. **Net of mortgage interest** — there's a pre-existing `rentalNet = grossRental - mortgageInterest` used internally by the tax estimator's provisional-income calculation; possible the Annual Income chart reused that same net figure under the same name, which would be a different (and arguably less intuitive, for an income breakdown) definition than #1.

Ask Claude Code to confirm, in one sentence, exactly what "Rental Net" nets out in the live code — that settles it precisely instead of guessing further here.

## Glossary audit — ask Claude Code to:

1. Confirm the "Rental Net" definition (above) and add it to the Glossary tab.
2. Scan the app for any other chart/table labels, legend keys, or column headers that aren't already defined in the Glossary tab, and add entries for the real gaps — following the existing format (term / short one-line / longer detail / a tag like "Your Decision", "Computed", "Method", "Model Logic", "Key Distinction" with its color).
3. Report back the full list of what it added, and anything it considered but decided was already self-explanatory and skipped — so Bob can review the additions rather than trusting the audit blindly.

## Suggested commit shape

One commit covering the "Rental Net" definition plus whatever else the audit turns up — it's all the same kind of change (documentation-only, no behavior risk), so no need to split it further.