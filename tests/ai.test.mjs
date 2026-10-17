import test from 'node:test';
import assert from 'node:assert/strict';
import {getDashboard} from '../lib/dashboard-data.mjs';
import {normalizeInput,validateAnalysis,exampleAnalysis,suggestOutfits,usageCost,DEFAULT_MODEL} from '../lib/ai.mjs';
const mock=await getDashboard();
const input=normalizeInput({source:'mock',occasion:'출근'},mock);
const valid=exampleAnalysis(input);
const env={LLM_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY',LLM_MODEL:DEFAULT_MODEL};
function provider(value=valid,meta={promptTokenCount:800,candidatesTokenCount:600,thoughtsTokenCount:100,totalTokenCount:1500}){return async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:meta}),{status:200});}
test('mock source is server-owned; custom input is bounded',()=>{
 assert.equal(normalizeInput({source:'mock',wardrobe:[],profile:{}},mock).wardrobe.length,12);
 assert.throws(()=>normalizeInput({source:'local',wardrobe:[],profile:{}},mock));
 assert.throws(()=>normalizeInput({note:'a'.repeat(301)},mock));
 assert.throws(()=>normalizeInput({source:'local',wardrobe:mock.wardrobe.map((w,i)=>({...w,id:i===1?'w01':w.id})),profile:mock.profile},mock));
});
test('reject unknown clothing IDs and incomplete or malformed outputs',()=>{
 assert.deepEqual(validateAnalysis(valid,input),valid);
 for(const change of [v=>v.outfits.pop(),v=>v.outfits[0].itemIds[0]='invented',v=>v.summary='',v=>v.outfits[0].itemIds=['w01','w02','w03'],v=>v.outfits[0].reason='x'.repeat(241)]){
 const v=structuredClone(valid);change(v);assert.throws(()=>validateAnalysis(v,input));
 }
});
test('valid provider JSON gives fallback false and accurate paid-price estimate',async()=>{
 let captured;
 const r=await suggestOutfits(input,{env,fetcher:async(url,init)=>{captured={url,init};return provider()(url,init);}});
 assert.equal(r.fallback,false);assert.equal(r.outfits.length,3);assert.equal(r.usage.estimatedKrw,2.6865);
 assert.equal(captured.init.headers['x-goog-api-key'],env.LLM_API_KEY);
 assert.equal(JSON.stringify(r).includes(env.LLM_API_KEY),false);
 assert.equal(captured.url.includes(env.LLM_API_KEY),false);
 assert.equal(JSON.parse(captured.init.body).generationConfig.maxOutputTokens,2800);
});
test('missing key and deliberate failure make no provider call',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('never');};
 assert.equal((await suggestOutfits(input,{env:{},fetcher})).reason,'missing_key');
 assert.equal((await suggestOutfits(input,{env,fetcher,forceFallback:true})).reason,'forced_test');
 assert.equal(calls,0);
});
test('provider errors, malformed JSON, empty and incomplete outputs all recover',async()=>{
 const scenarios=[
 [async()=>new Response('secret must never be copied',{status:401}),'provider_auth'],
 [async()=>new Response('',{status:429}),'provider_limit'],
 [async()=>new Response('',{status:404}),'model_not_found'],
 [async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]})),'invalid_response'],
 [async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[]}}]})),'empty_response'],
 [async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS'}]})),'incomplete_response'],
 [async()=>{throw Error('secret raw error');},'connection_error']
 ];
 for(const [fetcher,reason] of scenarios){const r=await suggestOutfits(input,{env,fetcher});assert.equal(r.fallback,true);assert.equal(r.reason,reason);assert.equal(r.outfits.length,3);assert.equal(JSON.stringify(r).includes('secret'),false);}
});
test('timeout aborts external request and returns bounded fallback',async()=>{
 const fetcher=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 const r=await suggestOutfits(input,{env,fetcher,timeoutMs:5});assert.equal(r.reason,'timeout');assert.equal(r.fallback,true);
});
test('usage survives response validation failure; unknown model is not mispriced',async()=>{
 const r=await suggestOutfits(input,{env,fetcher:provider({summary:'bad',outfits:[]})});assert.equal(r.reason,'invalid_response');assert.equal(r.usage.inputTokens,800);
 assert.equal(usageCost({promptTokenCount:800,candidatesTokenCount:600},'other-model').estimatedKrw,null);
});
