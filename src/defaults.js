// =============================================================================
// defaults.js  --  DEFAULTS, makeParams, PIN_COLORS, SAVE_SCHEMA_VERSION, SC_DEFAULTS
// =============================================================================
import { BASE, CC_BAL, remainBal, SOPHIA_LOANS, NOLAN_LOANS } from "./engine.js";

export const DEFAULTS = {
  sellYear:      2055,
  lafStopYear:   2055,
  saleDrawFrac:  0,
  keepPrimary:   true,
  topUnit:       "str",
  lafRental:     true,
  sixthMTR:      false,
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
  sixthSalePrice:  1_700_000,
  sixthCostOfSale: 0.05,
  capGainsTax:     0,
  sixthNetProceeds:0,
};

export function makeParams(overrides={}){
  const p={...DEFAULTS,...overrides};
  const willSell = (p.sellYear||2055) <= 2046;
  if(willSell){
    const salePrice   = p.sixthSalePrice || BASE.primaryValue;
    const costOfSale  = p.sixthCostOfSale || BASE.sellingCosts;
    const saleNet     = salePrice * (1 - costOfSale);
    const gain        = Math.max(0, saleNet - BASE.sixthBasis);
    const taxableGain = Math.max(0, gain - BASE.marriedExcl);
    const capGainsTax = taxableGain * (BASE.fedCapGains + BASE.coCapGains);
    const hiPayoff    = p.payOffHI ? ((p.ccBal||CC_BAL)+(p.sophiaBal||58057)+(p.nolanBal||141117)) : 0;
    const yrsPaidAtSale = 5 + ((p.sellYear||2055) - BASE.startYear);
    const mtgPayoff   = remainBal(BASE.primaryMortgage, BASE.primaryRate, 30, yrsPaidAtSale);
    const netProceeds = Math.max(0, saleNet - mtgPayoff - capGainsTax - hiPayoff);
    const saleDraw    = Math.round(netProceeds * (p.saleDrawFrac||0));
    p.investedCash    = Math.max(0, netProceeds - saleDraw);
    p.capGainsTax     = Math.round(capGainsTax);
    p.sixthSaleNet    = Math.round(saleNet);
    p.sixthNetProceeds= Math.round(netProceeds);
    p.saleDraw        = saleDraw;
  } else {
    p.capGainsTax = 0;
    p.sixthSaleNet = 0;
    p.sixthNetProceeds = 0;
    p.saleDraw = 0;
    p.investedCash = p.investedCash || 0;
  }
  return p;
}

export const PIN_COLORS = ["#f59e0b","#f472b6","#34d399","#60a5fa","#a78bfa","#fb923c"];
export const SAVE_SCHEMA_VERSION = 2;

export const SC_DEFAULTS = {
  sellYear:      2055,
  lafStopYear:   2055,
  saleDrawFrac:  0,
  keepPrimary:   true,
  sixthSalePrice:1700000,
  sixthCostOfSale:5.0,
  topUnit:       "str",
  lafRental:     true,
  sixthMTR:      false,
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
  duplex15thBasis: 600_000,
  lafayetteBasis:  300_000,
};
