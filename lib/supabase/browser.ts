'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicAuthConfig } from './config';

export function createClient() {
  const config = getPublicAuthConfig();
  if (!config) throw new Error('로그인 연결 설정이 아직 준비되지 않았어요. 잠시 후 다시 이용해 주세요.');
  return createBrowserClient(config.url, config.key);
}
