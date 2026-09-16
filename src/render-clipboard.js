export function renderClipboardItem(pack,Item=globalThis.ClipboardItem){
  if(!pack.clipboardSheet||!pack.prompt)throw Error('Prepare the rendering pack first.');
  return new Item({'text/plain':new Blob([pack.prompt],{type:'text/plain'}),'image/png':pack.clipboardSheet});
}
export async function prepareClipboardSheet(images){
  const loaded=await Promise.all(images.map(img=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({...img,image:im});im.onerror=()=>reject(Error('A reference image could not be prepared.'));im.src=img.url;})));
  const c=document.createElement('canvas'),cellW=1440,cellH=1040,pad=40;
  c.width=cellW*2;c.height=Math.ceil(loaded.length/2)*cellH+80;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#163c42';ctx.font='bold 32px Arial';ctx.fillText('CODEXKITCHEN / ALL REFERENCE VIEWS',pad,50);
  loaded.forEach((item,i)=>{
    const x=(i%2)*cellW+pad,y=Math.floor(i/2)*cellH+80,im=item.image;
    ctx.fillStyle='#163c42';ctx.font='25px Arial';ctx.fillText(item.name.replace('.png',''),x,y+35);
    const scale=Math.min((cellW-2*pad)/im.width,(cellH-100)/im.height);
    ctx.drawImage(im,x+(cellW-2*pad-im.width*scale)/2,y+60,im.width*scale,im.height*scale);
  });
  return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(Error('Could not create the clipboard image.')),'image/png'));
}
function requireClipboard(){if(!globalThis.isSecureContext||!navigator.clipboard?.write||!globalThis.ClipboardItem)throw Error('Image clipboard is unavailable. Download the image pack and use Copy prompt instead.');}
export async function copyRenderPack(pack){
  requireClipboard();
  if(!pack.clipboardSheet)throw Error('The image sheet could not be prepared. Copy individual images or download the ZIP.');
  try{await navigator.clipboard.write([renderClipboardItem(pack)]);}catch{throw Error('Clipboard permission was denied or this browser does not support image + text. Use Copy image and Copy prompt separately, or download the ZIP.');}
}
export async function copyRenderImage(image){
  requireClipboard();const blob=fetch(image.url).then(r=>r.blob());
  try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);}catch{throw Error('Could not copy this image. Click its thumbnail to download it.');}
}
