import React, { useState } from 'react';
import { apiFetch, AuthUser } from '../api';
import { PageProps } from '../types';

interface AccountPageProps extends PageProps {
  user: AuthUser;
  onAccountDeleted: () => void;
}

export default function AccountPage({ user, toast, onAccountDeleted }: AccountPageProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiFetch('/auth/account/export');
      if (!response.ok) {
        toast('Failed to export your data.', true);
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'resumiq-data-export.json';
      link.click();
      URL.revokeObjectURL(url);
      toast('Your data has been downloaded.');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast("We couldn't reach the server. Please try again.", true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    setIsDeleting(true);
    try {
      const response = await apiFetch('/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail, password }),
      });
      if (response.ok) {
        onAccountDeleted();
        return;
      }
      const data = await response.json().catch(() => null);
      setDeleteError(data?.error || 'Failed to delete your account.');
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleteError("We couldn't reach the server. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <p className="overline">YOUR PRIVACY</p>
        <h1>Account</h1>
        <p className="subheading">Signed in as {user.email}</p>
      </div>

      <article className="panel form-panel">
        <div className="panel-heading">
          <div><p className="overline">YOUR DATA</p><h2>Download your data</h2></div>
        </div>
        <p className="form-hint">Get a copy of your profile, resume text, job descriptions, analyses, and applications as a JSON file.</p>
        <button className="button button-secondary" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Preparing...' : 'Download my data'}
        </button>
      </article>

      <article className="panel form-panel" style={{ marginTop: 14 }}>
        <div className="panel-heading">
          <div><p className="overline">DANGER ZONE</p><h2>Delete your account</h2></div>
        </div>
        <p className="form-hint">This permanently deletes your account, resumes, analyses, and applications. It can't be undone.</p>
        {deleteError && <div className="notice error" role="alert"><span>{deleteError}</span></div>}
        <form onSubmit={handleDelete}>
          <label className="field-label" htmlFor="confirmEmail">Type your email address to confirm</label>
          <input className="form-control" id="confirmEmail" type="email" required autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={user.email} />
          <label className="field-label" htmlFor="deletePassword">Password <span className="optional">NOT NEEDED IF YOU ONLY USE GOOGLE</span></label>
          <input className="form-control" id="deletePassword" type="password" autoComplete="current-password" maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 15 }} />
          <button className="button button-danger" type="submit" disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete my account'}
          </button>
        </form>
      </article>
    </>
  );
}
