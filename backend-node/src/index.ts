import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import FormData from 'form-data';
import helmet from 'helmet';
import { authRouter, requireAuth, requireVerifiedEmail } from './auth';
import { query } from './db';
import { generateResumeSuggestions } from './llm';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Credentialed requests need an exact origin, never a wildcard
// Set to the number of proxies in front of the API, so rate limits see real client addresses
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// The frontend is on another origin, so it must be allowed to read API responses
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_TITLE_LENGTH = 150;
const INVALID_FILE_TYPE = 'INVALID_FILE_TYPE';

// Configure Multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, fieldSize: 100 * 1024 },
  fileFilter: (req, file, callback) => {
    if (/\.(pdf|docx)$/i.test(file.originalname)) {
      callback(null, true);
    } else {
      callback(new Error(INVALID_FILE_TYPE));
    }
  },
});

function receiveResume(req: express.Request, res: express.Response, next: express.NextFunction) {
  upload.single('resume')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return error.code === 'LIMIT_FILE_SIZE'
        ? res.status(413).json({ error: 'File exceeds the 10 MB upload limit' })
        : res.status(400).json({ error: 'Invalid upload' });
    }
    if (error instanceof Error && error.message === INVALID_FILE_TYPE) {
      return res.status(400).json({ error: 'Please upload a PDF or DOCX file' });
    }
    next(error);
  });
}

// A file's name is only a claim, so check its first bytes as well (a DOCX is a ZIP archive)
function hasExpectedContent(file: Express.Multer.File): boolean {
  const signature = /\.pdf$/i.test(file.originalname) ? '%PDF-' : 'PK';
  return file.buffer.subarray(0, signature.length).toString('latin1') === signature;
}

// Each analysis can call the Claude API, which costs money, so limit how many one account can run
const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have reached the hourly analysis limit. Please try again later.' },
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Resume Intelligence Node.js API Gateway',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);

// Everything below requires a signed-in user with a verified email. This runs
// before Multer, so rejected uploads are never read into memory.
app.use('/api', requireAuth, requireVerifiedEmail);

const MAX_JOB_DESCRIPTION_LENGTH = 20000;

function validateJobDescription(value: unknown, required: boolean): string | null {
  if (value === undefined || value === null || value === '') {
    return required ? 'Paste a job description to compare against' : null;
  }
  if (typeof value !== 'string' || value.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return `Job description must be ${MAX_JOB_DESCRIPTION_LENGTH} characters or fewer`;
  }
  return null;
}

// Compares a resume with a job description and saves the result
async function analyzeResume(userId: string, resumeId: string, rawText: string, jobTitle: unknown, jobDescription: string) {
  const [compareRes, aiSuggestions] = await Promise.all([
    axios.post(`${PYTHON_SERVICE_URL}/compare-keywords`, { resume_text: rawText, job_text: jobDescription }),
    generateResumeSuggestions(rawText, jobDescription),
  ]);
  const comparison = compareRes.data.comparison;

  const title = typeof jobTitle === 'string' && jobTitle.trim() ? jobTitle.trim().slice(0, 150) : 'Untitled role';
  const jobRes = await query(
    'INSERT INTO job_descriptions (user_id, company_name, job_title, raw_text) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, '', title, jobDescription]
  );

  await query(
    'INSERT INTO resume_analyses (resume_id, job_id, overall_match_score, keyword_score, semantic_score, experience_score, matched_skills, missing_skills, improvement_suggestions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      resumeId,
      jobRes.rows[0].id,
      comparison.match_percentage,
      comparison.match_percentage,
      0, 0, // Placeholder for semantic/experience
      JSON.stringify(comparison.matched_skills),
      JSON.stringify(comparison.missing_skills),
      // A failed LLM call is not a suggestion, so leave the column empty
      aiSuggestions?.error ? null : JSON.stringify(aiSuggestions),
    ]
  );

  return { comparison, aiSuggestions };
}

// GET /api/resumes - List the user's resumes with their latest match score
app.get('/api/resumes', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.title, r.file_type, r.created_at, latest.overall_match_score AS latest_score
       FROM resumes r
       LEFT JOIN LATERAL (
         SELECT overall_match_score FROM resume_analyses ra
         WHERE ra.resume_id = r.id
         ORDER BY ra.created_at DESC
         LIMIT 1
       ) latest ON true
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows.map((row) => ({ ...row, latest_score: row.latest_score === null ? null : Number(row.latest_score) })));
  } catch (error: any) {
    console.error('Get Resumes Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// DELETE /api/resumes/:id - Delete a resume, its analyses, and the job descriptions they used
app.delete('/api/resumes/:id', async (req, res) => {
  try {
    const result = await query(
      `WITH removed_jobs AS (
         DELETE FROM job_descriptions
         WHERE user_id = $2 AND id IN (
           SELECT ra.job_id FROM resume_analyses ra
           JOIN resumes r ON r.id = ra.resume_id
           WHERE ra.resume_id = $1 AND r.user_id = $2
         )
       )
       DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user!.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete Resume Error:', error.message);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

// POST /api/resumes/:id/analyses - Compare a saved resume with a job description
app.post('/api/resumes/:id/analyses', analysisLimiter, async (req, res) => {
  try {
    const { jobTitle, jobDescription } = req.body ?? {};
    const jobError = validateJobDescription(jobDescription, true);
    if (jobError) {
      return res.status(400).json({ error: jobError });
    }

    const resume = await query('SELECT raw_text FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    if (resume.rowCount === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.status(201).json(await analyzeResume(req.user!.id, req.params.id, resume.rows[0].raw_text, jobTitle, jobDescription));
  } catch (error: any) {
    console.error('Analyze Resume Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// GET /api/analyses - List the user's recent analyses
app.get('/api/analyses', async (req, res) => {
  try {
    const result = await query(
      `SELECT ra.id, ra.resume_id, r.title AS resume_title, jd.job_title, ra.overall_match_score,
              ra.matched_skills, ra.missing_skills, ra.improvement_suggestions, ra.created_at
       FROM resume_analyses ra
       JOIN resumes r ON r.id = ra.resume_id
       LEFT JOIN job_descriptions jd ON jd.id = ra.job_id
       WHERE r.user_id = $1
       ORDER BY ra.created_at DESC
       LIMIT 50`,
      [req.user!.id]
    );
    res.json(result.rows.map((row) => ({ ...row, overall_match_score: Number(row.overall_match_score) })));
  } catch (error: any) {
    console.error('Get Analyses Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

// Resume upload and parse endpoint
app.post('/api/resumes/upload', analysisLimiter, receiveResume, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    const { jobTitle, jobDescription } = req.body;
    const jobError = validateJobDescription(jobDescription, false);
    if (jobError) {
      return res.status(400).json({ error: jobError });
    }

    if (!hasExpectedContent(req.file)) {
      return res.status(400).json({ error: 'This file is not a valid PDF or DOCX document' });
    }

    // 1. Forward file to Python service for parsing
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);

    const pythonRes = await axios.post(`${PYTHON_SERVICE_URL}/parse`, formData, {
      headers: formData.getHeaders(),
      // Lets an unreadable file be reported to the user below, rather than as a server failure
      validateStatus: (status) => status < 500,
    });
    if (pythonRes.status !== 200) {
      return res.status(400).json({ error: pythonRes.data?.detail || 'We could not read this file' });
    }

    const parsedData = pythonRes.data;

    const userId = req.user!.id;
    // A shortened name keeps its extension, which the file type is taken from
    const { originalname } = req.file;
    const extension = originalname.slice(originalname.lastIndexOf('.'));
    const title = originalname.length <= MAX_TITLE_LENGTH ? originalname : originalname.slice(0, MAX_TITLE_LENGTH - extension.length) + extension;

    // 2. Save resume to DB
    const resumeInsertRes = await query(
      'INSERT INTO resumes (user_id, title, file_path, file_type, raw_text) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, title, 'uploads/' + title, title.split('.').pop()!.toLowerCase(), parsedData.raw_text]
    );
    const resumeId = resumeInsertRes.rows[0].id;

    // 3. Save parsed metadata
    await query(
      'INSERT INTO parsed_resumes (resume_id, skills) VALUES ($1, $2)',
      [resumeId, JSON.stringify(parsedData.extracted_skills)]
    );

    // 4. If a job description was provided, compare it and get LLM suggestions
    let comparison = null;
    let aiSuggestions = null;

    if (jobDescription) {
      ({ comparison, aiSuggestions } = await analyzeResume(userId, resumeId, parsedData.raw_text, jobTitle, jobDescription));
    }

    res.status(201).json({
      message: 'Resume processed successfully',
      resumeId,
      parsedSkills: parsedData.extracted_skills,
      comparison,
      aiSuggestions
    });

  } catch (error: any) {
    console.error('Upload Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to process resume', details: error.message });
  }
});

// Application Tracker Routes
// GET /api/applications - List all applications for user
app.get('/api/applications', async (req, res) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT a.*, jd.company_name as jd_company, jd.job_title as jd_title
       FROM applications a
       LEFT JOIN job_descriptions jd ON a.job_id = jd.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Get Applications Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// POST /api/applications - Create new tracked application
app.post('/api/applications', async (req, res) => {
  try {
    const userId = req.user!.id;

    const {
      resumeId,
      jobId,
      companyName,
      jobTitle,
      jobUrl,
      salaryRange,
      location,
      status,
      notes
    } = req.body;

    // The list route returns details of the linked job, so links must stay within the user's own data
    if (resumeId) {
      const owned = await query('SELECT id FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
      if (owned.rowCount === 0) {
        return res.status(404).json({ error: 'Resume not found' });
      }
    }
    if (jobId) {
      const owned = await query('SELECT id FROM job_descriptions WHERE id = $1 AND user_id = $2', [jobId, userId]);
      if (owned.rowCount === 0) {
        return res.status(404).json({ error: 'Job description not found' });
      }
    }

    const result = await query(
      `INSERT INTO applications (user_id, resume_id, job_id, company_name, job_title, job_url, salary_range, location, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, resumeId || null, jobId || null, companyName, jobTitle, jobUrl || null, salaryRange || null, location || null, status || 'SAVED', notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create Application Error:', error.message);
    res.status(500).json({ error: 'Failed to create application' });
  }
});

// PATCH /api/applications/:id - Update application
app.patch('/api/applications/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { status, notes, companyName, jobTitle, jobUrl, salaryRange, location } = req.body;

    const updates: string[] = [];
    const values: any[] = [id, userId];
    let paramIndex = 3;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (companyName !== undefined) {
      updates.push(`company_name = $${paramIndex++}`);
      values.push(companyName);
    }
    if (jobTitle !== undefined) {
      updates.push(`job_title = $${paramIndex++}`);
      values.push(jobTitle);
    }
    if (jobUrl !== undefined) {
      updates.push(`job_url = $${paramIndex++}`);
      values.push(jobUrl);
    }
    if (salaryRange !== undefined) {
      updates.push(`salary_range = $${paramIndex++}`);
      values.push(salaryRange);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(location);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `UPDATE applications SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update Application Error:', error.message);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// DELETE /api/applications/:id - Delete application
app.delete('/api/applications/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ success: true, message: 'Application deleted' });
  } catch (error: any) {
    console.error('Delete Application Error:', error.message);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

// POST /api/applications/:id/interviews - Add interview stage
app.post('/api/applications/:id/interviews', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify application belongs to user
    const appCheck = await query('SELECT id FROM applications WHERE id = $1 AND user_id = $2', [id, userId]);
    if (appCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { stageName, scheduledAt, interviewerInfo, notes } = req.body;

    const result = await query(
      `INSERT INTO interview_stages (application_id, stage_name, scheduled_at, interviewer_info, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, stageName, scheduledAt || null, interviewerInfo || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Add Interview Error:', error.message);
    res.status(500).json({ error: 'Failed to add interview' });
  }
});

// GET /api/applications/:id/interviews - Get all interview stages for an application
app.get('/api/applications/:id/interviews', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify ownership
    const appCheck = await query('SELECT id FROM applications WHERE id = $1 AND user_id = $2', [id, userId]);
    if (appCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const result = await query(
      'SELECT * FROM interview_stages WHERE application_id = $1 ORDER BY scheduled_at ASC',
      [id]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Get Interviews Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch interview stages' });
  }
});

// PATCH /api/interview_stages/:id - Update interview stage
app.patch('/api/interview_stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, stageName, scheduledAt, interviewerInfo } = req.body;

    const updates: string[] = [];
    const values: any[] = [id, req.user!.id];
    let paramIndex = 3;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (stageName !== undefined) {
      updates.push(`stage_name = $${paramIndex++}`);
      values.push(stageName);
    }
    if (scheduledAt !== undefined) {
      updates.push(`scheduled_at = $${paramIndex++}`);
      values.push(scheduledAt);
    }
    if (interviewerInfo !== undefined) {
      updates.push(`interviewer_info = $${paramIndex++}`);
      values.push(interviewerInfo);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await query(
      `UPDATE interview_stages SET ${updates.join(', ')}
       WHERE id = $1 AND application_id IN (SELECT id FROM applications WHERE user_id = $2)
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Interview stage not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update Interview Error:', error.message);
    res.status(500).json({ error: 'Failed to update interview stage' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API Server running on port ${PORT}`);
});
