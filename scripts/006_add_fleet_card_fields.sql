alter table public.fleet_vehicles
  add column if not exists numero_cartao_combustivel text,
  add column if not exists placa_cartao_combustivel text;