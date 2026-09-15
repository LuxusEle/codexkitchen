import { carcassParts, frontSpecs, hingePositions } from "./assembly.js";
import { SASH_PROFILE, HANDLE_PROFILE, doorBody } from "./sash-profile.js";
import { minimumCabinetWidth, TYPES } from './model.js';

export const STOCK_DEFAULTS = {
  barLength: 6400,
  sashLength: 6400,
  handleLength: 3000,
  barKerf: 3,
  endTrim: 10,
  sheetWidth: 2440,
  sheetHeight: 1220,
  sheetKerf: 4,
  sheetMargin: 10,
  rearSupportSpacing: 600,
  rearSupportAdjustment: 0,
  allowRotation: true,
};
export function stockSettings(p) {
  return { ...STOCK_DEFAULTS, ...p.fabrication };
}
export function stockErrors(s) {
  const errors = [];
  for (const key of Object.keys(STOCK_DEFAULTS).filter(
    (k) => !["allowRotation", "rearSupportAdjustment"].includes(k),
  ))
    if (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > 30000)
      errors.push(`Invalid stock setting: ${key}`);
  if (
    [s.barLength, s.sashLength, s.handleLength].some(
      (v) => v - 2 * s.endTrim - s.barKerf <= 0,
    )
  )
    errors.push("Bar stock must exceed trims and kerf.");
  if (s.rearSupportSpacing < 100 || s.rearSupportSpacing > 1200)
    errors.push(
      "Rear support spacing must be 100–1200 mm (engineering review required).",
    );
  if (!Number.isInteger(s.rearSupportAdjustment) || s.rearSupportAdjustment < -10 || s.rearSupportAdjustment > 20)
    errors.push("Rear upright adjustment must be a whole number from -10 to 20.");
  if (s.sheetWidth <= 2 * s.sheetMargin || s.sheetHeight <= 2 * s.sheetMargin)
    errors.push("Sheet must exceed edge margins.");
  return errors;
}
const groupBy = (items, key) => {
  const groups = new Map();
  for (const p of items) {
    const k = key(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  return groups;
};

// Port of CabinexMaster::Export.bars: best-fit decreasing, per-profile stock,
// one saw kerf per piece, trims at both ends. Oversized pieces never disappear.
export function nestBars(parts, s) {
  const stocks = [],
    rejected = [];
  for (const [key, group] of groupBy(parts, (p) =>
    [p.profile, p.finish, p.stockLength].join("|"),
  )) {
    for (const p of [...group].sort((a, b) => b.length - a.length)) {
      const capacity = p.stockLength - 2 * s.endTrim,
        need = p.length + s.barKerf;
      if (!Number.isFinite(need) || !Number.isFinite(capacity) || p.length <= 0 || need > capacity + 0.001) {
        rejected.push({ id: p.id, reason: "Bar exceeds usable stock length" });
        continue;
      }
      let stock = stocks
        .filter((b) => b.key === key && b.remaining + 0.001 >= need)
        .sort((a, b) => a.remaining - b.remaining)[0];
      if (!stock) {
        stock = {
          id: `BAR-${stocks.length + 1}`,
          key,
          profile: p.profile,
          finish: p.finish,
          length: p.stockLength,
          remaining: capacity,
          cuts: [],
        };
        stocks.push(stock);
      }
      stock.cuts.push({
        ...p,
        offset: p.stockLength - s.endTrim - stock.remaining,
      });
      stock.remaining -= need;
    }
  }
  return { stocks, rejected };
}

// Port of CabinexMaster::Export.sheets: material/thickness grouping, best-fit
// rectangular guillotine splitting with kerf, margins and grain-aware rotation.
export function nestSheets(parts, s) {
  const sheets = [],
    rejected = [];
  for (const [key, group] of groupBy(parts, (p) =>
    [p.material, p.finish, p.thickness].join("|"),
  )) {
    for (const p of [...group].sort(
      (a, b) => b.cutW * b.cutH - a.cutW * a.cutH,
    )) {
      const orientations = [[p.cutW, p.cutH, false]];
      if (s.allowRotation && p.grain === "none")
        orientations.push([p.cutH, p.cutW, true]);
      const options = orientations.filter(
        ([w, h]) =>
          w > 0 &&
          h > 0 &&
          w <= s.sheetWidth - 2 * s.sheetMargin &&
          h <= s.sheetHeight - 2 * s.sheetMargin,
      );
      if (!options.length) {
        rejected.push({
          id: p.id,
          reason: "Panel exceeds usable sheet / rotation setting",
        });
        continue;
      }
      let choice;
      for (const sheet of sheets.filter((b) => b.key === key))
        for (const [i, r] of sheet.free.entries())
          for (const [w, h, rotated] of options) {
            if (w <= r.w + 0.001 && h <= r.h + 0.001) {
              const score = r.w * r.h - w * h;
              if (!choice || score < choice.score)
                choice = { sheet, i, w, h, rotated, score };
            }
          }
      if (!choice) {
        const sheet = {
          id: `SHEET-${sheets.length + 1}`,
          key,
          material: p.material,
          finish: p.finish,
          thickness: p.thickness,
          width: s.sheetWidth,
          height: s.sheetHeight,
          free: [
            {
              x: s.sheetMargin,
              y: s.sheetMargin,
              w: s.sheetWidth - 2 * s.sheetMargin,
              h: s.sheetHeight - 2 * s.sheetMargin,
            },
          ],
          placements: [],
        };
        sheets.push(sheet);
        const [w, h, rotated] = options[0];
        choice = { sheet, i: 0, w, h, rotated };
      }
      const { sheet, i, w, h, rotated } = choice,
        r = sheet.free.splice(i, 1)[0];
      sheet.placements.push({ ...p, x: r.x, y: r.y, w, h, rotated });
      if (r.w - w > s.sheetKerf)
        sheet.free.push({
          x: r.x + w + s.sheetKerf,
          y: r.y,
          w: r.w - w - s.sheetKerf,
          h,
        });
      if (r.h - h > s.sheetKerf)
        sheet.free.push({
          x: r.x,
          y: r.y + h + s.sheetKerf,
          w: r.w,
          h: r.h - h - s.sheetKerf,
        });
    }
  }
  return { sheets, rejected };
}

export function fabricationPlan(p, plan) {
  const settings = stockSettings(p),
    configurationErrors=stockErrors(settings),
    errors = [...configurationErrors, ...plan.errors],
    bars = [],
    panels = [],
    hardware = [],
    warnings = [
      "Engineering review only — not approved machine instructions or a final purchasing BOM.",
      "Hardware part numbers, hinge loading, connectors, screws, wall fixings, seals and drilling templates need approval. No generic cup holes are applied to hollow sash.",
      "U-cuts clear actual front uprights by 1 mm per edge. Horizontal liners butt against the rear ACP, clear of turned rear posts. Rectangular blank nesting is conservative; column cutouts and machine postprocessors remain unported.",
      "Worktops, appliance internals and drawer-box fabrication are excluded from sheet nesting. Drawer/pullout systems are listed as purchased assemblies.",
      "Rotation assumes non-directional finishes. Disable rotation for directional material; confirm grain datum before cutting.",
      "Rails over 6377 mm are segmented in the web model; splice positions and connection details require review.",
      "Rear uprights use an independent support grid, not a copy of front divisions. Default 600 mm spacing is a review assumption, not a structural rating.",
      "Integrated handle: 32 mm rise reserved inside the leaf opening; sash body ends 45 degrees, grip lip ends square. Confirm the source-specific machining sequence.",
      "The complex web sash is retained. Its combination with the copied combined-engine grip is an engineering adaptation, not an approved off-the-shelf extrusion.",
    ];
  const units=plan.units.filter(u=>{
    const valid=TYPES[u.type]&&[u.x,u.z,u.w,u.h,u.d].every(Number.isFinite)&&u.w>=minimumCabinetWidth(u)&&u.w<=1600&&u.h>=100&&u.d>=100&&(['A','B','C','D'].includes(u.wall)||(u.wall==='Island'&&[u.ix,u.iy].every(Number.isFinite)));
    if(!valid)errors.push(`${u.id}: invalid cabinet excluded from nesting preview.`);
    return valid;
  });
  for (const part of carcassParts(p, units)) {
    if (part.kind === "bar")
      bars.push({
        ...part,
        finish: p.style.frame,
        stockLength: part.profile===SASH_PROFILE.id?settings.sashLength:settings.barLength,
        miterStart: part.miterStart??0,
        miterEnd: part.miterEnd??0,
      });
    else
      panels.push({
        ...part,
        finish: part.material === "Front ACP" ? p.style.front : "#dce2da",
        grain: settings.allowRotation ? "none" : "u",
      });
  }
  for (const u of units) {
    for (const f of frontSpecs(u)) {
      const body = doorBody(f);
      if (f.w <=90 || body.height <=90) {
        errors.push(`${f.id}: front too small for sash + handle profile`);
        continue;
      }
      for (const [end, length] of [
        ["BOT", f.w],
        ["TOP", f.w],
        ["LFT", body.height],
        ["RHT", body.height],
      ]) {
        const handle = end === (f.handleSide === "top" ? "TOP" : "BOT");
        bars.push({
          id: `${f.id}-${end}`,
          name: handle
            ? `Integrated ${f.handleSide} handle bar`
            : `Sash ${end}`,
          unitIds: [u.id],
          profile: handle ? HANDLE_PROFILE.id : SASH_PROFILE.id,
          length,
          finish: p.style.frame,
          stockLength: handle ? settings.handleLength : settings.sashLength,
          miterStart: 45,
          miterEnd: 45,
          endDetail: handle
            ? "Sash body mitred 45/45; grip lip square full width"
            : "Mitred 45/45",
        });
      }
      panels.push({
        id: `${f.id}-INFILL`,
        name: "Channel-seated infill",
        unitIds: [u.id],
        material: f.glass ? "Glass" : "Front ACP",
        finish: f.color || (f.glass ? "clear" : p.style.front),
        cutW: f.w - 20,
        cutH: body.height - 20,
        thickness: 3,
        grain: settings.allowRotation ? "none" : "u",
      });
      const positions = hingePositions(f);
      if (positions.length)
        hardware.push({
          id: `${f.id}-HINGES`,
          unitId: u.id,
          item: "Sash hinge + matching insert",
          qty: positions.length,
          unit: "sets",
          status: "Source preview quantity; confirm rated load",
          positions,
        });
      if (f.kind === "lift")
        hardware.push({
          id: `${f.id}-LIFT`,
          unitId: u.id,
          item: "Lift mechanism",
          qty: 1,
          unit: "sets",
          status: "Select rated mechanism",
        });
      if (f.kind === "drawer")
        hardware.push({
          id: `${f.id}-DRAWER`,
          unitId: u.id,
          item:
            u.type === "drawers"
              ? "Drawer box + runner pair"
              : `${u.type} pullout assembly`,
          qty: 1,
          unit: "sets",
          status: "Purchased assembly; select product",
        });
    }
  }
  if (plan.unmet.length) errors.push("Kitchen requirements remain unplaced.");
  const barNest = configurationErrors.length
    ? { stocks: [], rejected: [] }
    : nestBars(bars, settings);
  const sheetNest = configurationErrors.length
    ? { sheets: [], rejected: [] }
    : nestSheets(panels, settings);
  const rejected = [...barNest.rejected, ...sheetNest.rejected];
  const bom = [];
  for (const [item, list] of groupBy(barNest.stocks, (p) =>
    [p.profile, p.finish, p.length].join(" / "),
  ))
    bom.push({
      item,
      category: "Bar stock",
      quantity: list.length,
      unit: "bars",
    });
  for (const [item, list] of groupBy(sheetNest.sheets, (p) =>
    [
      p.material,
      p.finish,
      `${p.thickness} mm`,
      `${p.width} x ${p.height}`,
    ].join(" / "),
  ))
    bom.push({
      item,
      category: "Sheet stock",
      quantity: list.length,
      unit: "sheets",
    });
  for (const [item, list] of groupBy(hardware, (p) => p.item))
    bom.push({
      item,
      category: "Hardware — provisional",
      quantity: list.reduce((n, p) => n + p.qty, 0),
      unit: list[0].unit,
    });
  return {
    status: "ENGINEERING_REVIEW_NOT_MACHINE_RELEASE",
    settings,
    bars,
    panels,
    hardware,
    bom,
    barNest,
    sheetNest,
    rejected,
    errors,
    warnings,
  };
}

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const round = (n) => Math.round(n * 100) / 100;
export function placedOutline(p) {
  const points = p.outline || [
    [0, 0],
    [p.cutW, 0],
    [p.cutW, p.cutH],
    [0, p.cutH],
  ];
  return points.map(([x, y]) =>
    p.rotated ? [p.x + y, p.y + p.cutW - x] : [p.x + x, p.y + y],
  );
}
export function sheetSVG(sheet) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheet.width} ${sheet.height}" role="img" aria-label="${esc(sheet.id)}"><rect width="${sheet.width}" height="${sheet.height}" fill="#edf1ed" stroke="#526b6a" stroke-width="3"/>${sheet.placements
    .map(
      (p) =>
        `<g><title>${esc(p.id)}: ${round(p.w)} x ${round(p.h)} mm${p.rotated ? " rotated" : ""}</title><polygon points="${placedOutline(
          p,
        )
          .map((v) => v.join(","))
          .join(
            " ",
          )}" fill="#b9d3d1" stroke="#245359" stroke-width="2"/><text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" font-family="Arial" font-size="${Math.max(8, Math.min(22, (p.w / Math.max(1, p.id.length)) * 1.4, p.h * 0.4))}" text-anchor="middle" fill="#163d43">${esc(p.id)}</text></g>`,
    )
    .join("")}</svg>`;
}
export function barSVG(stock) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stock.length} 180" role="img" aria-label="${esc(stock.id)}"><rect width="${stock.length}" height="180" fill="#e1e6e2"/>${stock.cuts.map((p) => `<g><title>${esc(p.id)}: ${round(p.length)} mm, ${p.miterStart}/${p.miterEnd} degrees</title><rect x="${p.offset}" width="${p.length}" height="180" fill="#77a6a5" stroke="#fff" stroke-width="3"/><text x="${p.offset + p.length / 2}" y="100" font-family="Arial" font-size="${Math.min(55, (p.length / Math.max(1, p.id.length)) * 1.5)}" text-anchor="middle">${esc(p.id)}</text></g>`).join("")}</svg>`;
}
function csv(headers, rows) {
  return [headers, ...rows]
    .map((r) =>
      r
        .map((v) => {
          let s = String(v ?? "");
          if (/^[=+@-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
export function fabricationFiles(job) {
  const files = {
    "fabrication-review.json": JSON.stringify(job, null, 2),
    "bom-review.csv": csv(
      ["Category", "Item", "Quantity", "Unit"],
      job.bom.map((p) => [p.category, p.item, p.quantity, p.unit]),
    ),
    "bar-cuts.csv": csv(
      [
        "ID",
        "Cabinets",
        "Profile",
        "Length_mm",
        "Start_miter_deg",
        "End_miter_deg",
        "Stock_mm",
        "End_detail",
      ],
      job.bars.map((p) => [
        p.id,
        p.unitIds.join(" "),
        p.profile,
        round(p.length),
        p.miterStart,
        p.miterEnd,
        p.stockLength,
        p.endDetail || "Square cut",
      ]),
    ),
    "panel-cuts.csv": csv(
      [
        "ID",
        "Cabinets",
        "Material",
        "Finish",
        "Width_mm",
        "Height_mm",
        "Thickness_mm",
      ],
      job.panels.map((p) => [
        p.id,
        p.unitIds.join(" "),
        p.material,
        p.finish,
        round(p.cutW),
        round(p.cutH),
        p.thickness,
      ]),
    ),
    "hardware-review.csv": csv(
      ["ID", "Cabinet", "Item", "Quantity", "Unit", "Status"],
      job.hardware.map((p) => [
        p.id,
        p.unitId,
        p.item,
        p.qty,
        p.unit,
        p.status,
      ]),
    ),
    "READ-ME.txt": [
      job.status,
      ...job.errors,
      ...job.rejected.map((r) => `${r.id}: ${r.reason}`),
      ...job.warnings,
    ].join("\n\n"),
  };
  for (const sheet of job.sheetNest.sheets)
    files[`${sheet.id}-review.svg`] = sheetSVG(sheet);
  for (const stock of job.barNest.stocks)
    files[`${stock.id}-review.svg`] = barSVG(stock);
  return files;
}
