-- Adds email verification and password reset to existing databases.
-- Safe to run more than once. Works with both schema.sql and schema_tracker.sql.
-- Requires 001_add_auth.sql.
--
-- Accounts linked to Google count as verified. Existing password accounts must
-- verify their email the next time they sign in.
--
-- Run with: psql "$DATABASE_URL" -f database/migrations/002_add_email_verification.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

UPDATE users
SET email_verified_at = CURRENT_TIMESTAMP
WHERE google_id IS NOT NULL AND email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_user_purpose ON email_tokens(user_id, purpose);

COMMIT;
