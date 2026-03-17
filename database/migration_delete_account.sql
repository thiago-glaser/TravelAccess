-- Migration to add deletion token columns to USERS table
ALTER TABLE USERS ADD (
    DELETION_TOKEN VARCHAR2(128),
    DELETION_EXPIRES TIMESTAMP
);
