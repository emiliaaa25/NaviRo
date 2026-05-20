-- Migration: add student_type and faculty/university profile fields
-- Run once against the NaviRo PostgreSQL database

ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS student_type       VARCHAR(20)  DEFAULT '',   -- 'erasmus' | 'international'
    ADD COLUMN IF NOT EXISTS target_university  VARCHAR(20)  DEFAULT '',   -- 'UAIC' | 'UMF' | 'TUIASI' | 'UAGE'
    ADD COLUMN IF NOT EXISTS target_faculty     TEXT         DEFAULT '',   -- human-readable faculty name
    ADD COLUMN IF NOT EXISTS target_faculty_id  VARCHAR(60)  DEFAULT '',   -- slug id from faculties.js
    ADD COLUMN IF NOT EXISTS home_university    TEXT         DEFAULT '',   -- Erasmus: home institution name
    ADD COLUMN IF NOT EXISTS home_faculty       TEXT         DEFAULT '';   -- Erasmus: faculty at home institution

-- academic_year already exists; if not, add it:
ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS academic_year      VARCHAR(20)  DEFAULT '';

-- Optional: add an index for quick student_type queries
CREATE INDEX IF NOT EXISTS idx_student_profiles_student_type
    ON student_profiles (student_type);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'student_profiles'
ORDER BY ordinal_position;
