-- Tabela de perfis de usuários
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  role text default 'consulta',
  is_admin boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Habilitar RLS
alter table public.profiles enable row level security;

-- Limpar policies existentes para evitar conflito
drop policy if exists authenticated_can_view_profiles on public.profiles;
drop policy if exists authenticated_can_insert_profiles on public.profiles;
drop policy if exists authenticated_can_update_profiles on public.profiles;
drop policy if exists authenticated_can_delete_profiles on public.profiles;

-- Política: usuários autenticados podem ver todos os perfis
create policy "authenticated_can_view_profiles" on public.profiles
  for select to authenticated using (true);

-- Política: usuários autenticados podem inserir perfis
create policy "authenticated_can_insert_profiles" on public.profiles
  for insert to authenticated with check (true);

-- Política: usuários autenticados podem atualizar perfis
create policy "authenticated_can_update_profiles" on public.profiles
  for update to authenticated using (true);

-- Política: usuários autenticados podem deletar perfis  
create policy "authenticated_can_delete_profiles" on public.profiles
  for delete to authenticated using (true);
