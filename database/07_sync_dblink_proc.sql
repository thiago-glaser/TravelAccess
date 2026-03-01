CREATE OR REPLACE PROCEDURE sync_table_via_dblink(
    p_table_name IN VARCHAR2,
    p_db_link    IN VARCHAR2 DEFAULT 'CLOUD_LINK'
)
AS
    v_table_name VARCHAR2(128) := UPPER(TRIM(p_table_name));
    v_last_sync TIMESTAMP := TO_TIMESTAMP('2020-01-01 00:00:00.000', 'YYYY-MM-DD HH24:MI:SS.FF3');
    v_max_cloud_date TIMESTAMP;
    v_max_local_date TIMESTAMP;
    v_new_sync_time TIMESTAMP;
    
    v_match_cond CLOB;
    v_update_set CLOB;
    v_insert_cols CLOB;
    v_insert_vals CLOB;
    
    v_pull_sql CLOB;
    v_push_sql CLOB;
    
    v_pull_affected NUMBER := 0;
    v_push_affected NUMBER := 0;
    
    v_pk_cols sys.odcivarchar2list := sys.odcivarchar2list();
    
    v_is_first BOOLEAN := TRUE;
    v_is_first_update BOOLEAN := TRUE;
    v_has_columns BOOLEAN := FALSE;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Starting DB Link Sync for Table: ' || v_table_name || ' ---');
    
    -- Ensure SYNC_STATE exists 
    BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE SYNC_STATE (
            ID VARCHAR2(50) PRIMARY KEY,
            LAST_SYNC TIMESTAMP,
            UPDATED_AT TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP)
        )';
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -955 THEN -- ORA-00955: name is already USED by an existing object
            DBMS_OUTPUT.PUT_LINE('Warning creating SYNC_STATE: ' || SQLERRM);
        END IF;
    END;
    
    -- Get last sync
    BEGIN
        EXECUTE IMMEDIATE 'SELECT LAST_SYNC FROM SYNC_STATE WHERE ID = :1' INTO v_last_sync USING v_table_name;
    EXCEPTION WHEN NO_DATA_FOUND THEN
        NULL; -- Keep default 2020
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error reading SYNC_STATE: ' || SQLERRM);
    END;
    
    DBMS_OUTPUT.PUT_LINE('[' || v_table_name || '] Last sync marker: ' || TO_CHAR(v_last_sync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'));
    
    v_max_cloud_date := v_last_sync;
    v_max_local_date := v_last_sync;
    
    -- Get max dates
    BEGIN
        EXECUTE IMMEDIATE 'SELECT NVL(MAX(UPDATED_AT), :1) FROM ' || v_table_name || '@' || p_db_link || ' WHERE UPDATED_AT > :2' 
            INTO v_max_cloud_date USING v_last_sync, v_last_sync;
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Warning: Could not fetch cloud max date: ' || SQLERRM);
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'SELECT NVL(MAX(UPDATED_AT), :1) FROM ' || v_table_name || ' WHERE UPDATED_AT > :2' 
            INTO v_max_local_date USING v_last_sync, v_last_sync;
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Warning: Could not fetch local max date: ' || SQLERRM);
    END;
    
    IF v_table_name = 'DEVICES' THEN
        v_pk_cols.EXTEND(1); v_pk_cols(1) := 'DEVICE_ID';
    ELSIF v_table_name = 'PARAMETER' THEN
        v_pk_cols.EXTEND(1); v_pk_cols(1) := 'KEY';
    ELSIF v_table_name = 'USER_DEVICES' THEN
        v_pk_cols.EXTEND(2); v_pk_cols(1) := 'USER_ID'; v_pk_cols(2) := 'DEVICE_ID';
    ELSE
        v_pk_cols.EXTEND(1); v_pk_cols(1) := 'ID';
    END IF;
    
    v_match_cond := '';
    FOR i IN 1..v_pk_cols.COUNT LOOP
        IF i > 1 THEN v_match_cond := v_match_cond || ' AND '; END IF;
        v_match_cond := v_match_cond || 't.' || v_pk_cols(i) || ' = s.' || v_pk_cols(i);
    END LOOP;
    
    v_update_set := '';
    v_insert_cols := '';
    v_insert_vals := '';
    
    FOR r IN (
        SELECT COLUMN_NAME FROM USER_TAB_COLUMNS 
        WHERE TABLE_NAME = v_table_name 
          AND COLUMN_NAME NOT IN ('RECEIPT_IMAGE', 'RECEIPT_MIME')
        ORDER BY COLUMN_ID
    ) LOOP
        v_has_columns := TRUE;
        
        DECLARE
            v_is_pk BOOLEAN := FALSE;
        BEGIN
            FOR i IN 1..v_pk_cols.COUNT LOOP
                IF v_pk_cols(i) = r.COLUMN_NAME THEN
                    v_is_pk := TRUE;
                    EXIT;
                END IF;
            END LOOP;
            
            IF NOT v_is_first THEN
                v_insert_cols := v_insert_cols || ', ';
                v_insert_vals := v_insert_vals || ', ';
            END IF;
            
            v_insert_cols := v_insert_cols || r.COLUMN_NAME;
            v_insert_vals := v_insert_vals || 's.' || r.COLUMN_NAME;
            v_is_first := FALSE;
            
            IF NOT v_is_pk THEN
                IF NOT v_is_first_update THEN
                    v_update_set := v_update_set || ', ';
                END IF;
                v_update_set := v_update_set || 't.' || r.COLUMN_NAME || ' = s.' || r.COLUMN_NAME;
                v_is_first_update := FALSE;
            END IF;
        END;
    END LOOP;
    
    IF NOT v_has_columns THEN
        DBMS_OUTPUT.PUT_LINE('Table ' || v_table_name || ' not found in local schema or no valid columns.');
        RETURN;
    END IF;
    
    -- Cloud -> Local (Pull)
    v_pull_sql := 'MERGE INTO ' || v_table_name || ' t ' ||
                  'USING (SELECT ' || v_insert_cols || ' FROM ' || v_table_name || '@' || p_db_link || 
                  ' WHERE UPDATED_AT > :1) s ' ||
                  'ON (' || v_match_cond || ') ';
                  
    IF LENGTH(v_update_set) > 0 THEN
        v_pull_sql := v_pull_sql || 'WHEN MATCHED THEN UPDATE SET ' || v_update_set || ' ';
    END IF;
    
    v_pull_sql := v_pull_sql || 'WHEN NOT MATCHED THEN INSERT (' || v_insert_cols || ') VALUES (' || v_insert_vals || ')';
    
    BEGIN
        EXECUTE IMMEDIATE v_pull_sql USING v_last_sync;
        v_pull_affected := SQL%ROWCOUNT;
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('[Cloud -> Local] Successfully merged ' || v_pull_affected || ' records.');
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('[Cloud -> Local] MERGE Error: ' || SQLERRM);
        ROLLBACK;
    END;
    
    -- Local -> Cloud (Push)
    v_push_sql := 'MERGE INTO ' || v_table_name || '@' || p_db_link || ' t ' ||
                  'USING (SELECT ' || v_insert_cols || ' FROM ' || v_table_name || 
                  ' WHERE UPDATED_AT > :1) s ' ||
                  'ON (' || v_match_cond || ') ';
                  
    IF LENGTH(v_update_set) > 0 THEN
        v_push_sql := v_push_sql || 'WHEN MATCHED THEN UPDATE SET ' || v_update_set || ' ';
    END IF;
    
    v_push_sql := v_push_sql || 'WHEN NOT MATCHED THEN INSERT (' || v_insert_cols || ') VALUES (' || v_insert_vals || ')';
    
    BEGIN
        EXECUTE IMMEDIATE v_push_sql USING v_last_sync;
        v_push_affected := SQL%ROWCOUNT;
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('[Local -> Cloud] Successfully merged ' || v_push_affected || ' records.');
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('[Local -> Cloud] MERGE Error: ' || SQLERRM);
        ROLLBACK;
    END;
    
    -- Update marker
    IF v_max_cloud_date > v_max_local_date THEN
        v_new_sync_time := v_max_cloud_date;
    ELSE
        v_new_sync_time := v_max_local_date;
    END IF;
    
    IF v_new_sync_time > v_last_sync THEN
        DBMS_OUTPUT.PUT_LINE('[' || v_table_name || '] Advancing sync marker to: ' || TO_CHAR(v_new_sync_time, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'));
        
        BEGIN
            EXECUTE IMMEDIATE '
                MERGE INTO SYNC_STATE target
                USING (SELECT :1 AS ID, :2 AS LAST_SYNC FROM DUAL) source
                ON (target.ID = source.ID)
                WHEN MATCHED THEN
                    UPDATE SET target.LAST_SYNC = source.LAST_SYNC, target.UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
                WHEN NOT MATCHED THEN
                    INSERT (ID, LAST_SYNC, UPDATED_AT) VALUES (source.ID, source.LAST_SYNC, SYS_EXTRACT_UTC(SYSTIMESTAMP))
            ' USING v_table_name, v_new_sync_time;
            COMMIT;
        EXCEPTION WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Error updating local sync state: ' || SQLERRM);
            ROLLBACK;
        END;
        
        BEGIN
            EXECUTE IMMEDIATE '
                MERGE INTO SYNC_STATE@' || p_db_link || ' target
                USING (SELECT :1 AS ID, :2 AS LAST_SYNC FROM DUAL) source
                ON (target.ID = source.ID)
                WHEN MATCHED THEN
                    UPDATE SET target.LAST_SYNC = source.LAST_SYNC, target.UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
                WHEN NOT MATCHED THEN
                    INSERT (ID, LAST_SYNC, UPDATED_AT) VALUES (source.ID, source.LAST_SYNC, SYS_EXTRACT_UTC(SYSTIMESTAMP))
            ' USING v_table_name, v_new_sync_time;
            COMMIT;
        EXCEPTION WHEN OTHERS THEN
            -- DBMS_OUTPUT.PUT_LINE('Warning updating cloud sync state: ' || SQLERRM);
            NULL;
        END;
    ELSE
        DBMS_OUTPUT.PUT_LINE('[' || v_table_name || '] No new records synced. Marker remains: ' || TO_CHAR(v_last_sync, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'));
    END IF;

    DBMS_OUTPUT.PUT_LINE('=================================================');
    DBMS_OUTPUT.PUT_LINE('✅ SYNC SUMMARY FOR TABLE: ' || v_table_name);
    DBMS_OUTPUT.PUT_LINE('   🔸 Cloud to Local Transferred: ' || v_pull_affected);
    DBMS_OUTPUT.PUT_LINE('   🔸 Local to Cloud Transferred: ' || v_push_affected);
    DBMS_OUTPUT.PUT_LINE('   🔸 Total Records Transferred:  ' || (v_pull_affected + v_push_affected));
    DBMS_OUTPUT.PUT_LINE('=================================================');

END sync_table_via_dblink;
/

CREATE OR REPLACE PROCEDURE sync_all_tables_dblink(
    p_db_link IN VARCHAR2 DEFAULT 'CLOUD_LINK'
)
AS
    TYPE t_tables IS VARRAY(12) OF VARCHAR2(50);
    v_tables t_tables := t_tables(
        'USERS', 'API_KEYS', 'DEVICES', 'USER_DEVICES', 'CARS',
        'BLUETOOTH', 'FUEL', 'LOCATION', 'LOCATION_DATA',
        'LOCATION_GEOCODE', 'SESSION_DATA', 'PARAMETER'
    );
BEGIN
    DBMS_OUTPUT.PUT_LINE('=== Starting Full Database Sync over DB_LINK: ' || p_db_link || ' ===');
    FOR i IN 1..v_tables.COUNT LOOP
        BEGIN
            sync_table_via_dblink(v_tables(i), p_db_link);
        EXCEPTION WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Error syncing table ' || v_tables(i) || ': ' || SQLERRM);
        END;
    END LOOP;
    DBMS_OUTPUT.PUT_LINE('=== Full Database Sync Complete ===');
END sync_all_tables_dblink;
/
