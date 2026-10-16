-- =============================================================
-- 12_session_ai_description.sql
-- Table to store AI-generated descriptions for trip sessions
-- =============================================================

CREATE TABLE SESSION_AI_DESCRIPTION (
    SESSION_DATA_ID CHAR(36) NOT NULL PRIMARY KEY,
    DESCRIPTION     VARCHAR2(4000),
    CREATED_AT      TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP),
    UPDATED_AT      TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP),
    IS_DELETED      NUMBER DEFAULT 0
);
