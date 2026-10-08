import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OUTPUT_TABS, tabCount, workshopModel, outputSheets, workshopCsv } from './output-sheets.js';
import { downloadCuttingZip, downloadAssemblyPdf, downloadCostPdf } from './workshop-pack.js';
import { download } from './exports.js';
import './output-window.css';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kitchen';

// One sheet, scaled to the panel width on screen; print CSS resets the scale
// so Print / Save PDF is always 100% paper size.
function FitSheet({ sheet, containerRef }) {
  const innerRef = useRef(null);
  const [box, setBox] = useState(null);
  useEffect(() => {
    const inner = innerRef.current;
    const cont = containerRef.current;
    if (!inner || !cont) return undefined;
    const section = inner.querySelector('.ow-sheet');
    if (!section) return undefined;
    const recompute = () => {
      const natW = section.offsetWidth;
      const natH = section.offsetHeight;
      if (!natW || !natH) return;
      const avail = Math.max(300, cont.clientWidth - 30);
      const scale = Math.min(1, avail / natW);
      setBox((prev) => (prev && prev.w === natW && prev.h === natH && Math.abs(prev.scale - scale) < 0.0005 ? prev : { w: natW, h: natH, scale }));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(cont);
    ro.observe(section);
    if (document.fonts?.ready) document.fonts.ready.then(recompute).catch(() => {});
    const t = setTimeout(recompute, 120);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [containerRef, sheet.html]);
  return (
    <div className="ow-fit" style={box ? { width: box.w * box.scale, height: box.h * box.scale } : undefined}>
      <div ref={innerRef} className="ow-fit-inner" style={box ? { width: box.w, transform: `scale(${box.scale})` } : undefined} dangerouslySetInnerHTML={{ __html: sheet.html }} />
    </div>
  );
}

export default function OutputWindow({ p, plan, job, estimate, onClose, initialTab = 'Stocks' }) {
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const bodyRef = useRef(null);
  const model = useMemo(() => workshopModel(p, plan, job, estimate), [p, plan, job, estimate]);
  const sheets = useMemo(() => outputSheets(model, tab), [model, tab]);
  const blocked = !!(job.errors?.length || job.rejected?.length);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const printSheets = useCallback(async () => {
    setBusy('print');
    setMessage('');
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (document.fonts?.ready) await document.fonts.ready;
      document.body.classList.add('ow-printing');
      window.print();
    } catch (e) {
      setMessage(e?.message || 'Print failed.');
    } finally {
      document.body.classList.remove('ow-printing');
      setBusy('');
    }
  }, []);

  const exportCsv = useCallback(() => {
    try {
      download(new Blob([workshopCsv(model, tab)], { type: 'text/csv;charset=utf-8' }), `${slug(p?.name)}-${slug(tab)}.csv`);
      setMessage(`${tab} CSV downloaded.`);
    } catch (e) {
      setMessage(e?.message || 'CSV export failed.');
    }
  }, [model, tab, p]);

  const run = useCallback((key, fn, done) => {
    setBusy(key);
    setMessage('');
    Promise.resolve()
      .then(fn)
      .then(() => setMessage(done))
      .catch((e) => setMessage(e?.message || 'Export failed.'))
      .finally(() => setBusy(''));
  }, []);

  return createPortal(
    <div className="ow-win" role="dialog" aria-modal="true" aria-label="Project outputs">
      <div className="ow-panel">
        <header className="ow-win-head">
          <div>
            <span className="ow-eyebrow">PROJECT OUTPUTS · WORKSHOP REVIEW</span>
            <h2>{model.project.name}</h2>
            <p>Reports, BOMs, quotes, cut lists, cut plans, bar PDFs and stickers — previewed here, exported from here.</p>
          </div>
          <div className="ow-win-head-actions">
            <span className="ow-review-badge">ENGINEERING REVIEW · NOT FOR MACHINING</span>
            <button className="secondary compact" onClick={onClose} aria-label="Close outputs window">Close</button>
          </div>
        </header>

        <div className="ow-win-tools">
          <span className="ow-counts">
            <b>{model.counts.bars}</b> bars · <b>{model.counts.pieces}</b> cut pieces · <b>{model.counts.sheets}</b> sheets · <b>{model.counts.panels}</b> panels · <b>{model.counts.runs}</b> frames
          </span>
          <div className="ow-tool-buttons">
            <button className="primary compact" onClick={printSheets} disabled={busy === 'print'}>{busy === 'print' ? 'Preparing…' : 'Print / Save PDF'}</button>
            <button className="secondary compact" onClick={exportCsv}>CSV</button>
            <button className="secondary compact" disabled={blocked || busy === 'zip'} onClick={() => run('zip', () => downloadCuttingZip(job), 'Cutting ZIP downloaded.')}>Cutting ZIP</button>
            <button className="secondary compact" disabled={!model.counts.runs} onClick={() => run('asm', () => downloadAssemblyPdf(job, 'all'), 'Frame assembly PDF downloaded.')}>Frame assembly PDF</button>
            <button className="secondary compact" onClick={() => run('cost', () => downloadCostPdf(p, estimate), 'Cost + BOM PDF downloaded.')}>Cost + BOM PDF</button>
          </div>
        </div>

        <nav className="ow-tabs">
          {OUTPUT_TABS.map((t) => {
            const n = tabCount(model, t);
            return (
              <button key={t} className={`ow-tab${t === tab ? ' is-on' : ''}`} onClick={() => setTab(t)}>
                {t}
                {n != null && <span className="ow-tab-count">{n}</span>}
              </button>
            );
          })}
        </nav>

        <div className="ow-win-body" ref={bodyRef}>
          {sheets.map((s) => <FitSheet key={`${tab}-${s.id}`} sheet={s} containerRef={bodyRef} />)}
        </div>

        <footer className="ow-win-foot">
          <span>{message || 'Sheets follow the new review design — reopen after any design edit.'}</span>
          <span>{tab} · {sheets.length} sheet{sheets.length === 1 ? '' : 's'}{blocked ? ' · design has blockers — preview only' : ''}</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
