import React, { useState } from 'react';
import { PageProps } from '../types';

const STEPS = [
  ['Personal information', 'Contact details and links'],
  ['Professional summary', 'Your career positioning'],
  ['Work experience', 'Impact-led achievements'],
  ['Skills & education', 'Relevant qualifications'],
  ['Projects & export', 'Template and PDF'],
];

// Resume generation has no backend yet. This page says so, rather than implying a draft was written or saved.
export default function BuilderPage({ toast }: PageProps) {
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [brief, setBrief] = useState<{ title: string; role: string; notes: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBrief({ title: title.trim(), role: role.trim(), notes: notes.trim() });
    toast('Draft brief prepared.');
  };

  return (
    <>
      <div className="page-heading">
        <p className="overline">CREATE WITH CONFIDENCE</p>
        <h1>Resume Builder</h1>
        <p className="subheading">Plan your resume content. AI drafting isn't available yet.</p>
      </div>
      <div className="builder-layout">
        <article className="panel form-panel">
          <div className="panel-heading">
            <div><p className="overline">NEW DOCUMENT</p><h2>Start with your career story</h2></div>
            <span className="status-pill">COMING SOON</span>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="resumeTitle">Resume title</label>
            <input className="form-control" id="resumeTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Full Stack Developer" required />
            <label className="field-label" htmlFor="targetRole">Target role</label>
            <input className="form-control" id="targetRole" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Software Engineer" required />
            <label className="field-label" htmlFor="resumeNotes">Professional summary or experience notes</label>
            <textarea className="form-control textarea" id="resumeNotes" rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe your experience, skills, achievements and projects..." required />
            <div className="form-hint">Tip: Include measurable results, technologies, project scope and business impact.</div>
            <button className="button button-primary" type="submit">✦ Prepare draft brief</button>
          </form>
          {brief && (
            <div className="output-box" aria-live="polite">
              <strong>Draft brief prepared</strong>
              <p><b>Document:</b> {brief.title}<br /><b>Target role:</b> {brief.role}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{brief.notes}</p>
              <p className="form-hint">AI resume generation isn't available yet, and this brief isn't saved. Copy anything you want to keep.</p>
            </div>
          )}
        </article>
        <aside className="panel builder-aside">
          <p className="overline">YOUR WORKFLOW</p>
          <h2>Build it step by step</h2>
          <ol className="steps">
            {STEPS.map(([name, detail], index) => (
              <li key={name} className={index === 0 ? 'step-current' : ''}>
                <span>0{index + 1}</span>
                <div><b>{name}</b><small>{detail}</small></div>
              </li>
            ))}
          </ol>
          <div className="aside-note"><span>✦</span><p>AI suggestions should strengthen your real experience—not invent qualifications or achievements.</p></div>
        </aside>
      </div>
    </>
  );
}
