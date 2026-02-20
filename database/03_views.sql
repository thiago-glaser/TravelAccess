CREATE OR REPLACE VIEW V_LOCATION_ENRICHED AS
WITH loc_tz AS (
    -- Get the timezone name for each location (fallback to America/Winnipeg)
    SELECT 
        l.ID AS location_id,
        NVL(g.TIMEZONE_NAME, 'America/Winnipeg') AS tz_name
    FROM LOCATION l
    LEFT JOIN LOCATION_GEOCODE g ON l.LOCATION_GEOCODE_ID = g.ID
)
SELECT 
    -- Basic fields
    l.ID,
    l.DEVICE_ID,

    -- UTC timestamps (original)
    l.TIMESTAMP_UTC_START,
    l.TIMESTAMP_UTC_END,

    -- LOCAL times using the actual geocoded timezone!
    FROM_TZ(l.TIMESTAMP_UTC_START, 'UTC') 
        AT TIME ZONE (tz.tz_name)          AS TIMESTAMP_LOCAL_START,

    FROM_TZ(l.TIMESTAMP_UTC_END, 'UTC') 
        AT TIME ZONE (tz.tz_name)          AS TIMESTAMP_LOCAL_END,

    -- Duration in minutes (rounded to 2 decimals)
    ROUND(
        (CAST(l.TIMESTAMP_UTC_END AS DATE) - CAST(l.TIMESTAMP_UTC_START AS DATE)) * 1440,
        2
    )                                           AS DURATION_MINUTES,

    -- Full formatted address
    fix_mojibake(NVL(g.FORMATTED_ADDRESS, 'Unknown location')) AS ADDRESS,

    -- Individual address parts (useful for filtering)
    g.HOUSENUMBER,
    g.STREET,
    g.SUBURB,
    g.CITY,
    g.POSTCODE,

    -- Extra useful fields
    g.RESULT_TYPE,
    g.GEOCODE_DISTANCE_M,
    NVL(D.DESCRIPTION, 'Unknown device') as DEVICE,
    tz.tz_name AS TIMEZONE_USED,
    l.LOCATION_GEOCODE_ID,
    l.LATITUDE,
    l.LONGITUDE
FROM LOCATION l
LEFT JOIN LOCATION_GEOCODE g 
       ON l.LOCATION_GEOCODE_ID = g.ID
LEFT JOIN loc_tz tz 
       ON l.ID = tz.location_id
LEFT JOIN DEVICES D ON (D.DEVICE_ID = L.DEVICE_ID)
ORDER BY l.TIMESTAMP_UTC_START DESC;

CREATE OR REPLACE VIEW V_SESSIONS AS
select 
S.ID,
S.DEVICE_ID,
S.START_UTC,
S.END_UTC,
S.SESSION_TYPE,
fix_mojibake(NVL(l1.formatted_address, 'Unknow location')) LOCATION_START,
fix_mojibake(NVL(l2.formatted_address, 'Unknow location')) LOCATION_END
from SESSION_DATA S
LEFT JOIN LOCATION_GEOCODE L1 ON (s.geocode_start = l1.id)
LEFT JOIN LOCATION_GEOCODE L2 ON (s.geocode_end = l2.id);

CREATE OR REPLACE VIEW V_SESSION_CALC AS
SELECT
    s.id AS session_id,

    /* Session timestamps */
    s.start_utc AS session_start_utc,
    s.end_utc   AS session_end_utc,

    /* START location selection */
    CASE
        WHEN bs.before_start_diff <= as_.after_start_diff
        THEN bs.before_start_id
        ELSE as_.after_start_id
    END AS start_location_id,

    CASE
        WHEN bs.before_start_diff <= as_.after_start_diff
        THEN bs.before_start_ts
        ELSE as_.after_start_ts
    END AS start_location_utc,

    CASE
        WHEN bs.before_start_diff <= as_.after_start_diff
        THEN bs.before_start_lat
        ELSE as_.after_start_lat
    END AS start_latitude,

    CASE
        WHEN bs.before_start_diff <= as_.after_start_diff
        THEN bs.before_start_lon
        ELSE as_.after_start_lon
    END AS start_longitude,

    /* END location selection */
    CASE
        WHEN be.before_end_diff <= ae.after_end_diff
        THEN be.before_end_id
        ELSE ae.after_end_id
    END AS end_location_id,

    CASE
        WHEN be.before_end_diff <= ae.after_end_diff
        THEN be.before_end_ts
        ELSE ae.after_end_ts
    END AS end_location_utc,

    CASE
        WHEN be.before_end_diff <= ae.after_end_diff
        THEN be.before_end_lat
        ELSE ae.after_end_lat
    END AS end_latitude,

    CASE
        WHEN be.before_end_diff <= ae.after_end_diff
        THEN be.before_end_lon
        ELSE ae.after_end_lon
    END AS end_longitude,
    s.geocode_start,
    s.geocode_end

FROM session_data s

/* START - before */
OUTER APPLY (
    SELECT
        b.id        AS before_start_id,
        b.timestamp_utc AS before_start_ts,
        b.latitude  AS before_start_lat,
        b.longitude AS before_start_lon,
        (s.start_utc - b.timestamp_utc) * 86400 AS before_start_diff
    FROM location_data b
    WHERE b.device_id = s.device_id
      AND b.timestamp_utc <= s.start_utc
    ORDER BY b.timestamp_utc DESC
    FETCH FIRST 1 ROW ONLY
) bs

/* START - after */
OUTER APPLY (
    SELECT
        a.id        AS after_start_id,
        a.timestamp_utc AS after_start_ts,
        a.latitude  AS after_start_lat,
        a.longitude AS after_start_lon,
        (a.timestamp_utc - s.start_utc) * 86400 AS after_start_diff
    FROM location_data a
    WHERE a.device_id = s.device_id
      AND a.timestamp_utc > s.start_utc
    ORDER BY a.timestamp_utc
    FETCH FIRST 1 ROW ONLY
) as_

/* END - before */
OUTER APPLY (
    SELECT
        b.id        AS before_end_id,
        b.timestamp_utc AS before_end_ts,
        b.latitude  AS before_end_lat,
        b.longitude AS before_end_lon,
        (s.end_utc - b.timestamp_utc) * 86400 AS before_end_diff
    FROM location_data b
    WHERE b.device_id = s.device_id
      AND b.timestamp_utc <= s.end_utc
    ORDER BY b.timestamp_utc DESC
    FETCH FIRST 1 ROW ONLY
) be

/* END - after */
OUTER APPLY (
    SELECT
        a.id        AS after_end_id,
        a.timestamp_utc AS after_end_ts,
        a.latitude  AS after_end_lat,
        a.longitude AS after_end_lon,
        (a.timestamp_utc - s.end_utc) * 86400 AS after_end_diff
    FROM location_data a
    WHERE a.device_id = s.device_id
      AND a.timestamp_utc > s.end_utc
    ORDER BY a.timestamp_utc
    FETCH FIRST 1 ROW ONLY
) ae;

