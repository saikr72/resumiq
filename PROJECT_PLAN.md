# Resume Intelligence Platform — Architecture & Project Specification

## 1. Project Overview & Scope

The **Resume Intelligence Platform** is an AI-powered application designed to analyze resumes against targeted job descriptions, perform automated Applicant Tracking System (ATS) gap analysis, generate actionable tailored suggestions, and provide an application workflow tracker with interview progress management.

### Key Objectives
1. **Resume Processing**: Support seamless PDF and DOCX uploads with high-accuracy layout-aware text extraction.
2. **ATS Match & Gap Analysis**: Evaluate keyword matching, skill coverage (hard & soft skills), experience alignment, and semantic relevance using hybrid matching (deterministic NLP + LLM embeddings).
3. **AI-Powered ATS Optimizations**: Generate concrete, section-by-section resume improvement suggestions using Claude LLM.
4. **Application Tracker**: Kanban-style dashboard for managing job applications, interview stages, key dates, and notes.

---

## 2. System Architecture

```
                                +-------------------+
                                |   React Frontend  |
                                |  (Vite + TS + UI) |
                                +---------+---------+
                                          |
                                    HTTPS / REST
                                          |
                                +---------v---------+
                                |  Node.js API Hub  |
                                | (Express/TypeScript)|
                                +----+----+----+----+
                                     |    |    |
            +------------------------+    |    +-----------------------+
            |                             |                            |
    +-------v-------+             +-------v-------+            +-------v-------+
    | Python Service|             | PostgreSQL +  |            |   LLM API     |
    | (FastAPI NLP) |             |   pgvector    |            | (Claude/OpenAI|
    +---------------+             +---------------+            +---------------+
    - PDF/DOCX Parse               - User & Resumes             - Structured JSON
    - Spacy & Embeddings           - Job Descriptions           - Tailored Resume
    - Skill Extraction             - App Tracker Data             Bullet Rewrites
```

### Component Breakdown
- **Frontend (React)**: Built with React 18+, TypeScript, Vite, Tailwind CSS, Lucide React icons, and React Query for state management. Provides file drag-and-drop, interactive resume vs. job gap visualization, and Kanban board for applications.
- **Backend Core (Node.js / TypeScript)**: Express.js REST API handling authentication, user file storage management, application tracking CRUD, and orchestrating requests between Python parsing service and LLM API.
- **AI/Parsing Service (Python / FastAPI)**: Microservice dedicated to heavy parsing and text extraction using `pdfplumber`, `python-docx`, `spacy`, `scikit-learn` (TF-IDF keyword extraction), and `sentence-transformers` for vector embeddings.
- **Database (PostgreSQL with `pgvector`)**: Stores relational user data, parsed resume data, job postings, scoring history, and application tracking records. Vector extension enables semantic matching between resumes and job requirements.
- **LLM API (Anthropic Claude)**: Performs deep contextual analysis, missing keyword identification, bullet-point rewriting, and ATS format compliance scoring.

---

## 3. Database Schema (PostgreSQL)

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resumes Table
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL, -- 'pdf' or 'docx'
    raw_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Parsed Resume Metadata
CREATE TABLE parsed_resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id UUID UNIQUE REFERENCES resumes(id) ON DELETE CASCADE,
    contact_info JSONB, -- email, phone, linkedin, github
    summary TEXT,
    skills JSONB, -- { "hard_skills": [...], "soft_skills": [...], "tools": [...] }
    experience JSONB, -- list of role objects
    education JSONB, -- list of degree objects
    certifications JSONB,
    embedding vector(1536), -- Vector embedding for semantic match
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Descriptions Table
CREATE TABLE job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(150) NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    raw_text TEXT NOT NULL,
    extracted_keywords JSONB, -- { "required": [...], "preferred": [...] }
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resume Comparison Analyses Table
CREATE TABLE resume_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_descriptions(id) ON DELETE CASCADE,
    overall_match_score NUMERIC(5, 2) NOT NULL, -- e.g. 84.50%
    keyword_score NUMERIC(5, 2) NOT NULL,
    semantic_score NUMERIC(5, 2) NOT NULL,
    experience_score NUMERIC(5, 2) NOT NULL,
    matched_skills JSONB, -- ["React", "TypeScript", "Node.js"]
    missing_skills JSONB, -- ["Docker", "Kubernetes", "GraphQL"]
    ats_formatting_issues JSONB, -- list of structural/formatting warnings
    improvement_suggestions JSONB, -- structured action items & rewritten bullets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Application Tracker Table
CREATE TABLE applications (
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
    -- Statuses: 'SAVED', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'REJECTED'
    applied_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Interview Stages Table
CREATE TABLE interview_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL, -- e.g. "Recruiter Screen", "System Design", "HM Round"
    scheduled_at TIMESTAMP WITH TIME ZONE,
    interviewer_info VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'COMPLETED', 'PASSED', 'FAILED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Endpoints Contract

### Auth & User Routes
- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - Authenticate & obtain JWT

### Resume Management
- `POST /api/resumes/upload` - Upload PDF/DOCX file, trigger Python parsing worker
- `GET /api/resumes` - List all user resumes
- `GET /api/resumes/:id` - Fetch detailed resume content and parsed sections
- `DELETE /api/resumes/:id` - Delete resume

### Analysis & Comparison
- `POST /api/analysis/compare` - Compare specific resume against a Job Description
  - Body: `{ resumeId: string, jobText?: string, jobId?: string }`
- `GET /api/analysis/:id` - Fetch analysis report with match score & ATS recommendations

### Application Tracker
- `GET /api/applications` - List applications (with filtering by status)
- `POST /api/applications` - Create new tracked application
- `PATCH /api/applications/:id` - Update status / column placement / notes
- `POST /api/applications/:id/interviews` - Add scheduled interview round

---

## 5. Core Engine & Algorithm Workflows

### A. Document Parsing Pipeline (Python FastAPI)
1. **File Ingestion**: Accepts `.pdf` or `.docx`.
2. **Text & Structure Extraction**:
   - PDF: Uses `pdfplumber` to preserve visual positioning, detect tabular structures, and separate header/contact blocks from work experience.
   - DOCX: Uses `python-docx` to extract structured paragraphs, bullet points, and headers.
3. **Entity & Skill Recognition**:
   - Uses `spacy` with custom NER patterns for extracting technical skills, education degrees, job titles, and date ranges.

### B. ATS Comparison & Match Engine
The match score is calculated using a weighted multi-factor scoring model:

$$\text{Overall Score} = (0.40 \times \text{Keyword Match}) + (0.35 \times \text{Semantic Match}) + (0.25 \times \text{Experience Alignment})$$

1. **Exact & Fuzzy Keyword Match (40%)**:
   - Extract hard & soft skills from JD using NLP.
   - Cross-reference with resume skills using string normalization and term mapping (e.g., "React.js" = "React").
2. **Semantic Similarity Vector Search (35%)**:
   - Generate embeddings for resume summary/experience and job responsibilities.
   - Compute cosine similarity via `pgvector` or Sentence Transformers.
3. **Experience & Seniority Alignment (25%)**:
   - Extract years of experience and compare against target JD requirements (e.g., "5+ years experience").

### C. LLM Improvement Generator (Anthropic Claude API)
Uses JSON-structured prompting to return actionable improvements:
- **Missing Keyword List**: Grouped by Critical, High, Medium priority.
- **Bullet Point Optimizer**: Rewrites original resume bullets to seamlessly incorporate missing keywords using the action-impact metric formula (`[Action Verb] + [Context/Task] + [Result/Metric]`).
- **ATS Format Validator**: Flags issues like multi-column tables, unsupported fonts, missing contact details, or non-standard section headers.

---

## 6. Directory Structure

```
resume-intelligence-platform/
├── docs/
│   └── architecture-spec.md
├── frontend/                     # React + Vite + TypeScript Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── analysis/        # Score Gauge, Gap Charts, Bullet Rewriter
│   │   │   ├── applications/    # Kanban Board, Interview Scheduler
│   │   │   ├── resumes/         # Resume Upload Dropzone, Viewer
│   │   │   └── ui/              # Buttons, Cards, Dialogs, Inputs
│   │   ├── pages/               # Dashboard, Analyze, Applications, Settings
│   │   ├── services/            # API client (Axios/Fetch), React Query hooks
│   │   └── types/               # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── backend-node/                 # API Gateway & Core Logic (Node.js/Express)
│   ├── src/
│   │   ├── controllers/         # Auth, Resume, Analysis, Applications
│   │   ├── middleware/          # Auth JWT, Multer file upload, Error handler
│   │   ├── models/              # Prisma / Drizzle / Database models
│   │   ├── services/            # Python microservice client, LLM service
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── service-python/               # NLP & Parsing Microservice (FastAPI)
│   ├── app/
│   │   ├── parsers/             # pdf_parser.py, docx_parser.py
│   │   ├── nlp/                 # skill_extractor.py, keyword_matcher.py
│   │   ├── models/              # Pydantic data schemas
│   │   └── main.py              # FastAPI application
│   ├── requirements.txt
│   └── Dockerfile
├── database/                     # Migrations & Schema Initialization
│   └── schema.sql
└── docker-compose.yml            # Local development orchestration
```

---

## 7. Development & Implementation Roadmap

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Foundation & Setup** | Project directory scaffold, PostgreSQL database setup with schema, API framework setup. |
| **Phase 2** | **Document Parsing Engine** | Python microservice for PDF & DOCX text/layout extraction, SpaCy NLP integration. |
| **Phase 3** | **ATS Comparison & LLM Integration** | Keyword & semantic matching logic, Claude API integration for suggestions and bullet rewrites. |
| **Phase 4** | **Frontend Development** | React interface for resume upload, visual match analysis dashboard, gap indicators. |
| **Phase 5** | **Application Tracker & Polish** | Drag-and-drop Kanban application tracker, interview stage scheduler, end-to-end testing. |

---

## 8. Next Steps & Execution Options

1. **Initialize Project Scaffolding**: Create the folders, configuration files, and `docker-compose.yml`.
2. **Build Microservices Core**: Implement `service-python` parser and `backend-node` API server.
3. **Build Frontend**: Develop the UI components for Resume Upload and Analysis Dashboard.
