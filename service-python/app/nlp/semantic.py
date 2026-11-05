"""Measures how well a resume covers a job description's meaning, not just its keywords.

The embedding model runs inside this service, so resume text is never sent to another vendor.
"""
import logging
import re
import threading
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)

MODEL_NAME = "BAAI/bge-small-en-v1.5"

# Limits keep a very long document from tying up the CPU
MAX_REQUIREMENTS = 60
MAX_RESUME_CHUNKS = 200

# Average best-match similarity is mapped from this range onto 0-100. The limits were chosen by
# measuring sample resume and job pairs, so the result is an estimate and not a percentage of fit.
SIMILARITY_FLOOR = 0.50
SIMILARITY_CEILING = 0.80

MIN_WORDS = 4

_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    with _model_lock:
        if _model is None:
            from fastembed import TextEmbedding

            _model = TextEmbedding(model_name=MODEL_NAME)
    return _model


def preload_model() -> None:
    try:
        _get_model()
    except Exception as error:
        logger.error("Could not load the embedding model: %s", type(error).__name__)


def split_into_chunks(text: str, limit: int) -> List[str]:
    """Splits text into lines and sentences long enough to carry meaning."""
    chunks = []
    for line in text.splitlines():
        for sentence in re.split(r"(?<=[.!?;])\s+", line):
            sentence = re.sub(r"^[\s\-*•·▪◦–—]+", "", sentence).strip()
            if len(sentence.split()) >= MIN_WORDS:
                chunks.append(sentence)
    return chunks[:limit]


def raw_similarity(resume_text: str, job_text: str) -> Optional[float]:
    """Average similarity between each job requirement and its closest part of the resume."""
    requirements = split_into_chunks(job_text, MAX_REQUIREMENTS)
    resume_chunks = split_into_chunks(resume_text, MAX_RESUME_CHUNKS)
    if not requirements or not resume_chunks:
        return None

    model = _get_model()
    job_vectors = np.array(list(model.query_embed(requirements)))
    resume_vectors = np.array(list(model.passage_embed(resume_chunks)))
    job_vectors /= np.linalg.norm(job_vectors, axis=1, keepdims=True)
    resume_vectors /= np.linalg.norm(resume_vectors, axis=1, keepdims=True)

    best_matches = (job_vectors @ resume_vectors.T).max(axis=1)
    return float(best_matches.mean())


def semantic_score(resume_text: str, job_text: str) -> Optional[float]:
    """Returns a 0-100 score, or None when either text is too short to compare."""
    similarity = raw_similarity(resume_text, job_text)
    if similarity is None:
        return None
    scaled = (similarity - SIMILARITY_FLOOR) / (SIMILARITY_CEILING - SIMILARITY_FLOOR)
    return round(float(np.clip(scaled, 0, 1)) * 100, 2)
