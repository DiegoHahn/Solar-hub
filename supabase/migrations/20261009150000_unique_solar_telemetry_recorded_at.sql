-- One telemetry row per collection instant, so the collector can replay its offline queue safely.
-- Each cycle stamps its snapshot with a microsecond, timezone-aware timestamp, so two genuine
-- readings never share a recorded_at; equal values only come from a replay that was interrupted
-- after some rows had been accepted and was later sent again.
--
-- Apply this migration BEFORE deploying a collector that posts with on_conflict=recorded_at:
-- PostgREST rejects that request when no unique index exists on the column.

-- Removes the duplicates left by earlier replays, keeping the first row inserted (lowest id).
-- The rows are identical copies of the same snapshot, and the nightly roll-up uses max() per day,
-- so the daily and monthly history does not change.
DELETE FROM public.solar_telemetry a
USING public.solar_telemetry b
WHERE a.recorded_at = b.recorded_at
  AND a.id > b.id;

-- recorded_at is already NOT NULL with a default (initial schema); the constraint below makes it
-- the upsert key. Its unique index also serves the dashboard's ORDER BY recorded_at DESC and range
-- queries, so the old non-unique index becomes redundant.
ALTER TABLE public.solar_telemetry
    ADD CONSTRAINT solar_telemetry_recorded_at_key UNIQUE (recorded_at);

DROP INDEX IF EXISTS public.idx_solar_telemetry_recorded_at;

COMMENT ON CONSTRAINT solar_telemetry_recorded_at_key ON public.solar_telemetry IS
    'One snapshot per collection instant; upsert key used by collector/inverters.py (ignore-duplicates).';
