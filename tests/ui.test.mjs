import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {dashboardMarkup} from '../lib/dashboard-view.mjs';
import {getDashboard} from '../lib/dashboard-data.mjs';
import {normalizeInput,suggestOutfits} from '../lib/ai.mjs';
const script=await readFile('public/dashboard.mjs','utf8');
const mock=await getDashboard();
const tick=()=>new Promise(r=>setTimeout(r,20));
async function setup(saved){
 const dom=new JSDOM(`<!doctype html><html><body>${dashboardMarkup}</body></html>`,{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window;w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(saved)w.localStorage.setItem('ieobom-week5-v1',saved);
 w.fetch=async(url,init)=>{
  if(url==='/api/dashboard')return Response.json(mock);
  const body=JSON.parse(init.body);const input=normalizeInput(body,mock);
  return Response.json(await suggestOutfits(input,{env:{},forceFallback:body.forceFallback}));
 };
 w.eval(script);await tick();return {dom,w,d:w.document};
}
test('five menus, wardrobe create/delete, profile save, analysis save and rating persist',async()=>{
 const {dom,w,d}=await setup();
 try {
 assert.equal(d.querySelector('[data-page="home"]').hidden,false);
 assert.equal(d.getElementById('wardrobe-count').textContent,'12');
 for(const page of ['wardrobe','consult','history','profile','home']){w.location.hash=page;await tick();assert.equal(d.querySelector(`[data-page="${page}"]`).hidden,false);}
 d.querySelector('[data-action="add-item"]').click();assert.equal(d.getElementById('item-dialog').open,true);
 d.getElementById('item-name').value='<img src=x onerror=alert(1)>';
 d.getElementById('item-color').value='블루';
 d.getElementById('item-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(d.getElementById('wardrobe-count').textContent,'13');
 assert.equal(d.querySelectorAll('.garment img').length,0,'input must not become HTML');
 assert.match(d.querySelector('.wardrobe-grid').textContent,/<img/);
 d.getElementById('profile-style').value='새로운 취향';d.getElementById('profile-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
 d.querySelector('[data-action="quick-analyze"]').click();await tick();
 assert.equal(d.querySelectorAll('[data-result-place="home"] .outfit').length,3);
 assert.match(d.querySelector('[data-result-place="home"]').textContent,/예시 결과/);
 d.querySelector('[data-save-outfit="0"]').click();assert.equal(d.getElementById('saved-count').textContent,'6');
 d.querySelector('[data-save-outfit="0"]').click();assert.equal(d.getElementById('saved-count').textContent,'6','duplicate save navigates instead');
 d.querySelector('#history-list [data-record]').click();assert.equal(d.getElementById('record-dialog').open,true);
 d.querySelector('[data-rating="4"]').click();
 let saved=JSON.parse(w.localStorage.getItem('ieobom-week5-v1'));assert.equal(saved.records[0].rating,4);assert.equal(saved.records[0].status,'착용 완료');
 assert.equal(saved.profile.style,'새로운 취향');assert.equal(saved.analysis.fallback,true);
 d.querySelector('.garment:last-child [data-remove-item]').click();assert.equal(d.getElementById('wardrobe-count').textContent,'12');
 const other=await setup(w.localStorage.getItem('ieobom-week5-v1'));
 try{assert.equal(other.d.getElementById('profile-style').value,'새로운 취향');assert.equal(other.d.getElementById('saved-count').textContent,'6');assert.equal(other.d.querySelectorAll('[data-result-place="home"] .outfit').length,3);}finally{other.dom.window.close();}
 } finally {dom.window.close();}
});
test('initial API failure can be retried without making AI calls',async()=>{
 const {dom,w,d}=await setup();
 try{let calls=0;w.fetch=async()=>{calls++;return new Response('',{status:500});};d.querySelector('[data-action="reload"]').click();await tick();assert.equal(d.getElementById('load-error').hidden,false);
 w.fetch=async()=>Response.json(mock);d.querySelector('[data-action="reload"]').click();await tick();assert.equal(d.getElementById('load-error').hidden,true);assert.equal(d.querySelector('[data-page="home"]').hidden,false);assert.equal(calls,1);
 }finally{dom.window.close();}
});
