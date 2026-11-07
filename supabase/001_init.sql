-- 입어봄 6주차: 모든 값은 수업용 가상 데이터입니다. 실제 사용자 정보를 넣지 마세요.
-- 전체를 SQL Editor에 붙여 넣고 Run. 다시 실행해도 기존 행의 수정 값은 유지됩니다.
begin;
create table if not exists public.ieobom_profiles (
 id text primary key,
 style text not null check (length(style)<=160),
 colors text not null check (length(colors)<=160),
 avoid text not null check (length(avoid)<=160),
 comfort text not null check (length(comfort)<=160),
 goal text not null check (length(goal)<=160),
 remaining integer not null check (remaining>=0),
 monthly_limit integer not null check (monthly_limit>=remaining),
 as_of date not null,
 period_label text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.ieobom_wardrobe (
 id text primary key,
 profile_id text not null references public.ieobom_profiles(id),
 name text not null check (length(name) between 1 and 50),
 category text not null check (category in ('상의','하의','아우터','신발','가방')),
 color text not null check (length(color) between 1 and 30),
 swatch text not null check (swatch ~ '^#[0-9A-Fa-f]{6}$'),
 created_at timestamptz not null default now()
);
create table if not exists public.ieobom_outfits (
 id text primary key,
 profile_id text not null references public.ieobom_profiles(id),
 title text not null,
 description text not null,
 occasion text not null,
 worn_on date not null,
 status text not null check (status in ('저장됨','착용 완료','피드백 대기')),
 thumbnail text not null check (thumbnail ~ '^/images/look-0[1-5]\.webp$'),
 reason text not null default '',
 tip text not null default '',
 rating integer not null default 0 check (rating between 0 and 5),
 created_at timestamptz not null default now()
);
create index if not exists ieobom_wardrobe_profile_idx on public.ieobom_wardrobe(profile_id);
create index if not exists ieobom_outfits_profile_date_idx on public.ieobom_outfits(profile_id,worn_on desc,id desc);
comment on table public.ieobom_profiles is '수업용 가상 프로필. 공개 읽기 전용 데이터입니다.';
comment on table public.ieobom_wardrobe is '수업용 가상 의류. 실제 개인정보를 넣지 않습니다.';
comment on table public.ieobom_outfits is '수업용 가상 착용 기록. 실제 AI 호출이나 실제 착용을 뜻하지 않습니다.';

alter table public.ieobom_profiles enable row level security;
revoke all on table public.ieobom_profiles from public, anon, authenticated;
grant select on table public.ieobom_profiles to anon, authenticated;
grant all on table public.ieobom_profiles to service_role;
drop policy if exists ieobom_public_read on public.ieobom_profiles;
create policy ieobom_public_read on public.ieobom_profiles for select to anon, authenticated using (true);

alter table public.ieobom_wardrobe enable row level security;
revoke all on table public.ieobom_wardrobe from public, anon, authenticated;
grant select on table public.ieobom_wardrobe to anon, authenticated;
grant all on table public.ieobom_wardrobe to service_role;
drop policy if exists ieobom_public_read on public.ieobom_wardrobe;
create policy ieobom_public_read on public.ieobom_wardrobe for select to anon, authenticated using (true);

alter table public.ieobom_outfits enable row level security;
revoke all on table public.ieobom_outfits from public, anon, authenticated;
grant select on table public.ieobom_outfits to anon, authenticated;
grant all on table public.ieobom_outfits to service_role;
drop policy if exists ieobom_public_read on public.ieobom_outfits;
create policy ieobom_public_read on public.ieobom_outfits for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated, service_role;

insert into public.ieobom_profiles (id, style, colors, avoid, comfort, goal, remaining, monthly_limit, as_of, period_label) values
('demo-profile', '미니멀 · 단정한 캐주얼', '화이트, 블랙, 네이비, 베이지', '큰 로고, 과한 장식', '오래 걸어도 편한 신발', '가진 옷을 다양하게 활용하고 싶어요', 17, 20, '2026-10-24', '2026년 10월 · 수업용 가상 데이터')
on conflict (id) do nothing;

insert into public.ieobom_wardrobe (profile_id, id, name, category, color, swatch) values
('demo-profile', 'w01', '화이트 코튼 셔츠', '상의', '화이트', '#eeeae3'),
('demo-profile', 'w02', '크림 라운드 니트', '상의', '크림', '#e6dcc8'),
('demo-profile', 'w03', '블랙 기본 티셔츠', '상의', '블랙', '#323232'),
('demo-profile', 'w04', '네이비 스트라이프 티', '상의', '네이비', '#364356'),
('demo-profile', 'w05', '차콜 와이드 슬랙스', '하의', '차콜', '#595954'),
('demo-profile', 'w06', '진청 스트레이트 데님', '하의', '진청', '#3b5268'),
('demo-profile', 'w07', '베이지 코튼 팬츠', '하의', '베이지', '#c7b89f'),
('demo-profile', 'w08', '블랙 싱글 재킷', '아우터', '블랙', '#333333'),
('demo-profile', 'w09', '베이지 가디건', '아우터', '베이지', '#c9baa2'),
('demo-profile', 'w10', '블랙 로퍼', '신발', '블랙', '#333333'),
('demo-profile', 'w11', '화이트 스니커즈', '신발', '화이트', '#eeeeea'),
('demo-profile', 'w12', '브라운 숄더백', '가방', '브라운', '#87664e')
on conflict (id) do nothing;

insert into public.ieobom_outfits (profile_id, id, title, description, occasion, worn_on, status, thumbnail, reason, tip, rating) values
('demo-profile', 'look-006', '도서관에서 보내는 오후', '크림 니트 · 진청 데님 · 화이트 스니커즈', '주말 외출', '2026-10-23', '저장됨', '/images/look-01.webp', '밝은 니트와 진청을 조합해 차분한 분위기를 만듭니다.', '오래 앉아 있을 때 허리와 어깨가 편한지 확인하세요.', 0),
('demo-profile', 'look-007', '가벼운 동네 산책', '네이비 스트라이프 티 · 베이지 팬츠 · 스니커즈', '일상', '2026-10-22', '착용 완료', '/images/look-02.webp', '줄무늬 상의에 단색 하의를 더해 조합을 단순하게 정리합니다.', '소지품은 숄더백에 간단히 챙겨 보세요.', 4),
('demo-profile', 'look-008', '친구와 카페에서', '화이트 셔츠 · 진청 데님 · 브라운 숄더백', '친구와 약속', '2026-10-21', '피드백 대기', '/images/look-03.webp', '흰색과 진청에 갈색 가방으로 따뜻한 색을 더합니다.', '셔츠 소매를 한 번 접어 편안하게 연출해 보세요.', 0),
('demo-profile', 'look-009', '발표가 있는 날', '화이트 셔츠 · 차콜 슬랙스 · 블랙 재킷', '미팅', '2026-10-20', '저장됨', '/images/look-04.webp', '명도가 다른 무채색으로 단정한 구성을 만듭니다.', '착석할 때 재킷이 당기지 않는지 확인하세요.', 0),
('demo-profile', 'look-010', '편안한 기차 여행', '블랙 티셔츠 · 베이지 팬츠 · 스니커즈', '여행', '2026-10-19', '착용 완료', '/images/look-05.webp', '기본 티셔츠와 편한 신발로 이동이 많은 상황을 고려합니다.', '실내 온도에 대비해 가디건을 챙겨 보세요.', 4),
('demo-profile', 'look-011', '가디건을 더한 출근', '화이트 셔츠 · 차콜 슬랙스 · 베이지 가디건', '출근', '2026-10-18', '피드백 대기', '/images/look-01.webp', '단정한 기본 조합에 부드러운 색의 겉옷을 더합니다.', '셔츠와 가디건의 소매가 겹쳐 불편하지 않은지 확인하세요.', 0),
('demo-profile', 'look-012', '가볍게 둘러보는 전시', '크림 니트 · 차콜 슬랙스 · 블랙 로퍼', '데이트', '2026-10-17', '저장됨', '/images/look-02.webp', '차분한 하의에 밝은 니트로 시선을 모으는 예시입니다.', '관람 시간이 길다면 편한 스니커즈로 바꿔 보세요.', 0),
('demo-profile', 'look-013', '수업 뒤 저녁 약속', '네이비 티 · 진청 데님 · 베이지 가디건', '친구와 약속', '2026-10-16', '착용 완료', '/images/look-03.webp', '짙은 색 기본 조합에 밝은 겉옷으로 변화를 줍니다.', '가디건을 벗어도 균형이 맞는지 확인하세요.', 4),
('demo-profile', 'look-014', '주말 장보는 날', '블랙 티셔츠 · 진청 데님 · 화이트 스니커즈', '일상', '2026-10-15', '피드백 대기', '/images/look-04.webp', '관리하기 쉬운 기본 조합을 반복 활용하는 예시입니다.', '이동과 짐을 고려해 손이 편한 가방을 골라 보세요.', 0),
('demo-profile', 'look-005', '편안하지만 단정한 출근룩', '화이트 셔츠 · 와이드 슬랙스 · 로퍼', '출근', '2026-10-15', '착용 완료', '/images/look-01.webp', '가지고 있는 기본 의류를 다시 조합하는 수업용 예시입니다.', '실제 착용 전 활동량과 기온에 맞게 조절해 보세요.', 0),
('demo-profile', 'look-015', '단정한 온라인 미팅', '화이트 셔츠 · 베이지 팬츠 · 블랙 로퍼', '미팅', '2026-10-14', '저장됨', '/images/look-05.webp', '밝은 상의로 얼굴 주변을 간결하게 정돈하는 조합입니다.', '카메라에 보이는 셔츠 깃과 구김을 확인하세요.', 0),
('demo-profile', 'look-004', '많이 걷는 날의 데이트룩', '셔츠 · 데님 · 편한 운동화는 그대로', '데이트', '2026-10-14', '피드백 대기', '/images/look-02.webp', '가지고 있는 기본 의류를 다시 조합하는 수업용 예시입니다.', '실제 착용 전 활동량과 기온에 맞게 조절해 보세요.', 0),
('demo-profile', 'look-016', '니트와 로퍼의 조합', '크림 니트 · 차콜 슬랙스 · 블랙 로퍼', '출근', '2026-10-13', '착용 완료', '/images/look-01.webp', '부드러운 상의와 선이 단정한 하의를 조합합니다.', '니트 밑단을 자연스럽게 정리해 보세요.', 4),
('demo-profile', 'look-017', '가까운 곳으로 당일치기', '스트라이프 티 · 베이지 팬츠 · 스니커즈', '여행', '2026-10-12', '피드백 대기', '/images/look-02.webp', '이동하기 편한 신발에 기본색 의류를 조합한 예시입니다.', '기온에 따라 블랙 재킷이나 가디건을 챙겨 보세요.', 0),
('demo-profile', 'look-003', '좋아하는 니트로 완성한 주말', '라이트 니트 · 진청 데님 · 숄더백', '주말 외출', '2026-10-12', '저장됨', '/images/look-03.webp', '가지고 있는 기본 의류를 다시 조합하는 수업용 예시입니다.', '실제 착용 전 활동량과 기온에 맞게 조절해 보세요.', 0),
('demo-profile', 'look-018', '재킷과 데님의 주말', '블랙 티셔츠 · 진청 데님 · 블랙 재킷', '주말 외출', '2026-10-11', '저장됨', '/images/look-03.webp', '익숙한 데님 조합을 재킷으로 정돈합니다.', '가방을 갈색으로 바꾸면 색에 변화를 줄 수 있어요.', 0),
('demo-profile', 'look-019', '화이트와 베이지의 조합', '화이트 셔츠 · 베이지 팬츠 · 브라운 숄더백', '데이트', '2026-10-10', '착용 완료', '/images/look-04.webp', '밝은 기본색을 연결하고 갈색 소품으로 마무리합니다.', '신발도 편안한 밝은색으로 맞춰 보세요.', 4),
('demo-profile', 'look-020', '있는 옷으로 새 조합', '크림 니트 · 진청 데님 · 블랙 로퍼', '일상', '2026-10-09', '피드백 대기', '/images/look-05.webp', '가진 니트와 데님을 신발만 바꿔 활용하는 예시입니다.', '마음에 드는 조합이면 착용 기록에 남겨 보세요.', 0),
('demo-profile', 'look-002', '재킷 하나로 정리하는 미팅룩', '기본 티셔츠 · 블랙 재킷 · 슬랙스', '미팅', '2026-09-30', '착용 완료', '/images/look-04.webp', '가지고 있는 기본 의류를 다시 조합하는 수업용 예시입니다.', '실제 착용 전 활동량과 기온에 맞게 조절해 보세요.', 0),
('demo-profile', 'look-001', '새로 사지 않고, 한 번 더', '차분한 색 조합 · 평소 입던 옷의 다른 연출', '일상', '2026-09-28', '저장됨', '/images/look-05.webp', '가지고 있는 기본 의류를 다시 조합하는 수업용 예시입니다.', '실제 착용 전 활동량과 기온에 맞게 조절해 보세요.', 0)
on conflict (id) do nothing;

commit;
-- 처음 실행했을 때 profiles=1, wardrobe=12, outfits=20 입니다.
select 'ieobom_profiles' as table_name, count(*) as row_count from public.ieobom_profiles
union all select 'ieobom_wardrobe', count(*) from public.ieobom_wardrobe
union all select 'ieobom_outfits', count(*) from public.ieobom_outfits;
