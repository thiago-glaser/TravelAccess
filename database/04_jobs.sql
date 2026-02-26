BEGIN

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
