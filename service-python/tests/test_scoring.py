import unittest
from datetime import date
from unittest import mock

from app.nlp import scoring
from app.nlp.experience import experience_score, required_years, resume_years
from app.nlp.scoring import overall_score, relevant_experience_score, score_match
from app.nlp.semantic import semantic_score, split_into_chunks
import fixtures

TODAY = date(2026, 1, 15)


class RequiredYears(unittest.TestCase):
    def test_reads_common_wordings(self):
        for text, years in [
            ("5+ years of experience with Python", 5),
            ("At least 3 years of hospital experience", 3),
            ("Minimum 7 yrs experience", 7),
            ("3-5 years of relevant experience", 3),
            ("3 to 5 years experience", 3),
            ("Five years of experience in sales", 5),
            ("Experience: 4 years", 4),
        ]:
            self.assertEqual(required_years(text), years, text)

    def test_uses_the_highest_requirement(self):
        self.assertEqual(required_years("5+ years of experience in Java. 2 years experience with AWS."), 5)

    def test_ignores_years_unrelated_to_experience(self):
        for text in ["We have been in business for 20 years.", "Includes a 2 year warranty.", "Join our team in 2026."]:
            self.assertIsNone(required_years(text), text)

    def test_none_when_no_requirement(self):
        self.assertIsNone(required_years(fixtures.FRONTEND_JOB))


class ResumeYears(unittest.TestCase):
    def test_totals_jobs_and_skips_education(self):
        # June 2015 to Jan 2026, because the two jobs run back to back. Education is not counted.
        self.assertEqual(resume_years(fixtures.BACKEND_RESUME, TODAY), 10.7)

    def test_counts_overlapping_jobs_once(self):
        text = "Engineer, A, Jan 2020 - Dec 2021\nConsultant, B, Jan 2021 - Dec 2021"
        self.assertEqual(resume_years(text, TODAY), 2.0)

    def test_counts_gaps_as_time_not_worked(self):
        text = "Engineer, A, Jan 2015 - Dec 2015\nEngineer, B, Jan 2020 - Dec 2020"
        self.assertEqual(resume_years(text, TODAY), 2.0)

    def test_reads_date_formats(self):
        for text, years in [
            ("Engineer 2018 - 2024", 6.0),
            ("Engineer 01/2020 - 12/2021", 2.0),
            ("Engineer March 2024 – Present", 1.9),
            ("Engineer Jan. 2024 to current", 2.1),
        ]:
            self.assertEqual(resume_years(text, TODAY), years, text)

    def test_skips_education_lines_outside_a_section(self):
        self.assertIsNone(resume_years("B.Tech, Example University, 2011 - 2015", TODAY))

    def test_work_section_after_education_counts(self):
        text = "EDUCATION\nSome Course 2010 - 2014\nWORK EXPERIENCE\nEngineer 2020 - 2022"
        self.assertEqual(resume_years(text, TODAY), 2.0)

    def test_future_end_dates_stop_at_today(self):
        self.assertEqual(resume_years("Engineer Jan 2025 - Dec 2030", TODAY), 1.1)

    def test_stated_years_win_when_higher(self):
        text = "Engineer with 12 years of experience.\nEngineer, A, Jan 2022 - Dec 2023"
        self.assertEqual(resume_years(text, TODAY), 12.0)

    def test_none_when_resume_shows_no_dates(self):
        self.assertIsNone(resume_years("Engineer who likes building things", TODAY))


class ExperienceScore(unittest.TestCase):
    def test_full_score_when_met_and_no_overqualified_penalty(self):
        result = experience_score(fixtures.BACKEND_RESUME, fixtures.BACKEND_JOB, TODAY)
        self.assertEqual(result, {"score": 100.0, "required_years": 5, "resume_years": 10.7})

    def test_partial_score_when_short(self):
        result = experience_score("Engineer, 2022 - 2024", "8+ years of experience", TODAY)
        self.assertEqual(result["score"], 25.0)

    def test_unknown_is_none_rather_than_zero(self):
        self.assertIsNone(experience_score("No dates here", "5 years of experience", TODAY)["score"])
        self.assertIsNone(experience_score("Engineer 2020 - 2022", "No requirement here", TODAY)["score"])


class OverallScore(unittest.TestCase):
    def test_uses_planned_weights(self):
        self.assertEqual(overall_score(100, 50, 0), 57.5)

    def test_missing_scores_do_not_count_against_the_resume(self):
        self.assertEqual(overall_score(None, 80, None), 80.0)
        self.assertEqual(overall_score(80, 80, None), 80.0)

    def test_nothing_available_is_zero(self):
        self.assertEqual(overall_score(None, None, None), 0.0)


class RelevantExperience(unittest.TestCase):
    def test_counts_in_full_when_the_work_is_relevant(self):
        self.assertEqual(relevant_experience_score(100, 50), 100)
        self.assertEqual(relevant_experience_score(100, 90), 100)

    def test_discounts_unrelated_work(self):
        self.assertEqual(relevant_experience_score(100, 10), 20)

    def test_missing_values_stay_as_they_are(self):
        self.assertIsNone(relevant_experience_score(None, 50))
        self.assertEqual(relevant_experience_score(100, None), 100)


class ScoreMatch(unittest.TestCase):
    def test_wrong_field_scores_below_right_field_despite_enough_years(self):
        wrong = score_match(fixtures.BACKEND_RESUME, fixtures.NURSE_JOB, 0, False)
        right = score_match(fixtures.NURSE_RESUME, fixtures.NURSE_JOB, 0, False)
        self.assertLess(wrong["overall"], 50)
        self.assertGreater(right["overall"], 75)

    @mock.patch.object(scoring, "semantic_score", return_value=60.0)
    def test_keyword_is_none_when_job_has_no_recognized_skills(self, _):
        result = score_match(fixtures.NURSE_RESUME, fixtures.NURSE_JOB, 0, False)
        self.assertIsNone(result["keyword"])
        self.assertGreater(result["overall"], 0)

    @mock.patch.object(scoring, "semantic_score", side_effect=RuntimeError("private resume text"))
    def test_semantic_failure_keeps_other_scores_and_hides_details(self, _):
        with self.assertLogs("app.nlp.scoring", level="ERROR") as logs:
            result = score_match(fixtures.BACKEND_RESUME, fixtures.BACKEND_JOB, 50, True)
        self.assertIsNone(result["semantic"])
        self.assertEqual(result["keyword"], 50)
        self.assertNotIn("private resume text", " ".join(logs.output))


class SplitIntoChunks(unittest.TestCase):
    def test_removes_bullets_and_short_fragments(self):
        self.assertEqual(split_into_chunks("- Built many large APIs\nSKILLS\nJohn Smith", 10), ["Built many large APIs"])

    def test_applies_limit(self):
        self.assertEqual(len(split_into_chunks("\n".join(["four words per line"] * 5), 3)), 3)


class SemanticScore(unittest.TestCase):
    """Uses the real model, and checks ordering rather than exact values."""

    def test_good_matches_beat_wrong_field_matches(self):
        good = [
            semantic_score(fixtures.BACKEND_RESUME, fixtures.BACKEND_JOB),
            semantic_score(fixtures.NURSE_RESUME, fixtures.NURSE_JOB),
            semantic_score(fixtures.MARKETING_RESUME, fixtures.MARKETING_JOB),
        ]
        wrong = [
            semantic_score(fixtures.NURSE_RESUME, fixtures.BACKEND_JOB),
            semantic_score(fixtures.BACKEND_RESUME, fixtures.NURSE_JOB),
            semantic_score(fixtures.MARKETING_RESUME, fixtures.NURSE_JOB),
        ]
        self.assertGreater(min(good), max(wrong))

    def test_recognizes_the_same_work_in_different_words(self):
        paraphrased = semantic_score(fixtures.BACKEND_RESUME, fixtures.BACKEND_JOB_PARAPHRASED)
        self.assertGreater(paraphrased, semantic_score(fixtures.NURSE_RESUME, fixtures.BACKEND_JOB_PARAPHRASED))

    def test_too_little_text_is_none(self):
        self.assertIsNone(semantic_score("Python", fixtures.BACKEND_JOB))
        self.assertIsNone(semantic_score(fixtures.BACKEND_RESUME, "Engineer"))


if __name__ == "__main__":
    unittest.main()
