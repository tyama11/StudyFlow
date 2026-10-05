// StudyFlow Weekly Study Chart
// Supports Chart.js (bundled locally for desktop app, loaded via CDN on GitHub Pages)
// with automatic fallback to native canvas rendering.

import Chart from "chart.js/auto";
import type { DailyChartData } from "./types/index.js";

let activeChartInstance: Chart | null = null;

export function renderWeeklyChart(canvasId: string, dailyData: DailyChartData[]): void {
  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  // テーマに応じたカラー判定
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const isLight =
    currentTheme === "light" ||
    (!currentTheme && window.matchMedia("(prefers-color-scheme: light)").matches);

  const gridColor = isLight ? "rgba(226, 232, 240, 0.8)" : "rgba(51, 65, 85, 0.6)";
  const textColor = isLight ? "#64748b" : "#94a3b8";

  // Chart.js が利用可能な場合はモダンでインタラクティブな Chart.js で描画
  if (typeof Chart === "function") {
    try {
      if (activeChartInstance) {
        activeChartInstance.destroy();
        activeChartInstance = null;
      }

      const displayWidth = canvas.parentElement?.clientWidth ?? 700;
      const displayHeight = 220;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const labels = dailyData.map((d) => d.label);
      const minutesData = dailyData.map((d) => d.minutes);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
      gradient.addColorStop(0, "#818cf8");
      gradient.addColorStop(1, "#4f46e5");

      activeChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "学習時間 (分)",
              data: minutesData,
              backgroundColor: gradient,
              borderRadius: 6,
              borderSkipped: false,
              maxBarThickness: 38,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 500,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: isLight ? "#0f172a" : "#1e293b",
              titleColor: "#f8fafc",
              bodyColor: "#f8fafc",
              padding: 10,
              cornerRadius: 6,
              displayColors: false,
              callbacks: {
                label(context): string {
                  const m = context.parsed.y ?? 0;
                  const hours = Math.floor(m / 60);
                  const mins = Math.floor(m % 60);
                  if (hours > 0 && mins > 0) return `学習時間: ${hours}時間${mins}分 (${m}分)`;
                  if (hours > 0) return `学習時間: ${hours}時間 (${m}分)`;
                  return `学習時間: ${mins}分`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: {
                display: false,
              },
              ticks: {
                color: textColor,
                font: {
                  size: 11,
                },
              },
            },
            y: {
              beginAtZero: true,
              grid: {
                color: gridColor,
              },
              ticks: {
                color: textColor,
                font: {
                  size: 11,
                },
                callback(val): string {
                  const numVal = typeof val === "number" ? val : Number(val);
                  const hours = (numVal / 60).toFixed(1).replace(".0", "");
                  return `${hours}h`;
                },
              },
            },
          },
        },
      });
      return;
    } catch (e) {
      console.warn("Chart.js rendering warning, falling back to native canvas:", e);
    }
  }

  // --- フォールバック: ネイティブ Canvas 描画 ---
  renderNativeCanvasChart(canvas, dailyData, isLight, gridColor, textColor);
}

function renderNativeCanvasChart(
  canvas: HTMLCanvasElement,
  dailyData: DailyChartData[],
  isLight: boolean,
  gridColor: string,
  textColor: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;

  const displayWidth = canvas.parentElement?.clientWidth ?? 700;
  const displayHeight = 220;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const valueColor = isLight ? "#0f172a" : "#f8fafc";
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const graphWidth = displayWidth - padding.left - padding.right;
  const graphHeight = displayHeight - padding.top - padding.bottom;

  const maxMinutes = Math.max(60, ...dailyData.map((d) => d.minutes));
  const ceilMax = Math.ceil(maxMinutes / 60) * 60;

  // Grid lines & Y-axis labels
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = (ceilMax / yTicks) * i;
    const yPos = padding.top + graphHeight - (i / yTicks) * graphHeight;

    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(displayWidth - padding.right, yPos);
    ctx.stroke();

    const hours = (yVal / 60).toFixed(1).replace(".0", "");
    ctx.fillText(`${hours}h`, padding.left - 8, yPos);
  }

  // Bars
  const barCount = dailyData.length;
  if (barCount === 0) {
    return;
  }

  const step = graphWidth / barCount;
  const barWidth = Math.min(36, step * 0.55);

  dailyData.forEach((item, index) => {
    const xCenter = padding.left + index * step + step / 2;
    const barH = (item.minutes / ceilMax) * graphHeight;
    const yTop = padding.top + graphHeight - barH;
    const xLeft = xCenter - barWidth / 2;

    const grad = ctx.createLinearGradient(0, yTop, 0, padding.top + graphHeight);
    grad.addColorStop(0, "#818cf8");
    grad.addColorStop(1, "#4f46e5");

    const radius = 6;
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (barH > 4) {
      ctx.roundRect(xLeft, yTop, barWidth, barH, [radius, radius, 0, 0]);
    } else {
      ctx.fillRect(xLeft, padding.top + graphHeight - 2, barWidth, 2);
    }
    ctx.fill();

    if (item.minutes > 0) {
      ctx.fillStyle = valueColor;
      ctx.textAlign = "center";
      ctx.font = "10px ui-monospace, monospace";
      const m = Math.floor(item.minutes % 60);
      const h = Math.floor(item.minutes / 60);
      const text = h > 0 ? `${h}h${m}m` : `${m}m`;
      ctx.fillText(text, xCenter, yTop - 8);
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.font = "11px sans-serif";
    ctx.fillText(item.label, xCenter, displayHeight - padding.bottom + 18);
  });
}
