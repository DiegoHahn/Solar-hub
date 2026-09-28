-- O nome da usina é enviado pelo coletor (collector/config.json); o default é apenas um valor genérico.
ALTER TABLE public.solar_telemetry ALTER COLUMN plant_name SET DEFAULT 'Usina Solar (16 kW)';
