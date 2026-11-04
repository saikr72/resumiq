import unittest

from app.nlp.skill_extractor import compare_keywords, extract_skills


def found(text):
    return {skill for skills in extract_skills(text).values() for skill in skills}


class SymbolSkills(unittest.TestCase):
    def test_detects_names_ending_in_symbols(self):
        for text, skill in [
            ("Used C++ daily", "C++"),
            ("C++, Python", "C++"),
            ("Modern C++17 code", "C++"),
            ("Wrote C# services", "C#"),
            ("(C#)", "C#"),
        ]:
            with self.subTest(text=text):
                self.assertIn(skill, found(text))

    def test_detects_names_containing_symbols(self):
        self.assertIn("Node.js", found("Built with Node.js."))
        self.assertIn("CI/CD", found("Owned CI/CD pipelines"))


class WordBoundaries(unittest.TestCase):
    def test_does_not_match_inside_longer_names(self):
        self.assertNotIn("Java", found("JavaScript only"))
        self.assertNotIn("SQL", found("MySQL only"))
        self.assertNotIn("Git", found("Legitimate digital work"))

    def test_ignores_case_for_ordinary_skills(self):
        self.assertIn("Python", found("python scripting"))
        self.assertIn("C++", found("c++ scripting"))


class AmbiguousSkills(unittest.TestCase):
    def test_go_ignores_ordinary_english(self):
        for text in ["We go to market fast", "Go to the office", "A go-to person", "Go-to engineer", "Google"]:
            with self.subTest(text=text):
                self.assertNotIn("Go", found(text))

    def test_go_detects_the_language(self):
        for text in ["Skills: Go, Python", "Wrote services in Go.", "Golang developer", "golang"]:
            with self.subTest(text=text):
                self.assertIn("Go", found(text))

    def test_r_ignores_ordinary_text(self):
        for text in ["Led the R&D team", "our r package", "Ready to start"]:
            with self.subTest(text=text):
                self.assertNotIn("R", found(text))

    def test_r_detects_the_language(self):
        for text in ["Skills: R, Python", "Statistics in R.", "R programming"]:
            with self.subTest(text=text):
                self.assertIn("R", found(text))


class MatchScore(unittest.TestCase):
    def test_symbol_skills_count_toward_the_score(self):
        job = "Requires Python, Kubernetes, Docker, AWS, PostgreSQL, C++ and strong Communication."
        resume = "Python, React, Docker, PostgreSQL, Git, Leadership"

        job_skills = found(job)
        comparison = compare_keywords(list(found(resume)), list(job_skills))

        self.assertEqual(len(job_skills), 7)
        self.assertIn("c++", comparison["missing_skills"])
        self.assertEqual(comparison["match_percentage"], 42.86)


if __name__ == "__main__":
    unittest.main()
