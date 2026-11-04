-- Resume Intelligence Platform SQL Schema (tracker-only, no pgvector)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resumes Table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Parsed Resumes Metadata
CREATE TABLE IF NOT EXISTS parsed_resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id UUID UNIQUE REFERENCES resumes(id) ON DELETE CASCADE,
    contact_info JSONB,
    summary TEXT,
    skills JSONB,
    experience JSONB,
    education JSONB,
    certifications JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Descriptions
CREATE TABLE IF NOT EXISTS job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(150) NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    raw_text TEXT NOT NULL,
    extracted_keywords JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resume Comparison Analyses
CREATE TABLE IF NOT EXISTS resume_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_descriptions(id) ON DELETE CASCADE,
    overall_match_score NUMERIC(5, 2) NOT NULL,
    keyword_score NUMERIC(5, 2) NOT NULL,
    semantic_score NUMERIC(5, 2) NOT NULL,
    experience_score NUMERIC(5, 2) NOT NULL,
    matched_skills JSONB,
    missing_skills JSONB,
    ats_formatting_issues JSONB,
    improvement_suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Application Tracker Table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
    job_id UUID REFERENCES job_descriptions(id) ON DELETE SET NULL,
    company_name VARCHAR(150) NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    job_url VARCHAR(500),
    salary_range VARCHAR(100),
    location VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'SAVED',
    applied_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Interview Stages Table
CREATE TABLE IF NOT EXISTS interview_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    interviewer_info VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'SCHEDULED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);