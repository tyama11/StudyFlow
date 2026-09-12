// Simple dependency-free Canvas Chart for StudyFlow

export function renderWeeklyChart(canvasId, dailyData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set physical display size vs pixel buffer size
  const displayWidth = canvas.parentElement.clientWidth || 700;
  const displayHeight = 220;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const graphWidth = displayWidth - padding.left - padding.right;
  const graphHeight = displayHeight - padding.top - padding.bottom;

  // dailyData is array of { date: 'YYYY-MM-DD', label: '9/12(土)', minutes: 120 }
  const maxMinutes = Math.max(60, ...dailyData.map(d => d.minutes));
  const ceilMax = Math.ceil(maxMinutes / 60) * 60; // round up to hours

  // Draw Grid lines & Y-axis labels
  ctx.strokeStyle = '#334155';
  ctx.fillStyle = '#94a3b8';
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

    // Gradient for bars
    const grad = ctx.createLinearGradient(0, yTop, 0, padding.top + graphHeight);
    grad.addColorStop(0, '#818cf8');
    grad.addColorStop(1, '#4f46e5');

    // Rounded rectangle bar
    const radius = 6;
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (barH > 4) {
      ctx.roundRect(xLeft, yTop, barWidth, barH, [radius, radius, 0, 0]);
    } else {
      ctx.fillRect(xLeft, padding.top + graphHeight - 2, barWidth, 2);
    }
    ctx.fill();

    // Value on top of bar if > 0
    if (item.minutes > 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.font = '10px ui-monospace, monospace';
      const m = Math.floor(item.minutes % 60);
      const h = Math.floor(item.minutes / 60);
      const text = h > 0 ? `${h}h${m}m` : `${m}m`;
      ctx.fillText(text, xCenter, yTop - 8);
    }

    // X-axis date label
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillText(item.label, xCenter, displayHeight - padding.bottom + 18);
  });
}
