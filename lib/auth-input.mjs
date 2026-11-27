export const AUTH_CHANGE_KEY = 'ieobom-auth-change';

export function validateAuthInput({ email = '', password = '', confirmPassword = '' }, mode) {
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  if (mode !== 'reset' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254)) return '이메일 주소를 확인해 주세요.';
  if (mode === 'forgot') return '';
  if (typeof password !== 'string' || !password || password.length > 128) return '비밀번호를 확인해 주세요.';
  if (mode !== 'login' && password.length < 8) return '비밀번호는 8자 이상으로 입력해 주세요.';
  if ((mode === 'signup' || mode === 'reset') && password !== confirmPassword) return '비밀번호가 서로 달라요. 다시 확인해 주세요.';
  return '';
}

export function authMessage(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = typeof error?.status === 'number' ? error.status : 0;
  if (code === 'invalid_credentials') return '이메일 또는 비밀번호를 확인해 주세요.';
  if (code === 'email_not_confirmed') return '가입한 이메일에서 인증 링크를 먼저 눌러 주세요.';
  if (code === 'weak_password') return '더 안전한 비밀번호를 사용해 주세요. 8자 이상으로 문자와 숫자를 함께 넣어 보세요.';
  if (code === 'same_password') return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) return '요청이 잠시 많아졌어요. 조금 기다렸다 다시 시도해 주세요.';
  if (code === 'email_address_not_authorized' || code === 'email_address_not_authorized_for_project') return '현재 이 이메일로 인증 메일을 보낼 수 없어요. 서비스의 메일 발송 설정 확인이 필요합니다.';
  if (code === 'signup_disabled') return '현재 새 회원가입을 잠시 받지 않고 있어요.';
  if (code === 'user_already_exists' || code === 'email_exists') return '가입 정보를 확인해 주세요. 이미 가입했다면 로그인하거나 비밀번호를 재설정해 주세요.';
  if (code === 'otp_expired' || code === 'otp_disabled') return '인증 링크가 만료되었거나 이미 사용됐어요. 새 링크를 받아 주세요.';
  return '연결이 원활하지 않아 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function isAnonymousAuthError(error) {
  return error?.name === 'AuthSessionMissingError' || error?.status === 401 || error?.status === 403 ||
    ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'user_not_found', 'user_banned'].includes(error?.code);
}

// Only destinations owned by this application are allowed after auth callbacks.
export function authDestination(type) {
  return type === 'recovery' ? '/account/update-password' : '/#home';
}

export function safeAuthNext(value) {
  return ['/account/update-password', '/#home', '/', '/chat'].includes(value) ? value : '/#home';
}

export function notifyAuthChange() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(AUTH_CHANGE_KEY, `${Date.now()}-${Math.random().toString(36).slice(2)}`); } catch { /* Storage can be disabled. */ }
  window.dispatchEvent(new Event('ieobom:auth-changed'));
}

export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
