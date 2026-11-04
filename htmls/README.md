# resumIQ — Resume Intelligence Platform

A responsive, futuristic SaaS frontend concept for job seekers.

## Run locally

No build step or package installation is required.

1. Extract the ZIP file.
2. Open `index.html` in a modern browser.

For a local development server, run:

```bash
cd resume-intelligence-frontend
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Files

```text
resume-intelligence-frontend/
├── index.html
├── assets/
│   ├── styles.css
│   └── app.js
└── README.md
```

## Included screens

- Overview dashboard
- Resume Builder
- AI Resume Analysis upload interface
- Job Matching form
- Resume Library
- Career Insights
- Application Tracker

## Current prototype behaviour

- Responsive sidebar navigation and mobile menu
- Dashboard navigation and URL hash routing
- Resume draft brief capture
- Local PDF/DOC/DOCX file selection and size/type validation
- Job description capture
- Add application interaction
- Workspace search across visible resume and job rows
- Toast notifications

## Important implementation boundary

This is a frontend prototype. It does not currently upload documents to a server, parse PDF/DOCX contents, generate resumes with an LLM, calculate real ATS scores, perform semantic job matching, authenticate users, persist data, or export finished resumes.

Those capabilities require backend services and secure API integration. The scores and sample records in the dashboard are illustrative demo content and must not be represented as real assessments.

## Suggested production integration

- React + TypeScript if the product grows into a component-driven SPA
- Laravel API for identity, users, resume records, application tracking and billing
- Python FastAPI service for document parsing, NLP and AI analysis
- PostgreSQL for application data; object storage for uploaded documents
- Redis for queues and caching
- Authentication, consent, retention and deletion controls before handling real resumes
