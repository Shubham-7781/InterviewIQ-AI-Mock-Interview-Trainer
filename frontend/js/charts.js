const Charts = {
  radarChart: null,
  trendChart: null,

  renderRadar(canvasId, dimensionAverages) {
    const ctx = document.getElementById(canvasId).getContext("2d");
    if (this.radarChart) this.radarChart.destroy();

    const labels = ["Content", "Structure", "Technical accuracy", "Clarity", "Confidence"];
    const data = [
      dimensionAverages.contentRelevance,
      dimensionAverages.structure,
      dimensionAverages.technicalAccuracy,
      dimensionAverages.communicationClarity,
      dimensionAverages.confidence,
    ];

    this.radarChart = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: "Score",
          data,
          backgroundColor: "rgba(199,154,68,0.18)",
          borderColor: "#C79A44",
          pointBackgroundColor: "#0F2A35",
          borderWidth: 2,
        }],
      },
      options: {
        scales: {
          r: {
            min: 0, max: 10,
            ticks: { display: false },
            grid: { color: "#DCD8CC" },
            angleLines: { color: "#DCD8CC" },
            pointLabels: { font: { family: "Inter", size: 11 }, color: "#101B2D" },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  },

  renderTrend(canvasId, sessions) {
    const ctx = document.getElementById(canvasId).getContext("2d");
    if (this.trendChart) this.trendChart.destroy();

    const ordered = [...sessions].reverse();
    const labels = ordered.map((s) => new Date(s.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
    const data = ordered.map((s) => s.report?.overallReadinessScore ?? 0);

    this.trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Readiness score",
          data,
          borderColor: "#2F8F6B",
          backgroundColor: "rgba(47,143,107,0.12)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#0F2A35",
        }],
      },
      options: {
        scales: {
          y: { min: 0, max: 100, grid: { color: "#DCD8CC" } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  },
};
