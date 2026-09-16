// Explicit host guard; credentials come from the parent process, never CLI output.
import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {eq} from 'drizzle-orm';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {databaseOptions} from '../server/db.js';
import {businesses,members,projects} from '../server/schema.js';
import {businessOperation,ownProjectFilter,loadBusiness} from '../server/business-service.js';
const url=process.env.DATABASE_URL_UNPOOLED,host=process.argv[2];
if(!url||!host||new URL(url).hostname!==host||host.includes('-pooler'))throw Error('Explicit direct host guard failed.');
const pool=new pg.Pool(databaseOptions(url));
const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
async function baseline(){return {
 projects:digest((await pool.query('select owner_id,id,name,document,revision from codex_kitchen.projects order by owner_id,id')).rows),
 members:digest((await pool.query('select id,email,username,name,status from codex_kitchen.members order by id')).rows),
 assets:digest((await pool.query('select * from codex_kitchen.assets order by id')).rows)};}
try{
 const before=await baseline();
 await migrate(drizzle(pool),{migrationsFolder:'drizzle'});
 assert.deepEqual(await baseline(),before,'Migration must preserve existing project/member/asset data');
 console.log('Migration passed; existing project, member and asset data unchanged.');
 if(process.argv.includes('--fixtures')){
  const client=await pool.connect();await client.query('BEGIN');
  try{
   const db=drizzle(client),owner=randomUUID(),other=randomUUID(),pid=randomUUID();
   await db.insert(members).values([{id:owner,email:'release-test@example.invalid',status:'active',businessId:'devonly'},{id:other,email:'release-other@example.invalid',status:'active',businessId:'luxus'}]);
   await db.insert(projects).values({id:pid,ownerId:owner,businessId:'devonly',name:'ROLLBACK ONLY QA',document:{name:'QA'},revision:1});
   assert.equal((await db.select().from(projects).where(ownProjectFilter({id:owner,businessId:'devonly'},pid))).length,1);
   for(const u of [{id:owner,businessId:'luxus'},{id:other,businessId:'devonly'}])assert.equal((await db.select().from(projects).where(ownProjectFilter(u,pid))).length,0);
   assert.equal((await db.select().from(projects).where(ownProjectFilter({admin:true},pid))).length,1);
   assert.equal((await loadBusiness(db,'devonly')).brand.bank,'');
   const user={id:owner,admin:true,username:'release-test'},projectFor=async(d,u,id)=>(await d.select().from(projects).where(ownProjectFilter(u,id)))[0];
   const request=body=>({headers:{'content-type':'application/json'},body});
   await businessOperation({db,user,op:'presence',method:'POST',req:request({projectId:pid,active:true}),projectFor});
   await businessOperation({db,user,op:'review',method:'PATCH',req:request({id:pid,revision:1,status:'approved',note:'QA transaction only'}),projectFor});
   const report=()=>businessOperation({db,user,op:'overview',method:'GET',url:new URL('https://test.invalid')});
   let overview=await report();assert.equal(overview.stats.find(s=>s.ownerId===owner).approved,1);
   await db.update(projects).set({revision:2,reviewStatus:'draft'}).where(eq(projects.id,pid));
   overview=await report();assert.equal(overview.stats.find(s=>s.ownerId===owner).approved,0);
   assert.equal((await db.select().from(businesses)).length,2);
   console.log('Live SQL isolation, presence, review and overview checks passed (fixtures rolled back).');
  }finally{await client.query('ROLLBACK');client.release();}
 }
 const counts=await pool.query('select (select count(*) from codex_kitchen.projects) projects,(select count(*) from codex_kitchen.members) members,(select count(*) from codex_kitchen.businesses) businesses');
 console.log('Post-migration counts:',counts.rows[0]);
}catch(e){console.error('Release check failed:',e.code||e.message);process.exitCode=1;}finally{await pool.end();}
