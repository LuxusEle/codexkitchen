import test from "node:test";
import assert from "node:assert/strict";
import { initialProject, solve } from "../src/model.js";
import { fabricationPlan } from "../src/fabrication.js";
import { kitchenEstimate } from "../src/costing.js";
import {
  OUTPUT_TABS,
  OFFCUT_REUSABLE_MM,
  workshopModel,
  outputSheets,
  workshopCsv,
  tabCount,
  assemblyRuns,
} from "../src/output-sheets.js";

const fixture = () => {
  const p = initialProject();
  const plan = solve(p);
  const job = fabricationPlan(p, plan);
  const estimate = kitchenEstimate(p, plan, job);
  return { p, plan, job, estimate, model: workshopModel(p, plan, job, estimate) };
};

test("outputs model: counts match the fabrication job", () => {
  const { job, model } = fixture();
  assert.equal(model.counts.bars, job.barNest.stocks.length);
  assert.equal(model.counts.panels, job.panels.length);
  assert.equal(model.counts.sheets, job.sheetNest.sheets.length);
  assert.equal(model.counts.pieces, model.stickers.length);
  assert.equal(model.counts.runs, assemblyRuns(job).length);
});

test("outputs model: every allocated cut is exactly one sticker with a bar and sequence", () => {
  const { model } = fixture();
  const cutCount = model.stocks.reduce((n, s) => n + s.cuts.length, 0);
  assert.equal(model.stickers.length, cutCount);
  assert.equal(new Set(model.stickers.map((s) => s.part)).size, cutCount);
  for (const s of model.stickers) {
    assert.ok(s.bar && s.sequence >= 1 && s.part && s.length > 0);
  }
});

test("outputs model: trim + kerf + offcut add back to the stock length", () => {
  const { model } = fixture();
  for (const s of model.stocks) {
    const sum = s.cuts.reduce((n, c) => n + c.length, 0);
    const total = model.settings.endTrim + sum + s.kerfBetween + s.offcut;
    assert.ok(Math.abs(total - s.length) < 0.05, `${s.id}: ${total} vs ${s.length}`);
  }
});

test("outputs model: reusable flag follows the 500 mm threshold", () => {
  const { model } = fixture();
  for (const s of model.stocks) assert.equal(s.reusable, s.offcut >= OFFCUT_REUSABLE_MM);
});

test("outputs sheets: every tab renders fully numbered sheets", () => {
  const { model } = fixture();
  assert.deepEqual(OUTPUT_TABS, ["Stocks", "Cutlists", "Bar cutting", "Labels / stickers", "BOM", "Quote", "Assembly guides", "Everything"]);
  for (const tab of OUTPUT_TABS) {
    const sheets = outputSheets(model, tab);
    assert.ok(sheets.length >= 1, `${tab}: no sheets`);
    for (const s of sheets) {
      assert.ok(!s.html.includes("@@PAGE@@"), `${tab}: page placeholder left`);
      assert.ok(s.html.includes('class="ow-sheet'), `${tab}: sheet shell missing`);
      assert.ok(/ow-pageno">\d+ \/ \d+</.test(s.html), `${tab}: page number missing`);
      assert.ok(s.html.includes("ENGINEERING REVIEW"), `${tab}: review flag missing`);
    }
  }
});

test("outputs sheets: no undefined/NaN ever reaches a sheet or a CSV", () => {
  const { model } = fixture();
  for (const tab of OUTPUT_TABS) {
    const html = outputSheets(model, tab).map((s) => s.html).join("\n");
    assert.ok(!/undefined|NaN/.test(html), `${tab}: html defect`);
    const csv = workshopCsv(model, tab);
    assert.ok(!/undefined|NaN/.test(csv), `${tab}: csv defect`);
  }
});

test("outputs sheets: stickers are one per piece and grouped 8 per page", () => {
  const { model } = fixture();
  const html = outputSheets(model, "Labels / stickers").map((s) => s.html).join("");
  assert.equal((html.match(/class="ow-sticker"/g) || []).length, model.stickers.length);
  const pages = outputSheets(model, "Labels / stickers");
  assert.equal(pages.length, Math.ceil(model.stickers.length / 8));
});

test("outputs sheets: stock plan keeps per-bar offcut, kerf and angle tags", () => {
  const { model } = fixture();
  const html = outputSheets(model, "Stocks").map((s) => s.html).join("");
  assert.equal((html.match(/class="ow-bar-card"/g) || []).length, model.stocks.length);
  assert.ok(html.includes("kerf"));
  assert.ok(/\[\d+\/\d+\]/.test(html));
});

test("outputs sheets: quote carries both lists and never mixes them", () => {
  const { model } = fixture();
  const html = outputSheets(model, "Quote").map((s) => s.html).join("");
  assert.ok(html.includes("Customer estimate"));
  assert.ok(html.includes("Shop cost (internal only)"));
  assert.ok(html.includes("never shown on a customer quote"));
});

test("outputs sheets: everything concatenates every section in order", () => {
  const { model } = fixture();
  const html = outputSheets(model, "Everything").map((s) => s.html).join("");
  const order = ["Stock cutting plan", "Bar cut list", "Bar cut drawings", "Cutting review stickers", "hardware BOM", "Customer estimate", "Frame assembly"];
  let at = -1;
  for (const title of order) {
    const next = html.indexOf(title);
    assert.ok(next > at, `${title} out of order`);
    at = next;
  }
});

test("outputs: quote sheets tolerate a missing estimate", () => {
  const { p, plan, job } = fixture();
  const m = workshopModel(p, plan, job, undefined);
  const sheets = outputSheets(m, "Quote");
  assert.ok(sheets.length >= 1);
  assert.ok(!/undefined|NaN/.test(sheets.map((s) => s.html).join("")));
});

test("outputs: tab counts are numbers for every named tab", () => {
  const { model } = fixture();
  for (const tab of OUTPUT_TABS) {
    const n = tabCount(model, tab);
    if (tab === "Everything") assert.equal(n, null);
    else assert.ok(Number.isFinite(n) && n >= 0, `${tab}: ${n}`);
  }
});

test("outputs: CSV for every tab is non-empty and CRLF-delimited", () => {
  const { model } = fixture();
  for (const tab of OUTPUT_TABS) {
    const csv = workshopCsv(model, tab);
    assert.ok(csv.length > 50, `${tab}: too short`);
    assert.ok(csv.includes("\r\n"), `${tab}: no CRLF`);
    assert.ok(csv.split("\r\n")[0].startsWith('"Project"'), `${tab}: missing header`);
  }
});
