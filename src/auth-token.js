// Fetch directly: the installed Neon SDK can return its cached session from token().
// Never substitute the opaque session cookie/token for the API's signed JWT.
export async function fetchAccessToken(fetcher=globalThis.fetch){
  const response=await fetcher('/api/auth/token',{method:'GET',credentials:'include',cache:'no-store'});
  const data=await response.json().catch(()=>null);
  if(!response.ok||typeof data?.token!=='string'||!data.token){
    throw Error(response.status===401?'Your session expired. Please sign in again.':`Could not obtain an access token (${response.status}). Please retry signing in.`);
  }
  return data.token;
}
