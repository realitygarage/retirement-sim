# Retirement Sim v4.0.0 — Property-Centric Architecture: CONSOLIDATED SPEC

**Date:** 2026-07-03
**Supersedes:** the flat-param property/income model. No backward compatibility required
(Bob starts scenarios fresh; migration deferred until the tool stabilizes).
**Workflow:** design agreed in claude.ai; this is the full task brief for Claude Code.
**Split into two sessions — do NOT attempt in one pass. Commit A before starting B.**

---

## 0. What changes and why

The sidebar today is knob-centric: a "One-Time Decisions" block, a 15th-St-specific
Top Unit selector, Lafayette toggles, and loose income/cost knobs — property data
scattered across a dozen flat params. v4 makes it **property-centric**: each property
owns its hold/sell decision, its units, each unit's income schedule, its disposition
tax block, and its operating-cost treatment. This mirrors standard RE pro-forma
structure (rent roll + opex profile + disposition waterfall).

**Design decisions (locked with Bob):**
- Sale timing granularity: **quarter**.
- LTR vacancy/collection-loss factor: **4% default**, one knob (Defaults tab), applied
  to LTR segment income only (STR/MTR encode occupancy via days/months).
- MTR cleaning: **flat $ per turnover/block** (default $300), NOT % of gross. LTR: no
  cleaning. STR: % of gross (existing).
- Proceeds routing: **pooled per year**, not per property. All dispositions in a year
  feed one chain.
- Lifestyle draw in the routing chain: **dollar amount** (unchanged from v3.2).
- Settlement → renamed **"One-Time Obligation"**; gain offset assumed **100% ON**;
  lawsuit nuance lives outside the tool.
- **No schema backward compatibility.** No pin migration. No legacy UI compatibility layer.

---

## 1. New data model (the schema)

```js
// One entry per property. Units array length 1 or 2.
properties: [
  {
    id: 'sixth',            // 'sixth' | 'fifteenth' | 'barberry'
    label: '6th St (home)',
    isPrimary: true,        // 6th only — enables §121, DISABLES 1031 options
    value: 1_675_000,
    appreciationPct: 4,     // may inherit from Economy default if null
    mortgage: { balance, rate, originDate, termYears: 30, ioYears: 10 }, // see v3.4 IO/recast
    // Disposition:
    hold: {
      mode: 'keep',         // primary: 'keep'|'sell'
                            // rental:  'keep'|'sell'|'full_1031'|'partial_1031'
      year: 2055,
      quarter: 2,           // 1–4; sale assumed at quarter boundary
      saleMode: 'market',   // 'market'|'forced'
      cashBoot: 0,          // partial_1031 only
      basis: 899_550,
      sec121Exclusion: 500_000,   // primary only
      caSourceDeferredGain: 0,    // rentals (1031 replacements)
      depreciationRecapture: 0,
      // CPA reconciliation targets (display only):
      cpaEstTax: 62_000, cpaNetProceedsAfterTax: 708_881,
    },
    units: [
      {
        id: 'sixth-main',
        label: 'Main',
        segments: [          // the 6th-St editor shape, now per unit
          // { yrFrom, yrTo, kind: 'str'|'mtr'|'ltr',
          //   str:[{days,rate,type}], mtr:[{months,rate}], ltr:{monthlyRent} }
        ],
      },
    ],
  },
  // fifteenth: isPrimary:false, TWO units (top/bottom), 1031 fields populated
  // barberry:  isPrimary:false, one unit, 1031 fields populated
]
```

Economy/default knobs (Defaults tab): `ltrVacancyPct: 4`, `mtrCleaningFlat: 300`, plus
existing appreciation/rent-growth/CPI/investRet.

Operating-cost profiles (applied automatically by segment kind):

| Cost | STR | MTR | LTR |
|---|---|---|---|
| Platform fee (`strPlatformPct`) | ✔ % gross | — | — |
| Cleaning | `strCleanPct` % gross | `mtrCleaningFlat` $/block | — |
| Mgmt fee (`mgrPct`) | ✔ % | ✔ % | ✔ % |
| Vacancy (`ltrVacancyPct`) | — | — | ✔ % |

---

## 2. Segment rules (per unit)

- Overlapping segments **sum**, EXCEPT: **LTR is exclusive within its span for that
  unit** — reject a new/edited segment that would run LTR concurrently with any other
  segment on the same unit (a tenant occupies the whole unit). STR+MTR may coexist on
  one unit; anything may coexist across different units.
- Segments **auto-clip at the property's sale date** (year+quarter). If a segment's
  range extends past the sale, truncate its effective income and show a non-blocking
  info notice ("truncated at Q{n} {year} sale"). Never generate income from a sold
  property.
- Sale-year proration: income counts for quarters held (sale at quarter boundary →
  income for quarters strictly before the sale quarter).
- Inner caps unchanged: Σ days ≤ 365/yr within a segment's STR list; Σ months ≤ 12/yr
  within an MTR list.

---

## 3. Engine changes (annual + monthly mirror — MUST agree)

1. **Income:** for each year, for each held property, for each unit, sum income across
   ALL covering segments, each netted by its kind's cost profile (§1 table). Apply
   `ltrVacancyPct` to LTR gross; `mtrCleaningFlat` once per MTR block present that year;
   STR platform+cleaning as %. Prorate the sale year by quarters held.
2. **Disposition:** reuse `disposeAsset` (v3 Phase 1) per property at its sale
   year/quarter; primary → §121 path (no 1031); rentals → sell/full/partial with
   recapture-first + CA clawback + CO credit. Emit after-tax proceeds into the year's
   pool.
3. **IO→P&I mortgage structure (carry the v3.4 fix):** each property's mortgage honors
   the 10-yr IO period and recasts at IO end on the actual balance. Held-only. Emit
   IO→P&I timeline events.
4. **Pooled proceeds routing (per year with any disposition):**
   ```
   pool     = Σ afterTaxNetProceeds(year) + Σ partial-1031 boot(year)
   pool    -= oneTimeObligation.amount   (if obligation year === this year; floor 0)
   pool    -= lifestyleDraw ($, capped at pool)   → that year's discretionary outflow
   paydown  = min(remaining × hiPaydownPct/100, HI balances) → avalanche (shared helper)
   pool    -= paydown
   remainder→ monthly waterfall as one-time inflow (fills buckets→caps, sweep, savings)
   ```
   Conservation test: obligation + lifestyle + paydown + remainder === pool.
5. **Mortgage-principal waterfall bucket (carry v3.4):** held 6th & 15th only, before
   surplus→savings sweep; extra principal lowers IO-period interest and recast payment.

---

## 4. One-Time Obligation (was Settlement)

Block: `{ amount, year, quarter, offsetsCapitalGains: true }`. When on, the obligation
amount reduces that year's recognized capital gains (capped at the gains pool), lowering
disposition tax — the Kimbell/Arrowsmith offset, now assumed 100% and stripped of
lawsuit framing. `requireSameYearForOffset` moves to the Defaults tab as an advanced
assumption (default on). Keep the reconciliation card and CPA columns (calibration).

---

## SESSION A — v4.0.0-A: schema + engines + scaffold UI

Deliver a fully-functional-but-rough build: new schema, both engines, and a **minimal
scaffold UI** exposing every code path (per property: mode/year/quarter, one unit with
a working segment editor, disposition fields when selling; the pooled routing chain; the
obligation block). No polish, no collapse groups, no dead-UI removal yet. All Group A
tests green.

Tests: income sums across overlapping segments (annual===monthly); LTR-exclusivity
rejection; segment clip at sale quarter; sale-year proration by quarter; cost profiles
apply by kind (STR platform+%clean, MTR flat clean, LTR vacancy, no LTR cleaning);
disposeAsset per property incl. primary=§121/no-1031; IO flat then recast on actual
balance; pooled routing conservation; mortgage-principal bucket ordering.

**Commit:** `git add -A && git commit -m "v4.0.0-A -- property/unit/segment schema, property-centric engines, pooled proceeds routing, scaffold UI"`
Badge → v4.0.0-A. Journal entry. **Stop. Verify scenarios before Session B.**

---

## SESSION B — v4.0.0-B: full sidebar

Only after A is committed and verified. Rebuild the sidebar IA:

1. **Properties** (top) — three collapsible cards (6th / 15th / Barberry). Card =
   hold/sell (mode + year + quarter; primary hides 1031 options), then per-unit
   segment editors (port the existing 6th-St segment component; duplex shows 2 units),
   then the disposition block (appears when mode≠keep), then a per-property
   sale-proceeds summary. Cost-profile note shown per segment kind.
2. **One-Time Obligation** — below all properties (§4).
3. **Loans & Debt** — HI debts + generalized loan segments (v3.2), collapsible group.
4. **Cash-Flow Engine** — waterfall caps, lifestyle split, sweep settings, the pooled
   routing chain display (lifestyle draw / HI paydown % / remainder→waterfall).
5. **Economy** — appreciation, rent growth, CPI, invest return, tax toggle.

Remove all dead UI: "One-Time Decisions" block, 15th Top Unit selector, Lafayette
toggles, loose "Income & Cost Knobs", standalone STR Schedule block — all now inside
property cards. Verify no orphaned params remain in defaults.js.

**Commit:** `git add -A && git commit -m "v4.0.0-B -- property-centric sidebar: collapsible property cards, relocated obligation/loans/economy groups, dead-UI removal"`
Badge → v4.0.0. Journal entry.

---

## Open items (unchanged from prior sessions)

- CPA: Kimbell/Arrowsmith confirmation; recapture figures = tax or §1250 gain amounts;
  $1.2M CA-gain cap; Barberry↔Lafayette mapping; Form 3840 status.
- Mortgage IO calibration from servicer statements (6th $805,495 @ 4.875%; 15th
  $347,601 @ 4.35%; both origin ~Jul 2021, IO ends ~mid-2031).
