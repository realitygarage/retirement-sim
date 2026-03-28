// v2.10.5 -- add famLoanBal to HI debt breakdown chart; fix avalanche xtra overstatement; fix pin import rate conversion
import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, ComposedChart, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { BASE, HI_TOTAL, buildScenario, keyStats, strScheduleIncome, mtrScheduleIncome, workFromCurve, remainBal, estimateTax } from "./engine.js";
import { SC_DEFAULTS, makeParams, PIN_COLORS, SAVE_SCHEMA_VERSION } from "./defaults.js";
import { REL_COLORS, RNODES, REDGES, NODE_W, NODE_H, COL_X, ROW_H, ROW_OFF, SVG_W, SVG_H, rNodePos } from "./relationships-data.js";

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

  // -- Scenario state (single object for live + per-pin editing) ------
  const [liveSc,  setLiveSc]  = useState(SC_DEFAULTS);
  const [pinScs,  setPinScs]  = useState({});      // {pinId: sc_object}
  const [activeSc,setActiveSc]= useState("live");  // "live" | pinId(number)

  // Helpers: get/set the active scenario
  const sc = activeSc==="live" ? liveSc : (pinScs[activeSc]||SC_DEFAULTS);
  const setSc = useCallback((updater)=>{
    if(activeSc==="live"){
      setLiveSc(s=>typeof updater==="function"?updater(s):{...s,...updater});
    } else {
      setPinScs(ps=>{
        const cur=ps[activeSc]||SC_DEFAULTS;
        const next=typeof updater==="function"?updater(cur):{...cur,...updater};
        return {...ps,[activeSc]:next};
      });
    }
  },[activeSc]);

  // Destructure active scenario for use in controls + engines
  const {
    sellYear, lafStopYear, saleDrawFrac, keepPrimary, sixthSalePrice, sixthCostOfSale, topUnit, lafRental, sixthMTR, payOffHI,
    ssAge, workPts, lifestyleSplit, strRent, bottomRent, ltrRent, sixthRent, sixthMonths,
    reApp, rentGr, cpi, healthCpi, propCpi, taxEnabled, investRet, lifestyleDraws, strSchedule, mtrSchedule,
    ccBal, ccRate, ccMin, sophiaBal, sophiaRate, sophiaMin, nolanBal, nolanRate, nolanMin,
    famLoanAmt, famLoanRate,
    rdTopUp, rdCap, obTopUp, obCap, discFloor, fcfSchedule, sweepDelay, struct6, struct15, structLaf, maintStr, bufferMode,
    strPlatformPct=3, strCleanPct=4, mgrPct=0,
    duplex15thBasis=600_000, lafayetteBasis=300_000,
  } = sc;

  // Individual setters -- all route through setSc
  const setSellYear       = v=>setSc(s=>({...s,sellYear:v,...(v>2046?{payOffHI:false}:{})}));
  const setLafStopYear    = v=>setSc(s=>({...s,lafStopYear:v}));
  const setSaleDrawFrac   = v=>setSc(s=>({...s,saleDrawFrac:v}));
  const setSweepDelay     = v=>setSc(s=>({...s,sweepDelay:v}));
  const setKeepPrimary    = v=>setSc(s=>({...s,keepPrimary:v}));
  const setSixthSalePrice = v=>setSc(s=>({...s,sixthSalePrice:v}));
  const setSixthCostOfSale= v=>setSc(s=>({...s,sixthCostOfSale:v}));
  const setTopUnit        = v=>setSc(s=>({...s,topUnit:v}));
  const setLafRental      = v=>setSc(s=>({...s,lafRental:v}));
  const setSixthMTR       = v=>setSc(s=>({...s,sixthMTR:v}));
  const setPayOffHI       = v=>setSc(s=>({...s,payOffHI:v}));
  const setSsAge          = v=>setSc(s=>({...s,ssAge:v}));
  const setWorkPts        = v=>setSc(s=>({...s,workPts:typeof v==="function"?v(s.workPts):v}));
  const setLifestyleSplit = v=>setSc(s=>({...s,lifestyleSplit:v}));
  const setStrRent        = v=>setSc(s=>({...s,strRent:v}));
  const setBottomRent     = v=>setSc(s=>({...s,bottomRent:v}));
  const setLtrRent        = v=>setSc(s=>({...s,ltrRent:v}));
  const setSixthRent      = v=>setSc(s=>({...s,sixthRent:v}));
  const setSixthMonths    = v=>setSc(s=>({...s,sixthMonths:v}));
  const setReApp          = v=>setSc(s=>({...s,reApp:v}));
  const setRentGr         = v=>setSc(s=>({...s,rentGr:v}));
  const setCpi            = v=>setSc(s=>({...s,cpi:v}));
  const setHealthCpi      = v=>setSc(s=>({...s,healthCpi:v}));
  const setPropCpi        = v=>setSc(s=>({...s,propCpi:v}));
  const setTaxEnabled     = v=>setSc(s=>({...s,taxEnabled:typeof v==="function"?v(s.taxEnabled):v}));
  const setInvestRet      = v=>setSc(s=>({...s,investRet:v}));
  const setLifestyleDraws = v=>setSc(s=>({...s,lifestyleDraws:typeof v==="function"?v(s.lifestyleDraws):v}));
  const setStrSchedule    = v=>setSc(s=>({...s,strSchedule:typeof v==="function"?v(s.strSchedule):v}));
  const setMtrSchedule    = v=>setSc(s=>({...s,mtrSchedule:typeof v==="function"?v(s.mtrSchedule):v}));
  const setCcBal          = v=>setSc(s=>({...s,ccBal:v}));
  const setCcRate         = v=>setSc(s=>({...s,ccRate:v}));
  const setCcMin          = v=>setSc(s=>({...s,ccMin:v}));
  const setSophiaBal      = v=>setSc(s=>({...s,sophiaBal:v}));
  const setSophiaRate     = v=>setSc(s=>({...s,sophiaRate:v}));
  const setSophiaMin      = v=>setSc(s=>({...s,sophiaMin:v}));
  const setNolanBal       = v=>setSc(s=>({...s,nolanBal:v}));
  const setNolanRate      = v=>setSc(s=>({...s,nolanRate:v}));
  const setNolanMin       = v=>setSc(s=>({...s,nolanMin:v}));
  const setFamLoanAmt     = v=>setSc(s=>({...s,famLoanAmt:v}));
  const setFamLoanRate    = v=>setSc(s=>({...s,famLoanRate:v}));
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
  const setBufferMode        = v=>setSc(s=>({...s,bufferMode:v}));
  const setDuplex15thBasis   = v=>setSc(s=>({...s,duplex15thBasis:v}));
  const setLafayetteBasis    = v=>setSc(s=>({...s,lafayetteBasis:v}));

  // -- Pins --------------------------------------------------
  // Convert a saved paramSnapshot (SC format, rates as %) to engine params (rates as decimals)
  function buildRowsFromSnapshot(snap){
    const sc={...SC_DEFAULTS,...snap};
    const diCap_=(sc.discFloor||800)+(sc.rdTopUp||400)+(sc.obTopUp||500);
    const totalMaint=(sc.struct6||600)*1000*(sc.maintStr||0.75)/100
                    +(sc.struct15||500)*1000*(sc.maintStr||0.75)/100
                    +(sc.structLaf||250)*1000*(sc.maintStr||0.75)/100;
    const keepP=(sc.sellYear||2055)>BASE.startYear;
    const totalVal=(keepP?BASE.primaryValue:0)+BASE.duplexValue+(sc.lafRental!==false?BASE.lafayetteValue:0);
    const maintRate_=totalVal>0?totalMaint/totalVal:0.005;
    return buildScenario(makeParams({
      ...sc,
      ssStartYear:2026+(sc.ssAge-65),
      ssAmount:sc.ssAge>=67?BASE.yourSsFRA:BASE.yourSsEarly+(sc.ssAge-65)*((BASE.yourSsFRA-BASE.yourSsEarly)/2),
      diCap:diCap_, maintRate:maintRate_,
      duplexBottomLTR:sc.bottomRent, duplexTopSTR:sc.strRent, duplexTopLTR:sc.ltrRent, duplexTopMTR:sc.ltrRent,
      sixthMTRRent:sc.sixthRent, sixthMTRMonths:sc.sixthMonths,
      reAppreciation:sc.reApp/100, rentGrowth:sc.rentGr/100, inflation:sc.cpi/100,
      coreCpi:sc.cpi/100, healthCpi:sc.healthCpi/100, propCpi:sc.propCpi/100, propInflation:sc.cpi/100+0.007,
      investReturn:sc.investRet/100,
      lifestyleDraws:(sc.lifestyleDraws||[]).filter(d=>d.enabled),
      ccRate:sc.ccRate/100, sophiaRate:sc.sophiaRate/100, nolanRate:sc.nolanRate/100,
      famLoanRate:sc.famLoanRate/100, sixthCostOfSale:sc.sixthCostOfSale/100,
      strPlatformPct:(sc.strPlatformPct||3)/100, strCleanPct:(sc.strCleanPct||4)/100, mgrPct:(sc.mgrPct||0)/100,
    }));
  }

  const [pins,    setPins]    = useState(()=>{
    try{
      const saved=localStorage.getItem('retirement_sim_pins');
      if(!saved) return [];
      const {version,pins:savedPins}=JSON.parse(saved);
      if(version!==SAVE_SCHEMA_VERSION) return [];
      return savedPins.map(p=>{const rows=buildRowsFromSnapshot(p.paramSnapshot||{});return{...p,rows,stats:keyStats(rows)};});
    }catch(e){ return []; }
  });
  const [pinName, setPinName] = useState("");
  const [evtPin,  setEvtPin]  = useState("live");
  const [eventsCollapsed, setEventsCollapsed] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [cumView,     setCumView]     = useState("income");
  const entryScRef = React.useRef(null); // sc snapshot at moment of entering a pin
  const [cumCollapsed,setCumCollapsed]= useState(false);
  const [fcOpen, setFcOpen] = useState(false);  // fixed costs breakdown panel
  const [showLive, setShowLive] = useState(true);       // show live scenario on charts
  const [expandedChart, setExpandedChart] = useState(null); // which chart is drilled into
  const [nwMode,        setNwMode]        = useState('book'); // 'book' | 'liq'
  // CF waterfall state now in sc object (see setSc setters above)
  const [wfMonths,  setWfMonths]  = useState(72);     // months to show in table
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

  // Maintenance: derived from Cash Flow structure values + rate -- source of truth
  // Derived keepPrimary for UI: holding 6th in the current year (2026)
  const uiKeepPrimary = sellYear > BASE.startYear;
  const maintAnnual6   = uiKeepPrimary ? struct6*1000*maintStr/100 : 0;
  const maintAnnual15  = struct15*1000*maintStr/100;
  const maintAnnualLaf = structLaf*1000*maintStr/100;  // always -- owned regardless of rental status
  const totalMaintAnnual = maintAnnual6+maintAnnual15+maintAnnualLaf;
  const totalMarketVal = (uiKeepPrimary?BASE.primaryValue:0)+BASE.duplexValue+(lafRental?BASE.lafayetteValue:0);
  const maintRate = totalMarketVal>0 ? totalMaintAnnual/totalMarketVal : 0.005;

  const liveParams = useMemo(()=>makeParams({
    ...sc,
    ssStartYear: 2026+(sc.ssAge-65),
    ssAmount:    sc.ssAge>=67?BASE.yourSsFRA:BASE.yourSsEarly+(sc.ssAge-65)*((BASE.yourSsFRA-BASE.yourSsEarly)/2),
    diCap, maintRate,
    duplexBottomLTR:sc.bottomRent,
    duplexTopSTR:sc.strRent, duplexTopLTR:sc.ltrRent, duplexTopMTR:sc.ltrRent,
    sixthMTRRent:sc.sixthRent, sixthMTRMonths:sc.sixthMonths,
    reAppreciation:sc.reApp/100, rentGrowth:sc.rentGr/100, inflation:sc.cpi/100,
    coreCpi:sc.cpi/100, healthCpi:sc.healthCpi/100, propCpi:sc.propCpi/100,
    propInflation:(sc.cpi/100)+0.007,
    investReturn:sc.investRet/100,
    lifestyleDraws:sc.lifestyleDraws.filter(d=>d.enabled),
    ccRate:sc.ccRate/100, sophiaRate:sc.sophiaRate/100, nolanRate:sc.nolanRate/100,
    famLoanRate:sc.famLoanRate/100, sixthCostOfSale:sc.sixthCostOfSale/100,
    strPlatformPct:(sc.strPlatformPct||3)/100, strCleanPct:(sc.strCleanPct||4)/100, mgrPct:(sc.mgrPct||0)/100,
  }),[sc, diCap, maintRate]);

  const liveRows  = useMemo(()=>buildScenario(liveParams),[liveParams]);
  // For pins being actively edited, recompute rows from pinScs
  const effectivePins = useMemo(()=>pins.map(pin=>{
    const editedSc = pinScs[pin.id];
    if(!editedSc) return pin;
    const p = makeParams({
      ...editedSc,
      ssStartYear:2026+(editedSc.ssAge-65),
      ssAmount:editedSc.ssAge>=67?BASE.yourSsFRA:BASE.yourSsEarly+(editedSc.ssAge-65)*((BASE.yourSsFRA-BASE.yourSsEarly)/2),
      diCap:editedSc.discFloor+editedSc.rdTopUp+editedSc.obTopUp,
      duplexBottomLTR:editedSc.bottomRent, duplexTopSTR:editedSc.strRent, duplexTopLTR:editedSc.ltrRent, duplexTopMTR:editedSc.ltrRent,
      sixthMTRRent:editedSc.sixthRent, sixthMTRMonths:editedSc.sixthMonths,
      reAppreciation:editedSc.reApp/100, rentGrowth:editedSc.rentGr/100, inflation:editedSc.cpi/100,
      coreCpi:editedSc.cpi/100, healthCpi:editedSc.healthCpi/100, propCpi:editedSc.propCpi/100,
      propInflation:(editedSc.cpi/100)+0.007, investReturn:editedSc.investRet/100,
      lifestyleDraws:editedSc.lifestyleDraws.filter(d=>d.enabled),
        strSchedule:editedSc.strSchedule||[],
        mtrSchedule:editedSc.mtrSchedule||[],
      ccRate:editedSc.ccRate/100, sophiaRate:editedSc.sophiaRate/100, nolanRate:editedSc.nolanRate/100,
      famLoanRate:editedSc.famLoanRate/100, sixthCostOfSale:editedSc.sixthCostOfSale/100,
      maintRate:(editedSc.struct6*1000*editedSc.maintStr/100+editedSc.struct15*1000*editedSc.maintStr/100+editedSc.structLaf*1000*editedSc.maintStr/100)/
               (BASE.primaryValue+BASE.duplexValue+BASE.lafayetteValue)||0.005,
    });
    const rows = buildScenario(p);
    return {...pin, rows, stats:keyStats(rows)};
  }),[pins, pinScs]);
  const liveStats = useMemo(()=>keyStats(liveRows),[liveRows]);

  // -- Cash flow waterfall engine ----------------------------
  const wfData = useMemo(()=>{
    // Per-property maintenance (monthly, from structure value)
    const keepingFn    = (cy) => cy < (sellYear||2055);
    const lafRentingFn = (cy) => lafRental && cy < (lafStopYear||2055);
    const maint6Mo   = keepingFn(BASE.startYear) ? (struct6*1000*maintStr/100/12) : 0;
    const maint15Mo  = struct15*1000*maintStr/100/12;
    const maintLafMo = structLaf*1000*maintStr/100/12;  // always -- owned regardless of rental status
    const maintCapTotal = (maint6Mo+maint15Mo+maintLafMo) * 12 * 5; // 5yr cap total
    const maint6Cap  = maint6Mo*12*5;
    const maint15Cap = maint15Mo*12*5;
    const maintLafCap= maintLafMo*12*5;

    // Family loan payment
    const flr = famLoanRate/100/12;
    const famPmt = famLoanAmt>0
      ? famLoanAmt*(flr*Math.pow(1+flr,BASE.famLoanMonths))/(Math.pow(1+flr,BASE.famLoanMonths)-1)
      : 0;

    // Running balances
    let ccBal    = payOffHI ? 0 : (liveParams.ccBal||60000);
    let sophiaBal= payOffHI ? 0 : (liveParams.sophiaBal||58057);
    let nolanBal = payOffHI ? 0 : (liveParams.nolanBal||141117);
    const ccRate_    = liveParams.ccRate    || 0.14;
    const ccMin_     = liveParams.ccMin     || 1200;
    const sophiaRate_= liveParams.sophiaRate|| 0.0814;
    const sophiaMin_ = liveParams.sophiaMin || 737;
    const nolanRate_ = liveParams.nolanRate || 0.084;
    const nolanMin_  = liveParams.nolanMin  || 1787;
    let nolanOn = false;
    let rdBal   = 0;   // rainy day balance
    let obBal   = 0;   // operating buffer balance
    let res6    = 0;   // maintenance reserve 6th
    let res15   = 0;   // maintenance reserve 15th
    let resLaf  = 0;   // maintenance reserve lafayette
    let debtClearedMo = payOffHI ? 0 : -1;  // pre-cleared if paid off at closing
    let savingsAcc = 0;      // accumulated post-debt sweep redirected to investments

    const rows = [];
    const startDate = new Date(2026, 5); // Jun 2026

    for(let mo=0; mo<252; mo++){  // 252 = 21 full years to match buildScenario (2026-2046)
      const d = new Date(startDate.getFullYear(), startDate.getMonth()+mo);
      const calYear = d.getFullYear();
      const inf    = Math.pow(1+liveParams.inflation,   mo/12);
      const coreinf= Math.pow(1+(liveParams.coreCpi||liveParams.inflation), mo/12);
      const rg     = Math.pow(1+liveParams.rentGrowth,  mo/12);
      const pinf   = Math.pow(1+(liveParams.propCpi||liveParams.propInflation), mo/12);

      // -- INCOME --
      const pension  = BASE.pensionMonthly;
      const yourSsMo = (liveParams.ssStartYear && calYear>=liveParams.ssStartYear)
        ? liveParams.ssAmount : 0;
      const brendaSsMo = calYear>=BASE.brendaFraYear ? BASE.brendaSsFRA : 0;
      const _bot = liveParams.duplexBottomLTR;
      const _schedEntry = topUnit==="str" ? (strSchedule||[]).find(s=>{
        const f=s.yrFrom??s.yr; const t=s.yrTo??s.yr;
        return calYear>=f && calYear<=t;
      }) : null;
      const _top = topUnit==="str"
        ? (_schedEntry ? strScheduleIncome(_schedEntry.segments)/12 : liveParams.duplexTopSTR)
        : topUnit==="ltr" ? liveParams.duplexTopLTR : liveParams.duplexTopMTR;
      const rentalMo = _bot*rg
        + _top*rg
        + (lafRentingFn(calYear)?BASE.lafayetteRent*rg:0)
        + (sixthMTR&&keepingFn(calYear) ? (()=>{
            const _me=(mtrSchedule||[]).find(s=>{const f=s.yrFrom??s.yr;const t=s.yrTo??s.yr;return calYear>=f&&calYear<=t;});
            return _me ? mtrScheduleIncome(_me.segments)/12*rg : sixthRent*(sixthMonths/12)*rg;
          })() : 0);
      const wkInc     = workFromCurve(mo/12, workPts)*inf;
      // -- RENTAL OPERATING COSTS (deducted from gross rental income) --
      // 15th top unit costs
      const _topGross = _top*rg;
      const _strOpCost = topUnit==="str"
        ? _topGross*((liveParams.strPlatformPct||0.03)+(liveParams.strCleanPct||0.04))
        : _topGross*(liveParams.mgrPct||0);
      // Lafayette LTR mgmt cost
      const _lafGross = lafRentingFn(calYear)?BASE.lafayetteRent*rg:0;
      const _lafOpCost = _lafGross*(liveParams.mgrPct||0);
      // 6th St MTR mgmt cost
      const _sixthGross = sixthMTR&&keepingFn(calYear) ? (()=>{
          const _me=(mtrSchedule||[]).find(s=>{const f=s.yrFrom??s.yr;const t=s.yrTo??s.yr;return calYear>=f&&calYear<=t;});
          return _me ? mtrScheduleIncome(_me.segments)/12*rg : sixthRent*(sixthMonths/12)*rg;
        })() : 0;
      const _sixthOpCost = _sixthGross*(liveParams.mgrPct||0);
      const rentalOpCost = Math.round(_strOpCost+_lafOpCost+_sixthOpCost);
      const totalInc  = pension+yourSsMo+brendaSsMo+rentalMo+wkInc-rentalOpCost;

      // -- TIER 1: FIXED COSTS --
      const _hcpi  = liveParams.healthCpi || BASE.healthMedicareInflation;
      const hiMo   = mo < 5 ? BASE.healthYouEricsson : Math.round(BASE.healthYouMedicare*Math.pow(1+_hcpi,Math.max(0,calYear-2026)));
      const brendaHlth = calYear>=BASE.brendaMedYear
        ? Math.round(BASE.healthBrendaMedicare*Math.pow(1+_hcpi,calYear-BASE.brendaMedYear))
        : Math.round(BASE.healthBrendaEricsson*Math.pow(1+BASE.ericssonInflation,calYear-2026));
      const kidsHlth  = (calYear<BASE.sophiaOff||calYear<BASE.nolanOff)?BASE.healthKids:0;
      const health    = hiMo+brendaHlth+kidsHlth;
      const hiDebtNow = ccBal+sophiaBal+nolanBal;
      const duplxPmt  = (!payOffHI&&hiDebtNow>0)?BASE.duplxIO:BASE.duplxPnI;
      const primPmt   = keepingFn(calYear)?((!payOffHI&&hiDebtNow>0)?BASE.primIO:BASE.primPnI):0;
      const mtg       = duplxPmt+BASE.lafPnI+primPmt;
      const core      = (BASE.carLease+BASE.otherIns+BASE.food+BASE.utilities+BASE.personal)*coreinf;
      const famLoan   = mo < BASE.famLoanMonths ? famPmt : 0;
      // HI minimums
      if(mo>=5) nolanOn=true;
      const minCC  = ccBal>0?ccMin_:0;
      const minSoph= sophiaBal>0?sophiaMin_:0;
      const minNol = nolanOn&&nolanBal>0?nolanMin_:0;
      const hiMins = payOffHI?0:minCC+minSoph+minNol;
      // Property tax + insurance
      const propCost = Math.round(
        (BASE.dplxTaxMo+BASE.dplxInsMo)*pinf
        + (keepingFn(calYear)?(BASE.primTaxMo+BASE.primInsMo):(BASE.lafTaxMo+BASE.lafInsMo))*pinf
        + (lafRentingFn(calYear)?(BASE.lafTaxMo+BASE.lafInsMo)*pinf:0)
      );
      // Income tax estimate -- annualize this month's income and apply the same estimateTax()
      // used by the annual engine. Mortgage interest deduction uses current balances.
      const _yrsPaid = 5 + mo/12;
      const _dplxBal = remainBal(BASE.duplexMortgage, BASE.duplexRate, 30, _yrsPaid);
      const _lafBal  = remainBal(BASE.lafayetteMortgage, BASE.lafayetteRate, 30, _yrsPaid);
      const _primBal = keepingFn(calYear) ? remainBal(BASE.primaryMortgage, BASE.primaryRate, 30, _yrsPaid) : 0;
      const _mtgInt  = _dplxBal*BASE.duplexRate + _lafBal*BASE.lafayetteRate + _primBal*BASE.primaryRate;
      const taxMo = Math.round(estimateTax(liveParams, BASE.pensionMonthly*12, wkInc*12, yourSsMo, brendaSsMo, rentalMo*12, _mtgInt) / 12);
      const tier1  = mtg+health+core+famLoan+hiMins+propCost+taxMo;

      // -- MAINTENANCE RESERVES (cap-aware) --
      const res6Add   = (res6  <maint6Cap  )?Math.min(maint6Mo,  maint6Cap  -res6  ):0;
      const res15Add  = (res15 <maint15Cap )?Math.min(maint15Mo, maint15Cap -res15 ):0;
      const resLafAdd = (resLaf<maintLafCap)?Math.min(maintLafMo,maintLafCap-resLaf):0;
      const maintTotal= res6Add+res15Add+resLafAdd;
      const maintRedirect = (maint6Mo+maint15Mo+maintLafMo)-maintTotal; // freed to sweep

      // -- FCF FLOOR: check schedule first, fall back to global discFloor --
      const _fcfSched = (fcfSchedule||[]).find(s=>calYear>=s.yrFrom&&calYear<=s.yrTo);
      const effectiveFloor = _fcfSched ? _fcfSched.floor : discFloor;

      // -- TIER 2 & 3: SAVINGS BUCKETS --
      const available = totalInc-tier1-maintTotal;
      // Rainy day
      let rdAdd = 0;
      if(rdBal<rdCap){
        rdAdd = Math.min(rdTopUp, rdCap-rdBal, Math.max(0,available-effectiveFloor));
      }
      // Op buffer -- sequential: only after RD full; parallel: simultaneous
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
      // surplusAboveFloor = the portion above the protected FCF floor
      const surplusAboveFloor = Math.max(0, afterBuckets - cfSplitProtect);
      // While in debt: surplus sweeps debt. When clear: same amount goes to savings.
      const hasDebt = hiDebtNow > 0;
      const sweep = hasDebt ? surplusAboveFloor + maintRedirect : 0;

      // Apply interest & payments to debt balances
      const intCC    = ccBal>0     ? ccBal*ccRate_/12       : 0;
      const intSoph  = sophiaBal>0 ? sophiaBal*sophiaRate_/12 : 0;
      const intNolan = nolanOn&&nolanBal>0 ? nolanBal*nolanRate_/12 : 0;
      const interestPaid = intCC + intSoph + intNolan;
      const minPmt = (ccBal>0?minCC:0) + (sophiaBal>0?minSoph:0) + (nolanOn&&nolanBal>0?minNol:0);
      if(ccBal>0)    {ccBal    =Math.max(0,ccBal    *(1+ccRate_/12)    -minCC);}
      if(sophiaBal>0){sophiaBal=Math.max(0,sophiaBal*(1+sophiaRate_/12)-minSoph);}
      if(nolanOn&&nolanBal>0){nolanBal=Math.max(0,nolanBal*(1+nolanRate_/12)-minNol);}
      // Avalanche sweep (only runs while in debt)
      let xtra=sweep;
      const q=[
        {g:()=>ccBal,    s:(v)=>{ccBal=v;},     r:ccRate_},
        {g:()=>sophiaBal,s:(v)=>{sophiaBal=v;},  r:sophiaRate_},
        ...(nolanOn?[{g:()=>nolanBal,s:(v)=>{nolanBal=v;},r:nolanRate_}]:[]),
      ].filter(o=>o.g()>0).sort((a,b)=>b.r-a.r);
      for(const loan of q){if(xtra<=0)break;const pay=Math.min(xtra,loan.g());loan.s(loan.g()-pay);xtra-=pay;}

      // Post-debt: redirect surplus-above-floor to savings (after grace period)
      // debtClearedMo>0 means cleared mid-run; ==0 means pre-cleared (payOffHI)
      if(debtClearedMo<0 && hiDebtNow<=0) debtClearedMo = mo;
      const debtWasCleared = debtClearedMo >= 0;  // includes pre-cleared (payOffHI)
      const graceDone = debtWasCleared && !hasDebt && (mo - debtClearedMo) >= (sweepDelay||0);
      // When debt is clear, the sweep amount (surplusAboveFloor) redirects to savings
      const sweepToSavings = graceDone ? surplusAboveFloor + maintRedirect : 0;
      // Compound savingsAcc monthly at investReturn, then add new sweep contribution
      if(savingsAcc>0) savingsAcc *= (1+(liveParams.investReturn||0.055)/12);
      if(graceDone && sweepToSavings>0) savingsAcc += sweepToSavings;

      // Update balances
      rdBal  = Math.min(rdCap,  rdBal+rdAdd);
      obBal  = Math.min(obCap,  obBal+obAdd);
      res6   = Math.min(maint6Cap,   res6+res6Add);
      res15  = Math.min(maint15Cap,  res15+res15Add);
      resLaf = Math.min(maintLafCap, resLaf+resLafAdd);

      const hiDebtEnd = hiDebtNow;
      // disc = what you actually keep as Free Cash (floor + any kept margin above floor)
      // sweepToSavings gets the rest; they should always sum to afterBuckets
      const disc = graceDone
        ? cfSplitProtect   // floor + kept% of surplus; rest going to savings
        : Math.max(effectiveFloor, afterBuckets - sweep);  // while in debt or grace period

      // Detect key events
      const events=[];
      if(mo===0) events.push("Launch -- family loan starts");
      if(mo===4) events.push("You -> Medicare");
      if(mo===5) events.push("Nolan loan payments begin");
      if(mo===BASE.famLoanMonths-1) events.push("Family loan paid off!");
      if(rdBal>=rdCap&&rdBal-rdAdd<rdCap) events.push("Rainy day fund FULL -- redirecting to sweep");
      if(obBal>=obCap&&obBal-obAdd<obCap) events.push("Operating buffer FULL -- redirecting to sweep");
      if(debtClearedMo===mo && mo>0) events.push("ALL HI DEBT CLEARED! 🎉");
      if(calYear===BASE.sophiaOff&&d.getMonth()===9) events.push("Sophia off health plan");
      if(calYear===BASE.nolanOff&&d.getMonth()===5)  events.push("Nolan off health plan");
      if(calYear>=BASE.brendaMedYear&&d.getMonth()===0&&calYear===BASE.brendaMedYear) events.push("Brenda -> Medicare");

      rows.push({
        mo, cal:`${d.toLocaleString('default',{month:'short'})} '${String(calYear).slice(2)}`,
        totalInc:Math.round(totalInc), tier1:Math.round(tier1), rentalOpCost:Math.round(rentalOpCost),
        // Fixed cost breakdown sub-components (for breakdown panel)
        fc_mtg:Math.round(mtg), fc_health:Math.round(health), fc_core:Math.round(core),
        fc_famLoan:Math.round(famLoan), fc_hiMins:Math.round(hiMins), fc_rentalOp:Math.round(rentalOpCost),
        fc_propCost:Math.round(propCost), fc_tax:taxMo,
        maintRes:Math.round(maintTotal), rdAdd:Math.round(rdAdd), obAdd:Math.round(obAdd),
        sweep:Math.round(sweep), disc:Math.round(disc), floor:effectiveFloor, afterBuckets:Math.round(afterBuckets),
        rdBal:Math.round(rdBal), obBal:Math.round(obBal),
        hiDebt:Math.round(hiDebtEnd/1000),
        interestPaid:Math.round(interestPaid), minPmt:Math.round(minPmt),
        res6:Math.round(res6), res15:Math.round(res15), resLaf:Math.round(resLaf),
        sweepToSavings:Math.round(sweepToSavings), savingsAcc:Math.round(savingsAcc),
        events,
        // Income breakdown
        pension:Math.round(pension),
        yourSs:Math.round(yourSsMo),
        brendaSs:Math.round(brendaSsMo),
        rental:Math.round(rentalMo),
        workIncome:Math.round(wkInc),
      });
    }
    return rows;
  },[liveParams,sellYear,lafStopYear,lafRental,sixthMTR,topUnit,bottomRent,strRent,ltrRent,sixthRent,sixthMonths,
     workPts,ssAge,rdTopUp,rdCap,obTopUp,obCap,discFloor,fcfSchedule,sweepDelay,lifestyleSplit,
     struct6,struct15,structLaf,maintStr,bufferMode,famLoanAmt,famLoanRate,payOffHI,
     strPlatformPct,strCleanPct,mgrPct]);  // wfMonths only affects table slice, not engine run

  // -- Chart data ------------------------------------------
  // -- Chart data ------------------------------------------
  const chartData = useMemo(()=>{
    // Aggregate monthly wfData into annual averages for the FCF chart.
    // Use disc (monthly engine's actual kept FCF) instead of annual engine surplus —
    // this ensures lifestyleSplit slider and graceDone sweep logic are reflected correctly.
    const discByYear={}, sweepByYear={}, cntByYear={}, savAccByYear={}, abByYear={}, floorByYear={};
    const fc_mtgByYr={}, fc_hlthByYr={}, fc_coreByYr={}, fc_famByYr={}, fc_hiMinsByYr={}, fc_ropByYr={}, fc_propByYr={}, fc_taxByYr={};
    (wfData||[]).forEach(r=>{
      const yr=2026+Math.floor(r.mo/12);
      discByYear[yr]=(discByYear[yr]||0)+(r.disc||0);
      sweepByYear[yr]=(sweepByYear[yr]||0)+(r.sweepToSavings||0);
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
    const _liqReApp     = liveParams.reAppreciation;
    const _liqSellYr    = liveParams.sellYear;
    const _liq15thBasis = liveSc.duplex15thBasis ?? 600_000;
    const _liqLafBasis  = liveSc.lafayetteBasis  ?? 300_000;

    return liveRows.map((r,i)=>{
      const cnt=cntByYear[r.cal]||12;
      const disc=discByYear[r.cal]!=null ? Math.round(discByYear[r.cal]/cnt) : Math.max(0,r.surplus);
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
      const pt={year:r.cal, cal:r.cal, reqWork:r.reqWork, surplus:disc, surplusPool, floorLine, hiDebt:r.hiDebt,
        fixedTotal, fc_mtg:fc_mtg_, fc_hlth:fc_hlth_, fc_core:fc_core_, fc_fam:fc_fam_, fc_hiMins:fc_hiMins_, fc_rop:fc_rop_, fc_prop:fc_prop_, fc_tax:fc_tax_,
        nw:(r.nw/1000)+savAccM,  // $M — annual engine NW + monthly wfData savingsAcc
        sweepSavK:savAccK,
        sweepToSavings:sweep,
        // NW breakdown fields (from annual engine, $K units — same as liveRows)
        reValue:r.reValue, reMortgage:r.reMortgage, reEquity:r.reEquity,
        hiDebtK:r.hiDebtK, invested:r.invested, savingsAccK:savAccK};

      // Liquidation NW: what you'd net selling everything today at year i
      {
        const app=Math.pow(1+_liqReApp,i);
        const keepPrim=r.cal<_liqSellYr;
        let primNet=0;
        if(keepPrim){
          const pv=BASE.primaryValue*app;
          const pb=remainBal(BASE.primaryMortgage,BASE.primaryRate,30,5+i);
          const sn=pv*(1-_SCOST);
          const taxable=Math.max(0,Math.max(0,sn-BASE.sixthBasis)-BASE.marriedExcl);
          primNet=sn-pb-taxable*_CGRATE;
        }
        const dv=BASE.duplexValue*app;
        const db=remainBal(BASE.duplexMortgage,BASE.duplexRate,30,5+i);
        const dsn=dv*(1-_SCOST);
        const dplxNet=dsn-db-Math.max(0,dsn-_liq15thBasis)*_CGRATE;
        const lv=BASE.lafayetteValue*app;
        const lb=remainBal(BASE.lafayetteMortgage,BASE.lafayetteRate,30,5+i);
        const lsn=lv*(1-_SCOST);
        const lafNet=lsn-lb-Math.max(0,lsn-_liqLafBasis)*_CGRATE;
        pt.liqNW=(primNet+dplxNet+lafNet+r.invested*1000+savAccRaw-r.hiDebtRaw)/1e6;
      }

      pins.forEach(pin=>{
        pt[`pin_${pin.id}_fc`]=Math.abs(pin.rows[i]?.mtg||0)+Math.abs(pin.rows[i]?.health||0)+Math.abs(pin.rows[i]?.core||0)+Math.abs(pin.rows[i]?.famLoan||0)+Math.abs(pin.rows[i]?.minDebt||0);
        pt[`pin_${pin.id}_rw`]=pin.rows[i]?.reqWork;
        pt[`pin_${pin.id}_di`]=Math.max(0,pin.rows[i]?.surplus);
        pt[`pin_${pin.id}_sweep`]=Math.max(0,pin.rows[i]?.sweepToSavings||0);
        pt[`pin_${pin.id}_debt`]=pin.rows[i]?.hiDebt;
        // NW for pin: annual engine nw + accumulated sweep savings (compounded annually)
        let pinSavAcc=0;
        for(let j=0;j<=i;j++){
          if(pinSavAcc>0) pinSavAcc*=(1+(pin.paramSnapshot?.investRet||5.5)/100);
          pinSavAcc+=Math.max(0,(pin.rows[j]?.sweepToSavings||0)*12);
        }
        pt[`pin_${pin.id}_nw`]=((pin.rows[i]?.nw??0)/1000)+(pinSavAcc/1000000); // $M
        pt[`pin_${pin.id}_sweepSavK`]=Math.round(pinSavAcc/1000);
        // Liquidation NW for pin
        {
          const pSnap=pin.paramSnapshot||{};
          const pApp=Math.pow(1+(pSnap.reApp??4)/100,i);
          const pSellYr=pSnap.sellYear??2055;
          const p15th=pSnap.duplex15thBasis??_liq15thBasis;
          const pLaf=pSnap.lafayetteBasis??_liqLafBasis;
          const keepPrim=r.cal<pSellYr;
          let pPrimNet=0;
          if(keepPrim){
            const pv=BASE.primaryValue*pApp;
            const pb=remainBal(BASE.primaryMortgage,BASE.primaryRate,30,5+i);
            const sn=pv*(1-_SCOST);
            const taxable=Math.max(0,Math.max(0,sn-BASE.sixthBasis)-BASE.marriedExcl);
            pPrimNet=sn-pb-taxable*_CGRATE;
          }
          const dv=BASE.duplexValue*pApp;
          const db=remainBal(BASE.duplexMortgage,BASE.duplexRate,30,5+i);
          const dsn=dv*(1-_SCOST);
          const pDplxNet=dsn-db-Math.max(0,dsn-p15th)*_CGRATE;
          const lv=BASE.lafayetteValue*pApp;
          const lb=remainBal(BASE.lafayetteMortgage,BASE.lafayetteRate,30,5+i);
          const lsn=lv*(1-_SCOST);
          const pLafNet=lsn-lb-Math.max(0,lsn-pLaf)*_CGRATE;
          const pInvested=(pin.rows[i]?.invested??0)*1000;
          const pHiDebtRaw=(pin.rows[i]?.hiDebtRaw??0);
          pt[`pin_${pin.id}_liqNW`]=(pPrimNet+pDplxNet+pLafNet+pInvested+pinSavAcc-pHiDebtRaw)/1e6;
        }
      });
      return pt;
    });
  },[liveRows,pins,wfData,liveSc.duplex15thBasis,liveSc.lafayetteBasis]);

  // NW yr10 from chartData (includes savingsAcc from sweep) — used in stat card
  const liveNwYr10 = useMemo(()=>(chartData[10]?.nw ?? liveStats.nwYr10/1000),
    [chartData, liveStats]);

  // Stable Y domains — rounded up to a clean ceiling so charts don't rescale while dragging
  const surplusMax = useMemo(()=>{
    const schedMax = (fcfSchedule||[]).reduce((m,s)=>Math.max(m,s.floor),0);
    const sweepMax = Math.max(...(chartData||[]).map(r=>r.sweepToSavings||0), 0);
    const pinSweepMax = pins.length>0 ? Math.max(...(chartData||[]).flatMap(r=>pins.map(p=>r[`pin_${p.id}_sweep`]||0)), 0) : 0;
    const poolMax = Math.max(...(chartData||[]).map(r=>r.surplusPool||0), 0);
    const raw = Math.max(...(chartData||[]).map(r=>r.surplus||0), ...(chartData||[]).map(r=>r.sweepToSavings||0), discFloor*1.5, schedMax*1.5, sweepMax*1.2, pinSweepMax*1.2, poolMax*1.1, 500);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw/mag)*mag;
  },[liveRows,discFloor,fcfSchedule,chartData]);
  const fixedCostMax = useMemo(()=>{
    const raw = Math.max(...(chartData||[]).map(r=>r.fixedTotal||0), 5000);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw/mag)*mag;
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

  const addPin = useCallback(()=>{
    const name=pinName.trim()||`Scenario ${nextId}`;
    const paramSnapshot=captureSnapshot();
    const rows=buildScenario(liveParams);
    const cfSettings={
      rdTopUp,rdCap,obTopUp,obCap,discFloor,
      struct6,struct15,structLaf,maintStr,bufferMode,
      diCap,totalMaintAnnual,
    };
    const newPin={id:nextId,name,color:PIN_COLORS[nextId%PIN_COLORS.length],rows,stats:keyStats(rows),cfSettings,paramSnapshot};
    const newPins=[...pins.slice(-5),newPin];
    const newNextId=nextId+1;
    setPins(newPins);
    setVisiblePins(s=>new Set([...s,nextId]));
    setNextId(newNextId);
    setPinName("");
    savePinsToStorage(newPins.map(p=>({...p,rows:undefined,stats:undefined})),newNextId);
  },[liveParams,pinName,nextId,pins,captureSnapshot,savePinsToStorage,
     rdTopUp,rdCap,obTopUp,obCap,discFloor,struct6,struct15,structLaf,maintStr,bufferMode,diCap,totalMaintAnnual]);

  const removePin=useCallback((id)=>{
    const newPins=pins.filter(p=>p.id!==id);
    setPins(newPins);
    savePinsToStorage(newPins.map(p=>({...p,rows:undefined,stats:undefined})),nextId);
  },[pins,nextId,savePinsToStorage]);

  const restorePin = useCallback((pin)=>{
    const s=pin.paramSnapshot||pin;
    if(!s) return;
    // Map paramSnapshot (engine format) back to sc (UI format)
    const next={...SC_DEFAULTS};
    if(s.keepPrimary!==undefined) next.keepPrimary=s.keepPrimary;
    if(s.topUnit!==undefined)     next.topUnit=s.topUnit;
    if(s.lafRental!==undefined)   next.lafRental=s.lafRental;
    if(s.sixthMTR!==undefined)    next.sixthMTR=s.sixthMTR;
    if(s.payOffHI!==undefined)    next.payOffHI=s.payOffHI;
    if(s.ssAge!==undefined)       next.ssAge=s.ssAge;
    if(s.workPts!==undefined)     next.workPts=s.workPts;
    if(s.lifestyleSplit!==undefined) next.lifestyleSplit=s.lifestyleSplit;
    if(s.bottomRent!==undefined)  next.bottomRent=s.bottomRent;
    if(s.strRent!==undefined)     next.strRent=s.strRent;
    if(s.ltrRent!==undefined)     next.ltrRent=s.ltrRent;
    if(s.sixthRent!==undefined)   next.sixthRent=s.sixthRent;
    if(s.sixthMonths!==undefined) next.sixthMonths=s.sixthMonths;
    if(s.reAppreciation!==undefined) next.reApp=Math.round(s.reAppreciation*1000)/10;
    if(s.reApp!==undefined)       next.reApp=s.reApp;
    if(s.rentGrowth!==undefined)  next.rentGr=Math.round(s.rentGrowth*1000)/10;
    if(s.rentGr!==undefined)      next.rentGr=s.rentGr;
    if(s.inflation!==undefined)   next.cpi=Math.round(s.inflation*1000)/10;
    if(s.cpi!==undefined)         next.cpi=s.cpi;
    if(s.healthCpi!==undefined)   next.healthCpi=typeof s.healthCpi==="number"&&s.healthCpi<1?Math.round(s.healthCpi*1000)/10:s.healthCpi;
    if(s.propCpi!==undefined)     next.propCpi=typeof s.propCpi==="number"&&s.propCpi<1?Math.round(s.propCpi*1000)/10:s.propCpi;
    if(s.taxEnabled!==undefined)  next.taxEnabled=s.taxEnabled;
    if(s.investReturn!==undefined)next.investRet=Math.round(s.investReturn*1000)/10;
    if(s.investRet!==undefined)   next.investRet=s.investRet;
    if(s.famLoanAmt!==undefined)  next.famLoanAmt=s.famLoanAmt;
    if(s.famLoanRate!==undefined) next.famLoanRate=typeof s.famLoanRate==="number"&&s.famLoanRate<1?Math.round(s.famLoanRate*1000)/10:s.famLoanRate;
    if(s.lifestyleDraws!==undefined) next.lifestyleDraws=s.lifestyleDraws.map(d=>({...d,enabled:true}));
    if(s.sixthSalePrice!==undefined) next.sixthSalePrice=s.sixthSalePrice;
    if(s.sixthCostOfSale!==undefined) next.sixthCostOfSale=s.sixthCostOfSale<1?s.sixthCostOfSale*100:s.sixthCostOfSale;
    // HI debt
    for(const k of ['sellYear','lafStopYear','saleDrawFrac','keepPrimary','strSchedule','mtrSchedule'])
      if(s[k]!==undefined) next[k]=s[k];
    for(const k of ['ccBal','ccRate','ccMin','sophiaBal','sophiaRate','sophiaMin','nolanBal','nolanRate','nolanMin'])
      if(s[k]!==undefined) next[k]=s[k];
    // CF buckets
    for(const k of ['rdTopUp','rdCap','obTopUp','obCap','discFloor','struct6','struct15','structLaf','maintStr','bufferMode'])
      if(s[k]!==undefined) next[k]=s[k];
    if(activeSc==="live") setLiveSc(next);
    else setPinScs(ps=>({...ps,[activeSc]:next}));
  },[activeSc]);

  const switchToPin = useCallback((pin)=>{
    // If pin has no sc yet, seed it from its paramSnapshot
    setPinScs(ps=>{
      if(ps[pin.id]) return ps;
      const next={...SC_DEFAULTS};
      const s=pin.paramSnapshot||{};
      // Quick copy of all sc-format keys
      Object.keys(SC_DEFAULTS).forEach(k=>{ if(s[k]!==undefined) next[k]=s[k]; });
      // Also handle engine-format keys
      if(s.reAppreciation!==undefined) next.reApp=Math.round(s.reAppreciation*1000)/10;
      if(s.rentGrowth!==undefined)     next.rentGr=Math.round(s.rentGrowth*1000)/10;
      if(s.inflation!==undefined)      next.cpi=Math.round(s.inflation*1000)/10;
      if(s.investReturn!==undefined)   next.investRet=Math.round(s.investReturn*1000)/10;
      if(s.healthCpi!==undefined&&s.healthCpi<1) next.healthCpi=Math.round(s.healthCpi*1000)/10;
      if(s.propCpi!==undefined&&s.propCpi<1)     next.propCpi=Math.round(s.propCpi*1000)/10;
      if(s.famLoanRate!==undefined&&s.famLoanRate<1) next.famLoanRate=Math.round(s.famLoanRate*1000)/10;
      if(s.sixthCostOfSale!==undefined&&s.sixthCostOfSale<1) next.sixthCostOfSale=s.sixthCostOfSale*100;
      return {...ps,[pin.id]:next};
    });
    setActiveSc(pin.id);
    // Store entry snapshot so we can detect changes on exit
    entryScRef.current = null; // will be set after pinScs state settles via useEffect
  },[]);

  // Unsaved changes check
  const [pendingSwitch, setPendingSwitch] = useState(null); // {toId} -- "live" or pin.id
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  const requestSwitch = useCallback((toId, targetPin)=>{
    if(activeSc!=="live" && activeSc!==toId){
      // Only prompt if something actually changed since we entered this pin
      const currentStr = pinScs[activeSc] ? JSON.stringify(pinScs[activeSc]) : null;
      const hasChanges = entryScRef.current !== null && currentStr !== entryScRef.current;
      if(hasChanges){
        setShowSavePrompt(true);
        setPendingSwitch({toId, targetPin});
        return;
      }
    }
    if(toId==="live"){ setActiveSc("live"); }
    else if(targetPin){ switchToPin(targetPin); }
  },[activeSc, pinScs, switchToPin]);

  const confirmSwitch = useCallback((saveChanges)=>{
    if(saveChanges && activeSc!=="live"){
      // Rebuild pin rows from current pinScs[activeSc]
      const updatedSc = pinScs[activeSc]||SC_DEFAULTS;
      const updatedParams = makeParams({
        ...updatedSc,
        ssStartYear:2026+(updatedSc.ssAge-65),
        ssAmount:updatedSc.ssAge>=67?BASE.yourSsFRA:BASE.yourSsEarly+(updatedSc.ssAge-65)*((BASE.yourSsFRA-BASE.yourSsEarly)/2),
        duplexBottomLTR:updatedSc.bottomRent, duplexTopSTR:updatedSc.strRent, duplexTopLTR:updatedSc.ltrRent, duplexTopMTR:updatedSc.ltrRent,
        sixthMTRRent:updatedSc.sixthRent, sixthMTRMonths:updatedSc.sixthMonths,
        reAppreciation:updatedSc.reApp/100, rentGrowth:updatedSc.rentGr/100, inflation:updatedSc.cpi/100,
        coreCpi:updatedSc.cpi/100, healthCpi:updatedSc.healthCpi/100, propCpi:updatedSc.propCpi/100,
        propInflation:(updatedSc.cpi/100)+0.007, investReturn:updatedSc.investRet/100,
        famLoanRate:updatedSc.famLoanRate/100, sixthCostOfSale:updatedSc.sixthCostOfSale/100,
        lifestyleDraws:updatedSc.lifestyleDraws.filter(d=>d.enabled),
        strSchedule:updatedSc.strSchedule||[],
        mtrSchedule:updatedSc.mtrSchedule||[],
        ccRate:updatedSc.ccRate/100, sophiaRate:updatedSc.sophiaRate/100, nolanRate:updatedSc.nolanRate/100,
      });
      const newRows = buildScenario(updatedParams);
      setPins(ps=>ps.map(p=>p.id===activeSc?{...p,rows:newRows,stats:keyStats(newRows),paramSnapshot:captureSnapshot()}:p));
    }
    setShowSavePrompt(false);
    const {toId, targetPin} = pendingSwitch||{};
    setPendingSwitch(null);
    if(toId==="live"){ setActiveSc("live"); }
    else if(targetPin){ switchToPin(targetPin); }
  },[activeSc, pinScs, pendingSwitch, switchToPin, captureSnapshot]);

  const switchToLive = useCallback(()=>requestSwitch("live",null),[requestSwitch]);
  // Capture entry snapshot whenever we land on a pin
  React.useEffect(()=>{
    if(activeSc!=="live"){
      entryScRef.current = pinScs[activeSc] ? JSON.stringify(pinScs[activeSc]) : null;
    } else {
      entryScRef.current = null;
    }
  },[activeSc]); // intentionally omit pinScs -- only capture on context switch

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
        const restored=imported.map(p=>{const rows=buildRowsFromSnapshot(p.paramSnapshot||{});return{...p,rows,stats:keyStats(rows)};});
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

  const statBadge=(label,val,good)=>(
    <div style={{background:bg2,borderRadius:6,padding:"8px 10px",flex:1}}>
      <div style={{fontSize:9,color:dim,marginBottom:3}}>{label}</div>
      <div style={{fontSize:13,color:good?green:val?bright:muted,fontFamily:mono,fontWeight:"bold"}}>{val||"--"}</div>
    </div>
  );

  const axP={stroke:dim,tick:{fontSize:9,fill:dim},tickLine:false};
  const gdP={strokeDasharray:"2 4",stroke:bg3};
  const ttP={contentStyle:{background:"#1a2535",border:`1px solid ${bdr}`,borderRadius:6,fontSize:10,color:bright,padding:"8px 12px"}};

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
        {key:"debtSweep",    label:"HI debt sweep",  color:"#b91c1c", cost:true, hideZero:true},
        {key:"surplus",   label:"Free Cash (net)",color:"#34d399", bold:true},
      ],
      note:"Income items build up; cost items reduce it. Net = what's left after everything.",
    },
    hiDebt: {
      label:"HI Debt -- by loan type ($K)",
      series:[
        {key:"ccBal",      label:"Credit card",   color:"#f87171"},
        {key:"sophiaBal",  label:"Sophia loans",  color:"#fb923c"},
        {key:"nolanBal",   label:"Nolan loans",   color:"#fbbf24"},
        {key:"famLoanBal", label:"Family loan",   color:"#a78bfa", hideZero:true},
        {key:"hiDebt",     label:"Total HI debt", color:"#ef4444", bold:true},
      ],
      note:"Avalanche method: highest rate first. CC (14%) attacked first, then Nolan (8.4%), then Sophia (8.1%). Family loan shown at start-of-year balance (paid off within 2026, not included in Total HI debt).",
    },
    fixedCosts: {
      label:"Fixed Costs / mo -- breakdown",
      series:[
        {key:"fc_mtg",    label:"Mortgages",        color:"#f87171"},
        {key:"fc_hlth",   label:"Health ins",        color:"#c084fc"},
        {key:"fc_core",   label:"Core living",       color:"#60a5fa"},
        {key:"fc_hiMins", label:"HI debt minimums",  color:"#fb923c", hideZero:true},
        {key:"fc_fam",    label:"Family loan",       color:"#f59e0b", hideZero:true},
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

  const Chart=({title,dataKey,pinKey,color,unit,refLines,yFmt,chartId,yDomain,secondaryDataKey,secondaryColor,secondaryName,tertiaryDataKey,tertiaryColor,tertiaryName,quaternaryDataKey,quaternaryColor,quaternaryName,headerExtra})=>{
    const isExpanded = expandedChart===chartId;
    const bd = BREAKDOWNS[chartId];
    const fmt = yFmt||(v=>v>=1000?`${(v/1000).toFixed(0)}K`:v);
    // Stable Y domain: if yDomain provided use it, else auto
    const axisDomain = yDomain || [0,'auto'];
    // For breakdown table, use liveRows directly
    // For NW chart use chartData (includes sweepSavK, savingsAcc-adjusted nw).
    // For other charts use liveRows (have reqWork, surplus etc. the chart keys expect).
    const bdSource = chartId==='nw' ? chartData : liveRows;
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
              <span>Free Cash</span>
              <svg width="14" height="4" style={{marginLeft:4}}><line x1="0" y1="2" x2="14" y2="2" stroke={secondaryColor||blue} strokeWidth="1.5" strokeDasharray="4 2"/></svg>
              <span>→ Swept</span>
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

        {/* Main chart */}
        <ResponsiveContainer width="100%" height={175}>
          <LineChart data={chartData} margin={{top:4,right:12,left:0,bottom:0}}>
            <CartesianGrid {...gdP}/>
            <XAxis dataKey="year" {...axP} tickFormatter={y=>`'${String(y).slice(2)}`}/>
            <YAxis {...axP} tickFormatter={fmt} width={42} domain={axisDomain} allowDecimals={false}/>
            <Tooltip {...ttP} formatter={(v,name)=>{
              const fmtV = yFmt?yFmt(v):(unit||"$")+Math.round(v).toLocaleString();
              if(!secondaryDataKey) return [fmtV, ""];
              const secLabel = secondaryName||"→ Swept";
              const terLabel = tertiaryName||"Surplus";
              if(name===secLabel||name===secondaryDataKey||name.endsWith("_sweep")) return [fmtV, secLabel];
              if(tertiaryDataKey&&(name===terLabel||name===tertiaryDataKey)) return [fmtV, terLabel];
              return [fmtV, name==="Live"?"Free Cash":name];
            }}/>
            {refLines&&refLines.map((rl,i)=><ReferenceLine key={i} {...rl}/>)}
            {pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
              <Line key={pin.id} type="monotone" dataKey={`pin_${pin.id}_${pinKey}`}
                stroke={pin.color} strokeWidth={1} strokeDasharray="4 3"
                dot={false} isAnimationActive={false} name={pin.name}/>
            ))}
            {showLive&&<Line type="monotone" dataKey={dataKey}
              stroke={color} strokeWidth={2.5} dot={false}
              isAnimationActive={false} name="Live"/>}
            {showLive&&secondaryDataKey&&<Line type="monotone" dataKey={secondaryDataKey}
              stroke={secondaryColor||"#60a5fa"} strokeWidth={1.5} strokeDasharray="5 3" dot={false}
              isAnimationActive={false} name={secondaryName||secondaryDataKey}/>}
            {secondaryDataKey&&pins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
              <Line key={`${pin.id}_sweep`} type="monotone" dataKey={`pin_${pin.id}_sweep`}
                stroke={pin.color} strokeWidth={1} strokeDasharray="2 4" dot={false}
                isAnimationActive={false} name={`${pin.name} sweep`}/>
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
    const START=2026;

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
      const midYr  = Math.round((pts[best].yr+pts[best+1].yr)/2);
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
          // Clamp year between neighbours, convert calendar year to offset
          const offset = Math.max(0, Math.min(YR_MAX, num - START));
          const lo = j===0 ? 0 : pts[j-1].yr+1;
          const hi = j===pts.length-1 ? YR_MAX : pts[j+1].yr-1;
          return {...p, yr: Math.max(lo, Math.min(hi, offset))};
        } else {
          return {...p, val: Math.max(0, Math.min(VAL_MAX, num))};
        }
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
                defaultValue={START+p.yr}
                key={`yr-${i}-${START+p.yr}`}
                disabled={i===0}
                style={{...inputStyle, color: i===0?dim:amber, opacity: i===0?0.5:1}}
                onFocus={e=>e.target.style.border=focusStyle}
                onBlur={e=>{e.target.style.border=`1px solid ${bdr}`; updatePt(i,'yr',e.target.value);}}
                onKeyDown={e=>{if(e.key==='Enter'){e.target.blur();}}}
              />
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
          Click a value to edit -- press Enter or click away to apply
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
            <div style={{fontSize:10,color:dim,fontFamily:mono,letterSpacing:0.5}}>v2.10.5</div>
          </div>
          <div style={{fontSize:11,color:muted,marginTop:2}}>Drag sliders to explore -- pin scenarios to compare</div>
        </div>
        <div style={{fontSize:10,color:dim,textAlign:"right"}}>
          Launch Jun 2026 &middot; Ages 65/60<br/>
          {"$"}{Math.round(HI_TOTAL/1000)}K HI debt at start
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,borderBottom:`1px solid ${bdr}`,marginBottom:14}}>
        {[["simulator","Simulator"],["cashflow","Cash Flow"],["relationships","Input / Output Map"],["glossary","Glossary"]].map(([key,label])=>(
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

            {/* -- SCENARIO CONTEXT SELECTOR -- */}
            {(showLive||pins.filter(p=>visiblePins.has(p.id)).length>0)&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,color:dim,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Editing</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {showLive&&(
                    <button onClick={switchToLive} style={{
                      background:activeSc==="live"?amber+"33":"transparent",
                      border:`1px solid ${activeSc==="live"?amber:dim}`,
                      borderRadius:12,color:activeSc==="live"?amber:dim,
                      cursor:"pointer",fontSize:10,padding:"3px 10px",fontFamily:font,
                    }}>live</button>
                  )}
                  {effectivePins.filter(p=>visiblePins.has(p.id)).map(pin=>(
                    <button key={pin.id} onClick={()=>requestSwitch(pin.id,pin)} style={{
                      background:activeSc===pin.id?pin.color+"33":"transparent",
                      border:`1px solid ${activeSc===pin.id?pin.color:dim}`,
                      borderRadius:12,color:activeSc===pin.id?pin.color:dim,
                      cursor:"pointer",fontSize:10,padding:"3px 10px",fontFamily:font,
                      maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    }}>{pin.name}</button>
                  ))}
                </div>
                {activeSc!=="live"&&(
                  <div style={{fontSize:9,color:dim,marginTop:4,fontStyle:"italic"}}>
                    Editing pin -- changes update this pin's scenario independently
                  </div>
                )}
                {showSavePrompt&&(
                  <div style={{marginTop:8,background:bg2,border:`1px solid ${amber}`,borderRadius:6,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:amber,marginBottom:6}}>Save changes to this pin before switching?</div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>confirmSwitch(true)} style={{
                        background:amber+"33",border:`1px solid ${amber}`,borderRadius:4,
                        color:amber,cursor:"pointer",fontSize:10,padding:"3px 10px",fontFamily:font
                      }}>Save + switch</button>
                      <button onClick={()=>confirmSwitch(false)} style={{
                        background:"transparent",border:`1px solid ${dim}`,borderRadius:4,
                        color:dim,cursor:"pointer",fontSize:10,padding:"3px 10px",fontFamily:font
                      }}>Discard + switch</button>
                      <button onClick={()=>{setShowSavePrompt(false);setPendingSwitch(null);}} style={{
                        background:"transparent",border:`1px solid ${dim}33`,borderRadius:4,
                        color:dim,cursor:"pointer",fontSize:10,padding:"3px 10px",fontFamily:font
                      }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ONE-TIME DECISIONS */}
            {sect("One-Time Decisions")}

            {/* 6th St sell year */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:10,color:muted}}>Sell 6th St</span>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {sellYear<=2046
                    ? <span style={{fontSize:10,color:red,fontFamily:mono,fontWeight:"bold"}}>{sellYear} (age {65+(sellYear-BASE.startYear)})</span>
                    : <span style={{fontSize:10,color:dim,fontFamily:mono}}>never</span>
                  }
                  <button onClick={()=>setSellYear(2055)} style={{
                    fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                    background:sellYear>2046?"transparent":bg2,border:`1px solid ${sellYear>2046?dim:bdr}`,
                    color:sellYear>2046?dim:amber}}>never</button>
                </div>
              </div>
              <input type="range" min={2026} max={2055} step={1} value={Math.min(sellYear,2055)}
                onChange={e=>setSellYear(parseInt(e.target.value))}
                style={{width:"100%",accentColor:red,cursor:"pointer",height:4}}/>
              {sellYear<=2046&&(<>
                <div style={{fontSize:8,color:dim,marginTop:4,display:"flex",justifyContent:"space-between"}}>
                  <span>Net proceeds ~${liveParams.sixthNetProceeds>0?Math.round(liveParams.sixthNetProceeds/1000)+"K":"--"}</span>
                  <span>Cap gains tax ~${liveParams.capGainsTax>0?Math.round(liveParams.capGainsTax/1000)+"K":"--"}</span>
                </div>
                <div style={{marginTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:10,color:muted}}>Take as lifestyle draw at close</span>
                    <span style={{fontSize:10,color:amber,fontFamily:mono}}>{Math.round(saleDrawFrac*100)}% (~${liveParams.sixthNetProceeds>0?Math.round(liveParams.sixthNetProceeds*saleDrawFrac/1000)+"K":"--"})</span>
                  </div>
                  <input type="range" min={0} max={0.8} step={0.05} value={saleDrawFrac}
                    onChange={e=>setSaleDrawFrac(parseFloat(e.target.value))}
                    style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                  <div style={{fontSize:8,color:dim,marginTop:3,display:"flex",justifyContent:"space-between"}}>
                    <span>0% = all to invested cash</span>
                    <span style={{color:saleDrawFrac>0.5?amber:dim}}>Remainder ${liveParams.sixthNetProceeds>0?Math.round(liveParams.sixthNetProceeds*(1-saleDrawFrac)/1000)+"K":"--"} -> savings</span>
                  </div>
                </div>
                <div style={{marginTop:6}}>
                  <div style={{fontSize:10,color:muted,marginBottom:3}}>HI debt at closing</div>
                  {toggle(payOffHI,setPayOffHI,[
                    {v:false,l:"Sweep over time",c:amber},{v:true,l:"Pay off at closing",c:green}
                  ])}
                </div>
              </>)}
            </div>

            {/* Lafayette stop year */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:10,color:muted}}>Lafayette rental stops</span>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {lafStopYear<=2046
                    ? <span style={{fontSize:10,color:amber,fontFamily:mono,fontWeight:"bold"}}>{lafStopYear} (age {65+(lafStopYear-BASE.startYear)})</span>
                    : <span style={{fontSize:10,color:dim,fontFamily:mono}}>keeps renting</span>
                  }
                  <button onClick={()=>setLafStopYear(2055)} style={{
                    fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                    background:lafStopYear>2046?"transparent":bg2,border:`1px solid ${lafStopYear>2046?dim:bdr}`,
                    color:lafStopYear>2046?dim:amber}}>never</button>
                </div>
              </div>
              <input type="range" min={2026} max={2055} step={1} value={Math.min(lafStopYear,2055)}
                onChange={e=>setLafStopYear(parseInt(e.target.value))}
                style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
              <div style={{fontSize:8,color:dim,marginTop:3}}>
                {lafStopYear<=2046 ? "Lafayette income zeroes from this year (you move in, or stop renting)" : "Lafayette rental income continues through model horizon"}
              </div>
              {!lafRental&&<div style={{fontSize:8,color:dim,marginTop:2,fontStyle:"italic"}}>Lafayette rental toggle is off -- stop year has no effect</div>}
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>15th St Top Unit</div>
              {toggle(topUnit,setTopUnit,[
                {v:"str",l:"STR"},{v:"ltr",l:"LTR"},{v:"mtr",l:"MTR",c:blue}
              ])}
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>Lafayette</div>
              {toggle(lafRental,setLafRental,[{v:true,l:"Rented LTR",c:green},{v:false,l:"Your home / vacant"}])}
            </div>

            {/* Rental operating cost sliders */}
            {sect("Rental Operating Costs")}
            <div style={{fontSize:8,color:dim,marginBottom:8}}>Deducted from gross rental income. Set to 0 if self-managing.</div>
            {topUnit==="str"&&(<>
              {slider("Platform fee (Airbnb/VRBO)",strPlatformPct,setStrPlatformPct,0,10,0.5,v=>v+"%  (~$"+Math.round((strRent||2800)*v/100)+"/mo)")}
              {slider("Cleaning (% of gross)",strCleanPct,setStrCleanPct,0,10,0.5,v=>v+"%  (~$"+Math.round((strRent||2800)*v/100)+"/mo)")}
            </>)}
            {(topUnit==="ltr"||topUnit==="mtr"||sc.lafRental||sc.sixthMTR)&&
              slider("Mgmt fee (LTR/MTR/Laf)",mgrPct,setMgrPct,0,12,0.5,v=>v===0?"Self-managed":v+"% of gross")
            }
            <div style={{fontSize:8,color:dim,marginBottom:10,marginTop:-4}}>
              {topUnit==="str"?`~$${Math.round((strRent||2800)*(strPlatformPct+strCleanPct)/100)}/mo platform+cleaning on 15th STR`
                :`~$${Math.round((ltrRent||3100)*mgrPct/100)}/mo mgmt on 15th ${topUnit.toUpperCase()}`}
            </div>

            {/* 6th St rental mode -- only relevant while keeping (before sell year) */}
            {sellYear>2046&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:muted,marginBottom:5}}>6th St (while keeping)</div>
                {toggle(sixthMTR,setSixthMTR,[
                  {v:false,l:"Live in / no rent",c:dim},
                  {v:true, l:"Rent as MTR",c:blue}
                ])}
                {sixthMTR&&<div style={{fontSize:8,color:dim,marginTop:3}}>Configure rates in Income &amp; Cost Knobs below</div>}
              </div>
            )}
            {sellYear<=2046&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:muted,marginBottom:5}}>6th St (before sell in {sellYear})</div>
                {toggle(sixthMTR,setSixthMTR,[
                  {v:false,l:"Live in / no rent",c:dim},
                  {v:true, l:"Rent as MTR",c:blue}
                ])}
                {sixthMTR&&<div style={{fontSize:8,color:dim,marginTop:3}}>Configure rates in Income &amp; Cost Knobs below</div>}
              </div>
            )}

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>Your SS Start Age</div>
              {toggle(ssAge,setSsAge,
                [65,66,67,68,69,70].map(a=>({v:a,l:`${a}`,c:a>=67?green:amber}))
              )}
              <div style={{fontSize:9,color:dim,marginTop:4}}>
                {ssAge===65&&`$${BASE.yourSsEarly.toLocaleString()}/mo early`}
                {ssAge===67&&`$${BASE.yourSsFRA.toLocaleString()}/mo FRA`}
                {ssAge>67&&`~$${Math.round(BASE.yourSsFRA*(1+(ssAge-67)*0.08)).toLocaleString()}/mo delayed`}
                {ssAge===66&&`~$${Math.round(BASE.yourSsEarly+(BASE.yourSsFRA-BASE.yourSsEarly)/2).toLocaleString()}/mo`}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <WorkCurveEditor
                pts={workPts}
                onChange={setWorkPts}
              />
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:muted,marginBottom:5}}>HI Debt at Launch</div>
              {sellYear>2046
                ? <div style={{fontSize:9,color:amber,background:amber+"11",border:`1px solid ${amber}33`,
                    borderRadius:5,padding:"5px 10px"}}>
                    Sweep over time (set a sell year above to unlock pay-off option)
                  </div>
                : null
              }
              {payOffHI&&sellYear<=2046&&<div style={{fontSize:9,color:green,marginTop:4}}>Paid from sale proceeds</div>}

              {/* HI Debt detail inputs */}
              {!payOffHI&&(<div style={{
                background:bg2,border:`1px solid ${bdr}`,borderRadius:7,
                padding:"8px 10px",marginTop:8
              }}>
                <div style={{fontSize:9,color:muted,fontWeight:"bold",marginBottom:8}}>HI Debt Balances</div>
                {[
                  {label:"Credit Card", bal:ccBal, setBal:setCcBal, rate:ccRate, setRate:setCcRate, min:ccMin, setMin:setCcMin, balMax:120000, rateMax:29},
                  {label:"Sophia Loans", bal:sophiaBal, setBal:setSophiaBal, rate:sophiaRate, setRate:setSophiaRate, min:sophiaMin, setMin:setSophiaMin, balMax:150000, rateMax:15},
                  {label:"Nolan Loans", bal:nolanBal, setBal:setNolanBal, rate:nolanRate, setRate:setNolanRate, min:nolanMin, setMin:setNolanMin, balMax:300000, rateMax:15},
                ].map(({label,bal,setBal,rate,setRate,min,setMin,balMax,rateMax})=>(
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
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:dim,marginTop:2}}>
                  <span>Total HI debt</span>
                  <span style={{color:red,fontFamily:mono}}>${(ccBal+sophiaBal+nolanBal).toLocaleString()}</span>
                </div>
              </div>)}

            {/* Sale details -- only shown when a sell year is set */}
            {sellYear<=2046&&!sixthMTR&&(<div style={{
              background:bg2,border:`1px solid ${bdr}`,borderRadius:8,
              padding:"10px 10px 8px",marginTop:8
            }}>
              <div style={{fontSize:9,color:muted,fontWeight:"bold",marginBottom:8}}>6th St Sale Details</div>
              {slider("Sale price",sixthSalePrice,setSixthSalePrice,1_200_000,2_400_000,25_000,
                v=>"$"+(v/1000).toFixed(0)+"K")}
              {slider("Cost of sale",sixthCostOfSale,setSixthCostOfSale,3,9,0.5,
                v=>v.toFixed(1)+"%  ($"+(sixthSalePrice*v/100/1000).toFixed(0)+"K)")}

              {/* Cap gains summary */}
              {(()=>{
                const saleNet     = sixthSalePrice*(1-sixthCostOfSale/100);
                const gain        = Math.max(0, saleNet - BASE.sixthBasis);
                const taxableGain = Math.max(0, gain - BASE.marriedExcl);
                const fedTax      = taxableGain * BASE.fedCapGains;
                const coTax       = taxableGain * BASE.coCapGains;
                const totalTax    = fedTax + coTax;
                const yrsPaidAtSale = 5 + (sellYear - BASE.startYear);
                const mtgPayoff   = remainBal(BASE.primaryMortgage, BASE.primaryRate, 30, yrsPaidAtSale);
                const hiPayoff    = payOffHI ? HI_TOTAL : 0;
                const netToInvest = Math.max(0, saleNet - mtgPayoff - totalTax - hiPayoff);
                const row = (label, val, col) => (
                  <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${bdr}22`}}>
                    <span style={{color:dim}}>{label}</span>
                    <span style={{color:col||muted,fontFamily:mono,fontSize:9}}>{val}</span>
                  </div>
                );
                return (
                  <div style={{fontSize:9,marginTop:8,display:"flex",flexDirection:"column",gap:0}}>
                    {row("Sale price",    "$"+(sixthSalePrice/1000).toFixed(0)+"K", muted)}
                    {row("Cost of sale",  "-$"+(sixthSalePrice*sixthCostOfSale/100/1000).toFixed(0)+"K", red)}
                    {row("Net proceeds",  "$"+(saleNet/1000).toFixed(0)+"K", muted)}
                    {row(`Mtg payoff (${sellYear})`,"-$"+(mtgPayoff/1000).toFixed(0)+"K", red)}
                    {row("Gross gain",    "$"+(gain/1000).toFixed(0)+"K", muted)}
                    {row("Married excl.", "-$"+(Math.min(gain,BASE.marriedExcl)/1000).toFixed(0)+"K", green)}
                    {row("Taxable gain",  "$"+(taxableGain/1000).toFixed(0)+"K", taxableGain>0?amber:dim)}
                    {row("Fed tax (23.8%)","-$"+(fedTax/1000).toFixed(0)+"K", red)}
                    {row("CO tax (4.4%)", "-$"+(coTax/1000).toFixed(0)+"K", red)}
                    {payOffHI&&row("HI debt payoff","-$"+(hiPayoff/1000).toFixed(0)+"K", red)}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",marginTop:2,borderTop:`1px solid ${bdr}`}}>
                      <span style={{color:muted,fontWeight:"bold"}}>Net to invest</span>
                      <span style={{color:green,fontFamily:mono,fontWeight:"bold",fontSize:10}}>${(netToInvest/1000).toFixed(0)}K</span>
                    </div>
                    <div style={{color:dim,fontSize:8,marginTop:4}}>
                      IRMAA: +${BASE.irmaaSurge*2}/mo Medicare in {BASE.startYear+2} (1yr lookback hit)
                    </div>
                  </div>
                );
              })()}
            </div>)}
            </div>

            {/* LIQUIDATION NW BASIS */}
            {sect("Liquidation NW Basis")}
            <div style={{fontSize:8,color:dim,marginBottom:8}}>Cost basis for "liq" toggle on NW chart. 5% selling costs + 28.2% cap gains on taxable gain. Rentals: no exclusion. 6th St: $500K married exclusion. (6th St basis is hardcoded at ${(BASE.sixthBasis/1000).toFixed(0)}K.)</div>
            {slider("15th St (duplex) basis",duplex15thBasis,setDuplex15thBasis,200_000,1_200_000,25_000,v=>"$"+(v/1000).toFixed(0)+"K")}
            {slider("Lafayette basis",lafayetteBasis,setLafayetteBasis,100_000,600_000,25_000,v=>"$"+(v/1000).toFixed(0)+"K")}

            {/* INCOME KNOBS */}
            {sect("Income & Cost Knobs")}

            {slider("15th Bottom LTR",bottomRent,setBottomRent,1500,5000,50,v=>`$${v.toLocaleString()}/mo`)}
            {topUnit==="str"&&slider("15th Top STR (fallback rate)",strRent,setStrRent,1400,4200,100,v=>`$${v.toLocaleString()}/mo -- used for years with no schedule`)}
            {topUnit!=="str"&&slider("15th Top LTR/MTR",ltrRent,setLtrRent,1550,4650,50,v=>`$${v.toLocaleString()}/mo`)}

            {/* -- STR Schedule -- */}
            {topUnit==="str"&&(
              <div style={{marginTop:12,marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:10,color:muted,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>STR Schedule</span>
                  <button
                    onClick={()=>{
                      const prev = strSchedule[strSchedule.length-1];
                      const defaultSegs = prev ? prev.segments.map(s=>({...s})) : [{days:120,rate:280,type:"nightly"},{days:90,rate:3100,type:"monthly"}];
                      const newYrFrom = prev ? Math.min(2046, (prev.yrTo||prev.yr||2026)+1) : 2026;
                      const newYrTo   = Math.min(2046, newYrFrom+1);
                      setStrSchedule(s=>[...s,{yrFrom:newYrFrom, yrTo:newYrTo, segments:defaultSegs}]);
                    }}
                    style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,
                      background:"transparent",border:`1px solid ${bdr}`,color:dim,cursor:"pointer"}}>
                    + add year
                  </button>
                </div>
                <div style={{fontSize:8,color:dim,marginBottom:8}}>
                  Per-year booking mix. Each segment is either nightly (STR) or monthly (LTR block). Years without an entry use the fallback rate above.
                </div>
                {strSchedule.length===0&&(
                  <div style={{fontSize:9,color:bdr,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>Using flat rate for all years</div>
                )}
                {strSchedule.map((entry,ei)=>{
                  const annualGross = strScheduleIncome(entry.segments);
                  const totalDays = entry.segments.reduce((s,g)=>s+(g.days||0),0);
                  // Support both old {yr} format and new {yrFrom,yrTo}
                  const yrFrom = entry.yrFrom ?? entry.yr ?? 2026;
                  const yrTo   = entry.yrTo   ?? entry.yr ?? 2026;
                  const yearLabel = yrFrom===yrTo ? String(yrFrom) : `${yrFrom}–${yrTo}`;
                  return (
                    <div key={ei} style={{background:bg2,border:`1px solid ${green}55`,borderRadius:7,padding:"8px 10px",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:9,color:green,fontWeight:"bold"}}>
                            {yearLabel} — {totalDays}d — ${Math.round(annualGross/12).toLocaleString()}/mo avg
                          </span>
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          <button
                            onClick={()=>setStrSchedule(s=>s.map((x,j)=>j===ei?{...x,segments:[...x.segments,{days:30,rate:200,type:"nightly"}]}:x))}
                            style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                              background:"transparent",border:`1px solid ${bdr}`,color:dim}}>+ seg</button>
                          <button
                            onClick={()=>setStrSchedule(s=>s.filter((_,j)=>j!==ei))}
                            style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                              background:"transparent",border:`1px solid ${bdr}`,color:dim}}>remove</button>
                        </div>
                      </div>
                      {/* Year range selector */}
                      <div style={{marginBottom:8,display:"flex",gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                            <span style={{fontSize:9,color:muted}}>From</span>
                            <span style={{fontSize:9,color:green,fontFamily:mono}}>{yrFrom}</span>
                          </div>
                          <input type="range" min={2026} max={2046} step={1} value={yrFrom}
                            onChange={e=>{const v=parseInt(e.target.value);setStrSchedule(s=>s.map((x,j)=>j===ei?{...x,yrFrom:v,yrTo:Math.max(v,yrTo)}:x));}}
                            style={{width:"100%",accentColor:green,cursor:"pointer",height:4}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                            <span style={{fontSize:9,color:muted}}>To</span>
                            <span style={{fontSize:9,color:green,fontFamily:mono}}>{yrTo}</span>
                          </div>
                          <input type="range" min={2026} max={2046} step={1} value={yrTo}
                            onChange={e=>{const v=parseInt(e.target.value);setStrSchedule(s=>s.map((x,j)=>j===ei?{...x,yrTo:v,yrFrom:Math.min(yrFrom,v)}:x));}}
                            style={{width:"100%",accentColor:green,cursor:"pointer",height:4}}/>
                        </div>
                      </div>
                      {/* Segments */}
                      {entry.segments.map((seg,si)=>(
                        <div key={si} style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:5,padding:"6px 8px",marginBottom:6}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <div style={{display:"flex",gap:4}}>
                              {["nightly","monthly"].map(t=>(
                                <button key={t} onClick={()=>setStrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.map((g,k)=>k===si?{...g,type:t}:g)}))}
                                  style={{fontSize:8,padding:"1px 7px",borderRadius:3,fontFamily:font,cursor:"pointer",
                                    background:seg.type===t?green+"33":"transparent",
                                    border:`1px solid ${seg.type===t?green:bdr}`,
                                    color:seg.type===t?green:dim}}>
                                  {t==="nightly"?"STR $/night":"LTR $/mo"}
                                </button>
                              ))}
                            </div>
                            {entry.segments.length>1&&(
                              <button onClick={()=>setStrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.filter((_,k)=>k!==si)}))}
                                style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                                  background:"transparent",border:`1px solid ${bdr}`,color:dim}}>x</button>
                            )}
                          </div>
                          <div style={{marginBottom:5}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                              <span style={{fontSize:9,color:muted}}>Days</span>
                              <span style={{fontSize:9,color:amber,fontFamily:mono}}>{seg.days}d</span>
                            </div>
                            <input type="range" min={0} max={180} step={5} value={seg.days}
                              onChange={e=>setStrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.map((g,k)=>k===si?{...g,days:parseInt(e.target.value)}:g)}))}
                              style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                              <span style={{fontSize:9,color:muted}}>{seg.type==="nightly"?"Rate/night":"Rate/mo"}</span>
                              <span style={{fontSize:9,color:amber,fontFamily:mono}}>${seg.rate.toLocaleString()} -> ${Math.round(seg.type==="nightly"?seg.days*seg.rate:(seg.days/30)*seg.rate).toLocaleString()}/yr this seg</span>
                            </div>
                            <input type="range"
                              min={seg.type==="nightly"?100:1000}
                              max={seg.type==="nightly"?1200:4500}
                              step={seg.type==="nightly"?10:50}
                              value={seg.rate}
                              onChange={e=>setStrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.map((g,k)=>k===si?{...g,rate:parseInt(e.target.value)}:g)}))}
                              style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                          </div>
                        </div>
                      ))}
                      <div style={{fontSize:8,color:green,textAlign:"right",marginTop:2}}>
                        Total: {totalDays}d booked -> ${annualGross.toLocaleString()}/yr gross (${Math.round(annualGross/12).toLocaleString()}/mo avg)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {sixthMTR&&slider("6th St MTR -- fallback rate",sixthRent,setSixthRent,3000,9000,250,v=>`$${v.toLocaleString()}/mo -- used for years with no schedule`)}
            {sixthMTR&&slider("6th St MTR -- fallback months/yr",sixthMonths,setSixthMonths,1,12,1,v=>`${v} mo/yr  ($${Math.round(sixthRent*v/12).toLocaleString()}/mo avg)`)}

            {/* -- MTR Schedule (6th St) -- */}
            {sixthMTR&&(
              <div style={{marginTop:12,marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:10,color:muted,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>6th St MTR Schedule</span>
                  <button
                    onClick={()=>{
                      const prev = mtrSchedule[mtrSchedule.length-1];
                      const defaultSegs = prev ? prev.segments.map(s=>({...s})) : [{months:8,rate:6500},{months:2,rate:4500}];
                      const newYrFrom = prev ? Math.min(2046,(prev.yrTo||prev.yr||2026)+1) : 2026;
                      const newYrTo   = Math.min(2046, newYrFrom+1);
                      setMtrSchedule(s=>[...s,{yrFrom:newYrFrom,yrTo:newYrTo,segments:defaultSegs}]);
                    }}
                    style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontFamily:font,
                      background:"transparent",border:`1px solid ${bdr}`,color:dim,cursor:"pointer"}}>
                    + add year
                  </button>
                </div>
                <div style={{fontSize:8,color:dim,marginBottom:8}}>
                  Per-year rental mix for 6th St. Each segment = months at a given rate (peak, off-peak, festival premium). Unscheduled months = vacancy. Years without an entry use the fallback rate above.
                </div>
                {mtrSchedule.length===0&&(
                  <div style={{fontSize:9,color:bdr,fontStyle:"italic",textAlign:"center",padding:"8px 0"}}>Using flat rate for all years</div>
                )}
                {mtrSchedule.map((entry,ei)=>{
                  const annualGross = mtrScheduleIncome(entry.segments);
                  const totalMonths = entry.segments.reduce((s,g)=>s+(g.months||0),0);
                  const vacancyMo   = Math.max(0, 12-totalMonths);
                  const yrFrom = entry.yrFrom ?? entry.yr ?? 2026;
                  const yrTo   = entry.yrTo   ?? entry.yr ?? 2026;
                  const yearLabel = yrFrom===yrTo ? String(yrFrom) : `${yrFrom}–${yrTo}`;
                  const afterSell  = sellYear<=2046 && yrFrom>=sellYear;
                  return (
                    <div key={ei} style={{background:bg2,border:`1px solid ${afterSell?dim:blue}55`,borderRadius:7,padding:"8px 10px",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:9,color:afterSell?dim:blue,fontWeight:"bold"}}>
                          {yearLabel}
                          {afterSell?" (after sell year — no effect)":""}
                          {" — "}{totalMonths}mo rented{vacancyMo>0?`, ${vacancyMo}mo vacant`:""} — ${Math.round(annualGross/12).toLocaleString()}/mo avg
                        </span>
                        <div style={{display:"flex",gap:4}}>
                          <button
                            onClick={()=>setMtrSchedule(s=>s.map((x,j)=>j===ei?{...x,segments:[...x.segments,{months:1,rate:5000}]}:x))}
                            style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                              background:"transparent",border:`1px solid ${bdr}`,color:dim}}>+ seg</button>
                          <button
                            onClick={()=>setMtrSchedule(s=>s.filter((_,j)=>j!==ei))}
                            style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                              background:"transparent",border:`1px solid ${bdr}`,color:dim}}>remove</button>
                        </div>
                      </div>
                      {/* Year range selector */}
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                            <span style={{fontSize:9,color:muted}}>From</span>
                            <span style={{fontSize:9,color:blue,fontFamily:mono}}>{yrFrom}</span>
                          </div>
                          <input type="range" min={2026} max={2046} step={1} value={yrFrom}
                            onChange={e=>{const v=parseInt(e.target.value);setMtrSchedule(s=>s.map((x,j)=>j===ei?{...x,yrFrom:v,yrTo:Math.max(v,yrTo)}:x));}}
                            style={{width:"100%",accentColor:blue,cursor:"pointer",height:4}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                            <span style={{fontSize:9,color:muted}}>To</span>
                            <span style={{fontSize:9,color:blue,fontFamily:mono}}>{yrTo}</span>
                          </div>
                          <input type="range" min={2026} max={2046} step={1} value={yrTo}
                            onChange={e=>{const v=parseInt(e.target.value);setMtrSchedule(s=>s.map((x,j)=>j===ei?{...x,yrTo:v,yrFrom:Math.min(yrFrom,v)}:x));}}
                            style={{width:"100%",accentColor:blue,cursor:"pointer",height:4}}/>
                        </div>
                      </div>
                      {/* Segments */}
                      {entry.segments.map((seg,si)=>(
                        <div key={si} style={{background:bg1,border:`1px solid ${bdr}`,borderRadius:5,padding:"6px 8px",marginBottom:6}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:8,color:dim}}>Segment {si+1}</span>
                            {entry.segments.length>1&&(
                              <button onClick={()=>setMtrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.filter((_,k)=>k!==si)}))}
                                style={{fontSize:8,padding:"1px 6px",borderRadius:3,fontFamily:font,cursor:"pointer",
                                  background:"transparent",border:`1px solid ${bdr}`,color:dim}}>x</button>
                            )}
                          </div>
                          <div style={{marginBottom:5}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                              <span style={{fontSize:9,color:muted}}>Months rented</span>
                              <span style={{fontSize:9,color:amber,fontFamily:mono}}>{seg.months}mo</span>
                            </div>
                            <input type="range" min={1} max={12} step={1} value={seg.months}
                              onChange={e=>setMtrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.map((g,k)=>k===si?{...g,months:parseInt(e.target.value)}:g)}))}
                              style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                              <span style={{fontSize:9,color:muted}}>Rate/mo</span>
                              <span style={{fontSize:9,color:amber,fontFamily:mono}}>${seg.rate.toLocaleString()} -> ${(seg.months*seg.rate).toLocaleString()}/yr this seg</span>
                            </div>
                            <input type="range" min={2000} max={12000} step={250} value={seg.rate}
                              onChange={e=>setMtrSchedule(s=>s.map((x,j)=>j!==ei?x:{...x,segments:x.segments.map((g,k)=>k===si?{...g,rate:parseInt(e.target.value)}:g)}))}
                              style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                          </div>
                        </div>
                      ))}
                      <div style={{fontSize:8,color:blue,textAlign:"right",marginTop:2}}>
                        Total: {totalMonths}mo booked -> ${annualGross.toLocaleString()}/yr (${Math.round(annualGross/12).toLocaleString()}/mo avg)
                        {vacancyMo>0&&<span style={{color:dim}}> + {vacancyMo}mo vacant</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {slider("Family Loan Amount",famLoanAmt,setFamLoanAmt,0,50000,5000,v=>v===0?"None":"$"+v.toLocaleString())}
            {famLoanAmt>0&&slider("Family Loan Rate",famLoanRate,setFamLoanRate,4,10,0.25,v=>`${v.toFixed(2)}%  ($${Math.round(famLoanAmt*(v/100/12*Math.pow(1+v/100/12,BASE.famLoanMonths))/(Math.pow(1+v/100/12,BASE.famLoanMonths)-1)).toLocaleString()}/mo x ${BASE.famLoanMonths}mo)`)}

            {/* MARKET ASSUMPTIONS */}
            {sect("Market Assumptions")}

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
              Est. {liveRows[0]?`$${Math.round(liveRows[0].tax/100)*100}/mo`:"..."} in 2026, {liveRows[4]?`$${Math.round(liveRows[4].tax/100)*100}/mo`:"..."} in 2030
            </div>}
            {!payOffHI&&slider("Investment Return",investRet,setInvestRet,2.75,8.25,0.25,v=>`${v.toFixed(2)}%/yr`)}
            {payOffHI&&slider("Investment Return (SB proceeds)",investRet,setInvestRet,2.75,8.25,0.25,v=>`${v.toFixed(2)}%/yr`)}

            {/* -- Lifestyle Draws -- */}
            <div style={{marginTop:14}}>
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
                      <span style={{fontSize:10,color:amber,fontFamily:mono}}>{2026+d.yr} (age {65+d.yr})</span>
                    </div>
                    <input type="range" min={0} max={20} step={1} value={d.yr}
                      onChange={e=>setLifestyleDraws(ds=>ds.map((x,j)=>j===i?{...x,yr:parseInt(e.target.value)}:x))}
                      style={{width:"100%",accentColor:amber,cursor:"pointer",height:4}}/>
                    {(()=>{
                      const cashAtYr = liveRows[d.yr]?.cashAst ?? 0;
                      const ok = cashAtYr >= d.amount;
                      return <div style={{fontSize:8,color:ok?dim:red,marginTop:3}}>
                        Invested cash at {2026+d.yr}: ~${Math.round(cashAtYr/1000)}K
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
                    <span style={{color:amber}}>${d.amount.toLocaleString()}</span> in <span style={{color:muted}}>{2026+d.yr}</span>
                  </div>
                </div>
              ))}
            </div>

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
              {statBadge("Work-free year",liveStats.workFreeYr?String(liveStats.workFreeYr):"2046+",!!liveStats.workFreeYr)}
              {statBadge("HI debt clear",liveStats.debtClearYr?String(liveStats.debtClearYr):"Never",!!liveStats.debtClearYr)}
              {statBadge("Net worth yr 10","$"+liveNwYr10.toFixed(1)+"M",liveNwYr10>2)}
            </div>

            {/* Row 2: SS earnings constraint */}
            {(()=>{
              const SS_CAP = 24480;
              const isEarly = ssAge < 67;
              const yourSsMonthly = ssAge>=67?BASE.yourSsFRA:ssAge===65?BASE.yourSsEarly:Math.round(BASE.yourSsEarly+(BASE.yourSsFRA-BASE.yourSsEarly)/2);
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
                    <span style={{fontSize:10,color:overCap>0?red:amber,fontWeight:"bold"}}>SS at {ssAge} -- Earnings Test active until age 67 ({2026+(67-ssAge)})</span>
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
                    Cap ~4%/yr wage inflation: ${Math.round(SS_CAP*1.04).toLocaleString()} in 2027, ${Math.round(SS_CAP*1.04*1.04).toLocaleString()} in 2028 &middot; Disappears entirely at your FRA age 67 ({2026+(67-ssAge)}) &middot; Brenda has no SS yet -- no limit on her 1099s
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
                ...(ssAge<67?[{y:Math.round(24480/12),stroke:amber,strokeOpacity:0.4,strokeDasharray:"4 2",label:{value:"SS earnings cap",fill:amber,fontSize:7,position:"insideTopRight"}}]:[]),
              ]}/>
            <Chart title="Free Cash Flow / mo" dataKey="surplus" pinKey="di" color={green} chartId="surplus"
              yDomain={[0, surplusMax]}
              secondaryDataKey="sweepToSavings" secondaryColor={blue} secondaryName="→ Savings sweep"
              tertiaryDataKey="surplusPool" tertiaryColor={amber} tertiaryName="Surplus"
              quaternaryDataKey={(fcfSchedule||[]).length>0?"floorLine":undefined} quaternaryColor={green} quaternaryName="Floor schedule"
              refLines={(fcfSchedule||[]).length===0
                ? [{y:discFloor,stroke:dim,strokeDasharray:"2 4",label:{value:`$${discFloor.toLocaleString()} floor`,fill:dim,fontSize:8,position:"insideTopLeft"}}]
                : []}  // phase schedule shown via floorLine data series instead
              />
            <Chart title="HI Debt Balance ($K)" dataKey="hiDebt" pinKey="debt" color={red} chartId="hiDebt"
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
                    {effectivePins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
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
                    {effectivePins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
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
                    {effectivePins.filter(pin=>visiblePins.has(pin.id)).map(pin=>(
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
                evts.push({cat:"income", icon:"SS", desc:`Your SS starts (age ${65+(yr-2026)})`, delta:r.yourSs, note:`$${r.yourSs.toLocaleString()}/mo`});
              if(r.brendaSs>0 && (!prev||prev.brendaSs===0))
                evts.push({cat:"income", icon:"SS", desc:`Brenda SS spousal starts (FRA ${yr})`, delta:r.brendaSs, note:`$${r.brendaSs.toLocaleString()}/mo`});
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
              if(prev && r.mtg > prev.mtg+200)
                evts.push({cat:"cost", icon:"MTG", desc:"Mortgages switch IO → full P&I (HI debt cleared)", delta:r.mtg-prev.mtg, note:`$${prev.mtg.toLocaleString()} → $${r.mtg.toLocaleString()}/mo`});
              if(prev && r.mtg < prev.mtg-200)
                evts.push({cat:"cost", icon:"MTG", desc:"Mortgage cost drops", delta:r.mtg-prev.mtg, note:`$${prev.mtg.toLocaleString()} → $${r.mtg.toLocaleString()}/mo`});
              if(prev && r.famLoan===0 && prev.famLoan>0)
                evts.push({cat:"cost", icon:"LN", desc:"Family loan paid off", delta:-prev.famLoan, note:`−$${prev.famLoan.toLocaleString()}/mo freed`});
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

              // Milestone events
              if(r.hiDebt===0 && (!prev||prev.hiDebt>0))
                evts.push({cat:"milestone", icon:"OK", desc:"All HI debt eliminated", delta:0, note:`Total cleared: $${Math.round((prev?.hiDebt||0))}K · mortgages now eligible for P&I`});
              if(r.reqWork===0 && (!prev||prev.reqWork>0))
                evts.push({cat:"milestone", icon:"*", desc:"WORK-FREE — passive income covers all costs", delta:0, note:`NW: $${(r.nw/1000).toFixed(1)}M · passive: $${r.passive.toLocaleString()}/mo`});

              // Lifestyle draw events
              for(const d of lifestyleDraws.filter(x=>x.enabled)){
                if(yr===2026+d.yr)
                  evts.push({cat:"income", icon:"DR", desc:"Lifestyle Draw", delta:Math.round(d.amount/12), note:`$${d.amount.toLocaleString()} lump sum`});
              }

              if(evts.length>0) events.push({yr, age:65+(yr-2026), r, evts});
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
                <div key={pin.id} style={{
                  background:bg2,border:`1px solid ${pin.color}44`,
                  borderLeft:`3px solid ${pin.color}`,borderRadius:7,
                  padding:"9px 12px",display:"flex",alignItems:"center",gap:10,
                }}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:pin.color,fontWeight:"bold",marginBottom:5}}>{pin.name}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {[
                        ["Launch RW","$"+pin.stats.launchRW.toLocaleString()+"/mo"],
                        ["Work-free",pin.stats.workFreeYr||"2046+"],
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
                    <button onClick={()=>{
                        setVisiblePins(s=>{const n=new Set(s);n.delete(pin.id);return n;});
                        if(activeSc===pin.id) switchToLive();
                      }}
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
                          <button onClick={()=>{removePin(pin.id);setConfirmDeleteId(null);if(activeSc===pin.id)switchToLive();}} style={{
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
              const visPins = effectivePins.filter(p=>visiblePins.has(p.id));
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
                {label:"Work-free year",      fmt:c=>c.stats.workFreeYr?String(c.stats.workFreeYr):"2046+",  good:c=>!!c.stats.workFreeYr&&c.stats.workFreeYr<=2034},
                {label:"HI debt clear",       fmt:c=>c.stats.debtClearYr?String(c.stats.debtClearYr):"Never", good:c=>!!c.stats.debtClearYr&&c.stats.debtClearYr<=2031},
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
            {sellYear>2046&&slider("6th St structure value",struct6,setStruct6,300,900,50,v=>"$"+v+"K  ($"+Math.round(struct6*1000*maintStr/100/12).toLocaleString()+"/mo)")}
            {slider("15th St structure value",struct15,setStruct15,250,750,50,v=>"$"+v+"K  ($"+Math.round(struct15*1000*maintStr/100/12).toLocaleString()+"/mo)")}
            {slider("Lafayette structure value",structLaf,setStructLaf,125,500,25,v=>"$"+v+"K  ($"+Math.round(structLaf*1000*maintStr/100/12).toLocaleString()+"/mo)")}
            <div style={{fontSize:9,color:dim,marginBottom:4}}>
              Cap = 5 yrs of reserves per property. Once full, monthly amount redirects to HI sweep.
            </div>
            <div style={{fontSize:9,color:amber,fontFamily:mono,marginBottom:10}}>
              Total: ${Math.round(((sellYear>2046?struct6:0)+struct15+structLaf)*1000*maintStr/100/12).toLocaleString()}/mo
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
                {label:"Mortgages",         sub:"15th duplex + Lafayette" + (keepPrimary?" + 6th St":""),  val:r0.fc_mtg,    color:"#f87171", note:null},
                {label:"Health insurance",  sub:"You + Brenda + kids (until off plan)",                    val:r0.fc_health,  color:"#c084fc", note:null},
                {label:"Core living",       sub:"Car $250 · Other ins $500 · Food $900 · Utilities $400 · Personal $600", val:r0.fc_core, color:"#60a5fa", note:null},
                {label:"HI debt minimums",  sub:"CC + Sophia + Nolan loans",                               val:r0.fc_hiMins,  color:"#fb923c", note:r0.fc_hiMins===0?"Paid off or none":null},
                {label:"Family loan",       sub:"$25K at 7.5% × 8mo",                                     val:r0.fc_famLoan, color:"#f59e0b", note:r0.fc_famLoan===0?"Paid off":null},
                {label:"Rental op costs",   sub:topUnit==="str"?"Platform "+strPlatformPct+"% + cleaning "+strCleanPct+"%":"Mgmt "+mgrPct+"% on LTR/MTR", val:r0.fc_rentalOp||0, color:"#34d399", note:(r0.fc_rentalOp||0)===0?"Self-managed / none":null},
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
                          topUnit==="str"
                            ? {label:"STR operating costs",  sub:"Cleaning (~$130/turn), Airbnb/VRBO platform fee (~3%), supplies"}
                            : topUnit==="mtr"
                            ? {label:"MTR management fee",   sub:"Typical 8–10% of gross rent if using a manager"}
                            : {label:"LTR management fee",   sub:"Typical 8–10% of gross rent if using a manager (~$"+Math.round((ltrRent||3100)*0.09).toLocaleString()+"/mo)"},
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
              <div style={{fontSize:11,color:muted,fontWeight:"bold",marginBottom:10}}>
                Month-by-Month Cash Flow
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
