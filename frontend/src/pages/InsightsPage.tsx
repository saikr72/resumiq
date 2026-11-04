import React from 'react';
import { PageProps } from '../types';

const GUIDANCE = [
  ['Strengthen achievement statements', 'Transform responsibility-focused bullet points into measurable accomplishments. Include performance gains, system scale and business outcomes where you have evidence.', 'RESUME IMPACT'],
  ['Demonstrate modern engineering', 'Showcase relevant work across frontend, backend, cloud infrastructure, deployment and production operations.', 'TECHNICAL POSITIONING'],
  ['Build evidence of technical ownership', 'Describe architecture decisions, API integrations, database optimisation, code quality and collaboration outcomes.', 'CAREER PROGRESSION'],
];

export default function InsightsPage(_props: PageProps) {
  return (
    <>
      <div className="page-heading">
        <p className="overline">MAKE YOUR NEXT MOVE</p>
        <h1>Career Intelligence</h1>
        <p className="subheading">Turn your experience into a strategic career advantage.</p>
      </div>
      <article className="panel career-hero">
        <span className="status-pill">✦ CAREER GUIDANCE</span>
        <h2>Your experience has a story. Make its impact visible.</h2>
        <p>Here are general areas to strengthen. Treat these as prompts for reflection, not assumptions about your qualifications.</p>
      </article>
      <div className="insight-grid">
        {GUIDANCE.map(([title, body, tag], index) => (
          <article className="panel insight-card" key={title}>
            <span className="insight-number">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
            <span className="insight-tag">{tag}</span>
          </article>
        ))}
      </div>
    </>
  );
}
