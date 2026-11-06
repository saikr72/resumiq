from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import hmac
import os
import threading

from app.parsers.pdf_parser import extract_text_from_pdf
from app.parsers.docx_parser import extract_text_from_docx
from app.nlp.scoring import score_match
from app.nlp.semantic import preload_model
from app.nlp.skill_extractor import extract_skills, compare_keywords

app = FastAPI(title="Resume Intelligence NLP & Parsing Microservice", version="1.0.0")

# Set SERVICE_SECRET whenever this service has a public address. Only the health check stays open.
@app.middleware("http")
async def require_service_secret(request: Request, call_next):
    secret = os.environ.get("SERVICE_SECRET")
    if secret and request.url.path != "/":
        sent = request.headers.get("x-service-secret", "")
        if not hmac.compare_digest(sent.encode(), secret.encode()):
            return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)

@app.on_event("startup")
def load_model_in_background():
    # Loaded early so the first analysis doesn't wait, without delaying startup
    threading.Thread(target=preload_model, daemon=True).start()

class ScoreRequest(BaseModel):
    resume_text: str
    job_text: str

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Resume Intelligence Python Parsing & NLP Engine"}

@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    filename = file.filename.lower()
    content = await file.read()

    if filename.endswith(".pdf"):
        extract_text = extract_text_from_pdf
    elif filename.endswith(".docx"):
        extract_text = extract_text_from_docx
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF or DOCX.")

    try:
        raw_text = extract_text(content)
    except Exception:
        raise HTTPException(status_code=422, detail="We could not read this file. It may be damaged or password protected.")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="We could not find any text in this file. Scanned documents are not supported yet.")

    skills = extract_skills(raw_text)

    return {
        "filename": file.filename,
        "character_count": len(raw_text),
        "raw_text": raw_text,
        "extracted_skills": skills
    }

@app.post("/score")
def score_endpoint(payload: ScoreRequest):
    resume_skills_dict = extract_skills(payload.resume_text)
    job_skills_dict = extract_skills(payload.job_text)

    all_resume_skills = [skill for cat in resume_skills_dict.values() for skill in cat]
    all_job_skills = [skill for cat in job_skills_dict.values() for skill in cat]

    comparison = compare_keywords(all_resume_skills, all_job_skills)
    scores = score_match(payload.resume_text, payload.job_text, comparison["match_percentage"], bool(all_job_skills))

    return {
        "resume_skills": resume_skills_dict,
        "job_skills": job_skills_dict,
        "comparison": comparison,
        "scores": scores
    }
