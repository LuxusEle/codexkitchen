import test from 'node:test';
import assert from 'node:assert/strict';
import {usernameInput,staffInput,checkOrigin,browserCookie,neonCookie,enforceVerification} from '../server/auth-service.js';
import {isAdmin,owned} from '../server/cloud.js';
import {projects} from '../server/schema.js';
import {PgDialect} from 'drizzle-orm/pg-core';
test('Username-only staff needs no email, but email checkbox requires a real address',()=>{
  assert.equal(usernameInput(' Operator1 '),'operator1');
  assert.throws(()=>usernameInput('x@y.com'));
  assert.throws(()=>staffInput({username:'staff',password:'123456'},true));
  assert.equal(staffInput({username:'staff',password:'sample-password'},true).requireEmailVerification,false);
  assert.throws(()=>staffInput({username:'staff',password:'sample-password',requireEmailVerification:true},true));
  assert.equal(staffInput({username:'staff',password:'sample-password',requireEmailVerification:true,email:'Staff@example.com'},true).email,'staff@example.com');
});
test('Pinned super-admin uses verified JWT identity, never an editable username/email',()=>{
  const previous=process.env.ADMIN_USER_ID;process.env.ADMIN_USER_ID='owner-id';
  try{assert.equal(isAdmin({id:'owner-id',emailVerified:false}),true);assert.equal(isAdmin({id:'someone-else',email:process.env.ADMIN_EMAIL,emailVerified:true}),false);}
  finally{if(previous===undefined)delete process.env.ADMIN_USER_ID;else process.env.ADMIN_USER_ID=previous;}
});
test('Only super-admin can omit project owner filtering',()=>{
  const dialect=new PgDialect(),id='0aeda456-5658-4b7c-8826-df17ba523ac0';
  assert.match(dialect.sqlToQuery(owned(projects,{id:'staff'},id)).sql,/owner_id/);
  assert.doesNotMatch(dialect.sqlToQuery(owned(projects,{id:'owner',admin:true},id)).sql,/owner_id/);
});
test('Email opt-in checks verification AND current email; username-only staff is not blocked',()=>{
  assert.doesNotThrow(()=>enforceVerification({requireEmailVerification:false},{emailVerified:false}));
  assert.throws(()=>enforceVerification({requireEmailVerification:true,email:'new@example.com'},{emailVerified:true,email:'old@example.com'}));
  assert.doesNotThrow(()=>enforceVerification({requireEmailVerification:true,email:'staff@example.com'},{emailVerified:true,email:'staff@example.com'}));
});
test('Auth proxy rejects cross-site requests and forwards only Neon auth cookies',()=>{
  const before=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://kitchen.example.com';
  try{assert.throws(()=>checkOrigin({headers:{origin:'https://evil.example.com'}}));assert.equal(checkOrigin({headers:{origin:process.env.APP_ORIGIN}}),process.env.APP_ORIGIN);}
  finally{if(before===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=before;}
  assert.equal(neonCookie('other=private; __Secure-neon-auth.session_token=abc'),'__Secure-neon-auth.session_token=abc');
  const cookie=browserCookie('neon-auth.session_token=abc; Domain=neon.tech; HttpOnly; Secure; Path=/neondb/auth; SameSite=None');
  assert.doesNotMatch(cookie,/Domain=|SameSite=None/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Path=\//);
});
