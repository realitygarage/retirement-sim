# Retirement Sim v3 — Phase 1 CONSOLIDATED SPEC (v3.1.0)
## Property Dispositions, Lawsuit Settlement, 6th St STR, HI-Debt Paydown

**Date:** 2026-07-02
**Supersedes:** `v3_phase1_disposition_handoff.md` and Addendum A revs 1–3 — this single
document is the complete Phase 1 spec.
**Workflow:** design done in claude.ai; this doc is the full task brief for Claude Code.
**Disclaimer:** Tax mechanics are planning approximations to encode in a model, not tax
or legal advice. Figures come from the accountant's liquidation worksheet
(`Ottinger.xlsx`, Remax net sheets, "FOR PROJECTION PURPOSES ONLY") and are estimates.
The settlement gain-offset treatment is an UNCONFIRMED position pending CPA review.

---

## 0. Context & driving scenario

A lawsuit (Tartell) is settling for **$450K–$525K**, to be funded by selling one or
more properties. Likely path: **sell 15th St** — its ~$951K recognized gain can fully
absorb a settlement-based capital-gain offset (6th St's post-§121 gain of ~$275K
cannot), and it preserves the §121-sheltered home. Consequences to model:

- The duplex's rental income disappears at sale → **6th St runs short-term rentals
  for a period to keep the high-interest (HI) debt avalanche funded**.
- After paying the settlement, **$50K–$175K residual** may remain → knob to pay down
  HI debt immediately (it costs 8–14% vs 5.5% investment return).

Property mapping (⚠ confirm Barberry↔Lafayette):

| Sim name | Accountant sheet | Status |
|---|---|---|
| 6th St (primary) | SALE OF 6TH STREET — HOME | confirmed |
| Lafayette | SALE OF 540 BARBERRY — RENTAL | **assumed** — values/mortgage line up |
| 15th St duplex | SALE OF 15TH STREET — RENTAL | confirmed |

Both rentals were acquired via 1031 exchange from Bonair (La Jolla, CA) and carry
deferred CA-source gain (CA clawback on taxable sale) plus depreciation recapture.

## 1. Disposition modes (replaces the home-only sell flag)

Per property: `keep` | `sell_taxable` | `full_1031` | `partial_1031`

Knobs per disposition: `year`, `saleMode` (`market` | `forced`), `cashBoot`
(partial_1031 only), `replacementFmv` / `replacementMortgage` (parked as a static
deferred-equity line in Phase 1 — the replacement does NOT re-enter as a live asset;
that is Phase 2, along with the §121-on-conversion haircut for a 1031-acquired
property later converted to a primary).

## 2. New constants & defaults

### 2a. Rate constants — add to `engine.js`

```js
export const DISPO_DEFAULTS = {
  fedCapGainsRate:    0.238,  // 20% LTCG + 3.8% NIIT
  recaptureRate:      0.25,   // unrecaptured §1250 max
  coTaxRate:          0.044,  // CO flat
  caClawbackRate:     0.123,  // CA rate on CA-source deferred gain (calibrate, see §5)
  sellingCostsPct:    0.06,
  forcedSaleDiscount: 0.15,   // sheriff's-sale haircut vs market
};
```

### 2b. Liquidation defaults — add to `defaults.js`

```js
// Source: Ottinger.xlsx accountant liquidation worksheet, 2026 (Remax net sheets).
// All figures are estimates; slider range = ±50% of default unless noted.
export const LIQUIDATION_DEFAULTS = {
  sixth: {
    label: '6th St (home)',
    salesPrice:        1_675_000,
    adjustedBasis:       899_550,  // $735K cost + $76K improvements + $88.55K closing
    sec121Exclusion:     500_000,
    caSourceDeferredGain:      0,
    depreciationRecapture:     0,
    cpaEstTax:            62_000,  // Fed 50K + CO 12K + CA 0
    cpaNetProceedsPreTax:  770_881,
    cpaNetProceedsAfterTax:708_881,
  },
  barberry: {
    label: '540 Barberry / Lafayette (rental)',
    salesPrice:          625_000,
    adjustedBasis:       183_043,  // carryover after 1031, per sheet
    sec121Exclusion:           0,
    caSourceDeferredGain: 391_507, // deferred Bonair gain allocated to Barberry
    depreciationRecapture: 21_500, // sheet: varies with sale date
    cpaEstTax:           124_000,  // Fed 80K + CO 0 + CA 44K
    cpaNetProceedsPreTax:  407_567,
    cpaNetProceedsAfterTax:283_567,
  },
  fifteenth: {
    label: '2224 15th St (rental)',
    salesPrice:        1_375_000,
    adjustedBasis:       424_309,
    sec121Exclusion:           0,
    caSourceDeferredGain: 801_441,
    depreciationRecapture: 44_000,
    cpaEstTax:           288_000,  // Fed 200K + CO 8K + CA 80K
    cpaNetProceedsPreTax:  944_470,
    cpaNetProceedsAfterTax:656_470,
  },
};

export const SETTLEMENT_DEFAULTS = {
  settlementNeed:        525_000,  // slider band 450K–525K; hard range ±50%
  settlementYear:        2026,
  // Kimbell/Arrowsmith capital-offset position (UNCONFIRMED — CPA to validate):
  // fraction of the settlement treated as reducing capital gains from the sales.
  gainOffsetPct:              0,   // slider 0–100%, DEFAULT OFF until CPA confirms
  sameYearSaleTaxBump:   50_000,   // sheet: ~+$50K tax if all 3 sold in same year
  requireSameYearForOffset: true,  // offset only if sale year === settlementYear
  // Lump-sum HI-debt paydown from residual sale proceeds.
  // residual = Σ afterTaxNetProceeds(saleYear) − settlementNeed  [~$50K–$175K
  // in a sell-15th + offset scenario]. % of residual so it scales with the
  // offset/settlement sliders; UI shows the computed $ amount live.
  hiPaydownPct:            100,    // 0–100% of residual, default 100 (avalanche:
                                   // HI debt costs 8–14% vs 5.5% investReturn)
};

// 6th St STR income group — mirrors the 15th St duplex top-unit STR pattern
// (topUnit/strSchedule/duplexTopSTR + STR cost knobs).
export const SIXTH_STR_DEFAULTS = {
  sixthIncomeMode: 'none',      // 'none' | 'mtr' (existing) | 'str' (NEW)
  sixthSTRMonthly:   9_000,     // PLACEHOLDER $/mo gross when STR-active; slider ±50%
  sixthSTRSchedule:  [],        // same segment shape as strSchedule:
                                //   [{yrFrom, yrTo, segments:[{days, rate, type}]}]
  sixthSTRStartYear: 2026,
  sixthSTRStopYear:  2055,
  sixthSTRStopOnDebtClear: true,// auto-stop STR the year HI debt hits 0
  // Cost knobs REUSED from existing params (do NOT duplicate):
  //   strPlatformPct (3%), strCleanPct (4%), mgrPct (0%), maintStr (0.75%)
};
```

## 3. Engine: `disposeAsset` — add to `engine.js`

Pure and self-contained for isolated unit testing (Group A pattern). Full dollars;
integration converts to $K where row format needs it.

```js
// Returns null for 'keep'. All dollar figures are full dollars.
export function disposeAsset(prop, mode, opts = {}) {
  if (mode === 'keep') return null;
  const cfg = { ...DISPO_DEFAULTS, ...(opts.rates || {}) };
  const sellingCostsPct = opts.sellingCostsPct ?? cfg.sellingCostsPct;
  const forced = opts.saleMode === 'forced';

  const grossPrice   = prop.fmv * (forced ? (1 - cfg.forcedSaleDiscount) : 1);
  const sellingCosts = grossPrice * sellingCostsPct;
  const netSale      = grossPrice - sellingCosts;
  const mortgagePayoff = prop.mortgageBalance || 0;
  const realizedGain = Math.max(0, netSale - (prop.basis || 0));

  const r = {
    mode, grossPrice, sellingCosts, netSale, mortgagePayoff, realizedGain,
    recognizedGain: 0, deferredGain: 0, cashBoot: 0,
    recaptureTax: 0, fedCapGainsTax: 0, caClawbackTax: 0,
    coTax: 0, otherStateCredit: 0, totalTax: 0,
    afterTaxNetProceeds: 0, deferredCarryForward: 0,
  };

  // ---- HOME: §121, no recapture, no CA clawback ----
  if (prop.isPrimary) {
    const taxableGain = Math.max(0, realizedGain - (prop.sec121Exclusion || 0));
    r.recognizedGain = taxableGain;
    r.fedCapGainsTax = taxableGain * cfg.fedCapGainsRate;
    r.coTax          = taxableGain * cfg.coTaxRate;
    r.totalTax       = r.fedCapGainsTax + r.coTax;
    r.afterTaxNetProceeds = netSale - mortgagePayoff - r.totalTax;
    return r;
  }

  // ---- RENTALS ----
  const depTaken = prop.depreciationTaken || 0;
  const caSrc    = prop.caSourceDeferredGain || 0;

  // Recapture-first ordering + CA clawback + CO with other-state credit
  const taxRecognized = (recognized) => {
    const recapturePortion = Math.min(recognized, depTaken);
    const capGainPortion   = Math.max(0, recognized - recapturePortion);
    const recaptureTax     = recapturePortion * cfg.recaptureRate;
    const fedCapGainsTax    = capGainPortion * cfg.fedCapGainsRate;
    const caRecognized     = Math.min(recognized, caSrc);
    const caClawbackTax    = caRecognized * cfg.caClawbackRate;
    const coOnCaSlice      = caRecognized * cfg.coTaxRate;
    const otherStateCredit = Math.min(caClawbackTax, coOnCaSlice);
    const coTax            = Math.max(0, recognized * cfg.coTaxRate - otherStateCredit);
    const caDeferredLeft   = Math.max(0, caSrc - caRecognized);
    return { recaptureTax, fedCapGainsTax, caClawbackTax, coTax, otherStateCredit, caDeferredLeft };
  };

  if (mode === 'sell_taxable') {
    r.recognizedGain = realizedGain;
    const t = taxRecognized(realizedGain);
    Object.assign(r, t);
    r.totalTax = t.recaptureTax + t.fedCapGainsTax + t.caClawbackTax + t.coTax;
    r.afterTaxNetProceeds = netSale - mortgagePayoff - r.totalTax;
    r.deferredCarryForward = 0;
    return r;
  }

  if (mode === 'full_1031') {
    r.recognizedGain = 0;
    r.deferredGain   = realizedGain;
    r.deferredCarryForward = caSrc; // CA-source deferral persists onto replacement
    r.totalTax = 0;
    r.afterTaxNetProceeds = 0;      // full roll => no cash freed
    return r;
  }

  if (mode === 'partial_1031') {
    const freedEquity = Math.max(0, netSale - mortgagePayoff);
    const boot = Math.min(Math.max(0, opts.cashBoot || 0), freedEquity);
    const recognized = Math.min(realizedGain, boot); // lesser of gain or boot
    const t = taxRecognized(recognized);
    Object.assign(r, t);
    r.cashBoot = boot;
    r.recognizedGain = recognized;
    r.deferredGain = realizedGain - recognized;
    r.deferredCarryForward = t.caDeferredLeft;
    r.totalTax = t.recaptureTax + t.fedCapGainsTax + t.caClawbackTax + t.coTax;
    r.afterTaxNetProceeds = boot - r.totalTax; // cash freed = boot net of its tax
    return r;
  }

  return r;
}
```

**Note on `depreciationTaken` vs sheet figures:** the sheet gives recapture *dollar
amounts* ($21.5K Barberry / $44K 15th). Back into `depreciationTaken` ≈ recapture ÷
`recaptureRate` for engine input, or accept a direct recapture-tax override — pick
whichever reconciles cleanly (§5).

## 4. Engine integration in `buildScenario`

1. **Disposition event (per property, at its disposition year):** call `disposeAsset`;
   add `afterTaxNetProceeds` into the cash/`cashAst` track (this REPLACES the bespoke
   home-only `p.sixthNetProceeds`/`makeParams` sale block — keep old pins resolvable
   by mapping the legacy `sellYear`/`sixthSalePrice` params to a 6th-St
   `sell_taxable` disposition). Accumulate `deferredCarryForward` as a tracked note
   (displayed, not yet a NW deduction — Phase 2).

2. **Disposition income/cost linkage (correctness-critical):** from the disposition
   year forward, a sold property drops out of ALL of: rental income (duplex bottom
   LTR + top STR/LTR/MTR for 15th; Lafayette rent for Barberry), property
   tax/insurance (`dplxTaxMo`/`lafTaxMo`/`primTaxMo` blocks), maintenance
   (struct-based), mortgage payment and mortgage-interest tax deduction, and NW
   value/mortgage lines. Grep targets in `engine.js`: `rental=`, `propCost`, `maint`,
   `mtgPmt`, `dplxVal/lafVal/primVal`, and the monthly mirror block
   `_rental0/_propC0/_maint0/_mtg0` — the mirror MUST stay consistent with the
   annual block.

3. **6th St STR income:** when `sixthIncomeMode==='str'` and `keepPrimary` and year in
   [start, stop): add `sixthSTRMonthly × 12 × rentGrowth^yr` (schedule-segment sum
   wins over flat rate, same precedence as duplex STR) to `rental`, net of
   `strPlatformPct + strCleanPct + mgrPct`. If `sixthSTRStopOnDebtClear`, stop the
   year after `hiDebt` first reaches 0. This flows into the avalanche `_avail` —
   the point: STR bridges the debt payoff after 15th sells. Back-compat: legacy
   `sixthMTR:true` loads as mode `'mtr'` with identical output.

4. **Settlement + gain offset:** when `gainOffsetPct > 0` and (if
   `requireSameYearForOffset`) settlement year matches the sale year(s):

   ```
   offset        = settlementNeed × gainOffsetPct
   gainsPool     = Σ recognized capital gains from that year's dispositions
                   (includes unrecaptured §1250 amounts — capital for netting)
   appliedOffset = min(offset, gainsPool)
   ```

   Apply pro-rata across that year's recognized gains (flag for CPA whether ordering
   should target highest-rate slices first). Output shows scenario tax with AND
   without the offset (~$120–160K at 100% on $525K). `settlementNeed` itself is a
   cash outflow in `settlementYear`. `sameYearSaleTaxBump` adds tax only when all
   three dispositions share a calendar year.

5. **Lump-sum HI paydown (sale year, after settlement paid):**

   ```
   residual = Σ afterTaxNetProceeds(saleYear) − settlementNeed   // floor at 0
   paydown  = min(residual × hiPaydownPct/100, ccBal + sophiaBal + nolanBal)
   ```

   Apply avalanche-order (highest rate first: CC 14% → Nolan ~8.4% → Sophia ~8.14%),
   reusing the monthly-avalanche queue logic. `residual − paydown` → `investedCash`.
   Timing: apply at the sale-year boundary BEFORE that year's monthly debt loop, so
   interest accrual and minimums reflect reduced balances. This can flip
   `debtCleared` mid-projection — sweep-to-savings and IO→P&I transitions must pick
   it up the same year (existing `debtCleared` logic should handle; test in §7).

6. **CA cap (sheet note):** CA tax applies to roughly **$1.2M of prior 1031 gain
   total**; remainder taxed to CO. Model CA clawback base as
   `min(caSourceDeferredGain recognized, share of $1.2M cap)`.

## 5. Reconciliation vs CPA figures

Output card shows, per property: engine-computed tax & after-tax proceeds vs
`cpaEstTax` / `cpaNetProceedsAfterTax`, with % delta. If |delta| > 10%, show a
"calibrate rates" warning — fix by tuning `DISPO_DEFAULTS` (accountant blended
effective rates differ from statutory: CA on Barberry ≈ 11.2% of its CA-source
gain; 15th St ≈ 10.0%; CO ≈ 0 on Barberry via the other-state credit).

## 6. UI spec (`App.jsx`, follow existing cost-basis / STR slider patterns)

Per property (defaults from `LIQUIDATION_DEFAULTS`, range **±50%**, step $5K):
- Disposition mode selector (`keep`/`sell_taxable`/`full_1031`/`partial_1031`) + year
- `salesPrice`, `adjustedBasis`, `caSourceDeferredGain`, `depreciationRecapture`
  sliders, labeled "estimate — accountant worksheet"
- `cashBoot` slider (partial_1031 only); market/forced toggle

Global:
- `settlementNeed`: default $525K; highlighted band 450–525K; range 262.5K–787.5K
- `gainOffsetPct`: 0–100%, default 0, labeled **"Settlement gain offset (UNCONFIRMED —
  Kimbell/Arrowsmith position, pending CPA)"**
- `sameYearSaleTaxBump`: on/off + amount
- `hiPaydownPct`: 0–100%, default 100%, labeled "HI-debt paydown from sale residual" —
  display live computed values: residual $, paydown $, remainder-to-invested $

6th St income group (mirror the duplex top-unit cluster):
- Mode selector `none | MTR | STR` (extends existing `sixthMTR` toggle; back-compat)
- `sixthSTRMonthly` slider: default $9,000/mo, ±50% ($4.5K–$13.5K), step $250
- `sixthSTRStartYear`/`sixthSTRStopYear` pickers; `sixthSTRStopOnDebtClear` checkbox
  (default ON)
- Advanced: `sixthSTRSchedule` segment editor reusing the existing STR editor component
- Note in UI: `strPlatformPct`/`strCleanPct`/`mgrPct` apply to BOTH duplex and 6th STR

Output card: after-tax proceeds per property, total cash raised, coverage vs
`settlementNeed`, residual & paydown, reconciliation rows (§5), deferred-carryforward
note. **Bump the version badge to v3.1.0.**

## 7. Tests (Group A — Core Engine Correctness)

disposeAsset unit tests:
- Home: §121 applied, no recapture/clawback.
- Rental `sell_taxable`: recapture-first ordering; CA clawback present; CO credit
  caps at CO tax on the CA-source slice.
- `full_1031`: zero tax, full deferral, `deferredCarryForward === caSrc`.
- `partial_1031`: recognized = min(gain, boot); proceeds = boot − tax; remaining
  CA-source carried forward; boot capped at freed equity.
- Forced sale applies discount and lowers after-tax proceeds vs market.

Integration tests:
- Reconciliation: engine after-tax proceeds within 10% of `cpaNetProceedsAfterTax`
  per property at defaults (after rate calibration).
- Sell 15th in year Y → duplex rental, prop cost, maint, mortgage, NW lines all zero
  from Y+ (both annual and monthly mirror paths).
- 6th STR adds net income only within [start, stop) and only while keepPrimary;
  income net of platform/cleaning/mgr; `sixthSTRStopOnDebtClear` stops the year
  after hiDebt → 0; legacy `sixthMTR:true` pin loads as `'mtr'` with identical output.
- Offset: `gainOffsetPct=0` → identical to no-offset; capped at gains pool;
  `requireSameYearForOffset` blocks cross-year; same-year bump only when all three
  share a year.
- Paydown: capped at total HI balance (excess → investedCash); avalanche order (CC
  extinguished before Nolan/Sophia touched); `hiPaydownPct=0` → residual fully
  invested; residual floors at 0 when settlement > proceeds; full paydown flips
  `debtCleared`/IO→P&I/sweep in the sale year.
- Direction sanity: sell-15th + 6th-STR clears HI debt earlier than sell-15th
  without STR; debtClearYr with paydown ≤ without.

Parse currency assertions with `parseFloat` + decimal-preserving regex (per journal
gotcha).

## 8. Known simplifications (flag in Glossary)

- **Debt-relief boot** ignored in partial_1031 (assumes replacement carries ≥ equal
  debt); less debt on replacement = more boot = more recognized gain.
- **CA clawback rate** and **CO other-state credit** are flat-rate approximations,
  calibrated to the accountant's blended effective rates.
- **§121-on-conversion haircut** (5-yr rule, nonqualified-use proration,
  non-excludable depreciation) NOT modeled — Phase 2.
- **Recapture-first ordering** at the unrecaptured-§1250 (25%) rate; confirm whether
  any portion is ordinary recapture.
- **Settlement gain offset** is an unconfirmed position — defaults OFF.
- **STR on the primary** may erode the future §121 exclusion (depreciation on the
  rented portion is never excludable) — flagged for CPA, not modeled.

## 9. Claude Code task instructions

> Read the retirement-sim project journal and this consolidated spec. Implement
> v3.1.0 in one pass: (1) add `DISPO_DEFAULTS` + `disposeAsset` to src/engine.js per
> §2a/§3; (2) add `LIQUIDATION_DEFAULTS`/`SETTLEMENT_DEFAULTS`/`SIXTH_STR_DEFAULTS`
> to src/defaults.js and generalize `makeParams` (replace the bespoke sixth* sale
> block; keep old pins resolvable via legacy mapping); (3) implement the
> `buildScenario` integration per §4 (disposition events, income/cost linkage in
> BOTH annual and monthly mirror blocks, 6th St STR, settlement + offset, HI
> paydown); (4) add the reconciliation card per §5 and the UI per §6, following the
> existing cost-basis and STR slider patterns; bump the version badge to v3.1.0;
> (5) add the Group A tests per §7. Show diffs before writing. Run run_tests.ps1
> (admin PowerShell), report results, then write the session journal entry before
> ending.

**Commit:** `git add -A && git commit -m "v3.1.0 -- per-property dispositions, CPA liquidation defaults, settlement gain-offset, 6th St STR group, HI-paydown knob"`

## 10. Open items — CPA / counsel (send §10 + figures with the accountant)

1. Kimbell v. US / Arrowsmith position: settlement of the Tartell claims (originating
   in the Bonair sale) treated as capital — reducing gain — rather than
   ordinary/nondeductible?
2. Mechanics given the 1031 deferral: capital loss in year of payment vs adjustment
   to the deferred-gain carryover? Same-year netting against sale gains (incl. §1250)?
3. Settlement-agreement language: recitals characterizing the payment as an
   adjustment to Bonair sale consideration — coordinate drafting with litigation
   counsel BEFORE signing.
4. CA sourcing: does the offset also reduce the CA clawback gain? Form 3840 impact?
5. Legal-defense fees: same capital character (capitalize vs deduct)?
6. Confirm Barberry ↔ "Lafayette" mapping and the $1.2M CA-gain cap interpretation.
7. STR on the 6th St primary: impact on future §121 (non-excludable depreciation;
   partial-home STR while occupying vs whole-home), lodging/occupancy tax at the
   planned scale.
8. Verify FTB Form 3840 filings since the Bonair exchange.
9. Depreciation actually taken per rental (to replace the backed-into figures).
