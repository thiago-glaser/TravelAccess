CREATE OR REPLACE FUNCTION calculate_distance_traveled(
    p_device_id     IN VARCHAR2,
    p_start_date    IN TIMESTAMP,
    p_end_date      IN TIMESTAMP,
    p_min_speed_kmh IN NUMBER DEFAULT 500     -- optional: ignore jumps > 500 km/h
) RETURN NUMBER
    DETERMINISTIC
    PARALLEL_ENABLE
IS
    TYPE t_location IS RECORD (
        latitude   NUMBER,
        longitude  NUMBER,
        ts         TIMESTAMP
    );

    TYPE t_location_tab IS TABLE OF t_location;

    v_points     t_location_tab;
    v_total_m    NUMBER := 0;
    v_prev_lat   NUMBER;
    v_prev_lon   NUMBER;
    v_prev_ts    TIMESTAMP;
    v_dist       NUMBER;
    v_time_hours NUMBER;
    v_speed_kmh  NUMBER;
BEGIN
    -- Get ordered points (very important!)
    SELECT latitude, longitude, timestamp_utc
    BULK COLLECT INTO v_points
    FROM location_data
    WHERE device_id = p_device_id
      AND timestamp_utc >= p_start_date
      AND timestamp_utc <= p_end_date
    ORDER BY timestamp_utc ASC;

    IF v_points.COUNT <= 1 THEN
        RETURN 0;
    END IF;

    -- Initialize with first point
    v_prev_lat := v_points(1).latitude;
    v_prev_lon := v_points(1).longitude;
    v_prev_ts  := v_points(1).ts;

    -- Start from second point
    FOR i IN 2..v_points.COUNT LOOP
        v_dist := geo_distance_meters(
            v_prev_lat,
            v_prev_lon,
            v_points(i).latitude,
            v_points(i).longitude,
            0.001
        );

        -- Optional: speed filter to remove GPS jumps / bad fixes
        IF p_min_speed_kmh IS NOT NULL AND p_min_speed_kmh > 0 THEN
            v_time_hours := 
                EXTRACT(SECOND FROM (v_points(i).ts - v_prev_ts)) / 3600 +
                EXTRACT(MINUTE FROM (v_points(i).ts - v_prev_ts)) / 60 +
                EXTRACT(HOUR   FROM (v_points(i).ts - v_prev_ts));

            IF v_time_hours > 0 THEN
                v_speed_kmh := (v_dist / 1000) / v_time_hours;

                -- Ignore this segment if speed looks unrealistic
                IF v_speed_kmh > p_min_speed_kmh THEN
                    -- Option A: skip adding distance (most common)
                    v_dist := 0;

                    -- Option B: just log / count bad points (you could add counter)
                    -- DBMS_OUTPUT.PUT_LINE('High speed jump: ' || ROUND(v_speed_kmh,1) || ' km/h');
                END IF;
            END IF;
        END IF;

        v_total_m := v_total_m + v_dist;

        -- Update previous point
        v_prev_lat := v_points(i).latitude;
        v_prev_lon := v_points(i).longitude;
        v_prev_ts  := v_points(i).ts;
    END LOOP;

    RETURN ROUND(v_total_m, 2);  -- meters with 2 decimals
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 0;
    WHEN OTHERS THEN
        -- In production you might want to log error
        RAISE;
END calculate_distance_traveled;
/

CREATE OR REPLACE FUNCTION calculate_distance_traveled_sql(
    p_device_id  IN VARCHAR2,
    p_start_date IN TIMESTAMP,
    p_end_date   IN TIMESTAMP
) RETURN NUMBER
IS
    v_result NUMBER;
BEGIN
    SELECT NVL(SUM(segment_m), 0)
    INTO v_result
    FROM (
        SELECT geo_distance_meters(
                   LAG(latitude)  OVER (ORDER BY timestamp_utc),
                   LAG(longitude) OVER (ORDER BY timestamp_utc),
                   latitude,
                   longitude,
                   0.001
               ) AS segment_m
        FROM location_data
        WHERE device_id = p_device_id
          AND timestamp_utc >= p_start_date
          AND timestamp_utc <= p_end_date
    )
    WHERE segment_m IS NOT NULL;   -- skip first row (no previous)

    RETURN ROUND(v_result, 2);
END;

/


CREATE OR REPLACE FUNCTION fix_mojibake(p_garbled IN VARCHAR2) RETURN VARCHAR2 IS
    v_raw     RAW(32767);
    v_fixed   VARCHAR2(32767);
BEGIN
    IF p_garbled IS NULL THEN
        RETURN NULL;
    END IF;

    -- Treat garbled string as ISO-8859-1 bytes, then interpret as UTF-8
    v_raw := UTL_I18N.STRING_TO_RAW(
                data => p_garbled,
                dst_charset => 'WE8ISO8859P1'  -- This is Oracle's name for ISO-8859-1
             );

    v_fixed := UTL_I18N.RAW_TO_CHAR(
                  data => v_raw,
                  src_charset => 'AL32UTF8'
               );

    RETURN v_fixed;

EXCEPTION
    WHEN OTHERS THEN
        RETURN p_garbled;  -- Return original if any unexpected error
END;

/



CREATE OR REPLACE FUNCTION geo_distance_meters(
    p_lat1 IN NUMBER,
    p_lon1 IN NUMBER,
    p_lat2 IN NUMBER,
    p_lon2 IN NUMBER,    
    p_tolerance IN NUMBER DEFAULT 0.001
) RETURN NUMBER
DETERMINISTIC
IS
BEGIN
    RETURN SDO_GEOM.SDO_DISTANCE(
        SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(p_lon1, p_lat1, NULL), NULL, NULL),
        SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(p_lon2, p_lat2, NULL), NULL, NULL),
        p_tolerance,
        'UNIT=METER'
    );
END;
/


CREATE OR REPLACE PROCEDURE               proc_merge_location_geocodes
IS
BEGIN
    UPDATE location
       SET location_geocode_id = '4479335CB9F43EF3E063020011ACF2F3'
     WHERE location_geocode_id IN (
           '4479335CB9A33EF3E063020011ACF2F3',
           '4479335CBAF13EF3E063020011ACF2F3',
           '4479335CBCA93EF3E063020011ACF2F3',
           '4479335CBD253EF3E063020011ACF2F3',
           '4479335CBC5F3EF3E063020011ACF2F3',
           '4479335CBAFF3EF3E063020011ACF2F3',
           '4479335CBDC63EF3E063020011ACF2F3',
           '454B219E17052C3FE063020011AC1047',
           '454FECE27659651AE063020011AC245A',
           '45B40D5253542890E063020011AC0D86',
           '4594DD36FFE6EB70E063020011AC250D',
           '45A74DD6F088403DE063020011ACE290',
           '454FECE2762A651AE063020011AC245A',
           '45C0DFCCD1D6C020E063020011ACC48F');
    UPDATE session_data
       SET geocode_start = '4479335CB9F43EF3E063020011ACF2F3'
     WHERE geocode_start IN (
           '4479335CB9A33EF3E063020011ACF2F3',
           '4479335CBAF13EF3E063020011ACF2F3',
           '4479335CBCA93EF3E063020011ACF2F3',
           '4479335CBD253EF3E063020011ACF2F3',
           '4479335CBC5F3EF3E063020011ACF2F3',
           '4479335CBAFF3EF3E063020011ACF2F3',
           '4479335CBDC63EF3E063020011ACF2F3',
           '454B219E17052C3FE063020011AC1047',
           '454FECE27659651AE063020011AC245A',
           '45B40D5253542890E063020011AC0D86',
           '4594DD36FFE6EB70E063020011AC250D',
           '45A74DD6F088403DE063020011ACE290',
           '454FECE2762A651AE063020011AC245A',
           '45C0DFCCD1D6C020E063020011ACC48F');
    UPDATE session_data
       SET geocode_end = '4479335CB9F43EF3E063020011ACF2F3'
     WHERE geocode_end IN (
           '4479335CB9A33EF3E063020011ACF2F3',
           '4479335CBAF13EF3E063020011ACF2F3',
           '4479335CBCA93EF3E063020011ACF2F3',
           '4479335CBD253EF3E063020011ACF2F3',
           '4479335CBC5F3EF3E063020011ACF2F3',
           '4479335CBAFF3EF3E063020011ACF2F3',
           '4479335CBDC63EF3E063020011ACF2F3',
           '454B219E17052C3FE063020011AC1047',
           '454FECE27659651AE063020011AC245A',
           '45B40D5253542890E063020011AC0D86',
           '4594DD36FFE6EB70E063020011AC250D',
           '45A74DD6F088403DE063020011ACE290',
           '454FECE2762A651AE063020011AC245A',
           '45C0DFCCD1D6C020E063020011ACC48F');


END;
/

