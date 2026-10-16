import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateDashboard } from '../public/dashboard-model.mjs';

/** mock: 6주차에는 이 함수 안의 파일 읽기를 DB 조회로 교체합니다. */
export async function getDashboard() {
  // 사용자 입력을 파일 경로로 사용하지 않습니다.
  const raw = await readFile(join(process.cwd(), 'data', 'dashboard.json'), 'utf8');
  const data = JSON.parse(raw);
  validateDashboard(data);
  return data;
}
