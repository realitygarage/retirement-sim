// =============================================================================
// defaults.js  --  DEFAULTS, makeParams, PIN_COLORS, SAVE_SCHEMA_VERSION, SC_DEFAULTS
// v4.0.0-A: property-centric schema. properties[] replaces the flat
//           dispositions/sixthIncomeSegments/topUnit/lafRental model.
//           NO backward compatibility -- fresh schema, no migration.
// =============================================================================
import { BASE, DISPO_DEFAULTS } from "./engine.js";

// -----------------------------------------------------------------------------
// PROPERTIES_DEFAULTS (v4.0.0-A) -- one entry per property; units array length
// 1 or 2. mortgage.rate and appreciationPct are stored as DECIMALS in both the
// engine-facing DEFAULTS and the UI-facing SC_DEFAULTS (unlike the old %-in-SC
// convention for ccRate/sophiaRate/etc) -- this is new nested data, not a flat
// knob, so there's no separate SC->engine conversion step for it; sliders that
// edit these fields format the display as % but store the decimal directly.
// Mortgage figures calibrated from servicer statements, Jul 2026 (v3.4.0).
// Basis/CPA figures from the accountant liquidation worksheet (v3.1.0).
// -----------------------------------------------------------------------------
export function freshPropertiesDefaults(){
  return [
    {
      id: 'sixth', label: '6th St (home)', isPrimary: true,
      value: 1_675_000, appreciationPct: null,   // null = inherit the Economy appreciation rate
      mortgage: { balance: 805_495, rate: 0.04875, originYear: 2021, originMonth: 7, termYears: 30, ioYears: 10 },
      hold: {
        mode: 'keep', year: 2055, quarter: 2, saleMode: 'market', cashBoot: 0,
        basis: 899_550, sec121Exclusion: 500_000, caSourceDeferredGain: 0, depreciationRecapture: 0,
        cpaEstTax: 62_000, cpaNetProceedsAfterTax: 708_881,
      },
      units: [
        { id: 'sixth-main', label: 'Main', segments: [] },
      ],
    },
    {
      id: 'fifteenth', label: '2224 15th St (rental)', isPrimary: false,
      value: 1_375_000, appreciationPct: null,
      mortgage: { balance: 347_601, rate: 0.0435, originYear: 2021, originMonth: 7, termYears: 30, ioYears: 10 },
      hold: {
        mode: 'keep', year: 2055, quarter: 2, saleMode: 'market', cashBoot: 0,
        basis: 424_309, sec121Exclusion: 0, caSourceDeferredGain: 801_441, depreciationRecapture: 44_000,
        cpaEstTax: 288_000, cpaNetProceedsAfterTax: 656_470,
      },
      units: [
        { id: 'fifteenth-top', label: 'Top unit', segments: [
          { yrFrom: 2026, yrTo: 2046, kind: 'str',
            str: [{ days: 120, rate: 280, type: 'nightly' }], mtr: [{ months: 10, rate: 3100 }], ltr: { monthlyRent: 3100 } },
        ] },
        { id: 'fifteenth-bottom', label: 'Bottom unit', segments: [
          { yrFrom: 2026, yrTo: 2046, kind: 'ltr',
            str: [{ days: 120, rate: 280, type: 'nightly' }], mtr: [{ months: 10, rate: 3520 }], ltr: { monthlyRent: 3520 } },
        ] },
      ],
    },
    {
      id: 'barberry', label: '540 Barberry / Lafayette (rental)', isPrimary: false,
      value: 625_000, appreciationPct: null,
      // ioYears:0 -- amortizing from origination (no interest-only period), matching the
      // pre-v4 Lafayette treatment. Same mortgage state machine as the IO/recast properties.
      // originMonth:1 (not 7, unlike sixth/fifteenth's servicer-calibrated Jul origin) --
      // preserves the pre-v4 remainBal(...,5+yr) convention, which assumed exactly 5 years
      // paid as of Jan 2026 (60 months); Barberry's true origination date is uncalibrated.
      mortgage: { balance: 181_115, rate: 0.0410, originYear: 2021, originMonth: 1, termYears: 30, ioYears: 0 },
      hold: {
        mode: 'keep', year: 2055, quarter: 2, saleMode: 'market', cashBoot: 0,
        basis: 183_043, sec121Exclusion: 0, caSourceDeferredGain: 391_507, depreciationRecapture: 21_500,
        cpaEstTax: 124_000, cpaNetProceedsAfterTax: 283_567,
      },
      units: [
        { id: 'barberry-main', label: 'Main', segments: [
          { yrFrom: 2026, yrTo: 2046, kind: 'ltr',
            str: [{ days: 120, rate: 280, type: 'nightly' }], mtr: [{ months: 10, rate: 3150 }], ltr: { monthlyRent: 3150 } },
        ] },
      ],
    },
  ];
}

// -----------------------------------------------------------------------------
// ONE-TIME OBLIGATION (v4.0.0-A, was Settlement). offsetsCapitalGains: when true,
// the obligation amount reduces that year's recognized capital gains (capped at
// the gains pool) -- the Kimbell/Arrowsmith position, now assumed fully applied
// (no percentage slider). The obligation still ALSO reduces the year's pooled
// cash (paid out regardless of the tax treatment).
// -----------------------------------------------------------------------------
export function freshObligationDefaults(){
  return { amount: 525_000, year: 2026, quarter: 2, offsetsCapitalGains: true };
}

// -----------------------------------------------------------------------------
// LOANS (v3.2.0) -- generalized loan segments, unrelated to the v4 property
// schema change; unchanged.
// -----------------------------------------------------------------------------
export const DEFAULT_LOANS_SC = [
  { label:'Family loan', amount:25_000, startYear:2026, startMonth:6, months:8, rate:7.5, includeInSweep:false },
];

// =============================================================================
// DEFAULTS  --  engine-facing values (rates as decimals)
// =============================================================================
export const DEFAULTS = {
  payOffHI:      false,
  ssStartYear:   2026,
  ssAmount:      BASE.yourSsEarly,
  workPts: [{yr:0,val:5417},{yr:2,val:3000},{yr:5,val:1000},{yr:8,val:0}],
  lifestyleSplit: 30,
  diCap:         1200,
  discFloor:     800,   // v4.1.7: fcfChart/sweepChart's floor term -- matches SC_DEFAULTS.discFloor
  // v4.0.0-A cost profiles (economy knobs, applied automatically by segment kind)
  strPlatformPct: 0.03,
  strCleanPct:    0.04,
  mgrPct:         0,
  ltrVacancyPct:  0.04,
  mtrCleaningFlat: 300,
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
  // v3.4.0 mortgage-principal waterfall bucket (after HI sweep, before savings)
  mtgPrincipalOn:       false,
  mtgPrincipalCap:      2_000,   // $/mo
  mtgPrincipalUncapped: false,
  investedCash:  0,
  lifestyleDraws: [],
  // v4.0.0-A property-centric schema
  properties: freshPropertiesDefaults(),
  obligation: freshObligationDefaults(),
  settleLifestyleDraw:      0,     // pooled-routing (a) one-time draw, $
  settleDrawLabel:         '',     // pooled-routing (a) optional label -- lifestyle vs. other use
  caGainCap:        1_200_000,     // CA $1.2M prior-1031 gain cap (§4.6, unchanged)
  sameYearSaleTaxBump:   50_000,   // +tax if ALL properties sold same calendar year
  sameYearSaleTaxBumpOn:  true,
};

// =============================================================================
// makeParams  --  spread + deep-normalize properties (no legacy field mapping)
// =============================================================================
export function makeParams(overrides={}){
  const p={...DEFAULTS,...overrides};
  const baseProps = freshPropertiesDefaults();
  const ovProps = Array.isArray(overrides.properties) ? overrides.properties : null;
  // Merge by id so partial overrides (e.g. just {hold:{mode:'sell', year:2028}})
  // pick up every other default field. Properties not present in the override
  // fall back to fresh defaults untouched.
  p.properties = baseProps.map(base=>{
    const ov = ovProps?.find(x=>x.id===base.id);
    if(!ov) return base;
    return {
      ...base, ...ov,
      mortgage: { ...base.mortgage, ...(ov.mortgage||{}) },
      hold: { ...base.hold, ...(ov.hold||{}) },
      units: Array.isArray(ov.units) ? ov.units.map((u,i)=>({ ...(base.units[i]||{}), ...u,
        segments: Array.isArray(u.segments) ? u.segments : (base.units[i]?.segments||[]) })) : base.units,
    };
  });
  p.obligation = { ...freshObligationDefaults(), ...(overrides.obligation||{}) };
  p.loans = (p.loans||[]).filter(l=>l && (l.amount||0)>0 && (l.months||0)>0);
  return p;
}

export const PIN_COLORS = ["#f59e0b","#f472b6","#34d399","#60a5fa","#a78bfa","#fb923c"];
export const SAVE_SCHEMA_VERSION = 4;  // v4.0.0-A: schema break, no back-compat with v3.x

// =============================================================================
// SC_DEFAULTS  --  UI-facing scenario snapshot (rates as %, ints where UI is int)
// =============================================================================
export const SC_DEFAULTS = {
  payOffHI:      false,
  ssAge:         65,
  workPts:       [{yr:0,val:5417},{yr:2,val:3000},{yr:5,val:1000},{yr:8,val:0}],
  lifestyleSplit:30,
  reApp:         4.0,
  rentGr:        3.0,
  cpi:           2.8,
  healthCpi:     5.0,
  propCpi:       3.5,
  taxEnabled:    true,
  investRet:     5.5,
  lifestyleDraws:[],
  ccBal:         60000,  ccRate:14.0,  ccMin:1200,
  sophiaBal:     58057,  sophiaRate:8.14, sophiaMin:737,
  nolanBal:      141117, nolanRate:8.40,  nolanMin:1787,
  loans:         DEFAULT_LOANS_SC,   // rate as %
  mtgPrincipalOn:false, mtgPrincipalCap:2000, mtgPrincipalUncapped:false,
  rdTopUp:400, rdCap:10000, obTopUp:500, obCap:35000,
  discFloor:800, fcfSchedule:[], sweepDelay:0, struct6:600, struct15:500, structLaf:250,
  maintStr:0.75, bufferMode:"seq",
  strPlatformPct: 3.0,
  strCleanPct:    4.0,
  mgrPct:         0.0,
  ltrVacancyPct:  4.0,     // v4.0.0-A: %, applied to LTR segment income only
  mtrCleaningFlat: 300,    // v4.0.0-A: flat $ per MTR block present that year
  // v4.0.0-A property-centric schema (dollars/decimals -- no % conversion needed)
  properties: freshPropertiesDefaults(),
  obligation: freshObligationDefaults(),
  settleLifestyleDraw:      0,
  settleDrawLabel:         '',
  caGainCap:        1_200_000,
  sameYearSaleTaxBump:   50_000,
  sameYearSaleTaxBumpOn:  true,
};
