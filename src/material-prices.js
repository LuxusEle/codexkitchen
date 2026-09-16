export const MATERIAL_PRICE_DATE = "2026-04-01";

export const MATERIAL_FINISHES = {
  NA: "Natural anodised",
  PC: "Powder coated",
  MF: "Mill finish",
  BR: "Bronze anodised",
  CG: "CG finish",
  WF: "Wood finish",
};

// Registered-dealer price lists supplied by the user. Prices include the taxes
// stated on each list and are per full bar. Keep the supplier code and listed
// wall thickness visible when the designed profile is thicker than the list.
export const MATERIAL_SUPPLIERS = {
  alumex: {
    name: "Alumex",
    source: "Alumex Price List 01.04.2026_Final.pdf",
    finishes: ["PC", "NA", "MF", "BR", "CG", "WF"],
    frame: {
      code: "P-1115T",
      dimensions: "38.1 x 25.4 mm (1 1/2 x 1 in)",
      listedWall: 0.9,
      listedLength: 6100,
      prices: { BR: 6923, NA: 6720, PC: 7285, MF: 5823, CG: 7767, WF: 10684 },
    },
  },
  alco: {
    name: "Alco",
    source: "Alco Branded Price List - 01.04.2026.pdf",
    finishes: ["PC", "NA", "MF", "BR", "WF"],
    frame: {
      code: "RT-11/2X1",
      dimensions: "38.1 x 25.4 mm (1 1/2 x 1 in)",
      listedWall: 0.9,
      listedLength: 6100,
      prices: { BR: 6923, NA: 6720, PC: 7285, MF: 5823, WF: 10684 },
    },
  },
};

export const MATERIAL_PRICING_DEFAULTS = { supplier: "alumex", finish: "PC" };

export function materialPricingSettings(project) {
  const raw = project.costing?.materialPricing || {};
  const supplier = MATERIAL_SUPPLIERS[raw.supplier] ? raw.supplier : MATERIAL_PRICING_DEFAULTS.supplier;
  const allowed = MATERIAL_SUPPLIERS[supplier].finishes;
  return { supplier, finish: allowed.includes(raw.finish) ? raw.finish : MATERIAL_PRICING_DEFAULTS.finish };
}

const stockLength = (line, fallback) => Number(line.item.match(/\/\s*([\d.]+)\s*$/)?.[1]) || fallback;

export function supplierBarRate(line, job, pricing) {
  const supplier = MATERIAL_SUPPLIERS[pricing.supplier] || MATERIAL_SUPPLIERS.alumex;
  const finish = supplier.finishes.includes(pricing.finish) ? pricing.finish : "PC";
  const length = stockLength(line, job.settings.barLength);
  if (line.item.includes("BOX_25.4x38.1x1.2")) {
    const listed = supplier.frame.prices[finish];
    const lengthSurcharge = Math.abs(length - supplier.frame.listedLength) > 0.1 ? 1.06 : 1;
    return {
      rate: Math.round(listed * (1.2 / supplier.frame.listedWall) * (length / supplier.frame.listedLength) * lengthSurcharge),
      status: "estimated",
      source: `${supplier.name} ${supplier.frame.code} ${finish}: ${supplier.frame.listedWall} mm / ${supplier.frame.listedLength} mm listed at LKR ${listed.toLocaleString("en-LK")}`,
      warning: `The BOM specifies 1.2 mm and ${length} mm stock. Rate is scaled by thickness and length${lengthSurcharge > 1 ? " plus the listed 6% non-standard-length allowance" : ""}; obtain a supplier quotation before ordering.`,
    };
  }
  return {
    rate: Math.round((length / 1000) * 1130.69),
    status: "provisional",
    source: "Legacy Sri Lanka per-metre allowance",
    warning: "No approved supplier profile-code match for this sash/handle extrusion.",
  };
}
