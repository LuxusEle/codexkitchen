import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {Readable} from 'node:stream';
import {createTokenVerifier,fileInput,validId,readJson,MAX_FILE_SIZE} from '../server/security.js';
import {databaseOptions} from '../server/db.js';
import cloud,{isAdmin} from '../server/cloud.js';

const base='https://ep-test.neonauth.us-east-2.aws.neon.tech/neondb/auth',origin=new URL(base).origin;
const {privateKey,publicKey}=await generateKeyPair('EdDSA');
const keys=createLocalJWKSet({keys:[{...await exportJWK(publicKey),kid:'test'}]});
const verify=createTokenVerifier(base,keys);
async function token(payload={},opts={}){return new SignJWT({email:'tester@example.com',emailVerified:true,...payload}).setProtectedHeader({alg:'EdDSA',kid:'test'}).setSubject('test-user').setIssuer(opts.issuer||origin).setAudience(opts.audience||origin).setIssuedAt().setExpirationTime(opts.exp||'5m').sign(privateKey);}

test('Neon verifier checks signature, issuer, audience, expiration and banned status',async()=>{
  assert.equal((await verify(await token())).id,'test-user');
  await assert.rejects(()=>verify(token));
  await assert.rejects(()=>verify('unsigned-token'));
  for(const opts of [{issuer:'https://other.test'},{audience:'https://other.test'},{exp:'-1s'}])await assert.rejects(()=>token({},opts).then(verify));
  await assert.rejects(()=>token({banned:true}).then(verify));
  const other=await generateKeyPair('EdDSA');
  await assert.rejects(()=>new SignJWT({}).setProtectedHeader({alg:'EdDSA',kid:'test'}).setSubject('forged').setIssuer(origin).setAudience(origin).setIssuedAt().setExpirationTime('5m').sign(other.privateKey).then(verify));
});
test('Administrator requires the configured email AND verified email claim',()=>{
  const before=process.env.ADMIN_EMAIL,beforeId=process.env.ADMIN_USER_ID;delete process.env.ADMIN_USER_ID;process.env.ADMIN_EMAIL='owner@example.com';
  try{assert.equal(isAdmin({email:'owner@example.com',emailVerified:false}),false);assert.equal(isAdmin({email:'stranger@example.com',emailVerified:true}),false);assert.equal(isAdmin({email:'OWNER@example.com',emailVerified:true}),true);}
  finally{if(before===undefined)delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=before;if(beforeId!==undefined)process.env.ADMIN_USER_ID=beforeId;}
});
test('Files restrict types, paths, sizes and ids',()=>{
  assert.equal(fileInput({name:'reference.png',contentType:'image/png',size:200}).name,'reference.png');
  for(const input of [{name:'../x.png',contentType:'image/png',size:1},{name:'x.html',contentType:'text/html',size:1},{name:'x.png',contentType:'image/png',size:MAX_FILE_SIZE+1}])assert.throws(()=>fileInput(input));
  assert.throws(()=>validId('../another-user'));assert.equal(validId('0aeda456-5658-4b7c-8826-df17ba523ac0'),'0aeda456-5658-4b7c-8826-df17ba523ac0');
});
test('JSON parser limits pre-parsed and streaming bodies and rejects bad types',async()=>{
  await assert.rejects(()=>readJson({headers:{'content-type':'text/plain'},body:{}}),e=>e.status===415);
  await assert.rejects(()=>readJson({headers:{'content-type':'application/json'},body:{long:'abcdefgh'}},4),e=>e.status===413);
  const req=Readable.from(['{"ok":true}']);req.headers={'content-type':'application/json'};
  assert.deepEqual(await readJson(req),{ok:true});
});
test('Database TLS cannot be weakened by sslmode in a supplied URL',()=>{
  const options=databaseOptions('postgresql://user:placeholder@example.test/db?sslmode=no-verify');
  assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.ok(!options.connectionString.includes('sslmode'));assert.equal(options.enableChannelBinding,true);
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};}
test('Cloud configuration reveals presence, never credentials',async()=>{
  const res=response();await cloud({url:'/api/cloud?op=config',method:'GET',headers:{}},res);
  assert.equal(res.statusCode,200);assert.deepEqual(Object.keys(res.body).sort(),['authConfigured','databaseConfigured','storageConfigured']);
  assert.equal(Object.values(res.body).every(v=>typeof v==='boolean'),true);
});
test('Anonymous requests cannot read projects or manage members',async()=>{
  for(const op of ['projects','project','members','assets']){
    const res=response();await cloud({url:`/api/cloud?op=${op}`,method:'GET',headers:{}},res);
    assert.ok([401,503].includes(res.statusCode));assert.ok(!res.body.projects&&!res.body.members);
  }
});
