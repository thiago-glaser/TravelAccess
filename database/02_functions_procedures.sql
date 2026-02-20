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

CREATE OR REPLACE PROCEDURE EXTRACT_POINTS
AS
    C_MAX_RADIUS CONSTANT NUMBER := 1000;

    v_device_id      LOCATION.DEVICE_ID%TYPE;

    -- Info about the last immutable segment (everything BEFORE the current one)
    v_last_closed_end_ts   LOCATION.TIMESTAMP_UTC_END%TYPE   := NULL;
    v_last_closed_id       LOCATION.ID%TYPE                 := NULL;

    -- Current (open) segment state
    v_open_start_ts        LOCATION_DATA.TIMESTAMP_UTC%TYPE  := NULL;
    v_open_lat             LOCATION_DATA.LATITUDE%TYPE;
    v_open_lon             LOCATION_DATA.LONGITUDE%TYPE;
    v_open_sum_lat         NUMBER := 0;
    v_open_sum_lon         NUMBER := 0;
    v_open_sum_alt         NUMBER := 0;
    v_open_count           NUMBER := 0;

    v_latest_ts            LOCATION_DATA.TIMESTAMP_UTC%TYPE  := NULL;

BEGIN
	DELETE FROM location l WHERE l.timestamp_utc_start=l.timestamp_utc_end;
    DBMS_OUTPUT.ENABLE(1000000);
    DBMS_OUTPUT.PUT_LINE('=== Radial segmentation – FINAL VERSION (no lost segments) ===');

    FOR dev_rec IN (SELECT DISTINCT DEVICE_ID FROM LOCATION_DATA ORDER BY DEVICE_ID)
    LOOP
        v_device_id := dev_rec.DEVICE_ID;

        -- 1. Find the last CLOSED (immutable) segment for this device
        BEGIN
            SELECT ID, TIMESTAMP_UTC_END
              INTO v_last_closed_id, v_last_closed_end_ts
              FROM LOCATION
             WHERE DEVICE_ID = v_device_id
               AND TIMESTAMP_UTC_END = (
                     SELECT MAX(TIMESTAMP_UTC_END)
                       FROM LOCATION l2
                      WHERE l2.DEVICE_ID = v_device_id
                        AND l2.ID <> (SELECT MAX(ID) FROM LOCATION l3 WHERE l3.DEVICE_ID = v_device_id)  -- exclude current open one
                   );
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                v_last_closed_end_ts := NULL;
                v_last_closed_id     := NULL;
        END;

        -- 2. Remove ONLY the current (open) segment if it exists
        DELETE FROM LOCATION
         WHERE DEVICE_ID = v_device_id
           AND TIMESTAMP_UTC_END = (SELECT MAX(TIMESTAMP_UTC_END) FROM LOCATION WHERE DEVICE_ID = v_device_id);

        DBMS_OUTPUT.PUT_LINE('Processing device: ' || v_device_id ||
            ' | Last closed end: ' || NVL(TO_CHAR(v_last_closed_end_ts, 'YYYY-MM-DD HH24:MI:SS'), 'none'));

        -- Reset current segment state
        v_open_start_ts := NULL;
        v_open_count    := 0;

        FOR loc_rec IN (
            SELECT LATITUDE, LONGITUDE, ALTITUDE, TIMESTAMP_UTC
              FROM LOCATION_DATA
             WHERE DEVICE_ID = v_device_id
               AND LATITUDE IS NOT NULL
               AND LONGITUDE IS NOT NULL
               AND (v_last_closed_end_ts IS NULL OR TIMESTAMP_UTC > v_last_closed_end_ts)
             ORDER BY TIMESTAMP_UTC
        )
        LOOP
            v_latest_ts := loc_rec.TIMESTAMP_UTC;

            -- First point of the "current" period?
            IF v_open_start_ts IS NULL THEN
                v_open_start_ts := loc_rec.TIMESTAMP_UTC;
                v_open_lat      := loc_rec.LATITUDE;
                v_open_lon      := loc_rec.LONGITUDE;

                v_open_sum_lat := loc_rec.LATITUDE;
                v_open_sum_lon := loc_rec.LONGITUDE;
                v_open_sum_alt := NVL(loc_rec.ALTITUDE, 0);
                v_open_count   := 1;

            ELSE
                -- Distance from the CURRENT open segment center
                IF geo_distance_meters(v_open_lat, v_open_lon,
                                       loc_rec.LATITUDE, loc_rec.LONGITUDE) > C_MAX_RADIUS
                THEN
                    -- CLOSE the open segment (now becomes immutable)
                    INSERT INTO LOCATION (ID, DEVICE_ID, TIMESTAMP_UTC_START, TIMESTAMP_UTC_END, LATITUDE, LONGITUDE, ALTITUDE)
                    VALUES (
                        SYS_GUID(), v_device_id,
                        v_open_start_ts,
                        loc_rec.TIMESTAMP_UTC,
                        ROUND(v_open_sum_lat / v_open_count, 8),
                        ROUND(v_open_sum_lon / v_open_count, 8),
                        ROUND(v_open_sum_alt / v_open_count, 2)
                    );

                    -- Start a BRAND NEW open segment
                    v_open_start_ts := loc_rec.TIMESTAMP_UTC;
                    v_open_lat      := loc_rec.LATITUDE;
                    v_open_lon      := loc_rec.LONGITUDE;

                    v_open_sum_lat := loc_rec.LATITUDE;
                    v_open_sum_lon := loc_rec.LONGITUDE;
                    v_open_sum_alt := NVL(loc_rec.ALTITUDE, 0);
                    v_open_count   := 1;

                ELSE
                    -- Still in the same 1 km radius → accumulate
                    v_open_sum_lat := v_open_sum_lat + loc_rec.LATITUDE;
                    v_open_sum_lon := v_open_sum_lon + loc_rec.LONGITUDE;
                    v_open_sum_alt := v_open_sum_alt + NVL(loc_rec.ALTITUDE, 0);
                    v_open_count   := v_open_count + 1;
                END IF;
            END IF;
        END LOOP;

        -- 3. Always insert the final open segment (even if no new points!)
        IF v_open_start_ts IS NOT NULL THEN
            INSERT INTO LOCATION (ID, DEVICE_ID, TIMESTAMP_UTC_START, TIMESTAMP_UTC_END, LATITUDE, LONGITUDE, ALTITUDE)
            VALUES (
                SYS_GUID(), v_device_id,
                v_open_start_ts,
                v_latest_ts,   -- last point seen (or same as start if only one)
                ROUND(v_open_sum_lat / v_open_count, 8),
                ROUND(v_open_sum_lon / v_open_count, 8),
                ROUND(v_open_sum_alt / v_open_count, 2)
            );

            DBMS_OUTPUT.PUT_LINE('Final open segment saved | Start: ' ||
                TO_CHAR(v_open_start_ts, 'YYYY-MM-DD HH24:MI:SS') ||
                ' | End: ' || TO_CHAR(v_latest_ts, 'HH24:MI:SS') ||
                ' | Points: ' || v_open_count);
        END IF;

    END LOOP;

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('=== ALL DONE – NO LOST SEGMENTS OR START TIMES ===');

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('FATAL ERROR: ' || SQLERRM);
        RAISE;
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

CREATE OR REPLACE PROCEDURE GEOCODE_FIRST_10_LOCATIONS
IS
    v_api_key     VARCHAR2(512);
    v_geocode_id  CHAR(32);
    v_call_count  INTEGER := 0;

    CURSOR c_locations IS
        SELECT l.ID, l.LATITUDE, l.LONGITUDE, l.timestamp_utc_start
        FROM   LOCATION l
        WHERE  l.LOCATION_GEOCODE_ID IS NULL
          AND  l.ID <> (
                 -- This subquery finds the absolute latest row per device
                 SELECT MAX(m.ID) KEEP (DENSE_RANK LAST ORDER BY m.TIMESTAMP_UTC_START)
                 FROM   LOCATION m
                 WHERE  m.DEVICE_ID = l.DEVICE_ID
               )
        ORDER BY l.timestamp_utc_start desc
        FETCH FIRST 10 ROWS ONLY;

    TYPE t_feature IS RECORD (
        place_id            VARCHAR2(350),
        plus_code           VARCHAR2(20),
        formatted           VARCHAR2(500),
        address_line1       VARCHAR2(200),
        address_line2       VARCHAR2(200),
        housenumber         VARCHAR2(200),
        street              VARCHAR2(200),
        suburb              VARCHAR2(100),
        city                VARCHAR2(100),
        postcode            VARCHAR2(20),
        county              VARCHAR2(100),
        state               VARCHAR2(100),
        country             VARCHAR2(100),
        result_type         VARCHAR2(50),
        distance            NUMBER,
        tz_name             VARCHAR2(50),
        tz_offset_std       VARCHAR2(10),
        tz_offset_dst       VARCHAR2(10)
    );
    v_feat t_feature;

BEGIN
    SELECT VALUE INTO v_api_key
    FROM PARAMETER
    WHERE KEY = 'API_KEY';

    DBMS_OUTPUT.PUT_LINE('Geocoding batch started – skipping current live record per device');

    FOR loc IN c_locations LOOP

        DECLARE
            v_json CLOB;
            v_exists NUMBER;
        BEGIN
            -- 2 calls per second
            v_call_count := v_call_count + 1;
            IF v_call_count > 1 THEN
                DBMS_LOCK.SLEEP(30);
            END IF;

            v_json := GET_GEOCODE_JSON(loc.LATITUDE, loc.LONGITUDE, v_api_key);
            IF v_json IS NULL THEN
                DBMS_OUTPUT.PUT_LINE('API failed – ID=' || loc.ID);
                CONTINUE;
            END IF;

            -- Parse first feature
            SELECT place_id, plus_code, formatted, address_line1, address_line2,
                   housenumber, street, suburb, city, postcode, county, state, country,
                   result_type, distance, tz_name, tz_offset_std, tz_offset_dst
            INTO   v_feat
            FROM JSON_TABLE(v_json, '$.features[0].properties'
                COLUMNS (
                    place_id         VARCHAR2 PATH '$.place_id',
                    plus_code        VARCHAR2 PATH '$.plus_code',
                    formatted        VARCHAR2 PATH '$.formatted',
                    address_line1    VARCHAR2 PATH '$.address_line1',
                    address_line2    VARCHAR2 PATH '$.address_line2',
                    housenumber      VARCHAR2 PATH '$.housenumber',
                    street           VARCHAR2 PATH '$.street',
                    suburb           VARCHAR2 PATH '$.suburb',
                    city             VARCHAR2 PATH '$.city',
                    postcode         VARCHAR2 PATH '$.postcode',
                    county           VARCHAR2 PATH '$.county',
                    state            VARCHAR2 PATH '$.state',
                    country          VARCHAR2 PATH '$.country',
                    result_type      VARCHAR2 PATH '$.result_type',
                    distance         NUMBER   PATH '$.distance',
                    tz_name          VARCHAR2 PATH '$.timezone.name',
                    tz_offset_std    VARCHAR2 PATH '$.timezone.offset_STD',
                    tz_offset_dst    VARCHAR2 PATH '$.timezone.offset_DST'
                )
            );

            -- Deduplicate by place_id
            SELECT COUNT(*) INTO v_exists
            FROM LOCATION_GEOCODE
            WHERE PLACE_ID = v_feat.place_id;

            IF v_exists = 0 THEN
                v_geocode_id := RAWTOHEX(SYS_GUID());

                INSERT INTO LOCATION_GEOCODE (
                    ID, PLACE_ID, PLUS_CODE, FORMATTED_ADDRESS,
                    ADDRESS_LINE1, ADDRESS_LINE2, HOUSENUMBER, STREET,
                    SUBURB, CITY, POSTCODE, COUNTY, STATE, COUNTRY,
                    RESULT_TYPE, GEOCODE_DISTANCE_M,
                    TIMEZONE_NAME, TIMEZONE_OFFSET_STD, TIMEZONE_OFFSET_DST,
                    GEOCODED_AT
                ) VALUES (
                    v_geocode_id, v_feat.place_id, v_feat.plus_code, v_feat.formatted,
                    v_feat.address_line1, v_feat.address_line2, v_feat.housenumber, v_feat.street,
                    v_feat.suburb, v_feat.city, v_feat.postcode, v_feat.county,
                    v_feat.state, v_feat.country, v_feat.result_type, v_feat.distance,
                    v_feat.tz_name, v_feat.tz_offset_std, v_feat.tz_offset_dst,
                    SYSTIMESTAMP
                );
                DBMS_OUTPUT.PUT_LINE('NEW  → ' || v_feat.formatted);

            ELSE
                SELECT ID INTO v_geocode_id
                FROM LOCATION_GEOCODE
                WHERE PLACE_ID = v_feat.place_id;
                DBMS_OUTPUT.PUT_LINE('REUSE → ' || v_feat.formatted);
            END IF;

            UPDATE LOCATION
            SET LOCATION_GEOCODE_ID = v_geocode_id
            WHERE ID = loc.ID;

            COMMIT;

        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                DBMS_OUTPUT.PUT_LINE('No geocoding result – ID=' || loc.ID);
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('ERROR ID=' || loc.ID || ': ' || SQLERRM);
        END;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Batch complete – ' || v_call_count || ' locations processed');
END;
/

CREATE OR REPLACE PROCEDURE GEOCODE_SESSION
IS
    v_api_key     VARCHAR2(512);
    v_geocode_id  CHAR(32);
    v_call_count  INTEGER := 0;

    CURSOR c_sessions IS
            SELECT 
            SESSION_ID AS ID,
            GEOCODE_START,
            START_LATITUDE AS LATITUDE,
            START_LONGITUDE AS LONGITUDE,
            'S' AS STATUS
            FROM V_SESSION_CALC
            WHERE GEOCODE_START IS NULL AND START_LOCATION_UTC IS NOT NULL
            UNION ALL 
            SELECT 
            SESSION_ID,
            GEOCODE_END,
            END_LATITUDE,
            END_LONGITUDE,
            'E'
            FROM V_SESSION_CALC
            WHERE GEOCODE_END IS NULL AND END_LOCATION_UTC IS NOT NULL;


  TYPE t_feature IS RECORD (
        place_id            VARCHAR2(350),
        plus_code           VARCHAR2(20),
        formatted           VARCHAR2(500),
        address_line1       VARCHAR2(200),
        address_line2       VARCHAR2(200),
        housenumber         VARCHAR2(200),
        street              VARCHAR2(200),
        suburb              VARCHAR2(100),
        city                VARCHAR2(100),
        postcode            VARCHAR2(20),
        county              VARCHAR2(100),
        state               VARCHAR2(100),
        country             VARCHAR2(100),
        result_type         VARCHAR2(50),
        distance            NUMBER,
        tz_name             VARCHAR2(50),
        tz_offset_std       VARCHAR2(10),
        tz_offset_dst       VARCHAR2(10)
    );
    v_feat t_feature;

BEGIN
    SELECT VALUE INTO v_api_key
    FROM PARAMETER
    WHERE KEY = 'API_KEY';

    DBMS_OUTPUT.PUT_LINE('Geocoding batch started – skipping current live record per device');

    FOR loc IN c_sessions LOOP

        DECLARE
            v_json CLOB;
            v_exists NUMBER;
        BEGIN
            -- 2 calls per second
            v_call_count := v_call_count + 1;
            IF v_call_count > 1 THEN
                DBMS_LOCK.SLEEP(1);
            END IF;

            v_json := GET_GEOCODE_JSON(loc.LATITUDE, loc.LONGITUDE, v_api_key);
            IF v_json IS NULL THEN
                DBMS_OUTPUT.PUT_LINE('API failed – ID=' || loc.ID);
                CONTINUE;
            END IF;

            -- Parse first feature
            SELECT place_id, plus_code, formatted, address_line1, address_line2,
                   housenumber, street, suburb, city, postcode, county, state, country,
                   result_type, distance, tz_name, tz_offset_std, tz_offset_dst
            INTO   v_feat
            FROM JSON_TABLE(v_json, '$.features[0].properties'
                COLUMNS (
                    place_id         VARCHAR2 PATH '$.place_id',
                    plus_code        VARCHAR2 PATH '$.plus_code',
                    formatted        VARCHAR2 PATH '$.formatted',
                    address_line1    VARCHAR2 PATH '$.address_line1',
                    address_line2    VARCHAR2 PATH '$.address_line2',
                    housenumber      VARCHAR2 PATH '$.housenumber',
                    street           VARCHAR2 PATH '$.street',
                    suburb           VARCHAR2 PATH '$.suburb',
                    city             VARCHAR2 PATH '$.city',
                    postcode         VARCHAR2 PATH '$.postcode',
                    county           VARCHAR2 PATH '$.county',
                    state            VARCHAR2 PATH '$.state',
                    country          VARCHAR2 PATH '$.country',
                    result_type      VARCHAR2 PATH '$.result_type',
                    distance         NUMBER   PATH '$.distance',
                    tz_name          VARCHAR2 PATH '$.timezone.name',
                    tz_offset_std    VARCHAR2 PATH '$.timezone.offset_STD',
                    tz_offset_dst    VARCHAR2 PATH '$.timezone.offset_DST'
                )
            );

            -- Deduplicate by place_id
            SELECT COUNT(*) INTO v_exists
            FROM LOCATION_GEOCODE
            WHERE PLACE_ID = v_feat.place_id;

            IF v_exists = 0 THEN
                v_geocode_id := RAWTOHEX(SYS_GUID());

                INSERT INTO LOCATION_GEOCODE (
                    ID, PLACE_ID, PLUS_CODE, FORMATTED_ADDRESS,
                    ADDRESS_LINE1, ADDRESS_LINE2, HOUSENUMBER, STREET,
                    SUBURB, CITY, POSTCODE, COUNTY, STATE, COUNTRY,
                    RESULT_TYPE, GEOCODE_DISTANCE_M,
                    TIMEZONE_NAME, TIMEZONE_OFFSET_STD, TIMEZONE_OFFSET_DST,
                    GEOCODED_AT
                ) VALUES (
                    v_geocode_id, v_feat.place_id, v_feat.plus_code, v_feat.formatted,
                    v_feat.address_line1, v_feat.address_line2, v_feat.housenumber, v_feat.street,
                    v_feat.suburb, v_feat.city, v_feat.postcode, v_feat.county,
                    v_feat.state, v_feat.country, v_feat.result_type, v_feat.distance,
                    v_feat.tz_name, v_feat.tz_offset_std, v_feat.tz_offset_dst,
                    SYSTIMESTAMP
                );
                DBMS_OUTPUT.PUT_LINE('NEW  → ' || v_feat.formatted);

            ELSE
                SELECT ID INTO v_geocode_id
                FROM LOCATION_GEOCODE
                WHERE PLACE_ID = v_feat.place_id;
                DBMS_OUTPUT.PUT_LINE('REUSE → ' || v_feat.formatted);
            END IF;

            IF loc.STATUS = 'S' THEN
                UPDATE SESSION_DATA
                SET GEOCODE_START = v_geocode_id
                WHERE ID = loc.ID;
            ELSE
                UPDATE SESSION_DATA
                SET GEOCODE_END = v_geocode_id
                WHERE ID = loc.ID;
            END IF;
            COMMIT;

        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                DBMS_OUTPUT.PUT_LINE('No geocoding result – ID=' || loc.ID);
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('ERROR ID=' || loc.ID || ': ' || SQLERRM);
        END;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Batch complete – ' || v_call_count || ' locations processed');
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

CREATE OR REPLACE FUNCTION GET_GEOCODE_JSON (
    p_lat       IN NUMBER,
    p_lon       IN NUMBER,
    p_api_key   IN VARCHAR2
) RETURN CLOB
IS
    v_url        VARCHAR2(2000);
    v_request    UTL_HTTP.req;
    v_response   UTL_HTTP.resp;
    v_buffer     VARCHAR2(32767);
    v_json_clob  CLOB;
BEGIN
    -- Build URL using CHR(38) = '&' and CHR(61) = '='
    v_url := 
        'https://api.geoapify.com/v1/geocode/reverse?'
        || 'lat'   || CHR(61) || TO_CHAR(p_lat, 'FM999999999.99999999')
        || CHR(38) || 'lon'    || CHR(61) || TO_CHAR(p_lon,  'FM999999999.99999999')
        || CHR(38) || 'apiKey' || CHR(61) || p_api_key;

    DBMS_LOB.createtemporary(v_json_clob, TRUE);

    v_request  := UTL_HTTP.begin_request(v_url, 'GET', 'HTTP/1.1');
    UTL_HTTP.set_header(v_request, 'User-Agent', 'Oracle PL/SQL');
    UTL_HTTP.set_header(v_request, 'Accept',     'application/json');

    v_response := UTL_HTTP.get_response(v_request);

    IF v_response.status_code <> 200 THEN
        DBMS_OUTPUT.put_line('Geoapify error: ' || v_response.status_code ||
                             ' ' || v_response.reason_phrase);
        UTL_HTTP.end_response(v_response);
        RETURN NULL;
    END IF;

    BEGIN
        LOOP
            UTL_HTTP.read_text(v_response, v_buffer, 32767);
            DBMS_LOB.writeappend(v_json_clob, LENGTH(v_buffer), v_buffer);
        END LOOP;
    EXCEPTION
        WHEN UTL_HTTP.end_of_body THEN
            NULL;  -- expected
    END;

    UTL_HTTP.end_response(v_response);
    RETURN v_json_clob;

EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.put_line('GET_GEOCODE_JSON exception: ' || SQLERRM);
        BEGIN
            UTL_HTTP.end_response(v_response);
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
        RETURN NULL;
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

