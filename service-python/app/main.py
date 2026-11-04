from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os

from app.parsers.pdf_parser import extract_text_from_pdf
from app.parsers.docx_parser import extract_text_from_docx
from app.nlp.skill_extractor import extract_skills, compare_keywords

app = FastAPI(title="Resume Intelligence NLP & Parsing Microservice", version="1.0.0")

class KeywordCompareRequest(BaseModel):
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
        raw_text = extract_text_from_pdf(content)
    elif filename.endswith(".docx") or filename.endswith(".doc"):
        raw_text = extract_text_from_docx(content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF or DOCX.")

    skills = extract_skills(raw_text)

    return {
        "filename": file.filename,
        "character_count": len(raw_text),
        "raw_text": raw_text,
        "extracted_skills": skills
    }

@app.post("/compare-keywords")
def compare_keywords_endpoint(payload: KeywordCompareRequest):
    resume_skills_dict = extract_skills(payload.resume_text)
    job_skills_dict = extract_skills(payload.job_text)

    all_resume_skills = [skill for cat in resume_skills_dict.values() for skill in cat]
    all_job_skills = [skill for cat in job_skills_dict.values() for skill in cat]

    comparison = compare_keywords(all_resume_skills, all_job_skills)

    return {
        "resume_skills": resume_skills_dict,
        "job_skills": job_skills_dict,
        "comparison": comparison
    }
