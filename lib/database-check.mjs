import { randomUUID } from 'node:crypto';
// Uses only the publishable key, never the server secret. All targets are nonexistent.
export async function checkPublicAccess({env=process.env,fetcher=fetch,timeoutMs=7000}={}) {
  const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!key?.startsWith('sb_publishable_') || !env.NEXT_PUBLIC_SUPABASE_URL) return {ok:false,error:'Vercel의 Supabase URL과 publishable 키를 등록하고 다시 배포해 주세요.'};
  let base;
  try{base=new URL(env.NEXT_PUBLIC_SUPABASE_URL);if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw Error();}
  catch{return {ok:false,error:'Supabase 프로젝트 URL을 확인해 주세요.'};}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const tables=['ieobom_profiles','ieobom_wardrobe','ieobom_outfits'];
  const operations=['select','insert','update','delete'];
  const probeId='permission-probe-'+randomUUID();
  try{
    const rows=await Promise.all(tables.flatMap(table=>operations.map(async operation=>{
      const url=new URL('/rest/v1/'+table,base.origin);
      const headers={apikey:key,'Content-Type':'application/json'};
      const init={method:({select:'GET',insert:'POST',update:'PATCH',delete:'DELETE'})[operation],headers,cache:'no-store',signal:controller.signal};
      if(operation==='select'){url.search='select=id&limit=1';headers.Prefer='count=exact';}
      else if(operation==='insert'){
        // NOT NULL deliberately invalid: even misconfigured write access cannot create a row.
        init.body=JSON.stringify(table==='ieobom_profiles'?{id:probeId,style:null}:{id:probeId,profile_id:null});
      }else{
        url.search=new URLSearchParams({id:'eq.'+probeId}).toString();
        if(operation==='update')init.body=JSON.stringify(table==='ieobom_profiles'?{style:'권한 확인'}:table==='ieobom_wardrobe'?{name:'권한 확인'}:{title:'권한 확인'});
      }
      try{
        const response=await fetcher(url.toString(),init);
        const body=await response.json().catch(()=>null);
        const code=typeof body?.code==='string'&&/^[0-9A-Z]{5}$/.test(body.code)?body.code:null;
        const pass=operation==='select'?response.ok&&Array.isArray(body)&&body.length>0:[401,403].includes(response.status)&&code==='42501';
        const range=response.headers.get('content-range')?.split('/')[1];
        const count=operation==='select'&&/^\d+$/.test(range??'')?Number(range):null;
        return {table,operation,status:response.status,code,pass,count};
      }catch{return {table,operation,status:0,code:null,pass:false,count:null};}
    })));
    return {ok:rows.every(r=>r.pass),checkedAt:new Date().toISOString(),rows};
  }finally{clearTimeout(timer);controller.abort();}
}
