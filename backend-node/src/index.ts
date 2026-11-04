import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { query } from './db';
import { generateResumeSuggestions } from './llm';

dotenv.config();
// ... (rest of the setup remains same)
const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

app.use(cors());
app.use(express.json());

// Configure Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Ensure a test user exists
async function ensureTestUser() {
  const res = await query('SELECT id FROM users LIMIT 1');
  if (res.rowCount === 0) {
    await query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)',
      ['test@example.com', 'hashed_password', 'Test User']
    );
    console.log('Test user created');
  }
}

ensureTestUser().catch(console.error);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Resume Intelligence Node.js API Gateway',
    timestamp: new Date().toISOString()
  });
});

// Resume upload and parse endpoint
app.post('/api/resumes/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    const { jobDescription } = req.body;

    // 1. Forward file to Python service for parsing
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);

    const pythonRes = await axios.post(`${PYTHON_SERVICE_URL}/parse`, formData, {
      headers: formData.getHeaders(),
    });

    const parsedData = pythonRes.data;

    // 2. Get the test user ID
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;

    // 3. Save resume to DB
    const resumeInsertRes = await query(
      'INSERT INTO resumes (user_id, title, file_path, file_type, raw_text) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, req.file.originalname, 'uploads/' + req.file.originalname, req.file.originalname.split('.').pop(), parsedData.raw_text]
    );
    const resumeId = resumeInsertRes.rows[0].id;

    // 4. Save parsed metadata
    await query(
      'INSERT INTO parsed_resumes (resume_id, skills) VALUES ($1, $2)',
      [resumeId, JSON.stringify(parsedData.extracted_skills)]
    );

    // 5. If job description provided, perform initial keyword comparison AND LLM suggestions
    let comparison = null;
    let aiSuggestions = null;

    if (jobDescription) {
      // Run comparison and LLM suggestions in parallel
      const [compareRes, suggestions] = await Promise.all([
        axios.post(`${PYTHON_SERVICE_URL}/compare-keywords`, {
          resume_text: parsedData.raw_text,
          job_text: jobDescription
        }),
        generateResumeSuggestions(parsedData.raw_text, jobDescription)
      ]);

      comparison = compareRes.data.comparison;
      aiSuggestions = suggestions;

      // Save analysis to DB
      await query(
        'INSERT INTO resume_analyses (resume_id, overall_match_score, keyword_score, semantic_score, experience_score, matched_skills, missing_skills, improvement_suggestions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          resumeId,
          comparison.match_percentage,
          comparison.match_percentage,
          0, 0, // Placeholder for semantic/experience
          JSON.stringify(comparison.matched_skills),
          JSON.stringify(comparison.missing_skills),
          JSON.stringify(aiSuggestions)
        ]
      );
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
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;

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
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;

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
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;
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
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;
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
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;
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
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;
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
    const values: any[] = [id];
    let paramIndex = 2;

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
      `UPDATE interview_stages SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
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
