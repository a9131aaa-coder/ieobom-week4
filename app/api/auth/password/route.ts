import { getAccountContext } from '@/lib/supabase/server';
import { authMessage, isSameOrigin, validateAuthInput } from '@/lib/auth-input.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const failure = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (!isSameOrigin(request)) return failure('요청한 페이지를 확인할 수 없어요.', 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return failure('요청 형식이 올바르지 않아요.', 415);
  // Passwords have a small fixed maximum, so never buffer an arbitrary request body.
  const reader = request.body?.getReader();
  if (!reader) return failure('요청 형식이 올바르지 않아요.', 400);
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return failure('입력 내용이 너무 길어요.', 413); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } catch { return failure('요청 형식이 올바르지 않아요.', 400); }
  let body;
  try { body = JSON.parse(text); } catch { return failure('요청 형식이 올바르지 않아요.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return failure('요청 형식이 올바르지 않아요.', 400);
  const invalid = validateAuthInput(body, 'reset');
  if (invalid) return failure(invalid, 400);
  const account = await getAccountContext();
  if (account.status === 'unavailable') return account.apply(failure('로그인 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', 503));
  if (!account.user || !account.client) return account.apply(failure('인증 시간이 만료됐어요. 비밀번호 재설정 메일을 다시 받아 주세요.', 401));
  if (request.headers.get('x-ieobom-user') !== account.user.id) return account.apply(failure('다른 탭에서 계정이 바뀌었어요. 비밀번호 재설정 메일을 다시 열어 주세요.', 409));
  try {
    const { error } = await account.client.auth.updateUser({ password: body.password });
    if (error) return account.apply(failure(authMessage(error), error.status === 429 ? 429 : 400));
    return account.apply(Response.json({ ok: true }));
  } catch { return account.apply(failure('비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.', 503)); }
}
