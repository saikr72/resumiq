"""Compares the years of experience a job asks for with the years shown on a resume."""
import re
from datetime import date
from typing import Dict, List, Optional, Tuple

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
}
_NUMBER = r"\d{1,2}|" + "|".join(_WORD_NUMBERS)
_YEARS = re.compile(
    rf"(?<![\w.])(?P<low>{_NUMBER})\s*\+?\s*(?:(?:-|–|—|to)\s*(?:{_NUMBER})\s*\+?\s*)?(?:years?|yrs?)\b",
    re.IGNORECASE,
)

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_NAME = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"
_DATE = rf"(?:(?P<{{0}}name>{_MONTH_NAME})\s+|(?P<{{0}}num>\d{{{{1,2}}}})/)?(?P<{{0}}year>(?:19|20)\d{{{{2}}}})"
_DATE_RANGE = re.compile(
    r"(?<![\d/])"
    + _DATE.format("start").replace("{{", "{").replace("}}", "}")
    + r"\s*(?:-|–|—|to|until)\s*(?:"
    + _DATE.format("end").replace("{{", "{").replace("}}", "}")
    + r"|(?P<current>present|current|now|today))\b",
    re.IGNORECASE,
)

_NON_WORK_HEADING = re.compile(
    r"^\W*(education|academic|qualifications?|certifications?|courses?|training|projects?|volunteer\w*|awards?|publications?|references?)\b[\w\s&]{0,25}\W*$",
    re.IGNORECASE,
)
_WORK_HEADING = re.compile(
    r"^\W*((work|professional|employment|relevant)\s+)?(experience|history|employment|career)\b[\w\s&]{0,25}\W*$",
    re.IGNORECASE,
)
_NON_WORK_LINE = re.compile(
    r"\b(university|college|school|institute|bachelor|master|b\.?tech|m\.?tech|b\.?sc|m\.?sc|ph\.?d|degree|diploma|intern(ship)?)\b",
    re.IGNORECASE,
)


def _to_number(value: str) -> int:
    return int(value) if value.isdigit() else _WORD_NUMBERS[value.lower()]


def _years_near_experience(text: str) -> List[int]:
    """Finds year counts in sentences about experience, skipping ones like '20 years in business'."""
    found = []
    for sentence in re.split(r"(?<=[.!?;])\s+|\n", text):
        if not re.search(r"\b(experience|exp)\b", sentence, re.IGNORECASE):
            continue
        for match in _YEARS.finditer(sentence):
            years = _to_number(match.group("low"))
            if 0 < years <= 40:
                found.append(years)
    return found


def required_years(job_text: str) -> Optional[int]:
    """Returns the highest experience requirement in a job description, or None if it has none."""
    found = _years_near_experience(job_text)
    return max(found) if found else None


def _month_index(name: Optional[str], number: Optional[str], year: str) -> Tuple[int, bool]:
    month = None
    if name:
        month = _MONTHS[name[:3].lower()]
    elif number and 1 <= int(number) <= 12:
        month = int(number)
    return int(year) * 12 + (month or 1) - 1, month is not None


def _work_periods(resume_text: str, today: date) -> List[Tuple[int, int]]:
    now = today.year * 12 + today.month - 1
    periods = []
    in_non_work_section = False
    for line in resume_text.splitlines():
        if _NON_WORK_HEADING.match(line):
            in_non_work_section = True
            continue
        if _WORK_HEADING.match(line):
            in_non_work_section = False
            continue
        if in_non_work_section or _NON_WORK_LINE.search(line):
            continue
        for match in _DATE_RANGE.finditer(line):
            start, _ = _month_index(match.group("startname"), match.group("startnum"), match.group("startyear"))
            if match.group("current"):
                end = now + 1
            else:
                end, has_month = _month_index(match.group("endname"), match.group("endnum"), match.group("endyear"))
                # A named end month was worked, so it counts. A bare year is treated as its start.
                end += 1 if has_month else 0
            end = min(end, now + 1)
            if start < end:
                periods.append((start, end))
    return periods


def resume_years(resume_text: str, today: Optional[date] = None) -> Optional[float]:
    """Totals dated work history, counting overlapping jobs once.

    A stated figure such as '10 years of experience' wins when it is higher, because resumes often
    leave out older jobs. Returns None when the resume shows neither.
    """
    months = 0
    current_end = None
    for start, end in sorted(_work_periods(resume_text, today or date.today())):
        if current_end is None or start > current_end:
            months += end - start
            current_end = end
        elif end > current_end:
            months += end - current_end
            current_end = end
    dated = months / 12 if months else None

    stated = _years_near_experience(resume_text)
    candidates = ([dated] if dated else []) + ([float(max(stated))] if stated else [])
    return round(max(candidates), 1) if candidates else None


def experience_score(resume_text: str, job_text: str, today: Optional[date] = None) -> Dict:
    """Scores 100 when the requirement is met. The score is None if either figure is unknown."""
    required = required_years(job_text)
    actual = resume_years(resume_text, today)
    score = None
    if required is not None and actual is not None:
        score = round(min(actual / required, 1.0) * 100, 2)
    return {"score": score, "required_years": required, "resume_years": actual}
