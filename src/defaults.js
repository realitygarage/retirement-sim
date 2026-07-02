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
  hiPaydownPct:             100,    // 0-100% of residual, default 100 (avalanche)
  caGainCap:          1_200_000,    // CA $1.2M prior-1031 gain cap (§4.6)
};

// -----------------------------------------------------------------------------
// SIXTH_STR_DEFAULTS -- 6th St short-term rental (mirrors duplex-top STR pattern)
// -----------------------------------------------------------------------------
export const SIXTH_STR_DEFAULTS = {
  sixthIncomeMode:         'none',   // 'none' | 'mtr' | 'str'
  sixthSTRMonthly:          9_000,   // $/mo gross when STR-active; slider +/-50%
  sixthSTRSchedule:            [],   // same shape as strSchedule
  sixthSTRStartYear:         2026,
  sixthSTRStopYear:          2055,
  sixthSTRStopOnDebtClear:   true,   // auto-stop STR the year HI debt hits 0
  // v3.1.1 segmented income editor -- overrides the simple mode selector when non-empty.
  // [{ yrFrom, yrTo, kind:'str'|'mtr'|'ltr',
  //    str:[{days,rate,type}], mtr:[{months,rate}], ltr:{monthlyRent} }]
  sixthIncomeSegments:         [],
};

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
  famLoanAmt:    25_000,
  famLoanRate:   0.075,
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
  famLoanAmt:    25000,  famLoanRate:7.5,
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
