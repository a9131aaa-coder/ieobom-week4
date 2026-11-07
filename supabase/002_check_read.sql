-- 공개 사용자(anon)의 읽기가 허용되는지 확인합니다.
begin;
set local role anon;
select id, title, worn_on from public.ieobom_outfits order by worn_on desc, id desc;
rollback;
