BEGIN

    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'JOB_EXTRACT_POINTS',
        job_type        => 'STORED_PROCEDURE',
        job_action      => 'EXTRACT_POINTS',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=5',
        enabled         => TRUE
    );

    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'JOB_GEOCODE_PENDING_LOCATIONS',
        job_type        => 'PLSQL_BLOCK',
        job_action      => q'[
        BEGIN
          GEOCODE_FIRST_10_LOCATIONS;
          GEOCODE_SESSION;
          COMMIT;
        EXCEPTION
          WHEN OTHERS THEN
            -- Log error but never let the job die
            DBMS_OUTPUT.PUT_LINE('JOB_GEOCODE error: ' || SQLERRM);
            -- Optional: insert into a log table here
        END;]',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=6',
        enabled         => TRUE
    );

    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'MERGE_LOCATION_GEOCODES_JOB',
        job_type        => 'STORED_PROCEDURE',
        job_action      => 'PROC_MERGE_LOCATION_GEOCODES',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=5',
        enabled         => TRUE
    );
END;
/
