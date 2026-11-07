import { checkPublicAccess } from '@/lib/database-check.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'같은 사이트에서 확인해 주세요.'},{status:403});
  return Response.json(await checkPublicAccess(),{headers:{'Cache-Control':'no-store'}});
}
