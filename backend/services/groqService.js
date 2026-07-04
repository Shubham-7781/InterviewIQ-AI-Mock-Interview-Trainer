const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/**
 * Strips markdown code fences in case the model still wraps JSON in ```json ... ```
 * (belt-and-braces on top of response_format: json_object).
 */
function cleanJson(text) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function isTransientError(err) {
  // 503 = model overloaded, 429 = rate limited — both are worth a short retry
  // before giving up and surfacing the error to the user.
  return err?.status === 503 || err?.status === 429;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askForJson(systemPrompt, userPrompt, { retries = 2, baseDelayMs = 1000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      const text = completion.choices[0]?.message?.content || "";
      return JSON.parse(cleanJson(text));
    } catch (err) {
      const isLastAttempt = attempt === retries;
      if (!isTransientError(err) || isLastAttempt) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s...
      console.warn(
        `Groq returned ${err.status} (attempt ${attempt + 1}/${retries + 1}) — retrying in ${delay}ms…`
      );
      await sleep(delay);
    }
  }
}

/**
 * Generate a set of interview questions tailored to role, domain, difficulty
 * and (optionally) the candidate's resume text for personalization.
 */
async function generateQuestions({ role, domain, difficulty, mode, resumeText, count = 5 }) {
  const system = `You are a senior technical + HR interview panelist at a top product company in India,
designing a mock interview for a final-year engineering/college student preparing for campus placements.
Always respond with ONLY valid JSON, no prose, no markdown fences.`;

  const resumeBlock = resumeText
    ? `The candidate's resume content is below. Personalize at least 2 questions to specifically probe projects,
skills, or experience mentioned in it:\n"""${resumeText.slice(0, 6000)}"""`
    : "No resume was provided. Generate strong generic questions for this role and domain.";

  const user = `
Generate ${count} interview questions for:
- Role: ${role}
- Domain/Track: ${domain}
- Interview mode: ${mode} (one of: Technical, HR/Behavioral, Case Study, Mixed)
- Difficulty: ${difficulty} (Beginner / Intermediate / Advanced)

${resumeBlock}

Return JSON in this exact shape:
{
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "type": "technical" | "behavioral" | "case_study" | "resume_based",
      "expectedPoints": ["key point interviewers look for", "..."],
      "idealTimeSeconds": 120
    }
  ]
}`;

  return askForJson(system, user);
}

/**
 * Evaluate a single answer (transcribed from speech or typed) against the
 * question's expected points. Returns structured, resume/placement-style
 * scoring feedback.
 */
async function evaluateAnswer({ question, expectedPoints, answerText, role, difficulty, fillerWordCount, speakingDurationSeconds }) {
  const system = `You are an expert interview coach evaluating a mock interview answer for a final-year student.
Be constructive, specific, and honest — the goal is genuine placement readiness, not empty praise.
Always respond with ONLY valid JSON, no prose, no markdown fences.`;

  const user = `
Role being interviewed for: ${role}
Difficulty level: ${difficulty}
Question asked: "${question}"
Key points a strong answer should cover: ${JSON.stringify(expectedPoints || [])}

Candidate's answer (transcribed): """${answerText}"""

Speech metadata: filler words detected = ${fillerWordCount ?? "unknown"}, speaking duration = ${speakingDurationSeconds ?? "unknown"} seconds.

Score the answer and return JSON in this exact shape:
{
  "scores": {
    "contentRelevance": 0-10,
    "structure": 0-10,
    "technicalAccuracy": 0-10,
    "communicationClarity": 0-10,
    "confidence": 0-10
  },
  "overallScore": 0-10,
  "strengths": ["short bullet", "short bullet"],
  "improvements": ["short actionable bullet", "short actionable bullet"],
  "starMethodUsed": true | false,
  "modelAnswerSummary": "2-3 sentence example of a strong answer's key points",
  "verdict": "one short encouraging-but-honest sentence"
}`;

  return askForJson(system, user);
}

/**
 * Synthesize a full-session report once all questions are answered.
 */
async function generateSessionReport({ role, domain, mode, difficulty, questionResults }) {
  const system = `You are an interview panel lead writing a final placement-readiness report for a student
after a mock interview. Always respond with ONLY valid JSON, no prose, no markdown fences.`;

  const user = `
Role: ${role} | Domain: ${domain} | Mode: ${mode} | Difficulty: ${difficulty}

Per-question results (question, scores, strengths, improvements):
${JSON.stringify(questionResults, null, 2)}

Return JSON in this exact shape:
{
  "overallReadinessScore": 0-100,
  "dimensionAverages": {
    "contentRelevance": 0-10,
    "structure": 0-10,
    "technicalAccuracy": 0-10,
    "communicationClarity": 0-10,
    "confidence": 0-10
  },
  "topStrengths": ["...", "..."],
  "priorityImprovements": ["...", "..."],
  "recommendedPrepPlan": ["actionable next step 1", "actionable next step 2", "actionable next step 3"],
  "summary": "3-4 sentence overall summary of performance, written directly to the candidate"
}`;

  return askForJson(system, user);
}

/**
 * Lightweight resume text extraction helper (skills/keywords) used to seed
 * personalized questions when no dedicated NLP pipeline is desired.
 */
async function extractResumeHighlights(resumeText) {
  const system = `Extract structured highlights from a student's resume. Respond with ONLY valid JSON.`;
  const user = `Resume text:\n"""${resumeText.slice(0, 6000)}"""\n
Return JSON:
{
  "skills": ["..."],
  "projects": ["short project titles"],
  "internships": ["short descriptions"],
  "suggestedRole": "most likely role this resume targets"
}`;
  return askForJson(system, user);
}

module.exports = {
  generateQuestions,
  evaluateAnswer,
  generateSessionReport,
  extractResumeHighlights,
};
