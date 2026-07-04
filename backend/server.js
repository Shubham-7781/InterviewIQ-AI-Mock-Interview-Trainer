require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const interviewRoutes = require("./routes/interview");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Basic abuse protection on the AI-calling endpoints
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use("/api/", limiter);

app.use("/api", interviewRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Serve the frontend as static files so the whole app can run from one process
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => {
  console.log(`🚀 AI Mock Interview Trainer backend running on http://localhost:${PORT}`);
  console.log(`🤖 Using Groq model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile (default — GROQ_MODEL not set in .env)"}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn("⚠️  GROQ_API_KEY is not set. Copy backend/.env.example to backend/.env and add your free key from https://console.groq.com/keys");
  }
});
