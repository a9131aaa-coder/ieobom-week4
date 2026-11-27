import { loadDashboard } from '@/lib/dashboard-data.mjs';
import { normalizeInput, suggestOutfits, exampleAnalysis, DEFAULT_MODEL } from '@/lib/ai.mjs';
import { getAccountContext } from '@/lib/supabase/server';
import { loadPersonalDashboard, verifyAccountContext, AccountError, accountErrorResponse } from '@/lib/account-data.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const counters = new Map<string, {count:number; reset:number}>();
let daily = {date:'', count:0};
const json=(body:unknown,status=200,source?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(source?{'X-Data-Source':source}:{})}});
export async function POST(request: Request) {
  let accountContext: Awaited<ReturnType<typeof getAccountContext>> | undefined;
  let personalItems: unknown[] | undefined;
  const respond = (body: Record<string, unknown>, status = 200, source?: string) => {
    const response = json(personalItems ? { ...body, items: personalItems } : body, status, source);
    return accountContext ? accountContext.apply(response) : response;
  };
  // Same-origin browser requests only. This is not authentication or a hard spending cap.
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) return json({error:'허용되지 않은 요청입니다.'},403);
  if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'JSON 입력이 필요합니다.'},415);
  if(Number(request.headers.get('content-length'))>20000) return json({error:'입력이 너무 깁니다.'},413);
  let body;
  try {
    const text=await request.text();
    if(new TextEncoder().encode(text).length>20000) return json({error:'입력이 너무 깁니다.'},413);
    body=JSON.parse(text);
  } catch {return json({error:'입력 형식을 확인해 주세요.'},400);}
  try {
    let mock, dataSource: string;
    if (body?.source === 'personal') {
      accountContext = await getAccountContext();
      verifyAccountContext(accountContext, request, { mutation: true });
      mock = await loadPersonalDashboard(accountContext.client!, accountContext.user!);
      dataSource = 'personal';
      personalItems = mock.wardrobe;
    } else {
      const loaded = await loadDashboard();
      mock = loaded.data; dataSource = loaded.source;
    }
    let input;
    try {input=normalizeInput(body,mock);} catch {return respond({error:'상의·하의·신발을 포함해 옷을 3~40개 등록하고, 입력 길이를 확인해 주세요.'},400);}
    if(body.forceFallback===true) return respond(await suggestOutfits(input,{forceFallback:true}),200,dataSource);
    const now=Date.now(); const today=new Date().toISOString().slice(0,10);
    if(daily.date!==today) daily={date:today,count:0};
    for(const [key,v] of counters) if(v.reset<now) counters.delete(key);
    const ip=accountContext?.user ? `user:${accountContext.user.id}` : request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const count=counters.get(ip) || {count:0,reset:now+60000};
    if(count.count>=5 || daily.count>=100 || counters.size>=2000) {
      console.warn('[style-ai] server_limit');
      return respond({...exampleAnalysis(input),fallback:true,reason:'server_limit',model:process.env.LLM_MODEL||DEFAULT_MODEL,usage:null,generatedAt:new Date().toISOString(),source:input.source,occasion:input.occasion},200,dataSource);
    }
    count.count++;counters.set(ip,count);daily.count++;
    return respond(await suggestOutfits(input),200,dataSource);
  } catch (error) {
    if (accountContext || error instanceof AccountError) {
      const response = accountErrorResponse(error);
      return accountContext ? accountContext.apply(response) : response;
    }
    console.error('[style-ai] data_unavailable');
    return json({error:'기본 데이터를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  }
}
