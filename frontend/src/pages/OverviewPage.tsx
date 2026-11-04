import React from 'react';
import { AuthUser } from '../api';
import { formatDate, matchesSearch, matchLabel, PageProps } from '../types';

const RING_CIRCUMFERENCE = 308;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function scoreCopy(score: number): { title: string; body: string } {
  if (score >= 75) {
    return { title: 'Strong keyword alignment.', body: 'Your resume covers most of the skills we found in this job description. Check that your experience shows real evidence for each one.' };
  }
  if (score >= 50) {
    return { title: 'Good foundation. Room to grow.', body: 'Your resume covers many of the skills in this job description. Where you have real experience with the missing ones, make it visible.' };
  }
  return { title: 'Significant gaps for this role.', body: 'Many skills in this job description are missing from your resume. Add the ones you genuinely have, or consider whether the role is the right fit.' };
}

export default function OverviewPage({ data, search, navigate, user }: PageProps & { user: AuthUser }) {
  const { resumes, analyses, applications } = data;
  const latest = analyses[0];
  const firstName = user.fullName?.trim().split(/\s+/)[0];
  const strongMatches = analyses.filter((analysis) => analysis.overall_match_score >= 75).length;
  const inProgress = applications.filter((app) => ['APPLIED', 'SCREENING', 'INTERVIEWING'].includes(app.status)).length;
  const score = latest ? Math.round(latest.overall_match_score) : 0;
  const copy = scoreCopy(score);
  const skillTotal = latest ? latest.matched_skills.length + latest.missing_skills.length : 0;
  const suggestions = latest?.improvement_suggestions;

  const visibleResumes = resumes.filter((resume) => matchesSearch(search, resume.title)).slice(0, 3);
  const visibleMatches = analyses.filter((analysis) => matchesSearch(search, analysis.job_title, analysis.resume_title)).slice(0, 3);

  return (
    <>
      <div className="page-heading heading-row">
        <div>
          <p className="overline">YOUR CAREER WORKSPACE</p>
          <h1>{greeting()}{firstName ? `, ${firstName}` : ''} <span className="sparkle">✦</span></h1>
          <p className="subheading">Here's your latest overview.</p>
        </div>
        <button className="button button-primary" onClick={() => navigate('analysis')}>＋ Analyse a resume</button>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top"><span>Latest match</span><span className="stat-icon purple">✧</span></div>
          <strong className="stat-value">{latest ? <>{score}<span>/100</span></> : '—'}</strong>
          <p className="neutral">{latest ? latest.job_title ?? 'Untitled role' : 'No analyses yet'}</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Job matches</span><span className="stat-icon cyan">⌕</span></div>
          <strong className="stat-value">{analyses.length}</strong>
          <p className={strongMatches ? 'positive' : 'neutral'}>{strongMatches ? `↗ ${strongMatches} strong` : 'No strong matches yet'}</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Applications</span><span className="stat-icon blue">▦</span></div>
          <strong className="stat-value">{applications.length}</strong>
          <p className="neutral">{inProgress} in progress</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Resumes</span><span className="stat-icon green">◈</span></div>
          <strong className="stat-value">{resumes.length}</strong>
          <p className="neutral">{resumes.length === 1 ? 'Document saved' : 'Documents saved'}</p>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="panel score-panel">
          <div className="panel-heading">
            <div><p className="overline">PERFORMANCE SNAPSHOT</p><h2>Latest keyword match</h2></div>
            <span className="status-pill">✦ KEYWORD MATCH</span>
          </div>
          {latest ? (
            <>
              <div className="score-overview">
                <div className="score-ring" role="img" aria-label={`Keyword match ${score} out of 100`}>
                  <svg viewBox="0 0 120 120">
                    <circle className="ring-track" cx="60" cy="60" r="49" />
                    <circle className="ring-value" cx="60" cy="60" r="49" style={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - score / 100) }} />
                  </svg>
                  <div className="ring-label"><strong>{score}</strong><span>OUT OF 100</span></div>
                </div>
                <div className="score-copy">
                  <h3>{copy.title}</h3>
                  <p>{copy.body}</p>
                  <button className="text-button" onClick={() => navigate('analysis')}>Analyse another resume <span>↗</span></button>
                </div>
              </div>
              <div className="metric-list">
                <div className="metric">
                  <div><span>{latest.resume_title}</span><b>{latest.matched_skills.length} of {skillTotal} skills</b></div>
                  <div className="progress-track"><span style={{ width: `${score}%` }} /></div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Compare a resume with a job description to see your match score here.
              <br />
              <button className="text-button" onClick={() => navigate('analysis')}>Analyse a resume <span>↗</span></button>
            </div>
          )}
        </article>

        <article className="panel intelligence-panel">
          <div className="panel-heading">
            <div><p className="overline">PERSONALISED FOR YOU</p><h2>AI career intelligence</h2></div>
            {suggestions && <span className="live-dot">LATEST ANALYSIS</span>}
          </div>
          {suggestions ? (
            <>
              <div className="insight-feature">
                <span className="insight-symbol">✦</span>
                <div><h3>{latest?.job_title ?? 'Your latest analysis'}</h3><p>{suggestions.summary}</p></div>
              </div>
              {suggestions.actionable_suggestions?.[0] && (
                <div className="recommendation"><span>RECOMMENDED ACTION</span><p>{suggestions.actionable_suggestions[0]}</p></div>
              )}
            </>
          ) : (
            <div className="empty-state" style={{ marginBottom: 14 }}>
              AI suggestions from your latest analysis will appear here.
            </div>
          )}
          <button className="button button-secondary" onClick={() => navigate('insights')}>Explore career insights <span>→</span></button>
        </article>
      </div>

      <div className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Recent resumes</h2>
            <button className="text-button" onClick={() => navigate('resumes')}>View all →</button>
          </div>
          {visibleResumes.length > 0 ? (
            <div className="resume-list">
              {visibleResumes.map((resume) => (
                <div className="resume-row" key={resume.id}>
                  <div className="file-icon">▤</div>
                  <div className="row-main">
                    <strong>{resume.title}</strong>
                    <span>Uploaded {formatDate(resume.created_at)} · {resume.file_type.toUpperCase()}</span>
                  </div>
                  {resume.latest_score !== null && <b className="row-score">{Math.round(resume.latest_score)}/100</b>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{search ? 'No resumes match your search.' : 'No resumes yet.'}</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Recent job matches</h2>
            <span className="status-pill">KEYWORD MATCHED</span>
          </div>
          {visibleMatches.length > 0 ? (
            <div className="job-list">
              {visibleMatches.map((analysis) => (
                <div className="job-row" key={analysis.id}>
                  <div>
                    <strong>{analysis.job_title ?? 'Untitled role'}</strong>
                    <span>{analysis.resume_title} · {formatDate(analysis.created_at)}</span>
                  </div>
                  <div className={`match-score ${analysis.overall_match_score < 75 ? 'moderate' : ''}`}>
                    {Math.round(analysis.overall_match_score)}%<small>{matchLabel(analysis.overall_match_score)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{search ? 'No matches fit your search.' : 'No job matches yet.'}</div>
          )}
          <button className="text-button" onClick={() => navigate('matching')}>Match a resume to a job →</button>
        </article>
      </div>
    </>
  );
}
