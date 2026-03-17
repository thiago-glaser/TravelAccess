ALTER TABLE USERS ADD (
    VERIFICATION_TOKEN VARCHAR2(128),
    IS_VERIFIED NUMBER DEFAULT 0
);

-- For existing users, we might want to mark them as verified if we already have them
-- UPDATE USERS SET IS_VERIFIED = 1 WHERE IS_VERIFIED IS NULL;
