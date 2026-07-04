const API_BASE = "/api";

// AI-calling endpoints can occasionally hang on the free Groq tier
// (rate limits, cold starts, or just a slow response). These timeouts stop
// the UI from spinning forever and let the caller offer a retry instead.
const TIMEOUT_MS = {
  questions: 35000,
  evaluate: 25000,
  report: 30000,
  resume: 25000,
  default: 15000,
};

/**
 * fetch() wrapper with a hard timeout via AbortController.
 * Throws an error with `.isTimeout = true` when the timeout fires, so callers
 * can show a distinct "this is taking too long" message with a retry option.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS.default) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      const timeoutErr = new Error(
        `This is taking longer than expected (over ${Math.round(timeoutMs / 1000)}s). The AI service may be rate-limited or slow right now.`
      );
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

const Api = {
  async health() {
    const r = await fetchWithTimeout(`${API_BASE}/health`, {}, TIMEOUT_MS.default);
    if (!r.ok) throw new Error("API unreachable");
    return r.json();
  },

  async parseResume(file) {
    const form = new FormData();
    form.append("resume", file);
    const r = await fetchWithTimeout(
      `${API_BASE}/resume/parse`,
      { method: "POST", body: form },
      TIMEOUT_MS.resume
    );
    if (!r.ok) throw new Error((await parseJsonSafely(r)).error || "Resume parse failed");
    return r.json();
  },

  async getQuestions(payload) {
    const r = await fetchWithTimeout(
      `${API_BASE}/questions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TIMEOUT_MS.questions
    );
    if (!r.ok) throw new Error((await parseJsonSafely(r)).error || "Failed to generate questions");
    return r.json();
  },

  async evaluateAnswer(payload) {
    const r = await fetchWithTimeout(
      `${API_BASE}/evaluate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TIMEOUT_MS.evaluate
    );
    if (!r.ok) throw new Error((await parseJsonSafely(r)).error || "Evaluation failed");
    return r.json();
  },

  async generateReport(payload) {
    const r = await fetchWithTimeout(
      `${API_BASE}/report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TIMEOUT_MS.report
    );
    if (!r.ok) throw new Error((await parseJsonSafely(r)).error || "Report generation failed");
    return r.json();
  },

  async getHistory() {
    const r = await fetchWithTimeout(`${API_BASE}/history`, {}, TIMEOUT_MS.default);
    if (!r.ok) throw new Error("Failed to fetch history");
    return r.json();
  },

  async deleteSession(id) {
    const r = await fetchWithTimeout(`${API_BASE}/history/${id}`, { method: "DELETE" }, TIMEOUT_MS.default);
    if (!r.ok) throw new Error("Failed to delete session");
    return r.json();
  },
};
