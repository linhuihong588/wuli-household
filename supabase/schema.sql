-- 屋里 v1：在 Supabase SQL Editor 中一次执行。
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initials text not null,
  color text not null default '#d9e6d7',
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, member_id)
);

create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  interval_days integer not null default 7 check (interval_days > 0),
  duration integer not null default 10 check (duration > 0),
  last_completed timestamptz not null default now(),
  preferred text check (preferred in ('weekend', 'evening', 'any')),
  paused boolean not null default false,
  archived boolean not null default false,
  category text not null default 'cleaning',
  task_type text not null default 'cycle',
  reminder_time time,
  due_at timestamptz,
  current_value numeric,
  target_value numeric,
  space text not null default 'other',
  unit text,
  snoozed_until timestamptz,
  postponed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null,
  type text not null,
  value numeric,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reminders_enabled boolean not null default true,
  advance_minutes integer not null default 120 check (advance_minutes between 0 and 10080),
  quiet_start time not null default '22:00',
  quiet_end time not null default '08:00',
  daily_digest_time time not null default '19:00',
  updated_at timestamptz not null default now()
);

create index if not exists chores_household_due_idx on public.chores(household_id, due_at);
create index if not exists completions_household_time_idx on public.completions(household_id, completed_at desc);
create index if not exists task_events_household_time_idx on public.task_events(household_id, created_at desc);
create index if not exists chores_owner_idx on public.chores(owner_id);
create index if not exists completions_chore_idx on public.completions(chore_id);
create index if not exists completions_member_idx on public.completions(member_id);
create index if not exists household_members_member_idx on public.household_members(member_id);
create index if not exists households_created_by_idx on public.households(created_by);
create index if not exists task_events_chore_idx on public.task_events(chore_id);
create index if not exists task_events_member_idx on public.task_events(member_id);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.chores enable row level security;
alter table public.completions enable row level security;
alter table public.task_events enable row level security;
alter table public.user_preferences enable row level security;

create policy "preferences self read" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "preferences self insert" on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "preferences self update" on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.household_members where household_id = target_household and member_id = (select auth.uid())) $$;

create or replace function private.is_household_owner(target_household uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.household_members where household_id = target_household and member_id = (select auth.uid()) and role = 'owner') $$;

create or replace function private.shares_household(target_member uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.household_members mine join public.household_members theirs on theirs.household_id = mine.household_id where mine.member_id = (select auth.uid()) and theirs.member_id = target_member) $$;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_household_owner(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
revoke all on function private.shares_household(uuid) from public;
grant execute on function private.shares_household(uuid) to authenticated;

create policy "household profiles read" on public.profiles for select to authenticated using (id = (select auth.uid()) or private.shares_household(id));
create policy "profile self update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "household members read" on public.households for select to authenticated using (private.is_household_member(id));
create policy "members read membership" on public.household_members for select to authenticated using (private.is_household_member(household_id));
create policy "owner updates membership" on public.household_members for update to authenticated using (private.is_household_owner(household_id)) with check (private.is_household_owner(household_id));
create policy "owner removes membership" on public.household_members for delete to authenticated using (private.is_household_owner(household_id));
create policy "members manage chores" on public.chores for all to authenticated using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
create policy "members manage completions" on public.completions for all to authenticated using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
create policy "members manage events" on public.task_events for all to authenticated using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));

grant select, update on public.profiles to authenticated;
grant select on public.households, public.household_members to authenticated;
grant select, insert, update, delete on public.chores, public.completions, public.task_events to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists chores_touch_updated_at on public.chores;
create trigger chores_touch_updated_at before update on public.chores for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles(id, name, initials)
  values(new.id, coalesce(new.raw_user_meta_data->>'name', '新成员'), left(coalesce(new.raw_user_meta_data->>'name', '新'), 1));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_household(household_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into households(name, created_by) values(household_name, auth.uid()) returning id into new_id;
  insert into household_members(household_id, member_id, role) values(new_id, auth.uid(), 'owner');
  return new_id;
end $$;

create or replace function public.join_household(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into target_id from households where invite_code = upper(trim(code));
  if target_id is null then raise exception 'invalid invite code'; end if;
  insert into household_members(household_id, member_id, role)
  values(target_id, auth.uid(), 'member') on conflict do nothing;
  return target_id;
end $$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_household(text) from anon;
revoke execute on function public.join_household(text) from anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
