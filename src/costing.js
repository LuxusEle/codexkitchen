import { countertopPieces } from "./construction.js";

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
    salesRates: { ...LKR_COST_DEFAULTS, ...p.costing?.salesRates },
    salesQuantities: { ...p.costing?.salesQuantities },
    bomRates: { ...p.costing?.bomRates },
    bomQuantities: { ...p.costing?.bomQuantities },
    extras: Array.isArray(p.costing?.extras) ? p.costing.extras : [],
  };
}

function defaultBomRate(line, job) {
  if (line.category === "Bar stock") {
    // 2026 Central Province BSR: 1 1/2 in square anodized 1.2 mm box bar
    // LKR 1,130.69/m. Applied as a transparent proxy to all profiles until a
    // supplier quote is entered; the actual stock length is read from the BOM.
    const length = Number(line.item.match(/\/\s*([\d.]+)\s*$/)?.[1]) ||
      (line.item.includes("HANDLE") ? job.settings.handleLength :
        line.item.includes("SASH") ? job.settings.sashLength : job.settings.barLength);
    return round((length / 1000) * 1130.69, 0);
  }
  if (line.category === "Sheet stock") {
    const size = line.item.match(/([\d.]+)\s*x\s*([\d.]+)\s*$/i);
    const area = size ? (Number(size[1]) * Number(size[2])) / 1e6 : 2.9768;
    if (/glass/i.test(line.item)) return round(area * 7070, 0);
    // BOM quantity is already complete sheets. The provisional LKR 26,500
    // rate is per 2440 x 1220 sheet, not per square metre.
    if (/ACP/i.test(line.item)) return 26500;
  }
  if (/hinge/i.test(line.item)) return 1000;
  if (/drawer|pullout/i.test(line.item)) return 10000;
  if (/lift/i.test(line.item)) return 15000;
  return 0;
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

  const definitions = [
    ["base", "Bottom cabinet run", baseMm / FT, "lin ft", "cabinet run"],
    ["upper", "Top cabinet run", upperMm / FT, "lin ft", "cabinet run"],
    ["tall", "Tall units by height", tallHeightMm / FT, "vertical ft", "sum of oven / pantry heights"],
    ["granite", "Granite worktop", graniteSqft, "sq ft", "finished top area"],
    ["splash", "Wall splashback", wallBaseMm / FT, "lin ft", "wall-side bottom run"],
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
        : Number(line.quantity) || 0,
      rate = Number.isFinite(cfg.bomRates[key])
        ? cfg.bomRates[key]
        : defaultBomRate(line, job);
    return { ...line, key, quantity, rate, total: round(quantity * rate) };
  });
  return {
    sales,
    purchasing,
    salesTotal: round(sales.reduce((sum, line) => sum + line.total, 0)),
    purchasingTotal: round(purchasing.reduce((sum, line) => sum + line.total, 0)),
    sourceNote:
      "Selling rates supplied for UAT. BOM defaults are editable Sri Lanka reference proxies: LKR 1,130.69/m for 1.5 in anodized box bar; LKR 26,500 per 2440 x 1220 3 mm ACP sheet; LKR 7,070/m² for 3 mm clear glass. Obtain supplier quotations before ordering.",
  };
}

export function updateCosting(p, patch) {
  return { ...costingSettings(p), ...patch };
}
