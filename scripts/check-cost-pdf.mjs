import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initialProject, solve } from '../src/model.js';
import { fabricationPlan } from '../src/fabrication.js';
import { kitchenEstimate } from '../src/costing.js';
import { costPdf } from '../src/cost-pdf.js';

const p=initialProject(),plan=solve(p),job=fabricationPlan(p,plan),estimate=kitchenEstimate(p,plan,job);
assert.ok(estimate.salesTotal>0&&estimate.purchasingTotal>0);
const doc=costPdf(p,estimate);
assert.ok(doc.getNumberOfPages()>=1);
mkdirSync('tmp/pdf-check',{recursive:true});
writeFileSync('tmp/pdf-check/kitchen-cost-and-bom-REVIEW.pdf',Buffer.from(doc.output('arraybuffer')));
console.log(`Cost PDF checked: ${doc.getNumberOfPages()} pages; ${estimate.sales.length} estimate lines; ${estimate.purchasing.length} BOM lines.`);
