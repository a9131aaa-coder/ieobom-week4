-- 9주차 설치 후 SQL Editor에서 실행하는 읽기 전용 검사입니다.
-- 회원의 이메일/개인 자료는 출력하지 않습니다. 아래 9개 항목이 모두 '통과'여야 합니다.
-- 서로 다른 계정의 실제 읽기/쓰기 검사는 tests/accounts-rls.test.mjs에서 별도로 검증합니다.
with targets(name, oid) as (
  values
    ('ieobom_user_profiles', to_regclass('public.ieobom_user_profiles')),
    ('ieobom_user_wardrobe', to_regclass('public.ieobom_user_wardrobe')),
    ('ieobom_user_outfits', to_regclass('public.ieobom_user_outfits'))
), checks(number, item, passed) as (
  select 1, '개인 자료 표 3개 생성', count(oid) = 3 from targets
  union all
  select 2, '개인 자료 보호 활성화', bool_and(coalesce(c.relrowsecurity, false))
    from targets t left join pg_catalog.pg_class c on c.oid = t.oid
  union all
  select 3, '비로그인 직접 접근 차단', bool_and(coalesce(
    not has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    and not has_any_column_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,REFERENCES'), false))
    from targets t
  union all
  select 4, '회원 읽기·삭제 및 허용 열 저장 권한', bool_and(coalesce(
    has_table_privilege('authenticated', t.oid, 'SELECT')
    and has_table_privilege('authenticated', t.oid, 'DELETE')
    and has_column_privilege('authenticated', t.oid, 'user_id', 'INSERT')
    and (select bool_and(
      has_column_privilege('authenticated', t.oid, allowed.column_name, 'INSERT')
      and has_column_privilege('authenticated', t.oid, allowed.column_name, 'UPDATE')
    ) from unnest(case t.name
      when 'ieobom_user_profiles' then array['style', 'colors', 'avoid', 'comfort', 'goal']
      when 'ieobom_user_wardrobe' then array['name', 'category', 'color', 'swatch']
      else array['title', 'description', 'occasion', 'worn_on', 'status', 'reason', 'tip', 'rating', 'kind']
    end) as allowed(column_name))
    and (t.name <> 'ieobom_user_outfits' or has_column_privilege('authenticated', t.oid, 'analysis_key', 'INSERT'))
    and not has_table_privilege('authenticated', t.oid, 'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER'), false))
    from targets t
  union all
  select 5, '소유자·식별자·생성일 변경 차단', bool_and(coalesce(t.oid is not null and not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = t.oid and not a.attisdropped
      and a.attname in ('user_id', 'id', 'created_at', 'updated_at', 'analysis_key')
      and has_column_privilege('authenticated', t.oid, a.attname, 'UPDATE')
  ), false)) from targets t
  union all
  select 6, '식별자·시간값은 DB에서 생성', bool_and(coalesce(t.oid is not null and not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = t.oid and not a.attisdropped
      and a.attname in ('id', 'created_at', 'updated_at')
      and has_column_privilege('authenticated', t.oid, a.attname, 'INSERT')
  ), false)) from targets t
  union all
  select 7, '각 표에 본인 계정 정책 4개만 적용', bool_and((
    select count(*) = 4 and count(distinct p.cmd) = 4
      and bool_and(p.roles = array['authenticated']::name[] and p.permissive = 'PERMISSIVE')
      and bool_and(
        (p.cmd in ('SELECT', 'DELETE', 'UPDATE') and regexp_replace(coalesce(p.qual, ''), '[[:space:]]', '', 'g') = '((SELECTauth.uid()ASuid)=user_id)' or p.cmd = 'INSERT' and p.qual is null)
        and (p.cmd in ('INSERT', 'UPDATE') and regexp_replace(coalesce(p.with_check, ''), '[[:space:]]', '', 'g') = '((SELECTauth.uid()ASuid)=user_id)' or p.cmd in ('SELECT', 'DELETE') and p.with_check is null)
      )
    from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = t.name
  )) from targets t
  union all
  select 8, '회원 삭제 시 해당 개인 자료만 함께 삭제', bool_and(exists (
    select 1 from pg_catalog.pg_constraint k join pg_catalog.pg_attribute a
      on a.attrelid = t.oid and a.attname = 'user_id' and not a.attisdropped
    where k.conrelid = t.oid and k.contype = 'f' and k.confrelid = to_regclass('auth.users')
      and k.conkey = array[a.attnum]::smallint[] and k.confdeltype = 'c'
  )) from targets t
  union all
  select 9, '갱신 시각 함수의 권한 상승 없음', exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ieobom_touch_user_updated_at' and p.pronargs = 0
      and not p.prosecdef and p.proconfig @> array['search_path=pg_catalog']::text[]
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  )
)
select item as "확인 항목", case when passed then '통과' else '확인 필요' end as "결과"
from checks order by number;
