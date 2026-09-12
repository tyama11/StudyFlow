// Simple dependency-free Canvas Chart for StudyFlow

export function renderWeeklyChart(canvasId, dailyData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const displayWidth = canvas.parentElement.clientWidth || 700;
  const displayHeight = 220;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Check current theme
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const isLight = currentTheme === 'light' || (!currentTheme && window.matchMedia('(prefers-color-scheme: light)').matches);

  const gridColor = isLight ? '#e2e8f0' : '#334155';
  const textColor = isLight ? '#64748b' : '#94a3b8';
  const valueColor = isLight ? '#0f172a' : '#f8fafc';

  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const graphWidth = displayWidth - padding.left - padding.right;
  const graphHeight = displayHeight - padding.top - padding.bottom;

  const maxMinutes = Math.max(60, ...dailyData.map(d => d.minutes));
  const ceilMax = Math.ceil(maxMinutes / 60) * 60;

  // Draw Grid lines & Y-axis labels
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = (ceilMax / yTicks) * i;
    const yPos = padding.top + graphHeight - (i / yTicks) * graphHeight;

    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(displayWidth - padding.right, yPos);
    ctx.stroke();

    const hours = (yVal / 60).toFixed(1).replace('.0', '');
    ctx.fillText(`${hours}h`, padding.left - 8, yPos);
  }

  // Draw Bars
  const barCount = dailyData.length;
  if (barCount === 0) return;

  const step = graphWidth / barCount;
  const barWidth = Math.min(36, step * 0.55);

  dailyData.forEach((item, index) => {
    const xCenter = padding.left + index * step + step / 2;
    const barH = (item.minutes / ceilMax) * graphHeight;
    const yTop = padding.top + graphHeight - barH;
    const xLeft = xCenter - barWidth / 2;

    const grad = ctx.createLinearGradient(0, yTop, 0, padding.top + graphHeight);
    grad.addColorStop(0, '#818cf8');
    grad.addColorStop(1, '#4f46e5');

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
      ctx.textAlign = 'center';
      ctx.font = '10px ui-monospace, monospace';
      const m = Math.floor(item.minutes % 60);
      const h = Math.floor(item.minutes / 60);
      const text = h > 0 ? `${h}h${m}m` : `${m}m`;
      ctx.fillText(text, xCenter, yTop - 8);
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillText(item.label, xCenter, displayHeight - padding.bottom + 18);
  });
}
