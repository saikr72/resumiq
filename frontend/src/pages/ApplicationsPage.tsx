import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { apiFetch } from '../api';
import { Application, formatDate, InterviewStage, matchesSearch, PageProps } from '../types';

const STATUS_ORDER = ['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'REJECTED'];
const STATUS_LABELS: Record<string, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEWING: 'Interviewing',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};
const INTERVIEW_STATUSES = [
  ['SCHEDULED', 'Scheduled'],
  ['COMPLETED', 'Completed'],
  ['PASSED', 'Passed'],
  ['FAILED', 'Failed'],
];

const EMPTY_APPLICATION = { companyName: '', jobTitle: '', jobUrl: '', salaryRange: '', location: '', status: 'SAVED', notes: '' };
const EMPTY_INTERVIEW = { stageName: '', scheduledAt: '', interviewerInfo: '', notes: '', status: 'SCHEDULED' };

const jsonRequest = (method: string, body: object): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function formatInterviewDate(value?: string): string {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ApplicationsPage({ data, search, refresh, toast }: PageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newApp, setNewApp] = useState(EMPTY_APPLICATION);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [interviews, setInterviews] = useState<InterviewStage[]>([]);
  const [newInterview, setNewInterview] = useState(EMPTY_INTERVIEW);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);

  // Runs a request, and returns the response only if it succeeded. Expired sessions are handled by AuthGate.
  const send = async (path: string, init: RequestInit | undefined, failure: string) => {
    try {
      const response = await apiFetch(path, init);
      if (response.ok) return response;
      if (response.status !== 401) toast(failure, true);
    } catch (error) {
      console.error(failure, error);
      toast("We couldn't reach the server. Please try again.", true);
    }
    return null;
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await send('/applications', jsonRequest('POST', newApp), 'Failed to add application.')) {
      setShowAddModal(false);
      setNewApp(EMPTY_APPLICATION);
      toast('Application added.');
      await refresh();
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (await send(`/applications/${id}`, jsonRequest('PATCH', { status }), 'Failed to update status.')) {
      await refresh();
    }
  };

  const handleDelete = async (app: Application) => {
    if (!confirm(`Delete the application for ${app.job_title} at ${app.company_name}?`)) return;
    if (await send(`/applications/${app.id}`, { method: 'DELETE' }, 'Failed to delete application.')) {
      toast('Application deleted.');
      await refresh();
    }
  };

  const fetchInterviews = async (appId: string) => {
    setIsLoadingInterviews(true);
    const response = await send(`/applications/${appId}/interviews`, undefined, 'Failed to load interviews.');
    if (response) setInterviews(await response.json());
    setIsLoadingInterviews(false);
  };

  const openInterviews = (appId: string) => {
    setSelectedAppId(appId);
    setInterviews([]);
    fetchInterviews(appId);
  };

  const closeInterviews = () => {
    setSelectedAppId(null);
    setInterviews([]);
  };

  const handleAddInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) return;
    // datetime-local has no offset, so convert while the browser's timezone is known
    const body = { ...newInterview, scheduledAt: new Date(newInterview.scheduledAt).toISOString() };
    if (await send(`/applications/${selectedAppId}/interviews`, jsonRequest('POST', body), 'Failed to add interview.')) {
      setNewInterview(EMPTY_INTERVIEW);
      closeInterviews();
      toast('Interview scheduled.');
    }
  };

  const handleUpdateInterview = async (id: string, status: string) => {
    if (await send(`/interview_stages/${id}`, jsonRequest('PATCH', { status }), 'Failed to update interview.')) {
      setInterviews((current) => current.map((stage) => (stage.id === id ? { ...stage, status } : stage)));
    }
  };

  const countOf = (...statuses: string[]) => data.applications.filter((app) => statuses.includes(app.status)).length;
  const visible = data.applications.filter((app) => matchesSearch(search, app.job_title, app.company_name, app.location));

  return (
    <>
      <div className="page-heading heading-row">
        <div>
          <p className="overline">STAY ORGANISED</p>
          <h1>Application Tracker</h1>
          <p className="subheading">Keep your opportunities and follow-ups in one place.</p>
        </div>
        <button className="button button-primary" onClick={() => setShowAddModal(true)}>＋ Add application</button>
      </div>

      <div className="stats-grid application-stats">
        <article className="stat-card"><div className="stat-top">Applied</div><strong className="stat-value">{countOf('APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'REJECTED')}</strong></article>
        <article className="stat-card"><div className="stat-top">Interviewing</div><strong className="stat-value">{countOf('INTERVIEWING')}</strong></article>
        <article className="stat-card"><div className="stat-top">Offers</div><strong className="stat-value">{countOf('OFFER')}</strong></article>
        <article className="stat-card"><div className="stat-top">Closed</div><strong className="stat-value">{countOf('REJECTED')}</strong></article>
      </div>

      <article className="panel">
        <div className="panel-heading">
          <h2>Your applications</h2>
          <span className="status-pill">{data.applications.length} TOTAL</span>
        </div>
        {visible.length > 0 ? (
          <div className="application-list">
            {visible.map((app) => (
              <div className="job-row" key={app.id}>
                <div>
                  <strong>{app.job_title}</strong>
                  <span>{[app.company_name, app.location, app.salary_range, formatDate(app.created_at)].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="row-actions">
                  <select className="form-control" aria-label={`Status of ${app.job_title}`} value={app.status} onChange={(e) => handleUpdateStatus(app.id, e.target.value)}>
                    {STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                  <button className="text-button" onClick={() => openInterviews(app.id)}>Interviews</button>
                  <button className="icon-button" onClick={() => handleDelete(app)} aria-label={`Delete ${app.job_title}`} title="Delete application">
                    <Trash2 size={14} style={{ margin: 'auto' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">{search ? 'No applications match your search.' : 'No applications yet. Add one to start tracking it.'}</div>
        )}
      </article>

      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Track new application">
            <div className="modal-heading">
              <h3>Track new application</h3>
              <button className="icon-button" onClick={() => setShowAddModal(false)} aria-label="Close"><X size={16} style={{ margin: 'auto' }} /></button>
            </div>
            <form onSubmit={handleAddApplication}>
              <div className="field-grid">
                <div>
                  <label className="field-label" htmlFor="appCompany">Company name</label>
                  <input className="form-control" id="appCompany" required value={newApp.companyName} onChange={(e) => setNewApp({ ...newApp, companyName: e.target.value })} />
                </div>
                <div>
                  <label className="field-label" htmlFor="appTitle">Job title</label>
                  <input className="form-control" id="appTitle" required value={newApp.jobTitle} onChange={(e) => setNewApp({ ...newApp, jobTitle: e.target.value })} />
                </div>
              </div>
              <label className="field-label" htmlFor="appUrl">Job URL</label>
              <input className="form-control" id="appUrl" value={newApp.jobUrl} onChange={(e) => setNewApp({ ...newApp, jobUrl: e.target.value })} placeholder="Link to posting" />
              <div className="field-grid">
                <div>
                  <label className="field-label" htmlFor="appLocation">Location</label>
                  <input className="form-control" id="appLocation" value={newApp.location} onChange={(e) => setNewApp({ ...newApp, location: e.target.value })} placeholder="e.g. Remote / NYC" />
                </div>
                <div>
                  <label className="field-label" htmlFor="appSalary">Salary range</label>
                  <input className="form-control" id="appSalary" value={newApp.salaryRange} onChange={(e) => setNewApp({ ...newApp, salaryRange: e.target.value })} />
                </div>
              </div>
              <label className="field-label" htmlFor="appStatus">Status</label>
              <select className="form-control" id="appStatus" value={newApp.status} onChange={(e) => setNewApp({ ...newApp, status: e.target.value })}>
                {STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
              </select>
              <label className="field-label" htmlFor="appNotes">Notes</label>
              <textarea className="form-control textarea" id="appNotes" rows={3} value={newApp.notes} onChange={(e) => setNewApp({ ...newApp, notes: e.target.value })} />
              <button type="submit" className="button button-primary button-full">Create application</button>
            </form>
          </div>
        </div>
      )}

      {selectedAppId && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Interview schedule">
            <div className="modal-heading">
              <h3>Interview schedule</h3>
              <button className="icon-button" onClick={closeInterviews} aria-label="Close"><X size={16} style={{ margin: 'auto' }} /></button>
            </div>
            <form onSubmit={handleAddInterview}>
              <div className="field-grid">
                <div>
                  <label className="field-label" htmlFor="stageName">Stage name</label>
                  <input className="form-control" id="stageName" required value={newInterview.stageName} onChange={(e) => setNewInterview({ ...newInterview, stageName: e.target.value })} placeholder="e.g. Technical screen" />
                </div>
                <div>
                  <label className="field-label" htmlFor="stageWhen">Date & time</label>
                  <input className="form-control" id="stageWhen" type="datetime-local" required value={newInterview.scheduledAt} onChange={(e) => setNewInterview({ ...newInterview, scheduledAt: e.target.value })} />
                </div>
              </div>
              <label className="field-label" htmlFor="stageWho">Interviewer</label>
              <input className="form-control" id="stageWho" value={newInterview.interviewerInfo} onChange={(e) => setNewInterview({ ...newInterview, interviewerInfo: e.target.value })} placeholder="Name & role" />
              <label className="field-label" htmlFor="stageNotes">Notes</label>
              <textarea className="form-control textarea" id="stageNotes" rows={2} value={newInterview.notes} onChange={(e) => setNewInterview({ ...newInterview, notes: e.target.value })} placeholder="Prep notes, questions, feedback..." />
              <button type="submit" className="button button-primary button-full">Schedule interview</button>
            </form>

            <p className="modal-section">Upcoming & past rounds</p>
            {isLoadingInterviews ? (
              <div className="empty-state">Loading...</div>
            ) : interviews.length === 0 ? (
              <div className="empty-state">No interviews scheduled yet.</div>
            ) : (
              interviews.map((stage) => (
                <div className="round" key={stage.id}>
                  <div className="round-top">
                    <div>
                      <strong>{stage.stage_name}</strong>
                      <span>{formatInterviewDate(stage.scheduled_at)}{stage.interviewer_info ? ` · ${stage.interviewer_info}` : ''}</span>
                    </div>
                    <select className="form-control" aria-label={`Status of ${stage.stage_name}`} value={stage.status} onChange={(e) => handleUpdateInterview(stage.id, e.target.value)}>
                      {INTERVIEW_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  {stage.notes && <p>{stage.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
