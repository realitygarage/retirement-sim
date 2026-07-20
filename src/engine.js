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
  // v4.4.0: birth-date anchor -- real biographical facts, editable on the
  // Defaults tab. These are the SINGLE SOURCE OF TRUTH for every age-triggered
  // event (Medicare, FRA, SS claiming) -- see deriveAgeAnchors() below, which
  // computes medicareYouYear/Month, brendaMedYear/Month, brendaFraYear/Month
  // from these four fields. Do not hand-edit the derived fields; they are
  // recomputed from birth date every time overrides are applied.
  yourBirthYear:1961, yourBirthMonth:10,     // Bob: Oct 18 1961
  brendaBirthYear:1967, brendaBirthMonth:1,  // Brenda: Jan 19 1967
  sellingCosts:0.05,   // liq-NW quick-calc constant (not the per-disposition sellingCostsPct)
  healthYouEricsson:839, healthYouMedicare:335, healthMedicareInflation:0.04,
  healthBrendaEricsson:839, healthBrendaMedicare:335, ericssonInflation:0.015,
  healthKids:414,
  sophiaOff:2028, nolanOff:2031,
  // v4.4.0: brendaMedYear/Month, brendaFraYear/Month (below) are now DERIVED
  // by deriveAgeAnchors() from brendaBirthYear/Month -- placeholder values
  // here get overwritten immediately at module load (see call at the bottom
  // of the deriveAgeAnchors block) and again on every Defaults-tab override.
  brendaMedYear:2032, brendaMedMonth:1,
  lafTaxMo:267, lafInsMo:154, dplxTaxMo:700, dplxInsMo:183, primTaxMo:873, primInsMo:200,
  carLease:250, otherIns:500, food:900, utilities:400, personal:600,
  pensionMonthly:3_300,
  yourSsEarly:3_271, yourSsFRA:3_874,
  brendaSsFRA:1_937,
  brendaFraYear:2034, brendaFraMonth:1,
  // v4.4.0: derived from yourBirthYear/Month -- was a hardcoded Nov-2026
  // (calYear===2026&&calMonth<11) check inside healthMonthly(). Corrected to
  // Oct 2026 (his actual 65th-birthday month) -- see session29 journal for
  // the investigation; the old Nov-2026 value was a stale approximation, not
  // a calibrated real fact, so this is an intentional correction, not just a
  // refactor.
  medicareYouYear:2026, medicareYouMonth:10,
  marriedExcl:   500_000,   // liq-NW quick-calc §121 approximation (generic, not property-specific)
  fedCapGains:   0.238,     // liq-NW quick-calc cap-gains rate
  coCapGains:    0.044,
  irmaaSurge:    350,
};

// =============================================================================
// AGE-ANCHOR DERIVATION (v4.4.0) -- birthYear/birthMonth are the single source
// of truth for every age-triggered constant (Medicare at 65, FRA at 67).
// Recomputes medicareYouYear/Month, brendaMedYear/Month, brendaFraYear/Month
// on `base` in place. Called once at module load (below) and again inside
// applyDefaultsOverrides() AFTER overrides are applied, so a stale saved
// override of one of the derived fields themselves (e.g. from a pre-v4.4.0
// localStorage blob) is immediately overwritten -- the derived fields cannot
// drift from birth date, by construction.
// =============================================================================
export function deriveAgeAnchors(base){
  base.medicareYouYear = base.yourBirthYear+65;   base.medicareYouMonth = base.yourBirthMonth;
  base.brendaMedYear   = base.brendaBirthYear+65; base.brendaMedMonth   = base.brendaBirthMonth;
  base.brendaFraYear   = base.brendaBirthYear+67; base.brendaFraMonth   = base.brendaBirthMonth;
}
deriveAgeAnchors(BASE);

// Continuous SS claiming age (fractional years) at an absolute calendar
// month, given a birth date -- shared by both engines' SS $-amount formula
// and the Simulator sidebar's derived claiming-age readout, so there is one
// definition of "age" for SS purposes, not three.
export function ssClaimAge(startYear, startMonth, birthYear, birthMonth){
  return (startYear*12+startMonth - (birthYear*12+birthMonth)) / 12;
}

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
  // v4.4.0: re-derive Medicare/FRA anchors from birth date AFTER overrides
  // apply -- if ov.BASE contains a stale direct override of one of the
  // derived fields (e.g. a pre-v4.4.0 saved brendaFraYear), this overwrites
  // it right back with the birth-date-derived value, so birth date always
  // wins.
  deriveAgeAnchors(BASE);
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
  const youMedInf=Math.pow(1+hcpi,Math.max(0,calYear-BASE.medicareYouYear));
  // v4.4.0: You -> Medicare is now birth-date-derived (BASE.medicareYouYear/
  // Month = yourBirthYear+65/yourBirthMonth, see deriveAgeAnchors above) --
  // was a hardcoded Nov-2026 check. Compared as an absolute calendar month
  // (year*12+month) so the transition lands on the exact derived month, not
  // just the derived year.
  const absMo = calYear*12+calMonth;
  const you=(absMo < BASE.medicareYouYear*12+BASE.medicareYouMonth)?BASE.healthYouEricsson:Math.round(BASE.healthYouMedicare*youMedInf);
  let brenda;
  // v4.4.0: month-precision (was year-only) -- BASE.brendaMedYear/Month is
  // likewise birth-date-derived now.
  if(absMo >= BASE.brendaMedYear*12+BASE.brendaMedMonth){
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
// DEBT TIERING (v4.5.0, per-debt closing-eligibility v5.0.5) -- HI debt
// (CC/Sophia/Nolan, the named trio) and the generalized loans[] array
// (LI = low-interest, user-added) share ONE rate-ordered avalanche for both
// the ongoing surplus-sweep and the one-time property-sale-closing lump-sum.
// Tier membership is STRUCTURAL, never rate-based: HI is whatever's in the
// named trio, always sweepable (hardcoded -- no per-instance flag needed,
// there's no UI to change it), but each of the three now carries its own
// closingEligible flag (default true, App.jsx's HI Debt Balances cards) --
// same shape LI's loans[] entries already use, so the ONE-TIME lump-sum can
// skip a specific HI debt the same way it can skip a specific loan. LI is
// whatever's in loans[], each carrying its own explicit closingEligible/
// sweepable flags (both default false for user-added loans). A loan's rate
// governs PAYDOWN ORDER ONLY -- never which tier it belongs to, and never
// the "Debt Balances" chart's line grouping (see App.jsx).
// These three helpers are shared by buildScenario AND wfData (App.jsx) so the
// avalanche can't diverge between the two engines -- this is deliberately the
// LAST time this logic is written twice; a v5 single-engine refactor follows,
// and centralizing it here (rather than re-duplicating the tiering logic
// inline in both places, the way the pre-v4.5.0 mkDebts/applyPlan/q blocks
// were) is what makes that collapse simpler later. Do NOT add rate
// thresholds, payoff optimization, or auto-migration between tiers here --
// out of scope for this pass, deferred to the v5 refactor.
// =============================================================================

// Builds the [{key,balance,rate}] list `planHiPaydown` consumes for a ONE-TIME
// lump-sum payoff (the property-sale-closing routing) -- HI's three named
// balances, each gated on its OWN closingEligible flag (v5.0.5), plus
// whichever loans[] entries have `eligibleField` set (pass 'closingEligible'
// here). `hi` is {cc:{bal,rate,closingEligible}, sophia:{...}, nolan:{...}}.
export function buildDebtList(hi, loans, eligibleField){
  const out=[];
  if(hi.cc.bal>0 && hi.cc.closingEligible)         out.push({key:'cc',     balance:hi.cc.bal,     rate:hi.cc.rate});
  if(hi.sophia.bal>0 && hi.sophia.closingEligible) out.push({key:'sophia', balance:hi.sophia.bal, rate:hi.sophia.rate});
  if(hi.nolan.bal>0 && hi.nolan.closingEligible)   out.push({key:'nolan',  balance:hi.nolan.bal,  rate:hi.nolan.rate});
  for(const L of (loans||[])){
    if(L[eligibleField] && L.bal>0) out.push({key:'loan:'+L.label, balance:L.bal, rate:L.rate});
  }
  return out;
}

// Applies a planHiPaydown() plan back onto live state -- HI via setter
// closures (each engine's ccBal/sophiaBal/nolanBal are local `let`s), loans[]
// entries mutated directly by label-keyed lookup (same as the pre-v4.5.0
// applyPlan bodies this replaces).
export function applyDebtPlan(plan, hiSetters, loans){
  for(const [key,pay] of Object.entries(plan.perDebt||{})){
    if(key==='cc')          hiSetters.cc(pay);
    else if(key==='sophia') hiSetters.sophia(pay);
    else if(key==='nolan')  hiSetters.nolan(pay);
    else { const L=(loans||[]).find(l=>'loan:'+l.label===key); if(L) L.bal=Math.max(0,L.bal-pay); }
  }
}

// Filters an ONGOING sweep queue (entries shaped {g:()=>balance, s:(v)=>void,
// r:rate}, the getter/setter-closure shape both engines already used pre-
// v4.5.0) to positive balances, highest-rate-first -- replaces the identical
// `.filter(o=>o.g()>0).sort((a,b)=>b.r-a.r)` line duplicated in both engines.
export function rankSweepQueue(entries){
  return (entries||[]).filter(e=>e.g()>0).sort((a,b)=>b.r-a.r);
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
//         caSourceDeferredGain?, depreciationTaken?, sellingCostsInBasis? }
// mode: 'keep' | 'sell' (primary: no 1031) | 'full_1031' | 'partial_1031' (rentals)
// opts: { saleMode?, cashBoot?, sellingCostsPct?, rates? }
export function disposeAsset(prop, mode, opts = {}) {
  if (mode === 'keep') return null;
  const cfg = { ...DISPO_DEFAULTS, ...(opts.rates || {}) };
  const sellingCostsPct = opts.sellingCostsPct ?? cfg.sellingCostsPct;
  const forced = opts.saleMode === 'forced';

  const grossPrice   = prop.fmv * (forced ? (1 - cfg.forcedSaleDiscount) : 1);
  const sellingCosts = grossPrice * sellingCostsPct;
  // netSale is the CASH side -- always nets the real cost of sale, regardless
  // of basis treatment below. Used for afterTaxNetProceeds and (in
  // partial_1031) freedEquity; a dev-mode audit elsewhere in the app asserts
  // netSale === grossPrice - sellingCosts, so don't repurpose this field.
  const netSale      = grossPrice - sellingCosts;
  const mortgagePayoff = prop.mortgageBalance || 0;
  // v4.3.1: gainBasisPrice is the GAIN/TAX side, which can differ from netSale
  // -- some properties' adjustedBasis default already capitalizes their own
  // real-world selling costs (a documented historical fact per-property, e.g.
  // 6th St's $88,550 closing-cost line -- see defaults.js and prop.sellingCostsInBasis).
  // For THOSE properties only, subtracting sellingCostsPct again on top of an
  // already-cost-inclusive basis double-counts the cost and understates
  // taxable gain -- so the gain calc uses the gross price verbatim instead.
  // This must stay an explicit per-property opt-in (not a global toggle):
  // a property without a documented cost-inclusive basis must fall through
  // to the normal netSale-based gain calc, same as before this fix.
  const gainBasisPrice = prop.sellingCostsInBasis ? grossPrice : netSale;
  const realizedGain = Math.max(0, gainBasisPrice - (prop.basis || 0));

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
// DISPOSITIONS (v5.0.0) -- extracted from the old buildScenario so BOTH the
// monthly engine (for its sale-year pooled-routing timing) and the annual
// aggregation layer (for the Reconciliation/Disposition-breakdown cards) can
// call the SAME computation, instead of the monthly engine depending on the
// annual engine's output (which is what created the circularity risk once
// the annual view became an aggregation OF the monthly engine, rather than
// the other way around). Pure function of params only -- no month-by-month
// state, so it's cheap to call once per engine run.
// =============================================================================
export function computeDispositions(p){
  const properties = p.properties || [];
  function computeDispo(prop){
    const hold = prop.hold||{mode:'keep'};
    if(hold.mode==='keep') return {mode:'keep', year:Infinity, afterTaxNetProceeds:0, totalTax:0, recognizedGain:0, caSourceDeferredGain:0};
    // v4.2.5: disposition sale price is the entered property value, used verbatim --
    // appreciation is NEVER applied to sale price (see buildMonthlyScenario's own
    // continuously-appreciating propValue for held properties, the correct place
    // for appreciationPct).
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
      sellingCostsInBasis: hold.sellingCostsInBasis || false,
    };
    const res = disposeAsset(propObj, hold.mode, {
      saleMode: hold.saleMode,
      cashBoot: hold.cashBoot || 0,
      sellingCostsPct: hold.sellingCostsPct,
    });
    return { ...res, year: hold.year, quarter: hold.quarter, mode: hold.mode, caSourceDeferredGain: hold.caSourceDeferredGain || 0 };
  }
  const dispoRes = {};
  for(const prop of properties) dispoRes[prop.id] = computeDispo(prop);

  // CA $1.2M cap: applies across all NON-primary (rental) properties in year order
  const caCap = p.caGainCap ?? 1_200_000;
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

  // Snapshot per-property results BEFORE the obligation's gain offset and
  // same-year bump -- the CPA sheet assumes no offset, so the Reconciliation-
  // vs-CPA card must compare against these regardless.
  const dispoResNoOffset = Object.fromEntries(Object.entries(dispoRes).map(([k,v])=>[k,{...v}]));

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

  // Chronological cash events (v5.0.2) -- each disposition's after-tax
  // proceeds arrive at ITS OWN sale-quarter-start month, and the obligation's
  // cash payment arrives at ITS OWN quarter-start month, instead of all
  // same-year events being pre-summed into one lump applied at the year's
  // first month. This is separate from (and does not change) the tax-offset
  // netting above, which stays annual -- that's how capital-gains tax
  // actually works: offsetOn/gainsPool nets the obligation against the WHOLE
  // year's recognized gains regardless of quarter. Only the CASH-routing
  // timing (consumed by buildMonthlyScenario's pooled-routing block) is
  // quarter-precise. Multiple same-year events (multiple sales, and/or the
  // obligation) are kept as separate dated entries, sorted chronologically,
  // so the monthly loop can consume them in calendar order rather than
  // assuming one disposition per year.
  const cashEvents = {};   // year -> [{month, amount, kind, label}], signed amount (obligation negative)
  const pushCashEvent = (year, month, amount, kind, label) => {
    if(!cashEvents[year]) cashEvents[year] = [];
    cashEvents[year].push({month, amount, kind, label});
  };
  // In the model's own launch year, the monthly engine's rows only span
  // BASE.startMonth..12 (the partial first period -- there is no row for a
  // nominal quarter start earlier than that, the same reason
  // unitOwnedThisMonth already treats a launch-year sale quarter before
  // startMonth as "unowned from month 0"). Clamp the event's effective month
  // to the launch month in that one case, so the cash event lands on the
  // model's very first row instead of silently never matching any row.
  const effEventMonth = (year, quarter) =>
    year===BASE.startYear ? Math.max(quarterStartMonth(quarter), BASE.startMonth) : quarterStartMonth(quarter);
  for(const prop of properties){
    const d = dispoRes[prop.id];
    if(d.mode && d.mode!=='keep'){
      pushCashEvent(d.year, effEventMonth(d.year, d.quarter), d.afterTaxNetProceeds||0, 'sale', prop.label);
    }
  }
  if(obligAmt > 0){
    pushCashEvent(obligYr, effEventMonth(obligYr, obligation.quarter||1), -obligAmt, 'obligation', 'One-time obligation');
  }
  for(const yr of Object.keys(cashEvents)) cashEvents[yr].sort((a,b)=>a.month-b.month);

  // IRMAA fires 2 yrs after any taxable dispo (mode != 'full_1031', recognized gain > 0)
  const irmaaYears = new Set();
  for(const d of activeList){
    if((d.recognizedGain||0) > 0 && d.mode !== 'full_1031'){
      irmaaYears.add(d.year + 2);
    }
  }

  return { dispoRes, dispoResNoOffset, cashEvents, obligYr, obligAmt, irmaaYears };
}

// =============================================================================
// SINGLE MONTHLY ENGINE (v5.0.0) -- the sole source of truth for all financial
// logic: income, expenses, dispositions, taxes, debt paydown (HI + LI +
// mortgage), the cash-flow waterfall, net worth components. Replaces the old
// two-engine design (this function absorbs what both buildScenario's monthly
// mirror loop AND the pre-v5 wfData block did, reconciling every known
// divergence found in the v5 Phase 0 investigation -- see
// v5_phase0_findings.md for the full before/after catalog). The annual/
// Simulator view is now a pure aggregation of this function's output (see
// aggregateMonthlyToAnnual below), not an independent calculation.
//
// A1 (v5.0.0): maintenance is now `struct6/15/Laf x maintStr% x propCPI`,
// UNCAPPED, folded directly into Tier 1 (fixed costs) as an ordinary ongoing
// cost line -- the old capped 5-year reserve-fund concept (res6/res15/resLaf)
// is retired entirely, per the user's explicit decision: structure value is
// the right driver (not market value), and uncapped is the honest lifetime
// cost treatment. A capped reserve-FUNDING readout may return later as a
// separate display-only view -- not built here. Direct, measured consequence:
// the one-time sale-year pooled-proceeds routing's "reserve/buffer top-up"
// step narrows from 5 buckets to 2 (rd/ob only), since there's no longer a
// capped maintenance bucket to top off.
// =============================================================================
export function buildMonthlyScenario(p){
  const dispo = computeDispositions(p);
  const _cashEvents = dispo.cashEvents;
  const _irmaaYears = dispo.irmaaYears;
  // Every same-year cash event is known in full before the loop starts
  // (dispositions/obligation are deterministic params, not path-dependent),
  // so the year's EVENTUAL net total can be precomputed and used as a look-
  // ahead cap: a sale can't route more than the year will ultimately net to,
  // holding back whatever a KNOWN later same-year obligation will need --
  // otherwise an obligation arriving after its funding sale's proceeds are
  // already fully routed would have nothing left to net against (see
  // _yearPoolRouted below).
  const _yearFinalNet = {};
  for(const yr of Object.keys(_cashEvents)){
    _yearFinalNet[yr] = _cashEvents[yr].reduce((s,e)=>s+e.amount, 0);
  }

  const _properties = p.properties || [];
  const _propById = Object.fromEntries(_properties.map(pr=>[pr.id, pr]));
  const ownedMo = (propId, calYear, mo1to12) => unitOwnedThisMonth(_propById[propId]?.hold, calYear, mo1to12);

  // A1: uncapped, inflated, ongoing maintenance -- structure-value-based
  // (Cash-Flow-tab struct6/15/Laf sliders, NOT properties[].value).
  // v5.0.4: `||` -> `??` (nullish coalescing) -- same bug class as v5.0.1/
  // v5.0.3: an honestly-entered 0 (e.g. 0% maintenance rate) was silently
  // falling back to the nonzero default.
  const _maint6Base   = (p.struct6  ??600)*1000*(p.maintStr??0.75)/100/12;
  const _maint15Base  = (p.struct15 ??500)*1000*(p.maintStr??0.75)/100/12;
  const _maintLafBase = (p.structLaf??250)*1000*(p.maintStr??0.75)/100/12;
  const PROP_TAX_INS = {
    sixth:     { tax: BASE.primTaxMo, ins: BASE.primInsMo },
    fifteenth: { tax: BASE.dplxTaxMo, ins: BASE.dplxInsMo },
    barberry:  { tax: BASE.lafTaxMo,  ins: BASE.lafInsMo  },
  };

  // Segment cost profile (§1 table) -- same helper used everywhere else.
  const costOpts = {
    strPlatformPct: p.strPlatformPct||0, strCleanPct: p.strCleanPct||0, mgrPct: p.mgrPct||0,
    ltrVacancyPct: p.ltrVacancyPct||0, mtrCleaningFlat: p.mtrCleaningFlat||0,
  };

  const _yearPoolCum = {};      // year -> cumulative signed cash-event total to date (unfloored)
  const _yearPoolRouted = {};   // year -> cumulative amount already sent through the routing waterfall

  // v5.1.0: mortgage-principal paydown -- a NEW stop in the pooled-routing
  // chain (proceeds -> obligation -> one-time draw -> MORTGAGE PRINCIPAL
  // PAYDOWN -> cascade [HI debt avalanche -> reserves -> sweep]), same pool
  // (and same quarter-precise timing, see computeDispositions' cashEvents)
  // the draw/HI-debt/reserve steps already use. It's a single lump-sum total
  // requested once (settleMtgPaydown, $) -- NOT per-routing-pass -- so its
  // remaining un-applied amount is tracked across the whole monthly loop and
  // consumed by whichever routing pass has room, wherever in time that lands.
  let _settleMtgPaydownRemaining = Math.max(0, p.settleMtgPaydown||0);
  const _settleMtgPaydownTarget = p.settleMtgPaydownTarget || null;

  // Generalized loans -- monthly state (rates already decimal in p).
  const _loans = (p.loans||[]).map(l=>({
    label: l.label||'Loan', rate: l.rate||0, amount: l.amount||0,
    sweepable:       !!l.sweepable,
    closingEligible: !!l.closingEligible,
    pmt: loanMonthlyPmt(l.amount||0, l.rate||0, l.months||0),
    startAbs: Math.max(0, ((l.startYear||BASE.startYear)-BASE.startYear)*12 + ((l.startMonth||BASE.startMonth)-BASE.startMonth)),
    bal: 0, started:false, startAnnounced:false, payoffAnnounced:false,
  }));
  const _sweepLoanQ = ()=>_loans.filter(L=>L.sweepable && L.bal>0)
    .map(L=>({g:()=>L.bal, s:(v)=>{L.bal=v;}, r:L.rate}));

  // Mortgage state, one machine per property.
  const _mkMtg = (m,label)=>({p:{...m}, label, bal:m.balance, recast:null, ioPmt:0, transAnnounced:false, payoffAnnounced:false});
  const _mtgSt = {};
  for(const prop of _properties) _mtgSt[prop.id] = _mkMtg(prop.mortgage, prop.label);
  const MTG_PRINCIPAL_ELIGIBLE_IDS = ['sixth','fifteenth'];
  const _stepMtg = (st, calYear, calMonth1to12, owned)=>{
    const m=st.p;
    const k=(calYear-m.originYear)*12 + (calMonth1to12-m.originMonth);
    if(k<0 || !owned || st.bal<=0) return 0;
    const interest = st.bal*m.rate/12;
    if(k < m.ioYears*12) return interest;              // IO: interest only, balance flat
    if(st.recast==null){                                // recast on ACTUAL remaining balance
      st.recast = loanMonthlyPmt(st.bal, m.rate, Math.max(1, m.termYears*12 - k));
      st.ioPmt  = interest;
    }
    const pmt = Math.min(st.recast, st.bal + interest);
    st.bal = Math.max(0, st.bal + interest - pmt);
    return pmt;
  };

  const rdCap=p.rdCap||0, obCap=p.obCap||0, rdTopUp=p.rdTopUp||0, obTopUp=p.obTopUp||0;
  const discFloor=p.discFloor||0, bufferMode=p.bufferMode||'seq', sweepDelay=p.sweepDelay||0;
  const lifestyleSplit=p.lifestyleSplit||0, fcfSchedule=p.fcfSchedule||[];

  // Running balances -- always start at the real entered balance (v5.0.3:
  // the old payOffHI shortcut, which zeroed these from month 0 to represent
  // "debt already paid off outside the model," is retired -- see the v5.0.3
  // changelog note for rationale. A zero-HI-debt scenario is now only
  // reachable honestly: enter 0 balances, or let real paydown clear them.
  // v5.0.3: `||` -> `??` (nullish coalescing) -- same bug class as the
  // v5.0.1 STR/LTR fix: `||` treats a genuine entered 0 as falsy, so
  // dragging e.g. the Credit Card balance slider to $0 silently fell back
  // to the $60,000 default instead (found while verifying the payOffHI
  // removal above -- an honest "enter 0 to reach zero HI debt" scenario
  // didn't actually zero anything until this was fixed).
  let ccBal    = p.ccBal    ?? 60000;
  let sophiaBal= p.sophiaBal?? 58057;
  let nolanBal = p.nolanBal ?? 141117;
  const ccRate_    = p.ccRate    ?? 0.14;
  const ccMin_     = p.ccMin     ?? 1200;
  const sophiaRate_= p.sophiaRate?? 0.0814;
  const sophiaMin_ = p.sophiaMin ?? 737;
  const nolanRate_ = p.nolanRate ?? 0.084;
  const nolanMin_  = p.nolanMin  ?? 1787;
  let nolanOn = false;
  let rdBal   = 0;   // rainy day balance
  let obBal   = 0;   // operating buffer balance
  let debtClearedMo = -1;
  let savingsAcc = 0;

  const rows = [];
  const _startMonthClamped = Math.min(12, Math.max(1, Math.round(BASE.startMonth||1)));
  const startDate = new Date(BASE.startYear, _startMonthClamped-1);
  // v5.0.0 bugfix: the old hardcoded 252 (=21*12) only covers exactly through
  // December of year 20 when startMonth is January -- for any other start
  // month (the actual default is July) it overshoots 252-monthsElapsedBeforeYear(21,startMonth)
  // months PAST December of year 20, spilling into a spurious 22nd partial
  // calendar year. This was a latent bug in the pre-v5 wfData block too (just
  // never surfaced, because the old chartData only ever visited years present
  // in the separately-bounded 21-row buildScenario output and silently
  // ignored wfData's trailing overshoot months). monthsElapsedBeforeYear(21,
  // startMonth) is the exact month count through Dec of year 20, matching the
  // annual view's intended 21-year (yr 0-20) horizon precisely for any start month.
  const _totalMonths = monthsElapsedBeforeYear(21, _startMonthClamped);
  for(let mo=0; mo<_totalMonths; mo++){
    const d = new Date(startDate.getFullYear(), startDate.getMonth()+mo);
    const calYear = d.getFullYear();
    const calMonth1to12 = d.getMonth()+1;
    const inf    = Math.pow(1+p.inflation,   mo/12);
    const coreinf= Math.pow(1+(p.coreCpi||p.inflation), mo/12);
    const rg     = Math.pow(1+p.rentGrowth,  mo/12);
    const pinf   = Math.pow(1+(p.propCpi||p.propInflation), mo/12);

    // -- Pooled routing (v5.0.2): consumed CHRONOLOGICALLY, one pass per
    //    distinct event month -- each disposition's proceeds route at ITS OWN
    //    sale-quarter-start month, and the obligation's payment at ITS OWN
    //    quarter-start month (events landing in the same month, e.g. a sale
    //    and the obligation both in the same quarter, still net together in
    //    one pass, matching the old same-year netting exactly for that case).
    //    Routing at each event is capped at _yearFinalNet (the year's known
    //    eventual total, computed upfront) minus what's already been routed
    //    -- so an earlier sale correctly holds back whatever a KNOWN later
    //    same-year obligation will need, instead of routing the full amount
    //    immediately and leaving the obligation nothing to net against.
    //    Conservation across the year holds exactly regardless of event
    //    order (see _yearPoolRouted). Per pass: (a) one-time draw,
    //    (b) mortgage-principal paydown (v5.1.0 -- a lump sum requested once,
    //    consumed by whichever pass has room), (c) FULL post-draw-and-paydown
    //    remainder pays HI debt first (avalanche), (d) rd/ob buffers fill to
    //    caps [A1: narrowed from 5 buckets to 2 -- res6/res15/resLaf
    //    retired], (e) survivor joins this month's sweep/savings.
    let _oneTimeSweep = 0, _settleDrawMo = 0, _oneTimeReserveFill = 0, _payDetailMo = null;
    let _mtgPaydownMo = 0, _mtgPaydownNote = null;
    const _yrCashEvents = (_cashEvents[calYear]||[]).filter(e=>e.month===calMonth1to12);
    if(_yrCashEvents.length){
      const monthSum = _yrCashEvents.reduce((s,e)=>s+e.amount, 0);
      const cumulative = (_yearPoolCum[calYear]||0) + monthSum;
      _yearPoolCum[calYear] = cumulative;
      const cappedTotal = Math.min(cumulative, _yearFinalNet[calYear]||0);
      const routedSoFar = _yearPoolRouted[calYear]||0;
      const residual = Math.max(0, cappedTotal - routedSoFar);
      if(residual>0){
        const hasObligThisPass = _yrCashEvents.some(e=>e.kind==='obligation');
        const split = splitResidual(residual, {
          lifestyleDraw: hasObligThisPass ? (p.settleLifestyleDraw||0) : 0,
        });
        // v5.1.0: mortgage-principal paydown -- capped at (a) the lump sum's
        // own remaining un-applied total, (b) what's left in THIS pass's pool
        // after the draw, and (c) the target mortgage's own current balance
        // (mirrors planHiPaydown's own per-debt balance cap just below).
        // Applying it here, before this month's _stepMtg call runs later in
        // the loop, means (1) this month's interest accrual already sees the
        // reduced balance -- an immediate IO-period benefit -- and (2) the
        // eventual IO->P&I recast, which reads st.bal at the moment of
        // transition, picks up the reduction automatically with no separate
        // wiring. Target must still be a currently-held property with a
        // live mortgage state (buildMonthlyScenario has one _mtgSt entry per
        // property in p.properties) -- a sold/unknown target silently
        // contributes $0 here rather than throwing, so a stale saved
        // settleMtgPaydownTarget (e.g. a since-sold property) just falls
        // through to the ordinary cascade instead of erroring.
        if(_settleMtgPaydownRemaining>0 && _settleMtgPaydownTarget){
          const _mSt = _mtgSt[_settleMtgPaydownTarget];
          const _mOwned = ownedMo(_settleMtgPaydownTarget, calYear, calMonth1to12);
          if(_mSt && _mOwned && _mSt.bal>0){
            const pay = Math.min(_settleMtgPaydownRemaining, split.remainder, _mSt.bal);
            if(pay>0){
              const m = _mSt.p;
              const kNow = (calYear-m.originYear)*12 + (calMonth1to12-m.originMonth);
              const preIoEnd = _mSt.recast==null && kNow < m.ioYears*12;
              let recastDelta = 0;
              if(preIoEnd){
                const remMonths = Math.max(1, m.termYears*12 - m.ioYears*12);
                const withoutPmt = loanMonthlyPmt(_mSt.bal,     m.rate, remMonths);
                const withPmt    = loanMonthlyPmt(_mSt.bal-pay, m.rate, remMonths);
                recastDelta = Math.round(withoutPmt - withPmt);
              }
              _mSt.bal -= pay;
              _mtgPaydownMo = pay;
              _settleMtgPaydownRemaining -= pay;
              _mtgPaydownNote = {label:_mSt.label, amount:Math.round(pay), preIoEnd, recastDelta};
            }
          }
        }
        const postPaydownRemainder = split.remainder - _mtgPaydownMo;
        const plan = planHiPaydown(postPaydownRemainder, buildDebtList(
          {cc:{bal:ccBal,rate:ccRate_,closingEligible:p.ccClosingEligible??true},
           sophia:{bal:sophiaBal,rate:sophiaRate_,closingEligible:p.sophiaClosingEligible??true},
           nolan:{bal:nolanBal,rate:nolanRate_,closingEligible:p.nolanClosingEligible??true}},
          _loans, 'closingEligible'));
        applyDebtPlan(plan, {
          cc:     pay=>{ccBal     = Math.max(0, ccBal-pay);},
          sophia: pay=>{sophiaBal = Math.max(0, sophiaBal-pay);},
          nolan:  pay=>{nolanBal  = Math.max(0, nolanBal-pay);},
        }, _loans);
        _payDetailMo = {perDebt:plan.perDebt, total:plan.total, draw:split.draw, remainder:postPaydownRemainder};
        let rem = postPaydownRemainder - plan.total;
        const _fill = (bal,cap)=>{const add=Math.min(Math.max(0,cap-bal),rem); rem-=add; return add;};
        const _rdFill = _fill(rdBal, rdCap); rdBal += _rdFill;
        const _obFill = _fill(obBal, obCap); obBal += _obFill;
        _oneTimeReserveFill = _rdFill+_obFill;
        _oneTimeSweep = rem;    // (d) joins debt sweep if debt remains, else savings
        _settleDrawMo = split.draw;
        _yearPoolRouted[calYear] = cappedTotal;
      }
    }

    // -- INCOME --
    const pension  = BASE.pensionMonthly;
    const _ssAbsMo = calYear*12 + calMonth1to12;
    const yourSsMo = (p.ssStartYear && _ssAbsMo>=p.ssStartYear*12+(p.ssStartMonth||1)) ? p.ssAmount : 0;
    const brendaSsMo = (p.ssBrendaStartYear && _ssAbsMo>=p.ssBrendaStartYear*12+(p.ssBrendaStartMonth||1)) ? BASE.brendaSsFRA : 0;

    // -- Rental income: for each held property, for each unit, sum GROSS +
    //    NET across all covering segments, per-property broken out (D2).
    let rentalMo = 0, _rentalNetMo = 0;
    const propRentalMo = {};
    for(const prop of _properties){
      let propGross = 0, propNet = 0;
      if(ownedMo(prop.id, calYear, calMonth1to12)){
        for(const unit of (prop.units||[])){
          for(const seg of (unit.segments||[])){
            const f=seg.yrFrom??seg.yr, t=seg.yrTo??seg.yr;
            if(calYear<f || calYear>t) continue;
            propGross += unitSegmentGross(seg)/12*rg;
            propNet   += unitSegmentNet(seg, costOpts)/12*rg;
          }
        }
      }
      propRentalMo[prop.id] = Math.round(propGross);
      rentalMo += propGross; _rentalNetMo += propNet;
    }
    const rentalOpCost = Math.round(rentalMo - _rentalNetMo);
    const wkInc     = workFromCurve(mo/12, p.workPts)*inf;
    // A3: ad-hoc scheduled lifestyle draws used to be funded from `cashAst`
    // (guarded by `min(d.amount, cashAst+d.amount)`) -- since cashAst is
    // retired as inert (measured $0 in every scenario, see A3), that guard
    // never actually bound in practice, so injecting the full amount
    // unconditionally in the scheduled year's first month is behaviorally
    // identical to the old path for every real scenario, just simpler.
    const yrIndexNow = calYear - BASE.startYear;
    const isFirstMonthOfYr = mo===0 || calMonth1to12===1;
    const drawInc = isFirstMonthOfYr
      ? (p.lifestyleDraws||[]).reduce((s,dr)=>s+(dr && dr.yr===yrIndexNow && dr.amount>0 ? dr.amount : 0), 0)
      : 0;
    const totalInc  = pension+yourSsMo+brendaSsMo+rentalMo+wkInc-rentalOpCost+drawInc;

    // -- D1: property appreciation -- continuous monthly compounding
    //    (mo/12), gated 0 once sold. Sale price itself never uses this (see
    //    computeDispositions -- entered value verbatim, unaffected).
    const propValue = {};
    for(const prop of _properties){
      const appPct = prop.appreciationPct ?? p.reAppreciation;
      propValue[prop.id] = ownedMo(prop.id, calYear, calMonth1to12) ? prop.value*Math.pow(1+appPct, mo/12) : 0;
    }

    // -- TIER 1: FIXED COSTS (A1: maintenance folded in here, uncapped) --
    const health = healthMonthly(calYear, calMonth1to12, p);
    const hiDebtNow = ccBal+sophiaBal+nolanBal;
    // D2: per-debt balances, same pre-decrement snapshot convention as hiDebtNow.
    const ccBalNow=ccBal, sophiaBalNow=sophiaBal, nolanBalNow=nolanBal;
    let mtg = 0;
    const propMtgBal = {}, propIoMode = {};
    for(const prop of _properties){
      const owned = ownedMo(prop.id, calYear, calMonth1to12);
      mtg += _stepMtg(_mtgSt[prop.id], calYear, calMonth1to12, owned);
      // Gated by ownership (0 once sold) -- matches the old annual engine's
      // `balById[id] = keepMap[id] ? mtgById[id].bal : 0` convention. Without
      // this gate, a sold property's mortgage state simply stops being
      // stepped (stays frozen at its pre-sale balance forever, since
      // _stepMtg's `owned` guard returns early without touching st.bal) --
      // reading it ungated would wrongly keep subtracting a paid-off
      // mortgage from NW for every year after the sale.
      propMtgBal[prop.id] = owned ? Math.round((_mtgSt[prop.id]?.bal)||0) : 0;
      // D2/aggregation: still inside its contractual IO window (recast hasn't
      // happened yet) -- same definition the old annual engine's `ioMode` used.
      propIoMode[prop.id] = owned && _mtgSt[prop.id].recast==null && _mtgSt[prop.id].bal>0 && (prop.mortgage?.ioYears||0)>0;
    }
    const core      = (BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*coreinf;
    let famLoan = 0;
    const loanStartLabels=[], loanPayoffLabels=[];
    for(const L of _loans){
      if(!L.started && mo>=L.startAbs && L.amount>0){ L.bal=L.amount; L.started=true; }
      if(L.bal>0){
        L.bal *= (1+L.rate/12);
        const pay = Math.min(L.pmt, L.bal);
        L.bal -= pay;
        famLoan += pay;
        if(L.bal < 0.5) L.bal = 0;
      }
      if(L.started && !L.startAnnounced){ L.startAnnounced=true; loanStartLabels.push(L.label); }
      if(L.started && L.bal<=0 && !L.payoffAnnounced){ L.payoffAnnounced=true; loanPayoffLabels.push(L.label); }
    }
    if(mo>=5) nolanOn=true;   // v4.3.0 follow-up: still an elapsed-months gate, unchanged from pre-v5
    const minCC  = ccBal>0?ccMin_:0;
    const minSoph= sophiaBal>0?sophiaMin_:0;
    const minNol = nolanOn&&nolanBal>0?nolanMin_:0;
    const hiMins = minCC+minSoph+minNol;
    const propCost = Math.round(
      _properties.reduce((s,prop)=>{
        if(!ownedMo(prop.id, calYear, calMonth1to12)) return s;
        const ti = PROP_TAX_INS[prop.id];
        return s + (ti ? (ti.tax+ti.ins)*pinf : 0);
      }, 0)
    );
    const _mtgInt = _properties.reduce((s,prop)=>{
      if(!ownedMo(prop.id, calYear, calMonth1to12)) return s;
      const st = _mtgSt[prop.id];
      return s + st.bal*st.p.rate;
    }, 0);
    const taxMo = Math.round(estimateTax(p, BASE.pensionMonthly*12, wkInc*12, yourSsMo, brendaSsMo, rentalMo*12, _mtgInt) / 12);
    // A1: maintTotal folds directly into tier1 -- no separate capped-reserve tier.
    const maint6Mo   = ownedMo('sixth', calYear, calMonth1to12)     ? _maint6Base  *pinf : 0;
    const maint15Mo  = ownedMo('fifteenth', calYear, calMonth1to12) ? _maint15Base *pinf : 0;
    const maintLafMo = ownedMo('barberry', calYear, calMonth1to12)  ? _maintLafBase*pinf : 0;
    const maintTotal = maint6Mo+maint15Mo+maintLafMo;
    // Per-property breakdown -- exposed on the row (propMaintMo below) so any
    // report/audit of the A1 maintenance change can read the real engine
    // computation directly instead of re-deriving the formula separately.
    const propMaintMo = { sixth: Math.round(maint6Mo), fifteenth: Math.round(maint15Mo), barberry: Math.round(maintLafMo) };
    // v5.0.0 fix: IRMAA (Medicare Part B/D surcharge, triggered 2 years after
    // any taxable property disposition -- mode!=='full_1031', recognizedGain>0)
    // was a separate cost term (`irmaaAdd`) in the pre-v5 annual engine's
    // baseOut, computed from the identical irmaaYears trigger logic now shared
    // via computeDispositions -- ported here verbatim (flat $/mo, no inflation,
    // matching old's `BASE.irmaaSurge*2*monthsThisYear` annual-then-prorated
    // form exactly, just evaluated per month instead of per year).
    const irmaaAddMo = _irmaaYears.has(calYear) ? BASE.irmaaSurge*2 : 0;
    const tier1  = mtg+health+core+famLoan+hiMins+propCost+taxMo+maintTotal+irmaaAddMo;

    // -- FCF FLOOR: check schedule first, fall back to global discFloor --
    const _fcfSched = fcfSchedule.find(s=>calYear>=s.yrFrom&&calYear<=s.yrTo);
    const effectiveFloor = _fcfSched ? _fcfSched.floor : discFloor;

    // -- TIER 2 & 3: SAVINGS BUCKETS (rd/ob only -- A1 retired the maintenance
    //    reserve tier, so `available` no longer subtracts a separate maintTotal --
    //    it's already inside tier1 above) --
    const available = totalInc-tier1;
    let rdAdd = 0;
    if(rdBal<rdCap){
      rdAdd = Math.min(rdTopUp, rdCap-rdBal, Math.max(0,available-effectiveFloor));
    }
    let obAdd = 0;
    const rdFull = rdBal>=rdCap;
    if(bufferMode==="par"||(bufferMode==="seq"&&rdFull)){
      if(obBal<obCap){
        obAdd = Math.min(obTopUp, obCap-obBal, Math.max(0,available-rdAdd-effectiveFloor));
      }
    }

    // -- TIER 4 & 5: FCF FLOOR + SURPLUS SWEEP --
    const afterBuckets = available-rdAdd-obAdd;
    const cfSplitProtect = Math.max(effectiveFloor, afterBuckets*(lifestyleSplit/100));
    const surplusAboveFloor = Math.max(0, afterBuckets - cfSplitProtect);
    const hasDebt = hiDebtNow > 0 || _loans.some(L=>L.sweepable && L.bal>0);
    // A1: maintRedirect term removed -- nothing is capped anymore, so nothing
    // is ever "freed" from a full maintenance reserve into the sweep.
    const sweep = hasDebt ? surplusAboveFloor + _oneTimeSweep : 0;
    const _oneTimeToSavings = hasDebt ? 0 : _oneTimeSweep;

    // Apply interest & payments to debt balances
    const intCC    = ccBal>0     ? ccBal*ccRate_/12       : 0;
    const intSoph  = sophiaBal>0 ? sophiaBal*sophiaRate_/12 : 0;
    const intNolan = nolanOn&&nolanBal>0 ? nolanBal*nolanRate_/12 : 0;
    const interestPaid = intCC + intSoph + intNolan;
    const minPmt = (ccBal>0?minCC:0) + (sophiaBal>0?minSoph:0) + (nolanOn&&nolanBal>0?minNol:0);
    if(ccBal>0)    {ccBal    =Math.max(0,ccBal    *(1+ccRate_/12)    -minCC);}
    if(sophiaBal>0){sophiaBal=Math.max(0,sophiaBal*(1+sophiaRate_/12)-minSoph);}
    if(nolanOn&&nolanBal>0){nolanBal=Math.max(0,nolanBal*(1+nolanRate_/12)-minNol);}
    let xtra=sweep;
    const q=rankSweepQueue([
      {g:()=>ccBal,    s:(v)=>{ccBal=v;},     r:ccRate_},
      {g:()=>sophiaBal,s:(v)=>{sophiaBal=v;},  r:sophiaRate_},
      ...(nolanOn?[{g:()=>nolanBal,s:(v)=>{nolanBal=v;},r:nolanRate_}]:[]),
      ..._sweepLoanQ(),
    ]);
    for(const loan of q){if(xtra<=0)break;const pay=Math.min(xtra,loan.g());loan.s(loan.g()-pay);xtra-=pay;}

    if(debtClearedMo<0 && hiDebtNow<=0) debtClearedMo = mo;
    const debtWasCleared = debtClearedMo >= 0;
    const graceDone = debtWasCleared && !hasDebt && (mo - debtClearedMo) >= sweepDelay;
    let toSavings = (graceDone ? surplusAboveFloor : 0) + _oneTimeToSavings;
    let mtgExtraMo = 0;
    if(p.mtgPrincipalOn){
      const _mcap = p.mtgPrincipalUncapped ? Infinity : (p.mtgPrincipalCap||0);
      const _leftover = Math.max(0, xtra);
      const room = Math.min(_mcap, _leftover + toSavings);
      for(const id of MTG_PRINCIPAL_ELIGIBLE_IDS){
        if(room - mtgExtraMo <= 0) break;
        const st = _mtgSt[id];
        if(!st || !ownedMo(id, calYear, calMonth1to12) || st.bal<=0) continue;
        const pay = Math.min(room - mtgExtraMo, st.bal);
        st.bal -= pay; mtgExtraMo += pay;
      }
      const _takenFromSavings = Math.max(0, mtgExtraMo - _leftover);
      toSavings = Math.max(0, toSavings - _takenFromSavings);
    }
    const sweepToSavings = toSavings;
    if(savingsAcc>0) savingsAcc *= (1+(p.investReturn??0.055)/12);
    if(sweepToSavings>0) savingsAcc += sweepToSavings;

    rdBal  = Math.min(rdCap,  rdBal+rdAdd);
    obBal  = Math.min(obCap,  obBal+obAdd);

    const hiDebtEnd = hiDebtNow;
    const disc = graceDone
      ? cfSplitProtect
      : Math.max(effectiveFloor, afterBuckets - (sweep - _oneTimeSweep));

    // D3: totalOut -- necessary spending only (tier1 incl. maint, the debt
    // avalanche, and mortgage-principal extra); deliberately excludes rd/ob
    // top-ups, which are discretionary and only ever funded from surplus
    // already above the floor, never competing with "does income cover costs."
    const totalOut = tier1 + sweep + mtgExtraMo;

    // D4: structured events (label/delta), alongside the existing display
    // strings, at the same points those strings are already emitted -- avoids
    // ever needing to parse the display text back into structured data.
    const mtgTransitionEvents=[], mtgPayoffLabels=[];

    // Detect key events
    const events=[];
    if(mo===0) events.push("Launch");
    if(calYear===BASE.medicareYouYear && calMonth1to12===BASE.medicareYouMonth) events.push("You -> Medicare");
    if(mo===5) events.push("Nolan loan payments begin");
    for(const lbl of loanStartLabels) events.push(`${lbl} starts -- $${Math.round(_loans.find(L=>L.label===lbl)?.pmt||0).toLocaleString()}/mo`);
    for(const lbl of loanPayoffLabels) events.push(`${lbl} paid off!`);
    for(const prop of _properties){
      const st = _mtgSt[prop.id];
      if(st.recast!=null && !st.transAnnounced && (st.p.ioYears||0)>0){
        st.transAnnounced=true;
        const delta = Math.round(st.recast-st.ioPmt);
        events.push(`${st.label} mortgage: IO→P&I (+$${delta.toLocaleString()}/mo)`);
        mtgTransitionEvents.push({label:st.label, delta});
      }
      if(st.bal<=0 && !st.payoffAnnounced){
        st.payoffAnnounced=true;
        events.push(`${st.label} mortgage paid off early! 🎉`);
        mtgPayoffLabels.push(st.label);
      }
    }
    for(const e of _yrCashEvents){
      if(e.kind==='sale') events.push(`${e.label} sold -- net proceeds $${Math.round(e.amount/1000)}K`);
      if(e.kind==='obligation') events.push(`One-time obligation paid -- $${Math.round(-e.amount/1000)}K`);
    }
    if(_settleDrawMo>0) events.push(`Obligation-year one-time draw $${Math.round(_settleDrawMo/1000)}K`);
    if(_mtgPaydownMo>0){
      const recastNote = (_mtgPaydownNote.preIoEnd && _mtgPaydownNote.recastDelta>0)
        ? ` (lowers post-IO recast payment by ~$${_mtgPaydownNote.recastDelta.toLocaleString()}/mo)` : '';
      events.push(`$${Math.round(_mtgPaydownMo/1000)}K sale proceeds to ${_mtgPaydownNote.label} principal${recastNote}`);
    }
    if(_payDetailMo && _payDetailMo.total>0) events.push(`Sale proceeds: $${Math.round(_payDetailMo.total/1000)}K lump-sum to debt (avalanche, debt-first)`);
    if(_oneTimeReserveFill>0) events.push(`$${Math.round(_oneTimeReserveFill/1000)}K sale proceeds into reserve/buffer caps`);
    if(_oneTimeSweep>0) events.push(`$${Math.round(_oneTimeSweep/1000)}K sale proceeds into savings sweep`);
    if(rdBal>=rdCap&&rdBal-rdAdd<rdCap) events.push("Rainy day fund FULL -- redirecting to sweep");
    if(obBal>=obCap&&obBal-obAdd<obCap) events.push("Operating buffer FULL -- redirecting to sweep");
    if(debtClearedMo===mo && mo>0) events.push("ALL HI DEBT CLEARED! 🎉");
    if(calYear===BASE.sophiaOff&&calMonth1to12===10) events.push("Sophia off health plan");
    if(calYear===BASE.nolanOff&&calMonth1to12===6)  events.push("Nolan off health plan");
    if(calYear===BASE.brendaMedYear && calMonth1to12===BASE.brendaMedMonth) events.push("Brenda -> Medicare");

    rows.push({
      mo, calYear, cal:`${d.toLocaleString('default',{month:'short'})} '${String(calYear).slice(2)}`,
      totalInc:Math.round(totalInc), tier1:Math.round(tier1), rentalOpCost:Math.round(rentalOpCost),
      fc_mtg:Math.round(mtg), fc_health:Math.round(health), fc_core:Math.round(core),
      fc_famLoan:Math.round(famLoan), fc_hiMins:Math.round(hiMins), fc_rentalOp:Math.round(rentalOpCost),
      fc_propCost:Math.round(propCost), fc_tax:taxMo,
      fc_irmaa: Math.round(irmaaAddMo),   // v5.0.0 fix: ported from pre-v5's separate irmaaAdd baseOut term
      maintRes:Math.round(maintTotal),   // A1: uncapped ongoing cost, name kept for UI compat
      rdAdd:Math.round(rdAdd), obAdd:Math.round(obAdd),
      sweep:Math.round(sweep), disc:Math.round(disc), floor:effectiveFloor, afterBuckets:Math.round(afterBuckets),
      rdBal:Math.round(rdBal), obBal:Math.round(obBal),
      hiDebt:Math.round(hiDebtEnd/1000),
      interestPaid:Math.round(interestPaid), minPmt:Math.round(minPmt),
      sweepToSavings:Math.round(sweepToSavings), savingsAcc:Math.round(savingsAcc),
      settleDraw: Math.round(_settleDrawMo),
      mtgLumpPaydown: Math.round(_mtgPaydownMo),   // v5.1.0: pooled-routing mortgage-principal stop
      mtgPaydownDetail: _mtgPaydownNote,
      paydownDetail: _payDetailMo ? _payDetailMo.perDebt : null,
      oneTimePaydown: Math.round(_payDetailMo ? _payDetailMo.total : 0),
      oneTimeReserveFill: Math.round(_oneTimeReserveFill),
      oneTimeSweep: Math.round(_oneTimeSweep),
      loansBal: Math.round(_loans.reduce((s,L)=>s+L.bal,0)),
      totalOut: Math.round(totalOut),
      mtgExtra: Math.round(mtgExtraMo),
      mtgBal6:  propMtgBal.sixth||0,
      mtgBal15: propMtgBal.fifteenth||0,
      mtgBalLaf: propMtgBal.barberry||0,      // D2: was missing entirely pre-v5
      propMtgBal, propRentalMo, propValue, propIoMode, propMaintMo,  // D1/D2/A1: generic per-property state
      ccBalRaw: Math.round(ccBalNow), sophiaBalRaw: Math.round(sophiaBalNow), nolanBalRaw: Math.round(nolanBalNow), // D2
      loanStartLabels, loanPayoffLabels, mtgTransitionEvents, mtgPayoffLabels,  // D4
      events,
      pension:Math.round(pension),
      yourSs:Math.round(yourSsMo),
      brendaSs:Math.round(brendaSsMo),
      rental:Math.round(rentalMo),
      workIncome:Math.round(wkInc),
      drawInc:Math.round(drawInc),   // A3: scheduled lifestyle draws, now unconditional (see note above)
    });
  }
  rows.dispoResults = dispo.dispoRes;
  rows.dispoResultsNoOffset = dispo.dispoResNoOffset;
  return rows;
}

// =============================================================================
// ANNUAL AGGREGATION (v5.0.0) -- the Simulator tab's annual view is a pure
// rollup of buildMonthlyScenario's output: stocks = the value from the FIRST
// month of the row's period (matching wfData's own pre-decrement-this-month
// convention, so "row yr's balance" already means "balance as of the START
// of that period" with no extra snapshot logic needed); flows = summed over
// the real months in that period (yr=0's partial first period falls out
// automatically -- wfData's own calendar already starts at BASE.startMonth,
// there are no fabricated pre-start months to exclude).
// =============================================================================
export function aggregateMonthlyToAnnual(wfRows, p){
  const byYear = {};
  for(const r of wfRows){
    (byYear[r.calYear] = byYear[r.calYear]||[]).push(r);
  }
  const years = Object.keys(byYear).map(Number).sort((a,b)=>a-b);
  const rows = [];
  let cumInc=0,cumCost=0,cumPension=0,cumWork=0,cumSS=0,cumRental=0,cumDraw=0;
  let cumMtg=0,cumHealth=0,cumCore=0,cumProp=0,cumMaint=0,cumDebt=0,cumTax=0;

  years.forEach((cal,yr)=>{
    const yrRows = byYear[cal];
    const first = yrRows[0];
    const last  = yrRows[yrRows.length-1];
    const cnt = yrRows.length;
    const sum = k=>yrRows.reduce((s,r)=>s+(r[k]||0),0);
    const avgMo = k=>sum(k)/cnt;

    // v5.0.0 fix: pre-v5, the annual engine's own `rental` field was built via
    // unitSegmentNet() -- already net of rental operating costs (STR platform/
    // cleaning%, LTR vacancy%, etc). wfData's `rental` field is GROSS (opex is
    // tracked separately as `rentalOpCost`) -- avgMo('rental') alone silently
    // dropped opex from `passive`/`reqWork`, understating required work income
    // by the opex amount. Net it back out here to restore the exact pre-v5
    // semantics (this is the ONE field known to need this treatment -- see the
    // systematic audit in v5_phase0_findings.md for every other wfData field
    // aggregateMonthlyToAnnual reads, none of which have a matching separate
    // "cost to fold back in" field the way rental/rentalOpCost do).
    const passive = avgMo('pension')+avgMo('yourSs')+avgMo('brendaSs')+avgMo('rental')-avgMo('rentalOpCost');
    const totalOutAvg = avgMo('totalOut');
    const reqWork = Math.max(0, totalOutAvg-passive);

    // Stocks: first-of-period snapshot (pre-decrement, matching v4.3.0 convention)
    const hiDebtRaw = (first.ccBalRaw||0)+(first.sophiaBalRaw||0)+(first.nolanBalRaw||0);
    const primBal = first.propMtgBal?.sixth||0, dplxBal = first.propMtgBal?.fifteenth||0, lafBal = first.propMtgBal?.barberry||0;
    const primVal = first.propValue?.sixth||0, dplxVal = first.propValue?.fifteenth||0, lafVal = first.propValue?.barberry||0;
    // v5.0.0: nw now includes savingsAcc directly -- pre-v5, buildScenario's
    // own nw never included it (savingsAcc was a monthly-only concept, added
    // back in separately at the chartData layer: `nw:(r.nw/1000)+savAccM`).
    // Now that there's one engine, that add-back happens here once instead of
    // twice (chartData still needs to do ITS OWN sale-pool-timing-consistent
    // read for the live-vs-pin comparison lines, but the base annual `nw`
    // field is complete and self-contained -- see the cross-cutting note in
    // v5_phase0_findings.md's 0a).
    const nw = Math.round((dplxVal+lafVal+primVal+(first.savingsAcc||0)+0/*cashAst -- A3: inert, treated as 0*/-dplxBal-lafBal-primBal-hiDebtRaw)/1000);

    // One-time pool-year event, if any (at most one wfRow per year has it)
    const poolRow = yrRows.find(r=>(r.settleDraw||0)>0 || (r.mtgLumpPaydown||0)>0 || (r.oneTimePaydown||0)>0 || (r.oneTimeReserveFill||0)>0);

    // Structured by-year event lists (D4)
    const loanStarts = yrRows.flatMap(r=>r.loanStartLabels||[]);
    const loanPayoffs = yrRows.flatMap(r=>r.loanPayoffLabels||[]);
    const mtgTransitions = yrRows.flatMap(r=>r.mtgTransitionEvents||[]);
    const mtgPayoffs = yrRows.flatMap(r=>r.mtgPayoffLabels||[]);

    // Disposition summary for this calendar year (from computeDispositions,
    // called once via buildMonthlyScenario -- reuse its attached results).
    const dispoRes = wfRows.dispoResults || {};
    const dispoTaxYr = Object.values(dispoRes).reduce((s,d)=>s+(d.year===cal ? d.totalTax : 0), 0);
    const dispoNetYr = Object.values(dispoRes).reduce((s,d)=>s+(d.year===cal ? (d.afterTaxNetProceeds||0) : 0), 0);
    const obligation = p.obligation || {};
    const settlementOutYr = cal === (obligation.year||BASE.startYear) ? (obligation.amount||0) : 0;
    // ioMode: still inside its contractual IO window on the first day of this
    // period -- same definition (and same field name) the old annual engine used.
    const ioModeYr = Object.values(first.propIoMode||{}).some(Boolean);

    const row = {
      cal, yr,
      cashAst: 0, invested: 0,   // A3: cashAst is inert given current pooled-routing design (measured 0 in every captured scenario) -- no shortfall ledger built
      surplus:  Math.round(avgMo('disc')),   // A4: was two annual-only definitions (surplus/fcfChart); now one, sourced from the monthly disc field
      reqWork:  Math.round(reqWork),
      nw,
      hiDebt:   Math.round(hiDebtRaw/1000),
      hiDebtRaw,
      rental:   Math.round(avgMo('rental')),
      passive:  Math.round(passive),
      pension:  Math.round(avgMo('pension')),
      yourSs:   Math.round(avgMo('yourSs')),
      brendaSs: Math.round(avgMo('brendaSs')),
      workInc:  Math.round(avgMo('workIncome')),
      tax:      Math.round(avgMo('fc_tax')),
      health:   Math.round(avgMo('fc_health')),
      irmaa:    Math.round(avgMo('fc_irmaa')),   // v5.0.0 fix: ported pre-v5 irmaaAdd, see buildMonthlyScenario
      mtg:      Math.round(avgMo('fc_mtg')),
      propCost: Math.round(avgMo('fc_propCost')),
      core:     Math.round(avgMo('fc_core')),
      maint:    Math.round(avgMo('maintRes')),
      famLoan:  Math.round(avgMo('fc_famLoan')),
      famLoanBal: Math.round((first.loansBal||0)/1000),   // $K, matches the old annual engine's units
      minDebt:  Math.round(avgMo('minPmt')),
      debtSweep:Math.round(avgMo('sweep')),
      sweepToSavings: Math.round(avgMo('sweepToSavings')),  // ongoing (non-pool-year) monthly sweep-to-savings flow, $/mo avg
      totalDebtPmt: Math.round(avgMo('minPmt')+avgMo('sweep')),
      totalInc: Math.round(avgMo('totalInc')),
      totalOut: Math.round(totalOutAvg),
      reEquity: Math.round((dplxVal+lafVal+primVal-dplxBal-lafBal-primBal)/1000),
      reValue:  Math.round((dplxVal+lafVal+primVal)/1000),
      reMortgage:Math.round((dplxBal+lafBal+primBal)/1000),
      hiDebtK:  Math.round(hiDebtRaw/1000),
      ccBal:    Math.round((first.ccBalRaw||0)/1000),
      sophiaBal:Math.round((first.sophiaBalRaw||0)/1000),
      nolanBal: Math.round((first.nolanBalRaw||0)/1000),
      ioMode: ioModeYr,
      dispoTax: Math.round(dispoTaxYr),
      dispoNet: Math.round(dispoNetYr),
      settlementOut: Math.round(settlementOutYr),
      settleDraw:   Math.round(poolRow?.settleDraw||0),
      wfMtgPaydown: Math.round(poolRow?.mtgLumpPaydown||0),   // v5.1.0: pooled-routing mortgage-principal stop
      mtgPaydownDetail: poolRow?.mtgPaydownDetail || null,
      wfDebtPaid:   Math.round(poolRow?.oneTimePaydown||0),
      // B2 fix: reserve top-ups and true sweep are no longer conflated --
      // wfToSavings now means TRUE savings only (matches the monthly engine's
      // own oneTimeSweep), with the reserve-fill portion broken out separately.
      wfReserveFill: Math.round(poolRow?.oneTimeReserveFill||0),
      wfToSavings:  Math.round(poolRow?.oneTimeSweep||0),
      hiPaydownDetail: poolRow?.paydownDetail || null,
      loanStarts, loanPayoffs, mtgTransitions, mtgPayoffs,
      mtgExtra: Math.round(sum('mtgExtra')),
      primBalRaw: Math.round(primBal), dplxBalRaw: Math.round(dplxBal), lafBalRaw: Math.round(lafBal),
      // Per-property annual rental $ -- sum the monthly per-property breakdown (D2).
      propRentalYr: Object.fromEntries(Object.keys(first.propRentalMo||{}).map(id=>
        [id, Math.round(yrRows.reduce((s,r)=>s+(r.propRentalMo?.[id]||0),0))])),
      // Per-property $/mo avg maintenance (A1) -- for audit/reporting, reads
      // the real engine computation rather than re-deriving the formula.
      propMaintYr: Object.fromEntries(Object.keys(first.propMaintMo||{}).map(id=>
        [id, Math.round(yrRows.reduce((s,r)=>s+(r.propMaintMo?.[id]||0),0)/cnt)])),
      drawInc: Math.round(avgMo('drawInc')),
      // End-of-year snapshot (as opposed to nw's start-of-year one) -- for
      // "how much has been swept to savings so far" displays (chartData's
      // sweepSavK-style readouts), not for nw itself.
      savingsAccEnd: Math.round(last.savingsAcc||0),
    };

    const _cumMo = cnt;
    cumInc     +=row.totalInc*_cumMo/1000;
    cumCost    +=row.totalOut*_cumMo/1000;
    cumPension +=row.pension*_cumMo/1000;
    cumWork    +=row.workInc*_cumMo/1000;
    cumSS      +=(row.yourSs+row.brendaSs)*_cumMo/1000;
    cumRental  +=row.rental*_cumMo/1000;
    // cumDraw includes BOTH scheduled lifestyle draws (drawInc, a $/mo rate)
    // AND the one-time settlement draw (settleDraw, already a period total,
    // not a rate -- added directly, not *_cumMo) -- matches the old annual
    // engine's combined drawInc semantics (settleDraw used to be blended
    // into the SAME drawInc field before being split out as its own field).
    cumDraw    +=row.drawInc*_cumMo/1000 + (row.settleDraw||0)/1000;
    cumTax     +=row.tax*_cumMo/1000;
    cumMtg     +=row.mtg*_cumMo/1000;
    cumHealth  +=row.health*_cumMo/1000;
    cumCore    +=row.core*_cumMo/1000;
    cumProp    +=row.propCost*_cumMo/1000;
    cumMaint   +=row.maint*_cumMo/1000;
    cumDebt    +=(row.minDebt+row.debtSweep)*_cumMo/1000;
    row.cumInc   =Math.round(cumInc);
    row.cumCost  =Math.round(cumCost);
    row.cumPension=Math.round(cumPension);
    row.cumWork  =Math.round(cumWork);
    row.cumSS    =Math.round(cumSS);
    row.cumRental=Math.round(cumRental);
    row.cumDraw  =Math.round(cumDraw);
    row.cumGap   =Math.round(cumInc-cumCost);
    row.cumTax   =Math.round(cumTax);
    row.cumMtg   =Math.round(cumMtg);
    row.cumHealth=Math.round(cumHealth);
    row.cumCore  =Math.round(cumCore);
    row.cumProp  =Math.round(cumProp);
    row.cumMaint =Math.round(cumMaint);
    row.cumDebt  =Math.round(cumDebt);
    rows.push(row);
  });

  rows.dispoResults = wfRows.dispoResults;
  rows.dispoResultsNoOffset = wfRows.dispoResultsNoOffset;
  return rows;
}

// =============================================================================
// [DELETED v5.0.0] ANNUAL PROJECTION ENGINE (buildScenario) -- the annual
// engine's independent implementation is retired; the Simulator/annual view
// is now pure aggregation of buildMonthlyScenario's output (see
// aggregateMonthlyToAnnual above). See v5_phase0_findings.md for the full
// investigation, the approved modeling decisions (A1-A4), the bugs this
// collapse fixes (B1-B3), and the clean precision differences it absorbs
// (C1-C2).
// =============================================================================

export function keyStats(rows){
  const workFreeYr = rows.find(r=>r.reqWork===0)?.cal ?? null;
  const debtClearYr= rows.find(r=>r.hiDebt===0)?.cal ?? null;
  const nwYr10     = rows[10]?.nw ?? 0;
  const maxDI      = Math.max(...rows.map(r=>r.surplus));
  const launchRW   = rows[0]?.reqWork ?? 0;
  return { workFreeYr, debtClearYr, nwYr10, maxDI, launchRW };
}
