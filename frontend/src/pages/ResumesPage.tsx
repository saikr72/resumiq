import React from 'react';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '../api';
import { formatDate, matchesSearch, PageProps } from '../types';

export default function ResumesPage({ data, search, navigate, refresh, toast }: PageProps) {
  const visible = data.resumes.filter((resume) => matchesSearch(search, resume.title));

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and its analyses? This can't be undone.`)) return;
    try {
      const response = await apiFetch(`/resumes/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        if (response.status !== 401) toast('Failed to delete resume.', true);
        return;
      }
      toast('Resume deleted.');
      await refresh();
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast("We couldn't reach the server. Please try again.", true);
    }
  };

  const count = data.resumes.length;

  return (
    <>
      <div className="page-heading heading-row">
        <div>
          <p className="overline">YOUR DOCUMENT WORKSPACE</p>
          <h1>My Resumes</h1>
          <p className="subheading">Manage tailored versions of your professional story.</p>
        </div>
        <button className="button button-primary" onClick={() => navigate('analysis')}>＋ Upload resume</button>
      </div>
      <article className="panel">
        <div className="panel-heading">
          <h2>Resume library</h2>
          <span className="status-pill">{count} {count === 1 ? 'DOCUMENT' : 'DOCUMENTS'}</span>
        </div>
        {visible.length > 0 ? (
          <div className="resume-list">
            {visible.map((resume) => (
              <div className="resume-row" key={resume.id}>
                <div className="file-icon">▤</div>
                <div className="row-main">
                  <strong>{resume.title}</strong>
                  <span>{resume.file_type.toUpperCase()} · Uploaded {formatDate(resume.created_at)}</span>
                </div>
                <div className="row-actions">
                  {resume.latest_score !== null && <b className="row-score">{Math.round(resume.latest_score)}/100</b>}
                  <button className="icon-button" onClick={() => handleDelete(resume.id, resume.title)} aria-label={`Delete ${resume.title}`} title="Delete resume">
                    <Trash2 size={14} style={{ margin: 'auto' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {search ? 'No resumes match your search.' : 'No resumes yet. Upload one to analyse it.'}
          </div>
        )}
      </article>
    </>
  );
}
