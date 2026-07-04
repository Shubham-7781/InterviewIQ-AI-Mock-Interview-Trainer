# InterviewIQ — AI Mock Interview Trainer

An AI-powered mock interview platform built for final-year students preparing for campus placements.
Pick a role, answer questions out loud (or by typing), and get panel-style AI feedback across five
scoring dimensions — plus a readiness report and a progress dashboard across sessions.

> Built as a placement-portfolio project. Full-stack, uses a real LLM (Groq — free tier, ultra-fast inference) for question generation
> and answer evaluation — not a canned question bank.

---

## ✨ Features

- **Role & domain-based question generation** — SDE, Data Analyst, ML Engineer, Frontend/Backend, PM
  intern, QA, DevOps, etc., across DSA, Web Dev, DBMS, OS/CN, ML, System Design, or HR/Behavioral.
- **Resume-aware personalization** — upload a PDF resume; the AI extracts skills/projects and weaves
  at least two questions around your *actual* experience instead of generic prompts.
- **Voice-based interview simulation** — real speech-to-text answer capture via the Web Speech API,
  with a live transcript and a mic-volume visualizer ring (or type your answer instead).
- **Text-to-speech question narration** for a more realistic, hands-free interview feel.
- **5-dimension AI scoring per answer** — content relevance, structure, technical accuracy,
  communication clarity, and confidence — plus filler-word detection and STAR-method detection.
- **Actionable feedback, not just a number** — strengths, improvement points, and a model-answer
  summary generated per question.
- **Session readiness report** — an overall 0–100 readiness score, a radar chart of skill dimensions,
  a prep plan, and a full question-by-question breakdown. Exportable via the browser's print-to-PDF.
- **Progress dashboard** — session history, average score, best/weakest dimension, and a score trend
  chart across every mock interview you've taken.
- **Configurable difficulty & interview mode** (Technical / HR / Case Study / Mixed, Beginner→Advanced).
- **Runs as one process** — the Express server also serves the frontend, so there's a single `npm start`.

---

## 🧱 Tech Stack

| Layer          | Tech |
|----------------|------|
| Frontend       | Vanilla JavaScript (no framework build step), HTML5, CSS3, [Chart.js](https://www.chartjs.org/) |
| Speech         | Web Speech API (`SpeechRecognition` + `SpeechSynthesis`), Web Audio API (mic volume analysis) |
| Backend        | Node.js, Express |
| AI             | [Groq API](https://console.groq.com) (`groq-sdk`), free tier (`llama-3.3-70b-versatile`) — question generation, answer evaluation, report synthesis, resume parsing |
| File handling  | Multer (resume upload), `pdf-parse` (resume text extraction) |
| Persistence    | Lightweight JSON-file datastore (swappable for MongoDB/Postgres — single interface in `services/db.js`) |
| Security       | `express-rate-limit` on all AI-calling endpoints, `dotenv` for secrets |

**Why this stack for a placement project:** it demonstrates full-stack ownership (REST API design,
third-party LLM integration, browser media APIs, file upload/parsing, and state-driven frontend
architecture) without hiding the interesting parts behind a heavy framework.

---

## 🗂️ Project Structure

```
ai-mock-interview-trainer/
├── backend/
│   ├── server.js                # Express entrypoint, serves API + static frontend
│   ├── routes/interview.js      # /api/questions, /api/evaluate, /api/report, /api/history, /api/resume/parse
│   ├── services/groqService.js  # All prompt engineering + Groq API calls live here
│   ├── services/db.js           # JSON-file datastore (read/write interface)
│   ├── data/db.json             # Session history storage
│   └── .env.example
├── frontend/
│   ├── index.html               # Single-page app shell (setup / interview / report / dashboard views)
│   ├── css/style.css            # Design system (tokens, layout, components)
│   └── js/
│       ├── api.js               # fetch() wrapper for the backend
│       ├── speech.js            # SpeechRecognition / SpeechSynthesis / mic volume analyser
│       ├── charts.js            # Chart.js radar + trend chart helpers
│       └── app.js               # App state machine wiring everything together
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js ≥ 18
- A free [Groq API key](https://console.groq.com/keys) (no credit card required)
- Google Chrome or Edge recommended (best `SpeechRecognition` support)

> **Free tier note:** `llama-3.3-70b-versatile` (the default model) is free with 1,000 requests/day —
> plenty for a demo/portfolio project. If you hit rate limits during heavy testing, switch `GROQ_MODEL` in
> `.env` to `llama-3.1-8b-instant`, which has a much higher free daily quota (14,400 requests/day) at a
> slight quality tradeoff.

### 2. Backend setup
```bash
cd backend
npm install
cp .env.example .env
# then edit .env and paste your GROQ_API_KEY
npm start
```

### 3. Open the app
The Express server serves the frontend directly — just visit:
```
http://localhost:5000
```
(No separate frontend server or build step needed.)

---

## 🔌 API Reference

| Method | Endpoint                | Description |
|--------|--------------------------|--------------|
| GET    | `/api/health`            | Server + readiness check |
| POST   | `/api/resume/parse`      | Upload a PDF resume → extracted text + AI-derived skill highlights |
| POST   | `/api/questions`         | Generate interview questions for a role/domain/difficulty/mode |
| POST   | `/api/evaluate`          | Score a single answer against the question's expected points |
| POST   | `/api/report`            | Synthesize a full session report and persist it to history |
| GET    | `/api/history`           | List all past interview sessions |
| GET    | `/api/history/:id`       | Fetch one session |
| DELETE | `/api/history/:id`       | Delete a session |

---

## 🧭 How it works

1. **Setup** — choose role, domain, mode, difficulty, and optionally upload your resume.
2. **Question generation** — the backend prompts Groq with your selections (and resume text, if
   provided) to generate a structured question set, each tagged with its type and expected talking points.
3. **Answer capture** — for each question, speak your answer (live transcript + mic visualizer) or type it.
4. **Evaluation** — the transcript, filler-word count, and speaking duration are sent to Groq, which
   returns structured JSON scores across five dimensions plus qualitative feedback.
5. **Report** — once all questions are answered, Groq synthesizes an overall readiness score, a
   skill-dimension breakdown, strengths/improvements, and a prep plan. The session is saved to history.
6. **Dashboard** — tracks readiness score trends and per-dimension averages across every session.

---

## 🛣️ Possible Extensions

- Swap the JSON datastore for MongoDB/Postgres and add user auth for multi-student deployments.
- Add facial expression / eye-contact analysis via a webcam feed for non-verbal feedback.
- Peer-review mode: share a session link so a mentor can leave comments on top of the AI feedback.
- Company-specific question banks (scraped or curated) blended with the AI-generated set.

---

## 📄 License

MIT — free to use and adapt for your own placement prep or portfolio.
