import {surfaceTakeoff} from "./surface-takeoff.js";
import { countertopPieces } from "./construction.js";
import {RATE_DEFAULTS} from './business.js';
import {materialPricingSettings, supplierBarRate, MATERIAL_FINISHES, MATERIAL_SUPPLIERS, MATERIAL_PRICE_DATE} from './material-prices.js';

export const LKR_COST_DEFAULTS = {
  base: 15500,
  upper: 15500,
  tall: 15000,
  granite: 3000,
  splash: 1250,
  led: 1260,
  services: 35000,
};

const FT = 304.8;
const SQFT = 92903.04;
const round = (n, places = 2) => {
  const k = 10 ** places;
  return Math.round((Number(n) || 0) * k) / k;
};
const keyFor = (line) =>
  `${line.category}|${line.item}|${line.unit}`.replace(/[^a-z0-9|._-]+/gi, "_");

function unionLength(intervals) {
  const sorted = intervals
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    active = null;
  for (const item of sorted) {
    if (!active || item[0] > active[1]) {
      if (active) total += active[1] - active[0];
      active = [...item];
    } else active[1] = Math.max(active[1], item[1]);
  }
  return total + (active ? active[1] - active[0] : 0);
}

function runLength(units, predicate, includeIsland = true) {
  let mm = 0;
  for (const wall of ["A", "B", "C", "D"])
    mm += unionLength(
      units
        .filter((u) => u.wall === wall && predicate(u))
        .map((u) => [u.x, u.x + u.w]),
    );
  if (includeIsland)
    mm += units
      .filter((u) => u.wall === "Island" && predicate(u))
      .reduce((sum, u) => sum + u.w, 0);
  return mm;
}

export function costingSettings(p) {
  return {
    salesRates: { ...RATE_DEFAULTS, ...p.businessProfile?.salesRates, ...p.costing?.salesRates },
    salesQuantities: { ...p.costing?.salesQuantities },
    bomRates: { ...p.costing?.bomRates },
    bomQuantities: { ...p.costing?.bomQuantities },
    extras: Array.isArray(p.costing?.extras) ? p.costing.extras : [],
    materialPricing: materialPricingSettings(p),
  };
}

function defaultBomRate(line, job, materialPricing) {
  if (line.category === "Bar stock") {
    return supplierBarRate(line, job, materialPricing);
  }
  if (line.category === "Sheet stock") {
    const size = line.item.match(/([\d.]+)\s*x\s*([\d.]+)\s*$/i);
    const area = size ? (Number(size[1]) * Number(size[2])) / 1e6 : 2.9768;
    if (/glass/i.test(line.item)) return {rate:round(area * 7070, 0),status:'provisional',source:'Sri Lanka glass allowance'};
    // BOM quantity is already complete sheets. The provisional LKR 26,500
    // rate is per 2440 x 1220 sheet, not per square metre.
    if (/ACP/i.test(line.item)) return {rate:26500,status:'provisional',source:'Editable ACP sheet allowance'};
  }
  if (/hinge/i.test(line.item)) return {rate:1000,status:'provisional',source:'Editable hardware allowance'};
  if (/drawer|pullout/i.test(line.item)) return {rate:10000,status:'provisional',source:'Editable hardware allowance'};
  if (/lift/i.test(line.item)) return {rate:15000,status:'provisional',source:'Editable hardware allowance'};
  return {rate:0,status:'unpriced',source:'Supplier quotation required'};
}

export function kitchenEstimate(p, plan, job) {
  const cfg = costingSettings(p),
    units = plan.units,
    baseMm = runLength(
      units,
      (u) => u.z < 900 && u.h < 1000 && u.type !== "filler",
    ),
    wallBaseMm = runLength(
      units,
      (u) => u.z < 900 && u.h < 1000 && u.type !== "filler",
      false,
    ),
    upperMm = runLength(units, (u) => u.z >= 900 && u.type !== "filler"),
    tallHeightMm = units
      .filter((u) => ["pantry", "oven"].includes(u.type))
      .reduce((sum, u) => sum + u.h, 0),
    graniteSqft = countertopPieces(p, units).reduce(
      (sum, piece) => sum + (piece.w * piece.d) / SQFT,
      0,
    );

  const surfaces=surfaceTakeoff(p,units);
  const formula=p.businessProfile?.formula||{},baseArea=units.filter(u=>u.z<900&&u.h<1000&&u.type!=='filler').reduce((sum,u)=>sum+u.w*u.h/SQFT,0),upperArea=units.filter(u=>u.z>=900&&u.type!=='filler').reduce((sum,u)=>sum+u.w*u.h/SQFT,0),tallWidth=units.filter(u=>['pantry','oven'].includes(u.type)).reduce((sum,u)=>sum+u.w/FT,0);
  const definitions = [
    ["base", "Bottom cabinets", formula.base==='front_sqft'?baseArea:baseMm/FT, formula.base==='front_sqft'?'sq ft':'lin ft', formula.base==='front_sqft'?'external cabinet front area':'cabinet run'],
    ["upper", "Top cabinets", formula.upper==='front_sqft'?upperArea:upperMm/FT, formula.upper==='front_sqft'?'sq ft':'lin ft', formula.upper==='front_sqft'?'external cabinet front area':'cabinet run'],
    ["tall", formula.tall==='width_ft'?'Tall units by width':'Tall units by height', formula.tall==='width_ft'?tallWidth:tallHeightMm/FT, formula.tall==='width_ft'?'lin ft':'vertical ft', formula.tall==='width_ft'?'sum of oven / pantry widths':'sum of oven / pantry heights'],
    ["granite", "Granite worktop", p.surfaces?.graniteBasis==='gross'?surfaces.graniteGrossSqft:graniteSqft, "sq ft", p.surfaces?.graniteBasis==='gross'?"gross top before sink cutout":"finished top area"],
    ["splash", "Wall splashback", surfaces.configured?surfaces.backsplashSqft:wallBaseMm / FT, surfaces.configured?"sq ft":"lin ft", surfaces.configured?"configured tile bands less recorded openings":"wall-side bottom run"],
    ["led", "LED under top cabinets", upperMm / FT, "lin ft", "top cabinet run"],
    ["services", "Plumbing + wiring", 1, "job", "fixed allowance"],
  ];
  const sales = definitions.map(([key, item, calculated, unit, basis]) => {
    const quantity = Number.isFinite(cfg.salesQuantities[key])
      ? cfg.salesQuantities[key]
      : round(calculated);
    const rate = Number(cfg.salesRates[key]) || 0;
    return { key, item, basis, quantity, unit, rate, total: round(quantity * rate) };
  });
  for (const extra of cfg.extras) {
    const quantity = Number(extra.quantity) || 0,
      rate = Number(extra.rate) || 0;
    sales.push({
      key: extra.id,
      item: extra.item || "Other",
      basis: "editable additional item",
      quantity,
      unit: extra.unit || "job",
      rate,
      total: round(quantity * rate),
      extra: true,
    });
  }

  const purchasing = job.bom.map((line) => {
    const key = keyFor(line),
      quantity = Number.isFinite(cfg.bomQuantities[key])
        ? cfg.bomQuantities[key]
        : Number(line.quantity) || 0;
    const automatic = defaultBomRate(line, job, cfg.materialPricing);
    const manual = Number.isFinite(cfg.bomRates[key]);
    const rate = manual ? cfg.bomRates[key] : automatic.rate;
    return {
      ...line, key, quantity, rate, total: round(quantity * rate),
      rateStatus: manual ? "manual" : automatic.status,
      rateSource: manual ? "Manual project rate" : automatic.source,
      rateWarning: manual ? "" : automatic.warning,
    };
  });
  const supplier = MATERIAL_SUPPLIERS[cfg.materialPricing.supplier];
  const finish = MATERIAL_FINISHES[cfg.materialPricing.finish];
  return {
    sales,
    purchasing,
    salesTotal: round(sales.reduce((sum, line) => sum + line.total, 0)),
    purchasingTotal: round(purchasing.reduce((sum, line) => sum + line.total, 0)),
    sourceNote:
      `Selling rates supplied for UAT. Aluminum reference: ${supplier.name} registered-dealer price list effective ${MATERIAL_PRICE_DATE}, ${finish} (${cfg.materialPricing.finish}), taxes as stated in that list. The matching ${supplier.frame.code} 1 1/2 x 1 in tube is published at ${supplier.frame.listedWall} mm, so the app's 1.2 mm frame rate is a visible thickness/length estimate, not a supplier quotation. Sash, handle, ACP, glass and hardware allowances remain provisional and editable. Confirm current stock, profile codes and quotations before ordering.`,
    materialPricing: cfg.materialPricing,
  };
}

export function updateCosting(p, patch) {
  return { ...costingSettings(p), ...patch };
}
