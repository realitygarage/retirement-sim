// =============================================================================
// engine.js  --  Pure calculation engine, no React/JSX
// =============================================================================

// =============================================================================
// LOAN DATA (actual balances Feb 2026)
// =============================================================================
export const SOPHIA_LOANS = [
  { bal: 29260.99, rate: 0.0883 },
  { bal: 14190.95, rate: 0.0780 },
  { bal: 14605.68, rate: 0.0780 },
];
export const NOLAN_LOANS = [
  { bal: 40187.28, rate: 0.0894 },
  { bal: 20764.53, rate: 0.0908 },
  { bal: 42144.30, rate: 0.0805 },
  { bal: 38020.96, rate: 0.0754 },
];
export const CC_BAL   = 60_000;
export const CC_RATE  = 0.14;
export const HI_TOTAL = SOPHIA_LOANS.reduce((s,l)=>s+l.bal,0) + NOLAN_LOANS.reduce((s,l)=>s+l.bal,0) + CC_BAL;

// =============================================================================
// BASE CONSTANTS (never mutated -- engine reads via cfg overrides)
// =============================================================================
export const BASE = {
  myAge:65, wifeAge:60, startYear:2026,
  // v4.3.0: explicit model anchor -- "now" is startMonth/startYear, not an
  // implicit Jan 1. Both editable on the Defaults tab (DEFAULTS_REGISTRY in
  // App.jsx) since the whole point of making this explicit is that it must
  // be kept current, not a stale hardcoded constant. See monthsInYear/
  // monthsElapsedBeforeYear below -- both engines share them so the
  // partial-first-year length and growth-exponent basis can't drift apart.
  startMonth:7,
  sellingCosts:0.05,   // liq-NW quick-calc constant (not the per-disposition sellingCostsPct)
  healthYouEricsson:839, healthYouMedicare:335, healthMedicareInflation:0.04,
  healthBrendaEricsson:839, healthBrendaMedicare:335, ericssonInflation:0.015,
  healthKids:414,
  sophiaOff:2028, nolanOff:2031, brendaMedYear:2032,
  lafTaxMo:267, lafInsMo:154, dplxTaxMo:700, dplxInsMo:183, primTaxMo:873, primInsMo:200,
  carLease:250, otherIns:500, food:900, utilities:400, personal:600,
  pensionMonthly:3_300,
  yourSsEarly:3_271, yourSsFRA:3_874,
  brendaSsFRA:1_937,
  brendaFraYear:2034,
  marriedExcl:   500_000,   // liq-NW quick-calc §121 approximation (generic, not property-specific)
  fedCapGains:   0.238,     // liq-NW quick-calc cap-gains rate
  coCapGains:    0.044,
  irmaaSurge:    350,
};

// =============================================================================
// MODEL START-DATE ANCHOR (v4.3.0) -- yr=0 in buildScenario's annual loop
// covers only the months remaining in the start year (a genuine partial
// period, e.g. 6 months for a July start) instead of a fabricated full
// Jan-Dec year; yr>=1 stay full 12-month calendar years. Both buildScenario
// and the wfData monthly engine (App.jsx) share this convention so the
// partial-period length and the elapsed-time basis used for appreciation/
// rent-growth/inflation exponents cannot drift apart. Both collapse to the
// old plain-integer-yr behavior exactly when startMonth===1 (January).
// =============================================================================
export function monthsInYear(yr, startMonth){
  return yr===0 ? (13-startMonth) : 12;
}
export function monthsElapsedBeforeYear(yr, startMonth){
  return yr<=0 ? 0 : (13-startMonth) + 12*(yr-1);
}

// =============================================================================
// PROPERTY MORTGAGE STRUCTURE (v3.4.0, generalized v4.0.0-A) -- each property
// owns a mortgage { balance, rate, originYear, originMonth, termYears, ioYears }.
// A single state machine covers both IO/recast loans (6th, 15th: 10-yr IO,
// balance FLAT through IO absent extra principal, then payment recasts to
// amortize the ACTUAL remaining balance over the remaining term) and fully
// amortizing loans (Barberry/Lafayette: ioYears:0 recasts immediately at
// origination). Escrow/tax/insurance stay in their separate cost lines.
// =============================================================================
export function mortgageMonthsSince(m, calYear, calMonth1to12){
  return (calYear-(m.originYear||2021))*12 + (calMonth1to12-(m.originMonth||7));
}
// Balance on the no-extra-principal schedule (flat through IO, then annuity)
export function mortgageBalanceClosed(m, monthsSinceOrigin){
  const ioM=(m.ioYears||10)*12;
  if(monthsSinceOrigin<=ioM) return m.balance;
  const rm=m.rate/12, n=((m.termYears||30)-(m.ioYears||10))*12;
  const k=Math.min(monthsSinceOrigin-ioM, n);
  const pmt=loanMonthlyPmt(m.balance, m.rate, n);
  return Math.max(0, m.balance*Math.pow(1+rm,k) - pmt*(Math.pow(1+rm,k)-1)/rm);
}
// Scheduled payment (interest-only during IO, recast annuity after)
export function mortgagePaymentClosed(m, monthsSinceOrigin){
  if(monthsSinceOrigin < (m.ioYears||10)*12) return m.balance*m.rate/12;
  return loanMonthlyPmt(m.balance, m.rate, ((m.termYears||30)-(m.ioYears||10))*12);
}

// -----------------------------------------------------------------------------
// DEFAULTS-TAB OVERRIDES (v3.4.0): the Defaults tab edits model constants that
// have no slider. Overrides merge here, at the BASE boundary, so BOTH engines
// see them (they read these objects live). Precedence: a pin's paramSnapshot
// wins for the sc params it contains; these overrides fill everything else.
// v4.0.0-A: mortgage config moved onto properties[] (scenario data, edited
// directly in the property scaffold UI) -- no longer a separate Defaults-tab
// override target.
// -----------------------------------------------------------------------------
const BASE_CODE  = { ...BASE };
let   DISPO_CODE = null;   // captured lazily (DISPO_DEFAULTS is declared below)

export function getDefaultsCode(){
  if(!DISPO_CODE) DISPO_CODE = { ...DISPO_DEFAULTS };
  return { BASE: { ...BASE_CODE }, DISPO_DEFAULTS: { ...DISPO_CODE } };
}
export function applyDefaultsOverrides(ov = {}){
  if(!DISPO_CODE) DISPO_CODE = { ...DISPO_DEFAULTS };
  Object.assign(BASE, BASE_CODE);
  Object.assign(DISPO_DEFAULTS, DISPO_CODE);
  for(const [k,v] of Object.entries(ov.BASE||{}))
    if(k in BASE && typeof v==='number' && isFinite(v)) BASE[k]=v;
  for(const [k,v] of Object.entries(ov.DISPO_DEFAULTS||{}))
    if(k in DISPO_DEFAULTS && typeof v==='number' && isFinite(v)) DISPO_DEFAULTS[k]=v;
}

// =============================================================================
// HELPERS
// =============================================================================
export function calcPmt(p,r,yrs=30){const rm=r/12,n=yrs*12;return p*(rm*Math.pow(1+rm,n))/(Math.pow(1+rm,n)-1);}
export function remainBal(p,r,origYrs,yrsPaid){
  if(yrsPaid<=0)return p;
  const rm=r/12,n=origYrs*12,pm=Math.min(yrsPaid*12,n),pmt=calcPmt(p,r,origYrs);
  return Math.max(0,p*Math.pow(1+rm,pm)-pmt*(Math.pow(1+rm,pm)-1)/rm);
}
export function healthMonthly(calYear, calMonth, p){
  const hcpi = p?.healthCpi || BASE.healthMedicareInflation;
  const youMedInf=Math.pow(1+hcpi,Math.max(0,calYear-2026));
  // You -> Medicare is Nov 2026 (real transition date, confirmed) -- Ericsson
  // through Oct 2026, Medicare from Nov 2026 on. calYear<2026 is unreachable
  // in practice (sim starts 2026) but kept for a well-defined pre-2026 case.
  const you=(calYear<2026||(calYear===2026&&calMonth<11))?BASE.healthYouEricsson:Math.round(BASE.healthYouMedicare*youMedInf);
  let brenda;
  if(calYear>=BASE.brendaMedYear){
    brenda=Math.round(BASE.healthBrendaMedicare*Math.pow(1+hcpi,calYear-BASE.brendaMedYear));
  } else {
    brenda=Math.round(BASE.healthBrendaEricsson*Math.pow(1+BASE.ericssonInflation,calYear-BASE.startYear));
  }
  const kids=(calYear<BASE.sophiaOff||calYear<BASE.nolanOff)?BASE.healthKids:0;
  return you+brenda+kids;
}
export function workFromCurve(yr, pts){
  if(!pts||pts.length===0) return 0;
  if(yr<=pts[0].yr) return pts[0].val;
  if(yr>=pts[pts.length-1].yr) return pts[pts.length-1].val;
  let i=0; while(i<pts.length-2 && pts[i+1].yr<=yr) i++;
  const p0=pts[i], p1=pts[i+1];
  const t=(yr-p0.yr)/(p1.yr-p0.yr);
  function slope(a,b){ return a.yr===b.yr?0:(b.val-a.val)/(b.yr-a.yr); }
  const slopes=[]; for(let k=0;k<pts.length-1;k++) slopes.push(slope(pts[k],pts[k+1]));
  const tang=slopes.map((s,k)=>{
    if(k===0) return s;
    if(k===slopes.length) return slopes[slopes.length-1];
    return (slopes[k-1]+s)/2;
  });
  tang.push(slopes[slopes.length-1]);
  for(let k=0;k<slopes.length;k++){
    if(Math.abs(slopes[k])<1e-10){tang[k]=tang[k+1]=0;continue;}
    const a=tang[k]/slopes[k], b=tang[k+1]/slopes[k];
    if(a*a+b*b>9){const t2=3/Math.sqrt(a*a+b*b);tang[k]=t2*a*slopes[k];tang[k+1]=t2*b*slopes[k];}
  }
  const h00=2*t*t*t-3*t*t+1, h10=t*t*t-2*t*t+t, h01=-2*t*t*t+3*t*t, h11=t*t*t-t*t;
  const dt=p1.yr-p0.yr;
  return Math.max(0, h00*p0.val + h10*dt*tang[i] + h01*p1.val + h11*dt*tang[i+1]);
}

// =============================================================================
// TAX ESTIMATOR  (federal + Colorado, MFJ, simplified)
// =============================================================================
export function estimateTax(p, pension, workInc, ssYours, ssBrenda, rentalGross, mtgInterest) {
  if(!p.taxEnabled) return 0;
  const ssCombined = ssYours*12 + ssBrenda*12;
  const rentalNet  = Math.max(0, rentalGross - mtgInterest);
  const provisional = pension + workInc + rentalNet + ssCombined*0.5;
  const ssTaxable   = ssCombined * (provisional>44000 ? 0.85 : provisional>32000 ? 0.50 : 0);
  const fedAgi      = pension + workInc + ssTaxable + rentalNet;
  const stdDed      = 30_000;
  let taxable       = Math.max(0, fedAgi - stdDed);
  let fed = 0;
  for(const [top,rate] of [[23000,0.10],[71000,0.12],[107000,0.22],[182000,0.24]]){
    const chunk=Math.min(taxable,top); fed+=chunk*rate; taxable-=chunk; if(taxable<=0)break;
  }
  if(taxable>0) fed+=taxable*0.32;
  const coTaxable = Math.max(0, fedAgi - 24_000 - 24_000);
  const co        = coTaxable * 0.044;
  return Math.round(fed + co);
}

// =============================================================================
// UNIT SEGMENTED INCOME (v4.0.0-A, generalized from the v3.1.1 6th-St-only model)
// Outer segment: { yrFrom, yrTo, kind:'str'|'mtr'|'ltr',
//                  str:[{days,rate,type?}], mtr:[{months,rate}], ltr:{monthlyRent} }
// Inner caps: STR days clamp to 365/yr, MTR months clamp to 12/yr (enforced by
// unitSegmentGross's running-total clamp AND flagged by validateUnitSegments).
// =============================================================================
export function unitSegmentGross(seg){
  if(!seg) return 0;
  if(seg.kind==='ltr') return (seg.ltr?.monthlyRent||0)*12;
  if(seg.kind==='mtr'){
    let used=0,total=0;
    for(const g of (seg.mtr||[])){
      if(!g.months||!g.rate) continue;
      const m=Math.min(g.months, Math.max(0,12-used));
      total+=m*g.rate; used+=m;
    }
    return total;
  }
  // 'str' -- days x nightly-or-monthly rate, capped at 365 days/yr
  let used=0,total=0;
  for(const g of (seg.str||[])){
    if(!g.days||!g.rate) continue;
    const d=Math.min(g.days, Math.max(0,365-used));
    total += g.type==='monthly' ? (d/30)*g.rate : d*g.rate;
    used+=d;
  }
  return total;
}

// Nets a segment's gross by its kind's cost profile (§1 table):
//   STR: platform% + cleaning% + mgr%      MTR: flat $/block cleaning + mgr%
//   LTR: vacancy% + mgr%
export function unitSegmentNet(seg, opts={}){
  const gross = unitSegmentGross(seg);
  if(!seg) return 0;
  if(seg.kind==='str'){
    const pct = (opts.strPlatformPct||0)+(opts.strCleanPct||0)+(opts.mgrPct||0);
    return Math.max(0, gross*(1-pct));
  }
  if(seg.kind==='mtr'){
    const blocks = (seg.mtr||[]).filter(g=>(g.months||0)>0 && (g.rate||0)>0).length;
    const cleaning = blocks*(opts.mtrCleaningFlat||0);
    const mgr = gross*(opts.mgrPct||0);
    return Math.max(0, gross - cleaning - mgr);
  }
  // ltr
  const vac = gross*(opts.ltrVacancyPct||0);
  const mgr = gross*(opts.mgrPct||0);
  return Math.max(0, gross - vac - mgr);
}

// Returns [] when valid; list of human-readable errors otherwise. Overlapping
// outer year ranges are ALLOWED and SUM, except: LTR is exclusive within its
// span for a unit (a tenant occupies the whole unit) -- reject LTR overlapping
// ANY other segment on the same unit. STR+MTR may coexist on one unit freely.
export function validateUnitSegments(segs){
  const errors=[];
  const list=segs||[];
  for(let i=0;i<list.length;i++){
    const a=list[i];
    if(a.kind==='str'){
      const d=(a.str||[]).reduce((s,g)=>s+(g.days||0),0);
      if(d>365) errors.push(`Segment ${i+1}: ${d} STR days exceeds 365/yr cap`);
    }
    if(a.kind==='mtr'){
      const m=(a.mtr||[]).reduce((s,g)=>s+(g.months||0),0);
      if(m>12) errors.push(`Segment ${i+1}: ${m} MTR months exceeds 12/yr cap`);
    }
    if(a.kind==='ltr'){
      const aF=a.yrFrom??a.yr, aT=a.yrTo??a.yr;
      for(let j=0;j<list.length;j++){
        if(i===j) continue;
        const b=list[j];
        const bF=b.yrFrom??b.yr, bT=b.yrTo??b.yr;
        if(aF<=bT && bF<=aT){
          errors.push(`Segment ${i+1} (LTR, ${aF}–${aT}) cannot overlap segment ${j+1} (${(b.kind||'').toUpperCase()}, ${bF}–${bT}) — LTR occupies the whole unit`);
          break;
        }
      }
    }
  }
  return errors;
}

// Contiguous year ranges (within a unit) covered by 2+ segments, with the
// combined nominal gross $/yr (no rent growth) -- informational only, never
// blocking (LTR-exclusivity above is the only rejection rule).
export function unitSegmentOverlaps(segs){
  const list=segs||[];
  const cover = yr=>list.filter(s=>{const f=s.yrFrom??s.yr;const t=s.yrTo??s.yr;return yr>=f&&yr<=t;});
  const out=[];
  let run=null;
  for(let yr=2026;yr<=2047;yr++){
    const c = yr<=2046 ? cover(yr) : [];
    if(c.length>=2 && !run){ run={yrFrom:yr, yrTo:yr, combinedGross:c.reduce((s,x)=>s+unitSegmentGross(x),0)}; }
    else if(c.length>=2 && run){ run.yrTo=yr; }
    else if(run){ out.push(run); run=null; }
  }
  return out;
}

// =============================================================================
// PROPERTY HOLD / SALE TIMING (v4.0.0-A) -- sale timing granularity is the
// quarter; hold: { mode, year, quarter (1-4) }.
// =============================================================================
export function quarterStartMonth(q){ return (Math.min(4,Math.max(1,q||1))-1)*3 + 1; }

// Annual proration multiplier for a property's income in calendar year `year`:
// 1 if fully held (keep, or year strictly before the sale year), 0 if fully
// after the sale year, else the fraction of quarters held (sale at a quarter
// boundary -> income counts for quarters STRICTLY BEFORE the sale quarter).
export function yearHeldFraction(hold, year){
  if(!hold || hold.mode==='keep') return 1;
  const saleYear = hold.year||2055;
  if(year < saleYear) return 1;
  if(year > saleYear) return 0;
  const q = Math.min(4, Math.max(1, hold.quarter||1));
  return (q-1)/4;
}

// True monthly ownership check (drives both rental-income gating and mortgage
// stepping, so the annual and monthly engines cannot disagree on WHEN a
// property stops being owned).
export function unitOwnedThisMonth(hold, calYear, mo1to12){
  if(!hold || hold.mode==='keep') return true;
  const saleYear = hold.year||2055;
  if(calYear < saleYear) return true;
  if(calYear > saleYear) return false;
  return mo1to12 < quarterStartMonth(hold.quarter);
}

// UI-only: is this segment clipped by the property's sale date? Never blocks
// income calculation (the engine sums whatever's given, gated by ownership) --
// this just drives the non-blocking "truncated at Q{n} {year} sale" notice.
export function segmentClipInfo(seg, hold){
  if(!hold || hold.mode==='keep') return null;
  const saleYear = hold.year||2055;
  const f=seg.yrFrom??seg.yr, t=seg.yrTo??seg.yr;
  if(f>saleYear) return {fullyAfterSale:true};
  if(t>=saleYear) return {truncated:true, quarter:hold.quarter||1, year:saleYear};
  return null;
}

// =============================================================================
// SHARED DEBT HELPERS (v3.2.0)
// =============================================================================
// Standard amortized monthly payment (rate is annual decimal).
export function loanMonthlyPmt(amount, rate, months){
  if(!(amount>0) || !(months>0)) return 0;
  const rm = rate/12;
  if(rm<=0) return amount/months;
  return amount*(rm*Math.pow(1+rm,months))/(Math.pow(1+rm,months)-1);
}

// Plan a lump-sum debt paydown in avalanche order (highest rate first, capped
// at each balance). debts: [{key, balance, rate}]. Single source of truth --
// the annual engine and the monthly wfData block both apply exactly this plan,
// so the HI Debt chart and the Month-by-Month table cannot diverge again.
export function planHiPaydown(amount, debts){
  const q=(debts||[]).filter(d=>(d.balance||0)>0).sort((a,b)=>b.rate-a.rate);
  let left=Math.max(0, amount||0);
  const perDebt={};
  for(const d of q){
    if(left<=0) break;
    const pay=Math.min(left, d.balance);
    if(pay>0) perDebt[d.key]=pay;
    left-=pay;
  }
  return {perDebt, total:Math.max(0,amount||0)-left, order:q.map(d=>d.key)};
}

// v3.2.0 residual 3-way split: (a) lifestyle draw, (b) HI paydown budget,
// (c) remainder -> waterfall. Conservation: draw+paydownBudget+remainder === residual.
export function splitResidual(residual, opts={}){
  const res  = Math.max(0, residual||0);
  const draw = Math.min(Math.max(0, opts.lifestyleDraw||0), res);
  const debtCap = opts.totalDebt==null ? Infinity : Math.max(0, opts.totalDebt);
  const paydownBudget = Math.min((res-draw)*(Math.max(0, opts.paydownPct||0)/100), debtCap);
  const remainder = res - draw - paydownBudget;
  return {draw, paydownBudget, remainder};
}

// =============================================================================
// DISPOSITION MODEL (v3.1.0)  --  per-property sale / 1031 tax math
// =============================================================================
export const DISPO_DEFAULTS = {
  fedCapGainsRate:    0.238,  // 20% LTCG + 3.8% NIIT
  recaptureRate:      0.25,   // unrecaptured §1250 max
  coTaxRate:          0.044,  // CO flat
  caClawbackRate:     0.123,  // CA rate on CA-source deferred gain
  sellingCostsPct:    0.06,
  forcedSaleDiscount: 0.15,
};

// Recapture-first ordering + CA clawback + CO with other-state credit.
// Exported so settlement gain-offset math (§4.4) can recompute after reducing
// the recognized amount.
export function taxRecognized(recognized, opts = {}) {
  const cfg = { ...DISPO_DEFAULTS, ...(opts.rates || {}) };
  const depTaken = opts.depreciationTaken || 0;
  const caSrc    = opts.caSourceDeferredGain || 0;
  const recapturePortion = Math.min(recognized, depTaken);
  const capGainPortion   = Math.max(0, recognized - recapturePortion);
  const recaptureTax     = recapturePortion * cfg.recaptureRate;
  const fedCapGainsTax   = capGainPortion * cfg.fedCapGainsRate;
  const caRecognized     = Math.min(recognized, caSrc);
  const caClawbackTax    = caRecognized * cfg.caClawbackRate;
  const coOnCaSlice      = caRecognized * cfg.coTaxRate;
  const otherStateCredit = Math.min(caClawbackTax, coOnCaSlice);
  const coTax            = Math.max(0, recognized * cfg.coTaxRate - otherStateCredit);
  const caDeferredLeft   = Math.max(0, caSrc - caRecognized);
  return { recaptureTax, fedCapGainsTax, caClawbackTax, coTax, otherStateCredit, caDeferredLeft };
}

// prop: { fmv, basis, mortgageBalance, isPrimary?, sec121Exclusion?,
//         caSourceDeferredGain?, depreciationTaken? }
// mode: 'keep' | 'sell' (primary: no 1031) | 'full_1031' | 'partial_1031' (rentals)
// opts: { saleMode?, cashBoot?, sellingCostsPct?, rates? }
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
  const taxOpts = {
    rates: opts.rates,
    depreciationTaken: prop.depreciationTaken || 0,
    caSourceDeferredGain: prop.caSourceDeferredGain || 0,
  };

  if (mode === 'sell') {
    r.recognizedGain = realizedGain;
    const t = taxRecognized(realizedGain, taxOpts);
    Object.assign(r, t);
    r.totalTax = t.recaptureTax + t.fedCapGainsTax + t.caClawbackTax + t.coTax;
    r.afterTaxNetProceeds = netSale - mortgagePayoff - r.totalTax;
    r.deferredCarryForward = 0;
    return r;
  }

  if (mode === 'full_1031') {
    r.recognizedGain = 0;
    r.deferredGain   = realizedGain;
    r.deferredCarryForward = prop.caSourceDeferredGain || 0;
    r.totalTax = 0;
    r.afterTaxNetProceeds = 0;
    return r;
  }

  if (mode === 'partial_1031') {
    const freedEquity = Math.max(0, netSale - mortgagePayoff);
    const boot = Math.min(Math.max(0, opts.cashBoot || 0), freedEquity);
    const recognized = Math.min(realizedGain, boot);
    const t = taxRecognized(recognized, taxOpts);
    Object.assign(r, t);
    r.cashBoot = boot;
    r.recognizedGain = recognized;
    r.deferredGain = realizedGain - recognized;
    r.deferredCarryForward = t.caDeferredLeft;
    r.totalTax = t.recaptureTax + t.fedCapGainsTax + t.caClawbackTax + t.coTax;
    r.afterTaxNetProceeds = boot - r.totalTax;
    return r;
  }

  return r;
}

// =============================================================================
// ANNUAL PROJECTION ENGINE
// =============================================================================
export function buildScenario(p) {
  const rows=[];
  // v4.3.0: explicit start-date anchor (see monthsInYear/monthsElapsedBeforeYear above).
  const startMonth = Math.min(12, Math.max(1, Math.round(BASE.startMonth||1)));
  let ccBal      = p.payOffHI ? 0 : (p.ccBal||CC_BAL);
  let sophiaBal  = p.payOffHI ? 0 : (p.sophiaBal||SOPHIA_LOANS.reduce((s,l)=>s+l.bal,0));
  let nolanBal   = p.payOffHI ? 0 : (p.nolanBal||NOLAN_LOANS.reduce((s,l)=>s+l.bal,0));
  const ccRate   = p.ccRate    || CC_RATE;
  const ccMin    = p.ccMin     || 1200;
  const sophiaRate= p.sophiaRate|| 0.0814;
  const sophiaMin = p.sophiaMin || 737;
  const nolanRate = p.nolanRate || 0.084;
  const nolanMin  = p.nolanMin  || 1787;
  let nolanActive=false;
  let debtCleared = p.payOffHI ? true : false;
  let debtClearedYr = p.payOffHI ? BASE.startYear-1 : null;

  // v3.2.0 generalized loan segments (replaces famLoanAmt/famLoanRate)
  const loans = (p.loans||[]).map(l=>({
    label:  l.label||'Loan',
    rate:   l.rate||0,
    amount: l.amount||0,
    includeInSweep: !!l.includeInSweep,
    pmt:    loanMonthlyPmt(l.amount||0, l.rate||0, l.months||0),
    // v4.3.0: was `-6`, a magic number that silently assumed absMo=0 was June of
    // startYear (copied from wfData's old hardcoded June anchor) -- now keyed to
    // the real explicit start month so a loan's absolute offset matches BOTH
    // engines' absMo, which likewise now count from BASE.startMonth.
    startAbs: Math.max(0, ((l.startYear||BASE.startYear)-BASE.startYear)*12 + ((l.startMonth||BASE.startMonth)-BASE.startMonth)),
    bal: 0, started:false,
  }));
  const sweepLoanQ = ()=>loans.filter(L=>L.includeInSweep && L.bal>0)
    .map(L=>({g:()=>L.bal, s:(v)=>{L.bal=v;}, r:L.rate}));

  // v4.0.0-A: property-centric mortgage state, one machine per property (see
  // mortgageBalanceClosed/mortgagePaymentClosed for the closed-form equivalent
  // used by disposeAsset). ioYears:0 (Barberry/Lafayette) recasts immediately.
  const properties = p.properties || [];
  const mtgStates = properties.map(prop=>({
    id: prop.id, label: prop.label, isPrimary: prop.isPrimary,
    p: { ...prop.mortgage }, bal: prop.mortgage.balance,
    recast: null, ioPmtAtRecast: 0, transAnnounced: false, payoffAnnounced: false,
  }));
  const mtgById = Object.fromEntries(mtgStates.map(s=>[s.id,s]));
  const mtgTransByYear = {}, mtgPayoffByYear = {};
  // One month of scheduled mortgage activity; returns the payment made.
  function stepMtg(st, calYear, mo0to11, owned){
    const m=st.p;
    const k=(calYear-m.originYear)*12 + ((mo0to11+1)-m.originMonth);
    if(k<0 || !owned || st.bal<=0) return 0;
    const interest = st.bal*m.rate/12;
    if(k < m.ioYears*12) return interest;              // IO: pay interest, balance flat
    if(st.recast==null){                                // first P&I month: recast on ACTUAL balance
      st.recast = loanMonthlyPmt(st.bal, m.rate, Math.max(1, m.termYears*12 - k));
      st.ioPmtAtRecast = interest;
      // Only an emit event when there was a genuine IO period (ioYears>0) --
      // ioYears:0 properties recast on their very first stepped month, which
      // isn't a "transition" worth telling the user about.
      if(m.ioYears>0) (mtgTransByYear[calYear]=mtgTransByYear[calYear]||[]).push({label:st.label, delta:Math.round(st.recast-interest)});
    }
    const pmt = Math.min(st.recast, st.bal + interest);
    st.bal = Math.max(0, st.bal + interest - pmt);
    return pmt;
  }
  // Extra principal (bucket / annual mirror); flags early payoff.
  function mtgExtraPrincipal(st, calYear, owned, amount){
    if(!st || !owned || st.bal<=0 || amount<=0) return 0;
    const pay=Math.min(amount, st.bal);
    st.bal-=pay;
    if(st.bal<=0 && !st.payoffAnnounced){
      st.payoffAnnounced=true;
      (mtgPayoffByYear[calYear]=mtgPayoffByYear[calYear]||[]).push(st.label);
    }
    return pay;
  }
  // Mortgage-principal waterfall bucket (v3.4.0, carried): held 6th & 15th
  // only, in that priority order -- Lafayette/Barberry excluded by design.
  const MTG_PRINCIPAL_ELIGIBLE_IDS = ['sixth','fifteenth'];

  // -----------------------------------------------------------------
  // v4.0.0-A per-property sale / 1031 disposition (generalized over
  // properties[] -- no more hardcoded sixth/barberry/fifteenth).
  // -----------------------------------------------------------------
  function computeDispo(prop){
    const hold = prop.hold||{mode:'keep'};
    if(hold.mode==='keep') return {mode:'keep', year:Infinity, afterTaxNetProceeds:0, totalTax:0, recognizedGain:0, caSourceDeferredGain:0};
    // v4.2.5: disposition sale price is the entered property value, used verbatim --
    // appreciation is NEVER applied to sale price (see the appreciating valById calc
    // below for held properties, which is the correct place for appreciationPct).
    const fmv = prop.value;
    const saleMonth = quarterStartMonth(hold.quarter);
    const mtgB = mortgageBalanceClosed(prop.mortgage, mortgageMonthsSince(prop.mortgage, hold.year||2055, saleMonth));
    const depTaken = (hold.depreciationRecapture || 0) / DISPO_DEFAULTS.recaptureRate;
    const propObj = {
      fmv,
      basis: hold.basis || 0,
      mortgageBalance: mtgB,
      isPrimary: prop.isPrimary,
      sec121Exclusion: hold.sec121Exclusion || 0,
      caSourceDeferredGain: hold.caSourceDeferredGain || 0,
      depreciationTaken: depTaken,
    };
    const res = disposeAsset(propObj, hold.mode, {
      saleMode: hold.saleMode,
      cashBoot: hold.cashBoot || 0,
    });
    return { ...res, year: hold.year, quarter: hold.quarter, mode: hold.mode, caSourceDeferredGain: hold.caSourceDeferredGain || 0 };
  }
  const dispoRes = {};
  for(const prop of properties) dispoRes[prop.id] = computeDispo(prop);

  // CA $1.2M cap: applies across all NON-primary (rental) properties in year order
  const caCap = p.caGainCap || 1_200_000;
  const rentalDispos = properties.filter(pr=>!pr.isPrimary).map(pr=>dispoRes[pr.id])
    .filter(d => d.mode && d.mode!=='keep' && (d.recognizedGain||0)>0);
  rentalDispos.sort((a,b)=>a.year-b.year);
  let capUsed = 0;
  for(const d of rentalDispos){
    const origCaSlice = Math.min(d.recognizedGain || 0, d.caSourceDeferredGain || 0);
    if(origCaSlice<=0) continue;
    const capAllowed = Math.max(0, caCap - capUsed);
    const cappedCaSlice = Math.min(origCaSlice, capAllowed);
    if(cappedCaSlice < origCaSlice){
      const newCaTax = cappedCaSlice * DISPO_DEFAULTS.caClawbackRate;
      const coOnCa   = cappedCaSlice * DISPO_DEFAULTS.coTaxRate;
      const newOSC   = Math.min(newCaTax, coOnCa);
      const newCoTax = Math.max(0, d.recognizedGain * DISPO_DEFAULTS.coTaxRate - newOSC);
      const delta = (d.caClawbackTax - newCaTax) + (d.coTax - newCoTax);
      d.caClawbackTax    = newCaTax;
      d.coTax            = newCoTax;
      d.otherStateCredit = newOSC;
      d.totalTax        -= delta;
      d.afterTaxNetProceeds += delta;
    }
    capUsed += cappedCaSlice;
  }

  // v3.1.1 (carried): snapshot per-property results BEFORE the obligation's
  // gain offset and same-year bump -- the CPA sheet assumes no offset, so the
  // Reconciliation-vs-CPA card must compare against these regardless.
  const dispoResNoOffset = Object.fromEntries(Object.entries(dispoRes).map(([k,v])=>[k,{...v}]));

  // One-Time Obligation (v4.0.0-A, was Settlement/§4.4). Assumed-100% gain
  // offset: obligation.amount reduces recognized gain (capped at the year's
  // gains pool) when offsetsCapitalGains is true -- no percentage slider.
  // The offset only ever applies to the obligation's own year (single-year
  // pooled model; there's no cross-year ambiguity to disambiguate anymore).
  const obligation   = p.obligation || {};
  const obligYr       = obligation.year || BASE.startYear;
  const obligAmt      = obligation.amount || 0;
  const offsetOn      = obligation.offsetsCapitalGains !== false;

  const activeList = properties.map(pr=>dispoRes[pr.id]).filter(d => d.mode && d.mode!=='keep');

  if(offsetOn && obligAmt > 0){
    const group = activeList.filter(d=>d.year===obligYr);
    const gainsPool = group.reduce((s,d)=>s+(d.recognizedGain||0), 0);
    if(gainsPool > 0){
      const applied = Math.min(obligAmt, gainsPool);
      const scale = 1 - applied/gainsPool;
      for(const d of group){
        if(d.recognizedGain <= 0) continue;
        const newTotal = (d.recaptureTax + d.fedCapGainsTax + d.caClawbackTax + d.coTax) * scale;
        const delta = d.totalTax - newTotal;
        d.recognizedGain *= scale;
        d.recaptureTax   *= scale;
        d.fedCapGainsTax *= scale;
        d.caClawbackTax  *= scale;
        d.coTax          *= scale;
        d.totalTax        = newTotal;
        d.afterTaxNetProceeds += delta;
      }
    }
  }

  // Same-year-sale tax bump: only when ALL properties sold in the same calendar year
  const bumpOn  = p.sameYearSaleTaxBumpOn !== false;
  const bumpAmt = p.sameYearSaleTaxBump || 0;
  if(bumpOn && bumpAmt > 0 && activeList.length === properties.length && properties.length>0){
    const uniqueYrs = new Set(activeList.map(d=>d.year));
    if(uniqueYrs.size === 1){
      const totalT = activeList.reduce((s,d)=>s+(d.totalTax||0),0);
      for(const d of activeList){
        const share = totalT>0 ? d.totalTax/totalT : 1/activeList.length;
        d.totalTax += bumpAmt * share;
        d.afterTaxNetProceeds -= bumpAmt * share;
      }
    }
  }

  // Per-year cash inflows / outflows -- pooled routing (§3.4): all same-year
  // dispositions feed one pool; the obligation is a cash outflow from that pool.
  const yearCashAdd = {};   // dispo year -> $ inflow (Σ afterTaxNetProceeds)
  const yearCashSub = {};   // year -> $ outflow (one-time obligation)
  for(const d of activeList){
    yearCashAdd[d.year] = (yearCashAdd[d.year] || 0) + (d.afterTaxNetProceeds || 0);
  }
  if(obligAmt > 0){
    yearCashSub[obligYr] = (yearCashSub[obligYr] || 0) + obligAmt;
  }
  const drawByYear = {}, wfDebtByYear = {}, wfSavByYear = {};
  const paydownDetailByYear = {}, loanStartsByYear = {}, loanPayoffsByYear = {};
  const mtgExtraBoundaryByYear = {};

  // IRMAA fires 2 yrs after any taxable dispo (mode != 'full_1031', recognized gain > 0)
  const irmaaYears = new Set();
  for(const d of activeList){
    if((d.recognizedGain||0) > 0 && d.mode !== 'full_1031'){
      irmaaYears.add(d.year + 2);
    }
  }

  for(let yr=0;yr<=20;yr++){
    const cal=BASE.startYear+yr;
    // v4.0.0-A: "still owned this whole year" gate, generalized per property
    // (same boolean convention as pre-v4: false for the sale year itself --
    // NW/tax/maintenance drop out the year of sale, matching the disposition
    // proceeds landing that same year). Income proration uses the finer
    // per-quarter yearHeldFraction separately, below.
    const keepMap = {};
    for(const prop of properties){
      const hold = prop.hold||{mode:'keep'};
      keepMap[prop.id] = cal < (hold.mode==='keep' ? Infinity : (hold.year||2055));
    }
    const keepPrimary  = keepMap.sixth;
    const keepDuplex   = keepMap.fifteenth;
    const keepLafOwned = keepMap.barberry;

    // -- v4.0.0-B residual routing at the sale-year boundary, via the SHARED
    //    helpers (splitResidual + planHiPaydown) so the monthly wfData block
    //    applies the identical plan: (a) one-time draw, (b) the FULL post-draw
    //    remainder cascades debt-first (avalanche) then the mortgage-principal
    //    bucket then sweep savings. (Pre-v4.0.0-B this had a dedicated
    //    hiPaydownPct pre-split before the avalanche; removed as redundant --
    //    the avalanche already puts every dollar of the remainder against debt
    //    before any of it reaches savings, so a separate "% to debt" dial
    //    changed nothing except which bucket a dollar was logged under.)
    //    Annual approximation: reserve buckets aren't modeled here, so the
    //    one-time inflow goes straight to the debt sweep; what debt doesn't
    //    absorb becomes sweep savings (chartData compounds it). --
    if(yearCashAdd[cal] != null){
      const residual = Math.max(0, (yearCashAdd[cal] - (yearCashSub[cal]||0)));
      const split = splitResidual(residual, {
        lifestyleDraw: cal===obligYr ? (p.settleLifestyleDraw||0) : 0,
      });
      const mkDebts = ()=>[
        ...(!p.payOffHI ? [
          {key:'cc',     balance:ccBal,     rate:ccRate},
          {key:'sophia', balance:sophiaBal, rate:sophiaRate},
          {key:'nolan',  balance:nolanBal,  rate:nolanRate},
        ]:[]),
        ...loans.filter(L=>L.includeInSweep && L.bal>0)
          .map(L=>({key:'loan:'+L.label, balance:L.bal, rate:L.rate})),
      ];
      const applyPlan = (plan)=>{
        for(const [key,pay] of Object.entries(plan.perDebt)){
          if(key==='cc')          ccBal     = Math.max(0, ccBal-pay);
          else if(key==='sophia') sophiaBal = Math.max(0, sophiaBal-pay);
          else if(key==='nolan')  nolanBal  = Math.max(0, nolanBal-pay);
          else { const L=loans.find(l=>'loan:'+l.label===key); if(L) L.bal=Math.max(0,L.bal-pay); }
        }
      };
      const plan = planHiPaydown(split.remainder, mkDebts());
      applyPlan(plan);
      // v3.4.0: the waterfall remainder passes through the mortgage-principal
      // bucket (capped per month) before landing in sweep savings.
      let survivor = split.remainder - plan.total;
      if(p.mtgPrincipalOn && survivor>0){
        const _cap = p.mtgPrincipalUncapped ? Infinity : (p.mtgPrincipalCap||0);
        const room = Math.min(_cap, survivor);
        let paid = 0;
        for(const id of MTG_PRINCIPAL_ELIGIBLE_IDS) paid += mtgExtraPrincipal(mtgById[id], cal, keepMap[id], room - paid);
        survivor -= paid;
        mtgExtraBoundaryByYear[cal] = paid;
      }
      drawByYear[cal]          = split.draw;
      wfDebtByYear[cal]        = plan.total;
      wfSavByYear[cal]         = survivor;
      paydownDetailByYear[cal] = plan.perDebt;
    }

    // v4.3.0: snapshot BEFORE this iteration's mo-loop runs -- row `yr`'s
    // hiDebt is the balance as of the START of period yr (after any start-of-
    // period pool routing above, before this period's ordinary monthly
    // paydown), not the end-of-year value the old post-loop read produced.
    // yr=0 -> no mo-loop has executed yet -> exact as-entered settings value
    // (this is the fix for the "$60K setting shows $46K on the chart" bug).
    // Mortgage balances (balById, below) already worked this way -- only HI
    // debt was reading post-loop. wfData's hiDebtNow is likewise captured
    // pre-decrement each month, so both engines now share the same START-OF-
    // PERIOD snapshot convention/anchor -- but they can still report
    // DIFFERENT calendar years for when debt clears entirely, because their
    // avalanche/sweep amounts genuinely differ in magnitude for the same
    // scenario (see the "[P1] Unify annual sweep model with wfData" backlog
    // item -- a separate, larger, still-open issue this session did not
    // touch). This fix closes the snapshot-TIMING half of that divergence,
    // not the sweep-PACE half.
    const hiDebt = p.payOffHI?0:(ccBal+sophiaBal+nolanBal);
    if(hiDebt<=0 && !debtCleared){ debtCleared=true; debtClearedYr=cal; }

    // v4.3.0: this row's period length -- monthsThisYear<12 only for yr=0 (a
    // genuine partial first period). Every "$/mo rate -> this period's total"
    // annualization below uses monthsThisYear instead of a flat 12, and the
    // row.push conversions back to a displayed monthly rate divide by the
    // same monthsThisYear -- net effect: the DISPLAYED monthly rate is
    // unchanged from before this change, but the internal "total for this
    // row's period" (tax estimate input, cumulative sums, debt-clear check)
    // correctly reflects only the months actually simulated.
    const monthsThisYear = monthsInYear(yr, startMonth);
    const monthOffset = yr===0 ? startMonth-1 : 0;   // 0-based calendar-month offset within this row's year
    const monthsElapsedBeforeYr = monthsElapsedBeforeYear(yr, startMonth);

    // v4.3.0: growth/appreciation exponents use ELAPSED REAL YEARS SINCE THE
    // TRUE START DATE (fractional for the partial first period), not the
    // plain integer `yr` -- collapses to the old behavior exactly when
    // startMonth===1. This is what keeps a mid-year start from front-loading
    // a full year of growth at the first Jan-1 boundary, and matches the
    // monthly wfData engine's continuous mo/12 elapsed-time basis.
    const elapsedYrs = monthsElapsedBeforeYear(yr, startMonth)/12;
    const inf    =Math.pow(1+p.inflation,elapsedYrs);
    const coreinf=Math.pow(1+(p.coreCpi||p.inflation),elapsedYrs);
    const propinf=Math.pow(1+(p.propCpi||p.propInflation),elapsedYrs);
    const rg  =Math.pow(1+p.rentGrowth,elapsedYrs);
    const pinf=propinf;
    const app =Math.pow(1+p.reAppreciation,elapsedYrs);

    const yourSs  =(p.ssStartYear&&cal>=p.ssStartYear)?p.ssAmount:0;
    const brendaSs=cal>=BASE.brendaFraYear?BASE.brendaSsFRA:0;
    // v4.3.0: *monthsThisYear (was *12) -- these are $/mo rates annualized to
    // "this row's period total"; yr=0 only covers the months actually
    // simulated, matching the row.push conversions back to $/mo below.
    const pension =BASE.pensionMonthly*monthsThisYear;
    const workInc =workFromCurve(elapsedYrs, p.workPts)*monthsThisYear*inf;

    // -- Rental income (v4.0.0-A: property/unit/segment model) --
    // For each held property, for each unit, sum income across ALL covering
    // segments (concurrent segments SUM), each netted by its kind's cost
    // profile, prorated by quarters held in the sale year.
    const costOpts = {
      strPlatformPct: p.strPlatformPct||0, strCleanPct: p.strCleanPct||0, mgrPct: p.mgrPct||0,
      ltrVacancyPct: p.ltrVacancyPct||0, mtrCleaningFlat: p.mtrCleaningFlat||0,
    };
    let rental = 0;
    const propRentalYr = {};   // per-property annual $ this year (monthly mirror reuses this)
    for(const prop of properties){
      const heldFrac = yearHeldFraction(prop.hold, cal);
      let propGross = 0;
      if(heldFrac>0){
        for(const unit of (prop.units||[])){
          for(const seg of (unit.segments||[])){
            const f=seg.yrFrom??seg.yr, t=seg.yrTo??seg.yr;
            if(cal<f || cal>t) continue;
            propGross += unitSegmentNet(seg, costOpts)*rg;
          }
        }
      }
      // v4.3.0: yearHeldFraction only prorates for a mid-YEAR SALE -- it has
      // no notion of a mid-year SIM START, so multiply by monthsThisYear/12
      // for the partial first period (yr=0) to avoid counting rental income
      // for months before the model's start date. Approximate for the (rare,
      // and separately flagged for validation) case of a sale scheduled
      // earlier in the start year than the start month itself -- heldFrac
      // would then still count those already-past months as "held."
      const propAnnual = propGross*heldFrac*(monthsThisYear/12);
      propRentalYr[prop.id] = propAnnual;
      rental += propAnnual;
    }

    // -- cashAst: rerun from y=0..yr. v3.2.0: sale proceeds no longer land in
    //    invested cash (direct-to-invested shortcut removed) -- they route
    //    through settlement -> draw -> paydown -> waterfall, and the waterfall
    //    survivor shows up as sweep savings. Only a settlement year WITHOUT
    //    covering proceeds still pulls from invested cash (shortfall). --
    // v4.3.0: y<yr (was y<=yr) -- cashAst for row `yr` reports the balance as
    // of the START of period yr (before that period's own contribution),
    // matching the hiDebt/mortgage-balance snapshot convention below so a
    // row's NW components all describe the same instant. yr=0 -> empty range
    // -> 0, i.e. the exact as-entered starting cash position.
    let cashAst = 0;
    for(let y=0; y<yr; y++){
      const yCal = BASE.startYear + y;
      cashAst -= Math.max(0, (yearCashSub[yCal]||0) - (yearCashAdd[yCal]||0));
      // Floor at 0: if the settlement exceeds available cash, the shortfall
      // is funded outside the model (loan / retirement acct / deferral). Not modeled explicitly.
      if(cashAst < 0) cashAst = 0;
      if(y>0) cashAst *= (1+p.investReturn);
      for(const d of (p.lifestyleDraws||[])){
        if(d && y===d.yr && d.amount>0) cashAst = Math.max(0, cashAst - d.amount);
      }
    }

    // Lifestyle draws as income + v3.2.0 settlement lifestyle draw (from residual)
    let drawInc = 0;
    for(const d of (p.lifestyleDraws||[])){
      if(d && yr===d.yr && d.amount>0){
        const preDraw = cashAst + d.amount;
        drawInc += Math.min(d.amount, preDraw);
      }
    }
    drawInc += (drawByYear[cal] || 0);
    // v4.3.0: *monthsThisYear (was *12), same reasoning as pension/workInc above.
    const totalIncome=pension+workInc+(yourSs+brendaSs)*monthsThisYear+rental+drawInc;

    // -- NW pieces (per-property, gated) --
    // v4.2.5: this is the one place appreciationPct should compound prop.value --
    // Net Worth for a still-held property grows over time; disposition sale price
    // (computeDispo above) intentionally does NOT do this (entered value, verbatim).
    const valById = {};
    for(const prop of properties){
      const appPct = prop.appreciationPct ?? p.reAppreciation;
      // v4.3.0: elapsedYrs (fractional, real time since the true start date),
      // not plain `yr` -- see the note above `elapsedYrs`. yr=0 -> factor 1 ->
      // entered value verbatim (no appreciation yet), matching computeDispo's
      // fmv convention above by construction, not by coincidence.
      valById[prop.id] = keepMap[prop.id] ? prop.value*Math.pow(1+appPct,elapsedYrs) : 0;
    }
    const primVal = valById.sixth, dplxVal = valById.fifteenth, lafVal = valById.barberry;
    // v4.0.0-A: balances come from the per-property mortgage STATE (flat through
    // IO absent extra principal, then amortizing from the recast -- ioYears:0
    // properties amortize from origination).
    const balById = {};
    for(const prop of properties) balById[prop.id] = keepMap[prop.id] ? mtgById[prop.id].bal : 0;
    const primBal = balById.sixth, dplxBal = balById.fifteenth, lafBal = balById.barberry;
    const _mtgInt = properties.reduce((s,prop)=>s+balById[prop.id]*mtgById[prop.id].p.rate, 0);
    const taxAnnual=estimateTax(p,pension,workInc,yourSs,brendaSs,rental,_mtgInt);

    // -- Monthly mirror (same gating): reuse the annual rental figure directly --
    const _inf0 = Math.pow(1+p.inflation, elapsedYrs);
    const _pinf0= Math.pow(1+p.propInflation, elapsedYrs);
    // v4.3.0: /monthsThisYear (was /12) -- `rental` above is already this
    // PERIOD's total (partial for yr=0), so recovering its average $/mo rate
    // divides by the months actually in the period, not a flat 12.
    const _rental0 = rental/monthsThisYear;
    const _ss0    = ((p.ssStartYear&&(BASE.startYear+yr)>=p.ssStartYear)?p.ssAmount:0)+((BASE.startYear+yr)>=BASE.brendaFraYear?BASE.brendaSsFRA:0);
    const _work0  = workFromCurve(elapsedYrs, p.workPts)*_inf0;
    const _incMo  = BASE.pensionMonthly + _ss0 + _rental0 + _work0;
    const _propC0 = (keepDuplex?(BASE.dplxTaxMo+BASE.dplxInsMo):0)
                  + (keepPrimary?(BASE.primTaxMo+BASE.primInsMo):0)
                  + (keepLafOwned?(BASE.lafTaxMo+BASE.lafInsMo):0);
    const _pinf0perMo = _pinf0/12;
    const _maint0 = properties.reduce((s,prop)=>s+(keepMap[prop.id]?prop.value*p.maintRate*_pinf0perMo:0), 0);
    const _core0  = (BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*_inf0;
    // v4.1.3: health is no longer flattened to a single per-year figure here --
    // it varies within the year (You -> Medicare, Nov 2026), computed per exact
    // month inside the loop below via healthMonthly(cal, calMonth1to12, p).
    // v4.0.0-A: mortgage payments are state-driven per month (IO -> recast)
    // inside the loop below, for ALL properties (Lafayette/Barberry included).
    // v4.3.0: taxAnnual/monthsThisYear (was /12) -- taxAnnual is this period's
    // total, so its $/mo rate divides by the months actually in the period.
    const _fixedMoNoHealth = _propC0 + _core0 + _maint0 + taxAnnual/monthsThisYear;

    // Start-of-year loan balance (loans starting this year count at full amount)
    // v4.3.0: boundary is monthsElapsedBeforeYear(yr+1,...) (total real months
    // elapsed through the end of this iteration), not (yr+1)*12 which assumed
    // every year -- including a partial yr=0 -- contributes a full 12 months.
    const loansBalPre = loans.reduce((s,L)=>s + (L.started ? L.bal : (L.startAbs < monthsElapsedBeforeYear(yr+1,startMonth) ? L.amount : 0)), 0);
    let loanPmtYrTotal = 0, mtgPmtYrTotal = 0, mtgExtraYr = 0, mtgExtraFromSurplusYr = 0;
    // v4.3.0: monthsThisYear/monthOffset/monthsElapsedBeforeYr (declared above,
    // near the hiDebt snapshot) replace the old flat "always 12 months, mo+1
    // is the calendar month" assumption -- yr=0 only steps through the real
    // months remaining in the start year, and absMo is now TRUE elapsed
    // months since BASE.startYear/startMonth (not yr*12+mo, which assumed
    // every prior year contributed exactly 12 months).
    for(let mo=0;mo<monthsThisYear;mo++){
      const calMonth1to12 = monthOffset+mo+1;
      const absMo=monthsElapsedBeforeYr+mo;
      // -- v4.0.0-A mortgages: step monthly (IO -> recast) for ALL properties,
      //    regardless of HI state. Uses TRUE monthly ownership (not the coarse
      //    annual keepMap) so a mid-year sale stops payments at the exact
      //    quarter boundary -- this is what keeps the annual engine agreeing
      //    with the monthly wfData mirror in the sale year. --
      let _mtgMo = 0;
      for(const prop of properties){
        const ownedMo = unitOwnedThisMonth(prop.hold, cal, calMonth1to12);
        _mtgMo += stepMtg(mtgById[prop.id], cal, monthOffset+mo, ownedMo);
      }
      mtgPmtYrTotal += _mtgMo;
      // -- v3.2.0 loans: step monthly regardless of HI debt state --
      let _loanMo = 0;
      for(const L of loans){
        if(!L.started && absMo>=L.startAbs && L.amount>0){
          L.bal=L.amount; L.started=true;
          (loanStartsByYear[cal]=loanStartsByYear[cal]||[]).push(L.label);
        }
        if(L.bal>0){
          L.bal *= (1+L.rate/12);
          const pay = Math.min(L.pmt, L.bal);
          L.bal -= pay;
          _loanMo += pay;
          if(L.bal < 0.5) L.bal = 0;
        }
      }
      loanPmtYrTotal += _loanMo;
      const _hlthMo = healthMonthly(cal, calMonth1to12, p);
      let _minsMo = 0, loopDebt = 0, xtra = 0;
      if(!p.payOffHI){
        // v4.3.0 FOLLOW-UP (deferred, not fixed here -- see journal): `absMo`
        // is now TRUE elapsed months since BASE.startYear/startMonth (was
        // yr*12+mo, Jan-anchored). This threshold's real-world meaning shifts
        // with it -- e.g. for the current startMonth=7 default, "absMo<5"
        // now reads as "before December of the start year" (Jul-Nov grace),
        // where before this change it read as "before June of startYear"
        // (Jan-May grace). Needs an explicit absolute-calendar-date decision,
        // not a threshold tweak -- see wfData's twin gate in App.jsx.
        if(absMo<5){ nolanBal=Math.max(0,nolanBal*(1+nolanRate/12)); }
        else{ nolanActive=true; }
        const _minCC0  = ccBal>0?ccMin:0;
        const _minSoph0= sophiaBal>0?sophiaMin:0;
        const _minNol0 = nolanActive&&nolanBal>0?nolanMin:0;
        _minsMo  = _minCC0+_minSoph0+_minNol0;
        if(ccBal>0){    ccBal    =Math.max(0,ccBal   *(1+ccRate/12)   -_minCC0); }
        if(sophiaBal>0){sophiaBal=Math.max(0,sophiaBal*(1+sophiaRate/12)-_minSoph0);}
        if(nolanActive&&nolanBal>0){nolanBal=Math.max(0,nolanBal*(1+nolanRate/12)-_minNol0);}
        loopDebt=ccBal+sophiaBal+nolanBal;
      }
      const _avail = (_incMo - _fixedMoNoHealth - _hlthMo - _mtgMo) - _minsMo - _loanMo;
      const _splitProtect = Math.max(p.diCap, _avail*(p.lifestyleSplit/100));
      if(!p.payOffHI){
        xtra=loopDebt>0?Math.max(0,_avail-_splitProtect):0;
        const q=[
          {g:()=>ccBal,    s:(v)=>{ccBal=v;},    r:ccRate},
          {g:()=>sophiaBal,s:(v)=>{sophiaBal=v;}, r:sophiaRate},
          ...(nolanActive?[{g:()=>nolanBal,s:(v)=>{nolanBal=v;},r:nolanRate}]:[]),
          ...sweepLoanQ(),
        ].filter(o=>o.g()>0).sort((a,b)=>b.r-a.r);
        for(const loan of q){if(xtra<=0)break;const pay=Math.min(xtra,loan.g());loan.s(loan.g()-pay);xtra-=pay;}
      }
      // -- v3.4.0 mortgage-principal bucket (annual mirror): fed by leftover
      //    debt-sweep, or by the post-debt monthly surplus (which otherwise
      //    becomes sweep savings -- subtracted from savings after the loop).
      //    6th (4.875%) before 15th (4.35%); only while the property is held. --
      if(p.mtgPrincipalOn){
        const _cap = p.mtgPrincipalUncapped ? Infinity : (p.mtgPrincipalCap||0);
        const fromSurplus = loopDebt<=0;
        let room = Math.min(_cap, fromSurplus ? Math.max(0, _avail - _splitProtect) : Math.max(0, xtra));
        let paid = 0;
        for(const id of MTG_PRINCIPAL_ELIGIBLE_IDS){
          const prop = properties.find(pr=>pr.id===id);
          const ownedMo = prop ? unitOwnedThisMonth(prop.hold, cal, calMonth1to12) : false;
          paid += mtgExtraPrincipal(mtgById[id], cal, ownedMo, room - paid);
        }
        mtgExtraYr += paid;
        if(fromSurplus) mtgExtraFromSurplusYr += paid;
      }
    }
    // Loan payoff events from state (catches scheduled, sweep, and boundary-paydown payoffs)
    for(const L of loans){
      if(L.started && L.bal<=0.5 && !L.payoffAnnounced){
        L.bal=0; L.payoffAnnounced=true;
        (loanPayoffsByYear[cal]=loanPayoffsByYear[cal]||[]).push(L.label);
      }
    }
    // v3.4.0: contractual IO -> recast P&I replaces the old HI-debt-driven
    // payment switch (that was the regression -- the IO period is a loan term,
    // not a strategy toggle). Accumulated from the state stepping above.
    const mtgPmt   = mtgPmtYrTotal;

    // v4.1.3: sum real per-month figures (was a hardcoded yr===0 5mo/7mo split
    // that assumed a June 2026 Medicare transition -- the real date is Nov 2026).
    // v4.3.0: only the months actually in this row's period -- yr=0 sums
    // startMonth..12 (a genuine partial-year total), not a fabricated Jan-Dec.
    let healthAnnual=0;
    for(let hm=monthOffset+1; hm<=12; hm++) healthAnnual += healthMonthly(cal, hm, p);
    // v4.3.0: *monthsThisYear (was *12) throughout this block -- same $/mo-rate
    // -> this-period's-total reasoning as pension/workInc/totalIncome above.
    const irmaaAdd = irmaaYears.has(cal) ? BASE.irmaaSurge*2*monthsThisYear : 0;
    let propCost = 0;
    if(keepDuplex)   propCost += (BASE.dplxTaxMo+BASE.dplxInsMo)*monthsThisYear*pinf;
    if(keepLafOwned) propCost += (BASE.lafTaxMo+BASE.lafInsMo)*monthsThisYear*pinf;
    if(keepPrimary)  propCost += (BASE.primTaxMo+BASE.primInsMo)*monthsThisYear*pinf;
    const core=(BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*coreinf*monthsThisYear;
    // maint is an ANNUAL rate (prop.value*maintRate) already, not a $/mo figure --
    // prorate by monthsThisYear/12 instead (same treatment as the rental proration above).
    const maint = properties.reduce((s,prop)=>s+(keepMap[prop.id]?prop.value*p.maintRate*pinf*(monthsThisYear/12):0), 0);
    const famLoanAnnual=loanPmtYrTotal;   // v3.2.0: all loan payments this year
    const minDebt=p.payOffHI?0:(
      (ccBal>0?ccMin:0)+(sophiaBal>0?sophiaMin:0)+
      (nolanActive&&nolanBal>0?nolanMin:0)
    )*monthsThisYear;

    const baseOut=mtgPmt+healthAnnual+irmaaAdd+propCost+core+maint+famLoanAnnual+minDebt+taxAnnual;
    const baseDI =totalIncome-baseOut;
    const splitProtect = Math.max(p.diCap*monthsThisYear, baseDI*(p.lifestyleSplit/100));
    const accel  =(!p.payOffHI&&hiDebt>0)?Math.max(0,baseDI-splitProtect):0;
    const surplusAboveProtect = Math.max(0, baseDI - splitProtect);
    // v3.2.0: waterfall survivor of the sale-year remainder counts as sweep savings.
    // v3.4.0: minus whatever the mortgage-principal bucket took from that surplus.
    const annualSweepToSav = Math.max(0, (debtCleared ? surplusAboveProtect : 0) - mtgExtraFromSurplusYr) + (wfSavByYear[cal]||0);
    const totalOut=baseOut+accel;
    const surplus =totalIncome-totalOut;
    // v4.1.5: chart-only FCF value that (a) excludes the one-time settlement
    // draw and (b) applies the same lifestyleSplit%/floor split to
    // disposable income REGARDLESS of debt state -- `surplus` above only
    // does this while HI debt is still active (accel absorbs the excess);
    // once debt clears, accel is forced to 0 and `surplus` reports the FULL
    // baseDI instead of the split-protected "kept" portion, which is what
    // the monthly wfData engine's `disc` field has always done via
    // cfSplitProtect. This mirrors that behavior in the annual engine
    // WITHOUT touching `surplus`/`accel`/`reqWork`/`nw` (still needed
    // elsewhere as-is) -- purely an additional read-only chart field.
    // v4.1.7: the floor term uses `p.discFloor` (matching the monthly
    // engine's `effectiveFloor`), NOT `p.diCap` (= discFloor+rdTopUp+obTopUp).
    // diCap bundles the rainy-day/op-buffer top-ups into the floor because
    // the real (non-chart) `splitProtect`/`accel` above are computed before
    // those buckets exist as a separate concept in the annual model; but the
    // monthly engine already subtracts rdAdd/obAdd from `available` before
    // its own floor comparison, so reusing diCap here double-counted those
    // buffers into the chart's "kept" floor and inflated fcfChart (and
    // starved sweepChart) relative to what wfData actually shows.
    const baseDIExDraw = baseDI - (drawByYear[cal]||0);
    const splitProtectExDraw = Math.max(p.discFloor*monthsThisYear, baseDIExDraw*(p.lifestyleSplit/100));
    const fcfChart = Math.max(0, Math.min(baseDIExDraw, splitProtectExDraw));
    // v4.1.6: chart-only complement of fcfChart -- the recurring (non-draw)
    // disposable income ABOVE the split-protected "kept" amount, i.e. whatever
    // would get swept to debt paydown (while HI debt is active) or to savings
    // (once it's clear). This mirrors the monthly wfData engine's
    // afterBuckets-minus-disc relationship (its `sweep`/`sweepToSavings`
    // fields), which the pinned-scenario chart previously approximated with
    // the raw `debtSweep+sweepToSavings` fields -- fine while debt is active,
    // but those inherit the same pre-fcfChart post-clear/draw-leak bugs this
    // sibling field avoids, for the same reason fcfChart was added instead of
    // reusing `surplus`.
    const sweepChart = Math.max(0, baseDIExDraw - fcfChart);
    const passive =pension+(yourSs+brendaSs)*monthsThisYear+rental;
    const reqWork =Math.max(0,totalOut-passive);
    const nw      =Math.round((dplxVal+lafVal+primVal+cashAst-dplxBal-lafBal-primBal-hiDebt)/1000);

    const famLoanBal = Math.round(loansBalPre/1000);   // v3.2.0: all loans, start-of-year

    // Per-year disposition summary (nonzero only when a sale happens this year)
    const dispoTaxYr = properties.reduce((s,prop)=>s+(dispoRes[prop.id].year===cal ? dispoRes[prop.id].totalTax : 0), 0);

    // v4.3.0: /monthsThisYear (was a flat /12) throughout this row -- recovers
    // the correct $/mo rate even in the partial first period (yr=0), since
    // every total above was annualized using monthsThisYear, not 12.
    rows.push({
      cal, yr,
      cashAst,
      surplus:  Math.round(surplus/monthsThisYear),
      fcfChart: Math.round(fcfChart/monthsThisYear),
      sweepChart: Math.round(sweepChart/monthsThisYear),
      sweepToSavings: Math.round(annualSweepToSav/monthsThisYear),
      drawInc:  Math.round(drawInc/monthsThisYear),
      reqWork:  Math.round(reqWork/monthsThisYear),
      nw,
      hiDebt:   Math.round(hiDebt/1000),
      hiDebtRaw: hiDebt,
      rental:   Math.round(rental/monthsThisYear),
      passive:  Math.round(passive/monthsThisYear),
      pension:  Math.round(pension/monthsThisYear),
      yourSs:   Math.round(yourSs),
      brendaSs: Math.round(brendaSs),
      workInc:  Math.round(workInc/monthsThisYear),
      tax:      Math.round(taxAnnual/monthsThisYear),
      health:   Math.round(healthAnnual/monthsThisYear),
      mtg:      Math.round(mtgPmt/monthsThisYear),
      propCost: Math.round(propCost/monthsThisYear),
      core:     Math.round(core/monthsThisYear),
      maint:    Math.round(maint/monthsThisYear),
      famLoan:  Math.round(famLoanAnnual/monthsThisYear),
      famLoanBal,
      minDebt:  Math.round(minDebt/monthsThisYear),
      debtSweep:Math.round(accel/monthsThisYear),
      totalDebtPmt: Math.round((minDebt+accel)/monthsThisYear),
      totalInc: Math.round(totalIncome/monthsThisYear),
      totalOut: Math.round(totalOut/monthsThisYear),
      reEquity: Math.round((dplxVal+lafVal+primVal-dplxBal-lafBal-primBal)/1000),
      reValue:  Math.round((dplxVal+lafVal+primVal)/1000),
      reMortgage:Math.round((dplxBal+lafBal+primBal)/1000),
      invested: Math.round(cashAst/1000),
      hiDebtK:  Math.round(hiDebt/1000),
      ccBal:    Math.round(ccBal/1000),
      sophiaBal:Math.round(sophiaBal/1000),
      nolanBal: Math.round(nolanBal/1000),
      // v4.0.0-A: ioMode = a held mortgage is still inside its contractual IO window
      ioMode: properties.some(prop=>keepMap[prop.id] && mtgById[prop.id].recast==null && mtgById[prop.id].bal>0 && (prop.mortgage.ioYears||0)>0),
      // v3.1.0 dispo-year summary fields
      dispoTax: Math.round(dispoTaxYr),
      dispoNet: Math.round(yearCashAdd[cal] || 0),
      settlementOut: Math.round(yearCashSub[cal] || 0),
      // v4.0.0-B residual routing fields (draw -> debt-first avalanche -> savings)
      settleDraw:   Math.round(drawByYear[cal] || 0),
      wfDebtPaid:   Math.round(wfDebtByYear[cal] || 0),
      wfToSavings:  Math.round(wfSavByYear[cal] || 0),
      hiPaydownDetail: paydownDetailByYear[cal] || null,
      loanStarts:   loanStartsByYear[cal] || [],
      loanPayoffs:  loanPayoffsByYear[cal] || [],
      // v3.4.0 mortgage structure fields
      mtgTransitions: mtgTransByYear[cal] || [],       // [{label, delta $/mo}] at IO->P&I
      mtgPayoffs:     mtgPayoffByYear[cal] || [],      // early payoff via extra principal
      mtgExtra:       Math.round(mtgExtraYr + (mtgExtraBoundaryByYear[cal]||0)),
      primBalRaw:     Math.round(primBal),
      dplxBalRaw:     Math.round(dplxBal),
      lafBalRaw:      Math.round(lafBal),
      // v4.0.0-A: per-property annual rental $ (monthly-equivalent, /12 not applied)
      propRentalYr:   Object.fromEntries(Object.entries(propRentalYr).map(([k,v])=>[k,Math.round(v)])),
    });
  }
  // Expose disposition details for reconciliation card / UI
  rows.dispoResults = dispoRes;
  rows.dispoResultsNoOffset = dispoResNoOffset;  // v3.1.1: offset-free, for CPA reconciliation
  let cumInc=0,cumCost=0,cumPension=0,cumWork=0,cumSS=0,cumRental=0,cumDraw=0;
  let cumMtg=0,cumHealth=0,cumCore=0,cumProp=0,cumMaint=0,cumDebt=0,cumTax=0;
  for(const r of rows){
    // v4.3.0: multiply by THIS row's real month count (was a flat *12) --
    // row fields are $/mo rates (see the row.push comment above), and r.yr=0's
    // period is shorter than 12 months, so recovering its period total needs
    // the same monthsInYear the row itself was built with.
    const _cumMo = monthsInYear(r.yr, startMonth);
    cumInc     +=r.totalInc*_cumMo/1000;
    cumCost    +=r.totalOut*_cumMo/1000;
    cumPension +=r.pension*_cumMo/1000;
    cumWork    +=r.workInc*_cumMo/1000;
    cumSS      +=(r.yourSs+r.brendaSs)*_cumMo/1000;
    cumRental  +=r.rental*_cumMo/1000;
    cumDraw    +=r.drawInc*_cumMo/1000;
    cumTax     +=r.tax*_cumMo/1000;
    cumMtg     +=r.mtg*_cumMo/1000;
    cumHealth  +=r.health*_cumMo/1000;
    cumCore    +=r.core*_cumMo/1000;
    cumProp    +=r.propCost*_cumMo/1000;
    cumMaint   +=r.maint*_cumMo/1000;
    cumDebt    +=(r.minDebt+r.debtSweep)*_cumMo/1000;
    r.cumInc   =Math.round(cumInc);
    r.cumCost  =Math.round(cumCost);
    r.cumPension=Math.round(cumPension);
    r.cumWork  =Math.round(cumWork);
    r.cumSS    =Math.round(cumSS);
    r.cumRental=Math.round(cumRental);
    r.cumDraw  =Math.round(cumDraw);
    r.cumGap   =Math.round(cumInc-cumCost);
    r.cumTax   =Math.round(cumTax);
    r.cumMtg   =Math.round(cumMtg);
    r.cumHealth=Math.round(cumHealth);
    r.cumCore  =Math.round(cumCore);
    r.cumProp  =Math.round(cumProp);
    r.cumMaint =Math.round(cumMaint);
    r.cumDebt  =Math.round(cumDebt);
  }
  return rows;
}

export function keyStats(rows){
  const workFreeYr = rows.find(r=>r.reqWork===0)?.cal ?? null;
  const debtClearYr= rows.find(r=>r.hiDebt===0)?.cal ?? null;
  const nwYr10     = rows[10]?.nw ?? 0;
  const maxDI      = Math.max(...rows.map(r=>r.surplus));
  const launchRW   = rows[0]?.reqWork ?? 0;
  return { workFreeYr, debtClearYr, nwYr10, maxDI, launchRW };
}
