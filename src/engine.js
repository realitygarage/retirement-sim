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
  primaryValue:1_700_000, lafayetteValue:590_000, duplexValue:1_500_000,
  primaryMortgage:805_568,  primaryRate:0.04875,
  lafayetteMortgage:181_115,lafayetteRate:0.0410,
  duplexMortgage:347_601,   duplexRate:0.0435,
  lafPnI:966, duplxIO:1260, primIO:3273, duplxPnI:2167, primPnI:5257,
  sellingCosts:0.05,
  healthYouEricsson:839, healthYouMedicare:335, healthMedicareInflation:0.04,
  healthBrendaEricsson:839, healthBrendaMedicare:335, ericssonInflation:0.015,
  healthKids:414,
  sophiaOff:2028, nolanOff:2031, brendaMedYear:2032,
  lafTaxMo:267, lafInsMo:154, dplxTaxMo:700, dplxInsMo:183, primTaxMo:873, primInsMo:200,
  duplexBottomRent:3_520, lafayetteRent:3_150,
  carLease:250, otherIns:500, food:900, utilities:400, personal:600,
  pensionMonthly:3_300,
  yourSsEarly:3_271, yourSsFRA:3_874,
  brendaSsFRA:1_937,
  brendaFraYear:2034,
  famLoanAmt:25_000, famLoanMonths:8,
  sixthBasis:    930_000,
  marriedExcl:   500_000,
  fedCapGains:   0.238,
  coCapGains:    0.044,
  irmaaSurge:    350,
};

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
  const you=(calMonth!==undefined&&calMonth<5)?BASE.healthYouEricsson:Math.round(BASE.healthYouMedicare*youMedInf);
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
// SCHEDULE INCOME HELPERS
// =============================================================================
export function strScheduleIncome(segments){
  let total=0;
  for(const seg of (segments||[])){
    if(!seg.days||!seg.rate) continue;
    total += seg.type==='monthly' ? (seg.days/30)*seg.rate : seg.days*seg.rate;
  }
  return total;
}
export function mtrScheduleIncome(segments){
  let total=0;
  for(const seg of (segments||[])){
    if(!seg.months||!seg.rate) continue;
    total += seg.months * seg.rate;
  }
  return total;
}

// =============================================================================
// 6TH ST SEGMENTED INCOME (v3.1.1)
// Outer segment: { yrFrom, yrTo, kind:'str'|'mtr'|'ltr',
//                  str:[{days,rate,type?}], mtr:[{months,rate}], ltr:{monthlyRent} }
// Inner caps enforced here: STR days clamp to 365/yr, MTR months to 12/yr.
// =============================================================================
export function sixthSegmentGross(seg){
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
  // 'str' -- same inner shape as strSchedule segments (days x nightly or monthly rate)
  let used=0,total=0;
  for(const g of (seg.str||[])){
    if(!g.days||!g.rate) continue;
    const d=Math.min(g.days, Math.max(0,365-used));
    total += g.type==='monthly' ? (d/30)*g.rate : d*g.rate;
    used+=d;
  }
  return total;
}

// Returns [] when valid; list of human-readable errors otherwise.
// v3.3.0: overlapping outer year ranges are ALLOWED (concurrent segments sum,
// e.g. a room STR alongside a whole-house MTR) -- only per-segment inner caps
// are validated here. Overlaps get an informational note in the UI instead.
export function validateSixthSegments(segs){
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
  }
  return errors;
}

// v3.3.0: contiguous year ranges covered by 2+ segments, with the combined
// nominal gross $/yr (no rent growth) at each range start -- informational only.
export function sixthSegmentOverlaps(segs){
  const list=segs||[];
  const cover = yr=>list.filter(s=>{const f=s.yrFrom??s.yr;const t=s.yrTo??s.yr;return yr>=f&&yr<=t;});
  const out=[];
  let run=null;
  for(let yr=2026;yr<=2047;yr++){
    const c = yr<=2046 ? cover(yr) : [];
    if(c.length>=2 && !run){ run={yrFrom:yr, yrTo:yr, combinedGross:c.reduce((s,x)=>s+sixthSegmentGross(x),0)}; }
    else if(c.length>=2 && run){ run.yrTo=yr; }
    else if(run){ out.push(run); run=null; }
  }
  return out;
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
// mode: 'keep' | 'sell_taxable' | 'full_1031' | 'partial_1031'
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

  if (mode === 'sell_taxable') {
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
    startAbs: Math.max(0, ((l.startYear||BASE.startYear)-BASE.startYear)*12 + ((l.startMonth||6)-6)),
    bal: 0, started:false,
  }));
  const sweepLoanQ = ()=>loans.filter(L=>L.includeInSweep && L.bal>0)
    .map(L=>({g:()=>L.bal, s:(v)=>{L.bal=v;}, r:L.rate}));

  // -----------------------------------------------------------------
  // v3.1.0 dispositions (per-property sale / 1031)
  // -----------------------------------------------------------------
  const dispo    = p.dispositions || {};
  const dSixth   = dispo.sixth     || {mode:'keep'};
  const dLaf     = dispo.barberry  || {mode:'keep'};
  const dDuplex  = dispo.fifteenth || {mode:'keep'};
  const sixthYr  = dSixth.mode ==='keep' ? Infinity : (dSixth.year || 2055);
  const lafYr    = dLaf.mode   ==='keep' ? Infinity : (dLaf.year   || 2055);
  const duplexYr = dDuplex.mode==='keep' ? Infinity : (dDuplex.year|| 2055);
  const lafStopYr = p.lafStopYear || 2055;

  function computeDispo(def, baseVal, baseMtg, baseRate, isPrimary){
    if(def.mode==='keep') return {mode:'keep', year:Infinity, afterTaxNetProceeds:0, totalTax:0, recognizedGain:0, caSourceDeferredGain:0};
    const yrIdx = Math.max(0, (def.year||2055) - BASE.startYear);
    // v3.1.1: the Sale price slider IS the sale-year price. Previously fmv came from
    // BASE value x appreciation and salesPrice was silently ignored (proceeds ran high).
    const fmv   = (def.salesPrice > 0) ? def.salesPrice : baseVal * Math.pow(1+p.reAppreciation, yrIdx);
    const mtgB  = remainBal(baseMtg, baseRate, 30, 5+yrIdx);
    const depTaken = (def.depreciationRecapture || 0) / DISPO_DEFAULTS.recaptureRate;
    const propObj = {
      fmv,
      basis: def.adjustedBasis || 0,
      mortgageBalance: mtgB,
      isPrimary,
      sec121Exclusion: def.sec121Exclusion || 0,
      caSourceDeferredGain: def.caSourceDeferredGain || 0,
      depreciationTaken: depTaken,
    };
    const res = disposeAsset(propObj, def.mode, {
      saleMode: def.saleMode,
      cashBoot: def.cashBoot || 0,
    });
    return { ...res, year: def.year, mode: def.mode, caSourceDeferredGain: def.caSourceDeferredGain || 0 };
  }
  const dispoRes = {
    sixth:     computeDispo(dSixth,  BASE.primaryValue,   BASE.primaryMortgage,   BASE.primaryRate,   true),
    barberry:  computeDispo(dLaf,    BASE.lafayetteValue, BASE.lafayetteMortgage, BASE.lafayetteRate, false),
    fifteenth: computeDispo(dDuplex, BASE.duplexValue,    BASE.duplexMortgage,    BASE.duplexRate,    false),
  };

  // CA $1.2M cap: applies across barberry + fifteenth in year order
  const caCap = p.caGainCap || 1_200_000;
  const rentalDispos = [dispoRes.barberry, dispoRes.fifteenth]
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

  // v3.1.1: snapshot per-property results BEFORE settlement gain-offset and
  // same-year bump -- the CPA sheet assumes no offset, so the Reconciliation-vs-CPA
  // card must compare against these regardless of the gainOffsetPct slider.
  const dispoResNoOffset = {
    sixth:     { ...dispoRes.sixth },
    barberry:  { ...dispoRes.barberry },
    fifteenth: { ...dispoRes.fifteenth },
  };

  // Settlement gain-offset (§4.4)
  const settleYr      = p.settlementYear || BASE.startYear;
  const settleNeed    = p.settlementNeed || 0;
  const offsetPct     = (p.gainOffsetPct || 0) / 100;
  const requireSameYr = p.requireSameYearForOffset !== false;

  const activeList = [dispoRes.sixth, dispoRes.barberry, dispoRes.fifteenth]
    .filter(d => d.mode && d.mode!=='keep');

  if(offsetPct > 0){
    const yrGroups = {};
    for(const d of activeList){ (yrGroups[d.year] = yrGroups[d.year] || []).push(d); }
    for(const [yStr, group] of Object.entries(yrGroups)){
      const yr = +yStr;
      if(requireSameYr && yr !== settleYr) continue;
      const gainsPool = group.reduce((s,d)=>s+(d.recognizedGain||0), 0);
      if(gainsPool <= 0) continue;
      const applied = Math.min(settleNeed * offsetPct, gainsPool);
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

  // Same-year-sale tax bump: only when all 3 sold in same calendar year
  const bumpOn  = p.sameYearSaleTaxBumpOn !== false;
  const bumpAmt = p.sameYearSaleTaxBump || 0;
  if(bumpOn && bumpAmt > 0 && activeList.length === 3){
    const uniqueYrs = new Set(activeList.map(d=>d.year));
    if(uniqueYrs.size === 1){
      const totalT = activeList.reduce((s,d)=>s+(d.totalTax||0),0);
      for(const d of activeList){
        const share = totalT>0 ? d.totalTax/totalT : 1/3;
        d.totalTax += bumpAmt * share;
        d.afterTaxNetProceeds -= bumpAmt * share;
      }
    }
  }

  // Per-year cash inflows / outflows
  const yearCashAdd = {};   // dispo year -> $ inflow (afterTaxNetProceeds sum)
  const yearCashSub = {};   // year -> $ outflow (settlement)
  for(const d of activeList){
    yearCashAdd[d.year] = (yearCashAdd[d.year] || 0) + (d.afterTaxNetProceeds || 0);
  }
  if(settleNeed > 0){
    yearCashSub[settleYr] = (yearCashSub[settleYr] || 0) + settleNeed;
  }
  const paydownByYear = {}, drawByYear = {}, wfDebtByYear = {}, wfSavByYear = {};
  const paydownDetailByYear = {}, loanStartsByYear = {}, loanPayoffsByYear = {};

  // IRMAA fires 2 yrs after any taxable dispo (mode != 'full_1031', recognized gain > 0)
  const irmaaYears = new Set();
  for(const d of activeList){
    if((d.recognizedGain||0) > 0 && d.mode !== 'full_1031'){
      irmaaYears.add(d.year + 2);
    }
  }

  for(let yr=0;yr<=20;yr++){
    const cal=BASE.startYear+yr;
    const keepPrimary  = cal < sixthYr;
    const keepLafOwned = cal < lafYr;
    const keepDuplex   = cal < duplexYr;
    const lafRenting   = p.lafRental && keepLafOwned && cal < lafStopYr;

    // -- v3.2.0 residual routing at the sale-year boundary, via the SHARED
    //    helpers (splitResidual + planHiPaydown) so the monthly wfData block
    //    applies the identical plan: (a) lifestyle draw, (b) HI paydown
    //    avalanche (Nolan included -- his 5-month payment grace delays
    //    minimums, not lump-sum payoff), (c) remainder -> waterfall.
    //    Annual approximation of (c): reserve buckets aren't modeled here, so
    //    the one-time inflow goes straight to the debt sweep; what debt
    //    doesn't absorb becomes sweep savings (chartData compounds it). --
    if(yearCashAdd[cal] != null){
      const residual = Math.max(0, (yearCashAdd[cal] - (yearCashSub[cal]||0)));
      const hiBal = p.payOffHI ? 0 : ccBal + sophiaBal + nolanBal;
      const totalDebt = hiBal + loans.reduce((s,L)=>s+(L.includeInSweep?L.bal:0),0);
      const split = splitResidual(residual, {
        lifestyleDraw: cal===settleYr ? (p.settleLifestyleDraw||0) : 0,
        paydownPct: p.hiPaydownPct||0,
        totalDebt,
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
      const plan = planHiPaydown(split.paydownBudget, mkDebts());
      applyPlan(plan);
      const plan2 = planHiPaydown(split.remainder, mkDebts());
      applyPlan(plan2);
      drawByYear[cal]          = split.draw;
      paydownByYear[cal]       = plan.total;
      wfDebtByYear[cal]        = plan2.total;
      wfSavByYear[cal]         = split.remainder - plan2.total;
      paydownDetailByYear[cal] = plan.perDebt;
    }

    const inf    =Math.pow(1+p.inflation,yr);
    const coreinf=Math.pow(1+(p.coreCpi||p.inflation),yr);
    const propinf=Math.pow(1+(p.propCpi||p.propInflation),yr);
    const rg  =Math.pow(1+p.rentGrowth,yr);
    const pinf=propinf;
    const app =Math.pow(1+p.reAppreciation,yr);

    const yourSs  =(p.ssStartYear&&cal>=p.ssStartYear)?p.ssAmount:0;
    const brendaSs=cal>=BASE.brendaFraYear?BASE.brendaSsFRA:0;
    const pension =BASE.pensionMonthly*12;
    const workInc =workFromCurve(yr, p.workPts)*12*inf;

    // -- Rental income (per-property, gated by ownership) --
    let rental = 0;
    if(keepDuplex){
      rental += p.duplexBottomLTR*12*rg;
      if(p.topUnit==="mtr"){
        rental += p.duplexTopMTR*12*rg;
      } else if(p.topUnit==="ltr"){
        rental += p.duplexTopLTR*12*rg;
      } else {
        const schedEntry=(p.strSchedule||[]).find(s=>{
          const f=s.yrFrom??s.yr; const t=s.yrTo??s.yr;
          return cal>=f && cal<=t;
        });
        const strAnnual=schedEntry ? strScheduleIncome(schedEntry.segments) : p.duplexTopSTR*12;
        rental += strAnnual*rg;
      }
    }
    if(lafRenting) rental += BASE.lafayetteRent*12*rg;

    // 6th St primary income -- v3.3.0 segments-only model: sixthIncomeSegments is
    // the sole input (empty = no income), concurrent segments SUM, each netted by
    // its kind's cost knobs (STR: platform+cleaning+mgr; MTR/LTR: gross here, mgr
    // netted in the monthly cash-flow engine). Segment year ranges are the sole
    // start/stop control (debt-clear auto-stop removed).
    const sixthSegs = p.sixthIncomeSegments || [];
    const strCostPct = (p.strPlatformPct||0) + (p.strCleanPct||0) + (p.mgrPct||0);
    let sixthIncome = 0;   // annual $, summed across ALL segments covering this year
    if(keepPrimary){
      for(const seg of sixthSegs){
        const f=seg.yrFrom??seg.yr; const t=seg.yrTo??seg.yr;
        if(cal<f || cal>t) continue;
        const gross = sixthSegmentGross(seg)*rg;
        sixthIncome += seg.kind==='str' ? gross*(1-strCostPct) : gross;
      }
    }
    rental += sixthIncome;

    // -- cashAst: rerun from y=0..yr. v3.2.0: sale proceeds no longer land in
    //    invested cash (direct-to-invested shortcut removed) -- they route
    //    through settlement -> draw -> paydown -> waterfall, and the waterfall
    //    survivor shows up as sweep savings. Only a settlement year WITHOUT
    //    covering proceeds still pulls from invested cash (shortfall). --
    let cashAst = 0;
    for(let y=0; y<=yr; y++){
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
    const totalIncome=pension+workInc+(yourSs+brendaSs)*12+rental+drawInc;

    // -- NW pieces (per-property, gated) --
    const dplxVal = keepDuplex   ? BASE.duplexValue*app    : 0;
    const lafVal  = keepLafOwned ? BASE.lafayetteValue*app : 0;
    const primVal = keepPrimary  ? BASE.primaryValue*app   : 0;
    const dplxBal = keepDuplex   ? remainBal(BASE.duplexMortgage,BASE.duplexRate,30,5+yr)       : 0;
    const lafBal  = keepLafOwned ? remainBal(BASE.lafayetteMortgage,BASE.lafayetteRate,30,5+yr) : 0;
    const primBal = keepPrimary  ? remainBal(BASE.primaryMortgage,BASE.primaryRate,30,5+yr)     : 0;
    const _mtgInt = dplxBal*BASE.duplexRate + lafBal*BASE.lafayetteRate + primBal*BASE.primaryRate;
    const taxAnnual=estimateTax(p,pension,workInc,yourSs,brendaSs,rental,_mtgInt);

    // -- Monthly mirror (same gating) --
    const _rg0  = Math.pow(1+p.rentGrowth, yr);
    const _inf0 = Math.pow(1+p.inflation, yr);
    const _pinf0= Math.pow(1+p.propInflation, yr);
    let _rental0 = 0;
    if(keepDuplex){
      _rental0 += p.duplexBottomLTR*_rg0;
      if(p.topUnit==="mtr")      _rental0+=p.duplexTopMTR*_rg0;
      else if(p.topUnit==="ltr") _rental0+=p.duplexTopLTR*_rg0;
      else                       _rental0+=p.duplexTopSTR*_rg0;
    }
    if(lafRenting) _rental0+=BASE.lafayetteRent*_rg0;
    _rental0 += sixthIncome/12;   // v3.1.1: same annual figure as main loop (rg already applied)
    const _ss0    = ((p.ssStartYear&&(BASE.startYear+yr)>=p.ssStartYear)?p.ssAmount:0)+((BASE.startYear+yr)>=BASE.brendaFraYear?BASE.brendaSsFRA:0);
    const _work0  = workFromCurve(yr, p.workPts)*_inf0;
    const _incMo  = BASE.pensionMonthly + _ss0 + _rental0 + _work0;
    let _propC0 = 0;
    if(keepDuplex)   _propC0 += (BASE.dplxTaxMo+BASE.dplxInsMo)*_pinf0;
    if(keepPrimary)  _propC0 += (BASE.primTaxMo+BASE.primInsMo)*_pinf0;
    if(keepLafOwned) _propC0 += (BASE.lafTaxMo+BASE.lafInsMo)*_pinf0;
    let _maint0 = 0;
    if(keepDuplex)   _maint0 += BASE.duplexValue*p.maintRate*_pinf0/12;
    if(keepLafOwned) _maint0 += BASE.lafayetteValue*p.maintRate*_pinf0/12;
    if(keepPrimary)  _maint0 += BASE.primaryValue*p.maintRate*_pinf0/12;
    const _core0  = (BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*_inf0;
    const _hlth0  = healthMonthly(BASE.startYear+yr, 99, p);
    const _mtg0   = (keepDuplex?BASE.duplxIO:0) + (keepLafOwned?BASE.lafPnI:0) + (keepPrimary?BASE.primIO:0);
    const _fixedMo= _mtg0 + _hlth0 + _propC0 + _core0 + _maint0 + taxAnnual/12;
    const _baseDI = _incMo - _fixedMo;

    // Start-of-year loan balance (loans starting this year count at full amount)
    const loansBalPre = loans.reduce((s,L)=>s + (L.started ? L.bal : (L.startAbs < (yr+1)*12 ? L.amount : 0)), 0);
    let loanPmtYrTotal = 0;
    for(let mo=0;mo<12;mo++){
      const absMo=yr*12+mo;
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
      if(p.payOffHI) continue;
      if(absMo<5){ nolanBal=Math.max(0,nolanBal*(1+nolanRate/12)); }
      else{ nolanActive=true; }
      const _minCC0  = ccBal>0?ccMin:0;
      const _minSoph0= sophiaBal>0?sophiaMin:0;
      const _minNol0 = nolanActive&&nolanBal>0?nolanMin:0;
      const _minsMo  = _minCC0+_minSoph0+_minNol0;
      if(ccBal>0){    ccBal    =Math.max(0,ccBal   *(1+ccRate/12)   -_minCC0); }
      if(sophiaBal>0){sophiaBal=Math.max(0,sophiaBal*(1+sophiaRate/12)-_minSoph0);}
      if(nolanActive&&nolanBal>0){nolanBal=Math.max(0,nolanBal*(1+nolanRate/12)-_minNol0);}
      const loopDebt=ccBal+sophiaBal+nolanBal;
      const _avail = _baseDI - _minsMo - _loanMo;
      const _splitProtect = Math.max(p.diCap, _avail*(p.lifestyleSplit/100));
      let xtra=loopDebt>0?Math.max(0,_avail-_splitProtect):0;
      const q=[
        {g:()=>ccBal,    s:(v)=>{ccBal=v;},    r:ccRate},
        {g:()=>sophiaBal,s:(v)=>{sophiaBal=v;}, r:sophiaRate},
        ...(nolanActive?[{g:()=>nolanBal,s:(v)=>{nolanBal=v;},r:nolanRate}]:[]),
        ...sweepLoanQ(),
      ].filter(o=>o.g()>0).sort((a,b)=>b.r-a.r);
      for(const loan of q){if(xtra<=0)break;const pay=Math.min(xtra,loan.g());loan.s(loan.g()-pay);xtra-=pay;}
    }
    // Loan payoff events from state (catches scheduled, sweep, and boundary-paydown payoffs)
    for(const L of loans){
      if(L.started && L.bal<=0.5 && !L.payoffAnnounced){
        L.bal=0; L.payoffAnnounced=true;
        (loanPayoffsByYear[cal]=loanPayoffsByYear[cal]||[]).push(L.label);
      }
    }
    const hiDebt=p.payOffHI?0:ccBal+sophiaBal+nolanBal;
    if(hiDebt<=0 && !debtCleared){ debtCleared=true; debtClearedYr=cal; }

    const duplxPmt = keepDuplex   ? ((!p.payOffHI&&hiDebt>0)?BASE.duplxIO:BASE.duplxPnI) : 0;
    const lafPmt   = keepLafOwned ? BASE.lafPnI : 0;
    const primPmt  = keepPrimary  ? ((!p.payOffHI&&hiDebt>0)?BASE.primIO:BASE.primPnI)   : 0;
    const mtgPmt   = (duplxPmt + lafPmt + primPmt)*12;

    const healthAnnual=yr===0
      ?(5*BASE.healthYouEricsson+7*BASE.healthYouMedicare+12*BASE.healthBrendaEricsson+12*BASE.healthKids)
      :healthMonthly(cal,99,p)*12;
    const irmaaAdd = irmaaYears.has(cal) ? BASE.irmaaSurge*2*12 : 0;
    let propCost = 0;
    if(keepDuplex)   propCost += (BASE.dplxTaxMo+BASE.dplxInsMo)*12*pinf;
    if(keepLafOwned) propCost += (BASE.lafTaxMo+BASE.lafInsMo)*12*pinf;
    if(keepPrimary)  propCost += (BASE.primTaxMo+BASE.primInsMo)*12*pinf;
    const core=(BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*coreinf*12;
    let maint = 0;
    if(keepDuplex)   maint += BASE.duplexValue*p.maintRate*pinf;
    if(keepLafOwned) maint += BASE.lafayetteValue*p.maintRate*pinf;
    if(keepPrimary)  maint += BASE.primaryValue*p.maintRate*pinf;
    const famLoanAnnual=loanPmtYrTotal;   // v3.2.0: all loan payments this year
    const minDebt=p.payOffHI?0:(
      (ccBal>0?ccMin:0)+(sophiaBal>0?sophiaMin:0)+
      (nolanActive&&nolanBal>0?nolanMin:0)
    )*12;

    const baseOut=mtgPmt+healthAnnual+irmaaAdd+propCost+core+maint+famLoanAnnual+minDebt+taxAnnual;
    const baseDI =totalIncome-baseOut;
    const splitProtect = Math.max(p.diCap*12, baseDI*(p.lifestyleSplit/100));
    const accel  =(!p.payOffHI&&hiDebt>0)?Math.max(0,baseDI-splitProtect):0;
    const surplusAboveProtect = Math.max(0, baseDI - splitProtect);
    // v3.2.0: waterfall survivor of the sale-year remainder counts as sweep savings
    const annualSweepToSav = (debtCleared ? surplusAboveProtect : 0) + (wfSavByYear[cal]||0);
    const totalOut=baseOut+accel;
    const surplus =totalIncome-totalOut;
    const passive =pension+(yourSs+brendaSs)*12+rental;
    const reqWork =Math.max(0,totalOut-passive);
    const nw      =Math.round((dplxVal+lafVal+primVal+cashAst-dplxBal-lafBal-primBal-hiDebt)/1000);

    const famLoanBal = Math.round(loansBalPre/1000);   // v3.2.0: all loans, start-of-year

    // Per-year disposition summary (nonzero only when a sale happens this year)
    const dispoTaxYr = (dispoRes.sixth.year===cal    ? dispoRes.sixth.totalTax    : 0)
                     + (dispoRes.barberry.year===cal ? dispoRes.barberry.totalTax : 0)
                     + (dispoRes.fifteenth.year===cal? dispoRes.fifteenth.totalTax: 0);

    rows.push({
      cal, yr,
      cashAst,
      surplus:  Math.round(surplus/12),
      sweepToSavings: Math.round(annualSweepToSav/12),
      drawInc:  Math.round(drawInc/12),
      reqWork:  Math.round(reqWork/12),
      nw,
      hiDebt:   Math.round(hiDebt/1000),
      hiDebtRaw: hiDebt,
      rental:   Math.round(rental/12),
      passive:  Math.round(passive/12),
      pension:  Math.round(pension/12),
      yourSs:   Math.round(yourSs),
      brendaSs: Math.round(brendaSs),
      workInc:  Math.round(workInc/12),
      tax:      Math.round(taxAnnual/12),
      health:   Math.round(healthAnnual/12),
      mtg:      Math.round(mtgPmt/12),
      propCost: Math.round(propCost/12),
      core:     Math.round(core/12),
      maint:    Math.round(maint/12),
      famLoan:  Math.round(famLoanAnnual/12),
      famLoanBal,
      minDebt:  Math.round(minDebt/12),
      debtSweep:Math.round(accel/12),
      totalDebtPmt: Math.round((minDebt+accel)/12),
      totalInc: Math.round(totalIncome/12),
      totalOut: Math.round(totalOut/12),
      reEquity: Math.round((dplxVal+lafVal+primVal-dplxBal-lafBal-primBal)/1000),
      reValue:  Math.round((dplxVal+lafVal+primVal)/1000),
      reMortgage:Math.round((dplxBal+lafBal+primBal)/1000),
      invested: Math.round(cashAst/1000),
      hiDebtK:  Math.round(hiDebt/1000),
      ccBal:    Math.round(ccBal/1000),
      sophiaBal:Math.round(sophiaBal/1000),
      nolanBal: Math.round(nolanBal/1000),
      ioMode:   hiDebt>0 && !p.payOffHI && (keepPrimary||keepDuplex),
      // v3.1.0 dispo-year summary fields
      dispoTax: Math.round(dispoTaxYr),
      dispoNet: Math.round(yearCashAdd[cal] || 0),
      settlementOut: Math.round(yearCashSub[cal] || 0),
      hiPaydown: Math.round(paydownByYear[cal] || 0),
      // v3.2.0 residual 3-way split + loan event fields
      settleDraw:   Math.round(drawByYear[cal] || 0),
      wfDebtPaid:   Math.round(wfDebtByYear[cal] || 0),
      wfToSavings:  Math.round(wfSavByYear[cal] || 0),
      hiPaydownDetail: paydownDetailByYear[cal] || null,
      loanStarts:   loanStartsByYear[cal] || [],
      loanPayoffs:  loanPayoffsByYear[cal] || [],
    });
  }
  // Expose disposition details for reconciliation card / UI
  rows.dispoResults = dispoRes;
  rows.dispoResultsNoOffset = dispoResNoOffset;  // v3.1.1: offset-free, for CPA reconciliation
  let cumInc=0,cumCost=0,cumPension=0,cumWork=0,cumSS=0,cumRental=0,cumDraw=0;
  let cumMtg=0,cumHealth=0,cumCore=0,cumProp=0,cumMaint=0,cumDebt=0,cumTax=0;
  for(const r of rows){
    cumInc     +=r.totalInc*12/1000;
    cumCost    +=r.totalOut*12/1000;
    cumPension +=r.pension*12/1000;
    cumWork    +=r.workInc*12/1000;
    cumSS      +=(r.yourSs+r.brendaSs)*12/1000;
    cumRental  +=r.rental*12/1000;
    cumDraw    +=r.drawInc*12/1000;
    cumTax     +=r.tax*12/1000;
    cumMtg     +=r.mtg*12/1000;
    cumHealth  +=r.health*12/1000;
    cumCore    +=r.core*12/1000;
    cumProp    +=r.propCost*12/1000;
    cumMaint   +=r.maint*12/1000;
    cumDebt    +=(r.minDebt+r.debtSweep)*12/1000;
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
