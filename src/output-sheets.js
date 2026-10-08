// Project outputs — sheet model + print-ready HTML builders for the in-app
// Outputs window. Follows the approved sheet language reproduced from the
// FULLALUDOOR moxy study: stock cutting plan cards (cycling piece tints,
// hatched offcut, kerf/offcut notes) and bar cut drawing sheets, plus
// cutlists, stickers, BOM, quote and assembly schedules in one review
// document. Pure data in, HTML string out — no DOM, testable in node.
import { barSVG } from './fabrication.js';

export const OUTPUT_TABS = [
  'Stocks',
  'Cutlists',
  'Bar cutting',
  'Labels / stickers',
  'BOM',
  'Quote',
  'Assembly guides',
  'Everything',
];

export const OFFCUT_REUSABLE_MM = 500;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[c]);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nf = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const money = (n) => `LKR ${Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
const TINTS = ['#dae6f9', '#e1eddf', '#efe4d4'];

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out.length ? out : [[]];
};

// Runs are re-derived locally (assembly-pdf.js pulls jspdf, which must not
// load in the node test runner).
export function assemblyRuns(job) {
  return [...new Set(job.bars.map((b) => b.runId).filter(Boolean))].map((id) => ({
    id,
    bars: job.bars.filter((b) => b.runId === id),
    panels: job.panels.filter((p) => p.runId === id),
  }));
}

export function workshopModel(p, plan, job, estimate) {
  const settings = job.settings || {};
  const kerf = Number(settings.barKerf) || 0;
  const trim = Number(settings.endTrim) || 0;
  const stocks = job.barNest.stocks.map((stock) => {
    const cuts = stock.cuts;
    const lastEnd = cuts.length ? Math.max(...cuts.map((c) => c.offset + c.length)) : 0;
    const offcut = Math.max(0, round2(stock.length - lastEnd));
    return {
      id: stock.id,
      profile: stock.profile,
      finish: stock.finish,
      length: stock.length,
      cuts,
      offcut,
      reusable: offcut >= OFFCUT_REUSABLE_MM,
      kerfBetween: round2(Math.max(0, cuts.length - 1) * kerf),
      capacity: round2(stock.length - 2 * trim),
    };
  });
  const stickers = stocks.flatMap((s) =>
    s.cuts.map((c, i) => ({
      id: `${s.id}#${i + 1}`,
      bar: s.id,
      sequence: i + 1,
      part: c.id,
      name: c.name || '',
      units: c.unitIds || [],
      profile: c.profile,
      length: c.length,
      angleL: c.miterStart ? c.miterStart : 90,
      angleR: c.miterEnd ? c.miterEnd : 90,
      start: round2(c.offset),
      end: round2(c.offset + c.length),
      endDetail: c.endDetail || '',
      hinge:
        c.hingeInserts && c.hingeInserts.length
          ? { recipe: c.hingeRecipe || 'sash-hinge-template', first: round2(c.hingeInserts[0]), count: c.hingeInserts.length }
          : null,
    })),
  );
  const cutRows = job.bars.map((b) => ({
    id: b.id,
    cabinets: (b.unitIds || []).join(' '),
    profile: b.profile,
    length: b.length,
    angleL: b.miterStart ? b.miterStart : 90,
    angleR: b.miterEnd ? b.miterEnd : 90,
    stock: b.stockLength,
    endDetail: b.endDetail || 'Square cut',
    hinge: b.hingeInserts && b.hingeInserts.length
      ? `${b.hingeRecipe || 'sash-hinge-template'} @ ${round2(b.hingeInserts[0])} mm from each end · ⌀35 register`
      : '',
  }));
  const panelRows = job.panels.map((pnl) => ({
    id: pnl.id,
    cabinets: (pnl.unitIds || []).join(' '),
    material: pnl.material,
    finish: pnl.finish,
    w: pnl.cutW,
    h: pnl.cutH,
    thickness: pnl.thickness,
    notches:
      pnl.notches && (pnl.notches.front.length || pnl.notches.rear.length)
        ? `${pnl.notches.front.length}F/${pnl.notches.rear.length}R @ ${round2(pnl.notchDepth)} mm deep — F: ${
            pnl.notches.front.map((q) => `${round2(q[0])}-${round2(q[1])}`).join(' ') || '—'
          } R: ${pnl.notches.rear.map((q) => `${round2(q[0])}-${round2(q[1])}`).join(' ') || '—'}`
        : '',
  }));
  const runs = assemblyRuns(job);
  const stockByPart = {};
  for (const s of stocks) for (const c of s.cuts) stockByPart[c.id] = s.id;
  return {
    project: { name: p?.name || 'Untitled kitchen' },
    date: new Date().toLocaleDateString('en-LK'),
    status: job.status,
    settings: { barLength: settings.barLength, sashLength: settings.sashLength, handleLength: settings.handleLength, barKerf: kerf, endTrim: trim },
    counts: {
      bars: stocks.length,
      pieces: stickers.length,
      sheets: job.sheetNest.sheets.length,
      panels: job.panels.length,
      runs: runs.length,
    },
    stocks,
    stickers,
    cutRows,
    panelRows,
    stockByPart,
    bom: job.bom || [],
    hardware: job.hardware || [],
    sales: estimate?.sales || [],
    purchasing: estimate?.purchasing || [],
    salesTotal: estimate?.salesTotal || 0,
    purchasingTotal: estimate?.purchasingTotal || 0,
    sourceNote: estimate?.sourceNote || '',
    runs,
    blockers: [...(job.errors || [])],
    warnings: job.warnings || [],
    rejected: job.rejected || [],
  };
}

export function tabCount(model, tab) {
  switch (tab) {
    case 'Stocks': return model.stocks.length;
    case 'Cutlists': return model.cutRows.length + model.panelRows.length;
    case 'Bar cutting': return model.stocks.length;
    case 'Labels / stickers': return model.stickers.length;
    case 'BOM': return model.bom.length + model.hardware.length;
    case 'Quote': return model.sales.length + model.purchasing.length;
    case 'Assembly guides': return model.runs.length;
    default: return null;
  }
}

// ---------------------------------------------------------------- sheet shell
const FLAG = 'ENGINEERING REVIEW / NOT RELEASED FOR PRODUCTION';
const FOOT_RED = 'REVIEW ONLY — NOT A RELEASED SAW / MACHINING INSTRUCTION';

function sheetShell({ model, title, sub, orientation = 'portrait', note = '', body }) {
  return `<section class="ow-sheet${orientation === 'wide' ? ' ow-sheet--wide' : ''}">
  <header class="ow-sheet-head">
    <div><h1>${esc(title)}</h1>${sub ? `<p class="ow-sub">${sub}</p>` : ''}</div>
    <div class="ow-sheet-right"><span class="ow-flag">${esc(FLAG)}</span><span class="ow-pages">${orientation === 'wide' ? 'A3 landscape' : 'A4 portrait'} &middot; 100%</span></div>
  </header>
  ${note ? `<p class="ow-note">${note}</p>` : ''}
  <div class="ow-sheet-body">${body}</div>
  <footer class="ow-sheet-foot"><span class="ow-red">${esc(FOOT_RED)}</span><span>${esc(model.project.name)} &middot; ${esc(model.date)}</span><span class="ow-pageno">@@PAGE@@</span></footer>
</section>`;
}

function table(head, rows) {
  return `<div class="ow-table"><table><thead><tr>${head
    .map((h) => `<th>${h}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------- stocks tab
const angleTag = (c) => `[${c.miterStart ? c.miterStart : 90}/${c.miterEnd ? c.miterEnd : 90}]`;
const barSumLine = (s) =>
  s.cuts.map((c) => `${nf(c.length)} ${angleTag(c)}`).join(' + ') +
  ` | kerf ${nf(s.kerfBetween)} mm | ${s.reusable ? 'Reusable' : 'Scrap'} offcut`;

function barCard(s) {
  const pieces = s.cuts
    .map((c, i) => {
      const pct = ((c.length / s.length) * 100).toFixed(4);
      const tip = `${c.id} · ${nf(c.length)} mm ${angleTag(c)} · ${(c.unitIds || []).join(' ')}${
        c.hingeInserts?.length ? ' · ⌀35 hinge register' : ''
      }`;
      return `<span class="ow-piece" style="width:${pct}%;background:${TINTS[i % 3]}" title="${esc(tip)}">${nf(c.length)}</span>`;
    })
    .join('');
  const offcutPct = ((s.offcut / s.length) * 100).toFixed(4);
  const trimPct = (Math.max(0, (s.length - s.capacity) / 2 / s.length) * 100).toFixed(4);
  return `<div class="ow-bar-card">
  <div class="ow-bar-head"><strong>${esc(s.id)} <span>${esc(s.profile)}</span></strong><span>${nf(s.length)} mm stock | ${nf(s.offcut)} mm offcut</span></div>
  <div class="ow-strip">${trimPct > 0 ? `<span class="ow-trim" style="width:${trimPct}%"></span>` : ''}${pieces}<span class="ow-offcut" style="width:${offcutPct}%"></span></div>
  <p class="ow-bar-sum">${barSumLine(s)}</p>
</div>`;
}

function stockSheets(m) {
  const pages = chunk(m.stocks, 6);
  return pages.map((page, i) => ({
    id: `stocks-${i + 1}`,
    title: 'Stock cutting plan',
    orientation: 'wide',
    html: sheetShell({
      model: m,
      title: i ? 'Stock cutting plan (continued)' : 'Stock cutting plan',
      sub: `Bar stock cutting review &middot; ${esc(m.project.name)}`,
      orientation: 'wide',
      note: `${nf(m.settings.barLength)} mm bar / ${nf(m.settings.sashLength)} mm sash / ${nf(m.settings.handleLength)} mm handle stock &middot; ${nf(m.settings.barKerf)} mm kerf / ${nf(m.settings.endTrim)} mm trim each end. ${m.counts.bars} bars in this job.`,
      body:
        page.map(barCard).join('') +
        `<div class="ow-legend">
          <span class="ow-lg"><i class="ow-chip" style="background:#dae6f9"></i>piece tint 1 (cycles)</span>
          <span class="ow-lg"><i class="ow-chip" style="background:#e1eddf"></i>piece tint 2 (cycles)</span>
          <span class="ow-lg"><i class="ow-chip" style="background:#efe4d4"></i>piece tint 3 (cycles)</span>
          <span class="ow-lg"><i class="ow-chip ow-hatch"></i>offcut remainder</span>
          <span class="ow-lg">kerf charged between pieces</span>
          <span class="ow-lg">offcut &ge; ${OFFCUT_REUSABLE_MM} mm = Reusable</span>
        </div>
        <p class="ow-notice">Best-fit decreasing from the existing engine. Kerf is charged between pieces; trim is reserved at both stock ends. Confirm first/last cut and mitre allowances. Offcuts of at least ${OFFCUT_REUSABLE_MM} mm are classified reusable. Review preview, not a released saw instruction.</p>`,
    }),
  }));
}

// -------------------------------------------------------------- cutlists tab
function cutlistSheets(m) {
  const sheets = [];
  chunk(m.cutRows, 14).forEach((rows, i) =>
    sheets.push({
      id: `cutlist-bars-${i + 1}`,
      title: 'Bar cut list',
      html: sheetShell({
        model: m,
        title: 'Bar cut list',
        sub: `Every bar cut with its profile, angles and stock reference${i ? ' &middot; continued' : ''}`,
        note: 'IDs match the nested bar stock in the Cutting ZIP. 45° = mitred end; 90° = square end. Hinge register = sash hinge + matching insert (recipe kept on the bar plan).',
        body: table(
          ['ID', 'Cabinets', 'Profile', 'Length mm', 'Ends', 'Stock mm', 'End detail', 'Hinge register'],
          rows.map((r) => [
            esc(r.id), esc(r.cabinets), esc(r.profile), nf(r.length), `${r.angleL}° / ${r.angleR}°`, nf(r.stock), esc(r.endDetail), esc(r.hinge) || '—',
          ]),
        ),
      }),
    }),
  );
  chunk(m.panelRows, 14).forEach((rows, i) =>
    sheets.push({
      id: `cutlist-panels-${i + 1}`,
      title: 'Panel cut list',
      html: sheetShell({
        model: m,
        title: 'Panel / liner cut list',
        sub: `Every panel blank with its U-notch schedule${i ? ' &middot; continued' : ''}`,
        note: 'U-notches: 25.4 mm front upright + 1 mm clearance per edge, 13.7 mm deep. Contours and notches are drawn on the nesting sheets in the Cutting ZIP.',
        body: table(
          ['ID', 'Cabinets', 'Material', 'Finish', 'Blank W', 'Blank H', 'Th.', 'Notches'],
          rows.map((r) => [
            esc(r.id), esc(r.cabinets), esc(r.material), esc(r.finish), nf(r.w), nf(r.h), `${nf(r.thickness)} mm`, esc(r.notches) || '—',
          ]),
        ),
      }),
    }),
  );
  if (!sheets.length)
    sheets.push({
      id: 'cutlist-empty',
      title: 'Cut list',
      html: sheetShell({ model: m, title: 'Cut list', sub: 'No cuts yet', body: '<p class="ow-empty">No calculated cuts are available. Resolve design errors and return to this review.</p>' }),
    });
  return sheets;
}

// ------------------------------------------------------------ bar cutting tab
function barCutSheets(m) {
  const pages = chunk(m.stocks, 3);
  return pages.map((page, i) => ({
    id: `barcut-${i + 1}`,
    title: 'Bar cutting',
    orientation: 'wide',
    html: sheetShell({
      model: m,
      title: i ? 'Bar cut drawings (continued)' : 'Bar cut drawings',
      sub: `Per-bar cut plan: piece IDs, cut lengths, 45° end labels and hinge registers &middot; ${esc(m.project.name)}`,
      orientation: 'wide',
      note: 'Cuts run left → right along each stock bar. Colour = cabinet. Red 45° labels = mitred end cuts. Dashed ⌀35 = sash hinge cup register (matching insert, not a generic board cup).',
      body:
        page
          .map((s) => {
            const hingeCuts = s.cuts.filter((c) => c.hingeInserts?.length);
            const notes = [];
            if (hingeCuts.length)
              notes.push(
                `⌀35 hinge cup register on ${hingeCuts.map((c) => esc(c.id)).join(', ')} — ${esc(hingeCuts[0].hingeRecipe || 'sash-hinge-template')} @ ${hingeCuts
                  .map((c) => `${nf(c.hingeInserts[0])}`)
                  .join('/')} mm from the stile ends. Hollow sash takes the matching insert.`,
              );
            if (s.cuts.some((c) => c.miterStart || c.miterEnd))
              notes.push('Mitred ends drawn at true 45° geometry across the face; length datum = long edge.');
            notes.push('HELD: mitre plane hand and length datum — confirm first/last cut and mitre allowances before release.');
            return `<article class="ow-draw-card">
  <div class="ow-draw-head"><strong>${esc(s.id)} <span>${esc(s.profile)}</span></strong><span>${esc(s.finish || '')} &middot; ${s.cuts.length} cuts &middot; offcut ${nf(s.offcut)} mm (${s.reusable ? 'reusable' : 'scrap'})</span></div>
  <div class="ow-draw-body">${barSVG(s)}</div>
  <p class="ow-draw-notes">${notes.join(' ')}</p>
</article>`;
          })
          .join('') +
        `<p class="ow-notice">Bar plans carry every cut ID used by the cut list and the Cutting ZIP. This is a review preview, not a released saw instruction.</p>`,
    }),
  }));
}

// -------------------------------------------------------------- stickers tab
function stickerSheets(m) {
  const pages = chunk(m.stickers, 8);
  const allocated = m.stickers.length;
  const held = m.rejected.length;
  return pages.map((page, i) => ({
    id: `stickers-${i + 1}`,
    title: 'Labels / stickers',
    html: sheetShell({
      model: m,
      title: 'Cutting review stickers',
      sub: `${allocated} labels, one per allocated piece${i ? ' &middot; continued' : ''}`,
      note: `Print at 100% on A4; 2 columns × 4 rows. Confirm label media before cutting.${
        held ? ` ${held} part(s) have no stock allocation and no cutting label.` : ''
      }`,
      body: `<div class="ow-sticker-grid">${page
        .map(
          (l) => `<article class="ow-sticker">
  <div class="ow-sticker-top"><b>${esc(l.units.join(' · ') || 'SHARED')}</b><span>${esc(l.bar)} &middot; #${l.sequence}</span></div>
  <p class="ow-sticker-project">${esc(m.project.name)}</p>
  <div class="ow-sticker-cut"><b>${nf(l.length)} <small>mm</small></b><span>L ${l.angleL}°<br>R ${l.angleR}°</span></div>
  <p class="ow-sticker-meta">${esc(l.profile)}${l.endDetail ? ` &middot; ${esc(l.endDetail)}` : ''}</p>
  <code>${esc(l.part)}</code>
  ${l.hinge ? `<span class="ow-sticker-hinge">⌀35 hinge register @ ${nf(l.hinge.first)} mm &middot; ${esc(l.hinge.recipe)}</span>` : ''}
  <small class="ow-sticker-status">ENGINEERING REVIEW &middot; VERIFY BEFORE CUTTING</small>
</article>`,
        )
        .join('')}</div>`,
    }),
  }));
}

// ------------------------------------------------------------------- BOM tab
function bomSheets(m) {
  const sheets = [];
  chunk(m.bom, 20).forEach((rows, i) =>
    sheets.push({
      id: `bom-${i + 1}`,
      title: 'BOM',
      html: sheetShell({
        model: m,
        title: 'Stock & hardware BOM',
        sub: `Purchasing quantities measured from this design${i ? ' &middot; continued' : ''}`,
        note: 'Bar stock is counted per profile / finish / stock length. Sheet stock is counted per material / thickness. Hardware quantities are provisional source previews.',
        body: table(
          ['Category', 'Item', 'Qty', 'Unit'],
          rows.map((r) => [esc(r.category), esc(r.item), nf(r.quantity), esc(r.unit)]),
        ),
      }),
    }),
  );
  chunk(m.hardware, 18).forEach((rows, i) =>
    sheets.push({
      id: `hardware-${i + 1}`,
      title: 'Hardware schedule',
      html: sheetShell({
        model: m,
        title: 'Hardware schedule (provisional)',
        sub: `Per-door hinges, inserts, lift and drawer systems${i ? ' &middot; continued' : ''}`,
        note: 'Part numbers, hinge loading, connectors, screws, wall fixings, seals and drilling templates need approval before ordering.',
        body: table(
          ['ID', 'Cabinet', 'Item', 'Qty', 'Unit', 'Fitting bar', 'Status'],
          rows.map((r) => [esc(r.id), esc(r.unitId), esc(r.item), nf(r.qty), esc(r.unit), esc(r.bar || '—'), esc(r.status)]),
        ),
      }),
    }),
  );
  sheets.push({
    id: 'bom-notes',
    title: 'BOM notes',
    html: sheetShell({
      model: m,
      title: 'BOM basis and exclusions',
      sub: 'What this schedule does and does not cover',
      note: '',
      body: `<ul class="ow-list">${[
        'Worktops, appliance internals and drawer-box fabrication are excluded from sheet nesting; drawer / pullout systems are listed as purchased assemblies.',
        'Rails over 6377 mm are segmented in the web model; splice positions and connection details require review.',
        'Rear uprights use an independent support grid. Default 600 mm spacing is a review assumption, not a structural rating.',
        'Hardware part numbers, connectors, screws, wall fixings, seals and drilling templates need approval.',
        'Quantities are measured from this design; confirm current supplier stock and prices before ordering.',
      ]
        .map((w) => `<li>${esc(w)}</li>`)
        .join('')}</ul>
      <p class="ow-notice">Source · ${m.stocks.length} bars / ${m.counts.sheets} sheets / ${m.counts.panels} panels measured by the fabrication engine.</p>`,
    }),
  });
  return sheets;
}

// ----------------------------------------------------------------- Quote tab
function quoteSheets(m) {
  const salesRows = m.sales.map((l) => [
    esc(l.item) + (l.basis ? `<small>${esc(l.basis)}</small>` : ''),
    nf(l.quantity),
    esc(l.unit),
    money(l.rate),
    money(l.total),
  ]);
  const purchRows = m.purchasing.map((l) => [
    esc(l.item) + `<small>${esc(l.category || '')}</small>`,
    nf(l.quantity),
    esc(l.unit),
    money(l.rate),
    money(l.total),
  ]);
  return [
    {
      id: 'quote-sales',
      title: 'Quote — customer price',
      html: sheetShell({
        model: m,
        title: 'Customer estimate',
        sub: `Provisional quote measured from this design &middot; ${esc(m.project.name)}`,
        note: 'Selling rates are the editable UAT rates. This is what the customer pays — the shop cost list stays in its own sheet and is never added to it.',
        body:
          table(['Item', 'Qty', 'Unit', 'Rate', 'Total'], salesRows) +
          `<p class="ow-total"><span>Customer estimate total</span><b>${money(m.salesTotal)}</b></p>
           <p class="ow-notice">Confirm labour, installation, delivery, overhead and contingency before issue. Prices are editable and not a supplier quotation.</p>`,
      }),
    },
    {
      id: 'quote-shop',
      title: 'Quote — shop cost',
      html: sheetShell({
        model: m,
        title: 'Shop cost (internal only)',
        sub: 'Purchasing reference — never shown on a customer quote',
        note: 'BOM defaults are editable Sri Lanka reference proxies.',
        body:
          table(['Item', 'Qty', 'Unit', 'Rate', 'Total'], purchRows) +
          `<p class="ow-total"><span>BOM reference subtotal (internal)</span><b>${money(m.purchasingTotal)}</b></p>
           <p class="ow-notice">${esc(m.sourceNote) || 'Obtain supplier quotations before ordering.'} Reference difference to the customer price: ${money(m.salesTotal - m.purchasingTotal)} before labour, installation and overhead.</p>`,
      }),
    },
  ];
}

// ------------------------------------------------------------- assembly tab
function mm1(n) {
  return Number(n).toFixed(1).toString();
}
function isoViewSVG(bars, w = 1020, h = 380) {
  if (!bars.length) return '';
  const project = (x, y, z) => [x + 0.55 * z, -y + 0.3 * z];
  const verts = (b) =>
    [[0, 0, 0], [b.w, 0, 0], [b.w, b.h, 0], [0, b.h, 0], [0, 0, b.d], [b.w, 0, b.d], [b.w, b.h, b.d], [0, b.h, b.d]].map(
      ([x, y, z]) => project(b.x + x, b.y + y, b.z + z),
    );
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const all = bars.flatMap(verts);
  const lo = [Math.min(...all.map((q) => q[0])), Math.min(...all.map((q) => q[1]))];
  const hi = [Math.max(...all.map((q) => q[0])), Math.max(...all.map((q) => q[1]))];
  const scale = Math.min(w / Math.max(1, hi[0] - lo[0]), h / Math.max(1, hi[1] - lo[1]));
  const pt = (q) => [
    (w - (hi[0] - lo[0]) * scale) / 2 + (q[0] - lo[0]) * scale,
    (h - (hi[1] - lo[1]) * scale) / 2 + (q[1] - lo[1]) * scale,
  ];
  const paths = bars
    .map((b) => {
      const pts = verts(b).map(pt);
      const d = edges
        .map(([a, c]) => `M${round2(pts[a][0])} ${round2(pts[a][1])}L${round2(pts[c][0])} ${round2(pts[c][1])}`)
        .join('');
      const rear = String(b.name || '').startsWith('Rear');
      return `<path d="${d}" fill="none" stroke="${rear ? '#7ca3a5' : '#294a50'}" stroke-width="1"/>`;
    })
    .join('');
  return `<svg class="ow-iso" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Frame isometric">${paths}</svg>`;
}

function assemblySheets(m) {
  const sheets = [];
  for (const run of m.runs) {
    const bars = run.bars;
    if (!bars.length) continue;
    const x0 = Math.min(...bars.map((b) => b.x));
    const x1 = Math.max(...bars.map((b) => b.x + b.w));
    const y0 = Math.min(...bars.map((b) => b.y));
    const y1 = Math.max(...bars.map((b) => b.y + b.h));
    const z0 = Math.min(...bars.map((b) => b.z));
    const z1 = Math.max(...bars.map((b) => b.z + b.d));
    sheets.push({
      id: `assembly-${run.id}-overview`,
      title: 'Assembly guides',
      orientation: 'wide',
      html: sheetShell({
        model: m,
        title: `Frame assembly — ${run.id} · Wall ${bars[0].wall}`,
        sub: `Continuous run overview &middot; units ${esc(bars[0].unitIds.join(', '))}`,
        orientation: 'wide',
        note: `Metal envelope ${mm1(x1 - x0)} W × ${mm1(y1 - y0)} H × ${mm1(z1 - z0)} D mm. Isometric is frame-only; member positions are listed in the schedule sheets.`,
        body:
          isoViewSVG(bars) +
          `<ol class="ow-list ow-steps">
            <li>Assemble exposed / shared fixed sash ends.</li>
            <li>Terminate continuous rails into the owning sash.</li>
            <li>Fit internal front posts only at cabinet boundaries.</li>
            <li>Fit the independently selected rear supports.</li>
          </ol>
          <p class="ow-notice">U-cuts: 1 mm clearance per edge. No duplicate box upright at a sash end. Frame drawings remain engineering previews.</p>`,
      }),
    });
    const stockOf = (id) => m.stockByPart[id] || 'Unnested';
    chunk(bars, 18).forEach((rows, i) =>
      sheets.push({
        id: `assembly-${run.id}-members-${i + 1}`,
        title: 'Assembly guides',
        html: sheetShell({
          model: m,
          title: `Frame members — ${run.id}${i ? ' · continued' : ''}`,
          sub: 'Cut and placement schedule &middot; datum: X offset from run start; Y above floor; Z out from wall',
          note: 'Position = lower corner of member. Box bars are square-cut; structural end sash carry 45/45 mitres with no handle. IDs match nested bar stock and the review ZIP.',
          body: table(
            ['Part ID', 'Member', 'Axis', 'Cut mm', 'X mm', 'Y mm', 'Z mm', 'Section mm', 'Stock'],
            rows.map((b) => [
              esc(b.id), esc(b.name), esc(b.axis), nf(b.length), nf(round2(b.x - x0)), nf(b.y), nf(b.z),
              [b.w, b.h, b.d].filter((_, k) => k !== { x: 0, y: 1, z: 2 }[b.axis]).map(mm1).join(' × '),
              esc(stockOf(b.id)),
            ]),
          ),
        }),
      }),
    );
    if (run.panels.length)
      chunk(run.panels, 18).forEach((rows, i) =>
        sheets.push({
          id: `assembly-${run.id}-panels-${i + 1}`,
          title: 'Assembly guides',
          html: sheetShell({
            model: m,
            title: `Liner / cladding — ${run.id}${i ? ' &middot; continued' : ''}`,
            sub: 'U-notched liners and end infills &middot; rear liner is physical ACP',
            note: 'U-cuts: 1 mm clearance per edge. Rear posts are turned 38.1 across × 25.4 deep; ACP is flush behind them. No ACP top on bottom units.',
            body: table(
              ['Part ID', 'Panel', 'Blank W', 'Blank H', 'X mm', 'Y mm', 'Z mm', 'U-cut depth'],
              rows.map((b) => [
                esc(b.id), esc(b.name), nf(b.cutW), nf(b.cutH), nf(round2(b.x - x0)), nf(b.y), nf(b.z),
                b.outline ? nf(b.notchDepth) : '—',
              ]),
            ),
          }),
        }),
      );
  }
  if (!sheets.length)
    sheets.push({
      id: 'assembly-empty',
      title: 'Assembly guides',
      html: sheetShell({ model: m, title: 'Assembly guides', sub: 'No frames yet', body: '<p class="ow-empty">No continuous frames are available for this design yet.</p>' }),
    });
  return sheets;
}

// -------------------------------------------------------------- Everything
function coverSheet(m) {
  const rows = [
    ['Stock cutting plan', `${m.counts.bars} bars — piece lengths, kerf, offcut reuse / scrap`],
    ['Cutlists', `${m.cutRows.length} bar cuts + ${m.panelRows.length} panel blanks`],
    ['Bar cutting', `${m.counts.bars} per-bar cut drawings — 45° labels, hinge registers`],
    ['Labels / stickers', `${m.stickers.length} cutting labels (2 × 4 on A4)`],
    ['BOM', `${m.bom.length} stock lines + ${m.hardware.length} hardware lines`],
    ['Quote', `customer ${money(m.salesTotal)} · shop cost ${money(m.purchasingTotal)} (internal)`],
    ['Assembly guides', `${m.runs.length} continuous frame(s) with member schedules`],
  ];
  return {
    id: 'everything-cover',
    title: 'Everything',
    html: sheetShell({
      model: m,
      title: 'Everything — project outputs',
      sub: `All workshop sheets for ${esc(m.project.name)}, printed in order below`,
      note: 'Print: A3 landscape for stock and bar sheets, A4 portrait otherwise. 100% scale, background graphics on.',
      body:
        table(['Section', 'Contents'], rows.map((r) => [r[0], esc(r[1])])) +
        `<div class="ow-totals">
          <div><strong>${m.counts.bars}</strong><span>stock bars</span></div>
          <div><strong>${m.counts.pieces}</strong><span>cut pieces</span></div>
          <div><strong>${m.counts.sheets}</strong><span>nested sheets</span></div>
          <div><strong>${m.counts.panels}</strong><span>panels</span></div>
        </div>
        ${
          m.blockers.length
            ? `<p class="ow-notice ow-red">${m.blockers.length} design point(s) block complete output — ${esc(m.blockers.slice(0, 3).join(' · '))}${m.blockers.length > 3 ? ' · …' : ''}</p>`
            : '<p class="ow-notice">All asked-for boxes are placed and parts fit stock. Review preview only — not approved machine instructions.</p>'
        }`,
    }),
  };
}

function everythingSheets(m) {
  return [
    coverSheet(m),
    ...stockSheets(m),
    ...cutlistSheets(m),
    ...barCutSheets(m),
    ...stickerSheets(m),
    ...bomSheets(m),
    ...quoteSheets(m),
    ...assemblySheets(m),
  ];
}

const BUILDERS = {
  Stocks: stockSheets,
  Cutlists: cutlistSheets,
  'Bar cutting': barCutSheets,
  'Labels / stickers': stickerSheets,
  BOM: bomSheets,
  Quote: quoteSheets,
  'Assembly guides': assemblySheets,
  Everything: everythingSheets,
};

export function outputSheets(model, tab) {
  const build = BUILDERS[tab] || (() => []);
  const sheets = build(model);
  const total = sheets.length;
  return sheets.map((s, i) => ({
    ...s,
    index: i + 1,
    html: s.html.replaceAll('@@PAGE@@', `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`),
  }));
}

// -------------------------------------------------------------------- CSV out
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
const csvRows = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

export function workshopCsv(model, tab) {
  const base = [
    ['Project', model.project.name],
    ['Status', model.status],
    ['Stock mm', model.settings.barLength, 'Sash mm', model.settings.sashLength, 'Handle mm', model.settings.handleLength],
    ['Kerf mm', model.settings.barKerf, 'Trim each end mm', model.settings.endTrim],
    [],
  ];
  const rows = [...base];
  if (tab === 'Stocks') {
    rows.push(['Bar', 'Profile', 'Finish', 'Stock mm', 'Offcut mm', 'Offcut use', 'Kerf between pieces mm', 'Pieces', 'Piece summary']);
    for (const s of model.stocks)
      rows.push([s.id, s.profile, s.finish, s.length, s.offcut, s.reusable ? 'Reusable' : 'Scrap', s.kerfBetween, s.cuts.length, s.cuts.map((c) => `${c.id} ${round2(c.length)}mm ${c.miterStart ? c.miterStart : 90}/${c.miterEnd ? c.miterEnd : 90}`).join(' + ')]);
  } else if (tab === 'Cutlists') {
    rows.push(['Section', 'ID', 'Cabinets', 'Profile / material', 'Length / W', 'H / Th', 'Angles / notches', 'Stock', 'Detail']);
    for (const r of model.cutRows) rows.push(['Bar', r.id, r.cabinets, r.profile, r.length, '', `${r.angleL}/${r.angleR}`, r.stock, r.endDetail, r.hinge]);
    for (const r of model.panelRows) rows.push(['Panel', r.id, r.cabinets, `${r.material} ${r.finish || ''}`, `${r.w}x${r.h}`, r.thickness, r.notches, '', '']);
  } else if (tab === 'Bar cutting' || tab === 'Labels / stickers') {
    rows.push(['Bar', 'Seq', 'Part', 'Cabinets', 'Profile', 'Length mm', 'L°', 'R°', 'Start mm', 'End mm', 'Hinge']);
    for (const l of model.stickers)
      rows.push([l.bar, l.sequence, l.part, l.units.join(' '), l.profile, l.length, l.angleL, l.angleR, l.start, l.end, l.hinge ? `${l.hinge.recipe} @ ${l.hinge.first}mm · ⌀35` : '']);
  } else if (tab === 'BOM') {
    rows.push(['Category', 'Item', 'Quantity', 'Unit']);
    for (const r of model.bom) rows.push([r.category, r.item, r.quantity, r.unit]);
    rows.push([], ['Hardware (provisional)', 'ID', 'Cabinet', 'Item', 'Qty', 'Unit', 'Status']);
    for (const h of model.hardware) rows.push(['', h.id, h.unitId, h.item, h.qty, h.unit, h.status]);
  } else if (tab === 'Quote') {
    rows.push(['List', 'Item', 'Basis / category', 'Qty', 'Unit', 'Rate', 'Total']);
    for (const l of model.sales) rows.push(['Customer price', l.item, l.basis || '', l.quantity, l.unit, l.rate, l.total]);
    rows.push(['', '', '', '', '', 'Customer estimate total', model.salesTotal], []);
    for (const l of model.purchasing) rows.push(['Shop cost (internal)', l.item, l.category || '', l.quantity, l.unit, l.rate, l.total]);
    rows.push(['', '', '', '', '', 'Shop cost subtotal', model.purchasingTotal]);
  } else if (tab === 'Assembly guides') {
    rows.push(['Run', 'Wall', 'Part ID', 'Member', 'Axis', 'Cut mm', 'X mm', 'Y mm', 'Z mm', 'Section mm']);
    for (const run of model.runs) {
      const x0 = Math.min(...run.bars.map((b) => b.x));
      for (const b of run.bars)
        rows.push([run.id, b.wall, b.id, b.name, b.axis, b.length, round2(b.x - x0), b.y, b.z, [b.w, b.h, b.d].filter((_, k) => k !== { x: 0, y: 1, z: 2 }[b.axis]).join(' x ')]);
    }
  } else {
    // Everything: concatenate the sections with a heading row.
    for (const [name, t] of [
      ['STOCKS', 'Stocks'], ['CUTLISTS', 'Cutlists'], ['BAR CUTTING', 'Bar cutting'],
      ['BOM', 'BOM'], ['QUOTE', 'Quote'], ['ASSEMBLY GUIDES', 'Assembly guides'],
    ]) {
      rows.push([`=== ${name} ===`]);
      const sub = workshopCsv(model, t).split('\r\n').slice(4).map((line) => line.split(','));
      rows.push(...sub);
      rows.push([]);
    }
  }
  return csvRows(rows);
}
