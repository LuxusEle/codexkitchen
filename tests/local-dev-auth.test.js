import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticate} from '../server/security.js';
import cloud from '../server/cloud.js';

function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};}

test('Zero-config local workspace serves a local session and the app-shaped /me',async()=>{
  assert.equal((await authenticate({headers:{authorization:'Bearer local-dev-1'}})).id,'local-user');
  const res=response();await cloud({url:'/api/cloud?op=me',method:'GET',headers:{authorization:'Bearer local-dev-1'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.user.id,'local-user');
  assert.equal(res.body.member.status,'active');assert.equal(res.body.member.admin,false);
});

test('Local fallback is disabled on Vercel and in production builds',async()=>{
  const before={vercel:process.env.VERCEL,nodeEnv:process.env.NODE_ENV};
  try{
    process.env.VERCEL='1';
    await assert.rejects(()=>authenticate({headers:{authorization:'Bearer local-dev-1'}}),e=>e.status===503);
    const res=response();await cloud({url:'/api/cloud?op=me',method:'GET',headers:{authorization:'Bearer local-dev-1'}},res);
    assert.equal(res.statusCode,503);
    delete process.env.VERCEL;process.env.NODE_ENV='production';
    await assert.rejects(()=>authenticate({headers:{authorization:'Bearer local-dev-1'}}),e=>e.status===503);
  }finally{
    if(before.vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=before.vercel;
    if(before.nodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before.nodeEnv;
  }
});

test('Explicit ALLOW_LOCAL_WORKSPACE opt-in serves the local session on Vercel',async()=>{
  const before={vercel:process.env.VERCEL,nodeEnv:process.env.NODE_ENV,flag:process.env.ALLOW_LOCAL_WORKSPACE};
  try{
    process.env.VERCEL='1';process.env.NODE_ENV='production';process.env.ALLOW_LOCAL_WORKSPACE='1';
    assert.equal((await authenticate({headers:{authorization:'Bearer local-dev-9'}})).id,'local-user');
    const res=response();await cloud({url:'/api/cloud?op=me',method:'GET',headers:{authorization:'Bearer local-dev-9'}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.user.id,'local-user');
  }finally{
    if(before.vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=before.vercel;
    if(before.nodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before.nodeEnv;
    if(before.flag===undefined)delete process.env.ALLOW_LOCAL_WORKSPACE;else process.env.ALLOW_LOCAL_WORKSPACE=before.flag;
  }
});
