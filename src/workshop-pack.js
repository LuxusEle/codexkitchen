// Shared workshop downloads used by both the Fabrication panel and the
// Workshop pack step: cutting ZIP, frame assembly PDF, cost + BOM PDF.
import { zipSync, strToU8 } from 'fflate';
import { download } from './exports.js';
import { fabricationFiles, sheetDXF } from './fabrication.js';
import provenance from '../reference/fabrication/manifest.json';

export function downloadCuttingZip(job,name='kitchen-cutting-REVIEW.zip'){
  const files=fabricationFiles(job);
  files['source-provenance.json']=JSON.stringify(provenance,null,2);
  download(
    new Blob([zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])))],{type:'application/zip'}),
    name,
  );
}
export function downloadSheetDXF(sheet,name=`${sheet.id}-ACPCNC.dxf`){
  download(new Blob([sheetDXF(sheet)],{type:'application/dxf'}),name);
}
export async function downloadAssemblyPdf(job,runId='all'){
  const {assemblyPdf}=await import('./assembly-pdf.js');
  const doc=assemblyPdf(job,runId);
  download(new Blob([doc.output('arraybuffer')],{type:'application/pdf'}),`frame-${runId}-assembly-REVIEW.pdf`);
}
export async function downloadCostPdf(p,estimate){
  const {costPdf}=await import('./cost-pdf.js');
  const doc=costPdf(p,estimate);
  download(new Blob([doc.output('arraybuffer')],{type:'application/pdf'}),'kitchen-cost-and-bom-REVIEW.pdf');
}
