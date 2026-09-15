import './env.js';
import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {attachDatabasePool} from '@vercel/functions';
let database;
export function databaseOptions(connectionString){
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('DATABASE_URL must be PostgreSQL.');
  // Strip pg's URL SSL overrides; enforce certificate validation explicitly.
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding'])url.searchParams.delete(key);
  return {connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,
    max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,statement_timeout:15000};
}
export function getDb(){
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is not configured.');
  if(!database){const pool=new pg.Pool(databaseOptions(process.env.DATABASE_URL));
    pool.on('error',()=>console.error('Kitchen database pool connection error.'));
    if(process.env.VERCEL)attachDatabasePool(pool);
    database=drizzle(pool);
  }
  return database;
}
