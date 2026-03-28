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

  const flr=p.famLoanRate/12;
  const famLoanMoPmt=p.famLoanAmt>0
    ?p.famLoanAmt*(flr*Math.pow(1+flr,BASE.famLoanMonths))/(Math.pow(1+flr,BASE.famLoanMonths)-1)
    :0;

  const sellYr  = p.sellYear || 2055;
  const lafStopYr = p.lafStopYear || 2055;

  for(let yr=0;yr<=20;yr++){
    const cal=BASE.startYear+yr;
    const keepPrimary = cal < sellYr;
    const sold        = cal >= sellYr;
    const lafRenting  = p.lafRental && cal < lafStopYr;

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

    let rental=p.duplexBottomLTR*12*rg;
    if(p.topUnit==="mtr"){
      rental+=p.duplexTopMTR*12*rg;
    } else if(p.topUnit==="ltr"){
      rental+=p.duplexTopLTR*12*rg;
    } else {
      const schedEntry=(p.strSchedule||[]).find(s=>{
        const f=s.yrFrom??s.yr; const t=s.yrTo??s.yr;
        return cal>=f && cal<=t;
      });
      const strAnnual=schedEntry ? strScheduleIncome(schedEntry.segments) : p.duplexTopSTR*12;
      rental+=strAnnual*rg;
    }
    if(lafRenting)              rental+=BASE.lafayetteRent*12*rg;
    if(p.sixthMTR&&keepPrimary){
      const mtrEntry=(p.mtrSchedule||[]).find(s=>{const f=s.yrFrom??s.yr;const t=s.yrTo??s.yr;return cal>=f&&cal<=t;});
      const mtrAnnual=mtrEntry ? mtrScheduleIncome(mtrEntry.segments) : p.sixthMTRRent*p.sixthMTRMonths;
      rental+=mtrAnnual*rg;
    }

    let cashAst = 0;
    for(let y=0; y<=yr; y++){
      const yCal = BASE.startYear + y;
      if(yCal === sellYr && p.sixthNetProceeds > 0){
        cashAst += (p.sixthNetProceeds - (p.saleDraw||0));
      }
      if(y>0) cashAst *= (1+p.investReturn);
      for(const d of (p.lifestyleDraws||[])){
        if(d && y===d.yr && d.amount>0) cashAst = Math.max(0, cashAst - d.amount);
      }
    }

    let drawInc = 0;
    if(cal === sellYr && p.saleDraw > 0) drawInc += p.saleDraw;
    for(const d of (p.lifestyleDraws||[])){
      if(d && yr===d.yr && d.amount>0){
        const preDraw = cashAst + d.amount;
        drawInc += Math.min(d.amount, preDraw);
      }
    }
    const totalIncome=pension+workInc+(yourSs+brendaSs)*12+rental+drawInc;

    const dplxVal =BASE.duplexValue*app;
    const lafVal  =BASE.lafayetteValue*app;
    const primVal =keepPrimary?BASE.primaryValue*app:0;
    const dplxBal =remainBal(BASE.duplexMortgage,BASE.duplexRate,30,5+yr);
    const lafBal  =remainBal(BASE.lafayetteMortgage,BASE.lafayetteRate,30,5+yr);
    const primBal =keepPrimary?remainBal(BASE.primaryMortgage,BASE.primaryRate,30,5+yr):0;
    const _mtgInt =(dplxBal*BASE.duplexRate+lafBal*BASE.lafayetteRate+(keepPrimary?primBal*BASE.primaryRate:0));
    const taxAnnual=estimateTax(p,pension,workInc,yourSs,brendaSs,rental,_mtgInt);

    const _rg0  = Math.pow(1+p.rentGrowth, yr);
    const _inf0 = Math.pow(1+p.inflation, yr);
    const _pinf0= Math.pow(1+p.propInflation, yr);
    let _rental0 = p.duplexBottomLTR*_rg0;
    if(p.topUnit==="mtr")      _rental0+=p.duplexTopMTR*_rg0;
    else if(p.topUnit==="ltr") _rental0+=p.duplexTopLTR*_rg0;
    else                       _rental0+=p.duplexTopSTR*_rg0;
    if(lafRenting)   _rental0+=BASE.lafayetteRent*_rg0;
    if(p.sixthMTR&&keepPrimary){
      const _mtrEntry=(p.mtrSchedule||[]).find(s=>{const f=s.yrFrom??s.yr;const t=s.yrTo??s.yr;return cal>=f&&cal<=t;});
      const _mtrAnnual=_mtrEntry ? mtrScheduleIncome(_mtrEntry.segments) : p.sixthMTRRent*p.sixthMTRMonths;
      _rental0+=_mtrAnnual/12*_rg0;
    }
    const _ss0    = ((p.ssStartYear&&(BASE.startYear+yr)>=p.ssStartYear)?p.ssAmount:0)+((BASE.startYear+yr)>=BASE.brendaFraYear?BASE.brendaSsFRA:0);
    const _work0  = workFromCurve(yr, p.workPts)*_inf0;
    const _incMo  = BASE.pensionMonthly + _ss0 + _rental0 + _work0;
    let _propC0   = (BASE.dplxTaxMo+BASE.dplxInsMo)*_pinf0;
    _propC0 += (keepPrimary?BASE.primTaxMo+BASE.primInsMo:BASE.lafTaxMo+BASE.lafInsMo)*_pinf0;
    if(lafRenting) _propC0+=(BASE.lafTaxMo+BASE.lafInsMo)*_pinf0;
    const _maint0 = (BASE.duplexValue+BASE.lafayetteValue+(keepPrimary?BASE.primaryValue:0))*p.maintRate*_pinf0/12;
    const _core0  = (BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*_inf0;
    const _hlth0  = healthMonthly(BASE.startYear+yr, 99, p);
    const _mtg0   = (BASE.duplxIO + BASE.lafPnI + (p.keepPrimary?BASE.primIO:0));
    // _baseDI: monthly income minus fixed costs (excl. debt minimums, fam loan, tax --
    // those are subtracted per-month inside the loop so xtra reflects actual available cash)
    const _fixedMo= _mtg0 + _hlth0 + _propC0 + _core0 + _maint0 + taxAnnual/12;
    const _baseDI = _incMo - _fixedMo;

    if(!p.payOffHI){
      for(let mo=0;mo<12;mo++){
        const absMo=yr*12+mo;
        if(absMo<5){ nolanBal=Math.max(0,nolanBal*(1+nolanRate/12)); }
        else{ nolanActive=true; }
        // Capture minimums before applying payments (so _avail is net of what's already owed)
        const _minCC0  = ccBal>0?ccMin:0;
        const _minSoph0= sophiaBal>0?sophiaMin:0;
        const _minNol0 = nolanActive&&nolanBal>0?nolanMin:0;
        const _minsMo  = _minCC0+_minSoph0+_minNol0;
        if(ccBal>0){    ccBal    =Math.max(0,ccBal   *(1+ccRate/12)   -_minCC0); }
        if(sophiaBal>0){sophiaBal=Math.max(0,sophiaBal*(1+sophiaRate/12)-_minSoph0);}
        if(nolanActive&&nolanBal>0){nolanBal=Math.max(0,nolanBal*(1+nolanRate/12)-_minNol0);}
        const _famMo = absMo<BASE.famLoanMonths ? famLoanMoPmt : 0;
        const loopDebt=ccBal+sophiaBal+nolanBal;
        // _avail = income left after all fixed costs, minimums, and fam loan -- this is what avalanche can use
        const _avail = _baseDI - _minsMo - _famMo;
        const _splitProtect = Math.max(p.diCap, _avail*(p.lifestyleSplit/100));
        let xtra=loopDebt>0?Math.max(0,_avail-_splitProtect):0;
        const q=[
          {g:()=>ccBal,    s:(v)=>{ccBal=v;},    r:ccRate},
          {g:()=>sophiaBal,s:(v)=>{sophiaBal=v;}, r:sophiaRate},
          ...(nolanActive?[{g:()=>nolanBal,s:(v)=>{nolanBal=v;},r:nolanRate}]:[]),
        ].filter(o=>o.g()>0).sort((a,b)=>b.r-a.r);
        for(const loan of q){if(xtra<=0)break;const pay=Math.min(xtra,loan.g());loan.s(loan.g()-pay);xtra-=pay;}
      }
    }
    const hiDebt=p.payOffHI?0:ccBal+sophiaBal+nolanBal;
    if(hiDebt<=0 && !debtCleared) debtCleared=true;

    const duplxPmt=(!p.payOffHI&&hiDebt>0)?BASE.duplxIO:BASE.duplxPnI;
    const primPmt =keepPrimary?((!p.payOffHI&&hiDebt>0)?BASE.primIO:BASE.primPnI):0;
    const mtgPmt  =(duplxPmt+BASE.lafPnI+primPmt)*12;

    const healthAnnual=yr===0
      ?(5*BASE.healthYouEricsson+7*BASE.healthYouMedicare+12*BASE.healthBrendaEricsson+12*BASE.healthKids)
      :healthMonthly(cal,99,p)*12;
    const irmaaSaleYr = (sold && !p.sixthMTR) ? sellYr+2 : 0;
    const irmaaAdd = (irmaaSaleYr>0 && cal===irmaaSaleYr) ? BASE.irmaaSurge*2*12 : 0;
    let propCost=(BASE.dplxTaxMo+BASE.dplxInsMo)*12*pinf;
    propCost+=(keepPrimary?BASE.primTaxMo+BASE.primInsMo:BASE.lafTaxMo+BASE.lafInsMo)*12*pinf;
    if(lafRenting) propCost+=(BASE.lafTaxMo+BASE.lafInsMo)*12*pinf;
    const core=(BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*coreinf*12;
    let maint=(BASE.duplexValue+BASE.lafayetteValue)*p.maintRate*pinf;
    if(keepPrimary) maint+=BASE.primaryValue*p.maintRate*pinf;
    const famLoanAnnual=yr===0?famLoanMoPmt*Math.min(12,BASE.famLoanMonths)
                       :yr===1?famLoanMoPmt*Math.max(0,BASE.famLoanMonths-12):0;
    const minDebt=p.payOffHI?0:(
      (ccBal>0?ccMin:0)+(sophiaBal>0?sophiaMin:0)+
      (nolanActive&&nolanBal>0?nolanMin:0)
    )*12;

    const baseOut=mtgPmt+healthAnnual+irmaaAdd+propCost+core+maint+famLoanAnnual+minDebt+taxAnnual;
    const baseDI =totalIncome-baseOut;
    const splitProtect = Math.max(p.diCap*12, baseDI*(p.lifestyleSplit/100));
    const accel  =(!p.payOffHI&&hiDebt>0)?Math.max(0,baseDI-splitProtect):0;
    const surplusAboveProtect = Math.max(0, baseDI - splitProtect);
    const annualSweepToSav = debtCleared ? surplusAboveProtect : 0;
    const totalOut=baseOut+accel;
    const surplus =totalIncome-totalOut;
    const passive =pension+(yourSs+brendaSs)*12+rental;
    const reqWork =Math.max(0,totalOut-passive);
    const nw      =Math.round((dplxVal+lafVal+primVal+cashAst-dplxBal-lafBal-primBal-hiDebt)/1000);

    // Family loan balance at START of this year (before this year's payments).
    // Shown at year-start so the chart reflects what was owed entering 2026.
    // With famLoanMonths=8 the loan completes within yr=0, so yr≥1 = 0.
    const _flMos = Math.min(yr*12, BASE.famLoanMonths);
    const famLoanBal = (p.famLoanAmt>0 && famLoanMoPmt>0 && _flMos<BASE.famLoanMonths)
      ? Math.max(0, Math.round(
          (p.famLoanAmt*Math.pow(1+flr,_flMos)
           - (flr>0 ? famLoanMoPmt*(Math.pow(1+flr,_flMos)-1)/flr : famLoanMoPmt*_flMos)
          ) / 1000))
      : 0;

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
      ioMode:   hiDebt>0 && !p.payOffHI && keepPrimary,
    });
  }
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
