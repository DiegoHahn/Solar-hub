-- Nightly roll-up of raw telemetry into the daily and monthly history tables, followed by retention
-- of the raw rows. The dashboard reads the history tables first, so purging raw telemetry older than
-- the retention window does not change what it shows.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Daily energy per inverter and for the whole plant on `p_date` (Brasília), from the highest
-- "today" counter of the day. Rows imported from the manufacturer portals are kept; only estimated
-- rows and earlier roll-ups are replaced.
CREATE OR REPLACE FUNCTION public.rollup_daily_generation(p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    -- Day boundaries as instants, so the range uses the index on recorded_at.
    v_start timestamptz := p_date::timestamp AT TIME ZONE 'America/Sao_Paulo';
    v_end timestamptz := (p_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
BEGIN
    INSERT INTO public.inverter_daily_history (date, inverter_id, inverter_name, brand, kwh, is_estimated, source)
    SELECT
        p_date,
        inv->>'id',
        coalesce(max(inv->>'name'), inv->>'id'),
        coalesce(max(inv->>'brand'), 'unknown'),
        max((inv->>'energy_today_kwh')::numeric),
        false,
        'telemetry'
    FROM public.solar_telemetry t
    CROSS JOIN LATERAL jsonb_array_elements(t.inverters_data) inv
    WHERE t.recorded_at >= v_start AND t.recorded_at < v_end
      AND inv->>'id' IS NOT NULL
      AND inv->>'energy_today_kwh' IS NOT NULL
    GROUP BY inv->>'id'
    ON CONFLICT (date, inverter_id) DO UPDATE
        SET kwh = EXCLUDED.kwh,
            inverter_name = EXCLUDED.inverter_name,
            brand = EXCLUDED.brand,
            is_estimated = false,
            source = 'telemetry'
        WHERE public.inverter_daily_history.is_estimated
           OR public.inverter_daily_history.source = 'telemetry';

    INSERT INTO public.inverter_daily_history (date, inverter_id, inverter_name, brand, kwh, is_estimated, source)
    SELECT p_date, 'plant_total', 'Plant total', 'combined', max(total_today_kwh), false, 'telemetry'
    FROM public.solar_telemetry
    WHERE recorded_at >= v_start AND recorded_at < v_end
    HAVING count(*) > 0
    ON CONFLICT (date, inverter_id) DO UPDATE
        SET kwh = EXCLUDED.kwh,
            is_estimated = false,
            source = 'telemetry'
        WHERE public.inverter_daily_history.is_estimated
           OR public.inverter_daily_history.source = 'telemetry';
END;
$$;

-- Monthly totals for `p_month` (YYYY-MM) summed from the daily history. A stored total is replaced
-- when it is estimated, came from an earlier roll-up, or is lower than the daily sum: portal imports
-- taken mid-month hold only part of the month.
CREATE OR REPLACE FUNCTION public.rollup_monthly_generation(p_month TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.inverter_monthly_history (month, inverter_id, inverter_name, brand, kwh, is_estimated, source)
    SELECT p_month, inverter_id, max(inverter_name), max(brand), sum(kwh), bool_or(is_estimated), 'daily_rollup'
    FROM public.inverter_daily_history
    WHERE to_char(date, 'YYYY-MM') = p_month
    GROUP BY inverter_id
    ON CONFLICT (month, inverter_id) DO UPDATE
        SET kwh = EXCLUDED.kwh,
            is_estimated = EXCLUDED.is_estimated,
            source = 'daily_rollup'
        WHERE public.inverter_monthly_history.is_estimated
           OR public.inverter_monthly_history.source = 'daily_rollup'
           OR public.inverter_monthly_history.kwh < EXCLUDED.kwh;
END;
$$;

-- Deletes raw telemetry older than `p_keep_days`, only for days whose plant total is already in the
-- daily history. Returns the number of rows deleted.
CREATE OR REPLACE FUNCTION public.purge_old_telemetry(p_keep_days INT DEFAULT 90)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_deleted bigint;
BEGIN
    WITH deleted AS (
        DELETE FROM public.solar_telemetry t
        WHERE t.recorded_at < now() - make_interval(days => p_keep_days)
          AND EXISTS (
              SELECT 1 FROM public.inverter_daily_history h
              WHERE h.inverter_id = 'plant_total'
                AND h.date = (t.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date
          )
        RETURNING 1
    )
    SELECT count(*) INTO v_deleted FROM deleted;
    RETURN v_deleted;
END;
$$;

-- Rolls up the last seven days (Brasília) so readings the collector sends late from its offline queue
-- are included, refreshes the affected months and purges raw rows outside the retention window.
CREATE OR REPLACE FUNCTION public.run_telemetry_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_yesterday DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1;
    v_day DATE;
    v_month TEXT;
BEGIN
    FOR v_day IN SELECT generate_series(v_yesterday - 6, v_yesterday, interval '1 day')::date LOOP
        PERFORM public.rollup_daily_generation(v_day);
    END LOOP;

    FOR v_month IN SELECT DISTINCT to_char(d, 'YYYY-MM')
                   FROM generate_series(v_yesterday - 6, v_yesterday, interval '1 day') d LOOP
        PERFORM public.rollup_monthly_generation(v_month);
    END LOOP;

    PERFORM public.purge_old_telemetry(90);
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_daily_generation(DATE) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollup_monthly_generation(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_old_telemetry(INT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_telemetry_maintenance() FROM public, anon, authenticated;

COMMENT ON FUNCTION public.run_telemetry_maintenance() IS 'Nightly telemetry roll-up and retention (pg_cron)';

-- Fills the history for the days collected since the portal imports stopped.
SELECT public.rollup_daily_generation(d::date)
FROM generate_series('2026-09-18'::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, interval '1 day') d;

SELECT public.rollup_monthly_generation(to_char(m, 'YYYY-MM'))
FROM generate_series('2026-09-01'::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 month') m;

-- 06:10 UTC = 03:10 Brasília, after the day's last reading and before the first one.
SELECT cron.schedule('telemetry-maintenance', '10 6 * * *', $$SELECT public.run_telemetry_maintenance()$$);
