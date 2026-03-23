-- =============================================================
-- 10_usage_tracking.sql
-- Monthly page/API usage counter table + upsert procedure
-- =============================================================

-- Stores one row per (path, year, month).
-- HIT_COUNT is incremented atomically via the procedure below.
CREATE TABLE PAGE_USAGE_MONTHLY (
    ID           CHAR(36)       DEFAULT SYS_GUID() NOT NULL PRIMARY KEY,
    PATH         VARCHAR2(500)  NOT NULL,
    YEAR_NUM     NUMBER(4)      NOT NULL,
    MONTH_NUM    NUMBER(2)      NOT NULL,
    HIT_COUNT    NUMBER         DEFAULT 1 NOT NULL,
    CREATED_AT   TIMESTAMP      DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP),
    UPDATED_AT   TIMESTAMP      DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP),
    CONSTRAINT UQ_USAGE_PATH_MONTH UNIQUE (PATH, YEAR_NUM, MONTH_NUM)
);

-- Index for fast dashboard queries (order by year/month desc, group by path)
CREATE INDEX IDX_USAGE_YEAR_MONTH ON PAGE_USAGE_MONTHLY (YEAR_NUM, MONTH_NUM);
CREATE INDEX IDX_USAGE_PATH       ON PAGE_USAGE_MONTHLY (PATH);

-- -----------------------------------------------------------------
-- Procedure: UPSERT_PAGE_USAGE
--   Increments HIT_COUNT for the given path in the current UTC month.
--   Uses MERGE so it is safe for concurrent calls.
-- -----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE UPSERT_PAGE_USAGE (
    p_path IN VARCHAR2
) AS
    v_year  NUMBER := EXTRACT(YEAR  FROM SYS_EXTRACT_UTC(SYSTIMESTAMP));
    v_month NUMBER := EXTRACT(MONTH FROM SYS_EXTRACT_UTC(SYSTIMESTAMP));
BEGIN
    MERGE INTO PAGE_USAGE_MONTHLY tgt
    USING (SELECT p_path AS path, v_year AS yr, v_month AS mo FROM DUAL) src
    ON (tgt.PATH = src.path AND tgt.YEAR_NUM = src.yr AND tgt.MONTH_NUM = src.mo)
    WHEN MATCHED THEN
        UPDATE SET tgt.HIT_COUNT = tgt.HIT_COUNT + 1,
                   tgt.UPDATED_AT = SYS_EXTRACT_UTC(SYSTIMESTAMP)
    WHEN NOT MATCHED THEN
        INSERT (ID, PATH, YEAR_NUM, MONTH_NUM, HIT_COUNT, CREATED_AT, UPDATED_AT)
        VALUES (SYS_GUID(), src.path, src.yr, src.mo, 1,
                SYS_EXTRACT_UTC(SYSTIMESTAMP), SYS_EXTRACT_UTC(SYSTIMESTAMP));
    COMMIT;
END UPSERT_PAGE_USAGE;
/
