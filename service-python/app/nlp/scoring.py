"""Combines the keyword, semantic, and experience scores into one match score."""
import logging
from typing import Dict, Optional

from app.nlp.experience import experience_score
from app.nlp.semantic import semantic_score

logger = logging.getLogger(__name__)

WEIGHTS = {"keyword": 0.40, "semantic": 0.35, "experience": 0.25}

# Years count in full once the semantic score reaches this level
RELEVANCE_FULL_AT = 50


def overall_score(keyword: Optional[float], semantic: Optional[float], experience: Optional[float]) -> float:
    """Weighted average of the available scores. A missing score doesn't count against the resume."""
    parts = {"keyword": keyword, "semantic": semantic, "experience": experience}
    available = {name: value for name, value in parts.items() if value is not None}
    if not available:
        return 0.0
    total_weight = sum(WEIGHTS[name] for name in available)
    return round(sum(WEIGHTS[name] * value for name, value in available.items()) / total_weight, 2)


def relevant_experience_score(experience: Optional[float], semantic: Optional[float]) -> Optional[float]:
    """Discounts years spent on unrelated work, so 10 years of coding doesn't qualify someone as a nurse."""
    if experience is None or semantic is None:
        return experience
    return round(experience * min(semantic / RELEVANCE_FULL_AT, 1.0), 2)


def score_match(resume_text: str, job_text: str, keyword_percentage: float, job_has_skills: bool) -> Dict:
    # The skill list is mostly technical, so many jobs contain no skills it recognizes
    keyword = keyword_percentage if job_has_skills else None

    try:
        semantic = semantic_score(resume_text, job_text)
    except Exception as error:
        # Never log the error text itself, which could include resume content
        logger.error("Semantic scoring failed: %s", type(error).__name__)
        semantic = None

    experience = experience_score(resume_text, job_text)
    relevant_experience = relevant_experience_score(experience["score"], semantic)

    return {
        "overall": overall_score(keyword, semantic, relevant_experience),
        "keyword": keyword,
        "semantic": semantic,
        "experience": relevant_experience,
        "required_years": experience["required_years"],
        "resume_years": experience["resume_years"],
    }
