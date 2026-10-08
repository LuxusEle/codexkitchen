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
    const mitFs = H * 0.13;
    const mitres = [
      p.miterStart && dxS > H * 0.18
        ? `<text x="${round(x0 + dxS + mitFs * 0.7)}" y="${round(TOP + H * 0.2)}" font-family="Arial" font-size="${round(mitFs)}" font-weight="600" fill="#8a3524">${p.miterStart}°</text>`
        : "",
      p.miterEnd && dxE > H * 0.18
        ? `<text x="${round(x1 - dxE - mitFs * 0.7)}" y="${round(TOP + H * 0.2)}" font-family="Arial" font-size="${round(mitFs)}" font-weight="600" text-anchor="end" fill="#8a3524">${p.miterEnd}°</text>`
        : "",
    ].join("");
    return `<g><title>${esc(p.id)} · ${esc(p.name || "")} · ${round(p.length)} mm · ${p.miterStart}/${p.miterEnd}° · ${esc((p.unitIds || []).join(" "))}</title><polygon points="${pts}" fill="${partColor(p)}" stroke="#123f45" stroke-width="${round(strokeW)}"/>${mitres}${id}${len}</g>`;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${round(VIEWH)}" role="img" aria-label="${esc(stock.id)}"><rect width="${L}" height="${round(VIEWH)}" fill="#fbfdfb"/><rect x="0" y="${round(TOP)}" width="${L}" height="${round(H)}" fill="#e1e6e2"/><text x="${round(L * 0.004)}" y="${round(H * 0.13)}" font-family="Arial" font-size="${round(H * 0.15)}" font-weight="700" fill="#31565c">${esc(stock.id)} · ${esc(stock.profile)} · stock ${round(L)} mm · cuts run left → right · colour = cabinet</text>${stock.cuts.map(piece).join("")}${leftoverRect}${legendRow(stock.cuts, BOT + H * 0.12, H * 0.155)}</svg>`;
}
// CNC-ready DXF R12 (AC1009), millimetres, origin bottom-left, Y up.
// Layers: CUT (contours) · LABEL (part id + size) · SHEET (blank edge) · INFO (title).
export function sheetDXF(sheet) {
  const f = (n) => String(round(n));
  const L = [];
  const P = (...a) => L.push(...a);
  P("0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    "9", "$INSBASE", "10", "0", "20", "0", "30", "0",
    "9", "$EXTMIN", "10", "0", "20", "0", "30", "0",
    "9", "$EXTMAX", "10", f(sheet.width), "20", f(sheet.height), "30", "0",
    "9", "$MEASUREMENT", "70", "1",
    "0", "ENDSEC");
  const layers = [["CUT", 1], ["LABEL", 3], ["SHEET", 8], ["INFO", 5]];
  P("0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", String(layers.length));
  for (const [name, color] of layers)
    P("0", "LAYER", "2", name, "70", "0", "62", String(color), "6", "CONTINUOUS");
  P("0", "ENDTAB", "0", "ENDSEC");
  P("0", "SECTION", "2", "BLOCKS", "0", "ENDSEC");
  const line = (layer, x1, y1, x2, y2) =>
    P("0", "LINE", "8", layer,
      "10", f(x1), "20", f(y1), "30", "0",
      "11", f(x2), "21", f(y2), "31", "0");
  const text = (layer, x, y, h, str) =>
    P("0", "TEXT", "8", layer,
      "10", f(x), "20", f(y), "30", "0",
      "40", f(h), "1", String(str).replace(/[\r\n]+/g, " "));
  P("0", "SECTION", "2", "ENTITIES");
  line("SHEET", 0, 0, sheet.width, 0);
  line("SHEET", sheet.width, 0, sheet.width, sheet.height);
  line("SHEET", sheet.width, sheet.height, 0, sheet.height);
  line("SHEET", 0, sheet.height, 0, 0);
  text("INFO", 10, sheet.height - 26, 16,
    `${sheet.id} | ${sheet.material} ${sheet.thickness}mm | blank ${sheet.width}x${sheet.height} | ${sheet.placements.length} parts | ENGINEERING REVIEW - NOT MACHINE RELEASE`);
  for (const p of sheet.placements) {
    const pts = placedOutline(p).map(([x, y]) => [x, sheet.height - y]);
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      line("CUT", x1, y1, x2, y2);
    }
    const xs = pts.map((v) => v[0]), ys = pts.map((v) => v[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const wmm = p.rotated ? p.cutH : p.cutW,
      hmm = p.rotated ? p.cutW : p.cutH;
    const label = String(p.id),
      dims = `${f(wmm)}x${f(hmm)}`;
    const h1 = Math.max(6, Math.min(20, p.w * 0.6 / Math.max(1, label.length) * 1.6, p.h * 0.4));
    const h2 = Math.max(4.5, h1 * 0.66);
    text("LABEL", cx - (label.length * h1 * 0.31), cy + h1 * 0.2, h1, label);
    if (p.w > 130 && p.h > 60)
      text("LABEL", cx - (dims.length * h2 * 0.31), cy - h1 * 0.75, h2, dims);
  }
  P("0", "ENDSEC", "0", "EOF");
  return L.join("\r\n") + "\r\n";
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
      "CONTENTS — bar-cuts.csv and panel-cuts.csv list every cut (ID, cabinet, size, mitre).",
      "BAR-n-review.svg: colour-coded cut plan per stock bar (colour = cabinet, mitre angles shown).",
      "SHEET-n-review.svg: nested panel layout, colour = cabinet.",
      "SHEET-n-cnc.dxf: CNC-ready DXF R12 in millimetres, origin at bottom-left, Y up. Layers: CUT (contours), LABEL (part id + size), SHEET (blank edge), INFO (title).",
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
