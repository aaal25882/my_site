-- نسخه اولیه پایگاه داده سامانه خرید از چین
create type public.user_role as enum ('buyer', 'traveler', 'admin');
create type public.verification_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'buyer',
  phone text,
  city text,
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update own basic profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

-- ساخت خودکار پروفایل پس از ثبت‌نام ایمیلی
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'کاربر جدید'),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'buyer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
