-- ============================================================
-- 06_google_oauth.sql
-- Adds Google OAuth support to the USERS table.
-- Run this script once against your Oracle database.
-- ============================================================

-- 1. Add GOOGLE_ID column (unique – one Google account per user)
ALTER TABLE USERS ADD GOOGLE_ID VARCHAR2(255);
ALTER TABLE USERS ADD CONSTRAINT UQ_USERS_GOOGLE_ID UNIQUE (GOOGLE_ID);

-- 2. Add Google avatar / profile picture URL
ALTER TABLE USERS ADD GOOGLE_AVATAR_URL VARCHAR2(500);

-- 3. Make PASSWORD_HASH nullable so Google-only users don't need a password
ALTER TABLE USERS MODIFY PASSWORD_HASH VARCHAR2(255) NULL;

-- 4. (Optional) index for fast look-up by GOOGLE_ID
CREATE INDEX IDX_USERS_GOOGLE_ID ON USERS (GOOGLE_ID);
