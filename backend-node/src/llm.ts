import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateResumeSuggestions(resumeText: string, jobDescription: string) {
  const prompt = `
    You are an expert ATS (Applicant Tracking System) optimizer and career coach.

    RESUME TEXT:
    ${resumeText}

    JOB DESCRIPTION:
    ${jobDescription}

    TASK:
    1. Analyze the alignment between the resume and the job description.
    2. Identify critical missing keywords and skills.
    3. Provide 3-5 specific, actionable suggestions to improve the resume for this specific role.
    4. Rewrite 2 existing bullet points from the resume to better align with the job description using the Action-Context-Result formula. Use only facts stated in the resume. Do not add tools, numbers, responsibilities, or outcomes the resume doesn't state, because the candidate may submit these rewrites as written.
    5. Describe the match in words only. Do not give a percentage or numeric score, because the app calculates its own match score and the two could be confused.
    6. In "notes", tell the candidate anything they should confirm or add before using these suggestions. Use an empty string if there is nothing to add.

    FORMAT:
    Return the response as a JSON object with the following structure:
    {
      "summary": "Short overview of match",
      "critical_missing_skills": ["skill1", "skill2"],
      "actionable_suggestions": ["suggestion1", "suggestion2"],
      "optimized_bullet_points": [
        { "original": "...", "optimized": "..." }
      ],
      "notes": "What to confirm before using these suggestions"
    }
  `;

  try {
    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      // Thinking is always on for this model and counts towards this limit
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // If a safety classifier declines the request, the API retries it on another model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      console.error('LLM Suggestion Error: response ended early:', response.stop_reason);
      return { error: "LLM service unavailable" };
    }

    // Extract JSON from response. The first content block may be thinking rather than text.
    const textBlock = response.content.find((block) => block.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: "Failed to parse LLM response" };
  } catch (error: any) {
    console.error('LLM Suggestion Error:', error.message);
    return { error: "LLM service unavailable" };
  }
}
