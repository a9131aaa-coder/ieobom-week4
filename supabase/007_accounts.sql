-- 입어봄 9주차: 로그인한 회원의 개인 자료를 별도 표에 저장합니다.
-- 기존 ieobom_profiles/wardrobe/outfits 및 8주차 검색 자료는 변경하지 않습니다.
-- Supabase SQL Editor에서 전체를 한 번 실행하세요. 다시 실행해도 회원 자료는 유지됩니다.
begin;

create table if not exists public.ieobom_user_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  style text not null default '' check (length(style) <= 160),
  colors text not null default '' check (length(colors) <= 160),
  avoid text not null default '' check (length(avoid) <= 160),
  comfort text not null default '' check (length(comfort) <= 160),
  goal text not null default '' check (length(goal) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ieobom_user_wardrobe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 50 and name ~ '[^[:space:]]'),
  category text not null check (category in ('상의', '하의', '아우터', '신발', '가방')),
  color text not null check (length(color) between 1 and 30 and color ~ '[^[:space:]]'),
  swatch text not null check (swatch ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ieobom_user_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 80 and title ~ '[^[:space:]]'),
  description text not null check (length(description) between 1 and 1000 and description ~ '[^[:space:]]'),
  occasion text not null check (length(occasion) between 1 and 40 and occasion ~ '[^[:space:]]'),
  worn_on date not null check (isfinite(worn_on)),
  status text not null default '저장됨' check (status in ('저장됨', '착용 완료', '피드백 대기')),
  reason text not null default '' check (length(reason) <= 500),
  tip text not null default '' check (length(tip) <= 500),
  rating integer not null default 0 check (rating between 0 and 5),
  kind text not null default 'manual' check (kind in ('ai', 'fallback', 'manual')),
  analysis_key text check (analysis_key is null or length(analysis_key) between 1 and 160 and analysis_key ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, analysis_key)
);

create index if not exists ieobom_user_wardrobe_owner_created_idx
  on public.ieobom_user_wardrobe(user_id, created_at desc, id);
create index if not exists ieobom_user_outfits_owner_date_idx
  on public.ieobom_user_outfits(user_id, worn_on desc, created_at desc, id);

comment on table public.ieobom_user_profiles is '회원별 비공개 취향. 공통 예시 프로필과 별도이며 auth.uid() 소유자만 접근합니다.';
comment on table public.ieobom_user_wardrobe is '회원별 비공개 옷장. 클라이언트는 소유자와 식별자를 변경할 수 없습니다.';
comment on table public.ieobom_user_outfits is '회원별 비공개 코디 기록. 8주차 공통 예시 검색에는 포함하지 않습니다.';

create or replace function public.ieobom_touch_user_updated_at()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.ieobom_touch_user_updated_at() from public, anon, authenticated;

-- 표 권한과 열 권한을 모두 초기화합니다. Supabase의 기본 권한도 명시적으로 회수합니다.
-- 다른 이름의 정책이 이미 추가됐다면 조용히 허용하지 않고 전체 작업을 중단합니다.
do $$
declare
  table_name text;
  column_names text;
begin
  foreach table_name in array array['ieobom_user_profiles', 'ieobom_user_wardrobe', 'ieobom_user_outfits'] loop
    if exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = table_name
        and p.policyname not in ('ieobom_owner_select', 'ieobom_owner_insert', 'ieobom_owner_update', 'ieobom_owner_delete')
    ) then raise exception 'unexpected_private_table_policy'; end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into column_names
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', table_name)::regclass and a.attnum > 0 and not a.attisdropped;
    execute format('revoke all (%s) on table public.%I from public, anon, authenticated', column_names, table_name);
    execute format('grant select, delete on table public.%I to authenticated', table_name);

    execute format('drop policy if exists ieobom_owner_select on public.%I', table_name);
    execute format('drop policy if exists ieobom_owner_insert on public.%I', table_name);
    execute format('drop policy if exists ieobom_owner_update on public.%I', table_name);
    execute format('drop policy if exists ieobom_owner_delete on public.%I', table_name);
    execute format('create policy ieobom_owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create policy ieobom_owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy ieobom_owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy ieobom_owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);

    execute format('drop trigger if exists ieobom_touch_updated_at on public.%I', table_name);
    execute format('create trigger ieobom_touch_updated_at before update on public.%I for each row execute function public.ieobom_touch_user_updated_at()', table_name);
  end loop;
end;
$$;

-- UPDATE(user_id)를 주지 않으므로 프로필 저장은 INSERT 또는 허용된 취향 열의 UPDATE를 사용합니다.
-- id/created_at/updated_at은 DB가 생성합니다. INSERT 시에도 이 열들은 보내지 않습니다.
grant insert (user_id, style, colors, avoid, comfort, goal)
  on public.ieobom_user_profiles to authenticated;
grant update (style, colors, avoid, comfort, goal)
  on public.ieobom_user_profiles to authenticated;
grant insert (user_id, name, category, color, swatch)
  on public.ieobom_user_wardrobe to authenticated;
grant update (name, category, color, swatch)
  on public.ieobom_user_wardrobe to authenticated;
grant insert (user_id, title, description, occasion, worn_on, status, reason, tip, rating, kind, analysis_key)
  on public.ieobom_user_outfits to authenticated;
grant update (title, description, occasion, worn_on, status, reason, tip, rating, kind)
  on public.ieobom_user_outfits to authenticated;
grant usage on schema public to authenticated;

notify pgrst, 'reload schema';
commit;

-- 개인 자료의 내용을 읽지 않고 설치 상태만 확인합니다.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('ieobom_user_profiles', 'ieobom_user_wardrobe', 'ieobom_user_outfits')
order by c.relname;
