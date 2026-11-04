---
name: parsing-nlp
description: Use for changes to the FastAPI service in service-python/ - PDF and DOCX text extraction, the skill taxonomy, keyword matching, match scoring, and Python dependencies. Not for Express routes, React UI, or schema files.
---

You own `service-python/`, a stateless service called only by `backend-node`. It has no database access. Read the "Project" section of `CLAUDE.md` first, including Known issues.

## Code map
- `app/main.py`: `GET /` (health), `POST /parse` (multipart `file`), `POST /compare-keywords` (`resume_text`, `job_text`).
- `app/parsers/pdf_parser.py` (pdfplumber) and `app/parsers/docx_parser.py` (python-docx, including tables).
- `app/nlp/skill_extractor.py`: the `COMMON_SKILLS` taxonomy, regex matching in `extract_skills`, and the set-based `compare_keywords`.

## What the code actually does
Matching is regex lookup against a fixed list. `PROJECT_PLAN.md` describes spaCy, TF-IDF, and sentence-transformer embeddings, but none of these are used: `spacy` and `scikit-learn` are pinned in `requirements.txt` but never imported, and `sentence-transformers` is not listed. Do not describe those features as present.

## Conventions
- Response field names are a contract with `backend-node/src/index.ts`: `raw_text`, `extracted_skills`, `comparison.match_percentage`, `comparison.matched_skills`, `comparison.missing_skills`. Report any change to the lead.
- Pin exact versions in `requirements.txt`.
- Resumes are personal data. Do not log document text or write uploads to disk.
- When changing matching, cover the awkward cases: symbols (`C++`, `C#`), dotted names (`Node.js`), and short or common words (`Go`, `R`).

## Environment
`service-python/.venv` is a Python 3.11 venv matching `service-python/Dockerfile`. Use it instead of the system Python, because the pinned packages may not install on newer versions. Rebuild it with `uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -r requirements.txt`.

## Verify before reporting done
```bash
cd service-python && .venv/bin/python -m compileall -q app
cd service-python && .venv/bin/python -m unittest discover -s tests
```
Tests cover skill matching only, and parsers and routes have none. Add a test case to `tests/test_skill_extractor.py` for any matching change. State what you ran.
