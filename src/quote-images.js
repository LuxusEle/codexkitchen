export const MAX_IMAGE_BYTES=15*1024*1024;
export function checkImageFile(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose JPG, PNG or WebP renders (not PDF, SVG or HEIC).');
  if(!file.size||file.size>MAX_IMAGE_BYTES)throw Error('Each image must be smaller than 15 MB.');
}
// Local canvas processing only; originals are neither overwritten nor uploaded.
export async function watermarkRender(file,branding={watermark:'LUXUS',name:'LUXUS ELEMENTE'}) {
  checkImageFile(file);
  const src=URL.createObjectURL(file), img=new Image();
  try {
    img.src=src; await img.decode();
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40e6)throw Error('Image exceeds the 40 megapixel limit. Resize it before uploading.');
    const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing is unavailable in this browser.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    drawLuxusWatermark(ctx,canvas.width,canvas.height,branding);
    return {id:crypto.randomUUID(),name:file.name.slice(0,150),caption:'',url:canvas.toDataURL('image/jpeg',.88),width:canvas.width,height:canvas.height};
  } catch(error) {throw Error(`Could not prepare ${file.name}: ${error.message}`);} finally {URL.revokeObjectURL(src);}
}
export function drawLuxusWatermark(ctx,width,height,branding={watermark:'LUXUS',name:'LUXUS ELEMENTE'}) {
  ctx.save();ctx.translate(width/2,height/2);ctx.rotate(-Math.PI/9);
  ctx.font=`600 ${Math.max(24,Math.min(width,height)*.105)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
  const mark=branding.watermark||branding.name;ctx.globalAlpha=.16;ctx.lineWidth=2;ctx.strokeStyle='#222';ctx.fillStyle='#fff';ctx.strokeText(mark,0,0,width*.8);ctx.fillText(mark,0,0,width*.8);ctx.restore();
  ctx.save();ctx.globalAlpha=.48;ctx.font=`${Math.max(12,width*.012)}px Arial`;ctx.textAlign='right';ctx.fillStyle='#fff';
  ctx.shadowColor='#111';ctx.shadowBlur=3;ctx.fillText(branding.name,width-width*.025,height-height*.03,width*.9);ctx.restore();
}
