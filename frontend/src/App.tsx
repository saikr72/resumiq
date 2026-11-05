import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { apiFetch, AuthUser } from './api';
import AccountPage from './pages/AccountPage';
import AnalysisPage from './pages/AnalysisPage';
import ApplicationsPage from './pages/ApplicationsPage';
import BuilderPage from './pages/BuilderPage';
import InsightsPage from './pages/InsightsPage';
import MatchingPage from './pages/MatchingPage';
import OverviewPage from './pages/OverviewPage';
import ResumesPage from './pages/ResumesPage';
import { PageId, PageProps, WorkspaceData } from './types';

const PAGE_TITLES: Record<PageId, string> = {
  dashboard: 'Overview',
  builder: 'Resume Builder',
  analysis: 'AI Analysis',
  matching: 'Job Matching',
  resumes: 'My Resumes',
  insights: 'Career Insights',
  applications: 'Applications',
  account: 'Account',
};

const NAV_GROUPS: { label: string; links: [PageId, string, string][] }[] = [
  {
    label: 'WORKSPACE',
    links: [
      ['dashboard', '◫', 'Overview'],
      ['builder', '▤', 'Resume Builder'],
      ['analysis', '✧', 'AI Analysis'],
      ['matching', '⌕', 'Job Matching'],
      ['resumes', '▣', 'My Resumes'],
    ],
  },
  {
    label: 'CAREER GROWTH',
    links: [
      ['insights', '⌁', 'Career Insights'],
      ['applications', '▦', 'Applications'],
    ],
  },
];

function pageFromHash(): PageId {
  const page = window.location.hash.slice(1);
  return page in PAGE_TITLES ? (page as PageId) : 'dashboard';
}

function initials(user: AuthUser): string {
  const source = user.fullName?.trim() || user.email;
  const parts = source.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
}

interface AppProps {
  user: AuthUser;
  onLogout: () => void;
  onAccountDeleted: () => void;
}

export default function App({ user, onLogout, onAccountDeleted }: AppProps) {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [data, setData] = useState<WorkspaceData>({ resumes: [], analyses: [], applications: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [toastState, setToastState] = useState<{ message: string; isError: boolean } | null>(null);
  const toastTimer = useRef<number>();
  const searchInput = useRef<HTMLInputElement>(null);

  const toast = useCallback((message: string, isError = false) => {
    setToastState({ message, isError });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastState(null), 2600);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const responses = await Promise.all(['/resumes', '/analyses', '/applications'].map((path) => apiFetch(path)));
      if (responses.some((response) => response.status === 401)) return; // AuthGate returns to the login page
      if (!responses.every((response) => response.ok)) throw new Error('Failed to load workspace');
      const [resumes, analyses, applications] = await Promise.all(responses.map((response) => response.json()));
      setData({ resumes, analyses, applications });
      setLoadFailed(false);
    } catch (error) {
      console.error('Error loading workspace:', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleHashChange = () => {
      setPage(pageFromHash());
      setMenuOpen(false);
      window.scrollTo({ top: 0 });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  const navigate = useCallback((next: PageId) => {
    window.location.hash = next;
  }, []);

  const pageProps: PageProps = { data, search, navigate, refresh, toast };
  const displayName = user.fullName?.trim() || user.email;

  return (
    <div className="app-shell">
      <div className={`nav-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a className="brand" href="#dashboard" aria-label="resumIQ home">
          <img className="brand-logo" src="/logo-riq.jpg" alt="" width={501} height={161} />
        </a>
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            <nav className="nav-list" aria-label={group.label}>
              {group.links.map(([id, icon, label]) => (
                <a className={`nav-link ${page === id ? 'active' : ''}`} href={`#${id}`} key={id} aria-current={page === id ? 'page' : undefined}>
                  <span className="nav-icon">{icon}</span>
                  <span>{label}</span>
                </a>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="eyebrow-pill">FREE PLAN</span>
            <h3>Unlock your potential</h3>
            <p>Get deeper AI insights and unlimited resume analysis.</p>
            <button className="button button-primary button-full" onClick={() => toast('Subscription plans will be available soon.')}>
              Explore Pro <span>↗</span>
            </button>
          </div>
          <div className="profile-mini">
            <div className="avatar">{initials(user)}</div>
            <div className="profile-copy">
              <strong title={displayName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</strong>
              <span>Personal workspace</span>
            </div>
            <a className="icon-button" href="#account" aria-label="Account settings" title="Account settings" style={{ display: 'grid', placeItems: 'center', marginLeft: 'auto', border: 0, flexShrink: 0 }}>
              <Settings size={15} />
            </a>
            <button className="icon-button" onClick={onLogout} aria-label="Sign out" title="Sign out" style={{ marginLeft: 0, flexShrink: 0 }}>
              <LogOut size={15} style={{ margin: 'auto' }} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>☰</button>
          <div className="breadcrumbs">
            <span>Workspace</span><b>/</b><strong>{PAGE_TITLES[page]}</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <span>⌕</span>
              <input ref={searchInput} type="search" placeholder="Search workspace" aria-label="Search workspace" value={search} onChange={(e) => setSearch(e.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
            <div className="avatar avatar-small" title={displayName}>{initials(user)}</div>
          </div>
        </header>

        <div className="page-content">
          {loadFailed && (
            <div className="notice error" role="alert">
              <span>We couldn't load your workspace, so some information may be missing.</span>
              <button className="text-button" onClick={refresh}>Try again</button>
            </div>
          )}
          <section className="page active" key={page}>
            {isLoading ? (
              <div className="empty-state">Loading your workspace...</div>
            ) : (
              <>
                {page === 'dashboard' && <OverviewPage {...pageProps} user={user} />}
                {page === 'builder' && <BuilderPage {...pageProps} />}
                {page === 'analysis' && <AnalysisPage {...pageProps} />}
                {page === 'matching' && <MatchingPage {...pageProps} />}
                {page === 'resumes' && <ResumesPage {...pageProps} />}
                {page === 'insights' && <InsightsPage {...pageProps} />}
                {page === 'applications' && <ApplicationsPage {...pageProps} />}
                {page === 'account' && <AccountPage {...pageProps} user={user} onAccountDeleted={onAccountDeleted} />}
              </>
            )}
          </section>
        </div>
      </main>
      <div className={`toast ${toastState ? 'show' : ''} ${toastState?.isError ? 'error' : ''}`} role="status" aria-live="polite">
        {toastState?.message}
      </div>
    </div>
  );
}
