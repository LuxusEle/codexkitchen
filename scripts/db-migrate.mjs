import '../server/env.js';
import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {databaseOptions} from '../server/db.js';
import {fileURLToPath} from 'node:url';
const url=process.env.DATABASE_URL_UNPOOLED;
if(!url||new URL(url).hostname.includes('-pooler'))throw Error('Set a DIRECT development-branch DATABASE_URL_UNPOOLED before migration.');
const pool=new pg.Pool(databaseOptions(url));
try{await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../drizzle',import.meta.url))});console.log('Kitchen migrations applied.');}
catch(error){console.error('Migration failed.',error.code||'MIGRATION_ERROR');process.exitCode=1;}
finally{await pool.end();}
