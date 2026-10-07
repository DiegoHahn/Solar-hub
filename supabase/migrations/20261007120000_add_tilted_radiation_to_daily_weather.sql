-- Daily irradiation on the plane of the panels (Open-Meteo global_tilted_irradiance summed per day, kWh/m²).
-- Nullable: rows saved before this column existed are refetched by the dashboard and filled in.
ALTER TABLE public.daily_weather ADD COLUMN IF NOT EXISTS tilted_radiation_kwh NUMERIC;

COMMENT ON COLUMN public.daily_weather.tilted_radiation_kwh IS
    'Plane-of-array irradiation for the configured tilt/azimuth, kWh/m² per day';
