-- Allows scores that can't be measured to be empty rather than a misleading 0.
-- Existing rows aren't changed: scoring_version 1 marks them as keyword-only.
ALTER TABLE resume_analyses ALTER COLUMN keyword_score DROP NOT NULL;
ALTER TABLE resume_analyses ALTER COLUMN semantic_score DROP NOT NULL;
ALTER TABLE resume_analyses ALTER COLUMN experience_score DROP NOT NULL;
ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS required_years NUMERIC(4, 1);
ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS resume_years NUMERIC(4, 1);
ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS scoring_version SMALLINT NOT NULL DEFAULT 1;
