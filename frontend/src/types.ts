export interface Application {
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

export interface InterviewStage {
  id: string;
  application_id: string;
  stage_name: string;
  scheduled_at?: string;
  interviewer_info?: string;
  notes?: string;
  status: string;
  created_at: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  file_type: string;
  created_at: string;
  latest_score: number | null;
}

export interface AiSuggestions {
  error?: string;
  summary?: string;
  critical_missing_skills?: string[];
  actionable_suggestions?: string[];
  optimized_bullet_points?: { original: string; optimized: string }[];
  notes?: string;
}

export interface AnalysisSummary {
  id: string;
  resume_id: string;
  resume_title: string;
  job_title: string | null;
  overall_match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  improvement_suggestions: AiSuggestions | null;
  created_at: string;
}

export interface Comparison {
  match_percentage: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface AnalysisResult {
  comparison: Comparison | null;
  aiSuggestions: AiSuggestions | null;
  parsedSkills?: Record<string, string[]>;
}

export type PageId = 'dashboard' | 'builder' | 'analysis' | 'matching' | 'resumes' | 'insights' | 'applications' | 'account';

export interface WorkspaceData {
  resumes: ResumeSummary[];
  analyses: AnalysisSummary[];
  applications: Application[];
}

export interface PageProps {
  data: WorkspaceData;
  search: string;
  navigate: (page: PageId) => void;
  refresh: () => Promise<void>;
  toast: (message: string, isError?: boolean) => void;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function matchesSearch(search: string, ...values: (string | null | undefined)[]): boolean {
  const query = search.trim().toLowerCase();
  return !query || values.some((value) => value?.toLowerCase().includes(query));
}

export function matchLabel(score: number): string {
  if (score >= 75) return 'Strong match';
  if (score >= 50) return 'Potential match';
  return 'Low match';
}
