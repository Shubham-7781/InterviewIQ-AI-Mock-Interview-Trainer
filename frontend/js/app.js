/* ============================================================
   GLOBAL STATE
   ============================================================ */
const state = {
  studentName: "",
  role: "",
  domain: "",
  mode: "",
  difficulty: "",
  resumeText: "",
  questions: [],
  currentIndex: 0,
  questionResults: [],
  isRecording: false,
  isTypeMode: false,
  timerInterval: null,
  timeLeft: 0,
  currentTranscript: "",
};

/* ============================================================
   NAVIGATION
   ============================================================ */
const views = document.querySelectorAll(".view");
const navBtns = document.querySelectorAll(".panel-nav__btn");

function goTo(viewKey) {
  views.forEach((v) => v.classList.toggle("is-active", v.id === `view-${viewKey}`));
  navBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.nav === viewKey));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (viewKey === "dashboard") loadDashboard();
}

navBtns.forEach((btn) => btn.addEventListener("click", () => goTo(btn.dataset.nav)));

/* ============================================================
   API HEALTH INDICATOR
   ============================================================ */
async function checkApiHealth() {
  const dot = document.getElementById("apiDot");
  const text = document.getElementById("apiStatusText");
  try {
    await Api.health();
    dot.classList.add("is-ok");
    text.textContent = "API connected";
  } catch (e) {
    dot.classList.add("is-error");
    text.textContent = "API offline — start the backend";
  }
}
checkApiHealth();

/* ============================================================
   SETUP VIEW
   ============================================================ */
const resumeBtn = document.getElementById("resumeBtn");
const resumeInput = document.getElementById("resumeInput");
const resumeFilename = document.getElementById("resumeFilename");
let resumeFile = null;

resumeBtn.addEventListener("click", () => resumeInput.click());
resumeInput.addEventListener("change", () => {
  resumeFile = resumeInput.files[0] || null;
  resumeFilename.textContent = resumeFile ? `Selected: ${resumeFile.name}` : "";
});

document.getElementById("setupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideOverlay();
  const form = new FormData(e.target);
  state.studentName = form.get("studentName");
  state.role = form.get("role");
  state.domain = form.get("domain");
  state.mode = form.get("mode");
  state.difficulty = form.get("difficulty");
  const count = Number(form.get("count")) || 5;

  const startBtn = document.getElementById("startBtn");
  startBtn.disabled = true;
  startBtn.textContent = "Preparing your interview…";

  try {
    if (resumeFile) {
      startBtn.textContent = "Reading your resume…";
      const { resumeText } = await Api.parseResume(resumeFile);
      state.resumeText = resumeText;
    }

    startBtn.textContent = "Generating panel questions…";
    const { questions } = await Api.getQuestions({
      role: state.role,
      domain: state.domain,
      difficulty: state.difficulty,
      mode: state.mode,
      resumeText: state.resumeText,
      count,
    });

    state.questions = questions;
    state.currentIndex = 0;
    state.questionResults = [];

    renderProgressList();
    goTo("interview");
    loadQuestion(0);
  } catch (err) {
    alert(`Something went wrong: ${err.message}\n\nMake sure the backend is running and GROQ_API_KEY is set correctly in backend/.env.`);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Start mock interview";
  }
});

/* ============================================================
   INTERVIEW VIEW
   ============================================================ */
const questionText = document.getElementById("questionText");
const questionCounter = document.getElementById("questionCounter");
const questionType = document.getElementById("questionType");
const timerDisplay = document.getElementById("timerDisplay");
const micButton = document.getElementById("micButton");
const micStatus = document.getElementById("micStatus");
const micProgressBar = document.getElementById("micProgressBar");
const transcriptBox = document.getElementById("transcriptBox");
const transcriptText = document.getElementById("transcriptText");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const toggleTypeMode = document.getElementById("toggleTypeMode");
const typeAnswerBox = document.getElementById("typeAnswerBox");
const typeAnswerText = document.getElementById("typeAnswerText");
const listenQuestionBtn = document.getElementById("listenQuestionBtn");
const tipText = document.getElementById("tipText");
const evalOverlay = document.getElementById("evalOverlay");
const evalSpinner = document.getElementById("evalSpinner");
const evalOverlayText = document.getElementById("evalOverlayText");
const evalOverlayActions = document.getElementById("evalOverlayActions");
const evalRetryBtn = document.getElementById("evalRetryBtn");
const evalCancelBtn = document.getElementById("evalCancelBtn");

const TIPS = [
  "Structure answers with the STAR method — Situation, Task, Action, Result.",
  "State your final answer or conclusion first, then explain your reasoning.",
  "For technical questions, mention time & space complexity where relevant.",
  "Quantify impact wherever possible — numbers make answers memorable.",
  "It's fine to pause and think for 2-3 seconds before answering out loud.",
  "Tie answers back to a real project from your resume when you can.",
];

const MIC_CIRCUMFERENCE = 2 * Math.PI * 54;

/**
 * Generic overlay controller reused for both answer-scoring and report
 * generation. Shows a spinner while `task` runs; on timeout/error it swaps
 * to a "try again / cancel" state instead of spinning forever.
 */
function showOverlayLoading(message) {
  evalOverlay.hidden = false;
  evalOverlay.style.display = "flex";
  evalSpinner.style.display = "";
  evalOverlayText.textContent = message;
  evalOverlayActions.hidden = true;
  evalOverlayActions.style.display = "none";
}

function showOverlayError(message) {
  evalSpinner.style.display = "none";
  evalOverlayText.textContent = message;
  evalOverlayActions.hidden = false;
  evalOverlayActions.style.display = "flex";
}

function hideOverlay() {
  evalOverlay.hidden = true;
  evalOverlay.style.display = "none";
  evalOverlayActions.hidden = true;
  evalOverlayActions.style.display = "none";
  evalSpinner.style.display = "";
}

/**
 * Runs an async task behind the overlay. On failure, shows a retry/cancel
 * prompt instead of a bare alert(); wires the Retry button to re-run the
 * same task, and Cancel to run the provided onCancel callback.
 */
function runWithOverlay({ loadingMessage, task, onSuccess, onCancel }) {
  const attempt = async () => {
    showOverlayLoading(loadingMessage);
    try {
      const result = await task();
      hideOverlay();
      onSuccess(result);
    } catch (err) {
      const friendly = err.isTimeout
        ? err.message
        : `Something went wrong: ${err.message}`;
      showOverlayError(friendly);
      evalRetryBtn.onclick = attempt;
      evalCancelBtn.onclick = () => {
        hideOverlay();
        if (onCancel) onCancel();
      };
    }
  };
  attempt();
}

function renderProgressList() {
  const list = document.getElementById("progressList");
  list.innerHTML = "";
  state.questions.forEach((q, i) => {
    const li = document.createElement("li");
    li.dataset.idx = i;
    li.innerHTML = `<span class="num">${i + 1}</span><span>${q.type.replace("_", " ")}</span>`;
    list.appendChild(li);
  });
  updateProgressList();
}

function updateProgressList() {
  document.querySelectorAll("#progressList li").forEach((li) => {
    const idx = Number(li.dataset.idx);
    li.classList.toggle("is-done", idx < state.currentIndex);
    li.classList.toggle("is-current", idx === state.currentIndex);
  });
}

function loadQuestion(index) {
  hideOverlay();
  const q = state.questions[index];
  state.currentTranscript = "";
  state.isRecording = false;

  questionText.textContent = q.question;
  questionCounter.textContent = `Question ${index + 1} of ${state.questions.length}`;
  questionType.textContent = q.type.replace("_", " ");
  tipText.textContent = TIPS[index % TIPS.length];

  transcriptBox.hidden = true;
  transcriptText.textContent = "";
  typeAnswerBox.hidden = true;
  typeAnswerText.value = "";
  state.isTypeMode = false;
  toggleTypeMode.textContent = "or type your answer instead";
  micButton.parentElement.style.display = "flex";

  submitAnswerBtn.disabled = true;
  micButton.classList.remove("is-recording");
  micStatus.textContent = "Tap the mic to speak your answer";
  micProgressBar.style.strokeDashoffset = MIC_CIRCUMFERENCE;

  updateProgressList();
  startTimer(q.idealTimeSeconds || 120);
}

function startTimer(seconds) {
  clearInterval(state.timerInterval);
  state.timeLeft = seconds;
  renderTimer();
  state.timerInterval = setInterval(() => {
    state.timeLeft -= 1;
    renderTimer();
    if (state.timeLeft <= 0) clearInterval(state.timerInterval);
  }, 1000);
}

function renderTimer() {
  const m = Math.max(0, Math.floor(state.timeLeft / 60));
  const s = Math.max(0, state.timeLeft % 60);
  timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  timerDisplay.classList.toggle("is-calm", state.timeLeft > 30 || state.timeLeft <= 0);
}

// Mic recording
micButton.addEventListener("click", async () => {
  if (!state.isRecording) {
    state.isRecording = true;
    micButton.classList.add("is-recording");
    micStatus.textContent = "Listening… tap again to stop";
    transcriptBox.hidden = false;
    submitAnswerBtn.disabled = true;

    await Speech.start(
      (liveText) => { transcriptText.textContent = liveText; state.currentTranscript = liveText; },
      (volume) => {
        const offset = MIC_CIRCUMFERENCE * (1 - Math.min(1, 0.15 + volume));
        micProgressBar.style.strokeDashoffset = offset;
      }
    );

    if (!Speech.supported) {
      micStatus.textContent = "Voice-to-text isn't supported in this browser — try Chrome, or type your answer.";
    }
  } else {
    const result = Speech.stop();
    state.isRecording = false;
    micButton.classList.remove("is-recording");
    micProgressBar.style.strokeDashoffset = MIC_CIRCUMFERENCE;
    state.currentTranscript = result.transcript;
    state._lastFillerCount = result.fillerWordCount;
    state._lastDuration = result.durationSeconds;
    transcriptText.textContent = result.transcript || "(No speech detected — try again or type your answer)";
    micStatus.textContent = "Tap the mic to re-record, or submit below";
    submitAnswerBtn.disabled = result.transcript.trim().length === 0;
  }
});

toggleTypeMode.addEventListener("click", () => {
  state.isTypeMode = !state.isTypeMode;
  typeAnswerBox.hidden = !state.isTypeMode;
  micButton.parentElement.style.display = state.isTypeMode ? "none" : "flex";
  transcriptBox.hidden = true;
  toggleTypeMode.textContent = state.isTypeMode ? "or use your microphone instead" : "or type your answer instead";
  submitAnswerBtn.disabled = state.isTypeMode ? typeAnswerText.value.trim().length === 0 : true;
});

typeAnswerText.addEventListener("input", () => {
  submitAnswerBtn.disabled = typeAnswerText.value.trim().length === 0;
});

listenQuestionBtn.addEventListener("click", () => {
  const q = state.questions[state.currentIndex];
  listenQuestionBtn.disabled = true;
  listenQuestionBtn.textContent = "🔊 Reading…";
  Speech.speak(q.question, {
    onEnd: () => {
      listenQuestionBtn.disabled = false;
      listenQuestionBtn.textContent = "🔊 Read question aloud";
    },
  });
});

submitAnswerBtn.addEventListener("click", () => {
  const q = state.questions[state.currentIndex];
  const answerText = state.isTypeMode ? typeAnswerText.value.trim() : state.currentTranscript.trim();
  if (!answerText) return;

  clearInterval(state.timerInterval);

  runWithOverlay({
    loadingMessage: "Scoring your answer against panel expectations…",
    task: () =>
      Api.evaluateAnswer({
        question: q.question,
        expectedPoints: q.expectedPoints,
        answerText,
        role: state.role,
        difficulty: state.difficulty,
        fillerWordCount: state.isTypeMode ? 0 : state._lastFillerCount,
        speakingDurationSeconds: state.isTypeMode ? null : state._lastDuration,
      }),
    onSuccess: (evaluation) => {
      state.questionResults.push({
        question: q.question,
        type: q.type,
        answerText,
        ...evaluation,
      });

      const nextIndex = state.currentIndex + 1;
      if (nextIndex < state.questions.length) {
        state.currentIndex = nextIndex;
        loadQuestion(nextIndex);
      } else {
        finishInterview();
      }
    },
    onCancel: () => {
      // Leave the answer in place so the student can just hit Submit again
      // (e.g. after switching GROQ_MODEL or waiting out a rate limit).
    },
  });
});

async function finishInterview() {
  runWithOverlay({
    loadingMessage: "Generating your final readiness report…",
    task: () =>
      Api.generateReport({
        studentName: state.studentName,
        role: state.role,
        domain: state.domain,
        mode: state.mode,
        difficulty: state.difficulty,
        questionResults: state.questionResults,
      }),
    onSuccess: ({ session }) => {
      renderReport(session);
      goTo("report");
    },
    onCancel: () => {
      // Stay on the interview view; the student's answers/scores are kept
      // in state, so they can hit Submit on the last question again.
    },
  });
}

/* ============================================================
   REPORT VIEW
   ============================================================ */
function renderReport(session) {
  const { report, role, domain, mode, questionResults } = session;

  document.getElementById("reportOverallScore").textContent = `${report.overallReadinessScore}/100`;
  document.getElementById("reportSubtitle").textContent = `${role} · ${domain} · ${mode}`;
  document.getElementById("reportSummaryText").textContent = report.summary;

  Charts.renderRadar("radarChart", report.dimensionAverages);

  const strengthsEl = document.getElementById("reportStrengths");
  strengthsEl.innerHTML = report.topStrengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  const improvementsEl = document.getElementById("reportImprovements");
  improvementsEl.innerHTML = report.priorityImprovements.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  const prepPlanEl = document.getElementById("reportPrepPlan");
  prepPlanEl.innerHTML = report.recommendedPrepPlan.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  const breakdownEl = document.getElementById("questionBreakdownList");
  breakdownEl.innerHTML = questionResults.map((qr, i) => `
    <div class="qb-item">
      <div class="qb-item__head">
        <p class="qb-item__q">Q${i + 1}. ${escapeHtml(qr.question)}</p>
        <span class="qb-item__score">${qr.overallScore}/10</span>
      </div>
      <p class="qb-item__verdict">${escapeHtml(qr.verdict)}</p>
      <div class="qb-dims">
        <span class="qb-dim">Content ${qr.scores.contentRelevance}</span>
        <span class="qb-dim">Structure ${qr.scores.structure}</span>
        <span class="qb-dim">Technical ${qr.scores.technicalAccuracy}</span>
        <span class="qb-dim">Clarity ${qr.scores.communicationClarity}</span>
        <span class="qb-dim">Confidence ${qr.scores.confidence}</span>
        ${qr.starMethodUsed ? '<span class="qb-dim">✓ STAR method</span>' : ""}
      </div>
    </div>
  `).join("");
}

document.getElementById("downloadReportBtn").addEventListener("click", () => window.print());
document.getElementById("retakeBtn").addEventListener("click", () => {
  document.getElementById("setupForm").reset();
  resumeFile = null;
  resumeFilename.textContent = "";
  state.resumeText = "";
  goTo("setup");
});
document.getElementById("goDashboardBtn").addEventListener("click", () => goTo("dashboard"));

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   DASHBOARD VIEW
   ============================================================ */
async function loadDashboard() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = `<p class="empty-state">Loading history…</p>`;

  try {
    const { sessions } = await Api.getHistory();

    document.getElementById("statSessions").textContent = sessions.length;

    if (sessions.length === 0) {
      historyList.innerHTML = `<p class="empty-state">No sessions yet — complete a mock interview to see it here.</p>`;
      document.getElementById("statAvgScore").textContent = "—";
      document.getElementById("statBestDim").textContent = "—";
      document.getElementById("statFocusDim").textContent = "—";
      Charts.renderTrend("trendChart", []);
      return;
    }

    const avgScore = Math.round(
      sessions.reduce((sum, s) => sum + (s.report?.overallReadinessScore || 0), 0) / sessions.length
    );
    document.getElementById("statAvgScore").textContent = avgScore;

    const dimTotals = { contentRelevance: 0, structure: 0, technicalAccuracy: 0, communicationClarity: 0, confidence: 0 };
    sessions.forEach((s) => {
      Object.keys(dimTotals).forEach((k) => { dimTotals[k] += s.report?.dimensionAverages?.[k] || 0; });
    });
    const dimAverages = Object.fromEntries(Object.entries(dimTotals).map(([k, v]) => [k, v / sessions.length]));
    const sorted = Object.entries(dimAverages).sort((a, b) => b[1] - a[1]);
    document.getElementById("statBestDim").textContent = labelForDim(sorted[0][0]);
    document.getElementById("statFocusDim").textContent = labelForDim(sorted[sorted.length - 1][0]);

    Charts.renderTrend("trendChart", sessions);

    historyList.innerHTML = sessions.map((s) => {
      const score = s.report?.overallReadinessScore ?? 0;
      const scoreClass = score >= 75 ? "" : score >= 50 ? "is-mid" : "is-low";
      return `
        <div class="history-item">
          <div class="history-item__score ${scoreClass}">${score}</div>
          <div class="history-item__body">
            <p class="history-item__title">${escapeHtml(s.role)} · ${escapeHtml(s.mode)}</p>
            <p class="history-item__meta">${escapeHtml(s.domain)} · ${escapeHtml(s.difficulty)} · ${s.questionResults.length} questions</p>
          </div>
          <span class="history-item__date">${new Date(s.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          <button class="history-item__del" data-id="${s.id}">Delete</button>
        </div>
      `;
    }).join("");

    historyList.querySelectorAll(".history-item__del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await Api.deleteSession(btn.dataset.id);
        loadDashboard();
      });
    });
  } catch (err) {
    historyList.innerHTML = `<p class="empty-state">Couldn't load history: ${escapeHtml(err.message)}</p>`;
  }
}

function labelForDim(key) {
  const map = {
    contentRelevance: "Content relevance",
    structure: "Structure",
    technicalAccuracy: "Technical accuracy",
    communicationClarity: "Communication clarity",
    confidence: "Confidence",
  };
  return map[key] || key;
}
