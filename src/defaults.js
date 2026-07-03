// =============================================================================
// defaults.js  --  DEFAULTS, makeParams, PIN_COLORS, SAVE_SCHEMA_VERSION, SC_DEFAULTS
// v3.1.0: per-property dispositions replace bespoke 6th-only sale block.
//         Schema v3 -- old pins from v2.x are silently dropped on load.
// =============================================================================
import { BASE, DISPO_DEFAULTS } from "./engine.js";

// -----------------------------------------------------------------------------
// LIQUIDATION_DEFAULTS -- per-property CPA-worksheet figures.
// Source: Ottinger.xlsx, 2026 accountant liquidation worksheet (Remax net sheets).
// All figures are estimates; UI slider range = +/-50% of default.
// -----------------------------------------------------------------------------
export const LIQUIDATION_DEFAULTS = {
  sixth: {
    label: '6th St (home)',
    salesPrice:             1_675_000,
    adjustedBasis:            899_550,  // $735K cost + $76K improvements + $88.55K closing
    sec121Exclusion:          500_000,
    caSourceDeferredGain:           0,
    depreciationRecapture:          0,
    cpaEstTax:                 62_000,  // Fed 50K + CO 12K + CA 0
    cpaNetProceedsAfterTax:   708_881,
  },
  barberry: {                            // = Lafayette in sim (see spec §0)
    label: '540 Barberry / Lafayette (rental)',
    salesPrice:               625_000,
    adjustedBasis:            183_043,  // carryover after 1031, per sheet
    sec121Exclusion:                0,
    caSourceDeferredGain:     391_507,
    depreciationRecapture:     21_500,
    cpaEstTax:                124_000,  // Fed 80K + CO 0 + CA 44K
    cpaNetProceedsAfterTax:   283_567,
  },
  fifteenth: {
    label: '2224 15th St (rental)',
    salesPrice:             1_375_000,
    adjustedBasis:            424_309,
    sec121Exclusion:                0,
    caSourceDeferredGain:     801_441,
    depreciationRecapture:     44_000,
    cpaEstTax:                288_000,  // Fed 200K + CO 8K + CA 80K
    cpaNetProceedsAfterTax:   656_470,
  },
};

// -----------------------------------------------------------------------------
// SETTLEMENT_DEFAULTS
// -----------------------------------------------------------------------------
export const SETTLEMENT_DEFAULTS = {
  settlementNeed:        525_000,   // slider band 450K-525K; hard range +/-50%
  settlementYear:        2026,
  gainOffsetPct:              0,    // 0-100, DEFAULT OFF (Kimbell/Arrowsmith, UNCONFIRMED)
  sameYearSaleTaxBump:   50_000,    // +tax if all 3 sold same calendar year
  sameYearSaleTaxBumpOn:  true,
  requireSameYearForOffset: true,
  settleLifestyleDraw:        0,    // v3.2.0: (a) one-time lifestyle draw from residual, $
  hiPaydownPct:             100,    // v3.2.0: (b) % of (residual - draw) to HI debt avalanche
  caGainCap:          1_200_000,    // CA $1.2M prior-1031 gain cap (§4.6)
};

// -----------------------------------------------------------------------------
// LOANS (v3.2.0) -- generalized loan segments, replaces famLoanAmt/famLoanRate.
// SC-facing shape (rate as %); engine-facing copies use rate as decimal.
// startMonth is a calendar month number (1-12); model launch is Jun 2026.
// -----------------------------------------------------------------------------
export const DEFAULT_LOANS_SC = [
  { label:'Family loan', amount:25_000, startYear:2026, startMonth:6, months:8, rate:7.5, includeInSweep:false },
];

// Resolve a saved scenario's loans with legacy famLoan back-compat:
// explicit loans array wins; else famLoanAmt>0 converts to a "Family loan" row,
// famLoanAmt===0 means NO loans; else fall back to defaults. Rates stay in %.
export function migrateScLoans(snap){
  if(Array.isArray(snap?.loans)) return snap.loans;
  if(snap && snap.famLoanAmt !== undefined){
    return snap.famLoanAmt>0
      ? [{ label:'Family loan', amount:snap.famLoanAmt, startYear:2026, startMonth:6,
           months:8, rate:snap.famLoanRate ?? 7.5, includeInSweep:false }]
      : [];
  }
  return DEFAULT_LOANS_SC;
}

// -----------------------------------------------------------------------------
// SIXTH_STR_DEFAULTS -- 6th St short-term rental (mirrors duplex-top STR pattern)
// -----------------------------------------------------------------------------
// v3.3.0: segments-only 6th St income. The mode selector (none/mtr/str), the
// flat STR params, and the debt-clear auto-stop are GONE -- sixthIncomeSegments
// is the sole driving input; empty list = no 6th St income. Concurrent
// (overlapping) segments SUM.
// [{ yrFrom, yrTo, kind:'str'|'mtr'|'ltr',
//    str:[{days,rate,type}], mtr:[{months,rate}], ltr:{monthlyRent} }]
export const SIXTH_STR_DEFAULTS = {
  sixthIncomeSegments: [],
};

// Legacy 6th St income back-compat (v3.3.0): pins saved with the old mode
// selector convert to equivalent segments. Explicit non-empty segments win;
// mode 'mtr' (or the older sixthMTR:true) becomes one flat MTR segment from
// the pin's rate x months; mode 'str' becomes one STR segment over
// [startYear, stopYear-1] whose 360d x ($/mo, monthly-type) inner grosses
// exactly 12 x monthly -- identical income to the old flat path. The removed
// sixthSTRStopOnDebtClear field is ignored silently. (Schedule-detail fields
// mtrSchedule / sixthSTRSchedule are NOT converted -- flat values only.)
export function migrateSixthIncomeSegments(o={}){
  const segs = Array.isArray(o.sixthIncomeSegments) ? o.sixthIncomeSegments : [];
  if(segs.length) return segs;
  const mode = o.sixthIncomeMode || (o.sixthMTR ? 'mtr' : 'none');
  if(mode==='mtr'){
    const rate   = o.sixthMTRRent   ?? o.sixthRent   ?? 6000;
    const months = o.sixthMTRMonths ?? o.sixthMonths ?? 10;
    if(rate>0 && months>0)
      return [{ yrFrom:2026, yrTo:2046, kind:'mtr',
        mtr:[{months, rate}], str:[{days:120,rate:280,type:'nightly'}], ltr:{monthlyRent:rate} }];
  }
  if(mode==='str'){
    const monthly = o.sixthSTRMonthly ?? 9000;
    const from = o.sixthSTRStartYear ?? 2026;
    const to   = Math.min(2046, (o.sixthSTRStopYear ?? 2055) - 1);
    if(monthly>0 && to>=from)
      return [{ yrFrom:from, yrTo:to, kind:'str',
        str:[{days:360, rate:monthly, type:'monthly'}], mtr:[{months:10,rate:6000}], ltr:{monthlyRent:6000} }];
  }
  return [];
}

// -----------------------------------------------------------------------------
// Helper: build one disposition entry from LIQUIDATION_DEFAULTS
// -----------------------------------------------------------------------------
function dispoEntry(key) {
  const liq = LIQUIDATION_DEFAULTS[key];
  return {
    mode:      'keep',                 // 'keep' | 'sell_taxable' | 'full_1031' | 'partial_1031'
    year:      2055,
    saleMode:  'market',               // 'market' | 'forced'
    cashBoot:  0,                      // partial_1031 only
    salesPrice:             liq.salesPrice,
    adjustedBasis:          liq.adjustedBasis,
    sec121Exclusion:        liq.sec121Exclusion,
    caSourceDeferredGain:   liq.caSourceDeferredGain,
    depreciationRecapture:  liq.depreciationRecapture,
    // CPA reference (for reconciliation card, not simulated)
    cpaEstTax:              liq.cpaEstTax,
    cpaNetProceedsAfterTax: liq.cpaNetProceedsAfterTax,
  };
}

// =============================================================================
// DEFAULTS  --  engine-facing values (rates as decimals)
// =============================================================================
export const DEFAULTS = {
  lafStopYear:   2055,     // rental-stop year for Lafayette (independent of sale)
  topUnit:       "str",
  lafRental:     true,
  payOffHI:      false,
  ssStartYear:   2026,
  ssAmount:      BASE.yourSsEarly,
  workPts: [{yr:0,val:5417},{yr:2,val:3000},{yr:5,val:1000},{yr:8,val:0}],
  lifestyleSplit: 30,
  diCap:         1200,
  duplexBottomLTR: 3_520,
  duplexTopSTR:  2800,
  duplexTopLTR:  3100,
  duplexTopMTR:  3100,
  sixthMTRRent:   6000,
  sixthMTRMonths: 10,
  reAppreciation:0.04,
  rentGrowth:    0.03,
  inflation:     0.028,
  healthCpi:     0.05,
  propCpi:       0.035,
  propInflation: 0.035,
  taxEnabled:    true,
  investReturn:  0.055,
  maintRate:     0.01,
  ccBal:         60_000,   ccRate:    0.14,  ccMin:   1200,
  sophiaBal:     58_057,   sophiaRate:0.0814,sophiaMin: 737,
  nolanBal:     141_117,   nolanRate: 0.084, nolanMin: 1787,
  loans:         DEFAULT_LOANS_SC.map(l=>({...l, rate:l.rate/100})),  // engine-facing decimals
  investedCash:  0,
  lifestyleDraws: [],
  strSchedule:   [],
  mtrSchedule:   [],
  // v3.1.0 per-property dispositions
  dispositions: {
    sixth:     dispoEntry('sixth'),
    barberry:  dispoEntry('barberry'),
    fifteenth: dispoEntry('fifteenth'),
  },
  // v3.1.0 settlement
  ...SETTLEMENT_DEFAULTS,
  // v3.1.0 6th St STR group
  ...SIXTH_STR_DEFAULTS,
};

// =============================================================================
// makeParams  --  spread + normalize dispositions (no bespoke sale math)
// =============================================================================
export function makeParams(overrides={}){
  const p={...DEFAULTS,...overrides};
  // Merge disposition entries so partial overrides pick up default field values
  p.dispositions = {
    sixth:     { ...DEFAULTS.dispositions.sixth,     ...(overrides.dispositions?.sixth     || {}) },
    barberry:  { ...DEFAULTS.dispositions.barberry,  ...(overrides.dispositions?.barberry  || {}) },
    fifteenth: { ...DEFAULTS.dispositions.fifteenth, ...(overrides.dispositions?.fifteenth || {}) },
  };
  // v3.2.0 legacy famLoan back-compat (engine-facing: rate as decimal).
  // Explicit loans array wins; famLoanAmt===0 means no loans.
  if(!Array.isArray(overrides.loans) && overrides.famLoanAmt !== undefined){
    p.loans = overrides.famLoanAmt>0
      ? [{ label:'Family loan', amount:overrides.famLoanAmt, startYear:2026, startMonth:6,
           months:8, rate:overrides.famLoanRate ?? 0.075, includeInSweep:false }]
      : [];
  }
  p.loans = (p.loans||[]).filter(l=>l && (l.amount||0)>0 && (l.months||0)>0);
  // v3.3.0: legacy 6th St mode params convert to segments (segments-only model)
  p.sixthIncomeSegments = migrateSixthIncomeSegments(overrides);
  return p;
}

export const PIN_COLORS = ["#f59e0b","#f472b6","#34d399","#60a5fa","#a78bfa","#fb923c"];
export const SAVE_SCHEMA_VERSION = 3;  // v3.1.0: schema break, no back-compat with v2.x

// =============================================================================
// SC_DEFAULTS  --  UI-facing scenario snapshot (rates as %, ints where UI is int)
// =============================================================================
export const SC_DEFAULTS = {
  lafStopYear:   2055,
  topUnit:       "str",
  lafRental:     true,
  payOffHI:      false,
  ssAge:         65,
  workPts:       [{yr:0,val:5417},{yr:2,val:3000},{yr:5,val:1000},{yr:8,val:0}],
  lifestyleSplit:30,
  strRent:       2800,
  bottomRent:    3520,
  ltrRent:       3100,
  sixthRent:     6000,
  sixthMonths:   10,
  reApp:         4.0,
  rentGr:        3.0,
  cpi:           2.8,
  healthCpi:     5.0,
  propCpi:       3.5,
  taxEnabled:    true,
  investRet:     5.5,
  lifestyleDraws:[],
  strSchedule:[],
  mtrSchedule:[],
  ccBal:         60000,  ccRate:14.0,  ccMin:1200,
  sophiaBal:     58057,  sophiaRate:8.14, sophiaMin:737,
  nolanBal:      141117, nolanRate:8.40,  nolanMin:1787,
  loans:         DEFAULT_LOANS_SC,   // rate as %
  rdTopUp:400, rdCap:10000, obTopUp:500, obCap:35000,
  discFloor:800, fcfSchedule:[], sweepDelay:0, struct6:600, struct15:500, structLaf:250,
  maintStr:0.75, bufferMode:"seq",
  strPlatformPct: 3.0,
  strCleanPct:    4.0,
  mgrPct:         0.0,
  // v3.1.0 per-property dispositions (dollars, no % conversion needed)
  dispositions: {
    sixth:     dispoEntry('sixth'),
    barberry:  dispoEntry('barberry'),
    fifteenth: dispoEntry('fifteenth'),
  },
  // v3.1.0 settlement
  ...SETTLEMENT_DEFAULTS,
  // v3.1.0 6th St STR group
  ...SIXTH_STR_DEFAULTS,
};
