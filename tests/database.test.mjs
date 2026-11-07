import test from 'node:test';
import assert from 'node:assert/strict';
import { getMockDashboard, loadDashboard, dashboardResponse } from '../lib/dashboard-data.mjs';
const mock=await getMockDashboard();
const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY'};
const logger={warn(){}};
const p={...mock.profile,remaining:mock.summary.remaining,monthly_limit:mock.summary.limit,as_of:mock.asOf,period_label:mock.periodLabel};
function database({profile=[p],wardrobe=mock.wardrobe,records=mock.recent}={}){
 const tables={ieobom_profiles:profile,ieobom_wardrobe:wardrobe,ieobom_outfits:records.map(({date,...r})=>({...r,worn_on:date}))};
 return async(url,init)=>{
  assert.equal(init.headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(init.headers.Authorization,undefined);
  assert.ok(!url.includes(env.SUPABASE_SECRET_KEY));assert.equal(init.cache,'no-store');
  const u=new URL(url),table=u.pathname.split('/').pop(),offset=Number(u.searchParams.get('offset')),limit=Number(u.searchParams.get('limit'));
  assert.ok(u.searchParams.has(table==='ieobom_profiles'?'id':'profile_id'));
  return Response.json(tables[table].slice(offset,offset+limit));
 };
}
test('DB values map to the exact dashboard shape, current counters and real source header',async()=>{
 const response=await dashboardResponse({env,logger,fetcher:database({profile:[{...p,style:'changed in DB'}],wardrobe:mock.wardrobe.slice(0,11)})});
 assert.equal(response.status,200);assert.equal(response.headers.get('x-data-source'),'db');assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();assert.deepEqual(Object.keys(data).sort(),Object.keys(mock).sort());
 assert.equal(data.profile.style,'changed in DB');assert.equal(data.summary.wardrobeCount,11);assert.deepEqual(data.recent,mock.recent);
 assert.equal(JSON.stringify(data).includes(env.SUPABASE_SECRET_KEY),false);
});
test('empty successful child tables remain empty and pagination reads all records',async()=>{
 const empty=await loadDashboard({env,logger,fetcher:database({wardrobe:[],records:[]})});assert.equal(empty.source,'db');assert.deepEqual(empty.data.recent,[]);assert.equal(empty.data.summary.wardrobeCount,0);
 const records=Array.from({length:205},(_,i)=>({...mock.recent[i%20],id:'row-'+i}));
 const all=await loadDashboard({env,logger,fetcher:database({records})});assert.equal(all.source,'db');assert.equal(all.data.recent.length,205);
});
test('missing config, HTTP errors, malformed data and incomplete profile fall back without leaking details',async()=>{
 const noConfig=await dashboardResponse({env:{},fetcher:()=>assert.fail('No request without config')});assert.equal(noConfig.headers.get('x-data-source'),'mock');assert.equal(noConfig.headers.get('x-data-fallback'),'missing_config');
 const variants=[async()=>new Response('secret error',{status:401}),async()=>Response.json({error:'secret'}),async()=>{throw Error('secret transport detail')},database({profile:[]}),database({profile:[{...p,style:null}]})];
 for(const fetcher of variants){const response=await dashboardResponse({env,logger,fetcher});assert.equal(response.status,200);assert.equal(response.headers.get('x-data-source'),'mock');assert.equal(response.headers.get('x-data-fallback'),'db_unavailable');assert.deepEqual(await response.json(),mock);}
});
test('DB timeout aborts outstanding requests and returns the local JSON',async()=>{
 const result=await loadDashboard({env,logger,timeoutMs:5,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});
 assert.equal(result.source,'mock');assert.equal(result.reason,'db_timeout');assert.deepEqual(result.data,mock);
});

test('public permission checks use only publishable keys and cannot mutate existing rows',async()=>{
 const {checkPublicAccess}=await import('../lib/database-check.mjs');
 const publicEnv={...env,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY'};
 const seen=[];
 const fetcher=async(url,init)=>{
  seen.push(init.method);assert.equal(init.headers.apikey,publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  assert.equal(JSON.stringify({url,init}).includes(env.SUPABASE_SECRET_KEY),false);
  if(init.method==='GET')return Response.json([{id:'example'}],{headers:{'Content-Range':'0-0/20'}});
  if(init.method==='POST'){const row=JSON.parse(init.body);assert.match(row.id,/^permission-probe-/);assert.ok(row.style===null||row.profile_id===null);}
  else assert.match(new URL(url).searchParams.get('id'),/^eq.permission-probe-/);
  return Response.json({code:'42501',message:'permission denied'},{status:401});
 };
 const result=await checkPublicAccess({env:publicEnv,fetcher});assert.equal(result.ok,true);assert.equal(result.rows.length,12);assert.equal(seen.length,12);
 const empty=await checkPublicAccess({env:publicEnv,fetcher:async(url,init)=>init.method==='GET'?Response.json([],{headers:{'Content-Range':'*/0'}}):Response.json({code:'42501'},{status:401})});assert.equal(empty.ok,false);
 const bad=await checkPublicAccess({env:publicEnv,fetcher:async()=>Response.json({code:'23502'},{status:400})});assert.equal(bad.ok,false);
 const noKey=await checkPublicAccess({env:{...publicEnv,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_SECRET_KEY},fetcher:()=>assert.fail('Must reject secret key')});assert.equal(noKey.ok,false);
});
