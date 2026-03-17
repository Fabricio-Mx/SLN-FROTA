alter table if exists public.fleet_colaboradores
  add column if not exists email text,
  add column if not exists cep text,
  add column if not exists endereco text,
  add column if not exists imagens_veiculo jsonb;

update public.fleet_colaboradores
set email = coalesce(nullif(trim(email), ''), ''),
    cep = coalesce(nullif(trim(cep), ''), ''),
    endereco = coalesce(nullif(trim(endereco), ''), ''),
    imagens_veiculo = coalesce(imagens_veiculo, '[]'::jsonb)
where email is null
   or cep is null
   or endereco is null
   or imagens_veiculo is null;