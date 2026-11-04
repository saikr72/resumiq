import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, BarChart2, Briefcase, Sparkles, Upload, Plus, Trash2, Edit2, Calendar, User, MapPin, DollarSign, ChevronDown, ChevronUp, Save, X } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

interface Application {
  id: string;
  company_name: string;
  job_title: string;
  job_url?: string;
  salary_range?: string;
  location?: string;
  status: string;
  notes?: string;
  applied_date?: string;
  created_at: string;
  resume_id?: string;
  job_id?: string;
}

interface InterviewStage {
  id: string;
  application_id: string;
  stage_name: string;
  scheduled_at?: string;
  interviewer_info?: string;
  notes?: string;
  status: string;
  created_at: string;
}

const STATUS_ORDER = ['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'REJECTED'];
const STATUS_LABELS: Record<string, string> = {
  'SAVED': 'Saved',
  'APPLIED': 'Applied',
  'SCREENING': 'Screening',
  'INTERVIEWING': 'Interviewing',
  'OFFER': 'Offer',
  'REJECTED': 'Rejected'
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'tracker'>('analyze');
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Tracker state
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [newApp, setNewApp] = useState({
    companyName: '',
    jobTitle: '',
    jobUrl: '',
    salaryRange: '',
    location: '',
    status: 'SAVED' as string,
    notes: ''
  });

  // Interview state
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [interviews, setInterviews] = useState<InterviewStage[]>([]);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [newInterview, setNewInterview] = useState({
    stageName: '',
    scheduledAt: '',
    interviewerInfo: '',
    notes: '',
    status: 'SCHEDULED'
  });
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      alert('Please upload a resume first');
      return;
    }

    setIsAnalyzing(true);
    setResults(null);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await fetch('http://localhost:5000/api/resumes/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to analyze resume');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'tracker') {
      fetchApplications();
    }
  }, [activeTab]);

  const fetchApplications = async () => {
    setIsLoadingApps(true);
    try {
      const response = await fetch(`${API_BASE}/applications`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setApplications(data);
    } catch (error) {
      console.error('Error fetching apps:', error);
    } finally {
      setIsLoadingApps(false);
    }
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApp),
      });
      if (!response.ok) throw new Error('Failed to add');
      await fetchApplications();
      setShowAddModal(false);
      setNewApp({
        companyName: '',
        jobTitle: '',
        jobUrl: '',
        salaryRange: '',
        location: '',
        status: 'SAVED',
        notes: ''
      });
    } catch (error) {
      console.error('Error adding app:', error);
      alert('Failed to add application');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_BASE}/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Update failed');
      setApplications(apps => apps.map(a => a.id === id ? { ...a, status: newStatus } : a));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      const response = await fetch(`${API_BASE}/applications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      setApplications(apps => apps.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting app:', error);
    }
  };

  const fetchInterviews = async (appId: string) => {
    setIsLoadingInterviews(true);
    try {
      const response = await fetch(`${API_BASE}/applications/${appId}/interviews`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setInterviews(data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setIsLoadingInterviews(false);
    }
  };

  const handleAddInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) return;
    try {
      const response = await fetch(`${API_BASE}/applications/${selectedAppId}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInterview),
      });
      if (!response.ok) throw new Error('Failed to add');
      await fetchInterviews(selectedAppId);
      setShowInterviewModal(false);
      setNewInterview({
        stageName: '',
        scheduledAt: '',
        interviewerInfo: '',
        notes: '',
        status: 'SCHEDULED'
      });
    } catch (error) {
      console.error('Error adding interview:', error);
      alert('Failed to add interview');
    }
  };

  const handleUpdateInterview = async (id: string, updates: Partial<InterviewStage>) => {
    try {
      const response = await fetch(`${API_BASE}/interview_stages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Update failed');
      setInterviews(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    } catch (error) {
      console.error('Error updating interview:', error);
    }
  };

  const openInterviewModal = (appId: string, appName: string) => {
    setSelectedAppId(appId);
    setInterviews([]);
    fetchInterviews(appId);
    setShowInterviewModal(true);
  };

  const closeInterviewModal = () => {
    setShowInterviewModal(false);
    setSelectedAppId(null);
    setInterviews([]);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    SCHEDULED: { bg: 'bg-amber-900/30', text: 'text-amber-300', border: 'border-amber-800' },
    COMPLETED: { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' },
    PASSED: { bg: 'bg-emerald-900/30', text: 'text-emerald-300', border: 'border-emerald-800' },
    FAILED: { bg: 'bg-rose-900/30', text: 'text-rose-300', border: 'border-rose-800' }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Add Application Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <Plus className="h-5 w-5 text-indigo-400" />
                <span>Track New Application</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddApplication} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company Name</label>
                  <input
                    required
                    value={newApp.companyName}
                    onChange={e => setNewApp({ ...newApp, companyName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="e.g. Anthropic"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Job Title</label>
                  <input
                    required
                    value={newApp.jobTitle}
                    onChange={e => setNewApp({ ...newApp, jobTitle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="e.g. Frontend Engineer"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Job URL</label>
                <input
                  value={newApp.jobUrl}
                  onChange={e => setNewApp({ ...newApp, jobUrl: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                  placeholder="Link to posting"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</label>
                  <input
                    value={newApp.location}
                    onChange={e => setNewApp({ ...newApp, location: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="e.g. Remote / NYC"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    value={newApp.status}
                    onChange={e => setNewApp({ ...newApp, status: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                  >
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
                <textarea
                  value={newApp.notes}
                  onChange={e => setNewApp({ ...newApp, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors resize-none"
                  placeholder="Key details, interviewers, etc."
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
                Create Application
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Resume Intelligence Platform
            </h1>
            <p className="text-xs text-slate-400">AI-Powered ATS Analysis & Application Workflow</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analyze'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Resume & Job Match</span>
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tracker'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Application Tracker</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'analyze' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Panel */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-indigo-300 flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Upload Resume & Job Details</span>
              </h2>

              {/* Upload Dropzone */}
              <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-900/50 cursor-pointer">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.docx"
                />
                <Upload className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-300">
                  {file ? file.name : "Drag and drop your resume (PDF or DOCX)"}
                </p>
                <p className="text-xs text-slate-500 mt-1">Maximum file size: 10MB</p>
              </div>

              {/* Job Description TextArea */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Target Job Description</label>
                <textarea
                  rows={6}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job posting text here..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !file}
                className={`w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium py-3 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  (isAnalyzing || !file) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isAnalyzing ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Analyze ATS Compatibility</span>
                  </>
                )}
              </button>
            </div>

            {/* Results Preview Panel */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6 flex flex-col h-full">
              <div>
                <h2 className="text-lg font-semibold text-cyan-300 mb-4 flex items-center space-x-2">
                  <BarChart2 className="h-5 w-5" />
                  <span>ATS Match Overview</span>
                </h2>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-xs text-slate-400">Overall Match</p>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">
                      {results?.comparison?.match_percentage ?? '--'}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-xs text-slate-400">Keywords Found</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">
                      {results?.comparison?.matched_skills?.length ?? '--'}
                    </p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-xs text-slate-400">Missing Skills</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">
                      {results?.comparison?.missing_skills?.length ?? '--'}
                    </p>
                  </div>
                </div>

                {/* Skill Gaps Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-300">Keyword & Skill Gap Analysis</h3>
                  {!results ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-400">
                      Upload a resume and job description to see missing hard skills, soft skills, and structural ATS suggestions.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {results.comparison?.matched_skills?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Matched Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {results.comparison.matched_skills.map((skill: string) => (
                              <span key={skill} className="px-2 py-1 bg-emerald-900/30 text-emerald-300 border border-emerald-800 rounded-md text-xs">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {results.comparison?.missing_skills?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">Missing Priority Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {results.comparison.missing_skills.map((skill: string) => (
                              <span key={skill} className="px-2 py-1 bg-rose-900/30 text-rose-300 border border-rose-800 rounded-md text-xs">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {results?.aiSuggestions?.error && (
                <div role="alert" className="flex items-start space-x-3 border border-amber-800 bg-amber-900/30 rounded-xl p-4 text-sm text-amber-200">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                  <span>AI suggestions couldn't be generated for this analysis. The keyword match above is still valid. Please try again later.</span>
                </div>
              )}

              {/* AI Suggestions Section */}
              {results?.aiSuggestions && !results.aiSuggestions.error && (
                <div className="space-y-4 border-t border-slate-800 pt-6">
                  <h3 className="text-sm font-semibold text-indigo-300 flex items-center space-x-2">
                    <Sparkles className="h-4 w-4" />
                    <span>AI-Powered ATS Optimizations</span>
                  </h3>

                  {results.aiSuggestions.summary && (
                    <div className="bg-indigo-900/30 border border-indigo-800 rounded-xl p-4 text-sm text-indigo-200">
                      {results.aiSuggestions.summary}
                    </div>
                  )}

                  {results.aiSuggestions.critical_missing_skills?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Critical Missing Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {results.aiSuggestions.critical_missing_skills.map((skill: string) => (
                          <span key={skill} className="px-2 py-1 bg-amber-900/30 text-amber-300 border border-amber-800 rounded-md text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.aiSuggestions.actionable_suggestions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Actionable Suggestions</p>
                      <ul className="space-y-2">
                        {results.aiSuggestions.actionable_suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx} className="flex items-start space-x-2 text-sm text-slate-300">
                            <span className="flex-shrink-0 text-cyan-400 mt-0.5">→</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {results.aiSuggestions.optimized_bullet_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Optimized Bullet Points</p>
                      <div className="space-y-3">
                        {results.aiSuggestions.optimized_bullet_points.map((bullet: any, idx: number) => (
                          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-400">Original</p>
                              <p className="text-xs text-slate-500 line-through">{bullet.original}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-emerald-400">Optimized</p>
                              <p className="text-xs text-emerald-300 bg-emerald-900/20 p-2 rounded">{bullet.optimized}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-auto border-t border-slate-800 pt-4 text-xs text-slate-500 flex items-center justify-between">
                <span>Powered by Claude LLM & FastAPI NLP Service</span>
                {results?.aiSuggestions?.error ? (
                  <span className="flex items-center space-x-1 text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Keyword analysis only</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Ready</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Kanban Application Tracker */
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-950 border border-slate-800 rounded-2xl p-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Briefcase className="h-6 w-6 text-indigo-400" />
                  <span>Job Application & Interview Tracker</span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">Manage your pipeline and track interview progress across stages.</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Add Application</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
              {STATUS_ORDER.map((status) => {
                const filteredApps = applications.filter(app => app.status === status);
                return (
                  <div key={status} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex flex-col h-full min-w-[240px]">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/50">
                      <span className="font-bold text-xs uppercase tracking-widest text-slate-400">{STATUS_LABELS[status]}</span>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">{filteredApps.length}</span>
                    </div>

                    <div className="space-y-3 flex-1">
                      {filteredApps.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-800/40 rounded-xl p-8 text-center text-[10px] text-slate-600 uppercase tracking-tighter">
                          No {status.toLowerCase()}
                        </div>
                      ) : (
                        filteredApps.map((app) => (
                          <div key={app.id} className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                               <button onClick={() => handleDeleteApplication(app.id)} className="p-1 text-slate-500 hover:text-rose-400">
                                 <Trash2 className="h-3.5 w-3.5" />
                               </button>
                            </div>

                            <h4 className="font-bold text-slate-100 text-sm leading-tight mb-1">{app.company_name}</h4>
                            <p className="text-xs text-slate-400 mb-3">{app.job_title}</p>

                            <div className="space-y-1.5 mb-4">
                              {app.location && (
                                <div className="flex items-center text-[10px] text-slate-500">
                                  <MapPin className="h-3 w-3 mr-1 text-slate-600" />
                                  <span>{app.location}</span>
                                </div>
                              )}
                              {app.salary_range && (
                                <div className="flex items-center text-[10px] text-slate-500">
                                  <DollarSign className="h-3 w-3 mr-1 text-slate-600" />
                                  <span>{app.salary_range}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <select
                                value={app.status}
                                onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                className="bg-slate-800 text-[10px] text-slate-300 rounded-md px-2 py-1 outline-none border border-transparent focus:border-indigo-500"
                              >
                                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                              </select>

                              <button
                                onClick={() => openInterviewModal(app.id, app.company_name)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
                              >
                                <Calendar className="h-3 w-3" />
                                <span>Interviews</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Interview Stages Modal */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <span>Interview Schedule</span>
              </h3>
              <button onClick={closeInterviewModal} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Add Interview Form */}
            <form onSubmit={handleAddInterview} className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                <span>Schedule New Interview</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stage Name</label>
                  <input
                    required
                    value={newInterview.stageName}
                    onChange={e => setNewInterview({ ...newInterview, stageName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="e.g. Technical Screen, System Design, HM Round"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date & Time</label>
                  <input
                    required
                    type="datetime-local"
                    value={newInterview.scheduledAt}
                    onChange={e => setNewInterview({ ...newInterview, scheduledAt: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interviewer</label>
                  <input
                    value={newInterview.interviewerInfo}
                    onChange={e => setNewInterview({ ...newInterview, interviewerInfo: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="Name & Role"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    value={newInterview.status}
                    onChange={e => setNewInterview({ ...newInterview, status: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PASSED">Passed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
                <textarea
                  value={newInterview.notes}
                  onChange={e => setNewInterview({ ...newInterview, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors resize-none"
                  placeholder="Prep notes, questions, feedback..."
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Schedule Interview</span>
              </button>
            </form>

            {/* Interview List */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Upcoming & Past Rounds</h4>
              {isLoadingInterviews ? (
                <div className="flex justify-center py-8 text-slate-400">Loading...</div>
              ) : interviews.length === 0 ? (
                <div className="border-2 border-dashed border-slate-800/40 rounded-xl p-8 text-center text-sm text-slate-600">
                  No interviews scheduled yet. Add your first round above.
                </div>
              ) : (
                <div className="space-y-3">
                  {interviews.map((interview) => (
                    <div key={interview.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-bold text-white text-sm">{interview.stage_name}</h5>
                          <p className="text-xs text-slate-400">{formatDate(interview.scheduled_at)}</p>
                        </div>
                        <span className={`${STATUS_STYLES[interview.status]?.bg || 'bg-slate-800'} ${STATUS_STYLES[interview.status]?.text || 'text-slate-300'} ${STATUS_STYLES[interview.status]?.border || 'border-slate-700'} px-2 py-0.5 rounded-full text-xs font-medium capitalize`}>
                          {interview.status.toLowerCase()}
                        </span>
                      </div>

                      {interview.interviewer_info && (
                        <div className="flex items-center text-xs text-slate-500 mb-2">
                          <User className="h-3 w-3 mr-1" />
                          <span>{interview.interviewer_info}</span>
                        </div>
                      )}

                      {interview.notes && (
                        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-300 border-l-4 border-indigo-500 mb-3">
                          {interview.notes}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <select
                          value={interview.status}
                          onChange={(e) => handleUpdateInterview(interview.id, { status: e.target.value })}
                          className="bg-slate-800 text-[10px] text-slate-300 rounded-md px-2 py-1 outline-none border border-transparent focus:border-indigo-500 flex-1"
                        >
                          <option value="SCHEDULED">Scheduled</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="PASSED">Passed</option>
                          <option value="FAILED">Failed</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
