-- 이 파일은 오류가 나야 정상입니다. 001_init.sql 실행 후 새 쿼리에서 실행하세요.
-- 없는 ID를 대상으로 하므로, 권한이 잘못되어도 기존 데이터는 바뀌지 않습니다.
begin;
set local role anon;
update public.ieobom_outfits set title = '접근 거부 확인' where id = '__permission_probe_missing_id__';
rollback;
-- 정상: ERROR 42501: permission denied for table ieobom_outfits
-- 다음 쿼리에서 25P02가 나오면 rollback; 을 단독 실행하세요.
