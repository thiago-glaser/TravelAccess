-- Migration: Add VALUE_CONFIRMED field to SESSION_DATA
-- This field tracks whether the session cost was calculated from actual fuel data (Y)
-- or is an estimated/projected value (N).
-- 
-- Y = Confirmed: cost was calculated using the fuel page "Calculate" button
-- N = Estimated: cost was projected from nearby fuel records
--
-- Run this once on both local and remote Oracle databases.

ALTER TABLE SESSION_DATA ADD VALUE_CONFIRMED CHAR(1) DEFAULT 'N';

-- Update existing rows that already have a cost set to 'N' (estimated, since we can't know if they were confirmed)
UPDATE SESSION_DATA SET VALUE_CONFIRMED = 'N' WHERE VALUE_CONFIRMED IS NULL;

COMMIT;
