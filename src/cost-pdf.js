import { jsPDF } from "jspdf";

const money = (n) => `LKR ${Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
const qty = (n) => Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 });

export function costPdf(project, estimate) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const pageBottom = 279;
  const newPage = () => { doc.addPage(); y = 18; };
  const keep = (height) => { if (y + height > pageBottom) newPage(); };
  const title = (text) => {
    keep(14); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(text, 14, y); y += 9;
  };
  const text = (value, size = 8.5, style = "normal") => {
    doc.setFont("helvetica", style); doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(value), 182);
    keep(lines.length * 4 + 2); doc.text(lines, 14, y); y += lines.length * 4 + 2;
  };
  const table = (lines, totalLabel, total) => {
    const widths = [76, 22, 18, 28, 30], xs = [14];
    for (const w of widths) xs.push(xs.at(-1) + w);
    const header = () => {
      keep(10); doc.setFillColor(25, 70, 75); doc.rect(14, y - 4, 174, 8, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      ["Item", "Qty", "Unit", "Rate", "Total"].forEach((v, i) => doc.text(v, xs[i] + 1.5, y));
      doc.setTextColor(20); y += 7;
    };
    header();
    for (const line of lines) {
      if (y + 10 > pageBottom) { newPage(); header(); }
      const itemLines = doc.splitTextToSize(line.item, widths[0] - 3).slice(0, 2);
      const h = Math.max(8, itemLines.length * 3.5 + 2);
      doc.setDrawColor(215); doc.line(14, y + h - 3, 188, y + h - 3);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.3);
      doc.text(itemLines, xs[0] + 1.5, y);
      doc.text(qty(line.quantity), xs[1] + 1.5, y);
      doc.text(line.unit, xs[2] + 1.5, y);
      doc.text(money(line.rate), xs[3] + 1.5, y);
      doc.text(money(line.total), xs[4] + 1.5, y);
      y += h;
    }
    keep(10); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(totalLabel, 108, y); doc.text(money(total), 188, y, { align: "right" }); y += 9;
  };

  doc.setProperties({ title: `${project.name} cost and BOM review`, subject: "Editable UAT estimate and purchasing BOM" });
  doc.setTextColor(17, 61, 66); doc.setFont("helvetica", "bold"); doc.setFontSize(19);
  doc.text("CODEX KITCHEN", 14, y); y += 8;
  text(`${project.name} | Cost estimate + purchasing BOM`, 11, "bold");
  text(`Generated ${new Date().toLocaleDateString("en-LK")} | UAT 1 review — prices are editable and not a supplier quotation.`, 8);
  title("Customer estimate"); table(estimate.sales, "Estimate total", estimate.salesTotal);
  title("Stock and hardware purchasing BOM"); table(estimate.purchasing, "BOM reference subtotal", estimate.purchasingTotal);
  title("Pricing basis"); text(estimate.sourceNote, 8);
  text("The customer estimate and purchasing BOM are separate totals. Do not add them together: the linear-foot selling rates may already include materials and labour.", 8, "bold");
  text("Confirm extrusion profiles, quantities, wastage, transport, taxes, hardware brands, installation scope and current supplier quotations before issue.", 8);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(100);
    doc.text(`ENGINEERING / PRICE REVIEW ONLY   •   Page ${i} of ${pages}`, 105, 291, { align: "center" });
  }
  return doc;
}
