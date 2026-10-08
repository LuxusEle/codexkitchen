import { carcassParts, frontSpecs, hingePositions } from "./assembly.js";
import { SASH_PROFILE, HANDLE_PROFILE, doorBody } from "./sash-profile.js";
import { minimumCabinetWidth, TYPES, islandSettings } from './model.js';

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
      const hingeSpots = hingePositions(f);
      const hingeStile = hingeSpots.length
        ? f.hand === "right"
          ? "RHT"
          : "LFT"
        : null;
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
          ...(end === hingeStile
            ? {
                hingeInserts: hingeSpots.map(
                  (z) => Math.round((z - body.y) * 10) / 10,
                ),
                hingeRecipe: "sash-hinge-template",
                hingeNote:
                  "Sash hinge + matching insert; hollow profile — no generic ø35 board cup",
              }
            : {}),
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
      if (hingeSpots.length)
        hardware.push({
          id: `${f.id}-HINGES`,
          unitId: u.id,
          item: "Sash hinge + matching insert",
          qty: hingeSpots.length,
          unit: "sets",
          bar: `${f.id}-${hingeStile}`,
          status: "Source preview quantity; confirm rated load",
          positions: hingeSpots,
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
              u.type === "drawers" || u.frontLayout==='drawers'
                ? "Drawer box + runner pair"
                : `${u.type} pullout assembly`,
            qty: 1,
            unit: "sets",
            status: "Purchased assembly; select product",
          });
      }
      }
      const islandCfg = islandSettings(p);
      if (p.island && islandCfg.kind === 'breakfast' && islandCfg.pendants > 0) {
      hardware.push({
        id: 'PENDANTS',
        unitId: 'BREAKFAST_BAR',
        item: 'Warm glass pendant light',
        qty: islandCfg.pendants,
        unit: 'lights',
        status: 'Purchased fitting; select product and hanging height',
      });
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
  if (p.island) {
    const ic = islandSettings(p);
    if (ic.kind === 'breakfast') {
      bom.push({
        item: 'Timber slat panel / 2440 x 1220 mm',
        category: 'Sheet stock',
        quantity: 1,
        unit: 'sheets',
      });
    }
  }
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
// Distinct, printable colours shared by every drawing and the DXF so one
// cabinet keeps the same colour across bars, sheets and reports.
const PART_COLORS = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948",
  "#b07aa1", "#ff9da7", "#9c755f", "#86bc86", "#d37295", "#a0cbe8",
  "#ffbe7d", "#8cd17d", "#f1ce63", "#d4a6c8", "#bab0ac", "#b6992d",
  "#79706e", "#e8a5a5",
];
const colorKey = (part) =>
  String((part.unitIds && part.unitIds[0]) || part.id || "?");
export function partColor(part) {
  let h = 5381;
  const s = colorKey(part);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return PART_COLORS[h % PART_COLORS.length];
}
const halo = (w) => `paint-order:stroke;stroke:#ffffff;stroke-width:${round(Math.max(2, w))}px;stroke-linejoin:round`;
function legendRow(parts, y, fs) {
  const size = fs * 1.05;
  const groups = new Map();
  for (const p of parts) {
    const key = colorKey(p);
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  let x = fs * 0.8;
  const cells = [];
  for (const [key, n] of groups) {
    const color = partColor({ unitIds: [key] });
    const text = `${esc(key)} ×${n}`;
    cells.push(
      `<rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" rx="${round(size * 0.2)}" fill="${color}" stroke="#31484d" stroke-width="${round(Math.max(1, size * 0.07))}"/>` +
        `<text x="${round(x + size * 1.3)}" y="${round(y + size * 0.82)}" font-family="Arial" font-size="${round(fs)}" font-weight="600" fill="#16303a">${text}</text>`,
    );
    x += size * 1.3 + text.length * fs * 0.56 + fs * 1.6;
  }
  return `<g class="legend">${cells.join("")}</g>`;
}
export function sheetSVG(sheet) {
  const W = sheet.width;
  const fs = Math.max(16, W / 34);
  const legendH = fs * 2.1;
  const strokeW = Math.max(2, W / 400);
  const drawn = sheet.placements
    .map((p) => {
      const cx = p.x + p.w / 2,
        cy = p.y + p.h / 2,
        size = Math.max(
          fs * 0.55,
          Math.min(W / 30, p.w / Math.max(1, p.id.length * 0.62), p.h * 0.5),
        );
      return `<g><title>${esc(p.id)} · ${esc(p.name || "")} · ${round(p.cutW)} × ${round(p.cutH)} mm · ${esc((p.unitIds || []).join(" "))}${p.rotated ? " · rotated" : ""}</title><polygon points="${placedOutline(p)
        .map((v) => v.join(","))
        .join(" ")}" fill="${partColor(p)}" stroke="#123d43" stroke-width="${round(strokeW)}"/><text x="${round(cx)}" y="${round(cy + size * 0.35)}" font-family="Arial" font-size="${round(size)}" font-weight="600" text-anchor="middle" fill="#10262b" style="${halo(size * 0.18)}">${esc(p.id)}</text></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${round(sheet.height + legendH)}" role="img" aria-label="${esc(sheet.id)}"><rect width="${W}" height="${sheet.height}" fill="#edf1ed" stroke="#526b6a" stroke-width="${round(strokeW * 1.5)}"/>${drawn}${legendRow(sheet.placements, sheet.height + fs * 0.35, fs * 0.8)}</svg>`;
}
export function barSVG(stock) {
  const L = stock.length;
  const H = Math.max(170, Math.min(460, L / 7));
  const TOP = H * 0.18,
    BOT = TOP + H,
    VIEWH = BOT + H * 0.72;
  const strokeW = Math.max(2, L / 900);
  const piece = (p) => {
    const x0 = p.offset,
      x1 = p.offset + p.length,
      pw = p.length;
    const dxS = p.miterStart
        ? Math.min(pw * 0.35, H * Math.tan((p.miterStart * Math.PI) / 180))
        : 0,
      dxE = p.miterEnd
        ? Math.min(pw * 0.35, H * Math.tan((p.miterEnd * Math.PI) / 180))
        : 0;
    const pts = [
      [x0 + dxS, TOP],
      [x1 - dxE, TOP],
      [x1, BOT],
      [x0, BOT],
    ]
      .map((v) => v.map(round).join(","))
      .join(" ");
    const idSize = Math.min(H * 0.34, pw / Math.max(1, p.id.length * 0.62), H * 0.5);
    const id = idSize >= H * 0.09
      ? `<text x="${round((x0 + x1) / 2)}" y="${round(TOP + H * 0.46)}" font-family="Arial" font-size="${round(idSize)}" font-weight="700" text-anchor="middle" fill="#10262b" style="${halo(idSize * 0.16)}">${esc(p.id)}</text>`
      : "";
    const lenFs = H * 0.155;
    const len = pw >= idSize * 4
      ? `<text x="${round((x0 + x1) / 2)}" y="${round(TOP + H * 0.79)}" font-family="Arial" font-size="${round(lenFs)}" font-weight="600" text-anchor="middle" fill="#16303a" style="${halo(lenFs * 0.16)}">${round(p.length)}</text>`
      : "";
    // Angle labels sit inside each end's mitre notch — the void above the
    // sloped cut — in the clear strip just under the top edge, above the big
    // piece-id text, and are painted last so nothing can cover them. Every
    // mitred end with room carries its angle beside the cut it describes
    // (title tooltip and bar-cuts.csv always carry it regardless).
    const mitFs = H * 0.115;
    const mitLabelW = mitFs * 1.75;
    const mitFrac = 0.13;
    const mitLabelY = TOP + H * mitFrac;
    const notchLabel = (dx, angle, ax, dir) => {
      if (!angle || dx * (1 - mitFrac) < mitLabelW * 1.2) return "";
      const lx = dir > 0 ? ax + (dx * (1 - mitFrac)) / 2 : ax - (dx * (1 - mitFrac)) / 2;
      return `<text x="${round(lx)}" y="${round(mitLabelY)}" font-family="Arial" font-size="${round(mitFs)}" font-weight="600" text-anchor="middle" fill="#8a3524" style="${halo(mitFs * 0.16)}">${angle}°</text>`;
    };
    const mitres = [
      notchLabel(dxS, p.miterStart, x0, 1),
      notchLabel(dxE, p.miterEnd, x1, -1),
    ].join("");
    const hingeMarks = (p.hingeInserts || [])
      .map((s) => {
        const hx = x0 + s,
          mw = Math.max(1.4, strokeW * 0.7);
        return `<g class="hinge"><line x1="${round(hx)}" y1="${round(TOP)}" x2="${round(hx)}" y2="${round(BOT)}" stroke="#8a3524" stroke-width="${round(mw)}" stroke-dasharray="${round(Math.max(5, strokeW * 3))} ${round(Math.max(4, strokeW * 2))}"/><circle cx="${round(hx)}" cy="${round(TOP + H * 0.74)}" r="${round(Math.max(4, H * 0.085))}" fill="none" stroke="#8a3524" stroke-width="${round(mw)}"/><title>Sash hinge + insert @ ${round(s)} from this end</title></g>`;
      })
      .join("");
    return `<g><title>${esc(p.id)} · ${esc(p.name || "")} · ${round(p.length)} mm · ${p.miterStart}/${p.miterEnd}° · ${esc((p.unitIds || []).join(" "))}${p.hingeInserts?.length ? ` · sash hinge insert ×${p.hingeInserts.length} (${round(p.hingeInserts[0])} from each end)` : ""}</title><polygon points="${pts}" fill="${partColor(p)}" stroke="#123f45" stroke-width="${round(strokeW)}"/>${hingeMarks}${id}${len}${mitres}</g>`;
  };
  const cuts = [...stock.cuts];
  const lastEnd = cuts.length
    ? Math.max(...cuts.map((c) => c.offset + c.length))
    : 0;
  const leftover = L - lastEnd;
  const leftoverRect =
    leftover > 1
      ? `<g><rect x="${round(lastEnd)}" y="${round(TOP)}" width="${round(leftover)}" height="${round(H)}" fill="#f7faf7" stroke="#9fb3ac" stroke-width="${round(strokeW * 0.6)}" stroke-dasharray="${round(strokeW * 3)} ${round(strokeW * 2)}"/>${
          leftover > H * 1.8
            ? `<text x="${round(lastEnd + leftover / 2)}" y="${round(TOP + H * 0.56)}" font-family="Arial" font-size="${round(H * 0.15)}" font-weight="600" text-anchor="middle" fill="#6d8382">leftover ${round(leftover)}</text>`
            : ""
        }</g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${round(VIEWH)}" role="img" aria-label="${esc(stock.id)}"><rect width="${L}" height="${round(VIEWH)}" fill="#fbfdfb"/><rect x="0" y="${round(TOP)}" width="${L}" height="${round(H)}" fill="#e1e6e2"/><text x="${round(L * 0.004)}" y="${round(H * 0.13)}" font-family="Arial" font-size="${round(H * 0.15)}" font-weight="700" fill="#31565c">${esc(stock.id)} · ${esc(stock.profile)} · stock ${round(L)} mm · cuts run left → right · colour = cabinet${stock.cuts.some((c) => c.hingeInserts?.length) ? " · ⌀ dashed = sash hinge insert" : ""}</text>${stock.cuts.map(piece).join("")}${leftoverRect}${legendRow(stock.cuts, BOT + H * 0.12, H * 0.155)}</svg>`;
}
// CNC nesting DXF in the master convention (cabinex_master.rb dxf/poly/label):
// AC1015, millimetres ($INSUNITS 4), LTYPE+LAYER tables built from used layers.
// Layers: STOCK (blank edge) · CUT_OUTER (closed panel contours) · PART_ID (labels).
export function sheetDXF(sheet) {
  const NL = String.fromCharCode(13, 10);
  const r4 = (n) => String(Math.round(Number(n) * 10000) / 10000);
  const body = [];
  const pair = (code, value) => {
    body.push(String(code));
    body.push(String(value));
  };
  const poly = (points, layer) => {
    pair(0, "LWPOLYLINE");
    pair(100, "AcDbEntity");
    pair(8, layer);
    pair(100, "AcDbPolyline");
    pair(90, points.length);
    pair(70, 1);
    for (const [x, y] of points) {
      pair(10, r4(x));
      pair(20, r4(y));
    }
  };
  const label = (x, y, str, h) => {
    pair(0, "TEXT");
    pair(100, "AcDbEntity");
    pair(8, "PART_ID");
    pair(100, "AcDbText");
    pair(10, r4(x));
    pair(20, r4(y));
    pair(30, 0);
    pair(40, r4(h));
    pair(1, String(str));
  };
  poly(
    [
      [0, 0],
      [sheet.width, 0],
      [sheet.width, sheet.height],
      [0, sheet.height],
    ],
    "STOCK",
  );
  for (const p of sheet.placements) {
    poly(placedOutline(p), "CUT_OUTER");
    label(p.x + 8, p.y + 18, p.id, 8);
  }
  const used = ["0", "PART_ID"];
  for (let i = 0; i < body.length; i += 2)
    if (body[i] === "8") used.push(body[i + 1]);
  const layers = [...new Set(used)];
  const L = [];
  const P = (...a) => L.push(...a.map(String));
  P(0, "SECTION", 2, "HEADER",
    9, "$ACADVER", 1, "AC1015",
    9, "$INSUNITS", 70, 4,
    9, "$MEASUREMENT", 70, 1,
    0, "ENDSEC");
  P(0, "SECTION", 2, "TABLES");
  P(0, "TABLE", 2, "LTYPE", 70, 1);
  P(0, "LTYPE", 100, "AcDbSymbolTableRecord", 100, "AcDbLinetypeTableRecord",
    2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, "0.0");
  P(0, "ENDTAB");
  P(0, "TABLE", 2, "LAYER", 70, layers.length);
  layers.forEach((name, i) => {
    const color = name.indexOf("CUT") === 0 ? 7 : (i % 6) + 1;
    P(0, "LAYER", 100, "AcDbSymbolTableRecord", 100, "AcDbLayerTableRecord",
      2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  });
  P(0, "ENDTAB");
  P(0, "ENDSEC");
  P(0, "SECTION", 2, "ENTITIES");
  for (const v of body) L.push(v);
  P(0, "ENDSEC");
  P(0, "EOF");
  return L.join(NL) + NL;
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
  const barTotals = new Map();
  for (const stock of job.barNest.stocks) {
    const t = barTotals.get(stock.key) || {
      profile: stock.profile,
      finish: stock.finish,
      stockLength: stock.length,
      bars: 0,
      net: 0,
    };
    t.bars += 1;
    t.net += stock.cuts.reduce((a, c) => a + c.length, 0);
    barTotals.set(stock.key, t);
  }
  const barSummary = [...barTotals.values()].map(
    (t) =>
      `BAR STOCK — ${t.profile}${t.finish ? ` (${t.finish})` : ""}: ${t.bars} bar(s) of ${round(t.stockLength)} mm · net cut length ${(t.net / 1000).toFixed(2)} m · stock required ${((t.bars * t.stockLength) / 1000).toFixed(2)} m`,
  );
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
        "Hinge_insert",
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
        p.hingeInserts?.length
          ? `${p.hingeRecipe} @ ${round(p.hingeInserts[0])} mm from each end`
          : "",
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
        "Notches",
      ],
      job.panels.map((p) => [
        p.id,
        p.unitIds.join(" "),
        p.material,
        p.finish,
        round(p.cutW),
        round(p.cutH),
        p.thickness,
        p.notches && (p.notches.front.length || p.notches.rear.length)
          ? `${p.notches.front.length}F/${p.notches.rear.length}R @ ${round(p.notchDepth)} mm deep — F: ${
              p.notches.front.map((q) => `${round(q[0])}-${round(q[1])}`).join(" ") || "—"
            } R: ${
              p.notches.rear.map((q) => `${round(q[0])}-${round(q[1])}`).join(" ") || "—"
            }`
          : "",
      ]),
    ),
    "hardware-review.csv": csv(
      ["ID", "Cabinet", "Item", "Quantity", "Unit", "Fitting_bar", "Status"],
      job.hardware.map((p) => [
        p.id,
        p.unitId,
        p.item,
        p.qty,
        p.unit,
        p.bar || "",
        p.status,
      ]),
    ),
    "READ-ME.txt": [
      job.status,
      "CONTENTS — bar-cuts.csv and panel-cuts.csv list every cut (ID, cabinet, size, mitre).",
      "BAR-n-review.svg: colour-coded cut plan per stock bar (colour = cabinet, mitre angles shown).",
      "SHEET-n-review.svg: nested panel layout, colour = cabinet.",
      "SHEET-n-cnc.dxf: CNC nesting DXF in the master convention — AC1015, millimetres, layers STOCK (blank edge), CUT_OUTER (closed panel contours, one label per part on PART_ID).",
      "PANEL NOTCHES (master cabinetrix through-notch): U-notched bottom/top/shelf panels carry 27.4 mm slots at every front upright (25.4 mm post + 1 mm clearance per edge), 13.7 mm deep (= 38.1 − 25.4 + 1). Intervals are listed in panel-cuts.csv (Notches column) and drawn on the nesting SVGs.",
      "SASH BARS: every sash bar is mitred 45°/45° at both ends. The hinge stile carries the source sash hinge + matching insert at 100 mm from each end (recipe sash-hinge-template, dashed ⌀ mark on its bar plan) — no ø35 board cup is drilled into hollow sash (master rule). Board fronts, if introduced, take ø35 × 13 mm cups at 22.5 mm from the hinge edge (recipe generic-cup-35), 2–4 per height.",
      ...barSummary,
      ...job.errors,
      ...job.rejected.map((r) => `${r.id}: ${r.reason}`),
      ...job.warnings,
    ].join("\n\n"),
  };
  for (const sheet of job.sheetNest.sheets) {
    files[`${sheet.id}-review.svg`] = sheetSVG(sheet);
    files[`${sheet.id}-cnc.dxf`] = sheetDXF(sheet);
  }
  for (const stock of job.barNest.stocks)
    files[`${stock.id}-review.svg`] = barSVG(stock);
  return files;
}
