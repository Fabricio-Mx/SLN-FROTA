alter table public.fleet_vehicles
  add column if not exists revisao_agendada_em timestamptz;
