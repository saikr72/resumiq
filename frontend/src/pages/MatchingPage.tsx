import React, { useState } from 'react';
import { apiFetch } from '../api';
import AnalysisOutput from '../components/AnalysisOutput';
import { AnalysisResult, PageProps } from '../types';

export default function MatchingPage({ data, navigate, refresh, toast }: PageProps) {
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [chosenResumeId, setChosenResumeId] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Falls back to the newest resume, including when the chosen one has been deleted
  const resumeId = data.resumes.some((resume) => resume.id === chosenResumeId) ? chosenResumeId : data.resumes[0]?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeId) return;

    setIsMatching(true);
    setResult(null);
    try {
      const response = await apiFetch(`/resumes/${resumeId}/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle: role, jobDescription }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status !== 401) toast(body?.error || 'Failed to calculate compatibility.', true);
        return;
      }
      setResult(body);
      toast('Compatibility calculated.');
      await refresh();
    } catch (error) {
      console.error('Error matching resume:', error);
      toast("We couldn't reach the server. Please try again.", true);
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <p className="overline">FIND YOUR NEXT OPPORTUNITY</p>
        <h1>Job Matching Intelligence</h1>
        <p className="subheading">Compare your resume with a role and identify the gaps to close.</p>
      </div>
      <article className="panel form-panel">
        <div className="panel-heading">
          <div><p className="overline">COMPATIBILITY ANALYSIS</p><h2>Match your resume to a job</h2></div>
          <span className="status-pill">MATCH SCORE</span>
        </div>
        {data.resumes.length === 0 ? (
          <div className="empty-state">
            Upload a resume first, then compare it with any job description.
            <br />
            <button className="text-button" onClick={() => navigate('analysis')}>Upload a resume <span>↗</span></button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="matchRole">Target job title</label>
            <input className="form-control" id="matchRole" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Full Stack Developer" required />
            <label className="field-label" htmlFor="jobDescription">Job description</label>
            <textarea className="form-control textarea" id="jobDescription" rows={8} maxLength={20000} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the complete job description here..." required />
            <label className="field-label" htmlFor="matchResume">Resume to compare</label>
            <select className="form-control" id="matchResume" value={resumeId} onChange={(e) => setChosenResumeId(e.target.value)} style={{ marginBottom: 15 }}>
              {data.resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>{resume.title}</option>
              ))}
            </select>
            <button className="button button-primary" type="submit" disabled={isMatching}>
              {isMatching ? 'Calculating...' : '✦ Calculate compatibility'}
            </button>
          </form>
        )}
        {result && <AnalysisOutput result={result} />}
      </article>
      <div className="panel dimensions-panel">
        <h2>What the match score measures</h2>
        <ul className="suggestion-list">
          <li><strong>Skill keywords (40%):</strong> skills named in the job that also appear in your resume.</li>
          <li><strong>Meaning match (35%):</strong> how closely your described work relates to the job's duties, even in different words.</li>
          <li><strong>Experience (25%):</strong> your years of work against the years the job asks for. Unrelated work counts for less.</li>
        </ul>
        <p className="form-hint">If one can't be measured, the others make up the score. The score is an estimate to guide your edits, not a real ATS result or a guarantee of interview selection.</p>
      </div>
    </>
  );
}
