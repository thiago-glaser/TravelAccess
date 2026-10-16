-- =============================================================
-- 12_session_ai_description.sql
-- Table to store AI-generated descriptions for trip sessions
-- =============================================================

-- MySQL Syntax:
CREATE TABLE IF NOT EXISTS SESSION_AI_DESCRIPTION (
    SESSION_DATA_ID CHAR(36) NOT NULL PRIMARY KEY,
    DESCRIPTION     VARCHAR(4000),
    CREATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    IS_DELETED      INT DEFAULT 0
);

-- Oracle Database Syntax (if syncing to Oracle Cloud):
-- CREATE TABLE SESSION_AI_DESCRIPTION (
--     SESSION_DATA_ID CHAR(36) NOT NULL PRIMARY KEY,
--     DESCRIPTION     VARCHAR2(4000),
--     CREATED_AT      TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP),
--     UPDATED_AT      TIMESTAMP DEFAULT SYS_EXTRACT_UTC(SYSTIMESTAMP),
--     IS_DELETED      NUMBER DEFAULT 0
-- );
