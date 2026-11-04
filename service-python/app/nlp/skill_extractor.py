import re
from typing import List, Dict

# Pre-defined taxonomy of common technical and soft skills
COMMON_SKILLS = {
    "languages": ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "SQL", "HTML", "CSS", "R", "PHP"],
    "frameworks": ["React", "Node.js", "Express", "FastAPI", "Django", "Flask", "Angular", "Vue.js", "Next.js", "Spring Boot"],
    "databases": ["PostgreSQL", "MongoDB", "MySQL", "Redis", "Elasticsearch", "DynamoDB", "Cassandra"],
    "tools_cloud": ["Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "GitHub Actions", "CI/CD", "Terraform", "Linux"],
    "ai_ml": ["PyTorch", "TensorFlow", "Scikit-Learn", "NLP", "LLM", "OpenAI", "LangChain", "Computer Vision", "Pandas"],
    "soft_skills": ["Leadership", "Communication", "Problem Solving", "Agile", "Scrum", "Project Management", "Team Collaboration"]
}

def extract_skills(text: str) -> Dict[str, List[str]]:
    """Extract recognized skills from text based on skill taxonomy."""
    text_lower = text.lower()
    extracted = {}

    for category, skill_list in COMMON_SKILLS.items():
        found = []
        for skill in skill_list:
            # Use regex word boundaries for precision
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            if re.search(pattern, text_lower):
                found.append(skill)
        extracted[category] = found

    return extracted

def compare_keywords(resume_skills: List[str], job_skills: List[str]) -> Dict:
    """Compare skills extracted from resume against job requirements."""
    resume_set = set([s.lower() for s in resume_skills])
    job_set = set([s.lower() for s in job_skills])

    matched = list(resume_set.intersection(job_set))
    missing = list(job_set - resume_set)

    match_percentage = (len(matched) / len(job_set) * 100) if job_set else 100.0

    return {
        "match_percentage": round(match_percentage, 2),
        "matched_skills": matched,
        "missing_skills": missing
    }
