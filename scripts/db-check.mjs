import '../server/env.js';
import pg from 'pg';
import {databaseOptions} from '../server/db.js';
if(!process.env.DATABASE_URL){console.error('DATABASE_URL is missing.');process.exit(1);}
const pool=new pg.Pool(databaseOptions(process.env.DATABASE_URL));
try{
  await pool.query('SELECT 1');
  const {rows}=await pool.query("SELECT table_schema, count(*)::int AS tables FROM information_schema.tables WHERE table_schema IN ('public','codex_kitchen','neon_auth') GROUP BY table_schema");
  console.log(JSON.stringify({databaseConnected:true,schemas:rows}));
  const url=`${process.env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`;
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});const jwks=await response.json();
  console.log(JSON.stringify({authJwksReachable:response.ok&&Array.isArray(jwks.keys),keyCount:jwks.keys?.length||0}));
}catch(error){console.error(JSON.stringify({connected:false,code:error.code||'CONNECTION_FAILED'}));process.exitCode=1;}
finally{await pool.end();}
