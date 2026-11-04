import React, { useState } from 'react';
import { apiFetch } from '../api';
import AnalysisOutput from '../components/AnalysisOutput';
import { AnalysisResult, PageProps } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function AnalysisPage({ refresh, toast }: PageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const chooseFile = (chosen?: File) => {
    if (!chosen) return;
    if (!/\.(pdf|docx)$/i.test(chosen.name)) {
      toast('Please choose a PDF or DOCX file.', true);
      return;
    }
    if (chosen.size > MAX_FILE_SIZE) {
      toast('File exceeds the 10 MB upload limit.', true);
      return;
    }
    setFile(chosen);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    chooseFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast('Please select a PDF or DOCX resume first.', true);
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobTitle', role);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await apiFetch('/resumes/upload', { method: 'POST', body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status !== 401) toast(data?.error || 'Failed to analyse resume.', true);
        return;
      }
      setResult(data);
      toast('Resume analysed.');
      await refresh();
    } catch (error) {
      console.error('Error analysing resume:', error);
      toast("We couldn't reach the server. Please try again.", true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const comparison = result?.comparison;
  const detectedCount = result ? Object.values(result.parsedSkills ?? {}).flat().length : null;

  return (
    <>
      <div className="page-heading">
        <p className="overline">UNDERSTAND YOUR RESUME</p>
        <h1>AI Resume Analysis</h1>
        <p className="subheading">Discover skills, gaps and practical ways to improve your resume.</p>
      </div>
      <article className="panel upload-panel">
        <div className="panel-heading">
          <div><p className="overline">INTELLIGENCE ENGINE</p><h2>Upload your resume</h2></div>
          <span className="status-pill">PDF / DOCX</span>
        </div>
        <label
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          htmlFor="resumeFile"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <span className="upload-symbol">⇧</span>
          <strong>Drop your resume here or <u>browse files</u></strong>
          <small>PDF or DOCX · Maximum 10 MB</small>
          <input id="resumeFile" type="file" accept=".pdf,.docx" onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <p className="file-selected" aria-live="polite">
          {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'No file selected'}
        </p>
        <label className="field-label" htmlFor="analysisRole">Target job title <span className="optional">OPTIONAL</span></label>
        <input className="form-control" id="analysisRole" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Full Stack Developer" />
        <label className="field-label" htmlFor="analysisJob">Job description <span className="optional">OPTIONAL · NEEDED FOR A MATCH SCORE</span></label>
        <textarea className="form-control textarea" id="analysisJob" rows={6} maxLength={20000} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description here..." style={{ marginBottom: 15 }} />
        <button className="button button-primary" type="button" onClick={handleAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? 'Analysing...' : '✦ Analyse resume'}
        </button>
        {result && <AnalysisOutput result={result} />}
      </article>

      <div className="stats-grid analysis-stats">
        <article className="stat-card">
          <div className="stat-top"><span>Keyword match</span><span className="stat-icon purple">◈</span></div>
          <strong className="stat-value">{comparison ? `${Math.round(comparison.match_percentage)}%` : '—'}</strong>
          <p className="neutral">Against this job description</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Skills matched</span><span className="stat-icon cyan">⌕</span></div>
          <strong className="stat-value">{comparison ? comparison.matched_skills.length : '—'}</strong>
          <p className="neutral">Found in both</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Skills missing</span><span className="stat-icon blue">≋</span></div>
          <strong className="stat-value">{comparison ? comparison.missing_skills.length : '—'}</strong>
          <p className="neutral">In the job, not your resume</p>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Skills detected</span><span className="stat-icon green">↗</span></div>
          <strong className="stat-value">{detectedCount ?? '—'}</strong>
          <p className="neutral">In your resume</p>
        </article>
      </div>
      <p className="disclaimer">Scores compare skill keywords only. They are not a real ATS result or a guarantee of interview selection.</p>
    </>
  );
}
