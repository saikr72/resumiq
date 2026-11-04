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

# Skills that are also everyday words need case-sensitive rules of their own.
AMBIGUOUS_SKILL_PATTERNS = {
    "Go": re.compile(r'\bGo(?![\w-]|\s+to\b)|\b[Gg]olang\b'),
    "R": re.compile(r'(?<![\w&])R(?![\w&])'),
}

def _matches_skill(skill: str, text: str) -> bool:
    ambiguous = AMBIGUOUS_SKILL_PATTERNS.get(skill)
    if ambiguous:
        return ambiguous.search(text) is not None

    # \b cannot follow a symbol, so it would never match C++ or C#.
    # A name ending in a symbol may be followed by anything but another symbol (C++17).
    after = r'(?![+#])' if not skill[-1].isalnum() else r'(?![\w+#])'
    pattern = r'(?<![\w+#])' + re.escape(skill) + after
    return re.search(pattern, text, re.IGNORECASE) is not None

def extract_skills(text: str) -> Dict[str, List[str]]:
    """Extract recognized skills from text based on skill taxonomy."""
    extracted = {}

    for category, skill_list in COMMON_SKILLS.items():
        extracted[category] = [skill for skill in skill_list if _matches_skill(skill, text)]

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
