alter table if exists public.fleet_colaboradores
  add column if not exists tipo text,
  add column if not exists segmento text;

alter table if exists public.fleet_colaboradores
  alter column telefone drop not null,
  alter column departamento drop not null;

alter table if exists public.fleet_colaboradores
  alter column telefone set default '',
  alter column departamento set default '';

update public.fleet_colaboradores
set
  tipo = coalesce(tipo, ''),
  segmento = coalesce(segmento, ''),
  telefone = coalesce(telefone, ''),
  departamento = coalesce(departamento, '')
where tipo is null or segmento is null or telefone is null or departamento is null;

create index if not exists fleet_colaboradores_centro_custo_idx on public.fleet_colaboradores (centro_custo);
create index if not exists fleet_colaboradores_segmento_idx on public.fleet_colaboradores (segmento);
