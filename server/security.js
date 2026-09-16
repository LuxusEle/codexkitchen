import {createRemoteJWKSet,jwtVerify} from 'jose';
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const MAX_FILE_SIZE=25*1024*1024;
export const FILE_TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf','application/zip':'zip','application/json':'json','text/plain':'txt'};
let verifier;
export function createTokenVerifier(baseUrl,keys){
  const url=new URL(baseUrl),issuer=url.origin;
  if(url.protocol!=='https:')throw Error('Neon Auth requires HTTPS.');
  const jwks=keys||createRemoteJWKSet(new URL(`${baseUrl.replace(/\/$/,'')}/.well-known/jwks.json`));
  return async token=>{
    const {payload}=await jwtVerify(token,jwks,{issuer,audience:issuer,algorithms:['EdDSA'],requiredClaims:['exp','iat','sub']});
    if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>200||payload.banned===true)throw new HttpError(401,'Sign in again.');
    return {id:payload.sub,email:typeof payload.email==='string'?payload.email:'',emailVerified:payload.emailVerified===true,issuedAt:payload.iat};
  };
}
export async function authenticate(req){
  const match=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'');
  if(!match||match[1].length>16000)throw new HttpError(401,'Sign in to use cloud projects.');
  if(!process.env.NEON_AUTH_BASE_URL)throw new HttpError(503,'Neon Auth is not configured.');
  verifier ||= createTokenVerifier(process.env.NEON_AUTH_BASE_URL);
  try{return await verifier(match[1]);}catch{throw new HttpError(401,'Your session expired or is invalid. Sign in again.');}
}
export function validId(value){if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw new HttpError(400,'Invalid project or asset ID.');return value;}
export function fileInput(input){
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>180||/[\x00-\x1f\\/]/.test(input.name))throw new HttpError(400,'Use a filename without folders (max 180 characters).');
  if(!FILE_TYPES[input.contentType])throw new HttpError(400,'Choose a PNG, JPEG, WebP, PDF, ZIP, JSON or text file.');
  if(!Number.isInteger(input.size)||input.size<1||input.size>MAX_FILE_SIZE)throw new HttpError(400,'File must be between 1 byte and 25 MB.');
  return {name:input.name.trim(),contentType:input.contentType,size:input.size};
}
export async function readJson(req,limit=2*1024*1024){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'Expected application/json.');
  if(Number(req.headers['content-length'])>limit)throw new HttpError(413,'Request is too large.');
  if(req.body!==undefined){const value=Buffer.isBuffer(req.body)?req.body.toString():req.body;
    if(Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value))>limit)throw new HttpError(413,'Request is too large.');
    try{return typeof value==='string'?JSON.parse(value):value;}catch{throw new HttpError(400,'Invalid JSON.');}
  }
  let bytes=0;const chunks=[];for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>limit)throw new HttpError(413,'Request is too large.');chunks.push(Buffer.from(chunk));}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new HttpError(400,'Invalid JSON.');}
}
