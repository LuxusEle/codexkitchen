import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierBarRate, materialPricingSettings, MATERIAL_SUPPLIERS} from '../src/material-prices.js';

test('Alumex 2026 frame price keeps the published 0.9 mm source distinct from the 1.2 mm estimate',()=>{
  const job={settings:{barLength:6400,sashLength:6400,handleLength:3000}};
  const quote=supplierBarRate({item:'BOX_25.4x38.1x1.2 / #123 / 6400'},job,{supplier:'alumex',finish:'PC'});
  assert.equal(MATERIAL_SUPPLIERS.alumex.frame.prices.PC,7285);
  assert.equal(quote.status,'estimated');
  assert.equal(quote.rate,10803);
  assert.match(quote.source,/P-1115T.*0\.9 mm/);
  assert.match(quote.warning,/1\.2 mm.*6%/);
});

test('supplier settings reject unsupported finishes and retain Alco selection',()=>{
  assert.deepEqual(materialPricingSettings({costing:{materialPricing:{supplier:'alco',finish:'CG'}}}),{supplier:'alco',finish:'PC'});
  assert.deepEqual(materialPricingSettings({costing:{materialPricing:{supplier:'alco',finish:'WF'}}}),{supplier:'alco',finish:'WF'});
});
