-- App-only Instagram posting receipts. Run after 007_accounts.sql.
-- The database never receives a Meta access token or the n8n shared secret.
begin;

alter table public.ieobom_user_outfits
  add column if not exists instagram_post_id text,
  add column if not exists instagram_posted_at timestamptz,
  add column if not exists instagram_publish_started_at timestamptz;

create schema if not exists ieobom_private;
revoke all on schema ieobom_private from public, anon, authenticated;

-- The claim token is deliberately outside the publicly selectable outfit row.
create table if not exists ieobom_private.instagram_publish_claims (
  outfit_id uuid primary key references public.ieobom_user_outfits(id) on delete cascade,
  token uuid not null
);
revoke all on table ieobom_private.instagram_publish_claims from public, anon, authenticated;

create or replace function public.ieobom_instagram_claim(outfit_id uuid, claim_token uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  outfit public.ieobom_user_outfits%rowtype;
begin
  select * into outfit from public.ieobom_user_outfits
    where id = outfit_id and user_id = auth.uid() for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if outfit.instagram_post_id is not null then return jsonb_build_object('status', 'published'); end if;
  if outfit.instagram_publish_started_at is not null then return jsonb_build_object('status', 'publishing'); end if;

  insert into ieobom_private.instagram_publish_claims (outfit_id, token) values (outfit.id, claim_token);
  update public.ieobom_user_outfits set instagram_publish_started_at = now() where id = outfit.id;
  return jsonb_build_object('status', 'claimed');
end;
$$;

create or replace function public.ieobom_instagram_finish(outfit_id uuid, claim_token uuid, provider_post_id text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  outfit public.ieobom_user_outfits%rowtype;
begin
  if provider_post_id is null or provider_post_id !~ '^[0-9]{1,30}$' then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into outfit from public.ieobom_user_outfits
    where id = outfit_id and user_id = auth.uid() for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  -- Idempotent receipt retry when the database committed the first call but its reply was lost.
  if outfit.instagram_post_id = provider_post_id then
    return jsonb_build_object('status', 'published', 'post_id', outfit.instagram_post_id, 'posted_at', outfit.instagram_posted_at);
  end if;
  if outfit.instagram_post_id is not null or outfit.instagram_publish_started_at is null or not exists (
    select 1 from ieobom_private.instagram_publish_claims as claim where claim.outfit_id = outfit.id and claim.token = claim_token
  ) then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.ieobom_user_outfits set instagram_post_id = provider_post_id, instagram_posted_at = now(), instagram_publish_started_at = null
    where id = outfit.id returning * into outfit;
  delete from ieobom_private.instagram_publish_claims as claim where claim.outfit_id = outfit.id;
  return jsonb_build_object('status', 'published', 'post_id', outfit.instagram_post_id, 'posted_at', outfit.instagram_posted_at);
end;
$$;

-- Existing RLS remains unchanged. These functions check the same owner explicitly before locking a row.
revoke all on function public.ieobom_instagram_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ieobom_instagram_finish(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ieobom_instagram_claim(uuid, uuid) to authenticated;
grant execute on function public.ieobom_instagram_finish(uuid, uuid, text) to authenticated;

create or replace function public.ieobom_protect_pending_instagram_delete()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  -- A normal delete cannot erase an outstanding receipt. Deleting the account can still cascade.
  if pg_trigger_depth() = 1 and old.instagram_publish_started_at is not null then
    raise exception using errcode = '55000', message = 'publication_pending';
  end if;
  return old;
end;
$$;
revoke all on function public.ieobom_protect_pending_instagram_delete() from public, anon, authenticated;
drop trigger if exists ieobom_protect_pending_instagram_delete on public.ieobom_user_outfits;
create trigger ieobom_protect_pending_instagram_delete before delete on public.ieobom_user_outfits
  for each row execute function public.ieobom_protect_pending_instagram_delete();

notify pgrst, 'reload schema';
commit;
