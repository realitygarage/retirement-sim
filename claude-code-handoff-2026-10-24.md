# Claude Code Handoff — 2026-10-24

Three changes, done **in order: Part B → Part A → Part C**, one commit each. Starting point: v5.13.0 (session 44).

## Standing workflow (applies to every part)

- **Check the live code before trusting this doc.** It was written in claude.ai against older project snapshots. Field and function names below (`wfData`, `tier1`, `fc_*`, `buildChartRows`, `aggregateMonthlyToPeriod`, `BREAKDOWNS.income`, `slider()`, etc.) come from the session 43/44 journals. Where the code differs, flag it to Bob before working around it.
- **Plan → show diff → wait for Bob's OK → write.** No edits before he reviews.
- **Tests:** never run automatically. When Bob asks, run the targeted groups named below; full suite only on request.
- **Version bump per part:** App.jsx header changelog + on-screen badge + the E5/L1 version-string assertions.
- **Stop after each part** so Bob can review, commit and push. Don't start the next part until he says go.
- **Session journal is mandatory** before closing (session45_journal.txt), covering all parts done.

---

## PART B — Escrow / title / recording costs on property sales (v5.14.0)

### Goal
Today a sale's selling cost is a single percentage ("Cost of sale"). Add a separate **flat-dollar closing-cost line** for escrow, title insurance, recording fees, etc.

### Spec
1. **Keep the existing % field** and relabel it **"Commission & concessions (%)"**. Same default and range.
2. **Add "Escrow / title / recording ($)"**, default **$5,000**, editable. Put it next to the % field in every sale-details panel. In the Part B UI it can be a slider for now, range $0–$25,000, step $500 (Part C converts all sliders to typed fields anyway).
3. **Per property:** apply to every property that can have a sale modeled. If sale settings live on `properties[]`, add it there as e.g. `closingCostFlat`; otherwise follow whatever pattern the existing % uses. Default $5,000 for each.
4. **Everywhere the % selling cost is used, also subtract the flat amount.** Audit for all of these:
   - net sale proceeds (and anything downstream: mortgage payoff, HI payoff, invested cash, `sixthNetProceeds` or its v5 equivalent);
   - **capital-gains calculation:** seller-paid closing costs reduce the amount realized, so the gain = sale price − (% cost) − flat cost − basis;
   - **liquidation net worth** (book NW is unchanged);
   - the **sale-timing analysis** (early-sale vs. wait comparison), if it computes its own proceeds;
   - sale-details summary rows: add a "Escrow / title / recording" row (red, negative) under the commission row.
5. **Defaults tab:** add the new field to the universal audit view, consistent with how other per-property sale fields appear.
6. **Glossary:** update the selling-cost / sale-proceeds entry (and the NW "Book vs Liquidation" card if it quotes the selling-cost math) to mention the flat closing-cost line.

### Watch for
- If any code path hardcodes `sellingCosts: 0.05` (BASE) separately from the UI %, flag it. Don't silently pick one.
- Make sure the flat cost is applied **once per sale event**, not per month or per period.

### Tests
- New test group (next free letter, e.g. **AC**):
  - AC1: with the flat cost at $5,000 vs. $0, net proceeds differ by exactly $5,000 and taxable gain (when above the exclusion) differs by exactly $5,000.
  - AC2: the sale-details panel shows the new row and relabeled commission field.
- Run: AC + E5/L1 + any existing sale/proceeds/cap-gains group that touches these numbers.

**→ STOP. Bob reviews, commits, pushes.**

---

## PART A — Annual Income vs Expenses chart: show PERSONAL income and expenses (v5.15.0)

### Problem
The "Annual Income vs Expenses / yr" chart currently counts rental income net of **operating costs only** (platform/cleaning/mgr %/vacancy via `unitSegmentNet`). The rentals' **mortgage, property tax, insurance and maintenance reserve** sit on the expense side as part of `tier1`. So both lines are inflated by the rental business's carrying costs, and neither is really "our personal income" or "our personal spending."

### Key invariant
Moving rental carrying costs out of expenses and into a **rental profit** income line moves the same dollars off both sides. **Surplus / (shortfall) must not change** for any year, live or pinned. Use this as the main test.

### New concept: per-property personal-use share
- Add a per-property field **`personalUseShare`** (0–100%) = the share of that property's carrying costs that is personal housing. The rest is rental business.
- **Defaults:**
  - **15th St duplex: 60%** (Bob and Brenda are moving into the 3-BR bottom unit; the 2-BR top is rented). Must be editable: they may later swap units.
  - **Lafayette: 0%** (pure rental).
  - **6th St:** see rule below. No static default needed unless the code structure wants one (then 0%).
- UI: editable on the property's card (Simulator tab or wherever per-property settings live) + shown in the Defaults tab audit view. Label: **"Personal-use share"**, with hint text "share of mortgage, tax, insurance & maintenance that is your own housing; the rest is rental business."
- Don't try to auto-derive it from which unit has rental segments. Keep it a plain manual input. (If the duplex's unit/segment config looks inconsistent with 60%, e.g. the bottom unit still carries LTR rent segments, **mention it to Bob**, but don't change scenario data.)

### 6th St rule
- While 6th St is generating rent (MTR enabled, before sale) → treat as a rental: its carrying costs go to the rental business (personal share 0%).
- While it is owned but **not** rented (held for sale/vacant) → its carrying costs are **personal**, shown as their own expense line **"6th St carrying cost"** (hideZero).
- After sale → nothing.
- If v5's monthly engine already knows per-month whether 6th St is booked, decide per month; if not, per the `sixthMTR` flag. Tell Bob which you used.

### New definitions (this chart only)
**Personal income** (per period, annualized ×12 as today):
- Pension, Work income, Your SS, Brenda SS: unchanged
- **Rental profit** = gross rent − rental op costs − Σ over properties of `(1 − personalUseShare)` × (mortgage payment + property tax + insurance + maintenance reserve)
  - Replaces the current "Rental (net)" row. **Can be negative**; show as negative income (formatter already renders "-$X"), not moved to expenses.
- Total income = sum of the above (one-time `settleDraw` still excluded, as today).

**Personal expenses:**
- Health, Core living, Income tax, LI loan payments, HI minimums, IRMAA: unchanged
- **Housing (personal share)** = Σ over properties of `personalUseShare` × (mortgage + tax + insurance + maintenance), one row or split Mortgage/Tax & ins/Maintenance, whichever matches the existing row style best; propose to Bob
- **6th St carrying cost** (when applicable, per rule above)
- Total expenses = sum of the above

Mortgage = the full cash payment (IO or P&I, principal included). This is a cash view, not AGI. HOA: if the model carries HOA per property, treat it like tax/insurance.

### Breakdown table
Add a **"Rental business"** sub-block in the Annual Income breakdown so the rental P&L is visible:

```
Gross rent
 − Operating costs           (cost)
 − Mortgages (rental share)  (cost)
 − Tax & insurance (rental share) (cost)
 − Maintenance (rental share)    (cost)
 = Rental profit             (bold)
```
Then the income rows (with Rental profit), the expense rows as redefined above, Total expenses (bold), Surplus/(shortfall) (bold). Update the breakdown note line to say: "Personal view — rental carrying costs are netted into Rental profit; surplus matches the waterfall."

### Engine / data needs
- `buildChartRows` currently buckets `fc_mtg`, `fc_propCost`, `maintRes` as totals. This needs them **per property** (or at least rental-share vs. personal-share splits). Check whether the monthly engine already has per-property mortgage/tax/ins/maint values before aggregating. If it doesn't, add per-property fields to the monthly rows (additive, no behavior change) and report what you added.
- **Pins:** per-pin income and expense lines must use the same personal definitions from each pin's own period rows (the existing `pin_<id>_inc` / `pin_<id>_exp` rule). That likely means `aggregateMonthlyToPeriod` emits the per-pin personal income/expense totals (or the per-property pieces), same pattern as the `tier1` addition in v5.12.3.
- **Do not change** `tier1`, `totalInc`, `totalOut`, the waterfall, the FCF chart, Fixed Costs chart, or the Cumulative chart. This is a reclassification for this one chart's display.

### Retitle / labels
- Chart title: **"Personal Income vs Expenses / yr"**
- Lines: "Personal income" (bold), "Personal expenses" (dashed red), per-pin dotted versions as today.

### Glossary
- Update/replace the "Rental Gross vs Net" card to cover three levels: **gross → net of op costs → rental profit**, and explain personal-use share.
- Add a short "Personal-use share" entry (or fold it into the above).
- Note in the chart-related card that this chart's expenses won't match the Fixed Costs chart's total or the Cumulative chart (different scope by design).

### Tests
- Update AA2/AA3 for the new title/rows/definitions.
- New group (e.g. **AD**):
  - AD1 (**invariant**): for every year, Surplus/(shortfall) on this chart equals the pre-change value (income − tier1) within rounding, live and for at least one pin.
  - AD2: with duplex `personalUseShare` 60% → 100%, Rental profit rises and personal Housing rises by the same amount; surplus unchanged.
  - AD3: Rental-business sub-block rows sum to Rental profit within rounding; income sources sum to Total income; expense rows sum to Total expenses.
  - AD4 (if feasible): a 6th St held-for-sale (not rented) year shows a non-zero "6th St carrying cost" row.
- Run: AA + AD + E5/L1 + any Defaults-tab tests touched.

**→ STOP. Bob reviews, commits, pushes.**

---

## PART C — Replace sliders with typed number fields (v5.16.0)

### Goal
Every numeric control that is currently a slider becomes a **typed number field**. Sliders go away. Getting to a specific value (e.g. $1,856) by dragging is impractical.

### Spec: one shared component
Build a `NumberField` (or rework the `slider()` helper's internals so call sites barely change; propose which).
- **Type in display units.** $ fields take dollars, % fields take percent (4.35, not 0.0435), years take years. Conversion to/from internal units happens inside the component via the call site's existing format/scale.
- **Commit on Enter or blur, not per keystroke.** Intermediate typing ("1", "15", "150"…) must not re-run the sim or trigger clamping. Esc reverts to the last committed value.
- **Arrow keys:** Up/Down nudge by the old slider `step`; Shift+Up/Down = 10× step. Each nudge commits.
- **Min/max:** keep the old slider bounds as validation. On commit, clamp out-of-range values and briefly show it (e.g. a subtle border flash or a small "max $X" hint). Show the allowed range as muted hint text or tooltip.
- **Display:** thousands separators and unit prefix/suffix when not focused; raw editable number when focused.
- **Keep the existing readouts.** Many sliders show derived text (e.g. "$1,234/mo × 8mo", "4.5% ($77K)"). Keep that text beside/under the field.
- Invalid input (empty, non-numeric) on commit → revert, don't write NaN.
- Match the existing dark theme, fonts and sizes; keep panels compact.

### Scope / audit
- Convert **every** slider: those via the `slider()` helper **and** raw `<input type="range">` elsewhere (STR/MTR schedule segment grids, Work Income Curve point controls, sale-details, HI Debt Balances, Nolan deferment Year/Month, family loan, market assumptions, the new Part B closing-cost field, the new Part A personal-use share, etc.).
- **List all converted controls for Bob in the plan** before writing, grouped by panel. Flag any where a typed field seems worse (e.g. a true toggle or 3-option choice, which should be buttons, not numbers) and propose the alternative instead of converting blindly.
- Fields that already accept typed input: unify them onto the new component if it's low-risk; otherwise leave and list them.
- Pure UI change: no engine, default value, or range changes.

### Tests
- Expect many Playwright tests to drive sliders (`fill` on range inputs, etc.). Find them all, list them in the plan, and update them to use the new fields (type + Enter).
- Add a small group (e.g. **AE**): typing a value + Enter commits it; Esc reverts; out-of-range clamps; arrow-key nudge uses step; typing intermediate digits does not change the sim until commit.
- Because this touches many tests, **the full suite is warranted for this part.** Ask Bob before running it.

**→ STOP. Bob reviews, commits, pushes.** Write the session journal.

---

## Open items carried forward (untouched by this handoff)
Same as session 44's list, including: Cumulative chart COST view stacked bands omitting LI loan payments / IRMAA / extra principal; Sophia's $55K round-number balance awaiting a real per-loan refresh.
