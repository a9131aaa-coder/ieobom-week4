-- 읽기 전용 검증. 005 SQL과 임베딩 스크립트 실행 후 SQL Editor에서 실행합니다.
-- 모델명/벡터 차원/누락/오래된 원본/단위 벡터/실제 검색 RPC/권한을 확인합니다.
begin read only;
set local search_path = pg_catalog, extensions, public;

select
  (select count(*) from public.ieobom_outfits where profile_id = 'demo-profile') as source_count,
  count(*) as embedding_count, count(distinct e.model) as model_kinds,
  count(distinct e.dim) as dimension_kinds, min(e.dim) as dim,
  min(vector_norm(e.embedding)) as min_norm, max(vector_norm(e.embedding)) as max_norm
from public.content_embeddings e where e.profile_id = 'demo-profile';

select count(*) as missing_or_stale
from public.ieobom_outfits o
left join public.content_embeddings e on e.content_id = o.id and e.profile_id = o.profile_id
where o.profile_id = 'demo-profile' and (
  e.content_id is null or e.model <> 'gemini-embedding-2' or e.dim <> 768
  or vector_dims(e.embedding) <> 768 or abs(vector_norm(e.embedding) - 1) > 0.001
  or e.chunk_text is distinct from public.ieobom_rag_document(o)
  or e.content_hash is distinct from encode(sha256(convert_to(public.ieobom_rag_document(o), 'UTF8')), 'hex')
);

select c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', 'public.content_embeddings', 'SELECT') as anon_read,
  has_table_privilege('anon', 'public.content_embeddings', 'INSERT,UPDATE,DELETE') as anon_write,
  has_table_privilege('authenticated', 'public.content_embeddings', 'SELECT,INSERT,UPDATE,DELETE') as authenticated_access,
  has_function_privilege('anon', 'public.match_contents(vector,double precision,integer,text,text)', 'EXECUTE') as anon_rpc,
  has_function_privilege('authenticated', 'public.match_contents(vector,double precision,integer,text,text)', 'EXECUTE') as authenticated_rpc,
  has_function_privilege('service_role', 'public.match_contents(vector,double precision,integer,text,text)', 'EXECUTE') as server_rpc,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'content_embeddings') as policy_count
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'content_embeddings';

-- 실제 벡터로 함수를 호출합니다. 미완료 인덱스면 index_not_ready 오류가 정상입니다.
-- COALESCE의 단위 벡터는 빈 표에서도 함수를 실행해 거짓 성공을 막기 위한 검사값입니다.
select m.content_id, m.title, m.worn_on, m.similarity
from public.match_contents(
  coalesce((select e.embedding from public.content_embeddings e where e.profile_id = 'demo-profile' order by e.content_id limit 1),
    ('[1,' || repeat('0,', 766) || '0]')::vector),
  -1, 5, 'demo-profile', 'gemini-embedding-2'
) m;
rollback;
-- 오류로 실행이 중단되면 rollback;만 단독 실행한 후 임베딩을 채우고 다시 확인하세요.
-- 통과 기준: 처음 20/20행, missing_or_stale=0, 모델/차원 각 1종류, dim=768,
-- norm 약 1, 검색 1~5행, rls/server_rpc=true, 공개 권한 전부 false, 정책 0개.
