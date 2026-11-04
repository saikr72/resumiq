import React from 'react';
import { AnalysisResult } from '../types';

function Chips({ items, tone }: { items: string[]; tone?: 'good' | 'gap' | 'warn' }) {
  return (
    <div className="chip-list">
      {items.map((item) => (
        <span key={item} className={`chip ${tone ?? ''}`}>{item}</span>
      ))}
    </div>
  );
}

export default function AnalysisOutput({ result }: { result: AnalysisResult }) {
  const { comparison, aiSuggestions, parsedSkills } = result;
  const detected = Object.values(parsedSkills ?? {}).flat();

  return (
    <div className="output-box" aria-live="polite">
      {comparison ? (
        <>
          <h3>Keyword match: {comparison.match_percentage}%</h3>
          {comparison.matched_skills.length > 0 && (
            <>
              <h3>Matched skills</h3>
              <Chips items={comparison.matched_skills} tone="good" />
            </>
          )}
          {comparison.missing_skills.length > 0 && (
            <>
              <h3>Missing skills</h3>
              <Chips items={comparison.missing_skills} tone="gap" />
            </>
          )}
        </>
      ) : (
        <>
          <h3>Skills detected in your resume</h3>
          {detected.length > 0 ? <Chips items={detected} /> : <p>We didn't recognise any skills from our list.</p>}
          <p>Add a job description to see how well this resume matches a role.</p>
        </>
      )}

      {aiSuggestions?.error && (
        <div className="notice" role="alert" style={{ marginTop: 14, marginBottom: 0 }}>
          <span>AI suggestions couldn't be generated for this analysis. The keyword match above is still valid. Please try again later.</span>
        </div>
      )}

      {aiSuggestions && !aiSuggestions.error && (
        <>
          <h3>✦ AI suggestions</h3>
          {aiSuggestions.summary && <p>{aiSuggestions.summary}</p>}
          {!!aiSuggestions.critical_missing_skills?.length && (
            <>
              <h3>Critical missing skills</h3>
              <Chips items={aiSuggestions.critical_missing_skills} tone="warn" />
            </>
          )}
          {!!aiSuggestions.actionable_suggestions?.length && (
            <>
              <h3>What to improve</h3>
              <ul className="suggestion-list">
                {aiSuggestions.actionable_suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </>
          )}
          {!!aiSuggestions.optimized_bullet_points?.length && (
            <>
              <h3>Rewritten bullet points</h3>
              {aiSuggestions.optimized_bullet_points.map((bullet, index) => (
                <div key={index} className="bullet-compare">
                  <small>ORIGINAL</small>
                  <p className="before">{bullet.original}</p>
                  <small>REWRITTEN</small>
                  <p className="after">{bullet.optimized}</p>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
