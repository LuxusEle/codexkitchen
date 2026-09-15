import {createAuthClient} from '@neondatabase/neon-js/auth';
import {put} from '@vercel/blob/client';

const authUrl=import.meta.env.VITE_NEON_AUTH_URL;
export const authClient=authUrl?createAuthClient(authUrl,{fetchOptions:{credentials:'include'}}):null;
export async function cloudRequest(op,{method='GET',body,params={},raw=false}={}){
  if(!authClient)throw Error('Neon Auth is not configured.');
  const result=await authClient.token();
  if(result.error||!result.data?.token)throw Error('Sign in again. If blocked, allow this app domain in Neon Auth and allow its session cookie.');
  const response=await fetch(`/api/cloud?${new URLSearchParams({op,...params})}`,{
    method,headers:{Authorization:`Bearer ${result.data.token}`,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,cache:'no-store',
  });
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||`Cloud request failed (${response.status}).`);}
  return raw?response:response.json();
}
export async function uploadProjectFile(projectId,file,onProgress){
  if(file.size>25*1024*1024)throw Error('Files must be 25 MB or less.');
  const {asset}=await cloudRequest('asset-init',{method:'POST',body:{projectId,name:file.name,contentType:file.type,size:file.size}});
  // Explicit authenticated handshake; the short-lived token is restricted to this one file.
  const ticket=await cloudRequest('blob-upload',{method:'POST',body:{type:'blob.generate-client-token',payload:{pathname:asset.pathname,clientPayload:JSON.stringify({assetId:asset.id}),multipart:file.size>4*1024*1024}}});
  await put(asset.pathname,file,{access:'private',contentType:file.type,token:ticket.clientToken,multipart:file.size>4*1024*1024,onUploadProgress:onProgress});
  // Verified HEAD makes local development independent of a public webhook callback.
  return cloudRequest('asset-complete',{method:'POST',body:{id:asset.id}});
}
