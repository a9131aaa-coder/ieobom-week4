-- 입어봄 8주차. 기존 옷/기록은 바꾸지 않고 검색용 표와 함수를 추가합니다.
-- Supabase SQL Editor에서 파일 전체를 실행한 뒤 scripts/embed.mjs를 실행하세요.
-- 원본 기록을 수정하면 이전 벡터로 답하지 않습니다. 임베딩 스크립트를 다시 실행하세요.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
-- 이미 public에 설치한 pgvector도 지원하며, 기존 extension을 이동하지 않습니다.
set local search_path = pg_catalog, extensions, public;
do $$
begin
  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector' and n.nspname in ('extensions', 'public')
  ) then raise exception 'vector_schema_not_supported'; end if;
end $$;

create table if not exists public.content_embeddings (
  content_id text primary key references public.ieobom_outfits(id) on delete cascade,
  profile_id text not null references public.ieobom_profiles(id) check (profile_id = 'demo-profile'),
  chunk_text text not null check (length(chunk_text) between 1 and 16000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  model text not null check (model = 'gemini-embedding-2'),
  dim integer not null default 768 check (dim = 768),
  embedding vector(768) not null check (abs(vector_norm(embedding) - 1) <= 0.001),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.content_embeddings is '입어봄 공통 코디 기록의 서버 전용 검색 벡터. 개인정보/브라우저 개인 기록은 포함하지 않습니다.';
create index if not exists content_embeddings_cosine_hnsw
  on public.content_embeddings using hnsw (embedding vector_cosine_ops);
alter table public.content_embeddings enable row level security;
revoke all on public.content_embeddings from public, anon, authenticated;
grant select, insert, update, delete on public.content_embeddings to service_role;
grant usage on schema extensions to service_role;

-- lib/rag-corpus.mjs와 동일한 UTF-8 문서입니다. trim/공백 정규화를 하지 않습니다.
create or replace function public.ieobom_rag_document(source public.ieobom_outfits)
returns text
language sql stable strict security invoker
set search_path = pg_catalog
as $$
  select '프로필: ' || (source).profile_id || E'\n기록 ID: ' || (source).id
    || E'\n제목: ' || (source).title || E'\n날짜: ' || to_char((source).worn_on, 'YYYY-MM-DD')
    || E'\n상황: ' || (source).occasion || E'\n옷 조합: ' || (source).description
    || E'\n상태: ' || (source).status || E'\n이유: ' || (source).reason || E'\n팁: ' || (source).tip;
$$;
revoke all on function public.ieobom_rag_document(public.ieobom_outfits) from public, anon, authenticated;
grant execute on function public.ieobom_rag_document(public.ieobom_outfits) to service_role;

create or replace function public.match_contents(
  query_embedding vector(768),
  match_threshold double precision default 0.45,
  match_count integer default 5,
  filter_profile_id text default 'demo-profile',
  filter_model text default 'gemini-embedding-2'
)
returns table (
  content_id text, title text, worn_on date, chunk_text text, thumbnail text, similarity double precision
)
language plpgsql stable security invoker
set search_path = pg_catalog, extensions, public
as $$
declare
  source_count bigint;
begin
  if filter_profile_id is distinct from 'demo-profile'
    or filter_model is distinct from 'gemini-embedding-2'
    or query_embedding is null or vector_dims(query_embedding) <> 768
    or abs(vector_norm(query_embedding) - 1) > 0.001
    or match_threshold is null or not (match_threshold between -1 and 1)
    or match_count is null or match_count < 1 or match_count > 5
  then raise exception using errcode = '22023', message = 'invalid_search_input'; end if;

  select count(*) into source_count from public.ieobom_outfits o where o.profile_id = filter_profile_id;
  -- Missing rows, another model, edited text, and corrupt vectors are setup failures, not "no evidence".
  if source_count = 0 or source_count <> (
    select count(*) from public.content_embeddings e where e.profile_id = filter_profile_id
  ) or exists (
    select 1 from public.ieobom_outfits o
    left join public.content_embeddings e on e.content_id = o.id and e.profile_id = o.profile_id
    where o.profile_id = filter_profile_id and (
      e.content_id is null or e.model <> filter_model or e.dim <> 768
      or vector_dims(e.embedding) <> 768 or abs(vector_norm(e.embedding) - 1) > 0.001
      or e.chunk_text is distinct from public.ieobom_rag_document(o)
      or e.content_hash is distinct from encode(sha256(convert_to(public.ieobom_rag_document(o), 'UTF8')), 'hex')
    )
  ) then raise exception using errcode = 'P0001', message = 'index_not_ready'; end if;

  return query
    select e.content_id, o.title, o.worn_on, e.chunk_text, o.thumbnail,
      (1 - (e.embedding <=> query_embedding))::double precision
    from public.content_embeddings e
    join public.ieobom_outfits o on o.id = e.content_id and o.profile_id = e.profile_id
    where e.profile_id = filter_profile_id and e.model = filter_model
      and 1 - (e.embedding <=> query_embedding) >= match_threshold
    order by e.embedding <=> query_embedding, e.content_id
    limit match_count;
end;
$$;
revoke all on function public.match_contents(vector, double precision, integer, text, text) from public, anon, authenticated;
grant execute on function public.match_contents(vector, double precision, integer, text, text) to service_role;
notify pgrst, 'reload schema';
commit;

-- CREATE 성공만으로 임베딩이 채워지지는 않습니다. 최초에는 0행이 정상입니다.
select content_id, model, dim from public.content_embeddings order by content_id limit 5;
