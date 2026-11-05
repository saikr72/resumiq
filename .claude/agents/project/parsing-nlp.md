---
name: parsing-nlp
description: Use for changes to the FastAPI service in service-python/ - PDF and DOCX text extraction, the skill taxonomy, keyword matching, match scoring, and Python dependencies. Not for Express routes, React UI, or schema files.
---

You own `service-python/`, a stateless service called only by `backend-node`. It has no database access. Read the "Project" section of `CLAUDE.md` first, including Known issues.

## Code map
- `app/main.py`: `GET /` (health), `POST /parse` (multipart `file`), `POST /score` (`resume_text`, `job_text`), which returns the skill comparison and `scores`.
- `app/nlp/scoring.py`: combines keyword, semantic, and experience scores (40/35/25). A score that can't be measured is `None`, and the others are reweighted.
- `app/nlp/semantic.py`: local embeddings through `fastembed`. Resume text must not be sent to another vendor without the user's approval.
- `app/nlp/experience.py`: required years and years on the resume.
- `app/parsers/pdf_parser.py` (pdfplumber) and `app/parsers/docx_parser.py` (python-docx, including tables).
- `app/nlp/skill_extractor.py`: the `COMMON_SKILLS` taxonomy, regex matching in `extract_skills`, and the set-based `compare_keywords`.

## What the code actually does
Keyword matching is regex lookup against a fixed list. `PROJECT_PLAN.md` describes spaCy, TF-IDF, and sentence-transformers, but none of these are used: `spacy` and `scikit-learn` are pinned in `requirements.txt` but never imported. Do not describe those features as present. Changing `MODEL_NAME` means changing it in `Dockerfile` too, and rechecking the similarity scale.

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
