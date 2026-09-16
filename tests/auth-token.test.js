import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAccessToken} from '../src/auth-token.js';

test('access token uses authenticated uncached same-origin endpoint',async()=>{
  const token=await fetchAccessToken(async(path,options)=>{
    assert.equal(path,'/api/auth/token');
    assert.deepEqual(options,{method:'GET',credentials:'include',cache:'no-store'});
    return Response.json({token:'signed-api-jwt'});
  });
  assert.equal(token,'signed-api-jwt');
});
test('cached session is never accepted as an API token',async()=>{
  await assert.rejects(fetchAccessToken(async()=>Response.json({session:{token:'opaque-session'},user:{id:'user'}})),/access token/);
});
test('unauthenticated response requires sign-in',async()=>{
  await assert.rejects(fetchAccessToken(async()=>Response.json({message:'Unauthorized'},{status:401})),/session expired/);
});
