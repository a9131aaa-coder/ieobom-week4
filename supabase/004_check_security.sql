-- RLS 활성화와 공개 권한 확인. rls_enabled=true, can_read=true, 쓰기 3개=false 가 정상.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as can_read,
 has_table_privilege('anon',c.oid,'INSERT') as can_insert,
 has_table_privilege('anon',c.oid,'UPDATE') as can_update,
 has_table_privilege('anon',c.oid,'DELETE') as can_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('ieobom_profiles','ieobom_wardrobe','ieobom_outfits');
select tablename,policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename in ('ieobom_profiles','ieobom_wardrobe','ieobom_outfits');
