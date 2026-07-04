const express = require("express");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const ai = require("../services/groqService");
const db = require("../services/db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Turns raw Groq/library errors into a message worth showing a student,
 * instead of a generic "failed" string that hides what actually happened.
 */
function friendlyErrorMessage(err, fallback) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  if (err?.status === 503) {
    return `Groq (${model}) is currently overloaded on their side. This is temporary — please try again in a few seconds, or try a different GROQ_MODEL in backend/.env.`;
  }
  if (err?.status === 429) {
    return `You've hit the free-tier rate limit for ${model}. Wait a bit, or switch GROQ_MODEL to llama-3.1-8b-instant in backend/.env (much higher daily quota).`;
  }
  if (err?.status === 401 || err?.status === 403) {
    return "Groq rejected the request — check that GROQ_API_KEY in backend/.env is correct.";
  }
  return err?.message || fallback;
}

/**
 * POST /api/resume/parse
 * Accepts a PDF resume upload, extracts raw text + AI-derived highlights.
 */
router.post("/resume/parse", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No resume file uploaded" });
    const parsed = await pdfParse(req.file.buffer);
    const resumeText = parsed.text;
    const highlights = await ai.extractResumeHighlights(resumeText);
    res.json({ resumeText, highlights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyErrorMessage(err, "Failed to parse resume") });
  }
});

/**
 * POST /api/questions
 * body: { role, domain, difficulty, mode, resumeText?, count? }
 */
router.post("/questions", async (req, res) => {
  try {
    const { role, domain, difficulty, mode, resumeText, count } = req.body;
    if (!role || !domain || !difficulty || !mode) {
      return res.status(400).json({ error: "role, domain, difficulty and mode are required" });
    }
    const result = await ai.generateQuestions({ role, domain, difficulty, mode, resumeText, count });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyErrorMessage(err, "Failed to generate questions") });
  }
});

/**
 * POST /api/evaluate
 * body: { question, expectedPoints, answerText, role, difficulty, fillerWordCount, speakingDurationSeconds }
 */
router.post("/evaluate", async (req, res) => {
  try {
    const evaluation = await ai.evaluateAnswer(req.body);
    res.json(evaluation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyErrorMessage(err, "Failed to evaluate answer") });
  }
});

/**
 * POST /api/report
 * body: { role, domain, mode, difficulty, questionResults }
 * Also persists the session to history for the analytics dashboard.
 */
router.post("/report", async (req, res) => {
  try {
    const { role, domain, mode, difficulty, questionResults, studentName } = req.body;
    const report = await ai.generateSessionReport({ role, domain, mode, difficulty, questionResults });

    const data = db.read();
    const session = {
      id: uuidv4(),
      studentName: studentName || "Candidate",
      role,
      domain,
      mode,
      difficulty,
      createdAt: new Date().toISOString(),
      questionResults,
      report,
    };
    data.sessions.unshift(session);
    db.write(data);

    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyErrorMessage(err, "Failed to generate report") });
  }
});

/**
 * GET /api/history
 * Returns all past sessions (most recent first) for the analytics dashboard.
 */
router.get("/history", (req, res) => {
  const data = db.read();
  res.json({ sessions: data.sessions });
});

/**
 * GET /api/history/:id
 */
router.get("/history/:id", (req, res) => {
  const data = db.read();
  const session = data.sessions.find((s) => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({ session });
});

/**
 * DELETE /api/history/:id
 */
router.delete("/history/:id", (req, res) => {
  const data = db.read();
  data.sessions = data.sessions.filter((s) => s.id !== req.params.id);
  db.write(data);
  res.json({ success: true });
});

module.exports = router;
