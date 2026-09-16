import React, {useMemo, useState} from "react";
import { zipSync, strToU8 } from "fflate";
import { download } from "./exports";
import {
  stockSettings,
  fabricationFiles,
  sheetSVG,
  barSVG,
} from "./fabrication.js";
import { SASH_PROFILE, HANDLE_PROFILE } from "./sash-profile.js";
import provenance from "../reference/fabrication/manifest.json";
import { costingSettings, kitchenEstimate } from "./costing.js";
import LengthInput from './LengthInput.jsx';

const fmt = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
export function FabricationControls({ p, job, onChange }) {
  const settings = stockSettings(p);
  const [runId,setRunId]=useState('all'),[pdfError,setPdfError]=useState(''),[pdfBusy,setPdfBusy]=useState(false);
  const runIds=[...new Set(job.bars.map(b=>b.runId).filter(Boolean))];
  async function exportAssembly(){
    setPdfBusy(true);setPdfError('');
    try{
      const {assemblyPdf}=await import('./assembly-pdf.js');
      const doc=assemblyPdf(job,runIds.includes(runId)?runId:'all');
      download(new Blob([doc.output('arraybuffer')],{type:'application/pdf'}),`frame-${runId}-assembly-REVIEW.pdf`);
    }catch(e){setPdfError(e.message)}finally{setPdfBusy(false)}
  }
  function exportJob() {
    const files = fabricationFiles(job);
    files["source-provenance.json"] = JSON.stringify(provenance, null, 2);
    download(
      new Blob(
        [
          zipSync(
            Object.fromEntries(
              Object.entries(files).map(([k, v]) => [k, strToU8(v)]),
            ),
          ),
        ],
        { type: "application/zip" },
      ),
      "kitchen-cutting-REVIEW.zip",
    );
  }
  return (
    <>
      <p className="eyebrow">STOCK → PARTS → ASSEMBLY</p>
      <h1>Cutting & BOM</h1>
      <p className="intro">
        Shared run frames, U-notched cladding, sash and integrated handle bars.
        Cutting outputs stay in mm. Stock sizes can be entered in either input unit.
      </p>
      <div className="fab-note">
        Engineering preview. Confirm support spans, hardware and cutting setup
        before purchasing or machining.
      </div>
      <div className="grid2">
        {[
          ["barLength", "Box bar stock"],
          ["sashLength", "Sash stock"],
          ["handleLength", "Handle bar stock"],
          ["barKerf", "Saw kerf"],
          ["endTrim", "Trim at each end"],
          ["sheetWidth", "Sheet length"],
          ["sheetHeight", "Sheet width"],
          ["sheetKerf", "Panel cut gap"],
          ["sheetMargin", "Sheet edge margin"],
          ["rearSupportSpacing", "Rear support spacing"],
        ].map(([key, label]) => (
          <div className="field" key={key}>
            <span>{label}</span>
            <LengthInput
              label={label}
              min={key === "rearSupportSpacing" ? 100 : 0}
              max={key === "rearSupportSpacing" ? 1200 : 30000}
              step="1"
              value={settings[key]}
              onChange={(value) =>
                onChange({ ...settings, [key]: value })
              }
            />
          </div>
        ))}
      </div>
      <label className="field">
        Rear upright adjustment (fewer / more)
        <input aria-label="Rear upright adjustment" type="number" min="-10" max="20" step="1" value={settings.rearSupportAdjustment} onChange={e=>onChange({...settings,rearSupportAdjustment:Number(e.target.value)})}/>
      </label>
      <label className="fab-check">
        <input
          type="checkbox"
          checked={settings.allowRotation}
          onChange={(e) =>
            onChange({ ...settings, allowRotation: e.target.checked })
          }
        />
        Allow sheet rotation (non-directional material)
      </label>
      <p className="muted">
        Rear posts follow a separate support grid. They are not mirrored from
        front or door divisions. Negative adjustment removes internal rear
        uprights; positive adjustment adds them. Confirm strength before release.
      </p>
      <button
        className="primary"
        disabled={!!job.errors.length || !!job.rejected.length}
        onClick={exportJob}
      >
        Download cutting review ZIP
      </button>
      <p className="muted">
        Includes nested SVGs, individual cut IDs, panel contours, stock BOM,
        hardware list, JSON and source provenance.
      </p>
      <label className="field">Frame assembly<select value={runIds.includes(runId)?runId:'all'} onChange={e=>setRunId(e.target.value)}><option value="all">All continuous frames</option>{runIds.map(id=><option key={id} value={id}>{id} · Wall {job.bars.find(b=>b.runId===id).wall}</option>)}</select></label>
      <button className="primary" disabled={pdfBusy||!runIds.length} onClick={exportAssembly}>{pdfBusy?'Preparing PDF…':'Download frame assembly PDF'}</button>
      <p className="muted">Individual continuous frame runs, front/rear views, member positions and cut IDs. U-cuts: 1 mm clearance per edge.</p>
      {pdfError&&<p role="alert">{pdfError}</p>}
      {!!job.errors.length&&<p className="fab-note">Partial nesting preview for placed cabinets. Resolve all design errors before exporting a complete cutting ZIP.</p>}
      {!!job.errors.length && (
        <div className="fab-note">
          {job.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
      {!!job.rejected.length && (
        <div className="fab-note">
          {job.rejected.length} parts do not fit selected stock. Review the
          list; no complete BOM can be exported until they fit.
        </div>
      )}
    </>
  );
}

const money = (n) =>
  `LKR ${Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;

export function CostingControls({ p, plan, job, onChange }) {
  const estimate = useMemo(() => kitchenEstimate(p, plan, job), [p, plan, job]);
  const cfg = costingSettings(p);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const commit = (patch) => onChange({ ...cfg, ...patch });
  const salesQty = (line, value) =>
    commit({ salesQuantities: { ...cfg.salesQuantities, [line.key]: Number(value) } });
  const salesRate = (line, value) =>
    commit({ salesRates: { ...cfg.salesRates, [line.key]: Number(value) } });
  const bomQty = (line, value) =>
    commit({ bomQuantities: { ...cfg.bomQuantities, [line.key]: Number(value) } });
  const bomRate = (line, value) =>
    commit({ bomRates: { ...cfg.bomRates, [line.key]: Number(value) } });
  const editExtra = (id, patch) =>
    commit({ extras: cfg.extras.map((line) => line.id === id ? { ...line, ...patch } : line) });
  async function exportCost() {
    setBusy(true); setError("");
    try {
      const { costPdf } = await import("./cost-pdf.js");
      const doc = costPdf(p, estimate);
      download(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), "kitchen-cost-and-bom-REVIEW.pdf");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <section className="cost-editor">
      <p className="eyebrow">LKR PRICE CALCULATOR</p>
      <h2>Estimate & purchasing rates</h2>
      <p className="intro">Quantities are measured from this kitchen. Every quantity and rate below is editable.</p>
      <div className="fab-table price-table">
        <table>
          <thead><tr><th>Customer estimate</th><th>Qty</th><th>Unit</th><th>Rate (LKR)</th><th>Total</th></tr></thead>
          <tbody>
            {estimate.sales.map((line) => <tr key={line.key}>
              <td>{line.extra ? <input aria-label={`${line.item} name`} value={line.item} onChange={e=>editExtra(line.key,{item:e.target.value})}/> : <><strong>{line.item}</strong><small>{line.basis}</small></>}</td>
              <td><input aria-label={`${line.item} quantity`} type="number" min="0" step="0.01" value={line.quantity} onChange={e=>line.extra?editExtra(line.key,{quantity:Number(e.target.value)}):salesQty(line,e.target.value)}/></td>
              <td>{line.extra ? <input aria-label={`${line.item} unit`} value={line.unit} onChange={e=>editExtra(line.key,{unit:e.target.value})}/> : line.unit}</td>
              <td><input aria-label={`${line.item} rate`} type="number" min="0" step="1" value={line.rate} onChange={e=>line.extra?editExtra(line.key,{rate:Number(e.target.value)}):salesRate(line,e.target.value)}/></td>
              <td>{money(line.total)}{line.extra&&<button className="text remove-cost" onClick={()=>commit({extras:cfg.extras.filter(x=>x.id!==line.key)})}>Remove</button>}</td>
            </tr>)}
          </tbody>
          <tfoot><tr><th colSpan="4">Customer estimate total</th><th>{money(estimate.salesTotal)}</th></tr></tfoot>
        </table>
      </div>
      <button className="secondary" onClick={()=>commit({extras:[...cfg.extras,{id:`other-${Date.now()}`,item:"Other",quantity:1,unit:"job",rate:0}]})}>Add other cost</button>
      <details open>
        <summary>Purchasing BOM prices — separate from customer estimate</summary>
        <div className="fab-table price-table"><table>
          <thead><tr><th>Stock / hardware</th><th>Qty</th><th>Unit</th><th>Rate (LKR)</th><th>Total</th></tr></thead>
          <tbody>{estimate.purchasing.map(line=><tr key={line.key}>
            <td><strong>{line.item}</strong><small>{line.category}</small></td>
            <td><input aria-label={`${line.item} BOM quantity`} type="number" min="0" step="0.01" value={line.quantity} onChange={e=>bomQty(line,e.target.value)}/></td>
            <td>{line.unit}</td>
            <td><input aria-label={`${line.item} BOM rate`} type="number" min="0" step="1" value={line.rate} onChange={e=>bomRate(line,e.target.value)}/></td>
            <td>{money(line.total)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan="4">BOM reference subtotal</th><th>{money(estimate.purchasingTotal)}</th></tr></tfoot>
        </table></div>
      </details>
      <div className="fab-note">{estimate.sourceNote} The two totals are deliberately not added together.</div>
      <button className="primary" disabled={busy} onClick={exportCost}>{busy ? "Preparing PDF…" : "Download cost + BOM PDF"}</button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function ProfileSection() {
  const loop = (points) =>
    points.map(([d, f], i) => `${i ? "L" : "M"} ${d} ${-f}`).join(" ") + " Z";
  return (
    <div className="profile-detail">
      <svg
        viewBox="-9 -52 40 92"
        role="img"
        aria-label="Detailed web sash: hollow chamber, shelf, retaining channel and return lip; combined-engine grip adaptation"
      >
        <path
          d={`${loop(SASH_PROFILE.outer)} ${loop(SASH_PROFILE.inner)}`}
          fillRule="evenodd"
          fill="#526b6a"
        />
        <path d={loop(HANDLE_PROFILE.outer)} fill="#178c91" />
        <rect
          x={SASH_PROFILE.panelDepth}
          y="-25"
          width="3"
          height="15"
          fill="#dda64b"
        />
      </svg>
      <div>
        <h3>Detailed lipped sash — retained</h3>
        <p>
          45 mm face · 21.2 mm depth · 1.5 mm wall.
          <br />
          Hollow chamber, channel and return lip from Aluminum/sash.js. Gold
          shows the seated infill.
        </p>
        <p>
          Upper doors: bottom grip.
          <br />
          Base doors: top grip.
          <br />
          Sash body mitred; grip lip ends square.
        </p>
        <small>
          Teal grip adapted from the combined engine without replacing the web
          sash. This combined extrusion requires profile approval before
          manufacture.
        </small>
      </div>
    </div>
  );
}

export function FabricationResults({ job, onSelect }) {
  const front = job.bars.filter((p) => p.name === "Front upright").length,
    rear = job.bars.filter((p) => p.name === "Rear upright").length;
  return (
    <section className="fabrication-results">
      <h2>Stock cutting review</h2>
      <div className="fab-metrics">
        <span>
          <strong>{job.barNest.stocks.length}</strong> stock bars
        </span>
        <span>
          <strong>{job.sheetNest.sheets.length}</strong> sheets
        </span>
        <span>
          <strong>{job.bars.length}</strong> bar cuts
        </span>
        <span>
          <strong>{job.panels.length}</strong> panels
        </span>
      </div>
      <p>
        {front} shared front uprights · {rear} independently spaced rear
        uprights. Stock is separated by extrusion profile, material, finish and
        thickness.
      </p>
      <ProfileSection />
      {!!job.rejected.length && (
        <div className="fab-note">
          <h3>Parts exceeding stock</h3>
          {job.rejected.map((r) => (
            <p key={r.id}>
              {r.id}: {r.reason}
            </p>
          ))}
        </div>
      )}
      <details open>
        <summary>Nested bars — cuts, kerf and remainder</summary>
        <div className="bar-nests">
          {job.barNest.stocks.map((s) => (
            <article key={s.id}>
              <h4>
                {s.id} · {s.profile}
              </h4>
              <p>
                {fmt(s.length)} mm stock · {fmt(s.remaining)} mm remainder after
                kerf and trims
              </p>
              <div dangerouslySetInnerHTML={{ __html: barSVG(s) }} />
              <details>
                <summary>{s.cuts.length} cuts</summary>
                <p>
                  {s.cuts
                    .map((c) => `${c.id}: ${fmt(c.length)} mm`)
                    .join(" · ")}
                </p>
              </details>
            </article>
          ))}
        </div>
      </details>
      <details open>
        <summary>Nested sheets — real panel outlines</summary>
        <div className="sheet-nests">
          {job.sheetNest.sheets.map((s) => (
            <article key={s.id}>
              <h4>
                {s.id} · {s.material} {s.thickness} mm
              </h4>
              <p>
                {s.width} × {s.height} · {s.placements.length} parts ·{" "}
                {fmt(
                  (100 * s.placements.reduce((a, p) => a + p.w * p.h, 0)) /
                    (s.width * s.height),
                )}
                % blank-area use
              </p>
              <div dangerouslySetInnerHTML={{ __html: sheetSVG(s) }} />
            </article>
          ))}
        </div>
      </details>
      <details open>
        <summary>Stock & hardware BOM (review)</summary>
        <div className="fab-table">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {job.bom.map((p, i) => (
                <tr key={i}>
                  <td>{p.category}</td>
                  <td>{p.item}</td>
                  <td>{p.quantity}</td>
                  <td>{p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Panel schedule and U-notch count</summary>
        <div className="fab-table">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Name</th>
                <th>Blank (mm)</th>
                <th>U cuts</th>
              </tr>
            </thead>
            <tbody>
              {job.panels.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="text"
                      onClick={() => onSelect(p.unitIds[0])}
                    >
                      {p.id}
                    </button>
                  </td>
                  <td>{p.name}</td>
                  <td>
                    {fmt(p.cutW)} × {fmt(p.cutH)}
                  </td>
                  <td>
                    {p.notches
                      ? p.notches.front.length + p.notches.rear.length
                      : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Hinges and hardware by door</summary>
        <div className="fab-table">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Review status</th>
              </tr>
            </thead>
            <tbody>
              {job.hardware.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.item}</td>
                  <td>{p.qty}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Source and verification limits</summary>
        {job.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p>
          {provenance.files.length} unchanged source copies are archived under
          reference/fabrication. No originals were edited.
        </p>
      </details>
    </section>
  );
}
