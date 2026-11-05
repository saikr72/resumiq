import React from 'react';
import { MatchScores } from '../types';

function ScoreRow({ label, score, note }: { label: string; score: number | null; note: string }) {
  return (
    <div className="metric">
      <div><span>{label}</span><b>{score === null ? 'Not available' : `${Math.round(score)}%`}</b></div>
      <div className="progress-track"><span style={{ width: `${score ?? 0}%` }} /></div>
      <p className="score-note">{note}</p>
    </div>
  );
}

function experienceNote({ experience, required_years: required, resume_years: actual }: Omit<MatchScores, 'overall'>): string {
  if (required === null) return "This job doesn't state the years of experience it needs.";
  if (actual === null) return `This job asks for ${required}+ years, but we couldn't find work dates in your resume.`;
  const summary = `Your resume shows about ${actual} years, and this job asks for ${required}+.`;
  return actual >= required && experience !== null && experience < 100
    ? `${summary} Years count for less when the work looks different from this job.`
    : summary;
}

export default function ScoreBreakdown({ scores }: { scores: Omit<MatchScores, 'overall'> }) {
  return (
    <div className="metric-list">
      <ScoreRow
        label="Skill keywords"
        score={scores.keyword}
        note={scores.keyword === null ? "We didn't recognise specific skills in this job, so this doesn't affect your score." : 'Skills named in the job that also appear in your resume.'}
      />
      <ScoreRow
        label="Meaning match"
        score={scores.semantic}
        note={scores.semantic === null ? "We couldn't compare the meaning of these documents." : 'How closely your described work relates to the duties in this job, even in different words.'}
      />
      <ScoreRow label="Experience" score={scores.experience} note={experienceNote(scores)} />
    </div>
  );
}
