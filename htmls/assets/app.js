(() => {
  const $ = (selector, scope=document) => scope.querySelector(selector);
  const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
  const pageNames = Object.fromEntries($$('.page').map(p => [p.id.replace('page-',''), p.dataset.title]));
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function navigate(page) {
    if (!pageNames[page]) return;
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    $('#currentPageName').textContent = pageNames[page];
    history.replaceState(null, '', `#${page}`);
    $('#sidebar').classList.remove('open');
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function safeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[char]);
  }
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-page]');
    if (nav) { event.preventDefault(); navigate(nav.dataset.page); return; }
    const jump = event.target.closest('[data-navigate]');
    if (jump) { navigate(jump.dataset.navigate); return; }
    const toastButton = event.target.closest('[data-toast]');
    if (toastButton) toast(toastButton.dataset.toast);
  });
  $('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'dashboard'));
  const initialPage = location.hash.slice(1);
  if (pageNames[initialPage]) navigate(initialPage);

  $('#builderForm').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#resumeTitle').value.trim();
    const role = $('#targetRole').value.trim();
    const notes = $('#resumeNotes').value.trim();
    const output = $('#draftOutput');
    output.classList.remove('hidden');
    output.innerHTML = `<strong>Resume draft brief created</strong><p><b>Document:</b> ${safeText(title)}<br><b>Target role:</b> ${safeText(role)}</p><p>${safeText(notes)}</p><p class="form-hint">This frontend captures your content brief. Connect an AI language model to generate, edit and refine a complete resume.</p>`;
    toast('Draft brief prepared.');
  });

  const fileInput = $('#resumeFile');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    $('#fileStatus').textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'No file selected';
  });
  $('#analyzeButton').addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) return toast('Please select a PDF or DOCX resume first.');
    if (file.size > 10 * 1024 * 1024) return toast('File exceeds the 10 MB upload limit.');
    const allowed = /\.(pdf|docx?)$/i.test(file.name);
    if (!allowed) return toast('Please choose a PDF or DOCX file.');
    const role = $('#analysisRole').value.trim();
    const output = $('#analysisOutput');
    output.classList.remove('hidden');
    output.innerHTML = `<strong>Resume selected and ready for analysis</strong><p>${safeText(file.name)}${role ? ` · Target role: ${safeText(role)}` : ''}</p><p>The file is selected in your browser. Connect document extraction and the AI analysis API to calculate real ATS, content and keyword insights.</p>`;
    toast('Resume file validated.');
  });

  $('#matchingForm').addEventListener('submit', event => {
    event.preventDefault();
    const role = $('#matchRole').value.trim();
    const description = $('#jobDescription').value.trim();
    const output = $('#matchOutput');
    output.classList.remove('hidden');
    output.innerHTML = `<strong>Job matching brief prepared</strong><p><b>Target role:</b> ${safeText(role)}<br><b>Resume:</b> ${safeText($('#matchResume').value)}<br><b>Description length:</b> ${description.length} characters</p><p>A real compatibility score requires extracting resume content and comparing skills, experience and job requirements with the matching service.</p>`;
    toast('Job description captured.');
  });

  $('#addApplication').addEventListener('click', () => {
    const title = prompt('Enter the job title:');
    if (!title || !title.trim()) return;
    const company = prompt('Enter the company name (optional):') || 'Company not specified';
    const row = document.createElement('div');
    row.className = 'job-row';
    const details = document.createElement('div');
    const name = document.createElement('strong');
    const meta = document.createElement('span');
    name.textContent = title.trim();
    meta.textContent = `${company.trim()} · Added just now`;
    details.append(name, meta);
    const status = document.createElement('span');
    status.className = 'application-status applied';
    status.textContent = 'Added';
    row.append(details, status);
    $('#applicationList').prepend(row);
    toast('Application added to this session.');
  });

  // Search filters the visible resume/job rows as a lightweight frontend utility.
  const search = $('.global-search input');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    const rows = $$('.resume-row, .job-row');
    rows.forEach(row => row.style.display = !query || row.textContent.toLowerCase().includes(query) ? '' : 'none');
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape') $('#sidebar').classList.remove('open');
  });
})();