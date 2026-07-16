// v5.0.5 -- per-debt closing-eligibility for HI (CC/Sophia/Nolan), same
// control shape LI loans[] already carry: "Sweep over time" (ongoing
// avalanche only) vs. "Closing-eligible" (also retired by the one-time
// property-sale-closing lump-sum), toggle per debt in the HI Debt Balances
// cards (Loans & Debt section). Default true for all three -- matches the
// old global payOffHI toggle's typical setting and the pre-v5.0.5 hardcoded
// "always closing-eligible" behavior, so no configuration is needed for the
// common case; the 3 real saved pins predate this field and correctly
// resolve to true either way. HI stays unconditionally "sweepable" (the
// ongoing ambient avalanche) -- unaffected, only the ONE-TIME lump-sum
// eligibility is now per-debt. Removed the standalone "HI Debt at Closing"
// section (that was v5.0.3's payOffHI removal, a prerequisite for this).
// Wired directly into engine.js's existing debt-tiering buildDebtList (the
// same mechanism LI loans already use) -- NOT the dead diCap_/maintRate_
// plumbing v5.0.4's sweep flagged (that plumbing feeds params nothing reads;
// logged as a separate future-cleanup item, not touched here).
// v5.0.4 -- sweep remaining ||-default zero-value bugs to ??. Same bug class
// as v5.0.1 (STR/LTR cost sliders) and v5.0.3 (ccBal/sophiaBal/nolanBal/
// rates/mins): `x || <nonzero-default>` silently discards an honestly-
// entered 0. Systematic sweep of both sc->params conversion sites
// (App.jsx's buildRowsFromSnapshot and liveParams) plus every remaining
// `p.field||<nonzero>` read in engine.js turned up:
//   - engine.js: p.struct6/struct15/structLaf/maintStr (A1's uncapped
//     maintenance formula) -- 0% maintenance is a real modeling choice, not
//     reachable via the current sliders (min 300/250/125/0.25) but reachable
//     via saved pins, imports, or direct params.
//   - engine.js: p.caGainCap (no UI slider exists for this field at all) and
//     p.investReturn (slider min 2.75%, so 0% isn't reachable live either).
//   - App.jsx buildRowsFromSnapshot: sc.discFloor/rdTopUp/obTopUp and a
//     duplicate struct6/struct15/structLaf/maintStr copy, feeding the
//     computed diCap_/maintRate_ params -- confirmed DEAD (neither p.diCap
//     nor p.maintRate is read anywhere in engine.js, superseded by the
//     v5.0.0 refactor's direct rd/ob/discFloor and struct+maintStr
//     treatment), so this specific fix has zero behavioral effect today;
//     fixed anyway so it can't reintroduce a live bug if reconnected. Of
//     note, rdTopUp/obTopUp ARE live-reachable at 0 (their sliders literally
//     label 0 as "Off") -- the real (non-dead) rdTopUp/obTopUp reads in
//     engine.js already used the benign `||0` form and were unaffected.
// Confirmed the 3 real saved pins use the standard nonzero defaults for
// every affected field -- unaffected either way.
// v5.0.3 -- remove payOffHI zero-balance shortcut, HI debt always starts at
// real entered balance. payOffHI ("HI Debt at Closing: Sweep over time / Pay
// off at closing") was NOT the same mechanism as a loan's closingEligible
// flag -- it was a magic global assumption that zeroed ccBal/sophiaBal/
// nolanBal from month 0 and skipped their minimum payments entirely,
// asserting "this debt is already gone / handled outside the model" rather
// than modeling any real payoff. Removed entirely (engine.js: buildDebtList's
// payOffHI param, the ccBal/sophiaBal/nolanBal/hiMins/debtClearedMo
// conditionals; defaults.js: the payOffHI field, SC_DEFAULTS/DEFAULTS;
// App.jsx: the toggle UI, its setter, the dependent "Investment Return (SB
// proceeds)" slider-label swap). A zero-HI-debt scenario is now only
// reachable honestly: enter 0 balances, or let real paydown (ongoing sweep
// or the sale-closing lump-sum) clear them. SAVE_SCHEMA_VERSION bumped (field
// removed from the sc shape) -- no migration, old saves discarded per
// convention. While verifying this with entered-0-balance test scenarios,
// found and fixed a related pre-existing bug (same class as the v5.0.1 fix):
// engine.js's ccBal/sophiaBal/nolanBal/ccRate/sophiaRate/nolanRate/ccMin/
// sophiaMin/nolanMin all used `p.field||default`, so an honestly-entered 0
// (balance, rate, or minimum payment) silently fell back to the nonzero
// default -- `||` -> `??` at all nine. Confirmed the 3 real saved pins are
// unaffected (their sc snapshots use the standard nonzero defaults for all
// nine fields).
// v5.0.2 -- disposition cash-flow QUARTER bug: the one-time pooled-proceeds
// routing (sale proceeds -> obligation offset -> HI-debt avalanche -> reserve/
// buffer fill -> sweep) was keyed to the sale YEAR's first calendar month,
// ignoring hold.quarter/obligation.quarter entirely -- so for a Q2 sale, the
// mortgage balance correctly dropped in April (quarterStartMonth-gated via
// unitOwnedThisMonth) but the proceeds/obligation/draw/events all fired in
// January instead. obligation.quarter was never read anywhere in engine.js
// even though the UI has a live quarter toggle for it (defaults.js). Fixed:
// computeDispositions now emits per-year chronological cash EVENTS (each
// disposition's proceeds, and the obligation's payment, each carrying its own
// quarterStartMonth), consumed by buildMonthlyScenario at their own months
// instead of one January lump. Tax stays fully annual/unchanged (the
// gains-offset netting against the whole year's gainsPool is a separate
// upstream calc, untouched) -- only cash-routing TIMING moved. Same-year
// events in different quarters are look-ahead capped at the year's known
// eventual net total (computed upfront, since dispositions/obligation are
// deterministic params) so an earlier sale correctly holds back whatever a
// later same-year obligation will need, instead of routing the full amount
// immediately and leaving the obligation nothing left to net against --
// conservation holds exactly regardless of event order. New "{prop} sold"/
// "One-time obligation paid" event annotations added at the correct months
// (neither existed before this fix).
// v5.0.1 -- pre-existing v4.6.0 bug, UNRELATED to the v5.0.0 refactor: `||` treats a
// genuine 0 as falsy, so setting "STR platform fee"/"STR cleaning"/"LTR vacancy"/
// "MTR cleaning flat $" to literal 0 silently fell back to the nonzero default
// instead. Found while building a regression guard for v5.0.0's rentalOpCost fix
// (A5 needed a working 0% lever). Fixed at both sc->engine-params conversion sites
// (`||` -> `??`, nullish coalescing). Confirmed safe against all 3 real saved pins
// (each uses the nonzero defaults for all 4 affected fields) before landing.
// v5.0.0 -- SINGLE-ENGINE REFACTOR: the two-engine design (buildScenario annual +
// wfData monthly, which had to be kept in sync by hand and periodically drifted --
// see the v4.3.0/v4.3.1/v4.4.0 fixes above) is retired. buildMonthlyScenario
// (engine.js) is now the sole source of truth; the annual/Simulator view is pure
// aggregation (aggregateMonthlyToAnnual) of its monthly output -- stocks = the
// year's first-month snapshot, flows = summed over the year's real months. Pins
// now run the same full monthly engine as live (previously annual-only). See
// v5_phase0_findings.md for the full investigation: the approved modeling
// decisions (A1 uncapped/inflated structure-value maintenance, replacing both the
// old annual value%-based and monthly capped-reserve formulas; A2 pins get full
// monthly runs; A3 cashAst retired as inert; A4 fcfChart/sweepChart deleted, disc
// is the one FCF definition for every scenario), the latent bugs the divergence
// was masking and fixed by the collapse (B1 debt-avalanche pace -- the annual
// mirror was missing the rd/ob buffer competition; B2 sale-year reserve-fill vs.
// true-sweep conflation; B3 sale-year mortgage-interest tax deduction dropped by
// a coarse year-level ownership gate), and the clean small precision gains from
// continuous monthly compounding (C1 tax, C2 rental/cost growth) instead of
// once-per-row snapshots.
//
// Checkpoint 1b (full suite) caught two more silent regressions from the
// collapse, both restored to their exact pre-v5 behavior: (1) the annual
// `rental` field is now GROSS (wfData's own convention) where the old engine's
// was NET (via unitSegmentNet) -- `passive`/`reqWork` now explicitly net
// `rentalOpCost` back out, rather than carrying the old engine's incidental
// net-rental convention forward as a side effect. (2) IRMAA (Medicare surcharge,
// 2yrs after a taxable disposition) was computed (`computeDispositions`'s
// `irmaaYears`) but never actually charged anywhere -- ported back verbatim
// (`irmaaAddMo`/`fc_irmaa`/`irmaa`). Both were caught by a systematic old-vs-new
// field audit (not the suite itself -- see R16 and the strengthened A5, added/
// fixed specifically because nothing previously guarded either mechanism), and
// both are now cross-checked term-by-term against the old engine's full
// baseOut/passive computation with no other gaps found. One narrower, feature-
// gated finding from that same audit is deliberately NOT fixed here -- see the
// v5.0.0 entry in the session33 journal for the mtgPrincipalOn/pool-year
// wfToSavings display follow-up.
//
// v4.6.0 -- Work Income Curve gains quarter-precision point placement (was whole-year
// only), so a curve point can align with the same quarter a property sale is scheduled
// in. Pure UI change: workFromCurve() (engine.js) already interpolated on a continuous
// fractional yr -- both buildScenario (elapsedYrs) and wfData (mo/12) already fed it
// fractional elapsed-time -- so no engine change was needed. WorkCurveEditor's yr field
// now allows exact quarter fractions (0/.25/.5/.75, always representable exactly in
// binary floating point) via a new per-point Q1-4 button row (updatePtQuarter), separate
// from the existing year text input (which still edits only the whole-year part, since
// its parseInt-based parsing can't read "2027.25"). Point 0 (locked, always exactly "now")
// shows its TRUE calendar quarter derived from BASE.startMonth for display, not a naive
// Q1 default. No SAVE_SCHEMA_VERSION bump -- old integer-yr points remain valid (read as
// Q1), and no dual-engine sync risk since both engines already share workFromCurve.
// v4.5.0 -- debt tiering: per-loan closing/sweep flags, rate-ordered unified paydown queue,
// LI loans distinct on graph. Every debt now carries two independent per-loan flags --
// closingEligible (retired by the one-time property-sale-closing lump sum) and sweepable
// (joins the ongoing surplus-sweep avalanche) -- replacing the single includeInSweep flag
// that used to gate both. HI debt (CC/Sophia/Nolan, the named trio) is always both,
// hardcoded, unchanged behavior; added (LI) loans default to neither. Tier membership is
// STRUCTURAL (HI = the named trio; LI = whatever's in loans[]), never rate-based -- a
// loan's rate governs payoff ORDER only. Both engines' one-time closing payoff and ongoing
// sweep queue now route through shared engine.js helpers (buildDebtList/applyDebtPlan/
// rankSweepQueue) instead of duplicated inline mkDebts/applyPlan/q blocks -- deliberately
// the LAST time this logic is written twice; a v5 single-engine refactor collapses
// buildScenario/wfData into one next. The "HI Debt Balance" chart is retitled "Debt
// Balances" and now shows exactly 2 lines (HI debt, LI loans total) -- required adding
// famLoanBal to chartData's explicit field allowlist (it was silently absent, so the new
// LI line initially had a working legend but no actual data) and generalizing two
// FCF-chart-specific hardcodes in the shared Chart component (a "Live"->"Free Cash"
// tooltip/legend rewrite, and a "_sweep"-suffixed pin-comparison line) via new mainName/
// pinSecondaryKey props so they don't misfire on other charts with a secondary line.
// SAVE_SCHEMA_VERSION bumped (loans[].includeInSweep renamed) -- old pins discarded, not
// migrated, per project convention. Deliberately minimal ahead of the v5 refactor -- no
// rate thresholds, payoff optimization, or tier auto-migration; richer debt logic (e.g. an
// early/delayed $ formula for Brenda-equivalent loan scenarios, per-individual-loan chart
// lines) is explicitly deferred to post-v5.
// v4.4.0 -- birth-date anchor, per-spouse SS year+month with derived age, Medicare/FRA
// derived from birth date. BASE.yourBirthYear/Month (Bob, Oct 18 1961) and
// BASE.brendaBirthYear/Month (Brenda, Jan 19 1967) are now the single source of truth
// for every age-triggered event -- engine.js's deriveAgeAnchors() computes
// medicareYouYear/Month, brendaMedYear/Month, brendaFraYear/Month from them (never
// hand-edit the derived fields; a stale direct override of one is overwritten back to
// the birth-date-derived value the next time applyDefaultsOverrides runs). Bob's
// Medicare transition is corrected from the old hardcoded Nov-2026 to birth-date-derived
// Oct 2026 (his real birthday isn't the 1st of the month, so standard SSA "turns 65"
// timing puts it in October) -- an intentional correction, not a regression; the
// Playwright suite (Group U) now locks the corrected dates. SS is calendar-pegged like
// Medicare in BOTH engines: each spouse has independent ssStartYear/ssStartMonth (was a
// single stepped 65-70 ssAge toggle for Bob only, with no claiming control for Brenda at
// all) -- staggered claiming is now modelable, and buildScenario's yourSs/brendaSs became
// period-DOLLAR-TOTALS (summed month-by-month, prorating a mid-period claim) instead of
// flat $/mo constants, following the same "*12-in, /monthsThisYear-out" convention
// v4.3.0 established for other row fields. The Simulator sidebar's SS controls now show a
// derived claiming-age read-out per spouse (ssClaimAge, engine.js) with a non-blocking
// warning below age 62; Brenda's SS dollar amount stays flat regardless of claim date
// (no early/delayed formula exists for her, unlike Bob's Early->FRA interpolation, which
// is unchanged). SAVE_SCHEMA_VERSION bumped (ssAge removed from the sc shape) -- old pins
// are discarded, not migrated, per project convention.
// v4.3.1 -- 6th St selling-cost double-count fix: adjustedBasis ($899,550) already
// capitalizes the agent's $88,550 closing costs, but disposeAsset was ALSO subtracting
// DISPO_DEFAULTS.sellingCostsPct (6%) from the sale price before computing gain,
// double-counting the cost and understating taxable gain ($174,950 vs CPA-correct
// $275,450). Fixed via a structural split in disposeAsset (engine.js): the gain/tax
// calc now uses the property's real (cost-inclusive) basis verbatim when
// prop.sellingCostsInBasis is set, while cash net proceeds still deduct the real ~5%
// selling cost (hold.sellingCostsPct override, 6th St only) -- gain reconciles to
// $275,450 exactly, net within $803 of the CPA sheet's $708,881. sellingCostsInBasis
// is a per-property opt-in, NOT a global default. 15th St/Barberry are UNCHANGED --
// their basis is a 1031 carryover from the Bonair exchange with no documented
// selling-cost component; applying the same fix to them moved their reconciliation
// away from the CPA sheet, not toward it (see session28 journal for the full probe).
// v4.3.0 -- explicit model start-date anchor: BASE.startMonth (new) + BASE.startYear
// (promoted from a hardcoded constant to a Defaults-tab-editable field, alongside
// startMonth) replace the old implicit Jan-1 assumption. buildScenario's yr=0 is now a
// genuine partial period (only the months remaining in the start year), stocks (HI debt,
// mortgage balances) are snapshotted BEFORE that period's activity so the chart's start
// column matches entered settings exactly, and growth/appreciation exponents use
// continuous elapsed real time from the start date instead of the integer year index.
// wfData's startDate (was hardcoded June 2026) and the chart's calendar-year bucketing
// (was assuming mo=0 was January) now key off the same anchor. Both engines now share
// the same start-of-period HI-debt snapshot convention (closing that half of the annual-
// vs-monthly divergence), but their avalanche/sweep MAGNITUDES still genuinely differ --
// the two can still land on different debt-clear calendar years (separate, still-open
// "unify annual sweep model with wfData" issue, not touched this session).
// v4.2.6 -- itemized Disposition breakdown: a collapsible sub-card (default collapsed) under
// each property's "Proceeds summary" showing the full sale->tax->proceeds derivation as
// aligned label/value rows, adapting to mode (primary vs rental, 1031 vs sell). Display-only --
// every value pulled straight from disposeAsset's return object (or its pre-offset snapshot for
// the one-time-obligation delta line); rate labels (%) read from DISPO_DEFAULTS, never hardcoded.
// Dev-mode console.warn guards the arithmetic chain against drifting from the engine's own fields.
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, ComposedChart, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { BASE, HI_TOTAL, buildMonthlyScenario, aggregateMonthlyToAnnual, computeDispositions, keyStats, workFromCurve, remainBal, estimateTax, disposeAsset, taxRecognized, DISPO_DEFAULTS, unitSegmentGross, unitSegmentNet, validateUnitSegments, unitSegmentOverlaps, yearHeldFraction, unitOwnedThisMonth, quarterStartMonth, segmentClipInfo, mortgageBalanceClosed, mortgageMonthsSince, planHiPaydown, splitResidual, loanMonthlyPmt, applyDefaultsOverrides, getDefaultsCode, healthMonthly, monthsInYear, monthsElapsedBeforeYear, ssClaimAge, deriveAgeAnchors, buildDebtList, applyDebtPlan, rankSweepQueue } from "./engine.js";
// v4.3.0: BASE.startYear/startMonth (imported above) are the single source
// of truth for the model's "now" -- both are Defaults-tab-editable (see
// DEFAULTS_REGISTRY below), replacing the old implicit Jan-1 assumption and
// wfData's hardcoded June-2026 startDate.
import { SC_DEFAULTS, makeParams, PIN_COLORS, SAVE_SCHEMA_VERSION, DEFAULT_LOANS_SC, freshPropertiesDefaults, freshObligationDefaults } from "./defaults.js";

// v3.1.0: expose engine on window for Playwright unit tests via page.evaluate
if (typeof window !== 'undefined') {
  window.__engine = {
    BASE, HI_TOTAL, buildMonthlyScenario, aggregateMonthlyToAnnual, computeDispositions, keyStats, disposeAsset, taxRecognized,
    DISPO_DEFAULTS, makeParams,
    workFromCurve, remainBal, estimateTax,
    unitSegmentGross, unitSegmentNet, validateUnitSegments, unitSegmentOverlaps,
    yearHeldFraction, unitOwnedThisMonth, quarterStartMonth, segmentClipInfo,
    planHiPaydown, splitResidual, loanMonthlyPmt,
    mortgageBalanceClosed, mortgageMonthsSince,
    applyDefaultsOverrides, getDefaultsCode,
    freshPropertiesDefaults, freshObligationDefaults,
    monthsInYear, monthsElapsedBeforeYear,
    ssClaimAge, deriveAgeAnchors, healthMonthly,
    buildDebtList, applyDebtPlan, rankSweepQueue,
  };
}
// v4.4.0: month-name labels for the SS/Medicare month-precision UI (year+month
// pickers, event-timeline notes). Single shared constant -- was previously an
// inline array literal at the "Launch {month} {year}" header display.
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// v4.4.0: Bob's SS $ formula, generalized from the old stepped ssAge (65/66/67)
// toggle to a continuous derived age (see ssClaimAge, engine.js). Same two-piece
// rule as before: flat FRA at/after 67, linear Early->FRA interpolation below --
// preserves the pre-existing quirk that ages beyond 67 do NOT get a delayed-claim
// bonus in the real $ calc (only the UI's old helper text ever showed that 8%/yr
// figure) -- not fixing that here, just not changing it.
function yourSsAmountFromAge(age){
  return age>=67 ? BASE.yourSsFRA : BASE.yourSsEarly + (age-65)*((BASE.yourSsFRA-BASE.yourSsEarly)/2);
}
import { REL_COLORS, RNODES, REDGES, NODE_W, NODE_H, COL_X, ROW_H, ROW_OFF, SVG_W, SVG_H, rNodePos } from "./relationships-data.js";

// =============================================================================
// v4.0.0-A DEFAULTS TAB registry -- every model input with NO slider/control,
// enumerated from engine.js (BASE, DISPO_DEFAULTS). Property values/mortgages
// moved onto properties[] (scenario data, edited in the property scaffold UI).
// Paths address the overrides object handed to applyDefaultsOverrides().
// =============================================================================
const DEFAULTS_REGISTRY = [
  {group:"Model Start Date", items:[
    // v4.3.0: the model's "now" -- both engines key every balance/growth
    // calculation off this pair (see engine.js's BASE.startMonth comment).
    // Deliberately the FIRST group: keeping this current is what keeps every
    // other number in the model honest.
    ["BASE.startYear","Start year"],
    ["BASE.startMonth","Start month (1-12)"],
  ]},
  {group:"Birth Dates", items:[
    // v4.4.0: single source of truth for every age-triggered event (Medicare
    // at 65, FRA at 67, SS claiming-age readout) -- see engine.js's
    // deriveAgeAnchors(). Brenda FRA year/Brenda -> Medicare year (both
    // formerly separate overridable BASE fields here) are now DERIVED from
    // these and are no longer directly editable -- edit birth date instead.
    ["BASE.yourBirthYear","Your birth year"],
    ["BASE.yourBirthMonth","Your birth month (1-12)"],
    ["BASE.brendaBirthYear","Brenda birth year"],
    ["BASE.brendaBirthMonth","Brenda birth month (1-12)"],
  ]},
  {group:"Liquidation-View Constants", items:[
    ["BASE.marriedExcl","§121 married exclusion $"],
    ["BASE.sellingCosts","Selling costs (liq view, fraction)"],
    ["BASE.fedCapGains","Fed cap gains (liq view)"],
    ["BASE.coCapGains","CO cap gains (liq view)"],
  ]},
  {group:"Income Baselines", items:[
    ["BASE.pensionMonthly","Pension $/mo"],
    ["BASE.yourSsEarly","Your SS early $/mo"],
    ["BASE.yourSsFRA","Your SS FRA $/mo"],
    ["BASE.brendaSsFRA","Brenda SS FRA $/mo"],
  ]},
  {group:"Health Insurance", items:[
    ["BASE.healthYouEricsson","You: Ericsson $/mo"],
    ["BASE.healthYouMedicare","You: Medicare $/mo"],
    ["BASE.healthMedicareInflation","Medicare inflation (decimal)"],
    ["BASE.healthBrendaEricsson","Brenda: Ericsson $/mo"],
    ["BASE.healthBrendaMedicare","Brenda: Medicare $/mo"],
    ["BASE.ericssonInflation","Ericsson inflation (decimal)"],
    ["BASE.healthKids","Kids premium $/mo"],
    ["BASE.sophiaOff","Sophia off plan (year)"],
    ["BASE.nolanOff","Nolan off plan (year)"],
    ["BASE.irmaaSurge","IRMAA surge $/mo/person"],
  ]},
  {group:"Property Tax & Insurance ($/mo)", items:[
    ["BASE.primTaxMo","6th St tax"],["BASE.primInsMo","6th St insurance"],
    ["BASE.dplxTaxMo","15th St tax"],["BASE.dplxInsMo","15th St insurance"],
    ["BASE.lafTaxMo","Lafayette tax"],["BASE.lafInsMo","Lafayette insurance"],
  ]},
  {group:"Core Living ($/mo)", items:[
    ["BASE.carLease","Car lease"],["BASE.otherIns","Other insurance"],
    ["BASE.food","Food"],["BASE.utilities","Utilities"],["BASE.personal","Personal"],
  ]},
  {group:"Disposition Tax Rates (decimals)", items:[
    ["DISPO_DEFAULTS.fedCapGainsRate","Fed cap gains + NIIT"],
    ["DISPO_DEFAULTS.recaptureRate","§1250 recapture"],
    ["DISPO_DEFAULTS.coTaxRate","CO flat"],
    ["DISPO_DEFAULTS.caClawbackRate","CA clawback"],
    ["DISPO_DEFAULTS.sellingCostsPct","Selling costs (dispositions)"],
    ["DISPO_DEFAULTS.forcedSaleDiscount","Forced-sale discount"],
  ]},
];
const pathGet = (obj, path)=>path.split('.').reduce((o,k)=>(o==null?undefined:o[k]), obj);

export default function App(){
  // -- Tab state ---------------------------------------------
  const [activeTab, setActiveTab] = useState("simulator");
  // -- Relationship diagram state ----------------------------
  const [relHovered,  setRelHovered]  = useState(null);
  const [relSelected, setRelSelected] = useState(null);
  const relActive = relSelected || relHovered;
  const relConnected = relActive
    ? new Set([relActive,...REDGES.filter(e=>e.f===relActive||e.t===relActive).flatMap(e=>[e.f,e.t])])
    : null;

  // -- v3.4.0 Defaults-tab overrides (no-slider model constants) ------
  // Loaded from localStorage and applied to the engine's BASE boundary BEFORE
  // the first engine run. Precedence: a pin's paramSnapshot wins for the sc
  // params it contains; these overrides fill everything else.
  const [defaultsOv, setDefaultsOv] = useState(()=>{
    let ov = {};
    try{ ov = JSON.parse(localStorage.getItem('retirement_sim_defaults_overrides')||'{}') || {}; }catch(e){}
    applyDefaultsOverrides(ov);
    return ov;
  });
  const [defaultsRev, setDefaultsRev] = useState(0);
  const defaultsCode = useMemo(()=>getDefaultsCode(),[]);
  useEffect(()=>{
    applyDefaultsOverrides(defaultsOv);
    try{ localStorage.setItem('retirement_sim_defaults_overrides', JSON.stringify(defaultsOv)); }catch(e){}
    setDefaultsRev(r=>r+1);
  },[defaultsOv]);

  // -- Scenario state (single editable object -- the sidebar always edits
  // live; loading a pin copies its params into live, see loadPinIntoLive) --
  const [liveSc,  setLiveSc]  = useState(SC_DEFAULTS);

  // Helpers: get/set the (sole) editable scenario
  const sc = liveSc;
  const setSc = useCallback((updater)=>{
    setLiveSc(s=>typeof updater==="function"?updater(s):{...s,...updater});
  },[]);

  // Destructure active scenario for use in controls + engines
  const {
    // v4.4.0: ssAge (stepped 65-70 toggle) replaced by explicit per-spouse claim dates.
    ssStartYear, ssStartMonth, ssBrendaStartYear, ssBrendaStartMonth,
    workPts, lifestyleSplit,
    reApp, rentGr, cpi, healthCpi, propCpi, taxEnabled, investRet, lifestyleDraws,
    ccBal, ccRate, ccMin, sophiaBal, sophiaRate, sophiaMin, nolanBal, nolanRate, nolanMin,
    // v5.0.5: per-debt closing-eligibility, same flag shape LI loans[] carry.
    ccClosingEligible=true, sophiaClosingEligible=true, nolanClosingEligible=true,
    loans=DEFAULT_LOANS_SC,
    rdTopUp, rdCap, obTopUp, obCap, discFloor, fcfSchedule, sweepDelay, struct6, struct15, structLaf, maintStr, bufferMode,
    strPlatformPct=3, strCleanPct=4, mgrPct=0, ltrVacancyPct=4, mtrCleaningFlat=300,
    // v4.0.0-A property-centric schema
    properties=freshPropertiesDefaults(),
    obligation=freshObligationDefaults(),
    caGainCap=1_200_000, settleLifestyleDraw=0, settleDrawLabel='',
    sameYearSaleTaxBump=50_000, sameYearSaleTaxBumpOn=true,
    mtgPrincipalOn=false, mtgPrincipalCap=2000, mtgPrincipalUncapped=false,
  } = sc;

  const propById = useMemo(()=>Object.fromEntries(properties.map(pr=>[pr.id,pr])), [properties]);

  // Individual setters -- all route through setSc
  const setProperty = useCallback((id, patch) => setSc(s => ({
    ...s, properties: (s.properties||freshPropertiesDefaults()).map(pr=>pr.id===id?{...pr,...patch}:pr),
  })), []);
  const setPropertyHold = useCallback((id, patch) => setSc(s => ({
    ...s, properties: (s.properties||freshPropertiesDefaults()).map(pr=>pr.id===id?{...pr,hold:{...pr.hold,...patch}}:pr),
  })), []);
  const setPropertyMortgage = useCallback((id, patch) => setSc(s => ({
    ...s, properties: (s.properties||freshPropertiesDefaults()).map(pr=>pr.id===id?{...pr,mortgage:{...pr.mortgage,...patch}}:pr),
  })), []);
  const setUnitSegments = useCallback((propId, unitIdx, updater) => setSc(s => ({
    ...s, properties: (s.properties||freshPropertiesDefaults()).map(pr=>{
      if(pr.id!==propId) return pr;
      return { ...pr, units: pr.units.map((u,i)=>i!==unitIdx?u:{
        ...u, segments: typeof updater==="function" ? updater(u.segments||[]) : updater,
      })};
    }),
  })), []);
  const setObligation = useCallback((patch) => setSc(s => ({
    ...s, obligation: { ...(s.obligation||freshObligationDefaults()), ...patch },
  })), []);
  const setSweepDelay     = v=>setSc(s=>({...s,sweepDelay:v}));
  const setSameYearSaleTaxBumpOn = v=>setSc(s=>({...s,sameYearSaleTaxBumpOn:v}));
  const setSameYearSaleTaxBump   = v=>setSc(s=>({...s,sameYearSaleTaxBump:v}));
  const setSsStartYear        = v=>setSc(s=>({...s,ssStartYear:v}));
  const setSsStartMonth       = v=>setSc(s=>({...s,ssStartMonth:v}));
  const setSsBrendaStartYear  = v=>setSc(s=>({...s,ssBrendaStartYear:v}));
  const setSsBrendaStartMonth = v=>setSc(s=>({...s,ssBrendaStartMonth:v}));
  const setWorkPts        = v=>setSc(s=>({...s,workPts:typeof v==="function"?v(s.workPts):v}));
  const setLifestyleSplit = v=>setSc(s=>({...s,lifestyleSplit:v}));
  const setReApp          = v=>setSc(s=>({...s,reApp:v}));
  const setRentGr         = v=>setSc(s=>({...s,rentGr:v}));
  const setCpi            = v=>setSc(s=>({...s,cpi:v}));
  const setHealthCpi      = v=>setSc(s=>({...s,healthCpi:v}));
  const setPropCpi        = v=>setSc(s=>({...s,propCpi:v}));
  const setTaxEnabled     = v=>setSc(s=>({...s,taxEnabled:typeof v==="function"?v(s.taxEnabled):v}));
  const setInvestRet      = v=>setSc(s=>({...s,investRet:v}));
  const setLifestyleDraws = v=>setSc(s=>({...s,lifestyleDraws:typeof v==="function"?v(s.lifestyleDraws):v}));
  const setCcBal          = v=>setSc(s=>({...s,ccBal:v}));
  const setCcRate         = v=>setSc(s=>({...s,ccRate:v}));
  const setCcMin          = v=>setSc(s=>({...s,ccMin:v}));
  const setSophiaBal      = v=>setSc(s=>({...s,sophiaBal:v}));
  const setSophiaRate     = v=>setSc(s=>({...s,sophiaRate:v}));
  const setSophiaMin      = v=>setSc(s=>({...s,sophiaMin:v}));
  const setNolanBal       = v=>setSc(s=>({...s,nolanBal:v}));
  const setNolanRate      = v=>setSc(s=>({...s,nolanRate:v}));
  const setNolanMin       = v=>setSc(s=>({...s,nolanMin:v}));
  const setCcClosingEligible     = v=>setSc(s=>({...s,ccClosingEligible:v}));
  const setSophiaClosingEligible = v=>setSc(s=>({...s,sophiaClosingEligible:v}));
  const setNolanClosingEligible  = v=>setSc(s=>({...s,nolanClosingEligible:v}));
  const setLoans          = v=>setSc(s=>({...s,loans:typeof v==="function"?v(s.loans||DEFAULT_LOANS_SC):v}));
  const setSettleLifestyleDraw = v=>setSc(s=>({...s,settleLifestyleDraw:v}));
  const setSettleDrawLabel     = v=>setSc(s=>({...s,settleDrawLabel:v}));
  const setMtgPrincipalOn       = v=>setSc(s=>({...s,mtgPrincipalOn:v}));
  const setMtgPrincipalCap      = v=>setSc(s=>({...s,mtgPrincipalCap:v}));
  const setMtgPrincipalUncapped = v=>setSc(s=>({...s,mtgPrincipalUncapped:v}));
  const setRdTopUp        = v=>setSc(s=>({...s,rdTopUp:v}));
  const setRdCap          = v=>setSc(s=>({...s,rdCap:v}));
  const setObTopUp        = v=>setSc(s=>({...s,obTopUp:v}));
  const setObCap          = v=>setSc(s=>({...s,obCap:v}));
  const setDiscFloor      = v=>setSc(s=>({...s,discFloor:v}));
  const setFcfSchedule    = v=>setSc(s=>({...s,fcfSchedule:typeof v==="function"?v(s.fcfSchedule||[]):v}));
  const setStruct6        = v=>setSc(s=>({...s,struct6:v}));
  const setStruct15       = v=>setSc(s=>({...s,struct15:v}));
  const setStructLaf      = v=>setSc(s=>({...s,structLaf:v}));
  const setMaintStr       = v=>setSc(s=>({...s,maintStr:v}));
  const setStrPlatformPct = v=>setSc(s=>({...s,strPlatformPct:v}));
  const setStrCleanPct    = v=>setSc(s=>({...s,strCleanPct:v}));
  const setMgrPct         = v=>setSc(s=>({...s,mgrPct:v}));
  const setLtrVacancyPct  = v=>setSc(s=>({...s,ltrVacancyPct:v}));
  const setMtrCleaningFlat= v=>setSc(s=>({...s,mtrCleaningFlat:v}));
  const setBufferMode        = v=>setSc(s=>({...s,bufferMode:v}));

  // -- Pins --------------------------------------------------
  // Convert a saved paramSnapshot (SC format) to engine params. v4.0.0-A:
  // properties/obligation pass straight through (no % conversion -- their
  // rate/pct fields are stored as decimals directly in sc, unlike ccRate etc).
  // v5.0.0 (A2): pins now run the SAME single monthly engine live uses --
  // returns {rows, wfRows} (aggregated annual + full monthly), not just an
  // annual-only approximation. This is what lets every pin_<id>_* chart field
  // (including FCF, A4) source identically to live instead of drifting.
  function buildRowsFromSnapshot(snap){
    const sc={...SC_DEFAULTS,...snap};
    // v5.0.4: `||` -> `??` -- same bug class as v5.0.1/v5.0.3 (an honestly-
    // entered 0, e.g. rdTopUp/obTopUp's UI-supported "Off" state, silently
    // fell back to the nonzero default). NOTE: diCap_/maintRate_ below are
    // confirmed dead -- neither p.diCap nor p.maintRate is read anywhere in
    // engine.js (superseded by the v5.0.0 refactor's direct rd/ob/discFloor
    // and struct6/15/Laf+maintStr treatment) -- so this particular fix has
    // no behavioral effect today, fixed only so it can't reintroduce a live
    // bug if either field is ever reconnected.
    const diCap_=(sc.discFloor??800)+(sc.rdTopUp??400)+(sc.obTopUp??500);
    const totalMaint=(sc.struct6??600)*1000*(sc.maintStr??0.75)/100
                    +(sc.struct15??500)*1000*(sc.maintStr??0.75)/100
                    +(sc.structLaf??250)*1000*(sc.maintStr??0.75)/100;
    const props = sc.properties || freshPropertiesDefaults();
    const totalVal = props.reduce((s,pr)=>s+(pr.hold?.mode==='keep'?pr.value:0), 0);
    const maintRate_=totalVal>0?totalMaint/totalVal:0.005;
    const params = makeParams({
      ...sc,
      // v4.4.0: ssAge (stepped toggle) replaced by explicit ssStartYear/Month
      // per spouse -- ssAmount now derives from a continuous claiming age
      // computed against Bob's real birth date (see ssClaimAge, engine.js),
      // not an implicit "myAge at BASE.startYear" assumption. Brenda's start
      // date/month pass straight through (her amount stays flat -- see
      // BASE.brendaSsFRA, read directly by the engine, not a param here).
      ssStartYear:  sc.ssStartYear,
      ssStartMonth: sc.ssStartMonth,
      ssAmount:     yourSsAmountFromAge(ssClaimAge(sc.ssStartYear, sc.ssStartMonth, BASE.yourBirthYear, BASE.yourBirthMonth)),
      ssBrendaStartYear:  sc.ssBrendaStartYear,
      ssBrendaStartMonth: sc.ssBrendaStartMonth,
      diCap:diCap_, maintRate:maintRate_,
      reAppreciation:sc.reApp/100, rentGrowth:sc.rentGr/100, inflation:sc.cpi/100,
      coreCpi:sc.cpi/100, healthCpi:sc.healthCpi/100, propCpi:sc.propCpi/100, propInflation:sc.cpi/100+0.007,
      investReturn:sc.investRet/100,
      lifestyleDraws:(sc.lifestyleDraws||[]).filter(d=>d.enabled),
      ccRate:sc.ccRate/100, sophiaRate:sc.sophiaRate/100, nolanRate:sc.nolanRate/100,
      loans:(sc.loans||DEFAULT_LOANS_SC).map(l=>({...l, rate:(l.rate||0)/100})),
      // v5.0.1 (pre-existing v4.6.0 bug, unrelated to the v5 refactor -- found
      // session33 while writing a regression guard for the rentalOpCost fix):
      // `||` treats a genuine 0 as falsy, so setting any of these sliders to
      // literal 0% silently fell back to the nonzero default instead. `??`
      // only falls back on null/undefined, restoring the ability to actually
      // set true zero.
      strPlatformPct:(sc.strPlatformPct??3)/100, strCleanPct:(sc.strCleanPct??4)/100, mgrPct:(sc.mgrPct||0)/100,
      ltrVacancyPct:(sc.ltrVacancyPct??4)/100, mtrCleaningFlat:sc.mtrCleaningFlat??300,
    });
    const wfRows = buildMonthlyScenario(params);
    const rows = aggregateMonthlyToAnnual(wfRows, params);
    return { rows, wfRows };
  }

  const [pins,    setPins]    = useState(()=>{
    try{
      const saved=localStorage.getItem('retirement_sim_pins');
      if(!saved) return [];
      const {version,pins:savedPins}=JSON.parse(saved);
      if(version!==SAVE_SCHEMA_VERSION) return [];
      return savedPins.map(p=>{const {rows,wfRows}=buildRowsFromSnapshot(p.paramSnapshot||{});return{...p,rows,wfRows,stats:keyStats(rows)};});
    }catch(e){ return []; }
  });
  const [pinName, setPinName] = useState("");
  const [evtPin,  setEvtPin]  = useState("live");
  const [eventsCollapsed, setEventsCollapsed] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [cumView,     setCumView]     = useState("income");
  const [cumCollapsed,setCumCollapsed]= useState(false);
  const [fcOpen, setFcOpen] = useState(false);  // fixed costs breakdown panel
  const [showLive, setShowLive] = useState(true);       // show live scenario on charts
  const [expandedChart, setExpandedChart] = useState(null); // which chart is drilled into
  const [nwMode,        setNwMode]        = useState('book'); // 'book' | 'liq'
  const [propCardOpen,  setPropCardOpen]  = useState({});     // v4.0.0-B per-property collapse (default open)
  const [propValueEdit, setPropValueEdit] = useState(null);   // {id,text} | null -- click-to-type property value
  const [loansDebtOpen, setLoansDebtOpen] = useState(true);   // v4.0.0-B Loans & Debt group collapse
  const [costProfilesOpen, setCostProfilesOpen] = useState(true); // v4.2.4 Cost Profiles group collapse
  const [dispoBreakdownOpen, setDispoBreakdownOpen] = useState({}); // v4.2.6 per-property itemized disposition breakdown (default collapsed)
  // v4.2.1 property value slider top-end anchored to each property's *default* value (not its
  // live/current value) so the range stays fixed while dragging instead of receding as you approach it.
  const defaultPropValueById = useMemo(()=>Object.fromEntries(freshPropertiesDefaults().map(p=>[p.id,p.value])),[]);
  // CF waterfall state now in sc object (see setSc setters above)
  const [wfMonths,  setWfMonths]  = useState(72);     // months to show in table
  const [mbmBreakdown, setMbmBreakdown] = useState(false);  // v3.2.0 Fixed-cost columns in month table
  const [nextId,  setNextId]  = useState(()=>{
    try{ const s=localStorage.getItem('retirement_sim_nextid'); return s?parseInt(s):1; }catch(e){return 1;}
  });
  const [visiblePins,   setVisiblePins]   = useState(new Set([1,2]));  // pin ids shown on charts
  const togglePinVis = useCallback((id)=>setVisiblePins(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }),[]);

  // -- Build live params --------------------------------------
  // Effective DI cap = what we protect from HI sweep
  // Split slider: lifestyleSplit% of surplus goes to FCF, rest to HI paydown
  // diCap is still the hard floor (min FCF + buffers); split controls above-floor routing
  const diCap = discFloor + rdTopUp + obTopUp;

  // v4.4.0: derived SS claiming age per spouse -- computed once here, reused
  // by the sidebar readout, the SS earnings-test card, and the chart ref-lines
  // below, so there is one definition of "claiming age," not three.
  const yourSsAge   = ssClaimAge(ssStartYear, ssStartMonth, BASE.yourBirthYear, BASE.yourBirthMonth);
  const brendaSsAge = ssClaimAge(ssBrendaStartYear, ssBrendaStartMonth, BASE.brendaBirthYear, BASE.brendaBirthMonth);

  // Maintenance: derived from Cash Flow structure values + rate -- source of truth.
  // v4.0.0-A: "still held" now keyed by each property's OWN hold.mode/year
  // (struct6 slider only matters while 6th is held at launch).
  const uiKeepPrimary = propById.sixth?.hold.mode==='keep' || (propById.sixth?.hold.year||2055) > BASE.startYear;
  const uiKeepDuplex  = propById.fifteenth?.hold.mode==='keep' || (propById.fifteenth?.hold.year||2055) > BASE.startYear;
  const uiKeepLaf     = propById.barberry?.hold.mode==='keep' || (propById.barberry?.hold.year||2055) > BASE.startYear;
  const maintAnnual6   = uiKeepPrimary ? struct6*1000*maintStr/100 : 0;
  const maintAnnual15  = uiKeepDuplex  ? struct15*1000*maintStr/100 : 0;
  const maintAnnualLaf = uiKeepLaf     ? structLaf*1000*maintStr/100 : 0;
  const totalMaintAnnual = maintAnnual6+maintAnnual15+maintAnnualLaf;
  const totalMarketVal = (uiKeepPrimary?(propById.sixth?.value||0):0)+(uiKeepDuplex?(propById.fifteenth?.value||0):0)+(uiKeepLaf?(propById.barberry?.value||0):0);
  const maintRate = totalMarketVal>0 ? totalMaintAnnual/totalMarketVal : 0.005;

  const liveParams = useMemo(()=>makeParams({
    ...sc,
    // v4.4.0: ssAge (stepped toggle) replaced by explicit per-spouse
    // ssStartYear/Month -- see the identical note in buildRowsFromSnapshot above.
    ssStartYear:  sc.ssStartYear,
    ssStartMonth: sc.ssStartMonth,
    ssAmount:     yourSsAmountFromAge(ssClaimAge(sc.ssStartYear, sc.ssStartMonth, BASE.yourBirthYear, BASE.yourBirthMonth)),
    ssBrendaStartYear:  sc.ssBrendaStartYear,
    ssBrendaStartMonth: sc.ssBrendaStartMonth,
    diCap, maintRate,
    reAppreciation:sc.reApp/100, rentGrowth:sc.rentGr/100, inflation:sc.cpi/100,
    coreCpi:sc.cpi/100, healthCpi:sc.healthCpi/100, propCpi:sc.propCpi/100,
    propInflation:(sc.cpi/100)+0.007,
    investReturn:sc.investRet/100,
    lifestyleDraws:sc.lifestyleDraws.filter(d=>d.enabled),
    ccRate:sc.ccRate/100, sophiaRate:sc.sophiaRate/100, nolanRate:sc.nolanRate/100,
    loans:(sc.loans||DEFAULT_LOANS_SC).map(l=>({...l, rate:(l.rate||0)/100})),
    // v5.0.1 (pre-existing v4.6.0 bug, unrelated to the v5 refactor) -- see
    // the identical note at buildRowsFromSnapshot's equivalent conversion above.
    strPlatformPct:(sc.strPlatformPct??3)/100, strCleanPct:(sc.strCleanPct??4)/100, mgrPct:(sc.mgrPct||0)/100,
    ltrVacancyPct:(sc.ltrVacancyPct??4)/100, mtrCleaningFlat:sc.mtrCleaningFlat??300,
  }),[sc, diCap, maintRate, defaultsRev]);   // defaultsRev: engines read mutated BASE/DISPO objects

  // v5.0.0: single monthly engine is the sole source of truth -- wfData
  // computed first (pure function of liveParams alone, no dependency on
  // liveRows anymore -- see computeDispositions in engine.js), liveRows is
  // now a pure aggregation of wfData (see aggregateMonthlyToAnnual).
  const wfData   = useMemo(()=>buildMonthlyScenario(liveParams),[liveParams]);
  const liveRows = useMemo(()=>aggregateMonthlyToAnnual(wfData, liveParams),[wfData, liveParams]);
  const liveStats = useMemo(()=>keyStats(liveRows),[liveRows]);

  // v3.4.0: saved-pin rows must also see Defaults-tab overrides (their engine
  // runs read the same mutated BASE boundary) -- rebuild on override change.
  useEffect(()=>{
    if(defaultsRev===0) return;
    setPins(ps=>ps.map(p=>{
      const {rows,wfRows}=buildRowsFromSnapshot(p.paramSnapshot||{});
      return {...p, rows, wfRows, stats:keyStats(rows)};
    }));
  },[defaultsRev]);

  // v4.0.0-A pooled routing breakdown -- everything the Obligation/routing card
  // displays comes from here, pulled straight off the disposeAsset return
  // objects (no UI recompute).
  const settleData = useMemo(()=>{
    const dr   = liveRows.dispoResults || {};
    const drNo = liveRows.dispoResultsNoOffset || {};
    const sellers = properties
      .map(pr=>({k:pr.id, label:pr.label, d:dr[pr.id], dn:drNo[pr.id]||dr[pr.id]}))
      .filter(({d})=>d && d.mode && d.mode!=='keep' && d.year===obligation.year);
    const totalProceeds = sellers.reduce((s,{d})=>s+(d.afterTaxNetProceeds||0),0);
    const residual = Math.max(0, totalProceeds - (obligation.amount||0));
    return {sellers, totalProceeds, residual};
  },[liveRows,properties,obligation.year,obligation.amount]);

  // v3.1.2 (carried) dev-mode consistency guard: warn if the displayed breakdown
  // drifts from the engine's disposeAsset outputs or the residual formula.
  useEffect(()=>{
    if(!(import.meta.env && import.meta.env.DEV)) return;
    for(const {k,d} of settleData.sellers){
      if(d.mode==='full_1031') continue;
      const preTax = d.mode==='partial_1031' ? (d.cashBoot||0) : d.netSale - d.mortgagePayoff;
      if(Math.abs((d.grossPrice - d.sellingCosts) - d.netSale) > 1)
        console.warn(`[obligation audit] ${k}: netSale ($${Math.round(d.netSale)}) != grossPrice - sellingCosts ($${Math.round(d.grossPrice - d.sellingCosts)})`);
      if(Math.abs((preTax - d.totalTax) - d.afterTaxNetProceeds) > 1)
        console.warn(`[obligation audit] ${k}: displayed after-tax ($${Math.round(d.afterTaxNetProceeds)}) != pre-tax - totalTax ($${Math.round(preTax - d.totalTax)}) -- UI drifting from disposeAsset`);
    }
    if(Math.abs(settleData.residual - Math.max(0, settleData.totalProceeds - (obligation.amount||0))) > 1)
      console.warn(`[obligation audit] residual ($${Math.round(settleData.residual)}) != max(0, Σ afterTaxNetProceeds - obligation.amount)`);
    // v4.0.0-B conservation: draw + debt paydown + reserve fill + savings === residual
    // v5.0.0 (B2 fix): wfReserveFill added as its own term -- reserve top-ups
    // and true sweep are no longer conflated into a single wfToSavings figure
    // (the pre-v5 annual engine never modeled the reserve-fill step at all;
    // the single monthly engine always did, correctly).
    const rSet = liveRows.find(r=>r.cal===obligation.year);
    if(rSet && settleData.sellers.length>0){
      const splitSum = (rSet.settleDraw||0)+(rSet.wfDebtPaid||0)+(rSet.wfReserveFill||0)+(rSet.wfToSavings||0);
      if(Math.abs(splitSum - settleData.residual) > 2)
        console.warn(`[obligation audit] draw+paydown+reserveFill+savings split ($${Math.round(splitSum)}) != residual ($${Math.round(settleData.residual)}) -- conservation violated`);
    }
  },[settleData,obligation.amount,liveRows,obligation.year]);

  // v4.2.6 dev-mode consistency guard for the itemized Disposition breakdown sub-card:
  // every property with mode!=='keep' (not just obligation-year sellers, unlike the audit
  // above) must reconcile netSale/pre-tax/after-tax against disposeAsset's own fields.
  useEffect(()=>{
    if(!(import.meta.env && import.meta.env.DEV)) return;
    const dr = liveRows.dispoResults || {};
    for(const prop of properties){
      const d = dr[prop.id];
      if(!d || !d.mode || d.mode==='keep') continue;
      if(Math.abs((d.grossPrice - d.sellingCosts) - d.netSale) > 1)
        console.warn(`[dispo breakdown] ${prop.id}: netSale ($${Math.round(d.netSale)}) != grossPrice - sellingCosts ($${Math.round(d.grossPrice - d.sellingCosts)})`);
      if(d.mode==='full_1031') continue; // rolled, not cashed out -- afterTaxNetProceeds is deliberately 0, not preTax-totalTax
      const preTax = d.mode==='partial_1031' ? (d.cashBoot||0) : d.netSale - d.mortgagePayoff;
      if(Math.abs((preTax - d.totalTax) - d.afterTaxNetProceeds) > 1)
        console.warn(`[dispo breakdown] ${prop.id}: afterTaxNetProceeds ($${Math.round(d.afterTaxNetProceeds)}) != pre-tax - totalTax ($${Math.round(preTax - d.totalTax)})`);
    }
  },[liveRows,properties]);


  // v3.2.0: expose both engines' outputs for Playwright parity/consistency tests
  useEffect(()=>{
    if(typeof window !== 'undefined'){ window.__wfData = wfData; window.__liveRows = liveRows; }
  },[wfData, liveRows]);

  // v4.2.0: expose the live scenario + pins, same test-scaffolding category
  // as __wfData/__liveRows above -- lets Playwright assert load-into-live
  // deep-equality/non-mutation without scraping every sidebar control.
  useEffect(()=>{
    if(typeof window !== 'undefined'){ window.__liveSc = sc; window.__pins = pins; }
  },[sc, pins]);

  // -- Chart data ------------------------------------------
  // -- Chart data ------------------------------------------
  const chartData = useMemo(()=>{
    // Aggregate monthly wfData into annual averages for the FCF chart.
    // Use disc (monthly engine's actual kept FCF) instead of annual engine surplus —
    // this ensures lifestyleSplit slider and graceDone sweep logic are reflected correctly.
    // v5.0.0 (A4): the old `fcfChart`-fallback-for-pins path is gone -- pins
    // now run the full monthly engine (A2) and their aggregated `surplus`
    // field IS the disc-based figure (aggregateMonthlyToAnnual, engine.js),
    // sourced identically to live's own `disc` grouping below. Live and
    // pinned FCF lines can no longer drift apart by construction.
    const discByYear={}, sweepByYear={}, totalSweepByYr={}, cntByYear={}, savAccByYear={}, abByYear={}, floorByYear={};
    const fc_mtgByYr={}, fc_hlthByYr={}, fc_coreByYr={}, fc_famByYr={}, fc_hiMinsByYr={}, fc_ropByYr={}, fc_propByYr={}, fc_taxByYr={};
    (wfData||[]).forEach(r=>{
      // v4.3.0: r.calYear (was `2026+Math.floor(r.mo/12)`, which silently
      // assumed wfData's mo=0 was January -- it wasn't even before this
      // change (wfData started at a hardcoded June), so this bucketing was
      // already mislabeling roughly half of every "calendar year" bucket
      // with the wrong 6 months. r.calYear is the SAME real calendar year
      // wfData itself computed for that row -- can't drift from it.
      const yr=r.calYear;
      discByYear[yr]=(discByYear[yr]||0)+(r.disc||0);
      sweepByYear[yr]=(sweepByYear[yr]||0)+(r.sweepToSavings||0);
      // combinedSweep: debt sweep while in debt, savings sweep after — mutually exclusive in wfData
      totalSweepByYr[yr]=(totalSweepByYr[yr]||0)+(r.sweep||0)+(r.sweepToSavings||0);
      abByYear[yr]=(abByYear[yr]||0)+(r.afterBuckets||0);
      floorByYear[yr]=r.floor||discFloor;  // last month's floor (stable within year)
      fc_mtgByYr[yr]=(fc_mtgByYr[yr]||0)+(r.fc_mtg||0);
      fc_hlthByYr[yr]=(fc_hlthByYr[yr]||0)+(r.fc_health||0);
      fc_coreByYr[yr]=(fc_coreByYr[yr]||0)+(r.fc_core||0);
      fc_famByYr[yr]=(fc_famByYr[yr]||0)+(r.fc_famLoan||0);
      fc_hiMinsByYr[yr]=(fc_hiMinsByYr[yr]||0)+(r.fc_hiMins||0);
      fc_ropByYr[yr]=(fc_ropByYr[yr]||0)+(r.fc_rentalOp||0);
      fc_propByYr[yr]=(fc_propByYr[yr]||0)+(r.fc_propCost||0);
      fc_taxByYr[yr]=(fc_taxByYr[yr]||0)+(r.fc_tax||0);
      cntByYear[yr]=(cntByYear[yr]||0)+1;
      // savingsAcc is a running total — take the last month value per year (end-of-year balance)
      savAccByYear[yr]=r.savingsAcc||0;

    });
    // Liquidation NW constants
    const _CGRATE = BASE.fedCapGains + BASE.coCapGains; // 0.282
    const _SCOST  = BASE.sellingCosts;                  // 0.05
    const _liqPropById = Object.fromEntries((liveParams.properties||[]).map(pr=>[pr.id,pr]));
    const _liqReApp     = liveParams.reAppreciation;
    const _liqSixthYr = _liqPropById.sixth?.hold.mode    ==='keep' ? Infinity : (_liqPropById.sixth?.hold.year    || 2055);
    const _liqLafYr   = _liqPropById.barberry?.hold.mode ==='keep' ? Infinity : (_liqPropById.barberry?.hold.year || 2055);
    const _liqDupYr   = _liqPropById.fifteenth?.hold.mode==='keep' ? Infinity : (_liqPropById.fifteenth?.hold.year|| 2055);

    return liveRows.map((r,i)=>{
      const cnt=cntByYear[r.cal]||12;
      const disc=discByYear[r.cal]!=null ? Math.round(discByYear[r.cal]/cnt) : Math.max(0, r.surplus||0);
      const sweep=Math.round((sweepByYear[r.cal]||0)/cnt);
      // Add sweep savings accumulation to NW — savingsAcc grows at investReturn inside wfData,
      // but wfData doesn't compound it after each month, so add it as a separate component.
      // Convert to $M to match nw units.
      const savAccRaw=savAccByYear[r.cal]||0;
      const savAccM=savAccRaw/1000000;
      const savAccK=Math.round(savAccRaw/1000);
      const surplusPool=abByYear[r.cal]!=null ? Math.round(abByYear[r.cal]/cnt) : 0;
      const floorLine=floorByYear[r.cal]||discFloor;
      const fc_mtg_=Math.round((fc_mtgByYr[r.cal]||0)/cnt);
      const fc_hlth_=Math.round((fc_hlthByYr[r.cal]||0)/cnt);
      const fc_core_=Math.round((fc_coreByYr[r.cal]||0)/cnt);
      const fc_fam_=Math.round((fc_famByYr[r.cal]||0)/cnt);
      const fc_hiMins_=Math.round((fc_hiMinsByYr[r.cal]||0)/cnt);
      const fc_rop_=Math.round((fc_ropByYr[r.cal]||0)/cnt);
      const fc_prop_=Math.round((fc_propByYr[r.cal]||0)/cnt);
      const fc_tax_=Math.round((fc_taxByYr[r.cal]||0)/cnt);
      const fixedTotal=fc_mtg_+fc_hlth_+fc_core_+fc_fam_+fc_hiMins_+fc_rop_+fc_prop_+fc_tax_;
      const combinedSweep=Math.round((totalSweepByYr[r.cal]||0)/cnt);
      const pt={year:r.cal, cal:r.cal, reqWork:r.reqWork, surplus:disc, surplusPool, floorLine, hiDebt:r.hiDebt,
        fixedTotal, fc_mtg:fc_mtg_, fc_hlth:fc_hlth_, fc_core:fc_core_, fc_fam:fc_fam_, fc_hiMins:fc_hiMins_, fc_rop:fc_rop_, fc_prop:fc_prop_, fc_tax:fc_tax_,
        // v5.0.0: r.nw already includes savingsAcc natively (aggregateMonthlyToAnnual,
        // engine.js) -- pre-v5 this was a two-engine hybrid add (annual nw + monthly
        // savAccM tacked on here); adding savAccM again now would double-count it.
        nw:r.nw/1000,  // $M
        sweepSavK:savAccK,
        sweepToSavings:sweep,
        combinedSweep,
        // v4.5.0: chartData is an explicit allowlist (not a spread of liveRows'
        // r), so a chart reading a NEW secondaryDataKey needs its field added
        // here explicitly too, or the line has no data to plot even though
        // the legend still renders (exactly what happened before this fix --
        // the Debt Balances chart's "LI loans" line/legend showed up but was
        // empty because famLoanBal was never copied into chartData).
        famLoanBal:r.famLoanBal,
        // NW breakdown fields (from annual engine, $K units — same as liveRows)
        reValue:r.reValue, reMortgage:r.reMortgage, reEquity:r.reEquity,
        hiDebtK:r.hiDebtK, invested:r.invested, savingsAccK:savAccK};

      // Liquidation NW: what you'd net selling everything today at year i
      // Gate each property on ownership at year (already-sold properties are gone from RE net)
      {
        const app=Math.pow(1+_liqReApp,i);
        const sixthOwned = r.cal<_liqSixthYr;
        const dupOwned   = r.cal<_liqDupYr;
        const lafOwned   = r.cal<_liqLafYr;
        let primNet=0;
        if(sixthOwned){
          const pv=(_liqPropById.sixth?.value||0)*app;
          const pb=r.primBalRaw ?? 0;   // v3.4.0 IO/recast state balance
          const sn=pv*(1-_SCOST);
          const taxable=Math.max(0,Math.max(0,sn-(_liqPropById.sixth?.hold.basis||0))-BASE.marriedExcl);
          primNet=sn-pb-taxable*_CGRATE;
        }
        let dplxNet=0;
        if(dupOwned){
          const dv=(_liqPropById.fifteenth?.value||0)*app;
          const db=r.dplxBalRaw ?? 0;
          const dsn=dv*(1-_SCOST);
          dplxNet=dsn-db-Math.max(0,dsn-(_liqPropById.fifteenth?.hold.basis||0))*_CGRATE;
        }
        let lafNet=0;
        if(lafOwned){
          const lv=(_liqPropById.barberry?.value||0)*app;
          const lb=r.lafBalRaw ?? 0;
          const lsn=lv*(1-_SCOST);
          lafNet=lsn-lb-Math.max(0,lsn-(_liqPropById.barberry?.hold.basis||0))*_CGRATE;
        }
        pt.liqNW=(primNet+dplxNet+lafNet+r.invested*1000+savAccRaw-r.hiDebtRaw)/1e6;
      }

      pins.forEach(pin=>{
        pt[`pin_${pin.id}_fc`]=Math.abs(pin.rows[i]?.mtg||0)+Math.abs(pin.rows[i]?.health||0)+Math.abs(pin.rows[i]?.core||0)+Math.abs(pin.rows[i]?.famLoan||0)+Math.abs(pin.rows[i]?.minDebt||0);
        pt[`pin_${pin.id}_rw`]=pin.rows[i]?.reqWork;
        // v5.0.0 (A4): pins run the full monthly engine now (A2) -- `surplus`
        // IS the disc-based FCF figure (aggregateMonthlyToAnnual), same
        // definition live's own `disc` above uses. `pin_id_sweep` mirrors
        // live's `combinedSweep` the same way (debt-sweep + sweep-to-savings).
        pt[`pin_${pin.id}_di`]=Math.max(0, pin.rows[i]?.surplus||0);
        pt[`pin_${pin.id}_sweep`]=Math.max(0,(pin.rows[i]?.debtSweep||0)+(pin.rows[i]?.sweepToSavings||0));
        pt[`pin_${pin.id}_debt`]=pin.rows[i]?.hiDebt;
        // v5.0.0: pin.rows[i].nw already includes savingsAcc natively (same
        // aggregateMonthlyToAnnual every scenario uses) -- the old manual
        // pinSavAcc re-accumulation loop existed only because pre-v5 pins
        // never had their own monthly savingsAcc state to draw from.
        pt[`pin_${pin.id}_nw`]=(pin.rows[i]?.nw??0)/1000; // $M
        pt[`pin_${pin.id}_sweepSavK`]=Math.round((pin.rows[i]?.savingsAccEnd||0)/1000);
        // Liquidation NW for pin
        {
          const pSnap=pin.paramSnapshot||{};
          const pApp=Math.pow(1+(pSnap.reApp??4)/100,i);
          const pPropById = Object.fromEntries((pSnap.properties||freshPropertiesDefaults()).map(pr=>[pr.id,pr]));
          const pSixthYr = pPropById.sixth?.hold.mode    ==='keep' ? Infinity : (pPropById.sixth?.hold.year    || 2055);
          const pDupYr   = pPropById.fifteenth?.hold.mode==='keep' ? Infinity : (pPropById.fifteenth?.hold.year|| 2055);
          const pLafYr   = pPropById.barberry?.hold.mode ==='keep' ? Infinity : (pPropById.barberry?.hold.year || 2055);
          const pSixthOwned = r.cal<pSixthYr;
          const pDupOwned   = r.cal<pDupYr;
          const pLafOwned   = r.cal<pLafYr;
          let pPrimNet=0;
          if(pSixthOwned){
            const pv=(pPropById.sixth?.value||0)*pApp;
            const pb=pin.rows[i]?.primBalRaw ?? 0;   // v3.4.0 IO/recast state balance
            const sn=pv*(1-_SCOST);
            const taxable=Math.max(0,Math.max(0,sn-(pPropById.sixth?.hold.basis||0))-BASE.marriedExcl);
            pPrimNet=sn-pb-taxable*_CGRATE;
          }
          let pDplxNet=0;
          if(pDupOwned){
            const dv=(pPropById.fifteenth?.value||0)*pApp;
            const db=pin.rows[i]?.dplxBalRaw ?? 0;
            const dsn=dv*(1-_SCOST);
            pDplxNet=dsn-db-Math.max(0,dsn-(pPropById.fifteenth?.hold.basis||0))*_CGRATE;
          }
          let pLafNet=0;
          if(pLafOwned){
            const lv=(pPropById.barberry?.value||0)*pApp;
            const lb=pin.rows[i]?.lafBalRaw ?? 0;
            const lsn=lv*(1-_SCOST);
            pLafNet=lsn-lb-Math.max(0,lsn-(pPropById.barberry?.hold.basis||0))*_CGRATE;
          }
          const pInvested=(pin.rows[i]?.invested??0)*1000;
          const pHiDebtRaw=(pin.rows[i]?.hiDebtRaw??0);
          const pSavAcc=(pin.rows[i]?.savingsAccEnd??0);
          pt[`pin_${pin.id}_liqNW`]=(pPrimNet+pDplxNet+pLafNet+pInvested+pSavAcc-pHiDebtRaw)/1e6;
        }
      });
      return pt;
    });
  },[liveRows,pins,wfData,liveParams.properties]);

  // NW yr10 from chartData (includes savingsAcc from sweep) — used in stat card
  const liveNwYr10 = useMemo(()=>(chartData[10]?.nw ?? liveStats.nwYr10/1000),
    [chartData, liveStats]);

  // Stable Y domains — rounded up to a clean ceiling so charts don't rescale while dragging
  const surplusMax = useMemo(()=>{
    const schedMax = (fcfSchedule||[]).reduce((m,s)=>Math.max(m,s.floor),0);
    const sweepMax = Math.max(...(chartData||[]).map(r=>r.combinedSweep||0), 0);
    const pinSweepMax = pins.length>0 ? Math.max(...(chartData||[]).flatMap(r=>pins.map(p=>r[`pin_${p.id}_sweep`]||0)), 0) : 0;
    const poolMax = Math.max(...(chartData||[]).map(r=>r.surplusPool||0), 0);
    const raw = Math.max(...(chartData||[]).map(r=>r.surplus||0), ...(chartData||[]).map(r=>r.combinedSweep||0), discFloor*1.5, schedMax*1.5, sweepMax*1.2, pinSweepMax*1.2, poolMax*1.1, 500);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw/mag)*mag;
  },[liveRows,discFloor,fcfSchedule,chartData]);
  const fixedCostMax = useMemo(()=>{
    const raw = Math.max(...(chartData||[]).map(r=>r.fixedTotal||0), 5000);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw/mag)*mag;
  },[chartData]);
  // True debt-clear year -- matches the Debt Balances chart's own zero-crossing
  // (same hiDebt series it plots), independent of the grace-period delay below.
  const debtClearYear = useMemo(()=>
    (chartData||[]).find(r=>(r.hiDebt||0)<=0)?.year ?? null,
  [chartData]);
  // Year the surplus sweep actually redirects to savings -- this lags debtClearYear
  // by the "Grace period (whoop it up first)" slider (sweepDelay), so it is NOT
  // the same event as debt clearing and must not share its label.
  const sweepToSavingsYear = useMemo(()=>
    (chartData||[]).find(r=>(r.sweepToSavings||0)>0)?.year ?? null,
  [chartData]);
  // v4.1.2: expose the two FCF-chart reference-line years for Playwright --
  // same test-scaffolding pattern as window.__wfData/__liveRows above.
  useEffect(()=>{
    if(typeof window !== 'undefined'){ window.__chartMarkers = {debtClearYear, sweepToSavingsYear}; }
  },[debtClearYear, sweepToSavingsYear]);
  // v4.1.4/4.1.5: expose chartData itself (same test-scaffolding pattern) so tests
  // can assert on the actual per-pin FCF series (pin_<id>_di) instead of
  // scraping chart pixels/tooltips.
  useEffect(()=>{
    if(typeof window !== 'undefined'){ window.__chartData = chartData; }
  },[chartData]);
  const reqWorkMax = useMemo(()=>{
    const raw = Math.max(...liveRows.map(r=>r.reqWork||0), 1000);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw/mag)*mag;
  },[liveRows]);

  // -- Pin actions ------------------------------------------
  // Capture all raw state needed to reconstruct this scenario
  const captureSnapshot = useCallback(()=>({...sc}),[sc]);

  const savePinsToStorage = useCallback((pinsToSave,nid)=>{
    try{
      const payload={version:SAVE_SCHEMA_VERSION, savedAt:new Date().toISOString(), pins:pinsToSave};
      localStorage.setItem('retirement_sim_pins',JSON.stringify(payload));
      localStorage.setItem('retirement_sim_nextid',String(nid));
    }catch(e){console.warn('localStorage save failed',e);}
  },[]);

  // Save live under `pinName`: overwrites the existing pin of that name (by
  // trimmed match), or branches into a new pin if the name is new/changed.
  const addPin = useCallback(()=>{
    const name=pinName.trim()||`Scenario ${nextId}`;
    const paramSnapshot=captureSnapshot();
    // v5.0.0 (A2): pinning live now just captures live's ALREADY-computed
    // rows/wfRows (both engines run once, for live, and pins reuse that
    // output) instead of re-running a separate buildScenario(liveParams) --
    // avoids a redundant duplicate computation of the exact same scenario.
    const rows=liveRows, wfRows=wfData;
    const cfSettings={
      rdTopUp,rdCap,obTopUp,obCap,discFloor,
      struct6,struct15,structLaf,maintStr,bufferMode,
      diCap,totalMaintAnnual,
    };
    const existing=pins.find(p=>p.name===name);
    let newPins, newNextId=nextId;
    if(existing){
      newPins=pins.map(p=>p.id===existing.id?{...p,rows,wfRows,stats:keyStats(rows),cfSettings,paramSnapshot}:p);
    } else {
      const newPin={id:nextId,name,color:PIN_COLORS[nextId%PIN_COLORS.length],rows,wfRows,stats:keyStats(rows),cfSettings,paramSnapshot};
      newPins=[...pins.slice(-5),newPin];
      newNextId=nextId+1;
      setVisiblePins(s=>new Set([...s,nextId]));
    }
    setPins(newPins);
    setNextId(newNextId);
    setPinName("");
    savePinsToStorage(newPins.map(p=>({...p,rows:undefined,wfRows:undefined,stats:undefined})),newNextId);
  },[liveRows,wfData,pinName,nextId,pins,captureSnapshot,savePinsToStorage,
     rdTopUp,rdCap,obTopUp,obCap,discFloor,struct6,struct15,structLaf,maintStr,bufferMode,diCap,totalMaintAnnual]);

  const setPinColor=useCallback((id,color)=>{
    const newPins=pins.map(p=>p.id===id?{...p,color}:p);
    setPins(newPins);
    savePinsToStorage(newPins.map(p=>({...p,rows:undefined,wfRows:undefined,stats:undefined})),nextId);
  },[pins,nextId,savePinsToStorage]);

  const removePin=useCallback((id)=>{
    const newPins=pins.filter(p=>p.id!==id);
    setPins(newPins);
    savePinsToStorage(newPins.map(p=>({...p,rows:undefined,wfRows:undefined,stats:undefined})),nextId);
  },[pins,nextId,savePinsToStorage]);

  // Load a pin's saved params into live (the sidebar's only editable
  // state) so it can be tweaked, then re-Pinned -- under the same name to
  // overwrite, or a new name to branch. Shallow copy: safe because every
  // setter in this file does copy-on-write on sc's nested arrays/objects
  // (never mutates in place), so subsequent live edits can't leak back into
  // the pin's stored paramSnapshot.
  const loadPinIntoLive = useCallback((pin)=>{
    const s=pin.paramSnapshot||{};
    const next={...SC_DEFAULTS,...s};
    if(next.lifestyleDraws) next.lifestyleDraws=next.lifestyleDraws.map(d=>({...d,enabled:d.enabled!==false}));
    setLiveSc(next);
    setPinName(pin.name);
    setShowLive(true);
  },[]);

  const exportPins = useCallback(()=>{
    const payload={
      version:SAVE_SCHEMA_VERSION,
      savedAt:new Date().toISOString(),
      pins:pins.map(p=>({id:p.id,name:p.name,color:p.color,cfSettings:p.cfSettings,paramSnapshot:p.paramSnapshot})),
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`retirement-scenarios-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },[pins]);

  const importPins = useCallback((e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const {version,pins:imported}=JSON.parse(ev.target.result);
        if(version!==SAVE_SCHEMA_VERSION){
          alert(`Schema version mismatch (file: v${version}, app: v${SAVE_SCHEMA_VERSION}). Some settings may not load correctly.`);
        }
        const restored=imported.map(p=>{const {rows,wfRows}=buildRowsFromSnapshot(p.paramSnapshot||{});return{...p,rows,wfRows,stats:keyStats(rows)};});
        const maxId=Math.max(nextId,...restored.map(p=>p.id+1));
        setPins(restored);
        setNextId(maxId);
        setVisiblePins(new Set(restored.map(p=>p.id)));
        savePinsToStorage(imported,maxId);
        alert(`Loaded ${restored.length} scenario${restored.length!==1?'s':''}.`);
      }catch(err){ alert('Could not read file: '+err.message); }
    };
    reader.readAsText(file);
    e.target.value='';
  },[nextId,savePinsToStorage]);

  // -- Styles ----------------------------------------------
  const bg0="#07090f",bg1="#0d1117",bg2="#161b22",bg3="#1e2530";
  const bdr="#252e3a",bright="#f0f6fc",muted="#a8bbd0",dim="#7d96ad";
  const amber="#f59e0b",green="#34d399",red="#f87171",blue="#60a5fa";
  const font="'Georgia',serif",mono="'Courier New',monospace";

  const sect=(label)=>(
    <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase",marginBottom:8,marginTop:14}}>{label}</div>
  );

  // v4.0.0-B: collapsible group header (Properties cards + Loans & Debt use this)
  const collapsibleSect=(label,isOpen,onToggle)=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isOpen?8:0,marginTop:14}}>
      <span style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase"}}>{label}</span>
      <button onClick={onToggle} style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,cursor:"pointer",
        background:"transparent",border:`1px solid ${bdr}`,color:dim}}>{isOpen?"▲ collapse":"▼ expand"}</button>
    </div>
  );

  const toggle=(val,setVal,opts)=>(
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {opts.map(o=>(
        <button key={o.v} onClick={()=>setVal(o.v)} style={{
          padding:"5px 10px",borderRadius:5,border:`1px solid ${val===o.v?o.c||amber:bdr}`,
          background:val===o.v?(o.c||amber)+"22":"transparent",
          color:val===o.v?(o.c||amber):muted,cursor:"pointer",
          fontFamily:font,fontSize:11,transition:"all 0.15s",
        }}>{o.l}</button>
      ))}
    </div>
  );

  const slider=(label,val,setVal,min,max,step,fmt)=>(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:10,color:muted}}>{label}</span>
        <span style={{fontSize:10,color:amber,fontFamily:mono}}>{fmt(val)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e=>setVal(parseFloat(e.target.value))}
        style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
    </div>
  );

  // v4.2.1 slider variant with a click-to-type value: clicking the numeric display swaps it for
  // a plain text input (Enter/blur commits, Escape cancels) so an exact value can be typed instead
  // of dragged. Typed values are clamped to [min,max] on commit. toText/fromText convert between
  // the slider's raw units and the typed display units (e.g. raw dollars <-> $K) -- pass identity
  // functions if no conversion is needed. Plain text (not type="number") so there's no native
  // spinner UI to clean up.
  const commitTypedSlider=(setVal,fromText,min,max)=>{
    if(!propValueEdit) return;
    const n=fromText(propValueEdit.text);
    if(!isNaN(n)) setVal(Math.min(max,Math.max(min,n)));
    setPropValueEdit(null);
  };
  const sliderTypeIn=(label,val,setVal,min,max,step,fmt,toText,fromText,testId,color=amber,fontSize=10)=>{
    const isEditing = propValueEdit && propValueEdit.id===testId;
    return (
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize,color:muted}}>{label}</span>
          {isEditing ? (
            <input type="text" inputMode="decimal" autoFocus data-testid={`${testId}-input`}
              value={propValueEdit.text}
              onChange={e=>{
                const v=e.target.value;
                if(/^-?\d*\.?\d*$/.test(v)) setPropValueEdit({id:testId,text:v});
              }}
              onBlur={()=>commitTypedSlider(setVal,fromText,min,max)}
              onKeyDown={e=>{
                if(e.key==='Enter') commitTypedSlider(setVal,fromText,min,max);
                if(e.key==='Escape') setPropValueEdit(null);
              }}
              style={{fontSize,color,fontFamily:mono,background:bg1,border:`1px solid ${color}`,
                borderRadius:3,width:70,textAlign:"right",padding:"1px 4px",outline:"none"}}/>
          ) : (
            <span data-testid={`${testId}-display`} onClick={()=>setPropValueEdit({id:testId,text:toText(val)})}
              style={{fontSize,color,fontFamily:mono,cursor:"pointer"}}
              title="Click to type an exact value">{fmt(val)}</span>
          )}
        </div>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e=>setVal(parseFloat(e.target.value))}
          style={{width:"100%",accentColor:color,cursor:"pointer",height:4}}/>
      </div>
    );
  };

  // v4.2.6 itemized Disposition breakdown -- display-only. Every dollar value below is
  // pulled straight off the disposeAsset return object (`d`, i.e. liveRows.dispoResults[id])
  // or its pre-offset snapshot (`dNo`, i.e. liveRows.dispoResultsNoOffset[id]); nothing here
  // recomputes tax/business logic -- only display arithmetic (subtraction/formatting) of
  // already-computed engine fields. Rate constants read from DISPO_DEFAULTS (never hardcoded)
  // so the % labels track the actual engine.js values.
  const dispoPct = r => { const v=r*100; return (Number.isInteger(v)?v.toFixed(0):v.toFixed(1))+"%"; };
  const dispoK = v => "$"+Math.round((v||0)/1000)+"K";
  const dispoRow = (label, val, kind="item") => (
    <div key={label} style={{
      display:"flex",justifyContent:"space-between",padding:"2px 0",
      borderTop:kind==="eq"?`1px solid ${bdr}`:"none",
      marginTop:kind==="eq"?2:0,
    }}>
      <span style={{color:kind==="eq"?bright:muted,fontWeight:kind==="eq"?"bold":"normal"}}>
        {kind==="sub"?"− ":kind==="eq"?"= ":""}{label}
      </span>
      <span style={{color:kind==="eq"?bright:muted,fontFamily:mono,fontWeight:kind==="eq"?"bold":"normal"}}>
        {kind==="sub"?"−":""}{dispoK(val)}
      </span>
    </div>
  );
  const renderDispoBreakdown = (prop, hold, d, dNo) => {
    if(!d || !d.mode || d.mode==="keep") return null;
    const isPrimary = prop.isPrimary;
    const preTaxProceeds = d.mode==="partial_1031" ? (d.cashBoot||0) : (d.netSale - d.mortgagePayoff);
    const offsetAmt = (dNo.recognizedGain||0) - (d.recognizedGain||0);
    const showOffset = obligation.offsetsCapitalGains!==false && obligation.year===hold.year && offsetAmt>0.5;
    const is1031 = d.mode==="full_1031" || d.mode==="partial_1031";
    return (
      <div data-testid={`dispo-breakdown-${prop.id}`} style={{marginTop:8,paddingTop:8,borderTop:`1px dashed ${bdr}`,fontSize:9}}>
        {dispoRow("Sale price (entered)", d.grossPrice)}
        {dispoRow(`Selling costs (${dispoPct(DISPO_DEFAULTS.sellingCostsPct)})`, d.sellingCosts, "sub")}
        {dispoRow("Net sale", d.netSale, "eq")}
        {dispoRow("Mortgage payoff", d.mortgagePayoff, "sub")}
        {dispoRow("Pre-tax proceeds", preTaxProceeds, "eq")}

        <div style={{fontSize:8,color:dim,fontStyle:"italic",margin:"6px 0 2px"}}>Gain &amp; tax:</div>
        {dispoRow("Adjusted basis", hold.basis||0)}
        {dispoRow("Realized gain", d.realizedGain)}
        {isPrimary && dispoRow("§121 exclusion (home)", hold.sec121Exclusion||0, "sub")}
        {showOffset && dispoRow("One-time obligation offset", offsetAmt, "sub")}
        {dispoRow("Recognized / taxable gain", d.recognizedGain, "eq")}

        <div style={{fontSize:8,color:dim,fontStyle:"italic",margin:"6px 0 2px"}}>Tax detail:</div>
        {!isPrimary && dispoRow(`Depreciation recapture (${dispoPct(DISPO_DEFAULTS.recaptureRate)})`, d.recaptureTax)}
        {dispoRow(`Federal cap gains (${dispoPct(DISPO_DEFAULTS.fedCapGainsRate)})`, d.fedCapGainsTax)}
        {!isPrimary && dispoRow("CA clawback", d.caClawbackTax)}
        {dispoRow("CO tax", d.coTax)}
        {!isPrimary && dispoRow("Other-state credit", d.otherStateCredit, "sub")}
        {dispoRow("Total tax", d.totalTax, "eq")}
        {dispoRow("After-tax proceeds", d.afterTaxNetProceeds, "eq")}

        {is1031 && (
          <>
            <div style={{fontSize:8,color:dim,fontStyle:"italic",margin:"6px 0 2px"}}>1031 exchange:</div>
            {d.mode==="partial_1031" && dispoRow("Cash boot", d.cashBoot)}
            {dispoRow("Deferred gain (rolled)", d.deferredGain)}
            {!isPrimary && dispoRow("CA-source deferred carryforward", d.deferredCarryForward)}
          </>
        )}
      </div>
    );
  };

  const statBadge=(label,val,good)=>(
    <div style={{background:bg2,borderRadius:6,padding:"8px 10px",flex:1}}>
      <div style={{fontSize:9,color:dim,marginBottom:3}}>{label}</div>
      <div style={{fontSize:13,color:good?green:val?bright:muted,fontFamily:mono,fontWeight:"bold"}}>{val||"--"}</div>
    </div>
  );

  const axP={stroke:dim,tick:{fontSize:9,fill:dim},tickLine:false};
  const gdP={strokeDasharray:"2 4",stroke:bg3};
  const ttP={contentStyle:{background:"#1a2535",border:`1px solid ${bdr}`,borderRadius:6,fontSize:10,color:bright,padding:"8px 12px"}};

  // v3.1.1 sold-state linkage (UI only -- engine gating already exists)
  const disabledStyle = {opacity:0.4, pointerEvents:"none"};
  const soldFirstYear = d => !!d && d.mode && d.mode!=='keep' && (d.year||2055) <= BASE.startYear;
  const soldLater     = d => !!d && d.mode && d.mode!=='keep' && (d.year||2055) >  BASE.startYear;
  const soldBadge = (d,key) => (d && d.mode && d.mode!=='keep') ? (
    <span data-testid={`sold-badge-${key}`} style={{fontSize:8,padding:"1px 6px",borderRadius:3,
      background:red+"22",border:`1px solid ${red}55`,color:red,fontFamily:mono,fontWeight:"bold"}}>
      SOLD in {d.year||2055}
    </span>
  ) : null;
  const soldCaption = d => soldLater(d) ? (
    <div style={{fontSize:8,color:dim,marginTop:3,fontStyle:"italic"}}>
      income applies through {(d.year||2055)-1}, stops at sale
    </div>
  ) : null;

  // Breakdown config per chart key
  const BREAKDOWNS = {
    reqWork: {
      label:"Work Income Required -- breakdown",
      series:[
        {key:"totalOut", label:"Total costs/mo",   color:"#f87171"},
        {key:"passive",  label:"Passive income/mo",color:"#34d399"},
        {key:"reqWork",  label:"Work gap/mo",       color:"#f59e0b", bold:true},
      ],
      note:"Work gap = total costs minus passive income (pension + SS + rental). Hits zero when passive covers everything.",
    },
    surplus: {
      label:"Free Cash Flow -- breakdown",
      series:[
        {key:"pension",   label:"Pension",       color:"#60a5fa"},
        {key:"yourSs",    label:"Your SS",        color:"#a78bfa"},
        {key:"brendaSs",  label:"Brenda SS",      color:"#c084fc"},
        {key:"rental",    label:"Rental income",  color:"#34d399"},
        {key:"workInc",   label:"Work income",    color:"#fbbf24"},
        {key:"drawInc",   label:"Lifestyle Draw", color:"#f59e0b", hideZero:true},
        {key:"health",    label:"Health ins",     color:"#f87171", cost:true},
        {key:"mtg",       label:"Mortgage",       color:"#fb923c", cost:true},
        {key:"core",      label:"Core living",    color:"#f97316", cost:true},
        {key:"maint",     label:"Maintenance",    color:"#ef4444", cost:true},
        {key:"minDebt",      label:"HI debt mins",  color:"#dc2626", cost:true},
        // v4.5.0: was "HI debt sweep" -- the unified avalanche can now also
        // accelerate a sweepable LI loan, so this total is no longer HI-only.
        {key:"debtSweep",    label:"Debt sweep (HI+LI)",  color:"#b91c1c", cost:true, hideZero:true},
        {key:"surplus",   label:"Free Cash (net)",color:"#34d399", bold:true},
      ],
      note:"Income items build up; cost items reduce it. Net = what's left after everything.",
    },
    // v4.5.0: retitled (was "HI Debt -- by loan type") and reordered so the
    // two treatment TIERS read as two visually distinct groups -- the HI
    // trio + its own "Total HI debt" subtotal, THEN a separate "Total LI
    // loans" subtotal -- instead of famLoanBal sitting between the trio and
    // the HI total as if it were part of HI. Grouping is by tier membership
    // (HI = the named trio; LI = loans[]), never a rate cutoff -- a loan's
    // rate never decides which group it's counted in here.
    hiDebt: {
      label:"Debt Balances -- by loan type ($K)",
      series:[
        {key:"ccBal",      label:"Credit card",   color:"#f87171"},
        {key:"sophiaBal",  label:"Sophia loans",  color:"#fb923c"},
        {key:"nolanBal",   label:"Nolan loans",   color:"#fbbf24"},
        {key:"hiDebt",     label:"Total HI debt", color:"#ef4444", bold:true},
        // v4.5.0: prefixed "LI loans:" (was a plain "Total HI debt"-style
        // static label) -- keeps the actual loan name(s) visible (there can
        // be more than one), not just the tier total, while still reading as
        // its own distinct LI subtotal instead of "Loans: X" sitting inside
        // the HI group the way it used to.
        {key:"famLoanBal", label:loans.length?("LI loans: "+loans.map(l=>l.label).join(", ")):"LI loans", color:"#a78bfa", bold:true, hideZero:true},
      ],
      note:"Two tiers, one rate-ordered avalanche: HI debt (CC/Sophia/Nolan) is always closing-eligible and sweepable. Added (LI) loans are simple scheduled amortizing payments unless individually marked sweepable and/or closing-eligible -- tier membership depends only on which set a loan belongs to, not its rate.",
    },
    fixedCosts: {
      label:"Fixed Costs / mo -- breakdown",
      series:[
        {key:"fc_mtg",    label:"Mortgages",        color:"#f87171"},
        {key:"fc_hlth",   label:"Health ins",        color:"#c084fc"},
        {key:"fc_core",   label:"Core living",       color:"#60a5fa"},
        {key:"fc_hiMins", label:"HI debt minimums",  color:"#fb923c", hideZero:true},
        {key:"fc_fam",    label:"Loan payments",     color:"#f59e0b", hideZero:true},
        {key:"fc_rop",    label:"Rental op costs",   color:"#34d399", hideZero:true},
        {key:"fc_prop",   label:"Prop tax/insurance", color:"#e879f9"},
        {key:"fc_tax",    label:"Income tax (est)",   color:"#facc15"},
        {key:"fixedTotal",label:"Total",             color:"#f87171", bold:true},
      ],
      note:"Monthly average fixed costs. Income tax uses the same federal+CO estimator as the annual engine, annualizing each month's income. Prop tax/ins covers all three properties. Free Cash is after all modeled costs.",
    },
    nw: {
      label:"Net Worth -- breakdown ($K)",
      series:[
        {key:"reValue",    label:"RE gross value", color:"#60a5fa"},
        {key:"reMortgage", label:"Mortgages",       color:"#f87171", cost:true},
        {key:"invested",   label:"Invested cash",   color:"#a78bfa"},
        {key:"sweepSavK",  label:"Sweep savings",   color:"#38bdf8", hideZero:true},
        {key:"hiDebtK",    label:"HI debt",         color:"#fb923c", cost:true},
        {key:"reEquity",   label:"RE equity",       color:"#34d399"},
        {key:"nw",         label:"Total NW",        color:"#34d399", bold:true},
      ],
      note:"NW = RE equity + invested cash + sweep savings - HI debt. RE grows at appreciation rate; invested cash and sweep savings at investment return rate.",
    },
  };

  const Chart=({title,dataKey,pinKey,color,unit,refLines,yFmt,chartId,yDomain,mainName,secondaryDataKey,secondaryColor,secondaryName,pinSecondaryKey,tertiaryDataKey,tertiaryColor,tertiaryName,quaternaryDataKey,quaternaryColor,quaternaryName,headerExtra})=>{
    const isExpanded = expandedChart===chartId;
    const bd = BREAKDOWNS[chartId];
    const fmt = yFmt||(v=>v>=1000?`${(v/1000).toFixed(0)}K`:v);
    // Stable Y domain: if yDomain provided use it, else auto
    const axisDomain = yDomain || [0,'auto'];
    // Breakdown table source: NW and Fixed Costs read chartData (their series
    // keys -- sweepSavK, fc_* -- are aggregated there from the authoritative
    // monthly wfData; liveRows has neither). Other charts read liveRows, where
    // reqWork/surplus/debt keys actually live. (v3.4.0 fix: fixedCosts read
    // liveRows and rendered $0 for every fc_* cell.)
    const bdSource = (chartId==='nw' || chartId==='fixedCosts') ? chartData : liveRows;
    const bdRows = bdSource.filter((_,i)=>i%2===0||i===bdSource.length-1); // every other year
    return (
      <div style={{background:bg1,border:`1px solid ${isExpanded?color:bdr}`,borderRadius:10,
        padding:"14px 10px 8px", gridColumn: isExpanded?"1 / -1":"auto",
        transition:"border-color 0.2s"}}>
        {/* Chart header with expand toggle */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginLeft:8,marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:11,color:muted,fontWeight:"bold"}}>{title}</div>
            {headerExtra}
            {secondaryDataKey&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:dim}}>
              <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2.5"/></svg>
              {/* v4.5.0: was a hardcoded "Free Cash" -- correct for the FCF
                  chart alone, but this header row renders for ANY chart with
                  a secondaryDataKey now (Debt Balances too), so it needs the
                  same mainName prop the tooltip/Line below already use. */}
              <span>{mainName||"Live"}</span>
              <svg width="14" height="4" style={{marginLeft:4}}><line x1="0" y1="2" x2="14" y2="2" stroke={secondaryColor||blue} strokeWidth="1.5" strokeDasharray="4 2"/></svg>
              <span>{secondaryName||"→ Swept"}</span>
            </div>}
            {tertiaryDataKey&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:dim}}>
              <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={tertiaryColor||"#f59e0b"} strokeWidth="1.5" strokeDasharray="2 2"/></svg>
              <span>{tertiaryName||"Surplus"}</span>
            </div>}
          </div>
          <button onClick={()=>setExpandedChart(isExpanded?null:chartId)} style={{
            background:isExpanded?color+"22":"transparent",border:`1px solid ${isExpanded?color:bdr}`,
            borderRadius:4,color:isExpanded?color:dim,cursor:"pointer",
            fontSize:9,padding:"2px 8px",fontFamily:font,
          }}>{isExpanded?"collapse":"breakdown"}</button>
        </div>

        {/* Scenario legend -- one entry per visible pin (+ Live), same swatch style
            as the secondary/tertiary indicators above, so every comparison chart
            (not just this one) identifies which line is which pinned scenario. */}
        {(showLive || pins.some(pin=>visiblePins.has(pin.id))) && <span style={{
          display:"flex",flexWrap:"wrap",gap:10,marginLeft:8,marginBottom:6,
        }}>
          {showLive && <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,color:dim}}>
            <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2.5"/></svg>
            <span>Live</span>
          </span>}
          {pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
            <span key={pin.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9}}>
              <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={pin.color} strokeWidth="1.5" strokeDasharray="4 3"/></svg>
              <span style={{color:pin.color}}>{pin.name}</span>
            </span>
          ))}
        </span>}

        {/* Main chart */}
        <ResponsiveContainer width="100%" height={175}>
          <LineChart data={chartData} margin={{top:4,right:12,left:0,bottom:0}}>
            <CartesianGrid {...gdP}/>
            <XAxis dataKey="year" {...axP} tickFormatter={y=>`'${String(y).slice(2)}`}/>
            <YAxis {...axP} tickFormatter={fmt} width={42} domain={axisDomain} allowDecimals={false}/>
            <Tooltip {...ttP} formatter={(v,name)=>{
              const fmtV = yFmt?yFmt(v):(unit||"$")+Math.round(v).toLocaleString();
              if(secondaryDataKey){
                const secLabel = secondaryName||"→ Swept";
                const terLabel = tertiaryName||"Surplus";
                if(name===secLabel||name===secondaryDataKey||name.endsWith("_sweep")) return [fmtV, secLabel];
                if(tertiaryDataKey&&(name===terLabel||name===tertiaryDataKey)) return [fmtV, terLabel];
                // v4.5.0: was a hardcoded `if(name==="Live") return [fmtV,"Free
                // Cash"]` here -- correct for the FCF chart (its main line
                // really is "Free Cash"), but wrong once a second chart (Debt
                // Balances) also got a secondaryDataKey, since this rewrite
                // wasn't scoped to any particular chart. The main line's own
                // `name` (mainName below, defaulting to "Live") now carries
                // the right label directly, so no rewrite is needed here.
              }
              return [fmtV, name];
            }}/>
            {refLines&&refLines.map((rl,i)=><ReferenceLine key={i} {...rl}/>)}
            {pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
              <Line key={pin.id} type="monotone" dataKey={`pin_${pin.id}_${pinKey}`}
                stroke={pin.color} strokeWidth={1} strokeDasharray="4 3"
                dot={false} isAnimationActive={false} name={pin.name}/>
            ))}
            {showLive&&<Line type="monotone" dataKey={dataKey}
              stroke={color} strokeWidth={2.5} dot={false}
              isAnimationActive={false} name={mainName||"Live"}/>}
            {showLive&&secondaryDataKey&&<Line type="monotone" dataKey={secondaryDataKey}
              stroke={secondaryColor||"#60a5fa"} strokeWidth={1.5} strokeDasharray="5 3" dot={false}
              isAnimationActive={false} name={secondaryName||secondaryDataKey}/>}
            {/* v4.5.0: pinSecondaryKey (was hardcoded "_sweep"/"sweep" -- only
                ever correct for the FCF chart's Sweep line). Opt-in per chart
                (FCF passes pinSecondaryKey="sweep", matching its existing
                chartData pin_X_sweep field unchanged) so a chart that hasn't
                wired up a per-pin secondary field (e.g. Debt Balances' LI
                loans -- not requested for pin comparison, only the live line)
                simply renders no pin secondary line, instead of a wrongly-
                labeled empty one. */}
            {secondaryDataKey&&pinSecondaryKey&&pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
              <Line key={`${pin.id}_${pinSecondaryKey}`} type="monotone" dataKey={`pin_${pin.id}_${pinSecondaryKey}`}
                stroke={pin.color} strokeWidth={1} strokeDasharray="2 4" dot={false}
                isAnimationActive={false} name={`${pin.name} ${secondaryName||pinSecondaryKey}`}/>
            ))}
            {showLive&&tertiaryDataKey&&<Line type="monotone" dataKey={tertiaryDataKey}
              stroke={tertiaryColor||"#f59e0b"} strokeWidth={1} strokeDasharray="2 2" dot={false}
              isAnimationActive={false} name={tertiaryName||"Surplus"} opacity={0.6}/>}
            {showLive&&quaternaryDataKey&&<Line type="monotone" dataKey={quaternaryDataKey}
              stroke={quaternaryColor||"#34d399"} strokeWidth={1} strokeDasharray="3 2" dot={false}
              isAnimationActive={false} name={quaternaryName||"Floor"} opacity={0.5}/>}
          </LineChart>
        </ResponsiveContainer>

        {/* Breakdown panel -- only when expanded */}
        {isExpanded&&bd&&(
          <div style={{marginTop:10,borderTop:`1px solid ${bdr}`,paddingTop:10}}>
            <div style={{fontSize:9,color:dim,marginBottom:8}}>{bd.note}</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${bdr}`}}>
                    <th style={{textAlign:"left",padding:"4px 8px",color:dim,fontWeight:"bold",whiteSpace:"nowrap"}}>Series</th>
                    {bdRows.map(r=>(
                      <th key={r.cal} style={{textAlign:"right",padding:"4px 8px",color:dim,fontWeight:"bold",
                        fontFamily:mono,whiteSpace:"nowrap"}}>{`'${String(r.cal).slice(2)}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bd.series.map(s=>{
                    const isCost = s.cost;
                    if(s.hideZero && bdRows.every(r=>(r[s.key]??0)===0)) return null;
                    return (
                      <tr key={s.key} style={{borderBottom:`1px solid ${bdr}22`,
                        background:s.bold?s.color+"11":"transparent"}}>
                        <td style={{padding:"4px 8px",whiteSpace:"nowrap"}}>
                          <span style={{display:"inline-block",width:8,height:8,borderRadius:2,
                            background:s.color,marginRight:6,verticalAlign:"middle"}}/>
                          <span style={{color:s.bold?s.color:isCost?"#f87171":muted,
                            fontWeight:s.bold?"bold":"normal"}}>{s.label}</span>
                          {isCost&&<span style={{color:dim,fontSize:8,marginLeft:4}}>(cost)</span>}
                        </td>
                        {bdRows.map(r=>{
                          const v = r[s.key]??0;
                          const disp = chartId==="nw"
                            ? (s.key==="nw"||s.key.endsWith("_nw")
                                ? (v>=0?"$"+v.toFixed(1)+"M":"-$"+Math.abs(v).toFixed(1)+"M")  // already $M
                                : (v>=0?"$"+(v/1000).toFixed(1)+"M":"-$"+(Math.abs(v)/1000).toFixed(1)+"M"))  // $K -> $M
                            : (isCost?"-$"+Math.abs(v).toLocaleString():"$"+v.toLocaleString());
                          return (
                            <td key={r.cal} style={{
                              textAlign:"right",padding:"4px 8px",
                              fontFamily:mono,color:s.bold?s.color:isCost?red:dim,
                              fontWeight:s.bold?"bold":"normal",whiteSpace:"nowrap",
                            }}>{disp}</td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };


  // -- Work Income Curve Editor (v3: graph=display, boxes=input) -------------
  const WorkCurveEditor = ({ pts, onChange }) => {
    const SVG_W=280, SVG_H=150, PAD={t:14,r:12,b:26,l:46};
    const iW=SVG_W-PAD.l-PAD.r, iH=SVG_H-PAD.t-PAD.b;
    const YR_MIN=0, YR_MAX=10, VAL_MAX=8000;
    const START=BASE.startYear;   // v4.3.0: was hardcoded 2026 -- workPts.yr is an offset from the model's start year
    // v4.6.0: quarter granularity -- workFromCurve() (engine.js) already
    // interpolates on a CONTINUOUS fractional yr (both engines already pass
    // fractional elapsed-years/months into it), so no engine change is
    // needed here -- p.yr just needed to be allowed to land on quarter
    // boundaries (whole + 0/0.25/0.5/0.75) instead of only whole numbers.
    // qOf/wholeYrOf/composeYr keep that fractional value as an exact
    // multiple of YR_STEP (0.25 is exactly representable in binary floating
    // point, so repeated +/-YR_STEP edits don't drift).
    const YR_STEP = 0.25;
    const wholeYrOf = yr => Math.floor(yr + 1e-9);
    const qOf       = yr => Math.round((yr - wholeYrOf(yr)) * 4) + 1;   // 1..4
    const composeYr = (wholeYr, q) => wholeYr + (q-1)/4;
    // Point 0 is locked at yr:0 (exactly "now", BASE.startYear/startMonth) --
    // its TRUE calendar quarter depends on startMonth, not on qOf(0) (which
    // would always read Q1). Display-only; point 0's quarter isn't editable.
    const START_Q = Math.ceil((BASE.startMonth||1)/3);

    const toX = yr  => PAD.l + (yr-YR_MIN)/(YR_MAX-YR_MIN)*iW;
    const toY = val => PAD.t + (1-val/VAL_MAX)*iH;

    // -- curve path --
    const curvePts = [];
    for(let i=0; i<=120; i++){
      const yr = YR_MIN + (YR_MAX-YR_MIN)*i/120;
      curvePts.push([toX(yr), toY(workFromCurve(yr, pts))]);
    }
    const curvePath = curvePts.map((p,i)=>(i===0?`M`:` L`)+p[0].toFixed(1)+','+p[1].toFixed(1)).join('');

    const xTicks=[0,2,4,6,8,10];
    const yTicks=[0,2000,4000,6000,8000];

    // -- add/remove points --
    const addPoint = () => {
      if(pts.length >= 6) return;
      let best=0, bestGap=0;
      for(let i=0;i<pts.length-1;i++){
        const g=pts[i+1].yr-pts[i].yr; if(g>bestGap){bestGap=g;best=i;}
      }
      // v4.6.0: snap to nearest QUARTER (was nearest whole year) -- matches
      // the new quarter-precision editing below.
      const midYr  = Math.round((pts[best].yr+pts[best+1].yr)/2/YR_STEP)*YR_STEP;
      const midVal = Math.round(workFromCurve(midYr, pts)/100)*100;
      onChange([...pts.slice(0,best+1), {yr:midYr, val:midVal}, ...pts.slice(best+1)]);
    };
    const removePoint = () => {
      if(pts.length <= 2) return;
      onChange(pts.filter((_,i) => i !== Math.floor(pts.length/2)));
    };

    // -- update a single point field --
    const updatePt = (i, field, raw) => {
      const num = parseInt(raw.replace(/[^0-9]/g,''), 10);
      if(isNaN(num)) return;
      const newPts = pts.map((p, j) => {
        if(j !== i) return p;
        if(field === 'yr') {
          // Clamp year between neighbours, convert calendar year to offset.
          // v4.6.0: the year TEXT INPUT still only edits the whole-year part
          // (parseInt strips non-digits, so it can't parse "2027.25" or
          // "2027 Q2" -- quarter is a separate control, updatePtQuarter
          // below) -- preserve the point's existing quarter when the year
          // field alone changes. Neighbour gap shrunk from a full year to
          // YR_STEP (one quarter) to match quarter-precision editing.
          const offset = Math.max(0, Math.min(YR_MAX, num - START));
          const newYr = composeYr(offset, qOf(p.yr));
          const lo = j===0 ? 0 : pts[j-1].yr+YR_STEP;
          const hi = j===pts.length-1 ? YR_MAX : pts[j+1].yr-YR_STEP;
          return {...p, yr: Math.max(lo, Math.min(hi, newYr))};
        } else {
          return {...p, val: Math.max(0, Math.min(VAL_MAX, num))};
        }
      });
      onChange(newPts);
    };
    // v4.6.0: quarter selector (separate from updatePt -- driven by a button
    // click with an exact 1-4 value, not free-text parsing) -- preserves the
    // point's existing whole-year part, only moves it within that year.
    const updatePtQuarter = (i, q) => {
      const newPts = pts.map((p, j) => {
        if(j !== i) return p;
        const newYr = composeYr(wholeYrOf(p.yr), q);
        const lo = j===0 ? 0 : pts[j-1].yr+YR_STEP;
        const hi = j===pts.length-1 ? YR_MAX : pts[j+1].yr-YR_STEP;
        return {...p, yr: Math.max(lo, Math.min(hi, newYr))};
      });
      onChange(newPts);
    };

    const inputStyle = {
      background: bg2, border:`1px solid ${bdr}`, borderRadius:3,
      color:amber, fontFamily:mono, fontSize:9, padding:"2px 4px",
      width:"100%", textAlign:"center", outline:"none",
    };
    const focusStyle = `1px solid ${amber}`;

    return (
      <div style={{userSelect:"none"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:10,color:muted,fontWeight:"bold"}}>Work Income Curve</span>
          <div style={{display:"flex",gap:5}}>
            <button onClick={removePoint} disabled={pts.length<=2} style={{
              fontSize:9,padding:"2px 8px",borderRadius:3,
              cursor:pts.length<=2?"default":"pointer",fontFamily:font,
              background:"transparent",border:`1px solid ${bdr}`,color:pts.length<=2?bdr:dim
            }}>- point</button>
            <button onClick={addPoint} disabled={pts.length>=6} style={{
              fontSize:9,padding:"2px 8px",borderRadius:3,
              cursor:pts.length>=6?"default":"pointer",fontFamily:font,
              background:"transparent",border:`1px solid ${bdr}`,color:pts.length>=6?bdr:dim
            }}>+ point</button>
          </div>
        </div>

        {/* Chart -- display only */}
        <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{display:"block",pointerEvents:"none"}}>

          {yTicks.map(v=>(
            <g key={v}>
              <line x1={PAD.l} x2={SVG_W-PAD.r} y1={toY(v)} y2={toY(v)} stroke={bdr} strokeWidth={0.5}/>
              <text x={PAD.l-4} y={toY(v)+3} textAnchor="end" fontSize={7} fill={dim}>
                {v===0?"$0":v>=1000?`$${v/1000}K`:v}
              </text>
            </g>
          ))}
          {xTicks.map(yr=>(
            <g key={yr}>
              <line x1={toX(yr)} x2={toX(yr)} y1={PAD.t} y2={SVG_H-PAD.b} stroke={bdr} strokeWidth={0.5}/>
              <text x={toX(yr)} y={SVG_H-PAD.b+10} textAnchor="middle" fontSize={7} fill={dim}>
                {START+yr}
              </text>
            </g>
          ))}



          {/* Area + curve */}
          <path d={curvePath+` L${toX(YR_MAX)},${toY(0)} L${toX(YR_MIN)},${toY(0)} Z`}
            fill={amber} fillOpacity={0.1}/>
          <path d={curvePath} fill="none" stroke={amber} strokeWidth={2} strokeLinecap="round"/>

          {/* Dots on control points */}
          {pts.map((p,i)=>(
            <circle key={i} cx={toX(p.yr)} cy={toY(p.val)} r={4}
              fill={bg1} stroke={amber} strokeWidth={2}/>
          ))}
        </svg>

        {/* Input boxes -- one per control point */}
        <div style={{display:"grid", gridTemplateColumns:`repeat(${pts.length}, 1fr)`, gap:4, marginTop:6}}>
          {pts.map((p,i)=>(
            <div key={i} style={{
              background:bg2, border:`1px solid ${bdr}`, borderRadius:5,
              padding:"5px 4px", display:"flex", flexDirection:"column", gap:3
            }}>
              {/* Year input -- first point locked */}
              <div style={{fontSize:7,color:dim,textAlign:"center",marginBottom:1}}>year</div>
              <input
                type="text"
                defaultValue={START+wholeYrOf(p.yr)}
                key={`yr-${i}-${START+wholeYrOf(p.yr)}`}
                disabled={i===0}
                style={{...inputStyle, color: i===0?dim:amber, opacity: i===0?0.5:1}}
                onFocus={e=>e.target.style.border=focusStyle}
                onBlur={e=>{e.target.style.border=`1px solid ${bdr}`; updatePt(i,'yr',e.target.value);}}
                onKeyDown={e=>{if(e.key==='Enter'){e.target.blur();}}}
              />
              {/* v4.6.0: quarter selector -- point 0 shows its TRUE calendar
                  quarter (from BASE.startMonth) but isn't editable, since
                  point 0 is always exactly "now". Lets a work-income change
                  line up with the same quarter a property sale is scheduled
                  in (property sales already use this Q1-4 granularity). */}
              <div style={{fontSize:7,color:dim,textAlign:"center",marginBottom:1}}>qtr</div>
              <div style={{display:"flex",gap:1}}>
                {[1,2,3,4].map(q=>{
                  const active = (i===0 ? START_Q : qOf(p.yr)) === q;
                  return (
                    <button key={q} type="button" disabled={i===0}
                      onClick={()=>updatePtQuarter(i,q)}
                      style={{
                        flex:1, fontSize:7, padding:"2px 0", borderRadius:2,
                        cursor: i===0 ? "default" : "pointer", fontFamily:font,
                        border:`1px solid ${active?amber:bdr}`,
                        background: active ? amber+"33" : "transparent",
                        color: active ? amber : dim,
                        opacity: i===0 ? 0.5 : 1,
                      }}>{q}</button>
                  );
                })}
              </div>
              {/* Value input */}
              <div style={{fontSize:7,color:dim,textAlign:"center",marginBottom:1}}>$/mo</div>
              <input
                type="text"
                defaultValue={p.val.toLocaleString()}
                key={`val-${i}-${p.val}`}
                style={inputStyle}
                onFocus={e=>{e.target.select(); e.target.style.border=focusStyle;}}
                onBlur={e=>{e.target.style.border=`1px solid ${bdr}`; updatePt(i,'val',e.target.value);}}
                onKeyDown={e=>{if(e.key==='Enter'){e.target.blur();}}}
              />
            </div>
          ))}
        </div>
        <div style={{fontSize:8,color:dim,marginTop:4}}>
          Click a value to edit -- press Enter or click away to apply. Tap a quarter to align a point with a property-sale timing.
        </div>
      </div>
    );
  };


    return (
    <div style={{background:bg0,minHeight:"100vh",width:"100%",boxSizing:"border-box",fontFamily:font,color:bright,padding:16}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <div style={{fontSize:20,fontWeight:"bold",letterSpacing:0.5}}>Retirement Simulator</div>
            <div style={{fontSize:10,color:dim,fontFamily:mono,letterSpacing:0.5}}>v5.0.5</div>
          </div>
          <div style={{fontSize:11,color:muted,marginTop:2}}>Drag sliders to explore -- pin scenarios to compare</div>
        </div>
        <div style={{fontSize:10,color:dim,textAlign:"right"}}>
          {/* v4.3.0: was a static "Launch Jun 2026 - Ages 65/60" -- now reads
              the actual Defaults-tab start-date/age settings, since a stale
              hardcoded date here was part of what this version fixes.
              v4.4.0: ages are now birth-date-derived (was the static
              BASE.myAge/wifeAge:65/60, which had drifted stale -- Bob is
              actually 64 and Brenda 59 at the current Jul-2026 start date). */}
          Launch {MONTH_ABBR[BASE.startMonth-1]} {BASE.startYear} &middot; Ages {Math.floor(ssClaimAge(BASE.startYear,BASE.startMonth,BASE.yourBirthYear,BASE.yourBirthMonth))}/{Math.floor(ssClaimAge(BASE.startYear,BASE.startMonth,BASE.brendaBirthYear,BASE.brendaBirthMonth))}<br/>
          {"$"}{Math.round(HI_TOTAL/1000)}K HI debt at start
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,borderBottom:`1px solid ${bdr}`,marginBottom:14}}>
        {[["simulator","Simulator"],["cashflow","Cash Flow"],["defaults","Defaults"],["relationships","Input / Output Map"],["glossary","Glossary"]].map(([key,label])=>(
          <button key={key} onClick={()=>setActiveTab(key)} style={{
            padding:"8px 18px",border:"none",cursor:"pointer",fontFamily:font,fontSize:12,
            background:"transparent",color:activeTab===key?bright:muted,
            borderBottom:activeTab===key?`2px solid ${blue}`:"2px solid transparent",
            marginBottom:-1,transition:"all 0.2s",
          }}>{label}</button>
        ))}
      </div>

      {/* ====== SIMULATOR TAB ====== */}
      {activeTab==="simulator" && (
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:14}}>

        {/* -- LEFT: CONTROLS ---------------------------- */}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:"14px 14px 16px",overflowY:"auto",maxHeight:"calc(100vh - 120px)"}}>

            {/* -- LOAD PINNED SCENARIO INTO EDITOR -- */}
            {pins.filter(p=>visiblePins.has(p.id)).length>0&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,color:dim,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Load into editor</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {pins.filter(p=>visiblePins.has(p.id)).map(pin=>(
                    <button key={pin.id} onClick={()=>loadPinIntoLive(pin)} style={{
                      background:"transparent",
                      border:`1px solid ${pin.color}`,
                      borderRadius:12,color:pin.color,
                      cursor:"pointer",fontSize:10,padding:"3px 10px",fontFamily:font,
                      maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    }}>{pin.name}</button>
                  ))}
                </div>
                <div style={{fontSize:9,color:dim,marginTop:4,fontStyle:"italic"}}>
                  Loads this pin's params into the editor below (overwrites current edits). Pin under the same name to save changes back, or a new name to branch.
                </div>
              </div>
            )}

            {/* ============================================================
                v4.0.0-B property-centric sidebar. Each property is a
                collapsible card: mode/year/quarter, then unit segment
                editors, then the disposition block (mode != keep only),
                then a per-property proceeds summary. Cost Profiles, One-
                Time Obligation, Loans & Debt, Cash-Flow Engine, and
                Economy follow as their own groups below.
                ============================================================ */}
            {sect("Properties")}
            <div style={{fontSize:9,color:dim,marginBottom:10,lineHeight:1.5}}>
              Each property owns its hold/sell decision, its units, each unit's income
              segments, and its disposition tax block. Sale timing granularity is the
              quarter. Overlapping segments SUM on a unit, except LTR (exclusive --
              a tenant occupies the whole unit).
            </div>

            {properties.map(prop=>{
              const hold = prop.hold||{};
              const isSold = hold.mode && hold.mode!=='keep';
              const engineRes = liveRows.dispoResults?.[prop.id];
              const isOpen = propCardOpen[prop.id] !== false;
              const modeOpts = prop.isPrimary
                ? [{v:'keep',l:'Keep',c:dim},{v:'sell',l:'Sell',c:red}]
                : [{v:'keep',l:'Keep',c:dim},{v:'sell',l:'Sell',c:red},
                   {v:'full_1031',l:'Full 1031',c:blue},{v:'partial_1031',l:'Partial 1031',c:blue}];
              return (
                <div key={prop.id} data-testid={`property-${prop.id}-card`} style={{background:bg2,border:`1px solid ${bdr}`,borderRadius:6,padding:10,marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isOpen?8:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button data-testid={`property-${prop.id}-collapse`}
                        onClick={()=>setPropCardOpen(o=>({...o,[prop.id]:!isOpen}))}
                        style={{fontSize:9,padding:"2px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                          background:"transparent",border:`1px solid ${bdr}`,color:dim}}>
                        {isOpen?"▾":"▸"}
                      </button>
                      <span style={{fontSize:11,color:bright,fontWeight:"bold"}}>{prop.label}{prop.isPrimary?" (primary -- §121, no 1031)":""}</span>
                    </div>
                    {isSold && <span data-testid={`sold-badge-${prop.id}`} style={{fontSize:9,color:red,fontFamily:mono,fontWeight:"bold"}}>SOLD {hold.mode} · Q{hold.quarter||1} {hold.year}</span>}
                  </div>

                  {isOpen && (<>
                  {/* Value + mortgage -- basic property attributes. Range is anchored to this
                      property's *default* value (not its live value) so it stays fixed while
                      dragging -- top end capped at 5x default per user request (v4.2.1/v4.2.2). */}
                  {sliderTypeIn("Property value",prop.value||0,v=>setProperty(prop.id,{value:v}),
                    Math.round((defaultPropValueById[prop.id]||prop.value||500000)*0.5),
                    Math.round((defaultPropValueById[prop.id]||prop.value||500000)*5),
                    5000,v=>"$"+Math.round(v/1000)+"K",
                    v=>String(Math.round(v/1000)),t=>Math.round(parseFloat(t)*1000),
                    `prop-value-${prop.id}`)}
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,color:muted,fontWeight:"bold",marginBottom:6}}>Mortgage</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        ["Balance $","balance",v=>parseFloat(v)],
                        ["Rate (decimal)","rate",v=>parseFloat(v)],
                        ["Origin year","originYear",v=>parseInt(v)],
                        ["Origin month","originMonth",v=>parseInt(v)],
                        ["Term (yrs)","termYears",v=>parseInt(v)],
                        ["IO years","ioYears",v=>parseInt(v)],
                      ].map(([label,field,parse])=>(
                        <div key={field}>
                          <div style={{fontSize:8,color:dim,marginBottom:2}}>{label}</div>
                          <input data-testid={`mtg-${prop.id}-${field}`} type="number" step="any"
                            value={prop.mortgage?.[field] ?? 0}
                            onChange={e=>setPropertyMortgage(prop.id,{[field]:parse(e.target.value)})}
                            style={{width:"100%",background:bg1,border:`1px solid ${bdr}`,borderRadius:4,
                              color:bright,fontFamily:mono,fontSize:10,padding:"3px 6px",outline:"none"}}/>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hold/sell: mode + year + quarter */}
                  <div style={{marginTop:8,paddingTop:8,borderTop:`1px dashed ${bdr}`}}>
                    <div data-testid={`mode-toggle-${prop.id}`} style={{marginBottom:8}}>
                      {toggle(hold.mode||'keep', v=>setPropertyHold(prop.id,{mode:v}), modeOpts)}
                    </div>
                    {isSold && (<>
                      <div data-testid={`sale-year-slider-${prop.id}`}>
                        {/* v4.3.0: BASE.startYear/+20 (was hardcoded 2026/2046) -- can't schedule a
                            sale before the model's own start date, and the horizon is BASE.startYear+20. */}
                        {slider("Sale year",hold.year||BASE.startYear,v=>setPropertyHold(prop.id,{year:v}),BASE.startYear,BASE.startYear+20,1,v=>v+"")}
                      </div>
                      <div>
                        <div style={{fontSize:9,color:muted,marginBottom:3}}>Sale quarter (assumed at quarter boundary)</div>
                        <div data-testid={`sale-quarter-toggle-${prop.id}`}>
                          {toggle(hold.quarter||1, v=>setPropertyHold(prop.id,{quarter:v}), [1,2,3,4].map(q=>({v:q,l:'Q'+q})))}
                        </div>
                      </div>
                    </>)}
                  </div>

                  {/* Units + segment editors */}
                  <div style={{marginTop:10,paddingTop:8,borderTop:`1px dashed ${bdr}`}}>
                    <div style={{fontSize:9,color:muted,fontWeight:"bold",marginBottom:6}}>Units</div>
                    {prop.units.map((unit,unitIdx)=>{
                      const segs = unit.segments||[];
                      const segErrors = validateUnitSegments(segs);
                      const segOverlaps = unitSegmentOverlaps(segs);
                      const updSeg = (ei,patch)=>setUnitSegments(prop.id,unitIdx,list=>list.map((x,j)=>j===ei?{...x,...patch}:x));
                      return (
                        <div key={unit.id} data-testid={`unit-${unit.id}`} style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:6,padding:8,marginBottom:8}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontSize:10,color:bright,fontWeight:"bold"}}>{unit.label}</span>
                            <button data-testid={`seg-add-${unit.id}`}
                              onClick={()=>setUnitSegments(prop.id,unitIdx,list=>{
                                const prev=list[list.length-1];
                                // v4.3.0: BASE.startYear/+20 (was hardcoded 2026/2046)
                                const yrFrom=prev?Math.min(BASE.startYear+20,(prev.yrTo||prev.yrFrom||BASE.startYear)+1):BASE.startYear;
                                return [...list,{yrFrom, yrTo:Math.min(BASE.startYear+20,yrFrom+1), kind:'ltr',
                                  str:[{days:120,rate:280,type:"nightly"}], mtr:[{months:10,rate:3000}], ltr:{monthlyRent:3000}}];
                              })}
                              style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,
                                background:"transparent",border:`1px solid ${bdr}`,color:dim,cursor:"pointer"}}>
                              + add segment
                            </button>
                          </div>
                          {segs.length===0 && (
                            <div style={{fontSize:9,color:bdr,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>No segments -- no income</div>
                          )}
                          {segs.map((seg,ei)=>{
                            const kColor = seg.kind==='str'?amber:seg.kind==='mtr'?blue:green;
                            const gross = unitSegmentGross(seg);
                            const clip = segmentClipInfo(seg, hold);
                            const costNote = seg.kind==='str'
                              ? `${strPlatformPct}% platform + ${strCleanPct}% cleaning${mgrPct>0?` + ${mgrPct}% mgmt`:''}`
                              : seg.kind==='mtr'
                              ? `$${mtrCleaningFlat}/block cleaning${mgrPct>0?` + ${mgrPct}% mgmt`:''}`
                              : `${ltrVacancyPct}% vacancy${mgrPct>0?` + ${mgrPct}% mgmt`:''}, no cleaning charge`;
                            return (
                              <div key={ei} data-testid={`seg-${unit.id}-${ei}`} style={{background:bg2,border:`1px solid ${kColor}55`,borderRadius:6,padding:8,marginBottom:6}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                  <span style={{fontSize:9,color:kColor,fontWeight:"bold"}}>{seg.yrFrom}–{seg.yrTo} — {seg.kind.toUpperCase()} — ${Math.round(gross/12).toLocaleString()}/mo avg</span>
                                  <button onClick={()=>setUnitSegments(prop.id,unitIdx,list=>list.filter((_,j)=>j!==ei))}
                                    style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                                      background:"transparent",border:`1px solid ${bdr}`,color:dim}}>remove</button>
                                </div>
                                <div style={{display:"flex",gap:8,marginBottom:6}}>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:8,color:dim,marginBottom:2}}>From {seg.yrFrom}</div>
                                    <input type="range" min={BASE.startYear} max={BASE.startYear+20} step={1} value={seg.yrFrom}
                                      onChange={e=>{const v=parseInt(e.target.value);updSeg(ei,{yrFrom:v,yrTo:Math.max(v,seg.yrTo)});}}
                                      style={{width:"100%",accentColor:kColor,cursor:"pointer",height:4}}/>
                                  </div>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:8,color:dim,marginBottom:2}}>To {seg.yrTo}</div>
                                    <input type="range" min={BASE.startYear} max={BASE.startYear+20} step={1} value={seg.yrTo}
                                      onChange={e=>{const v=parseInt(e.target.value);updSeg(ei,{yrTo:v,yrFrom:Math.min(seg.yrFrom,v)});}}
                                      style={{width:"100%",accentColor:kColor,cursor:"pointer",height:4}}/>
                                  </div>
                                </div>
                                <div style={{marginBottom:4}}>
                                  {toggle(seg.kind,v=>updSeg(ei,{kind:v}),[
                                    {v:'str',l:'STR',c:amber},{v:'mtr',l:'MTR',c:blue},{v:'ltr',l:'LTR',c:green}
                                  ])}
                                </div>
                                <div style={{fontSize:8,color:dim,fontStyle:"italic",marginBottom:6}}>Cost profile: {costNote}</div>
                                {seg.kind==='str' && (seg.str||[]).map((g,si)=>(
                                  <div key={si} style={{marginBottom:6}}>
                                    <div style={{display:"flex",justifyContent:"space-between"}}>
                                      <span style={{fontSize:8,color:muted}}>Days</span>
                                      <span style={{fontSize:8,color:amber,fontFamily:mono}}>{g.days}d</span>
                                    </div>
                                    <input type="range" min={0} max={365} step={5} value={g.days}
                                      onChange={e=>updSeg(ei,{str:seg.str.map((x,k)=>k===si?{...x,days:parseInt(e.target.value)}:x)})}
                                      style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                                    <div style={{display:"flex",justifyContent:"space-between"}}>
                                      <span style={{fontSize:8,color:muted}}>Rate/night</span>
                                      <span style={{fontSize:8,color:amber,fontFamily:mono}}>${g.rate}</span>
                                    </div>
                                    <input type="range" min={100} max={1200} step={10} value={g.rate}
                                      onChange={e=>updSeg(ei,{str:seg.str.map((x,k)=>k===si?{...x,rate:parseInt(e.target.value)}:x)})}
                                      style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                                  </div>
                                ))}
                                {seg.kind==='mtr' && (seg.mtr||[]).map((g,si)=>(
                                  <div key={si} style={{marginBottom:6}}>
                                    <div style={{display:"flex",justifyContent:"space-between"}}>
                                      <span style={{fontSize:8,color:muted}}>Months</span>
                                      <span style={{fontSize:8,color:blue,fontFamily:mono}}>{g.months}mo</span>
                                    </div>
                                    <input type="range" min={1} max={12} step={1} value={g.months}
                                      onChange={e=>updSeg(ei,{mtr:seg.mtr.map((x,k)=>k===si?{...x,months:parseInt(e.target.value)}:x)})}
                                      style={{width:"100%",accentColor:blue,cursor:"pointer",height:4}}/>
                                    <div style={{display:"flex",justifyContent:"space-between"}}>
                                      <span style={{fontSize:8,color:muted}}>Rate/mo</span>
                                      <span style={{fontSize:8,color:blue,fontFamily:mono}}>${g.rate}</span>
                                    </div>
                                    <input type="range" min={2000} max={12000} step={250} value={g.rate}
                                      onChange={e=>updSeg(ei,{mtr:seg.mtr.map((x,k)=>k===si?{...x,rate:parseInt(e.target.value)}:x)})}
                                      style={{width:"100%",accentColor:blue,cursor:"pointer",height:4}}/>
                                  </div>
                                ))}
                                {seg.kind==='ltr' && sliderTypeIn("Monthly rent",seg.ltr?.monthlyRent||0,
                                  v=>updSeg(ei,{ltr:{...(seg.ltr||{}),monthlyRent:v}}),
                                  1000,12000,50,v=>"$"+v.toLocaleString()+"/mo",
                                  v=>String(v),t=>parseFloat(t),
                                  `ltr-rent-${unit.id}-${ei}`,green,8)}
                                {clip && clip.truncated && (
                                  <div style={{fontSize:8,color:blue,fontStyle:"italic"}}>ⓘ truncated at Q{hold.quarter||1} {hold.year} sale</div>
                                )}
                              </div>
                            );
                          })}
                          {segOverlaps.length>0 && (
                            <div data-testid={`seg-overlap-info-${unit.id}`} style={{fontSize:9,color:blue,background:blue+"11",border:`1px solid ${blue}33`,borderRadius:5,padding:"6px 8px",marginTop:4}}>
                              {segOverlaps.map((o,i)=>(
                                <div key={i}>ⓘ {o.yrFrom===o.yrTo?o.yrFrom:`${o.yrFrom}–${o.yrTo}`}: concurrent segments — combined gross ${Math.round(o.combinedGross/1000)}K/yr</div>
                              ))}
                            </div>
                          )}
                          {segErrors.length>0 && (
                            <div data-testid={`seg-errors-${unit.id}`} style={{fontSize:9,color:red,background:red+"11",border:`1px solid ${red}44`,borderRadius:5,padding:"6px 8px",marginTop:4}}>
                              {segErrors.map((e,i)=><div key={i}>&#9888; {e}</div>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Disposition block -- only when mode != keep */}
                  {isSold && (
                    <div style={{marginTop:10,paddingTop:8,borderTop:`1px dashed ${bdr}`}}>
                      <div style={{fontSize:9,color:muted,fontWeight:"bold",marginBottom:6}}>Disposition</div>
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:9,color:muted,marginBottom:3}}>Sale mode</div>
                        {toggle(hold.saleMode||'market', v=>setPropertyHold(prop.id,{saleMode:v}), [
                          {v:'market',l:'Market'},{v:'forced',l:'Forced (-15%)',c:red}
                        ])}
                      </div>
                      {slider("Adjusted basis",hold.basis||0,v=>setPropertyHold(prop.id,{basis:v}),
                        Math.round((hold.basis||400000)*0.5),Math.round((hold.basis||400000)*1.5),5000,v=>"$"+Math.round(v/1000)+"K")}
                      {prop.isPrimary && slider("§121 exclusion",hold.sec121Exclusion||0,v=>setPropertyHold(prop.id,{sec121Exclusion:v}),0,500000,10000,v=>"$"+Math.round(v/1000)+"K")}
                      {!prop.isPrimary && slider("CA-source deferred gain",hold.caSourceDeferredGain||0,v=>setPropertyHold(prop.id,{caSourceDeferredGain:v}),0,Math.max(10000,(hold.caSourceDeferredGain||0)*1.5),5000,v=>"$"+Math.round(v/1000)+"K")}
                      {!prop.isPrimary && slider("Depreciation recapture $",hold.depreciationRecapture||0,v=>setPropertyHold(prop.id,{depreciationRecapture:v}),0,Math.max(60000,(hold.depreciationRecapture||0)*1.5),1000,v=>"$"+Math.round(v/1000)+"K")}
                      {hold.mode==='partial_1031' && slider("Cash boot",hold.cashBoot||0,v=>setPropertyHold(prop.id,{cashBoot:v}),0,500000,5000,v=>"$"+Math.round(v/1000)+"K")}
                    </div>
                  )}

                  {/* Per-property proceeds summary + itemized Disposition breakdown sub-card (v4.2.6) */}
                  {isSold && engineRes && engineRes.mode && engineRes.mode!=='keep' && (()=>{
                    const noOffsetRes = liveRows.dispoResultsNoOffset?.[prop.id] || engineRes;
                    const breakdownOpen = dispoBreakdownOpen[prop.id] === true;
                    return (
                    <div style={{marginTop:8,padding:8,background:bg1,borderRadius:4,fontSize:9}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                        <div style={{color:dim,fontWeight:"bold"}}>Proceeds summary (vs CPA sheet):</div>
                        <button data-testid={`dispo-breakdown-toggle-${prop.id}`}
                          onClick={()=>setDispoBreakdownOpen(o=>({...o,[prop.id]:!breakdownOpen}))}
                          style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                            background:"transparent",border:`1px solid ${bdr}`,color:dim}}>
                          {breakdownOpen?"▲ hide breakdown":"▾ itemized breakdown"}
                        </button>
                      </div>
                      <div style={{color:muted}}>Sale price (entered — no appreciation applied): <span style={{color:bright,fontFamily:mono}}>${Math.round((engineRes.grossPrice||0)/1000)}K</span></div>
                      <div style={{color:muted}}>Tax: <span style={{color:bright,fontFamily:mono}}>${Math.round((engineRes.totalTax||0)/1000)}K</span> vs CPA ${Math.round((hold.cpaEstTax||0)/1000)}K</div>
                      <div style={{color:muted}}>Net: <span style={{color:bright,fontFamily:mono}}>${Math.round((engineRes.afterTaxNetProceeds||0)/1000)}K</span> vs CPA ${Math.round((hold.cpaNetProceedsAfterTax||0)/1000)}K</div>
                      {breakdownOpen && renderDispoBreakdown(prop, hold, engineRes, noOffsetRes)}
                    </div>
                    );
                  })()}
                  </>)}
                </div>
              );
            })}

            {/* Cost profiles -- applied automatically by segment kind (§1 table), trailer of the Properties group */}
            {collapsibleSect("Cost Profiles", costProfilesOpen, ()=>setCostProfilesOpen(o=>!o))}
            {costProfilesOpen && (<>
            <div style={{fontSize:8,color:dim,marginBottom:8}}>Applied automatically by segment kind: STR = platform% + cleaning%; MTR = flat $/block cleaning; LTR = vacancy%. Mgmt fee applies to all three.</div>
            {slider("STR platform fee",strPlatformPct,setStrPlatformPct,0,10,0.5,v=>v+"%")}
            {slider("STR cleaning (% of gross)",strCleanPct,setStrCleanPct,0,10,0.5,v=>v+"%")}
            {slider("MTR cleaning (flat $/block)",mtrCleaningFlat,setMtrCleaningFlat,0,1000,25,v=>"$"+v)}
            {slider("LTR vacancy/collection loss",ltrVacancyPct,setLtrVacancyPct,0,15,0.5,v=>v+"%")}
            {slider("Mgmt fee (all kinds)",mgrPct,setMgrPct,0,12,0.5,v=>v===0?"Self-managed":v+"% of gross")}
            </>)}

            {/* One-Time Obligation (was Settlement) */}
            {sect("One-Time Obligation")}
            <div style={{fontSize:8,color:dim,marginBottom:8}}>When on, the obligation amount reduces that year's recognized capital gains (capped at the gains pool) -- the Kimbell/Arrowsmith position, now assumed fully applied.</div>
            {slider("Amount",obligation.amount||0,v=>setObligation({amount:v}),262500,787500,5000,v=>"$"+Math.round(v/1000)+"K")}
            {/* v4.3.0: BASE.startYear/+20 (was hardcoded 2026/2046) */}
            {slider("Year",obligation.year||BASE.startYear,v=>setObligation({year:v}),BASE.startYear,BASE.startYear+20,1,v=>v+"")}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:muted,marginBottom:3}}>Quarter</div>
              {toggle(obligation.quarter||1, v=>setObligation({quarter:v}), [1,2,3,4].map(q=>({v:q,l:'Q'+q})))}
            </div>
            <div style={{marginBottom:8}}>
              {toggle(obligation.offsetsCapitalGains!==false, v=>setObligation({offsetsCapitalGains:v}), [
                {v:true,l:'Offsets capital gains',c:green},{v:false,l:'No offset',c:dim}
              ])}
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:muted,marginBottom:3}}>Same-year all-properties-sold tax bump</div>
              {toggle(sameYearSaleTaxBumpOn, setSameYearSaleTaxBumpOn, [
                {v:true,l:'On (+$'+Math.round((sameYearSaleTaxBump||0)/1000)+'K)',c:amber},
                {v:false,l:'Off',c:dim}
              ])}
            </div>

            {/* Loans & Debt (collapsible): HI debts + generalized loan segments (v3.2) */}
            {collapsibleSect("Loans & Debt", loansDebtOpen, ()=>setLoansDebtOpen(o=>!o))}
            {loansDebtOpen && (<>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>HI Debt Balances</div>
              <div style={{
                background:bg2,border:`1px solid ${bdr}`,borderRadius:7,
                padding:"8px 10px",marginTop:8
              }}>
                {[
                  {label:"Credit Card", bal:ccBal, setBal:setCcBal, rate:ccRate, setRate:setCcRate, min:ccMin, setMin:setCcMin, balMax:120000, rateMax:29, closingEligible:ccClosingEligible, setClosingEligible:setCcClosingEligible, testId:"cc"},
                  {label:"Sophia Loans", bal:sophiaBal, setBal:setSophiaBal, rate:sophiaRate, setRate:setSophiaRate, min:sophiaMin, setMin:setSophiaMin, balMax:150000, rateMax:15, closingEligible:sophiaClosingEligible, setClosingEligible:setSophiaClosingEligible, testId:"sophia"},
                  {label:"Nolan Loans", bal:nolanBal, setBal:setNolanBal, rate:nolanRate, setRate:setNolanRate, min:nolanMin, setMin:setNolanMin, balMax:300000, rateMax:15, closingEligible:nolanClosingEligible, setClosingEligible:setNolanClosingEligible, testId:"nolan"},
                ].map(({label,bal,setBal,rate,setRate,min,setMin,balMax,rateMax,closingEligible,setClosingEligible,testId})=>(
                  <div key={label} style={{marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${bdr}44`}}>
                    <div style={{fontSize:9,color:amber,fontWeight:"bold",marginBottom:5}}>{label}</div>
                    <div style={{marginBottom:4}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:9,color:muted}}>Balance</span>
                        <span style={{fontSize:9,color:amber,fontFamily:mono}}>${bal.toLocaleString()}</span>
                      </div>
                      <input type="range" min={0} max={balMax} step={500} value={bal}
                        onChange={e=>setBal(parseInt(e.target.value))}
                        style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:8,color:dim}}>Rate</span>
                          <span style={{fontSize:8,color:dim,fontFamily:mono}}>{rate.toFixed(1)}%</span>
                        </div>
                        <input type="range" min={3} max={rateMax} step={0.25} value={rate}
                          onChange={e=>setRate(parseFloat(e.target.value))}
                          style={{width:"100%",accentColor:amber,cursor:"pointer",height:3}}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:8,color:dim}}>Min/mo</span>
                          <span style={{fontSize:8,color:dim,fontFamily:mono}}>${min}</span>
                        </div>
                        <input type="range" min={0} max={3000} step={25} value={min}
                          onChange={e=>setMin(parseInt(e.target.value))}
                          style={{width:"100%",accentColor:amber,cursor:"pointer",height:3}}/>
                      </div>
                    </div>
                    <div style={{marginTop:6}} data-testid={`hi-closing-${testId}`}>
                      <div style={{fontSize:8,color:dim,marginBottom:3}}>Retire at property-sale closing (one-time lump-sum)</div>
                      {toggle(!!closingEligible, setClosingEligible, [
                        {v:false,l:"Sweep over time"},{v:true,l:"Closing-eligible",c:amber}
                      ])}
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:dim,marginTop:2}}>
                  <span>Total HI debt</span>
                  <span style={{color:red,fontFamily:mono}}>${(ccBal+sophiaBal+nolanBal).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* -- Loans (v3.2.0 generalized segments, replaces family-loan params) -- */}
            <div style={{marginTop:12,marginBottom:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:10,color:muted,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>Loans</span>
                <button data-testid="loan-add"
                  onClick={()=>setLoans(list=>[...list,{label:`Loan ${list.length+1}`,amount:25000,startYear:BASE.startYear,startMonth:BASE.startMonth,months:12,rate:7.5,sweepable:false,closingEligible:false}])}
                  style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,
                    background:"transparent",border:`1px solid ${bdr}`,color:dim,cursor:"pointer"}}>
                  + add loan
                </button>
              </div>
              <div style={{fontSize:8,color:dim,marginBottom:8}}>
                Amortized payment from start month for the term; payment lands in Fixed costs -- these are
                low-interest (LI) loans: simple amortizing only, not mortgage-style IO/recast. Off by default,
                a loan can independently opt into "Sweepable" (joins the ongoing surplus-sweep avalanche by
                rate) and/or "Closing-eligible" (also retired by a property-sale lump-sum, highest-rate-first
                alongside HI debt) -- rate decides payoff ORDER only, not which tier a loan is in.
              </div>
              {loans.length===0&&(
                <div style={{fontSize:9,color:bdr,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>No loans</div>
              )}
              {loans.map((L,li)=>{
                const pmt = loanMonthlyPmt(L.amount||0,(L.rate||0)/100,L.months||0);
                const updL = patch=>setLoans(list=>list.map((x,j)=>j===li?{...x,...patch}:x));
                return (
                  <div key={li} data-testid={`loan-row-${li}`} style={{background:bg2,border:`1px solid ${amber}44`,borderRadius:7,padding:"8px 10px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <input value={L.label||""} onChange={e=>updL({label:e.target.value})}
                        style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:4,color:amber,
                          fontFamily:font,fontSize:10,fontWeight:"bold",padding:"2px 6px",width:130,outline:"none"}}/>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:8,color:dim,fontFamily:mono}}>${Math.round(pmt).toLocaleString()}/mo × {L.months}mo</span>
                        <button onClick={()=>setLoans(list=>list.filter((_,j)=>j!==li))}
                          style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                            background:"transparent",border:`1px solid ${bdr}`,color:dim}}>remove</button>
                      </div>
                    </div>
                    {slider("Amount",L.amount||0,v=>updL({amount:v}),0,300000,1000,v=>"$"+v.toLocaleString())}
                    {slider("Rate",L.rate||0,v=>updL({rate:v}),0,30,0.25,v=>v.toFixed(2)+"%")}
                    {slider("Term (months)",L.months||1,v=>updL({months:v}),1,120,1,v=>v+" mo")}
                    <div style={{display:"flex",gap:8}}>
                      <div style={{flex:1}}>
                        {/* v4.3.0: BASE.startYear/+20 (was hardcoded 2026/2046) */}
                        {slider("Start year",L.startYear||BASE.startYear,v=>updL({startYear:v}),BASE.startYear,BASE.startYear+20,1,v=>v+"")}
                      </div>
                      <div style={{flex:1}}>
                        {slider("Start month",L.startMonth||BASE.startMonth,v=>updL({startMonth:v}),1,12,1,v=>new Date(2000,v-1).toLocaleString('default',{month:'short'}))}
                      </div>
                    </div>
                    <div style={{marginTop:2}} data-testid={`loan-sweepable-${li}`}>
                      <div style={{fontSize:9,color:muted,marginBottom:3}}>Join ongoing debt-sweep avalanche (pay off early)</div>
                      {toggle(!!L.sweepable, v=>updL({sweepable:v}), [
                        {v:false,l:"Scheduled only"},{v:true,l:"Sweepable",c:amber}
                      ])}
                    </div>
                    <div style={{marginTop:6}} data-testid={`loan-closing-${li}`}>
                      <div style={{fontSize:9,color:muted,marginBottom:3}}>Retire at property-sale closing (one-time lump-sum)</div>
                      {toggle(!!L.closingEligible, v=>updL({closingEligible:v}), [
                        {v:false,l:"Not eligible"},{v:true,l:"Closing-eligible",c:amber}
                      ])}
                    </div>
                  </div>
                );
              })}
            </div>
            </>)}

            {/* Cash-Flow Engine: pooled proceeds routing chain + lifestyle draws */}
            {sect("Cash-Flow Engine")}
            <div style={{fontSize:8,color:dim,marginBottom:8}}>All same-year dispositions feed ONE pool: proceeds → obligation → one-time draw → the dispersement waterfall (HI debt first, then reserves/buffers, then savings).</div>
            {slider("One-time draw ($, at sale)",settleLifestyleDraw,setSettleLifestyleDraw,0,500000,5000,v=>"$"+Math.round(v/1000)+"K")}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:muted,marginBottom:3}}>Draw label (optional -- lifestyle vs. other use)</div>
              <input type="text" data-testid="settle-draw-label" value={settleDrawLabel} onChange={e=>setSettleDrawLabel(e.target.value)}
                placeholder="e.g. Lifestyle, renovation, gift..."
                style={{width:"100%",background:bg1,border:`1px solid ${bdr}`,borderRadius:4,
                  color:bright,fontFamily:font,fontSize:10,padding:"4px 8px",outline:"none",boxSizing:"border-box"}}/>
            </div>
            {(()=>{
              const rSettle = liveRows.find(r=>r.cal===obligation.year) || {};
              const fmtK = v=>"$"+Math.round((v||0)/1000)+"K";
              return (
                <div data-testid="pooled-routing-result" style={{fontSize:9,color:muted,padding:8,background:bg2,borderRadius:4,marginTop:4}}>
                  proceeds → obligation {fmtK(obligation.amount)} → draw {fmtK(rSettle.settleDraw)}{settleDrawLabel?` (${settleDrawLabel})`:""} → cascade: {fmtK(rSettle.wfDebtPaid)} to HI debt, {fmtK(rSettle.wfReserveFill)} to reserve/buffer caps, {fmtK(rSettle.wfToSavings)} to savings
                </div>
              );
            })()}

            {/* -- Lifestyle Draws -- */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:10,color:muted,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>Lifestyle Draws</span>
                <button
                  disabled={lifestyleDraws.length>=5}
                  onClick={()=>setLifestyleDraws(d=>[...d,{yr:2,amount:24000,enabled:true}])}
                  style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,
                    background:"transparent",border:`1px solid ${bdr}`,
                    color:lifestyleDraws.length>=5?bdr:dim,
                    cursor:lifestyleDraws.length>=5?"default":"pointer"}}>
                  + add draw
                </button>
              </div>
              <div style={{fontSize:8,color:dim,marginBottom:8}}>
                One-time lump sum pulls from invested savings -- boosts FCF in lean years, reduces investment balance going forward.
              </div>
              {lifestyleDraws.length===0&&(
                <div style={{fontSize:9,color:bdr,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>No draws configured</div>
              )}
              {lifestyleDraws.map((d,i)=>(
                <div key={i} style={{
                  background:bg2,border:`1px solid ${d.enabled?amber+"55":bdr}`,
                  borderRadius:7,padding:"8px 10px",marginBottom:8
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:9,color:d.enabled?amber:dim,fontWeight:"bold"}}>Draw {i+1}</span>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setLifestyleDraws(ds=>ds.map((x,j)=>j===i?{...x,enabled:!x.enabled}:x))}
                        style={{fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                          background:d.enabled?amber+"22":"transparent",
                          border:`1px solid ${d.enabled?amber:bdr}`,color:d.enabled?amber:dim}}>
                        {d.enabled?"on":"off"}
                      </button>
                      <button onClick={()=>setLifestyleDraws(ds=>ds.filter((_,j)=>j!==i))}
                        style={{fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                          background:"transparent",border:`1px solid ${bdr}`,color:dim}}>
                        remove
                      </button>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:muted}}>Year</span>
                      {/* v4.3.0: BASE.startYear (was hardcoded 2026) -- d.yr is an offset from the model's start */}
                      <span style={{fontSize:10,color:amber,fontFamily:mono}}>{BASE.startYear+d.yr} (age {65+d.yr})</span>
                    </div>
                    <input type="range" min={0} max={20} step={1} value={d.yr}
                      onChange={e=>setLifestyleDraws(ds=>ds.map((x,j)=>j===i?{...x,yr:parseInt(e.target.value)}:x))}
                      style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                    {(()=>{
                      const cashAtYr = liveRows[d.yr]?.cashAst ?? 0;
                      const ok = cashAtYr >= d.amount;
                      return <div style={{fontSize:8,color:ok?dim:red,marginTop:3}}>
                        Invested cash at {BASE.startYear+d.yr}: ~${Math.round(cashAtYr/1000)}K
                        {!ok&&" -- draw exceeds balance"}
                      </div>;
                    })()}
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:muted}}>Amount</span>
                      <span style={{fontSize:10,color:amber,fontFamily:mono}}>${d.amount.toLocaleString()} (~${Math.round(d.amount/12).toLocaleString()}/mo)</span>
                    </div>
                    <input type="range" min={5000} max={150000} step={5000} value={d.amount}
                      onChange={e=>setLifestyleDraws(ds=>ds.map((x,j)=>j===i?{...x,amount:parseInt(e.target.value)}:x))}
                      style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                  </div>
                  <div style={{fontSize:8,color:dim,marginTop:3,textAlign:"right"}}>
                    <span style={{color:amber}}>${d.amount.toLocaleString()}</span> in <span style={{color:muted}}>{BASE.startYear+d.yr}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ECONOMY */}
            {sect("Economy")}

            {slider("RE Appreciation",reApp,setReApp,2,6,0.25,v=>`${v.toFixed(2)}%/yr`)}
            {slider("Rent Growth",rentGr,setRentGr,1.5,4.5,0.25,v=>`${v.toFixed(2)}%/yr`)}
            <div style={{fontSize:9,color:muted,fontWeight:"bold",marginBottom:6,marginTop:8}}>Inflation Rates</div>
            {slider("Core CPI (living costs)",cpi,setCpi,1.4,4.2,0.2,v=>`${v.toFixed(1)}%/yr`)}
            {slider("Health ins inflation",healthCpi,setHealthCpi,2.0,8.0,0.5,v=>`${v.toFixed(1)}%/yr`)}
            {slider("Prop tax/ins inflation",propCpi,setPropCpi,1.5,5.0,0.5,v=>`${v.toFixed(1)}%/yr`)}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,marginBottom:4}}>
              <span style={{fontSize:10,color:muted}}>Income tax estimate</span>
              <button onClick={()=>setTaxEnabled(v=>!v)} style={{
                background:taxEnabled?"#f59e0b22":"transparent",
                border:`1px solid ${taxEnabled?"#f59e0b":dim}`,borderRadius:4,
                color:taxEnabled?amber:dim,cursor:"pointer",fontSize:9,
                padding:"2px 8px",fontFamily:font
              }}>{taxEnabled?"on":"off"}</button>
            </div>
            {taxEnabled&&<div style={{fontSize:9,color:dim,fontStyle:"italic"}}>
              {/* v4.3.0: BASE.startYear (was hardcoded "2026"/"2030") */}
              Est. {liveRows[0]?`$${Math.round(liveRows[0].tax/100)*100}/mo`:"..."} in {BASE.startYear}, {liveRows[4]?`$${Math.round(liveRows[4].tax/100)*100}/mo`:"..."} in {BASE.startYear+4}
            </div>}
            {slider("Investment Return",investRet,setInvestRet,2.75,8.25,0.25,v=>`${v.toFixed(2)}%/yr`)}

            {/* Restored v4.0.0-A: unrelated to the 5-group IA above -- SS timing,
                work curve, and the liq-NW basis note stay here at the end. */}
            {/* v4.4.0: replaced the stepped 65-70 "Your SS Start Age" toggle
                with explicit year+month claim dates PER SPOUSE (staggered
                claiming must be modelable) -- age is now a derived read-out,
                not the input. */}
            <div style={{marginBottom:10,marginTop:14}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>Your SS Start</div>
              {slider("Your SS Start Year",ssStartYear,setSsStartYear,BASE.startYear,BASE.startYear+20,1,v=>`${v}`)}
              {slider("Your SS Start Month",ssStartMonth,setSsStartMonth,1,12,1,v=>MONTH_ABBR[v-1])}
              <div style={{fontSize:9,color:dim,marginTop:-4,marginBottom:4}}>
                {ssStartYear} &middot; {MONTH_ABBR[ssStartMonth-1]} &rarr; age {yourSsAge.toFixed(1)}
                {" -- "}${Math.round(yourSsAmountFromAge(yourSsAge)).toLocaleString()}/mo
              </div>
              {yourSsAge<62 && <div style={{fontSize:9,color:amber}}>⚠ Below age 62 -- SS isn't claimable this early in practice</div>}
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>Brenda SS Start</div>
              {slider("Brenda SS Start Year",ssBrendaStartYear,setSsBrendaStartYear,BASE.startYear,BASE.startYear+20,1,v=>`${v}`)}
              {slider("Brenda SS Start Month",ssBrendaStartMonth,setSsBrendaStartMonth,1,12,1,v=>MONTH_ABBR[v-1])}
              <div style={{fontSize:9,color:dim,marginTop:-4,marginBottom:4}}>
                {ssBrendaStartYear} &middot; {MONTH_ABBR[ssBrendaStartMonth-1]} &rarr; age {brendaSsAge.toFixed(1)}
                {" -- "}${BASE.brendaSsFRA.toLocaleString()}/mo (flat, doesn't vary by claim age)
              </div>
              {brendaSsAge<62 && <div style={{fontSize:9,color:amber}}>⚠ Below age 62 -- SS isn't claimable this early in practice</div>}
            </div>

            <div style={{marginBottom:14}}>
              <WorkCurveEditor
                pts={workPts}
                onChange={setWorkPts}
              />
            </div>

            {sect("Liquidation NW Basis")}
            <div style={{fontSize:8,color:dim,marginBottom:8}}>Cost basis for the "liq" toggle on the NW chart now comes directly from each property's disposition basis (above) -- 5% selling costs + 28.2% cap gains on taxable gain; rentals get no exclusion, 6th St gets the $500K married exclusion.</div>

          </div>
        </div>

        {/* -- RIGHT: CHARTS + STATS ---------------------- */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Live stats bar */}
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase"}}>Live Scenario Snapshot</div>
              <div style={{fontSize:9,color:dim,textAlign:"right"}}>
                Effective DI cap:&nbsp;
                <span style={{color:amber,fontFamily:mono,fontWeight:"bold"}}>${diCap.toLocaleString()}/mo</span>
                <span style={{color:dim}}> = ${discFloor.toLocaleString()} min FCF + ${rdTopUp.toLocaleString()} RD + ${obTopUp.toLocaleString()} OB &nbsp;</span>
                <span style={{color:dim,cursor:"pointer",textDecoration:"underline"}}
                  onClick={()=>setActiveTab("cashflow")}>edit in Cash Flow tab</span>
                <br/>
                Maintenance:&nbsp;
                <span style={{color:amber,fontFamily:mono,fontWeight:"bold"}}>${Math.round(totalMaintAnnual/12).toLocaleString()}/mo</span>
                <span style={{color:dim}}> ({maintStr}% of structure, {(maintRate*100).toFixed(2)}% of market) &nbsp;</span>
                <span style={{color:dim,cursor:"pointer",textDecoration:"underline"}}
                  onClick={()=>setActiveTab("cashflow")}>edit in Cash Flow tab</span>
              </div>
            </div>

            {/* Row 1: core outputs */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              {statBadge("Total work income needed",liveStats.launchRW>0?"$"+liveStats.launchRW.toLocaleString()+"/mo":"COVERED",liveStats.launchRW<2000)}
              {statBadge("Work-free year",liveStats.workFreeYr?String(liveStats.workFreeYr):`${BASE.startYear+20}+`,!!liveStats.workFreeYr)}
              {statBadge("HI debt clear",liveStats.debtClearYr?String(liveStats.debtClearYr):"Never",!!liveStats.debtClearYr)}
              {statBadge("Net worth yr 10","$"+liveNwYr10.toFixed(1)+"M",liveNwYr10>2)}
            </div>

            {/* Row 2: SS earnings constraint */}
            {(()=>{
              const SS_CAP = 24480;
              // v4.4.0: ssAge (stepped toggle) replaced by yourSsAge (continuous, birth-date-derived).
              const isEarly = yourSsAge < 67;
              const yourFraYear = BASE.yourBirthYear+67;  // real fact from birth date, not ssAge-relative
              const totalWorkAnnual = liveStats.launchRW * 12;
              const safeSplit = Math.round(SS_CAP / 12);
              const partnerShare = Math.max(0, liveStats.launchRW - safeSplit);
              const overCap = Math.max(0, totalWorkAnnual - SS_CAP);
              const clawbackMo = Math.round(overCap / 2 / 12);
              if(!isEarly) return (
                <div style={{background:bg2,borderRadius:7,padding:"9px 12px",borderLeft:`3px solid ${green}`}}>
                  <div style={{fontSize:10,color:green,fontWeight:"bold",marginBottom:2}}>SS at FRA (age 67) -- No earnings limit</div>
                  <div style={{fontSize:9,color:dim}}>Earn any amount from VR/CBC without affecting ${BASE.yourSsFRA.toLocaleString()}/mo benefit. No 1099 split strategy needed.</div>
                </div>
              );
              return (
                <div style={{background:bg2,borderRadius:7,padding:"9px 12px",borderLeft:`3px solid ${overCap>0?red:amber}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:10,color:overCap>0?red:amber,fontWeight:"bold"}}>SS at {yourSsAge.toFixed(1)} -- Earnings Test active until age 67 ({yourFraYear})</span>
                    <span style={{fontSize:9,color:dim}}>2026 cap: <span style={{color:amber,fontFamily:mono}}>${SS_CAP.toLocaleString()}/yr</span></span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:6}}>
                    <div>
                      <div style={{fontSize:8,color:dim,marginBottom:2}}>Your max 1099</div>
                      <div style={{fontSize:13,color:amber,fontFamily:mono,fontWeight:"bold"}}>${SS_CAP.toLocaleString()}/yr</div>
                      <div style={{fontSize:8,color:dim}}>${safeSplit.toLocaleString()}/mo</div>
                    </div>
                    <div>
                      <div style={{fontSize:8,color:dim,marginBottom:2}}>Route rest to Brenda</div>
                      <div style={{fontSize:13,color:blue,fontFamily:mono,fontWeight:"bold"}}>${(partnerShare*12).toLocaleString()}/yr</div>
                      <div style={{fontSize:8,color:dim}}>CBC / VR disbursements</div>
                    </div>
                    <div>
                      <div style={{fontSize:8,color:dim,marginBottom:2}}>SS clawback if over</div>
                      <div style={{fontSize:13,color:overCap>0?red:green,fontFamily:mono,fontWeight:"bold"}}>{overCap>0?"-$"+clawbackMo.toLocaleString()+"/mo":"$0 clean"}</div>
                      <div style={{fontSize:8,color:dim}}>{overCap>0?"withheld -- recouped at FRA 67":""}</div>
                    </div>
                  </div>
                  <div style={{fontSize:8,color:dim,borderTop:`1px solid ${bdr}`,paddingTop:5}}>
                    Cap ~4%/yr wage inflation: ${Math.round(SS_CAP*1.04).toLocaleString()} in 2027, ${Math.round(SS_CAP*1.04*1.04).toLocaleString()} in 2028 &middot; Disappears entirely at your FRA age 67 ({yourFraYear}) &middot; Brenda has no SS yet -- no limit on her 1099s
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Charts 2x2 -- grid supports full-width expansion */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"start"}}>
            <Chart title="Total Work Income Required / mo" dataKey="reqWork" pinKey="rw" color={amber} chartId="reqWork"
              yDomain={[0, reqWorkMax]}
              refLines={[
                {y:0,stroke:green,strokeDasharray:"3 3",label:{value:"Work-free",fill:green,fontSize:8,position:"insideTopLeft"}},
                ...(yourSsAge<67?[{y:Math.round(24480/12),stroke:amber,strokeOpacity:0.4,strokeDasharray:"4 2",label:{value:"SS earnings cap",fill:amber,fontSize:7,position:"insideTopRight"}}]:[]),
              ]}/>
            <Chart title="Free Cash Flow / mo" dataKey="surplus" pinKey="di" color={green} chartId="surplus"
              yDomain={[0, surplusMax]} mainName="Free Cash"
              secondaryDataKey="combinedSweep" secondaryColor={blue} secondaryName="Sweep" pinSecondaryKey="sweep"
              tertiaryDataKey="surplusPool" tertiaryColor={amber} tertiaryName="Surplus"
              quaternaryDataKey={(fcfSchedule||[]).length>0?"floorLine":undefined} quaternaryColor={green} quaternaryName="Floor schedule"
              refLines={[
                ...((fcfSchedule||[]).length===0
                  ? [{y:discFloor,stroke:dim,strokeDasharray:"2 4",label:{value:`$${discFloor.toLocaleString()} floor`,fill:dim,fontSize:8,position:"insideTopLeft"}}]
                  : []),
                ...(debtClearYear!=null
                  ? [{x:debtClearYear,stroke:green,strokeOpacity:0.5,strokeDasharray:"3 3",
                      label:{value:"debt clear",fill:green,fontSize:7,position:"insideTopLeft"}}]
                  : []),
                ...(sweepToSavingsYear!=null && sweepToSavingsYear!==debtClearYear
                  ? [{x:sweepToSavingsYear,stroke:blue,strokeOpacity:0.5,strokeDasharray:"3 3",
                      label:{value:"sweep → savings",fill:blue,fontSize:7,position:"insideTopRight"}}]
                  : []),
              ]}/>
            {/* v4.5.0: retitled from "HI Debt Balance" -- now shows BOTH tiers:
                the HI trio (main line, unchanged dataKey/pinKey/chartId to
                avoid touching pin data plumbing) and a distinct "LI loans"
                line (famLoanBal, already an unconditional sum across loans[]
                regardless of sweepable/closingEligible -- LI membership is
                "whatever's in loans[]", not a flag or rate cutoff). Mortgages
                deliberately stay off this chart -- their ~$1.15M scale would
                flatten the ~$260K HI/LI lines this chart exists to show. */}
            {/* v4.5.0: exactly 2 lines on this chart -- HI debt (the named
                trio, unconditional) and LI loans (one combined line/subtotal
                for the WHOLE loans[] array, whatever it contains) -- no
                per-individual-loan lines. The breakdown table row below (not
                this chart legend) is where individual loan names show up. */}
            <Chart title="Debt Balances ($K)" dataKey="hiDebt" pinKey="debt" color={red} chartId="hiDebt"
              mainName="HI debt" secondaryDataKey="famLoanBal" secondaryColor="#a78bfa" secondaryName="LI loans"
              refLines={[{y:0,stroke:green,strokeDasharray:"3 3"}]}/>
            <Chart title="Net Worth ($M)" dataKey={nwMode==='liq'?'liqNW':'nw'} pinKey={nwMode==='liq'?'liqNW':'nw'} color={blue} chartId="nw"
              yFmt={v=>`$${v.toFixed(1)}M`}
              refLines={[{y:2,stroke:dim,strokeDasharray:"2 4",label:{value:"$2M",fill:dim,fontSize:8}},{y:3,stroke:dim,strokeDasharray:"2 4",label:{value:"$3M",fill:dim,fontSize:8}}]}
              headerExtra={<div style={{display:"flex",gap:2}}>
                {['book','liq'].map(m=>(
                  <button key={m} onClick={()=>setNwMode(m)} style={{
                    fontSize:9,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                    background:nwMode===m?blue+"33":"transparent",
                    border:`1px solid ${nwMode===m?blue:bdr}`,
                    color:nwMode===m?blue:dim,
                  }}>{m}</button>
                ))}
              </div>}/>
            <Chart title="Fixed Costs / mo" dataKey="fixedTotal" pinKey="fc" color={red} chartId="fixedCosts"
              yFmt={v=>v>=1000?`$${Math.round(v/1000)}K`:`$${Math.round(v)}`}
              yDomain={[0,fixedCostMax]}
              refLines={[]}/>
          </div>

          {/* -- CUMULATIVE INCOME vs COST CHART -- */}
          {(()=>{
            const incColors={pension:"#a78bfa",work:"#fb923c",rental:"#34d399",ss:"#60a5fa",draw:"#f472b6"};
            const costColors={mtg:"#f87171",health:"#fb923c",core:"#a3e635",prop:"#38bdf8",maint:"#c084fc",debt:"#f472b6"};
            const fmtK=v=>v>=1000?`$${(v/1000).toFixed(1)}M`:`$${v}K`;
            const last=liveRows[liveRows.length-1];
            const ttStyle={background:bg1,border:`1px solid ${bdr}`,borderRadius:6,padding:"8px 12px",fontSize:10,fontFamily:font};
            const CumTT=({active,payload,label})=>{
              if(!active||!payload?.length)return null;
              return(<div style={ttStyle}>
                <div style={{color:muted,marginBottom:6,fontWeight:"bold"}}>{label}</div>
                {payload.map((p,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",gap:16,color:p.color,marginBottom:2}}>
                    <span>{p.name}</span><span style={{fontFamily:mono}}>{fmtK(p.value)}</span>
                  </div>
                ))}
              </div>);
            };
            const axisProps={tick:{fill:dim,fontSize:9}};
            const xFmt=v=>`'${String(v).slice(2)}`;
            return(
            <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:"16px 20px",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:cumCollapsed?0:12}}>
                <div>
                  <span style={{fontSize:14,fontWeight:"bold",color:bright}}>Cumulative Income vs Cost</span>
                  <span style={{fontSize:10,color:muted,marginLeft:10}}>20-year running totals</span>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {["income","cost","gap"].map(v=>(
                    <button key={v} onClick={()=>setCumView(v)} style={{
                      background:cumView===v?"#ffffff18":"transparent",
                      border:`1px solid ${cumView===v?bright:dim}`,borderRadius:4,
                      color:cumView===v?bright:dim,cursor:"pointer",fontSize:10,
                      padding:"2px 8px",fontFamily:font,textTransform:"capitalize"
                    }}>{v}</button>
                  ))}
                  <button onClick={()=>setCumCollapsed(c=>!c)} style={{
                    background:"transparent",border:`1px solid ${dim}`,borderRadius:4,
                    color:dim,cursor:"pointer",fontSize:10,padding:"2px 8px",fontFamily:font
                  }}>{cumCollapsed?"expand":"collapse"}</button>
                </div>
              </div>
              {!cumCollapsed&&(<>
              {cumView==="income"&&(
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart margin={{top:8,right:16,bottom:0,left:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={bdr} strokeOpacity={0.4}/>
                    <XAxis dataKey="cal" {...axisProps} tickFormatter={xFmt} allowDuplicatedCategory={false}/>
                    <YAxis {...axisProps} tickFormatter={fmtK}/>
                    <Tooltip content={<CumTT/>}/>
                    <Legend wrapperStyle={{fontSize:9,color:muted}}/>
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumPension" name="Pension" stackId="i" stroke={incColors.pension} fill={incColors.pension} fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumWork"    name="Work"    stackId="i" stroke={incColors.work}    fill={incColors.work}    fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumRental"  name="Rental"  stackId="i" stroke={incColors.rental}  fill={incColors.rental}  fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumSS"      name="SS"      stackId="i" stroke={incColors.ss}      fill={incColors.ss}      fillOpacity={0.7}/>}
                    {showLive&&last&&last.cumDraw>0&&<Area data={liveRows} type="monotone" dataKey="cumDraw" name="Draws" stackId="i" stroke={incColors.draw} fill={incColors.draw} fillOpacity={0.7}/>}
                    {pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
                      <Line key={pin.id} data={pin.rows} type="monotone" dataKey="cumInc"
                        name={`${pin.name} total`} stroke={pin.color} strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              {cumView==="cost"&&(
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart margin={{top:8,right:16,bottom:0,left:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={bdr} strokeOpacity={0.4}/>
                    <XAxis dataKey="cal" {...axisProps} tickFormatter={xFmt} allowDuplicatedCategory={false}/>
                    <YAxis {...axisProps} tickFormatter={fmtK}/>
                    <Tooltip content={<CumTT/>}/>
                    <Legend wrapperStyle={{fontSize:9,color:muted}}/>
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumTax"    name="Taxes"       stackId="c" stroke="#e879f9"       fill="#e879f9"       fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumMtg"    name="Mortgages"   stackId="c" stroke={costColors.mtg}   fill={costColors.mtg}   fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumHealth"  name="Health Ins"  stackId="c" stroke={costColors.health} fill={costColors.health} fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumCore"    name="Core Living" stackId="c" stroke={costColors.core}   fill={costColors.core}   fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumProp"    name="Prop Tax/Ins"stackId="c" stroke={costColors.prop}   fill={costColors.prop}   fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumMaint"   name="Maintenance" stackId="c" stroke={costColors.maint}  fill={costColors.maint}  fillOpacity={0.7}/>}
                    {showLive&&<Area data={liveRows} type="monotone" dataKey="cumDebt"    name="HI Debt Pmts"stackId="c" stroke={costColors.debt}   fill={costColors.debt}   fillOpacity={0.7}/>}
                    {pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
                      <Line key={pin.id} data={pin.rows} type="monotone" dataKey="cumCost"
                        name={`${pin.name} total`} stroke={pin.color} strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              {cumView==="gap"&&(
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart margin={{top:8,right:16,bottom:0,left:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={bdr} strokeOpacity={0.4}/>
                    <XAxis dataKey="cal" {...axisProps} tickFormatter={xFmt} allowDuplicatedCategory={false}/>
                    <YAxis {...axisProps} tickFormatter={fmtK}/>
                    <Tooltip content={<CumTT/>}/>
                    <Legend wrapperStyle={{fontSize:9,color:muted}}/>
                    <ReferenceLine y={0} stroke={dim} strokeDasharray="3 3"/>
                    {showLive&&<Line data={liveRows} type="monotone" dataKey="cumInc"  name="Live Income" stroke={green} strokeWidth={2} dot={false}/>}
                    {showLive&&<Line data={liveRows} type="monotone" dataKey="cumCost" name="Live Cost"   stroke={red}   strokeWidth={2} dot={false}/>}
                    {showLive&&<Line data={liveRows} type="monotone" dataKey="cumGap"  name="Live Gap"    stroke={amber} strokeWidth={2} dot={false} strokeDasharray="4 2"/>}
                    {pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
                      <Line key={pin.id} data={pin.rows} type="monotone" dataKey="cumGap"
                        name={`${pin.name} gap`} stroke={pin.color} strokeWidth={1.5} dot={false} strokeDasharray="6 2"/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
              {showLive&&last&&(
                <div style={{display:"flex",gap:20,marginTop:10,flexWrap:"wrap"}}>
                  {[
                    {l:"Total earned (20yr)", v:fmtK(last.cumInc),  c:green},
                    {l:"Total spent (20yr)",  v:fmtK(last.cumCost), c:red},
                    {l:"Net gap",             v:fmtK(last.cumGap),  c:amber},
                    {l:"Pension share", v:Math.round(last.cumPension/Math.max(1,last.cumInc)*100)+"%", c:incColors.pension},
                    {l:"Rental share",  v:Math.round(last.cumRental /Math.max(1,last.cumInc)*100)+"%", c:incColors.rental},
                    {l:"SS share",      v:Math.round(last.cumSS     /Math.max(1,last.cumInc)*100)+"%", c:incColors.ss},
                    {l:"Work share",    v:Math.round(last.cumWork   /Math.max(1,last.cumInc)*100)+"%", c:incColors.work},
                  ].map(({l,v,c})=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{fontSize:9,color:muted,marginBottom:2}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:"bold",color:c,fontFamily:mono}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              </>)}
            </div>);
          })()}


          {/* Financial Events Table */}
          {(()=>{
            // evtPin state is hoisted to component level (see useState block)
            const evtRows = evtPin==="live" ? liveRows : (pins.find(p=>p.id===parseInt(evtPin))?.rows || liveRows);
            const evtLabel = evtPin==="live" ? "Live Scenario" : (pins.find(p=>p.id===parseInt(evtPin))?.name || "");
            const evtColor = evtPin==="live" ? amber : (pins.find(p=>p.id===parseInt(evtPin))?.color || amber);

            // Detect financial events by comparing consecutive years
            const events = [];
            for(let i=0; i<evtRows.length; i++){
              const r=evtRows[i], prev=evtRows[i-1];
              const yr=r.cal, evts=[];

              // Income events
              if(r.yourSs>0 && (!prev||prev.yourSs===0))
                // v4.4.0: age is now the real birth-date-derived claiming age
                // (yourSsAge, computed once above from the actual scenario
                // settings) -- was `65+(yr-BASE.startYear)`, an approximation
                // that assumed claiming always happened at exactly age 65.
                evts.push({cat:"income", icon:"SS", desc:`Your SS starts (age ${yourSsAge.toFixed(1)})`, delta:r.yourSs, note:`$${r.yourSs.toLocaleString()}/mo`});
              if(r.brendaSs>0 && (!prev||prev.brendaSs===0))
                // v4.4.0: was hardcoded "(FRA {yr})", assuming Brenda always
                // claims at FRA -- she can now claim at any age, so this
                // reports her actual derived claiming age instead.
                evts.push({cat:"income", icon:"SS", desc:`Brenda SS starts (age ${brendaSsAge.toFixed(1)})`, delta:r.brendaSs, note:`$${r.brendaSs.toLocaleString()}/mo`});
              if(prev && r.workInc<prev.workInc && prev.workInc>0)
                evts.push({cat:"income", icon:"WK", desc:"Work income glide (per work curve)", delta:r.workInc-prev.workInc, note:`$${prev.workInc.toLocaleString()} → $${r.workInc.toLocaleString()}/mo`});
              if(prev && r.rental !== prev.rental){
                const d=r.rental-prev.rental;
                if(Math.abs(d)>200) evts.push({cat:"income", icon:"RE", desc:d>0?"Rental income increase":"Rental income drop", delta:d, note:`$${prev.rental.toLocaleString()} → $${r.rental.toLocaleString()}/mo`});
              }

              // Cost events
              if(prev && r.health < prev.health-100){
                const hlWho=yr===BASE.sophiaOff?"Sophia off plan":yr===BASE.nolanOff?"Nolan off plan":yr===BASE.brendaMedYear?"Brenda → Medicare":"";
                evts.push({cat:"cost", icon:"HL", desc:`Health insurance drops${hlWho?` — ${hlWho}`:""}`, delta:r.health-prev.health, note:`$${prev.health.toLocaleString()} → $${r.health.toLocaleString()}/mo`});
              }
              // v3.4.0: contractual IO->P&I recast events straight from engine state
              for(const t of (r.mtgTransitions||[]))
                evts.push({cat:"cost", icon:"MTG", desc:`${t.label} mortgage: IO→P&I (+$${t.delta.toLocaleString()}/mo)`, delta:t.delta, note:`10-yr interest-only period ends; payment recasts to amortize the actual balance over the remaining term`});
              for(const lbl of (r.mtgPayoffs||[]))
                evts.push({cat:"milestone", icon:"MTG", desc:`${lbl} mortgage paid off early`, delta:0, note:"extra principal from the waterfall bucket retired it ahead of schedule"});
              if(prev && r.mtg > prev.mtg+200 && !(r.mtgTransitions||[]).length && !(prev.mtgTransitions||[]).length)
                evts.push({cat:"cost", icon:"MTG", desc:"Mortgage cost rises", delta:r.mtg-prev.mtg, note:`$${prev.mtg.toLocaleString()} → $${r.mtg.toLocaleString()}/mo`});
              if(prev && r.mtg < prev.mtg-200 && !(r.mtgPayoffs||[]).length)
                evts.push({cat:"cost", icon:"MTG", desc:"Mortgage cost drops", delta:r.mtg-prev.mtg, note:`$${prev.mtg.toLocaleString()} → $${r.mtg.toLocaleString()}/mo`});
              // v3.2.0 loan events straight from engine state (not hardcoded)
              for(const lbl of (r.loanStarts||[]))
                evts.push({cat:"cost", icon:"LN", desc:`${lbl} starts`, delta:r.famLoan, note:`$${(r.famLoan||0).toLocaleString()}/mo avg this year`});
              for(const lbl of (r.loanPayoffs||[]))
                evts.push({cat:"cost", icon:"LN", desc:`${lbl} paid off`, delta:-(prev?.famLoan||r.famLoan||0), note:"payment freed"});
              if(prev && r.minDebt < prev.minDebt-100){
                const cleared=[];
                if(prev.ccBal>0 && r.ccBal===0) cleared.push(`CC paid off (−$${ccMin.toLocaleString()}/mo)`);
                if(prev.sophiaBal>0 && r.sophiaBal===0) cleared.push(`Sophia loans paid off (−$${sophiaMin.toLocaleString()}/mo)`);
                if(prev.nolanBal>0 && r.nolanBal===0) cleared.push(`Nolan loans paid off (−$${nolanMin.toLocaleString()}/mo)`);
                const hiDropDesc = cleared.length ? cleared.join(" · ") : "HI debt minimums drop";
                evts.push({cat:"cost", icon:"HI", desc:hiDropDesc, delta:r.minDebt-prev.minDebt, note:`$${prev.minDebt.toLocaleString()} → $${r.minDebt.toLocaleString()}/mo`});
              }
              if(prev && r.debtSweep===0 && prev.debtSweep>0)
                evts.push({cat:"cost", icon:"HI", desc:"All HI debt cleared — avalanche sweep ends", delta:prev.debtSweep, note:`+$${prev.debtSweep.toLocaleString()}/mo freed to discretionary`});

              // v3.2.0 health/Medicare transitions from the SAME BASE constants the
              // monthly model uses (previously only cost-delta-derived, so Sophia's
              // off-plan year -- where the kids' premium doesn't change -- was missing)
              {
                const _hlNames = evts.filter(e=>e.icon==="HL").map(e=>e.desc).join(" ");
                // v4.4.0: yr===BASE.medicareYouYear (was a hardcoded yr===2026)
                // -- the Medicare transition is now birth-date-derived (Oct
                // 2026, corrected from the old Nov-2026 assumption -- see
                // session29 journal), not a bare literal independent of the
                // model's start-year setting.
                if(yr===BASE.medicareYouYear)
                  evts.push({cat:"cost", icon:"HL", desc:"You → Medicare", delta:0, note:`Ericsson $${BASE.healthYouEricsson} → Medicare ~$${BASE.healthYouMedicare}/mo (${MONTH_ABBR[BASE.medicareYouMonth-1]} ${BASE.medicareYouYear})`});
                if(yr===BASE.sophiaOff && !/Sophia/.test(_hlNames))
                  evts.push({cat:"cost", icon:"HL", desc:"Sophia → off health insurance", delta:0, note:`kids' premium continues while Nolan is on plan (through ${BASE.nolanOff-1})`});
                if(yr===BASE.nolanOff && !/Nolan/.test(_hlNames))
                  evts.push({cat:"cost", icon:"HL", desc:"Nolan → off health insurance", delta:0, note:"kids' premium ends"});
                if(yr===BASE.brendaMedYear && !/Brenda/.test(_hlNames))
                  evts.push({cat:"cost", icon:"HL", desc:"Brenda → Medicare", delta:0, note:"Ericsson → Medicare premium"});
              }

              // v4.0.0-B pooled-routing residual events (from engine row fields)
              if((r.settleDraw||0)>0)
                evts.push({cat:"income", icon:"DR", desc:"One-time draw at sale", delta:Math.round(r.settleDraw/12), note:`$${r.settleDraw.toLocaleString()} from sale residual`});
              if((r.wfDebtPaid||0)>0)
                evts.push({cat:"cost", icon:"HI", desc:"Sale-proceeds HI paydown (avalanche, debt-first)", delta:0, note:`$${Math.round(r.wfDebtPaid/1000)}K lump-sum`});

              // Milestone events
              if(r.hiDebt===0 && (!prev||prev.hiDebt>0))
                evts.push({cat:"milestone", icon:"OK", desc:"All HI debt eliminated", delta:0, note:`Total cleared: $${Math.round((prev?.hiDebt||0))}K · mortgages now eligible for P&I`});
              if(r.reqWork===0 && (!prev||prev.reqWork>0))
                evts.push({cat:"milestone", icon:"*", desc:"WORK-FREE — passive income covers all costs", delta:0, note:`NW: $${(r.nw/1000).toFixed(1)}M · passive: $${r.passive.toLocaleString()}/mo`});

              // Lifestyle draw events
              for(const d of lifestyleDraws.filter(x=>x.enabled)){
                if(yr===BASE.startYear+d.yr)  // v4.3.0: was hardcoded 2026
                  evts.push({cat:"income", icon:"DR", desc:"Lifestyle Draw", delta:Math.round(d.amount/12), note:`$${d.amount.toLocaleString()} lump sum`});
              }

              if(evts.length>0) events.push({yr, age:65+(yr-BASE.startYear), r, evts});
            }

            const catColor = {income:green, cost:red, milestone:blue};
            const catBg    = {income:green+"18", cost:red+"18", milestone:blue+"18"};

            return (
              <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14}}>
                {/* Header + scenario selector */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:eventsCollapsed?0:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase"}}>Financial Events Timeline</div>
                    <button onClick={()=>setEventsCollapsed(v=>!v)} style={{
                      fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                      background:"transparent",border:`1px solid ${bdr}`,color:dim}}>
                      {eventsCollapsed?"▼ expand":"▲ collapse"}
                    </button>
                  </div>
                  {!eventsCollapsed&&<select value={evtPin} onChange={e=>setEvtPin(e.target.value)}
                    style={{background:bg2,border:`1px solid ${bdr}`,borderRadius:5,color:evtColor,
                      fontFamily:font,fontSize:10,padding:"4px 8px",cursor:"pointer",outline:"none"}}>
                    <option value="live">Live Scenario</option>
                    {pins.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>}
                </div>

                {/* Legend + Timeline -- hidden when collapsed */}
                {!eventsCollapsed&&(<>
                {/* Legend */}
                <div style={{display:"flex",gap:12,marginBottom:10}}>
                  {[["income",green,"Income event"],["cost",red,"Cost event"],["milestone",blue,"Milestone"]].map(([k,c,l])=>(
                    <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:8,height:8,borderRadius:2,background:c}}/>
                      <span style={{fontSize:8,color:dim}}>{l}</span>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${bdr}`}}>
                        {["Year","Age","Event","Before -> After","FCF /mo","NW $M","Req Work /mo"].map(h=>(
                          <th key={h} style={{textAlign:"left",padding:"5px 8px",fontSize:8,color:dim,fontWeight:"bold",
                            letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(({yr,age,r,evts})=>
                        evts.map((ev,j)=>(
                          <tr key={`${yr}-${j}`} style={{
                            borderBottom:`1px solid ${bdr}22`,
                            background:j===0&&evts.length>1?catBg[ev.cat]+"44":"transparent",
                          }}>
                            <td style={{padding:"6px 8px",color:catColor[ev.cat],fontFamily:mono,fontWeight:"bold",whiteSpace:"nowrap"}}>
                              {j===0?yr:""}
                            </td>
                            <td style={{padding:"6px 8px",color:muted,whiteSpace:"nowrap"}}>
                              {j===0?age:""}
                            </td>
                            <td style={{padding:"6px 8px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <span style={{background:catColor[ev.cat]+"33",color:catColor[ev.cat],
                                  borderRadius:3,padding:"1px 5px",fontSize:8,fontFamily:mono,fontWeight:"bold",
                                  whiteSpace:"nowrap"}}>{ev.icon}</span>
                                <span style={{color:ev.cat==="milestone"?blue:bright}}>{ev.desc}</span>
                              </div>
                            </td>
                            <td style={{padding:"6px 8px",color:dim,fontSize:9,fontFamily:mono,whiteSpace:"nowrap"}}>{ev.note}</td>
                            <td style={{padding:"6px 8px",color:r.surplus>=0?green:red,fontFamily:mono,whiteSpace:"nowrap"}}>
                              {j===0?("$"+r.surplus.toLocaleString()):""}
                            </td>
                            <td style={{padding:"6px 8px",color:dim,fontFamily:mono,whiteSpace:"nowrap"}}>
                              {j===0?("$"+(r.nw/1000).toFixed(1)+"M"):""}
                            </td>
                            <td style={{padding:"6px 8px",color:r.reqWork===0?green:amber,fontFamily:mono,whiteSpace:"nowrap"}}>
                              {j===0?(r.reqWork===0?"FREE":"$"+r.reqWork.toLocaleString()):""}
                            </td>
                          </tr>
                        ))
                      )}
                      {events.length===0&&(
                        <tr><td colSpan={7} style={{padding:"16px 8px",color:dim,textAlign:"center"}}>No significant events detected</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </>)}{/* end !eventsCollapsed */}
              </div>
            );
          })()}

          {/* Pin panel */}
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase"}}>Pinned Scenarios</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <button onClick={()=>setShowLive(s=>!s)} style={{
                  fontSize:9,padding:"2px 8px",borderRadius:4,cursor:"pointer",fontFamily:font,
                  background:showLive?amber+"22":"transparent",
                  border:`1px solid ${showLive?amber:dim}`,
                  color:showLive?amber:dim,
                }}>live {showLive?"on":"off"}</button>
                <span style={{color:dim,fontSize:9}}>|</span>
                <button onClick={()=>setVisiblePins(new Set(pins.map(p=>p.id)))} style={{fontSize:9,color:blue,background:"transparent",border:"none",cursor:"pointer",fontFamily:font}}>all</button>
                <span style={{color:dim,fontSize:9}}>|</span>
                <button onClick={()=>setVisiblePins(new Set())} style={{fontSize:9,color:dim,background:"transparent",border:"none",cursor:"pointer",fontFamily:font}}>none</button>
              </div>
            </div>

            {/* Add pin row */}
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={pinName} onChange={e=>setPinName(e.target.value)}
                placeholder="Name this scenario..."
                style={{flex:1,background:bg2,border:`1px solid ${bdr}`,borderRadius:6,padding:"7px 10px",
                  color:bright,fontFamily:font,fontSize:11,outline:"none"}}/>
              <button onClick={addPin} style={{
                padding:"7px 16px",borderRadius:6,border:`1px solid ${amber}`,
                background:amber+"22",color:amber,cursor:"pointer",fontFamily:font,
                fontSize:11,fontWeight:"bold",whiteSpace:"nowrap",
              }}>Pin</button>
            </div>

            {/* Export / Import row */}
            <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
              <button
                onClick={exportPins}
                disabled={pins.length===0}
                style={{fontSize:9,padding:"4px 10px",borderRadius:4,cursor:pins.length===0?"default":"pointer",
                  fontFamily:font,background:"transparent",border:`1px solid ${pins.length===0?bdr:blue}`,
                  color:pins.length===0?bdr:blue}}>
                Export JSON
              </button>
              <label style={{fontSize:9,padding:"4px 10px",borderRadius:4,cursor:"pointer",
                fontFamily:font,background:"transparent",border:`1px solid ${green}`,color:green}}>
                Import JSON
                <input type="file" accept=".json" onChange={importPins}
                  style={{display:"none"}}/>
              </label>
              <span style={{fontSize:8,color:dim,marginLeft:2}}>
                {pins.length===0?"No pins saved":
                  `${pins.length} pin${pins.length!==1?"s":""} -- auto-saved`}
              </span>
            </div>

            {/* Pin list */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {pins.map(pin=>(
                <div key={pin.id} data-testid={`pin-card-${pin.id}`} style={{
                  background:bg2,border:`1px solid ${pin.color}44`,
                  borderLeft:`3px solid ${pin.color}`,borderRadius:7,
                  padding:"9px 12px",display:"flex",alignItems:"center",gap:10,
                }}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                      <input type="color" data-testid={`pin-color-${pin.id}`}
                        value={pin.color} onChange={e=>setPinColor(pin.id,e.target.value)}
                        title="Line color for this scenario"
                        style={{width:16,height:16,padding:0,border:`1px solid ${bdr}`,
                          borderRadius:3,cursor:"pointer",background:"transparent"}}/>
                      <div style={{fontSize:11,color:pin.color,fontWeight:"bold"}}>{pin.name}</div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {[
                        ["Launch RW","$"+pin.stats.launchRW.toLocaleString()+"/mo"],
                        ["Work-free",pin.stats.workFreeYr||`${BASE.startYear+20}+`],
                        ["Debt clear",pin.stats.debtClearYr||"Never"],
                        ["NW yr10","$"+((chartData[10]?.[`pin_${pin.id}_nw`]??pin.stats.nwYr10/1000)).toFixed(1)+"M"],
                      ].map(([l,v])=>(
                        <div key={l} style={{fontSize:9}}>
                          <span style={{color:dim}}>{l}: </span>
                          <span style={{color:bright,fontFamily:mono}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {pin.cfSettings&&(
                      <div style={{marginTop:5,paddingTop:5,borderTop:`1px solid ${bdr}44`,
                        display:"flex",gap:8,flexWrap:"wrap"}}>
                        {[
                          ["Free Cash","$"+pin.cfSettings.discFloor+"/mo"],
                          ["RD","$"+pin.cfSettings.rdTopUp+"/mo -> $"+Math.round(pin.cfSettings.rdCap/1000)+"K cap"],
                          ["OB","$"+pin.cfSettings.obTopUp+"/mo -> $"+Math.round(pin.cfSettings.obCap/1000)+"K cap"],
                          ["Maint","$"+Math.round(pin.cfSettings.totalMaintAnnual/12)+"/mo ("+pin.cfSettings.maintStr+"% struct)"],
                          ["DI cap","$"+pin.cfSettings.diCap+"/mo"],
                        ].map(([l,v])=>(
                          <div key={l} style={{fontSize:8}}>
                            <span style={{color:dim}}>{l}: </span>
                            <span style={{color:muted,fontFamily:mono}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <button onClick={()=>setVisiblePins(s=>{const n=new Set(s);n.add(pin.id);return n;})}
                      disabled={visiblePins.has(pin.id)}
                      style={{
                        background:visiblePins.has(pin.id)?pin.color+"33":"transparent",
                        border:`1px solid ${visiblePins.has(pin.id)?pin.color:dim}`,
                        borderRadius:4,color:visiblePins.has(pin.id)?pin.color:dim,
                        cursor:visiblePins.has(pin.id)?"default":"pointer",
                        fontSize:10,padding:"2px 8px",lineHeight:1,fontFamily:font,
                      }}>on</button>
                    <button onClick={()=>setVisiblePins(s=>{const n=new Set(s);n.delete(pin.id);return n;})}
                      disabled={!visiblePins.has(pin.id)}
                      style={{
                        background:!visiblePins.has(pin.id)?dim+"22":"transparent",
                        border:`1px solid ${!visiblePins.has(pin.id)?dim:dim+"55"}`,
                        borderRadius:4,color:!visiblePins.has(pin.id)?dim:dim+"55",
                        cursor:!visiblePins.has(pin.id)?"default":"pointer",
                        fontSize:10,padding:"2px 8px",lineHeight:1,fontFamily:font,
                      }}>off</button>

                    {confirmDeleteId===pin.id
                      ? <div style={{display:"flex",gap:2}}>
                          <button onClick={()=>{removePin(pin.id);setConfirmDeleteId(null);}} style={{
                            background:red+"33",border:`1px solid ${red}`,borderRadius:4,
                            color:red,cursor:"pointer",fontSize:9,padding:"2px 5px",fontFamily:font,
                          }}>yes</button>
                          <button onClick={()=>setConfirmDeleteId(null)} style={{
                            background:"transparent",border:`1px solid ${dim}`,borderRadius:4,
                            color:dim,cursor:"pointer",fontSize:9,padding:"2px 5px",fontFamily:font,
                          }}>no</button>
                        </div>
                      : <button onClick={()=>setConfirmDeleteId(pin.id)}
                          style={{
                            background:"transparent",border:`1px solid ${red}44`,
                            borderRadius:4,color:red+"99",cursor:"pointer",
                            fontSize:10,padding:"2px 8px",lineHeight:1,fontFamily:font,
                          }}>del</button>
                    }
                  </div>
                </div>
              ))}
              {pins.length===0&&<div style={{fontSize:11,color:dim,textAlign:"center",padding:"12px 0"}}>No pins yet -- configure sliders and pin a scenario to compare</div>}
            </div>

            {/* ---- Comparison Table ---- */}
            {pins.length>0&&(()=>{
              const visPins = pins.filter(p=>visiblePins.has(p.id));
              const cols = [
                {id:"live", label:"Live", color:green, stats:liveStats, nwYr10:chartData[10]?.nw, sweepFinal:chartData[chartData.length-1]?.sweepSavK},
                ...visPins.map(p=>({
                  id:p.id, label:p.name, color:p.color, stats:p.stats,
                  nwYr10:chartData[10]?.[`pin_${p.id}_nw`]??p.stats.nwYr10/1000,
                  sweepFinal:chartData[chartData.length-1]?.[`pin_${p.id}_sweepSavK`]??0,
                })),
              ];
              const rows = [
                {label:"Launch work needed", fmt:c=>"$"+c.stats.launchRW.toLocaleString()+"/mo", good:c=>c.stats.launchRW<3000},
                // v4.3.0: BASE.startYear-relative thresholds (were hardcoded 2046/2034/2031)
                {label:"Work-free year",      fmt:c=>c.stats.workFreeYr?String(c.stats.workFreeYr):`${BASE.startYear+20}+`,  good:c=>!!c.stats.workFreeYr&&c.stats.workFreeYr<=BASE.startYear+8},
                {label:"HI debt clear",       fmt:c=>c.stats.debtClearYr?String(c.stats.debtClearYr):"Never", good:c=>!!c.stats.debtClearYr&&c.stats.debtClearYr<=BASE.startYear+5},
                {label:"NW at yr 10",         fmt:c=>"$"+(c.nwYr10??0).toFixed(1)+"M", good:c=>(c.nwYr10??0)>=5},
                {label:"Sweep savings (final)",fmt:c=>"$"+Math.round((c.sweepFinal??0)).toLocaleString()+"K", good:c=>(c.sweepFinal??0)>=1000},
              ];
              return (
                <div style={{marginTop:14,borderTop:`1px solid ${bdr}`,paddingTop:12}}>
                  <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Scenario Comparison</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:font}}>
                      <thead>
                        <tr>
                          <th style={{textAlign:"left",color:dim,padding:"3px 6px 5px 0",borderBottom:`1px solid ${bdr}`,fontWeight:"normal",width:"40%"}}>Metric</th>
                          {cols.map(c=>(
                            <th key={c.id} style={{textAlign:"right",padding:"3px 6px 5px",borderBottom:`1px solid ${bdr}`,color:c.color,fontWeight:"bold",whiteSpace:"nowrap"}}>
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row,ri)=>(
                          <tr key={ri} style={{background:ri%2===0?"transparent":bg2+"88"}}>
                            <td style={{color:dim,padding:"4px 6px 4px 0",borderBottom:`1px solid ${bdr}22`}}>{row.label}</td>
                            {cols.map(c=>{
                              const isGood=row.good(c);
                              return(
                                <td key={c.id} style={{textAlign:"right",padding:"4px 6px",borderBottom:`1px solid ${bdr}22`,
                                  color:isGood?green:muted,fontFamily:mono,fontWeight:isGood?"bold":"normal"}}>
                                  {row.fmt(c)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </div>
      )} {/* end simulator tab */}

      {/* ====== CASH FLOW TAB ====== */}
      {activeTab==="cashflow" && (
        <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:14}}>

          {/* LEFT: Waterfall config */}
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:"14px 14px 16px",
            overflowY:"auto",maxHeight:"calc(100vh - 140px)"}}>

            <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Waterfall Buckets</div>
            <div style={{fontSize:8,color:dim,marginBottom:12,lineHeight:1.6}}>
              Each month: Fixed Costs → Maintenance Reserves → Safety Buckets → FCF Floor (your lifestyle target) → Surplus: sweep debt or savings / keep as extra lifestyle
            </div>

            {/* Tier 1: Fixed costs / Maintenance */}
            {sect("Tier 1 -- Maintenance Reserves")}
            {slider("Rate (% of structure/yr)",maintStr,setMaintStr,0.25,1.5,0.25,v=>v+"%")}
            {uiKeepPrimary&&slider("6th St structure value",struct6,setStruct6,300,900,50,v=>"$"+v+"K  ($"+Math.round(struct6*1000*maintStr/100/12).toLocaleString()+"/mo)")}
            {slider("15th St structure value",struct15,setStruct15,250,750,50,v=>"$"+v+"K  ($"+Math.round(struct15*1000*maintStr/100/12).toLocaleString()+"/mo)")}
            {slider("Lafayette structure value",structLaf,setStructLaf,125,500,25,v=>"$"+v+"K  ($"+Math.round(structLaf*1000*maintStr/100/12).toLocaleString()+"/mo)")}
            <div style={{fontSize:9,color:dim,marginBottom:4}}>
              Cap = 5 yrs of reserves per property. Once full, monthly amount redirects to HI sweep.
            </div>
            <div style={{fontSize:9,color:amber,fontFamily:mono,marginBottom:10}}>
              Total: ${Math.round(((uiKeepPrimary?struct6:0)+struct15+structLaf)*1000*maintStr/100/12).toLocaleString()}/mo
            </div>

            {/* Tier 2: Rainy day */}
            {sect("Tier 2 -- Rainy Day Fund")}
            {slider("Monthly top-up",rdTopUp,setRdTopUp,0,1000,50,v=>v===0?"Off":"$"+v.toLocaleString()+"/mo")}
            {slider("Target cap",rdCap,setRdCap,5000,20000,1000,v=>"$"+v.toLocaleString())}
            <div style={{fontSize:9,color:dim,marginBottom:10}}>
              {wfData[0]&&rdTopUp>0
                ?`Fills in ~${Math.ceil(rdCap/rdTopUp)} months if no draws`
                :"Top-up disabled"}
            </div>

            {/* Tier 3: Op buffer */}
            {sect("Tier 3 -- Operating Buffer")}
            {slider("Monthly top-up",obTopUp,setObTopUp,0,1500,100,v=>v===0?"Off":"$"+v.toLocaleString()+"/mo")}
            {slider("Target cap",obCap,setObCap,15000,50000,5000,v=>"$"+v.toLocaleString())}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>Funding order</div>
              {toggle(bufferMode,setBufferMode,[
                {v:"seq",l:"Fill RD first",c:amber},
                {v:"par",l:"Parallel",c:blue},
              ])}
              <div style={{fontSize:9,color:dim,marginTop:4}}>
                {bufferMode==="seq"?"Op buffer starts after rainy day is full":"Both funded simultaneously each month"}
              </div>
            </div>


            {/* v3.4.0: Mortgage principal paydown bucket */}
            {sect("Mortgage Principal Paydown")}
            <div style={{fontSize:8,color:dim,marginBottom:8,lineHeight:1.6}}>
              Extra principal to 6th St (4.875%) then 15th St (4.35%), fed AFTER all buckets
              and the HI debt sweep, immediately before the surplus→savings sweep. Only while
              the property is still held; Lafayette excluded (low rate/balance). Paying during
              the IO window lowers the 2031 recast payment.
            </div>
            <div data-testid="mtg-principal-toggle" style={{marginBottom:8}}>
              {toggle(mtgPrincipalOn,setMtgPrincipalOn,[
                {v:false,l:"Off",c:dim},{v:true,l:"On",c:green}
              ])}
            </div>
            {mtgPrincipalOn&&(<>
              <div style={{marginBottom:6}}>
                {toggle(mtgPrincipalUncapped,setMtgPrincipalUncapped,[
                  {v:false,l:"Capped",c:amber},{v:true,l:"Uncapped",c:red}
                ])}
              </div>
              {!mtgPrincipalUncapped&&slider("Monthly cap",mtgPrincipalCap,setMtgPrincipalCap,250,10000,250,v=>"$"+v.toLocaleString()+"/mo")}
              {(()=>{
                const totalExtra = wfData.reduce((s,r)=>s+(r.mtgExtra||0),0);
                const last = wfData[wfData.length-1]||{};
                return (
                  <div style={{fontSize:9,color:dim,marginBottom:10}}>
                    Applied over horizon: <span style={{color:green,fontFamily:mono}}>${Math.round(totalExtra/1000)}K</span>
                    {" · "}end balances: 6th <span style={{fontFamily:mono}}>${Math.round((last.mtgBal6||0)/1000)}K</span>,
                    15th <span style={{fontFamily:mono}}>${Math.round((last.mtgBal15||0)/1000)}K</span>
                  </div>
                );
              })()}
            </>)}

            {/* Tier 4: Lifestyle target + Sweep dial */}
            {sect("Tier 4 -- Lifestyle Target (FCF Floor)")}
            <div style={{fontSize:8,color:dim,marginBottom:8,lineHeight:1.6}}>
              This is your guaranteed monthly spend — protected before any debt sweep. Set it by life phase below, or use the fallback for all years.
            </div>
            {slider("Fallback floor (unscheduled years)",discFloor,setDiscFloor,300,4000,100,v=>"$"+v.toLocaleString()+"/mo")}

            {/* FCF Phase Schedule */}
            <div style={{marginTop:8,marginBottom:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>Phase Schedule <span style={{color:dim,fontWeight:"normal"}}>(by decade)</span></span>
                <button onClick={()=>{
                  const prev = (fcfSchedule||[])[fcfSchedule.length-1];
                  const newFrom = prev ? Math.min(2055, prev.yrTo+1) : BASE.startYear;
                  const newTo   = Math.min(2055, newFrom+9);
                  const newFloor = prev ? Math.max(300, prev.floor-500) : discFloor;
                  setFcfSchedule(s=>[...s,{yrFrom:newFrom, yrTo:newTo, floor:newFloor}]);
                }} style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,
                  background:"transparent",border:`1px solid ${bdr}`,color:dim,cursor:"pointer"}}>
                  + add phase
                </button>
              </div>
              <div style={{fontSize:8,color:dim,marginBottom:8}}>
                Override the floor per life phase — whoop it up in your 60s, dial back in your 70s. Years not covered use the fallback above.
              </div>
              {(!fcfSchedule||fcfSchedule.length===0)&&(
                <div style={{fontSize:9,color:bdr,fontStyle:"italic",textAlign:"center",padding:"6px 0"}}>
                  Using flat floor for all years
                </div>
              )}
              {(fcfSchedule||[]).map((entry,ei)=>{
                const ageFrom = 65+(entry.yrFrom-BASE.startYear);
                const ageTo   = 65+(entry.yrTo  -BASE.startYear);
                return (
                  <div key={ei} style={{background:bg2,border:`1px solid ${green}44`,borderRadius:7,
                    padding:"8px 10px",marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:9,color:green,fontWeight:"bold"}}>
                        {entry.yrFrom}–{entry.yrTo} &nbsp;(age {ageFrom}–{ageTo}) &nbsp;→&nbsp;
                        <span style={{color:entry.floor>2000?amber:entry.floor>1200?green:dim}}>
                          ${entry.floor.toLocaleString()}/mo
                        </span>
                      </span>
                      <button onClick={()=>setFcfSchedule(s=>s.filter((_,j)=>j!==ei))}
                        style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                          background:"transparent",border:`1px solid ${bdr}`,color:dim}}>remove</button>
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:6}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:8,color:muted}}>From</span>
                          <span style={{fontSize:8,color:amber,fontFamily:mono}}>{entry.yrFrom} (age {ageFrom})</span>
                        </div>
                        <input type="range" min={BASE.startYear} max={2055} step={1} value={entry.yrFrom}
                          onChange={e=>{const v=parseInt(e.target.value);setFcfSchedule(s=>s.map((x,j)=>j===ei?{...x,yrFrom:v,yrTo:Math.max(v,x.yrTo)}:x));}}
                          style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:8,color:muted}}>To</span>
                          <span style={{fontSize:8,color:amber,fontFamily:mono}}>{entry.yrTo} (age {ageTo})</span>
                        </div>
                        <input type="range" min={BASE.startYear} max={2055} step={1} value={entry.yrTo}
                          onChange={e=>{const v=parseInt(e.target.value);setFcfSchedule(s=>s.map((x,j)=>j===ei?{...x,yrTo:v,yrFrom:Math.min(x.yrFrom,v)}:x));}}
                          style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                      </div>
                    </div>
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:8,color:muted}}>Floor</span>
                        <span style={{fontSize:8,color:green,fontFamily:mono}}>${entry.floor.toLocaleString()}/mo</span>
                      </div>
                      <input type="range" min={300} max={5000} step={100} value={entry.floor}
                        onChange={e=>setFcfSchedule(s=>s.map((x,j)=>j===ei?{...x,floor:parseInt(e.target.value)}:x))}
                        style={{width:"100%",accentColor:green,cursor:"pointer",height:4}}/>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:dim,marginTop:2}}>
                        <span>lean</span>
                        <span style={{color:entry.floor>=3000?amber:dim}}>{entry.floor>=3000?"🎉 whooping it up":entry.floor>=1500?"comfortable":"lean"}</span>
                        <span>splurge</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(fcfSchedule||[]).length>0&&(
                <div style={{fontSize:8,color:dim,marginTop:4,marginBottom:8,fontStyle:"italic"}}>
                  Gaps between phases use the fallback floor (${discFloor.toLocaleString()}/mo)
                </div>
              )}
            </div>

            {sect("Tier 5 -- Surplus Sweep")}
            <div style={{fontSize:8,color:dim,marginBottom:8,lineHeight:1.6}}>
              Surplus above your floor gets split: some boosts your lifestyle further, the rest sweeps debt (or savings once debt is clear). The floor above is your <em>minimum</em> — this dial controls the <em>margin above it</em>.
            </div>
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                <span style={{fontSize:9,color:dim}}>Keep as extra lifestyle vs. sweep</span>
                <span style={{fontSize:9,color:dim}}>{lifestyleSplit}% keep / {100-lifestyleSplit}% sweep</span>
              </div>
              {slider("% of surplus above floor to keep",lifestyleSplit,setLifestyleSplit,0,100,5,v=>`${v}% extra lifestyle / ${100-v}% sweep`)}
              <div style={{fontSize:9,color:dim,marginTop:4,display:"flex",justifyContent:"space-between"}}>
                <span style={{color:lifestyleSplit<=20?red:dim}}>0% = max sweep</span>
                <span style={{color:lifestyleSplit>=80?amber:dim}}>100% = keep it all</span>
              </div>
            </div>
            <div style={{marginBottom:12,padding:"8px 10px",background:blue+"11",border:`1px solid ${blue}33`,borderRadius:6}}>
              <div style={{fontSize:9,color:blue,fontWeight:"bold",marginBottom:4}}>Once HI debt is cleared →</div>
              <div style={{fontSize:8,color:dim,marginBottom:6}}>
                Sweep redirects to long-term savings. Same dial — now controls save-aggressively vs. live-more.
              </div>
              {slider("Grace period (whoop it up first)",sweepDelay||0,setSweepDelay,0,24,1,v=>v===0?"Redirect immediately":v===1?"1 month":""+v+" months")}
            </div>

            {/* Table range */}
            {sect("Table View")}
            {slider("Months to show",wfMonths,setWfMonths,12,120,6,v=>v+" months ("+(v/12).toFixed(1)+" yrs)")}
          </div>

          {/* RIGHT: Charts + table */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Waterfall summary stats */}
            <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14}}>
              <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Waterfall Summary</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(()=>{
                  const rdFull  = wfData.find(r=>r.rdBal>=rdCap);
                  const obFull  = wfData.find(r=>r.obBal>=obCap);
                  const debtClr = wfData.find(r=>r.hiDebt<=0);
                  const avgSweep= Math.round(wfData.slice(0,12).reduce((s,r)=>s+r.sweep,0)/12);
                  return (<>
                    {statBadge("Rainy day full",rdFull?rdFull.cal:"Never",!!rdFull)}
                    {statBadge("Op buffer full",obFull?obFull.cal:"Never",!!obFull)}
                    {statBadge("HI debt clear",debtClr?debtClr.cal:"Never",!!debtClr)}
                    {statBadge("Avg sweep yr1","$"+avgSweep.toLocaleString()+"/mo",avgSweep>2000)}
                    {statBadge("Min FCF","$"+discFloor.toLocaleString()+"/mo",discFloor<=1000)}
                    {(()=>{
                      const totalInterest = wfData.reduce((s,r)=>s+(r.interestPaid||0),0);
                      const totalSweep    = wfData.reduce((s,r)=>s+r.sweep,0);
                      const totalMin      = wfData.reduce((s,r)=>s+(r.minPmt||0),0);
                      const lastDebt      = wfData[wfData.length-1]?.hiDebt||0;
                      // Use final savingsAcc (compounded) not raw sweep sum
                      const totalToInv    = wfData[wfData.length-1]?.savingsAcc || 0;
                      return (<>
                        {statBadge("Total interest paid","$"+(Math.round(totalInterest/1000))+"K over "+Math.round(wfData.length/12)+"yr",totalInterest<50000)}
                        {statBadge("Total debt pmts","$"+(Math.round((totalSweep+totalMin)/1000))+"K",false)}
                        {lastDebt>0&&statBadge("Remaining debt","$"+lastDebt+"K at end",false)}
                        {totalToInv>0&&statBadge("Sweep → savings","$"+Math.round(totalToInv/1000)+"K compounded value",true)}
                      </>);
                    })()}
                  </>);
                })()}
              </div>
            </div>

            {/* Fixed Costs Breakdown panel */}
            {wfData[0]&&(()=>{
              const r0 = wfData[0];
              // Current month values
              const rows_fc = [
                {label:"Mortgages",         sub:properties.filter(p=>(p.hold.mode==='keep')||(p.hold.year||2055)>BASE.startYear).map(p=>p.label).join(" + "),  val:r0.fc_mtg,    color:"#f87171", note:null},
                {label:"Health insurance",  sub:"You + Brenda + kids (until off plan)",                    val:r0.fc_health,  color:"#c084fc", note:null},
                {label:"Core living",       sub:"Car $250 · Other ins $500 · Food $900 · Utilities $400 · Personal $600", val:r0.fc_core, color:"#60a5fa", note:null},
                {label:"HI debt minimums",  sub:"CC + Sophia + Nolan loans",                               val:r0.fc_hiMins,  color:"#fb923c", note:r0.fc_hiMins===0?"Paid off or none":null},
                {label:"Loans",             sub:loans.length?loans.map(l=>`${l.label}: $${Math.round((l.amount||0)/1000)}K @ ${l.rate}% × ${l.months}mo`).join(" · "):"None",
                                            val:r0.fc_famLoan, color:"#f59e0b", note:r0.fc_famLoan===0?(loans.length?"Paid off / not started":"None"):null},
                {label:"Rental op costs",   sub:"Platform/cleaning/vacancy/mgmt fees, applied per segment kind", val:r0.fc_rentalOp||0, color:"#34d399", note:(r0.fc_rentalOp||0)===0?"Self-managed / none":null},
              ];
              const total = rows_fc.reduce((s,r)=>s+r.val,0);
              return (
                <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setFcOpen(o=>!o)}>
                    <div>
                      <span style={{fontSize:10,color:muted,fontWeight:"bold",letterSpacing:1.5,textTransform:"uppercase"}}>Fixed Costs Breakdown</span>
                      <span style={{fontSize:10,color:dim,marginLeft:8}}>launch month</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,color:red,fontFamily:mono,fontWeight:"bold"}}>-${total.toLocaleString()}/mo</span>
                      <span style={{fontSize:9,color:dim}}>{fcOpen?"▲":"▼"}</span>
                    </div>
                  </div>
                  {fcOpen&&(<>
                    <div style={{marginTop:10,borderTop:`1px solid ${bdr}`,paddingTop:10}}>
                      {rows_fc.map(row=>(
                        <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{display:"inline-block",width:6,height:6,borderRadius:1,background:row.color,flexShrink:0}}/>
                              <span style={{fontSize:10,color:row.val===0?dim:bright,fontWeight:row.val>0?"600":"normal"}}>{row.label}</span>
                              {row.note&&<span style={{fontSize:8,color:green,fontFamily:mono}}>{row.note}</span>}
                            </div>
                            <div style={{fontSize:8,color:dim,marginLeft:12,marginTop:1}}>{row.sub}</div>
                          </div>
                          <span style={{fontSize:10,fontFamily:mono,color:row.val===0?dim:red,whiteSpace:"nowrap",marginLeft:8}}>
                            {row.val===0?"—":"-$"+row.val.toLocaleString()+"/mo"}
                          </span>
                        </div>
                      ))}
                      {/* Not modeled section */}
                      <div style={{marginTop:10,borderTop:`1px solid ${bdr}22`,paddingTop:8}}>
                        <div style={{fontSize:9,color:amber,fontWeight:"bold",marginBottom:6,letterSpacing:0.5}}>⚠ Not currently modeled</div>
                        {[
                          {label:"Property/landlord ins. upgrade", sub:"STR/MTR may require special coverage vs standard homeowner policy"},
                          {label:"HOA fees", sub:"Check if 15th St duplex or Lafayette have HOA"},
                          {label:"Rental income tax",  sub:"Rental income is taxable — income tax estimate above includes some of this"},
                        ].map(item=>(
                          <div key={item.label} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:9,color:dim}}>• {item.label}</div>
                              <div style={{fontSize:8,color:dim,opacity:0.7,marginLeft:8}}>{item.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{marginTop:8,fontSize:8,color:dim,fontStyle:"italic"}}>
                        Property tax + insurance tracked separately in the annual engine. Income tax is estimated.
                      </div>
                    </div>
                  </>)}
                </div>
              );
            })()}

                        {/* Stacked bar chart -- annual allocation */}
            <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:"14px 10px 8px"}}>
              <div style={{fontSize:11,color:muted,fontWeight:"bold",marginLeft:8,marginBottom:8}}>Annual Income Allocation</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={wfData.filter(r=>r.mo%12===0).map(r=>{
                  const yr=wfData.filter(d=>Math.floor(d.mo/12)===Math.floor(r.mo/12));
                  return {
                    year:`'${r.cal.slice(-2)}`,
                    Fixed:    Math.round(yr.reduce((s,d)=>s+d.tier1,0)/12),
                    Maint:    Math.round(yr.reduce((s,d)=>s+d.maintRes,0)/12),
                    RainyDay: Math.round(yr.reduce((s,d)=>s+d.rdAdd,0)/12),
                    OpBuffer: Math.round(yr.reduce((s,d)=>s+d.obAdd,0)/12),
                    Sweep:    Math.round(yr.reduce((s,d)=>s+d.sweep,0)/12),
                    Disc:     Math.round(yr.reduce((s,d)=>s+d.disc,0)/12),
                  };
                })} margin={{top:4,right:12,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke={bg3}/>
                  <XAxis dataKey="year" tick={{fontSize:9,fill:dim}} tickLine={false}/>
                  <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:v} tick={{fontSize:9,fill:dim}} tickLine={false} width={42}
                    domain={[0,'auto']} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:"#1a2535",border:`1px solid ${bdr}`,fontSize:10,color:bright}}
                    formatter={(v,n)=>["$"+v.toLocaleString()+"/mo avg",n]}/>
                  <Legend wrapperStyle={{fontSize:9,color:dim}}/>
                  <Bar dataKey="Fixed"    stackId="a" fill="#f87171" name="Fixed costs"/>
                  <Bar dataKey="Maint"    stackId="a" fill="#fb923c" name="Maint reserve"/>
                  <Bar dataKey="RainyDay" stackId="a" fill="#fbbf24" name="Rainy day"/>
                  <Bar dataKey="OpBuffer" stackId="a" fill="#f59e0b" name="Op buffer"/>
                  <Bar dataKey="Sweep"    stackId="a" fill="#a78bfa" name="Debt Sweep"/>
                  <Bar dataKey="Free Cash"     stackId="a" fill="#34d399" name="Free Cash"/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Month-by-month table */}
            <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:11,color:muted,fontWeight:"bold"}}>
                  Month-by-Month Cash Flow
                </div>
                <button data-testid="mbm-breakdown-toggle" onClick={()=>setMbmBreakdown(v=>!v)} style={{
                  background:mbmBreakdown?red+"22":"transparent",border:`1px solid ${mbmBreakdown?red:bdr}`,
                  borderRadius:4,color:mbmBreakdown?red:dim,cursor:"pointer",
                  fontSize:9,padding:"2px 8px",fontFamily:font,
                }}>{mbmBreakdown?"collapse fixed":"fixed breakdown"}</button>
              </div>
              <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
                  <thead style={{position:"sticky",top:0,background:bg2,zIndex:1}}>
                    <tr style={{borderBottom:`1px solid ${bdr}`}}>
                      <th style={{textAlign:"left",padding:"6px 8px",color:dim,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Month</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:green,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Pension</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:green,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>SS</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:green,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Rental</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:amber,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Work</th>
                      <th style={{textAlign:"right",padding:"6px 6px",color:green,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap",borderLeft:`1px solid ${bdr}`}}>Total In</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:red,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Fixed</th>
                      {mbmBreakdown&&[
                        ["Mtg","fc_mtg"],["Prop T/I","fc_propCost"],["Health","fc_health"],["Core","fc_core"],
                        ["Loans","fc_famLoan"],["HI Mins","fc_hiMins"],["Tax","fc_tax"],
                      ].map(([l])=>(
                        <th key={l} style={{textAlign:"right",padding:"6px 6px",color:"#f87171aa",fontWeight:"bold",fontSize:8,whiteSpace:"nowrap",fontStyle:"italic"}}>{l}</th>
                      ))}
                      <th style={{textAlign:"right",padding:"6px 8px",color:"#fb923c",fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Maint Res</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:"#fbbf24",fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Rainy Day</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:amber,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Op Buffer</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:"#a78bfa",fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Debt Sweep</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:blue,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>→ Savings</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:green,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Free Cash</th>
                      <th style={{textAlign:"right",padding:"6px 8px",color:red,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>HI Debt $K</th>
                      <th style={{textAlign:"left",padding:"6px 8px",color:blue,fontWeight:"bold",fontSize:8,whiteSpace:"nowrap"}}>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wfData.slice(0,wfMonths).map((r,i)=>{
                      const hasEvent = r.events.length>0;
                      return (
                        <tr key={i} style={{borderBottom:`1px solid ${bdr}22`,background:hasEvent?blue+"0a":"transparent"}}>
                          <td style={{padding:"5px 8px",color:hasEvent?blue:muted,fontFamily:mono,whiteSpace:"nowrap",fontWeight:hasEvent?"bold":"normal"}}>{r.cal}</td>
                            <td style={{padding:"5px 8px",color:dim,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>${r.pension.toLocaleString()}</td>
                            <td style={{padding:"5px 8px",color:(r.yourSs+r.brendaSs)>0?green:dim,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{(r.yourSs+r.brendaSs)>0?"$"+(r.yourSs+r.brendaSs).toLocaleString():"-"}</td>
                            <td style={{padding:"5px 8px",color:green,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>${r.rental.toLocaleString()}</td>
                            <td style={{padding:"5px 8px",color:r.workIncome>0?amber:dim,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.workIncome>0?"$"+r.workIncome.toLocaleString():"-"}</td>
                            <td style={{padding:"5px 6px",color:green,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap",fontWeight:"bold",borderLeft:`1px solid ${bdr}`}}>${r.totalInc.toLocaleString()}</td>
                          <td style={{padding:"5px 8px",color:red,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>-${r.tier1.toLocaleString()}</td>
                          {mbmBreakdown&&["fc_mtg","fc_propCost","fc_health","fc_core","fc_famLoan","fc_hiMins","fc_tax"].map(k=>(
                            <td key={k} style={{padding:"5px 6px",color:"#f8717199",fontFamily:mono,textAlign:"right",whiteSpace:"nowrap",fontSize:8}}>
                              {(r[k]||0)>0?"-$"+(r[k]||0).toLocaleString():"—"}
                            </td>
                          ))}
                          <td style={{padding:"5px 8px",color:"#fb923c",fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.maintRes>0?"-$"+r.maintRes.toLocaleString():""}</td>
                          <td style={{padding:"5px 8px",color:"#fbbf24",fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.rdAdd>0?"-$"+r.rdAdd.toLocaleString():<span style={{color:rdCap&&r.rdBal>=rdCap?green:dim}}>{r.rdBal>=rdCap?"FULL":""}</span>}</td>
                          <td style={{padding:"5px 8px",color:amber,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.obAdd>0?"-$"+r.obAdd.toLocaleString():<span style={{color:obCap&&r.obBal>=obCap?green:dim}}>{r.obBal>=obCap?"FULL":""}</span>}</td>
                          <td style={{padding:"5px 8px",color:"#a78bfa",fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.sweep>0?"-$"+r.sweep.toLocaleString():""}</td>
                          <td title="Sweep redirected to savings after HI debt is cleared" style={{padding:"5px 8px",color:blue,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.sweepToSavings>0?"→$"+r.sweepToSavings.toLocaleString():""}</td>
                          <td style={{padding:"5px 8px",color:green,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>${r.disc.toLocaleString()}</td>
                          <td style={{padding:"5px 8px",color:r.hiDebt<=0?green:r.hiDebt<100?amber:red,fontFamily:mono,textAlign:"right",whiteSpace:"nowrap"}}>{r.hiDebt<=0?"CLEAR":"$"+r.hiDebt.toLocaleString()+"K"}</td>
                          <td style={{padding:"5px 8px",maxWidth:200}}>
                            {r.events.map((ev,j)=>(
                              <div key={j} style={{color:blue,fontSize:8,whiteSpace:"nowrap"}}>{ev}</div>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )} {/* end cashflow tab */}

      {/* ====== DEFAULTS TAB (v3.4.0) ====== */}
      {activeTab==="defaults" && (()=>{
        const codeGet = path=>pathGet(defaultsCode, path);
        const ovGet   = path=>pathGet(defaultsOv, path);
        const setOverride = (path, val)=>{
          setDefaultsOv(prev=>{
            const next = JSON.parse(JSON.stringify(prev||{}));
            const keys = path.split('.');
            if(val==null || !isFinite(val) || val===codeGet(path)){
              let o=next;
              for(let i=0;i<keys.length-1;i++){ if(!o[keys[i]]) return next; o=o[keys[i]]; }
              delete o[keys[keys.length-1]];
            } else {
              let o=next;
              for(let i=0;i<keys.length-1;i++){ o[keys[i]]=o[keys[i]]||{}; o=o[keys[i]]; }
              o[keys[keys.length-1]]=val;
            }
            return next;
          });
        };
        const resetPaths = paths=>setDefaultsOv(prev=>{
          const next = JSON.parse(JSON.stringify(prev||{}));
          for(const path of paths){
            const keys=path.split('.');
            let o=next, ok=true;
            for(let i=0;i<keys.length-1;i++){ if(!o[keys[i]]){ok=false;break;} o=o[keys[i]]; }
            if(ok) delete o[keys[keys.length-1]];
          }
          return next;
        });
        const modCount = DEFAULTS_REGISTRY.reduce((s,g)=>s+g.items.filter(([p])=>ovGet(p)!=null).length,0);
        const exportDefaults = ()=>{
          const blob=new Blob([JSON.stringify({version:1, savedAt:new Date().toISOString(), overrides:defaultsOv},null,2)],{type:'application/json'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url; a.download=`retirement-defaults-${new Date().toISOString().slice(0,10)}.json`;
          a.click(); URL.revokeObjectURL(url);
        };
        const importDefaults = e=>{
          const file=e.target.files?.[0];
          if(!file) return;
          const reader=new FileReader();
          reader.onload=ev=>{
            try{
              const parsed=JSON.parse(ev.target.result);
              setDefaultsOv(parsed.overrides || parsed || {});
            }catch(err){ alert('Could not read defaults file: '+err.message); }
          };
          reader.readAsText(file);
          e.target.value='';
        };
        return (
        <div data-testid="defaults-tab">
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:12,color:bright,fontWeight:"bold"}}>Model Defaults
                  {modCount>0&&<span data-testid="defaults-mod-count" style={{fontSize:9,color:amber,marginLeft:8,fontFamily:mono}}>{modCount} modified</span>}
                </div>
                <div style={{fontSize:9,color:dim,marginTop:4,lineHeight:1.6,maxWidth:640}}>
                  Every input the model uses that has no slider elsewhere. Edits persist in this browser
                  (localStorage) and merge at the engine's BASE boundary, so both the annual and monthly
                  engines see them. <span style={{color:muted}}>Precedence: a loaded pin's snapshot wins for the
                  scenario params it contains; these overrides fill everything else.</span> Export writes a
                  standalone defaults file — deliberately separate from pin JSONs.
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={exportDefaults} style={{fontSize:9,padding:"4px 10px",borderRadius:4,fontFamily:font,
                  background:"transparent",border:`1px solid ${bdr}`,color:muted,cursor:"pointer"}}>Export JSON</button>
                <label style={{fontSize:9,padding:"4px 10px",borderRadius:4,fontFamily:font,
                  background:"transparent",border:`1px solid ${bdr}`,color:muted,cursor:"pointer"}}>
                  Import JSON<input type="file" accept=".json" onChange={importDefaults} style={{display:"none"}}/>
                </label>
                <button data-testid="defaults-reset-all" onClick={()=>setDefaultsOv({})} style={{fontSize:9,padding:"4px 10px",borderRadius:4,fontFamily:font,
                  background:modCount>0?red+"22":"transparent",border:`1px solid ${modCount>0?red:bdr}`,color:modCount>0?red:dim,cursor:"pointer"}}>
                  Reset ALL to code defaults</button>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))",gap:12}}>
            {DEFAULTS_REGISTRY.map(({group,items})=>{
              const groupMods = items.filter(([p])=>ovGet(p)!=null).length;
              return (
                <div key={group} style={{background:bg1,border:`1px solid ${groupMods?amber+"55":bdr}`,borderRadius:10,padding:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:10,color:muted,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>{group}</div>
                    <button onClick={()=>resetPaths(items.map(([p])=>p))} disabled={!groupMods}
                      style={{fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:groupMods?"pointer":"default",
                        background:"transparent",border:`1px solid ${groupMods?amber:bdr}`,color:groupMods?amber:bdr}}>reset</button>
                  </div>
                  {items.map(([path,label])=>{
                    const code=codeGet(path);
                    const ov=ovGet(path);
                    const modified = ov!=null;
                    return (
                      <div key={path} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <span style={{fontSize:9,color:modified?amber:muted}}>
                            {modified&&<span style={{display:"inline-block",width:6,height:6,borderRadius:3,background:amber,marginRight:5,verticalAlign:"middle"}}/>}
                            {label}
                          </span>
                          {modified&&<span style={{fontSize:8,color:dim,marginLeft:6,fontFamily:mono}}>code: {code}</span>}
                        </div>
                        <input type="number" step="any" data-testid={`default-${path}`}
                          value={ov ?? code ?? ''}
                          onChange={e=>{
                            const v=e.target.value;
                            setOverride(path, v===''?null:parseFloat(v));
                          }}
                          style={{width:110,background:bg2,border:`1px solid ${modified?amber:bdr}`,borderRadius:4,
                            color:modified?amber:bright,fontFamily:mono,fontSize:10,padding:"3px 6px",outline:"none",textAlign:"right"}}/>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* ====== RELATIONSHIPS TAB ====== */}
      {activeTab==="relationships" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:14}}>

          {/* SVG diagram */}
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:12,overflow:"hidden"}}>
            {/* Column headers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",borderBottom:`1px solid ${bdr}`,padding:"7px 0"}}>
              {["FIXED INPUTS","PROPERTY & RENTAL","COSTS","COMPUTED","KEY OUTPUTS"].map((h,i)=>(
                <div key={i} style={{textAlign:"center",fontSize:8,color:dim,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>{h}</div>
              ))}
            </div>

            {/* Filter chips */}
            <div style={{display:"flex",gap:6,padding:"8px 12px",borderBottom:`1px solid ${bdr}`,flexWrap:"wrap"}}>
              {[["all","All"],["fixed","Locked In"],["inflated","Fixed+Inflation"],
                ["choice","Your Decisions"],["market","Market"],["endogenous","Computed"],["output","Outputs"]
              ].map(([key,label])=>{
                const c=key==="all"?"#3b82f6":(REL_COLORS[key]?.border||"#3b82f6");
                const isActive=!relSelected&&key==="all"||false;
                return (
                  <div key={key} style={{padding:"3px 10px",borderRadius:12,border:`1px solid ${c}44`,
                    background:c+"11",color:c,fontSize:9,cursor:"default"}}>
                    {label}
                  </div>
                );
              })}
              {relSelected&&(
                <button onClick={()=>setRelSelected(null)} style={{
                  padding:"3px 10px",borderRadius:12,border:`1px solid ${red}`,
                  background:red+"22",color:red,fontSize:9,cursor:"pointer",fontFamily:font,
                }}>x Clear selection</button>
              )}
            </div>

            <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{display:"block"}}>
              <defs>
                {Object.entries(REL_COLORS).map(([key,c])=>(
                  <marker key={key} id={`rarr-${key}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill={c.border} opacity="0.85"/>
                  </marker>
                ))}
                <marker id="rarr-dim" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="#1e293b"/>
                </marker>
              </defs>

              {/* Edges */}
              {REDGES.map((edge,i)=>{
                const fn=RNODES.find(n=>n.id===edge.f);
                const tn=RNODES.find(n=>n.id===edge.t);
                if(!fn||!tn)return null;
                const fp=rNodePos(fn),tp=rNodePos(tn);
                const x1=fp.x+NODE_W,y1=fp.y+NODE_H/2;
                const x2=tp.x,      y2=tp.y+NODE_H/2;
                const mx=(x2-x1)*0.42;
                const isAct=relActive&&(edge.f===relActive||edge.t===relActive);
                const isDim=relActive&&!isAct;
                const c=REL_COLORS[fn.type];
                return (
                  <g key={i}>
                    <path d={`M ${x1} ${y1} C ${x1+mx} ${y1} ${x2-mx} ${y2} ${x2} ${y2}`}
                      fill="none"
                      stroke={isDim?"#0f161f":isAct?c.border:c.border+"44"}
                      strokeWidth={isAct?edge.s*1.6:edge.s*0.65}
                      markerEnd={isDim?"url(#rarr-dim)":`url(#rarr-${fn.type})`}
                      style={{transition:"all 0.18s"}}/>
                    {isAct&&edge.lbl&&(
                      <text x={(x1+x2)/2} y={Math.min(y1,y2)-5} textAnchor="middle"
                        fontSize="8" fill={c.text} style={{pointerEvents:"none"}}>{edge.lbl}</text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {RNODES.map(node=>{
                const pos=rNodePos(node);
                const c=REL_COLORS[node.type];
                const isAct  =relActive===node.id;
                const isConn =relConnected&&relConnected.has(node.id);
                const isDim  =relActive&&!isConn;
                return (
                  <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                    style={{cursor:"pointer"}}
                    onMouseEnter={()=>setRelHovered(node.id)}
                    onMouseLeave={()=>setRelHovered(null)}
                    onClick={()=>setRelSelected(relSelected===node.id?null:node.id)}
                  >
                    <rect width={NODE_W} height={NODE_H} rx={6}
                      fill={isDim?"#090d13":c.bg}
                      stroke={isAct?c.text:isConn?c.border:isDim?"#141b24":c.border+"55"}
                      strokeWidth={isAct?2.5:isConn?1.5:0.8}
                      style={{transition:"all 0.18s"}}/>
                    <text x={7} y={16} fontSize={9.5} fontWeight="bold"
                      fill={isDim?"#1a2535":c.text} style={{pointerEvents:"none"}}>{node.label}</text>
                    <text x={7} y={29} fontSize={8}
                      fill={isDim?"#111820":isConn?"#94a3b8":dim} style={{pointerEvents:"none"}}>{node.sub}</text>
                    <text x={7} y={43} fontSize={7}
                      fill={isDim?"#0f151d":c.border} style={{pointerEvents:"none"}}>{c.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Info panel */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Legend */}
            <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14}}>
              <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Legend</div>
              {Object.entries(REL_COLORS).map(([key,c])=>(
                <div key={key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                  <div style={{width:12,height:12,borderRadius:3,background:c.bg,border:`2px solid ${c.border}`,flexShrink:0}}/>
                  <div style={{fontSize:10,color:c.text,fontWeight:"bold"}}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Node detail */}
            <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:14,flexGrow:1}}>
              {!relActive?(
                <div style={{fontSize:11,color:dim,lineHeight:1.9}}>
                  <div style={{color:muted,fontWeight:"bold",marginBottom:8}}>Click any node</div>
                  <div>Hover to preview connections</div>
                  <div>Click to lock selection</div>
                  <div>Edge labels appear on click</div>
                  <div style={{marginTop:12,fontSize:10,color:dim}}>
                    {RNODES.length} nodes &middot; {REDGES.length} edges
                  </div>
                </div>
              ):(()=>{
                const node=RNODES.find(n=>n.id===relActive);
                if(!node)return null;
                const c=REL_COLORS[node.type];
                const inE =REDGES.filter(e=>e.t===node.id);
                const outE=REDGES.filter(e=>e.f===node.id);
                return (
                  <>
                    <div style={{borderBottom:`1px solid ${bdr}`,paddingBottom:10,marginBottom:10}}>
                      <div style={{fontSize:13,color:c.text,fontWeight:"bold"}}>{node.label}</div>
                      <div style={{fontSize:10,color:muted,marginTop:2}}>{node.sub}</div>
                      <div style={{fontSize:9,color:c.border,marginTop:4}}>{c.label}</div>
                    </div>
                    {inE.length>0&&(
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Driven by</div>
                        {inE.map((e,i)=>{
                          const fn=RNODES.find(n=>n.id===e.f);
                          return fn?(
                            <div key={i} style={{display:"flex",gap:6,marginBottom:5,alignItems:"flex-start"}}>
                              <div style={{width:8,height:8,borderRadius:2,background:REL_COLORS[fn.type].border,flexShrink:0,marginTop:2}}/>
                              <div>
                                <div style={{fontSize:10,color:bright}}>{fn.label}</div>
                                {e.lbl&&<div style={{fontSize:9,color:dim}}>{e.lbl}</div>}
                              </div>
                            </div>
                          ):null;
                        })}
                      </div>
                    )}
                    {outE.length>0&&(
                      <div>
                        <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Drives</div>
                        {outE.map((e,i)=>{
                          const tn=RNODES.find(n=>n.id===e.t);
                          return tn?(
                            <div key={i} style={{display:"flex",gap:6,marginBottom:5,alignItems:"flex-start"}}>
                              <div style={{width:8,height:8,borderRadius:2,background:REL_COLORS[tn.type].border,flexShrink:0,marginTop:2}}/>
                              <div>
                                <div style={{fontSize:10,color:bright}}>{tn.label}</div>
                                {e.lbl&&<div style={{fontSize:9,color:dim}}>{e.lbl}</div>}
                              </div>
                            </div>
                          ):null;
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

      )} {/* end relationships tab */}

      {/* ====== GLOSSARY TAB ====== */}
      {activeTab==="glossary" && (
        <div style={{margin:"0 auto"}}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,color:dim,fontWeight:"bold",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Terms & Definitions</div>
            <div style={{fontSize:11,color:muted}}>Key concepts used throughout the simulator -- how income is allocated, what each bucket does, and why.</div>
          </div>

          {/* Waterfall diagram -- visual summary */}
          <div style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:10,padding:16,marginBottom:14}}>
            <div style={{fontSize:10,color:dim,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>The Monthly Waterfall -- Priority Order</div>
            <div style={{display:"flex",flexDirection:"column",gap:3,maxWidth:480}}>
              {[
                {n:"1",label:"Fixed Obligations",detail:"Mortgage PITI, health insurance, core living, family loan, HI minimums",color:red},
                {n:"2",label:"Maintenance Reserves",detail:"Per-property, capped at 5 yrs -- excess redirects to sweep",color:"#fb923c"},
                {n:"3",label:"Rainy Day Top-up",detail:"Until cap -- then redirects to sweep",color:"#fbbf24"},
                {n:"4",label:"Operating Buffer Top-up",detail:"Until cap -- then redirects to sweep",color:amber},
                {n:"5",label:"HI Debt Sweep (Avalanche)",detail:"CC 14% first, then Sophia ~8.8%, then Nolan ~8-9%",color:"#a78bfa"},
                {n:"6",label:"Free Cash Flow",detail:"What remains -- genuinely unallocated",color:green},
              ].map((row,i)=>(
                <div key={i} style={{display:"flex",alignItems:"stretch",gap:0}}>
                  <div style={{width:22,minHeight:36,background:row.color+"33",border:`1px solid ${row.color}44`,
                    borderRadius:"4px 0 0 4px",display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:9,color:row.color,fontWeight:"bold",fontFamily:mono,flexShrink:0}}>{row.n}</div>
                  <div style={{flex:1,background:row.color+"11",border:`1px solid ${row.color}22`,
                    borderLeft:"none",borderRadius:"0 4px 4px 0",
                    padding:"6px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:row.color,fontWeight:"bold"}}>{row.label}</span>
                    <span style={{fontSize:9,color:dim,maxWidth:260,textAlign:"right"}}>{row.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10,fontSize:9,color:dim,fontStyle:"italic"}}>
              The Min Free Cash Flow slider sets a floor at step 5 -- the sweep only takes what exceeds that floor. Rainy Day and Operating Buffer top-ups redirect to the sweep once their caps are reached.
            </div>
          </div>

          {/* Term cards grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
            {[
              {
                term:"Free Cash Flow (FCF)",
                short:"What's left after every obligation is met",
                detail:"Income minus all fixed costs, maintenance reserves, rainy day top-up, operating buffer top-up, and HI debt sweep. This is genuinely unallocated money -- no strings attached. The Min FCF slider sets a floor guarantee; actual FCF in any month may be higher if there is nothing left to sweep. This is NOT the same as the Min FCF floor -- the floor is an input, FCF is the output.",
                tag:"Output",tagColor:green,
              },
              {
                term:"Min Free Cash Flow (floor)",
                short:"The minimum you keep before any debt sweep",
                detail:"Every month, the waterfall guarantees you at least this amount before routing anything to HI debt. Think of it as your lifestyle protection number. Setting it too low accelerates debt paydown but leaves you with no buffer for irregular expenses. Setting it too high slows debt paydown unnecessarily.",
                tag:"Your Decision",tagColor:amber,
              },
              {
                term:"Rainy Day Fund",
                short:"Short-term liquid reserve for unexpected small expenses",
                detail:"Funded by a fixed monthly top-up until the cap is reached. Covers car repairs, appliance failures, short medical bills -- anything that would otherwise come out of FCF or force a pause on debt paydown. Once the cap is hit, the monthly top-up redirects to the HI debt sweep. Target: 1-3 months of fixed expenses (~$10K).",
                tag:"Your Decision",tagColor:amber,
              },
              {
                term:"Operating Buffer",
                short:"Medium-term reserve for larger shocks",
                detail:"Funded after (or alongside) the Rainy Day fund. Covers extended rental vacancy, a major property repair, a gap in work income, or any multi-month disruption. This is the fund that would have softened the 2016-2020 period. Once the cap is hit, the monthly top-up redirects to HI debt sweep. Target: 3-6 months of total costs (~$35K).",
                tag:"Your Decision",tagColor:amber,
              },
              {
                term:"HI Debt Sweep",
                short:"Accelerated paydown of high-interest debt",
                detail:"Everything above the Min FCF floor (after rainy day and buffer top-ups) is swept to HI debt in avalanche order: CC at 14% first, then Sophia loans at ~8.8%, then Nolan loans at ~8-9%. The sweep stops when all HI debt is cleared, at which point that monthly cash flow permanently promotes to Free Cash Flow or long-term savings.",
                tag:"Computed",tagColor:"#a78bfa",
              },
              {
                term:"Maintenance Reserve",
                short:"Per-property repair fund, capped to avoid over-reserving",
                detail:"Sized against structure value (not market value -- Boulder land is ~60-65% of total). Each property has its own reserve with a 5-year cap. Once the cap is hit, the monthly amount redirects to the HI debt sweep rather than sitting idle. At 14% CC interest, over-reserving is genuinely costly. Covers roofs, HVAC, appliances, plumbing.",
                tag:"Your Decision",tagColor:amber,
              },
              {
                term:"DI Cap (Effective)",
                short:"Total monthly amount protected from the HI sweep",
                detail:"Derived automatically: Min FCF + Rainy Day top-up + Operating Buffer top-up. This is the number the annual simulation engine uses to determine how aggressively debt is attacked each year. The Cash Flow tab is the source of truth -- there is no separate DI Cap slider anymore.",
                tag:"Derived",tagColor:blue,
              },
              {
                term:"Avalanche Method",
                short:"Debt paydown: highest interest rate first",
                detail:"After minimums are paid on all debts, extra sweep money attacks the highest-rate balance first: CC at 14% before Sophia (~8.8%) before Nolan (~8-9%). This minimizes total interest paid. The snowball method (smallest balance first) feels faster psychologically but costs more in interest over time.",
                tag:"Method",tagColor:dim,
              },
              {
                term:"Work Earned vs Work Required",
                short:"Two different work income numbers -- don't confuse them",
                detail:"Work Income (Cash Flow tab) = combined household work income tapering to $0 over your chosen schedule. Work Required (Simulator chart) = the gap between total costs and passive income (pension + SS + rental). Once passive income covers all costs, Work Required = $0 (work-free) even though work income may still be coming in. The extra flows into Free Cash Flow or debt sweep.",
                tag:"Key Distinction",tagColor:blue,
              },
              {
                term:"IO vs P&I Mortgage",
                short:"Interest-only payments while HI debt exists",
                detail:"While HI debt is outstanding, the duplex and primary mortgages are on interest-only (IO) payments -- lower monthly obligation, maximizing sweep capacity. Once all HI debt is cleared, the mortgages convert to full principal & interest (P&I) payments. This causes a visible bump in fixed costs but is offset by the sweep cash freed up.",
                tag:"Model Logic",tagColor:dim,
              },
              {
                term:"Net Worth",
                short:"Gross asset value minus outstanding debt -- before selling costs",
                detail:"Net Worth = (duplex value + Lafayette value + 6th St value + invested cash) minus (all mortgage balances + HI debt). Important caveat: this does NOT deduct the cost of selling properties. If you liquidated everything, you would net roughly 5% less per property in commissions and closing costs -- on $3-4M of real estate that is a $150-200K overstatement. Think of the chart as 'book net worth' rather than 'liquidation net worth.' It is still the right number to track for FI progress since you are not planning to sell everything at once.",
                tag:"Output",tagColor:green,
              },
              {
                term:"Capital Gains Tax (6th St Sale)",
                short:"What you owe the IRS and Colorado when you sell",
                detail:"Your cost basis is $930K ($730K purchase price + $200K in improvements). As a married couple you exclude the first $500K of gain from federal tax. Any gain above that is taxed at the long-term capital gains rate: 20% federal + 3.8% NIIT (net investment income tax, applies because your income likely exceeds the $250K married threshold) + 4.4% Colorado flat rate = 28.2% combined on the taxable portion. The simulator deducts the full tax bill from sale proceeds before computing what goes to mortgage payoff, HI debt, and invested cash. Note: this is a federal + state estimate only -- consult a CPA before closing.",
                tag:"Model Logic",tagColor:dim,
              },
              {
                term:"IRMAA (Medicare Surcharge)",
                short:"One-year Medicare premium spike, two years after a big income event",
                detail:"Medicare Part B and D premiums are means-tested using your MAGI from two years prior. Selling 6th St creates a large one-time capital gain that spikes your MAGI in the sale year -- Medicare looks back two years, so the surcharge hits in the second year after sale. The simulator adds $700/month ($350 per person) to health costs in that one year. At the highest IRMAA bracket the actual surcharge can be $350-450/person/month depending on how high the MAGI goes. This is an approximation -- actual amount depends on your full-year income picture in the sale year.",
                tag:"Model Logic",tagColor:dim,
              },
            ].map(t=>(
              <div key={t.term} style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:8,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{fontSize:11,color:bright,fontWeight:"bold"}}>{t.term}</div>
                  <span style={{fontSize:8,color:t.tagColor,background:t.tagColor+"22",
                    border:`1px solid ${t.tagColor}44`,borderRadius:3,padding:"1px 6px",
                    whiteSpace:"nowrap",marginLeft:8,flexShrink:0}}>{t.tag}</span>
                </div>
                <div style={{fontSize:10,color:amber,marginBottom:8,fontStyle:"italic"}}>{t.short}</div>
                <div style={{fontSize:9,color:muted,lineHeight:1.7}}>{t.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )} {/* end glossary tab */}

      <div style={{marginTop:12,fontSize:9,color:bg3,textAlign:"center"}}>
        Illustrative only &middot; Not financial advice &middot; Consult a fee-only CFP and CPA before acting
      </div>
    </div>
  );
}
