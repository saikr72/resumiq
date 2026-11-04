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
    4. Rewrite 2 existing bullet points from the resume to better align with the job description using the Action-Context-Result formula.

    FORMAT:
    Return the response as a JSON object with the following structure:
    {
      "summary": "Short overview of match",
      "critical_missing_skills": ["skill1", "skill2"],
      "actionable_suggestions": ["suggestion1", "suggestion2"],
      "optimized_bullet_points": [
        { "original": "...", "optimized": "..." }
      ]
    }
  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract JSON from response
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
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
